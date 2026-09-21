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
