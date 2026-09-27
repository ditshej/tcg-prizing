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
 * Boden auf beiden Achsen") — an assurance, not an arrangement: the floor
 * still applies even where a measured width or height could not actually fit
 * it, because #62 does not build the folding that would make the assurance
 * bite on a narrower stage.
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
  const fits = Math.floor((stageWidth + TILE_GAP) / (TILE_SIZE + TILE_GAP));
  return Math.max(MIN_COLUMNS, fits);
}

/**
 * What the diagram gets of `leftoverHeight` — the height already measured as
 * available to (diagram + tile grid) once every other fixed part of the Plan
 * column has been subtracted by the rind. The two guaranteed tile rows come
 * off first; what remains goes to the diagram, never under `floor`.
 */
export function diagramCap(leftoverHeight, floor = MIN_DIAGRAM_HEIGHT) {
  return Math.max(floor, leftoverHeight - rowsHeight(MIN_ROWS));
}
