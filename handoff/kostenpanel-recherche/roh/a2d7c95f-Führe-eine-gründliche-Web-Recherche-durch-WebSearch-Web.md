# AUFTRAG

Führe eine gründliche Web-Recherche durch (WebSearch + WebFetch, mindestens 15 Seiten wirklich abrufen) zu den KONKRETEN INTERFACE-MERKMALEN dieser Produkte. Antworte auf Deutsch. Fokus: dichte Daten-/Kostenpanels, dunkle Oberflächen.

Produkte: **Linear (inkl. Linear Insights)**, **Stripe Dashboard**, **Vercel Dashboard/Observability + Geist Design System**, **Railway Metrics/Usage**.

Für jedes Produkt suche nach:
- Welche Schriften? (Linear: Inter Variable? eigene? Stripe: sonar/Ideal Sans? Vercel: Geist Sans/Geist Mono — hole die konkreten Namen und Quellen)
- Konkrete Zahlen: Basis-Schriftgröße, Schriftgrößen-Skala, Zeilenhöhe von Tabellenzeilen/Listenzeilen, Rasterabstände (4px/8px-Grid?), Border-Radius, Border-Farben
- Umgang mit Hover in Tabellen (Row-Hover-Hintergrund, erscheinende Aktionen)
- Umgang mit Zahlen: tabular-nums? Monospace für Beträge? Wie zeigen sie Geldbeträge?
- Was macht sie "premium"? Konkrete Merkmale, nicht Adjektive.

Gute Quellen zum Abrufen:
- vercel.com/geist/... (colors, typography, grid, tables) — das ist eine öffentlich dokumentierte Design-System-Site, hole echte Token-Werte
- linear.app/method und linear.app/blog, Interviews mit Linears Designern (z.B. auf Lovable/Dive Club/Config-Talks), "Linear design system" Analysen
- stripe.com/blog (z.B. "Connect design", "Increasing Stripe's dashboard performance"), stripe.com/docs, das Stripe "Sail"/"Sonar" Design System (suche danach)
- railway.com/changelog, railway.app blog zu Metrics/Usage-Ans

---

Research complete – 20+ pages plus ~70 production CSS files fetched. Here is the report.

---

# Interface-Merkmale: Linear · Stripe · Vercel/Geist · Railway

**Beleg-Kennzeichnung**
`[DOC]` = offizielle Design-System-Doku · `[CSS]` = direkt aus ausgeliefertem Produktions-CSS ausgelesen (höchste Beweiskraft, Datum 2026-09-05) · `[EDIT]` = Blog/Doku-Text des Herstellers · `[?]` = meine Interpretation, nicht belegt

**Methodischer Hinweis vorab:** Ich habe die tatsächlich ausgelieferten Stylesheets heruntergeladen und die Token-Blöcke extrahiert, statt mich auf Sekundäranalysen zu verlassen. Zwei Fundstellen sind dabei besonders wertvoll: **`dashboard.stripe.com/login` liefert 7,3 MB Dashboard-CSS mit dem kompletten `--sail-*`-Tokensatz öffentlich aus** (das echte Stripe-Dashboard-System, nicht die Marketing-Seite), und **`linear.app` liefert 54 CSS-Chunks mit dem vollständigen Linear-Tokensatz**. Das WebSearch-Kontingent der Sitzung war erschöpft; ich habe stattdessen direkt per curl/WebFetch gearbeitet, was für Token-Werte ohnehin die bessere Quelle ist.

---

## 1. Linear

Quelle: `https://linear.app/` + 54 CSS-Dateien unter `https://static.linear.app/web/_next/static/css/` `[CSS]`
Wichtige Einschränkung: Das ist die **Marketing-Website**, nicht die App. Die Farbwerte (`#08090a`, `#f7f8f8`, `#8a8f98`) sind aber die bekannten Linear-App-Dunkelwerte, und die Token-Namen sind identisch mit denen der App – Linear fährt einen gemeinsamen Satz.

### Schriften `[CSS]`

```
--font-regular:   "Inter Variable", "SF Pro Display", -apple-system, …
--font-monospace: "Berkeley Mono", ui-monospace, "SF Mono", "Menlo", monospace
--font-serif-display: "Tiempos Headline", ui-serif, Georgia, …
--font-settings:   "cv01", "ss03"
--font-variations: "opsz" auto
```

Drei Befunde, die man selten liest:

1. **Berkeley Mono** als Mono – eine kostenpflichtige Lizenzschrift (nicht JetBrains/IBM Plex). Das ist eine bewusste Geldausgabe für eine Schrift, die die meisten Nutzer nie bewusst wahrnehmen.
2. **`font-feature-settings: "cv01", "ss03"`** wird global auf `html` gesetzt `[CSS]`. Das sind Inter-Zeichenvarianten. (Nach Inters eigener Feature-Doku: `cv01` = alternative Eins, `ss03` = runde Anführungszeichen und Kommas – diese Zuordnung habe ich in dieser Sitzung **nicht** nachgeprüft `[?]`.)
3. **`font-variation-settings: "opsz" auto`** – optische Größenachse aktiv. An einer Stelle explizit `"opsz" 28`.

### Schriftgewichte – der auffälligste Einzelbefund `[CSS]`

```
--font-weight-light:    300
--font-weight-normal:   400
--font-weight-medium:   510
--font-weight-semibold: 590
--font-weight-bold:     680
```

**510 / 590 / 680, nicht 500 / 600 / 700.** Das ist nur mit einer Variable Font möglich und es ist der handfesteste "Premium"-Beleg im ganzen Bericht: jemand hat die Achse abgefahren, bis das Gewicht optisch stimmte, statt die Rasterwerte zu nehmen.

### Schriftgrößen-Skala `[CSS]`, aus `:root`

