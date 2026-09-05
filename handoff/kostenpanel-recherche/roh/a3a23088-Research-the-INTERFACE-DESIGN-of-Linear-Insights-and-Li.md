# AUFTRAG

Research the INTERFACE DESIGN of Linear Insights (and Linear's dashboards / analytics). I care about visual/interaction design and information density, NOT project management as a subject.

Use WebSearch and WebFetch. Start with:
- https://linear.app/docs/insights
- https://linear.app/docs/dashboards (if it exists)
- https://linear.app/changelog — search for "Insights", "dashboards", "analytics" release posts
- https://linear.app/blog posts about Insights
- Linear's "method" pages if they discuss the UI

Answer these SPECIFIC questions, each backed by a URL. Write "nicht belegt" if not documented — do NOT guess:
1. Which chart types does Insights offer (bar, line, stacked bar, burn-up/burndown, cumulative flow, pie/donut, heatmap, table)? Name them exactly as the docs name them.
2. Grouping / "slice by": which dimensions can you group by? Can you nest two dimensions (group + stack)? What is the exact UI vocabulary (e.g. "Slice by", "Group by", "Measure")?
3. Which measures/metrics are selectable (count, estimate/points, cycle time, ...)?
4. Are there summary/header tiles with a single number, and do they carry a delta vs previous period or a sparkline?
5. Time axis: granularity options, and can you compare to a previous period?
6. Tooltip on hover: single series or all series in the stack?
7. Drill-down: can you click a bar/segment to get the underlying issue list? Legend click to isolate?
8. Density: how many charts per dashboard, grid layout, resizable tiles?
9. Incomplete/

---

# Linear Insights & Dashboards — Interface-Recherche

Primärquellen: **Docs-Volltext** von `https://linear.app/docs/insights` und `https://linear.app/docs/dashboards` wurden komplett abgerufen (Wortlaut-Zitate unten). Ergänzt durch zwei Blog-Artikel (`/now/dashboards-best-practices`, `/now/commure-dashboards`). Der Changelog liefert **keinen** dedizierten Launch-Post für "Dashboards" oder "Insights" (mehrfach geprüft — nur Nebenerwähnungen wie Performance-Fixes für "insights queries").

Hinweis zur Beweisart: Ich habe die Seiten per Fetch (Text/HTML) gelesen, nicht als gerendertes Bild gesehen. Wo eine Seite Screenshots enthält, stütze ich mich auf Alt-Text/Bildunterschriften, die mir im Fetch zurückkamen — das kennzeichne ich als (c), nicht als direkt von mir visuell verifiziert.

---

**1. Chart-Typen**
Insights-Doku nennt exakt drei: **"Bar"** (Balken, für Issue count/Effort), **"Scatterplot"** (für Cycle Time, Lead Time, Triage Time, Issue Age) und **"Burn-up charts, or cumulative flow diagrams"**. Dazu immer eine begleitende **Tabelle** unter dem Graphen. Dashboards-Doku nennt zusätzlich **"metric blocks"** (Einzelzahl-Kacheln) als dritten Anzeigetyp, wortwörtlich: "charts, metric blocks, and tables". Kein Pie/Donut, kein explizit benanntes Heatmap, keine "stacked bar" als eigener Typ (Balken + Segment-Farbe übernimmt diese Funktion).
Beweis: (a) Doc-Prosa — https://linear.app/docs/insights, https://linear.app/docs/dashboards

**2. Gruppierung / "Slice by"**
Exakte UI-Begriffe: **"Measure"** (y-Achse), **"Slice"** (x-Achse), **"Segment"** (optionale Farb-Dimension, Zitat: "Segments are optional and use color to slice the data further"). Also ja — zwei Dimensionen kombinierbar (Slice + Segment). Welche konkreten Werte (Assignee, Team, Projekt, Label...) wählbar sind, wird NICHT enumeriert — Doku sagt nur: "Values for Measure, Slice, and Segment vary depending on what issues are displayed in your view." Es gibt kein "Group by" als eigenständigen Begriff — das entspricht "Slice".
Beweis: (a) Doc-Prosa — https://linear.app/docs/insights

**3. Messgrößen**
Exakt sechs, mit zugehörigem Standard-Charttyp (aus der Doku-Tabelle): **Issue count** (Bar), **Effort** = "Total estimate value" (Bar), **Cycle Time** (Scatterplot), **Lead Time** (Scatterplot), **Triage Time** (Scatterplot), **Issue Age** (Scatterplot).
Beweis: (a) Doc-Prosa — https://linear.app/docs/insights

**4. Summary-/Header-Kacheln mit Einzelzahl, Delta, Sparkline**
Ja für "metric blocks" (Dashboards-Doku, reine Existenzangabe, keine Delta/Sparkline-Erwähnung dort). Delta/Sparkline-Verhalten steht NICHT in der Doku, sondern nur im Blogpost zu Dashboard-Best-Practices: dort wird empfohlen, jede Kennzahl **"with a simple chart showing this week, last week, and trailing highs and lows"** zu koppeln — das ist eine Empfehlung/Praxis-Beispiel, keine dokumentierte Pflichtfunktion der UI, und die Doku selbst nennt weder "delta" noch "sparkline" als Begriff.
Beweis: (a) Doc-Prosa nur für Existenz von "metric blocks" (https://linear.app/docs/dashboards); (c) Marketing-Blogpost für Delta/Sparkline-Muster — https://linear.app/now/dashboards-best-practices

**5. Zeitachse: Granularität & Periodenvergleich**
Nur für Burn-up-Charts dokumentiert: **"By default, burn-up charts show data in monthly increments. Adjust insights settings to plot the data week over week"** — also Monat/Woche umschaltbar. Für Bar/Scatterplot wird keine Granularität erwähnt (die x-Achse ist dort "Slice", kein Zeitraster per se). Ein "Vorperiode vergleichen"-Feature ist in der Doku **nicht belegt** — nur im Blogpost als Gestaltungsempfehlung ("this week, last week, and trailing highs and lows"), nicht als dokumentiertes UI-Steuerelement.
Beweis: (a) Doc-Prosa für Burn-up-Granularität — https://linear.app/docs/insights; "nicht belegt" für Periodenvergleich als Feature

**6. Tooltip bei Hover: eine Serie oder alle Serien im Stack**
Doku beschreibt nur allgemein: "Hover over each bar to see data and percentile breakdowns" (Bar) bzw. "Hover over the graph to see markers indicating that the data below the line represents 25%, 50%, 75%, and 95% of issues plotted" (Scatterplot) bzw. "Hover over points to see the issue details including the issue name, ID, and slice and segment values." Ob bei einem gesegmenteten (mehrfarbigen) Balken der Tooltip alle Segmentwerte gleichzeitig oder nur das gehoverte Segment zeigt, wird **nicht spezifiziert** — "nicht belegt".
Beweis: (a) Doc-Prosa (allgemein) — https://linear.app/docs/insights; Detailfrage "alle Serien vs. eine" = nicht belegt

**7. Drill-down & Legend-Klick**
Ja, klar belegt: **"Select full bars or segments to temporarily filter your view to only those issues"**, **"Select points to go to open the related issue"** (Scatterplot), und für Dashboards: **"click any slice or metric to open a filtered view of the underlying issues."** Ein Klick isoliert also die zugrunde liegende Issue-Liste. Zusätzlich: Hover/Selektion auf Balken/Punkten hebt korrespondierende Zeilen in der Tabelle darunter hervor (bidirektional, auch umgekehrt: Tabellenzeile hovern hebt Graph hervor). Ein separates **"Legend"-Element mit eigenem Klick-zum-Isolieren** wird nirgends benannt — die Segment-Legende scheint über die Balkensegmente selbst zu funktionieren, nicht über eine externe Legende-Liste. "Legend-Klick" als eigenständiges UI-Element: **nicht belegt**.
Beweis: (a) Doc-Prosa — https://linear.app/docs/insights, https://linear.app/docs/dashboards

**8. Dichte: Charts pro Dashboard, Grid, resizierbare Kacheln**
Doku sagt nur: "Combine charts, metric blocks, and tables in a single layout" — keine Zahl, kein Grid-System, keine Resize-Mechanik dokumentiert. Blogpost (Best Practices) zeigt als Beispiel ein Matrix-Layout: **"Each column represents an org (Sales, GTM, Data, Product), and each row shows burn-up, new issues, and completed issues"** — also ein Spalten-×-Zeilen-Raster, aber ohne technische Grid-/Resize-Spezifikation. Derselbe Post nennt als Fakt: **Median-Workspace hat nur zwei Dashboards** (Adoption sinkt danach deutlich) — das ist eine Nutzungsstatistik, keine UI-Beschreibung. Exakte Kachelgröße/Resizability: **nicht belegt**.
Beweis: (a) Doc-Prosa (nur "single layout", keine Details) — https://linear.app/docs/dashboards; (c) Marketing-Blogpost fürs Matrix-Beispiel und die "zwei Dashboards"-Statistik — https://linear.app/now/dashboards-best-practices

**9. Unvollständige/laufende Periode (aktuelle Woche/aktueller Cycle)**
Keine Erwähnung einer speziellen Darstellung (gestrichelte Linie, Schraffur, "in progress"-Markierung) für die laufende Periode in Insights- oder Dashboards-Doku. **Nicht belegt.**

**10. Empty State / "keine Daten"**
Keine Erwähnung einer Empty-State-Meldung oder ihres Wortlauts in beiden Doku-Seiten oder den beiden Blogposts. **Nicht belegt.**

---

### Ergänzende Fundstellen (nicht direkt Kern-UI, aber Kontext)
- Insights-Zugriff: Panel über `Cmd/Ctrl Shift I`, in Custom Views, Team-/Projekt-/Cycle-Views; volle Power in Workspace-weiten Custom Views mit Cross-Team-Filtern (Label/Assignee/Project) — https://linear.app/docs/insights
- Filter speziell für Insights: Created at, Completed at, Status Type (teamübergreifend normalisiert), Label/Project/Team, Toggle für "Show archived issues" und Ausschluss von Issues ohne Priorität — https://linear.app/docs/insights
- Sharing: Link kopieren (workspace-intern sichtbar) oder CSV-Export; "Full Screen view" über Expand-Button — https://linear.app/docs/insights
- Dashboards: zweistufige Filter (Dashboard-Level global + Insight-Level lokal), "saved filters"-Button blendet globale Filter nur optisch aus (wirkt weiter), Kontextmenü mit Owner-Wechsel, "Move to…" (Team/Workspace/Personal), "Refresh data"; private Teams standardmäßig nicht in Workspace-Dashboards enthalten — https://linear.app/docs/dashboards
- Verfügbarkeit: Insights ab Business-Plan, Dashboards nur Enterprise-Plan — https://linear.app/docs/insights, https://linear.app/docs/dashboards

### Nicht verfügbare Recherchewege
Die WebSearch-Quote der Session war bereits verbraucht (200/200) — ich konnte keine weiteren gezielten Suchanfragen (z. B. gezielt nach dem Dashboards-Launch-Changelog-Post oder weiteren Blogposts) stellen und musste mich auf WebFetch auf bekannte/erratene URLs beschränken. Ein dedizierter Changelog-Launchpost für "Dashboards" wurde dabei nicht gefunden.

Sources:
- [Linear Docs — Insights](https://linear.app/docs/insights)
- [Linear Docs — Dashboards](https://linear.app/docs/dashboards)
- [Linear Changelog](https://linear.app/changelog)
- [Linear Blog list](https://linear.app/blog)
- [Best practices for designing Linear Dashboards](https://linear.app/now/dashboards-best-practices)
- [How Commure uses Dashboards to track performance and guide planning](https://linear.app/now/commure-dashboards)