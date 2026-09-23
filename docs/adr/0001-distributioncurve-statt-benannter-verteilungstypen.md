# DistributionCurve statt benannter Verteilungstypen

Teilweise überholt durch ADR-0002.

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

Nachtrag: Die Stufen sind inzwischen benannt und mit Verhältnissen belegt
(`gentle` 0.85 bis `extreme` 0.25, siehe `CONTEXT.md`). Damit ist der Satz oben,
„gleichmässig" sei rechnerisch identisch mit der flachsten Stufe, genauer zu
lesen: Die sanfteste Stufe liegt **nahe** an einer Gleichverteilung, ist aber
keine. Das Argument gegen den benannten Typ bleibt — er ist kein eigenes Modell,
sondern ein Punkt auf derselben Kurve.

Nachtrag: Aus der Zusicherung „jeder bediente `Rank` bekommt mindestens einen
`Booster`" ist ein Regler geworden — der `RankFloor`, Startwert 2. Reserviert
wird damit `RankFloor · RankPoolDepth + 1` statt `RankPoolDepth + 1`. Der zweite
Vorsprung, `Rank` 1 vor `Rank` 2, bleibt ausdrücklich **absolut 1** und skaliert
nicht mit: er sichert bloss die Unterscheidbarkeit an der Spitze, während der
`RankFloor` das untere Ende der bedienten Ränge trägt. Zwischen `Rank` 2 und 3
gibt es weiterhin keinen zugesicherten Vorsprung — die Form ist Sache der Kurve.

