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
 */
?>
<div class="app" x-data="planApp()" x-init="init()">
  <?php require __DIR__ . '/prepare.php'; ?>
  <?php require __DIR__ . '/plan.php'; ?>
  <?php require __DIR__ . '/details.php'; ?>
  <?php require __DIR__ . '/foot.php'; ?>
</div>
