import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePool, distribute } from '../public/core/distribute.mjs';

/**
 * A neutral Settings object, built by hand — the DefaultSet sheets do not
 * exist yet (#54). Everything that would come from a sheet is spelled out at
 * the call site, so a test reads as its own scenario.
 */
function settings(overrides = {}) {
  return {
    players: 32,
    boosterRate: 0,
    tournamentPacks: null,
    envelopeSize: 24,
    envelopeYield: 1,
    displaySize: 24,
    participationBooster: 0,
    participationPack: 0,
    judgeBooster: 0,
    judgeWinner: 0,
    rankFloor: 2,
    depthStep: 'all',
    depth: null,
    curve: 'steep',
    ranked: null,
    winnerPacks: null,
    manualWinner: {},
    displays: [],
    combinedHandout: false,
    ...overrides,
  };
}

/** The Booster column of the served ranks, the shape a measured plan is read in. */
const served = (plan) => plan.rows.filter((row) => row.served).map((row) => row.booster);

test('the plan holds one row per Player, not only the served ranks', () => {
  const plan = distribute(settings({ players: 32, boosterRate: 3, rankFloor: 2, depth: 8 }));
  assert.equal(plan.rows.length, 32);
  assert.deepEqual(
    plan.rows.map((row) => row.rank),
    Array.from({ length: 32 }, (_, i) => i + 1),
  );
  assert.equal(plan.rows.filter((row) => row.served).length, 8);
  assert.ok(plan.rows.slice(8).every((row) => row.booster === 0));
});

test('Weekend with 32 Players and no reservation gives 29·14·7·4·3·3·2·2', () => {
  const plan = distribute(
    settings({
      players: 32,
      boosterRate: 3,
      participationBooster: 1,
      rankFloor: 2,
      depth: 8,
      curve: 'steep',
    }),
  );
  assert.equal(plan.rank.booster, 64);
  assert.deepEqual(served(plan), [29, 14, 7, 4, 3, 3, 2, 2]);
});
