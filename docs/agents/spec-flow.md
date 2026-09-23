# From a cleared map to tickets

Repo-local rules on top of the vendored flow in `.agents/skills/ask-matt/`. That
flow is right and we follow it — `/to-spec` is where a cleared `/wayfinder` map
merges back onto the main route, then `/to-tickets`, then `/implement` per
ticket. What it leaves open is what to do when the map is too big for the
context window the flow assumes.

## The one-window rule is not satisfiable here

`ask-matt` asks for steps 1–3 — grilling, spec, tickets — in **one unbroken
context window**, so all three build on the same thinking, and puts the limit at
the smart zone, about 150k tokens.

Measured on the Prizing map (#1) on 2026-09-23, for the surface spec alone:

| Source | Size |
|---|---|
| the twelve surface tickets, **with comments** (#15, #23, #26, #31, #32, #35–#41) | 164 KB |
| `CONTEXT.md` | 52 KB |
| `docs/adr/` | 49 KB |
| the map body (#1) | 106 KB |
| `prototypes/cockpit.prototype.html` | 198 KB |
| **total** | **≈ 570 KB ≈ 140k tokens** |

That is the whole smart zone spent on **reading**, before a word of spec is
written — and two more specs and `/to-tickets` would have to fit after it. Drop
the prototype and the map body and 265 KB remain, still close to half the window
as pure preamble.

So the rule is not merely inconvenient here, it is arithmetically out of reach.
Pretending otherwise means working on a degraded window and calling it
compliance.

## What we do instead

- **One session per spec**, `/clear` between them, each starting from an
  explicit reading list. Not `/compact`: the material of one spec is close to
  useless for the next, so a compacted window carries the wrong half.
- **`/to-spec` still gets called** in each of those sessions — after the reading,
  not instead of it. It is the merge point; that its template fits imperfectly
  is not a reason to skip a step of the flow.
- **`/to-tickets` per spec**, not once across all of them. Once across all would
  need a window that has seen all three, which is the thing we just established
  cannot exist.
- **Blocking edges across spec boundaries are set by hand.** They are few and
  obvious — the core blocks the surface — and no session is in a position to
  derive them.
- **Never edit the vendored skill text.** Corrections live here (see
  `CLAUDE.md`).

## The three specs of map #1, and the edges nobody derives

One session per spec means no session ever sees the whole picture. What follows
are the facts that fall **between** them. They live here because this file is
the first thing every spec session is told to read — a fact parked anywhere else
is a fact that session never meets.

| Spec | Issue | Tickets | State |
|---|---|---|---|
| 1 — the core, `distribute(settings)` | #46 | #53–#60 | spec written, ticketed |
| 2 — the surface and the `NoticeStack` | #61 | #62–#73 | spec written, ticketed |
| 3 — `SetupLink` and `LinkMigration` | #47 | #48–#52 | spec written, ticketed |

All three specs are written and ticketed; nothing is built. Every ticket of
Spec 2 hangs off Spec 1 or Spec 3, so the buildable frontier sits at the other
two: **#53** (the bare distribution) and **#48** (the v1 key register) are the
only tickets across all three specs with no open blocker.

Two edges are set by hand. Both are obvious once seen and invisible from inside
a single session:

- **#49 (the read path of Spec 3) was re-pointed and the placeholder is gone.**
  It hung on #46 as a whole while Spec 1 had no child tickets; it now hangs on
  **#54** (the `DefaultSet` sheets) and **#56** (the conflict branch), and the
  edge to the spec issue is removed. #56 rather than #53, because #49's own
  criterion — a `depth` above today's cap **stands** and carries a
  `ConflictNotice` — needs the conflict branch, not just a plan; #53 and #55
  come along transitively.
- **Spec 2 consumes two things from Spec 3**: the report structure from #51 and
  the always-complete copy form from #50. The dependency runs one way only —
  Spec 3 never needs the surface — so the edge is Spec 2's to add when it gets
  ticketed, not Spec 3's to anticipate.

Keep the table current as the specs land. It is three lines, and it is the only
place where the shape of the whole thing is written down.

## What it costs, stated plainly

The three specs do not come out of one mind. The flow's reason for the single
window — that spec and tickets build on the same thinking — is real, and we are
giving it up. The mitigation is that the thinking is not in a window anyway: it
is in the map's tickets and in `CONTEXT.md`, which is what `/wayfinder` builds
them for. A reading list is a worse carrier than a live context, and it is the
one we have.

## Collapse or standalone — pick deliberately

`/to-spec` describes itself as collapsing the map's **linked decisions** into a
buildable plan. Read strictly, a spec is then short: it orders the decisions and
**points at the tickets**, which stay the memory. Two shapes are possible, and
the choice is per map, not per taste:

- **Collapse.** Short, points at tickets for every reason. Scales with map size,
  because the tracker carries the weight. Cost: nothing is self-contained, and
  every `/implement` session pays a large read.
- **Standalone.** Implementable without the map. Does not scale — each one costs
  a full session — and it restates what the tickets already hold, so the two can
  drift.

Spec 1 (#46) is **standalone**, and that was the right call for a reason worth
recording: writing the formulas out rather than pointing at them surfaced four
errors in the prototype that a collapse would have carried forward untouched —
the conflict branch handing out more `Booster` than the `RankPool` holds, a
`DisplayReservation` below the depth vanishing silently, the tie in the
suggestion search never shown, and the `Offer` measuring on the row total
instead of the `RankPool` share.

Re-deriving is expensive and it is also the only thing that checks the map
against itself. On a map whose decisions were settled against a prototype, pay
it.