| Token | rem | px |
|---|---|---|
| `--font-size-micro` | .6875rem | **11** |
| `--font-size-mini` | .75rem | **12** |
| `--font-size-small` | .8125rem | **13** |
| `--font-size-regular` | .9375rem | **15** |
| `--font-size-large` | 1.125rem | 18 |

Dazu ein zweiter, feiner aufgelöster Textsatz mit Zeilenhöhe **und** Laufweite pro Stufe `[CSS]`:

| Token | Größe | line-height | letter-spacing |
|---|---|---|---|
| `--text-tiny` | .625rem (10px) | 1.5 | −.015em |
| `--text-micro` | .75rem (12px) | 1.4 | **0** |
| `--text-mini` | .8125rem (13px) | 1.5 | −.01em |
| `--text-small` | .875rem (14px) | `calc(21/14)` = 1.5 | −.013em |
| `--text-regular` | .9375rem (15px) | 1.6 | −.011em |
| `--text-large` | 1.0625rem (17px) | 1.6 | 0 |

Beachtenswert: **die Laufweite ist größenabhängig und wird bei 12px auf 0 zurückgenommen.** Negatives Tracking gilt nur für größere Grade. Das ist Buchdruck-Logik (optical sizing von Hand), keine globale `letter-spacing: -0.01em`-Regel. Und `calc(21 / 14)` statt `1.5` – die Zeilenhöhe ist als **Pixelabsicht** notiert (21px auf 14px), nicht als Verhältnis.

Titel-Skala als komplette `font`-Shorthands mit eigener Laufweite je Stufe: `--title-1` bis `--title-9`, 1.0625rem → 4.5rem, Tracking −.012em (klein) bis −.022em (groß) `[CSS]`.

### Farben – Dunkelmodus `[CSS]`

```
--color-bg-primary:      #08090a     --color-text-primary:      #f7f8f8
--color-bg-level-0:      #08090a     --color-text-secondary:    #d0d6e0
--color-bg-level-1:      #0f1011     --color-text-tertiary:     #8a8f98
--color-bg-level-2:      #141516     --color-text-quaternary:   #62666d
--color-bg-level-3:      #191a1b
--color-bg-secondary:    #1c1c1f     --color-border-primary:    #23252a
--color-bg-tertiary:     #232326     --color-border-secondary:  #34343a
--color-bg-quaternary:   #28282c     --color-border-tertiary:   #3e3e44
--color-bg-quinary:      #282828     --color-border-translucent:        #ffffff0d
--color-bg-panel:        #0f1011     --color-border-translucent-strong: #ffffff14
```

Die Ebenen 0–3 liegen **7 Helligkeitspunkte auseinander** (`#08090a` → `#0f1011` → `#141516` → `#191a1b`). Extrem eng. Und sie sind leicht kühl gefärbt statt neutralgrau.

Wichtig für Ihren Fall: es gibt **zwei parallele Grundsätze** – opake Werte (`#1c1c1f`) und Alpha-Werte (`#ffffff08`, `#ffffff12`, `#ffffff26`). Die Alpha-Variante wird für alles benutzt, was **auf** etwas liegt, die opake für Flächen. Genau das ist der Grund, warum sich Linear auf jeder Schachtelungstiefe gleich anfühlt.

`--border-hairline: .5px` (bzw. `1px` als Fallback) `[CSS]` – auf Retina echte halbe Pixel für Trennlinien.

Linears eigene Blog-Aussage zum Redesign `[EDIT]`: Umstellung von HSL auf **LCH**, Reduktion von "98 spezifischen Variablen je Theme" auf drei (Grundfarbe, Akzent, Kontrast); "Inter Display" für Überschriften, reguläres Inter für Fließtext; Text in Hell dunkler, in Dunkel heller gemacht. → https://linear.app/blog/how-we-redesigned-the-linear-ui

### Zeilenhöhen / Dichte `[CSS]`

Häufigkeitsverteilung fester `height:`-Werte über alle 54 CSS-Dateien:

```
24px → 53×    28px → 31×    20px → 26×    32px → 21×
40px →  9×    44px →  5×    22px →  5×    36px →  3×
```

**24px und 28px dominieren.** Konkrete Belege: Listen-Kopfzeile `height: 44px`, Filterleiste `height: 44px`, Icon-Buttons `24×24px`, Filter-Tab/Pill `height: 28px`, Filter-Button `height: 26px`, Navigations-Button `30×28px`, Label-Chip `height: 24px`.

Raster: nicht streng 8px. Es ist ein **4px-Raster mit 2px-Feinabstufung** (`gap: 2px`, `padding-inline: 7px 11px` – asymmetrisch, weil links ein Punkt und rechts Text steht). `[CSS]`

### Hover in Listen/Tabellen `[CSS]` – der interessanteste Teil

Linear staffelt Hover-Hintergründe nach Elementgewicht, alle als **weißes Alpha auf dunklem Grund**:

```
Navigationseintrag       background: #ffffff05   (2 %)
Inbox-Eintrag            background: #ffffff04   (1,6 %)
Workspace-Umschalter     background: #ffffff08   (3 %)
Icon-Button              background: #ffffff0d   (5 %)
Metadaten-Label / Pill   background: #ffffff0d   (5 %)
Changelog-Eintrag        background: #ffffff0a   (4 %)
```

Eine Zeile in einer langen Liste bekommt also **1,6–2 %**, ein einzelner Button 5 %. Die Begründung liegt auf der Hand: bei 50 sichtbaren Zeilen wäre 5 % ein Blitzen. `[?]` für die Begründung, `[CSS]` für die Zahlen.

Zwei Mechanik-Details:
- Der Übergang ist `transition: background .16s var(--ease-out-quad)` `[CSS]` – **160 ms**, `--speed-quickTransition: .1s`, `--speed-regularTransition: .25s`.
- Hover ist konsequent in `@media (any-hover: hover)` gekapselt `[CSS]` – auf Touch-Geräten existiert der Zustand gar nicht, statt hängenzubleiben.
- Karten lösen Hover über ein **`::after` mit `opacity: 0 → 1`** statt über einen Hintergrundwechsel `[CSS]`:
  `._5k-xcq_card:after { background: #ffffff08; inset: 0; opacity: 0 }` → `:hover:after { opacity: 1 }`. Das animiert nur `opacity` (compositor-only) und nicht `background-color`.

