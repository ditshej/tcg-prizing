/**
 * The pure derivations of the shell's tile window: how many tile columns fit
 * a measured width, and how much height the diagram gets of the area it shares
 * with the tile grid (a third at most, #157). No DOM here — the measuring rind
 * (`measure.mjs`) reads `clientWidth`/`clientHeight` and hands the numbers in;
 * this module only does the arithmetic (#62, same seam as ADR 0004's
 * `readLocation`/`writeLocation` precedent for #47).
 *
 * The tile size, gap and the six-column/two-row master floor are the
 * `DistributionPlan` assurance from `CONTEXT.md` ("Hochformat-Master ist der
 * Boden auf beiden Achsen") — an assurance, not an arrangement: `columnsFor()`
 * raises a measured width to the floor rather than shrinking the tiles. That
 * the floor actually *fits* on every stage is the fold's business (#71,
 * `fold.mjs`), and it is checked there with `columnsFitting()`, which has no
 * floor under it.
 *
 * `diagramCap` deliberately does not reuse the spec's 158/245/406px figures
 * (docs from #61, "The three pages and the fold"): those were measured
 * against the full three-page shell with its Set block and footer, which #62
 * does not build. Reusing them here would be exactly the back-computed
 * number `AGENTS.md` warns against — a value that looks right for a
 * differently-shaped page. Instead the *other* fixed parts of this ticket's
 * simpler Plan skeleton are measured live by the rind and handed in as
 * `leftoverHeight`; only the tile constants below are ticket-independent.
 */

export const TILE_SIZE = 54;
export const TILE_GAP = 5;
export const MIN_COLUMNS = 6;
export const MIN_ROWS = 2;
export const MIN_DIAGRAM_HEIGHT = 60;

/** The pixel height of `rows` tiles stacked with the gap between them. */
export function rowsHeight(rows = MIN_ROWS) {
  return rows * TILE_SIZE + (rows - 1) * TILE_GAP;
}

/**
 * How many tile columns fit a measured width, at least the six-column master
 * floor. Not a real fit below the floor — an assurance the caller must still
 * honour. Since K3 of run 14 (#73) it is honoured by **narrowing** the tiles
 * under 365 px (`minmax(0, 54px)` columns in `plan.css`), not by scrolling;
 * the rows keep their 54 px, so no height sum moves.
 */
export function columnsFor(stageWidth) {
  return Math.max(MIN_COLUMNS, columnsFitting(stageWidth));
}

/**
 * How many tile columns a width really holds, with no floor under it. The
 * fold's master-floor sweep (#71) asks this and not `columnsFor()`: an
 * assurance that is raised by construction cannot be broken, so it cannot be
 * checked either.
 */
export function columnsFitting(width) {
  return Math.max(0, Math.floor((width + TILE_GAP) / (TILE_SIZE + TILE_GAP)));
}

/** The pixel width of `columns` tiles side by side with the gap between them. */
export function columnsWidth(columns) {
  return columns * TILE_SIZE + (columns - 1) * TILE_GAP;
}

/** The deck of the tile grid: 16 columns, and the app stops growing there (#61). */
export const MAX_COLUMNS = 16;

/**
 * How many tile columns the grid draws in a measured width: at least the
 * master's six, at most the deck's sixteen. The deck holds at every width,
 * fullscreen included — the prototype caps `.slots` at `--gridmax` in the page
 * and in `fsContent()` alike, and `fold()` reports `tileColumns` the same way.
 * Above the deck the app gets margins; in fullscreen, where the `Plan` is the
 * whole stage, the grid simply stops at sixteen (#73).
 */
export function tileColumnsFor(width) {
  return Math.min(MAX_COLUMNS, columnsFor(width));
}

/**
 * What the diagram gets of `leftoverHeight` — the height already measured as
 * available to (diagram + tile grid) once every other fixed part of the Plan
 * column has been subtracted by the rind. That is the area the diagram
 * **shares** with the tiles, and it takes **at most a third** of it: the tiles
 * always have more room than the diagram (#157, overall review 2026-10-08,
 * point 4 — the maintainer).
 *
 * `covered` is how much of the tile window's bottom an open raffle bar lies
 * over (`raffleCover()`). What the bar covers is not free, so the third is
 * taken of `leftoverHeight − covered`, and the diagram pays its share of the
 * overlap (#73, run 14, K1 `diagramm-weicht`, carried into #157). The
 * sentence "the bar covers no tile" (#69, #61) rests on that.
 *
 * `max` is the diagram's other upper bound on this stage (`diagramMax` out of
 * `fold()`, #142, the prototype's `stripMax`). Both are upper bounds and meet
 * as their minimum: at 1597 × 900 the third would be 224.7, the bound 190
 * wins; at 393 × 844 the bound 280 would leave the tiles less, the third 162
 * wins.
 *
 * No floor here any more: where the third is under 60, the diagram is not
 * drawn at all (`diagramFits()` below), so a cap under the floor is never
 * seen. The two tile rows hold by themselves — from 180 px of shared area on,
 * a third is never more than `shared − 113`.
 */
