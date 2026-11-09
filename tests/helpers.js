// Shared test helpers: the web server, opening the app on a phone-sized page, checks, and the
// scenario runner. Each scenario starts a fresh browser context, so scenarios never share state.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

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

function serve() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', APP], {
    stdio: 'ignore',
  });
  const up = () =>
    new Promise((resolve) => {
      http.get(URL, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
    });
  return (async () => {
    for (let i = 0; i < 50; i++) {
      if (await up()) return server;
      await new Promise((r) => setTimeout(r, 100));
    }
    server.kill();
    throw new Error('The test server did not start');
  })();
}

/**
 * Opens the app in a fresh context. `storage` is saved data to start from (an object, or a raw
 * string for corrupt data); `game` is a shortcut for a game in progress.
 */
async function open(browser, { phone = 'iPhone 14 Pro', storage, game, clock = false } = {}) {
  const context = await browser.newContext({
    viewport: PHONES[phone],
    deviceScaleFactor: 3,
    hasTouch: true,
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
  await page.goto(URL);
  await ready(page);
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

function equal(actual, expected, what) {
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

/** Runs `fn(scenario)`, where scenario(name, async (open) => ...) runs one independent check. */
async function scenarios(browser, label, fn) {
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
  });
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
  read,
  stored,
  fillSheet,
  check,
  equal,
  scenarios,
};
