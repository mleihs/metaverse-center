# Auftrag an Claude Design — Kostenpanel „Kontor"

Entwirf ein Kosten- und Telemetriepanel für das Admin-Panel einer
Simulationsplattform. Es ist ein **Arbeitswerkzeug für genau eine Person** (die
Betreiberin), kein Verkaufsbild. Dichte ist erwünscht, Schmuck nicht — mit
einer Ausnahme, die weiter unten steht.

Alle Zahlen in diesem Auftrag sind auf Produktion gemessen, nicht erfunden.

---

## 1. DIE HARTE RANDBEDINGUNG: ZWEI SKINS

Das Panel muss in **beiden** Skins funktionieren. Das ist keine Kür.

    DUNKEL   Seite #0a0a0a · Fläche #171717 · Text #e5e5e5 · Akzent Bernstein
    ATLAS    Seite #e9ede9 · raised #dfe5e0 · sunken #d5dcd6 · Tinte #17201d

**Der Skin hat DREI Gründe, nicht einen.** Ein Wert, der auf `page` besteht,
kann auf `sunken` durchfallen — das ist uns schon zweimal passiert.

**Regel, die aus Grafanas Quellcode belegt ist:**

    Füllungen        EIN Wert  — eine Fläche wird gesehen, nicht gelesen (3:1 reicht)
    Texte, Icons     ZWEI Werte — auf jedem der drei Gründe einzeln gemessen
    Gegenblöcke      ZWEI Werte

Grafana führt vier Werte je Farbton (`darkMain`, `darkText`, `lightMain`,
`lightText`). Bei Orange sind `darkMain` und `lightMain` **derselbe Wert**; nur
die Textvariante spaltet sich. **Zehn von zehn Kreuzproben zwischen hellen und
dunklen Texttönen fallen durch.** Es gibt keinen Textton, der beide Gründe
trägt.

Unser Bernstein `#f59e0b`: **9,22:1 auf Dunkel, 1,82:1 auf Papier, 1,54:1 auf
sunken.** Faktor 5,1.

⚠ **Kein einziger roher Hex-Wert im Entwurf.** Jede Farbe läuft über ein
benanntes Token. Sag zu jedem Token, welche Rolle es hat und ob es einen oder
zwei Werte braucht.

---

## 2. DIE DATEN — gemessen, 05.09.2026

    Zeitraum      05.04. – 05.09.2026 (5 Monate)
    Zeilen        1 510
    Gesamt        11,87 USD
      Bild        10,58 USD  (Replicate)   89,1 %
      Text         1,29 USD  (OpenRouter)  10,9 %
    Welten        21
    Modelle       10
    Zwecke        21
    Ausgang       1 509 ok · 1 Fehler

**Die wichtigste Eigenschaft der Daten — vier Größenordnungen mit einer echten
Lücke dazwischen:**

    0,000012 – 0,005 USD   1 222 Zeilen   Text
    0,005    – 0,025 USD       0 Zeilen   ← LEER
    0,004    – 0,073 USD     316 Zeilen   Bild

**Zwischen 0,005 und 0,025 USD liegt keine einzige Zeile.** Ein linearer Balken
zeigt 1 222 Zeilen als Strich am Nullpunkt. Der Achsenbruch ist hier kein
Gestaltungsmittel, sondern die Form der Daten.

**Die Bildmodelle, echte Werte:**

    flux-2-pro    254×  7,87 USD  ⌀ 3,1 ¢   11 Welten
    flux-2-max     22×  1,61 USD  ⌀ 7,3 ¢    1 Welt, ein einziger Tag
    image-model    22×  0,68 USD  ⌀ 3,1 ¢   13 Welten   ← ein Platzhaltername!
    flux-dev       14×  0,35 USD  ⌀ 2,5 ¢    1 Welt
    juggernaut      2×  0,04 USD
    proteus         2×  0,04 USD

**Was die Achsen tragen — und was nicht:**

    Zeit · Anbieter · Modell · Zweck · Ausgang     vollständig
    Welt                                           1 308 / 1 510
    Gespräch                                       60 / 1 510  (ab jetzt vollständig)
    Figur                                          0           (ab jetzt vollständig)
    Schlüsselquelle                                1 510 „platform" — BYOK nie benutzt
    Nutzer                                         0 / 1 510 — die Achse existiert nicht

⚠ **Zwei Achsen sind heute leer und werden es eine Weile bleiben.** Der Entwurf
muss zeigen, wie eine leere Achse aussieht, ohne wie ein Fehler zu wirken.

---

## 3. DER AUFBAU — fünf Ebenen, in dieser Reihenfolge

