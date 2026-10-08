import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PULSE_MS, PULSE_RING_MAX, PULSE_SCALE, pulseClip, pulseReach } from '../public/ui/geometry.mjs';
import { attachFades, showRaffleHit } from '../public/ui/measure.mjs';

/*
 * The raffle hit's pulse, and where it is drawn (#168, decision K1,
 * https://github.com/ditshej/tcg-prizing/issues/168#issuecomment-6068726592).
 *
 * The pulse stays as the app had it — `scale(1.14)` at 35 %, a 5 px ring,
 * 900 ms, once — a deliberate departure from the prototype's hitpulse
 * (proto:741-747: 1.11, .85s, three times). It reaches 9.48 px past the tile,
 * more than the grid's padding can hold, and the grid is a scroller: it cut
 * the pulse of the top row and of the outer columns. So the pulse runs on a
 * copy of the tile in a layer outside the scroller, which follows the tile
 * every frame and goes when the animation ends.
 *
 * And the wiring of the scroller's top padding into the two measures that
 * read it (B18, Review 2): the functions are proven in `ui-grid-ring`, these
 * tests prove the call sites hand the padding in.
 */

const css = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const measureSource = readFileSync(new URL('../public/ui/measure.mjs', import.meta.url), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `a rule for ${selector}`);
  return match[1].replace(/\/\*[\s\S]*?\*\//g, '');
}

function keyframes(name) {
  const start = css.indexOf(`@keyframes ${name} {`);
  assert.ok(start >= 0, `@keyframes ${name}`);
  const body = css.slice(start, css.indexOf('\n}\n', start));
  const frames = {};
  for (const [, at, decl] of body.matchAll(/(\d+)%\s*\{([^}]*)\}/g)) frames[at] = decl.replace(/\s+/g, ' ').trim();
  return frames;
}

/* ── A small DOM, as much of it as the rind touches ───────────────────── */

class FakeElement {
  constructor(tagName, { rect = null, attributes = {}, className = '' } = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this._attributes = new Map(Object.entries(attributes));
    this.className = className;
    this.childNodes = [];
    this.parentElement = null;
    this.style = {};
    this.listeners = {};
    this.rect = rect;
    this.scrollTop = 0;
    this.scrolledTo = [];
  }

  get attributes() { return Array.from(this._attributes, ([name, value]) => ({ name, value })); }
  get dataset() { return { rank: this._attributes.get('data-rank') }; }
  get isConnected() { return this.parentElement != null; }
  get firstElementChild() { return this.childNodes[0] ?? null; }
  get classList() {
    const el = this;
    const list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      add: (name) => { if (!list().includes(name)) el.className = [...list(), name].join(' '); },
      remove: (name) => { el.className = list().filter((n) => n !== name).join(' '); },
      contains: (name) => list().includes(name),
    };
  }

  getAttribute(name) { return this._attributes.has(name) ? this._attributes.get(name) : null; }
  setAttribute(name, value) { this._attributes.set(name, String(value)); }
  removeAttribute(name) { this._attributes.delete(name); }

  appendChild(child) {
    if (child.parentElement) child.remove();
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }
  replaceChildren(...children) {
    for (const child of this.childNodes) child.parentElement = null;
    this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  contains(other) {
    for (let node = other; node; node = node.parentElement) if (node === this) return true;
    return false;
  }

  descendants() { return this.childNodes.flatMap((c) => [c, ...c.descendants()]); }
  querySelectorAll(selector) {
    if (selector === '*') return this.descendants();
    if (selector === 'template') return this.descendants().filter((el) => el.tagName === 'TEMPLATE');
    const rank = selector.match(/^\.tile\[data-rank="(\d+)"\]$/);
    if (rank) return this.descendants().filter((el) => el.classList.contains('tile') && el.getAttribute('data-rank') === rank[1]);
    if (selector.startsWith('.')) return this.descendants().filter((el) => el.classList.contains(selector.slice(1)));
    throw new Error(`no fake for ${selector}`);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  cloneNode() {
    const copy = new FakeElement(this.tagName, { attributes: Object.fromEntries(this._attributes), className: this.className });
    for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
    return copy;
  }

  getBoundingClientRect() {
    const r = this.rect ?? { left: 0, top: 0, width: 0, height: 0 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height };
  }
  getClientRects() { return this.rect ? [this.rect] : []; }

  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener); }
  dispatch(type) { for (const listener of this.listeners[type] ?? []) listener({ type }); }

  scrollTo({ top }) { this.scrolledTo.push(top); this.scrollTop = top; }
}

