/**
 * "Erst bestätigen" (#113, K4 of run 12): while a typed number stands
 * **unconfirmed** in its field, no other control activates. A press anywhere
 * outside the field confirms the number and does nothing else — it is
 * swallowed. Then the recomputed plan stands there, with its recomputed
 * notices, and the next press is a deliberate one.
 *
 * The measured case it answers: `?v=1&game=onepiece&type=weekly&rankFloor=8&depth=32`,
 * `Players` typed to 64 and not confirmed, a press on "Floor down to 0". The
 * way on screen was computed for the stand *before* the 64, so the press
 * would have done one thing and the commit underneath it another. Now the 64
 * counts, nothing else happens, and the notice offers "Floor down to 1".
 *
 * What it leaves alone, word for word from the decision:
 *
 * - **"Unconfirmed" means the field's text differs from the value standing**
 *   (`planApp().pendingDraft`). A field that merely has focus blocks nothing.
 * - **Enter and Escape** confirm and discard as before, and block nothing:
 *   both leave no draft behind.
 * - **Focus landing in another number field is not an activation.** The
 *   press still confirms, and the field it landed in takes the focus.
 *
 * It is generic on purpose: it knows the number fields (by
 * `data-number-field`) and nothing about what else stands on screen, so it
 * covers the ways of a `ConflictNotice`, `Copy link`, the `Offer` and every
 * control a later branch adds without learning about any of them.
 *
 * ## How
 *
 * Capture phase on the document, so it runs before any control's own
 * handler. A `pointerdown` — mouse and touch alike, and on a phone the tap
 * away is *the* way to leave a field (#113: "keine Abbruchgeste") — confirms
 * and arms; the `click` that follows is swallowed once. A `pointerdown` that
 * finds nothing pending disarms, so a stale arming (a press that turned into
 * a scroll and never clicked) cannot eat a later press.
 *
 * A `<select>` opens on `mousedown`, not on `click`; that one is held shut
 * while armed, or its list would open over the plan the confirm just changed.
 *
 * The handlers are plain functions over event-like objects so that
 * `node --test` can drive them with the real `planApp()`; the listening
 * itself (`attachConfirmFirst()`) is the thin DOM rind around them.
 */

const NUMBER_FIELD = '[data-number-field]';

function closest(target, selector) {
  return target && typeof target.closest === 'function' ? target.closest(selector) : null;
}

function swallow(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

/**
 * The four handlers over `app` — the Plan component, or anything with
 * `pendingDraft`, `confirmDraft()` and `value(key)`. `focused()` answers the
 * element that has the focus, which is the field holding the draft.
 */
export function confirmFirst(app, { focused = () => null } = {}) {
  let armed = false;

  return {
    get armed() {
      return armed;
    },

    pointerdown(event) {
      armed = false;
      const key = app.pendingDraft;
      if (key == null) return;
      const field = focused();
      // A press into the field itself is typing, not leaving it.
      if (field && (event.target === field || closest(event.target, NUMBER_FIELD) === field)) return;
      app.confirmDraft();
      // The text in the field goes back to what stands. A number held at a
      // wall onto the value already showing would not redraw it otherwise,
      // and the `blur` that follows would read the stale text.
      if (field && closest(field, NUMBER_FIELD) === field) field.value = String(app.value(key));
      armed = true;
    },

    mousedown(event) {
      if (armed && closest(event.target, 'select')) event.preventDefault();
    },

    click(event) {
      if (!armed) return;
      armed = false;
      swallow(event);
    },

    pointercancel() {
      armed = false;
    },
  };
}

/** Listens on `doc` in the capture phase; returns the function that stops it. */
export function attachConfirmFirst(doc, app) {
  const handlers = confirmFirst(app, { focused: () => doc.activeElement });
  const types = ['pointerdown', 'mousedown', 'click', 'pointercancel'];
  for (const type of types) doc.addEventListener(type, handlers[type], true);
  return () => {
    for (const type of types) doc.removeEventListener(type, handlers[type], true);
  };
}
