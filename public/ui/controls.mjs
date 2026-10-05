/**
 * The Details sheet's register (#64): which controls stand on it, in which
 * groups, and where each one's two ends are. Pure derivations over a resolved
 * `Settings` and the `DistributionPlan` it produced — no DOM, so `node --test`
 * proves them, which is what #61's Testing Decisions ask of the shell's
 * provable half ("Die Deckel an den Bedienelementen").
 *
 * The one thing this file is *for*: a control's ends have exactly one home.
 * Since #113 the sliders are gone and every number is a counter with a typed
 * field; the counter's ±, the typed commit and the clamp that writes a value
 * all read `boundsFor()`, and its walls are asked of the core — "Die Wand am
 * Bedienelement steht dort, wo der Kern still schneidet, und sie ist dieselbe
 * Grösse wie im Kern." That is what #61's older "Schieber und Zählwerk kennen
 * denselben Deckel" meant to protect, and #64's comment of 2026-10-01 says it
 * lives on in that rule.
 *
 * The labels and the explanation texts are deliberately *not* here: PHP
 * composes what never changes while a number is set (#61, "The seam" —
 * "Gruppentitel, Erklärtexte, die ⓘ-Texte"), so they live in
 * `views/controls-sheet.php` as markup. What lives here is what a number
 * depends on.
 *
 * ## Why seventeen, spelled out
 *
 * #46 gives `Settings` nineteen fields. Two of them name a `Rank` —
 * `displays` and `manualWinner` — and are set at the tile, never at a counter
 * (#61, "The tiles and their grip"; #66). The remaining seventeen are what
 * #64 and #61 call "alle siebzehn Regler". `depthStep` is one of them and is
 * *not* a control of its own: it is the step grid inside `Served ranks`
 * (CONTEXT.md, `RankPoolDepth` — "der Regler selbst bleibt absolut: die Stufe
 * liefert nur den Startwert"), which is why `SHEET_KEYS` has seventeen
 * entries while the sheet draws sixteen boxes.
 *
 * `raffleRange` is not among them and is not a miscount: #61 says outright it
 * is no `Regler`, so it has no pin, no reset and no entry here. It travels in
 * the `SetupLink` all the same — as a key beside the sliders, not as one
 * (run 12, K1b on #72; `CHOICE_KEYS` in `link/keys.mjs`). Its pointer on the
 * sheet belongs to #69. The one place it joins the pins is the full reach at
 * the pin chip — counted there and put back to `all` by its drop
 * (`handSetKeys()` below; run 12, Phase G on #72) — still without being one.
 */

import { distribute } from '../core/distribute.mjs';
import { CURVES, DEPTH_STEPS, RANGES } from '../core/rules.mjs';
import { DEFAULT_RANGE, rangeName } from './raffle.mjs';

/** The four hot ones, in the order #61 names them. They carry no group title:
 *  the page head is their title (#64). */
export const HOT_KEYS = ['players', 'depth', 'curve', 'rankFloor'];

/**
 * The groups below the hot block, each with the title and the sentence #61
 * gives it. `Rank pool` is absent, and that is a decision, not an omission:
 * its three members — how deep, how flat, how steep — are precisely `depth`,
 * `rankFloor` and `curve`, and those are hoisted into the hot block. A group
 * whose every member stands elsewhere would be a title over nothing.
 */
export const GROUPS = [
  {
    id: 'supply',
    title: 'Supply',
    desc: 'What is in the box before anything is split — the boosters, the packs, and how they are boxed.',
    keys: ['boosterRate', 'displaySize', 'tournamentPacks', 'envelopeSize', 'envelopeYield'],
  },
  {
    id: 'split',
    title: 'Split the pool',
    desc: 'What comes off the top for everyone and for the judge, before the ranks are served.',
    keys: ['participationBooster', 'participationPack', 'judgeBooster', 'judgeWinner', 'combinedHandout'],
  },
  {
    id: 'winner',
    title: 'Winner packs',
    desc: 'The scarce prize. Either strictly by rank, or drawn by the Winner raffle.',
    keys: ['winnerPacks', 'ranked'],
  },
];

/** All seventeen, in the order they stand on the sheet. */
export const SHEET_KEYS = [...HOT_KEYS, 'depthStep', ...GROUPS.flatMap((g) => g.keys)];

/**
 * Whether a control stands on the sheet at this stand. One does not:
 * `Participation boosters` while `CombinedHandout` is on (#103, decision A).
 * It distributes nothing then — the whole Booster share is shaped — and a
 * control that moves nothing looks broken; greyed out would say the same
 * (`views/control-row.php`). It goes the way the `Participation` line of the
 * plan goes (`views/plan.php`). Its value stays: it is in `Settings` and in
 * the pins, travels in the SetupLink and is there again when the handout is
 * switched off (E4). `Participation packs` stays, since the packs still go
 * to everyone (E5).
 */
