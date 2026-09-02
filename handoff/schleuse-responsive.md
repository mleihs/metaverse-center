# Update: Schleuse — Responsive-Verhalten 1280 → 4K

Ergänzt `schleuse-event-intake.md`. Der Prototyp ist auf 1600 px gezeichnet; dieses Dokument legt fest, wie jede Fläche bei **1280 · 1440 · 1920 · 2560 (1440p) · 3840 (4K)** aussieht. Nichts hier widerspricht dem Hauptdokument — es füllt die Lücke „fluid ab 1280".

## Repo-Infrastruktur, die genutzt werden MUSS (nicht neu erfinden)

Aus `styles/tokens/_layout.css` (Z. 54–68) und `_typography.css` (Z. 130–138):

| Token | Basis | ≥ 1920 | ≥ 2560 |
|---|---|---|---|
| `--stage-measure` | 1920px | — | — (Shell begrenzt `.shell__content` darauf, Z. 338/446) |
| `--stage-gutter` | `--space-12` 48px | `--space-16` 64px | — |
| `--stage-type-scale` | 1 | — | 1.15 |
| `--text-display-sm/md/lg` | — | clamp-Stufen | — |

- `shared/stage-styles.ts` liefert `box-sizing` + Maß-Begrenzung fertig — einbinden statt nachbauen (Kommentar in `_layout.css` Z. 41–44).
- Für Schriften nur `calc(var(--text-…) * var(--stage-type-scale))`; Titel mit eigener Steigung tragen ihre eigene `clamp()` (Muster `SimulationHeader.ts` Z. 237).
- Eine Fläche darf `--stage-gutter` auf ihrem `:host` überschreiben, muss dann aber die 1920er Abfrage mitnehmen (`_layout.css` Z. 50–53).
- **Entscheidung:** `intake` wird **nicht** in `FULL_HEIGHT_VIEWS` (`SimulationShell.ts` Z. 68) aufgenommen. Die Schleuse ist eine scrollende Arbeitsfläche mit Footer, kein Cockpit. Damit gilt oberhalb 2560 automatisch `max-width: var(--stage-measure)` — die View bekommt bei 4K seitlich Rand und wächst nicht auf 3840.
- Ausnahme: Admin-Mount im `AdminPanel` hat keine Stage-Begrenzung — dort dieselbe Regel lokal setzen: `:host { max-width: var(--stage-measure); margin-inline: auto; }`.

## Breakpoints der Schleuse

Nur drei eigene Abfragen, alle als `min-width` (mobile-first ist hier nicht das Ziel — unter 1280 ist die Schleuse eine Liste, s. u.):

```css
/* Basis: 1280–1599 (kompakt) */
@media (min-width: 1600px) { /* Referenz — der Prototyp */ }
@media (min-width: 1920px) { /* weit — Gutter 64, vierte Kammer breiter */ }
@media (min-width: 2560px) { /* Bühne — type-scale 1.15, Maß 1920 zentriert */ }
```

Container-Queries statt Viewport-Queries für alles, was **innerhalb** einer Kammer passiert (Karten, Chips-Umbruch): `container-type: inline-size` auf jeder Kammer, `@container (min-width: 420px)` etc. Grund: Admin-Panel-Mount hat eine Seitenleiste, Simulations-Mount nicht — dieselbe Viewport-Breite ergibt zwei verschiedene Kammer-Breiten.

## Flächen im Detail

### Topbar (42 px)
Fix 42 px bis 2560, dann `calc(42px * var(--stage-type-scale))`. Breadcrumb-Segmente `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` mit `min-width: 0`; unter 1440 fällt „Welt: … ▾" (Admin) in ein Icon-Dropdown, Sensor-Status rechts zeigt nur `● 12/13`.

### Sensor-Leiste
`grid-template-columns: 150px 1fr 150px` bleibt; die Kacheln in der Mitte:

| Breite | Kacheln | Inhalt je Kachel |
|---|---|---|
| 1280–1599 | `repeat(auto-fit, minmax(84px, 1fr))` → zwei Reihen bei 13 Sensoren | Name + Punkt, Klasse; Hits + „vor 4 min" in Tooltip |
| 1600–1919 | `repeat(13, 1fr)` einreihig (Prototyp) | Name, Klasse, 4 Segmente + Zahl, Zeit |
| ≥ 1920 | wie 1600, Kachel-Padding `--space-3 --space-4` | + Kategorie-Kürzel (`Naturk. · Krise`) |
| ≥ 2560 | Leiste auf Maß 1920 begrenzt — identisch mit 1920 | — |

Das Sensor-Gitter ist die einzige Stelle, wo die Sensor-Anzahl (Adapter aus `getDashboard()`) die Spaltenzahl vorgibt: `grid-template-columns: repeat(var(--_n, 13), 1fr)` mit `--_n` aus `this._adapters.length`.

