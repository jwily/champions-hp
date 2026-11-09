// Shared test helpers: the web server, opening the app on a phone-sized page, checks, and the
// scenario runner. Each scenario starts a fresh browser context, so scenarios never share state.

const fs = require('fs');
const path = require('path');
const http = require('http');

const APP = path.join(__dirname, '..', 'app');
const PORT = 8766;
const URL = `http://127.0.0.1:${PORT}/`;

// The user's phone is an iPhone 14 Pro; the others bracket it.
const PHONES = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 13 mini': { width: 375, height: 812 },
  'iPhone 14 Pro': { width: 393, height: 852 },
  'iPhone 16 Pro Max': { width: 440, height: 956 },
};

/** Every non-ASCII character in the app's HTML and scripts, leaving out comments. */
function appChars() {
  const files = [path.join(APP, 'index.html'), ...fs.readdirSync(path.join(APP, 'js')).map((f) => path.join(APP, 'js', f))];
  const text = files
    .map((f) =>
      fs
        .readFileSync(f, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
    )
    .join('');
  return [...new Set([...text].filter((c) => c.charCodeAt(0) > 126))];
}

/** Every file the app serves, as paths relative to app/. */
function appFiles(dir = APP) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return appFiles(full);
    return e.name.startsWith('.') ? [] : [path.relative(APP, full)];
  });
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

/**
 * Serves ../app. Options, for tests of updates: port; extra response headers; and
 * change(urlPath, data), which can return different file contents (to simulate a deploy).
 * Resolves to the server; stop it with server.close().
 */
function serve({ port = PORT, headers = {}, change = null } = {}) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new globalThis.URL(req.url, 'http://x').pathname);
    const file = path.join(APP, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
    if (!file.startsWith(APP)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res
        .writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', ...headers })
        .end(change?.(urlPath, data) ?? data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/**
 * Opens the app in a fresh context. `storage` is saved data to start from (an object, or a raw
 * string for corrupt data); `game` is a shortcut for a game in progress.
 */
async function open(browser, { phone = 'iPhone 14 Pro', storage, game, clock = false, url = URL, serviceWorkers = 'block' } = {}) {
  // Service workers are off unless a scenario is about them: they'd serve saved copies between
  // reloads.
  const context = await browser.newContext({
    viewport: PHONES[phone],
    deviceScaleFactor: 3,
    hasTouch: true,
    serviceWorkers,
  });
  if (game) storage = saved(game);
  if (storage !== undefined) {
    const raw = typeof storage === 'string' ? storage : JSON.stringify(storage);
    await context.addInitScript((value) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('champions-hp', value);
        sessionStorage.setItem('seeded', '1');
      }
    }, raw);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.errors = errors;
  // Holds are timed, so scenarios that hold run on a fake clock: real-time checks fail when the
  // machine is busy.
  if (clock) await page.clock.install();
  await page.goto(url);
  await ready(page);
  // Paused, so time moves only when a scenario runs it on: left flowing, it also moves with real
  // time, and a busy machine slipped an extra hold repeat in.
  if (clock) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  return page;
}

async function ready(page) {
  await page.waitForFunction(() => !document.body.classList.contains('starting'));
}

/** Saved data for a game in progress: { hero: [hp, max, up], villain: [...], stage, boost, game }. */
function saved({ hero = [10, 10, 0], villain = [14, 14, 0], stage = 1, boost = false, game = 1 }) {
  const side = ([hp, max, up = 0]) => ({ hp, max, up });
  return { version: 1, game, stage, boost, hero: side(hero), villain: side(villain) };
}

// ---------- Reading and acting on the page ----------

const key = (page, side, dir) => page.locator(`.key[data-side="${side}"][data-dir="${dir === '-' ? -1 : 1}"]`);

async function tap(page, side, dir, times = 1) {
  for (let i = 0; i < times; i++) await key(page, side, dir).click();
}

/** Holds a key for `ms` milliseconds of the page's fake clock (open with `clock: true`). */
async function hold(page, side, dir, ms) {
  const box = await key(page, side, dir).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(ms);
  await page.mouse.up();
}

const read = (page, side) =>
  page.evaluate((s) => {
    const panel = document.getElementById(s);
    return {
      hp: +panel.querySelector('.num').textContent,
      max: panel.querySelector('.max').textContent,
      line: panel.querySelector('.line').textContent,
    };
  }, side);

/** The app's hold timings, read from app/js/presses.js in the page. */
const holdTimes = (page) => page.evaluate(() => import('./js/presses.js').then(({ HOLD_MS, REPEAT_MS }) => ({ HOLD_MS, REPEAT_MS })));

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('champions-hp')));

async function fillSheet(page, { hero, villain }) {
  if (hero !== undefined) await page.fill('#hero-input', String(hero));
  if (villain !== undefined) await page.fill('#villain-input', String(villain));
  await page.click('#sheet-ok');
}

// ---------- Checks and the runner ----------

class CheckFailed extends Error {}

function check(condition, message) {
  if (!condition) throw new CheckFailed(message);
}

// JSON with object keys sorted, so equal() ignores key order.
const canonical = (value) =>
  JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));

function equal(actual, expected, what) {
  check(canonical(actual) === canonical(expected), `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/**
 * Runs `fn(scenario, { engine, browser })`, where scenario(name, async (open) => ...) runs one
 * independent check.
 */
async function scenarios(browser, label, fn, engine) {
  const results = [];
  const only = process.env.ONLY;
  const pending = [];
  await fn((name, body) => {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
    pending.push(
      (async () => {
        const pages = [];
        try {
          await body(async (opts) => {
            const page = await open(browser, opts);
            pages.push(page);
            return page;
          });
          for (const page of pages) check(page.errors.length === 0, `Page errors: ${page.errors.join(' | ')}`);
          results.push([name, null]);
        } catch (e) {
          results.push([name, e]);
        } finally {
          for (const page of pages) await page.context().close();
        }
      })()
    );
  }, { engine, browser });
  await Promise.all(pending);
  const failed = results.filter(([, e]) => e);
  for (const [name, e] of results) {
    console.log(`${e ? '✗' : '✓'} [${label}] ${name}${e ? `\n    ${e instanceof CheckFailed ? e.message : e.stack}` : ''}`);
  }
  return failed.length;
}

module.exports = {
  APP,
  URL,
  PHONES,
  appChars,
  appFiles,
  serve,
  open,
  ready,
  saved,
  key,
  tap,
  hold,
  holdTimes,
  read,
  stored,
  fillSheet,
  check,
  equal,
  scenarios,
};
