// Updates. New versions download in the background (sw.js) and run from the next launch. The first
// launch running a new one says "App updated" briefly, in a caption over the running head. iOS
// mostly resumes the app rather than relaunching it, so coming back from the background checks too.

import { $ } from './dom.js';

const VERSION_KEY = 'champions-hp-app-version'; // the version the last launch ran (sw.js names them)
const NOTICE_MS = 4000;

const caption = $('#notice');
const runningHead = $('.running');
let noticeTimer = null;

function notice(text) {
  caption.textContent = text;
  showCaption(true);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => showCaption(false), NOTICE_MS);
}

function showCaption(shown) {
  if (!shown) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  caption.hidden = !shown;
  runningHead.hidden = shown;
}

// The service worker says which version is running; a different one from last launch is news.
function heard({ data }) {
  const { version } = data ?? {};
  if (!version) return;
  let seen;
  try {
    seen = localStorage.getItem(VERSION_KEY);
    if (seen === version) return;
    localStorage.setItem(VERSION_KEY, version);
  } catch {
    return; // storage full or blocked: rather say nothing than say it at every launch
  }
  if (seen) notice('App updated');
}

/** Registers the service worker (it only can on HTTPS or localhost), and checks on every return. */
export function watchForUpdates() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (noticeTimer) showCaption(false); // not a stale message hours later
      return;
    }
    navigator.serviceWorker?.controller?.postMessage('check-for-update');
  });
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', heard);
  navigator.serviceWorker.controller?.postMessage('which-version');
}
