import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';
import { suggestions } from '../public/core/suggest.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { KEYS } from '../public/link/keys.mjs';
import {
  SHEET_KEYS,
  HOT_KEYS,
  GROUPS,
  STEPPED_KEYS,
  DEPTH_STEP_LABELS,
  boundsFor,
  reachFor,
  effectiveValue,
  clampToBounds,
  reservedDisplaysAfter,
  canReserveDisplays,
  manualWinnerAfter,
  canPlaceWinner,
  typedNumber,
  typedValueAfter,
} from '../public/ui/controls.mjs';
import { planApp } from '../public/ui/plan.mjs';

/** The sheet's own reading of a stand: settings resolved, plan computed. */
function stand(pins = {}, type = TOURNAMENT_TYPES[0]) {
  const settings = resolveSettings({ game: GAME, type, pins });
  return { settings, plan: distribute(settings) };
}

/**
 * What a resolved stand carries beyond the nineteen Settings fields of #46:
 * the Game sheet's own `id`. `resolveSettings()` drops a TournamentType's `id`
 * and `title` but spreads the Game sheet whole, so the name the sheet carries
 * since #64's "Entscheid K3" rides along. It is the price that decision names
 * outright, and it is inert — nothing in `core/` reads it — but a test that
 * counts the fields has to say so, or the next added field hides behind it.
 */
const NOT_A_SETTINGS_FIELD = ['id'];

test('the sheet carries seventeen controls, and they are exactly the Settings fields minus the two set at the tile', () => {
  assert.equal(SHEET_KEYS.length, 17);
  // The nineteen Settings fields of #46 (`## Input: Settings`), read off a
  // resolved stand rather than retyped, minus `displays` and `manualWinner`:
  // both name a Rank and are set at the tile, not on a slider (#66).
  const resolved = Object.keys(stand().settings).sort();
  assert.deepEqual(
    resolved.filter((k) => NOT_A_SETTINGS_FIELD.includes(k)),
    NOT_A_SETTINGS_FIELD,
    'the Game sheet name rides along, and nothing else does',
  );
  const settingsFields = resolved.filter((k) => !NOT_A_SETTINGS_FIELD.includes(k));
  assert.equal(settingsFields.length, 19);
  const expected = settingsFields.filter((k) => k !== 'displays' && k !== 'manualWinner');
  assert.deepEqual([...SHEET_KEYS].sort(), expected);
});

test('the four hot ones lead the sheet and carry no group of their own', () => {
  assert.deepEqual(HOT_KEYS, ['players', 'depth', 'curve', 'rankFloor']);
  assert.deepEqual(SHEET_KEYS.slice(0, 4), HOT_KEYS);
  // `depthStep` is the fifth field of the hot block, but not a fifth control:
  // it is the step grid inside the `Served ranks` control.
  assert.equal(SHEET_KEYS[4], 'depthStep');
  for (const group of GROUPS) {
    for (const key of HOT_KEYS) assert.ok(!group.keys.includes(key), `${key} is hoisted`);
  }
});

test('every group has a title and an explanation, and the groups partition what is left', () => {
  const grouped = GROUPS.flatMap((g) => g.keys);
  for (const group of GROUPS) {
    assert.ok(group.title.length > 0);
    assert.ok(group.desc.length > 0);
  }
  assert.deepEqual([...grouped].sort(), SHEET_KEYS.slice(5).slice().sort());
  assert.equal(new Set(grouped).size, grouped.length, 'no control sits in two groups');
});

test('every sheet control is a SetupLink key, except the one that is a DefaultSet entry', () => {
  const wire = new Set(KEYS.map((k) => k.key));
  for (const key of SHEET_KEYS) {
    if (key === 'depthStep') {
      assert.ok(!wire.has(key), 'depthStep stays out of the link (keys.mjs)');
      continue;
    }
    assert.ok(wire.has(key), `${key} is a link key`);
  }
});

test('the two stepped controls pick a named rule, and neither they nor the flag have bounds', () => {
  assert.deepEqual(STEPPED_KEYS.curve, CURVES.map((c) => c.id));
  assert.deepEqual(STEPPED_KEYS.depthStep, DEPTH_STEPS);
  assert.equal(boundsFor('curve', stand()), null);
  assert.equal(boundsFor('depthStep', stand()), null);
  assert.equal(boundsFor('combinedHandout', stand()), null);
});

