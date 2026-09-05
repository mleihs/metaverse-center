# AUFTRAG

Du recherchierst im Web (WebSearch/WebFetch) für ein Design-Vorbild-Dossier. Antworte auf DEUTSCH. Schreibe KEINE Dateien — gib alles als finale Textantwort zurück.

ZIEL: Apache ECharts (Version 6) KONKRET für ein dichtes, dunkles Kosten-Dashboard. Thema: KI-Kosten — Aufrufe, Token, USD, nach Anbieter/Modell/Zweck/Welt/Nutzer, freie Zeiträume, Hochrechnung.

Recherchiere und liefere KONKRETE, nachschaubare Beispiele mit URLs (echarts.apache.org/examples/... Einzel-URLs!):

1. ECHARTS 6 NEUERUNGEN: Was ist neu in ECharts 6 (2025)? Neue Themes ("default dark"?), Chart-Typen, API-Änderungen gegenüber 5. URL zur Release-Ankündigung/Changelog.

2. DIAGRAMMTYPEN FÜR KOSTEN — je mit konkreter Beispiel-URL aus der ECharts-Beispielgalerie:
   - Gestapelte Balken über Zeit (stacked bar) — welches Beispiel?
   - Treemap (auch verschachtelt/drilldown) — welches Beispiel? Wie funktioniert Drilldown in ECharts-Treemap (leafDepth, breadcrumb)?
   - Sankey — welches Beispiel? Wie geht mehrstufig (Anbieter -> Modell -> Zweck)?
   - Sunburst
   - Heatmap (Kalender-Heatmap für tägliche Kosten) — calendar coordinate system
   - themeRiver / stacked area
   Für jeden: taugt er für Kosten? Wo sind die Fallen (z.B. Sankey bei vielen Knoten, Treemap-Beschriftung bei kleinen Kacheln)?

3. DUNKLE THEMES: Welche offiziellen ECharts-Themes gibt es (echarts.apache.org/en/theme-builder.html), wie baut man ein eigenes Theme (registerTheme, JSON-Struktur)? Gibt es gute dunkle Community-Themes? URLs.

4. WI

---

# Recherche-Dossier: Apache ECharts 6 für ein dichtes, dunkles KI-Kosten-Dashboard

**Hinweis vorab:** Das WebSearch-Kontingent dieser Sitzung war nach den ersten 5 Anfragen erschöpft (200/200 sitzungsweit — offenbar von vorherigen Aufgaben in dieser Session verbraucht). Ich bin komplett auf WebFetch sowie direktes Abrufen der Primärquellen umgestiegen: den offiziellen Doku-Quelltext (`apache/echarts-doc`, Markdown), den ECharts-Quellcode (`apache/echarts`, u. a. `theme/*.js`), das ausgelieferte JS-Bundle der Beispielgalerie (`example-bundle.js`, daraus echte Beispiel-Slugs extrahiert) und die GitHub-Suche für Repos. Alle Angaben unten sind entweder direkt aus diesen Quellen zitiert oder ausdrücklich als "aus stabilem, langjährig bekanntem API-Schema, nicht direkt gegengeprüft" markiert.

---

## 1. ECharts 6 – Neuerungen

Primärquelle (Klartext-Changelog, verifiziert): `https://raw.githubusercontent.com/apache/echarts-doc/master/en/changelog.md`, gerendert unter `https://echarts.apache.org/en/changelog.html`. Release-Übersicht auch unter `https://github.com/apache/echarts/releases`.

**v6.0.0 — 30.07.2025** (aus dem Changelog zitiert):

