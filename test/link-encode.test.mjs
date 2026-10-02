import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { decode } from '../public/link/decode.mjs';
import { addressFor, encode } from '../public/link/encode.mjs';
import { BASE_KEYS, CURRENT_VERSION, KEYS } from '../public/link/keys.mjs';

const WEEKEND = { game: 'onepiece', type: 'weekend' };

/**
 * One value per register key, so "all nineteen keys at once" is a stand this
 * file actually holds rather than a number it repeats. The values are
 * plausible, not measured — the round trip cares about the wire, not about
 * what the core makes of it; the measured plan is #49's tracer.
 */
const EVERY_SLIDER = {
  players: 32,
  boosterRate: 3,
  tournamentPacks: 40,
  envelopeSize: 12,
  envelopeYield: 4,
  displaySize: 24,
  participationBooster: 1,
  participationPack: 1,
  judgeBooster: 6,
  judgeWinner: 2,
  rankFloor: 2,
  depth: 8,
  depthStep: 'topQuarter',
  curve: 'steep',
  ranked: 17,
  winnerPacks: 5,
  manualWinner: { 3: 1, 7: 2 },
  displays: [2, 1, 1],
  combinedHandout: true,
};

test('a link names its base in every case, pinned sliders or none', () => {
  assert.equal(encode({ ...WEEKEND, pins: {} }), '?v=1&game=onepiece&type=weekend');
});

/**
 * The example query of Spec 3 (#47, `## The wire format`), transcribed: the
 * base first, then the pinned sliders in the register's order — not in the
 * order they were pinned.
 */
test('the pinned sliders follow the base in the register order, never in the order they were pinned', () => {
  const pins = { curve: 'steep', rankFloor: 2, depth: 8 };
  assert.equal(encode({ ...WEEKEND, pins }), '?v=1&game=onepiece&type=weekend&rankFloor=2&depth=8&curve=steep');
});

/** One key each, because it is one slider each — one bit per slider (ADR 0003). */
test('the two composite values are one key each, in the shape the register names', () => {
  const pins = { manualWinner: { 3: 1, 7: 2 }, displays: [2, 1, 1] };
  const query = encode({ ...WEEKEND, pins });
  assert.match(query, /&manualWinner=3:1,7:2&/);
  assert.match(query, /&displays=2\.1\.1$/);
});

test('a pinned no is a value, a pinned yes is a value — combinedHandout writes both', () => {
  assert.match(encode({ ...WEEKEND, pins: { combinedHandout: false } }), /&combinedHandout=0$/);
  assert.match(encode({ ...WEEKEND, pins: { combinedHandout: true } }), /&combinedHandout=1$/);
});

/**
 * Nothing is lost by dropping them: both composites start neutral and never
 * follow a calculation, so their pin has no effect on the result and would
 * only lengthen the link (#47, "Die zwei zusammengesetzten Werte").
 */
test('trailing zeros fall off the vector, and an all-zero vector encodes as absent', () => {
  assert.match(encode({ ...WEEKEND, pins: { displays: [2, 1, 0, 0] } }), /&displays=2\.1$/);
  assert.equal(encode({ ...WEEKEND, pins: { displays: [0, 0, 0] } }), '?v=1&game=onepiece&type=weekend');
  assert.equal(encode({ ...WEEKEND, pins: { displays: [] } }), '?v=1&game=onepiece&type=weekend');
});

test('an empty allocation card encodes as absent', () => {
  assert.equal(encode({ ...WEEKEND, pins: { manualWinner: {} } }), '?v=1&game=onepiece&type=weekend');
});

test('the allocation card is written ascending by rank, whatever order it was filled in', () => {
  const filled = { 7: 2, 3: 1 };
  assert.match(encode({ ...WEEKEND, pins: { manualWinner: filled } }), /&manualWinner=3:1,7:2$/);
});

