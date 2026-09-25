/**
 * The v1 key register: the wire format's single source of truth for what a
 * SetupLink key means. `encode()`, `decode()` and `migrate()` (their own
 * tickets) read this table instead of each carrying their own idea of the key
 * list — a second copy is exactly the kind of drift the versioning in ADR 0007
 * is written against (docs/agents/setup-link.md).
 */

export const CURRENT_VERSION = 1;

/**
 * The base a SetupLink names in every link, pinned sliders or none: the
 * format version, then Game and TournamentType as stable names, never a list
 * position. An absent slider keeps computing, but an absent type would be
 * *picked* — "first of the list" is a silent decision (ADR 0007, addendum
 * #44) — so the base is not covered by "only deviations" and is always
 * written.
 */
export const BASE_KEYS = [
  { key: 'v', type: 'version' },
  { key: 'game', type: 'id' },
  { key: 'type', type: 'id' },
];

/**
 * The eighteen slider keys — the `Settings` field names from #46, 1:1 and
 * without short codes, in the order `encode()` writes them. Two things do
 * *not* live here, and neither is an oversight:
 *
 * - `depthStep` is not a slider, it is a DefaultSet entry: "the slider itself
 *   stays absolute, the step only supplies the starting value" (CONTEXT.md,
 *   RankPoolDepth). Were it in the link, two keys would talk about depth and
 *   could disagree — ADR 0005 rejected exactly that shape. The link already
 *   names its TournamentType, so the step is reproducible from the base.
 * - `RaffleRange` never reaches `distribute()` — it only bounds a raffle
 *   draw's input, and what the draw produces already lands in the link via
 *   `manualWinner`. Cost, named: whoever set a range and then shared the link
 *   loses that one choice; it is one slider drag to set again.
 *
 * `absent` says what a missing key means — the half of the format that a key
 * list alone does not capture:
 *
 * - `'null'`  — the four trailing sliders: the core computes it (ADR 0006).
 * - `'empty'` — the two that start neutral, `[]` or `{}`: a DefaultSet never
 *   prefills anything that names a Rank (ADR 0003).
 * - `'leaf'`  — every other slider: the DefaultSet leaf value.
 *
 * `shape` is set only on the two composite values, one bit of the URL for one
 * slider (ADR 0003): the string layout `encode()`/`decode()` must agree on.
 */
export const KEYS = [
  { key: 'players', type: 'int', absent: 'leaf' },
  { key: 'boosterRate', type: 'int', absent: 'leaf' },
  { key: 'tournamentPacks', type: 'int', absent: 'null' },
  { key: 'envelopeSize', type: 'int', absent: 'leaf' },
  { key: 'envelopeYield', type: 'int', absent: 'leaf' },
  { key: 'displaySize', type: 'int', absent: 'leaf' },
  { key: 'participationBooster', type: 'int', absent: 'leaf' },
  { key: 'participationPack', type: 'int', absent: 'leaf' },
  { key: 'judgeBooster', type: 'int', absent: 'leaf' },
  { key: 'judgeWinner', type: 'int', absent: 'leaf' },
  { key: 'rankFloor', type: 'int', absent: 'leaf' },
  { key: 'depth', type: 'int', absent: 'null' },
  { key: 'curve', type: 'curveId', absent: 'leaf' },
  { key: 'ranked', type: 'int', absent: 'null' },
  { key: 'winnerPacks', type: 'int', absent: 'null' },
  {
    key: 'manualWinner',
    type: 'rankCountMap',
    absent: 'empty',
    shape: 'rank:count pairs, comma-separated, ascending by rank — e.g. 3:1,7:2',
  },
  {
    key: 'displays',
    type: 'vector',
    absent: 'empty',
    shape: 'dot-separated ints, index 0 = Rank 1, trailing zeros dropped — e.g. 2.1.1',
  },
  { key: 'combinedHandout', type: 'bit', absent: 'leaf' },
];
