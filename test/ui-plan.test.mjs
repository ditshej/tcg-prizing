import test from 'node:test';
import assert from 'node:assert/strict';

import { decode } from '../public/link/decode.mjs';
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

/** What `decode('')` answers on its own — the reason the cold start reads nothing. */
test('the empty query would decode as a link from the future', () => {
  const read = decode('', [{ id: 'onepiece', types: [{ id: 'weekend' }] }]);
  assert.equal(read.version, null);
  assert.notEqual(read.report, null);
  assert.ok(read.report.entries.some((entry) => entry.kind === 'futureVersion'));
});