test('every depth step the core knows has a screen word, and no word stands for a step it does not know', () => {
  assert.deepEqual(Object.keys(DEPTH_STEP_LABELS).sort(), [...DEPTH_STEPS].sort());
});

/**
 * #113, the grilling decision of 2026-10-01 — the sliders fell, and with them
 * the reason the stops of #46 existed ("damit ein Regler zwei Enden hat"). It
 * is quoted so a reader can hold the tables below against the ticket without
 * leaving the file:
 *
 * > Dach    Kein fester Höchstwert, players eingeschlossen.
 * > Boden   Die Minima bleiben: players ≥ 2, displaySize / envelopeSize /
 * >         envelopeYield ≥ 1, alles übrige ≥ 0.
 * > Wände   … Regel: Die Wand am Bedienelement steht dort, wo der Kern still
 * >         schneidet, und sie ist dieselbe Grösse wie im Kern.
 *
 * "Die Minima bleiben" is read as written — they stay what they were — so
 * `depth` keeps its 1: the list in the decision does not name it, and its
 * "alles übrige ≥ 0" would put a 0 on a control the core cuts to 1
 * (CONTEXT.md, `RankPoolDepth`: "mindestens 1").
 *
 * **Six walls, not five**, and that is the one place this file departs from
 * the decision's list: `participationPack` is cut silently by the core at
 * `⌊TournamentPacks / players⌋` exactly like `participationBooster` is at its
 * Booster counterpart, so the decision's own rule puts a wall there. The test
 * that finds it does not know the list — it runs the core on every number and
 * asks which ones come back cut (`a number the core cuts silently is a wall`).
 */
const NUMBER_KEYS = SHEET_KEYS.filter((key) => !(key in STEPPED_KEYS) && key !== 'combinedHandout');

const WALL_KEYS = ['depth', 'ranked', 'participationBooster', 'participationPack', 'judgeBooster', 'judgeWinner'];

const OPEN_KEYS = NUMBER_KEYS.filter((key) => !WALL_KEYS.includes(key));

/** The decided minima; every number not named here starts at 0. */
const DECIDED_MIN = { players: 2, displaySize: 1, envelopeSize: 1, envelopeYield: 1, depth: 1 };

/**
 * The stops the sliders had, from #46 `## Slider ranges` — kept only as the
 * line a typed number has to be able to pass ("nimmt jede getippte Zahl über
 * ihrem bisherigen Anschlag an", #113). `rankFloor`'s 8 is its search range in
 * `suggest.mjs` and stays one there; at the control it is a former stop.
 */
const FORMER_STOP = {
  players: 128,
  boosterRate: 12,
  tournamentPacks: 512,
  winnerPacks: 64,
  displaySize: 60,
  envelopeSize: 64,
  envelopeYield: 8,
  rankFloor: 8,
};

/**
 * Where the core reports what it **took** of a number, read off the plan it
 * returns. These are field reads and not the clamp expressions of
 * `distribute.mjs` — the test asks the core what it did, so a wall drawn
 * anywhere but at the core's own cut shows up as a disagreement between the
 * two, instead of as two copies of one expression that agree by construction.
 *
 * Three need a stand shaped for the reading: `displaySize` shows only through
 * a reserved display, `envelopeSize` only through the packs left loose in an
 * envelope one short of full.
 */
const TOOK = {
  players: { read: (plan) => plan.players },
  boosterRate: { read: (plan) => plan.pool.booster / plan.players },
  tournamentPacks: { read: (plan) => plan.pool.packs },
  winnerPacks: { read: (plan) => plan.pool.winners },
  displaySize: { with: () => ({ displays: [1] }), read: (plan) => plan.displayReserved },
  envelopeSize: { with: (v) => ({ tournamentPacks: v - 1 }), read: (plan) => plan.pool.opened + 1 },
  envelopeYield: { read: (plan) => plan.pool.thresholds.length },
  rankFloor: { read: (plan) => plan.rankFloor },
  depth: { read: (plan) => plan.depth },
  ranked: { read: (plan) => plan.allocation.ranked },
  participationBooster: { read: (plan) => plan.participation.rate.booster },
  participationPack: { read: (plan) => plan.participation.rate.packs },
  judgeBooster: { read: (plan) => plan.judge.booster },
  judgeWinner: { read: (plan) => plan.judge.winners },
};

