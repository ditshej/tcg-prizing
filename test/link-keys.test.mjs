import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_KEYS, CHOICE_KEYS, CURRENT_VERSION, KEYS } from '../public/link/keys.mjs';
import { DEPTH_STEPS, RANGES } from '../public/core/rules.mjs';
import { readValue, UNREADABLE } from '../public/link/decode.mjs';

/**
 * The register, transcribed by hand from Spec 3 (#47) — the nineteen Settings
 * fields from #46, `depthStep` right after `depth` since run 12 (K1 on #72),
 * in the order `encode()` must write them. `absent` is what a missing key means: 'null' for the four trailing
 * sliders (the core computes it), 'empty' for the two that start neutral
 * (they name no Rank), 'leaf' for every other slider (the DefaultSet leaf
 * value).
 */
const EXPECTED = [
  ['players', 'leaf'],
  ['boosterRate', 'leaf'],
  ['tournamentPacks', 'null'],
  ['envelopeSize', 'leaf'],
  ['envelopeYield', 'leaf'],
  ['displaySize', 'leaf'],
  ['participationBooster', 'leaf'],
  ['participationPack', 'leaf'],
  ['judgeBooster', 'leaf'],
  ['judgeWinner', 'leaf'],
  ['rankFloor', 'leaf'],
  ['depth', 'null'],
  ['depthStep', 'leaf'],
  ['curve', 'leaf'],
  ['ranked', 'null'],
  ['winnerPacks', 'null'],
  ['manualWinner', 'empty'],
  ['displays', 'empty'],
  ['combinedHandout', 'leaf'],
];

test('the wire format starts at version 1, there is no v0', () => {
  assert.equal(CURRENT_VERSION, 1);
});

test('the base names the Game and TournamentType, always, ahead of every slider', () => {
  assert.deepEqual(
    BASE_KEYS.map((k) => k.key),
    ['v', 'game', 'type'],
  );
});

test('the register lists all nineteen slider keys, in wire order, each classified by what its absence means', () => {
  assert.deepEqual(
    KEYS.map((k) => [k.key, k.absent]),
    EXPECTED,
  );
});

test('the RaffleRange is a key of its own beside the sliders, never one of them (run 12, K1b on #72)', () => {
  assert.ok(!KEYS.some((k) => k.key === 'raffleRange'), 'it is no Settings field and no slider');
  assert.deepEqual(
    CHOICE_KEYS.map((k) => [k.key, k.type, k.term]),
    [['raffleRange', 'rangeId', 'all']],
    'an absent key means the term constant `all`',
  );
});

test('a step name is read off DEPTH_STEPS and a range id off RANGES, anything else is unreadable', () => {
  for (const step of DEPTH_STEPS) assert.equal(readValue('stepId', step), step);
  assert.equal(readValue('stepId', 'bottomHalf'), UNREADABLE, 'a lower step is no depth step');
  assert.equal(readValue('stepId', 'topFifth'), UNREADABLE);
  for (const { id } of RANGES) assert.equal(readValue('rangeId', id), id);
  assert.equal(readValue('rangeId', 'topFifth'), UNREADABLE);
});

test('every key carries a value type, and the two composites carry their string shape', () => {
  const byKey = Object.fromEntries(KEYS.map((k) => [k.key, k]));
  assert.equal(byKey.curve.type, 'curveId');
  assert.equal(byKey.combinedHandout.type, 'bit');
  assert.ok(KEYS.every((k) => typeof k.type === 'string' && k.type.length > 0));

  assert.match(byKey.displays.shape, /index 0 = Rank 1/);
  assert.match(byKey.manualWinner.shape, /ascending by rank/);
});
