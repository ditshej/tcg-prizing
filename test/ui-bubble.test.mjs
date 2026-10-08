import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { planApp } from '../public/ui/plan.mjs';
import { GAP, MARGIN, anchorVisible, bubblePosition, placeInFrame, visibleBox, visibleFrame } from '../public/ui/bubble.mjs';

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

/*
 * The frame is what can be seen, not what is laid out (#154). iOS zooms in on
 * a quick double tap and on a pinch, and then the visual viewport is a
 * shifted, smaller window over the layout one. A bubble clamped into the
 * layout viewport (or into the stage) still hangs over the visible edge. So
 * every placing judges against the stage cut down to what is visible, and
 * hands back coordinates in its own positioning box.
 */

test('the visible box is the visual viewport, in the layout viewport\'s coordinates', () => {
  // Zoomed ×2 into a 400 × 800 page and panned 150 right, 300 down.
  const visible = visibleBox({ offsetLeft: 150, offsetTop: 300, width: 200, height: 400 }, box(0, 0, 400, 800));
  assert.deepEqual(visible, box(150, 300, 200, 400));
  // Without a visual viewport at all, what is laid out is what is seen.
  assert.deepEqual(visibleBox(undefined, box(0, 0, 400, 800)), box(0, 0, 400, 800));
});

test('a fixed bubble stays inside a shifted and shrunk visible frame', () => {
  // The positioning box of `position: fixed` is the layout viewport.
  const layout = box(0, 0, 400, 800);
  const visible = box(150, 300, 200, 400);
  // An anchor at the visible window's right edge: centred, the bubble would
  // run to 372 + 90 = 462 — inside the layout viewport's 392, but 112 past
  // the visible edge at 350.
  const at = placeInFrame({
    anchor: box(330, 320, 20, 20),
    bubble: { width: 180, height: 120 },
    box: layout,
    visible,
  });
  assert.equal(at.left, 350 - 180 - MARGIN);
  assert.equal(at.top, 340 + GAP);
  // And at its left edge, the near margin is the visible one, not 8.
  const left = placeInFrame({ anchor: box(150, 320, 20, 20), bubble: { width: 180, height: 120 }, box: layout, visible });
  assert.equal(left.left, 150 + MARGIN);
});

test('it flips against the visible bottom, not against the layout one', () => {
  // 120 under an anchor ending at 640 would end at 766 — inside the layout
  // viewport's 800, below the visible 700.
  const at = placeInFrame({
    anchor: box(200, 620, 20, 20),
    bubble: { width: 180, height: 120 },
    box: box(0, 0, 400, 800),
    visible: box(150, 300, 200, 400),
  });
  assert.equal(at.flipped, true);
  assert.equal(at.top, 620 - 120 - GAP);
});

test('an absolute bubble gets the stage cut down to the visible part, in stage coordinates', () => {
  // The stage runs 0…400 × 100…700; the visible window 150…350 × 300…700.
  // The frame is their overlap, 150…350 × 300…700, and the answer is measured
  // from the stage's own corner, because that is what `left`/`top` mean
  // inside it.
  const at = placeInFrame({
    anchor: box(330, 320, 20, 20),
    bubble: { width: 180, height: 120 },
    box: STAGE,
    visible: box(150, 300, 200, 400),
  });
  assert.equal(at.left, 350 - 180 - MARGIN - 0);
  assert.equal(at.top, 340 + GAP - 100);
});

test('unzoomed, the frame is the box and the answer is bubblePosition()\'s', () => {
  const args = { anchor: box(346, 200, 54, 54), bubble: { width: 180, height: 120 } };
  assert.deepEqual(
    placeInFrame({ ...args, box: STAGE, visible: box(0, 0, 1000, 1000) }),
    bubblePosition({ ...args, stage: STAGE }),
  );
});

test('the visible frame is what an anchor has to be inside to count as visible', () => {
  const frame = visibleFrame(box(0, 100, 400, 600), box(150, 300, 200, 400));
  assert.deepEqual(frame, box(150, 300, 200, 400));
  assert.equal(anchorVisible(box(100, 320, 40, 40), frame), false, 'panned out to the left');
  assert.equal(anchorVisible(box(140, 320, 40, 40), frame), true, 'half in sight');
  // Frames that do not meet leave nothing, and nothing in nothing is visible.
  const none = visibleFrame(box(0, 0, 100, 100), box(200, 200, 50, 50));
  assert.equal(none.width, 0);
  assert.equal(anchorVisible(box(10, 10, 20, 20), none), false);
});

