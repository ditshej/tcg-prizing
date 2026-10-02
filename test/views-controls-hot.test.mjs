import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `views/controls-hot.php` (#104) has no pure derivation of its own — it is
 * static Alpine markup composed once by PHP (ADR 0004), so there is nothing
 * in `public/ui/` to import here. What `node --test` can hold is the markup
 * text itself: the `<select>` that drives `DistributionCurve` in the fixed
 * rail under `Plan`.
 *
 * Two independent bugs sat in that one element (#104):
 *
 * 1. `$el.value` was written once, at `x-init`, and never again — the field
 *    fell out of step with `settings.curve` the moment it changed from
 *    anywhere else (the sheet, a `SetupLink`, a Set switch).
 * 2. `@change` wrote `settings.curve` directly instead of going through
 *    `setSlider()`, so the pin was never set (ADR 0006) and `clampToBounds()`
 *    was bypassed.
 *
 * Both are provable only as markup — no logic to call, no DOM to mount
 * without a browser. Read the file, find the `<select>`, and check it.
 */

const VIEW_PATH = new URL('../views/controls-hot.php', import.meta.url);

/** The curve `<select>`'s own markup, isolated from the rest of the file —
 *  there is exactly one `<select>` in this view. */
function curveSelectMarkup() {
  const source = readFileSync(VIEW_PATH, 'utf8');
  const start = source.indexOf('<select');
  assert.ok(start >= 0, 'the view still has a <select> for DistributionCurve');
  const end = source.indexOf('</select>', start);
  assert.ok(end > start, 'the <select> is closed');
  return source.slice(start, end + '</select>'.length);
}

/** One `<label class="plan-control">` of this view, picked by a handler name
 *  only that control calls. */
function planControlMarkup(handler) {
  const source = readFileSync(VIEW_PATH, 'utf8');
  const hit = source.indexOf(handler);
  assert.ok(hit >= 0, `the view still has a control calling ${handler}`);
  const start = source.lastIndexOf('<label class="plan-control">', hit);
  assert.ok(start >= 0, `${handler} still sits inside a .plan-control label`);
  const end = source.indexOf('</label>', hit);
  assert.ok(end > start, 'the label is closed');
  return source.slice(start, end + '</label>'.length);
}

test('the select carries the comment explaining why x-model/:value cannot be used (#104 AC 2)', () => {
  const source = readFileSync(fileURLToPath(VIEW_PATH), 'utf8');
  // The load-bearing half of the comment: the x-for child races the parent's
  // own bindings. #104 extends the fix that follows it, it does not replace
  // the reasoning.
  assert.match(source, /x-model/);
  assert.match(source, /walks a parent's own bindings before its\s+children exist/);
});

test('a handling of the curve select goes through setSlider, not a direct write to settings.curve (#104 AC 3)', () => {
  const select = curveSelectMarkup();
  assert.doesNotMatch(
    select,
    /@change="settings\.curve\s*=\s*\$event\.target\.value"/,
    'a direct write bypasses the pin (ADR 0006) and clampToBounds()',
  );
  assert.match(
    select,
    /@change="setSlider\('curve',\s*\$event\.target\.value\)"/,
    'setSlider() is the one place that writes both pins[key] and settings[key]',
  );
});

test('the select keeps following settings.curve after the first $nextTick, not only at it (#104 AC 1)', () => {
  const select = curveSelectMarkup();
  // The first, deferred write still has to happen — the options do not exist
  // before $nextTick settles (the comment explains why).
  assert.match(select, /\$nextTick\(\(\) => \{[^}]*\$el\.value = settings\.curve/);
  // And something has to reapply $el.value whenever settings.curve changes
  // afterwards. Name and body are read off the *same* call (run 10, decision
  // K2): the earlier or-chain was blind in both of its branches on their own.
  // A $watch on the wrong key slipped through the "more than one assignment"
  // branch, because the watch body was itself the second assignment; a $watch
  // on the right key with a body that writes nothing slipped through the
  // name-only branch. Required is therefore the name of the curve AND an
  // assignment to the field inside that watch's own body.
  const watch = select.match(/\$watch\(\s*'settings\.curve'\s*,[^{]*\{([^}]*)\}/);
  assert.ok(
    watch,
    "no $watch('settings.curve', (value) => { … }) reapplies the field when the "
    + 'curve changes from outside the rail',
  );
  assert.match(
    watch[1],
    /\$el\.value\s*=/,
    'the $watch names settings.curve but its body never writes $el.value, so the '
    + 'field still stops following after the first $nextTick',
  );
});

/* ── One row for rail and sheet (#113) ──────────────────────────────────── */

const VIEWS = new URL('../views/', import.meta.url);
const ROW = readFileSync(new URL('control-row.php', VIEWS), 'utf8');
const SHEET = readFileSync(new URL('controls-sheet.php', VIEWS), 'utf8');
const RAIL = readFileSync(VIEW_PATH, 'utf8');
const CSS = readFileSync(new URL('../public/ui/plan.css', import.meta.url), 'utf8');

/** PHP and HTML comments out, so a sentence *about* a slider is not mistaken
 *  for one. */
const code = (source) => source.replace(/<!--[^]*?-->/g, '').replace(/\/\*[^]*?\*\//g, '');

/** The body of `control_row()` — the one function both callers draw from. */
function rowFunction() {
  const start = ROW.indexOf('function control_row(');
  assert.ok(start >= 0, 'views/control-row.php defines control_row()');
  const end = ROW.indexOf('\n}\n', start);
  return ROW.slice(start, end);
}

test('no view draws a range input any more (#113 AC 1)', () => {
  for (const file of readdirSync(VIEWS).filter((name) => name.endsWith('.php'))) {
    const source = code(readFileSync(new URL(file, VIEWS), 'utf8'));
    assert.doesNotMatch(source, /type=["']range["']/, `${file} still has a slider`);
  }
});

test('rail and sheet draw their row from one function, defined once (#113 AC 3)', () => {
  assert.equal((ROW.match(/function control_row\(/g) ?? []).length, 1);
  for (const [name, source] of [['sheet', SHEET], ['rail', RAIL]]) {
    assert.match(source, /require_once __DIR__ \. '\/control-row\.php'/, `the ${name} loads the row`);
    assert.doesNotMatch(source, /function control_row\(/, `the ${name} has no row of its own`);
  }
  // The rail's three numbers are the row, with the sheet's own titles.
  assert.match(RAIL, /control_row\('players', 'Players'\)/);
  assert.match(RAIL, /control_row\('depth', 'Served ranks'/);
  assert.match(RAIL, /control_row\('rankFloor', 'Min boosters per rank'\)/);
  assert.match(SHEET, /control_row\('depth', 'Served ranks'/);
  assert.match(SHEET, /function sheet_control[^]*control_row\(\$key, \$label/);
});

test('the rail leaves out the explanation text and nothing of the row', () => {
  assert.doesNotMatch(code(RAIL), /sheet-desc/, 'no explanation text on the rail (#64 AC 9)');
  // The row carries the explanation nowhere: it is the sheet's, beside it.
  assert.doesNotMatch(rowFunction(), /sheet-desc/);
  // The way back is part of the row, so the rail has it too.
  assert.match(rowFunction(), /sheet_pin_reset\(\$key, \$label\)/);
  assert.match(rowFunction(), /sheet_pin_head\(\$key\)/);
});

test('cap N stands on the title line of Served ranks, which does not wrap (#113 AC 3, K4)', () => {
  const body = rowFunction();
  const title = body.slice(body.indexOf('class="sheet-control-title"'), body.indexOf('class="counter"'));
  assert.match(title, /sheet-control-note/, 'the note is inside the title, before the counter');
  assert.match(CSS, /\.sheet-control-title\s*\{[^}]*white-space:\s*nowrap/);
  for (const source of [RAIL, SHEET]) {
    assert.match(source, /control_row\('depth', 'Served ranks', '', '`cap \$\{plan\.depthCap\}`'\)/);
  }
});

test('the number is a typed field: numeric keypad, all selected on focus, a commit at Enter and at leaving', () => {
  const body = rowFunction();
  const field = body.slice(body.indexOf('<input'), body.indexOf('<button', body.indexOf('<input')));
  assert.match(field, /type="text"/);
  assert.match(field, /inputmode="numeric"/);
  assert.match(field, /:value="value\('<\?= \$k \?>'\)"/);
  assert.match(field, /@focus="[^"]*\$el\.select\(\)/, 'the whole content is selected on focus');
  assert.match(field, /@input="draft\('<\?= \$k \?>', \$el\.value\)"/, 'a keystroke is a draft, not a write');
  assert.match(field, /@keydown\.enter[^=]*="commitTyped\('<\?= \$k \?>', \$el\.value\)/);
  assert.match(field, /@blur="commitTyped\('<\?= \$k \?>', \$el\.value\)/);
  assert.match(field, /@keydown\.escape[^=]*="discardDraft\('<\?= \$k \?>'\)/);
  // After a commit — written, held, or refused — the field shows what stands.
  assert.equal((field.match(/\$el\.value = value\('<\?= \$k \?>'\)/g) ?? []).length, 3);
  assert.doesNotMatch(field, /@input="(setSlider|commitTyped)/, 'nothing is written per keystroke');
  assert.match(body, /:class="\{ 'is-draft': isDraft\('<\?= \$k \?>'\) \}"/, 'the draft is marked');
  assert.match(CSS, /\.is-draft/);
});

test('minus and plus go through step(), the handling that writes and pins at once', () => {
  const body = rowFunction();
  assert.match(body, /@click="step\('<\?= \$k \?>', -1\)"[^>]*:disabled="!canStep\('<\?= \$k \?>', -1\)"/);
  assert.match(body, /@click="step\('<\?= \$k \?>', 1\)"[^>]*:disabled="!canStep\('<\?= \$k \?>', 1\)"/);
});

test('the fourteen numbers all stand as the row, and the three choices do not', () => {
  const rows = new Set([...SHEET.matchAll(/(?:sheet_control|control_row)\('([a-zA-Z]+)'/g)].map((m) => m[1]));
  assert.deepEqual([...rows].sort(), [
    'boosterRate', 'depth', 'displaySize', 'envelopeSize', 'envelopeYield', 'judgeBooster', 'judgeWinner',
    'participationBooster', 'participationPack', 'players', 'rankFloor', 'ranked', 'tournamentPacks', 'winnerPacks',
  ]);
  // curve keeps its glyphs, depthStep its chips, combinedHandout its box (#113 AC 2).
  assert.match(SHEET, /class="curve-step"/);
  assert.match(SHEET, /class="step-chip"/);
  assert.match(SHEET, /type="checkbox"[^>]*setSlider\('combinedHandout'/);
});
