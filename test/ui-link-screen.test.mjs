import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { planApp } from '../public/ui/plan.mjs';
import { confirmFirst } from '../public/ui/confirm-first.mjs';
import { COPIED_MS, copyText, linkAddress, execCopy, reportView, shareBranch } from '../public/ui/link-screen.mjs';

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
 * Every pin travels, the step pin included (run 12, K1 on #72). Before that
 * the v1 register had no `depthStep` key and `encode()` dropped it: measured
 * at 48 players, sender `top quarter` → 12 ranks, receiver `top 8` → 8.
 */
test('a pinned depthStep still reaches the copied link (K5: G3 measured it lost silently)', () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.deepEqual(app.plan.pinned, { depthStep: 'topQuarter' }, 'the plan reports the step as set by hand');
  assert.equal(paramsOf(app.linkQuery).get('depthStep'), 'topQuarter');
});

test('the receiver of a top-quarter link at 48 players sees the 12 ranks the sender saw, and 16 at 64', () => {
  const { app: sender } = opened();
  sender.setSlider('players', 48);
  sender.setSlider('depthStep', 'topQuarter');
  assert.equal(sender.plan.depth, 12);

  const { app: receiver } = opened(sender.linkQuery);
  assert.equal(receiver.linkReport, null);
  assert.equal(receiver.plan.depth, 12, 'the step travelled, not the number it made');
  receiver.setSlider('players', 64);
  assert.equal(receiver.plan.depth, 16);
});

test('a pure step pin after a cold start writes the address bar, base along (N2; #89)', () => {
  const { app, written } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.deepEqual(written, ['?v=1&game=onepiece&type=weekly&depthStep=topQuarter']);
});

