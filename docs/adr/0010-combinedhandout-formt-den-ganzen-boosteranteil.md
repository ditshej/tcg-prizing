# `CombinedHandout` formt den ganzen Booster-Anteil

Bei eingeschaltetem `CombinedHandout` wird alles einmal ausgeteilt, nach dem
Turnier. Damit gibt es **keinen `ParticipationPool`**, er ist auf beiden Achsen
leer. Die Booster laufen **ganz durch die Formgebung**, die `TournamentPack`s
bleiben **flach**. Bis #103 hat `CombinedHandout` die Teilnahmeanteile nur
verschoben: Auf `Pool`-Ebene fiel der `ParticipationPool` auf 0, und **nach** der
Formgebung bekam jede Zeile die Rate flach dazu (`booster[i] + pbRate`). Der
Kernkommentar begründete das ausdrücklich: „how the shares are grouped at handout
is not a shaping decision". Dieser Satz ist mit diesem ADR umgestossen.

Entschieden an #103 (Entscheide 1, 2, 3 und 5 vom 2026-09-30, Punkt C vom
2026-10-05). Der Maintainer, wörtlich:

> wenn man sich entscheidet das Handout nach dem Turnier zu machen dann gibt es
> kein Participation Booster, der der jetzt speziell noch dazu ausgeben wird. Und
> wenn man dann sagt, okay, der Winner kriegt ein Display, dann kriegt er einfach
> ein Display.

## Was gilt

| bei `combinedHandout` an | Booster | TournamentPacks |
|---|---|---|
| `ParticipationPool` | 0 | 0 |
| der `RankPool` trägt | alles nach dem `JudgePool` | den ganzen Bestand, die Teilnahmerate eingeschlossen |
| Formgebung | Tiefendeckel, `ShapedRemainder`, `DistributionCurve`, `RankFloor` | keine, der `RankCycle` wie bisher |
| Zeile | geformt, ohne flache Rate | `packsCycle[i] + Rate` |

Die Tabelle in Entscheid 5 an #103 schrieb unter Packs „`ParticipationPool`
bleibt `rate × players`". Wörtlich genommen zählte das zusammen mit der flachen
Rate in den Zeilen jede Teilnahme-Pack doppelt, also genau den Fehler, den
`480d04c` behoben hat. Gemeint war, dass die Packs laufen wie bisher (Punkt C).
Die Zelle oben ist die richtige.

1. **Der Kern ändert sich, nicht nur die Anzeige** (E1). Die Booster-Zeilen
   ändern sich damit für alle Ränge, auch für unbediente, und die Kachelzahl ist
   die Angebotszahl. `rankShare()` in `suggest.mjs`, das die Rate vor dem
   Vergleich wieder abzog, ist ersatzlos weggefallen.
2. **Die Untergrenze für alle übernimmt der `RankFloor`** (E2). Er erreicht nur
   die bedienten Ränge. Darum wandern zwei Werte: `rankFloor` ← die
   Teilnahme-Booster-Rate, `depth` ← die Spielerzahl. Ein abgegoltener `Rank`
   bekommt keinen `RankFloor` (ADR 0001). Das ist genau die Regel „dann kriegt er
   einfach ein Display".
3. **Der Weg dahin ist eine Quelle der `ConflictNotice`** (E3). Der Kern ist
   total und rein (ADR 0002) und setzt seine eigene Eingabe nicht.
   `combinedHandout` reist im `SetupLink`, der Stand „gemeinsames Handout, Tiefe
   unter der Spielerzahl" ist also erreichbar und legal. Der Plan meldet ihn als
   `combinedHandoutDepth`, `unfit()` schliesst ihn ein, und `suggestions()` trägt
   den Weg heraus, der beide Werte setzt. **Beide Werte werden Pins**, weil eine
   ungepinnte Tiefe vom Deckel wieder geschnitten würde (ADR 0006).
4. **Nur die Booster wandern** (E5). Die Packs haben keine Untergrenze und kein
   Gegenstück zu `rankFloor`. „Im Normalfall gibt es ein Tournament Pack pro
   Person … dass alle eins bekommen, das muss schon dargestellt werden." Das
   leistet die flache Rate.

Zwei Präzisierungen beim Bau (Maintainer, 2026-10-05, im Terminal):

- **Die Rate ist die, mit der der Plan rechnet** (`participation.rate.booster`),
  nicht der Reglerwert. Die beiden fallen auseinander, wenn ein gepinnter
  `participationBooster` über einer gesunkenen Wand steht. Ein Floor aus dem
  Reglerwert verlangte dann mehr, als der Pool hat.
- **Der Floor wird nur gehoben.** Steht er schon über der Rate, bleibt er stehen,
  und der Weg heraus setzt nur die Tiefe.

