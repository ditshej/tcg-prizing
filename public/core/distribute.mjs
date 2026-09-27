/**
 * The core: Settings in, a DistributionPlan out. No DOM, no state, no clock,
 * no randomness (ADR 0004), and total over every input combination (ADR 0002).
 *
 * This file carries the pools and the sum rule, the RankPoolDepth with its
 * computed cap, the DisplayReservation with its settlement and overtaking
 * (#55), the divisible axis shaped by the DistributionCurve, and the two
 * indivisible axes that run past it — the RankCycle for TournamentPacks and
 * the WinnerPackAllocation for WinnerPacks (#57). A DisplayReservation that
 * settles the whole depth reports `unclaimedRemainder` instead of quietly
 * dropping the ShapedRemainder (#55, folded into `unfit` by #56).
 *
 * The conflict branch (#56) pours the RankPool from the top — reservation,
 * then the Rank 1 lead, then the RankFloor — instead of clamping a negative
 * ShapedRemainder to 0 and pretending the rows still add up. A reservation
 * past the depth is reported as `orphanedReservation` rather than read as
 * though it were not there. `unfit()` is the shared predicate over all four
 * ways a plan can be reported instead of refused.
 */

import { curveRatio, largestRemainder, rangeSize } from './rules.mjs';

/** Reads a settings field as a whole number, with a fallback for an absent one. */
function int(value, fallback = 0) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/**
 * The PrizePool, computed in full — there is no stock entry (#3). Exported on
 * its own because the PreparationList needs this half alone (Spec 2).
 *
 * The WinnerPacks fall out of the PromoEnvelope, evenly on the way to the
 * two-thirds mark: at a yield of 1 that is exactly the old single threshold.
 * `winnerPacks` binds the starting value, not the amount — it is a slider in
 * both directions (#29), and `winnersDerived` stays in the plan as the `auto`
 * value.
 */
export function derivePool(settings) {
  const players = Math.max(2, int(settings.players, 2));
  const booster = Math.max(0, int(settings.boosterRate)) * players;
  const packs = Math.max(0, int(settings.tournamentPacks, players));
  const envelopeSize = Math.max(1, int(settings.envelopeSize, 1));
  const yieldPer = Math.max(1, int(settings.envelopeYield, 1));

  const opened = packs % envelopeSize;
  const partialYield = Math.min(yieldPer, Math.floor((3 * yieldPer * opened) / (2 * envelopeSize)));
  const winnersDerived = Math.floor(packs / envelopeSize) * yieldPer + partialYield;
  const winners = Math.max(0, settings.winnerPacks == null ? winnersDerived : int(settings.winnerPacks));
  const thresholds = Array.from({ length: yieldPer }, (_, k) => thresholdAt(k + 1, envelopeSize, yieldPer));

  return { booster, packs, winners, winnersDerived, opened, partialYield, thresholds };
}

/** The number of opened packs at which the k-th WinnerPack starts counting. */
function thresholdAt(k, envelopeSize, yieldPer) {
  return Math.ceil((2 * envelopeSize * k) / (3 * yieldPer));
}

/**
 * Splits the PrizePool into ParticipationPool, JudgePool and RankPool.
 *
 * The sum rule is constructed, not checked: the remainder at each step **is**
 * the ceiling of the next slider (#4), so `participation + judge + rank` is
 * the PrizePool by arithmetic. The order is participation → JudgePool →
 * RankPool as the rest; the JudgePool never touches TournamentPacks.
 */
function splitPool(pool, settings, players) {
  const participationRate = {
    booster: clamp(int(settings.participationBooster), 0, Math.floor(pool.booster / players)),
    packs: clamp(int(settings.participationPack), 0, Math.floor(pool.packs / players)),
  };
  const participation = {
    rate: participationRate,
    booster: participationRate.booster * players,
    packs: participationRate.packs * players,
  };
  const judge = {
    booster: clamp(int(settings.judgeBooster), 0, pool.booster - participation.booster),
    winners: clamp(int(settings.judgeWinner), 0, pool.winners),
  };
  const rank = {
    booster: pool.booster - participation.booster - judge.booster,
    packs: pool.packs - participation.packs,
    winners: pool.winners - judge.winners,
  };
  return { participation, judge, rank };
}

/**
 * How many Boosters a depth of `T` needs out of the RankPool: the reservation
 * condition read as a demand rather than as a test.
 *
 * Settled ranks — those above the topmost tie in the DisplayReservation vector
 * — get exactly their Displays, no RankFloor and no lead. Which ranks those
 * are moves with the depth itself, which is why the cap is computed rather
 * than written closed (ADR 0001, addendum #43).
 */
