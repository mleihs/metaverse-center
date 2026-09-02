# RESUME — Schleuse (Event-Intake) einbauen

**Stand 02.09.2026, nach Schritt 2.** Drei Commits auf main, nichts gepusht.
Prod läuft `dba881d0`.

    273e8d6a  Design-Paket, Prototyp-Extrakt, Nachträge
    5ca4ef00  Schritt 1 — types/intake.ts, IntakeStateManager.ts, 15 Tests
    cf0619c2  Schritt 2 — IntakeView, IntakeSensorTile, Responsive, 37 Übersetzungen

▶ **ALS NÄCHSTES: Schritt 3, der Schmelztiegel** (`IntakeCrucibleModal.ts`).
Er ERSETZT `components/social/TransformationModal.ts` — die erste bestehende
Datei, die angefasst wird.

## Wo alles liegt

- `handoff/schleuse-event-intake.md` — der Bauplan (342 Z., inkl. meiner zwei Nachträge am Ende)
- `handoff/schleuse-prototype-1b.html` — 853 Z., Block 1b als Nachschlagewerk: Keyframes
  (Z. 10–42), Template mit allen Modals (bis Z. 518), Logik-Auszug (Z. 520–853).
  **Nicht lauffähig, nicht kopieren** — Inline-Styles auf Token übersetzen.
- Quelle beider Dateien: `~/Dev/Buchhaltung/Metaverse.center (6).zip`

## Verifiziert (nicht nochmal prüfen)

- Alle 17 im Plan genannten Repo-Dateien existieren.
- Alle 10 genannten API-Methoden existieren (`ScannerApiService`: `triggerScan`,
  `toggleAdapter`, `getDashboard`, `approveCandidate`, `rejectCandidate`, `getScanLog`;
  `SocialTrendsApiService`: `transformArticle`, `batchTransform`, `integrateArticle`,
  `batchIntegrate`).
- `lint-color-ok` wird von `lint-color-tokens.sh` gelesen (Z. 47, 68) — der Pragma trägt.
- Bureau-Palette liegt als Privat-Variablen in `components/terminal/BureauTerminal.ts`
  Z. 60–71, jede bereits mit `/* lint-color-ok */`.

## 🔑 Die Token-Falle (zweimal zugeschlagen, beide Male dokumentiert)

1. Der Plan nannte vier Token, die es NICHT gibt (`--color-accent`, `--color-text`,
   `--color-border-subtle`, `--color-forge`). `lint-color-tokens.sh` fängt das nicht —
   es prüft rohe Hex, nicht undefinierte Namen. Eine verworfene Deklaration meldet nichts.
2. Meine Korrektur war selbst falsch: ich schrieb `--color-primary`. Den Token GIBT es,
   aber `ThemeService.ts:80` bildet das Weltfeld `color_primary` darauf ab — er wechselt
   pro Welt. Für eine Bureau-Fläche ist `--color-accent-amber` (`_colors.css:165`) richtig.
   **Ein Token-Name kann existieren und trotzdem der falsche sein.**
   Prüffrage: gehört diese Farbe der WELT oder der PLATTFORM?
   Nebenbei: `--color-accent-amber-dim` ist `#be5e09`, nicht `#b45309` — am 31.08. für
   Kontrast angehoben (`_colors.css:168`). Der Prototyp trägt den alten Wert.

## ⚠ Der Zufluss ist trocken (am 02.09. gemessen)

- `POST …/social-trends/browse` mit `source: guardian` → **Cloudflare-502 in 580 ms**,
  `text/html` statt JSON. Mit `source: newsapi` → sauberes JSON 400 „NewsAPI key not
  configured". Die Route ist also gesund, nur der Guardian-Zweig bringt den Ursprung zum
  Schweigen. Ursache steht im Backend-Log, dort noch nicht nachgesehen.
- Deshalb sieht der Nutzer „Failed to load articles" statt der echten Meldung:
  `BaseApiService.handleResponse` ruft `response.json()` auf HTML, das wirft, und
  `errorMessage` bleibt auf dem Standardwert. **Gilt für JEDEN Endpunkt der App.**
- `ScannerService` steht im Scheduler (Takt 6 h), hängt an `news_scanner_enabled`;
  Zustand von aussen nicht lesbar (`platform_settings` ist service_role-only).
