# AUFTRAG

Research the INTERFACE DESIGN of Railway's Usage and Metrics pages. I care about visual/interaction design and information density, NOT the pricing subject matter.

Use WebSearch and WebFetch. Start with these URLs and follow links:
- https://docs.railway.com/reference/usage or https://docs.railway.com/guides/usage
- https://docs.railway.com/guides/metrics
- https://docs.railway.com/reference/pricing
- https://docs.railway.com/reference/metrics
- Railway changelog / blog posts about the usage page and metrics redesign (railway.com/changelog, blog.railway.com)

Answer these SPECIFIC questions, each backed by a URL. If the docs don't say, write "nicht belegt" — do NOT guess:
1. Header/summary tiles: which metrics as summary cards? Sparklines? Delta vs previous period (arrow/percent/color)?
2. Main chart: type, granularity, stacked vs grouped? Is usage broken down per service / per resource type (CPU, RAM, network, volume)?
3. Tables: which columns, sortable? Inline bars in cells?
4. Interactions: hover tooltip content (one value or all series?), time-range presets, comparison to previous period, drill-down (project -> service -> replica?), legend click to isolate?
5. How are incomplete / in-progress periods shown (current day/current billing cycle)?
6. Projection/forecast: Railway is known for an "estimated cost this month" / projected invoice. Confirm from docs exactly what it's called, where it appears, and how it's computed/displayed.
7. How is "no data" distinguished from "

---

# Railway Usage & Metrics — Interface-Design-Recherche

Vorab zur Quellenlage: Von den vier vorgegebenen Docs-URLs waren **zwei tot** (`/reference/usage` und `/reference/pricing` sowie `/guides/metrics` und `/reference/metrics` → alle 404). Die aktuellen Pfade sind `docs.railway.com/projects/project-usage`, `docs.railway.com/observability/metrics` und `docs.railway.com/pricing/*`. Zusätzlich habe ich ein Changelog-Video (`2024-06-21-improved-cost-charts`) per ffmpeg in Einzelbilder zerlegt — das liefert die mit Abstand detailliertesten, aktuellsten Screens der echten Usage-Seite (Stand 2024, während der reine Doku-Screenshot in `project-usage` von 2021 stammt und laut Changelog-Text seither um Network/Volume-Charts erweitert wurde).

---

## 1. Header/Summary-Kacheln

Beleg: Changelog-Video-Frames, https://railway.com/changelog/2024-06-21-improved-cost-charts (Typ c, Screen-Recording der echten UI)

Oben auf der Workspace-„Usage"-Seite steht ein Panel mit Titel „May 30 to Jun 30 Usage" und rechts daneben ein Link „Show Breakdown". Das Panel selbst ist zweigeteilt:
- Links eine reine Textliste: „Current Usage $399.71", „20 Member Seats $400.00", „Included Usage $0.00", „Credits Available $343.83"
- Rechts zwei große Zahlen-Kacheln nebeneinander: **„Current Usage" / „Estimated Bill"**
- Darunter ein Button „Set usage limits"

