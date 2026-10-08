import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `views/controls-hot.php` is static Alpine markup composed once by PHP
 * (ADR 0004), so what `node --test` can hold is the markup text itself.
 *
 * Since #143 (decision 6) the rail's `DistributionCurve` is the sheet's chips
 * over the full width, not the `<select>` the tracer #62 left there and #104
 * had to mend twice — a field that fell out of step with `settings.curve`, and
 * a handling that wrote it past `setSlider()`. The chips cannot fall out of
 * step: each one's pressed state is bound to `settings.curve` itself. And
 * they are drawn by the one function the sheet draws them with, so the two
 * cannot drift.
 */

const VIEW_PATH = new URL('../views/controls-hot.php', import.meta.url);

test('the rail carries no select any more: the curve is chips (#143, decision 6)', () => {
  const source = readFileSync(fileURLToPath(VIEW_PATH), 'utf8').replace(/<!--[^]*?-->/g, '').replace(/\/\*[^]*?\*\//g, '');
  assert.doesNotMatch(source, /<select\b/);
  assert.match(source, /curve_steps\(\)/, 'the rail draws the chips of the sheet');
});

test('rail and sheet draw the curve chips from one function, and a chip goes through setSlider', () => {
  const row = readFileSync(new URL('../views/control-row.php', import.meta.url), 'utf8');
  const sheet = readFileSync(new URL('../views/controls-sheet.php', import.meta.url), 'utf8');
  assert.equal((row.match(/function curve_steps\(/g) ?? []).length, 1);
  assert.match(sheet, /curve_steps\(\)/);
  const body = row.slice(row.indexOf('function curve_steps('));
  assert.match(body, /class="curve-step"/);
  assert.match(body, /@click="setSlider\('curve', step\.id\)"/, 'the pin is set by the gesture (ADR 0006)');
  assert.match(body, /:aria-pressed="settings\.curve === step\.id"/, 'it follows settings.curve from anywhere');
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
  assert.doesNotMatch(RAIL, /rankFloor/, 'RankFloor stands on Details only (#143, decision 5)');
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
  assert.match(SHEET, /curve_steps\(\)/);
  assert.match(ROW, /class="curve-step"/);
  assert.match(SHEET, /class="step-chip"/);
  assert.match(SHEET, /type="checkbox"[^>]*setSlider\('combinedHandout'/);
});
