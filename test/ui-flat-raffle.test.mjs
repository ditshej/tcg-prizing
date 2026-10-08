import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { planApp } from '../public/ui/plan.mjs';
import { chipIntoView, pillStep, rowScrollEnds } from '../public/ui/geometry.mjs';

/**
 * The raffle bar where room is short (#129, decided in run 15 on the cards):
 *
 * 1. The diagram is an extra. It stands only where, after the two tile rows
 *    and the open bar's measured cover, its 60 px floor is left
 *    (`diagramFits()` in `geometry.mjs`, under its own tests); elsewhere it is
 *    gone, on every fold. The rind measures, the component only holds the
 *    verdict (`applyDiagramRoom()`). The rank total does not leave with it
 *    (#132): the sum check has three places on every stage.
 * 2. On the flat stage and in the cramped exception the retraction list is
 *    one row that scrolls sideways — it does not page and it does not grow
 *    the bar. Arrows say there is more and move it by one pill.
 *
 * Everywhere else #69 holds: the list wraps and the bar grows with it.
 */

/** Weekly with 16 winner packs, so seven are open to throw (Weekly's own leaves one). */
function app() {
  const query = `?v=1&g=${GAME.id}&t=${TOURNAMENT_TYPES[0].id}&winnerPacks=16`;
  return planApp({ read: () => query, write: () => {} });
}

const markup = readFileSync(new URL('../views/plan.php', import.meta.url), 'utf8');

/** The opening tag of the first element carrying `marker`. */
function tagOf(marker) {
  const at = markup.indexOf(marker);
  assert.ok(at >= 0, `markup has ${marker}`);
  const start = markup.lastIndexOf('<', at);
  return markup.slice(start, markup.indexOf('>', at) + 1);
}

/** The value of `attr` on that tag. */
function attrOf(marker, attr) {
  const tag = tagOf(marker);
  const found = tag.match(new RegExp(`${attr.replace(/[.:@]/g, '\\$&')}="([^"]*)"`));
  assert.ok(found, `${marker} carries ${attr}`);
  return found[1];
}

/**
 * Runs a binding of the markup against the component, the way Alpine does —
 * so a test holds what the expression **does**, not that a string is there
 * (B12 of run 15: `takeBackOn(index) || true` stayed green against a regex).
 */
