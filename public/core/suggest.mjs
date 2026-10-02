/**
 * The ways out of an unfit DistributionPlan (#59).
 *
 * The procedure is one for every case: vary a single slider over its range,
 * never two at once, run `distribute()` again per value, and keep the nearest
 * value that clears the state. That this works at all is what ADR 0002 buys —
 * the calculation is total, so every candidate value has a plan to compare,
 * and a rejected candidate is a plan that is still unfit rather than no plan.
 *
 * **Which sliders are searched** is the intersection of two conditions (#42,
 * #46): the slider is a knob of the distribution and not a fact about the
 * evening, *and* it enters the violated condition.
 *
 * The first half is the list below — `players`, `boosterRate` and
 * `displaySize` are absent from it, because a way out may never ask the
 * CommunityLead to lie about his tournament.
 *
 * The second half is **not a filter and not a case distinction**: it falls out
 * of the search itself. A slider that does not enter the violated condition
 * cannot change it, so none of its values clears, so it contributes nothing.
 * The floor conflict is the case that makes this visible — the conflict is
 * `rankBooster − displayReserved − (rankFloor · curveCount + lead) < 0`, which
 * the DistributionCurve does not appear in, so no curve step ever clears a
 * floor conflict and the curve stays out of that list on its own. Anything
 * shaped like `if (plan.conflict) skipCurve()` would pass the same test and be
 * the wrong construction.
 */

import { distribute, unfit } from './distribute.mjs';
import { CURVES } from './rules.mjs';

/** Reads a settings field as a whole number, the same way `distribute()` does. */
function int(value, fallback = 0) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/**
 * The distance between two DistributionCurve steps, **in steps of the
 * seven-entry list** and never in the ratio value: nearness is measured in the
 * unit the suggestion is accepted in, and what the CommunityLead accepts is a
 * step, not a ratio (#46). The two measures agree numerically as long as the
 * list is equidistant, which is why this is a named function rather than a
 * subtraction of ratios — the day a ratio moves, the measure must not.
 *
 * An unknown id is read as `steep`, the same fallback `curveRatio()` makes.
 */
export function curveStepDistance(from, to) {
  return Math.abs(curveIndex(to) - curveIndex(from));
}

function curveIndex(id) {
  const i = CURVES.findIndex((c) => c.id === id);
  return i >= 0 ? i : CURVES.findIndex((c) => c.id === 'steep');
}

/**
 * The ways out of an unfit plan, in the order of #46: first what takes back no
 * promise, then the promises in the precedence chain of ADR 0001, and last the
 * participation rate.
 *
 * Takes the **plan**, the signature #46, #61 and #68 have written all along.
 * It became buildable with ADR 0009: the plan carries its slider stands, so
 * the search has the `DistributionCurve` — the very first slider it goes
 * through — and the untrimmed `displays`, which `plan.displayVector` no longer
 * holds past the depth.
 *
 * One argument, and it is the plan rather than the Settings, so there is no
 * way to hand in a plan and a Settings that disagree, and any place holding a
 * plan can work out the ways out without carrying anything alongside.
 *
 * It reads `plan.settings` and never `plan.pinned`: a way out is a search over
 * values, and a pin is not a value — a pinned slider is searched like any
 * other, since a way out that may only touch untouched sliders would have no
 * way out to offer at the one stand where everything was set by hand.
 */
export function suggestions(plan) {
  if (!unfit(plan)) return [];
  const settings = plan.settings;

  const out = [];
  // 1 · what takes back no promise.
  out.push(...curveWaysOut(settings, plan));
  // 2–4 · the promises, in the precedence chain of ADR 0001.
  out.push(...numericWaysOut(settings, plan, 'rankFloor', plan.rankFloor, 0, 8, floorLabel));
  out.push(...numericWaysOut(settings, plan, 'depth', plan.depth, 1, plan.players, depthLabel));
  out.push(...displayWaysOut(settings, plan));
  // 5 · the participation rate, which sits in no chain and applies to everyone.
  out.push(
    ...numericWaysOut(
      settings,
      plan,
      'participationBooster',
      plan.participation.rate.booster,
      0,
      Math.max(0, int(settings.boosterRate)),
      participationLabel,
    ),
  );
  return out;
}

const direction = (value, current) => (value > current ? 'up' : 'down');
const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;

/**
 * The direction belongs in the text, not in the entry: the floor clears an
 * overtake by **rising**, while at a floor conflict it falls (#46).
 */
const floorLabel = (v, cur) => `Floor ${direction(v, cur)} to ${v}`;
const depthLabel = (v) => `Serve ${v} ${plural(v, 'rank')}`;
const participationLabel = (v, cur) => `Participation boosters ${direction(v, cur)} to ${v}`;

