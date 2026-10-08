/**
 * The measuring rind (#62's instance of the ADR 0004 seam that #47 names
 * `readLocation`/`writeLocation`): a thin, deliberately unproven strip that
 * reads measures from the DOM and writes CSS sizes, nothing else. All
 * arithmetic lives in `geometry.mjs` and is proven there under `node --test`;
 * this file exists so that arithmetic never has to run where a browser is
 * the only way to check it.
 *
 * `docs/adr/0004-…` (`## Nachtrag`) and #61's Testing Decisions name this
 * strip explicitly as the one part of the shell that stays untested.
 */

import { chipIntoView, diagramCap, diagramFits, fadeHeight, fadeShown as fadeLeft, hitScrollDelta, pillStep, PULSE_MS, pulseClip, pulseReach, raffleCover, raffleLift, raffleScrollPadding, rowScrollEnds, tileColumnsFor } from './geometry.mjs';

/**
 * Measures `stageEl` (the whole Plan column) and `fixedEls` (every fixed part
 * of that column other than the diagram and the tile grid — header, participation
 * line, legend, rank total and rank message), then writes `--plan-columns`
 * and `--diagram-height` as CSS custom properties on `stageEl`.
 *
 * The leftover handed to `diagramCap` is `stageEl`'s own content box minus
 * every fixed part's rendered height, minus the flex `gap` between *all* of
 * `stageEl`'s children and its own padding — both real pixels that
 * `getBoundingClientRect()` on the fixed parts alone does not see, and both
 * of which this ticket's first cut left out (the diagram overran the two-row
 * floor on a genuinely tight landscape stage until this was added).
 *
 * Returns whether the diagram has room (`diagramFits()`, #129, run 15), for
 * the component to show or hide it. The leftover is measured **as if the
 * diagram stood**: its own gap is counted whether it renders or not.
 * Measured as it is drawn, the verdict would move the numbers it is made
 * from — hide the diagram, and the leftover grows by its gap. Since #132
 * nothing else leaves with it: the rank total stays.
 *
 * Reads: `clientWidth`/`clientHeight`, `getBoundingClientRect().height`,
 * computed `gap`/`padding`. Writes: `style.setProperty`. Nothing else — no
 * plan logic, no state.
 */
export function applyGeometry(stageEl, fixedEls = [], barEl = null) {
  if (!stageEl) return true;
  const width = stageEl.clientWidth;
  const height = stageEl.clientHeight;
  const shown = (el) => el && el.getClientRects().length > 0;
  const fixedHeight = fixedEls.reduce((sum, el) => sum + (shown(el) ? el.getBoundingClientRect().height : 0), 0);

  const style = getComputedStyle(stageEl);
  const gap = parseFloat(style.rowGap || style.gap) || 0;
  const padding = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);
  /* Only the children that actually render pay for a gap. Fullscreen hides
     several of them (`x-show` → `display: none`), and counting those would
     charge the leftover for gaps the browser never draws — pixels the tile
     grid would then not get. The diagram counts as rendering, so the
     leftover is the one it would stand in. */
  const visibleChildren = Array.from(stageEl.children)
    .filter((el) => shown(el) || el.classList.contains('plan-diagram')).length;
  const gapCount = Math.max(0, visibleChildren - 1);
  const overhead = fixedHeight + gap * gapCount + padding;

  /* The tiles get the content box, not the client box: `clientWidth` counts
     the stage's side padding, and at a width where that padding decides a
     column (412px on the flat 812 × 375 stage) the grid got seven columns for
     a box that holds six, and its first tile was cut at the left edge (#71). */
  const sides = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
  stageEl.style.setProperty('--plan-columns', String(tileColumnsFor(width - sides)));
  /* An open raffle bar over the tile window is no shared area: the diagram's
     third is taken of what is left above it (#73, K1; #157) — and the diagram
     goes where that third is under its floor (#129, #157). A bar whose page is
     hidden has no box and covers nothing. */
  const gridEl = stageEl.querySelector('.plan-grid');
  const bar = barEl && barEl.getClientRects().length > 0 ? barEl.getBoundingClientRect() : null;
  const covered = gridEl ? raffleCover(gridEl.getBoundingClientRect(), bar) : 0;
  const leftover = Math.max(0, height - overhead);
  /* The diagram's upper bound on this stage (#142), written by the fold onto
     the app root and inherited here; read, not reckoned. */
  const max = parseFloat(style.getPropertyValue('--diagram-max')) || Infinity;
  stageEl.style.setProperty('--diagram-height', `${diagramCap(leftover, covered, max)}px`);
  return diagramFits(leftover, covered);
}

