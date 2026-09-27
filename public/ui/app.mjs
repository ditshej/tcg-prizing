/**
 * Registers the Plan screen's Alpine component before Alpine itself starts.
 * No bundler, no import of Alpine here (ADR 0004): this is a module script,
 * Alpine is the vendored classic `defer` script right after it in
 * `views/shell.php`, and the `alpine:init` event is Alpine's own hook for
 * registering data factories ahead of `Alpine.start()`.
 */

import { planApp } from './plan.mjs';

document.addEventListener('alpine:init', () => {
  window.Alpine.data('planApp', planApp);
});
