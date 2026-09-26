/**
 * The core: Settings in, a DistributionPlan out. No DOM, no state, no clock,
 * no randomness (ADR 0004), and total over every input combination (ADR 0002).
 *
 * This file carries the pools and the sum rule, the RankPoolDepth with its
 * computed cap, the DisplayReservation with its settlement and overtaking
 * (#55), the divisible axis shaped by the DistributionCurve, and the two
 * indivisible axes that run past it — the RankCycle for TournamentPacks and
 * the WinnerPackAllocation for WinnerPacks (#57). The conflict branch and the
 * orphaned reservation (#56) are not here yet: the valid branch clamps a
 * negative ShapedRemainder to 0 rather than pouring from the top, and a
 * reservation past the depth is read as though it were not there.
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
  const shapedRemainder = Math.max(0, available - floorReserved);

  const booster = new Array(players).fill(0);
  for (let i = 0; i < depth; i++) booster[i] += d[i] * displaySize;
  for (let i = curveFrom; i < depth; i++) booster[i] += rankFloor;
  if (lead) booster[0] += 1;

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
  const flagged = overtake ? [overtake.under, overtake.over] : [];

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
    reserved: i < depth ? d[i] * displaySize : 0,
    floor: i < curveFrom || i >= depth ? 0 : rankFloor + (i === 0 ? lead : 0),
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
    allocation,
    rows,
    overtake,
    flagged,
  };
}

/** The geometric weights of the curve: `ratio⁰, ratio¹, …` over the shaped ranks. */
function shapeWeights(ratio, count) {
  return Array.from({ length: count }, (_, j) => ratio ** j);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
