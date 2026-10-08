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
  diagramFits,
  MIN_DIAGRAM_HEIGHT,
  hitScrollDelta,
  raffleCover,
  raffleScrollPadding,
  raffleLift,
  tileColumnsFor,
  MAX_COLUMNS,
  RAFFLE_AIR,
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

test('columnsFor grows past the floor once the stage is wide enough for a 16-column deck (the deck at 1597, #71 K-B9)', () => {
  // 16 columns need 16*54 + 15*5 = 939px, the tile part of the 1597 deck.
  assert.equal(columnsFor(939), 16);
});

test('diagramCap gives the leftover, after the two guaranteed tile rows, to the diagram', () => {
  // leftover 313 = 200 for the diagram + 113 for the two rows.
  assert.equal(diagramCap(313), 200);
});

// Below a leftover of 173px, the floor gives the diagram its 60px anyway and
// the grid gets less than the two rows' 113px. The fold (#71) keeps that from
// happening on a real stage: its first height is the Plan's fixed part plus
// exactly these 173px plus the strip (`FIRST_HEIGHT` in fold.mjs), and the
// master-floor sweep in test/ui-fold.test.mjs runs `diagramCap` over it.
test('diagramCap floors at 60px, even when that leaves less than the two tile rows', () => {
  assert.equal(diagramCap(173), 60); // 173 - 113 = 60, the exact boundary
  assert.equal(diagramCap(100), 60); // would go negative without the floor
  assert.equal(diagramCap(0), 60);
});

test('diagramCap accepts a custom floor for a differently-tuned stage', () => {
  assert.equal(diagramCap(100, 40), 40);
  assert.equal(diagramCap(200, 40), 87);
});

/*
 * The diagram's upper bound (#142): the prototype caps it per stage —
 * `stripMax` at proto:3217–3253, "Das Diagramm darf nicht die halbe Fläche
 * nehmen". The bound only ever takes height from the diagram, never from the
 * two rows, and the floor still stands above it.
 */
test('diagramCap stops at an upper bound, and what is left over goes to the tiles', () => {
  assert.equal(diagramCap(600, undefined, 0, 280), 280); // 487 would be left for it
  assert.equal(diagramCap(313, undefined, 0, 280), 200); // under the bound, unchanged
  assert.equal(diagramCap(313, undefined, 0, 96), 96);
});

test('the upper bound never takes the diagram under its floor', () => {
  assert.equal(diagramCap(150, undefined, 0, 96), 60);
});

test('the upper bound does not decide whether the diagram stands', () => {
  // `diagramFits` reads the leftover, not the bounded height.
  assert.equal(diagramFits(600), true);
  assert.equal(diagramFits(172), false);
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
 * The open raffle bar lies over the foot of the `Plan` column, and a
 * ConflictNotice that has to be present (ADR 0002) must not lie under it: the
 * stack — and the chips where they share the bar's corner — rise by the bar's
 * measured height and the air it keeps to the strip (the prototype's
 * `--raffleh`, Runde 16; found at the acceptance by image, #73).
 */
test('the raffle lift is the bar\'s height plus its air, and nothing while the bar is closed', () => {
  assert.equal(raffleLift(119), 119 + RAFFLE_AIR);
  assert.equal(raffleLift(0), 0);
  assert.equal(raffleLift(null), 0);
  assert.equal(RAFFLE_AIR, 8);
});

/**
 * The tile grid stops at sixteen columns at every width, fullscreen included:
 * the prototype caps `.slots` at `--gridmax` (16 tiles) in the page and in
 * `fsContent()` alike, and `fold()` already reports `tileColumns` capped. The
 * grid itself took `columnsFor()` uncapped and showed 21 columns in
 * fullscreen at 1280 and 26 at 1597 (#73).
 */
test('tileColumnsFor keeps the master floor and the sixteen-column deck', () => {
  assert.equal(tileColumnsFor(200), 6);
  assert.equal(tileColumnsFor(10 * 59 - 5), 10);
  assert.equal(tileColumnsFor(1597 - 16), MAX_COLUMNS);
  assert.equal(tileColumnsFor(1264), MAX_COLUMNS);
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

/* ── The diagram yields to the open raffle bar (#73, run 14, K1) ─────────── */

/**
 * The numbers are the ones measured at the acceptance by image, 674 × 760
 * (protocol A3): tile window 541–654, the bar from 585 (closed list) and from
 * 514 after the first throw. Measured, not derived — the test only states that
 * the cover is what the bar takes off the window down to its top edge.
 */
test('the bar covers the window from its top edge less the clearance down, and nothing above it', () => {
  const window = { top: 541, bottom: 654 };
  assert.equal(raffleCover(window, { top: 585 }), 654 - (585 - RAFFLE_CLEARANCE));
  assert.equal(raffleCover(window, { top: 514 }), 654 - (514 - RAFFLE_CLEARANCE));
  // The master: the rail lies under the bar, the window ends at 629, the bar starts at 647.
  assert.equal(raffleCover({ top: 516, bottom: 629 }, { top: 647 }), 0);
  assert.equal(raffleCover(window, null), 0);
});

test('the diagram pays for the cover, so two full rows stand above the bar', () => {
  const leftover = 600;
  const covered = 79;
  const diagram = diagramCap(leftover, undefined, covered);
  assert.equal(diagram, leftover - rowsHeight(MIN_ROWS) - covered);
  // What is left of the window above the bar is exactly the two rows.
  assert.equal(leftover - diagram - covered, rowsHeight(MIN_ROWS));
  assert.equal(diagramCap(leftover, undefined, 0), diagramCap(leftover));
});

test('the diagram never yields under its floor — where that is not enough, it goes away instead (#129)', () => {
  // 812 × 375 at the acceptance: diagram 86 over two rows, the bar 119 high.
  const leftover = 86 + rowsHeight(MIN_ROWS);
  assert.equal(diagramCap(leftover, undefined, 79), 60);
  assert.equal(diagramFits(leftover, 79), false);
});

/*
 * "Enough room" (#129, run 15, K3/K4 — the maintainer delegated what it means):
 * the diagram stands where, after the two tile rows and the open bar's measured
 * cover, its 60 px floor is still left. Under that it is gone, not clamped.
 * Both sides of the edge, to the tenth of a pixel the browser measures in.
 */
test('the diagram stands exactly where two rows and the cover leave its floor, and is gone a tenth below', () => {
  const edge = rowsHeight(MIN_ROWS) + MIN_DIAGRAM_HEIGHT; // 173
  assert.equal(diagramFits(edge), true);
  assert.equal(diagramFits(edge - 0.1), false);
  assert.equal(diagramFits(edge + 79, 79), true);
  assert.equal(diagramFits(edge + 79, 79.1), false);
  // Where it stands, it gets what diagramCap gives, never less than the floor.
  assert.equal(diagramCap(edge + 79, undefined, 79), MIN_DIAGRAM_HEIGHT);
});

test('a closed bar covers nothing, so the rule is the first height’s own floor', () => {
  // 812 × 375 closed: diagram 86.1 over two rows, so it stands.
  assert.equal(diagramFits(86.1 + rowsHeight(MIN_ROWS)), true);
  // A flat stage too low for two rows and 60 — the diagram gives way to the tiles.
  assert.equal(diagramFits(59 + rowsHeight(MIN_ROWS)), false);
});

