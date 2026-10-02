/**
 * The NoticeStack's proven half (#68): the fold rule and what each of the
 * three notices says. No DOM, no state of its own — the fold record is handed
 * in and a new one handed back, so `node --test` holds the whole rule (#61,
 * Testing Decisions: "reine Logik über zwei Schlüsseln und braucht kein DOM").
 * Where the stack sits, what it covers and in which colour is the measuring
 * rind's and the picture's (`views/notices.php`, `plan.css`).
 *
 * Three inhabitants, two families (CONTEXT.md, `NoticeStack`):
 *
 * - **State notices** — `ConflictNotice` and `Offer`. They stand while a
 *   condition holds and open again when its **kind** changes, never when only
 *   its numbers do. Measured in the prototype: with the numbers in the key,
 *   the notice sprang open at every click on exactly the slider it names.
 * - **The event notice** — `CarryOverNotice`. Every Set switch is a new event;
 *   it always opens, and it opens the standing state notices with it, because
 *   the whole sheet under them was just exchanged.
 *
 * **Whether a ConflictNotice stands is asked of `unfit(plan)`** and of the
 * plan's four report fields, never by recomputing a sum: since #56 a conflict
 * stand adds up, and an empty PrizePool fulfils every sum rule (comment on
 * #68, 2026-09-27 14:59). Its sources are named, never numbered (K7,
 * CONTEXT.md `ConflictNotice`), and the kind is the set of sources that hold.
 *
 * One source is not the core's: the **`WinnerPack` overhang** (#70) — more
 * WinnerPacks on the tiles than the RankPool holds. The core does not report
 * it, so it is asked of `winnerPackOverhang(plan)` (`overhang.mjs`) beside
 * `unfit(plan)`, and `conflictStands()` is the two together. `unfit()` itself
 * stays the core's four: it is also the test every probe of the core's search
 * must pass, and an overhang folded into it would fail every probe of a
 * floor conflict standing beside it.
 */

import { unfit } from '../core/distribute.mjs';
import { offerFor, waysOut } from '../core/suggest.mjs';
import { dropNoun, pinLabel } from './controls.mjs';
import { overhangWaysOut, WINNER_PACK_OVERHANG, winnerPackOverhang } from './overhang.mjs';

/**
 * Whether a ConflictNotice stands: one of the core's four sources (`unfit`)
 * or the `WinnerPack` overhang. This, not `unfit()`, is what the NoticeStack
 * asks — for the notice, for its kind, and for the Offer's silence.
 */
export function conflictStands(plan) {
  return unfit(plan) || winnerPackOverhang(plan) !== null;
}

/**
 * The ways out and the Offer of a plan, computed once per stand. Both are
 * re-runs of the core — up to a few hundred `distribute()` calls each — and
 * the surface reads them several times per drawing, while Alpine caches no
 * getter. The plan carries the Settings it was computed from (ADR 0009), and
 * nothing else enters either search, so they are the key.
 */
let memo = { key: null, ways: [], offer: null };

export function searchesFor(plan) {
  const key = JSON.stringify(plan.settings);
  if (memo.key !== key) {
    // The core's ways and the overhang's run on disjoint sliders, so both
    // lists stand side by side; the Offer is silent while either holds —
    // `offerFor()` asks `unfit()` alone and would offer on an overhang.
    memo = {
      key,
      ways: [...waysOut(plan), ...overhangWaysOut(plan)],
      offer: conflictStands(plan) ? null : offerFor(plan),
    };
  }
  return { ways: memo.ways, offer: memo.offer };
}

/** The four sources the core reports, in the order `CONTEXT.md` lists them. */
const SOURCES = ['conflict', 'overtake', 'orphanedReservation', 'unclaimedRemainder'];

/**
 * The ConflictNotice's key: the names of the sources that hold, joined — or
 * `null` on a fit plan. It carries the kind and never the numbers, so a floor
 * moved from 3 to 4 under a standing shortfall is the same key, and an
 * overtake replacing it is another. Two sources at once are a kind of their
 * own: a second fact turning up under a minimized notice is news.
 */