/** A popover-capable layer element, as the browser gives it. */
class FakePopoverElement extends FakeElement {
  constructor(tagName) { super(tagName); this.open = false; this.popover = null; }
  showPopover() { this.open = true; }
  hidePopover() { this.open = false; }
  matches(selector) { return selector === ':popover-open' && this.open; }
}

/**
 * The grid and its wrap, with one tile in the top row as Alpine renders it —
 * directives on it, an `x-if` template inside — and the browser globals the
 * rind calls, with frames run by hand.
 */
function scene({ paddingTop = 8, popover = true, gridRect = { left: 0, top: 92, width: 377, height: 408 }, tileRect = { left: 22, top: 100, width: 54, height: 54 } } = {}) {
  const wrap = new FakeElement('div', { className: 'plan-grid-wrap' });
  const grid = new FakeElement('div', { className: 'plan-grid', rect: gridRect });
  Object.assign(grid, { clientTop: 0, clientLeft: 0, clientWidth: gridRect.width, clientHeight: gridRect.height });
  wrap.appendChild(grid);
  const tile = new FakeElement('button', {
    className: 'tile tile-flagged',
    rect: { ...tileRect },
    attributes: { type: 'button', 'data-rank': '1', 'aria-expanded': 'true', 'aria-label': 'Rank 1', ':class': 'tile(row).classes', '@click': 'toggleTile(row.rank)' },
  });
  const rank = new FakeElement('span', { className: 'tile-rank', attributes: { 'x-text': 'row.rank' } });
  rank.appendChild(Object.assign(new FakeElement('#text'), { nodeType: 3 }));
  tile.appendChild(rank);
  tile.appendChild(new FakeElement('template', { attributes: { 'x-if': 'row.winners === 1' } }));
  tile.appendChild(new FakeElement('span', { className: 'mark mark-winner dot' }));
  grid.appendChild(tile);

  const frames = [];
  globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
  globalThis.cancelAnimationFrame = (id) => { if (id > 0) frames[id - 1] = null; };
  globalThis.getComputedStyle = () => ({ paddingTop: `${paddingTop}px`, paddingBottom: '4px', backgroundColor: 'rgb(1, 2, 3)' });
  globalThis.document = { createElement: (tag) => (popover ? new FakePopoverElement(tag) : new FakeElement(tag)) };
  delete globalThis.MutationObserver;

  const frame = () => {
    const queued = frames.splice(0);
    for (const callback of queued) if (callback) callback();
  };
  const layer = () => wrap.querySelector('.tile-pulse');
  return { wrap, grid, tile, frame, layer };
}

/* ── The decided pulse ───────────────────────────────────────────────── */

test('the pulse keeps the app\'s values: scale(1.14) and a 5 px ring at 35 %, 900 ms, once (#168, K1)', () => {
  const frames = keyframes('tile-hit');
  assert.match(frames[35], /transform:\s*scale\(1\.14\)/);
  assert.match(frames[35], /0 0 0 5px var\(--accent\)/);
  assert.match(frames[0], /transform:\s*none/);
  assert.match(frames[100], /transform:\s*none/);
  assert.match(frames[100], /0 0 0 11px transparent/);
  // One iteration: no count, no `infinite` — the prototype's `3` is not taken over.
  assert.match(rule('.tile-hit'), /animation:\s*tile-hit 900ms ease-out;/);
});

test('the numbers the rind reckons with are the keyframes\' own (#168)', () => {
  const frames = keyframes('tile-hit');
  assert.equal(Number(frames[35].match(/scale\(([\d.]+)\)/)[1]), PULSE_SCALE);
  assert.equal(Number(frames[100].match(/0 0 0 (\d+)px transparent/)[1]), PULSE_RING_MAX);
  assert.equal(Number(rule('.tile-hit').match(/(\d+)ms/)[1]), PULSE_MS);
});

