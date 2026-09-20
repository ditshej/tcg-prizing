# SetupLink: die URL trägt Abweichungen, keinen Schnappschuss

Teilweise überholt durch ADR-0006.
Ergänzt durch ADR-0007.

Der eingestellte Zustand eines `Tournament` steht in der **URL** und schreibt sich
beim Ziehen mit (`replaceState`, also ohne Browser-Historie). Sie trägt
**ausschliesslich die Abweichungen** vom `DefaultSet` — nicht jeden Reglerwert.
Damit ist der `SetupLink` die dritte Ebene der Kette, die ADR 0003 begonnen hat:
`Game` (vollständiges Blatt) → `TournamentType` (nur Abweichungen) → `SetupLink`
(nur Abweichungen). Ein Regler, den der Link nicht nennt, ist nicht angefasst und
zieht weiter mit der Spielerzahl nach.

Das ist keine zweite Buchführung: ADR 0003 hat festgelegt, dass „abweichend" und
„angefasst" **ein** Bit sind. Die Menge der Abweichungen *ist* die Menge der
angefassten Regler, also kodiert der Link mit einer Angabe beides. Ein Schnappschuss
hätte dieselbe Information mit zwei Angaben je Regler transportieren müssen — oder
das Nachziehen für alle Regler auf einmal stillgelegt.

## Considered Options

**Vollständiger Schnappschuss aller Regler.** Die naheliegende Lesart von „den
Zustand in die URL schreiben", und sie zerstört genau die Eigenschaft, für die das
`DefaultSet` gebaut wurde. Ein Link, der jeden Wert nennt, macht jeden Regler
angefasst — die spielerzahlabhängigen Staffeln für `RankPoolDepth` und den
`ranked`-Anteil der `WinnerPackAllocation` hören auf nachzuziehen, sobald jemand
einen Link öffnet. Ein Preset „steilere Kurve, sonst wie Weekly" liesse sich nicht
mehr ausdrücken; es wäre immer „steilere Kurve und alles andere für 32 Spielende
festgenagelt".

**Werte plus angefasst-Bit je Regler.** Technisch gleichwertig zum gewählten Weg,
aber redundant: bei einem Bit für „abweichend = angefasst" ist der Wert schon die
Aussage. Zwei Angaben, die nie widersprechen dürfen, sind eine Gelegenheit, dass
sie es doch tun.

**Kein Zustand in der URL, Presets nur als `TournamentType` im Code.** Der
ursprüngliche Vorschlag, und er ist für *wiederkehrende* Einstellungen weiterhin
der bessere Ort: versioniert, für jedes Turnier gültig, ohne Pflegeaufwand am Link.
Er scheitert am einmaligen Fall — eine Einstellung an jemanden schicken, ohne sie
vorher ins Repository zu tragen. Genau dafür ist der `SetupLink` da, und er
konkurriert mit dem `DefaultSet` nicht, er liegt darüber.

**Speichern in `localStorage`.** Verworfen, ohne dass es eine Abwägung gebraucht
hätte: Persistenz ist ausdrücklich ausgeschlossen, und ein gespeicherter Zustand
kann nicht verschickt werden — was der einzige Zweck ist.

## Consequences

**Die Out-of-scope-Grenze bleibt heil.** Der `SetupLink` ist **Eingabe**, nicht
Persistenz. Die App schreibt nichts weg; sie liest eine URL, so wie sie
Reglerstellungen liest. Accounts, Storage und Caching bleiben ausgeschlossen, und
ADR 0002 bleibt unberührt — die Rechnung ist weiter eine totale Funktion ihrer
Eingaben, der Link ist nur eine weitere Quelle dafür.

**Die Kodierung wird öffentlich.** Sobald Links bei Leuten liegen, ist ihr Format
eine Schnittstelle: ein umbenannter Regler oder ein entfernter `TournamentType`
macht alte Links ungültig oder, schlimmer, still falsch. Wie die App damit umgeht,
entscheidet ADR 0007 — die URL trägt eine Version, und jede Erhöhung bringt eine
`LinkMigration` mit, die das Ergebnis erhält statt der Werte.

**Der Kopierknopf ist eine Abkürzung, kein Export.** Er legt die Adresszeile in
die Zwischenablage und erzeugt kein zweites Format — die Entscheidung gegen
Ausgaben neben dem Bildschirm bleibt dadurch unangetastet.

Nachtrag: „Abweichungen" ist inzwischen präziser gefasst. ADR 0006 hat den
Zustand `Pinned` genannt und festgelegt, dass er bei der Bedienhandlung gesetzt
wird statt aus einem Vergleich abgeleitet. Die URL trägt damit die **`pinned`
Regler**, und die sind eine Obermenge der abweichenden: ein Regler darf im Link
stehen mit demselben Wert, den sein Default ohnehin liefert. Der Satz oben, die
Menge der Abweichungen *sei* die Menge der angefassten Regler, ist entsprechend
zu lesen — es bleibt **ein** Bit je Regler, wie ADR 0003 verlangt, aber die
Gleichsetzung der beiden Mengen gilt nicht mehr. Am Format ändert das nichts.

Nachtrag: Die Lebensdauer eines Links ist länger, als der Abschnitt „Kein Zustand
in der URL" oben unterstellt. Dort steht, der `SetupLink` sei für den *einmaligen*
Fall da und Wiederkehrendes gehöre in den `TournamentType`. Das bleibt als
Empfehlung richtig, beschreibt aber nicht, wie der Link benutzt wird: er wird als
**Lesezeichen** abgelegt — im Discord gepinnt, in einer Notiz aufbewahrt, Monate
später wieder geöffnet. Der Link ist damit ein zweiter, ungepflegter Ort für
wiederkehrende Einstellungen, und das ist hingenommen, nicht wegdefiniert. Die
Folge trägt ADR 0007: eine Version in der URL und eine `LinkMigration` je
Erhöhung.
