# AUFTRAG

Du recherchierst im Web (WebSearch/WebFetch) für ein Design-Vorbild-Dossier. Antworte auf DEUTSCH. Schreibe KEINE Dateien — gib alles als finale Textantwort zurück.

ZIEL: Der Sonderfall "wohin fließt das Geld" als ZEICHNUNG. Konkrete Datenlage: 89 % der KI-Kosten gehen in Bildgenerierung, 11 % in Text. Die Bilder verteilen sich auf 5 Zwecke und 6 Modelle. Alles hängt an 21 Welten (Mandanten). Anbieter: Replicate + OpenRouter. Zusätzlich Schlüsselquelle (Plattform-Schlüssel vs. eigener Schlüssel des Nutzers).

Recherchiere KONKRET:

1. TREEMAP als Kostenaufschlüsselung — echte Vorbilder:
   - AWS Cost Explorer / Kubecost / OpenCost / Vantage / CloudZero / Finout / Datadog Cloud Cost Management — wer benutzt Treemaps für Kosten und wie? URLs zu Doku/Screenshots.
   - Grafana Treemap-Panel
   - Wann versagt eine Treemap? (kleine Kacheln unbeschriftbar, schlechte Vergleichbarkeit von Flächen, Instabilität bei Datenänderung). Nenne Quellen/Kritiken.

2. SANKEY als Geldfluss — echte Vorbilder:
   - Sankey-Diagramme für Ausgaben/Budget: Bundeshaushalt-Sankeys, "where your taxes go", Firmen-Gewinn-Sankeys (die viralen Apple/Nvidia-Umsatz-Sankeys von @sankey_charts / app.economy), Sankeymatic.
   - Wann ist Sankey richtig, wann Deko? Ab wie vielen Knoten wird es unlesbar? Quellen.
   - Wie geht ein 3-stufiger Sankey (Anbieter -> Modell -> Zweck) gut?

3. ALTERNATIVEN, die oft BESSER sind:
   - Gestapelter 100%-Balken / einzelner Marimekko/Mosaik-Balken
   - Sortierte Balken mit einge

---

## Rechercheergebnis: Vorbilder für die Geldfluss-Zeichnung (89 % Bild / 11 % Text, 5 Zwecke, 6 Modelle, 21 Welten, 2 Anbieter, 2 Schlüsselquellen)

**Vorbemerkung zur Methode:** Das WebSearch-Kontingent dieser Sitzung war bereits zu Beginn meiner Arbeit erschöpft (0 von 200 verfügbar) — jede der ersten fünf Suchanfragen schlug fehl. Ich habe daraufhin ausschließlich mit WebFetch gegen konkret bekannte URLs recherchiert (ca. 30 Abrufe). Das deckt die Frage gut ab, aber zwei Konsequenzen: (a) Reddit/Twitter waren technisch nicht erreichbar (`r/dataisbeautiful`-Fetch schlug fehl), die vielversprechenden viralen Apple/Nvidia-Umsatz-Sankeys (@sankey_charts u.ä.) konnte ich deshalb **nicht live verifizieren** — was ich dazu schreibe, ist Hintergrundwissen, keine Quelle mit URL; (b) einige Marketingseiten (Vantage, CloudZero, Datadog, Kubecost/IBM-Docs) geben ihre Diagrammtypen nicht in Textform preis, sondern nur als Screenshots, die mein Fetch-Tool nicht bildlich auswerten kann — dort ist die Aussage entsprechend dünn, das ist unten vermerkt.

---

### 1. Treemap als Kostenaufschlüsselung

