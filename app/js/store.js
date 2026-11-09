// The game's state: one JSON object in localStorage. Every change goes through a function here,
// which saves and fires `hp:change`; app.js redraws on that event.

const KEY = 'champions-hp';
const VERSION = 3;
export const MAX_HP = 99;

// powerUsed: the hero's 術 ("jutsu") toggle, for a special ability the player has to remember using.
function fresh() {
  return { version: VERSION, game: 0, stage: 1, boost: false, hero: null, villain: null, powerUsed: false };
}

// Older saved shapes, upgraded to this one. Version 2 also tracked rounds, phases and limited
// abilities, since replaced by the single 術 toggle.
const MIGRATIONS = {
  1: (s) => ({ ...s, version: 3, powerUsed: false }),
  2: ({ round, phase, abilities, used, ...s }) => ({ ...s, version: 3, powerUsed: false }),
};

const validSide = (c) =>
  c === null ||
  (c && [c.hp, c.max, c.up].every(Number.isInteger) && c.hp >= 0 && c.max >= 1 && c.up >= 0);

function load() {
  try {
    let saved = JSON.parse(localStorage.getItem(KEY));
    while (saved && MIGRATIONS[saved.version]) saved = MIGRATIONS[saved.version](saved);
    if (
      saved &&
      saved.version === VERSION &&
      validSide(saved.hero) &&
      validSide(saved.villain) &&
      typeof saved.powerUsed === 'boolean'
    ) {
      return { ...fresh(), ...saved };
    }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return fresh();
}

export const state = load(); // after load's helpers: they're consts

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep playing from memory.
  }
  document.dispatchEvent(new Event('hp:change'));
}

const side = (max) => ({ hp: max, max, up: 0 });

/** Maximum hit points right now: printed value plus any "+X hit points" in effect. */
export const total = (c) => c.max + c.up;

export const started = () => state.hero !== null && state.villain !== null;

export function newGame(heroHp, villainHp) {
  state.game += 1;
  state.stage = 1;
  state.boost = false;
  state.hero = side(heroHp);
  state.villain = side(villainHp);
  state.powerUsed = false;
  save();
}

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