### Zahlen `[CSS]`

```
font-variant-numeric: lining-nums tabular-nums
font-variant-numeric: lining-nums tabular-nums slashed-zero !important
font-feature-settings: var(--font-settings), "zero" !important
```

**Tabellenziffern ja, Monospace für Zahlen nein.** Linear benutzt Inter mit `tabular-nums` – und an bestimmten Stellen zusätzlich **`slashed-zero` / `"zero"`**, also die durchgestrichene Null. Das ist der klassische Ingenieurs-/Finanzkniff gegen O-vs-0-Verwechslung. Selbst die Breadcrumb-Beschriftung trägt `font-variant-numeric: lining-nums tabular-nums` `[CSS]`, damit ein Zähler beim Hochzählen die Zeile nicht verschiebt.

### Linear Insights `[EDIT]` (https://linear.app/docs/insights)

Rechte Seitenleiste, `Cmd/Ctrl+Shift+I`. Drei Auswahlfelder: **Measure** (Metrik), **Slice** (Gruppierung, x-Achse), **Segment** (farbliche Untergliederung). Darunter Graph **und Datentabelle**. Balkendiagramme: Hover zeigt Aufschlüsselung, Klick auf Balken filtert die Ansicht temporär. Streudiagramme zeigen **Perzentilmarken bei 25/50/75/95 % beim Hover**. Tabelle und Graph sind wechselseitig verlinkt – Auswahl in der Tabelle hebt im Graphen hervor.

### Was Linear "premium" macht – konkret

1. Schriftgewichte 510/590/680 statt 500/600/700.
2. Größenabhängige Laufweite mit Rücknahme auf 0 bei ≤12px.
3. Zeilenhöhe als `calc(21/14)` notiert – Pixelabsicht bleibt lesbar.
4. Hover-Deckkraft nach Elementgewicht gestaffelt (1,6 % Zeile vs. 5 % Button).
5. Hover ausschließlich in `@media (any-hover: hover)`.
6. Hover über `::after`-Opazität statt Hintergrundwechsel.
7. `slashed-zero` zusätzlich zu `tabular-nums`.
8. Vier Hintergrundebenen mit nur 7 Helligkeitspunkten Abstand.
9. Gekaufte Mono-Schrift (Berkeley Mono).
10. `--border-hairline: .5px`.
11. Zwölf benannte Easing-Kurven (`--ease-out-quint`, `--ease-in-out-expo`, …) statt `ease`.

---

## 2. Stripe

Hier ist die wichtigste Korrektur des Berichts.

### Zwei getrennte Systeme – und das Dashboard nutzt NICHT Söhne

**Marketing (`stripe.com`), System `--hds-*`** `[CSS]`, Quelle `https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/*.css`:
```
--hds-font-family:      "sohne-var", "SF Pro Display", sans-serif
--hds-font-family-code: "SourceCodePro", "SFMono-Regular", monospace
```

**Dashboard (`dashboard.stripe.com`), System `--sail-*`** `[CSS]`, Quelle `https://b.stripecdn.com/dashboard-fe-statics-srv/assets/dashboard.*.css`:
```
--sail-font-system:    -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", "Ubuntu"
--sail-font-family:    var(--sail-font-system), sans-serif
--sail-font-monospace: "Menlo", "Consolas"
--sail-font-ja-JP:     "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", "Hiragino Kaku Gothic ProN"
--sail-font-zh-Hans:   "PingFang SC", "Hiragino Sans GB", "Heiti SC", "Microsoft YaHei", "Microsoft JhengHei"
```

**Das Stripe-Dashboard läuft auf der System-Schrift.** Kein Webfont, keine Ladeverzögerung, kein FOUT – und pro Sprache ein eigener, handgepflegter CJK-Stack. Die verbreitete Annahme "Stripe-Dashboard = Söhne" ist für das Dashboard falsch (Söhne ist Marketing). "Sonar" habe ich im Dashboard-CSS **nicht** gefunden; im Marketing-HTML taucht der String `sonar`/`Sonar` auf, ohne dass ich seine Rolle belegen konnte `[?]`.

### Sail-Tokens (echtes Dashboard) `[CSS]`

**Schriftgrößen** – 11 Stufen, dichter Bereich fein aufgelöst:
```
11 · 12 · 13 · 14 · 15 · 16 · 20 · 24 · 28 · 32 · 48 · 56 px
```
**Zeilenhöhen** als eigene, entkoppelte Token-Familie:
```
16 · 20 · 24 · 28 · 32 · 36 · 40 · 56 · 64 px
```
Größe und Zeilenhöhe sind **frei kombinierbar**, nicht paarweise gekoppelt wie bei Geist. Alle Zeilenhöhen sind Vielfache von 4.

**Gewichte** (zwei Sätze, je nach Theme-Kontext):
```
--sail-font-weight-regular:  300 | 400
--sail-font-weight-medium:   400 | 500
--sail-font-weight-bold:     500 | 700
--sail-font-weight-link:     400 | var(--sail-font-weight-medium)
```

**Abstände** – 4px-Basis, aber bewusst unvollständig:
```
0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 80 px
```
Kein 6, kein 40, kein 56. Die Skala ist **beschnitten**, damit man nicht zwischen zu vielen Nachbarwerten wählen kann.

**Radien** – auffällig klein:
```
--sail-radius-1: 1px   --sail-radius-3: 3px   --sail-radius: 6px (bzw. var(--sail-radius-4))
--sail-radius-2: 2px   --sail-radius-4: 4px
```
Der Standardradius im Dashboard liegt bei **4–6px**. Nichts Rundes.

