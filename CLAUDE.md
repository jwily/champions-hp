# Champions HP: notes for Claude

A personal iPhone home-screen web app for tracking hero and villain HP in solo Marvel Champions,
styled after the classic Naruto manga's black-gutter flashback pages. Personal use, one user.
A sibling of Bgt-J (`~/projects/budget-tracker`), set up the same way. Read README.md for what the
app does; this file covers how to work on it. Card rules questions go to `~/projects/marvel-champions`.

## Layout and commands

- `app/` is the deployable app: plain HTML/CSS/ES modules, no build step, no dependencies.
  Serve it with `cd app && python3 -m http.server 8000`.
- `tests/`: `npm test` runs `main`, `layout` and `updates` on WebKit and Chromium at once (it starts
  its own server on port 8766; the deploy scenario uses 8767). `updates` is Chromium-only: Playwright's
  WebKit can't reload offline through a service worker. Service workers are blocked in scenarios
  unless they ask for them (`open({ serviceWorkers: 'allow' })`). `npm test -- webkit layout` runs one engine and pass; `ONLY=<part of a
  name> npm test` runs matching scenarios. First time: `npm install && npm run setup`.
- Scenarios are independent (`scenario(name, async (open) => ...)`): each opens a fresh app with
  just the data it needs (`open({ game: { hero: [hp, max, up], villain: [...], stage, boost } })`).
- Holds are checked on Playwright's fake clock (`open({ clock: true })`, paused after load; `hold()`
  runs it on), never real time. Left unpaused, it also follows real time, and a busy machine added
  an extra repeat.
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
- Max HP sits small in each panel's bottom-right corner, bonus inline (the user's preference; tried
  and reverted: max anchored beside/under the number).
- `js/sfx.js` letters the sound effects, restrained on purpose: the user found per-letter wobble,
  wide tilts, several ink styles and many words "trying too hard to be Japanese". So: one heavy
  lettering, solid for a change of 1 and outlined and larger for a hold, a few gentle tilts, a short
  list of classic words. No animation: an effect appears, stays 1 s, and goes. Spots come from
  ZONES, the gaps left by the number, balloon and corner boxes; each zone sets the direction
  (across in wide gaps, down in narrow ones, so a word never stands over the digits). A burst
  spreads out, three at most per panel. tests/layout.js fires many and checks each center.
