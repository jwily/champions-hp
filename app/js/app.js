// Startup and drawing. The page is a manga "flashback" page: paper panels on black gutters.

import { state, started, total, change, toggleBoost } from './store.js';
import { VILLAIN_LINES, HERO_LINES, lineFor, SFX } from './lines.js';
import { trackPresses, onHold } from './presses.js';
import { spirals, rays } from './art.js';
import { openSheet } from './sheet.js';
import { trackKeyboard } from './keyboard.js';

const $ = (s, root = document) => root.querySelector(s);

const sides = Object.fromEntries(
  [
    ['villain', VILLAIN_LINES, spirals],
    ['hero', HERO_LINES, rays],
  ].map(([key, lines, art]) => {
    const panel = $(`#${key}`);
    $('.art-wrap', panel).prepend(art());
    return [
      key,
      {
        panel,
        lines,
        num: $('.num', panel),
        max: $('.max', panel),
        line: $('.line', panel),
        sfx: $('.sfx', panel),
        focus: $('.focus', panel),
      },
    ];
  })
);

// Vertical text, with "!!" set side by side inside the column as manga lettering does.
function setVertical(el, text) {
  el.replaceChildren(
    ...text.split(/(!!)/).filter(Boolean).map((part) =>
      part === '!!' ? Object.assign(document.createElement('span'), { className: 'upright', textContent: part }) : part
    )
  );
}

function draw() {
  for (const [key, el] of Object.entries(sides)) {
    const c = state[key];
    if (!c) continue;
    el.num.textContent = c.hp;
    el.max.textContent = `/ ${total(c)}`;
    if (c.up) el.max.append(Object.assign(document.createElement('span'), { className: 'up', textContent: ` (+${c.up})` }));
    setVertical(el.line, lineFor(el.lines, c.hp / total(c)));
    el.panel.classList.toggle('down', c.hp === 0);
  }
  $('#stage-num').textContent = state.stage;
  $('#game-num').textContent = Math.max(1, state.game);
  const seal = $('#seal');
  seal.setAttribute('aria-pressed', state.boost);
  document.body.classList.toggle('boosting', state.boost);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function effect(key, kind) {
  const el = sides[key];
  el.sfx.textContent = pick(SFX[kind]);
  el.sfx.classList.remove('show');
  void el.sfx.offsetWidth; // restart the fade
  el.sfx.classList.add('show');
  if (kind === 'hit' || kind === 'unboost') {
    el.focus.classList.add('flash');
    requestAnimationFrame(() => requestAnimationFrame(() => el.focus.classList.remove('flash')));
    el.panel.classList.remove('shake');
    void el.panel.offsetWidth;
    el.panel.classList.add('shake');
  }
}

// − / +: a tap is 1, a hold 5 (and 5 more each repeat). Fast taps all count: there's no double-tap
// detection, which would misread three quick taps as a double tap and a tap.
trackPresses();
for (const key of document.querySelectorAll('.key')) {
  const side = key.dataset.side;
  const dir = +key.dataset.dir;
  const apply = (n) => {
    const kind = change(side, n * dir);
    if (kind) effect(side, kind);
  };
  key.addEventListener('click', () => apply(1));
  onHold(key, () => apply(5));
}

trackKeyboard();
$('#seal').addEventListener('click', toggleBoost);
$('#set').addEventListener('click', () => openSheet('new'));
$('#next').addEventListener('click', () => openSheet('next'));

document.addEventListener('hp:change', draw);
draw();
if (!started()) openSheet('new');

// Show the page once the fonts are in (or after a moment, whichever comes first).
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() =>
  document.body.classList.remove('starting')
);

// ---------- Updates ----------
// New versions download in the background (sw.js) and run from the next launch. The first launch
// running a new one says "App updated" briefly, in a caption over the running head, as Bgt-J does.
// iOS mostly resumes the app rather than relaunching it, so coming back from the background checks
// for a new version too.

const VERSION_KEY = 'champions-hp-app-version'; // the version the last launch ran (sw.js names them)
const NOTICE_MS = 4000;
let noticeTimer = null;

function notice(text) {
  const node = $('#notice');
  node.textContent = text;
  node.hidden = false;
  $('.running').hidden = true;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(endNotice, NOTICE_MS);
}

function endNotice() {
  clearTimeout(noticeTimer);
  noticeTimer = null;
  $('#notice').hidden = true;
  $('.running').hidden = false;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (noticeTimer) endNotice(); // not a stale message hours later
    return;
  }
  navigator.serviceWorker?.controller?.postMessage('check-for-update');
});

// The service worker lets the app open offline. It only registers on HTTPS or localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { version } = event.data ?? {};
    if (!version) return;
    let seen;
    try {
      seen = localStorage.getItem(VERSION_KEY);
      if (seen === version) return;
      localStorage.setItem(VERSION_KEY, version);
    } catch {
      return; // storage full or blocked: rather say nothing than say it at every launch
    }
    if (seen) notice('App updated');
  });
  navigator.serviceWorker.controller?.postMessage('which-version');
}
