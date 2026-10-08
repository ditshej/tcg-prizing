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

### The merge probe is built with two of this repo's settings turned off

A freshly built state for several branches is a merge probe, and building one
by hand runs into two settings this repo has on. Run 11's counter-check walked
into both, each on the recommended path:

- **`merge.conflictStyle = diff3`** writes a fourth marker, `|||||||`, opening
  the base block. An instruction that says „remove the markers" does not name
  it. Left in `.mjs` it is a `SyntaxError`; left in `.css` it is **silent**.
- **`rerere.enabled = true`** replayed a resolution that had once been
  practised wrong into the next, fresh merge — **without asking**.

So, for every probe, standing rule:

```sh
git -c rerere.enabled=false merge <branch>
# resolve; under diff3 "keep both sides" means the ||||||| block goes too
grep -rc '<<<<<<<' <conflicted files>   # every count 0
grep -rc '|||||||' <conflicted files>   # every count 0
node --test
```

Both greps, not one: the first alone passes a file that still carries a base
block. And the suite comes after the greps, because only the `.mjs` half of a
leftover marker makes it red.

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

## The app renders — the skill text still says it does not

`/counter-check`'s visual pass carries the sentence „Renderable in this repo
today is **exactly one file**: `dev/index.html`", with `python3 -m http.server`
and the note that `public/` holds no HTML. **That is out of date.** Since
`public/index.php` exists, the app itself renders: PHP composes the shell from
`views/` outside the docroot (ADR 0004), so a static file server shows nothing
and a docroot of `public/` shows the real surface.

```sh
php -S localhost:<port> -t public    # from the root of the working tree
```

