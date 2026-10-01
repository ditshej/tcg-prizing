<?php
/**
 * `Prepare` (#65): the `PreparationList` with its derivations **written out**,
 * instead of hidden behind a ⓘ. That is the reason this view got a surface of
 * its own — in the Plan head the breakdown cost a measured third of the tile
 * grid, and the tile window grew from 148 to 213 px in portrait once it moved
 * out (#61).
 *
 * Three items, each with its step sequence: `Display`s, `PromoEnvelope`s,
 * `WinnerPack`s. Every number, every word and every plural comes out of
 * `preparationList()` in `public/ui/prepare.mjs`, which `node --test` holds;
 * this file only places them. #63 left the page in Grundform — the three pool
 * numbers as plain values — and that list is what these items replace.
 *
 * The `Pool`s appear nowhere here, and that is the decision rather than an
 * omission: holding is a total matter, sorting a `Pool` matter, and the
 * breakdown is not additive (`CONTEXT.md`, `PreparationList`). So there is
 * exactly one procurement hint per `PackagingUnit` and none per `Pool`.
 *
 * The page gets **no scroll fade band**: it does not scroll at usual height
 * (566 px of content against 542 for Release, #61), and a band belongs to the
 * surface that really scrolls.
 *
 * Every `x-…` attribute is static markup PHP composes once; the numbers come
 * from `distribute()` in the browser (ADR 0004).
 */
?>
<div class="page-prepare" x-cloak x-show="activePage === 'prepare'">
  <header class="page-head">
    <h1>Prepare</h1>
    <p class="page-lede">everything the pool holds</p>
  </header>

  <!--
    One template for all three items: they differ in what they say, never in
    how they are built, and a second copy of this markup is a second place for
    the sealed/loose wording to drift. The aside beside the headline is the
    item's raw piece count where there is one, and where the headline *is* the
    piece count (the WinnerPacks) it says where that number comes from.
  -->
  <div class="prep-items">
    <template x-for="(item, index) in preparationItems" :key="index">
      <section class="prep-item">
        <div class="prep-bar">
          <b class="prep-count" x-text="item.fetch"></b>
          <em class="prep-unit" x-text="item.unit"></em>
          <span class="prep-aside" x-text="item.total ?? item.source"></span>
        </div>

        <div class="prep-steps">
          <template x-for="(line, step) in item.lines" :key="step">
            <div class="prep-step" :class="`prep-${line.tone}`">
              <span class="prep-text" x-text="line.text"></span>
              <template x-if="line.aside">
                <span class="prep-sub" x-text="line.aside"></span>
              </template>
              <template x-if="line.value !== undefined">
                <b class="prep-value" x-text="line.value"></b>
              </template>
            </div>
          </template>

          <!--
            The `WinnerPack` hint, as the last line of the derivation and with
            a button on it: whoever says how the 3 came about says with it how
            one gets to 4 (#61). It is an **opportunity and not a notice**, so
            it never enters the `NoticeStack` — and it is silent while
            `winnerPacks` is `pinned`, which `preparationList()` decides off
            the plan's own record of what was set by hand.

            The button goes through `setSlider()` like every other control, so
            pressing it pins `tournamentPacks` by the operating gesture (ADR
            0006) and writes the address bar with the rest of them.
          -->
          <template x-if="item.offer">
            <div class="prep-offer">
              <span x-text="item.offer.text"></span>
              <button type="button" @click="takeOffer(item.offer)" x-text="item.offer.button"></button>
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>

  <p class="prep-note" x-text="preparation.note"></p>
</div>
