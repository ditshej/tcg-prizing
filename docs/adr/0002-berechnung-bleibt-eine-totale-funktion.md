# Die Berechnung bleibt eine totale Funktion

Ergänzt durch ADR-0009.

Für widersprüchliche Reglerstände — etwa eine `RankPoolDepth`, die unter die
bereits gesetzten `DisplayReservation`s gesenkt wurde — war ursprünglich
festgelegt, dass gar kein `DistributionPlan` entsteht und an der Stelle der
Tabelle nur die Warnung steht. Das kehren wir um: Die App rechnet den
widersprüchlichen Zustand durch, zeigt das Ergebnis und stellt die Meldung
darüber. Ein Fehler, den man nicht sehen kann, lässt sich nicht beheben.

## Considered Options

**Ergebnis verweigern.** Die Rechnung wäre eine partielle Funktion, und ein
ungültiger Zustand könnte niemals als gültiger Plan missverstanden werden. Das
war die ursprüngliche Festlegung, und für die damals bekannten Konflikte trug sie
auch: Ein `RankPool`, der für die eingestellte Tiefe zu klein ist, ist an einer
Zahl abzulesen und braucht keine Tabelle zur Erklärung.

Gekippt hat sie die `DisplayReservation`. Deren zweiter Konfliktfall ist die
Überholung: `Rank` 1 ist durch seine `Display`s abgegolten und fällt aus der
`DistributionCurve`, worauf der geformte Rest `Rank` 2 über ihn heben kann. Wie
knapp oder wie krass das ausfällt, steht in keinem Regler — es steht nur im
Plan. Ohne die Zahlen weiss der Lead nicht, ob ein `Display` mehr, ein `Rank`
mehr oder eine andere Kurve der richtige Griff ist. Ausgerechnet der Zustand mit
der grössten Erklärungsnot wäre der einzige gewesen, den man nicht ansehen kann.

## Consequences

Jede Eingabekombination liefert ein Ergebnis; es gibt keine Definitionslücke im
Projekt. Die Zusicherungen aus ADR 0001 sind damit **nicht** garantiert — der
gezeigte Plan kann `Rank` 2 vor `Rank` 1 setzen. Was einen Plan gültig macht,
ist keine Eigenschaft der Rechnung mehr, sondern eine eigene Aussage daneben:
Der Plan trägt die Meldung, die den Widerspruch benennt und die Wege heraus
zeigt. Ein Plan ohne Meldung ist gültig, ein Plan mit Meldung ist es nicht — und
beide sind sichtbar.

Die Reglergrenzen bleiben davon unberührt: Sie verhindern weiterhin, dass solche
Zustände durch die Eingabe *entstehen*. Erreichbar sind sie nur noch dadurch,
dass ein zweiter Regler einen bereits gesetzten Wert nachträglich ungültig macht.

Nachtrag: Die Totalität ist nicht nur eine Anzeigefrage — sie ist die Bedingung
dafür, dass die Meldung **Vorschläge rechnen** kann. Weil `distribute()` für jede
Eingabekombination ein Ergebnis liefert und keinen Zustand mit sich führt, lässt
sich jeder Ausweg zurückrechnen: einen Regler über seinen Bereich variieren, die
Rechnung je Wert neu laufen lassen, den nächstliegenden Wert nehmen, der die
Bedingung räumt. Das sind einige hundert Durchläufe einer Funktion ohne
DOM-Berührung und im Browser nicht messbar. Eine partielle Funktion könnte das
nicht: Sie gäbe für Kandidatenwerte „kein Plan" zurück, ohne dass sich sagen
liesse, ob das besser oder schlechter ist als der Ausgangszustand.

Dasselbe Verfahren deckt drei Fälle ab, die vorher wie drei Mechanismen aussahen:
den Widerspruch zweier `pinned` Regler, die Überholung ohne Verlierer, und die
verpasste Gelegenheit (den `WinnerPack`-Hinweis, wo die `TournamentPack`-Zahl
nach oben variiert wird, bis die Schwelle fällt). Beispiel für den zweiten Fall,
Weekend mit 96 `Booster` im `RankPool`, `DisplayReservation` 1 `Display` für
`Rank` 1, Tiefe 8, `RankFloor` 2, Kurve `severe`: `Rank` 1 hat 24, `Rank` 2
bekommt 40. Zurückgerechnet sind es drei Wege — Kurve auf `moderate` (`Rank` 2
fällt auf 23), Reservation auf 2 `Display`s (`Rank` 1 auf 48), oder Reservation
entfernen, womit `Rank` 1 in die Kurve zurückkehrt und die Überholung strukturell
unmöglich wird.

