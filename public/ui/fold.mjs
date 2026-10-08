/**
 * The fold (#71): out of the stage's width and height fall how many of the
 * three pages stand side by side, whether the stage is flat, how wide the
 * `Plan` column is, and the two insets where the `Plan` column stops on either
 * side. A pure derivation under `node --test` — the measuring rind
 * (`measure.mjs`) reads the stage's box and hands the two numbers in; nothing
 * here touches a DOM (ADR 0004, `## Nachtrag`).
 *
 * > Die Navigation ist das, was vom Layout übrig bleibt, wenn kein Platz mehr ist.
 *
 * One rule carries the width axis: **no column ever falls below the width it
 * had when it first appeared.** The breakpoints follow from it as sums, not as
 * choices (#71, #61 "The three pages and the fold").
 */

import {
  MAX_COLUMNS,
  MIN_DIAGRAM_HEIGHT,
  MIN_ROWS,
  columnsFor,
  columnsWidth,
  rowsHeight,
} from './geometry.mjs';

/**
 * The first widths. `Plan`'s and `Prepare`'s are the prototype's round 19
 * (`--planmin`, `--prep`), carried into #61 and #71; `Prepare`'s is measured
 * at its widest line, the Release hint with its button. `Details`' is **286**,
 * decided at #71 (run 13, K-B9): since #113 the column holds counters instead
 * of sliders, and a column without sliders has no single natural width, so
 * its first width is the smallest one without overflow (min-content), with
 * the heads allowed to wrap. The prototype's 352 was measured with sliders
 * and no longer holds.
 */
export const FIRST_WIDTH = Object.freeze({ plan: 388, details: 286, prepare: 356 });

/** `Plan | Details` from here on — 674 at the decided first widths (#71, K-B9). */
export const TWO_COLUMNS = FIRST_WIDTH.plan + FIRST_WIDTH.details;

/** `Prepare | Plan | Details` from here on — 1030 at the decided first widths. */
export const THREE_COLUMNS = TWO_COLUMNS + FIRST_WIDTH.prepare;

/**
 * The `Plan` column's own side padding — `.plan-stage`'s `8px` on either side
 * in `plan.css`. The tiles get the column's width less this.
 */
export const PLAN_PADDING = 16;

/**
 * The deck: the width at which the `Plan` has its sixteen tile columns with
 * both other columns beside it. Above it the app stops growing and gets
 * margins instead (#61). A sum like the breakpoints, decided as such at #71
 * (K-B9): 939 + 16 + 286 + 356 = 1597, so it moves with `Details`' first
 * width by the same 66 px as both breakpoints. The prototype's 1674 is the
 * same sum with the old 352, its own 24 px of padding and two frame lines.
 */
export const DECK = columnsWidth(MAX_COLUMNS) + PLAN_PADDING + FIRST_WIDTH.details + FIRST_WIDTH.prepare;

/* ── The height axis ─────────────────────────────────────────────────────── */

/**
 * The fixed part of the `Plan` column — everything in it except the diagram
 * and the tile window: head, participation line, legend, rank total and rank
 * message, with the column's top padding and the gaps between them. Measured
 * on the built app (#71, 2026-10-02, Chromium) at the `Plan`'s first width
 * of 388 px with a rank message standing: 8 padding + 41.5 head + 16
 * participation + 21.9 legend + 15 rank total + 27 rank message + 6 gaps × 8
 * = 177.4, rounded up.
 *
 * **Not 158 and not 245.** #40 derives the first height with `158`, the fixed
 * part *without* the bar, and #71's body with `245`, the fixed part *with* a
 * bar of 87 px. Both were measured on the prototype with sliders (#113 took
 * them away). Here the diagram has no fixed height at all — it is the one
 * elastic size of the column (`diagramCap()`), never under its 60 px floor —
 * so the bar enters the sum below as that floor, not as a measured height.
 */
export const PLAN_FIXED = 178;

/** The foot on the phone: icon over word (#63, measured 56). */
export const FOOT_HEIGHT = 56;

