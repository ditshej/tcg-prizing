import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePool, distribute } from '../public/core/distribute.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

/**
 * The Weekend sheet (#21/#25's resolution comments, transcribed into
 * `public/sets/onepiece.mjs` by #54), with the four trailing sliders left at
 * `null` so the core computes them, and `overrides` for what a ticket's
 * scenario pins by hand (`players`, `displays`, …). #55's acceptance criteria
 * are measured against this sheet, not a hand-assembled Settings object
 * (AGENTS.md, "a decided number is looked up, never back-computed").
 */
function weekendSettings(overrides = {}) {
  const weekend = TOURNAMENT_TYPES.find((t) => t.id === 'weekend');
  return {
    ...GAME,
    ...weekend,
    tournamentPacks: null,
    depth: null,
    ranked: null,
    winnerPacks: null,
    manualWinner: {},
    displays: [],
    ...overrides,
  };
}

/**
 * A neutral Settings object, built by hand rather than from a DefaultSet
 * sheet (#54 is closed, but a scenario that is not itself about a named
 * sheet — a raw settlement or sum-rule case — reads better spelled out at the
 * call site than pulled from `Weekend` or `Release`).
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
  // envelopeSize 24, envelopeYield 1 (the fixture default): 32 packs open one
  // full envelope plus 8 loose ones. 8 is below the two-thirds mark of 16, so
  // the envelope has not yielded its WinnerPack yet; the one full envelope
  // gives the other.
  assert.deepEqual(derivePool(settings({ players: 32, boosterRate: 3 })), {
    booster: 96,
    packs: 32,
    winners: 1,
    winnersDerived: 1,
    opened: 8,
    partialYield: 0,
    thresholds: [16],
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

test('the indivisible axes are exhaustive: the RankCycle spends the whole rank.packs, the WinnerPackAllocation the whole rank.winners', () => {
  for (const players of [2, 5, 8, 32]) {
    for (const tournamentPacks of [0, 1, 7, 40, 300]) {
      for (const winnerPacks of [0, 1, 5, 30]) {
        for (const judgeWinner of [0, 2, 100]) {
          for (const ranked of [null, 0, 3]) {
            const plan = distribute(
              settings({ players, tournamentPacks, winnerPacks, judgeWinner, ranked }),
            );
            const where = JSON.stringify({ players, tournamentPacks, winnerPacks, judgeWinner, ranked });

            assert.equal(plan.judge.winners + plan.rank.winners, plan.pool.winners, `winners sum at ${where}`);
            assert.equal(
              plan.rows.reduce((a, row) => a + row.packs, 0),
              plan.rank.packs,
              `RankCycle spends rank.packs exactly at ${where}`,
            );
            // Rows only carry ranked + manual; `open` WinnerPacks have no
            // recipient by definition, so the row sum falls short by exactly
            // that count.
            assert.equal(
              plan.rows.reduce((a, row) => a + row.winners, 0) + plan.allocation.open,
              plan.rank.winners,
              `WinnerPackAllocation accounts for rank.winners at ${where}`,
            );
          }
        }
      }
    }
  }
});

test('the PromoEnvelope staffel <32, 2> gives 1 at 11 opened packs and 2 at 22', () => {
  const at = (opened) =>
    derivePool(settings({ tournamentPacks: opened, envelopeSize: 32, envelopeYield: 2 }));
  assert.equal(at(11).partialYield, 1);
  assert.equal(at(11).winnersDerived, 1);
  assert.equal(at(22).partialYield, 2);
  assert.equal(at(22).winnersDerived, 2);
});

test('at Ausbeute 1 the staffel falls back exactly to the two-thirds threshold', () => {
  // envelopeSize 24, yieldPer 1: the old single threshold is ceil(2*24/3) = 16.
  const below = derivePool(settings({ tournamentPacks: 15, envelopeSize: 24, envelopeYield: 1 }));
  const at = derivePool(settings({ tournamentPacks: 16, envelopeSize: 24, envelopeYield: 1 }));
  assert.equal(below.winnersDerived, 0);
  assert.equal(at.winnersDerived, 1);
  assert.deepEqual(at.thresholds, [16]);
});

test('a Judge WinnerPack shortens the automatic ranked prefix, not the open rest', () => {
  // 10 WinnerPacks, 2 to the Judge: rankWP = 8, rankedAuto = floor(8/2)+1 = 5.
  // Had the Judge instead eaten into `open`, rankedAuto would still read the
  // staffel off the full 10 (floor(10/2)+1 = 6).
  const plan = distribute(settings({ winnerPacks: 10, judgeWinner: 2 }));
  assert.equal(plan.judge.winners, 2);
  assert.equal(plan.rank.winners, 8);
  assert.equal(plan.allocation.rankedAuto, 5);
  assert.equal(plan.allocation.ranked, 5);
  assert.equal(plan.allocation.open, 3);
});

test('at rankWP = 0 the ranked staffel itself falls to 0', () => {
  const plan = distribute(settings({ winnerPacks: 0 }));
  assert.equal(plan.rank.winners, 0);
  assert.equal(plan.allocation.rankedAuto, 0);
  assert.equal(plan.allocation.ranked, 0);
  assert.equal(plan.allocation.open, 0);
});

test('the RankCycle starts at Rank 3 when two WinnerPacks are auto-assigned, and wraps from the last Rank back to Rank 1', () => {
  // 5 Players, 7 TournamentPacks in the RankPool, ranked pinned to 2: the
  // cycle starts at index 2 (Rank 3) and wraps.
  // g=0..6 -> ranks 3,4,5,1,2,3,4 -> counts [1,1,2,2,1] for ranks 1..5.
  const plan = distribute(
    settings({ players: 5, tournamentPacks: 7, winnerPacks: 4, ranked: 2 }),
  );
  assert.equal(plan.rank.packs, 7);
  assert.deepEqual(
    plan.rows.map((row) => row.packs),
    [1, 1, 2, 2, 1],
  );
});

test('the RankCycle reaches beyond the RankPoolDepth', () => {
  const plan = distribute(
    settings({ players: 5, tournamentPacks: 7, winnerPacks: 4, ranked: 2, depth: 1 }),
  );
  assert.equal(plan.depth, 1);
  const unserved = plan.rows.filter((row) => !row.served);
  assert.equal(unserved.length, 4);
  assert.equal(
    unserved.reduce((a, row) => a + row.packs, 0),
    6, // all 7 packs but the one landing on the single served Rank 1
  );
});

/**
 * The sum rule read off the plan itself, in the one shape that cannot be
 * satisfied by writing the wanted invariant down: every quantity comes from
 * the same plan, and none of the three terms may be left out.
 */
