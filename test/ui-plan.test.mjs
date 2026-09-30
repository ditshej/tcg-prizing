import test from 'node:test';
import assert from 'node:assert/strict';

import { decode } from '../public/link/decode.mjs';
import { TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { planApp } from '../public/ui/plan.mjs';

/**
 * The wiring of #89, at the only seam it has: `planApp()` takes the two
 * unproven functions of #47 as one argument, and the app hands it the real
 * pair. A test hands it a pair that remembers instead, so the whole rule —
 * when the address bar is written, and with what — is provable under
 * `node --test` although `location.mjs` itself never is.
 *
 * Nothing here reaches into the component: what is asserted is what a reader
 * of the address bar would see, plus the two fields the surface tickets read
 * (#72's report, #64's pins).
 */
function opened(query = '') {
  const written = [];
  const app = planApp({ read: () => query, write: (url) => written.push(url) });
  return { app, written };
}

/**
 * The cold start, and it is the case the exception of #50 was built for: the
 * app was opened without a link, nothing is in circulation, and changing the
 * address because somebody opened the page is a movement without a
 * counterpart (#47, "Writing the address bar").
 *
 * The report has to stay `null` too, and that is the sharper half: `decode('')`
 * finds no `v` and answers with a report carrying `unreadableVersion` plus two
 * fallback entries. Handed on, it would make #72's overlay call a plain visit
 * a broken link — and, since a broken link is one the address bar is cleaned
 * up for (Lauf 10, "Entscheid K1"), it would also write an address nobody
 * linked to. Nothing was read, so nothing is reported and nothing is written.
 */
test('a cold start leaves the address bar alone and reports nothing', () => {
  const { app, written } = opened('');
  assert.deepEqual(written, []);
  assert.equal(app.linkReport, null);
});

test('the cold start is the state a fresh app has always shown', () => {
  const { app } = opened('');
  assert.equal(app.gameId, 'onepiece');
  assert.equal(app.typeId, 'weekly');
  assert.deepEqual(app.pins, {});
});

/**
 * #89 AC 2 and AC 3: the first pin writes the whole base with it, every
 * further one writes the address on. The strings are the register's order
 * (#48), not the order the pins were set in — a link is compared by eye.
 */
test('the first pin writes the base along with it, and every further pin writes on', () => {
  const { app, written } = opened('');
  app.setSlider('rankFloor', 3);
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekly&rankFloor=3']);

  app.setSlider('players', 48);
  assert.equal(written.length, 2);
  assert.equal(written.at(-1), '?v=1&game=onepiece&type=weekly&players=48&rankFloor=3');
});

/** The two composite sliders are set at the tile, not at a slider, and they are
 *  pins like any other (ADR 0006, CONTEXT.md `SetupLink`). */
test('a reservation set at the tile reaches the address bar', () => {
  const { app, written } = opened('');
  app.setDisplays(1, 1);
  assert.deepEqual(app.pins.displays, [1]);
  assert.equal(written.at(-1), '?v=1&game=onepiece&type=weekly&displays=1');
});

/**
 * #89 AC 5, at the seam it is asked about: what the screen produced, read back
 * through `decode()`, is the stand the screen holds — base and pins, nothing
 * added. Twelve decisions out of one pin is what `encode(plan.settings)` would
 * have written (Befund G3), and this is the assertion that would see it.
 */
test('what the screen wrote decodes back into the stand the screen holds', () => {
  const { app, written } = opened('');
  app.setSlider('rankFloor', 3);
  app.setSlider('curve', 'steep');
  app.setDisplays(1, 1);
  app.setManualWinner(4, 1);
  assert.deepEqual(Object.keys(app.pins).sort(), ['curve', 'displays', 'manualWinner', 'rankFloor']);

  const read = decode(written.at(-1), [{ id: 'onepiece', types: [...TOURNAMENT_TYPES] }]);
  assert.equal(read.game, app.gameId);
  assert.equal(read.type, app.typeId);
  assert.deepEqual(read.pins, app.pins);
  assert.equal(read.report, null);
});

/**
 * #89 AC 6, the read edge: an incoming link runs `decode()` → `migrate()` and
 * the stand it yields **applies at once**, pinned, with nothing waiting for a
 * click (#47, "Reading a link"). A value past a cap would stand too; nothing
 * here clamps (ADR 0006).
 */
test('an incoming link opens with its own stand, pinned', () => {
  const { app } = opened('?v=1&game=onepiece&type=weekend&players=48&rankFloor=3&curve=steep');
  assert.equal(app.typeId, 'weekend');
  assert.deepEqual(app.pins, { players: 48, rankFloor: 3, curve: 'steep' });
  assert.equal(app.settings.players, 48);
  assert.equal(app.plan.players, 48);
  assert.equal(app.linkReport, null);
});

/** The report of a lossless read is `null` — the loss is what it hangs on, not
 *  the reading (ADR 0007, Nachtrag #48). A clean link says nothing. */
test('a clean link is written back unchanged and says nothing', () => {
  const clean = '?v=1&game=onepiece&type=weekend&players=48';
  const { app, written } = opened(clean);
  assert.deepEqual(written, [clean]);
  assert.equal(app.linkReport, null);
});

/**
 * The hole K6 and #50's exception tore between them, and the Lauf 9 decision
 * that closes it: a link came in, nothing of it survived the reading, and the
 * opening place still writes what holds. Were the rule hung on `pins`, this
 * address would stay as it arrived and claim a slider the screen does not show.
 */
test('a link whose every slider was unreadable is still cleaned up', () => {
  const { app, written } = opened('?v=1&game=onepiece&type=weekend&rankFloor=fuenf');
  assert.deepEqual(app.pins, {});
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekend']);
  assert.deepEqual(app.linkReport.entries, [{ kind: 'unreadableValue', key: 'rankFloor' }]);
});

/** The base caught by the fallback net is written back as what holds, too —
 *  the screen shows the first of the list, so the address says so. */
test('a base no chain ever knew is written back as the one that holds', () => {
  const { app, written } = opened('?v=1&game=yugioh&type=monthly&players=48');
  assert.equal(app.gameId, 'onepiece');
  assert.equal(app.typeId, 'weekly');
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekly&players=48']);
  assert.ok(app.linkReport.entries.some((entry) => entry.kind === 'gameReplaced'));
});

/**
 * The one link the opening place leaves alone (#47): writing our version over
 * it would devalue a link a newer app could still read in full. The base is
 * taken so there is a type to stand on; no slider key is read.
 */
test('a link from the future leaves the address bar standing', () => {
  const { app, written } = opened('?v=99&game=onepiece&type=weekend&players=48');
  assert.deepEqual(written, []);
  assert.deepEqual(app.pins, {});
  assert.equal(app.typeId, 'weekend');
  assert.ok(app.linkReport.entries.some((entry) => entry.kind === 'futureVersion'));
  assert.equal(app.linkReport.resaveBookmark, false);
});

/**
 * The other half of Lauf 10 "Entscheid K1", and the case it was decided over:
 * a link that lost its `v=1&` on the way through a chat client. It looks like
 * the future link from the inside — no slider read — and it is the opposite
 * of it from the outside. Before the decision this address stayed standing
 * word for word while the screen showed 32 players and the header said
 * "Weekend"; now the opening place cleans up after it, K6 and Lauf 9 applying
 * without exception because there *was* input to read.
 *
 * All five forms, because the decision names all five and because the pass
 * that missed this one had checked exactly one.
 */
test('a link with no readable version has its address bar cleaned up', () => {
  const forms = [
    '?game=onepiece&type=weekend&rankFloor=3&players=48',
    '?v=&game=onepiece&type=weekend&rankFloor=3&players=48',
    '?v=0&game=onepiece&type=weekend&rankFloor=3&players=48',
    '?v=abc&game=onepiece&type=weekend&rankFloor=3&players=48',
    '?v=1.0&game=onepiece&type=weekend&rankFloor=3&players=48',
  ];
  for (const query of forms) {
    const { app, written } = opened(query);
    assert.deepEqual(written, ['?v=1&game=onepiece&type=weekend'], query);
    assert.deepEqual(app.pins, {}, query);
    assert.equal(app.typeId, 'weekend', query);
    assert.ok(
      app.linkReport.entries.some((entry) => entry.kind === 'unreadableVersion'),
      query,
    );
    assert.equal(app.linkReport.resaveBookmark, true, query);
  }
});

/** …and the first drag overwrites it anyway, which is the price #47 accepts. */
test('the first pin after a future link takes the address over', () => {
  const { app, written } = opened('?v=99&game=onepiece&type=weekend&players=48');
  app.setSlider('rankFloor', 3);
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekend&rankFloor=3']);
});

/**
 * A link with no pin at all is a link in circulation — so the Set block moves
 * the address with it, although not one pin stands. This is the same
 * distinction once more: the origin of the state, not the number of pins.
 */
test('a Set switch under a pinless incoming link moves the address', () => {
  const { app, written } = opened('?v=1&game=onepiece&type=weekend');
  app.setType('release');
  assert.equal(written.at(-1), '?v=1&game=onepiece&type=release');
});

/** …and on a cold start it does not: nothing is in circulation yet. */
test('a Set switch on a cold start leaves the address bar alone', () => {
  const { app, written } = opened('');
  app.setType('release');
  assert.deepEqual(written, []);
  assert.equal(app.typeId, 'release');
});

/** What `decode('')` answers on its own — the reason the cold start reads nothing. */
test('the empty query would decode as a broken link', () => {
  const read = decode('', [{ id: 'onepiece', types: [{ id: 'weekend' }] }]);
  assert.equal(read.version, null);
  assert.notEqual(read.report, null);
  assert.ok(read.report.entries.some((entry) => entry.kind === 'unreadableVersion'));
});
