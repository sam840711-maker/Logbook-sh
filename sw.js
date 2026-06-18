/* SH Pilot Logbook service worker */
const CACHE = 'logbook-v0-3x';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', './lib/jspdf.umd.min.js', './lib/logbook-pdf.js', './lib/airports.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0 || /\.html(\?|$)/.test(req.url);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTML (the app itself): network-first so updates show immediately; cache only as offline fallback.
  if (isHTML(req)) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Static libs/icons: cache-first (they are versioned by CACHE name).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
