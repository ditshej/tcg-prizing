import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { planApp } from '../public/ui/plan.mjs';
import { copyText, linkAddress, reportView } from '../public/ui/link-screen.mjs';

/**
 * The SetupLink on screen (#72): the `Copy link` button and the
 * `LinkMigration` report as the app's one overlay.
 *
 * Proven here is what falls out of the plan and the read result without a
 * picture: what the button copies, when the report stands, what it says. Where
 * the overlay lands and that it really covers everything is judged at the
 * picture (#61, `## Testing Decisions`).
 */

function opened(query = '') {
  const written = [];
  const app = planApp({ read: () => query, write: (url) => written.push(url) });
  return { app, written };
}

/** The query part of a copied link, as `URLSearchParams`. */
function paramsOf(query) {
  return new URLSearchParams(query.replace(/^\?/, ''));
}

/* ── What `Copy link` copies (#72 AC 1, AC 2; K5 on #72) ───────────────── */

test('with no pin at all, the copy form is the base and nothing else', () => {
  const { app } = opened();
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly');
});

test('one pinned control makes exactly one deviation in the copied link (K5, not encode(plan.settings))', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const params = paramsOf(app.linkQuery);
  const sliders = [...params.keys()].filter((key) => !['v', 'game', 'type'].includes(key));
  assert.deepEqual(sliders, ['rankFloor'], 'one pin is one key, never the twelve the resolved stand names');
  assert.equal(params.get('rankFloor'), '5');
  assert.equal(params.get('type'), 'weekly', 'the base stays');
});

/*
 * OPEN — red by the register, not by this file. `depthStep` is pinnable at the
 * screen (`setSlider('depthStep', …)`, the step chips of `Served ranks`, #64,
 * #67 K3), and `plan.pinned` reports it. But the v1 wire has no key for it
 * (`link/keys.mjs`, #47 "depthStep steht nicht im Link"), so `encode()` drops
 * it: measured at 48 players, sender `top quarter` → depth 12, receiver gets
 * `top 8` → depth 8. #47's reason ("reproducible from the base") holds only
 * for an unpinned step. Fixing it means a wire decision (`public/link/*`,
 * not this ticket's to write). The assertion stays as it was asked for.
 */
test('a pinned depthStep still reaches the copied link (K5: G3 measured it lost silently)', {
  todo: 'the v1 register has no depthStep key — a decision for #47/keys.mjs, see the comment above',
}, () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.deepEqual(app.plan.pinned, { depthStep: 'topQuarter' }, 'the plan reports the step as set by hand');
  assert.equal(paramsOf(app.linkQuery).get('depthStep'), 'topQuarter');
});

test('a pinned Served ranks number reaches the copied link as the one deviation', () => {
  const { app } = opened();
  app.setSlider('depth', 6);
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly&depth=6');
});

test('after a cold start the address bar stays empty, the copy form is complete all the same', () => {
  const { app, written } = opened();
  assert.deepEqual(written, [], 'nothing came in, nothing is written');
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekly');
});

test('after an incoming link the base stands in both, with zero pins (run 9 on #89)', () => {
  const { app, written } = opened('?v=1&game=onepiece&type=weekend');
  assert.equal(app.pinCount, 0);
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekend']);
  assert.equal(app.linkQuery, '?v=1&game=onepiece&type=weekend');
});

/* ── The copy itself, and the field when it cannot be done (#72 AC 4) ──── */

test('the copied text is a whole address: page plus the copy form, no stale query or hash', () => {
  assert.equal(
    linkAddress('?v=1&game=onepiece&type=weekly', 'https://prizing.optcg.ch/?v=1&type=release#x'),
    'https://prizing.optcg.ch/?v=1&game=onepiece&type=weekly',
  );
});

test('a clipboard that takes the text answers copied', async () => {
  const taken = [];
  const outcome = await copyText('https://a/?v=1', { writeText: async (t) => taken.push(t) });
  assert.equal(outcome, 'copied');
  assert.deepEqual(taken, ['https://a/?v=1']);
});

test('no clipboard interface, or one that refuses, answers manual — never a claimed success', async () => {
  assert.equal(await copyText('x', undefined), 'manual');
  assert.equal(await copyText('x', {}), 'manual');
  assert.equal(await copyText('x', { writeText: async () => { throw new Error('denied'); } }), 'manual');
});

/** A button stand-in: only what a confirmation could ever touch on it. */
function fakeButton() {
  return { dataset: {} };
}

/** A timer that fires only when told to, so the fall-back can be watched. */
function fakeTimer() {
  const pending = [];
  return {
    later: (fn) => pending.push(fn),
    cancel: () => {},
    fire: () => pending.splice(0).forEach((fn) => fn()),
  };
}

/** The component's own data members — what a confirmation must not write to. */
function dataOf(app) {
  return JSON.stringify(
    Object.entries(Object.getOwnPropertyDescriptors(app))
      .filter(([, d]) => 'value' in d && typeof d.value !== 'function')
      .map(([k, d]) => [k, d.value]),
  );
}