**Graustufen** (RGB, zwei Themes) `[CSS]`:
```
gray-0:   255,255,255      gray-500: 104,115,133 | 105,115,134
gray-50:  246,248,250 | 247,250,252     gray-600: 79,86,107 | 84,89,105
gray-100: 227,232,238 | 235,238,241     gray-700: 60,66,87 | 65,69,82
gray-150: 213,219,225                   gray-800: 42,47,69 | 48,49,61
gray-200: 192,200,210                   gray-900: 26,27,37 | 26,31,54
gray-300: 163,172,185                   gray-950: 16,17,26
gray-400: 135,144,159
```
Die Grautöne sind **blaustichig** (26,31,54 bei gray-900 – deutlich mehr Blau als Rot). Semantik: `--sail-color-text: var(--sail-color-gray-700)`, `--sail-color-text-emphasized: gray-900`, `--sail-color-background-offset: gray-50`.

### Tabellenzeilen – belegte Metriken `[CSS]`

```css
.DataTable-cellInner              { min-height: 20px; margin: 8px }   /* → 36px Zeile */
.DataTable--size--small .DataTable-cellInner { min-height: 16px; margin: 4px }  /* → 24px Zeile */
.DataTableHead-cell               { background-color: var(--sail-color-gray-50);
                                    box-shadow: inset 0 -1px 0 0 var(--sail-color-gray-100) }
.ListViewItem:not(.ListViewItem-header) .ListViewItem-cell
                                  { box-shadow: inset 0 1px var(--sail-color-gray-100) }
.ListViewItem                     { color: var(--sail-color-gray-600) }
```

Zwei Details, die ich für die stärksten Übernahmekandidaten halte:

1. **Trennlinien sind `inset box-shadow`, keine `border`.** Ein Innenschatten belegt keinen Platz im Box-Modell – die Zeilenhöhe bleibt exakt 36px, unabhängig davon, ob eine Linie da ist. Kein `border-collapse`-Ärger, keine doppelten Linien an Gruppengrenzen, keine 1px-Sprünge bei Sticky-Headern.
2. **Zeilenhöhe entsteht aus `min-height` + `margin`, nicht aus `padding`.** Deshalb kann derselbe Zellinhalt in `--size--small` von 36px auf 24px schrumpfen, indem nur zwei Zahlen fallen.

Kopfzeile: `font-size: 11px` `[CSS]` (`html.db-NewChrome .DataTableHead-cell .Text-fontSize--13 { font-size: 11px }` – die Klasse heißt 13, das neue Chrome überschreibt auf 11).

Zellen-Modifikatoren: `--truncate` (ellipsis + nowrap), `--breakWord` (`word-break: break-word`) `[CSS]`.

### Hover in Tabellen `[CSS]`

```css
.ListViewItem--hoverable:hover           { background-color: var(--sail-color-gray-50) }
.ListViewItem--hasLink:hover             { background-color: var(--sail-color-gray-50) }
.db-RecentTransactionsTable-TableRow:hover { background-color: var(--sail-color-background-offset) }
.db-BalanceRow-interactiveChild:hover    { background-color: var(--sail-color-background-offset) }
.bs-Menu-item:hover                      { background-color: var(--sail-gray50); color: var(--sail-gray800) }
```

`gray-50` = `rgb(247,250,252)` gegen weiß `rgb(255,255,255)` – eine Aufhellungsdifferenz von **etwa 3 %**. Genauso zurückhaltend wie bei Linear. Menüeinträge sind die Ausnahme: dort ändert sich zusätzlich die **Textfarbe** (gray→gray800), weil ein Menü kurz und der Kontrastsprung erwünscht ist.

Reveal-on-hover in Tabellen habe ich **nicht** als generelles Muster gefunden – nur punktuell (Spaltenbreiten-Griff: `visibility: hidden → visible`). Ich würde daher **nicht** behaupten, Stripe zeige Zeilenaktionen erst beim Hover. `[CSS]`, negativ belegt.

### Zahlen und Geldbeträge `[CSS]`

Im gesamten 7,3-MB-Dashboard-CSS gibt es **genau zwei** `tabular-nums`-Fundstellen:

```css
.Input[type=number], .Input[type=number]::placeholder { font-feature-settings:"tnum"; font-variant: tabular-nums }
.Text-numericSpacing--tabular                          { font-feature-settings:"tnum"; font-variant: tabular-nums }
```

Das ist eine bemerkenswerte Haltung: Stripe macht Tabellenziffern zur **bewussten Einzelentscheidung pro Stelle** (`Text-numericSpacing--tabular`), nicht zur globalen Regel. Automatisch bekommen nur Zahlen-Eingabefelder es. **Keine Monospace für Geldbeträge** – Beträge laufen in der System-Schrift mit optional zugeschaltetem `tnum`. `--sail-font-monospace: "Menlo","Consolas"` ist Code vorbehalten.

Zum Vergleich Marketing `[CSS]`: dort zusätzlich `font-feature-settings: "ss01" on`, `"sups" 1` (echte Hochstellungen) und `font-variation-settings: "wght" 300 / 400` – Söhne wird als Variable Font mit Gewicht 300 gefahren, was den typischen leichten Stripe-Marketing-Ton erzeugt.

### Was Stripe "premium" macht – konkret

1. System-Schrift im Dashboard: null Webfont-Latenz, native Textdarstellung je Plattform.
2. Handgepflegte CJK-Stacks pro Sprache (`:lang(ja-JP)`, `:lang(zh-Hans)` schalten die Familie um) `[CSS]`.
3. Trennlinien als `inset box-shadow` statt `border` – Zeilenhöhe ist exakt.
4. Ein Dichteschalter (`--size--small`), der 36px auf 24px bringt, ohne den Zellinhalt anzufassen.
5. Größe und Zeilenhöhe als getrennte Token-Familien.
6. Absichtlich beschnittene Abstandsskala (kein 6, kein 40, kein 56).
7. Radien 1–6px, Standard 4px.
8. `tabular-nums` als bewusste Opt-in-Klasse statt globaler Regel.
9. Hover-Kontrast ~3 %, bei Menüs zusätzlich Textfarbwechsel.

