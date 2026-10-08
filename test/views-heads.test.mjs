import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOURNAMENT_TYPES } from '../public/sets/onepiece.mjs';
import { planApp } from '../public/ui/plan.mjs';

/**
 * The three page heads (#156, F1 a): the prototype's `colHead()` whole, on
 * every fold and on the phone too — the title at 17 px, beside it the facts
 * small and still.
 *
 * | page    | title                                   | facts                                      |
 * |---------|-----------------------------------------|--------------------------------------------|
 * | Plan    | the active `TournamentType`'s catalog title | `40 players` (K2: no booster total)    |
 * | Prepare | `Prepare`                               | `Weekly · 40` before *everything the pool holds* |
 * | Details | `Details`                               | `everything you can turn`                  |
 *
 * The views are static Alpine markup PHP composes once (ADR 0004), so the
 * head is read out of the PHP source and its `x-show` / `x-text` expressions
 * are evaluated against the real component, `planApp()`, at a phone stage and
 * at a three-column stage. Nothing about the expressions is re-derived here:
 * what the test sees is what Alpine would see.
 */

const VIEWS = new URL('../views/', import.meta.url);
const read = (file) => readFileSync(new URL(file, VIEWS), 'utf8');
const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');

/** The `<header class="col-head …">…</header>` of a view, comments out. */
function headOf(file) {
  const source = read(file).replace(/<!--[^]*?-->/g, '');
  const match = source.match(/<header class="col-head[^"]*"[^]*?<\/header>/);
  assert.ok(match, `${file} has a column head`);
  return match[0];
}

/** Evaluates an Alpine expression against the component, as `with` does. */
function evaluate(expression, app) {
  return new Function('$app', `with ($app) { return (${expression}); }`)(app);
}

/** One attribute of the first element carrying `cls`, decoded. */
function attr(head, cls, name) {
  const tag = head.match(new RegExp(`<[a-z0-9]+[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`));
  assert.ok(tag, `an element .${cls} in the head`);
  const value = tag[0].match(new RegExp(`\\s${name.replace(/[:@]/g, '\\$&')}="([^"]*)"`));
  return value ? value[1] : null;
}

/**
 * What the head shows: its title (or `null` when hidden) and its facts as one
 * line of text, the way a reader sees them — static text and bound text
 * together, whitespace collapsed.
 */
function shown(file, app) {
  const head = headOf(file);
  const show = attr(head, 'col-title', 'x-show');
  const visible = show === null || evaluate(show, app);
  const titleTag = head.match(/<h1 class="col-title"[^>]*>([^<]*)<\/h1>/);
  const titleText = attr(head, 'col-title', 'x-text');
  const title = visible ? (titleText ? evaluate(titleText, app) : titleTag[1].trim()) : null;

  const factsStart = head.indexOf('class="col-facts');
  const open = head.lastIndexOf('<', factsStart);
  const factsTag = head.slice(open, head.indexOf('>', factsStart) + 1);
  const outer = factsTag.match(/x-text="([^"]*)"/);
  let facts;
  if (outer) {
    facts = String(evaluate(outer[1], app));
  } else {
    const close = head.indexOf('</div>', open); // the end of the title line
    const inner = head.slice(open + factsTag.length, close)
      .replace(/<span[^>]*x-text="([^"]*)"[^>]*><\/span>/g, (_, expression) => String(evaluate(expression, app)))
      .replace(/<[^>]+>/g, '');
    facts = inner;
  }
  return { title, facts: facts.replace(/\s+/g, ' ').trim() };
}

function appAt(width, height, query = '') {
  const app = planApp({ read: () => query, write: () => {} });
  app.setStage({ width, height });
  return app;
}

const PHONE = [393, 830];
const COLUMNS = [1280, 760];

test('the cold start is a phone and three columns are three columns — the folds the heads are read at', () => {
  assert.equal(appAt(...PHONE).fold.columns, 1);
  assert.equal(appAt(...COLUMNS).fold.columns, 3);
});

test('on the phone every page head carries its title and facts (#156 AC 1)', () => {
  const app = appAt(...PHONE);
  for (const page of ['plan', 'prepare', 'details']) {
    app.setPage(page);
    assert.equal(app.titled(page), true, `titled('${page}') on the phone`);
  }
  assert.deepEqual(shown('plan.php', app), { title: 'Weekly', facts: '40 players' });
  assert.deepEqual(shown('prepare.php', app), { title: 'Prepare', facts: 'Weekly · 40 everything the pool holds' });
  assert.deepEqual(shown('details.php', app), { title: 'Details', facts: 'everything you can turn' });
});

