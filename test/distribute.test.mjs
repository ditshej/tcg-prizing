import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { derivePool, distribute, unfit } from '../public/core/distribute.mjs';
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
  // Where a DisplayReservation reaches the whole depth, the rows fall short
  // of the RankPool by exactly the ShapedRemainder — reported as
  // `unclaimedRemainder`, not redistributed (#55, folded into `unfit` by
  // #56). It is still part of the PrizePool, so both sum-rule terms below
  // must name it, on top of the row sum, not instead of it.
  const unclaimed = plan.unclaimedRemainder ? plan.shapedRemainder : 0;
  assert.equal(
    plan.participation.booster + plan.judge.booster + rowSum('booster') + unclaimed,
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
  assert.equal(
    rowSum('booster') + unclaimed,
    plan.rank.booster,
    `rank rows against the RankPool at ${where}`,
  );
  assert.equal(rowSum('packs'), plan.rank.packs, `rank rows against the RankPool packs at ${where}`);
}

/**
 * The row breakdown reports what goes out, not what was promised: `reserved`
 * and `floor` together never exceed the Booster the Rank actually gets. In
 * the valid branch the nominal entitlement and the payout are the same
 * number, so only a conflict stand — where the RankPool runs dry partway
 * through the passes — tells the two apart (#56 resolution comment on #56,
 * 2026-09-27, finding G2).
 */
