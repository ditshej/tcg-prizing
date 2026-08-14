# Prizing

Dieses Projekt berechnet für ein einzelnes TCG-Turnier, wie ein fixer, vom Shop
gestellter Pool an Preisen auf die Teilnehmenden verteilt wird. Die Domäne heisst
**Prizing** (Verteilung von Preisen), nicht **Pricing** (Preisgestaltung) — mit
Geld, Kosten und Marge hat dieses Projekt nichts zu tun. `price` ist deshalb in
Identifiern, Pfaden und Prosa zu vermeiden; wo es noch auftaucht, ist es Altlast.

## Prize-Elemente

_`Booster`, `TournamentPack` und `WinnerPack` sind die Ausprägung für das `Game`
One Piece — keine feste Liste, die für jedes `Game` gilt._

**PrizeItem**:
Ein einzelnes, unteilbares Stück aus dem `PrizePool` — das, was einmal über den
Tisch geht. Immer ganzzahlig zählbar.
_Avoid_: Prize (allein, weil es sonst auch das Bündel meint, das eine Person bekommt), Reward, Preis

**Booster**:
Ein versiegelter Booster aus einem regulären Set. Ein `PrizeItem`.

**TournamentPack**:
Ein versiegelter Pack mit genau einer Turnierkarte darin, von Bandai als
Teilnahmepreis für Store Tournaments geliefert. Ein `PrizeItem`. Verteilt wird
der geschlossene Pack, nie die Karte darin.
_Avoid_: Promo (ist bei Bandai der Oberbegriff über alle Turnierkarten, auch die Siegerkarte), ParticipationPack (heisst nur auf Championship-Ebene so)

**WinnerPack**:
Ein versiegelter Pack mit genau einer goldgestempelten Siegerkarte darin. Ein
`PrizeItem`, also eine Sache — nie eine Person.
_Avoid_: Winner (allein), Siegerkarte als Bezeichnung für einen Menschen

**PackEnvelope**:
Die Liefereinheit, in der Bandai `TournamentPack`s ausgibt: eine Anzahl
`TournamentPack`s plus ein `WinnerPack`. Die Anzahl ist pro `Tournament`
einstellbar, mit einem Default am `Game` — sie wechselt von Event zu Event
innerhalb desselben `Game`. Der `WinnerPack` gehört erst zum `PrizePool`, wenn
mindestens zwei Drittel der `TournamentPack`s daraus angebrochen sind; diese
Schwelle wird aus der Grösse abgeleitet und nicht eingestellt. Sie ist der
einzige Ort, an dem zwei `PrizeItem`-Typen aneinander hängen.
Die `PackagingUnit` für `TournamentPack`s. Lose Einzelpacks, die im Laden aus
einem früheren `PackEnvelope` übrig sind, kennt die App nicht — die zählt der
`CommunityLead` selbst.
_Avoid_: Briefchen (nur Umgangssprache), ParticipationPack

**PackagingUnit**:
Die Einheit, in der ein `PrizeItem` geliefert wird, im Unterschied zur Einheit,
in der es verteilt wird: `Display` für `Booster`, `PackEnvelope` für
`TournamentPack`s. Sie bindet die Beschaffung, nie die Verteilung — angebrochen
werden darf immer, und der `PrizePool` wird nie auf ganze Einheiten gerundet.
Sie ist die Achse, entlang der die `PreparationList` zerlegt.
_Avoid_: Verpackung, Gebinde, SKU

## Pools

**PrizePool**:
Alles, was der `Shop` für ein `Tournament` stellt. Die Summe über alle `Pool`s
ergibt restlos den `PrizePool` — diese Rechnung muss immer exakt aufgehen. Die
Regel bindet die **`Pool`-Ebene**, nicht die Empfänger-Ebene: innerhalb eines
`Pool` darf ein `PrizeItem` ohne Empfänger bleiben, ohne dass die Summe verletzt
ist (siehe `open` in der `WinnerPackAllocation`).