/**
 * Whether `el` has a box to measure. A page that is not in front is
 * `display: none`, and its stage reports 0 × 0 (#158, 10a).
 */
export function hasBox(el) {
  return !!el && (el.clientWidth > 0 || el.clientHeight > 0);
}

/**
 * Wires `applyGeometry` to run once now and again on every resize of
 * `stageEl`, via `ResizeObserver` — the browser's own measuring loop, not a
 * poll this module would have to own.
 *
 * **A stage of 0 × 0 is not measured** (#158, 10a). While another page is in
 * front the `Plan` is hidden, and its box says nothing about the room it will
 * have: measured, it took the diagram away, and the way back showed one frame
 * of the plan without it and a second in which the tiles slid. So that
 * reading is discarded — no verdict, no size written, and `diagramFits()` is
 * neither asked nor changed. The page comes back to what it left.
 */
export function attachMeasuring(stageEl, fixedEls = [], barOf = () => null, onRoom = () => {}) {
  if (!stageEl || typeof ResizeObserver === 'undefined') return () => {};
  const run = () => {
    if (hasBox(stageEl)) onRoom(applyGeometry(stageEl, fixedEls, barOf()));
  };
  run();
  const observer = new ResizeObserver(run);
  observer.observe(stageEl);
  return () => observer.disconnect();
}

/* ── The WinnerRaffle bar (#69) ──────────────────────────────────────────── */

/**
 * Gives the scrolling tile grid exactly the padding the open raffle bar takes
 * off it, so the tiles run **behind** the bar (#69 AC 3). `barEl` is `null`
 * while the bar is closed.
 *
 * Reads two boxes, writes one length. The rule itself — how much, and that it
 * comes to nothing where the grid ends above the bar — is
 * `raffleScrollPadding()` in `geometry.mjs`, under `node --test`.
 */
export function applyRafflePadding(gridEl, barEl) {
  if (!gridEl) return;
  const pad = raffleScrollPadding(
    gridEl.getBoundingClientRect(),
    barEl ? barEl.getBoundingClientRect() : null,
  );
  gridEl.style.paddingBottom = pad ? `${pad}px` : '';
}

/**
 * Lifts the `NoticeStack` — and the chips where they share the bar's corner —
 * above the open raffle bar, so the bar never lies over a ConflictNotice that
 * has to be present (ADR 0002; the prototype's `--raffleh`). `barEl` is `null`
 * while the bar is closed; a bar whose page is hidden measures 0 high and
 * lifts nothing.
 *
 * Reads one box, writes one length on the notice layer — not on the app root,
 * whose `style` attribute Alpine rewrites with the fold's sizes.
 * How much is `raffleLift()` in `geometry.mjs`; which chips follow is
 * `--chip-raffle` out of `foldProperties()` — both under `node --test`.
 */
export function applyRaffleLift(layerEl, barEl) {
  if (!layerEl) return;
  const lift = raffleLift(barEl ? barEl.getBoundingClientRect().height : 0);
  layerEl.style.setProperty('--raffle-lift', `${lift}px`);
}

