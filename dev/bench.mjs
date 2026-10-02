/**
 * ============================================================================
 * DEVELOPER WORKBENCH — NOT A PROTOTYPE, NOT A HEAD START ON THE APP.
 *
 * To the agent that later builds Spec 2 (#61, tickets #62-#73): do NOT take
 * this file as a starting point, and do not copy anything out of it. Nothing
 * here was decided — not the layout, not the controls, not the wording, not
 * the state shape. `docs/agents/prototyping.md` says a mockup is a reference
 * and not a template; a bench is less than a mockup, because it was never
 * even drawn for a user. It is a vice that holds the core still while the
 * maintainer pulls on it.
 *
 * The real surface is Alpine over plain ES modules (ADR 0004), built from
 * CONTEXT.md and the Spec 2 tickets. This file uses none of that, offline
 * vanilla only, and it is meant to look unlike the app.
 *
 * Two standing rules for anyone editing the bench:
 *   - It imports the core from `../public/core/` and never copies it.
 *   - It never invents a URL encoding for its state. That is `SetupLink`, a
 *     versioned public interface (#48, docs/agents/setup-link.md).
 * ============================================================================
 */

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute, unfit } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS, RANGES, rafflePot } from '../public/core/rules.mjs';
import { combinedWayOut, offerFor, waysOut as coreWaysOut } from '../public/core/suggest.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { winnerPackOverhang } from '../public/ui/overhang.mjs';

/**
 * The bench's own neutral sheet: the presettable Settings fields only, with
 * every announced quantity turned off, so a stand shows what the sliders under
 * it do and nothing else. It is **not** a DefaultSet and names no Game — the
 * real sheets are loaded through the buttons below, from `public/sets/`.
 *
 * The measured stands of #53 are spread on top of this, so its values are part
 * of what those expected numbers were measured against and do not move.
 */
const BENCH_SHEET = {
  players: 32,
  boosterRate: 3,
  envelopeSize: 24,
  envelopeYield: 1,
  displaySize: 24,
  participationBooster: 0,
  participationPack: 0,
  judgeBooster: 0,
  judgeWinner: 0,
  rankFloor: 2,
  depthStep: 'all',
  curve: 'steep',
  combinedHandout: false,
};

/**
 * A neutral Settings object, resolved through the core's own chain (#49).
 *
 * It used to be a hand-written literal that also spelled out which four fields
 * start `null` and which two start empty — a second copy of a decision that
 * lives in `core/defaults.mjs`, and exactly the kind of copy the bench's first
 * standing rule forbids. `resolveSettings()` arrived with #49 and supplies
 * that half now; the bench only keeps the sheet. The resolved object is
 * field-for-field the one the literal produced.
 */
function neutralSettings() {
  return resolveSettings({ game: BENCH_SHEET, type: undefined, pins: {} });
}

/**
 * The real DefaultSet chain, one entry per starting stand the app can open on
 * (#49, ADR 0003): the Game's own sheet, then each TournamentType's deviations
 * on top. The bench resolves them the same way `public/ui/plan.mjs` does, so a
 * stand a CommunityLead actually starts from can be driven by hand — and so a
 * sheet that grows a field shows up here without the bench being touched.
 */
const SHEETS = [
  { id: 'game', label: 'Game sheet (One Piece)', resolve: () => resolveSettings({ game: GAME, pins: {} }) },
  ...TOURNAMENT_TYPES.map((type) => ({
    id: type.id,
    label: `DefaultSet · ${type.title}`,
    resolve: () => resolveSettings({ game: GAME, type, pins: {} }),
  })),
];

/**
 * The controls, one per Settings field the core reads today. Everything else
 * in `neutralSettings` is carried but not shown — a slider for a value nobody
 * reads would claim an effect it does not have.
 */
const CONTROLS = [
  { key: 'players', label: 'Players', kind: 'range', min: 2, max: 64 },
  {
    key: 'boosterRate',
    label: 'Booster per Player',
    kind: 'range',
    min: 0,
    max: 12,
    note: 'Rate 0 empties the RankPool — that is the conflict branch (#56).',
  },
  {
    key: 'tournamentPacks',
    label: 'TournamentPacks',
    kind: 'range',
    min: 0,
    max: 128,
    nullable: 'trailing (= Players)',
  },
  {
    key: 'envelopeSize',
    label: 'PromoEnvelope · TournamentPacks per envelope',
    kind: 'range',
    min: 1,
    max: 64,
  },
  {
    key: 'envelopeYield',
    label: 'PromoEnvelope · WinnerPacks per envelope',
    kind: 'range',
    min: 1,
    max: 8,
    note: 'At a yield of 1 the staffel is exactly the old single two-thirds threshold.',
  },
  {
    key: 'winnerPacks',
    label: 'WinnerPacks',
    kind: 'range',
    min: 0,
    max: 64,
    nullable: 'trailing (= the envelope staffel)',
    note: 'The staffel binds the starting value, not the amount (#29).',
  },
  { key: 'participationBooster', label: 'ParticipationPool · Booster per Player', kind: 'range', min: 0, max: 12 },
  { key: 'participationPack', label: 'ParticipationPool · TournamentPacks per Player', kind: 'range', min: 0, max: 12 },
  { key: 'judgeBooster', label: 'JudgePool · Booster (absolute)', kind: 'range', min: 0, max: 96 },
  {
    key: 'judgeWinner',
    label: 'JudgePool · WinnerPacks (absolute)',
    kind: 'range',
    min: 0,
    max: 24,
    note: 'Shortens the automatic prefix instead of eating into `open` (#29).',
  },
  { key: 'rankFloor', label: 'RankFloor', kind: 'range', min: 0, max: 12 },
  {
    key: 'depth',
    label: 'RankPoolDepth',
    kind: 'range',
    min: 1,
    max: 64,
    nullable: 'trailing (= min(step, depthCap))',
    note: 'Pinned and trailing are two branches in the core, not one value (ADR 0006).',
  },
  {
    key: 'depthStep',
    label: 'RankPoolDepth · starting step',
    kind: 'select',
    options: () => DEPTH_STEPS,
    note: 'Only reaches the plan while the depth is trailing.',
  },
  {
    key: 'curve',
    label: 'DistributionCurve',
    kind: 'select',
    options: () => CURVES.map((c) => c.id),
    render: (id) => `${id} · ${CURVES.find((c) => c.id === id).ratio}`,
  },
  {
    key: 'displaySize',
    label: 'Display size (Booster per Display)',
    kind: 'range',
    min: 1,
    max: 48,
    note: 'Feeds depthCap and, since #55, row.reserved for every settled or tied Rank.',
  },
  {
    key: 'displays',
    label: 'DisplayReservation vector',
    kind: 'list',
    note: 'Comma-separated Displays per Rank. Since #55 the strict prefix above the topmost tie is settled: it gets exactly its Displays, no RankFloor, no lead. A reservation that reaches the whole depth leaves the ShapedRemainder unclaimed — the bars and the invariant line below name that as `unclaimedRemainder`, not as a defect.',
  },
  {
    key: 'ranked',
    label: 'WinnerPackAllocation · ranked prefix',
    kind: 'range',
    min: 0,
    max: 64,
    nullable: 'trailing (= ⌊RankPool WinnerPacks / 2⌋ + 1)',
    note: 'Moves the RankCycle too: it starts at the first Rank after the prefix.',
  },
  {
    key: 'manualWinner',
    label: 'WinnerPackAllocation · manual',
    kind: 'map',
    note: '`Rank:count` pairs, e.g. 1:2, 5:1. Free over the whole Ranking, independent of the depth.',
  },
  {
    key: 'combinedHandout',
    label: 'CombinedHandout',
    kind: 'check',
    note: 'Shifts the participation shares into the rank rows instead of adding them — on the Pool level and in the rows at once.',
  },
];

