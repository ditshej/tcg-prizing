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

Vendored skills live in `.agents/skills/`, symlinked into `.claude/skills/` and hashed by `skills-lock.json` — never edit them, the next update overwrites the change. Repo-local corrections belong in `docs/agents/*`, in a map's Notes block, or in a skill of our own. Our own skills are real directories in `.claude/skills/`, beside the vendored symlinks; the lock file only knows vendored names, so there is no collision. `/map-closure`, `/fan-out` and `/counter-check` are ours.

### Building several tickets at once

`/fan-out` builds disjoint tickets in parallel subagents and then checks the
result from the parent session, against the source rather than against the
reports; `/counter-check` takes those findings apart again with fresh context.
The findings file they hand each other, and the facts of the run they were
written from, are in `docs/agents/fan-out.md`. Neither skill merges.

### From a cleared map to tickets

`/to-spec` → `/to-tickets` → `/implement` is the flow, and we follow it. Where
this repo departs: the map is too big for the one-window rule, so it is one
session per spec. Measured numbers and the cost in `docs/agents/spec-flow.md`.

### Issue tracker

Issues live in this repo's GitHub Issues, driven via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### A decided number is looked up, never back-computed

Starting values, rates and named steps are **decisions**, and they are written
down where they were made — in a ticket's resolution comment, and from there
into the prototype. Deriving one instead, from plan numbers or from what the
core happens to read today, produces a value that looks right and is not.

This has now cost two sessions. #21 and #25 wrote their tables out precisely
because #20 had back-computed and drifted, and both say so in their first line.
The session that built #54 derived the sheet anyway and got every value wrong
but one — and the test it wrote alongside went green, because it measured
against the same derivation. A wrong number and its own justification arrive
together.

So: before writing a constant, find the comment that decided it. If no decision
exists, that absence is the finding — say it, rather than picking a plausible
value. Where a decision is only implicit in a measured plan, the guard is a test
that runs the real code against that plan; `test/onepiece.test.mjs` is the
pattern.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

Where we depart from the vendored `/domain-modeling` skill: when a later ADR touches an earlier one, the earlier one gets a stamp line under its title — `Ergänzt durch ADR-NNNN.` if the later one only extends it, `Teilweise`/`Vollständig überholt durch ADR-NNNN.` if it overturns it. Sharpening your own text while writing needs no stamp; it belongs in that same ADR's body. The extension case is the one that gets forgotten, because nothing at the earlier ADR becomes wrong — it only becomes incomplete. Table and examples in `docs/agents/domain.md`.

### Prototypes

Form per case, mockups marked as reference-only, one throwaway branch per map. See `docs/agents/prototyping.md`.

### Core workbench

`dev/` holds a workbench that imports `public/core/` live and lets the core be
driven by hand — sliders, the rank rows as bars, and an invariant line that goes
red when one breaks. It is a tool, **not the app's surface**: Spec 2 (#61) builds
that, and nothing in `dev/` is a decision about it or a template for it. It sits
outside `public/`, so the docroot never serves it. See `dev/README.md` — it
carries the one command that starts it.

### SetupLink encoding

The URL encoding is a versioned public interface. Renaming or removing a slider key, or changing what one means, requires a version bump and a `LinkMigration` in the same commit. See `docs/agents/setup-link.md`.
