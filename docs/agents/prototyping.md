# Prototyping

Repo-local rules on top of the vendored `/prototype` skill. That skill picks
between a logic demo and a UI exploration; these rules cover what it leaves
open — the form, the warning, the source material, and the branch.

## Decide the form per case, don't default

Two shapes, and the choice is per prototype:

- **Standalone HTML mockup.** One double-clickable file, no dependencies.
  Fast, but a vacuum — nothing around it is real. Soften that by using
  realistic data volumes (a 32-player tournament, not three rows) and realistic
  markup, not lorem-ipsum boxes.
- **A real throwaway route.** Realistic, because it sits in the actual shell,
  but it costs scaffolding for code that gets thrown away. This repo has no
  router (see `docs/adr/0004`): the app is `index.php` composing `views/` with
  Alpine over plain ES modules, so a "route" here is a second `.php` file
  beside the real one, clearly named as a prototype.

## A mockup is a reference, not a template

Put a warning in the **file header** aimed at the agent that will later
implement the real thing: only a _layout_ was decided here, and the real UI
uses the project's own components, i18n and access checks. Without it, the
implementing agent copy-pastes and ships non-conforming code — the mockup looks
finished, which is precisely what makes it dangerous.

## Look for an existing surface first

Before drawing anything, search for a surface already in the repo that the new
one can mirror. If the new surface partly mirrors an existing one, **ask the
maintainer for a screenshot of the real page** — proactively, don't wait to be
offered one. Template markup shows structure but not the rendered result, and a
screenshot pins the accuracy better than any amount of reading `views/`.

## The prototype branch

- **One branch per map**, mirroring the map — not one per surface, or the names
  drift apart from each other and from the map.
- **Never merged.** The prototype is a primary source, not a contribution.
- **Pointed at from the handoff or PR**, so the decision it settled stays
  reachable.
- Plain HTML is written **directly in a worktree on that branch**, not on the
  feature branch and then moved.

The branch for the Prizing map is `prototype/rank-distribution` — named after
the first prototype's subject rather than after the map, from before this rule.
It keeps that name: two comments on the closed ticket
[Verteilungsmodell auf die Ränge](https://github.com/ditshej/tcg-prizing/issues/6)
link it, and closed-ticket comments are where the answers live. Renaming would
break those permalinks. The convention applies from the **next** prototype
onward — this is a grandfathered exception, not a repeal.

## When branches stack

As soon as a feature branch and a prototype branch both exist, they drift the
moment either gets a commit.

- **Note every fork point before the first rebase**:
  `git merge-base <parent> <child>`. Each rebase rewrites the SHA the next one
  hangs off, so a fork point read afterwards is already wrong.
- **Restack bottom-up, each with an explicit `--onto`.** A bare
  `git rebase <parent>` replays the parent's own commits as duplicates.
- **A branch checked out in a worktree must be rebased inside that worktree.**
- **Rebase the prototype branch too, even though it never merges.** Otherwise
  its fork point freezes, it carries frozen copies of the feature commits, and
  a `grep` inside its worktree silently answers questions from a stale tree.

### Once the planning is done, drop the worktree instead of rebasing

The rebase rule above is for the **planning phase**, when a prototype is being
drawn and a feature branch is being built at the same time and both are open in
worktrees. Once a map's surfaces are decided, the prototype files stop being
drawn — they only get marked (see the next section) — and rebasing a branch nobody commits to buys nothing — it only rewrites
SHAs that closed-ticket comments may point at.

**So: remove the worktree, keep the branch.** The branch is the primary source
and keeps its history, gaining only marking commits; what goes away is the checked-out copy of the *rest*
of the tree — `public/`, `CONTEXT.md`, `docs/` — which is what actually goes
stale and what a `grep` wanders into. Fetch the prototype when you need to look
at it:

```
git worktree add --detach <tmp> prototype/rank-distribution   # look
git worktree remove <tmp>                                     # done
```

Decided 2026-09-28, after run 8, with `prototype/rank-distribution` 114 commits
behind `main` and its files untouched since the planning phase. The rebase rule
stands for the next map while its prototype is still being drawn.

## When a later decision overturns the prototype

The prototype is where a surface question is answered (`AGENTS.md`, "A decided
form is looked up too"), so a decision that overturns part of it has to reach
the file — otherwise the next lookup reads the old form as decided.

- **Mark, don't redraw.** A comment at the place itself, in German like the
  file: `ÜBERHOLT durch #N` (or `ERGÄNZT durch #N`), narrowed with „nur …“ where
  only part of it fell, then „Verbindlich ist …“ naming where the decision now
  lives, and „Nicht umgebaut.“ Inside HTML markup the comment is `<!-- … -->`.
- **One `docs(proto): mark … as superseded by #N` commit** on the prototype
  branch, comments only.
- **The prototype counts in a stamp row.** A late ticket that stamps the
  tickets it overturned stamps the prototype in the same go, and a map-closure
  filing that stamps a ticket checks the prototype for the same claim.

Practised since 2026-09-28, written down after map-closure
pass 4 (2026-10-07) found two places a ticket's stamp row had missed.