/**
 * The four measured stands of #53, plus the two conflict stands #56 owns, the
 * WinnerPack overhang of #70 and the two-fact stand of #68.
 *
 * Every expected value below is looked up where it was decided — never
 * re-derived from what the core happens to read today, which would only
 * measure the bench against itself (AGENTS.md, "A decided number is looked up,
 * never back-computed"). The source is named on each of the two #56 stands.
 */
const PRESETS = [
  {
    id: 'weekend',
    label: '32 Players, rate 3, participation 1, floor 2, depth 8, steep',
    settings: {
      players: 32,
      boosterRate: 3,
      participationBooster: 1,
      rankFloor: 2,
      depth: 8,
      curve: 'steep',
    },
    expect: { what: 'series', value: '29·14·7·4·3·3·2·2' },
  },
  {
    id: 'weekend-trailing',
    label: 'the same stand with a trailing depth',
    settings: {
      players: 32,
      boosterRate: 3,
      participationBooster: 1,
      rankFloor: 2,
      depth: null,
      curve: 'steep',
    },
    expect: { what: 'depthCap', value: '31' },
  },
  {
    id: 'tie',
    label: '8 Players, RankPool 14, floor 2, depth 3, extreme',
    settings: {
      players: 8,
      boosterRate: 2,
      judgeBooster: 2,
      rankFloor: 2,
      depth: 3,
      curve: 'extreme',
    },
    expect: { what: 'series', value: '9·3·2' },
  },
  {
    id: 'silent',
    label: '8 Players, RankPool 16, floor 5, depth 3 — a ShapedRemainder of 0',
    settings: {
      players: 8,
      boosterRate: 2,
      rankFloor: 5,
      depth: 3,
      curve: 'gentle',
    },
    expect: { what: 'curveSilent', value: 'true' },
  },
  {
    // Before #56 this stand handed out 3·2·2 from a RankPool of 0, and the
    // bench's job was to keep that visible. #56 repaired it: the pool is
    // poured from the top, so an empty pool pours nothing and every served
    // Rank stands at 0 while `conflict {need: 7, have: 0}` says why. Decided
    // on #56, first comment (from #53) — "ein leerer PrizePool ist von Haus
    // aus ein Konfliktstand" — and CONTEXT.md, "the conflict branch": a Rank 1
    // that gets nothing stands there as an empty tile, with the notice.
    id: 'conflict',
    label: 'not one of the four: rate 0, floor 2, depth 3 — the conflict branch, repaired by #56',
    settings: {
      players: 8,
      boosterRate: 0,
      rankFloor: 2,
      depth: 3,
      curve: 'steep',
    },
    expect: { what: 'series', value: '0·0·0' },
  },
  {
    // The WinnerPack overhang (#70), the stand the bench had no line for
    // until now — finding G5. `ranked` is clamped by the core
    // (`allocateWinners`, at `min(rank.winners, players)`), so the overhang
    // can only come from the `manual` share, which is deliberately not
    // clamped: "der Überhang entsteht nicht beim Setzen … sondern wenn ein
    // zweiter Wert nachträglich sinkt" (#70). Two WinnerPacks in the RankPool,
    // both handed to the top two by `ranked`, and two more promised to Rank 3
    // by hand.
    //
    // The expected number is #70's formula applied to these Settings —
    // 2 + 2 − 2 = 2 — not a number read back out of a plan.
    id: 'overhang',
    label: '8 Players, winnerPacks 2, ranked 2, 2 by hand on Rank 3 — the WinnerPack overhang (#70)',
    settings: {
      players: 8,
      boosterRate: 3,
      rankFloor: 2,
      winnerPacks: 2,
      ranked: 2,
      manualWinner: { 3: 2 },
    },
    expect: { what: 'overhang', value: '2', read: (plan) => String(overhang(plan)) },
  },
  {
    // The second conflict case #56 introduced, and the one the bench had no
    // stand for: a DisplayReservation on a Rank the depth does not serve. The
    // stand and its numbers are the ones test/distribute.test.mjs:691 fixes —
    // 5 Players at rate 1 give a RankPool of 5, depth 2's own arithmetic is
    // untouched (3·2), and the Displays parked on Rank 3 are reported rather
    // than quietly read as though they stopped at the depth (ADR 0002).
    id: 'orphaned',
    label: '5 Players, depth 2, Displays on Rank 3 — the orphaned reservation (#56)',
    settings: {
      players: 5,
      boosterRate: 1,
      rankFloor: 2,
      displaySize: 1,
      depth: 2,
      displays: [0, 0, 3],
    },
    expect: {
      what: 'orphanedReservation',
      value: '3·2 · orphaned Rank 3',
      read: (plan) =>
        `${seriesOf(plan)} · orphaned ${plan.orphanedReservation ? plan.orphanedReservation.ranks.map((r) => `Rank ${r}`).join(', ') : 'none'}`,
    },
  },
  {
    // The stand on which no single slider clears and the one combined way out
    // of #68 is the answer. Stand and label are the ones
    // test/suggest.test.mjs:640/683 fixes: two facts at once — a shortfall
    // (floor 3 at depth 2 needs more than the RankPool holds after the
    // reservation) and Rank 3's Display orphaned at depth 2. The floor clears
    // the first and leaves the second, dropping Rank 3 the reverse, so only
    // both together clear. `participationBooster` and `judgeBooster` are 0 on
    // the bench sheet already and named here only because the test names them.
    id: 'twoFacts',
    label: '8 Players, rate 1, floor 3, depth 2, a Display on Ranks 1–3 — no single slider clears (#68)',
    settings: {
      players: 8,
      boosterRate: 1,
      participationBooster: 0,
      judgeBooster: 0,
      displaySize: 2,
      displays: [1, 1, 1],
      depth: 2,
      rankFloor: 3,
      curve: 'steep',
    },
    expect: {
      what: 'combinedWayOut',
      value: "Floor down to 1 and drop rank 3's display",
      read: (plan) => combinedWayOut(plan)?.label ?? 'null',
    },
  },
];

