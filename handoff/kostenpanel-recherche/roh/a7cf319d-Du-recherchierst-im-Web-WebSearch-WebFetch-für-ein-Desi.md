# AUFTRAG

Du recherchierst im Web (WebSearch/WebFetch) für ein Design-Vorbild-Dossier. Antworte auf DEUTSCH. Schreibe KEINE Dateien — gib alles als finale Textantwort zurück.

ZIEL: Konkrete, nachschaubare Vorbilder für ein dichtes, dunkles KI-KOSTEN-/Telemetrie-Admin-Panel (Aufrufe, Token, USD, nach Anbieter/Modell/Zweck/Welt/Nutzer, freie Zeiträume, Hochrechnung). Brutalistisch, Schreibmaschinensatz, sehr dichte Zahlen.

TEIL A — Untersuche diese Produkte, je mit URL zu Doku/Screenshots:
1. PostHog (Insights, Web Analytics, Billing/Usage-Seite — PostHog ist Open Source, es gibt echte Screenshots und sogar Quellcode)
2. Plausible Analytics (Open Source, Live-Demo unter plausible.io/plausible.io — nachschaubar ohne Login!)
3. Linear Insights
4. Stripe Dashboard + Stripe Sigma
5. Retool (Dashboard-Bausteine)
6. Observable Framework (Dashboards — es gibt öffentliche Beispiel-Dashboards)
7. TradingView (Dichte, Zeitraumwahl, Krosshaar)
8. Bloomberg Terminal (die dichteste Zahlenoberfläche überhaupt — wie funktioniert sie visuell?)

Für JEDES: URL(s), und KONKRET was außergewöhnlich ist — Zeilenhöhen, Schriftgrößen, Rasterabstände, Farbdisziplin (wie viele Akzentfarben?), Hover-Verhalten, Drill-down-Weg, Zeitraumwahl (Presets/Brush/Vergleich).

TEIL B — GALERIEN mit ECHTEN Produkt-Screenshots. Prüfe und beschreibe, was man dort konkret findet:
- Mobbin (mobbin.com) — Suche nach "analytics", "usage", "billing", "dashboard"
- Refero (refero.design)
- SaaS Interface (saasinterface.com)
- UI S

---

## Hinweis zur Recherchemethode

Die WebSearch-Quote dieser Sitzung war bereits zu Beginn meiner Arbeit vollständig aufgebraucht (200/200 — vermutlich durch vorangegangene Arbeit in dieser Sitzung). Ich konnte daher **keine einzige Websuche** ausführen, sondern habe ausschließlich WebFetch mit bekannten/erschlossenen URLs eingesetzt (ca. 24 Abrufe). Mehrere Galerie-Seiten blockten mit 403/429 (Bot-Schutz), Plausibles Live-Demo und TradingView/Bloomberg lieferten über WebFetch nur dürftigen Text (diese Seiten sind stark JS-/Canvas-gerendert, WebFetch sieht kein Rendering). Ich kennzeichne unten explizit, was **heute per Fetch bestätigt** ist vs. was aus meinem Trainingswissen stammt (Stand Wissenscutoff, nicht heute frisch verifiziert) — bitte diese Stellen selbst gegenprüfen, bevor sie als „nachgeschaut" gelten.

---

## TEIL A — Produkte

### 1. PostHog
- **URLs:** https://posthog.com/docs/web-analytics/dashboard (heute gefetcht), https://posthog.com/docs/billing (heute gefetcht, aber Text-Auszug schwach), Quellcode: https://github.com/PostHog/posthog (Open Source, AGPL-artig, TypeScript/React-Frontend – Screenshots direkt im Code auffindbar unter `frontend/src/scenes/`)
- **Bestätigt:** Hierarchische Kachelanordnung, oberste Ebene = Hauptmetriken (Besucher/Views/Sessions) mit automatischem Vorperioden-Vergleich pro Kachel. Darunter Tabellen zu Pfaden (mit Bounce-Rate, Scroll-Tiefe), Quellen/UTM, Geo, und eine Aktivitäts-Heatmap nach Stunde/Wochentag. Light/Dark Mode parallel gepflegt.
- **Einordnung für euer Panel:** PostHog ist die einzige Quelle hier, deren tatsächlicher Produktionscode einsehbar ist – lohnt sich, `frontend/src/scenes/insights` und `frontend/src/scenes/billing` im Repo direkt zu lesen statt nur Doku-Screenshots zu betrachten. Die "Kachel + Vorperiodenvergleich als Delta-Pfeil"-Konvention ist genau das Muster, das ihr für Kosten/Token/USD-Kacheln braucht.

