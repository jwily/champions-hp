// Downloads the app's two fonts from Google Fonts, cut down to just the characters the app uses
// (Google's `text=` subsetting), into app/fonts/. Both are SIL Open Font License fonts.
// Also writes app/fonts/chars.txt, the characters covered; a test checks the app uses no others.
// Run after adding any new text: npm run fonts

const fs = require('fs');
const path = require('path');
const { appChars } = require('../helpers');

const FONTS = [
  ['Dela Gothic One', 'dela-gothic-one.woff2'],
  ['Zen Antique', 'zen-antique.woff2'],
];
const APP = path.join(__dirname, '..', '..', 'app');
// A browser user agent, so Google serves woff2.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

async function main() {
  // Every printable ASCII character too, so numbers and labels never fall back.
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  const chars = [...new Set([...ascii, ...appChars()])].sort().join('');
  for (const [family, file] of FONTS) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(chars)}`;
    const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
    const src = css.match(/url\((https:[^)]+)\)\s*format\('woff2'\)/);
    if (!src) throw new Error(`No woff2 for ${family}:\n${css}`);
    const font = Buffer.from(await (await fetch(src[1])).arrayBuffer());
    fs.writeFileSync(path.join(APP, 'fonts', file), font);
    console.log(`${file}: ${(font.length / 1024).toFixed(1)} KB`);
    await new Promise((r) => setTimeout(r, 500));
  }
  fs.writeFileSync(path.join(APP, 'fonts', 'chars.txt'), chars + '\n');
  console.log(`${chars.length} characters`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
