import test from 'node:test';
import assert from 'node:assert/strict';

import { decode } from '../public/link/decode.mjs';
import { CURRENT_VERSION } from '../public/link/keys.mjs';
import { TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';

/**
 * The catalogue the fallback net judges a base against: the Games in list
 * order, each with its TournamentTypes in list order. It is a **parameter**,
 * the same shape of decision as #47's step list — the register knows what a
 * key means, it cannot know which Games exist. There is no Game index module
 * on disk today (`public/sets/onepiece.mjs` exports a sheet, not an id), so
 * this literal is where the wire name `onepiece` of #47's example URL meets
 * the sheet.
 */
const GAMES = [{ id: 'onepiece', types: TOURNAMENT_TYPES }];

test('a clean link reports nothing at all', () => {
  const { report } = decode('?v=1&game=onepiece&type=weekend&players=32&rankFloor=5');
  assert.equal(report, null);
});

test('a single unreadable value makes the report exist, with one entry', () => {
  const { report } = decode('?v=1&game=onepiece&type=weekend&rankFloor=fuenf');
  assert.ok(report, 'a link that lost something is not silent');
  assert.equal(report.from, 1);
  assert.equal(report.to, CURRENT_VERSION);
  assert.equal(report.migrated, false);
  assert.deepEqual(report.entries, [{ kind: 'unreadableValue', key: 'rankFloor' }]);
});

/**
 * A higher number is the link saying "you cannot read this", so not one slider
 * key is interpreted and the address bar stays put (#47, `## Unreadable input
 * and the fallback net`). The link names eighteen keys here, one of them with
 * a bent value and one unknown — and none of that reaches the report: a single
 * `futureVersion` entry is the whole finding.
 */
test('a link from the future reads no slider key at all, and says so in one entry', () => {
  const read = decode(
    '?v=2&game=onepiece&type=weekend&players=48&rankFloor=banana&displays=2.-1&nonsense=1',
  );
  assert.deepEqual(read.pins, {});
  assert.deepEqual(read.unreadable, []);
  assert.deepEqual(read.report.entries, [{ kind: 'futureVersion', from: 2 }]);
  assert.equal(read.report.migrated, false);
  assert.equal(read.report.to, CURRENT_VERSION);
});

test('a missing or unreadable version is the future case too, and its `from` is null', () => {
  for (const query of ['?game=onepiece&type=weekend&players=48', '?v=zwei&game=onepiece&players=48']) {
    const read = decode(query);
    assert.equal(read.version, null, query);
    assert.deepEqual(read.pins, {}, query);
    assert.deepEqual(read.report.entries, [{ kind: 'futureVersion', from: null }], query);
  }
});

/**
 * There is no v0 (#47, `## The wire format`): a version below one names no
 * format we ever had, so it is unreadable rather than old, and falls into the
 * same case as an absent one.
 */
test('a version below one is unreadable, not an old link to be lifted', () => {
  const read = decode('?v=0&game=onepiece&type=weekend&players=48');
  assert.equal(read.version, null);
  assert.deepEqual(read.report.entries, [{ kind: 'futureVersion', from: null }]);
});

/**
 * The net catches a name **no chain ever knew** — a hand-bent URL, a type that
 * left a list without a migration. It asserts no preserved result; it only
 * prevents the typeless state ADR 0003 does not have (ADR 0007, Nachtrag #44).
 */
test('a type nobody knows falls to the first of the list, and the report says so', () => {
  const read = decode('?v=1&game=onepiece&type=freitagsrunde&players=32', GAMES);
  assert.equal(read.type, 'weekly');
  assert.deepEqual(read.report.entries, [
    { kind: 'typeReplaced', was: 'freitagsrunde', now: 'weekly', by: 'fallback' },
  ]);
  assert.deepEqual(read.pins, { players: 32 }, 'the readable half of the link still opens');
});

/** "Ein `Game` verhält sich im Netz genau wie ein `TournamentType`" (#51). */
test('a game nobody knows falls to the first of the list, exactly as a type does', () => {
  const read = decode('?v=1&game=magic&type=weekend&players=32', GAMES);
  assert.equal(read.game, 'onepiece');
  assert.equal(read.type, 'weekend', 'the type is judged against the game that caught it');
  assert.deepEqual(read.report.entries, [
    { kind: 'gameReplaced', was: 'magic', now: 'onepiece', by: 'fallback' },
  ]);
});

test('a base the link never names is a bent link, and falls to the first of both lists', () => {
  const read = decode('?v=1&players=32', GAMES);
  assert.equal(read.game, 'onepiece');
  assert.equal(read.type, 'weekly');
  assert.deepEqual(read.report.entries, [
    { kind: 'gameReplaced', was: null, now: 'onepiece', by: 'fallback' },
    { kind: 'typeReplaced', was: null, now: 'weekly', by: 'fallback' },
  ]);
});

/**
 * The net can only judge a name against a catalogue, so without one it judges
 * nothing and the base passes through as it stood. That is the read path of
 * #49 unchanged — and the reason this parameter can be added without touching
 * a single caller.
 */
test('without a catalogue the net does not run and the base passes through as read', () => {
  const read = decode('?v=1&game=magic&type=freitagsrunde&players=32');
  assert.equal(read.game, 'magic');
  assert.equal(read.type, 'freitagsrunde');
  assert.equal(read.report, null);
});

/**
 * Without this the pinned link in Discord stays the old version forever and
 * the loss repeats at every open — so the call to save the bookmark again is
 * part of what the report *says*, not a sentence Spec 2 happens to add
 * (#47, `## The report`; ADR 0007).
 */
test('a report that cost the link something asks for the bookmark to be saved again', () => {
  assert.equal(decode('?v=1&game=onepiece&type=weekend&rankFloor=fuenf').report.resaveBookmark, true);
  assert.equal(decode('?v=1&game=onepiece&type=weekend&rankfloor=5').report.resaveBookmark, true);
  assert.equal(
    decode('?v=1&game=magic&type=weekend', GAMES).report.resaveBookmark,
    true,
    'the net caught the base, so the address bar no longer says what the link said',
  );
});

/**
 * The one case where it does not ask: a link from the future leaves the
 * address bar untouched (#47), so there is nothing new to save — and the link
 * in the bookmark is the *better* one, readable again by a newer app. Asking
 * here would invite overwriting a good link with a downgraded copy.
 */
test('a link from the future does not ask for the bookmark to be saved again', () => {
  assert.equal(decode('?v=2&game=onepiece&type=weekend&players=48').report.resaveBookmark, false);
});

/**
 * "Je genau ein Eintrag" holds for **both** kinds of loss, at the same grain:
 * one entry per key name, whatever the URL repeated. The two kinds are told
 * apart — the key typo and the value typo lose the same slider, but a reader
 * who is to fix the link needs to know which of the two it was.
 */
test('each kind of loss is one entry per key name, and the two kinds stay apart', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&rankFloor=fuenf&rankfloor=5&rankfloor=6');
  assert.deepEqual(read.report.entries, [
    { kind: 'unreadableValue', key: 'rankFloor' },
    { kind: 'unknownKey', key: 'rankfloor' },
  ]);
});

