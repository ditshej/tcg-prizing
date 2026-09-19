# Prizing

Dieses Projekt berechnet für ein einzelnes TCG-Turnier, wie ein fixer, vom Shop
gestellter Pool an Preisen auf die Teilnehmenden verteilt wird. Die Domäne heisst
**Prizing** (Verteilung von Preisen), nicht **Pricing** (Preisgestaltung) — mit
Geld, Kosten und Marge hat dieses Projekt nichts zu tun. `price` ist deshalb in
Identifiern, Pfaden und Prosa zu vermeiden; wo es noch auftaucht, ist es Altlast.

## Prize-Elemente

_Die Typenliste ist **fest** — `Booster`, `TournamentPack` und `WinnerPack`, samt
Namen. Sie steht im Rechenkern, nicht im `DefaultSet`: ein `Game` trägt Zahlen und
Regelwahlen, nie Typen und nie Etiketten. Die Namen kommen von Bandai, die drei
Wege dahinter sind allgemein — teilbar (`DistributionCurve`), knapp (`RankCycle`),
handzugeteilt (`WinnerPackAllocation`)._

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
_Avoid_: Promo (ist bei Bandai der Oberbegriff über alle Turnierkarten, auch die Siegerkarte — am `PromoEnvelope` ist derselbe Oberbegriff dagegen richtig, weil der Umschlag beide Sorten hält), ParticipationPack (heisst nur auf Championship-Ebene so)

**WinnerPack**:
Ein versiegelter Pack mit genau einer goldgestempelten Siegerkarte darin. Ein
`PrizeItem`, also eine Sache — nie eine Person.
_Avoid_: Winner (allein), Siegerkarte als Bezeichnung für einen Menschen

