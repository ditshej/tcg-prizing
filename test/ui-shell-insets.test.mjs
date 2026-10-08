import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachMeasuring, attachStage } from '../public/ui/measure.mjs';

/**
 * The shell's safe areas and the stage it hands the fold (#158, points 9, 12
 * and 10a).
 *
 * With `viewport-fit=cover` the app's box runs under the notch and the
 * rounded corners, and the content is inset by `env(safe-area-inset-*)` on
 * the edge children — the outermost page and the foot — never as padding on
 * `.app`. `attachStage()` reads the app's own box, so it has to take the
 * insets off before `fold()` sees it: otherwise the fold reckons with a stage
 * up to 2 × 59 px wider than what the pages really get.
 *
 * Chromium reports every inset as 0, so a test that runs with the browser's
 * own values passes for the wrong reason. The insets therefore travel through
 * custom properties (`--inset-top/-right/-left` on `:root`, registered as
 * lengths), and these tests set them to an iPhone's 47 and 59.
 */

/** A `ResizeObserver` the test fires by hand. */
function installObserver() {
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() {}
  };
  return () => observers.forEach((o) => o.callback([]));
}

/** `getComputedStyle` answering custom properties out of `props`. */
function installStyle(props) {
  globalThis.getComputedStyle = () => ({
    getPropertyValue: (name) => props[name] ?? '',
    rowGap: '8px', gap: '8px', paddingTop: '8px', paddingBottom: '0px', paddingLeft: '8px', paddingRight: '8px',
  });
}

function appBox(width, height) {
  return { clientWidth: width, clientHeight: height, dataset: {} };
}

test('the stage the fold sees is the app box less the side insets (landscape, 47 a side)', () => {
  installObserver();
  installStyle({ '--inset-left': '47px', '--inset-right': '47px', '--inset-top': '0px' });
  const sizes = [];
  attachStage(appBox(812, 375), (size) => sizes.push(size));
  assert.deepEqual(sizes.map(({ width, height }) => ({ width, height })), [{ width: 718, height: 375 }]);
});

test('the same with 59 a side: 932 wide is 814 of content', () => {
  installObserver();
  installStyle({ '--inset-left': '59px', '--inset-right': '59px', '--inset-top': '0px' });
  const sizes = [];
  attachStage(appBox(932, 430), (size) => sizes.push(size));
  assert.equal(sizes[0].width, 814);
});

test('upright and standalone, the status bar comes off the height and nothing off the width', () => {
  installObserver();
  installStyle({ '--inset-left': '0px', '--inset-right': '0px', '--inset-top': '59px' });
  const sizes = [];
  attachStage(appBox(393, 852), (size) => sizes.push(size));
  assert.deepEqual({ width: sizes[0].width, height: sizes[0].height }, { width: 393, height: 793 });
});

test('a browser without the properties (or with the insets at 0) measures the app box as it is', () => {
  installObserver();
  installStyle({});
  const sizes = [];
  attachStage(appBox(812, 375), (size) => sizes.push(size));
  assert.deepEqual({ width: sizes[0].width, height: sizes[0].height }, { width: 812, height: 375 });
});

test('every resize reads the insets again — a turned phone moves them to the other axis', () => {
  const fire = installObserver();
  const props = { '--inset-left': '0px', '--inset-right': '0px', '--inset-top': '59px' };
  installStyle(props);
  const app = appBox(393, 852);
  const sizes = [];
  attachStage(app, (size) => sizes.push(size));
  Object.assign(props, { '--inset-left': '59px', '--inset-right': '59px', '--inset-top': '0px' });
  Object.assign(app, { clientWidth: 852, clientHeight: 393 });
  fire();
  assert.deepEqual(sizes.map(({ width, height }) => [width, height]), [[393, 793], [734, 393]]);
});

/* ── A hidden Plan is not measured (10a) ─────────────────────────────────── */

/**
 * While another page is in front, `Plan` is `display: none` and its stage
 * reports 0 × 0. Measured, that box says the diagram has no room, the
 * diagram goes, and on the way back one frame shows the plan without it and
 * the next lets the tiles slide. The measurement is discarded instead: no
 * verdict, no write — `diagramFits()` itself is not asked and not touched.
 */
