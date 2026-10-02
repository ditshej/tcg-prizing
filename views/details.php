<?php
/**
 * `Details` (#64): the Set block and all seventeen controls, in groups with a
 * title and an explanation, the four hot ones first. #63 left this page in
 * Grundform — the four hot controls, the same partial the fixed rail under
 * `Plan` uses — and #64 filled it.
 *
 * The body is `controls-sheet.php`, a partial of its own beside the rail's
 * `controls-hot.php`. Since #113 both draw every number with the one
 * `control_row()` (`control-row.php`), and the sheet differs from the rail
 * only in the explanation text it puts beside the row. Both call the same
 * handlers in `plan.mjs`, so they change the same stand the same way; #71,
 * which folds the page into columns, is where the rail stops existing
 * separately.
 *
 * The page scrolls (`.page-details` has its own `overflow-y`), and everything
 * in it scrolls with it — the Set block and the hot four included. "First" is
 * an arrangement, not an assurance (#61).
 *
 * `data-bubble-frame` is the other half of that scrolling (#67): the question
 * of the full reach hangs off a button in the Set block, and a bubble closes
 * when its anchor is no longer visible — one rule for all its inhabitants
 * (#66). "Visible" has to be measured against **what scrolls**, and here that
 * is this page, so the frame is named here rather than guessed at in
 * `placeConfirm()`. The `@scroll` is what makes it move and close while the
 * column is dragged; the marking above it needs neither.
 */
?>
<div class="page-details" data-bubble-frame @scroll="placeConfirm()"
     x-cloak x-show="shows('details')">
  <header class="col-head">
    <div class="col-titleline">
      <h1 class="col-title" x-show="titled('details')">Details</h1>
      <span class="col-facts">everything you can turn</span>
    </div>
  </header>

  <?php require __DIR__ . '/controls-sheet.php'; ?>
</div>
