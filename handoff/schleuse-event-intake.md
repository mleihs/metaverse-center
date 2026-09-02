# Handoff: Die Schleuse — vereinheitlichter Event-Intake (Option 1b)

**Code-Referenz:** `handoff/schleuse-prototype-1b.html` — nur Block 1b (Template inkl. aller Modals: Sichtung, Lesesaal, Schmelztiegel, Resonanz, Melden, Echo, Scan-Log, Toast) plus zugehörige Logik und Keyframes, ohne 1a/1c. Nicht lauffähig, reines Nachschlagewerk für Inline-Styles, Copy und Zustandslogik.

**Responsive:** `handoff/schleuse-responsive.md` — Verhalten bei 1280 · 1440 · 1920 · 2560 · 3840, Breakpoints, Container-Queries, Test-Matrix.

**Voll-Prototyp:** `Event Intake.dc.html`, Block `#1b` (`data-screen-label="1b Schleuse"`, Template Z. 301–770, Logik: alle `b*`-Keys in `renderVals()` ab Z. 1148 sowie `openCrucible/setLensB/composeB/typeB/closeB/toastB/stageB`). Der Prototyp läuft im Design-Projekt, nicht im Repo — **nicht kopieren**, sondern die darin gelösten Probleme in Lit-Komponenten übertragen. Rollenschalter oben („Ansicht als Architekt / Admin") und Tweak `role` zeigen beide Sichten.

**Ziel-Repo:** `velgarien-rebuild/frontend/src/`

## Was die Schleuse ersetzt

Heute existieren zwei Import-Pipelines mit zwei Vokabularen an zwei Orten:

| Heute | Ort | Wird zu |
|---|---|---|
| `social/SocialTrendsView.ts` (Browse → `TransformationModal` → Integrate; Batch-Modus) | Simulations-Tab „Social" | Kammer ① Eingang + Schmelztiegel + Kammer ② |
| `admin/AdminScannerTab.ts` (Sub-Nav Dashboard / Candidates / Log) | Admin-Panel „Scanner" | Sensor-Leiste (Dashboard), Kammer ② (Candidates), Scan-Log-Modal (Log) |
| `admin/AdminResonancesTab.ts` + `AdminResonanceFormModal.ts` | Admin-Panel „Resonances" | Resonanz-Modal aus Kammer ②; Liste → Kammer ③ (Scope „Resonanz") |
| `events/EchoTriggerModal.ts` | Events-Tab | Echo-Modal aus Kammer ③ (Ereignis-Karten) |

