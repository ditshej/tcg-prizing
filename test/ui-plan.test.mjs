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
 * finds no `v`, falls into the future-version branch and answers with a report
 * carrying `futureVersion` plus two fallback entries. Handed on, it would make
 * #72's overlay say "this link is newer than this app" to everyone who merely
 * opens the page. Nothing was read, so nothing is reported.
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

/** What `decode('')` answers on its own — the reason the cold start reads nothing. */
test('the empty query would decode as a link from the future', () => {
  const read = decode('', [{ id: 'onepiece', types: [{ id: 'weekend' }] }]);
  assert.equal(read.version, null);
  assert.notEqual(read.report, null);
  assert.ok(read.report.entries.some((entry) => entry.kind === 'futureVersion'));
});
