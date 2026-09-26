/**
 * The Alpine component behind the Plan screen (#62): reads a DistributionPlan
 * off `distribute()` and shows it, plus the four hot sliders that change the
 * Settings it was built from. It never reaches past the seam into the
 * calculation itself (ADR 0004) and never tracks where a value came from.
 *
 * `startingSettings()` is a stand-in for `resolveSettings()` — see the
 * warning on that function below. Everything else here is read-only display
 * logic over `plan`, kept inside the shell's unproven half on purpose: #61's
 * Testing Decisions carve out only the tile-window geometry and the
 * diagram's cap (`geometry.mjs`) as pure derivations for this ticket: the
 * rest of what a Rank's tile or bar shows is judged at the picture, same as
 * the rest of Spec 2's surface.
 */

import { distribute } from '../core/distribute.mjs';
import { CURVES } from '../core/rules.mjs';
import { GAME, TOURNAMENT_TYPES } from '../sets/onepiece.mjs';
import { attachMeasuring } from './measure.mjs';
import { rankSegments } from './diagram.mjs';

/**
 * The starting Settings: the Game's complete sheet, overridden by the first
 * TournamentType's deviations (ADR 0003 — the first entry carries only its
 * title, so this degenerates to the Game's own values), plus the neutral
 * start every DefaultSet owes the Rank-naming fields.
 *
 * **Not `resolveSettings()`.** #62's own ticket body says that function
 * "entsteht in #49 und liegt bei core/" — but #49 is not among #62's
 * blockers and had not landed on `main` when this was built (checked via
 * `git log`, 2026-09-26). Writing it here would duplicate a function this
 * ticket does not own the home of; reaching into `public/core/` to add it
 * was out of bounds for this ticket regardless. So this stays a small, local,
 * clearly-labelled merge, scoped to bootstrapping this one screen, and not a
 * second copy of a two-level DefaultSet merge meant to live in the core —
 * this repo's own rule against exactly that kind of drift is the reason it
 * is called out this plainly. See the PR description for the finding.
 */
function startingSettings() {
  const [firstType] = TOURNAMENT_TYPES;
  const { id, title, ...overrides } = firstType ?? {};
  return {
    ...GAME,
    ...overrides,
    tournamentPacks: null,
    depth: null,
    ranked: null,
    winnerPacks: null,
    manualWinner: {},
    displays: [],
  };
}

/** Builds the `ranks N–M get nothing` sentence, or `null` if none are left out. */
function restMessage(lastServedRank, players) {
  const from = lastServedRank + 1;
  if (from > players) return null;
  return from === players ? `rank ${from} gets nothing` : `ranks ${from}–${players} get nothing`;
}

export function planApp() {
  return {
    settings: startingSettings(),
    curveSteps: CURVES,

    get plan() {
      return distribute(this.settings);
    },

    /** The last Rank that gets anything at all — booster, packs or winners. */
    get lastServedRank() {
      let last = 0;
      this.plan.rows.forEach((row, i) => {
        if (row.booster > 0 || row.packs > 0 || row.winners > 0) last = i + 1;
      });
      return last;
    },

    /** The tile grid's population: gapless up to the last Rank served. */
    get tiles() {
      return this.plan.rows.slice(0, this.lastServedRank);
    },

    get restMessage() {
      return restMessage(this.lastServedRank, this.plan.players);
    },

    /** The chosen TournamentType's title for the Plan head — #63 adds picking one. */
    get typeTitle() {
      return TOURNAMENT_TYPES[0]?.title ?? '';
    },

    get rankTotalLabel() {
      return this.plan.combinedHandout ? 'on the tiles' : 'to the ranks';
    },

    get rankTotalBooster() {
      return this.plan.rows.reduce((sum, row) => sum + row.booster, 0);
    },

    /** The largest bar value, for scaling every bar against the same axis. */
    get maxBooster() {
      return Math.max(1, ...this.plan.rows.map((row) => row.booster));
    },

    /**
     * The diagram's three segments as a percentage of `maxBooster`, bottom to
     * top: Reservation, floor, shaped rest (#62 AC 7). The raw arithmetic —
     * which field to read, the settled branch, the shaping itself — lives in
     * `rankSegments()` (`diagram.mjs`), on the tested side of the seam; this
     * method only scales that result for the bar height.
     */
    segments(row) {
      const raw = rankSegments(row);
      const scale = (value) => (value / this.maxBooster) * 100;
      return { reservation: scale(raw.reservation), floor: scale(raw.floor), shaped: scale(raw.shaped) };
    },

    /**
     * The four hot sliders. Each writes straight into `settings`, which the
     * `plan` getter reads on its next access — no explicit recompute step,
     * no server round-trip (#62 AC 1). `players` and `rankFloor` are plain
     * leaves; `curve` picks a named step; `depth` is the one of the four with
     * an auto/pinned branch (ADR 0006) — touching the slider always pins it,
     * because the pin is set by the handling, never by the value.
     */
    setPlayers(value) {
      this.settings.players = Math.max(2, Math.min(128, Number(value)));
    },
    setRankFloor(value) {
      this.settings.rankFloor = Math.max(0, Number(value));
    },
    setDepth(value) {
      this.settings.depth = Math.max(1, Math.min(this.plan.players, Number(value)));
    },

    init() {
      const fixed = [
        this.$refs.head,
        this.$refs.handout,
        this.$refs.legend,
        this.$refs.ranktotal,
        this.$refs.rest,
      ].filter(Boolean);
      this._detachMeasuring = attachMeasuring(this.$refs.stage, fixed);
    },

    destroy() {
      if (this._detachMeasuring) this._detachMeasuring();
    },
  };
}
