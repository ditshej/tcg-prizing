<?php
/**
 * The Alpine root (#63): three pages — `Prepare · Plan · Details` — and the
 * footer that switches between them, plus `Plan`'s own fullscreen state.
 * Before this ticket the root and `Plan`'s markup were the same file,
 * because there was only one page (#62, the tracer through all layers); this
 * file is what replaces that single page with the three the spec (#61)
 * calls for, in granularity order, not the evening's flow (#15).
 *
 * Every `x-…` attribute below is static markup PHP composes once; `plan.mjs`
 * (`planApp()`) is where `activePage`, `fullscreen` and the page-switching
 * itself live (ADR 0004).
 *
 * The fold (#71) puts the three pages side by side as columns inside
 * `.fold`; the root carries what `fold()` derived — the column count, the
 * flat stage, where the hot four stand — as data attributes for `plan.css`,
 * and its sizes (the two insets, the strip, the deck) as custom properties.
 */
?>
<div class="app" x-data="planApp()" x-init="init()" x-ref="app"
     :data-columns="fold.columns" :data-flat="fold.flat ? 'true' : null"
     :data-rail="fold.rail" :data-fullscreen="fullscreen ? 'true' : null" :style="foldStyle">
  <div class="fold">
    <?php require __DIR__ . '/prepare.php'; ?>
    <?php require __DIR__ . '/plan.php'; ?>
    <?php require __DIR__ . '/details.php'; ?>
  </div>
  <?php require __DIR__ . '/notices.php'; ?>
  <?php require __DIR__ . '/foot.php'; ?>
  <?php require __DIR__ . '/link-report.php'; ?>
</div>