/** The strip from two columns on: icon beside word (#61, 48). */
export const STRIP_HEIGHT = 48;

/** The strip turned to the right edge on the flat stage (prototype, `--footw`). */
export const STRIP_WIDTH = 48;

/**
 * The rail of the hot controls under the `Plan`, while there is one column:
 * its height is **measured**, not assumed (#73, run 14, K2
 * `schiene-gemessen`). The rail wraps with the width — since #143 two
 * counters (Players, Served ranks) side by side from a 360 stage up (round
 * 142·145, K2) and the curve chips over the full width under them, breaking
 * 4 + 3 under 348 — and its height goes 124 to 212 px (measured after #143;
 * 124 to 229 with #142's four controls, 62 to 117 before #142); the 87 that
 * #71's K-B10a reckoned with held at the master only. The measuring rind
 * (`measureRail()` in `measure.mjs`) reads the rail in its bar form at the
 * stage's width and hands it in as `railHeight`.
 *
 * This value is no rule — it is what `fold()` uses **until the first
 * reading** and under `node --test`, where nothing is measured: the rail at
 * the boot stage, the 393 × 830 master, measured 124 again on 2026-10-08
 * after #143 (headless Chrome, `.plan-controls` with its padding, no link and
 * with the old start values pinned: 650–774) — the same 124 as before #143,
 * since the chips' row is as high as the counter row it replaced (87 on
 * 2026-10-02, before #142).
 */
export const RAIL_AT_MASTER = 124;

/**
 * What the `Plan` column needs to show its fixed part, the diagram at its
 * floor and the master's two tile rows: 178 + 60 + 113 = 351 (#71, K-B10).
 */
export const PLAN_FLOOR = PLAN_FIXED + MIN_DIAGRAM_HEIGHT + rowsHeight(MIN_ROWS);

/**
 * The **first height of the `Plan`** (#71, #40): its floor plus the strip it
 * stands on once the pages are columns — 178 + 60 + 113 + 48 = **399**,
 * decided at #71 (run 13, K-B8). Below it nothing opens side by side — the
 * stage is flat. The diagram enters at its floor, not at its height on the
 * portrait master: on a low screen the diagram gives way and the two tile
 * rows hold. The body's `245 + 2 tile rows + 48 = 406` is overruled.
 */
export const FIRST_HEIGHT = PLAN_FLOOR + STRIP_HEIGHT;

/**
 * The same sum for the one-column form, which stands on the 56 px foot and
 * carries the rail: 351 + 56 + the rail as measured at this width (#73, run
 * 14, K2 — it replaces K-B10a's fixed 494, whose 87 held at the master only).
 * Carried over with the column form's 399, a stage under the first breakpoint
 * would keep the master and lose its second tile row — 600 × 450, say. So the
 * one rule is asked in the form the stage would actually take, with the rail
 * that form actually has.
 */
export function firstHeightOneColumn(railHeight) {
  return PLAN_FLOOR + FOOT_HEIGHT + railHeight;
}

/**
 * The diagram's upper bound (#142), the prototype's `stripMax`
 * (proto:3217–3253, "Das Diagramm darf nicht die halbe Fläche nehmen"),
 * looked up and not re-derived: 96 on the flat stage, 96 under 460 height,
 * 190 with two columns or more, 280 with one. Its floor (60) and whether it
 * stands at all are `diagramCap()`/`diagramFits()`'s, unchanged; the bound
 * only takes height from the diagram and gives it to the tile grid.
 */
export const DIAGRAM_MAX = Object.freeze({ flat: 96, low: 96, columns: 190, oneColumn: 280 });

/** Under this stage height the diagram keeps its flat bound (prototype, `h < 460`). */
export const DIAGRAM_LOW_HEIGHT = 460;

