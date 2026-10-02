import test from 'node:test';
import assert from 'node:assert/strict';

import { decode } from '../public/link/decode.mjs';
import { CURRENT_VERSION } from '../public/link/keys.mjs';

/**
 * The catalogue the fallback net judges a base against: the Games in list
 * order, each with its TournamentTypes in list order. It is a **parameter**,
 * the same shape of decision as #47's step list — the register knows what a
 * key means, it cannot know which Games exist.
 *
 * Since Lauf 8, "Entscheid K3" a Game sheet carries its own `id` and the
 * catalogue falls out of the sheets. These are **fixture sheets**: the real one
 * grows its id in #64 and lands separately, and a read path that only ever met
 * the one sheet on disk would prove nothing about a second Game anyway.
 */
const SHEETS = [
  { id: 'onepiece', players: 32, boosterRate: 3, rankFloor: 2 },
  { id: 'gundam', players: 16, boosterRate: 2, rankFloor: 1 },
];

const TYPES = {
  onepiece: [{ id: 'weekly' }, { id: 'weekend', participationBooster: 1 }, { id: 'release' }],
  gundam: [{ id: 'casual' }],
};

const GAMES = SHEETS.map((sheet) => ({ ...sheet, types: TYPES[sheet.id] }));

/**
 * "Der Leseweg gibt ein Leseergebnis zurück, Stand und Protokoll darin" (Lauf
 * 8, "Entscheid K1"). The tournament state is what the sliders show, the
 * report is what went wrong while reading, and both arise in the same pass —
 * so both come back in the same object, at every stage, and no caller carries
 * them side by side. `migrate()` writes on into the same report (#47).
 */
test('the read result is one object: the state and the log of the read together', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&rankFloor=fuenf', GAMES);
  assert.deepEqual(Object.keys(read).sort(), [
    'choices',
    'game',
    'pins',
    'report',
    'type',
    'unknown',
    'unreadable',
    'version',
  ]);
  assert.deepEqual(read.pins, { players: 32 }, 'the state is what could be read');
  assert.ok(read.report, 'and the log of what could not sits in the same object');
});

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
  assert.deepEqual(read.unknown, {}, 'not one key is looked at, known or not');
  assert.deepEqual(read.report.entries, [{ kind: 'futureVersion', from: 2 }]);
  assert.equal(read.report.migrated, false);
  assert.equal(read.report.to, CURRENT_VERSION);
});

/**
 * The counterpart, and the whole of Lauf 10 "Entscheid K1": a link with no
 * readable `v` is **broken**, not newer than this app. Its slider keys go
 * unread for the same reason — without a version we would be guessing which
 * register to read them by — but everything the report says about it differs.
 * `v=0` is a link from the *past*, and the four other forms name no version at
 * all; calling any of them "from the future" is a false statement, not a rough
 * edge of the cut.
 *
 * All five forms in one table because the decision names all five, and because
 * the bug it fixes was found in exactly one of them.
 */
test('a link with no readable version is broken, not from the future', () => {
  const cases = [
    ['?game=onepiece&type=weekend&players=48', null],
    ['?v=&game=onepiece&type=weekend&players=48', ''],
    ['?v=0&game=onepiece&type=weekend&players=48', '0'],
    ['?v=abc&game=onepiece&type=weekend&players=48', 'abc'],
    ['?v=1.0&game=onepiece&type=weekend&players=48', '1.0'],
  ];
  for (const [query, was] of cases) {
    const read = decode(query);
    assert.equal(read.version, null, query);
    assert.deepEqual(read.pins, {}, query);
    assert.deepEqual(read.report.entries, [{ kind: 'unreadableVersion', was }], query);
    assert.equal(read.report.from, null, query);
    assert.equal(read.report.to, CURRENT_VERSION, query);
  }
});

/**
 * The half of the entry that is not its name: the broken link asks for the
 * bookmark to be saved again, and the link from the future is the one case
 * that suppresses it. The reason the future case gives — the bookmark is the
 * better copy, readable in full by a newer app — is exactly what does not hold
 * for a link no later app will ever read.
 */
