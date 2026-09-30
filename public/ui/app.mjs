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
 */

import { planApp } from './plan.mjs';

document.addEventListener('alpine:init', () => {
  window.Alpine.data('planApp', planApp);
});