/**
 * Only the pinned sliders and the Game/Type base reach the address; the
 * receiver rebuilds the stand from the DefaultSet plus those deviations
 * (#86/#89/#72, "Entscheid K5"). The register is what says which key is a
 * slider, so anything else in the pin set is not written — `raffleRange` above
 * all, which is no slider and travels as a choice, never as a pin
 * (`CHOICE_KEYS`, run 12 K1b on #72).
 *
 * What this **cannot** hold: `encode()` takes a pin set, and a pin set with all
 * nineteen keys is indistinguishable from a settings object with all nineteen
 * sliders — the same shape means the same link, and rightly so. Handing it
 * `plan.settings` therefore still turns one pin into nineteen, silently. That
 * is a rule about the caller and only a caller can carry it (finding G3 of run
 * 8; the wiring is #89). What is held here is the half that is a rule about the
 * wire: a key the register does not name never reaches a link.
 */
test('a key the register does not name never reaches the link', () => {
  const strays = { raffleRange: 'topHalf', nonsense: 'x' };
  assert.equal(encode({ ...WEEKEND, pins: strays }), '?v=1&game=onepiece&type=weekend');
  assert.equal(addressFor({ ...WEEKEND, pins: strays }), null);

  const query = encode({ ...WEEKEND, pins: { ...EVERY_SLIDER, ...strays } });
  const written = [...new URLSearchParams(query.slice(1)).keys()];
  assert.deepEqual(written, [...BASE_KEYS, ...KEYS].map((entry) => entry.key));
});

test('the round-trip corpus covers every key the register names, and the register names nineteen', () => {
  assert.deepEqual(Object.keys(EVERY_SLIDER), KEYS.map((entry) => entry.key));
  assert.equal(KEYS.length, 19);
});

/**
 * The pair character of `encode` and `decode`, nailed down as a test rather
 * than as a file (#49, "Entscheid K3"): a corpus of the empty pin set, every
 * single slider on its own, the two composites together, and all nineteen keys
 * at once.
 *
 * The corpus carries **canonical** values only — no trailing zero in the
 * vector, no empty card. Those are not round-trip stands but the normalisation
 * of their own test above: `[2, 1, 0]` goes out as `2.1` and comes back as
 * `[2, 1]`, on purpose.
 *
 * **Compared is the stand, not the whole return value of `decode()`.** The
 * read path hands back a reading — the stand and the record of reading it stuck
 * together — and that reading is free to grow a field: #51 adds `report`. A
 * round trip is an assertion about the *stand*, so it names the five fields it
 * means instead of demanding that `decode()` return those five and nothing
 * else. The strict form fell over the moment a field was added that the wire
 * format never lost anything to (#50, "Entscheid K1" from run 8).
 */
const STAND_OF = ({ version, game, type, pins, unreadable }) => ({ version, game, type, pins, unreadable });

test('decode(encode(x)) is x, over the whole corpus', () => {
  const corpus = [
    {},
    ...KEYS.map(({ key }) => ({ [key]: EVERY_SLIDER[key] })),
    { displays: EVERY_SLIDER.displays, manualWinner: EVERY_SLIDER.manualWinner },
    EVERY_SLIDER,
  ];

  for (const pins of corpus) {
    const read = decode(encode({ ...WEEKEND, pins }));
    assert.deepEqual(
      STAND_OF(read),
      { version: CURRENT_VERSION, game: 'onepiece', type: 'weekend', pins, unreadable: [] },
      `round trip lost something at ${JSON.stringify(pins)}`,
    );
  }
});

/**
 * A link is compared by eye and `replaceState` fires on every drag, so the
 * address must not re-sort itself because someone pinned the floor before the
 * depth (#47, "Die Reihenfolge ist fest").
 */
test('the same stand yields the same string, whatever order the pins were set in', () => {
  const forwards = {};
  for (const { key } of KEYS) forwards[key] = EVERY_SLIDER[key];
  const backwards = {};
  for (const { key } of [...KEYS].reverse()) backwards[key] = EVERY_SLIDER[key];

  assert.equal(encode({ ...WEEKEND, pins: backwards }), encode({ ...WEEKEND, pins: forwards }));
  assert.equal(encode({ ...WEEKEND, pins: { depth: 8, rankFloor: 2 } }), encode({ ...WEEKEND, pins: { rankFloor: 2, depth: 8 } }));
});

