<?php
/**
 * The static outer shell (#62): what PHP renders and what never changes
 * while a slider is being dragged (ADR 0004 — "PHP rendert, was sich beim
 * Reglerziehen nie ändert"). Everything plan-dependent lives inside
 * `plan.php` behind `x-data="planApp()"` and is Alpine's job, not PHP's.
 *
 * Alpine is the vendored, pinned file under `public/vendor/` — no CDN, no
 * build step. `app.mjs` is a module script and registers the `planApp`
 * factory on `alpine:init`, which fires before the classic `defer` script
 * below calls `Alpine.start()` (module and defer scripts both run in
 * document order, after parsing, before `DOMContentLoaded`).
 */
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prizing — Plan</title>
  <link rel="stylesheet" href="/ui/plan.css">
</head>
<body>
<?php require __DIR__ . '/plan.php'; ?>
<script type="module" src="/ui/app.mjs"></script>
<script defer src="/vendor/alpine-3.14.9.min.js"></script>
</body>
</html>