/** What the core takes of `value` for `key`, at a stand. */
function coreTakes(key, value, s) {
  const { with: shape = () => ({}), read } = TOOK[key];
  return read(distribute({ ...s.settings, ...shape(value), [key]: value }, s.plan.pinned));
}

/**
 * Many stands, and the ones that move a wall among them: every type, player
 * counts from the minimum to past the former stop, an empty and a rich
 * booster supply, packs that do and do not divide by the players, a judge cut
 * on the winner packs, more and fewer winner packs than the envelopes yield,
 * and `CombinedHandout` on — under which the plan reports a ParticipationPool
 * of 0 while the core still takes it off the top, which is exactly the kind
 * of field a wall read off the wrong number would trip on.
 */
const SWEEP = (() => {
  const counts = [2, 3, 7, 32, 47, 128];
  const variants = [
    {},
    { boosterRate: 0 },
    { boosterRate: 1 },
    { participationBooster: 0 },
    { participationBooster: 5 },
    { tournamentPacks: 0 },
    { tournamentPacks: 13 },
    { participationPack: 2, tournamentPacks: 300 },
    { judgeWinner: 2 },
    { winnerPacks: 0 },
    { winnerPacks: 40 },
    { judgeBooster: 5 },
    { combinedHandout: true },
    { combinedHandout: true, boosterRate: 9, participationBooster: 3 },
    { envelopeSize: 4, envelopeYield: 3 },
  ];
  return TOURNAMENT_TYPES.flatMap((type) =>
    counts.flatMap((players) => variants.map((pins) => stand({ players, ...pins }, type))),
  );
})();

test('the fourteen numbers are the sheet minus its three choices, and each is either open or a wall', () => {
  assert.equal(NUMBER_KEYS.length, 14);
  assert.deepEqual(Object.keys(TOOK).sort(), [...NUMBER_KEYS].sort(), 'every number has a reading');
  assert.equal(OPEN_KEYS.length, 8);
});

test('a number the core cuts silently is a wall, and no other number is (#113, "Wände")', () => {
  // Far past every former stop, and past what any sweep stand holds.
  const PAST = 300;
  const cut = new Set();
  for (const s of SWEEP) {
    for (const key of NUMBER_KEYS) if (coreTakes(key, PAST, s) !== PAST) cut.add(key);
  }
  assert.deepEqual([...cut].sort(), [...WALL_KEYS].sort());
});

test('an open number takes any typed number past its former stop, and its plus is never closed', () => {
  const stands = [stand(), stand({}, TOURNAMENT_TYPES[2]), stand({ players: 128 }, TOURNAMENT_TYPES[1])];
  for (const key of OPEN_KEYS) {
    for (const s of stands) {
      assert.equal(boundsFor(key, s).max, Infinity, `${key} has no roof`);
      for (const typed of [FORMER_STOP[key] + 1, FORMER_STOP[key] * 4 + 3]) {
        assert.equal(clampToBounds(key, typed, s), typed, `${key} takes ${typed}`);
        assert.equal(coreTakes(key, typed, s), typed, `and the core computes with ${key} = ${typed}`);
        assert.ok(reachFor(key, stand({ [key]: typed })).max > typed, `${key} can still go one up from ${typed}`);
      }
    }
  }
});

test('the minima stay, and they are where the core stops cutting from below', () => {
  for (const s of [stand(), stand({}, TOURNAMENT_TYPES[2])]) {
    for (const key of NUMBER_KEYS) {
      const min = DECIDED_MIN[key] ?? 0;
      assert.equal(boundsFor(key, s).min, min, `${key} starts at ${min}`);
      assert.equal(clampToBounds(key, min - 5, s), min, `${key} is held at ${min}`);
      assert.equal(coreTakes(key, min, s), min, `the core takes ${key} = ${min}`);
    }
  }
});

