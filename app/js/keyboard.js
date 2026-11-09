// The on-screen keyboard. iOS lays it over the page without resizing the page, so anything pinned
// to the bottom would sit hidden behind it. While it's open, --keyboard holds how much of the
// screen's bottom it covers; the HP sheet keeps its buttons just above that (iOS's number pad has
// no Done key, so they're the way out).
//
// A field low on the screen (Hero HP) would be under the keyboard, so iOS scrolls the page to show
// it, then the sheet shrinks and the scroll is undone: the page jolted down and slid back. So the
// sheet makes room as the finger lands, before the field is focused, using the keyboard's height
// from last time (or an estimate the first time): the field is already clear of the keyboard, and
// iOS has nothing to scroll. (Playwright has no touch keyboard: tests/layout.js simulates one.)

const HEIGHT_KEY = 'champions-hp-keyboard'; // the keyboard's last height, in CSS px
const SETTLE_MS = 1000; // how long a guessed height holds while the keyboard comes up

const root = document.documentElement;
let guessUntil = 0; // until then, the sheet keeps the guessed room even if iOS reports no keyboard yet

function remembered() {
  try {
    return Number(localStorage.getItem(HEIGHT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function remember(height) {
  try {
    localStorage.setItem(HEIGHT_KEY, height);
  } catch {
    // storage full or blocked: estimate again next time
  }
}

function makeRoom(height) {
  root.style.setProperty('--keyboard', `${height}px`);
  root.classList.toggle('keyboard-open', height > 0);
}

export function trackKeyboard() {
  const view = window.visualViewport;
  if (!view) return;
  let last = 0;
  const update = () => {
    // The keyboard's height, not counting how far iOS has scrolled the view to show a field low on
    // the screen (subtracting that scroll shrank the sheet too little for the lower field).
    const covered = Math.max(0, Math.round(window.innerHeight - view.height));
    if (covered === 0 && performance.now() < guessUntil) return; // the keyboard is still on its way
    if (covered > 0 && covered !== last) remember(covered);
    last = covered;
    makeRoom(covered);
    // With the sheet shrunk by the whole keyboard, the field is already in view: undo any scroll.
    if (view.offsetTop > 0 || window.scrollY > 0) requestAnimationFrame(() => window.scrollTo(0, 0));
  };
  view.addEventListener('resize', update);
  view.addEventListener('scroll', update);

  // A finger landing on a field. With the keyboard closed, and the field where the keyboard will
  // cover it, make room now. A field it won't cover (Villain HP) waits for the keyboard and changes
  // in one step: a guess, if off, made it change twice. The first time there's nothing remembered,
  // so guess: iOS's number pad and the bar over it take about 42% of the screen (360px of 852 on an
  // iPhone 16 Pro, iOS 26).
  let pressed = null; // the field the finger came down on
  document.addEventListener('touchstart', (e) => {
    pressed = e.target.closest?.('.entry')?.querySelector('input') ?? null;
    if (!pressed || last > 0) return;
    const height = remembered() || Math.round(window.innerHeight * 0.42);
    if (pressed.closest('.entry').getBoundingClientRect().bottom <= window.innerHeight - height) return;
    guessUntil = performance.now() + SETTLE_MS;
    makeRoom(height);
  });
  // On the lift, focus the field the finger came down on ourselves, without scrolling, and cancel
  // the tap's own click: the fields may have moved under the finger (its lift could land on FIGHT!!),
  // and iOS's own focus scrolls toward the field even when it's already in view (going from Villain
  // HP straight to Hero HP slid the page down and back).
  document.addEventListener(
    'touchend',
    (e) => {
      if (!pressed) return;
      e.preventDefault();
      pressed.focus({ preventScroll: true });
      pressed = null;
      if (last > 0) return; // the keyboard was already open: there's no guess to check
      // No keyboard came (a hardware keyboard, say): give the sheet its room back.
      setTimeout(() => {
        if (last > 0) return;
        guessUntil = 0;
        update();
      }, SETTLE_MS);
    },
    { passive: false }
  );
  document.addEventListener('touchcancel', () => {
    if (!pressed) return;
    pressed = null;
    guessUntil = 0;
    update();
  });
  update();
}
