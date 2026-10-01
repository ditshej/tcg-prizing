import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { planApp } from '../public/ui/plan.mjs';
import {
  DEPTH_STEP_LABELS,
  DROP_BUBBLE,
  PIN_LABELS,
  SHEET_KEYS,
  dropConfirmation,
  isPinned,
  pinnedItems,
  pinItem,
  pinTarget,
  pinnedKeys,
  pinsWithout,
} from '../public/ui/controls.mjs';

/**
 * `pinned` against `auto`, and the three reaches of the way back (#67).
 *
 * What is provable here is the half #61's Testing Decisions call the shell's
 * pure derivations: **which** sliders count as pinned, **which** fall when a
 * reach is taken, and that the counter and the question count the same thing.
 * Where the bubble lands and which surface lies over which is explicitly not
 * proven here — "Anker und Schichtung" is one of the five things that spec
 * names as judged at the picture.
 *
 * The marking is never computed by comparing a value against the sheet
 * (ADR 0006), so every test below sets a pin the way the screen does: through
 * a handler on `planApp()`.
 */

function opened(query = '') {
  const written = [];
  const app = planApp({ read: () => query, write: (url) => written.push(url) });
  return { app, written };
}

/* ── The marking (#67 AC 1, AC 2, AC 8) ─────────────────────────────────── */

test('a slider dragged and dragged back is still pinned', () => {
  const { app } = opened();
  const before = app.value('rankFloor');
  app.setSlider('rankFloor', before + 1);
  app.setSlider('rankFloor', before);
  assert.equal(app.value('rankFloor'), before, 'the value is back where it started');
  assert.equal(app.stateWord('rankFloor'), 'pinned', 'the handling set the pin, not the value');
});

test('an untouched slider says auto, and every control says one of the two words', () => {
  const { app } = opened();
  assert.equal(app.stateWord('rankFloor'), 'auto');
  for (const key of SHEET_KEYS) {
    assert.ok(['pinned', 'auto'].includes(app.stateWord(key)), `${key} says a state word`);
  }
});

test('a pin on the default value is marked all the same (ADR 0006)', () => {
  const { app } = opened();
  const standing = app.value('boosterRate');
  app.setSlider('boosterRate', standing);
  assert.equal(app.stateWord('boosterRate'), 'pinned');
});

test('a Game or TournamentType switch lifts no pin', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 5);
  app.setDisplays(1, 1);
  const before = app.pinCount;
  app.setType(app.types[app.types.length - 1].id);
  assert.equal(app.pinCount, before, 'the switch replaces the sheet, not the pins');
  assert.equal(app.stateWord('rankFloor'), 'pinned');
});

/* ── The counter, and what it counts (#67 AC 6) ─────────────────────────── */

test('displays and manualWinner count as one item each, however many ranks carry one', () => {
  const { app } = opened();
  app.setDisplays(1, 1);
  app.setDisplays(2, 1);
  app.setManualWinner(3, 1);
  assert.deepEqual(app.settings.displays, [1, 1], 'two ranks carry a reservation');
  assert.deepEqual(app.pinnedKeys, ['displays', 'manualWinner']);
  assert.equal(app.pinCount, 2);
});

test('the counter and the question count the same number', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.setSlider('players', 24);
  app.setDisplays(1, 1);
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  assert.equal(app.dropQuestion.count, app.pinCount);
  assert.equal(app.dropQuestion.count, 3);
});

test('a reservation taken back off the last rank is no pin any more', () => {
  const { app } = opened();
  app.setDisplays(1, 1);
  assert.equal(app.pinCount, 1);
  app.setDisplays(1, 0);
  assert.equal(app.pinCount, 0, 'an empty vector is not a pinned reservation');
});

/* ── The question (#67 AC 4) ────────────────────────────────────────────── */

test('the question names the sliders that fall and says there is no undo', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.setDisplays(1, 1);
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  const ask = app.dropQuestion;
  assert.deepEqual(ask.items.map((item) => item.label), ['Min boosters per rank', 'Reserved displays']);
  assert.match(ask.note, /no undo/i);
  assert.match(ask.headline, /Weekly/, 'the question names the type it goes back to');
  assert.equal(ask.confirm, 'Drop 2');
});

