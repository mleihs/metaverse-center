# Abhängigkeits-Durchgang, 29. August 2026

Was genommen wurde, was nicht, und woran das jeweils gemessen ist. Die
zurückgestellten Pakete sind der eigentliche Inhalt dieses Dokuments — ein
Upgrade, das durchgeht, braucht keine Begründung.

Ausgangswert vor jeder Änderung erhoben und als Bezugspunkt festgehalten:
`tsc` + `tsc -p tsconfig.tests.json` sauber, biome ohne Befund, 16 Lint-Gates
grün, 1000 Frontend-Tests in 51 Dateien, 3688 Backend-Tests, Produktionsbuild
erfolgreich.

## Übersicht

| Paket | von | nach | Ergebnis |
|---|---|---|---|
| fastapi | 0.141.1 | — | **schon die neueste Fassung**, nichts zu tun |
| starlette | 1.6.0 | — | dito |
| 25 npm-Pakete (in-range) | | | genommen |
| 26 Python-Pakete | | | genommen |
| marked | 17.0.6 | 18.0.11 | genommen, mit neuer Testabdeckung |
| web-vitals | 5.3.0 | 6.2.1 | genommen |
| three (+ @types) | 0.184.0 | 0.185.1 | genommen |
| **maplibre-gl** | 5.24.0 | 6.6.0 | **zurückgestellt** — lädt seinen Stil nicht |
| **typescript** | 6.0.3 | 7.0.2 | **zurückgestellt** — bricht `lit-analyzer` in CI |

## maplibre-gl 6.6.0 — zurückgestellt

Besteht jede statische Prüfung: `tsc` gegen die v6-eigenen Typdeklarationen ist
sauber (das komplette Options-Objekt in `SimulationWorldMap._initMap`, inklusive
`cooperativeGestures`, typisiert durch), 1010 Tests grün, Produktionsbuild
erfolgreich. Im Browser gegen das gebaute Bündel gemessen ist es trotzdem kaputt:

```js
new Map({
  container: el,
  style: { version: 8, sources: {},
           layers: [{ id: 'bg', type: 'background',
                      paint: { 'background-color': '#123456' } }] },
  center: [0, 0], zoom: 2,
});
// nach 6 s:  loaded() === false,  isStyleLoaded() === false
// kein 'load'-Ereignis, kein 'error'-Ereignis, nichts in der Konsole
```

Ein Stil aus einer einzigen Hintergrundebene wird nicht fertig. Konstruktor,
WebGL2-Kontext, `NavigationControl` und `Marker` funktionieren dabei — der Canvas
steht (3456×1852), die Bedienelemente liegen im DOM. Es bleibt nur beim Laden
hängen.

Für die Atlas-Ansicht hiesse das: dauerhafter Ladezustand, ohne Fehlermeldung und
damit ohne Sentry-Ereignis. Das ist schlimmer als ein Absturz.

### Nebenbefund: der falsche Verdächtige

Im Dev-Server scheiterte die Karte zuerst mit `MapLibreCtor is not a constructor`.
Das war **nicht** v6, sondern veraltete Vite-Dep-Metadaten aus der v5-Zeit.
rolldown-vite wickelte den dynamischen Import in seine CJS-Interop:

```js
import('/node_modules/.vite/deps/maplibre-gl.js?v=…')
  .then(m => interop(m.default, 1))   // <- greift auf .default
```

maplibre 5 **hat** einen Default-Export, v6 nicht — der Namensraum kam als
`{ default: undefined }` an. Nach `rm -rf node_modules/.vite` ist der Transform
ein blanker Import. Der Produktionsbuild war nie betroffen; im gebauten Chunk
steht `[{Map:t, NavigationControl:i, Marker:a, Popup:o}] = await Promise.all([...])`,
also direkt aus dem Namensraum.

Merksatz: ein Dev-Server-Fehler nach einem Paketwechsel ist erst dann ein Befund
über das Paket, wenn er einen geräumten Cache überlebt.

## typescript 7.0.2 — zurückgestellt

