// Sound effects: a katakana word lettered beside the number when HP changes. Restrained on purpose,
// like a drawn panel rather than a text effect: one heavy lettering, solid ink for a change of 1 and
// an outlined, larger word for a hold (5 at once), a few gentle tilts, and placement in the gaps the
// number and balloon leave. Fast taps stack up to MAX_AT_ONCE, spread apart.

import { SFX } from './lines.js';

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Words and tilts are dealt like a shuffled deck, so they feel random rather than being random
// (true randomness gives streaks: the same word three times in a row about one run in nine). Each
// list is dealt in a shuffled order, every item once before any comes back, and a new round never
// starts with the item the last one ended on. (Positions get the same treatment differently: see
// openSpot.)
const bags = new Map(); // list -> { left: items still to deal this round, last: the last dealt }

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function deal(list) {
  const bag = bags.get(list) ?? { left: [], last: undefined };
  if (!bag.left.length) {
    bag.left = shuffle([...list]);
    if (bag.left.length > 1 && bag.left[0] === bag.last) bag.left.push(bag.left.shift()); // no repeat across the seam
  }
  bag.last = bag.left.shift();
  bags.set(list, bag);
  return bag.last;
}

// Where an effect's center may land, as [x from, x to, y from, y to] in % of the panel: the wide
// gaps the number, the balloon and the corner boxes leave (checked in tests/layout.js). Effects are
// always lettered across (the user's choice), varied by their tilt.
const ZONES = {
  villain: [
    [40, 51, 13, 26], // above the number, between the balloon and the stage box (~54% on an SE)
    [42, 80, 79, 90], // below the number
  ],
  hero: [
    [36, 64, 56, 84], // below the number, left of the balloon
  ],
};

const TILTS = [-8, -4, 0, 5]; // degrees
const BIG = 1.35; // holds are louder
const CANDIDATES = 8; // spots tried for each effect
const MAX_AT_ONCE = 3; // per panel
const SHOW_MS = 1000; // it appears and goes at once: no animation

// A random spot in the panel's zones, as far as it can find from the effects already showing
// (best of CANDIDATES tries), so a burst of taps spreads out rather than piling up. Returns [x, y].
function openSpot(panel, side) {
  const showing = [...panel.querySelectorAll(':scope > .sfx')].map((e) => [parseFloat(e.style.left), parseFloat(e.style.top)]);
  let best = null;
  let bestRoom = -1;
  for (let i = 0; i < CANDIDATES; i++) {
    const [x0, x1, y0, y1] = pick(ZONES[side]);
    const spot = [rand(x0, x1), rand(y0, y1)];
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
  const [x, y] = openSpot(panel, side);
  const el = document.createElement('div');
  el.className = `sfx ${big ? 'outlined' : 'solid'}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${x.toFixed(1)}%`;
  el.style.top = `${y.toFixed(1)}%`;
  el.style.setProperty('--tilt', `${deal(TILTS)}deg`);
  el.style.setProperty('--size', big ? BIG : 1);
  el.textContent = deal(SFX[kind][big ? 'big' : 'small']);
  const shown = panel.querySelectorAll(':scope > .sfx');
  if (shown.length >= MAX_AT_ONCE) shown[0].remove();
  panel.append(el);
  setTimeout(() => el.remove(), SHOW_MS);
}
