// Draws the home-screen icon and the plain black launch screens, into app/icons/. Run: npm run icons
// The icon (the user's pick): a manga panel, screentoned, with focus lines converging on its lower
// right corner, where ドン! bursts out into the black gutter. The panel runs off the top and left
// edges, a corner of a page rather than a centered square, and has no ink frame: a heavy frame on
// black read as a bevelled tile. Square and full-bleed: iOS rounds the corners itself.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const APP = path.join(__dirname, '..', '..', 'app');
const ICONS = path.join(APP, 'icons');
// Bump this whenever the icon's look changes. iOS keeps its own copy of a home-screen icon, looked up
// by the icon's address, and Add to Home Screen uses that copy over the new file; a new file name is
// the only way past it. The run renames the files and rewrites index.html and manifest.json to match.
const ICON_VERSION = 2;
const iconFile = (size) => `icon-${size}-v${ICON_VERSION}.png`;
const FONT = fs.readFileSync(path.join(APP, 'fonts', 'dela-gothic-one.woff2')).toString('base64');
// Launch screen sizes, matching the apple-touch-startup-image links in index.html (a test checks).
const LAUNCH = ['750x1334', '1125x2436', '1170x2532', '1179x2556', '1206x2622', '828x1792', '1242x2688', '1284x2778', '1290x2796', '1320x2868'];

// A small seeded random, so the irregularity is the same on every run.
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Focus lines (集中線): wedges from around (cx, cy) out past the edges, drawn like the hero panel's
// (js/art.js), irregular so they don't read as the Rising Sun flag: uneven spacing, each starting at
// its own distance (a hollow middle, no meeting point drawn), every third heavier.
function focusLines(cx, cy, count, inner) {
  const random = seeded(5);
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = ((i + random() * 0.8) / count) * 2 * Math.PI;
    const r = inner * (0.75 + random() * 0.9);
    const w = i % 3 ? 0.7 + random() * 0.6 : 1.8 + random() * 0.7;
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
  <clipPath id="panel"><rect width="82" height="82"/></clipPath></defs>
  <rect width="82" height="82" fill="#d8d1c1"/>
  <g clip-path="url(#panel)">
    <rect width="82" height="82" fill="url(#tone)"/>
    <path d="${focusLines(70, 70, 56, 22)}" fill="#171512" opacity="0.85"/>
  </g>
</svg>
<div class="sfx">ドン!</div></div>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(ICON);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ICONS, iconFile(512)) });
  const small = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 180 / 512 });
  await small.setContent(ICON);
  await small.evaluate(() => document.fonts.ready);
  await small.screenshot({ path: path.join(ICONS, iconFile(180)) });
  for (const size of LAUNCH) {
    const [w, h] = size.split('x').map(Number);
    const black = await browser.newPage({ viewport: { width: w, height: h } });
    await black.setContent('<style>html,body{margin:0;background:#000}</style>');
    await black.screenshot({ path: path.join(ICONS, `launch-${size}.png`) });
    await black.close();
  }
  await browser.close();
  // Drop the icons of earlier versions, and point the page and the web app manifest at these.
  for (const file of fs.readdirSync(ICONS)) {
    if (/^icon-\d+(-v\d+)?\.png$/.test(file) && file !== iconFile(180) && file !== iconFile(512)) fs.unlinkSync(path.join(ICONS, file));
  }
  for (const file of ['index.html', 'manifest.json']) {
    const at = path.join(APP, file);
    fs.writeFileSync(at, fs.readFileSync(at, 'utf8').replace(/icons\/icon-(\d+)(-v\d+)?\.png/g, (m, size) => `icons/${iconFile(size)}`));
  }
  console.log('Icons written to app/icons/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
