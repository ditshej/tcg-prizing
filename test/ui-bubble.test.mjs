import test from 'node:test';
import assert from 'node:assert/strict';

import { GAP, MARGIN, anchorVisible, bubblePosition } from '../public/ui/bubble.mjs';

/** A box as the measuring rind hands it over: the four numbers of a DOMRect. */
const box = (left, top, width, height) => ({ left, top, width, height });

const STAGE = box(0, 100, 400, 600);

test('the bubble hangs under its anchor and is centred on it', () => {
  const anchor = box(100, 200, 54, 54);
  const at = bubblePosition({ anchor, bubble: { width: 180, height: 120 }, stage: STAGE });
  assert.equal(at.flipped, false);
  // Anchor bottom is 254 in the page, 154 in the stage, plus the gap.
  assert.equal(at.top, 154 + GAP);
  // Centre of the anchor is 127, half a bubble is 90.
  assert.equal(at.left, 37);
});

test('it flips upward where there is no room below, rather than leaving the frame', () => {
  // The anchor sits near the stage's bottom edge: 600 tall, the anchor ends at
  // 540 inside it, and a 120 bubble under it would end at 666.
  const anchor = box(100, 586, 54, 54);
  const at = bubblePosition({ anchor, bubble: { width: 180, height: 120 }, stage: STAGE });
  assert.equal(at.flipped, true);
  // Anchor top is 486 in the stage, the bubble sits above it with the gap.
  assert.equal(at.top, 486 - 120 - GAP);
});

test('it stays inside the frame at either edge — it is no overlay and never hangs over one', () => {
  const left = bubblePosition({
    anchor: box(0, 200, 54, 54),
    bubble: { width: 180, height: 120 },
    stage: STAGE,
  });
  assert.equal(left.left, MARGIN);
  const right = bubblePosition({
    anchor: box(346, 200, 54, 54),
    bubble: { width: 180, height: 120 },
    stage: STAGE,
  });
  assert.equal(right.left, 400 - 180 - MARGIN);
});

test('a bubble too tall for the frame is pinned to it rather than flipped out of it', () => {
  const at = bubblePosition({
    anchor: box(100, 660, 54, 54),
    bubble: { width: 180, height: 590 },
    stage: STAGE,
  });
  assert.equal(at.top, MARGIN);
});

test('an anchor scrolled out of the frame closes the bubble — one rule for all its inhabitants', () => {
  // Inside, whole.
  assert.equal(anchorVisible(box(100, 200, 54, 54), STAGE), true);
  // Half over the upper edge is still an anchor one can see.
  assert.equal(anchorVisible(box(100, 70, 54, 54), STAGE), true);
  // Scrolled clear of it, above and below, is not.
  assert.equal(anchorVisible(box(100, 40, 54, 54), STAGE), false);
  assert.equal(anchorVisible(box(100, 700, 54, 54), STAGE), false);
  // And sideways, for the folded layouts where a page slides out of the stage.
  assert.equal(anchorVisible(box(-60, 200, 54, 54), STAGE), false);
  assert.equal(anchorVisible(box(400, 200, 54, 54), STAGE), false);
  // An anchor that is not there at all is not visible either — that is the
  // case where a page switch has taken the tile out of the DOM.
  assert.equal(anchorVisible(null, STAGE), false);
});
