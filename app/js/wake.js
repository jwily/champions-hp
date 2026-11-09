// Keeping the screen awake. A game is played with the phone lying on the table: the screen
// shouldn't lock between turns. The Screen Wake Lock keeps it on while the app is showing. iOS drops
// it whenever the app goes to the background, so it's asked for again on every return, and on a tap
// in case it needs one first. Where it isn't available or is refused (Low Power Mode, say), the
// phone locks as usual.

let wakeLock = null;

async function stayAwake() {
  if (wakeLock || document.hidden || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
  } catch {
    // Refused for now: tried again on the next tap or return.
  }
}

export function keepAwake() {
  stayAwake();
  document.addEventListener('pointerdown', stayAwake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', stayAwake);
}