/** One slider over a whole-numbered range, its nearest clearing values. */
function numericWaysOut(settings, plan, key, current, low, high, label) {
  const candidates = [];
  for (let v = low; v <= high; v++) {
    if (v === current) continue;
    if (!clears(plan, { ...settings, [key]: v })) continue;
    candidates.push({
      at: v,
      distance: Math.abs(v - current),
      entry: { key, value: v, label: label(v, current) },
    });
  }
  return nearest(candidates);
}

/**
 * The DisplayReservation, one entry per Rank the search may touch: every Rank
 * that reserves something, plus both Ranks of an overtake — lifting the
 * overtaker to a tie no longer breaks Rank 1's lead and is often the shortest
 * way out — plus the orphaned Ranks, whose way out is to be dropped or to be
 * served by a deeper RankPoolDepth.
 *
 * `d₁ ≥ d₂ ≥ …` is the one rule no suggestion may break, so a candidate that
 * would let the vector rise is not proposed at all — not even where it would
 * clear the state.
 */
function displayWaysOut(settings, plan) {
  const current = reservationVector(settings);
  const touched = new Set();
  current.forEach((v, i) => {
    if (v > 0) touched.add(i);
  });
  if (plan.overtake) {
    touched.add(plan.overtake.under - 1);
    touched.add(plan.overtake.over - 1);
  }
  for (const rank of plan.orphanedReservation?.ranks ?? []) touched.add(rank - 1);

  const out = [];
  for (const i of [...touched].sort((a, b) => a - b)) {
    const now = current[i] ?? 0;
    const candidates = [];
    for (let v = 0; v <= 4; v++) {
      if (v === now) continue;
      const d = withReservation(current, i, v);
      if (!neverRising(d)) continue;
      if (!clears(plan, { ...settings, displays: d })) continue;
      candidates.push({
        at: v,
        distance: Math.abs(v - now),
        entry: {
          key: 'displays',
          rank: i + 1,
          value: v,
          label:
            v === 0
              ? `Drop rank ${i + 1}'s ${plural(now, 'display')}`
              : `Rank ${i + 1} ${direction(v, now)} to ${v} ${plural(v, 'display')}`,
        },
      });
    }
    out.push(...nearest(candidates));
  }
  return out;
}

/** The DisplayReservation vector as the core reads it, over its whole length. */
function reservationVector(settings) {
  const raw = Array.isArray(settings.displays) ? settings.displays : [];
  return raw.map((v) => Math.max(0, int(v)));
}

/** The vector with one Rank changed, padded with zeroes up to that Rank. */
function withReservation(current, index, value) {
  const d = current.slice();
  while (d.length <= index) d.push(0);
  d[index] = value;
  return d;
}

/** `d₁ ≥ d₂ ≥ …` — the reservation vector never rises over the Ranks. */
function neverRising(d) {
  for (let i = 1; i < d.length; i++) if (d[i] > d[i - 1]) return false;
  return true;
}

/**
 * The DistributionCurve, alone at the front: the only slider that takes back
 * no promise to the players. Nobody announces that the curve stands at
 * `steep`, while "the top eight get something", "everyone gets a Booster" and
 * "Rank 1 gets a Display" are announced things (CONTEXT.md, ConflictNotice).
 */
function curveWaysOut(settings, plan) {
  const current = CURVES[curveIndex(settings.curve)].id;
  const candidates = CURVES.filter((c) => c.id !== current)
    .filter((c) => clears(plan, { ...settings, curve: c.id }))
    .map((c) => ({
      at: curveIndex(c.id),
      distance: curveStepDistance(current, c.id),
      entry: { key: 'curve', value: c.id, label: `Curve to ${c.id}` },
    }));
  return nearest(candidates);
}

/**
 * The nearest candidates of one slider — **the set, not one value**. Two
 * equally distant values that both clear both stand there, the higher one
 * first, because taking away is the more drastic grip (#46, ADR 0002). The
 * order *between* sliders is untouched by this.
 *
 * The prototype kept only the first strictly nearer value and never showed the
 * tie; #46 records that as a correction to the prototype.
 */
function nearest(candidates) {
  if (candidates.length === 0) return [];
  const min = Math.min(...candidates.map((c) => c.distance));
  return candidates
    .filter((c) => c.distance === min)
    .sort((a, b) => b.at - a.at)
    .map((c) => c.entry);
}

/**
 * Does this candidate Settings clear the state? It must produce a fit plan —
 * and where the state is an overtake, it must additionally keep the overtaking
 * Rank in the plan. Without that, the search picks "Serve 1 rank", abolishes
 * the overtaker, and has solved nothing (#46).
 *
 * The probe is computed without pins. Nothing here reads `probe.pinned`, and
 * provenance changes no number in a plan — a probe answers "do these values
 * clear the state", which is the same question whether a value was set by hand
 * or inherited. A probe plan never leaves this function, so no SetupLink can be
 * written from one; what the accepted way out pins is the surface's decision to
 * record, not the search's to guess (#60, #61).
 */
