# PHP folgt dem Vhost, nicht der SSH-Shell

ADR 0004 pinnt PHP lokal auf **8.3**, „weil der Server nicht höher kann". Beim
Scharfstellen des Deploys (#30, 2026-10-09) zeigte sich, dass der Satz zwei
verschiedene PHPs auf demselben Server zusammenfasst:

| Wo auf `goethe.metanet.ch`                          | höchste Fassung |
| --------------------------------------------------- | --------------- |
| Webserver, Plesk-Auswahl pro Vhost                  | **8.5**         |
| SSH-Shell im Jail (`/opt/php*/bin`, `/opt/plesk/php`) | 8.3.21          |
| `php` im `PATH` der SSH-Shell                       | 8.2.6           |

Die Grenze von 8.3 gilt nur für die **Shell**. Sie stammt aus dem Hausmuster der
Laravel-Geschwister, deren Deploy `composer` und `artisan` über SSH aufruft — dort
muss die Shell dasselbe PHP haben wie der Webserver, und mehr als 8.3 hat sie nicht.

Dieses Projekt ruft auf dem Server **kein PHP über SSH** auf. `_deploy.sh` ist
reines Git (`rev-parse`, `diff-index`, `pull --ff-only`), `DEPLOY_PHP` ist in #22
gestrichen, und einen Build-Schritt schliesst ADR 0004 selbst aus. PHP läuft auf
dem Server nur im Webserver.

**Entschieden (Maintainer, 2026-10-09, an #30): PHP ist überall 8.5.** Die
Fassung folgt dem, was ausliefert:

- **Vhost** `prizing.optcg.ch`: 8.5 in Plesk.
- **CI** (`.github/workflows/ci.yml`): `php -l` auf 8.5.
- **Lokal**: Herd auf 8.5 — auch für die Bilder einer Abnahme. Entscheid K4 an
  #73 („die Bilder entstehen auf 8.3") ist damit überholt; sein Grund war
  derselbe Satz aus ADR 0004.

Was von ADR 0004 bleibt, bleibt: lokal, CI und Vhost laufen auf **derselben**
Fassung, damit „läuft bei mir" nicht zur Kategorie wird. Nur die Zahl und ihr
Grund sind neu.

## Consequences

**Webserver und Shell auf dem Server laufen auseinander** — 8.5 gegen 8.3. Das ist
folgenlos, solange auf dem Server niemand PHP über SSH startet. Wer das einführt
(ein Cronjob, ein `php -l` vor dem Pull, ein Skript im Deploy), stösst an die
Grenze und muss entweder zurück auf 8.3 oder Metanet nach einer neueren Shell
fragen. Dieser ADR ist die Stelle, an der das entschieden wird.

**Die Probe für 8.5 ist gemacht, nicht angenommen:** `php -l` über `views/*.php`
und `public/index.php` läuft auf 8.3, 8.4 und 8.5 sauber; die Seite rendert unter
8.5 mit `error_reporting=E_ALL` ohne Deprecation oder Warning.

**Ältere Abnahmeprotokolle bleiben, wie sie sind.** Ihre Kopfzeilen nennen
8.3.33, und das stimmte, als gemessen wurde. Eine neue Messung nennt 8.5.
