// Saving on the phone (localStorage). Storage can be full or blocked (private browsing, say): the
// app then carries on from memory, so these never throw.

/** The saved text for `key`, or null if there's none or it can't be read. */
export function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves `value` (as text) under `key`. Returns whether it was saved. */
export function save(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