test('a wall stands exactly where the core cuts, over every stand of the sweep (#113 AC 6)', () => {
  let walls = 0;
  for (const s of SWEEP) {
    for (const key of WALL_KEYS) {
      const { max } = boundsFor(key, s);
      assert.ok(Number.isFinite(max), `${key} is a wall`);
      const at = JSON.stringify({ type: s.settings.depthStep, players: s.plan.players, pins: s.plan.pinned });
      assert.equal(coreTakes(key, max, s), max, `${key}: the core takes the wall ${max} itself at ${at}`);
      assert.equal(coreTakes(key, max + 1, s), max, `${key}: the core cuts one past the wall back to it at ${at}`);
      walls += 1;
    }
  }
  assert.ok(walls >= 1500, 'many stands, not a handful');
});

test('the judge boosters end at the rest after participation, not at the whole pool (#113, measured)', () => {
  // One Piece, 128 players, boosterRate 9, participationBooster 6: the pool is
  // 1152, participation takes 768, the core accepts 0 … 384.
  const s = stand({ players: 128, boosterRate: 9, participationBooster: 6 });
  assert.equal(s.plan.pool.booster, 1152);
  assert.deepEqual(boundsFor('judgeBooster', s), { min: 0, max: 384 });
  assert.equal(clampToBounds('judgeBooster', 1152, s), 384);
});

/**
 * The walls are remembered per stand (B8 of run 12): one `distribute()` per
 * wall is too dear to pay at every read once `players` has no roof. The shell
 * writes `settings` in place, so the stand is recognised by content — a cache
 * keyed by the object would hand back the walls of the stand before.
 */
test('a wall asked again after the stand was written in place is the new stand\'s wall', () => {
  const s = stand({ players: 128, boosterRate: 9, participationBooster: 6 });
  assert.equal(boundsFor('judgeBooster', s).max, 384);
  s.settings.participationBooster = 3;
  s.plan = distribute(s.settings);
  assert.equal(boundsFor('judgeBooster', s).max, 1152 - 3 * 128);
  s.settings.participationBooster = 6;
  s.plan = distribute(s.settings);
  assert.equal(boundsFor('judgeBooster', s).max, 384);
});

test('the plan on screen follows a stand written in place, and is computed once per stand', () => {
  const app = planApp({ read: () => '', write: () => {} });
  const first = app.plan;
  assert.equal(app.plan, first, 'an unchanged stand reads the same plan');
  app.setSlider('players', 64);
  assert.notEqual(app.plan, first);
  assert.equal(app.plan.players, 64);
  assert.equal(app.plan.pinned.players, 64, 'the pins are part of the stand the plan is remembered for');
});

test('the search range of rankFloor stays the search\'s, and the control reaches past it', () => {
  // `suggest.mjs` sweeps 0 … 8; the control is open (#113 AC 8).
  const s = stand();
  assert.equal(boundsFor('rankFloor', s).max, Infinity);
  assert.equal(clampToBounds('rankFloor', 9, s), 9);
});

/**
 * The one check that measures instead of transcribing: **every way out the
 * core offers has to be reachable at the control that carries it.** The values
 * come out of `suggestions()` at a stand that really is unfit — the measured
 * overtake of #46 `## Tests`, `Weekend` 48 with `d` = (1) — so nothing here is
 * a number this file chose. A cap narrower than the search would turn an
 * offered way out into one the slider refuses, and neither side of that could
 * see it alone.
 */
const UNFIT_STANDS = [
  stand({ players: 48, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 64, rankFloor: 8, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 96, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 32, boosterRate: 1, rankFloor: 8 }, TOURNAMENT_TYPES[0]),
];

/**
 * The ways out at a stand. Since #86 (ADR 0009) `suggestions()` takes the
 * **plan**, which carries the Settings it was computed from.
 *
 * Handing it the wrong object does not throw — `unfit()` on a Settings object
 * is falsy, so the call returns `[]` and both checks below would pass while
 * measuring nothing. The first of the two is the guard against that: it
 * asserts the offer is non-empty before the second reads it.
 */
const waysOut = (s) => suggestions(s.plan);

