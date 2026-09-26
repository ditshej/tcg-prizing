<?php
/**
 * The Plan screen's static skeleton (#62): the head, handout line, diagram,
 * legend, tile grid and rank notice, then the four hot sliders as a
 * fixed bar underneath. Every `x-…` attribute below is static markup PHP
 * composes once; the values behind it come from `distribute()` in the
 * browser and never touch PHP (ADR 0004).
 *
 * Griffe an der Kachel, weitere Seiten, Meldungen und die Faltung folgen in
 * späteren Tickets (#62's own body) — this is the skeleton every one of them
 * builds into.
 */
?>
<div class="app" x-data="planApp()" x-init="init()">
  <section class="plan-stage" x-ref="stage">
    <header class="plan-head" x-ref="head">
      <h1>Plan</h1>
      <p class="plan-type" x-text="`${typeTitle} · ${plan.players} players`"></p>
      <p class="plan-output"
         x-text="`${plan.pool.booster} boosters · ${plan.pool.packs} tournament packs · ${plan.pool.winners} winner packs`"></p>
    </header>

    <div class="plan-handout" x-ref="handout" x-show="!plan.combinedHandout">
      <span>Handout</span>
      <span
        x-text="`${plan.participation.rate.booster}/player boosters · ${plan.participation.booster} total`"></span>
    </div>

    <div class="plan-diagram" aria-hidden="true">
      <template x-for="row in plan.rows" :key="row.rank">
        <div class="bar" :class="{ 'bar-unserved': !row.served }">
          <div class="seg-reservation" :style="`height:${segments(row).reservation}%`"></div>
          <div class="seg-floor" :style="`height:${segments(row).floor}%`"></div>
          <div class="seg-shaped" :style="`height:${segments(row).shaped}%`"></div>
        </div>
      </template>
    </div>

    <div class="plan-legend" x-ref="legend">
      <span class="legend-item"><span class="mark mark-winner circle" style="position:static">N</span> winner packs</span>
      <span class="legend-item"><span class="mark mark-pack circle" style="position:static">N</span> tournament packs</span>
      <span class="legend-item"><span class="mark mark-winner dot" style="position:static"></span> one of either</span>
    </div>

    <div class="plan-grid" x-ref="grid">
      <template x-for="row in tiles" :key="row.rank">
        <div class="tile" :class="{ 'tile-unserved': !row.served }">
          <span class="tile-rank" x-text="row.rank"></span>
          <span class="tile-booster" x-text="row.booster > 0 ? row.booster : '—'"></span>
          <template x-if="row.winners === 1"><span class="mark mark-winner dot"></span></template>
          <template x-if="row.winners > 1"><span class="mark mark-winner circle" x-text="row.winners"></span></template>
          <template x-if="row.packs === 1"><span class="mark mark-pack dot"></span></template>
          <template x-if="row.packs > 1"><span class="mark mark-pack circle" x-text="row.packs"></span></template>
        </div>
      </template>
    </div>

    <p class="plan-ranktotal" x-ref="ranktotal"
       x-text="`${rankTotalBooster} boosters ${rankTotalLabel}`"></p>
    <p class="plan-rest" x-ref="rest" x-show="restMessage" x-text="restMessage"></p>
  </section>

  <section class="plan-controls">
    <label class="plan-control">
      <span>Players (<span x-text="settings.players"></span>)</span>
      <input type="range" min="2" max="128" :value="settings.players"
             @input="setPlayers($event.target.value)">
    </label>

    <label class="plan-control">
      <span>RankPoolDepth (<span x-text="plan.depth"></span> of <span x-text="plan.depthCap"></span>)</span>
      <input type="range" min="1" :max="plan.depthCap" :value="plan.depth"
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
  </section>
</div>
