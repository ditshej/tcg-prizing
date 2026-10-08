# Abnahme — #155 Share: System-Teilen wo `navigator.share` vorhanden ist, sonst Blase mit `Copy link`

Gemessen am echten App-Stand, nie „sieht gut aus".

- **Stand:** Zweig `feat/155-share-zweige`, gestapelt auf #154 (`feat/154-blasen-im-bild`, `03819d3`)
- **Adresse:** `http://localhost:8785/` — **sicherer Kontext** (`window.isSecureContext === true`, gemessen). Nicht über die LAN-Adresse per http geprüft (#155, „Folge für die Abnahme").
- **Server:** `php -S localhost:8785 -t public` aus der Worktree-Wurzel, PHP 8.3.33
- **Browser:** Google Chrome 155.0.8059.40 headless über Playwright 1.64 (npx-Cache), Skripte unter `/tmp/m155`, nicht im Repo
- **System-Zweig:** `navigator.share` per Init-Skript ersetzt und protokolliert; gemessen mit grobem Zeiger (`isMobile` + `hasTouch`, `matchMedia('(pointer: coarse)').matches === true`) und nach K3 auch mit feinem (1280 × 800)
- **Blasen-Zweig:** `navigator.share` per Init-Skript entfernt (Chrome headless am Mac hat es über localhost, gemessen: `typeof navigator.share === 'function'`); 1280 × 800, feiner Zeiger, Clipboard-Rechte erteilt; die Zwischenablage wird vor jedem Fall auf `sentinel` gesetzt und danach über `navigator.clipboard.readText()` zurückgelesen
- **Messmittel:** `getBoundingClientRect`, berechnete Stile, `visualViewport`

## Zweigwahl

**Regel nach Entscheid K3** (#155, Kommentar „Entscheid K3"): Jedes Gerät, auf dem `navigator.share` vorhanden ist, bekommt beim Druck auf Share direkt das System-Teilen — auch Safari am Mac, Tablets und Edge unter Windows. Nur wo `navigator.share` fehlt, öffnet Share die Blase. Die Art des Zeigers spielt keine Rolle mehr. Die erste Fassung dieser Abnahme hatte noch die Grenze „grober Zeiger **und** `navigator.share`" gemessen; K3 hat sie verworfen, die Tabelle ist nachgeführt.

| Zeiger | `navigator.share` | Zweig | Beleg |
|---|---|---|---|
| grob | Funktion | System | Browser (Fall C) und `test/ui-link-screen.test.mjs` |
| grob | fehlt | Blase | Browser (Fall B, 393 / 320) und Test |
| fein | Funktion | **System** (vor K3: Blase) | Browser, 1280 × 800: ein Aufruf `{ url: "http://localhost:8852/?v=1&game=onepiece&type=weekly" }`, keine Blase; und Test |
| fein | fehlt | Blase | Browser (Fall A) und Test |

Der Test hält zusätzlich fest, dass `shareEnv()` keine Zeiger-Abfrage mehr stellt: ein wieder eingeführtes `(pointer: coarse)` in `shareBranch()` oder `shareEnv()` färbt ihn rot (Mutation geprüft).

## System-Zweig (393 × 700, grober Zeiger, `navigator.share` vorhanden)

| Fall | `navigator.share`-Aufrufe | Blase | Zwischenablage danach |
|---|---|---|---|
| Teilen gelingt | 1 × `{ url: "http://localhost:8785/?v=1&game=onepiece&type=weekend&players=48" }` | zu | `sentinel` (nichts kopiert) |
| `AbortError` | 1 × dieselbe Form | zu, keine Meldung | `sentinel` |
| `NotAllowedError` | 1 × dieselbe Form | **offen** (Rückfall auf die Blase) | `sentinel` |

Die geteilte Form ist die vollständige (`v`, `game`, `type` und der Pin `players`), auch wenn die Adresszeile gerade anders aussieht (#47).

## Blasen-Zweig (1280 × 800, ohne `navigator.share`)

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

### Zoom und Verschieben bei offener Blase (#155 N3)

Die Gegenprobe (N3) fand: `_onView` — der Hörer auf `visualViewport` für Zoom und Verschieben — rief `placeShare()` direkt und ging an `keepShare()` vorbei. Eine offene Blase schloss deshalb nicht, wenn Share aus dem sichtbaren Ausschnitt fiel (#66), und wurde nach einem Zoom nicht auf die sichtbare Breite gedeckelt. Jetzt ruft `_onView` `keepShare()`. Gemessen auf `localhost:8852`, 393 × 830, ohne `navigator.share`, Blase bei Zoom 1 geöffnet (93–385, 292):

| Fall | sichtbarer Ausschnitt | vor der Reparatur | nach der Reparatur |
|---|---|---|---|
| `Emulation.setPageScaleFactor` 1,5 (echter Zoom, Ausschnitt bleibt links, Share 353–385 ausserhalb) | 0–262 | **offen**, 8–300, 292 | **zu** |
| `visualViewport` gestellt: Zoom 1,5, rechts angelegt (Share sichtbar), `resize` | 131–393 | offen, 139–431, **292** — 38 über dem Rand | offen, **139–385, 246** |
| danach nach links verschoben (Share ausserhalb), `scroll` | 0–262 | **offen**, 8–300, 292 | **zu** |

Der echte Zoom verschiebt den Ausschnitt nicht (siehe oben), darum ist der Fall „Anker bleibt sichtbar" gestellt; ein Pinch per `Input.synthesizePinchGesture` zoomte im headless Chrome gar nicht. `test/ui-bubble.test.mjs` hält beide Hälften am Hörer fest, den `init()` registriert; mit `placeShare()` statt `keepShare()` werden beide Tests rot (Mutation geprüft).

## Sperre durch eine unbestätigte Zahl

| Schritt | gemessen |
|---|---|
| `Players` getippt, nicht bestätigt, Druck auf Share | Blase bleibt zu; die Zahl gilt |
| zweiter Druck auf Share | Blase offen |
| Blase offen, `Players` per Tastatur getippt (Fokus, kein Druck daneben), Druck auf `Copy link` | Zwischenablage `sentinel`, kein `Copied`; die Zahl gilt |
| zweiter Druck auf `Copy link` | kopiert, Adresse trägt die neue Spielerzahl |

## Für #121 (nur am Gerät prüfbar)

- iPhone und Android über https: Share öffnet die Teilen-Ansicht des Systems, der geteilte Link öffnet den gesetzten Stand.
- Safari am Mac über https (K3): Share öffnet das System-Teilen, keine Blase.
- iPhone und Android über http im LAN: Share fällt auf die Blase zurück, `Copy link` kopiert per `execCommand` oder zeigt das Feld.