**Pool**:
Eine benannte Teilmenge des `PrizePool` mit einer eigenen Verteilungsregel. Ein
`Pool` kann `PrizeItem`s beliebiger Typen enthalten.

**ParticipationPool**:
Der `Pool`, der gleichmässig an alle `Player` geht, unabhängig vom `Ranking`.
Hängt nicht vom Turnierverlauf ab und kann vor dem Turnier ausgeteilt werden.
Ein `Player` erhält diesen Anteil zusätzlich zu allem, was ihm über den
`RankPool` zusteht.

**JudgePool**:
Der `Pool`, der die `Judge`s abfindet. Anonymer Block ohne Bezug zur Anzahl
`Judge`s — er hält fest, wieviel für die Turnierleitung beiseite liegt, nicht wer
es bekommt. Als einziger `Pool` absolut eingestellt statt als Menge pro `Player`,
weil ein `Judge` keine `PrizeItem`s in den `PrizePool` bringt, sondern nur
abgreift. Steht meist auf null: solange der `Shop` die `Judge`s von aussen
abfindet, berührt die Rechnung sie nicht.

**RankPool**:
Der `Pool`, der nach `Rank` verteilt wird. Der Rest, der nach allen anderen
`Pool`s übrig bleibt.

**RankPoolDepth**:
Wie tief die **geformte** Verteilung des `RankPool` ins `Ranking` reicht: Anzahl
der Ränge ab `Rank` 1, die aus der `DistributionCurve` etwas bekommen —
lückenlos, mindestens 1. Sie betrifft nur die teilbaren Mengen, also die
`Booster`; knappe unteilbare `PrizeItem`s laufen den `RankCycle` und reichen
tiefer. Nach oben begrenzt sie nicht nur die Zahl der `Player`, sondern auch der
`RankPool` selbst: jeder bediente `Rank` bekommt mindestens einen `Booster` und
`Rank` 1 mindestens einen mehr als `Rank` 2, also bleibt die Tiefe unter der
Zahl der `Booster` im `RankPool`. Ob das `Tournament` eine K.-o.-Runde gespielt
hat, spielt keine Rolle. Ihr Startwert kommt aus dem `DefaultSet` und darf dort
als Konstante oder als eine der **oberen acht** Stufen der Bereichsliste stehen
(siehe `RaffleRange`) — weil sie ein Präfix ab `Rank` 1 ist, sind die unteren
Stufen unbrauchbar. Der Regler selbst bleibt absolut: die Stufe liefert nur den
Startwert und zieht mit der Spielerzahl nach, bis der Lead ihn anfasst.
_Avoid_: TopCut (bezeichnet im TCG die K.-o.-Runde nach Swiss, nicht die geformte Verteilung), PrizeDepth, Preisränge

**DistributionCurve**:
Die Form, in der der `RankPool` über die bedienten Ränge abfällt: benannte
Stufen von sanft bis extrem, bei denen jeder `Rank` einen festen Anteil dessen
bekommt, was der `Rank` über ihm bekommt. Es gibt keine flache Stufe — ein
`RankPool`, der nicht nach `Rank` unterscheidet, ist ein `ParticipationPool`.
Greift nur auf teilbare Mengen; knappe `PrizeItem`s laufen an ihr vorbei.
Die sieben Stufen, mit dem Anteil, den ein `Rank` von dem über ihm bekommt:
`gentle` 0.85, `mild` 0.75, `moderate` 0.65, `firm` 0.55, `steep` 0.45,
`severe` 0.35, `extreme` 0.25. Die Namen sind Etiketten über den Verhältnissen —
massgeblich ist die Zahl. Auch die sanfteste Stufe ist keine Gleichverteilung.
_Avoid_: Verteilungsschlüssel, Payout-Struktur, Spread

