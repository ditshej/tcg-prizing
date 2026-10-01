/**
 * The v1 key register: the wire format's single source of truth for what a
 * SetupLink key means. `encode()`, `decode()` and `migrate()` (their own
 * tickets) read this table instead of each carrying their own idea of the key
 * list — a second copy is exactly the kind of drift the versioning in ADR 0007
 * is written against (docs/agents/setup-link.md).
 *
 * It has a file of its own because it is not a direction: reading, writing and
 * migrating use it alike, and a register that lives in the file named after
 * *writing* is looked for at the wrong end (#47, `## File layout`; decided at
 * #49, "Entscheid K3"). The directions stay one file each — `decode.mjs` and
 * `encode.mjs` — and their pair character is nailed down by #50's
 * `decode(encode(x))`, which is a statement about the test, not the file.
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
 * The nineteen slider keys — the `Settings` field names from #46, 1:1 and
 * without short codes, in the order `encode()` writes them. **Every pin
 * travels** (run 12, K1 on #72; ADR 0005, addendum run 12): the link carries
 * everything set by hand.
 *
 * - `depthStep` sits right after `depth`. It is the step grid inside `Served
 *   ranks`, and since #67 a step chip pins it. An unpinned step is
 *   reproducible from the base, a pinned one is not: before run 12 the key
 *   was missing and `Weekly`, 48 players, `top quarter` sent 12 ranks and
 *   showed the receiver 8. Two pins over depth do not disagree — the receiver
 *   resolves them with the same core as the sender, a pinned `depth` first.
 *   Its value is a step name out of `DEPTH_STEPS`, read like `curve`.
 * - The `RaffleRange` is not here: it is no `Settings` field and no slider.
 *   It travels all the same, as a key of `CHOICE_KEYS` below.
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
  { key: 'depthStep', type: 'stepId', absent: 'leaf' },
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

/**
 * What is set by hand without being a slider — the keys that travel beside
 * `KEYS` and are written after them. The one so far is the `RaffleRange`
 * (run 12, K1b on #72): "Auch die RaffleRange reist im Link mit." It stays
 * **no `Regler`** — no `Settings` field, no input to `distribute()`, no pin,
 * no reset, not in `Drop all N`, untouched by a Set switch — so it is not
 * mixed into the slider list, where every reader would take it for one.
 *
 * `term` is what a missing key means: the term's own constant, never a
 * `DefaultSet` leaf. The key is written only when the value differs from it —
 * "only deviations" — so every v1 link without the key reads as it always
 * did, and adding it needed no version bump (docs/agents/setup-link.md). Its
 * value is a range id out of `RANGES`.
 */
export const CHOICE_KEYS = [{ key: 'raffleRange', type: 'rangeId', term: 'all' }];
