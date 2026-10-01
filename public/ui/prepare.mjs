/**
 * The `PreparationList` as a derivation (#65): a `DistributionPlan` in, the
 * three procurement items out — `Display`s, `PromoEnvelope`s, `WinnerPack`s —
 * each with its step sequence written out rather than hidden behind a ⓘ.
 *
 * It sits on the proven side of Spec 2's seam: #61's Testing Decisions name
 * "die `PreparationList`-Zerlegung" as one of the pure derivations that
 * `node --test` holds, so every number and every word on `Prepare` is decided
 * here and the view only places them. No DOM, no state, no Settings reached
 * past the plan — `plan.settings` carries what it was computed from (ADR 0009)
 * and `plan.pinned` what was set by hand (its addendum (#86)).
 *
 * **One argument, not two.** The page needs the sheet (`displaySize`,
 * `envelopeSize`), the pool and the pins, and all three ride on the plan. A
 * second parameter would let a caller hand in a sheet the plan was not
 * computed from, which is the one way this breakdown could come out wrong
 * without anything throwing.
 *
 * ## The axis is `sealed` against `loose`, and there is no third pair
 *
 * A `PackagingUnit` **as it comes out of the box** against `PrizeItem`s
 * **taken out of one** — that is the whole distinction, and `CONTEXT.md`
 * (`PreparationList`) rules out naming it a third time. `full` is already one
 * too many: it means "randvoll" at the `PromoEnvelope` and "ungeöffnet" at the
 * `WinnerPack`, so the prototype's `${full} full` is not copied here. Getting
 * **more concrete** is allowed where the line says where the pieces come from
 * (`+ 21 loose from the 5th`, `3 stay in the box`); that is more than
 * `sealed`/`loose`, not something else.
 *
 * ## What the prototype says and where this departs from it
 *
 * `prepContent()` in `prototypes/cockpit.prototype.html` (branch
 * `prototype/rank-distribution`) is the decided form, and it is followed in
 * shape — headline number, unit, total aside, a step sequence, one closing
 * note. Four departures, each because the ticket or `CONTEXT.md` says
 * otherwise, and each reported rather than taken silently:
 *
 * 1. **The ordinal is built.** The prototype writes
 *    `${sealed + 1}${sealed ? 'th' : 'st'}`, which says `2th`, `3th`, `21th`.
 * 2. **`full` is gone**, on both the envelope and the winner item — see above.
 * 3. **A `DisplayReservation` splits the procurement number** instead of
 *    adding a line beside it (#65: "teilt die Beschaffungszahl … und erhöht
 *    sie nie"), so the split names the unchanged total it is a split of.
 * 4. **The difference to the yield is a half-sentence on the yield line**
 *    (#65, `CONTEXT.md`), not a `keep` line of its own — a `Herkunftsangabe`
 *    and not a second hint.
 *
 * The hint follows the prototype's arithmetic (`nextAt =
 * partialYield < y ? thresholds[partialYield] : null`): it counts **only
 * inside the opened envelope**. Built first as a "correction" that reached
 * across into the next envelope, it said `21 more packs would make it 5` at
 * Release with 54 packs; the maintainer's run-11 decision on #65 (K2) took it
 * back, because a sentence asking for a whole further envelope for one card is
 * exactly the extra order the closing note says nothing here is. The same
 * decision makes a fifth departure: where nothing is opened, the prototype
 * still offers its first threshold, and this hint stays silent — see
 * `nextWinner()`.
 */

import { derivePool } from '../core/distribute.mjs';

/** `1st`, `2nd`, `3rd`, `4th` — and `11th`, `12th`, `13th`, `21st`. */
function ordinal(n) {
  const tens = n % 100;
  const ones = n % 10;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** The screen's plural, with the irregular form spelled out where there is one. */
function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

/** A step of a derivation: what it says, what it says beside it, what it adds up to. */
function line(text, { aside, value, tone = 'plain', id } = {}) {
  const step = { text, tone };
  if (aside !== undefined) step.aside = aside;
  if (value !== undefined) step.value = value;
  if (id !== undefined) step.id = id;
  return step;
}

/** A settings field as a whole number with a floor, the plan's own reading. */
function size(value, low) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(low, Math.trunc(n)) : low;
}

