// === KOJOH RECOMMENDATIONS ===
// kojohRecs(el, opts) fills `el` with: a goal picker, up to 3 paid projects picked
// for the learner's goal (and skill, if given), a Practice suggestion and a blurred
// certificate teaser. Needs config.js (kojohSupa, kojohDsCard, kojohOwned, kojohEsc).
//
// Goal -> price tier:  student = starter (Rs 99), job_seeker = Rs 249 cases, switcher = Rs 449 premium.
(function () {
  var GOALS = {
    student:    { label: 'Student or beginner', short: 'Student', tier: 99,  why: 'Affordable starter projects that build the basics.' },
    job_seeker: { label: 'Looking for a job',   short: 'Job seeker', tier: 249, why: 'Company case studies that read like real interview take-homes.' },
    switcher:   { label: 'Switching careers',   short: 'Switching', tier: 449, why: 'Our deepest projects, unique to you, to prove you can do the job.' }
  };
  var SKILL_TAG = { sql: 'SQL', excel: 'Excel', python: 'Python', powerbi: 'Power BI', stats: 'Statistics' };
  var SKILL_ROLE = { sql: 'data-analyst', excel: 'data-analyst', python: 'data-analyst', powerbi: 'data-analyst', stats: 'data-scientist' };
  var TIERS = [99, 249, 449];

  function css() {
    if (document.getElementById('kRecCss')) return;
    var st = document.createElement('style'); st.id = 'kRecCss';
    st.textContent = ''
      + '.krec{margin-top:2.25rem}'
      + '.krec-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:.8rem 1.5rem;margin-bottom:1rem}'
      + '.krec-head h2{font-family:"Space Grotesk",sans-serif;font-size:1.35rem;margin:0}'
      + '.krec-head p{margin:.3rem 0 0;color:var(--muted);font-size:.875rem}'
      + '.krec-goals{display:flex;flex-wrap:wrap;gap:.4rem}'
      + '.krec-goal{font:inherit;font-size:.78rem;font-weight:600;padding:.4rem .85rem;border-radius:999px;border:1px solid var(--line);background:var(--card,#fff);color:var(--text);cursor:pointer}'
      + '.krec-goal.on{background:var(--text);color:var(--bg);border-color:var(--text)}'
      + '.krec-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:1rem;margin-top:1rem}'
      + '.krec-card{display:flex;flex-direction:column;gap:.5rem;border:1px solid var(--line);border-radius:18px;padding:1.2rem 1.25rem;background:var(--card,#fff);color:inherit;text-decoration:none;position:relative;overflow:hidden}'
      + '.krec-card h3{font-family:"Space Grotesk",sans-serif;font-size:1.05rem;margin:0}'
      + '.krec-card p{margin:0;color:var(--muted);font-size:.85rem;line-height:1.55}'
      + '.krec-card .k-btn{align-self:flex-start;margin-top:auto}'
      + '.krec-eyebrow{font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}'
      + '.krec-cert{padding:0;aspect-ratio:297/210;min-height:12rem;justify-content:flex-end}'
      + '.krec-cert-paper{position:absolute;inset:0;background:#F4F1EA;color:#1C1A1E;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:9%;text-align:center;gap:.3rem;filter:blur(1.6px)}'
      + '.krec-cert-paper::before{content:"";position:absolute;inset:5%;border:2px solid #D98B5F;outline:1px solid #1C1A1E;outline-offset:4px;border-radius:4px}'
      + '.krec-cert-paper b{font-family:"Space Grotesk",sans-serif;font-size:1.3rem;letter-spacing:.25rem}'
      + '.krec-cert-paper i{font-style:normal;font-size:.55rem;letter-spacing:.15rem;text-transform:uppercase}'
      + '.krec-cert-paper em{font-family:"Space Grotesk",sans-serif;font-style:normal;font-size:1.45rem;font-weight:700;border-bottom:1.5px solid #D98B5F;padding:0 .8rem .2rem;margin-top:.5rem}'
      + '.krec-cert-paper small{font-size:.62rem;color:#5d5a55;max-width:70%}'
      + '.krec-cert-over{position:relative;z-index:1;margin:0 .8rem .8rem;background:var(--card,#fff);border:1px solid var(--line);border-radius:14px;padding:.75rem .9rem;box-shadow:0 8px 24px rgba(0,0,0,.14);display:flex;align-items:center;justify-content:space-between;gap:.75rem}'
      + '.krec-cert-over div{display:flex;flex-direction:column;gap:.15rem;min-width:0}'
      + '.krec-cert-over b{font-size:.9rem}'
      + '.krec-cert-over span{font-size:.75rem;color:var(--muted);line-height:1.45}'
      + '.krec-cert-over .k-btn{flex:none;margin:0;align-self:center}'
      + '.krec-empty{color:var(--muted);font-size:.875rem}';
    document.head.appendChild(st);
  }

  function getLocalGoal() { try { var g = localStorage.getItem('kojoh-goal'); return GOALS[g] ? g : null; } catch (e) { return null; } }
  function setLocalGoal(g) { try { localStorage.setItem('kojoh-goal', g); } catch (e) {} }

  async function loadGoal(S) {
    var g = getLocalGoal();
    try {
      var r = await S.auth.getSession(); var u = r.data && r.data.session && r.data.session.user;
      if (u) {
        var p = await S.from('profiles').select('goal').eq('id', u.id).maybeSingle();
        if (p.data && GOALS[p.data.goal]) { g = p.data.goal; setLocalGoal(g); }
        return { goal: g, uid: u.id };
      }
    } catch (e) {}
    return { goal: g, uid: null };
  }

  function score(d, goal, skillTag, tags) {
    var price = Number(d.price) || 0, s = 0;
    if (goal) {
      var want = TIERS.indexOf(GOALS[goal].tier), have = TIERS.indexOf(price);
      if (have === -1) have = price < 175 ? 0 : (price < 350 ? 1 : 2);
      s += want === have ? 6 : (Math.abs(want - have) === 1 ? 2 : 0);
    }
    if (skillTag && (tags[d.id] || []).indexOf(skillTag) > -1) s += 4;
    return s;
  }

  // Blurred certificate teaser. href: where the button goes.
  window.kojohCertTeaser = function (href) {
    return '<div class="krec-card krec-cert"><div class="krec-cert-paper" aria-hidden="true"><b>KOJOH</b><i>Certificate of completion</i>'
      + '<em>Your name here</em><small>has completed a reviewed KOJOH portfolio project, solving a real business question.</small></div>'
      + '<div class="krec-cert-over"><div><b>Earn a verified certificate</b>'
      + '<span>Finish a paid project, or the free Returns project, and submit it. We review it and you get a certificate with a public link.</span></div>'
      + '<a class="k-btn k-btn-brand" href="' + (href || '/recommendations') + '">See projects</a></div></div>';
  };

  window.kojohRecs = async function (el, opts) {
    opts = opts || {};
    if (!el) return;
    css();
    var S = window.kojohSupa && window.kojohSupa(), esc = window.kojohEsc;
    var skillTag = SKILL_TAG[opts.skill] || null;
    var who = S ? await loadGoal(S) : { goal: getLocalGoal(), uid: null };
    var goal = who.goal;
    var data = [], tags = {}, owned = {};
    if (S) {
      try {
        var res = await Promise.all([
          S.from('datasets').select('id, slug, title, short_description, price, is_free, meta, difficulty, preview_rows, created_at, art_boy_url, art_girl_url').eq('is_free', false),
          S.from('dataset_tags').select('dataset_id, tags(name)'),
          window.kojohOwned ? window.kojohOwned() : {}
        ]);
        data = (res[0] && res[0].data) || [];
        ((res[1] && res[1].data) || []).forEach(function (x) { if (x.tags) (tags[x.dataset_id] = tags[x.dataset_id] || []).push(x.tags.name); });
        owned = res[2] || {};
      } catch (e) {}
    }
    var exclude = opts.exclude || [];

    function render() {
      var list = data.filter(function (d) { return !owned[d.id] && exclude.indexOf(d.id) === -1 && Number(d.price) > 0; })
        .map(function (d) { return { d: d, s: score(d, goal, skillTag, tags) }; })
        .sort(function (a, b) { return b.s - a.s || (new Date(b.d.created_at) - new Date(a.d.created_at)); })
        .slice(0, opts.limit || 3).map(function (x) { return x.d; });
      var practiceRole = SKILL_ROLE[opts.skill] || 'data-analyst';
      var h = '<div class="krec-head"><div><span class="krec-eyebrow">Grow your skills</span><h2>' + esc(opts.title || 'Next: a project for your portfolio') + '</h2>'
        + '<p>' + (goal ? esc(GOALS[goal].why) : 'Tell us where you are and we will pick the right projects.') + '</p></div>'
        + '<div class="krec-goals" role="group" aria-label="Your goal">' + Object.keys(GOALS).map(function (k) {
          return '<button type="button" class="krec-goal' + (k === goal ? ' on' : '') + '" data-goal="' + k + '">' + esc(GOALS[k].label) + '</button>';
        }).join('') + '</div></div>';
      h += list.length ? '<div class="k-dsgrid">' + list.map(function (d) { return window.kojohDsCard(d, {}); }).join('') + '</div>'
        : '<p class="krec-empty">' + (S ? 'You already have every project we would suggest. Nice work.' : 'Projects load when you are online.') + '</p>';
      h += '<div class="krec-row">'
        + '<a class="krec-card" href="/practice?role=' + practiceRole + '"><span class="krec-eyebrow">Practice</span><h3>' + (skillTag ? 'Practise ' + esc(skillTag) + ' in your browser' : 'Practise in your browser') + '</h3>'
        + '<p>Real questions on a full case company. The first 5 in every role are free, and a 7-day pass is &#8377;45.</p><span class="k-btn">Open Practice &rarr;</span></a>'
        + (opts.cert === false ? '' : window.kojohCertTeaser(opts.certHref || '/recommendations'))
        + '</div>';
      el.innerHTML = '<section class="krec">' + h + '</section>';
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-goal]'); if (!b || !el.contains(b)) return;
      goal = b.getAttribute('data-goal'); setLocalGoal(goal); render();
      if (S && who.uid) S.from('profiles').update({ goal: goal }).eq('id', who.uid).then(function () {}, function () {});
    });
    render();
  };
})();