export function controlShown(key, settings) {
  return !(key === 'participationBooster' && settings.combinedHandout);
}

/**
 * The two pins the way out of a `combinedHandoutDepth` sets (`suggest.mjs`,
 * `handoutWayOut()`) — what switching `CombinedHandout` back off lists, where
 * they stand pinned (#103, E4).
 */
export const HANDOUT_PINS = ['rankFloor', 'depth'];

/**
 * The three controls that pick a **named rule** of the core instead of a
 * number (ADR 0003: a DefaultSet entry is a constant or such a choice), plus
 * the one that is a flag. None of them has bounds; their whole range is the
 * list of steps, and `boolean` for the flag.
 */
export const STEPPED_KEYS = {
  curve: CURVES.map((c) => c.id),
  depthStep: DEPTH_STEPS,
};

/**
 * The screen word of each `RankPoolDepth` step. It sits here, beside the ids
 * it belongs to, and not in the PHP markup with the other labels: a step list
 * that PHP writes out by hand can fall out of step with `RANGES` without
 * anything noticing, and a chip labelled `top half` that sets `topThird` is a
 * silent lie. Paired here, a test holds the two lists against each other.
 */
export const DEPTH_STEP_LABELS = {
  top8: 'top 8',
  top16: 'top 16',
  topQuarter: 'top quarter',
  topThird: 'top third',
  topHalf: 'top half',
  topTwoThirds: 'top two thirds',
  topThreeQuarters: 'top three quarters',
  all: 'all ranks',
};

/** The four trailing numbers read their value off the plan while they are
 *  `auto`: `null` in `Settings` means "the core computes it" (ADR 0006). */
const FROM_PLAN = {
  depth: (plan) => plan.depth,
  tournamentPacks: (plan) => plan.pool.packs,
  ranked: (plan) => plan.allocation.ranked,
  winnerPacks: (plan) => plan.pool.winners,
};

/**
 * The two ends of the fourteen numbers, as #113 decided them when the sliders
 * fell (grilling comment of 2026-10-01). The stops of #46 existed "damit ein
 * Regler zwei Enden hat"; a counter with a typed field needs no second end, so
 * the reason went with the slider.
 *
 * - **No roof**, `players` included. Eight numbers are open upward:
 *   `players`, `boosterRate`, `tournamentPacks`, `winnerPacks`,
 *   `displaySize`, `envelopeSize`, `envelopeYield`, and `rankFloor` — whose
 *   0…8 is the *search range* of `suggestions()` (`suggest.mjs`), an argument
 *   of the search and never a cap at the control.
 * - **The minima stay**: `players` ≥ 2, `displaySize` / `envelopeSize` /
 *   `envelopeYield` ≥ 1, `depth` ≥ 1, everything else ≥ 0 — the floors the
 *   core enforces itself (`distribute.mjs`, `derivePool()` and `distribute()`).
 * - **A wall stands where the core cuts silently, and it is the same size as
 *   in the core.** A field that took a number past that cut would show a value
 *   the plan does not compute with — "du tippst, und es passiert nichts"
 *   (#113) and "zwei Anzeigen, und eine davon stimmt nicht" (#104) in one.
 *   See `WALLS`.
 *
 * The rule of #61 still holds and is why nothing else is capped: "Ein
 * Anschlag darf keinen Zustand verhindern, den ADR 0002 gemeldet haben will."
 */
const MINIMA = {
  players: 2,
  boosterRate: 0,
  tournamentPacks: 0,
  winnerPacks: 0,
  displaySize: 1,
  envelopeSize: 1,
  envelopeYield: 1,
  rankFloor: 0,
};

/**
 * The six numbers the core cuts silently, each with the plan field in which
 * the core reports what it took. #113 names five; `participationPack` is the
 * sixth, by the same rule and the same clamp as `participationBooster` — the
 * core takes at most `⌊TournamentPacks / players⌋` per player, and the old
 * 0…4 stop offered numbers above that the plan never computed with.
 *
 * The wall is not written out here as a second copy of the core's clamp. It
 * is **asked of the core**: `wallOf()` hands it a number past any wall and
 * reads back what it took. The shell never reaches past the seam into the
 * calculation (ADR 0004), and asking it a question is not reaching past it —
 * the device `reservedDisplaysAfter()` already uses for the reservation
 * condition. So the wall cannot drift from the core: it *is* the core's cut.
 *
 * That this matters is measured. The `judgeBooster` end used to be the whole
 * Booster pool, defended with "handing the judge everything leaves the ranks
 * empty" — which is not what the core does: it cuts at the rest after the
 * ParticipationPool. One Piece at 128 players, `boosterRate` 9,
 * `participationBooster` 6: the control offered 0…1152, the core takes
 * 0…384, and two thirds of the scale were dead (#113).
 */