TypeScript 7 ist die native Portierung (plattformspezifische Binärdateien unter
`@typescript/typescript-darwin-*`, `tsc` bleibt der Einstiegspunkt). Die
Typprüfung selbst ist einwandfrei und deutlich schneller:

| | `tsc --noEmit` über `frontend/src` |
|---|---|
| 6.0.3 | 3579 ms |
| 7.0.2 | **922 ms** |

Beides mit exit 0 und leerer Ausgabe, `tsconfig.tests.json` ebenso, 1010 Tests
grün, `npm run build` (also `tsc && vite build`) erfolgreich. Negativprobe
gefahren, damit „exit 0" nicht „nichts geprüft" bedeutet:

```
src/_ts7probe.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

**Der Blocker liegt woanders:** `lit-analyzer` konsumiert die JavaScript-Compiler-API
über `require('typescript')`, und die liefert die Go-Portierung nicht mehr.

```
node_modules/lit-analyzer/lib/cli/compile.js:28
  … target: typescript_1.ScriptTarget.Latest …
TypeError: Cannot read properties of undefined (reading 'Latest')
```

`npm run lint:lit` läuft in CI (`.github/workflows/ci.yml:38`), das Gate würde also
rot. Wieder aufnehmen, sobald lit-analyzer TypeScript 7 unterstützt — der
Geschwindigkeitsgewinn ist es wert.

## marked 18 — genommen, aber erst nach Absicherung

`src/utils/markdown.ts` rendert jede Chat-Antwort und jede Lore-Passage und hatte
**keinen einzigen Test**. Das Grün der 1000 bestehenden Tests sagte über diesen
Sprung deshalb nichts aus.

Neu: `frontend/tests/markdown-render.test.ts`, 10 Fälle auf der Ausgabe. Geprüft
wird, was ein Hauptversionswechsel bewegen kann — die Code-Block-Hülle des
eigenen `code`-Renderers, das Sprachlabel, die hljs-Spans, die GFM-Konstrukte,
und vor allem, dass der Kopier-Knopf den **rohen** Quelltext trägt statt des
hervorgehobenen Markups (die walkTokens-LIFO-Reihenfolge, die genau dafür
existiert). Gegenprobe: dieselben 10 Fälle laufen unter marked 17 **und** 18
identisch durch.

### DOMPurify ist unter happy-dom wirkungslos

Beim Schreiben dieser Tests gemessen, mit dompurify 3.4.12, identisch unter
happy-dom 20.8.9 und 20.12.0 — also keine Folge dieses Durchgangs:

```
DOMPurify.isSupported                            -> true
sanitize('<h2>x</h2><script>alert(1)</script>')  -> 'x<script>alert(1)</script>'
```

Exakt verkehrt herum: das erlaubte Element fliegt raus, das verbotene bleibt.

Die Folge ist wichtiger als die Ursache: **eine XSS-Behauptung in dieser Testsuite
beweist nichts, in keine Richtung.** Ein grüner Test wäre ein falsches Grün. Die
neuen Tests machen deshalb keine und stellen DOMPurify auf Identität, damit das
Geprüfte ehrlich `marked` zuzuschreiben ist.

Die Sanitizer-Grenze selbst ist statische Konfiguration (`PURIFY_CONFIG` /
`CHAT_PURIFY_CONFIG`), die sich nicht bewegt, wenn marked sich bewegt. Sie zu
prüfen braucht ein echtes DOM — jsdom als zusätzliche Entwicklungsabhängigkeit
oder die vorhandene Playwright-Strecke. Offener Punkt.

## Was der Durchgang nebenbei ans Licht brachte

Siehe `baf4f156`. Kurz: der gemeinsame Supabase-Fluent-Mock kannte 17 von 26
Kettenmethoden und war achtmal von Hand nachgebaut; zwei Testdateien bestanden
nur im Verbund und waren einzeln aufgerufen rot, weil der prozessweite
Plattform-Admin-Cache zwischen Dateien leckte. Beides an der Wurzel behoben,
17. Lint-Gate (`scripts/lint-chain-mock-covers-postgrest.sh`) hält die
Methodenliste an den echten Aufrufstellen fest.
