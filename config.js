// KOJOH global config
window.KOJOH_VERSION = '0.4.0';

// ---------------------------------------------------------------------------
// One shared Supabase client, so pages stop spinning up duplicates.
// ---------------------------------------------------------------------------
// Every page must go through this. Two clients in one tab each run their own
// refresh timer, and because Supabase rotates refresh tokens the slower one
// then refreshes with a token the faster one already spent. That request comes
// back "already used", the client wipes the stored session, and the person is
// signed out for no reason they can see. One client per tab, no race.
window.kojohSupa = function(){
  if (window.__kojohSupa) return window.__kojohSupa;
  if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase)) return null;
  window.__kojohSupa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,      // keep the session in localStorage across reloads
      autoRefreshToken: true,    // renew the access token before it expires
      detectSessionInUrl: true   // pick the session up out of an OAuth redirect
    }
  });
  return window.__kojohSupa;
};

// ---------------------------------------------------------------------------
// Mark this account as active, once per browser session. Feeds the active
// user count on the admin dashboard.
// ---------------------------------------------------------------------------
(function(){
  try { if (sessionStorage.getItem('kojoh_seen')) return; } catch (e) {}
  function run(){
    var s = window.kojohSupa();
    if (!s) return;
    s.auth.getSession().then(function(r){
      if (!r.data || !r.data.session) return;
      s.rpc('touch_last_seen').then(function(){
        try { sessionStorage.setItem('kojoh_seen', '1'); } catch (e) {}
      });
    });
  }
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();

// ---------------------------------------------------------------------------
// Apply the SEO fields a page loaded from the database.
// ---------------------------------------------------------------------------
window.kojohSeo = function(o){
  if (!o) return;
  function meta(attr, key, val){
    if (!val) return;
    var el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', val);
  }
  if (o.title) document.title = o.title;
  meta('name', 'description', o.description);
  meta('name', 'keywords', o.keywords);
  meta('property', 'og:title', o.title);
  meta('property', 'og:description', o.description);
  meta('property', 'og:type', o.type || 'website');
  meta('property', 'og:image', o.image);
  meta('property', 'og:url', o.canonical || window.location.href);
  meta('name', 'twitter:card', o.image ? 'summary_large_image' : 'summary');
  meta('name', 'twitter:title', o.title);
  meta('name', 'twitter:description', o.description);
  meta('name', 'twitter:image', o.image);

  var link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', o.canonical || window.location.href.split('#')[0]);
};

// ---------------------------------------------------------------------------
// Shared UI helpers. Every page can use these, so feedback, loading states
// and dataset cards look and behave the same everywhere.
// ---------------------------------------------------------------------------
window.kojohEsc = function(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/[<>&"]/g, function(c){ return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; });
};

// ---------------------------------------------------------------------------
// Prices. datasets.price is the first-purchase offer; datasets.meta.mrp is the
// regular price, shown struck through. Everyone pays the offer price; Practice-pass members
// and reward codes take a % off the offer price. The server (create-order) enforces the same rule.
// Both versions are rendered; <html class="k-repeat"> switches which one shows.
// ---------------------------------------------------------------------------
window.kojohMrp = function(d){
  var m = d && d.meta && Number(d.meta.mrp);
  return (m && m > Number(d.price)) ? m : 0;
};
window.kojohIsRepeat = function(){ return document.documentElement.classList.contains('k-repeat'); };
// Practice-pass members (30-day pass or longer) get this % off the offer price. Server enforces it too.
window.kojohMemberPct = 20;
window.kojohIsMember = function(){ return document.documentElement.classList.contains('k-member'); };
window.kojohMemberPrice = function(d){
  var offer = Number(d.price) || 0;
  return Math.max(1, Math.round(offer * (100 - window.kojohMemberPct) / 100));
};
window.kojohPriceFor = function(d){
  return window.kojohIsMember() ? window.kojohMemberPrice(d) : (Number(d.price) || 0);
};
// "31% off" against MRP, or '' when there is no MRP.
window.kojohOffPct = function(d){
  var mrp = window.kojohMrp(d), p = window.kojohPriceFor(d);
  return mrp ? Math.round((1 - p / mrp) * 100) : 0;
};
window.kojohMoney = function(d){
  if (!d) return '';
  if (d.is_free || !Number(d.price)) return 'Free';
  var p = '&#8377;' + Number(d.price).toFixed(0), mrp = window.kojohMrp(d);
  var was = '<s class="k-mrp">&#8377;' + (mrp || Number(d.price)).toFixed(0) + '</s> ';
  return '<span class="k-price"><span class="k-p-offer">' + (mrp ? was : '') + p + '</span>'
    + '<span class="k-p-mem">' + was + '&#8377;' + window.kojohMemberPrice(d).toFixed(0) + '</span></span>';
};
(function(){
  var KEY = 'kojoh-repeat-buyer';
  var MKEY = 'kojoh-member';
  function set(v){   // repeat buyers no longer pay more; the class is kept off
    document.documentElement.classList.remove('k-repeat');
    try { localStorage.removeItem(KEY); } catch(e){}
  }
  function setMember(v){
    document.documentElement.classList.toggle('k-member', !!v);
    try { localStorage.setItem(MKEY, v ? '1' : '0'); } catch(e){}
  }
  try { if (localStorage.getItem(MKEY) === '1') document.documentElement.classList.add('k-member'); } catch(e){}
  if (!document.getElementById('kPriceCss')) {
    var st = document.createElement('style'); st.id = 'kPriceCss';
    st.textContent = '.k-mrp{opacity:.55;font-weight:500;margin-right:.15em}.k-p-mem{display:none}'
      + 'html.k-member .k-p-offer{display:none}html.k-member .k-p-mem{display:inline}'
      + '.k-offer-badge{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:.2rem .55rem;border-radius:999px;background:var(--text);color:var(--bg);vertical-align:middle}'
      + '';
    (document.head || document.documentElement).appendChild(st);
  }
  window.kojohRefreshBuyer = function(){
    var s = window.kojohSupa && window.kojohSupa();
    if (!s) return Promise.resolve();
    return s.auth.getSession().then(function(r){
      var u = r.data && r.data.session && r.data.session.user;
      if (!u) { set(false); setMember(false); return; }
      // Member price needs a running 30-day-or-longer pass (the 7-day pass is Practice only).
      var pass = s.from('payments').select('paid_at, pass_days').eq('user_id', u.id).eq('kind', 'pass').eq('status', 'paid').gte('pass_days', 30)
        .order('paid_at', { ascending: false }).limit(10)
        .then(function(q){ setMember(!q.error && (q.data || []).some(function(x){ return x.paid_at && new Date(x.paid_at).getTime() + x.pass_days * 86400000 > Date.now(); })); }, function(){ setMember(false); });
      set(false);
      return pass;
    }).catch(function(){});
  };
})();

// A short notice in the corner. kind: 'ok' (default) or 'error'.
// Pass action + onAction for an inline button, for example Undo.
window.kojohToast = function(msg, opts){
  opts = opts || {};
  var wrap = document.querySelector('.k-toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'k-toasts';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  var t = document.createElement('div');
  t.className = 'k-toast' + (opts.kind === 'error' ? ' k-toast-error' : '');
  var span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  function close(){
    if (!t.parentNode) return;
    t.classList.add('k-toast-out');
    setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 200);
  }
  if (opts.action) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'k-toast-btn';
    b.textContent = opts.action;
    b.addEventListener('click', function(){ close(); if (opts.onAction) opts.onAction(); });
    t.appendChild(b);
  }
  wrap.appendChild(t);
  setTimeout(close, opts.ms || (opts.kind === 'error' ? 5200 : 3200));
  return close;
};

// Placeholder shapes shown while a page waits on the database.
window.kojohSkeleton = function(kind){
  var line = function(w){ return '<div class="k-skel k-skel-line" style="width:' + w + '%"></div>'; };
  var card = function(){
    return '<div class="k-skel-card"><div class="k-skel" style="height:1.3rem;width:30%;border-radius:999px;"></div>'
      + '<div class="k-skel k-skel-title" style="margin-top:0.9rem;"></div>' + line(96) + line(88) + line(54) + '</div>';
  };
  if (kind === 'grid') {
    return '<div class="k-skel k-skel-title"></div>' + line(58)
      + '<div class="k-skel-grid" style="margin-top:1.5rem;">' + card() + card() + card() + '</div>';
  }
  if (kind === 'list') return card() + card() + card();
  return '<div class="k-skel k-skel-title" style="height:2.2rem;width:80%;"></div>' + line(92) + line(70)
    + '<div style="display:flex;gap:0.5rem;margin:1.2rem 0 1.8rem;">'
    + '<div class="k-skel" style="height:2.3rem;width:6rem;border-radius:999px;"></div>'
    + '<div class="k-skel" style="height:2.3rem;width:7rem;border-radius:999px;"></div></div>'
    + card() + card();
};

// One dataset card, the same everywhere a list of datasets appears.
// opts.owned: true when the viewer already has a license.
// opts.shelf: { licenses_left, licenses_total } from dataset_shelf().
window.kojohDsCard = function(d, opts){
  opts = opts || {};
  var esc = window.kojohEsc;
  var pv = d.preview_rows || null;
  var diff = d.difficulty ? d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1) : '';
  var h = '<a class="k-dscard' + (opts.reveal ? ' k-reveal' : '') + '" href="/dataset?slug=' + encodeURIComponent(d.slug) + '">';
  var art = window.kojohArtImg(d, 'k-dscard-art');
  if (art) h += '<div class="k-dscard-artwrap">' + art + '</div>';
  h += '<div class="k-dscard-top">';
  if (opts.owned) h += '<span class="k-dscard-flag k-dscard-flag-owned">Owned</span>';
  if (diff) h += '<span class="k-chip k-chip-brand">' + esc(diff) + '</span>';
  if (pv && pv.total_rows) {
    h += '<span class="k-chip">' + Number(pv.total_rows).toLocaleString('en-IN') + ' rows</span>';
    if (pv.columns) h += '<span class="k-chip">' + pv.columns.length + ' cols</span>';
  }
  var s = opts.shelf;
  if (!opts.owned && s && s.licenses_total && (s.licenses_left / s.licenses_total) <= 0.2) {
    h += '<span class="k-dscard-flag k-dscard-flag-low">' + s.licenses_left + ' left</span>';
  }
  h += '</div>';
  h += '<h3 class="k-dscard-title">' + esc(d.title) + '</h3>';
  if (window.kojohGivesCert && window.kojohGivesCert(d)) h += window.kojohCertTag();
  h += '<p class="k-dscard-desc">' + esc(d.short_description || '') + '</p>';
  h += '<div class="k-rate" data-rate="' + esc(d.id) + '">' + window.kojohRateHtml(d.id) + '</div>';
  h += '<div class="k-dscard-foot"><span class="k-dscard-price">' + (opts.owned ? 'In your library' : window.kojohMoney(d)) + '</span>';
  h += '<span class="k-dscard-go">' + (opts.owned ? 'Continue' : 'Open project') + ' &rarr;</span></div>';
  return h + '</a>';
};

// Which datasets the signed-in viewer owns, as a { dataset_id: true } map.
window.kojohOwned = function(){
  var s = window.kojohSupa();
  if (!s) return Promise.resolve({});
  return s.auth.getSession().then(function(r){
    if (!r.data || !r.data.session) return {};
    return s.from('purchases').select('dataset_id').then(function(p){
      var out = {};
      (p.data || []).forEach(function(x){ out[x.dataset_id] = true; });
      return out;
    }, function(){ return {}; });
  }, function(){ return {}; });
};

// Remaining licenses per dataset, as a { dataset_id: row } map.
window.kojohShelf = function(){
  var s = window.kojohSupa();
  if (!s) return Promise.resolve({});
  return s.rpc('dataset_shelf').then(function(r){
    var out = {};
    (r.data || []).forEach(function(x){ out[x.dataset_id] = x; });
    return out;
  }, function(){ return {}; });
};

// Per-phase "3 / 7" counters on a challenge checklist. Reads the ticked
// boxes straight from the page, so both challenge views share it.
window.kojohPhaseCounts = function(root){
  if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll('.page-card'), function(card){
    var boxes = card.querySelectorAll('.chal-task-check');
    var h2 = card.querySelector('h2');
    if (!boxes.length || !h2) return;
    var n = 0;
    Array.prototype.forEach.call(boxes, function(b){ if (b.checked) n++; });
    var pill = h2.querySelector('.chal-phase-count');
    if (!pill) {
      h2.classList.add('chal-phase-head');
      pill = document.createElement('span');
      pill.className = 'chal-phase-count';
      h2.appendChild(pill);
    }
    pill.textContent = n + ' / ' + boxes.length;
    pill.classList.toggle('full', n === boxes.length);
  });
};

