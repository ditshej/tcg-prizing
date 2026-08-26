# Der Pin ist ein gespeicherter Zustand, kein Vergleich

Ein Regler, den der `CommunityLead` gesetzt hat, folgt keiner Rechnung mehr — er
ist `pinned`. Dieser Zustand wird bei der **Bedienhandlung gesetzt und
gespeichert**, nicht bei jedem Neuzeichnen aus einem Vergleich „Wert ≠ Default"
abgeleitet. Wer einen Regler verstellt und wieder auf den Ausgangswert
zurückzieht, lässt ihn damit `pinned`; zurück auf „folgt der Rechnung" führt
allein ein Knopf neben dem Regler.

ADR 0003 hatte festgelegt, dass „abweichend" und „angefasst" **ein** Bit sind,
und ADR 0005 hat daraus den `SetupLink` gebaut. Das bleibt richtig — es ist ein
Bit je Regler —, aber die Gleichsetzung war zu stark: die `pinned` Regler sind
eine **Obermenge** der abweichenden.

## Considered Options

**Abgeleitet: `pinned` heisst „Wert ≠ heutiger Default-Wert".** Der Reiz ist
Zustandsfreiheit — nichts zu speichern, der `SetupLink` *ist* der Zustand, und der
Rückweg wäre gratis, weil ein Regler auf dem Default-Wert von selbst wieder
nachzöge. Zwei Dinge sprechen dagegen.

- **Der Vergleichswert steht nicht still.** Bei den drei Reglern, bei denen das
  Bit überhaupt arbeitet, ist der Startwert eine Rechnung: `RankPoolDepth` steht
  auf `min(Stufe, Deckel)`, die absolute `TournamentPack`-Zahl auf der
  Spielerzahl, der `ranked`-Anteil auf ⌊n/2⌋+1 der vorhandenen `WinnerPack`s.
  Liefert die Stufe 11 und der Deckel erlaubt 10, zeigt ein nie berührter Regler
  10 — und wäre nach dieser Lesart „abweichend". Das Bit flackerte an einem Wert,
  den andere Regler bewegen.
- **Absicht und Koinzidenz fallen zusammen.** „Ich will das obere Drittel" und
  „ich will 11" sind verschiedene Bestellungen, die bei 32 Spielenden zufällig
  dieselbe Zahl ergeben. Nur der gespeicherte Zustand hält sie auseinander,
  sobald sich die Spielerzahl ändert.

**Zwei Bits: Wert plus „angefasst".** ADR 0005 hat das bereits als redundant
verworfen, und das gilt weiterhin. Der hier gewählte Weg fügt kein zweites Bit
hinzu — er entscheidet nur, **wodurch** das eine Bit gesetzt und gelöscht wird.

**Kappen statt stehen lassen.** Für den Fall, dass ein Deckel unter einen
`pinned` Wert sinkt, wäre das Zurechtstutzen die stillere Lösung. Sie scheitert
an ADR 0002 und an sich selbst: Entweder der ursprüngliche Handwert wird für den
Rückweg aufbewahrt — dann ist er das zweite Bit, das ADR 0003 ausgeschlossen hat
— oder er ist weg, und der Lead verliert eine Eingabe, die er nie
zurückgenommen hat.

## Consequences

**Der `SetupLink` trägt die `pinned` Regler, nicht die abweichenden.** Ein
Regler kann im Link stehen mit demselben Wert, den der Default ohnehin liefert.
Das ist keine Redundanz, sondern die Aussage „dieser Wert ist festgelegt" — bei
einem Empfänger mit anderer Spielerzahl wird der Unterschied sichtbar. Die
Formulierung in ADR 0005, die URL trage „ausschliesslich die Abweichungen", ist
entsprechend als „ausschliesslich die `pinned` Regler" zu lesen.

**Der Zustand braucht zwei Bedienelemente.** Eine **Markierung** am Regler, sonst
ist der Pin unsichtbar und der Lead wundert sich, warum nichts mehr nachzieht;
und einen **Knopf** daneben, der auf das `DefaultSet` zurückstellt. Ohne den
Knopf gäbe es keinen Rückweg ausser dem Wechsel von `Game` oder
`TournamentType`, der alles auf einmal zurücksetzt. Die Markierung bedeutet
„folgt der Rechnung nicht mehr" und nicht „weicht ab" — sie steht auch dann,
wenn der Wert mit dem Default übereinstimmt.

**Die Regel gilt für alle Regler gleich**, obwohl sie nur bei dreien Arbeit tut.
Bei Reglern mit konstantem Default und bei den neutral startenden
(`DisplayReservation`, `manual`) ist der Pin ohne Wirkung auf die Rechnung und
verlängert nur den Link. Eine Ausnahmeliste wäre teurer als dieser Eintrag: sie
müsste im Kopf des Lesers und im Code mitgeführt werden, und der `SetupLink`
bliebe nicht mehr wörtlich „diese Regler sind festgelegt".

**Es gibt keine Bedienhistorie.** Der Pin ist eine Menge, keine Reihenfolge. Wo
zwei `pinned` Regler sich widersprechen, kann die Meldung deshalb nicht auf den
„zuletzt bewegten" zeigen — beim Öffnen eines geschickten `SetupLink` gibt es
keinen. Benannt wird der Verlierer der Vorrangkette aus ADR 0001
(`RankFloor` → `RankPoolDepth` → `DisplayReservation`), was aus dem Zustand
allein ableitbar ist und im geöffneten Link genauso trägt wie beim Schrauben.

## Nachtrag (#26): der Rückweg hat zwei Reichweiten, der Wechsel ist keine

Der Satz „ohne den Knopf gäbe es keinen Rückweg ausser dem Wechsel von `Game`
oder `TournamentType`, der alles auf einmal zurücksetzt" ist überholt: der
Wechsel setzt seit dem Nachtrag zu ADR 0003 **nichts** mehr zurück. An seine
Stelle tritt ein zweiter Knopf neben dem `TournamentType`-Titel, der alle Pins
auf einmal auf das gewählte Set zurückstellt — dieselbe Handlung wie der Knopf am
Regler, nur mit voller Reichweite. Er reicht über sämtliche Pins einschliesslich
der Kachel-Zuteilungen, hält aber bei `Game` und `TournamentType` an: er stellt
den Schirm auf den gewählten Typ zurück, er wählt ihn nicht neu.

Damit ist dieser Knopf die einzige verbliebene Stelle im Programm, an der
Handarbeit verlorengeht, und er trägt eine zweistufige Sicherung an Ort und
Stelle — der erste Druck macht den Knopf zur Frage samt Zahl („reset 12 tile
picks?"), der zweite führt aus. Kein Overlay, keine neue Fläche. Die Sicherung
ist **hinfällig, sobald es ein sitzungsweites Undo gibt**: eine Rückfrage vor
einer rücknehmbaren Handlung ist Reibung ohne Gegenwert.

Der Satz „es gibt keine Bedienhistorie" bleibt für die Zwecke gültig, für die er
getroffen wurde — die `ConflictNotice` ordnet weiter nach der Vorrangkette, weil
ein aus einem `SetupLink` geöffneter Zustand keine Vorgeschichte hat. Käme ein
Undo-Stapel, änderte das an dieser Begründung nichts.
