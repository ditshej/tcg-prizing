# Fan-out and counter-check

The repo facts two skills stand on: `/fan-out` builds several tickets in
parallel subagents and checks their result independently, `/counter-check`
takes that result apart again with a fresh head. The mechanics live in the
skills; what lives here is what both need to agree on — the findings file they
hand each other, and the facts of the one run the skills were written from.

## The hand run of 2026-09-24

The procedure was driven once, by hand, end to end. Every number either skill
quotes comes from it.

| Ticket | What it built            | Worktree                 | Branch                      | Files it owned                                                                     | PR  |
| ------ | ------------------------ | ------------------------ | --------------------------- | ---------------------------------------------------------------------------------- | --- |
| #54    | the `DefaultSet` sheets  | `../tcg-prizing-54`      | `feat/54-defaultset-blaetter` | `public/sets/onepiece.mjs`, `test/onepiece.test.mjs`                               | #75 |
| #57    | the indivisible axes     | `../tcg-prizing-57`      | `feat/57-unteilbare-achsen`   | `public/core/*`, of which it changed `distribute.mjs` and `test/distribute.test.mjs` | #77 |
| #48    | the v1 key register      | `../tcg-prizing-48`      | `feat/48-schluesselregister`  | `public/link/encode.mjs`, `test/link-keys.test.mjs`, `docs/agents/setup-link.md`, `docs/adr/0007-*` | #76 |

Three Sonnet agents, one message, three PRs. What it produced, and what each
skill draws from it:

- **Two of three tickets carried comments that defused a trap.** Both traps
  would have been walked into from the body alone.
- **`dev/` was forbidden to all three** and caught up once after the merges. It
  is the workbench, and it belongs to nobody (`AGENTS.md`, "Core workbench").
- **Recomputing the acceptance numbers by hand found two things no test
  showed** — see below, and the two green tests in `/counter-check`.
- **The cross-check between #48 and #54 was the proof.** Both drew from the
  same spec table in #46; nothing inside either agent could see the other.

## The file sets are proved disjoint, not assumed

Before an agent starts, the ticket → files mapping is **written out and
compared**, set against set. An overlap stops the run. In the hand run the
mapping arrived ready-made; that is exactly what falls away once this is
routine.

A directory several tickets would touch is already an overlap. The pattern is
**forbid it to everyone and catch it up afterwards**, never split it. `dev/`
is the standing case.

**The parent counts as a writer.** This rule is not only about the agents: a
working tree with an agent in it is spoken for, and a parent that commits from
the same one moves the shared HEAD under it. That holds even when there is a
single agent — see run 3. So the parent either hands out a worktree per agent
and keeps the root for itself, or it stops committing until they return.

One worktree per ticket:

```sh
git worktree add -b <branch> ../tcg-prizing-<n> main
```

Worktrees that were already there stay untouched — `../tcg-prizing-proto`
carries `prototype/rank-distribution`, which never merges
(`docs/agents/prototyping.md`).

## Recompute at a freshly built state, never off the tests

A test that passes says the test passes. To get the acceptance number itself,
import the module and compute:

```sh
node --input-type=module -e "const {distribute} = await import('/Users/ditshej/localweb/tcg-prizing-57/public/core/distribute.mjs'); console.log(distribute({...}))"
```

Absolute path into the worktree under test — a relative one resolves against
the current directory and quietly answers from the wrong tree. In the hand run
this confirmed the tier numbers (1 and 2 at ⟨32, 2⟩, threshold 16 at yield 1)
and turned up the two findings the suites were blind to.

The forbidden paths are checked the same way, mechanically:

```sh
git diff --name-only main...HEAD | grep -E 'dev/|\.claude/skills/|\.agents/skills/'
```

Empty output is the pass. Add the other agents' files to the pattern.

**Three dots, not two.** `main..HEAD` asks what differs between the two tips,
so everything that landed on `main` after the branch was cut counts as the
branch's doing. The batch of 2026-09-24 ran while four commits landed on
`main`, and the two-dot form accused all three branches of touching
`.claude/skills/` — the very pattern whose breach is supposed to stop the run.
`main...HEAD` asks what the branch added since it forked, which is the
question. The wrong form only ever over-reports, so it is not a breach that
slips through; it is a check that gets waved away on the second run.

## The findings file

`/fan-out` writes it, `/counter-check` reads it. `review/` is gitignored:
findings are a session artifact, not source.

