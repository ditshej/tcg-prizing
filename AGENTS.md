# tcg-prizing

## Language

**English** — everything an agent or a compiler reads:

- Source code, identifiers, code comments, docblocks
- `AGENTS.md`, `CLAUDE.md`, `docs/agents/*`, skill and agent definitions
- Commit messages, branch names
- UI copy — the app is English throughout, labels included

**German** — everything the maintainer reads while planning:

- Wayfinder maps and tickets, GitHub issue titles and bodies, specs, task lists
- ADR prose, review notes, PR descriptions

`CONTEXT.md` is mixed on purpose: each **term** is the English one the code
uses, its **explanation** is German. A glossary whose terms don't match the
identifiers is worse than no glossary.

The **UI is a third space**, and that pair does not bind it. Labels aim to be
the glossary's own words — but a label may say it differently where the term
reads badly on screen, or where matching it would only make an identifier
longer. Where a label **replaces a word** of the term, the glossary records it
on a `_Label_` line above `_Avoid_`; shortening and inflection are not a
replacement. Prefer moving one side to the other over writing the line: if the
screen word is the better one, rename the term; if the term is fine, fix the
screen. The line is the fallback, for when neither side can move.

A label that is itself **another glossary term** is the one thing to rule out
outright — it points the reader at the wrong entry, which is worse than
pointing at none.

## Commit conventions

Standard [Conventional Commits](https://www.conventionalcommits.org/): `<type>[optional scope]: <description>`.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Breaking changes are marked with `!` before the colon (`feat!: ...`) or a `BREAKING CHANGE:` footer.

Commit messages are written in English.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, driven via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### SetupLink encoding

The URL encoding is a versioned public interface. Renaming or removing a slider key, or changing what one means, requires a version bump and a `LinkMigration` in the same commit. See `docs/agents/setup-link.md`.
