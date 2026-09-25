---
name: fan-out
description: Build several implementation tickets in parallel subagents, then check their result independently from the parent session.
disable-model-invocation: true
---

# Fan-out

Several tickets, one subagent each, one worktree each, one PR each — and then a
parent session that **does not believe the reports**. Both halves are the
skill. A fan-out without the second half is three unreviewed branches with
confident summaries attached.

Driven once by hand on 2026-09-24: #54, #57, #48, three Sonnet agents, PRs
#75–#77. The facts of that run, the disjointness rule, the recomputation
technique and the findings-file format live in
[`docs/agents/fan-out.md`](../../../docs/agents/fan-out.md); read it before
Phase 0 and keep it open through Phase 6.

This skill **never merges.** It stops at the findings file.

## Phase 0 — preflight

1. **Read the run log** at the end of `docs/agents/fan-out.md` — what the last
   runs found, and what each of them corrected here. It is short on purpose.
   Skip it and this skill is advice; read it and it is evidence, including the
   failures that have already recurred once. Done when you can name the class of
   defect the previous run turned up.
2. **`main` is clean and pushed.** `git status` empty, `git log origin/main..main` empty.
3. **The file sets are written out and proved disjoint** — see `docs/agents/fan-out.md`.
   Write the ticket → files table into the session, compare each pair, and name
   the directories that belong to nobody. Any overlap: stop and re-cut the
   batch. Done when every pair of sets has been named and found empty.
4. **One worktree per ticket**, with the command from the doc. Done when
   `git worktree list` shows one line per ticket and every pre-existing
   worktree is still on its own branch.
5. **`git log --oneline -20`** — the commit tone goes into the briefings verbatim.
6. **Name the cross-checks now** (Phase 5). Written down before the start, or
   they drop out at the end, when everything is green and nothing asks for
   them.

## Phase 1 — briefing from the template

The three briefings of the hand run were ~80 % word-for-word identical. That
shared part is a template, so it is not re-invented — and shortened — each
time. Fill the angle brackets, change nothing else:

> Work in `<absolute worktree path>`, there and only there. Other worktrees and
> the repo root: read yes, write no.
>
> These files belong to other agents in this batch: `<files>`. Read them if you
> need them; write none of them. Also off limits: `dev/`, `.claude/skills/`,
> `.agents/skills/`.
>
> Read in this order: `AGENTS.md` → `docs/agents/spec-flow.md` →
> `docs/agents/issue-tracker.md` → ticket #`<n>` **with its comments** → spec
> #`<spec>` **with its comments** → `CONTEXT.md` → the ADRs that touch your
> area.
>
> Never read a ticket without its comments: `gh issue view <n> --comments`. If
> that prints no comments — it happens in this repo — fall back to
> `gh issue view <n> --json title,body,comments --jq '.title, .body, (.comments[]?|.body)'`.
> The body is the question as it was frozen at charting time; what a
> neighbouring ticket learned arrives later as a comment.
>
> Language: code, identifiers, code comments, commits and UI in English,
> identifiers as `CONTEXT.md` names them; the PR description in German.
>
> Use `/tdd`. Do **not** run `/code-review` — the parent session reviews. No
> typechecking; there are no types.
>
> **The numbers in the acceptance criteria are a bench, not a checklist.** If a
> number does not come out, leave the test alone, stop, and say in your report
> which side is wrong — the implementation or the criterion.
>
> `node --test` from your worktree root must be green, including every
> pre-existing test, with no packages installed.
>
> Commits: Conventional Commits, English, the subject line a **statement of
> what has become true**, not an imperative. Every message ends with
> `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
>
> Open the PR yourself against `main`. German body, first line English and
> alone: `Closes #<n>`. Then verify the link took, with the GraphQL command in
> `docs/agents/issue-tracker.md` — the failure is silent. The body ends with
> `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
>
> Report back in German: the files; the commits with SHA and subject; every
> acceptance criterion with a verdict **and the number you actually computed**;
> the `node --test` result; the PR number and the GraphQL output; every open
> point and how you decided it; and everything in the ticket, the spec,
> `CONTEXT.md` or an ADR that looked wrong or self-contradictory. That last
> point is the most valuable thing you produce. Do not drop it to look tidy.

Then add exactly one **trap slot** per ticket: the one thing this agent gets
wrong if nobody says it. In the hand run there were three, and all three came
out of ticket comments — which is where to look for them.

## Phase 2 — start

All agents in a **single message**, or they do not actually run in parallel.
Pick the model per run; the hand run used Sonnet for implementation.

## Phase 3 — the parent's homework, while the agents work

**This is the phase that disappears when the procedure is rebuilt from memory,
and it carries everything after it.** While the agents build, the parent reads
the **source** the acceptance numbers were derived from — in the hand run the
`## Input: Settings` table in issue #46, 19 fields. The truth is then in the
parent's head **before** the first report arrives.

Skip it and the parent checks the reports against each other instead of
against the source, and does not notice, because both read plausibly.

Done when the source section has been read in full and its numbers written into
the session.

## Phase 4 — per PR, the reports are not evidence

For each PR, yourself:

- `node --test` in that worktree.
- `git diff --stat main...HEAD`, then read the substance of the diff. Three
  dots here too, for the reason in `docs/agents/fan-out.md`.
- **Recompute every acceptance number at a freshly built state**, with the
  import command in `docs/agents/fan-out.md`. Not read off the tests.
- **Forbidden paths**, with the `grep` from the same file. Empty output.
- **The `Closes` link**, via GraphQL yourself — not from the agent's report.
- **Look at the tests' form, not only their colour.** A green test that
  restates its own claim proves nothing; `/counter-check` carries the two
  worked examples and the mutation move that exposes them.

Done when each of these six has a written result per PR.

## Phase 5 — cross-checks across agent boundaries

What no single agent can see, because it only knows its own part. In the hand
run: the keys of the `SetupLink` register (#48) against the fields of the
`Game` sheet (#54) — both derived from the same spec table, so they had to
correspond. Checked in **one** Node process importing from **two** worktrees.

The result is the shape to aim for: register = 19 fields minus `depthStep` =
18, in identical order; sheet = 19 minus four trailing minus two rank-naming =
13; and the twelve `absent: 'leaf'` keys were exactly the sheet without
`depthStep`. The third comparison is what made it a proof rather than two
counts agreeing.

Run the cross-checks named in Phase 0. Done when each has a command and an
output.

## Phase 6 — write the findings, then stop

Write `review/<batch>-befunde.md` in the format from
`docs/agents/fan-out.md`, German, stable IDs. Then **stop**. Merging is the
maintainer's call; the worktrees stand until after the merges, and `dev/` is
caught up once they are in.

The skill is resumable here: if the maintainer says go on, hand over to
`/counter-check` — in a fresh session, never as a fork of this one. That does
not happen by itself.
