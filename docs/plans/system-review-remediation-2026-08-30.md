---
title: "Umsetzungsplan zur Systemprüfung vom 30.08.2026"
version: "1.0"
date: "2026-08-30"
type: plan
status: ready-to-implement
lang: de
tags: [remediation, heartbeat, epochs, mail, dungeons, drift, help, ui, prod]
---

# Umsetzungsplan zur Systemprüfung 2026-08-30

> Übergabe an eine umsetzende Sitzung (Opus, händisch, Schritt für Schritt). Grundlage: `docs/analysis/system-review-2026-08-30.md` (Befund-Nummern §2.x, S, D, E, R, H, U beziehen sich darauf) und `docs/analysis/endpoint-ui-xref-2026-08-30.md`. Alle Zeilenangaben gelten für `main @ 2f89573b` plus die W4-Commits der Parallelsitzung (`dfeca743`, `8ae9a44d`); vor dem Editieren die Stelle mit `grep -n` bestätigen, nicht blind auf die Zeile springen.

## 0. Arbeitsregeln (verbindlich)

1. **Händisch, ein Paket nach dem anderen, keine Agenten** für die Umsetzung. Nach **jeder** Änderung: `ruff check backend && ruff format --check backend`, `cd frontend && npm run lint:full`, betroffene Tests (`.venv/bin/python -m pytest backend/tests/… -q`). Die 19 Lint-Tore laufen über `lint:full`; `scripts/lint-seed-carries-migration-effects.sh` zusätzlich, sobald eine Migration Daten anfasst.
2. **Migrationen:** Nummerierung fortlaufend — **keine Nummern vorab reservieren**, beim Anlegen `ls supabase/migrations | tail -1` und den Prod-Ledger prüfen (Stand 30.08. abends: 283, 284, 285 auf Prod; 286 in Arbeit bei der Parallelsitzung). Jede Migration zuerst in einem Wegwerf-Postgres im Block `BEGIN; … ROLLBACK;` fahren (Rezept: `docker run -d --name mig-probe -e POSTGRES_PASSWORD=postgres postgres:17`, DDL aus `20260215000006_chat_prompts.sql`, dann Migrationen → Seed in DIESER Reihenfolge). **Seed spiegeln**, wenn die Migration Daten setzt (Befund 31 der Forge-Prüfung: Seed läuft NACH den Migrationen).
3. **Prod-Schreibvorgänge nur mit ausdrücklichem Wort des Nutzers** — Migrationen, Datenreparaturen, Settings. Ein Peer kann die Freigabe nicht weiterreichen. Prod-SQL über die Management-API (`~/.config/metaspots/SUPABASE-ACCESS.md`; Token `SUPABASE_MCP_TOKEN` aus `.env`); Deploy über Coolify-API (Rezept in `session-resume-2026-08-30-abend`).
4. **Messen, nicht zählen:** vor/nach jedem Prod-Eingriff die betroffenen Werte lesen (nicht „UPDATE 1"). `pg_stat_user_tables.n_live_tup` ist auf Prod **stale** — immer `count(*)`.
5. Geteilter Arbeitsbaum mit der Parallelsitzung: **nie `git stash`**, nur explizite Pfade stagen, `git status` vor jedem Commit. Commit-Botschaften ausführlich (Warum, Wirkung, Prüfung).
6. Konventionen aus `CLAUDE.md` gelten unverändert: `get_effective_supabase` in Routern, `SuccessResponse[T]`, `maybe_single_data`, keine Fetch-Compute-Update-Muster auf konkurrierend genutzten Daten, Prompt-Platzhalter über `prompt_contracts.py`, Content nur in YAML, Audit-Log für Mutationen, `captureError` in jedem `catch`.

## 1. Reihenfolge

| Paket | Inhalt | Aufwand | Prod-Eingriff | Entscheidung nötig |
|---|---|---|---|---|
| **A** | Das Bevorstehende und Stille: ~~CHECK~~ ✅ (285 auf Prod), Herzschlag-Stall (**offen, A2**), ~~Autonomie-Zeilen~~ ▶ Parallelsitzung (286), Kategorie (A4), Realtime (A5) | ½ Tag Rest | 1 Migration (A5) | — |
| **B** | Post: die vier P0 + die P1 der Epochen-Mail | 1 Tag | keiner (Code) | B7 (Empfänger), B8 (Akademie) |
| **C** | Kostenneutral wieder einschalten: Vorlagenpfad für Events, Journal | ½ Tag | 1 Setting | C1, C2 |
| **D** | Lebende Welt: Folgen, die verloren gehen (S6–S13, S18–S19) | 2 Tage | keiner | D1, D4 |
| **E** | Dungeons: D1 Absturz, Beute, Rückzug, Banter, Fallbacks, Proben | 2 Tage | keiner | E2–E4 |
| **F** | DRIFT: UI hinter das Gate, Mitgliedschaft, Anker, Skalen | 1–2 Tage | 1 Setting | F1, F3–F5 |
| **G** | Oberfläche: Profilseite, Puls-Sprache, Epochen-Karten, Journal-Versprechen, Links | 1 Tag | keiner | — |
| **H** | Hilfe: veraltete Zahlen, fehlende Themen, Einstiege, 125 deutsche Zeilen | 2 Tage | keiner | H1, H2 |
| **I** | Epochen-Klon: Draft + Aptitudes (Migr. 060) | ½ Tag | 1 Migration | I1 |

A und B zuerst; C nach A (braucht die Autonomie-Zeilen, damit Events etwas bewegen). Der Rest in beliebiger Reihenfolge, E vor F, wenn nur eines geht.

---

## Paket A — Das Bevorstehende und Stille

### A1 · `bond_whisper` in den CHECK (§2.7) — **zuerst, vor dem nächsten Tick der Bindungswelt**

> **✅ ERLEDIGT 30.08. abends durch die Parallelsitzung** (`velgarien-rebuild-45`, Freigabe des Nutzers direkt an sie): Migration `20260830200000_285_…` **auf Prod** (19 966 Bestandszeilen unter dem neuen CHECK, Probezeile transaktional angenommen), Vokabular `HEARTBEAT_ENTRY_TYPES` in `heartbeat_entry_builder.py`, Migration daraus erzeugt, AST-gebundener Test `backend/tests/unit/test_heartbeat_entry_types.py` (jeder literale Typ deklariert, jeder deklarierte emittiert, CHECK = Deklaration), `HeartbeatService._insert_entries` fällt bei `PostgrestAPIError` auf zeilenweises Einfügen zurück und meldet jede abgelehnte Zeile mit Typ an Log + Sentry. **Offen aus A1 nur noch Punkt 4** (Frontend-`HeartbeatEntryType` + Ikonen für `resonance_mood`/`bond_whisper`) — prüfen, ob die Parallelsitzung es mitgenommen hat.
>
> Messlehre aus der Umsetzung: der erste AST-Scan fand **null** Typen, weil `entry_type` das vierte **Stellungsargument** von `make_heartbeat_entry` ist und nach Schlüsselwörtern gesucht wurde — ein grünes Tor, das aufs Falsche zeigt. Jedes Tor, das Aufrufstellen scannt, braucht einen Test, der fehlschlägt, wenn der Scan nichts findet.

- **Ursache:** `backend/services/heartbeat_service.py:606-617` emittiert `entry_type="bond_whisper"`; Prod-CHECK `heartbeat_entries_entry_type_check` (Migr. `20260409200000_186_…`) kennt 20 Werte ohne diesen. Batch-Insert `:647` → eine ungültige Zeile verwirft den ganzen Tick, markiert `failed`, rückt `last_heartbeat_tick` nicht vor.
- **Fix:**
  1. Migration `…_285_heartbeat_entry_type_bond_whisper.sql` nach dem Muster von 186: `DROP CONSTRAINT` + `ADD CONSTRAINT … CHECK (entry_type = ANY (ARRAY[<die 20 bestehenden>, 'bond_whisper']))`. Die 20 bestehenden aus `pg_get_constraintdef` (Prod) oder Migr. 186 übernehmen — **nicht aus dem Kopf**.
  2. Eine einzige Quelle für die Liste in Python: `HEARTBEAT_ENTRY_TYPES: frozenset[str]` in `backend/services/heartbeat_entry_builder.py`; `make_heartbeat_entry` (`:16-39`) validiert `entry_type` dagegen und wirft `ValueError` **vor** dem Insert. Unit-Test `backend/tests/unit/test_heartbeat_entry_types.py`, der die Migration 285 per Regex liest und beide Mengen gleichsetzt (Muster: `test_prompt_contracts.py` bindet Deklaration an Aufrufstellen).
  3. Batch-Insert `:647` robust: bei `PostgrestAPIError` mit CHECK-Verletzung die Einträge einzeln einfügen und die ungültigen mit `logger.error` + Sentry melden — der Tick darf nicht an einer Zeile sterben.
  4. Frontend: `HeartbeatEntryType` in `frontend/src/types/index.ts:1738-1757` um `resonance_mood` und `bond_whisper` ergänzen; Ikone/Label in `SimulationPulse.ts:958-1000` (sonst rohe Slugs, U-Befund).
- **Prüfung:** Wegwerf-DB: Migration 285 anwenden, `INSERT INTO heartbeat_entries (…, entry_type='bond_whisper')` gelingt; Unit-Test grün; `pytest backend/tests/test_heartbeat*.py -q`.
- **Prod:** Migration anwenden (Wort des Nutzers). Danach messen: `select position('bond_whisper' in pg_get_constraintdef(oid))>0 from pg_constraint where conname='heartbeat_entries_entry_type_check'`.

### A2 · Herzschlag-Stall (§2.1) — Selbstheilung statt Handreparatur

> **OFFEN — erster Punkt der nächsten Sitzung.** Die Parallelsitzung hat es dem Nutzer als Option vorgelegt; er hat W5 gewählt. Orientierung in der Datei: das neue `HeartbeatService._insert_entries` (A1) sitzt unter „Helpers" direkt vor `_build_dispatch`; der Upsert/Reclaim-Block liegt in `_tick_simulation`.
>
> **Abgrenzung (Messung der Parallelsitzung, 30.08. spät):** Nach `next_heartbeat_at <= now()` sind **sieben** Welten fällig, nicht zwei. Die fünf weiteren (`the-ancestral-dream-syndicate`, `the-oneironautical-beacon`, `the-prophecy-of-fractured-time`, `the-tamagotchi-temporality`, `the-tamagotchi-temporality-principle`) sind die **fünf archivierten Vorlagen** (`status = 'archived'`, Bestandsmessung §1); die Fälligkeitsabfrage filtert `.eq("status", "active")` (`_tick_due_simulations`, `:255`) — sie sind **zu Recht** unsichtbar, ihr `next_heartbeat_at` stammt aus derselben Sammelkorrektur vom 09./10.04. Kein zweiter Defekt. Zwei Aufräumpunkte: (1) beim Archivieren `next_heartbeat_at = NULL` setzen (Archivierungspfad in `simulation_service`/Migr. 035 `archive_epoch_instances`), damit Fälligkeitsabfragen nicht täuschen; (2) die Messquery unten führt `status` mit.

- **Ursache:** `_tick_simulation` (`heartbeat_service.py`, Upsert-Block ~`:300-360`): existierende Zeile mit Status ≠ `failed` → `logger.debug` + `return`, `next_heartbeat_at` bleibt. Velgarien: Zeiger 46, Zeile 47 `completed`; Möbius: Zeiger 38, Zeile 39 `processing` (verwaist seit 24.03.).
- **Fix** (drei Zweige statt einem):
  - `failed` → zurückholen (bestehend).
  - `processing` und `created_at < now() − 2 × Tick-Intervall` → als verwaist behandeln: zurückholen wie `failed`, `logger.warning` + Sentry-Tag `phase=orphan_reclaim`.
  - `completed` (Zeiger hinkt) → `simulations.last_heartbeat_tick = tick_number`, `last_heartbeat_at = row.created_at`, `next_heartbeat_at = now()` setzen, `logger.warning` + Sentry, `return` (der nächste Durchlauf tickt `tick_number + 1`).
  - Sonst (`processing`, jung) → Skip, aber `logger.info` statt `debug`.
  - `_tick_due_simulations` (`:247-296`): das Ergebnis von `asyncio.gather(…, return_exceptions=True)` durchlaufen; jede Exception mit `logger.exception` + `sentry_sdk.capture_exception` (Tags `service=heartbeat`, `simulation_id`).
  - `last_heartbeat_tick`-Vorrücken in den Erfolgs- **und** Fehlerpfad, unabhängig vom Entries-Insert (heute liegt die Zuweisung im `try`, `:684-694`).
- **Prüfung:** Unit-Test mit Attrappe: (a) Zeile `completed` > Zeiger → Zeiger rückt vor; (b) `processing` älter als 2 Intervalle → zurückgeholt; (c) `processing` jung → Skip mit Info-Log. Dann auf Prod nach dem Deploy messen: `select slug, last_heartbeat_tick, last_heartbeat_at from simulations where slug in ('velgarien','the-m-bius-academy')` — innerhalb einer Minute muss Velgarien auf 47 stehen und binnen 4 h einen Tick 48 haben. **Kein manueller Prod-UPDATE nötig.**

### A3 · Stimmungs- und Bedürfniszeilen für geschmiedete Welten (§2.3)

> **✅ ERLEDIGT 30.08. abends durch die Parallelsitzung — Migration 286 auf Prod:** `fn_materialize_shard` Schritt 11b ruft `fn_initialize_agent_autonomy` je Agent **in SQL** (dieselbe Transaktion — ein Agent kann nicht mehr ohne Innenleben entstehen); Backfill der 42 Bestandsagenten: 42/42/42 → 0/0/0 (Stimmung, Bedürfnisse **und Startzone** — `current_zone_id` fehlte denselben 42). CI grün (`4ea31199`), Migrationen 283–286 auf Prod, Ledger-Kopf `20260830210000`. Offen aus A3 nur Punkt 2 (Klon-Funktion) — gehört zu Paket I. **Für die nächste Sitzung: `ls supabase/migrations | tail -1` vor jeder neuen Migration.**

- **Ursache:** `fn_initialize_agent_autonomy` (Migr. `…145_agent_autonomy_foundation.sql:428`) hat nur den Aufrufer `PersonalityExtractionService.initialize_agent_autonomy` (`backend/services/personality_extraction_service.py:187`), den nichts im Betrieb ruft. `fn_materialize_shard` (Migr. 122) und `clone_simulations_for_epoch` (Migr. 060) legen keine Zeilen an. 42 von 258 Prod-Agenten betroffen (Welten aus 04/2026 und 08/2026).
- **Fix:**
  1. `backend/services/forge_orchestrator_service.py:748ff` (`materialize_shard`, von der Parallelsitzung als Forge-Befund 35 vorbereitet): nach dem Anlegen der Agenten `fn_initialize_agent_autonomy` je Agent rufen (über den Admin-Client; die Funktion ist SECDEF — Grant-Regel aus `CLAUDE.md` beachten: **nicht** an `authenticated`).
  2. `clone_simulations_for_epoch`: im SQL je geklontem Agenten `PERFORM fn_initialize_agent_autonomy(new_agent_id, …)` — Signatur aus Migr. 145 lesen. Gehört mit Paket I in dieselbe Migration.
  3. Backfill-Migration `…_286_backfill_agent_autonomy_rows.sql`: `INSERT INTO agent_needs/agent_mood … SELECT … FROM agents a WHERE NOT EXISTS (…)` — idempotent, keine Zeile überschreiben. **Seed-Spiegelung prüfen** (`scripts/lint-seed-carries-migration-effects.sh`).
- **Prüfung:** Wegwerf-DB: Schmiede-Test `backend/tests/…forge_orchestrator…` erweitern (Attrappe erwartet den RPC-Aufruf je Agent). Prod nach Migration: `select count(*) from agents a left join agent_mood m on m.agent_id=a.id where m.agent_id is null` → **0**.
- **Entscheidung A3:** Backfill für die 42 bestehenden Agenten ja (Standardwerte) — oder nur ab jetzt? Empfehlung: ja, sonst bleiben zwei Welten auf Dauer tot.

### A4 · Kategorie der Autonomie-Einstellungen (§2.8)

- **Ursache:** `frontend/src/components/settings/AutonomySettingsPanel.ts:144-146` → `'autonomy'`; `heartbeat_service._load_sim_overrides` (`:230`) liest nur `'heartbeat'`. Ebenso `bond_whisper_budget`: Panel schreibt `bonds`, Herzschlag liest `heartbeat` (`:598`).
- **Fix (nachhaltig):** `category` typisieren statt Strings vergleichen — `backend/models/settings.py:27` als `Literal[...]`/Enum der bekannten Kategorien; im Frontend eine `SettingsCategory`-Union, die `BaseSettingsPanel.category` erzwingt. Dann `AutonomySettingsPanel` → `'heartbeat'`; `bond_whisper_budget` in `BondSettingsPanel` → `'heartbeat'` (oder der Herzschlag liest den Bonds-Schlüssel aus `'bonds'` — eine Quelle, nicht zwei). Die vier toten Regler (`autonomy_event_threshold`, `_stress_cascade_enabled`, `_relationship_auto_create`, `_briefing_mode`) entweder verdrahten oder aus dem Panel entfernen — kein Regler ohne Leser.
- **Prod-Daten:** keine Zeile in falscher Kategorie (gemessen) — kein Datenfix.
- **Prüfung:** `tsc` schlägt bei falscher Kategorie fehl; `pytest backend/tests/unit/test_settings*.py`.

### A5 · Realtime-Publikation (§2.5)

- **Ursache:** Prod-Publikation = `ai_usage_log, forge_access_requests`. Migr. 237 (`events`) fehlt im Prod-Ledger; `user_achievements` in keiner Migration.
- **Fix:** Migration `…_<nächste freie Nummer>_realtime_publication_events_achievements.sql` (Nummern werden **nicht** vorab reserviert — die Parallelsitzung vergibt 286 und ggf. 287; beim Anlegen `ls supabase/migrations | tail -1` prüfen) mit **zwei** idempotenten `DO`-Blöcken (Muster 237: `EXCEPTION WHEN duplicate_object THEN NULL`). Für `user_achievements` gilt RLS in Realtime — der Toast (`VelgAchievementToast.ts:83-93`) filtert auf `user_id`; prüfen, dass die RLS-Policy `select` für den eigenen Nutzer erlaubt.
- **Prüfung:** Prod: `select tablename from pg_publication_tables where pubname='supabase_realtime'` → vier Tabellen. Dann im Browser einen Erfolg auslösen (z. B. „Erste Schritte") und den Toast sehen.

---

## Paket B — Die Post

> **Stand 31.08.2026 (Sitzung `velgarien-rebuild-88`):** B1, B3, B4, B5, B6, B7,
> B8, B9, B10, B11, B12, B13, B15 sind **erledigt und committet**. B2 ist durch
> die neue Route `/settings/notifications` erledigt (siehe Mail-Handoff P0.4),
> B14 bis auf den Testversand ebenfalls. **Offen: nur noch B16** (Testversand an
> die Adresse des Nutzers — braucht sein ausdrückliches Wort) und die
> Tagesobergrenze aus dem Handoff (Punkt 26, braucht eine Zahl).
>
> Dazwischen kam ein zweiter Auftrag: Claude Design hat den kompletten Mail-Satz
> neu entworfen. Das Übergabedokument liegt als `handoff/email-redesign.md` im
> Repo; **P0 (6 Punkte) und P1 (10 Punkte) sind abgearbeitet**, P2 (neue
> Vorlagen) und P3 (Betrieb, bis auf die Sendetabelle) stehen aus. Vier Punkte
> des Handoffs überschneiden sich mit Paket B; die Zuordnung steht am Ende des
> Handoff-Dokuments.
>
> Migration **291** (`email_log`) ist gebaut und im Wegwerf-Postgres dreifach
> geprobt, **nicht auf Prod**.


Alle Stellen in `backend/services/cycle_notification_service.py` (CNS), `cycle_resolution_service.py` (CRS), `epoch_lifecycle_service.py` (ELS), `epoch_invitation_service.py` (EIS), `email_templates.py` (ET), `invitation_service.py`, `routers/`.

| # | Befund | Fix | Prüfung |
|---|---|---|---|
| B1 | **E1** Mail liest neuen Zyklus | CRS `:387`: `resolved_cycle` übergeben. In CNS `_build_player_briefing` alle Abfragen prüfen, die `cycle_number` nutzen (`:180` Scores, `:440` öffentliche Events, `:455` AFK, `:467` Auto-Resolve, `:328` Spionage) — sie meinen den **aufgelösten** Zyklus. Ein Unit-Test, der `resolve_cycle_full` mit Attrappe fährt und die an `send_cycle_notifications` übergebene Nummer prüft (Regressionstest gegen `202e350c`). | Test grün; Betreff/Body-Snapshot mit Rang ≠ 0 |
| B2 | **E4** `/settings` = 404 | Zwei Optionen: (a) globale Route `/settings/notifications`, die `NotificationsSettingsPanel` ohne Simulationskontext rendert (nachhaltiger — die Präferenz ist per Nutzer, nicht per Welt); (b) Footer-Link auf `/simulations/{slug}/settings` des Empfängers. **Empfehlung (a).** ET `_footer_row:465-472` entsprechend. | Link in gerenderter Mail klicken → Panel |
| B3 | **E2** Einladung nie angenommen | Endpunkt `POST /api/v1/epochs/invitations/{token}/accept` (Router `epoch_invitations.py`), Service `EIS.mark_accepted` (`:162`) + Beitritt auslösen oder Epochen-ID zurückgeben; `EpochInviteAcceptView._handleEnter` (`:527-529`) ruft ihn und navigiert nach `/epoch/{epoch_id}`. Audit-Log für die Mutation. | Testfall: Token → Status `accepted`, `accepted_by_id` gesetzt, Doppelannahme abgewiesen |
| B4 | **E3** Simulations-Einladung ohne Mail | ET: `render_simulation_invitation(sim_name, inviter, link, …)` + Betreff; `invitation_service.create_invitation` (`:19-50`) verschickt über `EmailService.send` (best-effort, Ergebnis zurückgeben, nicht blockierend werfen); Route `/invitations/:token` existiert. | Unit-Test mit `EmailService.send`-Attrappe |
| B5 | **E5** Rang über alle Zyklen | CNS `_build_standing_snapshot:560-587`: `cycle_number`-Filter auf den zuletzt gewerteten Zyklus (`scoring_service.get_leaderboard`-Logik wiederverwenden, nicht kopieren). | Test: 4 Spieler × 5 Zyklen → „Rang x von 4" |
| B6 | **E6** Abschluss vor Wertung | CRS: `compute_cycle_scores(resolved_cycle)` **vor** `_apply_phase_transition` ausführen, oder die Abschluss-Mail nach der Wertung senden. | Test: Sieger in Mail = Sieger auf Ergebnisseite |
| B7 | **E7** Empfänger = Welt-Eigentümer | CNS `_resolve_recipients:52-90`: `epoch_participants.user_id` als Empfänger (Migr. 049). **Entscheidung B7:** nur der Spieler, oder Spieler + Welt-Eigentümer ohne Spionage-Intel? Empfehlung: nur der Spieler. | Test mit Fremdspieler in fremder Welt |
| B8 | **E8** Akademie mailt 18×  | `send_cycle_notifications`/`send_epoch_completed_notifications`: `epoch_type == "academy"` überspringen wie ELS `:164`. **Entscheidung B8:** ganz still, oder nur Abschluss? | Test |
| B9 | **E9** `locale`/`cycle_hours` | EIS `send_email:315-323`: `email_locale` durchreichen; `cycle_hours` aus `epoch.config` liefern (ET `:130,246`). | Snapshot |
| B10 | **E10** manuelles Ende ohne Erfolge | ELS `advance_phase:183-247`: bei `completed` vorher `compute_cycle_scores` für den letzten Zyklus. | Trigger `trg_ach_epoch_score` feuert |
| B11 | **E11** `OpenRouterError` ungefangen | `bot_chat_service.py:380`, `bot_service.py:266`: `OpenRouterError` in die Tupel; **Tor erweitern:** `scripts/lint-model-call-handlers.py` auch auf `OpenRouterService.generate*`-Aufrufstellen (heute nur `run_ai`). | Tor findet die Stelle vor dem Fix |
| B12 | **E12** Lore vor Insert | EIS `create_and_send:66-68`: Insert zuerst, Lore best-effort (Fallback-Text), Mail danach. | Test mit Modellfehler |
| B13 | **E13** SITREP 500 | `sitrep_service.py` + `routers/epochs.py:288`: Hausmuster aus `routers/generation.py:103` (→ 503). | Test |
| B14 | **E15/E16** Betreffs, `base_url`, Header | Betreffs je Empfänger lokalisieren (`:675, 727-731, 825`); `routers/epoch_invitations.py:55` → `settings.site_url`; `email_service.py`: `List-Unsubscribe`-Header + Text-Alternative. | Snapshot |
| B15 | Versandprotokoll | Tabelle `email_deliveries(recipient_user_id, template, epoch_id, cycle, transport, message_id, ok, error, created_at)` + Insert in `EmailService.send` (Migration + Modell + Admin-Lesefläche optional). Damit „kam keine Mail" beantwortbar ist. | Prod: erste Zeile nach dem ersten Versand |
| B16 | Abnahme | **Test-Versand an die Adresse des Nutzers** (Einladung + ein manuell aufgelöster Zyklus einer Test-Epoche) — nur mit seinem Wort, danach Test-Epoche wieder entfernen (Rezept `activity-gated-first-prod-run-2026-08-29`). | Mail im Postfach mit Rang ≠ 0 |

---

## Paket C — Kostenneutral wieder einschalten

### C1 · Autonome Events ohne Schlüssel über den Vorlagenpfad (§2.2)

- `heartbeat_service.py:1152-1166`: statt `if owner_has_key:` immer `AutonomousEventService.check_and_generate(…)` rufen, mit `llm_budget = budget if owner_has_key else 0` und `openrouter_api_key=None` ohne Schlüssel. `AutonomousEventService` (`autonomous_event_service.py:266-267, 586-606`) nimmt bei Budget 0 bereits den Vorlagenpfad (`_create_event_template`). Prüfen, dass `_create_event_with_narrative` bei `openrouter_api_key=None` nicht doch das Modell ruft.
- Damit leben A2 (Stabilität → Wahrscheinlichkeit), Katharsis, Gebäudeschädigung und Beziehungen-aus-Meinungen **ohne einen Modellaufruf**. Die Vorlagentexte sind vorhanden.
- **Entscheidung C1:** gewollt? Der Nutzer hat die Erzählschichten aus Kosten abgeschaltet — der Vorlagenpfad kostet nichts, erzeugt aber Events (Puls, Zonendruck). Empfehlung: ja, mit `autonomy_llm_budget_per_tick = 0` als Standard.
- **Prüfung:** Unit-Test: kein Schlüssel → `check_and_generate` wird mit Budget 0 gerufen; Prod nach 24 h: `select count(*) from events where created_at > now() - interval '1 day'` > 0.

### C2 · Journal einschalten (§2b, S20)

- `journal_enabled` in `platform_settings` seeden (Migration **und** Seed), Admin-Schalter in `AdminPlatformConfigTab` ergänzen. Die zwei wartenden Anfragen (`fragment_generation_requests`, `attempts=0`) laufen dann — **je Fragment ein Modellaufruf** (Kosten planbar, `fragment_prompts.py`).
- **Entscheidung C2:** an oder P5 abwarten? Solange aus: Leerzustandstext des Journals (`VelgResonanceJournal`) ehrlich machen („Das Journal ist noch nicht freigeschaltet") — siehe G6.

### C3 · Autonomy-Admin-Override als Plattformweg (§2.8)

- Nach A4 ist `autonomy_admin_override` schaltbar. Wenn der Nutzer Modell-Events für einzelne Welten mit dem Plattformschlüssel will: Panel-Schalter dokumentieren, Budget je Tick begrenzen (`autonomy_llm_budget_per_tick`), und `byok_bypass_enabled` daneben erklären.

---

## Paket D — Lebende Welt: verlorene Folgen

| # | Befund | Fix | Entscheidung |
|---|---|---|---|
| D1 | **S6** `contain` bewegt `events.heartbeat_pressure`, das Phase 3 überschreibt und die MV nie liest | Nachhaltig: Bureau-Antworten als **Multiplikator auf `impact_level` in `mv_zone_stability`** (Migration: `events.pressure_modifier numeric default 1.0`, von `bureau_response_service.py:283-293` gesetzt, von der MV gelesen), und `fn_compute_event_pressure_batch` (Migr. 133:130-138) respektiert ihn. Dann ist `contain` real. | Ja — Formel |
| D2 | **S7** autonome Events ohne Folgen | `_post_event_mutation` (`event_service.py`) nach jedem Insert in `autonomous_event_service.py:646`, `echo_service.py:533`, Operativen-Events rufen — oder besser: einen DB-Trigger `AFTER INSERT ON events`, der Bogen-Anbindung/Kaskade/Gebäudeschädigung anstößt (ADR-007). | Trigger vs. Python — Empfehlung Trigger |
| D3 | **S8** Bureau-Antworten ohne UI | Komponente im Events-Detail: drei Knöpfe (contain/remediate/adapt, Agentenwahl, Kosten), `HeartbeatApiService.createResponse` (`:50-71`). `velg-frontend-design`-Skill vorher laden. | — |
| D4 | **S9** Attunement ohne Tür | Kleine UI im Gesundheits-/Resonanz-Bereich: „Einstimmen auf ⟨Archetyp⟩" (max 2, Wechselsperre 3 Ticks), `setAttunement/removeAttunement`. | Ja: soll die Mechanik bleiben? |
| D5 | **S10** Terminal-Punkte füllen sich nie | `TerminalStateManager.refreshBudgets()` (`:469-473`) an den Herzschlag koppeln: beim Laden `last_heartbeat_tick` vergleichen, je neuem Tick auffüllen (Ops 3 / Intel 2). | — |
| D6 | **S11** Zusammenbruch ohne Folge | Bei ≥ 800: Stress auf 400 setzen, Moodlet „Erschöpft" (−) für 6 Ticks + „Erleichtert" (+) danach (Katharsis pro Agent), ein `agent_activities`-Eintrag, keine Wiederholung binnen 24 Ticks. Konzept §VI. | Zahlen |
| D7 | **S12** Chat verwirft Erinnerungen/Stimmung | Plattform-`chat_system_prompt` (Migration **und** `seed/006_prompt_templates.sql:505-536`, en+de) um `{agent_memories}` und `{agent_mood}` erweitern; `prompt_contracts.py` deklariert die Variablen für `chat_system_prompt`; Reparaturskript für Welt-Vorlagen **nicht** automatisch (Regel W6). | — |
| D8 | **S13** Verlauf älteste-zuerst | `chat_ai_service.py:1133-1138` → `desc=True` + `reverse()` wie `chat_service.py:359-382`; Kappe je Modell aus `_CONTEXT_WINDOWS` ableiten statt 200. | — |
| D9 | **S14** Bleed berechnet und verwirft | `autonomous_event_service.py:884-914`: Kandidaten über `EchoService.create_echo` als `pending` anlegen (Admin-Freigabe bleibt), oder `bleed_auto_approve` endlich lesen. Alte `pending`-Echos nach 7 Tagen verfallen lassen (Sweeper). | Auto-Freigabe ja/nein |
| D10 | **S18** Kleinkram | `zone_action_service.py:44-113` → atomare RPC (ADR-007); `WeatherSettingsPanel.ts:200-244` schreibt in `simulations.weather_lat/lon` (Endpunkt); `event_service.py:520-522` Schlüssel `heartbeat_interval_seconds`; `agent_opinion_service.py:433-448` Dedup wie `:412-421` + Insert-Pfad für Rivalen; `agent_activity_service.py:684-691` `stacking_group`; `page_size` → `limit`/`page` an vier Stellen; `stream_single_response` mit `budget=`; `fn_degrade_building` schreibt Taxonomiewert. | — |
| D11 | **S19** Public-First | `AgentAutonomyApiService.ts:137-153` + `BondsApiService.ts:60` `mode` durchreichen; öffentliche Endpunkte für Stimmung/Bedürfnisse/Bindungen in `public.py` (Lesen). Tor `lint-no-appstate-access-reads.sh` bleibt. | — |
| D12 | **S16/S17** Schwellen, Namen | `fn_compute_agent_influence`: Botschafter über `embassies.embassy_metadata->'ambassador_a_id'` (Agenten-ID speichern, Migration) statt Namen; `embassy_ambassador_quality` auf `length(character)`; Deckel `exemplary`/`ascendant`/`STRONG` neu setzen oder Labels an die erreichbaren Maxima anpassen. | Balance |
| D13 | **S20/S21** Totes | `enter_strain/recover_from_strain` verdrahten oder löschen; `resonance_operative_*_cap` als RPC-Parameter oder Settings löschen; `bleed_auto_approve`-Schalter mit D9; `components/resonance/` löschen oder rendern; `frontend` Formel-Duplikate (`AgentDetailsPanel.ts:1007`, `ZoneList.ts:369`) durch Backend-Werte ersetzen. | Bindungs-Modifikatoren §3.7 bauen? |

---

## Paket E — Dungeons

| # | Befund | Fix | Entscheidung |
|---|---|---|---|
| E1 | **D1** Bergen stürzt ab | `dungeon_movement_service.py:890`: `instance.loot` existiert nicht → Beute in `pending_loot` legen (wie Boss) oder verwerfen (E3). Test `backend/tests/…/test_dungeon_salvage.py` (heute keiner). | mit E3 |
| E2 | **D2** Abklingzeiten | Entweder: `cooldowns` in `dungeon_combat_service` je Runde dekrementieren, beim Einsatz setzen, `_validate_action` prüft — oder UI + `cooldown`-Werte aus YAML entfernen. Halb ist am schlechtesten. | ja/nein |
| E3 | **D3** Nicht-Boss-Beute verdampft | Entweder alle vier `roll_loot`-Stellen in `pending_loot` sammeln (Verteilung am Ende), oder die UI zeigt sie als „flüchtig“ (kein Verteilen). | behalten/flüchtig |
| E4 | **D5** Rückzug gratis | `fn_abandon_dungeon_run` (Migr. 164:422-455) → `PERFORM fn_apply_dungeon_outcome(…, 'retreat')` mit Moodlet „Rückzug“ und Stress bleibt. | Kosten ja/nein |
| E5 | **D6** 131 Banter-Zeilen tot | `select_banter` an den Stellen rufen, deren Trigger existieren: Kampfsieg (`dungeon_combat_service.py` nach `:320`), Rast (`dungeon_movement_service.py:924`), Beutefund, Stress ≥ Schwelle, Abschluss, Wipe, Agent gefangen, Elite gesichtet, Rast-Hinterhalt. Validator-Invariante: jeder in YAML genutzte Trigger hat einen Aufrufer (Skript `scripts/validate_content_packs.py`). | — |
| E6 | **D7** Overthrow-Fallback | `dungeon_shared.py:44-80` Eintrag für „The Overthrow“; Test: alle 8 Archetypen im Dict. | — |
| E7 | **D8** Probe ohne Agent | `dungeon_movement_service.py:446-451`: fehlender/ungültiger `agent_id` → 400, oder serverseitig den bestgeeigneten nicht gefangenen Agenten wählen; `requires_aptitude` prüfen (`:441-443`). | — |
| E8 | **D9** Resonanz bleibt offen | `create_run` schreibt `resonance_id` (`dungeon_engine_service.py:245-257`); bei Boss-Sieg `resonance_impacts.magnitude` × (1 − 0,15 × Schwierigkeit) (Spez. §5.4) und Cooldown der Verfügbarkeit (`available_dungeons`). | verbrauchen ja/nein |
| E9 | **D10** Verlauf/Protokoll ohne UI | Reiter „Läufe“ in der Lobby (`getHistory`), Ereignisprotokoll in der Nachbesprechung (`getEvents`); öffentliche Laufseiten verlinken oder Endpunkte entfernen. | — |
| E10 | **D12** Wipe-Text | Migr.-Text „Alle Agenten sind verloren“ → „Die Gruppe kehrt gezeichnet zurück“ (de/en), passend zur Wirkung. | — |
| E11 | **D13/D14** Schwierigkeit, Schaden | `enemy_power`, `stress_mult`, `loot_quality` in `dungeon_combat.py`/Beute lesen; Schaden auf 1–3 Stufen mit Schwellen 5/7 oder additiv (`combat_engine.py:168`, `condition_tracks.py:72`) — Balance messen (Sim-Skript über 100 Kämpfe). | Balance |
| E12 | **D15** Aptitudes | Schmiede schreibt `agent_aptitudes` (Forge-Bereich, Parallelsitzung) oder `DEFAULT_APTITUDE_LEVEL` auf 4 (`models/aptitude.py:30`) — dann sperren Tore. | ja |
| E13 | **D16–D19** Rest | Laufqualität → Stimmung aus Räumen/Tiefe/Zöllen; `scout` mit Abklingzeit; Ausgangsraum-Beute; `help dungeon` vollständig (`dungeon-formatters.ts:1518-1554`); grafische Ansicht mit Texteingabe oder Menü für `dive`/`help`; `DungeonEnemyPanel` rendern; `protocol` ins Tier-Dict; `available_dungeons` `security_invoker`; README „exactly 1“ → „≥ 1“; Validator-Mindestzahlen. | — |

---

## Paket F — DRIFT

| # | Befund | Fix | Entscheidung |
|---|---|---|---|
| F1 | **R1** Spielkern-UI bei geschlossenem Gate | `/public/drift/state` liefert `fun_core_enabled` (`drift_service.py:124`, `models/drift.py:423`); `DriftView.ts:1716-1731` rendert Markerstapel/Ledger nur bei offenem Gate; `fn_travel_complete` Gate-aus-Zweig zahlt Basis-Siegel. **Oder** das Gate öffnen (`drift_fun_core_enabled=true`, Prod-Setting) — dann F4/F5 vorher. | öffnen/verbergen |
| F2 | **R2** Route ohne Gate | `app-shell.ts:639-651`: Route nur registrieren, wenn `drift_p0_enabled` (Zustand aus `/public/drift/state`, wie `SimulationNav.ts:50`). | — |
| F3 | **R3** Mitgliedschaft | `routers/drift.py:193-202`: `require_simulation_member("viewer")` auf `anchor_simulation_id` (Entscheidung §22.2); `fn_travel_run_open` prüft `simulation_members` in der Transaktion. | ja |
| F4 | **R4** Lauf-Heimat ≠ Profil-Anker | `fn_travel_run_open`: Anker des Profils als Heimat verwenden **oder** Profil-Anker beim Öffnen auf die Routenwelt setzen (eine Wahrheit); `DriftView.ts:1288-1293` entsprechend. | per-Nutzer oder per-Welt? |
| F5 | **R5/R6** Graben, DZ-Skala | `fn_sondieren` (Migr. 268:123-153): nur an `mid`/`deep` oder nicht am Heimatknoten; `drift_tuning`: `dz_kh_bleed.threshold` 8→16, Bänder ≤14/≤28, `dz_divisor` 20 (Migration, Seed spiegeln). | Zahlen |
| F6 | **R7–R9** Blinde Karte | Kantenkosten vor dem Zug zeigen (`DriftChartEdge.weight` → Hover/Chip); `interstitial`-Ring aus (`gameGraph.ts:23-32`); `affinities` schreiben (z. B. je Lieferung +1 auf den Vektor) oder Prüfvektor entfernen. Nebel (`traveler_discoveries` serverseitig filtern) ist W3-Umfang. | — |
| F7 | **R10/R11** Angebote, Gastfreundschaft, Sprache | Angebot mit Lohn/Distanz/Gastfreundschaft im DTO (`types/drift.ts:394-403`); `drift_hospitality` schreibbar (Settings-Panel, Standard `nur_echos` beim Schmieden); Effekte in `title_en/title_de`, `content/content_de` schreiben (Migr. 255:141-189). | Standardwert |
| F8 | **R12/R13** Bedienung, Betrieb | Tastaturpfad auf der Tafel oder `ChartAccessibilityList` bauen; Rückzug mit Bestätigung + Preis; `overstay` anzeigen; Admin-Reiter mit Gates + `regenerate` + Notrückruf. | — |

---

## Paket G — Oberfläche

| # | Befund | Fix |
|---|---|---|
| G1 | **U** Profilseite ruft `PUT /users/me` und `GET /users/me/memberships`, beide fehlen | Backend: `PATCH /users/me` (Anzeigename, Locale) in `routers/users.py` + `user_profile_service`; Mitgliedschaften aus `/users/me/dashboard` beziehen (existiert) oder Endpunkt ergänzen; `UsersApiService.ts:9-14` angleichen; `UserProfileView.ts:270,293`. Link „Profil“ in `UserMenu.ts`. |
| G2 | Pulse zeigt `narrative_en` | `SimulationPulse.ts:1255`: Locale-abhängig `narrative_de`/`narrative_en` (Hilfsfunktion, die es für andere Entitäten schon gibt — suchen, nicht neu bauen); `{direction}` in `heartbeat_service.py:1043-1049` übersetzen („vertieft sich“/„heilt“). |
| G3 | Epochen-Kommandozentrale | „Aktive Ops“ nur Epochen mit Frist in der Zukunft oder Aktivität < 14 Tage; Lobby-Karte: Beitritts-Liste als Dropdown statt 16 Knöpfe; Gründungs-Karten mit Inhalt (nächste Frist, Teilnehmer) statt Leerraum. Sieben stehende März-Epochen: **Entscheidung** archivieren (Prod-Write). |
| G4 | `/data-deletion` unverlinkt | `PlatformFooter.ts:93-120` Link neben Privacy/Terms. |
| G8 | `simulations.name_de` plattformweit leer (41/41) | Schreibpfad in der Schmiede (Übersetzung des Titels wie `description_de`, `forge_entity_translation_service`) + Anzeige nach Locale; Slug bleibt englisch. Bestand: Reparaturskript nach dem Muster `repair_simulation_prompt_templates.py`, **nicht automatisch**, Liste zur Entscheidung. |
| G5 | Hilfe-Landung „12 Themen“ | `HowToPlayLanding.ts:404`, `HowToPlayGuideHub.ts:551,716`: aus `TOPICS.length` ableiten. |
| G6 | Journal-Versprechen | Leerzustand je nach `journal_enabled` (aus `/public/alpha-state`-Muster einen Plattformzustand liefern): „sammelt sich“ nur, wenn der Generator läuft. |
| G7 | Tote Clients | `SocialMediaApiService`, `CampaignsApiService`, die 114 unaufgerufenen Methoden: löschen oder verdrahten — Liste in `endpoint-ui-xref-2026-08-30.md`, Anhang. Ein Tor `frontend/scripts/lint-no-uncalled-api-methods.sh` (AST) verhindert Rückfall. |

---

## Paket H — Hilfe und Onboarding

| # | Befund | Fix | Entscheidung |
|---|---|---|---|
| H1 | Fehlende Themen | `commendations` (35 Abzeichen, wie man sie erwirbt), `journal` (Fragmente, Konstellationen, Attunements), Epochen-Abschnitt „Frist, Passen, AFK, KI-Übernahme“, DRIFT-Messgrößen als Tooltips (`DriftView.ts:1834-1843` `_stat()` mit `title`/Blase). | Auszeichnungs-Thema gewollt? |
| H2 | 125 englische Zeilen im Deutschen | XLIFF-Pass über die Kartenbeschreibungen/TL;DR von 13 Themen (`de.xlf`), literarisch, kein DeepL-Rohtext; Alpha-Suite zweisprachig (8 Zeichenketten). | Deutsch-Politik |
| H3 | Veraltete Zahlen | Terminal: 32 Befehle, Stufen 11/5, Stufe 4 = Epochenmodus, vier nicht existente Befehle streichen (`htp-topic-data.ts:974-985`, `htp-content-features.ts:1055-1122`); `terminal-formatters.ts:511` „future“ entfernen; Epochen „keine Wartezeit“ → `min_cycle_minutes` (`htp-content-features.ts:1018`); Dungeon „6 Schulen“ → 7, Mindestgruppe 2, `help dungeon` vollständig. | — |
| H4 | Einstiege | `?`-Eintrag in `SimulationNav.ts` (Thema je Reiter), Hilfe-Link in `LandingPage.ts`/`PlatformFooter.ts`, Assistent (`OnboardingWizard`) verlinkt `/how-to-play`, „Onboarding erneut“ im Profil. | Hilfe in der Bureau-Schale gewollt? |
| H5 | Suche | `htp-search.ts:53-96` indiziert Fließtext und Schritte (heute ~10 %). | — |
| H6 | Kriegsraum | Changelog seit 08.03. nachziehen; Analytik als „gemessen bei v2.1“ kennzeichnen oder neu rechnen. | — |
| H7 | Neun Kennzahlen | Blase mit Was/Warum/Was-tun an `SimulationHealthView.ts:1146-1196`, `ZoneList.ts:443-464`, `BuildingDetailsPanel.ts:555-640`, `AgentDetailsPanel.ts:1085-1125`; Einfluss-Stufensymbol auf `AgentCard.ts`. | Blase oder Aufschlüsselung? |

---

## Paket I — Epochen-Klon (§2.6)

- `clone_simulations_for_epoch` (aktuelle Fassung Migr. 060, Prod 19,8 KB): `drafted_agent_ids` wieder lesen (`WHERE id = ANY(drafted) ORDER BY … LIMIT 6`, Rückfall auf `created_at`), `agent_aptitudes` mitklonen, `fn_initialize_agent_autonomy` je Klon (A3). Eine Migration `…_28x_clone_restores_draft_and_aptitudes.sql` mit `CREATE OR REPLACE` des **vollständigen** Funktionskörpers (Muster: Prod-Körper per `pg_get_functiondef` ziehen, ändern, nie aus einer alten Migration kopieren).
- Prüfung: Integrationstest: Epoche mit Draft → Klon enthält genau die gedrafteten Agenten mit ihren Aptitude-Zeilen. Prod nach Migration: `position('drafted_agent_ids' in pg_get_functiondef(...)) > 0`.
- **Entscheidung I1:** War der Verlust Absicht (Fairness)? Wenn ja: Draft-UI entfernen statt Klon ändern.

---

## Entscheidungen des Nutzers (gesammelt)

| Nr | Frage | Empfehlung |
|---|---|---|
| ~~A3~~ | ~~Backfill der 42 Agenten mit Standardwerten?~~ — vom Nutzer freigegeben, Parallelsitzung baut (286) | erledigt |
| B7 | Epochen-Post an Spieler (Teilnehmer) statt Welt-Eigentümer? | ja, nur Spieler |
| B8 | Akademie ohne Zyklus-Mails? | ja (nur Abschluss) |
| C1 | Autonome Events über Vorlagenpfad ohne Schlüssel (Kosten 0)? | ja |
| C2 | Journal einschalten (ein Modellaufruf je Fragment)? | ja, mit Tagesbudget |
| D1/D4/D6 | Formeln für Bureau-Antwort, Attunement-UI, Katharsis je Agent | wie oben |
| D9 | Bleed automatisch (pending) oder Handarbeit? | automatisch pending, Admin gibt frei |
| E2/E3/E4/E8 | Abklingzeiten durchsetzen · Nicht-Boss-Beute behalten · Rückzug bepreisen · Resonanz verbrauchen | ja · behalten · ja · ja |
| E11/E12 | Schadensstufen, Schwierigkeitsfaktoren, Aptitudes aus der Schmiede | messen, dann setzen |
| F1 | DRIFT-Spielkern öffnen (nach F3–F5) oder UI verbergen? | erst verbergen (Tag 1), öffnen nach F5 |
| F3/F4 | Mitgliedschaft am Anker · Lauf-Heimat = Profil-Anker | ja · per-Welt, Profil folgt der Route |
| F7 | `drift_hospitality`-Standard beim Schmieden | `nur_echos` |
| G3 | Sieben März-Epochen archivieren? | ja |
| H1/H2/H4 | Auszeichnungs-Thema · Deutsch-Politik · Hilfe in der Schale | ja · nachziehen · ja (`?`) |
| I1 | Draft + Aptitudes im Klon wiederherstellen? | ja |

| N5 | **Vier von fünf Auslösern autonomer Ereignisse sind unerreichbar — nicht knapp verfehlt, unerreichbar.** Nachgemessen auf Prod am 31.08.2026, NACH dem Deploy von C1: die Phase läuft nachweislich (`autonomous_events_llm_budget` steht in jeder Zusammenfassung), erzeugt aber auf jeder Welt 0 Ereignisse. Grund: `stress_breakdown` verlangt `stress_level >= 800`, und alle 258 Agenten stehen auf **exakt 0** — `fn_update_stress_levels` erhöht Stress ausschließlich bei `mood_score < -20`, während die schlechteste je gemessene Laune **−1** ist (`mood_score` = Summe der Moodlets, deren Stärken von **−1 bis +5** reichen). `relationship_threshold` verlangt ±60, erreicht werden 45. `zone_crisis_reaction` verlangt `safety < 20`, das Minimum ist 22,0. Die Schwellen liegen etwa eine Größenordnung über dem Wertebereich, den das System selbst erzeugt. | **Balance-Entscheidung des Nutzers.** Vollständige Messung in `docs/analysis/warum-keine-events-2026-08-31.md`. Zwei Wege: Schwellen an die erreichbaren Maxima anpassen (billig) oder die Moodlet-Stärken vergrößern (ehrlicher, teurer). Nach dem Vorbild E11 gehört ein MESSSKRIPT vor die Entscheidung, sonst wird die neue Zahl wieder eine Momentaufnahme, die wie eine Spezifikation aussieht (J7). Gehört zu **D12** und erklärt zugleich, warum **D6** (Zusammenbruch) nie auslösen konnte. |

## Messrezepte (für die Abnahme)

```bash
# Prod-SQL (Management-API). TOKEN = SUPABASE_MCP_TOKEN aus .env
python3 -c "import json,sys;print(json.dumps({'query':sys.stdin.read()}))" <<'SQL' | curl -sS -X POST "https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @-
select slug, last_heartbeat_tick, last_heartbeat_at from simulations where slug in ('velgarien','the-m-bius-academy');
SQL
```

- Stall: siehe oben; Erwartung nach A2: Velgarien 47 → 48 binnen 4 h. Vollbild der Fälligkeit (mit Status — archivierte Welten sind korrekt ausgeschlossen):
  ```sql
  SELECT s.slug, s.status, s.last_heartbeat_tick AS zeiger, s.next_heartbeat_at,
         (SELECT max(tick_number) FROM simulation_heartbeats h WHERE h.simulation_id=s.id AND h.status='completed') AS letzte_fertige,
         (SELECT count(*) FROM simulation_heartbeats h WHERE h.simulation_id=s.id AND h.status='processing') AS haengende
  FROM simulations s WHERE s.next_heartbeat_at IS NOT NULL AND s.next_heartbeat_at <= now() ORDER BY s.status, s.slug;
  ```
  Erwartung nach A2: nur noch `archived`-Zeilen in dieser Liste (bis Aufräumpunkt 1 greift).
- Autonomie-Zeilen: `select count(*) from agents a left join agent_mood m on m.agent_id=a.id where m.agent_id is null` → 0.
- CHECK: `select pg_get_constraintdef(oid) from pg_constraint where conname='heartbeat_entries_entry_type_check'` enthält `bond_whisper`.
- Realtime: `select tablename from pg_publication_tables where pubname='supabase_realtime'` → `ai_usage_log, events, forge_access_requests, user_achievements`.
- Events leben: `select count(*) from events where created_at > now() - interval '1 day'`.
- Mail: `select * from email_deliveries order by created_at desc limit 5` (nach B15).
- Prod-Log: `ssh root@45.137.68.227 "docker logs --since 30m \$(docker ps --format '{{.Names}}' | grep a6exg | head -1)" | grep -iE "heartbeat|email|error"`.

---

## Paket J — Testhygiene (nachgetragen 31.08.2026)

Aufgefallen im Parallelbetrieb beider Sitzungen; gehört in keines der Pakete
A–I und kostet beide Sitzungen CI-Läufe.

| # | Befund | Was zu tun ist |
|---|---|---|
| J1 | ✅ **ERLEDIGT 31.08. — und die Diagnose im Befund war falsch.** Es war KEINE Zustandsverschmutzung: die Vorrichtung `home_neighbor` nahm die erste Zeile einer Abfrage **ohne `ORDER BY`**. Gemessen: `home-velgarien` hat vier Nachbarn (drei `mid`, einer `near`), und `survey_value_by_band` ist `{near: 0, mid: 2, deep: 3}`. Daraus folgen BEIDE Symptome mit einer Ursache — bei `near` übersprang sich `test_travel_signals` selbst (4 Skips, Havarie grün), bei `mid` lief Signals und der teurere Hinweg strandete den Havarie-Lauf schon vor der eigentlichen Prüfung (3 Skips, Havarie rot). Der Fehlschlag und die schwankende Skip-Zahl waren dieselbe Münze. | `_home_neighbors` sortiert zweistufig (Band, dann Kennung); `home_neighbor` liefert den nächstgelegenen, `home_neighbor_surveyable` den ersten zahlenden. Der `pytest.skip` im Signaltest ist durch ein `assert` ersetzt. **Vier Volläufe ohne Fehlschlag** (vorher jeder dritte rot). Rest: die Skip-Zahl pendelt weiter 2↔3 wegen `"no interactive signal in this deck within 14 Takte"` — die Signalziehung, andere Baustelle, an die Parallelsitzung gemeldet. |
| J2 | **Der halbfertige Stand des jeweils anderen sieht genauso aus.** Vier Mal an einem Abend hat die Parallelsitzung im Gesamtlauf Rot gesehen, das ein Zwischenstand der anderen Sitzung im GETEILTEN Arbeitsbaum war (`TestGetUserMemberships`, `test_filters_out_bots`, zwei `_resolve_langs`-`F821`). Es ist keine Verschmutzung und heilt sich von selbst. | **Unterscheidung dokumentieren**, sonst sucht später jemand eine Verschmutzung, wo nur zwei Sitzungen im selben Baum arbeiteten. Vor einem Gesamtlauf `git status` lesen. |
| J3 | **Zusicherung auf den Abschnitt, nicht auf die Datei.** Sechs Fälle an einem Abend, in beiden Sitzungen: grep-Fenster über sechs Zeilen; AST am falschen Stellungsargument (fand NULL Stellen und war grün); „Zeichenkette irgendwo in der Datei" (kam fünfmal vor); ein Test gegen die ganze Migrationsdatei, deren Kopfkommentar den alten Satz absichtlich zitiert; `"24" in html` statt des ganzen Satzes. | Als Regel in die Prüfpraxis: eine Zusicherung liest den gemeinten ABSCHNITT heraus. Und: **jedes Tor, das Aufrufstellen scannt, braucht einen Test, der rot wird, wenn der Scan nichts findet** — die Erfolgsmeldung muss die Zahl der geprüften Stellen nennen. Vorbild: `TestTheGateItself` in `test_model_call_errors.py`. |
| J3b | **Und nicht auf den Kommentar, der den Befund erklärt.** Die schärfste Variante, gefunden beim Bau von `lint-dungeon-verbs-gated.sh`: die Hilfe-Prüfung blieb GRÜN, als `rally` testweise aus der Hilfe entfernt wurde — weil der Erklärkommentar im selben Block die gesuchten Wörter enthält. Das Tor las seine eigene Begründung statt der Sache. Und das ist kein Zufall: der Kommentar, der einen Defekt erklärt, nennt naturgemäß genau die Wörter, nach denen das Tor sucht. **Die Erklärung eines Defekts sieht für einen Textscan aus wie seine Abwesenheit.** | **Der Ausweg ist NICHT, sparsamer zu kommentieren, sondern den Prüfbereich vor dem Vergleich zu bereinigen** — Kommentare raus, dann suchen. Ein Tor, das Text durchsucht, muss vorher sagen, was für es Text IST. Diese Richtung gehört ausdrücklich dazu: ohne sie liest sich der Befund als Grund, dünner zu dokumentieren, und das wäre die schlechteste denkbare Folge eines Befundes über gute Dokumentation. So gelöst in `lint-dungeon-verbs-gated.sh`. Und: J3 ist ein Handwerksfehler, den man einmal macht und dann kennt — **J3b skaliert mit der Sorgfalt und wird schlimmer, je besser man arbeitet.** |
| J3c | **Der Filter der Messung ist selbst eine Annahme — und ein zu ENGER Filter ist der gefährlichere.** Belegt: eine Abfrage nach Richtlinien filterte auf `polcmd = 'r'`, also nur SELECT. Eine `ALL`-Richtlinie trägt `'*'` und war darin unsichtbar — zweimal aus derselben Zeile (`instagram_posts`, `user_wallets`). Die Abfrage hat korrekt gemessen, was gefragt war; gefragt war nur nicht, was man wissen wollte. Der Unterschied zu J3: **ein zu weites Fenster sieht man am Rauschen, ein zu enges an gar nichts** — das Ergebnis ist sauber, kurz und falsch. Erschwerend: ein LEERES Ergebnis ist ein Alarm und wird verdächtigt (viermal an einem Abend geschehen); ein plausibles, zu kurzes Ergebnis wird geglaubt. | Die Gegenprobe braucht eine **ANDERE Frage**, nicht dieselbe Frage sorgfältiger: „zeig mir ALLE Richtlinien dieser Tabelle" statt „zeig mir die SELECT-Richtlinien". Erst die andere Frage machte beide Fundstellen sichtbar. |

| J4 | **Eine Reparatur, die eine Zeile ANLEGT, entscheidet zugleich, was nie mehr hineingeschrieben wird** — sobald das Anlegen ein `ON CONFLICT DO NOTHING` trägt. Belegt von der Parallelsitzung an `fn_initialize_agent_autonomy`: A3/Migration 286 legt die Autonomiezeilen beim Materialisieren an (richtig und nötig), aber mit den Signaturvorgaben — ein späterer Aufruf mit echten Werten tut danach **nichts**. Gemessen: 258 `agent_mood`-Zeilen, `count(distinct resilience) = 1`. Jeder Agent jeder Welt ist verhaltensgleich. | Prüffrage bei jedem Backfill und jedem Initialisierer: **kann die richtige Antwort später noch ankommen, wenn sie erst später bekannt ist?** Anlegen und Einstellen gehören getrennt (Migration 296: `fn_apply_agent_autonomy_params`). Wo die richtige Antwort schon beim Anlegen bekannt ist — etwa beim Klonen —, gehört sie dorthin (Migration 295). |
| J5 | **Ein Test, der MEISTENS besteht, ist schlimmer als einer, der fehlschlägt.** Ein Fehlschlag wird untersucht; ein Wackler wird wiederholt, bis er grün ist, und verbraucht dabei das Vertrauen in alle anderen. Zwei Fälle an einem Tag, aus verschiedenen Richtungen: ein selbstgebauter Wackler (`roll_loot` ohne fixierten Zufall, bestand ~7 von 10 Läufen) und eine würfelnde Vorrichtung (J1). | Nach dem Fund **alle Tests derselben Bauart per AST prüfen**, nicht nur den aufgefallenen. Und: eine Vorrichtung, die zwei unvereinbare Zwecke bedient, löst den Konflikt per Zufall auf — im Protokoll sieht das exakt aus wie Verschmutzung. Der Unterschied ist an den MITBEWEGTEN Größen messbar (bei J1: die schwankende Skip-Zahl, die die ganze Zeit im Befund stand, als harmlose Nebenbeobachtung). |
| J6 | **Ein Schalter, der nichts tut, ist schlechter als kein Schalter** — er lädt dazu ein zu glauben, eine Wahl sei getroffen worden. Belegt am `--target production` eines Rückfüllskripts: es nahm den Wert entgegen und rief danach trotzdem `get_admin_supabase()`, auf einer Entwicklermaschine also die lokale Instanz. Aufgefallen erst beim ersten echten Prod-Lauf — der einzigen Gelegenheit, bei der es hätte auffallen können. | Dieselbe Bauart wie eine Anzeige ohne Erzeuger, nur auf der EINGABEseite: die Attrappe sitzt am Bedienelement. Rezept: das aufgelöste Ziel **samt Adresse drucken**, bevor geschrieben wird, und `--apply` ohne ausdrückliches Ziel mit Exit-Code 2 verweigern. |
| J7 | **Balance-Zahlen gehören in ein Messskript, nicht in eine Gleichheitszusicherung.** Ein Test nagelte `enemy_condition == 1.0` fest; damit wird jede gemessene Nachjustierung zur Teständerung, und eine Momentaufnahme sieht aus wie eine Spezifikation. | Stattdessen die EIGENSCHAFT prüfen (monoton, keine zwei gleichen Stufen) und die Zahlen aus einem Messlauf beziehen. |

---

## Nachgetragene Befunde (31.08.2026)

Beide von der Parallelsitzung gemessen, in keinem Abschnitt des Prüfberichts
geführt, und beide von der Bauart „die Funktion ist da, der Aufrufer fehlt".

| # | Befund | Gehört zu |
|---|---|---|
| N1 | **Alle 258 `agents.personality_profile` auf Prod sind `{}`** — ausnahmslos. `PersonalityExtractionService` hat NULL Aufrufer im Backend und in `scripts/`; die einzige schreibende Stelle (`:175`) wird nie erreicht. Folge: jeder Big-Five-Verbraucher liest `{}` und fällt auf neutral zurück — die Persönlichkeitsmodifikatoren aller Fertigkeitsproben, die Stressverstärkung über Neurotizismus (`stress_system.py:34-53`), der `personality_filter` der Banter-Auswahl, `agent_activity_service.py:327`. **Das Wesen der Agenten hat in der laufenden Welt an keiner Stelle eine Wirkung.** Dieselbe Bauart wie A3 (`fn_initialize_agent_autonomy`) — und derselbe Dienst. | **Paket D** (dort sitzen die meisten Verbraucher) |
| N2 | **`OpenRouterService.generate*` ohne umschließenden `try` an zwei Stellen, die keine Sitzung hält:** `chat_ai_service.py:219` und `generation_service.py:1219`. Das erweiterte Tor (B11) sieht sie nicht — es prüft, ob ein VORHANDENER Handler blind ist, und verlangt keinen. Von Hand zu entscheiden, ob sie zu Recht durchreichen. | **Paket C/D** |
| N3 | **Elf Sichten in `public`, keine einzige mit `security_invoker` — drei davon geben heraus, was ihre Basistabelle `anon` verweigert.** Nachgemessen (nicht übernommen) auf Prod am 31.08.: als Rolle `anon` liefert `instagram_posts` **0** Zeilen, die Sicht `v_instagram_queue` **13**; `bluesky_posts` **0**, `v_bluesky_queue` **2**. Beide Sichten führen `unlock_code` — den Cipher-ARG-Code je Beitrag — zusammen mit Bildtexten, Hashtags, Bild-URLs und Terminplanung UNVERÖFFENTLICHTER Beiträge. Wer die Codes vor der Veröffentlichung liest, löst das ARG, ohne es zu spielen: die Mechanik ist nicht kaputt, sie ist umgehbar. Dritte Sicht: `token_economy_stats` (Gesamtumsatz in Cent, Tokens im Umlauf, Zahl der Käufer — Geschäftszahlen, keine Personendaten). **Vierte, in der Meldung der Parallelsitzung nicht enthalten:** `active_agents` gibt `anon` **258** Zeilen, die Basistabelle **228**. Der Mechanismus ist nachgemessen und schärfer als „umgeht RLS": die Richtlinie `agents_anon_select` prüft DREI Bedingungen — `agents.deleted_at IS NULL` **und** `simulations.status = 'active'` **und** `simulations.deleted_at IS NULL`. Die Sichtdefinition lautet schlicht `WHERE deleted_at IS NULL`, prüft also nur die erste und lässt beide weltbezogenen fallen. **Die Sicht behält ein Drittel der Regel.** Eigene Fehlerklasse, benannt von der Parallelsitzung: nicht *keine* Prüfung, sondern eine **Teilkopie** einer Prüfung, die mit dem Original auseinandergelaufen ist. Wer die Sichtdefinition liest, sieht `WHERE deleted_at IS NULL` und hält sie für die Regel. Und: jede künftige Sicht auf `agents` erbt denselben Fehler, solange die Ursache steht. Die 30 zusätzlichen Zeilen sind die je 6 Agenten der fünf Vorlagenwelten, die am 9./10. April SOFT-GELÖSCHT wurden (`deleted_at` gesetzt, `status='archived'`) — die Archivierung ist auf der Schreibseite also vollständig, der Defekt liegt ganz auf der Leseseite: **das Weichlöschen einer Welt löscht ihre Agenten nicht mit, und `active_agents` fragt nur den Agenten.** ⚠ **Zur Genauigkeit:** die Meldung sagte „`instagram_posts` hat KEINE SELECT-Richtlinie". Es gibt eine (`ig_posts_admin_all`, `ALL`, `is_platform_admin()`); sie greift für `anon` nur nie. Substanz unverändert, Formulierung berichtigt. | **Migration 294** (Parallelsitzung, gebaut, NICHT auf Prod) entzieht die Rechte und setzt `security_invoker`. Alle drei werden im Betrieb nur über den service_role-Client hinter `require_platform_admin()` gelesen — der Entzug kann keinen Aufrufer treffen. `active_agents` gehört gesondert entschieden: dort wäre es eine Verhaltensänderung an einer öffentlichen Lesefläche. **Braucht das Wort des Nutzers.** |
| N4 | **Methodische Lehre aus einem Beinahe-Fehlalarm der Parallelsitzung:** „Sicht umgeht RLS" ist **noch kein Befund**. Erst der Vergleich mit der Richtlinie der Basistabelle entscheidet, ob die Sicht mehr herausgibt als ohnehin offen steht. Bei acht von elf lautete die Antwort „nein" — `conversation_summaries` stand kurz vor einer lauten Falschmeldung, bis die Richtlinie `conversations_anon_select` gelesen war, die `anon` die Unterhaltungen aktiver Welten ausdrücklich erlaubt. | Gehört zu **Paket J** als Prüfregel: zwei Messungen, nicht eine — die Sicht UND die Basistabelle, beide unter derselben Rolle. |

