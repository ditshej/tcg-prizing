/**
 * The SetupLink on screen (#72): the two places where the encoding of #47
 * becomes visible — Share in the plan head (#143) with its two branches,
 * the system's share sheet wherever `navigator.share` exists and the bubble
 * with `Copy link` where it does not (#155, K3), and the `LinkMigration`
 * report as the app's one overlay.
 *
 * Everything here is on the proven side of the seam (ADR 0004): what the
 * button copies and what the report says are pure answers to plain inputs.
 * The rind in `plan.mjs` only hands in what a browser has —
 * `navigator.share`, the page's own address, the clipboard, the document for
 * the `execCommand` fallback, the button element — and nothing here reads a
 * global itself. This file writes no word of the wire format either: the copy
 * form is `encode()`'s, the report is #51's data structure, read as it is.
 */

import { PIN_LABELS } from './controls.mjs';

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
 * Which way Share goes (#155, F3 c as refined by K3): `'system'` — straight
 * into the system's share sheet, no bubble — on every device that has a
 * `navigator.share` to call, Safari on the Mac, tablets and Edge on Windows
 * included; `'bubble'` — the bubble with `Copy link` — only where there is
 * none (plain http in the LAN is no secure context, so it has none). The
 * pointer plays no part: K3 dropped the `(pointer: coarse)` condition.
 */
export function shareBranch({ share }) {
  return typeof share === 'function' ? 'system' : 'bubble';
}

/**
 * Puts `text` on `clipboard` and answers what happened: `'copied'`, or
 * `'manual'` when nothing could take it. The second answer is the field with
 * the address preselected (#72 AC 4) — the button never claims a success the
 * browser did not grant.
 *
 * Where there is no clipboard interface (plain http is no secure context) or
 * it refused, `fallback` — `execCopy()` at the rind — is tried before the
 * field (#155). It reports honestly, so only its `true` is a copy; `false`
 * or a throw is not.
 */
export async function copyText(text, clipboard, fallback) {
  if (typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return 'copied';
    } catch {
      // Refused: the fallback below gets its chance.
    }
  }
  if (typeof fallback !== 'function') return 'manual';
  try {
    return fallback(text) === true ? 'copied' : 'manual';
  } catch {
    return 'manual';
  }
}

/**
 * The old way onto the clipboard, and it works without a secure context:
 * a throwaway field holding `text`, selected, `execCommand('copy')`, gone
 * again. Answers what the browser answered — `true` only if it says it
 * copied (#155; #72 AC 4).
 */
export function execCopy(text, doc) {
  if (typeof doc?.createElement !== 'function' || typeof doc.execCommand !== 'function') return false;
  const field = doc.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  doc.body.append(field);
  try {
    field.select();
    return doc.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/** How long `Copy link` is called `Copied` before it falls back — "rund
 *  2 s" (#143, decision 4; since #155 on the button in Share's bubble). */
export const COPIED_MS = 2000;

/**
 * The confirmation, and it is **fleeting** — the raffle hit's kind, not a
 * state (#72 AC 3; #61, "Copy link"). It lives on an element — since #155
 * the `Copy link` button in the bubble at Share, which reads `Copied` while
 * it carries the mark — as a data attribute for one moment and is taken off
 * again; nothing in the component remembers that a copy happened.
 * A second copy inside the moment restarts it rather than stacking a second
 * fall-back on the first.
 */
export function flashCopied(el, { later = setTimeout, cancel = clearTimeout } = {}) {
  if (!el) return;
  if (el._linkTimer != null) cancel(el._linkTimer);
  el.dataset.linkCopied = '';
  el._linkTimer = later(() => {
    delete el.dataset.linkCopied;
    el._linkTimer = null;
  }, COPIED_MS);
}

/* ── The LinkMigration report (#72, the data from #51 and #52) ─────────── */

/** The prompt, and it hangs on the address bar having been rewritten. */
export const RESAVE_BOOKMARK = 'The address bar now holds this link as it was read. Save your bookmark again.';

/**
 * #51's report → what the overlay says, or `null` when there is nothing to
 * say. Each line is a list of parts, `{ text }` or `{ wire }`: a wire part is
 * shown in code type, and it is used exactly where there is no screen word.
 *
 * Two decisions of #72 shape it:
 *
 * - **A control is named by its screen word** — the sheet's own, the same
 *   list the drop question reads out (`PIN_LABELS`). Where none exists — a
 *   slider removed with no successor, a name no version ever knew — the wire
 *   key stands, in code type. A label for something that no longer exists
 *   cannot be invented, and nothing is invented here (#52).
 * - **The bookmark prompt hangs on whether the address bar was rewritten**,
 *   not on whether something was lost. That is the report's own statement,
 *   `resaveBookmark` (#51 AC 5), false in exactly the future case: there the
 *   address stays as it came (#47), the bookmark is the *newer* copy, and
 *   "save it again" would be wrong. The future case gets its own sentence
 *   instead — the link is newer than this app, only its base was read.
 */
export function reportView(report, games = []) {
  if (!report) return null;
  const words = baseWords(games);
  const lines = (report.entries ?? []).map((entry) => lineFor(entry, words)).filter(Boolean);
  const resave = report.resaveBookmark === true;
  return { lines, resave, bookmark: resave ? RESAVE_BOOKMARK : null };
}

/** The screen word of a control, or the wire key in code type when it has none. */
function control(key) {
  return Object.hasOwn(PIN_LABELS, key) ? { text: PIN_LABELS[key] } : { wire: key };
}

/** The titles of the Games and TournamentTypes the catalogue knows, by id. */
function baseWords(games) {
  const game = new Map();
  const type = new Map();
  for (const entry of games ?? []) {
    game.set(entry.id, entry.title ?? entry.id);
    for (const t of entry.types ?? []) type.set(t.id, t.title ?? t.id);
  }
  return { game, type };
}

/** A base name: its title if the catalogue knows it, else the name as it stood. */
function baseName(map, id) {
  return map.has(id) ? { text: map.get(id) } : { wire: String(id) };
}

const t = (text) => ({ text });

function replaced(level, noun, entry, map) {
  const now = baseName(map, entry.now);
  if (entry.was == null) return [t(`No ${noun} was named — opened as `), now, t('.')];
  const was = { wire: String(entry.was) };
  if (entry.by === 'migration') return [t(`${level} `), was, t(' is now '), now, t('.')];
  return [t(`${level} `), was, t(' is unknown — opened as '), now, t('.')];
}

function lineFor(entry, words) {
  switch (entry.kind) {
    case 'renamed':
      return [{ wire: String(entry.was) }, t(' is now '), control(entry.key), t('.')];
    case 'dropped':
      return [control(entry.key), t(' no longer exists — its value was dropped.')];
    case 'setByMigration':
      return [control(entry.key), t(` was set to ${String(entry.value)}, so the plan stays the same.`)];
    case 'typeReplaced':
      return replaced('Type', 'type', entry, words.type);
    case 'gameReplaced':
      return replaced('Game', 'game', entry, words.game);
    case 'unknownKey':
      return [t('This app does not know '), { wire: String(entry.key) }, t(' — it was left out.')];
    case 'unreadableValue':
      return [control(entry.key), t(' could not be read — it was left out.')];
    case 'futureVersion':
      return [t('This link is newer than this app. Only its game and type were read.')];
    case 'unreadableVersion':
      return [t('This link is damaged: it names no version this app can read. Only its game and type were read.')];
    default:
      return null;
  }
}
