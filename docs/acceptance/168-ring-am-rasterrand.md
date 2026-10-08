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

## Puls `tile-hit` am Scheitel (35 %, `scale(1.14)`, Ring 5 px)

| Leinwand | oben vorher → nachher | Seite vorher → nachher |
|---|---|---|
| 393 × 852 | −9,48 → **−1,48** | 4,52 → 12,52 |
| 360 × 780 | −9,48 → **−1,48** | −9,41 → **−1,41** |
| 852 × 393 (Inset 59) | −9,48 → **−1,48** | 8,02 → 16,02 |

**Offen:** Der Puls reicht am Scheitel 9,48 px über die Kachel hinaus (im
Ausklingen bis rund 10 px bei halber Deckkraft). Mit höchstens 8 oben (Bühnenabstand)
und 8 seitlich (Bühnenpolster) bleibt am Scheitel 1,5 px Schnitt — oben immer,
seitlich bei 360. Das Kriterium „nicht geschnitten" und die Schranke „≤ 8" sind
mit dem heutigen Puls zusammen nicht erfüllbar.
