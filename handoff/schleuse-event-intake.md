# Handoff: Die Schleuse — vereinheitlichter Event-Intake (Option 1b)

**Code-Referenz:** `handoff/schleuse-prototype-1b.html` — nur Block 1b (Template inkl. aller Modals: Sichtung, Lesesaal, Schmelztiegel, Resonanz, Melden, Echo, Scan-Log, Toast) plus zugehörige Logik und Keyframes, ohne 1a/1c. Nicht lauffähig, reines Nachschlagewerk für Inline-Styles, Copy und Zustandslogik.

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

- Farben **nur** über Tokens (`var(--color-…)`), nie rohe Hex. Prototyp-Hex → Token-Mapping am Ende dieses Dokuments.
- Headings `--font-brutalist` (Courier), uppercase, `--tracking-brutalist`; Labels Mono; Prosa `Spectral`, Narratives italic.
- Icons nur aus `utils/icons.ts`; alle Strings über `msg('…')`, En-Dash statt Em-Dash in msg().
- **Design-Tabus:** keine rotierten Elemente/Stempel, **kein `border-left` als Akzent-/Auswahlstreifen**. Auswahl = kompletter 1px-Rahmen `--color-accent` + Tint `rgba(245,158,11,.10)`. Tabs = `border-bottom`.
- Modals über `shared/BaseModal.ts` (Backdrop-Fade + modal-enter existieren dort). Halten-Buttons über `shared/VelgHoldButton.ts`. Toasts über `shared/Toast.ts`.
- Reduced Motion: kein Startzustand `opacity:0`, der nur per Animation sichtbar wird.

## Dateiplan

| Baustein | Neue Datei | Basis / wiederverwenden |
|---|---|---|
| Shell, Sensor-Leiste, Quote, Abos, 4-Kammern-Board | `components/intake/IntakeView.ts` (`velg-intake-view`) | Layout-Muster aus `AdminScannerTab.ts` (Sub-Nav entfällt), `shared/grid-layout-styles.ts` |
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

## Layout der View (1600 px Referenz, fluid ab 1280)

Von oben nach unten, alles `border-bottom: 1px solid --color-border-subtle (#222)`:

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

Kategorie → Archetyp/Farbe (aus `ResonanceSignature`/`ResonanceArchetype`, Farben als Tokens anlegen `--color-arch-*`):
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
2. `IntakeView` Shell: Topbar, Sensor-Leiste (aus `getDashboard()`), Board mit 4 Kammern, Toast. Nav-Eintrag + Admin-Tab-Mount.
3. Schmelztiegel (ersetzt TransformationModal) inkl. Linse, Varianten, Protokoll.
4. Quarantäne-Karte rollenabhängig, Resonanz-Modal (Hold) und Flag-Modal.
5. Sichtung mit Story-Bündelung, Filter, Mehrfachauswahl, Tastatur, Rauschen.
6. Lesesaal, Scan-Log-Modal, Echo-Anbindung, Kammer ④ aus Impacts/Echoes.
7. Quote + Abonnements (UI zuerst, Backend folgt).
8. Alte Views entfernen, `social`-Nav-Eintrag löschen, i18n DE/EN vollständig.

## Prototyp-Hex → Token-Mapping

