import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { unfit } from '../public/core/distribute.mjs';
import { HANDOUT_PINS } from '../public/core/suggest.mjs';
import { controlShown, dropConfirmation } from '../public/ui/controls.mjs';
import { conflictKind } from '../public/ui/notices.mjs';
import { planApp } from '../public/ui/plan.mjs';

/**
 * The surface half of #103: what `CombinedHandout` does on screen now that it
 * changes the core (ADR 0010). The hidden participation control (decision A),
 * the ConflictNotice of the `combinedHandoutDepth` source with its way out
 * (E3), and the notice that switching the handout back off raises over the
 * two pins that way out sets (E4).
 */

const view = (name) => readFileSync(new URL(`../views/${name}`, import.meta.url), 'utf8');

/** A fresh app on the Weekend sheet, nothing pinned. */
function app() {
  const written = [];
  const a = planApp({ read: () => '', write: (url) => written.push(url) });
  a.setType('weekend');
  a.refreshNotices();
  return { a, written };
}

/**
 * A fresh app on Weekend at 32 Players with the top 8 served — the stand the
 * handout's conflict below was written against.
 *
 * Until #145 that was the Weekend sheet as it stood; #145 moved its start
 * values to 40 Players and `topThird`. The subject here is the conflict at
 * "8 of 32", not today's start values, so this app opens on a SetupLink that
 * names the stand itself. The two values arrive pinned — the app has no other
 * way to set one — and the `depthStep` pin counts under `Served ranks`, which
 * is why only the scenarios that need "8 of 32" open here: the plain `app()`
 * above keeps the stand on which no handout pin stands at the switch.
 */
function eightOfThirtyTwo() {
  const a = planApp({ read: () => '?v=1&game=onepiece&type=weekend&players=32&depthStep=top8', write: () => {} });
  a.refreshNotices();
  return { a };
}

const open = (a, id) => a.notices.open.find((notice) => notice.id === id);

/* ── Participation boosters, hidden (A) ─────────────────────────────────── */

test('Participation boosters is hidden while the handout is combined, and only it', () => {
  assert.equal(controlShown('participationBooster', { combinedHandout: true }), false);
  assert.equal(controlShown('participationBooster', { combinedHandout: false }), true);
  assert.equal(controlShown('participationPack', { combinedHandout: true }), true, 'the packs still go to everyone');
  assert.equal(controlShown('judgeBooster', { combinedHandout: true }), true);
});

test('the hidden control keeps its value, in the pins and in the link, and has it back when the handout is off', () => {
  const { a, written } = app();
  a.setSlider('participationBooster', 2);
  a.setSlider('combinedHandout', true);
  assert.equal(a.controlShown('participationBooster'), false);
  assert.equal(a.settings.participationBooster, 2);
  assert.equal(a.isPinned('participationBooster'), true);
  assert.match(written[written.length - 1], /participationBooster=2/);

  a.setSlider('combinedHandout', false);
  assert.equal(a.controlShown('participationBooster'), true);
  assert.equal(a.value('participationBooster'), 2);
});

test('every sheet control asks whether it is shown', () => {
  const sheet = view('controls-sheet.php');
  const fn = sheet.slice(sheet.indexOf('function sheet_control('), sheet.indexOf('<?php', sheet.indexOf('function sheet_control(')));
  assert.match(fn, /x-show="controlShown\('<\?= \$k \?>'\)"/);
});

/* ── The ConflictNotice of `combinedHandoutDepth` (E3) ─────────────────── */

test('switching the handout on with the top 8 served raises the ConflictNotice with its way out', () => {
  const { a } = eightOfThirtyTwo();
  a.setSlider('combinedHandout', true);
  a.refreshNotices();
  assert.equal(conflictKind(a.plan), 'combinedHandoutDepth');
  const notice = open(a, 'conflict');
  assert.ok(notice, 'the ConflictNotice stands');
  assert.match(notice.lines[0], /only 8 of 32 ranks are served — the last 24 get no boosters/);
  assert.deepEqual(notice.actions.map((action) => action.label), ['Serve 32 ranks']);
});

test('the way out pins both values it sets, and the plan is fit afterwards', () => {
  const { a } = eightOfThirtyTwo();
  a.setSlider('rankFloor', 0);
  a.setSlider('combinedHandout', true);
  a.refreshNotices();
  const [action] = open(a, 'conflict').actions;
  assert.equal(action.label, 'Floor up to 1 and serve 32 ranks');
  a.applyWayOut(action.way);
  assert.equal(unfit(a.plan), false);
  assert.equal(a.settings.rankFloor, 1);
  assert.equal(a.settings.depth, 32);
  assert.equal(a.isPinned('rankFloor'), true);
  assert.equal(a.isPinned('depth'), true);
  for (const row of a.plan.rows) {
    if (!row.settled) assert.ok(row.booster >= 1, `rank ${row.rank} under the floor`);
  }
});

