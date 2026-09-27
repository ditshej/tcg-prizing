import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute } from '../public/core/distribute.mjs';

/**
 * The sum rule as a property (#58), not as an assertion at one measured stand.
 *
 * The rule is the hard one from `AGENTS.md` and `CONTEXT.md`: the sum over all
 * `Pool`s gives the `PrizePool` down to the last `PrizeItem`, per axis, exact
 * and without tolerance. It binds the **`Pool` level, not the recipient
 * level** — a `WinnerPack` that stays `open` and the `JudgePool` are part of
 * the sum, never a loss — and this file is built around that distinction: the
 * recipient level is checked too, but only with `open`, the `JudgePool` and
 * the `unclaimedRemainder` named as terms of the same equation.
 *
 * Two sweeps, both plain cartesian products so a failure names one
 * combination and not a seed: the divisible axis with everything that shapes
 * it (player count, rates, `RankFloor`, depth, curve step, reservation
 * vector, `displaySize`), and the two indivisible axes with the envelope
 * numbers, the `WinnerPackAllocation` and the `RankCycle`. Both run both
 * `CombinedHandout` branches, because the shift moves numbers between the two
 * levels the rule connects.
 *
 * Nothing is skipped. The conflict branch used to be held out over
 * `rank.booster < displayReserved + floorReserved`; since #56 pours the
 * `RankPool` from the top the row sum is exhaustive there as well, so the
 * branch is swept like any other stand and carries one extra assertion of its
 * own — the rows never exceed the `RankPool`.
 *
 * ## How the grid was cut down (decision K5 at #58)
 *
 * The two sweeps ran over 116 064 stands once, and that cost `node --test`
 * about 1 230 ms of its 1 520 ms — in every run, in every session. They now
 * run over **1 024 stands**, 512 each, and the acceptance criterion ("at least
 * a few hundred combinations") still holds. The cut was made in two steps, and
 * it is written down here because this is the spot the next session would
 * otherwise have to guess at:
 *
 *  1. **Every axis keeps two values: the one that switches its feature off and
 *     the one that pushes it past a boundary.** The interior values went —
 *     `players` 5 and 32, `boosterRate` 1 and 12, `rankFloor` 8, `depth` 1 and
 *     3, `curve` 'steep', the short reservation vectors `[1]`, `[2,1]`,
 *     `[1,1]`, and so on. Measured against the full grid, none of them
 *     produced a state the two surviving ends do not. The one vector kept,
 *     `[3,2,1,0,…,0,2]`, is the one that carries a Display at Rank 10 past
 *     every depth in the sweep — it is where the orphaned reservations come
 *     from, and dropping it would empty four of the five states at once.
 *  2. **One axis per sweep is then held at a single value**, so the product
 *     lands near a thousand instead of near two: `rankFloor` at 2 in the
 *     divisible sweep, `participationPack` at 4 in the indivisible one. Both
 *     were picked by measurement, not by taste: they are the axes whose two
 *     values left every count of the tally below identical, so holding one of
 *     them costs the least coverage that can be shown. The value kept is the
 *     one that leaves the feature switched *on* — a term at 0 proves less
 *     about a sum rule than a term that carries something. For
 *     `participationPack` the dropped value, 0, is what the divisible sweep
 *     runs at throughout; for `rankFloor` the dropped value, 0, is genuinely
 *     gone from the sweep, and that is the one piece of coverage this cut
 *     paid with.
 *
 * The cut was then checked against the coverage, not assumed: all five states
 * (`conflict`, `overtake`, `orphanedReservation`, `unclaimedRemainder`,
 * `negativeHave`) still occur in the small grid, both `CombinedHandout`
 * branches run in both sweeps, and the over-assigned `WinnerPack` branch
 * survives in the indivisible one. The tally test below is what holds that in
 * place: it would go red the moment a further cut emptied one of them.
 */