test('the stands the reachability check runs on really are unfit, and between them they touch every search range', () => {
  const offered = new Set();
  for (const s of UNFIT_STANDS) {
    const out = waysOut(s);
    assert.ok(out.length > 0, 'a stand with no way out tests nothing');
    for (const { key } of out) offered.add(key);
  }
  // Every slider #46 names as a search range, so no range is checked vacuously.
  assert.deepEqual(
    [...offered].sort(),
    ['curve', 'depth', 'displays', 'participationBooster', 'rankFloor'],
  );
});

test('every way out the core offers is a value its control can actually be set to', () => {
  for (const s of UNFIT_STANDS) {
    for (const { key, value } of waysOut(s)) {
      // `displays` is no slider on this sheet: it is set at the tile (#66).
      if (key === 'displays') continue;
      assert.ok(SHEET_KEYS.includes(key), `${key} is offered, so it must stand on the sheet`);
      assert.equal(clampToBounds(key, value, s), value, `${key} → ${value} must be reachable`);
    }
  }
});

test('the player count caps every slider that addresses a Rank (CONTEXT.md, RankPoolDepth)', () => {
  const s = stand({ players: 12 });
  assert.deepEqual(boundsFor('depth', s), { min: 1, max: 12 });
  assert.equal(boundsFor('ranked', s).max <= 12, true);
});

test('ranked never offers more winner packs than the ranks hold — the overhang is reached by a second slider sinking, not here (#61)', () => {
  const s = stand();
  assert.equal(boundsFor('ranked', s).max, Math.min(s.plan.rank.winners, s.plan.players));
});

test('a trailing slider left alone reads its number off the plan, not off the null in Settings', () => {
  const s = stand();
  assert.equal(s.settings.depth, null);
  assert.equal(effectiveValue('depth', s), s.plan.depth);
  assert.equal(effectiveValue('tournamentPacks', s), s.plan.pool.packs);
  assert.equal(effectiveValue('ranked', s), s.plan.allocation.ranked);
  assert.equal(effectiveValue('winnerPacks', s), s.plan.pool.winners);
});

test('a pinned trailing slider reads its own number back', () => {
  const s = stand({ depth: 5, winnerPacks: 7 });
  assert.equal(effectiveValue('depth', s), 5);
  assert.equal(effectiveValue('winnerPacks', s), 7);
});

test('a pinned value over its cap is never cut — it is read back whole (ADR 0006)', () => {
  // boosterRate down to 1 puts the cap of participationBooster under the
  // pinned 6; the number the sheet shows stays 6.
  const s = stand({ participationBooster: 6, boosterRate: 1 });
  assert.equal(boundsFor('participationBooster', s).max, 1);
  assert.equal(effectiveValue('participationBooster', s), 6);
});

test('a cap that sank under a pinned value stops the way out, never the way back', () => {
  const s = stand({ participationBooster: 6, boosterRate: 1 });
  // The cap itself is untouched — it is still what the stand allows.
  assert.equal(boundsFor('participationBooster', s).max, 1);
  // What the control is drawn from takes the standing value in, so the thumb
  // shows 6 and the counter's minus is still allowed.
  assert.deepEqual(reachFor('participationBooster', s), { min: 0, max: 6 });
  assert.equal(clampToBounds('participationBooster', 5, s), 5, 'one step down is reachable');
  assert.equal(clampToBounds('participationBooster', 7, s), 6, 'further out is not');
});

test('reach is the cap itself wherever the value stands inside it', () => {
  const s = stand();
  assert.deepEqual(reachFor('players', s), boundsFor('players', s));
  assert.equal(reachFor('curve', s), null);
});

test('setting clamps to the same bounds the counter and the typed field are drawn from', () => {
  const s = stand();
  assert.equal(clampToBounds('players', 400, s), 400);
  assert.equal(clampToBounds('players', 1, s), 2);
  assert.equal(clampToBounds('rankFloor', -3, s), 0);
  assert.equal(clampToBounds('curve', 'steep', s), 'steep');
  assert.equal(clampToBounds('curve', 'nonsense', s), null);
  assert.equal(clampToBounds('depthStep', 'topHalf', s), 'topHalf');
  assert.equal(clampToBounds('combinedHandout', true, s), true);
});

