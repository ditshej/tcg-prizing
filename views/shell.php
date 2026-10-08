<?php
/**
 * The static outer shell (#62): what PHP renders and what never changes
 * while a number is being set (ADR 0004 — "PHP rendert, was sich beim
 * Reglerziehen nie ändert"). Everything plan-dependent lives inside
 * `app.php` behind `x-data="planApp()"` and is Alpine's job, not PHP's —
 * `app.php` in turn composes the three pages and the footer (#63).
 *
 * Alpine is the vendored, pinned file under `public/vendor/` — no CDN, no
 * build step. `app.mjs` is a module script and registers the `planApp`
 * factory on `alpine:init`, which fires before the classic `defer` script
 * below calls `Alpine.start()` (module and defer scripts both run in
 * document order, after parsing, before `DOMContentLoaded`).
 *
 * The one script that cannot wait for that is the mode (#144, ADR 0011): a
 * classic inline script in `<head>`, run while the head is parsed and so
 * before the first paint, puts a stored light or dark choice on `<html>` as
 * `data-theme`. A module or an Alpine `init` would paint the device's mode
 * first and flip after. It mirrors `readTheme()`/`applyTheme()` in
 * `public/ui/theme.mjs` — key `theme`, values `light`/`dark`, anything else
 * System — and a storage that throws leaves it at System.
 * `test/ui-theme.test.mjs` runs it as written.
 */
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Prizing — Plan</title>
  <link rel="stylesheet" href="/ui/plan.css">
  <script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<?php require_once __DIR__ . '/icon.php'; ?>
<?php require __DIR__ . '/app.php'; ?>
<script type="module" src="/ui/app.mjs"></script>
<script defer src="/vendor/alpine-3.14.9.min.js"></script>
</body>
</html>
