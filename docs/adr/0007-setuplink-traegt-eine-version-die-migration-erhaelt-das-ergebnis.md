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

> ⚠︎ **Teilweise zurückgezogen durch `## Nachtrag (#44)`.** Schaffen *wir* einen
> `TournamentType` ab, muss die `LinkMigration` den Nachfolger **benennen** — das
> Netz ist kein Weg für eine Migration. Es bleibt nur für Namen, die keine Kette
> je kannte. Weiterlesen dort, bevor du dich auf diesen Absatz stützt.

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

> ⚠︎ **Zurückgezogen durch `## Nachtrag (#48)`.** Die Bedingung ist nicht „die
> Kette lief", sondern **„der Bericht ist da, sobald irgendetwas nicht so
> übernommen wurde, wie es dastand"** — sonst schweigt die App bei einem Link der
> heutigen Version, in dem ein einzelner Schlüssel unlesbar ist. `## Nachtrag
> (#51)` sagt zusätzlich, *wo* der Eintrag entsteht: am Ende der Kette.

## Nachtrag (#34): die Kette erreicht die Adresse nicht

Die `LinkMigration` läuft **in** der App. Sie kann jeden Reglerschlüssel umschreiben,
aber nicht den Host, unter dem sie erreicht wurde — ein alter Link, der die App nicht
mehr findet, kommt an der Kette nie an. Der **Wirt der Kodierung** ist damit der eine
Teil der Schnittstelle, den die Versionierung nicht deckt, und ein Domainwechsel nach
dem Livegang die eine Änderung, für die es keine Migration gibt. Übrig bliebe allein
eine dauerhafte Weiterleitung auf dem alten Vhost.