**Eine** neue View `velg-intake-view` („Schleuse"), gemountet an zwei Stellen mit unterschiedlicher Rolle (siehe § Rollen). Die alten Views bleiben bis zur Abnahme erreichbar, danach löschen (SocialTrendsView, AdminScannerTab-Sub-Nav).

## Verbindliche Repo-Regeln

- Farben **nur** über Tokens (`var(--color-…)`), nie rohe Hex. Prototyp-Hex → Token-Mapping am Ende dieses Dokuments — **nur dort gelistete, in `_colors.css` existierende Namen verwenden**; Amber-Chrome = `--color-accent-amber`, nicht `--color-primary` (Theme-Primary wechselt pro Welt).
- Headings `--font-brutalist` (Courier), uppercase, `--tracking-brutalist`; Labels Mono; Prosa `Spectral`, Narratives italic.
- Icons nur aus `utils/icons.ts`; alle Strings über `msg('…')`, En-Dash statt Em-Dash in msg().
- **Design-Tabus:** keine rotierten Elemente/Stempel, **kein `border-left` als Akzent-/Auswahlstreifen**. Auswahl = kompletter 1px-Rahmen `--color-accent-amber` + Tint `--color-accent-amber-glow`. Tabs = `border-bottom`.
- Modals über `shared/BaseModal.ts` (Backdrop-Fade + modal-enter existieren dort). Halten-Buttons über `shared/VelgHoldButton.ts`. Toasts über `shared/Toast.ts`.
- Reduced Motion: kein Startzustand `opacity:0`, der nur per Animation sichtbar wird.

## Dateiplan

| Baustein | Neue Datei | Basis / wiederverwenden |
|---|---|---|
| Shell, Sensor-Leiste, Quote, Abos, 4-Kammern-Board | `components/intake/IntakeView.ts` (`velg-intake-view`) | Layout-Muster aus `AdminScannerTab.ts` (Sub-Nav entfällt), `shared/grid-layout-styles.ts`, **`shared/stage-styles.ts`** (Maß/Gutter); jede Kammer `container-type: inline-size` |
| Sensor-Kachel | `components/intake/IntakeSensorTile.ts` | `AdapterInfo` aus `ScannerApiService.ts` |
| Signal-Karte (Kammer ①) | `components/intake/IntakeSignalCard.ts` | `shared/card-styles.ts` |
| Quarantäne-Karte (Kammer ②) | `components/intake/IntakeQuarantineCard.ts` | — |
| Freigegeben-Karte (Kammer ③) | `components/intake/IntakeReleasedCard.ts` | `events/EventCard.ts` (Stats-Zeile) |
| Nachhall-Eintrag (Kammer ④) | `components/intake/IntakeAftermathItem.ts` | `events/EchoCard.ts`, `ResonanceImpact` |
| Sichtung (Modal, Vollbreite) | `components/intake/IntakeTriageModal.ts` | `SharedFilterBar.ts`, `PaginatedLoaderMixin.ts` |
| Lesesaal (Eingang vergrößert) | `components/intake/IntakeReadingRoomModal.ts` | — |
| Schmelztiegel (Transformation) | `components/intake/IntakeCrucibleModal.ts` | **Ersetzt** `social/TransformationModal.ts`; `shared/GenerationProgress.ts` für die Schritte |
| Resonanz auslösen (Admin) | `components/intake/IntakeResonanceModal.ts` | `AdminResonanceFormModal.ts` (Felder), `terminal-theme-styles.ts` (Depesche) |
| Dem Bureau melden (Architekt) | `components/intake/IntakeFlagModal.ts` | — |
| Echo | bestehendes `events/EchoTriggerModal.ts` wiederverwenden (Stärke-Segmente statt Slider optional) | — |
| Scan-Log | `components/intake/IntakeScanLogModal.ts` | Tabelle aus `AdminScannerTab.ts` (`_renderLog`) 1:1 übernehmen |
| Zustands-Store | `services/IntakeStateManager.ts` | Muster `TerminalStateManager.ts` |

Nav: `layout/SimulationNav.ts` — Eintrag `{ label: msg('Intake'), path: 'intake', group: 'core' }` **direkt nach `events`**, Icon `icons.radar` oder neu `icons.airlock`. Eintrag `social` (Z. 66) entfällt nach Abnahme. Admin: `AdminPanel.ts` Tab-Key `scanner` → rendert `<velg-intake-view role="admin">` statt `velg-admin-scanner-tab`; Tab `resonances` bleibt als reine Liste/Archiv.

## Rollen (verbindlich, Prototyp-Schalter „Ansicht als")

`role` wird nicht aus einem Prop gelesen, sondern aus `appState.isPlatformAdmin` (Admin-Panel-Mount) bzw. `appState.canEdit` (Simulations-Mount). Unterschiede:

| Element | Architekt (im Simulations-Tab) | Admin (im Admin-Panel) |
|---|---|---|
| Breadcrumb | `Simulations / <Welt> \| Schleuse` | `Bureau / Substrate Monitoring \| Schleuse \| Welt: <Dropdown>` |
| Sensor-Leiste rechts | Kachel „Nächster Scan HH:MM" (dashed, inaktiv) | Button „◆ Jetzt scannen" → `scannerApi.triggerScan()` |
| Sensor-Kachel klick | nur Tooltip | Toggle `toggleAdapter(name, !enabled)` |
| Quarantäne-Karte linke Hälfte | Text „Für deine Welt: X effektiv. Ob es alle Welten trifft, entscheidet das Bureau" | Suszeptibilitätstafel aller Welten (Balken + eff-Wert) |
| Quarantäne-Karte Button 1 | „◈ Dem Bureau melden" (ghost, Bureau-Gold `#a68a2e`/`#3d3200`) → Flag-Modal | „◈ Resonanz" (amber primary) → Resonanz-Modal |
| Abonnements | eigene Welt, `bSubCount` 3 | plattformweit, 4 |
| Quote-Block | sichtbar | sichtbar (für gewählte Welt) |

Ein Architekt kann **nie** eine Resonanz erzeugen — nur melden (`status: 'flagged'` am Candidate, siehe Backend-Lücken).

## Layout der View (1600 px Referenz — Verhalten 1280 → 4K in `schleuse-responsive.md`)

Von oben nach unten, alles `border-bottom: 1px solid var(--color-border-light)` (#222):

1. **Topbar** 42 px: Breadcrumb links, rechts Rollen-Badge (1px Rahmen, Admin amber / Architekt grün), `● Scanner aktiv · Intervall 6 h` (aus `dashboard.config.interval`), DE/EN.
2. **Sensor-Leiste**: `grid-template-columns: 150px 1fr 150px`. Links Titel „Sensoren" + `12/13 online · 1 LLM-Aufruf/Zyklus`. Mitte `repeat(N, 1fr)` Kacheln (N = Adapter-Anzahl). Rechts Scan-Button/Nächster Scan, „Scan-Log", Funnel-Zeile `02:32 · 431 roh → 17 Geschichten → 5 im Eingang · 3 Resonanzen heute`.
   - Kachel: Name mit Status-Punkt (grün an, rot `kein Key`, grau aus), Klasse in Klassenfarbe, 4 Hit-Segmente + Zahl, „vor 4 min".
   - **Sensor-Klassen** (Farbe): strukturiert `#4ade80` · semi `#a78bfa` · LLM `#f59e0b` · intern `#3b82f6` · sozial `#a0a0a0` · kein Key `#ef4444`. Ableitung: `is_structured` → strukturiert; `requires_api_key && !available` → kein Key; Adapter `echoes` → intern; `reddit|bluesky` → sozial; `who|hackernews` → semi; Rest LLM.
3. **Quote + Abonnements**: `grid-template-columns: 360px 1fr`.
   - Quote: Label „Tagesquote · Einlass in diese Welt", Zahl 36 px Courier amber `n / 5`, 5 Segmente 8 px hoch (voll amber, leer `#1a1a1a`), Hinweis „Auto-Einlass 04:12", Fußnote italic: *Resonanzen zählen nicht auf die Quote.*
   - Abonnements: Karten `repeat(4, 1fr)`, je `Sektor → Zone`, Regel-Text, „zuletzt …", grüner Punkt rechts. Button „+ Abonnement".
4. **Board**: `grid-template-columns: 1fr 1.25fr 1fr 1fr`, `min-height: 720px`, Spalten durch `border-right` getrennt (strukturell, erlaubt).

### Kammer ① Eingang
Header „① Eingang · aufgenommen", rechts „Alle → ②" (Batch-Transform mit Abo-Linse), Zähler, `⤢` öffnet Lesesaal. Darunter eine **Sichtungs-Zeile** (blinkender Amber-Punkt): „Sichtung · **N** Geschichten warten · aus M Rohsignalen · Öffnen →".
Karten: Quelle · Klassen-Chip · Zeit / Headline (Spectral 14 px) / `◈ Archetyp` in Kategorie-Farbe · Magnitude · via / Buttons „Transformieren →" (amber ghost) · „Verwerfen".

### Kammer ② Quarantäne (Herz der View)
Header amber „② Quarantäne · Schicksal entscheiden", rechts „Alle ▣ nur hier" (grün) + Zähler.
Karte: **Rahmen 1px amber + `4px 4px 0 #000`**. Aufbau:
- Kopfzeile: „Original · Quelle" … `◈ Archetyp · 0.55`
- Original-Headline (grau, Spectral 13)
- Zwei Hälften (`1fr 1fr`, Trennlinie): links Resonanz-Sicht (rollenabhängig, s. o.), rechts „▣ als Ereignis · nur hier": transformierter Titel (Courier uppercase 11.5) + `Zone · Wucht n · k Reaktionen`.
- Button-Zeile: [Resonanz | Melden] (flex:1) · „▣ Nur hier" (grün ghost, flex:1) · „Linse" · „✕".
Leer-Zustand italic: *Die Quarantäne ist leer. Der nächste Scan-Zyklus liefert nach.*

### Kammer ③ Freigegeben
Header grün „③ Freigegeben · Resonanzen & Ereignisse". Karten mit Scope-Chip (1px Rahmen in Scope-Farbe): `◈ Resonanz` amber · `▣ Ereignis` grün · `◈ gemeldet` Bureau-Gold. Titel Courier uppercase, Stats-Zeile (Resonanz: `detected · trifft in 3 h 40 min · Speranza 0.99 · Gaslit 0.55 · Cité übersprungen`; Ereignis: `Zone · Wucht · Reaktionen`). Fuß: „Herkunft: Quelle", bei Ereignissen „↗ Echo" (blau) → Echo-Modal, „Öffnen →".

### Kammer ④ Nachhall
Header blau „④ Nachhall · was es auslöste". Einträge (Rahmen `#222`): Kind-Label in Farbe (`Echo · unterwegs nach X` blau · `Impact · Welt` amber · `Impact · übersprungen` grau · `Reaktion` grün), Text Spectral, `← Herkunft`.
Datenquelle: `ResonanceImpact[]` je Resonanz + `EchoesApiService.list` + Reaktions-Events der letzten 24 h.

## Modals (alle über BaseModal, Header `border-bottom: 2px solid #333`, ✕ 32 px mit Hover-Invert auf amber)

### Sichtung (`IntakeTriageModal`, 1500 px)
Zweck: die Menge bewältigen. **Geschichten** statt Rohsignale — gleiche Nachricht aus mehreren Quellen = eine Zeile (Guardian ×3 + GDELT ×41 + Reddit ×120).
- Toolbar: Suche · Sortierung [Passung | Magnitude | Neu | Netz-Tempo] · Magnitude [alle | ≥ 0.20 | ≥ 0.40 | ≥ 0.60] · „Top 5 nach Passung aufnehmen" · Tastatur-Hinweis `↑↓ · Leertaste wählen · ⏎ aufnehmen · x verwerfen` (**implementieren**, nicht nur anzeigen).
- Links 230 px: Sensor-Filter (Klick = ausblenden, opacity .45), darunter Regel-Text zu Sozialquellen.
- Zeilen `grid-template-columns: 28px 1fr 130px 80px 210px`: Checkbox `□/■` · (Zeit · ◈ Archetyp · Klasse · „◆ empfohlen" ab mag ≥ 0.40 · clsNote · „↑ 1.2k im Netz") + Headline + Quellen-Chips (sozial: dashed, gedimmt) · Magnitude-Balken + `0.55 · Zone` · Passung % (≥85 grün, ≥70 amber, sonst grau) · Aktionen [„In den Eingang" | „✕"] bzw. Status `✓ im Eingang` / `verworfen · zurück`.
- Auswahl-Zeile: `border: 1px solid amber; background: rgba(245,158,11,.10)`.
- Fuß: „N ausgewählt · Auswahl in den Eingang · Auswahl verwerfen" · italic *Alles, was hier nicht aufgenommen wird, verfällt nach 48 h.*
- **Rauschen**-Zeile (klappbar, `margin-top:auto`): `17.1k soziale Posts ohne Nachrichtenanker`, Einträge opacity .6 mit Grund („kein Nachrichtenanker", „Kategorie Sport ausgeschlossen").

**Regel Sozialquellen:** Reddit/Bluesky liefern nur Tempo/Reichweite zu einer bestehenden Geschichte (`soc`-Summe, Sortierung „Netz-Tempo"). Ohne Nachrichtenanker → Rauschen, **nie** eigenes Signal.

**Passung** (`fit`, 0–100): Backend-Score aus Kategorie↔Zone-Match, Agenten-Rollen-Match, Vektor-Verfügbarkeit. Bis dahin Frontend-Heuristik ok, aber als „Passung" kennzeichnen.

### Lesesaal (`IntakeReadingRoomModal`, 1500 px)
Eingang in Ruhe lesen. Header: Zähler, „Gliedern nach [Ort | Archetyp | Quelle]". Summary-Chips je Archetyp. Gruppen mit sticky Kopf (`Name · Anzahl · Notiz` — bei Ort: `Sicherheit 61 · Laune −1 · still seit 14 T`). Zeile `1.25fr 1fr 1fr`: **Wirklichkeit** (Headline 18 px, Abstract, Quellen-Chips) · **Klassifikation** (◈ Archetyp, Magnitude-Balken + clsNote, Passung + Begründung) · **Vorschlag für die Welt** (Titel, Chips `Ort · Vektor · Typ · Wucht`, Zeugen-Avatare, Buttons „Transformieren →" primary · „← Sichtung" · „Verwerfen"). Fuß: „Zur Sichtung · N warten".

### Schmelztiegel (`IntakeCrucibleModal`, 1000 px) — ersetzt TransformationModal
Titel „Schmelztiegel · Signal → Welt" (Edit-Modus: „Linse ändern"). Schrittleiste `① Signal ▸▸▸ ② Linse ▸▸▸ ③ Welt` (Pfeile pulsieren, solange aktiv).
- Körper `1fr 4px 1fr`: links **Wirklichkeit** als Zeitungsausriss (Hintergrund `#161410`, weiße Kopflinie 3 px, Headline/Abstract/Byline, „Quelle öffnen ↗"); Mitte Trennbalken (grün + Scan-Sweep während Generierung); rechts **Welt**: Terminal-Fläche (`#070907`, grüne Scanlines), Status-Badge `● arbeitet / ● schreibt / ✓ fertig`, während `reading` die 5 Schritte (`Signal gelesen · Ort verankert · Zeugen befragt · Tonlage gesetzt · Wirkung gerechnet`, mit ms) via `GenerationProgress`, dann Typewriter-Ausgabe, danach `contenteditable`.
- **Linse** (Grid `80px 1fr`): Ort (Zonen der Welt) · Vektor `[Handel | Traum | Architektur | Sprache | Krankheit]` = `EchoVector` · Tonlage `[Amtlich | Propaganda | Gerücht | Protokoll]` · Typ `[Krise | Dekret | Unruhe | Katastrophe | Fest | Gerücht | Entdeckung]` + Wucht 1–10 Segmente (Wort: ≤3 Gerücht · ≤6 Aufruhr · ≤8 Erschütterung · Umsturz; Hinweis *ändert nur die Integration, nicht den Text*) · Reaktionen `● erzeugen` + `[3 | 5 | 8] Agenten` · Zeugen (Avatar-Chips, abwählbar → Re-Generate) · Freiheit `[Treu 0.4 | Ausgewogen 0.7 | Frei 0.9]` (Temperatur) · Anweisung (Freitext).
- Varianten-Zeile: Chips `V1 · Amtlich · Ausgewogen`, „↻ Neu würfeln" (Seed+1), „▸ Protokoll" (klappt Aufruf-Protokoll auf: Prompt/Model/Temp/Seed/ms/Token, Signal, Welt-Kontext, Linse, Anweisung, Integration, Schritte, Ausgabe).
- Fuß: Status-Text · „Verwerfen" · primary „In die Quarantäne →" (Edit: „Linse übernehmen"), disabled während Generierung.
- Ort/Vektor/Tonlage-Änderung → sofort neu generieren; Typ/Wucht/Reaktionen → nur Parameter.
- API: `transformArticle` mit erweitertem Body `{ …, lens: { zone, vector, tone, witnesses[], creativity, instructions } }` (Backend-Lücke). Ergebnis in `bLensById[id]` halten; Integration erst bei „Nur hier" in Kammer ②.

### Resonanz auslösen (`IntakeResonanceModal`, 680 px, nur Admin)
Depesche im **BureauTerminal-Look** (`#0a0a08`, Rahmen `#3d3200`, Eck-Brackets amber, Kicker `#a68a2e`, Text `#f5c542`): „Bureau of Substrate Monitoring · Depesche SB-2026-0847" + generierter Text (`bureau_dispatch`). Darunter Suszeptibilitätstafel je Welt: `Name · Balken · mag × sus = eff` (eff-Farbe: <0.2 grau `#555` übersprungen · <0.4 `#a0a0a0` · <0.7 amber · ≥0.7 rot). Zeile „Trifft n von 6 Welten · in 4 h · nicht rückgängig". **VelgHoldButton** 950 ms „Resonanz auslösen (halten)" → `approveCandidate(id, 4)`.

### Dem Bureau melden (`IntakeFlagModal`, 560 px, nur Architekt)
Headline, `◈ Archetyp · Magnitude · Für deine Welt: eff`, Freitext-Begründung, Hinweis italic, Buttons „Abbrechen" · „◈ Melden →" (Bureau-Gold). Erzeugt Kandidat mit `status: 'flagged'` → erscheint beim Admin in Kammer ② oben, beim Architekten in ③ als `◈ gemeldet`.

### Echo (bestehendes `EchoTriggerModal`)
Ziel-Botschaften mit Effektivität %, Vektor, Stärke 1–10 (Vorgabe = Botschafts-Effektivität/10, überschreibbar). Nach Auslösen: Toast + Eintrag in Kammer ④ „Echo · unterwegs nach X".

### Scan-Log (`IntakeScanLogModal`, 1200 px)
Tabelle `90px 1fr 170px 110px 90px 120px`: Quelle · Titel · Kategorie · Magnitude · Gescannt · Ergebnis (in Sichtung / Eingang / Quarantäne / Ereignis / Resonanz / gemeldet / verworfen). Daten `getScanLog()`.

## Zustandsmaschine (IntakeStateManager)

Jedes Signal hat genau eine Stufe: `raw → in → q → (ev | res | flag) | out`.

| Übergang | Auslöser | API |
|---|---|---|
| raw → in | Sichtung „In den Eingang", Auswahl, Top 5, Abo | lokal / `browse` |
| in → q | Schmelztiegel „In die Quarantäne" / „Alle → ②" | `transformArticle` / `batchTransform` |
| in → raw | Lesesaal „← Sichtung" | lokal |
| q → ev | „▣ Nur hier" / „Alle ▣ nur hier" | `integrateArticle` / `batchIntegrate` (`generate_reactions`, `max_reaction_agents` = n) |
| q → res | Admin: Hold-Button | `approveCandidate(id, delay_hours=4)` |
| q → flag | Architekt: „◈ Melden →" | **neu** `POST /admin/news-scanner/candidates/{id}/flag` |
| * → out | „Verwerfen"/„✕" | `rejectCandidate` (Scanner) bzw. lokal (Browse) |
| out → raw | Sichtung „zurück" | lokal |

Quote: `evCount = |ev| heute`; bei `evCount ≥ 5` sind „Nur hier"-Buttons disabled mit Tooltip „Tagesquote erreicht · Auto-Einlass HH:MM". Resonanzen zählen nicht.

Jeder Übergang feuert einen **Toast** („Depesche · Schleuse", 400 px, amber Kopfkante, 3,8 s Decay-Balken) mit Klartext-Konsequenz, z. B. *„Weißfäule in den Brutgewölben" steht in der Quarantäne · Krise · Wucht 7 · 5 Reaktionen*.

## Datenmodell-Vereinheitlichung (Frontend-Adapter, bis Backend folgt)

`IntakeSignal` = `ScanCandidate` ∪ `BrowseArticle`:

```ts
interface IntakeSignal {
  id: string; stage: 'raw'|'in'|'q'|'ev'|'res'|'flag'|'out';
  source: string; sourceKind: 'structured'|'semi'|'llm'|'internal'|'social'|'nokey';
  headline: string; abstract?: string; url?: string; observedAt: string;
  category: ResonanceSignature-Kategorie; archetype: ResonanceArchetype; magnitude: number;
  classificationNote?: string;              // „deterministisch (Richter → Magnitude)" | „Modell: Signifikanz 3 → 0.30"
  sources: Array<{ name: string; count: number; velocity?: string }>;  // Story-Bündelung
  socialVolume: number; fit?: number;
  lens?: { zone: string; vector: EchoVector; tone: string; type: string; impact: number; react: boolean; n: number; witnesses: string[] };
  proposal?: { title: string; body: string };
  raw: ScanCandidate | BrowseArticle;
}
```

Kategorie → Archetyp/Farbe (aus `ResonanceSignature`/`ResonanceArchetype`; Hex nur zur Orientierung, Token-Zuordnung siehe Mapping-Tabelle):
economic_crisis → Der Turm `#f59e0b` · military_conflict → Der Schatten `#ef4444` · pandemic → Die Verschlingende Mutter `#a78bfa` · natural_disaster → Die Sintflut `#3b82f6` · political_upheaval → Der Umsturz `#dc2626` · tech_breakthrough → Der Prometheus `#4ade80` · cultural_shift → Das Erwachen `#e5e5e5` · environmental_disaster → Die Entropie `#22c55e`.

Effektive Magnitude: `eff = min(mag × sus, 1)`, `sus` aus `SubstrateAttunement` der Welt je Signatur; `eff < 0.2` = übersprungen.

## Backend-Lücken (für Opus als Folge-Tickets, nicht blockierend für UI)

1. `POST /admin/news-scanner/candidates/{id}/flag` + `status: 'flagged'` + `flag_reason`.
2. Story-Bündelung: `/candidates` liefert `sources[]` und `social_volume` pro Kandidat (Dedupe über URL/Titel-Ähnlichkeit); Social-Adapter dürfen keine eigenständigen Kandidaten erzeugen.
3. `fit`-Score pro Kandidat × Simulation (`GET /simulations/{id}/intake/candidates`).
4. `transform-article` akzeptiert `lens` (zone, vector, tone, witnesses, creativity, instructions) und liefert `steps[]` (Timing) + `protocol` (Model, Temp, Seed, Token).
5. Tagesquote `daily_event_quota` (Default 5) in Simulation-Settings; `integrate-article` lehnt bei Überschreitung ab (`429`).
6. Abonnements: `intake_subscriptions` (sektor, zone, regel, aktiv) — Cron füllt Eingang mit vortransformierter Abo-Linse.
7. Scan-Log-Status um Intake-Stufe erweitern.

## Umsetzungsreihenfolge

1. `IntakeStateManager` + `IntakeSignal`-Adapter über bestehende APIs (Scanner + Browse). Rolle aus appState.
2. `IntakeView` Shell: Topbar, Sensor-Leiste (aus `getDashboard()`), Board mit 4 Kammern, Toast — **inkl. der drei Breakpoints und Container-Queries aus `schleuse-responsive.md`** (nachträglich = doppelte Arbeit). Nav-Eintrag + Admin-Tab-Mount.
3. Schmelztiegel (ersetzt TransformationModal) inkl. Linse, Varianten, Protokoll.
4. Quarantäne-Karte rollenabhängig, Resonanz-Modal (Hold) und Flag-Modal.
5. Sichtung mit Story-Bündelung, Filter, Mehrfachauswahl, Tastatur, Rauschen.
6. Lesesaal, Scan-Log-Modal, Echo-Anbindung, Kammer ④ aus Impacts/Echoes.
7. Quote + Abonnements (UI zuerst, Backend folgt).
8. Alte Views entfernen, `social`-Nav-Eintrag löschen, i18n DE/EN vollständig.

## Prototyp-Hex → Token-Mapping

**Alle Token-Namen unten sind gegen `src/styles/tokens/_colors.css` und `_shadows.css` geprüft (Zeilen in Klammern).** Nur diese Namen verwenden — ein `var(--…)` mit unbekanntem Namen wird still verworfen und `lint-color-tokens.sh` meldet es nicht.

| Hex im Prototyp | Token (Zeile) | Verwendung in der Schleuse |
|---|---|---|
| `#0a0a0a` | `--color-surface` (103) | View-Hintergrund |
| `#111111` | `--color-surface-raised` (104) / `--color-surface-overlay` (108) | Modal-Körper, Karten-Kopfzeile |
| `#060606` | `--color-surface-sunken` (107) | Topbar, Sensor-Leiste, Kammer ④, Sichtungs-Zeile |
| `#0d0d0d`, `#080808` | **kein Token** → `color-mix(in srgb, var(--color-surface) 70%, var(--color-surface-raised))` bzw. `--color-surface` | Karten-Hintergrund; im Zweifel `--color-surface-raised` nehmen |
| `#333333` | `--color-border` (158) | Rahmen Karten/Buttons/Modals |
| `#222222` | `--color-border-light` (159) | Trennlinien Board/Kammern |
| `#1a1a1a`, `#2a2a2a` | **kein Token** → `color-mix(in srgb, var(--color-border-light) 70%, var(--color-surface))` | Hairlines in Listen, Ghost-Button „Verwerfen" |
| `#e5e5e5` | `--color-text-primary` (113) | Fließtext, Titel, Archetyp „Das Erwachen" |
| `#a0a0a0` | `--color-text-secondary` (114) | Abstracts, Sensor-Klasse „sozial" |
| `#888888` | `--color-text-muted` (116) | Labels, Meta-Zeilen |
| `#666`, `#555`, `#444` | `--color-text-tertiary` (115) bzw. `color-mix(in srgb, var(--color-text-muted) 60%, var(--color-surface))` | Dim-Labels, „übersprungen", disabled |
| `#f59e0b` | `--color-accent-amber` (165) für Chrome/Auswahl/Quote/Archetyp „Der Turm"; `--color-primary` (9) nur, wo die Theme-Primary gemeint ist | Auswahl-Rahmen, Quarantäne-Karte, primary Buttons |
| `#fbbf24` | `--color-accent-amber-hover` (166) | Button-Hover |
| `#b45309` | `--color-accent-amber-dim` (= `#be5e09`, 197) | Rahmen primary Button |
| `rgba(245,158,11,.10)` | `--color-accent-amber-glow` (198, 15 %) | Auswahl-Tint |
| Text auf Amber-Füllung | `--color-on-accent-amber` (218) | Button-Beschriftung |
| Amber als Text auf gethemter Fläche | `--color-accent-amber-readable` (211) | Kicker, „Öffnen →" |
| `#4ade80` | `--color-accent-green` (234) | Ereignis „▣ nur hier", Kammer ③, Terminal-Ausgabe, Sensor „strukturiert", Archetyp „Der Prometheus" |
| `#22c55e` | `--color-success` (84) | Rollen-Badge Architekt, Reaktions-Chip, Archetyp „Die Entropie" |
| `#3b82f6` | `--color-info` (96) | Echo, Kammer ④, Sensor „intern", Archetyp „Die Sintflut" |
| `#ef4444` | `--color-danger` (78) | Sensor „kein Key", eff ≥ 0.7, Archetyp „Der Schatten" |
| `#dc2626` | `--color-danger-hover` (79) oder neuer Token `--color-arch-upheaval` | Archetyp „Der Umsturz" |
| `#a78bfa` | `--color-epoch-influence` (`_features.css` 13) oder neuer Token `--color-arch-mother` | Sensor „semi", Archetyp „Die Verschlingende Mutter" |
| `#a68a2e` / `#3d3200` / `#f5c542` / `#0a0a08` | **keine globalen Token** — lokal in `terminal/BureauTerminal.ts` Z. 65–67 als `--_text-dim` / `--_border` / `--_text` mit `/* lint-color-ok */`. Für Resonanz-Modal und „◈ gemeldet" dieselben Privat-Variablen im Host definieren, gleiche Kommentar-Marke | Depesche, Melden-Button |
| `#161410` | **kein Token** → `color-mix(in srgb, var(--color-surface-raised) 90%, var(--color-accent-amber))` | Zeitungsausriss im Schmelztiegel |
| `#070907` + Scanlines `rgba(74,222,128,.035)` | `--color-surface-sunken` + `color-mix(in srgb, var(--color-accent-green) 4%, transparent)` | Terminal-Ausgabefläche |
| `3px 3px 0 #000` | `--shadow-sm` (`_shadows.css` 13) | primary Button in Karte |
| `4px 4px 0 #000` | `--shadow-md` (15) | Karten, Toast, Hold-Button |
| `6px 6px 0 #000` | `--shadow-lg` (16) | View-Rahmen |
| `8px 8px 0 #000` | `--shadow-xl` (17) | Modals |

Archetyp-Farben (8 Stück) sinnvoll als **neue** Token `--color-arch-{tower,shadow,mother,deluge,upheaval,prometheus,awakening,entropy}` in `_features.css` anlegen, jeweils auf die obigen bestehenden Token zeigend — dann bleibt `ResonanceArchetype → Farbe` an einer Stelle.

Typo-Größen: Labels 9–10 px Mono, letter-spacing 1.5–2 px, uppercase · Karten-Headline Spectral 13–14.5 px · Titel Courier 700 12–16 px, tracking .08em · Quote-Zahl 36 px.

## Akzeptanz

- Ein Signal durchläuft in < 5 Klicks Sichtung → Eingang → Schmelztiegel → Quarantäne → Ereignis, jede Stufe mit Toast.
- Architekt sieht nie einen Resonanz-Button; Admin sieht nie „Melden".
- Sozialquellen erscheinen nur als Chips an Geschichten oder im Rauschen, nie als eigene Zeile.
- Keine `border-left`-Akzente, keine rotierten Elemente; Auswahl überall als Amber-Rahmen + Tint.
- Alle Farben über Tokens; DE/EN vollständig; Reduced Motion ohne unsichtbare Elemente.

---

## Nachtrag (Claude Code, 02.09.2026) — zwei Messungen, die im Plan fehlen

Die Token-Tabelle oben ist inzwischen geprüft; mein früherer Nachtrag dazu ist
damit überholt und entfällt. Zwei Dinge bleiben, weil sie gemessen und nicht
abgeleitet sind.

### 1. Die Farbpalette des Prototyps, ausgezählt

38 verschiedene Hex-Werte. Die Häufigkeit sagt etwas über das Gewicht:

    #f59e0b  70x   #333  64x   #e5e5e5  58x   #888  53x   #666  51x
    #222     42x   #a0a0a0 37x  #4ade80 36x   #555  33x   #0d0d0d 18x
    #000     18x   #3b82f6 14x  #0a0a0a 14x   #1a1a1a 12x  #060606 11x
    #ef4444   9x   #2a2a2a  9x  #111     9x   #444   7x   #a68a2e  5x
    #b45309   4x   #a78bfa  4x  #22c55e  4x   #777   3x   #1f3a26  3x
    #080808   3x   … 13 weitere je 1–2x

Zwei Folgerungen daraus:

- **`#4ade80` (36x) und `#22c55e` (4x) sind nicht dieselbe Farbe.** Der Prototyp
  trifft die Unterscheidung bereits sauber: Plattform-Akzent gegen Statusfarbe.
- **Vier getönte Chip-Farben brauchen kein neues Token.** `#1f3a26`, `#2a4a33`,
  `#1e3a5f`, `#0b1a2e` sind `--color-success-bg` / `-border` und
  `--color-info-bg` / `-border` — Tier-2, per `color-mix()` aus der Statusfarbe
  abgeleitet und damit in allen zehn Themes richtig. Ein fester Hex wäre in
  neun davon falsch.

Wirklich neu anzulegen ist genau eines: `--color-paper-dark` (`#161410`).

### 2. Der Zufluss ist trocken (Prod, 02.09.2026 gemessen)

Eine Oberfläche mit vier Kammern über einem Fluss, der nicht fliesst, sieht nach
der Abnahme so leer aus wie heute. Beide Quellen der Schleuse stehen:

- **`POST …/social-trends/browse` mit `source: guardian`** → **Cloudflare-502 in
  580 ms**, `Content-Type: text/html`, nicht FastAPIs JSON. Dieselbe Route mit
  `source: newsapi` → sauberes JSON 400 „NewsAPI key not configured". Die Route
  ist also gesund; nur der Guardian-Zweig bringt den Ursprung zum Schweigen.
  Ursache steht im Backend-Log.
- **Scanner-Kandidaten**: `ScannerService` steht im Scheduler (Takt 6 h), hängt
  aber am Riegel `news_scanner_enabled`. Dessen Zustand ist von aussen nicht
  lesbar (`platform_settings` ist service_role-only).
- **Bestand auf Prod**: 12 Trends, alle in der Welt „Velgarien", alle `guardian`,
  alle vom 16./17.02.2026. 15 von 16 Welten haben null. Seither 197 Tage nichts.

**Ein Nebenbefund, der jeden Endpunkt betrifft, nicht nur diesen:**
`BaseApiService.handleResponse` ruft bei jeder Fehlerantwort `response.json()`.
Kommt HTML (Cloudflare, Proxy, Gateway), wirft das, der `catch` protokolliert
nur nach Sentry, und `errorMessage` bleibt auf dem Standardwert. Die Komponente
zeigt dann ihren generischen Rückfalltext — im Fall der Social-View wörtlich
„Failed to load articles" statt „502 Bad gateway". Ein Rückfall auf
`HTTP <status>` plus die ersten Zeichen des Körpers wäre die kleinste
Reparatur mit der grössten Reichweite.

---

## Nachtrag (Claude Code, 02.09.2026) — Schritt 3, was anders gebaut wurde

Der Schmelztiegel steht (`components/intake/IntakeCrucibleModal.ts`). Vier
Stellen weichen vom Bauplan ab, jede aus einem gemessenen Grund.

### 1. Drei Schritte statt fünf, und die Zeit wird gemessen

Der Plan zeigt während der Erzeugung fünf Schritte mit Millisekunden („Signal
gelesen · Ort verankert · Zeugen befragt · Tonlage gesetzt · Wirkung
gerechnet"). `POST /transform-article` ist EIN Aufruf; der Dienst tut nichts
davon in fünf Teilen, und die Zahlen im Prototyp sind gesetzt (380, 520, 660,
800, 940 — arithmetische Folge, kein Messwert). Eine Fortschrittsanzeige, die
Schritte erfindet, ist keine Anzeige. Es stehen jetzt drei Schritte da, die
alle stimmen — *Signal übergeben · Modell antwortet · Antwort gesetzt* — mit
einer laufenden, echten Uhr. Sobald Lücke 4 `steps[]` liefert, treten dessen
Schritte an ihre Stelle.

### 2. Nicht `GenerationProgress`

Der Dateiplan nennt das Modul. Es ist eine Vollbild-Auflage (`position: fixed`,
`--z-notification`) und würde genau die Terminal-Fläche verdecken, über die es
berichtet — das Zusehen beim Schreiben ist der Sinn dieser Hälfte. Der Typ
`GenerationStep` wird von dort geliehen, die Bühne nicht.

### 3. `<textarea>` statt `contenteditable`

Ein `contenteditable` in einem Lit-Template wird beim nächsten Rendern
überschrieben und bringt weder Beschriftung noch Formular-Tastaturbedienung
mit. Aussehen gleich, Zusicherung besser.

### 4. Keine Zeugen-Zeile

Zeugen könnten heute nur den erzeugten TEXT beeinflussen, und der Aufruf nimmt
keine Linse entgegen (Lücke 4). Weder `transform-article` noch
`integrate-article` hat ein Feld dafür. Ein Steuerelement, dessen Zustand
nirgends eintreten kann, ist kein Steuerelement. **Nachzuholen, sobald Lücke 4
steht** — dann gehört auch die Regel „Ort/Vektor/Tonlage ändern → sofort neu
generieren" angeschlossen, die aus demselben Grund heute nicht greift.

### Was die Linse heute erreicht

    Typ · Wucht · Reaktionen        → bei der Aufnahme (`integrateArticle`, Schritt 4)
    Ort · Vektor                    → Anzeige auf der Quarantäne-Karte, später das Echo
    Tonlage · Freiheit · Anweisung  → noch nirgends

Die dritte Zeile steht als Fussnote unter dem Linsen-Raster, nicht als
Kommentar im Code: ein Regler, der nichts bewegt und das nicht sagt, ist eine
Lüge auf dem Schirm. `LENS_REACHES_MODEL` in der Datei ist der eine Schalter,
der Marke und Fussnote wieder entfernt.

### Was nebenbei entstanden ist

- **`--modal-body-padding`** in `shared/BaseModal.ts` (Vorgabe unverändert
  `--space-6`). Ein Modal, dessen Körper aus randlosen Zeilen besteht, braucht
  die Polsterung an den Zeilen; sonst enden alle Trennlinien 24 px vor dem
  Rahmen. Sichtung, Lesesaal und Scan-Log werden ihn ebenfalls brauchen.
- **`intakeState.zones` + `loadZones` + `zoneName`.** Die Linse hält eine
  Zonen-**ID**, nicht den Namen — eine ID überlebt eine Umbenennung. Damit
  braucht jede Stelle, die eine Linse anzeigt, dieselbe Auflösung; sie steht
  deshalb einmal im Manager.
- **`transformRequestOf(signal)`** in `types/intake.ts`. Dass ein Kandidat
  seine Herkunft in `article_platform` trägt und ein gebrowster Artikel in
  `platform`, ist der letzte Rest der beiden Vokabulare; er steht bei den
  beiden `from*`-Funktionen und nicht in einer Komponente.
- **`components/intake/intake-labels.ts`** — Archetyp, Tonlage, Wucht-Wort,
  Freiheitsgrad. Der Vektor wird NICHT zum zweiten Mal übersetzt: dafür gibt es
  `bleedVectorLabel` in `utils/enum-labels.ts`, und zwei Tabellen für eine
  Union laufen auseinander.

### Eine i18n-Falle, die hier viermal zuschlug

Die Kennung einer Übersetzung ist der Hash der QUELLZEICHENKETTE. Wer eine
bestehende Zeichenkette wiederverwendet, erbt ihre Übersetzung — auch die
falsche. Vier Fälle, alle vor dem Festschreiben gefunden:

    'Record'   → „Aktenvermerk"  (gemeint war die Tonlage „Protokoll")
    'Register' → „Registrieren"  (Titel der Anmeldeseite, gemeint war „Tonlage")
    'Tremor'   → „Tremor"        (Journal-Fragmentart, gemeint war „Erschütterung")
    'Balanced' → „Ausgeglichen"  (vier Presets, gemeint war „Ausgewogen")

Rezept: vor dem Setzen der Ziele jede `msg()`-Zeichenkette der neuen Datei
gegen `de.xlf` halten und bei jedem Treffer fragen, ob dort DIESELBE Sache
gemeint ist. Die neuen Quellen heissen deshalb `Protocol`, `Tone`, `Shock`,
`Measured`. Nebenbei: `'Reality'` hatte „Realität"; das Wort der Schleuse ist
„Wirklichkeit", und der einzige andere Leser war `TransformationModal` — also
dieselbe Fläche, dieselbe Sache. Ziel geändert.

---

## Nachtrag (Claude Code, 02.09.2026) — Schritt 4, und eine Zahl, die falsch war

Schritt 4 steht: `IntakeQuarantineCard`, `IntakeResonanceModal`,
`IntakeFlagModal`, dazu zwei Backend-Endpunkte und Migration 334.

### ⚠ Die Überspring-Schwelle im Plan ist falsch

Der Plan nennt **0.2** als Grenze, unter der eine Resonanz eine Welt
überspringt — zweimal sogar, als Schwelle UND als Farbgrenze („<0.2 grau
übersprungen"). Nachgemessen springt der Lauf bei **0.05**
(`ResonanceService._process_simulation_impact`, §5). Mit 0.2 hätte die
Suszeptibilitätstafel einem Admin „diese Welt wird übersprungen" für Welten
gemeldet, die getroffen werden — auf genau dem Schirm, auf dem er einen
unumkehrbaren Halte-Knopf drückt.

`EFFECT_SKIP_THRESHOLD` in `types/intake.ts` stand seit Schritt 1 auf 0.2 (aus
dem Plan übernommen). Korrigiert; ein Test nagelt die Zahl jetzt fest, und die
Wahrheit kommt ohnehin je Zeile als `will_skip` vom Server.

### ⚠ Auch `sus` steht im Plan falsch

Der Plan sagt, `sus` komme „aus `SubstrateAttunement` der Welt je Signatur".
Tut es nicht. Die Kette ist:

    1. sus  = fn_get_adaptive_susceptibility(sim, signature)     (Migr. 216)
             = Grundwert aus simulation_settings.resonance_profile
             − 0.05 je abgewehrtem Treffer (max −0.25)
             + 0.10 je ungemildertem     (max +0.30), geklemmt auf [0.20, 2.00]
             Rückfall: fn_get_resonance_susceptibility (Migr. 076), sonst 1.0
    2. eff  = LEAST(ROUND(magnitude × sus, 2), 1.00)   ← DB-Trigger, Migr. 074
    3. eff -= attunement_depth × 0.3                    ← je Welt, im Lauf
    4. eff ×= (1 − anchor_protection)                   ← je Welt, im Lauf
    5. eff < 0.05 → übersprungen

Attunement ist also NICHT die Suszeptibilität, sondern ein Abzug DANACH.
Die Vorschau liefert Schritt 1+2 und sagt in Worten, dass 3 und 4 fehlen und
nur senken können — die Zahlen sind Obergrenzen.

### Zwei neue Endpunkte, weil die Alternative Erfindung gewesen wäre

| Endpunkt | Rolle | Warum |
|---|---|---|
| `GET /admin/news-scanner/candidates/{id}/susceptibility` | Admin | Ein Halte-Knopf, dessen genannte Folge geraten ist, ist schlimmer als keiner: er trägt die Gestalt von Wissen. |
| `POST /simulations/{id}/intake/flag` | Architekt (editor) | Lücke 1. Ohne ihn wäre „Melden" eine Tür, hinter der nichts liegt. |

`ResonanceService.susceptibility_of()` ist aus `_process_simulation_impact`
herausgezogen: Vorschau und Lauf lesen dieselbe Funktion. Zwei Fassungen einer
Formel driften, und die driftende ist die, die niemand ausführt.

**Migration 334** öffnet `news_scan_candidates.status` für `flagged` und legt
`flag_reason` + `flagged_by_simulation_id` an. Sie sucht ihre CHECK-Bedingung,
statt den von PostgreSQL vergebenen Namen zu raten, und prüft am Ende ihre
eigene Wirkung — ein DROP, das danebengreift, wäre sonst still, und `flagged`
bliebe verboten, während die Migration Erfolg meldet.

`ScannerService.approve_candidate` nimmt jetzt auch `flagged` an. Ohne diese
eine Zeile endete der Melden-Weg beim Admin in einer Sackgasse: die Meldung
läge in seiner Quarantäne und liesse sich nicht auslösen.

### Zwei weitere Abweichungen vom Bauplan

**Die Suszeptibilitätstafel steht NICHT auf der Karte, sondern im Modal.** Der
Plan setzt sie in die linke Hälfte der Admin-Karte. Nachgemessen kostet sie
einen RPC pro Welt und pro Karte — bei sechs Welten und fünf Karten dreissig
Datenbankaufrufe, nur damit ein Board zeichnet. Sie steht dort, wo die Zahl
eine Entscheidung trägt. Die linke Hälfte sagt stattdessen, was der Rolle
offensteht; das unterscheidet die beiden Sichten genauso deutlich und kostet
nichts.

**Das Melden-Modal fragt nach Kategorie und Wucht.** Der Plan sieht nur eine
Begründung vor. Ein gebrowster Artikel trägt aber keine Kategorie und keine
Magnitude (`fromBrowseArticle`: `category: null, magnitude: 0`), und beide sind
im Aufruf Pflicht — die Kategorie, weil daraus die Signatur folgt, die
Magnitude wegen der CHECK-Bedingung aus Migration 084. Wer etwas vorlegt, sagt
auch, als was.

**Nicht gebaut:** die Zeile „Für deine Welt: X effektiv" im Melden-Modal. Die
Zahl kommt aus einem Endpunkt, den nur Plattform-Admins erreichen. Statt einer
geratenen steht der wahre Satz da.

---

## Nachtrag (Claude Code, 02.09.2026) — Schritt 5, und was der Bauplan hier verspricht

`components/intake/IntakeTriageModal.ts`, erreichbar über eine Sichtungs-Zeile
im Kopf von Kammer ①. Fünf Abweichungen vom Plan, jede mit ihrem Grund.

### 1. Karten statt Zeilen — und das Masonry-Raster gehört dem Lesesaal

Der Plan beschreibt Zeilen (`28px 1fr 130px 80px 210px`). Gebaut ist ein
gleichförmiges Kartenraster mit optionalem Bildfach. Gemessen: **vier** Quellen
tragen ein Vorschaubild, jede unter einem anderen Namen (`thumbnail` Guardian ·
`image_url` NewsAPI + WHO · `socialimage` GDELT · `thumb` Bluesky), die vier
Messdienste tragen nie eines. Eine Zeile mit Bildfach ist für beide Fälle
falsch: mit Bild zu hoch, ohne Bild ein Loch.

⚠ **Die Resume-Notiz führte das Zeilen-Spannweiten-Raster (`grid-auto-rows: 8px`
aus einem ResizeObserver) der Sichtung zu. Das ist falsch.** Die Quelle
(`schleuse-sensorleiste-kaputt-2026-09-02.md`) führt es unter „Wo Masonry DOCH
richtig wäre" beim **Lesesaal (Schritt 6)** und nennt für die Sichtung zwei
Gründe DAGEGEN: sie ist eine Rangliste (die Reihenfolge ist die Auskunft), und
jede Karte trägt fokussierbare Knöpfe (WCAG 2.4.3).

### 2. Passung und Netz-Tempo sind DA und abgeschaltet

Der Plan erlaubt bis zum Backend eine Frontend-Heuristik für `fit`. Es gibt
keine. Die einzigen Zahlen, aus denen das Frontend eine bauen könnte, sind
Magnitude und Alter — beide stehen als eigene Sortierung daneben. Eine Passung,
die heimlich die Magnitude ist, trägt die Gestalt einer zweiten, unabhängigen
Messung.

Beide Chips tragen `°` und eine Fussnote. `BUREAU_RANKS_THE_SIGNALS` ist der
eine Schalter zurück, sobald Lücke 2 und 3 zu sind.

### 3. Drei Dinge aus dem Plan sind NICHT gebaut, weil es sie nicht gibt

- **„Verfällt nach 48 h"** — es gibt keinen Verfall. `news_scan_candidates` hat
  keinen Aufräumer, keinen Cron, keine Frist (über Migrationen und Dienste
  geprüft). Der Fuss sagt jetzt: hier verfällt nichts, ein Signal bleibt, bis
  jemand entscheidet. **Wer den Verfall will, muss ihn bauen** — dann ist die
  Zeile aus dem Plan wieder richtig.
- **Die Rausch-Zeile** — das Backend filtert VOR dem Ablegen; was es verwirft,
  erreicht das Frontend nie. Sichtbar wird es erst über das Scan-Log
  (Schritt 6). Eine Klappe, die garantiert leer ist, ist keine Anzeige.
- **„Top 5 nach Passung"** heisst „Die 5 stärksten aufnehmen" und nimmt nach
  Magnitude.

### 4. „◆ empfohlen" kommt vom Server

Der Plan nennt fest `mag ≥ 0.40`. Das ist genau der BODEN von
`compute_recommended_threshold` (oberste 20 % der wartenden Kandidaten, Boden
0.40) — also ihr schwächster Fall. Die Sichtung liest
`intakeState.recommendedThreshold` aus der Antwort und bietet die Zahl auch als
vierte Filterstufe an.

### 5. Eine stille Deckelung

`loadScanner` rief `listCandidates()` ohne Parameter — Vorgabe `limit=25`. Von
83 Kandidaten auf Prod hätte die Sichtung 25 gezeigt und nichts dazu gesagt.
Jetzt 100 (Maximum des Endpunkts), und der Fuss nennt „N von M geladen — die
neuesten zuerst", sobald mehr da sind.

### Was Schritt 5 nebenbei repariert hat

- **`--color-source-<kind>` gibt es nicht.** Der erste Anlauf setzte diesen
  zusammengesetzten Tokennamen; der Rückfall hätte gegriffen und JEDER
  Quellenpunkt wäre grau gewesen, ohne Meldung. Die Zuordnung steht jetzt
  einmal in `intakeKindColorStyles`; `IntakeSensorTile` liest von dort statt aus
  seiner eigenen Kopie.
- **Keine Komponente mit API-Zugriff war testbar** — `services/supabase/client.ts`
  wirft beim Import ohne `VITE_SUPABASE_URL`, und jedes API-Singleton zieht es
  mit herein. `vitest.config.ts` trägt jetzt zwei Platzhalter.
- **Zwei geerbte Übersetzungen abgefangen:** `msg('Fit')` hätte „Eignung"
  geerbt (die Dungeon-Tauglichkeit), `msg('Open')` „Offen" (der Zustand, wo ein
  Verb gemeint ist). Eigene Quellsätze: `Fit for this world`, `Open triage`.

---

## Nachtrag (Claude Code, 02.09.2026) — Schritt 6 und 7

### Schritt 6: Lesesaal · Scan-Log · Nachhall

**Lesesaal** (`IntakeReadingRoomModal`, 1500 px, `⤢` im Kopf von Kammer ①).
Zwei Abweichungen:

- **Kein Masonry, neuer Grund.** Bei der Sichtung war es der Rang; hier ist es
  der VERGLEICH — die mittlere Spalte urteilt über die linke, die rechte folgt
  aus beiden. Ein Vergleich braucht eine gemeinsame Grundlinie. Damit ist das
  Zeilen-Spannweiten-Raster derzeit für NICHTS in dieser View richtig.
- **Zwei Gliederungen statt drei.** „Ort" fehlt nicht, es gibt ihn an dieser
  Stelle nicht: ein Signal im Eingang bekommt seinen Ort erst in der Linse.
  🔑 Ein fehlender Wert und ein Wert, den es hier noch nicht geben KANN, sehen
  im Code gleich aus (`undefined`) und verlangen verschiedene Antworten.
- Die dritte Spalte („Vorschlag für die Welt") kann nur den WEG anbieten:
  `lens`/`proposal` entstehen im Schmelztiegel, und wer sie hat, steht in der
  Quarantäne und nicht mehr in dieser Liste.

**Scan-Log** (`IntakeScanLogModal`, 1200 px) — und **hier ist die Rausch-Zeile**,
die in der Sichtung nicht baubar war. Auf Prod: Bluesky 93 gescannt / 21
eingeordnet, die vier Messdienste 100 %. Trichter je Quelle im Kopf, klickbar,
Anteil unter der Hälfte in Warnfarbe. Die Spalte „Ergebnis" zeigt NICHT die
Schleusen-Stufe (Lücke 7): `news_scan_log` und `news_scan_candidates` teilen
keinen Schlüssel, und ein Abgleich über den Titel liefert 149 Treffer bei 222
und 83 Zeilen — ein Kreuzprodukt, keine Identität.

**Kammer ④** (`IntakeAftermathChamber`). `resonance_impacts` 14 Zeilen (gebaut),
`event_echoes` 0 Zeilen (als Satz genannt, nicht als leerer Abschnitt gebaut).
Die 14 vorhandenen Impacts holt sie NICHT ab — sie gehören zu einer Resonanz,
die nicht durch die Schleuse kam.

### Schritt 7: der Zufluss, den es nicht gab

⚠ **`loadBrowse` hatte NULL Aufrufer.** Seit Schritt 1 vorhanden, im Bauplan
genannt, nie ausgelöst. Ein Architekt konnte seine erste Kammer nie füllen.
`IntakeBrowseModal` schliesst das.

Dabei hat sich der Bauplan selbst widerlegt: `fromBrowseArticle` setzte
`stage: 'in'`, aber die Zustandstabelle führt „browse" als Auslöser für
`raw → in`. Fünfzehn auf einmal geholte Artikel hat niemand ausgewählt — sie
beginnen jetzt in der Sichtung.

Die Quote (Lücke 5) bindet bereits: `IntakeQuarantineCard` sperrt „Nur hier"
bei `quotaReached`. **Abonnements (Lücke 6) bleiben ungebaut** — es gibt weder
Tabelle noch Endpunkt; der ehrliche Platzhalter steht seit Schritt 2 in der View.

### ⚠ Schritt 8 ist kein Löschen, sondern ein Teilen

`social/SocialTrendsView.ts` (1989 Zeilen) trägt zwei Hälften:

    Artikel-Browse / Staging / Batch / Transformieren  → von der Schleuse ersetzt
    Botschaften + Weltgesundheit (4 Renderer)          → NIE abgedeckt

Wer die Datei löscht, löscht die Botschaften mit. Der `social`-Eintrag in der
Navigation bleibt deshalb stehen, bis die Botschaften ein eigenes Zuhause haben.
Das ist eine eigene Aufgabe.
