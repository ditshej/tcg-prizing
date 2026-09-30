import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { CURVES, RANGES, largestRemainder, rafflePot, rangeSize } from '../public/core/rules.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

/** The five pairs of RaffleRange steps that are each other's complement. */
const PAIRS = [
  ['topQuarter', 'bottomThreeQuarters'],
  ['topThird', 'bottomTwoThirds'],
  ['topHalf', 'bottomHalf'],
  ['topTwoThirds', 'bottomThird'],
  ['topThreeQuarters', 'bottomQuarter'],
];

test('the range pairs tile every player count without gap or overlap', () => {
  for (let players = 2; players <= 128; players++) {
    for (const [top, bottom] of PAIRS) {
      const upper = rangeSize(top, players);
      const lower = rangeSize(bottom, players);
      assert.equal(
        upper + lower,
        players,
        `${top} + ${bottom} at ${players} players: ${upper} + ${lower}`,
      );
      assert.ok(upper >= 0 && lower >= 0, `${top}/${bottom} at ${players} players is negative`);
    }
  }
});

test('every RANGES step is covered by a pair or is an absolute or full step', () => {
  const paired = new Set(PAIRS.flat());
  const unpaired = RANGES.map((r) => r.id).filter((id) => !paired.has(id));
  assert.deepEqual(unpaired, ['top8', 'top16', 'all']);
});

test('rangeSize measures on the player count and caps the absolute steps', () => {
  assert.equal(rangeSize('top8', 5), 5);
  assert.equal(rangeSize('top8', 32), 8);
  assert.equal(rangeSize('top16', 32), 16);
  assert.equal(rangeSize('all', 32), 32);
  assert.equal(rangeSize('topThird', 32), 11); // ceil(32/3)
  assert.equal(rangeSize('bottomTwoThirds', 32), 21);
});

test('the curve steps are the seven named ratios, none of them flat', () => {
  assert.deepEqual(
    CURVES.map((c) => [c.id, c.ratio]),
    [
      ['gentle', 0.85],
      ['mild', 0.75],
      ['moderate', 0.65],
      ['firm', 0.55],
      ['steep', 0.45],
      ['severe', 0.35],
      ['extreme', 0.25],
    ],
  );
});

test('on an equal remainder the higher Rank gets the open unit', () => {
  // ADR 0001, addendum #45: weights 16 : 4 : 1 over 7 units give the nominal
  // shares 5⅓ / 1⅓ / 0⅓ — three equal remainders against one open Booster.
  assert.deepEqual(largestRemainder([1, 0.25, 0.0625], 7), [6, 1, 0]);
});

test('largestRemainder hands out exactly the total, never more or less', () => {
  for (const ratio of CURVES.map((c) => c.ratio)) {
    for (let count = 1; count <= 32; count++) {
      const weights = Array.from({ length: count }, (_, j) => ratio ** j);
      for (const total of [0, 1, 7, 47, 500, 4096]) {
        const out = largestRemainder(weights, total);
        assert.equal(out.reduce((a, b) => a + b, 0), total);
        assert.ok(out.every((v) => v >= 0));
      }
    }
  }
});

test('the shaped share never rises down the ranks', () => {
  for (const ratio of CURVES.map((c) => c.ratio)) {
    const weights = Array.from({ length: 16 }, (_, j) => ratio ** j);
    const out = largestRemainder(weights, 333);
    for (let i = 1; i < out.length; i++) {
      assert.ok(out[i] <= out[i - 1], `${ratio}: ${out.join('·')}`);
    }
  }
});

/* ── rafflePot (#69) ─────────────────────────────────────────────────────── */

/**
 * A plan reduced to the two fields `rafflePot()` reads. The core's own plans
 * are used further down; this one exists so a case can state the allocation
 * stand it wants — "rank 3 and rank 7 already hold one" — without steering a
 * DefaultSet into producing it.
 */
function planWith(players, winnersByRank = {}) {
  return {
    players,
    rows: Array.from({ length: players }, (_, i) => ({
      rank: i + 1,
      winners: winnersByRank[i + 1] ?? 0,
    })),
  };
}

