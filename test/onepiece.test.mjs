import test from 'node:test';
import assert from 'node:assert/strict';

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

test('the Game sheet names every presettable variable from #46, including the expected player count', () => {
  for (const field of PRESETTABLE_FIELDS) {
    assert.ok(
      Object.hasOwn(GAME, field),
      `Game sheet is missing '${field}' — an incomplete Game is a bug, not a runtime fallback (ADR 0003)`,
    );
  }
  assert.ok(Object.hasOwn(GAME, 'players'), 'the expected player count belongs on the Game sheet');
});

test('the completeness check fails as soon as a presettable variable is missing on the Game level', () => {
  const { curve, ...incomplete } = GAME;
  assert.ok(
    PRESETTABLE_FIELDS.some((field) => !Object.hasOwn(incomplete, field)),
    'removing a presettable field must be visible to the completeness check',
  );
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

test('release deviates from the Game sheet in exactly seven values', () => {
  const release = TOURNAMENT_TYPES.find((t) => t.id === 'release');
  assert.equal(deviationCount(release), 7);
});

test('every curve and depthStep entry names a rule the core actually carries', () => {
  const curveIds = new Set(CURVES.map((c) => c.id));
  for (const sheet of [GAME, ...TOURNAMENT_TYPES]) {
    if (Object.hasOwn(sheet, 'curve')) assert.ok(curveIds.has(sheet.curve), sheet.curve);
    if (Object.hasOwn(sheet, 'depthStep')) assert.ok(DEPTH_STEPS.includes(sheet.depthStep), sheet.depthStep);
  }
});
