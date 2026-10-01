import test from 'node:test';
import assert from 'node:assert/strict';

import { planApp } from '../public/ui/plan.mjs';
import { confirmFirst } from '../public/ui/confirm-first.mjs';

/**
 * "Erst bestätigen" (#113, K4 of run 12): a press outside a field holding an
 * unconfirmed number confirms it and activates nothing else.
 *
 * What is proven here is the model half: which press confirms, that the
 * value then stands, and that the press's `click` is swallowed — driven
 * through the real `planApp()` and the real handlers, with event-like objects
 * standing in for the DOM. A press is simulated the way a browser delivers
 * it: `pointerdown`, `mousedown`, `click`, each first through the capture
 * handler, and the control's own handler only if the event was not stopped.
 * That a capture listener on the document really runs before Alpine's
 * `@click`, on mouse and touch alike, is DOM behaviour and is not provable
 * under `node --test`.
 */

function opened(query = '?v=1&game=onepiece&type=weekly&rankFloor=8&depth=32') {
  return planApp({ read: () => query, write: () => {} });
}

/** An element as far as the handlers look at it. */
function element({ field = null, tag = 'button' } = {}) {
  const el = {
    tag,
    value: '',
    dataset: field ? { numberField: field } : {},
    closest(selector) {
      if (selector === '[data-number-field]') return field ? el : null;
      if (selector === 'select') return tag === 'select' ? el : null;
      return null;
    },
  };
  return el;
}

/** One press on `target`: the three events, capture first, then the control. */
function press(guard, target, activate = () => {}) {
  const log = { defaultPrevented: {}, stopped: false, activated: false };
  for (const type of ['pointerdown', 'mousedown', 'click']) {
    let stopped = false;
    const event = {
      type,
      target,
      preventDefault() {
        log.defaultPrevented[type] = true;
      },
      stopPropagation() {
        stopped = true;
      },
      stopImmediatePropagation() {
        stopped = true;
      },
    };
    guard[type](event);
    if (type === 'click') {
      log.stopped = stopped;
      if (!stopped) {
        activate();
        log.activated = true;
      }
    }
  }
  return log;
}

/** The app with a field typed into and holding the focus. */
function typing(key, text, app = opened()) {
  const field = element({ field: key, tag: 'input' });
  field.value = text;
  app.draft(key, text);
  const guard = confirmFirst(app, { focused: () => field });
  return { app, field, guard };
}

test('a press on another control confirms the typed number, and the control does nothing', () => {
  const { app, field, guard } = typing('players', '64');
  const floorBefore = app.settings.rankFloor;
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(app.value('players'), 64, 'the typed number counts');
  assert.equal(app.pins.players, 64, 'and is pinned, as a commit is');
  assert.equal(log.activated, false, 'the control under the press did nothing');
  assert.equal(log.stopped, true);
  assert.equal(log.defaultPrevented.click, true);
  assert.equal(app.settings.rankFloor, floorBefore);
  assert.equal(field.value, '64', 'the field shows what stands');
  assert.equal(app.pendingDraft, null);
});

test('the second press activates', () => {
  const { app, guard } = typing('players', '64');
  press(guard, element(), () => app.setSlider('rankFloor', 0));
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(log.activated, true);
  assert.equal(app.settings.rankFloor, 0);
});

test('the guard is generic: − and + of the same row, and of any other, are swallowed alike', () => {
  for (const [key, delta] of [['players', 1], ['players', -1], ['boosterRate', 1]]) {
    const { app, guard } = typing('players', '40');
    const before = app.value(key === 'players' ? 'boosterRate' : key);
    const log = press(guard, element(), () => app.step(key, delta));
    assert.equal(log.activated, false, `${key} ${delta}`);
    assert.equal(app.value('players'), 40);
    if (key !== 'players') assert.equal(app.value(key), before);
  }
});

test('a field that only has the focus blocks nothing', () => {
  const app = opened();
  const field = element({ field: 'players', tag: 'input' });
  const guard = confirmFirst(app, { focused: () => field });
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(log.activated, true);
  assert.equal(app.settings.rankFloor, 0);
});

test('a field holding the number it already shows blocks nothing, and pins nothing', () => {
  const app = opened();
  const { guard } = typing('players', ` ${app.value('players')} `, app);
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(log.activated, true);
  assert.equal(app.pins.players, undefined);
});

test('Enter and Escape leave nothing to confirm, and block nothing', () => {
  const entered = typing('players', '64');
  entered.app.commitTyped('players', '64');
  assert.equal(press(entered.guard, element(), () => {}).activated, true);
  assert.equal(entered.app.value('players'), 64);

  const escaped = typing('players', '64');
  const standing = escaped.app.value('players');
  escaped.app.discardDraft('players');
  assert.equal(press(escaped.guard, element(), () => {}).activated, true);
  assert.equal(escaped.app.value('players'), standing);
});

test('a press into another number field confirms, and is no activation', () => {
  const { app, guard } = typing('players', '64');
  const other = element({ field: 'boosterRate', tag: 'input' });
  const log = press(guard, other);
  assert.equal(app.value('players'), 64);
  assert.equal(log.defaultPrevented.pointerdown, undefined, 'focus is free to land there');
  assert.equal(log.defaultPrevented.mousedown, undefined);
});

test('a press into the field itself is typing, not leaving', () => {
  const { app, field, guard } = typing('players', '64');
  const standing = app.value('players');
  const log = press(guard, field);
  assert.equal(log.activated, true, 'nothing swallowed');
  assert.equal(app.value('players'), standing, 'nothing confirmed');
  assert.equal(app.pendingDraft, 'players');
});

test('a select is held shut while the press only confirms', () => {
  const { guard } = typing('players', '64');
  const log = press(guard, element({ tag: 'select' }));
  assert.equal(log.defaultPrevented.mousedown, true);
});

test('a typed text that is no number is confirmed as nothing, and the press is still swallowed', () => {
  const { app, field, guard } = typing('players', 'abc');
  const standing = app.value('players');
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(log.activated, false);
  assert.equal(app.value('players'), standing);
  assert.equal(app.pins.players, undefined);
  assert.equal(field.value, String(standing), 'the field falls back to what stands');
});

test('a press that never clicked does not eat the next one', () => {
  const { app, guard } = typing('players', '64');
  guard.pointerdown({ target: element(), preventDefault() {} });
  guard.pointercancel();
  assert.equal(guard.armed, false);
  const log = press(guard, element(), () => app.setSlider('rankFloor', 0));
  assert.equal(log.activated, true);

  const again = typing('players', '64');
  again.guard.pointerdown({ target: element(), preventDefault() {} });
  // No click came (the control vanished under the confirm); the next press
  // finds nothing pending and disarms before its own click.
  assert.equal(press(again.guard, element(), () => {}).activated, true);
});
