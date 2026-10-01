/**
 * The SetupLink on screen (#72): the two places where the encoding of #47
 * becomes visible — the `Copy link` button on the Set block, and the
 * `LinkMigration` report as the app's one overlay.
 *
 * Everything here is on the proven side of the seam (ADR 0004): what the
 * button copies and what the report says are pure answers to plain inputs.
 * The rind in `plan.mjs` only hands in what a browser has — the page's own
 * address, the clipboard, the button element — and nothing here reads a
 * global itself. This file writes no word of the wire format either: the copy
 * form is `encode()`'s, the report is #51's data structure, read as it is.
 */

/**
 * The text that lands on the clipboard: the page the app runs on, with the
 * copy form as its whole query. A bare `?v=1&…` pasted into Discord is no
 * link, so the address is resolved against the page; whatever query and hash
 * the page carries now are replaced, because the copy form is complete on its
 * own (#47, "Die Kopierform ist immer vollständig").
 */
export function linkAddress(query, page) {
  return new URL(query, page).href;
}

/**
 * Puts `text` on `clipboard` and answers what happened: `'copied'`, or
 * `'manual'` when there is no clipboard interface or it refused. The second
 * answer is the field with the address preselected (#72 AC 4) — the button
 * never claims a success the browser did not grant.
 */
export async function copyText(text, clipboard) {
  if (typeof clipboard?.writeText !== 'function') return 'manual';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'manual';
  }
}

/** How long the button says `Copied` before it falls back. */
export const COPIED_MS = 1500;

/**
 * The confirmation, and it is **fleeting** — the raffle hit's kind, not a
 * state (#72 AC 3; #61, "Copy link"). It lives on the button element as a data
 * attribute for one moment and is taken off again; nothing in the component
 * remembers that a copy happened. A second copy inside the moment restarts it
 * rather than stacking a second fall-back on the first.
 */
export function flashCopied(button, { later = setTimeout, cancel = clearTimeout } = {}) {
  if (!button) return;
  if (button._linkTimer != null) cancel(button._linkTimer);
  button.dataset.linkCopied = '';
  button._linkTimer = later(() => {
    delete button.dataset.linkCopied;
    button._linkTimer = null;
  }, COPIED_MS);
}
