/* Kairos service worker — the app must work with the phone in flight mode,
 * because the ephemeris is local and there is nothing to fetch anyway.
 */
/* Bump VERSION on every release. A plain cache-first worker with a fixed cache
 * name never delivers an update — the engine files below would be frozen at
 * whatever shipped first. */
var VERSION = '1.0.0';
var CACHE = 'kairos-' + VERSION;
var ASSETS = [
  'index.html',
  'styles.css',
  'manifest.json',
  'vendor/astronomy.browser.min.js',
  'js/astro/ephem.js',
  'js/astro/dignity.js',
  'js/astro/aspects.js',
  'js/astro/hours.js',
  'js/astro/timelords.js',
  'js/election/intents.js',
  'js/election/score.js',
  'js/election/search.js',
  'js/election/worker.js',
  'js/core/db.js',
  'js/core/stats.js',
  'js/core/ics.js',
  'js/core/places.js',
  'js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) {
      return c.add(a).catch(function () { /* a missing optional asset must not block install */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Stale-while-revalidate: answer instantly from cache so the app opens in
 * flight mode, and refresh the entry in the background so the next launch has
 * the new build. Navigations fall back to the shell when offline. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request).then(function (hit) {
        var network = fetch(e.request).then(function (res) {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(function () {
          return hit || (e.request.mode === 'navigate' ? cache.match('index.html') : undefined);
        });
        return hit || network;
      });
    })
  );
});