/**
 * The invariants, checked on every change. A broken one is shown and named,
 * never smoothed over. Until #56 the `boosterRate` 0 stand handed out 3·2·2
 * from a RankPool of 0 and this line went red over it; the branch is repaired,
 * so the last entry reads the core's own `unfit` verdict back instead — a
 * conflict state no longer breaks an invariant, and without that line the
 * bench would report it as clean.
 *
 * The WinnerPack axis had no line at all until this catch-up, on the reading
 * that the sum rule binds the Pool level and that a WinnerPack left `open`
 * violates nothing (#46). The first half of that is right and the second is
 * the reason `open` is a **term** of the rule rather than a hole in it — the
 * axis does close, and #58's suite closes it. Its absence here is finding G5
 * of the #49·#59·#58 counter-check: the bench said "all invariants hold" to a
 * stand that suite names. Three lines below cover it.
 */
const INVARIANTS = [
  {
    // A DisplayReservation that settles the whole depth (`unclaimedRemainder`
    // set) leaves the ShapedRemainder without a Rank to receive it — the rows
    // then fall short of the RankPool by exactly that amount, on purpose
    // (#55, folded into `unfit` by #56). That is a reported state, not a
    // broken invariant; a shortfall the plan does *not* name stays a failure.
    // Same distinction `assertPlanSum` makes in test/distribute.test.mjs.
    name: 'sum rule: Σ row.booster = RankPool',
    check: (plan) => {
      const sum = plan.rows.reduce((a, row) => a + row.booster, 0);
      if (sum === plan.rank.booster) return { state: 'ok', detail: `${sum} vs ${plan.rank.booster}` };
      const unclaimed = plan.unclaimedRemainder ? plan.shapedRemainder : 0;
      if (unclaimed > 0 && sum + unclaimed === plan.rank.booster) {
        return {
          state: 'reported',
          detail: `${sum} vs ${plan.rank.booster} — unclaimedRemainder at depth ${plan.unclaimedRemainder.depth}, ${unclaimed} Booster unclaimed`,
        };
      }
      return { state: 'fail', detail: `${sum} vs ${plan.rank.booster}` };
    },
  },
  // The rule at the plan's own level, on both divisible-by-Rank axes. Its
  // absence is what let the double count through: while CombinedHandout copied
  // the participation shares into the rows and left them in the pool as well,
  // `Σ row = RankPool` still held on its own — the RankPool had grown by the
  // same amount. Only the sum against the PrizePool catches that. Carries the
  // same unclaimedRemainder distinction as the rule above, for the same reason.
  {
    name: 'sum rule: participation + judge + Σ rows = PrizePool · Booster',
    check: (plan) => {
      const rowSum = plan.rows.reduce((a, row) => a + row.booster, 0);
      const sum = plan.participation.booster + plan.judge.booster + rowSum;
      if (sum === plan.pool.booster) return { state: 'ok', detail: `${sum} vs ${plan.pool.booster}` };
      const unclaimed = plan.unclaimedRemainder ? plan.shapedRemainder : 0;
      if (unclaimed > 0 && sum + unclaimed === plan.pool.booster) {
        return {
          state: 'reported',
          detail: `${sum} vs ${plan.pool.booster} — unclaimedRemainder at depth ${plan.unclaimedRemainder.depth}, ${unclaimed} Booster unclaimed`,
        };
      }
      return { state: 'fail', detail: `${sum} vs ${plan.pool.booster}` };
    },
  },
  {
    name: 'sum rule: participation + judge + Σ rows = PrizePool · TournamentPacks',
    check: (plan) => {
      // The JudgePool never touches TournamentPacks, so its term is 0 by
      // construction and the plan carries no field for it.
      const sum = plan.participation.packs + (plan.judge.packs ?? 0) + plan.rows.reduce((a, row) => a + row.packs, 0);
      return { held: sum === plan.pool.packs, detail: `${sum} vs ${plan.pool.packs}` };
    },
  },
  // ---- The WinnerPack axis (G5). ------------------------------------------
  // The two sum rules are the ones test/sum-rule.test.mjs asserts, `open` as a
  // term on the recipient side: a WinnerPack nobody receives is still one the
  // Pool holds. Both hold exactly as long as the Settings do not promise more
  // WinnerPacks than the RankPool holds; where they do, both miss by exactly
  // the overhang, and that is a reported state here rather than a breach —
  // #46 hands the cap to Spec 2 at the control and calls this the core's
  // documented answer, not an exception to the rule. Measured over a 1 800
  // stand grid of the WinnerPack axis: 0 misses without an overhang, 1 183 of
  // 1 183 with one, and never by any other amount.
  {
    name: 'sum rule: Σ row.winners + open = RankPool · WinnerPacks',
    check: (plan) => winnerSumRule(plan, sumOf(plan, 'winners') + plan.allocation.open, plan.rank.winners),
  },
  {
    name: 'sum rule: judge + Σ row.winners + open = PrizePool · WinnerPacks',
    check: (plan) =>
      winnerSumRule(plan, plan.judge.winners + sumOf(plan, 'winners') + plan.allocation.open, plan.pool.winners),
  },
  {
    // The overhang itself, and the one line here that is not a statement about
    // the core. #70 gives the formula outright — `ranked + manualCount −
    // rank.winners`, positive means over-assigned — and calls it the second
    // source of the ConflictNotice and "der einzige Zustand dieser Spec, den
    // der Rechenkern nicht selbst meldet". That last part is why this reads
    // red and not amber: amber on this bench means the core reports the state
    // itself and the line only fetches it (`overtake`, `unclaimedRemainder`,
    // `conflict.have`). Here there is no report to fetch — `unfit` is false —
    // and a stand that promises WinnerPacks that do not exist may not leave
    // looking clean. That reading is the bench's, not a decision of #70's.
    // #70 built the notice and left it standing: the overhang is derived on the
    // shell's side (`public/ui/overhang.mjs`) and `unfit` still says nothing.
    //
    // The formula is used as #70 writes it and not as "rows > rank.winners";
    // the counter-check found the two agree stand for stand (318 of 318,
    // finding B2, filed at #70), and the same grid as above reproduces it over
    // 1 800 more — so there is nothing to gain by restating it.
    name: 'no WinnerPack over-assignment: ranked + manual ≤ RankPool · WinnerPacks',
    check: (plan) => {
      const over = overhang(plan);
      const terms = `${plan.allocation.ranked} + ${plan.allocation.manualCount} vs ${plan.rank.winners}`;
      if (over <= 0) return { state: 'ok', detail: terms };
      return {
        state: 'fail',
        detail: `${terms} — ${over} WinnerPack(s) over-assigned; the core does not report this (unfit stays ${unfit(plan)}), the shell's ConflictNotice reports it (#70)`,
      };
    },
  },
  {
    name: 'the rows fall monotonically',
    check: (plan) => {
      const at = plan.rows.findIndex((row, i) => i > 0 && row.booster > plan.rows[i - 1].booster);
      if (at === -1) return { state: 'ok', detail: 'yes' };
      // Rank 1's lead is a guarantee only *inside* the curve, and lapses the
      // moment a DisplayReservation settles it out — the core reports that as
      // `overtake`/`flagged` instead of preventing it (ADR 0001, ADR 0002;
      // test/distribute.test.mjs:507 tests this as an expected, non-broken
      // state). A rise the plan itself names is that state, not a defect; a
      // rise it does not name is a real breach.
      if (plan.overtake) {
        return {
          state: 'reported',
          detail: `rises at Rank ${at + 1} — reported as overtake (Rank ${plan.overtake.under} overtaken by Rank ${plan.overtake.over})`,
        };
      }
      return { state: 'fail', detail: `rises at Rank ${at + 1}` };
    },
  },
  {
    name: 'RankPoolDepth ≤ Players',
    check: (plan) => ({ held: plan.depth <= plan.players, detail: `${plan.depth} ≤ ${plan.players}` }),
  },
  {
    name: 'one row per Player',
    check: (plan) => ({
      held: plan.rows.length === plan.players,
      detail: `${plan.rows.length} vs ${plan.players}`,
    }),
  },
  {
    // `conflict.have` is the one numeric leaf of the plan allowed below zero,
    // and it was below zero before this line learned about it: #56 carries the
    // reservation condition outright as `need`/`have`, and a reservation that
    // by itself outweighs the RankPool makes `have` negative — the stand
    // test/distribute.test.mjs:686 fixes as `{ need: 0, have: -16 }`. It is a
    // reported fact, not a payout; no Rank ever receives it. So it reads as a
    // reported state — named, never hidden — while a negative anywhere the
    // plan actually pays out of stays a breach.
    name: 'no negative number anywhere in the plan',
    check: (plan) => {
      const bad = negativesIn(plan);
      if (bad.length === 0) return { state: 'ok', detail: 'none' };
      const outsideConflict = bad.filter((entry) => !entry.startsWith('plan.conflict.'));
      if (outsideConflict.length === 0 && plan.conflict) {
        return { state: 'reported', detail: `${bad.join(', ')} — the reported conflict condition, not a payout` };
      }
      return { state: 'fail', detail: outsideConflict.join(', ') };
    },
  },
  {
    // Not an invariant — the core's own verdict, read back. Before #56 the
    // conflict branch announced itself by breaking the sum rule, and the
    // banner went red. #56 repaired the branch, so every line above now holds
    // on a plan the core itself calls unfit, and the bench would say "all
    // invariants hold" over a state nobody should hand to a player. The
    // verdict is asked for rather than re-derived: `unfit` is the core's
    // definition of the four facts (#56, AK 6 as amended 2026-09-27), and a
    // second definition here would drift away from it.
    name: "the core's own verdict: unfit",
    check: (plan) => {
      const named = [
        plan.conflict && `conflict (need ${plan.conflict.need}, have ${plan.conflict.have})`,
        plan.overtake && `overtake (Rank ${plan.overtake.under} by Rank ${plan.overtake.over})`,
        plan.orphanedReservation &&
          `orphanedReservation (${plan.orphanedReservation.ranks.map((r) => `Rank ${r}`).join(', ')})`,
        plan.unclaimedRemainder && `unclaimedRemainder (depth ${plan.unclaimedRemainder.depth})`,
      ].filter(Boolean);
      if (!unfit(plan)) return { state: 'ok', detail: 'false — none of the four' };
      return { state: 'reported', detail: `true — ${named.join(' / ')}` };
    },
  },
];

