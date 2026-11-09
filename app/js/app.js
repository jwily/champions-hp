// Startup and drawing. The page is a manga "flashback" page: paper panels on black gutters.

import { state, started, total, change, toggleBoost, togglePower, won, MAX_HP, STAGES } from './store.js';
import { VILLAIN_LINES, HERO_LINES, HERO_WIN, lineFor } from './lines.js';
import { soundEffect } from './sfx.js';
import { trackPresses, onHold } from './presses.js';
import { spirals, rays } from './art.js';
import { openSheet } from './sheet.js';
import { trackKeyboard } from './keyboard.js';
import { $, make } from './dom.js';

const SIDES = [
  ['villain', 'Villain', VILLAIN_LINES, spirals],
  ['hero', 'Hero', HERO_LINES, rays],
];

const sides = Object.fromEntries(
  SIDES.map(([key, name, lines, art]) => {
    const panel = $(`#${key}`);
    $('.art-wrap', panel).prepend(art());
    return [
      key,
      {
        name,
        panel,
        lines,
        num: $('.num', panel),
        max: $('.max', panel),
        line: $('.line', panel),
        focus: $('.focus', panel),
        status: $('.status', panel),
        minus: $(`.key[data-side="${key}"][data-dir="-1"]`),
        plus: $(`.key[data-side="${key}"][data-dir="1"]`),
      },
    ];
  })
);

// Vertical text, with "!" and "!!" set upright inside the column as manga lettering does.
function setVertical(el, text) {
  el.replaceChildren(...text.split(/(!+)/).filter(Boolean).map((part) => (part.startsWith('!') ? make('span', 'upright', part) : part)));
}

function draw() {
  for (const [key, el] of Object.entries(sides)) {
    const c = state[key];
    if (!c) continue;
    el.num.textContent = c.hp;
    el.max.textContent = `/ ${total(c)}`;
    if (c.up) el.max.append(make('span', 'up', ` (+${c.up})`));
    el.status.textContent = `${el.name} ${c.hp} of ${total(c)}`;
    setVertical(el.line, lineFor(el.lines, c.hp / total(c)));
    el.panel.classList.toggle('down', c.hp === 0);
    // A key that can't change anything right now shows faint (it stays pressable: nothing happens).
    const [canLower, canRaise] = state.boost ? [c.up > 0, total(c) < MAX_HP] : [c.hp > 0, c.hp < total(c)];
    el.minus.classList.toggle('inert', !canLower);
    el.plus.classList.toggle('inert', !canRaise);
  }
  $('#power').setAttribute('aria-pressed', state.powerUsed);
  $('#power').setAttribute('aria-label', state.powerUsed ? 'Special ability used (sealed)' : 'Special ability ready');
  // On the villain's last stage, Next stage is just a caption: "Final stage", not pressable.
  const final = state.stage >= STAGES[state.mode].at(-1);
  $('#next').disabled = final;
  $('#next').textContent = final ? 'Final stage' : 'Next stage ▸';
  // The villain's last stage is down: VICTORY!!! where Next stage was, and the hero cheers.
  const victory = won();
  sides.villain.panel.classList.toggle('won', victory);
  $('#next').hidden = victory;
  if (victory) {
    setVertical(sides.hero.line, HERO_WIN);
    sides.villain.status.textContent = 'Villain defeated: you win';
  }
  $('#stage-num').textContent = state.stage;
  $('#game-num').textContent = Math.max(1, state.game);
  $('#seal').setAttribute('aria-pressed', state.boost);
  document.body.classList.toggle('boosting', state.boost);
}

const SHAKE = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-4px, 2px)' },
  { transform: 'translate(3px, -2px)' },
  { transform: 'translate(-2px, 1px)' },
  { transform: 'translate(0, 0)' },
];

function effect(key, kind, amount) {
  const el = sides[key];
  soundEffect(el.panel, key, kind, amount);
  if (kind === 'hit' || kind === 'unboost') {
    el.focus.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' }); // focus lines
    el.panel.animate(SHAKE, { duration: 220 });
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
    if (kind) effect(side, kind, n);
  };
  key.addEventListener('click', () => apply(1));
  onHold(key, () => apply(5));
}

trackKeyboard();
$('#seal').addEventListener('click', toggleBoost);
$('#power').addEventListener('click', () => {
  $('#power').classList.add('tapped'); // the seal slaps on when tapped, not at launch
  togglePower();
});
$('#set').addEventListener('click', () => openSheet('new'));
$('#next').addEventListener('click', () => openSheet('next'));

document.addEventListener('hp:change', draw);
draw();
if (!started()) openSheet('new');

// Show the page once the fonts are in, or after FONT_WAIT_MS at most. (index.html also shows it
// after 2.5 s by itself, in case this script never runs.)
const FONT_WAIT_MS = 1500;
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, FONT_WAIT_MS))]).then(() =>
  document.body.classList.remove('starting')
);

// ---------- Updates ----------
// New versions download in the background (sw.js) and run from the next launch. The first launch
// running a new one says "App updated" briefly, in a caption over the running head. iOS mostly
// resumes the app rather than relaunching it, so coming back from the background checks too.

const VERSION_KEY = 'champions-hp-app-version'; // the version the last launch ran (sw.js names them)
const NOTICE_MS = 4000;
let noticeTimer = null;

function notice(text) {
  $('#notice').textContent = text;
  $('#notice').hidden = false;
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
