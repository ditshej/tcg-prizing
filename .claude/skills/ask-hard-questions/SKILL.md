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
section of the spec, a term in `CONTEXT.md`. A finding whose answer is written
down somewhere is **not** a question — it is a lookup, and the answer goes into
the handover report with its location.

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

Done when every finding names either the source that settles it, or the search
that came up empty.

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
reasoning. If it runs as a subagent it gets its own worktree, and so does any
other agent in the run — the parent counts as a writer (`docs/agents/fan-out.md`,
run 3).

Done when every skeptic answer has been taken up or written off in a sentence.

## Stage 4 — write it, serve it, stop

Write `review/<batch>-fragen.json` — one file per pass, German content, stable
`id`s, `origin` pointing back at the PR and the finding (`"neu"` where Gate 1
produced it). `severity` on a card is your own judgement after the gates, not
the line copied from the findings file.

Then:

```sh
node .claude/tools/fragebogen.mjs review/<batch>-fragen.json
```

Hand over the URL it prints, and the handover report below. Then stop. The
server writes `review/<batch>-antworten.json` and shuts itself down when the
maintainer sends.

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