export function diagramCap(leftoverHeight, covered = 0, max = Infinity) {
  return Math.max(0, Math.min(max, (leftoverHeight - covered) / 3));
}

/**
 * Whether the diagram stands at all: only where its third of the shared area
 * (`diagramCap()` without the upper bound) reaches its `floor` of 60 — so from
 * 180 px of `leftoverHeight − covered` on. Under that it is gone, and the
 * tiles get its place (#157, F2 a: "Fällt ein Drittel unter den Boden 60,
 * fällt das Diagramm weg").
 *
 * The diagram is an extra, not part of the work (the maintainer, run 15 on
 * #129: "nur ein 'nice-to-have' … nur dazu kommt, wenn wirklich genug platz
 * ist"). Until #157 "enough room" was the floor left after the two tile rows
 * (`shared − 113 ≥ 60`, from 173 on); #157 replaced it with the third, from
 * 180 on. Consequence, decided with it:
 * at the fold edge (first height 399, 173 shared) and on the cramped stage
 * (`PLAN_FLOOR` 351, the same 173) there is no diagram, and the first height
 * and the floor keep their values.
 *
 * `leftoverHeight` must be measured **as if the diagram stood** (the rind
 * does), and `covered` reads the tile window's bottom (`raffleCover()`), never
 * its top — so showing or hiding the diagram moves neither input, and the
 * verdict cannot flip itself.
 */
export function diagramFits(leftoverHeight, covered = 0, floor = MIN_DIAGRAM_HEIGHT) {
  return (leftoverHeight - covered) / 3 >= floor;
}

/* ── The WinnerRaffle bar (#69) ──────────────────────────────────────────── */

/**
 * The air between the bar's top edge and the last tile row that still reads as
 * a tile. Both numbers the prototype uses (`padBottom()`, `showHit()`), and it
 * uses them for the same thing: what counts as "behind the bar".
 */
export const RAFFLE_CLEARANCE = 10;

/**
 * How much of the tile window an open raffle bar takes away from the top: the
 * window's bottom edge down from the bar's top edge less the clearance, `0`
 * where the window ends above the bar (the master, whose rail lies under the
 * bar) and while the bar is closed (`barRect` `null`).
 *
 * The window's **bottom** is read, never its top: the diagram above the grid
 * moves the top, the bottom stands at the column's foot. So the number the
 * diagram yields by does not move as the diagram yields — no loop.
 */
export function raffleCover(windowRect, barRect) {
  if (!barRect) return 0;
  return Math.max(0, windowRect.bottom - (barRect.top - RAFFLE_CLEARANCE));
}

/**
 * How much bottom padding the scrolling tile grid needs so the tiles run
 * **behind** the raffle bar instead of stopping at it (#69 AC 3).
 *
 * It is the overlap and nothing else — one rule with two results and no `if`
 * on the surface: in the Plan view the grid window ends far above the bar, the
 * overlap is zero, and the rule costs nothing. In fullscreen, where the grid
 * runs to the bottom edge, it is the bar's whole height. Without it the last
 * ranks are unreachable in exactly the moment a throw lands on one of them.
 *
 * The tile bubble (#66) hangs on this padding too: `placeBubble()` judges against
 * the stage and the grid and knows nothing of the bar, so the bubble stays clear
 * of it solely because no tile can be scrolled under the bar to anchor one.
 * Shrink this, and the bubble (z-index 38) opens beneath the bar (40).
 *
 * `barRect` is `null` while the bar is closed.
 */
export function raffleScrollPadding(windowRect, barRect) {
  if (!barRect) return 0;
  const overlap = Math.max(0, windowRect.bottom - barRect.top);
  return overlap > 0 ? overlap + RAFFLE_CLEARANCE : 0;
}

