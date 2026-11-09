// Makes the app launch instantly and work offline, and brings deploys in without mixing versions.
// Lessons from Bgt-J's sw.js, simplified for an app that loads every file at startup:
// - Launches are served entirely from a saved copy on the phone, so starting never waits on the
//   network.
// - Each launch (and each return from the background) downloads the files again in the background,
//   past the browser's cache: GitHub Pages lets browsers reuse files for 10 minutes unchecked.
// - A version is saved only when every file arrived (marked complete last), and only if some file's
//   bytes changed, so nothing needs bumping on a deploy.
// - A new version is switched to only when the app launches, so a running app never mixes old and
//   new files. The page then asks which version it runs; app.js says "App updated" when it changed.
// Add any new app file to FILES (a test checks).

const PREFIX = 'champions-hp-'; // saved versions are caches named champions-hp-<time saved>
const COMPLETE = '__complete__'; // written last: a version without it is unfinished and never used
const CURRENT = 'champions-hp-current'; // which version launches use (kept in a cache: iOS stops idle workers)
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'js/app.js',
  'js/art.js',
  'js/keyboard.js',
  'js/lines.js',
  'js/presses.js',
  'js/sfx.js',
  'js/sheet.js',
  'js/store.js',
  'fonts/dela-gothic-one.woff2',
  'fonts/zen-antique.woff2',
  'fonts/OFL.txt',
  'icons/icon-180.png',
  'icons/icon-512.png',
];

const versions = async () => (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== CURRENT).sort();

async function newestComplete() {
  for (const name of (await versions()).reverse()) {
    if (await (await caches.open(name)).match(COMPLETE)) return name;
  }
  return null;
}

async function current() {
  const saved = await (await caches.open(CURRENT)).match('name');
  const name = saved && (await saved.text());
  return name && (await caches.has(name)) ? name : null;
}

// At a launch: switch to the newest complete version, and drop older ones.
async function switchAtLaunch() {
  const newest = await newestComplete();
  if (!newest) return current();
  if (newest !== (await current())) await (await caches.open(CURRENT)).put('name', new Response(newest));
  for (const name of await versions()) if (name < newest) await caches.delete(name);
  return newest;
}

const sameBytes = (a, b) => {
  if (a.byteLength !== b.byteLength) return false;
  const [x, y] = [new Uint8Array(a), new Uint8Array(b)];
  return x.every((byte, i) => byte === y[i]);
};

// Downloads every file; if all arrived and any differs from the newest saved version, saves them as
// a new complete version for the next launch. A failure (offline, say) changes nothing.
async function checkForUpdate() {
  try {
    const downloads = await Promise.all(
      FILES.map(async (file) => {
        const response = await fetch(new Request(file, { cache: 'no-cache' }));
        if (!response.ok) throw new Error(`${file}: ${response.status}`);
        return [file, response];
      })
    );
    const savedName = await newestComplete();
    if (savedName) {
      const saved = await caches.open(savedName);
      let changed = false;
      for (const [file, response] of downloads) {
        const old = await saved.match(file);
        if (!old || !sameBytes(await old.arrayBuffer(), await response.clone().arrayBuffer())) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
    }
    const next = await caches.open(`${PREFIX}${Date.now()}`);
    await Promise.all(downloads.map(([file, response]) => next.put(file, response)));
    await next.put(COMPLETE, new Response('ok'));
  } catch {
    // Keep what's saved; try again next launch.
  }
}

// One check at a time; a request during one runs another right after (it may predate a deploy).
let updating = null;
let checkAgain = false;
function update() {
  if (updating) {
    checkAgain = true;
    return updating;
  }
  updating = (async () => {
    do {
      checkAgain = false;
      await checkForUpdate();
    } while (checkAgain);
    updating = null;
  })();
  return updating;
}

self.addEventListener('install', (event) => {
  // The first install saves a version before taking over, so the next launch can open offline.
  event.waitUntil(update().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Caches from the first release (champions-hp-v1) aren't versions this worker made.
      for (const name of await caches.keys()) if (/^champions-hp-v\d+$/.test(name)) await caches.delete(name);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'check-for-update') event.waitUntil(update());
  if (event.data === 'which-version') event.waitUntil(current().then((version) => event.source.postMessage({ version })));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const launching = event.request.mode === 'navigate';
  event.respondWith(
    (async () => {
      const name = launching ? await switchAtLaunch() : await current();
      const saved = name && (await caches.open(name));
      return (await saved?.match(event.request, { ignoreSearch: true })) ?? fetch(event.request);
    })()
  );
  if (launching) event.waitUntil(update());
});