function assertPlanSum(plan, where) {
  const rowSum = (key) => plan.rows.reduce((a, row) => a + row[key], 0);
  assert.equal(
    plan.participation.booster + plan.judge.booster + rowSum('booster'),
    plan.pool.booster,
    `Booster sum at ${where}`,
  );
  // The JudgePool never touches TournamentPacks, so it has no `packs` term at
  // all — the sum rule still names it, because leaving a term out silently is
  // exactly how the double count got through.
  assert.equal(
    plan.participation.packs + (plan.judge.packs ?? 0) + rowSum('packs'),
    plan.pool.packs,
    `TournamentPack sum at ${where}`,
  );
  // The other half of the same rule: the rank rows spend the RankPool down to
  // the last piece, so the Pool level and the row level tell one story.
  assert.equal(rowSum('booster'), plan.rank.booster, `rank rows against the RankPool at ${where}`);
  assert.equal(rowSum('packs'), plan.rank.packs, `rank rows against the RankPool packs at ${where}`);
}

test('CombinedHandout shifts the participation shares into the rows and does not add them', () => {
  // 8 Players at 4 Boosters each make 32; a participation rate of 1 takes 8,
  // the Judge 2, so the RankPool carries 22. 16 TournamentPacks at a rate of
  // 1 take 8, leaving 8 in the RankPool.
  const base = {
    players: 8,
    boosterRate: 4,
    tournamentPacks: 16,
    participationBooster: 1,
    participationPack: 1,
    judgeBooster: 2,
  };
  const apart = distribute(settings({ ...base, combinedHandout: false }));
  const combined = distribute(settings({ ...base, combinedHandout: true }));

  const rowSum = (plan, key) => plan.rows.reduce((a, row) => a + row[key], 0);

  // The sum rule holds on the plan itself, in both branches.
  assertPlanSum(apart, 'combinedHandout false');
  assertPlanSum(combined, 'combinedHandout true');

  // Apart: the participation block carries the shares, the rank rows do not.
  assert.equal(apart.participation.booster, 8);
  assert.equal(apart.participation.packs, 8);
  assert.equal(apart.rank.booster, 22);
  assert.equal(apart.rank.packs, 8);
  assert.equal(rowSum(apart, 'booster'), 22);
  assert.equal(rowSum(apart, 'packs'), 8);

  // Combined: the block falls to 0 and the shares stand in the rows instead —
  // on the Pool level too, or the same PrizeItems would be counted twice.
  assert.equal(combined.combinedHandout, true);
  assert.equal(combined.participation.booster, 0);
  assert.equal(combined.participation.packs, 0);
  assert.deepEqual(combined.participation.rate, { booster: 1, packs: 1 });
  assert.equal(combined.rank.booster, 30);
  assert.equal(combined.rank.packs, 16);
  assert.equal(rowSum(combined, 'booster'), 30);
  assert.equal(rowSum(combined, 'packs'), 16);

  // Shifted, not added: every row grew by exactly the rate, and the shaping
  // of the divisible axis is untouched — the same numbers, differently
  // grouped.
  for (let i = 0; i < apart.rows.length; i++) {
    assert.equal(combined.rows[i].booster, apart.rows[i].booster + 1, `row ${i + 1} Booster`);
    assert.equal(combined.rows[i].packs, apart.rows[i].packs + 1, `row ${i + 1} TournamentPacks`);
  }
  assert.equal(combined.shapedRemainder, apart.shapedRemainder);
  assert.equal(combined.depth, apart.depth);
  assert.equal(combined.depthCap, apart.depthCap);
});

