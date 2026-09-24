# Der Gleichstand wird exakt verglichen, nicht in Fliesskomma

ADR 0001 (Nachtrag #45) legt fest, dass bei **gleichem Rest** der höhere `Rank`
den offenen `Booster` bekommt. Diese Regel ist mit `double`-Arithmetik nicht
umsetzbar: die Gleichstände sind in den geometrischen Gewichten der
`DistributionCurve` angelegt, aber die Gewichte sind Zweierpotenzen eines
Verhältnisses, und ihre Summe ist es nicht. `largestRemainder` vergleicht die
Reste darum als **exakte Brüche** — die `double`-Gewichte werden als dyadische
Brüche auf einen gemeinsamen Nenner gebracht und als `BigInt` verglichen —, nie
als Fliesskommazahlen.

## Warum, gemessen

Der Fall aus ADR 0001 Nachtrag #45: 8 `Player`, `RankPool` 14, `RankFloor` 2,
Tiefe 3, `extreme`. Sollanteile 5⅓ / 1⅓ / 0⅓, also drei **gleiche** Reste und ein
offener `Booster`, der nach der Regel an `Rank` 1 geht — Ergebnis `9·3·2`.

In `double` kommen die drei Reste so heraus:

```
Rank 1   0.33333333333333304
Rank 2   0.33333333333333326
Rank 3   0.3333333333333333
```

Drei verschiedene Zahlen, und nach Rest absteigend sortiert lauten sie
`Rank 3, Rank 2, Rank 1` — die **exakte Umkehrung** der Regel. Das Ergebnis ist
`8·3·3`.

Das ist der Punkt, auf den es ankommt: der naheliegende Code scheitert nicht
sichtbar. Die Tie-Break-Regel feuert nicht etwa nie, sie feuert zuverlässig
rückwärts, und die Summe stimmt dabei weiter. Eine Probe, die nur die
Summenregel prüft, sieht nichts. Nur eine ausgeschriebene Zahl fängt das — hier
war es das dritte Abnahmekriterium von #53.

## Consequences

- **Die Regel gilt für jede ganzzahlige Aufteilung im Kern**, nicht nur für die
  `DistributionCurve`. Wo künftig nach Anteilen ganzzahlig verteilt wird, läuft
  der Vergleich exakt. Ein Epsilon ist keine Lösung: die Abstände liegen hier in
  der Grössenordnung der Rundungsfehler selbst, eine Toleranz würde also entweder
  echte Unterschiede verschlucken oder die Gleichstände weiter verfehlen.
- **#58 („die Summenregel als Eigenschaft prüfen") darf ohne Toleranz prüfen** —
  und muss es, denn eine Toleranz hätte genau diesen Fehler durchgelassen.
- **Kosten: rund 12 µs je Aufruf bei 32 Rängen.** Für die einige hundert
  Durchläufe der Vorschlagssuche (#59) folgenlos. Sollte das je knapp werden,
  ist der Ausweg nicht Fliesskomma, sondern die Gewichte von vornherein als
  Brüche zu führen.
- **Die `DistributionCurve`-Verhältnisse bleiben `double`-Literale** (`0.45`,
  `0.25`, …). Sie sind die Eingabe, nicht der Vergleich; exakt gemacht wird
  erst der Rest.
