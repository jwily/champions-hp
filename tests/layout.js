// Layout: on every phone size, with the widest numbers and longest lines, everything fits, nothing
// that should stay apart overlaps, and every control is big enough to tap.

const { PHONES, check } = require('./helpers');

const CASES = {
  'widest numbers': { hero: [99, 90, 9], villain: [99, 99, 0], stage: 3 },
  'longest lines': { hero: [1, 99, 0], villain: [0, 99, 0], stage: 12 },
};

module.exports = (scenario) => {
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
          apart(vNum, ink('#villain .max'));
          within(ink('#villain .line'), box('#villain .shout'));
          apart(box('#villain .shout'), box('#next'));
          apart(box('#villain .shout'), box('#villain .inset'));

          // The hero's number breaks out upward, but must clear the villain's keys and the seal.
          const vKeys = box(document.querySelectorAll('.keys')[0]);
          if (hNum.top < vKeys.bottom) out.push('The hero number reaches the villain keys');
          apart(hNum, box('#seal'));
          apart(hNum, box('#hero .round'));
          apart(hNum, ink('#hero .max'));
          if (hNum.bottom > hero.bottom) out.push('The hero number spills out of the bottom of its panel');
          within(ink('#hero .line'), box('#hero .round'));

          for (const sel of ['#set', '#next', '#seal', ...[0, 1, 2, 3].map((i) => document.querySelectorAll('.key')[i])]) {
            const b = box(sel);
            within(b, view);
            if (b.height < 30 || b.width < 44) out.push(`${b.name} is too small to tap (${Math.round(b.width)}×${Math.round(b.height)})`);
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
