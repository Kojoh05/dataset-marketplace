// KOJOH global config
window.KOJOH_VERSION = '0.3.0';

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

window.kojohMoney = function(d){
  if (!d) return '';
  return d.is_free || !Number(d.price) ? 'Free' : '&#8377;' + Number(d.price).toFixed(0);
};

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
  var h = '<a class="k-dscard' + (opts.reveal ? ' k-reveal' : '') + '" href="dataset.html?slug=' + encodeURIComponent(d.slug) + '">';
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
  h += '<p class="k-dscard-desc">' + esc(d.short_description || '') + '</p>';
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
    : /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i;
  var hint = document.createElement('p');
  hint.className = 'chal-submit-hint';
  input.parentNode.appendChild(hint);
  function check(final){
    var v = input.value.trim();
    var ok = re.test(v);
    input.classList.toggle('ok', ok);
    input.classList.toggle('bad', !!v && !ok && final);
    hint.textContent = ok ? 'Looks good.'
      : (v && final ? (kind === 'github' ? 'Use the repo link, like https://github.com/you/project' : 'Use the post link, like https://www.linkedin.com/posts/...') : '');
    hint.className = 'chal-submit-hint' + (ok ? ' ok' : (v && final ? ' bad' : ''));
  }
  input.addEventListener('input', function(){ check(false); });
  input.addEventListener('blur', function(){ check(true); });
};
