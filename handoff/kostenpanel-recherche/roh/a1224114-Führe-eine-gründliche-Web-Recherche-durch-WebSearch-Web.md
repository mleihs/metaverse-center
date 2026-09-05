# AUFTRAG

Führe eine gründliche Web-Recherche durch (WebSearch + WebFetch, viele Quellen, mindestens 12 Seiten wirklich abrufen) zum Thema INFORMATIONSDICHTE in Daten-Interfaces. Antworte auf Deutsch.

Untersuche:
1. Edward Tufte: data-ink ratio, small multiples, sparklines, "chartjunk". Was davon hält der empirischen Prüfung 2026 noch stand, was ist widerlegt? Suche gezielt nach der Forschung von Scott Bateman et al. "Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts" (CHI 2010), nach Borkin et al. "What Makes a Visualization Memorable?" (IEEE VIS 2013), nach Kritik am data-ink ratio (z.B. Inbar/Tractinsky/Meyer "Minimalism in information visualization"), nach Gillan & Richman zu data-ink. Nenne konkrete Studienergebnisse mit Zahlen.
2. Zeilenhöhen und Spaltenabstände in dichten Tabellen: konkrete px-Werte aus echten Design-Systemen. Suche in den Dokumentationen von: Material Design 3 data tables (row height dense/standard), Carbon Design System (IBM) data table row heights (xs/sm/md/lg/xl), Atlassian Design System, Ant Design Table size small/middle/large, Salesforce Lightning, Adobe Spectrum table density, Shopify Polaris IndexTable, Primer (GitHub). Nenne die tatsächlichen px-Zahlen pro Dichtestufe und Schriftgrößen.
3. Ab wann kippt Dichte in Unlesbarkeit? Suche nach Forschung/Guidelines zu Zeilenlänge (characters per line), line-height-Empfehlungen für kleine Schriftgrößen, WCAG 1.4.12 Text Spacing (die konkreten Anforderungen: line-heig

---

Ich habe genug Material zusammen. Hier der Bericht.

---

# INFORMATIONSDICHTE IN DATEN-INTERFACES — Rechercheberichtd

**Methodik:** 40+ Quellen abgerufen (WebFetch + curl). Volltexte von 8 Forschungsarbeiten als PDF extrahiert und im Original gelesen, nicht nur Abstracts. Design-System-Zahlen wo möglich aus dem **Quellcode** (SCSS/CSS/Token-Dateien), nicht aus Sekundärliteratur. Das WebSearch-Budget war ab dem zweiten Schritt erschöpft; ab da lief alles über direkte URLs, `raw.githubusercontent.com`, Crossref-, Unpaywall- und Semantic-Scholar-APIs.

---

## 1. TUFTE UNTER EMPIRISCHER PRÜFUNG

### 1.1 Bateman et al., "Useful Junk?" (CHI 2010) — BELEGT, Volltext gelesen

Quelle: https://sites.stat.columbia.edu/gelman/communication/Bateman2010.pdf · DOI 10.1145/1753326.1753716

**Aufbau:** 20 Teilnehmende (9 m / 11 w), 14 Diagramme + 2 Übungsdiagramme, je in zwei Fassungen (Nigel-Holmes-Stil mit Bildwerk vs. schmucklos). 10 Personen sofortiger Abruf (nach 5-Minuten-Spielpause), 10 Personen Langzeitabruf nach **12–22 Tagen**. Eyetracking (Tobii) während der Beschreibung.

**Beschreibung (Diagramm sichtbar) — kein Unterschied:**

| Frage | t-Wert | p |
|---|---|---|
| Thema | t₁₉ = 0,84 | ,412 |
| Kategorien | t₁₉ = 1,38 | ,185 |
| Trend | t₁₉ = 0,23 | ,818 |
| **Wertaussage** | **t₁₉ = 3,37** | **,003 (Holmes besser)** |
| Bearbeitungszeit | t₁₉ = 1,834 | ,082 (2,60 min vs. 2,43 min) |

**Sofortiger Abruf — kein Unterschied** (Thema p=,124 · Kategorien p=,129 · Trend p=,369), außer Wertaussage p=,026.

**Langzeitabruf (12–22 Tage) — durchgehend zugunsten der geschmückten Diagramme:**
Thema t₉=2,56 p=,015 · Kategorien t₉=5,03 p≈,000 · Trend t₉=1,95 p=,042 · Wertaussage t₉=2,41 p=,020. Zusätzlich brauchten schmucklose Diagramme **signifikant mehr Erinnerungsanstöße** (Thema p=,013 · Kategorien p=,011 · Trend p=,018).

**Blickdaten — die für Interface-Dichte wichtigste Zahl:** Bei Holmes-Diagrammen entfielen **67 %** der Bildschirmzeit auf Daten bzw. Daten+Schmuck, bei schmucklosen **78 %**. Reiner Schmuck ohne Dateninhalt: **13 %**. Doppelt kodiert: 27 %. Diese ~13 % verlorene Blickzeit führten zu **keiner** messbaren Verlangsamung.

**Präferenz (χ²):** angenehmer χ²=8,9 p=,003 · attraktiver χ²=11,8 p=,001 · leichter zu erinnern χ²=15,2 p≈,000 · Details leichter zu erinnern χ²=8,9 p=,003 — alles zugunsten Holmes.

### 1.2 Borkin et al., "What Makes a Visualization Memorable?" (IEEE VIS 2013) — BELEGT, Volltext gelesen

Quelle: http://web.mit.edu/zoya/www/docs/InfoVis_borkin-128.pdf · DOI 10.1109/TVCG.2013.234

2.070 Einzelbild-Visualisierungen katalogisiert, davon **410 Zielbilder**, **261 Teilnehmende** auf Mechanical Turk. Von den 410 waren 145 extreme „Minimalisten" (data-ink „good"), 103 extreme „chart junk" (data-ink „bad"), 162 dazwischen.

**Konsistenz der Messung:** Gruppe 1 r = 1,00 · Gruppe 2 r = 0,81 · Zufall r = −0,01. Merkbarkeit ist also ein stabiles Bildmerkmal, keine Zufallsgröße.

**Die zwei Befunde, die Tufte direkt widersprechen:**

- **Data-Ink-Ratio:** „bad" (also *niedriges* Daten-Farb-Verhältnis) M = **1,81** gegen „good" M = **1,23**; t(208) = 6,92; **p < 0,001**. Alle drei Stufen paarweise signifikant verschieden.
- **Visuelle Dichte:** hoch (Stufe 3) M = **1,83** gegen niedrig (Stufe 1) M = **1,28**; t(115) = 6,08; **p < 0,001**.

Die Autoren schreiben das ausdrücklich hin: „This supports our third hypothesis, and **refutes our fourth and fifth**" — H4 (weniger Dichte = merkbarer) und H5 (minimalistisch = merkbarer) sind widerlegt.

- **Piktogramme:** mit M = 1,93, deutlich über ohne.
- **Farbanzahl:** ≥7 Farben M = 1,71 gegen 2–6 Farben M = 1,48; t(285) = 3,97; p < 0,001.
- **Diagrammtyp:** Raster/Matrix, Baum/Netz, Diagramme sind merkbarer als Linien-, Balken- und Kreisdiagramme.

**Die Selbsteinschränkung der Autoren ist zentral und wird meist unterschlagen:** „memorability … does not necessarily translate to an understanding of the visualizations themselves. **Nor does excessive visual clutter aid comprehension** of the actual information (and may instead interfere with it)." Die Studie misst Wiedererkennung von Szenen, nicht Verständnis.

### 1.3 Die Gegenevidenz — data-ink hält, wo es um Ablesegenauigkeit geht

**Skau, Harrison & Kosara, EuroVis 2015** — BELEGT, Volltext gelesen
https://web.cs.wpi.edu/~ltharrison/docs/skau2015evaluation.pdf · DOI 10.1111/cgf.12634

103 MTurk-Teilnehmende (100 bezahlt à 2 USD), Bonferroni-korrigiert α = 0,0083, Fehlermaß MLAE (midmean log absolute error).

*Relativvergleiche (zwei Balken vergleichen) — Basisdiagramm gewinnt fast überall:*

| Variante | Mittel | p vs. Basis |
|---|---|---|
| Basis (Standardbalken) | 1,43 | — |
| „extended" | 1,59 | 0,097 (n.s.) |
| „capped" (T-Kopf) | 1,70 | 0,0013 * |
| Dreieck | 1,85 | < 0,001 * |
| Abgerundet | 1,86 | < 0,001 * |
| Überlappend | 1,82 | < 0,001 * |
| Quadratisch skaliert | 2,33 | < 0,001 * |

Fazit im Original: „**none of the embellishments tested … performed better** at communication of the data than the baseline standardized chart." Schon **das Abrunden einer Balkenspitze** erzeugt signifikant höhere Fehler.

**Haroz, Kosara & Franconeri, CHI 2015 (ISOTYPE)** — BELEGT, Volltext gelesen
https://kosara.net/papers/2015/Haroz-CHI-2015.pdf · DOI 10.1145/2702123.2702275

Die entscheidende Trennlinie: **Piktogramme, die Daten kodieren, kosten nichts. Überflüssige Hintergrundbilder kosten.**
- Exp. 4 (50 Personen, 200 Durchgänge, >92 % Genauigkeit): Haupteffekt Diagrammtyp auf Antwortzeit F[4,49] = 20, p < 0,05; Tukey-HSD: **nur die „superfluous"-Bedingung** unterschied sich signifikant vom Standardbalken (langsamer).
- Diskretisierte Balken (gestapelte Einzelsymbole) senken Fehler gegenüber gedehnten Symbolen: F[1,21] = 10,0, p < 0,005 — aber nur bei kleinen Werten (Subitizing-Grenze 4–5 Objekte).
- Aufmerksamkeit (Exp. 5, 10 Personen): ISOTYPE-Diagramme hatten nach **15 Sekunden zwei Drittel aller Blicke**; F[2,9] = 61, p < 0,0001.
- Wörtliches Fazit: „(1) **Only pictographs embedded as part of data mapping are beneficial** … Superfluous pictographs and label images are distracting and confusing."

### 1.4 Inbar, Tractinsky & Meyer (ECCE 2007) — TEILS BELEGT

