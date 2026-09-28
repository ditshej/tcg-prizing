import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute, unfit } from '../public/core/distribute.mjs';
import { CURVES } from '../public/core/rules.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { curveStepDistance, suggestions } from '../public/core/suggest.mjs';

/**
 * A DefaultSet sheet read as Settings, the same way `test/onepiece.test.mjs`
 * reads it: the Game's values, the TournamentType's deviations on top, the
 * four trailing sliders left at `null` so the core computes them.
 */
function settingsFor(id, overrides = {}) {
  const type = TOURNAMENT_TYPES.find((t) => t.id === id);
  return {
    ...GAME,
    ...type,
    tournamentPacks: null,
    depth: null,
    ranked: null,
    winnerPacks: null,
    ...overrides,
  };
}

/**
 * The ways out of a stand. `suggestions()` takes a **plan** since #86 — the
 * plan carries its slider stands, so the search can vary them (ADR 0009) —
 * while the scenarios below are written as the slider stands they are, so this
 * is the one place the two meet.
 */
const waysOut = (settings) => suggestions(distribute(settings));

const labels = (list) => list.map((s) => s.label);
const servedBoosters = (plan) => plan.rows.filter((r) => r.served).map((r) => r.booster);

/**
 * The overtake of #46 `## Tests`: `Weekend` at 48 players with `d` = (1)
 * distributes the measured `24·34·16·9·5·3·3·2` and reports an overtake. The
 * numbers are the spec's, measured on the prototype — not read back off the
 * core — and this test asserts them first so every expectation below stands on
 * a plan that is known to be the one the spec means.
 */
const OVERTAKE = settingsFor('weekend', { players: 48, displays: [1] });

test('a valid plan has no ways out — the list is empty', () => {
  const settings = settingsFor('weekend');
  assert.equal(unfit(distribute(settings)), false, 'the measured Weekend 32 plan is valid');
  assert.deepEqual(waysOut(settings), []);
});

test('Weekend 48 with d = (1) is the measured overtake the ways out are searched from', () => {
  const plan = distribute(OVERTAKE);
  assert.deepEqual(servedBoosters(plan), [24, 34, 16, 9, 5, 3, 3, 2]);
  assert.deepEqual(plan.overtake, { under: 1, over: 2, has: 24, gets: 34 });
});

test('the overtake at Weekend 48 with d = (1) offers `Curve to moderate` first', () => {
  const out = waysOut(OVERTAKE);
  assert.deepEqual(out[0], { key: 'curve', value: 'moderate', label: 'Curve to moderate' });
});

/**
 * ADR 0002's own example and #46: at `d` = (1,0,…) both "reservation to 2
 * Displays" and "drop the reservation" are one step from the current value and
 * both clear, so **both** stand in the list — "the nearest value" means the
 * set, not one value. Among themselves the higher value comes first, because
 * taking away is the more drastic grip.
 */
test('two equally distant values of the same slider both stand there, the higher first', () => {
  const rank1 = waysOut(OVERTAKE).filter((s) => s.key === 'displays' && s.rank === 1);
  assert.deepEqual(rank1, [
    { key: 'displays', rank: 1, value: 2, label: 'Rank 1 up to 2 displays' },
    { key: 'displays', rank: 1, value: 0, label: "Drop rank 1's display" },
  ]);
});

test('the ways out of the measured overtake run promise against shaping, in that order', () => {
  assert.deepEqual(labels(waysOut(OVERTAKE)), [
    'Curve to moderate',
    'Floor up to 6',
    'Serve 17 ranks',
    'Rank 1 up to 2 displays',
    "Drop rank 1's display",
    'Rank 2 up to 1 display',
    'Participation boosters up to 2',
  ]);
});

/**
 * The floor conflict: `Weekend` at 32 players with the depth pinned to 32
 * needs `2 · 32 + 1 = 65` Boosters out of a RankPool of 64. The conflict is
 * built from the RankPool, the reservation and the floor — the
 * DistributionCurve appears in none of them, so no curve step can clear it and
 * the curve drops out of the list by itself. Nothing in `suggest.mjs` asks
 * which case this is.
 */
