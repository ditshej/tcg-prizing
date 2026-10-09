# Abnahme — #167 Kachelblase und Rückfrage messen erst, wenn sie stehen

Gemessen am echten App-Stand, nie „sieht gut aus". **Messbrowser für Blasen ist WebKit**;
Chromium läuft daneben als Gegenprobe. In Chromium tritt der Fehler nicht auf, deshalb beweist
eine Messung dort allein nichts (#167, „Trap").

- **Stand:** Zweig `fix/167-blasen-messen`, vorher = `main` bei `b9471ce`, nachher = `3fc31d1`
- **Server:** `php -S localhost:8767 -t public` aus der Worktree-Wurzel, PHP 8.3.33
- **Browser:** Playwright 1.64, **WebKit** und **Chromium**, je `devices['iPhone 15']`
  (für Chromium ohne `defaultBrowserType`), DPR 3, `isMobile`, `hasTouch`, `colorScheme` hell und
  dunkel. Skript `/tmp/pw/167/seq.mjs`, nicht im Repo
- **Viewport:** 393 × 852 und 360 × 780; ungezoomt gemessen: `innerWidth` = `clientWidth` =
  `visualViewport.width`, `scale` 1, `scrollWidth` = Breite
- **Messmittel:** `getBoundingClientRect` der Blase; „`+` antippbar" = `+` liegt ganz im
  Viewport **und** `elementFromPoint` in seiner Mitte trifft ihn; dazu der echte `tap()`
- **Bilder:** `/tmp/pw/167/` (nachher) und `/tmp/pw/167/vorher/`, nicht eingecheckt;
  `<browser>-<modus>-<breite>-{tile6plus,reset,details}.png`

## Folge

Nacheinander in einer Seite: Kachel 6 (oberste Reihe, rechts), Kachel 5, Kachel 1, Kachel 6 und
dort `+` bei `Winner packs`, Reset-all im Plan-Kopf zweimal (`[data-notice-drop]`, „1 value back
to Weekly?"), dann `Details`, Typ auf `Weekend`, und im CarryOverNotice „Drop all … and follow"
zweimal (`[data-drop-bubble]`, „1 value back to Weekend?"). Zwischen den Schritten `Esc` bzw. ✕.

Soll: `left ≥ 8`, `right ≤ Breite − 8` (385 bzw. 352), `+` antippbar; Chromium unverändert.

## 393 × 852 — `left → right` (Breite)

| Fall | WebKit vorher | **WebKit nachher** | Chromium vorher | Chromium nachher |
|---|---|---|---|---|
| Kachel 6 | 344 → 554,5 (210,5), `+` bei 506…544: **nicht antippbar** | **93 → 385 (292)**, `+` antippbar | 93 → 385 (292) | 93 → 385 (292) |
| Kachel 5 | 175 → 393 (218) | **93 → 385 (292)** | 93 → 385 (292) | 93 → 385 (292) |
| Kachel 1 | 49 → 288,7 (239,7) | **8 → 247,7 (239,7)** | 8 → 247,7 (239,7) | 8 → 247,7 (239,7) |
| Kachel 6 nach `+` | 175 → 393 (218), ohne Rand; `+` nur per Skript-`click()` erreicht | **93 → 385 (292)**, `+` per `tap()` | 93 → 385 (292) | 93 → 385 (292) |
| Reset-all, 1. Mal | 325 → 535 (210) | **93 → 385 (292)** | 93 → 385 (292) | 93 → 385 (292) |
| Reset-all, 2. Mal | 325 → 535 (210) | **93 → 385 (292)** | 93 → 385 (292) | 93 → 385 (292) |
| Details-Rückfrage, 1. Mal | 108,5 → 393 (284,5), unten **935,8** > 852 | **8 → 300 (292)**, 590…739,8 | 8 → 300 (292) | 8 → 300 (292) |
| Details-Rückfrage, 2. Mal | dito | **8 → 300 (292)** | 8 → 300 (292) | 8 → 300 (292) |

## 360 × 780 — `left → right` (Breite)

| Fall | WebKit vorher | **WebKit nachher** | Chromium vorher | Chromium nachher |
|---|---|---|---|---|
| Kachel 6 | 325,4 → 535,9 (210,5), `+` nicht antippbar | **60 → 352 (292)** | 60 → 352 (292) | 60 → 352 (292) |
| Kachel 5 | 142 → 360 (218) | **60 → 352 (292)** | 60 → 352 (292) | 60 → 352 (292) |
| Kachel 1 | 34,6 → 274,3 (239,7) | **8 → 247,7 (239,7)** | 8 → 247,7 | 8 → 247,7 |
| Kachel 6 nach `+` | 142 → 360 (218) | **60 → 352 (292)** | 60 → 352 (292) | 60 → 352 (292) |
| Reset-all, 2 × | 292 → 502 (210) | **60 → 352 (292)** | 60 → 352 (292) | 60 → 352 (292) |
| Details-Rückfrage, 2 × | 108,5 → 360 (251,5), unten **878,9** > 780 | **8 → 300 (292)**, 518…667,8 | 8 → 300 (292) | 8 → 300 (292) |

Hell und dunkel liefern nachher in beiden Browsern dieselben Zahlen (Abweichung ≤ 0,1 px in
`bottom`). „Vorher" ist hell gemessen.

## Was die Zahlen sagen

- **Vorher, WebKit:** Beide Teile des Fehlers sind sichtbar. Gemessen mit Breite 0, setzt die
  Rechnung die linke Kante auf die Mitte des Ankers: Kachel 6 317 + 54/2 = 344, Reset
  309 + 32/2 = 325. Gemessen mit Höhe 0 klappt die Details-Rückfrage nicht nach oben und läuft
  unten aus dem Bild (935,8 bei 852). Die Breite 210 bzw. 218 ist die geschrumpfte: Platz rechts
  von `left` zu klein, also `min-width` + Polster. Auch Kachel 1 stand falsch (49 statt 8), nur
  noch im Bild.
- **Nachher:** In WebKit stehen alle Fälle so wie in Chromium, auf den Zehntelpixel. In Chromium
  hat sich keine Zahl verschoben.
- **Nach `+`:** Nach `+` wird neu platziert. Der Effekt in `init()` liest `tiles`, und `tiles`
  hängt am Plan. Gemessen mit einem von Hand auf `0px` gesetzten `left`: Nach `+` steht die Blase
  wieder bei 93 → 385, in WebKit und Chromium. Wächst der Inhalt („by hand"), misst diese neue
  Platzierung die neue Breite bei `left` 0.

## Wahl: `left` = 0 vor dem Messen, keine feste Breite

Begründung im Code-Kommentar an `unshrunk()` (`public/ui/plan.mjs`). Kurz: Die Breite dieser
beiden Blasen **ist** die ihres Inhalts. Kachel 1 steht 239,7 breit. Mit einer festen Breite von
292 würde sie sich in jedem Browser ändern, also auch die Blasen, die schon richtig standen.
Das AC „Chromium bleibt gleich" wäre damit verletzt. Gelesen und gesetzt wird im selben Task,
darum wird kein Bild mit `left` 0 gezeichnet.

## Tests

`test/ui-bubble.test.mjs`: Eine Attrappe meldet beim ersten Lesen `offsetWidth` 0. Dann schreibt
`placeBubble()` bzw. `placeConfirm()` kein `left` und fordert einen Frame an. Im Frame stehen
die Blasen richtig. Eine zweite Attrappe hat eine Breite, die vom gesetzten `left` abhängt
(Inhalt 292, `min` 190/210, zuletzt bei 344/325). Beide Blasen stehen bei 400 − 292 − 8 und
enden 8 innerhalb des Rahmens. Vor dem Bau waren beide Paare rot. Die zweite Attrappe stand bei
202 bzw. 182, mit genau den geschrumpften Breiten 190 und 210. `node --test`: 742 / 742 grün.
