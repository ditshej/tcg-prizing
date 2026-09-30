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
 *
 * #89 hangs the `SetupLink` on it at both ends — the link the app was opened
 * at is read here, and every pin writes the address bar from here. This is the
 * **opening place** of Entscheid K6, which means two rules live in this file
 * and nowhere else: what is written back after a read (see `openingRead()`),
 * and which of the two forms a change writes (see `syncAddress()`). Neither is
 * a rule about the wire — `encode.mjs`, `decode.mjs`, `migrate.mjs` and
 * `location.mjs` are used here and adjusted nowhere (#47: "Spec 3 never needs
 * the surface").
 */

import { resolveSettings } from '../core/defaults.mjs';
import { distribute } from '../core/distribute.mjs';
import { CURVES, DEPTH_STEPS } from '../core/rules.mjs';
import { decode } from '../link/decode.mjs';
import { addressFor, encode } from '../link/encode.mjs';
import { readLocation, writeLocation } from '../link/location.mjs';
import { migrate } from '../link/migrate.mjs';
import { GAME, GAME_TITLE, TOURNAMENT_TYPES } from '../sets/onepiece.mjs';
import { applyGeometry, attachMeasuring } from './measure.mjs';
import { rankSegments } from './diagram.mjs';
import {
  DEPTH_STEP_LABELS,
  clampToBounds,
  effectiveValue,
  manualWinnerAfter,
  reachFor,
  reservedDisplaysAfter,
} from './controls.mjs';
import { anchorVisible, bubblePosition } from './bubble.mjs';
import { tileGrip, tileView } from './tile.mjs';
import { preparationList } from './prepare.mjs';

/**
 * The catalogue, and it **falls out of the sheets**: Games in list order, each
 * `{ id, types: [{ id }] }`, types in list order — the form the read path
 * judges a link's base against (`link/decode.mjs`, `catchBase`), with the
 * screen titles riding along for the two chip rows. The order is meaningful
 * and is never a surface sort (ADR 0003).
 *
 * One list, not two: the list the buttons are drawn from and the list a link
 * is judged against are the same object, or a Game the screen offers could be
 * one the link layer replaces without a word.
 */
const GAMES = [{ id: GAME.id, title: GAME_TITLE, types: TOURNAMENT_TYPES }];

/**
 * The second seam of #47, as the app's own pair. It is one argument rather
 * than two imports used in place, so a `node --test` run can hand over a pair
 * that remembers instead — the rule about *when* the address bar is written is
 * this file's, and it would otherwise be provable only at the screen (#89,
 * "Entscheid K6": "die Regel lebt im Aufrufer, wo `node --test` sie nicht
 * hält"). What stays unproven is the pair itself, which is the whole point of
 * it being two lines long.
 */
const SEAM = { read: readLocation, write: writeLocation };

/**
 * What the app opens with, out of the address it was opened at.
 *
 * **The rule hangs on the read result, never on `pins`** (Lauf 9, "die
 * Reichweite der zweiten Ausnahme"). Two cases look alike from the outside —
 * no pin standing — and they are not the same case:
 *
 * - **A cold start**: no query at all. Nothing was read, so nothing is
 *   reported and the address bar is not touched — an app merely opened has no
 *   link in circulation, and changing the address because somebody opened the
 *   page is a movement without a counterpart (#47, "Writing the address bar").
 *   The read path is not even entered: `decode('')` finds no `v` and answers
 *   with a report calling the link broken, so asking it would hand #72's
 *   overlay a report on every plain visit — and, since a broken link is one
 *   the address bar gets cleaned up for, would write the address of an app
 *   nobody linked to. This cut is older than that consequence and survives it
 *   unchanged (PR #108, point 2, the half Lauf 10 "Entscheid K1" leaves
 *   standing).
 * - **A link came in and nothing survived the reading**: there *was* input, so
 *   the opening place cleans up after it (Entscheid K6) — the address bar is
 *   written as what actually holds, even when not a single pin stands
 *   afterwards. Otherwise an unreadable link keeps standing there claiming
 *   something the screen does not show.
 *
 * The one link that is **not** written back is the one from the future: its
 * base is all that was read, and writing our version over it would devalue a
 * link a newer app could still read in full (#47). Detected by the report's
 * own entry, the same way `migrate()` detects it — the first slider drag
 * overwrites it anyway.
 *
 * **"From the future" is read off the wire's own verdict, and it is narrower
 * than "no slider was read"** (Lauf 10, "Entscheid K1"). A link with no
 * readable `v` gets its sliders left unread just the same, but it is broken,
 * not newer than us, and it carries `unreadableVersion` rather than
 * `futureVersion` — so it falls into the cleanup branch above with no test of
 * its own here. That is the whole of the wiring this file owes the decision:
 * the cut is made once, at the wire (`link/decode.mjs`), and this place reads
 * the result instead of deciding the same thing a second time.
 *
 * Read the version off `migrated`? It never comes to that: K6 is strictly
 * wider — every read that is not from the future is written back, chain or no
 * chain — so the case `migrated` was to single out is already inside. Said
 * here because #89's last criterion names the field, and a criterion that
 * answers a narrower question than the decision above it is answered by the
 * wider one.
 */
function openingRead(query) {
  const empty = String(query ?? '').replace(/^[?#]/, '') === '';
  if (empty) return { game: GAME.id, type: TOURNAMENT_TYPES[0].id, pins: {}, report: null, write: false };

  const lifted = migrate(decode(query, GAMES));
  const fromTheFuture = (lifted.report?.entries ?? []).some((entry) => entry.kind === 'futureVersion');
  return { ...lifted, report: lifted.report ?? null, write: !fromTheFuture };
}

/** Builds the `ranks N–M get nothing` sentence, or `null` if none are left out. */
function restMessage(lastServedRank, players) {
  const from = lastServedRank + 1;
  if (from > players) return null;
  return from === players ? `rank ${from} gets nothing` : `ranks ${from}–${players} get nothing`;
}

export function planApp(seam = SEAM) {
  const opened = openingRead(seam.read());
  const openedType = TOURNAMENT_TYPES.find((entry) => entry.id === opened.type) ?? TOURNAMENT_TYPES[0];
  // K6, before the first paint: what came in has been read, so what holds is
  // what the address bar says from here on.
  if (opened.write) seam.write(encode({ game: opened.game, type: openedType.id, pins: opened.pins }));

  return {
    /**
     * The chosen Set, as the two names the chain is built from (ADR 0003):
     * the Game and the TournamentType, never a list position — the same two
     * a SetupLink carries as its base (`link/keys.mjs`, `BASE_KEYS`).
     */
    gameId: opened.game,
    typeId: openedType.id,

    /** The catalogue the chips are drawn from and a link is judged against. */
    games: GAMES,

    /**
     * What the link cost on the way in, as the data structure #51 builds —
     * `null` when nothing was lost, and `null` on a cold start because nothing
     * was read at all. #72 is where it becomes the app's one overlay; this
     * ticket builds the edge that carries it there, and without the edge every
     * loss stays mute, `migrate()` having no caller at all.
     */
    linkReport: opened.report,

    /**
     * Whether a SetupLink is in circulation — read out of the address bar, or
     * put there by a pin. It is what tells the two silent cases apart: before
     * the first pin of a cold start the address stays empty, and afterwards
     * every change writes the **whole** form, base included, even one that
     * leaves no pin standing.
     */
    linkInCirculation: opened.write,

    /** The unproven rim, kept as handed in so a test can hand in its own. */
    _writeAddress: seam.write,

    /**
     * What the CommunityLead set by hand — the third level over Game and
     * TournamentType, and the record that makes a Set switch keep his work
     * (#64 AC 7). It is a *stored* state, not a comparison against the sheet
     * (ADR 0006): a slider moved back onto its default value stays in here.
     *
     * A link's pins land here unchanged: a value out of a URL is a pinned
     * value like any other and the app never tracks that it came from one
     * (ADR 0005), so the migrated stand applies at once rather than waiting
     * for a click (#47, "Reading a link").
     */
    pins: opened.pins,

    /**
     * The resolved sheet, kept as a plain object rather than a getter: the
     * fixed rail under `Plan` (`views/controls-hot.php`) writes one field of
     * it directly, and a getter would swallow that write. Every handling in
     * this file goes through `setSlider()`, which writes both here and into
     * `pins`; `resolve()` rebuilds it whenever the Set beneath it changes.
     */
    settings: resolveSettings({ game: GAME, type: openedType, pins: opened.pins }),
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
     * Which tile's bubble is open, as the `Rank` it hangs off — session state
     * like the page and the fullscreen, and in the `SetupLink` as little as
     * they are (#61, "Session state").
     *
     * One number, not a set: there is exactly **one** bubble in this app, with
     * four inhabitants, and whoever moves in puts the last one out (#61, "The
     * tiles and their grip"). The app's one *overlay* is something else again
     * — the `LinkMigration` report — and this is not it.
     */
    openTile: null,

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
      this.openTile = null;
    },

    /** Grabbed at the tile grid, never from the (hidden, in fullscreen) foot. */
    openFullscreen() {
      this.fullscreen = true;
      this.openTile = null;
    },

    /** The one exit, at the same corner the grip that opened it sits in. */
    closeFullscreen() {
      this.fullscreen = false;
      this.openTile = null;
    },

    /**
     * The plan, built from the resolved stand **and** the pins beside it. The
     * second argument changes no number (`distribute()` reads it only to carry
     * it on), and it is the whole point: the addendum (#86) to ADR 0009 puts
     * the hand-set sliders on the plan separately, so that whoever builds a
     * `SetupLink` from it takes the deviations and never the resolved stand.
     * Handed one argument, `plan.pinned` is `{}` at the surface however many
     * sliders the CommunityLead has moved — true of the object, false of the
     * app (maintainer decision on #66, 2026-09-28).
     */
    get plan() {
      return distribute(this.settings, this.pins);
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
      this.syncAddress();
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
      this.syncAddress();
    },

    /**
     * The address bar after a change the SetupLink carries — a pin, or the
     * base beneath it. It takes the **pins**, never the resolved stand: the
     * stand names every slider, so `encode(this.settings)` would turn one pin
     * into twelve decisions nobody made and lose `depthStep` on the way
     * (Befund G3, `## Nachtrag (#86)` in ADR 0009).
     *
     * Which of the two forms is written hangs on whether a link is in
     * circulation, not on how many pins stand. Before the first pin of a cold
     * start `addressFor()` answers `null` — leave it alone — and that is the
     * whole of #50's exception. From the first pin on, and from the first
     * incoming link on, the **complete** form is written: a Set switch under
     * a link with no pins has to move the address too, or it would keep
     * naming the type the sender chose.
     */
    syncAddress() {
      const setup = { game: this.gameId, type: this.typeId, pins: this.pins };
      const url = this.linkInCirculation ? encode(setup) : addressFor(setup);
      if (url === null) return;
      this.linkInCirculation = true;
      this._writeAddress(url);
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
     * `setSlider()` calls now: the rail and the sheet change the same stand in
     * the same way, because both call exactly these handlers and so cannot
     * drift in what they *do* (head comment of `views/controls-hot.php`; #61,
     * which names the rail literally the same content as `Details` — "die
     * Schiene **ist** `Details` und war nie ein eigener Inhalt").
     *
     * What tells the two forms apart is what they *show*, not what they do:
     * the sheet carries an explanation under every title and a counter, the
     * rail neither (#64 AC 9 for the explanation text, which is the criterion
     * that says it appears only on `Details`).
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

    /* ── The tile as a grip (#66) ─────────────────────────────────────── */

    /** What a tile shows beyond its numbers: 2×2 from the first `Display` on,
     *  the settled tone, the `flagged` mark. */
    tile(row) {
      return tileView(row, this.plan);
    },

    /** The open bubble's whole content, or `null` while none is open. A `Rank`
     *  that has fallen past the player count comes back `null` too, so the
     *  bubble closes with the tile it hung off instead of standing on nothing. */
    get grip() {
      return this.openTile == null ? null : tileGrip(this.openTile, this.stand);
    },

    /** A grip at the tile opens the bubble, the same grip closes it. The
     *  placing is not called here: it runs after every drawing (see `init()`). */
    toggleTile(rank) {
      this.openTile = this.openTile === rank ? null : rank;
    },

    closeTile() {
      this.openTile = null;
    },

    /**
     * The `DisplayReservation`, written where the sliders' values are written:
     * into `settings` and into `pins` in the same handling, because the pin is
     * set by the handling and not by the value (ADR 0006). It counts as **one**
     * pinned item however many `Rank`s carry a reservation (#61, "The
     * controls").
     *
     * The whole vector is replaced rather than edited in place: `plan.settings`
     * is a snapshot of what was computed, and a vector edited underneath it
     * would leave the plan carrying an input it was not computed from.
     */
    setDisplays(rank, count) {
      const next = reservedDisplaysAfter(rank, count, this.stand);
      if (next === null) return;
      this.pins.displays = next;
      this.settings.displays = next;
      this.syncAddress();
    },

    /** The `manual` share of the `WinnerPackAllocation` — the same counters a
     *  `WinnerRaffle` throw writes into (#10, CONTEXT.md). */
    setManualWinner(rank, count) {
      const next = manualWinnerAfter(rank, count, this.stand);
      if (next === null) return;
      this.pins.manualWinner = next;
      this.settings.manualWinner = next;
      this.syncAddress();
    },

    /** The two ± of the open bubble, each moving by one inside its own cap. */
    stepDisplays(delta) {
      const grip = this.grip;
      if (!grip?.displays) return;
      this.setDisplays(grip.rank, grip.displays.value + delta);
    },

    stepWinners(delta) {
      const grip = this.grip;
      if (!grip) return;
      this.setManualWinner(grip.rank, grip.winners.manual + delta);
    },

    /**
     * The measuring rind of the bubble (#61): it reads three boxes and writes
     * two CSS lengths, and every sum it does on them is `bubble.mjs`, on the
     * proven side.
     *
     * The frame the anchor is judged against is the **grid**, not the stage:
     * the grid is what scrolls, so that is where a tile goes out of sight
     * while the stage stays exactly where it was.
     */
    placeBubble() {
      const stageEl = this.$refs.stage;
      const popEl = this.$refs.bubble;
      const gridEl = this.$refs.grid;
      if (this.openTile == null || !stageEl || !popEl || !gridEl) return;
      const tileEl = gridEl.querySelector(`.tile[data-rank="${this.openTile}"]`);
      const anchor = tileEl ? tileEl.getBoundingClientRect() : null;
      if (!anchorVisible(anchor, gridEl.getBoundingClientRect())) {
        this.openTile = null;
        return;
      }
      const at = bubblePosition({
        anchor,
        bubble: { width: popEl.offsetWidth, height: popEl.offsetHeight },
        stage: stageEl.getBoundingClientRect(),
      });
      popEl.style.left = `${at.left}px`;
      popEl.style.top = `${at.top}px`;
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
      /*
         The bubble is placed — and closed — after **every drawing**, not at
         the handlers that open it. That is the prototype's form, and it is a
         decision rather than a taste: `placePop()` is the last line of its
         `render()`, with the reason written beside it — "Zugemacht wird jetzt
         dort, wo es sich messen lässt: `placePop()` schliesst sie, wenn ihr
         Anker nicht mehr sichtbar ist. Eine Regel für alle vier."
         (`git show prototype/rank-distribution:prototypes/cockpit.prototype.html`).

         Tied to the three writing handlers instead, the rule misses every way
         a tile can leave the grid without the bubble being touched — the
         `Players` slider pulled down under an open bubble is the measured one
         (#66 AC 9), and `bubble.mjs` names "a shrinking player count" outright.

         Alpine has no single render pass, so its equivalent of that last line
         is an effect over the state the grid is drawn from. `$nextTick` waits
         for the `x-for` to have caught up, so the measuring reads the tiles
         that are there now and not the ones that just left. Closing writes
         `openTile`, which this effect reads — the second pass then finds
         nothing open and returns at the first line, so it settles rather than
         loops.
      */
      this._placing = window.Alpine.effect(() => {
        void [this.activePage, this.fullscreen, this.openTile, this.tiles.length];
        this.$nextTick(() => this.placeBubble());
      });
      /* A resized window moves neither of those, so it stays a listener: it
         moves the anchor and the frame it is judged against without any state
         changing, and the same one rule is what it calls. */
      this._onResize = () => this.placeBubble();
      window.addEventListener('resize', this._onResize);
    },

    destroy() {
      if (this._detachMeasuring) this._detachMeasuring();
      if (this._placing) window.Alpine.release(this._placing);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
    },

    /* ── The PreparationList (#65) ────────────────────────────────────── */

    /**
     * What `Prepare` shows: the three procurement items with their step
     * sequences written out, and the closing sentence. The whole of it is
     * `preparationList()` (`prepare.mjs`), on the proven side of the seam —
     * this file holds no word and no number of it, the same split the tile
     * and the bubble already have.
     *
     * It takes the plan alone: the sheet it needs (`displaySize`,
     * `envelopeSize`) and the record of what was set by hand ride on the plan
     * itself (ADR 0009 and its addendum (#86)), so nothing here can hand it a
     * stand the plan was not computed from.
     */
    get preparation() {
      return preparationList(this.plan);
    },

    /** The three items as a list, because the view draws them with one
     *  template: they differ in what they say, never in how they are built. */
    get preparationItems() {
      const list = this.preparation;
      return [list.displays, list.envelopes, list.winners];
    },

    /**
     * The `WinnerPack` hint's button. It is an **opportunity, not a notice**
     * — it never enters the `NoticeStack` — and the way to another
     * `WinnerPack` runs over more `TournamentPack`s, so what it sets is
     * `tournamentPacks` and not `winnerPacks` (the prototype's
     * `prepContent()`: `data-apply="tournamentPacks"`).
     *
     * It goes through `setSlider()` like every other control rather than
     * writing `settings` itself: taking the offer is an operating gesture, so
     * it pins the slider (ADR 0006) and writes the address bar, and the
     * `pinned` record the hint then falls silent on stays the one there
     * already is.
     */
    takeOffer(offer) {
      this.setSlider(offer.key, offer.value);
    },
  };
}
