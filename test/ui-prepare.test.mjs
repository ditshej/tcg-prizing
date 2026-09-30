import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSettings } from '../public/core/defaults.mjs';
import { derivePool, distribute } from '../public/core/distribute.mjs';
import { GAME, TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { preparationList } from '../public/ui/prepare.mjs';

/**
 * The `PreparationList`'s breakdown, as the pure derivation #61's Testing
 * Decisions carve out of the unproven surface: `preparationList(plan)` takes a
 * `DistributionPlan` and answers with three items, their step sequences and
 * the one procurement hint per item.
 *
 * **Every number here comes out of the real sheet through `distribute()`**
 * (`AGENTS.md`, "A decided number is looked up, never back-computed"). The
 * acceptance criteria of #65 name `5 displays · 117 boosters · 4 sealed + 21
 * loose` and 288 `Booster` in 12 `Display`s with **one** `PromoEnvelope`; the
 * stand each comes out of is built here and the criterion is read off the
 * result, rather than the figures being pasted in as literals.
 */
function stand(typeId, pins = {}) {
  const type = TOURNAMENT_TYPES.find((entry) => entry.id === typeId);
  const settings = resolveSettings({ game: GAME, type, pins });
  const plan = distribute(settings, pins);
  return { plan, list: preparationList(plan) };
}

/** The plain text of an item's step sequence, one line per entry. */
function texts(item) {
  return item.lines.map((line) => line.text);
}

/** Everything the three items and the closing note put on the screen. */
function allText(list) {
  const fromItem = (item) =>
    [item.unit, item.total ?? '', item.source ?? '', item.offer?.text ?? '', item.offer?.button ?? '']
      .concat(item.lines.flatMap((line) => [line.text, line.aside ?? '']))
      .join(' ');
  return [fromItem(list.displays), fromItem(list.envelopes), fromItem(list.winners), list.note].join(' ');
}

test('39 players come to 5 displays, 117 boosters, 4 sealed and 21 loose', () => {
  const { list } = stand('weekly', { players: 39 });

  assert.equal(list.displays.fetch, 5);
  assert.equal(list.displays.unit, 'displays');
  assert.equal(list.displays.total, '117 boosters');
  assert.ok(texts(list.displays).includes('39 players × 3 each'));
  assert.ok(texts(list.displays).includes('4 sealed'));
  assert.ok(texts(list.displays).includes('+ 21 loose from the 5th'));
  assert.ok(texts(list.displays).includes('3 stay in the box'));
});

/** One hint on the total, and it is the headline: it rounds up and the step
 *  sequence names the unit that gets broken. */
test('the procurement number rounds up and names the broken unit', () => {
  const { list } = stand('weekly', { players: 39 });
  const sealed = list.displays.lines.find((line) => line.text === '4 sealed');
  const broken = list.displays.lines.find((line) => line.text.startsWith('+ 21 loose'));

  assert.equal(sealed.value, 96);
  assert.equal(broken.value, 117);
});

test('Release comes out even: 288 boosters in 12 displays and one Promo-Envelope', () => {
  const { list } = stand('release');

  assert.equal(list.displays.total, '288 boosters');
  assert.equal(list.displays.fetch, 12);
  assert.ok(texts(list.displays).includes('comes out even'));
  assert.ok(!texts(list.displays).some((text) => text.startsWith('+ ')));

  // The singular, and it is the whole of the criterion: not `1 Promo-Envelopes`.
  assert.equal(list.envelopes.fetch, 1);
  assert.equal(list.envelopes.unit, 'Promo-Envelope');
  assert.ok(texts(list.envelopes).includes('comes out even'));
});

test('the ordinal of the broken unit is built, not pasted', () => {
  // The prototype writes `${sealed + 1}${sealed ? 'th' : 'st'}`, which says
  // `2th` and `3th`. Two displays' worth plus a remainder breaks the 3rd.
  const { list } = stand('weekly', { players: 17 });
  assert.equal(list.displays.total, '51 boosters');
  assert.ok(texts(list.displays).includes('+ 3 loose from the 3rd'));

  const second = stand('weekly', { players: 9 }).list;
  assert.equal(second.displays.total, '27 boosters');
  assert.ok(texts(second.displays).includes('+ 3 loose from the 2nd'));
});

test('`sealed` and `loose` are the only words for the axis, and `full` is not one', () => {
  for (const type of ['weekly', 'weekend', 'release']) {
    const { list } = stand(type, { players: 39, displays: [1] });
    assert.ok(!/\bfull\b/i.test(allText(list)), `\`full\` appears under ${type}`);
    assert.ok(!/\bunopened\b/i.test(allText(list)), `\`unopened\` appears under ${type}`);
  }
});

test('a DisplayReservation splits the procurement number and never raises it', () => {
  const plain = stand('weekly', { players: 39 });
  const reserved = stand('weekly', { players: 39, displays: [1] });
  const kept = reserved.plan.displayVector.reduce((sum, count) => sum + count, 0);

  assert.ok(kept > 0, 'the stand has to carry a reservation for this to say anything');
  assert.equal(reserved.list.displays.fetch, plain.list.displays.fetch);

  const split = reserved.list.displays.lines.find((line) => line.id === 'reservation');
  assert.equal(split.text, `${kept} of the ${plain.list.displays.fetch} ${kept === 1 ? 'stays' : 'stay'} sealed`);
  assert.equal(split.aside, `${plain.list.displays.fetch - kept} to open`);

  // And without one there is nothing to split.
  assert.equal(
    plain.list.displays.lines.find((line) => line.id === 'reservation'),
    undefined,
  );
});

test('a reservation larger than the whole procurement still never raises it', () => {
  const { list } = stand('weekly', { players: 4, boosterRate: 1, displays: [4, 4, 4, 4] });
  const split = list.displays.lines.find((line) => line.id === 'reservation');

  assert.equal(list.displays.fetch, 1);
  assert.equal(split.text, '1 of the 1 stays sealed');
  assert.equal(split.aside, '0 to open');
});

test('the difference to the yield is a half-sentence on the yield line, both ways', () => {
  const even = stand('weekly').list.winners.lines.find((line) => line.id === 'yield');
  assert.equal(even.aside, undefined);

  const more = stand('weekly', { winnerPacks: even.value + 2 }).list.winners;
  const moreLine = more.lines.find((line) => line.id === 'yield');
  assert.equal(moreLine.value, even.value + 2);
  assert.equal(moreLine.aside, '2 more set by hand');

  const fewer = stand('weekly', { winnerPacks: even.value - 1 }).list.winners;
  const fewerLine = fewer.lines.find((line) => line.id === 'yield');
  assert.equal(fewerLine.value, even.value - 1);
  assert.equal(fewerLine.aside, '1 stays in the box');

  // One hint, not two: the difference never gets a line of its own.
  assert.equal(more.lines.length, 3);
  assert.equal(more.lines.filter((line) => line.id === 'yield').length, 1);
});

test('the WinnerPack hint names the amount, carries a button and points at the packs', () => {
  const { list } = stand('weekly');
  const offer = list.winners.offer;

  assert.ok(offer);
  assert.equal(offer.key, 'tournamentPacks');
  assert.ok(offer.need > 0);
  assert.ok(offer.text.startsWith(`${offer.need} more`));
  assert.ok(offer.text.endsWith(`would make it ${offer.would}`));
  assert.equal(offer.button, `Set packs to ${offer.value}`);
});

/**
 * The hint's arithmetic, held against the core rather than against itself: the
 * packs it points at are the **smallest** `tournamentPacks` count at which
 * `derivePool()` yields more `WinnerPack`s than it does now, and the number it
 * promises is what comes out there. Swept over a range of stands, so the
 * envelope boundary — where the next `WinnerPack` only falls in the *next*
 * envelope — is inside the sweep and not a case somebody remembered.
 */
test('the hint points at the first packs count that really yields one more', () => {
  const type = TOURNAMENT_TYPES.find((entry) => entry.id === 'release');
  for (let packs = 0; packs <= 70; packs++) {
    const pins = { tournamentPacks: packs };
    const settings = resolveSettings({ game: GAME, type, pins });
    const offer = preparationList(distribute(settings, pins)).winners.offer;
    const now = derivePool(settings).winnersDerived;

    let first = null;
    for (let n = packs + 1; n <= packs + 200 && first === null; n++) {
      if (derivePool({ ...settings, tournamentPacks: n }).winnersDerived > now) first = n;
    }
    assert.ok(offer, `packs ${packs} has no hint`);
    assert.equal(offer.value, first, `packs ${packs}`);
    assert.equal(offer.need, first - packs, `packs ${packs}`);
    assert.equal(offer.would, derivePool({ ...settings, tournamentPacks: first }).winnersDerived);
  }
});

test('the hint is silent while winnerPacks is pinned, and only then', () => {
  assert.ok(stand('weekly').list.winners.offer);
  assert.equal(stand('weekly', { winnerPacks: 4 }).list.winners.offer, null);
  // A pin on some other slider says nothing about the staffel.
  assert.ok(stand('weekly', { players: 39 }).list.winners.offer);
});

test('the hint sits under the last line of the WinnerPack derivation', () => {
  const { list } = stand('weekly');
  assert.equal(list.winners.lines.at(-1).id, 'yield');
  assert.ok(list.winners.offer);
});

test('the closing sentence calls the judge pool and the reserved displays a move, not an order', () => {
  const { list } = stand('weekly', { players: 39, displays: [1] });
  assert.match(list.note, /judge pool/);
  assert.match(list.note, /reserved displays/);
  assert.match(list.note, /extra order/);
  assert.match(list.note, /moved around/);
});

test('the Pools get no procurement hint of their own', () => {
  const { list } = stand('weekly', { players: 39 });
  // Three items and a closing sentence: nothing here reports a
  // ParticipationPool, JudgePool or RankPool number, because the breakdown is
  // not additive.
  assert.deepEqual(Object.keys(list).sort(), ['displays', 'envelopes', 'note', 'winners']);
});