const sumOf = (plan, key) => plan.rows.reduce((a, row) => a + row[key], 0);

/**
 * The WinnerPack overhang as the shell derives it for the ConflictNotice
 * (`winnerPackOverhang()`, #70) — imported, not restated, so the bench reads
 * the very number the notice shows. Zero where the RankPool suffices.
 */
const overhang = (plan) => winnerPackOverhang(plan)?.by ?? 0;

/** One side of the WinnerPack sum rule, with the overhang as its reported case. */
function winnerSumRule(plan, sum, expected) {
  if (sum === expected) return { state: 'ok', detail: `${sum} vs ${expected}` };
  const over = overhang(plan);
  if (over > 0 && sum - over === expected) {
    return {
      state: 'reported',
      detail: `${sum} vs ${expected} — over by exactly the overhang of ${over}; the cap belongs to Spec 2 at the control (#46, #70)`,
    };
  }
  return { state: 'fail', detail: `${sum} vs ${expected}` };
}

/** Every numeric leaf of the plan below zero, named by its path. */
function negativesIn(value, path = 'plan', out = []) {
  if (typeof value === 'number') {
    if (value < 0) out.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => negativesIn(item, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) negativesIn(item, `${path}.${key}`, out);
  }
  return out;
}

/** The derived quantities, in the order they are reasoned about. */
const DERIVED = [
  ['PrizePool · Booster', (p) => p.pool.booster],
  ['PrizePool · TournamentPacks', (p) => p.pool.packs],
  ['PrizePool · WinnerPacks', (p) => p.pool.winners],
  ['WinnerPacks · staffel value (auto)', (p) => p.pool.winnersDerived],
  ['PromoEnvelope · opened packs', (p) => p.pool.opened],
  ['PromoEnvelope · partial yield', (p) => p.pool.partialYield],
  ['PromoEnvelope · thresholds', (p) => p.pool.thresholds.join('·')],
  ['CombinedHandout', (p) => String(p.combinedHandout)],
  ['ParticipationPool · Booster', (p) => p.participation.booster],
  ['ParticipationPool · TournamentPacks', (p) => p.participation.packs],
  ['ParticipationPool · rate (Booster / Packs)', (p) => `${p.participation.rate.booster} / ${p.participation.rate.packs}`],
  ['JudgePool · Booster', (p) => p.judge.booster],
  ['JudgePool · WinnerPacks', (p) => p.judge.winners],
  ['RankPool · Booster', (p) => p.rank.booster],
  ['RankPool · TournamentPacks', (p) => p.rank.packs],
  ['RankPool · WinnerPacks', (p) => p.rank.winners],
  ['WinnerPackAllocation · ranked', (p) => p.allocation.ranked],
  ['WinnerPackAllocation · rankedAuto', (p) => p.allocation.rankedAuto],
  ['WinnerPackAllocation · manualCount', (p) => p.allocation.manualCount],
  ['WinnerPackAllocation · open', (p) => p.allocation.open],
  // Not a field of the plan: the derivation #70 defines over three that are.
  // It sits here because a value read without hunting for it is what this
  // table is for, and because the raw dump below cannot show it.
  ['WinnerPackAllocation · overhang (#70)', (p) => overhang(p)],
  ['RankPoolDepth', (p) => p.depth],
  ['depthCap', (p) => p.depthCap],
  ['depthStepValue', (p) => p.depthStepValue],
  ['RankFloor', (p) => p.rankFloor],
  ['floorReserved', (p) => p.floorReserved],
  ['ShapedRemainder', (p) => p.shapedRemainder],
  ['curveSilent', (p) => String(p.curveSilent)],
  ['curveCount', (p) => p.curveCount],
  ['DisplayReservation · read vector', (p) => p.displayVector.join('·')],
  ['DisplayReservation · reserved Booster', (p) => p.displayReserved],
  ['DisplayReservation · settledCount', (p) => p.settledCount],
  ['unclaimedRemainder', (p) => (p.unclaimedRemainder ? `depth ${p.unclaimedRemainder.depth}` : 'null')],
  [
    'overtake',
    (p) =>
      p.overtake
        ? `Rank ${p.overtake.under} (${p.overtake.has}) overtaken by Rank ${p.overtake.over} (${p.overtake.gets})`
        : 'null',
  ],
  // The three fields #56 added, in the row the plan itself lists them in.
  // They arrive in the raw dump by themselves, but the derived table is where
  // a value is read without hunting for it — the same nachziehen #55's
  // unclaimedRemainder and overtake got.
  [
    'conflict',
    (p) => (p.conflict ? `need ${p.conflict.need}, have ${p.conflict.have}` : 'null'),
  ],
  [
    'orphanedReservation',
    (p) => (p.orphanedReservation ? p.orphanedReservation.ranks.map((r) => `Rank ${r}`).join(', ') : 'null'),
  ],
  ['flagged', (p) => (p.flagged.length ? p.flagged.map((r) => `Rank ${r}`).join(', ') : 'none')],
  ['unfit', (p) => String(unfit(p))],
  // The one way over several sliders (#68), computed on every unfit stand and
  // shown raw — also where single ways exist and `waysOut()` therefore
  // withholds it, so the bench shows what the ranking leaves out.
  [
    'combinedWayOut (#68)',
    (p) => {
      const way = combinedWayOut(p);
      if (!way) return 'null';
      const used = waysOut(p)[0]?.key === 'combined';
      return `${way.label} — ${way.changes.length} change(s), ${used ? 'offered' : 'withheld: a single way stands alone'}`;
    },
  ],
  // The provenance half of the input (#86): which sliders were set by hand.
  // Only the keys — a value here is the one the row above it already shows,
  // and the whole information of a pin is that the key is present at all.
  [
    'pinned (#86)',
    (p) => {
      const keys = Object.keys(p.pinned).sort();
      return keys.length ? `${keys.length} · ${keys.join(', ')}` : 'none';
    },
  ],
];

