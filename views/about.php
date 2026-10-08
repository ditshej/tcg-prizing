<?php
/**
 * The about block (#159): the very bottom of `Details`, after the last group,
 * seen by whoever scrolls that far — in every fold, because it is part of the
 * page and the page is what each fold shows (page or column).
 *
 * Two lines. The by-line `by ditshej | GitHub` (the maintainer's decision,
 * review 2026-10-08, point 11): the name goes to ditshej.ch, the word GitHub
 * to the repository. Under it the contact channel once more, the same as in
 * the ⓘ of `Game` and not a second one: the profile URL is read from the one
 * place it lives (`discord-profile.php`), and the tag stays visible because
 * the link opens the Discord app and lands on a sign-in page without an
 * account (#64, known and taken).
 *
 * "ditshej" so stands twice with two targets, on purpose; the words around
 * each say where it goes — "by" for the author, "on Discord" for the chat.
 *
 * Set quietly (`--muted`, small) and without a line: a line is allowed only
 * where it separates data (#15), and this is not data. Each line is 44 high
 * so the links in it take their 44 from the hit rule's `::after` without
 * reaching over the other line's link; the two by-line links keep a pitch of
 * 44 through the gap around the bar (#142).
 */
?>
<footer class="about">
  <p class="about-by">by
    <a href="https://ditshej.ch" target="_blank" rel="noreferrer">ditshej</a>
    <span class="about-bar" aria-hidden="true">|</span>
    <a href="https://github.com/ditshej/tcg-prizing" target="_blank" rel="noreferrer">GitHub</a></p>
  <p class="about-contact">Questions or ideas? Say so on Discord —
    <a href="<?= htmlspecialchars(require __DIR__ . '/discord-profile.php') ?>" target="_blank"
       rel="noreferrer"><strong>ditshej</strong></a></p>
</footer>