- Prod-Bestand: 12 Trends, alle in der Welt „Velgarien", alle `guardian`, alle vom
  16./17.02.2026. 15 von 16 Welten haben null. Seither 197 Tage nichts.

## Umsetzungsreihenfolge (aus dem Plan, § Umsetzungsreihenfolge)

Schritte 1 und 2 sind fertig. Es folgen 3 (Schmelztiegel), 4 (Quarantäne +
Resonanz-/Flag-Modal), 5 (Sichtung), 6 (Lesesaal/Scan-Log/Echo/Kammer ④),
7 (Quote + Abos), 8 (alte Views löschen, Nav-Eintrag, `social` entfernen).

**Responsive steht schon**: `handoff/schleuse-responsive.md` ist umgesetzt —
drei Breakpoints (1600/1920/2560), `container-type: inline-size` auf jeder
Kammer. Die Schleuse ist KEIN Cockpit und gehört NICHT in `FULL_HEIGHT_VIEWS`;
`.shell__content` deckelt sie bereits auf `--stage-measure`.

## Vor jedem Commit

`bash frontend/scripts/lint-color-tokens.sh && bash frontend/scripts/lint-llm-content.sh`
plus `lint-backtick-in-css.mjs` (die Backtick-im-css-Kommentar-Falle) und `tsc`.

## 🔑 Zwei Lehren aus Schritt 2

**1. Ein Token-Name kann existieren und trotzdem der falsche sein.** Ich hatte
`#f59e0b` auf `--color-primary` abgebildet — den Token gibt es, aber
`ThemeService.ts:80` bildet das Weltfeld `color_primary` darauf ab, er wechselt
pro Welt. Für eine Bureau-Fläche ist `--color-accent-amber` richtig. Prüffrage:
gehört diese Farbe der WELT oder der PLATTFORM?

**2. Der eigene Warnhinweis schützt nicht vor der eigenen Falle — zum zweiten
Mal.** Ein Peer meldete mir EINEN Backtick in einem css-Kommentar; im selben
Arbeitsschritt habe ich den Stilblock neu geschrieben und **46 neue** eingebaut.
Ein Backtick beendet das Template, alles danach parst als JavaScript, und
`lint:full` scheitert an der ersten Stufe für ALLE im geteilten Baum.
Vor jedem Commit: `node scripts/lint-backtick-in-css.mjs`.

## i18n-Rezept (vom Peer, neu im Repo)

    cd frontend
    npm run i18n:extract          # NICHT `npx lit-localize extract`
    # jede neue <trans-unit> in src/locales/xliff/de.xlf braucht ein <target>
    npm run i18n:build            # baut UND dekodiert die HTML-Entities

`de.xlf` UND `de.ts` mitcommitten. Zwei Tore prüfen das:
`locale-targets-wellformed` (Test) und `lint-no-html-entities-in-locales.sh`.
Anrede: das Projekt **duzt**. Belegtes Vokabular: Eignung, Zustand, Stimmung,
Stärke, Splitter, Schmiede, Überlieferung, Dunkelkammer, Wesenszug —
und **Schleuse** für Airlock.

## Wem was gehört (Stand 02.09., 10:05)

- `velgarien-rebuild-6e`: Forge/BYOK, `backend/routers/forge.py`, `ai_utils.py`,
  `components/forge/**`, `AdminForgeTab.ts`, `AdminUsersTab.ts`, Migrationen
  330–333. **Nächste freie Migration: 334.**
- `Frontseite-Redesign Abschluss (L1–L7)`: `how-to-play/**` (Beutekatalog —
  führt den Themen-Slug `loot` und ein `route`-Feld auf `TOPICS` ein).
  Inzwischen behoben, `tsc` und biome wieder still. **Nicht anfassen.**
- Ich (`velgarien-rebuild-af`): alles unter `components/intake/**`,
  `types/intake.ts`, `services/IntakeStateManager.ts`, `handoff/schleuse-*`.
  Später nötig: `layout/SimulationNav.ts`, `admin/AdminPanel.ts`,
  Löschung von `social/SocialTrendsView.ts` + `social/TransformationModal.ts`.

---

# Schritt 3 — der Schmelztiegel (Vorarbeit, 02.09.)

