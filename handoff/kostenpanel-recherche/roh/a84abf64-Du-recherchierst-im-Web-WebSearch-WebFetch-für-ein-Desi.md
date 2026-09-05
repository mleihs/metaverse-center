# AUFTRAG

Du recherchierst im Web (WebSearch/WebFetch) für ein Design-Vorbild-Dossier. Antworte auf DEUTSCH. Schreibe KEINE Dateien — gib alles als finale Textantwort zurück.

ZIEL: Der MONOSPACE-/BRUTALISTISCHE Strang für dichte Datenoberflächen. Kontext: dunkles Admin-Panel für KI-Kosten, Schreibmaschinensatz, sehr dichte Zahlen.

Recherchiere KONKRET:
1. Vercel Geist / Geist Mono — Designsystem, vercel.com/geist/... Wo wird Mono für ZAHLEN eingesetzt, wo nicht? Tabellen-Zahlensatz (tabular-nums), Zeilenhöhen, Größenskala.
2. Railway — dessen Oberfläche/Designsprache
3. Warp Terminal — dessen Web-UI und Blocks
4. Zed Editor — dessen UI-Dichte, Schriftwahl
5. Charm / Bubbletea / Lipgloss / Glamour — TUIs als Vorbild für dichte Zahlenlayouts (charm.sh, Beispiel-Screenshots)
6. Berkeley Mono im Einsatz (usgraphics.com) — wer benutzt es? Beispielseiten.
7. Weitere echte terminal-inspirierte Weboberflächen, die NICHT nach Kostüm aussehen: z.B. Val Town, Bun-Doku, Deno, Turso, Neon, Modal, Baseten, Cloudflare-Dashboard, Supabase, Sourcegraph, Oxide Computer (oxide.computer — deren Konsole ist bekannt für Dichte + Mono), Linear, Raycast, Terminal.shop, Hyperdx.
8. TYPOGRAFIE-DETAILS die zählen: tabular-nums / font-variant-numeric, slashed zero, Ausrichtung von Zahlen rechtsbündig, Dezimalausrichtung, wie man USD-Beträge mit unterschiedlicher Stellenzahl setzt.
9. WO KIPPT BRUTALISMUS IN UNLESBAR? Konkrete Kritiken/Artikel zu brutalistischem Webdesign und Lesbarkeit, Kontrastfallen, Monospac

---

# Design-Vorbild-Dossier: Monospace-/Brutalistischer Strang für dichte Datenoberflächen

**Wichtiger Vorbehalt zur Methodik:** Das WebSearch-Kontingent dieser Sitzung war zu Beginn der Recherche bereits vollständig erschöpft (200/200, sitzungsweit geteilt). Die gesamte Recherche musste über WebFetch mit direkt geratenen/bekannten URLs erfolgen. WebFetch fasst Inhalte über ein kleines Modell zusammen und liefert bei vielen Marketing-Seiten nur oberflächliche Aussagen; mehrere Ziel-URLs lieferten 403/404 (unten einzeln markiert). Die Befunde unten sind entsprechend unterschiedlich tief — wo nur Marketingtext oder Login-Schranken vorlagen, steht das ausdrücklich dabei.

---

## 1. Vercel Geist / Geist Mono