---

## 3. Vercel – Dashboard/Observability + Geist

Quelle: `https://vercel.com/geist/{introduction,colors,typography,grid,materials}` `[DOC]` + die ausgelieferten Token-CSS-Chunks unter `/vc-ap-*/_next/static/immutable/chunks/*.css` `[CSS]`. Geist ist als einziges der vier Systeme öffentlich dokumentiert – aber die **Werte** stehen nicht in der Doku, nur die Token-Namen. Ich habe sie aus dem CSS geholt.

### Schriften `[CSS]`

```
--font-geist-sans: "GeistSans", "GeistSans Fallback"
--font-mono:       "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, …
--font-sans:       "Geist", "Inter", -apple-system, BlinkMacSystemFont, …
```
Gewichte: nur **drei** – `normal: 400`, `medium: 500`, `semibold: 600` `[CSS]`. Kein Bold, kein Light.

npm-Paket `geist@1.7.2` `[CSS]` (registry.npmjs.org): Exporte `./font/sans`, `./font/mono`, **`./font/pixel`**, plus Non-Variable-Varianten. Im CSS tauchen fünf Pixel-Schnitte auf: `GeistPixelCircle`, `GeistPixelGrid`, `GeistPixelLine`, `GeistPixelSquare`, `GeistPixelTriangle`.

`font-feature-settings: "rlig" 1, "calt" 0, "ss11" 1` `[CSS]` – Ligaturen für Geist Mono abgeschaltet (`calt 0`), was in Code-/Datenkontexten richtig ist.

### Die vollständige Typo-Skala `[CSS]` – vier Familien, Größe fest an Zeilenhöhe gekoppelt

**Heading** (600, negative Laufweite = −6 % der Größe bei großen Graden):

| Klasse | Größe | Zeilenhöhe | Tracking |
|---|---|---|---|
| `text-heading-14` | 14 | 20 | −0,28px |
| `text-heading-16` | 16 | 24 | −0,32px |
| `text-heading-20` | 20 | 26 | −0,40px |
| `text-heading-24` | 24 | 32 | −0,96px |
| `text-heading-32` | 32 | 40 | −1,28px |
| `text-heading-40` | 40 | 48 | −2,40px |
| `text-heading-48` | 48 | 56 | −2,88px |
| `text-heading-56` | 56 | 56 | −3,36px |
| `text-heading-64` | 64 | 64 | −3,84px |
| `text-heading-72` | 72 | 72 | −4,32px |

Ab 56px ist `line-height = font-size` (Faktor 1,0). Tracking ist exakt **−6 % der Schriftgröße** ab 24px (24→−0,96 = −4 %; 32→−1,28 = −4 %; 40→−2,4 = −6 %; 48→−2,88 = −6 %; 56→−3,36 = −6 %). Unterhalb: −2 % (14→−0,28; 16→−0,32; 20→−0,40).

**Label** (400, für UI-Beschriftungen – die wichtigste Familie für dichte Panels):

| Klasse | Größe | Zeilenhöhe |
|---|---|---|
| `text-label-12` | 12 | **16** |
| `text-label-12-mono` | 12 | 16 |
| `text-label-13` | 13 | **16** |
| `text-label-13-mono` | 13 | 20 |
| `text-label-14` | 14 | **20** |
| `text-label-14-mono` | 14 | 20 |
| `text-label-16` | 16 | 20 |
| `text-label-18` | 18 | 20 |
| `text-label-20` | 20 | 32 |

**Kein Tracking auf Label und Copy.** Nur Headings bekommen negative Laufweite. Und: **jede Label-Stufe hat eine Mono-Zwillingsstufe mit identischer Zeilenhöhe** (12-mono: 12/16, 14-mono: 14/20). Genau das erlaubt, in einer Tabellenzeile Text und Zahl zu mischen, ohne dass die Zeile springt.

**Copy** (400, Fließtext): 13/18 · 13-mono/18 · 14/20 · 14-mono/20 · 16/24 · 18/28 · 20/36 · 24/36
**Button** (500): 12/16 · 14/20 · 16/20

### Raster und Abstände `[CSS]`

```
--spacing: .25rem      → 4px-Basisraster
--geist-space: 4px
--geist-space-small: 32px    --geist-space-medium: 36px    --geist-space-large: 40px
--geist-space-gap: 24px      --geist-space-gap-half: 12px
--geist-form-height: var(--geist-space-medium)   → 36px
--geist-form-font: .875rem                        → 14px
```
**Standard-Steuerelementhöhe: 36px, Schriftgröße darin 14px, Innenabstand `0 14px`** (`.XV7A1G_button { height: var(--geist-form-height); padding: 0 14px }`) `[CSS]`.

Radien (Tailwind-Utilities) `[CSS]`: `xs 2px · sm 4px · (default) 4px · md 6px · lg 8px · xl 12px`.

### Materials – offiziell dokumentierte Elevation `[DOC]` + `[CSS]`

Die Doku (`vercel.com/geist/materials`) benennt acht Stufen mit Radius; das CSS liefert die Schatten:

| Klasse | Radius `[DOC]` | box-shadow `[CSS]` |
|---|---|---|
| `material-base` | 6px | `--ds-shadow-border` |
| `material-small` | 6px | `--ds-shadow-border-small` |
| `material-medium` | 12px | `--ds-shadow-border-medium` |
| `material-large` | 12px | `--ds-shadow-border-large` |
| `material-tooltip` | 6px | `--ds-shadow-tooltip` |
| `material-menu` | 12px | `--ds-shadow-menu` |
| `material-modal` | 12px | `--ds-shadow-modal` |
| `material-fullscreen` | 16px | `--ds-shadow-fullscreen` |

