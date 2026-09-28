import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';
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
} from '../public/ui/controls.mjs';

/** The sheet's own reading of a stand: settings resolved, plan computed. */
function stand(pins = {}, type = TOURNAMENT_TYPES[0]) {
  const settings = resolveSettings({ game: GAME, type, pins });
  return { settings, plan: distribute(settings) };
}

test('the sheet carries seventeen controls, and they are exactly the Settings fields minus the two set at the tile', () => {
  assert.equal(SHEET_KEYS.length, 17);
  // The nineteen Settings fields of #46 (`## Input: Settings`), read off a
  // resolved stand rather than retyped, minus `displays` and `manualWinner`:
  // both name a Rank and are set at the tile, not on a slider (#66).
  const settingsFields = Object.keys(stand().settings).sort();
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

test('the guards are the ones #46 decided, read off that list and not off the prototype', () => {
  const s = stand();
  assert.deepEqual(boundsFor('players', s), { min: 2, max: 128 });
  assert.deepEqual(boundsFor('boosterRate', s), { min: 0, max: 12 });
  assert.deepEqual(boundsFor('participationPack', s), { min: 0, max: 4 });
  assert.deepEqual(boundsFor('tournamentPacks', s), { min: 0, max: 512 });
  assert.deepEqual(boundsFor('winnerPacks', s), { min: 0, max: 64 });
  assert.deepEqual(boundsFor('displaySize', s), { min: 1, max: 60 });
  assert.deepEqual(boundsFor('envelopeSize', s), { min: 1, max: 64 });
  assert.deepEqual(boundsFor('envelopeYield', s), { min: 1, max: 8 });
  assert.deepEqual(boundsFor('rankFloor', s), { min: 0, max: 8 });
});

test('the player count caps every slider that addresses a Rank (CONTEXT.md, RankPoolDepth)', () => {
  const s = stand({ players: 12 });
  assert.deepEqual(boundsFor('depth', s), { min: 1, max: 12 });
  assert.equal(boundsFor('ranked', s).max <= 12, true);
});

test('participationBooster stops at the rate it is taken from (#46, search ranges)', () => {
  assert.equal(boundsFor('participationBooster', stand({ boosterRate: 3 })).max, 3);
  assert.equal(boundsFor('participationBooster', stand({ boosterRate: 9 })).max, 9);
});

test('ranked never offers more winner packs than the ranks hold — the overhang is reached by a second slider sinking, not here (#61)', () => {
  const s = stand();
  assert.equal(boundsFor('ranked', s).max, Math.min(s.plan.rank.winners, s.plan.players));
});

test('the two judge sliders take the whole respective pool as their end, because #46 gives them no guard', () => {
  const s = stand();
  assert.deepEqual(boundsFor('judgeBooster', s), { min: 0, max: s.plan.pool.booster });
  assert.deepEqual(boundsFor('judgeWinner', s), { min: 0, max: s.plan.pool.winners });
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

test('setting clamps to the same bounds the slider and the counter are drawn from', () => {
  const s = stand();
  assert.equal(clampToBounds('players', 400, s), 128);
  assert.equal(clampToBounds('players', 1, s), 2);
  assert.equal(clampToBounds('rankFloor', -3, s), 0);
  assert.equal(clampToBounds('curve', 'steep', s), 'steep');
  assert.equal(clampToBounds('curve', 'nonsense', s), null);
  assert.equal(clampToBounds('depthStep', 'topHalf', s), 'topHalf');
  assert.equal(clampToBounds('combinedHandout', true, s), true);
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