/**
 * The ways out of an unfit plan (#59, `public/core/suggest.mjs`) — the bench's
 * single seam onto that function, and the only place it is called.
 *
 * Since #86 the argument is the **plan**: it carries the stand it was computed
 * from (`plan.settings`, ADR 0009), so the slider values and the violated facts
 * arrive together and cannot disagree. The seam stayed a function of its own
 * exactly so that turn would be this one call and nothing else in the bench.
 *
 * Since #68 it calls the core's own `waysOut()` rather than `suggestions()`:
 * the single ways where any slider clears alone, and only where none does the
 * one `combinedWayOut()` over several sliders at once (ADR 0002, addendum
 * "Wenn kein einzelner Regler räumt"). The ranking is the core's; the bench
 * does not rebuild it — again this one call.
 */
function waysOut(plan) {
  return coreWaysOut(plan);
}

/**
 * The Offer (#60, `public/core/suggest.mjs`) — the bench's single seam onto
 * that function, kept apart from `waysOut()` for the same reason.
 *
 * It is the mirror image of the ways out and never their neighbour: `waysOut()`
 * computes only where `unfit` holds, `offerFor()` only where it does not. Two
 * seams beside each other is how a bench shows that the two never speak at
 * once — a list that fell silent next to an offer that appeared is the whole
 * statement.
 */
function offer(plan) {
  return offerFor(plan);
}

/**
 * The RafflePot (#69, `public/core/rules.mjs`) — the bench's single seam onto
 * `rafflePot()`, kept apart like `waysOut()` and `offer()`.
 *
 * The `RaffleRange` it takes is **not** a Settings field: CONTEXT.md calls it
 * session state, outside `SetupLink` and outside `pinned`. So the bench holds
 * it beside `settings` rather than in it, never pins it, and no stand loaded
 * through a button or the JSON field touches it. It starts on `all`, the step
 * that excludes nothing but the Ranks already holding a WinnerPack.
 */
let raffleRange = 'all';
function pot(plan) {
  return rafflePot(plan, raffleRange);
}

const settings = neutralSettings();

