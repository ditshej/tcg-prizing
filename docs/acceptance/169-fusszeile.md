# Abnahme — #169 Infobereich auf Details als Fusszeile der Seite

Gemessen am echten App-Stand, nie „sieht gut aus".

- **Stand:** Zweig `feat/169-infobereich-fusszeile`, auf `main` `b9471ce`
- **Server:** `php -S localhost:8769 -t public` aus der Worktree-Wurzel, PHP 8.3.33
- **Browser:** WebKit **und** Chromium über Playwright 1.64, Skripte unter `/tmp/pw/169`, nicht im Repo
- **Kontext:** `devices['iPhone 15']`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`; für Chromium ohne `defaultBrowserType`
- **Faltungen:** Seite (393 × 852, 360 × 852; `data-columns="1"`, über den Fuss auf `Details`) und Spalte (900 × 852 → `data-columns="2"`, 1400 × 900 → `data-columns="3"`), je hell und dunkel
- **Messmittel:** berechnete Stile, `getBoundingClientRect`, `elementFromPoint`; `Details` ganz hinuntergescrollt, dann **3 s gewartet** (siehe „Messfalle")

## Form (Entscheid F1 = b)

Alle 16 Fälle (2 Browser × 4 Breiten × hell/dunkel) gleich:

| Grösse | Ziel | gemessen |
|---|---|---|
| Linie vor dem Block | `1px solid var(--line)` | `1px solid` in genau dem Wert von `--line` (hell `rgb(226, 213, 190)`, dunkel `rgb(53, 49, 42)`) |
| Kopf unter der Linie | keiner | 0 Elemente `h1–h4`/`*head*` im Block |
| Abstand letzte Gruppe → Linie | 26 (der einer Gruppe) | 26 |
| Zeilen | zentriert | `text-align: center`, `justify-content: center`, beide |
| Grösse | gleich, klein | beide `11.2px` (`0.7rem`) |
| Farbe | `--muted` | Block, beide Zeilen und alle drei Links = `--muted` (hell `rgb(122, 106, 85)`, dunkel `rgb(154, 147, 132)`) |
| Links | nur Gewicht | `font-weight` 700 gegen 400 der Zeile, `text-decoration-line: none`, Grösse `11.2px` wie die Zeile |
| Reihenfolge | Discord, dann Urheberzeile | `about-contact` oben, `about-by` 44 darunter |
| Lage | ganz unten, nach der letzten Gruppe | letztes Kind von `.page-details`, Spalte bis ans Ende gescrollt |

Bei 360 (und zusätzlich geprüft bei 320) brechen die Zeilen nicht um: jede bleibt 44 hoch.

## Trefferflächen

Je Link: Ausdehnung der Fläche durch Abtasten mit `elementFromPoint` von der Mitte aus, dazu
die Mitte und 20 px darüber und darunter (Treffer gilt nur, wenn `closest('a')` **dieser** Link
ist, verglichen über `href`).

| Link | Fläche (alle 16 Fälle) | Mitte / −20 / +20 |
|---|---|---|
| `ditshej` → Discord | 44 × 44 | eigener Link |
| `ditshej` → ditshej.ch | 44 × 44 | eigener Link |
| `GitHub` → Repo | 44 × 44 | eigener Link |

Keine Fläche liegt über einem anderen Link: die beiden Zeilen stehen 44 auseinander, die zwei
Links der Urheberzeile 96 (393) von Mitte zu Mitte, mit „with AI |“ dazwischen.

Die Handout-Checkbox (`.sheet-check`) ist **nicht** das letzte Bedienelement über der
Fusszeile — sie steht in *Split the pool*, darunter folgt noch die Gruppe *Winner packs*.
Abstand ihrer Unterkante zur Linie: 371 (393), 424 (360), 457 (Spalte). Keine Berührung.

## Messfalle: WebKit-Scrollbalken in der Spalte

Direkt nach dem Scrollen zeigt WebKit (Desktop-Build) in der Spalte einen Overlay-Scrollbalken,
der rechts etwa 16 px Treffer schluckt: der Discord-Link, der in der 286 breiten Spalte bis
x = 887 reicht, mass dann **38** × 44. Nach 3 s ist der Balken weg und die Fläche misst 44 × 44.
Chromium zeigt das nicht. In der Seitenfaltung liegt der Link weit vom Rand (endet bei x = 326).
Ob ein iPad in der Spalte dasselbe tut, ist hier nicht gemessen; vermutet wird nein, weil
iOS-Scroll-Anzeiger keine Treffer nehmen.
