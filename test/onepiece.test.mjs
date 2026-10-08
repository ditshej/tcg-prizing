import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

/**
 * The presettable Settings fields, taken from `## Input: Settings` of #46 —
 * never derived from what `distribute.mjs` reads today. The core only reads a
 * part of these fields so far (#57 wires in the rest), so a list read off the
 * code would be too short and would make both this list and the completeness
 * test below pass for the wrong reason (#54, comment from #53).
 *
 * Excluded on purpose, each for its own reason spelled out in #46 and #54:
 * - the four trailing sliders (`tournamentPacks`, `depth`, `ranked`,
 *   `winnerPacks`): `null` means "the core computes", so their starting value
 *   is a calculation, not sheet data.
 * - the two Rank-addressing fields (`displays`, `manualWinner`): a sheet may
 *   never preset something that names a Rank, so these always start neutral.
 */
const PRESETTABLE_FIELDS = [
  'players',
  'boosterRate',
  'envelopeSize',
  'envelopeYield',
  'displaySize',
  'participationBooster',
  'participationPack',
  'judgeBooster',
  'judgeWinner',
  'rankFloor',
  'depthStep',
  'curve',
  'combinedHandout',
];

const NEVER_PRESET = ['displays', 'manualWinner'];
const TRAILING_SLIDERS = ['tournamentPacks', 'depth', 'ranked', 'winnerPacks'];

/**
 * The Game sheet's values, transcribed from the resolution comment of #21 —
 * which spells the sheet out in full precisely so the next session reads it
 * back instead of recomputing it from plan numbers — with the three values
 * #145's table decided anew on 2026-10-08: `players` 40, `depthStep`
 * `topThird`, `curve` `moderate`. #145 is the source of those three now; #21
 * carries a note pointing at it.
 */
const EXPECTED_GAME = {
  players: 40,
  boosterRate: 3,
  envelopeSize: 9,
  envelopeYield: 1,
  displaySize: 24,
  participationBooster: 2,
  participationPack: 1,
  judgeBooster: 0,
  judgeWinner: 0,
  rankFloor: 2,
  depthStep: 'topThird',
  curve: 'moderate',
  combinedHandout: false,
};

/**
 * The deviations of each TournamentType, transcribed from #21 (weekend) and
 * the resolution comment of #25 (release), with #145's table on top: weekend's
 * curve is `firm` (was `steep`), and release carries `players: 64` as a
 * deviation of its own (it inherited 32 before). `release` still inherits
 * `rankFloor`, `displaySize` and `combinedHandout` — #25 point 6 is explicit
 * that a Release does not carry the CombinedHandout preset. Weekend inherits
 * the Game's `players: 40` and `depthStep: 'topThird'`; #145 records that the
 * maintainer accepted that knowingly.
 */
const EXPECTED_TYPES = [
  { id: 'weekly', title: 'Weekly' },
  { id: 'weekend', title: 'Weekend', participationBooster: 1, curve: 'firm' },
  {
    id: 'release',
    title: 'Release',
    players: 64,
    boosterRate: 9,
    participationBooster: 6,
    envelopeSize: 32,
    envelopeYield: 2,
    depthStep: 'all',
    curve: 'gentle',
  },
];

/**
 * The completeness test compares the **whole** field list with deepEqual, the
 * pattern `test/link-keys.test.mjs` uses for the SetupLink register (#48). An
 * `every(hasOwn)` over the same list would pass by construction: shortening
 * the list shortens the standard it is measured against, and two mistakes
 * cover for each other (the trap named in #54's comment from #53).
 */
/** The sheet without its name: `id` is what the sheet is called, not a value
 *  it presets (#64, "Entscheid K3"). */
function fieldsOf(sheet) {
  const { id, ...fields } = sheet;
  return fields;
}

test('the Game sheet names every presettable variable from #46, in the order the spec lists them', () => {
  assert.deepEqual(Object.keys(fieldsOf(GAME)), PRESETTABLE_FIELDS);
});

test('the Game sheet carries the values #21 wrote down and #145 decided anew, not values computed back from a plan', () => {
  assert.deepEqual(fieldsOf(GAME), EXPECTED_GAME);
});

/**
 * The sheet carries its own name, and it leads. #64's "Entscheid K3" settled
 * that against the shape this file had first — a constant beside the sheet —
 * because the read path judges a link's Game against a catalogue of sheets
 * (`link/decode.mjs`, `catchBase`: `games.find((entry) => entry.id === game)`),
 * and a catalogue can only fall out of the sheets if a sheet is named.
 */
test('the Game sheet carries its own id, and it is the name a SetupLink writes', () => {
  assert.equal(GAME.id, 'onepiece');
  assert.equal(Object.keys(GAME)[0], 'id', 'the name leads the sheet');
});

test('each TournamentType carries the deviations #21, #25 and #145 wrote down, and nothing else', () => {
  assert.deepEqual(TOURNAMENT_TYPES, EXPECTED_TYPES);
});

