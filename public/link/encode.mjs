/**
 * The write half of the wire format: the base and the pinned sliders in, a
 * query string out. The key register in `keys.mjs` (#48) is the single source
 * of truth for what a key means and in which order it is written; nothing here
 * carries a second idea of the key list (docs/agents/setup-link.md).
 */

import { CURRENT_VERSION, KEYS } from './keys.mjs';

/**
 * `{ game, type, pins }` → the **copy form**: a complete query string, the
 * base first, then every pinned slider in the register's order.
 *
 * The base — `v`, `game`, `type` — is written in every case, pinned sliders
 * or none. That is exactly the link #44 means: "Weekend, nothing touched". An
 * absent slider keeps computing and tracks the player count, but an absent
 * type would be *picked*, and "first of the list" is a silent decision
 * (ADR 0007, addendum #44).
 *
 * **The order is the register's, never the one the pins arrived in.** The same
 * stand therefore always yields the same string: a link is compared by eye,
 * and `replaceState` must not re-sort the address on every drag (#47, "Die
 * Reihenfolge ist fest").
 */
export function encode({ game, type, pins = {} } = {}) {
  const parts = [`v=${CURRENT_VERSION}`, `game=${field(game)}`, `type=${field(type)}`];
  for (const { key, type: valueType } of KEYS) {
    const value = pins[key];
    // `null` is the four trailing sliders' "the core computes it" — that is a
    // slider on `auto`, and an unpinned slider is simply not in the link.
    if (value === undefined || value === null) continue;
    const written = writeValue(valueType, value);
    if (written !== ABSENT) parts.push(`${key}=${field(written)}`);
  }
  return `?${parts.join('&')}`;
}

/**
 * `{ game, type, pins }` → what the address bar should become, or `null` for
 * **leave it alone**.
 *
 * Two rules draw a line between the address bar and the copy form, and the
 * line runs between two functions rather than inside one. `encode()` is the
 * copy form and names the base always. The address bar does not: a freshly
 * opened `prizing.optcg.ch/` does not turn into `…?v=1&game=…&type=…` on the
 * first paint. "A link names its base always" protects a link **in
 * circulation**; an app merely opened has none, and changing the address
 * because someone opened the page is a movement without a counterpart (#47,
 * "Writing the address bar"). The **first pin** then writes `v`, `game`,
 * `type` and that pin in one go.
 *
 * **Why the rule lives here** and not one layer down or one layer up. Not in
 * `location.mjs`: that file is the unproven rim of the seam and carries no
 * logic, so a decision parked there is a decision nothing checks. Not in the
 * caller either, which is the Alpine shell: it would be just as unproven, and
 * the shell would then hold a rule about a *public interface* — when a
 * SetupLink writes itself into somebody's address bar. A pure function is the
 * only layer where `node --test` can hold it, so the caller is left with the
 * one thing it cannot delegate: `null` means it calls nothing (the wiring is
 * #89).
 *
 * A pin set whose every value encodes as absent counts as no pin at all — its
 * copy form is the bare base, so writing it would be exactly the movement
 * without a counterpart.
 */
export function addressFor(setup) {
  const query = encode(setup);
  return query === encode({ ...setup, pins: {} }) ? null : query;
}

/** What a pinned value that says nothing writes as: nothing at all. */
const ABSENT = Symbol('absent');

function writeValue(type, value) {
  switch (type) {
    case 'bit':
      return value ? '1' : '0';
    case 'vector':
      return writeVector(value);
    case 'rankCountMap':
      return writeRankCountMap(value);
    default:
      return String(value);
  }
}

/**
 * The DisplayReservation: dot-separated counts, index 0 = Rank 1, **trailing
 * zeros dropped** — and an all-zero vector drops away entirely.
 *
 * Nothing is lost by that. The vector starts neutral and never follows a
 * calculation, so a pin on an empty one has no effect on the plan and would
 * only lengthen the link (#47, "Die zwei zusammengesetzten Werte"). It is the
 * counterpart of `decode`'s `readVector`, which never has to put a trailing
 * zero back precisely because none ever reaches the wire.
 */
function writeVector(value) {
  const limbs = [...value];
  while (limbs.length > 0 && limbs.at(-1) === 0) limbs.pop();
  return limbs.length === 0 ? ABSENT : limbs.join('.');
}

/**
 * The `manual` share of the WinnerPackAllocation: `rank:count` pairs,
 * ascending by rank. The sort is written out rather than left to the object's
 * own key order — integer-like keys happen to iterate ascending today, and a
 * stable string is a promise this function makes, not one it borrows.
 * An empty card encodes as absent, for the vector's reason.
 */
function writeRankCountMap(value) {
  const pairs = Object.entries(value)
    .map(([rank, count]) => [Number(rank), count])
    .sort(([a], [b]) => a - b);
  return pairs.length === 0 ? ABSENT : pairs.map(([rank, count]) => `${rank}:${count}`).join(',');
}

/**
 * Percent-encoding, minus the two characters the composite shapes are built
 * from. `:` and `,` stand as they are in a query (RFC 3986, `pchar` and
 * `sub-delims`), and `manualWinner=3%3A1%2C7%3A2` would be the same link read
 * by nobody. The link is pasted into Discord and compared by eye, so it stays
 * readable.
 */
function field(value) {
  return encodeURIComponent(value).replaceAll('%3A', ':').replaceAll('%2C', ',');
}
