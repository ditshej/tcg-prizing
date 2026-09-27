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
  assert.deepEqual(suggestions(settings), []);
});

test('Weekend 48 with d = (1) is the measured overtake the ways out are searched from', () => {
  const plan = distribute(OVERTAKE);
  assert.deepEqual(servedBoosters(plan), [24, 34, 16, 9, 5, 3, 3, 2]);
  assert.deepEqual(plan.overtake, { under: 1, over: 2, has: 24, gets: 34 });
});

test('the overtake at Weekend 48 with d = (1) offers `Curve to moderate` first', () => {
  const out = suggestions(OVERTAKE);
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
  const rank1 = suggestions(OVERTAKE).filter((s) => s.key === 'displays' && s.rank === 1);
  assert.deepEqual(rank1, [
    { key: 'displays', rank: 1, value: 2, label: 'Rank 1 up to 2 displays' },
    { key: 'displays', rank: 1, value: 0, label: "Drop rank 1's display" },
  ]);
});

test('the ways out of the measured overtake run promise against shaping, in that order', () => {
  assert.deepEqual(labels(suggestions(OVERTAKE)), [
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
  const out = suggestions(FLOOR_CONFLICT);
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
  assert.deepEqual(suggestions(settings), []);
});

test('every unfit state but the last one has at least one way out', () => {
  for (const [name, settings] of UNFIT_STATES.slice(0, -1)) {
    assert.ok(suggestions(settings).length > 0, `${name} must have at least one way out`);
  }
});

test('player count, Booster rate and Display size never appear as a way out', () => {
  const forbidden = new Set(['players', 'boosterRate', 'displaySize']);
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of suggestions(settings)) {
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
  for (const s of suggestions(OVERTAKE)) {
    const after = distribute(accepted(OVERTAKE, s));
    assert.ok(
      after.depth >= plan.overtake.over,
      `'${s.label}' leaves depth ${after.depth}, below the overtaking Rank ${plan.overtake.over}`,
    );
  }
});

test('no way out lets the DisplayReservation vector rise', () => {
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of suggestions(settings)) {
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
    suggestions(RISING_STEP).filter((s) => s.key === 'displays' && s.rank === 3),
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
  assert.deepEqual(labels(suggestions(RISING_STEP)), [
    'Curve to gentle',
    'Floor up to 5',
    'Rank 1 down to 1 display',
    'Rank 2 up to 3 displays',
    'Participation boosters up to 2',
  ]);
});

test('every way out really clears the state it was offered for', () => {
  for (const [name, settings] of UNFIT_STATES) {
    for (const s of suggestions(settings)) {
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
  assert.deepEqual(labels(suggestions(settings)), ['Serve 3 ranks', "Drop rank 3's display"]);
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
  const curve = suggestions(OVERTAKE).find((s) => s.key === 'curve');
  assert.ok(ids.has(curve.value), `'${curve.value}' must be one of the seven steps`);
});
