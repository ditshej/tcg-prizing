# Die Berechnung bleibt eine totale Funktion

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
