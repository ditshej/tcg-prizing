# AI release review: project checklist

Points for this project, in addition to `docs/ai-review/base.md`.
A point marked "blocking" blocks the release like a blocking finding in the
base checklist.

- **SetupLink (blocking):** renaming or removing a slider key, or changing what one means, comes with a version bump and a `LinkMigration` in the same commit (`docs/agents/setup-link.md`).
- **Decided numbers (blocking):** starting values, rates and named steps match the decision in the ticket comment or prototype; no value is back-computed. A test that measures against the same derivation does not count.
- **No packages, no build step (blocking):** no `package.json`, `composer.json` or build tooling slips in without a new ADR (ADR 0004). The core in `public/core/` runs without dependencies.
- **Templates:** PHP stays in `views/` and `public/index.php` as templates; all output is escaped.
- **Tests:** new core behaviour is covered by `node --test` tests that run the real code.
- **Deploy:** changes to `_deploy.sh` and `deploy.sh` keep the redirect and the docroot intact; `main` goes live unchecked (#22).
- **Language:** code and UI copy are English; maintainer-facing docs are German.