- **The 術 toggle** (`powerUsed`, state version 3; `MIGRATIONS` upgrades v1 and v2): one toggle
  for the hero's special ability: the bare character, no box; off-white with a black outline, and
  filled blue with a deep navy outline when used (an outline-only change wasn't noticeable). It replaced round / phase tracking with
  per-period ability tokens (v2), which the user found to be more than they needed. 術 ("jutsu")
  was the user's pick over 力 ("power").
- `js/lines.js`: balloon lines and sound-effect words. `js/art.js`: the inked spirals and rays.
  `js/sheet.js`: the HP entry sheet.
- **Presses** (`js/presses.js`, lessons from Bgt-J's presses.js, not a copy): a control activates
  (its `click()`) when a press lifts still over it; the browser's own click never counts (cancelled
  at touchend on the touched element only, and stopped if it comes: any click with a click count);
  each finger is tracked on its own; fields and labels are left native so iOS can focus them. Give
  controls plain `click` listeners. Holds use `onHold` (450 ms, repeating every 550 ms; drifting
  10px calls a hold off). Deliberately not taken from Bgt-J: sending a tap in a gap to the nearest
  control (between − and + that would guess the sign). No double-tap detection (it would misread
  fast taps).
- **Fonts are subsets.** `npm run fonts` downloads Dela Gothic One and Zen Antique cut to the
  characters the app uses (Google Fonts `text=`), and writes `fonts/chars.txt`. After adding any
  text, run it; a test fails if a character isn't covered.
- **Offline and updates** (`sw.js`): launches are served from a saved complete version; each
  launch, and each return from the background, downloads `files.json` past the browser cache
  (GitHub Pages sends max-age=600), then every file it lists, and saves a new version only if
  every file matches its SHA-256 fingerprint. That stops a deploy still spreading across GitHub's
  servers from being saved as a mix (it happened once: new page, old stylesheet). `files.json` is
  built at deploy by the workflow (`node tests/tools/manifest.js`), not committed; the test server
  builds it on the fly. Its LEFT_OUT list, not a hand-kept list, decides what's offline. A new
  version is switched to only at a launch, so a running app never mixes files. The first launch on
  a new version shows "App updated" for 4 s in a caption over the running head (`notice()`).
- Researched from chapter 1 on Shueisha's Jump+ reader (Nov 2026): straight-edged panels with thin
  ink borders (slanted cuts are rare in Naruto), rows a bit further apart than columns
  (`--row-gap` 12px, `--col-gap` 8px), solid black gutters and margins on flashback pages, flat dot
  tone and line work rather than heavy tone, vertical lettering with "!!" set upright, heavy
  hand-lettered katakana sound effects, the chapter-title format "[mark with ruby]1：TITLE!!", and the
  running head "NARUTO—ナルト—1". Spirals (uzumaki) recur everywhere.
- Paper is dimmed (`--paper` #d8d1c1) so the panels don't glare in a dim room; ink is near-black.
- Ink lines must be even: the villain's shout balloon is an SVG polygon with a non-scaling 1.5px
  stroke (a paper shape clipped inside an ink one made the long spikes' line several times
  thicker, which the user spotted as amateurish). Balloon text is in the antique serif: the heavy
  font blots many-stroke kanji at small sizes. The 増 seal is a hanko: one centered character in a
  double-ruled frame, no furigana (it crowded the character). Both balloons are SVG outlines with a
  non-scaling stroke (even line): a symmetrical 12-point star and a plain oval. Tried and reverted
  by the user: a many-spiked shout and a lumpy oval with a tail, both cut off by the panel edge.
- Limits and states are designed, not left to the happy path: a key that can't change anything shows
  faint (`.inert`), a defeated side's number is a hollow outline, Next stage fades back and forth
  between paper and ink when the villain is down (the user prefers the fade to a hard blink, even
  though mid-fade it passes through grey). HP and max read together (`.reading`).
- Panel borders are ruled straight (as Naruto's are); no wobble filter. Tap targets are 44px+.
- Two spot colors, each with one job: blue for the 術 toggle when used, and orange only for the max-HP mode (the inked 増 seal, the keys' borders, the
  bonus). Keep it meaning one thing.
- The hero's number breaks out over its panel's top border; it must clear the villain keys and the
  seal (layout test).
- The antique serif goes only on paper (ink on paper reads as manga lettering; on black it read as
  a missing-font fallback, the user's note). On the black, use the heavy font or small running-head
  text. Buttons on the page are narration boxes (`.narration-button`: paper, ink border).
- The HP sheet is a page of its own: villain panel above hero panel (as on the main page), labels
  as narration boxes, the fields' numbers in the heavy font, Cancel / FIGHT!! as key panels. It
  opens with nothing focused (the user's choice): tap a panel to type. A bad entry is shown in its
  own panel (its label says "Villain HP: 1–99", heavier border), in ink: no second accent color.
- The sheet's Cancel / FIGHT!! row sits at the bottom, under the thumb (the user's request), and
  rides above the keyboard while it's open (`js/keyboard.js` sets `--keyboard` from the visual
  viewport: iOS overlays the keyboard without resizing the page, and its number pad has no Done
  key). The field panels shrink to share what's left.
- Never put the manga's artwork, logos or village symbols in the app.

## Working with this user

- iPhone 14 Pro. Plays Marvel Champions solo.
- Same preferences as in Bgt-J's CLAUDE.md: wants reasoning shown, verification before "done",
  one recommendation for design questions, separate descriptive commits, DRY code.

## Deploying

- GitHub Pages from `master` via `.github/workflows/pages.yml`; the address is
  https://www.johnjylee.com/champions-hp/ (the user's domain). Never change it: saved games are tied
  to it. Commit email for this repo is the user's personal one (repo git config), not the work one.
