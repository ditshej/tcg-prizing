<?php
/**
 * The about block (#159): the very bottom of `Details`, after the last group,
 * seen by whoever scrolls that far — in every fold, because it is part of the
 * page and the page is what each fold shows (page or column).
 *
 * Its form is the page's footer (review 2, point 3, F1 = b, built in #169): a
 * line before it, no head, two lines centred. On top the contact channel once
 * more, the same as in the ⓘ of `Game` and not a second one: the profile URL
 * is read from the one place it lives (`discord-profile.php`), and the tag
 * stays visible because the link opens the Discord app and lands on a sign-in
 * page without an account (#64, known and taken). Under it the by-line
 * `created by ditshej with AI | GitHub` (the maintainer's wording, review 2,
 * point 3c): the name goes to ditshej.ch, the word GitHub to the repository.
 *
 * "ditshej" so stands twice with two targets, on purpose; the words around
 * each say where it goes — "on Discord" for the chat, "created by" for the
 * author.
 *
 * The line overrides #159's "no line": it separates data, the controls, from
 * the colophon (#15 allows a line only there). The links carry no `<strong>`
 * of their own; their weight is the stylesheet's, the one thing that sets
 * them off from the line around them. Each line is 44 high so the links in it
 * take their 44 from the hit rule's `::after` without reaching over the other
 * line's link (#142).
 */
?>
<footer class="about">
  <p class="about-contact">Questions or ideas? Say so on Discord —
    <a href="<?= htmlspecialchars(require __DIR__ . '/discord-profile.php') ?>" target="_blank"
       rel="noreferrer">ditshej</a></p>
  <p class="about-by">created by
    <a href="https://ditshej.ch" target="_blank" rel="noreferrer">ditshej</a>
    with AI
    <span class="about-bar" aria-hidden="true">|</span>
    <a href="https://github.com/ditshej/tcg-prizing" target="_blank" rel="noreferrer">GitHub</a></p>
</footer>
