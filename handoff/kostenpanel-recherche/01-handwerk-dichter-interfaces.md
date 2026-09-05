---
title: "Handwerk dichter Daten-Interfaces — Regeln 1–20 mit Belegen"
date: "2026-09-05"
type: recherche
lang: de
---

# Handwerk dichter Daten-Interfaces

Recherche für das Kostenpanel. Jede Regel nennt ihren Beleg. Wo eine Zahl
unbelegt ist, steht es dabei.

## Regeln 1–15

**1. `font-variant-numeric: tabular-nums` auf jede Zahlenzelle — auch Datum und Uhrzeit.**
Ohne sie driften 7 Ziffern um 25,4 px (Geist Sans) bzw. 15,8 px (`system-ui`/SF Pro)
bei 13 px. *Messung an den Fontdateien; Sentry setzt es auch auf `FieldDateTime`.*

**2. Zahlenzelle als Block:** `text-align: right; tabular-nums; white-space: nowrap;
overflow: hidden; text-overflow: ellipsis`. Dezimalausrichtung per CSS existiert nicht —
`text-align: <string>` hat in MDN-BCD null Einträge. *Sentry `discover/styles.tsx`,
`NumberContainer`.*

**3. Beträge unter 1 $ mit adaptiver Präzision:** zwei signifikante Stellen, min. 2,
max. 10 Nachkommastellen. `0,003 → $0.0030`. *PostHog `numbers.ts`,
`significantDecimalPlaces`.*

**4. Wo die Einheit skalierbar ist, Einheit skalieren statt Stellen anhängen.**
„$0.20 / 1 Mio. Token" statt „$0.0000002 / Token". *OpenAI-Preisseite.*

**5. Spaltenbreite am längsten vorkommenden Wert festnageln, nicht am aktuellen.**
Grafana schaut bis zu 1000 Zeilen voraus. *Grafana `getAlignmentFactor`.*

**6. U+2212 MINUS SIGN, nie den Bindestrich.** Geist Sans: Bindestrich 419,
Minus 520, Plus 558 Einheiten/1000 em — 1,8 px Versatz bei 13 px. *Eigene Messung.*

**7. Zeilenhöhe 24–36 px, immer `min-height`, nie `height`.** Feste 24 px mit
12-px-Text beschneiden unter WCAG 1.4.12 (dann 26 px nötig). *Carbon;
WCAG 2.5.8/1.4.12; Stripe baut `min-height: 20px; margin: 8px`.*

**8. Zeilentrenner als `box-shadow: inset 0 1px`, nicht als `border`.** Belegt keinen
Platz im Box-Modell — Zeilenhöhe bleibt exakt, keine Doppellinien, keine
Sticky-Header-Sprünge. *Stripe-Dashboard-CSS.*

**9. Row-Hover unter 1,15:1; Knöpfe dürfen mehr.** Linear Zeile 1,024:1,
Knopf 1,099:1; Grafana 1,125:1. Dazu `@media (any-hover: hover)`,
`::after`-Opazität, ~160 ms. *Linear-CSS, Grafana `TableNG/styles.ts`.*

**10. Auf Dunkel nicht WCAG 4,5:1 führen, sondern APCA Lc 75 (Fließtext) /
Lc 60 (kleine Zahlen).** Unser `--color-text-secondary #a0a0a0` besteht WCAG AAA
(7,57:1) und erreicht nur **Lc 50,7**. *Messung mit `apca-w3@0.1.9`.*

**11. Eine Seite zurücknehmen — Grund anheben ODER Text absenken, nie beides auf
Anschlag.** `#fff` auf `#000` = Lc 107,9. Material hebt den Grund (`#121212`),
Vercel senkt den Text (`#ededed`). *Material-Codelab, Vercel-CSS.*

**12. Flächenleiter ~1,05–1,13:1 je Stufe, Gesamtspanne ≥ 1,35:1; jede Stufennummer
bekommt eine Funktion.** Sentry 1,39:1, Linear 1,36:1, Grafana 1,67:1 — **unser
`#060606 → #0a0a0a → #111111` nur 1,07:1.** Geist: 100–300 Fläche, 400–600 Rahmen,
900–1000 Text. *Eigene Messung; Geist-/Radix-Doku.*

**13. Trennlinien bei 1,3–1,6:1; wo eine Kante Bedeutung trägt, reicht
Flächenabstufung nie.** Materials Elevationsleiter 0→24dp spannt nur 1,62:1 und kann
3:1 aus SC 1.4.11 nie erfüllen. *Flutter `elevation_overlay.dart`.*