/**
 * The air between the strip and the bar's bottom edge — `.raffle-bar`'s `8px`
 * over `--strip-bottom` in `plan.css`.
 */
export const RAFFLE_AIR = 8;

/**
 * How far the `NoticeStack` rises while the raffle bar is open: the bar's
 * measured height plus its air, `0` while it is closed (`null` or `0`).
 *
 * The bar lies over the foot of the `Plan` column, and so does the stack. A
 * ConflictNotice has to be present (ADR 0002), so it must not lie under the
 * bar; the prototype lifts its stack by `--raffleh` for exactly that reason
 * (Runde 16: "sonst legt sich die Verlosung über die ConflictNotice, die nach
 * ADR 0002 anwesend sein muss") and its chips the same way wherever they share
 * the bar's corner (Runde 21). Measured at the acceptance by image (#73): with
 * the bar open the open ConflictNotice lay under it on every canvas, and the
 * chip did wherever it was not in the strip. The height is the rind's to
 * measure, because the bar grows with its retraction list.
 */
export function raffleLift(barHeight) {
  return barHeight > 0 ? barHeight + RAFFLE_AIR : 0;
}

/**
 * How far the tile grid has to scroll to show a hit — the centre of the
 * **free strip**, which is the scroll window cut off at the bar's top edge
 * (#69: "in die Mitte des freien Streifens").
 *
 * `0` means the tile is already in that strip and the grid does not move at
 * all. That is the ticket's own wording and #61's, and it is the one place
 * this file departs from the prototype: `showHit()` computes the delta
 * unconditionally and therefore recentres a tile that was fully readable
 * where it stood. Its own comment above it says the opposite ("und tut
 * nichts, wenn die Kachel schon sichtbar ist"), so the prose is taken over
 * both prose sources and the code of the throwaway is not.
 *
 * "Visible" measures against the bar's top edge and not against the bottom of
 * the scroll window, because the bar stands still while the retraction list
 * under it grows — a boundary that moved with the list would make the same
 * tile visible and hidden by turns, without anything having scrolled.
 *
 * One move, not two: the target is computed once and scrolled to once. Scrolled
 * `nearest` first and nudged afterwards, a set `scrollTop` cancels the smooth
 * run, and the tile is seen sliding to the edge rather than arriving in the
 * middle (the prototype's Runde 16, repaired in Runde 17).
 *
 * `paddingTop` is the scroller's own top padding (#168): the room the open
 * tile's ring needs at the top, not room a tile counts as seen in. The strip starts below
 * it, where the scroll window started before the padding came.
 */
export function hitScrollDelta(windowRect, tileRect, barTop = Infinity, paddingTop = 0) {
  const top = windowRect.top + paddingTop;
  const bottom = Math.min(windowRect.bottom, barTop - RAFFLE_CLEARANCE);
  if (tileRect.top >= top && tileRect.bottom <= bottom) return 0;
  return tileRect.top + tileRect.height / 2 - (top + (bottom - top) / 2);
}

/* ── The hit's pulse, drawn outside the grid's clip (#168, K1) ──────────── */

/*
 * The pulse's own numbers, as `@keyframes tile-hit` in `plan.css` writes them
 * (held equal by `test/ui-hit-pulse.test.mjs`): the tile grows to 1.14 at the
 * apex and its ring runs out to 11 px while it fades, once, in 900 ms. Kept
 * as the app had them, a deliberate departure from the prototype's hitpulse
 * (proto:741-747: 1.11, .85s, three times) — decision K1,
 * https://github.com/ditshej/tcg-prizing/issues/168#issuecomment-6068726592
 */
export const PULSE_SCALE = 1.14;
export const PULSE_RING_MAX = 11;
export const PULSE_MS = 900;

/**
 * How far the pulse can paint past the tile's edge, at most: the largest ring
 * at the largest scale, around the centre. An upper bound and not the curve —
 * scale and ring peak at different moments — so the clip below never cuts
 * what the pulse actually draws.
 */
export function pulseReach(width, height) {
  const half = Math.max(width, height) / 2;
  return Math.ceil((half + PULSE_RING_MAX) * PULSE_SCALE - half);
}