test('an untouched plan puts every rank of the range in the pot', () => {
  const plan = planWith(32);
  assert.deepEqual(rafflePot(plan, 'top8'), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(rafflePot(plan, 'all').length, 32);
  assert.deepEqual(rafflePot(plan, 'bottomQuarter'), [25, 26, 27, 28, 29, 30, 31, 32]);
});

/**
 * The criterion "Paare ergänzen sich lückenlos und überlappungsfrei" read at
 * the pot rather than at `rangeSize()`: the five pairs that *have* a
 * complement tile the whole `Ranking` between them. `top8`, `top16` and `all`
 * are deliberately not in this list — they have no complement in `RANGES`, and
 * inventing one for them would be inventing a step (#69, CONTEXT.md
 * `RaffleRange`: "Untere fünf als deren Komplemente").
 */
test('the five complementary pairs tile the pot without gap or overlap', () => {
  for (const players of [2, 3, 7, 32, 33, 64, 127]) {
    const plan = planWith(players);
    const whole = Array.from({ length: players }, (_, i) => i + 1);
    for (const [top, bottom] of PAIRS) {
      const upper = rafflePot(plan, top);
      const lower = rafflePot(plan, bottom);
      assert.deepEqual(
        [...upper, ...lower].sort((a, b) => a - b),
        whole,
        `${top} + ${bottom} at ${players} players`,
      );
      assert.equal(new Set([...upper, ...lower]).size, players, `${top}/${bottom} overlap`);
    }
  }
});

test('an absolute step is capped at the player count', () => {
  assert.deepEqual(rafflePot(planWith(5), 'top8'), [1, 2, 3, 4, 5]);
  assert.deepEqual(rafflePot(planWith(3), 'top16'), [1, 2, 3]);
  assert.equal(rafflePot(planWith(32), 'top16').length, 16);
});

test('a rank that already holds a winner pack falls out of the pot', () => {
  const plan = planWith(8, { 1: 1, 4: 2 });
  assert.deepEqual(rafflePot(plan, 'all'), [2, 3, 5, 6, 7, 8]);
});

/**
 * The exclusion is an invariant over the whole `WinnerPackAllocation`, not a
 * control: `ranked` and `manual` are both a winner pack, and the row's
 * `winners` is where the core has already added them up (`distribute.mjs`).
 */
test('the exclusion takes ranked and manual alike, off a real plan', () => {
  const settings = resolveSettings({
    game: GAME,
    type: TOURNAMENT_TYPES[0],
    pins: { players: 16, winnerPacks: 6, ranked: 3, manualWinner: { 9: 1 } },
  });
  const plan = distribute(settings);
  // Read off the plan, never chosen: `ranked` is capped at what the RankPool
  // holds, so the six winner packs are what lets a prefix of three stand at
  // all (`allocateWinners()` in `distribute.mjs`).
  assert.equal(plan.allocation.ranked, 3);
  assert.equal(plan.allocation.open, 2);
  assert.equal(plan.allocation.manual[9], 1);
  const pot = rafflePot(plan, 'all');
  for (const gone of [1, 2, 3, 9]) assert.ok(!pot.includes(gone), `rank ${gone} is still in the pot`);
  assert.equal(pot.length, 16 - 4);
});

/**
 * The one case `CONTEXT.md` names outright: "Er … kann leer sein, während die
 * `RaffleRange` es nicht ist" — and that is what locks the trigger while
 * winner packs are still `open` (#69 AC 7).
 */
test('the pot can be empty while the range is not', () => {
  const plan = planWith(32, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 });
  assert.equal(rangeSize('top8', 32), 8);
  assert.deepEqual(rafflePot(plan, 'top8'), []);
  assert.equal(rafflePot(plan, 'top16').length, 8);
});

test('rafflePot is pure: it returns a fresh list and touches no plan of its own', () => {
  const plan = planWith(4);
  const frozen = JSON.stringify(plan);
  const first = rafflePot(plan, 'all');
  first.push(99);
  assert.deepEqual(rafflePot(plan, 'all'), [1, 2, 3, 4]);
  assert.equal(JSON.stringify(plan), frozen);
});

test('an unknown range step falls back to the whole field, as rangeSize does', () => {
  assert.deepEqual(rafflePot(planWith(4), 'nonsense'), [1, 2, 3, 4]);
});