/**
 * #67, run 11, K3. The question names each control by its screen title and
 * says where the reset puts it. The value is not worked out a second time:
 * what is announced has to be what the handling then sets, so the probe asks
 * for it after the drop, at the stand the drop really installed.
 */
test('the question says per item where the reset puts it — and the drop puts it there', () => {
  const { app } = opened();
  app.setType('weekend');
  app.setSlider('players', 40);
  app.setSlider('rankFloor', 3);
  app.setSlider('displaySize', 25);
  app.setSlider('depthStep', 'topQuarter');
  app.setSlider('curve', 'gentle');
  app.setSlider('combinedHandout', !app.settings.combinedHandout);
  app.setDisplays(1, 1);
  app.setManualWinner(2, 1);

  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  const announced = app.dropQuestion.items;
  assert.ok(announced.every((item) => typeof item.to === 'string' && item.to !== ''), 'every item has a target');
  app.applyDrop();

  for (const item of announced) {
    assert.equal(pinTarget(item.key, app.stand), item.to, `${item.label} lands where the question said`);
  }
});

test('the target is the chosen type\'s own value, not the pinned one', () => {
  const cold = opened().app;
  cold.setType('weekend');
  const { app } = opened();
  app.setType('weekend');
  app.setSlider('players', cold.value('players') + 9);
  app.setSlider('depthStep', 'topQuarter');
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  const to = Object.fromEntries(app.dropQuestion.items.map((item) => [item.key, item.to]));
  assert.equal(to.players, String(cold.value('players')));
  assert.equal(to.depth, pinTarget('depth', cold.stand));
  assert.ok(to.depth.startsWith(DEPTH_STEP_LABELS[cold.settings.depthStep]), 'a step is named by its chip word');
});

/* ── Served ranks is one item (#67, run 11, K3) ─────────────────────────── */

test('slider and step of Served ranks are one item, in the counter as in the question', () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  assert.deepEqual(app.pinnedKeys, ['depth'], 'the step alone is the item');
  assert.equal(app.stateWord('depth'), 'pinned', 'and the control says so');
  app.setSlider('depth', 6);
  app.setSlider('players', 24);
  assert.deepEqual(app.pinnedKeys, ['players', 'depth']);
  assert.equal(app.pinCount, 2, 'two pins, one control, one count');
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  assert.equal(app.dropQuestion.count, app.pinCount);
  assert.deepEqual(app.dropQuestion.items.map((item) => item.label), ['Players', 'Served ranks']);
});

test('the reset at Served ranks takes its step with it', () => {
  const { app } = opened();
  app.setSlider('depthStep', 'topQuarter');
  app.setSlider('depth', 6);
  app.resetSlider('depth');
  assert.equal(app.pinCount, 0);
  assert.equal(app.stateWord('depth'), 'auto');
  assert.equal(app.pins.depthStep, undefined);
});

test('the question enumerates in sheet order, not in the order the pins were set', () => {
  const items = pinnedItems({ ranked: 3, players: 12, displays: [1] });
  assert.deepEqual(
    items.map((item) => item.key),
    ['players', 'ranked', 'displays'],
  );
});

test('the carry reach asks the same question in other words', () => {
  const all = dropConfirmation({ keys: ['rankFloor'], typeTitle: 'Weekly' });
  const carry = dropConfirmation({ keys: ['rankFloor'], typeTitle: 'Weekly', reach: 'carry' });
  assert.equal(all.headline, carry.headline);
  assert.equal(all.confirm, carry.confirm);
  assert.notEqual(all.note, carry.note);
  assert.match(carry.note, /stayed behind/);
  assert.match(carry.note, /no undo/i);
});

test('one slider is one slider, and the plural follows the count', () => {
  const one = dropConfirmation({ keys: ['players'], typeTitle: 'Weekly' });
  const two = dropConfirmation({ keys: ['players', 'ranked'], typeTitle: 'Weekly' });
  assert.match(one.headline, /^1 slider back to Weekly\?$/);
  assert.match(two.headline, /^2 sliders back to Weekly\?$/);
});

/* ── The reaches (#67 AC 3, AC 5) ───────────────────────────────────────── */

