<?php
/**
 * The four hot sliders — Players, RankPoolDepth, DistributionCurve, RankFloor
 * (#61, "The controls") — as their own partial (#63): the fixed rail under
 * `Plan` (`plan.php`), and since #64 nothing else.
 *
 * It was included twice while `Details` stood in its Grundform, which was the
 * same four sliders. #64 filled that page, and its body is `controls-sheet.php`
 * — the sheet shows an explanation under every title and a counter, and the
 * rail shows neither, so the two forms genuinely differ and the sheet could not
 * be reached by adding to this file. What still holds is that both call the
 * same handlers in `plan.mjs`, so they cannot drift in what they *do*; #61
 * names the rail literally the same content as `Details` ("die Schiene ist
 * Details und war nie ein eigener Inhalt"), and #71, which folds the page into
 * columns, is where this partial stops existing separately.
 *
 * Every `x-…` attribute is static markup composed once by PHP; the values and
 * handlers come from `planApp()` (ADR 0004).
 *
 * #67 marks these four as well. The marking belongs to the *control*, not to
 * the sheet: the rail and the sheet are the same four controls in two forms
 * (#61, "die Schiene **ist** `Details`"), and a slider that reads `pinned` on
 * one page and says nothing on the other would make the state look like a
 * property of the page. The prototype builds both from one `slider()`, where
 * only the explanation text hangs on the context. What stays off the rail is
 * the way back: the reset is a second button per control, and the rail is a
 * fixed strip whose height the fold arithmetic counts — the way back is one
 * page switch away, and #71 folds the two together anyway.
 */
?>
<div class="controls-hot">
  <label class="plan-control">
    <span>Players (<span x-text="settings.players"></span>)<span class="pin-state"
          :class="`is-${stateWord('players')}`" x-text="stateWord('players')"></span></span>
    <input type="range" min="2" max="128" :value="settings.players"
           @input="setPlayers($event.target.value)">
  </label>

  <label class="plan-control">
    <!--
      The counter shows the value and nothing else, and `depthCap` stands
      beside it as its own note (#104). "8 of 15" read as a fraction of the
      slider's range and was not one: the slider runs to the player count
      (#61, "Caps at the controls" — "auf die Spielerzahl gedeckelt sind
      `depth` und `ranked`"), while `depthCap` is how far the pool reaches at
      this floor, which the core computes and no control enforces. Measured
      cold: "8 of 15" beside a slider running to 32 under weekly, "8 of 31"
      under weekend, both 32 under release — a gap of 17, 1 and 0, hanging on
      the sheet rather than on an off-by-one.

      `Details` says the same thing under its slider ("the pool covers N ranks
      at this floor", `controls-sheet.php`); the rail is a fixed strip whose
      height the fold arithmetic counts, so it takes the prototype's short
      form of that note instead of a third line.
    -->
    <span>RankPoolDepth (<span x-text="plan.depth"></span>)<span class="pin-state"
          :class="`is-${stateWord('depth')}`" x-text="stateWord('depth')"></span><span class="plan-control-note"
          x-text="`cap ${plan.depthCap}`"></span></span>
    <input type="range" min="1" :max="plan.players" :value="plan.depth"
           @input="setDepth($event.target.value)">
  </label>

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

  <label class="plan-control">
    <span>RankFloor (<span x-text="settings.rankFloor"></span>)<span class="pin-state"
          :class="`is-${stateWord('rankFloor')}`" x-text="stateWord('rankFloor')"></span></span>
    <input type="number" min="0" :value="settings.rankFloor"
           @input="setRankFloor($event.target.value)">
  </label>
</div>