const WALLS = {
  depth: { min: 1, took: (plan) => plan.depth },
  ranked: { min: 0, took: (plan) => plan.allocation.ranked },
  participationBooster: { min: 0, took: (plan) => plan.participation.rate.booster },
  participationPack: { min: 0, took: (plan) => plan.participation.rate.packs },
  judgeBooster: { min: 0, took: (plan) => plan.judge.booster },
  judgeWinner: { min: 0, took: (plan) => plan.judge.winners },
};

/** A number past every wall the core has, and still a safe integer. */
const PAST_ANY_WALL = Number.MAX_SAFE_INTEGER;

/**
 * The walls of the last stand asked about, by wall key. Asking costs one full
 * `distribute()` per wall, and with no roof on `players` (#113) that is no
 * longer small: at 5000 players one pass over the six walls took over a
 * second, and a drawing asks every wall several times (`canStep` at `−` and
 * `+`, the typed commit, the clamp). So each wall is asked once per stand.
 *
 * The stand is recognised by its **content**, not by object identity: the
 * shell writes `settings` in place (`setSlider()`), so the same object is a
 * different stand after every handling, and a cache keyed by identity would
 * hand back the walls of the stand before. The pins are not part of the key —
 * `distribute()` carries them onto the plan and computes nothing from them.
 */
let wallStand = null;
let wallCache = {};

/** The core's own cut for a wall key at this stand: what it takes of a number past it. */
function wallOf(key, { settings, plan }) {
  const stand = JSON.stringify(settings);
  if (stand !== wallStand) {
    wallStand = stand;
    wallCache = {};
  }
  if (!(key in wallCache)) {
    wallCache[key] = WALLS[key].took(distribute({ ...settings, [key]: PAST_ANY_WALL }, plan.pinned));
  }
  return wallCache[key];
}

/**
 * `key`, and the stand it is read against, → `{ min, max }`, or `null` where
 * the control is not a number at all. `max` is `Infinity` for an open number.
 *
 * It never looks at the current value, and that is the point: a `pinned`
 * value over a wall is never cut (ADR 0006). The wall says what a *handling*
 * may reach, `effectiveValue()` says what stands.
 */
export function boundsFor(key, stand) {
  if (key in MINIMA) return { min: MINIMA[key], max: Infinity };
  if (key in WALLS) return { min: WALLS[key].min, max: wallOf(key, stand) };
  return null;
}

/** What the control shows: the pinned number, or the one the core computed. */
export function effectiveValue(key, { settings, plan }) {
  const value = settings[key];
  if (value == null && FROM_PLAN[key]) return FROM_PLAN[key](plan);
  return value;
}

/**
 * The ends as the control actually draws them: `boundsFor()`, widened to take
 * in the value that stands.
 *
 * A pinned value is never cut by a wall that sank under it (ADR 0006) — so a
 * wall that sank under it must not turn into a barrier on the way back, or
 * the one way down would be gone at exactly the moment it is wanted. The wall
 * keeps doing its whole job in the direction that matters: it still stops a
 * handling from reaching *further* out. The `+` stays closed there, the `−`
 * and a typed smaller number leave it.
 */
export function reachFor(key, stand) {
  const bounds = boundsFor(key, stand);
  if (!bounds) return null;
  const value = Number(effectiveValue(key, stand));
  if (!Number.isFinite(value)) return bounds;
  return { min: Math.min(bounds.min, value), max: Math.max(bounds.max, value) };
}

/**
 * What a handling is allowed to write. Numbers are clamped into the very
 * ends the counter and the typed field are drawn from; a step id that is not a
 * step, and anything else that cannot be meant, comes back as `null` so the
 * caller writes nothing rather than a value nobody chose.
 */
export function clampToBounds(key, value, stand) {
  if (key === 'combinedHandout') return !!value;
  if (key in STEPPED_KEYS) return STEPPED_KEYS[key].includes(value) ? value : null;
  const bounds = reachFor(key, stand);
  if (!bounds) return null;
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.min(Math.max(number, bounds.min), bounds.max);
}

/* ── The typed field (#113) ─────────────────────────────────────────────── */

