# Abnahme am Bild — #73

Protokoll der Abnahme am Bild für Spec 2 (#61): je Leinwand die gemessenen Zahlen
neben den Sollwerten, nie „sieht gut aus".

- **Stand:** `main` bei `cd539a9` (nach Lauf 13), Zweig `feat/73-abnahme-am-bild`
- **PHP:** 8.3.33 (`php -v`), Entscheid K4 an #73
- **Server:** `php -S localhost:8773 -t public` aus der Worktree-Wurzel
- **Browser:** Chromium über Playwright MCP, Emulation `colorScheme` light / dark
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `elementFromPoint` für Verdeckung
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
| Höhenschwelle einspaltig | 494 | #71 K-B10a |
| flach ab Breite | 436 | #71 K-B10b |
| heisse Vier als Spalte auf der flachen Bühne ab | 722 | #71 K-B10c |

Leinwände (aus den Entscheiden abgeleitet): 393 × 830 (Master), 812 × 375
(flach), 673/674 (Übergang), 900 × 700, 1280 × 760, 1597 (Deckel).

## Zwischenstand (wird fortgeschrieben)

- Alle sechs Leinwände plus 673/674 in beiden Modi gefahren; Layout hell und dunkel identisch.
- Behoben: (F1) Verlosungsleiste lag über offener `ConflictNotice` und Chip → Stapel und Chips steigen über die Leiste (`21be064`). (F2) Vollbild zeigte 21/26 Kachelspalten → 16er-Deckel auch im Vollbild (`6f8c316`).
- Offen, zu entscheiden: Verlosungsleiste deckt ab 674 und auf der flachen Bühne die zwei garantierten Kachelreihen zu (sichtbares Fenster 44 px); Vollbild-Griff verdeckt die `WinnerPack`-Marke der letzten Kachel der ersten Reihe; Rangmeldung rutscht bei umbrechender Schiene (101–117 px statt 87) unter die Schiene; flache Bühne unter 349 px Höhe.

