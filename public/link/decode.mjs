/**
 * The read half of the wire format: a query string in, the base and the pinned
 * sliders out. The key register in `keys.mjs` (#48) is the single source of
 * truth for what a key means; nothing here carries a second idea of the key
 * list (docs/agents/setup-link.md).
 */

import { CURVES } from '../core/rules.mjs';
import { BASE_KEYS, CURRENT_VERSION, KEYS } from './keys.mjs';

/**
 * Reads a SetupLink to
 * `{ version, game, type, pins, unknown, unreadable, report }` — the base, the
 * pinned sliders, the slider names we do not know, and what the link cost on
 * the way in.
 *
 * **The read result is one object: the state and the log of the read stick
 * together** (Lauf 8, "Entscheid K1"). The tournament state is what the
 * sliders show, the report is what went wrong while reading — both arise in
 * the same pass, so both come back in the same pass. `migrate()` writes on
 * into the very same report (#47, `## Reading a link`), and a caller holds one
 * object at every stage instead of carrying state and log side by side.
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
 * `unreadable` is the other half of that: a value that cannot become what its
 * key is — `rankFloor=fuenf` — named rather than quietly handed on as the
 * sheet value. Each such key appears **once**, whatever the URL repeated.
 *
 * **A slider name this register does not know is not judged here.** It passes
 * through with its **raw value** in `unknown`, on every link alike, whichever
 * version it names (Lauf 8, "Entscheid K4"; ADR 0007, Nachtrag #51). The read
 * path reads, it does not judge: the migration chain is the place where it is
 * written down what an unknown name means — a step renames it, or nothing
 * does and it is gone — and **the loss entry arises at the end of the chain**,
 * not at the start of the read. Judging it here would make the same name fare
 * differently depending on the link's version number, which is not what we
 * know about the name.
 *
 * The naming reading of the #48 addendum — the key is lost at decoding time —
 * is withdrawn with that. Price taken knowingly: a hand-bent link carries its
 * nonsense one stage further, until the chain clears it away. `unknown` is a
 * plain object of raw name to raw string, first mention winning, and it is the
 * raw material `migrate()` decides on; it is deliberately **not** `pins`,
 * which only ever carries finished values. `game` and `type` are untouched by
 * all this — the net below still catches them, because there is no typeless
 * state (ADR 0003) and a step must *name* a successor (ADR 0007, Nachtrag
 * #44).
 *
 * The `report` is where the kinds of loss are told apart. That is the
 * **tolerance**, and it was #51's to settle:
 *
 * - **One entry per key name.** A key repeated in the URL is named once.
 * - **A whole loss is reported whole.** A negative limb throws the entire
 *   DisplayReservation and a doubled Rank the entire winner card (#49,
 *   "Entscheid K4"); the entry names the **slider**, not the bent limb. The
 *   slider is what is gone and what has to be set again — "limb 2 was
 *   negative" names something that is not a slider and leaves the loss unsaid.
 *
 * A **negative** number is unreadable for the same reason, on every numeric
 * key alike (Lauf 8, "Entscheid K2"): no control can produce one, so it can
 * only come from a bent link — and `readVector` had thrown one out since #49
 * while the single slider took it. One rule instead of two that differed
 * without anyone deciding so.
 *
 * No cap is applied: a value out of range is taken as it stands (#47,
 * "Unreadable input and the fallback net"), because a link value is a pinned
 * value like any other (ADR 0006). It lost nothing, so it is **not** an entry.
 *
 * **A link from the future is not read and not rewritten.** `v` above today's,
 * or none we can read at all, is the link saying "you cannot read this": the
 * base is taken so there is a type to stand on, not one slider key is
 * interpreted, and nothing here can touch the address bar — this module names
 * neither `location` nor `replaceState`, by test.
 *
 * The migration chain and its entry kinds — `renamed`, `dropped`,
 * `setByMigration` — are #52's; `migrate.mjs` does not exist yet, and the
 * report is built here because #51 owes its acceptance criteria a report and
 * owns no other file. See the PR of #51 for what that costs #52. The
 * `unknownKey` entry is #52's too since Lauf 8, "Entscheid K4": it is the last
 * word of the chain over a name, and nothing here may say it first.
 */
