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
Verkaufseinheit aus einer festen Anzahl `Booster`.