/**
 * The `Display`s: the whole `PrizePool`'s `Booster`s, broken into sealed
 * `Display`s plus the loose remainder out of the one that gets opened.
 *
 * The procurement number rounds **up** and names the broken unit — that is the
 * one hint this item carries, and it is the headline itself. A
 * `DisplayReservation` splits it and never raises it: the reserved `Display`s
 * go over sealed, the rest is what gets opened at the table. Where a pinned
 * reservation asks for more `Display`s than the whole pool holds — reachable,
 * the plan reports it as a `conflict` rather than refusing it (ADR 0002) — the
 * split is read against the procurement number, because that is the number it
 * is a split *of*. The shortfall itself is the `ConflictNotice`'s to tell.
 */
function displaysItem(plan) {
  const perDisplay = size(plan.settings.displaySize, 1);
  const rate = size(plan.settings.boosterRate, 0);
  const total = plan.pool.booster;
  const sealed = Math.floor(total / perDisplay);
  const loose = total % perDisplay;
  const fetch = Math.ceil(total / perDisplay);
  const reserved = plan.displayVector.reduce((sum, count) => sum + count, 0);
  const staySealed = Math.min(reserved, fetch);

  const lines = [
    line(`${plan.players} players × ${rate} each`, { value: total }),
    line(`÷ ${perDisplay} per display`, { tone: 'muted' }),
    line(`${sealed} sealed`, { value: sealed * perDisplay }),
  ];
  if (loose > 0) {
    lines.push(line(`+ ${loose} loose from the ${ordinal(sealed + 1)}`, { value: total }));
    lines.push(line(`${perDisplay - loose} stay in the box`, { tone: 'muted' }));
  } else {
    lines.push(line('comes out even', { tone: 'muted' }));
  }
  if (staySealed > 0) {
    lines.push(
      line(`${staySealed} of the ${fetch} ${plural(staySealed, 'stays', 'stay')} sealed`, {
        aside: `${fetch - staySealed} to open`,
        tone: 'keep',
        id: 'reservation',
      }),
    );
  }

  return { fetch, unit: plural(fetch, 'display'), total: `${total} ${plural(total, 'booster')}`, lines };
}

/**
 * The `PromoEnvelope`s: the `TournamentPack`s of the whole `PrizePool` in
 * sealed envelopes plus the loose packs out of the one that gets opened.
 *
 * `1 Promo-Envelope`, never `1 Promo-Envelopes` (#65) — the unit is asked for
 * the number it stands under, here and at the `Display`s alike.
 */
function envelopesItem(plan) {
  const perEnvelope = size(plan.settings.envelopeSize, 1);
  const packs = plan.pool.packs;
  const sealed = Math.floor(packs / perEnvelope);
  const fetch = Math.ceil(packs / perEnvelope);
  const opened = plan.pool.opened;

  const lines = [
    line(`${packs} packs`, { aside: `÷ ${perEnvelope} per envelope` }),
    line(`${sealed} sealed`, { value: sealed * perEnvelope }),
  ];
  if (opened > 0) {
    lines.push(line(`+ ${opened} loose from the ${ordinal(sealed + 1)}`, { value: packs }));
  } else {
    lines.push(line('comes out even', { tone: 'muted' }));
  }

  return {
    fetch,
    unit: plural(fetch, 'Promo-Envelope'),
    total: `${packs} tournament ${plural(packs, 'pack')}`,
    lines,
  };
}

/**
 * How many more `TournamentPack`s the next `WinnerPack` is away, and what it
 * would make — **inside the opened `PromoEnvelope` and nowhere else** (#65,
 * run-11 decision K2). The way is the prototype's: the next threshold of the
 * envelope's staffel, minus what is already counted off it.
 *
 * Two stands have no such way, and the hint falls silent at both, beside the
 * pin (the ticket's first silence; this is its second):
 *
 * - **Nothing is opened** — the packs come out even in sealed envelopes. The
 *   next `WinnerPack` would need a further envelope fetched and broken, and
 *   that is an extra order. The prototype would still offer it here; the
 *   decision names this stand (64 packs, two even envelopes) as silent, and
 *   the decision is what is built.
 * - **The opened envelope has passed every threshold** — the next
 *   `WinnerPack` lies a whole envelope away (Release at 54 packs: 4 winner
 *   packs, and no sentence about a 5th).
 *
 * What the count would make is read out of `derivePool()` rather than written
 * as `+ 1`, so the promise is the core's and not this function's.
 */
