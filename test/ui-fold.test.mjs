import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DECK,
  FIRST_HEIGHT,
  FIRST_HEIGHT_ONE_COLUMN,
  FIRST_WIDTH,
  FOOT_HEIGHT,
  PLAN_FIXED,
  PLAN_FLOOR,
  PLAN_PADDING,
  RAIL_HEIGHT,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  TWO_COLUMNS,
  THREE_COLUMNS,
  fold,
  foldPage,
  foldProperties,
  pageShown,
} from '../public/ui/fold.mjs';
import { MIN_DIAGRAM_HEIGHT, TILE_GAP, TILE_SIZE, columnsFitting, diagramCap } from '../public/ui/geometry.mjs';

/* A stage tall enough that the height axis never folds — the width axis alone. */
const TALL = 900;

/**
 * The breakpoints are **sums of first widths**, checked as sums and not as
 * literals (#61, Testing Decisions): if a first width tips, this test tips, and
 * not the screen.
 */
test('the two breakpoints are the sums of the first widths', () => {
  assert.equal(TWO_COLUMNS, FIRST_WIDTH.plan + FIRST_WIDTH.details);
  assert.equal(THREE_COLUMNS, FIRST_WIDTH.plan + FIRST_WIDTH.details + FIRST_WIDTH.prepare);
});

test('one pixel under a breakpoint folds, the breakpoint itself opens', () => {
  assert.equal(fold({ width: TWO_COLUMNS - 1, height: TALL }).columns, 1);
  assert.equal(fold({ width: TWO_COLUMNS, height: TALL }).columns, 2);
  assert.equal(fold({ width: THREE_COLUMNS - 1, height: TALL }).columns, 2);
  assert.equal(fold({ width: THREE_COLUMNS, height: TALL }).columns, 3);
});

test('at the decided first widths the breakpoints are 740 and 1096 (#71 body)', () => {
  assert.deepEqual(FIRST_WIDTH, { plan: 388, details: 352, prepare: 356 });
  assert.equal(fold({ width: 739, height: TALL }).columns, 1);
  assert.equal(fold({ width: 740, height: TALL }).columns, 2);
  assert.equal(fold({ width: 1095, height: TALL }).columns, 2);
  assert.equal(fold({ width: 1096, height: TALL }).columns, 3);
});

/**
 * The rule itself, as a property over a sweep of widths: whichever columns
 * stand, none of them is ever narrower than its first width.
 */
test('no column ever falls below its first width, at any width', () => {
  for (let width = TWO_COLUMNS; width <= 2400; width += 1) {
    const f = fold({ width, height: TALL });
    assert.ok(f.planWidth >= FIRST_WIDTH.plan, `Plan at ${width}: ${f.planWidth}`);
    if (f.columns >= 2) assert.equal(f.detailsWidth, FIRST_WIDTH.details);
    if (f.columns === 3) assert.equal(f.prepareWidth, FIRST_WIDTH.prepare);
  }
});

test('everything between the breakpoints goes to the Plan', () => {
  assert.equal(fold({ width: 900, height: TALL }).planWidth, 900 - 352);
  assert.equal(fold({ width: 1280, height: TALL }).planWidth, 1280 - 352 - 356);
  assert.equal(fold({ width: 500, height: TALL }).planWidth, 500);
});

test('at the deck 1674 the Plan has its 16 tile columns, and it grows no further', () => {
  assert.equal(fold({ width: 1674, height: TALL }).tileColumns, 16);
  assert.ok(DECK <= 1674, `deck ${DECK}`);
  const wider = fold({ width: 2400, height: TALL });
  assert.equal(wider.tileColumns, 16);
  assert.equal(wider.planWidth, DECK - 352 - 356);
});

/* ── Which pages stand, and which one is in front ────────────────────────── */

const at = (width, height = TALL, fullscreen = false) => fold({ width, height, fullscreen });
const shown = (f, active) => ['prepare', 'plan', 'details'].filter((p) => pageShown(f, active, p));

test('with one column only the active page stands', () => {
  assert.deepEqual(shown(at(500), 'details'), ['details']);
  assert.deepEqual(shown(at(500), 'prepare'), ['prepare']);
});

test('at two columns Prepare takes the Plan\'s place, not the screen\'s — Details stays', () => {
  assert.deepEqual(shown(at(900), 'plan'), ['plan', 'details']);
  assert.deepEqual(shown(at(900), 'prepare'), ['prepare', 'details']);
});

test('at three columns all three stand', () => {
  assert.deepEqual(shown(at(1280), 'plan'), ['prepare', 'plan', 'details']);
});

test('fullscreen is the fold the other way: the Plan alone, at every width', () => {
  for (const w of [393, 900, 1280]) assert.deepEqual(shown(at(w, TALL, true), 'plan'), ['plan']);
});

test('a page that stands as a column is no longer the active page', () => {
  assert.equal(foldPage(at(900), 'details'), 'plan');
  assert.equal(foldPage(at(900), 'prepare'), 'prepare');
  assert.equal(foldPage(at(1280), 'prepare'), 'plan');
  assert.equal(foldPage(at(500), 'details'), 'details');
});

/* ── The height axis ─────────────────────────────────────────────────────── */

/**
 * The first height is a sum like the breakpoints: the fixed part, the
 * diagram's floor, two tile rows (2 × 54 + 5) and the strip. **The number
 * trap of #40/#71:** the fixed part here is the one *without* the bar, and the
 * bar enters as its floor — whoever drops the floor term is back at #40's
 * 158-based 337 and loses the second tile row.
 */