**14. Vorzeichen/Glyphe trägt, Helligkeit ist zweiter, Farbe dritter Träger.**
`#ef4444` gegen `#22c55e`: ΔE fällt unter Deuteranopie von **127 auf 12**.
*Eigene Machado-Simulation.*

**15. Sparkline nur bei 20–26 px Höhe, mit Endpunktmarker, mit Nulllinie, ohne
Rahmen, immer mit der Zahl daneben.** Unter 24 px steigt der Ablesefehler linear,
R² = 0,986, −4,1 Einheiten je Halbierung. *Heer/Kong/Agrawala CHI 2009;
Grafana `SparklineCell.tsx` (`height: 25`).*

## Regeln 16–20

**16. Balken in Zellen ohne `border-radius`, ohne T-Kopf, ohne Verlauf.** Schon das
Abrunden der Spitze erhöht den Ablesefehler von MLAE 1,43 auf 1,86 (p < 0,001);
keine der sieben getesteten Verzierungen schlug den nackten Balken.
*Skau/Harrison/Kosara, EuroVis 2015, 103 Teilnehmende, Bonferroni α = 0,0083.*

Vollständig: Basis 1,43 · extended 1,59 (n.s.) · capped 1,70 (p = 0,0013) ·
überlappend 1,82 · Dreieck 1,85 · **abgerundet 1,86** · quadratisch skaliert 2,33.

**17. Die Frage ist nicht „Schmuck ja/nein", sondern „kodiert es Daten".** Nur die
„superfluous"-Bedingung war signifikant langsamer (F[4,49] = 20, p < 0,05);
datenkodierende Piktogramme kosteten nichts. *Haroz/Kosara/Franconeri, CHI 2015,
50 Personen, 200 Durchgänge.* Ein Balken in der Zelle kodiert. Ein Icon neben dem
Modellnamen kodiert nicht.

**18. Beim Verdichten zuerst den Zeilenabstand nehmen, nie die Schriftgröße.**
Rello 2013: Schriftgröße signifikant, Zeilenabstand (0,8–1,8) ohne messbaren Effekt.
Carbon hält **14 px über alle fünf Dichtestufen**, Ant über alle drei — im Quellcode
nachweisbar (`cellFontSize`, `cellFontSizeMD`, `cellFontSizeSM` zeigen alle drei auf
denselben Token). Fünf von sieben Systemen tun das; nur Adobe Spectrum skaliert mit.
*DOI 10.1145/2461121.2461125. Einschränkung: dyslexische Stichprobe, Fließtext.*

**19. Eine Trägerfarbe für alles Nicht-Semantische, ein Farbpaar für Bedeutung —
und das Paar umschaltbar.** Bloombergs Bernstein trägt, Rot/Grün bedeutet; für die
geschätzt 20.000 farbfehlsichtigen Nutzer gibt es Blau/Rot, weil **Blau ebenfalls
als „auf" gelesen wird**. Laborstudie mit Ishihara-Vortest, lineare gemischte
Modelle. *Bloomberg, „Designing the Terminal for Color Accessibility" (Webarchiv).*

**20. Farbtokens nach ROLLE aufspalten, nicht nach Farbton: Füllungen einmal,
Texte pro Skin.** Grafana führt vier Werte je Ton (`darkMain`, `darkText`,
`lightMain`, `lightText`); Orange-`main` ist in beiden Skins `#ff9900`, die
Textvariante nicht. **Alle zehn Kreuzproben zwischen hellen und dunklen Texttönen
fallen durch** (dunkle Texttöne auf Papier 1,59–2,61:1; helle auf Dunkel 2,62–3,72:1).
*Grafana `palette.ts`.*

Regel daraus: **Füllungen dürfen einen Wert haben** (eine Fläche wird gesehen, nicht
gelesen — 3:1 reicht). **Texte, Icons und alles auf einem Gegenblock brauchen zwei.**

## Maßzahlen mit Status

### Zeilenhöhen — alle belegt aus Quellcode/Doku