/**
 * What a typed field holds, as a whole number — or `null` where it holds
 * none. Strict on purpose: `Number('')` is 0, so an emptied field read
 * loosely would write a zero nobody typed; and a fraction or an exponent is
 * no count a person types into a field for packs or players. `null` means
 * what it means for `clampToBounds()`: write nothing rather than a value
 * nobody chose, and let the field fall back to the value that stands.
 */
export function typedNumber(text) {
  if (typeof text !== 'string' || !/^\s*[+-]?\d+\s*$/.test(text)) return null;
  return Number(text);
}

/**
 * What committing a typed field writes: the number, held at the control's
 * ends exactly as a `−` or `+` would be, or `null` for "write nothing".
 *
 * **Unchanged writes nothing, and therefore pins nothing** (#113). The commit
 * comes at Enter or whenever the field is left, and on a phone there is no
 * gesture that leaves it *without* committing — so a tap into the field and
 * away again is a commit of the number already standing. It is compared with
 * what the control shows (`effectiveValue()`), not with `Settings`: a number
 * typed back onto its `auto` value changes nothing, and a pin from it would be
 * one nobody set. The same convention `reservedDisplaysAfter()` and
 * `manualWinnerAfter()` already carry.
 *
 * It compares *after* holding at the ends, so a number typed past a wall the
 * value already stands at writes nothing either — and a `pinned` value over a
 * sunk wall, typed further out, stays what it is (ADR 0006).
 */
export function typedValueAfter(key, text, stand) {
  const number = typedNumber(text);
  if (number === null) return null;
  const next = clampToBounds(key, number, stand);
  if (next === null || next === Number(effectiveValue(key, stand))) return null;
  return next;
}

/* ── The two that are set at the tile (#66) ─────────────────────────────── */

/**
 * `displays` and `manualWinner` are the two Settings fields that carry no
 * counter on the sheet: both name a `Rank`, and a `Rank` is a tile, not a
 * number one types into a control (ADR 0003, #61 "The tiles and their grip").
 * Their caps stand here all the same, beside the numbers' ends — a cap has
 * **one** home, and a second home is how the tile and the sheet come to
 * disagree about the same stand.
 *
 * The rule every one of them is measured against is #61's, verbatim:
 *
 * > Ein Anschlag darf keinen Zustand verhindern, den ADR 0002 gemeldet haben
 * > will.
 *
 * So what is capped is named, and short: the **monotonicity** of the vector
 * (`d₁ ≥ d₂ ≥ …`, which is the same statement as "the `Rank` above caps it"
 * read from either end), the **reservation condition**, and the player count.
 * The **overtake** and the **orphaned reservation** are not capped: they are
 * exactly the two states ADR 0002 wants reported rather than prevented, and a
 * cap that also caught them would delete the states the `ConflictNotice`
 * exists for, silently and with every test one would otherwise think to write
 * still green.
 *
 * And the asymmetry `reachFor()` already encodes for the numbers holds here
 * too: a cap stops a handling from reaching **further out**, never from coming
 * back. A reservation that a sunk cap left standing (a smaller player count, a
 * `SetupLink` with other values, a Set switch with a smaller `PromoEnvelope`)
 * is not trimmed — ADR 0006 — and the way down out of it must therefore stay
 * open, or the one handling that clears the conflict would be gone at the
 * moment it is wanted.
 */

/** The reservation vector as a plain array of whole, non-negative numbers. */
function displayVectorOf(settings) {
  const raw = Array.isArray(settings.displays) ? settings.displays : [];
  return raw.map((value) => Math.max(0, Math.trunc(Number(value)) || 0));
}

/** `d₁ ≥ d₂ ≥ …` — the one rule not even a way out may break (#46, #61). */
function nonIncreasing(vector) {
  for (let i = 1; i < vector.length; i++) if (vector[i] > vector[i - 1]) return false;
  return true;
}

/** The vector with one `Rank` set, trailing zeroes dropped: an absent entry
 *  and a zero one are the same reservation, and one spelling is enough. */
function withDisplay(vector, rank, count) {
  const next = vector.slice();
  while (next.length < rank) next.push(0);
  next[rank - 1] = count;
  while (next.length > 0 && next[next.length - 1] === 0) next.pop();
  return next;
}

/**
 * What a handling at the tile is allowed to write into `displays`: the whole
 * new vector, or `null` for "write nothing" — the same convention
 * `clampToBounds()` uses, and for the same reason: a refused handling leaves
 * the stand alone rather than writing a value nobody chose.
 *
 * The reservation condition is measured by **running the core** on the vector
 * in question and reading its `conflict` field, not by re-deriving the
 * inequality here. The shell never reaches past the seam into the calculation
 * (ADR 0004); asking it a question is not reaching past it, and a second copy
 * of the condition is a second thing to keep in step.
 */
