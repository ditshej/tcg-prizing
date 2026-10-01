import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { distribute } from '../public/core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../public/core/rules.mjs';
import { suggestions } from '../public/core/suggest.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { KEYS } from '../public/link/keys.mjs';
import {
  SHEET_KEYS,
  HOT_KEYS,
  GROUPS,
  STEPPED_KEYS,
  DEPTH_STEP_LABELS,
  boundsFor,
  reachFor,
  effectiveValue,
  clampToBounds,
  reservedDisplaysAfter,
  canReserveDisplays,
  manualWinnerAfter,
  canPlaceWinner,
} from '../public/ui/controls.mjs';

/** The sheet's own reading of a stand: settings resolved, plan computed. */
function stand(pins = {}, type = TOURNAMENT_TYPES[0]) {
  const settings = resolveSettings({ game: GAME, type, pins });
  return { settings, plan: distribute(settings) };
}

/**
 * What a resolved stand carries beyond the nineteen Settings fields of #46:
 * the Game sheet's own `id`. `resolveSettings()` drops a TournamentType's `id`
 * and `title` but spreads the Game sheet whole, so the name the sheet carries
 * since #64's "Entscheid K3" rides along. It is the price that decision names
 * outright, and it is inert — nothing in `core/` reads it — but a test that
 * counts the fields has to say so, or the next added field hides behind it.
 */
const NOT_A_SETTINGS_FIELD = ['id'];

test('the sheet carries seventeen controls, and they are exactly the Settings fields minus the two set at the tile', () => {
  assert.equal(SHEET_KEYS.length, 17);
  // The nineteen Settings fields of #46 (`## Input: Settings`), read off a
  // resolved stand rather than retyped, minus `displays` and `manualWinner`:
  // both name a Rank and are set at the tile, not on a slider (#66).
  const resolved = Object.keys(stand().settings).sort();
  assert.deepEqual(
    resolved.filter((k) => NOT_A_SETTINGS_FIELD.includes(k)),
    NOT_A_SETTINGS_FIELD,
    'the Game sheet name rides along, and nothing else does',
  );
  const settingsFields = resolved.filter((k) => !NOT_A_SETTINGS_FIELD.includes(k));
  assert.equal(settingsFields.length, 19);
  const expected = settingsFields.filter((k) => k !== 'displays' && k !== 'manualWinner');
  assert.deepEqual([...SHEET_KEYS].sort(), expected);
});

test('the four hot ones lead the sheet and carry no group of their own', () => {
  assert.deepEqual(HOT_KEYS, ['players', 'depth', 'curve', 'rankFloor']);
  assert.deepEqual(SHEET_KEYS.slice(0, 4), HOT_KEYS);
  // `depthStep` is the fifth field of the hot block, but not a fifth control:
  // it is the step grid inside the `Served ranks` control.
  assert.equal(SHEET_KEYS[4], 'depthStep');
  for (const group of GROUPS) {
    for (const key of HOT_KEYS) assert.ok(!group.keys.includes(key), `${key} is hoisted`);
  }
});

test('every group has a title and an explanation, and the groups partition what is left', () => {
  const grouped = GROUPS.flatMap((g) => g.keys);
  for (const group of GROUPS) {
    assert.ok(group.title.length > 0);
    assert.ok(group.desc.length > 0);
  }
  assert.deepEqual([...grouped].sort(), SHEET_KEYS.slice(5).slice().sort());
  assert.equal(new Set(grouped).size, grouped.length, 'no control sits in two groups');
});

test('every sheet control is a SetupLink key, the step grid depthStep included (run 12, K1 on #72)', () => {
  const wire = new Set(KEYS.map((k) => k.key));
  for (const key of SHEET_KEYS) assert.ok(wire.has(key), `${key} is a link key`);
});

test('the two stepped controls pick a named rule, and neither they nor the flag have bounds', () => {
  assert.deepEqual(STEPPED_KEYS.curve, CURVES.map((c) => c.id));
  assert.deepEqual(STEPPED_KEYS.depthStep, DEPTH_STEPS);
  assert.equal(boundsFor('curve', stand()), null);
  assert.equal(boundsFor('depthStep', stand()), null);
  assert.equal(boundsFor('combinedHandout', stand()), null);
});