test('Copy link puts the whole address on the clipboard', async () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const taken = [];
  const outcome = await app.copyLink(fakeButton(), {
    clipboard: { writeText: async (t) => taken.push(t) },
    page: 'https://prizing.optcg.ch/',
    ...fakeTimer(),
  });
  assert.equal(outcome, 'copied');
  assert.deepEqual(taken, ['https://prizing.optcg.ch/?v=1&game=onepiece&type=weekly&rankFloor=5']);
});

test('the confirmation is fleeting: the button flips and falls back, and the component keeps nothing (#72 AC 3)', async () => {
  const { app } = opened();
  const button = fakeButton();
  const timer = fakeTimer();
  const before = dataOf(app);
  await app.copyLink(button, { clipboard: { writeText: async () => {} }, page: 'https://a/', ...timer });
  assert.ok('linkCopied' in button.dataset, 'the button says it, for a moment');
  assert.equal(dataOf(app), before, 'no member of the component changed');
  timer.fire();
  assert.ok(!('linkCopied' in button.dataset), 'and falls back');
});

test('without a clipboard the address opens in a field instead (#72 AC 4)', async () => {
  const { app } = opened();
  const button = fakeButton();
  const outcome = await app.copyLink(button, { clipboard: undefined, page: 'https://a/', ...fakeTimer() });
  assert.equal(outcome, 'manual');
  assert.equal(app.linkField, 'https://a/?v=1&game=onepiece&type=weekly');
  assert.ok(!('linkCopied' in button.dataset), 'no success is claimed');
  app.closeLinkField();
  assert.equal(app.linkField, null);
});

/* ── What the report says (#72 AC 7, AC 8, AC 9) ───────────────────────── */

const GAMES = [
  { id: 'onepiece', title: 'One Piece', types: [{ id: 'weekly', title: 'Weekly' }, { id: 'weekend', title: 'Weekend' }] },
];

/** A line as one string, wire keys between backticks — the code type on screen. */
function said(line) {
  return line.map((part) => ('wire' in part ? `\`${part.wire}\`` : part.text)).join('');
}

function report(entries, extra = {}) {
  return { from: 1, to: 1, migrated: false, resaveBookmark: true, entries, ...extra };
}

test('no report, no view', () => {
  assert.equal(reportView(null, GAMES), null);
});

test('a control is named by its screen word', () => {
  const view = reportView(report([{ kind: 'unreadableValue', key: 'rankFloor' }]), GAMES);
  assert.deepEqual(view.lines.map(said), ['Min boosters per rank could not be read — it was left out.']);
});

test('a key with no screen word shows the wire key and invents no label (#72 AC 9)', () => {
  const view = reportView(
    report([
      { kind: 'unknownKey', key: 'rankfloor' },
      { kind: 'dropped', key: 'oldSlider' },
      { kind: 'renamed', key: 'rankFloor', was: 'floor' },
    ]),
    GAMES,
  );
  assert.deepEqual(view.lines.map(said), [
    '`rankfloor` is not a setting of this app — it was left out.',
    '`oldSlider` no longer exists — its value was dropped.',
    '`floor` is now Min boosters per rank.',
  ]);
});

test('a replaced base names the type by its title, and the unknown name as it stood', () => {
  const view = reportView(
    report([
      { kind: 'typeReplaced', was: 'weekender', now: 'weekly', by: 'fallback' },
      { kind: 'gameReplaced', was: null, now: 'onepiece', by: 'fallback' },
      { kind: 'typeReplaced', was: 'release2', now: 'weekend', by: 'migration' },
      { kind: 'setByMigration', key: 'ranked', value: 4 },
    ]),
    GAMES,
  );
  assert.deepEqual(view.lines.map(said), [
    'Type `weekender` is unknown — opened as Weekly.',
    'No game was named — opened as One Piece.',
    'Type `release2` is now Weekend.',
    'Winner packs by rank was set to 4, so the plan stays the same.',
  ]);
});

test('the bookmark prompt stands when the address bar was rewritten (#72 AC 7)', () => {
  const view = reportView(report([{ kind: 'unreadableValue', key: 'curve' }]), GAMES);
  assert.equal(view.resave, true);
  assert.equal(view.bookmark, 'The address bar now holds this link as it was read. Save your bookmark again.');
});

test('the future case has its own sentence and no bookmark prompt (#72 AC 8)', () => {
  const view = reportView(
    report([{ kind: 'futureVersion', from: 4 }], { from: 4, resaveBookmark: false }),
    GAMES,
  );
  assert.deepEqual(view.lines.map(said), ['This link is newer than this app. Only its game and type were read.']);
  assert.equal(view.resave, false);
  assert.equal(view.bookmark, null);
});

test('a link with no readable version is called damaged, not newer, and asks for the bookmark', () => {
  const view = reportView(report([{ kind: 'unreadableVersion', was: '0' }], { from: null }), GAMES);
  assert.deepEqual(view.lines.map(said), [
    'This link is damaged: it names no version this app can read. Only its game and type were read.',
  ]);
  assert.equal(view.resave, true);
});