Bei praktisch allen untersuchten Vorbildern dieselbe Folge. Übernimm sie.

    1  Kopfkacheln            2–6, keine Achsen
    2  EIN Hauptdiagramm      die Summe über Zeit, gestapelt nach EINER Achse
    3  Aufschlüsselungen      mehrere kleine Listen nebeneinander, je eine Achse
    4  Tabelle(n)             die Gruppen als Zeilen, sortierbar
    5  Einzelaufruf           nur über Klick

**Die Übersicht endet bei Ebene 3.** Ab Ebene 4 wird gearbeitet, nicht
überblickt.

**Linear koppelt Chart und Tabelle fest** — unter *jedem* Graphen steht die
Tabelle, sie ist kein eigener Abschnitt. Übernimm das.

---

## 4. DIE KACHELN — höchstens sechs

Belegte Anzahlen: Railway 2 · GCP 2 · AWS 3 · Datadog 4 · Helicone 4 · Portkey 6.

**Nimm Railways Muster:** das Wertpaar **Ist / Hochrechnung** direkt
nebeneinander, ohne Delta, ohne Sparkline, ohne Pfeil. Nur absolute Beträge.
Für ein Kostenprodukt bemerkenswert sparsam — und richtig.

**Nimm Stripes Muster dazu:** die Kachel ist ein **Selektor**, keine Vorschau.
Klick macht sie zur Datenquelle des Diagramms darunter. Kachel und Diagramm
sind **ein** Bedienelement.

**Was NICHT in die Kacheln gehört:** Fehlerrate (ohne Zeitverlauf wertlos) ·
Perzentile (bekommen ein eigenes Panel) · alles, was erst nach Setzen eines
Filters bedeutet, was es sagt.

⚠ **Die Farbsemantik ist bei Kosten invertiert.** Steigende Kosten sind
schlecht. Grafana und Datadog haben dafür einen expliziten Schalter. **Ohne ihn
ist jede Delta-Anzeige farblich falsch.** Zeig im Entwurf, wie ein „+12 %" bei
Kosten aussieht.

---

