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
import { applyGeometry, applyRaffleLift, applyRafflePadding, attachFades, attachMeasuring, attachStage, readRowEnds, showChipInRow, showRaffleHit, stepRow } from './measure.mjs';
import { foldPage, foldProperties, fold as foldOf, pageShown } from './fold.mjs';
import { DEFAULT_RANGE, RANGE_ROWS, drawFrom, raffleView } from './raffle.mjs';
import { rankSegments } from './diagram.mjs';
import {
  DEPTH_STEP_LABELS,
  DROP_BUBBLE,
  HANDOUT_PINS,
  clampToBounds,
  controlShown,
  dropConfirmation,
  dropNoun,
  effectiveValue,
  handSetKeys,
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
import { copyText, flashCopied, linkAddress, reportView } from './link-screen.mjs';
import { dismiss, expand, foldStep, freshFold, minimize, noticeStack, searchesFor } from './notices.mjs';
import { attachConfirmFirst } from './confirm-first.mjs';

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
  if (empty) return { game: GAME.id, type: TOURNAMENT_TYPES[0].id, pins: {}, choices: {}, report: null, write: false };

  const lifted = migrate(decode(query, GAMES));
  const fromTheFuture = (lifted.report?.entries ?? []).some((entry) => entry.kind === 'futureVersion');
  return { ...lifted, choices: lifted.choices ?? {}, report: lifted.report ?? null, write: !fromTheFuture };
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
  if (opened.write) {
    seam.write(encode({ game: opened.game, type: openedType.id, pins: opened.pins, choices: opened.choices }));
  }

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

    /**
     * The stage the fold is computed from — the app's own box, as the
     * measuring rind last read it (`attachStage()` in `measure.mjs`). Until the
     * first reading, and wherever there is no window at all (`node --test`),
     * it is the portrait master, so the app boots as one page.
     */
    stage: { width: 393, height: 830 },

    /**
     * The fold of the current stage (#71): columns, the flat stage, the two
     * insets. Pure, in `fold.mjs`; this getter only hands it the stage and the
     * fullscreen, which is the fold in the opposite direction.
     */
    get fold() {
      return foldOf({ ...this.stage, fullscreen: this.fullscreen });
    },

    /**
     * The rind's one write. A page that now stands as a column is no longer
     * the active page — whoever stands on `Details` at a narrow window and
     * pulls it wider lands on `Plan` and sees the controls beside it (#61,
     * "Session state"). Written back rather than read through, as in the
     * prototype's `render()`: narrowing the window again then shows `Plan`, not
     * a page the CommunityLead had already left by widening.
     */
    setStage(size) {
      this.stage = size;
      this.activePage = foldPage(this.fold, this.activePage);
    },

    /** Whether `page` is on screen — as the active page or as a column. */
    shows(page) {
      return pageShown(this.fold, this.activePage, page);
    },

    /**
     * Whether `page` has an entry in the foot. An entry **vanishes** once its
     * page stands as a column (#71 AC 3); with one column all three stand.
     * At two columns this leaves exactly one, and it is the folded one — the
     * grip (#71 AC 4).
     */
    footEntry(page) {
      return this.fold.columns === 1 || !this.shows(page);
    },

    /** The column head carries the word exactly when the foot does not. */
    titled(page) {
      return !this.fullscreen && !this.footEntry(page);
    },

    /** The fold's sizes as CSS custom properties on the app root. */
    get foldStyle() {
      return Object.entries(foldProperties(this.fold)).map(([k, v]) => `${k}:${v}`).join(';');
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
     * into twelve decisions nobody made (Befund G3, `## Nachtrag (#86)` in
     * ADR 0009). Beside the pins it carries the `RaffleRange`, the one hand-set
     * choice that is no pin (run 12, K1b on #72) — see `linkChoices`.
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
      const setup = { game: this.gameId, type: this.typeId, pins: this.pins, choices: this.linkChoices };
      const url = this.linkInCirculation ? encode(setup) : addressFor(setup);
      if (url === null) return;
      this.linkInCirculation = true;
      this._writeAddress(url);
    },

    /**
     * A grip on a step of `Served ranks` (#114): the number follows the sum
     * again and the step supplies its starting value — the prototype's
     * `delete st.pin.depth; delete st.val.depth; setVal('depthStep', …)`. Two
     * deletions there because a pin and the value it shows are two things;
     * here the shown value is `settings.depth`, resolved, so the pin is not
     * merely deleted: the sheet is resolved again over the new record, the way
     * a drop does it (`pinsWithout`, `resolvedFor`), or the old number would
     * stay on screen. `Served ranks` is one item (`PIN_MEMBERS`), so it is
     * counted once before and after: the step took the pin over from the
     * number. Without a pin on the number this is what `setSlider()` did.
     */
    setStep(id) {
      const step = clampToBounds('depthStep', id, this.stand);
      if (step === null) return;
      const pins = { ...pinsWithout(this.pins, ['depth']), depthStep: step };
      this.pins = pins;
      this.settings = this.resolvedFor(pins);
      this.syncAddress();
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

    /**
     * The field whose typed text is not yet confirmed, or `null` (K4 of run
     * 12, "erst bestätigen"): while one stands, a press anywhere else only
     * confirms it (`confirm-first.mjs`). Unconfirmed is `isDraft()` — text
     * that differs from the value standing — so a field that only has the
     * focus, or holds the number it shows, blocks nothing.
     */
    get pendingDraft() {
      return Object.keys(this.drafts).find((key) => this.isDraft(key)) ?? null;
    },

    /** Confirms the pending field as Enter would; answers its key, or `null`. */
    confirmDraft() {
      const key = this.pendingDraft;
      if (key === null) return null;
      this.commitTyped(key, this.drafts[key]);
      return key;
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
      /* Alpine calls `init()` by itself *and* through `x-init="init()"` on the
         root (`views/app.php`), so it ran twice: two ResizeObservers on the
         stage, two resize listeners, two "erst bestätigen" listeners on the
         document, two bubble effects (found by #71, whose fade bands came out
         doubled). Everything here is attached once. */
      if (this._initialised) return;
      this._initialised = true;
      const fixed = [
        this.$refs.head,
        this.$refs.participation,
        this.$refs.legend,
        this.$refs.ranktotal,
        this.$refs.rest,
      ].filter(Boolean);
      this._fixed = fixed;
      /* The open raffle bar takes its overlap with the tile window off the
         diagram (#73, K1), so every measuring pass asks for it. */
      const bar = () => (this.raffleOpen ? this.$refs.raffle : null);
      this._detachMeasuring = attachMeasuring(this.$refs.stage, fixed, bar, (fits) => this.applyDiagramRoom(fits));
      /* Entering fullscreen changes which fixed parts render, not always the
         stage's own box, and `ResizeObserver` only sees the box. Measure again
         after Alpine has applied the `x-show`s, or the grid would keep the
         column count and diagram height of the layout it just left. */
      this.$watch('fullscreen', () => {
        requestAnimationFrame(() => this.applyDiagramRoom(applyGeometry(this.$refs.stage, fixed, bar())));
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
      /* "Erst bestätigen" (K4 of run 12): a press outside a field with an
         unconfirmed number confirms it and activates nothing else. On the
         document, so it covers every control there is and every one a later
         branch adds. */
      this._detachConfirmFirst = attachConfirmFirst(document, this);
      /* The fold (#71): the app's own box is the stage, read by the rind and
         written here once per resize; every page, the foot and the insets
         follow from `fold` reactively. */
      this._detachStage = attachStage(this.$root, (size) => this.setStage(size), this.$refs.rail);
      /* One fade band per surface that really scrolls (#71 AC 10). Painted
         after every drawing that can change what overflows — the plan, the
         fold, the page in front — and on every scroll and resize by the rind
         itself. */
      this._fades = attachFades(this.$root, ['.plan-grid', '.page-details', '.page-prepare']);
      this._fading = window.Alpine.effect(() => {
        void [this.fold, this.activePage, this.fullscreen, this.tiles.length, this.raffleOpen];
        this.$nextTick(() => this._fades.paint());
      });
    },

    destroy() {
      if (this._detachStage) this._detachStage();
      if (this._fades) this._fades.detach();
      if (this._fading) window.Alpine.release(this._fading);
      if (this._detachConfirmFirst) this._detachConfirmFirst();
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
     * The `RaffleRange`, and it is **no `Regler`** (#69, #61): no pin, no
     * reset button, and a Set switch leaves it standing. The full reach at the
     * pin chip counts it all the same and puts it back to `all` (run 12,
     * Phase G on #72, `zaehlt-mit`) — `handSetKeys`, never `pinnedKeys`. Its default `all` is a constant of the term, which is why it
     * sits here as a literal and in no `DefaultSet`.
     *
     * It **travels in the `SetupLink`** all the same (run 12, K1b on #72: "Auch
     * die RaffleRange reist im Link mit"), as a key beside the sliders —
     * `CHOICE_KEYS` in `link/keys.mjs`, never `KEYS` — and a link that names
     * one opens with it. `controls.mjs` still has no entry for it, so the
     * sentence "`pinned` gilt für alle Regler gleich" stays true without an
     * exception.
     */
    raffleRange: opened.choices.raffleRange ?? DEFAULT_RANGE,

    /** What the link carries beside the pins: the hand-set choices that are
     *  no pin. `encode()` leaves out whatever equals its term constant. */
    get linkChoices() {
      return { raffleRange: this.raffleRange };
    },

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

    /**
     * Whether the diagram has room, as the rind last measured it
     * (`diagramFits()` in `geometry.mjs`, written by `applyDiagramRoom()`).
     * `true` until the first measuring pass, which runs with the diagram
     * standing.
     */
    diagramFits: true,

    /**
     * Whether the diagram stands: not in fullscreen (#63), and only where it
     * has room — after the two tile rows and an open raffle bar's cover, its
     * 60 px floor (#129, run 15, K3/K4). It is an extra; the tiles come
     * first. Neither the fold nor the bar decides this on its own: a flat
     * stage tall enough keeps it with the bar open, a low wide window loses it.
     * The rank total does not leave with it (#132): the sum check has three
     * places on every stage.
     */
    get diagramShown() {
      return !this.fullscreen && this.diagramFits;
    },

    /** The rind's verdict on the diagram's room (`applyGeometry()`). */
    applyDiagramRoom(fits) {
      if (this.diagramFits !== fits) this.diagramFits = fits;
    },

    /** The bar's own ✕ — the one grip besides the legend's that closes it. */
    closeRaffle() {
      this.raffleOpen = false;
    },

    /**
     * No `Regler`, so this writes no pin (#69 AC 12) — but the address, as a
     * pin does (run 12, K1b on #72): otherwise `Copy link` would carry a range
     * that a reload loses.
     */
    setRaffleRange(id) {
      this.raffleRange = id;
      this.syncAddress();
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
      // Where the list scrolls sideways, the next measuring brings this hit's chip in.
      this._takeBackShow = this.takeBackScrolls ? rank : null;
      /* The hit is shown by `measureRaffle()`, after it has laid the bar,
         the padding and the diagram's verdict out — not on a timer of its
         own. The bar grows by the announcement on the first throw, and the
         diagram may go with it (#129); scrolled any earlier, the hit was put
         against the old boxes and ended under the grown bar (run 14) or cut
         by the diagram's leaving (run 15, 600 × 493). */
      this._hitPending = rank;
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

    /* ── The retraction list as one sideways row (#129, run 15, K5) ────── */

    /**
     * Whether the retraction list is one row that scrolls sideways instead of
     * wrapping and growing the bar: on the flat stage and in the cramped
     * exception — the fold's own flags, never a width — where the room over
     * the bar is shortest. On a phone it is dragged; the arrows in its head
     * line say there is more and move it by one pill. It does not page (the
     * maintainer, run 15: „nicht blättert, sondern horizontal scrolled").
     * Everywhere else the list wraps and the bar grows with it (#69).
     *
     * Not tied to `diagramShown`: the bar's height goes into that verdict, and
     * a list form decided by it would decide the bar's height in turn.
     */
    get takeBackScrolls() {
      return this.fold.flat || this.fold.cramped;
    },

    /** Where the row stands (`rowScrollEnds()`): the arrows read it. */
    takeBackEnds: { overflow: false, atStart: true, atEnd: true },

    /** The rank whose chip the next measuring brings into the row, else `null`. */
    _takeBackShow: null,

    /** The rank the next measuring scrolls the grid to and lifts out, else `null`. */
    _hitPending: null,

    /** The list element, while there is one. */
    _takeBackList() {
      return this.$refs?.raffle?.querySelector('.raffle-takeback-list') ?? null;
    },

    /** Reads the row's ends again — on its own scroll and after every measuring. */
    readTakeBackEnds() {
      const ends = readRowEnds(this._takeBackList());
      if (ends) this.takeBackEnds = ends;
    },

    /** One arrow click: the row moves by one pill, `1` on and `-1` back. */
    stepTakeBack(direction) {
      stepRow(this._takeBackList(), direction);
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
     * and with the empty-pot sentence, fullscreen moves the grid's own
     * bottom edge, and the fold changes the bar's width and so its wrapping.
     * `$nextTick` waits for Alpine to have drawn the bar the measurement is
     * about. The same measurement lifts the `NoticeStack` above the bar
     * (`applyRaffleLift()`, #73).
     */
    measureRaffle() {
      const view = this.raffle;
      void [this.raffleOpen, this.fullscreen, this.activePage, this.fold, view.hit, view.potEmptyNote,
        view.takeBack.map((entry) => `${entry.rank}×${entry.count}`).join(), this.takeBackScrolls, this.lastDraw];
      this.$nextTick?.(() => {
        const bar = this.raffleOpen ? this.$refs?.raffle : null;
        if (bar && this._takeBackShow != null) showChipInRow(this._takeBackList(), this._takeBackShow);
        this._takeBackShow = null;
        this.readTakeBackEnds();
        /* A second wait, one frame: Alpine shows the bar (`x-show`) in a
           frame of its own, so measured a tick after opening it sometimes had
           no box yet, covered nothing, and the diagram neither yielded nor
           went — at random, one load in two (run 15, 812 × 375, 600 × 493). */
        const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (run) => run();
        /* What the padding and the hit are measured against is only still
           once two frames agree: the bar grows in steps (the list, then the
           announcement's `x-if`), and the rank total under the grid leaves
           and comes with the diagram, so the grid's bottom moves too — by its
           height and gap, 23 px at 600 × 493 (run 15). Padded on the first
           frame, the padding was short by such a step and the hit's row could
           not reach the free strip. So: the diagram's verdict, a frame, and
           again while the verdict flipped or bar or grid moved — at most four
           times. */
        const boxes = () => `${bar ? bar.getBoundingClientRect().height : 0}/${this.$refs?.grid?.getBoundingClientRect().bottom}`;
        const pass = (round) => {
          const seen = boxes();
          const verdict = this.diagramFits;
          /* First the diagram yields to the bar (K1), or goes where it has no
             room (#129). */
          if (this._fixed) this.applyDiagramRoom(applyGeometry(this.$refs?.stage, this._fixed, bar));
          const flipped = this.diagramFits !== verdict;
          frame(() => {
            if (round < 4 && (flipped || boxes() !== seen)) { pass(round + 1); return; }
            applyRafflePadding(this.$refs?.grid, bar);
            applyRaffleLift(this.$refs?.notices, bar);
            /* A fresh hit last, against the boxes it will be seen in. */
            if (this._hitPending != null) {
              const rank = this._hitPending;
              this._hitPending = null;
              this.showHit(rank);
            }
          });
        };
        frame(() => pass(0));
      });
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

    /** What the pin chip counts and hands its question: the pinned items
     *  and the `RaffleRange` off `all` (run 12, Phase G on #72). */
    get handSetKeys() {
      return handSetKeys(this.pins, this.linkChoices);
    },

    /** Whether an item of the chip's list stands set by hand — a pin, or the
     *  `RaffleRange` off `all`. `isPinned()` stays the marking's question. */
    isHandSet(key) {
      if (key === 'raffleRange') return this.raffleRange !== DEFAULT_RANGE;
      return this.isPinned(key);
    },

    /** The counter beside the type row. It counts `displays` and
     *  `manualWinner` as **one** item each, however many `Rank`s carry one
     *  (#61, #67) — by being the same list the question enumerates — and the
     *  `RaffleRange` as one where it is off `all`, so it names the items the
     *  link carries (N2; run 12, Phase G on #72). */
    get pinCount() {
      return this.handSetKeys.length;
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
     * row's chip passes `handSetKeys`, and a caller with a shorter list gets a
     * shorter question.
     */
    confirmDrop: null,

    askDrop({ keys, anchor, reach = 'all', bubble = DROP_BUBBLE, done = null }) {
      const list = (keys ?? []).filter((key) => this.isHandSet(key));
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
        after: { settings: after.settings, choices: after.choices, plan: distribute(after.settings, after.pins) },
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
      this.raffleRange = after.choices.raffleRange;
      this.syncAddress();
    },

    /**
     * What a drop installs, without installing it: the pin record without the
     * named items, the sheet resolved over it, and the `RaffleRange` — back on
     * `all` where the list names it (run 12, Phase G on #72), else as it stands. `dropPins()` installs exactly
     * this, and the question reads its target values off exactly this — one
     * computation for the announcement and the effect, so the bubble cannot
     * promise a value the handling then does not set (#67, run 11, K3).
     */
    afterDrop(keys) {
      const pins = pinsWithout(this.pins, keys);
      const raffleRange = (keys ?? []).includes('raffleRange') ? DEFAULT_RANGE : this.raffleRange;
      return { pins, settings: this.resolvedFor(pins), choices: { raffleRange } };
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

    // SetupLink on screen (#72)

    /**
     * The copy form: **base plus deviations**, read off what the plan reports
     * as set by hand (`plan.pinned`, the addendum (#86) to ADR 0009) and never
     * off the resolved stand. `encode(plan.settings)` is the line that must
     * not be written (Befund G3; K5 on #72): it turns one pin into twelve and
     * ships twelve decisions nobody made.
     *
     * "Complete" means the base is always there, with zero pins too (#47,
     * "Die Kopierform ist immer vollständig") — not the whole resolved state.
     * It may differ from the address bar, which stays empty after a cold
     * start until the first pin (#50, narrowed by run 9 on #89).
     */
    get linkQuery() {
      return encode({ game: this.gameId, type: this.typeId, pins: this.plan.pinned, choices: this.linkChoices });
    },

    /**
     * The address, open in a preselected field, when the clipboard could not
     * take it — or `null`. Session state like an open bubble, and in the
     * `SetupLink` as little (#61, "Session state").
     */
    linkField: null,

    /**
     * The button's one handling. `env` is what a browser has — the clipboard,
     * the page's own address, a timer — handed in so `node --test` can hand in
     * its own; the defaults are read only here, at the rind.
     */
    async copyLink(button, env = this.linkEnv()) {
      const address = linkAddress(this.linkQuery, env.page);
      const outcome = await copyText(address, env.clipboard);
      if (outcome === 'copied') {
        this.linkField = null;
        flashCopied(button, env);
      } else {
        this.linkField = address;
      }
      return outcome;
    },

    closeLinkField() {
      this.linkField = null;
    },

    /**
     * What the `Copy link` handling needs from a browser: the clipboard, if
     * there is one, and the page's own address to resolve the copy form
     * against. `document.baseURI` rather than the address bar's own object:
     * that one is `link/location.mjs`'s alone (#50 AC 6), and the page address
     * is all that is needed here — its query is replaced anyway.
     */
    linkEnv() {
      return {
        clipboard: globalThis.navigator?.clipboard,
        page: globalThis.document?.baseURI,
        later: setTimeout,
        cancel: clearTimeout,
      };
    },

    /**
     * Whether the `LinkMigration` report still stands. It starts true exactly
     * when #51/#52 hand over a non-`null` report (`linkReport`) and turns
     * false once, at the one exit, and nothing turns it back: no chip, no
     * handling reopens it — it comments on the arrival, not on the screen, and
     * is taken note of once per opening (#72; #61, "The LinkMigration report").
     */
    linkReportShown: opened.report !== null,

    /** What the overlay says, or `null` once it is gone (`link-screen.mjs`). */
    get linkReportView() {
      return this.linkReportShown ? reportView(this.linkReport, this.games) : null;
    },

    /**
     * Opens the overlay as a modal `<dialog>`: the top layer is what puts it
     * over everything, the `NoticeStack` included, and makes the rest of the
     * app inert while it stands. It takes the focus onto its one exit and
     * remembers where the focus was, to give it back (#72 AC 10). Every bubble
     * is shut first — "solange er steht, ist keine Blase offen" — which costs
     * nothing at an opening, where nothing has been touched yet.
     */
    showLinkReport(dialog, exit, returnTo = globalThis.document?.activeElement ?? null) {
      if (!this.linkReportShown || !dialog) return;
      this.openTile = null;
      this.openInfo = null;
      this.confirmDrop = null;
      this._linkDialog = dialog;
      this._linkReturn = returnTo;
      if (!dialog.open) dialog.showModal();
      exit?.focus?.();
    },

    /** The one exit. The report is gone for this opening, and the focus goes back. */
    closeLinkReport() {
      this.linkReportShown = false;
      if (this._linkDialog?.open) this._linkDialog.close();
      this._linkDialog = null;
      const back = this._linkReturn;
      this._linkReturn = null;
      back?.focus?.();
    },

    _linkDialog: null,
    _linkReturn: null,

    // NoticeStack (#68)

    /**
     * The fold record: which notice stands open and which as a chip, and the
     * Offer that was turned down. Session state, like the page and the open
     * bubble — in the `SetupLink` as little as they are, and a reload starts
     * from a fresh record with everything open (#61, "Session state"). The
     * rule that moves it is `foldStep()` (`notices.mjs`), on the proven side.
     */
    noticeFold: freshFold(),

    /**
     * The last Set switch, `{ to, keys }`: the type it went to and the pinned
     * items that stayed behind. `null` before the first switch. It is an
     * **event**, so it is recorded at the moment of the switch and not
     * re-derived — the pins can change afterwards, the report of what the
     * switch kept does not (CONTEXT.md, `CarryOverNotice`).
     */
    carryOver: null,

    /** The count of Set switches so far, and the base the last one left. */
    noticeEvent: 0,
    noticeBase: null,

    /**
     * The last time `CombinedHandout` was switched off, `{ keys }`: which of
     * the two pins its way out sets stood pinned at that moment (#103, E4).
     * An event like `carryOver`, recorded at the switch and not re-derived —
     * a pin set after it is no pin the switch left behind. `handoutEvent`
     * counts the switches, `noticeHandout` is the handout as the last fold
     * step saw it.
     */
    handoutOff: null,
    handoutEvent: 0,
    noticeHandout: null,

    /**
     * One step of the fold, after every change: the effect in
     * `views/notices.php` runs it whenever the plan or the base moves, which
     * is Alpine's equivalent of the prototype's `render()` reading the keys
     * on every drawing. It writes only when something changed, so the effect
     * that read the record settles rather than loops.
     *
     * The Set switch is told apart here, by the base moving, rather than in
     * `setType()`: that handler is not this section's to touch, and every way
     * the base can move — the type chips, the Game row — is then the one event.
     */
    refreshNotices() {
      const base = `${this.gameId}/${this.typeId}`;
      if (this.noticeBase !== null && base !== this.noticeBase) {
        this.noticeEvent += 1;
        this.carryOver = { to: this.typeTitle, keys: this.pinnedKeys };
      }
      this.noticeBase = base;
      // Switched off by any handling — the box, its reset, a drop, a Set
      // switch — is the one event, told apart here like the Set switch above.
      const handout = !!this.settings.combinedHandout;
      if (this.noticeHandout === true && !handout) {
        this.handoutEvent += 1;
        this.handoutOff = { keys: HANDOUT_PINS.filter((key) => this.isPinned(key)) };
      }
      this.noticeHandout = handout;
      const plan = this.plan;
      const next = foldStep(this.noticeFold, {
        plan,
        offer: searchesFor(plan).offer,
        event: this.noticeEvent,
        handoutEvent: this.handoutEvent,
      });
      if (JSON.stringify(next) !== JSON.stringify(this.noticeFold)) this.noticeFold = next;
    },

    /** The ways out of the plan on screen: the single ones, or the one way
     *  over several sliders where no single slider clears (ADR 0002, K1). */
    get noticeWays() {
      return searchesFor(this.plan).ways;
    },

    /** The stack as it stands — `{ open, chips }`, the plan's notice first. */
    get notices() {
      const plan = this.plan;
      const { ways, offer } = searchesFor(plan);
      return noticeStack({
        plan,
        ways,
        offer,
        carry: this.carryOver,
        handout: this.handoutLeft,
        fold: this.noticeFold,
      });
    },

    /**
     * What the notice of a switched-off handout lists: the pins the switch
     * left, as far as they still stand, and the type a drop follows. Nothing
     * while the handout is on again — the two pins are its way out then, not
     * left-overs.
     */
    get handoutLeft() {
      if (!this.handoutOff || this.settings.combinedHandout) return null;
      const keys = this.handoutOff.keys.filter((key) => this.isPinned(key));
      return keys.length ? { to: this.typeTitle, keys } : null;
    },

    minimizeNotice(id) {
      this.noticeFold = minimize(this.noticeFold, id);
    },

    /** The chip's one action. It accepts nothing and triggers nothing. */
    expandNotice(id) {
      this.noticeFold = expand(this.noticeFold, id);
    },

    /** The ✕ of the Offer and of the CarryOverNotice; the ConflictNotice has none. */
    dismissNotice(id) {
      this.noticeFold = dismiss(this.noticeFold, id, id === 'offer' ? searchesFor(this.plan).offer : null);
    },

    /**
     * A way out taken with one click. Every change goes through the handler
     * a control has, so it pins what it moves (ADR 0006) and writes the
     * address bar — except the way back to `auto`, which *is* the reset at the
     * control and drops the pin instead (ADR 0002, addendum).
     *
     * A combined way changes several things at once, and the reservation is
     * changed Rank by Rank at the tile's own handler: falling Ranks from the
     * bottom up, rising ones from the top down, so that every single step
     * keeps `d₁ ≥ d₂ ≥ …` and none is refused on the way.
     *
     * The take-back out of the `WinnerPack` overhang (#70) is a list of
     * `manualWinner` changes, one per Rank it names, and each goes through
     * the tile's own handler — the same one the WinnerRaffle's take-back uses
     * (#69). Every change there lowers a count, so none is refused.
     */
    applyWayOut(way) {
      if (way.auto) {
        this.resetSlider(way.key);
        return;
      }
      const changes = way.changes ?? [way];
      const byRank = (key) => (change) => change.key === key;
      const ranks = changes.filter(byRank('displays'));
      const now = (change) => Number(this.settings.displays?.[change.rank - 1] ?? 0);
      const falling = ranks.filter((change) => change.value < now(change)).sort((x, y) => y.rank - x.rank);
      const rising = ranks.filter((change) => change.value > now(change)).sort((x, y) => x.rank - y.rank);
      for (const change of changes) {
        if (change.key !== 'displays' && change.key !== 'manualWinner') this.setSlider(change.key, change.value);
      }
      for (const change of [...falling, ...rising]) this.setDisplays(change.rank, change.value);
      for (const change of changes.filter(byRank('manualWinner'))) this.setManualWinner(change.rank, change.value);
    },

    /** The Offer's button: the reservation it names, set at the tile's handler. */
    acceptOffer(offer) {
      this.setDisplays(offer.rank, offer.value);
    },

    /**
     * *Drop all N and follow <Type>* — the third reach of the way back, and
     * the same question in the same bubble as at the type title (#33, #67):
     * anchored at the button that was pressed. Confirmed, it drops exactly the
     * pins the notice lists and the notice closes with the answer.
     */
    dropCarried(anchor) {
      if (!this.carryOver) return;
      this.askDrop({
        keys: this.carryOver.keys,
        anchor,
        reach: 'carry',
        bubble: this.carryBubble,
        done: () => this.dismissNotice('carryOver'),
      });
    },

    /**
     * The button of the notice a switched-off handout raises (#103, E4): the
     * same third reach of the way back at a second trigger, "keine neue
     * Mechanik". It asks the same question in the same bubble, over the pins
     * the notice lists, and the notice closes with the answer.
     */
    dropHandout(anchor) {
      const left = this.handoutLeft;
      if (!left) return;
      this.askDrop({
        keys: left.keys,
        anchor,
        reach: 'handout',
        bubble: this.carryBubble,
        done: () => this.dismissNotice('handoutOff'),
      });
    },

    /** Whether a control stands on the sheet at this stand (`controlShown()`). */
    controlShown(key) {
      return controlShown(key, this.settings);
    },

    /**
     * Where the question is drawn. The sheet's bubble (`DROP_BUBBLE`) is
     * markup inside `Details`, so wherever `Details` is not on screen it sits
     * under a hidden ancestor and cannot show — while the CarryOverNotice
     * lies over every page. There the question is drawn in the layer's own
     * bubble of the same form (`views/notices.php`), the second trigger site
     * `askDrop()`'s `bubble` argument was left open for. Asked of the fold,
     * not of `activePage` (#71, B13): from two columns on `Details` stands as
     * a column while the active page is `Plan`, and the sheet's bubble is the
     * one to use.
     */
    get carryBubble() {
      return this.shows('details') ? DROP_BUBBLE : '[data-notice-drop]';
    },
  };
}
