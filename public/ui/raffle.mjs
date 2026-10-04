/**
 * The WinnerRaffle's operating step as a model (#69): what the fixed bar over
 * the foot navigation shows, and the one line of chance the app owns.
 *
 * The bar carries four things and **no head of its own** — it opens out of a
 * grip that already says the word (#61, "The WinnerRaffle"): the trigger, the
 * stand, the range grid, and the announcement plus the retraction list.
 *
 * Pure, so `node --test` proves it. Three things are deliberately *not* here:
 *
 * - **The pot.** `rafflePot()` is on the core side of the seam
 *   (`core/rules.mjs`), because it is a derivation out of the range and the
 *   allocation stand and nothing else.
 * - **The measuring.** The bar's own height, the padding under the grid and
 *   the scroll to a hit are `measure.mjs` over `geometry.mjs`.
 * - **The writing.** A throw writes the `manual` counters through the same
 *   handler the tile's ± uses (`setManualWinner()` in `plan.mjs`), and there
 *   is no second record of a draw anywhere. The app does not track where an
 *   allocation came from (CONTEXT.md, `WinnerRaffle`), which is also why a
 *   hit is marked only fleetingly.
 *
 * The `RaffleRange` is **no `Regler`**: no pin, no reset at the element,
 * untouched by a Set switch. It travels in the `SetupLink` nonetheless (run
 * 12, K1b on #72), as a key beside the sliders that is written only when it
 * differs from `all`, and the pin chip counts it and its drop puts it back to
 * `all` (run 12, Phase G on #72; `handSetKeys()` in `controls.mjs`). Its default `all` is a constant of
 * the term and not a sheet entry, so it stands here as `DEFAULT_RANGE` and
 * not in `core/defaults.mjs` — and once more, as `term`, in `link/keys.mjs`,
 * which may not import from the screen.
 */

import { RANGES, rafflePot } from '../core/rules.mjs';

/** The default is a constant of the term, not a DefaultSet entry (#61). */
export const DEFAULT_RANGE = 'all';

/**
 * One icon language for the range grid: ↑ for a prefix from `Rank` 1, ↓ for a
 * suffix at the bottom end, `all` as a word — a block said nothing to anybody
 * (the prototype's `rangeChip()`). The icon is the short form; the full name
 * rides along as the chip's title, so no step is ever only a symbol.
 */
const RANGE_ICON = {
  top8: '8',
  top16: '16',
  topQuarter: '¼',
  topThird: '⅓',
  topHalf: '½',
  topTwoThirds: '⅔',
  topThreeQuarters: '¾',
  all: 'all',
  bottomThreeQuarters: '¾',
  bottomTwoThirds: '⅔',
  bottomHalf: '½',
  bottomThird: '⅓',
  bottomQuarter: '¼',
};

const RANGE_NAME = {
  top8: 'top 8',
  top16: 'top 16',
  topQuarter: 'top quarter',
  topThird: 'top third',
  topHalf: 'top half',
  topTwoThirds: 'top two thirds',
  topThreeQuarters: 'top three quarters',
  all: 'all ranks',
  bottomThreeQuarters: 'bottom three quarters',
  bottomTwoThirds: 'bottom two thirds',
  bottomHalf: 'bottom half',
  bottomThird: 'bottom third',
  bottomQuarter: 'bottom quarter',
};

/** The screen name of a step, for the bar's chips and the sheet's pointer. */
export function rangeName(id) {
  return RANGE_NAME[id] ?? RANGE_NAME[DEFAULT_RANGE];
}

/**
 * The thirteen steps as the two rows the bar draws — **uncut and unfolded**
 * (#69 AC 4). The grid costs a measured 28 of 227px; shortening it would take
 * five steps #10 deliberately has, and folding it would cost a tap in exactly
 * the case the range is there for (#61).
 *
 * The rows are derived from `RANGES` rather than listed a second time, so a
 * step added to the core cannot go missing on the screen: the upper ones keep
 * their order, `all` opens the lower row across two cells, and each lower step
 * stands under the upper one it is the complement of.
 */
