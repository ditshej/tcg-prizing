/**
 * The diagram bar's three raw segments — DisplayReservation, RankFloor,
 * ShapedRemainder, bottom to top (#62 AC 7) — derived from a single Rank
 * row. Pure arithmetic: on the tested side of the seam ADR 0004's Nachtrag
 * draws between the shell's proven derivations and its unproven measuring
 * rind (`measure.mjs`). `plan.mjs`'s Alpine component calls this and then
 * scales the result against `maxBooster` for the bar height; that scaling is
 * trivial display arithmetic and stays there.
 *
 * `row.reserved` is the core's own field name (spec #46, `## Output:
 * DistributionPlan`, `rows[].reserved` — "Display-Zahl und die Booster
 * daraus"). No `?? 0` fallback: the core hands one for every Rank row, so a
 * missing value here is a bug worth seeing, not a gap worth papering over.
 * An earlier cut of this shell read `row.reservation`, a field that never
 * existed anywhere — the silent `?? 0` is exactly what let that go unnoticed.
 *
 * `row.settled` still falls back to `false`: on `main`, `rows[]` does not
 * carry it yet (it lands with PR #78 / #55, open as of this writing), so a
 * plan built against today's core must still treat an absent `settled` as
 * "not settled" rather than throw.
 */
export function rankSegments(row) {
  const reservation = row.reserved;
  const settled = row.settled ?? false;
  const floor = settled ? 0 : row.floor;
  const shaped = Math.max(0, row.booster - row.floor - reservation);
  return { reservation, floor, shaped };
}