Path: `review/<batch>-befunde.md`. German — the maintainer reads it. IDs are
stable (`B1`, `B2`, …) so the counter-check can cite them.

````markdown
# Befunde: <Stapelname> · <ISO-Datum>

## Stand

| Ticket | PR | Branch | Worktree | node --test |

## Quellen, gegen die geprüft wurde

Welcher Spec-Abschnitt, welches Ticket, welcher ADR — mit der Stelle, nicht nur der Nummer.

## Querproben

Welche gefahren wurden, mit Kommando und Ergebnis.

## Befunde

### B1 · <Kurztitel>

- **Ort:** PR #<n> · <datei>:<zeile>
- **Schwere:** blockierend | zu entscheiden | Notiz
- **Behauptung:** ein Satz
- **Beleg:** das Kommando, wörtlich und wiederholbar, samt seiner Ausgabe
- **Gegenrechnung:** was die Elternsitzung selbst gerechnet hat — nicht, was der Test sagt
- **Offen:** was entschieden werden muss, falls etwas

### B2 · …

## Nicht geprüft

Die ehrlichen Lücken. Dieser Abschnitt lenkt die Gegenprobe und darf nicht leer bleiben,
um aufgeräumt zu wirken.
````

Two sections carry more than they look like:

- **Beleg** is a command someone else runs unchanged, from a path they can
  reach. A finding without one is a claim, and the counter-check has to rebuild
  it before it can test it.
- **Nicht geprüft** is the map of the gaps, and `/counter-check` reads it
  first. Left empty to look tidy, it hides precisely the region nobody has
  looked at.

## Where the round ends

The findings file is a waypoint, not a result. What is still open after
`/counter-check` goes to `/ask-hard-questions`, which selects the decisions only
the maintainer can make and serves them as cards
(`.claude/tools/README.md`). The answer file lands beside the question file in
`review/` — which is gitignored, so the round is closed only once each answer
has been written into the ticket comment, the ADR or `CONTEXT.md` it will be
looked up from later. A decision that stays in `review/` is a decision the next
session back-computes.

## Run log

**Append three lines per run, and read this before starting one.** A skill that
only accumulates advice drifts into opinion; what keeps these two honest is
that every claim in them is traceable to a run that went wrong in a particular
way. The log is also how a *recurring* failure becomes visible — one green test
that proves nothing is an accident, three across two runs is a class.

### Run 1 · 2026-09-24 · #54, #57, #48 · three Sonnet agents

Detailed above. What it produced: **three green tests that checked nothing** —
one restating its own claim, one omitting the disputed term from one side of an
equation, and a data sheet with no test against the measured plans at all. A
double count in `CombinedHandout` (40 where 32 was owed). A wrong curve step.

The counter-check **refuted one of the parent's own findings**: the parent had
read two sections of the spec and filed a contradiction that a third section,
two screens down, resolved. Every number in that finding was right.

Corrected in the skills afterwards: the forbidden-path check compared tips
instead of the fork point (`main..HEAD` → `main...HEAD`); `## Quellen` named as
the second map of gaps; mutation hygiene; nil returns for criteria no test
carries; a method for lens 3 (cross the ticket pairs that read the same source).

### Run 2 · 2026-09-25 · #54, #57 corrections · two Opus agents

The four decisions from run 1, implemented in parallel. Both verified against
freshly built states; the cross-check across both worktrees held — corrected
sheets through the corrected core still hit all three measured plans, and the
sum rule closed in both `CombinedHandout` branches.

The finding that mattered most came from **outside the machinery**: the
counter-check found one wrong curve value, and the maintainer recognised it as
a symptom — the values had all been decided long before, in #21 and #25, and
the sheet had been derived rather than read. No lens found that. See
`AGENTS.md`, "A decided number is looked up, never back-computed".

### Run 3 · 2026-09-25 · the workbench catch-up · one Opus agent

One agent, and the rule it broke was mine. The agent was pointed at the repo
root — the same working tree the parent was committing from. Its `checkout -b`
moved the shared HEAD, and the parent's next `git add -A` swept the agent's
open files and three throwaway screenshots into a commit about something else.
Nothing was lost and `main` was never touched, but the branch had to be rebuilt
from its own tip to get a readable history.

**"One worktree per ticket" was already written down.** It failed because the
parent did not count itself among the participants: the rule reads as being
about the agents, and a single agent looks like a case it does not cover. It
covers every run with more than one writer, and the parent is always a writer.
A single agent still gets its own tree — or the parent stops committing until
it returns.