/**
 * A DisplayReservation is one slider's one value, so a bent limb throws the
 * whole vector and the report keeps that whole loss — it does not shrink to
 * the limb (decided at #49, "Entscheid K4"; the grain was left to this
 * ticket). The entry names the **slider that is gone**, because that is what
 * the reader has to set again; "limb 2 was negative" names something that is
 * not a slider and leaves the actual loss unsaid. Same for the winner card.
 */
test('a whole-loss value is one entry naming the slider, not one per bent limb', () => {
  const vector = decode('?v=1&game=onepiece&type=weekend&displays=2.-1.-3');
  assert.deepEqual(vector.report.entries, [{ kind: 'unreadableValue', key: 'displays' }]);

  const card = decode('?v=1&game=onepiece&type=weekend&manualWinner=3:1,7:2,3:5,7:9');
  assert.deepEqual(card.report.entries, [{ kind: 'unreadableValue', key: 'manualWinner' }]);
});

/**
 * A value from the link is a pinned value like any other; over a cap it stands
 * and the ConflictNotice shows the ways out (ADR 0006, ADR 0007). It lost
 * nothing, so there is nothing to report — a link-side clamp is expressly
 * forbidden (`docs/agents/setup-link.md`), and so is treating the value as a
 * loss.
 */
test('a value of the right type but past every stop is taken, and the report stays silent', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&depth=30&players=100000&rankFloor=-8', GAMES);
  assert.deepEqual(read.pins, { players: 100000, rankFloor: -8, depth: 30 });
  assert.equal(read.report, null);
});

/**
 * Every case of #47's table in one link: each contributes exactly one entry,
 * and the order is the frame first — the base, then what the sliders lost.
 */
test('the cases add up, one entry each, base before sliders', () => {
  const read = decode('?v=1&game=magic&type=freitagsrunde&rankFloor=fuenf&rankfloor=5', GAMES);
  assert.deepEqual(read.report.entries, [
    { kind: 'gameReplaced', was: 'magic', now: 'onepiece', by: 'fallback' },
    { kind: 'typeReplaced', was: 'freitagsrunde', now: 'weekly', by: 'fallback' },
    { kind: 'unreadableValue', key: 'rankFloor' },
    { kind: 'unknownKey', key: 'rankfloor' },
  ]);
});

/**
 * "Der Zukunftsfall ruft `writeLocation` nicht auf" (#51) — proven
 * **structurally**, and the reason is worth writing down: `writeLocation` is
 * #50's, it lives in `public/link/location.mjs`, and on this branch that file
 * does not exist. There is nothing to spy on, and a stub of it would prove
 * only that the stub was not called.
 *
 * So the proof is one size larger and one size blunter than a spy: the read
 * path does not touch the address bar **in any case at all** — it names no
 * import of `location.mjs`, and the words `location` and `replaceState` do not
 * occur in it. A layer that cannot write the address bar cannot write it in
 * the future case either.
 *
 * What it does not cover, said plainly: it says nothing about the **caller**.
 * Whoever wires decode into the shell may still call `writeLocation` after
 * reading a link from the future, and that is exactly what #47 forbids. That
 * guard belongs to the ticket that owns the wiring; this one can only make
 * sure the guard is not needed here.
 */
test('the read path cannot write the address bar — not in the future case, not in any case', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/link/decode.mjs', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.ok(!/location\.mjs/.test(code), 'no import of the second seam');
  assert.ok(!/\blocation\b/.test(code), 'the word `location` does not occur');
  assert.ok(!/replaceState|history\b/.test(code), 'neither does `replaceState`');
  assert.ok(!/writeLocation/.test(code), 'and `writeLocation` is never named');
});