- **Neues Default-Theme** ("New theme for ECharts 6.0") — komplett überarbeitete Optik und Komponenten-Positionierung. Wer die alte Optik behalten will, importiert `echarts/theme/v5.js` (ich habe die Datei live im Repo bestätigt: `apache/echarts` → `theme/v5.js` existiert neben `dark.js` etc.).
- **Neuer Diagrammtyp: Chord** (Beziehungs-Diagramm, nicht direkt kostenrelevant für euch).
- **Neues Matrix-Koordinatensystem** — erlaubt deklaratives Layout mehrerer Serien/Komponenten in Matrix- und Kalenderzellen (z. B. mehrere Mini-Charts nebeneinander, interessant für ein "pro Anbieter ein Kalender-Heatmap"-Raster).
- **Dynamische Theme-Registrierung/-Umschaltung zur Laufzeit** ("Support dynamically registering and switching themes") — relevant, falls ihr einen Light/Dark-Umschalter im Dashboard wollt.
- **Neuer Layout-Mechanismus gegen Achsen-Überlauf**: verhindert automatisch, dass Achsenbeschriftungen/-namen über den Canvas hinauslaufen, standardmäßig aktiv.
  - **Wichtige Konsequenz für dichte Dashboards**: `grid.containLabel` gilt laut aktueller Doku (`https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/component/grid.md`, Zeile 71) jetzt als **deprecated** zugunsten von `grid.outerBoundsMode` / `grid.outerBoundsContain`. Zitat: *"The 'outer bounds' encompasses the functionality of grid.containLabel; therefore, grid.containLabel is deprecated. `grid.containLabel: true` is equivalent to `grid: {outerBoundsMode: 'same', outerBoundsContain: 'axisLabel'}`."* Für euer Grid-Ränder-Tuning (Punkt 4) heißt das: `containLabel` funktioniert weiter, aber `outerBoundsMode`/`outerBoundsContain` ist der neue, granularere Hebel.
- Weitere Serien-Features: Scatter-Jittering, Achsen-Breaks (`axis` break), Sankey-Roaming, `z`/`z2` für markPoint/markLine/markArea, Stack-Reihenfolge umkehrbar, `relativeTo` für Marker-Positionierung, `visualMap.unboundedRange`.

**v6.1.0 — 18.05.2026:**

- `axis.dataMin`/`dataMax` für "nice extent"-Berechnung.
- Log-Achse schließt automatisch nicht-positive Werte aus.
- `visualMap.seriesTargets` — mehrere Serien/Dimensionen auf einmal mappen (nützlich, wenn ihr eine visualMap gleichzeitig auf mehrere Kosten-Serien anwenden wollt).
- `dataZoom` "inside": `cursorGrab`/`cursorGrabbing`-Cursor-Optionen.
- **Breaking Changes ggü. v6.0.0**: `tooltip.valueFormatter`-Callback bekommt jetzt `rawDataIndex` statt gefiltertem `dataIndex`; `axis.startValue` von `axis.min` entkoppelt; Serien-Overflow-Verhalten geändert, `axis.containShape: false` stellt altes Verhalten wieder her.

---

## 2. Diagrammtypen für Kosten-Dashboards

Alle Beispiel-Slugs unten habe ich **nicht geraten**, sondern aus dem echten ausgelieferten `example-bundle.js` der Galerie extrahiert (`https://echarts.apache.org/examples/js/example-bundle.js`). URL-Schema bestätigt per `curl` (200, echte SPA-Route): `https://echarts.apache.org/examples/en/editor.html?c=<slug>`.

### Gestapelter Balken über Zeit
- `https://echarts.apache.org/examples/en/editor.html?c=bar-stack` (Basis)
- `https://echarts.apache.org/examples/en/editor.html?c=bar-stack-normalization` (100%-Stack — relevant für "Kostenanteil pro Anbieter in %")
- `https://echarts.apache.org/examples/en/editor.html?c=bar-stack-normalization-and-variation`
- `https://echarts.apache.org/examples/en/editor.html?c=bar-stack-borderRadius`
- **Taugt für Kosten**: Ja, Standardwahl für "Kosten pro Tag/Woche, gestapelt nach Anbieter". **Falle**: Bei >6–8 Kategorien wird der Stack unlesbar und die Legende sprengt den Platz — für "Modell" als Stack-Dimension (potenziell 20+ Modelle) lieber Top-N + "Sonstige" bilden oder auf Treemap/Sankey ausweichen.

