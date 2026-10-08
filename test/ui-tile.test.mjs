import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { tileGrip, tileView } from '../public/ui/tile.mjs';

/**
 * The stand this file was written against: the sheets as #21 and #25 decided
 * them — 32 Players, the top 8 served, Weekly `mild`, Weekend `steep`. #145
 * moved those start values (40 / `topThird` / `moderate`, Weekend `firm`,
 * Release 64); the subject here is the tile over a stand, and the decided
 * examples below (#70, K-B2) name Ranks of a 32-Player field. So the
 * scenarios set their values themselves, in the TournamentType layer, where
 * they stay inherited rather than pinned.
 */
const MEASURED_ON = {
  weekly: { players: 32, depthStep: 'top8', curve: 'mild' },
  weekend: { players: 32, depthStep: 'top8', curve: 'steep' },
  release: { players: 32 },
};

/** The tile's own reading of a stand: settings resolved, plan computed. */
function stand(pins = {}, type = TOURNAMENT_TYPES[0]) {
  const settings = resolveSettings({ game: GAME, type: { ...type, ...MEASURED_ON[type.id] }, pins });
  return { settings, plan: distribute(settings) };
}

/* ── The tile itself (#66 AC 6, AC 10) ──────────────────────────────────── */

test('a tile with a reservation is 2×2 and names its display count', () => {
  const s = stand({ displays: [1] });
  const big = tileView(s.plan.rows[0], s.plan);
  assert.ok(big.classes.includes('tile-reserved'), 'the fixed 2×2 starts at the first display');
  assert.equal(big.displayLabel, '1 display');
  // Fixed size from the first display on, independent of the number — so the
  // class does not change while the label does (#61, "feste Grösse ab dem
  // ersten `Display`").
  const two = stand({ displaySize: 2, displays: [2, 1] });
  const wider = tileView(two.plan.rows[0], two.plan);
  assert.ok(wider.classes.includes('tile-reserved'));
  assert.equal(wider.displayLabel, '2 displays');
  // And a tile without one says nothing about displays at all.
  const bare = tileView(s.plan.rows[3], s.plan);
  assert.ok(!bare.classes.includes('tile-reserved'));
  assert.equal(bare.displayLabel, null);
});

test('a Rank the plan flagged is marked, because a minimised conflict would otherwise claim a valid plan', () => {
  const s = stand({ players: 128, displays: [1] });
  assert.deepEqual(s.plan.flagged, [1, 2]);
  assert.ok(tileView(s.plan.rows[0], s.plan).classes.includes('tile-flagged'));
  assert.ok(tileView(s.plan.rows[1], s.plan).classes.includes('tile-flagged'));
  assert.ok(!tileView(s.plan.rows[2], s.plan).classes.includes('tile-flagged'));
});

test('a settled Rank is recognisable as one, and an unserved Rank as one', () => {
  const s = stand({ displays: [1] });
  assert.equal(s.plan.settledCount, 1);
  assert.ok(tileView(s.plan.rows[0], s.plan).classes.includes('tile-settled'));
  assert.ok(!tileView(s.plan.rows[1], s.plan).classes.includes('tile-settled'));
  const last = s.plan.rows[s.plan.players - 1];
  assert.equal(last.served, false);
  assert.ok(tileView(last, s.plan).classes.includes('tile-unserved'));
});

/* ── The bubble's two counters (#66 AC 2, AC 3, AC 7, AC 8) ─────────────── */

test('the grip opens on two counters, and what ranked handed out is not one of them', () => {
  const s = stand();
  const grip = tileGrip(1, s);
  assert.equal(grip.rank, 1);
  // Rank 1 holds a winner pack, and it holds it by rank.
  assert.equal(grip.winners.value, 1);
  assert.equal(grip.winners.byRank, 1);
  assert.equal(grip.winners.manual, 0);
  assert.equal(grip.winners.canRemove, false, 'a ranked pack is not the tile\'s to take back');
  assert.ok(grip.winners.note.includes('1 by rank, fixed'));
});

test('a locked ± says why it is locked, everywhere it is locked (#66 AC 3)', () => {
  const stands = [
    stand(),
    stand({ displays: [1] }),
    stand({ players: 8, displays: [1] }),
    stand({ displaySize: 2, displays: [2, 2] }),
    stand({ manualWinner: { 5: 1 } }),
    stand({ players: 96, displays: [1, 1] }),
  ];
  let locks = 0;
  for (const s of stands) {
    for (let rank = 1; rank <= Math.min(6, s.plan.players); rank++) {
      const grip = tileGrip(rank, s);
      for (const counter of [grip.winners, grip.displays]) {
        if (!counter) continue;
        if (!counter.canAdd) {
          locks += 1;
          assert.ok(counter.addReason, `rank ${rank}: a locked + with no reason`);
          assert.ok(counter.note.includes(counter.addReason), 'the reason stands in the sentence on screen');
        }
        if (!counter.canRemove) {
          locks += 1;
          assert.ok(counter.removeReason, `rank ${rank}: a locked − with no reason`);
          assert.ok(counter.note.includes(counter.removeReason), 'the reason stands in the sentence on screen');
        }
      }
    }
  }
  assert.ok(locks > 0, 'a sweep with no locked ± says nothing about locked ±');
});

test('the bubble says how many boosters the reservation binds, and whether the Rank is settled or tied (#66 AC 7)', () => {
  const settled = tileGrip(1, stand({ displays: [1] }));
  assert.equal(settled.displays.reserved, 24);
  assert.ok(settled.displays.note.startsWith('24 boosters reserved · settled, out of the curve'));

  const tied = tileGrip(1, stand({ displaySize: 2, displays: [2, 2] }));
  assert.ok(tied.displays.note.includes('tied, still in the curve'));

  // With nothing reserved the sentence says what one would cost instead.
  const empty = tileGrip(2, stand());
  assert.equal(empty.displays.value, 0);
  assert.ok(empty.displays.note.startsWith('24 boosters each'));
});