function clears(plan, candidate) {
  const probe = distribute(candidate);
  if (unfit(probe)) return false;
  return !plan.overtake || probe.depth >= plan.overtake.over;
}

/**
 * The RankPool share behind a row's payout — never `row.booster` itself and
 * never a row sum. CombinedHandout shifts the participation rate into every
 * served row uniformly (`row.booster += pbRate` in `distribute()`), but a
 * DisplayReservation reserves only out of the RankPool; measuring on
 * `row.booster` would read the participation share as though the RankPool
 * had reserved it and over-propose (#46's correction to the prototype, which
 * measures `offerFor` on `row.booster`).
 *
 * Subtracting the same rate back out makes this identical whether or not
 * CombinedHandout is on: the shift adds `plan.participation.rate.booster` to
 * every row of both the plan and any candidate probe alike, so it cancels
 * both in the offered value and in the `also` differences — which is what
 * makes "no proposal changes under CombinedHandout" (#60) hold by
 * construction rather than by coincidence.
 */
function rankShare(plan, row) {
  const pbRate = plan.combinedHandout ? plan.participation.rate.booster : 0;
  return row.booster - pbRate;
}

/**
 * offerFor(plan) — the Offer of #46: on a **fully valid** plan, a rounder
 * DisplayReservation, today the only kind there is. ConflictNotice and Offer
 * can never meet: one presumes an invalid plan, the other a valid one — so an
 * `unfit` plan always answers `null` here, never a proposal.
 *
 * The window is symmetric, `win = max(1, round(displaySize / 4))`, in both
 * directions: rounding only upward would take `displaySize − 1` Boosters from
 * the top Rank in the extreme case. For each served Rank from the top,
 * `k = round(share / displaySize)` — skipped where `k < 1`, `k ≤
 * row.displays`, the distance from `k · displaySize` exceeds the window, the
 * DisplayReservation vector would no longer fall (`d₁ ≥ d₂ ≥ …`, the one rule
 * no proposal may break either — same grip as `suggestions()`), or the probe
 * run would itself be unfit.
 *
 * Its promise is local, its effect is not: a DisplayReservation settles Ranks
 * downward, so an accepted Offer can take more from another Rank than the
 * window would ever have allowed on its own. It is not narrowed for that —
 * it names the moved Ranks with their before and after numbers instead, so a
 * proposal nobody has to accept is allowed to be expensive as long as it
 * states its price.
 *
 * There is **one** Offer, not a list of ways out: the first Rank (from the
 * top) that clears every condition above is returned, or `null` if none does.
 * The key carries the offer's content, not its kind, so a changed proposal is
 * recognisable as a different one.
 */
export function offerFor(plan) {
  if (unfit(plan)) return null;

  const settings = plan.settings;
  const displaySize = Math.max(1, int(settings.displaySize, 1));
  const win = Math.max(1, Math.round(displaySize / 4));
  const current = reservationVector(settings);

  for (let i = 0; i < plan.depth; i++) {
    const row = plan.rows[i];
    const share = rankShare(plan, row);
    const k = Math.round(share / displaySize);
    if (k < 1) continue;
    if (k <= row.displays) continue;
    if (Math.abs(share - k * displaySize) > win) continue;

    const d = withReservation(current, i, k);
    if (!neverRising(d)) continue;

    const probe = distribute({ ...settings, displays: d });
    if (unfit(probe)) continue;

    const also = [];
    for (let j = 0; j < plan.depth; j++) {
      if (j === i) continue;
      const before = rankShare(plan, plan.rows[j]);
      const after = rankShare(probe, probe.rows[j]);
      if (before !== after) also.push({ rank: j + 1, before, after });
    }

    return { rank: i + 1, value: k, from: share, to: k * displaySize, also, key: `${i + 1}:${k}:${share}` };
  }
  return null;
}

/**
 * waysOut(plan) — what the ConflictNotice offers, in the ranking of the
 * addendum "Wenn kein einzelner Regler räumt" to ADR 0002 (#68, decision K1):
 * where a single slider clears, the single ways stand **alone**; only where
 * none does is the one way over several sliders at once offered instead. It
 * is the case in which there would otherwise be nothing, which is why its
 * poorer legibility weighs less there than an empty surface.
 *
 * An empty list is left for exactly one case: no slider the search may move
 * clears the stand, alone or together — see `combinedWayOut()`.
 */
