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

import { distribute } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';

/**
 * A neutral Settings object. Every field the app will eventually carry is
 * listed, so a dumped JSON stays loadable once more of them are read; the
 * bench only exposes controls for the ones `distribute` reads today.
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
  { key: 'participationBooster', label: 'ParticipationPool · Booster per Player', kind: 'range', min: 0, max: 12 },
  { key: 'participationPack', label: 'ParticipationPool · TournamentPacks per Player', kind: 'range', min: 0, max: 12 },
  { key: 'judgeBooster', label: 'JudgePool · Booster (absolute)', kind: 'range', min: 0, max: 96 },
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
    note: 'Reaches the plan only through depthCap today.',
  },
  {
    key: 'displays',
    label: 'DisplayReservation vector',
    kind: 'list',
    note: 'Comma-separated Displays per Rank. Today this only moves depthCap — the rank rows ignore it until #55.',
  },
];

/** The four measured stands of #53, plus the known-broken one #56 owns. */
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
    id: 'conflict',
    label: 'not one of the four: rate 0, floor 2, depth 3 — the conflict branch (#56)',
    settings: {
      players: 8,
      boosterRate: 0,
      rankFloor: 2,
      depth: 3,
      curve: 'steep',
    },
    expect: { what: 'series', value: '3·2·2' },
  },
];

/**
 * The invariants, checked on every change. A broken one is shown and named,
 * never smoothed over: the `boosterRate` 0 stand really does hand out 3·2·2
 * from a RankPool of 0, and seeing that is the point of the bench (#56).
 */
const INVARIANTS = [
  {
    name: 'sum rule: Σ row.booster = RankPool',
    check: (plan) => {
      const sum = plan.rows.reduce((a, row) => a + row.booster, 0);
      return { held: sum === plan.rank.booster, detail: `${sum} vs ${plan.rank.booster}` };
    },
  },
  {
    name: 'the rows fall monotonically',
    check: (plan) => {
      const at = plan.rows.findIndex((row, i) => i > 0 && row.booster > plan.rows[i - 1].booster);
      return { held: at === -1, detail: at === -1 ? 'yes' : `rises at Rank ${at + 1}` };
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
    name: 'no negative number anywhere in the plan',
    check: (plan) => {
      const bad = negativesIn(plan);
      return { held: bad.length === 0, detail: bad.length === 0 ? 'none' : bad.join(', ') };
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
  ['ParticipationPool · Booster', (p) => p.participation.booster],
  ['ParticipationPool · TournamentPacks', (p) => p.participation.packs],
  ['JudgePool · Booster', (p) => p.judge.booster],
  ['RankPool · Booster', (p) => p.rank.booster],
  ['RankPool · TournamentPacks', (p) => p.rank.packs],
  ['RankPoolDepth', (p) => p.depth],
  ['depthCap', (p) => p.depthCap],
  ['depthStepValue', (p) => p.depthStepValue],
  ['RankFloor', (p) => p.rankFloor],
  ['floorReserved', (p) => p.floorReserved],
  ['ShapedRemainder', (p) => p.shapedRemainder],
  ['curveSilent', (p) => String(p.curveSilent)],
  ['curveCount', (p) => p.curveCount],
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
    if (control.kind === 'select') {
      control.input.value = value;
      control.output.textContent = '';
      continue;
    }
    if (control.key === 'depth') control.input.max = String(settings.players);
    const trailing = value == null;
    if (control.toggle) control.toggle.checked = !trailing;
    if (!trailing) control.input.value = String(value);
    // A trailing slider stays draggable on purpose: moving it is how you pin
    // it, which is the same gesture the app will use (ADR 0006).
    control.output.textContent = trailing ? 'trailing' : String(value);
  }
}

function renderBars(plan) {
  const peak = Math.max(1, ...plan.rows.map((row) => row.booster));
  el.bars.replaceChildren(
    ...plan.rows.map((row) => {
      const line = document.createElement('div');
      line.className = row.served ? 'row' : 'row unserved';
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `Rank ${row.rank}`;
      const value = document.createElement('span');
      value.className = 'value';
      value.textContent = String(row.booster);
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = `${(row.booster / peak) * 100}%`;
      line.append(rank, value, bar);
      return line;
    }),
  );
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

function renderInvariants(plan) {
  const results = INVARIANTS.map((inv) => ({ ...inv, ...inv.check(plan) }));
  const broken = results.filter((result) => !result.held);
  el.banner.className = broken.length > 0 ? 'broken' : 'held';
  el.banner.textContent =
    broken.length > 0
      ? `${broken.length} invariant(s) BROKEN: ${broken.map((b) => b.name).join(' / ')}`
      : 'all invariants hold';

  const list = document.createElement('ul');
  list.append(
    ...results.map((result) => {
      const li = document.createElement('li');
      li.className = result.held ? 'ok' : 'fail';
      li.textContent = `${result.held ? '✓' : '✗'} ${result.name} — ${result.detail}`;
      return li;
    }),
  );
  el.invariants.replaceChildren(list);
}

/** Each measured stand carries its expected number, checked where it stands. */
function renderPresetVerdicts() {
  for (const preset of PRESETS) {
    const plan = distribute({ ...neutralSettings(), ...preset.settings });
    const actual =
      preset.expect.what === 'series' ? seriesOf(plan) : String(plan[preset.expect.what]);
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