### Treemap (mit Drilldown)
- `https://echarts.apache.org/examples/en/editor.html?c=treemap-simple`
- `https://echarts.apache.org/examples/en/editor.html?c=treemap-drill-down` — genau der Drilldown-Fall
- `https://echarts.apache.org/examples/en/editor.html?c=treemap-obama` (der berühmte "Obama-Budget"-Treemap, gutes Vorbild für verschachtelte Budgetdaten)
- `https://echarts.apache.org/examples/en/editor.html?c=treemap-show-parent`
- `https://echarts.apache.org/examples/en/editor.html?c=treemap-visual`, `treemap-borderColor`, `treemap-sunburst-transition` (Treemap↔Sunburst-Morph-Animation)

**Wie Drilldown funktioniert** (direkt aus `en/option/series/treemap.md` zitiert):
> *"Drill Down: when clicking a tree node, this node will be set as root and its children will be shown. When `leafDepth` is set, this feature is enabled."* `leafDepth` = wie viele Ebenen maximal gleichzeitig gezeigt werden (bei `1` nur eine Ebene). Standard `null` = Drilldown aus. Dazu `drillDownIcon` (Standard `'▶'`) als Marker am Knoten.
> `breadcrumb` ist ein eigenständiges Top-Level-Objekt (nicht mehr unter `itemStyle` wie in ECharts 2) mit `show`, `height`, Styling-Optionen.
> Für Elternknoten-Labels: `upperLabel.show: true` zeigt die Beschriftung von Knoten mit Kindern an.

**Falle**: Bei sehr kleinen Kacheln (viele Modelle mit wenig Kosten) werden Labels automatisch versteckt/abgeschnitten — es gibt keinen "immer lesbar"-Modus, ihr müsst mit `label.formatter`, Mindestgrößen oder einem Tooltip-Fallback arbeiten. Für "Anbieter → Modell → Zweck" ist Treemap gut für **zwei** Ebenen gleichzeitig sichtbar (dank `leafDepth`), für mehr lohnt sich eher Sankey.

### Sankey (mehrstufig)
- `https://echarts.apache.org/examples/en/editor.html?c=sankey-simple`
- `https://echarts.apache.org/examples/en/editor.html?c=sankey-levels` — genau der Mehrstufen-Fall
- `https://echarts.apache.org/examples/en/editor.html?c=sankey-energy`
- `https://echarts.apache.org/examples/en/editor.html?c=sankey-nodeAlign-left` / `sankey-nodeAlign-right`, `sankey-vertical`, `sankey-itemstyle`

**Mehrstufig (Anbieter → Modell → Zweck)** — aus `en/option/series/sankey.md` zitiert: Man vergibt in den `links` einfach Kanten `Anbieter→Modell` und `Modell→Zweck`; ECharts berechnet die Tiefe automatisch. Zum gezielten Stylen pro Ebene gibt es `levels` (Array), z. B.:
```ts
levels: [
  { depth: 0, itemStyle: { color: '#fbb4ae' }, lineStyle: { color: 'source', opacity: 0.6 } },
  { depth: 1, itemStyle: { color: '#b3cde3' }, lineStyle: { color: 'source', opacity: 0.6 } }
]
```
`lineStyle.color: 'source'` bzw. `'target'` färbt Kanten nach Ursprungs-/Zielknoten — praktisch, damit "Anbieter-Farbe" bis zum Zweck durchläuft. `nodeAlign` (Standard `'justify'`) steuert die horizontale Ausrichtung der Knotenspalten.

