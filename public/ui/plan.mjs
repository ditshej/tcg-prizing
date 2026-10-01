/**
 * The Alpine component behind the Plan screen (#62): reads a DistributionPlan
 * off `distribute()` and shows it, plus the four hot controls that change the
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
 * so that a wall has exactly one home, and that home is the core's own cut
 * (#113).
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
import { applyGeometry, applyRafflePadding, attachMeasuring, showRaffleHit } from './measure.mjs';
import { DEFAULT_RANGE, RANGE_ROWS, drawFrom, raffleView } from './raffle.mjs';
import { rankSegments } from './diagram.mjs';
import {
  DEPTH_STEP_LABELS,
  DROP_BUBBLE,
  clampToBounds,
  dropConfirmation,
  dropNoun,
  effectiveValue,
  isPinned,
  manualWinnerAfter,
  pinnedItems,
  pinnedKeys,
  pinsWithout,
  reachFor,
  reservedDisplaysAfter,
  typedValueAfter,
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
 * own entry, the same way `migrate()` detects it — the first handling of a control
 * overwrites it anyway.
 *
 * **"From the future" is read off the wire's own verdict, and it is narrower
 * than "no value was read"** (Lauf 10, "Entscheid K1"). A link with no
 * readable `v` gets its values left unread just the same, but it is broken,
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

  // The last plan and the stand it was computed from — see the `plan` getter.
  // Kept in this closure rather than on the component, so that remembering a
  // plan is never a write Alpine's reactivity would see.
  let planStand = null;
  let planMemo = null;

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
     * (ADR 0006): a number stepped back onto its default value stays in here.
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
     * the hand-set values on the plan separately, so that whoever builds a
     * `SetupLink` from it takes the deviations and never the resolved stand.
     * Handed one argument, `plan.pinned` is `{}` at the surface however many
     * values the CommunityLead has set — true of the object, false of the
     * app (maintainer decision on #66, 2026-09-28).
     *
     * It is computed once per stand and not once per read. Every number on
     * screen reads it several times per drawing (`value`, `bounds`, `canStep`
     * at `−` and at `+`), and with no roof on `players` (#113) one
     * `distribute()` at 5000 players takes a fifth of a second. The stand is
     * recognised by content, because `settings` and `pins` are written in
     * place; and reading the whole of both for the key is also what keeps
     * Alpine's reactivity tracking every field the plan depends on.
     */
    get plan() {
      const stand = JSON.stringify([this.settings, this.pins]);
      if (stand !== planStand) {
        planStand = stand;
        planMemo = distribute(this.settings, this.pins);
      }
      return planMemo;
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
      this.settings = this.resolvedFor(this.pins);
      this.syncAddress();
    },

    /** The sheet under the chosen type with a given pin record laid over it —
     *  the one place both `resolve()` and the drop's announcement get it. */
    resolvedFor(pins) {
      return resolveSettings({ game: GAME, type: this.currentType, pins });
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
     * A control's two ends. The counter's ± and the typed commit both hold at
     * them, and a wall among them is the core's own cut (#113). `reachFor()`
     * is the ends widened to take in a pinned value a sunk wall left standing
     * — it stops a handling from reaching further out and never from coming
     * back (ADR 0006). An open number's `max` is `Infinity`.
     */
    bounds(key) {
      return reachFor(key, this.stand) ?? { min: 0, max: 0 };
    },

    /**
     * Every handling of a control, the four hot ones included. It writes the
     * pin as well as the value, because the pin is set by the handling and
     * not by the value (ADR 0006) — a number stepped back onto its default
     * stays pinned, and a Set switch therefore keeps it. The name stays
     * `setSlider` although the sliders are gone (#113): other branches call
     * it, and it is the one writer of a pin.
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
     * stand names every control, so `encode(this.settings)` would turn one pin
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

    /** The counter's `−` and `+`: one step inside the control's ends, written
     *  and pinned at once (#113) — a press is the handling. */
    step(key, delta) {
      this.setSlider(key, Number(this.value(key)) + delta);
    },

    canStep(key, delta) {
      const bounds = this.bounds(key);
      const next = Number(this.value(key)) + delta;
      return next >= bounds.min && next <= bounds.max;
    },

    /* ── The typed field (#113) ───────────────────────────────────────── */

    /**
     * What is typed into a field and not yet committed, by key — session state
     * like the open bubble, never in `Settings` and never in the `SetupLink`.
     * It is kept apart from the value on purpose: a commit at every keystroke
     * would drive the field through wrong intermediate stands (typing `128`
     * passes a two-player tournament on the way), and every one of them would
     * raise a notice over the whole surface (#113). So the plan stands still
     * until the commit, and this record is the only thing that moves.
     */
    drafts: {},

    /** A keystroke in the field: remembered, not written. */
    draft(key, text) {
      this.drafts[key] = String(text);
    },

    /**
     * Whether the field is visibly "not yet valid" — it holds typed text that
     * differs from the value standing. Read through a plain `get` on the
     * record, which the reactivity tracks (see `isPinned()` in `controls.mjs`).
     */
    isDraft(key) {
      const text = this.drafts[key];
      return text !== undefined && text.trim() !== String(this.value(key));
    },

    /** Escape: the typed text is dropped and the value standing shows again. */
    discardDraft(key) {
      delete this.drafts[key];
    },

    /**
     * Enter, or leaving the field: the typed number counts — if it is a number
     * and if it changes anything (`typedValueAfter()`). Otherwise nothing is
     * written and nothing is pinned, and the field falls back to the value
     * that stands. Either way the draft is gone.
     */
    commitTyped(key, text) {
      delete this.drafts[key];
      const next = typedValueAfter(key, text, this.stand);
      if (next === null) return;
      this.setSlider(key, next);
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
     * The `DisplayReservation`, written where the controls' values are written:
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
         `Players` count pulled down under an open bubble is the measured one
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

    /* ── The WinnerRaffle (#69) ───────────────────────────────────────── */

    /**
     * Whether the raffle bar stands open. Session state like the page, the
     * fullscreen and the open bubble, and in the `SetupLink` as little as they
     * are (#61, "Session state").
     *
     * **It closes only at a grip, never by itself** (#69 AC 2): `setPage()`,
     * `openFullscreen()` and `closeFullscreen()` are deliberately left
     * untouched. The bar is markup inside `page-plan`, so leaving `Plan`
     * hides it with the page and coming back shows it again — hidden is not
     * closed, and no `if` on the surface is needed for either. The retraction
     * list has to be reachable after the last throw, which is precisely when
     * a bar that tidied itself away would be gone.
     */
    raffleOpen: false,

    /**
     * The `RaffleRange`, and it is **no `Regler`** but session state of this
     * operating step (#69, #61): no pin, no reset button, not counted in
     * `Drop all N`, never in the `SetupLink`, and a Set switch leaves it
     * standing. Its default `all` is a constant of the term, which is why it
     * sits here as a literal and in no `DefaultSet`.
     *
     * That is also why `controls.mjs` has no entry for it and `link/keys.mjs`
     * no key: with it absent from both, the sentence "`pinned` gilt für alle
     * Regler gleich" stays true without an exception.
     */
    raffleRange: DEFAULT_RANGE,

    /**
     * The `Rank` the last throw hit — kept only so the announcement can name
     * it, and only as long as that `Rank` still holds a `manual` allocation.
     * It is not a record of provenance: it says nothing about *which* of a
     * `Rank`'s winner packs was drawn, it is dropped on a reload like every
     * other piece of session state, and taking the allocation back makes the
     * announcement fall silent rather than keep a claim about a state that no
     * longer exists (`raffleView()`).
     */
    lastDraw: null,

    /** The die, handed over so `node --test` can hand in one that remembers. */
    _roll: Math.random,

    /** The thirteen steps as the two rows the bar draws, uncut and unfolded. */
    raffleRows: RANGE_ROWS,

    /** The bar's whole content, recomputed off the plan like everything else. */
    get raffle() {
      return raffleView(this.plan, this.raffleRange, this.lastDraw);
    },

    /**
     * The grip on the legend's `winner` entry. It is **never locked**, even
     * when there is nothing to trigger: locked is the trigger *inside* the
     * bar, never the way to it (#69 AC 1).
     */
    toggleRaffle() {
      this.raffleOpen = !this.raffleOpen;
    },

    /** The bar's own ✕ — the one grip besides the legend's that closes it. */
    closeRaffle() {
      this.raffleOpen = false;
    },

    /** Session state, so this writes no pin and no address (#69 AC 12). */
    setRaffleRange(id) {
      this.raffleRange = id;
    },

    /**
     * One throw: exactly one `WinnerPack` to an evenly drawn `Rank` out of the
     * `RafflePot`, written into the **same** `manual` counters the tile's ±
     * writes (#69 AC 5). There is no second record beside them — which is what
     * makes a raffled allocation droppable by #67's `Drop all N` and
     * retractable at the tile, with nothing left over anywhere.
     *
     * The chance sits here, in the input, and never in `distribute()`: that is
     * the whole of why recomputing never changes a winner (#69 AC 6).
     */
    throwRaffle() {
      const view = this.raffle;
      if (!view.canRaffle) return;
      const rank = drawFrom(view.pot, this._roll);
      if (rank == null) return;
      this.setManualWinner(rank, (this.plan.allocation.manual[rank] ?? 0) + 1);
      this.lastDraw = rank;
      /* Two waits, and the second is the load-bearing one. `$nextTick` waits
         for the tile to carry its new mark; the frame after it waits for the
         **bar** to have grown by the announcement and the new list entry, and
         for `measureRaffle()` to have written the padding that goes with it.
         Measured without it, the scroll was computed against the bar's old,
         shorter box and put the hit behind the grown one. */
      this.$nextTick?.(() => requestAnimationFrame(() => this.showHit(rank)));
    },

    /**
     * Taking one back, from the list or from the tile — the same handler and
     * the same counters either way, and the `Rank` is drawable again in the
     * very next read of `raffle.pot` (#69 AC 9). The list entry names the
     * `Rank`, because naming it is what tells correcting apart from
     * re-rolling (#35); the announcement therefore carries no ✕ at all.
     *
     * A `Rank` is cleared outright rather than decremented by one, the way
     * the prototype's list does it (`data-unmanual`): the entry is one `Rank`
     * and not one allocation, and its count rides along on the chip so two
     * packs on one `Rank` are never silently one.
     */
    takeBackWinner(rank) {
      this.setManualWinner(rank, 0);
    },

    /**
     * The two fleeting channels of a hit, both in the measuring rind: the
     * grid scrolls to the tile, and the tile lifts out for one animation.
     * Nothing lasting is written anywhere (#69 AC 10).
     */
    showHit(rank) {
      showRaffleHit(this.$refs?.grid, this.raffleOpen ? this.$refs?.raffle : null, rank);
    },

    /**
     * The bar's second measured rule: the grid gets exactly the overlap as
     * bottom padding, so the tiles scroll **behind** the bar instead of
     * stopping at it (#69 AC 3).
     *
     * Called from `x-effect` on the grid's wrap rather than from `init()`,
     * which is #66's and #62's. The reads on the first line are what the
     * effect subscribes to — the bar's height grows with the retraction list
     * and with the empty-pot sentence, and fullscreen moves the grid's own
     * bottom edge. `$nextTick` waits for Alpine to have drawn the bar the
     * measurement is about.
     */
    measureRaffle() {
      const view = this.raffle;
      void [this.raffleOpen, this.fullscreen, this.activePage, view.takeBack.length, view.hit, view.potEmptyNote];
      this.$nextTick?.(() =>
        applyRafflePadding(this.$refs?.grid, this.raffleOpen ? this.$refs?.raffle : null),
      );
    },

    /* ── `pinned` against `auto`, and the three reaches back (#67) ─────── */

    /**
     * Whether a control is marked. Read off the **stored** record and never
     * off a comparison with the sheet (ADR 0006): whoever steps a number and
     * steps it back has decided, and the marking says "follows the
     * calculation no longer", never "deviates".
     */
    isPinned(key) {
      return isPinned(key, this.pins);
    },

    /** The word at the control. Both stand on screen as they are written
     *  here — `pinned` and `auto` are the glossary's own (CONTEXT.md,
     *  `Pinned`: "Beide Wörter stehen so auch am Schirm"). */
    stateWord(key) {
      return this.isPinned(key) ? 'pinned' : 'auto';
    },

    /** What stands pinned, in sheet order — the list the counter is the
     *  length of and the question reads out, so the two cannot disagree. */
    get pinnedKeys() {
      return pinnedKeys(this.pins);
    },

    get pinnedItems() {
      return pinnedItems(this.pins);
    },

    /** The counter beside the type row. It counts `displays` and
     *  `manualWinner` as **one** item each, however many `Rank`s carry one
     *  (#61, #67) — by being the same list the question enumerates. */
    get pinCount() {
      return this.pinnedKeys.length;
    },

    /** The counter chip's spoken label, in the question's own word. */
    get dropAllLabel() {
      return `Drop ${this.pinCount} hand-set ${dropNoun(this.pinCount)}`;
    },

    /**
     * The **first** reach: one control back onto the chosen TournamentType,
     * and it asks nothing. There is a visible value there and one grip sets
     * it again, so a question would be friction without a counterpart (#33).
     *
     * One control is one item: the reset at `Served ranks` takes its step
     * with it (`PIN_MEMBERS`), or the control would go on saying `pinned`
     * after its own way back.
     */
    resetSlider(key) {
      if (!this.isPinned(key)) return;
      this.dropPins([key]);
    },

    /**
     * The open question, or `null`. It carries the **set of pins** and the
     * **anchor** rather than a reach's name, which is the whole seam #103 is
     * owed: its Entscheid 4 puts this same handling at a second trigger, with
     * two pins and another button, and calls it "keine neue Mechanik".
     * Nothing here knows "everything but Game and TournamentType" — the type
     * row's chip passes `pinnedKeys`, and a caller with a shorter list gets a
     * shorter question.
     */
    confirmDrop: null,

    askDrop({ keys, anchor, reach = 'all', bubble = DROP_BUBBLE, done = null }) {
      const list = (keys ?? []).filter((key) => this.isPinned(key));
      if (!list.length) return;
      this.openTile = null;
      this.openInfo = null;
      this.confirmDrop = { keys: list, anchor, reach, bubble, done, type: this.typeId, game: this.gameId };
    },

    /**
     * The question as text, and `null` once it no longer applies.
     *
     * A Set switch **withdraws** it: the question was asked of the old sheet,
     * it names the type the pins would go back to, and under a new one it
     * would name the wrong one (prototype, `switchType()`: "eine offene Frage
     * gilt dem alten Blatt"). Derived here rather than cleared in `setType()`,
     * so that every way the base can move is covered by the one rule.
     */
    get dropQuestion() {
      const ask = this.confirmDrop;
      if (!ask) return null;
      if (ask.type !== this.typeId || ask.game !== this.gameId) return null;
      const after = this.afterDrop(ask.keys);
      return dropConfirmation({
        keys: ask.keys,
        typeTitle: this.typeTitle,
        reach: ask.reach,
        after: { settings: after.settings, plan: distribute(after.settings, after.pins) },
      });
    },

    /** Declining has a named place beside confirming, which is why this is a
     *  bubble and not a button that turns into a question (#33). */
    cancelDrop() {
      this.confirmDrop = null;
    },

    /** Confirming. The pins of the question fall — no more and no fewer — and
     *  whoever asked runs its own errand afterwards: #103's message closes
     *  itself with the answer, the type row's chip has nothing to close. */
    applyDrop() {
      const ask = this.dropQuestion;
      const done = this.confirmDrop?.done;
      this.confirmDrop = null;
      if (!ask) return;
      this.dropPins(ask.keys);
      if (done) done();
    },

    /**
     * The drop itself, over any set of keys. `Game` and `TournamentType` are
     * out of reach here by construction rather than by an exception: they are
     * no pins and stand in `gameId`/`typeId`, so this resets the screen to the
     * chosen type and never chooses a new one (ADR 0006, addendum #26).
     *
     * A new record rather than a deletion in place: `plan.settings` is a
     * snapshot of what was computed, and `afterDrop()` lays the survivors back
     * over the sheet the way `resolve()` does; the address bar is written
     * exactly as setting a pin writes it (#89).
     */
    dropPins(keys) {
      const after = this.afterDrop(keys);
      this.pins = after.pins;
      this.settings = after.settings;
      this.syncAddress();
    },

    /**
     * What a drop installs, without installing it: the pin record without the
     * named items and the sheet resolved over it. `dropPins()` installs exactly
     * this, and the question reads its target values off exactly this — one
     * computation for the announcement and the effect, so the bubble cannot
     * promise a value the handling then does not set (#67, run 11, K3).
     */
    afterDrop(keys) {
      const pins = pinsWithout(this.pins, keys);
      return { pins, settings: this.resolvedFor(pins) };
    },

    /**
     * The measuring rind of the question's bubble — the same two lines the
     * tile's bubble has, and the same arithmetic behind them (`bubble.mjs`),
     * because it is the same bubble form: it hangs off the button that was
     * pressed, flips up where there is no room, stays in the frame, and
     * **closes when its anchor is no longer visible**. One rule for all its
     * inhabitants (#66).
     *
     * Two things differ from `placeBubble()`, both because this bubble's
     * trigger is not inside `Plan`'s stage and #103's will be somewhere else
     * again:
     *
     * - The **anchor is found by selector**, handed in with the question. A
     *   second trigger site is then a second selector and not a second
     *   handler.
     * - The **frame is the viewport**, and the bubble is placed in it. The
     *   scrolling box the anchor can leave is its own `[data-bubble-frame]`,
     *   which is what the visibility is judged against — `Details` scrolls
     *   itself, so an absolutely placed bubble inside it would scroll away
     *   from the button it hangs on.
     */
    placeConfirm() {
      if (!this.confirmDrop || typeof document === 'undefined') return;
      const bubbleEl = document.querySelector(this.confirmDrop.bubble);
      if (!bubbleEl) return;
      const anchorEl = document.querySelector(this.confirmDrop.anchor);
      const frameEl = anchorEl ? anchorEl.closest('[data-bubble-frame]') : null;
      const viewport = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      const anchor = anchorEl ? anchorEl.getBoundingClientRect() : null;
      if (!anchorVisible(anchor, frameEl ? frameEl.getBoundingClientRect() : viewport)) {
        this.confirmDrop = null;
        return;
      }
      const at = bubblePosition({
        anchor,
        bubble: { width: bubbleEl.offsetWidth, height: bubbleEl.offsetHeight },
        stage: viewport,
      });
      bubbleEl.style.left = `${at.left}px`;
      bubbleEl.style.top = `${at.top}px`;
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
     * it pins the value (ADR 0006) and writes the address bar, and the
     * `pinned` record the hint then falls silent on stays the one there
     * already is.
     */
    takeOffer(offer) {
      this.setSlider(offer.key, offer.value);
    },
  };
}
