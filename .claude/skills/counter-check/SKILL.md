---
name: counter-check
description: Take a fan-out findings file apart again with a fresh head — reproduce or refute each finding, and look where the first pass did not.
disable-model-invocation: true
---

# Counter-check

The second pass over `review/<batch>-befunde.md`, the file `/fan-out` leaves
behind. Its format, the hand run it came out of, and the recomputation command
live in [`docs/agents/fan-out.md`](../../../docs/agents/fan-out.md).

## Fresh context, or this is theatre

Run this in **its own session or a subagent with fresh context** — never as a
fork of the session that wrote the findings. Inherit that session's derivation
and you inherit its blind spots: every finding will look supported, because the
reasoning that produced it is already in the window and agrees with itself. The
whole value is the independence. If the only way to start is a fork, stop and
say so instead of running a pass that can only confirm.

Read `## Nicht geprüft` first. It is the map of where nobody has looked, and it
is the only part of the file that tells you where to spend the pass.

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

Done when every acceptance criterion has one mutation run against it, with the
mutation and the test's colour written down.

## Lens 3 — what the first pass never looked at

Driven by `## Nicht geprüft`, plus whatever the first two lenses opened up. New
findings go into the same form as the findings file, so they can be appended.

## The visual pass — conditional, not obligatory

Renderable in this repo today is **exactly one file**: `dev/index.html`. Start
the server from the repo root, `python3 -m http.server 8000`, then
<http://localhost:8000/dev/>. `public/` holds only `core/*.mjs` and no HTML.
Playwright MCP is available.

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

Like `/fan-out`, this skill does not merge.