test('every depth step the core knows has a screen word, and no word stands for a step it does not know', () => {
  assert.deepEqual(Object.keys(DEPTH_STEP_LABELS).sort(), [...DEPTH_STEPS].sort());
});

/**
 * #46 `## Slider ranges`, transcribed — and the passage is quoted here so a
 * reader can hold the table against the ticket without leaving the file.
 *
 * That quote is the whole point of this block. The first version of these
 * tests copied its numbers out of `controls.mjs` and then measured
 * `controls.mjs` against them, so the table and its own justification arrived
 * together and the pair was green by construction — the #54 error class
 * (`AGENTS.md`), raised as finding G2 of run 8. The numbers below were read
 * back off #46 afterwards; all nine agree, and that is now a statement a
 * reader can check rather than one this file makes about itself.
 *
 * > **Suchbereiche** — die Regler, die `suggestions()` durchläuft. Nur sie
 * > gehen in eine Aussage über das Ergebnis ein.
 * > `curve` die sieben Stufen · `rankFloor` 0 … 8 · `depth` 1 … Spielerzahl ·
 * > `displays[i]` 0 … 4 · `participationBooster` 0 … `boosterRate`
 * >
 * > **Anschläge** — alles andere. Sie sind Guards, damit ein Regler zwei Enden
 * > hat, und dürfen jederzeit steigen, ohne dass ein Entscheid fällt:
 * > `players` 2…128, `boosterRate` 0…12, `participationPack` 0…4,
 * > `tournamentPacks` 0…512, `winnerPacks` 0…64, `displaySize` 1…60,
 * > `envelopeSize` 1…64, `envelopeYield` 1…8.
 * >
 * > `judgeBooster` und `judgeWinner` bekommen **keinen** Anschlag: ihre
 * > Obergrenze ist der jeweilige Rest, und das ist keine Zahl, sondern die
 * > Summenregel.
 */
const SPEC_STOPS = {
  players: { min: 2, max: 128 },
  boosterRate: { min: 0, max: 12 },
  participationPack: { min: 0, max: 4 },
  tournamentPacks: { min: 0, max: 512 },
  winnerPacks: { min: 0, max: 64 },
  displaySize: { min: 1, max: 60 },
  envelopeSize: { min: 1, max: 64 },
  envelopeYield: { min: 1, max: 8 },
};

/**
 * The search ranges the sheet draws, as the spec writes them: two of the three
 * are a *quantity of the stand* and not a number, so they are functions here
 * and a stand that changes has to move them. `curve` and `displays[i]` are
 * ranges too but no numeric control on this sheet — `curve` is a step list,
 * `displays` is set at the tile (#66).
 */
const SPEC_SEARCH_RANGES = {
  rankFloor: () => ({ min: 0, max: 8 }),
  depth: ({ plan }) => ({ min: 1, max: plan.players }),
  participationBooster: ({ settings }) => ({ min: 0, max: Number(settings.boosterRate) }),
};

/** The pair #46 leaves without an end of its own. */
const SPEC_NO_STOP = ['judgeBooster', 'judgeWinner'];

test('the stops are the eight #46 lists, at the values it lists them at', () => {
  const s = stand();
  for (const [key, range] of Object.entries(SPEC_STOPS)) {
    assert.deepEqual(boundsFor(key, s), range, key);
  }
});

test('a stop does not move with the stand — that is what makes it a stop and not a search range', () => {
  const wide = stand({ players: 128, boosterRate: 12 });
  const narrow = stand({ players: 2, boosterRate: 0 });
  for (const key of Object.keys(SPEC_STOPS)) {
    assert.deepEqual(boundsFor(key, wide), boundsFor(key, narrow), key);
  }
});

