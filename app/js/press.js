// Taps and holds on the − / + keys. A tap changes by 1 when the finger lifts; holding changes by
// 5 after HOLD_MS, then again every REPEAT_MS while held. Rapid taps each count (no double-tap
// detection, so tapping − three times quickly is always 3 damage).

export const HOLD_MS = 450;
export const REPEAT_MS = 550;
const SLOP = 30; // px a finger can drift and still count as the same press

export function onPress(el, { tap, hold }) {
  let timer = null;
  let held = false;
  let start = null;

  const stop = () => {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
    el.classList.remove('pressed');
  };

  const repeat = () => {
    held = true;
    hold();
    timer = setInterval(hold, REPEAT_MS);
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    stop();
    held = false;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('pressed');
    timer = setTimeout(repeat, HOLD_MS);
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) {
      stop();
      start = null;
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const wasHeld = held;
    stop();
    start = null;
    if (!wasHeld) tap();
  });

  el.addEventListener('pointercancel', () => {
    stop();
    start = null;
  });

  // iOS: no double-tap zoom, text selection or callout menu on the keys.
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
