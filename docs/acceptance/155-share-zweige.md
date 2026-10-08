# Abnahme — #155 Share: System-Teilen am Telefon, Blase mit `Copy link` am Desktop

Gemessen am echten App-Stand, nie „sieht gut aus".

- **Stand:** Zweig `feat/155-share-zweige`, gestapelt auf #154 (`feat/154-blasen-im-bild`, `03819d3`)
- **Adresse:** `http://localhost:8785/` — **sicherer Kontext** (`window.isSecureContext === true`, gemessen). Nicht über die LAN-Adresse per http geprüft (#155, „Folge für die Abnahme").
- **Server:** `php -S localhost:8785 -t public` aus der Worktree-Wurzel, PHP 8.3.33
- **Browser:** Google Chrome 155.0.8059.40 headless über Playwright 1.64 (npx-Cache), Skripte unter `/tmp/m155`, nicht im Repo
- **Telefon-Zweig:** `isMobile` + `hasTouch` (gemessen: `matchMedia('(pointer: coarse)').matches === true`), `navigator.share` per Init-Skript ersetzt und protokolliert
- **Desktop-Zweig:** 1280 × 800, feiner Zeiger (`(pointer: coarse)` = `false`), Clipboard-Rechte erteilt; die Zwischenablage wird vor jedem Fall auf `sentinel` gesetzt und danach über `navigator.clipboard.readText()` zurückgelesen
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `visualViewport`

## Zweigwahl

| Zeiger | `navigator.share` | Zweig | Beleg |
|---|---|---|---|
| grob | Funktion | Telefon | Browser (Fall C) und `test/ui-link-screen.test.mjs` |
| grob | fehlt | Desktop | Browser (Fall B, 393 / 320) und Test |
| fein | Funktion | Desktop | Test |
| fein | fehlt | Desktop | Browser (Fall A) und Test |

## Telefon-Zweig (393 × 700, grober Zeiger, `navigator.share` vorhanden)

| Fall | `navigator.share`-Aufrufe | Blase | Zwischenablage danach |
|---|---|---|---|
| Teilen gelingt | 1 × `{ url: "http://localhost:8785/?v=1&game=onepiece&type=weekend&players=48" }` | zu | `sentinel` (nichts kopiert) |
| `AbortError` | 1 × dieselbe Form | zu, keine Meldung | `sentinel` |
| `NotAllowedError` | 1 × dieselbe Form | **offen** (Rückfall auf den Desktop-Zweig) | `sentinel` |

Die geteilte Form ist die vollständige (`v`, `game`, `type` und der Pin `players`), auch wenn die Adresszeile gerade anders aussieht (#47).

## Desktop-Zweig (1280 × 800)

| Schritt | gemessen | Soll |
|---|---|---|
| Druck auf Share | Blase offen, Zwischenablage `sentinel` | öffnet, kopiert nichts |
| Blase beim **ersten** Öffnen | left 824 · right 1116 · top 51 · bottom 139, **Breite 292**, sichtbar 0–1280 × 0–800 | ganz im sichtbaren Ausschnitt |
| `Copy link` | Zwischenablage `http://localhost:8785/?v=1&game=onepiece&type=weekend&players=48`, Knopf heisst `Copied` | kopiert die vollständige Form |
| 2100 ms danach | Knopf heisst `Copy link` | `COPIED_MS` = 2000, kein Zustand |
| zweiter Druck auf Share | zu | schliesst |
| Escape | zu | schliesst |
| Druck daneben (400, 500) | zu | schliesst |
| Trefferfläche `Copy link` | 80,5 × 32 gezeichnet, `::after` −6 oben und unten → 80,5 × 44 | ≥ 44 × 44 |

### Ohne `navigator.clipboard` (Getter auf `undefined` gestellt)

| Fall | Knopf | Feld | Zwischenablage (aus einem zweiten Tab gelesen) |
|---|---|---|---|
| `execCommand('copy')` meldet `true` | `Copied` | zu | die vollständige Form |
| `execCommand` meldet `false` | bleibt `Copy link` | **offen**, vorselektiert, Wert = vollständige Form; Blase wächst auf bottom 191, Breite 292 | `sentinel` (kein behaupteter Erfolg) |

## Blase im sichtbaren Ausschnitt, erstes Öffnen

Der Fehler aus #154 (`fixed` ohne Breite schrumpft auf den Platz rechts der letzten Stelle, 87 statt 92) ist hier nicht möglich: `.share-bubble` hat `width: min(292px, 100vw − 16px)`, und `keepShare()` deckelt sie vor dem Setzen auf die sichtbare Breite − 16.

| Fall | sichtbarer Ausschnitt | Blase (left–right, Breite) | Rand rechts / links |
|---|---|---|---|
| 393 × 700, Rückfall ohne `navigator.share` | 0–393 | 93–385, 292 | 8 / 93 innen |
| 320 × 568, Rückfall | 0–320 | 20–312, 292 | 8 / 20 innen |
| 393, Zoom 1,25 (`visualViewport` gestellt, rechts angelegt) | 78,6–393 | 93–385, 292 | 8 / 14,4 innen |
| 393, Zoom 1,5 (gestellt) | 131–393 | 139–385, **246** | 8 / 8 innen |

Ohne die Deckelung stand die Blase bei Zoom 1,5 mit 292 **38 px** über dem rechten sichtbaren Rand. Der Zoom ist gestellt (`visualViewport` per Init-Skript ersetzt): `Emulation.setPageScaleFactor` zoomt zwar, verschiebt den Ausschnitt aber nicht, und Share lag dann ausserhalb — dort schliesst die Blase richtigerweise, weil ihr Anker nicht zu sehen ist (#66).

## Sperre durch eine unbestätigte Zahl

| Schritt | gemessen |
|---|---|
| `Players` getippt, nicht bestätigt, Druck auf Share | Blase bleibt zu; die Zahl gilt |
| zweiter Druck auf Share | Blase offen |
| Blase offen, `Players` per Tastatur getippt (Fokus, kein Druck daneben), Druck auf `Copy link` | Zwischenablage `sentinel`, kein `Copied`; die Zahl gilt |
| zweiter Druck auf `Copy link` | kopiert, Adresse trägt die neue Spielerzahl |

## Für #121 (nur am Gerät prüfbar)

- iPhone und Android über https: Share öffnet die Teilen-Ansicht des Systems, der geteilte Link öffnet den gesetzten Stand.
- iPhone und Android über http im LAN: Share fällt auf die Blase zurück, `Copy link` kopiert per `execCommand` oder zeigt das Feld.
