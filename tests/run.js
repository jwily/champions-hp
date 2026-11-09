// Runs the test passes on WebKit (Safari's engine) and Chromium, all at once.
//   npm test                 every pass on both engines
//   npm test -- webkit       one engine
//   npm test -- webkit main  one engine, one pass
//   ONLY=hold npm test       only scenarios whose name contains "hold"

const playwright = require('playwright');
const { serve, scenarios } = require('./helpers');

const PASSES = { main: require('./main'), layout: require('./layout'), updates: require('./updates') };
const ENGINES = ['webkit', 'chromium'];

async function main() {
  const args = process.argv.slice(2);
  const engines = ENGINES.filter((e) => !args.some((a) => ENGINES.includes(a)) || args.includes(e));
  const passes = Object.keys(PASSES).filter((p) => !args.some((a) => a in PASSES) || args.includes(p));
  const server = await serve();
  let failed = 0;
  try {
    await Promise.all(
      engines.map(async (engine) => {
        const browser = await playwright[engine].launch();
        try {
          for (const pass of passes) failed += await scenarios(browser, `${engine} ${pass}`, PASSES[pass], engine);
        } finally {
          await browser.close();
        }
      })
    );
  } finally {
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
