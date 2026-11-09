// The on-screen keyboard. iOS lays it over the page without resizing the page, so anything pinned
// to the bottom would sit hidden behind it. While it's open, --keyboard holds how much of the
// screen's bottom it covers; the HP sheet keeps its buttons just above that (iOS's number pad has
// no Done key, so they're the way out).

export function trackKeyboard() {
  const view = window.visualViewport;
  if (!view) return;
  const update = () => {
    // The keyboard's height, not counting how far iOS has scrolled the view to show a field low on
    // the screen (subtracting that scroll shrank the sheet too little for the lower field).
    const covered = Math.max(0, Math.round(window.innerHeight - view.height));
    document.documentElement.style.setProperty('--keyboard', `${covered}px`);
    // With the sheet shrunk by the whole keyboard, the field is already in view: undo iOS's scroll.
    if (view.offsetTop > 0 || window.scrollY > 0) requestAnimationFrame(() => window.scrollTo(0, 0));
    document.documentElement.classList.toggle('keyboard-open', covered > 0);
  };
  view.addEventListener('resize', update);
  view.addEventListener('scroll', update);
  update();
}
