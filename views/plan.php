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

    <!--
      The tile is the grip (#66): it opens the bubble, and the same grip closes
      it. So it is a `button` and not a `div` with a click handler — the whole
      square is the target, a 54px one, and the keyboard reaches it for free.

      `tile(row).classes` carries the four states the tile says as form rather
      than as words: 2×2 from the first Display on, the settled tone, the
      weakened unserved tile, and the `flagged` mark — the last of which is
      load-bearing, because a minimised ConflictNotice would otherwise leave a
      conflicting plan looking valid.
    -->
    <div class="plan-grid-wrap">
      <div class="plan-grid" x-ref="grid" @scroll="placeBubble()">
        <template x-for="row in tiles" :key="row.rank">
          <button type="button" class="tile" :class="tile(row).classes" :data-rank="row.rank"
                  :aria-expanded="openTile === row.rank"
                  :aria-label="`Rank ${row.rank}`"
                  @click="toggleTile(row.rank)">
            <span class="tile-rank" x-text="row.rank"></span>
            <span class="tile-booster" x-text="row.booster > 0 ? row.booster : '—'"></span>
            <template x-if="tile(row).displayLabel">
              <span class="tile-displays" x-text="tile(row).displayLabel"></span>
            </template>
            <template x-if="row.winners === 1"><span class="mark mark-winner dot"></span></template>
            <template x-if="row.winners > 1"><span class="mark mark-winner circle" x-text="row.winners"></span></template>
            <template x-if="row.packs === 1"><span class="mark mark-pack dot"></span></template>
            <template x-if="row.packs > 1"><span class="mark mark-pack circle" x-text="row.packs"></span></template>
          </button>
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

    <!--
      The one bubble of the app, in its first inhabitant (#66). It is **no
      overlay** — the app has exactly one of those and it is the LinkMigration
      report — so it hangs off the tile, flips upward where there is no room
      below, stays inside the stage, and closes as soon as its anchor has left
      the grid's window. `placeBubble()` in `plan.mjs` is the measuring, the
      arithmetic is `bubble.mjs`.

      Both counters write into the same fields the rest of the app writes: the
      DisplayReservation and the `manual` share of the WinnerPackAllocation.
      What `ranked` handed out is shown and not touched — its minus is closed,
      and the sentence under the counter says why.
    -->
    <div class="bubble" x-ref="bubble" x-show="grip" x-cloak>
      <template x-if="grip">
        <div>
          <div class="bubble-head">
            <strong x-text="`Rank ${grip.rank}`"></strong>
            <span class="bubble-by">by hand</span>
            <button type="button" class="bubble-close" aria-label="Close" @click="closeTile()">✕</button>
          </div>

          <div class="bubble-row">
            <span class="bubble-label">Winner packs</span>
            <div class="counter">
              <button type="button" :disabled="!grip.winners.canRemove"
                      :title="grip.winners.removeReason" aria-label="One less"
                      @click="stepWinners(-1)">−</button>
              <span class="counter-value" x-text="grip.winners.value"></span>
              <button type="button" :disabled="!grip.winners.canAdd"
                      :title="grip.winners.addReason" aria-label="One more"
                      @click="stepWinners(1)">+</button>
            </div>
          </div>
          <p class="bubble-note" x-text="grip.winners.note"></p>

          <template x-if="grip.displays">
            <div>
              <div class="bubble-row">
                <span class="bubble-label">Displays</span>
                <div class="counter">
                  <button type="button" :disabled="!grip.displays.canRemove"
                          :title="grip.displays.removeReason" aria-label="One less"
                          @click="stepDisplays(-1)">−</button>
                  <span class="counter-value" x-text="grip.displays.value"></span>
                  <button type="button" :disabled="!grip.displays.canAdd"
                          :title="grip.displays.addReason" aria-label="One more"
                          @click="stepDisplays(1)">+</button>
                </div>
              </div>
              <p class="bubble-note" x-text="grip.displays.note"></p>
            </div>
          </template>

          <template x-if="!grip.displays">
            <p class="bubble-note" x-text="grip.wayIn"></p>
          </template>
        </div>
      </template>
    </div>
  </section>

  <section class="plan-controls" x-show="!fullscreen">
    <?php require __DIR__ . '/controls-hot.php'; ?>
  </section>
</div>
