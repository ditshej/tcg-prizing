/**
 * The Alpine component behind the Plan screen (#62): reads a DistributionPlan
 * off `distribute()` and shows it, plus the four hot sliders that change the
 * Settings it was built from. It never reaches past the seam into the
 * calculation itself (ADR 0004) and never tracks where a value came from.
 *
 * The starting Settings come from `resolveSettings()` in `core/` (#49), which
 * replaced the local stand-in this file carried in the meantime. Everything
 * else here is read-only display logic over `plan`, kept inside the shell's
 * unproven half on purpose: #61's
 * Testing Decisions carve out only the tile-window geometry and the
 * diagram's cap (`geometry.mjs`) as pure derivations for this ticket: the
 * rest of what a Rank's tile or bar shows is judged at the picture, same as
 * the rest of Spec 2's surface.
 *
 * #64 adds the Details sheet's half: the chosen Set as two names, the pins as
 * a stored third level over it, and one handler for every control. The
 * numbers a control is drawn from — its two ends, what it shows while it is
 * `auto` — come from `controls.mjs`, which is on the proven side of the seam
 * so that a cap has exactly one home and slider and counter cannot disagree.
 */

import { resolveSettings } from '../core/defaults.mjs';
import { distribute } from '../core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../core/rules.mjs';
import { GAME, GAME_TITLE, TOURNAMENT_TYPES } from '../sets/onepiece.mjs';
import { applyGeometry, attachMeasuring } from './measure.mjs';
import { rankSegments } from './diagram.mjs';
import { DEPTH_STEP_LABELS, clampToBounds, effectiveValue, reachFor } from './controls.mjs';

/** Builds the `ranks N–M get nothing` sentence, or `null` if none are left out. */
function restMessage(lastServedRank, players) {
  const from = lastServedRank + 1;
  if (from > players) return null;
  return from === players ? `rank ${from} gets nothing` : `ranks ${from}–${players} get nothing`;
}

