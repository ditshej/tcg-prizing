/**
 * Registers the Plan screen's Alpine component before Alpine itself starts.
 * No bundler, no import of Alpine here (ADR 0004): this is a module script,
 * Alpine is the vendored classic `defer` script right after it in
 * `views/shell.php`, and the `alpine:init` event is Alpine's own hook for
 * registering data factories ahead of `Alpine.start()`.
 *
 * `planApp` is registered as it stands, with no argument: called that way it
 * takes the real seam of #47 — the two functions that read and write the
 * address bar — and reads the link the app was opened at before its first
 * paint (#89). A `node --test` run calls the same factory with a seam of its
 * own; nothing about that reaches this file.
 *
 * `themeToggle` is the mode button in the head of `Details` (#144), a
 * component of its own: the mode is device state, not plan state. Its first
 * application happens earlier still, in `<head>` (`views/shell.php`).
 *
 * `footMark` is the sliding marking of the foot (#158), nested in
 * `planApp()`'s scope on the `<footer>`.
 */

import { planApp } from './plan.mjs';
import { themeToggle } from './theme.mjs';
import { footMark } from './foot.mjs';

document.addEventListener('alpine:init', () => {
  window.Alpine.data('planApp', planApp);
  window.Alpine.data('themeToggle', themeToggle);
  window.Alpine.data('footMark', footMark);
});
