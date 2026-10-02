import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TILE_SIZE,
  TILE_GAP,
  MIN_COLUMNS,
  MIN_ROWS,
  RAFFLE_CLEARANCE,
  rowsHeight,
  columnsFor,
  diagramCap,
  hitScrollDelta,
  raffleScrollPadding,
  fadeShown,
  fadeHeight,
} from '../public/ui/geometry.mjs';

test('rowsHeight(2) is the master floor: two 54px tiles plus one 5px gap', () => {
  assert.equal(rowsHeight(2), 113);
});

test('rowsHeight of a single row has no gap to add', () => {
  assert.equal(rowsHeight(1), TILE_SIZE);
});

test('columnsFor fits exactly as many 54px/5px columns as the width holds', () => {
  // 6 columns need 6*54 + 5*5 = 349px; one pixel short must still floor to 5,
  // but the master assurance (CONTEXT.md, DistributionPlan) raises it to 6.
  assert.equal(columnsFor(349), 6);
  assert.equal(columnsFor(348), 6); // assured floor, not a real fit
  // A 7th column needs 7*54 + 6*5 = 408px.
  assert.equal(columnsFor(407), 6); // one pixel short of a 7th
  assert.equal(columnsFor(408), 7);
});

test('columnsFor never drops below the six-column master floor, even on a tiny stage', () => {
  assert.equal(columnsFor(0), MIN_COLUMNS);
  assert.equal(columnsFor(100), MIN_COLUMNS);
});

test('columnsFor grows past the floor once the stage is wide enough for a 16-column deck (spec: the Deckel at 1674)', () => {
  // 16 columns need 16*54 + 15*5 = 939px, comfortably under the 1674 stage.
  assert.equal(columnsFor(939), 16);
});

test('diagramCap gives the leftover, after the two guaranteed tile rows, to the diagram', () => {
  // leftover 313 = 200 for the diagram + 113 for the two rows.
  assert.equal(diagramCap(313), 200);
});

// Below a leftover of 173px, the floor gives the diagram its 60px anyway and
// the grid gets less than the two rows' 113px — #61's own master-floor
// assurance is then broken, and it stays broken until #71 builds the fold:
// the Plan's first height (245 fixed part + 2 tile rows + 5px gap + 48px
// strip = 406px) is the threshold below which #71 stops opening this stage
// at all, so `diagramCap` never sees a leftover this small in the folded UI.
test('diagramCap floors at 60px, even when that leaves less than the two tile rows', () => {
  assert.equal(diagramCap(173), 60); // 173 - 113 = 60, the exact boundary
  assert.equal(diagramCap(100), 60); // would go negative without the floor
  assert.equal(diagramCap(0), 60);
});

test('diagramCap accepts a custom floor for a differently-tuned stage', () => {
  assert.equal(diagramCap(100, 40), 40);
  assert.equal(diagramCap(200, 40), 87);
});

test('MIN_ROWS is the master floor used by rowsHeight when called without an argument', () => {
  assert.equal(rowsHeight(), rowsHeight(MIN_ROWS));
});

test('TILE_SIZE and TILE_GAP are the tile constants the spec measures against', () => {
  assert.equal(TILE_SIZE, 54);
  assert.equal(TILE_GAP, 5);
});

/* ── The WinnerRaffle bar's two measured rules (#69) ─────────────────────── */

/**
 * The bar lies **over** the tile grid, so the grid is given exactly the
 * overlap as padding and the tiles scroll behind it (#69 AC 3). One rule, two
 * results, no `if` on the surface: in the Plan view the grid window ends well
 * above the bar, the overlap is zero, and nothing happens by itself.
 */
test('the scroll padding is exactly the overlap, plus the clearance that makes the last row readable', () => {
  // The grid ends at 700, the bar's top edge is at 640 → 60px are covered.
  assert.equal(raffleScrollPadding({ bottom: 700 }, { top: 640 }), 60 + RAFFLE_CLEARANCE);
});

