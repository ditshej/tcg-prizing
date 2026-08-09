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