test('the reset at the slider drops that one pin and asks nothing', () => {
  const { app } = opened();
  const standing = app.value('rankFloor');
  app.setSlider('rankFloor', standing + 2);
  app.setSlider('players', 24);
  app.resetSlider('rankFloor');
  assert.equal(app.dropQuestion, null, 'the single reach never asks');
  assert.equal(app.stateWord('rankFloor'), 'auto');
  assert.equal(app.value('rankFloor'), standing, 'back on the chosen type');
  assert.equal(app.stateWord('players'), 'pinned', 'and it reaches no further');
});

test('the full reach takes the tile allocations with it and stops at Game and TournamentType', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.setDisplays(1, 1);
  app.setManualWinner(2, 1);
  const game = app.gameId;
  const type = app.typeId;

  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  app.applyDrop();

  assert.equal(app.pinCount, 0);
  assert.deepEqual(app.settings.displays, []);
  assert.deepEqual(app.settings.manualWinner, {});
  assert.equal(app.gameId, game, 'it resets the screen to the chosen type');
  assert.equal(app.typeId, type, 'it does not choose a new one');
  assert.equal(app.dropQuestion, null, 'answering closes the question');
});

/**
 * The seam #103 is owed. Its Entscheid 4 puts the **same** third reach at a
 * second trigger: switching `CombinedHandout` back off lists two pins
 * (`rankFloor`, `depth`) and carries the button that drops them — "keine neue
 * Mechanik". So the action is parameterised over the set of pins and the
 * anchor, and nothing here names "everything but Game and TournamentType".
 */
test('a reach may be given any set of pins — the seam #103 calls with two', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.setSlider('depth', 6);
  app.setSlider('players', 24);

  app.askDrop({ keys: ['rankFloor', 'depth'], anchor: '[data-drop-handout]', reach: 'carry' });
  assert.equal(app.dropQuestion.count, 2);
  app.applyDrop();

  assert.deepEqual(app.pinnedKeys, ['players'], 'only the two named pins fell');
});

test('a reach runs its caller\'s own errand after the drop', () => {
  const { app } = opened();
  let done = 0;
  app.setSlider('rankFloor', 4);
  app.askDrop({ keys: ['rankFloor'], anchor: '[data-drop-handout]', done: () => (done += 1) });
  app.applyDrop();
  assert.equal(done, 1, 'the notice that asked can close itself with the answer');
});

test('declining changes nothing', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  app.cancelDrop();
  assert.equal(app.dropQuestion, null);
  assert.equal(app.pinCount, 1);
});

test('a type switch withdraws an open question — it was asked of the old sheet', () => {
  const { app } = opened();
  app.setSlider('rankFloor', 4);
  app.askDrop({ keys: app.pinnedKeys, anchor: '[data-drop-all]' });
  app.setType(app.types[app.types.length - 1].id);
  assert.equal(app.dropQuestion, null);
  assert.equal(app.pinCount, 1, 'and the pins it was about are still standing');
});

/* ── The address bar follows a drop (#89's rule, not a new one) ─────────── */

test('dropping a pin writes the address bar like setting one does', () => {
  const { app, written } = opened();
  app.setSlider('rankFloor', 4);
  app.resetSlider('rankFloor');
  assert.equal(written.length, 2);
  assert.equal(written[1], '?v=1&game=onepiece&type=weekly');
});

/* ── The pure helpers ───────────────────────────────────────────────────── */

test('an empty vector, an empty map and an absent key are all auto', () => {
  assert.equal(isPinned('displays', { displays: [] }), false);
  assert.equal(isPinned('displays', { displays: [0, 0] }), false);
  assert.equal(isPinned('manualWinner', { manualWinner: {} }), false);
  assert.equal(isPinned('rankFloor', {}), false);
  assert.equal(isPinned('rankFloor', { rankFloor: 0 }), true, 'zero is a decision');
  assert.equal(isPinned('combinedHandout', { combinedHandout: false }), true);
});

test('dropping keys leaves the record it was given alone', () => {
  const pins = { rankFloor: 2, players: 12 };
  const next = pinsWithout(pins, ['rankFloor']);
  assert.deepEqual(next, { players: 12 });
  assert.deepEqual(pins, { rankFloor: 2, players: 12 });
});

/**
 * The enumeration may not go looking for a name it does not have: a question
 * that lists `manualWinner` in code type has stopped naming what falls.
 */
test('every pinnable key has a screen word — its own, or its control\'s', () => {
  for (const key of [...SHEET_KEYS, 'displays', 'manualWinner']) {
    assert.ok(PIN_LABELS[pinItem(key)], `${key} has a screen word`);
  }
});