test('the search ranges are the spec\'s, at every stand and not only at the sheet\'s own', () => {
  for (const pins of [{}, { players: 12 }, { players: 128, boosterRate: 12 }, { boosterRate: 0 }]) {
    const s = stand(pins);
    for (const [key, range] of Object.entries(SPEC_SEARCH_RANGES)) {
      assert.deepEqual(boundsFor(key, s), range(s), `${key} at ${JSON.stringify(pins)}`);
    }
  }
});

/**
 * The one check that measures instead of transcribing: **every way out the
 * core offers has to be reachable at the control that carries it.** The values
 * come out of `suggestions()` at a stand that really is unfit — the measured
 * overtake of #46 `## Tests`, `Weekend` 48 with `d` = (1) — so nothing here is
 * a number this file chose. A cap narrower than the search would turn an
 * offered way out into one the slider refuses, and neither side of that could
 * see it alone.
 */
const UNFIT_STANDS = [
  stand({ players: 48, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 64, rankFloor: 8, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 96, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 32, boosterRate: 1, rankFloor: 8 }, TOURNAMENT_TYPES[0]),
];

/**
 * The ways out at a stand. Since #86 (ADR 0009) `suggestions()` takes the
 * **plan**, which carries the Settings it was computed from.
 *
 * Handing it the wrong object does not throw — `unfit()` on a Settings object
 * is falsy, so the call returns `[]` and both checks below would pass while
 * measuring nothing. The first of the two is the guard against that: it
 * asserts the offer is non-empty before the second reads it.
 */
const waysOut = (s) => suggestions(s.plan);

test('the stands the reachability check runs on really are unfit, and between them they touch every search range', () => {
  const offered = new Set();
  for (const s of UNFIT_STANDS) {
    const out = waysOut(s);
    assert.ok(out.length > 0, 'a stand with no way out tests nothing');
    for (const { key } of out) offered.add(key);
  }
  // Every slider #46 names as a search range, so no range is checked vacuously.
  assert.deepEqual(
    [...offered].sort(),
    ['curve', 'depth', 'displays', 'participationBooster', 'rankFloor'],
  );
});

test('every way out the core offers is a value its control can actually be set to', () => {
  for (const s of UNFIT_STANDS) {
    for (const { key, value } of waysOut(s)) {
      // `displays` is no slider on this sheet: it is set at the tile (#66).
      if (key === 'displays') continue;
      assert.ok(SHEET_KEYS.includes(key), `${key} is offered, so it must stand on the sheet`);
      assert.equal(clampToBounds(key, value, s), value, `${key} → ${value} must be reachable`);
    }
  }
});

test('the two sliders #46 leaves without a stop take the whole pool, and it moves with the stand', () => {
  const lean = stand({ boosterRate: 1 });
  const rich = stand({ boosterRate: 12 });
  for (const key of SPEC_NO_STOP) {
    assert.ok(!(key in SPEC_STOPS), `${key} must carry no stop of its own`);
  }
  assert.ok(
    boundsFor('judgeBooster', rich).max > boundsFor('judgeBooster', lean).max,
    'the end is the rest, so a bigger pool is a bigger end',
  );
});

test('the player count caps every slider that addresses a Rank (CONTEXT.md, RankPoolDepth)', () => {
  const s = stand({ players: 12 });
  assert.deepEqual(boundsFor('depth', s), { min: 1, max: 12 });
  assert.equal(boundsFor('ranked', s).max <= 12, true);
});

test('ranked never offers more winner packs than the ranks hold — the overhang is reached by a second slider sinking, not here (#61)', () => {
  const s = stand();
  assert.equal(boundsFor('ranked', s).max, Math.min(s.plan.rank.winners, s.plan.players));
});

test('the two judge sliders take the whole respective pool as their end, because #46 gives them no guard', () => {
  const s = stand();
  assert.deepEqual(boundsFor('judgeBooster', s), { min: 0, max: s.plan.pool.booster });
  assert.deepEqual(boundsFor('judgeWinner', s), { min: 0, max: s.plan.pool.winners });
});

test('a trailing slider left alone reads its number off the plan, not off the null in Settings', () => {
  const s = stand();
  assert.equal(s.settings.depth, null);
  assert.equal(effectiveValue('depth', s), s.plan.depth);
  assert.equal(effectiveValue('tournamentPacks', s), s.plan.pool.packs);
  assert.equal(effectiveValue('ranked', s), s.plan.allocation.ranked);
  assert.equal(effectiveValue('winnerPacks', s), s.plan.pool.winners);
});