/**
 * The retraction list as one sideways row (#129, run 15, K5). Three reads of
 * the row's scroll box; the arithmetic is `rowScrollEnds()`, `pillStep()` and
 * `chipIntoView()` in `geometry.mjs`, under `node --test`. `listEl` is `null`
 * while there is no list.
 */
export function readRowEnds(listEl) {
  if (!listEl || listEl.getClientRects().length === 0) return null;
  return rowScrollEnds(listEl);
}

/** One arrow click: the row moves by one pill (`direction` `1` on, `-1` back). */
export function stepRow(listEl, direction) {
  const chips = listEl ? listEl.querySelectorAll('.raffle-chip') : [];
  if (!chips.length) return;
  const lefts = Array.from(chips, (chip) => chip.offsetLeft - chips[0].offsetLeft);
  const left = pillStep({
    lefts, scrollLeft: listEl.scrollLeft, scrollWidth: listEl.scrollWidth, clientWidth: listEl.clientWidth,
  }, direction);
  listEl.scrollTo({ left, behavior: 'smooth' });
}

/** Brings the chip of `rank` into the row, and leaves the row alone where it is in view. */
export function showChipInRow(listEl, rank) {
  const chip = listEl?.querySelector(`.raffle-chip[data-rank="${rank}"]`);
  if (!chip) return;
  const origin = listEl.querySelector('.raffle-chip').offsetLeft;
  const left = chipIntoView({ left: chip.offsetLeft - origin, width: chip.offsetWidth }, listEl.scrollLeft, listEl.clientWidth);
  if (left !== listEl.scrollLeft) listEl.scrollTo({ left, behavior: 'smooth' });
}

/**
 * Shows a hit over the two fleeting channels (#69 AC 10): the grid scrolls to
 * the tile — into the middle of the free strip, and not at all when it is
 * already in it — and the tile lifts out briefly.
 *
 * **Fleeting on purpose, and nowhere written down.** The pulse lives for the
 * length of one animation and is taken away again at `animationend`, so the
 * mark lives in the running animation and in no field of the component. A
 * lasting mark would be the provenance the model deliberately does not keep
 * (CONTEXT.md, `WinnerRaffle`).
 */
export function showRaffleHit(gridEl, barEl, rank) {
  if (!gridEl) return;
  const tileEl = gridEl.querySelector(`.tile[data-rank="${rank}"]`);
  if (!tileEl) return;

  const delta = hitScrollDelta(
    gridEl.getBoundingClientRect(),
    tileEl.getBoundingClientRect(),
    barEl ? barEl.getBoundingClientRect().top : Infinity,
    parseFloat(getComputedStyle(gridEl).paddingTop) || 0,
  );
  if (delta !== 0) gridEl.scrollTo({ top: gridEl.scrollTop + delta, behavior: 'smooth' });

  startPulse(gridEl, barEl, tileEl);
}

/* The one pulse on screen; a new hit ends the one before it. */
let running = null;

/** Alpine's directives, which a copy of the tile must not carry (see below). */
const DIRECTIVE = /^(x-|:|@)/;

/**
 * Copies the tile's face onto `face`: its classes, its open state and its
 * content, without `data-rank` (nothing that looks for the tile may find the
 * copy) and without Alpine's attributes and templates — the copy stands
 * inside the component, and Alpine would otherwise start evaluating
 * `tile(row)` on it with no `row` in scope.
 */
function copyFace(tileEl, face) {
  face.className = `${tileEl.className.replace(/\btile-pulsing\b/g, ' ').trim()} tile-hit`;
  const open = tileEl.getAttribute('aria-expanded');
  if (open == null) face.removeAttribute('aria-expanded');
  else face.setAttribute('aria-expanded', open);
  const content = tileEl.cloneNode(true);
  for (const template of content.querySelectorAll('template')) template.remove();
  for (const el of content.querySelectorAll('*')) {
    for (const { name } of Array.from(el.attributes)) if (DIRECTIVE.test(name)) el.removeAttribute(name);
  }
  face.replaceChildren(...Array.from(content.childNodes));
}

