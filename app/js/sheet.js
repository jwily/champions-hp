// The sheet for typing HP: a new game (villain and hero) or the villain's next stage.

import { MAX_HP, state, started, newGame, nextStage } from './store.js';
import { spirals, rays } from './art.js';

const $ = (s) => document.querySelector(s);
const sheet = $('#sheet');
const form = $('#sheet-form');
const heroRow = $('#hero-row');
const heroInput = $('#hero-input');
const villainInput = $('#villain-input');
const error = $('#sheet-error');
let mode = 'new';

// The fields' panels get the main page's art: spirals for the villain, rays for the hero.
const ART = { spirals, rays };
for (const panel of sheet.querySelectorAll('[data-art]')) {
  const wrap = Object.assign(document.createElement('span'), { className: 'art-wrap' });
  wrap.append(ART[panel.dataset.art](), Object.assign(document.createElement('span'), { className: 'tone fade' }));
  panel.prepend(wrap);
}

export const sheetOpen = () => !sheet.hidden;

/** mode: 'new' (hero and villain HP) or 'next' (the villain's next stage). */
export function openSheet(next) {
  mode = next;
  const fresh = mode === 'new';
  $('#sheet-title').textContent = fresh ? 'NEW GAME!!' : `STAGE ${state.stage + 1}!!`;
  heroRow.hidden = !fresh;
  heroInput.value = fresh && state.hero ? state.hero.max : '';
  villainInput.value = '';
  // The first game can't be cancelled: there's nothing to go back to.
  $('#sheet-cancel').hidden = !started();
  clearError();
  sheet.hidden = false;
  document.activeElement?.blur(); // nothing focused (not even the button that opened it): tap a panel to type
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
    if (villain === null) return fail(villainInput, 'villain');
    if (hero === null) return fail(heroInput, 'hero');
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
  error.hidden = false;
  input.focus();
}

function clearError() {
  error.textContent = '';
  error.hidden = true;
}

for (const input of [heroInput, villainInput]) input.addEventListener('input', clearError);
$('#sheet-cancel').addEventListener('click', closeSheet);