## Considered Options

- **Nur Kachel und Satz ändern**, den Kern lassen (E1). Verworfen: Der Fehler
  sitzt in der Zahl auf der Kachel, nicht im Satz.
- **Die Rate nur bei Rängen ohne `DisplayReservation` weglassen** (E1).
  Verworfen: Das sind zwei Regeln für einen Pool.
- **Nur `rankFloor` setzen** (E2). Verworfen: Die Ränge unter der Tiefe bekämen
  null.
- **Die Bedeutung des `RankFloor` auf alle Spieler umschreiben** (E2). Verworfen:
  Das träfe die Deckelformel und wirkte auch im getrennten Zweig.
- **Automatik beim Umschalten**, oder eine eigene Meldung mit Knopf (E3).
  Verworfen: Der Kern setzt keine Eingabe, und die `ConflictNotice` hat die
  Maschine schon.
- **Packs mitwandern lassen** (E5). Verworfen: Bei 6 Packs auf 32 Leute bekämen
  26 nichts.
- **Ein neuer Regler `packFloor`** (E5). Verworfen: Das wäre ein neuer
  `SetupLink`-Schlüssel, Version +1 und eine `LinkMigration` im selben Commit.

## Consequences

- **Der `JudgePool` wird nicht mehr vom Teilnahmeregler gedeckelt**, solange
  `combinedHandout` an ist. Seine Obergrenze ist der Rest nach dem
  `ParticipationPool`, und der ist dann leer. Damit hat der ausgeblendete Regler
  `participationBooster` keine Wirkung auf die Booster, ausser über den Weg
  heraus, der seine Rate liest.
- **Wo die Rate die ganze `boosterRate` ist, räumt der Weg nicht.** Floor = Rate
  über alle Spieler lässt keinen Booster für den Vorsprung von `Rank` 1, sofern
  kein `Rank` abgegolten ist. Dann steht der Weg nicht da, und der mehrgliedrige
  Weg (`combinedWayOut()`, ADR 0002, Nachtrag) bedient alle Ränge mit dem Floor,
  den der Pool trägt. Genau in diesem Fall fallen Reglerwert und gedeckelte Rate
  auseinander. Ein Reglerwert hätte daran also nichts geändert.
- **Der Weg heraus steht als zweigliedriger Weg zwischen den einzelnen**
  (darum `Teilweise überholt durch ADR-0010.` an ADR 0002; bis zum
  Map-Closure Durchgang 2 stand dort `Ergänzt`, aber „steht er allein da"
  gilt unter `CombinedHandout` nicht mehr). An der
  Stelle der Tiefe ersetzt er unter `CombinedHandout` deren gewöhnliche Suche,
  weil dort keine kürzere Tiefe räumt. Das erweitert ADR 0002: Es ist ein
  entschiedener Weg über zwei Regler, kein gesuchter, und er steht auch dort, wo
  einzelne Wege bestehen. Der mehrgliedrige Weg setzt bei `combinedHandoutDepth`
  die Tiefe auf die Spielerzahl. Das ist der einzige Fall, in dem er die Tiefe
  bewegt.
- **Vor dem Deploy (#30)** ist die Bedeutungsänderung frei, ohne Versionssprung
  und ohne `LinkMigration` (`docs/agents/setup-link.md`, „Not yet"). Danach
  wäre sie es nicht mehr, und darum steht dieser ADR.
- **Gemessene Verschiebungen**, beabsichtigt und an den Proben vermerkt: der
  Stolperdraht in `test/sum-rule.test.mjs`, die Zähler der Vorschlagsraster in
  `test/suggest.test.mjs`. „CombinedHandout changes no proposal" (#60, AK 7)
  gilt nicht mehr. An seiner Stelle steht die Probe aus #103, nach der Kachel und
  Satz dieselbe Zahl nennen.
- **Die dritte Reichweite des Rückwegs bekommt einen zweiten Auslöser**
  (Entscheid 4). Wer `CombinedHandout` wieder ausschaltet, sieht eine Meldung in
  der Form der `CarryOverNotice`. Sie listet `rankFloor` und `depth`, soweit sie
  gepinnt stehen — `depth` als Posten `Served ranks`, ein gepinnter `depthStep`
  eingeschlossen (#67), und ihr Knopf lässt sie fallen, mit derselben Rückfrage. Das
  erweitert den Nachtrag (#33) zu ADR 0006, „Die Reichweite ist die Handlung,
  nicht der Ort": Es ist dieselbe Handlung an einer dritten Stelle. Die Pins
  bleiben dabei stehen, wie ADR 0006 es verlangt.
- Die übrige Oberfläche (Entscheid A) steht in `CONTEXT.md` unter
  `CombinedHandout`, nicht hier.