test('the pin counter beside Copy link names the same items the link carries (N2)', () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.equal(app.pinCount, 1);
  assert.deepEqual(app.pinnedItems.map((item) => item.key), ['depth'], 'the step is the item Served ranks');
  const carried = [...paramsOf(app.linkQuery).keys()].filter((key) => !['v', 'game', 'type'].includes(key));
  assert.deepEqual(carried, ['depthStep'], 'and the link carries that item, by its step');
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
  const delays = [];
  return {
    later: (fn, ms) => { pending.push(fn); delays.push(ms); },
    cancel: () => {},
    fire: () => pending.splice(0).forEach((fn) => fn()),
    delays,
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

test('without a clipboard the address opens in a field instead (#72 AC 4)', async () => {
  const { app } = opened();
  const button = fakeButton();
  const note = fakeButton();
  const outcome = await app.copyLink(button, { clipboard: undefined, page: 'https://a/', note, place: () => {}, ...fakeTimer() });
  assert.equal(outcome, 'manual');
  assert.equal(app.linkField, 'https://a/?v=1&game=onepiece&type=weekly');
  assert.ok(!('linkCopied' in note.dataset), 'no success is claimed');
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
    'This app does not know `rankfloor` — it was left out.',
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

/** The plan head: from its opening tag to its close. */
function planHead() {
  const plan = view('plan.php');
  const start = plan.indexOf('<header class="col-head plan-head"');
  assert.ok(start > 0, 'the plan head exists');
  return plan.slice(start, plan.indexOf('</header>', start));
}

/**
 * #143, decisions 1 and 2 (overruling #72 AC 1 and the place from #67): Share
 * and Reset-all stand in the plan head, top right, in every fold, as icons
 * alone — the word is the `aria-label` and the tooltip. `Details` carries
 * neither any more.
 */
test('Share sits in the plan head as an icon, its word the label and tooltip; Details has no Copy link (#143)', () => {
  const head = planHead();
  const share = head.slice(head.indexOf('class="plan-share"'));
  assert.match(share, /^class="plan-share"[^>]*aria-label="Copy link"[^>]*title="Copy link"/);
  assert.match(share, /@click="copyLink\(\$el\)"/);
  assert.match(share.slice(0, share.indexOf('</button>')), /icon\('share'\)/);
  assert.doesNotMatch(share.slice(0, share.indexOf('</button>')), />\s*Copy link\s*</, 'no word on screen');
  const sheet = view('controls-sheet.php');
  assert.doesNotMatch(sheet, /link-copy|copyLink|link-field/);
  assert.ok(view('plan.php').includes('Link copied'), 'the bubble says it in words');
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

/* ── Share: the system sheet on a phone, the bubble on a desktop (#155) ── */

/**
 * #155, F3 c: "Telefon" is a coarse pointer **and** a `navigator.share` to
 * call; everything else is the desktop branch — a phone over plain http in
 * the LAN has no `navigator.share` and falls back to the bubble.
 */
test('the branch is the phone only with a coarse pointer and a share function — all four combinations (#155)', () => {
  const share = () => Promise.resolve();
  assert.equal(shareBranch({ coarse: true, share }), 'phone');
  assert.equal(shareBranch({ coarse: true, share: undefined }), 'desktop');
  assert.equal(shareBranch({ coarse: false, share }), 'desktop');
  assert.equal(shareBranch({ coarse: false, share: undefined }), 'desktop');
});

/**
 * #155: without `navigator.clipboard` — plain http is no secure context —
 * `execCommand('copy')` on a selected field is tried first. It answers
 * honestly `true` or `false`, so only its `true` counts as a copy (#72 AC 4:
 * never claim a success); `false`, a throw or no fallback at all leave the
 * preselected field.
 */
test('without a clipboard the execCommand copy is tried first, and only its true counts (#155)', async () => {
  const tried = [];
  assert.equal(await copyText('x', undefined, (t) => { tried.push(t); return true; }), 'copied');
  assert.deepEqual(tried, ['x']);
  assert.equal(await copyText('x', undefined, () => false), 'manual');
  assert.equal(await copyText('x', {}, () => { throw new Error('no'); }), 'manual');
  assert.equal(await copyText('x', undefined), 'manual');
});

test('a clipboard that takes the text needs no fallback; one that refuses gets it too (#155)', async () => {
  let tried = 0;
  const fallback = () => { tried += 1; return true; };
  assert.equal(await copyText('x', { writeText: async () => {} }, fallback), 'copied');
  assert.equal(tried, 0);
  assert.equal(await copyText('x', { writeText: async () => { throw new Error('denied'); } }, fallback), 'copied');
  assert.equal(tried, 1);
});

/** A document as far as `execCopy()` touches one. */
function fakeDocument(answer) {
  const log = { appended: [], removed: 0, selected: 0, commands: [] };
  const doc = {
    body: { append: (el) => log.appended.push(el) },
    createElement: (tag) => ({
      tag,
      style: {},
      setAttribute() {},
      select: () => { log.selected += 1; },
      remove: () => { log.removed += 1; },
    }),
    execCommand: (cmd) => {
      log.commands.push(cmd);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return { doc, log };
}

test('execCopy copies a selected throwaway field and answers what the browser said (#155)', () => {
  const yes = fakeDocument(true);
  assert.equal(execCopy('https://a/', yes.doc), true);
  assert.equal(yes.log.appended[0].value, 'https://a/');
  assert.equal(yes.log.selected, 1);
  assert.deepEqual(yes.log.commands, ['copy']);
  assert.equal(yes.log.removed, 1, 'the field is gone again');
  assert.equal(execCopy('x', fakeDocument(false).doc), false);
  const thrown = fakeDocument(new Error('no'));
  assert.equal(execCopy('x', thrown.doc), false);
  assert.equal(thrown.log.removed, 1, 'gone even after a throw');
  assert.equal(execCopy('x', undefined), false);
});

/** What a browser hands the Share handling, recorded: the system sheet,
 *  the clipboard and the execCommand fallback. */
function shareEnv({ coarse = false, share = undefined, clipboard = undefined, exec = undefined } = {}) {
  const log = { shared: [], written: [], execs: [] };
  return {
    log,
    env: {
      coarse,
      share: share && ((data) => { log.shared.push(data); return share(data); }),
      clipboard: clipboard && { writeText: async (t) => { log.written.push(t); return clipboard(t); } },
      exec: exec && ((t) => { log.execs.push(t); return exec(t); }),
      page: 'https://prizing.optcg.ch/',
      place: () => {},
      ...fakeTimer(),
    },
  };
}

const WHOLE = 'https://prizing.optcg.ch/?v=1&game=onepiece&type=weekly&rankFloor=5';

test('on a phone, Share calls the system sheet once with the complete SetupLink — no bubble, no copy (#155)', async () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const { env, log } = shareEnv({ coarse: true, share: async () => {}, clipboard: () => {}, exec: () => true });
  await app.share(env);
  assert.deepEqual(log.shared, [{ url: WHOLE }]);
  assert.equal(app.shareOpen, false, 'no bubble opens');
  assert.deepEqual(log.written, [], 'nothing is copied');
  assert.deepEqual(log.execs, []);
});

test('a cancelled system sheet shows nothing; any other failure falls back to the bubble (#155)', async () => {
  const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
  const { app } = opened();
  const cancelled = shareEnv({ coarse: true, share: async () => { throw abort; } });
  await app.share(cancelled.env);
  assert.equal(app.shareOpen, false, 'no bubble after a cancel');
  assert.equal(app.linkField, null, 'no field either');

  for (const name of ['NotAllowedError', 'TypeError', 'DataError']) {
    const { app: other } = opened();
    const failed = shareEnv({ coarse: true, share: async () => { throw Object.assign(new Error(name), { name }); } });
    await other.share(failed.env);
    assert.equal(other.shareOpen, true, `${name} opens the desktop bubble`);
  }
});

test('on a desktop, Share opens the bubble and copies nothing; a second press closes it (#155)', async () => {
  const { app } = opened();
  const { env, log } = shareEnv({ clipboard: () => {}, exec: () => true });
  await app.share(env);
  assert.equal(app.shareOpen, true);
  assert.deepEqual(log.written, [], 'opening copies nothing');
  assert.deepEqual(log.execs, []);
  await app.share(env);
  assert.equal(app.shareOpen, false, 'the same press closes it');
  await app.share(env);
  app.closeShare();
  assert.equal(app.shareOpen, false, 'Escape and a press beside it close it too');
});

test('the bubble is one bubble at a time: opening it puts out the tile, the ⓘ and the drop question (#155)', async () => {
  const { app } = opened();
  app.openTile = 1;
  app.openInfo = 'game';
  app.confirmDrop = { keys: [] };
  await app.share(shareEnv().env);
  assert.equal(app.openTile, null);
  assert.equal(app.openInfo, null);
  assert.equal(app.confirmDrop, null);
});

test('Copy link copies the complete form and is called Copied for COPIED_MS, then nothing remains (#155)', async () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const button = fakeButton();
  const { env, log } = shareEnv({ clipboard: () => {} });
  await app.share(env);
  const before = dataOf(app);
  const outcome = await app.copyLink(button, env);
  assert.equal(outcome, 'copied');
  assert.deepEqual(log.written, [WHOLE]);
  assert.ok('linkCopied' in button.dataset, 'the button says Copied, for a moment');
  assert.deepEqual(env.delays, [COPIED_MS]);
  assert.equal(COPIED_MS, 2000);
  assert.equal(dataOf(app), before, 'no member of the component changed');
  env.fire();
  assert.ok(!('linkCopied' in button.dataset), 'and falls back to Copy link');
});

test('without a clipboard, a true execCommand is a copy; a false one opens the field and never says Copied (#155)', async () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  const done = fakeButton();
  const yes = shareEnv({ exec: () => true });
  assert.equal(await app.copyLink(done, yes.env), 'copied');
  assert.deepEqual(yes.log.execs, [WHOLE]);
  assert.ok('linkCopied' in done.dataset);
  assert.equal(app.linkField, null);

  const refused = fakeButton();
  const no = shareEnv({ exec: () => false });
  assert.equal(await app.copyLink(refused, no.env), 'manual');
  assert.equal(app.linkField, WHOLE, 'the preselected field, in the same bubble');
  assert.ok(!('linkCopied' in refused.dataset), 'Copied never appears');
});

test('closing the bubble takes the field with it (#155)', async () => {
  const { app } = opened();
  const { env } = shareEnv();
  await app.share(env);
  await app.copyLink(fakeButton(), env);
  assert.notEqual(app.linkField, null);
  app.closeShare();
  assert.equal(app.linkField, null);
});

/**
 * CONTEXT.md › `Pinned`: an unconfirmed number in a field locks every
 * control. For Share on both branches and for `Copy link` that is the same
 * guard as for every other control — the press only confirms the number,
 * and the handler under it never runs.
 */
test('an unconfirmed number locks Share on both branches and Copy link (#155)', async () => {
  const target = { closest: () => null };
  const field = { value: '64', closest: (sel) => (sel === '[data-number-field]' ? field : null) };
  const pressOnce = (guard, handler) => {
    let stopped = false;
    const event = (type) => ({ type, target, preventDefault() {}, stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = true; } });
    guard.pointerdown(event('pointerdown'));
    guard.mousedown(event('mousedown'));
    guard.click(event('click'));
    if (!stopped) return handler();
    return null;
  };
  const cases = [
    ['phone', (app, env) => app.share(env), { coarse: true, share: async () => {} }],
    ['desktop', (app, env) => app.share(env), {}],
    ['Copy link', (app, env) => app.copyLink(fakeButton(), env), { clipboard: () => {} }],
  ];
  for (const [name, handle, options] of cases) {
    const { app } = opened();
    app.draft('players', '64');
    const guard = confirmFirst(app, { focused: () => field });
    const { env, log } = shareEnv(options);
    await pressOnce(guard, () => handle(app, env));
    assert.equal(app.value('players'), 64, `${name}: the press confirmed the number`);
    assert.deepEqual(log.shared, [], `${name}: no system sheet`);
    assert.deepEqual(log.written, [], `${name}: no copy`);
    assert.equal(app.shareOpen, false, `${name}: no bubble`);
  }
});