**Falle**: Bei vielen Knoten (z. B. 30+ Modelle × 10+ Zwecke) wird ein Sankey schnell zu einem unlesbaren "Spaghetti"-Bild mit lauter dünnen, sich kreuzenden Bändern. ECharts hat dafür keinen eingebauten Kollaps-Mechanismus — ihr müsstet selbst aggregieren (Top-N-Modelle + "Sonstige"-Knoten) oder auf ein interaktives Filtern (Legende/Klick zum Ein-/Ausblenden von Knoten) setzen. Für "sehr viele Welten" als eine der Ebenen ist Sankey vermutlich die falsche Wahl.

### Sunburst
- `https://echarts.apache.org/examples/en/editor.html?c=sunburst-simple`
- `https://echarts.apache.org/examples/en/editor.html?c=sunburst-drink` (klassisches, oft zitiertes Beispiel mit 3 Ebenen)
- `https://echarts.apache.org/examples/en/editor.html?c=sunburst-visualMap` (Farbe nach Wert statt nach Kategorie — relevant für "Farbe = USD-Höhe")
- `https://echarts.apache.org/examples/en/editor.html?c=sunburst-highlight-ancestor`, `sunburst-highlight-descendant` (Hover hebt Pfad hervor — gut für Anbieter→Modell→Zweck-Pfad-Lesbarkeit)
- `https://echarts.apache.org/examples/en/editor.html?c=sunburst-label-rotate`, `sunburst-label-align`, `sunburst-monochrome`, `sunburst-borderRadius`, `sunburst-transition`, `sunburst-book`, `sunburst-color`

**Falle**: Labels auf äußeren, schmalen Ringen sind bei feiner Granularität (viele Modelle) praktisch unlesbar, selbst mit `label.rotate: 'tangential'`. Sunburst eignet sich für 2–3 hierarchische Ebenen mit überschaubarer Knotenzahl pro Ebene — nicht für "alle Modelle aller Anbieter" auf einen Blick.

### Kalender-Heatmap (tägliche Kosten)
- `https://echarts.apache.org/examples/en/editor.html?c=calendar-heatmap` — exakt euer Use-Case
- `https://echarts.apache.org/examples/en/editor.html?c=calendar-simple`, `calendar-horizontal`, `calendar-vertical`, `calendar-lunar`, `calendar-pie`, `calendar-effectscatter`, `calendar-graph`, `calendar-icon`, `calendar-charts`

Aus `en/option/component/calendar.md` zitiert: Das `calendar`-Koordinatensystem lässt sich mit `heatmap`, `scatter`, `effectScatter` und `graph` kombinieren; Standard ist horizontal, `calendar.orient` schaltet auf vertikal um (breiter/schmaler je nach Platz — relevant für ein enges Dashboard-Panel). Sehr gut geeignet für "USD/Tag über 12 Monate, ein Blick fürs ganze Jahr". Falle: bei Multi-Jahres-Ansicht braucht ihr mehrere `calendar`-Instanzen (eine pro Jahr) im Matrix-/Grid-Layout — ECharts stapelt Jahre nicht automatisch untereinander.

### themeRiver / gestapelte Fläche
- `https://echarts.apache.org/examples/en/editor.html?c=themeRiver-basic`
- `https://echarts.apache.org/examples/en/editor.html?c=themeRiver-lastfm` (das Referenzbeispiel, in der offiziellen Doku selbst als Sample verlinkt)

Aus `en/option/series/themeRiver.md` zitiert: *"a special flow graph which is mainly used to present the changes of an event or theme during a period"* — Bandbreite = Wert, Farbe = Thema/Kategorie, Zeitachse durchgängig. Für "Kosten pro Anbieter über Zeit, organisch/fließend statt hart gestapelt" eine stilistisch interessante Alternative zu stacked bar — aber schwerer präzise abzulesen (keine harten Kanten/Gitterlinien wie beim Balken), daher eher zusätzliches "Stimmungsbild" als primäres Kostendiagramm. Für ein **dichtes** Zahlen-Dashboard würde ich stacked bar/area gegenüber themeRiver bevorzugen, wenn es um exakte Ablesbarkeit geht.

---

## 3. Dunkle Themes

