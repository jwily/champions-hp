// Layout: on every phone size, with the widest numbers and longest lines, everything fits, nothing
// that should stay apart overlaps, and every control is big enough to tap.

const { PHONES, check, equal } = require('./helpers');

const CASES = {
  'widest numbers': { hero: [99, 90, 9], villain: [99, 99, 0], stage: 3, powerUsed: true },
  'longest lines': { hero: [1, 99, 0], villain: [0, 99, 0], stage: 12 },
  'first stage down': { hero: [1, 99, 0], villain: [0, 99, 0], stage: 1 },
  'the reveal': { hero: [99, 99, 0], villain: [99, 99, 0], stage: 2 },
};

module.exports = (scenario) => {
  // Sound effects land at random: over many, every one's center stays clear of the numbers, the
  // balloons and the corner boxes, inside its own panel.
  for (const phone of Object.keys(PHONES)) {
    scenario(`sound effects stay clear of the numbers and balloons on ${phone}`, async (open) => {
      const page = await open({ phone, game: { hero: [50, 99], villain: [50, 99] } });
      const problems = [];
      for (let i = 0; i < 24; i++) {
        const side = i % 2 ? 'hero' : 'villain';
        await page.locator(`.key[data-side="${side}"][data-dir="${i % 4 < 2 ? -1 : 1}"]`).click();
        const problem = await page.evaluate((s) => {
          const panel = document.getElementById(s);
          const effect = [...panel.querySelectorAll(':scope > .sfx')].at(-1);
          if (!effect) return null; // already faded (a busy machine): nothing to measure
          if (getComputedStyle(effect).writingMode !== 'horizontal-tb') return `${effect.textContent} isn't lettered across`;
          const r = effect.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const p = panel.getBoundingClientRect();
          if (!(x > p.left && x < p.right && y > p.top && y < p.bottom)) return `${effect.textContent} centered outside its panel`;
          for (const sel of ['.num', '.balloon', '.max', '.inset', '.next', '.power']) {
            for (const el of panel.querySelectorAll(sel)) {
              const b = el.getBoundingClientRect();
              if (x > b.left && x < b.right && y > b.top && y < b.bottom) return `${effect.textContent} centered on ${s} ${sel}`;
            }
          }
          return null;
        }, side);
        if (problem) problems.push(problem);
      }
      check(problems.length === 0, problems.join('; '));
    });
  }

  // The HP sheet, with the keyboard closed and open. Playwright has no on-screen keyboard, so an
  // open one is simulated as iOS reports it: the visual viewport shrinks by its height.
  const KEYBOARD = 291; // iOS's number pad on an iPhone 14 Pro, in CSS px
  for (const phone of Object.keys(PHONES)) {
    for (const mode of ['#set', '#next']) {
      for (const keyboard of [0, KEYBOARD]) {
        const name = `the HP sheet fits on ${phone} (${mode === '#set' ? 'new game' : 'next stage'}, keyboard ${keyboard ? 'open' : 'closed'})`;
        scenario(name, async (open) => {
          const page = await open({ phone, game: {} });
          await page.click(mode);
          if (keyboard) {
            await page.evaluate((h) => {
              const view = window.visualViewport;
              Object.defineProperty(view, 'height', { value: innerHeight - h, configurable: true });
              view.dispatchEvent(new Event('resize'));
            }, keyboard);
          }
          // iOS scrolls the view to show a field low on the screen (Hero HP): the sheet must still make
          // room for the whole keyboard, not the keyboard less that scroll.
          if (keyboard) {
            await page.evaluate(() => {
              Object.defineProperty(window.visualViewport, 'offsetTop', { value: 120, configurable: true });
              window.visualViewport.dispatchEvent(new Event('scroll'));
            });
            equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--keyboard').trim()), `${keyboard}px`, 'Room for the whole keyboard while iOS has the view scrolled');
            await page.evaluate(() => Object.defineProperty(window.visualViewport, 'offsetTop', { value: 0, configurable: true }));
          }
          // The sheet changes in one step, with nothing animating.
          equal(await page.evaluate(() => document.getElementById('sheet').getAnimations({ subtree: true }).length), 0, 'Nothing animating');
          const problems = await page.evaluate((kb) => {
            const out = [];
            const box = (sel) => document.querySelector(sel).getBoundingClientRect();
            const visible = innerHeight - kb;
            const actions = box('.sheet-actions');
            if (actions.bottom > visible + 1) out.push(`The buttons are under the keyboard (bottom ${Math.round(actions.bottom)}, keyboard at ${visible})`);
            if (actions.bottom < visible - 40) out.push(`The buttons aren't at the bottom (bottom ${Math.round(actions.bottom)} of ${visible})`);
            const entries = [...document.querySelectorAll('.entry')].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect());
            for (const e of entries) {
              if (e.height < 79) out.push(`A field's panel is squeezed to ${Math.round(e.height)}px`);
              if (e.bottom > actions.top) out.push('A field panel runs into the buttons');
            }
            for (const sel of ['#sheet-ok', '#sheet-cancel']) {
              const r = box(sel);
              if (r.height < 44 || r.width < 60) out.push(`${sel} is too small to tap (${Math.round(r.width)}×${Math.round(r.height)})`);
            }
            return out;
          }, keyboard);
          check(problems.length === 0, problems.join('; '));
        });
      }
    }
  }

  for (const phone of Object.keys(PHONES)) {
    for (const [label, game] of Object.entries(CASES)) {
      scenario(`fits on ${phone} (${label})`, async (open) => {
        const page = await open({ phone, game });
        const problems = await page.evaluate(() => {
          const out = [];
          const box = (sel) => {
            const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, name: typeof sel === 'string' ? sel : el.className };
          };
          // Where text sits: its line box (fonts carry spacing above and below the letters).
          const ink = (sel) => {
            const el = document.querySelector(sel);
            const range = document.createRange();
            range.selectNodeContents(el);
            const r = range.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, name: sel };
          };
          // The big numbers' actual glyphs plus their outline, measured with the same font on a
          // canvas: the line box reaches well above the digits.
          const glyphs = (sel) => {
            const el = document.querySelector(sel);
            const style = getComputedStyle(el);
            const size = parseFloat(style.fontSize);
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.font = `${size}px ${style.fontFamily}`;
            const m = ctx.measureText(el.textContent);
            const line = ink(sel);
            const baseline = line.top + m.fontBoundingBoxAscent;
            const outline = (parseFloat(style.webkitTextStrokeWidth) || 0) / 2;
            return {
              left: line.left - m.actualBoundingBoxLeft - outline,
              right: line.left + m.actualBoundingBoxRight + outline,
              top: baseline - m.actualBoundingBoxAscent - outline,
              bottom: baseline + m.actualBoundingBoxDescent + outline,
              name: sel,
            };
          };
          const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
          const apart = (a, b) => overlap(a, b) && out.push(`${a.name} overlaps ${b.name}`);
          const within = (a, b) => !inside(a, b) && out.push(`${a.name} spills out of ${b.name}`);

          const view = { left: 0, top: 0, right: innerWidth, bottom: innerHeight, name: 'the screen' };
          if (document.documentElement.scrollHeight > innerHeight + 1) out.push('The page scrolls');

          const villain = box('#villain');
          const hero = box('#hero');
          const vNum = glyphs('#villain .num');
          const hNum = glyphs('#hero .num');
          within(vNum, villain);
          apart(vNum, box('#villain .shout'));
          apart(vNum, box('#villain .inset'));
          apart(vNum, box('#next'));
          apart(vNum, glyphs('#villain .max'));
          within(ink('#villain .line'), box('#villain .shout'));
          apart(box('#villain .shout'), box('#next'));
          apart(box('#villain .shout'), box('#villain .inset'));

          // The hero's number breaks out upward, but must clear the villain's keys and the seal.
          const vKeys = box(document.querySelectorAll('.keys')[0]);
          if (hNum.top < vKeys.bottom) out.push('The hero number reaches the villain keys');
          apart(hNum, box('#seal'));
          apart(hNum, box('#hero .round'));
          apart(hNum, glyphs('#hero .max'));
          apart(box('#hero .max'), box('#hero .round'));
          apart(box('#villain .max'), box('#villain .shout'));
          if (hNum.bottom > hero.bottom) out.push('The hero number spills out of the bottom of its panel');
          within(ink('#hero .line'), box('#hero .round'));
          // VICTORY!!! (the longest-lines case is a won game): inside the panel, clear of the rest.
          if (document.getElementById('villain').classList.contains('won')) {
            const victory = box('#villain .victory');
            within(victory, villain);
            apart(victory, vNum);
            apart(victory, box('#villain .shout'));
            apart(victory, glyphs('#villain .max'));
          }
          // The 術 toggle: inside the panel, clear of the number and balloon.
          const power = box('#power');
          within(power, hero);
          if (document.getElementById('power').getAttribute('aria-pressed') === 'true') {
            within(box('#power .tag'), hero);
            apart(box('#power .tag'), hNum);
          }
          // Each balloon line breaks only where it's marked (at phrases), never mid-phrase: as many
          // columns as marked phrases.
          for (const sel of ['#villain .shout .line', '#hero .round .line']) {
            const line = document.querySelector(sel);
            const phrases = line.querySelectorAll('br').length + 1;
            const range = document.createRange();
            range.selectNodeContents(line);
            // Columns, by where they sit across: an upright "!!" sits a few px off its column's line, so
            // positions within half a character of each other are one column.
            const lefts = [...range.getClientRects()].filter((r) => r.width && r.height).map((r) => r.left + r.width / 2).sort((x, y) => x - y);
            const half = parseFloat(getComputedStyle(line).fontSize) / 2;
            const columns = lefts.filter((x, i) => i === 0 || x - lefts[i - 1] > half).length;
            if (columns > phrases) out.push(`${sel} wraps mid-phrase (${columns} columns for ${phrases} phrases)`);
          }
          // The − / + signs centered in their keys.
          for (const key of document.querySelectorAll('.key')) {
            const sign = key.querySelector('.sign').getBoundingClientRect();
            const k = key.getBoundingClientRect();
            const off = Math.max(Math.abs((sign.left + sign.right - k.left - k.right) / 2), Math.abs((sign.top + sign.bottom - k.top - k.bottom) / 2));
            if (off > 1) out.push(`A sign is ${off.toFixed(1)}px off center in its key`);
          }
          // Balloon text centered in its balloon, both ways (a wrapped line once hung off-center).
          for (const sel of ['#villain .shout', '#hero .round']) {
            const b = box(sel);
            const t = ink(`${sel} .line`);
            const off = Math.max(Math.abs((t.left + t.right - b.left - b.right) / 2), Math.abs((t.top + t.bottom - b.top - b.bottom) / 2));
            if (off > 2) out.push(`${sel}'s text is ${Math.round(off)}px off center`);
          }
          apart(power, hNum);
          apart(power, box('#hero .round'));

          for (const sel of ['#set', '#next', '#seal', '#power', ...[0, 1, 2, 3].map((i) => document.querySelectorAll('.key')[i])]) {
            const b = box(sel);
            if (!b.width && !b.height) continue; // hidden (Next stage after a win)
            within(b, view);
            if (b.height < 44 || b.width < 44) out.push(`${b.name} is too small to tap (${Math.round(b.width)}×${Math.round(b.height)})`);
          }
          within(villain, view);
          within(hero, view);
          return out;
        });
        check(problems.length === 0, problems.join('; '));
      });
    }
  }
};
