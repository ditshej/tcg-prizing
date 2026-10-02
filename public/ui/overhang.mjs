/**
 * The `WinnerPack` overhang (#70): more WinnerPacks on the tiles than the
 * RankPool holds. It is one of the named sources of a `ConflictNotice`
 * (CONTEXT.md, `ConflictNotice`) — and the one the core does not report
 * itself, so it is derived here, on the shell's proven side of the seam, out
 * of the plan the core returned.
 *
 *     overhang = allocation.ranked + allocation.manualCount − rank.winners
 *
 * The core clamps `open` at 0 and checks nothing about this sum: the cap was
 * handed to the surface (#46). The tile caps the *setting* — its plus needs a
 * WinnerPack `open` (`manualWinnerAfter()` in `controls.mjs`) — but a cap does
 * not hold the state, because the overhang arises when a second value sinks
 * afterwards: a Set switch to a type with fewer WinnerPacks, a SetupLink with
 * another player count, a lowered `winnerPacks`, a raised `judgeWinner`. And
 * since the core clamps `ranked` to `min(rankWinners, players)` while letting
 * `manualCount` through, the overhang can only ever be carried by the
 * `manual` share: it is never larger than `manualCount`.
 *
 * Nothing is clamped (ADR 0006). The stored `manualWinner` stays as it was,
 * and the moment the stock suffices again the notice is gone and the counts
 * are where the CommunityLead left them.
 *
 * **Why this is not a fifth field of the plan, and not part of `unfit()`.**
 * `unfit()` is the core's predicate and the test every probe of
 * `suggestions()` must pass. Folded in, a standing overhang would make every
 * probe of a floor conflict fail — no curve, floor or depth touches a
 * WinnerPack — and the core's ways out would vanish exactly when two sources
 * hold at once. The overhang and the four core sources run on disjoint
 * sliders, so each keeps its own predicate and its own ways, and the
 * NoticeStack asks both (`notices.mjs`). The cross-check of #70's first
 * comment (B2) found the formula equal to "rows above `rank.winners`" stand
 * for stand, so no field is needed either.
 */

import { distribute } from '../core/distribute.mjs';
import { pinLabel } from './controls.mjs';

/** The name the source carries in code, the kind key and the ways out —
 *  CONTEXT.md, `ConflictNotice`: "`WinnerPack` overhang". */
export const WINNER_PACK_OVERHANG = 'winnerPackOverhang';

/**
 * The overhang of a plan, or `null` where the RankPool's WinnerPacks suffice.
 *
 * - `by` — how many WinnerPacks are placed beyond the stock.
 * - `placed`, `have` — `ranked + manualCount` and `rank.winners`.
 * - `takeBack` — the hand-placed packs that would have to go, taken from the
 *   **lowest** Ranks first, as many as needed: `{ rank, holds, take }`, from
 *   the bottom up. The lowest, because a WinnerPack for Rank 1 is the louder
 *   promise (#61).
 * - `ranks` — **every** Rank holding a hand-placed (`manual`) WinnerPack,
 *   ascending, not only those of `takeBack`. These are the tiles the grid
 *   marks (K-B2, Lauf 13 on #70): once the notice is minimised, the red tiles
 *   alone say where the problem lies, and its cause is every hand placement,
 *   not just the one that happens to sit lowest. A Rank carrying its pack only
 *   through `ranked` stays unmarked.
 */
export function winnerPackOverhang(plan) {
  const { ranked, manualCount, manual } = plan.allocation;
  const have = plan.rank.winners;
  const by = ranked + manualCount - have;
  if (by <= 0) return null;

  const takeBack = [];
  let left = by;
  const fromBottom = Object.keys(manual)
    .map(Number)
    .sort((a, b) => b - a);
  for (const rank of fromBottom) {
    if (left === 0) break;
    const holds = manual[rank];
    const take = Math.min(holds, left);
    takeBack.push({ rank, holds, take });
    left -= take;
  }

  const ranks = Object.keys(manual)
    .map(Number)
    .filter((rank) => manual[rank] > 0)
    .sort((a, b) => a - b);

  return { by, placed: ranked + manualCount, have, takeBack, ranks };
}

