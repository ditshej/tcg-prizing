# #168 · Der Ring der offenen Kachel am Rand des Rasters — Abnahme am Bild

Gemessen am 2026-10-08 mit Playwright 1.64 in **WebKit und Chromium**, Kontext
`iPhone 15` (`deviceScaleFactor 3`, `isMobile`, `hasTouch`), Plan
`?v=1&game=onepiece&type=weekly&players=96&depth=96` (48 Kacheln, das Raster
scrollt). Vorher = `main` `b9471ce`, nachher = Zweig `fix/168-ring-am-rasterrand`.
Beide Engines lieferten in jeder Zeile dieselben Zahlen.

## Gebaute Form

`.plan-grid`: `margin: -8px -8px 0`, `padding: 8px 8px 4px` (Longhands). Der
Prototyp (`.gridwin`, proto:748-755) hat `-5px -12px 0`. Seitlich gibt die Bühne
nur 8 her, oben gibt der Bühnenabstand 8 her. `.plan-grid-wrap` ist nicht mehr
positioniert, sonst deckt das obere Polster die Trefferflächen der Legende
(gemessen: Toggle und Griff 1, 4 und 7 px unter ihrer Unterkante trafen mit
positionierter Hülle `.plan-grid`, ohne sie den Knopf).

## Ring (Kachel ± 3 px) gegen die Padding-Box von `.plan-grid`

Freiraum in px, oben / links / rechts / unten; negativ = geschnitten. Gleich in hell und dunkel.

| Leinwand | Kachel | vorher | nachher |
|---|---|---|---|
| 393 × 852 | 1 | −3 / 11 / 306 / 274 | 5 / 19 / 314 / 274 |
| 393 × 852 | 6 | −3 / 306 / 11 / 274 | 5 / 314 / 19 / 274 |
| 393 × 852 | 48 (unten, ans Ende gescrollt) | 270 / 306 / 11 / 1 | 278 / 314 / 19 / 1 |
| 360 × 780 | 1 | −3 / −3 / 287,8 / 216 | 5 / 5 / 295,8 / 216 |
| 360 × 780 | 6 | −3 / 287,8 / −3 / 216 | 5 / 295,8 / 5 / 216 |
| 360 × 780 | 48 | 212 / 287,8 / −3 / 1 | 220 / 295,8 / 5 / 1 |
| 852 × 393 (flach) | 1 · 8 · 48 | oben −3 | oben 5, alle Seiten ≥ 1 |
| 780 × 360 (flach) | 1 · 7 · 48 | oben −3 | oben 5, alle Seiten ≥ 1 |

## Unverändert vorher → nachher (beide Engines, hell und dunkel)

Kachel 1 und die letzte der obersten Reihe (`getBoundingClientRect`), Spaltenzahl,
`--diagram-height`, Diagramm sichtbar, Fade-Bänder (Zustand **und** Höhe), am
Anfang und ans Ende gescrollt, mit offener Verlosung (inline `padding-bottom`
104 auf der flachen Bühne) und im Vollbild: **0 Abweichungen** bei 393 × 852,
360 × 780, 852 × 393, 780 × 360. Dazu 393 × 560 und die enge Bühne 360 × 520
(`data-cramped`): Kachel 1, Spalten und `--diagram-height` gleich.

Safe-Area quer (852 × 393, `--inset-left/right` auf 59 gesetzt): die linke Kante
von `.plan-grid` liegt genau an der Innenkante des Inset-Rands der Seite (0 px),
nie darunter. Vorher 8.

## Puls `tile-hit` — ausserhalb des Scrollers (Entscheid K1)