Die Schattenwerte `[CSS]`:
```
--ds-shadow-border-base:  0 0 0 1px #00000014        /* hell */
--ds-shadow-border-base:  0 0 0 1px #ffffff25        /* dunkel */
--ds-shadow-background-border: 0 0 0 1px var(--ds-background-200)
--ds-shadow-small:  0px 1px 2px #00000029 | 0px 2px 2px #0000000a
--ds-shadow-medium: 0px 2px 2px #0000000a, 0px 8px 8px -8px #0000000a
--ds-shadow-large:  0px 2px 2px #0000000a, 0px 8px 16px -4px #0000000a
--ds-shadow-menu:   var(--ds-shadow-border-base), 0px 1px 1px #00000005,
                    0px 4px 8px -4px #0000000a, 0px 16px 24px -8px #0000000f,
                    var(--ds-shadow-background-border)
--ds-shadow-modal:  var(--ds-shadow-border-base), 0px 1px 1px #00000005,
                    0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f,
                    var(--ds-shadow-background-border)
```

Das Bauprinzip ist der Kern: **jeder Schatten beginnt mit einem 1px-Rahmen als `box-shadow` und endet mit einem zweiten Rahmen in der Hintergrundfarbe.** Rahmen und Schatten sind ein einziger Wert – deshalb gibt es in Geist keine Situation, in der Rahmen und Erhebung auseinanderfallen. Und die Schatten sind mehrschichtig mit **negativem Spread** (`-4px`, `-8px`, `-12px`), was den Schatten unter dem Element hält statt ihn seitlich auslaufen zu lassen.

Die Doku formuliert dazu explizite Regeln `[DOC]`: nicht zwei Materials auf demselben Element stapeln; Elevation an das z-index-Band koppeln; niedrigste Stufe wählen, die noch als erhoben liest; "Über-Elevation ist eine häufige Quelle visuellen Lärms"; im Dunkelmodus gegenprüfen, weil Schattenkontrast dort schwächer ist.

Fokus `[CSS]`:
```
--ds-focus-ring: 0 0 0 2px var(--ds-background-100), 0 0 0 4px var(--ds-focus-color)
--ds-focus-color: var(--ds-blue-700) | var(--ds-blue-900)
```
Zwei Ringe: erst 2px in Hintergrundfarbe (Luft), dann 2px in Fokusfarbe.

### Farbsystem `[DOC]` + `[CSS]`

Zehn Skalen (`backgrounds`, `gray`, `gray-alpha`, `blue`, `red`, `amber`, `green`, `teal`, `purple`, `pink`), je 10 Stufen 100–1000, mit **fest zugewiesener Funktion je Stufe** `[DOC]`:

```
100–300  Komponenten-Hintergrund (Ruhe / Hover / Aktiv)
400–600  Rahmen               (Ruhe / Hover / Aktiv)
700–800  Kontraststarke Flächen
900–1000 Text und Icons
```

Das ist der wichtigste Gedanke des ganzen Systems: **die Stufennummer sagt, wofür die Farbe da ist.** `gray-400` ist nie ein Hintergrund, `gray-1000` nie ein Rahmen. Damit kann man ein Panel bauen, ohne über Farbe nachzudenken.

Dunkelmodus-Werte `[CSS]` (`.dark, .dark-theme, .invert-theme`):
```
--ds-background-100: #000        --ds-gray-500:  #454545
--ds-background-200: #000        --ds-gray-600:  #878787
--ds-gray-100: #1a1a1a           --ds-gray-700:  #8f8f8f
--ds-gray-200: #1f1f1f           --ds-gray-800:  #7d7d7d
--ds-gray-300: #292929           --ds-gray-900:  #a0a0a0
--ds-gray-400: #2e2e2e           --ds-gray-1000: #ededed

--ds-gray-alpha-100: #ffffff12   --ds-gray-alpha-500: #ffffff3d
--ds-gray-alpha-200: #ffffff17   --ds-gray-alpha-600: #ffffff82
--ds-gray-alpha-300: #ffffff21   --ds-gray-alpha-900: #ffffff9c
--ds-gray-alpha-400: #ffffff24   --ds-gray-alpha-1000: #ffffffeb
```
Hell zum Vergleich: `background-100: #fff`, `gray-100: #f2f2f2`, `gray-1000: #171717`.

Beachten Sie **`gray-700: #8f8f8f` und `gray-800: #7d7d7d` sind in beiden Themes identisch** – die Skala ist so gebaut, dass die Mitteltöne themeneutral sind. Und: gray-800 ist *dunkler* als gray-700, die Skala ist an dieser Stelle nicht monoton.

Jede Farbe existiert dreifach `[CSS]`: als Hex, als `lab()` (P3-fähige Anzeigen), und als `--*-value` HSL-Tripel für `hsla(var(--x-value), 0.84)`-Konstruktionen. Die Doku sagt dazu nur "P3 colors are used on supported browsers and displays" `[DOC]`.

### Tabellen

Die Geist-Doku hat **keine** Table-Komponentenseite (`/geist/components/table` → 404) `[DOC]`, negativ belegt. Aus dem CSS der Doku-Site selbst `[CSS]`:
```css
.NzWdLG_table tr    { border-bottom: 1px solid var(--ds-gray-400); height: 56px; cursor: copy }
.NzWdLG_table th    { color: var(--ds-gray-1000) }
.NzWdLG_table th, td{ text-align: left !important }
```
56px ist allerdings die **Token-Referenztabelle der Doku**, kein Produkt-Datengrid. Nicht als Vercel-Zeilenhöhe übernehmen. `[?]`