test('a bar that does not reach the grid window costs no padding at all', () => {
  assert.equal(raffleScrollPadding({ bottom: 400 }, { top: 640 }), 0);
  assert.equal(raffleScrollPadding({ bottom: 640 }, { top: 640 }), 0); // edge to edge
  assert.equal(raffleScrollPadding({ bottom: 700 }, null), 0); // bar closed
});

/**
 * "Sichtbar" measures against the **top edge of the bar**, not the bottom of
 * the scroll window (#69, #61): the bar stands still while the retraction list
 * under it grows, so the boundary stands still too.
 */
test('a tile already inside the free strip is not scrolled to at all', () => {
  const window = { top: 100, bottom: 500 };
  // The bar's top edge at 410 leaves the free strip 100…400 once the same
  // clearance the padding uses is taken off it.
  assert.equal(hitScrollDelta(window, { top: 200, bottom: 254, height: 54 }, 410), 0);
  assert.equal(hitScrollDelta(window, { top: 346, bottom: 400, height: 54 }, 410), 0); // edge to edge
});

test('a tile hidden behind the bar is scrolled to, even though it is inside the scroll window', () => {
  const window = { top: 100, bottom: 500 };
  // Free strip 100…400, its middle 250. The tile sits at 420…474 — inside the
  // window, behind the bar — so its centre 447 has to travel up by 197.
  assert.equal(hitScrollDelta(window, { top: 420, bottom: 474, height: 54 }, 410), 197);
});

test('with the bar closed the free strip is the whole scroll window', () => {
  const window = { top: 100, bottom: 500 };
  assert.equal(hitScrollDelta(window, { top: 420, bottom: 474, height: 54 }), 0);
  // Below the window: centre 747 against the middle 300 → 447 down.
  assert.equal(hitScrollDelta(window, { top: 720, bottom: 774, height: 54 }), 447);
});

test('the target is the middle of the free strip, not "just barely in"', () => {
  // A tile far above: free strip 100…400 (middle 250), tile centre 27 → −223.
  assert.equal(hitScrollDelta({ top: 100, bottom: 500 }, { top: 0, bottom: 54, height: 54 }, 410), -223);
});

/* ── The scroll fade band (#71) ──────────────────────────────────────────── */

test('a surface that does not overflow gets no fade band', () => {
  assert.equal(fadeShown({ scrollHeight: 542, clientHeight: 566, scrollTop: 0 }), false);
  assert.equal(fadeShown({ scrollHeight: 566, clientHeight: 566, scrollTop: 0 }), false);
});

test('a surface with something below its edge gets the band', () => {
  assert.equal(fadeShown({ scrollHeight: 2748, clientHeight: 682, scrollTop: 0 }), true);
});

test('the band goes out at the bottom stop', () => {
  assert.equal(fadeShown({ scrollHeight: 2748, clientHeight: 682, scrollTop: 2066 }), false);
  // Sub-pixel scroll positions leave a pixel or two short of the stop.
  assert.equal(fadeShown({ scrollHeight: 2748, clientHeight: 682, scrollTop: 2064.5 }), false);
  assert.equal(fadeShown({ scrollHeight: 2748, clientHeight: 682, scrollTop: 2000 }), true);
});

test('the scroller\'s own bottom padding is not "something below"', () => {
  // The tile grid keeps 4px of padding under its last row; that is no content.
  assert.equal(fadeShown({ scrollHeight: 117, clientHeight: 113, scrollTop: 0, paddingBottom: 4 }), false);
  assert.equal(fadeShown({ scrollHeight: 176, clientHeight: 113, scrollTop: 0, paddingBottom: 4 }), true);
});

test('the band never takes more than a quarter of a short window', () => {
  assert.equal(fadeHeight(682), 60);
  assert.equal(fadeHeight(113), 28); // the two-row tile window keeps its second row readable
});
