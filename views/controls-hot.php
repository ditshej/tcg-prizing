<?php
/**
 * The hot ones — Players, RankPoolDepth, DistributionCurve — as the fixed
 * rail under `Plan` (`plan.php`). Three since #143 (decision 5, overruling
 * #61 story 13): `RankFloor` stands on `Details` only.
 *
 * Since #113 the rail **is the sheet's row**, without the explanation text:
 * the two numbers are drawn by `control_row()` (`control-row.php`), the same
 * function `controls-sheet.php` draws all fourteen with. #61 named the rail
 * literally the same content as `Details` ("die Schiene ist Details und war
 * nie ein eigener Inhalt"). So the rail carries what the row carries: the
 * sheet's titles, the counter with its typed field, the state word, the way
 * back, and `cap N` on the title line of `Served ranks`. What it leaves out is
 * the explanation text (#64 AC 9), and the step grid of `Served ranks`, which
 * is `depthStep` — a choice and not a number.
 *
 * The curve is the sheet's chips over the rail's full width (#143, decision
 * 6), drawn by the same `curve_steps()`; the `<select>` it was came from the
 * tracer #62 and was never decided. Its head carries the title and the state
 * word, as the select's did, and no way back of its own: a button on the title
 * line would lay its 44 px hit area over the chips under it, and the way back
 * stands at the curve on `Details` and in the full reach in the plan head.
 * The two numbers share a row from a 360 stage up (round 142·145, K2), the
 * chips take the next.
 *
 * Every `x-…` attribute is static markup composed once by PHP; the values and
 * handlers come from `planApp()` (ADR 0004).
 */

require_once __DIR__ . '/control-row.php';
?>
<div class="controls-hot">
  <?php control_row('players', 'Players'); ?>

  <?php control_row('depth', 'Served ranks', '', '`cap ${plan.depthCap}`'); ?>

  <div class="hot-curve" :class="{ 'is-pinned': isPinned('curve') }">
    <div class="sheet-control-head">
      <span class="sheet-control-title">
        <span class="sheet-control-label">Curve</span>
        <?php sheet_pin_head('curve'); ?>
      </span>
    </div>
    <?php curve_steps(); ?>
  </div>
</div>
