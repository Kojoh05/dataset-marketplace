/* KOJOH Practice page. Content comes from Storage (CDN), code runs in the browser,
 * so the only database calls are: pass status, payments mode, progress read, progress save on solve. */
(function () {
  'use strict';
  var LIVE = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
  var SUPA = LIVE ? window.kojohSupa() : null;
  var BASE = window.KOJOH_PRACTICE_BASE || (window.SUPABASE_URL + '/storage/v1/object/public/practice/');
  var KP = window.KojohPractice;
  var esc = window.kojohEsc || function (s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
  var app = document.getElementById('prApp');

  var PASSES = [
    { key: '30', days: 30, price: 199, label: '30 days', per: '' },
    { key: '90', days: 90, price: 499, label: '90 days', per: 'about ₹166 a month' },
    { key: '365', days: 365, price: 1499, label: '1 year', per: 'about ₹125 a month' }
  ];
  var TOOLS = [
    { key: 'sql', label: 'SQL' }, { key: 'python', label: 'Python' },
    { key: 'excel', label: 'Excel' }, { key: 'powerbi', label: 'Power BI' }
  ];
  function toolLabel(k) { var t = TOOLS.filter(function (x) { return x.key === k; })[0]; return t ? t.label : k; }
  function isAnswerTool(k) { return k === 'excel' || k === 'powerbi'; }
  var LEVELS = ['Foundations', 'Applied', 'Business case', 'Interview'];

  var S = {
    manifest: null, session: null, pass: null, live: false,
    packs: {}, progress: { solved: {}, points: 0 }, role: null, tool: 'sql', task: null,
    lastRun: null, attempted: {}
  };

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtRs(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function hasPass() { return !!(S.pass && new Date(S.pass.expires_at) > new Date()); }
  function toast(m, kind) { if (window.kojohToast) window.kojohToast(m, { kind: kind }); }

  // ------------------------------------------------------------------ data loading
  async function loadManifest() {
    var r = await fetch(BASE + 'manifest.json?t=' + Math.floor(Date.now() / 60000));
    if (!r.ok) throw new Error('Practice content is not published yet.');
    return r.json();
  }
  function roleMeta(id) { return (S.manifest.roles || []).filter(function (r) { return r.id === id; })[0]; }

  async function loadPack(roleId) {
    var meta = roleMeta(roleId);
    if (!meta) throw new Error('Unknown role.');
    var wantPro = hasPass();
    var key = roleId + (wantPro ? ':pro' : ':free');
    if (S.packs[key] && S.packs[key].v === meta.v) return S.packs[key];
    var cacheKey = 'kojoh-prac-' + key;
    var cached = lsGet(cacheKey, null);
    if (cached && cached.v === meta.v) { S.packs[key] = cached; return cached; }
    var pack = null;
    if (wantPro) {
      var d = await SUPA.storage.from('practice-pro').download('pro/' + roleId + '.json');
      if (!d.error && d.data) pack = JSON.parse(await d.data.text());
    }
    if (!pack) {
      var r = await fetch(BASE + 'free/' + roleId + '.json?v=' + meta.v);
      if (!r.ok) throw new Error('Could not load ' + meta.title + ' tasks.');
      pack = await r.json();
    }
    S.packs[key] = pack;
    lsSet(cacheKey, pack);
    return pack;
  }
  function tableFiles(pack, names) {
    return pack.tables.filter(function (t) { return !names || names.indexOf(t.name) >= 0; })
      .map(function (t) { return { name: t.name, url: BASE + 'data/' + t.file + '?v=' + (t.v || pack.v) }; });
  }

  // ------------------------------------------------------------------ progress (1 read, writes only on solve)
  var saveTimer = null;
  async function loadProgress() {
    var local = lsGet('kojoh-prac-progress', { solved: {}, points: 0 });
    S.progress = local;
    if (!S.session) return;
    var r = await SUPA.from('practice_progress').select('solved, points').maybeSingle();
    if (r.error) return;
    var remote = (r.data && r.data.solved) || {};
    var merged = Object.assign({}, remote, local.solved);
    S.progress = { solved: merged, points: sumPoints(merged) };
    lsSet('kojoh-prac-progress', S.progress);
    if (Object.keys(merged).length !== Object.keys(remote).length) queueSave();
  }
  function sumPoints(solved) { var p = 0; for (var k in solved) p += Number(solved[k].p) || 0; return p; }
  function markSolved(task) {
    if (S.progress.solved[task.id]) return false;
    S.progress.solved[task.id] = { p: task.points, t: Date.now() };
    S.progress.points = sumPoints(S.progress.solved);
    lsSet('kojoh-prac-progress', S.progress);
    queueSave();
    return true;
  }
  function queueSave() {
    if (!S.session) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      SUPA.from('practice_progress').upsert({ user_id: S.session.user.id, solved: S.progress.solved, points: S.progress.points, updated_at: new Date().toISOString() })
        .then(function (r) { if (r.error) console.warn('progress save', r.error.message); });
    }, 1500);
  }

  // ------------------------------------------------------------------ routing
  function readUrl() {
    var q = new URLSearchParams(location.search);
    return { role: q.get('role'), tool: q.get('tool'), task: q.get('task') };
  }
  function go(role, tool, task, replace) {
    var q = new URLSearchParams();
    if (role) q.set('role', role);
    if (tool && tool !== 'sql') q.set('tool', tool);
    if (task) q.set('task', task);
    var url = location.pathname + (q.toString() ? '?' + q : '');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    route();
  }
  window.addEventListener('popstate', route);

  async function route() {
    var u = readUrl();
    S.tool = (TOOLS.some(function (t) { return t.key === u.tool; }) ? u.tool : 'sql');
    if (!u.role || !roleMeta(u.role)) { S.role = null; S.task = null; renderHome(); return; }
    S.role = u.role;
    lsSet('kojoh-prac-role', u.role);
    try { var pack = await loadPack(u.role); }
    catch (e) { app.innerHTML = '<div class="empty-state"><h3>Could not load tasks</h3><p>' + esc(e.message) + '</p></div>'; return; }
    if (u.task) {
      var t = pack.tasks.filter(function (x) { return x.id === u.task; })[0];
      if (t) { S.tool = t.tool; renderTask(pack, t); return; }
    }
    S.task = null;
    renderRole(pack);
  }

  // ------------------------------------------------------------------ views
  function passCard() {
    if (hasPass()) {
      return '<section class="pr-pass pr-pass-on"><div><div class="pr-eyebrow">Practice pass active</div>'
        + '<h3>Everything is unlocked until ' + esc(fmtDate(S.pass.expires_at)) + '</h3>'
        + '<p>All roles, all tasks and full solutions. You also get 20% off portfolio projects.</p></div>'
        + '<div class="pr-pass-plans">' + PASSES.map(function (p) {
          return '<button class="k-btn" type="button" data-pass="' + p.key + '">Extend ' + p.label + ', ' + fmtRs(p.price) + '</button>';
        }).join('') + '</div></section>';
    }
    return '<section class="pr-pass"><div><div class="pr-eyebrow">Practice pass</div>'
      + '<h3>Unlock every task in every role</h3>'
      + '<ul class="pr-perks"><li>All SQL, Python, Excel and Power BI tasks, from basics to interview level</li>'
      + '<li>Full solutions with explanations</li><li>20% off every portfolio project while your pass is active</li>'
      + '<li>One-time payment, no auto-renewal</li></ul></div>'
      + '<div class="pr-pass-plans">' + PASSES.map(function (p, i) {
        return '<button class="pr-plan' + (i === 1 ? ' pr-plan-pop' : '') + '" type="button" data-pass="' + p.key + '">'
          + (i === 1 ? '<span class="pr-plan-tag">Most popular</span>' : '')
          + '<span class="pr-plan-len">' + p.label + '</span><span class="pr-plan-price">' + fmtRs(p.price) + '</span>'
          + '<span class="pr-plan-per">' + (p.per || 'one month of practice') + '</span></button>';
      }).join('') + '</div></section>';
  }
  function roleStats(meta) {
    var done = 0;
    for (var id in S.progress.solved) if (id.indexOf(meta.short + '-') === 0) done++;
    return { done: done, total: meta.tasks };
  }

  function renderHome() {
    document.title = 'KOJOH | Practice SQL and Python for data roles';
    var h = '<div class="page-lead"><h1>Practice like it is the job</h1>'
      + '<p>Real business questions on realistic datasets. Write SQL or Python in your browser and get your answer checked instantly. Pick the role you are preparing for.</p></div>';
    h += '<div class="pr-roles">' + S.manifest.roles.map(function (r) {
      var st = roleStats(r), pct = st.total ? Math.round(100 * st.done / st.total) : 0;
      return '<button class="pr-role" type="button" data-role="' + esc(r.id) + '">'
        + '<span class="pr-role-title">' + esc(r.title) + '</span>'
        + '<span class="pr-role-co">Case: ' + esc(r.company) + '</span>'
        + '<span class="pr-role-meta">' + r.tasks + ' tasks, ' + r.free + ' free</span>'
        + '<span class="pr-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>'
        + '<span class="pr-role-meta">' + st.done + ' solved</span></button>';
    }).join('') + '</div>';
    h += passCard();
    h += '<p class="pr-foot">Your code runs on your device, so nothing you type is sent anywhere. '
      + (S.session ? 'Progress is saved to your account.' : '<a href="/auth">Sign in</a> to save your progress across devices.') + '</p>';
    app.innerHTML = h;
  }

  function renderRole(pack) {
    document.title = 'KOJOH | ' + pack.title + ' practice';
    var tasks = pack.tasks.filter(function (t) { return t.tool === S.tool; });
    var h = '<a class="pr-back" href="/practice" data-nav="home">All roles</a>';
    h += '<div class="page-lead"><h1>' + esc(pack.title) + '</h1><p>' + esc(pack.story) + '</p></div>';
    h += '<details class="pr-tables"><summary>Tables in this case (' + pack.tables.length + ')</summary>'
      + pack.tables.map(function (t) {
        return '<div class="pr-tbl"><div class="pr-tbl-head"><code>' + esc(t.name) + '</code><span>' + Number(t.rows).toLocaleString('en-IN') + ' rows</span></div>'
          + '<p>' + esc(t.about) + '</p><div class="pr-cols">' + (t.columns || []).map(function (c) {
            return '<span class="pr-col">' + esc(c[0]) + ' <em>' + esc(String(c[1]).toLowerCase()) + '</em></span>';
          }).join('') + '</div></div>';
      }).join('') + '</details>';
    h += '<div class="pr-tabs" role="tablist">' + TOOLS.map(function (t) {
      var has = pack.tasks.some(function (x) { return x.tool === t.key; });
      return '<button type="button" role="tab" class="pr-tab' + (t.key === S.tool ? ' on' : '') + '" data-tool="' + t.key + '">'
        + t.label + (has ? '' : ' <span class="pr-soon">soon</span>') + '</button>';
    }).join('') + '</div>';
    var tool = TOOLS.filter(function (t) { return t.key === S.tool; })[0];
    if (!tasks.length) {
      h += '<div class="empty-state pr-soonbox"><h3>' + tool.label + ' practice for ' + esc(pack.title) + ' is coming</h3><p>'
        + (isAnswerTool(tool.key) ? 'You will download the data, build it in ' + tool.label + ', and type the numbers your work shows to get them checked.' : 'Tasks for this tool are on the way.')
        + ' Try the other tabs meanwhile.</p></div>';
      app.innerHTML = h; return;
    }
    if (isAnswerTool(S.tool)) h += downloadBar(pack);
    LEVELS.forEach(function (lv) {
      var list = tasks.filter(function (t) { return t.level === lv; });
      if (!list.length) return;
      h += '<h2 class="pr-level">' + lv + '</h2><div class="pr-list">' + list.map(taskRow).join('') + '</div>';
    });
    if (!hasPass()) h += passCard();
    app.innerHTML = h;
  }
  function taskRow(t) {
    var done = !!S.progress.solved[t.id];
    return '<a class="pr-task' + (t.locked ? ' locked' : '') + (done ? ' done' : '') + '" href="?role=' + S.role + '&task=' + t.id + '" data-task="' + t.id + '">'
      + '<span class="pr-task-dot" aria-hidden="true">' + (done ? '&#10003;' : (t.locked ? '&#128274;' : t.n)) + '</span>'
      + '<span class="pr-task-title">' + esc(t.title) + '</span>'
      + '<span class="pr-task-pts">' + (t.locked ? 'Pass' : t.points + ' pts') + '</span></a>';
  }

  function renderTask(pack, t) {
    S.task = t;
    document.title = 'KOJOH | ' + t.title;
    var list = pack.tasks.filter(function (x) { return x.tool === t.tool; });
    var idx = list.indexOf(t), prev = list[idx - 1], next = list[idx + 1];
    var h = '<a class="pr-back" href="?role=' + S.role + (t.tool !== 'sql' ? '&tool=' + t.tool : '') + '" data-nav="role">' + esc(pack.title) + ' / ' + toolLabel(t.tool) + '</a>';
    h += '<div class="pr-taskhead"><div><div class="pr-eyebrow">' + esc(t.level) + ' &middot; ' + t.points + ' pts' + (S.progress.solved[t.id] ? ' &middot; Solved' : '') + '</div>'
      + '<h1 class="pr-title">' + esc(t.title) + '</h1></div>'
      + '<div class="pr-nav">' + (prev ? '<a class="k-btn" href="?role=' + S.role + '&task=' + prev.id + '" data-task="' + prev.id + '">Previous</a>' : '')
      + (next ? '<a class="k-btn" href="?role=' + S.role + '&task=' + next.id + '" data-task="' + next.id + '">Next</a>' : '') + '</div></div>';
    if (t.locked) {
      h += '<div class="pr-lockbox"><p>This task is part of the Practice pass.</p></div>' + passCard();
      app.innerHTML = h; return;
    }
    if (isAnswerTool(t.tool)) { app.innerHTML = h + answerTaskHtml(pack, t); wireAnswers(pack, t, next); return; }
    var draft = lsGet('kojoh-prac-code-' + t.id, null);
    h += '<div class="pr-work">'
      + '<section class="pr-brief"><p class="pr-q">' + esc(t.question) + '</p>'
      + '<div class="pr-chips">' + (t.tables || []).map(function (n) {
        return '<button type="button" class="k-chip pr-peek" data-peek="' + esc(n) + '">' + esc(n) + '</button>';
      }).join('') + '<span class="pr-hintline">Tap a table to preview it</span></div>'
      + '<div class="pr-acts"><button type="button" class="k-btn" id="prHint">Show hint</button>'
      + (t.solution ? '<button type="button" class="k-btn" id="prSol">Show solution</button>' : '') + '</div>'
      + '<div class="pr-hint" id="prHintBox" hidden>' + esc(t.hint || 'No hint for this one.') + '</div>'
      + (t.solution ? '<div class="pr-sol" id="prSolBox" hidden><pre><code>' + esc(t.solution) + '</code></pre>' + (t.explain ? '<p>' + esc(t.explain) + '</p>' : '') + '</div>'
        : '<p class="pr-note">Full solutions come with the <a href="/practice#pass" data-nav="home">Practice pass</a>.</p>')
      + '</section>'
      + '<section class="pr-editor"><div class="pr-edbar"><span>' + (t.tool === 'sql' ? 'SQL (DuckDB)' : 'Python 3 + pandas') + '</span>'
      + '<button type="button" class="pr-link" id="prReset">Reset code</button></div>'
      + '<textarea id="prCode" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Your code">' + esc(draft || t.starter) + '</textarea>'
      + '<div class="pr-runbar"><button type="button" class="k-btn" id="prRun">Run</button>'
      + '<button type="button" class="k-btn k-btn-brand" id="prCheck">Check answer</button>'
      + '<span class="pr-kbd">Ctrl + Enter runs</span></div>'
      + '<div class="pr-status" id="prStatus" aria-live="polite"></div>'
      + '<div class="pr-verdict" id="prVerdict" hidden></div>'
      + '<pre class="pr-out" id="prOut" hidden></pre>'
      + '<div class="pr-result" id="prResult"></div></section></div>';
    app.innerHTML = h;
    wireEditor(pack, t, next);
  }

  // ------------------------------------------------------------------ Excel / Power BI tasks
  function downloadBar(pack) {
    return '<div class="pr-dl"><div><strong>Get the data</strong><span>Open it in Excel, Google Sheets or Power BI Desktop.</span></div>'
      + '<div class="pr-dl-btns"><button type="button" class="k-btn k-btn-brand" data-xlsx="1">Excel workbook (.xlsx)</button>'
      + pack.tables.map(function (t) {
        return '<button type="button" class="k-btn" data-csv="' + esc(t.name) + '">' + esc(t.name) + '.csv</button>';
      }).join('') + '</div></div>';
  }
  var xlsxP = null;
  async function downloadWorkbook(pack, btn) {
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing workbook';
    try {
      if (!xlsxP) xlsxP = new Promise(function (res, rej) {
        var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        sc.onload = res; sc.onerror = function () { xlsxP = null; rej(new Error('Could not load the Excel builder. Download the CSV files instead.')); };
        document.head.appendChild(sc);
      });
      await xlsxP;
      var wb = window.XLSX.utils.book_new();
      for (var i = 0; i < pack.tables.length; i++) {
        var t = pack.tables[i];
        var txt = await KP.fetchText(BASE + 'data/' + t.file + '?v=' + (t.v || pack.v));
        var ws = window.XLSX.read(txt, { type: 'string', raw: false, cellDates: true }).Sheets.Sheet1;
        window.XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 31));
      }
      window.XLSX.writeFile(wb, (pack.company || 'kojoh') + '-practice-data.xlsx');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = label;
  }
  function answerTaskHtml(pack, t) {
    var saved = lsGet('kojoh-prac-ans-' + t.id, []), ticks = lsGet('kojoh-prac-chk-' + t.id, {});
    var h = downloadBar(pack) + '<div class="pr-work">'
      + '<section class="pr-brief"><p class="pr-q">' + esc(t.question) + '</p>'
      + '<div class="pr-acts"><button type="button" class="k-btn" id="prHint">Show hint</button>'
      + (t.explain ? '<button type="button" class="k-btn" id="prSol">Show method</button>' : '') + '</div>'
      + '<div class="pr-hint" id="prHintBox" hidden>' + esc(t.hint || 'No hint for this one.') + '</div>'
      + (t.explain ? '<div class="pr-sol" id="prSolBox" hidden><p>' + esc(t.explain) + '</p>'
          + (t.answer_values ? '<ul class="pr-anslist">' + t.fields.map(function (f, i) { return '<li>' + esc(f.label) + ': <strong>' + esc(t.answer_values[i]) + '</strong></li>'; }).join('') + '</ul>' : '') + '</div>'
        : '<p class="pr-note">The full method and answers come with the <a href="/practice#pass" data-nav="home">Practice pass</a>.</p>');
    if (t.checklist && t.checklist.length) {
      h += '<div class="pr-checklist"><div class="pr-eyebrow">Your build should have</div>' + t.checklist.map(function (c, i) {
        return '<label><input type="checkbox" data-tick="' + i + '"' + (ticks[i] ? ' checked' : '') + '> ' + esc(c) + '</label>';
      }).join('') + '</div>';
    }
    h += '</section><section class="pr-editor"><div class="pr-edbar"><span>Your answers from ' + toolLabel(t.tool) + '</span></div>'
      + '<div class="pr-answers">' + t.fields.map(function (f, i) {
        return '<label class="pr-ans"><span>' + esc(f.label) + '</span><span class="pr-ans-in"><input type="text" inputmode="decimal" autocomplete="off" data-ans="' + i + '" value="' + esc(saved[i] || '') + '">'
          + '<b class="pr-mark" data-mark="' + i + '"></b></span></label>';
      }).join('') + '</div>'
      + '<p class="pr-note">Numbers: 2 decimals unless the value is a whole count. You can type 1,23,456.70 or 123456.7, with or without the rupee sign.</p>'
      + '<div class="pr-runbar"><button type="button" class="k-btn k-btn-brand" id="prCheck">Check answers</button></div>'
      + '<div class="pr-verdict" id="prVerdict" hidden></div></section></div>';
    return h;
  }
  function wireAnswers(pack, t, next) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('[data-ans]'));
    var verdict = document.getElementById('prVerdict');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () { lsSet('kojoh-prac-ans-' + t.id, inputs.map(function (x) { return x.value; })); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tick]'), function (c) {
      c.onchange = function () { var o = lsGet('kojoh-prac-chk-' + t.id, {}); o[c.getAttribute('data-tick')] = c.checked; lsSet('kojoh-prac-chk-' + t.id, o); };
    });
    document.getElementById('prHint').onclick = function () { document.getElementById('prHintBox').hidden = false; };
    var sol = document.getElementById('prSol');
    if (sol) sol.onclick = function () {
      if (!S.attempted[t.id] && !S.progress.solved[t.id] && !confirm('Have a go first? Building it yourself is what makes it stick.')) return;
      document.getElementById('prSolBox').hidden = false;
    };
    document.getElementById('prCheck').onclick = check;
    async function check() {
      S.attempted[t.id] = true;
      var vals = inputs.map(function (x) { return x.value; });
      var res = await KP.checkAnswers(t, vals);
      var right = 0;
      res.forEach(function (r, i) {
        var m = document.querySelector('[data-mark="' + i + '"]');
        m.textContent = vals[i].trim() ? (r.ok ? '\u2713' : '\u2717') : '';
        m.className = 'pr-mark ' + (r.ok ? 'ok' : 'no');
        if (r.ok) right++;
      });
      verdict.hidden = false;
      if (right === res.length) {
        var fresh = markSolved(t);
        verdict.className = 'pr-verdict ok';
        verdict.innerHTML = '<strong>All correct.</strong> ' + (fresh ? '+' + t.points + ' points. ' : '')
          + (next ? '<a href="?role=' + S.role + '&task=' + next.id + '" data-task="' + next.id + '">Next task</a>' : 'That was the last one in this track.');
      } else {
        verdict.className = 'pr-verdict no';
        verdict.innerHTML = '<strong>' + right + ' of ' + res.length + ' correct.</strong> Check the filters (for example Delivered only) and rounding.';
      }
    }
  }

  // ------------------------------------------------------------------ editor + running
  var enginePrimed = {};
  async function prime(pack, t) {
    var k = t.tool + ':' + pack.id;
    var st = document.getElementById('prStatus');
    if (!enginePrimed[k]) {
      if (st) st.textContent = t.tool === 'sql' ? 'Starting SQL engine (first time takes a few seconds)' : 'Starting Python (first time downloads about 15 MB, then it is cached)';
      enginePrimed[k] = KP.load(t.tool, tableFiles(pack)).catch(function (e) { delete enginePrimed[k]; throw e; });
    }
    await enginePrimed[k];
    if (st && /^Starting/.test(st.textContent)) st.textContent = 'Ready';
  }
  function renderResult(res) {
    var box = document.getElementById('prResult');
    if (!res) { box.innerHTML = ''; return; }
    var cols = res.columns || [], rows = res.rows || [], max = 100;
    var h = '<div class="pr-resmeta">' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' &middot; ' + cols.length + ' column' + (cols.length === 1 ? '' : 's')
      + (res.ms !== undefined ? ' &middot; ' + res.ms + ' ms' : '') + (rows.length > max ? ' &middot; showing first ' + max : '') + '</div>';
    h += '<div class="pr-tablewrap"><table class="pr-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.slice(0, max).map(function (r) {
        return '<tr>' + r.map(function (v) { return '<td' + (v === null ? ' class="pr-null"' : '') + '>' + (v === null ? 'null' : esc(typeof v === 'number' ? (Math.round(v * 10000) / 10000) : v)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    box.innerHTML = h;
  }
  function wireEditor(pack, t, next) {
    var ta = document.getElementById('prCode'), st = document.getElementById('prStatus');
    var out = document.getElementById('prOut'), verdict = document.getElementById('prVerdict');
    prime(pack, t).catch(function (e) { st.textContent = e.message; });
    ta.addEventListener('input', function () { lsSet('kojoh-prac-code-' + t.id, ta.value); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
        lsSet('kojoh-prac-code-' + t.id, ta.value);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); exec(e.shiftKey);
      }
    });
    document.getElementById('prReset').onclick = function () { ta.value = t.starter; lsSet('kojoh-prac-code-' + t.id, null); };
    document.getElementById('prHint').onclick = function () { document.getElementById('prHintBox').hidden = false; };
    var sol = document.getElementById('prSol');
    if (sol) sol.onclick = function () {
      if (!S.attempted[t.id] && !S.progress.solved[t.id] && !confirm('Have a go first? Peeking at the solution before trying is the fastest way to forget it.')) return;
      document.getElementById('prSolBox').hidden = false;
    };
    document.getElementById('prRun').onclick = function () { exec(false); };
    document.getElementById('prCheck').onclick = function () { exec(true); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-peek]'), function (b) {
      b.onclick = async function () {
        var n = b.getAttribute('data-peek');
        busy(true); st.textContent = 'Loading ' + n;
        try {
          await prime(pack, t);
          var res = await KP.run(t.tool, t.tool === 'sql' ? 'SELECT * FROM ' + n + ' LIMIT 8' : 'result = ' + n + '.head(8)');
          renderResult(res); st.textContent = 'Preview of ' + n; out.hidden = true; verdict.hidden = true;
        } catch (e) { st.textContent = e.message; }
        busy(false);
      };
    });
    function busy(on) { ['prRun', 'prCheck'].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = on; }); }
    async function exec(check) {
      busy(true); verdict.hidden = true; out.hidden = true;
      st.textContent = 'Running';
      try {
        await prime(pack, t);
        var res = await KP.run(t.tool, ta.value);
        S.attempted[t.id] = true;
        renderResult(res);
        if (res.out) { out.textContent = res.out; out.hidden = false; }
        st.textContent = '';
        if (check) {
          var c = await KP.check(t, res);
          verdict.hidden = false;
          if (c.ok) {
            var fresh = markSolved(t);
            verdict.className = 'pr-verdict ok';
            verdict.innerHTML = '<strong>Correct.</strong> ' + (fresh ? '+' + t.points + ' points. ' : '')
              + (next ? '<a href="?role=' + S.role + '&task=' + next.id + '" data-task="' + next.id + '">Next task</a>' : 'That was the last one in this track.');
          } else {
            verdict.className = 'pr-verdict no';
            verdict.innerHTML = '<strong>Not yet.</strong> ' + esc(c.why);
          }
        }
      } catch (e) {
        S.attempted[t.id] = true;
        renderResult(null);
        st.textContent = '';
        verdict.hidden = false; verdict.className = 'pr-verdict no';
        verdict.innerHTML = '<strong>Error</strong><pre>' + esc(e.message) + '</pre>';
        if (e.out) { out.textContent = e.out; out.hidden = false; }
      }
      busy(false);
    }
  }

  // ------------------------------------------------------------------ pass checkout
  var chosen = null;
  function openPass(key) {
    if (!S.session) {
      try { sessionStorage.setItem('kojoh_after_auth', location.pathname + location.search); } catch (e) {}
      location.href = '/auth'; return;
    }
    chosen = PASSES.filter(function (p) { return p.key === key; })[0];
    if (!chosen) return;
    document.getElementById('passItem').textContent = 'Practice pass, ' + chosen.label;
    document.getElementById('passPrice').textContent = fmtRs(chosen.price);
    document.getElementById('passTotal').textContent = fmtRs(chosen.price);
    var go = document.getElementById('passGo');
    go.disabled = !S.live;
    go.textContent = S.live ? 'Pay ' + fmtRs(chosen.price) : 'Opens when payments go live';
    document.getElementById('passModal').hidden = false;
    document.body.classList.add('k-noscroll');
  }
  function closePass() { document.getElementById('passModal').hidden = true; document.body.classList.remove('k-noscroll'); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load the payment window. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  async function fnErr(r) {
    var m = r.data && r.data.error;
    if (!m && r.error && r.error.context && r.error.context.json) { try { m = (await r.error.context.json()).error; } catch (e) {} }
    return m || (r.error && r.error.message) || 'Something went wrong.';
  }
  async function payPass() {
    var go = document.getElementById('passGo'), note = document.getElementById('passNote');
    go.disabled = true; go.textContent = 'Opening payment';
    try {
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      var o = await SUPA.functions.invoke('create-order', { body: { pass: chosen.key } });
      if (o.error || (o.data && o.data.error)) throw new Error(await fnErr(o));
      var od = o.data;
      var vd = await new Promise(function (resolve, reject) {
        var rz = new window.Razorpay({
          key: od.key_id, order_id: od.order_id, amount: od.amount, currency: od.currency || 'INR',
          name: 'KOJOH', description: od.title, prefill: { email: od.email || '' }, theme: { color: '#141317' },
          handler: async function (resp) {
            var v = await SUPA.functions.invoke('verify-payment', { body: resp });
            if (v.error || (v.data && v.data.error)) reject(new Error(await fnErr(v)));
            else resolve(v.data);
          },
          modal: { ondismiss: function () { reject(new Error('Payment cancelled. Nothing was charged.')); } }
        });
        rz.on('payment.failed', function (r) { reject(new Error((r && r.error && r.error.description) || 'Payment failed. Nothing was charged.')); });
        rz.open();
      });
      S.pass = { expires_at: vd.pass_expires_at };
      try { localStorage.setItem('kojoh-member', '1'); document.documentElement.classList.add('k-member'); } catch (e) {}
      closePass();
      toast('Practice pass active until ' + fmtDate(vd.pass_expires_at) + '.' + (vd.reward && vd.reward.code ? ' Bonus code for your next project: ' + vd.reward.code : ''));
      route();
    } catch (e) {
      go.disabled = false; go.textContent = 'Try again';
      note.innerHTML = '<span class="k-err">' + esc(e.message) + '</span>';
    }
  }

  // ------------------------------------------------------------------ clicks
  app.addEventListener('click', function (e) {
    var x = e.target.closest('[data-xlsx]');
    if (x) { e.preventDefault(); var pk = S.packs[S.role + (hasPass() ? ':pro' : ':free')]; if (pk) downloadWorkbook(pk, x); return; }
    var cv = e.target.closest('[data-csv]');
    if (cv) {
      e.preventDefault();
      var pk2 = S.packs[S.role + (hasPass() ? ':pro' : ':free')];
      var tb = pk2 && pk2.tables.filter(function (t) { return t.name === cv.getAttribute('data-csv'); })[0];
      if (tb) KP.fetchText(BASE + 'data/' + tb.file + '?v=' + (tb.v || pk2.v)).then(function (txt) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
        a.download = tb.name + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      }).catch(function (er) { toast(er.message, 'error'); });
      return;
    }
    var a = e.target.closest('[data-role],[data-tool],[data-task],[data-nav],[data-pass]');
    if (!a) return;
    if (a.hasAttribute('data-pass')) { e.preventDefault(); openPass(a.getAttribute('data-pass')); return; }
    e.preventDefault();
    if (a.hasAttribute('data-role')) go(a.getAttribute('data-role'), 'sql', null);
    else if (a.hasAttribute('data-tool')) go(S.role, a.getAttribute('data-tool'), null);
    else if (a.hasAttribute('data-task')) go(S.role, S.tool, a.getAttribute('data-task'));
    else if (a.getAttribute('data-nav') === 'home') { go(null, null, null); }
    else if (a.getAttribute('data-nav') === 'role') go(S.role, S.tool, null);
    window.scrollTo(0, 0);
  });
  document.getElementById('passClose').onclick = closePass;
  document.getElementById('passModal').addEventListener('click', function (e) { if (e.target.id === 'passModal') closePass(); });
  document.getElementById('passGo').onclick = payPass;

  // ------------------------------------------------------------------ start
  (async function init() {
    try {
      var jobs = [loadManifest()];
      if (SUPA) jobs.push(SUPA.auth.getSession());
      var r = await Promise.all(jobs);
      S.manifest = r[0];
      S.session = (r[1] && r[1].data && r[1].data.session) || null;
      if (SUPA) {
        var q = await Promise.all([
          S.session ? SUPA.from('practice_passes').select('expires_at').eq('user_id', S.session.user.id).maybeSingle() : Promise.resolve({ data: null }),
          SUPA.from('app_settings').select('value').eq('key', 'payments').maybeSingle()
        ]);
        S.pass = (q[0] && !q[0].error && q[0].data) || null;
        S.live = !!(q[1] && q[1].data && q[1].data.value && q[1].data.value.mode === 'live');
      }
      await loadProgress();
      var u = readUrl();
      if (!u.role) { var last = lsGet('kojoh-prac-role', null); if (last && roleMeta(last) && !location.hash) { go(last, 'sql', null, true); return; } }
      route();
    } catch (e) {
      app.innerHTML = '<div class="empty-state"><h3>Practice is getting ready</h3><p>' + esc(e.message) + ' Check back soon.</p></div>';
    }
  })();
})();