### 2. Plausible Analytics
- **URLs:** https://plausible.io/plausible.io (Live-Demo, kein Login), Quellcode https://github.com/plausible/analytics (heute gefetcht)
- **Bestätigt:** Community Edition ist AGPL-3.0 Open Source, Frontend React + TailwindCSS, Backend Elixir/Phoenix, Analytics-Speicher ClickHouse. README trägt einen echten Dashboard-Screenshot.
- **Aus Trainingswissen (nicht heute per Rendering verifiziert):** Plausible ist bekannt für extreme Farbdisziplin – im Kern nur EINE Akzentfarbe (ein Violett/Lila-Ton `#5850EC`-artig) auf Weiß/fast-Weiß, keine zweite Akzentfarbe für "gut/schlecht". Zeitraumwahl über ein simples Dropdown mit festen Presets (Today, 24h, 7d, 30d, Monat, 12 Monate, Custom Range via Kalender) statt Brush-Selektion. Kein Vergleichsmodus in der Basisversion (kam erst später als Feature dazu). Drill-down: Klick auf eine Zeile in einer Top-Pages/Sources-Tabelle filtert das gesamte Dashboard sofort (kein neuer Screen) – das ist das prägende UX-Muster: **ein Klick = Filter-Pill oben, alle anderen Kacheln aktualisieren sich live**. Sehr großzügige Zeilenhöhe (eher "Reporting" als "Terminal"-Dichte) — daher als Gegenbeispiel zu eurem brutalistischen, dichten Anspruch nützlich: zeigt, was ihr NICHT wollt (zu viel Weißraum pro Zahl).
- **Empfehlung:** Selbst mit Playwright/Browser-Tool nachschauen, da WebFetch kein JS rendert – die Live-Demo ist tatsächlich ohne Login einsehbar.

### 3. Linear Insights
- **URL:** https://linear.app/insights (heute gefetcht, Marketing-Text)
- **Bestätigt:** "Fully modular" Layout, Nutzer ordnen Kacheln frei an; Diagrammtypen: Balken, Linien, Tabellen; Zeit-Granularität Tag/Woche/Monat/Quartal/Jahr wählbar; „Quick Filters" für sofortige Filterung.
- **Aus Trainingswissen:** Linear ist der Referenzpunkt für **extreme Farbdisziplin + Schreibmaschinen-nahe Sans-Serif-Typografie** (Inter-artig, aber sehr eng getrackt) auf fast-schwarzem Grund (`#08090A`-artig), mit genau EINER Akzentfarbe (ihr Lila/Indigo) für interaktive Elemente und dezenten Statusfarben (grün/gelb/rot) nur für Prioritäts-/Status-Punkte, nie flächig. Zeilenhöhen in Linear-Listen sind sehr kompakt (ca. 32–36px), das ist der Maßstab für "dicht, aber lesbar" den ihr wahrscheinlich wollt.

### 4. Stripe Dashboard + Sigma
- **URLs:** https://stripe.com/sigma (heute gefetcht), https://docs.stripe.com/dashboard (Redirect erkannt, nicht final gefetcht)
- **Bestätigt (Sigma):** Tabellarisch-abfragefokussiertes Design, SQL-Editor mit Syntax-Highlighting, Tabellen-/Feld-Sidebar für Stripes Datenschema, Ergebnisse als editierbare Tabelle plus dynamische Diagramme darunter, Monospace-Font für Code/Query-Ergebnisse, klare Trennung Header (fett, größer) vs. Datenzellen (Monospace, kleiner). Teilbare Query-Links, Team-Kollaboration.
- **Aus Trainingswissen (Stripe-Hauptdashboard):** Sehr enge Zeilenhöhe in der Payments-Tabelle (ca. 44–48px inkl. Avatar/Status-Pill), Statusfarben klar begrenzt (grün=succeeded, gelb=pending, rot=failed, grau=refunded — 4 Zustandsfarben, sonst neutral), Zeitraumwahl über ein Kalender-Popover mit Presets (Today, 7 days, 4 weeks, 3/12 months, Custom) UND direktem Jahr-über-Jahr-Vergleichstoggle in den Berichten. Sehr gutes Vorbild für: Kosten-Tabelle nach Anbieter/Modell mit Status-Pills + Sigma-artiger "roh SQL neben visualisiertem Ergebnis"-Docking für eure Hochrechnungs-Ansicht.

