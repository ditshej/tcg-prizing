<?php
/**
 * The Plan screen's static skeleton (#62): the head, participation line, diagram,
 * legend, tile grid and rank notice, then the four hot controls as a
 * fixed bar underneath. Every `x-…` attribute below is static markup PHP
 * composes once; the values behind it come from `distribute()` in the
 * browser and never touch PHP (ADR 0004).
 *
 * `Plan` is now one of three pages (#63): shown only while `activePage` is
 * `'plan'`, folded to a single column with `Prepare` and `Details` until #71
 * builds the width/height fold. The four hot controls are `controls-hot.php`,
 * whose number rows are the same `control_row()` the sheet in `details.php`
 * draws (#113) — not a second copy (#61, "die Schiene ist Details und war nie
 * ein eigener Inhalt").
 *
 * Griffe an der Kachel, Meldungen und die Faltung folgen in
 * späteren Tickets (#62's own body) — this is the skeleton every one of them
 * builds into.
 */
?>
<div class="page-plan" x-show="shows('plan')">
  <section class="plan-stage" x-ref="stage">
    <!--
      The fullscreen head is the prototype's `shead` (`fsContent()`): where you
      are, and how to get out — the tournament type and the player count, and
      nothing else. The page title, the pool line and the participation line
      are the *page's* head and stay behind, because fullscreen is "alles weg
      ausser dem Plan" (#61) and they are not the tiles.
    -->
    <!--
      The column head (#71), in the one form all three columns share: a title
      line — the word, and beside it the column's facts, small and quiet — and,
      for the `Plan` alone, a second line, because its output line is a fact
      and not a caption. The word stands in exactly one of two places: in the
      foot while the page is a page, here once it is a column (`titled()`).
      The title line keeps its height either way, so the head is the same
      shape whether the word is there or in the foot.
    -->
    <header class="col-head plan-head" x-ref="head">
      <div class="col-titleline">
        <h1 class="col-title" x-show="titled('plan')">Plan</h1>
        <span class="col-facts plan-type" x-text="`${typeTitle} · ${plan.players} players`"></span>
      </div>
      <p class="col-sub plan-output" x-show="!fullscreen"
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

    <!--
      The legend is where the WinnerRaffle is operated from (#69): the grip
      sits on the `winner` entry — the key to exactly the mark the raffle
      produces — so it does not stand far from its own output. `pack` goes
      first and stays flat text, so the row does not begin with a button; the
      grip is the exception at the end rather than the rule at the start
      (prototype, `slotLegend()`).

      It is **never disabled**, not even with nothing left to trigger. Locked
      is the trigger *inside* the bar; locking the way to the bar would put
      the retraction list out of reach after the last throw, which is exactly
      when it is wanted.
    -->
    <div class="plan-legend" x-ref="legend">
      <span class="legend-item"><span class="mark mark-pack circle" style="position:static">N</span> pack</span>
      <button type="button" class="legend-handle" :aria-expanded="raffleOpen"
              title="Winner raffle" @click="toggleRaffle()">
        <span class="mark mark-winner circle" style="position:static">N</span>
        <span>winner</span>
        <span class="legend-dice" aria-hidden="true">🎲</span>
        <span class="legend-open" x-show="raffle.open > 0" x-text="raffle.open"></span>
      </button>
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
    <!--
      `x-effect` and not a line in `init()`: the raffle bar's height grows with
      its retraction list, so the padding that lets the tiles scroll behind it
      has to be re-measured whenever that list, the bar's open state or the
      fullscreen changes. `measureRaffle()` reads exactly those on its first
      line, which is what the effect subscribes to (#69 AC 3).
    -->
    <div class="plan-grid-wrap" x-effect="measureRaffle()">
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

  <section class="plan-controls" x-show="fold.rail !== 'none'">
    <?php require __DIR__ . '/controls-hot.php'; ?>
  </section>

  <!--
    The WinnerRaffle's fixed bar (#69), over the foot navigation and **not** a
    bubble at the grip: the retraction list grows with every throw, and a
    surface whose height depends on its data must not cling to an anchor —
    measured, it grew from 112 to 201px and tipped over the tiles at the
    second hit, so it jumped exactly when it was being used.

    It belongs to the `Plan` column, so it is a child of `page-plan` rather
    than of the app: leaving `Plan` hides it with the page and coming back
    shows it again, and in fullscreen it becomes full width by itself because
    there the `Plan` column is the whole screen. One rule, no `if` on the
    surface — the same shape as the padding under the grid.

    Four things in this order and **no head of its own**: it opens out of a
    grip that already carries the word. The announcement has **no ✕** —
    taking back happens in the rank-sorted list or at the tile, that is, only
    by naming the `Rank`, which is what tells correcting apart from
    re-rolling (#35). The bar's own ✕ in the top row is something else: it
    closes the bar and retracts nothing.
  -->
  <div class="raffle-bar" x-ref="raffle" x-show="raffleOpen" x-cloak>
    <div class="raffle-top">
      <button type="button" class="raffle-trigger" :disabled="!raffle.canRaffle"
              @click="throwRaffle()">
        <span aria-hidden="true">🎲</span> Raffle
      </button>
      <p class="raffle-stand">
        <span x-text="raffle.stand"></span>
        <template x-if="raffle.potEmptyNote">
          <span class="raffle-empty" x-text="raffle.potEmptyNote"></span>
        </template>
      </p>
      <button type="button" class="raffle-close" aria-label="Close" @click="closeRaffle()">✕</button>
    </div>

    <!--
      All thirteen steps, uncut and unfolded (AC 4). The grid costs a measured
      28 of 227px; shortening it would take five steps #10 deliberately has,
      folding it would cost a tap in exactly the case the range is there for.
      Two rows, `all` opening the lower one across two cells so that every
      lower chip stands under the upper one carrying the same fraction.
    -->
    <div class="raffle-ranges" role="group" aria-label="Raffle range">
      <template x-for="(row, i) in raffleRows" :key="i">
        <div class="raffle-range-row">
          <template x-for="chip in row" :key="chip.id">
            <button type="button" class="raffle-range" :class="{ 'raffle-range-wide': chip.wide }"
                    :aria-pressed="raffleRange === chip.id" :title="chip.name"
                    @click="setRaffleRange(chip.id)">
              <span class="raffle-arrow" aria-hidden="true" x-text="chip.arrow"></span><span x-text="chip.icon"></span>
            </button>
          </template>
        </div>
      </template>
    </div>

    <template x-if="raffle.hit">
      <p class="raffle-hit">
        <strong x-text="`Rank ${raffle.hit}`"></strong>
        <span class="raffle-hit-said">drew a winner pack</span>
      </p>
    </template>

    <template x-if="raffle.takeBack.length">
      <div class="raffle-takeback">
        <p class="raffle-takeback-head">Placed by hand — tap to take back:</p>
        <div class="raffle-takeback-list">
          <template x-for="entry in raffle.takeBack" :key="entry.rank">
            <button type="button" class="raffle-chip" @click="takeBackWinner(entry.rank)"
                    :aria-label="`Take back ${entry.label}`">
              <span x-text="entry.label"></span>
              <span x-show="entry.count > 1" x-text="`×${entry.count}`"></span>
              <span aria-hidden="true">✕</span>
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</div>