/**
 * The sliders this stand was set by **hand**, key → value — the second argument
 * of `distribute()` since the addendum (#86) to ADR 0009, and what the plan
 * carries back as `plan.pinned`.
 *
 * The bench has no DefaultSet chain behind its live stand, so it cannot derive
 * a pin by comparing against one; it records the gesture instead. Touching a
 * slider pins it, taking a way out pins the slider it moves, and a trailing
 * toggle switched off unpins — for a nullable slider `null` *is* "not set by
 * hand" (ADR 0006), so the two agree. Loading a stand — a sheet, a preset, the
 * JSON box — sets the pins to exactly that stand's own keys: a DefaultSet is a
 * starting stand and pins nothing, a preset is a hand-made one and pins what it
 * names.
 *
 * It changes no number in the plan. It is here because `plan.pinned` is what
 * the SetupLink is written from (#50), and a field nothing on the bench feeds is
 * a field the bench cannot show being wrong.
 */
const pins = {};

/** One slider set by hand. */
function pin(key, value) {
  if (value == null) delete pins[key];
  else pins[key] = value;
}

/** The pins of a freshly loaded stand: its own keys, and no others. */
function resetPins(stand = {}) {
  for (const key of Object.keys(pins)) delete pins[key];
  for (const [key, value] of Object.entries(stand)) pin(key, value);
}
const el = {
  controls: document.getElementById('controls'),
  presets: document.getElementById('presets'),
  sheets: document.getElementById('sheets'),
  waysOut: document.getElementById('waysOut'),
  offer: document.getElementById('offer'),
  raffleRange: document.getElementById('raffleRange'),
  rafflePot: document.getElementById('rafflePot'),
  bars: document.getElementById('bars'),
  series: document.getElementById('series'),
  derived: document.getElementById('derived'),
  raw: document.getElementById('raw'),
  invariants: document.getElementById('invariants'),
  banner: document.getElementById('invariantBanner'),
};

buildControls();
buildPresets();
buildSheets();
buildRaffleRange();
render();

function buildControls() {
  for (const control of CONTROLS) {
    const field = document.createElement('div');
    field.className = 'field';
    field.dataset.key = control.key;

    const label = document.createElement('label');
    label.textContent = control.label;
    const value = document.createElement('output');
    field.append(label, value);

    let input;
    if (control.kind === 'select') {
      input = document.createElement('select');
      for (const id of control.options()) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = control.render ? control.render(id) : id;
        input.append(option);
      }
    } else if (control.kind === 'list') {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g. 1,0,0';
    } else if (control.kind === 'map') {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g. 1:2, 5:1';
    } else if (control.kind === 'check') {
      input = document.createElement('input');
      input.type = 'checkbox';
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = '1';
    }
    field.append(input);

    let toggle = null;
    if (control.nullable) {
      const wrap = document.createElement('div');
      wrap.className = 'toggle';
      toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.id = `pin-${control.key}`;
      const pinLabel = document.createElement('label');
      pinLabel.htmlFor = toggle.id;
      pinLabel.textContent = `pinned — off means ${control.nullable}`;
      wrap.append(toggle, pinLabel);
      field.append(wrap);
      toggle.addEventListener('change', () => {
        settings[control.key] = toggle.checked ? Number(input.value) : null;
        pin(control.key, settings[control.key]);
        render();
      });
    }

    if (control.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = control.note;
      field.append(note);
    }

    input.addEventListener('input', () => {
      if (control.kind === 'list') {
        settings[control.key] = parseVector(input.value);
      } else if (control.kind === 'map') {
        settings[control.key] = parseRankMap(input.value);
      } else if (control.kind === 'check') {
        settings[control.key] = input.checked;
      } else if (control.kind === 'select') {
        settings[control.key] = input.value;
      } else {
        settings[control.key] = Number(input.value);
        if (toggle) toggle.checked = true;
      }
      pin(control.key, settings[control.key]);
      render();
    });

    control.input = input;
    control.toggle = toggle;
    control.output = value;
    el.controls.append(field);
  }
}

/** A comma- or space-separated list of whole Displays per Rank. */
function parseVector(text) {
  return text
    .split(/[\s,]+/)
    .filter((part) => part !== '')
    .map((part) => Math.max(0, Math.trunc(Number(part)) || 0));
}

/** `Rank:count` pairs for the manual WinnerPacks, e.g. `1:2, 5:1`. */
function parseRankMap(text) {
  const map = {};
  for (const pair of text.split(/[\s,]+/).filter((part) => part !== '')) {
    const [rankText, countText] = pair.split(':');
    const rank = Math.trunc(Number(rankText));
    const count = Math.trunc(Number(countText ?? 1));
    if (Number.isFinite(rank) && rank >= 1 && Number.isFinite(count) && count > 0) map[rank] = count;
  }
  return map;
}

/** The same pairs written back out, so the field survives a preset or a JSON load. */
function formatRankMap(map) {
  return Object.entries(map ?? {})
    .map(([rank, count]) => `${rank}:${count}`)
    .join(', ');
}

function buildPresets() {
  for (const preset of PRESETS) {
    const row = document.createElement('div');
    row.className = 'preset';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = preset.label;
    const verdict = document.createElement('span');
    verdict.className = 'verdict';
    preset.verdict = verdict;
    button.addEventListener('click', () => {
      Object.assign(settings, neutralSettings(), preset.settings);
      resetPins(preset.settings);
      render();
    });
    row.append(button, verdict);
    el.presets.append(row);
  }
}

/**
 * The DefaultSet buttons. They replace the whole Settings rather than merging
 * into it: a sheet is a starting stand, and half a sheet over half a hand-made
 * stand is neither.
 */
function buildSheets() {
  for (const sheet of SHEETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = sheet.label;
    button.addEventListener('click', () => {
      Object.assign(settings, sheet.resolve());
      resetPins();
      render();
    });
    el.sheets.append(button);
  }
}

function render() {
  syncControls();
  const plan = distribute(settings, pins);
  renderBars(plan);
  el.series.textContent = seriesOf(plan);
  renderDerived(plan);
  el.raw.textContent = JSON.stringify(plan, null, 2);
  renderInvariants(plan);
  renderWaysOut(plan);
  renderOffer(plan);
  renderRafflePot(plan);
  renderPresetVerdicts();
}

/** The thirteen `RaffleRange` steps, straight from `RANGES` — ids, not labels. */
function buildRaffleRange() {
  for (const step of RANGES) {
    const option = document.createElement('option');
    option.value = step.id;
    option.textContent = step.id;
    el.raffleRange.append(option);
  }
  el.raffleRange.value = raffleRange;
  el.raffleRange.addEventListener('change', () => {
    raffleRange = el.raffleRange.value;
    render();
  });
}

