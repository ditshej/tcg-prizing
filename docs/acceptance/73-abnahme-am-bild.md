# Abnahme am Bild — #73

Protokoll der Abnahme am Bild für Spec 2 (#61): je Leinwand die gemessenen Zahlen
neben den Sollwerten, nie „sieht gut aus".

- **Stand:** `main` bei `cd539a9` (nach Lauf 13), Zweig `feat/73-abnahme-am-bild`; Nachbau Lauf 14 (K1–K5) unter „Lauf 14"; flache Bühne mit offener Leiste (#129) unter „Lauf 15 · #129"; Bronze/Foil, Diagramm-Obergrenze, 44-px-Ziele und Lucide (#142) unter „Lauf 17 · #142"; die Adressen nach den Startwerten von #145 unter „#145: Startwerte"; Plan-Kopf mit Share und Reset-all, Leiste mit drei Reglern (#143) unter „#143 · Plan-Kopf und Leiste"; das Diagramm auf höchstens einem Drittel der geteilten Fläche (#157) unter „#157 · Das Diagramm nimmt höchstens ein Drittel"
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

Basis-Adresse `http://localhost:8773/`. Ein Zustand ist eine Adresse plus Griffe.
Seit #142 sind die Griffe Lucide-Icons statt Zeichen: ▾ = `chevron-down`, 🎲 = `dices`,
⤢ = `maximize-2` (die Klassen in der Tabelle gelten unverändert):

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
| **Verlosungsleiste** | deckt keine Kachel zu | **8–756 × 248–367: Fenster frei nur 204–248 = 44 px, null volle Reihen; Kacheln 1–14 verdeckt** (A3) — seit Lauf 15 (#129): Diagramm weg, frei 128,1 vor dem Wurf, 56,6 nach dem Wurf (eine Reihe), s. „Lauf 15 · #129" |
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
| A3 | Die offene Verlosungsleiste deckt in der Planansicht ab 674 und auf der flachen Bühne die zwei garantierten Kachelreihen zu | frei 44 px (null volle Reihen) bei 674 × 760, 900 × 700, 1280 × 760, 1597 × 900, 812 × 375; bei 673 × 760 eine Reihe + 47 px | #69 AC 2 „deckt keine Kachel zu"; #61 „in der Planansicht ist die Überlappung null" | **behoben**: nicht flach durch K1 (Lauf 14), flach durch #129 (Lauf 15; eine Reihe nach dem Wurf, s. „Lauf 15 · #129"); Rest knapp über den flachen Schwellen s. A13 |
| A4 | Der Vollbild-Griff ⤢ liegt über der letzten Kachel der ersten Reihe und verdeckt deren `WinnerPack`-Marke (**behoben** in Lauf 14, B5: Griff in der Legendenzeile) | 393: Kachel 6, 18 × 28; 673: 11, 26 × 28; 674: 6, 21 × 28; 900: 10, 26 × 28; 1280: 10, 14 × 28; 1597: 16, 28 × 28 — Marke verdeckt in 7 von 14 Lagen | Prototyp: Griff in der Legendenzeile (`slotBlock()`, `data-fs="open"`), Ausgang in der Kopfzeile (`fsContent()`); AC „keine Fläche deckt eine Kachel zu" | **offen, Entscheid** |
| A5 | Die Schiene ist bei 320–360 und 500–540 Breite höher als 87 und schiebt die Rangmeldung unter sich | Schiene 101–117; Rangmeldung bis 39,9 px verdeckt (s. o.) | `RAIL_HEIGHT` 87 in `fold.mjs` („the two-row height … never promises room the narrow rail does not leave"); Schwelle 494 (K-B10a) | **behoben** (K2, Lauf 14) ab 350 Breite; Rest bei 320–340 s. A10 |
| A6 | Flache Bühne unter 349 px Höhe: Rangmeldung bis 8,9 px ausserhalb | s. o. | keine Ausnahme benannt — B14 nennt nur < 436 × < 494 | **offen, Entscheid** |
| A7 | Die Kurve heisst in der Schiene „DistributionCurve (mild)", im Blatt „Curve" | `views/controls-hot.php:35` gegen `controls-sheet.php:275` | #113 an #61: „Die Plan-Schiene ist dieselbe Zeile wie das Blatt" | **behoben** (B8, Lauf 14): die Schiene sagt `Curve`, das `<select>` bleibt |
| A8 | Nach F1 deckt der über die Leiste gehobene Chip am Master den unteren Rand der zweiten Kachelreihe | 393 × 830: Chip 605–639, Fenster bis 629 → bis 24 px von Kacheln 11–12 | Folge der Prototyp-Form (Chip steigt über die Leiste) | als **Preis** vorgeschlagen |
| A9 | `favicon.ico` 404 in der Konsole | einmal je Laden | — | unerheblich, benannt |

| A10 | Bei 320–340 Breite ist der feste Teil des `Plan`s höher als 178: der Kopf bricht zweizeilig um (58 statt 40), und an der Schwelle liegt die Rangmeldung 15,9 px unter der Schiene | 320 × 524, 330 × 524, 340 × 522 (je genau an der Schwelle): 15,9; ab 350: 0 | `PLAN_FIXED` 178, gemessen bei 388 Breite (K-B8) | **offen**, neu in Lauf 14 — kein Entscheid; Schriften am Gerät bei #121 |
| A11 | Unter 365 Breite waren die äussersten Kacheln angeschnitten (B14) | 320: Kachel 1 ab −14 | — | **behoben** (K3, Lauf 14) |
| A12 | In der Ausnahme unter 436 × Schwelle lag die Schiene im Kachelraster (B15) | 360 × 300: Schiene 150–238 über Raster 178–291 | — | **behoben** (K4, Lauf 14) |
| A13 | Knapp **über** den flachen Schwellen, also nicht flach, hält K1 die Reihen über der offenen Leiste nicht: das Diagramm steht dort schon an seinem Boden 60 | nach sechs Würfen frei: 600 × 494 **51,6** (keine volle Reihe), 600 × 497 54,6, zwei Reihen erst ab 600 × 556; 674 × 399 und 1030 × 399 **34,6** vor dem Wurf, **−62,4** danach, 674 × 478 16,6, zwei Reihen erst ab 674 × 575 | K1 (#73) „nie unter 60"; #129 gilt nur flach | **offen, Entscheid** — neu in Lauf 15, s. „Lauf 15 · #129" |
| A14 | In der Ausnahme K4 (unter 436 × Schwelle, `cramped`) liegt die offene Leiste über dem Kachelraster | 435 × 380, 420 × 380: frei 9,1 vor dem Wurf, −87,9 nach sechs Würfen (Leiste 216) | K4 „nichts liegt übereinander" (dort für die Schiene entschieden, nicht für die Leiste) | **offen**, benannt in Lauf 15 |

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
| 812 × 375 flach | 204–317 / 86 | 178–317 / ab 248 / **60 (Boden)** / 60 | 178–328 / ab 177 / **0** / Rang 14 **verdeckt** — überholt durch #129, s. „Lauf 15 · #129" |

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

## Lauf 15 · #129 — die flache Bühne bei offener Leiste

Entscheid: Body von #129 (Maintainer, 2026-10-02). Flach (`fold().flat`, keine Breite) fällt das
Diagramm bei offener Leiste ganz weg und kommt beim Schliessen zurück; die Rücknahmeliste blättert
in der Leiste statt sie wachsen zu lassen. Nicht flach gilt K1 unverändert.

> ⚠︎ **Überholt durch die Antworten K1–K7 (Lauf 15, Phase F).** Das Diagramm steht nur noch mit Platz
> (in jeder Faltung), die Liste scrollt seitlich statt zu blättern, A10 ist geschlossen. Die Messwerte
> unten sind die des ersten Baus. Was jetzt gilt, steht im Abschnitt „Lauf 15 · Nachbau nach den
> Antworten K1–K7".

- **PHP:** 8.3.33 (`php -v`), Server `php -S localhost:8775 -t public` aus der Worktree-Wurzel `tcg-prizing-129`
- **Zweig:** `feat/129-flache-buehne-blaettert`
- **Adresse:** `?v=1&game=onepiece&type=weekly&winnerPacks=16` (sieben offene `WinnerPack`s, damit die Liste blättern kann), 🎲, dann Würfe
- **Bilder:** `review/73-bilder/lauf15-<w>x<h>-<modus>-<plain|raffle|raffleThrown1|raffleThrown6|raffleClosed>.png` (gitignoriert)
- *frei* = Fensteroberkante bis Oberkante Leiste − 10 (`RAFFLE_CLEARANCE`); eine Reihe braucht 54, zwei 113

### Flach, Soll und Ist

| Leinwand | Prüfpunkt | Soll | Ist |
|---|---|---|---|
| 812 × 375 (flach, Schiene als Spalte) | zu | Diagramm wie vorher | Diagramm 86,1, Fenster 204–317 (unverändert gegen Lauf 14) |
| | offen, vor dem Wurf | Diagramm weg, ≥ 1 Reihe frei | Diagramm **0** (nicht gerendert), Legende 80–101,9, Fenster ab 109,9, Leiste 248–367 (119), frei **128,1** = zwei Reihen |
| | nach dem 1. Wurf | ≥ 1 Reihe frei, Treffer als Kachel sichtbar | Leiste 176,5–367 (**190,5**), frei **56,6** = eine Reihe, Treffer sichtbar (7 von 7 Würfen) |
| | nach dem 2.–7. Wurf | Leiste wird nicht höher | **190,5** bei jedem Wurf; die sechs Chips passen hier in eine Zeile, kein Blättern nötig |
| | wieder zu | Diagramm wie vorher | 86,1, Fenster 204–317 |
| 600 × 450 (flach, Schwelle 494) | offen / 1. Wurf / 7. Wurf | wie oben | Diagramm 0; frei 203,1 / 131,6 / 131,6; Leiste 119 / 190,5 / 190,5; beim 7. Wurf **blättert** die Liste (`‹ 1/2 ›`, 6 Chips auf Seite 1) |
| | wieder zu | wie vorher | 161,1 |
| 436 × 380 (flach, schmalste) | offen / 1. Wurf / 7. Wurf | wie oben | Diagramm 0; frei 133,1 / 61,6 / 61,6; Leiste 119 / 190,5 / 190,5; ab dem 5. Chip blättert sie (4 je Seite), ein Wurf springt auf die Seite seines Treffers (`‹ 2/2 ›`, `lauf15-436x380-light-raffleThrown6.png`) |
| 673 × 399 · 674 × 398 (flach) | offen / nach 6 Würfen | wie oben | Diagramm 0; frei 152,1 / 80,6 bzw. 151,1 / 79,6; Leiste 190,5 |
| 600 × 493 (flach) | dito | wie oben | Diagramm 0; frei 246,1 / 174,6 |
| 812 × 375 dunkel | Layout | gleich hell | gleiche Masse (`lauf15-812x375-dark-*`) |

Treffer nach dem Ende des weichen Scrollens (1,6 s) gegen die Oberkante der Leiste geprüft: 812 × 375,
600 × 450, 436 × 380 und 393 × 830 je sieben Würfe, **28 von 28 sichtbar**; der Chip des Treffers stand
jedes Mal auf der gezeigten Seite.

**Die Leiste wird nach dem Wurf doch höher (AC 2, wörtlich nicht erfüllt).** Vor dem ersten Wurf 119,
danach 190,5: +23 für die Ansage (`Rank N drew a winner pack`, 9 + 14) und +48,5 für Kopfzeile und eine
Zeile Chips der Rücknahmeliste. Das Blättern hält die Leiste ab dem ersten Wurf **fest** (190,5 bei
jedem weiteren Wurf); unter 119 bliebe sie nur, wenn Ansage und Liste gar nicht stünden. Die eine
Kachelreihe hält trotzdem: frei 56,6 bei 812 × 375, die knappste flache Leinwand.

### Nicht flach, Soll und Ist (unverändert gegenüber K1)

| Leinwand | Soll | offen: Diagramm / frei | nach 6 Würfen: Diagramm / Leiste / frei |
|---|---|---|---|
| 393 × 830 (Master) | wächst, Diagramm gibt nach | 398,1 / 121 | 309,1 / **216** / 113 |
| 500 × 900 | dito | 454,1 / 135 | 404,6 / 190,5 / 113 |
| 673 × 760 | dito | 336,1 / 113 | 264,6 / 190,5 / 113 |
| 674 × 760 | dito | 342,6 / 113 | 245,6 / **216** / 113 (`lauf15-674x760-light-raffleThrown6.png`) |
| 900 × 700 · 1280 × 760 · 1597 × 900 | dito | 282,6 · 342,6 · 482,6 / 113 | 211,1 · 271,1 · 411,1 / 190,5 / 113 |
| 600 × 494 (nicht flach, Schiene 87) | dito | 62,1 / 121 | **60** / 190,5 / **51,6** (A13) |
| 674 × 399 (zwei Spalten) | dito | **60** / **34,6** | 60 / 216 / **−62,4** (A13) |
| 435 × 380 · 420 × 380 (`cramped`) | K4 | 60 / 9,1 | 60 / 216 / −87,9 (A14) |

Die Leiste wächst nicht flach weiter mit der Liste (216 bei sieben Chips an 393 und 674), kein Pager.

### Grenzen beidseitig

| Paar | flach? | Diagramm bei offener Leiste |
|---|---|---|
| 435 × 380 / 436 × 380 | nein (`cramped`) / ja | 60 / **0** |
| 600 × 493 / 600 × 494 (Schiene 87) | ja / nein | **0** / 62,1 |
| 500 × 521 / 500 × 522 (Schiene hier 101, Schwelle 508) | nein / nein | 75,1 / 76,1 — die Schwelle wandert mit der Schiene (K2); Lauf 14 mass 115 mit `players=64&depth=32` |
| 673 × 399 / 674 × 399 | ja (Schwelle einspaltig) / nein (zwei Spalten) | **0** / 60 |
| 674 × 398 / 674 × 399 | ja / nein | **0** / 60 |

Unter `node --test` (`test/ui-flat-raffle.test.mjs`) stehen dieselben Paare, dazu 500 × 521/522 mit
einer Schiene von 115 (Messwert aus Lauf 14).

### Offen

- **A13** (oben): knapp über den flachen Schwellen hält K1 die Reihen nicht, weil das Diagramm schon am
  Boden steht. #129 nimmt flach aus; nicht flach ist ausdrücklich „unverändert gegenüber K1". Ob die
  Ausnahme bis dorthin reicht, ist nicht entschieden.
- **A14**: in der Ausnahme K4 liegt die Leiste über dem Raster.
- **Blättern**: Seitengrösse und Bedienung stehen weder in #129 noch in #69, #61 oder im Prototyp. Gebaut
  ist die einfachste Form: eine Zeile je Seite, gemessen aus den Breiten der Chips und der Liste
  (`takeBackPages()`), `‹ n/m ›` in der Kopfzeile der Liste (kostet keine Höhe), ein Wurf springt auf die
  Seite seines Treffers.
- **A10** bleibt offen (Plan-Kopf bei 320–340 zweizeilig, `PLAN_FIXED` 178); in Lauf 15 nicht angefasst.

## Lauf 15 · Nachbau nach den Antworten K1–K7

Entscheide: Kommentar an #129 (https://github.com/ditshej/tcg-prizing/issues/129#issuecomment-5966583624),
Maintainer 2026-10-03; die Definition von „genug Platz" hat er an die Session delegiert (K3/K4).

- **Regel:** Das Diagramm steht, wenn `Rest − Überlappung der offenen Leiste − 113 ≥ 60` gilt. Den Rest
  rechnet der Messrand so, als stünde das Diagramm (`diagramFits()`). Sonst ist das Diagramm weg, und die
  Rangsumme geht mit ihm (⚠︎ überholt durch #132: sie bleibt, s. „Lauf 16 · #132“). Die Rücknahmeliste ist flach und `cramped` eine seitlich scrollende Zeile mit
  Pfeilen `‹ ›` (je eine Pille). Der Plan-Kopf bricht nicht um.
- **PHP:** 8.3.33 (`php -v`). Server `php -S localhost:8795 -t public` aus `tcg-prizing-129`, Zweig
  `feat/129-flache-buehne-blaettert`. Chromium über Playwright (MCP).
- **Adresse:** `?v=1&game=onepiece&type=weekly&winnerPacks=16`. 🎲 und ✕ werden per Klick bedient, die Würfe
  über `.raffle-trigger`.
- **Bilder:** `review/73-bilder/lauf15f-<w>x<h>-<modus>-<plain|raffle|raffleThrown1|raffleThrown7|raffleClosed>.png`
  (gitignoriert), dazu `lauf15f-436x380-light-rowStepped.png`, `…-potEmpty.png`, `lauf15f-320x524-light-head.png`,
  `lauf15f-360x508-light-head.png`.
- *frei* wie oben; eine Reihe braucht 54, zwei 113.

### Soll und Ist

| Leinwand | Faltung | zu: Diagramm | offen: Diagramm / frei | 1. Wurf: Diagramm / Leiste / frei | 7. Wurf: Leiste / frei | wieder zu |
|---|---|---|---|---|---|---|
| 812 × 375 | flach | 86,1 | **0** / 128,1 | 0 / 190,5 / 56,6 | 190,5 / 56,6 | 121,1¹ |
| 436 × 380 | flach | 91,1 | **0** / 133,1 | 0 / 190,5 / 61,6 | 190,5 / 61,6, Zeile läuft über (534 auf 348), Pfeile da | 91,1 |
| 600 × 493 | flach | 204,1 | **125,1** / 113 | 0 / 190,5 / 174,6 | 190,5 / 174,6 | 204,1 |
| 673 × 468 | flach | 179,1 | **100,1** / 113 | 0 / 190,5 / 149,6 | 190,5 / 149,6 | 214,1¹ |
| 674 × 398 | flach | 109,1 | 0 / 151,1 | 0 / 190,5 / 79,6 | 190,5 / 79,6 | 109,1 |
| 673 × 469 | nicht flach | 62,1 | **0** / 166,1 | 0 / 190,5 / **94,6** | 190,5 / 94,6 | 97,1¹ |
| 674 × 399 | zwei Spalten | 60,6 | **0** / 102,6 | 0 / 190,5 / **31,1** | **216** / **5,6** | 60,6 |
| 600 × 494 | nicht flach | 62,1 | 62,1 / 121 | **0** / 190,5 / 119,6 | 190,5 / 119,6 | 62,1 |
| 1280 × 450 | drei Spalten | 111,6 | **0** / 153,6 | 0 / 190,5 / **82,1** | 190,5 / 82,1 | 111,6 |
| 1280 × 574 / 575 | drei Spalten | 235,6 / 236,6 | 156,6 / 113 | 85,1 / 190,5 / 113 | 190,5 / 113 | — |
| 435 × 380 | `cramped` | **0** | 0 / 77,1 | 0 / 190,5 / **5,6** | 190,5 / 5,6, Zeile scrollt | 0 |
| 393 × 830 | Master | 398,1 | 398,1 / 121 | 334,6 / 190,5 / 113 | 216 / 113 | 398,1 |

¹ Nach sieben Würfen ändert sich der Plan: Die Rangmeldung fällt weg (27 + 8 px), und das Diagramm wird
entsprechend höher. Ein Neuladen mit derselben Adresse misst denselben Wert.

Vorher (erster Bau von Lauf 15) war es bei 673 × 469 nach dem Wurf 26,6 frei, bei 1280 × 450 14,1 und
bei 435 × 380 −62,4. Bei 600 × 493 stand das Diagramm offen auf 0, jetzt sind es 125 neben zwei freien
Reihen (B5).

**Treffer als Kachel sichtbar** (nach dem weichen Scrollen, Würfe auf den höchsten, den niedrigsten und
einen mittleren Rang): 436 × 380 (mit und ohne vorher gesetzte Ränge), 812 × 375, 1280 × 450,
673 × 469, 600 × 493 und 393 × 830 je **54 von 54 px**. Bei 435 × 380 sind es **16 von 54**: Dort reicht
die Fläche über der Leiste nach dem Wurf nicht für eine Reihe (siehe Offen). Der Chip des Treffers
scrollt in die Zeile (436 × 380: Rang 32, `scrollLeft` 0 → 114).

**Pfeile** (436 × 380, sieben Chips, Zeile 534 auf 348): Sie erscheinen ab dem fünften Chip. Ein Klick auf
`›` verschiebt um eine Pille (`scrollLeft` 0 → 76 → 154), am Ende (192) ist `›` gesperrt, `‹` geht
auf 154 zurück (`lauf15f-436x380-light-rowStepped.png`).

**K2:** Bei 436 × 380, `top 8` nach einem Wurf, heisst der Satz `every rank in range already has one`. Er
bricht noch auf zwei Zeilen um (`.raffle-stand` 31,2), die Leiste bleibt aber bei 190,5 und frei bleiben
**61,6** (vorher 49,8; `lauf15f-436x380-light-potEmpty.png`).

**K6, A10 geschlossen:** Ohne Verlosung, `players=64&depth=32`:

| Leinwand | Kopf | Ausgabezeile (Inhalt / sichtbar) | Rangmeldung / Schiene ab | überdeckt |
|---|---|---|---|---|
| 320 × 524 | **40** | 330 / 304, scrollt | 324–351 / 351 | **0** (vorher 15,9) |
| 330 × 524 | 40 | 330 / 314 | 324–351 / 351 | 0 |
| 340 × 522 | 40 | 330 / 324 | 324–351 / 351 | 0 |
| 360 × 508 | 40 | 344 / 344 | 324–351 / 351 | 0 |

### Grenzen beidseitig

| Paar | Grenze | Ist |
|---|---|---|
| 812 × 348 / 349, zu | genug Platz ohne Leiste | Diagramm **0** (Fenster 203,1) / **60,1** (Fenster 113) |
| 1280 × 477 / 478, offen vor dem Wurf | genug Platz mit Leiste 119 | **0** (frei 180,6) / **60,6** (frei 113) |
| 1280 × 548 / 549, nach dem 1. Wurf | genug Platz mit Leiste 190,5 | **0** (frei 180,1) / **60,1** (frei 113) |
| 435 × 380 / 436 × 380 | `cramped` / flach | beide Zeile; Diagramm 0 / 0 (offen) |
| 600 × 493 / 494 | flach / nicht flach (Schiene 87) | Zeile läuft über / Liste bricht um; offen Diagramm 125,1 / 62,1 |
| 674 × 398 / 399 | flach / zwei Spalten | Zeile / Liste wächst (216 beim 7. Wurf) |
| 673 × 468 / 469 | flach / nicht flach | nach dem Wurf frei 149,6 / 94,6, Diagramm je 0 |

Unter `node --test`: `diagramFits()` bei 173 (= 113 + 60) und 172,9, mit und ohne Überlappung
(`test/ui-geometry.test.mjs`); die Faltpaare der Zeile, darunter 500 × 521/522 mit Schiene 115 und
420 × 380/900, sowie die Bindungen im Markup, ausgewertet gegen die Komponente
(`test/ui-flat-raffle.test.mjs`). Neun Mutationen an Regel, Zeile, Pfeilen, Rangsumme, Satz und Kopf gingen
alle rot.

### Offen

- **674 × 399** (zwei Spalten, knapp über der Ersthöhe): Ohne Diagramm bleiben nach dem ersten Wurf nur
  31,1 frei, keine Reihe. Weil die Bühne nicht flach ist, bricht die Liste um und lässt die Leiste wachsen
  (216, frei 5,6). Die Karte K3 sagte das voraus („bleibt knapp darunter“). Über den Platz hinaus ist
  hier nichts entschieden.
- **435 × 380** (`cramped`): Das Diagramm ist weg, wie entschieden, und vor dem Wurf ist eine Reihe frei
  (77,1). Nach dem Wurf bleiben 5,6, der Treffer ist zu 16 von 54 px zu sehen. Mehr als „mind. ein
  wenig“ gibt diese Bühne mit fester Leiste nicht her. Die Seite scrollt dort (K4) und lässt die Kacheln
  hochziehen.

## Lauf 16 · #132 — das Rangtotal bleibt, wenn das Diagramm weicht

Entscheid: Body von #132 (Maintainer, 2026-10-04): Die Summenprobe hat auf jeder Bühne drei Stellen.
Die Stelle ohne Diagramm stand nicht im Prototyp (`rankTotal()` nur über den Balken, `fsContent()` ohne).
Der Maintainer hat sie am 2026-10-05 im Terminal entschieden: **die eigene Zeile unter dem Raster bleibt
stehen**, und **unter einer offenen Leiste darf sie liegen**, wie die Rangmeldung. Die Summenprobe
liest man bei geschlossener Leiste.

- **Bau:** `x-show` des Rangtotals von `diagramShown` auf `!fullscreen`. Der Messrand führt die letzte
  Höhe des Rangtotals nicht mehr nach (`lastHeight` entfällt), nur die Lücke des Diagramms zählt weiter,
  als stünde es.
- **PHP:** 8.3.33. Server `php -S localhost:8796 -t public` (Zweig `feat/132-rangtotal-bleibt`), zum
  Vergleich `main` auf 8797. Chromium über Playwright (MCP), hell. Das Layout ist hell und dunkel
  gleich (s. oben).
- **Adresse:** `?v=1&game=onepiece&type=weekly&winnerPacks=16`, Summenprobe dort 96 · 64 · 32.
- **Bilder:** `review/73-bilder/lauf16-812x375-light-raffle.png`, `lauf16-812x348-light-plain.png`,
  `lauf16-435x380-light-plain.png` (gitignoriert).
- *frei* wie oben (Oberkante Leiste − 10). *Fenster* = Höhe von `.plan-grid`.

### Soll und Ist

Soll: Ohne Diagramm ist das Rangtotal sichtbar, bei geschlossener Leiste ohne Scrollen. Das Fenster hält
zwei Reihen (113), ausser in der Ausnahme aus #73 K4. Wo das Diagramm steht, ändert sich nichts.

| Leinwand | Leiste | Diagramm | Fenster `main` → #132 | Rangtotal (y) | sichtbar |
|---|---|---|---|---|---|
| 812 × 348 | zu | weg | 203,1 → **180,1** | 298–313 | ja (`lauf16-812x348-light-plain.png`) |
| 1280 × 348 | zu | weg | 203,1 → **180,1** | 298–313 | ja |
| 812 × 340 / 320 / 300 | zu | weg | — → 172,1 / 152,1 / 132,1 | 290 / 270 / 250 | ja |
| 436 × 330 / 300 | zu | weg | — → 162,1 / 132,1 | 280 / 250 | ja |
| 435 × 380 (`cramped`) | zu | weg | 113 → 113 | 230,9–245,9 | ja |
| 812 × 349 | zu | 60,1 | 113 → 113 | 299–314 | ja, wie bisher |
| 812 × 375 | offen / 1. Wurf | weg | frei 128,1 / 56,6 (unverändert) | 325–340 | **unter der Leiste** (`lauf16-812x375-light-raffle.png`) |
| alle zwölf Leinwände aus „Lauf 15 · Nachbau“ | zu / offen / 1. Wurf | wie dort | Diagramm und frei **unverändert** | — | zu: ja; offen: unter der Leiste |
| 393 × 830, 812 × 375, 435 × 380 | Vollbild | weg | 67,9–795 / –340 / –345 (unverändert) | — | nein, wie `fsContent()` |

Über der offenen Leiste kostet das Rangtotal nichts: es liegt unter ihr, also zählt es nicht gegen
*frei*. Bei geschlossener Leiste ohne Diagramm bekommt das Fenster seine 23 px (15 Zeile + 8 Lücke)
nicht mehr zurück. Gerechnet war mit ihnen nie: Das Rangtotal steckt im festen Teil (178) der Ersthöhe 399.

**Zwei Reihen halten überall**, das Fenster fällt nirgends unter 113. Der Preis liegt auf sehr niedrigen
flachen Bühnen: Die Höhe, ab der die Plan-Seite um ein paar Pixel scrollt, steigt von **257** (`main`:
257 → 1 px, 250 → 8 px) auf **280** (#132: 280 → 1 px, 270 → 11 px, 250 → 31 px, gleich bei 436 und
600 Breite). Darüber scrollt nichts. Unter 281 Höhe liegt das Rangtotal also erst nach einem Scroll von
höchstens der Überlaufhöhe im Bild, die Rangmeldung ebenso. Ob echte Geräte so niedrig werden, gehört zu
A6 (#121).

**Tests:** `test/ui-flat-raffle.test.mjs`, „the rank total stays when the diagram goes, and leaves only
with fullscreen (#132)“, wertet das `x-show` des Markups gegen die Komponente aus: Diagramm da, weg, Leiste
offen, Vollbild, zurück. Zwei Mutationen (`diagramShown` zurück, `true` statt `!fullscreen`) gingen rot.
`node --test`: 580 grün.

## Lauf 17 · #142 — Bronze/Foil, Obergrenze des Diagramms, 44-px-Ziele, Lucide

Entscheid: Body von #142 (Maintainer, 2026-10-08, Durchklicken). Übernommen ist der Look des
Prototyps (Tokens, Schatten statt Rahmen, 2-px-Ecken, Goldglanz im Dunkeln, Linie über jedem
Gruppentitel), die Obergrenze des Diagramms (`stripMax`, proto:3217–3253), Trefferflächen von
mindestens 44 × 44 und Lucide statt Zeichen und Emoji.

- **PHP:** 8.3.33 (`php -v`). Server `php -S localhost:8142 -t public` aus der Worktree-Wurzel
  `tcg-prizing-142`, Zweig `feat/142-bronze-foil-look`.
- **Browser:** Google Chrome (headless) über Playwright, `colorScheme` light / dark. Der
  Playwright-MCP-Browser war von einer anderen Sitzung belegt; Messmittel und Viewports sind
  dieselben.
- **Messmittel:** wie oben; dazu die **Trefferfläche** je bedienbarem Ziel (`button`, `input`,
  `select`, `a[href]`, `label.sheet-check`): von der Mitte aus waagrecht und senkrecht die
  Strecke, über die `elementFromPoint` das Ziel (oder ein Kind) trifft, Kante auf 1/4096 px
  halbiert. Beurteilt wird nur, wessen ganzes 44er-Feld frei im Rahmen seines Scrollers liegt;
  ein halb weggescrolltes oder unter dem klebenden Kopf liegendes Ziel ist Sache des Scrollens.
  Hit-Testing in Chrome rundet auf ganze Pixel, ± 1 ist Messrauschen.
- **Bilder:** `review/73-bilder/l17-<w>x<h>-<modus>-<zustand>.png` (gitignoriert).
- *frei* wie oben (Oberkante Leiste − 10).

### Obergrenze des Diagramms — Soll und Ist

> ⚠︎ **Ergänzt durch #157** (Gesamt-Review 2026-10-08, Punkt 4 und F2 a): Der Deckel bleibt, dazu
> kommt eine zweite Obergrenze, ein Drittel der geteilten Fläche; unter einem Drittel von 60 ist das
> Diagramm weg. Die Spalte „Diagramm zu" unten ist damit überholt (am Master 158,3 statt 280, bei
> 1280 × 760 179 statt 190 (mit dem Kopf von #156), bei 674 × 399 weg statt 61). Neu gemessen unter
> „#157 · Das Diagramm nimmt höchstens ein Drittel".

Soll (Prototyp, nachgeschlagen): flach 60–96, unter 460 Höhe 96, ab zwei Spalten 190, einspaltig
280. Darunter unverändert: Boden 60, weg statt geklemmt (#129), zwei Reihen.

| Leinwand | Faltung | Deckel (`--diagram-max`) | Diagramm zu | vorher (Lauf 15/16) | Fenster | Reihen Platz |
|---|---|---|---|---|---|---|
| 393 × 830 | Master | 280 | **280** | 398,1 | 397–592 = 195 | 3 |
| 812 × 375 | flach | 96 | 87 | 86,1 | 204–317 = 113 | 2 |
| 673 × 760 | einspaltig | 280 | **280** | 353 | 397–522 = 125 | 2 |
| 674 × 760 | zwei Spalten | 190 | **190** | 422 | 309–654 = 345 | 5 |
| 900 × 700 | zwei Spalten | 190 | **190** | 282,6 offen | 309–594 = 285 | 4 |
| 1280 × 760 | drei Spalten | 190 | **190** | 422 | 309–654 = 345 | 5 |
| 1597 × 900 | drei Spalten | 190 | **190** | 482,6 offen | 309–794 = 485 | 8 |
| 1280 × 450 | drei Spalten, unter 460 | 96 | 96 | 111,6 | — | — |
| 600 × 493 · 673 × 469 | flach | 96 | 96 · 96 | 204,1 · 179,1 | — | — |
| 674 × 399 | zwei Spalten, unter 460 | 96 | 61 | 60,6 | — | — |

Wo das Diagramm den Deckel erreicht, geht der Rest an das Raster: am Master hat das Fenster jetzt
Platz für drei Reihen statt zwei. Die zwei Reihen halten auf allen Leinwänden; unter
`node --test` steht dieselbe Zusicherung als Durchlauf über Bühnen 357–2000 × 351–1400 mit dem
Deckel (`test/ui-fold.test.mjs`). Hell und dunkel sind im Layout gleich (72 Läufe, zwei
Abweichungen, beide aus dem Zufall des Wurfs: andere Trefferkachel, andere Rangmeldung).

### Die sieben Leinwände, Soll und Ist

Zustände `plain`, `conflictOpen`, `conflictChip`, `raffle`, `raffleThrown` (ein Wurf), `fs`, hell und dunkel.

| Leinwand | Fuss / Streifen | Chip (`conflictChip`) | offene Meldung | Leiste offen / nach dem Wurf, frei | Vollbild | Trefferflächen < 44 |
|---|---|---|---|---|---|---|
| 393 × 830 | 774–830 = **56**, drei Einträge | 268–381 × 732–766, R 12 · B 64 | 12–381 × 604–766 | 622–766 / 542–766; 215 / 135 | Fuss weg, Diagramm weg, Fenster 67–795 | **0** |
| 812 × 375 | `.foot` 48 breit × 375 | 639–752 × 333–367, R 60 · B 8 | 12–752 × 264–367 | 223–367 / **143–367**; 104 / **24** | Fenster 67–340 | 0 ausser der Schiene unter der Leiste (s. u.) |
| 673 × 760 | 704–760 = **56** | 548–661 × 662–696 | 12–661 × 593–696 | 552–696 / 472–696; 145 / 113 | Fenster 67–725 | **0** |
| 674 × 760 | 712–760 = **48**, ein Eintrag | 549–662 × 719–753 (mittig im 48er) | 12–376 (Reglerspalte ab 388) | 560–704 / 480–704; 241 / 161 | Fenster 67–725 | **0** |
| 900 × 700 | 652–700 = 48 | 775–888 × 659–693 | 12–602 | 500–644 / 420–644; 181 / 113 | Fenster 67–665 | **0** |
| 1280 × 760 | 712–760 = 48, null Einträge | 1155–1268 × 719–753 | 368–982 | 364–986 × 560–704 / 480–704; 241 / 161 | Fenster 67–725 | **0** |
| 1597 × 900 | 852–900 = 48 | 1472–1585 × 859–893 | 368–1299 | 364–1303 × 700–844 / 620–844; 381 / 301 | Fenster 67–865 | **0** |

Geprüft wurden in den 72 Läufen 2623 Ziele. Dazu `Details` ganz durchgescrollt: 393 × 830
(Weekly hell 157, Release 64 dunkel 146), 812 × 375 (Weekly, 140), 674 × 760 (Weekend mit
stehendem `Offer`, 225) und 1280 × 760 (Release, 375); `Prepare` bei 393 × 830 und 812 × 375
(Release) — **null** unter 44. Die Blase an der Kachel (393, 812, 674, 1280):
null. Kein Lauf scrollt seitlich. Kein Regler steht doppelt im Bild (alle Leinwände: jedes
Zählwerk, jedes `<select>` einmal).

Der feste Teil des `Plan`s bei 388 (674 × 760, `players=64&depth=32`): 8 + Kopf 42 +
`Participation` 16 + Legende 21 + Rangtotal 15 + Rangmeldung 27 + 6 × 8 = **177** — unter
`PLAN_FIXED` 178, die Ersthöhe 399 steht. Fuss am Handy **56** (7 + 26 Icon mit Feld + 4 + 12 + 7).

### Farbe

Die Tokens sind die Werte, die Lauf 14 schon gemessen hat: Flächen `#ffe1dd` / `#f3ecf6` /
`#f0e4d1` hell, `#3d1b18` / `#2a2338` / `#2a2620` dunkel, Ringe `#96140f` / `#8a5f9c` / `#8c5a2b`
bzw. `#ff9f90` / `#a888c8` / `#c9992e` — berechnet am Bild bestätigt (`rgb(255, 225, 221)` /
`rgb(150, 20, 15)` hell, `rgb(61, 27, 24)` / `rgb(255, 159, 144)` dunkel für die
`ConflictNotice`). Die ΔE- und Kontrastzahlen unter „Farbe" gelten unverändert. Neu: Grund
`#ece1cb` / `#131210`, Kachel mit Schatten statt Rahmen, im Dunkeln mit Goldrand
(`inset 0 0 0 1px rgba(214, 168, 58, 0.3)`), Ecken 2 px, Linie über jedem Gruppentitel
`1px #e2d5be` / `#35312a`.

### Was sich verschoben hat — und wo es ein früheres Soll trifft

- **Die Schiene ist höher.** Das Zählwerk ist jetzt 38 × 34 (Prototyp) statt 26 × ~25, und ein
  Zählwerk mit Rückweg braucht 164 Breite (38 + 44 + 38, Rückweg 16 + 28): Schiene am Master
  **124** (650–774) statt 87, bei 673 ebenfalls 124. Die einspaltige Schwelle (351 + 56 +
  gemessene Schiene, K2) wandert mit: am Master **531** statt 494. 673 × 469 und 600 × 493 sind
  darum jetzt **flach** (vorher einspaltig). Nichts davon ist gesetzt, alles gemessen.
  Vor K2 standen unter 393 die Zähler einzeln (Zahlenfeld 54, Zelle 176; 360/375: 195, 320: 229),
  iPhone SE in Safari (375 × 553) und 360 × 580 scrollten. **Entschieden in Runde 142·145, K2**
  ([#142](https://github.com/ditshej/tcg-prizing/issues/142#issuecomment-6059121659)): zwei
  Zähler nebeneinander bis 360 Breite, das Zahlenfeld der Schiene 44 statt 54, die
  Trefferflächen bleiben 44 × 44. **Nach dem Bau gemessen** (Höhe 900, `plain`):

  | Bühnenbreite | Schiene | Zähler je Zeile | einspaltig ab Höhe |
  |---|---|---|---|
  | 360–673 (gemessen 360, 361, 365, 375, 380, 392, 393, 412, 430, 673) | **124** | 2 | **531** |
  | 347–359 | 195 | 1 | 602 |
  | 336–346 | 212 | 1 | 619 |
  | 320–335 | 229 | 1 | 636 |

  Durchlauf über jede Breite 320–673 (Höhe 900) in `plain`, Weekend, Release und Weekly mit
  `depth=32`: dieselben Stufen, die Grenzen um ± 2 verschoben (Release 320–337 / 338–346;
  `depth=32` 320–346 / 347–350 / 351–359). Mit `depth=32` steht die Schiene bei 360–361 und
  540–542 auf **139**: ist `Served ranks` gepinnt, passen Titel, `pinned` und `cap N` dort nicht
  auf eine Zeile (Zelle 66 statt 51), die Zähler stehen weiter zu zweit, einspaltig ab 546. Gemessene Spanne der Schiene damit **124 bis 229**
  (vor #142: 62 bis 117); `RAIL_AT_MASTER` 124, der Durchlauf in `test/ui-fold.test.mjs` rechnet
  mit 124, 139, 195, 212 und 229 (B2, N5 der Runde 142·145).
  Die Anordnung kippt bei **360** genau: zwei Zellen zu 164 + Lücke 16 + Rand 2 × 8 = 360; bei
  359 stehen die Zähler untereinander. Unter 360 entscheidet die Titelzeile, ob ein Zähler neben
  seinem Titel steht (daher die drei Stufen). Die Schwelle ist am Bild bestätigt: 360 × 531,
  375 × 531 und 393 × 531 einspaltig, je 530 `cramped`; 350 × 602 / 601, 340 × 619 / 618 und 320 × 636 / 635 ebenso einspaltig / 
  `cramped`. **375 × 553** (iPhone SE, Safari): einspaltig, Diagramm 80–165, Raster 202–315
  (zwei Reihen), Schiene 373–497, Fuss 497–553, die Seite scrollt nicht. **360 × 580**:
  einspaltig, Diagramm 80–192, Raster 229–342, Schiene 400–524, Fuss 524–580, kein Scrollen.
  Drei Ziffern passen ins 44er-Feld (`players=512`: `scrollWidth` 44 = `clientWidth`).
  Trefferflächen unter 44 bei 360 × 580, 375 × 553, 360 × 900 und 393 × 830 (`plain`, 26 Ziele):
  **0**. 320 scrollt wie bisher (#73 K4).
- **Die Verlosungsleiste ist höher**: offen **144** statt 119, nach dem Wurf **224** statt 190,5,
  nach sieben Würfen bei 674 × 399 **268** statt 216. Grund: 13 Stufen in zwei Reihen und der
  Auslöser darüber brauchen je 44 Abstand (Stufen 28 hoch + 16 Lücke, Auslöser 34 + 16).
- **Damit hält #129 „eine Reihe frei nach dem Wurf" auf der flachen Bühne nicht mehr:**

  | Leinwand | Faltung | offen: frei | 1. Wurf: Leiste / frei | vorher (Lauf 15) |
  |---|---|---|---|---|
  | 812 × 375 | flach | 104 | 224 / **24** | 56,6 |
  | 436 × 380 | flach | 109 | 224 / **29** | 61,6 |
  | 600 × 493 | flach | 118 | 224 / 142 | 174,6 |
  | 673 × 469 | flach (neu) | 113 | 224 / 118 | 94,6 |
  | 1280 × 450 | drei Spalten | 129 | 224 / **49** | 82,1 |
  | 674 × 399 | zwei Spalten | 78 | 224 / **−2**; 7. Wurf 268 / −46 | 31,1 / 5,6 |
  | 435 × 380 | `cramped` | 53 | 224 / **−27** | 5,6 |
  | 393 × 830 | Master | 215 | 224 / 135; 7. Wurf 268 / 113 | 113 |

  Die zwei Entscheide stehen gegeneinander: 44 px „überall" (#142, 4) und eine freie Reihe über
  der Leiste nach dem Wurf (#129). Kleinere Zeichnung bei gleicher Trefferfläche bringt
  höchstens rund 14 px zurück (Stufen 24 statt 28, Auslöser 30); eine Reihe (54) wird bei
  812 × 375 so nicht frei. **Entschieden in Runde 142·145, K1: 44 px gehen vor**
  ([#142](https://github.com/ditshej/tcg-prizing/issues/142#issuecomment-6059121384)). Flach gilt die
  freie Reihe nur noch vor dem ersten Wurf; die 24 / 29 px bei 812 × 375 / 436 × 380 sind das
  neue Soll, AC 1 von #129 ist gestempelt.
- **Unter 352 Leistenbreite** (Bühnen unter rund 392 Breite) sind die sieben Stufen je Reihe
  schmaler als 44: bei 320 × 700 **40,4 × 44**. Sieben Stufen zu 44 brauchen 308 + Lücken; die
  Reihen sind „ungekürzt und ungefaltet" entschieden (#61, #69). **Entschieden in Runde 142·145, K3: Ausnahme unter 348**
  ([#142](https://github.com/ditshej/tcg-prizing/issues/142#issuecomment-6059121918)). Nachgemessen
  liegt die Grenze bei 348 Bühnenbreite, nicht bei rund 392 (340 → 43, 348 → 44); darunter bleiben
  sieben je Reihe, die Stufen sind schmaler als 44 — die eine benannte Ausnahme vom 44-px-Kriterium
  in #142.
- **Flach mit Spalte der heissen Vier (812 × 375)** liegt die offene Leiste über dem unteren
  Regler der Spalte (`Min boosters per rank`, Fläche 39 statt 44 hoch). Die Lage ist alt (Lauf 15:
  Leiste 8–756 über der Spalte 478–764); neu ist nur, dass es jetzt gemessen ist.
  Nachgeschlagen in Runde 142·145: bis dahin Sache des Scrollens (#129, Lauf 15, K4); #143
  Entscheid 5 nimmt `RankFloor` aus der Leiste.
- **`Details` bei 286**: Titelzeile und Zählwerk mit Rückweg passen nicht mehr nebeneinander;
  das Zählwerk geht samt Rückweg unter den Titel, `cap N` bleibt auf der Titelzeile. Die Spalte
  läuft nicht über (`scrollWidth` 286 = `clientWidth`). Die Kurve steht dort in zwei Reihen
  (4 + 3), weil sieben Stufen zu 44 erst ab 332 nebeneinander passen. Gedeckt durch #71 K-B9:
  286 ist die kleinste Breite **ohne Überlauf**, Überschriften dürfen umbrechen.

### Tests

`node --test`: `test/ui-fold.test.mjs` (Obergrenze je Bühne mit den Zahlen des Prototyps,
`--diagram-max`, zwei Reihen mit Deckel), `test/ui-geometry.test.mjs` (`diagramCap` mit Deckel,
Boden gewinnt, `diagramFits` unberührt), `test/ui-look.test.mjs` (Tokens hell und dunkel,
Farben nur über Tokens, Linien nur zwischen Daten, Ecken), `test/ui-icons.test.mjs` (Lucide
vendort samt Lizenz, keine Glyphe und kein Emoji im Markup, Chip-Glyphe als Schlüssel).

## #157 · Das Diagramm nimmt höchstens ein Drittel

Entscheid: Gesamt-Review 2026-10-08, Punkt 4 und F2 a, an #157. Das Diagramm nimmt höchstens ein
Drittel der Fläche, die es mit den Kacheln teilt; die Kacheln haben immer mehr Platz. Fällt das
Drittel unter 60, ist es weg. `DIAGRAM_MAX` bleibt als zweite Obergrenze, Ersthöhe 399 und
`PLAN_FLOOR` 351 bleiben.

- **Stand:** Zweig `feat/157-diagramm-drittel` bei `cd09ffe`. Die Spalten-Zeilen (zwei und drei
  Spalten) sind nachgemessen auf #157 (`525a58e`) + #160 (`feat/156-seitenkoepfe` bei `de76938`),
  weil #161 nach #160 gemergt wird: #156 macht den Plan-Kopf überall 40 hoch statt 42, der feste
  Teil in den Spalten misst damit 175 statt 177, der Rest ist 2 px grösser (Gegenprobe B3). Die
  Telefon- und Flach-Zeilen haben sich dabei nicht bewegt (Master und flach hatten den Kopf schon
  auf 40).
- **Server:** `php -S localhost:8783 -t public` aus der Worktree-Wurzel.
- **Browser:** Chrome headless über Playwright (aus dem npx-Cache, `channel: 'chrome'`), je
  Leinwand ein eigener Kontext mit diesem Viewport, ohne Link (Weekly, 40 Spielende), hell. Der
  geteilte MCP-Browser war von einem anderen Bau belegt.
- **Messmittel:** `getBoundingClientRect`, berechnete Stile. *Rest* (`leftover`) gemessen wie der
  Messrand in `applyGeometry()`: `clientHeight` der Plan-Bühne minus Polster, feste Teile und
  Lücken, die Lücke des Diagramms mitgezählt, als stünde es. *Gedeckt* wie `raffleCover()`
  (Unterkante Raster − (Oberkante Leiste − 10)). *Fenster* ist die Höhe des Kachelfensters, *frei*
  das Fenster minus Gedecktes. *Verhältnis* = frei / Diagramm.
- **Soll** je Leinwand: Diagramm = min(`--diagram-max`, (Rest − gedeckt) / 3), es steht genau dann,
  wenn (Rest − gedeckt) / 3 ≥ 60; frei > Diagramm.

### Leiste zu

| Leinwand | Faltung | Rest | gedeckt | Soll Diagramm | Ist Diagramm | Fenster | Verhältnis |
|---|---|---|---|---|---|---|---|
| 393 × 830 | Master | 475 | 0 | min(280, 158,3) = 158,3 | **158,3** | 316,7 | 2,0 |
| 393 × 844 | Master (iPhone Standalone) | 489 | 0 | min(280, 163) = 163 | **163** | 326 | 2,0 |
| 393 × 664 | Master (Safari mit Leisten) | 309 | 0 | min(280, 103) = 103 | **103** | 206 | 2,0 |
| 375 × 553 | Master (iPhone SE Safari) | 198 | 0 | min(280, 66) = 66 | **66** | 132 | 2,0 |
| 812 × 375 | flach | 200 | 0 | min(96, 66,7) = 66,7 | **66,7** | 133,3 | 2,0 |
| 673 × 760 | einspaltig | 405 | 0 | min(280, 135) = 135 | **135** | 270 | 2,0 |
| 674 × 760 | zwei Spalten | 537 | 0 | min(190, 179) = 179 | **179** | 358 | 2,0 |
| 900 × 700 | zwei Spalten | 477 | 0 | min(190, 159) = 159 | **159** | 318 | 2,0 |
| 1280 × 760 | drei Spalten | 537 | 0 | min(190, 179) = 179 | **179** | 358 | 2,0 |
| 1597 × 900 | drei Spalten | 677 | 0 | min(190, 225,7) = 190 | **190** | 487 | 2,6 |
| 1280 × 450 | drei Spalten, unter 460 | 227 | 0 | min(96, 75,7) = 75,7 | **75,7** | 151,3 | 2,0 |
| 600 × 493 | flach | 318 | 0 | min(96, 106) = 96 | **96** | 222 | 2,3 |
| 673 × 469 | flach | 294 | 0 | min(96, 98) = 96 | **96** | 198 | 2,1 |
| 900 × 399 | zwei Spalten, Ersthöhe | 176 | 0 | 58,7 < 60 → weg | **weg** | 184 | — |
| 674 × 399 | zwei Spalten, Ersthöhe | 176 | 0 | 58,7 < 60 → weg | **weg** | 184 | — |
| 420 × 450 | eng (`data-cramped`) | 105 | 0 | weg (Boden 351: 173 / 3 = 57,7) | **weg** | 113 | — |

### Leiste offen (vor dem ersten Wurf)

| Leinwand | Faltung | Rest | gedeckt | Soll Diagramm | Ist Diagramm | frei | Verhältnis |
|---|---|---|---|---|---|---|---|
| 393 × 830 | Master | 475 | 0 | 158,3 | **158,3** | 316,7 | 2,0 |
| 812 × 375 | flach | 200 | 104 | 32 < 60 → weg | **weg** | 104 | — |
| 600 × 493 | flach | 318 | 104 | min(96, 71,3) = 71,3 | **71,3** | 142,7 | 2,0 |
| 674 × 760 | zwei Spalten | 537 | 104 | min(190, 144,3) = 144,3 | **144,3** | 288,7 | 2,0 |
| 900 × 700 | zwei Spalten | 477 | 104 | min(190, 124,3) = 124,3 | **124,3** | 248,7 | 2,0 |
| 1280 × 760 | drei Spalten | 537 | 104 | min(190, 144,3) = 144,3 | **144,3** | 288,7 | 2,0 |
| 1280 × 450 | drei Spalten, unter 460 | 227 | 104 | 41 < 60 → weg | **weg** | 131 | — |
| 1597 × 900 | drei Spalten | 677 | 104 | min(190, 191) = 190 | **190** | 383 | 2,0 |

Am Master liegt die Leiste unter der Schiene, sie deckt kein Fenster (gedeckt 0, wie in Lauf 14).
Wo das Diagramm weg ist, bekommt das Fenster seinen Platz samt Lücke (Rest + 8).

### Gegen die Vorhersage im Ticket

Das Ticket rechnete mit `PLAN_FIXED` 178. Gemessen ist der feste Teil am Master 175 (650 − 475),
in den Spalten nach #156 ebenfalls 175 (712 − 537; vor #156 waren es 177); der Rest ist darum
3 px grösser als vorhergesagt:

| Vorhersage (#157) | gemessen |
|---|---|
| 844: Rest 486, 162 / 324 | Rest 489, **163 / 326** |
| ~664: Rest 306, 102 / 204 | Rest 309 (bei 393 × 664), **103 / 206** |
| 812 × 375: 87 → rund 66 | vorher 87 (Lauf 17), jetzt **66,7** |
| 1597 × 900: 190 | **190** |

Die Abweichung kommt aus der Annahme, nicht aus dem Bau: 178 ist die aufgerundete Messung von
#71 mit stehender Rangmeldung und gilt in `fold()` als Schranke, nicht als Pixelwert jeder Bühne.

### Was sich verschoben hat

- **Ersthöhe und enge Bühne ohne Diagramm.** Bei 674 × 399 stand es in Lauf 17 auf 61, jetzt
  ist es weg; die enge Bühne zeichnet es nicht mehr auf der festen 60 (`plan.css`, Regel
  `.app[data-cramped] .plan-diagram` jetzt `display: none`, `--diagram-floor` entfällt). Auf der
  engen Bühne bleibt das Raster bei seinen zwei Reihen (`--two-rows`); die Plan-Bühne misst bei
  420 × 450 jetzt 280 (fester Teil + 113). Die frei gewordenen 68 px nimmt nicht das Raster, die
  Schiene rückt hoch (offen, im Bericht an die Eltern-Session).
- **iPhone SE in Safari (375 × 553) behält das Diagramm**, knapp: Rest 198, ein Drittel 66.
- **Unter dem Deckel gemessen statt am Deckel**: 1280 × 450 hat 75,7 statt 96 (Lauf 17), 600 × 493 bei offener
  Leiste 71,3; flach bei geschlossener Leiste (600 × 493, 673 × 469) bleibt es am Deckel 96.

### Tests

`node --test`: `test/ui-geometry.test.mjs` (`diagramCap` als Drittel mit den Zahlen der
Ticket-Tabelle, Gedecktes nicht geteilt, `DIAGRAM_MAX` als zweite Grenze; `diagramFits` bei 179
und 180, auch mit Gedecktem; über 180–2000 nie unter 60, Fenster > Diagramm, zwei Reihen),
`test/ui-fold.test.mjs` (Durchlauf über die Bühnen 357–2000 × 351–1400 mit den gemessenen
Schienen `RAILS_MEASURED` und gedeckt 0 / 79 durch `fold()`, `diagramFits()` und `diagramCap()`:
höchstens ein Drittel, Fenster > Diagramm, steht genau ab 180; kein Diagramm bei 399 und auf der
engen Bühne; 190 bei 1597 × 900; keine feste 60 auf der engen Bühne im Stylesheet).

## #145: Startwerte

Korrektur N2 der Runde 142·145 ([#145](https://github.com/ditshej/tcg-prizing/issues/145#issuecomment-6059141963)).
PR #147 (#145) landet vor PR #148; danach startet One Piece mit anderen Werten: `players` 40
(Release 64), `depthStep` `topThird`, `curve` `moderate` (Weekend `firm`). Gemessen wurde dieses
Protokoll mit 32, `top8`, `mild` (Weekend `steep`). Die Adressen oben tragen die alten
Startwerte darum **selbst**, so wie die Tests auf PR #147 (`MEASURED_ON`) — `players=32` allein
genügt nicht, Weekly und Weekend brauchen auch `depthStep` und `curve`:

| Adresse oben | nach #145 | nach #145 ohne die Ergänzung |
|---|---|---|
| `type=weekly` (`plain`, Zustände darauf, Sets) | `…&players=32&depthStep=top8&curve=mild` | 14 Kacheln statt 8 |
| `type=weekly&depth=32` (`conflictOpen`, Zustände darauf) | `…&players=32&depthStep=top8&curve=mild` | 20 Kacheln, Ränge 20–32 statt 16–32 |
| `type=weekly&players=64&depth=32` | `…&depthStep=top8&curve=mild` | Kurve `moderate` statt `mild` |
| `type=weekly&winnerPacks=16` | `…&players=32&depthStep=top8&curve=mild` | 14 Kacheln, keine ungedeckte |
| K-B2 Weekly | `…&players=32&depthStep=top8&curve=mild` | Spielende 40, Tiefe 14 |
| `type=weekend` (Sets) | `…&players=32&depthStep=top8&curve=steep` | 14 Kacheln, anderes `Offer` |
| `type=weekend&players=27` | `…&depthStep=top8&curve=steep` | Tiefe 9 statt 8, kein Vielfaches mehr („5 off a full display") |
| `type=release` (Sets) | `…&players=32` | 64 Kacheln statt 32 |
| K-B2 Release | `type=release&players=32&manualWinner=20:1` | **kein Überhang** (64 Spielende, 4 `WinnerPack`s: 3 ranked + 1 von Hand) |

Gemessen an einer Merge-Probe (`feat/142-bronze-foil-look` bei `3e339f8` + `origin/feat/145-onepiece-startwerte`
bei `189874f`, losgelöst, danach entfernt; `node --test` dort 623/623), 393 × 830, Chrome
headless: je Zeile ist die ergänzte Adresse nach #145 **gleich** der alten Adresse vor #145 —
Kachelinhalte (Prüfsumme über alle Kacheltexte), Kachelzahl, rote Kacheln, Meldungstexte,
Zählerwerte und Schienenhöhe. Einziger Unterschied: die Zustandswörter der Schiene stehen auf
`pinned` statt `auto`, weil die Werte jetzt von Hand gesetzt sind. Das wirkt auf das Bild nur bei
360–361 und 540–542 Breite, wo ein gepinntes `Served ranks` die Schiene auf 139 hebt (Lauf 17);
keine der Leinwände oben liegt dort. Unverändert gleich bleiben ohne Ergänzung
`type=release&players=64` (Blase) und K2 bei `plain` (Schiene 124 ab 360, 375 × 553 und
360 × 580 in einem Bild, Trefferflächen 0 unter 44 — mit 14 Kacheln statt 8).

**`CarryOverNotice`** (`type=weekly&players=40&rankFloor=3`, dann Weekend) bleibt, wie sie ist:
dieselbe Meldung „2 pinned values stayed behind …", die Blase bei 393 × 830, 812 × 375 und
900 × 700 an derselben Stelle (5,6 über dem Knopf, ganz im Bild). Neu steht darüber ein `Offer`
(„Rank 1 is 3 off a full display"), weil Weekend jetzt mit `topThird` und `firm` rechnet. Mit
`depthStep` und `curve` in der Adresse würden aus 2 gepinnten Werten 4 — die Ergänzung passt
hier nicht.

Die Zahlen dieses Protokolls gelten damit, sobald #147 auf `main` steht.

## #143 · Plan-Kopf und Leiste

Entscheid: Body von #143 (Maintainer, 2026-10-08, Durchklicken) und K2 der Runde 142·145
([#143](https://github.com/ditshej/tcg-prizing/issues/143), Kommentar K2). Share und Reset-all
stehen als Icons oben rechts im Plan-Kopf, die Leiste trägt Players, Served ranks und die Curve
als Chips über die ganze Breite, „Set packs to …" auf `Prepare` ist weg.

- **Stand:** Zweig `feat/143-plan-kopf-leiste`, geschnitten von `feat/146-ios-ohne-gummiband`
  (PR #150, 16-px-Felder, kein Gummiband) — die Messung schliesst #150 ein.
- **PHP:** 8.3.33 (`php -v`). Server `php -S localhost:8743 -t public` aus der Worktree-Wurzel
  `tcg-prizing-143`.
- **Browser:** Google Chrome (headless) über Playwright, `colorScheme` light, Viewport je Leinwand.
- **Messmittel:** `getBoundingClientRect` von `.plan-controls` (mit Innenabstand) und
  `.plan-head`; Trefferfläche wie Lauf 17 (von der Mitte aus waagrecht und senkrecht über
  `elementFromPoint`, Kante auf 1/64 px halbiert; nur Ziele, deren ganzes 44er-Feld im Bild liegt).
- **Adressen:** ohne Link (Startwerte nach #145) und mit den alten Startwerten gepinnt
  (`type=weekly&players=32&depthStep=top8&curve=mild`, dazu `rankFloor=3` für den Reset-Zähler).

### Die Leiste — Soll und Ist

Soll (K2): zwei Zähler nebeneinander ab 360, die Chips der Curve darunter über die ganze Breite;
375 × 553 und 360 × 580 zeigen Plan, zwei Kachelreihen, Diagramm und Leiste in einem Bild; die
Karte rechnete mit **124**. Unter 360 untereinander, 320 scrollt (#73 K4); die sieben Chips brechen
unter 348 4 + 3 um (7 × 44 + 6 × 4 = 332 für den Inhalt der Leiste).

| Leinwand | Leiste | Zähler je Zeile / Chips | Diagramm | Raster | Fuss | Scrollen |
|---|---|---|---|---|---|---|
| 320 × 900 | 632–844 = **212** | 1 / 4 + 3 (Chip 73 breit) | 80–360 | 397–574 | 844–900 | nein |
| 360 × 900 | 720–844 = **124** | 2 / 7 (45,7) | 80–360 | 397–662 | 844–900 | nein |
| 375 × 900 | 720–844 = **124** | 2 / 7 (47,8) | 80–360 | 397–662 | 844–900 | nein |
| 393 × 830 (Master) | 650–774 = **124** | 2 / 7 (50,4) | 80–360 | 397–592 | 774–830 | nein |
| 673 × 900 | 720–844 = **124** | 2 / 7 (90,4) | 80–360 | 397–662 | 844–900 | nein |
| **375 × 553** (iPhone SE, Safari) | 373–497 = **124** | 2 / 7 | 80–165 (85) | 202–315 = zwei Reihen | 497–553 | **nein** |
| **360 × 580** | 400–524 = **124** | 2 / 7 | 80–192 (112) | 229–342 = zwei Reihen | 524–580 | **nein** |
| 360 × 580, `Served ranks` gepinnt | 385–524 = **139** | 2 / 7 | 80–177 (97) | 214–327 = zwei Reihen | 524–580 | nein |

Durchlauf über jede Breite 320–673 (Höhe 900):

| Adresse | Stufen der Leiste |
|---|---|
| ohne Link | 320–335: 212 · 336–347: 195 · 348–359: 151 · 360–673: **124** |
| alte Startwerte gepinnt | 320–347: 212 · 348–350: 168 · 351–359: 151 · 360–361: **139** · 362–539: 124 · 540–542: 139 · 543–673: 124 |
| `type=weekly&depth=32` | 320–347: 212 · 348–351: 168 · 352–359: 151 · 360–362: **139** · 363–539: 124 · 540–543: 139 · 544–673: 124 |
| `type=release` · `type=weekend` | 320–337: 212 · 338–347: 195 · 348–359: 151 · 360–673: 124 |

Gemessene Spanne damit **124 bis 212** (vor #143 mit vier Reglern 124 bis 229). Die Chip-Zeile
ist so hoch wie die Zählerzeile, die sie ersetzt (Titelzeile + 34): am Master bleibt die Leiste
**124**, `RAIL_AT_MASTER` 124 ist nachgemessen und gilt. Die 4 + 3 kosten bei 320 die erwartete
eine Chip-Reihe; dass die Leiste dort trotzdem 17 niedriger ist als vorher (212 statt 229), zahlt
der weggefallene vierte Zähler. Die Durchläufe in `test/ui-fold.test.mjs` rechnen mit 124, 139,
151, 168, 195 und 212; `MEASURED_RAIL` trägt 212 / 124 / 124 / 124 / 139 / 124 bei
320 / 360 / 393 / 500 / 540 / 600 (vorher die Lesungen vom 2026-10-02, vor #142).

**Befund, nicht still:** Die Leiste geht bei 360 über 124, sobald `Served ranks` gepinnt ist —
**139** bei 360–362 (Titel, `pinned` und `cap N` passen nicht auf eine Zeile; dieselbe Stelle wie
Lauf 17 bei 360–361 und 540–542). 360 × 580 bleibt dabei in einem Bild (Diagramm 97, zwei Reihen,
kein Scrollen). Bei 375 bleibt sie in allen gemessenen Adressen 124.

Die einspaltige Schwelle (351 + 56 + gemessene Leiste) am Bild bestätigt: 360, 375 und 393 × 531
einspaltig, × 530 `cramped`; 350 × 558 / 557 (Leiste 151) und 320 × 619 / 618 (Leiste 212) ebenso.

**Die Messprobe hatte noch die alte Zelle.** `.rail-probe .controls-hot` stand seit K2 auf
`minmax(176px, 1fr)`, die Leiste selbst auf 164: wo die Leiste nicht als Balken steht
(`Details` vorn, Vollbild, flach), mass die Probe bei 360–392 untereinander stehende Zähler.
Nachgestellt mit der alten 176 im Bau von #143: `Details` bei 375 × 553 ging auf `cramped`. Jetzt
lesen Leiste und Probe dieselbe Eigenschaft (`--rail-cells`); 375 × 553 und 360 × 580 bleiben
auf `Details` einspaltig.

### Der Plan-Kopf — Soll und Ist

Soll: Share und Reset-all oben rechts, je mindestens 44 × 44 Trefferfläche, der Kopf wächst nicht
(`PLAN_FIXED` 178 mit Kopf 42). Gebaut: die beiden Knöpfe stehen **neben** den zwei Zeilen des
Kopfs, nicht in `.col-titleline` (die schneidet mit `overflow: hidden` und ist 22 hoch);
Zeichnung **32 × 32**, Abstand 12, Teilung 44.

| Leinwand | Kopf | Reset (Zeichnung / Fläche) | Share (Zeichnung / Fläche) | Abstand rechts |
|---|---|---|---|---|
| 320 × 900 | 8–48 = **40** | 32 × 32 / 44 × 45 | 32 × 32 / 45 × 45 | 8 |
| 360 × 580 · 375 × 553 · 393 × 830 | **40** | 32 × 32 / 44 × 45 | 32 × 32 / 45 × 45 | 8 |
| 812 × 375 (flach) | **40** | 32 × 32 / 44 × 45 | 32 × 32 / 45 × 45 | 342 (Spalte der heissen Regler rechts) |
| 674 × 760 · 1280 × 760 | 8–50 = **42** (Titel `Plan` im Kopf) | 32 × 32 / 44 × 45 | 32 × 32 / 45 × 45 | 294 (`Details` rechts) |

Der Kopf ist gleich hoch wie vorher (40 einspaltig, 42 mit Titel). Fester Teil bei 388
(674 × 760, `players=64&depth=32`, alte Startwerte): 8 + Kopf 42 + `Participation` 16 +
Legende 21 + Rangtotal 15 + Rangmeldung 27 + 6 × 8 = **177**, unter `PLAN_FIXED` 178.
Trefferflächen aller Ziele im Bild auf `Plan` (30 bei 320 × 900, 360 × 580, 375 × 553,
393 × 830): **0** unter 44. Bei 674 × 760 und 1280 × 760 (47 / 46 Ziele) einzig das Zählwerk
`Min boosters per rank`, das in der `Details`-Spalte halb unter dem Streifen liegt (Sache des
Scrollens, wie Lauf 17).

**Folge, gemessen:** die Ausgabezeile verliert die 84 px der zwei Knöpfe (bei 393: 377 → 293). Mit
„tournament packs" stand sie bei 393 nicht mehr ganz da; seit K-B3 heisst sie
`120 boosters · 40 packs · 4 winner packs` und steht neben beiden Knöpfen ganz (1 Pin, Reset
sichtbar). Gemessen am App-Stand dieses PRs (Chrome headless, `.plan-output`, Textbreite über
`Range`):

| Leinwand | Platz (`clientWidth`) | Weekly `rankFloor=3` (Text 254.6) | Release `players=128&rankFloor=3` (Text 266.5) | Kopf | Leiste |
|---|---|---|---|---|---|
| 393 × 830 | 293 | `scrollWidth` 293 ✓ | 293 ✓ | **40** | **124** |
| 375 × 553 | 275 | 275 ✓ | 275 ✓ | **40** | **124** |
| 360 × 580 | 260 | 260 ✓ | 266 ✗ → scrollt seitlich (#129 K6) | **40** | **124** |

Bei 320 × 900 (`players=64&depth=32`, Text 253.6, Platz 220) scrollt sie wie bisher; bei
674 × 760 und 1280 × 760 steht sie ganz, Kopf **42**. Kopf und Leiste sind gleich hoch wie
vorher, also bleiben `PLAN_FIXED` 178 und `RAIL_AT_MASTER` 124 unberührt.

### Die Abläufe

- **Share** (393 × 830, 900 × 700, 320 × 900): kopiert die vollständige Adresse
  (`…?v=1&game=onepiece&type=weekly&players=32&rankFloor=3&depthStep=top8&curve=mild`); die Blase
  „Link copied" steht 92 × 29 unter dem Knopf, 6 Abstand, am rechten Rand 8 innen, und ist nach
  2,1 s weg. Ohne Clipboard (Schnittstelle entfernt): dieselbe Blase mit dem Feld (312 × 58),
  Fokus im Feld, ganze Adresse markiert, ✕ schliesst. Im Vollbild stehen beide Knöpfe nicht.
- **Reset-all** mit vier Posten (Zähler „4" an der Ecke): 393 × 830 und 320 × 900 fragen in der
  Blase der Meldungsebene (`[data-notice-drop]`, die des Blatts liegt unter der verborgenen Seite),
  900 × 700 in der des Blatts; überall „4 values back to Weekly?", Aufzählung mit Zielwerten,
  „There is no undo". Bestätigt: alle vier fallen, die Adresszeile steht auf
  `?v=1&game=onepiece&type=weekly`, der Knopf verschwindet.

### Tests

`node --test`: `test/ui-controls.test.mjs` (`HOT_KEYS` drei, `rankFloor` gleich darunter auf dem
Blatt), `test/views-controls-hot.test.mjs` (kein `<select>`, `curve_steps()` für Blatt und
Leiste), `test/ui-pins.test.mjs` (Reset im Plan-Kopf mit Zähler, fragt zuerst; nicht mehr auf
`Details`), `test/ui-link-screen.test.mjs` (Share im Kopf, Icon allein, Blase 2 s ohne Zustand),
`test/ui-plan.test.mjs` (die Frage nimmt die Blase im Bild; kein `takeOffer()`),
`test/ui-prepare.test.mjs` (kein Angebot bei 0–100 Packs), `test/ui-fold.test.mjs` (gemessene
Leisten).

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
- ~~`<select>` der Kurve in der Schiene auf iOS~~ — gegenstandslos seit #143: die Leiste trägt Chips, die App hat kein `<select>` mehr.
- Echte Schriften auf iOS/Android: ob die Schiene bei 320–360 Breite umbricht (A5 hängt an der Schriftbreite), ob der Kopf bei 320–340 zweizeilig wird (gemessen 58 statt 40).
- Querformat mit Browserleisten: ob die Bühne unter 349 hoch fällt (A6) und was `100dvh` beim Ein- und Ausblenden der Leisten tut.
- Sichere Bereiche (Notch) am gedrehten Streifen rechts im Querformat.
- Freies Ziehen eines echten Fensters (hier nur Treppen über `setViewportSize`).
- Farben auf einem echten OLED-Schirm im dunklen Modus, besonders das knappe Flächenpaar `ConflictNotice` / `CarryOverNotice` im hellen.
- Gerätepixel-Rundung an der zweiten Kachelreihe (die `112.999…`-Falle, auf dem Gerät mit DPR 3).
