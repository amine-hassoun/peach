// Remembers the theme the user picked (device-local, so it is not part of the synced stays data).
// Nothing stored = follow the system setting.
const KEY = 'peach.theme';
const ls = () => globalThis.localStorage;

export function loadTheme(storage = ls()) {
  try {
    const v = storage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // storage blocked: just follow the system
  }
}

export function saveTheme(theme, storage = ls()) {
  try {
    storage.setItem(KEY, theme);
  } catch {
    /* private mode / quota: the choice just won't be remembered */
  }
}