/**
 * The line between the address bar and the copy form, and it runs **between
 * two functions, not inside one** (#50, `## What to build`).
 *
 * `encode()` is the copy form and is always complete — that is the link #44
 * means, "Weekend, nothing touched". Making it return the empty string for an
 * empty pin set would satisfy "the empty address bar stays empty" and break
 * the criterion right above it. So the rule "do not write at all" is a second
 * function over the same stand: `addressFor()` answers what the address bar
 * should become, and `null` means *leave it alone*.
 *
 * It sits here rather than in `location.mjs`, which carries no logic (#47,
 * "The seam"), and rather than in the caller, which is the unproven Alpine
 * shell: a rule that decides whether a public interface writes itself into
 * someone's address bar is worth a test, and this is the only layer where it
 * gets one.
 */
test('without a single pin the address bar stays untouched', () => {
  assert.equal(addressFor({ ...WEEKEND, pins: {} }), null);
  assert.equal(addressFor({ ...WEEKEND }), null);
});

test('the first pin writes the full base along with it, in one go', () => {
  assert.equal(addressFor({ ...WEEKEND, pins: { rankFloor: 2 } }), '?v=1&game=onepiece&type=weekend&rankFloor=2');
});

/**
 * A pin whose value writes as absent is not a pin the address bar can show —
 * the copy form of that stand is the bare base, and writing it would be the
 * very movement without a counterpart that the rule forbids.
 */
test('a pin that encodes as absent leaves the address bar alone too', () => {
  assert.equal(addressFor({ ...WEEKEND, pins: { displays: [], manualWinner: {} } }), null);
});

test('past the first pin the address bar is exactly the copy form', () => {
  const setup = { ...WEEKEND, pins: EVERY_SLIDER };
  assert.equal(addressFor(setup), encode(setup));
});

/**
 * The second seam of Spec 3, as a rule over the tree (#50 AC 6). `location`
 * and `history.replaceState` are the two things in this project that are not
 * pure, and they live in two functions that are **not** proven — so that
 * everything under them can be. The moment a third place reaches for either,
 * the encoding is unproven exactly where it is public, and this test is what
 * notices.
 *
 * Scanned is what ships to a browser — `public/`, `views/`, `dev/` — minus
 * the vendored Alpine bundle, which is nobody's code here, and minus every
 * comment: naming the rule is not reaching for the API, and a file that may
 * not *call* `writeLocation`'s insides must still be free to say why.
 */
const CODE_ONLY = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * A module specifier is not a reach for the API. The seam exists to be
 * **called** from somewhere — #89 is that somewhere, and `import { writeLocation
 * } from '../link/location.mjs'` in `plan.mjs` would otherwise trip this very
 * rule over the one call it was written to protect. The importer never names
 * `window.location` or `replaceState`; it names a file. So the path is blanked
 * before the scan and nothing else is: a third place that reaches for either
 * API still turns this red, with or without an import.
 */
const WITHOUT_SPECIFIERS = (source) => source.replace(/from\s+(['"])[^'"]*\1/g, 'from _');

test('location and replaceState occur in exactly one file, and that file carries no logic', () => {
  const root = new URL('..', import.meta.url);
  const shipped = ['public', 'views', 'dev']
    .flatMap((dir) => readdirSync(new URL(dir, root), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(mjs|js|php|html)$/.test(entry.name))
      .map((entry) => `${entry.parentPath.slice(fileURLToPath(root).length)}/${entry.name}`))
    .filter((path) => !path.startsWith('public/vendor/'));

  const touching = shipped.filter((path) => {
    const source = WITHOUT_SPECIFIERS(CODE_ONLY(readFileSync(new URL(path, root), 'utf8')));
    return /\blocation\b/.test(source) || /\breplaceState\b/.test(source);
  });
  assert.deepEqual(touching, ['public/link/location.mjs']);

  // No logic: nothing imported, nothing branched, nothing looped.
  const code = CODE_ONLY(readFileSync(new URL('public/link/location.mjs', root), 'utf8'));
  assert.equal(/\b(import|if|for|while|switch|catch|\?\?|&&|\|\|)\b|\?\./.test(code), false);
});