`components/intake/IntakeCrucibleModal.ts`, ERSETZT
`components/social/TransformationModal.ts` (980 Z.). Vom Peer freigegeben.

## Der eine Unterschied zum alten Modal

Das alte macht Transformieren UND Integrieren in einem Assistenten
(`preview → transform → integrate`, `_handleIntegrate` ab Z. 615).
**Der Schmelztiegel integriert NICHT.** Er endet in der Quarantäne:

    in → q    Schmelztiegel        transformArticle
    q  → ev   „Nur hier" (Kammer ②) integrateArticle

Das ist der Kern der Schleuse — zwischen „daraus könnte ein Ereignis werden"
und „es IST eins" liegt eine Entscheidung, und die gehört in die Quarantäne,
nicht ans Ende eines Assistenten. `intakeState.toQuarantine(id, {lens, proposal})`
ist der Übergang; `toEvent(id)` kommt erst in Schritt 4.

## Bausteine, geprüft

- `shared/BaseModal.ts` → `<velg-base-modal ?open modal-name="…" @modal-close>`,
  Slots: `header`, default, `footer`.
- `shared/GenerationProgress.ts` → `GenerationStep`-Interface;
  `generationProgress.run('transform', async (progress) => …)` ist das Muster,
  wie es `TransformationModal.ts:545` benutzt. `show(title, steps)`,
  `.activeStep`.
- `socialTrendsApi.transformArticle(simId, {article_name, article_platform,
  article_url?, article_raw_data?})` → `{original_title, transformation:
  {content?, narrative?, title?, description?, event_type?, impact_level?,
  model_used?}}`.

## Backend-Lücke, die den Bau NICHT blockiert

`transform-article` nimmt **kein** `lens` entgegen (Lücke 4 im Plan). Bis das
kommt: Linse lokal am Signal halten (`intakeState.patch(id, {lens})`), beim
Aufruf nur die vorhandenen Felder schicken, und `steps[]`/`protocol` aus dem
Client füllen statt aus der Antwort. Im Code als Lücke markieren, nicht
stillschweigend erfinden.

## Was der Plan für die Linse vorschreibt

Grid `80px 1fr`: Ort (Zonen der Welt) · **Vektor** · Tonlage
`[Amtlich | Propaganda | Gerücht | Protokoll]` · Typ `[Krise | Dekret | Unruhe |
Katastrophe | Fest | Gerücht | Entdeckung]` + Wucht 1–10 · Reaktionen
`● erzeugen` + `[3 | 5 | 8]` · Zeugen · Freiheit `[Treu 0.4 | Ausgewogen 0.7 |
Frei 0.9]` · Anweisung (Freitext).

⚠ **Der Vektor im Plan ist falsch.** Der Plan listet `[Handel | Traum |
Architektur | Sprache | Krankheit]`. Die echte Union `EchoVector`
(`types/index.ts:981`) hat SIEBEN Werte und „Krankheit" ist keiner davon:

    commerce · language · memory · resonance · architecture · dream · desire

Deutsch: Handel · Sprache · Gedächtnis · Resonanz · Architektur · Traum ·
Begehren. Steht schon als Kommentar in `types/intake.ts`.

Ort/Vektor/Tonlage ändern → sofort neu generieren.
Typ/Wucht/Reaktionen → nur Parameter, kein neuer Lauf.

## Responsive (aus `schleuse-responsive.md`)

Modal 1000 px, `width: min(1000px, calc(100vw - 2 * var(--stage-gutter)))`,
`max-height: calc(100vh - 2 * var(--space-12))`, Körper `overflow: auto`.
Körper `1fr 4px 1fr` → **unter 860 gestapelt** (Wirklichkeit oben, Trennbalken
horizontal 4 px, Welt unten). Linsen-Grid `80px 1fr` bleibt, Chips umbrechen.
Bei ≥ 2560 NICHT breiter werden.

## Vor dem Commit, immer

    cd frontend
    node scripts/lint-backtick-in-css.mjs   # ZUERST — bricht sonst den Baum für alle
    npx tsc --noEmit
    npm run lint:full
    npm run i18n:extract && <Ziele setzen> && npm run i18n:build

Und mit ausdrücklichen Pfaden committen (`git commit -- <pfade>`), nie
`git add .` — im geteilten Baum liegen immer fremde Dateien.
