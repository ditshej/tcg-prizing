# Abnahme — #170 Eigener Haken für die Handout-Checkbox

Gemessen am echten App-Stand, nie „sieht gut aus".

- **Stand:** Zweig `feat/170-handout-haken`
- **Adresse:** `http://localhost:8770/`, Server `php -S localhost:8770 -t public` aus der Worktree-Wurzel, PHP 8.3.33
- **Browser:** WebKit 27.2 **und** Chromium 156.0.8078.4, beide über Playwright 1.64; Skripte unter `/tmp/pw/170/` (`m.mjs`, `flash.mjs`), nicht im Repo
- **Kontext:** `devices['iPhone 15']`, Viewport 393 × 852 und 360 × 852, `deviceScaleFactor: 3`, `isMobile`, `hasTouch`; für Chromium ohne `defaultBrowserType`. Je `colorScheme: 'light'` und `'dark'`. Die Messung des ersten Bilds lief zusätzlich bei 1400 × 900, wo `Details` als Spalte beim Laden dasteht.
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `Range.getClientRects()` für die erste Textzeile; die Farben der Tokens über ein Probe-Element mit `var(--…)` aufgelöst und mit den berechneten Stilen von Kästchen und Haken verglichen; Pixel des Kästchens aus dem Screenshot über ein Canvas gelesen.
- **Tippen:** Playwright-Tap an den Koordinaten des Elements. Der Treffer geht dabei an das `::after` des Labels (die 44-px-Fläche aus #142 liegt über seinen Kindern), also ans Label selbst — so wie am Gerät.

## Kästchen und Haken (Sollwerte aus #170)

Gleich in allen acht Fassungen (WebKit/Chromium × hell/dunkel × 393/360):

| Zustand | Grösse | Hintergrund | Schatten | Haken |
|---|---|---|---|---|
| aus | 20 × 20 | = `--paper` | = `--btn-shadow` | `visibility: hidden` |
| an | 20 × 20 | = `--accent` | = `--glow` | sichtbar, `stroke` = `--on-accent`, 14 × 14, `stroke-width` 2 (Datei unverändert) |

Ecke 2 px (`--r-ctl`), kein `border`. Aufgelöste Werte:

| Token | hell | dunkel |
|---|---|---|
| `--paper` | `rgb(255, 253, 248)` | `rgb(30, 27, 22)` |
| `--accent` | `rgb(140, 90, 43)` | `rgb(201, 153, 46)` |
| `--on-accent` | `rgb(255, 248, 238)` | `rgb(20, 17, 12)` |

**Kein System-Kästchen, kein Blau.** Das native `<input>` misst 1 × 1, `clip-path: inset(50%)`, `appearance: none`, `display: block`, `visibility: visible` — fokussierbar und im Barrierefreiheitsbaum. Pixel mit Blau-Überhang (B > R + 30 und B > G + 10) im Ausschnitt um das Kästchen, aus und an: **0** in allen acht Fassungen.

## Bedienung

| Handlung | Ergebnis (alle acht Fassungen) |
|---|---|
| Tipp auf den Text des Labels | `checked` false → true, `settings.combinedHandout` false → true |
| Tipp aufs Kästchen | true → false, Einstellung mit |
| Tab auf das Input, dann Leertaste | `:focus-visible` = true, Ring am Kästchen `2px solid` in `--accent`; Leertaste schaltet an, zweite schaltet aus, Einstellung jedes Mal gleich |
| Trefferfläche | Label 377 × 44 (393), 344 × 59 (360, umbrochen) |

## Lage zur ersten Textzeile

Mitte des Kästchens minus Mitte der ersten Zeile (`getClientRects()[0]`):

| Breite | Zeilen | WebKit | Chromium |
|---|---|---|---|
| 393 | 1 | 0,00 px | 0,00 px |
| 360 | 2 | 0,00 px | 0,00 px |

Zeilenhöhe `normal`: 14,7 px in WebKit, 15 px in Chromium; das Kästchen folgt über `1lh`, darum in beiden 0.

## Kein Aufblitzen (#158, 10b)

`Details` ist vor dem Start von Alpine `x-cloak` — das Kästchen hat vor dem Binden gar kein Bild. Gemessen wurde darum zweierlei:

- **Ohne Alpine** (Skript blockiert, `x-cloak` von Hand entfernt, 1400 × 900): das Kästchen steht schon 20 × 20 in `--paper` mit `--btn-shadow`, das Input 1 × 1; 0 blaue Pixel. Das Kästchen ist reines CSS und braucht keine Bindung.
- **Bild für Bild** (`requestAnimationFrame` ab dem ersten Frame, 1400 × 900, WebKit dunkel und Chromium hell): Das erste sichtbare Bild des Kästchens trägt schon den richtigen Zustand — bei `?…&combinedHandout=1` sofort `--accent` mit `checked=true`, ohne ein Zwischenbild in `--paper`. Beim Umschalten genau ein Wechsel, kein Zwischenzustand, keine Transition.

Das Gerät selbst (iPhone Safari) steht noch aus und geht als Gerätepunkt an #121.
