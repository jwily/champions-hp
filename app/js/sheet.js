// The sheet for typing HP: a new game (hero and villain) or the villain's next stage.

import { MAX_HP, state, started, newGame, nextStage } from './store.js';

const $ = (s) => document.querySelector(s);
const sheet = $('#sheet');
const form = $('#sheet-form');
const heroRow = $('#hero-row');
const heroInput = $('#hero-input');
const villainInput = $('#villain-input');
const error = $('#sheet-error');
let mode = 'new';

export const sheetOpen = () => !sheet.hidden;

/** mode: 'new' (hero and villain HP) or 'next' (the villain's next stage). */
export function openSheet(next) {
  mode = next;
  const fresh = mode === 'new';
  $('#sheet-title').textContent = fresh ? 'NEW GAME!!' : `STAGE ${state.stage + 1}!!`;
  $('#villain-label').textContent = fresh ? 'Villain HP' : `Villain HP, stage ${state.stage + 1}`;
  $('#sheet-ok').textContent = fresh ? 'Fight' : 'Next stage';
  heroRow.hidden = !fresh;
  heroInput.value = fresh && state.hero ? state.hero.max : '';
  villainInput.value = '';
  // The first game can't be cancelled: there's nothing to go back to.
  $('#sheet-cancel').hidden = !started();
  error.textContent = '';
  sheet.hidden = false;
  // Focus inside the tap that opened the sheet, so iOS brings up the keyboard.
  (fresh && !heroInput.value ? heroInput : villainInput).focus();
}

export function closeSheet() {
  sheet.hidden = true;
  document.activeElement?.blur();
}

const read = (input) => {
  const text = input.value.trim();
  return /^\d{1,2}$/.test(text) && +text >= 1 && +text <= MAX_HP ? +text : null;
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const villain = read(villainInput);
  if (mode === 'new') {
    const hero = read(heroInput);
    if (hero === null) return fail(heroInput, 'hero');
    if (villain === null) return fail(villainInput, 'villain');
    closeSheet();
    newGame(hero, villain);
  } else {
    if (villain === null) return fail(villainInput, 'villain');
    closeSheet();
    nextStage(villain);
  }
});

function fail(input, who) {
  error.textContent = `Enter ${who} HP from 1 to ${MAX_HP}.`;
  input.focus();
}

for (const input of [heroInput, villainInput]) {
  input.addEventListener('input', () => (error.textContent = ''));
}
$('#sheet-cancel').addEventListener('click', closeSheet);