/**
 * The pulse, drawn **outside the grid's clip** (#168, decision K1,
 * https://github.com/ditshej/tcg-prizing/issues/168#issuecomment-6068726592).
 *
 * The pulse reaches 9.48 px past the tile at its apex (`scale(1.14)` with a
 * 5 px ring) and the grid is a scroller: it clipped the pulse of the top row
 * and of the outer columns, and no padding the stage can give (≤ 8) holds it.
 * `z-index` cannot help — a scroller clips its descendants whatever their
 * stacking. So the pulse runs on a copy of the tile in a layer of its own,
 * beside the grid rather than in it: in the top layer as a manual popover
 * where the browser has one, `position: fixed` where not. The layer stands on
 * the tile's box and is moved there again every frame, so it follows the
 * grid's smooth scroll, a scrolled page and a resize alike; the tile itself
 * is only made transparent meanwhile (`.tile-pulsing`), so a tap still finds
 * it. The layer goes at `animationend`, with a timeout behind it, or when the
 * next hit starts.
 *
 * The values stay the app's own, a deliberate departure from the prototype's
 * hitpulse (proto:741-747) — see `@keyframes tile-hit` in `plan.css`.
 */
function startPulse(gridEl, barEl, tileEl) {
  if (running) running.end();
  const host = gridEl.parentElement;
  if (!host) return;

  const layer = document.createElement('div');
  layer.className = 'tile-pulse';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  const face = document.createElement(tileEl.tagName.toLowerCase());
  if (face.tagName === 'BUTTON') face.type = 'button';
  face.tabIndex = -1;
  copyFace(tileEl, face);
  layer.appendChild(face);

  const place = () => {
    const r = tileEl.getBoundingClientRect();
    const box = gridEl.getBoundingClientRect();
    const win = {
      top: box.top + gridEl.clientTop,
      left: box.left + gridEl.clientLeft,
      bottom: box.top + gridEl.clientTop + gridEl.clientHeight,
      right: box.left + gridEl.clientLeft + gridEl.clientWidth,
    };
    const barTop = barEl ? barEl.getBoundingClientRect().top : Infinity;
    const clip = pulseClip(r, win, barTop, pulseReach(r.width, r.height));
    layer.style.left = `${r.left}px`;
    layer.style.top = `${r.top}px`;
    layer.style.width = `${r.width}px`;
    layer.style.height = `${r.height}px`;
    layer.style.visibility = clip ? '' : 'hidden';
    if (clip) layer.style.clipPath = `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px)`;
  };

  /* The tile can change while it pulses — a hit puts its winner mark on it —
     and the copy follows, without restarting its animation. */
  const observer = typeof MutationObserver === 'undefined' ? null
    : new MutationObserver(() => copyFace(tileEl, face));

  let frame = 0;
  let timer = 0;
  const pulse = {
    layer,
    end() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (observer) observer.disconnect();
      if (layer.matches?.(':popover-open')) layer.hidePopover();
      layer.remove();
      tileEl.classList.remove('tile-pulsing');
      if (running === pulse) running = null;
    },
  };
  running = pulse;

  place();
  host.appendChild(layer);
  if (typeof layer.showPopover === 'function') {
    layer.popover = 'manual';
    layer.showPopover();
  }
  tileEl.classList.add('tile-pulsing');
  if (observer) observer.observe(tileEl, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-expanded'] });

  const follow = () => { place(); frame = requestAnimationFrame(follow); };
  frame = requestAnimationFrame(follow);
  face.addEventListener('animationend', () => pulse.end(), { once: true });
  timer = setTimeout(() => pulse.end(), PULSE_MS + 300);
}

/* ── The fold (#71) ──────────────────────────────────────────────────────── */

