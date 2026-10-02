import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute, unfit } from '../public/core/distribute.mjs';
import { offerFor, waysOut } from '../public/core/suggest.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { dropNoun } from '../public/ui/controls.mjs';
import { CURVES } from '../public/core/rules.mjs';
import {
  conflictKind,
  dismiss,
  foldStep,
  freshFold,
  minimize,
  noticeStack,
  reopens,
} from '../public/ui/notices.mjs';

/**
 * The NoticeStack's proven half (#68): the fold rule as a pure derivation over
 * two keys (AC 12), and what each of the three notices says and offers. Where
 * it sits, what it covers and in which colour is judged at the picture (#61,
 * Testing Decisions); none of it is asserted here.
 *
 * **Whether a ConflictNotice stands is asked of `unfit(plan)`, never of the
 * sums** (comment on #68, 2026-09-27 14:59): since #56 a conflict stand adds
 * up — an empty PrizePool fulfils every sum rule — so a check that recomputes
 * the numbers finds nothing wrong with a plan in which nobody gets anything.
 */

function sheet(id, overrides = {}) {
  const type = TOURNAMENT_TYPES.find((t) => t.id === id);
  return { ...GAME, ...type, tournamentPacks: null, depth: null, ranked: null, winnerPacks: null, ...overrides };
}

/** A fit Weekly — no notice of any kind, no Offer either — and a Weekend
 *  with a floor its pool cannot carry: the `conflict` source, at two sets of
 *  numbers. */
const fit = sheet('weekly');
const floorConflict = (rankFloor) => ({ ...fit, depth: 8, rankFloor, boosterRate: 1, participationBooster: 1 });

/** The overtake of #46: Weekend at 48 with one Display on Rank 1, `severe`. */
const overtake = sheet('weekend', { players: 48, displays: [1], depth: 8, rankFloor: 2, curve: 'severe' });

/** K3 of the comment on #68 (2026-09-28): one Display each on Ranks 1–3, then
 *  `Served ranks` down to 2 — Rank 3 holds an orphaned reservation. */
const orphaned = { players: 5, boosterRate: 1, rankFloor: 2, displaySize: 1, depth: 2, displays: [0, 0, 3] };

/** A reservation that settles every served Rank: `unclaimedRemainder`. */
const unclaimed = { players: 8, boosterRate: 3, rankFloor: 0, displaySize: 2, depth: 2, displays: [3, 2] };

/** The K1 bench: `boosterRate` 0, `rankFloor` 2, `depth` 3 (#56). */
const bench = { players: 8, boosterRate: 0, rankFloor: 2, depth: 3, curve: 'steep' };

const stackFor = (settings, fold = freshFold(), carry = null) => {
  const plan = distribute(settings);
  return noticeStack({ plan, ways: waysOut(plan), offer: offerFor(plan), carry, fold });
};
const ids = (list) => list.map((n) => n.id);

/* ── The rule over two keys (AC 12) ─────────────────────────────────────── */

test('the rule is one comparison of two keys: a different key reopens, the same one does not', () => {
  assert.equal(reopens('conflict', 'conflict'), false);
  assert.equal(reopens('conflict', 'overtake'), true);
  assert.equal(reopens(null, 'conflict'), true);
  assert.equal(reopens('conflict', null), true);
});

test('the key carries the kind and never the numbers', () => {
  const a = distribute(floorConflict(3));
  const b = distribute(floorConflict(4));
  assert.ok(unfit(a) && unfit(b));
  assert.notDeepEqual(a.conflict, b.conflict);
  assert.equal(conflictKind(a), 'conflict');
  assert.equal(conflictKind(a), conflictKind(b));
  assert.equal(conflictKind(distribute(overtake)), 'overtake');
});

test('the kind is asked of unfit(plan): an empty pool that adds up is a conflict, a fit plan has none', () => {
  const empty = distribute(bench);
  assert.equal(empty.rows.reduce((sum, row) => sum + row.booster, 0), 0);
  assert.equal(conflictKind(empty), 'conflict');
  assert.equal(conflictKind(distribute(fit)), null);
});