test('a pinned trailing slider reads its own number back', () => {
  const s = stand({ depth: 5, winnerPacks: 7 });
  assert.equal(effectiveValue('depth', s), 5);
  assert.equal(effectiveValue('winnerPacks', s), 7);
});

test('a pinned value over its cap is never cut — it is read back whole (ADR 0006)', () => {
  // boosterRate down to 1 puts the cap of participationBooster under the
  // pinned 6; the number the sheet shows stays 6.
  const s = stand({ participationBooster: 6, boosterRate: 1 });
  assert.equal(boundsFor('participationBooster', s).max, 1);
  assert.equal(effectiveValue('participationBooster', s), 6);
});

test('a cap that sank under a pinned value stops the way out, never the way back', () => {
  const s = stand({ participationBooster: 6, boosterRate: 1 });
  // The cap itself is untouched — it is still what the stand allows.
  assert.equal(boundsFor('participationBooster', s).max, 1);
  // What the control is drawn from takes the standing value in, so the thumb
  // shows 6 and the counter's minus is still allowed.
  assert.deepEqual(reachFor('participationBooster', s), { min: 0, max: 6 });
  assert.equal(clampToBounds('participationBooster', 5, s), 5, 'one step down is reachable');
  assert.equal(clampToBounds('participationBooster', 7, s), 6, 'further out is not');
});

test('reach is the cap itself wherever the value stands inside it', () => {
  const s = stand();
  assert.deepEqual(reachFor('players', s), boundsFor('players', s));
  assert.equal(reachFor('curve', s), null);
});

test('setting clamps to the same bounds the slider and the counter are drawn from', () => {
  const s = stand();
  assert.equal(clampToBounds('players', 400, s), 128);
  assert.equal(clampToBounds('players', 1, s), 2);
  assert.equal(clampToBounds('rankFloor', -3, s), 0);
  assert.equal(clampToBounds('curve', 'steep', s), 'steep');
  assert.equal(clampToBounds('curve', 'nonsense', s), null);
  assert.equal(clampToBounds('depthStep', 'topHalf', s), 'topHalf');
  assert.equal(clampToBounds('combinedHandout', true, s), true);
});

test('a type switch replaces the sheet but carries every pinned value across (#64 AC 7)', () => {
  const weekly = stand({ curve: 'extreme' }, TOURNAMENT_TYPES[0]);
  const release = stand({ curve: 'extreme' }, TOURNAMENT_TYPES[2]);
  // Release's own sheet says `gentle`; the pin outranks it.
  assert.equal(effectiveValue('curve', release), 'extreme');
  // Everything not pinned does follow the new sheet.
  assert.equal(effectiveValue('boosterRate', weekly), 3);
  assert.equal(effectiveValue('boosterRate', release), 9);
});

/* ── The two set at the tile (#66) ──────────────────────────────────────── */

/**
 * The DisplayReservation and the `manual` share of the WinnerPackAllocation
 * are the two Settings fields no slider carries: both name a `Rank`, and the
 * `Rank` is the tile (#61, "The tiles and their grip"). Their caps live beside
 * the sliders' all the same, because #61 gives caps one home — "Schieber und
 * Zählwerk kennen denselben Deckel, sonst schiebt das eine über das andere
 * hinaus" — and a second home would let the tile and the sheet disagree about
 * the same stand.
 *
 * The rule they are measured against is #61's, verbatim:
 *
 * > Ein Anschlag darf keinen Zustand verhindern, den ADR 0002 gemeldet haben
 * > will.
 */

/** The reservation vector as it stands, read off the Settings the plan carries. */
const vectorOf = (s) => (s.settings.displays ?? []).map((v) => Number(v) || 0);

/** `d₁ ≥ d₂ ≥ …`, written out here rather than imported: a test that borrows
 *  the predicate under test cannot disagree with it. */
