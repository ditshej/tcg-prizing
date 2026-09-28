import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute } from '../public/core/distribute.mjs';
import { resolveSettings } from '../public/core/defaults.mjs';
import { decode, readValue } from '../public/link/decode.mjs';
import { CURRENT_VERSION } from '../public/link/keys.mjs';
import { migrate, STEPS } from '../public/link/migrate.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

/**
 * The catalogue the fallback net judges a base against, same shape as
 * `test/link-report.test.mjs`'s fixture: a Game sheet carries its own `id`
 * (Lauf 8, "Entscheid K3"), so the catalogue falls out of it.
 */
const GAMES = [{ ...GAME, types: TOURNAMENT_TYPES }];

/**
 * The Längenprüfung: the mechanical half of the versioning rule in
 * `docs/agents/setup-link.md`. The production chain has exactly
 * `CURRENT_VERSION - 1` steps, which is zero at v1 — and this is the one test
 * of this file that fires by itself at the next real bump, without anyone
 * having to remember it (#47, "Die Längenprüfung").
 */
test('the production chain has exactly CURRENT_VERSION - 1 steps', () => {
  assert.equal(STEPS.length, CURRENT_VERSION - 1);
  assert.equal(STEPS.length, 0, 'there is no version older than v1 yet');
});

/**
 * A fixture step that renames a raw, unrecognised name into a real slider —
 * the case Lauf 8 "Entscheid K4" moved out of the read path and into here.
 * `readValue` is `decode.mjs`'s own grammar, reused rather than duplicated:
 * a renamed key is read exactly as a same-named key has always been read.
 */
function renameLegacyBoosterRate({ game, type, pins, unknown }) {
  const { legacyBoosterRate, ...rest } = unknown;
  if (legacyBoosterRate === undefined) return { game, type, pins, unknown, entries: [] };
  return {
    game,
    type,
    pins: { ...pins, boosterRate: readValue('int', legacyBoosterRate) },
    unknown: rest,
    entries: [{ kind: 'renamed', key: 'boosterRate', was: 'legacyBoosterRate' }],
  };
}

/** A fixture step that removes a slider with no successor at all. */
function dropBoosterRate({ game, type, pins, unknown }) {
  if (pins.boosterRate === undefined) return { game, type, pins, unknown, entries: [] };
  const { boosterRate, ...rest } = pins;
  return { game, type, pins: rest, unknown, entries: [{ kind: 'dropped', key: 'boosterRate' }] };
}

/**
 * A fixture step that changes what `judgeWinner` means — absolute count
 * becomes "twice as many", a stand-in for "count → fraction" from
 * `docs/agents/setup-link.md`'s table. The contract is preserving the
 * *result*, not the value (ADR 0007), so the migration recomputes it rather
 * than carrying the old number forward under its new meaning.
 */
function reinterpretJudgeWinner({ game, type, pins, unknown }) {
  if (pins.judgeWinner === undefined) return { game, type, pins, unknown, entries: [] };
  const value = pins.judgeWinner * 2;
  return {
    game,
    type,
    pins: { ...pins, judgeWinner: value },
    unknown,
    entries: [{ kind: 'setByMigration', key: 'judgeWinner', value }],
  };
}

const FIXTURE_CHAIN = [renameLegacyBoosterRate, dropBoosterRate, reinterpretJudgeWinner];

test('migrate() is a no-op on a clean link at today\'s version: no report, nothing lifted', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&rankFloor=5', GAMES);
  const result = migrate(read);
  assert.deepEqual(result.pins, read.pins);
  assert.equal(result.game, read.game);
  assert.equal(result.type, read.type);
  assert.equal(result.report, null);
});

/**
 * The trap this ticket names by name: the obvious build — "if version is
 * already current, return unchanged" — would make this test pass for the
 * wrong reason (nothing runs) and would make the *next* test (the same
 * link, but with a step that claims the name) impossible to tell apart from
 * this one. The chain has nothing to lift here — the production `STEPS` is
 * empty — but it still has to decide over `legacyBoosterRate`, and the only
 * honest decision, with no step naming it, is loss.
 */
test('a link of today\'s version with an unknown name still runs through the chain, and it is lost there — not at the read path', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&legacyBoosterRate=9', GAMES);
  assert.deepEqual(read.unknown, { legacyBoosterRate: '9' }, 'the read path does not judge the name');
  assert.equal(read.report, null, 'and does not report it either — nothing is lost yet');

  const result = migrate(read, STEPS);
  assert.deepEqual(result.pins, { players: 32 }, 'the name never became a slider');
  assert.ok(result.report, 'the chain decided, and its decision was loss');
  assert.equal(result.report.migrated, false, 'no step ran — there was nothing to lift');
  assert.deepEqual(result.report.entries, [{ kind: 'unknownKey', key: 'legacyBoosterRate' }]);
});

