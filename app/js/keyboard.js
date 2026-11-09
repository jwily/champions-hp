// The on-screen keyboard, and taps on the HP sheet's fields.
//
// iOS lays the keyboard over the page without resizing the page, so anything pinned to the bottom
// would sit hidden behind it. While it's open, --keyboard holds how much of the screen's bottom it
// covers (and the root has .keyboard-open); the HP sheet keeps its buttons just above that (iOS's
// number pad has no Done key, so they're the way out).
//
// iOS also scrolls the page to show a field it focuses, even one already in view, and the app then
// scrolls back: the page slid down and back up. So the app focuses the fields itself, without
// scrolling, and a field the keyboard will cover (Hero HP) gets its room as the finger lands, from
// the keyboard's height last time, so it's already clear when the keyboard comes. (Playwright has
// no touch keyboard: tests/helpers.js simulates one.)

import * as storage from './storage.js';

const FIELD = '.entry'; // the HP sheet's field panels: a label holding its input
const HEIGHT_KEY = 'champions-hp-keyboard'; // the keyboard's last height, in CSS px
// The first time there's no height saved: iOS's number pad and the bar over it take about 42% of
// the screen (360px of 852 on an iPhone 16 Pro, iOS 26).
const FIRST_GUESS = 0.42;
const SETTLE_MS = 1000; // how long room made ahead of the keyboard waits for it to come

const root = document.documentElement;
let reported = 0; // the keyboard's height as iOS last reported it (0: closed)
let guessUntil = 0; // until then, room made ahead of the keyboard holds even if iOS reports none yet

const guessing = () => performance.now() < guessUntil;

/** The sheet has made room for the keyboard (it's open, or on its way). */
export const keyboardOpen = () => root.classList.contains('keyboard-open');

function makeRoom(height) {
  root.style.setProperty('--keyboard', `${height}px`);
  root.classList.toggle('keyboard-open', height > 0);
}

// What iOS reports: the keyboard's height, not counting how far iOS has scrolled the view to show
// a field (subtracting that scroll shrank the sheet too little for the lower field).
function measure() {
  const view = window.visualViewport;
  const height = Math.max(0, Math.round(window.innerHeight - view.height));
  if (height === 0 && guessing()) return; // the keyboard is still on its way
  if (height > 0 && height !== reported) storage.save(HEIGHT_KEY, height);
  reported = height;
  makeRoom(height);
  // With the sheet shrunk by the whole keyboard, the field is already in view: undo any scroll.
  if (view.offsetTop > 0 || window.scrollY > 0) requestAnimationFrame(() => window.scrollTo(0, 0));
}

// Room made ahead of the keyboard that it doesn't need any more: back to what iOS reports.
function dropGuess() {
  guessUntil = 0;
  measure();
}

// With the keyboard closed, room for it now if it will cover `field` once it comes. A field it
// won't cover (Villain HP) waits for the keyboard and changes in one step: a guess, if off, made it
// change twice.
function makeRoomAhead(field) {
  if (reported > 0) return;
  const height = Number(storage.load(HEIGHT_KEY)) || Math.round(window.innerHeight * FIRST_GUESS);
  if (field.getBoundingClientRect().bottom <= window.innerHeight - height) return;
  guessUntil = performance.now() + SETTLE_MS;
  makeRoom(height);
}

export function trackKeyboard() {
  if (!window.visualViewport) return;
  window.visualViewport.addEventListener('resize', measure);
  window.visualViewport.addEventListener('scroll', measure);

  let pressed = null; // the field the finger came down on
  document.addEventListener('touchstart', (e) => {
    const field = e.target.closest?.(FIELD);
    pressed = field?.querySelector('input') ?? null;
    if (pressed) makeRoomAhead(field);
  });
  // On the lift, the app focuses that field itself, without scrolling, and cancels the tap's own
  // click: the fields may have moved under the finger (its lift could land on FIGHT!!). What's in
  // the field is selected, so typing replaces it (a field offers last game's HP, and holds 2 digits).
  document.addEventListener(
    'touchend',
    (e) => {
      if (!pressed) return;
      e.preventDefault();
      pressed.focus({ preventScroll: true });
      pressed.select();
      pressed = null;
      // If no keyboard comes (a hardware keyboard, say), the sheet gets its room back.
      if (guessing()) setTimeout(() => reported === 0 && dropGuess(), SETTLE_MS);
    },
    { passive: false }
  );
  document.addEventListener('touchcancel', () => {
    if (!pressed) return;
    pressed = null;
    dropGuess();
  });
  measure();
}