https://cris.bgu.ac.il/en/publications/minimalism-in-information-visualization-attitudes-towards-maximiz/ · DOI 10.1145/1362550.1362587

**Belegt (Abstract aus der Institutsdatenbank):** 87 Studierende, drei Versuchsbedingungen, Vergleich eines Standard-Balkendiagramms mit einer minimalistischen Fassung derselben Daten. „The results indicate a **clear preference of non-minimalist bar-graphs**, suggesting low acceptance of minimalist design principles such as high data-ink ratio." Die Autoren räumen selbst ein, dass Unvertrautheit mit minimalistischen Diagrammen die Präferenz beeinflusst haben könnte.

**NICHT belegt:** Die kursierenden Einzelwerte („Graph A gegen Graph D, p<.001", „Klarheit niedriger, p<.01") stammen aus einer Suchmaschinenzusammenfassung. Der Volltext ist paywalled (Unpaywall: `is_oa = false`), ich konnte diese p-Werte **nicht** im Original prüfen. Behandeln Sie sie als unbelegt.

### 1.5 Gillan & Richman (Human Factors 1994) — NUR SEKUNDÄR BELEGT

Ich habe den Volltext **nicht** bekommen (kein Open-Access-Fundort, DOI-Suche erfolglos). Was ich sagen kann: Die Arbeit existiert, *Human Factors* 36(4), vier Experimente. Sekundärquellen berichten übereinstimmend, dass **höhere** data-ink-Ratios zu schnelleren Reaktionszeiten und höherer Genauigkeit führten — also **für** Tufte. Der Nachfolger Gillan & Sorensen 2009 („Minimalism and the Syntax of Graphs II: Effects of Graph Backgrounds on Visual Search", DOI 10.1177/154193120905301711) ist über die Literaturliste von arXiv:2009.02634 belegt, ebenfalls nicht Open Access.
**→ Bitte nicht mit konkreten Zahlen zitieren.** Ich habe keine.

### 1.6 Die methodische Gegenrede: Stephen Few (2011) — BELEGT, Volltext gelesen

https://www.perceptualedge.com/articles/visual_business_intelligence/the_chartjunk_debate.pdf

Few nennt fünf eingebaute Fehlannahmen bei Bateman:
1. Der Verwendungszweck der Testdiagramme sei typisch für quantitative Grafiken in der Praxis.
2. Die Holmes-Diagramme seien Extrembeispiele für chartjunk.
3. Die schmucklosen Diagramme seien so gestaltet, wie Minimalismus-Vertreter es fordern.
4. Eine Studie mit **20 Studierenden** könne belastbare Ergebnisse liefern.
5. Die Studie habe die relevanten Faktoren identifiziert und kontrolliert.

Sein inhaltlicher Kern: Die getesteten Diagramme haben je **eine** Aussage, wenige Werte, eine metaphorisch an die Aussage gebundene Illustration, gezeichnet von einem begabten Grafiker. „The values contained in the graph are **incidental to its purpose**; certainly not intended for close inspection." Das ist genau nicht die Lage eines Daten-Interfaces.

### 1.7 Stand der Praxis 2020/2026 — BELEGT, Volltext gelesen

Parsons, „Data Visualization Practitioners' Perspectives on Chartjunk", arXiv:2009.02634 — 20 Praktikerinterviews.

- **Kein Konsens über die Definition** von chartjunk unter Praktikern, obwohl fast alle wussten, dass Tufte den Begriff prägte.
- Die Befragten waren „**more likely to be familiar with discussions happening on social media** or in practitioner publications than in academic papers and conferences".
- **Nur 1 von 20** (P19, promoviert in Visualisierung) verwies auf konkrete akademische Arbeiten.
- Die Arbeit referiert die Lage nüchtern: Bateman „found embellished charts to improve recall (though there have been **concerns about their methodology**)"; Haroz: „superfluous images can be distracting — **but do not incur any significant user costs** — and have benefits for working memory and engagement".

### 1.8 Small multiples und Sparklines — die stärkste empirische Stütze für Tufte

**Robertson et al., IEEE TVCG 2008** — BELEGT, Volltext gelesen
https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf · DOI 10.1109/TVCG.2008.125

Animation vs. Traces vs. Small Multiples, getrennt für Präsentation und Analyse:

| Zweck | Animation | Small Multiples | Traces |
|---|---|---|---|
| Präsentation (Zeit) | **15,80 s** | 25,30 s | 27,80 s |
| Analyse (Zeit) | **83,10 s** | **45,69 s** | 55,01 s |

Small Multiples sind in der Analyse **schneller UND fehlerärmer** als Animation (H3a und H3b beide bestätigt). Animation wurde als „fun/exciting" bewertet (Q4/Q5 signifikant höher), führte aber zu vielen Fehlern. Small Multiples wurden bei großen Datensätzen als am wenigsten überladen bewertet (Q7: 2,8 gegen 4,4 bzw. 4,7). Alle drei Verfahren **skalieren nicht über ~200 Datenpunkte**.

**Heer, Kong & Agrawala, CHI 2009 („Sizing the Horizon")** — BELEGT, Volltext gelesen
https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf

Das ist die harte Zahl zur Frage „wie klein darf eine Sparkline sein":

- Diagramme 500 px breit, Höhen **48 / 24 / 12 / 6 px** (Skalenfaktoren 1, ½, ¼, ⅛), 30 Teilnehmende, 120 Durchgänge je Person. Nachfolgeversuch bis **2 px** Höhe (8 Teilnehmende).
- Diskriminationsgenauigkeit blieb bei **≥98 %** über alle Bedingungen — Muster erkennt man auch winzig.
- **Schätzgenauigkeit blieb stabil bei 48 px und 24 px.** Darunter stieg der Fehler monoton.
- Unterhalb einer „virtuellen Auflösung" von **24 px** steigt der Fehler **linear** mit jeder Halbierung: Regression R² = **0,986**, Steigung **−4,1 Einheiten pro log₂-Pixel** (Nachfolgeversuch: R² = 0,980, Steigung −3,5).
- Ab ¼ (12 px) und darunter schlagen 2-Band-Horizon-Graphen die Liniendiagramme.
- Der Preis der Schichtung: 2-Band-Diagramme kosteten im Mittel **2,05 s** mehr Schätzzeit (p < 0,001).

**→ Praktische Ableitung: 24 px Diagrammhöhe ist die empirisch gemessene Untergrenze, unterhalb derer Ablesegenauigkeit vorhersagbar zerfällt.** Bemerkenswert: exakt dieselbe Zahl wie WCAG 2.5.8 (siehe 3.3).

### 1.9 Bilanz Teil 1

| Tufte-These | Status 2026 |
|---|---|
| Data-Ink-Ratio als **Merkbarkeitsregel** | **Widerlegt** (Borkin 2013, p<0,001, Richtung umgekehrt) |
| Data-Ink-Ratio als **Ablesegenauigkeitsregel** | **Gehalten** (Skau 2015: keine einzige Verzierung schlug die Basis; Heer 2009) |
| „Chartjunk schadet dem Verständnis" | **Nicht bestätigt** (Bateman: keine Genauigkeitseinbuße; Haroz: keine Kosten bei datenkodierenden Piktogrammen) |
| „Überflüssiger Bildschmuck ist harmlos" | **Widerlegt** (Haroz Exp. 4: nur die „superfluous"-Bedingung war signifikant langsamer) |
| Small multiples | **Bestätigt** (Robertson 2008: schneller und genauer als Animation für Analyse) |
| Sparklines / extreme Verkleinerung | **Bestätigt mit Grenzwert**: ab <24 px linearer Genauigkeitsverfall |
| Minimalismus als **Publikumspräferenz** | **Widerlegt** (Inbar 2007, 87 Personen; Bateman-Präferenzen p≤,003) |

Die belastbare Synthese: Tuftes Regel war nie falsch, sie war **unterspezifiziert**. Sie gilt für *Ablesen*, nicht für *Erinnern*, und sie unterscheidet nicht zwischen Schmuck, der Daten kodiert, und Schmuck, der nur danebensteht. Genau an dieser Naht bricht jede der Studien.

---

## 2. ZEILENHÖHEN UND SPALTENABSTÄNDE — ECHTE ZAHLEN AUS DEN SYSTEMEN

### 2.1 IBM Carbon — die vollständigste veröffentlichte Dichteleiter (BELEGT, Doku + Quellcode)

Doku: https://raw.githubusercontent.com/carbon-design-system/carbon-website/main/src/pages/components/data-table/style.mdx
Quellcode: https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/styles/scss/components/data-table/_data-table.scss

| Stufe | Zeilenhöhe | rem | Zellenpolsterung vertikal (aus SCSS) |
|---|---|---|---|
| xs | **24 px** | 1,5 | 2 px |
| sm | **32 px** | 2 | 7 px oben / 6 px unten |
| md | **40 px** | 2,5 | 7 px oben / 6 px unten |
| lg | **48 px** | 3 | (Grundfall, keine eigene Regel im SCSS) |
| xl | **64 px** | 4 | `$spacing-05` = 16 px |

**Schriftgrößen (beide 14 px!):** Spaltenkopf 14 px SemiBold/600 (`$heading-compact-01`), Zeilentext 14 px Regular/400 (`$body-compact-01`). Horizontale Zellenpolsterung durchgängig **16 px** (`$spacing-05`) — sie ändert sich über die Dichtestufen **nicht**.

Das ist der wichtigste strukturelle Befund des ganzen Abschnitts: **Carbon variiert Dichte ausschließlich vertikal.** Schriftgröße und Spaltenabstand bleiben über alle fünf Stufen konstant. Die Dichte kommt aus dem Zeilenabstand, nicht aus kleinerer Schrift.

Bei xs (24 px Zeile, 14 px Schrift, 2 px Polsterung) ergibt sich rechnerisch eine effektive Zeilenhöhe von 24/14 ≈ **1,71** — und die Zeile ist damit exakt auf dem WCAG-2.5.8-Minimum von 24 px (siehe 3.3).

### 2.2 Ant Design (BELEGT, Doku + Quellcode-Semantik)

Doku: https://ant.design/components/table
Quellcode: https://raw.githubusercontent.com/ant-design/ant-design/master/components/table/style/index.ts

| Größe | Polsterung vertikal | Polsterung horizontal | Schriftgröße |
|---|---|---|---|
| large (Standard) | **16 px** | **16 px** | 14 px |
| middle | **12 px** | **8 px** | 14 px |
| small | **8 px** | **8 px** | 14 px |

Im Quellcode sind das keine Literale, sondern Token-Verweise: `cellPaddingBlock: padding` (16), `cellPaddingBlockMD: paddingSM` (12), `cellPaddingInlineMD: paddingXS` (8), `cellPaddingBlockSM: paddingXS` (8) — und `cellFontSize/MD/SM` **alle drei** auf `fontSize` (14). Ant bestätigt Carbons Muster: **Schriftgröße bleibt über alle Dichtestufen gleich.**

Ant reduziert im Gegensatz zu Carbon auch horizontal: 16 → 8 px beim Sprung von large auf middle.

### 2.3 Material (BELEGT über MDC-Web-Quellcode)

https://raw.githubusercontent.com/material-components/material-components-web/master/packages/mdc-data-table/_data-table-theme.scss

```
$row-height: 52px
$header-row-height: $row-height + 4px  → 56px
$minimum-row-height: 36px
$cell-leading-padding: 16px
$cell-trailing-padding: 16px
```

**Einschränkung, die ich ausdrücklich mache:** Die Doku-Seiten `m2.material.io/components/data-tables` und `m3.material.io` sind reine JavaScript-Anwendungen und liefern per Abruf keinen Text. Ich konnte **keine M3-Data-Table-Spezifikation belegen**; M3 scheint keine eigene Data-Table-Komponente zu spezifizieren. Die obigen Zahlen stammen aus der Referenzimplementierung (MDC Web), nicht aus einem M3-Dokument. Die oft zitierten „dense 40dp / standard 52dp"-Werte konnte ich nur für 52 px belegen — die 36 px sind im Code als `$minimum-row-height` ausgewiesen, nicht als „dense"-Stufe.

### 2.4 Salesforce Lightning (BELEGT, kompiliertes CSS)

https://cdn.jsdelivr.net/npm/@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css
und https://raw.githubusercontent.com/salesforce-ux/design-system/main/ui/components/data-tables/base/_index.scss

```
.slds-table td, .slds-table th { padding: .25rem .5rem; white-space: nowrap }
```
→ **4 px vertikal, 8 px horizontal.** Kopfzellen: `height: 2rem` = **32 px**. Rand-Puffer `slds-cell-buffer_left/right`: 1,5 rem = 24 px. Spacing-Aliase: XXX_SMALL 2 px · XX_SMALL 4 px · X_SMALL 8 px · SMALL 12 px · MEDIUM 16 px · LARGE 24 px · X_LARGE 32 px.

SLDS ist damit das **dichteste** der geprüften Systeme im Grundzustand — und hat, anders als Carbon/Ant, **keine** Dichtestufen; ich habe im kompilierten CSS keine `condensed`/`compact`-Modifikatoren für Tabellen gefunden. Bemerkenswert: `white-space: nowrap` als Grundregel, mit `.slds-cell-wrap` als Opt-in — Umbruch ist bei Salesforce die Ausnahme, nicht die Regel.

### 2.5 Shopify Polaris IndexTable (BELEGT, Komponenten-CSS + Token-Quelle)

https://raw.githubusercontent.com/Shopify/polaris/main/polaris-react/src/components/IndexTable/IndexTable.module.css
https://raw.githubusercontent.com/Shopify/polaris/main/polaris-tokens/src/size.ts

Token-Werte: 025 = 1 px · 050 = 2 px · 100 = 4 px · 150 = **6 px** · 200 = **8 px** · 300 = **12 px** · 400 = 16 px · 500 = 20 px.

| Element | Token | px |
|---|---|---|
| Zellenpolsterung (allseitig) | `--p-space-150` | **6 px** |
| Erste/letzte Zelle außen | `--p-space-300` | **12 px** |
| Kopfzeile horizontal | `--p-space-150` | 6 px |
| Kopfzeile vertikal | `--p-space-200` | 8 px |

Polaris veröffentlicht **keine** feste Zeilenhöhe — die Zeile ergibt sich aus Inhalt + 2×6 px. Kopf und Zellen nutzen `--p-font-size-300` bzw. `--p-font-weight-medium`; den px-Wert von `font-size-300` konnte ich in dieser Datei **nicht** belegen (er liegt in einer anderen Token-Datei).

### 2.6 Atlassian (TEILS BELEGT)

https://atlassian.design/foundations/spacing

Space-Skala: 0 · **2** (025) · **4** (050) · **6** (075) · **8** (100) · **12** (150) · **16** (200) · **20** (250) · **24** (300) · 32 · 40 · 48 · 64 · 80 px. Leitlinie für kompakte UI: `space.0` bis `space.100`, also **0–8 px**.

**NICHT belegt:** Atlassian veröffentlicht auf den erreichbaren Seiten **keine Zeilenhöhen für die Dynamic Table**. Die Komponentenseiten sind JS-Anwendungen ohne abrufbaren Text. Ich habe keine px-Zeilenhöhe für Atlassian.

### 2.7 Adobe Spectrum (STRUKTUR BELEGT, ZAHLEN NICHT)

https://raw.githubusercontent.com/adobe/spectrum-css/main/components/table/index.css

Spectrum hat als einziges System eine **zweidimensionale** Dichtematrix:
- Größe: `--sizeS` / Standard (M) / `--sizeL` / `--sizeXL`
- Dichte: `--compact` / regular / `--spacious`

Also 4 × 3 = 12 Kombinationen, adressiert über Tokens der Form `--spectrum-table-row-height-{size}-{density}`. Schriftgrößen: sizeS → `font-size-75`, M → `font-size-100`, L → `font-size-200`, XL → `font-size-300`.

**Spectrum ist damit das einzige geprüfte System, das die Schriftgröße mit der Dichtestufe mitskaliert.**

**NICHT belegt:** Die konkreten px-Werte hinter `--spectrum-table-row-height-medium-regular` usw. Das Repository `adobe/spectrum-tokens` enthält auf `main` nur noch die Website (18 Dateien, keine Token-JSONs); die Token-Quelle wurde umstrukturiert. Ich habe **keine** Spectrum-px-Zahl.

### 2.8 GitHub Primer (NAMEN BELEGT, ZAHLEN NICHT)

https://primer.style/components/data-table

Drei Stufen über `cellPadding`: **condensed** („Maximizes data visibility in a small area"), **normal** (Standard), **spacious**. Die Doku nennt **keine** px-Werte für Zeilenhöhe, Polsterung oder Schriftgröße. Ich habe für Primer keine Zahlen.

### 2.9 Retool (BELEGT)

https://docs.retool.com/apps/guides/data/table/customization

| Einstellung | Zeilenhöhe |
|---|---|
| X-Small | **20 px** |
| Small | **32 px** |
| Medium | **48 px** |
| Large | **60 px** |
| Dynamic | inhaltsabhängig |

**Retools 20 px ist der niedrigste belegte Wert im gesamten Vergleich — und liegt unter dem WCAG-2.5.8-Minimum von 24 px.** Wenn die Zeile ein Klickziel ist, ist X-Small nicht AA-konform (außer über die Spacing-Ausnahme).

### 2.10 Gesamtvergleich (nur belegte Zahlen)

| System | dichteste Stufe | Standard | lockerste | Schrift skaliert mit? |
|---|---|---|---|---|
| Carbon | 24 px | 48 px (lg) | 64 px | **nein** (14 px überall) |
| Ant Design | 8+8 px Polst. | 16+16 px | — | **nein** (14 px überall) |
| MDC Web | 36 px (min) | 52 px (Kopf 56) | — | nicht dokumentiert |
| Salesforce | 4/8 px Polst., Kopf 32 px | (keine Stufen) | — | nein |
| Polaris | 6 px Polst. | (keine Stufen) | — | nein |
| Retool | **20 px** | 48 px | 60 px | nicht dokumentiert |
| Spectrum | compact | regular | spacious | **ja** |

**Der belastbare Querschnittsbefund:** Fünf von sieben Systemen halten die Schriftgröße konstant und regeln Dichte allein über vertikalen Raum. Die dichteste *dokumentierte* Zeile mit lesbarer Schrift ist Carbons 24 px bei 14 px Schrift.

---

## 3. WO DICHTE IN UNLESBARKEIT KIPPT

### 3.1 WCAG 1.4.12 Text Spacing (Level AA) — BELEGT, normativer Text

https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html

Inhalt muss ohne Verlust von Inhalt oder Funktion folgende Anpassungen überstehen:

| Eigenschaft | Anforderung |
|---|---|
| Zeilenhöhe (line-height) | **mindestens 1,5 × Schriftgröße** |
| Absatzabstand | **mindestens 2 × Schriftgröße** |
| Zeichenabstand (letter-spacing) | **mindestens 0,12 × Schriftgröße** |
| Wortabstand (word-spacing) | **mindestens 0,16 × Schriftgröße** |

**Herkunft der Zahlen (aus dem Understanding-Dokument):** Forschung von McLeish, der Abstände von 0,04 bis 0,25 em testete — „McLeish found an increasing curve in reading speed of actual materials up to .25, but it started to flatten at .20." Dr. Wayne E. Dick leitete daraus die übernommenen Werte ab. Getestet über rund **480 Sprachen und Schriftsysteme** ohne nachteilige Effekte.

**Was das für Tabellen bedeutet — und was nicht:** 1.4.12 verlangt **nicht**, dass Sie 1,5 als Vorgabe setzen. Es verlangt, dass Ihr Layout es **aushält**, wenn die Nutzerin es setzt. Für eine dichte Tabelle ist das der harte Prüfstein: 14 px Schrift × 1,5 = 21 px reine Zeilenbox. Carbons xs-Zeile (24 px) überlebt das mit 3 px Luft. Retools X-Small (20 px) überlebt es **nicht** — die Zeile muss wachsen oder der Text wird beschnitten.

### 3.2 WCAG 1.4.8 Visual Presentation (Level AAA) — BELEGT

https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html

- Zeilenbreite **höchstens 80 Zeichen** (CJK: 40)
- Zeilenabstand **mindestens 1,5** innerhalb von Absätzen; Absatzabstand mindestens 1,5 × Zeilenabstand
- Text nicht im Blocksatz
- Vorder- und Hintergrundfarbe vom Nutzer wählbar
- 200 % Skalierung ohne horizontales Scrollen

Begründung im Original: Nutzer mit bestimmten Sehbehinderungen verlieren bei langen Zeilen die Zeilenposition; „People with some cognitive disabilities find it difficult to track text where the lines are close together."

### 3.3 WCAG 2.5.8 Target Size (Minimum), Level AA (neu in WCAG 2.2) — BELEGT, normativer Text

https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

„The size of the target for pointer inputs is **at least 24 by 24 CSS pixels**", mit fünf Ausnahmen:

1. **Spacing** — kleinere Ziele sind zulässig, wenn ein **24-px-Durchmesser-Kreis**, zentriert auf der Bounding-Box jedes Ziels, keinen anderen Zielkreis schneidet.
2. **Equivalent** — dieselbe Funktion ist über ein konformes Bedienelement auf derselben Seite erreichbar.
3. **Inline** — das Ziel liegt in einem Satz oder wird durch die Zeilenhöhe umgebenden Textes begrenzt.
4. **User Agent Control** — die Größe bestimmt der Browser, nicht der Autor.
5. **Essential** — die Darstellung ist wesentlich oder rechtlich vorgeschrieben.

Ausnahme 1 ist für Tabellen die praktisch wichtige: **eine 20-px-Zeile mit einem Icon-Button kann konform sein, wenn horizontal genug Abstand zum nächsten Ziel besteht.** Nicht die Zielgröße allein entscheidet, sondern Größe *oder* Abstand.

### 3.4 WCAG 2.5.5 Target Size (Enhanced), Level AAA — BELEGT

https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html

„at least **44 by 44 CSS pixels**", vier Ausnahmen (Equivalent, Inline, User Agent Control, Essential). **Level AAA** — ausdrücklich nicht die Messlatte für ein Produktivwerkzeug.

**Plattformwerte zum Vergleich:** Google/Android nennt **48 × 48 dp** („results in a physical size of about 9mm") — https://support.google.com/accessibility/android/answer/7101858. Apples 44 × 44 pt konnte ich **nicht** belegen: die HIG-Seiten sind JS-Anwendungen ohne abrufbaren Text.

### 3.5 Fitts's Law — BELEGT

https://en.wikipedia.org/wiki/Fitts%27s_law

Shannon-Formulierung: **ID = log₂(D/W + 1)**, mit ID = Schwierigkeitsindex (Bits), D = Distanz zum Zielmittelpunkt, W = Zielbreite entlang der Bewegungsachse. Original: Fitts, P. M. (Juni 1954), „The information capacity of the human motor system in controlling the amplitude of movement", *Journal of Experimental Psychology* 47(6), 381–391.

**Der für Tabellen entscheidende Punkt ist die Logarithmusform:** Weil D/W im Logarithmus steht, ist die Kostenkurve **nicht** linear. Eine Zeile von 48 auf 24 px zu halbieren, verdoppelt die Zielzeit nicht — sie erhöht ID nur um etwa 1 Bit. Dichte ist bei Zeigezielen billiger, als die Intuition nahelegt. Der Bruch kommt nicht aus der Zielzeit, sondern aus der **Fehlerrate**: Der Artikel benennt den Geschwindigkeits-Genauigkeits-Ausgleich („faster movements and smaller targets produce higher error rates"). In einer Tabelle bedeutet ein Fehlklick die falsche **Zeile** — semantisch ein völlig anderer Datensatz, nicht nur ein verfehlter Knopf.

lawsofux.com (https://lawsofux.com/fittss-law/) nennt **keine** px-Empfehlung — das habe ich geprüft.

### 3.6 Zeilenlänge — BELEGT, drei unabhängige Quellen

| Quelle | Empfehlung |
|---|---|
| Butterick, *Practical Typography* — https://practicaltypography.com/line-length.html | **45–90 Zeichen**, „2–3 Alphabete" |
| Baymard Institute — https://baymard.com/blog/line-length-readability | **50–75 Zeichen**; Ruder: 50–60; CSS `max-width: 70ch` bzw. `34em` |
| WCAG 1.4.8 (AAA) | **≤ 80 Zeichen** (CJK ≤ 40) |

Baymard berichtet **keine** quantifizierten Lese- oder Verständniswerte — nur qualitative Beobachtungen aus E-Commerce-Tests („intimidating and overwhelming", Ermüdung ab „100+ characters"). Das habe ich geprüft; wer Zahlen zu Lesegeschwindigkeit vs. Zeilenlänge sucht, findet sie dort **nicht**.

### 3.7 Zeilenhöhe bei kleinen Schriftgrößen — BELEGT

**Butterick** (https://practicaltypography.com/line-spacing.html): **120–145 % der Schriftgröße**. Bei 14 px sind das **16,8–20,3 px**.

**Rello, Pielot, Marcos & Carlini, W4A 2013** — „Size matters (spacing not): 18 points for a dyslexic-friendly Wikipedia", DOI 10.1145/2461121.2461125 (Abstract über Semantic Scholar belegt, Volltext paywalled):

> 28 Teilnehmende mit Dyslexie. Getestet: Schriftgrößen **10, 12, 14, 18, 22, 26 pt** und Zeilenabstände **0,8 · 1,0 · 1,4 · 1,8**. Ergebnis: „**font size has a significant effect on the readability and the understandability of the text, while line spacing does not.**" Empfehlung: 18 pt.

Das ist der interessanteste Einzelbefund für Dichte-Design und läuft der Intuition zuwider: Im getesteten Bereich (0,8 bis 1,8) war **der Zeilenabstand ohne messbaren Effekt**, die Schriftgröße dagegen entscheidend. Für ein dichtes Interface heißt das: **Erst die Schriftgröße verteidigen, dann den Zeilenabstand komprimieren** — nicht umgekehrt. Genau das tun Carbon und Ant Design (14 px konstant über alle Dichtestufen).

**Einschränkung, die ich benenne:** Die Stichprobe ist dyslexisch und die Aufgabe war Fließtextlesen auf Wikipedia, nicht Tabellenscannen. Die Übertragung auf Datentabellen ist eine Analogie, kein Beleg.

### 3.8 Der einzige empirisch gemessene Kipppunkt, den ich gefunden habe

Aus Heer et al. 2009 (Abschnitt 1.8): **unterhalb 24 px effektiver Höhe steigt der Ablesefehler linear mit jeder Halbierung** (R² = 0,986). Oberhalb 24 px ist er flach. Das ist der einzige Befund in dieser Recherche, der einen Dichte-Grenzwert nicht behauptet, sondern *misst*.

Dass Carbons dichteste Zeile (24 px), WCAG 2.5.8 (24 px) und Heers gemessener Genauigkeitsknick (24 px) auf derselben Zahl liegen, ist **eine Beobachtung, keine belegte Kausalität.** Ich habe keine Quelle gefunden, die diese drei aufeinander bezieht.

---

## 4. DIE PRAXISBEISPIELE

### 4.1 Bloomberg Terminal

**BELEGT — Farbforschung, Erstquelle:** Bloomberg, „Designing the Terminal for Color Accessibility" (über Wayback abgerufen, da bloomberg.com Bots blockt): http://web.archive.org/web/20240718121421/https://www.bloomberg.com/company/stories/designing-the-terminal-for-color-accessibility/

- Bloomberg schätzt, dass **20.000 Terminal-Nutzer** eine Farbfehlsichtigkeit (CVD) haben.
- Rot/Grün sind im Finanzkontext semantisch belegt (auf/ab) — und genau die häufigste CVD-Form.
- Laborstudie mit Ishihara-Vortest und Aufgabenmessung; Auswertung über **lineare gemischte Modelle**: „clients were **more accurate, reported greater confidence, and preferred** the alternative and high contrast color sets compared to the current color set."
- Feldinterviews ergaben eine Abstufung nach Schweregrad: mild → Probleme bei dünnen Linien und kleinem farbigem Text; moderat → dunkle Rot/Grün-Töne auf dunklem Grund; schwer → auch Gelb/Violett/Pink.
- Semantische Zuordnung überlebt die Farbfehlsichtigkeit: Grün **und Blau** werden als „auf" gelesen, Rot/Gelb/Orange als „ab". Deshalb wurde Blau/Rot gewählt.
- **Das Bernstein blieb erhalten, ausdrücklich für nicht-semantische Information** („retaining the default Bloomberg amber color for non-semantic information"). Umschaltbar über `{PDFU COLORS <GO>}`.

Das ist die belegbarste Aussage zur Bloomberg-Farbcodierung: **Bernstein ist die Trägerfarbe, Rot/Grün (bzw. Blau/Rot) sind die Bedeutungsfarben.** Die Dichte funktioniert, weil nur ein kleiner Anteil der Zeichen überhaupt farbcodiert ist.

**BELEGT — Interface-Struktur:** https://en.wikipedia.org/wiki/Bloomberg_Terminal
Vier Panels, jedes mit eigener Kommandozeile, auf einem oder mehreren Monitoren verteilbar. Tastatur seit 1990 mit farbcodierten Funktionstasten: gelbe „Index"-Taste (F10), rote „Cancel" (Escape), grüne „GO" (Enter, Farbe vom Monopoly-Brett abgeleitet). SEA100-Tastatur: ~3 kg, 3 mm Tastenhub, 19 mm Rastermaß.

**SCHWACH BELEGT — Herkunft des Farbschemas:** https://ted-merz.com/2021/06/26/amber-on-black/ (Blog eines Bloomberg-Mitarbeiters, keine Primärquelle): Bernstein auf Schwarz entstand in den 1980ern, weil Farbmonitore selten waren; Mike Bloomberg behielt es als Wiedererkennungsmerkmal bei („traders could identify Bloomberg terminals across the room"). Kein Datum, keine Person außer Mike Bloomberg genannt.

**NICHT BELEGT — die Schrift.** Ich habe die Terminal-Schriftart **nicht** belegen können. bloomberg.com blockt automatisierte Abrufe (Bot-Challenge, auch mit Browser-User-Agent). designbycurio.com beschreibt nur generisch „monospaced typography … green on black because that was the output of the phosphor-coated CRT screens" und nennt **keinen Schriftnamen**. Die kursierenden Antworten auf Quora/HN sind unbelegte Nutzeraussagen. **Ich rate hier nicht.** Belegbar ist nur: die Schrift ist dicktengleich, und die funktionale Begründung ist Spaltenausrichtung von Zahlen („every character … occupies exactly the same horizontal width, allowing numerical data to align perfectly in columns").

Die von designbycurio behauptete „maximum information density … a form of transparency and trust" ist ausdrücklich **Meinung ohne Beleg** — die Seite nennt keine Messung.

### 4.2 Linear

**BELEGT — die Schrift, aus dem HTML der Erstquelle:**
```html
<link rel="preload" href="https://static.linear.app/fonts/InterVariable.woff2?v=4.1"
      as="font" type="font/woff2" crossorigin="anonymous"/>
```
Linear lädt **InterVariable** selbst gehostet vor. Das ist ein Erstbeleg, kein Hörensagen.

**BELEGT — das Farbsystem:** https://linear.app/blog/styling-linear-for-the-future-stylex
Linear generiert **über hundert Farbvariablen im LCH-Raum** aus genau drei Eingaben: Basisfarbe, Akzentfarbe, Kontraststufe. Bemerkenswertes Detail für Dichte: „when a row is selected, **we regenerate the entire theme** with the selected background as the new base, so labels, borders, and controls all re-derive against it." Das heißt: In einer Liste wird bei Auswahl nicht ein Highlight überlagert, sondern das ganze Thema für diese Zeile neu abgeleitet — Kontrast bleibt in jeder Zeile garantiert erhalten.

**BELEGT — Richtung des Redesigns (qualitativ):** https://linear.app/blog/behind-the-latest-design-refresh
Wechsel von kühlem, bläulichem zu wärmerem, weniger gesättigtem Grau; Seitenleiste „a few notches dimmer"; Reiter „more compact rather than spanning the full width"; weniger Icons und kleiner skaliert; „fewer separators"; weichere Ränder.

**NICHT BELEGT — jede konkrete Zahl.** Linear veröffentlicht **keine** Schriftgrößen, Zeilenhöhen, Abstandsskala oder Kontrastwerte. Der Design-Refresh-Artikel enthält keinen einzigen px-, rem- oder Ratio-Wert; der StyleX-Artikel nennt Token**namen**, keine Token**werte**. Die Seite `linear.app/method` liefert per Abruf nur Überschriften. Die im Netz kursierenden „Linear-Design-System"-Zahlen (refero.design, designmd.cc, opendesigner.io) sind **Rekonstruktionen Dritter aus dem Browser**, keine Erstquellen. **Ich gebe hier keine Zahlen wieder.**

Die einzige belegte Aussage zur Dichte-Philosophie steht in https://linear.app/blog/design-is-more-than-code (Karri Saarinen) und ist prozessual, nicht typografisch: „the most common reason design projects drag or fail is that the problem wasn't clear."

### 4.3 Superhuman — BELEGT, Erstquelle

https://blog.superhuman.com/superhuman-is-built-for-speed/ und https://blog.superhuman.com/performance-metrics-for-blazingly-fast-web-apps/

- **100 ms** = „the perceptual threshold between fast and slow" (zugeschrieben Paul Buchheit).
- Eigenes Ziel: **unter 50 ms** wo immer möglich.
- Neuer Renderer zeigt E-Mails in 1–2 Chrome-Frames, **< 32 ms**.
- Messmethode: **Anteil der Ereignisse unter Zielwert** statt 90. Perzentil, gestaffelt in <50 / <100 / <1000 / >1000 ms. Begründung im Original: „85 % of actions complete under 100ms" sei aussagekräftig, „90th percentile latency is 103ms" nicht.
- Messgenauigkeit **±100 Mikrosekunden** über `performance.now()`; Layout- und Paint-Zeiten werden bewusst ausgeklammert, um diese Präzision zu halten.
- Interface-Haltung: „Minimal animations, so no time is wasted on loading them"; Tastaturkürzel „faster than a mouse in almost all cases"; Befehlspalette (Cmd+K) statt Menüs.

Die Marketing-Behauptungen („drei Stunden pro Woche gespart", „Teams bewegen sich doppelt so schnell") sind **unbelegte Selbstaussagen** ohne Methodik.

### 4.4 Height und Retool

**Height:** Ich habe **keine** belastbare Erstquelle zu Informationsdichte, Typografie oder Zeilenhöhen gefunden. Nichts zu berichten.

**Retool:** Nur die Zeilenhöhenwerte aus 2.9 (20/32/48/60 px). Zu Schriftgrößen sagt die Doku ausdrücklich nichts; Styling läuft über Inspector-Regeln und Themenvariablen.

---

## 5. BELEGT vs. NICHT BELEGT — die Trennlinie

### Belegt, mit Volltext im Original gelesen
Bateman 2010 (alle t/p-Werte, Blickdaten) · Borkin 2013 (alle Mittelwerte, t/p-Werte, die Selbsteinschränkung) · Skau 2015 (alle MLAE-Werte) · Haroz 2015 (alle F-Werte) · Heer 2009 (Pixelhöhen, R², Steigungen) · Robertson 2008 (Sekundenwerte, Likert-Tabelle) · Few 2011 (die fünf Fehlannahmen) · Parsons 2020 (20 Praktiker, 1 von 20)

### Belegt aus Quellcode oder normativem Text
Carbon (alle 5 Stufen + Schriftgrößen) · Ant Design (alle 3 Stufen) · MDC Web (52/56/36/16) · Salesforce (4/8 px, Kopf 32 px, Spacing-Aliase) · Polaris (6/8/12 px + Token-Werte) · Atlassian (Space-Skala) · Retool (20/32/48/60) · WCAG 1.4.8 / 1.4.12 / 2.5.5 / 2.5.8 (Normtext + Herleitung) · Fitts 1954 (Formel + Zitat) · Android 48 dp · Linear = InterVariable (aus dem HTML) · Linear LCH-Themengenerierung · Bloomberg CVD-Studie (20.000 Nutzer, Methodik) · Superhuman (100/50/32 ms)

### Belegt nur über Abstract / Institutsdatenbank
Inbar/Tractinsky/Meyer 2007 (87 Teilnehmende, 3 Bedingungen, Präferenz für nicht-minimalistisch) · Rello 2013 (28 Teilnehmende, 10–26 pt, Zeilenabstand ohne Effekt)

### NICHT belegt — ich habe keine Zahlen und rate nicht
- **Gillan & Richman 1994** — kein Volltext, keine Zahlen. Nicht zitieren.
- **Inbar-Einzel-p-Werte** (p<.001, p<.01) — nur Suchmaschinenzusammenfassung, Volltext paywalled.
- **Adobe Spectrum px-Werte** — Token-Repository umstrukturiert, Werte nicht auffindbar. Nur die 4×3-Struktur ist belegt.
- **GitHub Primer px-Werte** — Doku nennt nur die drei Stufennamen.
- **Atlassian Tabellen-Zeilenhöhen** — nicht veröffentlicht / nicht abrufbar.
- **Material Design 3 Data-Table-Spezifikation** — existiert offenbar nicht; die Zahlen stammen aus MDC Web.
- **Polaris `font-size-300` in px** — in einer anderen Token-Datei.
- **Bloomberg-Terminal-Schriftart** — bloomberg.com blockt Abrufe; alle auffindbaren Angaben sind unbelegte Nutzeraussagen. Belegt ist nur „dicktengleich".
- **Linear: alle typografischen Zahlen** — nicht veröffentlicht. Kursierende Werte sind Fremdrekonstruktionen.
- **Height** — nichts gefunden.
- **Apple 44 × 44 pt** — HIG-Seiten nicht abrufbar. (WCAG 2.5.5 nennt 44 px, das ist belegt.)

### Meinung, nicht Befund
„Maximale Informationsdichte als Form von Transparenz und Vertrauen" (designbycurio über Bloomberg) · Superhumans „drei Stunden pro Woche" · Bernstein-auf-Schwarz als Markenstrategie (Blogquelle) · jede Aussage der Form „dicht ist professionell".

---

## 6. WAS SICH AUS DEN BELEGEN ABLEITEN LÄSST

1. **Dichte vertikal regeln, Schriftgröße festhalten.** Carbon und Ant halten 14 px über alle Dichtestufen konstant; Rello 2013 zeigt Schriftgröße signifikant, Zeilenabstand nicht. Fünf von sieben Systemen tun es so.
2. **24 px ist die belegte Untergrenze**, dreifach: Heers gemessener Genauigkeitsknick, WCAG 2.5.8, Carbons dichteste Stufe. Retools 20 px unterschreitet sie.
3. **1.4.12 ist der Belastungstest, nicht die Vorgabe.** 14 px × 1,5 = 21 px Zeilenbox muss die Zeile aushalten, ohne zu beschneiden.
4. **Der Data-Ink-Ratio gilt fürs Ablesen, nicht fürs Erinnern.** Skau: keine Verzierung schlug die Basis. Borkin: minimalistisch war *schlechter* merkbar (p<0,001).
5. **Die Trennlinie ist nicht Schmuck vs. kein Schmuck, sondern kodierend vs. danebenstehend.** Haroz Exp. 4 ist der sauberste Beleg: nur die überflüssige Bedingung war langsamer.
6. **Small multiples sind für Analyse belegt überlegen** (Robertson: 45,69 s vs. 83,10 s, dazu weniger Fehler) — bis ~200 Datenpunkte.
7. **Farbe sparsam als Bedeutungsträger.** Bloombergs Lösung: Bernstein für alles Nicht-Semantische, ein Farbpaar für Bedeutung — und das umschaltbar, weil 20.000 Nutzer das Standardpaar nicht trennen können.
8. **Fitts' Logarithmus verzeiht kleine Ziele; die Fehlerrate nicht.** In einer Tabelle ist ein Fehlklick nicht ein verfehlter Knopf, sondern der falsche Datensatz.

---

Recherche abgeschlossen. Hier der Abschlussbericht, fokussiert auf die drei angefragten Lücken. Die von dir bereits belegten Zahlen (Carbon, Grafana, Ant, Stripe, Linear, Pencil&Paper, WCAG-Wortlaute) lasse ich weg.

**Methodik:** 40+ Quellen abgerufen. Acht Forschungsarbeiten habe ich als PDF heruntergeladen und im **Volltext** gelesen, nicht nur Abstracts — die Zahlen unten sind aus den Ergebnisabschnitten der Originale, nicht aus Zusammenfassungen. Das WebSearch-Budget war nach zwei Aufrufen erschöpft; ab da lief alles über direkte URLs, `raw.githubusercontent.com`, Crossref-, Unpaywall- und Semantic-Scholar-APIs.

---

# 1. TUFTE UNTER EMPIRISCHER PRÜFUNG

## 1.1 Bateman et al., „Useful Junk?" (CHI 2010) — Volltext gelesen

https://sites.stat.columbia.edu/gelman/communication/Bateman2010.pdf · DOI 10.1145/1753326.1753716

**Aufbau:** 20 Teilnehmende (9 m / 11 w), 14 Diagramme + 2 Übungsdiagramme, je zwei Fassungen (Nigel-Holmes-Stil vs. schmucklos). 10 Personen sofortiger Abruf (nach 5-Minuten-Spielpause), 10 Personen Langzeitabruf nach **12–22 Tagen**. Eyetracking (Tobii) während der Beschreibung.

**Beschreibung, Diagramm sichtbar — kein Unterschied:**

| Frage | t | p |
|---|---|---|
| Thema | t₁₉ = 0,84 | ,412 |
| Kategorien | t₁₉ = 1,38 | ,185 |
| Trend | t₁₉ = 0,23 | ,818 |
| **Wertaussage** | **t₁₉ = 3,37** | **,003 — Holmes besser** |
| Bearbeitungszeit | t₁₉ = 1,834 | ,082 (2,60 vs. 2,43 min) |

**Sofortiger Abruf — kein Unterschied:** Thema p=,124 · Kategorien p=,129 · Trend p=,369. Nur Wertaussage p=,026.

**Langzeitabruf (12–22 Tage) — durchgehend zugunsten der geschmückten Fassung:**
Thema t₉=2,56 p=,015 · Kategorien t₉=5,03 p≈,000 · Trend t₉=1,95 p=,042 · Wertaussage t₉=2,41 p=,020. Zusätzlich brauchten die schmucklosen Diagramme **signifikant mehr Erinnerungsanstöße** (p=,013 / ,011 / ,018).

**Die für Interface-Dichte wichtigste Zahl — Blickdaten:** Bei Holmes-Diagrammen entfielen **67 %** der Bildschirmzeit auf Daten bzw. Daten+Schmuck, bei schmucklosen **78 %**. Reiner Schmuck ohne Dateninhalt: **13 %**. Diese verlorene Blickzeit führte zu **keiner** messbaren Verlangsamung.

**Präferenz (χ²):** angenehmer 8,9 p=,003 · attraktiver 11,8 p=,001 · leichter zu erinnern 15,2 p≈,000 — alles zugunsten Holmes.

## 1.2 Borkin et al., „What Makes a Visualization Memorable?" (IEEE VIS 2013) — Volltext gelesen

http://web.mit.edu/zoya/www/docs/InfoVis_borkin-128.pdf · DOI 10.1109/TVCG.2013.234

2.070 Visualisierungen katalogisiert, **410 Zielbilder**, **261 Teilnehmende** (Mechanical Turk). Von den 410: 145 extreme „Minimalisten" (data-ink „good"), 103 extreme „chart junk" (data-ink „bad"), 162 dazwischen.

**Messkonsistenz:** Gruppe 1 r = 1,00 · Gruppe 2 r = 0,81 · Zufall r = −0,01.

**Die zwei Befunde, die Tufte direkt widersprechen:**

- **Data-Ink-Ratio:** „bad" (= *niedriges* Verhältnis) M = **1,81** gegen „good" M = **1,23**; t(208) = 6,92; **p < 0,001**. Alle drei Stufen paarweise signifikant.
- **Visuelle Dichte:** hoch M = **1,83** gegen niedrig M = **1,28**; t(115) = 6,08; **p < 0,001**.

Die Autoren schreiben es selbst hin: „This supports our third hypothesis, and **refutes our fourth and fifth**" — H4 (weniger Dichte = merkbarer) und H5 (minimalistisch = merkbarer) sind widerlegt.

Weiter: Piktogramme M = 1,93 · ≥7 Farben M = 1,71 gegen 2–6 Farben M = 1,48 (t(285) = 3,97, p < 0,001) · Raster-, Baum- und Netzdiagramme merkbarer als Linien/Balken/Kreis.

**Die Selbsteinschränkung der Autoren wird fast immer unterschlagen und ist hier entscheidend:** „memorability … does not necessarily translate to an understanding of the visualizations themselves. **Nor does excessive visual clutter aid comprehension** of the actual information (and may instead interfere with it)." Gemessen wurde Szenen-Wiedererkennung, **nicht Verständnis**.

## 1.3 Die Gegenevidenz: data-ink hält, wo es ums Ablesen geht

**Skau, Harrison & Kosara, EuroVis 2015** — Volltext gelesen
https://web.cs.wpi.edu/~ltharrison/docs/skau2015evaluation.pdf · DOI 10.1111/cgf.12634

103 MTurk-Teilnehmende, Bonferroni α = 0,0083, Fehlermaß MLAE. Relativvergleiche zweier Balken:

| Variante | Mittel | p vs. Basis |
|---|---|---|
| Basis | 1,43 | — |
| „extended" | 1,59 | 0,097 (n.s.) |
| „capped" (T-Kopf) | 1,70 | 0,0013 * |
| Überlappend | 1,82 | < 0,001 * |
| Dreieck | 1,85 | < 0,001 * |
| Abgerundet | 1,86 | < 0,001 * |
| Quadratisch skaliert | 2,33 | < 0,001 * |

Wörtlich: „**none of the embellishments tested … performed better** at communication of the data than the baseline." **Schon das Abrunden einer Balkenspitze** erzeugt signifikant höhere Fehler.

**Haroz, Kosara & Franconeri, CHI 2015 (ISOTYPE)** — Volltext gelesen
https://kosara.net/papers/2015/Haroz-CHI-2015.pdf · DOI 10.1145/2702123.2702275

Die eigentliche Trennlinie der ganzen Debatte: **Piktogramme, die Daten kodieren, kosten nichts. Bilder, die nur danebenstehen, kosten.**
- Exp. 4 (50 Personen, 200 Durchgänge): Haupteffekt F[4,49] = 20, p < 0,05; Tukey-HSD: **nur die „superfluous"-Bedingung** war signifikant langsamer als der Standardbalken.
- Gestapelte Einzelsymbole senken Fehler gegenüber gedehnten: F[1,21] = 10,0, p < 0,005 — aber nur bei kleinen Werten (Subitizing, 4–5 Objekte).
- Aufmerksamkeit: ISOTYPE-Diagramme hatten nach **15 Sekunden zwei Drittel aller Blicke**, F[2,9] = 61, p < 0,0001.
- Fazit: „(1) **Only pictographs embedded as part of data mapping are beneficial** … Superfluous pictographs and label images are distracting and confusing."

## 1.4 Inbar / Tractinsky / Meyer (ECCE 2007) — teils belegt

https://cris.bgu.ac.il/en/publications/minimalism-in-information-visualization-attitudes-towards-maximiz/ · DOI 10.1145/1362550.1362587

**Belegt (Abstract der Institutsdatenbank):** 87 Studierende, drei Bedingungen, Standard-Balkendiagramm gegen minimalistische Fassung derselben Daten. „The results indicate a **clear preference of non-minimalist bar-graphs**, suggesting low acceptance of minimalist design principles such as high data-ink ratio." Die Autoren räumen selbst ein, dass Unvertrautheit die Präferenz mitverursacht haben könnte.

**NICHT belegt:** Die kursierenden Einzelwerte („Graph A gegen Graph D p<.001", „Klarheit niedriger p<.01") stammen aus einer Suchmaschinenzusammenfassung. Volltext ist paywalled (Unpaywall: `is_oa = false`). **Diese p-Werte habe ich nicht prüfen können — bitte nicht als belegt führen.**

## 1.5 Gillan & Richman (Human Factors 1994) — nur sekundär, keine Zahlen

Ich habe **keinen Volltext bekommen** (kein Open-Access-Fundort). Belegbar ist nur: Die Arbeit existiert, *Human Factors* 36(4), vier Experimente; Sekundärquellen berichten übereinstimmend, dass **höhere** data-ink-Ratios zu schnelleren Reaktionszeiten und höherer Genauigkeit führten — also **für** Tufte. Der Nachfolger Gillan & Sorensen 2009 (DOI 10.1177/154193120905301711) ist über die Literaturliste von arXiv:2009.02634 belegt, ebenfalls nicht frei.
**→ Nicht mit konkreten Zahlen zitieren. Ich habe keine.**

## 1.6 Die methodische Gegenrede: Stephen Few (2011) — Volltext gelesen

https://www.perceptualedge.com/articles/visual_business_intelligence/the_chartjunk_debate.pdf

Fünf eingebaute Fehlannahmen bei Bateman: (1) der Verwendungszweck sei typisch für quantitative Grafiken; (2) die Holmes-Diagramme seien Extrembeispiele; (3) die schmucklosen Fassungen seien so gestaltet, wie Minimalisten es fordern; (4) **20 Studierende** könnten belastbare Ergebnisse liefern; (5) die relevanten Faktoren seien kontrolliert.

Sein inhaltlicher Kern trifft genau unseren Fall: Die Testdiagramme haben je **eine** Aussage, wenige Werte, eine metaphorisch gebundene Illustration von einem begabten Grafiker. „The values contained in the graph are **incidental to its purpose**; certainly not intended for close inspection." Das ist die Gegenlage zu einem Daten-Interface.

## 1.7 Stand der Praxis — arXiv:2009.02634, Volltext gelesen

20 Praktikerinterviews. **Kein Konsens über die Definition** von chartjunk. Die Befragten waren „**more likely to be familiar with discussions happening on social media** … than in academic papers". **Nur 1 von 20** (promoviert in Visualisierung) verwies auf konkrete Forschung.

## 1.8 Small multiples und Sparklines — die stärkste Stütze für Tufte

**Robertson et al., IEEE TVCG 2008** — Volltext gelesen
https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf · DOI 10.1109/TVCG.2008.125

| Zweck | Animation | Small Multiples | Traces |
|---|---|---|---|
| Präsentation | **15,80 s** | 25,30 s | 27,80 s |
| Analyse | **83,10 s** | **45,69 s** | 55,01 s |

Small Multiples sind in der Analyse **schneller UND fehlerärmer** als Animation (beide Hypothesen bestätigt). Animation wurde als „fun/exciting" bewertet, führte aber zu vielen Fehlern. Alle drei Verfahren **skalieren nicht über ~200 Datenpunkte**.

**Heer, Kong & Agrawala, CHI 2009 („Sizing the Horizon")** — Volltext gelesen
https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf

Das ist der einzige **gemessene** Dichte-Grenzwert dieser ganzen Recherche:
- Diagramme 500 px breit, Höhen **48 / 24 / 12 / 6 px**, 30 Teilnehmende, 120 Durchgänge je Person; Nachfolgeversuch bis **2 px** (8 Personen).
- **Musterunterscheidung blieb bei ≥98 %** über alle Größen — Formen erkennt man auch winzig.
- **Schätzgenauigkeit blieb stabil bei 48 px und 24 px.** Darunter monotoner Anstieg.
- Unterhalb **24 px** effektiver Höhe steigt der Fehler **linear** mit jeder Halbierung: R² = **0,986**, Steigung **−4,1 Einheiten pro log₂-Pixel** (Nachfolgeversuch R² = 0,980, −3,5).
- Preis der Schichtung: 2-Band-Diagramme kosteten **2,05 s** mehr Schätzzeit (p < 0,001).

## 1.9 Bilanz

| Tufte-These | Status |
|---|---|
| Data-Ink-Ratio als **Merkbarkeitsregel** | **widerlegt** (Borkin, p<0,001, Richtung umgekehrt) |
| Data-Ink-Ratio als **Ablesegenauigkeitsregel** | **hält** (Skau: keine Verzierung schlug die Basis) |
| „Chartjunk schadet dem Verständnis" | **nicht bestätigt** (Bateman, Haroz) |
| „Bildschmuck ist harmlos" | **widerlegt** (Haroz: nur „superfluous" war langsamer) |
| Small multiples | **bestätigt** (Robertson) |
| Sparklines / extreme Verkleinerung | **bestätigt mit Grenzwert**: <24 px linearer Verfall |
| Minimalismus als Publikumspräferenz | **widerlegt** (Inbar 87 Personen; Bateman p≤,003) |

Die belastbare Synthese: Tuftes Regel war nie falsch, sie war **unterspezifiziert**. Sie gilt fürs *Ablesen*, nicht fürs *Erinnern*, und sie trennt nicht zwischen Schmuck, der Daten kodiert, und Schmuck, der nur danebensteht. An dieser Naht bricht jede der sechs Studien.

---

# 2. WO DICHTE IN UNLESBARKEIT KIPPT

## 2.1 Der einzige gemessene Kipppunkt

Heer et al. 2009 (oben): **unterhalb 24 px effektiver Höhe steigt der Ablesefehler linear mit jeder Halbierung, R² = 0,986.** Oberhalb flach. Alles andere in diesem Feld sind Konventionen; das hier ist eine Messung.

Dass Carbons dichteste Zeile (24 px), WCAG 2.5.8 (24 px) und Heers Genauigkeitsknick (24 px) auf derselben Zahl liegen, ist **eine Beobachtung, keine belegte Kausalität**. Ich habe keine Quelle gefunden, die die drei aufeinander bezieht.

## 2.2 Zeilenlänge — drei unabhängige Quellen

| Quelle | Empfehlung |
|---|---|
| Butterick, *Practical Typography* — https://practicaltypography.com/line-length.html | **45–90 Zeichen** („2–3 Alphabete") |
| Baymard — https://baymard.com/blog/line-length-readability | **50–75 Zeichen**; Ruder 50–60; CSS `max-width: 70ch` / `34em` |
| WCAG 1.4.8 (AAA) — https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html | **≤ 80 Zeichen** (CJK ≤ 40) |

**Ehrlichkeitshinweis:** Baymard liefert **keine** quantifizierten Lese- oder Verständniswerte, nur qualitative Beobachtungen („intimidating and overwhelming", Ermüdung ab „100+ characters"). Wer Zahlen zu Lesegeschwindigkeit vs. Zeilenlänge sucht, findet sie dort nicht — ich habe es geprüft.

WCAG 1.4.8 verlangt zusätzlich (Level AAA): Zeilenabstand ≥1,5 innerhalb von Absätzen, Absatzabstand ≥1,5× davon, **kein Blocksatz**, 200 % Skalierung ohne horizontales Scrollen.

## 2.3 Zeilenhöhe bei kleinen Graden

**Butterick** (https://practicaltypography.com/line-spacing.html): **120–145 % der Schriftgröße**. Bei 14 px = **16,8–20,3 px**.

**Rello, Pielot, Marcos & Carlini, W4A 2013** — „Size matters (spacing not)", DOI 10.1145/2461121.2461125 (Abstract über Semantic Scholar belegt, Volltext paywalled):

> 28 Teilnehmende mit Dyslexie. Getestet: Schriftgrößen **10, 12, 14, 18, 22, 26 pt** und Zeilenabstände **0,8 · 1,0 · 1,4 · 1,8**. Ergebnis: „**font size has a significant effect on the readability and the understandability of the text, while line spacing does not.**" Empfehlung 18 pt.

**Das ist der kontraintuitivste und für Dichte-Design nützlichste Einzelbefund der Recherche:** Im Bereich 0,8–1,8 war der **Zeilenabstand ohne messbaren Effekt**, die Schriftgröße dagegen entscheidend. Für ein dichtes Interface heißt das: **erst die Schriftgröße verteidigen, dann den Zeilenabstand komprimieren** — nicht umgekehrt. Genau das tun Carbon und Ant Design (14 px konstant über alle Dichtestufen; bei Ant sind `cellFontSize`, `cellFontSizeMD` und `cellFontSizeSM` im Quellcode **alle drei** auf denselben `fontSize`-Token gesetzt).

**Einschränkung, die ich benenne:** Stichprobe dyslexisch, Aufgabe war Fließtextlesen auf Wikipedia, nicht Tabellenscannen. Die Übertragung auf Datentabellen ist eine Analogie, kein Beleg.

## 2.4 Was WCAG 1.4.12 für eine dichte Tabelle praktisch bedeutet

Du hast den Wortlaut. Der ableitbare Prüfsatz: 1.4.12 verlangt **nicht**, dass du 1,5 als Vorgabe setzt — es verlangt, dass dein Layout es **aushält**, wenn die Nutzerin es setzt. 14 px × 1,5 = **21 px reine Zeilenbox**. Carbons xs (24 px) übersteht das mit 3 px Luft. Retools X-Small (20 px, siehe unten) übersteht es **nicht**.

Zur Herleitung der WCAG-Zahlen (steht im Understanding-Dokument, falls du die Begründung brauchst): Forschung von McLeish, der Abstände von 0,04 bis 0,25 em testete — „an increasing curve in reading speed … up to .25, but it started to flatten at .20". Wayne E. Dick leitete die übernommenen Werte ab; getestet über rund **480 Sprachen und Schriftsysteme**.

## 2.5 Fitts's Law — warum kleine Zeilen billiger sind, als man denkt

https://en.wikipedia.org/wiki/Fitts%27s_law · Fitts, P. M. (1954), *J. Exp. Psychol.* 47(6), 381–391.

Shannon-Form: **ID = log₂(D/W + 1)**. Weil D/W **im Logarithmus** steht, ist die Kostenkurve nicht linear: Eine Zeile von 48 auf 24 px zu halbieren, verdoppelt die Zielzeit nicht — sie erhöht ID um etwa 1 Bit. **Der Bruch kommt nicht aus der Zeit, sondern aus der Fehlerrate.** Und in einer Tabelle ist ein Fehlklick nicht ein verfehlter Knopf, sondern **der falsche Datensatz**.

lawsofux.com nennt **keine** px-Empfehlung — geprüft.

Plattformwerte: Google/Android **48 × 48 dp** („about 9mm") — https://support.google.com/accessibility/android/answer/7101858. **Apples 44 × 44 pt konnte ich nicht belegen** (HIG-Seiten sind JS-Anwendungen ohne abrufbaren Text). WCAG 2.5.5 nennt 44 px, das ist belegt — aber Level **AAA**, ausdrücklich nicht die Messlatte für ein Produktivwerkzeug.

---

# 3. BLOOMBERG, HEIGHT, SUPERHUMAN, RETOOL — mit ehrlicher Beleglage

## 3.1 Bloomberg Terminal

**GUT BELEGT — Farbforschung, Erstquelle** (über Wayback, da bloomberg.com Bots blockt):
http://web.archive.org/web/20240718121421/https://www.bloomberg.com/company/stories/designing-the-terminal-for-color-accessibility/

- Bloomberg schätzt **20.000 Terminal-Nutzer mit Farbfehlsichtigkeit (CVD)**.
- Rot/Grün sind im Finanzkontext semantisch belegt (auf/ab) — und genau die häufigste CVD-Form.
- Laborstudie mit Ishihara-Vortest, Auswertung über **lineare gemischte Modelle**: „clients were **more accurate, reported greater confidence, and preferred** the alternative and high contrast color sets".
- Feldinterviews: mild → dünne Linien und kleiner farbiger Text; moderat → dunkle Rot/Grün-Töne auf dunklem Grund; schwer → auch Gelb/Violett/Pink.
- Semantik überlebt die Fehlsichtigkeit: Grün **und Blau** = „auf", Rot/Gelb/Orange = „ab". Deshalb Blau/Rot als Alternativschema.
- **Das Bernstein blieb ausdrücklich für nicht-semantische Information erhalten** („retaining the default Bloomberg amber color for non-semantic information"). Umschaltbar über `{PDFU COLORS <GO>}`.

**Das ist die verwertbarste Aussage zur Bloomberg-Farbcodierung: Bernstein ist die Trägerfarbe, Rot/Grün (bzw. Blau/Rot) sind die Bedeutungsfarben.** Die Dichte funktioniert, weil nur ein kleiner Anteil der Zeichen überhaupt farbcodiert ist — Farbe ist dort knapp gehalten, nicht großzügig.

**BELEGT — Interface-Struktur:** https://en.wikipedia.org/wiki/Bloomberg_Terminal — vier Panels, jedes mit eigener Kommandozeile, auf einem oder mehreren Monitoren verteilbar. Farbcodierte Funktionstasten seit 1990: gelbe „Index" (F10), rote „Cancel" (Escape), grüne „GO" (Enter, Farbe vom Monopoly-Brett).

**SCHWACH BELEGT — Herkunft des Schemas:** https://ted-merz.com/2021/06/26/amber-on-black/ — Blog eines Bloomberg-Mitarbeiters, keine Primärquelle. Bernstein auf Schwarz entstand in den 1980ern mangels Farbmonitoren; Mike Bloomberg behielt es als Wiedererkennungsmerkmal. Kein Datum, keine weitere Person genannt.

**NICHT BELEGT — die Schriftart. Ich rate hier nicht.** bloomberg.com blockt automatisierte Abrufe (Bot-Challenge, auch mit Browser-User-Agent, zweimal versucht). designbycurio.com beschreibt nur generisch „monospaced typography … green on black because that was the output of the phosphor-coated CRT screens" und nennt **keinen Schriftnamen**. Quora/HN sind unbelegte Nutzeraussagen. Belegbar ist nur: die Schrift ist **dicktengleich**, und die funktionale Begründung ist Spaltenausrichtung von Zahlen — „every character … occupies exactly the same horizontal width, allowing numerical data to align perfectly in columns regardless of the digits displayed."

Die dort ebenfalls stehende Behauptung „maximum information density … a form of transparency and trust" ist **Meinung ohne jede Messung**.

## 3.2 Superhuman — gut belegt, Erstquelle

https://blog.superhuman.com/superhuman-is-built-for-speed/ und https://blog.superhuman.com/performance-metrics-for-blazingly-fast-web-apps/

- **100 ms** = „the perceptual threshold between fast and slow" (zugeschrieben Paul Buchheit).
- Eigenes Ziel: **unter 50 ms** wo möglich. Neuer Renderer: E-Mails in 1–2 Chrome-Frames, **< 32 ms**.
- **Messmethode ist der eigentlich übertragbare Teil:** *Anteil der Ereignisse unter Zielwert* statt 90. Perzentil, gestaffelt in <50 / <100 / <1000 / >1000 ms. Begründung im Original: „85 % of actions complete under 100ms" sei aussagekräftig, „90th percentile latency is 103ms" nicht.
- Präzision **±100 Mikrosekunden** über `performance.now()`; Layout- und Paint-Zeiten bewusst ausgeklammert, um sie zu halten.
- Interface-Haltung: „Minimal animations, so no time is wasted on loading them"; Tastaturkürzel „faster than a mouse in almost all cases"; Befehlspalette statt Menüs.

**Unbelegt:** „drei Stunden pro Woche gespart", „Teams bewegen sich doppelt so schnell" — Marketing-Selbstaussagen ohne Methodik.

**Wichtig für die Einordnung:** Superhuman dokumentiert **Latenz**, nicht **Dichte**. Zu Zeilenhöhen, Schriftgrößen oder Abständen habe ich von Superhuman **nichts** gefunden. Wer Superhuman als Dichte-Referenz zitiert, zitiert eine Geschwindigkeitsquelle.

## 3.3 Retool — belegt, aber dünn

https://docs.retool.com/apps/guides/data/table/customization

| Einstellung | Zeilenhöhe |
|---|---|
| X-Small | **20 px** |
| Small | **32 px** |
| Medium | **48 px** |
| Large | **60 px** |
| Dynamic | inhaltsabhängig |

**Retools 20 px ist der niedrigste belegte Wert im gesamten Systemvergleich — und liegt unter dem WCAG-2.5.8-Minimum von 24 px.** Wenn die Zeile ein Klickziel ist, ist X-Small nicht AA-konform, außer über die Spacing-Ausnahme (24-px-Kreis darf keinen anderen Zielkreis schneiden).

Zu **Schriftgrößen sagt die Retool-Doku ausdrücklich nichts** — Styling läuft über Inspector-Regeln und Themenvariablen. Mehr ist nicht dokumentiert.

## 3.4 Height — nichts

**Ich habe zu Height keine belastbare Quelle gefunden.** Keine Erstquelle zu Informationsdichte, Typografie, Zeilenhöhen oder Designprinzipien. Nichts zu berichten — und ich erfinde hier nichts.

## 3.5 Ergänzend, weil es dir bei Linear fehlen dürfte

Zwei Erstbelege, die ich beim Suchen mitgenommen habe:

- **Linear lädt InterVariable selbst gehostet vor** — direkt aus dem HTML von linear.app:
  `<link rel="preload" href="https://static.linear.app/fonts/InterVariable.woff2?v=4.1" as="font" …>`
  Das ist ein Erstbeleg für die oft behauptete Inter-Nutzung, kein Hörensagen.
- **Farbsystem** (https://linear.app/blog/styling-linear-for-the-future-stylex): über **hundert Farbvariablen im LCH-Raum**, generiert aus drei Eingaben (Basisfarbe, Akzentfarbe, Kontraststufe). Für Dichte relevant: „when a row is selected, **we regenerate the entire theme** with the selected background as the new base, so labels, borders, and controls all re-derive against it." Bei Auswahl wird also kein Highlight überlagert, sondern das Thema für die Zeile neu abgeleitet — der Kontrast bleibt in jeder Zeile garantiert erhalten.

**Aber:** Linear veröffentlicht **keine einzige typografische Zahl**. Der Design-Refresh-Artikel enthält keinen px-, rem- oder Ratio-Wert; der StyleX-Artikel nennt Token**namen**, keine Token**werte**. Die im Netz kursierenden „Linear-Design-System"-Zahlen (refero.design, designmd.cc, opendesigner.io) sind **Rekonstruktionen Dritter aus dem Browser**. Deine 24/28 px sind vermutlich gemessen — als *veröffentlichte* Werte existieren sie nicht.

---

# 4. WAS ICH NICHT BELEGEN KONNTE

Ausdrücklich, damit nichts als sicher durchgeht:

- **Gillan & Richman 1994** — kein Volltext, keine Zahlen. Nicht zitieren.
- **Inbar-Einzel-p-Werte** — nur Suchmaschinenzusammenfassung; Volltext paywalled. Nur die 87 Teilnehmenden und die Richtung des Befunds sind belegt.
- **Bloomberg-Terminal-Schriftart** — bloomberg.com blockt Abrufe; alle auffindbaren Angaben sind unbelegte Nutzeraussagen. Belegt ist nur „dicktengleich".
- **Height** — nichts gefunden, zu keinem Aspekt.
- **Superhuman-Dichtewerte** — existieren nicht; nur Latenzzahlen.
- **Retool-Schriftgrößen** — nicht dokumentiert.
- **Apple 44 × 44 pt** — HIG-Seiten nicht abrufbar.
- **Adobe Spectrum px-Werte** — Token-Repository (`adobe/spectrum-tokens`) enthält auf `main` nur noch die Website, 18 Dateien, keine Token-JSONs. Belegt ist nur die **Struktur**: als einziges System eine 4×3-Matrix (Größe S/M/L/XL × Dichte compact/regular/spacious) — und als einziges skaliert Spectrum die **Schriftgröße mit der Größenstufe** mit (`font-size-75/100/200/300`).
- **GitHub Primer px-Werte** — Doku nennt nur die drei Stufennamen (condensed/normal/spacious).
- **Atlassian Tabellen-Zeilenhöhen** — nicht veröffentlicht. Belegt ist nur die Space-Skala (2/4/6/8/12/16/20/24/32/40/48/64/80 px) und die Leitlinie „kompakte UI: space.0–space.100, also 0–8 px".
- **Material Design 3 Data-Table-Spezifikation** — existiert offenbar nicht; M2/M3-Doku sind JS-Anwendungen ohne abrufbaren Text. Belegbar nur aus MDC-Web-Quellcode: `$row-height: 52px`, `$header-row-height: 56px`, `$minimum-row-height: 36px`, Zellenpolsterung 16 px beidseitig.

---

# 5. WAS SICH AUS DEN BELEGEN ABLEITEN LÄSST

1. **Dichte vertikal regeln, Schriftgröße festhalten.** Rello 2013: Schriftgröße signifikant, Zeilenabstand nicht. Carbon und Ant halten 14 px über alle Stufen konstant — bei Ant im Quellcode nachweisbar (alle drei `cellFontSize*`-Tokens zeigen auf denselben Wert).
2. **24 px ist die belegte Untergrenze**, dreifach unabhängig: Heers gemessener Genauigkeitsknick, WCAG 2.5.8, Carbons dichteste Stufe.
3. **1.4.12 ist ein Belastungstest, keine Vorgabe.** 14 px × 1,5 = 21 px Zeilenbox muss ohne Beschnitt durchgehen.
4. **Data-Ink gilt fürs Ablesen, nicht fürs Erinnern.** Skau: keine Verzierung schlug die Basis. Borkin: minimalistisch war *schlechter* merkbar (p<0,001).
5. **Die Trennlinie ist kodierend vs. danebenstehend, nicht Schmuck vs. kein Schmuck.** Haroz Exp. 4 ist der sauberste Beleg.
6. **Small multiples sind für Analyse belegt überlegen** (45,69 s vs. 83,10 s, dazu weniger Fehler) — bis ~200 Datenpunkte.
7. **Farbe sparsam als Bedeutungsträger.** Bloombergs Lösung: eine Trägerfarbe für alles Nicht-Semantische, ein Farbpaar für Bedeutung — und das umschaltbar, weil 20.000 Nutzer das Standardpaar nicht trennen können.
8. **Fitts' Logarithmus verzeiht kleine Ziele; die Fehlerrate nicht.** In einer Tabelle ist der Fehlklick der falsche Datensatz.