// Misbaha service worker: fast loads + offline after the first visit.
// Network-first for pages (never serve a stale app), cache-first for static assets.
var VERSION = 'misbaha-v2.0.0';
var STATIC_CACHE = VERSION + '-static';
var STATIC = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './favicon-64.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './fonts/fonts.css',
  './fonts/Amiri-400-arabic.woff2',
  './fonts/Amiri-400-latin.woff2',
  './fonts/Amiri-700-arabic.woff2',
  './fonts/Amiri-700-latin.woff2',
  './fonts/Tajawal-400-arabic.woff2',
  './fonts/Tajawal-400-latin.woff2',
  './fonts/Tajawal-500-arabic.woff2',
  './fonts/Tajawal-500-latin.woff2',
  './fonts/Tajawal-700-arabic.woff2',
  './fonts/Tajawal-700-latin.woff2',
  './fonts/Tajawal-800-arabic.woff2',
  './fonts/Tajawal-800-latin.woff2',
  './reminders.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(function (c) { return c.addAll(STATIC); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k.indexOf(VERSION) !== 0) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Never cache the anonymous visit ping or anything off-origin.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(STATIC_CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(STATIC_CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
