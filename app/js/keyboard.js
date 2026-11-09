// The on-screen keyboard. iOS lays it over the page without resizing the page, so anything pinned
// to the bottom would sit hidden behind it. While it's open, --keyboard holds how much of the
// screen's bottom it covers; the HP sheet keeps its buttons just above that (iOS's number pad has
// no Done key, so they're the way out).

export function trackKeyboard() {
  const view = window.visualViewport;
  if (!view) return;
  const update = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
    document.documentElement.style.setProperty('--keyboard', `${covered}px`);
    document.documentElement.classList.toggle('keyboard-open', covered > 0);
  };
  view.addEventListener('resize', update);
  view.addEventListener('scroll', update);
  update();
}
