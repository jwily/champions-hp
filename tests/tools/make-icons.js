// Draws the home-screen icon and the plain black launch screens, into app/icons/. Run: npm run icons
// The icon (the user's pick): a manga panel, screentoned, with focus lines converging on its lower
// right corner, where ドン! bursts out over the border into the black gutter. Square and full-bleed:
// iOS rounds the corners itself.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ICONS = path.join(__dirname, '..', '..', 'app', 'icons');
const FONT = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'fonts', 'dela-gothic-one.woff2')).toString('base64');
// Launch screen sizes, matching the apple-touch-startup-image links in index.html.
const LAUNCH = ['750x1334', '1125x2436', '1170x2532', '1179x2556', '1206x2622', '828x1792', '1242x2688', '1284x2778', '1290x2796', '1320x2868'];

// Focus lines (集中線): wedges from a ring around (cx, cy) out past the edges, every fourth heavier.
function focusLines(cx, cy, count, inner) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 2 * Math.PI;
    const r = inner * (0.85 + ((i * 37) % 10) / 40);
    const w = i % 4 ? 0.8 : 2;
    const [x2, y2] = [cx + 120 * Math.cos(a), cy + 120 * Math.sin(a)];
    const [nx, ny] = [-Math.sin(a) * w, Math.cos(a) * w];
    d += `M${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    d += `L${(x2 + nx).toFixed(1)} ${(y2 + ny).toFixed(1)}L${(x2 - nx).toFixed(1)} ${(y2 - ny).toFixed(1)}Z`;
  }
  return d;
}

const ICON = `<!doctype html><style>
@font-face { font-family: Dela; src: url(data:font/woff2;base64,${FONT}); }
html, body { margin: 0; background: #000; }
.icon { position: relative; width: 512px; height: 512px; background: #000; overflow: hidden; }
svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.sfx { position: absolute; left: 53%; top: 61%; transform: translate(-50%, -50%) rotate(-14deg);
  font: 150px/1 Dela; letter-spacing: -0.06em; white-space: nowrap; color: #171512;
  -webkit-text-stroke: 22px #d8d1c1; paint-order: stroke; }
</style><div class="icon">
<svg viewBox="0 0 100 100">
  <defs><pattern id="tone" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".65" fill="#b1a998"/></pattern>
  <clipPath id="panel"><rect x="9" y="9" width="72" height="72"/></clipPath></defs>
  <rect x="8" y="8" width="74" height="74" fill="#d8d1c1" stroke="#171512" stroke-width="2"/>
  <g clip-path="url(#panel)">
    <rect x="9" y="9" width="72" height="72" fill="url(#tone)"/>
    <path d="${focusLines(70, 70, 56, 22)}" fill="#171512" opacity="0.85"/>
  </g>
</svg>
<div class="sfx">ドン!</div></div>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(ICON);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ICONS, 'icon-512.png') });
  const small = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 180 / 512 });
  await small.setContent(ICON);
  await small.evaluate(() => document.fonts.ready);
  await small.screenshot({ path: path.join(ICONS, 'icon-180.png') });
  for (const size of LAUNCH) {
    const [w, h] = size.split('x').map(Number);
    const black = await browser.newPage({ viewport: { width: w, height: h } });
    await black.setContent('<style>html,body{margin:0;background:#000}</style>');
    await black.screenshot({ path: path.join(ICONS, `launch-${size}.png`) });
    await black.close();
  }
  await browser.close();
  console.log('Icons written to app/icons/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