/**
 * The fold of a stage `{ width, height, fullscreen }`. Everything between the
 * breakpoints goes to the `Plan` — the one column that profits from width.
 *
 * The **height is the second axis**: is the stage lower than the first height
 * of the form it would take, nothing opens side by side. One page stays, the
 * width goes inward (`Details` and `Prepare` two columns inside, row flow),
 * and the foot turns to the right edge. Flat begins at 388 + 48 = **436**
 * wide, under the two-column step too (#71, run 13, K-B10b). The four hot
 * controls then stand as a column beside the `Plan` where both first widths
 * fit next to the strip — from 388 + 286 + 48 = **722** (K-B10c) — and
 * between 436 and 721 nowhere on the `Plan` page: on `Details` they stand
 * anyway, and under the `Plan` they would cost the second tile row. The cliff
 * at 722 (the `Plan` drops to 6 tile columns as the column opens) is
 * taken on purpose, the same class as any column opening.
 *
 * Three cases collapse into **two insets**: where the `Plan` stops on either
 * side. Phone, two columns, three columns, flat and fullscreen all come out
 * of them with no `if` on the surface; the fullscreen sets both to zero.
 */
export function fold({ width, height = Infinity, fullscreen = false, railHeight = RAIL_AT_MASTER, insetBottom = 0 }) {
  const stage = Math.min(width, DECK);
  const wide = stage >= THREE_COLUMNS ? 3 : stage >= TWO_COLUMNS ? 2 : 1;
  // The form that is asked about stands on a bottom foot, and that foot
  // carries the strip over the home indicator (#158, K4) — so it is asked
  // with the strip. Turned flat, the strip goes and the height comes back.
  const low = height - insetBottom < (wide === 1 ? firstHeightOneColumn(railHeight) : FIRST_HEIGHT);
  // Flat means too little height for columns but width enough that it has to
  // go somewhere: the turned strip takes 48 px off the side, and the `Plan`
  // must keep its first width beside it. From 436 on, not only from the
  // two-column step as in the prototype's `isFlat()` (#71, K-B10b).
  const flat = low && stage - STRIP_WIDTH >= FIRST_WIDTH.plan;
  const columns = flat ? 1 : wide;
  // Too low for its form and too narrow to turn the strip aside: the master's
  // exception (#71, B14). Nothing lies on top of anything there — the `Plan`
  // keeps its floor, the rail stands under it, and the page scrolls (#73, K4).
  const cramped = low && !flat && !fullscreen;

  const detailsWidth = columns >= 2 ? FIRST_WIDTH.details : 0;
  const prepareWidth = columns === 3 ? FIRST_WIDTH.prepare : 0;
  const stripWidth = flat && !fullscreen ? STRIP_WIDTH : 0;
  const hotColumn = flat && stage - STRIP_WIDTH >= FIRST_WIDTH.plan + FIRST_WIDTH.details;
  const rail = fullscreen ? 'none' : columns >= 2 ? 'none' : flat ? (hotColumn ? 'column' : 'none') : 'bar';

  const planLeft = fullscreen ? 0 : prepareWidth;
  const planRight = fullscreen ? 0 : detailsWidth + stripWidth;
  // The bottom inset is the foot's, upright only (#158, K4): where the foot
  // stands at the bottom it carries it as a strip in its paper (`plan.css`,
  // `.foot`); turned flat or hidden in fullscreen, there is no strip.
  const footInset = fullscreen || flat ? 0 : insetBottom;
  const stripBottom = fullscreen || flat ? 0 : (columns === 1 ? FOOT_HEIGHT : STRIP_HEIGHT) + footInset;
  const planWidth = stage - planLeft - planRight - (rail === 'column' ? FIRST_WIDTH.details : 0);
  const planHeight = cramped ? PLAN_FLOOR : height - stripBottom - (rail === 'bar' ? railHeight : 0);

  const diagramMax = flat || height - footInset < DIAGRAM_LOW_HEIGHT
    ? (flat ? DIAGRAM_MAX.flat : DIAGRAM_MAX.low)
    : columns >= 2 ? DIAGRAM_MAX.columns : DIAGRAM_MAX.oneColumn;

  return {
    columns,
    flat,
    diagramMax,
    cramped,
    fullscreen,
    rail,
    planLeft,
    planRight,
    stripBottom,
    footInset,
    stripWidth,
    planWidth,
    planHeight,
    detailsWidth,
    prepareWidth,
    tileColumns: Math.min(MAX_COLUMNS, columnsFor(planWidth - PLAN_PADDING)),
  };
}