Nachtrag: Die Fläche unter dem Plan trägt **zwei Sorten** Eintrag, und der Satz
oben — „ein Plan ohne Meldung ist gültig, ein Plan mit Meldung ist es nicht" —
bleibt wörtlich gültig, weil nur die eine Sorte eine Meldung ist.

Eine **Konfliktmeldung** benennt einen unpassenden Plan und die Wege heraus; der
Lead *muss* etwas tun, und sie ist nicht wegklickbar. Ein **Angebot** steht auf
einem vollständig gültigen Plan und schlägt bloss eine runde Sache vor; der Lead
*darf*, und es ist wegklickbar. Der erste Vertreter der zweiten Sorte ist der
`DisplayReservation`-Vorschlag: liegt ein `Rank` höchstens eine Viertel-`Display`
-Grösse von einem Vielfachen davon entfernt, wird dieses Vielfache angeboten —
in beide Richtungen, sodass die Fläche stumm bleibt, wenn eine Zuteilung mitten
zwischen zwei `Display`s liegt. Angeboten wird ein ganzer Vektor, über das
laufende Minimum geklemmt, damit `d₁ ≥ d₂ ≥ …` nicht durch einen stummen `Rank`
zwischen zwei redenden verletzt wird.

Getrennt sind die beiden Flächen, weil das Angebot der **häufige** Fall ist und
der Konflikt der seltene. In einer gemeinsamen Fläche lernt der Lead, sie zu
überfliegen — und dann geht die eine Sorte unter, die wirklich zählt. Das
Wegklicken ist reiner Sitzungszustand: es gehört nicht in den `SetupLink` (der
nach ADR 0005 nur `pinned` Regler trägt, sonst käme ein verschickter Link mit
unterdrückten Hinweisen an), es überlebt kein Neuladen, und das Angebot kehrt
zurück, sobald sich sein Inhalt ändert — aus „1 `Display`" ein „2" wird, also
ein anderes Angebot.

Variiert wird dabei **immer nur ein Regler**. Zwei gleichzeitig wären ein Produkt
statt einer Summe, vor allem aber unlesbar: „Kurve auf `moderate` *und* Tiefe auf
11" ist kein Vorschlag, den jemand abwägt. Die Meldung zeigt alle einzeln
gangbaren Wege, geordnet nach der Vorrangkette aus ADR 0001, und jeder ist mit
einem Klick übernehmbar — was den betroffenen Regler `pinned` setzt (ADR 0006).
Der Sonderfall ist der Vorschlag „Regler X zurück auf automatisch": er *ist* der
Reset-Knopf und entfernt den Pin, statt einen zu setzen.

