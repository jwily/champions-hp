// Behavior: starting a game, taps and holds, the max-HP seal, stages, saving.

const fs = require('fs');
const path = require('path');
const { APP, appChars, appFiles, tap, hold, read, stored, fillSheet, check, equal, ready } = require('./helpers');
// Must match app/js/press.js.
const HOLD_MS = 450;
const REPEAT_MS = 550;

module.exports = (scenario) => {
  scenario('first launch asks for HP and can’t be cancelled', async (open) => {
    const page = await open();
    check(await page.isVisible('#sheet'), 'The new-game sheet shows on first launch');
    check(!(await page.isVisible('#sheet-cancel')), 'No Cancel before the first game');
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
    equal(await read(page, 'hero'), { hp: 10, max: '/ 13 (+3)', line: 'まだまだ!!' }, '+3 hit points');
    await tap(page, 'hero', '-');
    equal(await read(page, 'hero'), { hp: 9, max: '/ 12 (+2)', line: 'まだまだ!!' }, 'Lowering it lowers HP too');
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

  scenario('Set HP mid-game starts a new game', async (open) => {
    const page = await open({ game: { hero: [4, 11], villain: [3, 15], stage: 2, game: 3 } });
    await page.click('#set');
    check(await page.isVisible('#sheet-cancel'), 'Cancel available mid-game');
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
    equal(await stored(page), { version: 1, game: 1, stage: 1, boost: true, hero: { hp: 12, max: 10, up: 2 }, villain: { hp: 10, max: 14, up: 0 } }, 'Saved data');
    await page.reload();
    await ready(page);
    equal((await read(page, 'villain')).hp, 10, 'Villain after relaunch');
    equal((await read(page, 'hero')).max, '/ 12 (+2)', 'Hero after relaunch');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'true', 'Seal after relaunch');
    check(!(await page.isVisible('#sheet')), 'No sheet when a game is saved');
  });

  scenario('unreadable saved data starts fresh', async (open) => {
    for (const storage of ['{not json', { version: 1, hero: { hp: 'x' }, villain: null }, { version: 99 }]) {
      const page = await open({ storage });
      check(await page.isVisible('#sheet'), `Fresh start for ${JSON.stringify(storage)}`);
    }
  });

  scenario('sound effects show on changes', async (open) => {
    const page = await open({ game: {} });
    await tap(page, 'villain', '-');
    const sfx = await page.$eval('#villain .sfx', (s) => ({ text: s.textContent, shown: s.classList.contains('show') }));
    check(['ドン!', 'バキ!', 'ドカッ', 'ガッ'].includes(sfx.text) && sfx.shown, `Hit effect: ${JSON.stringify(sfx)}`);
    check(await page.$eval('#villain', (p) => p.classList.contains('shake')), 'The panel shakes on a hit');
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

  scenario('the bundled fonts cover every character the app uses', async () => {
    const covered = fs.readFileSync(path.join(APP, 'fonts', 'chars.txt'), 'utf8');
    const missing = appChars().filter((c) => !covered.includes(c));
    equal(missing, [], 'Characters missing from the fonts (run npm run fonts)');
  });
};