### Quote + Abonnements (`360px 1fr`)
- 1280–1439: `grid-template-columns: 300px 1fr`, Quote-Zahl 30 px, Abo-Karten `repeat(auto-fill, minmax(220px, 1fr))` → 2–3 Karten.
- 1440–1919: Prototyp (`360px 1fr`, 4 Karten).
- ≥ 1920: Abo-Karten `repeat(auto-fill, minmax(240px, 1fr))` → 5–6 Karten; „+ Abonnement" bleibt rechts im Kopf.

### Board — die vier Kammern (`1fr 1.25fr 1fr 1fr`)

Die Quarantäne ist die einzige Kammer, die nicht schrumpfen darf: ihre Karte hat zwei Hälften (Resonanz | Ereignis) und braucht ≥ 400 px Innenbreite. Daraus folgt:

| Breite | Spalten | Verhalten |
|---|---|---|
| < 1280 | `1fr` | Kammern als **Akkordeon-Stapel** (Reihenfolge ①②③④), jede mit eigenem Zähler im Kopf; nur eine aufgeklappt. Sichtung/Lesesaal/Modals werden Vollbild-Sheets. |
| 1280–1599 | `minmax(300px,1fr) minmax(420px,1.3fr) minmax(280px,1fr)` + Kammer ④ **unter** dem Board als horizontaler Streifen (`grid-column: 1 / -1`, Einträge `repeat(auto-fill, minmax(300px, 1fr))`) | Nachhall braucht bei 1280 die Breite nicht; unten ist er lesbar statt gequetscht |
| 1600–1919 | `1fr 1.25fr 1fr 1fr` (Prototyp) | — |
| ≥ 1920 | `1fr 1.25fr 1fr 1.1fr`, Kammer-Padding `--space-4` → `--space-5` | Nachhall wächst leicht (längere Texte) |
| ≥ 2560 | wie 1920, gesamte View auf `--stage-measure` 1920 zentriert, Schriften × 1.15 | Kein fünftes Element, keine sechste Spalte. Die Ruhe der Ränder ist Absicht (siehe SimulationShell-Kommentar Z. 430–445: Vignette + Maß) |

`min-height: 720px` des Boards wird zu `min-height: clamp(560px, 62vh, 940px)` — bei 1440p/4K sonst zu kurz, bei 1280×800 zu lang.

Karten-Innenlayout per Container-Query:

```css
.chamber { container-type: inline-size; }
/* Quarantäne-Karte: zwei Hälften nur ab 400 px Kammerbreite */
@container (max-width: 399px) { .q-card__halves { grid-template-columns: 1fr; } }
/* Button-Zeile: Labels kürzen unter 360 px */
@container (max-width: 359px) { .q-card__actions .label-long { display: none; } .q-card__actions .label-short { display: inline; } }
```

„◈ Dem Bureau melden" → kurz „◈ Melden"; „▣ Nur hier" bleibt; „Linse" wird Icon-Button.

### Modals

Alle Modals bekommen `width: min(<Referenz>, calc(100vw - 2 * var(--stage-gutter)))` und `max-height: calc(100vh - 2 * var(--space-12))`, Körper `overflow: auto`. Referenzbreiten aus dem Hauptdokument:

| Modal | Referenz | ≥ 2560 | Innen-Verhalten unter Referenz |
|---|---|---|---|
| Sichtung | 1500 | 1500 (nicht wachsen; Zeilen werden sonst zu lang zum Lesen) | Sensor-Spalte 230 px → ab < 1400 als klappbare Leiste über der Tabelle; Tabellen-Spalten `28px 1fr 130px 80px 210px` → unter 1200 Innenbreite fallen „Magnitude"-Balken und „Passung" in die Meta-Zeile der Geschichte, Grid `28px 1fr 170px` |
| Lesesaal | 1500 | 1500 | Zeile `1.25fr 1fr 1fr` → unter 1200 `1fr 1fr` (Vorschlag rutscht unter Klassifikation), unter 900 `1fr` |
| Schmelztiegel | 1000 | 1000 | `1fr 4px 1fr` → unter 860 gestapelt (Wirklichkeit oben, Trennbalken horizontal 4 px, Welt unten); Linsen-Grid `80px 1fr` bleibt, Chips umbrechen |
| Resonanz | 680 | 680 | Suszeptibilitätstafel `180px 1fr 150px` → unter 560 `1fr` + Wert rechtsbündig unter dem Balken |
| Melden | 560 | 560 | — |
| Echo | bestehendes Modal | — | — |
| Scan-Log | 1200 | 1200 | Tabelle `90px 1fr 170px 110px 90px 120px` → unter 1000 Kategorie + Gescannt in die Titelzeile |

