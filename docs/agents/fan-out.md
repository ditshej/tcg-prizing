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

## Mutation hygiene

Mutation testing turns the implementation wrong on purpose, so it is the one
move in this family that can do damage. Both `/counter-check` and
`/ask-hard-questions` run it, and both run it against a tree they are not
allowed to change. The procedure is the same in either:

1. **Copy the file aside**, mutate the copy, run, copy back. `git checkout -- <file>`
   is on this machine's deny list, and `git stash` leaves an entry behind when
   the pass is interrupted.
2. **Run `git status` in every worktree you touched** and say in the report that
   it is clean. Stop any server you started.
3. **Mutate where an acceptance criterion hangs**, not across the board. A
   criterion no test can carry — two rewritten table rows, an ADR addendum —
   gets a written **nil return** instead. Inventing a mutation for a
   documentation criterion produces a result that means nothing.

The move earns its cost because a test that stays green under a deliberate
break checks nothing. Run 1 produced three of those; run 5's repair to
`assertPlanSum` was mutation-tested before it was believed, and the three
mutations are in the log below.

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
- **Erreichbar über:** der Weg, auf dem ein Lead diesen Stand herstellt — oder „nicht erreichbar"
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
- **Erreichbar über** is the newest line and the one that kills findings. The
  core is a **total function** by ADR 0002: it accepts any slider state, including
  nonsense. A review that sweeps a cartesian product therefore manufactures
  states no lead can produce — and every one of them computes, so every one of
  them looks like a finding. Name the path instead: which slider the lead moves,
  which `SetupLink` carries it in, which set change lowers a second value
  afterwards (#70's case). **No path, no finding** — at most a `Notiz` that says
  so in its first line.

  Run 6 paid for this rule. „Weekend, 8 Leute, dem Sieger ein ganzes Display
  zugesagt" carried a blocking finding, a chart and a card through three phases,
  and the maintainer answered: „bei 8 Personen mit je 3 Boostern ist es schlicht
  unmöglich, ein Display zu verteilen. Darum ist diese Frage nicht real." He was
  right — 240 states in the grid showed the pair of messages, and **not one** of
  them without an oversized reservation the control will refuse.

  Two traps, both seen:
  - A state the **core** accepts is not thereby reachable. ADR 0002 makes the
    core say yes to everything; reachability is a question about the controls.
  - A state that is reachable only **via a later drop** — fewer players, another
    `SetupLink`, a smaller `PromoEnvelope` — is reachable, and that path is the
    answer. It is also the one worth writing, because it is the one the guard at
    the control does not catch.
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

**Write down what the driving session's context cost**, as a number, next to
what the run produced. Otherwise the question "is this getting cheaper?" is
answered by feel, and the answer by feel is always no. The maintainer's working
limit is about **200k tokens** in the driving session; run 5 came to 340k and
that is the reason the phases moved around afterwards.

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

### Run 4 · 2026-09-25 · `/ask-hard-questions` against run 1's findings · one Opus agent

A rehearsal, not a round: the skill was pointed at the findings file of run 1,
whose decisions had already been answered and filed. The three worktrees were
rebuilt from the merge commits' second parents (`5709ab0`, `687757a`,
`02ee4fa`) so the `**Beleg:**` commands would run verbatim, and the two example
question files were withheld — they are the answer key for exactly this batch.

Nine of ten findings came back as **lookups**, five of them against ticket
comments written the day before: the answers of the first round had become
sources. So the rehearsal tested Gate 1 hard and card formulation barely, and a
spent findings file cannot test more than that.

Two defects it found, both corrected in the skill: the **working tree was
missing from Gate 1's list of sources** — a findings file points backwards, and
the agent nearly carded a question the merged code had already settled — and
the seam where a looked-up finding is a repair rather than a card was
undefined. The one surviving card (`B3`, the tautological completeness test)
was verified independently in the parent session: removing a field from all
three hand-kept lists leaves `test/onepiece.test.mjs` at 13/13 green.

### Run 5 · 2026-09-26/27 · #55 and #62 · two Sonnet agents, across two specs

The first batch whose tickets came from **different specs** — #55 in the core
(Spec 1), #62 on the surface (Spec 2) — driven that way on the maintainer's
request, to find out whether the parent session stays small when everything
runs through subagents. It does, and the two things it cannot delegate are the
two that carried the run.

**Disjointness held easily**, and the spec boundary helped rather than hurt:
core and surface share no file. But the boundary is exactly where the defects
sat. Both blockers were invisible to both agents and to both test suites:

- **Recomputing at a built state** found that `curveCount = 0` drops the whole
  `ShapedRemainder` — 40 of 64 `Booster`, at `depth` 1 with `d`=(1), the plain
  case "only Rank 1 is served and gets a Display". The building agent had
  reported it in the subjunctive and called it "no blocker"; the parent's own
  run showed it was reachable with the sheet's own values and a **regression
  against `main`**.
