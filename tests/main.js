// Behavior: starting a game, taps and holds, the max-HP seal, stages, saving.

const fs = require('fs');
const { appFiles, manifest } = require('./tools/manifest');
const path = require('path');
const { APP, appChars, key, tap, hold, holdTimes, read, stored, fillSheet, check, equal, ready } = require('./helpers');

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
    equal((await read(page, 'villain')).line, '小癪な!', 'Villain line when hurt');
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
    equal(await read(page, 'hero'), { hp: 10, max: '/ 13 (+3)', line: 'まだまだ!' }, '+3 hit points');
    await tap(page, 'hero', '-');
    equal(await read(page, 'hero'), { hp: 9, max: '/ 12 (+2)', line: 'まだまだ!' }, 'Lowering it lowers HP too');
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
    equal((await read(page, 'villain')).line, '遊びは終わりだ…', 'First stage at 0: not beaten, about to stop holding back');
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
    equal(await read(page, 'villain'), { hp: 15, max: '/ 15', line: 'これが真の力だ!!' }, 'Stage 2 opens with the reveal');
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
      { version: 4, game: 1, stage: 1, mode: 'standard', boost: true, hero: { hp: 12, max: 10, up: 2 }, villain: { hp: 10, max: 14, up: 0 }, powerUsed: false },
      'Saved data'
    );
    await page.reload();
    await ready(page);
    equal((await read(page, 'villain')).hp, 10, 'Villain after relaunch');
    equal((await read(page, 'hero')).max, '/ 12 (+2)', 'Hero after relaunch');
    equal(await page.getAttribute('#seal', 'aria-pressed'), 'true', 'Seal after relaunch');
    check(!(await page.isVisible('#sheet')), 'No sheet when a game is saved');
  });

  scenario('unreadable saved data starts fresh', async (open) => {
    const broken = { version: 4, game: 'x', stage: 1, mode: 'standard', boost: false, hero: null, villain: null, powerUsed: true };
    for (const storage of ['{not json', { version: 1, hero: { hp: 'x' }, villain: null }, { version: 99 }, broken]) {
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
    check(!(await page.$('#villain .focus')), 'No focus-line flash (it fought the hero’s own lines)');
    const calm = await page.evaluate(async () => {
      for (const a of document.getElementById('villain').getAnimations()) a.finish();
      document.getElementById('seal').click();
      document.querySelector('.key[data-side="villain"][data-dir="1"]').click(); // raise max HP
      document.querySelector('.key[data-side="villain"][data-dir="-1"]').click(); // lower it: フッ…
      const still = document.getElementById('villain').getAnimations().length === 0;
      document.getElementById('seal').click(); // max-HP mode off again for the rest
      return still;
    });
    check(calm, 'Max HP rising or falling doesn’t shake the panel');
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

  scenario('Next stage turns solid ink, and stays still, when the villain is down', async (open) => {
    const page = await open({ game: { villain: [1, 14] } });
    const bg = () => page.$eval('#next', (b) => getComputedStyle(b).backgroundColor);
    const before = await bg();
    await tap(page, 'villain', '-');
    check((await bg()) !== before, 'Solid ink at 0');
    equal(await page.$eval('#next', (b) => b.getAnimations().length), 0, 'No animation');
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

  // ---------- Standard / Expert, and winning ----------

  scenario('Expert runs stages II then III, and the last one down wins', async (open) => {
    const page = await open();
    const pressed = () => page.$eval('#mode-row [aria-pressed="true"]', (b) => b.textContent);
    equal(await pressed(), 'Standard', 'Standard by default');
    await page.click('#mode-row [data-mode="expert"]');
    await fillSheet(page, { villain: 1, hero: 10 });
    equal(await page.textContent('#stage-num'), '2', 'Expert starts at stage II');
    await tap(page, 'villain', '-');
    check(!(await page.$eval('#villain', (p) => p.classList.contains('won'))), 'Stage II down is not a win in Expert');
    await page.click('#next');
    equal(await page.textContent('#sheet-title'), 'STAGE 3!!', 'Next is stage III');
    await fillSheet(page, { villain: 1 });
    await tap(page, 'villain', '-');
    check(await page.isVisible('#villain .victory'), 'VICTORY!!! once stage III is down');
    check(!(await page.isVisible('#next')), 'No Next stage after the last one');
    equal((await read(page, 'hero')).line, 'やった!!', 'The hero cheers');
    await tap(page, 'villain', '+');
    check(!(await page.isVisible('#villain .victory')), 'Healing the villain takes the win back (a mistap)');
    await page.click('#set');
    equal(await pressed(), 'Expert', 'Expert is remembered for the next game');
  });

  scenario('on the last stage, Next stage reads Final stage and can’t be pressed', async (open) => {
    const page = await open({ game: { villain: [5, 14], stage: 2 } });
    equal(await page.textContent('#next'), 'Final stage', 'Standard stage II is the final one');
    check(await page.$eval('#next', (b) => b.disabled), 'and it’s disabled');
    const caption = await page.$eval('#next', (b) => b.getBoundingClientRect().height);
    await page.click('#set');
    const label = await page.$eval('#villain-row .narration', (l) => l.getBoundingClientRect().height);
    equal(Math.round(caption), Math.round(label), 'Drawn as a compact caption box, the height of the sheet’s labels');
    await page.click('#sheet-cancel');
    const box = await page.locator('#next').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    check(!(await page.$eval('#next', (b) => b.classList.contains('pressed'))), 'No pressed look while held');
    await page.mouse.up();
    check(!(await page.isVisible('#sheet')), 'Pressing it opens nothing');
    const expert = await open({ game: { villain: [5, 14], stage: 2, mode: 'expert' } });
    equal(await expert.textContent('#next'), 'Next stage ▸', 'Expert stage II still has a next stage');
  });

  scenario('Standard wins when stage II is down, not stage I', async (open) => {
    const page = await open({ game: { villain: [1, 14], stage: 1 } });
    await tap(page, 'villain', '-');
    check(!(await page.isVisible('#villain .victory')), 'No win at stage I');
    check(await page.isVisible('#next'), 'Next stage instead');
    await page.click('#next');
    await fillSheet(page, { villain: 1 });
    await tap(page, 'villain', '-');
    check(await page.isVisible('#villain .victory'), 'VICTORY!!! at stage II');
    equal((await read(page, 'villain')).line, 'バ…バカな…!!', 'The final stage’s defeat line');
  });

  scenario('sound effects feel random: dealt like a shuffled deck, never back to back', async (open) => {
    const page = await open({ game: { villain: [99, 99] } });
    const dealt = await page.evaluate(() => {
      const key = document.querySelector('.key[data-side="villain"][data-dir="-1"]');
      const out = [];
      for (let i = 0; i < 30; i++) {
        key.click();
        const effect = [...document.querySelectorAll('#villain > .sfx')].at(-1);
        out.push({ word: effect.textContent, tilt: effect.style.getPropertyValue('--tilt') });
      }
      return out;
    });
    const repeats = (key) => dealt.filter((d, i) => i && d[key] === dealt[i - 1][key]).length;
    equal([repeats('word'), repeats('tilt')], [0, 0], 'Back-to-back repeats (word, tilt)');
    const counts = {};
    for (const { word } of dealt) counts[word] = (counts[word] ?? 0) + 1;
    equal(Object.values(counts), [10, 10, 10], 'Each of the three tap words, once per round of three');
  });

  // ---------- The 術 toggle ----------

  scenario('術 starts sealed; tapping releases and seals it; a new game seals it again', async (open) => {
    const page = await open();
    await fillSheet(page, { villain: 14, hero: 10 });
    const used = () => page.getAttribute('#power', 'aria-pressed');
    const tagShown = () => page.$eval('#power .tag', (t) => getComputedStyle(t).opacity === '1');
    const outline = () => page.$eval('#power .kanji', (k) => getComputedStyle(k).webkitTextStrokeColor);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#power .tag')).opacity === '1'); // the tag's slap-on
    equal(await used(), 'true', 'A new game starts sealed: most heroes have no limited ability');
    const sealedOutline = await outline();
    await page.click('#power');
    equal(await used(), 'false', 'Tapped: released, ready');
    check(!(await tagShown()), 'No tag while ready');
    check((await outline()) !== sealedOutline, 'The character shows its blue outline');
    await page.reload();
    await ready(page);
    equal(await used(), 'false', 'Saved across a relaunch');
    await page.click('#power');
    equal(await used(), 'true', 'Tapped again: sealed (used)');
    await page.click('#power');
    await page.click('#set');
    await fillSheet(page, { villain: 14 });
    equal(await used(), 'true', 'A new game seals it again');
  });

  scenario('a game saved by the first version carries over', async (open) => {
    const v1 = { version: 1, game: 2, stage: 2, boost: false, hero: { hp: 7, max: 11, up: 0 }, villain: { hp: 9, max: 15, up: 0 } };
    const page = await open({ storage: v1 });
    check(!(await page.isVisible('#sheet')), 'No new-game sheet: the game is still there');
    equal((await read(page, 'hero')).hp, 7, 'Hero');
    equal((await read(page, 'villain')).hp, 9, 'Villain');
    equal(await page.getAttribute('#power', 'aria-pressed'), 'true', '術 sealed');
  });

  scenario('a game saved with round tracking carries over', async (open) => {
    const v2 = { version: 2, game: 1, stage: 1, boost: false, hero: { hp: 5, max: 10, up: 0 }, villain: { hp: 9, max: 14, up: 0 }, round: 3, phase: 'villain', abilities: { round: 1, phase: 0 }, used: { round: [true], phase: [] } };
    const page = await open({ storage: v2 });
    check(!(await page.isVisible('#sheet')), 'The game is still there');
    equal((await read(page, 'hero')).hp, 5, 'Hero');
    await tap(page, 'villain', '-');
    const saved = await stored(page);
    equal(Object.keys(saved).sort(), ['boost', 'game', 'hero', 'mode', 'powerUsed', 'stage', 'version', 'villain'], 'Saved in the new shape');
    equal(saved.mode, 'standard', 'as a Standard game');
  });

  scenario('a game saved before Standard / Expert carries over as Standard', async (open) => {
    const v3 = { version: 3, game: 4, stage: 2, boost: false, hero: { hp: 6, max: 10, up: 0 }, villain: { hp: 8, max: 15, up: 0 }, powerUsed: false };
    const page = await open({ storage: v3 });
    check(!(await page.isVisible('#sheet')), 'The game is still there');
    equal(await page.getAttribute('#power', 'aria-pressed'), 'false', '術 as it was');
    equal(await page.textContent('#next'), 'Final stage', 'Standard: stage II is the last');
  });

  scenario('the HP sheet’s panels open where the page’s are, with the same art', async (open) => {
    const page = await open({ game: {} });
    const top = () => page.$eval('#villain', (p) => p.getBoundingClientRect().top);
    const pageTop = await top();
    await page.click('#set');
    equal(await page.$eval('#villain-row', (p) => p.getBoundingClientRect().top), pageTop, 'Villain panel top, sheet vs page');
    const art = (sel) => page.$eval(sel, (w) => ({ art: w.dataset.art, mask: getComputedStyle(w.querySelector('.fade')).maskImage || getComputedStyle(w.querySelector('.fade')).webkitMaskImage, drawn: !!w.querySelector('svg.art') }));
    for (const side of ['villain', 'hero']) {
      equal(await art(`#${side}-row .art-wrap`), await art(`#${side} .art-wrap`), `${side} art and tone, sheet vs page`);
    }
  });

  scenario('the launch screens in index.html are the ones drawn', async () => {
    const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
    const linked = [...html.matchAll(/apple-touch-startup-image" href="(icons\/[^"]+)"/g)].map((m) => m[1]).sort();
    const drawn = appFiles().filter((f) => f.startsWith('icons/launch-')).sort();
    equal(linked, drawn, 'Launch screens linked vs in app/icons');
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

  scenario('a repeating hold keeps going through a wiggle, and stops off the key', async (open) => {
    const page = await open({ clock: true, game: { villain: [60, 60, 0] } });
    const { HOLD_MS, REPEAT_MS } = await holdTimes(page);
    const box = await key(page, 'villain', '-').boundingBox();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.clock.runFor(HOLD_MS + 50);
    equal((await read(page, 'villain')).hp, 55, 'The hold starts');
    await page.mouse.move(x + 25, y + 12, { steps: 3 }); // well past the slop, still on the key
    await page.clock.runFor(REPEAT_MS);
    equal((await read(page, 'villain')).hp, 50, 'Still repeating after a wiggle on the key');
    await page.mouse.move(x, box.y + box.height + 40, { steps: 3 }); // off the key
    await page.clock.runFor(REPEAT_MS * 2);
    await page.mouse.up();
    equal((await read(page, 'villain')).hp, 50, 'Stopped once the finger left the key');
  });

  scenario('the offline manifest covers the app’s files', async () => {
    const listed = Object.keys(manifest().files);
    // The icons, under whatever versioned names the page and the web app manifest give them.
    const icons = [...fs.readFileSync(path.join(APP, 'index.html'), 'utf8').matchAll(/href="(icons\/icon-[^"]+)"/g), ...fs.readFileSync(path.join(APP, 'manifest.json'), 'utf8').matchAll(/"src": "([^"]+)"/g)].map((m) => m[1]);
    equal(icons.length, 3, 'Icon references (apple-touch-icon, two manifest icons)');
    const wanted = ['./', 'index.html', 'style.css', 'manifest.json', 'fonts/OFL.txt', ...icons];
    const js = appFiles().filter((f) => f.startsWith('js/'));
    const fonts = appFiles().filter((f) => f.endsWith('.woff2'));
    const missing = [...wanted, ...js, ...fonts].filter((f) => !listed.includes(f));
    const leftOut = ['sw.js', 'files.json', 'fonts/chars.txt', 'icons/launch-750x1334.png'].filter((f) => listed.includes(f));
    equal({ missing, leftOut }, { missing: [], leftOut: [] }, 'Manifest');
  });

  scenario('text and key graphics meet contrast minimums', async (open) => {
    const page = await open({ game: {} });
    const ratios = await page.evaluate(() => {
      const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const lum = (hex) => {
        const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(v(a)), lum(v(b))].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      return {
        'ink on paper': ratio('--ink', '--paper'),
        'small print on paper': ratio('--sub', '--paper'),
        'running head on black': ratio('--head', '--black'),
        'bonus on paper': ratio('--orange-ink', '--paper'),
        '術 outline on paper': ratio('--blue', '--paper'),
      };
    });
    // WCAG: 4.5:1 for small text, 3:1 for graphics (the 術 outline).
    const short = Object.entries(ratios).filter(([name, r]) => r < (name.startsWith('術') ? 3 : 4.5));
    equal(short.map(([n, r]) => `${n} ${r.toFixed(2)}`), [], 'Below minimum contrast');
  });

  scenario('the screen is kept awake, and again after coming back', async (open) => {
    const page = await open({ game: {} });
    // A stand-in for the browser's wake lock, counting requests and able to drop the lock as iOS
    // does when the app goes to the background.
    const requests = () => page.evaluate(() => window.__wakeRequests);
    await page.evaluate(() => {
      window.__wakeRequests = 0;
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            window.__wakeRequests += 1;
            const lock = new EventTarget();
            window.__dropLock = () => lock.dispatchEvent(new Event('release'));
            return lock;
          },
        },
      });
    });
    await page.click('#villain'); // the app asks again on a tap when it holds no lock
    equal(await requests(), 1, 'Asked for on a tap');
    await page.click('#villain');
    equal(await requests(), 1, 'Not asked again while held');
    await page.evaluate(() => {
      window.__dropLock(); // iOS drops it in the background
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__wakeRequests === 2);
    equal(await requests(), 2, 'Asked for again on coming back');
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
