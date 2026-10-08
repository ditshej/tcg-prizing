<?php
/**
 * The contact channel's address (#64, "Lauf 8 · Angabe"): the maintainer's
 * Discord profile, tag `ditshej`. It is read in two places — the ⓘ of `Game`
 * in `controls-sheet.php` and the about block at the bottom of `Details`
 * (`about.php`, #159) — and lives here once, so the two cannot drift.
 *
 * A partial that returns its value rather than echoing it: each reader writes
 * `require __DIR__ . '/discord-profile.php'` where the href goes, and needs no
 * include at the top of a file another ticket owns. `require`, not
 * `require_once` — the second read would get `true` back.
 */
return 'https://discord.com/users/428891117220659241';
