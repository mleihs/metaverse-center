# Handoff: Kostenpanel „Kontor"

Kosten- und Telemetriepanel für das Admin-Panel von metaverse.center. **Arbeitswerkzeug für genau eine Person** (die Betreiberin), kein Verkaufsbild: Dichte erwünscht, Schmuck nicht. Datenstand: Momentaufnahme 05.09.2026, 1 646 Zeilen, $11.87, 05.04.–05.09.2026.

## Über die Dateien
**Design-Referenzen in HTML**, kein Produktionscode. Umsetzung nach den Regeln von `velgarien-rebuild/frontend` (Lit 3 + Preact Signals + TS): Farben nur über Tokens, Headings `var(--font-brutalist)`, Mikro-Labels mono, jeder String über `msg()`, WCAG AA.

| Datei | Inhalt |
|---|---|
| `Kostenpanel Kontor.dc.html` | Das Blatt mit allen neun Artboards + Tokentafel + Rückfragen |
| `Kontor Panel.dc.html` | Das Panel selbst (Modi `full` / `kacheln` / `tabelle`), dreifach eingebettet |
| `kontor-tokens.css` | Die Tokenmenge, beide Skins, gemessene Kontraste als Kommentar |
| `TODO-OPUS.md` | Bauanweisung: Tokens, Reihenfolge, Lücken, Fallen |
| `notes/messprotokoll.md` | Was gemessen wurde, mit welchen Zahlen (inkl. der gefundenen Fehler) |

Die `_ds/*`-Links in den beiden `.dc.html` zeigen auf die Projektwurzel und laufen im Ordner ins Leere — für das Aussehen irrelevant, die Tokenmenge liegt daneben.

## Lesereihenfolge
1. **Main** (1440 × 1600, dunkel) — das ganze Panel in Ruhe. Fünf Ebenen: Kopfkacheln → ein Hauptdiagramm → Aufschlüsselungen → Tabelle (fest unter dem Diagramm) → Einzelaufruf nur über Klick.
2. **Atlas** (1440 × 1600) — dasselbe Markup, nur `data-skin="atlas"`. Die Probe, dass kein Bauteil zwei Paletten kennt.
3. **Zellzustände** (880 × 520) — die sechs Zustände einer Zelle, Legende darüber. Der eigentliche Beitrag des Panels: 206 von 1 646 Zeilen (12,5 %) sind „kein Wert erfasst".
4. **Kacheln** (880 × 560) — die Kopfzeile allein, beide Skins untereinander, inklusive invertierter Delta-Semantik (▲ +12 % ist schlecht).
5. **Tabelle** (1200 × 900) — Spaltensatz, Sortierzustand, Balken in der Zelle, aufgeklappte Zeile, Sammelzeilen „Sonstige" und „ohne Angabe".
6. **Achsenbruch** (880 × 640) — die Betragsverteilung einmal ohne Bruch (unlesbar) und einmal mit. Zwischen $0.005 und $0.025 liegt keine der 1 646 Zeilen.
7. **Leer** (880 × 480) — wie eine leere Achse aussieht, ohne wie ein Fehler zu wirken: „BYOK nie benutzt" (echte Null) gegen „Nutzerachse existiert nicht" (kein Wert).
8. **Main bei 3840** (3840 × 1200) — was bei 4K passiert: zwei Zonen statt einer Spalte, feste Text- und Betragsspalten, wachsende Balkenspalte, gleiche Zeilenhöhe.
9. **Polaritätsprobe** (880 × 460) — Laufzeitwechsel des Skins ohne Neuladen, mit `select`, Datumsfeld, Autofill-Feld und echter Scrollfläche: die vier Stellen, die der Browser zeichnet.

Darunter auf dem Blatt: **Tokentafel** (Rolle · Wertzahl · Schwelle · gemessener Kontrast auf page/raised/sunken, eckige Klammer = der Grund, gegen den entschieden wurde) und **Rückfragen** (drei Widersprüche im Auftrag, einer im Entwurf).

## Interaktiv im Prototyp
Kachel klicken = Datenquelle des Diagramms (Stripe-Muster; Kacheln und Diagramm sind ein Bedienelement) · Spaltenköpfe der Modelltabelle sortieren · Zeile in der Tabellen-Ansicht klappt die Einzelaufrufe auf · Knopf in 1i kippt den Skin.
