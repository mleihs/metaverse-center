---
title: "Systemprüfung — Dungeons, Epochen, DRIFT, Simulationskern, Hilfe, Oberfläche"
version: "1.0"
date: "2026-08-30"
type: analysis
status: active
lang: de
tags: [audit, game-design, dungeons, epochs, drift, simulation, help, ui, integration, prod]
---

# Systemprüfung 2026-08-30

> **Frage des Eigentümers:** Sind die drei Spielsysteme (Dungeons, Epochen samt Mail, DRIFT) in sich vollständig, sind ihre Wechselwirkungen durchdacht, ist alles logisch, ist es unterhaltsam? Ist das Simulationen-Feature mit allen Mechaniken (Events, Agenten-Chat, Botschaften …) vollständig? Ist das Hilfesystem vollständig? Gibt es für jede Mechanik die fertige Oberfläche?
>
> **Kurzantwort:** Die Architektur ist vollständig, der Betrieb ist es nicht. Jedes der drei Spielsysteme funktioniert *in sich* bis zu einem bestimmten Punkt, und an genau diesem Punkt — dort, wo eine Handlung dem Spieler ihre Folge zurückmelden müsste — reißt die Kette: Dungeon-Beute wird gezeigt und verworfen, die Epochen-Mail liest den falschen Zyklus, DRIFT läuft auf Prod ohne seinen Spielkern. Die Wechselwirkungen zwischen den Systemen existieren in einer Richtung (alles liest aus dem Simulationskern), zurück fließt fast nichts. Und der Simulationskern selbst ist auf Prod seit dem 20. März 2026 erzählerisch stumm — teils bewusst (Kosten), teils durch zwei stille Defekte, die niemand sehen konnte. Ein dritter steht bevor: Die erste Bindung auf Prod wurde heute angelegt, und ihr erstes Flüstern wird den Herzschlag ihrer Welt an einem CHECK-Constraint einfrieren (§2.7).

## 0. Lesehilfe

- **Messungen** stammen aus der Prod-Datenbank (`bffjoupddfjaljqrwqck`, Management-API) und dem Prod-Container (`18e3bdfb`, gestartet 30.08. 15:30 UTC), Stand 30.08.2026 ~16:00 UTC. Zahlen ohne Quelle sind so gemessen.
- **Codebefunde** nennen `datei:zeile` auf `main @ 2f89573b`. Sie stammen aus sieben parallelen Teilprüfungen (Dungeons, Epochen samt Post, DRIFT, Simulationskern, Wechselwirkungen, Hilfe/Onboarding, Endpunkt↔UI-Kreuzreferenz) und einer Sichtprüfung der Prod-Oberflächen als Eigentümer. Alle P0-Befunde und die Befunde mit Prod-Wirkung habe ich selbst nachgeprüft — im Code und, wo möglich, in der Prod-DB. Diese sind mit **[nachgemessen]** markiert.
- Schweregrade: **P0** kaputt (Absturz oder falsches Ergebnis für jeden Nutzer) · **P1** falsch oder unvollständig (Mechanik greift nicht) · **P2** Entwurfsfehler (funktioniert, ist aber nicht das, was gemeint war) · **P3** Politur.
- **Bewusst abgeschaltet** ist keine Fehlerklasse. Der Eigentümer hat die erzählenden Schichten wegen der Modellkosten vorübergehend stillgelegt; diese Stellen sind als **[Kosten-Schalter]** markiert und zählen nicht als Defekt — wohl aber, wenn die Abschaltung mehr trifft als gewollt.

## 1. Der Prod-Bestand in Zahlen

