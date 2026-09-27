<?php
/**
 * The Plan screen's static skeleton (#62): the head, participation line, diagram,
 * legend, tile grid and rank notice, then the four hot sliders as a
 * fixed bar underneath. Every `x-…` attribute below is static markup PHP
 * composes once; the values behind it come from `distribute()` in the
 * browser and never touch PHP (ADR 0004).
 *
 * `Plan` is now one of three pages (#63): shown only while `activePage` is
 * `'plan'`, folded to a single column with `Prepare` and `Details` until #71
 * builds the width/height fold. The four hot sliders are `controls-hot.php`,
 * the same partial `details.php` shows in its own Grundform — not a second
 * copy (#61, "die Schiene ist Details und war nie ein eigener Inhalt").
 *
 * Griffe an der Kachel, Meldungen und die Faltung folgen in
 * späteren Tickets (#62's own body) — this is the skeleton every one of them
 * builds into.
 */
?>
<div class="page-plan" x-show="activePage === 'plan'">
  <section class="plan-stage" x-ref="stage">
    <!--
      The fullscreen head is the prototype's `shead` (`fsContent()`): where you
      are, and how to get out — the tournament type and the player count, and
      nothing else. The page title, the pool line and the participation line
      are the *page's* head and stay behind, because fullscreen is "alles weg
      ausser dem Plan" (#61) and they are not the tiles.
    -->
    <header class="plan-head" x-ref="head">
      <h1 x-show="!fullscreen">Plan</h1>
      <p class="plan-type" x-text="`${typeTitle} · ${plan.players} players`"></p>
      <p class="plan-output" x-show="!fullscreen"
         x-text="`${plan.pool.booster} boosters · ${plan.pool.packs} tournament packs · ${plan.pool.winners} winner packs`"></p>
    </header>

    <div class="plan-participation" x-ref="participation" x-show="!fullscreen && !plan.combinedHandout">
      <span>Participation</span>
      <span
        x-text="`${plan.participation.rate.booster}/player boosters · ${plan.participation.booster} total`"></span>
    </div>

    <!--
      The diagram is not in fullscreen. The prototype's `fsContent()` carries a
      legend, the tile grid and the grid's foot line — no diagram — and the
      decision on #63 (2026-09-27) says it in words: "Das Vollbild zeigt nur die
      Kacheln, nicht das Diagramm." Keeping it here is what made fullscreen show
      *fewer* ranks than the page it opened from, because the diagram takes
      every pixel the controls rail and the foot give up.
    -->
    <div class="plan-diagram" aria-hidden="true" x-show="!fullscreen">
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

    <div class="plan-grid-wrap">
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

      <!--
        The tiles are the grip: #63 AC 4 grabs fullscreen at the tile grid and
        leaves it at the same corner it was opened from — the same button,
        same spot, only the icon and label swap. It sits over the grid's own
        wrap (not the scrolling grid itself) so it never scrolls away with the
        tiles.
      -->
      <button type="button" class="grid-fullscreen-toggle"
              @click="fullscreen ? closeFullscreen() : openFullscreen()"
              :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'">
        <span aria-hidden="true" x-text="fullscreen ? '⤡' : '⤢'"></span>
      </button>
    </div>

    <!--
      The rank total belongs to the diagram — the prototype prints it above the
      bars, not under the tiles — so it leaves with the diagram. The rank
      message below it is the grid's own foot (`slotFoot()`) and stays: it is
      the only statement about the ranks that have no tile at all.
    -->
    <p class="plan-ranktotal" x-ref="ranktotal" x-show="!fullscreen"
       x-text="`${rankTotalBooster} boosters ${rankTotalLabel}`"></p>
    <p class="plan-rest" x-ref="rest" x-show="restMessage" x-text="restMessage"></p>
  </section>

  <section class="plan-controls" x-show="!fullscreen">
    <?php require __DIR__ . '/controls-hot.php'; ?>
  </section>
</div>