test('the same name arrives with its value when a step in the chain renames it', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&legacyBoosterRate=9', GAMES);
  const result = migrate(read, [renameLegacyBoosterRate]);
  assert.deepEqual(result.pins, { players: 32, boosterRate: 9 });
  assert.equal(result.report.migrated, true, 'a step ran, even though nothing about the version changed here');
  assert.deepEqual(result.report.entries, [{ kind: 'renamed', key: 'boosterRate', was: 'legacyBoosterRate' }]);
});

test('the same name is lost after the chain when no step in it claims it', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&legacyBoosterRate=9', GAMES);
  // A chain that runs (so `migrated` is honestly true) but that names a
  // different slider than the one this link carries.
  const result = migrate(read, [dropBoosterRate]);
  assert.deepEqual(result.pins, { players: 32 });
  assert.equal(result.report.migrated, true, 'a step ran');
  assert.deepEqual(result.report.entries, [{ kind: 'unknownKey', key: 'legacyBoosterRate' }]);
});

/**
 * Chaining, order, and the report entry each step produces (#52 AC 3), plus
 * "an ersatzlos entfernt slider never reappears anywhere" (#52 AC 5): the
 * rename puts `boosterRate` into `pins`, the very next step removes it
 * again, and it must stay gone — not reappear as a mechanically invented
 * value once the chain is done.
 */
test('the fixture chain runs in order, and a value the chain later drops does not reappear', () => {
  const read = decode(
    '?v=1&game=onepiece&type=weekend&players=32&legacyBoosterRate=9&judgeWinner=1',
    GAMES,
  );
  const result = migrate(read, FIXTURE_CHAIN);

  assert.equal(result.report.migrated, true);
  assert.equal(result.report.from, 1);
  assert.equal(result.report.to, 4, 'three steps ran, from v1 to a pretend v4');
  assert.deepEqual(result.report.entries, [
    { kind: 'renamed', key: 'boosterRate', was: 'legacyBoosterRate' },
    { kind: 'dropped', key: 'boosterRate' },
    { kind: 'setByMigration', key: 'judgeWinner', value: 2 },
  ]);
  assert.equal('boosterRate' in result.pins, false, 'gone for good, not reinvented downstream');
  assert.deepEqual(result.pins, { players: 32, judgeWinner: 2 });
});

/**
 * A chain that starts partway: a link already naming a later version skips
 * the steps before it — `steps.slice(version - 1)`, exercised here rather
 * than only asserted in the docblock.
 */
test('a link already read at a later version skips the steps before it', () => {
  const read = { version: 2, game: 'onepiece', type: 'weekend', pins: { players: 32 }, unknown: {}, report: null };
  const result = migrate(read, FIXTURE_CHAIN);
  assert.equal(result.report, null, 'dropBoosterRate and reinterpretJudgeWinner find nothing to touch');
});

/**
 * `setByMigration` on its own: a slider that never stood in the old link at
 * all, set to preserve the result rather than invented mechanically by the
 * app on its own (ADR 0007 draws exactly that line) — the entry names the
 * value, and it is not a rename or a drop of anything the link carried.
 */
test('a slider set by the chain that never stood in the old link gets its own entry kind', () => {
  function setParticipationPack({ game, type, pins, unknown }) {
    return {
      game,
      type,
      pins: { ...pins, participationPack: 1 },
      unknown,
      entries: [{ kind: 'setByMigration', key: 'participationPack', value: 1 }],
    };
  }
  const read = decode('?v=1&game=onepiece&type=weekend&players=32', GAMES);
  assert.equal('participationPack' in read.pins, false, 'the old link never named it');

  const result = migrate(read, [setParticipationPack]);
  assert.deepEqual(result.report.entries, [
    { kind: 'setByMigration', key: 'participationPack', value: 1 },
  ]);
  assert.equal(result.pins.participationPack, 1);
});

/**
 * "Ein Schritt, der einen TournamentType oder ein Game abschafft, nennt den
 * Nachfolger; das Auffangnetz wird dabei nicht benutzt" (#52 AC 6; ADR 0007,
 * Nachtrag #44). No catalogue is handed to `decode()` here on purpose: if the
 * migration leaned on the fallback net, there would be nothing to catch the
 * abolished name without one, and the test would fail loudly rather than
 * quietly passing for the wrong reason.
 */
