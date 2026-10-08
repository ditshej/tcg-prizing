import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * The page holds still and a field does not zoom (#146, decided at the
 * walk-through of 2026-10-08, points 9 and 10).
 *
 * iOS zooms into a focused field whose type is under 16 px and does not zoom
 * back out. The cure decided is the type, not the viewport: every field at
 * 16 px, and the viewport meta left as it is — no `maximum-scale`, no
 * `user-scalable`, so pinch zoom stays for everyone.
 *
 * And the document does not rubber-band: `html`/`body` neither scroll nor
 * overscroll; only the pages scroll, and contain their own overscroll.
 *
 * Held on the stylesheet and the markup as text; how it behaves on a real
 * iPhone is a device point at #121.
 */

const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');
const code = CSS.replace(/\/\*[^]*?\*\//g, '');
const VIEWS = new URL('../views/', import.meta.url);
const views = readdirSync(VIEWS).filter((name) => name.endsWith('.php'))
  .map((name) => [name, readFileSync(new URL(name, VIEWS), 'utf8')]);

/** Every innermost rule as `{ selectors, body }`, media blocks included. */
const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, head, body]) => ({
  selectors: head.split(',').map((s) => s.trim()).filter(Boolean),
  body,
}));

/** The declarations of the rule whose selector list is exactly `head`. */
function ruleBody(head) {
  const wanted = head.split(',').map((s) => s.trim()).join(',');
  const found = rules.filter((r) => r.selectors.join(',') === wanted);
  assert.ok(found.length > 0, `${head} is in the stylesheet`);
  return found.map((r) => r.body).join(';');
}

const declared = (body, name) => [...body.matchAll(new RegExp(`(?:^|[;{\\s])${name}:\\s*([^;]+);`, 'g'))]
  .map(([, value]) => value.trim());

/** Every text-entry field in the views: `<input>` but checkbox and radio, `<select>`, `<textarea>`. */
const fields = views.flatMap(([name, source]) => [...source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
  .filter(([, tag, attrs]) => tag !== 'input' || !/type="(checkbox|radio)"/.test(attrs))
  .map(([, tag, attrs]) => ({ name, tag, classes: (attrs.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean) })));

const FIELD_CLASSES = [...new Set(fields.flatMap((f) => f.classes))];
const ELEMENT = /(?:^|[\s>+~(])(input|select|textarea)(?![-\w])/;

/** Whether a selector's subject is a field: an element selector or a field's class, not something inside it. */
function targetsField(selector) {
  if (/::?(after|before|placeholder)/.test(selector)) return false;
  const subject = selector.split(/[\s>+~]+/).pop();
  return ELEMENT.test(` ${subject}`) || FIELD_CLASSES.some((c) => new RegExp(`\\.${c}(?![-\\w])`).test(subject));
}

test('the field type is one token, 16 px — the size under which iOS zooms on focus', () => {
  assert.deepEqual(declared(ruleBody(':root'), '--field-size'), ['16px']);
});

test('the views hold the fields this file expects: the counter, the curve, the link field', () => {
  assert.ok(FIELD_CLASSES.includes('counter-value'), 'the counter field');
  assert.ok(FIELD_CLASSES.includes('link-field-input'), 'the link field');
  assert.ok(fields.some((f) => f.tag === 'select'), 'the curve select (removed by a later ticket, counted while it stands)');
});

test('the base rule gives every input, select and textarea the field type', () => {
  assert.deepEqual(declared(ruleBody('input, select, textarea'), 'font-size'), ['var(--field-size)']);
});

test('no rule that styles a field sets its type to anything but the token', () => {
  const offenders = [];
  for (const { selectors, body } of rules) {
    if (!selectors.some(targetsField)) continue;
    const sizing = [...body.matchAll(/(?:^|[;\s])(font-size|font):\s*([^;]+);/g)].map(([, prop, value]) => [prop, value.trim()]);
    if (sizing.length === 0) continue;
    const [prop, value] = sizing.at(-1);
    if (!value.includes('var(--field-size)')) offenders.push(`${selectors.join(', ')} → ${prop}: ${value}`);
  }
  assert.deepEqual(offenders, []);
});

test('the rules that used to shrink a field are among those checked', () => {
  for (const head of ['.counter-value', '.controls-hot .counter-value', '.link-field-input']) {
    assert.ok(rules.some((r) => r.selectors.includes(head) && /font(-size)?:/.test(r.body)), head);
  }
});

/*
 * #146 decided the viewport meta stays as it was; #158 (9b, F5 a) extended it
 * by `viewport-fit=cover` and by nothing else: the backgrounds run to the
 * screen's edge, the content is inset by `env(safe-area-inset-*)`
 * (`test/ui-shell-insets.test.mjs`), and pinch zoom stays for everyone.
 */
test('the viewport meta is #146\'s plus viewport-fit=cover: no maximum-scale, no user-scalable', () => {
  const shell = Object.fromEntries(views)['shell.php'];
  const metas = [...shell.matchAll(/<meta name="viewport" content="([^"]*)">/g)].map(([, content]) => content);
  assert.deepEqual(metas, ['width=device-width, initial-scale=1, viewport-fit=cover']);
  for (const [name, source] of views) assert.doesNotMatch(source, /maximum-scale|user-scalable/, name);
});

test('html and body neither scroll nor overscroll', () => {
  const body = ruleBody('html, body');
  assert.deepEqual(declared(body, 'overscroll-behavior'), ['none']);
  assert.deepEqual(declared(body, 'overflow'), ['hidden']);
});

test('the pages scroll and contain their own overscroll', () => {
  const body = ruleBody('.page-plan, .page-prepare, .page-details');
  assert.deepEqual(declared(body, 'overscroll-behavior'), ['contain']);
});

test('no regress: the app stays 100dvh, the take-back row keeps its sideways containment', () => {
  assert.deepEqual(declared(ruleBody('.app'), 'height'), ['100dvh']);
  assert.deepEqual(declared(ruleBody('.raffle-takeback-row'), 'overscroll-behavior-x'), ['contain']);
});