/**
 * The pot, raw: the Ranks a throw may land on, and beside them the Ranks that
 * hold a WinnerPack, read off `row.winners`. The second list is what the pot
 * leaves out wherever the range reaches it — "eine Siegerkarte gewinnt niemand
 * zweimal" (CONTEXT.md, `RafflePot`). The throw itself is not here: the core
 * has none, and neither has the bench.
 */
function renderRafflePot(plan) {
  el.rafflePot.replaceChildren();
  const ranks = pot(plan);
  const holding = plan.rows.flatMap((row, i) => (row.winners > 0 ? [i + 1] : []));

  const line = document.createElement('p');
  line.textContent =
    ranks.length === 0
      ? `${raffleRange}: the pot is empty`
      : `${raffleRange}: ${ranks.length} Rank(s) — ${ranks.join(' · ')}`;
  el.rafflePot.append(line);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent =
    holding.length === 0
      ? 'no Rank holds a WinnerPack yet'
      : `holding a WinnerPack, never in the pot: ${holding.join(' · ')}`;
  el.rafflePot.append(note);
}

/**
 * The ways out, beside the invariant line: when the line stops being green,
 * what the core would offer is exactly what one wants to see next — and being
 * able to take one by hand is what a bench is for. `suggestions()` searches
 * one slider at a time (#59), so a single entry is one slider's value and
 * applying it is one assignment; the combined entry of #68 (`key: 'combined'`)
 * carries its `changes` in the single ways' own shape, and applying it is
 * those assignments in a row.
 *
 * It computes only where `unfit` holds, the same gate `waysOut()` itself
 * carries; the WinnerPack overhang of #70 is not one of the four facts and
 * therefore has no entries here — its ways out live on the shell's side
 * (`public/ui/overhang.mjs`), not in this function.
 */
function renderWaysOut(plan) {
  el.waysOut.replaceChildren();
  if (!unfit(plan)) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'the plan is fit — waysOut() returns nothing to show';
    el.waysOut.append(note);
    return;
  }
  const entries = waysOut(plan);
  if (entries.length === 0) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent =
      'unfit, and no slider the search may move clears it, alone or together — combinedWayOut() is null; only a fact about the evening would (#68, run 12 K2 satz-zur-tatsache)';
    el.waysOut.append(note);
    return;
  }
  const list = document.createElement('div');
  list.className = 'ways';
  list.append(
    ...entries.map((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.label;
      button.title = (entry.changes ?? [entry])
        .map((change) => `${change.key}${change.rank ? ` · Rank ${change.rank}` : ''} = ${change.value}`)
        .join('; ');
      button.addEventListener('click', () => {
        applyWayOut(entry);
        render();
      });
      return button;
    }),
  );
  el.waysOut.append(list);
}

/**
 * The Offer, beside the ways out: what the core proposes while the plan is
 * still fit. It is the other half of the same seam — where `renderWaysOut()`
 * falls silent this fills, and never the other way round.
 *
 * The fields are shown **raw**, not as the sentence the app will say. What the
 * Offer reads like on screen is Spec 2's decision and lives in `prototypes/`
 * (`AGENTS.md`, "A decided form is looked up too"); a bench that phrased it
 * would become a second, unowned answer to that question. What a bench owes is
 * the numbers — above all `also`, the Ranks the proposal moves along with it,
 * because that list is the price the Offer has to name (#60, CONTEXT.md
 * "Offer") and the one part no single row shows.
 */
function renderOffer(plan) {
  el.offer.replaceChildren();
  const entry = offer(plan);
  if (!entry) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = unfit(plan)
      ? 'the plan is unfit — offerFor() stays silent and the ways out speak instead'
      : 'fit, and no Rank sits close enough to a full Display — offerFor() returns null';
    el.offer.append(note);
    return;
  }

  const line = document.createElement('p');
  line.textContent =
    `Rank ${entry.rank}: ${entry.value} Display(s), ${entry.from} → ${entry.to} Booster` +
    (entry.from === entry.to ? ' (exactly on a multiple — the trade, not the distance)' : '');
  el.offer.append(line);

  const also = document.createElement('p');
  also.className = 'note';
  also.textContent =
    entry.also.length === 0
      ? 'also: no other Rank moves'
      : `also: ${entry.also.map((m) => `Rank ${m.rank} ${m.before} → ${m.after}`).join(', ')}`;
  el.offer.append(also);

  const key = document.createElement('p');
  key.className = 'note';
  key.textContent = `key: ${entry.key}`;
  el.offer.append(key);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `Take it — displays[${entry.rank}] = ${entry.value}`;
  button.addEventListener('click', () => {
    applyWayOut({ key: 'displays', rank: entry.rank, value: entry.value });
    render();
  });
  el.offer.append(button);
}

/**
 * One way out, taken. A `displays` entry names the Rank it changes; the
 * combined way of #68 is its `changes` taken one after the other, each pinned
 * like a single one.
 *
 * Taking one is a hand gesture like dragging the slider would be, so it pins
 * the same key — the stand that comes out of a way out is one a CommunityLead
 * could have reached by hand, and a SetupLink written from it must say so.
 */
function applyWayOut(entry) {
  if (entry.key === 'combined') {
    for (const change of entry.changes) applyWayOut(change);
    return;
  }
  if (entry.key !== 'displays') {
    settings[entry.key] = entry.value;
    pin(entry.key, entry.value);
    return;
  }
  const d = (settings.displays ?? []).slice();
  while (d.length < entry.rank) d.push(0);
  d[entry.rank - 1] = entry.value;
  settings.displays = d;
  pin('displays', d);
}

/** The number row the tickets quote, e.g. `29·14·7·4·3·3·2·2`. */
function seriesOf(plan) {
  return plan.rows
    .filter((row) => row.served)
    .map((row) => row.booster)
    .join('·');
}

function syncControls() {
  for (const control of CONTROLS) {
    const value = settings[control.key];
    if (control.kind === 'list') {
      if (document.activeElement !== control.input) control.input.value = (value ?? []).join(',');
      control.output.textContent = `${(value ?? []).length} Rank(s)`;
      continue;
    }
    if (control.kind === 'map') {
      if (document.activeElement !== control.input) control.input.value = formatRankMap(value);
      const count = Object.values(value ?? {}).reduce((a, b) => a + b, 0);
      control.output.textContent = `${count} WinnerPack(s)`;
      continue;
    }
    if (control.kind === 'check') {
      control.input.checked = !!value;
      control.output.textContent = value ? 'on' : 'off';
      continue;
    }
    if (control.kind === 'select') {
      control.input.value = value;
      control.output.textContent = '';
      continue;
    }
    if (control.key === 'depth' || control.key === 'ranked') {
      control.input.max = String(settings.players);
    }
    const trailing = value == null;
    if (control.toggle) control.toggle.checked = !trailing;
    if (!trailing) control.input.value = String(value);
    // A trailing slider stays draggable on purpose: moving it is how you pin
    // it, which is the same gesture the app will use (ADR 0006).
    control.output.textContent = trailing ? 'trailing' : String(value);
  }
}

