// The game's state: one JSON object in localStorage. Every change goes through a function here,
// which saves and fires `hp:change`; app.js redraws on that event.

const KEY = 'champions-hp';
const VERSION = 2;
export const MAX_HP = 99;
export const MAX_ABILITIES = 2; // limited abilities tracked per period
export const PERIODS = ['round', 'phase'];

// round and phase: where the game is (a round is the player phase, then the villain phase; Rules
// Reference p. 4). abilities: how many of the hero's "Limit/Max 1 per round" and "per phase"
// abilities to track (kept between games); used: which of them have been used this period.
function fresh() {
  return {
    version: VERSION,
    game: 0,
    stage: 1,
    boost: false,
    hero: null,
    villain: null,
    round: 1,
    phase: 'player',
    abilities: { round: 0, phase: 0 },
    used: { round: [], phase: [] },
  };
}

// Older saved shapes, upgraded one version at a time.
const MIGRATIONS = {
  1: (s) => ({ ...s, version: 2, round: 1, phase: 'player', abilities: { round: 0, phase: 0 }, used: { round: [], phase: [] } }),
};

const validSide = (c) =>
  c === null ||
  (c && [c.hp, c.max, c.up].every(Number.isInteger) && c.hp >= 0 && c.max >= 1 && c.up >= 0);

const validCount = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_ABILITIES;

function load() {
  try {
    let saved = JSON.parse(localStorage.getItem(KEY));
    while (saved && MIGRATIONS[saved.version]) saved = MIGRATIONS[saved.version](saved);
    if (
      saved &&
      saved.version === VERSION &&
      validSide(saved.hero) &&
      validSide(saved.villain) &&
      PERIODS.every((p) => validCount(saved.abilities?.[p]) && Array.isArray(saved.used?.[p]))
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

const clearUsed = (...periods) => periods.forEach((p) => (state.used[p] = []));

/** abilities: { round, phase } counts to track; left out, the last game's are kept. */
export function newGame(heroHp, villainHp, abilities = state.abilities) {
  state.game += 1;
  state.stage = 1;
  state.boost = false;
  state.hero = side(heroHp);
  state.villain = side(villainHp);
  state.round = 1;
  state.phase = 'player';
  state.abilities = { ...abilities };
  clearUsed(...PERIODS);
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

/** Marks a tracked ability used, or unused again (a mistap). */
export function toggleUsed(period, index) {
  state.used[period][index] = !state.used[period][index];
  save();
}

/** Player phase → villain phase → the next round's player phase. Per-phase abilities come back at
 * every step; per-round ones when a new round starts. */
export function nextPhase() {
  if (state.phase === 'player') {
    state.phase = 'villain';
    clearUsed('phase');
  } else {
    state.round += 1;
    state.phase = 'player';
    clearUsed(...PERIODS);
  }
  save();
}

/** One step back, for a mistap (what was marked used stays cleared). */
export function previousPhase() {
  if (state.phase === 'villain') state.phase = 'player';
  else if (state.round > 1) {
    state.round -= 1;
    state.phase = 'villain';
  } else return;
  save();
}
