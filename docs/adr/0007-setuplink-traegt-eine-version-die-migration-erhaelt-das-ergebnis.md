# Der SetupLink trägt eine Version, und die Migration erhält das Ergebnis

Der `SetupLink` ist ein **Lesezeichen**: er wird im Discord gepinnt, in einer Notiz
abgelegt und Monate später wieder geöffnet. Zwischen Verschicken und Öffnen wandert
der Code weiter, der Link nicht — damit ist seine Kodierung eine **Schnittstelle**.
Die URL trägt deshalb eine **Formatversion**, und jede Erhöhung bringt im selben
Commit eine **`LinkMigration`** mit: eine vom Entwickler geschriebene Umschreibregel,
deren Vertrag lautet, dass sie das **Ergebnis** bewahrt und nicht die Werte. Sie darf
Regler setzen, die im alten Link nie standen, solange der `DistributionPlan`
möglichst derselbe bleibt.

Beim Öffnen läuft die Kette hoch und der migrierte Stand **gilt sofort** — die
Regler stehen `pinned`, die Adresszeile schreibt sich als heutige Version mit. Ein
einmaliges Overlay berichtet, was umgeschrieben und was ersatzlos weggefallen ist,
und fordert dazu auf, den Link neu abzuspeichern.

## Considered Options

**Nur eine Versionszahl, ohne Umschreibregeln.** Billig, und sie sagt der App
zuverlässig, *dass* ein Link alt ist — aber nicht, wie er zu lesen wäre. Übrig
bliebe ein Vorbehalt („prüf die Regler") ohne Vorschlag. Für ein Lesezeichen, das
seinen Zweck erst beim Öffnen erfüllt, ist das die Aufforderung, den Zustand von
Hand nachzubauen, den der Link gerade transportieren sollte.

**Namensvertrag ohne Version.** Schlüsselnamen sind für immer stabil, entfernte
Regler werden nie recycelt, damit passt jeder Link immer. Das hält, solange nur
umbenannt wird — es hält nicht, wenn sich die **Bedeutung** eines Reglers ändert.
Ein `RankPoolDepth`, der von „Anzahl Ränge" auf „Anteil des Feldes" umgestellt
würde, trüge denselben Namen und dieselbe Zahl und meinte etwas anderes. Ein
Namensvertrag hat keine Stelle, an der so etwas auffällt; eine Version schon.

**Migrierter Stand als Vorschlag, der erst nach Klick gilt.** Die naheliegende
Lesart von „Migrationsmeldung", und sie macht den Lesezeichen-Fall kaputt: wer den
gepinnten Link öffnet, sähe zunächst die Defaults und müsste erst einen Knopf
finden, damit der Link tut, wofür er verschickt wurde. Die Ablehnung führt zudem
nirgendwohin — ein Schlüssel, den der Kern nicht mehr kennt, ist kein Regler, es
gibt also keinen alten Zustand, in den man zurückfiele.

**Werte aus einem alten Link auf heutige Deckel kappen.** Verworfen, weil es genau
die stille Verfälschung begeht, die die Versionierung verhindern soll — nur vom
Kappen statt vom Ignorieren. Und es zerlegt eine Regel, die sonst ohne Ausnahme
gilt: ADR 0006 kappt einen `pinned` Wert nie. Ein Wert aus dem Link ist nach
ADR 0005 ein Wert wie jeder andere; die App führt nicht mit, woher er kam.

## Consequences

**Umbenennen kostet jetzt etwas.** Wer einen Reglerschlüssel umbenennt, entfernt
oder seine Bedeutung ändert, muss im selben Commit die Version erhöhen und die
`LinkMigration` schreiben — sonst ist die Kette gelogen und die App behauptet eine
Verträglichkeit, die sie nicht hat. Diese Disziplin steht als Arbeitsregel in
`docs/agents/setup-link.md`, weil sie in dem Moment beisst, in dem jemand einen
Regler umbenennt und gar nicht an Links denkt.

**Der Maintainer verantwortet die erfundenen Werte.** Eine ergebniserhaltende
Migration setzt Regler, die im Link nie standen. Das ist die einzige zugelassene
Form von Erfindung: *mechanisch* darf nichts erfunden werden — wo ein Regler
ersatzlos verschwunden ist und die Kette keinen Nachfolger nennt, fällt der Wert
weg und der Bericht nennt ihn beim Namen. Ein erfundener Ersatz stünde als `pinned`
da und behauptete eine Entscheidung, die nie jemand getroffen hat.

**`Game` und `TournamentType` stehen als stabiler Name im Link, nie als Position.**
Nach ADR 0003 ist die Reihenfolge der `TournamentType`-Liste bedeutungstragend und
darf sich ändern; eine Position im Link koppelte die Kodierung an genau diese
Reihenfolge. Ein Einschieben in die Liste ist damit folgenlos, ein Umbenennen des
Bezeichners nicht — das ist eine `LinkMigration`. Nennt ein Link einen
`TournamentType`, den es nicht mehr gibt, und nennt die Kette keinen Nachfolger,
greift der **erste** Typ des `Game` als Auffangnetz und der Bericht sagt es. Das ist
die einzige Stelle mit einem automatischen Ersatz, und sie ist es nur, weil es nach
ADR 0003 keinen typlosen Zustand gibt.

**Die Out-of-scope-Grenze bleibt heil.** Die Version ändert nichts daran, dass der
Link Eingabe ist und keine Persistenz. Die App schreibt nichts weg; sie liest eine
URL und rechnet, und das `replaceState` beim Hochmigrieren ist dieselbe Geste, die
ADR 0005 ohnehin für jeden Reglerzug vorsieht.

**Das Overlay ist die dritte Fläche und trotzdem keine.** Es liegt über allem statt
in der Reihe unter dem Plan, weil es nicht den Plan kommentiert, sondern die
Herkunft der Eingabe. Damit teilt es sich keinen Platz mit `ConflictNotice` und
`Offer` und verschärft die Enge aus dem Ticket zu deren Verdrängung nicht. Es ist
wegklickbar, kommt nicht zurück, steht nie im `SetupLink` und erscheint nur, wenn
die Kette tatsächlich gelaufen ist.
