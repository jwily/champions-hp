// The sheet for typing HP: a new game (villain and hero HP, and the mode) or the villain's next
// stage (their HP only).

import { MAX_HP, state, started, newGame, nextStage } from './store.js';
import { $ } from './dom.js';

const sheet = $('#sheet');
const form = $('#sheet-form');
const heroRow = $('#hero-row');
const modeRow = $('#mode-row');
const cancel = $('#sheet-cancel');
const villainInput = $('#villain-input');
const heroInput = $('#hero-input');
const error = $('#sheet-error'); // for screen readers; the panel itself shows the problem

let purpose = 'new'; // 'new' or 'next'
let chosenMode = state.mode; // Standard or Expert, as picked in the sheet

function drawMode() {
  for (const button of modeRow.querySelectorAll('button')) button.setAttribute('aria-pressed', button.dataset.mode === chosenMode);
}

/** forWhat: 'new' (a new game: villain and hero HP) or 'next' (the villain's next stage). */
export function openSheet(forWhat) {
  purpose = forWhat;
  const newGameSheet = purpose === 'new';
  $('#sheet-title').textContent = newGameSheet ? 'NEW GAME' : `STAGE ${state.stage + 1}!!`;
  heroRow.hidden = !newGameSheet;
  modeRow.hidden = !newGameSheet;
  chosenMode = state.mode;
  drawMode();
  heroInput.value = newGameSheet && state.hero ? state.hero.max : '';
  villainInput.value = '';
  cancel.hidden = !started(); // the first game can't be cancelled: there's nothing to go back to
  clearError();
  sheet.hidden = false;
  document.activeElement?.blur(); // nothing focused, not even the button that opened it
}

function closeSheet() {
  sheet.hidden = true;
  document.activeElement?.blur();
}

/** A field's HP, or null if it isn't a whole number from 1 to MAX_HP. */
const read = (input) => {
  const text = input.value.trim();
  return /^\d+$/.test(text) && +text >= 1 && +text <= MAX_HP ? +text : null;
};

// A bad entry: its panel says what's wanted in its own label, and gets the heavy border.
function fail(input) {
  const row = input.closest('.entry');
  const label = $('.narration', row);
  label.textContent = `${label.dataset.label}: 1–${MAX_HP}`;
  row.classList.add('invalid');
  error.textContent = `Enter ${label.dataset.label.replace(/^\w+/, (w) => w.toLowerCase())} from 1 to ${MAX_HP}.`; // "Enter hero HP…"
  input.focus();
}

function clearError() {
  for (const row of sheet.querySelectorAll('.entry')) {
    row.classList.remove('invalid');
    const label = $('.narration', row);
    label.textContent = label.dataset.label;
  }
  error.textContent = '';
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = purpose === 'new' ? [villainInput, heroInput] : [villainInput]; // checked top down
  const bad = fields.find((input) => read(input) === null);
  if (bad) return fail(bad);
  closeSheet();
  if (purpose === 'new') newGame(read(heroInput), read(villainInput), chosenMode);
  else nextStage(read(villainInput));
});

modeRow.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  chosenMode = button.dataset.mode;
  drawMode();
});
for (const input of [villainInput, heroInput]) input.addEventListener('input', clearError);
cancel.addEventListener('click', closeSheet);
