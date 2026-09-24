# TCG Prizing

A web interface for working out how to distribute tournament prize support across
placements — built for TCG community leads who receive a fixed pool of prize
elements and need to split it fairly for a given tournament format.

## Status

Planning is done, implementation is starting. The design lives in
[`CONTEXT.md`](CONTEXT.md) and [`docs/adr/`](docs/adr/); the work is cut into
three specs and their tickets in this repo's GitHub issues:

| Spec | Issue | Tickets |
| --- | --- | --- |
| 1 — the core, `distribute(settings)` | [#46](https://github.com/ditshej/tcg-prizing/issues/46) | #53–#60 |
| 2 — the surface and the `NoticeStack` | [#61](https://github.com/ditshej/tcg-prizing/issues/61) | #62–#73 |
| 3 — `SetupLink` and `LinkMigration` | [#47](https://github.com/ditshej/tcg-prizing/issues/47) | #48–#52 |

There is no build step (see [ADR 0004](docs/adr/0004-kein-build-schritt-alpine-ueber-reinen-es-modulen.md)):
the browser imports the core straight from the docroot, and the same files run
under `node --test`.

## Predecessor

This repository replaces the archived
[ditshej/tcg-price-calculator](https://github.com/ditshej/tcg-price-calculator),
which is a superseded first attempt. Its approach no longer matches how prize
support is actually distributed, and it is **not** used as a reference for this
rebuild.