/** A neutral Settings object; every sweep axis is an override on top of it. */
function settings(overrides = {}) {
  return {
    players: 32,
    boosterRate: 3,
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

/**
 * The cartesian product of an axis map, as `{ overrides, where }` pairs. The
 * label is the combination itself: an acceptance criterion of #58 is that a
 * failure names the stand it failed at, and the cheapest way to keep that
 * promise is to carry the stand along rather than reconstruct it.
 */
function* combinations(axes) {
  const keys = Object.keys(axes);
  const counters = new Array(keys.length).fill(0);
  for (;;) {
    const overrides = {};
    for (let k = 0; k < keys.length; k++) overrides[keys[k]] = axes[keys[k]][counters[k]];
    yield { overrides, where: JSON.stringify(overrides) };
    let k = keys.length - 1;
    while (k >= 0) {
      counters[k]++;
      if (counters[k] < axes[keys[k]].length) break;
      counters[k] = 0;
      k--;
    }
    if (k < 0) return;
  }
}

/** A running count of the states a sweep actually produced. */
function newTally() {
  return {
    total: 0,
    conflict: 0,
    overtake: 0,
    orphanedReservation: 0,
    unclaimedRemainder: 0,
    negativeHave: 0,
    overAssignedWinners: 0,
  };
}

const sumOf = (plan, key) => plan.rows.reduce((a, row) => a + row[key], 0);

/**
 * The `ShapedRemainder` nobody claims (#55/#56). It is still part of the
 * `PrizePool` — the decision was to report it, not to redistribute it — so it
 * enters the sum rule as a **term**, on top of the row sum. A tolerance would
 * say something else entirely: that a few `Booster` may go missing.
 */
const unclaimed = (plan) => (plan.unclaimedRemainder ? plan.shapedRemainder : 0);

/**
 * Every numeric leaf of the plan, with its path, so a negative one can be
 * named rather than merely counted.
 */
function numericLeaves(value, path, out) {
  if (typeof value === 'number') {
    out.push([path, value]);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, i) => numericLeaves(entry, `${path}[${i}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) numericLeaves(entry, `${path}.${key}`, out);
  }
  return out;
}

/**
 * The whole property, on one plan.
 *
 * Every quantity is read off the plan that was just computed — none of the
 * three levels may be restated from the Settings, or the check would prove
 * its own arithmetic instead of the core's.
 */
function assertSumRule(plan, where, tally) {
  tally.total++;
  if (plan.conflict) tally.conflict++;
  if (plan.overtake) tally.overtake++;
  if (plan.orphanedReservation) tally.orphanedReservation++;
  if (plan.unclaimedRemainder) tally.unclaimedRemainder++;
  if (plan.conflict && plan.conflict.have < 0) tally.negativeHave++;

  // ---- The Pool level: the rule itself, per PrizeItem axis. ----------------
  assert.equal(
    plan.participation.booster + plan.judge.booster + plan.rank.booster,
    plan.pool.booster,
    `Booster pools against the PrizePool at ${where}`,
  );
  // The JudgePool never touches TournamentPacks, so its term is 0 by
  // construction and the plan carries no field for it. Named anyway: leaving
  // a term out silently is how the CombinedHandout double count got through
  // once already (dev/bench.mjs, the second invariant).
  assert.equal(
    plan.participation.packs + (plan.judge.packs ?? 0) + plan.rank.packs,
    plan.pool.packs,
    `TournamentPack pools against the PrizePool at ${where}`,
  );
  assert.equal(
    (plan.participation.winners ?? 0) + plan.judge.winners + plan.rank.winners,
    plan.pool.winners,
    `WinnerPack pools against the PrizePool at ${where}`,
  );

  // ---- The recipient level, tied back to the Pool level. -------------------
  // `open` WinnerPacks, the JudgePool and the unclaimed ShapedRemainder stand
  // *inside* these equations. That is the whole point of the Pool/recipient
  // distinction: a PrizeItem without a recipient is filed, not lost.
  assert.equal(
    sumOf(plan, 'booster') + unclaimed(plan),
    plan.rank.booster,
    `rank rows against the RankPool Booster at ${where}`,
  );
  assert.equal(sumOf(plan, 'packs'), plan.rank.packs, `rank rows against the RankPool TournamentPacks at ${where}`);

  const assignedWinners = plan.allocation.ranked + plan.allocation.manualCount;
  if (assignedWinners <= plan.rank.winners) {
    assert.equal(
      sumOf(plan, 'winners') + plan.allocation.open,
      plan.rank.winners,
      `rank rows plus open against the RankPool WinnerPacks at ${where}`,
    );
  } else {
    // `manual` is free over the whole Ranking and the core clamps `open` at 0
    // without checking it — the cap on `ranked + manualCount` is a cap at the
    // control and belongs to Spec 2 (#46, "WinnerPackAllocation"). So this is
    // not an exception to the rule but a stand in which the Settings promise
    // more WinnerPacks than the RankPool holds; the core's documented answer
    // is exactly this, and the rule at the Pool level above still holds.
    tally.overAssignedWinners++;
    assert.equal(plan.allocation.open, 0, `open WinnerPacks over-assigned at ${where}`);
    assert.ok(
      sumOf(plan, 'winners') > plan.rank.winners,
      `over-assignment does not show at the recipient level at ${where}`,
    );
  }

  // ---- The rule spelled out from the PrizePool to the last recipient. ------
  assert.equal(
    plan.participation.booster + plan.judge.booster + sumOf(plan, 'booster') + unclaimed(plan),
    plan.pool.booster,
    `Booster from the PrizePool to the rows at ${where}`,
  );
  assert.equal(
    plan.participation.packs + (plan.judge.packs ?? 0) + sumOf(plan, 'packs'),
    plan.pool.packs,
    `TournamentPacks from the PrizePool to the rows at ${where}`,
  );
  if (assignedWinners <= plan.rank.winners) {
    assert.equal(
      plan.judge.winners + sumOf(plan, 'winners') + plan.allocation.open,
      plan.pool.winners,
      `WinnerPacks from the PrizePool to the rows at ${where}`,
    );
  }

  // ---- The second bound, in the conflict branch. ---------------------------
  // Implied by the equality above, and asserted separately all the same: it is
  // the bound #56 was built for — a DisplayReservation the RankPool no longer
  // carries must not pay out — and an acceptance criterion of this ticket. If
  // the equality above ever loosens, this line still holds the roof up.
  if (plan.conflict) {
    assert.ok(
      sumOf(plan, 'booster') <= plan.rank.booster,
      `the rank rows hand out ${sumOf(plan, 'booster')} of a RankPool of ${plan.rank.booster} at ${where}`,
    );
  }

  // ---- No negative number where the plan pays out. -------------------------
  // `plan.conflict.have` is exempt, and it is the only exemption: it is
  // `available = rankB − reservedB`, carried outright as a reported fact and
  // not as a bound (#58's comment, measured over 45 360 states; the same
  // exemption dev/bench.mjs made in PR #82). A reservation that by itself
  // outweighs the RankPool makes it negative, on purpose. Every other leaf is
  // a count or a payout and a negative one there is a breach.
  const negatives = numericLeaves(plan, 'plan', []).filter(([, value]) => value < 0);
  const unexpected = negatives.filter(([path]) => path !== 'plan.conflict.have');
  assert.deepEqual(unexpected, [], `negative numbers in the plan at ${where}`);
}

/**
 * The divisible axis and everything that shapes it.
 *
 * `displays` and `depth` are varied, and that is the point of the ticket:
 * without them the old property was green while 40 of 64 Booster disappeared
 * (#46, comment of 2026-09-27). The last reservation vector carries a Display
 * at Rank 10, past every depth in the sweep — that is where the orphaned
 * reservations come from. A pinned depth of 40 is over the cap at every
 * player count here, and `boosterRate` 0 empties the RankPool outright: both
 * reach the conflict branch without anybody pinning something absurd.
 *
 * `depthStep` is held at `all` deliberately rather than swept: it reaches the
 * plan only through `depth = min(rangeSize(step), depthCap)`, and `depth` is
 * varied directly — including a pinned value far over the cap, which no step
 * can produce. Sweeping it would double the run for one extra value of one
 * derived number. `rangeSize` itself has its own tests (test/rules.test.mjs).
 *
 * `rankFloor` is the one axis held at a single value here (step 2 of the cut
 * above). 2 is the neutral Settings value, and it keeps the `RankFloor`
 * reservation switched *on* for all 512 stands. `rankFloor` 0 is thereby out of
 * the sweep altogether — the price named in step 2 of the cut. What still
 * covers it: `test/distribute.test.mjs` pins stands at `rankFloor` 0 and 5
 * outright, and every stand here in which the `RankPool` is too small for the
 * floor anyway (`boosterRate` 0) reaches the same starved branch from the
 * other side.
 */
const DIVISIBLE_AXES = {
  players: [2, 8],
  boosterRate: [0, 3],
  participationBooster: [0, 12],
  judgeBooster: [0, 40],
  rankFloor: [2],
  depth: [null, 40],
  curve: ['gentle', 'extreme'],
  displays: [[], [3, 2, 1, 0, 0, 0, 0, 0, 0, 2]],
  displaySize: [1, 24],
  combinedHandout: [false, true],
};

/**
 * The two indivisible axes (#57) and the PromoEnvelope numbers behind the
 * WinnerPacks. Held at one player count per row of the product is not enough
 * here — the RankCycle wraps on the player count and the `ranked` prefix is
 * clamped by it — so `players` is an axis of this sweep too.
 *
 * `participationPack` is the axis held at a single value here (step 2 of the
 * cut above), at 4 rather than 0, so the participation term of the
 * `TournamentPack` equation carries something in every one of the 512 stands.
 * The dropped value is covered where it costs nothing: the divisible sweep
 * runs `participationPack` 0 throughout.
 *
 * `null` is kept on every axis that has it, and it is not a third value
 * smuggled past step 1: `tournamentPacks`, `winnerPacks` and `ranked` read
 * `null` as "derive it", which is a different code path, not a smaller number.
 */
const INDIVISIBLE_AXES = {
  players: [2, 32],
  tournamentPacks: [null, 40],
  participationPack: [4],
  envelopeSize: [1, 24],
  envelopeYield: [1, 8],
  winnerPacks: [null, 30],
  judgeWinner: [0, 100],
  ranked: [null, 3],
  manualWinner: [{}, { 3: 2, 7: 1 }],
  combinedHandout: [false, true],
};

/**
 * Runs a sweep and hands back what it saw — once per axis map, because the
 * coverage test below asks the same two sweeps the same question again and a
 * property test that runs twice is a batch job, not a test.
 */
const SWEPT = new Map();
function sweep(axes) {
  if (SWEPT.has(axes)) return SWEPT.get(axes);
  const tally = newTally();
  for (const { overrides, where } of combinations(axes)) {
    assertSumRule(distribute(settings(overrides)), where, tally);
  }
  SWEPT.set(axes, tally);
  return tally;
}

test('the sum rule holds per PrizeItem axis over the divisible axis and everything that shapes it', () => {
  const tally = sweep(DIVISIBLE_AXES);
  assert.equal(tally.total, 512);
});

test('the sum rule holds per PrizeItem axis over the two indivisible axes and the envelope numbers', () => {
  const tally = sweep(INDIVISIBLE_AXES);
  assert.equal(tally.total, 512);
});

test('the sweep reaches conflict, overtaking, an orphaned reservation and a reservation covering the depth', () => {
  // The coverage claim of #58's second acceptance criterion, counted rather
  // than asserted: a sweep that happens to contain no orphaned reservation
  // passes a careless reading of that line. The numbers are exact on purpose
  // — they are a property of the sweep above plus the core's classification
  // of the four unfit states, and a change in either should be looked at
  // rather than absorbed.
  //
  // ## Where these five numbers come from, and what to do when they fail
  //
  // They were read off the core at **f33439f** (the merge of #82 on `main`),
  // over the 1 024-stand grid this file sweeps since decision K5 at #58. That
  // was the *last* time they were won from the core: the cut of the grid moved
  // them once, and with that they are decided. They are filed in a comment on
  // #58 alongside the core stand and the grid size, because `review/` is
  // gitignored and this file alone is not a place anyone looks things up.
  //
  // **They are carried forward, never adjusted.** When this test goes red
  // because the core changed, the question is *not* "which number makes it
  // green" — it is **"was that shift intended?"**. Answer that first, out of
  // the ticket that changed the core; only a yes earns a new number, and the
  // new number goes back onto #58 with its own core stand. Whoever recomputes
  // from the new core instead has switched the tripwire off and made it look
  // green — the pattern that has already cost this repo two sessions (#20,
  // #54). Their whole value is that they have not moved since a named stand.
  //
  // This is deliberately a tripwire, not a bound: a core change that keeps the
  // sum rule perfectly intact and only shifts one boundary moves `conflict`
  // off 464, and the test falls. That is the test working.
  const divisible = sweep(DIVISIBLE_AXES);
  assert.deepEqual(
    {
      conflict: divisible.conflict,
      overtake: divisible.overtake,
      orphanedReservation: divisible.orphanedReservation,
      unclaimedRemainder: divisible.unclaimedRemainder,
      negativeHave: divisible.negativeHave,
    },
    {
      conflict: 464,
      overtake: 8,
      orphanedReservation: 256,
      unclaimedRemainder: 188,
      negativeHave: 240,
    },
  );

  const indivisible = sweep(INDIVISIBLE_AXES);
  // The indivisible sweep leaves the reservation vector empty, so it is the
  // WinnerPackAllocation it has to cover: states where every WinnerPack finds
  // a recipient, and states where `manual` promises more than the RankPool
  // holds and `open` is clamped at 0.
  assert.ok(indivisible.overAssignedWinners > 0, 'no over-assigned WinnerPack stand in the sweep');
  assert.equal(indivisible.overAssignedWinners, 64);
  assert.equal(indivisible.total - indivisible.overAssignedWinners, 448);
});

test('a negative conflict.have is the one exemption, and the sweep really produces it', () => {
  // The trap #58's comment defuses, pinned at a single stand so the exemption
  // in `assertSumRule` is not merely asserted in prose: `d` = (1) at a
  // `displaySize` of 24 reserves 24 Booster out of a RankPool of 0.
  const plan = distribute(settings({ players: 8, boosterRate: 0, displays: [1], displaySize: 24 }));
  assert.equal(plan.conflict.have, -24);
  assert.equal(plan.rows.reduce((a, row) => a + row.booster, 0), 0);
  const negatives = numericLeaves(plan, 'plan', []).filter(([, value]) => value < 0);
  assert.deepEqual(negatives.map(([path]) => path), ['plan.conflict.have']);
});