export function waysOut(plan) {
  const single = suggestions(plan);
  if (single.length) return single;
  const combined = combinedWayOut(plan);
  return combined ? [combined] : [];
}

/**
 * combinedWayOut(plan) — one computed way out over several sliders at once,
 * or `null` (#68; ADR 0002, addendum "Wenn kein einzelner Regler räumt").
 *
 * It is **computed, not searched**, in two passes, and it moves only the
 * sliders `suggestions()` may move — never `players`, `boosterRate` or
 * `displaySize`, a way out never asks the CommunityLead to lie about his
 * tournament (CONTEXT.md, `ConflictNotice`):
 *
 * 1. **To the edge that clears.** No reservation, a RankFloor of 0, no
 *    participation Booster. There the RankPool needs exactly one Booster —
 *    the Rank 1 lead — and has its most; nothing is orphaned, nothing
 *    settles the whole depth, and a curve over equal floors cannot overtake.
 *    So this stand clears **if any stand of the searched sliders does**: a
 *    fit plan always needs at least one Booster (the lead where nothing is
 *    settled, a whole Display where something is), and no searched value
 *    gives the RankPool more than this one. If even it stays unfit, there is
 *    no way out short of a fact, and the answer is `null`.
 * 2. **Back as far as the stand allows.** Each slider moved in pass 1 is
 *    brought back, one after the other, to the value nearest to where it
 *    stood that still clears — in the reverse of the order the ways out are
 *    listed in, so the slider the list takes last is the one kept most:
 *    the participation rate first, then the DisplayReservation, then the
 *    RankFloor.
 *
 * The DisplayReservation comes back **whole and is taken from the bottom**:
 * starting from the vector as it stood, one Display at a time comes off the
 * lowest Rank that still holds one, until the stand clears. The lowest first,
 * for the reason #61 gives for the WinnerPack overhang — a promise to Rank 1
 * is the louder one. Taking from the bottom keeps `d₁ ≥ d₂ ≥ …` by itself;
 * bringing Ranks back one by one from the top would not even be sound, since
 * a prefix like `(1)` can overtake where the whole `(1,1)` does not.
 *
 * `RankPoolDepth` and the `DistributionCurve` are not moved: at the edge of
 * pass 1 neither is needed, and a depth that stays keeps an overtaking Rank in
 * the plan, which is the extra condition `clears()` puts on an overtake.
 *
 * What comes out is the list of what differs from the stand, in the order the
 * single ways would list them, each entry in the single way's own shape and
 * words — and their labels joined into the one the button carries.
 */
export function combinedWayOut(plan) {
  if (!unfit(plan)) return null;
  const settings = plan.settings;
  const current = reservationVector(settings);
  const rate = plan.participation.rate.booster;

  const edge = { ...settings, displays: [], rankFloor: 0, participationBooster: 0 };
  if (!clears(plan, edge)) return null;

  const stand = { ...edge };
  stand.participationBooster = backToward(plan, stand, 'participationBooster', rate, 0);

  const kept = current.slice();
  while (kept.some((v) => v > 0) && !clears(plan, { ...stand, displays: kept })) {
    let last = kept.length - 1;
    while (kept[last] === 0) last--;
    kept[last] -= 1;
  }
  stand.displays = kept;
  stand.rankFloor = backToward(plan, stand, 'rankFloor', plan.rankFloor, 0);

  const changes = [];
  if (stand.rankFloor !== plan.rankFloor) {
    changes.push({ key: 'rankFloor', value: stand.rankFloor, label: floorLabel(stand.rankFloor, plan.rankFloor) });
  }
  current.forEach((now, i) => {
    const v = kept[i];
    if (v === now) return;
    changes.push({
      key: 'displays',
      rank: i + 1,
      value: v,
      label:
        v === 0
          ? `Drop rank ${i + 1}'s ${plural(now, 'display')}`
          : `Rank ${i + 1} ${direction(v, now)} to ${v} ${plural(v, 'display')}`,
    });
  });
  if (stand.participationBooster !== rate) {
    changes.push({
      key: 'participationBooster',
      value: stand.participationBooster,
      label: participationLabel(stand.participationBooster, rate),
    });
  }

  const label = changes
    .map((change, i) => (i === 0 ? change.label : change.label[0].toLowerCase() + change.label.slice(1)))
    .join(' and ');
  return { key: 'combined', changes, label };
}

/** The value of one slider nearest to `from` on the way to `to` at which the
 *  stand still clears — `to` itself, which pass 1 has shown to clear, at worst. */
function backToward(plan, stand, key, from, to) {
  const step = from > to ? -1 : 1;
  for (let v = from; v !== to; v += step) {
    if (clears(plan, { ...stand, [key]: v })) return v;
  }
  return to;
}
