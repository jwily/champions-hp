// Offline support: every app file is saved on install and served from that copy, so the app opens
// instantly with no connection. A deploy changes VERSION, which makes the phone download the new
// files in the background; they're used from the next launch.
// Add any new app file to FILES (a test checks).

const VERSION = 1;
const CACHE = `champions-hp-v${VERSION}`;
const FILES = [
  './',
  'style.css',
  'manifest.json',
  'js/app.js',
  'js/art.js',
  'js/lines.js',
  'js/press.js',
  'js/sheet.js',
  'js/store.js',
  'fonts/dela-gothic-one.woff2',
  'fonts/zen-antique.woff2',
  'fonts/OFL.txt',
  'icons/icon-180.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('champions-hp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches
      .match(event.request, { ignoreSearch: true })
      .then((hit) => hit || fetch(event.request))
  );
});
