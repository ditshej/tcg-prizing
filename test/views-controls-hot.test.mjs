import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('the RankPoolDepth counter shows the value, and the cap is a note beside it (#104 G3)', () => {
  const control = planControlMarkup('setDepth(');
  // The slider runs to the player count — that is the one cap this control
  // enforces (#61, "Caps at the controls": "auf die Spielerzahl gedeckelt
  // sind `depth` und `ranked`"), and `bounds('depth')` in `public/ui/controls.mjs`
  // returns the same for the sheet.
  assert.match(control, /:max="plan\.players"/, 'the slider still runs to the player count');
  // `depthCap` is a different number — how far the pool reaches at this floor
  // — and putting it in the counter read as a fraction of the slider's range
  // when it never was one. Measured cold: "8 of 15" beside a slider running
  // to 32 under weekly, "8 of 31" under weekend, both 32 under release.
  assert.doesNotMatch(
    control,
    /of\s*<span x-text="plan\.depthCap"/,
    'the counter pairs the value with a cap that is not the slider\'s range',
  );
  assert.match(
    control,
    /\(<span x-text="plan\.depth"><\/span>\)/,
    'the counter carries the value alone',
  );
  // The cap still has to be readable, as its own note — the short form of
  // what `Details` says under the same slider (`views/controls-sheet.php`).
  assert.match(
    control,
    /class="plan-control-note"\s+x-text="`cap \$\{plan\.depthCap\}`"/,
    'the depth cap is gone from the rail instead of standing beside the counter',
  );
});
