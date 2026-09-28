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
 */
?>
<div class="controls-hot">
  <label class="plan-control">
    <span>Players (<span x-text="settings.players"></span>)</span>
    <input type="range" min="2" max="128" :value="settings.players"
           @input="setPlayers($event.target.value)">
  </label>

  <label class="plan-control">
    <span>RankPoolDepth (<span x-text="plan.depth"></span> of <span x-text="plan.depthCap"></span>)</span>
    <input type="range" min="1" :max="plan.players" :value="plan.depth"
           @input="setDepth($event.target.value)">
  </label>

  <label class="plan-control">
    <span>DistributionCurve (<span x-text="settings.curve"></span>)</span>
    <!--
      Not x-model/:value: the seven options come from an x-for on a child
      <template>, and Alpine walks a parent's own bindings before its
      children exist — a select's value binding races the options it
      depends on and silently falls back to the first one. x-init runs
      after that first render settles ($nextTick), so it can select the
      right option once there is one to select.
    -->
    <select x-init="$nextTick(() => { $el.value = settings.curve })"
            @change="settings.curve = $event.target.value">
      <template x-for="step in curveSteps" :key="step.id">
        <option :value="step.id" x-text="step.id"></option>
      </template>
    </select>
  </label>

  <label class="plan-control">
    <span>RankFloor (<span x-text="settings.rankFloor"></span>)</span>
    <input type="number" min="0" :value="settings.rankFloor"
           @input="setRankFloor($event.target.value)">
  </label>
</div>