test('the sum rule holds at the plan itself, in both handout branches', () => {
  for (const players of [2, 5, 8, 32]) {
    for (const boosterRate of [0, 1, 3, 12]) {
      for (const participationBooster of [0, 1, 4, 12]) {
        for (const judgeBooster of [0, 3, 40]) {
          for (const tournamentPacks of [null, 0, 7, 40]) {
            for (const participationPack of [0, 1, 4]) {
              const base = {
                players,
                boosterRate,
                participationBooster,
                judgeBooster,
                tournamentPacks,
                participationPack,
              };
              const apart = distribute(settings({ ...base, combinedHandout: false }));
              // Where the RankPool does not even carry the floor of a single
              // Rank, the pouring from the top decides what really goes out,
              // and that is #56. Read off the apart branch, whose RankPool is
              // the one the shaping sees.
              if (apart.rank.booster < apart.floorReserved) continue;

              const where = JSON.stringify(base);
              assertPlanSum(apart, `${where} apart`);
              assertPlanSum(distribute(settings({ ...base, combinedHandout: true })), `${where} combined`);
            }
          }
        }
      }
    }
  }
});

test('manual WinnerPack shares are free over the whole Ranking, several per Rank allowed, even on a ranked Rank', () => {
  // rankWP 10, ranked pinned to 2 (Ranks 1-2 auto), manual gives Rank 1 one
  // more and Rank 5 three.
  const plan = distribute(
    settings({ players: 8, winnerPacks: 10, ranked: 2, manualWinner: { 1: 1, 5: 3 } }),
  );
  assert.equal(plan.allocation.manualCount, 4);
  assert.equal(plan.allocation.open, 10 - 2 - 4);
  assert.equal(plan.rows[0].winners, 2); // ranked auto (1) plus manual (1)
  assert.equal(plan.rows[4].winners, 3); // manual only, not ranked
  assert.equal(plan.rows[1].winners, 1); // ranked auto only
});

