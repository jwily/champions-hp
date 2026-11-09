// Panel backgrounds drawn in ink: spirals behind the villain (after the swirls on Naruto's first
// chapter title spread) and radiating lines behind the hero. Plain SVG, scaled to cover the panel.

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

export function rays() {
  const el = svg(300, 200);
  const count = 34;
  let thin = '';
  let thick = '';
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (i / (count - 1)) * Math.PI;
    const seg = `M150 200L${(150 + 420 * Math.cos(a)).toFixed(1)} ${(200 + 420 * Math.sin(a)).toFixed(1)}`;
    if (i % 3) thin += seg;
    else thick += seg;
  }
  el.append(path(thin, 1), path(thick, 2.2));
  return el;
}
