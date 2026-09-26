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

import { columnsFor, diagramCap } from './geometry.mjs';

/**
 * Measures `stageEl` (the whole Plan column) and `fixedEls` (every fixed part
 * of that column other than the diagram and the tile grid — header, handout
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
export function applyGeometry(stageEl, fixedEls = []) {
  if (!stageEl) return;
  const width = stageEl.clientWidth;
  const height = stageEl.clientHeight;
  const fixedHeight = fixedEls.reduce((sum, el) => sum + (el ? el.getBoundingClientRect().height : 0), 0);

  const style = getComputedStyle(stageEl);
  const gap = parseFloat(style.rowGap || style.gap) || 0;
  const padding = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);
  const gapCount = Math.max(0, stageEl.children.length - 1);
  const overhead = fixedHeight + gap * gapCount + padding;

  stageEl.style.setProperty('--plan-columns', String(columnsFor(width)));
  stageEl.style.setProperty('--diagram-height', `${diagramCap(Math.max(0, height - overhead))}px`);
}

/**
 * Wires `applyGeometry` to run once now and again on every resize of
 * `stageEl`, via `ResizeObserver` — the browser's own measuring loop, not a
 * poll this module would have to own.
 */
export function attachMeasuring(stageEl, fixedEls = []) {
  if (!stageEl || typeof ResizeObserver === 'undefined') return () => {};
  const run = () => applyGeometry(stageEl, fixedEls);
  run();
  const observer = new ResizeObserver(run);
  observer.observe(stageEl);
  return () => observer.disconnect();
}