## 5. TYPOGRAFIE — die Zahlen sind der Inhalt

    Zeilenhöhe      min-height 28–32 px, NIE height
    Polsterung      6 px vertikal / 8–12 px horizontal
    Zahlen          12–13 px
    Kopfzeile       11 px  (kleinste branchenweit in Daten eingesetzte Größe)
    Zeilenabstand   1.3    (Zeds „standard", der richtige Pol für Zahlenraster)

**Dichte kommt aus vertikalem Raum, NICHT aus kleinerer Schrift.** Fünf von
sieben untersuchten Systemen halten die Schriftgröße über alle Dichtestufen
konstant (Carbon 14 px über fünf Stufen, Ant über drei). Rello 2013:
Schriftgröße signifikant, Zeilenabstand 0,8–1,8 ohne messbaren Effekt.

**Feste Regeln:**

- `font-variant-numeric: tabular-nums` auf **jede** Zahlenzelle — auch Datum und
  Uhrzeit. Ohne sie driften 7 Ziffern um 25,4 px.
- **Mono für Zahlen, IDs, Modell-Slugs. Sans für alles Erklärende.** Nie beides
  im selben Absatz. Ein komplett in Mono gesetztes Panel ist ein Kostüm.
- **U+2212 MINUS SIGN, nie der Bindestrich.**
- Beträge rechtsbündig, Modellnamen und Zeit linksbündig, **nie zentriert**.
- Zeilentrenner als `box-shadow: inset 0 1px`, nicht `border` — belegt keinen
  Platz, keine Doppellinien, keine Sticky-Header-Sprünge.
- Row-Hover **unter 1,15:1**. Knöpfe dürfen mehr.
- **Keine Zebrastreifen.** Keines der sechs untersuchten Produkte hat welche.
- Verschachtelung: **genau eine Ebene.**

**Rundung nach Größenordnung:**

    0,000012  →  $0.000012
    0,0003    →  $0.00030
    0,003     →  $0.0030
    0,12      →  $0.12
    7,87      →  $7.87
    1510      →  1,510      (Zähler sind ganzzahlig, nie mit Nachkommastellen)

**Nie auf 0 runden.** Notfalls `<$0.0001` statt `$0.0000`.

⚠ **Der ungelöste Konflikt, für den es keinen Branchenstandard gibt:** vier
Größenordnungen in einer Spalte. Adaptive Präzision variiert die Zeichenzahl,
die Spalte franst rechts aus. Grafana löst es, indem die Breite am längsten
Wert der Spalte reserviert wird — dann stehen die Dezimalpunkte *nicht*
untereinander, aber die Spaltenkante ist ruhig. **Entscheide dich und zeig die
Entscheidung.**

---

## 6. DER ZUSTANDSRAUM EINER ZELLE — hier ist der Stand der Technik leer

**Das ist die Stelle, an der dieses Panel besser sein kann als alles, was es
gibt.**

Kein Design-System (Carbon, Polaris, Material, Atlassian) hat eine Regel zu
leerer Zelle gegen Null. Die Regel existiert nur in der amtlichen Statistik.
Die UK Government Analysis Function schreibt vor:

    [x]    nicht verfügbar
    [z]    nicht anwendbar
    [low]  „a low figure but not a real zero"   ← den kennt Software nie
    [e]    geschätzt
    [f]    Hochrechnung
    [p]    vorläufig

Kernregel wörtlich: **„A zero or '0' should only be used when a data point is a
true zero."**

Und: **das Kürzel hängt an der ZELLE, nicht an der Spalte.** Eine Tabelle darf
geschätzte und abgerechnete Zeilen mischen. Die Legende steht **über** der
Tabelle, nicht darunter.

**Bei uns ist das unmittelbar:** ein Aufruf für 0,000012 USD zeigt bei zwei
Nachkommastellen „0,00" und ist damit optisch nicht von „nichts gekostet" und
nicht von „nicht erfasst" zu unterscheiden.

**Entwirf sechs Zellzustände, typografisch unterscheidbar, alle gleich breit:**

    $0.0030      ein gemessener Wert
    $0.00        eine ECHTE Null
    ~$0.0030     geschätzt (aus Tokenzählung, nicht vom Anbieter bestätigt)
    ·            unter der Anzeigegenauigkeit, aber größer als null
    —            nicht anwendbar (Geviertstrich, nicht „N/A", nicht leer)
    ░            kein Wert erfasst

**Datadog ist das einzige Produkt mit Abzeichen dafür** — `PARTIAL COST` und
`COST UNAVAILABLE`. Drei Zustände pro Zelle statt einer Fußnote. Wir hätten
sechs.

⚠ **Trag den Unterschied über Helligkeit und Zeichen, NIE über Farbe allein.**
`#ef4444` gegen `#22c55e` fällt unter Deuteranopie von ΔE 127 auf 12.

**Und die zweite Leerstelle:** kein einziges Werkzeug weist die Zählbasis eines
Mittelwerts aus. **„Ø 0,004 USD (n = 42 von 50)"** wäre ungewöhnlich ehrlich.
Bau das ein.

---

## 7. DIAGRAMME

**Genau vier, nicht mehr:**

1. **Kosten über Zeit**, gestapelt nach Anbieter (zwei Kategorien, also gut
   vergleichbar — bei mehr als zwei hätte nur die unterste eine echte Nulllinie)
2. **Ein waagerechter 100-Prozent-Balken** Bild gegen Text, volle Panelbreite,
   Beschriftung IM Balken. **Kein Kreisdiagramm** — Winkelwahrnehmung versagt
   bei 89/11.
3. **Eine Matrix** Welten × Modelle, je Zelle eine Sparkline. Dicht,
   tabellarisch und grafisch zugleich.
4. **Eine Kalender-Heatmap** — die einzige Form, in der fünf Monate auf einen
   Schirm passen. Zeigt Rhythmus, nicht Betragshöhe.

**Ausdrücklich NICHT:** Sunburst · themeRiver · Kreisdiagramm · Treemap ·
Sankey (außer an genau einer Stelle: Schlüsselquelle → Anbieter → Betrag, vier
Knoten) · Log-Skala.

Zur Treemap der Negativbefund, der zählt: **Vantage**, der Spezialist für Cost
Reports, dokumentiert Balken, Linien, Flächen und Kreis — **weder Treemap noch
Sankey**. Bundeshaushalt.de, der Lehrbuchfall für einen Ausgaben-Sankey, benutzt
isolierte Einzelbalken. Drei unabhängige Akteure, die die Zeichnung bauen
könnten, bauen sie nicht.

**Balken in Zellen:** `border-radius: 0`, kein T-Kopf, kein Verlauf. Schon das
Abrunden der Spitze erhöht den Ablesefehler von MLAE 1,43 auf 1,86 (p < 0,001).
Und: **die Skala beginnt bei Null**, sonst ist die Balkenlänge kein Verhältnis
mehr.

**Sparklines:** 20–26 px hoch, Endpunktmarker, **Nulllinie**, kein Rahmen,
**immer mit der Zahl daneben.** Unter 24 px steigt der Ablesefehler linear
(R² = 0,986).

**Fews Test für jede Zelle:** Deckt man die Zahl daneben ab — sagt das Bild dann
noch etwas? Wenn nein, gehört die Zahl allein hinein.

---

## 8. DIE HOCHRECHNUNG

**Rangfolge der Ehrlichkeit, aus den Belegen:**

1. **Keine Daten → keine Prognose.** AWS wörtlich: *„If AWS doesn't have enough
   data to forecast an 80% prediction interval, Cost Explorer doesn't provide a
   forecast."*
2. **Farbe entziehen** (GCP: „light gray"). Ein aufgehellter Balken in
   Serienfarbe liest sich noch als Messung; ein grauer nicht.
3. Schattierung.
4. Strichelung — die schwächste Markierung.
5. **Die Mittellinie weglassen.** Was nicht da ist, kann nicht abgelesen werden.

**Alle drei Hyperscaler zeigen die Prognose als ZAHL neben der Summe.** Das
Band ist Beiwerk.

⚠ **Strichelung wird für zwei Bedeutungen benutzt, und das ist eine Falle.**
Plausible trennt sauber: **Strichelung = Zeitraum unvollständig. Helligkeit =
andere Periode.** Halte dich daran.

---

## 9. FILTER UND ZEITRAUM

- Filterleiste **oben**, über dem Diagramm.
- Zeitraum ist **ein globales Bedienelement**, einmal gesetzt fürs ganze Panel.
- **Granularität wird abgeleitet, nicht angeboten.** 7 Tage → Stunde · 30 Tage →
  Tag · 90 Tage → Woche · 1 Jahr → Monat. Kein Nutzer stellt Auflösung ein.
- **Semi-relative Zeiträume** — fester Anfang, `now` als Ende, also `seit
  Monatsbeginn bis jetzt`. Grafana hat es, fast niemand kopiert es.
- Top-N: **Top 9 + „Sonstige"**, und **zwei getrennte Sammel-Label**:
  „Sonstige" (abgeschnittener Rest) gegen „ohne Angabe" (Eigenschaft fehlt).
  Das ist nicht dasselbe.
- **Fünf gleichrangige Ausgangs-Kategorien** statt ok/Fehler: durchgeführt ·
  gedrosselt · abgebrochen · fehlgeschlagen · aus dem Cache. Ein einzelner
  Fehlerbalken verschenkt die Diagnose.

---

## 10. WAS AUSDRÜCKLICH NICHT

- **Kein Bernstein auf Schwarz als Look.** Das war eine Phosphor-Notwendigkeit
  der Röhrenzeit, kein Designprinzip. Bernstein ist bei uns die **Trägerfarbe
  für Nicht-Semantisches**; Bedeutung trägt ein Farbpaar.
- **Kein Rot gegen Grün.** Der Helligkeitsabstand liegt bei allen geprüften
  Systemen zwischen 1,00 und 1,36:1 — in Graustufen identisch. Bloomberg nimmt
  **Blau statt Grün**, weil Blau ebenfalls als „auf" gelesen wird.
- **Keine Legende** an einem Diagramm, unter dem eine Tabelle steht. Die Tabelle
  IST die Legende.
- **Keine Achsenlinien, keine durchgezogenen Splitlines.** Gestrichelt und sehr
  dunkel. Die Vorgabe-Ränder sind der Hauptgrund, warum Vorgabe-Diagramme nach
  Vorgabe aussehen.
- **Kein Tachometer, keine Gauge-Ringe.** Few: *„A great deal of space is used
  by these gauges to tell us far too little."*
- **Keine Animation** außer beim Öffnen.
- **Kein `dataZoom`-Slider** (40 px grauer Streifen unter jedem Diagramm).
  Zoomen von innen.

---

## 11. WAS ZU ENTWERFEN IST

Ein zusammenhängendes Panel, in **beiden Skins**, als diese Artboards:

    Main            Das ganze Panel, dunkel, in Ruhe. 1440 × 1600.
    Atlas           Dasselbe Panel im hellen Skin. 1440 × 1600.
    Zellzustaende   Die sechs Zellzustände aus §6 nebeneinander, groß,
                    mit Legende darüber. 880 × 520.
    Kacheln         Die Kopfzeile allein, in beiden Skins untereinander,
                    inklusive invertierter Delta-Farbe. 880 × 560.
    Tabelle         Die Aufruftabelle allein: Spaltensatz, Sortierzustand,
                    Balken in der Zelle, aufgeklappte Zeile,
                    Sammelzeile „Sonstige" und „ohne Angabe". 1200 × 900.
    Achsenbruch     Das Kostendiagramm mit dem leeren Band zwischen 0,005 und
                    0,025 USD — einmal ohne Bruch (unlesbar) und einmal mit.
                    880 × 640.
    Leer            Wie eine leere Achse aussieht, ohne wie ein Fehler zu
                    wirken. Zwei Fälle: „BYOK nie benutzt" und „Nutzerachse
                    existiert nicht". 880 × 480.

**Für jedes Farbtoken sag dazu:** Rolle, ob ein oder zwei Werte, und den
gemessenen Kontrast auf allen drei Gründen des Skins, in dem es steht.
