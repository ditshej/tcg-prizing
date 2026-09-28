/**
 * The second seam of Spec 3, and it is a rim rather than a layer (#47,
 * "The seam"). Two things about a SetupLink are not pure — reading the address
 * and writing it — and they live here, in two functions that are **not**
 * proven, so that everything under them can be: the register, `decode`,
 * `encode` and the migration chain are plain ES modules a `node --test` run
 * imports without a browser.
 *
 * Nothing else in this project touches `location` or `history.replaceState`,
 * and `test/link-encode.test.mjs` holds that as a rule over the tree (#50
 * AC 6). Were a third place to reach for either, the public interface of this
 * app would be unproven exactly where it is public.
 *
 * **No logic here, deliberately.** Not a branch, not a fallback, not an
 * import: whatever needs deciding — above all whether the address bar should
 * be written *at all* — is decided one floor down in `addressFor()`, where a
 * test can reach it. An unproven file that decides something is a decision
 * nothing checks.
 *
 * `replaceState` creates no browser history (ADR 0005): the address bar is a
 * carbon copy of the pinned sliders, not a trail of them, and the back button
 * belongs to whoever arrived at the page.
 */

/** The query of the address the app was opened with, `?` and all. */
export function readLocation() {
  return window.location.search;
}

/** Puts `url` in the address bar without adding a history entry. */
export function writeLocation(url) {
  window.history.replaceState(null, '', url);
}
