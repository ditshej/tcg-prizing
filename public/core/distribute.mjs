/**
 * The core: Settings in, a DistributionPlan out. No DOM, no state, no clock,
 * no randomness (ADR 0004), and total over every input combination (ADR 0002).
 *
 * This file carries the narrow complete path — the pools and the sum rule, the
 * RankPoolDepth with its computed cap, and the divisible axis shaped by the
 * DistributionCurve. The indivisible axes (#57), the DisplayReservation with
 * its settlement and overtaking (#55), and the conflict branch (#56) are not
 * here yet; `displays` is read for the depth cap and otherwise assumed empty.
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
 * The WinnerPack axis needs the PromoEnvelope and arrives with #57.
 */
export function derivePool(settings) {
  const players = Math.max(2, int(settings.players, 2));
  const booster = Math.max(0, int(settings.boosterRate)) * players;
  const packs = Math.max(0, int(settings.tournamentPacks, players));
  return { booster, packs };
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
  };
  const rank = {
    booster: pool.booster - participation.booster - judge.booster,
    packs: pool.packs - participation.packs,
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
  const d = Array.from({ length: depth }, (_, i) => Math.max(0, int(displays[i])));
  const { settledCount } = settlement(d);
  const reserved = d.reduce((a, b) => a + b, 0) * displaySize;
  const lead = settledCount > 0 ? 0 : 1;
  return reserved + rankFloor * (depth - settledCount) + lead;
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

  const curveCount = depth;
  const lead = 1;
  const floorReserved = rankFloor * curveCount + lead;
  // One condition, two quantities: where it holds the surplus is the
  // ShapedRemainder, where it does not the shortfall is what the
  // ConflictNotice names. The shaped remainder itself never goes negative —
  // in the conflict branch nothing is shaped at all (#56).
  const shapedRemainder = Math.max(0, rank.booster - floorReserved);

  const booster = new Array(players).fill(0);
  for (let i = 0; i < depth; i++) booster[i] += rankFloor;
  booster[0] += lead;

  const weights = shapeWeights(curveRatio(settings.curve), curveCount);
  const shaped = largestRemainder(weights, shapedRemainder);
  for (let j = 0; j < curveCount; j++) booster[j] += shaped[j];

  const rows = Array.from({ length: players }, (_, i) => ({
    rank: i + 1,
    booster: booster[i],
    floor: i < depth ? rankFloor + (i === 0 ? lead : 0) : 0,
    served: i < depth,
  }));

  return {
    players,
    pool,
    participation,
    judge,
    rank,
    depth,
    depthCap,
    depthStepValue,
    rankFloor,
    floorReserved,
    shapedRemainder,
    curveSilent: shapedRemainder === 0,
    curveCount,
    rows,
  };
}

/** The geometric weights of the curve: `ratio⁰, ratio¹, …` over the shaped ranks. */
function shapeWeights(ratio, count) {
  return Array.from({ length: count }, (_, j) => ratio ** j);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