test('the first height of the Plan is fixed part + diagram floor + two tile rows + strip', () => {
  assert.equal(PLAN_FLOOR, PLAN_FIXED + MIN_DIAGRAM_HEIGHT + 2 * TILE_SIZE + TILE_GAP);
  assert.equal(FIRST_HEIGHT, PLAN_FLOOR + STRIP_HEIGHT);
  assert.equal(FIRST_HEIGHT_ONE_COLUMN, PLAN_FLOOR + FOOT_HEIGHT + RAIL_HEIGHT);
});

test('one pixel under the first height the stage is flat: one page, nothing side by side', () => {
  const low = fold({ width: 1280, height: FIRST_HEIGHT - 1 });
  assert.equal(low.flat, true);
  assert.equal(low.columns, 1);
  const enough = fold({ width: 1280, height: FIRST_HEIGHT });
  assert.equal(enough.flat, false);
  assert.equal(enough.columns, 3);
});

test('812 × 375, the phone across, is flat — and the strip turns to the right edge', () => {
  const f = fold({ width: 812, height: 375 });
  assert.equal(f.flat, true);
  assert.equal(f.stripBottom, 0);
  assert.equal(f.stripWidth, STRIP_WIDTH);
  assert.equal(f.planRight, STRIP_WIDTH);
});

test('on the flat stage the strip takes room rather than lying on top', () => {
  const f = fold({ width: 812, height: 375 });
  assert.equal(f.planWidth + f.planRight + FIRST_WIDTH.details, 812); // hot column beside the plan
  assert.equal(f.rail, 'column');
});

test('flat and too narrow for the hot column, the Plan page keeps the tiles and drops the rail', () => {
  const f = fold({ width: 667, height: 375 });
  assert.equal(f.flat, true);
  assert.equal(f.rail, 'none');
  assert.equal(f.planWidth, 667 - STRIP_WIDTH);
});

test('in the flat mode two full tile rows are visible, not cut', () => {
  const f = fold({ width: 812, height: 375 });
  const diagram = diagramCap(f.planHeight - PLAN_FIXED);
  assert.ok(f.planHeight - PLAN_FIXED - diagram >= 2 * TILE_SIZE + TILE_GAP);
});

/**
 * The master is the floor (#61, CONTEXT.md `DistributionPlan`): over a sweep
 * of stage sizes, the tile window never holds fewer than six tile columns and
 * two tile rows — counted as a real fit, not through `columnsFor()`, whose
 * floor is raised by construction and could not break.
 *
 * The sweep starts where the floor can hold at all: a stage narrower than six
 * tiles plus the column's padding, or lower than the Plan's fixed part plus
 * the diagram floor and two rows, cannot show the master in any fold. Nor can
 * a stage too narrow to turn the strip aside (the Plan's first width plus the
 * strip) and too low for the one-column form with its foot and rail — a
 * portrait screen under 436 px wide and under that first height, which no
 * phone is.
 */
test('the master is the floor: never fewer than six tile columns and two tile rows', () => {
  const minWidth = 6 * TILE_SIZE + 5 * TILE_GAP + PLAN_PADDING;
  const failures = [];
  for (let width = minWidth; width <= 2000; width += 3) {
    const lowest = width < FIRST_WIDTH.plan + STRIP_WIDTH ? FIRST_HEIGHT_ONE_COLUMN : PLAN_FLOOR;
    for (let height = lowest; height <= 1400; height += 5) {
      const f = fold({ width, height });
      const columns = columnsFitting(f.planWidth - PLAN_PADDING);
      const window = f.planHeight - PLAN_FIXED - diagramCap(f.planHeight - PLAN_FIXED);
      const rows = Math.floor((window + TILE_GAP) / (TILE_SIZE + TILE_GAP));
      if (columns < 6 || rows < 2) failures.push(`${width}×${height}: ${columns} columns, ${rows} rows`);
    }
  }
  assert.deepEqual(failures.slice(0, 5), []);
});

/* ── The two insets ──────────────────────────────────────────────────────── */

test('where the Plan stops on either side: phone, two columns, three columns, flat, fullscreen', () => {
  const insets = (w, h, fs = false) => {
    const f = fold({ width: w, height: h, fullscreen: fs });
    return [f.planLeft, f.planRight];
  };
  assert.deepEqual(insets(393, 830), [0, 0]);
  assert.deepEqual(insets(900, 700), [0, 352]);
  assert.deepEqual(insets(1280, 760), [356, 352]);
  assert.deepEqual(insets(812, 375), [0, 48]);
  for (const [w, h] of [[393, 830], [900, 700], [1280, 760], [812, 375]]) {
    assert.deepEqual(insets(w, h, true), [0, 0], `fullscreen at ${w}×${h}`);
  }
});

test('the chip sits in the lowest free corner on the right', () => {
  const props = (w, h, fs = false) => foldProperties(fold({ width: w, height: h, fullscreen: fs }));
  // Phone: one row above the 56px foot, and the open stack lifts above it.
  assert.equal(props(393, 830)['--chip-bottom'], '64px');
  assert.equal(props(393, 830)['--chip-lift'], '42px');
  assert.equal(props(393, 830)['--chip-right'], '0px');
  // From the breakpoint on: inside the 48px strip, centred, no lift.
  for (const w of [740, 1096, 1674]) {
    assert.equal(props(w, 800)['--chip-bottom'], '7px');
    assert.equal(props(w, 800)['--chip-lift'], '0px');
    assert.equal(props(w, 800)['--strip-bottom'], '48px');
  }
  // Flat: beside the turned strip, not in it.
  assert.equal(props(812, 375)['--chip-right'], '48px');
  // Fullscreen: no foot at any width, the bottom edge.
  assert.equal(props(1280, 760, true)['--strip-bottom'], '0px');
  assert.equal(props(1280, 760, true)['--chip-bottom'], '8px');
});