export function conflictKind(plan) {
  if (!conflictStands(plan)) return null;
  const sources = SOURCES.filter((source) => plan[source]);
  if (winnerPackOverhang(plan)) sources.push(WINNER_PACK_OVERHANG);
  return sources.join('+');
}

/** The rule itself, over two keys: a different key reopens, the same does not. */
export function reopens(before, after) {
  return before !== after;
}

/**
 * The fold record a fresh app starts with — and the one a reload leaves,
 * because it is session state and in the `SetupLink` as little as the active
 * page is (#61, "Session state"). Everything open: a notice that appears as a
 * chip is ignored, and the ✕ is the price for starting loud.
 */
export function freshFold() {
  return {
    conflict: { key: null, open: true },
    offer: { key: null, open: true, dismissed: null },
    carryOver: { event: 0, open: true, dismissed: false },
  };
}

/**
 * The Offer's key. Minimizing belongs to the surface, so the key is only the
 * kind — `'offer'` — and never its numbers. Dismissing belongs to **this**
 * offer with its numbers, so a dismissed offer counts as absent until its
 * content changes, and then it is a new appearance (CONTEXT.md, `Offer`).
 * Never while a ConflictNotice stands: one presumes a fit plan, the other an
 * unfit one.
 */
function offerKey(plan, offer, dismissed) {
  if (!offer || conflictStands(plan)) return null;
  return offer.key === dismissed ? null : 'offer';
}

/**
 * One step of the fold: the record before, the stand now → the record after.
 * `event` is the count of Set switches so far; a higher one than the record
 * knows is a new switch.
 */
export function foldStep(fold, { plan, offer = null, event = fold.carryOver.event }) {
  const conflictNow = conflictKind(plan);
  const offerNow = offerKey(plan, offer, fold.offer.dismissed);
  const switched = event !== fold.carryOver.event;
  return {
    conflict: {
      key: conflictNow,
      open: switched || reopens(fold.conflict.key, conflictNow) ? true : fold.conflict.open,
    },
    offer: {
      key: offerNow,
      open: switched || reopens(fold.offer.key, offerNow) ? true : fold.offer.open,
      dismissed: fold.offer.dismissed,
    },
    carryOver: switched
      ? { event, open: true, dismissed: false }
      : fold.carryOver,
  };
}

/** Minimized: the notice shrinks to its chip. The chip only opens again. */
export function minimize(fold, id) {
  return { ...fold, [id]: { ...fold[id], open: false } };
}

/** The chip's one action: open. It accepts nothing and triggers nothing. */
export function expand(fold, id) {
  return { ...fold, [id]: { ...fold[id], open: true } };
}

/**
 * The ✕. The Offer remembers **which** offer was turned down, by its content;
 * the CarryOverNotice is gone until the next switch. The ConflictNotice has no
 * ✕ — its presence is the statement (ADR 0002) — so there is nothing to
 * dismiss and the record comes back unchanged.
 */
export function dismiss(fold, id, offer = null) {
  if (id === 'offer') return { ...fold, offer: { ...fold.offer, key: null, dismissed: offer?.key ?? null } };
  if (id === 'carryOver') return { ...fold, carryOver: { ...fold.carryOver, dismissed: true } };
  return fold;
}

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

/** `rank 3`, `ranks 3 and 4`, `ranks 1, 2 and 3` — the Ranks said in prose. */
function rankList(ranks) {
  if (ranks.length === 1) return `rank ${ranks[0]}`;
  return `ranks ${ranks.slice(0, -1).join(', ')} and ${ranks[ranks.length - 1]}`;
}

const capital = (text) => text[0].toUpperCase() + text.slice(1);

/**
 * The ConflictNotice's prose, one line per source that holds. It **names its
 * Ranks** and never relies on the red marking: it can open over the sheet,
 * and then the tiles are covered (#61). The chip says *that*, the tiles say
 * *where*, the open notice says *how out*.
 *
 * `conflict` and `overtake` are the prototype's sentences (`conflictBox()`).
 * The prototype has none for the other two sources — a gap there, not a
 * decision (ADR 0002, addendum K1) — so those two, and the reading of a
 * `conflict` whose `have` is below zero, are written here new.
 */
