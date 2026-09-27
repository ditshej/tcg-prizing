import test from 'node:test';
import assert from 'node:assert/strict';

import { NEUTRAL_SLIDERS, resolveSettings, TRAILING_SLIDERS } from '../public/core/defaults.mjs';
import { distribute, unfit } from '../public/core/distribute.mjs';
import { decode } from '../public/link/decode.mjs';
import { KEYS } from '../public/link/encode.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

const typeOf = (id) => TOURNAMENT_TYPES.find((entry) => entry.id === id);

/** The whole read path of #49, from a query string to a flat `Settings`. */
function settingsFrom(query, gameSheet = GAME) {
  const read = decode(query);
  return resolveSettings({ game: gameSheet, type: typeOf(read.type), pins: read.pins });
}

test('a link names its base in every case, version included', () => {
  const read = decode('?v=1&game=onepiece&type=weekend');
  assert.equal(read.version, 1);
  assert.equal(read.game, 'onepiece');
  assert.equal(read.type, 'weekend');
  assert.deepEqual(read.pins, {});
});

/**
 * Everything out of a URL is a string, and the core reads its Settings fields
 * with `Number.isFinite` — a string falls to the fallback without a word, and
 * `distribute` is total (ADR 0002) so it never complains. Measured on #49:
 * `distribute({players: '32', boosterRate: '3', rankFloor: '2', depth: '8'})`
 * returns a fully plausible plan for two players. The read path is the place
 * that turns text into numbers, so this is the one seam where it has to hold.
 */
test('an int key arrives as a number, never as the string it was in the URL', () => {
  const { pins } = decode('?v=1&game=onepiece&type=weekend&players=32&rankFloor=2&depth=8');
  assert.deepEqual(pins, { players: 32, rankFloor: 2, depth: 8 });
  for (const value of Object.values(pins)) assert.equal(typeof value, 'number');
});

test('the two composite values come back as the vector and the map the core takes', () => {
  const { pins } = decode('?v=1&game=onepiece&type=weekend&displays=2.1.1&manualWinner=3:1,7:2');
  assert.deepEqual(pins.displays, [2, 1, 1]);
  assert.deepEqual(pins.manualWinner, { 3: 1, 7: 2 });
});

/**
 * A value that cannot become what its key is, is unreadable input (#51) — it
 * is named, not quietly handed on as the leaf value. The fallback net and the
 * report that carries it are #51's; all this ticket owes them is that the loss
 * is visible instead of silent.
 */
test('a value that does not fit its key is named, never passed off as the sheet value', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&rankFloor=banana&curve=flat&combinedHandout=2');
  assert.deepEqual(read.pins, {});
  assert.deepEqual(read.unreadable, ['rankFloor', 'curve', 'combinedHandout']);
});

test('a named step reads as its id, and a pinned no reads as `false`', () => {
  const { pins } = decode('?v=1&game=onepiece&type=weekend&curve=steep&combinedHandout=0');
  assert.equal(pins.curve, 'steep');
  assert.equal(pins.combinedHandout, false);
});

/**
 * The three-level chain of ADR 0003 and 0005: the Game's complete sheet, the
 * chosen TournamentType's deviations on top, the link's pins above both.
 */
test('the chosen type overrides the Game sheet, and a pin overrides them both', () => {
  const settings = settingsFrom('?v=1&game=onepiece&type=weekend&curve=gentle');
  assert.equal(settings.displaySize, GAME.displaySize); // untouched by either level
  assert.equal(settings.participationBooster, 1); // the weekend deviation
  assert.equal(settings.curve, 'gentle'); // the pin, over the type's `steep`
});

test('an absent trailing slider is null, not a sheet value — the core is to compute it', () => {
  const settings = settingsFrom('?v=1&game=onepiece&type=weekend');
  for (const key of ['tournamentPacks', 'depth', 'ranked', 'winnerPacks']) {
    assert.equal(settings[key], null, `${key} should be null when the link does not name it`);
  }
});

test('an absent neutral slider is the empty value, and a fresh one per call', () => {
  const first = settingsFrom('?v=1&game=onepiece&type=weekend');
  const second = settingsFrom('?v=1&game=onepiece&type=weekend');
  assert.deepEqual(first.displays, []);
  assert.deepEqual(first.manualWinner, {});
  assert.notEqual(first.displays, second.displays);
  assert.notEqual(first.manualWinner, second.manualWinner);
});

