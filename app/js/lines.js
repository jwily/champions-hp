// The lines and sound effects that change during play (the fixed labels are in index.html).
// tests/tools/fonts.js reads the app's files to cut the bundled fonts down to the characters used:
// after adding text, run `npm run fonts` (a test checks every character is covered).

// Balloon lines by share of max HP left: the first entry whose limit the share is at or under.
export const VILLAIN_LINES = [
  [0, 'バ…バカな…!!'], // "Im-impossible...!!" (defeated)
  [0.3, 'ぐっ…!!'], // "Ngh...!!"
  [0.99, '小癪な!!'], // "Insolent!!"
  [Infinity, 'フン…'], // "Hmph..."
];

export const HERO_LINES = [
  [0, '………'],
  [0.3, 'くっ…まだだ…!!'], // "Ngh... not yet...!!"
  [0.99, 'まだまだ!!'], // "Not done yet!!"
  [Infinity, 'いくぞ!!'], // "Here I go!!"
];

export const lineFor = (lines, share) => lines.find(([limit]) => share <= limit)[1];

// Sound effects, written vertically beside the number.
export const SFX = {
  hit: ['ドン!', 'バキ!', 'ドカッ', 'ガッ'],
  heal: ['シュウ…', 'ポウ'],
  boost: ['ゴゴゴ', 'ズズ…'],
  unboost: ['フッ…', 'シュン'],
};