Quellen: [vercel.com/geist/introduction](https://vercel.com/geist/introduction), [vercel.com/geist/typography](https://vercel.com/geist/typography), [vercel.com/geist/text](https://vercel.com/geist/text), [vercel.com/geist/table](https://vercel.com/geist/table), [vercel.com/geist/colors](https://vercel.com/geist/colors), [vercel.com/geist/grid](https://vercel.com/geist/grid), [vercel.com/font](https://vercel.com/font)

- **Konkretester Fund des gesamten Dossiers:** Die Geist-Tabellen-Dokumentation sagt wörtlich: *„Apply `tabular-nums` (or Geist Mono) to numeric columns so digits align across rows for comparison."* Das ist exakt die Regel, die für ein KI-Kosten-Panel zählt — numerische Spalten bekommen entweder `font-variant-numeric: tabular-nums` ODER Geist Mono, nicht beides zwingend, aber eins von beiden.
- Tabellen-Komponente kennt Dichte-/Darstellungs-Props: `striped`, `bordered`, `interactive`, `virtualize` (letzteres für große Datenmengen — relevant für lange Kostenlisten).
- Typografie-Klassen kombinieren `font-size` + `line-height` + `letter-spacing` + `font-weight` als Presets, referenzieren aber ein internes Figma-System („Geist Core") — **konkrete px-Werte waren über die öffentliche Doku nicht auslesbar**, nur die Struktur des Tokensystems.
- Farbsystem: Grau-Skala mit 10 Stufen (100–1000, `var(--ds-gray-100)` … `var(--ds-gray-1000)`), plus ca. 9 weitere Farbfamilien mit je 10 Stufen, alle im Muster `var(--ds-[farbe]-[stufe])`. Grobe Zuordnung: 100–300 = Hintergründe/Hover, 400–600 = Rahmen, 700–1000 = High-Contrast-Text/Symbole. P3-Farbraum wird unterstützt.
- Grid-System ist bewusst abstrakt/konfigurierbar (Breakpoints `sm/md/lg`, `columns`, `rows`, `guideWidth`), **keine fixen Gutter-px-Werte öffentlich dokumentiert**.
- Geist Mono vs. Geist Sans: Mono ist explizit für „Coding-Umgebungen" positioniert, Sans für breitere UI-Anwendung. Die Trennlinie „Mono nur für Zahlen, Sans für Fließtext" wird NICHT explizit als Regel ausformuliert — außer eben in der Tabellen-Doku (siehe oben).
- **Lücke:** Motion/Spacing-Tokens waren über die Navigation der Introduction-Seite nicht auffindbar (nur Colors, Typography, Materials, Grid, Brand Assets, Icons, Typeface als Top-Level-Kategorien).

## 2. Railway

Quellen: [railway.com](https://railway.com), [docs.railway.com](https://docs.railway.com)

- **Schwacher Befund.** Weder die Marketing-Startseite noch die Doku-Startseite geben Auskunft über Typografie, Farbsystem oder Mono-Einsatz für Metriken — die Doku ist funktional (CLI/Deploy-Anleitungen), keine Design-System-Dokumentation öffentlich auffindbar. Ein Blog-Post unter `blog.railway.com/p/design-system` existiert nicht (404). Für belastbare Aussagen zu Railway müsste die App selbst (hinter Login/Signup) per Screenshot untersucht werden — das konnte hier nicht geleistet werden.

## 3. Warp Terminal

Quelle: [warp.dev](https://www.warp.dev), [docs.warp.dev/terminal/blocks](https://docs.warp.dev/terminal/blocks)

- Zentrales Konzept: **„Blocks"** — *„A Block groups commands and outputs into one atomic unit"*, ersetzt endloses Scrollen durch diskrete, navigierbare Einheiten (kopierbar, durchsuchbar, mit Bookmarks versehbar). Für ein dichtes Admin-Panel übertragbar: Ergebnis-Cluster (z. B. ein Kostenlauf, eine Abrechnungsperiode) als visuell abgegrenzter Block statt homogener Tabellenwand.
- **Konkrete Typografie-/Farbwerte waren über die Marketing-Seite nicht auffindbar** — reine Positionierungssprache („modern terminal for agentic coding"), keine Design-Spezifikation.

## 4. Zed Editor

Quellen: [zed.dev](https://zed.dev), [zed.dev/docs/visual-customization](https://zed.dev/docs/visual-customization)

- **Bester konkreter Befund neben Geist:** Zeds Default-Settings sind offen dokumentiert:
  - `ui_font_size`: **16px** (Standard), Alternative `.SystemUIFont` oder `.ZedSans`
  - `buffer_font_family`: **Berkeley Mono** als Standard-Editor-Schrift
  - `buffer_font_size`: **15px**
  - `buffer_font_weight`: 100–900 (CSS-Einheiten)
  - `buffer_line_height`: `comfortable` = **1.618**, `standard` = **1.3**, oder Custom-Wert
  - Getrennte Font-Settings für Terminal- und Agent-Panels
- Dies ist ein direkter Beleg dafür, dass Berkeley Mono als Referenz-Mono-Schrift in einem produktiven, dichten Coding-Tool läuft — mit Zeilenhöhen-Optionen zwischen „eng" (1.3) und „luftig" (1.618), was als Referenzpunkt für die eigene Zeilenhöhen-Entscheidung im KI-Kosten-Panel dienen kann.

## 5. Charm (Lipgloss / Bubbletea / Glamour)

Quellen: [charm.land](http://charm.land) (301-Redirect von charm.sh), [github.com/charmbracelet/lipgloss](https://github.com/charmbracelet/lipgloss), [github.com/charmbracelet/bubbletea](https://github.com/charmbracelet/bubbletea), [github.com/charmbracelet/glamour](https://github.com/charmbracelet/glamour)

- Charm positioniert sich explizit als Gegenentwurf zu „nur funktional": *„We make the command line glamorous"* — bewusste ästhetische Aufwertung von TUIs.
- **Lipgloss** liefert eine CSS-artige API: `Padding()`, `Margin()` mit CSS-Kurzschreibweise (top/right/bottom/left-Logik), Border-Presets (`NormalBorder()`, `RoundedBorder()`, `ThickBorder()`), selektive Kanten (`BorderTop(true)`), Farbverlauf-Borders (`BorderForegroundBlend`). Farbtiefen-Stufen: ANSI-16 (4-bit), ANSI-256 (8-bit), TrueColor (24-bit) — alle über eine einheitliche `Color()`-API ansprechbar.
- Eigenes `table`-Paket mit `StyleFunc(row, col)` für Zebrastreifen und Header-Styling — direkt übertragbar auf dichte Zahlentabellen (gerade/ungerade Zeilen unterschiedlich einfärben statt Gitterlinien).
- **Bubbletea**: Elm-Architektur (Model/Update/View), über 18.000 bekannte Anwendungen laut README, darunter Systemmonitore (AWS EKS Node Viewer), Dateimanager (Superfile), GitHub-CLI-Dashboards (gh-dash) — alles Beispiele für dichte, zahlenlastige TUI-Dashboards als Vorbild.
- **Glamour**: Stylesheet-getriebenes Markdown-Rendering fürs Terminal, genutzt von GitHub CLI, GitLab CLI, Gitea CLI. Themes liegen in einer öffentlichen Galerie (`styles/gallery` im Repo), aber **konkrete Farbwerte der Themes wurden über die README-Zusammenfassung nicht sichtbar** — dafür müsste man einzelne Theme-JSON-Dateien im Repo lesen.

## 6. Berkeley Mono / US Graphics

Quelle: [usgraphics.com/products/berkeley-mono](https://usgraphics.com/products/berkeley-mono)

- **Blockiert.** Die Seite lieferte durchgehend HTTP 403 (Bot-Schutz), sowohl die Produktseite als auch die Startseite `usgraphics.com`. Es konnten **keine Inhalte extrahiert werden** — weder Designphilosophie noch Kundenliste noch Preismodell. Einziger indirekter Beleg für den Einsatz: Zed Editor listet Berkeley Mono als seine **Standard-Buffer-Schrift** (siehe Punkt 4). Für weitere Belege (wer sie sonst einsetzt) wäre ein Browser-Tool mit JS-Rendering oder ein Cache-Dienst nötig — hier nicht verfügbar.

## 7. Weitere terminal-inspirierte Web-UIs

| Ziel | Befund | Qualität |
|---|---|---|
| [terminal.shop](https://terminal.shop) | Konsequent SSH-Ästhetik: Navigation als `[terminal] [cron] [api] [readme] [faq]`, Bestellung tatsächlich per `ssh terminal.shop`, Seite zeigt `cat ~/.ssh/known_hosts` als Content-Element. Kein grafisches UI-Ornament — die Seite IST das Terminal. | Konkret, aber Aussage zu Farben blieb Vermutung ("vermutlich dunkler Hintergrund") |
| [val.town](https://www.val.town) | Monospace für Code-Beispiele, Prompt-Symbol `❯` in der Navigation, heller Hintergrund, kompakte Struktur mit klaren Whitespace-Trennungen. | Mittel — Marketingtext, kein Screenshot-Detail |
| [linear.app](https://linear.app) | Mono gezielt NUR für Issue-IDs (Beispiel: „DRV-8852", „ENG-2085") und Code-Snippets, sonst durchgehend Sans. Neutrales Grausystem + farbige Label-Akzente. Dichte über mehrspaltiges Kanban (Backlog/Todo/In Progress/Done) mit kleinen Avataren. | Konkretes Nutzungsmuster (Mono nur für IDs) — gut übertragbar |
| [oxide.computer](https://oxide.computer) + [docs.oxide.computer](https://docs.oxide.computer) | Marketing-Seite erwähnt Mono in Terminal-Screenshots (Terraform/CLI), Instanzentabelle mit Name/CPU/Memory/State/Created als Beispiel hoher Informationsdichte „ohne Überladung". Docs-Startseite selbst lieferte keine Design-Details (nur Navigationsstruktur). | **Nur oberflächlich** — die eigentliche Konsole (bekannt für Dichte+Mono) liegt hinter Login, konnte nicht untersucht werden |
| [raycast.com](https://www.raycast.com) | Mono explizit für Tastenkürzel („esc F1 F2"), sonst Sans mit großzügigem Whitespace, helles Grundschema, Akzent Blau/Cyan. Philosophie-Zitat: „not about saving time" sondern Vermeidung des Gefühls von Zeitverschwendung. | Mittel |
| [modal.com](https://modal.com), [baseten.co](https://www.baseten.co), [turso.tech](https://turso.tech), [neon.com](https://neon.com) (Redirect von neon.tech) | Durchweg nur generische Marketing-Zusammenfassungen möglich (Card-Layouts, große Whitespace, „modern, minimalistisch, entwicklerfreundlich"). **Keine belastbaren Mono/Zahlen-Details** extrahierbar — die eigentlichen Dashboards liegen hinter Login. | **Schwach — reine Marketingbilder** |
| [dash.cloudflare.com](https://dash.cloudflare.com) | HTTP 403 — Dashboard ist naturgemäß authentifiziert, nicht fetchbar. | **Blockiert (Login)** |
| [hyperdx.io](https://www.hyperdx.io) | Nur Marketing-Sprache („Green Lightning Bolt" als Akzent, Fokus auf Logs/Traces/Spans als Begriffe) — keine echten UI-Detailwerte. | Schwach |
| [sourcegraph.com](https://sourcegraph.com) | HTTP 403. | Blockiert |
| **Supabase Design/Brand-Refresh Blog** | Vermuteter Blog-Post-Pfad lieferte 404 — die tatsächliche URL konnte ohne WebSearch nicht ermittelt werden. | Nicht auffindbar |

## 8. Typografie-Details (tabular-nums, slashed zero, Ausrichtung)

Quellen: [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric), [CSS-Tricks Almanac](https://css-tricks.com/almanac/properties/f/font-variant-numeric/), [rsms.me/inter](https://rsms.me/inter/), [practicaltypography.com](https://practicaltypography.com/monospaced-fonts.html), Vercel Geist Table-Doku (s. o.)

- **`font-variant-numeric: tabular-nums`** (OpenType-Feature `tnum`): erzwingt gleiche Breite für alle Ziffern → Spalten bleiben untereinander ausgerichtet. Baseline-Support seit Januar 2020, breite Browserunterstützung, aber **abhängig davon, ob die geladene Schrift das `tnum`-Feature überhaupt liefert** (nicht jede Schrift tut das).
- **`slashed-zero`** (Feature `zero`): Null bekommt einen Schrägstrich zur Unterscheidung von Großbuchstabe O — laut MDN speziell für Code-Kontexte relevant, weniger für reine Geldbeträge.
- **`oldstyle-nums`** (Feature `onum`): Ziffern mit Unterlängen für klassischen Fließtext-Look — für ein Zahlen-Dashboard eher ungeeignet, da es die Ausrichtung stört.
- Kombinierbar: `font-variant-numeric: tabular-nums slashed-zero;`
- Fallback für ältere Engines: `font-feature-settings: "tnum";`
- **Wichtige Nuance aus Inter-Doku:** tabular Nums sind laut Definition *„useful for tabular data, where comparing columns across rows is desired"* — sie liefern *„dedicated glyphs that have the same width across all weights"*, das heißt die Breitenkonsistenz gilt auch über verschiedene Schriftschnitte hinweg (Regular vs. Bold), was bei gemischt-fetten Kostenzeilen (z. B. Gesamtsumme fett) relevant ist.
- **Praxisregel für USD-Beträge unterschiedlicher Stellenzahl:** Weder MDN noch CSS-Tricks liefern eine explizite Anleitung zu Dezimalausrichtung bei wechselnder Stellenzahl (z. B. „$4.20" vs. „$1,204.50"). Aus der Kombination der Befunde lässt sich aber die Standard-Empfehlung ableiten, die in der Branche üblich ist: rechtsbündige Spalten + `tabular-nums`, damit die Dezimaltrennzeichen exakt übereinanderstehen — das ist der praktische Zweck, den `tabular-nums` überhaupt erfüllt, auch wenn keine der gefetchten Quellen das für USD explizit vorrechnet. Das sollte als eigene Schlussfolgerung markiert bleiben, nicht als zitierte Quellenaussage.
- **Geist-Regel bleibt der konkreteste, direkt anwendbare Fund:** „tabular-nums ODER Geist Mono" auf numerischen Spalten (s. Punkt 1).

## 9. Wo kippt Brutalismus in Unlesbarkeit?

Quellen: [Nielsen Norman Group — Brutalism/Anti-Design](https://www.nngroup.com/articles/brutalism-antidesign/), [practicaltypography.com — Monospaced Fonts](https://practicaltypography.com/monospaced-fonts.html), [Awwwards Brutalism-Collection](https://www.awwwards.com/awwwards/collections/brutalism/)

- **NN/g unterscheidet explizit Brutalismus von Anti-Design:** Brutalismus = bewusst „roh, improvisiert, ungeschmückt" (Referenz: frühe 1990er-Websites, Craigslist); Anti-Design = aktiv „hässlich, desorientierend, komplex" (fehlende Hierarchie, grelle Farben, ablenkende Animation). Kernsatz: *„Niemand beschwert sich jemals, dass eine Website zu leicht zu verstehen ist."* NN/g erlaubt Anti-Design/Brutalismus NUR für Designer-/Künstler-Publikum oder Entertainment-Produkte — für alles andere schade es den Geschäftskennzahlen. Genannte Beispiele: Craigslist (funktionierender Minimalismus), Bloomberg Businessweek Design 2016 (bewusst chaotisch), Adult Swim (brutalistischer Look bei klarer Navigation — funktioniert, weil Navigation trotzdem klar bleibt).
- **Übertragbare Lehre für das KI-Kosten-Panel:** Der Unterschied zwischen „brutalistisch, aber lesbar" (Adult Swim) und „Anti-Design, das schadet" ist laut NN/g NICHT die Rohheit der Optik, sondern ob **Navigation/Informationshierarchie trotzdem intakt bleibt**. Für ein dichtes Admin-Panel heißt das: Monospace-Ästhetik und dichte Zahlenraster sind erlaubt, solange Gruppierung (siehe Warp-Blocks-Konzept), Ausrichtung (tabular-nums) und Kontrast nicht der Rohheit geopfert werden.
- **Practical Typography (Butterick) zur Monospace-Kritik im Fließtext:** Monospace-Schriften sind für Lesbarkeit in normalem Fließtext grundsätzlich unterlegen, weil jedes Zeichen gleich breit ist — schmale Buchstaben wie „f/i/l" verschwenden Platz, der Text wird breiter und es passt „immer weniger Wort pro Seite". Zwei legitime Ausnahmen werden benannt: (1) Programmcode mit dichter Syntax, (2) tabellarische Zahlen — wobei Butterick anmerkt, dass die meisten proportionalen Schriften mittlerweile tabellarische Ziffern als Feature mitbringen, Monospace also nicht zwingend nötig sei, um Zahlen auszurichten. **Explizite Handlungsempfehlung daraus:** Mono nur für Zahlen/Code einsetzen, NIE für Fließtext/Beschreibungstext im selben Panel — sonst kippt die Lesbarkeit.
- **Awwwards-Sammlung** bestätigt die Risikofaktoren empirisch aus 83 gelisteten Beispielen: aggressive Farbeffekte („crazy flashing colors on hover"), übergroße/dekorative Typografie, experimentelle Layouts — diese Sammlung ist explizit **Design-Portfolio-Content, keine Referenz für ein Arbeitswerkzeug** (Kosten-Dashboard). Als Negativ-Referenz brauchbar: was NICHT übernommen werden soll.

---

### Zusammenfassende Einschätzung für den Design-Auftrag

Die belastbarsten, direkt umsetzbaren Fakten aus dieser Recherche sind:

1. **Geist-Tabellenregel**: `tabular-nums` ODER Mono-Schrift auf Zahlenspalten, nicht zwingend beides.
2. **Zed-Referenzwerte**: Berkeley Mono bei 15px Buffer-Text, 16px UI-Text, Zeilenhöhe 1.3 (eng/dicht) bis 1.618 (komfortabel) — guter Ankerbereich für ein dichtes, aber noch lesbares Zahlenpanel.
3. **Linear-Muster**: Mono NUR für IDs/technische Tokens, Sans für alles Erklärende — nicht das ganze Panel monospacen.
4. **Warp-Blocks-Prinzip**: Zusammengehörige Zahlen-Cluster visuell gruppieren statt eine durchgehende Tabellenwand zu bauen.
5. **Lipgloss-Zebrastreifen-Pattern**: Zeilenunterscheidung über Hintergrundfarbe statt über Gitterlinien — passt zu „dicht, aber nicht unruhig".
6. **NN/g-Grenze**: Brutalismus bleibt nur so lange funktional, wie Hierarchie/Navigation/Ausrichtung klar bleiben — die Rohheit darf die Struktur nicht auffressen.
7. **Butterick-Warnung**: Mono strikt auf Zahlen/Code beschränkt halten, nie auf Fließtext im selben Panel, sonst kippt die gesamte Lesbarkeit.

Deutliche Lücken, die mit Suchzugriff nachzuholen wären: Railway, Oxide-Konsole, Cloudflare-Dashboard, Sourcegraph, HyperDX, Modal/Baseten/Turso/Neon — bei allen lag die eigentliche Produktoberfläche hinter Login oder nur Marketingtext war zugänglich; ebenso blieb Berkeley Mono/US Graphics durch 403-Bot-Schutz komplett verschlossen.