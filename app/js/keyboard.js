// The on-screen keyboard. iOS lays it over the page without resizing the page (a lesson from
// Bgt-J's keyboard.js), so anything pinned to the bottom would sit hidden behind it. While it's
// open, --keyboard holds how much of the screen's bottom it covers; the HP sheet keeps its
// Cancel / FIGHT!! row just above that, under the thumb (iOS's number pad has no Done key).

export function trackKeyboard() {
  const view = window.visualViewport;
  if (!view) return;
  const update = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
    document.documentElement.style.setProperty('--keyboard', `${covered}px`);
  };
  view.addEventListener('resize', update);
  view.addEventListener('scroll', update);
  update();
}