/**
 * #67, run 11, K3: no word in the question that the screen does not carry.
 * `depthStep` is the step grid inside `Served ranks`, and a title of its own
 * would be one.
 */
test('the step grid has no title of its own — it is a member of Served ranks', () => {
  assert.equal(PIN_LABELS.depthStep, undefined);
  assert.equal(pinItem('depthStep'), 'depth');
  assert.ok(!Object.values(PIN_LABELS).some((label) => /step/i.test(label)), 'no invented step word');
});

/* ── The markup (#67 AC 1, AC 4, AC 7) ──────────────────────────────────── */

const SHEET = readFileSync(new URL('../views/controls-sheet.php', import.meta.url), 'utf8');
const DETAILS = readFileSync(new URL('../views/details.php', import.meta.url), 'utf8');
const RAIL = readFileSync(new URL('../views/controls-hot.php', import.meta.url), 'utf8');

/**
 * The screen word of a control and the word the question uses have to be the
 * same word, or the question names sliders the sheet does not have. They are
 * two files, so the pairing is held here rather than trusted.
 */
test('the sheet labels and the question labels are the same words', () => {
  const calls = [...SHEET.matchAll(/sheet_control\('([a-zA-Z]+)',\s*'((?:[^'\\]|\\.)*)'/g)];
  assert.ok(calls.length >= 13, 'the sheet still composes its controls through sheet_control()');
  for (const [, key, label] of calls) {
    assert.equal(PIN_LABELS[key], label.replace(/\\'/g, "'"), `${key} is called the same in both places`);
  }
});

/**
 * The sheet composes its heads through two PHP helpers, so what is held here
 * is the pairing: the helpers emit the word and the way back, and every
 * control reaches them — through `sheet_control()`, or by calling them itself
 * where the control is written out by hand (`Served ranks`, `Curve`,
 * `Handout`).
 */
test('every control on the sheet carries its state word and its own way back', () => {
  assert.match(SHEET, /function sheet_pin_head[^]*stateWord\('<\?= \$k \?>'\)/);
  assert.match(SHEET, /function sheet_pin_reset[^]*resetSlider\('<\?= \$k \?>'\)/);
  assert.match(SHEET, /function sheet_control[^]*sheet_pin_head\(\$key\)/);
  assert.match(SHEET, /function sheet_control[^]*sheet_pin_reset\(\$key, \$label\)/);
  for (const key of SHEET_KEYS) {
    if (key === 'depthStep') continue; // the step grid inside `Served ranks`, not a control of its own
    const marked = SHEET.includes(`sheet_control('${key}'`) || SHEET.includes(`sheet_pin_head('${key}'`);
    assert.ok(marked, `${key} shows pinned or auto`);
    const back = SHEET.includes(`sheet_control('${key}'`) || SHEET.includes(`sheet_pin_reset('${key}'`);
    assert.ok(back, `${key} has the single reach`);
  }
});

test('the rail under the plan marks its four the same way', () => {
  for (const key of ['players', 'depth', 'curve', 'rankFloor']) {
    assert.ok(RAIL.includes(`stateWord('${key}')`), `${key} is marked on the rail too`);
  }
});

test('the full reach hangs off the type row and asks before it acts', () => {
  assert.match(SHEET, /data-drop-all/);
  assert.match(SHEET, /askDrop\(/);
  assert.ok(!/@click="applyDrop\(\)"[^]*data-drop-all/.test(SHEET), 'the chip never drops outright');
});

test('the question is a bubble anchored at the button, and not the app one overlay', () => {
  assert.ok(SHEET.includes(DROP_BUBBLE.replace(/[[\]]/g, '')), 'the bubble carries the anchor hook');
  assert.match(SHEET, /placeConfirm\(\)/);
  assert.match(DETAILS, /data-bubble-frame/);
});

test('the bubble draws a title and a target per item, and no run-on list of names', () => {
  assert.match(SHEET, /x-for="item in dropQuestion\.items"/);
  assert.match(SHEET, /x-text="item\.label"/);
  assert.match(SHEET, /x-text="item\.to"/);
  assert.ok(!SHEET.includes('dropQuestion.names'), 'the comma-separated line is gone');
});