const FLOOR_CONFLICT = settingsFor('weekend', { depth: 32 });

test('the floor conflict is a shortfall the DistributionCurve does not enter', () => {
  const plan = distribute(FLOOR_CONFLICT);
  assert.deepEqual(plan.conflict, { need: 65, have: 64 });
});

test('at a floor conflict the curve stays out of the list on its own', () => {
  const out = waysOut(FLOOR_CONFLICT);
  assert.ok(out.length > 0, 'the floor conflict has ways out, so the list is not empty by accident');
  assert.deepEqual(
    out.filter((s) => s.key === 'curve'),
    [],
  );
  assert.deepEqual(labels(out), [
    'Floor down to 1',
    'Serve 31 ranks',
    'Participation boosters down to 0',
  ]);
});

/**
 * The overtake of #59 `## G1`: `d` = (3,1) over a Display of 8 at an `extreme`
 * curve with the floor down. Rank 3 reserving 2 Displays clears the state — and
 * makes the vector `(3,1,2)` rise, so `displayWaysOut()` must not offer it. It
 * is the one state in this file where the monotonicity grip has anything to
 * hold: over the five states above, removing `neverRising()` from
 * `suggest.mjs` changes nothing. The same state also reaches `displays[i]` = 3,
 * so it pins the search range of #46 `## Slider ranges` at the same time.
 */
const RISING_STEP = settingsFor('weekend', {
  players: 32,
  rankFloor: 0,
  curve: 'extreme',
  displays: [3, 1],
  displaySize: 8,
});

/** The states that have something to say — one per way a plan can be unfit. */
const UNFIT_STATES = [
  ['overtake', OVERTAKE],
  ['floor conflict', FLOOR_CONFLICT],
  ['orphaned reservation', settingsFor('weekend', { players: 48, depth: 2, displays: [1, 1, 1] })],
  ['unclaimed remainder', settingsFor('weekend', { depth: 1, displays: [1] })],
  ['rising step one Rank down', RISING_STEP],
  ['reservation over the whole RankPool', settingsFor('weekend', { displays: [4, 2] })],
];

test('every named unfit state really is unfit — the states below are not vacuous', () => {
  for (const [name, settings] of UNFIT_STATES) {
    assert.ok(unfit(distribute(settings)), `${name} must be unfit`);
  }
});

/**
 * An unfit plan does **not** promise a non-empty list. `d` = (4,2) at `Weekend`
 * 32 reserves 144 Boosters out of a RankPool of 64: it is a conflict, an
 * orphaned reservation and an unclaimed remainder at once, and no single
 * slider clears all three — the ways out are the *individually walkable* ones
 * (ADR 0002), and here there are none. The state is only reachable by lowering
 * a second value afterwards, the way ADR 0002 describes.
 */
test('a state with no individually walkable way out yields an empty list, not a wrong one', () => {
  const settings = settingsFor('weekend', { displays: [4, 2] });
  assert.ok(unfit(distribute(settings)));
  assert.deepEqual(waysOut(settings), []);
});

test('every unfit state but the last one has at least one way out', () => {
  for (const [name, settings] of UNFIT_STATES.slice(0, -1)) {
    assert.ok(waysOut(settings).length > 0, `${name} must have at least one way out`);
  }
});

test('player count, Booster rate and Display size never appear as a way out', () => {
  const forbidden = new Set(['players', 'boosterRate', 'displaySize']);
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of waysOut(settings)) {
      assert.ok(!forbidden.has(s.key), `${name} proposed '${s.key}', which is a fact about the evening`);
    }
  }
});

/** A suggestion accepted: the slider it names set to the value it names. */
function accepted(settings, s) {
  if (s.key !== 'displays') return { ...settings, [s.key]: s.value };
  const d = (settings.displays ?? []).slice();
  while (d.length < s.rank) d.push(0);
  d[s.rank - 1] = s.value;
  return { ...settings, displays: d };
}

test('no way out lowers the RankPoolDepth below the overtaking Rank', () => {
  const plan = distribute(OVERTAKE);
  for (const s of waysOut(OVERTAKE)) {
    const after = distribute(accepted(OVERTAKE, s));
    assert.ok(
      after.depth >= plan.overtake.over,
      `'${s.label}' leaves depth ${after.depth}, below the overtaking Rank ${plan.overtake.over}`,
    );
  }
});