`tabular-nums` ist im Geist-CSS nur als Tailwind-Utility-Gerüst vorhanden (`--tw-numeric-spacing`), nicht als gesetzter Standard `[CSS]`. Für Vercels Observability-Panels selbst habe ich **keine** Zahlen – die Ansicht ist auth-geschützt und liefert kein CSS ohne Login.

### Observability – Interaktionsmechanik `[EDIT]` (https://vercel.com/docs/observability)

Zeitbereich über Datumswähler oder Bereichsschieber. **Im Graphen ziehen, um einen Zeitraum aufzuspannen, dann Schaltfläche "Zoom In"** – nicht Scroll-Zoom. Darunter eine Routenliste, **sortierbar nach Fehlerrate oder Dauer**; Klick auf eine Route öffnet die Funktionsansicht (Latenz, Pfade, externe APIs) mit Direktlink in die Logs. 13 Datenquellen, getrennt nach Team- und Projektebene.

### Was Vercel "premium" macht – konkret

1. Farbstufennummer = Funktion (100–300 Fläche, 400–600 Rahmen, 900–1000 Text).
2. Rahmen und Schatten in **einem** Token; jeder Schatten beginnt mit `0 0 0 1px`.
3. Mehrschichtige Schatten mit negativem Spread.
4. Jede Label-/Copy-Stufe hat eine Mono-Zwillingsstufe mit identischer Zeilenhöhe.
5. Tracking nur auf Headings, ab 24px exakt −6 % der Größe.
6. Nur drei Schriftgewichte.
7. Jede Farbe dreifach (Hex / `lab()` / HSL-Tripel für Alpha-Komposition).
8. Fokusring zweischichtig mit Hintergrundfarb-Luftspalt.
9. Doku benennt Anti-Muster explizit ("Über-Elevation ist visueller Lärm").

---

## 4. Railway

Schwächste Beleglage der vier. Das Dashboard (`railway.com/workspace`, `/dashboard`, `railway.app/workspace`) liefert nur eine leere SPA-Hülle **ohne CSS- oder Script-Verweise im HTML** `[CSS]`, negativ belegt – die Assets werden zur Laufzeit nachgeladen. Was ich habe, ist das CSS der **öffentlichen Seite** plus Hersteller-Doku.

### Schriften `[CSS]` (railway.com, `/assets/globals-C9YcfCsZ.css` u. a.)

```
--font-inter-tight, --font-inter, --font-jetbrains-mono, --font-ibm-plex-serif
font-family: var(--font-inter-tight), var(--font-inter), -apple-system, …
font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, SF Mono, Consolas, …
--inkwell-font-mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, …
```

**Inter Tight** für Überschriften, **Inter** für Text, **JetBrains Mono** für Code/Zahlen. Inter Tight ist die enger laufende Schwesterfamilie – bewusst gewählt, nicht per `letter-spacing` gefälscht.

### Größen `[CSS]` (Tailwind-Utilities)

```
.text-xs   { font-size: 12px; line-height: 18px }
.text-sm   { font-size: 14px; line-height: 20px }
.text-base { font-size: 16px; line-height: 1.5 }
.text-lg   { font-size: 18px; line-height: 1.5 }
.text-xl   { font-size: 20px; line-height: 1.5 }
```
Bemerkenswert: `xs` und `sm` haben **Pixel-Zeilenhöhen** (18px, 20px), ab `base` sind es Verhältnisse. Genau die Grenze zwischen "dichtes UI" und "Fließtext".

### Farben `[CSS]`

```
--bg-oatmeal:      #13111c (dunkel) | #f1f0ef (hell)
--flap-bg:         #0b0b0f | #f4f1ec
--inkwell-bg:          #16181d | #fff
--inkwell-bg-subtle:   #23272e | #f3f4f6
--inkwell-bg-elevated: #1d2025 | #fff
--inkwell-border:        #31363f | #dcdfe4
--inkwell-border-strong: #474e5c | #babfca
--inkwell-text:       #e2e4e9 | #272c35
--inkwell-text-muted: #9da3af | #676f7e
--inkwell-text-dim:   #949ba8 | #717784
--inkwell-accent:     #5593f7 | #0b64f4
--inkwell-radius: 6px
```
`<meta name="theme-color" content="#13111C">` `[CSS]` – Railways Dunkelgrund ist **violettstichig** (13/11/1C: Blau > Rot > Grün), nicht neutral. Das ist ihr Markenzeichen.

### Zahlen `[CSS]`

`font-variant-numeric: tabular-nums` ist vorhanden, aber nur als Tailwind-Utility-Klasse. Kein globaler Standard nachweisbar. JetBrains Mono ist als Familie definiert – für Metrik-/Kostenwerte im Dashboard ist der Einsatz aber **nicht belegt**, weil ich das Dashboard-CSS nicht bekommen habe. `[?]`

### Metrics-Ansicht `[EDIT]` (https://docs.railway.com/reference/metrics)

Vier Metriken: **CPU, Memory, Disk Usage, Network** (ein/aus). Historie **bis 30 Tage**. Zeitreihengraphen mit einem konkreten, sehr guten Detail: **gestrichelte Vertikallinien markieren den Beginn neuer Deployments** – damit korreliert man einen Ressourcensprung sofort mit einem Release, ohne die Ansicht zu wechseln. Bei Replikaten Umschalter **Sum** (aggregiert; Netzwerk gibt es nur hier) vs. **Replica** (einzeln, zum Aufspüren einzelner ausreißender Replikate/Regionen). Kein Application-Level-Telemetry (keine Latenz, keine Fehlerrate).

### Kostendarstellung `[EDIT]` (https://docs.railway.com/reference/pricing)