function rises(vector) {
  for (let i = 1; i < vector.length; i++) if ((vector[i] ?? 0) > (vector[i - 1] ?? 0)) return true;
  return false;
}

/** The vector a handling would produce, built naively and without trimming. */
function vectorWith(vector, rank, count) {
  const next = vector.slice();
  while (next.length < rank) next.push(0);
  next[rank - 1] = count;
  return next;
}

test('the reservation never rises over the ranks — the rank above caps the tile below it', () => {
  // displaySize 2 makes a two-display prefix cheap enough to stand, so the
  // monotonicity cap is measured on its own and not through a pool that is
  // empty anyway.
  const s = stand({ displaySize: 2, displays: [2, 2] });
  assert.equal(s.plan.conflict, null, 'the stand itself has to be a standing one');
  // Rank 2 may not pass rank 1 …
  assert.equal(canReserveDisplays(2, 3, s), false);
  // … and rank 1 may not sink under rank 2, which is the same rule read downward.
  assert.equal(canReserveDisplays(1, 1, s), false);
  // Level with the rank above is not "over" it.
  assert.equal(canReserveDisplays(3, 2, s), true);
});

test('a display the RankPool cannot carry is never offered (maintainer decision on #66, 2026-09-27)', () => {
  const s = stand();
  // 32 boosters in the RankPool, 24 to a display: one stands, two do not.
  assert.equal(s.plan.rank.booster, 32);
  assert.equal(s.settings.displaySize, 24);
  assert.equal(canReserveDisplays(1, 1, s), true);
  assert.equal(canReserveDisplays(1, 2, s), false);
  assert.deepEqual(reservedDisplaysAfter(1, 1, s), [1]);
  assert.equal(reservedDisplaysAfter(1, 2, s), null);
});

test('a reservation left standing over a sunk cap is never cut, and the way back is never a wall (ADR 0006)', () => {
  // The display was reserved at 32 players; the count then fell to 8 and the
  // RankPool with it. ADR 0006 forbids trimming the stored value …
  const s = stand({ displays: [1], players: 8 });
  assert.deepEqual(vectorOf(s), [1]);
  assert.deepEqual(s.plan.displayVector, [1]);
  assert.ok(s.plan.conflict, 'the stand really is the one a sunk cap leaves behind');
  // … and the cap still does its whole job outward …
  assert.equal(canReserveDisplays(1, 2, s), false);
  // … while the one way back down stays open. A cap that walled this off would
  // delete the only handling that clears the conflict it is standing in.
  assert.equal(canReserveDisplays(1, 0, s), true);
  assert.deepEqual(reservedDisplaysAfter(1, 0, s), []);
});

test('an overtake stays reachable, over a second slider that follows afterwards (#61, ADR 0002)', () => {
  // Reserved at 96 players: it stands, and nothing is overtaken yet.
  const before = stand({ players: 96 });
  assert.deepEqual(reservedDisplaysAfter(1, 1, before), [1]);
  const reserved = stand({ players: 96, displays: [1] });
  assert.equal(reserved.plan.overtake, null);
  assert.equal(reserved.plan.conflict, null);
  // The second slider follows: at 128 players the curve below rank 1 passes
  // the settled 24, and the plan reports it instead of refusing it.
  const after = stand({ players: 128, displays: [1] });
  assert.deepEqual(after.plan.overtake, { under: 1, over: 2, has: 24, gets: 28 });
  // The reservation that produced it is still one the tile would set today.
  assert.equal(canReserveDisplays(1, 1, stand({ players: 128 })), true);
});

test('an orphaned reservation stays reachable, over the depth that follows afterwards (#61, ADR 0002)', () => {
  const before = stand({ players: 96, displays: [1] });
  assert.equal(before.plan.orphanedReservation, null);
  // Rank 2 takes its display at the tile — offered, because the RankPool
  // carries both.
  assert.deepEqual(reservedDisplaysAfter(2, 1, before), [1, 1]);
  const both = stand({ players: 96, displays: [1, 1] });
  assert.equal(both.plan.conflict, null);
  // Served ranks then sinks under rank 2, and the promise on it is reported
  // rather than quietly read away.
  const after = stand({ players: 96, displays: [1, 1], depth: 1 });
  assert.deepEqual(after.plan.orphanedReservation, { ranks: [2] });
});