test('no way out lets the DisplayReservation vector rise', () => {
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of waysOut(settings)) {
      const d = (accepted(settings, s).displays ?? []).map((v) => Math.max(0, Math.trunc(v)));
      for (let i = 1; i < d.length; i++) {
        assert.ok(d[i] <= d[i - 1], `${name}: '${s.label}' makes the vector rise at Rank ${i + 1}`);
      }
    }
  }
});

/**
 * The grip above only bites where a rising candidate would otherwise be
 * proposed, and that is this state: `(3,1,2)` clears — it is a fit plan that
 * keeps the overtaking Rank, so `clears()` says yes — and it is still withheld,
 * because `d₁ ≥ d₂ ≥ …` is the one rule no suggestion may break. Without this
 * assertion the test above passes on a `suggest.mjs` that has no filter at all.
 */
test('a rising candidate is withheld even though it clears the state', () => {
  const rising = accepted(RISING_STEP, { key: 'displays', rank: 3, value: 2 });
  assert.deepEqual(rising.displays, [3, 1, 2]);
  const after = distribute(rising);
  assert.equal(unfit(after), false, '(3,1,2) really clears — the filter is what withholds it');
  assert.ok(after.depth >= distribute(RISING_STEP).overtake.over, 'and it keeps the overtaking Rank');
  assert.deepEqual(
    waysOut(RISING_STEP).filter((s) => s.key === 'displays' && s.rank === 3),
    [],
  );
});

/**
 * The search range of #46 `## Slider ranges`: `displays[i]` runs 0…4, not
 * 0…2. Rank 2 rising from 1 to 3 is the nearest clearing value there, and a
 * range cut to 0…2 loses it silently — every other test in this file stays
 * green.
 */
test('the DisplayReservation is searched up to 4, not to the current value', () => {
  assert.deepEqual(labels(waysOut(RISING_STEP)), [
    'Curve to gentle',
    'Floor up to 5',
    'Rank 1 down to 1 display',
    'Rank 2 up to 3 displays',
    'Participation boosters up to 2',
  ]);
});

test('every way out really clears the state it was offered for', () => {
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of waysOut(settings)) {
      assert.equal(unfit(distribute(accepted(settings, s))), false, `${name}: '${s.label}' does not clear`);
    }
  }
});

/**
 * The orphaned reservation of #46 `## Tests`: it is reported, and the search
 * offers **both** ways — serve the Rank, or drop its Display. Neither the
 * curve nor the floor enters this condition, so neither appears.
 */
test('an orphaned reservation gets both its ways out and nothing else', () => {
  const settings = settingsFor('weekend', { players: 48, depth: 2, displays: [1, 1, 1] });
  assert.deepEqual(distribute(settings).orphanedReservation, { ranks: [3] });
  assert.deepEqual(labels(waysOut(settings)), ['Serve 3 ranks', "Drop rank 3's display"]);
});

/**
 * Nearness of a curve step is measured in **steps of the seven-entry list**,
 * never in the ratio value — measured in the unit the suggestion is accepted
 * in. The two agree numerically only because today's ratios are equidistant;
 * the distance from `gentle` to `extreme` is 6 steps and 0.6 in ratio, and it
 * is the 6 that a suggestion counts.
 */
test('the nearness of a curve step is counted in steps, not in the ratio value', () => {
  assert.equal(curveStepDistance('steep', 'firm'), 1);
  assert.equal(curveStepDistance('steep', 'moderate'), 2);
  assert.equal(curveStepDistance('gentle', 'extreme'), CURVES.length - 1);
  const ratioOf = (id) => CURVES.find((c) => c.id === id).ratio;
  assert.notEqual(curveStepDistance('gentle', 'extreme'), ratioOf('gentle') - ratioOf('extreme'));
});

test('a curve way out carries the step name, never the ratio behind it', () => {
  const ids = new Set(CURVES.map((c) => c.id));
  const curve = waysOut(OVERTAKE).find((s) => s.key === 'curve');
  assert.ok(ids.has(curve.value), `'${curve.value}' must be one of the seven steps`);
});