Preise werden **doppelt** angegeben – Monatsrate und Minutenrate:
```
RAM             $10 / GB / Monat      ($0.000231 / GB / Minute)
CPU             $20 / vCPU / Monat    ($0.000463 / vCPU / Minute)
Netzwerk-Egress $0.05 / GB
Volume-Storage  $0.15 / GB / Monat
```
Sechs Nachkommastellen bei der Minutenrate. Rechnung getrennt in Abo-Grundbetrag und Verbrauch ("cost per unit × used units"). Eine Usage-Detailseite (`/guides/usage`, `/reference/usage`, `/reference/pricing/usage`) existiert unter diesen URLs nicht (404) `[EDIT]`, negativ belegt.

### Changelog-Spur zur Oberfläche `[EDIT]` (https://railway.com/changelog)

`2026-03-20` neues Dashboard-Layout · `2025-10-03` HTTP-Service-Metriken · `2025-09-26` Replica-Metriken · `2025-09-05` Logs-Panel · `2024-06-21` **"Improved Cost Charts"** · `2024-05-31` **Observability Dashboard** · `2023-02-03` "New Faster Service Metrics".

### Was Railway "premium" macht – konkret (schwächer belegt)

1. Inter Tight als eigene, enger laufende Familie statt gefälschtem Tracking.
2. Violettstichiger Dunkelgrund (`#13111c`) als Markenentscheidung.
3. Deployment-Marker als gestrichelte Linien direkt im Metrikgraphen.
4. Sum/Replica-Umschalter statt einer Ansicht, die beides verwischt.
5. Kosten in zwei Granularitäten gleichzeitig (Monat + Minute, 6 Nachkommastellen).
6. Pixel-Zeilenhöhen für ≤14px, Verhältnisse ab 16px.

---

## Quervergleich – was für ein dichtes, dunkles Kostenpanel zählt

| | Linear | Stripe Dashboard | Vercel Geist | Railway |
|---|---|---|---|---|
| UI-Basisgröße | **13px** (`small`) | **13–14px** | **13–14px** (`label`) | 14px (`text-sm`) |
| Kleinste Stufe | 10px (`tiny`) | 11px | 12px | 12px |
| Sans | Inter Variable | **System-Stack** | Geist Sans | Inter / Inter Tight |
| Mono | **Berkeley Mono** | Menlo/Consolas | Geist Mono | JetBrains Mono |
| Gewichte | 300/400/**510/590/680** | 300/400/500/700 | 400/500/600 | – |
| Raster | 4px (+2px fein) | **4px, beschnitten** | 4px (`--spacing:.25rem`) | 4px (Tailwind) |
| Standardradius | 4–6px (`--app-radius:12px` Rahmen) | **4–6px** | 6px Fläche / 12px schwebend | 6px |
| Zeilenhöhe Liste | **24 / 28px** | **36px** (small: 24px) | – (n. belegt) | – |
| Trennlinie | `.5px` hairline | **`inset box-shadow`** | im Schatten-Token enthalten | – |
| Row-Hover | `#ffffff04`–`#ffffff05` (~2 %) | `gray-50` (~3 %) | – | – |
| tabular-nums | **global + `slashed-zero`** | **Opt-in-Klasse** | Utility, kein Standard | Utility |
| Mono für Beträge | nein | nein | nein | n. belegt |

**Der gemeinsame Nenner aller vier:** 13px UI-Basis, 4px-Raster, kleine Radien (4–6px), Row-Hover unter 5 % Kontrastdifferenz, Tabellenziffern **ohne** Monospace. Kein einziges der vier Produkte setzt Geldbeträge in Monospace – sie nehmen die Textschrift mit `tabular-nums`.

**Die drei übertragbarsten Einzeltechniken**, geordnet nach Aufwand/Wirkung:
1. **Stripes `inset box-shadow` statt `border` für Zeilentrenner** – löst Zeilenhöhen-Drift, doppelte Linien und Sticky-Header-Sprünge in einem Zug.
2. **Vercels Kopplung von Rahmen und Schatten in einem Token** – macht es unmöglich, ein Panel mit Schatten aber ohne Rahmen zu bauen.
3. **Linears nach Elementgewicht gestaffelte Hover-Deckkraft** (Zeile ~2 %, Button ~5 %) plus `@media (any-hover: hover)`.

### Vollständige Quellenliste

Doku/Editorial: [vercel.com/geist/introduction](https://vercel.com/geist/introduction) · [/colors](https://vercel.com/geist/colors) · [/typography](https://vercel.com/geist/typography) · [/materials](https://vercel.com/geist/materials) · [/grid](https://vercel.com/geist/grid) · [vercel.com/docs/observability](https://vercel.com/docs/observability) · [linear.app/blog/how-we-redesigned-the-linear-ui](https://linear.app/blog/how-we-redesigned-the-linear-ui) · [linear.app/method/introduction](https://linear.app/method/introduction) · [linear.app/docs/insights](https://linear.app/docs/insights) · [stripe.com/blog/connect-front-end-experience](https://stripe.com/blog/connect-front-end-experience) · [docs.railway.com/reference/metrics](https://docs.railway.com/reference/metrics) · [docs.railway.com/reference/pricing](https://docs.railway.com/reference/pricing) · [railway.com/changelog](https://railway.com/changelog) · [registry.npmjs.org/geist](https://registry.npmjs.org/geist/latest)

Produktions-CSS (Token-Werte): `b.stripecdn.com/dashboard-fe-statics-srv/assets/dashboard.*.css` (8 Dateien, 7,3 MB) · `static.linear.app/web/_next/static/css/*.css` (54 Dateien) · `vercel.com/vc-ap-*/_next/static/immutable/chunks/*.css` (5 Dateien) · `b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/*.css` (5 Dateien) · `railway.com/assets/*.css` (4 Dateien)

**Nicht belegbar geblieben:** Vercel-Dashboard-/Observability-Panelmetriken (auth-geschützt), Railway-Dashboard-Tokens (SPA lädt Assets zur Laufzeit), Stripe "Sonar" (String im Marketing-HTML, Rolle unklar), Reveal-on-Hover-Aktionen in Stripe-Tabellen (negativ belegt – existiert dort nicht als generelles Muster).