function conflictLines(plan) {
  const lines = [];
  if (plan.conflict) {
    const { need, have } = plan.conflict;
    lines.push(
      have >= 0
        ? `${have} ${plural(have, 'booster')} can't carry a floor of ${need}.`
        : `The reserved displays take ${-have} ${plural(-have, 'booster')} more than the ranks hold.`,
    );
    const short = plan.flagged;
    if (short.length) {
      lines.push(`${capital(rankList(short))} ${short.length === 1 ? 'gets' : 'get'} less than promised — the curve has nothing left to shape.`);
    }
  }
  if (plan.overtake) {
    const { under, over, has, gets } = plan.overtake;
    lines.push(`Rank ${over} overtakes rank ${under}: rank ${over} gets ${gets}, rank ${under} only ${has}.`);
    lines.push('A reserved display settles a rank at exactly its boxes — the rank-1 lead is off, so the curve below can overtake it.');
  }
  if (plan.orphanedReservation) {
    const ranks = plan.orphanedReservation.ranks;
    const many = ranks.length > 1;
    lines.push(
      `${capital(rankList(ranks))} ${many ? 'hold' : 'holds a'} reserved ${plural(ranks.length, 'display')}, ` +
        `but only ${plan.depth} ${plural(plan.depth, 'rank')} ${plan.depth === 1 ? 'is' : 'are'} served.`,
    );
    lines.push(`${many ? 'They get' : 'It gets'} no tile, and the line under the tiles counts ${many ? 'them' : 'it'} among the ranks that get nothing.`);
  }
  if (plan.unclaimedRemainder) {
    const depth = plan.unclaimedRemainder.depth;
    const rest = plan.shapedRemainder;
    lines.push(
      `The reserved displays settle all ${depth} served ${plural(depth, 'rank')}, ` +
        `so ${rest} ${plural(rest, 'booster')} ${rest === 1 ? 'has' : 'have'} no rank to go to.`,
    );
  }
  return lines;
}

/**
 * The overhang's prose, written new: the prototype only has the half-line
 * `5 placed, 2 over` at the `winnerPacks` control and reports nothing — the
 * **correction to the prototype** of #61 and #70. The first sentence keeps
 * its numbers; the second names the Ranks the stock does not cover, the ones
 * the take-back touches, because the notice may open over the sheet and
 * cover the tiles (#61).
 */
function overhangLines(plan) {
  const overhang = winnerPackOverhang(plan);
  if (!overhang) return [];
  const { placed, by, have, ranks } = overhang;
  return [
    `${placed} ${plural(placed, 'winner pack')} placed, ${by} over — the ranks hold ${have}.`,
    `${by === 1 ? 'The one' : 'The ones'} past the stock ${by === 1 ? 'is' : 'are'} placed by hand on ${rankList(ranks)}.`,
  ];
}

/** The Offer's prose: the prototype's `offerBox()`, sentence for sentence. */
function offerLines(offer, displaySize) {
  const k = offer.value;
  const displays = `${k} sealed ${plural(k, 'display')}`;
  const exact = offer.from === offer.to;
  const head = exact
    ? `Rank ${offer.rank} could take ${displays} instead of ${offer.from} loose boosters.`
    : `Rank ${offer.rank} is ${Math.abs(offer.from - offer.to)} off a full display.`;
  const detail = exact
    ? `The tile keeps its ${offer.from} — what changes is the packaging: ${displays} of ${displaySize} instead of loose boosters, and the preparation list follows.`
    : `${offer.from} → ${offer.to} boosters — ${displays} of ${displaySize}, handed over unopened.`;
  const also = offer.also.length
    ? ` Also moves ${plural(offer.also.length, 'rank')} ${offer.also.map((a) => `${a.rank}: ${a.before}→${a.after}`).join(', ')}.`
    : '';
  return [head, detail + also];
}

/** The CarryOverNotice's button, the prototype's `carryLabel()` (#41). */
export function carryLabel(count, to) {
  return count > 1 ? `Drop all ${count} and follow ${to}` : `Drop it and follow ${to}`;
}