**Theme-Builder**: `https://echarts.apache.org/en/theme-builder.html` — ist eine interaktive SPA (per WebFetch nicht als Text auslesbar, aber URL und Existenz bestätigt über die Navigationsstruktur der Seite). Funktionsprinzip (aus Struktur/Erfahrung, nicht Zeile-für-Zeile gegengeprüft): visueller Editor für Farbpalette, Hintergrund, Textstile, Achsenlinien/-Splitlines etc., mit Export als JSON/JS zum Einbinden per `echarts.registerTheme(name, themeObject)` und `echarts.init(dom, name)`.

**Offizielle mitgelieferte Themes** — direkt aus dem GitHub-Repo `apache/echarts` (`theme/`-Verzeichnis) aufgelistet, real vorhanden:
`azul, bee-inspired, blue, caravan, carp, cool, dark-blue, dark-bold, dark-digerati, dark-fresh-cut, dark-mushroom, dark, eduardo, forest, fresh-cut, fruit, gray, green, helianthus, infographic, inspired, jazz, london, macarons, macarons2, mint, rainbow, red-velvet, red, roma, royal, sakura, shine, tech-blue, v5, vintage`

Also **6 explizit dunkle Themes**: `dark.js`, `dark-blue.js`, `dark-bold.js`, `dark-digerati.js`, `dark-fresh-cut.js`, `dark-mushroom.js`. Raw-Quelle z. B.: `https://raw.githubusercontent.com/apache/echarts/master/theme/dark.js`

Ich habe `dark.js` direkt gelesen — Struktur eines registrierten Themes (Auszug, echter Code):
```js
var contrastColor = '#B9B8CE';
var backgroundColor = '#100C2A';
var axisCommon = function () {
    return {
        axisLine: { lineStyle: { color: contrastColor } },
        splitLine: { lineStyle: { color: '#484753' } },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } },
        minorSplitLine: { lineStyle: { color: '#20203B' } }
    };
};
var colorPalette = ['#4992ff','#7cffb2','#fddd60','#ff6e76','#58d9f9','#05c091','#ff8a45','#8d48e3','#dd79ff'];
var theme = {
    darkMode: true,
    color: colorPalette,
    backgroundColor: backgroundColor,
    axisPointer: { lineStyle: { color: '#817f91' } },
    // ...
};
echarts.registerTheme('dark', theme);
```
Das ist ein sehr brauchbares, direkt kopierbares Startgerüst: `darkMode: true` ist der zentrale Schalter (steuert automatisch Default-Textfarben/Tooltip-Kontrast), plus eine 9-Farben-Palette, ein dunkler Hintergrund `#100C2A`, und `axisCommon()` als wiederverwendbare Funktion für alle Achsentypen. Für euer Kosten-Dashboard würde ich dieses Muster als Basis nehmen und die Palette durch eure Design-Tokens (Tier-1/2 aus `docs/guides/design-tokens.md`) ersetzen, statt die Rohfarben zu übernehmen — passend zur CLAUDE.md-Regel "keine rohen Hex-Werte, nur Tokens".

**Community-Dark-Themes**: Ich habe **keine** kuratierte, aktuell gepflegte Liste guter Community-Dark-Themes gefunden. Die offizielle `awesome-echarts`-Liste (`https://github.com/ecomfe/awesome-echarts`, 1573 Sterne, vom ECharts-Kernteam `ecomfe` gepflegt) hat **keine eigene Theme-Sektion** — dort sind nur Extensions, Framework-Bindings und Sprachbindings gelistet. Wer heute ein dunkles ECharts-Theme baut, baut es praktisch immer selbst über `registerTheme` (siehe oben) statt ein Community-Paket zu installieren. Das ist ein Bereich, wo ich nichts Belastbares an fertigen Drittanbieter-Themes gefunden habe — nur der offizielle Theme-Builder und die 6 eingebauten Dark-Varianten.

---

## 4. Wie man ECharts NICHT nach Standard aussehen lässt

