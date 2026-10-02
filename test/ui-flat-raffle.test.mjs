import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { planApp } from '../public/ui/plan.mjs';

/**
 * The flat stage with the raffle bar open (#129). Two decisions of the
 * maintainer, both only for the flat stage — `fold().flat`, never a width:
 *
 * 1. The diagram goes away entirely while the bar is open, and comes back
 *    when the bar closes. The tiles come first.
 * 2. The bar does not grow with the retraction list: the list pages inside
 *    the bar. An exception to #69's "grows with the retraction list".
 *
 * Everywhere not flat, K1 of run 14 (#73) holds unchanged: the diagram yields
 * by the measured overlap, never under 60, and the bar grows.
 */

/** Weekly with 16 winner packs, so seven are open to throw (Weekly's own leaves one). */
function app() {
  const query = `?v=1&g=${GAME.id}&t=${TOURNAMENT_TYPES[0].id}&winnerPacks=16`;
  return planApp({ read: () => query, write: () => {} });
}

/** The canvases the trap names, each with the fold's own verdict on it. */
const STAGES = [
  { width: 812, height: 375, flat: true },
  { width: 600, height: 450, flat: true },
  { width: 500, height: 900, flat: false },
  { width: 420, height: 380, flat: false }, // cramped (#73, K4), not flat
  { width: 393, height: 830, flat: false },
];

test('the canvases are what the fold says they are, read off fold().flat', () => {
  for (const stage of STAGES) {
    const it = app();
    it.setStage(stage);
    assert.equal(it.fold.flat, stage.flat, `${stage.width} × ${stage.height}`);
  }
});

test('flat with the bar open the diagram is gone, and it is back once the bar closes', () => {
  const it = app();
  it.setStage({ width: 812, height: 375 });
  assert.equal(it.diagramShown, true, 'closed bar: the diagram stands');
  it.toggleRaffle();
  assert.equal(it.diagramShown, false, 'open bar: the diagram is gone');
  it.closeRaffle();
  assert.equal(it.diagramShown, true, 'closed again: the diagram is back');
});

test('not flat, the open bar leaves the diagram standing (K1 holds: it yields, never under 60)', () => {
  for (const stage of STAGES.filter((s) => !s.flat)) {
    const it = app();
    it.setStage(stage);
    it.toggleRaffle();
    assert.equal(it.diagramShown, true, `${stage.width} × ${stage.height}`);
  }
});

test('the exception follows the fold across the flat boundaries, on both sides', () => {
  // 435/436 at a low height; the one-column threshold 351 + 56 + rail at
  // 600 wide (rail 87: 494) and at 500 wide (rail 115: 522, run 14's
  // measurement); 398/399 at 674, the first height of the column form; and
  // 673/674 at 399, where the narrower side folds by the one-column threshold
  // and is flat while the wider one opens two columns.
  const pairs = [
    [{ width: 435, height: 380 }, { width: 436, height: 380 }],
    [{ width: 600, height: 494 }, { width: 600, height: 493 }],
    [{ width: 500, height: 522, railHeight: 115 }, { width: 500, height: 521, railHeight: 115 }],
    [{ width: 674, height: 399 }, { width: 674, height: 398 }],
    [{ width: 674, height: 399 }, { width: 673, height: 399, railHeight: 62 }],
  ];
  for (const [notFlat, flat] of pairs) {
    for (const [stage, expected] of [[notFlat, true], [flat, false]]) {
      const it = app();
      it.setStage(stage);
      it.toggleRaffle();
      assert.equal(it.fold.flat, !expected, `fold at ${stage.width} × ${stage.height}`);
      assert.equal(it.diagramShown, expected, `diagram at ${stage.width} × ${stage.height}`);
    }
  }
});

test('in fullscreen the diagram is gone either way, as before (#63)', () => {
  const it = app();
  it.setStage({ width: 900, height: 700 });
  it.openFullscreen();
  assert.equal(it.diagramShown, false);
});

test('the diagram in the markup stands on diagramShown, not on a width or a media query', () => {
  const plan = readFileSync(new URL('../views/plan.php', import.meta.url), 'utf8');
  const diagram = plan.slice(plan.indexOf('<div class="plan-diagram"'));
  assert.match(diagram.slice(0, diagram.indexOf('>')), /x-show="diagramShown"/);
});

/* ── The retraction list pages inside the bar, flat only (#129, 2) ─────── */

import { takeBackPages } from '../public/ui/raffle.mjs';

test('a page is as many chips as one row of the measured width holds, in rank order', () => {
  // Chips of 60, 60, 70, 60 px, 4 px apart, in a row 200 wide: 60+4+60+4+70 = 198 fits, the fourth does not.
  assert.deepEqual(takeBackPages([60, 60, 70, 60], 200, 4), [[0, 3], [3, 4]]);
});

test('a list that fits one row is one page, and an empty list has none', () => {
  assert.deepEqual(takeBackPages([60, 60], 200, 4), [[0, 2]]);
  assert.deepEqual(takeBackPages([], 200, 4), []);
});

