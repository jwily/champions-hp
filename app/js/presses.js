// Presses: every tap on the app's own controls, and holds on the − / + keys. The rules below are
// lessons from Bgt-J (~/projects/budget-tracker/app/js/presses.js), learned there on the phone.
// Not taken: Bgt-J sends a tap in the gap between controls to the nearest one. Between − and + that
// would be a guess at the sign, so a tap in the gutter does nothing.
//
// A press activates what it started on (by calling its click()) when it lifts still over it, the
// same for touch, pen and mouse. The browser's own click for a press never counts: iOS decides by
// itself whether and where to send one (none once the thumb has strayed, a late one after a
// gesture), so it's cancelled at the source (touchend, which also stops double-tap zoom) and stopped
// if it comes anyway. Clicks from the keyboard or from code carry no click count, and go through.
// Fields and labels (NATIVE) are left to the browser: iOS needs its own tap to focus them. Each
// finger is tracked on its own, so overlapping taps (two thumbs, or fast tapping) each count.
// Give controls ordinary `click` listeners and nothing else; don't add click-timing workarounds.

const PRESSABLE = 'button, [role=button]';
const NATIVE = 'input, textarea, select, label';

export const HOLD_MS = 450; // a press held this long is a hold, not a tap
export const REPEAT_MS = 550; // a held key repeats this often
const HOLD_SLOP = 10; // px a held finger can drift before the hold is called off

const presses = new Map(); // pointerId -> { target, used, x, y }

// What a press landing on `hit` is for: the control it's on, else what it landed on.
const pressTarget = (hit) => hit.closest?.(PRESSABLE) ?? hit;

// As a native tap would: a field being typed in loses focus (closing the keyboard) when a control
// is pressed, unless the control belongs to the same form (Fight keeps the field's value either way).
function activate(target) {
  if (!target || target.disabled || !target.matches(PRESSABLE)) return;
  const field = document.activeElement;
  if (field?.matches('input, textarea') && !target.closest('form')?.contains(field)) field.blur();
  target.click();
}

const native = (node) => node?.closest?.(NATIVE);

export function trackPresses() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || native(event.target)) return;
      const target = pressTarget(event.target);
      presses.set(event.pointerId, { target, used: false, x: event.clientX, y: event.clientY });
      if (target.matches?.(PRESSABLE)) target.classList.add('pressed');
      target.dispatchEvent(new CustomEvent('press:start', { detail: event.pointerId }));
    },
    { capture: true }
  );
  document.addEventListener(
    'pointermove',
    (event) => {
      const press = presses.get(event.pointerId);
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > HOLD_SLOP) {
        press.target.dispatchEvent(new CustomEvent('press:drift', { detail: event.pointerId }));
      }
    },
    { capture: true }
  );
  const end = (event, lifted) => {
    const press = presses.get(event.pointerId);
    if (!press) return;
    presses.delete(event.pointerId);
    press.target.dispatchEvent(new CustomEvent('press:end', { detail: event.pointerId }));
    if (![...presses.values()].some((p) => p.target === press.target)) press.target.classList?.remove('pressed');
    if (!lifted || press.used) return;
    const over = document.elementFromPoint(event.clientX, event.clientY);
    if (over && pressTarget(over) === press.target) activate(press.target);
  };
  document.addEventListener('pointerup', (event) => end(event, true), { capture: true });
  document.addEventListener('pointercancel', (event) => end(event, false), { capture: true });

  // The browser's own click for a press: cancelled at the source, and stopped if it comes anyway.
  // A touch's end goes to the element it started on even if a redraw has since removed it from the
  // page, so it's cancelled on that element itself: that touch's end only, then the listener goes.
  // (In Bgt-J it once stayed, and caught every later touch bubbling up through that element: every
  // field under it stopped taking focus until the app was restarted.)
  document.addEventListener(
    'touchstart',
    (event) => {
      const touched = event.target;
      if (native(touched)) return;
      const done = () => {
        touched.removeEventListener('touchend', cancel);
        touched.removeEventListener('touchcancel', done);
      };
      const cancel = (touchEnd) => {
        if (touchEnd.target !== touched) return; // another touch, inside it, bubbling up
        if (touchEnd.cancelable) touchEnd.preventDefault();
        done();
      };
      touched.addEventListener('touchend', cancel, { passive: false });
      touched.addEventListener('touchcancel', done);
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    'click',
    (event) => {
      if (event.detail > 0 && !native(event.target)) {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    { capture: true }
  );
  document.addEventListener('contextmenu', (event) => {
    if (!native(event.target)) event.preventDefault();
  });
}

/**
 * Press and hold: `step` runs after HOLD_MS and again every REPEAT_MS while held. The press is then
 * used up, so its lift doesn't also tap. Drifting off (or a scroll) calls the hold off.
 */
export function onHold(node, step) {
  const timers = new Map(); // pointerId -> timer
  const stop = (id) => {
    clearTimeout(timers.get(id));
    clearInterval(timers.get(id));
    timers.delete(id);
  };
  node.addEventListener('press:start', ({ detail: id }) => {
    timers.set(
      id,
      setTimeout(() => {
        const press = presses.get(id);
        if (!press) return;
        press.used = true;
        step();
        timers.set(id, setInterval(step, REPEAT_MS));
      }, HOLD_MS)
    );
  });
  node.addEventListener('press:drift', ({ detail: id }) => stop(id));
  node.addEventListener('press:end', ({ detail: id }) => stop(id));
}
