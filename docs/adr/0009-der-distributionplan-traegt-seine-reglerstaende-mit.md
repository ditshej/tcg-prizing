# Der `DistributionPlan` trägt seine Reglerstände mit

Die Wege heraus (`suggestions()`, #59) und das Angebot (`offerFor()`, #60)
entstehen beide gleich: einen Regler auf einen anderen Wert stellen und die
ganze Verteilung noch einmal durchrechnen. Dafür braucht jede Proberechnung
**alle** Reglerstände. Der fertige Plan trägt davon **vier von neunzehn**.

Drei Dokumente schreiben trotzdem `suggestions(plan)` — #46, #61 (zweimal) und
#68 —, und mit dieser Signatur ist die vorgeschriebene Suche **nicht baubar**:
der erste Regler, den sie durchgeht, ist die `DistributionCurve`, und die steht
im Plan nicht drin. Gebaut ist deshalb die Fassung, die die Reglerstände nimmt.

Entschieden ist: **der Plan bekommt seine Eingabe angehängt**, als ein einziges
Feld, das die Reglerstände als Ganzes trägt. Nicht fünfzehn Kopien einzelner
Werte, sondern die Eingabe selbst — damit kann nichts darin dem Plan
widersprechen. Die Signatur `suggestions(plan)` wird damit wahr statt
nachgezogen, und jede Stelle, die einen Plan in der Hand hält, kann die Wege
heraus selbst nachrechnen, ohne etwas mitzuführen.

## Considered Options

**Die Funktion nimmt die Reglerstände, die Prosa wird nachgezogen.** Der
Rechenkern bliebe unberührt; es änderte sich eine Zeile in #46, eine in #68 und
zwei in #61. Verworfen, weil damit jede Stelle, die Wege heraus will, die
Reglerstände **neben** dem Plan mitführen muss — und weil die Spec an vier
Stellen unabhängig voneinander dasselbe geschrieben hat: dass der Plan die
Antwort auf „was ist hier los" sein soll. Die Oberfläche hat die Reglerstände
heute zwar ohnehin (#61 ruft `distribute(settings)` selbst auf), aber damit ist
die Bedingung auf die Aufrufer verteilt statt an einer Stelle gehalten.

**Beides übergeben.** Zwei Quellen für dieselbe Wahrheit, die auseinanderlaufen
können. Nicht weiter verfolgt.

## Consequences

- **Ein Plan ist nicht mehr nur das Ergebnis**, er trägt seine Eingabe mit sich.
  Das ist der Preis, und er ist bewusst bezahlt: die Alternative war, dieselbe
  Eingabe an jeder Aufrufstelle von Hand danebenzulegen.
- **Es ändert `distribute()` im Rechenkern.** Der Lauf #49·#59·#58 hat den Kern
  bewusst nicht angefasst, also ist das **ein eigenes Ticket mit eigenem Zweig**
  (#86) und kein Nachtrag in jenem Stapel. Wächter der Änderung ist die
  Summenprobe aus #58.
- **Die Prosa wird trotzdem nachgezogen, nur andersherum:** `suggestions(plan)`
  und `offerFor(plan)` bleiben in #46, #61 und #68 wörtlich stehen und werden
  richtig, sobald #86 gebaut ist. Bis dahin sagt die Spec etwas, das der Code
  noch nicht tut — das ist in #86 und an den drei Tickets vermerkt.
- **Dieselbe Antwort gilt für `offerFor()`.** #61 nennt die beiden „blosse
  Wiederaufrufer desselben Kerns"; #60 baut das Angebot als nächstes und findet
  die Signatur dann gültig vor.
- **Nicht mitentschieden ist der Abschnitt drumherum.** #46 `## suggestions(plan)`
  führt `unfit` noch mit **drei** Fällen; der Kern kennt seit #56 **vier**
  (`unclaimedRemainder` kam dazu). Wer den Abschnitt als Vorlage nimmt, baut
  zwei Dinge falsch. Der Abschnitt wird darum **ganz** nachgezogen, nicht nur
  die Signaturzeile.
- **ADR 0002 bleibt tragend.** Dass die Suche überhaupt rechnen kann, liegt an
  der Totalität; dass sie den Plan als Eingang nehmen darf, liegt an diesem
  Entscheid. Die Feststellung dort, `distribute()` führe „keinen Zustand mit
  sich", bleibt wahr: der Plan trägt die Eingabe, nicht die Funktion.