**PromoEnvelope**:
Die Liefereinheit, in der Bandai `TournamentPack`s ausgibt: eine **Grösse** —
die Anzahl `TournamentPack`s darin — und eine **Ausbeute**, die Anzahl
`WinnerPack`s darin. Beide sind pro `Tournament` einstellbar, mit einem Default
am `Game`, das der `TournamentType` überschreiben darf — der Umschlag wechselt
von Event zu Event innerhalb desselben `Game`. Die `WinnerPack`s gehören nicht
auf einmal zum `PrizePool`, sondern fallen **gleichmässig auf dem Weg zur
Zwei-Drittel-Marke** an: bei zwei Dritteln angebrochener `TournamentPack`s ist
die Ausbeute komplett, davor zählt sie anteilig, also
`min(Ausbeute, ⌊3 · Ausbeute · angebrochen / (2 · Grösse)⌋)`. Bei Ausbeute 1 ist
das die einzelne Schwelle bei zwei Dritteln. Die Staffel wird aus Grösse und
Ausbeute abgeleitet und nicht eingestellt. Sie ist der einzige Ort, an dem zwei
`PrizeItem`-Typen aneinander hängen — sie bindet aber den **Startwert**, nicht
die Menge: was die Staffel abwirft, ist der `auto`-Wert der Zahl vorhandener
`WinnerPack`s, und der `CommunityLead` darf sie in beide Richtungen
übersteuern.
Die `PackagingUnit` für `TournamentPack`s. Lose Einzelpacks, die im Laden aus
einem früheren `PromoEnvelope` übrig sind, kennt die App nicht — die zählt der
`CommunityLead` selbst. Lose `WinnerPack`s dagegen schon, weil ihre Zahl ein
Regler ist; die `PreparationList` nennt die Differenz zur Ausbeute in einem
Halbsatz, damit der Lead sie nicht in der Schublade vergisst.
_Avoid_: Briefchen (nur Umgangssprache), ParticipationPack, PackEnvelope (hiess bis 2026-08-26 so; Tickets bis #25 sagen es noch)

**PackagingUnit**:
Die Einheit, in der ein `PrizeItem` geliefert wird, im Unterschied zur Einheit,
in der es verteilt wird: `Display` für `Booster`, `PromoEnvelope` für
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
abgreift. Abgreifbar sind **`Booster` und `WinnerPack`**, je als eigener
Absolutwert; `TournamentPack`s nicht — die sind dafür da, dass möglichst jeder
`Player` einen bekommt. Steht meist auf null: solange der `Shop` die `Judge`s von
aussen abfindet, berührt die Rechnung sie nicht.

**RankPool**:
Der `Pool`, der nach `Rank` verteilt wird. Der Rest, der nach allen anderen
`Pool`s übrig bleibt.

**RankPoolDepth**:
Wie tief der `RankPool` ins `Ranking` reicht: Anzahl der Ränge ab `Rank` 1, die
**bedient** werden, also mindestens den `RankFloor` bekommen — lückenlos,
mindestens 1. Nicht die Reichweite der `DistributionCurve`: die formt nur den
`ShapedRemainder` und läuft unten aus, sobald sie bei null angekommen ist. Ein
bedienter `Rank`, bei dem die Kurve nichts mehr abwirft, bleibt bedient — bei
grosser Tiefe der Normalfall, nicht die Ausnahme. Sie betrifft nur die teilbaren Mengen, also die
`Booster`; knappe unteilbare `PrizeItem`s laufen den `RankCycle` und reichen
tiefer. Nach oben begrenzt sie nicht nur die Zahl der `Player`, sondern auch der
`RankPool` selbst: jeder bediente `Rank` bekommt mindestens den `RankFloor` und
`Rank` 1 einen mehr, also gilt
`Tiefe ≤ ⌊(Booster im RankPool − 1) / RankFloor⌋`. Der `RankFloor` deckelt die
Tiefe, nie umgekehrt. Ob das `Tournament` eine K.-o.-Runde gespielt
hat, spielt keine Rolle. Ihr Startwert kommt aus dem `DefaultSet` und darf dort
als Konstante oder als eine der **oberen acht** Stufen der Bereichsliste stehen
(siehe `RaffleRange`) — weil sie ein Präfix ab `Rank` 1 ist, sind die unteren
Stufen unbrauchbar. Der Regler selbst bleibt absolut: die Stufe liefert nur den
Startwert und zieht mit der Spielerzahl nach, bis der Lead ihn anfasst. Ein nicht
`pinned` Regler steht auf `min(Stufe, Deckel)` und kehrt von selbst zurück,
sobald der Deckel wieder steigt. Ein `pinned` Wert dagegen wird vom sinkenden
Deckel nie gekappt — er bleibt stehen, und die Meldung benennt ihn als den
Verlierer der Vorrangkette.
_Avoid_: TopCut (bezeichnet im TCG die K.-o.-Runde nach Swiss, nicht die geformte Verteilung), PrizeDepth, Preisränge

**RankFloor**:
Die Mindestzahl teilbarer `PrizeItem`s, die jeder bediente `Rank` aus dem
`RankPool` bekommt, bevor die `DistributionCurve` den Rest formt — heute also
`Booster`. Er bindet die teilbare Achse und nennt bewusst keinen `PrizeItem`-Typ:
`Booster` aus einer `DisplayReservation` zählen an, `TournamentPack`s aus dem
`RankCycle` nicht. `Rank` 1 bekommt einen mehr, also `RankFloor + 1` — der
Vorsprung aus ADR 0001 bleibt absolut 1 und skaliert nicht mit. Reserviert wird
damit `RankFloor · RankPoolDepth + 1`; was übrig bleibt, ist der
`ShapedRemainder`. Ein Regler mit Startwert im `DefaultSet`, der über keinen
anderen gedeckelt wird und selbst die `RankPoolDepth` deckelt.
_Avoid_: Minimum (allein), BoosterFloor (nagelt einen Typ fest, der heute nur zufällig der einzige teilbare ist), Trostpreisgrenze

**DistributionCurve**:
Die Form, in der der `RankPool` über die bedienten Ränge abfällt: benannte
Stufen von sanft bis extrem, bei denen jeder `Rank` einen festen Anteil dessen
bekommt, was der `Rank` über ihm bekommt. Es gibt keine flache Stufe — ein
`RankPool`, der nicht nach `Rank` unterscheidet, ist ein `ParticipationPool`.
Greift nur auf teilbare Mengen, und dort nur auf den `ShapedRemainder`; knappe
`PrizeItem`s laufen an ihr vorbei.
Die sieben Stufen, mit dem Anteil, den ein `Rank` von dem über ihm bekommt:
`gentle` 0.85, `mild` 0.75, `moderate` 0.65, `firm` 0.55, `steep` 0.45,
`severe` 0.35, `extreme` 0.25. Die Namen sind Etiketten über den Verhältnissen —
massgeblich ist die Zahl. Auch die sanfteste Stufe ist keine Gleichverteilung.
_Avoid_: Verteilungsschlüssel, Payout-Struktur, Spread

**ShapedRemainder**:
Was von den teilbaren `PrizeItem`s im `RankPool` übrig ist, nachdem alle
Reservationen abgezogen sind — `RankFloor`, der Vorsprung für `Rank` 1 und jede
`DisplayReservation` — und damit die einzige Menge, auf die die
`DistributionCurve` überhaupt greift. Er kann null sein: dann ist der
`DistributionPlan` der reine Boden und die Stufenwahl ohne Wirkung. Das ist kein
Fehler, sondern die Folge eines hohen `RankFloor` — wer jedem bedienten `Rank`
dasselbe zusichert, hat eine flache Verteilung verlangt. Er wird ausgewiesen,
damit sichtbar ist, warum die Stufe verstummt; gekoppelt werden die beiden nie.
_Avoid_: Rest (allein), CurveBudget, ShapedPool (kein `Pool`, er verteilt nichts)

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
ihn per `WinnerRaffle` auslosen — beides schreibt in dieselben Zähler. `ranked` und `manual` sind Regler mit einer Staffel als
Default (`ranked` = ⌊n/2⌋ + 1, wobei **n die Zahl `WinnerPack`s im `RankPool`**
ist, also nach Abzug des `JudgePool`, und der Wert auf ebendiese gedeckelt wird —
auch bei n = 0, wo die Staffel damit selbst auf 0 fällt), die nachzieht,
bis der Lead sie anfasst; ihre Summe ist nach oben durch dieselbe Zahl
gedeckelt. Die Staffel rechnet nie auf Stücken, die beiseite liegen: ein
Judge-Pack verkürzt das automatische Präfix, statt den `open`-Rest aufzuzehren,
der der `WinnerRaffle` gehört. `ranked` ist nur über die Zahl steuerbar, nie per `Rank` — wer `Rank` 1
aussparen will, dreht `ranked` auf 0 und setzt alles `manual`. Ein geplanter
`WinnerPack` für einen `Judge` läuft nicht hierüber, sondern über den
`JudgePool`.
_Avoid_: fix (heisst auf Englisch „reparieren"), WinnerAssignment, ManualPool (es ist kein `Pool`)

**WinnerRaffle**:
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
ist. Der Zusatz `Winner` gehört zum Namen, weil `Raffle` allein nicht sagt, was
verlost wird; die zwei Ableitungen tragen ihn nicht, weil sie niemand ausspricht.
Bedient wird sie über einen Griff auf dem `winner`-Eintrag der Legende über den
Kacheln — dem Schlüssel zu genau der Marke, die sie erzeugt —, der eine feste
Leiste über der Fussnavigation aufgehen lässt; die Leiste trägt Auslöser,
`RaffleRange`, die Ansage des letzten Treffers und die nach `Rank` sortierte
Rücknahmeliste. Sie schliesst nie von selbst, überlebt den Wechsel ins Vollbild
und deckt keine Kachel zu. Ein Treffer wird **flüchtig** markiert — das Raster
scrollt zu ihm, die Kachel hebt sich kurz heraus —, nie bleibend: eine bleibende
Marke wäre die Herkunft, die das Modell bewusst nicht führt. Die Ansage nennt
den `Rank` und trägt **keinen** Rückweg; zurückgenommen wird in der Liste oder an
der Kachel, also nur, indem man den `Rank` benennt. Das ist der Unterschied
zwischen Korrigieren und Neuwürfeln, und er trägt, weil es kein Undo gibt.
Der Auslöser heisst am Schirm `Raffle` — eine Kürzung des Terms und damit keine
Ersetzung, also ohne `_Label_`-Zeile; `Draw` ist unten ausgeschlossen.
_Avoid_: Shuffle (heisst im TCG das Mischen des eigenen Decks — und es benennt eine Reihenfolge, keinen Empfänger: ein gemischtes Deck hat niemanden gewinnen lassen), Draw (heisst im TCG das Ziehen einer Karte), Lottery (klingt nach Geld und Recht), Verlosung als Name für den Bereich

**RaffleRange**:
Der `Rank`-Bereich, aus dem eine `WinnerRaffle` zieht — dreizehn benannte Stufen über
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
Die `Rank`s, die bei einer `WinnerRaffle` wirklich im Topf liegen: die `RaffleRange`
abzüglich aller `Rank`s, die schon einen `WinnerPack` haben — `ranked` wie
`manual`. Dieser Ausschluss ist eine Invariante und kein Bedienelement, eine
Siegerkarte gewinnt niemand zweimal. Über `open` gebliebene `WinnerPack`s sagt er
nichts, weil sie keinen Empfänger haben. Er hängt am laufenden Zuteilstand und
kann leer sein, während die `RaffleRange` es nicht ist — genau dann ist die
`WinnerRaffle` nicht auslösbar, obwohl noch `WinnerPack`s offen sind. Er wird
**nicht als Zahl angezeigt**, und das ist Absicht: er beantwortet „wie viele",
während am Tisch „wo" gefragt ist, und das beantwortet die `RaffleRange`. Vor
dem ersten Wurf ist er ausserdem genau so gross wie sie, wiederholte also im
Moment des ersten Hinsehens nur die eben getroffene Wahl. Sichtbar wird allein
sein **leerer** Zustand, als Satz neben dem gesperrten Auslöser — sonst wäre das
ein toter Knopf ohne Grund.
_Avoid_: RafflePool (kein `Pool`, er verteilt nichts, sondern begrenzt die Empfängerwahl), RaffleGroup, Lostopf als Identifier

**DisplayReservation**:
Die Anzahl `Display`s, die ein einzelner `Rank` aus dem `RankPool` vorab
zugeteilt bekommt, bevor die `DistributionCurve` den Rest formt. Nach oben
begrenzt durch den `Rank` darüber, sodass sie über die Ränge nie steigt. Betrifft
nur `Booster`. Wird nie vorbelegt, weil sie einen `Rank` benennt (ADR 0003), und
nie automatisch gesetzt — der `CommunityLead` greift dafür an die Kachel des
`Rank`, wie bei den `manual`-`WinnerPack`s der `WinnerPackAllocation`.
**Abgegolten** sind alle Ränge oberhalb des obersten Gleichstands im Vektor: sie
bekommen genau ihre `Display`s und fallen aus der Kurve, die von dort abwärts
läuft. Bei `Rank` 1 heisst das, der Vorsprung aus ADR 0001 setzt aus und eine
Überholung wird gemeldet statt verhindert.
_Avoid_: Full-Display-Win, DisplayPrize, DisplayPool (es ist kein `Pool`, sondern eine Reservation innerhalb des `RankPool`)

**DistributionPlan**:
Das Ergebnis der Berechnung: wer aus diesem `Tournament` welche `PrizeItem`s
bekommt. Er umfasst **alle** Ränge bis zur Spielerzahl, nicht nur die von der
`RankPoolDepth` bedienten — der `RankCycle` und `manual`-`WinnerPack`s reichen
tiefer, eine bei der Tiefe abgeschnittene Darstellung würde Zuteilungen
verschlucken. `PrizeItem`s ohne Empfänger gehören zu ihm und stehen neben den
Rängen: der `JudgePool` und die `open`-`WinnerPack`s, damit die Summe über den
`PrizePool` prüfbar bleibt.
_Avoid_: Payout

**NoticeStack**:
Die Schicht, auf der alle Meldungen liegen — `ConflictNotice`, `Offer`,
`CarryOverNotice`. Sie schwebt **über der ganzen App**, nicht über dem
`DistributionPlan`: eine Meldung über die Herkunft der Eingabe passt in kein
plan-förmiges Loch, und im Plan verankert lag sie unter der Reglerfläche —
ausgerechnet dort, wo die Regler stehen, die den Konflikt auslösen. Sie
**deckt zu und schiebt nichts**.
Jede Meldung hat **zwei Zustände und keinen dazwischen**: *offen* mit Satz und
Wegen, oder *Chip* — eine kurze Pille in einer Farbe. Ein Chip steht **nie für
mehrere** Meldungen, und er öffnet nur: er nimmt nichts an und löst nichts aus.
Einklappen ist ein **Schrumpfen an Ort**: der Chip bleibt auf derselben Schicht
wie die offene Meldung, überlebt darum jeden Seitenwechsel und liegt nie unter
einer Seite. Ein Chip, der ins Seitenlayout einzieht, gehört einer Seite und ist
auf den übrigen weg — ausgerechnet dort, wo man an den auslösenden Reglern
dreht. Aus demselben Grund braucht er nicht beweglich zu sein: eine verschobene
Lage wäre Zustand, und den hat diese App nirgends.
Der Chip trägt ein **Wort und nach Möglichkeit eine Zahl** (`3 ways out`,
`2 kept`), kein Zeichen: ein Glyph beschreibt die Meldung und muss gedeutet
werden, während der Chip zum Antippen auffordern soll. Die Zahl ist dabei der
eigentliche Antrieb — sie sagt, wieviel dahinterliegt. Das `Offer` hat als
einziges keine, weil es immer genau eines ist.
Das ⚠ bleibt **neben** dem Wort der `ConflictNotice` und ist das einzige
Zeichen der Ecke: es trennt die Meldung, die gelöst werden **muss**, von den
zweien, die man wegklicken **darf** — dieselbe Achse wie das ✕.
**Alle beginnen offen.** Eine Meldung, die als Chip erscheint, wird ignoriert,
und ein Vorschlag, den niemand sieht, ist kein Vorschlag; das ✕ ist der Preis
dafür, laut anfangen zu dürfen. Unterschieden sind die drei allein durch
**Farbe und Resolve-Wege**, nie durch Form oder Anfangszustand.
Die **Ordnung bildet ab, wovon geredet wird**: die Meldung über den Plan sitzt
oben bei den Kacheln, die über die Eingabe unten bei den Reglern. Eine vierte
wäre nicht einzusortieren, sondern zu fragen, worüber sie redet.
Zwei Familien, und sie entscheiden, wann eine minimierte Meldung wieder
aufgeht — **Zustandsmeldung** (`ConflictNotice`, `Offer`): sie steht, solange
eine Bedingung gilt, und geht auf, wenn sich die **Art** ändert, nie wenn sich
nur Zahlen ändern; wer am genannten Regler zieht, soll nicht angesprungen
werden. **Ereignismeldung** (`CarryOverNotice`): jedes Auftreten ist ein neues
Ereignis, sie geht **immer** auf — und öffnet die stehenden Zustandsmeldungen
mit, weil unter ihnen gerade der Boden bewegt wurde.
Der Klappzustand ist reiner Sitzungszustand: nie im `SetupLink`, ein Neuladen
setzt alles auf offen. Minimieren ist schwächer als Wegklicken und kann darum
nicht länger überleben.
Der Bericht der `LinkMigration` gehört **nicht** dazu: er kommentiert das
Hereinkommen und nicht den Schirm, tritt einmal je Öffnen auf und wird zur
Kenntnis genommen statt minimiert.
_Avoid_: Toast, Alert, Banner, Snackbar

**ConflictNotice**:
Der Eintrag im `NoticeStack`, der einen unpassenden Reglerstand benennt und die
einzeln gangbaren Wege heraus zeigt, jeden mit einem Klick übernehmbar. Ein
`DistributionPlan` mit `ConflictNotice` ist ungültig, einer ohne gültig
(ADR 0002) — die Anwesenheit ist die Aussage, deshalb ist sie nicht wegklickbar.
Der seltene Fall. Sie **darf minimiert werden**: ADR 0002 verlangt Anwesenheit,
nicht Grösse, und die Anwesenheit sagen dann der Chip und die rot markierten
`Rank`-Kacheln. Die Markierung ist damit **tragend und keine Doppelung** — ohne
sie behauptete ein minimierter Konflikt einen gültigen Plan.
Sie kann nie zugleich mit einem `Offer` stehen: das eine setzt einen ungültigen
Plan voraus, das andere einen gültigen.
_Avoid_: Error, Warning (die Rechnung ist nie fehlgeschlagen), Validation

**Offer**:
Der Eintrag im `NoticeStack`, der auf einem vollständig **gültigen**
Plan eine rundere Fassung vorschlägt — heute allein die `DisplayReservation`,
wenn ein `Rank` höchstens eine Viertel-`Display`-Grösse von einem Vielfachen
davon entfernt liegt, in beide Richtungen. Steht in einer eigenen Fläche neben
der `ConflictNotice`, weil er der häufige Fall ist und eine Fläche, in der meist
Harmloses steht, keine Warnfläche mehr wäre. Wegklickbar, und das Wegklicken ist
reiner Sitzungszustand: nie im `SetupLink`, kein Überleben eines Neuladens,
zurück sobald sich der Inhalt des Vorschlags ändert.
**Wegklicken gilt diesem Angebot, Minimieren gilt der Fläche**: das Wegklicken
kennt den Vorschlag samt seinen Zahlen, das Minimieren nur die Art. Darum kommt
ein geändertes Angebot zurück, während ein minimiertes minimiert bleibt.
Sein **Versprechen ist örtlich, seine Wirkung nicht**: das Viertel-Fenster prüft
den genannten `Rank`, aber eine `DisplayReservation` gilt Ränge ab, und ein
abgegoltener `Rank` bekommt nur seine `Display`s — angenommen kann der Vorschlag
also einem anderen `Rank` mehr wegnehmen, als das Fenster je erlaubt hätte. Er
wird deshalb nicht enger gefasst, sondern **benennt die mitbewegten `Rank`s**
samt ihrer Zahlen: ein Vorschlag, den man nicht annehmen muss, darf teuer sein,
solange er seinen Preis nennt.
_Avoid_: Hint, Suggestion, Tip — die Wege aus der `ConflictNotice` sind auch
Vorschläge, und seit dem `NoticeStack` ist das kein blosser Vorbehalt mehr,
sondern ein herstellbarer Fall: beide Chips können nebeneinander in der Ecke
stehen, `⚠ 3 ways out` neben dem, was dann „Suggestion" hiesse.

**CarryOverNotice**:
Die Meldung nach einem Wechsel von `Game` oder `TournamentType`, die auflistet,
welche `pinned` Regler den Wechsel überstanden haben und darum nicht dem neuen
`DefaultSet` folgen. Sie kommentiert die **Herkunft der Eingabe**, nicht den
`DistributionPlan` — darin dem Bericht der `LinkMigration` verwandt und nicht der
`ConflictNotice`, die eine Aussage über den Plan macht. Sie ist die Ansage zu
einem Klick, der sichtbar wenig getan hat, und trägt deshalb den Weg mit: einen
Knopf, der alle auf das neue Blatt zieht. Dieser Knopf ist die **dritte
Reichweite** desselben Rückwegs und keine eigene Handlung — er lässt dieselben
Pins fallen wie der Knopf am `TournamentType`-Titel, Kachel-Zuteilungen
eingeschlossen, und fragt darum ebenso vorher nach. Wegklickbar und reiner
Sitzungszustand, nie im `SetupLink`; verschwindet sie ungenutzt, ist nichts
verloren, weil dieselbe Handlung dauerhaft am Regler (einzeln) und am
`TournamentType`-Titel (alle) steht.
Sie ist die einzige **Ereignismeldung** des `NoticeStack`: sie beschreibt keinen
anhaltenden Zustand, sondern den Klick, der gerade geschehen ist. Zweimal
hintereinander gewechselt heisst zweimal dieselbe Art, aber eine andere Liste
darunter — ein Zustandsschlüssel liesse sie minimiert stehen und behauptete,
das Neue sei gelesen.
Nichts tun ist bei ihr der **Normalfall und kein Notausgang**: der Wechsel hat
nichts von Hand Gesetztes überschrieben, die Pins stehen. Ein erzwungenes
Übernehmen wäre die Bestätigungsabfrage zurück, die der Nachtrag zu ADR 0003
ersatzlos gestrichen hat.
_Avoid_: Warning (es ist nichts schiefgegangen), ChangeLog, Diff

**CombinedHandout**:
Ob der `ParticipationPool` zusammen mit dem `RankPool` ausgeteilt wird oder
vorher. Ein Bit am `Tournament` und kein Rechenschritt: es verschiebt die
Teilnahmeanteile in die Rangzeilen des `DistributionPlan`, statt sie als eigenen
Block auszuweisen — dieselben Zahlen, anders gruppiert, und der Block
verschwindet dabei, damit kein `PrizeItem` zweimal auf dem Schirm steht. Steht
im Normalfall auf aus, weil die Teilnahmepreise meist beim Einchecken rausgehen.
Startwert im `DefaultSet`, weil eine Konstante keinen `Rank` benennt. Es ist der
einzige Ort, an dem ein Zeitpunkt im Modell überhaupt vorkommt — als ein Bit,
nicht als Achse: die App kennt kein `Ranking` als Eingabe, also wird kein Teil
des `DistributionPlan` später wahr als ein anderer.
_Avoid_: Zeitpunkt, PlanStage (es ist keine Achse, sondern ein Bit), MergedView

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
„ungeöffnet" und „zum Anbrechen", erhöht sie nie. Auf der `WinnerPack`-Achse
teilt sie ebenso: weicht die Zahl vorhandener `WinnerPack`s von der Ausbeute der
`PromoEnvelope`s ab, steht die Differenz als Halbsatz an der Ausbeute-Zeile — in
beide Richtungen, als Herkunftsangabe und nicht als zweiter Hinweis. Kein Zustand und kein
Bedienmodus, sondern eine Ableitung, die schon vollständig ist, bevor es ein
`Ranking` gibt.
_Label_: **Prepare** — das Wort bietet eine Handlung an („was muss ich
vorbereiten?") statt einen Gegenstand zu benennen. *Preparation* wäre
deckungsgleich, liest sich aber wie eine Überschrift; *List* ist am Schirm
ohnehin falsch, weil die Sicht kein Verzeichnis ist. Erste gezogene
`_Label_`-Zeile seit der Regel aus #27. Es ist seit #36 der Name einer der drei
Seiten, nicht mehr der eines Griffs — an der Begründung ändert das nichts.
_Avoid_: Einkaufsliste (klingt nach Geld), ShoppingList, Vorbereitungsmodus (es ist kein Zustand)

## Turnier und Personen

**Tournament**:
Ein einzelnes Turnier — die Einheit, für die genau ein `DistributionPlan`
entsteht.

**Game**:
Das TCG, für das ein `Tournament` läuft, und Träger eines **vollständigen**
Blatts Startwerte: jede Variable, die überhaupt vorbelegt werden kann, hat auf
dieser Ebene einen Wert — die **erwartete Spielerzahl** eingeschlossen, denn sie
benennt keinen `Rank` und unterscheidet sich zwischen Spielen wie zwischen
Turniertypen. Ein unvollständiges `Game` ist ein Fehler und kein
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
`DefaultSet`, **überschreibt aber nichts von Hand Gesetztes**: nicht `pinned`
Regler folgen dem neuen Blatt, `pinned` Regler bleiben stehen, und der
`CarryOverNotice` sagt, welche. Ein
`SetupLink` legt sich als dritte Ebene darüber — er trägt keine Startwerte,
sondern setzt die Regler, die er nennt, auf `pinned`.
_Avoid_: Preset (Oberflächensprache), Config, Profile, Defaults (allein)

**Pinned**:
Der Zustand eines Reglers, den der `CommunityLead` selbst gesetzt hat: er folgt
keiner Rechnung mehr, steht im `SetupLink` und ist in der Oberfläche markiert.
Gesetzt wird er durch die **Bedienhandlung**, nicht durch den Wert — wer einen
Regler verstellt und wieder auf den Ausgangswert zurückzieht, hat entschieden und
lässt ihn `pinned`. Aufgehoben wird er auf genau zwei Wegen, und beide sind ein
bewusster Griff: der Knopf neben dem Regler stellt **einen** auf das `DefaultSet`
zurück, der Knopf neben dem `TournamentType`-Titel **alle**, und derselbe Weg in
voller Reichweite steht momentan im `CarryOverNotice`. Ein Wechsel von
`Game` oder `TournamentType` hebt ihn nicht auf. Die beiden **vollen**
Reichweiten fragen vorher nach — eine kleine, am Knopf verankerte Blase mit
Bestätigen und Ablehnen, samt Zahl dessen, was fällt; die einzelne fragt nicht,
denn dort steht ein sichtbarer Wert, der mit einem Griff wieder gesetzt ist. Die
Rückfrage hängt an der **Handlung**, nicht am Ort, und bleibt: ein sitzungsweites
Undo, das sie überflüssig gemacht hätte, kommt nicht (ADR 0006). Die Markierung sagt deshalb „folgt der Rechnung nicht
mehr", nicht „weicht ab": beides fällt meist zusammen, aber ein `pinned` Regler
darf denselben Wert tragen wie sein Default. Der Zustand gilt für alle Regler
gleich, auch wenn er nur bei den vieren beisst, deren Startwert eine Rechnung
statt einer Zahl ist — `RankPoolDepth`, die absolute `TournamentPack`-Zahl, die
Zahl vorhandener `WinnerPack`s und der `ranked`-Anteil der
`WinnerPackAllocation`. Ein `pinned` Wert wird nie
nachträglich gekappt: sinkt ein Deckel unter ihn, bleibt er stehen und die App
zeigt die Lage (ADR 0002). Das Gegenteil heisst **`auto`** — der Regler folgt
noch einer Rechnung. Beide Wörter stehen so auch am Schirm.
_Avoid_: Override (behauptet die Abweichung, die gerade nicht definierend ist), Touched (beschreibt die Geste, nicht den Zustand), Locked (klingt nach Schutz vor dem Nutzer), Dirty, Manual (ist schon der `manual`-Anteil der `WinnerPackAllocation` — dasselbe Wort für zwei Sachen auf demselben Schirm)

**SetupLink**:
Die verschickbare Fassung eines eingestellten `Tournament`: die URL, die alle
`pinned` Regler trägt — die neutral startenden eingeschlossen, also auch die
`DisplayReservation` und den `manual`-Anteil der `WinnerPackAllocation` (ADR
0006). Dritte Ebene der Kette `Game` → `TournamentType` →
`SetupLink`, und wie die zweite trägt sie **nur den Unterschied** — was sie nicht
nennt, ist nicht `pinned` und zieht mit der Spielerzahl nach. Ein Bit je Regler
genügt dafür, weil der Wert selbst die Aussage ist; dass die genannten Regler
meist auch abweichen, ist Folge und nicht Definition. Sie schreibt sich beim Ziehen
mit, ohne Browser-Historie zu erzeugen; Neuladen ändert nichts. Eingabe, nicht
Persistenz: die App schreibt nichts weg, sie liest einen Link — Accounts, Storage
und Caching bleiben ausgeschlossen.
Sie wird als **Lesezeichen** abgelegt und Monate später wieder geöffnet, also ist
ihre Kodierung eine Schnittstelle: sie trägt eine **Formatversion**, und was nicht
mehr passt, richtet eine `LinkMigration`. `Game` und `TournamentType` stehen darin
als **stabiler Name**, nie als Position — die Reihenfolge der `TournamentType`-Liste
ist bedeutungstragend und darf sich ändern. Ein Wert aus dem Link ist ein `pinned`
Wert wie jeder andere: liegt er über einem Deckel, bleibt er stehen und die
`ConflictNotice` zeigt die Wege heraus. Die App führt nicht mit, dass er aus einer
URL kam.
_Avoid_: Preset (Oberflächensprache, siehe `DefaultSet`), Permalink, State, Snapshot (sie trägt keinen vollständigen Zustand, nur die Abweichungen)

**LinkMigration**:
Die Umschreibregel, die einen `SetupLink` einer älteren Formatversion auf die
heutige hebt — eine je Erhöhung, vom Maintainer geschrieben. Ihr Vertrag ist, das
**Ergebnis** zu erhalten und nicht die Werte: sie darf Regler setzen, die im alten
Link nie standen, solange der `DistributionPlan` möglichst derselbe bleibt.
Mechanisch erfunden wird dabei nichts — wo ein Regler ersatzlos verschwunden ist
und die Kette keinen Nachfolger nennt, fällt der Wert weg, statt dass ein
ausgedachter als `pinned` eine Entscheidung behauptet, die nie jemand getroffen
hat. Beim Öffnen läuft die Kette hoch und der migrierte Stand gilt sofort; die
Adresszeile schreibt sich als heutige Version mit, und ein einmaliges Overlay
berichtet, was umgeschrieben und was weggefallen ist, samt der Aufforderung, das
Lesezeichen zu erneuern. Es liegt über allem statt in der Reihe unter dem Plan,
weil es nicht den Plan kommentiert, sondern die Herkunft der Eingabe — wegklickbar,
nie im `SetupLink`, und nur da, wenn die Kette tatsächlich gelaufen ist.
_Avoid_: Upgrade, Konvertierung, Kompatibilitätsmodus (es gibt keinen zweiten Lesemodus, nur einen Weg nach vorn)

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