**Keine Sparklines** in diesen Kacheln, **kein Delta/Pfeil/Prozent** gegenüber der Vorperiode irgendwo sichtbar — nur absolute Dollarbeträge. Darunter folgt ein Plan-Panel („Pro Plan — Usage-based Subscription") und dann „Usage by Project": eine Liste von Projekt-Zeilen, die selbst wie Kacheln aussehen (Icon, Name, „Current Cost $X / Estimated $Y", Chevron zum Aufklappen).

## 2. Hauptchart

Beleg: Changelog-Video (Typ c) + https://docs.railway.com/observability/metrics (Typ a+b)

Beim Aufklappen einer Projekt-Zeile erscheinen **vier separate, vollbreite Linien-/Step-Charts untereinander** — CPU, RAM, Network Egress, Volume — je ein einzelner lila Datensatz, **nicht gestapelt** (keine stacked area), sondern klassische „small multiples". Netzwerk/Volume kamen laut Changelog-Text im Juni 2024 neu dazu.

Auf der separaten Service-„Metrics"-Tab (pro Service im Projekt-Canvas) sind CPU und Memory ebenfalls **nebeneinander als eigene Panels** (grouped, nicht stacked), mit einem Layout-Umschalter oben rechts (Liste vs. 2×2-Grid-Icon). Granularität: Presets **„1h / 6h / 1d / 7d / 30d"** (Typ b, Screenshot). Bei mehreren Replicas gibt es einen Umschalter **„● Sum / ○ Replicas"** pro Chart — in der Replica-Ansicht wird jede Replica als eigene farbige Linie gezeichnet (Multi-Serien-Linienchart), Legende darunter als benannte Punkte (z. B. „● asia-southeast1-replica-0"). Auf der Usage-Seite selbst gibt es keine sichtbaren Zeitraum-Presets — sie zeigt offenbar fix die laufende Abrechnungsperiode.

## 3. Tabellen

Beleg: Changelog-Video (Typ c), Rechnungs-Screenshot (Typ b, https://docs.railway.com/pricing/understanding-your-bill)

Unter den vier Charts folgt eine „Project Cost"-Tabelle: Spalten **Ressource | Menge (mit Einheit, z. B. „minutely GB") | Preis pro Einheit | Betrag**, rechtsbündig, Fußzeile „Metrics are shown as minutely accumulated values.", oben rechts ein Link „View Cost by Service" (weiterer Drill-down, im Video nicht angeklickt). **Keine sichtbaren Sortier-Pfeile in den Spaltenköpfen** (Sortierbarkeit nicht belegt) und **keine Inline-Balken** in den Zellen — reine Zahlen. Die separate PDF-Rechnung hat dieselbe Grundform (Description/Qty/Unit price/Amount) plus Summenblock (Subtotal, Included-usage-Rabatt, Applied balance, Amount due) — ebenfalls statisch, keine Balken. Die CLI (`railway usage projects`, Typ a) rankt Projekte nach Kosten und fasst den Rest in einer „Other projects"-Zeile zusammen — aber das ist Terminal-Text, keine Web-UI-Tabelle.

## 4. Interaktionen

- **Hover-Tooltip:** einziger belegter Fall ist die Deployment-Markierung im Metrics-Chart (gestrichelte vertikale Linie) — Tooltip zeigt Zeitstempel + Commit-Nachricht, z. B. „Feb 16 2:51 pm — Update curl command (#109)" (Typ b, `usage-commit_fkvbqj.png`). Ob ein normaler Datenpunkt-Hover den y-Wert zeigt und ob dann eine oder alle Serien erscheinen: **nicht belegt**.
- **Zeitraum-Presets:** nur im Metrics-Tab (1h/6h/1d/7d/30d), nicht auf der Usage-Seite.
- **Vergleich zur Vorperiode:** visuell **nicht belegt**. Die CLI kennt `--period previous|current|YYYY-MM`, aber das ist ein Parameter, kein Overlay/Delta in der GUI.
- **Drill-down:** bestätigt über drei Stufen — Workspace-Usage → Projekt aufklappen → „View Cost by Service" (Detailtiefe im Material nicht sichtbar); separat: Projekt-Canvas → Service → Metrics-Tab → Sum/Replica-Umschalter mit benannten Replicas.
- **Legende/Isolieren:** die einzige „Legende" ist der Sum/Replicas-Umschalter, der den ganzen Chart-Inhalt wechselt — kein klassisches Klicken-zum-Ausblenden einzelner Serien belegt.

## 5. Unvollständige/laufende Perioden

**Nicht belegt.** Kein Text und kein Screenshot zeigt eine besondere Darstellung (gestrichelt, ausgegraut, „unvollständiger Tag") für den aktuellen Tag oder die laufende Abrechnungsperiode; die Linien enden im Material einfach am rechten Rand ohne erkennbare Sonderkennzeichnung.

## 6. Projektion/Forecast

Name: **„Estimated"** (neben „Current Cost" auf Projekt-/Service-Zeilen) bzw. **„Estimated Bill"** (neben „Current Usage" auf Workspace-Ebene). Belegt in Prosa: „the user can see their estimated resource usage for the current billing period" und „The Current and Estimated cost metrics show the current resource usage and the estimated usage by the end of the billing period." (Typ a, https://docs.railway.com/projects/project-usage). Ursprünglicher Feature-Name beim Launch Dez. 2022: „Estimated Project Usage" (Typ c, https://railway.com/changelog/2022-12-23-estimated-project-usage). CLI-Pendant: `current bill`/`estimated bill` im Workspace-Summary (Typ a, https://docs.railway.com/cli/usage). **Die genaue Berechnungsmethode (Hochrechnung/Formel) ist nirgends dokumentiert — nicht belegt.**

## 7. „Keine Daten" vs. „Wert ist Null"

**Nicht belegt.** Es gibt keinen dokumentierten Leer-/No-Data-Zustand (kein „No data"-Hinweis, keine gestrichelte Platzhalterlinie). Flache Linien bei ~0 % (z. B. CPU in `project-usage.png`) sehen wie eine normale durchgezogene Linie am unteren Rand aus — visuell nicht von einem definierten „no data"-Stil unterscheidbar, weil ein solcher Stil im Material schlicht nicht vorkommt.

## 8. Enthaltenes Guthaben vs. Overage

**In keinem der acht geprüften Screens erscheint ein Fortschrittsbalken.** Alle Darstellungen sind rein numerisch/textuell:
- Workspace-Summary: „Included Usage $0.00" / „Credits Available $343.83" als reine Textzeilen neben (nicht visuell verknüpft mit) den Current-/Estimated-Kacheln (Typ c).
- Rechnung: Guthaben als abgezogene Zeile „Pro plan included usage ($20.00 off)" und „Applied balance -$5.00" in einer reinen Summentabelle (Typ b, https://docs.railway.com/pricing/understanding-your-bill).
- Promo-Rabatt: statisches lila Banner mit Text („$20 will be deducted from your next 11 invoices…") auf der Billing-Seite, kein Balken (Typ b, https://docs.railway.com/pricing/credits).
- Limit-Modal: nur zwei Zahlenfelder (Hard limit $, Custom email alert $), kein Gauge/Balken zur aktuellen Ausschöpfung (Typ b, https://docs.railway.com/pricing/cost-control). Hinweis: Dieser Screenshot (Upload-Zeitstempel 2025-05-09) zeigt noch ein einziges undifferenziertes „Usage limits"-Modal, während der aktuelle Fließtext derselben Seite bereits getrennte „Compute Usage"- und „Agent Usage"-Limits beschreibt — Text und Screenshot sind also nicht mehr deckungsgleich; die Zwei-Kategorien-Beschreibung ist nur als Prosa (a) belegt, nicht bildlich.

**Fazit Q8:** Guthaben/Overage wird bei Railway durchgehend als benachbarte oder abgezogene Dollarbeträge dargestellt, nie als proportionale Balken-/Ring-Anzeige.

---

### Verwendete Quellen
- https://docs.railway.com/projects/project-usage
- https://docs.railway.com/observability/metrics
- https://docs.railway.com/cli/usage
- https://docs.railway.com/pricing/cost-control
- https://docs.railway.com/pricing/understanding-your-bill
- https://docs.railway.com/pricing/credits
- https://docs.railway.com/pricing/plans
- https://railway.com/changelog/2022-12-23-estimated-project-usage
- https://railway.com/changelog/2024-06-21-improved-cost-charts (inkl. eingebettetem Video, per ffmpeg in Frames zerlegt)

Lokal gespeicherte Belegbilder/Frames liegen unter `/private/tmp/claude-501/-Users-mleihs-Dev-velgarien-rebuild/5fecf3bf-8603-403b-9f35-c16f4bda565c/scratchpad/` (u. a. `project-usage.png`, `metrics-sum.png`, `metrics-per-replica.png`, `usage-commit.png`, `usage-limits.png`, `bill_screenshot.png`, `promotion_billing.png`, `frames2/f22.png` und `frames2/f29.png` als schärfste Stände der echten Usage-Seite).