test('a step that abolishes a TournamentType names its successor, without leaning on the fallback net', () => {
  function retireFreitagsrunde({ game, type, pins, unknown }) {
    if (type !== 'freitagsrunde') return { game, type, pins, unknown, entries: [] };
    return {
      game,
      type: 'weekend',
      pins,
      unknown,
      entries: [{ kind: 'typeReplaced', was: 'freitagsrunde', now: 'weekend', by: 'migration' }],
    };
  }
  const read = decode('?v=1&game=onepiece&type=freitagsrunde&players=32');
  assert.equal(read.report, null, 'no catalogue, so the read path judges nothing about the base');

  const result = migrate(read, [retireFreitagsrunde]);
  assert.equal(result.type, 'weekend');
  assert.deepEqual(result.report.entries, [
    { kind: 'typeReplaced', was: 'freitagsrunde', now: 'weekend', by: 'migration' },
  ]);
});

/** Symmetric case for a `Game`, same rule (ADR 0007, Nachtrag #44). */
test('a step that abolishes a Game names its successor, without leaning on the fallback net', () => {
  function retireOldGame({ game, type, pins, unknown }) {
    if (game !== 'onepiece-classic') return { game, type, pins, unknown, entries: [] };
    return {
      game: 'onepiece',
      type,
      pins,
      unknown,
      entries: [{ kind: 'gameReplaced', was: 'onepiece-classic', now: 'onepiece', by: 'migration' }],
    };
  }
  const read = decode('?v=1&game=onepiece-classic&type=weekend&players=32');
  const result = migrate(read, [retireOldGame]);
  assert.equal(result.game, 'onepiece');
  assert.deepEqual(result.report.entries, [
    { kind: 'gameReplaced', was: 'onepiece-classic', now: 'onepiece', by: 'migration' },
  ]);
});

/**
 * A link from the future carries nothing to lift and nothing to decide over
 * — `decode()` already read no slider key at all. Passing it through
 * unchanged is the only correct move: running any step here would risk
 * touching `game`/`type`/`pins` that the read path deliberately left alone
 * (#47, "Unreadable input and the fallback net"). A step that throws proves
 * it is never even called.
 */
test('a link from the future is passed through untouched, and the chain never runs for it', () => {
  function explodingStep() {
    throw new Error('must not be called for a future-version read');
  }
  const read = decode('?v=99&game=onepiece&type=weekend&players=48&legacyBoosterRate=9');
  const result = migrate(read, [explodingStep]);
  assert.deepEqual(result.pins, {});
  assert.equal(result.game, 'onepiece');
  assert.equal(result.type, 'weekend');
  assert.deepEqual(result.report.entries, [{ kind: 'futureVersion', from: 99 }]);
  assert.equal(result.report.resaveBookmark, false, 'the bookmark already is the better copy');
});

test('migrate() does not mutate its input, and the same read migrates the same way twice', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&legacyBoosterRate=9&judgeWinner=1', GAMES);
  const before = JSON.parse(JSON.stringify(read));

  const first = migrate(read, FIXTURE_CHAIN);
  assert.deepEqual(read, before, 'the read result passed in is untouched');

  const second = migrate(read, FIXTURE_CHAIN);
  assert.deepEqual(second, first);
});

/**
 * The second seam (`public/link/location.mjs`) is #50's rim, and this module
 * must stay as far from it as `decode.mjs` does: whether the address bar's
 * version number gets rewritten is a decision for the wiring layer (#89),
 * made by reading `report.migrated` — never something this module could
 * arrange for on its own.
 */
test('migrate() cannot write the address bar — it does not even name it', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/link/migrate.mjs', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.ok(!/location\.mjs/.test(code), 'no import of the second seam');
  assert.ok(!/\blocation\b/.test(code), 'the word `location` does not occur');
  assert.ok(!/replaceState|history\b/.test(code), 'neither does `replaceState`');
  assert.ok(!/writeLocation/.test(code), 'and `writeLocation` is never named');
});

/**
 * The tracer through every layer (#47, "Tests"): a link runs through
 * `decode`, `migrate` and `resolveSettings` into `distribute`, and lands on
 * the exact sequence #46 measures the core against — looked up from #47's
 * own body, not derived. At v1 with an empty production chain, `migrate()`
 * is a pure pass-through, and this proves that pass-through composes with
 * the rest of the pipeline rather than only with itself.
 */
test('a real link runs through decode, migrate and resolveSettings to the measured plan', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&displays=1');
  const migrated = migrate(read);
  const type = TOURNAMENT_TYPES.find((entry) => entry.id === migrated.type);
  const settings = resolveSettings({ game: GAME, type, pins: migrated.pins });
  const plan = distribute(settings);
  assert.deepEqual(
    plan.rows.slice(0, 8).map((row) => row.booster),
    [24, 16, 9, 5, 3, 3, 2, 2],
  );
});