Entscheid K1 ([Kommentar an #168](https://github.com/ditshej/tcg-prizing/issues/168#issuecomment-6068726592)):
Der Puls bleibt, wie er in der App war — `scale(1.14)` bei 35 %, Ring 5 px, 900 ms, einmal —,
bewusst abweichend vom Prototyp (`hitpulse`, proto:741-747: 1,11 / 0,85 s / dreimal), und er wird
nie geschnitten. Die Abweichung ist im Prototyp unter `.gridwin` als „ÜBERHOLT durch #168 … nur Werte
und Ort des Pulses“ markiert (`prototype/rank-distribution`, 2ac7ea0), im Code an `@keyframes tile-hit`
und an `startPulse()` (`measure.mjs`).

### Gebaute Form

Der Puls läuft nicht mehr auf der Kachel im Raster, sondern auf einer **Kopie der Kachel** (Klassen,
`aria-expanded`, Inhalt; ohne `data-rank`, ohne Alpine-Attribute) in einer eigenen Ebene `.tile-pulse`
neben dem Raster in `.plan-grid-wrap`, als `popover="manual"` im Top Layer (ohne Popover:
`position: fixed`). Die Ebene steht auf dem `getBoundingClientRect` der Kachel und wird jedes Bild neu
gesetzt (Scrollen von Raster und Seite, Resize). Die Kachel im Raster ist derweil nur durchsichtig
(`.tile-pulsing`, `opacity: 0`) und bleibt antippbar. Weg ist die Ebene bei `animationend`, spätestens
nach 900 + 300 ms, oder wenn der nächste Treffer beginnt. `prefers-reduced-motion` wie bisher (1 ms).

Beschnitt der Ebene (`pulseClip()`, `geometry.mjs`): die Padding-Box des Rasters, an allen Seiten um
die Reichweite des Pulses hinausgeschoben (`pulseReach()`, 17 px bei 54 px Kachel, obere Schranke für
Skala × grössten Ring). Unten höchstens bis zur Oberkante der offenen Verlosungsleiste: die Leiste
steht über dem Raster, der Puls bleibt darunter wie die Kachel. Eine Kachel ganz ausserhalb des
Fensters wird nicht gezeichnet.

### Am Scheitel (35 %, angehalten), oberste Reihe

Freiraum in px vom äusseren Ring-Rechteck (Kachel skaliert ± 5 px × Skala) zur nächsten schneidenden
Kante (Beschnitt der Ebene oder Bildschirmrand); negativ = geschnitten. Ziel: ≥ 0 auf allen Seiten.
Die Ebene liegt in jedem Fall im Top Layer (`:popover-open`), kein beschneidender Vorfahre.
Hell und dunkel liefern dieselben Zahlen.

| Leinwand | Kachel | oben (Ziel ≥ 0) | Seite (Ziel ≥ 0) | min. WebKit | min. Chromium | vorher `main` oben / Seite | vorher #173 `f50e713` oben / Seite |
|---|---|---|---|---|---|---|---|
| 393 × 852 | 1 | 15,52 | 12,52 | **12,52** | **12,52** | −9,48 / 4,52 | −1,48 / 12,52 |
| 393 × 852 | 6 | 15,52 | 12,52 | **12,52** | **12,52** | −9,48 / 4,52 | −1,48 / 12,52 |
| 360 × 780 | 1 | 15,52 | −1,41 (W) / −1,42 (C) | **−1,41** | **−1,42** | −9,48 / −9,41 | −1,48 / −1,41 |
| 360 × 780 | 6 | 15,52 | −1,41 (W) / −1,42 (C) | **−1,41** | **−1,42** | −9,48 / −9,41 | −1,48 / −1,41 |
| 852 × 393 (quer) | 1 | 15,52 | 16,02 | **15,52** | **15,52** | −9,48 / 8,02 | −1,48 / 16,02 |
| 852 × 393 (quer) | 8 | 15,52 | 33,02 | **15,52** | **15,52** | −9,48 / 8,02 | −1,48 / 16,02 |
| 320 × 568 (zusätzlich) | 1 · 6 | 15,52 | −0,97 / −0,94 (W), −0,95 / −0,96 (C) | **−0,97** | **−0,96** | — | — |
| 780 × 360 (zusätzlich) | 1 · 7 | 15,52 | 9,52 · 26,52 | **9,52** | **9,52** | — | — |

Der Ring reicht oben überall 1,48 px über die Oberkante des Rasters hinaus (über dessen 8-px-Polster
hinaus) und wird dort gezeichnet: Pixel in diesem Streifen (Mitte der Kachel, 0,4 px unter der
Ring-Aussenkante) ist bei `main` Hintergrund, jetzt Ringfarbe — WebKit hell `rgb(139,89,43)` statt
`rgb(236,225,203)`, dunkel `rgb(193,147,44)` statt `rgb(19,18,16)` (`--accent` #8c5a2b / #c9992e;
Chromium dort kantengeglättet `rgb(186,155,120)` / `rgb(104,82,29)`). `elementFromPoint` unter dem
Punkt: `.legend-item` / `.plan-legend`, bei 360 und 320 an Kachel 6 der Vollbild-Knopf — der Puls
liegt also über der Legende. Der Ring selbst ist ein Schatten und nimmt keine Treffer an.

**Seitlich bei 360 und 320 schneidet nicht mehr der Scroller, sondern der Bildschirm.** Die äusseren
Kacheln stehen 8 px vom Rand (Bühnenpolster), der Puls reicht bei der schmaleren Spalte 9,41 px
(360) bzw. 8,96 px (320) über die Kachel. Die fehlenden 1,4 bzw. 1 px liegen ausserhalb des
Bildschirms, keine Überlage kann sie zeigen. Mit gleichem Puls und gleichem `transform-origin` ist
das nicht zu beheben — **offen, zu entscheiden** (siehe unten).

### Gleich wie vorher, wo `main` nicht schnitt

Bildausschnitt Ring-Rechteck ∩ Padding-Box des Rasters auf `main` (1 px eingerückt, die
Beschnittkante von `main` selbst ist kantengeglättet), Ebene gegen Puls auf der Kachel, beide am
35-%-Bild: **WebKit 0 abweichende Pixel** (max. Kanalabstand 0–2), **Chromium 0 Pixel über 8/255**
(max. 7) bei 393, 360 und quer; 320 Chromium Kachel 6: 4 Pixel, max. 36 (Kantenpixel am
Rasterrand). Ausnahme 780 × 360: die Konfliktmeldung (`.notice-conflict`) steht dort über dem
unteren Rasterrand und deckte bisher den unteren Ring; jetzt liegt der Puls 900 ms lang **über** ihr
(rund 5 500 Pixel). Dasselbe gilt für ein Fade-Band und die Blase, falls sie über der pulsenden
Kachel stehen.

### Folgen und Verschwinden (beide Engines, 393 × 852)

- Raster auf `scrollTop` 40, Puls auf Kachel 13, dann `scrollTop` + 30 während des Pulses: Ebene zur
  Kachel 0 px Abstand vorher und nachher.
- Resize 393 → 360 während des Pulses (Kachel 6): Ebene folgt auf 298,83 / 53,17 px Breite, gleich
  der Kachel.
- Treffer auf Kachel 40 (ausserhalb des Fensters): das Raster scrollt wie bisher 0 → 140; die Ebene
  ist versteckt, solange die Kachel draussen ist (1 bzw. 3 Bilder), und steht danach in jedem Bild auf
  der Kachel (0 px).
- Echte Würfe der Verlosung (je 4, 393 × 852 und 852 × 393, Leiste offen): Ebene in jedem Bild 0 px
  von der Kachel, nie über der Oberkante der Leiste gezeichnet, danach weg.
- Nach dem Puls: 0 Ebenen, 0 `.tile-pulsing`, 0 `[popover]`. Zweiter Treffer während des ersten:
  genau eine Ebene. `prefers-reduced-motion`: Dauer 1 ms, nach 120 ms keine Ebene.

### AK 1 und AK 3 nach dem Umbau

Kachel 1 und letzte der obersten Reihe gegen `main` `b9471ce`: 0,000 px Abweichung bei 393 × 852,
360 × 780 und 852 × 393, hell und dunkel, beide Engines. Ring der offenen Kachel gegen die
Padding-Box (oben / links / rechts): 393: 5 / 19 / 314 bzw. 5 / 314 / 19; 360: 5 / 5 / 295,84 bzw.
5 / 295,83 / 5; quer: 5 / 22,5 / 435,5.

Bilder: `/tmp/k1-shots/` (je Engine, Leinwand, Thema und Kachel, dazu `-main` zum Vergleich).

## Offen

- **Bildschirmrand bei ≤ 365 px Breite:** 1,41 px (360) bzw. 0,97 px (320) des Rings fallen
  seitlich über den Bildschirmrand. Möglich wäre: hinnehmen; den Ursprung der Skalierung an den
  äusseren Spalten um rund 10 px nach innen verschieben (der Puls wächst dort vom Rand weg); oder
  die Ebene am Scheitel um den Überstand nach innen rücken. Beides weicht vom heutigen Bild ab und ist
  darum nicht gebaut.
- **Über Meldung, Fade-Band und Blase:** Der Puls liegt 900 ms über allem, was über dem Raster steht,
  ausser der Verlosungsleiste (gemessen: Konfliktmeldung bei 780 × 360).
