import test from 'node:test';
import assert from 'node:assert/strict';

import { planApp } from '../public/ui/plan.mjs';

/**
 * The SetupLink on screen (#72): the `Copy link` button and the
 * `LinkMigration` report as the app's one overlay.
 *
 * Proven here is what falls out of the plan and the read result without a
 * picture: what the button copies, when the report stands, what it says. Where
 * the overlay lands and that it really covers everything is judged at the
 * picture (#61, `## Testing Decisions`).
 */

function opened(query = '') {
  const written = [];
  const app = planApp({ read: () => query, write: (url) => written.push(url) });
  return { app, written };
}

/** The query part of a copied link, as `URLSearchParams`. */
function paramsOf(query) {
  return new URLSearchParams(query.replace(/^\?/, ''));
}

/* ── What `Copy link` copies (#72 AC 1, AC 2; K5 on #72) ───────────────── */

test('with no pin at all, the copy form is the base and nothing else', () => {
  const { app } = opened();
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly');
});

test('one pinned control makes exactly one deviation in the copied link (K5, not encode(plan.settings))', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const params = paramsOf(app.linkQuery);
  const sliders = [...params.keys()].filter((key) => !['v', 'game', 'type'].includes(key));
  assert.deepEqual(sliders, ['rankFloor'], 'one pin is one key, never the twelve the resolved stand names');
  assert.equal(params.get('rankFloor'), '5');
  assert.equal(params.get('type'), 'weekly', 'the base stays');
});

/*
 * OPEN — red by the register, not by this file. `depthStep` is pinnable at the
 * screen (`setSlider('depthStep', …)`, the step chips of `Served ranks`, #64,
 * #67 K3), and `plan.pinned` reports it. But the v1 wire has no key for it
 * (`link/keys.mjs`, #47 "depthStep steht nicht im Link"), so `encode()` drops
 * it: measured at 48 players, sender `top quarter` → depth 12, receiver gets
 * `top 8` → depth 8. #47's reason ("reproducible from the base") holds only
 * for an unpinned step. Fixing it means a wire decision (`public/link/*`,
 * not this ticket's to write). The assertion stays as it was asked for.
 */
test('a pinned depthStep still reaches the copied link (K5: G3 measured it lost silently)', {
  todo: 'the v1 register has no depthStep key — a decision for #47/keys.mjs, see the comment above',
}, () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.deepEqual(app.plan.pinned, { depthStep: 'topQuarter' }, 'the plan reports the step as set by hand');
  assert.equal(paramsOf(app.linkQuery).get('depthStep'), 'topQuarter');
});

test('a pinned Served ranks number reaches the copied link as the one deviation', () => {
  const { app } = opened();
  app.setSlider('depth', 6);
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly&depth=6');
});

test('after a cold start the address bar stays empty, the copy form is complete all the same', () => {
  const { app, written } = opened();
  assert.deepEqual(written, [], 'nothing came in, nothing is written');
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly');
});

test('after an incoming link the base stands in both, with zero pins (run 9 on #89)', () => {
  const { app, written } = opened('?v=1&game=onepiece&type=weekend');
  assert.equal(app.pinCount, 0);
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekend']);
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekend');
});