test('every other absent slider is the sheet value the chosen type resolves to', () => {
  const settings = settingsFrom('?v=1&game=onepiece&type=release');
  const release = typeOf('release');
  for (const { key, absent } of KEYS) {
    if (absent !== 'leaf') continue;
    assert.equal(settings[key], release[key] ?? GAME[key], `${key} should read off the sheet`);
  }
  assert.equal(settings.depthStep, release.depthStep); // never in the link, always on the sheet
});

/**
 * The register says what an absent key means and this function acts on it;
 * they are written down twice, in two layers that may not import one another,
 * so the only thing keeping them together is this test.
 */
test('what resolveSettings treats as trailing and neutral is what the register calls null and empty', () => {
  const byAbsent = (kind) => KEYS.filter((k) => k.absent === kind).map((k) => k.key);
  assert.deepEqual(byAbsent('null'), TRAILING_SLIDERS);
  assert.deepEqual(byAbsent('empty').sort(), Object.keys(NEUTRAL_SLIDERS).sort());
});

/**
 * The tracer through every layer of the read path: a string in, the measured
 * row out. The numbers are #46's, `## Tests` → "Gemessene Pläne": Weekend 32
 * with `d` = (1) is `24·16·9·5·3·3·2·2`. Read there, never computed from what
 * the core happens to return today (AGENTS.md).
 *
 * It is also the guard against the string trap: were `players` handed on as
 * `'32'`, the core would read it with `Number.isFinite`, fall to 2 and hand
 * back a perfectly plausible plan for two players — and this row would be the
 * only thing to notice.
 */
test('a link of Weekend 32 with one Display on Rank 1 comes out as the measured row', () => {
  const plan = distribute(settingsFrom('?v=1&game=onepiece&type=weekend&players=32&displays=1'));
  assert.deepEqual(
    plan.rows.slice(0, 8).map((row) => row.booster),
    [24, 16, 9, 5, 3, 3, 2, 2],
  );
});

/**
 * A value from the link is a pinned value like any other: over a cap it stands
 * and the ConflictNotice shows the ways out (ADR 0006, ADR 0007). The ranges
 * of #46 are guards at the control and belong to Spec 2 — this layer applies
 * none of them.
 */
test('a depth over the cap stands, with the conflict hanging off the plan instead of a cut value', () => {
  const settings = settingsFrom('?v=1&game=onepiece&type=weekend&players=32&displays=1&depth=30');
  const plan = distribute(settings);
  assert.equal(settings.depth, 30);
  assert.equal(plan.depthCap, 21); // #46, `## Tests` → "Der Tiefendeckel"
  assert.equal(plan.depth, 30);
  assert.ok(plan.conflict, 'a depth the RankPool cannot carry is reported, not clamped');
  assert.ok(unfit(plan));
});

test('all eighteen slider keys read at once, each as the kind of value its key is', () => {
  const query =
    '?v=1&game=onepiece&type=weekend' +
    '&players=48&boosterRate=4&tournamentPacks=50&envelopeSize=9&envelopeYield=2' +
    '&displaySize=24&participationBooster=1&participationPack=1&judgeBooster=2&judgeWinner=1' +
    '&rankFloor=3&depth=10&curve=severe&ranked=4&winnerPacks=7' +
    '&manualWinner=3:1,7:2&displays=2.1.1&combinedHandout=1';
  const { pins, unreadable } = decode(query);

  assert.deepEqual(unreadable, []);
  assert.deepEqual(
    Object.keys(pins),
    KEYS.map((k) => k.key),
  );
  assert.deepEqual(pins.displays, [2, 1, 1]);
  assert.deepEqual(pins.manualWinner, { 3: 1, 7: 2 });
  assert.equal(pins.curve, 'severe');
  assert.equal(pins.combinedHandout, true);
  const ints = KEYS.filter((k) => k.type === 'int').map((k) => k.key);
  for (const key of ints) assert.equal(typeof pins[key], 'number', `${key} should be a number`);
});

test('resolveSettings is pure: same input, same result, and no sheet is touched', () => {
  const sheet = { ...GAME };
  const type = typeOf('weekend');
  const pins = { players: 48 };
  const first = resolveSettings({ game: GAME, type, pins });
  const second = resolveSettings({ game: GAME, type, pins });

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  first.players = 2;
  first.displays.push(9);
  assert.deepEqual(GAME, sheet);
  assert.deepEqual(pins, { players: 48 });
  assert.equal(second.players, 48);
  assert.deepEqual(second.displays, []);
});
