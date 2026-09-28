/**
 * The Details sheet's register (#64): which controls stand on it, in which
 * groups, and where each one's two ends are. Pure derivations over a resolved
 * `Settings` and the `DistributionPlan` it produced — no DOM, so `node --test`
 * proves them, which is what #61's Testing Decisions ask of the shell's
 * provable half ("Die Deckel an den Bedienelementen").
 *
 * The one thing this file is *for*: a cap has exactly one home. #61 —
 * "Schieber und Zählwerk kennen denselben Deckel, sonst schiebt das eine über
 * das andere hinaus." The slider element, the counter's ±, and the clamp that
 * writes a value all read `boundsFor()`.
 *
 * The labels and the explanation texts are deliberately *not* here: PHP
 * composes what never changes while a slider is dragged (#61, "The seam" —
 * "Gruppentitel, Erklärtexte, die ⓘ-Texte"), so they live in
 * `views/controls-sheet.php` as markup. What lives here is what a number
 * depends on.
 *
 * ## Why seventeen, spelled out
 *
 * #46 gives `Settings` nineteen fields. Two of them name a `Rank` —
 * `displays` and `manualWinner` — and are set at the tile, never on a slider
 * (#61, "The tiles and their grip"; #66). The remaining seventeen are what
 * #64 and #61 call "alle siebzehn Regler". `depthStep` is one of them and is
 * *not* a control of its own: it is the step grid inside `Served ranks`
 * (CONTEXT.md, `RankPoolDepth` — "der Regler selbst bleibt absolut: die Stufe
 * liefert nur den Startwert"), which is why `SHEET_KEYS` has seventeen
 * entries while the sheet draws sixteen boxes.
 *
 * `raffleRange` is not among them and is not a miscount: #61 says outright it
 * is no `Regler` but session state of the operating step. Its pointer on the
 * sheet belongs to #69.
 */

import { distribute } from '../core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../core/rules.mjs';

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

/** The four trailing sliders read their number off the plan while they are
 *  `auto`: `null` in `Settings` means "the core computes it" (ADR 0006). */
const FROM_PLAN = {
  depth: (plan) => plan.depth,
  tournamentPacks: (plan) => plan.pool.packs,
  ranked: (plan) => plan.allocation.ranked,
  winnerPacks: (plan) => plan.pool.winners,
};

/**
 * The ends of #46 (`## Slider ranges`), looked up there and not recomputed
 * from what the core happens to read today (`AGENTS.md`). The spec makes two
 * classes and **only the first is domain**, which is the distinction this
 * table used to blur:
 *
 * - **Search ranges** — the sliders `suggestions()` sweeps. They enter a
 *   statement about the result, so their ends are decided and may not drift:
 *   `curve` the seven steps, `rankFloor` 0…8, `depth` 1…player count,
 *   `displays[i]` 0…4, `participationBooster` 0…`boosterRate`. A way out the
 *   core offers past one of these ends would be an offer the control cannot
 *   take, which is why `test/ui-controls.test.mjs` holds the two against each
 *   other by running the search rather than by copying its numbers.
 * - **Stops** — everything else. Guards, so a slider has two ends, and #46
 *   says outright they may rise at any time without a decision falling:
 *   `players` 2…128, `boosterRate` 0…12, `participationPack` 0…4,
 *   `tournamentPacks` 0…512, `winnerPacks` 0…64, `displaySize` 1…60,
 *   `envelopeSize` 1…64, `envelopeYield` 1…8. Eight, and `rankFloor` is not
 *   among them: its 0…8 is a search range and carries the weight of one.
 *
 * `rankFloor` sits in this constant all the same, because 0…8 is a pair of
 * numbers either way and a second lookup table would not make it a different
 * one. `depth` and `participationBooster` cannot, their ends being quantities
 * of the stand.
 *
 * `judgeBooster` and `judgeWinner` are the pair #46 leaves without either —
 * "ihre Obergrenze ist der jeweilige Rest, und das ist keine Zahl, sondern die
 * Summenregel." A range input still needs two ends, so the end drawn here is
 * that rest at its widest: the whole respective `Pool`. It prevents nothing
 * ADR 0002 wants reported — handing the judge everything leaves the ranks
 * empty, and an empty plan is a plan the app shows and explains.
 *
 * `ranked` is in neither class: #46 does not range it at all, and its end —
 * the winner packs the ranks hold, capped at the player count — is #61's.
 */
const FIXED_BOUNDS = {
  players: { min: 2, max: 128 },
  boosterRate: { min: 0, max: 12 },
  participationPack: { min: 0, max: 4 },
  tournamentPacks: { min: 0, max: 512 },
  winnerPacks: { min: 0, max: 64 },
  displaySize: { min: 1, max: 60 },
  envelopeSize: { min: 1, max: 64 },
  envelopeYield: { min: 1, max: 8 },
  rankFloor: { min: 0, max: 8 },
};

/**
 * `key`, and the stand it is read against, → `{ min, max }`, or `null` where
 * the control is not a number at all.
 *
 * It never looks at the current value, and that is the point: a `pinned`
 * value over its cap is never cut (ADR 0006). The cap says what a *handling*
 * may reach, `effectiveValue()` says what stands.
 */
export function boundsFor(key, { settings, plan }) {
  if (key in FIXED_BOUNDS) return { ...FIXED_BOUNDS[key] };
  if (key === 'depth') return { min: 1, max: plan.players };
  if (key === 'ranked') return { min: 0, max: Math.min(plan.rank.winners, plan.players) };
  if (key === 'participationBooster') return { min: 0, max: Math.max(0, Number(settings.boosterRate) || 0) };
  if (key === 'judgeBooster') return { min: 0, max: plan.pool.booster };
  if (key === 'judgeWinner') return { min: 0, max: plan.pool.winners };
  return null;
}

/** What the control shows: the pinned number, or the one the core computed. */
export function effectiveValue(key, { settings, plan }) {
  const value = settings[key];
  if (value == null && FROM_PLAN[key]) return FROM_PLAN[key](plan);
  return value;
}

/**
 * The cap as the control actually draws it: `boundsFor()`, widened to take in
 * the value that stands.
 *
 * A pinned value is never cut by a cap that sank under it (ADR 0006) — so a
 * cap that sank under it must not turn into a wall either, or the one way
 * back down would be gone at exactly the moment it is wanted. The cap keeps
 * doing its whole job in the direction that matters: it still stops a
 * handling from reaching *further* out.
 *
 * Slider and counter both draw from here, which is what makes "Schieber und
 * Zählwerk kennen denselben Deckel" (#64) true of the drawn control and not
 * merely of the table it was drawn from: a range input silently pins its
 * thumb to its own `max`, so a narrower `max` here would show a number that
 * is not the value.
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
 * bounds the slider and the counter are drawn from; a step id that is not a
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

/* ── The two that are set at the tile (#66) ─────────────────────────────── */

/**
 * `displays` and `manualWinner` are the two Settings fields that carry no
 * slider: both name a `Rank`, and a `Rank` is a tile, not a number one types
 * into a control (ADR 0003, #61 "The tiles and their grip"). Their caps stand
 * here all the same, beside the sliders' — #61 gives a cap **one** home
 * ("Schieber und Zählwerk kennen denselben Deckel"), and a second home is how
 * the tile and the sheet come to disagree about the same stand.
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
 * And the asymmetry `reachFor()` already encodes for the sliders holds here
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
  if (next > current && distribute({ ...settings, displays: after }).conflict) return null;
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