/* ── The typed field (#113) ─────────────────────────────────────────────── */

test('a typed field reads a whole number and nothing else', () => {
  assert.equal(typedNumber('523'), 523);
  assert.equal(typedNumber(' 42 '), 42);
  assert.equal(typedNumber('-3'), -3);
  assert.equal(typedNumber('+7'), 7);
  // Not a number: nothing is written, and the field falls back (#113 AC 12).
  // `Number('')` is 0, which is the trap an emptied field would walk into.
  for (const text of ['', '   ', 'abc', '12x', '1.5', '1e3', '0x10', null, undefined]) {
    assert.equal(typedNumber(text), null, JSON.stringify(text));
  }
});

test('a typed number past the former stop is what gets written (#113, the measured 523)', () => {
  const s = stand({ players: 128, tournamentPacks: 512 }, TOURNAMENT_TYPES[2]);
  assert.equal(typedValueAfter('tournamentPacks', '523', s), 523);
});

test('a typed number that changes nothing writes nothing — the stand it shows is the one it would set', () => {
  const s = stand();
  // `tournamentPacks` is `auto` and shows the 32 the core computed: typing 32
  // back is not a handling, so it may not become a pin (#113 AC 11).
  assert.equal(s.settings.tournamentPacks, null);
  assert.equal(typedValueAfter('tournamentPacks', '32', s), null);
  assert.equal(typedValueAfter('players', ' 32 ', s), null);
  assert.equal(typedValueAfter('players', 'abc', s), null);
  assert.equal(typedValueAfter('players', '', s), null);
  assert.equal(typedValueAfter('players', '33', s), 33);
});

test('a typed number holds at a wall, and at a minimum', () => {
  const s = stand({ players: 128, boosterRate: 9, participationBooster: 6 });
  assert.equal(typedValueAfter('judgeBooster', '2000', s), 384);
  assert.equal(typedValueAfter('players', '1', s), 2);
  assert.equal(typedValueAfter('displaySize', '0', s), 1);
});

test('a pinned value over a wall is never cut by typing at it, and typing down leaves it (ADR 0006)', () => {
  const s = stand({ participationBooster: 6, boosterRate: 1 });
  assert.equal(boundsFor('participationBooster', s).max, 1, 'the wall sank under the pin');
  assert.equal(effectiveValue('participationBooster', s), 6, 'the pin stands');
  // Further out is held at the value that stands, which writes nothing …
  assert.equal(typedValueAfter('participationBooster', '9', s), null);
  // … and the way down is open, also past the wall in one go.
  assert.equal(typedValueAfter('participationBooster', '3', s), 3);
  assert.equal(typedValueAfter('participationBooster', '0', s), 0);
});

test('a type switch replaces the sheet but carries every pinned value across (#64 AC 7)', () => {
  const weekly = stand({ curve: 'extreme' }, TOURNAMENT_TYPES[0]);
  const release = stand({ curve: 'extreme' }, TOURNAMENT_TYPES[2]);
  // Release's own sheet says `gentle`; the pin outranks it.
  assert.equal(effectiveValue('curve', release), 'extreme');
  // Everything not pinned does follow the new sheet.
  assert.equal(effectiveValue('boosterRate', weekly), 3);
  assert.equal(effectiveValue('boosterRate', release), 9);
});

/* ── The two set at the tile (#66) ──────────────────────────────────────── */

/**
 * The DisplayReservation and the `manual` share of the WinnerPackAllocation
 * are the two Settings fields no slider carries: both name a `Rank`, and the
 * `Rank` is the tile (#61, "The tiles and their grip"). Their caps live beside
 * the sliders' all the same, because #61 gives caps one home — "Schieber und
 * Zählwerk kennen denselben Deckel, sonst schiebt das eine über das andere
 * hinaus" — and a second home would let the tile and the sheet disagree about
 * the same stand.
 *
 * The rule they are measured against is #61's, verbatim:
 *
 * > Ein Anschlag darf keinen Zustand verhindern, den ADR 0002 gemeldet haben
 * > will.
 */

/** The reservation vector as it stands, read off the Settings the plan carries. */
const vectorOf = (s) => (s.settings.displays ?? []).map((v) => Number(v) || 0);