/**
 * A ConflictNotice with **no way out at all** (maintainer decision on #68,
 * run 12, K2 `satz-zur-tatsache`; ADR 0002, addendum K2). It says in one
 * sentence the fact of the evening that empties the RankPool — no
 * `Boosters per player (pool)` — and offers no button, because no value the
 * app may suggest changes it (`players`, `boosterRate`, `displaySize` are
 * never a way out). The chip carries a word and no number: `⚠ 0 ways out`
 * announced something that does not exist.
 *
 * Zero ways occur **only** at a `boosterRate` of 0 — measured over a grid in
 * `test/ui-notices.test.mjs`. Should one turn up elsewhere, this sentence
 * would be wrong there, and that is a finding, not a case for a second one.
 *
 * The chip word is decided (run 12, Phase G, `G-chip-0-booster` on #68):
 * `No boosters`. The builder's earlier `Nothing to give` fell because it is
 * untrue — tournament and winner packs still reach the ranks at a
 * `boosterRate` of 0; only the boosters are missing. *Boosters* stands in its
 * own sense, and the word keeps clear of *slider* and *setting* (#113 AC 16).
 * The sentence is still the builder's proposal from PR #118.
 */
const NO_WAY_OUT = {
  lines: [`With “${pinLabel('boosterRate')}” at 0, there are no boosters to give out.`],
  actions: [],
  chip: { glyph: '⚠', word: 'No boosters' },
};

/**
 * The stack as it stands: `{ open, chips }`, each in the order of what it
 * talks about — the plan's notice first, the input's last (#31).
 *
 * - `plan` — the DistributionPlan on screen.
 * - `ways` — its ways out, `waysOut(plan)`: the single ones, or the one
 *   combined way where no single slider clears, or none — then `NO_WAY_OUT`.
 * - `offer` — `offerFor(plan)`, or `null`.
 * - `carry` — the last Set switch, `{ to, keys }`: the type it went to and the
 *   pinned items that stayed behind; `null` before the first switch.
 * - `fold` — the record `foldStep()` keeps.
 */
export function noticeStack({ plan, ways = [], offer = null, carry = null, fold }) {
  const notices = [];

  if (conflictStands(plan)) {
    // The core's sources speak first, then the overhang. Where the core's
    // sources hold and none of the core's ways clears, its part is the one
    // sentence to the fact (`NO_WAY_OUT`) — the overhang's ways do not
    // touch that fact and are no way out of it.
    const coreWays = ways.filter((way) => way.source !== WINNER_PACK_OVERHANG);
    const mute = unfit(plan) && coreWays.length === 0;
    notices.push({
      id: 'conflict',
      closable: false,
      lines: [...(mute ? NO_WAY_OUT.lines : conflictLines(plan)), ...overhangLines(plan)],
      actions: ways.map((way) => ({ label: way.label, way })),
      chip: ways.length
        ? { glyph: '⚠', word: `${ways.length} ${plural(ways.length, 'way')} out` }
        : NO_WAY_OUT.chip,
    });
  } else if (offer && offer.key !== fold.offer.dismissed) {
    const displaySize = plan.settings?.displaySize ?? 1;
    notices.push({
      id: 'offer',
      closable: true,
      lines: offerLines(offer, displaySize),
      actions: [{ label: `Reserve ${offer.value} ${plural(offer.value, 'display')} for rank ${offer.rank}`, offer }],
      chip: { glyph: null, word: 'Offer' },
    });
  }

  if (carry && carry.keys.length && !fold.carryOver.dismissed) {
    const n = carry.keys.length;
    const names = carry.keys.map(pinLabel).join(', ');
    notices.push({
      id: 'carryOver',
      closable: true,
      lines: [
        // The item's word is `dropNoun()`'s, never spelled out here: #113
        // swaps it from *slider* to *value* in one place (#113 AC 16).
        `${n} pinned ${dropNoun(n)} stayed behind.`,
        `${names} — set by hand, so ${n > 1 ? 'they do' : 'it does'} not follow ${carry.to}.`,
      ],
      actions: [{ label: carryLabel(n, carry.to), drop: carry.keys }],
      chip: { glyph: null, word: `${n} kept` },
    });
  }

  return {
    open: notices.filter((notice) => fold[notice.id].open),
    chips: notices.filter((notice) => !fold[notice.id].open).map((notice) => ({ id: notice.id, ...notice.chip })),
  };
}