Sichtung/Lesesaal sind bei 4K **nicht** 2400 px breit: 1500 px Maß, zentriert, Backdrop dunkler (`rgba(0,0,0,.8)`), damit das Board dahinter nicht ablenkt.

### Toast
`right: var(--stage-gutter); bottom: var(--stage-gutter); width: min(400px, calc(100vw - 2 * var(--stage-gutter)))`. Bei ≥ 2560 sitzt er am Rand des **Viewports**, nicht des 1920er-Maßes — das ist gewollt (Systemmeldung, nicht Inhalt).

## Typografie nach Breite

Alle Werte über `--stage-type-scale` (1 bis 2559, 1.15 ab 2560). Nur dort, wo 9 px Mono-Labels bei 4K/100 % physisch zu klein sind, greift zusätzlich ein Mindestmaß:

| Element | Prototyp | Regel |
|---|---|---|
| Mono-Labels (Meta, Chips) | 9–10 px | `max(9px, calc(0.6rem * var(--stage-type-scale)))` — nie unter 9 px, bei 2560 ≈ 11 px |
| Karten-Headline Spectral | 13–14.5 px | `calc(var(--text-sm) * var(--stage-type-scale))` |
| Kammer-Titel Courier | 12 px | `calc(var(--text-xs) * var(--stage-type-scale))` |
| Modal-Titel | 16 px | `calc(var(--text-base) * var(--stage-type-scale))` |
| Quote-Zahl | 36 px | `clamp(30px, 2.25vw, 44px)` — eigene Steigung, da Display-Charakter |
| Terminal-Ausgabe (Schmelztiegel) | 13 px Courier | `calc(var(--text-sm) * var(--stage-type-scale))`, `max-width: 70ch` — Zeilenlänge bleibt lesbar, wenn das Modal breiter wird |

Wer eine Schrift skaliert, skaliert die zugehörige Maximalbreite mit (`_layout.css` Z. 48–49) — betrifft hier: Rationale-Texte in Kammer ④ (`max-width: 48ch`) und Abo-Regeltexte (`max-width: 36ch`).

## Dichte-Regler (optional, empfohlen)

Ein View-lokaler Schalter „Dichte: kompakt · normal" (Tab-Stil, `border-bottom`) im Board-Kopf, persistiert in `localStorage['intake.density']`. „Kompakt" setzt `--_card-pad: var(--space-2)` und blendet Abstracts in Kammer ① aus — für Admins mit 30+ Kandidaten bei 1440p sinnvoller als eine fünfte Spalte.

## Hit-Targets und Pointer

- Alle klickbaren Chips/Buttons `min-height: 32px` (Desktop) — bei `(pointer: coarse)` 44 px, Chip-Padding `--space-2 --space-3`.
- Hold-Button (Resonanz) reagiert auf `pointerdown/pointerup` (nicht `mousedown`), damit Touch auf großen Displays funktioniert. `VelgHoldButton.ts` prüfen.
- Tastatur der Sichtung (↑↓ · Leertaste · ⏎ · x) ist auf allen Breiten identisch; Fokus-Ring `--color-border-focus`.

## Test-Matrix (Playwright oder manuell)

| Viewport | Mount | Prüfen |
|---|---|---|
| 1280×800 | Simulation | Kammer ④ unten als Streifen; Sensor-Kacheln zweireihig; Quarantäne-Karte einspaltig nur wenn Kammer < 400 px |
| 1440×900 | Admin (mit Seitenleiste) | Board dreispaltig + ④ unten (Kammerbreite < 400 durch Seitenleiste) — Container-Query greift, nicht Viewport |
| 1600×1000 | Simulation | = Prototyp |
| 1920×1080 | beide | Gutter 64, vier Kammern, Abo-Karten 5–6 |
| 2560×1440 | Simulation | View auf 1920 zentriert, Vignette sichtbar, Schriften × 1.15, Modals 1500 max, Toast am Viewport-Rand |
| 3840×2160 @ 100 % | Simulation | Mono-Labels ≥ 11 px real; nichts unter 9 px; Board `min-height` ≤ 940 |
| 3840×2160 @ 150 % (effektiv 2560) | — | wie 2560 |

Kontrast-Messung mit `frontend/scripts/measure-contrast-pairs.py` nach dem Bau — gedimmte Labels (`--color-text-tertiary`) bei 9 px sind der kritischste Fall.

## Was sich am Hauptdokument ändert

- Abschnitt „Layout der View": „1600 px Referenz, fluid ab 1280" → Verweis auf dieses Dokument.
- Dateiplan: `IntakeView.ts` bindet `shared/stage-styles.ts` ein; jede Kammer ist ein `container-type: inline-size`-Element.
- Umsetzungsreihenfolge: Schritt 2 (Shell) enthält die drei Breakpoints und die Container-Queries von Anfang an — nachträglich ist es doppelte Arbeit.