/**
 * The grid the property below sweeps: stands with and without a standing
 * reservation, poor and rich RankPools, and the two player counts that put the
 * overtake on either side of its threshold.
 */
const TILE_STANDS = [
  stand(),
  stand({ displays: [1] }),
  stand({ players: 96 }),
  stand({ players: 96, displays: [1] }),
  stand({ players: 128, displays: [1] }),
  stand({ players: 8, displays: [1] }),
  stand({ displaySize: 2 }),
  stand({ displaySize: 2, displays: [2, 2] }),
  stand({ displaySize: 2, displays: [3, 1], rankFloor: 8 }),
  stand({ players: 48, displays: [1] }, TOURNAMENT_TYPES[1]),
  stand({ players: 64, displays: [2, 1] }, TOURNAMENT_TYPES[2]),
];

test('capped is monotonicity, the rank above and the reservation condition — and nothing else (#66 AC 11)', () => {
  let refused = 0;
  const offeredDespite = { overtake: 0, orphanedReservation: 0, unclaimedRemainder: 0 };
  for (const s of TILE_STANDS) {
    const vector = vectorOf(s);
    for (let rank = 1; rank <= Math.min(5, s.plan.players); rank++) {
      for (let count = 0; count <= 4; count++) {
        const current = vector[rank - 1] ?? 0;
        if (count === current) continue;
        const naive = vectorWith(vector, rank, count);
        const probe = distribute({ ...s.settings, displays: naive });
        if (!canReserveDisplays(rank, count, s)) {
          refused += 1;
          // Every refusal names one of the two capped rules. Read off the
          // core's own `conflict` field, never re-derived here.
          assert.ok(
            rises(naive) || (count > current && probe.conflict),
            `rank ${rank} → ${count} was refused without a rule to refuse it`,
          );
          continue;
        }
        // And the three states ADR 0002 wants reported are never a reason to
        // refuse: they are counted here so a cap that quietly swallowed them
        // would show up as a zero.
        for (const key of Object.keys(offeredDespite)) if (probe[key]) offeredDespite[key] += 1;
      }
    }
  }
  assert.ok(refused > 0, 'a sweep that refuses nothing measures no cap at all');
  assert.ok(offeredDespite.overtake > 0, 'an overtake must stay settable at the tile');
  assert.ok(offeredDespite.orphanedReservation > 0, 'an orphaned reservation must stay settable');
  assert.ok(offeredDespite.unclaimedRemainder > 0, 'a reservation over the whole depth must stay settable');
});

test('the tile writes winner packs into the same counters as the rest of the app, and ranked is not among them', () => {
  const s = stand();
  // One winner pack is still `open`, so the tile may place it …
  assert.equal(s.plan.allocation.open, 1);
  assert.deepEqual(manualWinnerAfter(5, 1, s), { 5: 1 });
  // … and once it is placed, there is none left to place anywhere.
  const placed = stand({ manualWinner: { 5: 1 } });
  assert.equal(placed.plan.allocation.open, 0);
  assert.equal(canPlaceWinner(7, 1, placed), false);
  // What `ranked` handed out is not the tile's to take back: rank 1 carries a
  // winner pack by rank, and the tile's minus finds nothing of its own there.
  assert.equal(placed.plan.rows[0].winners, 1);
  assert.equal(placed.plan.allocation.manual[1] ?? 0, 0);
  assert.equal(canPlaceWinner(1, 0, placed), false);
  // On the rank it did place, it takes it back — and the counter empties
  // rather than keeping a zero.
  assert.deepEqual(manualWinnerAfter(5, 0, placed), {});
});

test('a rank beyond the player count is addressed by nothing, the tile included (CONTEXT.md, RankPoolDepth)', () => {
  const s = stand({ players: 8 });
  assert.equal(canReserveDisplays(9, 1, s), false);
  assert.equal(canPlaceWinner(9, 1, s), false);
});