Pick a free port, as before — a second pass beside a running server collides
silently. Run 9 took its screenshots exactly this way, and the one finding it
could only have made at the picture (the plan rail's curve `select`) came from
there.

What does **not** change: the workbench under `dev/` stays the evidence when the
**core** changed — it imports `public/core/` live, dumps the whole
`DistributionPlan`, and has the invariant line. It is a tool, not the app's
surface (`AGENTS.md`, „Core workbench"), and nothing seen in it is a statement
about the app. The two are complementary: `dev/` proves the numbers, `php -S`
proves the screen.

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

### Run 7 · 2026-09-27 · #49, #59, #58 · `/round` with Phase D in place

**The conductor's context: roughly 40k, against run 6's 150k and run 5's 340k.**
The estimate is honest about being one — it is read off the transcript's shape,
not off a counter, because no counter in the harness reports the conductor's own
window separately from the session total. Run 6's 150k was arrived at the same
way, so the comparison holds even if both numbers are soft. What is hard: the
conductor never opened a findings file, a counter-check report or a question
file in seven phases. The six agents under it spent **~770k** between them.

The drop from 150k to 40k is not a better conductor. Run 6 ran two rounds of
cards after the first came back unanswered; this round had no second lap, and
it skipped nothing. **Phase D is where the difference sits** — it was invented
after run 6 and used for the first time here.

**Phase D paid for itself on its first run.** Six candidates went to the
terminal; two were answered in a sentence (the name `WayOut`, and what stands
under a warning when no single slider clears it) and four went to cards. The
two answered in the terminal would each have cost evidence, a chart and a share
of the skeptic — that is the waste run 5 paid twice for and run 6 paid five
times for. Run 6's ratio, five decisions all going to cards, is exactly what
Phase D exists to break, and the break is measurable: **four cards instead of
six**, and no round of cards came back unanswered.

**The disjointness analysis moved in front of the batch choice, and it changed
it.** Asked what could run in parallel, the first pass named a three-ticket
batch built on ticket boundaries. Reading the specs killed it: #46 puts
`suggestions` and `offerFor` in the **same file**, so #59 and #60 can never be
batched; and a comment on #49 requires it to edit `public/ui/plan.mjs`, which
collides with every Spec-2 ticket. The frontier had seven unblocked tickets and
admitted a maximum batch of **three**. Both constraints are in the specs, and
neither is visible from the ticket list. A batch chosen from titles would have
collided twice.

**Gate 1 removed two whole cards by finding the source:** #70 decides the
`WinnerPack` overhang with a formula (318/318 coverage, recomputed), and ADR
0003 already carries the rule about sheets. Phase E's own Gate-1 pass then found
three things the two reports had **wrong** — among them B3's claim that
`suggestions(plan)` stands in `CONTEXT.md` and in #59's body. It stands in #46,
#61 and #68, and nowhere else. The filing pulled only the places that really
say it. A report is not a source, and the gate is where that gets tested.

**The skeptic killed no card this time** — the first run in four where it did
not. It struck three dominated options, forced two new ones, and got a number
wrong (19:5 against a measured 19:4, because `plan.displayVector` is trimmed to
the depth). Five of its thirteen points were written off with a reason. A
skeptic that misses on a number it did not run is the argument for Stage 2's
rule that evidence is produced in session, applied to the skeptic itself.

**Counts.** 9 findings from A, 7 more from B, **0 of 9 refuted** — the
counter-check confirmed every one and sharpened two over a second independent
path. 21 mutations in B, of which #58's suite went red on all five fresh grips
and #59 carried two blind tests. Gates: 6 candidates, 9 dropped. Six decisions,
six answered. One new ticket (#86) for the core change one card chose, rather
than a patch inside the batch.

**The round made the suite faster while adding to it.** #58's sweep went from
116 064 states to 1 024 and `node --test` from 1 709 ms to 315 ms, with all five
characterisation equalities kept and won one last time from the unmerged core.
Eleven tests were added on top. The card that did it asked whether a ratchet of
five never-decided numbers was worth a second per run; the answer was to keep
the ratchet and shrink the grid — an option the skeptic supplied.

### Run 8 · 2026-09-28 · #86, #50, #51, #64 · `/round`, four agents, three quota deaths

**The conductor's context: roughly 55k, against run 7's 40k and run 5's 340k.**
Same soft estimate, same method as run 7, and the rise has a cause worth naming:
this round restarted six agents after two quota resets and re-ran a merge probe
by hand. The nine agents under it spent **~993k** between them, plus two aborted
starts that produced nothing.

**Four is the ceiling of a batch here, and it is structural.** Seven unblocked
tickets, but exactly one of {#86, #60} (both write `suggest.mjs`), exactly one of
{#64, #65, #66} (all three write `plan.css` and the single Alpine component), and
#50 and #51 disjoint. One core + write path + net + one surface. No fifth group
exists, so no analysis can produce a fifth agent.

**The batch choice turned on one collision a file matrix cannot see.** #50's
acceptance criterion describes the *caller's* behaviour, and the caller is
`plan.mjs:40` — the same `pins` field #64 rebuilds. Not the same file by accident:
the same field. Splitting the wiring out as #89 is what made four agents possible,
and it cost one small ticket.

**The blocking finding was invisible to the file matrix too.** #50 and #51 share
no file and still broke each other in *both* merge orders: #51 appends `report`
to `decode`'s return, #50's round-trip test compares the whole returned object.
Phase A called it 21 red assertions; the counter-check ran it on two built merge
probes and found **one** — the corpus loops inside a single test. It then refused
Phase A's one-line repair as a decision belonging to the maintainer, because
`decode`'s shape is a versioned public interface described three different ways.

**The counter-check refuted nothing and was still the best-paid phase.** 15
findings in, 13 confirmed, 1 corrected, 2 sharpened, 1 weakened — and **7 new**,
two of them decisions. Its mutation run (11 mutations, 10 red) closed Phase A's
largest declared gap. The one finding it could not have reached by reading reports
— G3, `encode(plan.settings)` silently turning one pin into twelve and losing
`depthStep` — came from forming a ticket pair Phase A never formed.

**Phase D's value was a question the maintainer asked back, not an answer he
gave.** K2 was served as a guard question: should #58's sum rule stop searching
`plan.settings`? He answered „wo bitteschön sollen negative Zahlen möglich sein?"
— and the real finding fell out. Nowhere, except through a hand-bent link:
`readInt` accepts `/^-?\d+$/`, while `readVector` two functions down already
discards a negative limb (#49, K4). The single slider had never been given the
rule. The decision moved from the guard to the reader, and #58 was left untouched.
**A candidate the maintainer reframes is worth more than one he picks**, and Phase
C cannot produce that — only the terminal round can.

Six candidates, **six answered in the terminal, zero cards.** Phase E did not
happen; the round cost one interaction instead of two. Gates: 22 findings in, 6
out (11 dropped by Gate 1, 11 by Gate 2). One Gate-1 drop was the run-6 class
exactly — the `Type` label, already settled at `CONTEXT.md:722–726`.

**A pre-build collision analysis has an expiry date, and it is the build.** Both
review phases checked whether #64 calls the core. It did not, and they were right.
Then finding G2 required #64's cap test to measure against the source instead of
transcribing its own numbers — and *that* made it call `suggestions()`, whose
signature #86 had just turned to `suggestions(plan)`. Every branch green alone,
one red together. It surfaced only because the conductor built a fresh four-way
merge probe instead of adding up four green reports. **The corrections need their
own disjointness check; the one done before the build does not cover them.**

Worse than the red test was its neighbour: the reachability check was **green
because it was empty** — `suggestions()` returned `[]`, so there was nothing to
assert. The repair was required to prove it bites afterwards, and it does (narrow
`rankFloor`'s cap: two tests fail).

**Three quota deaths, and the fix is not to run less but to write more often.**
The first counter-check died with ~40 minutes of work in its head and zero lines
on disk. Every phase after it was told to write its artefact incrementally; the
four build agents were told to commit per decision. The second death — all four
build agents at once, on their first tool call — cost nothing at all, because
nothing had been promised that was not yet written. The third took the catch-up
agent mid-sentence, four commits into five points, and **the rule paid out**: the
branch was clean, the four commits stood, and the session picked up the remainder
by reading `git log` rather than by starting over.

The arithmetic is worth keeping. The instruction costs a few tokens per agent.
One death without it cost a whole phase; three deaths with it cost one partial
phase between them.

**Counts.** 15 findings from A, 7 more from B, 0 of 15 refuted. 188/188 on the
four-way merge probe. Two new tickets: #89 (the wiring #50 was forbidden to do)
and #95 (post-merge catch-up). PR #94 carries two ADR addenda — and the filing
agent corrected the conductor on the stamp rule: a stamp line is for a *later*
ADR touching an earlier one, not for an ADR extending its own body.

### Run 9 · 2026-09-28 · #60, #52, #66 · `/round`, four agents, three deaths

**The conductor's context: roughly 137k, against run 8's 55k and run 7's 40k.**
The number is not comparable and the reason is worth naming rather than
explaining away: `/ask-hard-questions` ran **inside the conductor session** this
time, because the maintainer types that command where he is standing. Stages 2
to 5 brought two composite screenshots, the tool README and a worked example
into the one context that `/round` exists to keep empty. The `/round` part alone
— phases A to D plus F — sat around 60k, in line with run 8. If the two skills
keep meeting in one session, the conductor rule needs an answer for Phase E, and
"hold paths, not content" is not it: Stage 3 says the reading is the conductor's
alone.

**Settled on 2026-09-30, and the last sentence above was wrong.** Stage 3 is a
test on the card's *text* — "read it out loud with the repo closed" — and costs
almost nothing; it can stay where the maintainer types. The 77k sat in Stage 2,
which already said to file a screenshot beside the question file and point an
evidence entry at it, and never said not to open it afterwards. So the conductor
rule needed no exception, only applying: Stage 2 now ends on "no artefact bigger
than its own path has been read into this context", with the one seam where
looking is still required — evidence you did not produce yourself, or cannot say
which state it shows. Phase E keeps its session. The lesson generalises past this
skill: a rule that says where an artefact *goes* is not yet a rule about whether
you may read it, and the second half is the one that costs.

**The conductor cut the batch wrong, and Phase 0 caught it.** The frontier was
derived from the specs and the run log while the `blockedBy` query was left
broken — three `gh` invocations failed on output formatting, and the fourth was
never written. The tracker had the answer all along: #68 is blocked by #60 and
#67, both open, and `offerFor` does not exist on `main`. The batch went out as
#60 · #52 · #68, the maintainer picked #68 from a list that should not have
contained it, and the fan-out's own disjointness pass found it before a line was
built. **A failed lookup is not a missing answer; it is an unasked question.**

**Phase D ran twice, and the second run is new.** The three candidates from the
gates went to cards — three of three, the exact inverse of run 8's six of six in
the terminal. Then the verification of the dropped list pulled **two** findings
back, and both were answered in a sentence in the terminal. So the pull-back
pass paid for itself twice over in one round, and it belongs in the flow rather
than in a session's good intentions.

**Gate 1 closed a finding with an altered quotation.** G7 was dropped against a
decision at #89 that reads „hängt die Regel an das Leseergebnis, **nicht an
`pins`**"; the gate cited it as „nicht an `migrated`" and answered a different
question with it. Nothing else in the chain would have caught that — the gate is
the last station before a finding disappears, and it is the one station nobody
re-reads. Now somebody does.

**The skeptic killed a card and left a better one behind.** K3's decision stood
verbatim in `CONTEXT.md` („Die Wege heraus stehen ohnehin schon in der
`ConflictNotice`"), and two of its three ways were not ways — `flagged` is
defined as covering „jeden **bedienten** `Rank`", so an unserved one cannot be
marked. Underneath lay a sharper finding the round had not had: the foot claims
„ranks 3–32 get nothing" while rank 3 holds twelve boosters, because
`plan.mjs:150` cuts on `booster || packs || winners` and forgets `displays` —
and the prototype has the same gap, so it decides nothing. **Four runs of the
skeptic striking out a card; the first where the strike produced a replacement
instead of a hole.**

**The best answer a card got was a refusal of its question.** K1 asked which
numbers the offer sentence should name. The maintainer picked none of the four
ways and wrote instead that with a combined handout there is no separately
issued participation booster at all — the pool becomes freely distributable, and
a rank that gets a display gets the display. That is not a wording; it is what
`CombinedHandout` *means*, and #46, #60 and #61 all treat that as settled in the
other direction. It became **#103**, deliberately not `ready-for-agent`, and
nothing in the batch was patched to chase it. A card that comes back with the
question rewritten is the most expensive kind to build and the cheapest kind to
be wrong about.

**Two more suites that were green because they were empty** — run 8 found the
first, and this is now three rounds in a row. #60's criterion 1 *had* a test,
over six hand-picked states, and each of the six fell through for a different
reason: removing the guard left **196 of 196 green**. The raster that replaced it
bites on 70 of 3108 states. #52's v2 test asserted `report === null`, which holds
just as well when the chain wrongly starts at v1. **A test that passes says the
test passes** — and the only way to learn which, is to break the code on purpose.

**An instruction from the conductor was wrong and the agent overrode it.** G8's
finding called the skill text vendored; it is not — `/counter-check` is a real
directory, absent from `skills-lock.json`, and `AGENTS.md` lists it under
„ours". The conductor passed the premise through unchecked, the docs agent
checked it and corrected the sentence at its source instead of routing around
it. That is the behaviour the fan-out wants from a builder, and it is worth
saying out loud that it came from doubting the brief.

**Three deaths, zero work lost.** Two auth refusals (403) and one session limit
(429) killed six agents between them. Every phase wrote incrementally and every
builder committed per decision, so the restart resumed at phase 1 with Phase 0's
artefact on disk, and no agent had promised anything it had not already written.
The rule from run 8 is now load-bearing rather than advisory.

**Counts.** 12 findings from A, 8 more from B, 0 of 12 refuted. Gates: 20 in, 3
candidates, 17 dropped — of which the verification pulled 2 back. 3 cards, 3
answered, 1 killed by the skeptic and replaced. Five decisions filed to #103,
#66 (×2), #68, #52, #47, #89. Suites: 197 · 206 · 213 alone, **240/240 on a
freshly built four-way merge probe**, and the arithmetic closes exactly
(188 + 9 + 18 + 25). Two new tickets: #103 (what `CombinedHandout` means) and
#104 (the curve select that never refreshes and never pins).

### Run 10 · 2026-09-30 · #89, #104 · `/round`, four agents, no cards

**The conductor's context: roughly 35k, against run 9's 137k, run 8's 55k and
run 7's 40k.** Phase E did not happen — all four candidates were answered in the
terminal — so this number measures `/round` alone, and it is the lowest yet. The
comparable figure is run 9's „`/round` part alone, around 60k".

**The counter-check refuted the parent's integration section, and that section
is why the phase exists.** Phase A built an octopus merge probe (257/257,
conflict-free) and concluded „no merge order is wrong", then recommended #89
before #104 — in a sentence whose own first half said the opposite. Phase B
rebuilt the probe, agreed on the end state, and named what an octopus merge
cannot see: the intermediate states. **#89 first** leaves the address bar writing
without the rail pinning the curve — measured, link says `players=48` while the
screen says `curve=extreme`, which is exactly the defect B4 was written against.
**#104 first** is harmless. The lesson is narrow and reusable: a merge probe
proves the end state, never the order.

**The gates did what they were added for.** Thirteen findings in, four candidates
out, nine dissolved — four as lookups, five as agent work. Of the four lookups,
one was settled in `prototypes/` (G3: `depth` is capped at the player count, said
by the prototype, by #61 and by the built `Details` sheet; only
`views/controls-hot.php:29` disagreed — a repair, not a decision). All four
candidates were answered off the cuff. **No evidence gathered, no chart drawn, no
skeptic run, and Phase E skipped entirely**, so the round cost one interaction
instead of two.

**A finding reversed itself during Phase F, an hour after it was written.** B3
said both PRs carried a closing line GitHub had not accepted — checked twice,
still empty after 24 minutes. The maintainer decided accordingly: merge as-is,
close by hand. At 15:44 UTC the links appeared, in both directions, with nothing
edited. So B3 was a *delay* twenty times longer than the docs knew of, not a
failure, and the decision it produced is still valid but moot. Phase F filed both
states in order — the finding, then the measurement that overturns it. Worth
keeping as a shape: **a finding about an external system's timing has a shelf
life, and the round is long enough to outlive one.**

**The most valuable defect was found by building the decision, not by reviewing
it.** K1 asked what an incoming link without a readable `v` should mean. Filing
and building it surfaced that `migrate()` never excluded the versionless read —
`steps.slice(version - 1)` with `version: null` is `slice(NaN)` → `slice(0)`,
the whole chain over a link that never claimed to be v1. Invisible while `STEPS`
is empty, wrong at the first real bump. Neither A nor B saw it.

**One exception, reported rather than smuggled.** The answer to K1 said „version
decision with a `LinkMigration` in the same commit"; Phase F built it with
neither, and said so. Its reasons were looked up, not invented: `setup-link.md`
sets a start date for that rule which has not been reached (no `SetupLink` is in
circulation — #89 writes the first one), and a migration from „no N" to N+1 has
no beginning and cannot be written. Filed in ADR 0007. That is the right handling
of an instruction that turns out to be unbuildable: build the rest, name the gap.

**Counts.** 10 findings from A, 3 more from B, 0 of 10 refuted, 2 sharpened, 1
weakened. Gates: 13 in, 4 candidates, 9 dropped. 4 answered in the terminal, 0
cards. Suites: 244 (#104) · 257 (#89) alone, **261/261 on a freshly built octopus
merge probe**, arithmetic closing exactly (240 + 17 + 4). Decisions filed to #89,
#104, #47, #72, #73, ADR 0007, `docs/agents/setup-link.md` and
`docs/agents/issue-tracker.md`. Three PRs open: #107 (#104), #108 (#89), #109
(docs). Merge order: **#104, then #89, then #109.**

### Run 11 · 2026-09-30 – 10-01 · #65, #67, #69 · `/round`, one quota death, a grilling in parallel

**The conductor's context: roughly 130k, of which about 40k is Phase E.** That is
the `/round` part at about 90k, against run 10's 35k. It is an estimate,
summed from the session's token counter over three segments, because the round
spanned two session restarts. Where the extra came from is clear:
the restart after a quota death in Phase B, the conductor filing two corrections
itself in Phase F, and the conductor reading the comments of a grilling (#113)
that came back while Phase F was building. The last of those was content, not
paths, and a fresh agent could have read it instead.

**The conductor opened by asking a question whose answer was on disk.** Before
Phase A it put #103 to the maintainer as an open decision. Six decisions had
been filed there as a comment that same day. That is the failure `AGENTS.md`
names as the most expensive kind, made in the first minute by the one session
that is supposed to hold the lookup lists. The fix is plain: read
`--comments` before asking about any ticket, including one labelled `question`.

**Phase B died at a quota limit with no artefact on disk, and was restarted
rather than believed.** The rule „a phase is done when its artefact is on disk"
did its job: two screenshots and no report meant B had not happened. The
restarted B was told to write its report early and keep extending it. It
finished in one go, so that instruction is still untested.

**B refuted the reason A gave for its one blocker.** A said a wrong `--ours` in
the hand merge would delete a whole ticket „and no probe goes red", because the
three test files are disjoint. They are disjoint, but they also do not collide:
the other ticket's tests merge in cleanly and point at the deleted code. 15,
10 and 10 probes go red. In exchange, B walked into two real traps on the
recommended path, `diff3`'s fourth marker and `rerere` replaying a practised
resolution. Those became the standing merge rule in this file.

**Phase D produced a third outcome the skill does not name: a question opened
instead of answered.** K1 (a button promising a value beyond a slider's end) was
not answered and not deferred to a card. The maintainer asked whether sliders
were the right form at all. The conductor filed it as a grilling ticket (#113),
the maintainer grilled it in a parallel session, and its decisions landed in
the round's tickets while Phase F was building. One of them reached a builder
mid-run through a message, and it reshaped that branch (`DROP_NOUN`, the one
place #113 will swap *slider* for *value*). K4 hung itself on the same ticket
and was settled there. The round absorbed this without restarting anything.
Worth keeping: **a parallel session can feed a running round, as long as it
files to the tickets the builders read.**

**The one card was answered with none of its options, and that is the card
working.** K3 asked what to call the step grid in the reset confirmation. The
skeptic killed one option (its label was another glossary term), struck an
invented price (height, not width) and a false necessity (dropping the line
would also drop the pin from the reset), and found the missing way of folding
the step into `Served ranks`. The maintainer then chose a fifth way in free
text: name each item with its target value. Two screenshots made the situation
visible enough that he answered with what he wanted rather than the least bad
of four.

**Filing is not self-checking.** F1 cited the wrong decision in #103 (number 4,
the switch-back notice, instead of 3, the `ConflictNotice` source) and left #61
without a comment. The docs builder caught both while reading the filed comments
against the sources. That is the second time a later reader has caught the
filer, after run 5's glossary follow-up.

**Counts.** 15 findings from A, 6 more from B, 1 partly refuted, 2 sharpened,
1 weakened. Gates: 21 in, 7 candidates, 14 dropped. Phase D: 4 answered, 1 card,
2 moved to #113. Suites after Phase F: 277 (#65) · 301 (#67) · 302 (#69) alone,
on a base of 261. **The merged total is not measured.** By arithmetic it is
261 + 16 + 40 + 41 = 358, and the merge is where that is checked. Decisions filed
to #61, #65, #67, #70, #103, `CONTEXT.md` (the named `ConflictNotice`
sources) and this file. New tickets: #113 (grilled, `ready-for-agent`, blocked
by #67) and #114 (B14). PRs: #110 (#65), #112 (#67), #111 (#69), #115 (docs).
Merge order: **#110, then #112, then #111, then #115.** #113 needs #112 first.
After the merge: `dev/` picks up `rafflePot()`, and #65's pin read gets its row
in `READ_SITES`. That row needs its own key list, because only `winnerPacks`
changes what it reads.

### Run 12 · 2026-10-01 · #68, #72, #113 · `/round`, three quota deaths, #114 deferred

**The conductor's context: roughly 55k, estimated** over three session segments
(two account switches after quota deaths). That is back near run 10's 35k and
well under run 11's 90k for the `/round` part. Phase E did not happen.

**The disjointness check came before the build, and it deferred a ticket.** The
maintainer suspected overlap; Phase A confirmed it from the source: #114's step
grab sits in the very `Served ranks` row #113 tears down, on the same write path.
#114 moved to run 13 with a comment on the ticket. #72 and #113 share
`views/controls-sheet.php` but no region, and a region table for the three shared
files kept „keep both sides" mechanical. Both were built in parallel.

**Three quota deaths, and the artefact rule carried each restart.** Phase A died
after the disjointness decision but before any build; it had written the
findings file early (the run 11 lesson, now tested), so the restart reused the
decision, the table and the three empty worktrees instead of redoing them.
Phase F died mid-filing; its `…-ablage.md` log let the restart skip the K1
lookups and the comment already posted. **Writing early works; it is now the
default instruction to every phase agent and every builder („commit early").**

**Two Phase D answers were free text, and one of them was a principle.** K1 asked
whether a link carries the step or the number. The maintainer answered that the
question should not exist: the link carries everything one has set. Phase F
applied the principle beyond the finding and found the one value it had not
covered, the `RaffleRange`. A spec decision said „never in the link", so F asked
rather than overriding it. The conductor put it to the maintainer in one line
(„reist mit") and restarted F. Worth keeping as a shape: **a principle answer
widens the scope of the filing, and whatever it overturns goes back to the
maintainer, not into the build.** K4 („nothing else should be clickable while a
number is unconfirmed") was a third way that neither option had named.

**Phase G was not just review: four more questions came out of it.** Asked at G,
in the terminal, each answered in a line: the folded chip of the no-boosters
notice (`⚠ No boosters`, because tournament and winner packs still go out), the
unknown-key line of the link report (kept), and whether a chosen `RaffleRange`
counts in the pin chip beside `Copy link` (it does, and drop-all resets it). The
fourth arose from his own answer. He said the drawn winners should not travel.
The follow-up agent measured that a draw writes the same `manualWinner` counter
as the tile's ±, which has always travelled, and asked back rather than
building. The answer was „bleibt so". **The conductor's first wording of the
pin-chip question failed:** he could not tell the pin chip from the winner count.
The second wording named where the button sits and what it shows, and that one
was answered. A question about a surface names the place on screen, not the
identifier.

**Counts.** 9 findings from A, 3 more from B, 0 refuted, 1 sharpened, 1 weakened.
Gates: 12 in, 4 candidates, 8 dropped. Phase D: 4 answered in the terminal plus
1 follow-up, 0 cards. Suites after Phase F: 398 (#113) · 412 (#68) · 398 (#72)
alone. **Merge probe, every intermediate state measured:** 362 → +#119 398 →
+#118 448 → +#117 484 (488 after Phase G), no `rerere`, both marker greps 0. Decisions filed to #68,
#71, #72, #113, #61, #69, ADR 0002 and `docs/agents/setup-link.md`. PRs: #119
(#113), #118 (#68), #117 (#72). Merge order: **#119, then #118, then #117.**
#117 last resolves one real comment conflict over `syncAddress`: keep #72's text,
with *control* for *slider*. Run 13 starts with #114 on top of #113.

### Run 13 · 2026-10-02 · #114, #70, #71 · `/round`, four agents, no cards, no deaths

**The conductor's context: 66k at its peak, measured** from the session
transcript (input plus cache tokens of the last call), in one session segment.
The base before the first phase was 35k: system prompt, `AGENTS.md` and the
skill text. So the round itself cost about 31k. The conductor first wrote
„roughly 40k, estimated". That was 26k too low. The estimate went to the log
and the measurement only came after the maintainer asked for it. **From now
on the number is read from the transcript, not estimated.** The earlier
„estimated" entries (runs 10–12) are not comparable to this one. Phase E did
not happen.

**The disjointness check ran first and deferred nothing.** The maintainer
suspected that #70 and #71 overlap at the `NoticeStack` and that #114 overlaps
#113's number row. Phase A checked at the source and found them disjoint: #70
changes what the notice says, #71 where it sits, and #114 only the step chip and
a new method beside `setSlider()`. All three were built in parallel. So a
suspicion is something to measure, and it can come back negative. Run 12's
check on the same kind of overlap deferred a ticket.

**The gates dropped a finding the counter-check had sharpened.** B1 (way 1
searches instead of computing) came out of Phase B as „zu entscheiden". Gate 1
dissolved it as a lookup with a repair, because `CONTEXT.md` and ADR 0002's
Nachtrag already ask for the nearest value that clears the conflict. Only the
texts that said otherwise had to change. Phase F did that repair from the
dropped list. The dropped list carries work as well as reasons.

**Two of five answers overturned the build, and one moved numbers that were
not asked about.** K-B9 set the controls column to 286 instead of 352. Every
breakpoint derived from that width moved with it: side by side from 674
instead of 740, three columns from 1030 instead of 1096, K-B10's hot column
from 722 instead of 787/788, and the deck at 1597. Phase F was told to
re-derive these rather than keep the old literals, and it did. Two derived
values had no decision behind them: the deck at 1597, and a `TournamentType`
line in `CONTEXT.md` changed from 352 to 286. Phase F reported both instead of
leaving them unmentioned. They are for review at G.

**Counts.** 15 findings from A, 2 more from B, 0 refuted, 2 sharpened. Gates:
17 in, 5 candidates, 12 dropped. Phase D: 5 answered in the terminal, 0 cards.
Suites after Phase F: 497 (#114) · 515 (#70) · 521 (#71) alone. **Merge probe,
every intermediate state measured:** 489 → +#123 497 → +#124 523 → +#125 555,
conflict-free. Decisions filed to #70, #71, #61 and #121, and the prototype
corrections to `prototype/rank-distribution` (`f72145d`). No ADR. PRs: #123
(#114), #124 (#70), #125 (#71). Merge order: **#123, then #124, then #125.**
All three merged in that order on 2026-10-02, `main` at 555/555, and #114, #70
and #71 closed by their PRs. The `dev/` follow-up came after the merge. The
bench now imports `winnerPackOverhang()` instead of keeping its own copy of the
formula, and three sentences that still said the ways out are „computed, not
searched" (B1) were rewritten.

### Run 14 · 2026-10-02 · #73 · `/round`, four agents, no cards, no deaths

**The conductor's context: 59k at its peak, measured** from the session
transcript (input plus cache tokens of the last call, read before this entry
was written), in one session segment. The base before the first phase was 36k,
so the round itself cost about 23k, against run 13's 31k. Phase E did not
happen.

**PHP was checked before anything else.** K4 from run 10 says the images are
made on 8.3. `php -v` showed 8.3.33 in the conductor, and again in A and F
before each built. The stop the prompt asked for did not fire.

**The prompt carried the moved breakpoints, and the body was flagged, not
followed.** #73's canvas table still said 739/740 and 1674. A built against
run 13's numbers (674, 1030, 1597, 436, 494, 722, 399), and every boundary was
checked on both sides. Phase F posted a correction comment at #73 (B4) and a
pointer at #71, because #71 is where the next session would look up 494.

**Two of five answers were delegated back to the conductor.** For K2 (the
height threshold 494) and K4 (the exception under 436 × 494) the maintainer
said „entscheide du". The conductor chose `schiene-gemessen` and
`seite-scrollt`. Both are marked as delegated in `…-sofort.json` and in the
filing at #73, so a later reader can tell a conductor's choice from the
maintainer's own. With K2, 494 is no longer a fixed number: the threshold is
351 + 56 + the measured rail.

**One answer left a hole, and Phase F named it instead of filling it.** K1
(`diagramm-weicht`) keeps the drawn tile visible from 673 wide and on the
master. On the flat stage the diagram stops at its 60 px floor, and the answer
does not say what else gives way. That question is filed at #73 for the next
round. A10 is new and has no decision: at 320–340 wide the Plan header wraps
to two lines, `PLAN_FIXED` is about 18 px short, and the rank message sits up
to 15.9 px under the rail. It is in the protocol and at #121.

**The known raffle-over-chip case was found, not discovered.** It came in as
B9, and the gates dropped it as a lookup, because the prototype puts the chip
above the bar. B17 is new in #127: the lifted notice now covers the drawn tile
on the master. That is the prototype form too, and `CONTEXT.md` › NoticeStack
now says so.

**Counts.** 13 findings from A, 4 more from B, 2 refuted, 3 sharpened,
1 weakened. Gates: 18 in, 5 candidates, 13 dropped. Phase D: 5 answered in the
terminal (2 delegated), 0 cards. Suite: 555 on main, 558 after A, 563 after F.
Decisions filed to #73, #71, `CONTEXT.md` and `AGENTS.md` (`docs/acceptance/`).
Device items went to #121 as one comment. No ADR. PR: #127 (#73), head
`037be2a`, the only branch, with no merge order to get wrong. Merged on
2026-10-02, `main` at 563/563, #73 closed by its PR. No `dev/` follow-up: the
bench imports none of the changed modules, and no stale `RAIL_HEIGHT` or 494
remains outside the history lines.

### Run 15 · 2026-10-02 to 10-04 · #129 · `/round`, five agents, seven cards, one stall

**The conductor's context: 81k at its peak, measured** from the session
transcript (input plus cache tokens of the last call, read before this entry
was written), in one session segment. The base before the first phase was 30k,
so the round itself cost about 51k, against run 14's 23k. This is the first
round since run 9 with a Phase E. Run 9 ran Stages 2–5 inside the conductor and
came to 137k. Here Stages 2–4 and the question file ran in an agent, and the
conductor only started the server. What the conductor did carry: the
`/ask-hard-questions` text, which the maintainer's command loads into the
conductor whatever happens next, seven candidates in Phase D, and the free
texts of the answers, read to brief Phase F.

**PHP was 8.3.33**, checked before A, so the stop did not fire.

**All seven candidates went to cards, and five came back as free text.** Phase
D cost one interaction and decided nothing. The cards then did their job. Only
K1 (`sprung-ok`) and K7 (`preis`) took an offered way. The free texts
overturned more than the cards asked about. The diagram is now a nice-to-have
that stands only where there is room, on every fold. The take-back list
scrolls sideways instead of paging, so #129's own „blättert" is gone. The Plan
header scrolls instead of wrapping, which closes A10. „— widen the range" is
removed everywhere. A10 came in undecided and was not derived. It went to D as
a candidate, as the prompt asked.

**„Enough room" was delegated, and Phase F defined it by measuring it.** The
maintainer's words were „was das genau bedeutet, überlasse ich mal dir". F
set: the diagram stands where `rest − bar overlap − 113 ≥ 60`, with the rest
measured as if the diagram stood. Otherwise it is gone. Boundaries were checked
on both sides at 812×348/349, 1280×477/478 and 1280×548/549. Three further
choices of F's own are flagged in the #129 resolution comment: the sideways row
also applies in the cramped exception, a throw scrolls its chip into view, and
tall flat stages keep the diagram with the bar open. They are for review at G.

**F found a race that A and B did not.** On about every second load the
raffle bar was measured before it was shown, so the diagram neither shrank nor
left. It now waits a frame and re-measures until nothing moves.

**Two stops, neither a death.** The question-file server outlived the
background job's default limit before any answer was sent. It was restarted
with the 2 h limit, and the answers arrived on the second run. Phase F stalled
once, killed by the stream watchdog after 600 s mid-build with the filing
committed and the build uncommitted. It was resumed with its own context via
`SendMessage`, told to check the filing first, and finished. A long agent run
should commit at each step it would not want to redo.

**Counts.** 10 findings from A (0 blocking, 7 to decide, 3 notes), 3 more from
B, 0 refuted, 2 sharpened. Gates: 13 in (B10 split in two), 7 candidates,
7 dropped. Phase D: 0 answered in the terminal, 7 cards. Phase E: 7 answered,
2 by an offered way and 5 by free text, one of them delegated. Suite: 563 on
main, 579 after A, 579 after F. Decisions filed to #129 (resolution comment,
seven ⚠︎ marks in the body, new title), #73 and #69 (earlier comments marked
or struck), `CONTEXT.md` (`WinnerRaffle`, `Fold`). Device items went to #121
as one comment, including the bar rendering 5 px taller in headless Chrome. No
ADR. Prototype corrections are on `prototype/rank-distribution` (`1bb41a3`).
PR: #130 (#129), head `6b78f10`, the only branch, with no merge order to get
wrong. Open at G: 674×399 keeps 31 px after the first throw (the list still
grows there per #69), and 435×380 keeps 5.6 px, the price of the cramped
exception.

### Run 16 · 2026-10-08 · #142, #145 · `/round`, six agents, three cards, no deaths

**The conductor's context: about 85k at its peak**, read off the harness's
remaining-token counter rather than the transcript. The base before the first
phase was about 33k, so the round itself cost about 52k, level with run 15. The
`/round` command was not expanded by the harness — `disable-model-invocation`
kept it out of the conductor's skill list — so the conductor read
`SKILL.md` once instead; that read is in the base. Phase E again ran Stages 2–5
in an agent, the conductor only started the server, and it read the chosen
`optionId`s, not the cards.

**All three candidates went to cards, and all three came back on an offered
way.** K1 `44-px-gehen-vor` (the free row of #129 holds landscape only before
the first throw), K2 `zwei-zaehler-nebeneinander` (number field 44 instead of
54, two counters per row down to 360), K3 `ausnahme-unter-348`. The three are
one conflict seen three times: #142's 44 px against space promised earlier.
The skeptic added three ways, struck one dominated way, and proposed folding
K3 into K1; the cards were linked instead.

**The merge order was set by the conductor, not found.** N2 was filed as „the
second PR to land carries it", which leaves the builder nothing to build. The
conductor fixed #147 before #148, so #148 carries N2, measured against a
throwaway merge probe. A filing that hinges on an order nobody has chosen yet
should choose it.

**Counts.** 14 findings from A (1 blocking, 3 to decide, 10 notes), 5 more from
B (0 blocking, 2 to decide, 3 notes), 0 refuted, 2 weakened. Gates: 19 in,
3 candidates, 16 dropped, 4 of them repairs. Phase D: 0 answered, 3 cards.
Phase E: 3 answered, all by an offered way. Suite after F: 622 on #148, 601 on
#147, 623 on the merge probe. Decisions filed to #142 (three comments, ⚠︎ in
the body), #143, #129 (⚠︎ on AC 1) and #69; repairs to #142 and #145. No ADR,
`CONTEXT.md` › `Fold` updated on #148. PRs: #147 (#145) head `189874f`, #148
(#142) head `73a9622`; merge #147 first. Open at G: 320 wide still scrolls
(rail 229), and `MEASURED_RAIL` in `test/ui-fold.test.mjs` still holds the
2026-10-02 readings, left because it tests the mechanism.

### Run 17 · 2026-10-08 · #146, #143, #144 · `/round`, four agents, no cards, one quota death

**The conductor's context: not readable as one number this time.** The
harness's remaining-token counter restarted when the API session limit reset
mid-round. It showed about 39k spent before the break, about 37k of it base
(the expanded `/round` text included), and about 27k after. Adding the two
segments gives an upper bound of about 66k. The round itself cost about 30k,
below run 16's 52k. Phase E did not run, so no cards were read.

**The quota death came in Phase A, and resuming it worked.** A and its #143
builder both died on the session limit, after #146 and #144 were built. A
`SendMessage` to A, giving it the worktrees, PRs and partial findings file on
disk, let it resume its own builder and finish. Nothing was rebuilt.

**Phase 0 found the tickets not disjoint**, as the maintainer foresaw. #146 was
built alone, then #143 and #144 off its branch in parallel. B simulated the two
cross-PR repairs (`.prep-offer` stub, the SetupLink sentence in `CONTEXT.md`)
inside the PRs. That removed A's planned post-merge follow-up commit.

**All three candidates were answered in the terminal, so there were no cards.**
K-B1 a (every header icon button is a raised card, the theme toggle too), K-B3 b
(shorter output line, `tournament` dropped, measured to fit at 393 and 375),
K-B5 a (⚠︎ note at the sentence in ADR 0002/0005/0006, standing rule in
`docs/agents/domain.md`).

**Counts.** 15 findings from A (0 blocking, 6 to decide, 9 notes), 4 more from
B (all notes). B confirmed 9 of A's findings, refuted 3 and corrected 3. Gates:
3 candidates, 16 dropped. Phase D: 3 answered, 0 cards. Decisions filed to #143
and #144, none to #121. Suite after F: 631 on #152, 650 on #151, 649 on the
merge probe in both orders. PRs: #150 (#146) head `5fdabab`, #152 (#143) head
`ef1390e`, #151 (#144) head `ba89b23`. Merge #150 first, then the other two in
either order. Open at G: B13, B16 and B17 were not built. A joint test over all
three header buttons is possible only after the merge. F added a `Theme`
glossary entry with a `_Label_` line „Mode“ that nobody asked for. That is the
fallback AGENTS.md says to avoid if either side can move, so it is put to the
maintainer at G.
