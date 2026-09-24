import test from 'node:test';
import assert from 'node:assert/strict';

import { CURVES, RANGES, largestRemainder, rangeSize } from '../public/core/rules.mjs';

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
