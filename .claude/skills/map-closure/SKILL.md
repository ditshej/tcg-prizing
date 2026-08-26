---
name: map-closure
description: Decide whether a Wayfinder map is actually finished. Use when a map's frontier has run empty, when the user asks to close or finish a map, or before handing a map off to a spec.
disable-model-invocation: true
---

# Map closure

> **Same skill, two names.** This is `/map-closure` here and
> `/kw-wayfinder-closing-check` in the parallel kirchenweb trial repo. Both are
> built in step and hold the same mechanics — gate, fan-out with fresh lenses,
> skeptic, four-way triage, stop on one complete zero-finding pass. Mirror the
> mechanics, never the name: a change here belongs in the other repo under _its_
> name, with its own tracker commands, label names, filing locations and text
> language left standing. Mirroring happens on demand, never as an unprompted
> follow-up to a session.

An empty frontier is **not** proof that a map is done. It is proof that the
linear pass ran out of tickets, which is a different claim. In trial use, three
maps reported "done" and two were wrong — one had twelve tickets still to come
(among them two decisions that quietly contradicted each other), one had five,
because the fog had never been triaged.

Both failures are structural, not sloppiness:

- **A linear pass cannot see a contradiction.** Every decision is clean on its
  own; the defect sits _between_ two of them, and it appears the moment a late
  decision overturns an early one without stamping it.
- **"Decided" drifts away from "written down".** A signed-off prototype feels
  like a filing and is not one.

So closure is its own pass, with fresh eyes, and it ends on a criterion rather
than a feeling.

## Before you start

Run this in a **genuinely fresh session**. The fan-out is the single most
expensive step in the whole Wayfinder workflow; it has twice hit the session
limit (1.95M and 1.24M tokens) when started in a session that already carried
context.

Decide the number of lenses **with the maintainer**, in German. Roughly 0.15M
tokens per lens including its skeptic. Do not default to eight.

## Stage 0 — the mechanical gate

Four checks, cheap, before any agent is spawned. If any fails, stop and fix
that instead — a fan-out over an ungated map wastes the whole budget.

1. **Frontier empty.** `gh issue list --state open` scoped to the map's
   sub-issues returns nothing open, unassigned and unblocked.
2. **Fog triaged.** Every bullet under `## Not yet specified` has been looked
   at in this pass and either graduated to a ticket, ruled out of scope, or
   consciously left as fog with a reason.
3. **Decisions filed durably.** Every entry under `## Decisions so far` points
   at something outside the tracker where it belongs: a term in `CONTEXT.md`,
   an ADR in `docs/adr/`, or an explicit note that it needs neither.
4. **Scope boundaries justified.** Every line under `## Out of scope` says
   _why_ it sits past the destination, not just that it does.

## Stage 1 — the fan-out

One lens per agent, spawned with the Agent tool. Each lens is a fresh
perspective on the finished map, not a re-read of it.

### The three mandatory lenses

These run in every pass, unchanged:

- **Contradiction between decisions.** Does any decision overturn an earlier
  one — or extend it? And where one does, is the earlier one stamped (see "When
  a later ADR touches an earlier one" in `docs/agents/domain.md`)? A missing
  stamp is a finding even when both decisions are individually correct. The
  extension case is the one to look hardest for: nothing at the earlier ADR
  reads wrong, so nothing draws the eye.
- **Decisions that live only in a prototype, a chat, or a ticket comment.**
  Anything agreed but never written into `CONTEXT.md`, an ADR, or the map.
- **The glossary against itself.** Read `CONTEXT.md` end to end as one
  document — not term by term, which is how it was written and therefore how
  its defects survive. Look for one word carrying two meanings, a state with no
  named opposite, a term no decision uses any more, and a definition that
  contradicts a later one. These are invisible to a per-ticket read: each term
  was correct on the day it was added, and the glossary grows across dozens of
  tickets that never see each other. Findings here are usually **Doku-Lücke**,
  occasionally **Ticket** when a rename would change a decision.

None of these needs the source code. They check documents against documents —
do not grant them code access.

### The other lenses

Invent them **per pass, from this specific effort**. Do not keep a catalogue:
a catalogue becomes a checklist, and a checklist is exactly the linear pass
this stage exists to escape. Read the destination and the decisions, then ask
what _this_ map could plausibly have got wrong.

Every invented lens must be new relative to the map's `## Prüfprotokoll`.

### Running them without burning the session

- **Prepare a reversal dossier first** (`Kehrtwenden-Dossier`). Reading
  decision documents in full is ruinous: a full read sits in context from turn
  one and is re-sent on every later turn — two full-text lenses once accounted
  for 48 % of the bill. Instead, assemble one short document that quotes the
  overturning passages and the stamp lines **verbatim**, so even the
  contradiction lens works from quotations.
- **Run in waves of three.** Six lenses started together died together after
  6.5 minutes and returned nothing after 1.03M tokens. Same price per lens,
  but each finished wave is banked.
- **State an exploration budget in every lens prompt**: about 20 tool calls,
  `grep -n` over full reads. Give the reason in the prompt — every read result
  is billed again on every subsequent turn of that agent.
- **Grant code access per lens, never blanket.**

## Stage 2 — the skeptic

Every finding is attacked by a separate agent that starts from **refuted** and
has to be talked out of it. Give it the finding and the quotations it rests
on, not the lens's reasoning. A finding that survives is a candidate; one that
does not is dropped without discussion.

## Stage 3 — triage

Triage the survivors **with the maintainer, in German, one at a time** — never
as a numbered batch (see the "Grilling — Interview-Stil" rule in the global
instructions). Two or three sentences of context before each one.

Exactly four outcomes, no fifth:

| Outcome              | What happens                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Ticket**           | New child issue of the map, `wayfinder:<type>`, wired into blocking. The map is not closed.                                  |
| **Nebel**            | A bullet under `## Not yet specified` — real, but not sharp enough to phrase as a question yet.                              |
| **Bereichsgrenze**   | A line under `## Out of scope`, with the reason it sits past the destination.                                                |
| **Doku-Lücke**       | The decision exists but was never filed: write it into `CONTEXT.md`, a new ADR, or the earlier ADR's stamp line.            |

## The stopping criterion

The map is closed when **one complete pass produces zero surviving findings.**

_Complete_ is a hard word here:

- Every lens actually **ran**. A lens that crashed, timed out, or hit the
  session limit makes the pass incomplete — regardless of what it had reported
  before it died. An incomplete pass never closes a map.
- Every invented lens in it is **new**, checked against the map's
  `## Prüfprotokoll`.

Anything else — a pass with one finding, a pass with a dead lens, a pass that
reused last round's lenses — means another round.

## The Prüfprotokoll

The map carries a `## Prüfprotokoll` section listing the lenses already spent,
one line each: the pass, the lens, and what it returned. Without it, the next
session cannot tell a fresh lens from a repeat, and the criterion above is
unenforceable.

**Create this section when the map is created**, empty, not when the first
closure pass runs — a section that appears late is a section no session finds.