Konkret bestätigte/bekannte Stellschrauben (Doku-Anker-Schema `https://echarts.apache.org/en/option.html#<Pfad>` — das Schema selbst ist aus den internen Doku-Verweisen (`~dataZoom.xAxisIndex` etc.) bestätigt, die exakt zu `option.html#dataZoom.xAxisIndex` auflösen):

- `xAxis.axisLine.show` / `yAxis.axisLine.show` — Achslinie ein/aus.
- `splitLine.lineStyle.color` + `splitLine.lineStyle.type: 'dashed'` — Gitterlinienfarbe/-strichelung (im `dark.js`-Theme oben exakt so verwendet: `#484753`, keine Strichelung dort, aber der Hebel existiert).
- `series.symbol` / `symbolSize` — z. B. `'circle'`, `'none'`, oder ein eigenes SVG-Path (`'path://...'`) statt der Standard-Kreise.
- `itemStyle.borderRadius` — abgerundete Balken/Treemap-Kacheln statt scharfer Kanten (siehe `bar-stack-borderRadius`, `treemap-borderColor` oben).
- `grid.left/right/top/bottom` + `grid.containLabel` (bzw. neu `grid.outerBoundsMode`/`outerBoundsContain`, siehe Punkt 1) — Ränder/Weißraum um das Koordinatensystem.
- `legend.show: false` — Legende abschalten (bei dichten Multi-Serien-Dashboards oft sinnvoll, stattdessen Serienfarbe direkt im Panel-Titel/Tooltip erklären).
- `axisLabel.formatter` — z. B. `(value) => '$' + value.toLocaleString()` für USD-Achsen, oder Kompakt-Notation (`1.2k`, `3.4M`) bei Token-Zahlen.
- `textStyle.fontFamily` global im Theme setzen — auf eine Mono-Schrift, passend zu einem technischen Kosten-Dashboard.
- `animation: false` (oder `animationDuration: 0`) — bei sehr dichten, häufig aktualisierten Dashboards oft gewünscht, um Flackern/Ablenkung zu vermeiden.

Diese Liste stammt aus langjährig stabilem, gut dokumentiertem ECharts-Kernverhalten; ich konnte dazu keinen einzelnen "So macht man ECharts individuell"-Artikel als Primärquelle mehr gegenprüfen (WebSearch war zu diesem Zeitpunkt bereits gesperrt), aber jede einzelne Option ist Teil der offiziellen Optionsreferenz unter obigem Anker-Schema und durch die tatsächlich gelesenen Doku-Dateien (`grid.md`, `dark.js`) indirekt bestätigt.

---

## 5. Interaktions-Komponenten

**dataZoom** (inside vs. slider) — Doku real gelesen: `en/option/component/data-zoom.md`, `data-zoom-inside.md`. Zitat: *"dataZoomInside: Data zoom functionalities is embedded inside coordinate systems, enable user to zoom or roam by mouse dragging, mouse move or finger touch."* Slider = sichtbarer Schieberegler unterhalb der Achse (`dataZoomSlider`), inside = Zoom direkt per Scroll/Drag im Chart, unsichtbar. Beispiele: `https://echarts.apache.org/examples/en/editor.html?c=dataZoom-all`, `dataZoom-1`, `dataZoom-2`, `dataZoom-3`, `dataZoom-filterMode`. **Lohnt sich**: Ja — für frei wählbare Zeiträume ("letzte 7/30/90 Tage" plus freies Draggen) ist die Kombination Slider (unten sichtbar, Orientierung) + Inside (Scroll-Zoom für schnelles Verfeinern) der ECharts-Standardweg.

