// Sound effects: a katakana word lettered beside the number when HP changes. Restrained on purpose,
// like a drawn panel rather than a text effect: one heavy lettering, solid ink for a change of 1 and
// an outlined, larger word for a hold (5 at once), a few gentle tilts, and placement in the gaps the
// number and balloon leave. Fast taps stack up to MAX_AT_ONCE, spread apart.

import { SFX } from './lines.js';

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Where an effect's center may land, as [x from, x to, y from, y to] in % of the panel, and which
// way it's lettered there: across in the wide gaps above and below the numbers, down in the tall
// narrow ones (a vertical word in a wide gap would reach up over the digits). The gaps are the room
// left by the number, the balloon and the corner boxes (checked in tests/layout.js).
const ZONES = {
  villain: [
    [40, 51, 13, 26, 'across'], // above the number, between the balloon and the stage box (~54% on an SE)
    [42, 80, 79, 90, 'across'], // below the number
  ],
  hero: [
    [36, 64, 64, 84, 'across'], // below the number, left of the balloon
    [40, 64, 55, 62, 'down'], // the same gap, standing up (clear of the max, beside the number)
  ],
};

const TILTS = [-8, -4, 0, 5]; // degrees
const BIG = 1.35; // holds are louder
const CANDIDATES = 8; // spots tried for each effect
const MAX_AT_ONCE = 3; // per panel
const SHOW_MS = 1000; // it appears and goes at once: no animation

// A random spot in the panel's zones, as far as it can find from the effects already showing, so a
// burst of taps spreads out rather than piling up. Returns [x, y, vertical].
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

export function soundEffect(panel, side, kind, amount) {
  const big = Math.abs(amount) > 1;
  const [x, y, vertical] = openSpot(panel, side);
  const el = document.createElement('div');
  el.className = ['sfx', big ? 'outlined' : 'solid', vertical && 'vertical'].filter(Boolean).join(' ');
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${x.toFixed(1)}%`;
  el.style.top = `${y.toFixed(1)}%`;
  el.style.setProperty('--tilt', `${pick(TILTS)}deg`);
  el.style.setProperty('--size', big ? BIG : 1);
  // Vertical lettering: "!" and "!!" stay upright, and "…" becomes the vertical ellipsis "︙"
  // (the heavy font draws "…" sideways, hugging the left of the column).
  let word = pick(SFX[kind][big ? 'big' : 'small']);
  if (vertical) word = word.replaceAll('…', '︙');
  for (const part of word.split(/(!+)/).filter(Boolean)) {
    const span = document.createElement('span');
    if (part.startsWith('!')) span.className = 'upright';
    span.textContent = part;
    el.append(span);
  }
  const shown = panel.querySelectorAll(':scope > .sfx');
  if (shown.length >= MAX_AT_ONCE) shown[0].remove();
  panel.append(el);
  setTimeout(() => el.remove(), SHOW_MS);
}
