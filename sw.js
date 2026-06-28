/* SH Pilot Logbook service worker */
var APP_VERSION = 'v0.6m';
try { importScripts('version.js'); } catch (e) {}
const CACHE = 'logbook-' + APP_VERSION;
const ASSETS = ['./', './index.html', './version.js', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', './lib/jspdf.umd.min.js', './lib/logbook-pdf.js', './lib/roster-sync.js', './lib/airports.js', './lib/font-kr.js'];

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
// Frequently-changing files: always fetch fresh when online (cache only as offline fallback),
// so an upload applies immediately and the cache can never freeze on an old build.
function isFresh(url) {
  return /\/version\.js(\?|$)/.test(url) || /\/lib\/logbook-pdf\.js(\?|$)/.test(url) || /\/lib\/roster-sync\.js(\?|$)/.test(url);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin app assets. Cross-origin (Google APIs, GIS, fonts CDNs) passes straight through.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Network-first: the app HTML + the small frequently-changing scripts.
  if (isHTML(req) || isFresh(req.url)) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(isHTML(req) ? './index.html' : req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || (isHTML(req) ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // Cache-first: large static assets (fonts, jspdf, airports, icons) — versioned by CACHE name.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
