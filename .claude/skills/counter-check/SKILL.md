---
name: counter-check
description: Take a fan-out findings file apart again with a fresh head — reproduce or refute each finding, and look where the first pass did not.
disable-model-invocation: true
---

# Counter-check

The second pass over `review/<batch>-befunde.md`, the file `/fan-out` leaves
behind. Its format, the hand run it came out of, and the recomputation command
live in [`docs/agents/fan-out.md`](../../../docs/agents/fan-out.md).

**Start at that file's run log.** Every lens below exists because a run went
wrong in a particular way, and the log says which — including the defects that
have already recurred. A class of failure the last pass found is the first
place to look in this one, not a closed case. Done when you can name what the
previous run turned up before you open the findings file.

## Fresh context, or this is theatre

Run this in **its own session or a subagent with fresh context** — never as a
fork of the session that wrote the findings. Inherit that session's derivation
and you inherit its blind spots: every finding will look supported, because the
reasoning that produced it is already in the window and agrees with itself. The
whole value is the independence. If the only way to start is a fork, stop and
say so instead of running a pass that can only confirm.

Read `## Nicht geprüft` first. It is the map of where nobody has looked, and it
tells you where to spend the pass.

Then read `## Quellen, gegen die geprüft wurde` — **the second map, and the one
that does not announce itself.** A gap in `## Nicht geprüft` is declared; a
source the first pass never opened is invisible, and every number it derived
will still check out. In the first run this sank a whole finding: the parent
had read a spec's settings table and its pool section, filed a contradiction
between ticket and spec, and the formula it called missing stood spelled out in
a third section two screens down. Every number in that finding was right. Ask
of each finding: which section of the source would settle this, and is it in
the list?

## Nothing here is repaired, and nothing is left turned

You check; you do not fix. The branches under review stay untouched, and so
does `main`.

Mutation testing turns the implementation wrong on purpose, so it is the one
move in this skill that can do damage. Copy the file aside, mutate, run, copy
back — `git checkout -- <file>` is on this machine's deny list and `git stash`
leaves an entry behind when the pass is interrupted. Before you report, run
`git status` in every worktree you touched and say that it is clean. Stop any
server you started.

## Lens 1 — reproduce each finding, or refute it

Every finding carries a repeatable command under **Beleg**. Run it. Do not read
it and agree.

**A refuted finding is a hit, not a nuisance.** State that to yourself before
you start, or this lens quietly turns into a machine for producing
confirmations. The same goes for **verschärft** and **abgeschwächt**: a finding
whose severity moves is a result.

Done when every `B<n>` in the file has a verdict and a command output of your
own under it.

## Lens 2 — green tests that encode the wish instead of checking it

The sharpest lens, and in the hand run it was found half by accident. Two real
examples, both from that batch:

- A completeness test checked "remove a field from the sheet → the check
  fires". That is a restatement of its own claim: shorten the **reference
  list** instead — exactly the mistake the ticket comment warned about — and it
  stays green.
- A test for the sum rule compared row total plus judge share against
  participation plus judge plus row total, and **left the term at issue off**
  one side. It wrote the wanted invariant down instead of checking it against
  the plan, and went green while the plan double-counted: 40 instead of 32.

The move against this is hand-made mutation testing: **turn the implementation
wrong and see whether the test goes red.** A test that stays green checks
nothing. Do this where an acceptance criterion hangs, not across the board.

Budget for this: the first run had eighteen criteria across three tickets, and
this was the longest part of the pass, not an appendix to lens 1.

A criterion no test can carry — two rewritten table rows, an ADR addendum —
gets **a written nil return, not a mutation**, the same way the visual pass
does. Inventing a mutation for a documentation criterion produces a result that
means nothing.

Done when every acceptance criterion has either one mutation with the test's
colour written down, or a nil return saying why none applies.

## Lens 3 — what the first pass never looked at

Driven by `## Nicht geprüft` and `## Quellen`, plus whatever the first two
lenses opened up. New findings go into the same form as the findings file, so
they can be appended.

This lens has a method, and it is the one no single agent in the fan-out could
ever run: **count the ticket pairs that read the same place in the source, and
cross one against the other.** They are enumerable before you start. The parent
session crosses the pairs it thought of; the pairs it did not think of are
where the defects sit. In the first run the parent crossed the key register
against the data sheet and found them sound — crossing the *sheet* against the
*core*, a pair nobody had named, produced the batch's one undiscovered defect
in a single command. One Node process, absolute imports from two worktrees.

## The visual pass — conditional, not obligatory

Renderable in this repo today is **exactly one file**: `dev/index.html`. Start
the server from the root of the working tree, `python3 -m http.server <port>`,
then `http://localhost:<port>/dev/`. Pick a free port rather than the 8000 from
`dev/README.md`; a second pass beside a running server collides silently.
`public/` holds only `core/*.mjs` and no HTML. Playwright MCP is available.

**A finding is not looked at here, it is reproduced here.** The bench has a
slider only for what the core already read when it was built, so a field a
ticket just added has none — the way in is the settings JSON field, which takes
the finding's fixture verbatim. Load the fixture, then read the invariant line.
Without this the pass photographs an untouched page, which is the failure the
last paragraph of this section is about.

The workbench is real evidence when the core changed: it imports `public/core/`
live, prints a **raw dump of the whole `DistributionPlan` as JSON** — so fields
a ticket adds show up by themselves, with nobody touching the bench — carries
an **invariant line** that goes red on a violation, and has the four measured
states from #53 as buttons plus a fifth that deliberately breaks the sum rule
(`dev/README.md`).

It is **not the app's surface** (`AGENTS.md`, "Core workbench";
`dev/README.md`). A finding about how the bench looks is not a finding about
the app.

**Isolation:** the server is started from the root of a working tree, so the
bench imports **that** tree's `public/core/`. To see a worktree's state, start
the server **inside that worktree**. Otherwise you are looking at `main` and
calling it the branch.

And the rule without which this pass becomes theatre: **if the change touches
nothing renderable, look at nothing, and write the nil return down.** A
screenshot of an unchanged page as "evidence" is worse than no check, because
it looks like one. In the hand run it applied to two of three PRs — a key
register and two data sheets have no surface.

## Output

A German report. Per finding one of four verdicts — **bestätigt · widerlegt ·
verschärft · abgeschwächt** — each with the evidence you ran yourself, not the
one you were given. Then the new findings of this pass, in the findings file's
own form so they append cleanly. Then your own honest `## Nicht geprüft`.

Like `/fan-out`, this skill does not merge. The decisions that are left over —
the ones no source settles and no agent may make alone — go to
`/ask-hard-questions`, which selects them and serves them as cards.
