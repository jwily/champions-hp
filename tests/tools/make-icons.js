// Draws the home-screen icon (a paper panel with an inked spiral and "HP", on black) and the plain
// black launch screens, into app/icons/. Run: npm run icons

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ICONS = path.join(__dirname, '..', '..', 'app', 'icons');
const FONT = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'fonts', 'dela-gothic-one.woff2')).toString('base64');
// Launch screen sizes, matching the apple-touch-startup-image links in index.html.
const LAUNCH = ['750x1334', '1125x2436', '1170x2532', '1179x2556', '1206x2622', '828x1792', '1242x2688', '1284x2778', '1290x2796', '1320x2868'];

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

const ICON = `<!doctype html><style>
@font-face { font-family: Dela; src: url(data:font/woff2;base64,${FONT}); }
html, body { margin: 0; background: #000; }
.icon { position: relative; width: 512px; height: 512px; background: #000; }
.panel { position: absolute; inset: 44px; background: #d8d1c1; border: 7px solid #171512; box-shadow: 0 0 0 4px #d8d1c1; overflow: hidden; }
svg { position: absolute; inset: 0; }
.hp { position: absolute; left: 0; right: 0; bottom: 34px; text-align: center; font: 190px/1 Dela; color: #171512;
  -webkit-text-stroke: 18px #d8d1c1; paint-order: stroke; letter-spacing: -6px; }
</style><div class="icon"><div class="panel">
<svg viewBox="0 0 424 424"><path d="${spiral(212, 150, 150, 3.4)}" fill="none" stroke="#b1a998" stroke-width="20" stroke-linecap="round"/></svg>
<div class="hp">HP</div></div></div>`;

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