/*
 * The shell's half (#154): every `place*` of `planApp()` reads the visible
 * frame off `window.visualViewport` — the rind — and hands it to the
 * arithmetic above. Driven with the browser stubbed down to boxes: a layout
 * viewport of 400 × 800, zoomed ×2 and panned to 150…350 × 300…700. Unstubbed,
 * desktop Chromium never has `scale > 1`, so this is where the point of the
 * ticket is held; the picture is #121's.
 */

const LAYOUT = { innerWidth: 400, innerHeight: 800 };
const ZOOMED = { offsetLeft: 150, offsetTop: 300, width: 200, height: 400, scale: 2 };

/** An element as the placings use it: a box, two sizes, a style to write. */
function element(rect, { width = 0, height = 0, frame = null, children = {} } = {}) {
  return {
    getBoundingClientRect: () => rect,
    offsetWidth: width,
    offsetHeight: height,
    style: {},
    closest: (selector) => (selector === '[data-bubble-frame]' ? frame : null),
    querySelector: (selector) => children[selector] ?? null,
  };
}

/** Runs `fn` with `window` and `document` stubbed, then puts them back. */
function inBrowser(elements, fn) {
  const saved = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { ...LAYOUT, visualViewport: ZOOMED };
  globalThis.document = {
    documentElement: { clientWidth: 400, clientHeight: 800 },
    querySelector: (selector) => elements[selector] ?? null,
  };
  try {
    return fn();
  } finally {
    for (const key of ['window', 'document']) {
      if (saved[key] === undefined) delete globalThis[key];
      else globalThis[key] = saved[key];
    }
  }
}

const shell = () => planApp({ read: () => '', write: () => {} });

test('Share\'s bubble is placed inside the visible window, not the layout one', () => {
  const bubble = element(box(0, 0, 180, 40), { width: 180, height: 40 });
  inBrowser({ '[data-share-bubble]': bubble, '[data-share]': element(box(330, 320, 20, 20)) }, () => {
    shell().placeShare();
  });
  assert.equal(bubble.style.left, `${350 - 180 - MARGIN}px`);
  assert.equal(bubble.style.top, `${340 + GAP}px`);
});

test('the reset question is placed inside the visible window, and closes when its button is panned out of it', () => {
  const details = element(box(0, 0, 400, 800));
  const bubble = element(box(0, 0, 180, 120), { width: 180, height: 120 });
  const app = shell();
  app.confirmDrop = { keys: ['players'], anchor: '[data-drop-all]', bubble: '[data-drop-bubble]' };
  inBrowser({ '[data-drop-bubble]': bubble, '[data-drop-all]': element(box(330, 320, 20, 20), { frame: details }) }, () => {
    app.placeConfirm();
  });
  assert.equal(bubble.style.left, `${350 - 180 - MARGIN}px`);
  assert.notEqual(app.confirmDrop, null);
  inBrowser({ '[data-drop-bubble]': bubble, '[data-drop-all]': element(box(100, 320, 20, 20), { frame: details }) }, () => {
    app.placeConfirm();
  });
  assert.equal(app.confirmDrop, null, 'its anchor lies left of the visible window');
});

test('the tile bubble is placed inside the visible part of the stage, in stage coordinates', () => {
  const tile = element(box(330, 320, 20, 20));
  const app = shell();
  const bubble = element(box(0, 0, 180, 120), { width: 180, height: 120 });
  app.$refs = {
    stage: element(STAGE),
    bubble,
    grid: element(box(0, 150, 400, 500), { children: { '.tile[data-rank="3"]': tile } }),
  };
  app.openTile = 3;
  inBrowser({}, () => app.placeBubble());
  assert.equal(app.openTile, 3);
  assert.equal(bubble.style.left, `${350 - 180 - MARGIN}px`);
  assert.equal(bubble.style.top, `${340 + GAP - STAGE.top}px`);
});

test('an ⓘ opens as a bubble at its own button, inside the visible window', () => {
  const details = element(box(0, 0, 400, 800));
  // 160 wide: at ×2, the visible window is 200, and a bubble wider than it
  // has no place that keeps both margins (see `inside()` — the left one wins).
  const bubble = element(box(0, 0, 160, 140), { width: 160, height: 140 });
  const app = shell();
  app.toggleInfo('game');
  inBrowser({ '[data-info-bubble="game"]': bubble, '[data-info="game"]': element(box(320, 320, 22, 22), { frame: details }) }, () => {
    app.placeInfo();
  });
  assert.equal(app.openInfo, 'game');
  assert.equal(bubble.style.left, `${350 - 160 - MARGIN}px`);
  assert.equal(bubble.style.top, `${342 + GAP}px`);
});

