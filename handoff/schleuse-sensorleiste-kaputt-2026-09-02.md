# Die Sensor-Leiste ist kaputt — gesehen auf Prod, 02.09.2026 12:39

**Sofortnotiz auf Zuruf des Nutzers beim ersten Blick auf die live geschaltete
Schleuse** (`/admin` → Reiter „Schleuse", elf Adapter, Breite 1440).
Screenshot: `screenshot-1788345568935-2.png`.

Nichts davon ist eine Geschmacksfrage. Fünf Befunde, vom Schwersten zum
Leichtesten.

---

## 1. ⚠ Die Klassifikation wird gar nicht benutzt (der eigentliche Fehler)

`IntakeView._renderSensors` rechnet die Quellenklasse INLINE aus:

```ts
.kind=${a.requires_api_key && !a.available ? 'nokey'
      : a.is_structured ? 'structured'
      : 'llm'}
```

Daneben steht in `types/intake.ts` die Funktion `sourceKindOf(name, info)`, die
genau diese Frage beantwortet — mit sechs Klassen statt drei, mit der
begründeten Reihenfolge (`nokey` vor allem anderen) und mit den Mengen
`SEMI_ADAPTERS` / `SOCIAL_ADAPTERS` / `INTERNAL_ADAPTERS`. Sie ist getestet
(sechs Tests) und wird von der einzigen Stelle, die sie braucht, **nicht
aufgerufen**.

Folge auf dem Schirm: Bluesky steht als „MODELL" (Bernstein) da, obwohl es
`semi` ist (violett); WHO und HackerNews ebenso; `internal` und `social` können
überhaupt nicht auftreten. Die Kachel behauptet einen Kostenpunkt, den es nicht
gibt — „MODELL" heisst „kostet einen Klassifikationsaufruf".

🔑 **Wieder dieselbe Familie: eine Funktion, ein Test, ein grünes Tor — und
kein Aufrufer.** Der Test prüft die Zuordnung, nicht dass jemand sie benutzt.

**Reparatur:** `sourceKindOf(a.name, a)` aufrufen. Ein Test, der die View gegen
die Funktion bindet, gehört dazu — sonst rutscht es beim nächsten Umbau zurück.

## 2. Jeder Adaptername ist abgeschnitten

    BLUE… DISE… GDAC… GDEL… THE … HACK… NASA… NEWS… NOAA… USGS… WHO …

Elf Kacheln in `repeat(11, minmax(0, 1fr))` auf ~810 px Mittelspalte = 73 px je
Kachel. `.name` hat `text-overflow: ellipsis` und tut brav, was dasteht — nur
bleibt von jedem Namen nichts übrig. **Die Leiste war für zehn Kacheln
entworfen und auf 1600 px gemessen; sie steht hier im Admin-Panel, das enger
ist, und hat seit heute elf.**

**Reparatur:** kein fester `repeat(N, 1fr)`, sondern
`repeat(auto-fill, minmax(120px, 1fr))` — dann bricht die Leiste in eine zweite
Zeile um, statt die Namen zu verschlucken.

## 3. Das Klassenwort läuft über den Kachelrand

„STRUKTURIERT" und „KEIN SCHLÜSSEL" stehen über die Kachelgrenze hinaus im
Nachbarn. `.class` hat — anders als `.name` — weder `overflow: hidden` noch
`text-overflow`. Das ist ein reiner Fehler, unabhängig von der Breite.

## 4. Die Kacheln sind unterschiedlich hoch

Die Guardian-Kachel ist höher als ihre Nachbarn, weil „KEIN SCHLÜSSEL" auf zwei
Zeilen umbricht. Die Reihe hat dadurch keine gemeinsame Grundlinie. `.tile` hat
`min-height: 64px`, aber keine gleiche Höhe im Raster.

## 5. Der Trefferbalken ist unsichtbar

Vier Segmente à 4 px Höhe auf 73 px Breite, alle leer (0 Treffer), grau auf
grau. Er sagt nichts und sieht nach Schmutz aus. Solange keine Trefferzahlen je
Adapter geliefert werden (`ScanCycleMetrics.adapters` hat sie, die Kachel
bekommt sie nicht), sollte er gar nicht erst gezeichnet werden.

---

## Was daran NICHT kaputt ist

Die Leiste zeigt korrekt: 5 von 11 online, Guardian und NewsAPI rot als „kein
Schlüssel" (auf Prod steht tatsächlich kein Plattform-Schlüssel), Bluesky mit
grünem Punkt. Die Zustände stimmen — nur ihre Darstellung nicht.

---

## Behoben am selben Tag (Commit folgt)

Alle fünf. Zusätzlich beim Reparieren **zum vierten Mal an einem Tag** einen
Backtick in einen css-Kommentar geschrieben — das Tor hat ihn gefangen. Und
das Skript, mit dem ich sie entfernt habe, war zu grob: es hat Backticks auch
aus normalen Doc-Kommentaren gestrichen, wo sie hingehören. Sechs Zeilen von
Hand zurückgestellt.

🔑 **Ein Reparaturskript braucht dieselbe Genauigkeit wie das, was es
repariert.** „Alle Backticks in allen Blockkommentaren" beantwortet eine
weitere Frage als die gestellte („Backticks in Kommentaren INNERHALB eines
css-Templates").

---

# Nachtrag: die Frage nach Masonry für die gescannten Beiträge

Der Nutzer schlug am 02.09. eine Masonry-Darstellung (Text + Bild) für die
Sichtung vor, mit Verweis auf `masonry.desandro.com`, und bat um Recherche nach
etwas technisch Reiferem.

## Der Stand der Technik (recherchiert 02.09.2026)

Masonry heisst inzwischen **CSS Grid Lanes** — die Arbeitsgruppe hat den Namen
`grid-template-rows: masonry` zugunsten von `display: grid-lanes` verworfen.

| Browser | Stand |
|---|---|
| Safari 26 | **stabil ausgeliefert** (als erster) |
| Chrome / Edge | hinter Flag, stabil „später 2026" erwartet |
| Firefox | hinter Flag (`about:config` → masonry), Nightly an |

**Nicht Baseline.** Ein Einsatz heute hiesse: Safari bekommt das Gedachte,
alle anderen einen einspaltigen oder gerasterten Rückfall.

Und ein zweiter Befund, der schwerer wiegt als der Browserstand: Manuel
Matuzovic hat gezeigt, dass Grid-Lanes-Layouts **WCAG 2.4.3 (Fokus-Reihenfolge)
reissen**, sobald drei Dinge zusammenkommen — unterschiedliche Elementhöhen,
fokussierbare Elemente in den Karten, und ein breiter Container. Der Browser
setzt jedes Element in die kürzeste Spalte; sichtbar steht es links, in der
Tab-Reihenfolge irgendwo. `flow-tolerance` mildert das nur: man muss den
Vorgabewert (1em) drastisch erhöhen (er nennt bis 40rem), und dann ist die
Spaltenhöhe wieder unausgeglichen — also genau das weg, wofür man Masonry
wollte.

## ⚠ BERICHTIGUNG: „Es gibt keine Bilder" war falsch

Ich hatte geschrieben, der Zufluss liefere überwiegend keine Bilder. Der Nutzer
hat widersprochen — zu Recht. Ich hatte zwei Aussagen verwechselt: dass heute
keine Bilder in der Datenbank liegen, und dass die Quellen keine liefern. Nur die
erste stimmte, und auch die nur, weil auf Prod kein Guardian-Schlüssel steht.

**Jeden Dienst einzeln abgefragt (02.09.2026, echte Antworten):**

| Adapter | liefert | Feld | kommt es an? |
|---|---|---|---|
| guardian | **Teaserbild** | `fields.thumbnail` (wird ausdrücklich mit `show-fields` angefragt) | ✓ |
| newsapi | **Teaserbild** | `urlToImage` → `image_url` | ✓ |
| gdelt | **Teaserbild** | `socialimage` | ✓ |
| bluesky | **Teaserbild** | `external.thumb` | ✓ seit heute |
| who_outbreaks | **Karte/Fallkurve** | `<img src>` im HTML von `Overview` | ✗ → **heute nachgerüstet** |
| gdacs | Warnstufen-Piktogramm | `properties.icon` (`Green/FL.png`) | ✗ (Symbol, kein Teaser) |
| disease_sh | Landesflagge | `countryInfo.flag` | ✗ (Symbol, kein Teaser) |
| usgs_earthquakes | — | — | — |
| noaa_alerts | — | — | — |
| nasa_eonet | — | — | — |
| hackernews | — (die API hat keines; das Bild läge im verlinkten Artikel) | — | — |

**Also: vier von elf liefern ein echtes Teaserbild und geben es weiter, ein
fünfter tut es seit heute.** Die drei ohne sind Messdienste — Erdbeben,
Unwetterwarnungen, Naturereignisse. Das sind keine Nachrichtenbeiträge,
sondern Sensorwerte; sie haben nie ein Bild und werden nie eines haben.

Die Frage des Nutzers — *welche Nachrichtenbeiträge dieser Tage haben denn kein
Teaserbild?* — hat damit die Antwort: **keine.** Jede redaktionelle Quelle im
Zulauf trägt eines.

🔑 **Dritter Fehlalarm desselben Tages durch ein zu enges eigenes Messgerät.**
Mein Grep suchte `"(thumbnail|image_url|thumb|image|icon)"` — mit Anführungs-
zeichen um den ganzen Ausdruck, also den Schlüssel als GANZES Wort. `socialimage`
enthält `image`, heisst aber nicht so, und fiel durch. GDELT galt mir deshalb
als bildlos, obwohl der Adapter das Feld längst behält. (Vgl. der `[a-z_]+`-
Fehlalarm eines Peers am selben Tag, dem Ziffern fehlten.)

## Was das für Masonry ändert — und was nicht

Das Bild-Argument ist damit **weg**: Bilder gibt es, in unterschiedlichen
Seitenverhältnissen, und genau dafür ist Masonry gemacht.

Es bleiben zwei Argumente:

## Warum es für die SICHTUNG trotzdem nicht passt

Zwei Gründe, die unabhängig vom Browserstand und von WCAG gelten:

**1. Es gibt keine Bilder.** Vier der sechs aktiven Quellen (USGS, NOAA, NASA,
GDACS) sind Messdienste — sie liefern Zahlen, nie ein Bild. Die drei Kandidaten
aus dem ersten Prod-Zyklus sind NOAA-Textwarnungen ohne Vorschaubild. Nur
Bluesky (und, mit Schlüssel, Guardian/NewsAPI) bringt eines mit. Masonry löst
ein Problem — stark verschiedene Höhen durch Medien —, das dieser Zufluss
überwiegend gar nicht hat.

**2. Die Sichtung ist eine RANGLISTE.** Sie sortiert nach Passung, Magnitude,
Neuheit oder Netz-Tempo; die Reihenfolge IST die Auskunft. Masonry ordnet
visuell in Spalten um. Wer „die stärksten zuerst" sortiert und dann ein Layout
darüberlegt, das die Reihenfolge zerlegt, hat die Sortierung weggeworfen. Dazu
trägt jede Zeile Knöpfe („In den Eingang", „Verwerfen", Auswahlkästchen) —
genau die fokussierbaren Elemente aus Matuzovics Bedingung.

## Was stattdessen — und es ist trotzdem „kachelig"

Ein **gleichförmiges Kartenraster mit optionalem Bildfach**:

    repeat(auto-fill, minmax(280px, 1fr))
    Bildfach mit aspect-ratio: 16/9, das bei fehlendem Bild WEGFÄLLT
    Überschrift auf drei Zeilen geklemmt (line-clamp)

Das verdaut verschiedene Formate genauso — eine Karte mit Bild und eine ohne
sehen wie Geschwister aus, nicht wie eine kaputte Reihe —, behält Rang und
Tab-Reihenfolge, läuft heute in jedem Browser und braucht keine Abhängigkeit.

## Wo Masonry DOCH richtig wäre

Im **Lesesaal** (Schritt 6): „Eingang in Ruhe lesen", nach Ort/Archetyp/Quelle
gruppiert — eine Stöberfläche, keine Rangliste. Dort trägt die Optik, und der
Rang steht nicht auf dem Spiel. Der Nutzer hat für diesen Zweck ausdrücklich
erlaubt, von der Regel abzuweichen, wenn die Oberfläche sonst leidet.
**Entscheidung des Nutzers (02.09.):** Grid Lanes hat keinen Browser-Support,
also etwas anderes, das Masonry kann.

**Empfehlung: keine Bibliothek, sondern CSS Grid mit Zeilen-Spannweite.**

    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    grid-auto-rows: 8px;            /* feines Raster */
    /* je Karte: grid-row-end: span ceil(hoehe / 8) — aus einem ResizeObserver */

Rund vierzig Zeilen, keine Abhängigkeit, läuft heute in jedem Browser. Und der
entscheidende Vorteil gegenüber Grid Lanes: **die DOM-Reihenfolge bleibt die
Anzeigereihenfolge.** Die Karten füllen von links nach rechts in Quelltext-
Reihenfolge, jede so hoch, wie sie ist — der Boden wird ausgefranst, die
Reihenfolge nicht. Damit entfällt der WCAG-2.4.3-Fehler, den Grid Lanes
mitbringt, vollständig statt ihn mit `flow-tolerance` zu mildern.

Warum keine der fertigen Bibliotheken:

| | |
|---|---|
| Masonry (desandro) | die vom Nutzer verlinkte, jQuery-Ära, ~25 kB, ordnet um |
| Isotope | selber Autor, **kommerzielle Lizenz** für nicht-quelloffene Nutzung |
| Colcade | 2 kB, aber hängt spaltenweise an — zerstört die DOM-Reihenfolge |
| Muuri | kann viel mehr (Ziehen, Sortieren), entsprechend schwer |
| @egjs/infinitegrid | gepflegt, aber ein Rahmenwerk für ein Layout |

Alle bringen dieselbe Umordnung mit, die das Eigenbau-Raster gerade vermeidet —
und eine Abhängigkeit in einem Lit-/Shadow-DOM-Haus mit strenger CSP.

## Voraussetzung, am 02.09. geschaffen

Zwei Adapter tragen ihr Bild jetzt mit, die es vorher wegwarfen:
`bluesky_social.py` (`external.thumb`) und `who_outbreaks.py` (das erste
`<img>` aus dem `Overview`-HTML, gegen die drei jüngsten echten Meldungen
geprüft). Gespeichert wird jeweils die **URL**, kein Blob — sie lebt so lange
wie der Kandidat und verschwindet mit ihm.

## Quellen

- <https://webkit.org/blog/17758/when-will-css-grid-lanes-arrive-how-long-until-we-can-use-it/>
- <https://css-tricks.com/masonry-layout-is-now-grid-lanes/>
- <https://matuzo.at/blog/2026/grid-lanes-accessibility>
- <https://caniuse.com/mdn-css_properties_grid-template-rows_masonry>