const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;

/** `a`, `a and b`, `a, b and c`. */
function joined(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Does the plan computed from these Settings stand without an overhang? */
function clears(settings) {
  return winnerPackOverhang(distribute(settings)) === null;
}

/**
 * The ways out of the overhang, or `[]` where there is none. Way 1 is
 * **searched** — the nearest `judgeWinner` that clears, as ADR 0002 (Nachtrag)
 * asks of every `WayOut`; ways 2 and 3 are **computed**, because they leave
 * `rank.winners` alone and so clear exactly (B1, Lauf 13 on #70). They stand
 * in the order *Zusage gegen Formgebung* — first what takes back no promise to
 * a player:
 *
 * 1. **`judgeWinner` down.** Takes back no promise to the players: the
 *    WinnerPacks go back to the RankPool. Lowered from what the JudgePool
 *    *took* (`judge.winners`), not from the stored value, which may stand
 *    above the stock.
 *
 *    "By the overhang" is not enough while `ranked` follows its staffel: every
 *    WinnerPack the judge gives back raises `rank.winners` by one and
 *    `⌊n/2⌋ + 1` with it at every second step, so the overhang falls by less
 *    than the judge gives. The value is therefore searched from the
 *    overhang towards 0 — `judge.winners − by` first, then one lower at a
 *    time — and the first that clears is the way. Where `ranked` is pinned,
 *    that first value is the one. Where none down to 0 clears, the way does
 *    not appear.
 * 2. **`ranked` down by the overhang.** Takes back the promise "the top k".
 *    `manual` does not enter the staffel, so this one is exact. It does not
 *    appear where `ranked` is smaller than the overhang.
 * 3. **The take-back** of the hand-placed packs on the **lowest** Ranks, as
 *    many as needed — the entry names every Rank it touches. Always there:
 *    the overhang never exceeds `manualCount`. It is the same handling as the
 *    WinnerRaffle's take-back (#69): one only takes back by naming the Rank.
 *
 * **`winnerPacks` up never appears.** The number of WinnerPacks on hand is a
 * fact about the evening and no knob; a way out never asks the CommunityLead
 * to lie about his tournament (#42, #70).
 *
 * Each way is a `WayOut` in the shape `applyWayOut()` takes: a single slider
 * as `{ key, value, label }`, the take-back as `{ key: 'manualWinner',
 * changes, label }` with one `{ key, rank, value }` per Rank, ascending.
 * Every way carries `source`, the name of the source it clears, so the
 * NoticeStack can tell them from the core's ways in the same notice.
 */
export function overhangWaysOut(plan) {
  const overhang = winnerPackOverhang(plan);
  if (!overhang) return [];
  const settings = plan.settings;
  const source = WINNER_PACK_OVERHANG;
  const ways = [];

  const judge = plan.judge.winners;
  for (let v = judge - overhang.by; v >= 0; v--) {
    if (clears({ ...settings, judgeWinner: v })) {
      ways.push({ source, key: 'judgeWinner', value: v, label: `${pinLabel('judgeWinner')} down to ${v}` });
      break;
    }
  }

  const ranked = plan.allocation.ranked - overhang.by;
  if (ranked >= 0 && clears({ ...settings, ranked })) {
    ways.push({ source, key: 'ranked', value: ranked, label: `${pinLabel('ranked')} down to ${ranked}` });
  }

  const back = overhang.takeBack.slice().sort((a, b) => a.rank - b.rank);
  ways.push({
    source,
    key: 'manualWinner',
    changes: back.map(({ rank, holds, take }) => ({ key: 'manualWinner', rank, value: holds - take })),
    label: `Drop ${joined(
      back.map(({ rank, holds, take }) =>
        take === holds
          ? `rank ${rank}'s ${plural(holds, 'winner pack')}`
          : `${take} of rank ${rank}'s ${holds} ${plural(holds, 'winner pack')}`,
      ),
    )}`,
  });

  return ways;
}