export function planApp() {
  return {
    /**
     * The chosen Set, as the two names the chain is built from (ADR 0003):
     * the Game and the TournamentType, never a list position — the same two
     * a SetupLink carries as its base (`link/keys.mjs`, `BASE_KEYS`).
     */
    gameId: GAME.id,
    typeId: TOURNAMENT_TYPES[0].id,

    /**
     * The catalogue, and it **falls out of the sheets**: Games in list order,
     * each `{ id, types: [{ id }] }`, types in list order — the form the read
     * path judges a link's base against (`link/decode.mjs`, `catchBase`), with
     * the screen titles riding along for the two chip rows here. The order is
     * meaningful and is never a surface sort (ADR 0003).
     *
     * One list, not two: when #89 hands the catalogue to `decode()`, the list
     * the buttons are drawn from and the list a link is judged against have to
     * be the same object, or a Game the screen offers could be one the link
     * layer replaces without a word.
     */
    games: [{ id: GAME.id, title: GAME_TITLE, types: TOURNAMENT_TYPES }],

    /**
     * What the CommunityLead set by hand — the third level over Game and
     * TournamentType, and the record that makes a Set switch keep his work
     * (#64 AC 7). It is a *stored* state, not a comparison against the sheet
     * (ADR 0006): a slider moved back onto its default value stays in here.
     */
    pins: {},

    /**
     * The resolved sheet, kept as a plain object rather than a getter: the
     * fixed rail under `Plan` (`views/controls-hot.php`) writes one field of
     * it directly, and a getter would swallow that write. Every handling in
     * this file goes through `setSlider()`, which writes both here and into
     * `pins`; `resolve()` rebuilds it whenever the Set beneath it changes.
     */
    settings: resolveSettings({ game: GAME, type: TOURNAMENT_TYPES[0], pins: {} }),
    curveSteps: CURVES,
    depthSteps: DEPTH_STEPS.map((id) => ({ id, label: DEPTH_STEP_LABELS[id] })),

    /** Which of the Set block's two ⓘ is open — one at a time, or none. */
    openInfo: null,

    /**
     * Session state (#63): which of the three pages is in front, and whether
     * `Plan`'s tile grid is fullscreen. Neither is a Settings field and
     * neither belongs in the `SetupLink` (#61, "Session state" — "die
     * Schale hält … die aktive Seite, das Vollbild … und nichts davon steht
     * im SetupLink"). A reload always lands back on `Plan` with fullscreen
     * off, for free, because this is a plain object literal re-created on
     * every page load, never read from or written to the link.
     */
    activePage: 'plan',
    fullscreen: false,

    /**
     * Switches the active page. A second tap on the already-active page is a
     * no-op — there is no open/close left to trigger (#63 AC 2) — and any
     * real switch drops fullscreen, because fullscreen is a state of `Plan`
     * and no other page has one (#63 AC 6).
     */
    setPage(page) {
      if (page === this.activePage) return;
      this.activePage = page;
      this.fullscreen = false;
    },

    /** Grabbed at the tile grid, never from the (hidden, in fullscreen) foot. */
    openFullscreen() {
      this.fullscreen = true;
    },

    /** The one exit, at the same corner the grip that opened it sits in. */
    closeFullscreen() {
      this.fullscreen = false;
    },

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

    /** The chosen TournamentType's title for the Plan head. Picking one is #64's
     *  Set block; until it existed this read the first entry outright. */
    get typeTitle() {
      return this.currentType?.title ?? '';
    },

    /**
     * A DistributionCurve step drawn as the shape it is: four bars falling by
     * the step's own ratio. The steps are named, not numbered, so a word
     * alone ("firm") says nothing about how steeply it drops — the shape does
     * (ADR 0001: named types were dropped precisely because the *slope* is
     * the thing being chosen).
     */
    curveBars(step) {
      return [0, 1, 2, 3].map((j) => Math.round(13 * step.ratio ** j) + 2);
    },

    /** The chosen step's ratio, for the sentence under the shapes. */
    get curveRatio() {
      return CURVES.find((step) => step.id === this.settings.curve)?.ratio ?? 0;
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

    /* ── The Set block (#64) ──────────────────────────────────────────── */

    /**
     * The Game row stands even with a single entry, and its button is the
     * invitation rather than a control: tapped, it does nothing, because it
     * is already chosen (CONTEXT.md, `Game`). That is this early return and
     * not a `disabled` attribute — a dead button would say the level is
     * broken, where the level is merely settled.
     */
    setGame(id) {
      if (id === this.gameId) return;
      this.gameId = id;
      this.resolve();
    },

    /**
     * A type switch replaces the whole DefaultSet and overwrites nothing set
     * by hand (#64 AC 7, ADR 0003): `pins` survives the call untouched and is
     * laid back over the new sheet by `resolveSettings()`.
     */
    setType(id) {
      if (id === this.typeId) return;
      this.typeId = id;
      this.resolve();
    },

    /** The chosen Game's catalogue entry, found by name and never by position. */
    get currentGame() {
      return this.games.find((entry) => entry.id === this.gameId) ?? this.games[0];
    },

    /** The type chips: a Game's type list is its own, so it is read off the
     *  chosen Game rather than off the module (#51, `catchBase`). */
    get types() {
      return this.currentGame.types;
    },

    /** Absent or unknown, the first of the list is the choice (ADR 0003). */
    get currentType() {
      return this.types.find((type) => type.id === this.typeId) ?? this.types[0];
    },

    /**
     * The Game's Settings sheet. The catalogue carries names, not sheets — a
     * second Game will bring its own `GAME` and this becomes a lookup; with
     * one Game set up there is nothing yet to look up.
     */
    resolve() {
      this.settings = resolveSettings({ game: GAME, type: this.currentType, pins: this.pins });
    },

    /** One ⓘ per level, each with its own sentence — the same handle closes it. */
    toggleInfo(id) {
      this.openInfo = this.openInfo === id ? null : id;
    },

    /* ── The seventeen controls (#64) ─────────────────────────────────── */

    /** Settings and plan together: what every bound and every number is read against. */
    get stand() {
      return { settings: this.settings, plan: this.plan };
    },

    /** The number a control shows — pinned, or the one the core computed. */
    value(key) {
      return effectiveValue(key, this.stand);
    },

    /**
     * The one cap. The slider element and the counter's ± both draw from
     * here, so neither can push past the other (#61, "Caps at the controls").
     * `reachFor()` is the cap widened to take in a pinned value that a sunk
     * cap left standing — it stops a handling from reaching further out and
     * never from coming back (ADR 0006).
     */
    bounds(key) {
      return reachFor(key, this.stand) ?? { min: 0, max: 0 };
    },

    /**
     * Every handling of a control, the four hot ones included. It writes the
     * pin as well as the value, because the pin is set by the handling and
     * not by the value (ADR 0006) — a slider dragged back onto its default
     * stays pinned, and a Set switch therefore keeps it.
     */
    setSlider(key, value) {
      const next = clampToBounds(key, value, this.stand);
      if (next === null) return;
      this.pins[key] = next;
      this.settings[key] = next;
    },

    /** The counter's ±, moving by one inside the same bounds the slider has. */
    step(key, delta) {
      this.setSlider(key, Number(this.value(key)) + delta);
    },

    canStep(key, delta) {
      const bounds = this.bounds(key);
      const next = Number(this.value(key)) + delta;
      return next >= bounds.min && next <= bounds.max;
    },

    /**
     * The four hot sliders, kept under their own names because the fixed rail
     * under `Plan` (`views/controls-hot.php`) calls them. They are plain
     * `setSlider()` calls now: the rail and the sheet change the same stand
     * in the same way, and only the explanation text under the title tells
     * the two apart (#64 AC 9).
     */
    setPlayers(value) {
      this.setSlider('players', value);
    },
    setRankFloor(value) {
      this.setSlider('rankFloor', value);
    },
    setDepth(value) {
      this.setSlider('depth', value);
    },

    init() {
      const fixed = [
        this.$refs.head,
        this.$refs.participation,
        this.$refs.legend,
        this.$refs.ranktotal,
        this.$refs.rest,
      ].filter(Boolean);
      this._detachMeasuring = attachMeasuring(this.$refs.stage, fixed);
      /* Entering fullscreen changes which fixed parts render, not always the
         stage's own box, and `ResizeObserver` only sees the box. Measure again
         after Alpine has applied the `x-show`s, or the grid would keep the
         column count and diagram height of the layout it just left. */
      this.$watch('fullscreen', () => {
        requestAnimationFrame(() => applyGeometry(this.$refs.stage, fixed));
      });
    },

    destroy() {
      if (this._detachMeasuring) this._detachMeasuring();
    },
  };
}
