import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fadeHeight, hitScrollDelta } from '../public/ui/geometry.mjs';

/*
 * The open tile's ring lies outside the tile, and the tile grid is a
 * scroller: it clips at its padding box. With no padding
 * at the top and the sides, the ring of the top row and of the outer columns
 * was cut (#168, measured in WebKit and Chromium: 3 px missing at the top,
 * and at the sides too at 360). The prototype's answer (`.gridwin`,
 * proto:748-755): the padding moves onto the scroller itself, with a negative
 * margin against it — the tiles stand where they stood, only the clip edge
 * lies further out. (The raffle hit's pulse reaches further than any padding
 * could hold; it is drawn outside the scroller, `ui-hit-pulse.test.mjs`.)
 */

const css = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `a rule for ${selector}`);
  return match[1].replace(/\/\*[\s\S]*?\*\//g, '');
}

function px(body, property) {
  const match = body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*(-?[\\d.]+)px`));
  assert.ok(match, `${property} in px`);
  return Number(match[1]);
}

const grid = rule('.plan-grid');
const stage = rule('.plan-stage');
const tileOpen = rule(".tile[aria-expanded='true']");

const room = {
  top: px(grid, 'padding-top'),
  right: px(grid, 'padding-right'),
  bottom: px(grid, 'padding-bottom'),
  left: px(grid, 'padding-left'),
};

test('the grid scroller is padded on top and at the sides, and a negative margin of the same size keeps the tiles in place (#168)', () => {
  assert.equal(px(grid, 'margin-top'), -room.top);
  assert.equal(px(grid, 'margin-right'), -room.right);
  assert.equal(px(grid, 'margin-left'), -room.left);
  // The bottom keeps its own few pixels and no margin: the grid's bottom edge
  // is what `raffleCover()` and `raffleScrollPadding()` read, and it stays put.
  assert.equal(room.bottom, 4);
  assert.doesNotMatch(grid, /margin-bottom/);
  assert.doesNotMatch(grid, /(?:^|[;\s])margin:/, 'longhands, so no shorthand sets a bottom margin');
  assert.doesNotMatch(grid, /(?:^|[;\s])padding:/, 'longhands: the raffle bar writes padding-bottom inline (applyRafflePadding)');
});

test('the top padding is at least the prototype\'s 5 px, and no more than the stage gap above the grid (#168)', () => {
  assert.ok(room.top >= 5, `top ${room.top}`);
  assert.ok(room.top <= px(stage, 'gap'), 'the grid does not reach over the legend');
});

test('sideways the padding is what the stage padding gives, never more (#168)', () => {
  // The stage pads 8 at the sides, inside the page's safe-area border (#158):
  // a margin of at most 8 stays on the stage and never under an inset.
  const stagePadding = stage.match(/padding:\s*(\d+)px\s+(\d+)px/);
  assert.ok(stagePadding, 'the stage padding');
  const side = Number(stagePadding[2]);
  assert.equal(side, 8);
  assert.ok(room.left <= side && room.right <= side, `sides ${room.left}/${room.right}`);
  assert.equal(room.left, room.right);
});

test('the open tile\'s ring fits in the scroller\'s padding on all four sides (#168)', () => {
  const ring = px(tileOpen, 'outline') + px(tileOpen, 'outline-offset');
  assert.equal(ring, 3);
  for (const [side, value] of Object.entries(room)) assert.ok(value >= ring, `${side} ${value} < ring ${ring}`);
});

test('the grid\'s wrap is not positioned, so the legend\'s hit areas stay above the grid\'s top padding (#168)', () => {
  // The legend's targets reach 8 px down to where the grid began (#142, 44 × 44).
  // A positioned wrap would paint the grid — padding and all — over them, and a
  // tap there would land on the scroller instead of the fullscreen toggle.
  assert.doesNotMatch(rule('.plan-grid-wrap'), /position:/);
});

test('the prototype passage is named where the padding is set (#168)', () => {
  assert.match(css, /proto:748-755/);
});

test('the hit counts as in view only below the top padding, as before the padding came (#168)', () => {
  const window = { top: 100, bottom: 500 };
  const padded = { top: 92, bottom: 500 };
  const tile = { top: 96, bottom: 150, height: 54 };
  assert.equal(hitScrollDelta(padded, tile, Infinity, 8), hitScrollDelta(window, tile));
  assert.notEqual(hitScrollDelta(padded, tile, Infinity, 8), 0);
  assert.equal(hitScrollDelta(padded, { top: 100, bottom: 154, height: 54 }, Infinity, 8), 0);
});

test('the fade band is sized off the window under the top padding, so the padding changes no band (#168)', () => {
  // The flat 852 × 393 stage: 144 px of tile window, a band of 36 before #168.
  assert.equal(fadeHeight(144 + 8, 8), fadeHeight(144));
  assert.equal(fadeHeight(144 + 8, 8), 36);
  assert.equal(fadeHeight(331 + 8, 8), 60);
});