### 5. Retool
- **URL:** https://retool.com/templates (heute gefetcht)
- **Bestätigt:** Konkrete Templates: "Data Integration Dashboard", "Data Governance Dashboard", "IAM Dashboard", "Financial Dashboard", "Cash Flow", "Budget Tracking", "Quickbooks Dashboard", "Xero Dashboard", "Expense Dashboard", "Cost Analysis Dashboard", generisches "Analytics Dashboard", "Metrics Dashboard", "Customer Success Metrics Dashboard". Bausteine: editierbare Tabellen (Read+Write auf Datenquelle), KPI-Kacheln, Trend-Diagramme, Filter/Suche.
- **Einordnung:** Retool ist funktional der nächste Verwandte zu eurem Anwendungsfall (internes Admin-Panel über beliebige Datenquelle), aber sein visuelles Vorgabe-Theme ist bewusst neutral/Enterprise, nicht brutalistisch – als Bauplan für Layout-Bausteine nützlich (Tabelle+KPI-Reihe+Filterleiste als Grundraster), nicht als Stilvorbild.

### 6. Observable Framework
- **URLs:** https://observablehq.com/framework/examples (429 – blockiert), https://observablehq.com/@observablehq/framework-example-dashboard (429 – blockiert)
- **Nicht heute verifizierbar** (Rate-Limit). **Aus Trainingswissen:** Observable Frameworks offizielle Beispiel-Dashboards (u.a. ein "SF Bay Trees"-Dashboard, ein API-Kosten/Usage-Beispiel) nutzen ein sehr enges CSS-Grid mit `Plot`-Bibliothek-generierten SVG-Charts, kleine Karten mit großer Zahl oben + Sparkline darunter, Systemschrift oder eine kondensierte Sans, keine Chrome/UI drumherum außer einer schmalen Kopfzeile. Gilt als gutes Beispiel für "Zahlen-zuerst"-Kartenlayout ohne Dashboard-Framework-Schwere. Bitte mit Browser-Tool selbst nachschauen, da 429 nur ein temporäres Rate-Limit war.

### 7. TradingView
- **URL:** https://www.tradingview.com/chart/, https://www.tradingview.com/features/ (heute gefetcht, nur Marketing-Text, kein Rendering)
- **Bestätigt:** Bis zu 16 Charts gleichzeitig mit synchronisierten Symbolen/Zeitrahmen, Zeitrahmen von 1 Minute bis 1 Monat plus Custom-Intervalle (Sekunden, Range-Bars), Command-Search-Palette, 110+ Zeichenwerkzeuge, 400+ Indikatoren, farbliche Unterscheidung bei Candle-Typen (z.B. Heikin-Ashi grün/rot).
- **Aus Trainingswissen:** Das Krosshaar-Verhalten ist das eigentliche Vorbild – bei Mausbewegung erscheint ein dünnes Fadenkreuz mit **Werte-Tooltip auf beiden Achsen gleichzeitig** (Preis links, Zeit unten, jeweils als kleines Label direkt auf der Achse, nicht als schwebender Tooltip mitten im Chart). Farbdisziplin: im Kern 2 Signalfarben (grün/rot für Kurswert rauf/runter) + 1 neutrale Systemfarbe (blau/grau) für UI-Chrome, alles andere ist Graustufen. Zeitraumwahl unten als Tab-Leiste (1D/5D/1M/3M/YTD/1Y/5Y/All) statt Dropdown – sehr flach, sehr schnell wechselbar, genau das Muster für eure "freie Zeiträume"-Leiste.

