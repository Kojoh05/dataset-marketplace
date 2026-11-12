const CACHE = 'kojoh-v63';
const ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;               // Supabase, fonts, CDNs: straight to the network
  const fresh = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname) || !/\.[a-z0-9]+$/i.test(url.pathname);
  if (fresh) {
    // Pages, scripts and styles: always try the network first so a deploy shows up on the next load.
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && !res.redirected) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/')))
    );
    return;
  }
  // Images and fonts: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && !res.redirected) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