/**
 * Reads the app's own box and hands it to `onSize` — once now, and again on
 * every resize. The stage is the app, not the window: above the deck the app
 * stops growing (`max-width`), and the fold has to see what the app is, not
 * what the window is. The arithmetic is `fold()` in `fold.mjs`.
 *
 * **Less the safe areas** (#158). With `viewport-fit=cover` the app's box
 * runs under the notch and the rounded corners, and its edge children — the
 * outermost page, the foot — inset their content by the safe areas
 * (`plan.css`, `--inset-*`). `clientWidth` counts that inset in; handed on as
 * it is, the fold would reckon with a stage up to 2 × 59 px wider than the
 * pages get. So the insets come off here, read from the same custom
 * properties the stylesheet insets with — one source, and one a test can set
 * where the browser reports 0 (`test/ui-shell-insets.test.mjs`).
 *
 * The **bottom inset** does not come off here: it is applied upright only, as
 * a strip under the foot (#158, K4), and whether the foot stands at the bottom
 * is what the fold decides out of this very stage. Taken off by the last
 * fold's `data-flat`, a stage at the edge would be read with the strip the
 * new fold drops, or without the one it adds. So it is handed on as
 * `insetBottom`, and `fold()` reckons it into the bottom foot exactly where
 * the stylesheet paints it — the flat stage keeps its full height.
 */
export function attachStage(appEl, onSize, railEl = null) {
  if (!appEl || typeof ResizeObserver === 'undefined') return () => {};
  const run = () => {
    const inset = safeInsets(appEl);
    const width = appEl.clientWidth - inset.left - inset.right;
    onSize({
      width,
      height: appEl.clientHeight - inset.top,
      insetBottom: inset.bottom,
      railHeight: measureRail(appEl, railEl, width),
    });
  };
  run();
  const observer = new ResizeObserver(run);
  observer.observe(appEl);
  /* The rail's own height changes with what it says (a state word, `cap N`)
     without the app's box moving. A hidden rail reports no change, which is
     right: the probe below measures it then. */
  if (railEl) observer.observe(railEl);
  return () => observer.disconnect();
}

/**
 * The safe-area insets as the stylesheet reads them: `--inset-top`,
 * `--inset-right`, `--inset-bottom`, `--inset-left` on `:root`, registered as
 * lengths so the computed value is pixels and not the `env()` it was written
 * with. A browser without them reads 0, and the box is the stage as it was
 * before #158. The one source for the stage (`attachStage()`) and for the
 * bubbles' frame (`seenFrame()` in `plan.mjs`, #158 B1).
 */
export function safeInsets(el) {
  const style = getComputedStyle(el);
  const read = (name) => parseFloat(style.getPropertyValue(name)) || 0;
  return { top: read('--inset-top'), right: read('--inset-right'), bottom: read('--inset-bottom'), left: read('--inset-left') };
}

/**
 * The rail's height in its **bar** form at the stage width `width` — what the
 * one-column threshold reckons with (#73, run 14, K2 `schiene-gemessen`; the
 * arithmetic is `firstHeightOneColumn()` in `fold.mjs`).
 *
 * Standing as the bar, the rail is read directly. Anywhere else — the stage is
 * flat, the rail stands as a column, another page is in front, fullscreen —
 * it has no bar box to read, and the fold still has to know whether the bar
 * *would* fit. So a probe is measured: a copy of the rail as it is drawn now,
 * stripped of every Alpine attribute and marked `x-ignore`, laid out
 * invisibly at the stage width in the bar form (`.rail-probe` in `plan.css`)
 * and removed again. Remembering the last bar height instead would be stale
 * exactly when it matters: a stage folded flat at one width keeps the height
 * of that width while it is pulled wider.
 *
 * Reads boxes; writes and removes one invisible element. `undefined` where
 * there is no rail, so `fold()` keeps its boot value.
 */