/** `d₁ ≥ d₂ ≥ …`, written out here rather than imported: a test that borrows
 *  the predicate under test cannot disagree with it. */
function rises(vector) {
  for (let i = 1; i < vector.length; i++) if ((vector[i] ?? 0) > (vector[i - 1] ?? 0)) return true;
  return false;
}

/** The vector a handling would produce, built naively and without trimming. */
function vectorWith(vector, rank, count) {
  const next = vector.slice();
  while (next.length < rank) next.push(0);
  next[rank - 1] = count;
  return next;
}

test('the reservation never rises over the ranks — the rank above caps the tile below it', () => {
  // displaySize 2 makes a two-display prefix cheap enough to stand, so the
  // monotonicity cap is measured on its own and not through a pool that is
  // empty anyway.
  const s = stand({ displaySize: 2, displays: [2, 2] });
  assert.equal(s.plan.conflict, null, 'the stand itself has to be a standing one');
  // Rank 2 may not pass rank 1 …
  assert.equal(canReserveDisplays(2, 3, s), false);
  // … and rank 1 may not sink under rank 2, which is the same rule read downward.
  assert.equal(canReserveDisplays(1, 1, s), false);
  // Level with the rank above is not "over" it.
  assert.equal(canReserveDisplays(3, 2, s), true);
});

test('a display the RankPool cannot carry is never offered (maintainer decision on #66, 2026-09-27)', () => {
  const s = stand();
  // 32 boosters in the RankPool, 24 to a display: one stands, two do not.
  assert.equal(s.plan.rank.booster, 32);
  assert.equal(s.settings.displaySize, 24);
  assert.equal(canReserveDisplays(1, 1, s), true);
  assert.equal(canReserveDisplays(1, 2, s), false);
  assert.deepEqual(reservedDisplaysAfter(1, 1, s), [1]);
  assert.equal(reservedDisplaysAfter(1, 2, s), null);
});

test('a reservation left standing over a sunk cap is never cut, and the way back is never a wall (ADR 0006)', () => {
  // The display was reserved at 32 players; the count then fell to 8 and the
  // RankPool with it. ADR 0006 forbids trimming the stored value …
  const s = stand({ displays: [1], players: 8 });
  assert.deepEqual(vectorOf(s), [1]);
  assert.deepEqual(s.plan.displayVector, [1]);
  assert.ok(s.plan.conflict, 'the stand really is the one a sunk cap leaves behind');
  // … and the cap still does its whole job outward …
  assert.equal(canReserveDisplays(1, 2, s), false);
  // … while the one way back down stays open. A cap that walled this off would
  // delete the only handling that clears the conflict it is standing in.
  assert.equal(canReserveDisplays(1, 0, s), true);
  assert.deepEqual(reservedDisplaysAfter(1, 0, s), []);
});

test('an overtake stays reachable, over a second slider that follows afterwards (#61, ADR 0002)', () => {
  // Reserved at 96 players: it stands, and nothing is overtaken yet.
  const before = stand({ players: 96 });
  assert.deepEqual(reservedDisplaysAfter(1, 1, before), [1]);
  const reserved = stand({ players: 96, displays: [1] });
  assert.equal(reserved.plan.overtake, null);
  assert.equal(reserved.plan.conflict, null);
  // The second slider follows: at 128 players the curve below rank 1 passes
  // the settled 24, and the plan reports it instead of refusing it.
  const after = stand({ players: 128, displays: [1] });
  assert.deepEqual(after.plan.overtake, { under: 1, over: 2, has: 24, gets: 28 });
  // The reservation that produced it is still one the tile would set today.
  assert.equal(canReserveDisplays(1, 1, stand({ players: 128 })), true);
});

test('an orphaned reservation stays reachable, over the depth that follows afterwards (#61, ADR 0002)', () => {
  const before = stand({ players: 96, displays: [1] });
  assert.equal(before.plan.orphanedReservation, null);
  // Rank 2 takes its display at the tile — offered, because the RankPool
  // carries both.
  assert.deepEqual(reservedDisplaysAfter(2, 1, before), [1, 1]);
  const both = stand({ players: 96, displays: [1, 1] });
  assert.equal(both.plan.conflict, null);
  // Served ranks then sinks under rank 2, and the promise on it is reported
  // rather than quietly read away.
  const after = stand({ players: 96, displays: [1, 1], depth: 1 });
  assert.deepEqual(after.plan.orphanedReservation, { ranks: [2] });
});