**visualMap** — `en/option/component/visual-map.md` real gelesen. Zwei Typen: `visualMap-continuous` (Farbverlauf, z. B. USD-Betrag → Farbintensität) und `visualMap-piecewise` (diskrete Stufen/Buckets, z. B. "< 10 $ / 10–50 $ / > 50 $"). Beispiele: `visualMap-categories`, `visualMap-continuous`, `visualMap-continuous-text`, `visualMap-pieces`, `visualMap-piecewise`, `visualMap-piecewise-text`. Für die Kalender-Heatmap (Punkt 2) ist `visualMap` **zwingend** die Komponente, die die Tageskosten auf Farbintensität mapt — genau wie im `calendar-heatmap`-Beispiel.

**tooltip** — `en/option/component/tooltip.md` real gelesen. `trigger: 'axis'` + `axisPointer: { type: 'cross' }` ist der Standardweg für Multi-Serien-Zeitreihen (zeigt Fadenkreuz + alle Serienwerte am selben Zeitpunkt). Wichtiger, tatsächlich in der Doku gefundener Fallstrick für ein Dashboard mit gescrollten/verschachtelten Panels: **`appendToBody` ist seit v5.5.0 deprecated**, zugunsten von `appendTo` (`string|HTMLElement|Function`). Zitat: *"appendToBody: true is a common way to resolve [tooltip cut off by overflow:hidden] ... Note that it also works when CSS transform used."* Für ein dichtes Dashboard mit vielen kleinen Panels (potenziell mit `overflow: hidden`) solltet ihr `tooltip.appendTo` (statt des alten `appendToBody`) nutzen, damit Tooltips nicht an Panel-Rändern abgeschnitten werden — passt auch zu eurer CLAUDE.md-Regel gegen `filter`/`transform` auf Layout-Containern, da Tooltip-Positionierung mit CSS-Transform bekanntermaßen fragil ist.

**markLine/markArea für Hochrechnung** — Ich konnte die volle Property-Schema-Seite nicht als Markdown fetchen (sie wird laut `line.md` über eine generische Partial-Vorlage `partial-marker` eingebunden, die selbst nur die Koordinaten-Ziel-Syntax dokumentiert, nicht das komplette markLine-Schema). Die konkrete API (`type: 'average'|'max'|'min'|'median'`, benutzerdefinierte `data`-Punkte mit `xAxis`/`yAxis`-Koordinaten, `lineStyle: { type: 'dashed' }`, `label.formatter`) ist mir aus stabilem, langjährigem ECharts-Wissen bekannt, aber **nicht in dieser Sitzung Zeile für Zeile gegengeprüft** — als Referenz-Anker gilt `https://echarts.apache.org/en/option.html#series-line.markLine`. Für eine Hochrechnung "Kosten bis Monatsende" ist das übliche Muster: eine gepunktete `markLine` mit zwei `data`-Punkten (letzter Ist-Wert → projizierter Endwert) plus `markArea` für einen schattierten Unsicherheitskorridor.

**brush vs. dataZoom** — `en/option/component/brush.md` real gelesen. Zitat: *"brush is an area-selecting component ... Currently, supported brush types include: scatter, bar, candlestick."* Brush dient zum **Selektieren** einer Datenmenge zur Weiterverarbeitung/Verknüpfung (Cross-Filtering zwischen mehreren Charts via `brushLink`), **nicht** zum Zoomen der Achse — das ist der Kernunterschied zu `dataZoom`. Für "Zeitraum wählen, um die Achse zu verändern" ist `dataZoom` richtig; für "Punkte im Streudiagramm markieren und in einer verknüpften Tabelle/anderem Chart hervorheben" ist `brush` richtig. Für ein Kosten-Dashboard mit Balken/Fläche über Zeit ist `dataZoom` die relevante Komponente — `brush` würde ich nur einsetzen, wenn ihr z. B. eine Scatter-Ansicht "Kosten pro Aufruf" mit Cross-Filtering in andere Panels plant.