test('a chip wider than the row still gets a page of its own, so no rank goes missing', () => {
  assert.deepEqual(takeBackPages([60, 250, 60], 200, 4), [[0, 1], [1, 2], [2, 3]]);
});

test('the pages cover every chip once, in order, with no gap and no overlap', () => {
  const widths = [61, 58, 72, 66, 59, 80, 61, 64, 70, 58, 63];
  const pages = takeBackPages(widths, 230, 4);
  assert.equal(pages[0][0], 0);
  assert.equal(pages.at(-1)[1], widths.length);
  for (let i = 1; i < pages.length; i++) assert.equal(pages[i][0], pages[i - 1][1]);
  for (const [from, to] of pages) {
    const row = widths.slice(from, to);
    assert.ok(row.length === 1 || row.reduce((a, b) => a + b, 0) + 4 * (row.length - 1) <= 230);
  }
});

/** A component with a die that walks the pot from its top, so throws are known. */
function thrower(stage) {
  const it = app();
  it.setStage(stage);
  let at = 0;
  it._roll = () => [0, 0, 0, 0, 0, 0][at++] ?? 0;
  it.toggleRaffle();
  return it;
}

/** Every chip 60 wide, 4 apart, in a row that holds two of them. */
const twoPerRow = (n) => ({ widths: Array(n).fill(60), rowWidth: 130, gap: 4 });

test('flat, the list pages: only the chips of the current page stand', () => {
  const it = thrower({ width: 812, height: 375 });
  for (let i = 0; i < 3; i++) it.throwRaffle();
  assert.equal(it.raffle.takeBack.length, 3);
  it.applyTakeBackMeasure(twoPerRow(3));
  assert.equal(it.takeBackPageCount, 2);
  assert.deepEqual(it.takeBackShown.map((e) => e.rank), it.raffle.takeBack.slice(it.takeBackRange[0], it.takeBackRange[1]).map((e) => e.rank));
  assert.equal(it.takeBackShown.length < it.raffle.takeBack.length, true);
});

test('flat, the page steps forward and back and stops at both ends', () => {
  const it = thrower({ width: 812, height: 375 });
  for (let i = 0; i < 5; i++) it.throwRaffle();
  it.applyTakeBackMeasure(twoPerRow(5));
  assert.equal(it.takeBackPageCount, 3);
  it.takeBackPage = 0;
  it.pageTakeBack(-1);
  assert.equal(it.takeBackPage, 0);
  it.pageTakeBack(1);
  it.pageTakeBack(1);
  it.pageTakeBack(1);
  assert.equal(it.takeBackPage, 2);
  assert.equal(it.takeBackShown.length, 1);
});

test('flat, a throw turns to the page that holds its hit, so the list shows what was just drawn', () => {
  const it = thrower({ width: 812, height: 375 });
  for (let i = 0; i < 4; i++) it.throwRaffle();
  it.applyTakeBackMeasure(twoPerRow(4));
  const hit = it.lastDraw;
  assert.ok(it.takeBackShown.some((e) => e.rank === hit), `rank ${hit} on the page shown`);
  // Paging away by hand is not undone by the next measuring pass (a resize, say).
  const away = it.takeBackPage === 0 ? 1 : -1;
  it.pageTakeBack(away);
  const page = it.takeBackPage;
  it.applyTakeBackMeasure(twoPerRow(4));
  assert.equal(it.takeBackPage, page);
});

test('flat, taking back the last chip of the last page falls back to the page before', () => {
  const it = thrower({ width: 812, height: 375 });
  for (let i = 0; i < 3; i++) it.throwRaffle();
  it.applyTakeBackMeasure(twoPerRow(3));
  it.takeBackPage = 1;
  it.takeBackWinner(it.takeBackShown[0].rank);
  it.applyTakeBackMeasure(twoPerRow(2));
  assert.equal(it.takeBackPageCount, 1);
  assert.equal(it.takeBackPage, 0);
  assert.equal(it.takeBackShown.length, 2);
});

test('not flat, the list does not page: every chip stands and the bar grows with it (#69)', () => {
  for (const stage of STAGES.filter((s) => !s.flat)) {
    const it = thrower(stage);
    for (let i = 0; i < 3; i++) it.throwRaffle();
    it.applyTakeBackMeasure(twoPerRow(3));
    assert.equal(it.takeBackPageCount, 0, `${stage.width} × ${stage.height}`);
    assert.equal(it.takeBackShown.length, 3);
  }
});

test('the list in the markup stands on takeBackShown, and its pager only where there is more than one page', () => {
  const plan = readFileSync(new URL('../views/plan.php', import.meta.url), 'utf8');
  const list = plan.slice(plan.indexOf('class="raffle-takeback"'), plan.indexOf('class="raffle-takeback-list"') + 400);
  assert.match(list, /takeBackPageCount > 1/);
  assert.match(list, /pageTakeBack\(-1\)/);
  assert.match(list, /pageTakeBack\(1\)/);
  assert.match(list, /takeBackShown|takeBackOn\(/);
});
