const CACHE = 'glambooth-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u).catch(() => {})))) // tolerant: missing file won't kill install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App navigations: network-first, fall back to cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(nr => { const cp = nr.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return nr; }))
    );
    return;
  }
  // Cross-origin (MediaPipe AR model, etc.): network-first, never block on cache
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});