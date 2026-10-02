# Abnahme am Bild — #73

Protokoll der Abnahme am Bild für Spec 2 (#61): je Leinwand die gemessenen Zahlen
neben den Sollwerten, nie „sieht gut aus".

- **Stand:** `main` bei `cd539a9` (nach Lauf 13), Zweig `feat/73-abnahme-am-bild`; Nachbau Lauf 14 (K1–K5) unter „Lauf 14"
- **PHP:** 8.3.33 (`php -v`), Entscheid K4 an #73
- **Server:** `php -S localhost:8773 -t public` aus der Worktree-Wurzel
- **Browser:** Chromium über Playwright MCP, Viewport per `setViewportSize`, Emulation `colorScheme` light / dark
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `elementFromPoint` für Verdeckung (Mitte und zwei Ecken jeder Kachel im Fenster)
- **Bilder:** `review/73-bilder/` (gitignoriert, nicht eingecheckt); jede Zeile nennt ihre Datei

## Sollwerte — woher sie kommen

Die Leinwand-Tabelle im Body von #73 (und in #61, `## Testing Decisions`) ist
**veraltet**. Massgebend sind die Entscheide aus Lauf 13 (Kommentar „Entscheide
des Maintainers — Lauf 13" an #71; `CONTEXT.md` › `Fold`; letzter Kommentar an
#61), nachgeschlagen, nicht hergeleitet:

| Grösse | Wert | Quelle |
|---|---|---|
| Erstbreiten | `Plan` 388 · `Details` 286 · `Prepare` 356 | #71 K-B9 |
| zwei Spalten ab | 674 | #71 K-B9 |
| drei Spalten ab | 1030 | #71 K-B9 |
| Deckel | 1597 | #71 K-B9 |
| Ersthöhe (Spaltenform) | 399 | #71 K-B8 |
| Höhenschwelle einspaltig | 351 + 56 + gemessene Schiene (keine feste Zahl; bis Lauf 14: 494) | #73 K2 (ersetzt #71 K-B10a) |
| flach ab Breite | 436 | #71 K-B10b |
| heisse Vier als Spalte auf der flachen Bühne ab | 722 | #71 K-B10c |
| Fuss / Streifen | 56 (Handy, drei Einträge) · 48 (ab 674) | #61, `fold.mjs` |
| Kachel, Lücke, Boden | 54 · 5 · 6 Spalten × 2 Reihen (113 px); unter 365 Breite schmaler als 54 | `CONTEXT.md` › `DistributionPlan`; #73 K3 |

Leinwände, aus den Entscheiden abgeleitet. Die Höhen der Zeilen, für die nur eine
Breite entschieden ist, sind hier gewählt: **673 × 760 / 674 × 760** (hoch genug,
dass beide Seiten der Breiten-Bruchstelle nicht flach sind: 760 ≥ 494 und ≥ 399)
und **1597 × 900** (ein üblicher Laptop-Schirm).

## Zustände und wie man sie herstellt

Basis-Adresse `http://localhost:8773/`. Ein Zustand ist eine Adresse plus Griffe:

| Zustand | Adresse | Griffe danach |
|---|---|---|
| `plain` | `?v=1&game=onepiece&type=weekly` | — |
| `conflictOpen` (stehende `ConflictNotice`) | `?v=1&game=onepiece&type=weekly&depth=32` | — |
| `conflictChip` | dieselbe | `.notice-conflict .notice-fold` (▾) |
| `raffle` (offene Verlosungsleiste) | `plain` | `.legend-handle` (🎲 auf `winner`) |
| `raffleChip` | `conflictOpen` | ▾, dann 🎲 |
| `raffleConflict` | `conflictOpen` | 🎲 |
| `fs` (Kachel-Vollbild) | `plain` | `.grid-fullscreen-toggle` (⤢) |
| `fsChip` | `conflictOpen` | ▾, dann ⤢ |
| `fsConflict` | `conflictOpen` | ⤢ |
| `fsRaffleChip` | `conflictOpen` | ▾, ⤢, 🎲 |

Bilddatei je Zeile: `review/73-bilder/<leinwand>-<modus>-<zustand>.png`, z. B.
`c1-393x830-dark-raffleChip.png`. Die Bilder **vor** den Reparaturen tragen
kein Präfix, die **danach** `fix1-…` (Verlosungsleiste) und `fix2-…` (Vollbild-Spalten).

**Hell und dunkel sind im Layout identisch:** alle Masse aller zehn Zustände auf
allen sieben Leinwänden wurden hell und dunkel gemessen und verglichen — null
Abweichungen. Die Tabellen unten gelten darum für beide Modi; die Farben stehen
eigens unter „Farbe".

## Je Leinwand: Soll und Ist

Abkürzungen: *Fenster* = sichtbarer Teil des Kachelrasters (oben–unten, px ab
Viewport-Oberkante); *R/B* = Abstand des Chips zur rechten/unteren Kante.

### 393 × 830 — Master (`c1-393x830-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 1 | 1 |
| Fuss | 56 px, drei Einträge | 774–830 = 56, `Prepare · Plan · Details` |
| Kachelspalten | ≥ 6 | 6 |
| volle Kachelreihen | ≥ 2, nicht angeschnitten | 2 (Fenster 516–629 = 113), kein Anschnitt |
| Chip (`conflictChip`) | unterste freie Ecke rechts, eine Zeile über dem Fuss | 271–381 × 732–766, R 12 · B 64 (Fuss ab 774), sichtbar |
| offene `ConflictNotice` | deckt zu, schiebt nichts | 12–381 × 634–766, über der Schiene, keine Kachel verdeckt |
| Verlosungsleiste | deckt keine Kachel zu | 8–385 × 647–766, Fenster endet 629 — keine Kachel |
| Vollbild | kein Fuss, kein Diagramm | Fuss weg, Diagramm weg, Fenster 68–795 |
| **Leiste + Chip, vorher** | Chip sichtbar | **Chip unter der Leiste** (`elementFromPoint` trifft `.raffle-range`) |
| **Leiste + offene Meldung, vorher** | Meldung anwesend (ADR 0002) | **Meldung 634–766 unter der Leiste 647–766**, sichtbar blieben 13 px |
| Leiste + Chip, nachher (F1) | Chip über der Leiste | Chip 605–639, Leiste ab 647, sichtbar (`fix1-c1-393x830-light-raffleChip.png`) |
| Leiste + Meldung, nachher (F1) | Meldung über der Leiste | Meldung 507–639, sichtbar |
| Vollbild + Leiste + Chip, vorher → nachher | Chip sichtbar | vorher verdeckt (Leiste 703–822) → nachher 661–695 sichtbar |
| Vollbild-Griff ⤢ | verdeckt keine Kachel | **verdeckt Kachel 6 auf 18 × 28 px samt ihrer `WinnerPack`-Marke** (A4) |

### 812 × 375 — flach (`c2-812x375-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten / flach | 1, flach | 1, flach |
| Menü | rechts senkrecht, nimmt Platz | `.foot` 48 breit × 375, drei Einträge; `Plan`-Seite 0–764 |
| heisse Vier | als Spalte neben dem `Plan` (≥ 722) | `rail = column` |
| Kachelspalten | ≥ 6 | 7 |
| volle Kachelreihen | 2, nicht angeschnitten | 2 (Fenster 204–317 = 113); Diagramm 86 |
| `Details` innen | zeilenweise, Gruppentitel über beide Spalten | `sheet-group` zweispaltig, `grid-auto-flow: row`; Titel „Supply", „Split the pool", „Winner packs" je 748 breit (beide Spalten) (`flat-details-812x375-light.png`) |
| `Prepare` innen | zeilenweise | `prep-items` zweispaltig, `row`; Seite scrollt nicht (375/375) |
| Chip | neben dem gedrehten Streifen, nicht darin | 642–752 × 333–367, R 60 (= 48 + 12) · B 8, sichtbar |
| offene `ConflictNotice` | deckt zu | 12–752 × 276–367, deckt Kacheln 8–11 (zweite Reihe) — erlaubt, die Meldung nennt ihre Ränge in Prosa |
| **Verlosungsleiste** | deckt keine Kachel zu | **8–756 × 248–367: Fenster frei nur 204–248 = 44 px, null volle Reihen; Kacheln 1–14 verdeckt** (A3) |
| Vollbild | kein Fuss | Fenster 68–340, 13 Spalten |
| Leiste + Chip / Meldung, vorher → nachher | sichtbar | vorher beide unter der Leiste → nachher Chip 206–240, Meldung 149–240, sichtbar |

### 673 × 760 — unter der Bruchstelle (`c3a-673x760-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 1 | 1, Schiene unter dem `Plan` |
| Fuss | 56, drei Einträge | 704–760 = 56, drei |
| Kachelspalten / Reihen | ≥ 6 / ≥ 2 | 11 / 2 (Fenster 471–584) |
| Chip | eine Zeile über dem Fuss | R 12 · B 64, sichtbar |
| **Verlosungsleiste** | deckt keine Kachel zu | **577–696, überlappt das Fenster um 7 px: eine volle Reihe + 47 px** (A3) |
| Vollbild | kein Fuss | Fenster 68–725, 11 Spalten |

### 674 × 760 — ab der Bruchstelle (`c3b-674x760-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 2: `Plan` 388 · `Details` 286 | 2: 0+388 · 388+286 |
| Streifen | 48, ein Griff (die eingefaltete Spalte) | 712–760 = 48, ein Eintrag `Prepare` |
| Kachelspalten / Reihen | ≥ 6 / ≥ 2 | 6 / 2 (Fenster 541–654) |
| Chip | im Streifen sichtbar | R 12 · B 7 (mittig in 48), sichtbar |
| offene Meldung | endet vor der Reglerspalte (K3) | 12–376, Reglerspalte ab 388; 5 Pin-Marken im Bild, 0 verdeckt |
| **Verlosungsleiste** | deckt keine Kachel zu | **585–704: frei 541–585 = 44 px, null volle Reihen** (A3) |
| Vollbild | kein Fuss | Fenster 68–725, 11 Spalten |

### 900 × 700 (`c4-900x700-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 2 | `Plan` 614 · `Details` 286 |
| Spaltenköpfe gleich hoch | gemeinsames Mass ist die Titelzeile; nur der `Plan` hat eine zweite Zeile | Titelzeile 23,5 / 23,5; Kopf `Plan` 41,5 (zwei Zeilen), `Details` 37,5 |
| Kachelspalten / Reihen | ≥ 6 / ≥ 2 | 10 / 2 (Fenster 481–594) |
| Chip | im Streifen | R 12 · B 7, sichtbar |
| offene Meldung | endet vor der Reglerspalte | 12–602, Reglerspalte ab 614; 5 Pin-Marken, 0 verdeckt |
| **Verlosungsleiste** | deckt keine Kachel zu | **525–644: frei 44 px** (A3, `c4-900x700-light-raffle.png`) |
| Vollbild | — | vorher 15 Spalten (unter 16, unauffällig) |

### 1280 × 760 (`c5-1280x760-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 3 | `Prepare` 356 · `Plan` 638 · `Details` 286 |
| Streifen | 48, linker Platz leer | 48, null Einträge |
| Kachelspalten / Reihen | ≥ 6 / ≥ 2 | 10 / 2 (Fenster 541–654) |
| offene Meldung | zwischen den Einzügen | 368–982 (Plan 356–994) |
| **Verlosungsleiste** | deckt keine Kachel zu | **364–986 × 585–704: frei 44 px** (A3) |
| **Vollbild, vorher** | höchstens 16 Kachelspalten (Deckel) | **21 Spalten** (A2) |
| Vollbild, nachher (F2) | 16 | 16 (`fix2-1280x760-light-release64-fs.png`) |

### 1597 × 900 — der Deckel (`c6-1597x900-*`)

| Prüfpunkt | Soll | Ist |
|---|---|---|
| Spalten | 3 | 356 · 955 · 286 |
| Kachelspalten | 16 | 16 (1596: 15) |
| Release ohne Vollbild | zwei Reihen | 32 Kacheln, 2 Reihen, alle im Fenster (`set-release-c6-1597x900-light.png`) |
| **Verlosungsleiste** | deckt keine Kachel zu | **725–844 über Fenster 681–794: frei 44 px** (A3) |
| **Vollbild, vorher → nachher** | 16 | **26 → 16** (F2) |

## Die drei Sets

`?v=1&game=onepiece&type=<weekly|weekend|release>`, Bilder `set-<set>-<leinwand>-<modus>.png`.
Auf allen sieben Leinwänden: Kachelspalten ≥ 6, volle Reihen ≥ 2, kein
waagrechter Scroll. Weekly und Weekend tragen 8 Kacheln, Release 32. Bei Weekend
steht beim Start ein `Offer` und deckt am flachen Schirm Kachel 8, bei 674
Kacheln 7–8 zu (Fläche des Stapels, erlaubt). Release am Deckel: zwei volle Reihen
ohne Vollbild.

## Die seltenen Zustände

| Zustand | Adresse / Griff | Ist | Bild |
|---|---|---|---|
| `Offer` auf dem exakten Vielfachen | `?v=1&game=onepiece&type=weekend&players=27` | „Rank 1 could take 1 sealed display instead of 24 loose boosters. The tile keeps its 24 — what changes is the packaging …", Knopf „Reserve 1 display for rank 1"; Chip „Offer" | `rare-offer-weekend27-<modus>-open.png`, `…-chip.png` |
| `CarryOverNotice` | `?v=1&game=onepiece&type=weekly&players=40&rankFloor=3`, dann Typ `Weekend` | „2 pinned values stayed behind. Players, Min boosters per rank — set by hand, so they do not follow Weekend.", Knopf „Drop all 2 and follow Weekend"; Chip „2 kept" | `rare-carryover-<modus>-open.png`, `…-chip.png` |
| Rückfrage aus dem `CarryOverNotice` | Knopf drücken | Blase 5,5 px über dem gedrückten Knopf, ganz im Bild, an 393 × 830, 812 × 375 und 900 × 700 | `dropbubble-<w>x<h>-light.png` |
| K-B2, Weekly | `?v=1&game=onepiece&type=weekly&judgeWinner=4&winnerPacks=10&manualWinner=29:1,30:1,31:1,32:1` | rot: **29, 30, 31, 32**; Meldung „8 winner packs placed, 2 over — the ranks hold 6. … on ranks 31 and 32"; Wege „Judge winner packs down to 1", „Winner packs by rank down to 2", „Drop rank 31's winner pack and rank 32's winner pack" | `kb2-weekly-<w>x<h>-<modus>[-scrolled].png` |
| K-B2, Release | `?v=1&game=onepiece&type=release&manualWinner=20:1` | rot: **nur 20**; „3 winner packs placed, 1 over — the ranks hold 2" | `kb2-release-…` |

K-B2 an 393 × 830 und 900 × 700, hell und dunkel, jeweils identisch. Weg 1 nennt
`judgeWinner` 1, nicht 2 (B1) — wie entschieden.

## Die Blase

`?v=1&game=onepiece&type=release&players=64`, Griff an der ersten Kachel, der
letzten der ersten Reihe und der letzten sichtbaren (`bubble-<w>x<h>-rank<n>.png`):

| Leinwand | Lage | im Rahmen | schliesst, wenn der Anker aus dem Fenster scrollt |
|---|---|---|---|
| 393 × 830 | über dem Anker, Abstand 5,6–5,8 (Soll `GAP` 6), seitlich an den Rand 8 geklemmt | ja (Bühne und Viewport) | ja, alle drei |
| 812 × 375 | dito | ja | ja |
| 900 × 700 | dito | ja | ja |
| 1597 × 900 | dito | ja | ja — aber der Anker Kachel 16 ist in der Mitte **vom Vollbild-Griff verdeckt** (A4) |

## Farbe

Gemessen an den Flächen der offenen Meldungen und am Ring der Chips (Farbe des
Rings = `currentColor`, Papier = Grund des Chips). ΔE nach CIE76 in Lab,
Kontrast nach WCAG.

| | hell | dunkel |
|---|---|---|
| Fläche `ConflictNotice` / `Offer` / `CarryOverNotice` | `#ffe1dd` / `#f3ecf6` / `#f0e4d1` | `#3d1b18` / `#2a2338` / `#2a2620` |
| ΔE Fläche K/O · K/C · O/C | 11,4 · 10,1 · 15,4 | 23,4 · 16,5 · 18,9 |
| Textkontrast auf der Fläche K · O · C | 7,10 · 6,85 · 13,38 | 7,76 · 7,62 · 12,78 |
| Chip-Ring K / O / C | `#96140f` / `#8a5f9c` / `#8c5a2b` | `#ff9f90` / `#a888c8` / `#c9992e` |
| ΔE Ring K/O · K/C · O/C | 70,6 · 36,8 · 62,8 | 54,0 · 45,7 · 89,7 |
| Ring gegen Papier K · O · C | 8,59 · 4,92 · 5,72 | 8,67 · 5,74 · 6,60 |

Urteil: unterscheidbar in beiden Modi. Das knappste Paar ist hell die Fläche
`ConflictNotice` gegen `CarryOverNotice` (ΔE 10,1); dort trennen zusätzlich die
Textfarbe (dunkelrot gegen fast schwarz) und das ⚠, das nur die `ConflictNotice` trägt.

## Faltung beim Ziehen — Näherung

Am Gerät nicht nachgestellt; hier genähert durch Treppen über
`setViewportSize`, je Stufe 180 ms Ruhe, gemessen mit einem minimierten
`ConflictNotice`-Chip (`?v=1&game=onepiece&type=weekly&depth=32&players=64`).

**Bruchstellen, beidseitig:**

| Grösse | Ist | Soll |
|---|---|---|
| 673 × 760 / 674 × 760 | 1 Spalte, Fuss 56, drei Einträge / 2 Spalten, Streifen 48, ein Eintrag; `Plan` 388 | ✓ |
| 1029 / 1030 (× 760) | 2 Spalten, `Plan` 743, 12 Kachelspalten / 3 Spalten, `Plan` 388, 6 | ✓ |
| 1596 / 1597 (× 900) | 15 / 16 Kachelspalten | ✓ |
| 435 / 436 (× 380) | Master (Ausnahme B14) / flach, Streifen 48 senkrecht | ✓ |
| 721 / 722 (× 380) | flach ohne heisse Vier, 11 Kachelspalten / flach mit Spalte, 6 Kachelspalten (die bewusst genommene Klippe) | ✓ |
| 900 × 398 / 900 × 399 | flach / 2 Spalten | ✓ |
| 600 × 493 / 600 × 494 | flach / einspaltig mit Schiene | ✓ |

**Treppen:** je Bruchstelle ±3 in 1-px-Schritten (674, 1030, 1597 bei 760 hoch;
436, 722 bei 380 hoch; 399 bei 900 breit; 494 bei 600 breit), dazu 320–2000 in
20-px-Schritten bei 830, 700, 500, 420 und 375 hoch und 300–1000 in 20-px-Schritten
bei 360, 393, 600, 900 und 1280 breit — **654 Stufen**. Ergebnis:

- Kachelspalten < 6: **nie**. Waagrechter Scroll: **nie**. Chip verdeckt oder ausserhalb: **nie**.
- Volle Kachelreihen: **immer 2** — das Raster hat `min-height: 113px` und wird nie
  kleiner. Was an knappen Bühnen nachgibt, ist nicht das Raster, sondern alles
  darunter: die **Rangmeldung** (und das Rangtotal) rutscht aus der `Plan`-Spalte
  unter die Schiene oder unter den Bildrand. Gemessen als Überstand der
  Rangmeldung über die Spalte:
  - in der Ausnahme B14 (< 436 breit **und** < 494 hoch), erwartet: bis 206 px (360 × 300);
  - **ausserhalb jeder Ausnahme** (A5): 320 × 500: 39,9 · 340 × 500: 37,9 · 360 × 500: 5,9 · 500 × 500: 19,9 · 520 × 500: 19,9 · 540 × 500: 5,9 — die Schiene ist dort 101–117 px hoch statt der 87, mit denen die Schwelle 494 rechnet;
  - **auf der flachen Bühne unter 349 px Höhe** (A6): 600/900/1280 × 340: 8,9; 812 × 348: 0,9; ab 349 null.
- Eine Treppe mit offener Verlosungsleiste (nach F1), Chip minimiert und offen,
  320–2000 × 830/700/375 (255 Stufen je): **null** Stufen, an denen Chip oder
  Meldung verdeckt oder ausserhalb liegen.

Messfalle, festgehalten, weil sie eine Zahl gefälscht hätte: `290.9 − 177.9` ist
in Fliesskomma `112.999…`, und `floor((h + 5) / 59)` meldet dann eine Reihe statt
zwei. Gezählt wird darum über die Oberkanten der Kachelreihen, nicht über die Höhe.

## Abweichungen

| # | Abweichung | gemessen | gegen | Stand |
|---|---|---|---|---|
| A1 | Die offene Verlosungsleiste lag über der offenen `ConflictNotice` (alle Leinwände) und über dem Chip, wo er nicht im Streifen sitzt (Master, flach, Vollbild) | z. B. 393 × 830: Meldung 634–766 unter Leiste 647–766 | ADR 0002 (Anwesenheit); Prototyp `.stack`/`#badges` `bottom: calc(var(--foot) + var(--raffleh))`, Runde 16 und 21, nicht als überholt markiert | **behoben** (`21be064`) |
| A2 | Im Vollbild mehr als 16 Kachelspalten | 1280: 21, 1597: 26 | Prototyp `.slots { max-width: var(--gridmax) }` (16) auch in `fsContent()`; `fold().tileColumns` war schon gedeckelt, der Messrand nicht | **behoben** (`6f8c316`) |
| A3 | Die offene Verlosungsleiste deckt in der Planansicht ab 674 und auf der flachen Bühne die zwei garantierten Kachelreihen zu | frei 44 px (null volle Reihen) bei 674 × 760, 900 × 700, 1280 × 760, 1597 × 900, 812 × 375; bei 673 × 760 eine Reihe + 47 px | #69 AC 2 „deckt keine Kachel zu"; #61 „in der Planansicht ist die Überlappung null" | **behoben** ausser flach (K1, Lauf 14; s. „Lauf 14") — flach **offen** |
| A4 | Der Vollbild-Griff ⤢ liegt über der letzten Kachel der ersten Reihe und verdeckt deren `WinnerPack`-Marke (**behoben** in Lauf 14, B5: Griff in der Legendenzeile) | 393: Kachel 6, 18 × 28; 673: 11, 26 × 28; 674: 6, 21 × 28; 900: 10, 26 × 28; 1280: 10, 14 × 28; 1597: 16, 28 × 28 — Marke verdeckt in 7 von 14 Lagen | Prototyp: Griff in der Legendenzeile (`slotBlock()`, `data-fs="open"`), Ausgang in der Kopfzeile (`fsContent()`); AC „keine Fläche deckt eine Kachel zu" | **offen, Entscheid** |
| A5 | Die Schiene ist bei 320–360 und 500–540 Breite höher als 87 und schiebt die Rangmeldung unter sich | Schiene 101–117; Rangmeldung bis 39,9 px verdeckt (s. o.) | `RAIL_HEIGHT` 87 in `fold.mjs` („the two-row height … never promises room the narrow rail does not leave"); Schwelle 494 (K-B10a) | **behoben** (K2, Lauf 14) ab 350 Breite; Rest bei 320–340 s. A10 |
| A6 | Flache Bühne unter 349 px Höhe: Rangmeldung bis 8,9 px ausserhalb | s. o. | keine Ausnahme benannt — B14 nennt nur < 436 × < 494 | **offen, Entscheid** |
| A7 | Die Kurve heisst in der Schiene „DistributionCurve (mild)", im Blatt „Curve" | `views/controls-hot.php:35` gegen `controls-sheet.php:275` | #113 an #61: „Die Plan-Schiene ist dieselbe Zeile wie das Blatt" | **behoben** (B8, Lauf 14): die Schiene sagt `Curve`, das `<select>` bleibt |
| A8 | Nach F1 deckt der über die Leiste gehobene Chip am Master den unteren Rand der zweiten Kachelreihe | 393 × 830: Chip 605–639, Fenster bis 629 → bis 24 px von Kacheln 11–12 | Folge der Prototyp-Form (Chip steigt über die Leiste) | als **Preis** vorgeschlagen |
| A9 | `favicon.ico` 404 in der Konsole | einmal je Laden | — | unerheblich, benannt |

| A10 | Bei 320–340 Breite ist der feste Teil des `Plan`s höher als 178: der Kopf bricht zweizeilig um (58 statt 40), und an der Schwelle liegt die Rangmeldung 15,9 px unter der Schiene | 320 × 524, 330 × 524, 340 × 522 (je genau an der Schwelle): 15,9; ab 350: 0 | `PLAN_FIXED` 178, gemessen bei 388 Breite (K-B8) | **offen**, neu in Lauf 14 — kein Entscheid; Schriften am Gerät bei #121 |
| A11 | Unter 365 Breite waren die äussersten Kacheln angeschnitten (B14) | 320: Kachel 1 ab −14 | — | **behoben** (K3, Lauf 14) |
| A12 | In der Ausnahme unter 436 × Schwelle lag die Schiene im Kachelraster (B15) | 360 × 300: Schiene 150–238 über Raster 178–291 | — | **behoben** (K4, Lauf 14) |

### Vorschläge zu den offenen Punkten (Entscheid beim Maintainer)

*Stand vor Lauf 14; entschieden sind A3 (ausser flach), A4, A5, A7 — siehe „Lauf 14".*

- **A3.** Ursache ist das Diagramm: es nimmt seit #62 alles ausser zwei Reihen
  (#62 AC „Der Deckel des Diagramms ist **gerechnet**, nicht gesetzt"); der
  Prototyp deckelt es ausserhalb der flachen Bühne **gesetzt** (`stripMax`: 280
  einspaltig, 190 ab zwei Spalten, 96 unter 460 hoch), und das Raster bekam den
  Rest. Am Master sind es heute 398 px Diagramm gegen 113 px Raster. Seit #71 die
  Schiene ab 674 und auf der flachen Bühne wegnimmt, liegt die Leiste direkt über
  den zwei Reihen. Wege: (a) das Diagramm gibt bei offener Leiste um deren
  Überlappung nach — die eine elastische Grösse zahlt; reicht ab 674, auf der
  flachen Bühne nicht (812 × 375: Diagramm 86, Boden 60, Leiste 119); (b) der
  gesetzte Deckel des Prototyps; (c) als Preis nehmen — das Raster scrollt ja
  hinter der Leiste (Polster 79 px), sichtbar sind 44 px.
- **A4.** (a) Griff in die Legendenzeile wie im Prototyp, Ausgang in die Kopfzeile
  des Vollbilds; Achtung: die Legende ist 21,9 hoch und geht in `PLAN_FIXED` 178
  ein, ein 28er-Knopf würde die Ersthöhe 399 verschieben — also ≤ 22 px; (b) Preis.
- **A5.** (a) die Schiene misst der Rand, statt dass die Faltung 87 annimmt;
  (b) die Schiene wird so gebaut, dass sie nie mehr als zwei Zeilen hat;
  (c) Preis an den genannten Breiten.
- **A6.** Benennen als zweite Ausnahme neben B14 oder bewusst offen lassen; am
  Gerät (Querformat mit Browserleisten) ist es der wahrscheinliche Fall (#121).
- **A8.** Preis: der Chip deckt bei offener Leiste den Rand der Reihe über ihr; ein Chip unter der Leiste wäre unsichtbar.

## Lauf 14 — Nachbau nach den Entscheiden K1–K5

Entscheide: Kommentar „Entscheide des Maintainers — Lauf 14" an #73. Gleiche Messmittel,
PHP 8.3.33, Server `php -S localhost:8774 -t public`. Bilder mit Präfix `fix3-…`.

**K1 · das Diagramm gibt der offenen Leiste nach** (`?v=1&game=onepiece&type=weekly`, 🎲, dann ein Wurf):

| Leinwand | zu: Fenster / Diagramm | offen: Fenster / Leiste / Diagramm / frei | nach dem Wurf: Fenster / Leiste / frei / Treffer |
|---|---|---|---|
| 393 × 830 | 516–629 / 398 | 516–629 / ab 647 / 398 / ganz (Leiste über der Schiene) | 453–629 / ab 576 / 113 / Rang 8 sichtbar |
| 673 × 760 | 471–584 / 353 | 454–584 / ab 577 / 336 / 113 | 383–584 / ab 506 / 113 / Rang 31 sichtbar |
| 674 × 760 | 541–654 / 422 | 462–654 / ab 585 / 343 / 113 | 391–654 / ab 514 / 113 / Rang 24 sichtbar (`fix3-674x760-light-raffleThrown.png`) |
| 1280 × 760 | 541–654 / 422 | 462–654 / ab 585 / 343 / 113 | 391–654 / ab 514 / 113 / Rang 9 sichtbar |
| 812 × 375 flach | 204–317 / 86 | 178–317 / ab 248 / **60 (Boden)** / 60 | 178–328 / ab 177 / **0** / Rang 14 **verdeckt** |

„frei" = Fensteroberkante bis Oberkante Leiste − 10. Ab 673 und am Master nach dem Wurf
genau zwei Reihen; **flach offen** (K1: was dort zusätzlich nachgibt, ist nicht entschieden).

**K2 · die Schiene gemessen** (`?v=1&game=onepiece&type=weekly&players=64&depth=32`,
`.plan-controls` in Leistenform; Probe des Messrands gegen die echte Schiene):

| Breite | 320 | 340 | 360 | 393 | 500 | 540 | 600 | 664 |
|---|---|---|---|---|---|---|---|---|
| Schiene echt = Probe | 117 | 115 | 101 | 87 | 115 | 101 | 87 | 62 |

Schwelle beidseitig: 500 × 521 flach / 500 × 522 Master (351 + 56 + 115); 600 × 493 flach /
600 × 494 Master (87); 360 × 507 Master bei Release (Schiene dort 87 — inhaltsabhängig).
Ziehen 500 × 500 (flach) → 600 × 500: Master mit Schiene, also kein veralteter Wert.
Rangmeldung an der Schwelle über der Schiene: ab 350 Breite **0 px**; 320–340 **15,9 px** (A10).
Keine Probe bleibt im DOM (0 nach jeder Stufe); Konsole ohne Fehler ausser `favicon.ico` (A9).

**K3 · Kacheln unter 365** (`type=release`, × 700): 320 → 46,5 px, Kacheln 8–312 im Raster
8–312; 340 → 49,8; 364 → 53,8; 365 → 54. Sechs Spalten ganz sichtbar, Höhe 54 (`fix3-320x700-light-plain.png`).

**K4 · die Ausnahme scrollt** (`type=release`): 360 × 300 und 435 × 400 `data-cramped`,
Raster 178–291, Schiene darunter ab 314 (vorher 150–238 **im** Raster), die Plan-Seite
scrollt (401 Inhalt auf 244 bzw. 344), Fuss ab 244 bzw. 344 — nichts liegt übereinander (`fix3-360x300-light-plain.png`).

**B5 · Vollbild-Griff in der Legendenzeile** (`type=release`): 393 × 830, 900 × 700, 1597 × 900 —
Griff 20 hoch in der Legende (21,9, unverändert), **0** Kacheln unter dem Griff; im Vollbild
derselbe Knopf an derselben Stelle der Legende, „Exit fullscreen", 6 / 15 / 16 Kachelspalten, zurück ✓.

**B8 · `Curve`** in der Schiene wie im Blatt; das `<select>` zeigt den Stand.

## Abnahmekriterien von #73

| Kriterium | Urteil | gemessen |
|---|---|---|
| Sechs Leinwände, beide Modi, je Vollbild, `ConflictNotice`, Leiste | erfüllt | 7 Leinwände (673 und 674 getrennt) × 2 Modi × 10 Zustände = 140 Bilder vor F1, 42 nach F1 (7 × 2 Modi × 3 Zustände, hell und dunkel ohne Befund) |
| Master-Boden: nie unter 6 Spalten und 2 Reihen | erfüllt für das Raster; **nicht** bei offener Leiste ab 674 und flach (A3) | 654 Stufen: min. 6 Spalten, immer 2 Reihen im Raster; bei offener Leiste 0 Reihen frei |
| Keine Fläche deckt eine unerlaubte Kachel; keine Meldung die Pin-Marken | Pin-Marken erfüllt; Kacheln **nicht** (A3, A4) | ab 674: 5–7 Pin-Marken im Bild, 0 verdeckt |
| Chip an jeder Breite sichtbar, unterste freie Ecke rechts | erfüllt nach F1 | vorher an Master, flach und im Vollbild bei offener Leiste verdeckt; nachher 0 von 510 Stufen |
| Blase am Anker, im Rahmen, schliesst ohne Anker | erfüllt | Abstand 5,5–5,8 (Soll 6); 12 von 12 im Rahmen; 12 von 12 geschlossen |
| Drei Meldungsfarben unterscheidbar, beide Modi | erfüllt | kleinstes ΔE 10,1 (Fläche, hell) |
| Faltung trägt beim freien Ziehen | erfüllt als Näherung; Rangmeldung bei A5/A6 | 654 Stufen, alle Bruchstellen beidseitig |
| Zwei seltene Zustände hergestellt | erfüllt | s. o., dazu K-B2 |
| Protokoll mit Ist neben Soll | dieses Dokument | — |
| Jede Abweichung behoben oder als Preis benannt | A1, A2 behoben; A3–A8 als Vorschlag | Entscheid beim Maintainer |

## Für #121 (nur am Gerät prüfbar)

- Touch: Griff an der Kachel (54 px), am 🎲 der Legende, am Chip; Fehlgriff im Daumenbereich.
- `<select>` der Kurve in der Schiene auf iOS (bereits an #61 vermerkt, nach #121 gewandert).
- Echte Schriften auf iOS/Android: ob die Schiene bei 320–360 Breite umbricht (A5 hängt an der Schriftbreite), ob der Kopf bei 320–340 zweizeilig wird (gemessen 58 statt 40).
- Querformat mit Browserleisten: ob die Bühne unter 349 hoch fällt (A6) und was `100dvh` beim Ein- und Ausblenden der Leisten tut.
- Sichere Bereiche (Notch) am gedrehten Streifen rechts im Querformat.
- Freies Ziehen eines echten Fensters (hier nur Treppen über `setViewportSize`).
- Farben auf einem echten OLED-Schirm im dunklen Modus, besonders das knappe Flächenpaar `ConflictNotice` / `CarryOverNotice` im hellen.
- Gerätepixel-Rundung an der zweiten Kachelreihe (die `112.999…`-Falle, auf dem Gerät mit DPR 3).
