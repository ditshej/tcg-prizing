import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE_SIZE, TILE_GAP, MIN_COLUMNS, MIN_ROWS, rowsHeight, columnsFor, diagramCap } from '../public/ui/geometry.mjs';

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

test('diagramCap never cuts into the second tile row: it floors at 60px', () => {
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
