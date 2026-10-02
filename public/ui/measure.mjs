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

import { diagramCap, fadeHeight, fadeShown as fadeLeft, hitScrollDelta, raffleCover, raffleLift, raffleScrollPadding, tileColumnsFor } from './geometry.mjs';

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
 * Reads: `clientWidth`/`clientHeight`, `getBoundingClientRect().height`,
 * computed `gap`/`padding`. Writes: `style.setProperty`. Nothing else — no
 * plan logic, no state.
 */
export function applyGeometry(stageEl, fixedEls = [], barEl = null) {
  if (!stageEl) return;
  const width = stageEl.clientWidth;
  const height = stageEl.clientHeight;
  const fixedHeight = fixedEls.reduce((sum, el) => sum + (el ? el.getBoundingClientRect().height : 0), 0);

  const style = getComputedStyle(stageEl);
  const gap = parseFloat(style.rowGap || style.gap) || 0;
  const padding = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);
  /* Only the children that actually render pay for a gap. Fullscreen hides
     several of them (`x-show` → `display: none`), and counting those would
     charge the leftover for gaps the browser never draws — pixels the tile
     grid would then not get. */
  const visibleChildren = Array.from(stageEl.children)
    .filter((el) => el.getClientRects().length > 0).length;
  const gapCount = Math.max(0, visibleChildren - 1);
  const overhead = fixedHeight + gap * gapCount + padding;

  /* The tiles get the content box, not the client box: `clientWidth` counts
     the stage's side padding, and at a width where that padding decides a
     column (412px on the flat 812 × 375 stage) the grid got seven columns for
     a box that holds six, and its first tile was cut at the left edge (#71). */
  const sides = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
  stageEl.style.setProperty('--plan-columns', String(tileColumnsFor(width - sides)));
  /* An open raffle bar over the tile window takes its overlap off the
     diagram (#73, K1). A bar whose page is hidden has no box and covers
     nothing. */
  const gridEl = stageEl.querySelector('.plan-grid');
  const bar = barEl && barEl.getClientRects().length > 0 ? barEl.getBoundingClientRect() : null;
  const covered = gridEl ? raffleCover(gridEl.getBoundingClientRect(), bar) : 0;
  stageEl.style.setProperty('--diagram-height', `${diagramCap(Math.max(0, height - overhead), undefined, covered)}px`);
}

/**
 * Wires `applyGeometry` to run once now and again on every resize of
 * `stageEl`, via `ResizeObserver` — the browser's own measuring loop, not a
 * poll this module would have to own.
 */
export function attachMeasuring(stageEl, fixedEls = [], barOf = () => null) {
  if (!stageEl || typeof ResizeObserver === 'undefined') return () => {};
  const run = () => applyGeometry(stageEl, fixedEls, barOf());
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
 * The retraction list as the flat stage pages it (#129): every chip's width,
 * the row's width and the gap between chips — `takeBackPages()` in
 * `raffle.mjs` makes the pages out of them, under `node --test`.
 *
 * The chips not on the page in front are hidden (`x-show`), and a hidden
 * chip has no box. So, like the rail's probe, a copy of the list is measured:
 * stripped of every Alpine attribute, every chip shown, laid out invisibly in
 * one unwrapped row at the list's own width (`.takeback-probe` in
 * `plan.css`), and removed again. `null` where there is no list.
 *
 * Reads boxes and the computed gap; writes and removes one invisible element.
 */
export function measureTakeBack(listEl) {
  if (!listEl || listEl.getClientRects().length === 0) return null;
  const probe = listEl.cloneNode(true);
  for (const el of [probe, ...probe.querySelectorAll('*')]) {
    for (const { name } of Array.from(el.attributes)) {
      if (name.startsWith('x-') || name.startsWith('@') || name.startsWith(':')) el.removeAttribute(name);
    }
    el.removeAttribute('style');
    el.removeAttribute('id');
  }
  for (const template of probe.querySelectorAll('template')) template.remove();
  probe.setAttribute('x-ignore', '');
  probe.setAttribute('aria-hidden', 'true');
  probe.classList.add('takeback-probe');
  probe.style.width = `${listEl.clientWidth}px`;
  listEl.parentElement.appendChild(probe);
  const widths = Array.from(probe.children).map((chip) => chip.getBoundingClientRect().width);
  const gap = parseFloat(getComputedStyle(probe).columnGap) || 0;
  probe.remove();
  return { widths, rowWidth: listEl.clientWidth, gap };
}

/**
 * Shows a hit over the two fleeting channels (#69 AC 10): the grid scrolls to
 * the tile — into the middle of the free strip, and not at all when it is
 * already in it — and the tile lifts out briefly.
 *
 * **Fleeting on purpose, and nowhere written down.** The class is put on for
 * the length of one animation and taken off again at `animationend`, so the
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
  );
  if (delta !== 0) gridEl.scrollTo({ top: gridEl.scrollTop + delta, behavior: 'smooth' });

  /* Taken off and put back on with a reflow in between, or a second hit on
     the same tile would find the class already there and run nothing. */
  tileEl.classList.remove('tile-hit');
  void tileEl.offsetWidth;
  tileEl.classList.add('tile-hit');
  tileEl.addEventListener('animationend', () => tileEl.classList.remove('tile-hit'), { once: true });
}

/* ── The fold (#71) ──────────────────────────────────────────────────────── */

/**
 * Reads the app's own box and hands it to `onSize` — once now, and again on
 * every resize. The stage is the app, not the window: above the deck the app
 * stops growing (`max-width`), and the fold has to see what the app is, not
 * what the window is. The arithmetic is `fold()` in `fold.mjs`.
 */
export function attachStage(appEl, onSize, railEl = null) {
  if (!appEl || typeof ResizeObserver === 'undefined') return () => {};
  const run = () => {
    const width = appEl.clientWidth;
    onSize({ width, height: appEl.clientHeight, railHeight: measureRail(appEl, railEl, width) });
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
      const paddingBottom = visible ? parseFloat(getComputedStyle(box).paddingBottom) || 0 : 0;
      if (!visible || !fadeLeft({
        scrollHeight: box.scrollHeight, clientHeight: box.clientHeight, scrollTop: box.scrollTop, paddingBottom,
      })) { band.style.display = 'none'; continue; }
      const root = rootEl.getBoundingClientRect();
      const r = box.getBoundingClientRect();
      const height = fadeHeight(box.clientHeight);
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
