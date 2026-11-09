// Sound effects, lettered like the manga's: hand-drawn katakana that land at an angle wherever there's
// room, never twice the same. Each one picks its own word, spot (which sets whether it's lettered
// down or across), tilt and ink style, and each character gets its own small wobble in size, angle
// and position, as hand-lettering has. Fast taps stack up to MAX_AT_ONCE, spread apart.

import { SFX } from './lines.js';

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Where an effect's center may land, as [x from, x to, y from, y to] in % of the panel, and which
// way it's lettered there: across in the wide gaps above and below the numbers, down in the tall
// narrow ones (a vertical word in a wide gap would reach up over the digits). The gaps are the room
// left by the number, the balloon and the corner boxes (checked in tests/layout.js).
const ZONES = {
  villain: [
    [36, 50, 17, 32, 'across'], // above the number, beside the stage box (it reaches ~54% on an SE)
    [42, 80, 79, 90, 'across'], // below the number
    [35, 39, 30, 62, 'down'], // between the balloon and the number
  ],
  hero: [
    [36, 64, 64, 84, 'across'], // below the number, left of the balloon
    [40, 64, 55, 62, 'down'], // the same gap, standing up
    [59, 67, 14, 42, 'down'], // beside the number, above the balloon
  ],
};

// How each kind of change looks. Styles: solid (ink, paper outline), hollow (paper letters, heavy
// ink outline), speed (slanted, with trailing echoes). Tilt is the most the whole word turns.
const LOOKS = {
  hit: { styles: ['solid', 'solid', 'hollow', 'speed'], tilt: 22, size: 1 },
  heal: { styles: ['hollow', 'hollow', 'solid'], tilt: 8, size: 0.85 },
  boost: { styles: ['solid', 'hollow'], tilt: 6, size: 1, tremble: true },
  unboost: { styles: ['hollow', 'speed'], tilt: 12, size: 0.9 },
};

const CANDIDATES = 8; // spots tried for each effect

// A random spot in the panel's zones, as far as it can find from the effects already showing, so a
// burst of taps spreads out rather than piling up.
function openSpot(panel, side) {
  const showing = [...panel.querySelectorAll(':scope > .sfx')].map((e) => [parseFloat(e.style.left), parseFloat(e.style.top)]);
  let best = null;
  let bestRoom = -1;
  for (let i = 0; i < CANDIDATES; i++) {
    const [x0, x1, y0, y1, way] = pick(ZONES[side]);
    const spot = [rand(x0, x1), rand(y0, y1), way === 'down'];
    const room = Math.min(Infinity, ...showing.map(([x, y]) => Math.hypot(spot[0] - x, spot[1] - y)));
    if (room > bestRoom) {
      best = spot;
      bestRoom = room;
    }
  }
  return best;
}

const BIG = 1.45; // holds (5 at once) are louder
const MAX_AT_ONCE = 3; // per panel

export function soundEffect(panel, side, kind, amount) {
  const look = LOOKS[kind];
  const big = Math.abs(amount) > 1;
  const el = document.createElement('div');
  const [x, y, down] = openSpot(panel, side);
  el.className = ['sfx', pick(look.styles), down && 'vertical', look.tremble && 'tremble'].filter(Boolean).join(' ');
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${x.toFixed(1)}%`;
  el.style.top = `${y.toFixed(1)}%`;
  el.style.setProperty('--tilt', `${rand(-look.tilt, look.tilt).toFixed(1)}deg`);
  el.style.setProperty('--size', ((big ? BIG : 1) * look.size).toFixed(2));
  // Letter by letter; "!!" stays one upright pair in vertical lettering.
  for (const part of pick(SFX[kind][big ? 'big' : 'small']).match(/!!|./gu)) {
    const ch = document.createElement('span');
    ch.className = part === '!!' ? 'ch upright' : 'ch';
    ch.textContent = part;
    ch.style.setProperty('--r', `${rand(-10, 10).toFixed(1)}deg`);
    ch.style.setProperty('--k', rand(0.88, 1.15).toFixed(2));
    ch.style.setProperty('--d', `${rand(-0.08, 0.08).toFixed(2)}em`);
    el.append(ch);
  }
  const shown = panel.querySelectorAll(':scope > .sfx');
  if (shown.length >= MAX_AT_ONCE) shown[0].remove();
  el.addEventListener('animationend', (e) => e.target === el && el.remove());
  panel.append(el);
}