export const RANGE_ROWS = (() => {
  const upper = RANGES.filter((step) => step.comp === undefined && step.id !== DEFAULT_RANGE);
  const lower = RANGES.filter((step) => step.comp !== undefined);
  const chip = (step, wide = false) => ({
    id: step.id,
    icon: RANGE_ICON[step.id] ?? step.id,
    name: rangeName(step.id),
    arrow: step.id === DEFAULT_RANGE ? '' : step.comp === undefined ? '↑' : '↓',
    wide,
  });
  const all = RANGES.find((step) => step.id === DEFAULT_RANGE);
  return [
    upper.map((step) => chip(step)),
    // `all` first and two cells wide, then every lower step under its
    // counterpart — the prototype's `rangeGrid(…, withBottom)`.
    [chip(all, true), ...[...lower].reverse().map((step) => chip(step))],
  ];
})();

/** `1 winner pack` · `2 winner packs`. */
function packs(n) {
  return `${n} winner ${n === 1 ? 'pack' : 'packs'}`;
}

/**
 * The bar's whole content, out of a plan, the chosen range and the last hit.
 *
 * The **pot's size is not in here as a number**, and that is decided rather
 * than forgotten (CONTEXT.md, `RafflePot`): it answers "how many" while the
 * question at the table is "where", and before the first throw it would only
 * repeat the range that was just chosen. What is shown of it is its *empty*
 * state, as a sentence beside the locked trigger — otherwise that would be a
 * dead button with no reason given (ADR 0002: an unfit state is named, not
 * hidden).
 *
 * The stand counts the same unit as the trigger beside it: how many winner
 * packs already have a recipient, `ranked` and `manual` together, against the
 * number the ranks are owed. Standing at more placed than available, it reads
 * visibly wrong, and that is the intention — the overhang is #70's
 * `ConflictNotice`, not a number this line is to hide.
 */
export function raffleView(plan, raffleRange, lastDraw = null) {
  const pot = rafflePot(plan, raffleRange);
  const allocation = plan.allocation;
  const open = allocation.open;
  const placed = allocation.ranked + allocation.manualCount;
  const total = plan.rank.winners;

  const potEmpty = pot.length === 0 && open > 0;
  const canRaffle = open > 0 && pot.length > 0;

  return {
    range: raffleRange,
    rangeName: rangeName(raffleRange),
    pot,
    open,
    canRaffle,
    stand: `${placed} of ${packs(total)} placed`,
    /* Only the empty pot gets a sentence. "All placed" needs none: the stand
       beside it already reads `6 of 6 winner packs placed`, and a second
       sentence saying the same thing is the noise ADR 0002 is not asking for.
       It names the state and asks for nothing: "— widen the range" was taken
       out everywhere (#129, run 15, K2 — "an diesem Ort falsch"). */
    potEmptyNote: potEmpty ? 'every rank in range already has one' : null,
    /* The announcement does not survive the retraction: whoever takes the rank
       out of the list has undone the throw, and a sentence about it would be a
       claim about a state that no longer exists. */
    hit: lastDraw != null && (allocation.manual[lastDraw] ?? 0) > 0 ? lastDraw : null,
    takeBack: takeBackList(allocation.manual),
  };
}

/**
 * The retraction list, sorted by `Rank` and never by recency. A list in the
 * order things happened would be a weak draw history — and the app keeps no
 * history on purpose. Sorted by rank, "clicked once too often" and "I don't
 * like who it hit" stay one tap apart from each other rather than from the
 * same place (#35, #61).
 *
 * The entry names the `Rank`, because naming the `Rank` is the whole of what
 * tells correcting apart from re-rolling. There is no ✕ on the announcement
 * for the same reason.
 */
function takeBackList(manual) {
  return Object.keys(manual ?? {})
    .map((key) => Math.trunc(Number(key)))
    .filter((rank) => Number.isFinite(rank) && (manual[rank] ?? 0) > 0)
    .sort((a, b) => a - b)
    .map((rank) => ({ rank, count: manual[rank], label: `Rank ${rank}` }));
}

/**
 * One `Rank` out of the pot, drawn evenly (#10, CONTEXT.md `WinnerRaffle`).
 * `roll` is handed in so `node --test` can hand over a die that remembers;
 * the app hands `Math.random`.
 *
 * This is the app's whole chance, and it sits **in the input**: what it
 * produces is written into the `manual` counters and nothing else, so
 * recomputing the plan never changes a winner.
 */
export function drawFrom(pot, roll = Math.random) {
  if (!pot?.length) return null;
  const at = Math.floor(roll() * pot.length);
  return pot[Math.min(pot.length - 1, Math.max(0, at))];
}

