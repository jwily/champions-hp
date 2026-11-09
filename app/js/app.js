// The game page: a manga "flashback" page, paper panels on black gutters. Builds the two sides,
// draws them from the store's state on every change, and wires up the controls.

import { state, started, total, change, toggleBoost, togglePower, won, finalStage, MAX_HP } from './store.js';
import { VILLAIN_LINES, HERO_LINES, HERO_WIN, lineFor } from './lines.js';
import { soundEffect } from './sfx.js';
import { trackPresses, onHold } from './presses.js';
import { drawArt } from './art.js';
import { openSheet } from './sheet.js';
import { trackKeyboard } from './keyboard.js';
import { keepAwake } from './wake.js';
import { watchForUpdates } from './updates.js';
import { $, make } from './dom.js';

// Each side's panel and keys, and its balloon lines (the villain's depend on the stage).
const LINES = {
  villain: () => VILLAIN_LINES[finalStage() ? 'final' : 'first'],
  hero: () => HERO_LINES,
};

const sides = Object.fromEntries(
  Object.entries(LINES).map(([key, lines]) => {
    const panel = $(`#${key}`);
    return [
      key,
      {
        name: panel.getAttribute('aria-label'),
        panel,
        lines,
        num: $('.num', panel),
        max: $('.max', panel),
        line: $('.line', panel),
        status: $('.status', panel),
        minus: $(`.key[data-side="${key}"][data-dir="-1"]`),
        plus: $(`.key[data-side="${key}"][data-dir="1"]`),
      },
    ];
  })
);

const power = $('#power');
const next = $('#next');
const seal = $('#seal');

// Vertical text: "!" and "!!" set upright inside the column as manga lettering does, and a new
// column wherever the line marks a break ("\n", between phrases).
function setVertical(el, text) {
  el.replaceChildren(
    ...text
      .split(/(!+|\n)/)
      .filter(Boolean)
      .map((part) => (part === '\n' ? document.createElement('br') : part.startsWith('!') ? make('span', 'upright', part) : part))
  );
}

function drawSide(el, c) {
  el.num.textContent = c.hp;
  el.max.textContent = `/ ${total(c)}`;
  if (c.up) el.max.append(make('span', 'up', ` (+${c.up})`));
  el.status.textContent = `${el.name} ${c.hp} of ${total(c)}`;
  setVertical(el.line, lineFor(el.lines(), c.hp / total(c)));
  el.panel.classList.toggle('down', c.hp === 0);
  // A key that can't change anything right now shows faint (it stays pressable: nothing happens).
  const [canLower, canRaise] = state.boost ? [c.up > 0, total(c) < MAX_HP] : [c.hp > 0, c.hp < total(c)];
  el.minus.classList.toggle('inert', !canLower);
  el.plus.classList.toggle('inert', !canRaise);
}

function draw() {
  for (const [key, el] of Object.entries(sides)) if (state[key]) drawSide(el, state[key]);
  power.setAttribute('aria-pressed', state.powerUsed);
  power.setAttribute('aria-label', state.powerUsed ? 'Special ability used (sealed)' : 'Special ability ready');
  // On the villain's last stage, Next stage is just a caption: "Final stage", not pressable.
  next.disabled = finalStage();
  next.textContent = finalStage() ? 'Final stage' : 'Next stage ▸';
  // The villain's last stage is down: VICTORY!!! where Next stage was, and the hero cheers.
  const victory = won();
  sides.villain.panel.classList.toggle('won', victory);
  next.hidden = victory;
  if (victory) {
    setVertical(sides.hero.line, HERO_WIN);
    sides.villain.status.textContent = 'Villain defeated: you win';
  }
  $('#stage-num').textContent = state.stage;
  $('#game-num').textContent = Math.max(1, state.game);
  seal.setAttribute('aria-pressed', state.boost);
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
  // Only a hit shakes the panel: a heal, or max HP changing (フッ…, something fading), isn't an
  // impact. (No focus-line flash: it fought the hero's own lines, the user's call.)
  if (kind === 'hit') el.panel.animate(SHAKE, { duration: 220 });
}

// − / +: a tap is 1, a hold 5 (and 5 more each repeat). Fast taps all count: there's no double-tap
// detection, which would misread three quick taps as a double tap and a tap.
for (const key of document.querySelectorAll('.key')) {
  const { side } = key.dataset;
  const dir = Number(key.dataset.dir);
  const apply = (n) => {
    const kind = change(side, n * dir);
    if (kind) effect(side, kind, n);
  };
  key.addEventListener('click', () => apply(1));
  onHold(key, () => apply(5));
}

seal.addEventListener('click', toggleBoost);
power.addEventListener('click', () => {
  power.classList.add('tapped'); // the seal slaps on when tapped, not at launch
  togglePower();
});
$('#set').addEventListener('click', () => openSheet('new'));
next.addEventListener('click', () => openSheet('next'));
document.addEventListener('hp:change', draw);

// ---------- Startup ----------

trackPresses();
trackKeyboard();
keepAwake();
watchForUpdates();
drawArt();
draw();
if (!started()) openSheet('new');

// Show the page once the fonts are in, or after FONT_WAIT_MS at most. (index.html also shows it
// after 2.5 s by itself, in case this script never runs.)
const FONT_WAIT_MS = 1500;
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, FONT_WAIT_MS))]).then(() =>
  document.body.classList.remove('starting')
);