- **The cross-check across worktrees** found that the core writes
  `rows[].reserved` while the shell read `row.reservation`. The stack summed
  correctly, so nothing failed — the diagram simply drew the reserved `Booster`
  as shaped remainder, silently, and `?? 0` hid it.

**The united tree was 61/61 green and carried both.** Across a spec boundary a
green suite is not a signal; it is two suites that have never met. Write that
in the next briefing rather than rediscovering it.

**The counter-check closed the run's biggest gap by doing the obvious thing:**
it found PHP available, started the server, and re-measured every pixel figure
the building agent had reported. All of them held, and the vendored Alpine
turned out byte-identical to npm's `alpinejs@3.14.9`. The parent had filed both
as "not checked" — honestly, but a gap named is still a gap.

**Driving session: 340k tokens**, against a working limit of about 200k. Roughly a third reading spec and tickets, a third writing artefacts (findings file, question file twice, six ticket comments, this log), a third tool output and screenshots.

**Two corrections to the skills came out of it.** `/fan-out` gained nothing;
the procedure held. `/ask-hard-questions` gained a whole stage: the first
version of its cards was rejected by the maintainer for being written in the
vocabulary of the code — `curveCount`, `ShapedRemainder`, `unfit` — and had to
be rewritten as a tournament with 32 people and 96 boosters. **No agent in the
loop can catch that**, the skeptic least of all, because it reads code as
fluently as the writer. It returned a sharp critique that killed a card and two
dominated options, and never mentioned the language.

**One rule was missing and is now written down** (`spec-flow.md`): a blocking
edge protects the ticket that has **not** been built. For one already standing,
the edge does nothing, and the correction belongs in the body of the ticket
still to be built — #49 got the acceptance criterion that retires #62's
substitute, and no edge was added to #62.

**The corrected invariant was mutation-tested before it was believed.** The
repair to `assertPlanSum` nets a reported `unclaimedRemainder` against
`shapedRemainder`, which is exactly the shape that can turn into a blanket
skip. Three mutations on a copy: losing one `Booster` in the curve → 10 red;
reporting the state unconditionally → 3 red; both at once → 10 red. The escape
hatch does not mask a real loss. After run 1's three green tests that checked
nothing, a repair to a test is worth a mutation before it is worth trust.

### Run 6 · 2026-09-27 · #56 and #63 · the first `/round`, one Opus conductor

**The number the skill was built for: 150k against run 5's 340k.** The conductor
held paths, never a findings file, and spent its context on three things only —
starting phases, putting candidates to the maintainer, filing what he answered.
The eleven agents under it spent 1.0M between them, which is the point: that
million never entered the window that had to survive to the end.

The phases ran A → B → C → E → E′ → F, with D skipped because the maintainer
took every candidate to a card.

**Three things went wrong, and none of them was the pipeline.**

*`/fan-out` could not be invoked by an agent.* `disable-model-invocation: true`
predated `/round`, so Phase A aborted before building anything. The flag came
off `/fan-out` and `/counter-check` (commit 7afba63) and stays on
`/ask-hard-questions`, where the skill text names it as deliberate. A session
limit then killed A and its child mid-Phase-4; both resumed from their own
transcripts with the worktrees and PRs already on disk, and nothing was rebuilt.

*The cards were prose about surfaces.* Five went out, one came back answered.
Two came back with „ich bin mir nicht ganz sicher, was du für ein Bild vor dir
hast" — every number on them correct. `fragebogen.mjs` gained an `image`
evidence type, one or two pictures per entry (commit d0bb66d), and the second
round with pictures was answered in full.

*The prototype was never opened.* #63 built a fullscreen mode that keeps the
diagram and grows it; `fsContent()` in the prototype is four lines and contains
no diagram. The review then put three layouts on a card and asked the maintainer
to choose — and he answered by quoting his own prototype. Gate 1 now names
`prototypes/` first for anything about a surface, and `AGENTS.md` carries the
rule beside the decided-number one (commit 800540a).

**The rule that cost the most to learn: a state the core accepts is not thereby
reachable.** A blocking finding, a chart and a card rode on „Weekend, 8 Leute,
dem Sieger ein ganzes Display zugesagt". The maintainer: „bei 8 Personen mit je
3 Boostern ist es schlicht unmöglich, ein Display zu verteilen." Measured
afterwards: of 240 states where both conflict reasons hold at once, **zero**
without an oversized reservation the control will refuse. The findings format
now carries `Erreichbar über`.

**What the skeptic was worth, again:** one whole card struck out, two dominated
options removed, three missing ways added, and one number on a card that did not
reproduce. It has now killed a card in three runs out of three.

**Counts.** 8 findings from A, 5 more from B, 0 refuted. Gates: 6 candidates, 7
dropped, and a second agent checked all seven — none wrongly. Five decisions
reached the maintainer, five came back, four of them as free text that no option
had offered. That ratio is the finding about the cards: when the maintainer
answers outside the options, the options were the wrong ones, not his answer.