**RankCycle**:
Die Reihenfolge, in der knappe `TournamentPack`s aus dem `RankPool` vergeben
werden: ein Kreis über alle Ränge von 1 bis zur Zahl der `Player`, je ein
`TournamentPack` pro `Rank` und Umlauf, bis der Vorrat leer ist. Er beginnt beim
ersten `Rank` nach dem `ranked`-Anteil der `WinnerPackAllocation` — sind zwei
`WinnerPack`s automatisch vergeben, startet der Kreis bei `Rank` 3, läuft über
den letzten `Rank` hinaus zurück auf `Rank` 1 und weiter. Ein `Rank` mit
automatischem `WinnerPack` bekommt damit erst dann ein `TournamentPack`, wenn
alle anderen eines haben. Handzuteilungen (`manual`) und noch offene
`WinnerPack`s verschieben den Startpunkt **nicht** — die `TournamentPack`s
bleiben stehen, während der Lead Siegerkarten setzt. Das Gegenstück zur
`DistributionCurve`: die Kurve formt, was teilbar ist, der Kreis läuft ab, was es
nicht ist. `RankPoolDepth` begrenzt ihn nicht.
_Avoid_: Round Robin (Verfahren, nicht Domäne), Umlauf, Restverteilung

**WinnerPackAllocation**:
Wie die vorhandenen `WinnerPack`s zu Empfängern kommen — der einzige Ort, an dem
der `CommunityLead` von Hand zuteilt, weil die Empfängerwahl hier eine soziale
und keine rechnerische ist. Drei Anteile: **`ranked`** geht als lückenloses
Präfix ab `Rank` 1 automatisch raus; **`manual`** teilt der Lead einzelnen
`Rank`s zu — mehrere pro `Rank` erlaubt, auch auf einem `Rank` mit
`ranked`-Anteil, frei über das ganze `Ranking` und unabhängig von
`RankPoolDepth`; **`open`** ist der Rest, den die App nur ausweist und über den
sie keine Aussage macht. Den `manual`-Anteil setzt der Lead von Hand oder lässt
ihn per `Raffle` auslosen — beides schreibt in dieselben Zähler. `ranked` und `manual` sind Regler mit einer Staffel als
Default (`ranked` = ⌊n/2⌋ + 1, wobei **n die vorhandene Zahl `WinnerPack`s** ist
und der Wert auf ebendiese gedeckelt wird), die nachzieht,
bis der Lead sie anfasst; ihre Summe ist nach oben durch die vorhandene Zahl
gedeckelt. `ranked` ist nur über die Zahl steuerbar, nie per `Rank` — wer `Rank` 1
aussparen will, dreht `ranked` auf 0 und setzt alles `manual`. Ein geplanter
`WinnerPack` für einen `Judge` läuft nicht hierüber, sondern über den
`JudgePool`.
_Avoid_: fix (heisst auf Englisch „reparieren"), WinnerAssignment, ManualPool (es ist kein `Pool`)

**Raffle**:
Der Bedienschritt, mit dem der `CommunityLead` einen `manual`-`WinnerPack` aus
der `WinnerPackAllocation` auslosen lässt statt ihn selbst zu setzen: ein
Auslösen vergibt genau einen `WinnerPack` an einen gleichverteilt gezogenen
`Rank` aus dem `RafflePot`. Das Ergebnis landet in denselben `manual`-Zählern,
die der Lead auch von Hand setzt; die App führt nicht mit, woher eine Zuteilung
kam, und merkt sich frühere Ziehungen nicht — wird eine Zuteilung entfernt, ist
dieser `Rank` sofort wieder ziehbar. Ein Bedienschritt, kein Rechenschritt: der
Zufall sitzt in der Eingabe, nicht in der Berechnung, deshalb ändert Neurechnen
nie einen Gewinner. Steht neben der Handzuteilung, ersetzt sie nicht. Nicht
auslösbar, wenn kein `manual`-`WinnerPack` mehr offen oder der `RafflePot` leer
ist.
_Avoid_: Draw (heisst im TCG das Ziehen einer Karte), Lottery (klingt nach Geld und Recht), Verlosung als Name für den Bereich

**RaffleRange**:
Der `Rank`-Bereich, aus dem eine `Raffle` zieht — dreizehn benannte Stufen über
der Spielerzahl. Obere acht: `all`, `top8`, `top16`, `topQuarter`, `topThird`,
`topHalf`, `topTwoThirds`, `topThreeQuarters`. Untere fünf als deren
Komplemente: `bottomThreeQuarters`, `bottomTwoThirds`, `bottomHalf`,
`bottomThird`, `bottomQuarter`. Der obere Teil umfasst `⌈n × Anteil⌉` Ränge, der
untere ist dessen Komplement, sodass sich die Paare lückenlos und
überlappungsfrei ergänzen; absolute Stufen werden auf die Spielerzahl gekappt.
Dieselbe Liste liefert die Startwerte für `RankPoolDepth`, dort auf die oberen
acht beschränkt. Bemessungsgrundlage ist immer die Spielerzahl, nie
`RankPoolDepth`. Default ist `all`.
_Avoid_: RaffleMode (es ist ein Bereich, kein zweiter Rechenweg), Lostopf (das ist der `RafflePot`)

**RafflePot**:
Die `Rank`s, die bei einer `Raffle` wirklich im Topf liegen: die `RaffleRange`
abzüglich aller `Rank`s, die schon einen `WinnerPack` haben — `ranked` wie
`manual`. Dieser Ausschluss ist eine Invariante und kein Bedienelement, eine
Siegerkarte gewinnt niemand zweimal. Über `open` gebliebene `WinnerPack`s sagt er
nichts, weil sie keinen Empfänger haben. Er hängt am laufenden Zuteilstand und
kann leer sein, während die `RaffleRange` es nicht ist — genau dann ist die
`Raffle` nicht auslösbar, obwohl noch `WinnerPack`s offen sind.
_Avoid_: RafflePool (kein `Pool`, er verteilt nichts, sondern begrenzt die Empfängerwahl), RaffleGroup, Lostopf als Identifier

**DisplayReservation**:
Die Anzahl `Display`s, die ein einzelner `Rank` aus dem `RankPool` vorab
zugeteilt bekommt, bevor die `DistributionCurve` den Rest formt. Nach oben
begrenzt durch den `Rank` darüber, sodass sie über die Ränge nie steigt. Betrifft
nur `Booster`.
_Avoid_: Full-Display-Win, DisplayPrize, DisplayPool (es ist kein `Pool`, sondern eine Reservation innerhalb des `RankPool`)

**DistributionPlan**:
Das Ergebnis der Berechnung: wer aus diesem `Tournament` welche `PrizeItem`s
bekommt.
_Avoid_: Payout

**PreparationList**:
Die Sicht auf den `PrizePool`, die zeigt, was der `CommunityLead` beim `Shop`
holen muss: je `PackagingUnit` die Zerlegung der Menge in ganze Einheiten plus
lose `PrizeItem`s, dazu genau **ein** Beschaffungshinweis auf dem Total, der
aufrundet und die angebrochene Einheit benennt. Holen ist eine Total-Sache,
Sortieren eine `Pool`-Sache: die `Pool`s erscheinen als reine Stückzahlen ohne
eigenen Beschaffungshinweis, weil die Booster einer angebrochenen Einheit in
mehrere `Pool`s fliessen. Sie rechnet nichts Eigenes und fügt nichts hinzu —
auch der `JudgePool` ist eine Umschichtung innerhalb des `PrizePool`, keine
Zusatzbestellung. Eine `DisplayReservation` teilt die Beschaffungszahl in
„ungeöffnet" und „zum Anbrechen", erhöht sie nie. Kein Zustand und kein
Bedienmodus, sondern eine Ableitung, die schon vollständig ist, bevor es ein
`Ranking` gibt.
_Avoid_: Einkaufsliste (klingt nach Geld), ShoppingList, Vorbereitungsmodus (es ist kein Zustand)

## Turnier und Personen

**Tournament**:
Ein einzelnes Turnier — die Einheit, für die genau ein `DistributionPlan`
entsteht.

**Game**:
Das TCG, für das ein `Tournament` läuft, und Träger eines **vollständigen**
Blatts Startwerte: jede Variable, die überhaupt vorbelegt werden kann, hat auf
dieser Ebene einen Wert. Ein unvollständiges `Game` ist ein Fehler und kein
zulässiger Zustand, weil der Rückfall eines `TournamentType` sonst ins Leere
zeigt. Diese Werte sind zugleich die des ersten `TournamentType` — keine
neutrale Grundlinie, sondern der häufigste Fall.
_Avoid_: TCG, System; „Game" nie im Sinn einer einzelnen Partie

**TournamentType**:
Das Turnierformat innerhalb eines `Game` — ein Weekly ist anders eingestellt als
ein Wochenendturnier. Trägt nur die **Abweichungen** vom `Game`; was er nicht
nennt, erbt er. Es ist immer genau einer gewählt, einen Leerzustand „kein Typ"
gibt es nicht: der **erste** einer Liste ist die Startwahl und trägt ausser dem
Titel nichts, seine Werte sind die des `Game`. Damit ist die Reihenfolge der
Liste bedeutungstragend und keine Sortierung für die Oberfläche.
_Avoid_: Format (bezeichnet im TCG die Kartenpool-Regel), Preset

**DefaultSet**:
Der vollständige Satz Startwerte, auf denen die Regler eines `Tournament`
stehen, bevor der `CommunityLead` etwas anfasst: das Blatt des `Game`,
überschrieben von dem des gewählten `TournamentType`. Ein Eintrag ist entweder
eine Konstante oder die **Wahl** einer im Rechenkern benannten Regel — eine
Stufe der `DistributionCurve`, ein Bereich für `RankPoolDepth` — und trägt damit
Daten, nie Logik. Es belegt nie etwas vor, das einen `Rank` benennt: die
`DisplayReservation` und der `manual`-Anteil der `WinnerPackAllocation` starten
immer neutral, weil ein vorbelegter Empfänger eine Zuteilung ohne Entscheid
wäre. Ein Wechsel von `Game` oder `TournamentType` ersetzt das ganze
`DefaultSet` und setzt alle Regler zurück, auch die von Hand gesetzten.
_Avoid_: Preset (Oberflächensprache), Config, Profile, Defaults (allein)

**Ranking**:
Die fertige Reihenfolge der `Player`, geliefert vom Turniertool des `Game`.
Diese App berechnet sie nie, sie bildet sie nur ab.
_Avoid_: Standings, Pairings

**Rank**:
Die Position eines `Player` im `Ranking`, 1-basiert. Für die Person auf `Rank` 1
gibt es bewusst keinen eigenen Begriff — sonst steht dort früher oder später
wieder `winner`.
_Avoid_: Placement, Platz

**Player**:
Eine Person, die an einem `Tournament` teilnimmt.
_Avoid_: Participant, Teilnehmer, Winner

**Judge**:
Eine Person, die ein `Tournament` leitet und nicht über das `Ranking` bedient
wird.

**CommunityLead**:
Der Nutzer dieser App. Verteilt den `PrizePool`, verantwortet ihn aber nicht.
_Avoid_: Organisator, Veranstalter

**Shop**:
Der Laden, der den `PrizePool` stellt und das `Tournament` ausrichtet.

**TwoMoons**:
Der `Shop`, für den diese App zuerst gebaut wird, und dessen Hausregeln die
Defaults prägen. Kurzform im Gespräch: TM. Kein Begriff für die Oberfläche und
kein Identifier — die App kennt `Shop`, nicht diesen einen Laden.

**Display**:
Verkaufseinheit aus einer festen Anzahl `Booster`. Die Anzahl ist pro
`Tournament` einstellbar, mit einem Default am `Game`. Nur `Booster` gibt es in
dieser Einheit. Die `PackagingUnit` für `Booster`.
