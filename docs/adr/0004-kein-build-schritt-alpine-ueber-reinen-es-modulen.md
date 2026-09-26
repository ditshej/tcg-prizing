# Kein Build-Schritt: Alpine über reinen ES-Modulen

Der Rechenkern läuft **im Browser** als reine ES-Module, die das DOM nie
anfassen: `distribute(prizePool, settings)` macht aus den Reglerstellungen den
`DistributionPlan` und sonst nichts. Die Oberfläche darüber ist **Alpine 3**,
gepinnt als eine mitgelieferte Datei unter `public/vendor/`, kein CDN. **PHP**
komponiert das Markup aus Vorlagen in `views/` — ausserhalb des Docroots, also
von aussen nicht abrufbar. Geprüft wird ausschliesslich der Kern, mit **Nodes
eingebautem Runner** (`node --test`).

Es gibt **keinen Build-Schritt**. Was im Repository liegt, ist was der Server
ausliefert.

## Considered Options

**Serverseitiges PHP als Programm.** Formular abschicken, PHP rechnet, HTML
zurück. Die naheliegende Wahl für einen Maintainer, der PHP am besten liest, und
sie scheitert am Bedienbild: das Werkzeug lebt von Reglern, an denen man zieht
und sofort sieht, was passiert, und die Konflikt-Warnungen aus
[Regler-Konflikte](https://github.com/ditshej/tcg-prizing/issues/19) sollen
während des Ziehens erscheinen, nicht nach dem Abschicken. Ein Round-Trip pro
Reglerzug macht daraus ein anderes Werkzeug. Dazu kommt, dass die Berechnung eine
reine Funktion ihrer Eingaben ist (ADR 0002) und damit keinen Grund hat, auf
einem Server zu sitzen, der ohnehin keinen Zustand hält.

**Vanilla ohne Alpine.** Verworfen — aber nicht wegen der Regler: ein
delegierter Listener auf dem Regler-Container sind rund fünfzehn Zeilen, das ist
kein Argument. Es scheitert an der Ausgabe. Der `DistributionPlan` ist
verschachtelt — `Pool`s, darin Ränge, darin `PrizeItem`s — und ist damit das
grösste und am häufigsten angefasste Stück Markup im Projekt. Als verschachtelte
Template-Strings mit `.join('')` verliert es Einrückung, Highlighting und jede
Hilfe des Editors, und ein vergessenes `join` liefert Kommas ins HTML. Als
`x-for` bleibt Markup Markup, und `x-text` maskiert nebenbei von selbst.

**Ein Bundler (Svelte, Vue, Vite).** Verworfen, weil bei einem Werkzeug, das
über Jahre nebenbei gepflegt wird, die Toolchain kaputtgeht und nicht der Code.
Ein `node_modules`, das in zwei Jahren nicht mehr installiert, hält die
Wartungsarbeit auf, für die es angeschafft wurde. Verschärfend: auf dem Server
existiert kein Node, ein Build müsste also ohnehin lokal laufen und sein Ergebnis
hochgeschoben werden — ein zusätzlicher Schritt im Deploy für ein Projekt, dessen
Artefakt sonst die Dateien selbst sind.

**Vitest statt Nodes Runner.** Verworfen, obwohl der Maintainer es kennt.
Vitest verdient sein `node_modules` dort, wo es etwas zu transformieren gibt —
TypeScript, JSX, CSS-Importe, Pfad-Aliase. Davon hat dieses Projekt nichts: der
Kern besteht aus ES-Modulen, die Browser und Node identisch laden. Es bliebe der
Watch-Modus und die schönere Ausgabe, und beides hat Node 22 selbst.

**Reine `index.html` statt `index.php`.** Verworfen an einem technischen
Umstand, der die naheliegende Antwort umdreht: `<script type="module">`
funktioniert nicht über `file://`. Ein lokaler Server ist also auch bei reiner
Statik nötig, womit der einzige echte Vorteil einer `index.html` — sie
doppelklickbar zu haben — wegfällt. Ist ein Server ohnehin gesetzt (lokal Herd,
auf dem Vhost PHP 8.3), sind PHP-Includes gratis und zerlegen das Markup in
benennbare Stücke, ohne dass ein Bundler dafür ins Haus kommt.

## Consequences

**Der Deploy hat kein Artefakt.** Das Hausmuster des Maintainers baut lokal und
schiebt das Ergebnis per `rsync` hoch; hier gibt es kein Ergebnis, das nicht
schon im Repository liegt. Damit schrumpft der Ablauf auf den SSH-Trigger mit
`git pull --ff-only`, und der `rsync`-Schritt entfällt ganz. Geformt wird das in
[Deploy-Ablauf](https://github.com/ditshej/tcg-prizing/issues/22).

**Node ist reine Entwicklungsabhängigkeit** und wird nur für Tests gebraucht.
Dass der Server keins hat, ist damit kein Mangel, sondern folgenlos.

**Lokal wird PHP auf 8.3 gepinnt**, weil der Server nicht höher kann. Bei
Vorlagen-Komposition ist wenig Syntax im Spiel, aber die Kategorie „läuft bei
mir" verschwindet für einen Klick in Herd.

**Die Schale ist tauschbar, der Kern nicht berührt.** Alpine liest nur das
Ergebnis von `distribute()` und kommt nie an die Rechnung heran. Sollte Alpine 4
einen Umbau verlangen, betrifft er die Vorlagen. Dieselbe Trennung macht die
harte Summenregel aus `CONTEXT.md` prüfbar — die Summe über alle `Pool`s ist der
`PrizePool`, exakt, immer —, weil der Kern ohne Browser importierbar ist.

Nachtrag: **Die Signatur oben ist einstellig zu lesen.** Der Kopf dieses ADR
schreibt `distribute(prizePool, settings)`; beim Ausformulieren der Spec fiel
auf, dass zwei Argumente genau das wieder ausdrückbar machen, was
[Woraus entsteht der verfügbare Pool?](https://github.com/ditshej/tcg-prizing/issues/3)
abgeschafft hat — eine Bestandseingabe. Der `PrizePool` ist zu 100 % errechnet,
also fällt er aus den Settings und wird nicht neben sie gestellt: `distribute(settings)`
ruft `derivePool(settings)` selbst auf und legt das Ergebnis als `plan.pool` ab.
Die Fuge, für die die zwei Argumente gedacht waren, bleibt — die
`PreparationList` braucht die Pool-Hälfte allein und bekommt `derivePool` als
einzeln exportierte reine Funktion. Am Entscheid dieses ADR ändert das nichts:
es bleibt eine Naht, reine ES-Module ohne DOM-Berührung, geprüft mit Nodes
eingebautem Runner.

**Der Preis ist die Sprache.** Die Substanz dieses Projekts —
`DistributionCurve`, `RankFloor`, `ShapedRemainder`, `RankCycle`, die
Vorrangkette — steht in JavaScript, nicht in der Sprache, die der Maintainer am
besten liest. PHP bleibt das Zusammensetzen von Text. Das ist der bewusst
getragene Preis dafür, dass die Regler ohne Verzögerung antworten.

## Nachtrag (#62): die Schale bekommt einen zweiten, schmalen geprüften Rand

Spec 2 (#61) baut auf dieser Naht auf und braucht eine zweite, kleinere: die
Schale selbst rechnet zweierlei, und nur eines davon braucht ein DOM.

**Geprüft wird ab jetzt nicht mehr nur der Kern, sondern der Kern und die
reinen Ableitungen der Schale.** Für #62 sind das die Geometrie des
Kachelfensters — wie viele Kachelspalten eine gemessene Breite trägt — und der
gerechnete Deckel des Diagramms (`public/ui/geometry.mjs`, geprüft unter
`test/ui-geometry.test.mjs`). Spätere Tickets tragen hierher nach, was #61s
Testing Decisions zusätzlich als reine Ableitung ausweist — die Faltung in
voller Breite, die `PreparationList`-Zerlegung, `rafflePot`.

**Die Schale behält daneben einen ungeprüften Messrand**, bewusst dünn
gehalten: er liest `clientWidth`/`clientHeight` und vergleichbare Masse aus dem
DOM und schreibt CSS-Grössen, sonst nichts (`public/ui/measure.mjs`). Dieselbe
Bauart wie die Empfehlung, die dieses ADR oben für `readLocation`/
`writeLocation` (#47) skizziert: ein schmaler ungeprüfter Streifen, damit alles
darunter geprüft werden kann, statt dass Falt- und Deckel-Arithmetik ungeprüft
mitten im Renderer stünde.

**Das ist kein Stempel und kein ADR 0008** — dieselbe Präzedenz wie die
Nachträge in ADR 0003, ADR 0006, ADR 0007 und der Signatur-Nachtrag oben in
diesem Dokument: eine Naht, an derselben Stelle geschärft, bleibt dasselbe
Dokument.
