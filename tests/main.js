// Behavior: starting a game, taps and holds, the max-HP seal, stages, saving.

const fs = require('fs');
const path = require('path');
const { APP, appChars, appFiles, key, tap, hold, holdTimes, read, stored, fillSheet, check, equal, ready } = require('./helpers');

module.exports = (scenario) => {
  scenario('first launch asks for HP and can’t be cancelled', async (open) => {
    const page = await open();
    check(await page.isVisible('#sheet'), 'The new-game sheet shows on first launch');
    check(!(await page.isVisible('#sheet-cancel')), 'No Cancel before the first game');
    equal(await page.evaluate(() => document.activeElement === document.body), true, 'Nothing focused when the sheet opens');
    const [villainTop, heroTop] = await page.evaluate(() => ['#villain-input', '#hero-input'].map((s) => document.querySelector(s).getBoundingClientRect().top));
    check(villainTop < heroTop, 'Villain HP above hero HP, as on the page');
    await fillSheet(page, { hero: '', villain: 14 });
    equal(await page.textContent('#sheet-error'), 'Enter hero HP from 1 to 99.', 'Empty hero HP');
    await fillSheet(page, { hero: 0, villain: 14 });
    equal(await page.textContent('#sheet-error'), 'Enter hero HP from 1 to 99.', 'Zero hero HP');
    await fillSheet(page, { hero: 10, villain: 'x' });
    equal(await page.textContent('#sheet-error'), 'Enter villain HP from 1 to 99.', 'Bad villain HP');
    await fillSheet(page, { hero: 10, villain: 14 });
    check(!(await page.isVisible('#sheet')), 'The sheet closes');
    equal(await read(page, 'hero'), { hp: 10, max: '/ 10', line: 'いくぞ!!' }, 'Hero');
    equal(await read(page, 'villain'), { hp: 14, max: '/ 14', line: 'フン…' }, 'Villain');
    equal(await page.textContent('#stage-num'), '1', 'Stage');
    equal(await page.textContent('#game-num'), '1', 'Game number');
  });

  scenario('taps change HP by 1, heals stop at max, damage stops at 0', async (open) => {
    const page = await open({ game: { hero: [3, 10], villain: [14, 14] } });
    await tap(page, 'villain', '-');
    equal((await read(page, 'villain')).hp, 13, 'Villain after one hit');
    equal((await read(page, 'villain')).line, '小癪な!!', 'Villain line when hurt');
    await tap(page, 'villain', '+', 3);
    equal((await read(page, 'villain')).hp, 14, 'Heals stop at max');
    await tap(page, 'hero', '-', 3);
    equal((await read(page, 'hero')).hp, 0, 'Three quick taps are 3 damage');
    await tap(page, 'hero', '-');
    equal((await read(page, 'hero')).hp, 0, 'Damage stops at 0');
    equal((await read(page, 'hero')).line, '………', 'Hero line at 0');
  });

  scenario('holding changes by 5, then 5 more each repeat', async (open) => {
    const page = await open({ clock: true, game: { villain: [30, 30] } });
    const { HOLD_MS, REPEAT_MS } = await holdTimes(page);
    await hold(page, 'villain', '-', HOLD_MS + 100);
    equal((await read(page, 'villain')).hp, 25, 'One hold step, and no extra 1 on release');
    await hold(page, 'villain', '-', HOLD_MS + REPEAT_MS * 2 + 100);
    equal((await read(page, 'villain')).hp, 10, 'A longer hold repeats');
    await hold(page, 'villain', '+', HOLD_MS + 100);
    equal((await read(page, 'villain')).hp, 15, 'Holding + heals 5');
    await hold(page, 'villain', '-', HOLD_MS - 100);
    equal((await read(page, 'villain')).hp, 14, 'Letting go before the hold time is a tap');
  });

  scenario('the 増 seal changes max HP, raising and lowering both together', async (open) => {
    const page = await open({ game: { hero: [7, 10] } });
    await page.click('#seal');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'true', 'Seal on');
    await tap(page, 'hero', '+', 3);
    equal(await read(page, 'hero'), { hp: 10, max: '/ 13(+3)', line: 'まだまだ!!' }, '+3 hit points');
    await tap(page, 'hero', '-');
    equal(await read(page, 'hero'), { hp: 9, max: '/ 12(+2)', line: 'まだまだ!!' }, 'Lowering it lowers HP too');
    await page.click('#seal');
    await tap(page, 'hero', '+', 5);
    equal((await read(page, 'hero')).hp, 12, 'Heals reach the raised max');
    await tap(page, 'hero', '-', 11);
    await page.click('#seal');
    await tap(page, 'hero', '-', 2);
    equal(await read(page, 'hero'), { hp: 0, max: '/ 10', line: '………' }, 'Losing the +2 at 1 HP defeats the hero');
    await tap(page, 'hero', '-');
    equal((await read(page, 'hero')).max, '/ 10', 'Can’t go below the printed max');
  });

  scenario('next stage asks for the villain’s new HP and resets the seal', async (open) => {
    const page = await open({ game: { villain: [1, 14, 2], boost: true } });
    await page.click('#seal');
    await tap(page, 'villain', '-');
    equal((await read(page, 'villain')).line, 'バ…バカな…!!', 'Villain line at 0');
    check(await page.$eval('#villain', (p) => p.classList.contains('down')), 'Next stage beckons at 0');
    await page.click('#next');
    equal(await page.textContent('#sheet-title'), 'STAGE 2!!', 'Sheet title');
    check(!(await page.isVisible('#hero-row')), 'Only the villain’s HP is asked');
    await page.click('#sheet-cancel');
    check(!(await page.isVisible('#sheet')), 'Cancel closes it');
    equal(await page.textContent('#stage-num'), '1', 'Still stage 1 after Cancel');
    await page.click('#seal');
    await page.click('#next');
    await fillSheet(page, { villain: 15 });
    equal(await read(page, 'villain'), { hp: 15, max: '/ 15', line: 'フン…' }, 'Stage 2 villain');
    equal(await page.textContent('#stage-num'), '2', 'Stage 2');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'false', 'Seal off for the new stage');
    equal((await read(page, 'hero')).hp, 10, 'Hero untouched');
  });

  scenario('New game mid-game starts a new game', async (open) => {
    const page = await open({ game: { hero: [4, 11], villain: [3, 15], stage: 2, game: 3 } });
    await page.click('#set');
    check(await page.isVisible('#sheet-cancel'), 'Cancel available mid-game');
    equal(await page.evaluate(() => document.activeElement === document.body), true, 'Nothing focused when New game opens the sheet');
    equal(await page.inputValue('#hero-input'), '11', 'Hero HP filled in from the last game');
    await fillSheet(page, { villain: 12 });
    equal(await read(page, 'hero'), { hp: 11, max: '/ 11', line: 'いくぞ!!' }, 'Hero reset');
    equal((await read(page, 'villain')).hp, 12, 'Villain');
    equal(await page.textContent('#stage-num'), '1', 'Back to stage 1');
    equal(await page.textContent('#game-num'), '4', 'Game number counts up');
  });

  scenario('everything is saved and survives a relaunch', async (open) => {
    const page = await open({ game: {} });
    await tap(page, 'villain', '-', 4);
    await page.click('#seal');
    await tap(page, 'hero', '+', 2);
    equal(
      await stored(page),
      { version: 3, game: 1, stage: 1, boost: true, hero: { hp: 12, max: 10, up: 2 }, villain: { hp: 10, max: 14, up: 0 }, powerUsed: false },
      'Saved data'
    );
    await page.reload();
    await ready(page);
    equal((await read(page, 'villain')).hp, 10, 'Villain after relaunch');
    equal((await read(page, 'hero')).max, '/ 12(+2)', 'Hero after relaunch');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'true', 'Seal after relaunch');
    check(!(await page.isVisible('#sheet')), 'No sheet when a game is saved');
  });

  scenario('unreadable saved data starts fresh', async (open) => {
    for (const storage of ['{not json', { version: 1, hero: { hp: 'x' }, villain: null }, { version: 99 }]) {
      const page = await open({ storage });
      check(await page.isVisible('#sheet'), `Fresh start for ${JSON.stringify(storage)}`);
    }
  });

  scenario('sound effects stack up to three, and holds get the big outlined ones', async (open) => {
    const page = await open({ clock: true, game: { villain: [40, 40] } });
    const { HOLD_MS } = await holdTimes(page);
    const effects = () =>
      page.$$eval('#villain > .sfx', (list) =>
        list.map((e) => ({ text: e.textContent, classes: e.className, tilt: e.style.getPropertyValue('--tilt') }))
      );
    const { SMALL, BIG } = await page.evaluate(() => import('./js/lines.js').then(({ SFX }) => ({ SMALL: SFX.hit.small, BIG: SFX.hit.big })));
    await tap(page, 'villain', '-');
    let shown = await effects();
    equal(shown.length, 1, 'One effect per tap');
    check(SMALL.includes(shown[0].text), `A small hit word: ${shown[0].text}`);
    check(/\bsfx solid\b/.test(shown[0].classes), `Solid ink for a change of 1: ${shown[0].classes}`);
    // Four quick taps (clicks from code, all at once).
    await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.key[data-side="villain"][data-dir="-1"]').click(); });
    shown = await effects();
    equal(shown.length, 3, 'Fast taps stack, three at most');
    const shakes = await page.evaluate(() => {
      document.querySelector('.key[data-side="villain"][data-dir="-1"]').click();
      return document.getElementById('villain').getAnimations().length > 0; // read at once: it's brief
    });
    check(shakes, 'The panel shakes on a hit');
    await hold(page, 'villain', '-', HOLD_MS + 50);
    shown = await effects();
    check(BIG.includes(shown.at(-1).text) && /\boutlined\b/.test(shown.at(-1).classes), `A hold gets a big, outlined word: ${JSON.stringify(shown.at(-1))}`);
    check(await page.$eval('#villain > .sfx', (e) => e.getAnimations().length === 0), 'No animation: they appear at once');
    await page.clock.runFor(900);
    check((await effects()).length > 0, 'and stay a moment');
    await page.clock.runFor(1200);
    equal((await effects()).length, 0, 'then go at once');
  });

  scenario('raising max HP doesn’t move the number', async (open) => {
    const page = await open({ game: {} });
    const tops = () => page.evaluate(() => ['villain', 'hero'].map((s) => Math.round(document.querySelector(`#${s} .num`).getBoundingClientRect().top)));
    const before = await tops();
    await page.click('#seal');
    await tap(page, 'villain', '+');
    await tap(page, 'hero', '+');
    equal(await tops(), before, 'Number positions with a bonus showing');
  });

  scenario('keys that can’t change anything show faint; a defeated side is drawn hollow', async (open) => {
    const page = await open({ game: { hero: [1, 10], villain: [14, 14] } });
    const inert = () =>
      page.$$eval('.key', (keys) => keys.filter((k) => k.classList.contains('inert')).map((k) => `${k.dataset.side}${k.dataset.dir > 0 ? '+' : '-'}`));
    equal(await inert(), ['villain+'], 'Full villain: + is faint');
    await tap(page, 'hero', '-');
    equal(await inert(), ['villain+', 'hero-'], 'Hero at 0: − is faint');
    check(await page.$eval('#hero', (p) => p.classList.contains('down')), 'The hero is drawn defeated');
    const hollow = await page.$eval('#hero .num', (n) => getComputedStyle(n).color !== getComputedStyle(document.querySelector('#villain .num')).color);
    check(hollow, 'The defeated number is drawn hollow');
    await page.click('#seal');
    equal(await inert(), ['villain-', 'hero-'], 'Max-HP mode: − is faint with no bonus to remove');
  });

  scenario('Next stage turns solid ink when the villain is down', async (open) => {
    const page = await open({ game: { villain: [1, 14] } });
    const bg = () => page.$eval('#next', (b) => getComputedStyle(b).backgroundColor);
    const before = await bg();
    await tap(page, 'villain', '-');
    check((await bg()) !== before, 'Next stage changes when the villain reaches 0');
    equal(await page.$eval('#next', (b) => b.getAnimations().length), 0, 'and stays still');
  });

  scenario('a bad entry is shown in its own panel', async (open) => {
    const page = await open();
    equal(await page.textContent('#set'), 'New game', 'The button says New game');
    await fillSheet(page, { hero: 10, villain: 0 });
    equal(await page.textContent('#villain-row .narration'), 'Villain HP: 1–99', 'The villain panel says what it wants');
    check(await page.$eval('#villain-row', (r) => r.classList.contains('invalid')), 'and is marked');
    check(!(await page.$eval('#hero-row', (r) => r.classList.contains('invalid'))), 'The hero panel isn’t');
    await page.fill('#villain-input', '1');
    equal(await page.textContent('#villain-row .narration'), 'Villain HP', 'Typing clears it');
  });

  // ---------- The 術 toggle ----------

  scenario('the 術 toggle marks the special ability used, and a new game clears it', async (open) => {
    const page = await open({ game: {} });
    const used = () => page.getAttribute('#power', 'aria-pressed');
    const color = () => page.$eval('#power', (b) => getComputedStyle(b).backgroundColor);
    equal(await used(), 'false', 'Not used to start');
    const plain = await color();
    await page.click('#power');
    equal(await used(), 'true', 'Tapped: used');
    check((await color()) !== plain, 'and colored');
    await page.reload();
    await ready(page);
    equal(await used(), 'true', 'Saved across a relaunch');
    await page.click('#power');
    equal(await used(), 'false', 'Tapped again: clear');
    await page.click('#power');
    await page.click('#set');
    await fillSheet(page, { villain: 14 });
    equal(await used(), 'false', 'A new game clears it');
  });

  scenario('a game saved by the first version carries over', async (open) => {
    const v1 = { version: 1, game: 2, stage: 2, boost: false, hero: { hp: 7, max: 11, up: 0 }, villain: { hp: 9, max: 15, up: 0 } };
    const page = await open({ storage: v1 });
    check(!(await page.isVisible('#sheet')), 'No new-game sheet: the game is still there');
    equal((await read(page, 'hero')).hp, 7, 'Hero');
    equal((await read(page, 'villain')).hp, 9, 'Villain');
    equal(await page.getAttribute('#power', 'aria-pressed'), 'false', '術 not used');
  });

  scenario('a game saved with round tracking carries over', async (open) => {
    const v2 = { version: 2, game: 1, stage: 1, boost: false, hero: { hp: 5, max: 10, up: 0 }, villain: { hp: 9, max: 14, up: 0 }, round: 3, phase: 'villain', abilities: { round: 1, phase: 0 }, used: { round: [true], phase: [] } };
    const page = await open({ storage: v2 });
    check(!(await page.isVisible('#sheet')), 'The game is still there');
    equal((await read(page, 'hero')).hp, 5, 'Hero');
    await tap(page, 'villain', '-');
    const saved = await stored(page);
    equal(Object.keys(saved).sort(), ['boost', 'game', 'hero', 'powerUsed', 'stage', 'version', 'villain'], 'Saved in the new shape');
  });

  // ---------- Presses (lessons from Bgt-J: app/js/presses.js) ----------

  scenario('a press that slides off a key before lifting does nothing', async (open) => {
    const page = await open({ clock: true, game: {} }); // paused: a slow slide mustn't turn into a hold
    const box = await key(page, 'villain', '-').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 4 });
    await page.mouse.up();
    equal((await read(page, 'villain')).hp, 14, 'Villain after sliding off');
  });

  scenario('a tap in the gutter between − and + does nothing', async (open) => {
    const page = await open({ game: {} });
    const minus = await key(page, 'villain', '-').boundingBox();
    const plus = await key(page, 'villain', '+').boundingBox();
    await page.mouse.click((minus.x + minus.width + plus.x) / 2, minus.y + minus.height / 2);
    equal((await read(page, 'villain')).hp, 14, 'Villain after a gutter tap');
  });

  scenario('two fingers at once each count', async (open) => {
    const page = await open({ game: {} });
    await page.evaluate(() => {
      const fire = (el, type, id) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch' }));
      };
      const v = document.querySelector('.key[data-side="villain"][data-dir="-1"]');
      const h = document.querySelector('.key[data-side="hero"][data-dir="-1"]');
      fire(v, 'pointerdown', 11);
      fire(h, 'pointerdown', 12);
      fire(v, 'pointerup', 11);
      fire(h, 'pointerup', 12);
    });
    equal([(await read(page, 'villain')).hp, (await read(page, 'hero')).hp], [13, 9], 'Both taps counted');
  });

  scenario('the browser’s own click never adds a second tap', async (open) => {
    const page = await open({ game: {} });
    await tap(page, 'villain', '-'); // pointer events plus the browser's click
    equal((await read(page, 'villain')).hp, 13, 'One tap, one point');
    await page.evaluate(() => document.querySelector('.key[data-side="villain"][data-dir="-1"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    equal((await read(page, 'villain')).hp, 13, 'A stray browser click alone does nothing');
    await page.evaluate(() => document.querySelector('.key[data-side="villain"][data-dir="-1"]').click());
    equal((await read(page, 'villain')).hp, 12, 'A click from code still works');
  });

  scenario('touch taps work, and the sheet’s fields still take focus', async (open) => {
    const page = await open({ game: {} });
    await key(page, 'hero', '-').tap();
    equal((await read(page, 'hero')).hp, 9, 'Hero after a touch tap');
    await page.tap('#set');
    check(await page.isVisible('#sheet'), 'New game opens the sheet by touch');
    await page.tap('#hero-input');
    equal(await page.evaluate(() => document.activeElement.id), 'hero-input', 'Tapping a field focuses it');
    await page.tap('#sheet-cancel');
    check(!(await page.isVisible('#sheet')), 'Cancel by touch');
    await page.tap('#seal');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'true', 'The seal by touch');
  });

  scenario('a hold that drifts is called off, and its lift is an ordinary tap', async (open) => {
    const page = await open({ clock: true, game: {} });
    const { HOLD_MS, REPEAT_MS } = await holdTimes(page);
    const box = await key(page, 'villain', '-').boundingBox();
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 3 });
    await page.clock.runFor(HOLD_MS + REPEAT_MS);
    await page.mouse.up();
    equal((await read(page, 'villain')).hp, 13, 'A tap, not a hold');
  });

  scenario('offline list covers every app file', async () => {
    const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
    const listed = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
    // Not listed: the worker itself, the fonts' character list (a build note), and the launch
    // screens (iOS reads those when the app is added to the home screen).
    const files = appFiles().filter((f) => f !== 'sw.js' && f !== 'fonts/chars.txt' && !f.startsWith('icons/launch-'));
    const missing = files.filter((f) => !listed.includes(f) && !(f === 'index.html' && listed.includes('./')));
    const extra = listed.filter((f) => f !== './' && !files.includes(f));
    equal({ missing, extra }, { missing: [], extra: [] }, 'sw.js FILES vs app files');
  });

  scenario('the page is valid HTML', async () => {
    const { HtmlValidate, FileSystemConfigLoader } = require('html-validate');
    const validator = new HtmlValidate(new FileSystemConfigLoader({ extends: ['html-validate:standard'] }));
    const report = await validator.validateFile(path.join(APP, 'index.html'));
    const problems = report.results.flatMap((r) => r.messages.map((m) => `${m.line}:${m.column} ${m.message} (${m.ruleId})`));
    equal(problems, [], 'HTML problems');
  });

  scenario('the bundled fonts cover every character the app uses', async () => {
    const covered = fs.readFileSync(path.join(APP, 'fonts', 'chars.txt'), 'utf8');
    const missing = appChars().filter((c) => !covered.includes(c));
    equal(missing, [], 'Characters missing from the fonts (run npm run fonts)');
  });
};