function stageBox(width, height) {
  const writes = [];
  return {
    writes,
    clientWidth: width, clientHeight: height, children: [],
    getClientRects: () => (width || height ? [{}] : []),
    querySelector: () => null,
    style: { setProperty: (name, value) => writes.push([name, value]) },
  };
}

test('a stage of 0 × 0 is not measured: no verdict on the diagram, no size written', () => {
  const fire = installObserver();
  installStyle({});
  const stage = stageBox(0, 0);
  const verdicts = [];
  attachMeasuring(stage, [], () => null, (fits) => verdicts.push(fits));
  fire();
  assert.deepEqual(verdicts, []);
  assert.deepEqual(stage.writes, []);
});

test('back in front, the stage is measured again as before', () => {
  const fire = installObserver();
  installStyle({});
  const stage = stageBox(0, 0);
  const verdicts = [];
  attachMeasuring(stage, [], () => null, (fits) => verdicts.push(fits));
  Object.assign(stage, { clientWidth: 393, clientHeight: 600 });
  stage.getClientRects = () => [{}];
  fire();
  assert.equal(verdicts.length, 1);
  assert.deepEqual(stage.writes.map(([name]) => name), ['--plan-columns', '--diagram-height']);
});

test('the two direct measurings in plan.mjs ask the same question first', () => {
  const plan = readFileSync(new URL('../public/ui/plan.mjs', import.meta.url), 'utf8');
  const direct = [...plan.matchAll(/^.*applyDiagramRoom\(applyGeometry\(.*$/gm)].map(([line]) => line);
  assert.equal(direct.length, 2, 'the fullscreen watch and the raffle pass');
  for (const line of direct) assert.match(line, /hasBox\(this\.\$refs\??\.stage\)/, line.trim());
});

/* ── The stylesheet: where the insets are applied (9a, 9b, 12) ───────────── */

const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const code = CSS.replace(/\/\*[^]*?\*\//g, '');

/** Every innermost rule as `{ selectors, body }`, media blocks included. */
const rules = [...code.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, head, body]) => ({
  selectors: head.split(',').map((s) => s.trim()).filter(Boolean),
  body,
}));

/** The declarations of the rule(s) whose selector list is exactly `head`. */
function ruleBody(head) {
  const wanted = head.split(',').map((s) => s.trim()).join(',');
  const found = rules.filter((r) => r.selectors.join(',') === wanted);
  assert.ok(found.length > 0, `${head} is in the stylesheet`);
  return found.map((r) => r.body).join(';');
}

const declared = (body, name) => [...`;${body}`.matchAll(new RegExp(`[;{\\s]${name}:\\s*([^;]+);`, 'g'))]
  .map(([, value]) => value.trim());

const SIDES = ['top', 'right', 'left'];

test('the three insets are registered lengths, so the rind reads pixels and not env()', () => {
  for (const side of SIDES) {
    const block = code.match(new RegExp(`@property --inset-${side}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    assert.match(block, /syntax:\s*'<length>'/, `--inset-${side} is a length`);
    assert.match(block, /inherits:\s*true/, `--inset-${side} inherits`);
    assert.match(block, /initial-value:\s*0px/, `--inset-${side} starts at 0`);
  }
});

test('the insets are what iOS reports, on :root — no value by hand, no JS reading the turn', () => {
  const root = rules.filter((r) => r.selectors.join(',') === ':root').map((r) => r.body).join(';');
  for (const side of SIDES) {
    assert.deepEqual(declared(root, `--inset-${side}`), [`env(safe-area-inset-${side}, 0px)`]);
  }
  for (const file of ['plan.mjs', 'measure.mjs', 'fold.mjs', 'foot.mjs']) {
    let source = '';
    try { source = readFileSync(new URL(`../public/ui/${file}`, import.meta.url), 'utf8'); } catch { continue; }
    assert.doesNotMatch(source, /screen\.orientation|orientationchange|window\.orientation/, file);
  }
});

test('the trap: .app carries no padding, so its clientWidth holds no inset the rind would not know of', () => {
  assert.deepEqual(declared(ruleBody('.app'), 'padding(?:-[a-z]+)?'), []);
});

test('every page insets itself with a transparent border, so the strip is the page\'s own surface', () => {
  const body = ruleBody('.page-plan, .page-prepare, .page-details');
  assert.deepEqual(declared(body, 'border-style'), ['solid']);
  assert.deepEqual(declared(body, 'border-color'), ['transparent']);
  assert.deepEqual(declared(body, 'border-width'), ['var(--inset-top) var(--inset-right) 0 var(--inset-left)']);
  // The surfaces the strips continue: Prepare and Details paper, Plan the ground.
  assert.deepEqual(declared(ruleBody('.page-prepare, .page-details'), 'background'), ['var(--paper)']);
  assert.deepEqual(declared(ruleBody('.page-plan'), 'background(?:-color)?'), []);
  assert.deepEqual(declared(ruleBody('html, body'), 'background'), ['var(--bg)']);
});

test('only the outermost column keeps its side inset; the inner edges lose theirs', () => {
  const zeroRight = ruleBody(".app[data-columns='2']:not([data-fullscreen]) .page-plan, .app[data-columns='2']:not([data-fullscreen]) .page-prepare, .app[data-columns='3']:not([data-fullscreen]) .page-plan, .app[data-columns='3']:not([data-fullscreen]) .page-prepare, .app[data-flat]:not([data-fullscreen]) .fold > *");
  assert.deepEqual(declared(zeroRight, 'border-right-width'), ['0']);
  const zeroLeft = ruleBody(".app[data-columns='2']:not([data-fullscreen]) .page-details, .app[data-columns='3']:not([data-fullscreen]) .page-details, .app[data-columns='3']:not([data-fullscreen]) .page-plan");
  assert.deepEqual(declared(zeroLeft, 'border-left-width'), ['0']);
});

test('the fixed columns grow by the inset they carry, so their content keeps its first width', () => {
  assert.deepEqual(declared(ruleBody(".app[data-columns='2'] .page-details, .app[data-columns='3'] .page-details"), 'flex'),
    ['0 0 calc(var(--col-details) + var(--inset-right))']);
  assert.deepEqual(declared(ruleBody(".app[data-columns='3'] .page-prepare"), 'flex'),
    ['0 0 calc(var(--col-prepare) + var(--inset-left))']);
});

test('the foot continues to the edge in its own colour: sides upright, right and top when turned', () => {
  const foot = ruleBody('.foot');
  assert.deepEqual(declared(foot, 'background'), ['var(--paper)']);
  assert.deepEqual(declared(foot, 'padding-left'), ['var(--inset-left)']);
  assert.deepEqual(declared(foot, 'padding-right'), ['var(--inset-right)']);
  assert.deepEqual(declared(ruleBody(".app[data-columns='2'] .foot, .app[data-columns='3'] .foot"), 'padding'),
    ['0 calc(8px + var(--inset-right)) 0 calc(8px + var(--inset-left))']);
  const flat = ruleBody('.app[data-flat] .foot');
  assert.deepEqual(declared(flat, 'flex'), ['0 0 calc(var(--strip-width) + var(--inset-right))']);
  assert.deepEqual(declared(flat, 'padding'), ['var(--inset-top) var(--inset-right) 0 0']);
});

test('the fixed layers count from the screen edge, so they add the insets the pages carry', () => {
  const stack = ruleBody('.notice-stack');
  assert.deepEqual(declared(stack, 'left'), ['calc(var(--deck-margin, 0px) + var(--plan-left, 0px) + var(--inset-left))']);
  assert.deepEqual(declared(stack, 'right'), ['calc(var(--deck-margin, 0px) + var(--plan-right, 0px) + var(--inset-right))']);
  assert.match(declared(stack, 'max-height')[0], /- var\(--inset-top\)\)$/);
  assert.deepEqual(declared(ruleBody('.notice-chips'), 'right'), ['calc(var(--deck-margin, 0px) + var(--chip-right, 0px) + var(--inset-right))']);
  const bar = ruleBody('.raffle-bar');
  assert.deepEqual(declared(bar, 'left'), ['calc(var(--plan-left, 0px) + var(--inset-left) + 8px)']);
  assert.deepEqual(declared(bar, 'right'), ['calc(var(--plan-right, 0px) + var(--inset-right) + 8px)']);
});
