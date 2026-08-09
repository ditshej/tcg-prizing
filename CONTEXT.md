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
Die Liefereinheit, in der Bandai `TournamentPack`s ausgibt: eine feste Anzahl
`TournamentPack`s plus ein `WinnerPack`. Der `WinnerPack` gehört erst zum
`PrizePool`, wenn genug `TournamentPack`s daraus angebrochen sind — diese
Schwelle ist der einzige Ort, an dem zwei `PrizeItem`-Typen aneinander hängen.
Wie `Display` eine Verpackungs-, keine Verteilungseinheit.
_Avoid_: Briefchen (nur Umgangssprache), ParticipationPack

## Pools

**PrizePool**:
Alles, was der `Shop` für ein `Tournament` stellt. Die Summe über alle `Pool`s
ergibt restlos den `PrizePool` — diese Rechnung muss immer exakt aufgehen.

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
Wie tief der `RankPool` ins `Ranking` reicht: Anzahl der Ränge ab `Rank` 1, die
etwas daraus bekommen — lückenlos, mindestens 1. Nach oben begrenzt sie nicht
nur die Zahl der `Player`, sondern auch der `RankPool` selbst: jeder bediente
`Rank` bekommt mindestens einen `Booster` und `Rank` 1 mindestens einen mehr als
`Rank` 2, also bleibt die Tiefe unter der Zahl der `Booster` im `RankPool`. Die
preisberechtigte Gruppe ist damit vollständig beschrieben und
braucht keinen eigenen Begriff — es sind die `Player` mit `Rank` ≤
`RankPoolDepth`. Ob das `Tournament` eine K.-o.-Runde gespielt hat, spielt keine
Rolle.
_Avoid_: TopCut (bezeichnet im TCG die K.-o.-Runde nach Swiss, nicht die preisberechtigte Gruppe), PrizeDepth, Preisränge

**DistributionCurve**:
Die Form, in der der `RankPool` über die bedienten Ränge abfällt: benannte
Stufen von sanft bis extrem, bei denen jeder `Rank` einen festen Anteil dessen
bekommt, was der `Rank` über ihm bekommt. Es gibt keine flache Stufe — ein
`RankPool`, der nicht nach `Rank` unterscheidet, ist ein `ParticipationPool`.
Greift nur auf teilbare Mengen; knappe `PrizeItem`s laufen an ihr vorbei.
_Avoid_: Verteilungsschlüssel, Payout-Struktur, Spread

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

## Turnier und Personen

**Tournament**:
Ein einzelnes Turnier — die Einheit, für die genau ein `DistributionPlan`
entsteht.

**Game**:
Das TCG, für das ein `Tournament` läuft, und Träger der Defaults.
_Avoid_: TCG, System; „Game" nie im Sinn einer einzelnen Partie

**TournamentType**:
Das Turnierformat, das eigene Defaults mitbringt.

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
dieser Einheit.