/* ── Switching the handout back off (E4) ───────────────────────────────── */

/** On, its way out taken, off again: the two pins stand beside the participation Boosters. */
function switchedBack() {
  const { a } = eightOfThirtyTwo();
  a.setSlider('rankFloor', 0);
  a.setSlider('combinedHandout', true);
  a.refreshNotices();
  a.applyWayOut(open(a, 'conflict').actions[0].way);
  a.refreshNotices();
  a.setSlider('combinedHandout', false);
  a.refreshNotices();
  return a;
}

test('switching the handout off lists the two pins and carries the drop', () => {
  const a = switchedBack();
  const notice = open(a, 'handoutOff');
  assert.ok(notice, 'the notice stands');
  assert.equal(notice.closable, true);
  assert.deepEqual(notice.lines, [
    'Handout is off, and 2 pinned values stayed.',
    'Min boosters per rank, Served ranks — still pinned, so the participation boosters now come on top of them.',
  ]);
  assert.deepEqual(notice.actions.map((action) => action.label), ['Drop all 2 and follow Weekend']);
  assert.deepEqual(notice.actions[0].drop, HANDOUT_PINS);
});

test('it solves nothing by itself — the pins stand until the drop is confirmed', () => {
  const a = switchedBack();
  assert.equal(a.isPinned('rankFloor'), true);
  assert.equal(a.isPinned('depth'), true);
  a.dropFromNotice(open(a, 'handoutOff').actions[0]);
  assert.equal(a.confirmDrop.reach, 'handout');
  assert.equal(a.confirmDrop.anchor, '[data-notice-reach="handout"]');
  assert.deepEqual(a.confirmDrop.keys, ['rankFloor', 'depth']);
  assert.equal(a.isPinned('rankFloor'), true, 'asking drops nothing');
  a.applyDrop();
  a.refreshNotices();
  assert.equal(a.isPinned('rankFloor'), false);
  assert.equal(a.isPinned('depth'), false);
  assert.equal(open(a, 'handoutOff'), undefined, 'the notice closes with the answer');
});

test('the question is the third reach, in words of its own trigger', () => {
  const question = dropConfirmation({ keys: ['rankFloor', 'depth'], typeTitle: 'Weekend', reach: 'handout' });
  assert.match(question.note, /stayed when the handout went back off\. Following Weekend now means they take its values/);
  assert.match(question.note, /There is no undo\.$/);
});

test('it appears only where one of the two stood pinned at the switch', () => {
  const { a } = app();
  a.setSlider('combinedHandout', true);
  a.refreshNotices();
  a.setSlider('combinedHandout', false);
  a.refreshNotices();
  assert.equal(open(a, 'handoutOff'), undefined);
  a.setSlider('rankFloor', 3);
  a.refreshNotices();
  assert.equal(open(a, 'handoutOff'), undefined, 'a pin set after the switch is none the switch left');
});

test('it lists only what still stands, goes while the handout is on again, and its ✕ closes it', () => {
  const a = switchedBack();
  a.resetSlider('rankFloor');
  assert.deepEqual(open(a, 'handoutOff').actions[0].drop, ['depth']);

  a.setSlider('combinedHandout', true);
  a.refreshNotices();
  assert.equal(open(a, 'handoutOff'), undefined);

  const b = switchedBack();
  b.dismissNotice('handoutOff');
  assert.equal(open(b, 'handoutOff'), undefined);
});

test('an event notice\'s button carries its reach, and one handler drops by it', () => {
  const markup = view('notices.php');
  assert.match(markup, /:data-notice-reach="action\.reach \?\? null"/);
  assert.match(markup, /: dropFromNotice\(action\)"/);
  assert.doesNotMatch(markup, /notice\.id ===/, 'the markup no longer switches on the notice id');

  const a = switchedBack();
  assert.equal(open(a, 'handoutOff').actions[0].reach, 'handout');
  a.setType('weekly');
  a.refreshNotices();
  const carried = open(a, 'carryOver').actions[0];
  assert.equal(carried.reach, 'carry');
  a.dropFromNotice(carried);
  assert.equal(a.confirmDrop.reach, 'carry');
});

/* ── The rank total (E6) ───────────────────────────────────────────────── */

test('the rank total says the same words in both branches — no participation share is in it any more', () => {
  const markup = view('plan.php');
  assert.match(markup, /\$\{rankTotalBooster\} boosters to the ranks/);
  assert.doesNotMatch(markup, /on the tiles/);

  const { a } = app();
  a.setSlider('combinedHandout', true);
  a.setSlider('depth', 32);
  assert.equal(a.rankTotalBooster, a.plan.rank.booster);
});
