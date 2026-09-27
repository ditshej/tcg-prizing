import test from 'node:test';
import assert from 'node:assert/strict';

import { NEUTRAL_SLIDERS, resolveSettings, TRAILING_SLIDERS } from '../public/core/defaults.mjs';

/**
 * "Absence yields `null`, not a leaf value" (#49, AK 3) is built and right —
 * and on the real sheets it is **vacuously true**: no DefaultSet on disk
 * carries any of the four trailing sliders, so nothing there can tell a
 * working rule from a missing one. Take the rule out and the suite stays
 * green (finding G3 of the round #49·#59·#58).
 *
 * The sheets below are therefore **invented**, and that is the point: they
 * carry exactly what a real sheet never does. `depth: 99` is the tell — if it
 * ever comes back out, the chain is passing sheet data on where the core is
 * supposed to compute (ADR 0006).
 *
 * These are not a claim about what a DefaultSet may contain. They are a probe
 * for what `resolveSettings` does if one ever does.
 */
const INVENTED_GAME = {
  players: 32,
  boosterRate: 3,
  rankFloor: 2,
  tournamentPacks: 77,
  depth: 99,
  ranked: 55,
  winnerPacks: 44,
  displays: [9, 9],
  manualWinner: { 1: 9 },
};

const INVENTED_TYPE = {
  id: 'invented',
  title: 'Invented',
  rankFloor: 5,
  depth: 88,
  winnerPacks: 33,
};

test('a trailing slider on the sheet does not come out — absent means null, never 99', () => {
  const settings = resolveSettings({ game: INVENTED_GAME, type: undefined, pins: {} });
  assert.equal(settings.depth, null, 'depth must be null, not the sheet value 99');
  for (const key of TRAILING_SLIDERS) {
    assert.equal(settings[key], null, `${key} should be null even with the sheet naming it`);
  }
});

test('a trailing slider in the type deviations does not come out either', () => {
  const settings = resolveSettings({ game: INVENTED_GAME, type: INVENTED_TYPE, pins: {} });
  assert.equal(settings.depth, null, 'neither the game 99 nor the type 88');
  assert.equal(settings.winnerPacks, null);
  assert.equal(settings.rankFloor, 5, 'a non-trailing slider still takes the type deviation');
});

test('a pin is above the null: what the link names comes out, what it omits does not', () => {
  const settings = resolveSettings({
    game: INVENTED_GAME,
    type: INVENTED_TYPE,
    pins: { depth: 10 },
  });
  assert.equal(settings.depth, 10, 'the pin wins over the null');
  assert.equal(settings.tournamentPacks, null, 'the unpinned one stays for the core to compute');
});

/**
 * The same emptiness one axis over: a DefaultSet never prefills anything that
 * names a Rank (ADR 0003), and no sheet on disk does — so an invented one has
 * to say it.
 */
test('a neutral slider on the sheet does not come out — absent means the empty value', () => {
  const settings = resolveSettings({ game: INVENTED_GAME, type: INVENTED_TYPE, pins: {} });
  for (const key of Object.keys(NEUTRAL_SLIDERS)) {
    assert.notEqual(settings[key], INVENTED_GAME[key], `${key} must not be the sheet value`);
  }
  assert.deepEqual(settings.displays, []);
  assert.deepEqual(settings.manualWinner, {});
});