Nachtrag (#56): Ein vierter Fall reiht sich ohne neue Mechanik ein — eine
`DisplayReservation`, die genau bis zur Tiefe reicht, lässt der
`DistributionCurve` keinen `Rank` mehr, an den der `ShapedRemainder` gehen
könnte. Auch das wird durchgerechnet und als `unclaimedRemainder` daneben
gemeldet, statt den Überschuss stillschweigend zu verschlucken oder ihn
irgendeinem `Rank` aufzudrängen, der ihn nie verlangt hat. Derselbe Satz wie
oben trägt weiterhin: der Plan bleibt gültig oder wird als ungültig gemeldet,
nie verweigert.

Nachtrag (Lauf #49·#59·#58, 2026-09-27): **Wenn kein einzelner Regler räumt.**
Der Satz oben — „Variiert wird dabei immer nur ein Regler" — beschreibt, wie
gesucht wird, und er bleibt die Regel. Er sagt nichts darüber, was geschieht,
wenn die Suche **nichts findet**, und das ist nicht der Rand: über echte
`SetupLink`s gemessen haben **775 von 1 441** gewarnten Ständen keinen einzeln
gangbaren Weg. Für diese Stände bleibt die Fläche unter der Meldung nicht leer
und bekommt auch keinen erklärenden Satz („kein einzelner Regler räumt das"),
sondern einen **gerechneten Weg über mehrere Regler zugleich**, mit einem Klick
übernehmbar. Das ist keine neue Mechanik: #70 schreibt diese Bauart für den
`WinnerPack`-Überhang bereits vor, und ein solcher Weg ist ebenso ein `WayOut`
wie der einzelne. Die Rangfolge bleibt: gibt es einen einzeln gangbaren Weg,
steht er allein da — der mehrgliedrige ist der Fall, in dem es sonst gar nichts
gäbe, und genau darum wiegt seine Unlesbarkeit dort weniger als die leere
Fläche. Gebaut wird er in **#68** (die Warnfläche) und **#70** (die Formel).

> ⚠︎ **Teilweise zurückgezogen durch `Nachtrag (Lauf 12, K2)`.** Wo auch
> **kein mehrgliedriger** Weg räumt — gemessen genau bei `boosterRate` 0 —,
> bekommt die Meldung keinen Knopf, sondern **einen Satz zur Tatsache** des
> Abends, und ihr Chip trägt ein Wort statt der Null. Weiterlesen dort, bevor du
> dich auf diesen Absatz stützt.

Offen mitgeschleppt und hier festgehalten, damit es die nächste Sitzung nicht
wieder herleitet: `conflictBox()` im Prototyp (`cockpit.prototype.html`) kennt
nur `conflict` und `overtake` und hat für die **verwaiste Reservation** und den
**unbeanspruchten Rest** gar keinen Satz — 135 der gemessenen Stände sind genau
das. Wer #68 baut, findet dort also keine Vorlage und muss zwei Sätze neu
formulieren; das ist eine Lücke im Prototyp, kein Entscheid dagegen.

Nachtrag (Lauf 12, K2): **Wenn gar kein Regler räumt.** Der Nachtrag oben ging
davon aus, dass der mehrgliedrige Weg der Fall ist, „in dem es sonst gar nichts
gäbe" — dass also immer **irgendein** Weg dasteht. Das stimmt nicht: der
Prüfstand aus K1 (`boosterRate` 0, `rankFloor` 2, `depth` 3) hat **keinen**, und
kein Regler, den die App vorschlagen darf, schafft einen. Ohne Booster pro Person
ist der `PrizePool` ohne Booster und damit der `RankPool` leer, gleich was
`rankFloor`, `depth`, Kurve oder Reservation sagen; ändern liesse es nur
`boosterRate`, und das ist eine Tatsache über den Abend, nie ein Weg heraus.
Entschieden (Kommentar an #68, Lauf 12, gewählt `satz-zur-tatsache`): steht eine
`ConflictNotice` **ohne jeden Weg heraus** da, sagt sie in **einem Satz**, dass
ohne `Boosters per player (pool)` nichts zu verteilen ist, und zeigt **keinen
Knopf**; ihr Chip trägt **ein Wort ohne Zahl** — `⚠ 0 ways out` kündigte etwas
an, das es nicht gibt. Verworfen wurde `wie-prototyp` (Konfliktsatz, keine
Knöpfe, Chip `⚠ 0 ways out`).

Das ist **nicht** der erklärende Satz, den der Nachtrag oben verwirft. Jener
hätte das Fehlen eines **einzelnen** Wegs erklärt, wo ein kombinierter besteht;
dieser steht nur, wo es **gar keinen** gibt, und er erklärt kein Fehlen, sondern
nennt die Tatsache, die den `RankPool` leert. Gemessen: in B3 über 15 360 Stände
(Kurve fest) sind die Stände ohne jeden Weg **genau** die mit `boosterRate` 0
(3 072); die Rasterprobe in `test/ui-notices.test.mjs` variiert zusätzlich die
Kurve und findet über 12 096 Stände dasselbe — 3 024 ohne Weg, alle und nur bei
`boosterRate` 0. Taucht je ein Stand mit `boosterRate` > 0 ohne Weg auf, ist
**das** der Befund; ein zweiter Satz dafür ist nicht vorgesehen. Der Wortlaut
von Satz und Chip-Wort ist ein Vorschlag des Builders (PR #118) und noch nicht
entschieden.

Bewusst so entschieden (Entscheid 3 im Kommentar „Drei Entscheide aus der
Fragebogenrunde" an #56, 2026-09-27): `conflict` (eine Tiefe über dem Deckel oder
eine Reservation, die den `RankPool` allein übersteigt) und
`unclaimedRemainder` schliessen einander **nicht** aus — eine randabdeckende
Reservation, die zugleich grösser ist als der `RankPool`, erfüllt beide
Bedingungen zugleich, und beide Meldungen stehen dann nebeneinander. Ein Plan,
der zwei widersprüchliche Tatsachen trägt, verliert keine davon nur, weil eine
zweite auch noch gilt — das wäre genau das stille Verschlucken, gegen das diese
ADR geschrieben ist. Ob der `NoticeStack` daraus eine gemeinsame oder zwei
getrennte Flächen macht, ist eine Frage für Spec 2, keine Frage an die
Rechnung.
