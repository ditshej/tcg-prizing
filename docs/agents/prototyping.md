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