| System | Werte |
|---|---|
| Carbon | xs **24** · sm **32** · md **40** · lg **48** · xl **64** px |
| Grafana | Standard **34** (= 6×2 Polster + 14 × 1,571) · Sm 36 · Md 42 · Lg 48 · Kopf **34** |
| Stripe | **36** (`min-height: 20px` + `margin: 8px`) · small **24** (16 + 4) |
| Linear | **24** und **28** dominieren (53× / 31× im CSS), Kopf 44 |
| Retool | X-Small **20** · Small 32 · Medium 48 · Large 60 |
| MDC Web | Zeile **52** · Kopf **56** · Minimum **36** |
| Pencil & Paper | 40 / 48 / 56 |
| Sentry (Controls) | xs 28 · sm 32 · md 40 |
| Polaris | keine feste Zeilenhöhe — ergibt sich aus Inhalt + 2×6 px |
| Atlassian, Primer, Spectrum | **unbelegt** — nicht veröffentlicht |

⚠ Retools X-Small (20 px) unterschreitet WCAG 2.5.8 und überlebt den 1.4.12-Test
nicht (14 px × 1,5 = 21 px reine Zeilenbox).

### Zellpolsterung — belegt

- **Salesforce Lightning: 4 px vertikal / 8 px horizontal**, Kopfzelle 32 px —
  dichtester belegter Wert. `white-space: nowrap` als Grundregel, `.slds-cell-wrap`
  als Opt-in.
- **Polaris IndexTable: 6 px** allseitig, erste/letzte Zelle außen 12 px, Kopf 6/8 px
- **Carbon:** xs 2 px vertikal, sm/md 7/6 px, xl 16 px — horizontal **durchgehend
  16 px über alle Stufen**
- **Grafana:** `CELL_PADDING: 6` · `LINE_HEIGHT: 22` · `MAX_CELL_HEIGHT: 48` ·
  `BORDER_RIGHT: 1`
- **Ant Design:** vertikal 8 / 12 / 16, horizontal 8 / 8 / 16 (small/middle/large)

### Schriftgrößen — belegt

- **Sentry:** 11 · 12 · 14 · 16 · 20 · 24 · 32 · 40 px; Zeilenhöhen 1 / 1,2 / 1,4;
  Mono-Regular 425
- **Grafana:** Basis 14, `bodySmall` 12 / 1,5; `htmlFontSize: 14`
- **Carbon:** 14 px konstant über alle fünf Dichtestufen (Kopf 600, Zeile 400)
- **Linear:** Basis 13 px, Gewichte 510 / 590 / 680, Laufweite bei 12 px auf 0
- **Stripe:** 13–14 px, Kopfzelle 11 px
- **Kleinste branchenweit in Daten eingesetzte Größe: 11 px.**
  ⚠ Unser `--text-xs` = **10,24 px** liegt darunter.

### Spalten, Raster, Zeilenabstand

- **Grafana Spalten:** `DEFAULT_WIDTH 150` · `MIN_WIDTH 50` · `MAX_AUTO_WIDTH 400` ·
  `EXPANDER_WIDTH 50`
- **Raster:** Linear 4 px (+2 px fein) · Vercel 4 · Sentry 4 · **Grafana 8** ·
  Stripe 4, aber absichtlich unvollständig (0·2·4·8·12·16·20·24·32·48·64·80 — kein 6,
  kein 40, kein 56). Unser Projekt: 4 px.
- **Zeilenabstand:** Butterick 120–145 % · WCAG 1.4.12 muss 1,5 aushalten ·
  WCAG 1.4.8 (AAA) ≤ 80 Zeichen Zeilenlänge

### Kontrast, unser Projekt — eigene Messung

| Token | WCAG | APCA |
|---|---|---|
| `#e5e5e5` | 15,72:1 | Lc 90,9 ✓ |
| `#a0a0a0` | 7,57:1 (AAA!) | **Lc 50,7** ✗ |
| `#888888` | 5,58:1 | **Lc 38,5** ✗ |
| `#f59e0b` | 9,22:1 | Lc 60,3 |
| `#ef4444` | 5,26:1 | **Lc 37,7** ✗ |
| `#333333` Rahmen | 1,57:1 | — |

Zielwerte auf `#0a0a0a`: Lc 60 → `#b2b2b2` · Lc 75 → `#cccccc` · Lc 90 → `#e4e4e4`.

**Bernstein `#f59e0b` über beide Skins:** 9,22:1 auf Dunkel · **1,82:1 auf Papier** ·
**1,54:1 auf gesenkter Papierauflage**. Faktor 5,1 zwischen den Gründen.

## Zahlenformatierung

**Ziffern.** `tabular-nums` global auf der Tabelle. In Monospace ein No-op (Ziffern
schon 600/1000 em). Bei Inter über Google Fonts/Fontsource fehlt `zero` (geschlitzte
Null), nur der Selbstauslieferung liegt sie bei. **Courier New hat eine leere Null und
nur 0,571 em Versalhöhe — für Zahlen die schlechteste Wahl im Feld.**