/**
 * The clip of the pulse overlay, as `clip-path: inset()` offsets from the
 * tile's own box (negative: past its edge), or `null` where the tile is not in
 * the grid's window at all and the overlay is not drawn.
 *
 * The overlay stands outside the scroller, so the scroller no longer clips
 * it: the window's edges are pushed out by `reach`, and the pulse draws over
 * header, diagram, legend and the grid's edge (K1). Two edges stay: a tile
 * scrolled out of the window shows no more than `reach` of itself past the
 * edge, and an open raffle bar (`barTop`) still covers the tiles that scroll
 * behind it — the bar stands over the grid, and the pulse stays under it as
 * the tile itself does.
 */
export function pulseClip(tileRect, windowRect, barTop = Infinity, reach = 0) {
  const visibleBottom = Math.min(windowRect.bottom, barTop);
  const seen = tileRect.right > windowRect.left && tileRect.left < windowRect.right
    && tileRect.bottom > windowRect.top && tileRect.top < visibleBottom;
  if (!seen) return null;
  return {
    top: windowRect.top - reach - tileRect.top,
    right: tileRect.right - (windowRect.right + reach),
    bottom: tileRect.bottom - Math.min(windowRect.bottom + reach, barTop),
    left: windowRect.left - reach - tileRect.left,
  };
}

/* ── The retraction list as one sideways row (#129, run 15, K5) ─────────── */

/**
 * Where a row that scrolls sideways stands: whether it overflows at all, and
 * whether it is at its start or its end. One pixel of slack on each, because
 * scroll positions land on fractions.
 */
export function rowScrollEnds({ scrollLeft, scrollWidth, clientWidth }) {
  const max = scrollWidth - clientWidth;
  return { overflow: max > 1, atStart: scrollLeft <= 1, atEnd: scrollLeft >= max - 1 };
}

/**
 * Where one arrow click takes the row: to the next pill edge in `direction`
 * (`1` on, `-1` back) — the row moves by one pill (the maintainer, run 15:
 * „ein klick auf einen pfeil lässt einfach eine pille bewegen"), never past
 * either end. `lefts` are the pills' left edges in the row's own coordinates.
 */
export function pillStep({ lefts, scrollLeft, scrollWidth, clientWidth }, direction) {
  const max = Math.max(0, scrollWidth - clientWidth);
  if (direction > 0) {
    const next = lefts.find((left) => left > scrollLeft + 0.5);
    return next == null ? max : Math.min(max, next);
  }
  const before = lefts.filter((left) => left < scrollLeft - 0.5);
  return before.length ? Math.max(0, before.at(-1)) : 0;
}

/**
 * The `scrollLeft` that shows `chip` (its `left` and `width` in the row) in a
 * row `clientWidth` wide now scrolled to `scrollLeft`: unchanged where it is
 * already whole in view, else just far enough — its left edge at the start or
 * its right edge at the end. A fresh hit's chip is brought in this way, the
 * successor of turning to its page.
 */
export function chipIntoView(chip, scrollLeft, clientWidth) {
  if (chip.left < scrollLeft) return chip.left;
  if (chip.left + chip.width > scrollLeft + clientWidth) return chip.left + chip.width - clientWidth;
  return scrollLeft;
}

/* ── The scroll fade band (#71) ──────────────────────────────────────────── */

/** How tall the band is that says "there is more below" (prototype, `.fade`). */
export const FADE_HEIGHT = 60;

/**
 * Whether a scrolling surface gets its fade band: only while something really
 * lies below its edge. A band over a surface that does not overflow claims
 * that it goes on, and one that stays at the bottom stop claims it once too
 * often (#61: "ein Band gehört der Fläche, die wirklich scrollt … und geht am
 * Anschlag aus"). Two pixels of slack, because a scroll position lands on
 * fractions and a stop reached is not always a stop to the pixel.
 */
export function fadeShown({ scrollHeight, clientHeight, scrollTop, paddingBottom = 0 }) {
  // The scroller's own padding under its content is no content: the tile grid
  // keeps a few pixels under its last row, and they claimed a band at every
  // count of ranks.
  return scrollHeight - paddingBottom - clientHeight - scrollTop > 2;
}

/**
 * How tall a surface's band is: the prototype's 60 px, but never more than a
 * quarter of the window it lies on. The tile window is two rows high next to
 * an elastic diagram (`diagramCap()`), and a 60 px band there covered half of
 * the second row — the row the first height exists for.
 *
 * The window is the scroller's height less its top padding (#168): that
 * padding is room for the open tile's ring above the top row, and it gives
 * the band no extra height.
 */
export function fadeHeight(clientHeight, paddingTop = 0) {
  return Math.min(FADE_HEIGHT, Math.round((clientHeight - paddingTop) / 4));
}
