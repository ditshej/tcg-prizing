<?php
/**
 * `Details` in Grundform (#63): the four hot sliders, the same partial the
 * fixed rail under `Plan` uses (`controls-hot.php`) — #61 names this
 * literally the same content once #71 folds the page into columns ("die
 * Schiene ist Details und war nie ein eigener Inhalt"). The other thirteen
 * sliders and the Game/TournamentType block are #64's ticket, not this one.
 */
?>
<div class="page-details" x-cloak x-show="activePage === 'details'">
  <header class="page-head">
    <h1>Details</h1>
    <p class="page-lede">everything you can turn</p>
  </header>

  <?php require __DIR__ . '/controls-hot.php'; ?>
</div>
