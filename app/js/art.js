// Panel backgrounds drawn in ink: spirals behind the villain (after the swirls on Naruto's first
// chapter title spread) and focus lines fanning up behind the hero. Plain SVG, scaled to cover the panel.

const NS = 'http://www.w3.org/2000/svg';

function svg(viewW, viewH) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
  el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('art');
  return el;
}

function path(d, width) {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('stroke-width', width);
  return p;
}

// An Archimedean spiral from the center out.
function spiral(cx, cy, radius, turns) {
  const steps = Math.round(turns * 48);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const a = (i / 48) * 2 * Math.PI;
    const r = (radius * i) / steps;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
}

export function spirals() {
  const el = svg(300, 200);
  for (const [cx, cy, r, turns, w] of [
    [235, 120, 78, 3.2, 9],
    [95, 38, 44, 2.6, 6],
    [48, 168, 38, 2.4, 5],
    [178, 24, 24, 2, 4],
    [140, 190, 30, 2.2, 4],
  ]) {
    el.append(path(spiral(cx, cy, r, turns), w));
  }
  return el;
}

// A small seeded random, so the hand-drawn irregularity is the same every time.
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Focus lines (集中線) fanning up from below the panel. Kept irregular so they don't read as the
// Rising Sun flag: uneven spacing, each line starting at its own distance from the point they aim
// at (so the middle is hollow and the point is never drawn), each tapering to a point toward it.
export function rays() {
  const el = svg(300, 200);
  const random = seeded(3);
  const [cx, cy, count] = [150, 205, 46];
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (1.02 + 0.96 * ((i + random() * 0.8) / count));
    const r = 70 + random() * 80;
    const w = i % 3 ? 2.2 + random() * 1.6 : 5 + random() * 2; // every third heavier
    const [x1, y1] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x2, y2] = [cx + 300 * Math.cos(a), cy + 300 * Math.sin(a)];
    const [nx, ny] = [(-Math.sin(a) * w) / 2, (Math.cos(a) * w) / 2];
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${(x2 + nx).toFixed(1)} ${(y2 + ny).toFixed(1)}L${(x2 - nx).toFixed(1)} ${(y2 - ny).toFixed(1)}Z`;
  }
  const p = path(d, 0);
  p.classList.add('ink');
  el.append(p);
  return el;
}
