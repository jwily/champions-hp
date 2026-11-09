// Offline launches and deploys, through the service worker (app/sw.js). Chromium only:
// Playwright's WebKit fails internally when reloading while simulated offline, and its
// service-worker support is partial (a limit of the test browser, not the app; Bgt-J found the same).

const { serve, check, equal, read, ready, tap } = require('./helpers');

// Waits until the newest saved version is complete and its js/lines.js carries `deploy` (any, if
// null); returns the saved versions' names.
const savedVersion = (page, deploy = null) =>
  page.evaluate(async (want) => {
    for (let i = 0; i < 150; i++) {
      // up to 15s: slow when all the test runs share the machine
      const names = (await caches.keys()).filter((n) => /^champions-hp-\d+$/.test(n)).sort();
      const newest = names.length && (await caches.open(names.at(-1)));
      const file = newest && (await newest.match('js/lines.js'));
      if (file && (await newest.match('__complete__')) && (!want || (await file.text()).includes(`deploy: ${want}`))) return names;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, deploy);

module.exports = (scenario, { engine, browser }) => {
  if (engine !== 'chromium') return;

  scenario('opens offline after one visit, with the game as it was', async (open) => {
    const page = await open({ serviceWorkers: 'allow', game: {} });
    await page.evaluate(() => navigator.serviceWorker.ready);
    check(await savedVersion(page), 'A version is saved on the first visit');
    await page.reload(); // now served by the worker
    await ready(page);
    await tap(page, 'villain', '-', 2);
    await page.context().setOffline(true);
    await page.reload();
    await ready(page);
    equal((await read(page, 'villain')).hp, 12, 'Offline: the app opens with the game');
    await tap(page, 'villain', '-');
    equal((await read(page, 'villain')).hp, 11, 'Offline: and works');
  });

  scenario('a deploy arrives on the launch after, and says "App updated" once', async () => {
    let version = 'old';
    const server = await serve({
      port: 8767,
      headers: { 'Cache-Control': 'max-age=600' }, // as GitHub Pages sends
      change: (urlPath, data) => (urlPath === '/js/lines.js' ? `${data}\n// deploy: ${version}\n` : null),
    });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'allow' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const launch = async () => {
        await page.reload();
        await ready(page);
      };
      const running = () => page.evaluate(() => fetch('js/lines.js').then((r) => r.text()).then((t) => t.match(/deploy: (\w+)/)?.[1]));
      const notice = () => page.evaluate(() => (document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent));
      const says = (text) =>
        page
          .waitForFunction((t) => !document.getElementById('notice').hidden && document.getElementById('notice').textContent === t, text, { timeout: 5000 })
          .then(() => true, () => false);

      await page.goto('http://127.0.0.1:8767/');
      await ready(page);
      await page.evaluate(() => navigator.serviceWorker.ready);
      const first = await savedVersion(page, 'old');
      equal(first?.length, 1, 'The first version is saved');
      await launch(); // now served by the worker
      equal(await running(), 'old', 'The first version runs');
      equal(await notice(), '', 'A fresh install says nothing');

      version = 'new';
      await launch(); // served at once from the saved copy; the new version downloads for next time
      equal(await running(), 'old', 'The launch right after a deploy still runs the saved version');
      check(await savedVersion(page, 'new'), 'The new version is saved in the background, past the 10-minute cache');
      equal(await notice(), '', 'Nothing said while it only downloads');

      await launch();
      equal(await running(), 'new', 'The launch after runs it');
      check(await says('App updated'), 'and says "App updated"');
      check(await page.evaluate(() => document.querySelector('.running').hidden), 'The caption takes the running head’s place');
      await page.waitForTimeout(4500); // longer than the notice shows for: the time is the point
      equal(await notice(), '', 'Briefly');
      check(!(await page.evaluate(() => document.querySelector('.running').hidden)), 'The running head comes back');

      const before = await savedVersion(page, 'new');
      await launch();
      equal(await savedVersion(page, 'new'), before, 'A launch with nothing new saves nothing');
      equal(await notice(), '', '...and says nothing');

      version = 'newer';
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // back from the background
      check(await savedVersion(page, 'newer'), 'Coming back from the background finds a new version too');
      equal(await running(), 'new', 'but the open app keeps running its version');
      await launch();
      equal(await running(), 'newer', 'until the next launch');
      check(await says('App updated'), 'which says so');
      equal((await savedVersion(page, 'newer')).length, 1, 'Older versions are dropped at the launch');
      equal(errors, [], 'Page errors');
    } finally {
      await context.close();
      server.close();
    }
  });
};
