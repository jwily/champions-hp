// Makes the app launch instantly and work offline, and brings deploys in without mixing versions:
// - Launches are served entirely from a saved copy on the phone, so starting never waits on the
//   network.
// - Each launch (and each return from the background) checks for a new version in the background,
//   past the browser's cache: GitHub Pages lets browsers reuse files for 10 minutes unchecked.
// - Each deploy publishes files.json (tests/tools/manifest.js): every file the app needs, with a
//   SHA-256 fingerprint. A new version is saved only when every file downloads and matches its
//   fingerprint, so a deploy still spreading across GitHub's servers (the new page with the old
//   stylesheet, say) is never saved as a version: it's tried again next time. The manifest also
//   says which files there are, so nothing here lists them.
// - A new version is switched to only when the app launches (the app loads every file at startup),
//   so a running app never mixes old and new files. The page then asks which version it runs;
//   app.js says "App updated" when it changed.

const PREFIX = 'champions-hp-'; // saved versions are caches named champions-hp-<time saved>
const COMPLETE = '__complete__'; // written last: a version without it is unfinished and never used
const CURRENT = 'champions-hp-current'; // which version launches use (kept in a cache: iOS stops idle workers)
const MANIFEST = 'files.json';

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

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fresh = (file) => fetch(new Request(file, { cache: 'no-cache' }));

// Downloads the manifest, then every file in it; if the manifest is new and every file matches its
// fingerprint, saves them all as a new complete version for the next launch. Anything else (offline,
// a missing file, a file from another deploy) changes nothing.
async function checkForUpdate() {
  try {
    const listed = await fresh(MANIFEST);
    if (!listed.ok) return;
    const manifestText = await listed.text();
    const { files } = JSON.parse(manifestText);
    const savedName = await newestComplete();
    if (savedName) {
      const saved = await (await caches.open(savedName)).match(MANIFEST);
      if (saved && (await saved.text()) === manifestText) return; // nothing new
    }
    const downloads = await Promise.all(
      Object.entries(files).map(async ([file, fingerprint]) => {
        const response = await fresh(file);
        if (!response.ok) throw new Error(`${file}: ${response.status}`);
        const bytes = await response.clone().arrayBuffer();
        if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== fingerprint) throw new Error(`${file}: not this deploy's`);
        return [file, response];
      })
    );
    const next = await caches.open(`${PREFIX}${Date.now()}`);
    await Promise.all(downloads.map(([file, response]) => next.put(file, response)));
    await next.put(MANIFEST, new Response(manifestText));
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