export function reservedDisplaysAfter(rank, count, { settings, plan }) {
  const r = Math.trunc(Number(rank));
  const next = Math.trunc(Number(count));
  if (!Number.isFinite(r) || r < 1 || r > plan.players) return null;
  if (!Number.isFinite(next) || next < 0) return null;

  const vector = displayVectorOf(settings);
  const current = vector[r - 1] ?? 0;
  if (next === current) return null;

  const after = withDisplay(vector, r, next);
  if (!nonIncreasing(after)) return null;
  // Outward only: a reservation the RankPool cannot carry is not offered
  // (maintainer decision on #66, 2026-09-27). Coming back down is never
  // refused — see the asymmetry above.
  // The probe is handed the pins the stand already carries, so that a probe
  // plan is the same shape as the one on screen (addendum (#86) to ADR 0009).
  // It changes nothing about `conflict` — `pinned` is carried, never computed
  // from — but a call that drops it is the habit that produced the empty
  // `plan.pinned` at the surface (maintainer decision on #66, 2026-09-28).
  if (next > current && distribute({ ...settings, displays: after }, plan.pinned).conflict) return null;
  return after;
}

/** Whether the tile offers that handling at all — what a ± is drawn from. */
export function canReserveDisplays(rank, count, stand) {
  return reservedDisplaysAfter(rank, count, stand) !== null;
}

/**
 * The same for the `manual` share of the WinnerPackAllocation: the new map, or
 * `null` for "write nothing".
 *
 * Only `manual` is the tile's. What `ranked` handed out is not adjustable
 * there (CONTEXT.md, `WinnerPackAllocation` — "`ranked` ist nur über die Zahl
 * steuerbar, nie per `Rank`"), so a minus on a `Rank` that holds nothing but a
 * `ranked` pack finds nothing to take back.
 *
 * Upward the cap is `open`: a `WinnerPack` that is not there is not placed.
 * That is a cap on the **setting** and not on the state — the overhang of #70
 * arises when a second value sinks afterwards, and it stays reachable.
 */
export function manualWinnerAfter(rank, count, { settings, plan }) {
  const r = Math.trunc(Number(rank));
  const next = Math.trunc(Number(count));
  if (!Number.isFinite(r) || r < 1 || r > plan.players) return null;
  if (!Number.isFinite(next) || next < 0) return null;

  const current = plan.allocation.manual[r] ?? 0;
  if (next === current) return null;
  if (next > current && plan.allocation.open < next - current) return null;

  const map = { ...(settings.manualWinner ?? {}) };
  if (next === 0) delete map[r];
  else map[r] = next;
  return map;
}

/** Whether the tile offers that handling — what the `Winner packs` ± is drawn from. */
export function canPlaceWinner(rank, count, stand) {
  return manualWinnerAfter(rank, count, stand) !== null;
}

/* ── `pinned` against `auto`, and what a reach drops (#67) ──────────────── */

/**
 * The screen word of every item that can be `pinned`. It is what the question
 * of the full reach **enumerates** — #61 and #67 ask for *which* values fall,
 * not only how many — so a key without a word here would list itself in code
 * type, and #52 settled for the `LinkMigration` report that a wire key is only
 * ever shown where no screen word exists at all.
 *
 * The words are the sheet's own (`views/controls-sheet.php`), and
 * `test/ui-pins.test.mjs` holds the two lists against each other rather than
 * trusting them: they are two files, and a question that names a control the
 * sheet calls something else names nothing.
 *
 * Two of them are not `sheet_control()` calls and are therefore written out
 * here by hand: **`displays` and `manualWinner`** are set at the tile and have
 * no control on the sheet (#66). The words are the prototype's, which wrote
 * them for this list and no other use (`cockpit.prototype.html`, `LABEL`) —
 * `Displays` alone would not say, in a list of things being destroyed, that a
 * reservation is meant.
 *
 * **`depthStep` has no word here, and that is the point.** It is the step grid
 * *inside* `Served ranks` (`views/controls-sheet.php`: "part of this control,
 * not a control beside it"), so it is no item of its own: it is a member of
 * the item `depth`, see `PIN_MEMBERS`. What a step is called on screen —
 * `top 8`, `top quarter` — is a **value** of that item and stands in
 * `DEPTH_STEP_LABELS`, never a label (maintainer decision on #67, run 11, K3).
 */
