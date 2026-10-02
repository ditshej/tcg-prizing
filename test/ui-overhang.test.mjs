import test from 'node:test';
import assert from 'node:assert/strict';

import { distribute } from '../public/core/distribute.mjs';
import { resolveSettings } from '../public/core/defaults.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { manualWinnerAfter } from '../public/ui/controls.mjs';
import { overhangWaysOut, winnerPackOverhang } from '../public/ui/overhang.mjs';

/**
 * The `WinnerPack` overhang (#70): `ranked + manualCount` above the
 * WinnerPacks the RankPool holds — the one ConflictNotice source the core does
 * not report itself.
 *
 * The core clamps `ranked` to `min(rankWinners, players)` and lets
 * `manualCount` through unclamped (second comment on #70), so the overhang
 * arises **only through the `manual` share or a sinking stock**, never through
 * `ranked`. Every stand here is therefore built the way the screen builds it:
 * a `manual` count placed by hand where the tile allows it (`manualWinnerAfter`,
 * whose cap is `open`), and then a second value that drops.
 */

const type = (id) => TOURNAMENT_TYPES.find((t) => t.id === id);
const resolved = (typeId, pins) => resolveSettings({ game: GAME, type: type(typeId), pins });

/** Places one `manual` WinnerPack at the tile of `rank`, the way the ± does —
 *  refused (and the test fails) where the stand has no WinnerPack `open`. */
function placeByHand(typeId, pins, rank) {
  const settings = resolved(typeId, pins);
  const plan = distribute(settings, pins);
  const current = plan.allocation.manual[rank] ?? 0;
  const map = manualWinnerAfter(rank, current + 1, { settings, plan });
  assert.notEqual(map, null, `the tile refuses a winner pack on rank ${rank}`);
  return { ...pins, manualWinner: map };
}

test('a fit stand has no overhang', () => {
  const pins = placeByHand('weekly', {}, 20);
  assert.equal(winnerPackOverhang(distribute(resolved('weekly', pins), pins)), null);
});

test('a Set switch to fewer WinnerPacks leaves the hand-set pack standing over', () => {
  // Weekly at 32: 32 packs in envelopes of 9 yield 3 WinnerPacks, `ranked`
  // auto takes 2, one is open — the tile places it on Rank 20. Release at 32:
  // envelopes of 32 at a yield of 2 give 2, `ranked` still takes 2.
  const pins = placeByHand('weekly', {}, 20);
  const plan = distribute(resolved('release', pins), pins);
  assert.equal(plan.rank.winners, 2);
  assert.equal(plan.allocation.ranked, 2);
  const overhang = winnerPackOverhang(plan);
  assert.equal(overhang.by, 1);
  assert.deepEqual(overhang.ranks, [20]);
});

/**
 * One click on a way out, read the way `applyWayOut()` reads it: a single
 * slider is `{ key, value }`, a take-back is a list of `manualWinner` changes
 * per Rank. The result is the Settings after the click.
 */
function take(settings, way) {
  if (!way.changes) return { ...settings, [way.key]: way.value };
  const manualWinner = { ...settings.manualWinner };
  for (const change of way.changes) {
    if (change.value === 0) delete manualWinner[change.rank];
    else manualWinner[change.rank] = change.value;
  }
  return { ...settings, manualWinner };
}

/** Weekly with ten WinnerPacks on hand, four placed by hand on Ranks 29–32,
 *  and then four of the ten handed to the judge. */
function judgeStand() {
  let pins = { winnerPacks: 10 };
  for (const rank of [29, 30, 31, 32]) pins = placeByHand('weekly', pins, rank);
  pins = { ...pins, judgeWinner: 4 };
  return { pins, settings: resolved('weekly', pins) };
}

test('the ways out stand in the order judgeWinner → ranked → take-back', () => {
  const { pins, settings } = judgeStand();
  const plan = distribute(settings, pins);
  // 10 − 4 = 6 for the ranks; `ranked` auto is ⌊6/2⌋ + 1 = 4, plus the four
  // by hand is 8 — two over.
  assert.equal(winnerPackOverhang(plan).by, 2);
  const ways = overhangWaysOut(plan);
  assert.deepEqual(
    ways.map((w) => w.key),
    ['judgeWinner', 'ranked', 'manualWinner'],
  );
  for (const way of ways) {
    assert.equal(winnerPackOverhang(distribute(take(settings, way))), null, `${way.label} does not clear`);
  }
});

test('lowering judgeWinner by the overhang alone does not clear while ranked follows its staffel', () => {
  // Two over, but judge 4 → 2 gives the ranks 8, and `ranked` auto rises with
  // them to 5: 5 + 4 − 8 is still one over. The nearest value that clears is 1.
  const { pins, settings } = judgeStand();
  const [judge] = overhangWaysOut(distribute(settings, pins));
  assert.equal(judge.value, 1);
  assert.equal(judge.label, 'Judge winner packs down to 1');
});

test('ranked comes down by exactly the overhang', () => {
  const { pins, settings } = judgeStand();
  const ranked = overhangWaysOut(distribute(settings, pins)).find((w) => w.key === 'ranked');
  assert.equal(ranked.value, 2);
  assert.equal(ranked.label, 'Winner packs by rank down to 2');
});

test('the take-back names every Rank it touches and takes the lowest first', () => {
  const { pins, settings } = judgeStand();
  const back = overhangWaysOut(distribute(settings, pins)).find((w) => w.key === 'manualWinner');
  assert.deepEqual(back.changes, [
    { key: 'manualWinner', rank: 31, value: 0 },
    { key: 'manualWinner', rank: 32, value: 0 },
  ]);
  assert.equal(back.label, "Drop rank 31's winner pack and rank 32's winner pack");
});

test('a take-back that leaves part of a Rank says how many of how many', () => {
  // Three WinnerPacks, `ranked` pinned at 0, two by hand on Rank 2 and one on
  // Rank 5 — then `winnerPacks` down to 1: two over. Rank 5 goes whole, Rank 2
  // gives one of its two.
  let pins = { winnerPacks: 3, ranked: 0 };
  pins = placeByHand('weekly', pins, 2);
  pins = placeByHand('weekly', pins, 2);
  pins = placeByHand('weekly', pins, 5);
  pins = { ...pins, winnerPacks: 1 };
  const plan = distribute(resolved('weekly', pins), pins);
  const ways = overhangWaysOut(plan);
  // Nothing at the judge, nothing by rank: the take-back stands alone.
  assert.deepEqual(ways.map((w) => w.key), ['manualWinner']);
  assert.deepEqual(ways[0].changes, [
    { key: 'manualWinner', rank: 2, value: 1 },
    { key: 'manualWinner', rank: 5, value: 0 },
  ]);
  assert.equal(ways[0].label, "Drop 1 of rank 2's 2 winner packs and rank 5's winner pack");
  assert.deepEqual(winnerPackOverhang(plan).ranks, [2, 5]);
});

test('winnerPacks appears in no way out', () => {
  const stands = [judgeStand()];
  const pins = placeByHand('weekly', {}, 20);
  stands.push({ pins, settings: resolved('release', pins) });
  for (const { pins: p, settings } of stands) {
    const keys = overhangWaysOut(distribute(settings, p)).flatMap((w) => [w.key, ...(w.changes ?? []).map((c) => c.key)]);
    assert.ok(!keys.includes('winnerPacks'), keys.join());
  }
});

test('a fit plan has no overhang ways', () => {
  assert.deepEqual(overhangWaysOut(distribute(resolved('weekly', {}))), []);
});