test('the Rank above caps the tile below it, and the bubble names the Rank rather than greying out', () => {
  const s = stand({ displaySize: 2, displays: [2, 2] });
  const grip = tileGrip(3, s);
  assert.equal(grip.displays.value, 0);
  assert.equal(grip.displays.canAdd, true, 'level with the rank above is not over it');
  const atTheCap = tileGrip(2, s);
  assert.equal(atTheCap.displays.canAdd, false);
  assert.equal(atTheCap.displays.addReason, 'rank 1 caps this at 2');
});

test('a reservation the RankPool cannot carry is refused with the pool as the reason, not the Rank above', () => {
  // 32 boosters in the RankPool and 24 to a display: the first stands, the
  // second does not, and rank 1 has no rank above it to blame.
  const s = stand({ displays: [1] });
  assert.equal(tileGrip(1, stand()).displays.canAdd, true);
  const grip = tileGrip(1, s);
  assert.equal(grip.displays.canAdd, false);
  assert.equal(grip.displays.addReason, 'the rank pool cannot carry another display');
});

test('on an unserved Rank the bubble offers no reservation but names the way there (#66 AC 8)', () => {
  const s = stand({ displays: [1] });
  const last = s.plan.players;
  assert.equal(s.plan.rows[last - 1].served, false);
  const grip = tileGrip(last, s);
  assert.equal(grip.served, false);
  assert.equal(grip.displays, null);
  assert.ok(grip.wayIn.includes('Served ranks'));
  // The winner packs stay reachable there: `manual` runs over the whole
  // Ranking and is independent of RankPoolDepth (CONTEXT.md).
  assert.equal(grip.winners.canAdd, true);
});

test('an unserved Rank that already reserved is not told it has not', () => {
  // Served ranks pulled down under a reservation: rank 4 keeps its Display and
  // falls out of the depth, which is the core's `orphanedReservation`.
  const s = stand({ displays: [1, 1, 1, 1], depth: 2 });
  const row = s.plan.rows[3];
  assert.equal(row.served, false, 'rank 4 is past the depth');
  assert.deepEqual(s.plan.orphanedReservation.ranks, [3, 4]);

  const grip = tileGrip(4, s);
  assert.equal(grip.displays, null);
  assert.ok(grip.wayIn.includes('Served ranks'), 'the way in is still named');
  assert.ok(
    !grip.wayIn.includes('before reserving a display here'),
    'it has reserved — saying otherwise is the opposite of the truth',
  );
  assert.ok(grip.wayIn.includes('1 display reserved here'));

  // An unserved Rank with nothing on it keeps the original sentence.
  const bare = tileGrip(s.plan.players, s);
  assert.ok(bare.wayIn.includes('before reserving a display here'));
});

test('a reservation left standing over a sunk cap keeps its way back at the tile (ADR 0006)', () => {
  const s = stand({ players: 8, displays: [1] });
  const grip = tileGrip(1, s);
  assert.equal(grip.displays.value, 1, 'the stored value is not trimmed');
  assert.equal(grip.displays.canAdd, false);
  assert.equal(grip.displays.canRemove, true, 'the one handling that clears the conflict is still offered');
});

test('the grip is nothing at all on a Rank the plan does not have', () => {
  const s = stand({ players: 8 });
  assert.equal(tileGrip(9, s), null);
  assert.equal(tileGrip(0, s), null);
});

/* ── The `WinnerPack` overhang marks its tiles (#70) ────────────────────── */

const typeOf = (id) => TOURNAMENT_TYPES.find((t) => t.id === id);
const markedTiles = (plan) => plan.rows.filter((row) => tileView(row, plan).classes.includes('tile-flagged')).map((row) => row.rank);

test('while the overhang stands, every tile with a hand-placed pack is marked, not only the take-back ranks (K-B2)', () => {
  // The decided example on #70 (Lauf 13, K-B2): Weekly, `winnerPacks` 10, one
  // pack by hand on each of Ranks 29, 30, 31 and 32, then `judgeWinner` 4 —
  // two over. Marked are 29, 30, 31 and 32; the take-back still names only
  // 31 and 32. The Ranks holding their pack through `ranked` stay unmarked.
  const s = stand({ winnerPacks: 10, manualWinner: { 29: 1, 30: 1, 31: 1, 32: 1 }, judgeWinner: 4 }, typeOf('weekly'));
  assert.equal(s.plan.flagged.length, 0);
  assert.ok(s.plan.allocation.ranked > 0, 'the stand has ranks carrying a pack through ranked');
  assert.deepEqual(markedTiles(s.plan), [29, 30, 31, 32]);
  for (const rank of [29, 30, 31, 32]) assert.equal(tileGrip(rank, s).flagged, true, `rank ${rank}`);
  assert.equal(tileGrip(1, s).flagged, false);
});

test('Release with manualWinner=20:1 marks tile 20 and no other (K-B2)', () => {
  const s = stand({ manualWinner: { 20: 1 } }, typeOf('release'));
  assert.deepEqual(markedTiles(s.plan), [20]);
});

test('the mark goes as soon as the stock suffices again, and the hand-set packs are where they were', () => {
  const s = stand({ manualWinner: { 10: 1, 20: 1 }, winnerPacks: 5 });
  assert.equal(tileView(s.plan.rows[19], s.plan).classes.includes('tile-flagged'), false);
  assert.equal(s.plan.rows[19].winners, 1);
  assert.equal(s.plan.rows[9].winners, 1);
});
