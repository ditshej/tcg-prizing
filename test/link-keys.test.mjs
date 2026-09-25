import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_KEYS, CURRENT_VERSION, KEYS } from '../public/link/encode.mjs';

/**
 * The register, transcribed by hand from Spec 3 (#47) — the eighteen Settings
 * fields from #46 without `depthStep`, in the order `encode()` must write
 * them. `absent` is what a missing key means: 'null' for the four trailing
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

test('the register lists all eighteen slider keys, in wire order, each classified by what its absence means', () => {
  assert.deepEqual(
    KEYS.map((k) => [k.key, k.absent]),
    EXPECTED,
  );
});

test('depthStep and RaffleRange never reach the wire — neither key appears anywhere in the register', () => {
  const names = [...BASE_KEYS, ...KEYS].map((k) => k.key);
  assert.ok(!names.includes('depthStep'));
  assert.ok(!names.includes('raffleRange'));
});

test('every key carries a value type, and the two composites carry their string shape', () => {
  const byKey = Object.fromEntries(KEYS.map((k) => [k.key, k]));
  assert.equal(byKey.curve.type, 'curveId');
  assert.equal(byKey.combinedHandout.type, 'bit');
  assert.ok(KEYS.every((k) => typeof k.type === 'string' && k.type.length > 0));

  assert.match(byKey.displays.shape, /index 0 = Rank 1/);
  assert.match(byKey.manualWinner.shape, /ascending by rank/);
});