/**
 * The equivalence of #86 `## Abnahmekriterien` 2, swept stand for stand over a
 * grid.
 *
 * What is at stake is not the signature — that is one line — but whether the
 * slider stands the plan now carries are the stands that went in. A copy that
 * dropped a key, clamped a value or trimmed `displays` the way `displayVector`
 * does would still produce a list, and the list would be wrong in a way no
 * single scenario above reaches.
 *
 * So the sweep asks the two questions that cannot both be answered by a lossy
 * copy, and neither of them recomputes the search:
 *
 *  1. **`distribute(plan.settings)` is `plan` again**, field for field. A
 *     dropped or normalised slider shows here the moment it changes anything —
 *     `curve`, the first slider searched, changes the shaped rows.
 *  2. **Every way out, accepted onto the original Settings object, clears the
 *     state.** The search read the carried copy; the check is run against the
 *     input the caller actually holds. Where the two differ, a proposal stops
 *     clearing — which is exactly how the old `settings` form and the new
 *     `plan` form would come apart.
 *
 * The grid is a plain cartesian product, so a failure names one stand.
 */
const EQUIVALENCE_AXES = {
  players: [5, 8],
  boosterRate: [0, 3],
  rankFloor: [0, 2],
  depth: [null, 3],
  curve: ['gentle', 'extreme'],
  displays: [[], [1], [2, 1, 1]],
  displaySize: [1, 8],
  combinedHandout: [false, true],
};

function* grid(axes) {
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

test('over a grid of stands the carried sliders recompute the plan and every way out still clears the input', () => {
  let stands = 0;
  let unfitStands = 0;
  let entries = 0;
  for (const { overrides, where } of grid(EQUIVALENCE_AXES)) {
    const input = settingsFor('weekend', overrides);
    const plan = distribute(input);
    stands++;
    assert.deepEqual(distribute(plan.settings), plan, `the carried sliders do not recompute the plan at ${where}`);

    const out = suggestions(plan);
    if (!unfit(plan)) {
      assert.deepEqual(out, [], `a fit plan has ways out at ${where}`);
      continue;
    }
    unfitStands++;
    for (const s of out) {
      entries++;
      assert.equal(
        unfit(distribute(accepted(input, s))),
        false,
        `'${s.label}' does not clear the original Settings at ${where}`,
      );
    }
  }
  // Counted, not asserted in prose: a grid that reached no unfit stand would
  // pass every line above vacuously, and so would one that reached no way out.
  //
  // The three numbers were read off the core at #86, over this 384-stand grid,
  // and they follow the rule the tally in `test/sum-rule.test.mjs` sets out:
  // **carried forward, never adjusted**. When one of them moves, the question
  // is not which value makes the line green but whether the shift was intended
  // — answered out of the ticket that changed the core, not out of the core.
  // 292 of 384 stands are unfit and they yield 164 entries between them: most
  // unfit stands here have no individually walkable way out, which is the
  // state ADR 0002 describes and not a gap in the search.
  assert.equal(stands, 384);
  assert.equal(unfitStands, 292);
  assert.equal(entries, 164);
});

/**
 * The addendum (#86) to ADR 0009 hangs a second field on the plan. The search
 * must not notice: a way out is a search over **values**, and a pinned slider
 * is searched like any other — a search that only touched untouched sliders
 * would have nothing to offer at the one stand where everything was set by
 * hand, which is exactly the stand a shared SetupLink arrives in.
 */
test('the ways out do not depend on which sliders were set by hand', () => {
  const everythingPinned = Object.fromEntries(Object.entries(OVERTAKE).filter(([, v]) => v !== null));
  for (const pins of [{}, { curve: 'steep' }, { players: 48, displays: [1] }, everythingPinned]) {
    const plan = distribute(OVERTAKE, pins);
    assert.ok(unfit(plan));
    assert.deepEqual(suggestions(plan), waysOut(OVERTAKE), `pins: ${Object.keys(pins).join(',') || 'none'}`);
  }
});
