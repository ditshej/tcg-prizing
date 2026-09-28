<?php
/**
 * `Details` (#64): the Set block and all seventeen controls, in groups with a
 * title and an explanation, the four hot ones first. #63 left this page in
 * Grundform — the four hot sliders, the same partial the fixed rail under
 * `Plan` uses — and this ticket fills it.
 *
 * The body is `controls-sheet.php`, a partial of its own: the rail under
 * `Plan` keeps `controls-hot.php` unchanged, because the sheet's form differs
 * from the rail's in exactly the two ways this ticket decided — the
 * explanation text appears only here, and the number appears only in the
 * counter. Both forms call the same handlers in `plan.mjs`, so they change
 * the same stand the same way; #71, which folds the page into columns, is
 * where the rail stops existing separately.
 *
 * The page scrolls (`.page-details` has its own `overflow-y`), and everything
 * in it scrolls with it — the Set block and the hot four included. "First" is
 * an arrangement, not an assurance (#61).
 */
?>
<div class="page-details" x-cloak x-show="activePage === 'details'">
  <header class="page-head">
    <h1>Details</h1>
    <p class="page-lede">everything you can turn</p>
  </header>

  <?php require __DIR__ . '/controls-sheet.php'; ?>
</div>