// Live check on the GitHub and LinkedIn submit fields.
window.kojohLinkCheck = function(input, kind){
  if (!input) return;
  var re = kind === 'github'
    ? /^https:\/\/(www\.)?github\.com\/[^\s/]+\/[^\s/]+/i
    : /^https:\/\/(([a-z]{2,3}\.)?linkedin\.com\/.+|lnkd\.in\/.+)/i;
  var hint = document.createElement('p');
  hint.className = 'chal-submit-hint';
  input.parentNode.appendChild(hint);
  function check(final){
    var v = input.value.trim();
    var ok = re.test(v);
    input.classList.toggle('ok', ok);
    input.classList.toggle('bad', !!v && !ok && final);
    hint.textContent = ok ? 'Looks good.'
      : (v && final ? (kind === 'github' ? 'Use the repo link, like https://github.com/you/project' : 'Use the post link, like https://www.linkedin.com/posts/... or https://lnkd.in/...') : '');
    hint.className = 'chal-submit-hint' + (ok ? ' ok' : (v && final ? ' bad' : ''));
  }
  input.addEventListener('input', function(){ check(false); });
  input.addEventListener('blur', function(){ check(true); });
};


// ---------------------------------------------------------------------------
// Professions = the folders on the site. A new folder in the admin shows up
// at signup automatically. Folder titles map to job titles for recommendations;
// a folder can override that with meta.job_titles in the admin.
// ---------------------------------------------------------------------------
window.kojohTitleCase = function(s){
  return String(s || '').toLowerCase().replace(/(^|[\s\/(-])([a-z])/g, function(m, p, ch){ return p + ch.toUpperCase(); });
};
window.kojohProfessionFolders = function(){
  var s = window.kojohSupa && window.kojohSupa();
  if (!s) return Promise.resolve([]);
  return s.from('folders').select('title, slug, meta').order('sort_order', { ascending: true }).then(function(r){
    if (r.error) return s.from('folders').select('title, slug, meta').order('title');
    return r;
  }).then(function(r){
    return (r.data || []).map(function(f){
      var name = window.kojohTitleCase(f.title);
      var jobs = (f.meta && Array.isArray(f.meta.job_titles) && f.meta.job_titles.length) ? f.meta.job_titles
        : (/business|ops/i.test(f.title) ? ['Business Analyst', 'Operations Analyst', 'Supply Chain Analyst'] : [name]);
      return { name: name, slug: f.slug, jobs: jobs };
    });
  }).catch(function(){ return []; });
};
// Turn picked profession names into job-title names for profile_job_titles.
window.kojohProfessionJobs = function(picked){
  return window.kojohProfessionFolders().then(function(fs){
    var out = [];
    (picked || []).forEach(function(p){
      var f = fs.filter(function(x){ return x.name === p; })[0];
      (f ? f.jobs : [p]).forEach(function(j){ if (out.indexOf(j) === -1) out.push(j); });
    });
    return out;
  });
};

// ---------------------------------------------------------------------------
// Who is signed in: name, initials and photo for the rail chip and avatars.
// ---------------------------------------------------------------------------
window.kojohInitials = function(first, last, username, email){
  var a = (first || '').trim().charAt(0), b = (last || '').trim().charAt(0);
  if (a || b) return (a + b).toUpperCase();
  if (username) return username.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
};
window.kojohPaintAvatars = function(me){
  var wn = document.getElementById('welcomeName');
  if (wn) wn.textContent = (me && (me.first || me.name)) || 'there';
  ['navAvatar', 'navAvatarMobile', 'panelAvatar'].forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    if (me && me.avatar) {
      el.innerHTML = '<img src="' + window.kojohEsc(me.avatar) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
      el.style.overflow = 'hidden';
    } else if (me) el.textContent = me.initials;
  });
};
window.kojohLoadMe = function(){
  var s = window.kojohSupa && window.kojohSupa();
  if (!s) return Promise.resolve(null);
  return s.auth.getSession().then(function(r){
    var u = r.data && r.data.session && r.data.session.user;
    if (!u) { if (window.kojohSetMe) window.kojohSetMe(null); window.kojohPaintAvatars(null); return null; }
    return s.from('profiles').select('first_name, last_name, username, avatar_url').eq('id', u.id).maybeSingle()
      .then(function(p){ return p.error ? s.from('profiles').select('first_name, last_name, username').eq('id', u.id).maybeSingle() : p; })
      .then(function(p){
        var d = (p && p.data) || {};
        var me = {
          first: d.first_name || d.username || (u.email || '').split('@')[0] || '',
          name: [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username || (u.email || '').split('@')[0] || 'Member',
          initials: window.kojohInitials(d.first_name, d.last_name, d.username, u.email),
          avatar: d.avatar_url || ''
        };
        if (window.kojohSetMe) window.kojohSetMe(me);
        window.kojohPaintAvatars(me);
        return me;
      });
  }).catch(function(){ return null; });
};

// ---------------------------------------------------------------------------
// Gender-aware character art. Male sees the boy, female sees the girl, and
// "other" picks once (stored on profiles.art_pref). Guests see the boy.
// ---------------------------------------------------------------------------
(function(){
  var KEY = 'kojoh-art';
  function lsGet(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
  function lsSet(v){ try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch(e){} }
  var esc = function(s){ return window.kojohEsc ? window.kojohEsc(s) : String(s == null ? '' : s); };

  window.kojohArt = function(){ return lsGet() === 'girl' ? 'girl' : 'boy'; };
  window.kojohArtUrl = function(d, who){
    who = who || window.kojohArt();
    return (who === 'girl' ? d.art_girl_url : d.art_boy_url) || d.art_boy_url || d.art_girl_url || '';
  };
  window.kojohArtImg = function(d, cls){
    if (!d || (!d.art_boy_url && !d.art_girl_url)) return '';
    return '<img class="' + cls + '" data-art data-boy="' + esc(d.art_boy_url || '') + '" data-girl="' + esc(d.art_girl_url || '')
      + '" src="' + esc(window.kojohArtUrl(d)) + '" alt="" loading="lazy">';
  };
  window.kojohApplyArt = function(){
    var who = window.kojohArt();
    for (var i = 1; i <= 3; i++) {
      var fr = document.getElementById('wtFrame' + i);
      var src = 'icons/scene/person_' + (who === 'girl' ? 'female' : 'male') + '_' + i + '.png';
      if (fr && fr.getAttribute('src') !== src) fr.setAttribute('src', src);
    }
    Array.prototype.forEach.call(document.querySelectorAll('img[data-art]'), function(im){
      var u = im.getAttribute(who === 'girl' ? 'data-girl' : 'data-boy') || im.getAttribute('data-boy') || im.getAttribute('data-girl');
      if (u && im.getAttribute('src') !== u) im.setAttribute('src', u);
    });
  };
  // Save a choice: always locally, and on the profile when signed in.
  window.kojohSetArt = function(who){
    who = who === 'girl' ? 'girl' : 'boy';
    lsSet(who);
    window.kojohApplyArt();
    var s = window.kojohSupa && window.kojohSupa();
    if (!s) return Promise.resolve();
    return s.auth.getSession().then(function(r){
      var u = r.data && r.data.session && r.data.session.user;
      if (!u) return;
      return s.from('profiles').update({ art_pref: who }).eq('id', u.id);
    }).catch(function(){});
  };

  function chooser(){
    if (document.getElementById('kArtAsk')) return;
    try { if (sessionStorage.getItem('kojoh-art-skip')) return; } catch(e){}
    var d = document.createElement('div');
    d.id = 'kArtAsk'; d.className = 'k-artask';
    d.innerHTML = '<div class="k-artask-box" role="dialog" aria-modal="true" aria-labelledby="kArtAskT">'
      + '<h2 id="kArtAskT">Pick your character</h2>'
      + '<p>Datasets on KOJOH come with a little illustrated character. Which one would you like to see? You can change it any time in Settings.</p>'
      + '<div class="k-artask-row"><button type="button" class="k-btn k-btn-brand" data-a="boy">Boy</button>'
      + '<button type="button" class="k-btn k-btn-brand" data-a="girl">Girl</button></div>'
      + '<button type="button" class="k-artask-skip" data-a="skip">Not now</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'skip') { try { sessionStorage.setItem('kojoh-art-skip', '1'); } catch(x){} }
      else window.kojohSetArt(a);
      d.remove();
    });
    var first = d.querySelector('button'); if (first) first.focus();
  }

  window.kojohArtInit = function(){
    var s = window.kojohSupa && window.kojohSupa();
    if (!s) return Promise.resolve();
    return s.auth.getSession().then(function(r){
      var u = r.data && r.data.session && r.data.session.user;
      if (!u) return;
      return s.from('profiles').select('gender, art_pref').eq('id', u.id).maybeSingle().then(function(p){
        if (p.error) return s.from('profiles').select('gender').eq('id', u.id).maybeSingle();
        return p;
      }).then(function(p){
        var g = p && p.data && p.data.gender, pref = p && p.data && p.data.art_pref;
        if (g === 'male') lsSet('boy');
        else if (g === 'female') lsSet('girl');
        else if (g === 'other') { if (pref === 'boy' || pref === 'girl') lsSet(pref); else chooser(); }
        window.kojohApplyArt();
      });
    }).catch(function(){});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ window.kojohArtInit(); window.kojohRefreshBuyer(); window.kojohLoadMe(); });
  else { window.kojohArtInit(); window.kojohRefreshBuyer(); window.kojohLoadMe(); }
})();


