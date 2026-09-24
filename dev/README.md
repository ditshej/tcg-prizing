# Werkbank für den Rechenkern

Eine Vorrichtung, die den Kern festhält, während man an ihm zieht: Regler
bewegen, die Verteilung als Balken sehen, die abgeleiteten Grössen ablesen,
Stände ausprobieren. Sie ist für das Review von Spec 1 (#46) gebaut und bleibt
danach als Werkzeug stehen, während #54–#60 den Kern erweitern.

## An die Sitzung, die Spec 2 baut

**Diese Dateien sind kein Startpunkt.** `docs/agents/prototyping.md` sagt, ein
Mockup sei eine Referenz und keine Vorlage; für die Werkbank gilt das
verschärft, denn sie ist weniger als ein Mockup — sie wurde nie für einen
Benutzer gezeichnet. Hier ist **nichts** entschieden: nicht das Layout, nicht
die Reglerauswahl, nicht die Beschriftungen, nicht die Zustandsform, nicht die
Farben. Wer Spec 2 (#61, Tickets #62–#73) baut, nimmt `CONTEXT.md` und die
Tickets als Quelle und schreibt die Oberfläche neu — in Alpine über reinen
ES-Modulen (ADR 0004), wovon die Bank bewusst nichts benutzt. Kopiere nichts
von hier heraus. Die Bank sieht absichtlich nicht aus wie die App.

Zwei Regeln, die für jede Änderung an der Bank gelten:

- Sie importiert den Kern aus `../public/core/` und **kopiert ihn nie**. Eine
  Kopie würde altern, und damit fiele der ganze Zweck weg.
- Sie erfindet **kein URL-Format** für ihren Zustand. Das ist `SetupLink`, eine
  versionierte öffentliche Schnittstelle (#48, `docs/agents/setup-link.md`, ADR
  0005/0007). Wer einen Stand weitergeben will, kopiert die `Settings` als JSON
  und liest sie im Textfeld wieder ein.

## Starten

ES-Module über `file://` scheitern an CORS, also braucht es einen lokalen
Server. Aus der **Repo-Wurzel**, damit `/dev/` und `/public/` beide erreichbar
sind:

```
python3 -m http.server 8000
```

Dann <http://localhost:8000/dev/> öffnen.

Die Bank liegt ausserhalb von `public/`, und der Docroot zeigt später auf
`public/` (#30) — im Web ist sie also nie erreichbar. Genau so gewollt.

## Was sie zeigt

- **Ein Regler je Wert, den `distribute` heute liest**, und nur diese. Ein
  Regler für einen Wert, den niemand liest, behauptete eine Wirkung, die er
  nicht hat. `curve` und `depthStep` kommen als Listen aus `rules.mjs`, damit
  sie nie auseinanderlaufen. `RankPoolDepth` und `TournamentPacks` haben einen
  Schalter zwischen nachziehend (`null`) und gepinnt, weil das im Kern zwei
  Zweige sind und nicht ein Wert (ADR 0006).
- **Die Rangzeilen als Balken**, bediente und unbediente unterscheidbar, dazu
  die Zahlenreihe (`29·14·7·…`) zum Abgleich mit den Tickets.
- **Die abgeleiteten Grössen** beschriftet, plus einen Rohabzug des ganzen
  `DistributionPlan` als JSON — damit Felder, die #55–#57 hinzufügen, von
  selbst auftauchen, ohne dass jemand die Bank anfasst.
- **Die Invariantenzeile**, bei jeder Änderung mitgeprüft: Summenregel, Monotonie,
  Tiefe ≤ Spielerzahl, Zeilenzahl = Spielerzahl, keine negative Zahl.
- **Die vier gemessenen Stände aus #53** als Knöpfe, jeder mit seiner erwarteten
  Zahl daneben, und dazu ein fünfter, der **nicht** zu den vieren gehört.

## Die Invariantenzeile glättet nichts

Es gibt heute einen echten Stand, in dem die Summenregel verletzt ist: bei
`boosterRate` 0 ist der `RankPool` leer, und trotzdem gehen `3·2·2` hinaus.
Das ist der Konfliktzweig, der #56 gehört — der Kern giesst dort von oben, und
bis dahin ist die Verletzung sichtbar statt behoben. Der fünfte Knopf stellt
genau diesen Stand ein. Die Bank **zeigt und benennt** ihn; sie unterdrückt
nichts und rundet nichts weg. Dafür ist sie da.