function evaluate(expression, component) {
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) { return (${expression}); }`)(component);
}

/* ── 1 · The diagram stands only with room ─────────────────────────────── */

test('the diagram stands on the measured room, and in fullscreen never (#63)', () => {
  const it = app();
  it.setStage({ width: 812, height: 375 });
  assert.equal(it.diagramShown, true, 'room until measured otherwise');
  it.applyDiagramRoom(false);
  assert.equal(it.diagramShown, false);
  it.applyDiagramRoom(true);
  assert.equal(it.diagramShown, true);
  it.openFullscreen();
  assert.equal(it.diagramShown, false);
});

test('opening the bar is no verdict of its own: the fold and the bar do not hide the diagram, the room does', () => {
  for (const stage of [{ width: 812, height: 375 }, { width: 600, height: 493 }, { width: 1280, height: 450 }]) {
    const it = app();
    it.setStage(stage);
    it.toggleRaffle();
    assert.equal(it.diagramShown, true, `${stage.width} × ${stage.height} before the measuring pass`);
  }
});

test('the diagram in the markup stands on diagramShown — evaluated, not matched', () => {
  const it = app();
  it.setStage({ width: 812, height: 375 });
  const show = attrOf('class="plan-diagram"', 'x-show');
  assert.equal(evaluate(show, it), true);
  it.applyDiagramRoom(false);
  assert.equal(evaluate(show, it), false, 'no room');
});

test('the rank total stays when the diagram goes, and leaves only with fullscreen (#132)', () => {
  const it = app();
  it.setStage({ width: 812, height: 375 });
  const show = attrOf('class="plan-ranktotal"', 'x-show');
  assert.equal(evaluate(show, it), true, 'diagram stands');
  it.applyDiagramRoom(false);
  assert.equal(it.diagramShown, false);
  assert.equal(evaluate(show, it), true, 'diagram gone, rank total stays');
  it.toggleRaffle();
  assert.equal(evaluate(show, it), true, 'bar open, diagram gone');
  it.toggleRaffle();
  it.openFullscreen();
  assert.equal(evaluate(show, it), false, 'fullscreen');
  it.closeFullscreen();
  assert.equal(evaluate(show, it), true, 'back from fullscreen');
});

/* ── 2 · The retraction list scrolls sideways, flat and cramped ─────────── */

test('the list scrolls on the flat stage and in the cramped exception, read off the fold — both sides of each edge', () => {
  // [stage, scrolls]: 435/436 at 380 (cramped / flat — both scroll); the
  // one-column threshold at 600 (rail at the master 124 → 531) and 500 (rail 115 → 522);
  // the first height 398/399 at 674; and a cramped stage against the same
  // width over the threshold.
  const cases = [
    [{ width: 435, height: 380 }, true],
    [{ width: 436, height: 380 }, true],
    [{ width: 600, height: 530 }, true],
    [{ width: 600, height: 531 }, false],
    [{ width: 500, height: 521, railHeight: 115 }, true],
    [{ width: 500, height: 522, railHeight: 115 }, false],
    [{ width: 674, height: 398 }, true],
    [{ width: 674, height: 399 }, false],
    [{ width: 420, height: 380, railHeight: 117 }, true],
    [{ width: 420, height: 900, railHeight: 117 }, false],
    [{ width: 393, height: 830 }, false],
  ];
  for (const [stage, scrolls] of cases) {
    const it = app();
    it.setStage(stage);
    assert.equal(it.takeBackScrolls, scrolls, `${stage.width} × ${stage.height}`);
    assert.equal(it.takeBackScrolls, it.fold.flat || it.fold.cramped, 'nothing but the fold decides');
  }
});

test('the list in the markup is one scrolling row exactly where takeBackScrolls says, evaluated', () => {
  const binding = attrOf('class="raffle-takeback-list"', ':class');
  for (const [stage, scrolls] of [[{ width: 812, height: 375 }, true], [{ width: 393, height: 830 }, false]]) {
    const it = app();
    it.setStage(stage);
    assert.equal(evaluate(binding, it)['raffle-takeback-row'], scrolls, `${stage.width} × ${stage.height}`);
  }
  const css = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
  const rule = css.slice(css.indexOf('.raffle-takeback-row {'), css.indexOf('}', css.indexOf('.raffle-takeback-row {')));
  assert.match(rule, /flex-wrap:\s*nowrap/);
  assert.match(rule, /overflow-x:\s*auto/);
});

test('no pages are left in the markup: no n/m, no page state', () => {
  assert.doesNotMatch(markup, /takeBackPage|takeBackOn\(|pageTakeBack/);
  const it = app();
  assert.equal('takeBackPage' in it, false);
  assert.equal('takeBackShown' in it, false);
});

test('the arrows show only while the row overflows, lock at their own end, and step by one pill', () => {
  const it = app();
  it.setStage({ width: 436, height: 380 });
  const show = attrOf('class="raffle-scroller"', 'x-show');
  const back = attrOf('aria-label="Scroll the list back"', ':disabled');
  const on = attrOf('aria-label="Scroll the list on"', ':disabled');
  assert.match(attrOf('aria-label="Scroll the list back"', '@click'), /^stepTakeBack\(-1\)$/);
  assert.match(attrOf('aria-label="Scroll the list on"', '@click'), /^stepTakeBack\(1\)$/);

  it.takeBackEnds = rowScrollEnds({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 });
  assert.equal(evaluate(show, it), false, 'fits: no arrows');

  it.takeBackEnds = rowScrollEnds({ scrollLeft: 0, scrollWidth: 500, clientWidth: 300 });
  assert.equal(evaluate(show, it), true);
  assert.equal(evaluate(back, it), true, 'at the start, back is locked');
  assert.equal(evaluate(on, it), false);

  it.takeBackEnds = rowScrollEnds({ scrollLeft: 200, scrollWidth: 500, clientWidth: 300 });
  assert.equal(evaluate(back, it), false);
  assert.equal(evaluate(on, it), true, 'at the end, on is locked');
});

test('the ends of the row, with a pixel of slack for fractional scroll positions', () => {
  assert.deepEqual(rowScrollEnds({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }), { overflow: false, atStart: true, atEnd: true });
  assert.deepEqual(rowScrollEnds({ scrollLeft: 0, scrollWidth: 301, clientWidth: 300 }), { overflow: false, atStart: true, atEnd: true });
  assert.deepEqual(rowScrollEnds({ scrollLeft: 0, scrollWidth: 302, clientWidth: 300 }), { overflow: true, atStart: true, atEnd: false });
  assert.deepEqual(rowScrollEnds({ scrollLeft: 101.5, scrollWidth: 402, clientWidth: 300 }), { overflow: true, atStart: false, atEnd: true });
});

/** Chips 60 wide, 4 apart: their left edges in the row. */
const lefts = [0, 64, 128, 192, 256, 320];
const row = { lefts, clientWidth: 200, scrollWidth: 380 };

test('one arrow click moves the row by exactly one pill, either way', () => {
  assert.equal(pillStep({ ...row, scrollLeft: 0 }, 1), 64);
  assert.equal(pillStep({ ...row, scrollLeft: 64 }, 1), 128);
  assert.equal(pillStep({ ...row, scrollLeft: 128 }, -1), 64);
  // From between two pills, the next pill edge either way — not a whole pill past it.
  assert.equal(pillStep({ ...row, scrollLeft: 30 }, 1), 64);
  assert.equal(pillStep({ ...row, scrollLeft: 30 }, -1), 0);
});

test('a step stops at both ends of the row, never past them', () => {
  assert.equal(pillStep({ ...row, scrollLeft: 0 }, -1), 0);
  // The end is scrollWidth − clientWidth = 180, short of the pill at 192.
  assert.equal(pillStep({ ...row, scrollLeft: 128 }, 1), 180);
  assert.equal(pillStep({ ...row, scrollLeft: 180 }, 1), 180);
  // A pill wider than the row still moves the row by itself.
  assert.equal(pillStep({ lefts: [0, 250], clientWidth: 200, scrollWidth: 310, scrollLeft: 0 }, 1), 110);
});

test('a fresh hit scrolls its chip into the row, and not at all when it is already in it', () => {
  // Row 200 wide, scrolled to 50: a chip at 64–124 is in it, the row stays.
  assert.equal(chipIntoView({ left: 64, width: 60 }, 50, 200), 50);
  // The chip at 256–316 lies right of it: scroll so it ends at the right edge.
  assert.equal(chipIntoView({ left: 256, width: 60 }, 0, 200), 116);
  // Scrolled to 180, the chip at 64 lies left of it: scroll to its left edge.
  assert.equal(chipIntoView({ left: 64, width: 60 }, 180, 200), 64);
});

test('a throw asks for its chip to be shown, and only where the row scrolls', () => {
  const flat = app();
  flat.setStage({ width: 812, height: 375 });
  flat.toggleRaffle();
  flat._roll = () => 0;
  flat.throwRaffle();
  assert.equal(flat._takeBackShow, flat.lastDraw);

  const master = app();
  master.setStage({ width: 393, height: 830 });
  master.toggleRaffle();
  master._roll = () => 0;
  master.throwRaffle();
  assert.equal(master._takeBackShow, null);
});

/* ── The plan head never wraps (#129, run 15, K6 — closes A10) ─────────── */

test('the output line of the plan head keeps to one line and scrolls sideways, so the fixed part holds its 178', () => {
  const css = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
  const at = css.indexOf('.plan-output {');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /white-space:\s*nowrap/);
  assert.match(rule, /overflow-x:\s*auto/);
  assert.match(tagOf('plan-output'), /class="col-sub plan-output"/);
});

/* ── The output line is worded to fit beside both head buttons (#143, K-B3) ─ */

test('the output line says `packs`, not `tournament packs`, so it stands whole at 393 beside share and reset', () => {
  const at = markup.indexOf('class="col-sub plan-output"');
  const tag = markup.slice(at, markup.indexOf('>', at));
  const text = tag.match(/x-text="`([^`]*)`"/);
  assert.ok(text, 'the output line is written by x-text');
  assert.equal(
    text[1],
    '${plan.pool.booster} boosters · ${plan.pool.packs} packs · ${plan.pool.winners} winner packs',
  );
});

