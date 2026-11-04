/* KOJOH Practice engine.
 * Runs SQL (DuckDB-WASM) and Python (Pyodide, in a worker) entirely in the browser,
 * and fingerprints results so answers can be checked without ever shipping the answer.
 * Shared by the site (/practice) and the admin (/admin/practice), so hashes always match.
 */
(function () {
  'use strict';
  var CFG = {
    duckdb: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm',
    duckdbBundles: null,
    pyodide: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    pyTimeout: 30000
  };
  var KP = window.KojohPractice = {
    config: function (o) { for (var k in o) CFG[k] = o[k]; }
  };

  // ------------------------------------------------------------------ files
  var textCache = {};
  function fetchText(url) {
    if (!textCache[url]) {
      textCache[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error('Could not load data file (' + r.status + ').');
        return r.text();
      });
      textCache[url].catch(function () { delete textCache[url]; });
    }
    return textCache[url];
  }
  KP.fetchText = fetchText;
  function safeName(n) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) throw new Error('Table names can only use letters, digits and _ : ' + n);
    return n;
  }

  // ------------------------------------------------------------------ SQL (DuckDB)
  var sqlP = null, sqlTables = {};
  KP.sqlReady = function () {
    if (sqlP) return sqlP;
    sqlP = (async function () {
      var duckdb = await import(CFG.duckdb);
      var bundle = await duckdb.selectBundle(CFG.duckdbBundles || duckdb.getJsDelivrBundles());
      var wurl = URL.createObjectURL(new Blob(['importScripts("' + bundle.mainWorker + '");'], { type: 'text/javascript' }));
      var worker = new Worker(wurl);
      var db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(wurl);
      await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } });
      var conn = await db.connect();
      return { db: db, conn: conn };
    })();
    sqlP.catch(function () { sqlP = null; });
    return sqlP;
  };

  // files: [{ name: 'orders', url: 'https://.../orders.csv' }]
  KP.sqlLoad = async function (files) {
    var e = await KP.sqlReady();
    for (var i = 0; i < files.length; i++) {
      var f = files[i], name = safeName(f.name);
      if (sqlTables[name] === f.url) continue;
      var text = await fetchText(f.url);
      await e.db.registerFileText(name + '.csv', text);
      await e.conn.query('CREATE OR REPLACE TABLE "' + name + '" AS SELECT * FROM read_csv_auto(\'' + name + '.csv\', header = true)');
      sqlTables[name] = f.url;
    }
  };

  function fmtDate(v, kind) {
    if (v === null || v === undefined) return null;
    var d;
    if (v instanceof Date) d = v;
    else {
      var n = Number(v);
      if (Math.abs(n) > 1e14) n = n / 1000;      // microseconds
      d = new Date(n);
    }
    if (isNaN(d.getTime())) return String(v);
    var iso = d.toISOString();
    if (kind === 'date') return iso.slice(0, 10);
    var s = iso.slice(0, 19).replace('T', ' ');
    return s.slice(11) === '00:00:00' ? s.slice(0, 10) : s;
  }
  function plain(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (v instanceof Date) return fmtDate(v, 'ts');
    if (v && typeof v.toJSON === 'function') { try { return JSON.stringify(v.toJSON()); } catch (e) {} }
    if (v && typeof v.toArray === 'function') { try { return JSON.stringify(Array.from(v.toArray(), plain)); } catch (e) {} }
    return String(v);
  }
  function arrowRows(table) {
    var fields = table.schema.fields;
    var cols = fields.map(function (f) { return f.name; });
    var kinds = fields.map(function (f) {
      var t = String(f.type);
      return /Timestamp/i.test(t) ? 'ts' : (/Date/i.test(t) ? 'date' : '');
    });
    var vecs = cols.map(function (_, j) { return table.getChildAt(j); });
    var rows = [];
    for (var i = 0; i < table.numRows; i++) {
      var row = [];
      for (var j = 0; j < cols.length; j++) {
        var v = vecs[j] ? vecs[j].get(i) : null;
        row.push(kinds[j] ? fmtDate(v, kinds[j]) : plain(v));
      }
      rows.push(row);
    }
    return { columns: cols, rows: rows };
  }

  KP.sqlRun = async function (sql) {
    var e = await KP.sqlReady();
    var t0 = performance.now();
    await e.conn.query('BEGIN TRANSACTION');
    try {
      var table = await e.conn.query(sql);
      var out = arrowRows(table);
      out.ms = Math.round(performance.now() - t0);
      return out;
    } catch (err) {
      throw new Error(cleanSqlErr(String((err && err.message) || err)));
    } finally {
      try { await e.conn.query('ROLLBACK'); } catch (x) {}
    }
  };
  function cleanSqlErr(m) { return m.replace(/^Error:\s*/, '').replace(/\n\s*\n/g, '\n').trim(); }

  // ------------------------------------------------------------------ Python (Pyodide in a worker)
  var PY_HELPER = [
    'import pandas as pd, numpy as np, json, math',
    '_T = {}',
    'def _kojoh_load(names_json):',
    '    for n in json.loads(names_json):',
    '        _T[n] = pd.read_csv(n + ".csv")',
    'def _kojoh_rows(r):',
    '    if isinstance(r, pd.Series):',
    '        if r.index.name is not None or isinstance(r.index, pd.MultiIndex):',
    '            r = r.reset_index()',
    '        else:',
    '            r = r.to_frame()',
    '    if isinstance(r, pd.DataFrame):',
    '        if r.index.name is not None or isinstance(r.index, pd.MultiIndex):',
    '            r = r.reset_index()',
    '        else:',
    '            r = r.reset_index(drop=True)',
    '        cols = [str(c) for c in r.columns]',
    '        vals = r.astype(object).where(pd.notna(r), None).values.tolist()',
    '        return cols, vals',
    '    if isinstance(r, dict):',
    '        return ["key", "value"], [[k, v] for k, v in r.items()]',
    '    if isinstance(r, (list, tuple, np.ndarray, pd.Index)):',
    '        vals = [list(x) if isinstance(x, (list, tuple, np.ndarray)) else [x] for x in list(r)]',
    '        n = max([len(v) for v in vals] or [1])',
    '        return ["c" + str(i + 1) for i in range(n)], vals',
    '    return ["result"], [[r]]',
    'def _kojoh_clean(v):',
    '    if v is None: return None',
    '    if isinstance(v, (bool, np.bool_)): return int(bool(v))',
    '    if isinstance(v, np.integer): return int(v)',
    '    if isinstance(v, (float, np.floating)):',
    '        f = float(v)',
    '        return None if (math.isnan(f) or math.isinf(f)) else f',
    '    if isinstance(v, pd.Timestamp):',
    '        if pd.isna(v): return None',
    '        s = v.strftime("%Y-%m-%d %H:%M:%S")',
    '        return s[:10] if s.endswith("00:00:00") else s',
    '    if isinstance(v, (int, str)): return v',
    '    try:',
    '        if pd.isna(v): return None',
    '    except Exception:',
    '        pass',
    '    return str(v)',
    'def _kojoh_exec(code):',
    '    ns = {"pd": pd, "np": np}',
    '    for k, v in _T.items():',
    '        ns[k] = v.copy()',
    '    exec(compile(code, "<your code>", "exec"), ns)',
    '    if "result" not in ns:',
    '        raise NameError("Store your final answer in a variable called result")',
    '    cols, vals = _kojoh_rows(ns["result"])',
    '    vals = [[_kojoh_clean(x) for x in row] for row in vals]',
    '    return json.dumps({"columns": cols, "rows": vals}, default=str)'
  ].join('\n');

  function workerSource(base) {
    return [
      'importScripts(' + JSON.stringify(base + 'pyodide.js') + ');',
      'var py = null, out = "";',
      'var HELPER = ' + JSON.stringify(PY_HELPER) + ';',
      'function cleanErr(m){',
      '  var lines = String(m).split("\\n");',
      '  var i = -1; for (var k = 0; k < lines.length; k++) if (lines[k].indexOf("<your code>") >= 0) i = k;',
      '  if (i >= 0) return lines.slice(i).join("\\n").replace(/File "<your code>", /g, "").trim();',
      '  for (var j = lines.length - 1; j >= 0; j--) if (lines[j].trim()) return lines[j].trim();',
      '  return String(m);',
      '}',
      'onmessage = async function(e){',
      '  var m = e.data; out = "";',
      '  try {',
      '    if (m.type === "init") {',
      '      py = await loadPyodide({ indexURL: ' + JSON.stringify(base) + ', stdout: function(s){ out += s + "\\n"; }, stderr: function(s){ out += s + "\\n"; } });',
      '      await py.loadPackage(["pandas"]);',
      '      py.runPython(HELPER);',
      '      postMessage({ id: m.id, ok: true }); return;',
      '    }',
      '    if (m.type === "load") {',
      '      m.files.forEach(function(f){ py.FS.writeFile(f.name + ".csv", f.text); });',
      '      py.globals.set("_kj_arg", JSON.stringify(m.files.map(function(f){ return f.name; })));',
      '      py.runPython("_kojoh_load(_kj_arg)");',
      '      postMessage({ id: m.id, ok: true }); return;',
      '    }',
      '    if (m.type === "run") {',
      '      py.globals.set("_kj_arg", m.code);',
      '      var r = py.runPython("_kojoh_exec(_kj_arg)");',
      '      postMessage({ id: m.id, ok: true, data: JSON.parse(r), out: out }); return;',
      '    }',
      '  } catch (err) {',
      '    postMessage({ id: m.id, ok: false, error: cleanErr((err && err.message) || err), out: out });',
      '  }',
      '};'
    ].join('\n');
  }

  var pyW = null, pyInit = null, pySeq = 0, pyPending = {}, pyLoaded = {};
  function pyCall(type, data, timeout) {
    return new Promise(function (res, rej) {
      var id = ++pySeq;
      pyPending[id] = { res: res, rej: rej };
      var msg = { id: id, type: type };
      for (var k in data || {}) msg[k] = data[k];
      pyW.postMessage(msg);
      if (timeout) setTimeout(function () {
        if (!pyPending[id]) return;
        delete pyPending[id];
        KP.pyReset();
        rej(new Error('Your code ran for more than ' + Math.round(timeout / 1000) + ' seconds and was stopped. Check for an endless loop.'));
      }, timeout);
    });
  }
  KP.pyReady = function () {
    if (pyW) return pyInit;
    var url = URL.createObjectURL(new Blob([workerSource(CFG.pyodide)], { type: 'text/javascript' }));
    pyW = new Worker(url);
    pyLoaded = {};
    pyW.onmessage = function (e) {
      var m = e.data, p = pyPending[m.id];
      if (!p) return;
      delete pyPending[m.id];
      if (m.ok) p.res(m);
      else { var er = new Error(m.error); er.out = m.out; p.rej(er); }
    };
    pyW.onerror = function (e) {
      var msg = (e && e.message) || 'Python could not start. Check your connection and reload.';
      Object.keys(pyPending).forEach(function (id) { pyPending[id].rej(new Error(msg)); delete pyPending[id]; });
    };
    pyInit = pyCall('init');
    pyInit.catch(function () { KP.pyReset(); });
    return pyInit;
  };
  KP.pyReset = function () {
    if (pyW) pyW.terminate();
    pyW = null; pyInit = null; pyLoaded = {};
    Object.keys(pyPending).forEach(function (id) { pyPending[id].rej(new Error('Python was restarted.')); delete pyPending[id]; });
  };
  KP.pyLoad = async function (files) {
    await KP.pyReady();
    var need = files.filter(function (f) { safeName(f.name); return pyLoaded[f.name] !== f.url; });
    if (!need.length) return;
    var arr = await Promise.all(need.map(async function (f) { return { name: f.name, text: await fetchText(f.url) }; }));
    await pyCall('load', { files: arr });
    need.forEach(function (f) { pyLoaded[f.name] = f.url; });
  };
  KP.pyRun = async function (code) {
    await KP.pyReady();
    var t0 = performance.now();
    var m = await pyCall('run', { code: code }, CFG.pyTimeout);
    return { columns: m.data.columns, rows: m.data.rows, out: m.out || '', ms: Math.round(performance.now() - t0) };
  };

  // ------------------------------------------------------------------ one entry point
  KP.load = function (tool, files) { return tool === 'python' ? KP.pyLoad(files) : KP.sqlLoad(files); };
  KP.run = function (tool, code) { return tool === 'python' ? KP.pyRun(code) : KP.sqlRun(code); };

  // ------------------------------------------------------------------ fingerprints
  function normVal(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') v = Number(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') {
      if (!isFinite(v)) return null;
      var r = Math.round(v * 100) / 100;
      return r === 0 ? 0 : r;
    }
    var s = String(v).trim();
    if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 16) return normVal(Number(s));
    if (/^(true|false)$/i.test(s)) return /^true$/i.test(s) ? 1 : 0;
    return s.replace(/^(\d{4}-\d{2}-\d{2})[ T]00:00:00(\.0+)?$/, '$1');
  }
  KP.normalize = function (rows, ordered) {
    var lines = rows.map(function (row) { return JSON.stringify(row.map(normVal)); });
    if (!ordered) lines.sort();
    return lines;
  };
  KP.fingerprint = async function (res, ordered) {
    var lines = KP.normalize(res.rows || [], ordered);
    var cols = (res.columns || []).length;
    var txt = cols + '\n' + lines.join('\n');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return { hash: hex, rows: lines.length, cols: cols };
  };
  // ------------------------------------------------------------------ publishing (admin)
  // src: { id, short, title, company, story, tables:[{name,file,about}], tasks:[{id,tool,level,title,question,solution,hint,ordered,points,starter,explain}] }
  // Runs every solution, stores its fingerprint, and splits into a free pack (first freeN per tool open) and a pro pack.
  var PUBLIC = ['id', 'n', 'tool', 'level', 'title', 'points', 'question', 'hint', 'starter', 'tables', 'ordered', 'hash', 'rows', 'cols'];
  KP.buildPacks = async function (src, opts) {
    opts = opts || {};
    var freeN = opts.freeN === undefined ? 5 : opts.freeN;
    var v = opts.v || Date.now();
    var say = opts.onProgress || function () {};
    var files = src.tables.map(function (t) { return { name: t.name, url: opts.dataBase + t.file + '?v=' + (t.v || v) }; });
    say('Loading tables');
    await KP.sqlLoad(files);
    var tables = [];
    for (var i = 0; i < src.tables.length; i++) {
      var t = src.tables[i];
      var d = await KP.sqlRun('DESCRIBE "' + t.name + '"');
      var c = await KP.sqlRun('SELECT COUNT(*) AS n FROM "' + t.name + '"');
      tables.push({ name: t.name, file: t.file, about: t.about || '', v: t.v || v, rows: c.rows[0][0],
                    columns: d.rows.map(function (r) { return [r[0], r[1]]; }) });
    }
    var skip = opts.skipTools || [];
    var needPy = src.tasks.some(function (t) { return t.tool === 'python' && skip.indexOf('python') < 0; });
    if (needPy) { say('Starting Python'); await KP.pyLoad(files); }
    var errors = [], count = {}, done = [];
    for (var k = 0; k < src.tasks.length; k++) {
      var task = Object.assign({}, src.tasks[k]);
      count[task.tool] = (count[task.tool] || 0) + 1;
      task.n = count[task.tool];
      task.tables = src.tables.map(function (x) { return x.name; }).filter(function (n) {
        return new RegExp('\\b' + n + '\\b').test(task.solution || '');
      });
      if (skip.indexOf(task.tool) < 0) {
        say('Checking ' + task.id + ' (' + (k + 1) + ' of ' + src.tasks.length + ')');
        try {
          var res = await KP.run(task.tool, task.solution);
          var fp = await KP.fingerprint(res, task.ordered);
          task.hash = fp.hash; task.rows = fp.rows; task.cols = fp.cols;
          if (!fp.rows) errors.push({ id: task.id, error: 'Solution returns no rows. Learners can never match an empty answer by mistake, but check it is intended.', warn: true });
        } catch (e) { errors.push({ id: task.id, error: e.message }); }
      }
      done.push(task);
    }
    var meta = { id: src.id, short: src.short, title: src.title, company: src.company, story: src.story, tables: tables, v: v };
    function pick(t, full) {
      var o = {}; PUBLIC.forEach(function (f) { if (t[f] !== undefined) o[f] = t[f]; });
      if (full) { o.solution = t.solution; if (t.explain) o.explain = t.explain; }
      return o;
    }
    var free = Object.assign({}, meta, { tasks: done.map(function (t) {
      return t.n <= freeN ? pick(t, false) : { id: t.id, n: t.n, tool: t.tool, level: t.level, title: t.title, points: t.points, locked: true };
    }) });
    var pro = Object.assign({}, meta, { tasks: done.map(function (t) { return pick(t, true); }) });
    var cleanSrc = Object.assign({}, src, { tables: src.tables.map(function (t) { return { name: t.name, file: t.file, about: t.about || '', v: t.v || v }; }),
      tasks: done.map(function (t) { var o = Object.assign({}, t); delete o.n; return o; }) });
    return { v: v, errors: errors, free: free, pro: pro, src: cleanSrc,
             summary: { id: src.id, short: src.short, title: src.title, company: src.company, v: v, tasks: done.length,
                        free: done.filter(function (t) { return t.n <= freeN; }).length } };
  };

  // task: { hash, rows, cols, ordered }
  KP.check = async function (task, res) {
    var fp = await KP.fingerprint(res, task.ordered);
    if (fp.hash === task.hash) return { ok: true, fp: fp };
    var why;
    if (task.cols && fp.cols !== task.cols) why = 'Your result has ' + fp.cols + ' column' + (fp.cols === 1 ? '' : 's') + '; the answer has ' + task.cols + '.';
    else if (task.rows !== undefined && fp.rows !== task.rows) why = 'Your result has ' + fp.rows + ' row' + (fp.rows === 1 ? '' : 's') + '; the answer has ' + task.rows + '.';
    else why = 'Right shape, but some values differ. Check your filters, joins, duplicates and rounding (2 decimals)' + (task.ordered ? ', and the sort order.' : '.');
    return { ok: false, fp: fp, why: why };
  };
})();
