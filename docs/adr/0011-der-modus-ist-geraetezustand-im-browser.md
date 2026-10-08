# Der Modus ist Gerätezustand im Browser, kein Turnierzustand

Die App hat einen Entwurf in zwei Modi — hell ist Bronze, dunkel ist Foil (#15,
gebaut in #142). Bis #144 folgte der Modus allein dem Gerät
(`prefers-color-scheme`). Jetzt gibt es eine **Wahl** zwischen drei Ständen:
**System**, **hell**, **dunkel** — ein Knopf oben rechts im Kopf von `Details`,
der in dieser Reihenfolge durchklickt (Maintainer, Durchklicken 2026-10-08,
Entscheide 1–3 an #144).

Die Wahl wird **im Browser gemerkt**, in `localStorage` unter dem Schlüssel
`theme`, und **nie im `SetupLink`**. Sie ist der erste Zustand der App, der eine
Sitzung überdauert.

Der Modus ist **Gerätezustand**: er beschreibt, wie dieser Bildschirm in diesem
Raum am besten zu lesen ist, nicht was am `Tournament` eingestellt ist. Er
gehört zum Gerät wie seine Schriftgrösse, und darum gehört er nicht in einen
Link, der an ein anderes Gerät geht. Ein geteilter Link öffnet sich im Modus des
Empfängers.

## Warum er bleiben darf, obwohl #61 Persistenz ausschliesst

#61 schliesst unter `## Out of Scope` beides aus — „Persistenz jeder Art —
Accounts, Storage, Caching" und „eine zweite Farbwelt oder ein
Theme-Umschalter" — und die Begründung, nachgereicht am 2026-10-04
([Kommentar](https://github.com/ditshej/tcg-prizing/issues/61#issuecomment-5982536998)),
verbindet die beiden: „Ein Umschalter wäre Zustand, der eine Sitzung überdauern
müsste. Die App schreibt aber nichts weg." Der Umschalter war also nicht aus
eigenem Recht ausgeschlossen, sondern als Folge des Persistenzverbots.

Dieses Verbot hatte einen Gegenstand, und der war der **Turnierzustand**. ADR
0005 verwirft `localStorage` für die Reglerstellungen, „weil ein gespeicherter
Zustand nicht verschickt werden kann — was der einzige Zweck ist". Für den Modus
gilt das Gegenteil: er **soll** nicht verschickt werden. Das Argument, das
`localStorage` für das `Tournament` ausschliesst, ist dasselbe, das es für den
Modus zum richtigen Ort macht.

Was das Verbot sonst schützt, bleibt heil:

- **Die Rechnung ist weiter eine totale Funktion ihrer Eingaben** (ADR 0002).
  Der Modus ist keine Eingabe in `distribute()` und berührt keinen Wert am Schirm
  ausser Farben.
- **Der `SetupLink` bleibt die einzige Quelle eines Turnierstands.** Es gibt
  keinen zweiten, gespeicherten Stand, der mit dem Link konkurrieren könnte, und
  kein Wiederherstellen beim Öffnen. Was der Link trägt und was nicht, ist
  unverändert (ADR 0005, ADR 0007) — kein Schlüssel, keine Formatversion, keine
  `LinkMigration`.
- **Nichts verlässt das Gerät.** Kein Account, kein Server, kein Cookie, das
  mitgeschickt würde.

Überstimmt ist damit #61 `## Out of Scope` in **diesem einen Punkt**, wie #144
Entscheid 4 es sagt: die eine Farbwelt bleibt, gewählt wird nur zwischen ihren
zwei Modi, und Persistenz bleibt für alles andere ausgeschlossen. Ein zweiter
gespeicherter Zustand braucht ein eigenes ADR; dieses ist keine Tür für ihn.

## Considered Options

**Weiter nur dem Gerät folgen.** Der Stand bis #144 und die Begründung von #61.
Verworfen vom Maintainer beim Durchklicken (#144, Entscheid 1). Einen Grund
nennt das Ticket nicht, und dieses ADR erfindet keinen; festgehalten ist nur,
dass die Wahl jetzt besteht.

**Die Wahl im `SetupLink`.** Verworfen, bevor es eine Abwägung brauchte: der
Link geht vom `CommunityLead` an andere Geräte, und der Modus des Absenders ist
am Gerät des Empfängers bedeutungslos. Er würde ausserdem die Kodierung, eine
öffentliche Schnittstelle (ADR 0007), um einen Schlüssel erweitern, der mit dem
Turnier nichts zu tun hat.

**Die Wahl nur für die Sitzung.** Ohne Speicher wäre der Umschalter mit dem
Persistenzverbot vereinbar, aber nach jedem Neuladen weg — und eine Wahl, die
man bei jedem Öffnen wiederholen muss, ist keine. Verworfen.

**Zwei Stände statt drei** (hell/dunkel, ohne System). Nicht entschieden,
sondern ausgeschlossen durch #144 Entscheid 1 („hell / dunkel / System"). Die
Reihenfolge System → hell → dunkel ist die des Tickets und vom Bau so
übernommen: wer nie drückt, bleibt beim Stand von heute, und ein Druck führt
zuerst weg vom Gerät, bevor der Kreis zu ihm zurückkehrt.

## Consequences

**Die Wahl wird vor dem ersten Zeichnen angewendet.** Ein Modul-Skript oder ein
Alpine-`init` liefe erst nach dem Parsen; das Gerät hätte bis dahin seinen
Modus gezeichnet, und der Schirm würde umspringen. Darum liest ein kleines
klassisches Inline-Skript im `<head>` von `views/shell.php`, direkt nach dem
Stylesheet, die Wahl und setzt `data-theme` auf `<html>`. Das ist kein
Build-Schritt und keine Ausnahme von ADR 0004: es ist eine Zeile im
ausgelieferten Markup. Weil es `theme.mjs` nicht importieren kann, steht der
Schlüssel dort ein zweites Mal; `test/ui-theme.test.mjs` führt das Skript gegen
das aus, was `writeTheme()` hinterlässt.

**System ist die Abwesenheit einer Wahl.** Nichts gespeichert, kein Attribut,
und das Stylesheet folgt `prefers-color-scheme` genau wie vorher — auch wenn das
Gerät mitten in der Sitzung wechselt. `color-scheme` folgt der Wahl (`light
dark` / `light` / `dark`), damit native Bedienelemente und Scrollbalken mit den
Tokens drehen.

**Ein Speicher, der wirft, ist System.** Safari im privaten Modus und
abgeschalteter Speicher werfen schon beim Zugriff. Das ist kein Fehler, sondern
ein Gerät ohne Gedächtnis: gelesen wird System, das Schreiben geht verloren, und
der Modus wechselt für diese Seite trotzdem — im Sinn von ADR 0002, keine
Eingabe ist ein Fehler.

**Der dunkle Satz steht zweimal im Stylesheet.** CSS kann eine Media-Query und
ein Attribut nicht in einer Regel verbinden: Foil gilt für ein dunkles Gerät
ohne Wahl „hell" **und** für die Wahl „dunkel" auf jedem Gerät. Die beiden
Kopien hält `test/ui-look.test.mjs` Deklaration für Deklaration gleich, sonst
driften die zwei Wege nach Foil beim nächsten Token auseinander.

**An ADR 0005 und ADR 0007 ist je ein Satz überholt, und nur der.** Beide
schreiben unter `## Consequences` „Die App schreibt nichts weg", 0005 dazu
„Accounts, Storage und Caching bleiben ausgeschlossen". Das gilt jetzt mit
einer Ausnahme, dem Modus unter `theme` in `localStorage`. Was beide über den
`SetupLink` entscheiden — Eingabe statt Persistenz, `localStorage` als Ort für
den Turnierstand verworfen —, steht unverändert. Darum `Teilweise überholt`
und nicht `Ergänzt`: ein Satz dort ist falsch geworden, nicht nur unvollständig.

**Der Begriff steht im Glossar als `Theme`.** `CONTEXT.md` führt den Modus
unter dem Namen, den der Code trägt (`theme.mjs`, Schlüssel `theme`), mit
`_Label_`-Zeile für das Wort **Mode** am Knopf. Sein Satz unter `SetupLink`
(„Accounts, Storage und Caching bleiben ausgeschlossen") nennt die Ausnahme
dieses ADR (nachgetragen im selben PR, #144, B4).
