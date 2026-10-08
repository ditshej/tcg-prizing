import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DECK,
  FIRST_HEIGHT,
  FIRST_WIDTH,
  FOOT_HEIGHT,
  PLAN_FLOOR,
  PLAN_PADDING,
  RAIL_AT_MASTER,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  TWO_COLUMNS,
  THREE_COLUMNS,
  firstHeightOneColumn,
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

/**
 * The decided values, looked up rather than derived (#71, run 13, K-B9): the
 * first widths 388 · 286 · 356, and AC 2 as it reads now — 673 shows one
 * column, 674 two, 1029 two, 1030 three.
 */
test('at the decided first widths the breakpoints are 674 and 1030 (#71, K-B9)', () => {
  assert.deepEqual(FIRST_WIDTH, { plan: 388, details: 286, prepare: 356 });
  assert.equal(TWO_COLUMNS, 674);
  assert.equal(THREE_COLUMNS, 1030);
  assert.equal(fold({ width: 673, height: TALL }).columns, 1);
  assert.equal(fold({ width: 674, height: TALL }).columns, 2);
  assert.equal(fold({ width: 1029, height: TALL }).columns, 2);
  assert.equal(fold({ width: 1030, height: TALL }).columns, 3);
});

/**
 * The breakpoints and the deck are held as **sums**, in the source (#71,
 * B17). The value tests above cannot tell `TWO_COLUMNS = 674` from the sum
 * that comes to 674; only the text can. So the right-hand side of each of
 * these must name its terms and carry no number of its own.
 */
test('the breakpoints, the deck and the first heights are written as sums, not literals', () => {
  const source = readFileSync(new URL('../public/ui/fold.mjs', import.meta.url), 'utf8');
  for (const name of ['TWO_COLUMNS', 'THREE_COLUMNS', 'DECK', 'PLAN_FLOOR', 'FIRST_HEIGHT']) {
    const match = source.match(new RegExp(`export const ${name}\\s*=\\s*([^;]+);`));
    assert.ok(match, `${name} is still defined in fold.mjs`);
    assert.doesNotMatch(match[1], /\d/, `${name} = ${match[1].trim()} carries a literal`);
  }
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
  assert.equal(fold({ width: 900, height: TALL }).planWidth, 900 - 286);
  assert.equal(fold({ width: 1280, height: TALL }).planWidth, 1280 - 286 - 356);
  assert.equal(fold({ width: 500, height: TALL }).planWidth, 500);
});