function nextWinner(plan) {
  const { opened, partialYield, thresholds, packs } = plan.pool;
  if (opened === 0 || partialYield >= thresholds.length) return null;
  const need = thresholds[partialYield] - opened;
  if (need <= 0) return null;
  const would = derivePool({ ...plan.settings, tournamentPacks: packs + need }).winnersDerived;
  return { need, value: packs + need, would };
}

/**
 * The `WinnerPack`s: what the full `PromoEnvelope`s yield, what the opened one
 * has counted off so far, and what is on the table in the end.
 *
 * Two things hang off the **yield line** and nothing else does. A difference
 * between the `WinnerPack`s that are there and what the envelopes yield is a
 * half-sentence on it, in both directions — a `Herkunftsangabe`, not a second
 * hint. And the opportunity sits under it as the last line of the derivation:
 * whoever says how the 3 came about says with it how one gets to 4.
 *
 * It is an **opportunity and not a notice**, so it never enters the
 * `NoticeStack`. It falls silent while `winnerPacks` is `pinned` — read off
 * the plan's own record of what was set by hand, which is the same stored
 * `pins` the app keeps (ADR 0006: the pin is set by the operating gesture) —
 * because then the staffel is not what the number follows. It falls silent,
 * too, where the opened envelope has no next threshold left (`nextWinner()`).
 *
 * The button raises **`tournamentPacks`**: the way to another `WinnerPack`
 * runs over more packs out of the envelope already opened, up to its next
 * threshold. It is not an extra `WinnerPack` conjured onto the table.
 */
function winnersItem(plan) {
  const perEnvelope = size(plan.settings.envelopeSize, 1);
  const yieldPer = size(plan.settings.envelopeYield, 1);
  const sealed = Math.floor(plan.pool.packs / perEnvelope);
  const winners = plan.pool.winners;
  const derived = plan.pool.winnersDerived;
  const off = winners - derived;
  // `hasOwnProperty` holds here only because `plan.pinned` is the core's
  // `snapshot()` of the pins, a plain object whose spread has already done the
  // tracked reads (`ownKeys`, `get`) on the Alpine proxy; asked of that proxy
  // itself it would land on the `getOwnPropertyDescriptor` trap, which nothing
  // tracks (#67). After #67 merges, this read is a row in its `READ_SITES`.
  const pinned = Object.prototype.hasOwnProperty.call(plan.pinned, 'winnerPacks');

  const lines = [
    line(`${sealed} sealed ${plural(sealed, 'envelope')}`, {
      aside: yieldPer > 1 ? `× ${yieldPer} each` : undefined,
      value: sealed * yieldPer,
    }),
    line(`${plan.pool.opened} loose`, {
      aside: plan.pool.thresholds.map((at, k) => `${k + 1} at ${at}`).join(', '),
      value: plan.pool.partialYield,
    }),
  ];
  const half =
    off > 0
      ? `${off} more set by hand`
      : off < 0
        ? `${-off} ${plural(-off, 'stays', 'stay')} in the box`
        : undefined;
  lines.push(
    line(`${derived} from the envelopes`, {
      aside: half,
      value: winners,
      tone: off === 0 ? 'plain' : 'keep',
      id: 'yield',
    }),
  );

  const next = pinned ? null : nextWinner(plan);
  const offer = next && {
    key: 'tournamentPacks',
    need: next.need,
    value: next.value,
    would: next.would,
    text: `${next.need} more ${plural(next.need, 'pack')} would make it ${next.would}`,
    button: `Set packs to ${next.value}`,
  };

  return {
    fetch: winners,
    unit: plural(winners, 'winner pack'),
    // No piece count beside the headline: here the headline **is** the piece
    // count. What the aside says instead is where it comes from.
    source: pinned ? 'set by hand' : 'from the envelopes',
    lines,
    offer: offer ?? null,
  };
}

/**
 * The three items and the closing sentence.
 *
 * The `Pool`s are deliberately absent: holding is a total matter, sorting a
 * `Pool` matter, and the breakdown is not additive — the `Booster`s of one
 * opened `Display` flow into several `Pool`s (`CONTEXT.md`,
 * `PreparationList`). So there is exactly one procurement hint per
 * `PackagingUnit` and none per `Pool`.
 */
export function preparationList(plan) {
  return {
    displays: displaysItem(plan),
    envelopes: envelopesItem(plan),
    winners: winnersItem(plan),
    note: 'Nothing here is an extra order — the judge pool and the reserved displays are the same pool, moved around.',
  };
}