### 8. Bloomberg Terminal
- **URLs:** https://en.wikipedia.org/wiki/Bloomberg_Terminal, https://en.wikipedia.org/wiki/Bloomberg_L.P. (beide heute gefetcht)
- **Bestätigt (Wikipedia):** Terminal ist "well known ... for its black interface" – seit Einführung ein Markenzeichen. Eigene Tastatur mit Farbcodierung statt Beschriftung: **Rot** = Cancel (Esc), **Grün** = GO (Enter), **Gelbe Tasten** oben = Marktsektoren. Frühe Tastaturen ca. 3kg mit 3mm Tastenhub, aktuelle "Starboard"-Version 1,08kg, flachere Chiclet-Tasten. Kernkonzept: Befehle in geschweiften Klammern wie `{VOD LN Equity GO}`, typischerweise **vier gleichzeitige Panels pro Monitor**.
- **Aus Trainingswissen (nicht heute belegt):** Die visuelle Sprache ist orange/gelb/grün/weißer Text auf reinem Schwarz (historisch von Röhrenmonitoren geerbt, wo diese Phosphor-Farben am kontrastreichsten waren), durchgehend Monospace-Schrift, extrem enge Zeilenabstände (Terminal-Zeile ≈ Zeichenhöhe + 1-2px), Funktionstasten-Farbcode wird konsequent als Bedeutungsträger genutzt (nicht nur dekorativ: gleiche Farbe = gleiche Datenklasse quer über alle Panels). Für euer Vorhaben der stärkste Beleg dafür, dass **eine winzige, aber konsequent zugeordnete Farbpalette (3–4 Farben, nie mehr) auf Schwarz** extreme Dichte lesbar hält – das ist wahrscheinlich das wichtigste einzelne Vorbild in dieser Liste für "brutalistisch + dicht + dunkel".

---

## TEIL B — Galerien