/* ── The overlay at the component (#72 AC 5, AC 6, AC 7, AC 10) ────────── */

test('the report stands exactly when the read path hands one over', () => {
  assert.equal(opened('').app.linkReportView, null, 'a cold start reads nothing and reports nothing');
  assert.equal(opened('?v=1&game=onepiece&type=weekly&rankFloor=5').app.linkReportView, null, 'a clean link is silent');
  const { app } = opened('?v=1&game=onepiece&type=weekly&rankFloor=banana');
  assert.equal(app.linkReport.entries.length, 1);
  assert.deepEqual(app.linkReportView.lines.length, 1);
});

test('closed once, it never comes back — no handling reopens it (#72 AC 5, AC 6)', () => {
  const { app } = opened('?v=1&game=onepiece&type=weekly&rankFloor=banana');
  app.closeLinkReport();
  assert.equal(app.linkReportView, null);
  app.setSlider('rankFloor', 4);
  app.setType('weekend');
  app.setPage('details');
  assert.equal(app.linkReportView, null);
});

test('the bookmark prompt appears exactly when the address bar was rewritten (#72 AC 7, AC 8)', () => {
  for (const query of [
    '?v=1&game=onepiece&type=weekly&rankFloor=banana',
    '?v=1&game=onepiece&type=nope',
    '?v=0&game=onepiece&type=weekly',
    '?v=9&game=onepiece&type=weekly&rankFloor=5',
  ]) {
    const { app, written } = opened(query);
    assert.notEqual(app.linkReportView, null, query);
    assert.equal(app.linkReportView.resave, written.length > 0, query);
  }
  const future = opened('?v=9&game=onepiece&type=weekly');
  assert.deepEqual(future.written, [], 'the future link keeps its address');
  assert.equal(future.app.linkReportView.bookmark, null);
});

test('while the report stands no bubble is open, and closing hands the focus back (#72 AC 10)', () => {
  const { app } = opened('?v=1&game=onepiece&type=weekly&rankFloor=banana');
  app.openTile = 3;
  app.openInfo = 'type';
  const focused = [];
  const before = { focus: () => focused.push('before') };
  const exit = { focus: () => focused.push('exit') };
  const dialog = { showModal() { this.open = true; }, close() { this.open = false; }, open: false };
  app.showLinkReport(dialog, exit, before);
  assert.equal(dialog.open, true);
  assert.equal(app.openTile, null);
  assert.equal(app.openInfo, null);
  assert.equal(app.confirmDrop, null);
  assert.deepEqual(focused, ['exit'], 'it takes the focus when it opens');
  app.closeLinkReport();
  assert.equal(dialog.open, false);
  assert.deepEqual(focused, ['exit', 'before'], 'and gives it back');
});

test('with no report, showing does nothing', () => {
  const { app } = opened('');
  const dialog = { showModal() { this.open = true; }, open: false };
  app.showLinkReport(dialog, { focus() {} }, null);
  assert.equal(dialog.open, false);
});

/* ── The markup (#72 AC 1, AC 6) ───────────────────────────────────────── */

const view = (name) => readFileSync(new URL(`../views/${name}`, import.meta.url), 'utf8');

/** The `Type` row of the Set block, from its label to the row's end. */
function typeRow() {
  const sheet = view('controls-sheet.php');
  const start = sheet.indexOf('<span class="set-label">Type</span>');
  assert.ok(start > 0, 'the Type row exists');
  const rowStart = sheet.lastIndexOf('<div class="set-row">', start);
  const end = sheet.indexOf('\n    </div>', start);
  return sheet.slice(rowStart, end);
}

test('Copy link sits in the Set block on Details, in the Type row, behind the reset chip (#72 AC 1)', () => {
  const row = typeRow();
  const chip = row.indexOf('class="pin-chip"');
  const copy = row.indexOf('class="link-copy"');
  assert.ok(chip > 0 && copy > chip, 'behind the pin chip');
  assert.match(row, /@click="copyLink\(\$el\)"/);
  assert.match(row, />Copy link</);
  assert.ok(view('details.php').includes("controls-sheet.php"), 'the sheet is the Details page');
});

test('the report is a dialog with exactly one exit, required after the foot (#72 AC 6)', () => {
  const report = view('link-report.php');
  assert.equal((report.match(/<dialog\b/g) ?? []).length, 1);
  assert.equal((report.match(/<button\b/g) ?? []).length, 1, 'one exit');
  assert.match(report, /@click="closeLinkReport\(\)"/);
  assert.match(report, /showLinkReport\(/);
  const app = view('app.php');
  assert.ok(app.indexOf("'/link-report.php'") > app.indexOf("'/foot.php'"), 'after foot.php');
});

test('no other view opens an overlay (#72 AC 6: the one overlay of the app)', () => {
  for (const name of readdirSync(new URL('../views/', import.meta.url))) {
    if (name === 'link-report.php') continue;
    assert.ok(!/<dialog\b|showModal/.test(view(name)), `${name} opens no dialog`);
  }
});
