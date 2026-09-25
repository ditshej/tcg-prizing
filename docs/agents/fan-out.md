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
| #57    | the indivisible axes     | `../tcg-prizing-57`      | `feat/57-unteilbare-achsen`   | `public/core/distribute.mjs`, `test/distribute.test.mjs`                            | #76 |
| #48    | the v1 key register      | `../tcg-prizing-48`      | `feat/48-schluesselregister`  | `public/link/encode.mjs`, `test/link-keys.test.mjs`, `docs/agents/setup-link.md`, `docs/adr/0007-*` | #77 |

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
git diff --name-only main..HEAD | grep -E 'dev/|\.claude/skills/|\.agents/skills/'
```

Empty output is the pass. Add the other agents' files to the pattern.

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