Damit entsteht eine **Vorrangkette** unter den Reglern, die in denselben
`RankPool` greifen: `RankFloor` → `RankPoolDepth` → `DisplayReservation`. Der
`RankFloor` wird von keinem gedeckelt, die Tiefe von ihm
(`⌊(Booster im RankPool − 1) / RankFloor⌋`), die `DisplayReservation` über die
Machbarkeit von beiden (ADR 0002 und die Resolution zu #7). Die Kette ist wörtlich
die Verallgemeinerung des Deckels oben mit `RankFloor` statt 1, und sie ist
azyklisch — deckelten sich zwei gegenseitig, sässe der Lead fest, sobald er beide
von Hand angefasst hat. Die Richtung ist bewusst so gewählt: die Tiefe ist der
nachziehende Regler, der `RankFloor` eine Zusicherung über die Qualität einer
Zuteilung. Im Konflikt werden **wenige Ränge anständig** bedient statt viele mit
Krümeln.

Der Preis ist, dass der `RankFloor` das Formmasse der Kurve frisst. Was übrig
bleibt, heisst `ShapedRemainder` und wird ausgewiesen; er kann null werden, dann
ist die Stufenwahl ohne Wirkung. Gekoppelt werden `RankFloor` und Kurve trotzdem
nicht — der Zustand ist arithmetisch einwandfrei und genau das, was ein hoher
`RankFloor` bestellt. Unangenehm ist dabei, dass eine **nachziehende** Tiefe den
`ShapedRemainder` systematisch verhungert: „so tief wie möglich" ist per
Definition der Wert, der den Boden maximiert. Wer der Kurve Material lassen will,
muss die Tiefe selbst senken.

Nachtrag: Der Vorsprung von `Rank` 1 ist eine Zusicherung **innerhalb** der
Kurve und setzt daher aus, sobald eine `DisplayReservation` einen `Rank` aus der
Kurve nimmt. Ein abgegoltener `Rank` 1 bekommt genau `Display`-Grösse · `d₁`,
und dass er damit über `Rank` 2 liegt, ist Arithmetik und keine Garantie — bei
grossem `ShapedRemainder` überholt `Rank` 2 ihn. Das ist kein neuer Fall, sondern
die Überholung, die ADR 0002 gekippt hat; sie wird durchgerechnet und gemeldet,
nicht verhindert.

Welche Ränge aus der Kurve fallen, ist dabei allgemeiner geregelt als in der
Resolution zu #7: **abgegolten sind alle Ränge oberhalb des obersten
Gleichstands** im `DisplayReservation`-Vektor, die Kurve läuft von dort abwärts.
#7s Regel — „bei Gleichstand gehen alle Ränge in die Kurve" — ist der Spezialfall
`d` = (1,1,0,…), wo der oberste Gleichstand ganz oben sitzt und oberhalb niemand
liegt. Bei `d` = (2,1,1,0,…) bleibt `Rank` 1 mit seinen zwei `Display`s dagegen
draussen, statt mit in die Kurve zu fallen: er ist unstrittig oben, und nur der
Gleichstand zwischen `Rank` 2 und 3 braucht die Kurve, um gebrochen zu werden.
Das ist die Fassung, in der „der Sieger bekommt genau zwei `Display`s" eine
haltbare Aussage ist — der Preis ist ebendieser Verlust der Vorsprungs-Garantie.

Nachtrag: Der Satz „im Konflikt werden **wenige Ränge anständig** bedient statt
viele mit Krümeln" ist keine Leitlinie der App, sondern die Begründung für die
Reglerwerte eines **kompetitiven** `TournamentType`. Er wird hier ausdrücklich
vom Mechanismus abgezogen: die Vorrangkette steht, weil der `RankFloor` eine
harte Zusicherung ist und die Kurve ein weicher Wunsch — das gilt bei Tiefe 8
wie bei Tiefe 32 unverändert und braucht keine Aussage darüber, welche Verteilung
die bessere ist. Der Gegenbeweis ist das Release-Blatt (Resolution zu #25):
`RankPoolDepth` = alle Spielenden, `RankFloor` 2, und der Krümel für `Rank` 32 ist
genau der Punkt der Veranstaltung. Wer die Kette als Wertung liest, hält ein
gültiges Set-Blatt für einen Verstoss.

Ebenfalls gegen den Wortlaut oben zu lesen: „**die flachste Stufe**" heisst die
unterste der sieben — `gentle` 0.85 —, nie die Abwesenheit einer Kurve. Flach im
Sinne von „möglichst viele bekommen möglichst gleich viel" macht der `RankFloor`,
nicht die Stufenwahl; eine achte, gleichverteilende Stufe bleibt ausgeschlossen.

Knappe `PrizeItem`s laufen an der Kurve vorbei. `WinnerPack`s und
`TournamentPack`s im `RankPool` werden von `Rank` 1 an durchgereicht und
beginnen wieder oben, wenn mehr davon da sind als bediente Ränge — sonst gehen
sie verloren, was ein Prototyp-Durchlauf über alle Kombinationen aufgedeckt hat.

## Nachtrag (Durchgang 2): der `RankCycle` im Schlussabsatz ist nicht mehr der von heute

Der Absatz oben — „`WinnerPack`s und `TournamentPack`s im `RankPool` werden von
`Rank` 1 an durchgereicht und beginnen wieder oben, wenn mehr davon da sind als
bediente Ränge" — beschreibt einen Kreis, den es in dieser Form nicht mehr gibt.
Drei Abweichungen gegen den heutigen `RankCycle` in `CONTEXT.md`:

- **Es laufen nur `TournamentPack`s.** `WinnerPack`s gehen über die
  `WinnerPackAllocation` (`ranked` / `manual` / `open`) und nie im Kreis; ein
  `Rank` gewinnt eine Siegerkarte nicht zweimal.
- **Der Kreis beginnt nicht bei `Rank` 1**, sondern beim ersten `Rank` nach dem
  `ranked`-Anteil — sind zwei `WinnerPack`s automatisch vergeben, startet er bei
  `Rank` 3 und läuft über den letzten `Rank` zurück auf `Rank` 1.
- **Er läuft über alle Ränge bis zur Spielerzahl**, nicht bis zur
  `RankPoolDepth`: „mehr davon da sind als bediente Ränge" wäre der Deckel, den
  `CONTEXT.md` ausdrücklich verneint („`RankPoolDepth` begrenzt ihn nicht").

Was gültig bleibt, ist der Grund, aus dem der Absatz hier steht: knappe, nicht
teilbare `PrizeItem`s laufen **an der Kurve vorbei**, und sie gehen nicht
verloren. Nur die Mechanik ist seither an ihren eigenen Ort gewandert.

## Nachtrag (#43): der Deckel der Tiefe muss die `DisplayReservation` sehen

Der Kettenabsatz oben schreibt den Deckel der `RankPoolDepth` als
`⌊(Booster im RankPool − 1) / RankFloor⌋`. Das ist die Reservationsbedingung
nach der Tiefe aufgelöst — aber mit **einer** der Reservationen unterschlagen:
die `DisplayReservation` leert denselben Topf und kommt nicht vor. Am `Weekend`
mit 32 `Player` und `d` = (1,0,…) versprach der Deckel deshalb 31 bediente Ränge,
machbar waren 21; am Prototyp (Runde 25) nachgemessen.

Richtig lautet er, mit `a` als der Zahl der abgegoltenen Ränge:
`Tiefe ≤ a + ⌊(Booster im RankPool − reservierte Booster − Vorsprung) / RankFloor⌋`.
Ohne Reservation sind `a` und die reservierten `Booster` null und es bleibt die
alte Fassung übrig — es ist dieselbe Verallgemeinerung wie oben `RankFloor`
statt 1, eine Stufe weiter. Die massgebliche Fassung steht ab jetzt einmal in
`CONTEXT.md` beim `ShapedRemainder`, weil die Bedingung dort schon einen Namen
hatte; die beiden Deckel sind ihre zwei Auflösungen.

**Die Kette kehrt sich dadurch nicht um.** Der Absatz oben begründet ihre
Azyklizität damit, dass der Lead festsässe, „sobald er beide von Hand angefasst
hat" — dieser Fall entsteht nicht: ein Deckel bindet nur den nachziehenden Wert,
ein `pinned` Wert wird nach ADR 0006 nie gekappt, und die `DisplayReservation`
wird nie automatisch gesetzt. Eine der beiden Richtungen feuert also nie.
Sichtbar wird das an einem Nebeneffekt, der am Prototyp gemessen ist: eine von
Hand gesetzte Reservation, die vorher am Machbarkeitsdeckel scheiterte, geht
jetzt durch, weil die nachziehende Tiefe ihr ausweicht. Das ist die Kette, nicht
ihr Bruch — sie ordnet, wer verliert, wenn **beide** `pinned` sind. Sind beide
`pinned` und zusammen nicht machbar, wählt sie trotzdem keinen Verlierer,
sondern nur die Reihenfolge, in der die `ConflictNotice` die Wege heraus zeigt
(Resolution zu #19).

## Nachtrag (#45): bei gleichem Rest bekommt der höhere `Rank`

Der Absatz oben legt fest, dass nach **grösstem Rest** verteilt wird, und sagt
nicht, was bei **gleichen** Resten geschieht. Der Fall ist erreichbar und kein
Rundungszufall: die Kurvengewichte sind geometrisch, und bei `extreme` stehen
sie wie 16 : 4 : 1 — alle drei ≡ 1 mod 3. Mit 8 `Player`, `RankPool` 14,
`RankFloor` 2 und Tiefe 3 ergeben sich die Sollanteile 5⅓ / 1⅓ / 0⅓: drei
gleiche Reste, ein offener `Booster`. Der Stand ist **gültig** — die
Reservationsbedingung hält, ADR 0002 greift nicht, hier ist nichts zu melden,
sondern zu rechnen.

Er bekommt ihn nach oben: **der höhere `Rank`**. Sind die Reste gleich,
unterscheidet die Ränge nur noch das Gewicht, und das fällt per Konstruktion
(eine flache Stufe gibt es nicht) — der höhere `Rank` hat im stetigen Anspruch
mehr stehen und verliert beim Abschneiden mehr, also bekommt er das Stück
zurück. Das ist keine Wertung „Spitze vor Breite": die Breite trägt der
`RankFloor`, die Form ist Sache der Kurve, und der Satz vom Nachtrag oben — die
Kette sei keine Leitlinie der App — gilt hier unverändert. Die
Monotonie-Zusicherung, die die Frage umsonst entschiede, gibt es weiterhin
nicht; sie schnitte auch nicht, weil 9/3/2, 8/4/2 und 8/3/3 alle drei schwach
fallend sind.

**Nicht zu verwechseln mit dem anderen Gleichstand.** „Abgegolten sind alle
Ränge oberhalb des obersten Gleichstands im `DisplayReservation`-Vektor"
entscheidet, welche Ränge **aus der Kurve fallen**; diese Regel entscheidet, wer
ein **übriges Stück** bekommt. Die beiden treffen einander nirgends und dürfen
nicht gegeneinander gelesen werden — die eine legt keine Richtung für die andere
fest.

Die massgebliche Fassung steht in `CONTEXT.md` beim `ShapedRemainder`, wo das
Verfahren schon wohnt.