/**
 * The grid the property below sweeps: stands with and without a standing
 * reservation, poor and rich RankPools, and the two player counts that put the
 * overtake on either side of its threshold.
 */
const TILE_STANDS = [
  stand(),
  stand({ displays: [1] }),
  stand({ players: 96 }),
  stand({ players: 96, displays: [1] }),
  stand({ players: 128, displays: [1] }),
  stand({ players: 8, displays: [1] }),
  stand({ displaySize: 2 }),
  stand({ displaySize: 2, displays: [2, 2] }),
  stand({ displaySize: 2, displays: [3, 1], rankFloor: 8 }),
  stand({ players: 48, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 64, displays: [2, 1] }, TOURNAMENT_TYPES[2]),
];

test('capped is monotonicity, the rank above and the reservation condition — and nothing else (#66 AC 11)', () => {
  let refused = 0;
  const offeredDespite = { overtake: 0, orphanedReservation: 0, unclaimedRemainder: 0 };
  for (const s of TILE_STANDS) {
    const vector = vectorOf(s);
    for (let rank = 1; rank <= Math.min(5, s.plan.players); rank++) {
      for (let count = 0; count <= 4; count++) {
        const current = vector[rank - 1] ?? 0;
        if (count === current) continue;
        const naive = vectorWith(vector, rank, count);
        const probe = distribute({ ...s.settings, displays: naive });
        if (!canReserveDisplays(rank, count, s)) {
          refused += 1;
          // Every refusal names one of the two capped rules. Read off the
          // core's own `conflict` field, never re-derived here.
          assert.ok(
            rises(naive) || (count > current && probe.conflict),
            `rank ${rank} → ${count} was refused without a rule to refuse it`,
          );
          continue;
        }
        // And the three states ADR 0002 wants reported are never a reason to
        // refuse: they are counted here so a cap that quietly swallowed them
        // would show up as a zero.
        for (const key of Object.keys(offeredDespite)) if (probe[key]) offeredDespite[key] += 1;
      }
    }
  }
  assert.ok(refused > 0, 'a sweep that refuses nothing measures no cap at all');
  assert.ok(offeredDespite.overtake > 0, 'an overtake must stay settable at the tile');
  assert.ok(offeredDespite.orphanedReservation > 0, 'an orphaned reservation must stay settable');
  assert.ok(offeredDespite.unclaimedRemainder > 0, 'a reservation over the whole depth must stay settable');
});

test('the tile writes winner packs into the same counters as the rest of the app, and ranked is not among them', () => {
  const s = stand();
  // One winner pack is still `open`, so the tile may place it …
  assert.equal(s.plan.allocation.open, 1);
  assert.deepEqual(manualWinnerAfter(5, 1, s), { 5: 1 });
  // … and once it is placed, there is none left to place anywhere.
  const placed = stand({ manualWinner: { 5: 1 } });
  assert.equal(placed.plan.allocation.open, 0);
  assert.equal(canPlaceWinner(7, 1, placed), false);
  // What `ranked` handed out is not the tile's to take back: rank 1 carries a
  // winner pack by rank, and the tile's minus finds nothing of its own there.
  assert.equal(placed.plan.rows[0].winners, 1);
  assert.equal(placed.plan.allocation.manual[1] ?? 0, 0);
  assert.equal(canPlaceWinner(1, 0, placed), false);
  // On the rank it did place, it takes it back — and the counter empties
  // rather than keeping a zero.
  assert.deepEqual(manualWinnerAfter(5, 0, placed), {});
});

test('a rank beyond the player count is addressed by nothing, the tile included (CONTEXT.md, RankPoolDepth)', () => {
  const s = stand({ players: 8 });
  assert.equal(canReserveDisplays(9, 1, s), false);
  assert.equal(canPlaceWinner(9, 1, s), false);
});
