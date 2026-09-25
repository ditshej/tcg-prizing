---
name: ask-hard-questions
description: Turn the open decisions of a review pass into a questionnaire — the selection first, the cards second.
disable-model-invocation: true
---

# Ask hard questions

The piece between `review/<batch>-befunde.md` and `.claude/tools/fragebogen.mjs`:
read a review pass, keep the findings that only the maintainer can settle, and
serve those as cards.

Of the eight findings the first fan-out produced, **two were a decision.** The
rest were a note, already settled elsewhere, or a repair an agent can make
alone. So the skill's worth is decided before a single line of JSON is written:
one that turns every finding into a question is worse than none, because it
spends the maintainer's attention on things he should never have been shown.

This skill **decides nothing and merges nothing.** It selects, formulates,
serves, and stops.

- **Input:** `review/<batch>-befunde.md` (format and run log in
  [`docs/agents/fan-out.md`](../../../docs/agents/fan-out.md)), plus the
  `/counter-check` report where one exists.
- **Output:** `review/<batch>-fragen.json`, then a running server and a URL.
- **Not yours:** `review/<batch>-antworten.json`. The maintainer writes it by
  answering; acting on it is the next session's work — and that session's first
  move is to **file each answer** in the ticket comment, the ADR or
  `CONTEXT.md`, because `review/` is gitignored and a decision left there is
  gone at the next merge (`AGENTS.md`, "Building several tickets at once").

The file format, the two chart kinds, and the rule that a numeric piece of
evidence is asked about its **form** before its formatting, live in
[`.claude/tools/README.md`](../../tools/README.md). Read it before writing the
question file, and read the two answered examples in `.claude/tools/examples/`
beside it — they carry what the format cannot: how much stake belongs on a
card, and when a chart earns its place.

**German on screen, English in the code.** Everything in the question file is
read by the maintainer, so it is German — titles, stake, options, captions.
Identifiers, JSON keys and commit messages stay English. The reasoning is in
`.claude/tools/README.md`; it is a standing decision, not an oversight.

## Stage 1 — the two gates

The severity line in the findings file does **not** select. In the first batch
`B1` (blockierend) became a card and `B2` (zu entscheiden) did not; `B4`, filed
as a **Notiz**, came back a day later as a **blockierend** card. Severity
describes the defect; these gates ask who is allowed to settle it.

Run both, per finding, in this order.

### Gate 1 — find the source that already decides it

Go looking for the place where this was settled: a ticket comment, an ADR, a
section of the spec, a term in `CONTEXT.md` — **and the working tree you are
standing in.** A finding whose answer is written down somewhere is **not** a
question; it is a lookup, and the answer goes into the handover report with its
location.

The working tree is the source that gets forgotten, because a findings file
points backwards: its `**Beleg:**` commands name the worktrees of the day it was
written, and reading only those keeps you in that day. Meanwhile the branches
merged and the repairs landed. In the trial run this nearly produced a card
whose answer stood in the same worktree, in code — the skeptic caught it, which
is no way to run a gate. Ask of every finding: **does `main` still do this?**

This gate is the skill's reason for existing, and it comes from
`AGENTS.md`, "A decided number is looked up, never back-computed". In run 2 the
counter-check reported one wrong curve value; the values had all been decided
long before, in #21 and #25, and the sheet had been derived instead of read.
No lens found that — the maintainer recognised it.

The gate cuts both ways, and the second direction is the surprising one:

- It **removes** findings that a source settles.
- It **creates** findings the pass never had. Two of the five cards that day
  carry `"finding": "neu"`: they did not exist until someone went and read
  #21. Once a decision is on the table, the question is no longer "is this
  value plausible" but "does the sheet say what was decided" — and that is a
  different, usually sharper, card.

**A lookup is not automatically a repair**, and this is the seam where the two
gates rub. Sort by whether the source and the code agree:

- **They agree** — nothing to ask. Repair or note.
- **They disagree, and only the code can move** — a repair. An agent writes the
  decided value back.
- **They disagree, and moving the source is live** — a card. `B4` is the worked
  case: #21 and #25 had written the sheet out cell by cell, the sheet said
  something else, and the maintainer was still owed the choice between taking
  the canonical values and changing one of them.

Done when every finding names either the source that settles it, or the search
that came up empty.

**On a second pass over the same findings file, Gate 1 eats everything.** The
answers of the first round were filed into ticket comments, so they are now
sources — in the trial run nine of ten findings came back as lookups, five of
them against comments written the day before. That is the gate working. It also
means a findings file is **spent** once its round closed: re-running it tests
Gate 1 and nothing else.

### Gate 2 — two defensible ways, and they differ in outcome

What survives Gate 1 becomes a card only if you can name **two ways that lead
to different products**. The count is a test of the finding, not of your
patience:

- **One way** — it is a repair. An agent does it; no card.
- **Two or more** — a card.
- **None that differ in outcome** — a note. Whatever is chosen, the same thing
  ships.

If Gate 2 is hard, that is usually Gate 1 reporting that you have not found the
source yet.

Done when every surviving finding carries two named ways, and every dropped one
carries the sentence that dropped it.

## Stage 2 — the evidence is the card

The single most useful observation from both runs: **the card is carried by the
evidence beside the question, not by the question.** The maintainer cannot
decide what he cannot see. A card whose `evidence` is thin is a card that comes
back as free text asking to be shown the situation.

**Run the evidence yourself.** Each finding carries a repeatable `**Beleg:**`
command. Run it — absolute path into the worktree under test, per
`docs/agents/fan-out.md` — and draw the card from *that* output. This costs two
or three commands, not eight, because it happens after the gates. A number
copied from the findings file arrives with the derivation that produced it, and
that is the failure class `/counter-check` exists for.

Where nothing is runnable — a reading question, a documentation decision — the
card says so. A **nil return is evidence**; a borrowed number dressed as a
fresh one is not.

**The sharpest evidence is usually a mutation**, and a mutation writes: turn the
implementation wrong on purpose and show the suite staying green. The worktree
under review is read-only, so copy the files aside and mutate the copy —
`git checkout -- <file>` is on this machine's deny list and `git stash` leaves
an entry behind when the pass is interrupted (`/counter-check`, same move). Say
in `git status` terms that the tree you touched is clean before you report.

Then ask the form question from `.claude/tools/README.md`: which statement does
this evidence carry, and which shape makes that statement visible. A number
block in a `<pre>` is the **fallback**, and it stays under the picture so the
figures remain checkable.

Done when every card has at least one piece of evidence produced in this
session, and every numeric one has been through the form question.

## Stage 3 — the options, then a skeptic

The options are the actual thinking. For `CombinedHandout` there were two
sensible ways and **neither was written anywhere** — they had to be formulated.

- Every option comes out of material you read in Gate 1, not out of the shape
  of the finding.
- `consequence` says **what follows** if this way is taken — who has to know
  something afterwards, what gets harder. It never restates the label.
- `allowFreeText` stays on. It is the catch for the third way, and it has
  already caught one.

Then **one agent with fresh context over all the cards together**, with exactly
two jobs:

1. Which way is missing — the one neither option covers?
2. Which offered option is not one — because it does the same thing as its
   neighbour, or because nobody would ever choose it?

Fresh context is the whole point: you have read the finding and your options
already agree with your reading of it. Give the skeptic the cards, not your
reasoning. It reads and writes nothing, so it needs no worktree of its own —
the rule in `docs/agents/fan-out.md` binds writers, and an agent that writes
anything in this skill's run does get one, parent included.

Expect it to kill a card, not just widen one. In the trial run it struck out a
whole card whose decision had already been made in code, and took apart both
options of the card that survived. A skeptic that only adds a third option has
probably been given the reasoning along with the cards.

Done when every skeptic answer has been taken up or written off in a sentence,
in the handover report — the question file has no field for it.

## Stage 4 — write it, serve it, stop

Write `review/<batch>-fragen.json` — one file per pass, German content, stable
`id`s, `origin` pointing back at the PR and the finding (`"neu"` where Gate 1
produced it). `<batch>` is the **findings file's own stem**, so the two lie
beside each other in `review/`: `…-befunde.md` → `…-fragen.json` →
`…-antworten.json`. The `batch` field inside the file stays the readable name
("#54 · #57 · #48"). `severity` on a card is your own judgement after the
gates, not the line copied from the findings file.

Then:

```sh
node .claude/tools/fragebogen.mjs review/<batch>-fragen.json
```

Hand over the URL it prints, and the handover report below. Then stop. The
server writes `review/<batch>-antworten.json` and shuts itself down when the
maintainer sends.

Done when the question file exists, the server is running under a URL the
maintainer has been given, and every finding has its line in the report. Where
the run is a rehearsal and no server is wanted, the report alone ends it —
the question file is not the deliverable, the report is what gets read.

## The handover report

Short, German, and it carries **one line per finding** — including the ones that
became nothing. Six of eight findings leaving without a trace is the skill's
own blind spot: a wrongly dropped decision looks exactly like a rightly dropped
note.

Four roles, no fifth:

| Role              | The line says                                                     |
| ----------------- | ----------------------------------------------------------------- |
| **Karte**         | which card it became                                              |
| **Nachgeschlagen** | the location that settles it — ticket comment, ADR, spec section |
| **Agentenarbeit** | a repair with one way; no decision in it                          |
| **Notiz**         | nothing to do, and why not                                        |

A finding that appeared only in Stage 1 gets its own line, as **Karte** with
origin `neu`. Half a sentence of reason per line is enough — the point is that
the maintainer can pull one back with a single word.
