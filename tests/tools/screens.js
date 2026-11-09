// Screenshots the app on each phone size in a few states, into tests/output/screens/.
// Run: npm run screens  (WebKit, Safari's engine)

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
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
