// The lines and sound effects that change during play (the fixed labels are in index.html).
// tests/tools/fonts.js reads the app's files to cut the bundled fonts down to the characters used:
// after adding text, run `npm run fonts` (a test checks every character is covered).

// Balloon lines, by share of max HP left: lineFor() picks the first entry whose limit the share is
// at or under. "\n" marks where a line breaks into its next column, at a phrase, as a letterer
// would. Keep each phrase to 5 characters at most ("!!" counts as one): that's what fits in the
// iPhone SE's balloons (a layout test checks no line wraps mid-phrase).

// The villain's lines, for each of their two stages. The first stage is confident; at 0 they aren't
// beaten, they're about to stop holding back. The final stage opens with the reveal of their true
// power.
export const VILLAIN_LINES = {
  first: [
    [0, '遊びは\n終わりだ…'], // "Playtime's over…" (not defeated: about to transform)
    [0.3, 'ぐっ…!!'], // "Ngh…!!"
    [0.99, '小癪な!'], // "Insolent!"
    [Infinity, 'フン…'], // "Hmph…"
  ],
  final: [
    [0, 'バ…\nバカな…!!'], // "Im… impossible…!!" (defeated)
    [0.3, 'ありえん…!!'], // "This can't be…!!"
    [0.99, 'その程度か!'], // "Is that all you've got!"
    [Infinity, 'これが\n真の力だ!!'], // "This is my true power!!" (the reveal)
  ],
};

export const HERO_LINES = [
  [0, '………'],
  [0.3, 'くっ…\nまだだ…!!'], // "Ngh... not yet...!!"
  [0.99, 'まだまだ!'], // "Not done yet!" (hurt but steady)
  [Infinity, 'いくぞ!!'], // "Here I go!!"
];

export const HERO_WIN = 'やった!!'; // "I did it!!", once the villain's last stage is down

export const lineFor = (lines, share) => lines.find(([limit]) => share <= limit)[1];

// Sound effects (js/sfx.js letters them): a few classic words per action, `big` for holds.
// Exclamation marks scale with the moment: "!" for a tap's hit, "!!" for a hold's, and "!!!" only
// for VICTORY. Sounds that aren't impacts (a hiss, a rumble, a breath) take none.
export const SFX = {
  hit: { small: ['ドン!', 'バキッ!', 'ドカッ!'], big: ['ドゴォン!!', 'ズドン!!'] }, // impacts
  heal: { small: ['シュウ…'], big: ['シュウウ…'] }, // a soft hiss
  boost: { small: ['ゴゴゴ'], big: ['ゴゴゴゴ'] }, // the classic rumble of rising power
  unboost: { small: ['フッ…'], big: ['フッ…'] }, // a breath going out
};
