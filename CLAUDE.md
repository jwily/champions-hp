# Champions HP: notes for Claude

A personal iPhone home-screen web app for tracking hero and villain HP in solo Marvel Champions,
styled after the classic Naruto manga's black-gutter flashback pages. Personal use, one user.
A sibling of Bgt-J (`~/projects/budget-tracker`), set up the same way. Read README.md for what the
app does; this file covers how to work on it. Card rules questions go to `~/projects/marvel-champions`.

## Layout and commands

- `app/` is the deployable app: plain HTML/CSS/ES modules, no build step, no dependencies.
  Serve it with `cd app && python3 -m http.server 8000`.
- `tests/`: `npm test` runs `main` and `layout` on WebKit and Chromium at once (it starts its own
  server on port 8766). `npm test -- webkit layout` runs one engine and pass; `ONLY=<part of a
  name> npm test` runs matching scenarios. First time: `npm install && npm run setup`.
- Scenarios are independent (`scenario(name, async (open) => ...)`): each opens a fresh app with
  just the data it needs (`open({ game: { hero: [hp, max, up], villain: [...], stage, boost } })`).
- Holds are checked on Playwright's fake clock (`open({ clock: true })`, `hold()` runs it), never
  real time.
- Layout checks measure the big numbers' actual glyphs (canvas text metrics), not their line boxes,
  which reach far above the digits.
- Run `npm test` before every commit; `.githooks/pre-push` runs it before a push that touches `app/`
  or `tests/` (`git config core.hooksPath .githooks`). Never bypass it unless the user says so.
  When behavior changes, update or add checks in the same commit; when fixing a bug, add a check
  that would have caught it.

## How the code fits together

- `js/store.js` owns `state` (one JSON object in localStorage under `champions-hp`, version 1).
  Every change goes through a store function, which saves and fires `hp:change`; `app.js` redraws.
  Changing the saved shape: bump `VERSION` and migrate old data rather than dropping it.
- Max HP follows the rules: "gets +X hit points" raises the dial by X and, when it ends, lowers it
  by X (RR v1.8 p. 22); heals stop at max (p. 21). In state, `max` is the printed/typed value and
  `up` the bonus; `total()` is the current maximum.
- `js/lines.js`: balloon lines and sound effects. `js/press.js`: tap = 1, hold = 5 after 450 ms,
  repeating every 550 ms (no double-tap detection: it would misread fast taps). `js/art.js`: the
  inked spirals and rays. `js/sheet.js`: the HP entry sheet.
- **Fonts are subsets.** `npm run fonts` downloads Dela Gothic One and Zen Antique cut to the
  characters the app uses (Google Fonts `text=`), and writes `fonts/chars.txt`. After adding any
  text, run it; a test fails if a character isn't covered.
- **Offline:** `sw.js` caches FILES on install and serves from the cache. **Bump `VERSION` in sw.js
  with every deploy that changes app files**, or phones keep the old copy. Add new files to FILES
  (a test checks).

## Design rules

- Researched from chapter 1 on Shueisha's Jump+ reader (Nov 2026): straight-edged panels with thin
  ink borders (slanted cuts are rare in Naruto), rows a bit further apart than columns
  (`--row-gap` 12px, `--col-gap` 8px), solid black gutters and margins on flashback pages, flat dot
  tone and line work rather than heavy tone, vertical lettering with "!!" set upright, heavy
  hand-lettered katakana sound effects, the chapter-title format "[mark with ruby]1：TITLE!!", and the
  running head "NARUTO—ナルト—1". Spirals (uzumaki) recur everywhere.
- Paper is dimmed (`--paper` #d8d1c1) so the panels don't glare in a dim room; ink is near-black.
- One spot color, orange, and only for the max-HP mode (the inked 増 seal, the keys' borders, the
  bonus). Keep it meaning one thing.
- The hero's number breaks out over its panel's top border; it must clear the villain keys and the
  seal (layout test).
- Never put the manga's artwork, logos or village symbols in the app.

## Working with this user

- iPhone 14 Pro. Plays Marvel Champions solo.
- Same preferences as in Bgt-J's CLAUDE.md: wants reasoning shown, verification before "done",
  one recommendation for design questions, separate descriptive commits, DRY code.

## Deploying

- GitHub Pages from `master` via `.github/workflows/pages.yml`; the address is
  https://www.johnjylee.com/champions-hp/ (the user's domain). Never change it: saved games are tied
  to it. Commit email for this repo is the user's personal one (repo git config), not the work one.
