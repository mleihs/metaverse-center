# Messprotokoll

Alles im gerenderten Blatt gemessen (`getComputedStyle` + gerechnete Relativluminanz), nicht aus der Tokentafel abgeschrieben.

## 1 · Kontrast jedes Textelements gegen seinen echten Grund
- **1 155 Paarungen** geprüft: jedes Element mit eigenem Textknoten in allen neun Artboards, Vordergrund gegen den tatsächlich darunterliegenden Grund (Alpha-Stapel aufgelöst), Schwelle nach Schriftgröße und Zeichenart (4,5 : 1 Text · 3 : 1 Zeichen und ≥ 24 px).
- **Erster Lauf: 26 Durchfaller.** Ursache in allen Fällen: `--k-ink-4` (Zeichenton) trug Satz — „abgeleitet, nicht gewählt", „⚑ Platzhaltername", Wochentage Mo/Mi/Fr/So (9 px), die Klassenzahl „0" im Achsenbruch, der Trenner „|". Gemessen 3,36 (dunkel) bzw. 2,91 (Atlas) gegen nötige 4,5.
- **Zusätzlich gefunden:** Atlas-`--k-ink-4` stand noch auf `#7c8781` — ein früherer Austausch hatte den String nicht getroffen und still nichts getan. 2,91 auf `raised`, nötig 3. Ersetzt durch `#6b7a72` (3,82 / 3,53 / 3,23).
- **Zweiter Lauf: 0 Durchfaller** bei 1 155 Paarungen.
- **Selbsttest des Tors:** ein absichtlich falsches Element (`#2a2a2a` auf `#171717`, 1,25 : 1) eingehängt — das Tor hat es gemeldet. Es hat also hingesehen.

## 2 · Token × Grund × Skin
- **126 von 126 Zellen** (21 Tokens × 3 Gründe × 2 Skins; `--k-page` ist der Bezug, nicht Gegenstand). 105 aus dem Browser gelesen, 21 Alpha-Tokens (`color-mix` mit `transparent`) arithmetisch über jedem Grund gerechnet — `getComputedStyle` gibt sie nicht als rgb zurück.
- **Ein Durchfaller:** `--k-hatch` `#5c5c5c` = 2,68 auf `raised` bei Schwelle 3 (die Tafel hatte 2,7 notiert und trotzdem „3 : 1" behauptet). Ersetzt durch `#666666` → 3,45 / 3,12 / 3,53.
- **Zwölf notierte Werte waren daneben** und stehen jetzt gemessen in der Tafel, z. B. `--k-rule` dunkel notiert 2,0/1,6/2,1 → gemessen 1,57/1,42/1,60; Atlas-`--k-rule` notiert 3,1 → gemessen 2,52.
- `--k-hover` in beiden Skins unter 1,15 : 1 (1,06–1,09), wie verlangt.

## 3 · Zellzustände
- Sechs Zellen je **140 px**; in der Belegspalte haben alle sechs Zeilen die rechte Kante bei **258 px** — die Spaltenkante springt nicht.
- **15 Paare** geprüft, **0 ohne Farbe verwechselbar**: sechs verschiedene Glyphen, vier Helligkeitsstufen (L 0,784 / 0,352 / 0,254 / 0,147), eine Textur. `$0.0030` und `$0.00` teilen die Helligkeit, unterscheiden sich im Zeichen; `·` und `—` ebenso.

## 4 · Zahlen
- Modelltabelle: 10 Zeilen, **1 646** Aufrufe, **$11.8704** ≈ $11.87.
- Weltentabelle: 11 Zeilen, **1 646**, **$11.87**, Anteile **100,0 %**.
- Ausgangsliste: 5 Kategorien, **1 646**, **$11.87**.
- Rest: die zehn Modellanteile addieren zu **99,8 %** (Rundung, Sammelzeile 0,003 %) — steht als Notiz an der Spalte, statt eine Zahl zu frisieren.
- Bänder: 1 126 (Text, > 0 bis $0.005) + 0 (Lücke) + 314 (Bild, ≥ $0.025) = 1 440; + 206 ohne Betrag = **1 646**.

## 5 · Browser-Chrome
1 `select`, 1 `input[type=date]`, 1 Autofill-Eingabe, 1 echte Scrollfläche (alle in 1i) — alle vom Browser gezeichnet, alle nur über `color-scheme` erreichbar. Als Zeile in der Tokentafel vermerkt.

## 6 · 4K
Alle 22 Tokens im 3840-Board gegen das 1440-Board aufgelöst: **0 Abweichungen**. Für die Breite ist kein Farbwert angefasst, nur vier Rasterregeln in einer Container-Query. Zeilenhöhe in beiden Boards gemessen: **42 px** (min-height 28 + Polsterung 6/10 + zweite Zeile Zählbasis).
