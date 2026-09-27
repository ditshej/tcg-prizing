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
  sie nie auseinanderlaufen. `RankPoolDepth`, `TournamentPacks`, `winnerPacks`
  und `ranked` haben einen Schalter zwischen nachziehend (`null`) und gepinnt,
  weil das im Kern zwei Zweige sind und nicht ein Wert (ADR 0006).

  Seit #57 sind das **alle** Felder der `Settings` — der Umschlag
  (`envelopeSize`, `envelopeYield`, `winnerPacks`), der `JudgePool`-Griff auf
  die `WinnerPack`s, die `WinnerPackAllocation` (`ranked` als Regler,
  `manualWinner` als `Rank:Zahl`-Paare) und `combinedHandout` als Schalter sind
  nachgezogen. Der letzte Stand, der beim Gegenprüfen über das JSON-Textfeld
  eingespielt werden musste, war ein `combinedHandout`-Stand; das geht jetzt
  über den Schalter.
- **Die Rangzeilen** mit dem `Booster` als Balken und `TournamentPacks` und
  `WinnerPack`s als Zahlenspalten daneben, bediente und unbediente
  unterscheidbar, dazu die Zahlenreihe (`29·14·7·…`) zum Abgleich mit den
  Tickets. Nur der `Booster` bekommt einen Balken, weil er die teilbare Achse
  ist, die die `DistributionCurve` formt; die beiden anderen kommen als
  einstellige Stückzahlen aus `RankCycle` und `WinnerPackAllocation` und laufen
  an der Kurve vorbei (#57). Ein Balken von einem Pixel neben einem von neunzig
  sagte nichts — zwei Zahlenspalten sagen es genau, und die Null steht blass da,
  damit sichtbar bleibt, wie weit eine Achse reicht.

  Seit #55 teilt sich der Balken selbst: ein reservierter Anteil
  (`row.reserved`, die `DisplayReservation` zu `displaySize` je `Display`) in
  Lila, der Rest (`RankFloor` plus Kurvenanteil) in Grün — ein abgegoltener
  Rang (`row.settled`, der strikte Vorlauf über der obersten Bindung) ist lila
  von Anfang bis Ende und trägt sein Label fett. Ein Rang, der an der
  gemeldeten `overtake` beteiligt ist, bekommt ein rotes Label und einen roten
  Rahmen um die Zeile — `flagged` sagt genau, welche zwei.
- **Die abgeleiteten Grössen** beschriftet, plus einen Rohabzug des ganzen
  `DistributionPlan` als JSON — damit Felder, die #55 und #56 hinzufügen, von
  selbst auftauchen, ohne dass jemand die Bank anfasst. Genau so sind die Felder
  von #57 hier zuerst erschienen.
- **Die Invariantenzeile**, bei jeder Änderung mitgeprüft: Summenregel, Monotonie,
  Tiefe ≤ Spielerzahl, Zeilenzahl = Spielerzahl, keine negative Zahl.

  Die Summenregel steht auf **zwei** Ebenen. `Σ row.booster = RankPool` prüft die
  Rangzeilen gegen ihren Pool; `participation + judge + Σ Zeilen = PrizePool`
  prüft den ganzen Plan, für `Booster` und für `TournamentPacks`. Die zweite
  fehlte, und ihr Fehlen hat die Doppelzählung bei `combinedHandout`
  durchgelassen: solange die Anteile in die Zeilen **kopiert** statt verschoben
  wurden, hielt die erste Zeile weiter, weil der `RankPool` um denselben Betrag
  mitgewachsen war. Erst die Summe gegen den `PrizePool` fängt das.

  Auf den `WinnerPack`s steht **mit Absicht keine** Summenregel: die Regel bindet
  die `Pool`-Ebene, nicht die Empfänger-Ebene, und ein `WinnerPack` ohne
  Empfänger (`open`) verletzt nichts (#46).

  Seit #55 unterscheidet die Zeile **drei** Zustände statt zweier: gehalten
  (grün), gemeldet (gelb, ein Kreis statt eines Häkchens) und gebrochen (rot).
  Eine `DisplayReservation`, die die ganze Tiefe abgilt, lässt beide
  Summenregeln auf der `Booster`-Achse um genau den `ShapedRemainder`
  zurückfallen — steht dafür `unclaimedRemainder`, ist das der gemeldete
  Zustand, nicht der Bruch; fehlt die Meldung, bleibt es rot. Bauart aus
  `test/distribute.test.mjs`, `assertPlanSum` — dieselbe Unterscheidung, nicht
  neu erfunden. Dieselbe Fassung trägt jetzt auch „die Zeilen fallen
  monoton": eine gemeldete `overtake` (die Bindung bricht, sobald eine
  Reservation Rang 1 aus der Kurve trägt) ist ebenfalls ein gemeldeter, kein
  gebrochener Zustand — `test/distribute.test.mjs:507` prüft das als
  erwarteten Fall, nicht als Fehler.
- **Die vier gemessenen Stände aus #53** als Knöpfe, jeder mit seiner erwarteten
  Zahl daneben, und dazu ein fünfter, der **nicht** zu den vieren gehört.

## Die Invariantenzeile glättet nichts

Es gibt heute einen echten Stand, in dem die Summenregel verletzt ist: bei
`boosterRate` 0 ist der `RankPool` leer, und trotzdem gehen `3·2·2` hinaus.
Das ist der Konfliktzweig, der #56 gehört — der Kern giesst dort von oben, und
bis dahin ist die Verletzung sichtbar statt behoben. Der fünfte Knopf stellt
genau diesen Stand ein. Die Bank **zeigt und benennt** ihn; sie unterdrückt
nichts und rundet nichts weg. Dafür ist sie da.

**Nachgeprüft nach #54/#57/#48 (Stand `main`, 2026-09-25): der Stand verletzt
weiter, und jetzt auf zwei Zeilen.** `Σ row.booster = RankPool` meldet `7 vs 0`,
und die neue Planzeile `participation + judge + Σ Zeilen = PrizePool · Booster`
meldet dasselbe `7 vs 0` — dieselben sieben ungedeckten `Booster`, einmal gegen
den `RankPool` und einmal gegen den `PrizePool` gemessen. Die
`TournamentPack`-Zeile hält dabei (`8 vs 8`): die Unterdeckung liegt allein auf
der `Booster`-Achse, weil `RankFloor` und Vorsprung nur dort giessen. An #56
hat sich damit nichts erledigt.

Die vier gemessenen Stände aus #53 halten unverändert — `29·14·7·4·3·3·2·2`,
`depthCap` 31, `9·3·2`, `curveSilent` — und auf allen vieren halten auch beide
Summenregeln.

Und in **beiden** `combinedHandout`-Zweigen stimmt die Summenregel wieder von
selbst: das Verschieben addiert `pbRate` zu jeder Zeile und lässt den `RankPool`
um `pbRate · Spielerzahl` wachsen, also um genau denselben Betrag. Nachgerechnet
an den vier Ständen und an einem Stand mit Teilnahmeanteil auf beiden Achsen,
je einmal mit und ohne Schalter.

## Nachgeprüft nach #55 (Stand `main`, 2026-09-27): `unclaimedRemainder` und `overtake` von Hand gefahren

Am `Weekend`-Blatt (32 `Player`, `boosterRate` 3, `participationBooster` 1,
`rankFloor` 2, `curve` steep → `RankPool` 64) über den `weekend`-Knopf, dann
Tiefe, `displays` und `displaySize` von Hand gesetzt:

- `depth` 1, `d`=(1), `displaySize` 24 → Serie `24`, `unclaimedRemainder`
  `depth 1`, beide Summenregeln gelb („gemeldet, kein Defekt"), Rang 1 lila
  von Anfang bis Ende und fett beschriftet (abgegolten).
- `depth` 2, `d`=(2,1), `displaySize` 8 → Serie `16·8`, `unclaimedRemainder`
  `depth 2`, dieselbe gelbe Meldung, beide Ränge lila und fett.
- `depth` 3, `d`=(3,2,1), `displaySize` 4 → Serie `12·8·4`,
  `unclaimedRemainder` `depth 3`, dieselbe gelbe Meldung, alle drei Ränge lila
  und fett.

Alle drei teilen 24 von 64 `Booster` aus, wie im Entscheid an #56 vorgerechnet.

Der Gegenfall — `depth` 2, `d`=(1), `displaySize` 24 — geht auf `24·40` und
`unclaimedRemainder` bleibt `null`, wie erwartet. Er deckte dabei aber einen
zweiten, ungeplanten Fall auf: Rang 2 überholt Rang 1 (`overtake`:
`{under:1, over:2, has:24, gets:40}`), und die Invariante „die Zeilen fallen
monoton" schlug das zunächst als **rot** an, obwohl der Kern die Überholung
selbst meldet statt sie zu verhindern (ADR 0001, ADR 0002;
`test/distribute.test.mjs:507`). Die Zeile kannte `overtake` noch nicht — sie
ist jetzt um dieselbe Unterscheidung ergänzt wie die Summenregeln: eine
gemeldete `overtake` zählt als gemeldeter Zustand (gelb), keine Meldung bei
einem Anstieg bleibt rot. Beide Ränge stehen dabei rot umrandet und rot
beschriftet (`flagged`).

Der bestehende `conflict`-Knopf (#56, `boosterRate` 0) bleibt unverändert rot —
er ist der echte, noch offene Bruch, und keine der beiden neuen Unterscheidungen
verwischt ihn.

Geprüft über `python3 -m http.server` aus der Repo-Wurzel und Playwright
gegen `http://localhost:.../dev/`.