export function decode(query, games = null) {
  const params = new URLSearchParams(String(query ?? '').replace(/^[?#]/, ''));
  const read = Object.fromEntries(BASE_KEYS.map(({ key }) => [key, params.get(key)]));
  const base = catchBase({ game: read.game, type: read.type }, games);

  const version = readVersion(read.v);
  if (version === null || version > CURRENT_VERSION) {
    return {
      version,
      game: base.game,
      type: base.type,
      pins: {},
      unknown: {},
      unreadable: [],
      report: reportOf({
        from: version,
        entries: [...base.entries, { kind: 'futureVersion', from: version }],
      }),
    };
  }

  const pins = {};
  const unreadableValues = [];
  for (const { key, type } of KEYS) {
    if (!params.has(key)) continue;
    const value = readValue(type, params.get(key));
    if (value === UNREADABLE) unreadableValues.push(key);
    else pins[key] = value;
  }
  const unknown = {};
  for (const key of new Set(params.keys())) {
    if (!KNOWN_KEYS.has(key)) unknown[key] = params.get(key);
  }

  const entries = [
    ...base.entries,
    ...unreadableValues.map((key) => ({ kind: 'unreadableValue', key })),
  ];

  return {
    version,
    game: base.game,
    type: base.type,
    pins,
    unknown,
    unreadable: unreadableValues,
    report: reportOf({ from: version, entries }),
  };
}

/**
 * The fallback net for the base, and it is **not a tool of versioning**: it
 * catches a Game or TournamentType name that **no chain ever knew** — a
 * hand-bent URL, a type that left a list without a migration. It asserts no
 * preserved result, it only prevents the typeless state ADR 0003 does not have
 * (ADR 0007, Nachtrag #44), and the report says it happened. A LinkMigration
 * may never lean on it: a step that abolishes a type **names its successor**,
 * or the link would hang off a list position after all.
 *
 * A Game behaves exactly as a TournamentType does (#51), down to the entry
 * kind — and the type is judged against the Game that caught it, because a
 * Game's type list is its own.
 *
 * `games` is a **parameter**, the catalogue to judge against: Games in list
 * order, each `{ id, types: [{ id }] }`, types in list order — order is
 * meaningful and never a surface sort (ADR 0003). The register in `keys.mjs`
 * says what a key *means*; it cannot say which Games exist, and this layer
 * must not grow a second idea of that. Without a catalogue the net does not
 * run: a name can only be judged against a list, so the base passes through as
 * it stood and nothing is reported.
 *
 * **The catalogue falls out of the sheets, because a Game sheet carries its own
 * id** (Lauf 8, "Entscheid K3"). A caller composes it from what it already
 * holds — `{ ...GAME, types: TOURNAMENT_TYPES }` or `{ id: GAME.id, types }`,
 * either way — and this function reads nothing but `id` and `types`. It is
 * built here against fixture sheets on purpose: the sheet that grows the id is
 * #64's file and lands separately, so nothing here leans on it.
 *
 * **A catalogue that is not a catalogue throws.** An entry without an `id`, or
 * without a non-empty `types` list, is the wiring mistake this shape invites:
 * hand over the bare sheet, which has no type list, and every valid type would
 * be "replaced" by nothing — `{ kind: 'typeReplaced', now: null }`, a report
 * that is wrong and a state ADR 0003 does not have. It computes, it stays
 * silent, and the value is wrong: the error class of run 5. It is a
 * programmer's mistake and not a reader's link, so it is the one thing in this
 * module that is loud. Leaving the catalogue out remains a legal choice — it
 * says "do not judge the base" — but naming a half one does not.
 */
function catchBase({ game, type }, games) {
  if (!Array.isArray(games) || games.length === 0) return { game, type, entries: [] };
  for (const entry of games) assertCatalogueEntry(entry);

  const entries = [];
  let sheet = games.find((entry) => entry.id === game);
  if (sheet === undefined) {
    sheet = games[0];
    entries.push({ kind: 'gameReplaced', was: game, now: sheet.id, by: 'fallback' });
  }

  let chosen = sheet.types.find((entry) => entry.id === type);
  if (chosen === undefined) {
    chosen = sheet.types[0];
    entries.push({ kind: 'typeReplaced', was: type, now: chosen.id, by: 'fallback' });
  }

  return { game: sheet.id, type: chosen.id, entries };
}

/**
 * The catalogue's shape, checked where it arrives rather than where it hurts.
 * Every entry names a Game and lists at least one TournamentType — a Game with
 * no type at all would be a Game nobody can open (ADR 0003), so there is no
 * such thing to be lenient about.
 */
function assertCatalogueEntry(entry) {
  const named = (value) => typeof value === 'string' && value.length > 0;
  if (entry === null || typeof entry !== 'object' || !named(entry.id)) {
    throw new TypeError('decode: every catalogue entry names its Game with a string `id`');
  }
  if (!Array.isArray(entry.types) || entry.types.length === 0 || !entry.types.every((t) => named(t?.id))) {
    throw new TypeError(
      `decode: the catalogue entry "${entry.id}" carries no TournamentType list — pass ` +
        '`{ ...sheet, types }`, not the bare sheet',
    );
  }
}

/**
 * The format version, or `null` when the link does not carry a readable one.
 * Versions start at **1**; there is no v0 (#47, `## The wire format`), so a
 * zero or a negative number names no format that ever existed and is as
 * unreadable as `v=zwei`. Both fall to the future case, exactly as #47's table
 * says of an absent one.
 */
function readVersion(raw) {
  if (raw === null) return null;
  const value = readInt(raw);
  return value === UNREADABLE || value < 1 ? null : value;
}

/**
 * The report is a data structure and never a word of text — Spec 2 renders it
 * (#47, `## The report`). It hangs off the **loss, not off a chain that ran**:
 * it is there as soon as anything was not taken over as it stood, and `null`
 * otherwise (ADR 0007, Nachtrag #48). `migrated` is `false` throughout: no
 * chain runs in this module, and at v1 there is none to run.
 *
 * `resaveBookmark` carries the call to save the bookmark again as **part of
 * the report's statement**, not as a formatted sentence (#51) — without it the
 * link pinned in Discord stays the old one forever and the loss repeats at
 * every open. It is true exactly when the address bar now says something other
 * than the link that was opened, which leaves out the one case where #47 keeps
 * the address bar untouched: the link from the future. There the bookmark is
 * the better copy — readable again by a newer app — and asking for it to be
 * saved again would invite overwriting it with a downgraded one.
 */
function reportOf({ from, entries }) {
  if (entries.length === 0) return null;
  const fromTheFuture = entries.some((entry) => entry.kind === 'futureVersion');
  return {
    from,
    to: CURRENT_VERSION,
    migrated: false,
    resaveBookmark: !fromTheFuture,
    entries,
  };
}

/** Every key the v1 register names, base and sliders — anything else is loss. */
const KNOWN_KEYS = new Set([...BASE_KEYS, ...KEYS].map(({ key }) => key));

/** What a value that does not fit its key's type reads as — never a default. */
export const UNREADABLE = Symbol('unreadable');

/**
 * Exported for `migrate.mjs` (#52): a name a step renames still has to become
 * a finished value before it can land in `pins`, by the same grammar every
 * same-named key has always been read with — a renamed slider does not get a
 * second, looser idea of what its type means. Reading a value is not a
 * judgment about a *name* (the read path stopped making those, Lauf 8
 * "Entscheid K4"), so sharing the function does not reopen that decision.
 */
export function readValue(type, raw) {
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

/**
 * A whole number, written out — no exponents, no fractions, no `NaN`, and
 * **no minus sign**. A negative slider value cannot be produced by any
 * control; it only ever comes out of a hand-bent link, which is precisely the
 * case the fallback net exists for. `readVector` has rejected a negative limb
 * since #49 ("Entscheid K4"); the single slider never got the same rule, so
 * `rankFloor=-8` was pinned as it stood. One rule for both forms, decided at
 * Lauf 8, "Entscheid K2": the slider is unreadable and falls into the report
 * with the same entry kind as a bent vector.
 *
 * This is not a cap and does not become one: a value of the right type past
 * every stop still stands (ADR 0006). The line is between a number we can read
 * and a sign no slider can ever produce.
 *
 * **`assertSumRule` is expressly not pulled along** (#58): it scans every
 * numeric sheet of the plan for negatives, and the reason it may stay sharp is
 * that no negative number reaches the plan in the first place — not that the
 * plan tolerates one. See Lauf 8, "Entscheid K2".
 */
function readInt(raw) {
  return /^\d+$/.test(raw) ? Number(raw) : UNREADABLE;
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
 * made. Decided at #49, "Entscheid K4"; the report keeps that whole loss and
 * names the slider, not the limb (#51).
 *
 * The negative limb is caught by `readInt` itself since Lauf 8, "Entscheid
 * K2" — this function used to hold the only copy of that rule and now shares
 * it with every other numeric key.
 */
function readVector(raw) {
  const parts = raw.split('.').map(readInt);
  if (parts.some((part) => part === UNREADABLE)) return UNREADABLE;
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
