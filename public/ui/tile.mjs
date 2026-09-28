/**
 * The tile as a grip (#66): what a `Rank`'s tile shows, and what the bubble
 * behind it offers.
 *
 * Two Settings fields are set here and nowhere else — the `DisplayReservation`
 * and the `manual` share of the `WinnerPackAllocation`. Both name a `Rank`, and
 * a `Rank` is a tile, not a number one types into a slider (ADR 0003, #17,
 * #21, #61 "The tiles and their grip"). The caps themselves are not in this
 * file: they live in `controls.mjs` beside the sliders', because #61 gives a
 * cap exactly one home. What is here is what the screen says **about** a cap —
 * and that is the ticket's third criterion, "ein gesperrtes ± sagt am Schirm,
 * warum es gesperrt ist".
 *
 * It is pure: a stand goes in, a model comes out, `node --test` proves it. The
 * bubble's *position* is not here either — that is `bubble.mjs`, which takes
 * measured boxes and returns numbers, with the measuring itself the one thin
 * unproven rind #61 allows the shell.
 *
 * The form is the prototype's (`git show
 * prototype/rank-distribution:prototypes/cockpit.prototype.html`, `slotPop()`
 * and `slotGrid()`): one bubble with two rows, title left and counter right,
 * a muted sentence under each. Two places depart from it, and both are
 * repairs rather than choices:
 *
 * - The prototype's `displayReach()` runs the reservation condition in **both**
 *   directions, so a reservation a sunk cap left standing had its minus greyed
 *   out too — the one handling that clears the conflict, gone at the moment it
 *   is wanted (ADR 0006). `controls.mjs` caps outward only.
 * - The prototype names the `Rank` above as a reason but leaves a plus refused
 *   by the **reservation condition** unexplained. Every lock here carries a
 *   sentence.
 *
 * **Four of those sentences have no wording in the prototype, and they are
 * decided, not provisional** — `nothing placed by hand here`, `the rank pool
 * cannot carry another display`, `nothing reserved here` and `rank N holds M —
 * lower it first`. `slotPop()` leaves those four locks silent, so this file
 * wrote them and said so; the maintainer settled them as they stand on
 * 2026-09-28 (`gh issue view 66 --comments`, "Entschieden: die vier Sätze am
 * gesperrten `±` gelten, so wie sie gebaut sind"). They are not an invention
 * to be flagged again and not a gap in the prototype to be filled in from it.
 * The two ways that were weighed and rejected are in that comment too.
 */

import { canPlaceWinner, canReserveDisplays } from './controls.mjs';

/** `1 display` / `2 displays` — the count stands in the tile because two tiles
 *  are otherwise the same size while one carries twice as much (#61). */
function displayCount(n) {
  return `${n} ${n === 1 ? 'display' : 'displays'}`;
}

/** The sentence under a counter: its parts in order, each said once. */
function sentence(parts) {
  return [...new Set(parts.filter(Boolean))].join(' · ');
}

/**
 * What the tile itself shows beyond its numbers: the states it carries as
 * form rather than as words.
 *
 * `tile-flagged` is load-bearing and not decoration — a minimised
 * `ConflictNotice` would otherwise leave a conflicting plan looking valid,
 * which is the one thing ADR 0002 is written against. The tile says *where*
 * while the chip says *that*.
 */
export function tileView(row, plan) {
  const flagged = plan.flagged.includes(row.rank);
  return {
    classes: [
      row.displays > 0 ? 'tile-reserved' : null,
      row.settled ? 'tile-settled' : null,
      row.served ? null : 'tile-unserved',
      flagged ? 'tile-flagged' : null,
    ].filter(Boolean),
    displayLabel: row.displays > 0 ? displayCount(row.displays) : null,
  };
}

/**
 * The bubble behind a tile, as a model: `null` for a `Rank` the plan does not
 * have, otherwise the two counters with their ends and the sentence each one
 * owes the screen.
 *
 * `displays` is `null` on a `Rank` the `RankPoolDepth` does not serve. Nothing
 * is greyed out there — the bubble names the way there instead, because a
 * reservation on an unserved `Rank` is a promise the plan cannot keep
 * (CONTEXT.md, `DisplayReservation`) and the handling that makes it keepable
 * is a different control entirely.
 *
 * The `Winner packs` counter stands on **every** `Rank` in the grid, served or
 * not: the `manual` share runs over the whole `Ranking` and is independent of
 * the `RankPoolDepth` (CONTEXT.md, `WinnerPackAllocation`).
 */
export function tileGrip(rank, stand) {
  const { settings, plan } = stand;
  const r = Math.trunc(Number(rank));
  if (!Number.isFinite(r) || r < 1 || r > plan.players) return null;
  const row = plan.rows[r - 1];
  if (!row) return null;

  return {
    rank: r,
    served: row.served,
    settled: row.settled,
    flagged: plan.flagged.includes(r),
    winners: winnerCounter(r, row, stand),
    displays: row.served ? displayCounter(r, row, settings, stand) : null,
    wayIn: row.served ? null : wayInSentence(r, plan),
  };
}

