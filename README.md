# Champions HP

A hero and villain hit point tracker for solo Marvel Champions, as a home-screen web app for
iPhone. It's styled after the "flashback" pages of the classic Naruto manga: paper panels on black
gutters, vertical speech balloons, and hand-lettered katakana sound effects. Plain HTML, CSS and JS:
no build step, no dependencies.

## Using it

- **Set HP** (top right) starts a game: type the hero's and the villain's HP. The number beside
  "HP—ヒットポイント—" counts games.
- **− / +** under each panel: tap for 1, hold for 5 (and another 5 every half second while held).
  Fast taps all count, so tapping − three times is 3 damage. + heals up to max HP.
- **Next stage ▸** asks for the villain's HP for the next stage. It pulses when the villain is at 0.
- **The 増 seal** ("increase") is the toggle for raising max HP, for effects that say a character
  "gets +X hit points" (Rules Reference v1.8, p. 22). While it's inked orange, − and + change the
  bonus instead: raising it raises max and current HP together; lowering it lowers both, which can
  defeat the character, as the rules say happens when such an effect ends. The bonus shows in
  orange beside max HP, e.g. "/ 13 (+3)". Starting a game or a stage turns the seal off.
- The balloons' lines change with HP (フン… "hmph" → バ…バカな…!! "im-impossible!" for the
  villain; いくぞ!! "here I go!" → くっ…まだだ…!! "ngh… not yet!" for the hero).

## Run it locally

```sh
cd app
python3 -m http.server 8000
```

Open http://localhost:8000. To try it on your phone on the same Wi-Fi, open
`http://<your-mac's-IP>:8000` in Safari (`ipconfig getifaddr en0` prints the IP). Offline support
only works once it's hosted on HTTPS.

## Put it on your phone

Pushing `master` publishes `app/` to GitHub Pages (`.github/workflows/pages.yml`), at
https://www.johnjylee.com/champions-hp/. Open that in Safari, then Share → **Add to Home Screen**.
Your game is saved on the phone, tied to that address.

## Tests

```sh
cd tests
npm install
npm run setup      # downloads the test browsers (once)
npm test           # every check on WebKit (Safari's engine) and Chromium
```

- `main.js`: starting a game, taps and holds, the 増 seal, stages, saving, bad saved data, the
  offline file list, and font coverage
- `layout.js`: on an iPhone SE, 13 mini, 14 Pro and 16 Pro Max, with the widest numbers and the
  longest lines: nothing spills out or overlaps, nothing scrolls, every control is big enough to tap

Tools: `npm run screens` screenshots each phone size into `tests/output/screens/`. `npm run fonts`
re-cuts the bundled fonts after you add text. `npm run icons` redraws the icon and launch screens.

## Credits

Fonts: Dela Gothic One and Zen Antique (SIL Open Font License, `app/fonts/OFL.txt`). The look is
inspired by Masashi Kishimoto's *Naruto*; no artwork from it is used.
