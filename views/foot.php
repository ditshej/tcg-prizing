<?php
/**
 * The footer navigation (#63): three entries, `Prepare · Plan · Details`,
 * icon and word on every one — never icon alone (#61, #15: "ein Schirm, kein
 * Ablauf", the order is granularity, not the evening's flow). A second tap on
 * the already-active entry is a no-op (`setPage()` in `plan.mjs`); the active
 * entry is read by depth (`.foot-active`), never by a rule — a line is only
 * allowed where it separates data, and this doesn't.
 *
 * Hidden entirely in fullscreen, at every width (#63 AC 5): fullscreen is a
 * state of `Plan`, not a fourth page, and the foot belongs to page
 * navigation, which fullscreen has none of.
 */
?>
<footer class="foot" x-show="!fullscreen">
  <button type="button" class="foot-item" :class="{ 'foot-active': activePage === 'prepare' }"
          @click="setPage('prepare')" :aria-current="activePage === 'prepare' ? 'page' : null">
    <span class="foot-icon" aria-hidden="true">🛒</span>
    <span class="foot-label">Prepare</span>
  </button>
  <button type="button" class="foot-item" :class="{ 'foot-active': activePage === 'plan' }"
          @click="setPage('plan')" :aria-current="activePage === 'plan' ? 'page' : null">
    <span class="foot-icon" aria-hidden="true">⊞</span>
    <span class="foot-label">Plan</span>
  </button>
  <button type="button" class="foot-item" :class="{ 'foot-active': activePage === 'details' }"
          @click="setPage('details')" :aria-current="activePage === 'details' ? 'page' : null">
    <span class="foot-icon" aria-hidden="true">☰</span>
    <span class="foot-label">Details</span>
  </button>
</footer>
