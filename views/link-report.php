<?php
/**
 * The `LinkMigration` report (#72), and it is **the one overlay of the app**:
 * over everything, exactly one exit, never called up again, no chip, no part
 * of the `NoticeStack` — it comments on the arrival, not on the screen (#61,
 * "The LinkMigration report"; ADR 0007).
 *
 * A modal dialog element, because the top layer is the only "over everything"
 * that no `z-index` of a later surface can undercut, and because it makes the
 * app behind it inert while it stands — so no bubble can open under it.
 * `showLinkReport()` opens it only when #51/#52 handed over a report, takes
 * the focus onto the exit and remembers where it was; `closeLinkReport()`
 * gives it back. `Esc` is not a second exit (`@cancel.prevent`); should a
 * browser close it anyway, `@close` takes the same one exit, so the state
 * never says "standing" over a closed dialog.
 *
 * What it says is `reportView()` (`link-screen.mjs`), on the proven side: a
 * control by its screen word, a wire key in code type only where none exists,
 * and the bookmark prompt only when the address bar was rewritten.
 */
?>
<dialog class="link-report" aria-labelledby="link-report-title"
        x-init="$nextTick(() => showLinkReport($el, $el.querySelector('[data-link-exit]')))"
        @cancel.prevent
        @close="linkReportShown && closeLinkReport()">
  <h2 id="link-report-title" class="link-report-title">About this link</h2>
  <ul class="link-report-lines">
    <template x-for="(line, i) in (linkReportView?.lines ?? [])" :key="i">
      <li><template x-for="(part, j) in line" :key="j"><span
            :class="'wire' in part ? 'link-wire' : null" x-text="part.wire ?? part.text"></span></template></li>
    </template>
  </ul>
  <p class="link-report-bookmark" x-show="linkReportView?.bookmark" x-text="linkReportView?.bookmark"></p>
  <button type="button" class="link-report-exit" data-link-exit @click="closeLinkReport()">Got it</button>
</dialog>
