# Defaults in zwei Ebenen, mit vollständigem `Game`

Die Startwerte aller Regler kommen aus einem `DefaultSet`, das aus zwei
verschachtelten Ebenen entsteht: Das `Game` trägt ein **vollständiges** Blatt
über alle vorbelegbaren Variablen, der gewählte `TournamentType` trägt nur seine
**Abweichungen** davon. Was ein `TournamentType` nicht nennt, erbt er. Der erste
`TournamentType` einer Liste ist die Startwahl und trägt ausser dem Titel nichts
— seine Werte sind die `Game`-Werte.

## Considered Options

**Disjunkte Ebenen.** Jede Variable hätte genau einen Wohnort: das `Game` trüge
die physischen Fakten (`Display`-Grösse, `PackEnvelope`-Grösse, welche
`PrizeItem`-Typen es gibt), der `TournamentType` die Eventfakten (Spielerzahl,
Raten, `DistributionCurve`, `RankPoolDepth`). Der Reiz war, dass es dann keine
Vorrangregel braucht, weil sich die Ebenen nie in die Quere kommen — dasselbe
Muster, mit dem die Regler-Obergrenzen aus der Summenregel eine Eigenschaft der
Eingabe statt einer Prüfung gemacht haben.

Das scheitert an einem Fakt, der schon festgehalten war: Die
`PackEnvelope`-Grösse wechselt ausdrücklich *innerhalb* desselben `Game` von
Event zu Event. Sie ist nach jeder vernünftigen Lesart eine physische Tatsache
und müsste also am `Game` hängen — genau dort, wo sie nicht bleiben kann. Ein
Modell, das schon beim ersten bekannten Beispiel eine Ausnahme braucht, ist
keins.

**Zwei vollständige Ebenen.** Auch der `TournamentType` nennt jede Variable.
Damit wäre jedes Blatt für sich lesbar, ohne dass man das `Game` daneben legen
muss. Verworfen, weil die beiden ersten echten Sets — Weekly und Wochenendturnier
für One Piece — sich in **zwei** von dreizehn Werten unterscheiden. Elf Zeilen
Wiederholung pro Typ heisst, dass eine Änderung an einer gemeinsamen Zahl an
jeder Stelle nachgezogen werden muss und irgendwann an einer vergessen wird.

## Consequences

**Der Rückfall zeigt nie ins Leere**, weil das `Game` vollständig ist. Diese
Vollständigkeit ist die tragende Zusicherung des Modells und wird deshalb durch
einen Test gesichert: Ein unvollständiges `Game` ist ein Fehler beim Entwickeln,
kein zur Laufzeit abgefederter Zustand mit stillem Rückfall auf 0.

**Das `Game`-Blatt ist keine neutrale Grundlinie**, sondern trägt die Werte des
häufigsten Falls — desjenigen `TournamentType`, der zuoberst steht. Wer die
Weekly-Kurve ändern will, editiert das `Game`, nicht den Weekly-Eintrag. Der
Gewinn ist, dass es keinen Leerzustand „kein Typ gewählt" und keinen Pseudo-Typ
„frei" gibt: Das leere Blatt ist ein gewöhnliches Blatt, kein zweiter Codepfad.
Der Preis ist, dass die **Reihenfolge der Liste bedeutungstragend** ist — eine
Sortierung für die Oberfläche muss eine eigene Angabe sein, sonst wandert
versehentlich das leere Blatt.

**Ein Set-Eintrag trägt Daten, nie Logik.** Drei Defaults sind Formeln über der
Spielerzahl statt Zahlen; sie leben als benannte Regeln im Rechenkern, und das
Set wählt bloss eine davon aus. Sonst bräuchte die Default-Datei einen
Interpreter, und ein Tippfehler dort brächte die Rechnung zu Fall statt nur den
Startwert.

**Ein Set belegt nie etwas vor, das einen `Rank` benennt.** Die
`DisplayReservation` und der `manual`-Anteil der `WinnerPackAllocation` starten
immer neutral — ein vorbelegter Empfänger wäre eine Zuteilung, die niemand
entschieden hat.

**Ein Wechsel ersetzt das ganze `DefaultSet`** und löscht die angefasst-Zustände.
Zöge nur die Hälfte nach, wäre der sichtbare Stand eine Mischung aus zwei Sets,
und die angefasst-Anzeige aus ADR 0001 würde über ihre eigene Bezugsgrösse lügen.
Weil dabei Handarbeit verloren geht, verlangt der Wechsel eine Bestätigung —
aber nur, wenn tatsächlich schon etwas angefasst war.