test('as columns every head carries the same title and facts (#156 AC 1)', () => {
  const app = appAt(...COLUMNS);
  for (const page of ['plan', 'prepare', 'details']) assert.equal(app.titled(page), true);
  assert.deepEqual(shown('plan.php', app), { title: 'Weekly', facts: '40 players' });
  assert.deepEqual(shown('prepare.php', app), { title: 'Prepare', facts: 'Weekly · 40 everything the pool holds' });
  assert.deepEqual(shown('details.php', app), { title: 'Details', facts: 'everything you can turn' });
});

test('the Plan head is titled by the active TournamentType out of the catalog and changes with it (#156 AC 2)', () => {
  for (const [width, height] of [PHONE, COLUMNS]) {
    const app = appAt(width, height);
    for (const type of TOURNAMENT_TYPES) {
      app.setType(type.id);
      const head = shown('plan.php', app);
      assert.equal(head.title, type.title, `${type.id} at ${width}`);
      assert.equal(head.facts, `${app.plan.players} players`);
    }
  }
});

test('the Plan facts follow the player count and name it alone (#156, K2)', () => {
  const app = appAt(...PHONE, '?v=1&game=onepiece&type=weekly&players=32');
  assert.equal(app.plan.players, 32);
  assert.equal(shown('plan.php', app).facts, '32 players');
});

test('the booster total stands once in the Plan head, in the output line and not beside the title (#156, K2)', () => {
  for (const [width, height] of [PHONE, COLUMNS]) {
    const app = appAt(width, height);
    for (const type of TOURNAMENT_TYPES) {
      app.setType(type.id);
      assert.doesNotMatch(shown('plan.php', app).facts, /booster/, `${type.id} at ${width}`);
    }
  }
  const head = headOf('plan.php');
  const titleline = head.slice(head.indexOf('class="col-titleline"'), head.indexOf('class="col-sub plan-output"'));
  assert.doesNotMatch(titleline, /booster/, 'nothing in the title line names the boosters');
  assert.match(head, /class="col-sub plan-output"[^>]*x-text="`\$\{plan\.pool\.booster\} boosters · \$\{plan\.pool\.packs\} packs · \$\{plan\.pool\.winners\} winner packs`"/,
    'the output line below keeps the booster total, whole (#143 K-B3)');
});

test('the Prepare head names the type and the player count before its caption, as proto:2257 (#156 AC 3)', () => {
  const app = appAt(...PHONE, '?v=1&game=onepiece&type=release');
  app.setPage('prepare');
  assert.deepEqual(shown('prepare.php', app), {
    title: 'Prepare',
    facts: `Release · ${app.plan.players} everything the pool holds`,
  });
  const prepare = headOf('prepare.php');
  assert.ok(prepare.indexOf('x-text') < prepare.indexOf('everything the pool holds'), 'the type comes first');
});

test('in fullscreen the Plan head stays the shead: type and player count, no title (#156 AC 7)', () => {
  for (const [width, height] of [PHONE, COLUMNS]) {
    const app = appAt(width, height);
    app.openFullscreen();
    assert.deepEqual(shown('plan.php', app), { title: null, facts: 'Weekly · 40 players' });
  }
});

/* ── The title line's form ──────────────────────────────────────────────── */

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector) {
  const at = CSS.indexOf(`\n${selector} {`);
  assert.ok(at >= 0, `plan.css has a rule ${selector}`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

test('the title line is 22 high, fixed, and never wraps (#61, #71; #156 AC 5)', () => {
  const line = rule('.col-titleline');
  assert.match(line, /(?:^|[\s;{])height:\s*22px/, 'a fixed height, not a minimum the title can grow past');
  assert.match(line, /white-space:\s*nowrap/);
  assert.match(line, /overflow:\s*hidden/);
});

test('title and facts are both cut with an ellipsis where the line runs out (#156 AC 4, AC 6)', () => {
  for (const selector of ['.col-title', '.col-facts']) {
    const declarations = rule(selector);
    assert.match(declarations, /text-overflow:\s*ellipsis/, selector);
    assert.match(declarations, /overflow:\s*hidden/, selector);
    assert.match(declarations, /min-width:\s*0/, `${selector} may shrink below its text`);
  }
});

test('no comment says the word stands in exactly one place any more (#156 AC 11)', () => {
  const plan = read('plan.php');
  const foot = read('foot.php');
  const css = rule('.col-head').length && CSS.slice(CSS.indexOf('The column head (#71)') - 10, CSS.indexOf('\n.col-head {'));
  for (const [name, text] of [['plan.php', plan], ['foot.php', foot], ['plan.css', css]]) {
    assert.doesNotMatch(text, /exactly one of two places|exactly when the foot does not|genau eine/, name);
  }
});
