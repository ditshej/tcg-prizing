---
name: round
description: Drive a whole review round — build, check, counter-check, decide, correct — as a chain of phase agents, so no session ever spans two phases.
disable-model-invocation: true
---

# Round

`/fan-out` → `/counter-check` → the open decisions → the corrections. The round
already existed; what this skill adds is **who holds it**. Nobody. The session
that runs `/round` is a conductor: it holds ticket numbers, file paths and your
answers, and it never reads a findings file.

Run 5 (2026-09-27) drove the same round from a single session and cost **340k
tokens** against a working limit of about 200k. Nothing in it was wasted work —
the phases were right and both blockers were real. What was wrong is that one
context carried all four phases, when the round has carried its own handover
medium from the start: `…-befunde.md` → `…-gegenprobe.md` → `…-fragen.json` →
`…-antworten.json`. Those files exist **so that the context does not have to
be** the handover. Run 5 wrote them and then also remembered everything in
them.

## The conductor's one rule

> Hold paths, not content.

Concretely, the session running this skill does **not**: read
`review/<batch>-befunde.md`, read the counter-check report, recompute an
acceptance number, read a diff, or summarise a finding it has not read. Each
phase agent reports the few lines the next phase needs, and those lines are all
the conductor keeps.

It has exactly three jobs: start each phase with the right paths, put the
candidate decisions in front of the maintainer, and say at the end what
happened.

## The phases

| | Who | Produces |
|---|---|---|
| **A** | agent · `/fan-out` entire, Phases 0–6 | `review/<batch>-befunde.md` |
| **B** | agent · `/counter-check` | `review/<batch>-gegenprobe.md` |
| **C** | agent · Gate 1 and Gate 2 only | `review/<batch>-kandidaten.md` |
| **D** | **conductor + maintainer** | `review/<batch>-sofort.json` — answers given in the terminal |
| **E** | maintainer · `/ask-hard-questions` | `…-fragen.json`, `…-antworten.json` |
| **F** | agent · file the answers, build the corrections | ticket comments, commits |
| **G** | maintainer | review, merge |

Phase 4's judging half stays intact because it lives **inside** agent A — the
same head that read the source in Phase 3. That is not delegated; it is
enclosed.

## Say where we are, every single time you need him

The maintainer steps in at D and at G, and possibly at E. **He must never have
to ask what is going on.** He has walked away, made coffee, come back a day
later — and the round is four phases long with artefacts scattered through
`review/`. So every message that wants something from him opens with the board,
and no message that wants something from him omits it:

```
/round · Stapel #56 · #63 · Phase D von G
─────────────────────────────────────────────────────────
A ✓ fan-out         PR #80, #81 · 9 Befunde · 2 blockierend
B ✓ counter-check   7 bestätigt, 1 widerlegt, 4 neue Funde
C ✓ Gates           3 Kandidaten, 6 verworfen
D → DU BIST DRAN    3 Kandidaten entscheiden
E   Karten          nur für das, was du zurückstellst
F   ablegen + bauen
G   Review und Merge
─────────────────────────────────────────────────────────
```

Under it, three lines and never more:

- **Was gerade passiert ist** — one sentence per completed phase since he was
  last here.
- **Was ich von dir brauche** — the thing itself, now.
- **Was danach ohne dich läuft** — so he knows whether he can walk away again,
  and for roughly how long.

