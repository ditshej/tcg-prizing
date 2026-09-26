import test from 'node:test';
import assert from 'node:assert/strict';

import { rankSegments } from '../public/ui/diagram.mjs';

test('a settled row reserves its full booster count and shapes nothing (K1: rows[].reserved, not .reservation)', () => {
  // The Rank row the K1 correction is built on: a settled Rank 1 whose
  // whole booster count went to its DisplayReservation.
  const row = { rank: 1, booster: 24, reserved: 24, floor: 0, settled: true };
  assert.deepEqual(rankSegments(row), { reservation: 24, floor: 0, shaped: 0 });
});

test('an unsettled row keeps its floor and shapes what booster is left after floor and reservation', () => {
  const row = { rank: 5, booster: 40, reserved: 0, floor: 6, settled: false };
  assert.deepEqual(rankSegments(row), { reservation: 0, floor: 6, shaped: 34 });
});

test('shaped never goes negative even if reservation and floor together exceed the booster count', () => {
  const row = { rank: 2, booster: 10, reserved: 10, floor: 3, settled: false };
  assert.deepEqual(rankSegments(row), { reservation: 10, floor: 3, shaped: 0 });
});

test('a missing settled defaults to not-settled, keeping the floor segment (main has not merged #78/#55 yet)', () => {
  const row = { rank: 3, booster: 20, reserved: 5, floor: 4 };
  assert.deepEqual(rankSegments(row), { reservation: 5, floor: 4, shaped: 11 });
});
