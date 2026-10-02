<?php
/**
 * The four hot ones — Players, RankPoolDepth, DistributionCurve, RankFloor
 * (#61, "The controls") — as the fixed rail under `Plan` (`plan.php`).
 *
 * Since #113 the rail **is the sheet's row**, without the explanation text:
 * the three numbers are drawn by `control_row()` (`control-row.php`), the
 * same function `controls-sheet.php` draws all fourteen with. #61 named the
 * rail literally the same content as `Details` ("die Schiene ist Details und
 * war nie ein eigener Inhalt"); its own form — a title with the number in
 * brackets over a slider, and no way back — existed only because of the
 * slider. So the rail now carries what the row carries: the sheet's titles,
 * the counter with its typed field, the state word, the way back, and `cap N`
 * on the title line of `Served ranks`, where it fits now that no slider line
 * makes the row two lines high (K4 of run 11, which #67 hung on #113). What it
 * leaves out is the explanation text (#64 AC 9), and the step grid of
 * `Served ranks`, which is `depthStep` — a choice and not a number, and not
 * one of the hot four.
 *
 * The curve stays the `<select>` it was (#104), and that is #113's own line:
 * `curve`, `depthStep` and `combinedHandout` keep their form.
 *
 * Every `x-…` attribute is static markup composed once by PHP; the values and
 * handlers come from `planApp()` (ADR 0004).
 */

require_once __DIR__ . '/control-row.php';
?>
<div class="controls-hot">
  <?php control_row('players', 'Players'); ?>

  <?php control_row('depth', 'Served ranks', '', '`cap ${plan.depthCap}`'); ?>

  <label class="plan-control">
    <span>DistributionCurve (<span x-text="settings.curve"></span>)<span class="pin-state"
          :class="`is-${stateWord('curve')}`" x-text="stateWord('curve')"></span></span>
    <!--
      Not x-model/:value: the seven options come from an x-for on a child
      <template>, and Alpine walks a parent's own bindings before its
      children exist — a select's value binding races the options it
      depends on and silently falls back to the first one. x-init runs
      after that first render settles ($nextTick), so it can select the
      right option once there is one to select.

      That first write is not the last one settings.curve needs, though
      (#104): the sheet, a SetupLink or a Set switch can all move it from
      outside this rail, and a select's own value never follows a change
      made to it in script. The $watch below, registered once the options
      exist, is what keeps $el.value on settings.curve after that.
    -->
    <select x-init="$nextTick(() => {
              $el.value = settings.curve
              $watch('settings.curve', (value) => { $el.value = value })
            })"
            @change="setSlider('curve', $event.target.value)">
      <template x-for="step in curveSteps" :key="step.id">
        <option :value="step.id" x-text="step.id"></option>
      </template>
    </select>
  </label>

  <?php control_row('rankFloor', 'Min boosters per rank'); ?>
</div>
