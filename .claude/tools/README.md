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

The question file is written by hand or by `/ask-hard-questions`, which selects
the decisions out of a review pass and formulates the options. The selection is
the hard part; this tool only serves the result.

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
        { "heading": "…", "text": "preformatted, shown as-is" },
        { "type": "chart", "heading": "…", "chart": { … }, "caption": "…", "text": "…" }
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

## Ist ein Beleg numerisch, ist die erste Frage die Form

Nicht „wie formatiere ich diese Zahlen", sondern **„welche Form zeigt sie"**. Eine
Situation soll man *sehen*, nicht aus einer Tabelle rekonstruieren — und genau
dafür gibt es diesen Werkzeugteil. Wer eine Zahlenreihe in einen `<pre>`-Block
schreibt, hat die Frage übersprungen, nicht beantwortet.

Der Zahlenblock ist der **Rückfall**, nicht der Normalfall: er bleibt als
aufklappbarer Beleg unter dem Bild stehen, damit die Zahlen prüfbar sind. Er
ersetzt das Bild nie, und das Bild ersetzt ihn nie.

Die Reihenfolge, wenn ein Beleg aus Zahlen besteht:

1. **Welche Aussage trägt der Beleg?** Ein Satz. „Die Summe geht um acht über
   den Pool hinaus, und acht ist genau der Teilnahmeanteil."
2. **Welche Form macht diese Aussage sichtbar?** Teil-zu-Ganzem gegen eine
   Grenze → gestapelte Balken mit Referenzlinie. Sieben Kandidaten gegen eine
   Messung → kleine Vielfache mit der Zielreihe als Silhouette.
3. **Erst dann Farbe.** Die Rollen stehen fest (siehe unten); es wird keine neue
   erfunden.
4. **Ansehen.** Screenshot in hell *und* dunkel, und lesen wie jemand, der die
   Sache nicht kennt.

Ist für die Aussage keine Form besser als die Zahlen selbst — zwei Werte, ein
Stacktrace, eine Konsolenzeile — dann bleibt es beim `<pre>`-Block. Das ist ein
Ergebnis der Frage, kein Ausweichen vor ihr.

## Belege vom Typ `chart`

Ein Beleg mit `"type": "chart"` trägt eine **deklarative Spezifikation**; der
Server rendert daraus beim Start Inline-SVG. Keine Pakete, kein CDN, kein
Build-Schritt (ADR 0004) — das SVG wird von Hand erzeugt.

Gemeinsame Felder:

| Feld | |
|---|---|
| `heading` | Überschrift über dem Bild |
| `chart` | die Spezifikation, `kind` wählt den Typ |
| `caption` | Fliesstext unter dem Bild, `` `backticks` `` erlaubt — sichtbar |
| `text` | der Zahlenblock, zugeklappt unter dem Bild |
| `numbersLabel` | Beschriftung der Klappe (Vorgabe: „Die Zahlen") |

Wie es auf dem Schirm liegt: **das Bild ist aufgeklappt**, der Zahlenblock
darunter bleibt zu. Die Karte soll ohne Klicken verstanden werden.

Jedes Diagramm bekommt `title` (wird zum `<title>` und zum `aria-label`) und
`description` (der `<desc>`): die Beschreibung erzählt die Aussage in Worten,
damit das Bild für Screenreader nicht leer ist. Beides ist Pflicht im Geist,
auch wenn der Renderer nur `title` erzwingt.

### `kind: "stacked-bars"` — Teile gegen eine Grenze

Waagrechte gestapelte Balken gegen eine Referenzlinie. Was ein Balken über die
Linie hinausschiebt, wird automatisch als **schraffierter Überhang** in der
Warnfarbe neu gezeichnet: „zu lang" ist dann als solches sichtbar, nicht bloss
nachrechenbar.

```jsonc
{
  "kind": "stacked-bars",
  "title": "…", "description": "…",
  "max": 42,                                  // Achsenende; sonst aus den Summen
  "rowsLabel": "combinedHandout",             // Überschrift über der Balkenspalte
  "reference": { "value": 32, "label": "PrizePool 32" },
  "series": [ { "key": "participation", "label": "`participation`" }, … ],
  "bars": [
    { "label": "aus",
      "segments": [ { "key": "participation", "value": 8 }, … ],
      "total": "32 ✓" }                       // Text am Balkenende
  ],
  "brackets": [                               // Massklammern unter einem Balken
    { "bar": 1, "from": 0, "to": 8, "label": "participation 8" },
    { "bar": 1, "from": 32, "to": 40, "label": "Überhang +8", "tone": "critical" }
  ],
  "overhangLegend": "Überhang über den Pool"  // Legendeneintrag der Schraffur
}
```

Zwei Klammern gleicher Breite an verschiedenen Stellen sind das Mittel, um
„dieses Stück ist genau jenes Stück" zu zeigen. Klammern hängen unter *ihrem*
Balken (`bar`, Index); unter dem letzten ist Platz dafür reserviert.

`series` weist die Farbslots der Reihe nach zu (1, 2, 3 — die Ordnung ist die
CVD-Sicherung, nicht Kosmetik). Segmentwerte werden im Segment beschriftet,
sofern sie hineinpassen; sonst trägt die Legende sie. Die Schrift im Segment
wählt hell oder dunkel nach dem Kontrast zur Füllung.

### `kind: "small-multiples"` — Kandidaten gegen eine Messung

Ein kleines Säulendiagramm je Kandidat, alle auf **einer** gemeinsamen Skala,
und in jedem dieselbe Zielreihe als Silhouette: eine Stufenfläche von Rand zu
Rand, mit ihrer Kante zuoberst gezeichnet. Wo eine Reihe das Ziel trifft, liegt
die Kante flach auf jeder Säule und die Silhouette hat keine Lippe — das ist die
Beobachtung, die der Leser ohne Text machen soll.

```jsonc
{
  "kind": "small-multiples",
  "title": "…", "description": "…",
  "xLabel": "Rang",
  "max": 26,                                  // sonst das Maximum über alles
  "target": { "label": "Messung in #46 (Ziel)", "values": [8, 6, 5, …] },
  "matchLabel": "trifft die Messung",         // Legende für tone "match"
  "currentLabel": "steht heute im Blatt",     // Legende für tone "current"
  "contextLabel": "übrige Stufen",            // Legende für alles ohne tone
  "panels": [
    { "label": "gentle", "tone": "match",   "tag": "trifft exakt",    "values": [ … ] },
    { "label": "mild",   "tone": "current", "tag": "Blattwert heute", "values": [ … ] },
    { "label": "moderate", "values": [ … ] }
  ]
}
```

`tone` ist **Hervorhebung**, nicht Identität: `match` bekommt Slot 1, `current`
Slot 2, alles übrige das Kontextgrau. Wer mehr als zwei Töne braucht, hat
vermutlich die falsche Form gewählt. Beschriftet wird je Feld nur **ein** Wert —
der erste Rang, wo die Reihen am weitesten auseinanderlaufen.

**Wie viele Stellen zeigen?** So viele, wie unterscheiden. Für die Kurvenstufen
sind es 15 von 32 Rängen: ab Rang 16 stehen alle sieben Stufen *und* die Messung
auf 2, der Rest trüge nichts bei und kostete die Hälfte der Breite. Was
weggelassen wurde, sagt die `caption` — weglassen ohne Hinweis wäre Unterschlagung.

### Farben

Die Rollen kommen aus der `dataviz`-Palette und stehen als CSS-Variablen
(`--viz-s1` …) im Blatt, hell und dunkel je eigens gewählt statt umgerechnet:
drei Serienslots, eine Warnfarbe für den Überhang, ein Kontextgrau, ein
Silhouettengrau mit eigener Kante. Sie sind gegen die Kartenfläche (`--card`,
`#ffffff` / `#201e1b`) geprüft. **Neue Rollen nicht dazuerfinden** — braucht ein
Diagramm eine vierte Serie, ist das ein Hinweis auf die Form, nicht auf die
Palette.

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

## Worked examples

`examples/` holds the two question files of 2026-09-25, written by hand and
answered for real. They are kept because `review/` is gitignored and these are
the only record of what a good card looks like:

- `zwei-entscheide-mit-diagrammen.json` — a blocking defect and a reading
  question. Carries the `stacked-bars` chart: three parts against a reference
  line, the overhang hatched, two equal-width brackets showing that the error
  is exactly the participation share.
- `blattwerte-mit-kleinen-vielfachen.json` — a sheet measured against a
  recorded decision. Carries two `small-multiples` charts: the candidate beside
  the current value, the measurement behind both as a silhouette.

Read them before writing a new question file. The format is documented above;
what these show is the part the format cannot — how much stake belongs on a
card, when a chart earns its place, and that an option's `consequence` says
what follows rather than repeating the label.
