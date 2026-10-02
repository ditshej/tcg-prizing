<?php
/**
 * The NoticeStack (#68): a layer over the whole app that covers and pushes
 * nothing, with its three inhabitants — `ConflictNotice`, `Offer`,
 * `CarryOverNotice`. It is required by the app root and by no page, so it
 * belongs to none of them: a chip survives every page switch because the
 * layer it lies on never left (CONTEXT.md, `NoticeStack`).
 *
 * Layer and surface are two statements. The layer is everything here; the
 * surface of an open notice is as wide as the room the DistributionPlan takes
 * — the fold's two insets, `--plan-left` and `--plan-right` (#71) — and the
 * chips sit in the lowest free corner on the right: on the phone one row above
 * the foot, from two columns on in the strip.
 *
 * Every word and every number comes out of `notices.mjs` through `notices`;
 * nothing here decides what a notice says, only where it lies. The effect is
 * the fold's one call per change (`refreshNotices()`): it reads the plan and
 * the base, so Alpine runs it again whenever either moves.
 *
 * Two states and none between: open, with its sentences and ways out, or a
 * chip. The ConflictNotice has no ✕ — its presence is the statement
 * (ADR 0002) — the Offer and the CarryOverNotice have one. A chip only opens:
 * it accepts nothing and triggers nothing, so a slip of the thumb in the
 * corner costs nothing.
 */
?>
<div class="notice-layer" x-ref="notices" x-effect="refreshNotices()"
     :class="{ 'notice-layer-chips': notices.chips.length }">
  <div class="notice-stack">
    <template x-for="notice in notices.open" :key="notice.id">
      <section class="notice" :class="`notice-${notice.id}`" role="status">
        <div class="notice-head">
          <div class="notice-text">
            <template x-for="(line, i) in notice.lines" :key="i">
              <p class="notice-line" :class="{ 'notice-lead': i === 0 }" x-text="line"></p>
            </template>
          </div>
          <button type="button" class="notice-fold" aria-label="Minimize"
                  @click="minimizeNotice(notice.id)">&#9662;</button>
          <template x-if="notice.closable">
            <button type="button" class="notice-close" aria-label="Dismiss"
                    @click="dismissNotice(notice.id)">&#10005;</button>
          </template>
        </div>
        <div class="notice-actions" x-show="notice.actions.length">
          <template x-for="(action, i) in notice.actions" :key="i">
            <button type="button" class="notice-action" :data-notice-carry="action.drop ? '' : null"
                    @click="action.way ? applyWayOut(action.way)
                          : action.offer ? acceptOffer(action.offer)
                          : dropCarried('[data-notice-carry]')"
                    x-text="action.label"></button>
          </template>
        </div>
      </section>
    </template>
  </div>

  <div class="notice-chips">
    <template x-for="chip in notices.chips" :key="chip.id">
      <button type="button" class="notice-chip" :class="`notice-chip-${chip.id}`"
              @click="expandNotice(chip.id)"><template x-if="chip.glyph"><span
              class="notice-glyph" aria-hidden="true" x-text="chip.glyph"></span></template><span
              x-text="chip.word"></span></button>
    </template>
  </div>
</div>

<!--
  The CarryOverNotice's question away from `Details` — the same question, the
  same form, the same handlers as the sheet's bubble (`views/controls-sheet.php`),
  which cannot show here because it is markup inside a hidden page. It only
  ever shows the question asked from this layer (`carryBubble`), so the two
  never stand at once.
-->
<div class="drop-bubble" data-notice-drop x-cloak role="dialog"
     x-show="dropQuestion && confirmDrop && confirmDrop.bubble === '[data-notice-drop]'"
     x-effect="void [dropQuestion, activePage, fullscreen]; $nextTick(() => placeConfirm())"
     @click.outside="if (confirmDrop && confirmDrop.bubble === '[data-notice-drop]') cancelDrop()"
     @keydown.escape.window="cancelDrop()" @resize.window="placeConfirm()">
  <template x-if="dropQuestion">
    <div>
      <div class="drop-head">
        <strong x-text="dropQuestion.headline"></strong>
        <button type="button" class="bubble-close" aria-label="Keep them"
                @click="cancelDrop()">&#10005;</button>
      </div>
      <ul class="drop-items">
        <template x-for="item in dropQuestion.items" :key="item.key">
          <li><span class="drop-item-label" x-text="item.label"></span><span
                class="drop-item-arrow" aria-hidden="true">&rarr;</span><span
                class="drop-item-to" x-text="item.to"></span></li>
        </template>
      </ul>
      <p class="drop-note" x-text="dropQuestion.note"></p>
      <div class="drop-ask">
        <button type="button" class="drop-go" @click="applyDrop()"
                x-text="dropQuestion.confirm"></button>
        <button type="button" class="drop-no" @click="cancelDrop()"
                x-text="dropQuestion.cancel"></button>
      </div>
    </div>
  </template>
</div>
