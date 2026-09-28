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

  Auf den `WinnerPack`s stand bis zum Nachzug nach Lauf 7 **mit Absicht keine**
  Summenregel. Die Begründung — die Regel bindet die `Pool`-Ebene, und ein
  `WinnerPack` ohne Empfänger (`open`) verletzt nichts (#46) — hielt nur
  halb: `open` ist deshalb ein **Glied** der Regel und kein Loch in ihr. Seit
  dem Nachzug stehen dort drei Zeilen, siehe unten „Nachgezogen nach Lauf 7".

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
  Seit #56 steht als letzte Zeile **kein** Invariant, sondern das Urteil des
  Kerns selbst: `unfit`. Der Grund steht unten unter „Nachgezogen nach #56".

- **Die DefaultSets (#49)** als Knöpfe, über `resolveSettings()` aus dem Kern
  über die Blätter in `public/sets/` aufgelöst — dieselbe Kette, mit der die
  App startet. Und **die Wege heraus (#59)** neben der Invariantenzeile,
  sobald der Kern den Plan `unfit` nennt, jeder als Knopf zum Nehmen. Beides
  kam mit dem Nachzug nach Lauf 7, siehe unten.
- **Die vier gemessenen Stände aus #53** als Knöpfe, jeder mit seiner erwarteten
  Zahl daneben, und dazu die beiden Konfliktstände, die #56 gehören, sowie der
  `WinnerPack`-Überhang aus #70 — die drei zählen **nicht** zu den vieren. Jede erwartete Zahl ist dort nachgeschlagen,
  wo sie entschieden wurde — der Ticketkommentar oder der Test, der den Stand
  festhält —, nie aus dem zurückgerechnet, was der Kern heute liest.

## Die Invariantenzeile glättet nichts

Bis #56 gab es einen echten Stand, in dem die Summenregel verletzt war: bei
`boosterRate` 0 war der `RankPool` leer, und trotzdem gingen `3·2·2` hinaus.
Die Bank **zeigte und benannte** ihn; sie unterdrückte nichts und rundete
nichts weg. Dafür ist sie da.

**Nachgeprüft nach #54/#57/#48 (Stand `main`, 2026-09-25): der Stand verletzte
weiter, und damals auf zwei Zeilen.** `Σ row.booster = RankPool` meldete
`7 vs 0`, und die Planzeile `participation + judge + Σ Zeilen = PrizePool ·
Booster` dasselbe `7 vs 0` — dieselben sieben ungedeckten `Booster`, einmal
gegen den `RankPool` und einmal gegen den `PrizePool` gemessen. Die
`TournamentPack`-Zeile hielt dabei (`8 vs 8`): die Unterdeckung lag allein auf
der `Booster`-Achse, weil `RankFloor` und Vorsprung nur dort giessen.

**Seit #56 ist dieser Bruch behoben** — der Kern giesst den `RankPool` von
oben, ein leerer Pool giesst nichts, und der Stand steht auf `0·0·0`. Was er
nicht mehr tut: eine Invariante brechen. Genau daran hängt die Änderung unten.

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

## Nachgezogen nach #56 und #63 (Stand `main`, 2026-09-27)

Die Bank gehört keinem Ticket und wird nach einer Runde nachgezogen. #63 ist
reine Oberfläche und berührt sie nicht; #56 berührt sie an vier Stellen. Die
ersten beiden kamen aus der Gegenprobe (G4, G5), die letzten beiden fielen beim
Nachziehen an.

1. **Der `conflict`-Stand erwartet `0·0·0` statt `3·2·2`**, und seine
   Beschriftung nennt den Zweig repariert. Die Zahl ist nicht nachgerechnet:
   der erste Kommentar an #56 hält fest, dass ein leerer `PrizePool` von Haus
   aus ein Konfliktstand ist, und `CONTEXT.md` verlangt für ihn die leere
   Kachel samt `ConflictNotice`.
2. **Ein sechster Knopf für die verwaiste Reservation**, den zweiten
   Konfliktfall aus #56. Stand und Zahlen sind die aus
   `test/distribute.test.mjs:691`: 5 `Player`, Tiefe 2, `Displays` auf Rang 3 →
   `3·2` und `orphanedReservation {ranks:[3]}`.
3. **Die tote Klemme im Balken ist weg.** `Math.min(row.reserved, row.booster)`
   stammte aus der Zeit, als `reserved` die Zusage war; seit #56 ist es das
   wirklich Ausgeteilte und kann `row.booster` nicht überschreiten — gemessen
   über 45 360 Stände, kein einziger Griff. Eine Klemme, die nie greift, liest
   sich später als Beweis, `reserved` sei nominal.
4. **Die Invariantenzeile wusste an zwei Stellen weniger als der Kern.**

   `conflict.have` darf negativ sein — es ist die gemeldete Bedingung, keine
   Auszahlung (`{need: 0, have: −16}`, `test/distribute.test.mjs:686`). „Keine
   negative Zahl im Plan" schlug darauf **rot** an. Sie zählt jetzt als
   gemeldeter Zustand, benannt mit Pfad und Wert; jede negative Zahl irgendwo
   sonst bleibt rot. Gemessen über dieselben 45 360 Stände ist
   `plan.conflict.have` das einzige negative Blatt des Plans.

   Und umgekehrt: weil #56 den Bruch behoben hat, halten am
   Konfliktstand **alle** Invarianten — die Bank meldete „all invariants hold"
   über einen Plan, den der Kern `unfit` nennt. Als letzte Zeile steht deshalb
   kein Invariant, sondern das Urteil des Kerns selbst, zurückgelesen statt
   nachgebaut, mit den Fakten, die es tragen. Dieselbe Bauart wie bei `overtake`
   nach #55: wo der Kern mehr weiss als die Zeile, holt die Zeile es sich, statt
   eine zweite Definition zu erfinden.

Dazu stehen `conflict`, `orphanedReservation` und `unfit` jetzt in der Tabelle
der abgeleiteten Grössen, wie `unclaimedRemainder` und `overtake` nach #55.

An allen sechs Knöpfen gefahren, über `python3 -m http.server` aus der
Repo-Wurzel:

```
✓ series 29·14·7·4·3·3·2·2
✓ depthCap 31
✓ series 9·3·2
✓ curveSilent true
✓ series 0·0·0                        (conflict, repariert)
✓ orphanedReservation 3·2 · orphaned Rank 3
```

Kein `✗`, und keine rote Invariante. Die beiden #56-Stände melden gelb
`● the core's own verdict: unfit — true — conflict (need 7, have 0)` bzw.
`… orphanedReservation (Rank 3)`. Von Hand nachgefahren: der Stand mit
`conflict` und `unclaimedRemainder` zugleich (`{need: 0, have: −16}`) meldet
gelb auf der Zahlenzeile *und* im Urteil, und der `overtake`-Stand aus #55
meldet unverändert gelb auf der Monotonie.

## Nachgezogen nach Lauf 7 — #49 · #59 · #58 (Stand `main` `8a949e7`, 2026-09-27)

Die Bank gehört keinem Ticket und wird nach den Merges einer Runde in einem Zug
nachgezogen. Drei Posten, der dritte aus der Gegenprobe.

### 1. `resolveSettings()` aus #49 — die Bank löst die DefaultSets jetzt selbst auf

`neutralSettings()` war ein handgeschriebenes Literal, das nebenbei
**mitschrieb, welche vier Felder `null` starten und welche zwei leer** — eine
zweite Kopie eines Entscheids, der in `public/core/defaults.mjs` steht, und
genau die Art Kopie, die die erste stehende Regel der Bank verbietet. Die Bank
hält jetzt nur noch ihr eigenes neutrales Blatt (`BENCH_SHEET`, die
vorbelegbaren Felder) und lässt `resolveSettings()` den Rest legen. Das
aufgelöste Objekt ist Feld für Feld dasselbe wie das Literal — nachgerechnet,
gleiche Schlüssel, gleiche Werte —, also bewegt sich keiner der gemessenen
Stände aus #53.

Dazu kommt ein zweiter Abschnitt **DefaultSets (#49)**: die echten Blätter aus
`public/sets/` über dieselbe Kette, die `public/ui/plan.mjs` beim Start
benutzt — Game, Weekly, Weekend, Release. Damit lässt sich zum ersten Mal ein
Stand von Hand fahren, den ein `CommunityLead` wirklich aufmacht, statt nur
einer, den die Bank sich selbst gebaut hat. Ein Knopf ersetzt die ganzen
`Settings`, nie die Hälfte.

**Was hier nicht nachzuziehen war:** der Registerumzug nach `public/link/keys.mjs`
und der Wegfall von `public/link/encode.mjs` (#49/#50) lassen die Bank kalt —
sie hat **nie** auf `link/` importiert und tut es weiter nicht. Sie erfindet
kein URL-Format, und ein Stand geht als `Settings`-JSON durch das Textfeld.
Der Posten war als der dringendste angesetzt; er war gar keiner.

### 2. `suggestions()` aus #59 — die Wege heraus stehen neben der Invariantenzeile

Wenn die Zeile aufhört grün zu sein, ist das, was der Kern anböte, genau das
Nächste, was man sehen will. Der Abschnitt **Ways out (#59)** rechnet sie live,
sobald der Kern den Plan `unfit` nennt, und **jeder Eintrag ist ein Knopf**:
ein Weg heraus ist ein Reglerwert (#59), also ist ihn nehmen eine Zuweisung.
Von Hand gefahren am `overtake`-Stand aus #55 (`depth` 2, `d`=(1),
`displaySize` 24): fünf Wege — `Serve 4 ranks`, `Rank 1 up to 2 displays`,
`Drop rank 1's display`, `Rank 2 up to 1 display`, `Participation boosters up
to 2`; die beiden `Rank 1`-Einträge sind der Gleichstand, den #59 gegen den
Prototypen korrigiert hat. Am `orphaned`-Knopf steht ein einziger Weg
(`Drop rank 3's displays`), und ein Klick darauf stellt den Plan wirklich
gerade — die Zeile geht zurück auf grün.

Der `conflict`-Knopf (#56, `boosterRate` 0) liefert **keinen** Weg. Das ist
kein Fehler, sondern der Fall aus Entscheid K1 (#68/#70): kein einzelner Regler
räumt ihn. Die Fläche sagt das und verweist auf K1, statt leer zu bleiben; den
mehrgliedrigen Weg baut #68, nicht die Bank.

**Die Signatur war `suggestions(settings)`**, und die Bank nahm #86 nicht
vorweg. Der Aufruf stand an **einer** Stelle — `waysOut(settings, plan)` —, die
beide Argumente schon in der Hand hielt; #86 hat die Signatur auf
`suggestions(plan)` gedreht (ADR 0009, Entscheid K2 an #68), und es war diese
eine Zeile und sonst nichts. Siehe unten „Nachgezogen nach Lauf 8".

### 3. Die `WinnerPack`-Invariante — Befund G5 der Gegenprobe

Die Zeile deckte die `WinnerPack`-Achse nicht ab und sagte deshalb „all
invariants hold" zu einem Stand, den #58s Suite benennt. Drei Zeilen decken sie
jetzt:

- `Σ row.winners + open = RankPool · WinnerPacks`
- `judge + Σ row.winners + open = PrizePool · WinnerPacks`
- `no WinnerPack over-assignment: ranked + manual ≤ RankPool · WinnerPacks`

Die Formel ist die aus #70, wörtlich: `allocation.ranked +
allocation.manualCount − rank.winners`, positiv heisst überzugeteilt. Nicht
umformuliert zu „Zeilen > `rank.winners`" — die Gegenprobe (Befund B2, abgelegt
an #70) fand die beiden Stand für Stand deckungsgleich, 318 von 318, und hier
noch einmal über 1 800 Stände der `WinnerPack`-Achse ohne eine Abweichung.

Dieselbe Messung trägt die Fassung der beiden Summenregeln: **0** Abweichungen
ohne Überhang, **1 183 von 1 183** mit einem, und nie um einen anderen Betrag
als den Überhang. Darum sind sie gelb und nicht rot, wenn der Überhang steht —
#46 reicht den Deckel ausdrücklich an Spec 2 am Bedienelement weiter und nennt
das die dokumentierte Antwort des Kerns, keine Ausnahme von der Regel.

**Die dritte Zeile ist rot, und das ist ein Urteil der Bank.** Gelb heisst auf
dieser Bank bisher: der Kern meldet den Zustand selbst, die Zeile holt ihn sich
nur (`overtake`, `unclaimedRemainder`, `conflict.have`). Hier gibt es nichts zu
holen — #70 nennt den Überhang „den einzigen Zustand dieser Spec, den der
Rechenkern nicht selbst meldet", und `unfit` bleibt `false`. Ein Stand, der
`WinnerPack`s verspricht, die es nicht gibt, darf nicht sauber aussehen. Wer
#70 baut, darf das umdrehen; dann ist es ein Entscheid und steht an #70.

Dazu ein **siebter Knopf** für den Überhang und eine Zeile
`WinnerPackAllocation · overhang (#70)` in den abgeleiteten Grössen. `ranked`
klemmt der Kern selbst (`allocateWinners`), der Überhang kommt also nur über
den `manual`-Anteil — was genau dem entspricht, was #70 beschreibt: er
entsteht nicht beim Setzen, sondern wenn ein zweiter Wert nachträglich sinkt.
Die erwartete Zahl des Knopfs ist #70s Formel auf diese `Settings` angewandt
(2 + 2 − 2 = 2), nicht aus einem Plan zurückgelesen.

### Gefahren und gesehen

Über `python3 -m http.server` aus der Repo-Wurzel, Playwright gegen
`http://localhost:.../dev/`. Alle sieben Knöpfe grün:

```
✓ series 29·14·7·4·3·3·2·2
✓ depthCap 31
✓ series 9·3·2
✓ curveSilent true
✓ series 0·0·0                        (conflict, repariert)
✓ overhang 2                          (neu, #70)
✓ orphanedReservation 3·2 · orphaned Rank 3
```

Die neue Zeile **rot** gesehen am `overhang`-Knopf: jede andere Invariante
grün, `unfit` grün auf `false`, die beiden `WinnerPack`-Summenregeln gelb
(`4 vs 2`) — und der Banner rot mit `1 invariant(s) BROKEN`. Genau der Stand,
den G5 beschreibt. **Gehalten** gesehen am neutralen Start und an allen vier
DefaultSets. Die Bank kennt nur ein Farbschema (kein Dunkelmodus), also gibt es
zu jedem Bild nur eines.

Die Bank liegt weiter ausserhalb von `public/`, importiert den Kern live und
kopiert nichts. `node --test` steht unverändert auf 117/117 — an geprüftem Code
wurde nichts angefasst.

## Nachgezogen nach Lauf 8 — #86 (Stand `main` `aacdc03`, 2026-09-28)

#86 dreht beide Kernfunktionen, die die Bank benutzt, und sie war ab dem Merge
gebrochen: `suggestions()` nimmt jetzt den **Plan** statt der `Settings`, und
`distribute()` nimmt ein zweites Argument. Zwei Posten.

### 1. `suggestions(plan)` — die eine Zeile, die angekündigt war

`waysOut()` ist jetzt `waysOut(plan)` und reicht den Plan durch. Der Plan trägt
seinen Stand selbst (`plan.settings`, ADR 0009), also kommen Reglerwerte und
verletzte Fakten zusammen an und können nicht auseinanderlaufen. Dass der Aufruf
eine eigene Funktion blieb, hat genau das gekostet, was es sollte: eine Zeile.

### 2. `distribute(settings, pinned)` — die Bank füttert das zweite Argument

Sie könnte es weglassen; `pinned` ist vorbelegt und ändert keine Zahl im Plan.
Dann stünde `plan.pinned` aber auf jedem Stand leer, und ein Feld, das nichts
füttert, ist ein Feld, das die Bank nicht falsch werden sehen kann — und
`plan.pinned` ist das, woraus der `SetupLink` geschrieben wird (#50).

Die Bank hat hinter ihrem laufenden Stand keine DefaultSet-Kette, kann einen Pin
also nicht durch Vergleich herleiten. Sie hält stattdessen die **Geste** fest:
einen Regler anfassen pinnt ihn, einen Weg heraus nehmen pinnt den Regler, den
er bewegt, und ein nachziehender Schalter, der ausgeht, pinnt ab — bei einem
nullbaren Regler *ist* `null` „nicht von Hand gesetzt" (ADR 0006), die beiden
sagen dasselbe. Einen Stand laden — Blatt, Knopf, JSON-Feld — setzt die Pins auf
genau die Schlüssel dieses Standes: ein DefaultSet ist ein Startstand und pinnt
nichts, ein gemessener Stand ist ein handgemachter und pinnt, was er nennt.

In der Tabelle der abgeleiteten Grössen steht `plan.pinned` als letzte Zeile,
**nur die Schlüssel** — der Wert steht eine Zeile weiter oben schon da, und die
ganze Information eines Pins ist, dass der Schlüssel überhaupt dasteht.

### Gefahren und gesehen

Über `python3 -m http.server` aus der Repo-Wurzel, Playwright gegen
`http://localhost:.../dev/`. Alle sieben Knöpfe grün, kein Fehler auf der
Konsole (ausser dem fehlenden Favicon), am Start `pinned (#86) = none`.

- Zwei Regler von Hand → `2 · players, rankFloor`, und der Rohabzug zeigt
  `"pinned": {"rankFloor": 4, "players": 20}` — die Werte, nicht nur die Namen.
- `DefaultSet · Weekend` darauf → `none`.
- Der erste gemessene Stand aus #53 darauf → seine sechs eigenen Schlüssel.
- Der `depth`-Schalter aus → fünf, wieder an → sechs.
- Am `orphaned`-Knopf steht weiter genau ein Weg heraus
  (`Drop rank 3's displays`), ein Klick darauf stellt den Plan gerade **und**
  pinnt `displays`. Am `conflict`-Knopf steht weiter keiner, mit demselben
  Verweis auf Entscheid K1.

`node --test` ist davon unberührt — die Bank ist von keinem Test erreicht.
