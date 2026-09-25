# `.claude/tools/`

Small tools for the maintainer's own work on this repo — not part of the app,
not shipped from `public/`. Node built-ins only, no packages, no build step
(ADR 0004).

## `fragebogen.mjs`

After a review pass, some findings are decisions only the maintainer can make.
As prose in a terminal they get skimmed. This serves them as one card per
decision: the stake in a few lines, the evidence folded away, the options as
radio buttons.

```
node .claude/tools/fragebogen.mjs review/<name>-fragen.json
```

It binds the first free port from 7777 upwards, prints the URL and opens it
with `open` (set `FRAGEBOGEN_NO_OPEN=1` to suppress that). One decision per
screen with back/forward — answers survive going back. Sending writes
`review/<name>-antworten.json` next to the question file and shuts the server
down. A missing or broken question file gives a plain console message, not a
stack trace.

Question and answer files live under `review/`, which is gitignored: they are
session artifacts about branches under review, like the findings files.

## Why the screen is German

`AGENTS.md` says the app's UI is English throughout. **That rule does not reach
this tool.** It is not the app — it is a planning and review artifact for the
maintainer, the same category as Wayfinder maps, specs and review notes, and
`AGENTS.md` puts those in German. So:

- **English:** code, identifiers, code comments, JSON keys, commit messages.
- **German:** everything rendered on screen, and the content of the question file.

Please don't "correct" this in a later session.

## Question file format

```jsonc
{
  "batch": "#54 · #57 · #48",   // what this stack of decisions came out of
  "date": "2026-09-25",
  "decisions": [
    {
      "id": "combined-handout",              // stable, referenced by the answer file
      "title": "…",                          // `backticks` render as inline code
      "origin": { "pr": 77, "finding": "B1" },
      "severity": "blockierend",
      "stake": "…",                          // a few lines: what rides on this
      "note": "…",                           // optional aside on the card
      "evidence": [                          // folded shut by default
        { "heading": "…", "text": "preformatted, shown as-is" }
      ],
      "options": [
        { "id": "participation-auf-null", "label": "…", "consequence": "…" }
      ],
      "allowFreeText": true                  // adds an "anders" option with a text field
    }
  ]
}
```

Backticks are the only markup: `title`, `stake`, `note`, `label` and
`consequence` render `` `foo` `` as code, everything else is escaped.
`evidence[].text` is never interpreted — it is printed verbatim in a `<pre>`.

## Answer file format

```jsonc
{
  "batch": "#54 · #57 · #48",
  "date": "2026-09-25",
  "answeredAt": "2026-09-25T18:25:16.200Z",
  "answers": [
    {
      "decisionId": "combined-handout",
      "optionId": "participation-auf-null",  // null when the answer is free text or unanswered
      "freeText": "",                        // set only when "anders" was chosen
      "note": ""
    }
  ]
}
```
