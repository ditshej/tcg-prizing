<?php
/**
 * `Prepare` in Grundform (#63): the three procurement items — Boosters,
 * TournamentPacks, WinnerPacks — as plain numbers straight off `plan.pool`.
 * No sealed/loose breakdown, no PackagingUnit conversion, no procurement
 * hint: #61's "PreparationList as a view" describes those as the page's
 * derivations, and #65 ("Prepare schreibt ihre Herleitungen aus") is where
 * they're built. Writing them here would guess at a decision #65 owns.
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

  <ul class="prepare-list">
    <li class="prepare-item">
      <span class="prepare-label">Boosters</span>
      <span class="prepare-value" x-text="plan.pool.booster"></span>
    </li>
    <li class="prepare-item">
      <span class="prepare-label">Tournament packs</span>
      <span class="prepare-value" x-text="plan.pool.packs"></span>
    </li>
    <li class="prepare-item">
      <span class="prepare-label">Winner packs</span>
      <span class="prepare-value" x-text="plan.pool.winners"></span>
    </li>
  </ul>
</div>