test('the ⓘ bubble closes when its button scrolls out of Details', () => {
  const details = element(box(0, 300, 400, 400));
  const app = shell();
  app.toggleInfo('type');
  inBrowser({
    '[data-info-bubble="type"]': element(box(0, 0, 260, 140), { width: 260, height: 140 }),
    '[data-info="type"]': element(box(200, 260, 22, 22), { frame: details }),
  }, () => app.placeInfo());
  assert.equal(app.openInfo, null);
});

test('one bubble at a time: the ⓘ, the tile and the question put each other out', () => {
  const app = shell();
  app.toggleTile(3);
  app.toggleInfo('game');
  assert.equal(app.openTile, null, 'the ⓘ closes the tile bubble');
  app.toggleTile(3);
  assert.equal(app.openInfo, null, 'the tile closes the ⓘ');
  app.confirmDrop = { keys: ['players'], anchor: '[data-drop-all]', bubble: '[data-drop-bubble]' };
  app.toggleInfo('type');
  assert.equal(app.confirmDrop, null, 'the ⓘ answers the question with no');
  app.confirmDrop = { keys: ['players'], anchor: '[data-drop-all]', bubble: '[data-drop-bubble]' };
  app.toggleTile(4);
  assert.equal(app.confirmDrop, null, 'so does the tile');
  assert.equal(app.openInfo, null);
  app.toggleInfo('type');
  app.closeInfo();
  assert.equal(app.openInfo, null);
});

/*
 * The form, held on the stylesheet and the markup as text (#154). Where it
 * lands on a screen is the acceptance by image's; what it is made of is
 * checkable here.
 */

const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8').replace(/\/\*[^]*?\*\//g, '');
const SHEET = readFileSync(new URL('../views/controls-sheet.php', import.meta.url), 'utf8');

/** The declarations of every rule whose selector list is exactly `head`. */
function declarations(head) {
  const found = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, h]) => h.split(',').map((x) => x.trim()).join(',') === head)
    .map(([, , body]) => body);
  assert.ok(found.length > 0, `${head} is in the stylesheet`);
  return found.join(';');
}

test('a double tap zooms no control, and pinch zoom stays', () => {
  const rule = [...CSS.matchAll(/([^{}]+)\{([^{}]*touch-action[^{}]*)\}/g)];
  assert.equal(rule.length, 1, 'one rule says it');
  const [, head, body] = rule[0];
  assert.match(body, /touch-action:\s*manipulation;/);
  // Every pressable thing is real markup — the tiles, the ±, the chips and
  // the head buttons are all <button>s — so the elements are the list.
  for (const selector of ['button', 'a', 'input', 'select', 'label', '.counter']) {
    assert.ok(head.includes(selector), selector);
  }
  assert.doesNotMatch(CSS, /maximum-scale|user-scalable/);
});

test('the ⓘ\'s sentence floats as the bubble, at most 292 wide, and pushes nothing', () => {
  const body = declarations('.set-info');
  assert.match(body, /position:\s*fixed;/);
  assert.match(body, /z-index:\s*38;/);
  assert.match(body, /max-width:\s*292px;/);
  assert.doesNotMatch(body, /margin/);
});

test('each ⓘ is the anchor of its own bubble, placed by placeInfo()', () => {
  for (const id of ['game', 'type']) {
    assert.match(SHEET, new RegExp(`class="info" data-info="${id}" @click="toggleInfo\\('${id}'\\)"`));
    assert.match(SHEET, new RegExp(`class="set-info" data-info-bubble="${id}"`));
  }
  assert.equal(SHEET.match(/\$nextTick\(\(\) => placeInfo\(\)\)/g).length, 2);
  assert.equal(SHEET.match(/@keydown\.escape\.window="closeInfo\(\)"/g).length, 2);
});

test('the content of the ⓘ is unchanged, the Discord link included', () => {
  assert.match(SHEET, /<a href="<\?= htmlspecialchars\(require __DIR__ \. '\/discord-profile\.php'\) \?>" target="_blank"\s+rel="noreferrer"><strong>ditshej<\/strong><\/a>/);
  assert.match(SHEET, /built for One Piece, other games welcome/);
  assert.match(SHEET, /<strong>Tournament type<\/strong>/);
  assert.match(SHEET, /Values you set by\s+hand stay where you put them\./);
});

test('in the tile\'s bubble the number stands in the middle of its counter', () => {
  const body = declarations('.bubble .counter-value');
  assert.match(body, /display:\s*grid;/);
  assert.match(body, /place-items:\s*center;/);
});
