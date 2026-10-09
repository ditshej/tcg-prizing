# Abnahme — #121 Gerätecheck, emulierter Teil gegen die Live-Seite

Gemessen am echten App-Stand, nie „sieht gut aus". Dieses Protokoll nimmt aus jeder Zeile von
#121 den Teil, den Emulation beantworten kann. Der Teil, der nur an einem echten Gerät zu
sehen ist, steht in der Spalte „Urteil" als **nur am Gerät** und bleibt dem Maintainer.

- **Stand:** `main` bei `a4457f0` (`a4457f075591bb4f8a02253761e7ba00e7e6088f`, Merge von #179).
  Die Live-Seite wurde am 2026-10-09 mit `./deploy.sh` von diesem Stand ausgeliefert.
- **Adresse:** `https://prizing.optcg.ch/`. Für Abschnitt 5 zusätzlich `http://prizing.optcg.ch/`
  (antwortet mit 200 ohne Umleitung, also kein sicherer Kontext, wie das LAN).
- **Browser:** Playwright 1.64, **WebKit 27.2** (Messbrowser, vor allem für Blasen und Popover,
  wie seit #167) und **Chromium 156.0.8078.4** (Gegenprobe). Die Skripte liegen unter
  `/tmp/pw/121/`, nicht im Repo.
- **Kontexte:** `devices['iPhone 15']` ohne `defaultBrowserType`, `deviceScaleFactor: 3`,
  `isMobile`, `hasTouch`, `colorScheme` hell und dunkel. Viewports: die Safari-Grössen mit
  Leisten aus Playwright (393 × 659 iPhone 15, 734 × 343 iPhone 15 quer, 814 × 380 Pro Max quer,
  375 × 667 / 667 × 375 SE), dazu die Leinwände, die #121 nennt (393 × 852, 360 × 780,
  812 × 375, 932 × 430, 721/722 quer usw.). Für Abschnitt 6 Chromium mit `devices['Pixel 7']`
  und CPU-Drosselung × 6 über CDP. Jeder Lauf hat einen frischen Kontext. Pro Gerät gibt es
  einen Kontext, darin wird die Grösse umgestellt. Zwischen den Läufen gab es Pausen; ein HTTP 429
  trat nicht auf.
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `elementFromPoint`. Die
  Trefferfläche wird von der Mitte aus waagrecht und senkrecht bestimmt, wie in Lauf 17: erst in
  1-px-Schritten, dann auf 1/64 px halbiert. Getippt wird mit `page.touchscreen.tap()`, also mit
  echten Touch-Ereignissen der Engine und nicht mit `el.click()`. Pixel werden aus Screenshots
  über ein Canvas gelesen. „Blau" heisst B > R + 30 und B > G + 10, wie in #170.
- **Schrift:** Beide Engines lösen `-apple-system` auf dem Mac zu SF auf, also zur Familie von iOS.
  Android-Schriften (Roboto) sind hier nicht gemessen.
- **Was Emulation nicht kann:** `env(safe-area-inset-*)` ist 0. Es gibt keine Safari-Leisten, die
  ein- und ausfahren, und darum kein echtes `dvh`. Standalone fehlt, ebenso die native
  Teilen-Ansicht. Pinch-Zoom, Gummiband und Doppeltipp-Zoom fehlen als Physik, und
  `visualViewport.scale` bleibt 1. Daumengefühl und OLED fehlen auch.

Urteile: **bestanden** (ganz emulierbar und erfüllt → in #121 abgehakt) · **emuliert bestanden,
Rest am Gerät** (gemischt → Notiz unter dem Punkt) · **Befund** · **nur am Gerät** (unberührt).

## 0 · Vorab

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| iOS-Stand ≥ 16.4 | — | — | — | nur am Gerät |

## 1 · iPhone Safari, hochkant

### Touch und Treffer

Viewports 393 × 659, 360 × 640 und 320 × 568, hell. Die Zahlen sind in WebKit und Chromium gleich
(± 0,5 px Rundung beim Hit-Test).

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Touch an Kachel, 🎲, gehobenem Chip | Trefferfläche; Kachelbreite; Chip über offener Leiste (`depth=32`, ▾, dann 🎲), echter Tipp | Kachel 54, unter 365 schmaler; 🎲 und Chip treffbar, Chip über der Leiste | Kachel 393: 54 × 54 (Fläche 55 × 55), 360: 53,2 breit, 320: 46,5 breit (Fläche 47,5 × 55). 🎲 Fläche 112,7 × 44. Chip 112,7 × 34 gezeichnet, Fläche 113,7 × 45; Unterkante 443 über der Leiste ab 451 (393), 424/432 (360), 352/360 (320). Tipp öffnet die Meldung in allen drei | emuliert bestanden, Rest am Gerät: Fehlgriffe im Daumenbereich |
| Vollbild-Toggle und Griff knapp an der Unterkante | `elementFromPoint` 1 px innen sowie 1, 4 und 7 px unter der Unterkante; echter Tipp 1 px über der Unterkante | beide reagieren | an allen vier Punkten trifft es den eigenen Knopf (Toggle-Fläche 45 × 45, Griff 112,7 × 44). Der Tipp schaltet das Vollbild ein und wieder aus; der Griff öffnet die Leiste. 393, 360 und 320, beide Engines | **bestanden** |
| Regler, 44-px-Ziele | Trefferfläche jedes Ziels in der Leiste | ≥ 44 × 44 | kleinste 44 × 45 (393, 360), 44 × 44 (320) | emuliert bestanden, Rest am Gerät: ob 44 px für den Daumen reichen |
| Leiste mit drei Reglern, Curve-Chips | Chip-Zeile gegen die Leistenbreite, Lücken über eine Linie durch die Chips, Chips je Zeile, volle Kachelreihen | Chips über die ganze Breite, zwei Reihen bleiben; unter 348: 4 + 3, 320: Leiste 212 | 393: Chips 8 → 385 bei Leiste 0 → 393, 7 je Zeile, 50,4 breit, Fläche ≥ 51,4 × 45, tot nur die 6 Fugen (18 von 377 px); 3 volle Reihen. 360: 7 × 45,7, 3 Reihen. 347: Leiste 195, 348: 151. 320 × 568: 4 + 3, Chip 73 breit, Leiste **212**, 2 volle Reihen. Die Seite scrollt bei 568 Höhe nicht (Überlauf 0), sie ist `cramped`. Quer (812 × 375, 734 × 343, 814 × 380): 2–3 volle Reihen | **bestanden** |
| „Erst bestätigen" mit Touch | Feld per Tipp fokussiert, Zahl getippt, dann Chip zweimal getippt | 1. Tipp bestätigt nur, 2. setzt | Plan-Leiste, `Players` 40 → 50 unbestätigt, Tipp auf `Curve steep`: 1. Tipp `players` 50 gepinnt, Curve bleibt `moderate`; 2. Tipp Curve `steep`. `Details`, `Served ranks` 14 → 12, Tipp auf `top 8`: 1. Tipp `depth` 12 gepinnt, Stufe bleibt `topThird`; 2. Tipp Stufe `top8`, `depth` 8, Zahl entpinnt (der Pin liegt jetzt auf der Stufe). Beide Engines | emuliert bestanden, Rest am Gerät: Tipp bei offener iOS-Tastatur; dazu **Befund B1** |

**Befund B1 — Antippen eines Zahlenfelds markiert in WebKit nicht den Inhalt.**
`@focus="$el.select()"` (`views/control-row.php`) soll den Inhalt markieren, damit Tippen ihn
ersetzt. Mit echtem Touch-Tipp in WebKit steht danach die Einfügemarke mitten im Text
(`selectionStart` = `selectionEnd` = 1 bei „40" und „14"). Chromium markiert ganz (0 → 2).
Folge in WebKit: Tipp aufs `Players`-Feld (40), dann „50" tippen, ergibt **4500**, und nach dem
Bestätigen steht `players` auf 4500. Gemessen bei 393 × 659, hell, `devices['iPhone 15']`.
Schritte: Seite laden, `Players` in der Leiste antippen, „50" tippen, Feld verlassen.
Wahrscheinliche Ursache: Die Engine setzt die Einfügemarke nach dem `focus`-Handler an die
Tippstelle. Ob iOS Safari dasselbe tut, ist **am Gerät zu bestätigen**. Nicht behoben.

### Zoom und Ziehen

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Gummiband | `overscroll-behavior` | Seite fest, Seiten scrollen | `html` und `body` `none`, `.page-plan/-details/-prepare` `contain` | emuliert bestanden (Vorbedingung), Rest am Gerät: Ziehen und Zurück-Wischen |
| Fokuszoom | Schriftgrösse aller Textfelder; Viewport-Meta | ≥ 16 px, Pinch erlaubt | alle 16 px; `width=device-width, initial-scale=1, viewport-fit=cover` (ohne `maximum-scale`, ohne `user-scalable=no`) | emuliert bestanden (Vorbedingung), Rest am Gerät: ob iOS zoomt |
| Doppeltipp-Zoom | `touch-action` | Bedienelemente `manipulation`, freie Fläche nicht | alle `button` und `.tile` `manipulation`, `body` `auto`. Doppeltipp auf `+` zählt zweimal (40 → 42) | emuliert bestanden (Vorbedingung), Rest am Gerät: der Zoom selbst |
| Blasen unter Pinch-Zoom | — | — | `visualViewport.scale` bleibt in Emulation 1 | nur am Gerät |

### Blasen

WebKit hell bei 393 × 852, 393 × 659 und 360 × 780; WebKit dunkel bei 393 × 852; Chromium hell
an allen drei. Alle Zahlen sind in beiden Engines und Modi gleich (± 0,1 in `bottom`). Für die
Share-Blase ist `navigator.share` per Init-Skript entfernt, sonst nimmt WebKit den System-Zweig.

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Kachelblase und Rückfrage (#167) | `left → right` der Blase, `+` antippbar, echter Tipp auf `+` | 393: Kachel 6 93 → 385, Kachel 1 8 → 248, Reset-all 93 → 385; überall ≥ 8 Rand | 393: Kachel 6 **93 → 385**, Kachel 1 **8 → 247,7**, Kachel 6 nach `+` („by hand") **93 → 385**, Reset-all mit 1 Wert **93 → 385** (y 50–184,7), mit 3 Werten **93 → 385** (y 50–219,8). 360: 60 → 352 bzw. 8 → 247,7. Bei 659 Höhe gleich | emuliert bestanden, Rest am Gerät: echtes iOS-WebKit |
| Nach Doppeltipp auf ±: Share-Blase, ⓘ Game und Type | Lage nach zwei schnellen Tipps auf `Players +` | ganz im Bild, 8 Rand | Share 93 → 385 (y 50–138), ⓘ Game 8 → 300, ⓘ Type 93 → 385; 360: 60 → 352 | emuliert bestanden, Rest am Gerät: mit echtem Doppeltipp-Zoom |
| ⓘ schliesst beim Scrollen von `Details` | ⓘ Type offen, `Details` gescrollt | folgt, schliesst, wenn das ⓘ die Seite verlässt | nach 20 px offen und mitgeführt (y 124 → 104); nach 136 px zu | emuliert bestanden, Rest am Gerät: mit dem Finger gescrollt (hier `scrollBy`) |

### Raster, Ring, Puls

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Ring der offenen Kachel, oberste Reihe | Ring (Kachel ± 3) gegen die Padding-Box von `.plan-grid`, oben / links / rechts; Pixel 1,5 px ausserhalb der Kachel | an allen vier Seiten sichtbar | 393 × 659: Kachel 1 5 / 19 / 314, Kachel 6 5 / 314 / 19. 360 × 640: 5 / 5 / 295,8 bzw. 5 / 295,8 / 5. Pixel oben, links und rechts `rgb(140,90,43)` = `--accent` (hell), kein Hintergrund. Beide Engines | **bestanden** (s. Beobachtung zu 320) |
| Puls bei Rang 1 | Animation `tile-hit` bei 35 % angehalten, Ring-Rechteck (Kachel skaliert ± 5 × Skala) | oben ganz; seitlich bei 393 ganz, bei 360 rund 1,4 px über den Rand | Skala 1,14, Ebene im Top Layer (`:popover-open`), Beschnitt `inset(-25px …)`. 393: oben 188,9 (1,48 über dem Raster), links 12,52 / rechts 12,52. 360: links **−1,41** (Kachel 1), rechts **−1,41** (Kachel 6) | emuliert bestanden (wie #168 K1), Rest am Gerät: ob man die 1,4 px sieht |
| Weiches Scrollen zum Treffer | `players=96&depth=96`, Würfe bis der Topf leer ist, 1,6 s gewartet, sichtbarer Teil der getroffenen Kachel | Treffer ganz über der Leiste | 393 × 659 und 360 × 640: 5 von 5 Würfen je 54 / 54 px. 812 × 375: 42 / 54 (s. 3 · „nach dem Wurf") | emuliert bestanden, Rest am Gerät: das weiche Scrollen von iOS |
| Gerätepixel-Rundung, zweite Reihe | WebKit, DPR 3; Höhe 520 → 900 in 1-px-Stufen bei 393, 360 und 375; Abstand Unterkante Reihe 2 → Fenster, `elementFromPoint` 0,5 px über der Unterkante | nie angeschnitten | kleinster Abstand **0,0000** (nie negativ), Ecke trifft in allen 3 × 381 Stufen die Kachel | **bestanden** |

**Beobachtung (ohne Soll) — 320 × 568:** Die Kachelblase von Kachel 1 steht bei 8 → 247,7,
y 8–166, und deckt die eigene Kachel (109–163) samt Ring zu. Über und unter der Kachel ist zu
wenig Platz für die 158 px hohe Blase. #168 hat 393 und 360 gemessen, für 320 gibt es kein Soll.

### Seiten, Fuss, Farben

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Tippen am Fuss | `-webkit-tap-highlight-color`; blaue Pixel im Fuss vor dem Tipp und 0 / 30 / 110 / 310 ms danach | kein Blau | `rgba(0,0,0,0)` an allen Knöpfen, Links und `.foot-item`; blaue Pixel 0 / 0 / 0 / 0 / 0 (beide Engines, hell und dunkel) | emuliert bestanden, Rest am Gerät: das Tipp-Highlight von iOS zeichnet Headless nicht |
| Seitenwechsel, Markierung waagrecht, Blende | je Frame nach dem Tipp `Details → Plan`: Markierung x, Opazität `Plan`, Diagramm | kein Frame ohne Diagramm, Markierung gleitet | WebKit 393: x 262 → 235 → 193 → 166 → 149 → 139 → 133 → 131 bei 1–145 ms, Opazität 0,16 → 1 bis 168 ms, Diagramm in jedem Frame da. Chromium ebenso (Ende 145–163 ms) | emuliert bestanden, Rest am Gerät: wie die Blende mit dem kurzen `--bg` wirkt |
| Bronze/Foil, Umschalter, Neuladen | Modus gegen das System gesetzt, neu geladen, im ersten `requestAnimationFrame` gelesen | überlebt das Neuladen, kein Aufblitzen | hell-System → `dark` gesetzt: nach dem Neuladen im ersten Frame `data-theme=dark`, `body` `rgb(19,18,16)`; dunkel-System → `light`: erster Frame `light`, `rgb(236,225,203)`. Beide Engines | emuliert bestanden, Rest am Gerät: Bronze/Foil auf echtem Schirm |
| Dunkelmodus auf OLED; ΔE 10,1 | — | — | — | nur am Gerät |
| Handout-Checkbox | echter Tipp auf den Text, dann aufs Kästchen; Zustand, Farbe, blaue Pixel um das Kästchen | an/aus, kein Blau | Text-Tipp: aus → an (`checked` und Einstellung), Kästchen `--accent` (hell `rgb(140,90,43)`, dunkel `rgb(201,153,46)`), Haken sichtbar. Kästchen-Tipp: an → aus, `--paper`, Haken `hidden`. Blau 0 in allen Zuständen (WebKit/Chromium × hell 393 / dunkel 360) | emuliert bestanden, Rest am Gerät: kein System-Kästchen, kein Aufblitzen |
| Kästchen lesbar, mittig zur ersten Zeile | Mitte Kästchen minus Mitte erster Zeile | 0, auch zweizeilig | 393 einzeilig **0,00**, 360 zweizeilig **0,00** (beide Engines) | emuliert bestanden, Rest am Gerät: Lesbarkeit hell und aus (Augenurteil), `1lh` unter iOS < 16.4 |
| Fussblock auf `Details` | ganz hinunter, 3 s gewartet: Linie, Köpfe, Reihenfolge, Trefferflächen | Linie, kein Kopf, Discord-Zeile oben, drei Links einzeln | `1px solid`, 0 Köpfe, `about-contact` vor `about-by`, Discord / ditshej.ch / GitHub je **45 × 45**, eigene Treffer; 393 hell und 360 dunkel, beide Engines | emuliert bestanden, Rest am Gerät: ob sich der Block als Seitenende liest, Daumen |

## 2 · Echte Schriften bei 320–360

WebKit, Mac-Schrift SF; Android-Schriften nicht gemessen.

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Schiene, Höhe, sechs Kacheln | Leistenhöhe, Kachelbreite, volle Reihen | Schiene 101–117 am Bild; Kacheln lesbar (320: ≈ 46) | Leiste 320/330: 212, 340/347: 195, 348: 151, 360+: 124; Kachel 320: **46,5**, 330: 48,2, 340: 49,8, 360: 53,2; immer 6 Spalten, ≥ 2 volle Reihen | emuliert bestanden, Rest am Gerät: Geräteschriften (Android) und Lesbarkeit |
| Plan-Kopf, Ausgabezeile | `scrollWidth/clientWidth`, `overflow-x`, Kopfhöhe | scrollt bei 320–340 seitlich, Kopf einzeilig | `players=64&depth=32`: 320 **254/220**, 340 254/240 (`auto nowrap`), Kopf 40; ab 360 passt sie (260/260). Startadresse: passt überall. `release&players=128` bei 374/375: passt (274/274) | emuliert bestanden, Rest am Gerät: Ziehen mit dem Finger, breitere Geräteschriften |
| `Details` mit 286 | Spalte bei 674 × 760, 674 × 399, 900 × 700: Überlauf, Elemente über dem rechten Rand | kein waagrechter Überlauf | Breite 286, `scrollWidth − clientWidth` **0**, 0 Elemente über dem Rand; Gruppentitel 31–32 hoch | emuliert bestanden, Rest am Gerät: echte Schriften |
| Satz zum leeren Topf | `top 8`, Würfe bis der Topf leer ist; Zeilen und Höhe des Satzes | — (bisher zweizeilig bei 436 und 812) | 436 × 380 und 812 × 375: **einzeilig** (15,6 hoch), Leiste 144, frei 117 / 112 | emuliert bestanden, Rest am Gerät: Geräteschriften |

## 3 · iPhone Safari, quer

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| 812 × 375 | Faltung, Fuss, Leiste, Reihen | Menü rechts senkrecht, zwei volle Reihen, Reglerspalte | flach, Fuss 764 / 48 × 375, `rail = column` ab x 478, 2 volle Reihen (Fenster 175,7–317). Mit Leisten (734 × 343): flach, Spalte, 3 Reihen; 814 × 380 / 844 × 390: 2 Reihen | emuliert bestanden, Rest am Gerät: Ziffernblock über der Reglerspalte, echte Leisten |
| 812 × 375 nach dem Wurf | Leiste und *frei* nach dem 1. Wurf (`winnerPacks=16`) | #121: 56,6 frei, eine Reihe (Lauf 15). **Überholt:** Runde 142·145 **K1** (44 px vor der freien Reihe), neues Soll 24 px (Lauf 17) | Leiste offen 144, nach dem Wurf **224**, frei **32** (≥ Soll 24); getroffene Kachel 42 / 54 sichtbar. Beide Engines gleich, kein Unterschied von 5 px zwischen den Browsern | emuliert bestanden gegen K1, Rest am Gerät: mit Leisten messen. Der Text in #121 nennt das alte Soll |
| 667 × 375 (SE quer) | Faltung, Rangmeldung unter 351 | flach; unter 349 bisher bis 8,9 px ausserhalb | flach, ohne Reglerspalte (667 < 722), 2 Reihen. 351 / 349 / 348 / 340 / 330 Höhe: Rangmeldung endet genau am unteren Rand (z. B. 322–349, 313–340), **0 px** ausserhalb, auch mit `players=64&depth=32` | emuliert bestanden, Rest am Gerät: ob die Leisten die Höhe so weit drücken |
| `100dvh` mit Leisten | — | — | — | nur am Gerät |
| Flache Plan-Seite unter 281 Höhe | Überlauf von `.page-plan` bei 812 × 300 … 250 | ab 280 scrollt sie, bis 31 px | 281: 0, 280: 0, 270: **10**, 250: **30**; Rangtotal 230–245 | emuliert bestanden, Rest am Gerät: ob ein Gerät so niedrig wird |
| 932 × 430 | Faltung | zweispaltig, nicht flach | `columns 2`, nicht flach; 926 × 428 ebenso | emuliert bestanden, Rest am Gerät: Höhe mit Safari-Leisten (unter 399 wird es flach) |
| Touch auf Griff und Chip im 48-px-Streifen | Trefferfläche bei `depth=32`, Meldung eingefaltet | treffbar ab 674 | 674 × 760: Chip 113,7 × 45, Griff `Prepare` 141,2 × 45; 900 × 700 gleich; flach 812 × 375: Chip 113,7 × 45, Fusseinträge 49 × 53 | emuliert bestanden, Rest am Gerät: Daumen |
| Rücknahmezeile | 7 Würfe, `winnerPacks=16`: Liste, Überlauf, `overscroll-behavior-x`, Scrollbalken, Chips, Pfeile | seitlich scrollend, ohne Balken; Chips und Pfeile ≥ 44 (#142, 4) | 436 × 380: eine Zeile, 542 auf 348, `overflow-x: auto`, `overscroll-behavior-x: contain`, `scrollbar-width: none`, Balkenhöhe 0; Chips 74–76 × 45. Pfeile `‹ ›` 24 × 12 gezeichnet, Fläche **26 × 27** bzw. **45 × 27**. 435 × 380 ebenso. 812 × 375: die Zeile passt, keine Pfeile | **Befund B2**; Rest am Gerät: Ziehen und Zurück-Wischen |
| Markierung senkrecht beim Seitenwechsel | 812 × 375, `Plan → Details`, je Frame | gleitet, endet auf dem Eintrag | y 161,8 → 212 → 234,4 → 250,5 → 260,2 → 265,6 → 268 → 268,3 bei 3–163 ms, x fest 764; Ende = Eintrag 268,3, 48 × 52 | **bestanden** |
| Sichere Bereiche, beide Drehrichtungen | — | — | `env()` ist 0 | nur am Gerät |

**Befund B2 — Die Pfeile `‹ ›` der Rücknahmezeile sind 27 px hoch treffbar.** #142, Punkt 4,
verlangt „Touchziele mindestens 44 px, überall". Die einzige benannte Ausnahme sind die
Bereichsstufen unter 348 (K3). Bei 436 × 380 und 435 × 380 (`winnerPacks=16`, 🎲, sieben Würfe)
sind die Pfeile in `.raffle-scroller` 24 × 12 gezeichnet. Die Trefferfläche misst 26 × 27 (`‹`,
links teils vom Chip daneben genommen) und 45 × 27 (`›`). WebKit und Chromium, hell. Lauf 17
hat die Pfeile nicht gemessen; sie erscheinen erst, wenn die Zeile überläuft. Nicht behoben.

## 4 · Home-Bildschirm-App (Standalone)

Alle sieben Punkte: **nur am Gerät**. Standalone und `env(safe-area-inset-*)` lassen sich nicht
emulieren. Die Lage mit gesetzten `--inset-*` ist in #158 gemessen
(`73-abnahme-am-bild.md`, „#158 · Hülle").

## 5 · Share

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| [https] Teilen-Ansicht; geteilter Link | `navigator.share` per Init-Skript protokolliert; der geteilte Link in neuem Tab geöffnet | System-Zweig, der Link öffnet den Stand | Tipp auf Share: genau 1 Aufruf `{ url: "https://prizing.optcg.ch/?v=1&game=onepiece&type=weekend&players=48&curve=steep" }`, keine Blase. Der Link öffnet Weekend, 48 Spieler, Curve `steep`, beide gepinnt. WebKit und Chromium | emuliert bestanden, Rest am Gerät: die native Ansicht |
| [https] Safari Mac / iPad | WebKit ohne `isMobile`, 1280 × 800, `navigator.share` nativ vorhanden | System-Zweig | `navigator.share` ist eine Funktion, der Klick ruft sie mit der vollständigen Adresse, keine Blase | emuliert bestanden, Rest am Gerät: das Menü selbst |
| [https] `NotAllowedError` nach Abbruch | — | — | iOS-Verhalten | nur am Gerät |
| Über `http` | `http://prizing.optcg.ch/`: sicherer Kontext, Zweig, `Copy link` | Blase; `execCommand` oder vorselektiertes Feld | `isSecureContext` false, `navigator.share` und `navigator.clipboard` fehlen. Share öffnet die Blase 93 → 385. `Copy link` meldet `Copied` (der `execCommand`-Weg gelingt), nach 2,1 s wieder `Copy link`; das Feld erscheint darum nicht. WebKit und Chromium | emuliert bestanden, Rest am Gerät: Fokus und Markierung des Felds, falls `execCommand` dort scheitert |
| „Link copied" / `Copied` | https ohne `navigator.share`: Blase, Knopf, Zwischenablage | sichtbar, lesbar, ≈ 2 s, kopiert | Blase 93 → 385, y 50–138, Grund `rgb(255,253,248)`, Text `rgb(36,28,18)` 12,48 px; `Copied` sofort, nach 2,1 s weg. Zwischenablage (Chromium, gelesen) = vollständige Adresse | emuliert bestanden, Rest am Gerät: Lesbarkeit, Kopieren in echtem Safari |

**Beobachtung:** `http://prizing.optcg.ch/` leitet nicht auf https um, sondern liefert die App
aus (200). Für den LAN-Test war das nützlich. Ob es so gewollt ist, steht in keinem Entscheid,
den ich gefunden habe.

## 6 · Android Chrome

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Regler, 44 px | wie 1 (Chromium) | ≥ 44 | kleinste 44 × 45 / 44 × 44 | emuliert bestanden, Rest am Gerät: Daumen |
| Tippen am Fuss | wie 1 (Chromium) | kein Blau | 0 blaue Pixel, Highlight transparent | emuliert bestanden, Rest am Gerät: Highlight von Chrome Android |
| Abschnitt 2 mit Android-Schriften | — | — | Roboto steht hier nicht zur Verfügung | nur am Gerät |
| Taktfolge auf langsamem Gerät; B13 | Chromium, Pixel 7, CPU × 6; je Frame nach dem Wurf: Leistenhöhe, Polster, Diagramm; Überlauf am Fuss | still nach höchstens vier Frames | 812 × 375 und 393 × 659: Leiste, Polster und Diagrammurteil stehen ab dem **4. Frame** (Index 3, ≈ 119 ms). Treffer 42 / 54 bzw. 54 / 54. Überlauf am Fuss 0 / 0 / 0 | emuliert bestanden, Rest am Gerät: echtes langsames Gerät; B13 liess sich ohne `page.evaluate` nicht herstellen |

## 7 · Desktop und iPad

| Punkt | was gemessen | Soll | Ist | Urteil |
|---|---|---|---|---|
| Freies Ziehen eines Fensters | — | — | — | nur am Gerät |
| Flache Bühne, 721/722 quer | Faltung, Reglerspalte, Reihen, Diagramm bei 721/722 × 380, × 340 und × 399 | unter 722 keine Regler, ab 722 die Spalte, je zwei Reihen; Diagramm gibt nach (Ersthöhe 399) | 721 × 380: flach, `rail none`, 11 Spalten, 2 Reihen, Diagramm 68,3. 722 × 380: flach, `rail column` (ab x 388), 6 Spalten, 2 Reihen, Diagramm 68,3. × 340: Diagramm **0**, 2 bzw. 3 Reihen. × 399: zweispaltig, nicht flach | **bestanden** |
| iPad quer, Fussstreifen mit Inset | — | — | `env()` ist 0 | nur am Gerät |
| iPad, Scrollbalken in der Spalte | — | — | — | nur am Gerät |

## Zusammenfassung

- **Abgehakt (ganz emulierbar, bestanden):** 6. Es sind Vollbild-Toggle/Griff an der Unterkante,
  Leiste mit Curve-Chips, Ring der offenen Kachel, Gerätepixel-Rundung, Markierung senkrecht
  und 721/722 quer.
- **Gemischt, emulierter Teil gemessen, Notiz am Punkt:** 35.
- **Nur am Gerät, unberührt:** 17.
- **Befunde:** B1 (Zahlenfeld markiert in WebKit beim Antippen nicht, „50" ergibt 4500) und B2
  (Pfeile `‹ ›` 27 px hoch).
- **Beobachtungen ohne Soll:** Die Kachelblase deckt bei 320 × 568 die eigene Kachel, und http
  leitet nicht auf https um.
- **Überholtes Soll im Issue:** 812 × 375 nach dem Wurf, 56,6 → 24 (K1 der Runde 142·145).
