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
