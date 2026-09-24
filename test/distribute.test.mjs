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

test('the same stand without a set depth gives a depthCap of 31', () => {
  const plan = distribute(
    settings({
      players: 32,
      boosterRate: 3,
      participationBooster: 1,
      rankFloor: 2,
      depth: null,
      curve: 'steep',
    }),
  );
  // 64 Boosters in the RankPool, floor 2 and the lead of 1: 2·31 + 1 = 63
  // fits, 2·32 + 1 = 65 does not.
  assert.equal(plan.depthCap, 31);
  assert.equal(plan.depth, 31); // depthStep `all` gives 32, the cap binds
});

test('a pinned depth is never cut by the cap, only by the player count', () => {
  const base = {
    players: 32,
    boosterRate: 3,
    participationBooster: 1,
    rankFloor: 2,
    curve: 'steep',
  };
  assert.equal(distribute(settings({ ...base, depth: 32 })).depth, 32);
  assert.equal(distribute(settings({ ...base, depth: 99 })).depth, 32);
  assert.equal(distribute(settings({ ...base, depth: 0 })).depth, 1);
});

test('a RankFloor of 0 is a reachable edge and the cap stays defined', () => {
  const plan = distribute(
    settings({ players: 32, boosterRate: 3, participationBooster: 1, rankFloor: 0, depth: null }),
  );
  assert.equal(plan.depthCap, 32);
  assert.equal(plan.depth, 32);
  assert.equal(plan.rows[0].booster + plan.rows.slice(1).reduce((a, r) => a + r.booster, 0), 64);
});

test('the tie of ADR 0001 gives 9·3·2 on a valid stand', () => {
  // 8 Players, RankPool 14, RankFloor 2, depth 3, `extreme`. The RankPool is
  // built by hand: 2 Boosters per Player make 16, a JudgePool of 2 leaves 14.
  const plan = distribute(
    settings({
      players: 8,
      boosterRate: 2,
      judgeBooster: 2,
      rankFloor: 2,
      depth: 3,
      curve: 'extreme',
    }),
  );
  assert.equal(plan.rank.booster, 14);
  assert.equal(plan.shapedRemainder, 7);
  assert.deepEqual(served(plan), [9, 3, 2]);
});

test('a ShapedRemainder of 0 is the pure floor, and curveSilent stands', () => {
  // 8 Players, RankPool 16, RankFloor 5, depth 3: 5·3 + 1 = 16 exactly.
  const plan = distribute(
    settings({ players: 8, boosterRate: 2, rankFloor: 5, depth: 3, curve: 'gentle' }),
  );
  assert.equal(plan.rank.booster, 16);
  assert.equal(plan.shapedRemainder, 0);
  assert.equal(plan.curveSilent, true);
  assert.deepEqual(served(plan), [6, 5, 5]);

  // The curve step has no effect at all on that stand.
  for (const curve of ['mild', 'moderate', 'firm', 'steep', 'severe', 'extreme']) {
    const other = distribute(
      settings({ players: 8, boosterRate: 2, rankFloor: 5, depth: 3, curve }),
    );
    assert.deepEqual(served(other), [6, 5, 5]);
  }
});

test('derivePool is exported on its own and needs no distribution', () => {
  assert.deepEqual(derivePool(settings({ players: 32, boosterRate: 3 })), {
    booster: 96,
    packs: 32,
  });
  // tournamentPacks is a trailing slider: null means the player count.
  assert.equal(derivePool(settings({ players: 32, tournamentPacks: 7 })).packs, 7);
  // The player count starts at 2 — the slider does (#15).
  assert.equal(derivePool(settings({ players: 1, boosterRate: 3 })).booster, 6);
});

test('the pool split is exhaustive: participation + judge + rank is the pool', () => {
  // The narrow version of the sum rule, over the valid stands this ticket
  // builds. The full run over conflict, overtaking and orphaned reservations
  // belongs to #58.
  for (const players of [2, 5, 8, 32, 64]) {
    for (const boosterRate of [0, 1, 3, 12]) {
      for (const participationBooster of [0, 1, 4, 12]) {
        for (const judgeBooster of [0, 3, 40, 500]) {
          for (const participationPack of [0, 1, 4]) {
            const plan = distribute(
              settings({
                players,
                boosterRate,
                participationBooster,
                judgeBooster,
                participationPack,
              }),
            );
            const where = JSON.stringify({
              players,
              boosterRate,
              participationBooster,
              judgeBooster,
              participationPack,
            });
            assert.equal(
              plan.participation.booster + plan.judge.booster + plan.rank.booster,
              plan.pool.booster,
              `Booster sum at ${where}`,
            );
            assert.equal(
              plan.participation.packs + plan.rank.packs,
              plan.pool.packs,
              `TournamentPack sum at ${where}`,
            );
            assert.ok(plan.rank.booster >= 0, `negative RankPool at ${where}`);
            // On a conflict-free stand the rank rows spend the RankPool down
            // to the last Booster. Where the RankPool does not even carry the
            // floor of a single Rank, the pouring from the top decides what
            // really goes out, and that is #56.
            if (plan.rank.booster >= plan.floorReserved) {
              assert.equal(
                plan.rows.reduce((a, row) => a + row.booster, 0),
                plan.rank.booster,
                `rank rows against the RankPool at ${where}`,
              );
            }
          }
        }
      }
    }
  }
});

test('the core touches no DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.ok(distribute(settings()).rows.length > 0);
});
