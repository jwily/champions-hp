// The sheet for typing HP: a new game (villain and hero) or the villain's next stage.

import { MAX_HP, PERIODS, state, started, newGame, nextStage } from './store.js';
import { spirals, rays } from './art.js';
import { $, make } from './dom.js';

const sheet = $('#sheet');
const form = $('#sheet-form');
const heroRow = $('#hero-row');
const heroInput = $('#hero-input');
const villainInput = $('#villain-input');
const error = $('#sheet-error'); // for screen readers; the panel itself shows the problem
let mode = 'new';
let abilities = { round: 0, phase: 0 }; // the counts chosen in the sheet

function drawAbilityChoice() {
  for (const group of sheet.querySelectorAll('.setup-group')) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', +button.dataset.count === abilities[group.dataset.period]);
    }
  }
}
for (const group of sheet.querySelectorAll('.setup-group')) {
  group.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    abilities[group.dataset.period] = +button.dataset.count;
    drawAbilityChoice();
  });
}

// The fields' panels get the main page's art: spirals for the villain, rays for the hero.
const ART = { spirals, rays };
for (const panel of sheet.querySelectorAll('[data-art]')) {
  const wrap = make('span', 'art-wrap');
  wrap.append(ART[panel.dataset.art](), make('span', 'tone fade'));
  panel.prepend(wrap);
}

/** mode: 'new' (hero and villain HP) or 'next' (the villain's next stage). */
export function openSheet(next) {
  mode = next;
  const fresh = mode === 'new';
  $('#sheet-title').textContent = fresh ? 'NEW GAME!!' : `STAGE ${state.stage + 1}!!`;
  heroRow.hidden = !fresh;
  $('#abilities-row').hidden = !fresh;
  abilities = Object.fromEntries(PERIODS.map((p) => [p, state.abilities[p]]));
  drawAbilityChoice();
  heroInput.value = fresh && state.hero ? state.hero.max : '';
  villainInput.value = '';
  // The first game can't be cancelled: there's nothing to go back to.
  $('#sheet-cancel').hidden = !started();
  clearError();
  sheet.hidden = false;
  document.activeElement?.blur(); // nothing focused, not even the button that opened it
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
    newGame(hero, villain, abilities);
  } else {
    if (villain === null) return fail(villainInput, 'villain');
    closeSheet();
    nextStage(villain);
  }
});

// A bad entry: its panel says what's wanted in its own label, and gets the heavy border.
function fail(input, who) {
  const row = input.closest('.entry');
  const label = $('.narration', row);
  label.textContent = `${label.dataset.label}: 1–${MAX_HP}`;
  row.classList.add('invalid');
  error.textContent = `Enter ${who} HP from 1 to ${MAX_HP}.`;
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

for (const input of [heroInput, villainInput]) input.addEventListener('input', clearError);
$('#sheet-cancel').addEventListener('click', closeSheet);