| Hex | Token / Bedeutung |
|---|---|
| `#0a0a0a` / `#111` / `#060606` / `#0d0d0d` / `#080808` | `--color-surface` / `-raised` / `-sunken` / Karten-Hintergrund (raised-2) |
| `#333` / `#222` / `#1a1a1a` | `--color-border` / `--color-border-subtle` / Hairline |
| `#e5e5e5` / `#a0a0a0` / `#888` / `#666` / `#555` | `--color-text` / `-secondary` / `-muted` / Label dim / disabled |
| `#f59e0b` / `#fbbf24` / `#b45309` | `--color-accent` / hover / Rahmen primary |
| `#4ade80` / `#22c55e` | `--color-forge` (Ereignis, „nur hier", fertig) |
| `#3b82f6` | `--color-info` (Echo, Nachhall, Sintflut) |
| `#ef4444` / `#dc2626` | `--color-danger` |
| `#a68a2e` / `#3d3200` / `#f5c542` / `#0a0a08` | BureauTerminal-Palette (fix, nie themen) — Depesche, „gemeldet" |
| `#161410` | Zeitungsausriss-Hintergrund (neu: `--color-paper-dark`) |
| `#070907` + `rgba(74,222,128,.035)` Scanlines | Terminal-Ausgabefläche |
| `4px 4px 0 #000` / `6px 6px 0` / `8px 8px 0` | Offset-Schatten Karte / View / Modal |

Typo-Größen: Labels 9–10 px Mono, letter-spacing 1.5–2 px, uppercase · Karten-Headline Spectral 13–14.5 px · Titel Courier 700 12–16 px, tracking .08em · Quote-Zahl 36 px.

## Akzeptanz

- Ein Signal durchläuft in < 5 Klicks Sichtung → Eingang → Schmelztiegel → Quarantäne → Ereignis, jede Stufe mit Toast.
- Architekt sieht nie einen Resonanz-Button; Admin sieht nie „Melden".
- Sozialquellen erscheinen nur als Chips an Geschichten oder im Rauschen, nie als eigene Zeile.
- Keine `border-left`-Akzente, keine rotierten Elemente; Auswahl überall als Amber-Rahmen + Tint.
- Alle Farben über Tokens; DE/EN vollständig; Reduced Motion ohne unsichtbare Elemente.

---

## Nachtrag (Claude Code, 02.09.2026) — Token-Tabelle korrigiert und vervollständigt

Am Repo nachgemessen, nicht abgeschrieben. Zwei Gründe für diesen Nachtrag:

**1. Vier Token-Namen der Tabelle oben gibt es im Repo nicht.** Ein `var(--color-accent)`
ohne Rückfallwert ist kein Fehler, den irgendetwas meldet — die Deklaration wird still
verworfen und das Element erbt. Und `lint-color-tokens.sh` fängt es NICHT: das Tor prüft
auf rohe Hex-Werte, nicht auf undefinierte Token-Namen. Der Plan liefe also durch jedes
Tor und würde trotzdem farblos rendern.

| Im Plan | Existiert nicht | Richtig |
|---|---|---|
| `--color-accent` | ✗ | `--color-accent-amber` (165) |
| `--color-text` | ✗ | `--color-text-primary` |
| `--color-border-subtle` | ✗ | `--color-border-light` |
| `--color-forge` | ✗ | **zwei** Token, siehe unten |

**2. `--color-forge` wirft zwei verschiedene Grüntöne zusammen.** Im Repo sind das zwei
Token mit zwei Bedeutungen: `--color-accent-green: #4ade80` (`_colors.css:234`,
Plattform-Akzent, nicht themebar) und `--color-success: #22c55e` (`:84`, Statusfarbe).
Der Prototyp benutzt `#4ade80` 36-mal und `#22c55e` 4-mal — das ist keine Ungenauigkeit
des Prototyps, sondern genau die Unterscheidung Akzent gegen Status.

### Vollständige Tabelle (alle 38 Hex-Werte des Prototyps)

| Hex | Anzahl | Token | Bedeutung |
|---|---|---|---|
| `#f59e0b` | 70 | `--color-accent-amber` (165) | Amber, Akzent — **nicht** `--color-primary`, siehe Warnung |
| `#333` | 64 | `--color-border` | Rahmen |
| `#e5e5e5` | 58 | `--color-text-primary` | Text |
| `#888` | 53 | `--color-text-muted` | Labels |
| `#666` | 51 | `--color-text-tertiary` | Label dim |
| `#222` | 42 | `--color-border-light` | Hairline |
| `#a0a0a0` | 37 | `--color-text-secondary` | Sekundärtext |
| `#4ade80` | 36 | `--color-accent-green` | Ereignis, „nur hier", fertig |
| `#555` | 33 | `--color-text-tertiary` (dimmer) | disabled |
| `#0d0d0d` | 18 | `--color-surface-raised` | Kartenfläche |
| `#000` | 18 | — | Offset-Schatten, bleibt roh |
| `#3b82f6` | 14 | `--color-info` | Echo, Nachhall, Sintflut |
| `#0a0a0a` | 14 | `--color-surface` | Grundfläche |
| `#1a1a1a` | 12 | `--color-border-light` (dunkler) | leeres Quote-Segment |
| `#060606` | 11 | `--color-surface-sunken` | vertiefte Fläche |
| `#ef4444` | 9 | `--color-danger` | Gefahr, kein Key |
| `#2a2a2a` | 9 | `--color-border-light` | Trennlinie in Karten |
| `#111` | 9 | `--color-surface-raised` | Hover-Zeile |
| `#444` | 7 | `--color-text-tertiary` | sehr dimmer Text |
| `#a68a2e` | 5 | — | Bureau-Palette, **fix, nie themen** |
| `#b45309` | 4 | `--color-accent-amber-dim` (196 = `#be5e09`) | Rahmen — Prototyp trägt den ALTEN Wert, am 31.08. für Kontrast angehoben |
| `#a78bfa` | 4 | `--color-epoch-influence` | Sensorklasse „semi", Pandemie |
| `#22c55e` | 4 | `--color-success` | Statusgrün |
| `#777` | 3 | `--color-text-tertiary` | dim |
| `#1f3a26` | 3 | `--color-success-bg` | Hintergrund grüner Chip |
| `#080808` | 3 | `--color-surface-sunken` | Fläche |
| `#fbbf24` | 2 | `--color-accent-amber-hover` (166) | Hover |
| `#f5c542` | 2 | — | Bureau-Palette, fix |
| `#3d3200` | 2 | — | Bureau-Palette, fix |
| `#1f1f1f` | 2 | `--color-border-light` | Hairline |
| `#161616` | 2 | `--color-surface-raised` | Fläche |
| `#0a0a08` | 2 | — | Bureau-Palette, fix |
| `#dc2626` | 1 | `--color-danger-hover` | Umsturz |
| `#2a4a33` | 1 | `--color-success-border` | Rahmen grüner Chip |
| `#1e3a5f` | 1 | `--color-info-border` | Rahmen blauer Chip |
| `#161410` | 1 | neu: `--color-paper-dark` | Zeitungsausriss |
| `#151515` | 1 | — | nur Prototyp-Seitenhintergrund, entfällt |
| `#0b1a2e` | 1 | `--color-info-bg` | Hintergrund blauer Chip |
| `#070907` | 1 | — | Terminal-Ausgabefläche, mit Scanlines |

Die vier Chip-Farben (`#1f3a26`, `#2a4a33`, `#1e3a5f`, `#0b1a2e`) brauchen **kein** neues
Token: `--color-{success,info}-{bg,border}` sind bereits Tier-2-Token und leiten sich per
`color-mix()` aus der Statusfarbe ab — sie passen sich damit allen zehn Themes an,
während ein fester Hex das nicht tut.

Neu anzulegen ist genau eines: `--color-paper-dark` (`#161410`).

### Zufluss — vor Schritt 1 zu klären

Die Schleuse hat zwei Quellen, und beide sind am 02.09.2026 trocken gemessen:

- **`browse`** antwortet mit Quelle Guardian in 580 ms mit einem **Cloudflare-502**
  (`text/html`, nicht die JSON-Antwort von FastAPI). Mit Quelle NewsAPI kommt sauberes
  JSON 400 „NewsAPI key not configured". Die Route selbst ist also gesund; nur der
  Guardian-Zweig bringt den Ursprung zum Schweigen. Ursache steht im Backend-Log.
- **Scanner-Kandidaten**: `ScannerService` steht im Scheduler (Takt 6 h), hängt aber am
  Riegel `news_scanner_enabled`; dessen Zustand ist von aussen nicht lesbar
  (`platform_settings` ist service_role-only).

Eine Oberfläche mit vier Kammern über einem Fluss, der nicht fliesst, sieht nach der
Abnahme so leer aus wie heute. Schritt 1 des Plans (StateManager + Adapter) ist davon
unabhängig und kann sofort beginnen; Schritt 2 (Board) braucht Daten, um beurteilbar zu sein.

### ⚠ Korrektur meiner eigenen Korrektur (02.09.2026, nach Rückmeldung aus dem Design-Lauf)

Ich hatte `#f59e0b` auf `--color-primary` abgebildet. **Das war falsch, und zwar auf
dieselbe Weise, vor der ich zwei Absätze weiter oben gewarnt habe.**

`ThemeService.ts:80` bildet das Weltfeld `color_primary` auf `--color-primary` ab.
Der Token **wechselt also pro Welt**. Die Schleuse ist eine Bureau-Fläche; ihr Amber
soll in jeder Welt Amber bleiben. Richtig ist deshalb `--color-accent-amber` (165) —
derselbe Wert `#f59e0b`, aber als Plattform-Akzent nicht themebar.

Dasselbe gilt für die Hover- und Rahmenfarbe: `--color-accent-amber-hover` (166) statt
`--color-primary-hover`, und `--color-accent-amber-dim` (196) statt
`--color-primary-active`. Letzteres ist zusätzlich ein stiller Gewinn: der Prototyp
schreibt `#b45309`, der Token steht auf `#be5e09` — am 31.08.2026 für den Kontrast
angehoben (Kommentar in `_colors.css:168`). Wer den Token nimmt, bekommt den Fix gratis;
wer den Hex abschreibt, holt den alten Wert zurück.

**Die Lehre, doppelt belegt:** ein Token-Name kann existieren und trotzdem der falsche
sein. `--color-primary` hätte in jedem Tor bestanden, in der Standardwelt sogar richtig
ausgesehen — und wäre in der ersten Welt mit eigener Primärfarbe umgekippt. Ein Tor
findet das nicht; nur die Frage „gehört diese Farbe der Welt oder der Plattform?".