test('two sources at once are one kind of their own, named by both', () => {
  const both = distribute({ ...floorConflict(3), displays: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
  assert.equal(conflictKind(both), 'conflict+orphanedReservation');
});

/* ── Two states, and when a minimized one opens (AC 5, 6, 8, 9) ─────────── */

test('everything starts open — a fresh fold is the state a reload leaves', () => {
  const fold = freshFold();
  assert.equal(fold.conflict.open, true);
  assert.equal(fold.offer.open, true);
  assert.equal(fold.carryOver.open, true);
});

test('a minimized ConflictNotice stays minimized when only its numbers change', () => {
  let fold = foldStep(freshFold(), { plan: distribute(floorConflict(3)) });
  fold = minimize(fold, 'conflict');
  fold = foldStep(fold, { plan: distribute(floorConflict(4)) });
  assert.equal(fold.conflict.open, false);
});

test('a minimized ConflictNotice opens when the kind changes', () => {
  let fold = foldStep(freshFold(), { plan: distribute(floorConflict(3)) });
  fold = minimize(fold, 'conflict');
  fold = foldStep(fold, { plan: distribute(overtake) });
  assert.equal(fold.conflict.open, true);
});

test('gone and back is a change of kind too: the returning conflict opens', () => {
  let fold = foldStep(freshFold(), { plan: distribute(floorConflict(3)) });
  fold = minimize(fold, 'conflict');
  fold = foldStep(fold, { plan: distribute(fit) });
  fold = foldStep(fold, { plan: distribute(floorConflict(3)) });
  assert.equal(fold.conflict.open, true);
});

test('a Set switch opens the CarryOverNotice and the standing state notices with it', () => {
  let fold = foldStep(freshFold(), { plan: distribute(floorConflict(3)), event: 0 });
  fold = minimize(minimize(fold, 'conflict'), 'carryOver');
  fold = foldStep(fold, { plan: distribute(floorConflict(3)), event: 1 });
  assert.equal(fold.carryOver.open, true);
  assert.equal(fold.conflict.open, true);
  assert.equal(fold.offer.open, true);
});

/**
 * Weekend, `Served ranks` at 8, `steep`: Rank 1 lies within a quarter Display
 * of 24, so an Offer stands; at a floor of 3 it is another Offer about the same
 * Rank. Both are found by running the core (`offerFor`), and the test below
 * checks that they really differ rather than trusting this comment.
 */
const offerAt = (rankFloor) => sheet('weekend', { depth: 8, rankFloor, curve: 'steep' });

test('the two Offer stands used below really carry two different Offers', () => {
  const a = offerFor(distribute(offerAt(2)));
  const b = offerFor(distribute(offerAt(3)));
  assert.ok(a && b, 'both stands carry an Offer');
  assert.notEqual(a.key, b.key);
});

test('a dismissed Offer comes back as soon as its content changes', () => {
  const plan = distribute(offerAt(2));
  let fold = foldStep(freshFold(), { plan, offer: offerFor(plan) });
  fold = dismiss(fold, 'offer', offerFor(plan));
  fold = foldStep(fold, { plan, offer: offerFor(plan) });
  assert.deepEqual(ids(noticeStack({ plan, ways: [], offer: offerFor(plan), fold }).open), []);
  assert.deepEqual(ids(noticeStack({ plan, ways: [], offer: offerFor(plan), fold }).chips), []);

  const next = distribute(offerAt(3));
  fold = foldStep(fold, { plan: next, offer: offerFor(next) });
  assert.deepEqual(ids(noticeStack({ plan: next, ways: [], offer: offerFor(next), fold }).open), ['offer']);
});

test('a minimized Offer stays minimized when its content changes', () => {
  const plan = distribute(offerAt(2));
  let fold = foldStep(freshFold(), { plan, offer: offerFor(plan) });
  fold = minimize(fold, 'offer');
  const next = distribute(offerAt(3));
  fold = foldStep(fold, { plan: next, offer: offerFor(next) });
  const stack = noticeStack({ plan: next, ways: [], offer: offerFor(next), fold });
  assert.deepEqual(ids(stack.open), []);
  assert.deepEqual(ids(stack.chips), ['offer']);
});

/**
 * N1 (run 12): a dismissal remembers one Offer, not "an Offer was dismissed".
 * A later Offer, minimized and then displaced by a conflict, comes back
 * **open** — gone and back is a change of kind, whatever was dismissed before.
 */
test('an Offer displaced by a conflict returns open, even after an earlier Offer was dismissed', () => {
  const first = distribute(offerAt(2));
  let fold = foldStep(freshFold(), { plan: first, offer: offerFor(first) });
  fold = dismiss(fold, 'offer', offerFor(first));
  const second = distribute(offerAt(3));
  fold = foldStep(fold, { plan: second, offer: offerFor(second) });
  fold = minimize(fold, 'offer');
  assert.deepEqual(ids(noticeStack({ plan: second, ways: [], offer: offerFor(second), fold }).chips), ['offer']);
  const conflict = distribute(floorConflict(3));
  fold = foldStep(fold, { plan: conflict, offer: offerFor(conflict) });
  assert.equal(fold.offer.key, null, 'the conflict displaces the Offer');
  fold = foldStep(fold, { plan: second, offer: offerFor(second) });
  const stack = noticeStack({ plan: second, ways: [], offer: offerFor(second), fold });
  assert.deepEqual(ids(stack.open), ['offer']);
  assert.deepEqual(ids(stack.chips), []);
});

/* ── What the stack shows (AC 3, 4, 7, 10) ──────────────────────────────── */

test('ConflictNotice and Offer never stand together, even if an Offer were handed in', () => {
  const plan = distribute(floorConflict(3));
  const stray = offerFor(distribute(offerAt(2)));
  const stack = noticeStack({ plan, ways: waysOut(plan), offer: stray, fold: freshFold() });
  assert.deepEqual(ids(stack.open), ['conflict']);
});

test('the ConflictNotice has no ✕; the Offer and the CarryOverNotice have one', () => {
  const conflict = stackFor(floorConflict(3)).open[0];
  assert.equal(conflict.closable, false);
  const offer = stackFor(offerAt(2)).open[0];
  assert.equal(offer.id, 'offer');
  assert.equal(offer.closable, true);
  const carried = stackFor(fit, freshFold(), { to: 'Release', keys: ['players', 'rankFloor'] }).open[0];
  assert.equal(carried.id, 'carryOver');
  assert.equal(carried.closable, true);
});

test('every notice minimizes to a chip with a word and, where there is one, a number', () => {
  let fold = minimize(minimize(minimize(freshFold(), 'conflict'), 'offer'), 'carryOver');
  const conflictPlan = distribute(overtake);
  const ways = waysOut(conflictPlan);
  const conflictChip = noticeStack({ plan: conflictPlan, ways, offer: null, fold }).chips[0];
  assert.equal(conflictChip.glyph, '⚠');
  assert.equal(conflictChip.word, `${ways.length} ways out`);
  assert.ok(ways.length > 1);

  const offerPlan = distribute(offerAt(2));
  assert.equal(noticeStack({ plan: offerPlan, ways: [], offer: offerFor(offerPlan), fold }).chips[0].word, 'Offer');

  const carry = { to: 'Release', keys: ['players', 'rankFloor'] };
  const carryChip = noticeStack({ plan: distribute(fit), ways: [], offer: null, carry, fold }).chips[0];
  assert.equal(carryChip.word, '2 kept');
  assert.equal(carryChip.glyph, null);
});

test('one way out is counted in the singular on the chip', () => {
  const plan = distribute(orphaned);
  const ways = waysOut(plan);
  const fold = minimize(freshFold(), 'conflict');
  const chip = noticeStack({ plan, ways, offer: null, fold }).chips[0];
  assert.equal(chip.word, `${ways.length} way${ways.length === 1 ? '' : 's'} out`);
});

test('the open ConflictNotice names its Ranks in prose', () => {
  const plan = distribute(floorConflict(3));
  const notice = noticeStack({ plan, ways: waysOut(plan), offer: null, fold: freshFold() }).open[0];
  const text = notice.lines.join(' ');
  for (const rank of plan.flagged) assert.match(text, new RegExp(`\\b${rank}\\b`));
});

test('the orphaned reservation gets a sentence naming the Rank and the depth', () => {
  const notice = stackFor(orphaned).open[0];
  const text = notice.lines.join(' ');
  assert.match(text, /rank 3/i);
  assert.match(text, /2 ranks/);
});

test('the unclaimed rest gets a sentence of its own', () => {
  const plan = distribute(unclaimed);
  assert.ok(plan.unclaimedRemainder && !plan.conflict && !plan.orphanedReservation);
  const notice = stackFor(unclaimed).open[0];
  const text = notice.lines.join(' ');
  assert.match(text, /settle/);
  assert.match(text, new RegExp(`${plan.shapedRemainder} boosters`));
});

/**
 * K2 (decision on #68, run 12, `satz-zur-tatsache`): on the K1 bench no value
 * the app may suggest clears the stand, so the ConflictNotice offers no button
 * and says the fact instead — no `Boosters per player (pool)`. Its chip
 * carries a word and no digit: `⚠ 0 ways out` announced what is not there.
 */
test('K1 bench: no way out — no button, one sentence naming the fact, a chip without a number', () => {
  const plan = distribute(bench);
  assert.deepEqual(waysOut(plan), []);
  const notice = stackFor(bench).open[0];
  assert.equal(notice.id, 'conflict');
  assert.deepEqual(notice.actions, []);
  assert.equal(notice.lines.length, 1);
  assert.match(notice.lines[0], /Boosters per player \(pool\)/);
  assert.match(notice.lines[0], /\b0\b/);
  const chip = stackFor(bench, minimize(freshFold(), 'conflict')).chips[0];
  assert.equal(chip.id, 'conflict');
  assert.equal(chip.word, 'No boosters', 'decided wording (run 12, Phase G, G-chip-0-booster on #68)');
  assert.equal(chip.glyph, '⚠');
  assert.doesNotMatch(chip.word, /\d/);
  assert.doesNotMatch(`${chip.word} ${notice.lines[0]}`, /\b(sliders?|settings?|ways? out)\b/i);
});

/**
 * The fact sentence is only true if zero ways occur **only** at a
 * `boosterRate` of 0 (B3 measured it over 15 360 stands without varying the
 * curve). This grid varies the curve too. A stand with a `boosterRate` above
 * 0 and no way out is a finding for #68, not a case for a second sentence.
 */
test('over a grid, a ConflictNotice without a way out stands only at a boosterRate of 0', () => {
  let unfitStands = 0;
  let none = 0;
  let zeroRate = 0;
  const elsewhere = [];
  for (const curve of CURVES.map((c) => c.id)) {
    for (const players of [4, 8, 16]) {
      for (const boosterRate of [0, 1, 2, 3]) {
        for (const participationBooster of [0, 1]) {
          for (const rankFloor of [0, 2, 5]) {
            for (const depth of [1, 3, 8]) {
              for (const displays of [[], [1], [0, 0, 2], [2, 1, 1]]) {
                for (const displaySize of [1, 4]) {
                  const settings = { players, boosterRate, participationBooster, rankFloor, depth, displays, displaySize, curve };
                  const plan = distribute(settings);
                  if (boosterRate === 0) zeroRate++;
                  if (!unfit(plan)) continue;
                  unfitStands++;
                  if (waysOut(plan).length) continue;
                  none++;
                  if (boosterRate !== 0) elsewhere.push(JSON.stringify(settings));
                }
              }
            }
          }
        }
      }
    }
  }
  assert.deepEqual(elsewhere, [], 'stands without a way out at a boosterRate above 0');
  assert.ok(unfitStands > none, `${none} of ${unfitStands} unfit stands without a way out`);
  assert.equal(none, zeroRate, 'and every stand at a boosterRate of 0 is one of them');
});

test('every way out is one action; a combined way is one action over all its changes', () => {
  const twoFacts = {
    players: 8, boosterRate: 1, participationBooster: 0, judgeBooster: 0,
    displaySize: 2, displays: [1, 1, 1], depth: 2, rankFloor: 3, curve: 'steep',
  };
  const plan = distribute(twoFacts);
  const notice = stackFor(twoFacts).open[0];
  assert.equal(notice.actions.length, 1);
  assert.deepEqual(notice.actions[0].way, waysOut(plan)[0]);
  assert.equal(notice.actions[0].way.changes.length, 2);
});

test('a fit plan without an Offer and without a switch shows nothing', () => {
  const stack = stackFor(fit);
  assert.deepEqual(stack.open, []);
  assert.deepEqual(stack.chips, []);
});

test('a switch that carried nothing over raises no CarryOverNotice', () => {
  const stack = stackFor(fit, freshFold(), { to: 'Release', keys: [] });
  assert.deepEqual(stack.open, []);
});

/**
 * B6 (run 12): the CarryOverNotice calls a pinned item by `dropNoun()`, the
 * word #113 swaps in one place — so the sentence is right in any merge order,
 * and no generated text in this module spells *slider* or *setting* itself.
 */
test('the CarryOverNotice calls a pinned item by the one shared word', () => {
  const one = stackFor(fit, freshFold(), { to: 'Release', keys: ['players'] }).open[0];
  assert.equal(one.lines[0], `1 pinned ${dropNoun(1)} stayed behind.`);
  const two = stackFor(fit, freshFold(), { to: 'Release', keys: ['players', 'rankFloor'] }).open[0];
  assert.equal(two.lines[0], `2 pinned ${dropNoun(2)} stayed behind.`);
  const source = readFileSync(new URL('../public/ui/notices.mjs', import.meta.url), 'utf8');
  const code = source.split('\n').filter((line) => !/^\s*(\*|\/\*\*|\/\/)/.test(line)).join('\n');
  assert.ok(!/['`][^'`]*\b(sliders?|settings?)\b[^'`]*['`]/i.test(code.replace(/plan\.settings|settings\b(?=[.)?,;\s])/g, '')), 'no screen text says slider or setting');
});

test('the open stack is in the order of what it talks about: the plan above, the input below', () => {
  const stack = stackFor(floorConflict(3), freshFold(), { to: 'Release', keys: ['players'] });
  assert.deepEqual(ids(stack.open), ['conflict', 'carryOver']);
});

/* ── The wiring in planApp() (#68) ──────────────────────────────────────── */

import { planApp } from '../public/ui/plan.mjs';

/**
 * The app as a test opens it: a cold start, and an address bar that remembers.
 * Alpine is not there, so the effect that runs `refreshNotices()` after every
 * change in the browser (`views/notices.php`) is called by hand here — the
 * same one call, at the same moments.
 */
function app() {
  const written = [];
  const a = planApp({ read: () => '', write: (url) => written.push(url) });
  a.refreshNotices();
  return { a, written };
}

/** Drives the app into the two-fact stand of `combinedWayOut()`'s test, by
 *  the controls the CommunityLead has — sliders and tiles, nothing written
 *  past them. */
function intoTwoFacts(a) {
  for (const [key, value] of Object.entries({ players: 8, boosterRate: 1, participationBooster: 0, judgeBooster: 0, displaySize: 2, curve: 'steep', rankFloor: 0, depth: 3 })) {
    a.setSlider(key, value);
  }
  a.setDisplays(1, 1);
  a.setDisplays(2, 1);
  a.setDisplays(3, 1);
  a.setSlider('rankFloor', 3);
  a.setSlider('depth', 2);
  a.refreshNotices();
}

test('the app reaches the two-fact stand by its own controls, and offers the one combined way', () => {
  const { a } = app();
  intoTwoFacts(a);
  assert.deepEqual(a.settings.displays, [1, 1, 1]);
  assert.equal(unfit(a.plan), true);
  const conflict = a.notices.open.find((n) => n.id === 'conflict');
  assert.equal(conflict.actions.length, 1);
  assert.equal(conflict.actions[0].way.changes.length, 2);
});

test('the combined way is taken with one click, pins what it moves, and the core finds the plan fit', () => {
  const { a } = app();
  intoTwoFacts(a);
  delete a.pins.rankFloor;
  const [action] = a.notices.open.find((n) => n.id === 'conflict').actions;
  a.applyWayOut(action.way);
  a.refreshNotices();
  assert.equal(unfit(distribute(a.settings)), false);
  assert.equal(a.isPinned('rankFloor'), true);
  assert.equal(a.isPinned('displays'), true);
  assert.deepEqual(a.notices.open.map((n) => n.id), []);
});

test('a single way out is taken with one click and pins its slider', () => {
  const { a } = app();
  a.setSlider('rankFloor', 8);
  a.setSlider('depth', 32);
  a.refreshNotices();
  assert.equal(unfit(a.plan), true);
  const ways = a.notices.open.find((n) => n.id === 'conflict').actions;
  assert.ok(ways.length > 0);
  const curvePinned = a.isPinned('curve');
  const { way } = ways[ways.length - 1];
  a.applyWayOut(way);
  assert.equal(unfit(distribute(a.settings)), false);
  assert.equal(a.isPinned(way.key), true);
  if (way.key !== 'curve') assert.equal(a.isPinned('curve'), curvePinned);
});

test('the way back to auto unpins instead of pinning', () => {
  const { a } = app();
  a.setSlider('rankFloor', 3);
  assert.equal(a.isPinned('rankFloor'), true);
  a.applyWayOut({ key: 'rankFloor', auto: true, label: 'Floor back to auto' });
  assert.equal(a.isPinned('rankFloor'), false);
});

test('a reload opens everything, and nothing of the fold reaches the address bar', () => {
  const { a, written } = app();
  a.setSlider('rankFloor', 8);
  a.setSlider('depth', 32);
  a.refreshNotices();
  const before = written.length;
  a.minimizeNotice('conflict');
  a.refreshNotices();
  assert.equal(a.noticeFold.conflict.open, false);
  assert.equal(written.length, before, 'minimizing wrote the address bar');
  assert.doesNotMatch(written[written.length - 1], /fold|notice|open/i);
  const reloaded = planApp({ read: () => written[written.length - 1].replace(/^[^?]*/, ''), write: () => {} });
  reloaded.refreshNotices();
  assert.equal(unfit(reloaded.plan), true);
  assert.equal(reloaded.noticeFold.conflict.open, true);
});

test('a chip survives the page switch', () => {
  const { a } = app();
  a.setSlider('rankFloor', 8);
  a.setSlider('depth', 32);
  a.refreshNotices();
  a.minimizeNotice('conflict');
  a.setPage('details');
  a.refreshNotices();
  assert.deepEqual(a.notices.chips.map((c) => c.id), ['conflict']);
  a.expandNotice('conflict');
  assert.deepEqual(a.notices.open.map((n) => n.id), ['conflict']);
});

test('a Set switch raises the CarryOverNotice with what stayed pinned, and opens the standing notices', () => {
  const { a } = app();
  a.setSlider('rankFloor', 8);
  a.setSlider('depth', 32);
  a.refreshNotices();
  a.minimizeNotice('conflict');
  a.setType('weekend');
  a.refreshNotices();
  const carried = a.notices.open.find((n) => n.id === 'carryOver');
  assert.ok(carried, 'the CarryOverNotice stands');
  assert.equal(carried.chip.word, '2 kept');
  assert.equal(carried.actions[0].label, 'Drop all 2 and follow Weekend');
  assert.equal(a.noticeFold.conflict.open, true);
});

test('the CarryOverNotice asks the same question as the type title, and closes with the answer', () => {
  const { a } = app();
  a.setSlider('rankFloor', 3);
  a.setType('weekend');
  a.refreshNotices();
  a.dropCarried('[data-notice-carry]');
  assert.equal(a.confirmDrop.reach, 'carry');
  assert.deepEqual(a.confirmDrop.keys, ['rankFloor']);
  a.applyDrop();
  a.refreshNotices();
  assert.equal(a.isPinned('rankFloor'), false);
  assert.deepEqual(a.notices.open.map((n) => n.id).filter((id) => id === 'carryOver'), []);
});

test('the Offer is taken with one click and pins the reservation', () => {
  const { a } = app();
  a.setType('weekend');
  a.setSlider('depth', 8);
  a.setSlider('curve', 'steep');
  a.refreshNotices();
  const offer = a.notices.open.find((n) => n.id === 'offer');
  assert.ok(offer, 'an Offer stands');
  a.acceptOffer(offer.actions[0].offer);
  assert.equal(a.settings.displays[offer.actions[0].offer.rank - 1], offer.actions[0].offer.value);
  assert.equal(a.isPinned('displays'), true);
});

/* ── The layer as markup (views/notices.php, views/app.php) ─────────────── */

import { readFileSync } from 'node:fs';

const view = (name) => readFileSync(new URL(`../views/${name}`, import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');

test('the layer is required once, by the app root, outside every page and before the foot', () => {
  const root = view('app.php');
  const lines = root.split('\n');
  const at = lines.findIndex((line) => line.includes("'/notices.php'"));
  const foot = lines.findIndex((line) => line.includes("'/foot.php'"));
  assert.equal(root.split("'/notices.php'").length, 2, 'required exactly once');
  assert.ok(at >= 0 && at < foot, 'before foot.php');
  for (const page of ['plan.php', 'details.php', 'prepare.php']) {
    assert.doesNotMatch(view(page), /notices\.php/, `${page} must not own the layer`);
  }
});

test('the open notices and the chips lie over the app and take no height from the tile grid', () => {
  const sheet = css();
  for (const selector of ['.notice-stack', '.notice-chips']) {
    const block = sheet.slice(sheet.indexOf(`${selector} {`));
    assert.ok(sheet.includes(`${selector} {`), `${selector} is styled`);
    assert.match(block.slice(0, block.indexOf('}')), /position:\s*fixed/, `${selector} is out of the flow`);
  }
});

test('the only ✕ in the layer is bound to a closable notice, and a chip only opens', () => {
  const markup = view('notices.php');
  const close = markup.slice(markup.lastIndexOf('<template', markup.indexOf('dismissNotice(')), markup.indexOf('dismissNotice('));
  assert.match(close, /x-if="notice\.closable"/);
  const chip = markup.slice(markup.indexOf('class="notice-chip"'));
  const click = chip.match(/@click="([^"]*)"/)[1];
  assert.equal(click, 'expandNotice(chip.id)');
});

test('the layer runs the fold after every change', () => {
  assert.match(view('notices.php'), /x-effect="refreshNotices\(\)"/);
});

test('away from Details, the CarryOverNotice asks in a bubble of its own form, since the sheet\'s is hidden there', () => {
  const { a } = app();
  a.setSlider('rankFloor', 3);
  a.setType('weekend');
  a.refreshNotices();
  a.dropCarried('[data-notice-carry]');
  assert.equal(a.confirmDrop.bubble, '[data-notice-drop]');
  a.cancelDrop();
  a.setPage('details');
  a.dropCarried('[data-notice-carry]');
  assert.equal(a.confirmDrop.bubble, '[data-drop-bubble]');
  assert.match(view('notices.php'), /data-notice-drop/);
});

/* ── The `WinnerPack` overhang (#70) ────────────────────────────────────── */

import { resolveSettings } from '../public/core/defaults.mjs';
import { searchesFor, conflictStands } from '../public/ui/notices.mjs';

/**
 * Weekend at 32 carries an Offer (Rank 1, one display) and three WinnerPacks,
 * two of them by rank. One goes on Rank 32 by hand, then `winnerPacks` drops
 * to 2: one over. The core still offers — `offerFor()` knows nothing of the
 * overhang — and the NoticeStack must not.
 */
function overhangStand(extra = {}) {
  const weekend = TOURNAMENT_TYPES.find((t) => t.id === 'weekend');
  return resolveSettings({ game: GAME, type: weekend, pins: { manualWinner: { 32: 1 }, winnerPacks: 2, ...extra } });
}

test('the overhang stand is fit for the core and still carries an Offer there', () => {
  const plan = distribute(overhangStand());
  assert.equal(unfit(plan), false);
  assert.notEqual(offerFor(plan), null);
});

test('a stand with ranked + manualCount above rank.winners carries a ConflictNotice', () => {
  const plan = distribute(overhangStand());
  assert.equal(conflictStands(plan), true);
  const { ways, offer } = searchesFor(plan);
  const stack = noticeStack({ plan, ways, offer, fold: freshFold() });
  const conflict = stack.open.find((n) => n.id === 'conflict');
  assert.ok(conflict);
  assert.equal(conflict.closable, false);
  assert.deepEqual(conflict.actions.map((a) => a.way.key), ['ranked', 'manualWinner']);
  assert.match(conflict.lines.join(' '), /rank 32/);
  assert.match(conflict.lines[0], /3 winner packs placed, 1 over/);
});

test('while the overhang stands, no Offer appears — not even one handed in', () => {
  const plan = distribute(overhangStand());
  assert.equal(searchesFor(plan).offer, null);
  const stack = noticeStack({ plan, ways: searchesFor(plan).ways, offer: offerFor(plan), fold: freshFold() });
  assert.deepEqual(ids(stack.open), ['conflict']);
  const fold = foldStep(freshFold(), { plan, offer: offerFor(plan) });
  assert.equal(fold.offer.key, null);
});

test('the overhang is a kind of its own, named and never numbered', () => {
  assert.equal(conflictKind(distribute(overhangStand())), 'winnerPackOverhang');
  const both = distribute({ ...overhangStand(), depth: 8, rankFloor: 3, boosterRate: 1, participationBooster: 1 });
  assert.equal(conflictKind(both), 'conflict+winnerPackOverhang');
});

test('an overhang turning up under a minimized conflict reopens the notice', () => {
  const floor = { ...overhangStand({ manualWinner: {}, winnerPacks: null }), depth: 8, rankFloor: 3, boosterRate: 1, participationBooster: 1 };
  let fold = foldStep(freshFold(), { plan: distribute(floor) });
  fold = minimize(fold, 'conflict');
  fold = foldStep(fold, { plan: distribute({ ...floor, manualWinner: { 32: 1 }, winnerPacks: 2 }) });
  assert.equal(fold.conflict.open, true);
});

test('with a core source and the overhang at once, both are said and both sets of ways stand', () => {
  const plan = distribute({ ...overhangStand(), depth: 8, rankFloor: 3, boosterRate: 1, participationBooster: 1 });
  const { ways } = searchesFor(plan);
  const conflict = noticeStack({ plan, ways, fold: freshFold() }).open[0];
  assert.match(conflict.lines.join(' '), /can't carry a floor/);
  assert.match(conflict.lines.join(' '), /over/);
  const sources = conflict.actions.map((a) => a.way.source ?? 'core');
  assert.ok(sources.includes('core') && sources.includes('winnerPackOverhang'));
  assert.equal(conflict.chip.word, `${ways.length} ways out`);
});