/* ── The plan head's buttons are one family: raised cards (#143, K-B1, B18) ─ */

test('share and reset stand in both hit lists and carry the card form', () => {
  const css = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8')
    .replace(/\/\*[^]*?\*\//g, '');
  const lists = [...css.matchAll(/^:where\(([^)]*)\)(?:::after)?\s*\{/gm)]
    .map(([, list]) => list.split(',').map((s) => s.trim()))
    .filter((names) => names.includes('.bubble-close'));
  assert.equal(lists.length, 2, 'the hit rule comes as two lists: position, then ::after');
  for (const names of lists) {
    assert.ok(names.includes('.plan-share'), '.plan-share is in the hit list');
    assert.ok(names.includes('.plan-reset'), '.plan-reset is in the hit list');
  }
  const at = css.indexOf('.plan-reset,\n.plan-share {');
  assert.ok(at >= 0, 'share and reset share one rule');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /\bwidth:\s*32px/);
  assert.match(rule, /\bheight:\s*32px/);
  assert.match(rule, /background:\s*var\(--paper\)/);
  assert.match(rule, /box-shadow:\s*var\(--btn-shadow\)/);
  assert.match(rule, /border-radius:\s*var\(--r-ctl\)/);
});

test('a throw leaves its hit to the next measuring pass, which shows it after the bar and the diagram are laid out', () => {
  const it = app();
  it.setStage({ width: 600, height: 493 });
  it.toggleRaffle();
  it._roll = () => 0.99;
  it.throwRaffle();
  assert.equal(it._hitPending, it.lastDraw);
  const effect = readFileSync(new URL('../public/ui/plan.mjs', import.meta.url), 'utf8');
  const body = effect.slice(effect.indexOf('    measureRaffle() {'), effect.indexOf('\n    },', effect.indexOf('    measureRaffle() {')));
  assert.ok(body.indexOf('applyGeometry') < body.indexOf('this.showHit('), 'geometry before the hit');
  assert.match(body, /this\.lastDraw/, 'a throw on the same rank still wakes the pass');
});