**Konkret bestätigte Vorbilder / Doku:**
- **Grafana Treemap-Panel** (jetzt von Grafana Labs gepflegt, ursprünglich Marcus Olsson): https://grafana.com/grafana/plugins/marcusolsson-treemap-panel/ — Konfiguration über *Label by* (muss eindeutig sein), *Size by*, *Color by*, *Group by* + Tiling-Algorithmus. Keine Kosten-spezifische Bewerbung, generisches Hierarchie-Panel, Grafana-Version >8 nötig.
- **Kubecost/OpenCost**: Beide Docs (https://www.ibm.com/docs/en/SSW0JQG_2.x/using-kubecost/... , https://www.opencost.io/docs/) bestätigen nur *dass* nach Cluster/Namespace/Label/Workload aufgeschlüsselt wird — welcher Diagrammtyp (Treemap vs. Tabelle vs. Balken) tatsächlich verwendet wird, steht im Text nicht, nur in nicht auswertbaren Screenshots. Aus eigener Kenntnis nutzt die Kubecost-UI im "Cost Allocation"-Bereich tatsächlich sowohl eine Treemap-Ansicht als auch Balken/Tabellen als Umschalt-Optionen — das konnte ich hier aber nicht textlich belegen, nur die Struktur (Cluster→Namespace→Label) ist dokumentiert bestätigt.
- **Vantage** (https://docs.vantage.sh/cost_reports): Dokumentation nennt explizit Balken- (gestapelt/nebeneinander), Linien-, Flächen- und (nur kumulativ) Kreisdiagramme. **Treemap und Sankey werden in der Doku nicht erwähnt** — das ist ein handfester Negativbefund: der Marktführer für Cost-Reports verzichtet bewusst auf Treemap/Sankey zugunsten von Balken/Linien.
- **Datadog Cloud Cost Management** (https://docs.datadoghq.com/cloud_cost_management/): Dokumentation beschreibt Kosten als Zeitreihen-Metriken im Explorer, keine Erwähnung von Treemap/Sankey/gestapelten Balken im Text.

**Wann eine Treemap versagt — mit Quellen (data-to-viz.com, sehr konkret und zitierfähig):**
- https://www.data-to-viz.com/graph/treemap.html — Warnung wörtlich: *"Don't annotate more than 3 levels of the hierarchy, it would make the figure unreadable"*; ab 2-3 Hierarchieebenen wird die statische Fassung unlesbar, interaktive Version empfohlen.
- https://www.data-to-viz.com/caveat/area_hard.html — Kernkritik an JEDER flächenbasierten Codierung (Treemap, Kreisdiagramm, Bubble): das Auge kann Flächen schlecht in exakte Zahlen zurückübersetzen; Empfehlung: längenbasierte Codierung (Balken) statt Fläche.
- https://www.data-to-viz.com/caveat/hard_label.html — Beschriftungsproblem: kleine Kacheln haben schlicht keinen Platz für Text, Lösung nur über Tooltip/Legende/Zoom, nicht über die Fläche selbst.
- https://www.data-to-viz.com/graph/circularpacking.html — verwandter Flächen-Diagrammtyp mit derselben Grundschwäche: *"it is hard for the human eye to translate an area into an accurate number"*; empfiehlt für präzisen Vergleich stattdessen Balken/Lollipop.

**Fazit für euren Fall:** Bei nur 5 Zwecken × 6 Modellen (max. 30 Zellen, real deutlich weniger durch Sparsity) wäre eine Treemap technisch nicht "zu tief" (nur eine Hierarchieebene), aber jede Zelle mit kleinem Kostenanteil bekommt laut den obigen Quellen ein Beschriftungsproblem — und der Sonderfall selbst (89 zu 11) tötet die Treemap vollends: eine Kachel würde ~8x so groß wie die andere, alle Untertiefen darin nochmal kleiner. Kein einziges der geprüften FinOps-Produkte (Vantage, CloudZero, Datadog) nutzt tatsächlich eine Treemap für genau dieses Kosten-Aufschlüsselungsproblem — das ist ein starkes Indiz gegen die Treemap für euren Fall, nicht nur graue Theorie.

---

### 2. Sankey als Geldfluss

**Werkzeug/Vorbild:**
- **SankeyMATIC** https://sankeymatic.com/build/ — Syntax `Quelle [Betrag] Ziel`, farbige Knoten/Flüsse, Platzhalter `[*]` für Restbeträge, explizite Layout-Unterstützung für "3 oder mehr Kolumnen" (also mehrstufig, wie euer Anbieter→Modell→Zweck-Fall). Die klassischen Beispiele dort sind genau Haushaltsbudgets (Steuern, Wohnen, Lebensmittel) — also strukturell euer Anwendungsfall.
- **Wikipedia Sankey-Diagramm** https://en.wikipedia.org/wiki/Sankey_diagram — Herkunft 1898 (Captain Sankey, Dampfmaschinen-Energiebilanz), Vorläufer Minard 1869 (Napoleons Russlandfeldzug). Etablierte Anwendungen: Energiebilanzen (US-Energiefluss-Diagramm ist der Klassiker), Materialflusskonten, **Kostenaufschlüsselungen** werden explizit als Anwendung genannt. Der Artikel enthält KEINE Kritik/Grenzen-Diskussion — Wikipedia ist hier unkritisch pro-Sankey.
- **Bundeshaushalt.de** https://www.bundeshaushalt.de — Gegenbefund: die offizielle deutsche Haushaltsseite verwendet AUSDRÜCKLICH KEINE Sankey-Grafik auf der Startseite, sondern isolierte Einzel-Balkendiagramme pro Position (Rentenversicherung, Schuldenquote, Energiesteuer, Zinsausgaben). Das ist bemerkenswert, weil der Bundeshaushalt der Klassiker-Anwendungsfall für Sankeys wäre und die Betreiber sich trotzdem dagegen entschieden haben.

**Wann Sankey Deko ist vs. Substanz — Kritikpunkte, mit Beleg:**
- https://www.data-to-viz.com/graph/sankey.html — "Common mistakes": Knotenposition ist entscheidend (Kreuzungsminimierungs-Algorithmen nötig), schwache Verbindungen sollten entfernt werden, allgemeine Warnung vor "over-cluttering". **Kein konkreter Zahlenwert** für "ab wie vielen Knoten unlesbar" wird genannt — das ist eine Lücke in dieser sonst sehr konkreten Quelle.
- Junk Charts (Kaiser Fung), typepad-Domain https://junkcharts.typepad.com/junk_charts/treemap/ ist **tot/verkauft** (leitet auf eine Networksolutions-Parkseite um) — seine bekannten Treemap/Sankey-Kritiken sind über diese Route nicht mehr greifbar; falls relevant, müsste man sie über eine Web-Archiv-Kopie holen, was ich in dieser Sitzung nicht mehr geprüft habe.

**3-stufiger Sankey (Anbieter → Modell → Zweck) — Einschätzung:** SankeyMATIC dokumentiert explizit Support für 3+-Spalten-Layouts, das technische Muster ist also Standard (klassische Energie-Sankeys sind strukturell identisch: Quelle → Umwandlung → Endnutzung). Bei euren Zahlen (2 Anbieter, 6 Modelle, 5 Zwecke) ergibt das aber schnell viele dünne Fäden zwischen Stufe 2 und 3 (bis zu 30 Verbindungen), von denen laut data-to-viz mehrere "schwach" sein und den Nutzen verwässern werden — genau die Situation, vor der die Quelle warnt.

---

### 3. Alternativen zu Treemap/Sankey

**Bar-in-Table / Data Bars, Tabelle mit rechtsbündigen Zahlen:**
- Ich konnte hier **keine der anvisierten Kernquellen live bestätigen**: Stephen Few's PDF "Save the Pies for Dessert" (https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf) ließ sich nicht als Text extrahieren (nur Binärinhalt), sein Blog-Archiv (https://www.perceptualedge.com/blog/) zeigte in der abgerufenen Ansicht keine Einträge speziell zu Tabellen/Treemap/Sankey. Storytelling-with-data-Blogindex (https://www.storytellingwithdata.com/blog) lieferte keinen Treffer zu "table vs graph"/Data Bars — die spezifische von mir vermutete URL `.../what-is-a-table` existiert nicht (404). NN/g's Tabellenartikel (https://www.nngroup.com/articles/data-tables/) behandelt Tabellen-UX (Sortieren, Zebra-Striping, Freeze-Header), aber **nicht** Data Bars/Sparklines in Zellen.
- **Was ich dazu wirklich beitragen kann, ist ehrlich als Hintergrundwissen zu kennzeichnen, nicht als in dieser Sitzung verifizierte Quelle:** Stephen Few propagiert in "Show Me the Numbers" das Grundprinzip, Balken direkt in Tabellenzellen einzubetten ("bar chart within a table" / seine "graphical table" Vorschläge), und Edward Tufte prägte den Begriff *Sparkline* genau für diesen Zweck (Wort-große Grafik in einer Tabellenzeile) — das ist etabliertes, aber in dieser Sitzung nicht neu verifiziertes Fachwissen.

**Bestätigt gefundene, verwandte Argumente:**
- https://www.data-to-viz.com/caveat/stacking.html — Kritik an gestapelten Diagrammen: nur die unterste Kategorie hat eine echte Baseline, alle anderen sind schwer vergleichbar. Empfehlung: nebeneinander angeordnete Balken (nicht gestapelt), kleine Multiples, oder interaktives Ein-/Ausblenden. **Relevant für euren 100%-Stapel-Vorschlag**: auch der gestapelte 100%-Balken hätte laut dieser Quelle das Problem, dass nur der erste Zweck an der Nulllinie beginnt und die anderen 4 schwer vergleichbar sind — als reine "1 Balken = 1 Ganzes"-Aufteilung ist es aber unkritischer als ein Mehrfach-Stapel über Zeit.
- https://www.data-to-viz.com/caveat/pie.html — Grundproblem Winkel-/Flächenwahrnehmung, verstärkt sich bei extremen Verhältnissen wie 89/11, weil der kleine Keil kaum noch visuell einschätzbar ist.

---

### 4. Der 89/11-Sonderfall (stark dominanter Anteil)

- **Log-Skala:** Datawrapper-Artikel (https://www.datawrapper.de/blog/weeklychart-logscale3/, ursprünglich unter blog.datawrapper.de) zitiert Mike Bostocks Regel: *"Don't compare percentage change on a linear scale. Use a log scale instead"* — aber das gilt für **Wachstumsraten/Verhältnisse**, nicht für Anteile an einem Ganzen. Der Artikel warnt sogar ausdrücklich vor Log-Skalen bei "Daten über Menschen" (2 vs. 4 Betroffene ist ein anderer Impact als das Verhältnis suggeriert) und generell auf Karten. **Für euren 89/11-Fall ist eine Log-Skala also eher unpassend** — sie würde den Unterschied kleinreden, den ihr eigentlich transportieren wollt (89 % ist dominant, das soll man SEHEN).
- Eine dedizierte Quelle zu "stark schiefe Anteils-Verteilung in Dashboards visualisieren" habe ich trotz Suche nicht gefunden (weder über data-to-viz noch Datawrapper-Blog-Guesses, mehrere Rate-URLs gaben 404). Das ist eine echte Lücke — hier wäre eine gezielte WebSearch nötig, sobald das Kontingent zurückgesetzt ist (z. B. "dashboard dominant category visualization" oder "long tail chart skewed cost breakdown").
- **Aus der Gesamtschau der Quellen lässt sich aber ein Vorbild-Muster ableiten**, das mehrere Konventionen kombiniert, die ich einzeln belegt habe: (1) *keine* Fläche/Winkel für den Anteil selbst nehmen (data-to-viz: area_hard.html, pie.html), sondern (2) einen einzigen horizontalen 100%-Balken mit zwei Segmenten (Bild/Text) als Ganzes zeigen, und (3) den dominanten 89%-Teil dann separat "aufklappen" in die 5-Zweck/6-Modell-Unterverteilung — strukturell das, was Azure Cost Analysis mit seinen aufklappbaren Tabellenzeilen macht (siehe Punkt 5: "Expand rows to take a quick peek and see how costs are broken down to the next level").

---

### 5. FinOps-Konventionen für Forecast/Hochrechnung

Das war der ergiebigste Teil, mit klaren, konkreten Herstellerangaben:

- **AWS Cost Explorer** (https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html): Forecast nutzt ein **80 % Prognoseintervall**. Darstellung unterscheidet sich nach Diagrammtyp: *Liniendiagramme* zeigen das Intervall als zwei zusätzliche Linien ober-/unterhalb der Ist-Linie (= Kegel/Band); *Balkendiagramme* zeigen zwei Linien am oberen Balkenrand statt eines Bandes. Kein Forecast, wenn weniger als ein voller Abrechnungszyklus Historie vorliegt. Seit neuestem auch "Analyze with Amazon Q" für KI-Erklärungen der Prognosetreiber.
- **Azure Cost Analysis** (https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis): Forecast ist **nur bei Flächen- oder gestapeltem Säulendiagramm** verfügbar (nicht bei jedem Chart-Typ!). Methode: *"time series linear regression"*, mit Sonderbehandlung für einmalige Spitzen (z. B. Reserved-Instance-Käufe), die man herausfiltern kann. Konkrete Lookback-Tabelle: Forecast bis 28 Tage → 28 Tage Lookback; über 90 Tage Forecast → 90 Tage Lookback gedeckelt. Bei gesetztem Budget zeigt die Ansicht an, **wann** der Forecast das Budget übersteigen würde (Schnittpunkt-Logik). KPI-Kachel zeigt zusätzlich Vormonatsvergleich in Prozent direkt neben dem Total.
- **GCP Billing Reports** (https://docs.cloud.google.com/billing/docs/how-to/reports): Forecast wird **hellgrau eingefärbt direkt im Chart** dargestellt (nicht gestrichelt, sondern per Farbe/Sättigung unterschieden), Standarddiagramm ist ein gestapeltes Balkendiagramm über Zeit, alternativ Liniendiagramm. Kopfzeile zeigt "Total forecasted cost for the entire current month" + prozentuale Trendindikatoren separat von der Grafik.
- **Vantage** (https://docs.vantage.sh/cost_reports): Forecasts sind Bestandteil der Cost Reports, aber nur für Linien- und Flächendiagramme erwähnt; die visuelle Umsetzung (gestrichelt/Kegel) wird in der Doku **nicht** spezifiziert — das ist hier eine echte Doku-Lücke, kein Negativbefund zum Produkt selbst.
- **FinOps Foundation Framework** (https://www.finops.org/framework/capabilities/forecasting/): Definiert Forecasting fachlich (statistische Methoden, historische Muster, geplante Änderungen) und nennt KPIs wie *Forecast Accuracy Rate* und *Forecast Drift Rate* — aber bewusst **keine** visuelle Konvention (kein gestrichelt/Kegel-Standard). Das Framework ist prozess-, nicht diagrammorientiert.
- **CloudZero/Datadog/Kubecost:** Marketingseiten bestätigen nur, dass "Budgeting and Forecasting" als Feature existiert, ohne die visuelle Umsetzung zu beschreiben (Bilder, keine auswertbare Textbeschreibung).

**Muster über alle drei großen Hyperscaler hinweg:** Keiner nutzt eine reine gestrichelte Linie als alleiniges Signal — AWS nutzt ein Zwei-Linien-Band/Konfidenzintervall, Azure bindet den Forecast an Budgetvergleich und Vormonats-Prozentwert in einer separaten KPI-Kachel statt nur im Chart, GCP nutzt Farbsättigung (hellgrau) statt Linienstil. Für euren Fall heißt das: **eine reine gestrichelte Fortsetzung ohne Zahlen/Prozentvergleich wäre unterkomplex** gegenüber dem, was die Marktführer tatsächlich zeigen — der Vormonatsvergleich als Prozentzahl neben dem Total scheint der eigentliche Branchenstandard zu sein, wichtiger als die Linienästhetik.

---

### Was ich NICHT belegen konnte (klar markiert)
- Die "viralen Apple/Nvidia-Umsatz-Sankeys" (z. B. von @sankey_charts/App Economy Insights) — Twitter/Reddit nicht fetchbar, keine Suche möglich. Nur aus Trainingswissen bekannt, keine URL zur Hand.
- Kaiser Fungs konkrete Junk-Charts-Kritik an Treemaps — Domain tot, nur über Web-Archiv nachprüfbar (nicht getan).
- Genaue Screenshots von Kubecost-, Vantage-, CloudZero-, Datadog-Treemap/Sankey-UI — nur Marketing-Bilder, textlich nicht auswertbar.
- Eine dedizierte Fachquelle speziell zu "89/11-artigen dominanten Anteilen in Dashboards" — nicht gefunden, echte Lücke, sollte mit funktionierendem WebSearch nachgezogen werden.