Daraus folgt keine Regel für den Code, sondern eine für die Reihenfolge: das
Deploy-Ziel gehört **vor** den ersten Link im Umlauf festgelegt. Entschieden in
[Deploy-Ziel: optcg.ch statt ditshej.ch?](https://github.com/ditshej/tcg-prizing/issues/34)
als `prizing.optcg.ch`, solange die Einrichtung noch nicht gelaufen war — danach wäre
derselbe Entscheid eine Weiterleitung ohne Ablaufdatum gewesen.

## Nachtrag (#44): das Auffangnetz ist kein Weg für eine Migration

Der Satz oben — „nennt die Kette keinen Nachfolger, greift der **erste** Typ des
`Game` als Auffangnetz" — fasst zwei Fälle zusammen, die sich verschieden verhalten.
Für den einen wird er **zurückgezogen**.

Wo wir einen `TournamentType` selbst abschaffen, muss die `LinkMigration` seinen
Nachfolger **benennen**. Die Abkürzung „nichts nennen, Position 1 fängt" entfällt: sie
war eine mechanische Erfindung mit Alibi. Position 1 steht in keinem Link, und jedes
spätere Umsortieren — nach ADR 0003 ausdrücklich erlaubt und bedeutungstragend —
verschöbe das Ziel still und ohne Versionssprung. Der Preis ist, dass auch das
offensichtliche Entfernen einen benannten Entscheid kostet; er ist kleiner als eine
Dauerregel „an Position 1 nichts einschieben", die beim Sortieren niemand liest.

**Das Netz selbst bleibt** — aber nur für Namen, die keine Kette je kannte: eine von
Hand verbogene URL, ein Typ, der ohne Migration aus einer Liste fiel. Dort behauptet
es kein erhaltenes Ergebnis, sondern verhindert bloss den typlosen Zustand, den ADR
0003 nicht kennt, und der Bericht sagt es weiterhin. Es ist damit kein Werkzeug der
Versionierung, sondern der Ausgang für eine Eingabe, die wir nicht lesen können.

**Der Link nennt seine Basis immer.** `Game` und `TournamentType` stehen in jedem
`SetupLink`, auch wenn der Absender die Startwahl nie angefasst hat. Das ist keine
Ausnahme von ADR 0005s „nur Abweichungen": diese Regel trägt bei **Reglern**, weil ein
ungenannter Regler weiter *rechnet* und mit der Spielerzahl nachzieht. Ein ungenannter
Typ rechnet nicht nach, er würde *gewählt* — „erster der Liste" ist eine stille
Entscheidung, keine Fortschreibung. Die Basis, von der ein Link abweicht, muss er
darum benennen, sonst zeigt jeder heutige Link auf den ersten Typ von morgen. Kosten:
zwei Angaben mehr je URL, auch solange es genau ein `Game` gibt — gerade dann.

Damit ist die Freigabe in `docs/agents/setup-link.md`, dass Einschieben und Umsortieren
keine Migration braucht, ohne Vorbehalt wahr: nach beiden Entscheiden hängt kein Link
mehr an einer Position. Position 1 trägt wieder nur, was ADR 0003 ihr gab — die
Startwahl mit dem leeren Blatt.

## Nachtrag (#48): der Bericht hängt am Verlust, nicht an der gelaufenen Kette

Der Satz oben — das Overlay erscheine, „wenn die Kette tatsächlich gelaufen ist" —
ist zu eng gefasst. Er lässt ein Loch: ein Link der **heutigen** Version, in dem ein
einzelner Schlüssel unlesbar ist (`rankFloor=banana`, ein unbekannter Schlüssel),
lässt die Migrationskette gar nicht erst anlaufen — sie hat ja nichts zu heben — und
verliert trotzdem etwas. Nach der engen Fassung schwiege die App genau dort, wo sie
reden sollte.

Die Absicht bleibt vollständig erhalten: ein **sauberer** Link — jeder Schlüssel
bekannt, jeder Wert lesbar, keine Version zu heben — soll still bleiben. Die richtige
Bedingung ist darum nicht „die Kette lief", sondern **„der Bericht ist da, sobald
irgendetwas nicht so übernommen wurde, wie es dastand"**: umgeschrieben, weggefallen
oder unlesbar, gleich ob durch eine Migrationsstufe oder durch das Auffangnetz. Sonst
ist der Bericht `null`. Eine gelaufene Migration ist damit ein Fall, der einen Bericht
erzeugt, nicht die Bedingung dafür — und `docs/agents/setup-link.md` ist an derselben
Stelle entsprechend korrigiert.

Kein eigener ADR-Eintrag: die Absicht dieses Dokuments ändert sich nicht, nur ihre zu
enge Formulierung wird geschärft (`docs/agents/domain.md`, „sharpening your own text
while writing"). Die nächste freie Nummer wäre 0009 — sie wird hier nicht gezogen.

## Nachtrag (#51): der Leseweg beurteilt Reglernamen nicht mehr

Der Nachtrag (#48) oben lässt offen, **wo** ein unbekannter Reglerschlüssel
verloren geht, und die naheliegende Lesart — schon beim Dekodieren, weil ein
Link der heutigen Version die Kette gar nicht erst anwirft — wird hiermit
**zurückgezogen**. Sie ergäbe zwei Regeln für dieselbe Sache: einen Namen, den
ein alter Link trägt, dürfte die Kette umbenennen; denselben Namen in einem
heutigen Link hätte der Leseweg schon verworfen, bevor irgendwer ihn ansieht.
Welche der beiden greift, hinge dann an der Versionszahl des Links und nicht an
dem, was wir über den Namen wissen.

Entschieden ist die eine Regel: **ein unbekannter Reglername kommt immer mit
seinem Rohwert durch den Leseweg**, gleich welche Version der Link nennt. Der
Leseweg liest, er beurteilt nicht. Erst die Migrationskette entscheidet, was der
Name bedeutet — sie ist die Stelle, an der niedergeschrieben steht, wie mit
unbekannten Namen zu verfahren ist. Kommt er dort nicht vor, fällt er weg, und
**der Verlusteintrag entsteht am Ende der Kette**, nicht an ihrem Anfang.

Die Absicht des Nachtrags (#48) bleibt damit unangetastet: ein sauberer Link ist
still, und der Bericht ist da, sobald irgendetwas nicht so übernommen wurde, wie
es dastand. Nur der Ort, an dem der Eintrag entsteht, ist jetzt genannt. Für
`game` und `type` ändert sich nichts — das Auffangnetz aus dem Nachtrag (#44)
bleibt, wo es ist, weil es keinen typlosen Zustand gibt und die Kette dort einen
Nachfolger **nennen** muss.

Preis, bewusst genommen: ein von Hand verbogener Link trägt seinen Unsinn eine
Stufe weiter, bis die Kette ihn abräumt. Dafür gibt es genau eine Stelle, an der
über Reglernamen entschieden wird, und sie ist die, die die Antwort kennt.

Kein eigener ADR-Eintrag und kein Stempel: es ist dieselbe Entscheidung, deren
zu weit gefasste Lesart hier geschlossen wird — Präzedenz sind die Nachträge
(#34), (#44) und (#48) in diesem Dokument.

## Nachtrag (#89): ein Link ohne lesbare Version ist kaputt, nicht aus der Zukunft

Dieses Dokument hat den Fall nie benannt, den es am dringendsten gebraucht
hätte: einen Link, der **gar keine lesbare Version** nennt. #47 hat die Lücke
mit einer Tabellenzeile gefüllt — „`v` fehlt oder ist unlesbar | wie ‚grösser
als heute'" —, und die wird hiermit **zurückgezogen**. Entschieden im Terminal
am 2026-09-30 (Lauf 10, Entscheid K1, aus Befund B4); der Wortlaut steht im
Kommentar zu
[#89](https://github.com/ditshej/tcg-prizing/issues/89), gebaut in PR #108.

**Warum die Gleichsetzung nicht trägt.** Der Zukunftsfall verdient sein
Schweigen aus einem Grund, den dieses Dokument oben gibt: die Adresszeile bleibt
stehen, weil ein Herunterschreiben einen Link entwertete, der auf einer
aktualisierten App wieder vollständig wäre. Ein Link ohne lesbares `v` wird auf
**keiner** späteren App vollständig — er ist nicht neuer als wir, er ist kaputt.
Und `v=0` ist ein Link aus der **Vergangenheit**: ihn „neuer als diese App" zu
nennen ist keine grobe Kante am Schnitt, sondern eine falsche Aussage. Betroffen
sind fünf Formen: `v` fehlt ganz, `v=`, `v=0`, `v=abc`, `v=1.0`.

**Unterschieden wird am Draht, nicht am Aufrufer.** Die billigere Variante — die
öffnende Stelle liest `from: null` gegen `from: 99` am Bericht ab — ist
verworfen. Sie liesse zwei Stellen entstehen, an denen über dieselbe Sache
entschieden wird, und der Bericht behauptete weiterhin „aus der Zukunft" über
einen Link, der es nicht ist. Dasselbe Argument wie im Nachtrag (#51): es gibt
genau eine Stelle, an der über eine Eingabe entschieden wird, und es ist die,
die die Antwort kennt.

**Was der kaputte Link bekommt.** Seine Regler bleiben ungelesen wie beim
Zukunftslink — ohne Version wüssten wir nicht, nach welchem Register sie zu
lesen wären, und sie trotzdem zu lesen hiesse, eine Version zu raten. Getrennt
wird alles danach: der Bericht trägt einen eigenen Eintrag statt `futureVersion`,
er fordert das Lesezeichen neu an (`resaveBookmark`), und die öffnende Stelle
**räumt die Adresszeile auf**, statt den Unsinn stehenzulassen. Damit gilt der
Lauf-9-Entscheid zu #89 zum ersten Mal ohne Loch: der unlesbare Link bleibt nie
in der Adresszeile stehen und behauptet etwas, das der Schirm nicht zeigt.

**Kein Versionssprung, und das ist keine Ausnahme von der Disziplin oben.**
`docs/agents/setup-link.md` verlangt bei einer Änderung am Drahtformat Version
plus `LinkMigration` im selben Commit. Beides entfällt hier aus zwei Gründen,
die beide nachschlagbar sind und nicht abgewogen werden müssen:

1. **Die Regel hat ein Startdatum, und es ist nicht erreicht** (`setup-link.md`,
   „Not yet — the rule has a start date"): es ist kein `SetupLink` im Umlauf.
   #89 ist das Ticket, das überhaupt den ersten in eine Adresszeile schreibt.
2. **Für keinen v1-Link ändert sich etwas.** Ein Link mit lesbarer Version wird
   vorher wie nachher identisch gelesen. Geändert ist allein die Behandlung von
   Eingaben, die **keine** Version nennen — und die treten in keine Kette ein:
   eine `LinkMigration` läuft von N nach N+1 und hat für „kein N" keinen Anfang.
   Sie wäre hier nicht überflüssig, sie ist nicht schreibbar.

**Ein Fund beim Bauen, der die zweite Begründung schärft.** Die Kette hat den
Fall bisher nicht ausgeschlossen, sondern nur nicht bemerkt: ein Lesevorgang mit
`version: null` lief in `steps.slice(version - 1)`, also `slice(NaN)` und damit
`slice(0)` — die **ganze** Kette über einen Link, der nie behauptet hat, v1 zu
sein. Solange `STEPS` leer ist, ist das unsichtbar; beim ersten echten
Versionssprung wäre es falsch. `migrate()` erkennt jetzt beide Fälle, und eine
Zusicherung mit einem Fixture-Schritt hält es fest.

**Preis, bewusst genommen:** die Regler eines Links ohne `v` sind verloren, auch
wenn sie lesbar dastehen. Sie zu übernehmen hiesse, eine Version zu raten, und
eine geratene Version ist genau die stille Verfälschung, gegen die dieses
Dokument geschrieben ist. Der Benutzer bekommt dafür die Wahrheit und den einen
Ausweg, der hilft.

Kein eigener ADR-Eintrag und kein Stempel an einem früheren: dieses Dokument
sagte zum Fall nie etwas, das falsch geworden wäre — es sagte gar nichts. Die
zurückgezogene Zeile steht in #47 und ist dort als zurückgezogen markiert;
Präzedenz für die Form sind die Nachträge (#34), (#44), (#48) und (#51).
