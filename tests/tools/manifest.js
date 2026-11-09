// The app's file manifest: every file the app needs offline, with a SHA-256 fingerprint of each.
// sw.js downloads it first and accepts an update only when every file it then downloads matches
// its fingerprint, so a deploy that's still spreading across GitHub's servers (new page, old
// stylesheet) is never saved as a version.
//
// The deploy workflow writes it to app/files.json (`node tests/tools/manifest.js`); the test server
// serves it from memory. It's not committed: it's built from the files being deployed.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = path.join(__dirname, '..', '..', 'app');

// Not needed offline: the worker itself, the manifest, the fonts' character list (a build note),
// and the launch screens (iOS reads those when the app is added to the home screen).
const LEFT_OUT = (file) => file === 'sw.js' || file === 'files.json' || file === 'fonts/chars.txt' || file.startsWith('icons/launch-');

/** Every file under app/, as paths relative to it. */
function appFiles(dir = APP) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return appFiles(full);
    return e.name.startsWith('.') ? [] : [path.relative(APP, full)];
  });
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/**
 * { files: { path: sha256 } } for every file the app needs offline; './' is the page itself.
 * `read(file)` gives a file's bytes (the test server passes one that can simulate a deploy).
 */
function manifest(read = (file) => fs.readFileSync(path.join(APP, file))) {
  const files = {};
  for (const file of appFiles().filter((f) => !LEFT_OUT(f)).sort()) files[file] = sha256(read(file));
  files['./'] = files['index.html'];
  return { files };
}

module.exports = { APP, appFiles, manifest, LEFT_OUT };

if (require.main === module) {
  fs.writeFileSync(path.join(APP, 'files.json'), JSON.stringify(manifest(), null, 2) + '\n');
  console.log('Wrote app/files.json');
}