/**
 * One line per Rank. Only the Booster gets a bar: it is the divisible axis, the
 * one the DistributionCurve shapes, and the only one whose shape is worth
 * looking at. TournamentPacks and WinnerPacks arrive as small whole counts —
 * 0, 1, 2 — from the RankCycle and the WinnerPackAllocation, which run past the
 * curve entirely (#57). A bar of one pixel next to a bar of ninety would say
 * nothing; two more number columns say it exactly, and a zero is dimmed so the
 * eye finds where an axis actually reaches.
 */
function renderBars(plan) {
  const peak = Math.max(1, ...plan.rows.map((row) => row.booster));
  el.bars.replaceChildren(
    ...plan.rows.map((row) => {
      const classes = ['row'];
      if (!row.served) classes.push('unserved');
      if (row.settled) classes.push('settled');
      if (plan.flagged.includes(row.rank)) classes.push('flagged');
      const line = document.createElement('div');
      line.className = classes.join(' ');

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = row.settled ? `Rank ${row.rank} · settled` : `Rank ${row.rank}`;

      // The bar splits into the reserved Booster (the DisplayReservation, #55)
      // and the rest (RankFloor plus the DistributionCurve's share) — a
      // settled Rank is reserved end to end, a Rank inside the curve mixes
      // both, and an unclaimedRemainder shows up as the gap between the last
      // bar's end and the RankPool line, not as a colour.
      const bar = document.createElement('div');
      bar.className = 'bar';
      // `row.reserved` is what the reservation pass actually paid out, not
      // what it promised (#56) — it cannot exceed `row.booster`, so the bar
      // takes it as it stands. It used to be clamped here, from the time
      // `reserved` was the nominal entitlement; the clamp was measured dead
      // (0 of 87 480 rows) and is gone, because a clamp that never bites
      // reads as evidence that `reserved` is still nominal.
      const rest = row.booster - row.reserved;
      const reservedSeg = document.createElement('span');
      reservedSeg.className = 'seg reserved';
      reservedSeg.style.width = `${(row.reserved / peak) * 100}%`;
      const restSeg = document.createElement('span');
      restSeg.className = 'seg rest';
      restSeg.style.width = `${(rest / peak) * 100}%`;
      bar.append(reservedSeg, restSeg);

      line.append(rank, count(row.booster, 'booster'), count(row.packs, 'packs'), count(row.winners, 'winners'), bar);
      return line;
    }),
  );
}

/** One numeric column of a rank row; a zero is dimmed rather than hidden. */
function count(value, axis) {
  const span = document.createElement('span');
  span.className = value === 0 ? `value ${axis} zero` : `value ${axis}`;
  span.textContent = String(value);
  return span;
}

function renderDerived(plan) {
  el.derived.replaceChildren(
    ...DERIVED.map(([name, read]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = name;
      const td = document.createElement('td');
      td.className = 'num';
      td.textContent = String(read(plan));
      tr.append(th, td);
      return tr;
    }),
  );
}

/**
 * `check` returns either `{ held, detail }` (the plain invariants) or
 * `{ state: 'ok' | 'reported' | 'fail', detail }` (the two sum rules, which
 * distinguish a named unclaimedRemainder from an actual breach). Normalise to
 * one three-state form here rather than in every check.
 */
function renderInvariants(plan) {
  const results = INVARIANTS.map((inv) => {
    const result = inv.check(plan);
    const state = result.state ?? (result.held ? 'ok' : 'fail');
    return { name: inv.name, state, detail: result.detail };
  });
  const broken = results.filter((result) => result.state === 'fail');
  const reported = results.filter((result) => result.state === 'reported');
  el.banner.className = broken.length > 0 ? 'broken' : reported.length > 0 ? 'reported' : 'held';
  el.banner.textContent =
    broken.length > 0
      ? `${broken.length} invariant(s) BROKEN: ${broken.map((b) => b.name).join(' / ')}`
      : reported.length > 0
        ? `all invariants hold — ${reported.length} reported state(s), not a defect: ${reported.map((r) => r.name).join(' / ')}`
        : 'all invariants hold';

  const list = document.createElement('ul');
  list.append(
    ...results.map((result) => {
      const li = document.createElement('li');
      li.className = result.state;
      const icon = result.state === 'ok' ? '✓' : result.state === 'reported' ? '●' : '✗';
      li.textContent = `${icon} ${result.name} — ${result.detail}`;
      return li;
    }),
  );
  el.invariants.replaceChildren(list);
}

/** Each measured stand carries its expected number, checked where it stands. */
function renderPresetVerdicts() {
  for (const preset of PRESETS) {
    const plan = distribute({ ...neutralSettings(), ...preset.settings });
    // A stand whose point is a reported object rather than a number carries
    // its own reader; `series` and the plain scalar fields need none.
    const actual = preset.expect.read
      ? preset.expect.read(plan)
      : preset.expect.what === 'series'
        ? seriesOf(plan)
        : String(plan[preset.expect.what]);
    const held = actual === preset.expect.value;
    preset.verdict.className = `verdict ${held ? 'ok' : 'fail'}`;
    preset.verdict.textContent = held
      ? `✓ ${preset.expect.what} ${actual}`
      : `✗ ${preset.expect.what} ${actual}, expected ${preset.expect.value}`;
  }
}

document.getElementById('copySettings').addEventListener('click', async () => {
  const state = document.getElementById('copyState');
  try {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    state.textContent = 'copied';
  } catch {
    state.textContent = 'clipboard refused — use the textarea below';
    document.getElementById('settingsIn').value = JSON.stringify(settings, null, 2);
  }
});

document.getElementById('loadSettings').addEventListener('click', () => {
  const state = document.getElementById('loadState');
  try {
    const parsed = JSON.parse(document.getElementById('settingsIn').value);
    Object.assign(settings, neutralSettings(), parsed);
    resetPins(parsed);
    state.textContent = 'loaded';
    render();
  } catch (error) {
    state.textContent = `not JSON: ${error.message}`;
  }
});