**Ausrichtung.** Beträge, Mengen, Prozente rechtsbündig. Datum, IDs, Modellnamen
linksbündig. Nie zentriert. Kopfzeile richtet sich nach dem Spalteninhalt.

**Rundung nach Größenordnung** — PostHog-Regel `min(max(2, 1 − ⌊log₁₀|v|⌋), 10)`:

| Wert | Anzeige |
|---|---|
| 0,0003 | `$0.00030` |
| 0,003 | `$0.0030` |
| 0,12 | `$0.12` |
| 7,87 | `$7.87` |
| 1234,5 | `$1,234.50` |
| 1510 Aufrufe | `1,510` — Zähler sind ganzzahlig, nie mit Nachkommastellen |

**Sehr kleine Beträge**, in dieser Rangfolge: (1) Einheit skalieren, (2) adaptive
Präzision, (3) **nie auf 0 runden** — notfalls `<$0.0001` statt `$0.0000`.

### Gemischte Größenordnungen in einer Spalte — ungelöst

**Kein belegter Branchenstandard gefunden.** Nur die Bausteine:

- Adaptive Präzision variiert die Zeichenzahl (`$0.00030` = 8, `$7.87` = 5) — ohne
  Gegenmaßnahme franst die Spalte rechts aus.
- Grafanas `getAlignmentFactor` löst genau das: Breite am längsten Wert reservieren,
  dann rechtsbündig. Dezimalpunkte stehen dann *nicht* untereinander, aber die
  Spaltenkante ist ruhig.
- Fews Befund zur geteilten Skala gilt analog: eine Spalte kann Größenordnung **oder**
  Feinauflösung ehrlich zeigen, nicht beides — und die Entscheidung ist für den Leser
  unsichtbar.

**Empfehlung (Meinung, nicht belegt):** Bei Spannen über drei Größenordnungen die
Spalte teilen, oder feste 2 Nachkommastellen und Kleinstwerte als eigene Zeilengruppe
mit eigener Einheit. Adaptive Präzision *innerhalb* einer Spalte ist nur sauber, wenn
die Werte nicht direkt verglichen werden sollen.

## Zustandsraum einer Zelle — Lücke

**Keine belastbare Quelle gefunden.** Kein untersuchtes Design-System dokumentiert
leer / null / nicht anwendbar / geschätzt / unvollständig. Was es gibt:

- *belegt* Grafana rendert `null` als `'-'` (`compactNumber`), unterscheidet aber
  **nicht** zwischen „kein Wert" und „Wert = 0".
- *belegt* Sentrys `NumberContainer` kürzt mit `ellipsis` — der einzige typografisch
  kodierte Zustand ist „abgeschnitten".
- *belegt* Die CSS-Text-4-Beispieltabelle zeigt `N/A` als Literal.
- *belegt* Vercel Geist Table: fehlende Werte als **Geviertstrich `—`**, nicht „N/A",
  nicht leer.

**Vorschlag, kein Befund:** Unterschied über Helligkeitsstufe plus Zeichen tragen, nie
über Farbe allein (Regel 14), Spaltenbreite nicht verändern. Etwa `0.00` normal ·
`—` in `text-muted` für „nicht anwendbar" · `·` für „leer" · `~` vorangestellt für
„geschätzt" · Fußnotenzeichen für „unvollständig".

## Hierarchie und Gruppierung

**Belegt:**

- **Trennlinien:** maximal 1 px, hell. Kontrast 1,3–1,6:1 gegen die Fläche
  (Sentry 1,39:1, PostHog 1,38:1, Linear 1,30:1). Als `inset box-shadow`, nicht
  `border`. Kein `border-collapse`.
- **Weniger Trenner ist die Bewegungsrichtung** — Linears Redesign nennt ausdrücklich
  „fewer separators".
- **Kopfzeile:** Grafana 34 px (gleich hoch wie die Zeile), Linear 44 px, Carbon 14 px
  in Gewicht 600. Sticky ist Standard; Stripes schattenbasierte Trenner verhindern die
  1-px-Sprünge.
- **Klebende Spalten:** Grafana reserviert `SCROLL_BAR_WIDTH 8`,
  `SCROLLBAR_AFFORDANCE 16`.
- **Verschachtelung: genau EINE Ebene** — Grafana (`NESTED_NO_DATA_HEIGHT: 60`),
  Carbon (expandable row). Mehr ist in keinem System dokumentiert.
