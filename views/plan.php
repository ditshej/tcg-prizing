<?php
/**
 * The Plan screen's static skeleton (#62): the head, participation line, diagram,
 * legend, tile grid and rank notice, then the four hot controls as a
 * fixed bar underneath. Every `x-…` attribute below is static markup PHP
 * composes once; the values behind it come from `distribute()` in the
 * browser and never touch PHP (ADR 0004).
 *
 * `Plan` is one of three pages (#63), and with the fold (#71) one of up to three
 * columns: shown while it is the active page or stands as a column
 * (`shows('plan')`). The four hot controls are `controls-hot.php`,
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
      line — the title, and beside it the column's facts, small and quiet —
      and, for the `Plan` alone, a second line, because its output line is a
      fact and not a caption. The head is the prototype's `colHead()` whole, on
      every fold and on the phone too (#156, F1 a): the title stands here
      whether or not the foot carries the page's word as well. The `Plan` is
      titled by its `TournamentType` — the catalog title, `Weekly` — not by the
      word `Plan`, which stays the foot's; its facts are the player count alone
      (#156, K2): the booster total stands once, at the head of the output line
      below, and not a second time beside the title. The title line is 22 high with the title in it or not
      (`.col-titleline`), so the head keeps its 40 and `PLAN_FIXED` its 178.
    -->
    <!--
      Share and Reset-all, top right (#143, decisions 1–3, overruling #72 AC 1
      and the type title of #67): icons alone, the word as `aria-label` and
      tooltip. They stand beside the two lines rather than in the title line:
      `.col-titleline` clips (`overflow: hidden`) and is 22 high, so a 44 px
      hit area there would be cut, and a 32 px drawing would grow the head
      and with it `PLAN_FIXED`. Here, beside both lines, the 32 px drawing
      stays inside the head's height and the hit area reaches 6 past it into
      the stage's padding and the gap below — over no other target.

      Reset-all is the full reach of the way back and asks first (stories 17,
      18; `askDrop()`); it carries the count of what it would drop — the pin
      counter, the length of the list the question reads out (#67 AC 6) — and
      is gone while nothing is set by hand, as the chip it replaces was: a
      reach over nothing is not an offer. Share (#155) opens the system's
      share sheet with the complete `SetupLink` wherever `navigator.share`
      exists, and only where it does not the bubble below with `Copy link`
      (`share()`; K3 — the pointer plays no part). Neither stands in
      fullscreen, whose head is only "where you are, and how to get out".
    -->
    <header class="col-head plan-head" x-ref="head">
      <div class="col-titleline">
        <h1 class="col-title" x-show="titled('plan')" x-text="typeTitle"></h1>
        <span class="col-facts plan-type"
              x-text="fullscreen ? `${typeTitle} · ${plan.players} players` : `${plan.players} players`"></span>
      </div>
      <p class="col-sub plan-output" x-show="!fullscreen"
         x-text="`${plan.pool.booster} boosters · ${plan.pool.packs} packs · ${plan.pool.winners} winner packs`"></p>
      <div class="plan-head-actions" x-show="!fullscreen">
        <button type="button" class="plan-reset" data-drop-all x-cloak x-show="pinCount > 0"
                :aria-expanded="!!dropQuestion" :aria-label="dropAllLabel" :title="dropAllLabel"
                @click="askDrop({ keys: handSetKeys, anchor: '[data-drop-all]' })"><?= icon('rotate-ccw') ?><span
                class="plan-reset-count" aria-hidden="true" x-text="pinCount"></span></button>
        <button type="button" class="plan-share" data-share aria-label="Share" title="Share"
                :aria-expanded="shareOpen" @click="share()"><?= icon('share') ?></button>
      </div>
    </header>

    <!--
      The bubble at Share (#155, the branch without `navigator.share`; K3:
      wherever `navigator.share` exists, whatever the pointer, the system's
      sheet is the whole answer and this opens only when the sheet fails
      with something other than a cancel). A press at Share opens it and copies nothing; it says in one
      sentence what travels and carries `Copy link`, which copies the complete
      `SetupLink` and is called `Copied` for `COPIED_MS` — fleeting, as
      `data-link-copied` on the button (`flashCopied()`), the component keeps
      nothing (#72 AC 3). Without a clipboard `execCommand('copy')` is tried;
      only if that fails too does the address open here in a preselected
      field, and `Copied` does not appear (#72 AC 4). The same press at Share,
      Escape, or a press beside it closes it — the press at Share is left to
      the toggle, or it would close and reopen in one go. Placed by
      `placeShare()` (#154), fixed in the viewport like the drop question;
      `keepShare()` closes it when its anchor is gone (#66), which fullscreen
      and the phone's other pages do.
    -->
    <div class="share-bubble" data-share-bubble role="dialog" aria-label="Share"
         :class="{ 'is-open': shareOpen }"
         x-effect="void [shareOpen, linkField, activePage, fullscreen]; if (shareOpen) $nextTick(() => keepShare())"
         @resize.window="if (shareOpen) placeShare()" @keydown.escape.window="closeShare()"
         @click.outside="if (!$event.target.closest('[data-share]')) closeShare()">
      <p class="share-bubble-note">Share the plan as it stands — everything you set by hand travels in the link.</p>
      <button type="button" class="share-copy" @click="copyLink($el)"><span
              class="share-copy-idle">Copy link</span><span class="share-copy-done">Copied</span></button>
      <div class="link-field" x-show="linkField !== null">
        <input class="link-field-input" type="text" readonly aria-label="Link to copy"
               :value="linkField ?? ''"
               x-effect="if (linkField !== null) $nextTick(() => { $el.focus(); $el.select(); })">
        <button type="button" class="link-field-close" aria-label="Close the link field"
                @click="closeLinkField()"><?= icon('x') ?></button>
      </div>
    </div>

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

      And it stands only where it has room (#129, run 15, K3/K4): after the two
      tile rows and an open raffle bar's cover, its 60 px floor must be left,
      or it is gone and the tiles get its place. It is an extra, not the work.
      The rind decides (`diagramFits()`), the component holds the verdict.
    -->
    <div class="plan-diagram" aria-hidden="true" x-show="diagramShown">
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
        <?= icon('dices', 'legend-dice') ?>
        <span class="legend-open" x-show="raffle.open > 0" x-text="raffle.open"></span>
      </button>
      <!--
        The fullscreen grip sits at the end of the legend row, as in the
        prototype's `slotBlock()` (`data-fs="open"`, margin-left: auto) — not
        floating over the grid, where it lay on the last tile of the first row
        with its mark and its booster count (#73, B5). One button for both
        ways, so it is left at the same spot it was grabbed at (#63 AC 4). It
        is no taller than the legend row (≤ 22 px), so `PLAN_FIXED` 178 and
        the first height 399 stand.
      -->
      <button type="button" class="grid-fullscreen-toggle"
              @click="fullscreen ? closeFullscreen() : openFullscreen()"
              :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'">
        <span class="icon-swap" x-show="!fullscreen"><?= icon('maximize-2') ?></span>
        <span class="icon-swap" x-show="fullscreen" x-cloak><?= icon('minimize-2') ?></span>
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

    </div>

    <!--
      The rank total does not leave with the diagram (#132): it is the third of
      the three places the sum check runs over — Booster total, handout total,
      rank total — so it stands wherever the head does, diagram or not. Where
      it stands without one is the maintainer's (2026-10-05): its own line,
      where it is today; the prototype has no place for that case, its
      `rankTotal()` sits only above the bars. It was always part of the fixed
      `PLAN_FIXED` 178, so the two-row floor is counted with it. Under an open
      raffle bar it lies beneath the bar, as the rank message does — decided
      too: the sum check is read with the bar closed. Fullscreen drops it with
      the head, as `fsContent()` does. The rank message below it
      is the grid's own foot (`slotFoot()`): the only statement about the ranks
      that have no tile at all. Its words are the same under `CombinedHandout`
      since #103: no participation share sits in the Booster rows any more, so
      the total is the ranks' in both branches.
    -->
    <p class="plan-ranktotal" x-ref="ranktotal" x-show="!fullscreen"
       x-text="`${rankTotalBooster} boosters to the ranks`"></p>
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
            <button type="button" class="bubble-close" aria-label="Close" @click="closeTile()"><?= icon('x') ?></button>
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

  <!--
    The rail exists only while the Plan is one page among three (#71): from
    two columns on `Details` stands beside it with the same four on top, on the
    flat stage they turn upright beside the Plan where both first widths fit,
    and nowhere on the Plan page where they do not — under it they would cost
    the second tile row. `fold.rail` says which.
  -->
  <section class="plan-controls" x-ref="rail" x-show="fold.rail !== 'none'">
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
        <?= icon('dices') ?> Raffle
      </button>
      <p class="raffle-stand">
        <span x-text="raffle.stand"></span>
        <template x-if="raffle.potEmptyNote">
          <span class="raffle-empty" x-text="raffle.potEmptyNote"></span>
        </template>
      </p>
      <button type="button" class="raffle-close" aria-label="Close" @click="closeRaffle()"><?= icon('x') ?></button>
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

    <!--
      On the flat stage and in the cramped exception the list is **one row that
      scrolls sideways** instead of growing the bar (#129, run 15, K5; an
      exception to #69 there only, read off the fold): dragged on a phone, and
      on a desktop the arrows in the head line move it by one pill. They show
      only while the row overflows and lock at their own end — they say there
      is more, they count no pages. A fresh hit's chip is scrolled into the
      row. Elsewhere the list wraps and the bar grows with it, as before.
    -->
    <template x-if="raffle.takeBack.length">
      <div class="raffle-takeback">
        <div class="raffle-takeback-head">
          <span>Placed by hand — tap to take back:</span>
          <span class="raffle-scroller" x-show="takeBackEnds.overflow">
            <button type="button" aria-label="Scroll the list back" :disabled="takeBackEnds.atStart"
                    @click="stepTakeBack(-1)"><?= icon('chevron-left') ?></button>
            <button type="button" aria-label="Scroll the list on" :disabled="takeBackEnds.atEnd"
                    @click="stepTakeBack(1)"><?= icon('chevron-right') ?></button>
          </span>
        </div>
        <div class="raffle-takeback-list" :class="{ 'raffle-takeback-row': takeBackScrolls }"
             @scroll.passive="readTakeBackEnds()">
          <template x-for="entry in raffle.takeBack" :key="entry.rank">
            <button type="button" class="raffle-chip" @click="takeBackWinner(entry.rank)"
                    :data-rank="entry.rank" :aria-label="`Take back ${entry.label}`">
              <span x-text="entry.label"></span>
              <span x-show="entry.count > 1" x-text="`×${entry.count}`"></span>
              <?= icon('x') ?>
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</div>