| Galerie | Echte Screenshots? | Schranke | Was konkret zu finden ist |
|---|---|---|---|
| **Mobbin** (mobbin.com) | Vermutlich ja (Produktversprechen), **heute nicht prüfbar** — 429/403 bei jedem Versuch | Bekanntermaßen Freemium mit harter Paywall für Volltextsuche/Filter | Nicht heute verifiziert. Aus Trainingswissen: durchsuchbar nach App-Name, Plattform (Web/iOS/Android) und Flow-Typ, hat "Analytics"/"Onboarding"/"Empty States" als Flow-Kategorien; Login nötig für mehr als ~3 Ergebnisse. |
| **Refero** (refero.design) | Unklar — Fetch lieferte nur Titel "UI/UX Design Inspiration", keine Inhalte | Unbekannt | Nicht belastbar recherchierbar mit WebFetch; braucht Browser-Rendering. |
| **SaaS Interface** (saasinterface.com) | **Ja, echte Produkt-Screenshots** (heute bestätigt) | **Freemium mit Paywall** — Vorschau kostenlos, volle Galerie kostenpflichtig (Checkout-Modal, "20% OFF") | Konkrete Pfade: `saasinterface.com/pages/dashboard/`, `saasinterface.com/pages/billing-plan/`, `saasinterface.com/components/modal-dialog/`. 26 Seiten-Kategorien inkl. Dashboard, Lists & Tables, Billing/Plan, Settings, Activity Feed; referenziert Webflow/Intel/Fastly als Quellen. |
| **UI Sources** (uisources.com) | → leitet weiter auf **screensdesign.com** (301-Redirect, heute bestätigt) | Auf screensdesign.com keine erkennbare Schranke | screensdesign.com zeigt echte **iOS-App**-Screenshots, aber Kategorien sind funktional (Fitness, KI-Tools, Tracker) — **keine** Dashboard/Analytics/Billing/Dark-Mode-Kategorien vorhanden. Für euer dichtes KI-Kosten-Panel wenig relevant, da mobil-fokussiert. |
| **pageflows.com** | **Ja, echte Produkt-Screenshots + Screen-Recordings** (Revolut, Spotify, Slack, Notion etc.) | **Bezahlschranke**: Quarterly $39, Yearly $99, Team $199/Jahr; Dashboard/Billing-UI selbst ist hinter Login, auf der Startseite nicht sichtbar | Gut für Nutzerflüsse, aber Billing/Analytics-Bildschirme wurden auf der öffentlichen Startseite nicht angezeigt. |
| **Godly** (godly.website) | → **redirectet auf recent.design** (301, heute bestätigt), inhaltlich nicht mehr abrufbar (403 dahinter) | Unbekannt | Godly.website existiert in der ursprünglichen Form nicht mehr — Domain zeigt jetzt auf ein anderes Inspirationsprojekt. Nicht verlässlich als Quelle nutzbar. |
| **Land-book** (land-book.com) | Landingpage-Galerie, **heute 403** bei zwei Versuchen | Unbekannt (Login für Vollzugriff vermutlich nötig) | Aus Trainingswissen: primär Marketing-/Landingpage-Screenshots, nicht App-interne Dashboards — für ein internes Admin-Panel nur bedingt relevant (kein Fokus auf dichte Datenoberflächen). |
| **Dark Mode Design** (darkmodedesign.com) | **Ja, echte Website-Screenshots** (heute bestätigt), Copyright-Hinweis "© their respective owners" | **Keine Schranke**, frei zugänglich | Kuratierte Liste ohne Kategorien-Taxonomie (kein Dashboard/Analytics-Filter). Genannte Beispiele: tinycomputer.co, captureapp.xyz, frame.io, oxide.computer, rasaapp.com, betterstack.com — **oxide.computer und betterstack.com sind hochrelevant**: beide sind dunkle, technische Dashboards/Marketingseiten mit dichter Typografie, lohnt sich direkt anzuschauen. |
| **Screenlane** | → **redirectet auf pageflows.com** (301, heute bestätigt) — existiert als eigenständige Seite nicht mehr | s. Pageflows oben | Doppelt mit Pageflows, keine separate Quelle. |
| **Nicelydone** (nicelydone.club, nicht .com) | **Ja, "echte Produkte, captured in full"**, 201.800+ Screenshots von 500+ SaaS-Apps inkl. Linear, Notion, Stripe (heute bestätigt) | **Kostenloser Free-Tier** ("Start searching free — No credit card required"), Login für Suche/Boards/Team-Einladung, aber keine harte Paywall erkennbar | Sehr passende Kategorien vorhanden: **"Dashboard & Stats"**, **"Billing"**, **"Plans & pricing"**, **"Upgrade"**, sowie Charts/Progress-Indicator/Activity-Feed als UI-Element-Kategorien. Von allen geprüften Galerien die **relevanteste** für euer Vorhaben — direkt nach "Dashboard & Stats" und "Billing" filtern. |
| **SaaS Landing Page** (saaslandingpage.com) | Heute **403**, nicht abrufbar | Unbekannt | Nicht verifizierbar; laut Namen vermutlich wie Land-book auf Marketing-Landingpages fokussiert, nicht auf interne Dashboards. |

### Kurz-Fazit Teil B
Von den zehn geprüften Galerien sind **SaaS Interface** und **Nicelydone** die einzigen, die heute zweifelsfrei (a) echte Produkt-Screenshots, (b) mit expliziten "Dashboard"/"Billing"-Kategorien, (c) mit nachvollziehbarem Zugang liefern. Godly und Screenlane existieren in der gefragten Form nicht mehr (beide umgeleitet). Mobbin, Refero, Land-book und SaaS Landing Page ließen sich mit WebFetch nicht öffnen (403/429/Rate-Limit) — diese vier bräuchten einen echten Browser (z. B. das claude-in-chrome-Tool) für belastbare Aussagen, WebFetch allein reicht bei stark bot-geschützten oder JS-lastigen Seiten nicht.

### Empfehlung für nächsten Schritt
Da WebSearch für diese Sitzung komplett gesperrt ist und mehrere Kern-URLs (Plausible-Demo, TradingView, Observable-Beispiele, Mobbin, Land-book) nur mit echtem Browser-Rendering brauchbare Ergebnisse liefern, würde ich vorschlagen: die verbleibenden Lücken (insbesondere Plausible-Live-Demo und Nicelydone-"Dashboard & Stats"-Kategorie) mit dem `claude-in-chrome`-Werkzeug direkt anzusteuern und Screenshots zu machen, statt erneut WebFetch/WebSearch zu versuchen.