test('no sheet presets displays or the manual share of the WinnerPackAllocation — they always start neutral', () => {
  const sheets = [GAME, ...TOURNAMENT_TYPES];
  for (const sheet of sheets) {
    for (const field of NEVER_PRESET) {
      assert.ok(!Object.hasOwn(sheet, field), `'${field}' must never appear in a sheet`);
    }
  }
});

test('the four trailing sliders sit in no sheet — their starting value is a calculation', () => {
  const sheets = [GAME, ...TOURNAMENT_TYPES];
  for (const sheet of sheets) {
    for (const field of TRAILING_SLIDERS) {
      assert.ok(!Object.hasOwn(sheet, field), `'${field}' must never appear in a sheet`);
    }
  }
});

test('TOURNAMENT_TYPES is a list in code — its order is meaningful, not a surface sort', () => {
  assert.ok(Array.isArray(TOURNAMENT_TYPES));
});

/** The fields an entry deviates in, over the Game sheet — id and title carry no Settings meaning. */
function deviationCount(entry) {
  const { id, title, ...rest } = entry;
  return Object.keys(rest).length;
}

test('weekly carries nothing but its title — the first TournamentType is the Game as-is', () => {
  const weekly = TOURNAMENT_TYPES.find((t) => t.id === 'weekly');
  assert.equal(TOURNAMENT_TYPES[0], weekly, 'weekly must be the first entry (ADR 0003)');
  assert.equal(deviationCount(weekly), 0);
});

test('weekend deviates from the Game sheet in exactly two values', () => {
  const weekend = TOURNAMENT_TYPES.find((t) => t.id === 'weekend');
  assert.equal(deviationCount(weekend), 2);
});

/**
 * Seven since #145. Before it, #54's acceptance criterion also said seven, and
 * that was a miscount: #25's table lists `davon RankPool 3` as a row of its
 * own, but that is `boosterRate` minus `participationBooster`, a derived
 * number and not a Settings field. That correction still holds — the seventh
 * value now is `players: 64`, a deviation #145 added, not the derived row. The
 * seven deviating fields are `players`, `boosterRate`, `participationBooster`,
 * `envelopeSize`, `envelopeYield`, `depthStep` and `curve`.
 */
test('release deviates from the Game sheet in exactly seven values', () => {
  const release = TOURNAMENT_TYPES.find((t) => t.id === 'release');
  assert.equal(deviationCount(release), 7);
});

/**
 * A sheet read as Settings: the Game's values, the TournamentType's deviations
 * on top. The four trailing sliders stay `null`, which is what the core reads
 * as "compute it" — so this is the sheet alone, no hand-placed override.
 */
function settingsFor(id) {
  const type = TOURNAMENT_TYPES.find((t) => t.id === id);
  return { ...GAME, ...type, tournamentPacks: null, depth: null, ranked: null, winnerPacks: null };
}

/** The Booster share of every served Rank, as a row of numbers. */
function servedBoosters(plan) {
  return plan.rows.filter((row) => row.served).map((row) => row.booster);
}

/**
 * The measured plans of the three sheets. Until #145 these were the numbers of
 * #46 (`## Tests`) and #21's resolution comment, measured on the prototype and
 * worked out by hand. #145 decided new sheet values and no new plans, so the
 * rows below are re-measured: the real `distribute()` run on #145's sheets on
 * 2026-10-08, never computed from the old rows. They still say what the sheets
 * are *for*, where the field lists above only say what shape they have —
 * without this test a sheet of freely invented values passes everything else.
 *
 * Weekly, 40 Players: RankPool 40, depth ⌈40/3⌉ = 14, floor 2 · 14 + 1 = 29,
 * ShapedRemainder 11 — the curve runs out at Rank 5.
 * Weekend, 40 Players: RankPool 80, depth 14, ShapedRemainder 51.
 * Release, 64 Players: RankPool 192, all 64 Ranks served, ShapedRemainder 63 —
 * the curve runs out at Rank 19.
 */
test('weekly at 40 players distributes the measured 7·5·4·3·3 over nine floors of 2', () => {
  assert.deepEqual(
    servedBoosters(distribute(settingsFor('weekly'))),
    [7, 5, 4, 3, 3, ...new Array(9).fill(2)],
  );
});

test('weekend at 40 players distributes the measured 26·15·9·6·4·3·3 over seven floors of 2', () => {
  assert.deepEqual(
    servedBoosters(distribute(settingsFor('weekend'))),
    [26, 15, 9, 6, 4, 3, 3, ...new Array(7).fill(2)],
  );
});

test('release at 64 players serves all ranks, the curve running out at Rank 19', () => {
  assert.deepEqual(
    servedBoosters(distribute(settingsFor('release'))),
    [13, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 4, ...new Array(7).fill(3), ...new Array(45).fill(2)],
  );
});

test('every curve and depthStep entry names a rule the core actually carries', () => {
  const curveIds = new Set(CURVES.map((c) => c.id));
  for (const sheet of [GAME, ...TOURNAMENT_TYPES]) {
    if (Object.hasOwn(sheet, 'curve')) assert.ok(curveIds.has(sheet.curve), sheet.curve);
    if (Object.hasOwn(sheet, 'depthStep')) assert.ok(DEPTH_STEPS.includes(sheet.depthStep), sheet.depthStep);
  }
});
