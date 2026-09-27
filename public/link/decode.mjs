/**
 * The read half of the wire format: a query string in, the base and the pinned
 * sliders out. The key register in `keys.mjs` (#48) is the single source of
 * truth for what a key means; nothing here carries a second idea of the key
 * list (docs/agents/setup-link.md).
 */

import { CURVES } from '../core/rules.mjs';
import { BASE_KEYS, KEYS } from './keys.mjs';

/**
 * Reads a SetupLink of today's version to `{ version, game, type, pins,
 * unreadable }`.
 *
 * **Everything out of a URL is a string, and turning it into a number is this
 * function's job, not the core's.** The core reads its Settings fields with
 * `Number.isFinite` and `distribute` is total (ADR 0002): a string falls to
 * the fallback without a word, so `{players: '32'}` yields a perfectly
 * plausible plan for two players (measured on #49). A core that tried to
 * interpret strings would hold two truths about what a number is; the read
 * path is where text becomes numbers, so `pins` only ever carries finished
 * values.
 *
 * `unreadable` is the other half of that, and it carries **both** halves of
 * the loss (#49, "Entscheid K4"):
 *
 * - a value that cannot become what its key is — `rankFloor=fuenf`;
 * - a key the register does not know — `rankfloor=5`, one letter small.
 *
 * Both lose exactly the same slider, so both are named. Until this was
 * decided, only the first was: the key typo dropped its slider without a
 * word, and a link whose keys are all misspelled read as an empty, entirely
 * well-formed link. The base keys are of course known and are never reported.
 *
 * One list and not two, because the *tolerance* is #51's: which kind of loss
 * is reported how, and whether one entry per name is the right grain. The read
 * path owes it the raw material — what it could read, and everything it could
 * not. The report itself, the fallback for a `game` or `type` nobody knows and
 * the refusal to read a link from the future stay #51's and #52's; this
 * ticket may otherwise assume a well-formed link of the current version.
 *
 * No cap is applied: a value out of range is taken as it stands (#47,
 * "Unreadable input and the fallback net"), because a link value is a pinned
 * value like any other (ADR 0006).
 */
export function decode(query) {
  const params = new URLSearchParams(String(query ?? '').replace(/^[?#]/, ''));
  const base = Object.fromEntries(BASE_KEYS.map(({ key }) => [key, params.get(key)]));

  const pins = {};
  const unreadable = [];
  for (const { key, type } of KEYS) {
    if (!params.has(key)) continue;
    const value = readValue(type, params.get(key));
    if (value === UNREADABLE) unreadable.push(key);
    else pins[key] = value;
  }
  for (const key of new Set(params.keys())) {
    if (!KNOWN_KEYS.has(key)) unreadable.push(key);
  }

  return { version: Number(base.v), game: base.game, type: base.type, pins, unreadable };
}

/** Every key the v1 register names, base and sliders — anything else is loss. */
const KNOWN_KEYS = new Set([...BASE_KEYS, ...KEYS].map(({ key }) => key));

/** What a value that does not fit its key's type reads as — never a default. */
const UNREADABLE = Symbol('unreadable');

function readValue(type, raw) {
  switch (type) {
    case 'int':
      return readInt(raw);
    case 'curveId':
      return CURVES.some((step) => step.id === raw) ? raw : UNREADABLE;
    case 'bit':
      return raw === '0' ? false : raw === '1' ? true : UNREADABLE;
    case 'vector':
      return readVector(raw);
    case 'rankCountMap':
      return readRankCountMap(raw);
    default:
      return UNREADABLE;
  }
}

/** A whole number, written out — no exponents, no fractions, no `NaN`. */
function readInt(raw) {
  return /^-?\d+$/.test(raw) ? Number(raw) : UNREADABLE;
}

/**
 * The DisplayReservation: dot-separated counts, index 0 = Rank 1. One key,
 * because it is one slider — one bit per slider (ADR 0003). An all-zero
 * vector never reaches the wire (it encodes as absent), so nothing here has
 * to put trailing zeros back.
 *
 * **One bent limb discards the whole vector**, it does not shrink to the good
 * limbs: `displays=2.-1` reads as no vector at all, not as `(2)`. A vector is
 * one slider's one value, and a truncated one would be a reservation nobody
 * made. Decided at #49, "Entscheid K4"; whether #51's report keeps the whole
 * loss or narrows it to the limb is #51's to say.
 */
function readVector(raw) {
  const parts = raw.split('.').map(readInt);
  if (parts.some((part) => part === UNREADABLE || part < 0)) return UNREADABLE;
  return parts;
}

/**
 * The `manual` share of the WinnerPackAllocation: `rank:count` pairs, ascending
 * by rank. A rank twice is two claims on one entry and cannot be read as one,
 * so **the whole card is discarded** rather than one of the two claims
 * silently winning. Decided at #49, "Entscheid K4", alongside `readVector`'s
 * all-or-nothing.
 */
function readRankCountMap(raw) {
  const map = {};
  for (const pair of raw.split(',')) {
    const [rankRaw, countRaw, ...rest] = pair.split(':');
    if (rest.length > 0) return UNREADABLE;
    const rank = readInt(rankRaw);
    const count = readInt(countRaw);
    if (rank === UNREADABLE || count === UNREADABLE) return UNREADABLE;
    if (rank < 1 || count < 1 || map[rank] !== undefined) return UNREADABLE;
    map[rank] = count;
  }
  return map;
}