export function measureRail(appEl, railEl, width) {
  if (!railEl) return undefined;
  if (appEl.dataset.rail === 'bar' && !appEl.dataset.fullscreen && railEl.getClientRects().length > 0) {
    return railEl.getBoundingClientRect().height;
  }
  const probe = railEl.cloneNode(true);
  for (const el of [probe, ...probe.querySelectorAll('*')]) {
    for (const { name } of Array.from(el.attributes)) {
      if (name.startsWith('x-') || name.startsWith('@') || name.startsWith(':')) el.removeAttribute(name);
    }
    el.removeAttribute('id');
  }
  probe.removeAttribute('style');
  probe.setAttribute('x-ignore', '');
  probe.setAttribute('aria-hidden', 'true');
  probe.classList.add('rail-probe');
  probe.style.width = `${width}px`;
  appEl.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

/**
 * The scroll fade band (#71 AC 10), one per surface that really scrolls. A
 * band belongs to the surface, not to the stage — a surface cannot say where
 * another one ends — so each scroller gets its own band, laid on its own
 * bottom edge, in its **own** colour looked up off the surface (or, where it
 * is transparent, off its ancestors), and only while there is something
 * below: none where nothing overflows, none once the bottom is reached
 * (`fadeShown()` in `geometry.mjs`).
 *
 * Reads boxes and computed colours; writes the band's position, width and
 * background. `selectors` are looked up afresh on every paint, so a surface
 * that is hidden (`x-show`) simply has no box and no band.
 */
export function attachFades(rootEl, selectors) {
  if (!rootEl) return { paint: () => {}, detach: () => {} };
  const bands = new Map();
  const paint = () => {
    for (const selector of selectors) {
      const box = rootEl.querySelector(selector);
      let band = bands.get(selector);
      if (!band) {
        band = document.createElement('div');
        band.className = 'fade';
        band.setAttribute('aria-hidden', 'true');
        rootEl.appendChild(band);
        bands.set(selector, band);
      }
      const visible = box && box.getClientRects().length > 0;
      const boxStyle = visible ? getComputedStyle(box) : null;
      const paddingBottom = visible ? parseFloat(boxStyle.paddingBottom) || 0 : 0;
      if (!visible || !fadeLeft({
        scrollHeight: box.scrollHeight, clientHeight: box.clientHeight, scrollTop: box.scrollTop, paddingBottom,
      })) { band.style.display = 'none'; continue; }
      const root = rootEl.getBoundingClientRect();
      const r = box.getBoundingClientRect();
      /* Sized off the window less its top padding: the tile grid's is room
         for the ring above its top row (#168) and gives the band nothing.
         The pages' 8 comes off too; they stand above 248 px wherever they
         scroll, so their band stays at the full 60. */
      const height = fadeHeight(box.clientHeight, parseFloat(boxStyle.paddingTop) || 0);
      band.style.display = 'block';
      band.style.left = `${r.left - root.left + box.clientLeft}px`;
      band.style.width = `${box.clientWidth}px`;
      band.style.height = `${height}px`;
      band.style.top = `${r.top - root.top + box.clientTop + box.clientHeight - height}px`;
      band.style.background = `linear-gradient(to bottom, transparent, ${backgroundOf(box)} 62%)`;
    }
  };
  // Scrolling does not bubble, so it is caught on the way down.
  rootEl.addEventListener('scroll', paint, true);
  /* A resize is painted a frame later: the tile grid's column count is
     written by another observer in the same round (`applyGeometry`), and a
     band painted in that round measures the layout the grid is just leaving. */
  let frame = 0;
  const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
  if (observer) observer.observe(rootEl);
  return {
    paint: later,
    detach() {
      rootEl.removeEventListener('scroll', paint, true);
      if (observer) observer.disconnect();
      cancelAnimationFrame(frame);
      for (const band of bands.values()) band.remove();
    },
  };
}

/** The first opaque background colour on the way up from `el`. */
function backgroundOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (colour && colour !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(colour)) return colour;
  }
  return 'transparent';
}