/**
 * Whether `page` stands on screen in fold `f` while `active` is the active
 * page. One column: the active page alone. Two: `Details` as a column and in
 * the left slot `Plan` or `Prepare` — `Prepare` takes the place of the `Plan`,
 * not of the screen, because the controls are what one turns all the time
 * (#61). Three: all of them. Fullscreen: the `Plan` alone.
 */
export function pageShown(f, active, page) {
  if (f.fullscreen) return page === 'plan';
  if (f.columns === 3) return true;
  if (f.columns === 2) return page === 'details' || page === (active === 'prepare' ? 'prepare' : 'plan');
  return page === active;
}

/** The active page once `f` is applied: a page that stands as a column is no longer one. */
export function foldPage(f, active) {
  if (f.columns >= 2 && active === 'details') return 'plan';
  if (f.columns === 3 && active === 'prepare') return 'plan';
  return active;
}

/** A notice chip's height and the air the chip row keeps below it (`.notice-chip`). */
export const CHIP_HEIGHT = 34;
export const CHIP_AIR = 8;

/**
 * The fold's sizes as the CSS custom properties `plan.css` hangs everything
 * on. The `NoticeStack`, the raffle bar and the fade bands all read the two
 * insets and nothing else about the fold — no `if` on the surface.
 *
 * The chip goes to **the lowest free corner on the right**: one row above the
 * foot on the phone; from two columns on into the strip, which has a free
 * place on the right (vertically centred in its 48 px); on the flat stage
 * beside the turned strip, not into it; in fullscreen at the bottom edge. One
 * rule, and the open stack lifts above the chip row exactly where the chips
 * do not sit in a band of their own (`--chip-lift`). Where they do not, they
 * also rise above an open raffle bar with the stack (`--chip-raffle`).
 */
export function foldProperties(f) {
  // The strip from two columns on — measured without the inset strip under
  // it, which the chips sit above (#158, K4).
  const chipsInStrip = f.stripBottom - (f.footInset ?? 0) === STRIP_HEIGHT;
  const px = (n) => `${n}px`;
  return {
    '--deck': px(DECK),
    '--col-details': px(FIRST_WIDTH.details),
    '--col-prepare': px(FIRST_WIDTH.prepare),
    '--strip-width': px(STRIP_WIDTH),
    // The `Plan`'s floor as the cramped stage draws it (#73, K4): the diagram
    // at its floor and two tile rows, the page scrolling under them.
    '--diagram-floor': px(MIN_DIAGRAM_HEIGHT),
    '--two-rows': px(rowsHeight(MIN_ROWS)),
    // The diagram's upper bound on this stage (#142); the rind hands it to
    // `diagramCap()`.
    '--diagram-max': px(f.diagramMax),
    '--plan-left': px(f.planLeft),
    '--plan-right': px(f.planRight),
    '--strip-bottom': px(f.stripBottom),
    '--chip-right': px(f.stripWidth),
    '--chip-bottom': px(chipsInStrip ? (f.footInset ?? 0) + (STRIP_HEIGHT - CHIP_HEIGHT) / 2 : f.stripBottom + CHIP_AIR),
    '--chip-lift': px(chipsInStrip ? 0 : CHIP_HEIGHT + CHIP_AIR),
    // Whether the chips share the open raffle bar's corner and rise above it
    // with the stack (`--raffle-lift`, measured by the rind): everywhere but
    // in the strip, which lies under the bar (#73; the prototype's `#badges`).
    '--chip-raffle': chipsInStrip ? '0' : '1',
  };
}