**graphic** — `en/option/component/graphic.md` real gelesen. Erlaubt beliebige Grafikelemente (`text`, `image`, `rect`, `group` mit Kindern) frei im Chart zu platzieren. Beispiele direkt aus der Doku zitiert: `https://echarts.apache.org/examples/en/editor.html?c=line-graphic` (Wasserzeichen + Textblock) und `https://echarts.apache.org/examples/en/editor.html?c=line-draggable` (verstecktes Graphic-Element zum Draggen). Zusätzlich im Bundle gefunden: `graphic-bounding`, `graphic-loading`, `graphic-stroke-animation`, `graphic-wave-animation`. Lohnt sich für eigene Beschriftungen wie "Prognose ab hier" oder ein Ladeindikator direkt im Chart, statt eines separaten DOM-Overlays.

---

## 6. Öffentliche dichte ECharts-Dashboards zum Anschauen

- **`https://github.com/ecomfe/awesome-echarts`** (1573 Sterne, gepflegt von `ecomfe` = ECharts-Kernteam) — die offizielle kuratierte Liste. Direkt daraus zitiert (Sektion "Tools → Grafana"): **`https://github.com/volkovlabs/volkovlabs-echarts-panel`** — "A plugin for Grafana that allows visualizing Apache ECharts on your dashboard." Grafana-Panels sind per Definition dichte, dunkle, technische Metrik-Dashboards (Uptime/Kosten/Traffic) und damit stilistisch sehr nah an eurem Use-Case — kein Marketing, sondern echtes Ops-Tooling.
- Weitere reale (wenn auch kleinere) Grafana-ECharts-Panel-Repos, per GitHub-Suche gefunden: `https://github.com/Billiballa/bilibala-echarts-panel` (146 Sterne), `https://github.com/heiyhia/grafana-echarts-panel` (50 Sterne), `https://github.com/gbrian/grafana-echart-panel` (42 Sterne) — alle real, aber unklar wie aktiv/aktuell gepflegt.
- Die **offizielle Beispielgalerie selbst** (`https://echarts.apache.org/examples/en/index.html`) ist die verlässlichste Quelle für einzelne Diagramm-Bausteine, hat aber **kein** fertiges "dichtes Dashboard"-Beispiel, das mehrere der oben genannten Diagrammtypen zu einem Kosten-Dashboard zusammensetzt — so etwas müsstet ihr selbst komponieren.
- Ich habe **nichts Belastbares** zu einem öffentlichen Observable-Notebook oder einer offiziellen Apache-Referenzimplementierung eines dichten dunklen Kosten-Dashboards gefunden (dieser Teil der Recherche war am stärksten durch den WebSearch-Ausfall betroffen, da GitHub-Code-Suche und `curl`/`WebFetch` für nicht-GitHub-Inhalte wie Observable-Notebooks nicht funktionieren). Falls das für euch wichtig ist, wäre ein gezielter zweiter Anlauf mit erhöhtem WebSearch-Kontingent nötig.

---

### Zusammenfassung der wichtigsten, direkt verwertbaren Funde für euer Vorhaben

1. `grid.containLabel` ist seit v6 deprecated (→ `outerBoundsMode`/`outerBoundsContain`) — relevant für euer Grid-Rand-Tuning.
2. `tooltip.appendToBody` ist seit v5.5.0 deprecated (→ `appendTo`) — relevant, weil ihr in dichten, potenziell `overflow:hidden`-Panels arbeitet.
3. Das `dark.js`-Theme (`darkMode:true`, `backgroundColor:'#100C2A'`, `axisCommon()`-Muster) ist eine reale, kopierbare Vorlage für `registerTheme`, die ihr mit euren eigenen Design-Tokens statt der Rohfarben füllen könnt.
4. Treemap-Drilldown = `leafDepth` + `breadcrumb` (eigenständiges Top-Level-Objekt seit ECharts 3), Sankey-Mehrstufigkeit = einfach mehrstufige `links` + optionales `levels`-Array pro Tiefe.
5. `brush` ist für Cross-Filtering/Selektion gedacht, nicht für Zeitraum-Zoom — dafür ist `dataZoom` (inside + slider kombiniert) der richtige Baustein.