export const PIN_LABELS = {
  players: 'Players',
  depth: 'Served ranks',
  curve: 'Curve',
  rankFloor: 'Min boosters per rank',
  boosterRate: 'Boosters per player (pool)',
  displaySize: 'Boosters per display',
  tournamentPacks: 'Tournament packs available',
  envelopeSize: 'Tournament Packs per Promo-Envelope',
  envelopeYield: 'Winner packs per Promo-Envelope',
  participationBooster: 'Participation boosters',
  participationPack: 'Participation packs',
  judgeBooster: 'Judge boosters',
  judgeWinner: 'Judge winner packs',
  combinedHandout: 'Handout',
  winnerPacks: 'Winner packs available',
  ranked: 'Winner packs by rank',
  displays: 'Reserved displays',
  manualWinner: 'Winner packs by hand',
  raffleRange: 'Raffle range',
};

/**
 * The items that are made of more than one stored pin. An item is what the
 * screen has **one control** for, and the counter, the marking, the question
 * and the drop all go by items: `Served ranks` is one control whose number is
 * `depth` and whose step grid is `depthStep`, so it is one item `depth` with
 * two members (maintainer decision on #67, run 11, K3: "Tiefe und Stufe sind
 * ein Posten `Served ranks`, im Zähler genauso").
 *
 * It is the same device `displays` and `manualWinner` already use, one level
 * up: there one pin carries many `Rank`s and counts as one, here one item
 * carries two pins and counts as one. The record itself stays per key — the
 * `SetupLink` carries `depth` and `depthStep` as two keys (#86) — so the
 * grouping lives here and nowhere in `pins`.
 */
export const PIN_MEMBERS = {
  depth: ['depth', 'depthStep'],
};

const ITEM_OF = Object.fromEntries(
  Object.entries(PIN_MEMBERS).flatMap(([item, keys]) => keys.map((key) => [key, item])),
);

/** The item a stored key belongs to — itself, unless it is a member of one. */
export function pinItem(key) {
  return ITEM_OF[key] ?? key;
}

/** The stored keys an item is made of — itself, unless it has members. */
export function pinMembers(item) {
  return PIN_MEMBERS[item] ?? [item];
}

/** The order the question enumerates in: the sheet's own, then the two that
 *  are set at the tile. A pin record has the order its pins were *set* in (or,
 *  out of a `SetupLink`, the register's), and a list that reorders itself
 *  between two readings cannot be compared by eye. */
export const PIN_ORDER = [...SHEET_KEYS, 'displays', 'manualWinner', 'raffleRange'];

/** The selector of the bubble the question is drawn in. A name rather than a
 *  literal in two files, because #103 brings a second trigger site and the
 *  bubble is what the two share. */
export const DROP_BUBBLE = '[data-drop-bubble]';

/**
 * Whether a key stands `pinned` in a given pin record — the whole of the
 * marking, and it never looks at the sheet. The pin is set by the handling
 * (ADR 0006), so what is asked here is only whether the record carries
 * something, never whether it deviates.
 *
 * The two composite pins are the one subtlety, and it is not a special case in
 * disguise: a vector of zeroes and an empty map are *no* reservation and *no*
 * hand-placed pack — `withDisplay()` above drops trailing zeroes for the same
 * reason, and `manualWinnerAfter()` deletes a `Rank` that falls to zero. A
 * record that still carries the emptied container is a record of a handling
 * that has been taken all the way back.
 *
 * Written over the shape of the value rather than over a list of key names:
 * #65 pins `winnerPacks`, #69 writes into `manualWinner`, #103 will drop
 * `rankFloor` and `depth`, and a hand-typed list would have to learn about
 * each of them.
 *
 * **It reads the value, and it may not ask whether the key is there.** The
 * record it is handed at the surface is an Alpine proxy, and the reactivity
 * behind it (`@vue/reactivity`) tracks a *read* and a `key in pins`, but not
 * `hasOwnProperty` — that lands on the `getOwnPropertyDescriptor` trap, which
 * is tracked by nothing. Written that way, the marking was right in
 * `node --test` and dead on screen: a pinned control kept reading `auto` until
 * something else happened to redraw it. Measured at the picture on
 * 2026-09-30, which is exactly the class of fault #61 says a test will not
 * find. An absent key and one holding `undefined` say the same thing here
 * anyway.
 *
 * Asked of an item with members (`PIN_MEMBERS`), it answers for the item:
 * `Served ranks` stands `pinned` when its number or its step grid carries a
 * pin, because the counter counts it then, and a counter that says 1 over a
 * sheet on which every control says `auto` would count something nobody can
 * find.
 */
export function isPinned(key, pins) {
  return pinMembers(key).some((member) => holdsPin(pins == null ? undefined : pins[member]));
}

