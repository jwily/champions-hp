// Startup and drawing. The page is a manga "flashback" page: paper panels on black gutters.

import { state, started, total, change, toggleBoost } from './store.js';
import { VILLAIN_LINES, HERO_LINES, lineFor, SFX } from './lines.js';
import { onPress } from './press.js';
import { spirals, rays } from './art.js';
import { openSheet } from './sheet.js';

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

for (const key of document.querySelectorAll('.key')) {
  const side = key.dataset.side;
  const dir = +key.dataset.dir;
  const apply = (n) => {
    const kind = change(side, n * dir);
    if (kind) effect(side, kind);
  };
  onPress(key, { tap: () => apply(1), hold: () => apply(5) });
}

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

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