/**
 * The way in from an unserved `Rank`, and it has two cases because the `Rank`
 * has two states. An unserved `Rank` with nothing on it is one nobody has
 * promised anything — "before reserving a display here" is true of it. An
 * unserved `Rank` that **already holds a reservation** is the orphaned one the
 * core reports as `orphanedReservation`, and there the same sentence says the
 * opposite of the truth: it has reserved, and raising `Served ranks` is what
 * would make the promise keepable rather than what would let it be made.
 *
 * Read off `plan.orphanedReservation` rather than re-derived from the vector:
 * the core already decides which `Rank`s are orphaned, and a second copy of
 * that rule here is a second thing to keep in step. `row.displays` is no help
 * — it is 0 past the `RankPoolDepth` by construction, which is exactly the
 * reading that made the sentence wrong.
 *
 * Making the orphaned reservation visible *elsewhere* is not this file's job:
 * the grid's foot stays as it is and the way out is the `ConflictNotice`
 * (#68, maintainer decision 2026-09-28).
 */
function wayInSentence(rank, plan) {
  const held = orphanedDisplaysAt(rank, plan);
  return held > 0
    ? `Rank ${rank} is not served — raise Served ranks to reach the ${displayCount(held)} reserved here.`
    : `Rank ${rank} is not served — raise Served ranks before reserving a display here.`;
}

/** How many `Display`s an unserved `Rank` holds, or 0 — the count the core's
 *  `orphanedReservation` names the `Rank` for, read out of the stored vector. */
function orphanedDisplaysAt(rank, plan) {
  if (!plan.orphanedReservation?.ranks.includes(rank)) return 0;
  const vector = Array.isArray(plan.settings?.displays) ? plan.settings.displays : [];
  return Math.max(0, Math.trunc(Number(vector[rank - 1])) || 0);
}

/**
 * The `Winner packs` counter. The number it shows is the `Rank`'s whole share,
 * `ranked` and `manual` together — that is the number the tile shows and the
 * one the raffle writes into — while only the `manual` part is the tile's to
 * take back. What `ranked` set is not adjustable here (CONTEXT.md,
 * `WinnerPackAllocation`), and "by rank, fixed" is both the statement and the
 * reason the minus is closed.
 */
function winnerCounter(rank, row, stand) {
  const { plan } = stand;
  const manual = plan.allocation.manual[rank] ?? 0;
  const byRank = Math.max(0, row.winners - manual);
  const open = plan.allocation.open;
  const byRankLine = byRank > 0 ? `${byRank} by rank, fixed` : null;

  const canAdd = canPlaceWinner(rank, manual + 1, stand);
  const canRemove = canPlaceWinner(rank, manual - 1, stand);
  // `nothing placed by hand here` is decided wording, not a stand-in — see the
  // file head and the resolution comment on #66 (2026-09-28).
  const addReason = canAdd
    ? null
    : manual > 0
      ? 'all placed'
      : 'all placed — take one off another rank first';
  const removeReason = canRemove ? null : (byRankLine ?? 'nothing placed by hand here');

  return {
    value: row.winners,
    byRank,
    manual,
    open,
    canAdd,
    canRemove,
    addReason,
    removeReason,
    note: sentence([byRankLine, open > 0 ? `${open} still open` : null, addReason, removeReason]),
  };
}

/**
 * The `Displays` counter. Its sentence says what the reservation binds and
 * what it did to the `Rank` — settled and out of the curve, or tied and still
 * in it, which is the distinction the `RankFloor` and the `Rank` 1 lead hang
 * off (CONTEXT.md, `DisplayReservation`).
 */
function displayCounter(rank, row, settings, stand) {
  const size = Math.max(1, Math.trunc(Number(settings.displaySize)) || 1);
  const value = row.displays;
  const vector = Array.isArray(settings.displays) ? settings.displays : [];
  const above = rank > 1 ? Math.max(0, Math.trunc(Number(vector[rank - 2])) || 0) : null;
  const below = Math.max(0, Math.trunc(Number(vector[rank])) || 0);

  const canAdd = canReserveDisplays(rank, value + 1, stand);
  const canRemove = canReserveDisplays(rank, value - 1, stand);
  // The three below — `the rank pool cannot carry another display`, `nothing
  // reserved here`, `rank N holds M — lower it first` — are decided wording,
  // not stand-ins; see the file head and #66's resolution comment (2026-09-28).
  const addReason = canAdd
    ? null
    : above != null && value >= above
      ? `rank ${rank - 1} caps this at ${above}`
      : 'the rank pool cannot carry another display';
  const removeReason = canRemove
    ? null
    : value === 0
      ? 'nothing reserved here'
      : `rank ${rank + 1} holds ${below} — lower it first`;

  const base =
    value > 0
      ? `${value * size} boosters reserved · ${row.settled ? 'settled, out of the curve' : 'tied, still in the curve'}`
      : `${size} boosters each`;

  return {
    value,
    reserved: value * size,
    canAdd,
    canRemove,
    addReason,
    removeReason,
    note: sentence([base, addReason, removeReason]),
  };
}