// Turn raw database / network errors into plain words for visitors.
// Short, human messages (wrong password and so on) pass through unchanged.
window.kojohFriendly = function(msg){
  var m = String(msg || '');
  if (!m) return 'Something went wrong. Please try again.';
  if (/failed to fetch|network|load failed|timeout|offline/i.test(m)) return "We couldn't connect. Check your internet and try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match.";
  if (/jwt|not authenticated|permission denied|row-level security|not authori[sz]ed/i.test(m)) return 'Please log in again to continue.';
  if (/duplicate key|already exists|unique constraint/i.test(m)) return "That's already been done.";
  if (/schema cache|does not exist|relation|function|column|pgrst|syntax|violates|null value|supabase|\.sql|public\.|[a-z]+_[a-z_]+\(/i.test(m))
    return "This isn't available right now. Please try again in a little while.";
  return m;
};


// Average rating and number of reviews per dataset, loaded once and shown on every card.
(function(){
  var st = document.createElement('style');
  st.textContent = ':root{--k-star:#1F9D55}html[data-theme="dark"]{--k-star:#3DD68C}'
    + '.k-rate{display:flex;align-items:center;gap:.35rem;font-size:.8rem;color:var(--muted);min-height:1.1rem;margin:-.15rem 0 .1rem}'
    + '.k-rate:empty{display:none}.k-rate .s{color:var(--k-star);letter-spacing:.04em}.k-rate .s i{color:var(--line);font-style:normal}.k-rate b{color:var(--text);font-weight:600}';
  (document.head || document.documentElement).appendChild(st);
  window.KOJOH_RATINGS = null;
  window.kojohRateHtml = function(id){
    var r = window.KOJOH_RATINGS && window.KOJOH_RATINGS[id];
    if (!r || !r.review_count) return '';
    var n = Number(r.avg_rating), s = '';
    for (var i = 1; i <= 5; i++) s += i <= Math.round(n) ? '&#9733;' : '<i>&#9733;</i>';
    return '<span class="s" aria-hidden="true">' + s + '</span><b>' + n.toFixed(1) + '</b><span>(' + Number(r.review_count).toLocaleString('en-IN') + ')</span>'
      + '<span class="k-sr" style="position:absolute;left:-9999px">' + n.toFixed(1) + ' out of 5 from ' + r.review_count + ' reviews</span>';
  };
  window.kojohRatings = function(){
    if (window._kRatingsP) return window._kRatingsP;
    var s = window.kojohSupa && window.kojohSupa();
    if (!s) return Promise.resolve({});
    window._kRatingsP = s.from('dataset_review_stats').select('dataset_id, avg_rating, review_count').then(function(r){
      var m = {}; ((r && r.data) || []).forEach(function(x){ m[x.dataset_id] = x; });
      window.KOJOH_RATINGS = m;
      Array.prototype.forEach.call(document.querySelectorAll('[data-rate]'), function(el){ el.innerHTML = window.kojohRateHtml(el.getAttribute('data-rate')); });
      return m;
    }, function(){ return {}; });
    return window._kRatingsP;
  };
  // Cards drawn later (soft navigation, filters) pick the ratings up as they appear.
  try {
    var queued = false;
    new MutationObserver(function(){
      if (!window.KOJOH_RATINGS || queued) return;
      queued = true;
      requestAnimationFrame(function(){
        queued = false;
        Array.prototype.forEach.call(document.querySelectorAll('[data-rate]:empty'), function(el){ var h = window.kojohRateHtml(el.getAttribute('data-rate')); if (h) el.innerHTML = h; });
      });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ window.kojohRatings(); }); else window.kojohRatings();
})();

// Certificates: every paid project, and only these free ones. Keep in sync with supabase/schema-cert-rules.sql.
window.KOJOH_CERT_FREE = ['returns-eating-profit-free'];
window.kojohGivesCert = function (d) { return !!d && (!d.is_free || window.KOJOH_CERT_FREE.indexOf(d.slug) > -1); };

// Tagline shown on every project card that gives a certificate.
window.kojohCertTag = function () {
  return '<div class="k-certtag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>Verified certificate on completion</div>';
};