function needAt(depth, displays, displaySize, rankFloor) {
  const d = displayVector(displays, depth);
  const { settledCount } = settlement(d);
  const reserved = reservedBoosters(d, displaySize);
  const lead = settledCount > 0 ? 0 : 1;
  return reserved + rankFloor * (depth - settledCount) + lead;
}

/** The DisplayReservation read for a given depth: `displays[0 … depth-1]`, missing entries 0. */
function displayVector(displays, depth) {
  return Array.from({ length: depth }, (_, i) => Math.max(0, int(displays[i])));
}

/** The Boosters a DisplayReservation vector reserves outright. */
function reservedBoosters(d, displaySize) {
  return d.reduce((a, b) => a + b, 0) * displaySize;
}

/**
 * The strict prefix of the DisplayReservation vector: the ranks above the
 * topmost tie. A tie means nobody is settled, because only the curve can break
 * it (ADR 0001).
 */
function settlement(d) {
  let k = 0;
  while (k < d.length && d[k] > 0 && (k + 1 === d.length || d[k] > d[k + 1])) k++;
  const settledCount = k > 0 && d[0] > 0 ? k : 0;
  return { settledCount };
}

/** The largest depth the RankPool still carries, at least 1. */
function deriveDepthCap(players, rankBooster, displays, displaySize, rankFloor) {
  for (let depth = players; depth >= 1; depth--) {
    if (needAt(depth, displays, displaySize, rankFloor) <= rankBooster) return depth;
  }
  return 1;
}

/**
 * WinnerPackAllocation: how the WinnerPacks in the RankPool reach recipients.
 * `rankWinners` is the count *after* the JudgePool's cut — the staffel never
 * counts on pieces set aside there, so a Judge WinnerPack shortens the
 * automatic prefix instead of eating into `open` (#29).
 */
function allocateWinners(settings, rankWinners, players) {
  const rankedAuto = Math.min(Math.floor(rankWinners / 2) + 1, rankWinners);
  const ranked = clamp(
    settings.ranked == null ? rankedAuto : int(settings.ranked),
    0,
    Math.min(rankWinners, players),
  );

  const manual = {};
  let manualCount = 0;
  const manualWinner =
    settings.manualWinner && typeof settings.manualWinner === 'object' ? settings.manualWinner : {};
  for (const [rankKey, count] of Object.entries(manualWinner)) {
    const rank = Math.trunc(Number(rankKey));
    const c = Math.max(0, int(count));
    if (rank >= 1 && rank <= players && c > 0) {
      manual[rank] = c;
      manualCount += c;
    }
  }

  const open = Math.max(0, rankWinners - ranked - manualCount);
  return { ranked, rankedAuto, manual, manualCount, open };
}

/**
 * The RankCycle: a circle over all Ranks up to the player count, one
 * TournamentPack per Rank and lap, until the stock is empty. RankPoolDepth
 * does not bound it. It starts at the first Rank after the `ranked` share;
 * `manual` and `open` WinnerPacks never move the start.
 */
function rankCycle(rankPacks, ranked, players) {
  const packs = new Array(players).fill(0);
  const start = ranked >= players ? 0 : ranked;
  for (let g = 0; g < rankPacks; g++) packs[(start + g) % players] += 1;
  return packs;
}

/**
 * Settings → DistributionPlan.
 *
 * `distribute` calls `derivePool` itself and files the result as `plan.pool`:
 * the PrizePool falls out of the Settings rather than standing beside them
 * (ADR 0004, addendum).
 */
