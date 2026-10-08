/**
 * The mode switch (#144, ADR 0011): one design in two modes (#142, light =
 * Bronze, dark = Foil), and a choice between them — System, light or dark.
 *
 * The choice is **device state**, not `Tournament` state: it is remembered in
 * this browser's `localStorage` and never travels in the `SetupLink`. A shared
 * link opens in the receiver's own mode.
 *
 * System is the absence of a choice: nothing stored, no `data-theme` on
 * `<html>`, and the stylesheet follows `prefers-color-scheme` as it always
 * has. A forced mode is `data-theme="light"` or `"dark"` on `<html>`.
 *
 * Storage may throw on every touch (Safari private mode, storage disabled by
 * policy). That reads as System and loses the write — the mode still changes
 * for the page, it just is not kept (ADR 0002 in spirit: no input is an
 * error).
 *
 * The first application happens before this module ever loads: a classic
 * inline script in `<head>` of `views/shell.php` reads the same key and sets
 * the same attribute before the first paint. It cannot import this file, so
 * `THEME_KEY` and the attribute are written there a second time;
 * `test/ui-theme.test.mjs` runs that script against what `writeTheme()`
 * leaves behind, so the two cannot drift apart unnoticed.
 */

/** The cycle of the button, in order. */
export const THEMES = ['system', 'light', 'dark'];

/** The `localStorage` key — also spelled out in `views/shell.php`. */
export const THEME_KEY = 'theme';

const FORCED = new Set(['light', 'dark']);

const LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

/** The mode after `theme` on the button: System → light → dark → System. */
export function nextTheme(theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/** The stored choice; nothing, anything unknown or a throwing storage is System. */
export function readTheme(storage) {
  try {
    const stored = storage.getItem(THEME_KEY);
    return FORCED.has(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Remember `theme`; System is stored as nothing. A throwing storage loses it silently. */
export function writeTheme(storage, theme) {
  try {
    if (FORCED.has(theme)) storage.setItem(THEME_KEY, theme);
    else storage.removeItem(THEME_KEY);
  } catch {
    // Not kept past this page; the mode on screen changes all the same.
  }
}

/** Put `theme` on the root element: `data-theme` for a forced mode, none for System. */
export function applyTheme(root, theme) {
  if (FORCED.has(theme)) root.dataset.theme = theme;
  else delete root.dataset.theme;
}

/** Reading `window.localStorage` itself can throw; that is no storage at all. */
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The Alpine component of the button in the head of `Details`. Small and
 * apart from `planApp()`: the mode has nothing to do with the plan.
 */
export function themeToggle({ storage = browserStorage(), root = document.documentElement } = {}) {
  return {
    theme: readTheme(storage),
    get label() {
      return `Mode: ${LABELS[this.theme]}`;
    },
    next() {
      this.theme = nextTheme(this.theme);
      applyTheme(root, this.theme);
      writeTheme(storage, this.theme);
    },
  };
}
