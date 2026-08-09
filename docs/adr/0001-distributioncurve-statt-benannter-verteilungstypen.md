# DistributionCurve statt benannter Verteilungstypen

Für die Aufteilung des `RankPool` auf die bedienten Ränge standen zwei Modelle
zur Wahl: ein einzelner Regler mit Abstufungen von flach bis extrem, oder eine
Auswahl benannter Berechnungs-Typen (gleichmässig, Halbierung, Plateaus,
Spitze zuerst). Wir nehmen den Regler — die `DistributionCurve` —, weil ein
Prototyp an echten Turnierzahlen gezeigt hat, dass die benannten Typen entweder
schon auf der Kurve liegen oder ihre eigene Zusicherung nicht halten können.

## Considered Options

**Benannte Typen.** „Gleichmässig" ist rechnerisch identisch mit der flachsten
Kurvenstufe, „Halbierung" liegt zwischen zwei Stufen — beide sind keine eigenen
Modelle, sondern Punkte auf derselben Kurve. Übrig blieben die Blockformen
(Plateaus wie 1., 2., 3.–4., 5.–8.; Spitze zuerst), die eine monoton fallende
Kurve tatsächlich nicht erzeugen kann. Sie scheiterten an zwei anderen Punkten:

- Ein Plateau sichert zu, dass alle in einem Block dasselbe bekommen. Bei
  ganzzahligen `PrizeItem`s geht diese Zusicherung regelmässig nicht auf — 6
  `Booster` auf einen Viererblock ergeben `1-1-1-0`. Ausgerechnet die Form mit
  dem stärksten Versprechen ist die einzige, die man brechen kann.
- Blöcke stammen aus Turnieren mit K.-o.-Runde, wo 3. und 4. wirklich
  ununterscheidbar sind. Das `Ranking` dieser App ist laut `RankPoolDepth`
  immer eine vollständige, lückenlose Reihenfolge; ein Plateau würde
  Information wegwerfen, die vorliegt.

## Consequences

Die harte Summenregel (`PrizePool` restlos auf die `Pool`s, alles ganzzahlig)
wird nicht geprüft, sondern konstruiert: Verteilt wird nach **grösstem Rest**,
und die beiden Zusicherungen — jeder bediente `Rank` bekommt mindestens einen
`Booster`, `Rank` 1 mindestens einen mehr als `Rank` 2 — werden vorab
reserviert, bevor die Kurve den verbleibenden Rest formt. Weil die Gewichte nie
steigen, kann das Formen einen reservierten Vorsprung nur halten, nie schliessen.

Daraus folgt ein zweiter, engerer Deckel auf `RankPoolDepth`: sie bleibt unter
der Zahl der `Booster` im `RankPool`. Das korrigiert die ursprüngliche Grenze
„höchstens so viele wie `Player`".

Knappe `PrizeItem`s laufen an der Kurve vorbei. `WinnerPack`s und
`TournamentPack`s im `RankPool` werden von `Rank` 1 an durchgereicht und
beginnen wieder oben, wenn mehr davon da sind als bediente Ränge — sonst gehen
sie verloren, was ein Prototyp-Durchlauf über alle Kombinationen aufgedeckt hat.