test('the departure from the prototype is named as a decision, at the keyframes and at the overlay (#168, K1)', () => {
  const at = css.slice(css.lastIndexOf('/*', css.indexOf('@keyframes tile-hit')), css.indexOf('@keyframes tile-hit'));
  assert.match(at, /deliberate departure from the prototype/);
  assert.match(at, /proto:741-747/);
  assert.match(at, /K1/);
  assert.match(at, /issues\/168#issuecomment-6068726592/);
  assert.match(measureSource, /decision K1,\s*\n\s*\*\s*https:\/\/github\.com\/ditshej\/tcg-prizing\/issues\/168#issuecomment-6068726592/);
  assert.match(measureSource, /hitpulse \(proto:741-747\)/);
});

test('reduced motion still shortens the pulse to a blink, and the layer goes with it (#168)', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .tile-hit'));
  assert.match(block, /^@media \(prefers-reduced-motion: reduce\) \{\s*\.tile-hit \{\s*animation-duration: 1ms;/);
});

test('the layer is the popover box undone: fixed, unclipped, never a target; the tile under it only fades out (#168)', () => {
  const layer = rule('.tile-pulse');
  assert.match(layer, /position:\s*fixed/);
  assert.match(layer, /overflow:\s*visible/, 'the UA popover scrolls its overflow, which would cut the pulse again');
  assert.match(layer, /pointer-events:\s*none/);
  assert.match(layer, /margin:\s*0/);
  assert.match(layer, /inset:\s*auto/);
  assert.match(layer, /border:\s*0/);
  assert.match(layer, /background:\s*none/);
  assert.match(rule('.tile-pulse > .tile'), /height:\s*100%/);
  assert.match(rule('.tile.tile-pulsing'), /opacity:\s*0/);
  assert.doesNotMatch(rule('.tile.tile-pulsing'), /visibility|pointer-events|display/, 'the tile stays tappable');
});

/* ── The layer outside the scroller ──────────────────────────────────── */

test('the hit\'s pulse runs on a copy of the tile beside the grid, not in it (#168)', () => {
  const { wrap, grid, tile, layer } = scene();
  showRaffleHit(grid, null, 1);
  const pulse = layer();
  assert.ok(pulse, 'a layer');
  assert.equal(pulse.parentElement, wrap);
  assert.ok(!grid.contains(pulse), 'outside the scroller');
  assert.equal(pulse.getAttribute('aria-hidden'), 'true');
  assert.equal(pulse.inert, true);
  assert.equal(pulse.popover, 'manual');
  assert.equal(pulse.open, true, 'shown in the top layer');

  const face = pulse.firstElementChild;
  assert.equal(face.tagName, 'BUTTON');
  assert.equal(face.className, 'tile tile-flagged tile-hit');
  assert.equal(face.getAttribute('aria-expanded'), 'true', 'an open tile pulses with its ring');
  assert.equal(face.getAttribute('data-rank'), null, 'nothing that looks for the tile finds the copy');
  assert.equal(face.tabIndex, -1);
  assert.deepEqual(face.childNodes.map((c) => c.className), ['tile-rank', 'mark mark-winner dot'], 'the template is gone');
  for (const el of face.descendants()) for (const { name } of el.attributes) assert.doesNotMatch(name, /^(x-|:|@)/);

  assert.ok(tile.classList.contains('tile-pulsing'));
  assert.ok(!tile.classList.contains('tile-hit'), 'the tile in the grid does not pulse itself');
});

test('without a popover the layer stands as position: fixed and nothing else changes (#168)', () => {
  const { grid, layer } = scene({ popover: false });
  showRaffleHit(grid, null, 1);
  assert.ok(layer());
  assert.equal(layer().popover, undefined);
});

test('the layer stands on the tile\'s box and follows it every frame — grid scroll, page scroll, resize (#168)', () => {
  const { grid, tile, frame, layer } = scene();
  showRaffleHit(grid, null, 1);
  const at = () => ['left', 'top', 'width', 'height'].map((k) => layer().style[k]);
  assert.deepEqual(at(), ['22px', '100px', '54px', '54px']);

  tile.rect = { left: 22, top: 70, width: 54, height: 54 }; // the grid scrolled 30
  frame();
  assert.deepEqual(at(), ['22px', '70px', '54px', '54px']);

  tile.rect = { left: 8, top: 60, width: 53.17, height: 54 }; // a resize to 360
  grid.rect = { left: 0, top: 52, width: 360, height: 408 };
  frame();
  assert.deepEqual(at(), ['8px', '60px', '53.17px', '54px']);
});

test('the layer\'s clip reaches past the grid on every side by the pulse\'s reach (#168)', () => {
  const { grid, layer } = scene();
  showRaffleHit(grid, null, 1);
  const reach = pulseReach(54, 54);
  // Grid 0..377 × 92..500, tile 22..76 × 100..154.
  assert.equal(layer().style.clipPath, `inset(${92 - reach - 100}px ${76 - (377 + reach)}px ${154 - (500 + reach)}px ${0 - reach - 22}px)`);
  assert.equal(layer().style.visibility, '');
});

test('it goes at animationend, and the tile comes back (#168)', () => {
  const { grid, tile, frame, layer } = scene();
  showRaffleHit(grid, null, 1);
  const pulse = layer();
  pulse.firstElementChild.dispatch('animationend');
  assert.equal(layer(), null);
  assert.equal(pulse.open, false, 'out of the top layer');
  assert.ok(!tile.classList.contains('tile-pulsing'));
  tile.rect = { left: 0, top: 0, width: 54, height: 54 };
  frame();
  assert.equal(pulse.style.top, '100px', 'no frame moves it any more');
});

test('it goes after the timeout too, where no animationend comes (#168)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { grid, tile, layer } = scene();
    showRaffleHit(grid, null, 1);
    mock.timers.tick(PULSE_MS);
    assert.ok(layer(), 'not before the animation has run');
    mock.timers.tick(300);
    assert.equal(layer(), null);
    assert.ok(!tile.classList.contains('tile-pulsing'));
  } finally {
    mock.timers.reset();
  }
});

test('a new hit ends the running pulse first: one layer, on the new tile (#168)', () => {
  const { grid, tile, layer, wrap } = scene();
  showRaffleHit(grid, null, 1);
  const first = layer();
  showRaffleHit(grid, null, 1);
  assert.equal(wrap.querySelectorAll('.tile-pulse').length, 1);
  assert.notEqual(layer(), first);
  assert.ok(tile.classList.contains('tile-pulsing'));
  layer().firstElementChild.dispatch('animationend');
});

test('the pulse is not drawn for a tile outside the window, and stays under the raffle bar (#168)', () => {
  const below = scene({ tileRect: { left: 22, top: 520, width: 54, height: 54 } });
  showRaffleHit(below.grid, null, 1);
  assert.equal(below.layer().style.visibility, 'hidden');
  below.layer().firstElementChild.dispatch('animationend');

  const bar = new FakeElement('div', { rect: { left: 0, top: 300, width: 393, height: 120 } });
  const under = scene({ tileRect: { left: 22, top: 270, width: 54, height: 54 } });
  showRaffleHit(under.grid, bar, 1);
  const inset = under.layer().style.clipPath.match(/-?[\d.]+/g).map(Number);
  assert.equal(inset[2], 324 - 300, 'cut at the bar\'s top edge');
  under.layer().firstElementChild.dispatch('animationend');
});

/* ── pulseReach / pulseClip ─────────────────────────────────────────── */

test('the reach bounds the pulse: past the apex\'s 9.48 for a 54 px tile, and grows with a reserved tile (#168)', () => {
  const apex = (27 + 5) * PULSE_SCALE - 27;
  assert.equal(+apex.toFixed(2), 9.48);
  assert.equal(pulseReach(54, 54), 17);
  assert.ok(pulseReach(54, 54) >= apex);
  const big = 113;
  assert.ok(pulseReach(big, big) >= (big / 2 + 5) * PULSE_SCALE - big / 2);
});

test('pulseClip: null where the tile is out of the window or wholly under the bar (#168)', () => {
  const window = { top: 100, left: 0, right: 377, bottom: 500 };
  assert.equal(pulseClip({ top: 20, bottom: 74, left: 22, right: 76 }, window), null);
  assert.equal(pulseClip({ top: 510, bottom: 564, left: 22, right: 76 }, window), null);
  assert.equal(pulseClip({ top: 410, bottom: 464, left: 22, right: 76 }, window, 400), null);
  assert.deepEqual(pulseClip({ top: 100, bottom: 154, left: 22, right: 76 }, window, Infinity, 17), { top: -17, right: -318, bottom: -363, left: -39 });
});

/* ── B18: the padding reaches the two measures that read it ─────────── */

test('showRaffleHit hands the grid\'s top padding to hitScrollDelta: a tile in the padding strip is scrolled to (#168, B18)', () => {
  // Window 92..500 with 8 px of padding on top: the strip starts at 100. A tile
  // at 96 sits half in the padding, so it is not in view and the grid moves;
  // without the padding the same tile counted as in view and nothing moved.
  const { grid, layer } = scene({ tileRect: { left: 22, top: 96, width: 54, height: 54 } });
  grid.scrollTop = 200;
  showRaffleHit(grid, null, 1);
  assert.deepEqual(grid.scrolledTo, [200 + (96 + 27 - (100 + 400 / 2))]);
  layer().firstElementChild.dispatch('animationend');
});

test('attachFades hands the box\'s top padding to fadeHeight: the flat stage\'s band stays 36, not 38 (#168, B18)', () => {
  scene();
  globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
  const root = new FakeElement('div', { rect: { left: 0, top: 0, width: 852, height: 393 } });
  const box = new FakeElement('div', { className: 'plan-grid', rect: { left: 400, top: 200, width: 300, height: 152 } });
  Object.assign(box, { clientTop: 0, clientLeft: 0, clientWidth: 300, clientHeight: 144 + 8, scrollHeight: 900, scrollTop: 0 });
  root.appendChild(box);
  const fades = attachFades(root, ['.plan-grid']);
  fades.paint();
  const band = root.querySelector('.fade');
  assert.equal(band.style.height, '36px');
  assert.equal(band.style.top, `${200 + 152 - 36}px`);
  fades.detach();
});