The same board goes out when a long unattended stretch **starts** ("A und B
laufen jetzt ohne dich"), so he can leave deliberately rather than sit and
watch. It is cheap: a dozen lines the conductor already knows, against the
alternative of him reconstructing four phases from scratch.

A phase that failed says so in its row — `A ✗ fan-out   Agent an #56
abgebrochen: …` — and the board is then the whole message, because the next
thing needed is a decision about the failure.

## Resuming after a break

The board must be reconstructible **from disk**, not from what the conductor
remembers, because the session that started the round may be gone. The
artefacts are named so that their presence is the phase marker:

```
review/<batch>-befunde.md      A ist fertig
review/<batch>-gegenprobe.md   B ist fertig
review/<batch>-kandidaten.md   C ist fertig
review/<batch>-sofort.json     D ist fertig
review/<batch>-fragen.json     E läuft
review/<batch>-antworten.json  E ist fertig
```

So `/round` invoked on a batch that already has artefacts **does not start
over.** It lists `review/`, reads only the headers it needs to fill the board
— not the contents — prints the board, and continues at the first phase whose
artefact is missing.

**Phase D's answers hit disk before anything else happens.** They are given in
conversation, and conversation is the one medium that does not survive a break.
`review/<batch>-sofort.json` takes the shape of the answer file in
`.claude/tools/README.md`, with `optionId` naming the way chosen, `"karte"`
where it was deferred, and `"verworfen"` where he said it was not a decision.
Writing it is the first thing after the last candidate is answered, before the
conductor says a word about what comes next — an answer that exists only in a
sentence is an answer that a closed laptop deletes.

## Phase A and B — start them, do not follow them

Give agent A the ticket numbers, the batch name and one instruction: run
`/fan-out` end to end and stop at the findings file, as the skill says. It gets
no worktree of its own — it hands out one per ticket and keeps the repo root
for reading, per `docs/agents/fan-out.md`.

Give agent B the path to the findings file, the worktrees and the branch heads.
It runs `/counter-check`. It is a fresh context by construction, which is the
whole reason the skill asks for a fresh session; a subagent satisfies that, and
run 5 proved it does the job — it killed a card, corrected two of the parent's
own findings and closed the run's largest gap.

From each, the conductor keeps: the artefact path, the PR numbers, the
branch heads, and the count of findings by severity. Not the findings.

### The one thing the conductor can no longer see, and what to do about it

A session that holds every phase notices things **between** them. In run 5 the
parent saw that merging #62 before #55 would leave the shell reading a core
field that did not exist yet and rendering `NaN` — a defect in neither ticket,
visible only from above. A conductor holding paths would have missed it.

So both A and B are required to end their report with a named section,
**`## Reihenfolge und Integration`**, answering: does either branch depend on
the other landing first, does either read a field the other introduces, and is
there an order in which the merge is wrong? Nil is an answer; silence is not.
That section is the only cross-phase judgement the conductor gets, so it is
asked for explicitly rather than hoped for.

## Phase C — the gates, and nothing after them

This is the new phase, and it exists because of a measured mismatch: the
counter-check of run 5 forwarded **seven** items for the maintainer. Four were
lookups that Gate 1 dissolved, and a fifth the skeptic killed. Two survived.
Handing the raw seven to the maintainer would have spent his attention on five
things that were not decisions — the exact failure `/ask-hard-questions` opens
by warning about.

So agent C runs **Stage 1 of `/ask-hard-questions` and stops there**: both
gates, over every finding from both files. It does not gather evidence, does
not build charts, does not run a skeptic, does not write a question file. Those
are the expensive stages and they are only worth paying for what survives — and
only for what the maintainer says he wants as a card.

It writes `review/<batch>-kandidaten.md`: one block per surviving finding,
carrying

- the question **in the language of the game, not of the code** — Stage 3 of
  `/ask-hard-questions` applies here already, because this is the wording the
  maintainer reads first,
- one sentence of what rides on it,
- the two or more ways Gate 2 named, one line each,
- and the finding ID it came from.

Plus a list of everything the gates dropped, one line and half a sentence of
reason each, so a wrongly dropped decision can be pulled back with one word.

Agent C reports to the conductor: the candidates, in that shape, and nothing
else. This is the one place the conductor does carry content — it has to, to
ask the question.

## Phase D — the maintainer sees them before the machinery runs

The conductor puts the candidates in front of the maintainer **in the terminal**,
one per question, using the harness's own question tool. Each candidate offers
its named ways as options, plus always this one:

> **Als Karte vorlegen** — mit Beleg, Diagramm und Skeptiker.

Three outcomes per candidate, and all three are cheap:

- **Answered here.** The decision is made; it goes to Phase F to be filed. No
  evidence gathered, no chart drawn, no skeptic run.
- **Deferred to a card.** It goes on the list for Phase E.
- **Dropped.** It was not a decision after all, and the maintainer says so.

The saving is real and it is the point: in run 5 both surviving candidates went
through the full card treatment, and one of them — the label on the
participation line — was a question the maintainer could have answered in a
sentence. Its chart, its evidence and its share of the skeptic were paid for
and not needed.

**Do not pre-judge which ones are card-worthy.** The whole reason this is a
question and not an inference is that "is this too hard to answer off the cuff"
is knowledge the maintainer has and the conductor does not.

Then write `review/<batch>-sofort.json` immediately — see "Resuming after a
break". Nothing else happens first, not even saying what comes next.

## Phase E — the cards, if any are wanted

`/ask-hard-questions` carries `disable-model-invocation: true` and **cannot be
invoked by the conductor.** This is deliberate. So the conductor says which
candidates were deferred, and the maintainer types the command. The skill then
runs its Stages 2 to 5 over that reduced set.

If nothing was deferred, this phase does not happen, and the round has cost one
interaction instead of two.

## Phase F — the answers are filed, then the corrections are built

One agent, given both answer files — `review/<batch>-sofort.json` from the
terminal and `review/<batch>-antworten.json` from the cards, whichever exist —
and the instruction to file each answer **where the next session will look it
up**: the ticket comment, an ADR, `CONTEXT.md`. `review/` is
gitignored; a decision left there is gone at the next merge, and the session
after it derives the value again instead of reading it (`AGENTS.md`, "A decided
number is looked up, never back-computed").

Filing comes **before** building, in that order, and the filing goes to the
ticket that will *do* the work, not the ticket where the finding appeared. Run
5 first filed a glossary follow-up against the spec issue, where nobody
building it would read it; it belonged on the ticket whose builder would open
it with `gh issue view <n> --comments`.

Then the corrections, one agent per worktree, with the filed decision as the
source it looks up rather than a rule it is told.

## Phase G — the maintainer reviews and merges

`/fan-out` never merges and neither does this. The conductor reports: what
landed on which branch, what each PR closes, the merge order from
`## Reihenfolge und Integration`, and what is still open.

## Write the number down

Append the round to the run log in `docs/agents/fan-out.md`, **with the
conductor's context cost as a number.** Run 5 is there at 340k as the
comparison. A round driven this way that does not come in materially lower has
failed at the one thing this skill was built for, and the log is where that
becomes visible instead of arguable.