export function distribute(settings) {
  const players = Math.max(2, int(settings.players, 2));
  const pool = derivePool(settings);
  const { participation, judge, rank } = splitPool(pool, settings, players);

  const rankFloor = Math.max(0, int(settings.rankFloor));
  const displaySize = Math.max(1, int(settings.displaySize, 1));
  const displays = Array.isArray(settings.displays) ? settings.displays : [];

  const depthStepValue = rangeSize(settings.depthStep, players);
  const depthCap = deriveDepthCap(players, rank.booster, displays, displaySize, rankFloor);
  // A pinned depth is never cut by the cap (ADR 0006) — only by the player
  // count, and that is not a cut in its sense: no slider addresses a Rank
  // beyond the players, and the stored value returns when the count rises.
  const depth =
    settings.depth == null
      ? Math.min(depthStepValue, depthCap)
      : clamp(int(settings.depth, 1), 1, players);

  // The DisplayReservation vector for this depth, and the ranks it settles:
  // the strict prefix above the topmost tie. A settled rank stands on its
  // Displays, gets no RankFloor and carries no lead — the curve runs from
  // there down (ADR 0001, addendum #7 and #43).
  const d = displayVector(displays, depth);
  const { settledCount } = settlement(d);
  const displayReserved = reservedBoosters(d, displaySize);
  const curveFrom = settledCount;
  const curveCount = depth - curveFrom;
  const lead = settledCount > 0 ? 0 : 1;
  const floorReserved = rankFloor * curveCount + lead;
  // One condition, two quantities: where it holds the surplus is the
  // ShapedRemainder, where it does not the shortfall is what the
  // ConflictNotice names. The shaped remainder itself never goes negative —
  // in the conflict branch nothing is shaped at all (#56).
  const available = rank.booster - displayReserved;
  const shapedRaw = available - floorReserved;
  const shapedRemainder = Math.max(0, shapedRaw);
  // The reservation condition read as a fact, not a bound: `need`/`have` are
  // the same two quantities the ShapedRemainder is built from, carried
  // outright so a ConflictNotice never has to re-read other plan fields
  // (same reasoning as `overtake.has`/`.gets`, CONTEXT.md "ShapedRemainder").
  const conflict = shapedRaw < 0 ? { need: floorReserved, have: available } : null;

  // A DisplayReservation that settles every Rank up to the depth
  // (`settledCount === depth`, so `curveCount === 0`) leaves no Rank inside
  // the curve to receive the ShapedRemainder — it is computed above like any
  // other, but nothing in the loop below ever adds it to a row. Reported
  // here as a datum, not redistributed: the rows stay exactly as computed,
  // and #56 folds this into `unfit` instead of re-deriving the condition
  // from `settledCount` and `depth` itself (maintainer decision on #56,
  // 2026-09-27).
  //
  // This can be true at the same time as `conflict` — a reservation that
  // settles the whole depth and by itself outweighs the RankPool is both at
  // once (`displaySize` large enough that `displayReserved > rank.booster`
  // while `settledCount === depth`). The two are left standing side by side
  // rather than made to exclude one another: each names a fact that is true
  // of this plan on its own terms, and ADR 0002 asks that a widerspruchlicher
  // Stand be shown, not tidied into a single story. Reconciling this into one
  // displayed notice — or two — is a NoticeStack question for Spec 2, not a
  // reason to suppress one of two true facts here (open point, #56).
  const unclaimedRemainder = curveCount === 0 ? { depth } : null;

  // A DisplayReservation on a Rank the RankPoolDepth does not serve is a
  // promise the plan cannot keep — reported as `orphanedReservation` rather
  // than read as though it stopped at `depth` (ADR 0002, CONTEXT.md
  // "DisplayReservation").
  const orphanedRanks = [];
  for (let i = depth; i < displays.length; i++) {
    if (Math.max(0, int(displays[i])) > 0) orphanedRanks.push(i + 1);
  }
  const orphanedReservation = orphanedRanks.length > 0 ? { ranks: orphanedRanks } : null;

  // The RankPool poured from the top: DisplayReservation, then the Rank 1
  // lead, then RankFloor — three passes over all served Ranks, not one pass
  // per Rank, because the reservation is the loudest promise and is served
  // in full over every Rank before any floor is paid (CONTEXT.md
  // "ShapedRemainder", the conflict branch). In the valid branch every pass
  // completes and `left` lands on the ShapedRemainder exactly; in the
  // conflict branch the pool runs dry partway through and whatever comes
  // after — later Ranks in the same pass, or a later pass entirely — gets
  // nothing. One algorithm, not two: nothing here reads `conflict` itself.
  //
  // `fromReservation`/`fromFloor` are kept apart from `booster` because the
  // row breakdown (`reserved`, `floor`) reports what actually went out, not
  // the nominal entitlement — the same "pinned value stored, real payout
  // shown" split ADR 0006 already makes for the pinned value itself.
  const booster = new Array(players).fill(0);
  const fromReservation = new Array(players).fill(0);
  const fromFloor = new Array(players).fill(0); // carries the Rank 1 lead too
  let left = rank.booster;
  for (let i = 0; i < depth && left > 0; i++) {
    const give = Math.min(d[i] * displaySize, left);
    fromReservation[i] = give;
    booster[i] += give;
    left -= give;
  }
  if (lead && left > 0) {
    fromFloor[0] += 1;
    booster[0] += 1;
    left -= 1;
  }
  for (let i = curveFrom; i < depth && left > 0; i++) {
    const give = Math.min(rankFloor, left);
    fromFloor[i] += give;
    booster[i] += give;
    left -= give;
  }

  const weights = shapeWeights(curveRatio(settings.curve), curveCount);
  const shaped = largestRemainder(weights, shapedRemainder);
  for (let j = 0; j < curveCount; j++) booster[curveFrom + j] += shaped[j];

  // Overtaking: Rank 1's lead is a guarantee *inside* the curve and lapses the
  // moment a DisplayReservation settles it out of the curve — the first pair
  // i < j < depth with booster[j] > booster[i] is reported, never prevented
  // (ADR 0001, ADR 0002). Compared on the RankPool share alone, before
  // CombinedHandout shifts the participation rate in: that shift adds the
  // same amount to every row, so it can neither create nor hide an overtake.
  let overtake = null;
  outer: for (let i = 0; i < depth; i++) {
    for (let j = i + 1; j < depth; j++) {
      if (booster[j] > booster[i]) {
        overtake = { under: i + 1, over: j + 1, has: booster[i], gets: booster[j] };
        break outer;
      }
    }
  }
  // flagged: the overtake pair, unioned in the conflict branch with every
  // served Rank that did not get its full quota — reservation, lead and
  // floor together (CONTEXT.md "ShapedRemainder"). Measured on `booster`
  // before the CombinedHandout shift, the same rule as overtake: the shift
  // adds the same amount to every row and must not create or hide a flag.
  const conflictFlags = [];
  if (conflict) {
    for (let i = 0; i < depth; i++) {
      const quota = d[i] * displaySize + (i === 0 && lead ? 1 : 0) + (i >= curveFrom ? rankFloor : 0);
      if (booster[i] < quota) conflictFlags.push(i + 1);
    }
  }
  const flagged = [...new Set([...(overtake ? [overtake.under, overtake.over] : []), ...conflictFlags])].sort(
    (a, b) => a - b,
  );

  // The two indivisible axes run past the DistributionCurve (#57): the
  // RankCycle hands out the RankPool's TournamentPacks, and the
  // WinnerPackAllocation says who gets the RankPool's WinnerPacks.
  const allocation = allocateWinners(settings, rank.winners, players);
  const packsCycle = rankCycle(rank.packs, allocation.ranked, players);

  // CombinedHandout shifts the participation shares into the rank rows
  // instead of adding them: the same numbers, differently grouped, so the sum
  // over the PrizePool never changes. The shift runs on both levels at once —
  // every row takes the rate, and on the Pool level the ParticipationPool
  // falls to 0 while the RankPool takes the whole share. Reporting the shares
  // in both places would count the same PrizeItems twice.
  //
  // It runs *after* the shaping, so depth cap, ShapedRemainder and curve read
  // the same RankPool in both branches: how the shares are grouped at handout
  // is not a shaping decision.
  const combinedHandout = !!settings.combinedHandout;
  const pbRate = combinedHandout ? participation.rate.booster : 0;
  const ppRate = combinedHandout ? participation.rate.packs : 0;
  const handedOut = combinedHandout
    ? {
        participation: { rate: participation.rate, booster: 0, packs: 0 },
        rank: {
          booster: rank.booster + participation.booster,
          packs: rank.packs + participation.packs,
          winners: rank.winners,
        },
      }
    : { participation, rank };

  const rows = Array.from({ length: players }, (_, i) => ({
    rank: i + 1,
    booster: booster[i] + pbRate,
    packs: packsCycle[i] + ppRate,
    winners: (i < allocation.ranked ? 1 : 0) + (allocation.manual[i + 1] ?? 0),
    displays: i < depth ? d[i] : 0,
    reserved: i < depth ? fromReservation[i] : 0,
    floor: i < depth ? fromFloor[i] : 0,
    served: i < depth,
    settled: i < curveFrom,
  }));

  return {
    players,
    pool,
    participation: handedOut.participation,
    judge,
    rank: handedOut.rank,
    combinedHandout,
    depth,
    depthCap,
    depthStepValue,
    rankFloor,
    displayVector: d,
    displayReserved,
    settledCount,
    floorReserved,
    shapedRemainder,
    curveSilent: shapedRemainder === 0,
    curveCount,
    unclaimedRemainder,
    allocation,
    rows,
    conflict,
    overtake,
    orphanedReservation,
    flagged,
  };
}

/**
 * The shared predicate over a DistributionPlan (#56): true wherever the
 * NoticeStack has something to show and `suggestions()` (#59) has a way out
 * to search for. Four independent facts feed it — a depth over the cap, an
 * overtake, a reservation past the depth, and a reservation that swallows
 * the whole depth — and it is their plain OR: none of the four is treated as
 * excluding another (see the `unclaimedRemainder` note above for the one
 * case where two can hold of the same plan at once).
 */
export function unfit(plan) {
  return !!plan.conflict || !!plan.overtake || !!plan.orphanedReservation || !!plan.unclaimedRemainder;
}

/** The geometric weights of the curve: `ratio⁰, ratio¹, …` over the shaped ranks. */
function shapeWeights(ratio, count) {
  return Array.from({ length: count }, (_, j) => ratio ** j);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