| Bereich | Bestand | Letzte Regung |
|---|---|---|
| Nutzer | 10 Konten; 1 aktiv in 30 Tagen, 2 in 90 | Login 29.08. |
| Welten | 41 = 16 Vorlagen aktiv, 5 archiviert, 20 Epochen-Klone (nie getickt) | Welt 29.08. |
| Agenten / Gebäude / Zonen | 258 / 324 / 175 | — |
| Herzschlag | tickt in **14 von 16** aktiven Vorlagen, Intervall 4 h, ~900 Ticks je Welt | 30.08. |
| Agenten-Aktivitäten (Autonomie) | 91 018 gesamt, **4 456 in 7 Tagen** | 30.08. |
| Herzschlag-Einträge, 7 Tage | 420 × `resonance_mood`, 420 × `scar_tissue` (Warnung), 47 × `system_note` („Eine unruhige Stille …"), 7 × `relationship_shift` — sonst **nichts** | 30.08. |
| Events | 109 gesamt, **0 in 30 Tagen** | **20.03.** |
| Substrat-Resonanzen / Impacts / Echos | 1 / 14 / 0 | 20.03. |
| Agenten-Erinnerungen | 304 | **25.03.** |
| Agenten-Chat | 3 Gespräche, 22 Nachrichten | 06.04. |
| Chroniken / Broadsheets / Erzählbögen / Zonenaktionen | 9 / 4 / 45 / 1 | 05.04. / 09.04. / 21.04. / 26.03. |
| Botschaften / Verbindungen | 40 / 40 (Reparatur-Migration 244) | 20.03. |
| Bindungen / Bindungs-Erinnerungen / Journal-Fragmente | 1 / 0 / 0 | 30.08. |
| Dungeon-Läufe | 15 | 29.08. (Eigentümer) |
| DRIFT-Läufe / Reisende | 1 / 1 | 12.07. |
| Epochen | 7, alle Feb./März; 0 Einladungen je erzeugt; 0 Benachrichtigungs-Präferenzen | 20.03. |
| Erfolge (`user_achievements`) | 16 | — |
| Social: Instagram / Bluesky / Chiffren-Einlösungen | 13 / 2 / 0 | 15.04. |

Lesart: Die Welt **lebt mechanisch** (Bedürfnisse, Stimmungen, Meinungen, Aktivitäten werden im Vier-Stunden-Takt fortgeschrieben) und **schweigt erzählerisch** (kein Event, keine Resonanz, keine Erinnerung, keine Chronik seit fünf Monaten). Für einen Betrachter im Puls-Feed heißt das: alle vier Stunden „Substrat-Narbengewebe vertieft sich (+0,049)" — ein Metronom, keine Geschichte.

## 2. Die acht Befunde, die alles andere färben

### 2.1 Zwei Vorlagen-Welten hängen seit März in einer stummen Endlosschleife — darunter Velgarien **[nachgemessen, P1]**

`velgarien` tickt seit 25.03., `the-m-bius-academy` seit 24.03. nicht mehr, obwohl beide aktiv sind, `next_heartbeat_at` in der Vergangenheit liegt und der Scheduler sie **jede Minute als fällig erkennt** (Container-Log: 27 Zeilen „2 simulation(s) due for tick" in 27 Minuten). Ursache in `backend/services/heartbeat_service.py` (`_tick_simulation`): Der Tick versucht, die Zeile `(simulation_id, tick_number = last_heartbeat_tick + 1)` in `simulation_heartbeats` anzulegen. Existiert sie schon, wird nur `status = 'failed'` zurückgeholt; jeder andere Zustand gilt als „läuft gerade bei einem anderen Worker" → `logger.debug` (auf Prod unsichtbar) → `return` **ohne** `next_heartbeat_at` vorzurücken.

- Velgarien: `simulations.last_heartbeat_tick = 46`, aber `simulation_heartbeats` hat Tick **47 mit `completed`** (25.03. 17:01). Der Zeiger wurde nach dem Abschluss nie vorgerückt — also Tick 47 jede Minute, seit fünf Monaten, ohne Log, ohne Sentry.
- Möbius-Akademie: Zeiger 38, Zeile 39 mit **`processing`** (verwaist, ein unterbrochener Tick).
- Beide tragen dasselbe `next_heartbeat_at = 2026-04-09 09:42:34` — eine Sammelkorrektur vom 9. April, die den Zeiger nicht mitkorrigiert hat.

Der Code-Kommentar benennt das Risiko selbst („without reclaiming failed ticks … permanently stuck") und deckt nur einen von drei Fällen ab. **Fix:** verwaiste `processing`-Zeilen nach Ablauf (z. B. > 2 × Intervall) zurückholen; bei `completed`-Zeile mit `tick_number > last_heartbeat_tick` den Zeiger vorrücken statt abbrechen; den Skip-Zweig auf `warning` + Sentry heben. Mit demselben Muster sollte `asyncio.gather(…, return_exceptions=True)` in `_tick_due_simulations` seine Ausnahmen protokollieren — heute werden sie verworfen.

### 2.2 Autonome Events hängen am BYOK-Schlüssel — und niemand hat einen **[nachgemessen, Kosten-Schalter mit Nebenwirkung]**

Herzschlag-Phase 9f (`heartbeat_service.py:1152-1166`) erzeugt autonome Events nur, wenn `_resolve_autonomy_key` einen Schlüssel liefert: Admin-Override oder `user_wallets.encrypted_openrouter_key` des Welt-Eigentümers. Auf Prod hat **keine Welt** einen solchen Schlüssel (`simulation_settings` kennt nur `guardian_api_key`, `byok_bypass_enabled = false`). Folge: die Kette **A2 (Zonenstabilität → Ereigniswahrscheinlichkeit)**, der Katharsis-Mechanismus („community response"), die Gebäudeschädigung bei Krisen — der ganze Kern des Integrationskonzepts — läuft für keine einzige Welt. Seit dem 20.03. ist kein Event entstanden.

Das ist der Kosten-Schalter, den der Eigentümer meint. Die Nebenwirkung: `AutonomousEventService` hat einen **modellfreien Vorlagenpfad** (`_create_event_template`, „budget exhausted → template text"), der die Mechanik zu Nullkosten am Leben halten könnte — er ist aber hinter dem Schlüssel unerreichbar. Eine Zeile (Vorlagenpfad auch ohne Schlüssel, Budget 0) würde die Rückkopplung wieder einschalten, ohne einen Cent zu kosten.

Eine Randnotiz zur Kostenentscheidung selbst (Messung der Parallelsitzung, Forge-Befund 34): Das **interne Kostenbuch** (`ai_usage_log`, 603 Zeilen, 10,53 $ erfasst) hat bis heute **keinen einzigen `run_ai`-Zweck** verbucht — die Schnittmenge der 13 Zwecke mit den je an `AIUsageService.log` übergebenen ist leer; nur Bildaufrufe wurden gezählt. Die Rechnung des Anbieters (Schlüssel-Deckel am 28.08.) ist die Wahrheit, das Buch war es nicht; wer die Abschaltung anhand des Buchs bemisst, sieht nur die Bilder. Seit heute (`run_ai`, beide Erfolgspfade) wird korrekt verbucht.

Weitere Kosten-Schalter auf Prod, die ganze Schichten stilllegen: `news_scanner_enabled = false` (Substrat-Scanner → Resonanzen), `weather_enabled` nur in Velgarien (das nicht tickt) → Phase 9.5 tot, `critical_health_effects_enabled = false` überall, `drift_ai_enabled = false`, `drift_fun_core_enabled = false` (siehe §5).

### 2.3 Jede seit April geschmiedete Welt hat Agenten ohne Stimmung und Bedürfnisse **[nachgemessen, P1]**

42 von 258 Agenten — **alle** Agenten der Welten aus April (36) und August (6) — haben keine Zeile in `agent_mood` und `agent_needs`. Die Feb./März-Welten wurden von Migration 157 nachgefüllt; `fn_initialize_agent_autonomy` hat seither keinen Aufrufer außer seinem eigenen Test (`PersonalityExtractionService`). Für diese Welten sind Phase 9 (Bedürfnisverfall, Stimmung, Zusammenbruch), die Dungeon-Rückschreibung (Stimmung/Stress nach dem Lauf, `fn_apply_dungeon_outcome`) und der Epochen-Stimmungsmodifikator **stille No-ops**: `UPDATE` auf null Zeilen. Die Schmiede muss `fn_initialize_agent_autonomy` beim Anlegen rufen (und der Epochen-Klon ebenso).

> **✅ Behoben 30.08. abends (Parallelsitzung, Migration 286 auf Prod):** `fn_materialize_shard` ruft `fn_initialize_agent_autonomy` jetzt in SQL je angelegtem Agenten (Schritt 11b, dieselbe Transaktion); die 42 Bestandsagenten wurden nachgezogen — **42/42/42 → 0/0/0**. Die Nachmessung schärft den Befund: dieselben 42 Agenten waren **auch die einzigen ohne `current_zone_id`** — die Funktion setzt die Startzone mit; es fehlten also drei Dinge, nicht zwei, und die Zone war das stillste davon. Offen bleibt nur der Epochen-Klon (Paket I).

### 2.4 Die Epochen-Post wird versendet — mit falschem Inhalt **[nachgemessen, P0]**

Siehe §4.2. Der Transport ist konfiguriert und die Empfängerkette löst auf; aber die wiederkehrende Mail liest den falschen Zyklus, Einladungen werden nie verbucht, und der Abmelde-Link führt in jeder Mail auf 404.

### 2.5 Die Realtime-Publikation auf Prod enthält zwei Tabellen **[nachgemessen, P2 + Prod-Schema-Lücke]**

`supabase_realtime` auf Prod = `ai_usage_log, forge_access_requests`. Es fehlen `events` (Migration 237 ist im Prod-Ledger nicht verzeichnet — dieselbe Lückenklasse wie 235) und `user_achievements` (in keiner Migration). Folgen: die Live-Marker der Weltkarte (`SimulationWorldMap.ts:650`) und der Erfolgs-Toast (`VelgAchievementToast.ts:88`) feuern auf Prod **nie**. Ein Dungeon-Erfolg wird also nur beim späteren Besuch des Rasters sichtbar.

### 2.6 Der Epochen-Klon liest weder Draft noch Aptitudes **[nachgemessen, P1]**

`clone_simulations_for_epoch` auf Prod (19,8 KB): `drafted_agent_ids` — nicht gelesen; `agent_aptitudes` — nicht geklont. Migration 060 hat die Funktion neu geschrieben und die in 047 eingeführten Teile fallen lassen. Die Draft-Phase ist Dekoration (der Klon nimmt `ORDER BY created_at LIMIT 6`), und der Balancehebel der Spezifikation („aptitudes ARE the balance lever") existiert im Wettbewerb nicht mehr — jeder Klon-Agent steht auf dem Standardwert 6/6/6/6/6/6.

### 2.7 `bond_whisper` verletzt den CHECK auf `heartbeat_entries` — und die erste Bindung wurde heute angelegt **[nachgemessen, P0, bevorstehend]**

Phase 9.6 des Herzschlags erzeugt Einträge mit `entry_type = "bond_whisper"` (`heartbeat_service.py:606-617`). Der Prod-CHECK `heartbeat_entries_entry_type_check` (Migr. 186, 20 Werte) **enthält `bond_whisper` nicht**; keine Migration fügt ihn hinzu. Alle Einträge eines Ticks gehen in einem Batch-Insert (`:647`) — ein ungültiger Wert wirft, der `except` markiert den Herzschlag `failed`, **verwirft alle Einträge des Ticks** und rückt `last_heartbeat_tick` nicht vor (die Zuweisung liegt im `try`). Der nächste Versuch holt die `failed`-Zeile zurück und scheitert identisch. Die Vorlagen-Flüsterung braucht laut Kommentar (`:590`) **keinen** Schlüssel. Auf Prod existiert seit dem **30.08.** die erste Bindung überhaupt (Welt `state-pathography…`, Tick 5 um 14:35 UTC abgeschlossen, 0 Flüsterungen). Beim ersten Tick, der eine Flüsterung erzeugt, friert diese Welt ein — nach demselben Mechanismus, der Velgarien seit März hält. **Fix:** eine Migration, die `'bond_whisper'` in den CHECK aufnimmt (dieselbe Lückenklasse wie Migr. 186 für `resonance_mood`); dazu die Batch-Einfügung so ändern, dass eine ungültige Zeile nicht den ganzen Tick kostet.

### 2.8 Jede Autonomie-Einstellung wird in eine Kategorie geschrieben, die der Herzschlag nie liest **[nachgemessen, P0 latent]**

`AutonomySettingsPanel.ts:144-146` speichert unter `category = 'autonomy'`; `_load_sim_overrides` (`heartbeat_service.py:230`) liest ausschließlich `category = 'heartbeat'`. Neun Schlüssel betroffen, darunter der Schalter `agent_autonomy_enabled` und `autonomy_admin_override` — der Weg, Autonomie-Modellaufrufe mit dem **Plattform**-Schlüssel statt BYOK zu erlauben. Auf Prod liegen die beiden existierenden Zeilen (`agent_autonomy_enabled`, `weather_enabled`) korrekt in `heartbeat` — sie stammen aus Migrationen, nicht aus dem Panel; das Panel wurde auf Prod also nie benutzt, und wenn, wäre jede Änderung wirkungslos. `WeatherSettingsPanel.ts:122` macht es richtig (`'heartbeat'`). `models/settings.py:27` typisiert `category` als freien String, deshalb fängt es nichts. **Folge für §2.2:** die Admin-Override-Alternative zum BYOK-Schlüssel ist seit dem Bau des Panels nicht schaltbar — die BYOK-Stille war vielleicht nie ganz Absicht.

## 2b. Simulationskern — die lebende Welt

**Ein Satz:** Die Mechaniken sind einzeln gut gebaut, und die Behauptungen des Integrationskonzepts (A1, A2, A3, A5, B1–B3) sind **tatsächlich im Code** — aber auf einer frisch geschmiedeten Welt läuft von der lebenden Welt fast nichts (§2.3, §2.2, §2.8), und der einzige Hebel des Spielers auf ein Event hat keine Oberfläche.

### 2b.1 Der Herzschlag, Phase für Phase (`heartbeat_service.py:427-680`)

| Phase | Was | Tor (Standard) | Zustand |
|---|---|---|---|
| 1 Zonenaktionen ablaufen | | keins | verdrahtet |
| 2 Events altern | 4/6/3/8 Ticks | `event_aging_rules` | verdrahtet |
| 3 Resonanzdruck | schreibt `events.heartbeat_pressure` | keins | verdrahtet, **Ausgabe liest niemand** |
| 3b Resonanz → Stimmung (A3) | Moodlets −2..+2 | selbstgatend über `agent_mood` | verdrahtet, **leer** (keine Resonanzen, §2.2; keine Stimmungszeilen, §2.3) |
| 4 Erzählbögen | Eskalation/Kaskade/Konvergenz | keins | verdrahtet, **keine UI** (`listArcs` 0 Aufrufer) |
| 5 Bureau-Antworten | contain/remediate/adapt auflösen | keins | verdrahtet, **keine UI** |
| 6 Attunement, 7 Anker | Wachstum/Schutz | keins | laufen jeden Tick **auf dauerhaft leeren Tabellen** (0 Schreib-Aufrufer im Frontend) |
| 8 Narbengewebe | +0,05/Tick bei aktiven Bögen | keins | verdrahtet — die einzige Zeile, die der Puls jeden Tick zeigt |
| 9 Autonomie a–e | Bedürfnisse, Stimmung, Meinungen, Aktivitäten, Soziales | `agent_autonomy_enabled` (Code-Standard true) | verdrahtet; auf neuen Welten leere Tabellen (§2.3) |
| 9f autonome Events (A2 + Katharsis) | | **`owner_has_key`** | tot ohne BYOK (§2.2) |
| 9.5 Wetter | reale Wetterlage → Moodlets | `weather_enabled` **false** | aus |
| 9.6 Bindungs-Flüsterungen | Budget 3/Tick, Vorlagen ohne Schlüssel | `bond_whisper_budget` (falsche Kategorie) | **bricht den Tick** (§2.7) |
| 10–12 MV-Refresh, Friedenszeit-Chronik, Abschluss | | | verdrahtet (4 hart kodierte Friedenszeit-Sätze) |

`fn_materialize_shard` (Migr. 122) schreibt nur Kategorie `ai` + eine `game`-Zeile — **keine `heartbeat`-Zeilen**, also fällt jedes Per-Welt-Tor auf den Code-Standard. Aus auf einer frischen Welt: Wetter, autonome Events (+A2, Katharsis), Journal, Scanner (⇒ Resonanzen ⇒ A3), kritische Gesundheitseffekte, Admin-Override.

### 2b.2 Der Rückkopplungsgraph

**Kanten, die existieren:** Aktivitäten → Bedürfnisse; Soziales → Meinungen → (≥ 60) Beziehungen (BYOK-gated); Beziehungen ×0,4 + Professionen ×0,3 + Botschafter ×0,3 → Einfluss → Gebäudebereitschaft (0,85/1,0/1,15) → Infrastruktur ×0,5 → Zonenstabilität; Zonenaktionen −Druck; Events ×0,25 Druck; Stabilität → Ereignis-Multiplikator 0,5–1,5× (**A2, exakt nach Spezifikation**, `autonomous_event_service.py:455-479`) und → Sicherheitsbedürfnis; Stabilität + Bereitschaft + Diplomatie → Gesundheit; Botschaftseffektivität → Diplomatie ×0,4, Echo-Stärke, Epochen-Wertung; Chat → Erinnerungen; Resonanz → Moodlets, 2–3 Events je Welt, Verbund-Archetypen, Broadsheet-Priorität, Instagram-Stories, Operativen-Modifikatoren, Bot-KI, adaptive Anfälligkeit (`resonance_memory`). **Resonanzen sind die bestvernetzte Mechanik des Werks** — und seit März gibt es keine.

**Ohne ausgehende Kante (erzeugt, niemand liest):** `events.heartbeat_pressure` (vier Schreiber; die MV rechnet Druck aus `impact_level` neu — **das ist der Wert, den `contain` bewegt**), `agent_activities.effects`, `agent_bonds.depth` (Bindungen wirken auf nichts Numerisches), `user_achievements` (schalten nichts), `agent_aptitudes` (nur Dungeon/Epoche), Erzählbögen (geschlossener Kreis ohne UI), alles im Journal (`user_attunements`/`system_hook` — der versprochene „Klebstoff" — 0 Leser), `stability_label = 'exemplary'` (unerreichbar), `agents.autonomy_active` (kein Schreiber).

**Ohne eingehende Kante (nichts bewegt sie):** `agent_professions.qualification_level` (Bootstrap 3, dann nur per Hand-`PUT` — 30 % des Einflusses sind eine Zahl, die das Spiel nicht bewegen kann; das im Konzept als Pflicht genannte Training existiert nicht), `agent_aptitudes` (Hand), `buildings.building_condition` (nur `fn_degrade_building` aus Router-Events; kein Verfall, keine Reparatur), `zones.security_level` (nie zur Laufzeit geschrieben), vier der fünf Bedürfnisse (nur `safety` hat einen Welteingang), Bindungstiefe (nur der Spieler, der Flüsterungen liest), Chat (nichts außerhalb schreibt hinein).

### 2b.3 Befunde

| # | Grad | Befund | Beleg |
|---|---|---|---|
| S1 | **P0** | Autonomie-Panel schreibt Kategorie `autonomy`, Herzschlag liest `heartbeat` (§2.8). **[nachgemessen]** | `AutonomySettingsPanel.ts:144-146`, `heartbeat_service.py:230` |
| S2 | **P0** | Kein Bootstrap-Pfad für geschmiedete Welten (§2.3): `PersonalityExtractionService` 0 Prod-Aufrufer; `fn_materialize_shard` legt weder Bedürfnisse, Stimmung, Meinungen, Professionen noch `building_agent_relations` an und setzt keine Zone/Gebäude. Bereitschaft 0 ⇒ Infrastruktur 0 ⇒ Stabilität = Sicherheit × 0,3. **[nachgemessen]** | Migr. 122; `agent_activity_service.py:284-286` |
| S3 | **P0** | `bond_whisper` verletzt den CHECK (§2.7). **[nachgemessen]** | `heartbeat_service.py:606-617, 647, 711`; Migr. 186 |
| S4 | P1 | A2 + Katharsis + Stress-Zusammenbruch-Events + automatische Beziehungen hinter dem BYOK-Schlüssel (§2.2). | `heartbeat_service.py:1153, 770-809` |
| S5 | P1 | A3 hat keinen Eingang: Scanner aus, `news_scanner_auto_create` false (selbst mit Scanner landen Treffer zur Admin-Freigabe), `POST /resonances` nur Plattform-Admin. | Migr. 085:5; `scanner_service.py:70`; `resonances.py:89` |
| S6 | P1 | **Die Antwort des Spielers auf ein Event bewegt eine Zahl, die nichts liest, und die jeder Tick überschreibt.** `contain` (×0,30, 1 Agent) ist mechanisch wirkungslos; nur `remediate` wirkt — über den Seiteneffekt `event_status → resolving`. | `bureau_response_service.py:283-293`; Migr. 133:130-138 |
| S7 | P1 | `_post_event_mutation` (MV-Refresh, Bogen-Anbindung, **Kaskaden**, **Gebäudeschädigung**) wird von keinem autonomen Pfad gerufen — nur vom Events-Router und `resonance_service.py:651`. Die eigenen Events der Welt erzeugen keine ihrer Folgen; nur ein Mensch, der ein Event editiert. | `routers/events.py:99,122,137,253`; `autonomous_event_service.py:646`; `echo_service.py:533` |
| S8 | P1 | **Bureau-Antworten haben keine UI** (`listResponses/createResponse/cancelResponse` 0 Aufrufer). Ebenso `setAttunement/removeAttunement`, `createAnchor/joinAnchor/leaveAnchor`, `listArcs`. Der einzige „antworte auf ein Event"-Mechanismus ist nur per Hand-HTTP erreichbar. **[nachgemessen]** | `HeartbeatApiService.ts:50-71` |
| S9 | P1 | **Eine komplette, funktionierende Belohnungsschleife ohne Tür:** Attunement ≥ 0,50 → 20 %/Tick ein positives Event (implementiert bis zur `events`-Zeile), Wachstum 0,05/0,01 je Tick — aber `substrate_attunements` kommt im Frontend nicht vor. | `attunement_service.py:252-337`; Migr. 129:143, 133:174-216 |
| S10 | P1 | Terminal-Punkte (Ops 3 / Intel 2) **füllen sich nie**: `refreshBudgets()` („called on heartbeat tick") hat 0 Aufrufer; nach dem Verbrauch sind `fortify`, `quarantine`, `scan`, `investigate`, `debrief`, `ask` je Browser+Welt dauerhaft gesperrt. | `TerminalStateManager.ts:469-473` |
| S11 | P1 | Stress-Zusammenbruch (≥ 800) ohne Folge, ohne Abklingzeit, ohne Katharsis: jeden Tick ein `critical`-Eintrag, keine Moodlet, kein Reset, Auslöser explizit ausgenommen — exakt das Dwarf-Fortress-Muster, vor dem das Konzept warnt. | `agent_mood_service.py:327-348`; `autonomous_event_service.py:657-693` |
| S12 | P1 | **Die Chat-Vorlage verwirft Erinnerungen und Stimmung.** Plattform-`chat_system_prompt` (en+de) enthält weder `{agent_memories}` noch `{agent_mood}`; pgvector-Retrieval (Top-8) und zwei Stimmungsabfragen laufen **je Nachricht** und werden von `fill_template` still verworfen; nur `relationship_context` überlebt (als Rohtext). Der ganze Gedächtnisstapel (Embeddings, Wichtigkeit, Stanford-Retrieval, Reflexion) wird berechnet und weggeworfen. **[nachgemessen: auf Prod haben 4 von 4 Plattformvorlagen keinen der Platzhalter]** | `seed/006_prompt_templates.sql:505-536`; `chat_ai_service.py:137, 539` |
| S13 | P1 | Chat-Verlauf lädt die **ältesten** N (`desc=False`, harte Kappe 200) — ab Nachricht 200 ist der Agent am Gesprächsanfang eingefroren. | `chat_ai_service.py:1133-1138` (vgl. korrekt `chat_service.py:359-382`) |
| S14 | P1 | Automatischer Bleed berechnet Kandidaten und wirft sie weg: die volle Pipeline läuft, Ergebnis ist eine Logzeile plus der Kommentar „Echoes will be created by the normal heartbeat echo resolution pipeline" — **die es nicht gibt**. Einziger Schreiber von `event_echoes`: `POST /echoes` (Admin). Bleed ist per Konstruktion Handarbeit. | `autonomous_event_service.py:884-914`; `routers/echoes.py:93` |
| S15 | P2 | Cross-World-Verbindungen nur Plattform-Admin, ohne Freigabefluss; geschmiedete Welten haben keine ⇒ kein Bleed, Botschaftseffektivität ≤ 0,8. | `connections.py:38`; Migr. 026:284 |
| S16 | P2 | **Unerreichbare Schwellen:** Stabilität max 0,80 (`exemplary` ≥ 0,9 unerreichbar; Multiplikator-Boden 0,5× tot); Einfluss ohne Botschafter max 0,55 = STRONG-Grenze (**STRONG nur für Botschafter**); Gesundheit ohne Botschaft max 0,78 (`ascendant` nur mit Botschaft). | Migr. 031:176-200; Migr. 158:60-96, 672-680 |
| S17 | P2 | Botschafter-Identität ist ein **Namensvergleich** (Umbenennen entzieht 0,3 Einfluss); `embassy_ambassador_quality` bewertet die **Namenslänge** (`length(name_a)+length(name_b))/50`) statt der Charakterlänge. | Migr. 158:87-96, 307-311; `agent_service.py:208-258` |
| S18 | P2 | Zonenaktions-Budget ist Fiktion (nur „eine aktive je Zone", SELECT-then-INSERT gegen ADR-007); Wetter-Koordinaten-Panel schreibt, wo nichts liest; `event_service.py` liest `heartbeat_interval` (300 s) statt `heartbeat_interval_seconds` (14400) → Schutz läuft 48× zu früh ab; `relationship_breakdown` feuert jeden Tick neu und kann nie einen Rivalen erzeugen; ein `add_moodlet`-Aufruf umgeht die Stapelkappe; `page_size` ist kein Backend-Parameter (AgentSelector zeigt 25); Streaming umgeht die Budgetprüfung; `fn_degrade_building` schreibt `'moderate'`, das keine Taxonomie kennt. | `zone_action_service.py:44-113`; `WeatherSettingsPanel.ts:200-244`; `event_service.py:520-522`; `agent_opinion_service.py:433-448`; `agent_activity_service.py:684-691`; `chat_ai_service.py:193-206`; Migr. 148:89 |
| S19 | P2 | Public-First-Verletzungen: `AgentAutonomyApiService` ohne `mode` (Stimmung/Bedürfnisse 403 für Nichtmitglieder), `bondsApi.listBonds` nacktes `get()`, Router behauptet „publicly readable", verlangt aber `viewer`. | `AgentAutonomyApiService.ts:137-153`; `BondsApiService.ts:60`; `agent_autonomy.py:1-3` |
| S20 | P2 | `journal_enabled` ohne Seed und ohne Admin-UI; sechs Haken reihen Anfragen ein, der Generator entleert nie. Drei `resonance_operative_*_cap`-Settings inert (SQL hart 0,04). `resonance_bot_awareness_enabled` inert. Bindungs-Belastung/-Erholung (`enter_strain`/`recover_from_strain`) unerreichbar; die §3.7-Modifikatoren der Bindungen existieren nirgends. Journal-`has()`-Haken 0 Aufrufer. | `journal/fragment_generation_scheduler.py:24-47`; Migr. 079/080; `bond_service.py:619-739`; `journal/attunement_service.py:243-261` |
| S21 | P3 | `frontend/src/components/resonance/` (zwei Tags) wird **nirgends** importiert — die spielerseitige Resonanz-UI ist tot; `bleed_auto_approve` hat einen Live-Schalter mit Infoblase für ein Verhalten ohne Backend; `HeartbeatEntryType` kennt `resonance_mood`/`bond_whisper` nicht (rohe Slugs); `_build_relationship_context` nennt den Agenten sich selbst (SUSPECTED); drei handkopierte Formel-Duplikate (Einfluss-Kopie bereits gedriftet). | `BleedSettingsPanel.ts:243-249`; `types/index.ts:1738-1757`; `chat_ai_service.py:590`; `AgentDetailsPanel.ts:1007` |

### 2b.4 Botschaften und Chat gegen die Spezifikation

**Botschaften** (`docs/specs/embassies.md`): Tabelle, Sortierung, `special_type`, `is_ambassador`, 4-Schritt-Assistent, 7 Bleed-Vektoren, Auto-Aktivierung — **gebaut**. 11 von 16 API-Endpunkten. **Ward-Mechanik nur Backend** (Migr. 191, null Frontend-Referenzen); `EmbassyGeneratePair` + zwei Prompt-Vorlagen tot; Botschafter nach Gründung nicht änderbar; Gründung ohne Kosten oder Tor (Admin nur auf der Pfad-Welt, Body-IDs unvalidiert, Schreibung über Admin-Client → die „Admin beider Seiten"-RLS ist unerreichbar). Vierzehn mechanische Wirkungen nach Gründung (Einfluss +0,3 → Bereitschaft → Stabilität; Effektivität = Gesundheit ×0,4 + Botschafterqualität ×0,4 + Vektorausrichtung ×0,2; Diplomatie → Gesundheit ×0,2; Epochenwertung; Erfolg; Echo-Stärke; Ward; Gazette; DRIFT-Topologie); `infiltration_penalty` wird geschrieben und von der Effektivitäts-MV **nie gelesen** — die Hilfe behauptet „−65 %".

**Chat:** Persona ✓; Erinnerungen und Stimmung berechnet, **verworfen** (S12); Beziehungen ✓ (nur 1:1, Namensfehler); Events nur im Gruppenchat; Zone, Wetter, Bedürfnisse, Lore **nie geladen**; Fenster 200 älteste-zuerst (S13), keine Zusammenfassung; Persistenz ✓; Ratenbegrenzung 10/min **je IP**; Budgetprüfung nur ohne Streaming; SSE beidseitig ✓; Erinnerungsschreibung nur 1:1 (Gruppenchat bildet keine); **Agent↔Agent autonom: nein** („casual_chat" ist ein fester Satz); keine Wissensgrenze (jedes Event an jeden Agenten anhängbar); vom Agentenpanel aus **nicht erreichbar** (nur Nav-Reiter).

### 2b.5 Entscheiden oder Zuschauen

Zuschauen: Herzschlag, Bedürfnisse/Stimmung/Stress/Zusammenbruch (alle Endpunkte GET), Aktivitäten, Resonanzen, Erfolge, Wetter, Gesundheit im Notfall (Verzweiflungsaktionen nur in Epochen). Entscheiden: Beziehungen (CRUD + KI-Vorschlag), Chat (die reichste Interaktion), Events (anlegen/ändern), Zonenbefestigung (Terminal/API, Budget fiktiv, Punkte füllen sich nie), Agent→Gebäude (**nur Terminal**), Professionen (eine Zahl tippen), Botschaften (bei Gründung), Echos (**nur Admin**), Bindungen (wirken auf nichts), Journal-Konstellationen (Generator aus), Broadsheet/Chronik (ein Knopf), Terminal (dichteste Entscheidungsfläche — bis die Punkte weg sind). **Als Entscheidung entworfen, unerreichbar:** Bureau-Antworten, Attunement, Anker.

## 3. Resonanz-Dungeons

**Verdrahtung.** Die Schleife Eintritt → Erkundung (Graph mit Nebel, Kundschaften) → Kampf (60-s-Planung, simultane Auflösung) → Schwelle (drei Zölle) → Boss → Beuteverteilung → Nachbesprechung ist **durchgehend verdrahtet** (`resonance_dungeons.py`, `dungeon_engine/movement/combat/distribution_service.py`, beide Frontends). 8 Archetypen, 42 Gegner, 129 Begegnungsvorlagen, 302 Banter-Zeilen, 105 Beutestücke, 64 Objektanker, 19 Fähigkeiten aus YAML-Paketen. Der Betrieb: 15 Läufe auf Prod, alle vom Eigentümer.

**Was der Lauf zurück in die Welt schreibt (das Beste der drei Systeme):** Stimmung, Stress, ein Moodlet, eine Aktivitätszeile, bei Boss-Beute dauerhafte Aptitude-Punkte (+1, max +2 je Agent), eine Erinnerung, gesenkte Event-Wirkung, ein Journal-Fragment, bis zu zwölf Erfolge. Kein anderes System gibt so viel zurück. **Aber** (§2.3): für jede seit April geschmiedete Welt sind Stimmung/Stress-Schreibungen No-ops.

### 3.1 Befunde

| # | Grad | Befund | Beleg |
|---|---|---|---|
| D1 | **P0** | **Bergen (Deluge `salvage`) stürzt bei Erfolg ab**: `instance.loot.append(item)`, aber `DungeonInstance` hat kein Feld `loot` → Pydantic `AttributeError` → 500. Kein Test deckt Bergen. | `dungeon_movement_service.py:890`, `models/resonance_dungeon.py:120-176` |
| D2 | P1 | **Abklingzeiten werden nie durchgesetzt** — auf keiner Seite. `agent.cooldowns` wird genau einmal gelesen (`cooldown_remaining`) und nirgends geschrieben. Die komplette Cooldown-UI in `DungeonCombatBar.ts` kann nie greifen; alle 19 Fähigkeiten inkl. drei Ultimates sind jede Runde verfügbar. Die einzige Rundenressource des Kampfes fehlt. | `models/combat.py:59`, `dungeon_checkpoint_service.py:294` |
| D3 | P1 | **Beute aus jeder Nicht-Boss-Quelle wird gezeigt und verworfen.** `roll_loot` an vier Stellen (Kampfsieg, Schatzraum, Bergen, Rückzug); nur Boss-Beute erreicht `pending_loot` → `fn_apply_dungeon_loot`. Der Spieler sieht Beute, die es nie gab. | `dungeon_combat_service.py:320`, `dungeon_movement_service.py:1028/881`, `dungeon_engine_service.py:470` |
| D4 | P1 | **39 von 105 Beutestücken haben keinen Wirkpfad.** Die lebende RPC kennt 8 Effekttypen ohne `ELSE`; der Inhalt liefert 12. `simulation_modifier` (5), `personality_modifier` (2), `building_repair` (2) versickern still; `dungeon_buff` (30) wird in Python übersprungen; 8 `*_dungeon_bonus` werden gespeichert und von nichts gelesen. Die **einzige echte Beute-Entscheidung** (Big-Five-Dimension bei `personality_modifier`) wird validiert, gespeichert — und von der RPC ignoriert. | Migr. 205 `fn_apply_dungeon_loot` Z. 45-258; `dungeon_distribution_service.py:180, 289-371, 535` |
| D5 | P1 | **Rückzug ist gratis.** `fn_abandon_dungeon_run` ruft `fn_apply_dungeon_outcome` nicht (Abschluss und Wipe tun es). Stress des Laufs verfällt, kein Moodlet. Mit D3 ist die dominante Strategie: erkunden bis gefährlich, zurückziehen, neu starten — ohne Kosten, ohne Abklingzeit (D14). | Migr. 164 Z. 422-455 |
| D6 | P1 | **131 von 302 Banter-Zeilen können nie feuern.** `select_banter` wird nur bei Raumeintritt und Rückzug gerufen; die Trigger `combat_won` (26), `rest_start` (18), `loot_found` (17), `agent_stressed` (11), `dungeon_completed` (7), `party_wipe`, `agent_downed`, `elite_spotted`, `rest_ambush` sind unerreichbar. Je Archetyp 9-22 tote Zeilen. | `dungeon_banter.py:131`, `dungeon_movement_service.py:273`, `dungeon_engine_service.py:458` |
| D7 | P1 | `FALLBACK_SPAWNS` kennt **7 von 8 Archetypen** — The Overthrow fehlt; Rast-Hinterhalte im Overthrow spawnen Shadow-Gegner. | `dungeon_shared.py:44-80`, `dungeon_movement_service.py:945`, `dungeon_combat_service.py:493` |
| D8 | P1 | **Fertigkeitsprobe stumm übersprungen → garantierter Erfolg**, wenn der Client `agent_id` weglässt oder alle Agenten gefangen sind; `requires_aptitude` wird serverseitig nie geprüft. | `dungeon_movement_service.py:446-451, 441-443` |
| D9 | P1 | **Keine Rückmeldung an die Resonanz, die den Dungeon geöffnet hat.** `runs.resonance_id` ist immer NULL; kein Dungeon-Dienst berührt `substrate_resonances`/`resonance_impacts`. Der besiegte Archetyp bleibt sofort wieder verfügbar; die Spezifikation (§5.3 Beziehungen `shared_dungeon_experience`, §5.4 Druckminderung 0,15 × Schwierigkeit, §5.5 Herzschlag-Phase, Chronik) ist in diesen Punkten nicht gebaut. | `dungeon_engine_service.py:245-257`; `grep shared_dungeon_experience` = 0 |
| D10 | P1 | **Vier Backend-Flächen ohne Verbraucher**: `getEvents`, `getHistory`, `getRunPublic`, `getHistoryPublic` haben 0 Aufrufer → kein Laufverlauf, kein Ereignisprotokoll, öffentliche Laufseiten unerreichbar. | `DungeonApiService.ts`, `public.py:1074/1088` |
| D11 | P1 | **Erfolgs-Toast feuert nie** (§2.5, Prod-gemessen). | `VelgAchievementToast.ts:83-93` |
| D12 | P1 | **Die Wipe-Erzählung ist falsch**: „Alle Agenten sind verloren" — tatsächlich −20 Stimmung, +200 Stress, ein Moodlet; niemand ist verloren. | Migr. 164 Z. 493; `dungeon_combat_service.py:362-382` |
| D13 | P2 | **Drei von fünf Schwierigkeitsfaktoren werden nie gelesen** (`enemy_power`, `stress_mult`, `loot_quality`). Stufe 5 vs. 1: Gegner halten 1,8× mehr aus, drei Räume tiefer — schlagen aber gleich hart, Stress und Beutequalität identisch. | `dungeon_archetypes.py:518-524`, `dungeon_combat.py:78, 529` |
| D14 | P2 | **Schaden ist ein Bool**: Basis 1, ab `power ≥ 7` → 2, Deckel 2. Nur 4 von 42 Gegnern und 2 von 6 Schadensfähigkeiten erreichen 7. `basic_attack` (3) und `assassin_precision_strike` (5, Apt. 3) tun denselben Schaden; Verwundbarkeiten und Bonusschritte gegen Power-7-Gegner tot. | `combat_engine.py:168`, `condition_tracks.py:72` |
| D15 | P2 | **Gruppenzusammenstellung ist in den meisten Welten keine Entscheidung**: fehlende Aptitudes werden mit 6 aufgefüllt, max `min_aptitude` ist 5 — ein Agent ohne Zeilen schaltet alles frei. Nur 5 von 35 Welten haben Aptitude-Zeilen (Schmiede schreibt keine). | `models/aptitude.py:30`, `dungeon_engine_service.py:199-201` |
| D16 | P2 | Laufqualität kollabiert zu ±10 Stimmung (`stress > 500`); Kundschaften gratis und dominant, Siegel/Erden/Sammeln kosten 15 Stress + 3 Räume; `afflicted` ist eine Einbahn; Ausgangsräume tun nichts; kein Eintrittspreis, keine Abklingzeit, Schwierigkeit frei wählbar; Agenten „im Dungeon" handeln weiter im Herzschlag. | `dungeon_distribution_service.py:494`; `:551-592`; `:961`; `dungeon_generator.py:211`; `models/resonance_dungeon.py:253` |
| D17 | P2 | Inhaltsasymmetrien, die der Validator nicht sieht: entropy/shadow/tower ohne Boss-Gegner; 2 Gegner in keiner Spawn-Konfiguration; 8 Rast-Hinterhalt-Konfigurationen unreferenziert; keine Mindestzahl-Invariante. | `content/dungeon/archetypes/*` |
| D18 | P2 | Multiplayer ist reines Schema (`party_player_ids`), Roadmap-Phase 0 (Sperre je Lauf) ist gebaut, das Doc sagt „fehlt". `protocol` umgeht das Freigabe-Tor. | `dungeon_engine_service.py:250`, `dungeon-commands.ts:98-118, 267` |
| D19 | P3 | `help dungeon` unvollständig (ohne `ground`, `rally`, `dive`, Zahlenkürzel); grafische Ansicht ohne Texteingabe (kein `dive`, `help`); `DungeonEnemyPanel` importiert, nie gerendert; Audio-Zahnrad ohne Listener. | `dungeon-formatters.ts:1518-1554`, `DungeonGraphicalView.ts:85`, `DungeonHeader.ts:1379` |

### 3.2 Entscheiden oder Zuschauen

Die **Erkundungsschicht entscheidet** (Route, Nebel, Raumtypen, Kundschaften) und die **Schwelle** ist die bestgebaute Entscheidung des ganzen Werks (drei unwiderrufliche, mechanisch verschiedene, archetyp-eigene Zölle). Die **Kampf- und Belohnungsschicht schaut zu**: Schaden ist ein Bool, Abklingzeiten fehlen, Schwierigkeit ändert fast nichts, Beute außer Boss-Beute verdampft, Rückzug kostet nichts. Der Satz der Spezifikation — „die Gruppe kehrt verändert zurück" — stimmt für Stimmung, Stress, ein Moodlet, höchstens eine Erinnerung und bis zu zwei Aptitude-Punkte. Alles andere, was der Dungeon zeigt, wird verworfen.

## 4. Epochen — samt Post

**Verdrahtung.** Anlegen → Einladen → Beitreten (Klon, ADR-005) → Draft → Zyklen (manuell / alle bereit / Frist / aktivitätsgesteuert) → Auflösung → Wertung → Ende → Ergebnisseite: **verdrahtet**, die Sanierung vom 29.08. ist vollständig gelandet (Stichprobe: Route `/epoch/:epochId`, `PassCycleResponse.new_cycle`, `LeaderboardEntry.*_title`, `created_by_id: UUID | None`, Migr. 275/276, `min_cycle_minutes`). Operative (6 Typen), Gegenspionage, Allianzen (Vorschlag/Abstimmung/Spannung/Unterhalt/Verrat), Wertung in 5 Dimensionen, Gefechtsprotokoll mit Nebel, Kriegsraum-SITREP, Dossiers, Chat, Bots + Akademie: alles vorhanden. **Nicht gebaut:** Team-PvP 2v2 (Spez. §5.4, null Code). **Tot:** `CampaignsApiService` (9 Methoden, 0 Aufrufer), `campaign_metrics` ohne Schreiber, acht `epochsApi`-Methoden ohne Aufrufer, drei AFK-Konfigurationsfelder ohne UI.

**Betrieb auf Prod:** 7 Epochen, alle Feb./März. „The Convergence Protocol" steht seit dem 08.03. bei Zyklus 7 in `competition`; kein `cycle_deadline_at` gesetzt → der 30-s-Sweep hat nie etwas zu tun; `ends_at` ist laut Code eine Projektion, keine Frist. Kein Zyklus wurde seit März aufgelöst; keine Einladung je erzeugt.

### 4.1 Was am Ende bleibt

Der Klon wird archiviert (`simulation_type = 'archived'`), die Vorlage bleibt unberührt. Der Spieler behält: bis zu 5 Abzeichen, `academy_epochs_played`, einen schreibgeschützten Klon, eine Ergebnisseite. **Nichts, was in einer Epoche geschieht, ist in der Ursprungswelt je zu sehen** — das im Vorschlagskatalog als P0 geführte „Legacy Cycle" ist nicht gebaut. Das ist konsistent mit „Epochen sind flüchtige Turniere", aber es ist eine Entscheidung, die nirgends als solche festgehalten ist.

### 4.2 Die Post — „funktioniert es überhaupt?"

**Transport [nachgemessen]:** Resend (Schlüssel gesetzt; er ist *send-only*, also gibt es dort keine Versandliste) mit SMTP-SSL-Rückfall (Host/User/Passwort/Port gesetzt); asynchron per httpx, Fehler → Sentry + `False`; kein Versandprotokoll (keine Tabelle, nur eine Logzeile). `site_url` fällt auf `https://metaverse.center` zurück. `RUN_SCHEDULERS = true`, `Epoch_cycle scheduler started` im Log, `RAILWAY_ENVIRONMENT = prod…` → Sentry aktiv.

**Empfängerkette [nachgemessen, SQL-Trockenlauf]:** `epoch_participants → simulations.source_template_id → simulation_members (editor+) → get_user_emails_batch (SECDEF, nur service_role) → notification_preferences` löst für die Prod-Epochen mit menschlichen Teilnehmern 2 bzw. 5 Empfänger mit Adresse auf.

**Sieben Vorlagen, sieben Aufrufer, keine verwaist.** Vier Epochen-Mails (Einladung, Zyklusbericht, Phasenwechsel, Abschluss), drei Schmiede-Mails (Freigabe erteilt/verweigert/Admin-Hinweis).

**Verdikt:** Der Versand ist möglich und die Kette hält. **Ausgelöst wurde er auf Prod, soweit messbar, nie** (0 Einladungen, kein Zyklus seit März, Log nur seit heute). Und was er liefern würde, ist falsch:

| # | Grad | Befund | Beleg |
|---|---|---|---|
| E1 | **P0** | **Der Zyklusbericht liest einen Zyklus ohne Daten.** Seit `202e350c` (29.08.) werden Wertung, Missionsprotokoll und Spannung mit `resolved_cycle` verbucht; die Mail bekommt weiter `cycle_number` (den neuen). `_build_player_briefing` fragt `epoch_scores.cycle_number = cycle_number` → leer → „RANK #0 / 0", Composite 0,0, keine Dimensionsbalken, keine Missionsergebnisse, „0 von N gehandelt". Gleiche falsche Zahl für öffentliche Events, AFK-Events, Auto-Resolve-Prüfung, Spionage. **[nachgemessen]** | `cycle_resolution_service.py:273-274, 349, 387`; `cycle_notification_service.py:180, 214-250` |
| E2 | **P0** | **Einladungen werden nie angenommen.** `mark_accepted` hat null Aufrufer; kein Accept-Endpunkt; die Accept-Ansicht navigiert nach `/epoch` ohne Epochen-ID; Status bleibt `pending`, Token wird nie verbraucht, der Einladende sieht nie, wer kam. **[nachgemessen]** | `epoch_invitation_service.py:162`; `EpochInviteAcceptView.ts:527-529` |
| E3 | **P0** | **Simulations-Einladungen verschicken keine Mail.** `InvitationService` speichert Adresse + Token und kehrt zurück; kein `EmailService`-Import. Der Eingeladene erfährt nichts. **[nachgemessen]** | `invitation_service.py:19-50`, `routers/invitations.py:31-56` |
| E4 | **P0** | **Der Abmelde-Link in jeder Mail ist ein 404.** `_footer_row` verlinkt `{site_url}/settings`; es gibt keine Route `/settings` — das Panel lebt nur unter `/simulations/:id/settings`. **[nachgemessen]** | `email_templates.py:465-472`, `app-shell.ts` (Routenliste) |
| E5 | P1 | **Phasenwechsel-Rang wird über alle Zyklen zugleich berechnet** (kein `cycle_number`-Filter, `LIMIT 50`): 4 Spieler × 5 Zyklen = „Rang 7 von 20". | `cycle_notification_service.py:560-587` |
| E6 | P1 | **Abschluss-Mail geht raus, bevor der letzte Zyklus gewertet ist** → der genannte Sieger kann vom Ergebnis der Seite abweichen. | `cycle_resolution_service.py:517-527, 349`; `scoring_service.py:113-123` |
| E7 | P1 | **Die Mail geht an die Eigentümer der Welt, nicht an den Spieler.** `epoch_participants.user_id` (Migr. 049) wird nie gelesen. Da jeder angemeldete Nutzer jede Vorlage in eine Epoche einbringen darf (Migr. 049/214, kein Mitgliedschaftstest), kann ein Fremder deine Welt spielen, während **du** die Nebel-Berichte samt Spionage-Intel bekommst und er keine. | `cycle_notification_service.py:52-90`; `routers/epochs.py:426`; Migr. 214 Z. 55-88 |
| E8 | P1 | **Akademie-Läufe mailen nach jedem Zyklus**: 3 Tage / 4 h = 18 Zyklen, sofort beim Klick aufgelöst → 18 defekte SITREPs + Abschluss-Mail pro Übungsnachmittag. | `epoch_lifecycle_service.py:164`; `academy_service.py:26-27` |
| E9 | P1 | Einladungs-`locale` ist tot (Body immer zweisprachig, Betreff lokalisiert); `cycle_hours` hart 8 → „8-h-Zyklen" bei einer 24-h-Epoche. | `epoch_invitation_service.py:315-322`; `email_templates.py:130, 246` |
| E10 | P1 | **Manuelles Beenden vergibt keine Erfolge** (`trg_ach_epoch_score` braucht eine Wertungszeile nach dem Statuswechsel; `advance_phase` wertet nicht). | Migr. 194 Z. 173-217; `epoch_lifecycle_service.py:183-247` |
| E11 | P1 | **`OpenRouterError` wird nicht dort gefangen, wo der Rückfall dafür geschrieben wurde** (`bot_chat_service.py:380` fängt nur httpx/KeyError/…); der Vorlagen-Rückfall ist unerreichbar; das W3-Muster in der `OpenRouterService`-Variante, die `lint-model-call-handlers.py` nicht sieht (prüft nur `run_ai`). | `bot_chat_service.py:380-382`, `bot_service.py:69, 266`; `external/openrouter.py:42, 286` |
| E12 | P1 | Erste Einladung je Epoche braucht Modell-Lore **vor** dem Insert, ohne Fangnetz → bei Modellausfall 500, keine Zeile, keine Mail. | `epoch_invitation_service.py:66-68, 279` |
| E13 | P2 | Kriegsraum-SITREP: 500 bei Modellausfall (kein `except` im Dienst, keins im Router). | `sitrep_service.py`, `routers/epochs.py:288` |
| E14 | P2 | **Wächter können die eigene Souveränität nicht verbessern**: `LEAST(100, 100 − penalty + … + guardians × 4)` — jeder startet am Deckel; 4 RP je Wächter sind wertungsneutral für dich und **wertungspositiv für den, der dich knackt** (`LEAST(4, guardians × 2)` Militär). | Migr. 197 Z. 196-201, 264-269 |
| E15 | P2 | Ein Missionsergebnis landet in zwei Zyklen (Protokoll mit `resolved_cycle`, Spionagebericht liest `current_cycle` live); „Undefeated" ignoriert `captured`; `toggle_ready` (die wichtigste Zustandsänderung) lebt im Chat-Dienst; alle Mail-Betreffs außer Einladung hart Englisch. | `operative_mission_service.py:830-838`; Migr. 194 Z. 209-213; `epoch_chat_service.py:140-236`; `cycle_notification_service.py:675, 727-731, 825` |
| E16 | P3 | Einladungs-URL aus `request.base_url` (`FORWARDED_ALLOW_IPS` ist auf Prod **nicht** gesetzt → Schema kann `http` werden); kein `List-Unsubscribe`, kein Text-Teil; `POST /ready` ohne `Depends()`-Tor. | `routers/epoch_invitations.py:55`; `email_service.py:51-56, 122-126`; `epochs.py:779-796` |

**Spezifikation vs. Code:** Die Folgen einer Enttarnung sind im Text weitgehend Fiktion (kein „Diplomatic Incident", kein Botschaftsmalus; −3 landet beim Angreifer-Militär, der Verteidiger *gewinnt* +3 — invertiert zum Text). AFK-Stufe 1 „E-Mail" gibt es nicht, Stufe 3 Stabilitätsmalus nicht; Gnadenreset nach **einem** aktiven Zyklus statt 5/10; „Operative zurückgerufen" beim Abschluss existiert nicht. Umgekehrt undokumentiert: das ganze Einladungssystem, Kriegsraum, Quick-Academy, Stimmungs- und Konvergenz-Modifikatoren in der Erfolgsformel.

### 4.3 Entscheiden oder Zuschauen

Operative (Typ × Ziel × Agent, RP-bepreist, Gegenschlag möglich) und **Allianzen** (Vorschlag, Unterhalt, Spannung, Verrat mit 25 % Diplomatie-Strafe) sind **vollständige, gute Schleifen** — die besten des Werks neben der Dungeon-Schwelle. Bereit/Passen ist die Taktentscheidung (undokumentiert). Wächter sind eine Entscheidung, die den Spieler bestraft (E14). Wertung, Gefechtsprotokoll, SITREP, Dossier: Zuschauen — das ist die Belohnungsschicht, und **genau die drei Flächen, die dem Spieler seine Folgen zurückerzählen, sind die kaputten** (E1, E5, E6). Das Spiel spielt; es erzählt sich nicht zurück.

## 5. DRIFT

**Lage auf Prod [nachgemessen]:** `drift_p0_enabled = true`, **`drift_fun_core_enabled = false`**, `drift_ai_enabled = false`. Der Spielkern (W1 + W2 + W2.6: Ökonomie, Havarie, Signale, Sondierung, Funkboje, Siegel/VP, Clearance) ist gebaut, gemergt (Juli), auf Prod migriert — und **ausgeschaltet**. Live läuft die P0-Schleife, die das Redesign-Konzept selbst als „nicht unterhaltsam" diagnostiziert hat (tote Ökonomie, eine Route, leere Züge). Ein Lauf existiert (12.07., Eigentümer). Die aktive Karte ist Version 3 (`framed-topology-2`, 72 Knoten, Python-Generator vom 29.08.); ihr Schlüsselformat passt zum Frontend-Parser.

**Verdrahtung.** Aufbruch → Takt → Signal → Sondierung → Funkboje → Havarie → Depesche annehmen/liefern → Effekte (4 von 9) → Erstvermessung → Entladung/Rückzug → Clearance: alles als atomare RPC mit CAS, `auth.uid()`-Wächter, `FOR UPDATE`, Audit in der Transaktion (ADR-007 vollständig eingehalten; keine einzige Fetch-Compute-Update-Stelle in Python). Zahlenwerk v2: 13 von 14 Zeilen angewandt (Überlast `+1 BB/Zug je Slot` fehlt; Funkboje „an Relais" und Notfrequenz „nur bekannte Kanten" sind halb, weil weder Relais noch Nebel existieren). **W3 ist nicht begonnen.**

### 5.1 Befunde

| # | Grad | Befund | Beleg |
|---|---|---|---|
| R1 | **P0** | **Der Spielkern ist auf Prod aus, seine UI wird unbedingt gerendert.** `/public/drift/state` kennt nur `drift_p0_enabled`; Markerstapel (Sondieren + Funkboje) und Ledger-Streifen erscheinen immer → 0 Siegel / 0 VP für immer, zwei Knöpfe, die stets `GATE_CLOSED` antworten, und `fn_travel_complete` zahlt im Gate-aus-Zweig **nichts** (nur `haul_safe`, den das Gate unerreichbar macht). | `drift_service.py:124`, `models/drift.py:423`, `DriftView.ts:1354, 1716-1731`; Migr. 265 Z. 305-330 |
| R2 | **P0** | Die Route `/simulations/:id/drift` ist unbedingt registriert; nur der Reiter ist geschaltet. Gate aus → `/drift/chart` 404 → Fehlerzustand mit einem Retry, der nie gelingen kann. | `app-shell.ts:639-651`, `SimulationNav.ts:50`, `DriftView.ts:1419-1425` |
| R3 | P1 | **Mitgliedschaft am Anker: dokumentiert als Pflicht (Entscheidung §22.2), nirgends geprüft.** `POST /drift/run` trägt nur `get_current_user` + `require_drift_p0`; `fn_travel_run_open` prüft nichts. Da `target = anchor` als „home" gilt, kann **jeder angemeldete Nutzer** in jede aktive Vorlage Events (Impact ≤ 10) und ungedeckelte Agenten-Erinnerungen schreiben. **[nachgemessen]** | `routers/drift.py:193-202`; Migr. 239 Z. 65/316; Migr. 255 Z. 123-124, 181-183 |
| R4 | P1 | **Der Lauf öffnet an der Welt der Route, „home" ist aber der Profil-Anker.** Zweiter Reiter in einer anderen Welt → geparkt in der Fremde, ohne Erklärung; Kollaps-Prüfung und Entladung rechnen mit dem Profil. | Migr. 265 Z. 400-407, 922-927; Migr. 278 Z. 255-258; `DriftView.ts:1288-1293, 1660` |
| R5 | P1 | **Graben am Heimatdock dominiert das Reisen.** `fn_sondieren` hat weder Knotentyp- noch Heimat-Wächter; Erträge 2/3/5/8 je Takt, Erstankunft an einem `near`-Knoten zahlt 0; Graben kostet keine BB, KH, DZ (außer Riss), riskiert keine Havarie, Entladung zu Hause zahlt 100 %. Optimal: Aufbruch → zu Hause graben bis zwei Marker offen → Entladung. Null Züge. Verletzt Konzept-KPI F2. | Migr. 268 Z. 123-153; Migr. 246 Z. 83 |
| R6 | P1 | **Migration 277 hob den DZ-Deckel 20 → 40 und ließ jede DZ-Schwelle auf der 20er-Skala.** `dz_kh_bleed.threshold = 8`, Bänder ruhig ≤ 7 / erhöht ≤ 14, `dz_divisor = 10` → Blutung über 80 % der Skala, Strafmaximum verdoppelt (−4) gegen Inhalt, der für −2 geschrieben ist; **11 von 15 Proben bei DZ 40 unschaffbar, 7 von 15 bei DZ 30.** | Migr. 246 Z. 87; Migr. 267 Z. 66-71 |
| R7 | P1 | `traveler_profiles.affinities` wird nie geschrieben → Prüfvektor und Off-Vektor-Band tote Faktoren; jeder Optionschip nennt einen Vektor, der nichts ändert. | Migr. 239 Z. 84-85; Migr. 278 Z. 233; Migr. 267 Z. 1129 |
| R8 | P1 | **Es gibt keinen Nebel.** `GET /drift/chart` liefert die volle Topologie; `traveler_discoveries` hat zwei Schreiber, null Leser; `rumor_reveal` enthüllt nichts. Konzept §17 verlangt serverseitige Filterung. | `drift_service.py:146-163`; Migr. 253 Z. 59, 267 Z. 498 |
| R9 | P1 | **Routenwahl blind**: `DriftChartEdge.weight` ist typisiert und wird von null Frontend-Dateien gelesen — die Bandbreitenkosten eines Zugs sind vor dem Zug unsichtbar (Redesign-Prinzip R2). Jeder Zwischenknoten trägt den „hier andocken"-Ring (`interstitial: 0` wie `broadcast_rand`). Shader-Indizes 1-6 unerreichbar (6 von 8 Knotentypen nie erzeugt). | `types/drift.ts:321`; `gameGraph.ts:23-32, 113-114` |
| R10 | P1 | Depeschen-Angebote sind unvergleichbar (~56 Angebote je Chip ohne Lohn/Distanz/Kosten); die Gastfreundschaft des Ziels erscheint erst **nach** der Lieferung. `drift_hospitality` hat **genau einen Schreiber** (Seed 239); 15 von 16 aktiven Vorlagen haben den Wert `nur_echos`, die eine Welt nach dem Seed fällt auf `geschlossen` **[nachgemessen]**; `standard` und `offen` verhalten sich identisch. | `drift_service.py:620-658`; Migr. 239 Z. 303-310; Migr. 255 Z. 154, 178 |
| R11 | P1 | Weltübergreifende Schreibungen sind **nur Deutsch und landen in den falschen Spalten** (`v_text_de` → `events.title/description`, `agent_memories.content`; `title_de`/`content_de` bleiben leer). Scheitern erzeugt nur Inhalt, wenn eine Depesche an Bord war (Konzept-KPI 13 gilt nicht). | Migr. 255 Z. 141-142, 164, 188-189, 302-306 |
| R12 | P1 | **Keine Tastaturbedienung** (Canvas `role="img"`, Labels `aria-hidden`, nur Pointer); die dreimal zitierte `ChartAccessibilityList` existiert nirgends. Rückzug vernichtet die lose Fracht mit einem unbestätigten Geisterknopf ohne Preis; `run.overstay` (+5 DZ/Takt) wird nie angezeigt. | `DriftChartHost.ts:854-890`; `DriftView.ts:1750-1752, 1261`; Migr. 278 Z. 277-279 |
| R13 | P1 | **Keine Betriebsfläche**: `POST /drift/admin/regenerate` ohne Frontend-Aufrufer, `fn_drift_emergency_return` ohne jeden Aufrufer, keine Admin-Schalter für die Gates. Jeder Hebel ist Hand-SQL. | `AdminPlatformConfigTab.ts:12` |
| R14 | P2 | Sieben Tabellen ohne Schreiber (`traveler_scars`, `agent_travel_effects`, `zone_modifiers`, `travel_dressing_cache`, `travel_quest_participants`, `published_routes`, `route_purchases`); vier Plattform-Haken ohne Nutzer (`system_hook='travel_option'`, Erfolgskategorie `travel`, `buildings.sanctuary`, `chronicles.mentions`); fünf Settings ohne Verbraucher (`drift_p1..p4`, `drift_ai_enabled`); `random()` im Deep-Surge auf dem Live-Pfad (nicht deterministisch); Aufbruch gratis und ohne Abklingzeit = freies Neuwürfeln des Signalstapels; 500 Zierknoten des Spikes über der echten Tafel; veraltete Rückfallkonstanten (`DZ_CAP_FALLBACK = 20`); rohe Enum-Slugs in der deutschen UI; Backend-Labels hart Deutsch. | Migr. 241/242/239; Migr. 278 Z. 290; Migr. 265 Z. 936; `DriftChartHost.ts:421-423`; `DriftView.ts:119-121, 475, 1774`; `drift_service.py:503-509` |

**Nicht gebaut (Konzept v0.4):** Begehung komplett (`zone_adjacencies` von der Schmiede erzeugt, von niemandem gelesen), 6 von 8 Knotentypen, Umstimmung/7 Frequenzen (Shader-Uniform ist eine Konstante), Nebel, Pings, Scan, Autopilot, veröffentlichte Routen, Narben, Wracks, Rettung, Mitfahrt, Konvoi, Wetter aus Resonanzen, Frachtwendungen, Gefährten, 5 von 9 Effekten, die LLM-Kleidung (null Modellaufrufe im ganzen System — Inhaltsvielfalt hart bei 32 Signal-Skeletten + 4 Depeschen-Vorlagen gedeckelt), der Storylet-Selektor, der Reise-Ticker, jede Admin-Fläche. **Gebaut ohne Konzept:** nichts von Gewicht — zwei gute Erfindungen der Umsetzung (`travel_run_seeds` als geheimes Salz; das abgeleitete Fracht-Modell aus W2.6/E).

### 5.2 Entscheiden oder Zuschauen

**Die Tafeln sind exzellent** — Havarie (fünf bepreiste Optionen, jeder Preis genannt, kein Auto-Zweig) ist das bestgebaute Panel des Werks; Funkboje (70 % jetzt vs. 100 % zu Hause) die bestgeformte Entscheidung; Sondieren sauber (steigender Ertrag, zählbare Marker, echter Riss). **Das Spiel darum herum ist noch keins:** die Tafel ist von Zug 1 an voll sichtbar, die optimale Spielweise ist Stillstehen und Graben, die Währung hat eine Senke, die man einmal benutzt, der Rang schaltet nichts frei — und auf Prod ist von alledem nichts eingeschaltet. Der Zug selbst ist eine Entscheidung mit falscher Information (Kosten unsichtbar, Ziel bekannt).

## 6. Wechselwirkungen — was zwischen den Systemen fließt

Die verifizierte Kantenliste (23 Kanten) reduziert sich auf ein Bild: **alles liest aus dem Simulationskern; zurück schreiben Dungeons viel, DRIFT wenig, Epochen nichts.**

| Von → Nach | Was fließt | Stand |
|---|---|---|
| Kern → Dungeon | Resonanzen bestimmen Verfügbarkeit/Archetyp/Schwierigkeit; die Gruppe sind echte Welt-Agenten mit Aptitudes/Stimmung/Stress | gebaut |
| Dungeon → Kern | Stimmung, Stress, Moodlets, Aktivitäten, **dauerhafte Aptitudes**, Erinnerung (ohne Embedding), Event-Wirkung, Gebäudeschutz-Lesepfad (unerreichbar, D4) | gebaut, mit den Lücken §2.3 und D3-D5 |
| Dungeon → Journal / Erfolge | Imprint-Fragment je Lauf; 12+ Abzeichen | gebaut |
| Dungeon → Resonanz | — | **fehlt** (D9) |
| Kern → Epoche | vollständiger Welt-Klon (ohne Draft, ohne Aptitudes seit Migr. 060) | gebaut, beschädigt (§2.6) |
| Epoche → Kern | **nichts** — alle Schreibungen (Events, Botschaften, Bögen, Befestigungen) landen im Klon, der archiviert wird | fehlt („Legacy Cycle" P0 im Vorschlagskatalog, nicht gebaut) |
| Epoche → Journal / Erfolge / Nutzer | Signature-Fragment je Zyklus; 5 Abzeichen; `academy_epochs_played` | gebaut |
| Kern → DRIFT | Welten + Verbindungen + Botschaften bauen die Karte; Lore/Agenten/Events als Dock-Kulisse | gebaut |
| DRIFT → Kern | 4 von 9 Effekten (`events` × 2 Arten, `agent_memories`, Journal-Fragment) hinter dem Gastfreundschafts-Gate; `event_echoes` (die Ripple-Pipeline) wird **nicht** berührt; kein Embedding | teilweise, sprachlich falsch (R11) |
| Dungeon/Epoche → DRIFT, DRIFT → Dungeon/Epoche | — | **nichts** in beide Richtungen |
| Journal → irgendwohin | `journal_attunements.system_hook` (der versprochene „Klebstoff") wird von keinem Dungeon-, Epochen- oder DRIFT-Code gelesen; `dungeon_threshold_wait_option` hat 0 Verbraucher | fehlt |

**Währungen:** drei disjunkte Bücher ohne Wechselkurs — Erfolge (Dungeon + Epoche + Kern; **DRIFT hat keine Kategorie**), DRIFT-VP/Siegel (nur `fn_drift_award`), Schmiede-Token. **Ein Ort, der die Stellung über alle Säulen zeigt: gibt es nicht.** `user_dashboard_service.py` liefert Mitgliedschaften, aktive Epochen, Akademie-Zähler, globale Resonanzzahl — keine Dungeon-Läufe (die werden je *Simulation*, nie je *Nutzer* abgefragt), kein DRIFT-Profil, keine Erfolge. `UserProfileView.ts` zeigt aus keiner Säule etwas.

**Identität:** Dungeon = Simulationsmitglied (editor), Epoche = Teilnehmer (bewusst von Mitgliedschaft entkoppelt, Migr. 049), DRIFT = Nutzer (ohne jede Mitgliedschaftsprüfung, R3), Journal/Erfolge = Nutzer. Agentenidentität über Säulen ist konstruktiv sicher (der Klon prägt neue UUIDs; Dungeons können in Klonen nicht laufen, weil `resonance_impacts` nicht geklont wird). Der eine echte Identitätsfehler ist R4 (Lauf-Heimat ≠ Effekt-Heimat).

**Das Integrationskonzept** (`game-systems-integration.md`, „das wichtigste Architekturdokument") enthält das Wort „dungeon" **null Mal**, DRIFT ebenso — es ist älter als beide Systeme. Für die Wechselwirkungen der drei Spielsysteme gibt es keinen Vertrag; was existiert, ist in den Einzelspezifikationen versprochen und dort zu 5 von 12 Punkten gebaut (Tabelle im Kreuzbericht: gebaut 4, teilweise 2, fehlend/gebrochen 10).

## 7. Hilfesystem und Onboarding

**Bestand:** 16 Themen in `htp-topic-data.ts` (10 961 Wörter, 1 718 `msg()`-Zeichenketten), XLIFF vollständig extrahiert (0 fehlende Einheiten), das Deutsche, wo es existiert, literarisch, korrekt umgelautet, konsequent „du". Die Zahlen der Epochen-Hilfe stimmen zu 15/15 mit `constants.py`/`models/epoch.py`, die Dungeon-Zahlen (Shadow/Tower) zu 9/12, DRIFT zu Migr. 246/277. Das Terminal ist die am besten bediente Fläche (Thema + Boot-Sequenz, die die ersten Befehle nennt + Hilfe-Schnellaktion + `help`).

### 7.1 Ohne jede Hilfe

| Feature | Fläche | Beleg |
|---|---|---|
| **Auszeichnungen** (35 Abzeichen, 7 Kategorien, 5 Stufen) | `/commendations` | 0 Treffer; als „Topic 14" im Restrukturierungsplan vorgesehen, nie gebaut; das Raster erklärt nicht, wie man ein Abzeichen erwirbt |
| **Resonanz-Journal + Konstellationen** | `/journal`, `VelgConstellationCanvas.ts` (1 568 Zeilen) | eine beiläufige Erwähnung |
| **Zyklusfrist / Passen / AFK-KI-Übernahme** | `EpochReadyPanel.ts:598,662`, `EpochBattleLog.ts:405` | „deadline"/„AFK" = 0 Treffer im ganzen Korpus; nur der *Ersteller* bekommt eine Blase |
| **DRIFT im Spiel** | `DriftView.ts:1707-1712` | vier deutsche Messgrößen als nackte Labels, kein Tooltip, kein Tutorial, kein Link |
| Bureau-Archiv, Bureau-Dispatch/Chiffren-ARG | `/archives`, `/bureau/dispatch` | 0 Treffer — und der Erstkontakt-Dialog schickt Neuankömmlinge **direkt** ins undokumentierte ARG |
| Broadsheet-Reiter | Sim-Reiter | „broadsheet" nur als Stilwort der Chronik |
| Verzweiflungsaktionen („Gebäude dauerhaft zerstören") | `DesperateActionsPanel.ts:423-448` | 0 Treffer |
| Entropie-Timer / Ascendancy-Aura / Bleed-Palimpsest | `SimulationShell.ts:1077-1107` | 0 Treffer |
| Simulation-anlegen-Assistent | `/new-simulation` | das `forge`-Thema beschreibt einen anderen Assistenten |
| Puls-Eintragstypen (19 Labels) | `SimulationPulse.ts:958-1000` | keine Legende (§3.2 des Konzepts verlangt sie) |
| **Einstieg in die Hilfe** | Landing, Footer, `SimulationNav/Header/Shell` | **null** `/how-to-play`-Links; erreichbar nur über den eingeklappten „OPS"-Cluster und ⌘K |

### 7.2 Die neun Kennzahlen (Konzept §3.2)

3 von 9 haben eine echte Info-Blase (alle drei in `AgentMoodPanel.ts`); **0 von 9 beantworten alle drei Fragen** (Was / Warum / Was tun). Die B1-B3-Liste ist zu 5 von 6 erfüllt (fehlt: Einfluss-Stufensymbol auf Agentenkarten). Beide Ansätze — Blase und qualitative Aufschlüsselung — existieren halbfertig nebeneinander.

### 7.3 Veraltet

- **Terminal:** „30 Befehle" (32), „Stufe 2 = 10 Befehle" / „Stufe 3 = 25" (das sind Freischalt-Schwellen, tatsächlich 11 und 5), „Stufe 4 ab 50 Befehlen" (Epochenmodus allein genügt), „Acht Befehle … deploy, ally, broadcast, encrypt" (vier davon existieren nicht); die In-Terminal-Hilfe nennt `scan`/`debrief` „future" — beide sind gebaut. `htp-topic-data.ts:974-985`, `htp-content-features.ts:1055-1122`, `terminal-formatters.ts:511`.
- **Epochen:** „alle bereit → keine Wartezeit" ignoriert `min_cycle_minutes`; Aktivitätsmodus, Frist, AFK, Passen fehlen ganz. `htp-content-features.ts:1018` vs. `models/epoch.py:96-102`.
- **Dungeons:** „6 Schulen" (7), Mindestgruppe 2 unerwähnt, `help dungeon` ohne `ground`/`rally`/`dive`, 2 von 8 Archetypen erklärt, grafische Ansicht ohne jeden Hilfe-Einstieg.
- **Kriegsraum:** Balance-Analytik auf „v2.1" fixiert, Changelog endet **08.03.2026** — Dungeons, Epochen-Sanierung, DRIFT, Alpha, Bindungen, Journal, Atlas, Aktivitätszyklen: nichts davon in „Updates".
- **Suche** indiziert Titel + Beschreibung + TL;DR + Abschnittstitel = **~10 % des Korpus**; Fließtext und Schrittnarration sind unauffindbar. `htp-search.ts:53-96`.
- „12 Themen" hart kodiert an drei Stellen (es sind 16); `readTime` ohne Bezug zur Wortzahl (44-203 wpm); `drift` von keinem anderen Thema verlinkt; Quickstart erwähnt weder Dungeons noch DRIFT.

### 7.4 Sprache

**125 von 1 718 Hilfe-Zeichenketten (7,3 %) zeigen deutschen Nutzern Englisch** — systematisch die Kartenbeschreibung und die TL;DR-Punkte von 13 der 16 Themen, also die sichtbarste Fläche. `bonds`, `dungeons`, `drift` (die drei jüngsten) sind vollständig. Umgekehrt ist die **Alpha-Suite nur Deutsch** (8 von 13 Zeichenketten identisch EN/DE): der allererste Dialog eines englischen Besuchers ist deutsch. Der LLM-Ismen-Lint prüft nur die englische Quelle.

### 7.5 Onboarding — wo der Faden reißt

Landing (kein Hilfe-Link) → Erstkontakt (deutsch; führt ins ARG) → Registrierung (kein „Mail erneut senden") → Assistent (4 Schritte, **verlinkt die Hilfe nie**; einmaliges DB-Flag, **nicht wiederholbar**) → Landung auf Dashboard / Schmiede / Akademie — und **keine dieser drei Flächen führt den Faden weiter**. Der Dashboard-Leerzustand ist zwei Zeilen; das Tagesbriefing ist ein Statusbericht, kein Auftrag; es gibt keine Questliste, keine Checkliste, kein Ziel. In der Simulationsschale ist die Verlassenheit vollständig: null Hilfe-Referenzen in Nav, Kopf, Schale. Die Leerzustände der Reiter sind Inventarmeldungen („No events found."), keine Lektionen — Ausnahmen: Gebäude („Create one to get started.") und Puls („The substrate awaits its first heartbeat."). Die beste Übergabe des ganzen Flusses ist `VelgForgeClearanceRequired` → `/how-to-play/guide/byok`.

## 8. Oberflächen — „gibt es für jede Mechanik die perfekt gestaltete Oberfläche?"

Nein — aber die Antwort ist präziser als ein Nein. Die **Gestaltung** ist auf hohem Niveau, wo sie existiert (Prod-Sichtprüfung als Eigentümer: Agentenkarten als TCG mit sechs Schulen und Porträt, Lore-Seiten, Kriegsraum-Kopf, Dungeon-Lobby, DRIFT-Sternkarte, Journal-Leerzustand als Prosa). Was fehlt, ist nicht Politur, sondern **Deckung** und **Wahrhaftigkeit**: Mechaniken ohne Fläche, Flächen, die etwas versprechen, das die Mechanik nicht hält, und Flächen, die auf Prod einen Zustand zeigen, der nie eintritt.

### 8.1 Mechaniken ohne Oberfläche (gebaut, unerreichbar)

| Mechanik | Backend | Fehlt |
|---|---|---|
| Dungeon-Laufverlauf, Ereignisprotokoll, öffentliche Laufseiten | 4 Endpunkte | jeder Aufrufer (D10) |
| Dungeon-Abklingzeiten | Modellfeld | die Serverseite (D2) — die UI existiert, die Mechanik nicht |
| Epochen-Einladung annehmen | `mark_accepted` | Endpunkt + Ansicht (E2) |
| Benachrichtigungs-Präferenzen (plattformweit) | Tabelle + API | eine globale Route (E4) — nur unter `/simulations/:id/settings` |
| AFK-Strafe / Eskalation / KI-Persönlichkeit | `EpochConfig`-Felder | jede UI |
| Kampagnen | Router + 9 API-Methoden | jede Komponente; `campaign_metrics` ohne Schreiber |
| DRIFT: Karte neu erzeugen, Notrückruf, beide Gates | RPC/Endpunkt | Admin-Fläche (R13) |
| DRIFT: `overstay`, Kantenkosten, Gastfreundschaft des Ziels | DTO/Schema | Anzeige (R9, R12) |
| Erfolge: „wie erwirbt man das?" | 35 Definitionen | jede Erklärung im Raster |
| Onboarding wiederholen | DB-Flag | jede Steuerung |

### 8.2 Oberflächen, die etwas Falsches zeigen

- **DRIFT-Markerstapel und Ledger** bei geschlossenem Spielkern (R1): zwei Knöpfe, die immer scheitern, 0 Siegel/0 VP für immer.
- **Dungeon-Beute** aus Kampf/Schatz/Bergen/Rückzug wird angezeigt und existiert nicht (D3); die **Wipe-Erzählung** lügt (D12); **Schwierigkeit 3 / Tiefe 6** steht auf jeder Lobby-Karte identisch, weil die Faktoren nicht gelesen werden (D13).
- **Epochen-Mail**: Rang „#0 / 0" (E1), Rang über alle Zyklen (E5), falscher Sieger möglich (E6).
- **Journal-Leerzustand** verspricht: „Fragmente sammeln sich, während du spielst" — `journal_enabled` ist auf Prod nicht gesetzt, der Generator steht still, zwei Anfragen vom 29.08. warten mit `attempts = 0`. **[Launch-Schalter, nachgemessen]**
- **Puls** zeigt deutschen Nutzern die englische Erzählzeile (`SimulationPulse.ts:1255` rendert `narrative_en` unbedingt); die deutsche Zeile enthält ihrerseits unübersetztes `{direction}` („Substrat-Narbengewebe deepening"). **[nachgemessen]**
- **Epochen-Kommandozentrale**: „AKTIVE OPS: 7" zählt sieben seit März stehende Epochen; die Lobby-Karte „bob" läuft mit 16 „Beitreten als …"-Knöpfen über und überdeckt „Details anzeigen"; die Gründungs-Karten sind zu zwei Dritteln leer. **[nachgemessen]**
- **Hilfe-Landung**: „12 Themen" (16). Terminal-Hilfe nennt Gebautes „future".
- **Erfolgs-Toast** und **Weltkarten-Live-Marker** feuern auf Prod nie (§2.5).
- **Jede Welt trägt in jeder Sprache ihren englischen Namen** (Messung der Parallelsitzung, Forge-Befund 16 verschärft): 41 von 41 Welten haben `simulations.name_de` leer, 12 davon bei gefülltem `description_de`; kein Backend-Code schreibt die Spalte, der Slug ist aus dem englischen Namen abgeleitet. Die Zweisprachigkeit der Welt endet am Titel.
- **Jede Auswahlliste, die aus `simulation_taxonomies` schöpft, ist in Schmiede-Welten leer** (Messung der Parallelsitzung, Forge-Befund 30): alle 26 `forge_drafts` tragen `taxonomies = {}`, `fn_materialize_shard` Schritt 8 läuft null Mal — keine `zone_type`, `building_type`, `profession`, `system`, `gender`, `building_condition` für diese Welten (16 von 41 ohne `building_condition`). Filter und Dropdowns zeigen dort nichts, und 115 von 314 Gebäuden tragen einen Zustand, den ihre Welt nicht kennt.

### 8.3 Bedienbarkeit

- DRIFT-Tafel ohne Tastaturpfad; die dokumentierte Zugänglichkeitsliste existiert nicht (R12). Rückzug ohne Bestätigung/Preis.
- Grafischer Dungeon ohne Texteingabe → `dive`, `help`, Zahlenkürzel unerreichbar; kein Hilfe-Einstieg.
- Kein Hilfe-Einstieg in der Simulationsschale; kein Hilfe-Link auf Landing/Footer.
- DRIFT-Messgrößen und Epochen-Frist/Passen ohne Erklärung am Ort.

### 8.4 Die Deckung in Zahlen (Kreuzreferenz Endpunkte ↔ Frontend)

576 Endpunkte in 59 Routern; 537 haben eine passende Client-Methode in `frontend/src/services/api/`; **114 dieser Methoden ruft keine Komponente**; **33 Endpunkte sind gänzlich unbenutzt** (kein Frontend, kein Scheduler, kein Webhook); 5 haben externe Verbraucher (Health, GitHub-Webhook, robots/sitemap/indexnow); 1 ist ein dokumentiertes Duplikat. Vollständige Tabellen (576 Endpunkte, 537 Aufrufer, 39 Waisen, 58 Routen): `docs/analysis/endpoint-ui-xref-2026-08-30.md`.

| Bereich | Endpunkte | mit Client | Client ohne Aufrufer | unbenutzt |
|---|---|---|---|---|
| social (inkl. campaigns) | 68 | 66 | **31** | 2 |
| admin | 72 | 65 | 5 | 7 |
| epoch | 67 | 64 | 9 | 2 |
| forge | 62 | 59 | 7 | 3 |
| agents | 33 | 29 | 5 | 4 |
| dungeon | 28 | 28 | 7 | 0 |
| drift | 22 | 21 | 0 | 1 |
| chat | 19 | 19 | 2 | 0 |
| heartbeat | 18 | 18 | **9** | 0 |
| resonances | 18 | 18 | 6 | 0 |
| events | 18 | 17 | 4 | 1 |
| locations | 16 | 16 | 4 | 0 |
| buildings | 15 | 14 | 4 | 1 |
| embassies | 13 | 11 | **7** | 2 |
| health | 13 | 7 | 0 | **6** |
| journal | 11 | 11 | 0 | 0 |
| bonds / broadsheet / chronicle / lore | 27 | 26 | 7 | 1 |
| connections | 5 | 2 | 0 | 3 |
| world-map / achievements / aptitudes / multiverse | 15 | 15 | 0 | 0 |

**Lesart:** Die unbenutzten Endpunkte sind zu drei Vierteln die **interaktive Hälfte** der lebenden Welt — Anker, Attunements, Bureau-Antworten (heartbeat 9/18), Botschafts-Lebenszyklus und Ward (embassies 7/13), Professionen (ganzer Router), Verbindungen anlegen/ändern/löschen, Epochen-Instanzen, Gesundheit je Gebäude/Zone/Botschaft. Die Backends dieser Mechaniken sind fertig; die Oberfläche hat sie nie abgeholt. Umgekehrt: `SocialMediaApiService` und `CampaignsApiService` sind vollständig tote Clients.

**Frontend-Aufrufe ins Leere (6):** zwei davon **live** — `UserProfileView.ts:270` ruft `GET /users/me/memberships`, `:293` ruft `PUT /users/me`; keiner der beiden Endpunkte existiert (`users.py` kennt `GET /me`, `/me/dashboard`, `/me/notification-preferences`, `PATCH /me/onboarding`). **Die Profilseite scheitert bei jedem Laden und jedem Speichern** **[nachgemessen]** — und `/profile` ist von nirgends verlinkt (das Nutzermenü hat genau einen Eintrag: „Sign Out"). Die übrigen vier sind tote `CrudApiService`-Basismethoden (`getBySlug`, `listPublic`).

**Routen:** 58; unverlinkt sind `/profile` und `/data-deletion` (im Footer fehlt der Link neben Privacy/Terms). **Stubs im UI:** nur sieben ehrliche („coming soon", „not yet available", „Not yet configurable" ×2, Kartenrahmen, Taxonomie-Import, Archetyp-Detail) plus der Hinweis in `EpochCreationWizard.ts:55-57`, dass das Backend fünf Auto-Resolve-Modi kennt und die UI zwei anbietet. Keine TODO/FIXME-Reste, keine blinden Handler.

## 9. Ist es durchdacht, logisch, unterhaltsam? — Gesamturteil

**Durchdacht: ja, in den Teilen; nein, als Ganzes.** Jedes System hat ein Konzeptdokument von hoher Qualität, und die Umsetzung folgt ihm bis zu einem Punkt, an dem eine Welle endete (Dungeon: Spez. §5.3-5.5 ungebaut; Epochen: Team-PvP, Legacy Cycle; DRIFT: W3 und alles nach v0.4 §11). Was fehlt, ist der **Vertrag zwischen den Systemen**: das Integrationskonzept kennt weder Dungeon noch DRIFT, der Vorschlagskatalog nennt die Verbindungen als P0 und niemand hat sie gebaut. Drei Spielsysteme, die aus derselben Welt schöpfen und ihr nichts zurückgeben, sind keine Wechselwirkung, sondern drei Abzweigungen.

**Logisch: überwiegend, mit einer wiederkehrenden Fehlerklasse.** Die Formeln sind sauber, die Atomizität (ADR-007) ist vorbildlich, RLS und SECDEF-Grants stimmen. Die Fehlerklasse ist immer dieselbe: **ein Faktor, den niemand liest** — drei von fünf Schwierigkeitsfaktoren (D13), Schaden als Bool (D14), Affinitäten (R7), Kantenkosten (R9), `resonance_operative_*_cap` (drei Settings, alle inert), Wächter (E14), 39 Beutestücke ohne Wirkpfad (D4), 131 Banter-Zeilen ohne Trigger (D6). Und dazu ein zweiter Typ: **ein Gate, das mehr abschaltet als gemeint** — der BYOK-Schlüssel nimmt den kostenlosen Vorlagenpfad mit (§2.2), `journal_enabled` fehlt und hat keine Admin-Fläche, `drift_fun_core_enabled` lässt die UI stehen (R1), das Skip-Tor im Herzschlag friert Welten ein (§2.1).

**Unterhaltsam: dort, wo die Kette schließt — und sie schließt selten.** Die Prüfung nach Entscheidung → beobachtbare Folge → neue Situation ergibt in allen drei Systemen dasselbe Muster: **die Entscheidungen sind gut gebaut, die Folgen kommen nicht an.**

| System | Beste Entscheidung | Wo die Folge verloren geht |
|---|---|---|
| Dungeon | die Schwelle (drei Zölle), die Route im Nebel | Beute außer Boss verdampft; Rückzug gratis; Resonanz bleibt offen; Erfolgs-Toast feuert nie |
| Epoche | Allianz/Verrat, Operative | die Mail liest den falschen Zyklus; nichts erreicht die Ursprungswelt; Wächter bestrafen den Käufer |
| DRIFT | Havarie, Funkboje | Spielkern aus; Karte ohne Nebel; Graben schlägt Reisen; eine Währung mit einer Senke |
| Simulation | Chat, Beziehungen, Terminal (bis die Punkte weg sind) | Puls = Metronom; Events/Resonanzen/Erinnerungen seit März stumm; Journal leer; die einzige Antwort auf ein Event hat keine UI und bewegt eine Zahl, die niemand liest; der Chat verwirft, was er sich merkt |

Für ein Werk, das als Ausdruck existiert (Nordstern), ist das keine Frage von Metriken: **Die Welt erzählt sich seit fünf Monaten nichts mehr.** Das ist der eine Satz dieser Prüfung. Alles andere sind seine Ursachen — die meisten bewusst (Kosten), zwei still (Herzschlag-Stall, fehlende Stimmungszeilen), einige aus Wellen, die vor dem letzten Glied endeten.

### 9.1 Reihenfolge, die ich vorschlagen würde (kein Auftrag, ein Vorschlag)

1. **Das Stille sichtbar machen und das Bevorstehende abwenden** (Stunden): Migration `'bond_whisper'` in den CHECK (§2.7 — vor dem nächsten Tick der Bindungswelt) und der Batch-Insert tolerant; Herzschlag-Skip-Zweig auf Warnung + Zeigerreparatur für Velgarien/Möbius; `gather`-Ausnahmen protokollieren; Autonomie-Panel auf Kategorie `heartbeat` (§2.8); `fn_initialize_agent_autonomy` beim Schmieden und Klonen rufen + Nachfüllen der 42 Agenten (Peer-Sitzung hat die Stelle in `materialize_shard` vorbereitet, Forge-Befund 35); Realtime-Publikation um `events` + `user_achievements` erweitern.
2. **Die vier Mail-P0s** (Stunden): `resolved_cycle` an die Mail, Route `/settings` (oder Footer-Link auf die existierende Fläche), Einladungs-Accept-Endpunkt, Simulations-Einladung mit Mail — dann ein Test-Versand an die eigene Adresse.
3. **Kostenneutral wieder einschalten** (Stunden): Vorlagenpfad der autonomen Events ohne Schlüssel (Budget 0) — damit A2/Katharsis leben; `journal_enabled` seeden und die zwei wartenden Fragmente laufen lassen (ein Modellaufruf je Fragment, planbar).
4. **Die verlorenen Folgen** (Tage): Dungeon-Beute persistieren oder ehrlich als flüchtig zeigen, Rückzug bepreisen, `salvage`-Absturz, Abklingzeiten entscheiden; DRIFT-Spielkern entweder einschalten (mit Sondier-Beschränkung + DZ-Skala) oder seine UI hinter das Gate legen.
5. **Der fehlende Vertrag** (ein Dokument, dann Wellen): Integrationskonzept v4 mit Dungeon, Epoche, DRIFT — welche Säule gibt was zurück, eine Währung oder drei, ein Ort für die Stellung des Nutzers.

## 10. Fragen, die nur der Eigentümer beantworten kann

1. **Epochen-Nachwelt:** Sind Epochen bewusst flüchtige Turniere (Vorlage heilig), oder ist der „Legacy Cycle" noch gewollt? Davon hängt ab, ob Epochen je in die Welt zurückwirken.
2. **Wer bekommt die Epochen-Post — der Spieler oder die Welt-Eigentümer?** (E7) Mit offener Teilnahme (Migr. 049) sind das verschiedene Menschen.
3. **Soll die Akademie mailen?** (E8) 18 Berichte je Übungsnachmittag.
4. **Dungeon:** Soll ein besiegter Archetyp seine Resonanz verbrauchen (D9)? Soll Rückzug kosten (D5)? Abklingzeiten durchsetzen oder streichen (D2)? Nicht-Boss-Beute behalten oder ehrlich flüchtig (D3)?
5. **DRIFT:** Gate jetzt öffnen (W2 ohne W3-Senke) oder UI hinter das Gate? Sondieren auf Fremdknoten beschränken? DZ-Schwellen auf 40er-Skala? Mitgliedschaft am Anker durchsetzen (R3)? Gastfreundschaft — wer schreibt sie?
6. **Autonome Events ohne Schlüssel** über den Vorlagenpfad — gewollt (Kosten 0) oder war die Stille auch dort Absicht?
7. **Journal:** einschalten (`journal_enabled`), oder bleibt P5 bis auf Weiteres? Solange bleibt die Leerzustands-Prosa ein Versprechen ohne Deckung.
8. **Währungen:** drei getrennte Bücher (Erfolge, VP/Siegel, Token) mit Absicht — Kunstwerk ohne Meta-Grind — oder ein Wechselkurs?
9. **Hilfe:** Auszeichnungs-Thema noch geschuldet? 125 englische Zeilen im Deutschen nachziehen? Alpha-Dialog zweisprachig? Ein `?` in der Simulationsschale?
10. **Migration 060:** War der Verlust von Draft + Aptitudes im Klon Absicht (Fairness) oder Kollateralschaden? Davon hängt die Richtung des Fixes ab.