function holdsPin(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => Number(entry) > 0);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function pinRank(key) {
  const at = PIN_ORDER.indexOf(key);
  return at === -1 ? PIN_ORDER.length : at;
}

/**
 * What stands `pinned`, in sheet order. `displays` and `manualWinner` are
 * **one** entry each however many `Rank`s carry one (#61, #67): the question
 * lists what falls, and what falls is the reservation as a whole. The counter
 * is the length of this list and not a second count, which is the whole reason
 * it is a list and not a number (prototype, Runde 23: "der Zähler addierte
 * bisher jede manual-Zuteilung einzeln, die Meldung zählte sie als einen
 * Posten — zwei Zahlen für dieselbe Sache").
 *
 * It lists **items**, not stored keys: `depth` and `depthStep` come out as the
 * one entry `depth`, whichever of the two carries the pin (`PIN_MEMBERS`).
 */
export function pinnedKeys(pins) {
  const items = new Set(Object.keys(pins ?? {}).map(pinItem));
  return [...items]
    .filter((item) => isPinned(item, pins))
    .sort((a, b) => pinRank(a) - pinRank(b));
}

/**
 * What the pin chip counts and its question lists: the pinned items, and
 * after them the `RaffleRange` where it is off `all` (maintainer, run 12,
 * Phase G on #72, `zaehlt-mit`: "Eine gewählte RaffleRange (≠ all) zählt im
 * Pin-Knopf neben Copy link mit, und „alle zurücksetzen“ stellt sie wieder auf
 * „all“"). The counter then names the same items the link carries (N2).
 *
 * It is **not a pin** for all that, and this is the one list that mixes the
 * two: `pinnedKeys()` above stays pins only, so no marking, no reset at the
 * element and no `CarryOverNotice` ever sees it — a Set switch leaves the
 * range standing, so *Drop all N and follow* has nothing of it to drop.
 * `choices` is the component's `linkChoices`, the same record `encode()` gets.
 */
export function handSetKeys(pins, choices) {
  const keys = pinnedKeys(pins);
  const range = choices?.raffleRange;
  if (range != null && range !== DEFAULT_RANGE) keys.push('raffleRange');
  return keys;
}

/** The screen word, or the key itself where a future pin has none yet. */
export function pinLabel(key) {
  return PIN_LABELS[key] ?? key;
}

/** The same list with the words the question reads out. */
export function pinnedItems(pins) {
  return pinnedKeys(pins).map((key) => ({ key, label: pinLabel(key) }));
}

/** The record without the named items — a new one, because the old one is
 *  what the plan on screen was computed from. An item falls with all its
 *  members: dropping `Served ranks` drops its number and its step. */
export function pinsWithout(pins, keys) {
  const drop = new Set((keys ?? []).flatMap(pinMembers));
  const next = {};
  for (const [key, value] of Object.entries(pins ?? {})) if (!drop.has(key)) next[key] = value;
  return next;
}

/**
 * The middle sentence of the question, per reach. It is a table and not an
 * `if`, and that is the seam #103 is owed: its Entscheid 4 puts the same third
 * reach at a second trigger — switching `CombinedHandout` back off lists
 * `rankFloor` and `depth` and carries the button that drops them, "keine neue
 * Mechanik: dieselbe dritte Reichweite des Rückwegs an neuer Stelle". What it
 * adds here is one entry; what it adds elsewhere is one `askDrop()` call.
 *
 * The wording is the prototype's (`confirmPop()`), including that `carry`
 * differs from `all` in the middle sentence alone: the two reaches are the
 * same handling, so a question that looked different would say they are not.
 */
export const DROP_NOTES = {
  all: ({ many, typeTitle }) =>
    `${many ? 'Each one goes' : 'It goes'} back to what ${typeTitle} says.`,
  carry: ({ many, typeTitle }) =>
    `${many ? 'They' : 'It'} stayed behind when you switched. Following ${typeTitle} now means ` +
    `${many ? 'they take its' : 'it takes those'} values instead of yours.`,
  handout: ({ many, typeTitle }) =>
    `${many ? 'They' : 'It'} stayed when the handout went back off. Following ${typeTitle} now means ` +
    `${many ? 'they take its' : 'it takes those'} values instead of yours.`,
};

/** The one sentence no reach may drop: there is no undo, and it is said
 *  because #33 withdrew the session-wide undo that would have made the
 *  question dispensable (ADR 0006, second addendum). */
export const NO_UNDO = 'There is no undo.';

