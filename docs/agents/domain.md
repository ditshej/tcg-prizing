# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## When a later ADR touches an earlier one

Three things can happen to a decision that is already written down. They are
told apart by one question: **does a _different_ ADR carry part of the answer
now?**

| What happened                                                                                      | Different ADR? | Where the text goes                                        | Stamp on the earlier ADR                                              |
| -------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| You sharpen your own text while writing it — a `Nachtrag`, a tightened bound, a case you thought of afterwards | no             | the body of that same ADR (ADR-0001 does this twice)         | none                                                                    |
| A later ADR **extends** it — adds a level, a condition, a case — and overturns nothing             | yes            | the new ADR                                                  | `Ergänzt durch ADR-NNNN.`                                               |
| A later ADR **overturns** it, in part or in whole                                                  | yes            | the new ADR                                                  | `Teilweise überholt durch ADR-NNNN.` / `Vollständig überholt durch ADR-NNNN.` |

Either stamp is a single line directly under the title of the earlier ADR:

```md
# Defaults in zwei Ebenen, mit vollständigem `Game`

Ergänzt durch ADR-0005.
```

```md
# DistributionCurve statt benannter Verteilungstypen

Teilweise überholt durch ADR-0007.
```

**One line per later ADR**, never several numbers on one line. An earlier ADR
can be touched more than once, and the two can be touched in different ways —
ADR-0005 is partly overturned by ADR-0006 and extended by ADR-0007. Stacking the
lines keeps each word attached to the number it describes; a joint line would
force one verb onto both and lose exactly the information the words carry.
Numeric order, because that is the order the reader will follow them in:

```md
# SetupLink: die URL trägt Abweichungen, keinen Schnappschuss

Teilweise überholt durch ADR-0006.
Ergänzt durch ADR-0007.
```

Which of the three cases it is gets **written out**, because that word is itself
the information the next reader needs: whether the rest of the document still
holds in full (_ergänzt_), holds in part (_teilweise überholt_), or can be put
down after the first line (_vollständig überholt_).

In both stamped cases, doing **both** halves is mandatory: **stack the new ADR**
as a fresh, sequentially numbered file — never edit the earlier one into the new
position — and **stamp the earlier one**.

### Extension is the case that gets skipped

An overturn is easy to remember, because something at the earlier ADR becomes
_wrong_. An extension leaves nothing wrong — it only leaves the ADR
**incomplete**. That is exactly why the stamp gets skipped, and exactly why it
costs: the next reader arrives at a decision that has since gained a condition,
sees a document that is correct on every line, and acts on it. Nothing on the
page tells them the condition exists.

The vendored `/domain-modeling` skill offers only a whole-file
`Status: superseded` in frontmatter and never asks for the back-reference. That
is not enough here on three counts: the ADRs in this repo carry no frontmatter
at all; a partial overturn has no `Status` value; and an extension has no status
to change, since the earlier decision is still fully in force. Without the stamp
you get exactly the contradiction that `/map-closure` later has to pay an
expensive fan-out to find — a reader arriving at the earlier ADR has no way to
know a newer one exists.