- **Auswahl:** Linear leitet bei Zeilenauswahl **das gesamte Theme** mit dem
  Auswahlgrund als neuer Basis neu ab, statt ein Highlight zu überlagern — dadurch
  bleibt der Kontrast in jeder Zeile garantiert.

**Unbelegt:** Zebrastreifen gegen Trennlinien — keine Studie, keine
Design-System-Aussage gefunden. Beobachtung ohne Beleg: **keines der sechs
untersuchten Produkte** (Linear, Stripe, Vercel, Grafana, Sentry, PostHog) verwendet
Zebrastreifen.

## Fitts, und warum Dichte billiger ist als gedacht

ID = log₂(D/W + 1). Weil D/W im Logarithmus steht, verdoppelt eine Halbierung der
Zeilenhöhe von 48 auf 24 px die Zielzeit **nicht** — sie erhöht ID um etwa 1 Bit. Der
Bruch kommt nicht aus der Zeit, sondern aus der **Fehlerrate**. Und in einer Tabelle
ist ein Fehlklick nicht ein verfehlter Knopf, sondern **der falsche Datensatz**.

## Die Dichte-Debatte, aufgelöst

**Borkin et al. 2013** (2.070 Visualisierungen, 410 Zielbilder, 261 Teilnehmende):
data-ink-ratio „bad" M = 1,81 gegen „good" M = 1,23; t(208) = 6,92; p < 0,001.
Visuelle Dichte hoch M = 1,83 gegen niedrig M = 1,28; t(115) = 6,08; p < 0,001. Die
Autoren schreiben selbst, das **widerlege ihre Hypothesen vier und fünf** („weniger
Dichte = merkbarer", „minimalistisch = merkbarer").

⚠ Ihre eigene Einschränkung, die fast immer unterschlagen wird: gemessen wurde
**Szenen-Wiedererkennung, nicht Verständnis** — *„Nor does excessive visual clutter
aid comprehension."*

**Stephen Fews methodische Gegenrede** trifft genau unseren Fall: Batemans
Testdiagramme haben je *eine* Aussage und wenige Werte, die Werte sind
*„incidental to its purpose"*. Ein Kostenpanel ist die Gegenlage.

## Empfehlung, verdichtet

1. **Schriftwahl:** Wenn Schreibmaschinensatz, dann **nicht** Courier New —
   Menlo / SF Mono / JetBrains Mono / IBM Plex Mono (alle ~0,70–0,73 em Versalhöhe,
   markierte Null). Alternativ Textschrift mit `tnum`, wie alle sechs Vorbilder.
2. **Satz:** 12–13 px Zahlen, 11 px Kopfzeile, Zeile `min-height: 28–32 px`,
   Polsterung 6 px vertikal / 8–12 px horizontal.
3. **Zuerst die Farbtokens reparieren**, bevor gestaltet wird: `text-secondary`,
   `text-muted` und `danger` sind auf `#0a0a0a` perzeptuell zu schwach
   (Lc 50,7 / 38,5 / 37,7). Ohne das nützt kein Satz.
4. **Flächenleiter nach oben ausbauen** — 1,07:1 gibt einem Panel keine Tiefe.
5. **Beim Verdichten den Zeilenabstand nehmen, nicht die Schrift.**

## Was nicht belegbar war

Gillan & Richman 1994 im Volltext (nur sekundär über Bateman) · Inbars Einzel-p-Werte ·
Bloomberg-Schriftart · **Height** (nichts, zu keinem Aspekt) · Adobe-Spectrum-px-Werte ·
Primer-px-Werte · Atlassian-Zeilenhöhen · **Material Design 3 Data-Table existiert
offenbar nicht** (die Zahlen 52/56/36 stammen aus MDC Web) · Apple 44 × 44 pt
(WCAG 2.5.5 nennt 44 px, aber Level AAA).

**Superhuman dokumentiert Latenz, nicht Dichte** — 100 ms Wahrnehmungsschwelle,
Ziel < 50 ms, Renderer < 32 ms. Übertragbar ist nur die Messmethode: *Anteil der
Ereignisse unter Zielwert* statt 90. Perzentil. Wer Superhuman als Dichte-Referenz
zitiert, zitiert eine Geschwindigkeitsquelle.

**Neu belegt:** Linear lädt InterVariable selbst gehostet vor und generiert über
hundert Farbvariablen im LCH-Raum aus drei Eingaben.
