// Screenshots the app on each phone size in a few states, the page and the HP sheet (typing too,
// with a simulated keyboard), into tests/output/screens/. Run: npm run screens  (WebKit, Safari's
// engine). Taken before and after a change that shouldn't look different, they should match.

const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');
const { serve, open, PHONES } = require('../helpers');

const OUT = path.join(__dirname, '..', 'output', 'screens');
const STATES = {
  start: { hero: [10, 10], villain: [14, 14] },
  wide: { hero: [99, 90, 9], villain: [99, 99], stage: 3, boost: true },
  low: { hero: [2, 11], villain: [0, 15], stage: 2 },
};
const KEYBOARD = 360; // iOS 26's number pad and the bar over it, on an iPhone 16 Pro
// The sheet: which one opens, and whether a field is being typed in.
const SHEETS = {
  'new game': { button: '#set' },
  'new game, typing': { button: '#set', typing: '#villain-input' },
  'next stage': { button: '#next' },
  'next stage, typing': { button: '#next', typing: '#villain-input' },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await webkit.launch();
  try {
    for (const phone of Object.keys(PHONES)) {
      for (const [name, game] of Object.entries(STATES)) {
        const page = await open(browser, { phone, game });
        await page.waitForTimeout(300); // let the start-up fade-in finish
        await page.screenshot({ path: path.join(OUT, `${phone} - ${name}.png`) });
        await page.context().close();
      }
      for (const [name, { button, typing }] of Object.entries(SHEETS)) {
        const page = await open(browser, { phone, game: STATES.start });
        await page.click(button);
        if (typing) {
          await page.evaluate(([h, field]) => {
            testing.keyboard(h);
            document.querySelector(field).focus({ preventScroll: true });
          }, [KEYBOARD, typing]);
        }
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(OUT, `${phone} - ${name}.png`) });
        await page.context().close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