/** The deck is 939 + 16 + 286 + 356 = 1597 (#71, K-B9): 16 tile columns there, 15 a pixel under. */
test('at the deck 1597 the Plan has its 16 tile columns, and it grows no further', () => {
  assert.equal(DECK, 1597);
  assert.equal(fold({ width: 1596, height: TALL }).tileColumns, 15);
  assert.equal(fold({ width: 1597, height: TALL }).tileColumns, 16);
  const wider = fold({ width: 2400, height: TALL });
  assert.equal(wider.tileColumns, 16);
  assert.equal(wider.planWidth, DECK - 286 - 356);
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
 * The decided sum of the first height (#71, run 13, K-B8), written out here
 * on purpose rather than imported: 178 fixed part without the diagram, 60 the
 * diagram's floor, 113 two tile rows (2 × 54 + 5), 48 the strip. A test that
 * measured with fold.mjs's own `PLAN_FIXED` would go green with any value it
 * held (B16) — a wrong number and its own justification arrive together.
 */
const DECIDED = Object.freeze({ fixed: 178, diagramFloor: 60, twoRows: 113, strip: 48 });

/**
 * **The number trap of #40/#71:** the fixed part is the one *without* the
 * bar, and the bar enters as its floor — whoever drops the floor term is back
 * at #40's 158-based 337 and loses the second tile row.
 */
test('the first height of the Plan is 399, the floor 351 (#71, K-B8)', () => {
  assert.equal(DECIDED.fixed + DECIDED.diagramFloor + DECIDED.twoRows, 351);
  assert.equal(PLAN_FLOOR, 351);
  assert.equal(FIRST_HEIGHT, 399);
  assert.equal(MIN_DIAGRAM_HEIGHT, DECIDED.diagramFloor);
  assert.equal(2 * TILE_SIZE + TILE_GAP, DECIDED.twoRows);
  assert.equal(STRIP_HEIGHT, DECIDED.strip);
  assert.equal(FIRST_HEIGHT, PLAN_FLOOR + STRIP_HEIGHT);
});

test('398 is flat, 399 is not — at two and three columns (#71, K-B8)', () => {
  for (const width of [900, 1280]) {
    assert.equal(fold({ width, height: 398 }).flat, true, `${width} × 398`);
    assert.equal(fold({ width, height: 399 }).flat, false, `${width} × 399`);
  }
});

/**
 * K2 of run 14 at #73 (`schiene-gemessen`): the one-column threshold is the
 * floor, the foot and the rail **as measured** — no fixed 494. The rail
 * heights below are the ones measured at the acceptance by image (2026-10-02,
 * Chromium): 87 at the master and at 600, 101 at 360/540, 115 at 500, 117 at
 * 320. Each must move the threshold by itself.
 */
const MEASURED_RAIL = Object.freeze({ 320: 117, 360: 101, 393: 87, 500: 115, 540: 101, 600: 87 });

test('the one-column threshold is the floor, the foot and the measured rail — no fixed number (#73, K2)', () => {
  assert.equal(firstHeightOneColumn(87), PLAN_FLOOR + FOOT_HEIGHT + 87);
  for (const [w, rail] of Object.entries(MEASURED_RAIL)) {
    const width = Number(w);
    const threshold = DECIDED.fixed + DECIDED.diagramFloor + DECIDED.twoRows + FOOT_HEIGHT + rail;
    const under = fold({ width, height: threshold - 1, railHeight: rail });
    const at = fold({ width, height: threshold, railHeight: rail });
    assert.equal(at.flat || at.cramped, false, `${width} × ${threshold} stands as the master`);
    assert.equal(at.rail, 'bar');
    assert.equal(at.planHeight, PLAN_FLOOR, `${width} × ${threshold}: exactly the floor above foot and rail`);
    assert.equal(under.flat || under.cramped, true, `${width} × ${threshold - 1} is flat or cramped`);
  }
  // 500 wide and 500 high: under the old 494 the master, with its measured rail of 115 flat.
  assert.equal(fold({ width: 500, height: 500, railHeight: 115 }).flat, true);
});

test('until the first reading the fold reckons with the rail measured at the master', () => {
  assert.equal(RAIL_AT_MASTER, 124);
  assert.deepEqual(fold({ width: 600, height: 500 }), fold({ width: 600, height: 500, railHeight: RAIL_AT_MASTER }));
});

/**
 * K4 of run 14 at #73 (`seite-scrollt`): under 436 wide and under the
 * one-column threshold the stage is **cramped** — not flat, the master with
 * its foot, and the `Plan` keeps its floor while the page scrolls.
 */
test('under 436 and under the threshold the stage is cramped: the Plan keeps its floor and the page scrolls (#73, K4)', () => {
  const f = fold({ width: 360, height: 300, railHeight: 101 });
  assert.equal(f.flat, false);
  assert.equal(f.cramped, true);
  assert.equal(f.rail, 'bar');
  assert.equal(f.planHeight, PLAN_FLOOR);
  assert.equal(fold({ width: 436, height: 300 }).cramped, false, '436 turns flat instead');
  assert.equal(fold({ width: 360, height: 300, fullscreen: true }).cramped, false, 'fullscreen has no rail and no foot');
  assert.equal(fold({ width: 393, height: 830 }).cramped, false);
  const props = foldProperties(f);
  assert.equal(props['--diagram-floor'], `${DECIDED.diagramFloor}px`);
  assert.equal(props['--two-rows'], `${DECIDED.twoRows}px`);
});

test('the stage folds flat from 436 wide: 435 keeps the master, 436 turns the strip (#71, K-B10b)', () => {
  const narrow = fold({ width: 435, height: 375 });
  assert.equal(narrow.flat, false);
  assert.equal(narrow.stripBottom, FOOT_HEIGHT);
  const flat = fold({ width: 436, height: 375 });
  assert.equal(flat.flat, true);
  assert.equal(flat.stripWidth, STRIP_WIDTH);
});

test('the hot column beside the flat Plan opens at 722, not at 721 (#71, K-B10c)', () => {
  const without = fold({ width: 721, height: 375 });
  assert.equal(without.flat, true);
  assert.equal(without.rail, 'none');
  const beside = fold({ width: 722, height: 375 });
  assert.equal(beside.rail, 'column');
  assert.equal(beside.planWidth, FIRST_WIDTH.plan);
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
  const diagram = diagramCap(f.planHeight - DECIDED.fixed);
  assert.ok(f.planHeight - DECIDED.fixed - diagram >= DECIDED.twoRows);
});

/**
 * The master is the floor (#61, CONTEXT.md `DistributionPlan`): over a sweep
 * of stage sizes, the tile window never holds fewer than six tile columns and
 * two tile rows — counted as a real fit, not through `columnsFor()`, whose
 * floor is raised by construction and could not break. The tile window is
 * measured with the **decided** fixed part (178, `DECIDED`), not with
 * fold.mjs's `PLAN_FIXED`, so a drift there turns this red (B16).
 *
 * The sweep starts where the floor can hold at all: a stage narrower than six
 * tiles plus the column's padding, or lower than the Plan's fixed part plus
 * the diagram floor and two rows, cannot show the master in any fold. A stage
 * too narrow to turn the strip aside and too low for the one-column form is in
 * the sweep since K4 of run 14: it is cramped, the `Plan` keeps its floor and
 * the page scrolls (#73). The sweep runs at every rail height measured (K2),
 * because the threshold moves with it: `RAILS_MEASURED` below.
 */
/*
 * The rail heights the acceptance by image measured after round 142·145, K2
 * (2026-10-08, headless Chrome, `.plan-controls`, every width 320–673 in
 * `plain`, Weekend, Release and Weekly at `depth=32`): 124 from 360 up, 139
 * where `Served ranks` wraps its title at 360–361 and 540–542 (`depth=32`),
 * 195 / 212 / 229 below 360. `docs/acceptance/73-abnahme-am-bild.md` › run 17.
 */
const RAILS_MEASURED = Object.freeze([124, 139, 195, 212, 229]);

test('the master is the floor: never fewer than six tile columns and two tile rows', () => {
  const minWidth = 6 * TILE_SIZE + 5 * TILE_GAP + PLAN_PADDING;
  const failures = [];
  for (let width = minWidth; width <= 2000; width += 3) {
    const lowest = DECIDED.fixed + DECIDED.diagramFloor + DECIDED.twoRows;
    for (let height = lowest; height <= 1400; height += 5) for (const railHeight of RAILS_MEASURED) {
      const f = fold({ width, height, railHeight });
      const columns = columnsFitting(f.planWidth - PLAN_PADDING);
      const window = f.planHeight - DECIDED.fixed - diagramCap(f.planHeight - DECIDED.fixed);
      const rows = Math.floor((window + TILE_GAP) / (TILE_SIZE + TILE_GAP));
      if (columns < 6 || rows < 2) failures.push(`${width}×${height} (rail ${railHeight}): ${columns} columns, ${rows} rows`);
    }
  }
  assert.deepEqual(failures.slice(0, 5), []);
});

/*
 * The diagram's upper bound per stage (#142), the prototype's numbers looked
 * up and not re-derived: `stripMax` at proto:3217–3253 —
 * flat 60–96, 96 under 460 height, 190 with two columns or more, 280 with
 * one. The floor (60) is the fold's business and stays where it is.
 */
const PROTO_STRIP_MAX = Object.freeze({ flat: 96, low: 96, columns: 190, oneColumn: 280 });

test('the diagram has the prototype\'s upper bound on each stage (#142)', () => {
  assert.equal(fold({ width: 812, height: 375 }).diagramMax, PROTO_STRIP_MAX.flat);
  assert.equal(fold({ width: 600, height: 380 }).diagramMax, PROTO_STRIP_MAX.flat);
  assert.equal(fold({ width: 900, height: 450 }).diagramMax, PROTO_STRIP_MAX.low);
  assert.equal(fold({ width: 900, height: 459 }).diagramMax, PROTO_STRIP_MAX.low);
  assert.equal(fold({ width: 900, height: 460 }).diagramMax, PROTO_STRIP_MAX.columns);
  assert.equal(fold({ width: 900, height: 700 }).diagramMax, PROTO_STRIP_MAX.columns);
  assert.equal(fold({ width: 1280, height: 760 }).diagramMax, PROTO_STRIP_MAX.columns);
  assert.equal(fold({ width: 393, height: 830 }).diagramMax, PROTO_STRIP_MAX.oneColumn);
  assert.equal(fold({ width: TWO_COLUMNS - 1, height: 830 }).diagramMax, PROTO_STRIP_MAX.oneColumn);
});

test('the upper bound reaches the CSS as --diagram-max', () => {
  assert.equal(foldProperties(fold({ width: 393, height: 830 }))['--diagram-max'], '280px');
  assert.equal(foldProperties(fold({ width: 812, height: 375 }))['--diagram-max'], '96px');
});

test('with the upper bound the master is still the floor: six columns, two rows (#61)', () => {
  const minWidth = 6 * TILE_SIZE + 5 * TILE_GAP + PLAN_PADDING;
  const failures = [];
  for (let width = minWidth; width <= 2000; width += 7) {
    const lowest = DECIDED.fixed + DECIDED.diagramFloor + DECIDED.twoRows;
    for (let height = lowest; height <= 1400; height += 7) for (const railHeight of RAILS_MEASURED) {
      const f = fold({ width, height, railHeight });
      const leftover = f.planHeight - DECIDED.fixed;
      const window = leftover - diagramCap(leftover, undefined, 0, f.diagramMax);
      const rows = Math.floor((window + TILE_GAP) / (TILE_SIZE + TILE_GAP));
      if (rows < 2) failures.push(`${width}×${height} (rail ${railHeight}): ${rows} rows`);
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
  assert.deepEqual(insets(900, 700), [0, 286]);
  assert.deepEqual(insets(1280, 760), [356, 286]);
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
  for (const w of [674, 1030, 1597]) {
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

/**
 * The open raffle bar is a surface over the `Plan` column, so the corner under
 * it is no longer free: where the chips stand in the `Plan`'s corner — one row
 * above the foot, beside the turned strip, at the fullscreen's bottom edge —
 * they rise above the bar; in the strip they lie under the bar and stay put.
 * The prototype's `#badges` rule, `bottom: calc(var(--foot) + var(--raffleh))`
 * (Runde 16, Runde 21); found at the acceptance by image (#73).
 */
test('the chips rise above an open raffle bar exactly where they sit in the Plan\'s corner', () => {
  const props = (w, h, fs = false) => foldProperties(fold({ width: w, height: h, fullscreen: fs }));
  assert.equal(props(393, 830)['--chip-raffle'], '1');
  assert.equal(props(812, 375)['--chip-raffle'], '1');
  assert.equal(props(1280, 760, true)['--chip-raffle'], '1');
  assert.equal(props(393, 830, true)['--chip-raffle'], '1');
  for (const w of [674, 1030, 1597]) assert.equal(props(w, 800)['--chip-raffle'], '0', `strip at ${w}`);
});