/**
 * Whether a step's name already says how many ranks it serves: an absolute
 * step of the RaffleRange (`abs` in `RANGES` — `top 8`, `top 16`) that the
 * player count has not capped. A fractional step and `all` name a share, so
 * the number has to be written beside them; so does an absolute step capped
 * below its own number, whose name then says something the counter does not.
 */
function stepCarriesNumber(stepId, ranks) {
  const step = RANGES.find((range) => range.id === stepId);
  return step?.abs !== undefined && step.abs === ranks;
}

/**
 * What an item will **show** once it has fallen — the value the reset sets it
 * to, read off the stand *after* the drop and in the form the control itself
 * shows it. It computes nothing of its own: the stand handed in is the one the
 * drop is about to install (`planApp().afterDrop()`), so the question and the
 * handling cannot drift apart (maintainer decision on #67, run 11, K3: "Der
 * Zielwert wird nachgeschlagen, nicht hergeleitet").
 *
 * The forms are the controls' own:
 *
 * - **`Served ranks`** shows a step and a number — the chip that is pressed
 *   and the counter beside it. A step's screen word is a *value* here and
 *   comes out of `DEPTH_STEP_LABELS`; the number is the one the counter will
 *   show, read off the plan like the counter reads it. The number stands in
 *   brackets only where the step's name does not already carry it (maintainer
 *   decision on #67, run 11, Phase G): `top 8`, but `top quarter (10)`. Where
 *   the number stays pinned no chip follows it, and the number alone is what
 *   stands.
 * - **`Curve`** shows its step by name, as the sheet's foot line does.
 * - **`Handout`** is a checkbox: `on` or `off`.
 * - **`Reserved displays`** and **`Winner packs by hand`** are the tiles'
 *   counts summed, and `none` where nothing is left — a reach drops a
 *   reservation as a whole, so it says what is left as a whole.
 * - **`Raffle range`** is no control, but the full reach drops it too: it
 *   shows the step's name, `all ranks` once it has fallen (`rangeName()`).
 * - Every other control shows its number.
 */
export function pinTarget(item, stand) {
  const { settings } = stand;
  if (item === 'raffleRange') return rangeName(stand.choices?.raffleRange ?? DEFAULT_RANGE);
  if (item === 'depth') {
    const ranks = effectiveValue('depth', stand);
    if (settings.depth != null) return String(ranks);
    const word = DEPTH_STEP_LABELS[settings.depthStep] ?? settings.depthStep;
    return stepCarriesNumber(settings.depthStep, ranks) ? word : `${word} (${ranks})`;
  }
  if (item === 'curve') return String(settings.curve);
  if (item === 'combinedHandout') return settings.combinedHandout ? 'on' : 'off';
  if (item === 'displays' || item === 'manualWinner') {
    const counts = Object.values(settings[item] ?? {}).map(Number);
    const total = counts.reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
    return total > 0 ? String(total) : 'none';
  }
  return String(effectiveValue(item, stand));
}

/**
 * The one word the question calls an item by — in the bubble's head line and
 * in the counter chip's spoken label. Since #113 it is *value*: the sliders
 * fell, and no text on screen calls a control a slider any more. Not
 * *setting* — `Settings` is a glossary term, and a word for one control that
 * is also the word for all nineteen fields would point the reader at the
 * wrong entry (`AGENTS.md`, "Language").
 */
export const DROP_NOUN = 'value';

/** The word with its count's number: `1 value`, `2 values`. */
export function dropNoun(count) {
  return count === 1 ? DROP_NOUN : `${DROP_NOUN}s`;
}

/**
 * The question itself, as text: `{ keys, typeTitle, reach, after }` → what the
 * bubble shows. No DOM and no state — where it lands is the shell's measuring
 * rind and is judged at the picture (#61, "Anker und Schichtung").
 *
 * It names, **per item, the control's screen title and the value the reset
 * sets it to** (#67, run 11, K3: "Players auf …, Served ranks auf top 8").
 * `after` is the stand the drop installs; without one — a caller that only
 * wants the count — every `to` is `null`.
 */
export function dropConfirmation({ keys, typeTitle, reach = 'all', after = null }) {
  const list = [...(keys ?? [])];
  const count = list.length;
  const many = count > 1;
  const note = (DROP_NOTES[reach] ?? DROP_NOTES.all)({ many, typeTitle, count });
  return {
    keys: list,
    count,
    items: list.map((key) => ({ key, label: pinLabel(key), to: after ? pinTarget(key, after) : null })),
    headline: `${count} ${dropNoun(count)} back to ${typeTitle}?`,
    note: `${note} ${NO_UNDO}`,
    confirm: `Drop ${count}`,
    cancel: 'Keep them',
  };
}
