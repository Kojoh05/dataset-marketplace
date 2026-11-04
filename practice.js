/* KOJOH Practice.
 * Each role has 3 levels (Beginner, Intermediate, Hard). A level is one case project; its questions open one at a time.
 * Content comes from Storage (CDN) and code runs in the browser. Database calls: a handful of small reads on load,
 * then one write per solved question, written answer, certificate request or payment. */
(function () {
  'use strict';
  var LIVE = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
  var SUPA = LIVE ? window.kojohSupa() : null;
  var BASE = window.KOJOH_PRACTICE_BASE || (window.SUPABASE_URL + '/storage/v1/object/public/practice/');
  var KP = window.KojohPractice;
  var esc = window.kojohEsc || function (s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
  var app = document.getElementById('prApp');

  var PASSES = [
    { key: '30', days: 30, price: 199, label: '30 days', per: 'one month of practice' },
    { key: '90', days: 90, price: 499, label: '90 days', per: 'about ₹166 a month' },
    { key: '365', days: 365, price: 1499, label: '1 year', per: 'about ₹125 a month' }
  ];
  var SKIP_PRICE = 99;
  var LEVELS = ['beginner', 'intermediate', 'hard'];
  var TOOL_LABEL = { sql: 'SQL', python: 'Python', excel: 'Excel', powerbi: 'Power BI', written: 'Written answer' };
  function isAnswerTool(k) { return k === 'excel' || k === 'powerbi'; }

  var S = {
    manifest: null, session: null, pass: null, live: false, me: null,
    packs: {}, progress: { solved: {}, points: 0 }, state: { tries: {}, hint: {}, sol: {} },
    unlocks: {}, certs: {}, written: {}, role: null, level: null, task: null
  };

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtRs(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function hasPass() { return !!(S.pass && new Date(S.pass.expires_at) > new Date()); }
  function toast(m, kind) { if (window.kojohToast) window.kojohToast(m, { kind: kind }); }
  function q(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------ content
  async function loadManifest() {
    var r = await fetch(BASE + 'manifest.json?t=' + Math.floor(Date.now() / 60000));
    if (!r.ok) throw new Error('Practice content is not published yet.');
    return r.json();
  }
  function roleMeta(id) { return (S.manifest.roles || []).filter(function (r) { return r.id === id; })[0]; }
  async function loadPack(roleId) {
    var meta = roleMeta(roleId);
    if (!meta) throw new Error('Unknown role.');
    var pro = hasPass(), key = roleId + (pro ? ':pro' : ':free');
    if (S.packs[key] && S.packs[key].v === meta.v) return S.packs[key];
    var cached = lsGet('kojoh-prac2-' + key, null);
    if (cached && cached.v === meta.v) { S.packs[key] = cached; return cached; }
    var pack = null;
    if (pro) {
      var d = await SUPA.storage.from('practice-pro').download('pro/' + roleId + '.json');
      if (!d.error && d.data) pack = JSON.parse(await d.data.text());
    }
    if (!pack) {
      var r = await fetch(BASE + 'free/' + roleId + '.json?v=' + meta.v);
      if (!r.ok) throw new Error('Could not load ' + meta.title + '.');
      pack = await r.json();
      pack.isFree = true;
    }
    S.packs[key] = pack;
    lsSet('kojoh-prac2-' + key, pack);
    return pack;
  }
  function levelOf(pack, key) { return (pack.levels || []).filter(function (l) { return l.key === key; })[0]; }
  var signed = {};
  async function tableFiles(lv) {
    var priv = lv.tables.filter(function (t) { return t.private && t.file; });
    if (priv.length) {
      var need = priv.filter(function (t) { return !signed[t.file] || signed[t.file].exp < Date.now(); });
      if (need.length) {
        var r = await SUPA.storage.from('practice-pro').createSignedUrls(need.map(function (t) { return 'data/' + t.file; }), 3600);
        if (r.error) throw new Error('Could not open the data for this level. Is your pass active?');
        r.data.forEach(function (x, i) { signed[need[i].file] = { url: x.signedUrl, exp: Date.now() + 3300000 }; });
      }
    }
    return lv.tables.filter(function (t) { return t.file; }).map(function (t) {
      return { name: t.name, key: t.file, url: t.private ? signed[t.file].url : BASE + 'data/' + t.file + '?v=' + (t.v || '') };
    });
  }

  // ------------------------------------------------------------------ progress + scoring
  var saveTimer = null;
  async function loadUserData() {
    S.progress = lsGet('kojoh-prac-progress', { solved: {}, points: 0 });
    S.state = lsGet('kojoh-prac-state', { tries: {}, hint: {}, sol: {} });
    if (!S.session) return;
    var uid = S.session.user.id;
    var r = await Promise.all([
      SUPA.from('practice_progress').select('solved, state').maybeSingle(),
      SUPA.from('practice_level_unlocks').select('role, level'),
      SUPA.from('practice_certificates').select('code, role, level, status, skipped, score'),
      SUPA.from('practice_written').select('task_id, status, marks, max_marks, feedback, answer'),
      window.kojohLoadMe ? Promise.resolve(null) : Promise.resolve(null)
    ]);
    if (!r[0].error) {
      var remote = (r[0].data && r[0].data.solved) || {}, rs = (r[0].data && r[0].data.state) || {};
      var merged = Object.assign({}, remote, S.progress.solved);
      S.progress = { solved: merged, points: sumPoints(merged) };
      ['tries', 'hint', 'sol'].forEach(function (k) { S.state[k] = Object.assign({}, rs[k] || {}, S.state[k] || {}); });
      lsSet('kojoh-prac-progress', S.progress); lsSet('kojoh-prac-state', S.state);
      if (Object.keys(merged).length !== Object.keys(remote).length) queueSave();
    }
    S.unlocks = {}; ((r[1] && r[1].data) || []).forEach(function (u) { S.unlocks[u.role + ':' + u.level] = 1; });
    S.certs = {}; ((r[2] && r[2].data) || []).forEach(function (c) { S.certs[c.role + ':' + c.level] = c; });
    S.written = {}; ((r[3] && r[3].data) || []).forEach(function (w) { S.written[w.task_id] = w; });
    var p = await SUPA.from('profiles').select('first_name, last_name, username').eq('id', uid).maybeSingle();
    S.me = p.data ? ([p.data.first_name, p.data.last_name].filter(Boolean).join(' ') || p.data.username) : '';
  }
  function sumPoints(solved) { var p = 0; for (var k in solved) p += Number(solved[k].p) || 0; return p; }
  function queueSave() {
    lsSet('kojoh-prac-progress', S.progress); lsSet('kojoh-prac-state', S.state);
    if (!S.session) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      SUPA.from('practice_progress').upsert({ user_id: S.session.user.id, solved: S.progress.solved, state: S.state,
        points: S.progress.points, updated_at: new Date().toISOString() })
        .then(function (r) { if (r.error) console.warn('progress save', r.error.message); });
    }, 1500);
  }
  function earnedFor(t) {
    var tries = S.state.tries[t.id] || 0;
    if (S.state.sol[t.id]) return Math.round(t.points * 0.25);
    var f = Math.max(0.4, 1 - 0.2 * tries) * (S.state.hint[t.id] ? 0.9 : 1);
    return Math.round(t.points * f);
  }
  function markSolved(t) {
    if (S.progress.solved[t.id]) return 0;
    var e = earnedFor(t);
    S.progress.solved[t.id] = { p: e, m: t.points, t: Date.now() };
    S.progress.points = sumPoints(S.progress.solved);
    queueSave();
    return e;
  }
  function flag(kind, t) { if (!S.state[kind][t.id]) { S.state[kind][t.id] = 1; queueSave(); } }
  function wrongTry(t) { if (S.progress.solved[t.id]) return; S.state.tries[t.id] = (S.state.tries[t.id] || 0) + 1; queueSave(); }
  function isDone(t) { return !!(S.progress.solved[t.id] || (t.tool === 'written' && S.written[t.id])); }

  function levelStats(lv) {
    var st = { done: 0, total: lv.tasks.length, auto: 0, autoMax: 0, wr: 0, wrMax: 0, pending: 0 };
    lv.tasks.forEach(function (t) {
      if (isDone(t)) st.done++;
      if (t.tool === 'written') {
        st.wrMax += t.points; var w = S.written[t.id];
        if (w && w.status === 'reviewed') st.wr += w.marks || 0; else if (w) st.pending++;
      } else {
        st.autoMax += t.points; if (S.progress.solved[t.id]) st.auto += S.progress.solved[t.id].p;
      }
    });
    st.complete = !lv.more && st.total > 0 && st.done === st.total;
    st.score = (st.autoMax + st.wrMax) ? Math.round(100 * (st.auto + st.wr) / (st.autoMax + st.wrMax)) : 0;
    return st;
  }
  function levelOpen(pack, key) {
    if (key === 'beginner') return true;
    if (!hasPass()) return false;
    if (S.unlocks[S.role + ':' + key]) return true;
    var prev = levelOf(pack, LEVELS[LEVELS.indexOf(key) - 1]);
    return !!(prev && prev.tasks.length && levelStats(prev).complete) || !!(S.certs[S.role + ':' + LEVELS[LEVELS.indexOf(key) - 1]]);
  }

  // ------------------------------------------------------------------ routing
  function readUrl() { var u = new URLSearchParams(location.search); return { role: u.get('role'), level: u.get('level'), task: u.get('task') }; }
  function go(role, level, task, replace) {
    var u = new URLSearchParams();
    if (role) u.set('role', role);
    if (level) u.set('level', level);
    if (task) u.set('task', task);
    history[replace ? 'replaceState' : 'pushState']({}, '', location.pathname + (u.toString() ? '?' + u : ''));
    window.scrollTo(0, 0);
    route();
  }
  window.addEventListener('popstate', route);
  async function route() {
    var u = readUrl();
    if (!u.role || !roleMeta(u.role)) { S.role = null; renderHome(); return; }
    S.role = u.role; lsSet('kojoh-prac-role', u.role);
    var pack;
    try { pack = await loadPack(u.role); }
    catch (e) { app.innerHTML = '<div class="empty-state"><h3>Could not load</h3><p>' + esc(e.message) + '</p></div>'; return; }
    var lv = u.level && levelOf(pack, u.level);
    if (!lv) { renderRole(pack); return; }
    S.level = lv.key;
    if (!levelOpen(pack, lv.key)) { renderRole(pack); toast('That level is locked.'); return; }
    if (u.task) {
      var i = lv.tasks.map(function (t) { return t.id; }).indexOf(u.task);
      if (i >= 0 && (i === 0 || isDone(lv.tasks[i - 1]) || isDone(lv.tasks[i]))) { renderTask(pack, lv, lv.tasks[i], i); return; }
      toast('Solve the earlier questions first.');
    }
    renderLevel(pack, lv);
  }

  // ------------------------------------------------------------------ views
  function passCard() {
    if (hasPass()) return '';
    return '<section class="pr-pass" id="pass"><div><div class="pr-eyebrow">Practice pass</div>'
      + '<h3>Unlock every level in every role</h3>'
      + '<ul class="pr-perks"><li>Beginner, Intermediate and Hard levels for 4 roles, each a full case project</li>'
      + '<li>SQL, Python, written case answers, plus Excel and Power BI for Data Analyst</li>'
      + '<li>A certificate for every level you complete, with your score</li>'
      + '<li>20% off every portfolio project while your pass is active</li><li>One-time payment, no auto-renewal</li></ul></div>'
      + '<div class="pr-pass-plans">' + PASSES.map(function (p, i) {
        return '<button class="pr-plan' + (i === 1 ? ' pr-plan-pop' : '') + '" type="button" data-pass="' + p.key + '">'
          + (i === 1 ? '<span class="pr-plan-tag">Most popular</span>' : '')
          + '<span class="pr-plan-len">' + p.label + '</span><span class="pr-plan-price">' + fmtRs(p.price) + '</span>'
          + '<span class="pr-plan-per">' + p.per + '</span></button>';
      }).join('') + '</div></section>';
  }
  function passBanner() {
    if (!hasPass()) return '';
    return '<div class="pr-passon">Practice pass active until ' + esc(fmtDate(S.pass.expires_at)) + '. '
      + '<button type="button" class="pr-link" data-pass="30">Extend</button></div>';
  }

  function renderHome() {
    document.title = 'KOJOH | Practice SQL, Python, Excel and Power BI for data roles';
    var h = '<div class="page-lead"><h1>Practice like it is the job</h1>'
      + '<p>Pick your role. Each one has three levels, Beginner, Intermediate and Hard, and every level is a real case project. Questions open one by one as you solve them, and finishing a level earns you a certificate.</p></div>';
    h += passBanner();
    h += '<div class="pr-roles">' + S.manifest.roles.map(function (r) {
      var solved = 0; for (var id in S.progress.solved) if (id.indexOf(r.short + '-') === 0) solved++;
      var certs = LEVELS.filter(function (k) { return S.certs[r.id + ':' + k] && S.certs[r.id + ':' + k].status === 'issued'; }).length;
      return '<button class="pr-role" type="button" data-role="' + esc(r.id) + '">'
        + '<span class="pr-role-title">' + esc(r.title) + '</span>'
        + '<span class="pr-role-co">' + (r.levels || []).map(function (l) { return esc(l.name); }).join(' &middot; ') + '</span>'
        + '<span class="pr-role-meta">' + esc((r.tools || []).join(', ')) + '</span>'
        + '<span class="pr-role-meta">' + solved + ' solved' + (certs ? ' &middot; ' + certs + ' certificate' + (certs > 1 ? 's' : '') : '') + '</span></button>';
    }).join('') + '</div>';
    h += passCard();
    h += '<p class="pr-foot">Your code runs on your device. ' + (S.session ? 'Progress is saved to your account.' : '<a href="/auth">Sign in</a> to save progress and earn certificates.') + '</p>';
    app.innerHTML = h;
  }

  function renderRole(pack) {
    document.title = 'KOJOH | ' + pack.title + ' practice';
    var h = '<a class="pr-back" href="/practice" data-nav="home">All roles</a>'
      + '<div class="page-lead"><h1>' + esc(pack.title) + '</h1><p>Three levels. Finish one to open the next, or skip ahead for ' + fmtRs(SKIP_PRICE) + ' with a pass.</p></div>' + passBanner();
    h += '<div class="pr-levels">' + LEVELS.map(function (key, i) {
      var lv = levelOf(pack, key), live = lv && lv.live !== false && (lv.tasks.length || lv.more);
      var open = live && levelOpen(pack, key), cert = S.certs[pack.id + ':' + key];
      var st = lv ? levelStats(lv) : null;
      var status, action = '';
      if (!live) status = 'Coming soon';
      else if (cert && cert.status === 'issued') { status = cert.skipped ? 'Unlocked by skip' : 'Complete, score ' + cert.score + '%'; action = '<a class="k-btn" href="/certificate?id=' + esc(cert.code) + '">View certificate</a>'; }
      else if (open) { status = st.done ? st.done + ' solved' : 'Ready to start'; }
      else if (key !== 'beginner' && !hasPass()) status = 'Needs the Practice pass';
      else status = 'Finish ' + esc(levelOf(pack, LEVELS[i - 1]).name) + ' to open';
      if (live && open && !(cert && cert.status === 'issued')) action = '<button class="k-btn k-btn-brand" type="button" data-level="' + key + '">' + (st.done ? 'Continue' : 'Start') + '</button>';
      if (live && open && cert && cert.status === 'issued') action += ' <button class="k-btn" type="button" data-level="' + key + '">Open</button>';
      if (live && !open && hasPass() && key !== 'beginner') action = '<button class="k-btn" type="button" data-skip="' + key + '">Skip to ' + esc(lv.name) + ', ' + fmtRs(SKIP_PRICE) + '</button>';
      if (live && !open && !hasPass() && key !== 'beginner') action = '<a class="k-btn" href="#pass">See the pass</a>';
      return '<section class="pr-level-card' + (open ? ' open' : '') + '"><div class="pr-eyebrow">Level ' + (i + 1) + '</div>'
        + '<h3>' + esc(lv ? lv.name : key) + '</h3>'
        + (lv && lv.company ? '<p class="pr-level-co">Case: ' + esc(lv.company) + '</p>' : '')
        + '<p class="pr-level-st">' + status + '</p><div class="pr-level-act">' + action + '</div></section>';
    }).join('') + '</div>';
    h += passCard();
    app.innerHTML = h;
  }

  function renderLevel(pack, lv) {
    document.title = 'KOJOH | ' + pack.title + ' ' + lv.name;
    var st = levelStats(lv), cert = S.certs[pack.id + ':' + lv.key];
    var h = '<a class="pr-back" href="?role=' + pack.id + '" data-nav="role">' + esc(pack.title) + '</a>'
      + '<div class="page-lead"><div class="pr-eyebrow">' + esc(lv.name) + ' level</div><h1>' + esc(lv.company) + '</h1><p>' + esc(lv.story) + '</p></div>';
    h += '<details class="pr-tables"><summary>Tables in this case (' + lv.tables.length + ')</summary>' + lv.tables.map(function (t) {
      return '<div class="pr-tbl"><div class="pr-tbl-head"><code>' + esc(t.name) + '</code><span>' + Number(t.rows || 0).toLocaleString('en-IN') + ' rows</span></div>'
        + '<p>' + esc(t.about) + '</p><div class="pr-cols">' + (t.columns || []).map(function (c) {
          return '<span class="pr-col">' + esc(c[0]) + ' <em>' + esc(String(c[1]).toLowerCase()) + '</em></span>'; }).join('') + '</div></div>';
    }).join('') + '</details>';
    var path = '', nextIdx = -1;
    lv.tasks.forEach(function (t, i) {
      if (nextIdx >= 0) return;
      var done = isDone(t);
      if (!done) nextIdx = i;
      var w = S.written[t.id], s = S.progress.solved[t.id];
      var meta = t.tool === 'written' ? (w ? (w.status === 'reviewed' ? w.marks + ' / ' + w.max_marks : 'Under review') : 'Written')
        : (s ? s.p + ' / ' + t.points + ' pts' : t.points + ' pts');
      path += '<a class="pr-task' + (done ? ' done' : ' next') + '" href="?role=' + pack.id + '&level=' + lv.key + '&task=' + t.id + '" data-task="' + t.id + '">'
        + '<span class="pr-task-dot" aria-hidden="true">' + (done ? '&#10003;' : i + 1) + '</span>'
        + '<span class="pr-task-title">' + esc(t.title) + '<small>' + TOOL_LABEL[t.tool] + '</small></span>'
        + '<span class="pr-task-pts">' + (done ? meta : 'Next question') + '</span></a>';
    });
    var remaining = nextIdx >= 0 && nextIdx < lv.tasks.length - 1;
    if (remaining || lv.more) path += '<div class="pr-task locked"><span class="pr-task-dot" aria-hidden="true">&#128274;</span><span class="pr-task-title">More questions open as you solve</span></div>';
    if (lv.more && pack.isFree && nextIdx < 0) path += '<div class="pr-lockbox"><p>You have finished the free questions. Get a Practice pass to carry on with this case and unlock every level.</p></div>';
    h += '<h2 class="pr-level">Your path</h2><div class="pr-list">' + path + '</div>';
    if (st.complete) h += completionCard(pack, lv, st, cert);
    if (pack.isFree) h += passCard();
    app.innerHTML = h;
  }
  function completionCard(pack, lv, st, cert) {
    var h = '<section class="pr-done"><div class="pr-eyebrow">Level complete</div><h3>You finished ' + esc(lv.name) + '</h3>'
      + '<p>Score so far: <strong>' + st.score + '%</strong>' + (st.pending ? ' (' + st.pending + ' written answer' + (st.pending > 1 ? 's' : '') + ' still being reviewed)' : '') + '</p>';
    if (cert && cert.status === 'issued') h += '<a class="k-btn k-btn-brand" href="/certificate?id=' + esc(cert.code) + '">View your certificate</a>';
    else if (cert && cert.status === 'requested') h += '<p class="pr-note">Certificate requested. It is issued as soon as your written answers are reviewed.</p>';
    else if (!S.session) h += '<a class="k-btn k-btn-brand" href="/auth">Sign in to claim your certificate</a>';
    else h += '<div class="pr-claim"><label>Name on the certificate<input id="prCertName" value="' + esc(S.me || '') + '" maxlength="80"></label>'
      + '<button class="k-btn k-btn-brand" type="button" id="prClaim" data-claim="' + lv.key + '">Request certificate</button></div>';
    return h + '</section>';
  }

  function renderTask(pack, lv, t, i) {
    S.task = t;
    document.title = 'KOJOH | ' + t.title;
    var next = lv.tasks[i + 1];
    var h = '<a class="pr-back" href="?role=' + pack.id + '&level=' + lv.key + '" data-nav="level">' + esc(lv.company) + ' (' + esc(lv.name) + ')</a>';
    h += '<div class="pr-taskhead"><div><div class="pr-eyebrow">Question ' + (i + 1) + ' &middot; ' + TOOL_LABEL[t.tool] + ' &middot; ' + t.points + ' pts' + (isDone(t) ? ' &middot; Done' : '') + '</div>'
      + '<h1 class="pr-title">' + esc(t.title) + '</h1></div></div>';
    if (t.tool === 'written') { app.innerHTML = h + writtenHtml(t); wireWritten(pack, lv, t, next); return; }
    if (isAnswerTool(t.tool)) { app.innerHTML = h + answerTaskHtml(lv, t); wireAnswers(pack, lv, t, next); return; }
    var draft = lsGet('kojoh-prac-code-' + t.id, null);
    h += '<div class="pr-work"><section class="pr-brief"><p class="pr-q">' + esc(t.question) + '</p>'
      + '<div class="pr-chips">' + (t.tables || []).map(function (n) { return '<button type="button" class="k-chip pr-peek" data-peek="' + esc(n) + '">' + esc(n) + '</button>'; }).join('')
      + '<span class="pr-hintline">Tap a table to preview it</span></div>'
      + '<div class="pr-acts"><button type="button" class="k-btn" id="prHint">Show hint</button>'
      + (t.solution ? '<button type="button" class="k-btn" id="prSol">Show solution</button>' : '') + '</div>'
      + '<p class="pr-note">A hint costs 10% of the points, the solution 75%. Each wrong check costs 20% (you always keep at least 40%).</p>'
      + '<div class="pr-hint" id="prHintBox" hidden>' + esc(t.hint || 'No hint for this one.') + '</div>'
      + (t.solution ? '<div class="pr-sol" id="prSolBox" hidden><pre><code>' + esc(t.solution) + '</code></pre>' + (t.explain ? '<p>' + esc(t.explain) + '</p>' : '') + '</div>' : '')
      + '</section><section class="pr-editor"><div class="pr-edbar"><span>' + (t.tool === 'sql' ? 'SQL (DuckDB)' : 'Python 3 + pandas') + '</span>'
      + '<button type="button" class="pr-link" id="prReset">Reset code</button></div>'
      + '<div class="pr-cm" id="prCmHost"><textarea id="prCode" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Your code">' + esc(draft || t.starter) + '</textarea></div>'
      + '<div class="pr-runbar"><button type="button" class="k-btn" id="prRun">Run</button><button type="button" class="k-btn k-btn-brand" id="prCheck">Check answer</button>'
      + '<span class="pr-kbd">Ctrl + Enter runs</span></div><div class="pr-status" id="prStatus" aria-live="polite"></div>'
      + '<div class="pr-verdict" id="prVerdict" hidden></div><pre class="pr-out" id="prOut" hidden></pre><div class="pr-result" id="prResult"></div></section></div>';
    app.innerHTML = h;
    wireEditor(pack, lv, t, next);
  }
  function nextLink(pack, lv, next) {
    return next ? '<a href="?role=' + pack.id + '&level=' + lv.key + '&task=' + next.id + '" data-task="' + next.id + '">Next question</a>'
      : '<a href="?role=' + pack.id + '&level=' + lv.key + '" data-nav="level">Back to the level</a>';
  }

  // ------------------------------------------------------------------ code editor with colours (CodeMirror 5)
  var cmP = null;
  function loadCM() {
    if (cmP) return cmP;
    var base = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/';
    function js(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'codemirror.min.css'; document.head.appendChild(l);
    cmP = js(base + 'codemirror.min.js').then(function () {
      return Promise.all([js(base + 'mode/sql/sql.min.js'), js(base + 'mode/python/python.min.js'), js(base + 'addon/edit/matchbrackets.min.js'), js(base + 'addon/edit/closebrackets.min.js')]);
    }).catch(function () { cmP = null; throw new Error('editor'); });
    return cmP;
  }
  function makeEditor(t, onRun) {
    var ta = q('prCode');
    var ed = { get: function () { return ta.value; }, set: function (v) { ta.value = v; } };
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun(e.shiftKey); }
    });
    ta.addEventListener('input', function () { lsSet('kojoh-prac-code-' + t.id, ta.value); });
    loadCM().then(function () {
      if (!document.body.contains(ta)) return;
      var cm = window.CodeMirror.fromTextArea(ta, {
        mode: t.tool === 'sql' ? 'text/x-sql' : 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
        matchBrackets: true, autoCloseBrackets: true, lineWrapping: false, viewportMargin: Infinity,
        extraKeys: { 'Ctrl-Enter': function () { onRun(false); }, 'Cmd-Enter': function () { onRun(false); },
          'Shift-Ctrl-Enter': function () { onRun(true); }, Tab: function (c) { c.replaceSelection('    '); } }
      });
      cm.on('change', function () { lsSet('kojoh-prac-code-' + t.id, cm.getValue()); });
      ed.get = function () { return cm.getValue(); };
      ed.set = function (v) { cm.setValue(v); };
    }).catch(function () {});
    return ed;
  }

  var primed = {};
  async function prime(lv, tool) {
    var k = tool + ':' + S.role + ':' + lv.key, st = q('prStatus');
    if (!primed[k]) {
      if (st) st.textContent = tool === 'sql' ? 'Starting SQL engine (first time takes a few seconds)' : 'Starting Python (first time downloads about 15 MB, then it is cached)';
      primed[k] = tableFiles(lv).then(function (f) { return KP.load(tool, f); }).catch(function (e) { delete primed[k]; throw e; });
    }
    await primed[k];
    if (st && /^Starting/.test(st.textContent)) st.textContent = 'Ready';
  }
  function renderResult(res) {
    var box = q('prResult');
    if (!res) { box.innerHTML = ''; return; }
    var cols = res.columns || [], rows = res.rows || [], max = 100;
    box.innerHTML = '<div class="pr-resmeta">' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' &middot; ' + cols.length + ' column' + (cols.length === 1 ? '' : 's')
      + (res.ms !== undefined ? ' &middot; ' + res.ms + ' ms' : '') + (rows.length > max ? ' &middot; showing first ' + max : '') + '</div>'
      + '<div class="pr-tablewrap"><table class="pr-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.slice(0, max).map(function (r) { return '<tr>' + r.map(function (v) { return '<td' + (v === null ? ' class="pr-null"' : '') + '>' + (v === null ? 'null' : esc(typeof v === 'number' ? Math.round(v * 10000) / 10000 : v)) + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div>';
  }
  function wireEditor(pack, lv, t, next) {
    var st = q('prStatus'), out = q('prOut'), verdict = q('prVerdict');
    var ed = makeEditor(t, exec);
    prime(lv, t.tool).catch(function (e) { st.textContent = e.message; });
    q('prReset').onclick = function () { ed.set(t.starter); lsSet('kojoh-prac-code-' + t.id, null); };
    q('prHint').onclick = function () { flag('hint', t); q('prHintBox').hidden = false; };
    var sol = q('prSol');
    if (sol) sol.onclick = function () {
      if (!S.progress.solved[t.id] && !confirm('Open the solution? You will keep only 25% of the points for this question.')) return;
      flag('sol', t); q('prSolBox').hidden = false;
    };
    q('prRun').onclick = function () { exec(false); };
    q('prCheck').onclick = function () { exec(true); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-peek]'), function (b) {
      b.onclick = async function () {
        var n = b.getAttribute('data-peek'); busy(true); st.textContent = 'Loading ' + n;
        try { await prime(lv, t.tool); renderResult(await KP.run(t.tool, t.tool === 'sql' ? 'SELECT * FROM ' + n + ' LIMIT 8' : 'result = ' + n + '.head(8)')); st.textContent = 'Preview of ' + n; out.hidden = true; verdict.hidden = true; }
        catch (e) { st.textContent = e.message; }
        busy(false);
      };
    });
    function busy(on) { ['prRun', 'prCheck'].forEach(function (id) { var b = q(id); if (b) b.disabled = on; }); }
    async function exec(check) {
      busy(true); verdict.hidden = true; out.hidden = true; st.textContent = 'Running';
      try {
        await prime(lv, t.tool);
        var res = await KP.run(t.tool, ed.get());
        renderResult(res);
        if (res.out) { out.textContent = res.out; out.hidden = false; }
        st.textContent = '';
        if (check) {
          var c = await KP.check(t, res);
          verdict.hidden = false;
          if (c.ok) {
            var got = markSolved(t);
            verdict.className = 'pr-verdict ok';
            verdict.innerHTML = '<strong>Correct.</strong> ' + (got ? '+' + got + ' of ' + t.points + ' points. ' : '') + nextLink(pack, lv, next);
          } else {
            wrongTry(t);
            verdict.className = 'pr-verdict no';
            verdict.innerHTML = '<strong>Not yet.</strong> ' + esc(c.why);
          }
        }
      } catch (e) {
        renderResult(null); st.textContent = '';
        verdict.hidden = false; verdict.className = 'pr-verdict no';
        verdict.innerHTML = '<strong>Error</strong><pre>' + esc(e.message) + '</pre>';
        if (e.out) { out.textContent = e.out; out.hidden = false; }
      }
      busy(false);
    }
  }

  // ------------------------------------------------------------------ Excel / Power BI (pass holders only)
  function downloadBar(lv) {
    if (!hasPass()) return '<div class="pr-dl"><div><strong>Data files come with the Practice pass</strong><span>Excel and Power BI questions use the full workbook.</span></div><div class="pr-dl-btns"><a class="k-btn k-btn-brand" href="#pass" data-nav="home">See the Practice pass</a></div></div>';
    return '<div class="pr-dl"><div><strong>Get the data</strong><span>Open it in Excel, Google Sheets or Power BI Desktop.</span></div>'
      + '<div class="pr-dl-btns"><button type="button" class="k-btn k-btn-brand" data-xlsx="1">Excel workbook (.xlsx)</button>'
      + lv.tables.map(function (t) { return '<button type="button" class="k-btn" data-csv="' + esc(t.name) + '">' + esc(t.name) + '.csv</button>'; }).join('') + '</div></div>';
  }
  var xlsxP = null;
  async function downloadWorkbook(lv, btn) {
    var label = btn.textContent; btn.disabled = true; btn.textContent = 'Preparing workbook';
    try {
      if (!xlsxP) xlsxP = new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = res; sc.onerror = function () { xlsxP = null; rej(new Error('Could not load the Excel builder. Download the CSV files instead.')); }; document.head.appendChild(sc); });
      await xlsxP;
      var files = await tableFiles(lv), wb = window.XLSX.utils.book_new();
      for (var i = 0; i < files.length; i++) {
        var ws = window.XLSX.read(await KP.fetchText(files[i].url), { type: 'string', raw: false, cellDates: true }).Sheets.Sheet1;
        window.XLSX.utils.book_append_sheet(wb, ws, files[i].name.slice(0, 31));
      }
      window.XLSX.writeFile(wb, (lv.company || 'kojoh') + '-practice-data.xlsx');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.textContent = label;
  }
  async function downloadCsv(lv, name) {
    var f = (await tableFiles(lv)).filter(function (x) { return x.name === name; })[0];
    if (!f) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await KP.fetchText(f.url)], { type: 'text/csv' }));
    a.download = name + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function answerTaskHtml(lv, t) {
    var saved = lsGet('kojoh-prac-ans-' + t.id, []), ticks = lsGet('kojoh-prac-chk-' + t.id, {});
    var h = downloadBar(lv) + '<div class="pr-work"><section class="pr-brief"><p class="pr-q">' + esc(t.question) + '</p>'
      + '<div class="pr-acts"><button type="button" class="k-btn" id="prHint">Show hint</button>' + (t.explain ? '<button type="button" class="k-btn" id="prSol">Show method</button>' : '') + '</div>'
      + '<div class="pr-hint" id="prHintBox" hidden>' + esc(t.hint || 'No hint for this one.') + '</div>'
      + (t.explain ? '<div class="pr-sol" id="prSolBox" hidden><p>' + esc(t.explain) + '</p>' + (t.answer_values ? '<ul class="pr-anslist">' + t.fields.map(function (f, i) { return '<li>' + esc(f.label) + ': <strong>' + esc(t.answer_values[i]) + '</strong></li>'; }).join('') + '</ul>' : '') + '</div>' : '');
    if (t.checklist && t.checklist.length) h += '<div class="pr-checklist"><div class="pr-eyebrow">Your build should have</div>' + t.checklist.map(function (c, i) { return '<label><input type="checkbox" data-tick="' + i + '"' + (ticks[i] ? ' checked' : '') + '> ' + esc(c) + '</label>'; }).join('') + '</div>';
    h += '</section><section class="pr-editor"><div class="pr-edbar"><span>Your answers from ' + TOOL_LABEL[t.tool] + '</span></div><div class="pr-answers">'
      + (t.fields || []).map(function (f, i) { return '<label class="pr-ans"><span>' + esc(f.label) + '</span><span class="pr-ans-in"><input type="text" inputmode="decimal" autocomplete="off" data-ans="' + i + '" value="' + esc(saved[i] || '') + '"><b class="pr-mark" data-mark="' + i + '"></b></span></label>'; }).join('')
      + '</div><p class="pr-note">Numbers: 2 decimals unless it is a whole count. 1,23,456.70 and 123456.7 both work, with or without the rupee sign.</p>'
      + '<div class="pr-runbar"><button type="button" class="k-btn k-btn-brand" id="prCheck">Check answers</button></div><div class="pr-verdict" id="prVerdict" hidden></div></section></div>';
    return h;
  }
  function wireAnswers(pack, lv, t, next) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('[data-ans]')), verdict = q('prVerdict');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () { lsSet('kojoh-prac-ans-' + t.id, inputs.map(function (x) { return x.value; })); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tick]'), function (c) { c.onchange = function () { var o = lsGet('kojoh-prac-chk-' + t.id, {}); o[c.getAttribute('data-tick')] = c.checked; lsSet('kojoh-prac-chk-' + t.id, o); }; });
    q('prHint').onclick = function () { flag('hint', t); q('prHintBox').hidden = false; };
    var sol = q('prSol');
    if (sol) sol.onclick = function () { if (!S.progress.solved[t.id] && !confirm('Open the method and answers? You will keep only 25% of the points.')) return; flag('sol', t); q('prSolBox').hidden = false; };
    q('prCheck').onclick = check;
    async function check() {
      if (!t.fields) return;
      var vals = inputs.map(function (x) { return x.value; }), res = await KP.checkAnswers(t, vals), right = 0;
      res.forEach(function (r, i) { var m = document.querySelector('[data-mark="' + i + '"]'); m.textContent = vals[i].trim() ? (r.ok ? '✓' : '✗') : ''; m.className = 'pr-mark ' + (r.ok ? 'ok' : 'no'); if (r.ok) right++; });
      verdict.hidden = false;
      if (right === res.length) { var got = markSolved(t); verdict.className = 'pr-verdict ok'; verdict.innerHTML = '<strong>All correct.</strong> ' + (got ? '+' + got + ' of ' + t.points + ' points. ' : '') + nextLink(pack, lv, next); }
      else { wrongTry(t); verdict.className = 'pr-verdict no'; verdict.innerHTML = '<strong>' + right + ' of ' + res.length + ' correct.</strong> Check the filters (for example Delivered only) and rounding.'; }
    }
  }

  // ------------------------------------------------------------------ written answers (reviewed by KOJOH)
  function writtenHtml(t) {
    var w = S.written[t.id], draft = lsGet('kojoh-prac-wr-' + t.id, null);
    var text = draft !== null ? draft : (w ? w.answer : '');
    var h = '<div class="pr-work"><section class="pr-brief"><p class="pr-q">' + esc(t.question) + '</p>'
      + (t.guidance ? '<div class="pr-hint">' + esc(t.guidance) + '</div>' : '')
      + '<p class="pr-note">Written answers are read and marked by the KOJOH team, usually within 2 working days. Use the data: quote real numbers.</p></section>'
      + '<section class="pr-editor"><div class="pr-edbar"><span>Your answer</span><span id="prWords"></span></div>';
    if (w && w.status === 'reviewed') {
      h += '<div class="pr-written-done"><p class="pr-answer">' + esc(w.answer).replace(/\n/g, '<br>') + '</p></div>'
        + '<div class="pr-verdict ok"><strong>Marked: ' + w.marks + ' / ' + w.max_marks + '</strong>' + (w.feedback ? '<p>' + esc(w.feedback) + '</p>' : '') + '</div>';
    } else {
      h += '<textarea id="prWritten" class="pr-written" placeholder="Write your answer here">' + esc(text) + '</textarea>'
        + '<div class="pr-runbar"><button type="button" class="k-btn k-btn-brand" id="prSubmit">' + (w ? 'Update answer' : 'Submit answer') + '</button>'
        + (w ? '<span class="pr-kbd">Submitted, waiting for review. You can edit until it is marked.</span>' : '') + '</div>'
        + '<div class="pr-verdict" id="prVerdict" hidden></div>';
    }
    return h + '</section></div>';
  }
  function wireWritten(pack, lv, t, next) {
    var ta = q('prWritten'), wc = q('prWords'), lim = t.word_limit || 200;
    if (!ta) return;
    function count() { var n = KP.words(ta.value); wc.textContent = n + ' / ' + lim + ' words'; wc.className = n > lim ? 'pr-over' : ''; q('prSubmit').disabled = !n || n > lim; return n; }
    ta.addEventListener('input', function () { lsSet('kojoh-prac-wr-' + t.id, ta.value); count(); });
    count();
    q('prSubmit').onclick = async function () {
      var v = q('prVerdict');
      if (!S.session) { v.hidden = false; v.className = 'pr-verdict no'; v.innerHTML = '<a href="/auth">Sign in</a> to submit written answers.'; return; }
      var n = count(); if (!n || n > lim) return;
      this.disabled = true;
      var row = { user_id: S.session.user.id, role: pack.id, level: lv.key, task_id: t.id, question: t.question, answer: ta.value.trim(), words: n, max_marks: t.points, status: 'submitted' };
      var r = S.written[t.id]
        ? await SUPA.from('practice_written').update({ answer: row.answer, words: n }).eq('user_id', row.user_id).eq('task_id', t.id).select().maybeSingle()
        : await SUPA.from('practice_written').insert(row).select().maybeSingle();
      this.disabled = false;
      v.hidden = false;
      if (r.error) { v.className = 'pr-verdict no'; v.innerHTML = '<strong>Could not submit.</strong> ' + esc(r.error.message); return; }
      S.written[t.id] = r.data || row; lsSet('kojoh-prac-wr-' + t.id, null);
      v.className = 'pr-verdict ok'; v.innerHTML = '<strong>Submitted.</strong> You will see your marks here once it is reviewed. ' + nextLink(pack, lv, next);
    };
  }

  // ------------------------------------------------------------------ certificate request
  async function claim(levelKey) {
    var pack = S.packs[S.role + ':pro'] || S.packs[S.role + ':free'], lv = levelOf(pack, levelKey), st = levelStats(lv);
    var name = (q('prCertName').value || '').trim();
    if (name.length < 2) { toast('Enter the name to print on the certificate.', 'error'); return; }
    var code = 'KJ-' + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase().slice(0, 8);
    var r = await SUPA.from('practice_certificates').insert({ code: code, user_id: S.session.user.id, name: name, role: pack.id, role_title: pack.title,
      level: levelKey, auto_points: st.auto, auto_max: st.autoMax, status: 'requested' }).select().maybeSingle();
    if (r.error) { toast(r.error.message, 'error'); return; }
    S.certs[pack.id + ':' + levelKey] = r.data;
    toast('Certificate requested. It is issued once your written answers are reviewed.');
    route();
  }

  // ------------------------------------------------------------------ payments (pass + level skip)
  var chosen = null;
  function needLogin() { try { sessionStorage.setItem('kojoh_after_auth', location.pathname + location.search); } catch (e) {} location.href = '/auth'; }
  function openPay(item) {
    if (!S.session) { needLogin(); return; }
    chosen = item;
    q('passTitle').textContent = item.title; q('passItem').textContent = item.label;
    q('passPrice').textContent = fmtRs(item.price); q('passTotal').textContent = fmtRs(item.price);
    q('passIncl').textContent = item.incl; q('passBonus').textContent = item.bonus;
    var go = q('passGo'); go.disabled = !S.live; go.textContent = S.live ? 'Pay ' + fmtRs(item.price) : 'Opens when payments go live';
    q('passModal').hidden = false; document.body.classList.add('k-noscroll');
  }
  function openPass(key) {
    var p = PASSES.filter(function (x) { return x.key === key; })[0];
    openPay({ body: { pass: p.key }, title: 'Practice pass', label: 'Practice pass, ' + p.label, price: p.price, incl: 'Every role, level and question', bonus: '20% off portfolio projects' });
  }
  function openSkip(levelKey) {
    var pack = S.packs[S.role + ':pro'], lv = pack && levelOf(pack, levelKey);
    if (!lv) return;
    var prev = levelOf(pack, LEVELS[LEVELS.indexOf(levelKey) - 1]);
    openPay({ body: { skip: { role: pack.id, level: levelKey, role_title: pack.title } }, title: 'Skip to ' + lv.name, label: pack.title + ': unlock ' + lv.name, price: SKIP_PRICE,
      incl: 'Opens the ' + lv.name + ' level now', bonus: prev.name + ' certificate, marked unlocked (no score)' });
  }
  function closePay() { q('passModal').hidden = true; document.body.classList.remove('k-noscroll'); }
  function loadScript(src) { return new Promise(function (res, rej) { if (document.querySelector('script[src="' + src + '"]')) return res(); var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load the payment window.')); }; document.head.appendChild(s); }); }
  async function fnErr(r) { var m = r.data && r.data.error; if (!m && r.error && r.error.context && r.error.context.json) { try { m = (await r.error.context.json()).error; } catch (e) {} } return m || (r.error && r.error.message) || 'Something went wrong.'; }
  async function pay() {
    var go = q('passGo'), note = q('passNote');
    go.disabled = true; go.textContent = 'Opening payment';
    try {
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      var o = await SUPA.functions.invoke('create-order', { body: chosen.body });
      if (o.error || (o.data && o.data.error)) throw new Error(await fnErr(o));
      var od = o.data;
      var vd = await new Promise(function (resolve, reject) {
        var rz = new window.Razorpay({ key: od.key_id, order_id: od.order_id, amount: od.amount, currency: od.currency || 'INR', name: 'KOJOH', description: od.title,
          prefill: { email: od.email || '' }, theme: { color: '#141317' },
          handler: async function (resp) { var v = await SUPA.functions.invoke('verify-payment', { body: resp }); if (v.error || (v.data && v.data.error)) reject(new Error(await fnErr(v))); else resolve(v.data); },
          modal: { ondismiss: function () { reject(new Error('Payment cancelled. Nothing was charged.')); } } });
        rz.on('payment.failed', function (r) { reject(new Error((r && r.error && r.error.description) || 'Payment failed. Nothing was charged.')); });
        rz.open();
      });
      closePay();
      if (vd.pass_expires_at) { S.pass = { expires_at: vd.pass_expires_at }; try { localStorage.setItem('kojoh-member', '1'); document.documentElement.classList.add('k-member'); } catch (e) {} toast('Practice pass active until ' + fmtDate(vd.pass_expires_at) + '.' + (vd.reward && vd.reward.code ? ' Bonus code for your next project: ' + vd.reward.code : '')); }
      if (vd.unlocked) toast('Level unlocked. Good luck!');
      await loadUserData();
      route();
    } catch (e) { go.disabled = false; go.textContent = 'Try again'; note.innerHTML = '<span class="k-err">' + esc(e.message) + '</span>'; }
  }

  // ------------------------------------------------------------------ clicks
  app.addEventListener('click', function (e) {
    var x = e.target.closest('[data-xlsx],[data-csv]');
    if (x) {
      e.preventDefault();
      if (!hasPass()) return;
      var pk = S.packs[S.role + ':pro'], lv = pk && levelOf(pk, S.level);
      if (!lv) return;
      if (x.hasAttribute('data-xlsx')) downloadWorkbook(lv, x); else downloadCsv(lv, x.getAttribute('data-csv')).catch(function (er) { toast(er.message, 'error'); });
      return;
    }
    var a = e.target.closest('[data-role],[data-level],[data-task],[data-nav],[data-pass],[data-skip],[data-claim]');
    if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-pass')) openPass(a.getAttribute('data-pass'));
    else if (a.hasAttribute('data-skip')) openSkip(a.getAttribute('data-skip'));
    else if (a.hasAttribute('data-claim')) claim(a.getAttribute('data-claim'));
    else if (a.hasAttribute('data-role')) go(a.getAttribute('data-role'));
    else if (a.hasAttribute('data-level')) go(S.role, a.getAttribute('data-level'));
    else if (a.hasAttribute('data-task')) go(S.role, S.level, a.getAttribute('data-task'));
    else if (a.getAttribute('data-nav') === 'home') { go(null); setTimeout(function () { var p = q('pass'); if (p && a.getAttribute('href') === '#pass') p.scrollIntoView(); }, 50); }
    else if (a.getAttribute('data-nav') === 'role') go(S.role);
    else if (a.getAttribute('data-nav') === 'level') go(S.role, S.level);
  });
  q('passClose').onclick = closePay;
  q('passModal').addEventListener('click', function (e) { if (e.target.id === 'passModal') closePay(); });
  q('passGo').onclick = pay;

  // ------------------------------------------------------------------ start
  (async function init() {
    try {
      var jobs = [loadManifest()];
      if (SUPA) jobs.push(SUPA.auth.getSession());
      var r = await Promise.all(jobs);
      S.manifest = r[0];
      S.session = (r[1] && r[1].data && r[1].data.session) || null;
      if (SUPA) {
        var qq = await Promise.all([
          S.session ? SUPA.from('practice_passes').select('expires_at').eq('user_id', S.session.user.id).maybeSingle() : Promise.resolve({ data: null }),
          SUPA.from('app_settings').select('value').eq('key', 'payments').maybeSingle()
        ]);
        S.pass = (qq[0] && !qq[0].error && qq[0].data) || null;
        S.live = !!(qq[1] && qq[1].data && qq[1].data.value && qq[1].data.value.mode === 'live');
        await loadUserData();
      }
      var u = readUrl();
      if (!u.role && !location.hash) { var last = lsGet('kojoh-prac-role', null); if (last && roleMeta(last)) { go(last, null, null, true); return; } }
      route();
    } catch (e) {
      app.innerHTML = '<div class="empty-state"><h3>Practice is getting ready</h3><p>' + esc(e.message) + ' Check back soon.</p></div>';
    }
  })();
})();
