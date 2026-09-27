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

import { distribute, unfit } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';

/**
 * A neutral Settings object. Every field the app will eventually carry is
 * listed, so a dumped JSON stays loadable once more of them are read; the
 * bench only exposes controls for the ones `distribute` reads today. Since
 * #57 that is all of them — the last stand that had to be pasted in as JSON
 * because no control existed was a `combinedHandout` one.
 */
function neutralSettings() {
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
  };
}

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
 * The four measured stands of #53, plus the two conflict stands #56 owns.
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
];

/**
 * The invariants, checked on every change. A broken one is shown and named,
 * never smoothed over. Until #56 the `boosterRate` 0 stand handed out 3·2·2
 * from a RankPool of 0 and this line went red over it; the branch is repaired,
 * so the last entry reads the core's own `unfit` verdict back instead — a
 * conflict state no longer breaks an invariant, and without that line the
 * bench would report it as clean.
 *
 * There is deliberately no sum rule on the WinnerPacks: the rule binds the Pool
 * level, not the recipient level, and a WinnerPack left `open` violates
 * nothing (#46).
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
];

const settings = neutralSettings();
const el = {
  controls: document.getElementById('controls'),
  presets: document.getElementById('presets'),
  bars: document.getElementById('bars'),
  series: document.getElementById('series'),
  derived: document.getElementById('derived'),
  raw: document.getElementById('raw'),
  invariants: document.getElementById('invariants'),
  banner: document.getElementById('invariantBanner'),
};

buildControls();
buildPresets();
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
      render();
    });
    row.append(button, verdict);
    el.presets.append(row);
  }
}

function render() {
  syncControls();
  const plan = distribute(settings);
  renderBars(plan);
  el.series.textContent = seriesOf(plan);
  renderDerived(plan);
  el.raw.textContent = JSON.stringify(plan, null, 2);
  renderInvariants(plan);
  renderPresetVerdicts();
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
    state.textContent = 'loaded';
    render();
  } catch (error) {
    state.textContent = `not JSON: ${error.message}`;
  }
});
