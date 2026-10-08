import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markBox, placeMark, MARK_SLIDE_MS } from '../public/ui/foot.mjs';

/**
 * The page switch (#158, points 10a–10c, F4 a).
 *
 * The pages do not move, they only fade — 150 ms of opacity, as the
 * prototype's `.sheet.page` (proto:831-837); #63's "ein Wechsel hat keine
 * Richtung" still holds for them. The marking in the foot is what moved: it
 * covers the whole active entry, in depth and never as a stroke, and slides
 * to the new one — sideways in the upright foot, up and down at the turned
 * strip. From two columns on there is one entry and it is never the active
 * page, so nothing slides. Under `prefers-reduced-motion: reduce` neither
 * moves.
 */

const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const code = CSS.replace(/\/\*[^]*?\*\//g, '');
const FOOT = readFileSync(new URL('../views/foot.php', import.meta.url), 'utf8');

/** The body of the `prefers-reduced-motion: reduce` block(s). */
const REDUCED = /@media \(prefers-reduced-motion: reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
const reduced = [...code.matchAll(REDUCED)].map(([, inner]) => inner).join('\n');

/** The rules as they stand with motion allowed — the reduced blocks taken out. */
const rules = [...code.replace(REDUCED, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, head, body]) => ({
  selectors: head.split(',').map((s) => s.trim()).filter(Boolean),
  body,
}));

function ruleBody(head) {
  const wanted = head.split(',').map((s) => s.trim()).join(',');
  const found = rules.filter((r) => r.selectors.join(',') === wanted);
  assert.ok(found.length > 0, `${head} is in the stylesheet`);
  return found.map((r) => r.body).join(';');
}

const declared = (body, name) => [...`;${body}`.matchAll(new RegExp(`[;{\\s]${name}:\\s*([^;]+);`, 'g'))]
  .map(([, value]) => value.trim());


/* ── The fade ─────────────────────────────────────────────────────────────── */

test('a page that comes to the front fades in over 150 ms, opacity only', () => {
  const body = ruleBody('.page-plan, .page-prepare, .page-details');
  assert.deepEqual(declared(body, 'animation'), ['page-fade 150ms linear']);
  const frames = code.match(/@keyframes page-fade\s*\{([^]*?\})\s*\}/)?.[1] ?? '';
  assert.match(frames, /from\s*\{\s*opacity:\s*0;?\s*\}/);
  assert.doesNotMatch(frames, /transform|translate|left|top/, 'the page does not move');
});

/* ── The marking ──────────────────────────────────────────────────────────── */

test('the foot carries one marking of its own, first, under the entries', () => {
  const footTag = FOOT.match(/<footer[^>]*>/)[0];
  assert.match(footTag, /x-data="footMark"/);
  const first = FOOT.slice(FOOT.indexOf(footTag) + footTag.length).trim();
  assert.match(first, /^<span class="foot-mark" aria-hidden="true"><\/span>/);
  assert.deepEqual(declared(ruleBody('.foot-item'), 'position'), ['relative'], 'the entries paint over it');
});

test('the marking is a field in depth, never a stroke, and the field under the icon is gone', () => {
  const mark = ruleBody('.foot-mark');
  assert.deepEqual(declared(mark, 'background'), ['var(--accent-soft)']);
  assert.deepEqual(declared(mark, 'width'), ['var(--mark-width, 0px)']);
  assert.deepEqual(declared(mark, 'height'), ['var(--mark-height, 0px)']);
  assert.doesNotMatch(mark, /(?:^|[;\s])(?:border(?!-radius)|outline|text-decoration|box-shadow)[-a-z]*:/);
  assert.equal(rules.some((r) => r.selectors.includes('.foot-active .foot-icon') && /background/.test(r.body)), false);
});

test('it slides for 150 ms only while a page switch moves it, and the duration is the fade\'s', () => {
  assert.equal(MARK_SLIDE_MS, 150);
  assert.deepEqual(declared(ruleBody('.foot-mark'), 'transition'), []);
  assert.deepEqual(declared(ruleBody('.foot[data-mark-slide] .foot-mark'), 'transition'),
    ['transform 150ms ease, width 150ms ease, height 150ms ease']);
});

test('under prefers-reduced-motion the marking jumps and the pages switch without a fade', () => {
  assert.match(reduced, /\.foot\[data-mark-slide\] \.foot-mark\s*\{\s*transition:\s*none;\s*\}/);
  assert.match(reduced, /\.page-plan,\s*\.page-prepare,\s*\.page-details\s*\{\s*animation:\s*none;\s*\}/);
});

/** A foot of three entries; `active` is the entry's index, `-1` for none shown. */
function footWith(boxes, active, { slid = false } = {}) {
  const props = {};
  const items = boxes.map((box, i) => ({
    classList: { contains: (c) => c === 'foot-active' && i === active },
    getClientRects: () => (box ? [box] : []),
    getBoundingClientRect: () => box,
  }));
  const mark = { style: { setProperty: (k, v) => { props[k] = v; } } };
  const foot = {
    dataset: slid ? { markSlide: '' } : {},
    getBoundingClientRect: () => ({ left: 0, top: 796, width: 393, height: 56 }),
    querySelectorAll: () => items,
    querySelector: () => mark,
  };
  return { foot, mark, props };
}

const UPRIGHT = [
  { left: 0, top: 796, width: 131, height: 56 },
  { left: 131, top: 796, width: 131, height: 56 },
  { left: 262, top: 796, width: 131, height: 56 },
];

test('the marking takes the whole active entry, measured against the foot', () => {
  assert.deepEqual(markBox({ left: 0, top: 796 }, UPRIGHT[1]), { x: 131, y: 0, width: 131, height: 56 });
  assert.equal(markBox({ left: 0, top: 796 }, null), null);
});

test('a page switch slides it from the entry it stood on', () => {
  const { foot, props } = footWith(UPRIGHT, 2);
  placeMark(foot, { slide: true, shownBefore: true });
  assert.ok('markSlide' in foot.dataset);
  assert.deepEqual(props, { '--mark-x': '262px', '--mark-y': '0px', '--mark-width': '131px', '--mark-height': '56px', '--mark-shown': '1' });
});

test('a resize puts it in place without sliding', () => {
  const { foot } = footWith(UPRIGHT, 1, { slid: true });
  placeMark(foot, { slide: false, shownBefore: true });
  assert.equal('markSlide' in foot.dataset, false);
});

test('from two columns on the one entry is never the active page: nothing is marked and nothing slides', () => {
  const { foot, props } = footWith([null, { left: 8, top: 0, width: 96, height: 44 }, null], 1 - 2);
  placeMark(foot, { slide: true, shownBefore: true });
  assert.equal('markSlide' in foot.dataset, false);
  assert.equal(props['--mark-shown'], '0');
});

test('coming back from no marking it appears in place, it does not fly in', () => {
  const { foot } = footWith(UPRIGHT, 0);
  placeMark(foot, { slide: true, shownBefore: false });
  assert.equal('markSlide' in foot.dataset, false);
});
