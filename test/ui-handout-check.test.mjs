import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The app's one checkbox, `Handout` (#170): its own box and its own check,
 * drawn from the tokens, instead of the system's blue box. The native
 * `<input type="checkbox">` stays the control — hidden from sight but
 * focusable and in the accessibility tree, so a tap on the label, Space and
 * `:focus-visible` keep working — and a `<span>` beside it is the drawing.
 *
 * Held here as markup and stylesheet text, the way `ui-look.test.mjs` holds
 * the look: what it measures on screen is the acceptance by image's
 * (`docs/acceptance/170-handout-haken.md`, WebKit and Chromium).
 */

const SHEET = readFileSync(new URL('../views/controls-sheet.php', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8')
  .replace(/\/\*[^]*?\*\//g, '');

/** The label's markup, from `<label class="sheet-check">` to its `</label>`. */
function label() {
  const at = SHEET.indexOf('<label class="sheet-check">');
  assert.ok(at >= 0, 'the Handout label is in the sheet');
  return SHEET.slice(at, SHEET.indexOf('</label>', at));
}

/** The declarations of the rule whose selector list is exactly `selector`. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const match = CSS.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} is in the stylesheet`);
  return match[1];
}

const declared = (body, name) => body.match(new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`))?.[1].trim();

test('the native checkbox stays the control, bound to the setting both ways', () => {
  const markup = label();
  assert.match(markup, /<input type="checkbox" :checked="settings\.combinedHandout"/);
  assert.match(markup, /@change="setSlider\('combinedHandout', \$event\.target\.checked\)"/);
});

test('the box is a span right after the input, and carries Lucide check', () => {
  const markup = label();
  const input = markup.indexOf('<input');
  const box = markup.indexOf('<span class="sheet-box"', input);
  assert.ok(box > input, 'the box follows the input');
  assert.match(markup.slice(markup.indexOf('>', input) + 1, box), /^\s*$/, 'nothing between input and box');
  assert.ok(markup.indexOf("icon('check')", box) > box, 'the check is the Lucide icon');
});

test('the input is hidden from sight, never from focus or the accessibility tree', () => {
  const body = rule('.sheet-check input');
  assert.doesNotMatch(body, /display:\s*none|visibility:\s*hidden/);
  assert.equal(declared(body, 'position'), 'absolute');
  assert.equal(declared(body, 'clip-path'), 'inset(50%)');
  assert.equal(declared(body, 'appearance'), 'none');
});

test('off: 20 × 20, the corner of a control, paper and the button\'s shadow — the form of a button', () => {
  const body = rule('.sheet-box');
  assert.equal(declared(body, 'width'), '20px');
  assert.equal(declared(body, 'height'), '20px');
  assert.equal(declared(body, 'border-radius'), 'var(--r-ctl)');
  assert.equal(declared(body, 'background'), 'var(--paper)');
  assert.equal(declared(body, 'box-shadow'), 'var(--btn-shadow)');
  assert.doesNotMatch(body, /border:/, '--line is no edge');
});

test('on: the pressed form of the chips — accent, glow, the check in on-accent', () => {
  const body = rule('.sheet-check input:checked + .sheet-box');
  assert.equal(declared(body, 'background'), 'var(--accent)');
  assert.equal(declared(body, 'color'), 'var(--on-accent)');
  assert.equal(declared(body, 'box-shadow'), 'var(--glow)');
  assert.equal(declared(rule('.sheet-box .icon'), 'visibility'), 'hidden');
  assert.equal(declared(rule('.sheet-check input:checked + .sheet-box .icon'), 'visibility'), 'visible');
});

test('the keyboard\'s focus draws a ring at the box, in a token', () => {
  const body = rule('.sheet-check input:focus-visible + .sheet-box');
  assert.match(declared(body, 'outline'), /^2px solid var\(--accent\)$/);
});

test('the box stands centred on the first line of the label, also when it wraps', () => {
  const labelBody = rule('.sheet-check');
  assert.equal(declared(labelBody, 'align-items'), 'flex-start');
  assert.equal(declared(labelBody, 'min-height'), 'var(--hit)');
  assert.equal(declared(rule('.sheet-box'), 'margin-block'), 'calc((1lh - 20px) / 2)');
});
