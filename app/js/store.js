// The game's state: one JSON object saved on the phone. Every change goes through a function here,
// which saves and fires `hp:change`; app.js redraws on that event.

import * as storage from './storage.js';

const KEY = 'champions-hp';
const VERSION = 5;
export const MAX_HP = 99;

// Villain stages by mode: Standard plays stages I and II, Expert the scenario's expert stages, II
// and III (Rules Reference v1.8 p. 28). Defeating the last one wins (p. 47).
export const STAGES = { standard: [1, 2], expert: [2, 3] };

// mode: 'standard' or 'expert' (kept between games). powerUsed: the hero's 術 ("jutsu") toggle,
// sealed (true) until released: most heroes have no limited ability to track. villainStart: the
// villain's HP as last typed for a new game, by mode, offered again for the next (one villain is
// often played over and over).
const noVillainStart = () => ({ standard: null, expert: null });

function fresh() {
  return { version: VERSION, game: 0, stage: 1, mode: 'standard', boost: false, hero: null, villain: null, powerUsed: true, villainStart: noVillainStart() };
}

// Older saved shapes, each upgraded one version at a time (a new version adds one step here).
// Version 2 also tracked rounds, phases and limited abilities, since replaced by the single 術
// toggle; version 3 added that toggle, version 4 the mode, version 5 villainStart (a game still on
// its first stage gives its villain's).
const MIGRATIONS = {
  1: (s) => ({ ...s, version: 3, powerUsed: true }),
  2: ({ round, phase, abilities, used, ...s }) => ({ ...s, version: 3, powerUsed: true }),
  3: (s) => ({ ...s, version: 4, mode: 'standard' }),
  4: (s) => {
    const villainStart = noVillainStart();
    if (s.villain && s.stage === STAGES[s.mode]?.[0]) villainStart[s.mode] = s.villain.max;
    return { ...s, version: 5, villainStart };
  },
};

const validHp = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_HP;

const validSide = (c) =>
  c === null ||
  (c && [c.hp, c.max, c.up].every(Number.isInteger) && c.hp >= 0 && c.max >= 1 && c.up >= 0);

const valid = (s) =>
  s?.version === VERSION &&
  Number.isInteger(s.game) &&
  Number.isInteger(s.stage) &&
  typeof s.boost === 'boolean' &&
  typeof s.powerUsed === 'boolean' &&
  s.mode in STAGES &&
  validSide(s.hero) &&
  validSide(s.villain) &&
  Object.keys(STAGES).every((mode) => s.villainStart?.[mode] === null || validHp(s.villainStart?.[mode]));

// The saved game, upgraded to this version, or a fresh one if there's none or it's unreadable.
function restore() {
  try {
    let saved = JSON.parse(storage.load(KEY));
    while (saved && MIGRATIONS[saved.version]) saved = MIGRATIONS[saved.version](saved);
    if (valid(saved)) return saved;
  } catch {
    // Not JSON: start fresh.
  }
  return fresh();
}

export const state = restore(); // after restore's helpers: they're consts

// Saves (if it can't, play carries on from memory) and tells the page to redraw.
function save() {
  storage.save(KEY, JSON.stringify(state));
  document.dispatchEvent(new Event('hp:change'));
}

const side = (max) => ({ hp: max, max, up: 0 });

/** Maximum hit points right now: printed value plus any "+X hit points" in effect. */
export const total = (c) => c.max + c.up;

export const started = () => state.hero !== null && state.villain !== null;

/** The villain is on their last stage for this mode (stage II in Standard, III in Expert). */
export const finalStage = () => state.stage >= STAGES[state.mode].at(-1);

export function newGame(heroHp, villainHp, mode = state.mode) {
  state.game += 1;
  state.mode = mode;
  state.stage = STAGES[mode][0];
  state.boost = false;
  state.hero = side(heroHp);
  state.villain = side(villainHp);
  state.villainStart[mode] = villainHp;
  state.powerUsed = true;
  save();
}

/** The villain's last stage is down: the player wins. */
export const won = () => finalStage() && state.villain?.hp === 0;

export function nextStage(villainHp) {
  state.stage += 1;
  state.boost = false;
  state.villain = side(villainHp);
  save();
}

/**
 * Changes one side by `amount` (negative for damage). With the max-HP toggle on, it changes the
 * "+X hit points" instead: raising it raises max and current HP together, and lowering it lowers
 * both (Rules Reference p. 22), which can defeat the character. Without it, + heals up to the
 * current maximum and − deals damage down to 0 (p. 21).
 * Returns what happened: 'hit', 'heal', 'boost', 'unboost', or null if nothing could change.
 */
export function change(key, amount) {
  const c = state[key];
  if (!c) return null;
  let kind = null;
  if (state.boost) {
    const up = Math.min(MAX_HP - c.max, Math.max(0, c.up + amount));
    const diff = up - c.up;
    if (diff) {
      c.up = up;
      c.hp = Math.max(0, c.hp + diff);
      kind = diff > 0 ? 'boost' : 'unboost';
    }
  } else {
    const hp = Math.min(total(c), Math.max(0, c.hp + amount));
    if (hp !== c.hp) {
      kind = hp < c.hp ? 'hit' : 'heal';
      c.hp = hp;
    }
  }
  if (kind) save();
  return kind;
}

export function toggleBoost() {
  state.boost = !state.boost;
  save();
}

export function togglePower() {
  state.powerUsed = !state.powerUsed;
  save();
}
