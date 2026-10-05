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
 * though it were not there. `unfit()` is the shared predicate over all five
 * ways a plan can be reported instead of refused — the fifth,
 * `combinedHandoutDepth`, came with #103, which also put the whole Booster
 * share through the shaping under CombinedHandout (ADR 0010).
 *
 * Since #86 the plan also carries the Settings it was computed from, as one
 * untrimmed field (ADR 0009) — that is what makes `suggestions(plan)` in
 * `suggest.mjs` buildable at all — and, beside it, the sliders that were set by
 * hand (`plan.pinned`, the addendum (#86) to ADR 0009). `distribute()` itself
 * still keeps no state: the plan carries the input, the function does not
 * (ADR 0002).
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
 *
 * Under CombinedHandout the ParticipationPool is **empty on both axes**
 * (#103, ADR 0010): there is no handout before the tournament, so nothing is
 * set aside for it. The rate is still read and carried — the TournamentPacks
 * hand it to every row flat, and the way out of a `combinedHandoutDepth`
 * turns the Booster rate into the RankFloor — but it takes nothing off the
 * pool, so the JudgePool's ceiling is the whole Booster pool and the
 * RankPool is everything the JudgePool leaves.
 *
 * `cyclePacks` is the TournamentPack share the RankCycle hands out. In the
 * separate branch it is `rank.packs`; under CombinedHandout `rank.packs` also
 * carries the participation share, which reaches the rows as the flat rate
 * and must not run through the cycle a second time.
 */
function splitPool(pool, settings, players, combinedHandout) {
  const participationRate = {
    booster: clamp(int(settings.participationBooster), 0, Math.floor(pool.booster / players)),
    packs: clamp(int(settings.participationPack), 0, Math.floor(pool.packs / players)),
  };
  const participation = {
    rate: participationRate,
    booster: combinedHandout ? 0 : participationRate.booster * players,
    packs: combinedHandout ? 0 : participationRate.packs * players,
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
  const cyclePacks = pool.packs - participationRate.packs * players;
  return { participation, judge, rank, cyclePacks };
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
 * The Settings a plan carries with it (ADR 0009): **one** field holding the
 * input as a whole, not fifteen single copies, and **untrimmed** — `displays`
 * keeps every Rank, including the ones past the depth that `displayVector`
 * drops and that a way out is meant to clear.
 *
 * Nothing here is read, clamped or defaulted. A way out sets one slider on
 * this object and runs `distribute()` again, so a value normalised on the way
 * in would make the probe answer a different question than the one that was
 * asked — and `distribute(plan.settings)` would stop reproducing `plan`.
 *
 * It is a snapshot, not the caller's object: the two mutable containers are
 * copied along, so an edit made after the plan was computed cannot leave the
 * plan carrying an input it was not computed from. That is the whole reason
 * ADR 0009 attaches the input rather than asking every call site to keep it
 * alongside.
 */
function carriedSettings(settings) {
  return snapshot(settings);
}

/**
 * The sliders the CommunityLead set **by hand**, carried beside the resolved
 * stand (addendum (#86) to ADR 0009). Key → value, exactly the keys that were
 * pinned and no others: a slider still following the DefaultSet chain is absent
 * here, and absent is the whole information.
 *
 * This is what a SetupLink is written from. The link carries **base plus
 * deviations** — `v`, `game`, `type` and the pinned sliders, nothing else
 * (ADR 0005, ADR 0006, and the base per the addendum (#44) to ADR 0007) — so
 * the writing side takes this field. **`encode(plan.settings)` is the line that
 * must never be written** (finding G3): the resolved stand names *every*
 * slider, so it turns one pin into twelve, ships twelve decisions nobody made,
 * stops following the next DefaultSet change, and drops `depthStep` silently
 * because the wire format has no key for it and reproduces it from the base
 * instead (`link/keys.mjs`).
 *
 * The core carries this, it does not reconcile it. Nothing is dropped for
 * matching the value it would have inherited — a pin is a stored state, not a
 * comparison (ADR 0006) — nothing is added, nothing is checked against the key
 * register, which belongs to `link/`, and no disagreement with `settings` is
 * refused: `distribute()` stays total (ADR 0002). Callers that build both out
 * of `resolveSettings({ game, type, pins })` get the agreement for free, since
 * the resolved stand is built from these very pins.
 *
 * The base itself — `Game` and `TournamentType` — is deliberately *not* here.
 * The addendum puts only the pinned sliders on the plan; the base stays with
 * the caller, which picked the sheets in the first place.
 */
function carriedPins(pinned) {
  return pinned && typeof pinned === 'object' ? snapshot(pinned) : {};
}

/**
 * A shallow copy that also copies the two containers a Settings field can be:
 * the `displays` vector and the `manualWinner` map. Used for both carried
 * fields, so neither can be changed from outside after the plan was computed.
 */
function snapshot(source) {
  const copy = { ...source };
  if (Array.isArray(source.displays)) copy.displays = source.displays.slice();
  if (source.manualWinner && typeof source.manualWinner === 'object') {
    copy.manualWinner = { ...source.manualWinner };
  }
  return copy;
}

/**
 * Settings → DistributionPlan.
 *
 * `distribute` calls `derivePool` itself and files the result as `plan.pool`:
 * the PrizePool falls out of the Settings rather than standing beside them
 * (ADR 0004, addendum).
 *
 * `pinned` is the second half of the input and changes no number in the plan:
 * which sliders were set by hand is provenance, and the distribution is the
 * same whether a value was pinned or inherited. It is carried so the copy
 * button of #72 and the address line of #89 can take what the plan states as
 * set, instead of knowing a rule — see `carriedPins()`. Omitted it reads as
 * "nothing pinned", the stand a freshly opened app is in.
 */
export function distribute(settings, pinned = {}) {
  const players = Math.max(2, int(settings.players, 2));
  const pool = derivePool(settings);
  const combinedHandout = !!settings.combinedHandout;
  const { participation, judge, rank, cyclePacks } = splitPool(pool, settings, players, combinedHandout);

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
  // (ADR 0001, ADR 0002). Compared on the shaped Booster rows, which are the
  // rows themselves: under CombinedHandout too, since no flat rate is added
  // to them afterwards any more (#103).
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
  // floor together (CONTEXT.md "ShapedRemainder").
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
  const packsCycle = rankCycle(cyclePacks, allocation.ranked, players);

  // CombinedHandout hands everything out at the end of the tournament, so
  // there is no ParticipationPool to report (#103, ADR 0010). The two axes
  // part ways there. The Boosters are already in the RankPool and went
  // through the shaping above — depth cap, ShapedRemainder, curve and
  // RankFloor — so a Rank holding a Display gets the Display and no extra
  // participation Booster on top. The TournamentPacks have no floor and run
  // past the curve, so they keep the flat rate: every row takes it, and
  // `rank.packs` carries it on the Pool level, or the same packs would be
  // counted twice.
  const ppRate = combinedHandout ? participation.rate.packs : 0;

  // The RankPool reaches the RankFloor only down to the depth. With no
  // participation Booster before the tournament, a depth short of the player
  // count leaves the Ranks below it with nothing, so the state is reported
  // here, not prevented: `combinedHandout` travels in the SetupLink and the
  // state is reachable and legal (ADR 0002, ADR 0010).
  const combinedHandoutDepth = combinedHandout && depth < players ? { depth, players } : null;

  const rows = Array.from({ length: players }, (_, i) => ({
    rank: i + 1,
    booster: booster[i],
    packs: packsCycle[i] + ppRate,
    winners: (i < allocation.ranked ? 1 : 0) + (allocation.manual[i + 1] ?? 0),
    displays: i < depth ? d[i] : 0,
    reserved: i < depth ? fromReservation[i] : 0,
    floor: i < depth ? fromFloor[i] : 0,
    served: i < depth,
    settled: i < curveFrom,
  }));

  return {
    settings: carriedSettings(settings),
    pinned: carriedPins(pinned),
    players,
    pool,
    participation,
    judge,
    rank,
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
    combinedHandoutDepth,
    flagged,
  };
}

/**
 * The shared predicate over a DistributionPlan (#56): true wherever the
 * NoticeStack has something to show and `suggestions()` (#59) has a way out
 * to search for. Five independent facts feed it — a depth over the cap, an
 * overtake, a reservation past the depth, a reservation that swallows the
 * whole depth, and a CombinedHandout whose depth falls short of the players
 * (#103) — and it is their plain OR: none of the five is treated as
 * excluding another (see the `unclaimedRemainder` note above for one case
 * where two can hold of the same plan at once).
 */
export function unfit(plan) {
  return (
    !!plan.conflict ||
    !!plan.overtake ||
    !!plan.orphanedReservation ||
    !!plan.unclaimedRemainder ||
    !!plan.combinedHandoutDepth
  );
}

/** The geometric weights of the curve: `ratio⁰, ratio¹, …` over the shaped ranks. */
function shapeWeights(ratio, count) {
  return Array.from({ length: count }, (_, j) => ratio ** j);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
