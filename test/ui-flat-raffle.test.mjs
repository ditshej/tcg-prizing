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

function app() {
  const query = `?v=1&g=${GAME.id}&t=${TOURNAMENT_TYPES[0].id}`;
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