test('the core touches no DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.ok(distribute(settings()).rows.length > 0);
});

// #55: DisplayReservation, settlement and overtaking.

test('Weekend with 32 Players and d = (1) gives 24·16·9·5·3·3·2·2 (#55)', () => {
  const plan = distribute(weekendSettings({ players: 32, displays: [1] }));
  assert.equal(plan.rank.booster, 64);
  assert.deepEqual(served(plan), [24, 16, 9, 5, 3, 3, 2, 2]);
});

test('the same stand gives a depthCap of 21, not 31 — the reservation pays in (#43, #55)', () => {
  const plan = distribute(weekendSettings({ players: 32, displays: [1] }));
  assert.equal(plan.depthCap, 21);
});

test('Weekend with 48 Players and d = (1) gives 24·34·16·9·5·3·3·2 and reports the overtake', () => {
  const plan = distribute(weekendSettings({ players: 48, displays: [1] }));
  assert.equal(plan.rank.booster, 96);
  assert.deepEqual(served(plan), [24, 34, 16, 9, 5, 3, 3, 2]);
  assert.deepEqual(plan.overtake, { under: 1, over: 2, has: 24, gets: 34 });
  assert.deepEqual(plan.flagged, [1, 2]);
});

test('a tie in the vector settles nobody, and only the topmost tie settles Rank 1', () => {
  const base = { players: 5, boosterRate: 2, displaySize: 1, rankFloor: 2, depth: 3 };

  const tied = distribute(settings({ ...base, displays: [1, 1, 0] }));
  assert.equal(tied.settledCount, 0);
  assert.deepEqual(tied.rows.slice(0, 3).map((r) => r.settled), [false, false, false]);

  const broken = distribute(settings({ ...base, displays: [2, 1, 1, 0] }));
  assert.equal(broken.settledCount, 1);
  assert.deepEqual(broken.rows.slice(0, 3).map((r) => r.settled), [true, false, false]);
});

test('a settled Rank has floor 0 and gets exactly its Displays', () => {
  const plan = distribute(
    settings({ players: 5, boosterRate: 2, displaySize: 1, rankFloor: 2, depth: 3, displays: [2, 1, 1, 0] }),
  );
  assert.equal(plan.rows[0].settled, true);
  assert.equal(plan.rows[0].floor, 0);
  assert.equal(plan.rows[0].displays, 2);
  assert.equal(plan.rows[0].reserved, 2); // displaySize 1 in this fixture
  assert.equal(plan.rows[0].booster, 2); // exactly its Displays, no floor, no lead, no curve
});

test('CombinedHandout neither creates nor hides an overtake — the RankPool share decides, not the row total', () => {
  const overtaking = weekendSettings({ players: 48, displays: [1] });
  const withOvertake = distribute({ ...overtaking, combinedHandout: false });
  const withOvertakeCombined = distribute({ ...overtaking, combinedHandout: true });
  assert.deepEqual(withOvertakeCombined.overtake, withOvertake.overtake);
  assert.ok(withOvertakeCombined.overtake); // still reported, not hidden by the shift

  const clean = weekendSettings({ players: 32, displays: [1] });
  const withoutOvertake = distribute({ ...clean, combinedHandout: false });
  const withoutOvertakeCombined = distribute({ ...clean, combinedHandout: true });
  assert.equal(withoutOvertake.overtake, null);
  assert.equal(withoutOvertakeCombined.overtake, null); // not conjured by the shift either
});
