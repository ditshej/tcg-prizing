/**
 * The pure derivations of the shell's tile window: how many tile columns fit
 * a measured width, and how much height the diagram gets once the two
 * guaranteed tile rows are set aside. No DOM here — the measuring rind
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
 * honour, e.g. by scrolling rather than shrinking the tiles (#62, AC 3).
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
 * What the diagram gets of `leftoverHeight` — the height already measured as
 * available to (diagram + tile grid) once every other fixed part of the Plan
 * column has been subtracted by the rind. The two guaranteed tile rows come
 * off first; what remains goes to the diagram, never under `floor`.
 */
export function diagramCap(leftoverHeight, floor = MIN_DIAGRAM_HEIGHT) {
  return Math.max(floor, leftoverHeight - rowsHeight(MIN_ROWS));
}

/* ── The WinnerRaffle bar (#69) ──────────────────────────────────────────── */

/**
 * The air between the bar's top edge and the last tile row that still reads as
 * a tile. Both numbers the prototype uses (`padBottom()`, `showHit()`), and it
 * uses them for the same thing: what counts as "behind the bar".
 */
export const RAFFLE_CLEARANCE = 10;

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
 */
export function hitScrollDelta(windowRect, tileRect, barTop = Infinity) {
  const top = windowRect.top;
  const bottom = Math.min(windowRect.bottom, barTop - RAFFLE_CLEARANCE);
  if (tileRect.top >= top && tileRect.bottom <= bottom) return 0;
  return tileRect.top + tileRect.height / 2 - (top + (bottom - top) / 2);
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
 */
export function fadeHeight(clientHeight) {
  return Math.min(FADE_HEIGHT, Math.round(clientHeight / 4));
}
