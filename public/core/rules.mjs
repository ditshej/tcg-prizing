/**
 * The named rules of the core: the DistributionCurve steps, the RaffleRange
 * steps, and the integer split by largest remainder.
 *
 * Data and arithmetic only — no DOM, no state, no clock, no randomness.
 */

/**
 * The seven steps of the DistributionCurve, with the share a Rank gets of what
 * the Rank above it gets. The names are labels over the ratios; the number is
 * what counts. There is no flat step.
 */
export const CURVES = [
  { id: 'gentle', ratio: 0.85 },
  { id: 'mild', ratio: 0.75 },
  { id: 'moderate', ratio: 0.65 },
  { id: 'firm', ratio: 0.55 },
  { id: 'steep', ratio: 0.45 },
  { id: 'severe', ratio: 0.35 },
  { id: 'extreme', ratio: 0.25 },
];

/**
 * The thirteen steps of the RaffleRange. An upper step spans `ceil(n * frac)`
 * ranks, a lower one is its complement, and an absolute step is capped at the
 * player count. The measure is always the player count, never the
 * RankPoolDepth.
 */
export const RANGES = [
  { id: 'top8', abs: 8 },
  { id: 'top16', abs: 16 },
  { id: 'topQuarter', frac: 1 / 4 },
  { id: 'topThird', frac: 1 / 3 },
  { id: 'topHalf', frac: 1 / 2 },
  { id: 'topTwoThirds', frac: 2 / 3 },
  { id: 'topThreeQuarters', frac: 3 / 4 },
  { id: 'all', frac: 1 },
  { id: 'bottomThreeQuarters', comp: 'topQuarter' },
  { id: 'bottomTwoThirds', comp: 'topThird' },
  { id: 'bottomHalf', comp: 'topHalf' },
  { id: 'bottomThird', comp: 'topTwoThirds' },
  { id: 'bottomQuarter', comp: 'topThreeQuarters' },
];

/**
 * The upper eight steps. The RankPoolDepth draws its starting value from this
 * list: it is a prefix from Rank 1, so the lower steps are unusable there.
 */
export const DEPTH_STEPS = RANGES.filter((r) => !r.comp).map((r) => r.id);

const RANGE_BY_ID = new Map(RANGES.map((r) => [r.id, r]));
const CURVE_BY_ID = new Map(CURVES.map((c) => [c.id, c]));

/** The ratio of a named curve step; an unknown id falls back to `steep`. */
export function curveRatio(id) {
  return (CURVE_BY_ID.get(id) ?? CURVE_BY_ID.get('steep')).ratio;
}

/** How many ranks a named range step spans at a given player count. */
export function rangeSize(id, players) {
  const n = Math.max(0, Math.trunc(players));
  const step = RANGE_BY_ID.get(id);
  if (!step) return n;
  if (step.abs !== undefined) return Math.min(step.abs, n);
  if (step.frac !== undefined) return Math.min(n, Math.ceil(n * step.frac));
  return n - rangeSize(step.comp, n);
}

/**
 * Splits `total` over `weights` in whole units: cut the nominal shares, hand
 * out the rest by largest remainder, and **on an equal remainder the higher
 * Rank gets it** — the smaller index first (ADR 0001, addendum #45).
 *
 * The comparison runs on exact integers. The tie is not a rounding accident
 * but built into the geometric weights, and in floating point the three equal
 * remainders of the `extreme` case come out unequal in the last bits, which
 * would break the tie the wrong way.
 */
export function largestRemainder(weights, total) {
  const out = new Array(weights.length).fill(0);
  const wanted = Math.trunc(total);
  if (weights.length === 0 || wanted <= 0) return out;

  const numerators = asCommonDenominator(weights);
  const sum = numerators.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return out;

  const target = BigInt(wanted);
  const remainders = new Array(weights.length);
  let handedOut = 0n;
  for (let i = 0; i < weights.length; i++) {
    const claim = target * numerators[i];
    const whole = claim / sum;
    out[i] = Number(whole);
    handedOut += whole;
    remainders[i] = claim - whole * sum;
  }

  const order = [...out.keys()].sort(
    (a, b) => compareBigInt(remainders[b], remainders[a]) || a - b,
  );
  const left = Number(target - handedOut);
  for (let k = 0; k < left; k++) out[order[k]]++;

  return out;
}

/** Scales a list of non-negative doubles to exact BigInt numerators. */
function asCommonDenominator(weights) {
  const parts = weights.map((w) => (w > 0 && Number.isFinite(w) ? asDyadic(w) : { m: 0n, e: 0 }));
  const shift = parts.reduce((a, p) => Math.max(a, p.e), 0);
  return parts.map((p) => p.m << BigInt(shift - p.e));
}

/** Decomposes a positive double into `m * 2**-e` with an integral `m`. */
function asDyadic(x) {
  let value = x;
  let e = 0;
  while (!Number.isInteger(value)) {
    value *= 2;
    e++;
  }
  return { m: BigInt(value), e };
}

function compareBigInt(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}