function assertRowsWithinPayout(plan, where) {
  for (const row of plan.rows) {
    assert.ok(
      row.reserved + row.floor <= row.booster,
      `Rank ${row.rank} shows ${row.reserved} reserved + ${row.floor} floor but gets ${row.booster} Booster at ${where}`,
    );
  }
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
              // Both axes of the DisplayReservation (#55): how many Displays
              // are pinned, and how deep the RankPoolDepth reaches. Neither
              // varied before, which is exactly how a DisplayReservation
              // reaching the whole depth — and the ShapedRemainder it leaves
              // with nobody to receive it — went unnoticed (#56 resolution
              // comment on #56, 2026-09-27).
              for (const displays of [[], [1], [2, 1]]) {
                for (const depth of [null, 1, 2]) {
                  const base = {
                    players,
                    boosterRate,
                    participationBooster,
                    judgeBooster,
                    tournamentPacks,
                    participationPack,
                    displays,
                    depth,
                  };
                  const apart = distribute(settings({ ...base, combinedHandout: false }));
                  // The conflict branch (#56) now pours from the top and
                  // keeps the row sum exhaustive even where the RankPool does
                  // not carry the DisplayReservation plus the floor of a
                  // single Rank, so the stand this used to skip is covered
                  // like any other — nothing left to jump over.
                  const where = JSON.stringify(base);
                  const combined = distribute(settings({ ...base, combinedHandout: true }));
                  assertPlanSum(apart, `${where} apart`);
                  assertPlanSum(combined, `${where} combined`);
                  // No Rank row promises more than it is handed — the half of
                  // #56 that changed what `reserved`/`floor` mean and stood
                  // unguarded until now.
                  assertRowsWithinPayout(apart, `${where} apart`);
                  assertRowsWithinPayout(combined, `${where} combined`);
                }
              }
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

test('a DisplayReservation reaching the whole depth reports an unclaimedRemainder instead of losing the ShapedRemainder silently (#56 resolution on #56, 2026-09-27)', () => {
  // Weekend, 32 Players, rank.booster 64 throughout — settledCount == depth
  // in all three stands, so curveCount is 0 and the curve has no Rank left
  // to receive the ShapedRemainder. Row sum 24 of 64 in every case.
  const oneDeep = distribute(weekendSettings({ players: 32, depth: 1, displays: [1] }));
  assert.equal(oneDeep.rank.booster, 64);
  assert.equal(oneDeep.settledCount, 1);
  assert.equal(oneDeep.curveCount, 0);
  assert.deepEqual(oneDeep.unclaimedRemainder, { depth: 1 });
  assert.deepEqual(served(oneDeep), [24]);

  const twoDeep = distribute(
    weekendSettings({ players: 32, depth: 2, displays: [2, 1], displaySize: 8 }),
  );
  assert.equal(twoDeep.rank.booster, 64);
  assert.equal(twoDeep.settledCount, 2);
  assert.equal(twoDeep.curveCount, 0);
  assert.deepEqual(twoDeep.unclaimedRemainder, { depth: 2 });
  assert.deepEqual(served(twoDeep), [16, 8]);

  const threeDeep = distribute(
    weekendSettings({ players: 32, depth: 3, displays: [3, 2, 1], displaySize: 4 }),
  );
  assert.equal(threeDeep.rank.booster, 64);
  assert.equal(threeDeep.settledCount, 3);
  assert.equal(threeDeep.curveCount, 0);
  assert.deepEqual(threeDeep.unclaimedRemainder, { depth: 3 });
  assert.deepEqual(served(threeDeep), [12, 8, 4]);
});

test('a DisplayReservation that does not reach the whole depth is not reported — the curve still has a Rank left', () => {
  // Same sheet, same rank.booster 64, but d = (1) at depth 2: settledCount 1
  // stays below depth 2, so Rank 2 is still in the curve and the ShapedRemainder
  // lands there instead of going unclaimed. 24 and 40, together the full 64.
  const plan = distribute(weekendSettings({ players: 32, depth: 2, displays: [1] }));
  assert.equal(plan.rank.booster, 64);
  assert.equal(plan.settledCount, 1);
  assert.equal(plan.curveCount, 1);
  assert.equal(plan.unclaimedRemainder, null);
  assert.deepEqual(served(plan), [24, 40]);
});

// #56: the conflict branch and the orphaned reservation.

test('a pinned depth over the cap reports a conflict, pours from the top and never exceeds the RankPool', () => {
  // players 32, boosterRate 3, participationBooster 1, rankFloor 2: rank.booster
  // 64, depthCap 31 (2·31 + 1 = 63 fits, 2·32 + 1 = 65 does not — the same
  // stand as "the same stand without a set depth gives a depthCap of 31").
  // Pinning depth to 32 needs 65 out of a RankPool of 64: need > have by 1.
  const plan = distribute(
    settings({
      players: 32,
      boosterRate: 3,
      participationBooster: 1,
      rankFloor: 2,
      depth: 32,
      curve: 'steep',
    }),
  );
  assert.equal(plan.depth, 32); // the pinned value stands, uncut by the cap
  assert.equal(plan.depthCap, 31);
  assert.deepEqual(plan.conflict, { need: 65, have: 64 });
  assert.equal(plan.shapedRemainder, 0);
  assert.equal(plan.unclaimedRemainder, null); // curveCount is 32, not 0 — a different fact
  assert.equal(unfit(plan), true);

  // Poured from the top: Rank 1 gets its lead plus floor (3), Ranks 2-31 get
  // their floor in full (2 each), and Rank 32 — last in line — gets only what
  // is left (1 of 2). Nobody after Rank 32 exists to show the shortfall further.
  const rows = served(plan);
  assert.equal(rows.length, 32);
  assert.equal(rows[0], 3);
  assert.ok(rows.slice(1, 31).every((b) => b === 2));
  assert.equal(rows[31], 1);
  assert.deepEqual(plan.flagged, [32]); // exactly the one Rank short of its quota

  // The row sum never exceeds the RankPool, and here it exhausts it exactly.
  assert.equal(
    plan.rows.reduce((a, row) => a + row.booster, 0),
    plan.rank.booster,
  );
});

test('a DisplayReservation alone bigger than the RankPool still never hands out more than the pool holds', () => {
  // 8 Players, boosterRate 1: rank.booster 8. displaySize 24 reserves 24 for
  // the one settled Rank alone — the reservation by itself already outweighs
  // the whole RankPool, and depth 1 also settles the whole depth.
  const plan = distribute(
    settings({
      players: 8,
      boosterRate: 1,
      rankFloor: 2,
      displaySize: 24,
      displays: [1],
      depth: 1,
    }),
  );
  assert.equal(plan.rank.booster, 8);
  assert.equal(plan.settledCount, 1);
  assert.equal(plan.curveCount, 0);
  assert.deepEqual(served(plan), [8]); // the pool's 8, not the pinned 24
  assert.equal(
    plan.rows.reduce((a, row) => a + row.booster, 0),
    plan.rank.booster,
  );
  assert.equal(plan.shapedRemainder, 0);
  assert.deepEqual(plan.flagged, [1]);

  // The open point from #56's third comment: a depth-covering reservation
  // (unclaimedRemainder) and a real shortfall (conflict) can hold of the same
  // plan at once — here, because the reservation alone already exceeds the
  // pool while also settling the whole depth. Decision 3 in the comment "Drei
  // Entscheide aus der Fragebogenrunde" on #56, 2026-09-27, and in the ADR
  // 0002 Nachtrag: the two stand side by side rather than excluding one
  // another — both are true facts about this plan, and hiding either would be
  // exactly the silent loss ADR 0002 is written against. Reconciling this into
  // one or two displayed notices is left to Spec 2's NoticeStack.
  assert.deepEqual(plan.conflict, { need: 0, have: -16 });
  assert.deepEqual(plan.unclaimedRemainder, { depth: 1 });
  assert.equal(unfit(plan), true);
});

test('a reservation below the depth is orphaned, reported and makes the plan unfit — the curve arithmetic stays untouched', () => {
  // 5 Players, boosterRate 1: rank.booster 5. displays[2] = 3 sits on Rank 3,
  // which depth 2 does not serve — a promise the plan cannot keep. The
  // reservation condition at depth 2 itself holds exactly (available 5,
  // floorNeed 5), so this is the orphaned reservation alone, nothing else.
  const plan = distribute(
    settings({
      players: 5,
      boosterRate: 1,
      rankFloor: 2,
      displaySize: 1,
      depth: 2,
      displays: [0, 0, 3],
    }),
  );
  assert.equal(plan.rank.booster, 5);
  assert.deepEqual(plan.orphanedReservation, { ranks: [3] });
  assert.equal(plan.conflict, null);
  assert.equal(plan.overtake, null);
  assert.equal(plan.unclaimedRemainder, null);
  assert.equal(unfit(plan), true);
  assert.deepEqual(served(plan), [3, 2]); // depth 2's own arithmetic is unaffected
});

test('unfit is true for exactly conflict, overtake, orphanedReservation and the depth-covering reservation, and false otherwise', () => {
  // Conflict alone: the pinned-depth-over-the-cap stand above.
  const conflictOnly = distribute(
    settings({ players: 32, boosterRate: 3, participationBooster: 1, rankFloor: 2, depth: 32, curve: 'steep' }),
  );
  assert.ok(conflictOnly.conflict);
  assert.equal(conflictOnly.overtake, null);
  assert.equal(conflictOnly.orphanedReservation, null);
  assert.equal(conflictOnly.unclaimedRemainder, null);
  assert.equal(unfit(conflictOnly), true);

  // Overtake alone: Weekend 48 with d = (1) (#55).
  const overtakeOnly = distribute(weekendSettings({ players: 48, displays: [1] }));
  assert.equal(overtakeOnly.conflict, null);
  assert.ok(overtakeOnly.overtake);
  assert.equal(overtakeOnly.orphanedReservation, null);
  assert.equal(overtakeOnly.unclaimedRemainder, null);
  assert.equal(unfit(overtakeOnly), true);

  // Orphaned reservation alone: the stand above.
  const orphanedOnly = distribute(
    settings({ players: 5, boosterRate: 1, rankFloor: 2, displaySize: 1, depth: 2, displays: [0, 0, 3] }),
  );
  assert.equal(orphanedOnly.conflict, null);
  assert.equal(orphanedOnly.overtake, null);
  assert.ok(orphanedOnly.orphanedReservation);
  assert.equal(orphanedOnly.unclaimedRemainder, null);
  assert.equal(unfit(orphanedOnly), true);

  // The depth-covering reservation alone: Weekend 32 with d = (1) at depth 1 (#55).
  const unclaimedOnly = distribute(weekendSettings({ players: 32, depth: 1, displays: [1] }));
  assert.equal(unclaimedOnly.conflict, null);
  assert.equal(unclaimedOnly.overtake, null);
  assert.equal(unclaimedOnly.orphanedReservation, null);
  assert.ok(unclaimedOnly.unclaimedRemainder);
  assert.equal(unfit(unclaimedOnly), true);

  // A clean plan: none of the four, and unfit is false.
  const clean = distribute(
    settings({ players: 32, boosterRate: 3, participationBooster: 1, rankFloor: 2, depth: 8, curve: 'steep' }),
  );
  assert.equal(clean.conflict, null);
  assert.equal(clean.overtake, null);
  assert.equal(clean.orphanedReservation, null);
  assert.equal(clean.unclaimedRemainder, null);
  assert.equal(unfit(clean), false);
});

/**
 * ADR 0009: the plan carries its slider stands, as **one** field and
 * **untrimmed**. `displayVector` is not that field — it is cut to the depth,
 * and it is exactly the Rank the cut removes that a way out has to clear.
 */
test('the plan carries its slider stands untrimmed, where displayVector is cut to the depth', () => {
  const input = settings({ players: 5, boosterRate: 1, rankFloor: 2, displaySize: 1, depth: 2, displays: [2, 1, 1] });
  const plan = distribute(input);
  assert.deepEqual(plan.displayVector, [2, 1], 'displayVector stops at the depth');
  assert.deepEqual(plan.settings.displays, [2, 1, 1], 'plan.settings keeps the third Rank');
  assert.deepEqual(plan.settings, input, 'every stand of the input is carried, none of them changed');
});

test('the carried stands recompute the plan they came from, and are a snapshot rather than the caller object', () => {
  const input = settings({ players: 8, boosterRate: 3, displays: [1] });
  const plan = distribute(input);
  assert.deepEqual(distribute(plan.settings), plan, 'the plan is reproducible from what it carries');
  assert.notEqual(plan.settings, input, 'the plan holds a copy, so a later edit of the input cannot contradict it');
  input.displays.push(1);
  input.players = 48;
  assert.deepEqual(plan.settings.displays, [1]);
  assert.equal(plan.settings.players, 8);
});

/**
 * The addendum (#86) to ADR 0009: beside the resolved stand the plan carries
 * the sliders that were set **by hand**, so the copy button of #72 and the
 * address line of #89 take what the plan states as set instead of knowing a
 * rule. This block is the shape those two build against.
 */
test('plan.pinned holds the hand-set sliders alone, key by key, and nothing that was inherited', () => {
  const pins = { players: 48, curve: 'flat', displays: [2, 1] };
  const resolved = resolveSettings({ game: GAME, type: TOURNAMENT_TYPES[0], pins });
  const plan = distribute(resolved, pins);

  assert.deepEqual(plan.pinned, pins, 'exactly the pins, key for key');
  assert.equal(plan.pinned.rankFloor, undefined, 'an inherited slider is absent, and absent is the information');
  // The agreement the caller gets for free: the resolved stand was built from
  // these very pins, so the two can never state different values.
  for (const [key, value] of Object.entries(plan.pinned)) assert.deepEqual(plan.settings[key], value, key);
});

/**
 * Finding G3, as a measurement rather than a warning: `encode(plan.settings)`
 * is the line that must never be written. The resolved stand names *every*
 * slider, so it would turn these three pins into nineteen claims — and one of
 * the nineteen, `depthStep`, has no key in the wire register at all and would
 * go missing without a word.
 */
test('the resolved stand names every slider while plan.pinned names only the hand-set ones', () => {
  const pins = { players: 48, curve: 'flat', displays: [2, 1] };
  const plan = distribute(resolveSettings({ game: GAME, type: TOURNAMENT_TYPES[0], pins }), pins);

  assert.equal(Object.keys(plan.pinned).length, 3);
  assert.ok(
    Object.keys(plan.settings).length > Object.keys(plan.pinned).length,
    'the stand is the wider of the two, which is why it is the wrong one to encode',
  );
  assert.ok('depthStep' in plan.settings, 'the stand carries depthStep');
  assert.equal('depthStep' in plan.pinned, false, 'the pins do not, and the wire register has no key for it');
});

test('a plan computed without pins states that nothing was set by hand, rather than stating nothing', () => {
  const plan = distribute(settings({ players: 8, boosterRate: 3 }));
  assert.deepEqual(plan.pinned, {}, 'the freshly opened app: base plus no deviations');
  assert.deepEqual(distribute(settings({ players: 8, boosterRate: 3 }), undefined).pinned, {});
  assert.deepEqual(distribute(settings({ players: 8, boosterRate: 3 }), null).pinned, {});
});

test('the pins change no number in the plan — provenance is carried, not computed with', () => {
  const input = settings({ players: 8, boosterRate: 3, rankFloor: 1, displays: [1] });
  const bare = distribute(input);
  const pinned = distribute(input, { players: 8, rankFloor: 1 });
  assert.deepEqual({ ...pinned, pinned: undefined }, { ...bare, pinned: undefined });
});

test('a pin is kept even where it matches the value it would have inherited (ADR 0006)', () => {
  const type = TOURNAMENT_TYPES[0];
  const inherited = resolveSettings({ game: GAME, type, pins: {} });
  const pins = { rankFloor: inherited.rankFloor };
  const plan = distribute(resolveSettings({ game: GAME, type, pins }), pins);
  assert.deepEqual(plan.pinned, pins, 'a pin is a stored state, not a comparison against the DefaultSet');
});

test('the pins are a snapshot too, and plan plus pins recompute the plan', () => {
  const input = settings({ players: 8, boosterRate: 3, displays: [1] });
  const pins = { players: 8, displays: [1] };
  const plan = distribute(input, pins);

  assert.deepEqual(distribute(plan.settings, plan.pinned), plan, 'a plan is reproducible from both its fields');
  assert.notEqual(plan.pinned, pins);
  pins.displays.push(1);
  pins.curve = 'flat';
  assert.deepEqual(plan.pinned, { players: 8, displays: [1] });
});