test('the broken link asks for the bookmark again, the future one does not', () => {
  const broken = decode('?game=onepiece&type=weekend&players=48').report;
  const future = decode('?v=99&game=onepiece&type=weekend&players=48').report;
  assert.deepEqual(broken.entries, [{ kind: 'unreadableVersion', was: null }]);
  assert.deepEqual(future.entries, [{ kind: 'futureVersion', from: 99 }]);
  assert.equal(broken.resaveBookmark, true);
  assert.equal(future.resaveBookmark, false);
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
/**
 * The catalogue falls out of the sheets because a sheet carries its own `id`
 * (Lauf 8, "Entscheid K3"): whether the caller hands over the whole sheet with
 * a type list beside it or just the two fields the net reads, the same link
 * reads the same way. The read path looks at `id` and `types` and at nothing
 * else — it must not grow a second idea of which Games exist.
 */
test('the catalogue falls out of the sheets, however the caller composes it', () => {
  const whole = decode('?v=1&game=magic&type=freitagsrunde&players=48', GAMES);
  const lean = decode(
    '?v=1&game=magic&type=freitagsrunde&players=48',
    GAMES.map(({ id, types }) => ({ id, types })),
  );
  assert.deepEqual(lean, whole);
  assert.equal(whole.game, 'onepiece');
});

/** A Game's type list is its own, so the second Game judges by its own list. */
test('a type is judged against the Game that caught it, not against the first list', () => {
  const read = decode('?v=1&game=gundam&type=weekend&players=48', GAMES);
  assert.equal(read.game, 'gundam');
  assert.equal(read.type, 'casual');
  assert.deepEqual(read.report.entries, [
    { kind: 'typeReplaced', was: 'weekend', now: 'casual', by: 'fallback' },
  ]);
});

/**
 * The wiring mistake this shape invites: hand over the bare sheet, which has
 * no type list. Left lenient, every valid type would be "replaced" by nothing
 * — `now: null`, a wrong report and a typeless state ADR 0003 does not have.
 * It is a programmer's mistake and not a reader's link, so it is loud.
 */
test('a catalogue entry without its type list throws instead of replacing a valid type', () => {
  const bare = SHEETS.map((sheet) => ({ ...sheet }));
  assert.throws(() => decode('?v=1&game=onepiece&type=weekend', bare), {
    name: 'TypeError',
    message: /onepiece/,
  });
  assert.throws(() => decode('?v=1&game=onepiece&type=weekend', [{ types: TYPES.onepiece }]), {
    name: 'TypeError',
    message: /string `id`/,
  });
});

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
  assert.equal(decode('?v=1&game=onepiece&type=weekend&displays=2.-1').report.resaveBookmark, true);
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
 * "Je genau ein Eintrag" holds at the grain of the key name, whatever the URL
 * repeated. An unknown slider name is **not** one of the losses this layer
 * reports since Lauf 8, "Entscheid K4": it travels on with its raw value and
 * the chain has the last word over it.
 */
test('a loss is one entry per key name, however often the URL repeats it', () => {
  const read = decode(
    '?v=1&game=onepiece&type=weekend&rankFloor=fuenf&rankFloor=sechs&rankfloor=5&rankfloor=6',
  );
  assert.deepEqual(read.report.entries, [{ kind: 'unreadableValue', key: 'rankFloor' }]);
  assert.deepEqual(read.unknown, { rankfloor: '5' }, 'the first mention is the one that travels');
});

/**
 * A slider name the register does not know is not judged here at all: it comes
 * through with its raw value, on every link alike, and only the chain decides
 * between a rename and a loss — the entry arises at the **end** of the chain
 * (Lauf 8, "Entscheid K4"; ADR 0007, Nachtrag #51). A link that only misspells
 * a key therefore reports nothing *yet*, and nothing is silently gone either.
 */
test('an unknown slider name travels on with its raw value and is no loss of this layer', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&rankfloor=5');
  assert.deepEqual(read.pins, { players: 32 }, 'unfinished values never enter pins');
  assert.deepEqual(read.unknown, { rankfloor: '5' });
  assert.deepEqual(read.unreadable, []);
  assert.equal(read.report, null, 'nothing is lost until the chain says so');
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
  const read = decode('?v=1&game=onepiece&type=weekend&depth=30&players=100000', GAMES);
  assert.deepEqual(read.pins, { players: 100000, depth: 30 });
  assert.equal(read.report, null);
});

/**
 * A minus sign is not a value past a stop, it is a value no control can
 * produce — so it is unreadable, and on every numeric key alike: `readVector`
 * had thrown out a negative limb since #49 while the single slider kept it
 * (Lauf 8, "Entscheid K2"). Same rule, same error class, same entry kind.
 */
test('a negative number is unreadable on a single slider too, exactly as in a vector', () => {
  const read = decode('?v=1&game=onepiece&type=weekend&players=32&rankFloor=-8', GAMES);
  assert.deepEqual(read.pins, { players: 32 }, 'the readable half of the link still opens');
  assert.deepEqual(read.report.entries, [{ kind: 'unreadableValue', key: 'rankFloor' }]);

  const limb = decode('?v=1&game=onepiece&type=weekend&displays=2.-1', GAMES);
  assert.deepEqual(limb.report.entries, [{ kind: 'unreadableValue', key: 'displays' }]);
});

/**
 * Every case #47's table leaves with this layer, in one link: each contributes
 * exactly one entry, and the order is the frame first — the base, then what
 * the sliders lost. The unknown key of that table has moved to the end of the
 * chain (Lauf 8, "Entscheid K4"), and rides along here to show that it adds
 * nothing to the report and takes nothing from it.
 */
test('the cases add up, one entry each, base before sliders', () => {
  const read = decode('?v=1&game=magic&type=freitagsrunde&rankFloor=fuenf&rankfloor=5', GAMES);
  assert.deepEqual(read.report.entries, [
    { kind: 'gameReplaced', was: 'magic', now: 'onepiece', by: 'fallback' },
    { kind: 'typeReplaced', was: 'freitagsrunde', now: 'weekly', by: 'fallback' },
    { kind: 'unreadableValue', key: 'rankFloor' },
  ]);
  assert.deepEqual(read.unknown, { rankfloor: '5' });
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
