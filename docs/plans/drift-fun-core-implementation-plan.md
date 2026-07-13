# DRIFT Fun-Kern — Implementierungsplan (P0.5)

**Plan v1.0 — 2026-07-12** · Status: BEREIT ZUR UMSETZUNG (kein Schritt begonnen)
Kontrakt-Quelle: `docs/concepts/drift-gameplay-redesign-concept.md` (v0.1 — Diagnose D1–D8, Mechanik-Pakete M1–M9, Zahlenwerk v2, KPIs F1–F6).
Langfrist-Kontrakte bleiben gültig: `docs/concepts/drift-zwischenraum-travel-game-concept.md` (v0.4), `docs/plans/drift-implementation-plan.md` (v1.1).

**Resume-Protokoll: §12 (ganz unten).** Nach jedem abgeschlossenen Schritt wird das Fortschritts-Ledger (§11) in DIESEM Dokument aktualisiert (Checkbox + Commit-Hash + Datum) und das Memory `drift-fun-core-implementation-ledger` fortgeschrieben.

---

## 1. Ist-Stand-Anker (verifiziert 2026-07-12)

- **Migrationen:** 273 Dateien, höchste Nummer **263** → dieser Plan vergibt **264–272** (indikativ; bei Kollision zur Implementierungszeit fortlaufend neu nummerieren, Zeitstempel-Präfix wie üblich).
- **Backend:** `backend/services/drift_service.py` (535 Z., Gate-Helper `assert_p0_enabled`, `_P0_GATE_KEY="drift_p0_enabled"` :55), `backend/services/travel/chart_generator.py` (seeded Generator), Router `backend/routers/drift.py` (`/api/v1/drift`), Modelle `backend/models/drift.py`. Pack-Pipeline: `backend/services/content_packs/{travel_schema,travel_loader,travel_row_builders,generate_drift_migration}.py`.
- **RPC-Familie (P0):** `fn_travel_run_open` (246), `fn_travel_move` (zuletzt 255:326), `fn_quest_accept`/`fn_quest_advance` (249), `fn_travel_complete` (256), `fn_travel_abandon` (250), `fn_survey_deliver` (253), Effekt-Kern `fn_apply_drift_effects`/`fn_drift_scatter_cargo` (255), Kill-Switch `fn_drift_emergency_return` (246:553). Tuning-Tabelle `drift_tuning` (246) mit Helper `drift_tuning_value()`.
- **Frontend:** `frontend/src/components/drift/` — `DriftView.ts` (918 Z., HUD + Aktionen + Toasts), `DriftChartHost.ts` (Three.js-Light-DOM-Host), `DriftDockPanel.ts`, `drift-chart.css`, `chart/{generate,types}.ts`, `scene/{background,broadcasts,corridors,gameGraph,nodes,particles}.ts`, `post/composer.ts`, `controls/`, `palette.ts` (CSS-Var→Uniform-Bridge, `--drift-freq-0..6`).
- **Content:** `content/drift/quests/deliver.yaml` → generierte Seed-Migration 254. CI: `validate_content_packs.py --domain drift --strict`.
- **Bekannte Live-Abweichung:** prod-`drift_tuning` wurde von Hand getunt (Fenster 8, BB 8 statt Code-Seed 6/6). Migration 272 (Tuning v2) überschreibt das kontrolliert — im PR-Text erwähnen.
- **Kritische P0-Lücken, die dieser Plan schließt:** keine Reward-Writes (`vp`/`siegel`/`clearance_rank`/… werden NIRGENDS geschrieben), Depeschen zahlen nichts, ein einziger Zufall (Deep-Surge 40 %), Hospitality-Filterung unsichtbar (Toast zählt nur, `DriftView.ts:477`), Kollaps = Snap ohne Content, Frequenz-System inert, kein Storylet-Panel.

**Nicht-Ziele dieses Plans** (bleiben P1+/P3 der bestehenden Roadmap): Helm-Modus, 7-Vektoren-Vollausbau, Wetter/Stürme, Konvoi/Mitfahrt/Rettung, Spuren-Moderation, Presence.

---

## 2. Architektur-Regeln (bindend, aus CLAUDE.md + Präzedenz)

1. **Alle Zustandsmutationen = atomare Postgres-RPCs mit CAS** (`run_version`-Optimistic-Lock wie P0; ADR-007). Kein fetch-compute-update in Python.
2. **SECURITY-DEFINER-Grant-Klassen wie P0:** Player-RPCs mit `auth.uid()`-Guard; Effekt-/System-RPCs backend-only (`service_role`), explizite REVOKEs von `anon`+`authenticated` (ADR-006, Lint `lint-no-secdef-public-grant.sh` beachten).
3. **Alles Zahlenwerk in `drift_tuning`** (neue Keys per Migration, nie hardcoded); alles Erzähl-/Skelett-Content in `content/drift/**` über die Pack-Pipeline (Lint `lint-no-content-in-python.sh`).
4. **Gate:** neuer platform_settings-Key **`drift_fun_core_enabled`** (jsonb `false` seed, fail-closed via `parse_setting_bool`), Service-Helper `assert_fun_core_enabled` analog `assert_p0_enabled`; zusätzlich SQL-seitige Prüfung in jedem NEUEN Player-RPC (gleicher Mechanismus wie der P0-Gate-Check). Gate-off = P0-Verhalten unverändert. Ein Flip, ein Rollback.
5. **Responses:** typed Pydantic (`SuccessResponse[T]`), Modelle in `backend/models/drift.py`; Audit in-Transaktion via `travel_audit()`; Sentry-Tags auf jedem Fehlerpfad.
6. **Frontend:** VOR jeder Komponenten-Arbeit `velg-frontend-design`-Skill aufrufen. Design-Tokens (3-Tier, kein Roh-Hex), `msg()`-i18n (en-Dashes!), Error-Observability (`captureError`), kein `as unknown as T`. Nach JEDEM Schritt `npm run lint:full` + `ruff` grün.
7. **Determinismus:** Jeder Zufall wird serverseitig aus `hashtext(run_id || ':' || node_stable_key || ':' || takt)` (bzw. `setseed`-Äquivalent) gezogen — replayfähig, testbar, kein Client-Zufall.
8. **Jeder Schritt endet mit:** Integrationstests grün (`.venv/bin/python -m pytest backend/tests/integration/test_travel_*.py`), Browser-E2E-Verifikation lokal (Muster siehe §10), Ledger-Update (§11), Commit mit ausführlicher Message.

---

## 3. WELLE 1 — „Es zahlt sich aus" (M4-Kern, M6, M3-Havarie)

Branch: `feat/drift-fun-core-w1`. Ziel-Abnahme: *Ein Playtester kann nach drei Runs sagen, was er verdient hat, was es ihm gebracht hat und wo seine Lieferung in der Welt sichtbar ist.*

### Schritt 1.1 — Migration 264 `travel_economy_activation` (Backend-Fundament)

- **Neue `drift_tuning`-Keys:** `reward_dispatch_tier1` `{"siegel_min":8,"siegel_max":12,"vp":10}` · `reward_survey_vp_per_haul` `1` · `reward_survey_siegel_ratio` `0.5` · `reward_erstvermessung` `{"siegel":40,"vp":25}` · `clearance_thresholds` `{"feldkartograph":100}` · `clearance_exam_fee` `{"feldkartograph":25}` · Gate-Seed `drift_fun_core_enabled=false` in platform_settings (INSERT … ON CONFLICT DO NOTHING).
- **`fn_quest_advance` (CREATE OR REPLACE, 249er-Body als Basis):** Bei erfolgreichem Abschluss deterministischer Siegel-Roll (Seed §2.7) in `[siegel_min,siegel_max]` + VP-Gutschrift auf `traveler_profiles` (CAS auf `updated_at`/Version); Rückgabe erweitert um `{siegel_earned, vp_earned, lifetime_siegel, lifetime_vp}`.
- **`fn_travel_complete`:** Haul → VP (1:1) + Siegel (`ratio`); Erstvermessungs-Bonus je gewonnenem Honor; schreibt alles in EINEM Statement-Satz; Response um Einnahmen-Block erweitert.
- **`fn_travel_move`/Kollaps-Pfade:** `zerfaserung_count` inkrementieren (endlich).
- **Neu `fn_clearance_exam(p_run_version …)`** (player-class): prüft VP ≥ Threshold + Siegel-Gebühr, setzt `clearance_rank='feldkartograph'`, schreibt Audit. (Die Prüfung wird in W2 als Storylet inszeniert; W1 exponiert sie als schlichten Bureau-Button — Mechanik zuerst.)
- **Tests** (`test_travel_economy.py`, neu): Ablieferung zahlt (deterministisch mit fixem Seed), Complete bucht Haul→VP/Siegel, Erstvermessungs-Bonus einmalig, Exam-Gate (VP zu niedrig → P0001), Gate-off → alte Responses unverändert (Regressionsnetz), `zerfaserung_count`-Inkrement.

### Schritt 1.2 — Backend-Service + Router + Modelle

- `drift_service.py`: `assert_fun_core_enabled`; Payout-Felder durch `get_state`/`complete_run`/`advance_quest` durchreichen; **ehrliche Effekt-Aufschlüsselung**: die `applied`/`skipped`-Listen aus `fn_apply_drift_effects` (existieren bereits in der RPC-Response!) werden erstmals vollständig ans Frontend gereicht statt nur gezählt — inkl. `skip_reason` (`hospitality_nur_echos` …) und Ziel-Referenzen (`event_id`, `agent_id`, `simulation_slug`).
- `models/drift.py`: `EarningsBlock`, `EffectCard` (kind, target_label, target_link_ref, applied|filtered, reason), `ProfileEconomy` (siegel, vp, rank, next_rank_progress). Endpoint-Erweiterungen: `GET /drift/profile` (neu, member) für das HUD-Konto.
- **Tests:** Router-Response-Shape (typed), Effekt-Karten-Mapping inkl. Filter-Grund.

### Schritt 1.3 — Migration 265 `travel_havarie` (M3: Wahl statt Snap)

- **Neuer Run-Status `havarie`** (CHECK-Erweiterung auf `travel_runs.status`). `fn_travel_move`: Bei KH ≤ 0 oder Fenster-Ablauf fern von zuhause NICHT mehr auto-abandonen, sondern Status → `havarie`, Checkpoint bekommt `havarie: {cause, options}`; Options-Katalog template-fix: `notabwurf` (Spieler wählt zu opfernde Fracht-IDs; Rest bleibt; Fenster −2, Status zurück auf `active`), `notruf` (alles behalten; ungesicherter Haul ×0.5; 10-Siegel-Schuldvermerk in qualities; Status `active`, Position → nächstes Relais bzw. P0-Graph: Home), `zerfaserung` (bisheriger Scatter-Pfad via `fn_drift_scatter_cargo`, danach `abandoned`).
- **Neu `fn_travel_havarie_resolve(run_id, run_version, choice, jettison_cargo_ids[])`** (player-class, CAS, gate-checked): validiert Status `havarie`, wendet die Wahl an, audit-logged. Fenster-Ablauf-Variante: Optionen `ueberziehen` (+5 DZ/Takt-Regel aktivieren, Status `active` mit `overstay=true`) oder `rueckruf` (geordneter Abschluss: Haul bleibt, aber ×0.7 — sanfter als Zerfaserung).
- **Scheduler-Absicherung:** Havarie-Status altert aus (TTL 48 h → auto-`zerfaserung`) über den bestehenden Scheduler-Ansatzpunkt (TravelLifecycleScheduler-Vorarbeit: ein `expires_at` im Checkpoint + Prüfung in `fn_travel_move`/`get_state` reicht für P0.5 — KEIN neuer Scheduler-Prozess; Ablauf-Finalisierung lazy beim nächsten Zugriff, dokumentiert im RPC-Kommentar).
- **Tests** (`test_travel_havarie.py`): jeder Choice-Pfad, CAS-Konflikt, Gate-off → altes Snap-Verhalten, TTL-Lazy-Finalisierung, Fracht-Teilopfer-Arithmetik, kein Scatter bei `notabwurf`.

### Schritt 1.4 — Frontend W1: Konto-HUD, Wirkungskarten, Havarie-Panel, Debriefing

> `velg-frontend-design`-Skill zuerst. Neue Komponenten unter `frontend/src/components/drift/`, Bureau-Dossier-Sprache, `bureauPanelFrameStyles` LAST.

- **`DriftLedgerStrip.ts`** (im HUD): Siegel-Zähler, VP mit Rang-Fortschrittsbalken, Lifetime-Vermessung. Count-up-Ticker bei Änderung (§8-Spez M-01/M-02).
- **`DriftEffectCards.ts`**: Nach Ablieferung/Entladung ersetzt ein Karten-Stapel den bisherigen Zähl-Toast — je Wirkung eine Karte: Ikone + Zieltext + Beleg-Link (`/simulations/{slug}/events/…` bzw. Agent), gefilterte Effekte als eigene Karte „Von der Welt gefiltert — Gastfreundschaft: nur Echos" im redacted-Stil (`<velg-redacted>`-Reuse). Karten-Flip-Stagger (§8 M-03).
- **`DriftStoryletPanel.ts`** (NEU — das wiederverwendbare Szenen-Panel, Fundament für W2-Signale): Dossier-Rahmen, Titel-Eyebrow, Prosa-Block, 2–4 Options-Buttons mit Kosten-/Risiko-Chips, Resultat-Zustand. W1-Nutzer: **Havarie** (Optionen aus Checkpoint, inkl. Fracht-Auswahl-Liste bei Notabwurf) und **Bureau-Debriefing** (statischer Template-Text nach jedem Run-Ende, parametrisiert mit Run-Fakten: Haul, Einnahmen, Havarie-Ausgang, Erstvermessungen — reiner Template-Text, KEIN LLM-Touchpoint in W1).
- **DriftView-Integration:** `_friendlyError`-Mapping um Havarie-Zustände erweitern; Entladung-Flow ruft Karten + Debriefing in Sequenz; Rückzug-Button bleibt.
- **i18n de/en**, WCAG AA, `prefers-reduced-motion`-Pfade für alles Neue.
- **Browser-E2E:** kompletter Run mit Ablieferung → Karten zeigen echte Links; Havarie erzwingen (Admin-SQL KH=0, Muster aus Memory-Ledger Session 13) → alle drei Choices durchspielen.

### Schritt 1.5 — Welle-1-Abschluss

- Voller Suite-Lauf (travel/drift ~42 + neue), `npm run lint:full`, Pack-Validator, beide Lint-Gates (secdef, content).
- Fresh-Eyes-Review (2 Subagenten SQL+FE, bewährtes Muster), P1-Fixes einarbeiten.
- Ledger + Memory aktualisieren; PR `feat/drift-fun-core-w1` (User merged/deployt; Gate bleibt off bis W3-Ende oder User-Entscheid).

---

## 4. WELLE 2 — „Jeder Zug lebt" (M1 Signale, M2 Sondierung, M9-Teile)

Branch: `feat/drift-fun-core-w2`. Ziel-Abnahme: *Median ≥ 4 Entscheidungen pro Run außerhalb der Routenwahl; ein dokumentierter „einen Zug zu weit"-Bust, der sich gut anfühlt.*

### Schritt 2.1 — Signal-Content-Pack + Schema (M1)

- **Pack:** `content/drift/signals/*.yaml` — neue Familie im Travel-Schema (`travel_schema.py`: `SignalTemplate` mit `signal_class` ∈ {stoerung, fund, geruecht, begegnung, stille}, `band_weights`, Requirements über Ressourcen-Bänder (kh_band/dz_band/window_band/overload), 1–3 Optionen mit `check` (Vektor+Schwierigkeit, Reuse `resolve_skill_check`-Formelwerte), template-owned Outcomes aus geschlossenem Delta-Vokabular: `{kh,bb,dz,takt,siegel,cargo_grant,rumor_reveal,marker_add}`; bilinguale Texte; KPI-1-Slots `{sim}/{agent}/{building}` optional).
- **Loader/Generator:** `travel_loader.py` um Familie erweitern (`_QUEST_PACK_FOR_FAMILY`-Muster), `generate_drift_migration.py` → Seed-Migration **266a** (`travel_signal_templates`-Tabelle + TRUNCATE-Reseed; Tabelle selbst in 266 angelegt, public read).
- **Startbestand: 32 Skelette** (Verteilung: 12 Störung, 7 Fund, 7 Gerücht, 3 Begegnung, 3 Stille-Varianten) — Autorenregeln aus Konzept §9.6 (points of light, calculated ambiguity, Wildermyth-Trust). Ressourcen-Band-Requirements auf mind. 10 Skeletten (R9: Zustand wird Text).
- **Tests:** Schema-Rejects je Invariante, Uniqueness, deterministische Generierung, 170er-Content-Suite bleibt grün.

### Schritt 2.2 — Migration 266 `travel_signals` (Zug-Ereignis-Engine)

- **`fn_travel_move`-Erweiterung:** Nach Ressourcen-Anwendung deterministischer Signal-Draw (Seed §2.7; Gewichte aus `drift_tuning.signal_weights` per Distanzband `{near:{stoerung:15,fund:20,geruecht:25,begegnung:5,stille:35}, mid:{25,20,20,10,25}, deep:{35,15,15,15,20}}`); Selektion eines passenden Templates (Requirements-Filter → gewichteter Pick); **Deep-Surge geht in der Störungs-Klasse auf** (alter Pfad entfällt, Werte wandern in Skelett-Outcomes). Ergebnis in Checkpoint `pending_signal` (bei Störung/Begegnung mit Optionen → Run wartet auf Resolve; Fund/Gerücht/Stille → sofort angewandt + Log-Eintrag).
- **Neu `fn_signal_resolve(run_id, run_version, option_key)`** (player-class, CAS): validiert `pending_signal`, führt Check deterministisch aus, wendet Outcome-Deltas an, schreibt Logbuch-Eintrag + Audit; Kollaps-Check danach (Störung kann in Havarie führen — gewollt).
- **Logbuch:** `traveler_discoveries` + neue Tabelle `travel_log_entries` (run-scoped, owner-read, kind ∈ signal/rumor/bank/havarie, jsonb payload, TTL-frei) — das persistente Gerüchte-/Ereignis-Gedächtnis (R12). Gerücht-Outcomes schreiben `rumor_reveal` → Knoten-Vorschau-Flag in `traveler_discoveries`.
- **DZ-Eskalation (M9):** `drift_tuning.dz_late_window` `{"from_takt":8,"extra":1}` in `fn_travel_move`.
- **Tests** (`test_travel_signals.py`): Draw-Determinismus (fixer Seed → fixes Signal), Requirements-Filterung, Options-Resolve inkl. Check-Fail-Pfad, Stille schreibt Log, Eskalation ab Takt 8, Gate-off → kein Signal-Draw (P0-Verhalten).

### Schritt 2.3 — Migration 267 `travel_sondierung` (M2 Push-your-luck + Bank)

- **Neue Tuning-Keys:** `sondierung_yields` `[2,3,5,8]` · `sondierung_marker_classes` `["resonanz","statik","echo"]` · `sondierung_bust_rule` `{"same_class_count":3}` · `funkboje_rate` `0.7`.
- **Neu `fn_sondieren(run_id, run_version)`** (player-class): 1 Takt; Ertragsstufe = bisherige Sondierungen am Knoten (Checkpoint `sondierung[node]`); deterministischer Marker-Draw (offen, Klasse ins Checkpoint-Array — das HUD zeigt den Stapel); Bust bei dritter gleicher Klasse → `resonanzriss`: ungesicherter Haul DIESES Knotens verfällt, +DZ (`riss_dz: 6`), Knoten-Flag `rissig` (Signal-Gewichte dort → Störung +15). Ertrag geht in `haul_unbanked`.
- **Haul-Split:** `travel_runs` bekommt `haul_banked INT DEFAULT 0` (ALTER) neben bestehendem Haul-Feld → `haul_unbanked`. `fn_travel_complete` zahlt banked 1.0 + unbanked 1.0 (zuhause ist voll), `fn_funkboje_bank` (neu, player-class, nur auf `relais`-Knoten — P0-Graph hat den Relais-Knoten bereits) verschiebt unbanked×0.7 → banked. Havarie-`notruf`/`rueckruf` halbieren nur unbanked (265er-Logik auf das Split-Feld umziehen).
- **Erstankunfts-Gutschrift bleibt** als Sockel (unverändert), Sondierung ist der Overdrive.
- **Tests** (`test_travel_sondierung.py`): Eskalationsreihe, Bust exakt bei 3. gleicher Klasse, Bank-Arithmetik (Rundung floor, nie negativ), Relais-only-Guard, Zusammenspiel mit Complete/Havarie, Determinismus.

### Schritt 2.4 — Frontend W2: Signal-Panel, Marker-Stapel, Logbuch, Entladungs-Reveal

- **`DriftStoryletPanel`** trägt jetzt Signale: Eingangs-Animation nach Signal-Klasse (§8 M-05..M-08), Options-Chips zeigen Kosten/Risiko ehrlich (BB-Kosten, „riskant"-Glyph bei Check), Resultat mit Delta-Zeilen.
- **`DriftMarkerStack.ts`**: Offener Störungsmarker-Stapel am Knoten (HUD-seitig) + Marker-Sprites im Chart (§8 M-09). Sondieren-Button mit Ertragsvorschau der NÄCHSTEN Stufe (Odds nie beziffert, Marker zählbar — R4).
- **Sondier-Zeremonie:** Commit → Reveal-Sequenz (§8 M-10); Resonanzriss-Moment (§8 M-11).
- **`DriftLogbook.ts`**: aufklappbare Logbuch-Leiste (Gerüchte, Signale, Bänke) — der „Wiedereinstieg kostenlos"-Anker; Gerücht-Knoten erscheinen im Chart als Geisterumriss (§8 M-12).
- **Entladungs-Reveal (M9):** gestaffelte Sequenz Haul → Siegel-Count-up → Wirkungskarten → Debriefing (§8 M-04). Der W1-Karten-Flow wird hier zur Voll-Zeremonie ausgebaut.
- **Funkboje:** Bank-Aktion im HUD bei Relais-Dock, mit Kurs-Anzeige „70 %" und Abwäge-Microcopy.
- **Browser-E2E:** 14-Takt-Run mit ≥ 6 Signalen, Sondier-Bust provozieren, Bank nutzen, Logbuch prüfen, Entladungs-Reveal komplett.

### Schritt 2.5 — Welle-2-Abschluss

Wie 1.5 (Suite, Lints, Fresh-Eyes ×2, Ledger, PR `feat/drift-fun-core-w2`). Zusätzlich: Telemetrie-Events `drift_signal_shown/resolved`, `drift_sondierung`, `drift_bank` für KPI F1/F5 nachweisbar in `travel_telemetry_events`.

---

## 5. WELLE 3 — „Die Karte trägt" (M7 Chart, M5 Umstimmung, M8 Substrat, M4-Requisition)

Branch: `feat/drift-fun-core-w3`. Ziel-Abnahme: *Zwei Playtester wählen im selben Setup unterschiedliche Routen und begründen beide; KPI 3 (< 20 min bis fremde Welt) hält.*

### Schritt 3.1 — Migration 268 `drift_chart_v3` + Generator-Ausbau (M7)

- `chart_generator.py`: Region auf **18–24 Knoten**, Typen-Mix (2 `relais`, 2 `echo_untiefe`, 1 `geisterinsel`, Rest interstitial in 3 Bändern), **3–4 fremde Broadcast-Docks** (aktive Template-Sims nach Seed-Priorität: kanonische zuerst, dann forge). **Generierungs-Invarianten als Assertions im Generator + CI-Test:** (a) ≥ 2 ausgehende Weiterwege je Nicht-Sackgassen-Knoten, (b) kein „Safe Highway" — der BB-günstigste Home↔Dock-Pfad muss ≥ 1 mid/deep-Band-Kante enthalten, (c) ≥ 2 Rekonvergenzpunkte je Dock-Route, (d) Erwartungsertrag deep > mid > near (Survey-Sockel + Untiefen-Bonus), (e) bestehende Konnektivitäts-/Notfrequenz-Assertion bleibt.
- Neue Knotentyp-Semantik in Tuning: `relais` (Bank, Gratis-Umstimmung, Rast −5 DZ/Takt), `echo_untiefe` (Sondier-Ertrag +2/Stufe, +1 DZ je Sondierung — Peacock-Wind), `geisterinsel` (2 exklusive Signal-Skelette, Stabilität: bei Chart-Refresh 20 % Umzug — Flag im Overlay).
- Migration 268 = `chart_versions`-Bump + Neugenerierung (Erstvermessungs-Honors überleben per `stable_key` — verifizierter 253er-Mechanismus; im Test nachweisen).
- **Tuning v2 hier (statt separat):** `window_base` 14 · `bandwidth_class_bb_max.1` = 10 · `dz_p0_cap` 40 · `notfreq_kh_per_edge` 10. (Prod-Handtuning wird damit kontrolliert abgelöst.)
- **Tests:** alle Invarianten als pytest über den Generator (fixer Seed), Honor-Survival, Fallback wenn < 4 aktive Sims.

### Schritt 3.2 — Migration 269 `travel_umstimmung` (M5)

- Kanten erhalten echte Zwei-Vektor-Permeabilität aus dem Generator (memory + architecture; ~25 % Kanten + 2–3 Knoten single-vector = Frequenzfenster).
- **Neu `fn_umstimmen(run_id, run_version, vector)`** (player-class): 1 Takt, −5 KH, gratis auf `relais`; nur freigeschaltete Vektoren (`unlocked_vectors`; Feldkartograph schaltet `architecture` frei — Write in `fn_clearance_exam` ergänzen). `fn_travel_move` prüft Permeabilität + wendet Off-Vector-Multiplikator an (existierende Tuning-Keys werden endlich scharf).
- Fracht-Vektor-Kopplung minimal: Traumfracht +1 DZ/Zug off-vector (Tuning-Key, Check in move).
- **Tests:** Umstimmungs-Kosten/Gratis-Relais, Frequenzfenster blockt, Multiplikator-Matrix, Unlock-Gate.

### Schritt 3.3 — Migration 270 `travel_requisition` (M4-Vollausbau)

- **Pack-owned Katalog** `content/drift/requisition/catalog.yaml` → Tabelle `travel_requisition_items` (Seed-Migration via Pipeline): `bandbreitenzelle` (+2 BB max, stack≤2, 20 S) · `daempfglied` (erster DZ-Schub/Run halbiert, 15 S) · `sondierboje` (erster Riss/Run abgewendet, 25 S) · `frachtnetz` (+1 freier Slot, 30 S) · `sektor_karte` (deckt 1 Knoten + Signal-Tendenz auf, 10 S) · `klasse_2` (Klassen-Upgrade, 50 S + Feldkartograph).
- **Neu `fn_requisition_buy(item_key)`** (player-class, kein aktiver Run nötig): Siegel-Abzug CAS, Besitz in `traveler_profiles.qualities.requisitions`; `fn_travel_run_open` liest Besitz und materialisiert Run-Effekte in den Checkpoint (Verbrauchsgüter dekrementieren dort).
- **Überlast (M3-Rest):** `fn_travel_move` +1 BB/Zug pro Slot über frei (Tuning `overload_bb_per_slot`).
- **Tests:** Kauf/CAS/Insufficient, Run-Open-Materialisierung, Verbrauch einmalig, Überlast-Arithmetik, Klasse-2-Doppelgate.

### Schritt 3.4 — Migration 271 `travel_building_docks` (M8)

- **Dock-Aktionen:** `GET /drift/dock/{sim}` liefert zusätzlich 3 kuratierte Gebäude (Selektor: `special_type`/`building_type`-Prioritäten Archiv/Markt/`sanctuary`-Flag; echte `buildings`-Rows, LEFT JOINs). **Neu `fn_dock_action(run_id, run_version, building_id, action)`** (player-class): `archiv_authentifizieren` (Fracht-Twist `gefälscht` aufdecken/+20 % Wert-Flag), `markt_fencen` (Fund-Fracht → Siegel sofort, Kurs 0.6), `sanctuary_rast` (−5 DZ) — je 1 Fenster-Takt; alle Writes über bestehende Effekt-/Audit-Wege.
- **Bond-Depeschen:** `_compute_offers`-Selektor (drift_service) bevorzugt (a) Agenten mit Bond ≥ 2 des Spielers (Join `agent_bonds`), (b) Agenten aus `events` der letzten 14 Tage der Zielwelt, (c) Gebäude-Empfänger; Offer-Payload trägt `personal: true` + Bond-Agent-Name; Ablieferung feuert zusätzlich `bond_event` (existierendes Effekt-Vokabular, Migration ergänzt den Kind-Case im Effekt-Kern).
- **Investigate-Familie:** neues Quest-Pack `content/drift/quests/investigate.yaml` (Template: 1 Dock + 1 Gebäude-Aktion + 1 Check; referenziert ein echtes Event der Zielwelt im Prosa-Slot). Seed via Pipeline.
- **Tagesdepesche (M9):** Tuning `daily_dispatch_bonus` `{siegel: 5}`; `_compute_offers` markiert das erste Angebot des Tages (UTC, deterministisch) als Tagesdepesche.
- **Tests:** Gebäude-Selektor (mit/ohne sanctuary-Welten), jede Dock-Aktion, Bond-Bevorzugung, investigate-E2E, Tagesbonus einmal täglich.

### Schritt 3.5 — Frontend W3: Requisitionsschein, Umstimmungs-Dial, Gebäude-Docks, Chart-Typen

- **`DriftRequisitionSheet.ts`**: Post-Run-Screen (nach Debriefing) im Requisitionsschein-Look (§8 M-13); Kauf = Stempel-Zeremonie; „Ohne Requisition fortfahren" immer prominent.
- **`DriftFrequencyDial.ts`**: 2-Positionen-Dial im HUD (memory/architecture), Umstimmen mit Kosten-Chip; Chart-Crossfade nutzt den VORHANDENEN Bitmask-Shader (Spike-verifiziert!) — endlich spielergesteuert (§8 M-14).
- **`DriftDockPanel`-Ausbau:** 3 Gebäude-Türen mit Aktions-Buttons + Takt-Kosten; Bond-Depeschen mit „persönlich"-Banderole.
- **Chart-Renderer** (`scene/nodes.ts`, `gameGraph.ts`): Knotentyp-Glyphen (Sprite-Atlas aus `utils/icons.ts` — Relais-Antenne, Untiefen-Wellen, Geisterinsel gestrichelt), Rissig-Zustand (Riss-Shader-Tint), Gerücht-Geisterknoten, Pfad-Preview beim Hover über adjazente Knoten (BB-Kosten + Band einblenden — R2-Information am Ort der Entscheidung).
- **Browser-E2E:** Kompletter Deluxe-Run über 3 Welten mit Umstimmung, Gebäude-Aktion, Requisitionskauf; Screenshot-Serie für den User.

### Schritt 3.6 — Welle-3-Abschluss + Gesamtabnahme

- Wie 1.5/2.5 + **KPI-Messlauf**: F1/F2/F5/F6 aus `travel_telemetry_events` gegen die Zielwerte (Konzept §8) auswerten, Ergebnis in `docs/analysis/drift-fun-core-playtest-<datum>.md`.
- Help-System-Topic `drift` aktualisieren (Sondierung/Havarie/Requisition-Abschnitte — Gotcha: Topic-URL `/how-to-play/guide/{slug}`).
- Gate-Flip-Empfehlung an den User (Deploy zuerst, dann `drift_fun_core_enabled=true` — Reihenfolge-Invariante wie beim P0-Launch).

---

## 6. Content-Produktionsplan (parallelisierbar zu W2/W3)

| Paket | Stück | Wo | Wann |
|---|---|---|---|
| Signal-Skelette | 32 (12 Störung / 7 Fund / 7 Gerücht / 3 Begegnung / 3 Stille) | `content/drift/signals/` | 2.1 |
| Havarie-/Debriefing-Templates | 6 (3 Havarie-Ursachen × Text, 3 Debriefing-Varianten) | `content/drift/ceremonies/` (Template-Text, kein LLM) | 1.4 |
| Investigate-Depeschen | 4 | `content/drift/quests/investigate.yaml` | 3.4 |
| Requisitions-Katalog | 6 Items | `content/drift/requisition/catalog.yaml` | 3.3 |
| Geisterinsel-Signale | 2 exklusiv | `content/drift/signals/` | 3.1 |

Alle bilingual (de/en), Autorenregeln Konzept §9.6, Validator-Pflicht in CI. LLM-Dressing bleibt AUS (KPI 6: Template-Text trägt alles); die Dressing-Façade-Anbindung ist ein dokumentierter P1-Anschlusspunkt.

---

## 7. Teststrategie & CI

- **Neue Integrations-Suiten:** `test_travel_economy.py`, `test_travel_havarie.py`, `test_travel_signals.py`, `test_travel_sondierung.py`, `test_travel_requisition.py`, `test_travel_dock_actions.py`, Generator-Invarianten in `test_drift_chart_v3.py`. Ziel: DRIFT-Suite von 42 auf **~85** grün.
- **Determinismus-Kontrakt:** Jeder RPC-Zufall mit fixem Seed testbar; ein dedizierter Replay-Test zieht denselben Move zweimal (Rollback dazwischen) und asserted identische Signale/Marker.
- **Gate-off-Regressionsnetz:** Ein Testmodul fährt den kompletten P0-Loop mit `drift_fun_core_enabled=false` und asserted byte-gleiche Kern-Responses (Schutz des Live-Systems bis zum Flip).
- **Bekannte Grenze (dokumentiert seit P0):** player-class-RPC-Pfade ohne authed-user-Fixture bleiben browser-verifiziert statt CI (bestehende conftest-Lücke; NICHT in diesem Plan lösen, aber je Schritt im Ledger als „browser-verified" vermerken).
- **CI-Gates:** ruff · pytest · `validate_content_packs.py --domain drift --strict` · `lint-no-secdef-public-grant.sh` · `lint-no-content-in-python.sh` · frontend `npm run lint:full` (tsc, biome, color-tokens, llm-content, empty-catch, cast-unknown, bureau-frame).

---

## 8. DELUXE-GRAFIKUMSETZUNG — Microanimations & Zeremonien-Spezifikation

Bindende Sprache: **reaktiv 180–280 ms, zeremoniell 480–900 ms**, alles mit `prefers-reduced-motion`-Fallback (Endzustand sofort, keine Bewegung, Information vollständig). Nur Design-Tokens (Tier 1/2 + `--drift-freq-*`-Bridge); Canvas-Effekte über den vorhandenen `post/composer.ts`-Stack (UnrealBloom + Dissonanz-Grade-Pass) — **keine neuen Post-Pässe**, nur Uniform-Choreografie. Alle Glyphen aus `utils/icons.ts`. Vor jedem FE-Schritt: `velg-frontend-design`-Skill.

| # | Moment | Tier | Dauer | Umsetzung | Reduced-Motion |
|---|---|---|---|---|---|
| M-01 | Siegel/VP-Count-up (LedgerStrip) | reaktiv | 240 ms | Ziffern-Odometer (translateY-Stack), Amber-Glow-Puls auf dem Delta-Chip, danach Chip fade | Endwert sofort, Chip 1 s statisch |
| M-02 | Rang-Fortschritt | reaktiv | 280 ms | Balken-Ease (`cubic-bezier(0.22,1,0.36,1)`), bei Rang-Schwelle: Balken → Stempel-Morph (Prüfung freigeschaltet) | Balken springt, Stempel statisch |
| M-03 | Wirkungskarten | zeremoniell | 640 ms/Karte, Stagger 120 ms | 3D-Flip (rotateY 90→0) aus dem Dossier-Stapel; gefilterte Karte flippt auf Redaction-Face (░▒-Blöcke, `<velg-redacted>`) mit kurzem Glitch-Jitter (2 Frames) | Karten erscheinen nacheinander per Opacity |
| M-04 | Entladungs-Reveal (Gesamt) | zeremoniell | ~2.8 s Gesamt | Sequenz: (1) Haul-Zahl skaliert 2.2→1 mit Bloom-Puls am Home-Knoten (Canvas: `uBloomBoost`-Envelope 600 ms), (2) M-01, (3) M-03, (4) Debriefing-Panel slide-up 480 ms | Alle Stufen als sofortige Abschnitte, Scroll-Reihenfolge erhalten |
| M-05 | Signal: Störung | zeremoniell | 560 ms | Panel-Eintritt mit Scanline-Wipe (CSS-Gradient-Mask) + 1 Chroma-Jitter-Frame; Canvas parallel: Knoten-Tint → danger, kurzer Grade-Pass-Kick (`uDissonance` +0.15 Envelope) | Panel fade-in 0 ms, statischer danger-Rahmen |
| M-06 | Signal: Fund | zeremoniell | 480 ms | Panel-Eintritt weich; Fund-Ikone „schwimmt" ein (translateY 8px + Glow); Partikel-Wisch am Knoten (bestehendes `particles.ts`-System, 12 Partikel Burst) | Ikone statisch mit Glow |
| M-07 | Signal: Gerücht | reaktiv | 280 ms | Typewriter auf der ersten Prosa-Zeile (nur erste Zeile!), Logbuch-Ikone pulst einmal; Chart: Geisterknoten blendet mit gestricheltem Umriss ein | Volltext sofort, Umriss sofort |
| M-08 | Signal: Stille (Log-Zeile) | reaktiv | 200 ms | Log-Zeile slide-in von links, Fenster-/DZ-Chips ticken falls betroffen — bewusst KEIN Modal | identisch (bereits minimal) |
| M-09 | Störungsmarker-Stapel | reaktiv | 220 ms/Marker | Oktagon-Marker (Seal-Formsprache!) stanzt ein: scale 1.6→1 mit 1 Bounce; Klassen-Farbe über Token; dritter gleicher Marker: alle drei pulsen synchron warnend (2×) | Marker erscheint, Warnrahmen statisch |
| M-10 | Sondier-Commit → Reveal | zeremoniell | 720 ms | Commit-Button → Sonar-Ring vom Knoten (Canvas: expandierender Ring-Shader auf Node-Layer, 1 Welle), dann Ertragszahl + Marker-Stanze (M-09) in Folge — Entscheidung VOR Auflösung, Auflösung als Spektakel | Ergebniszeile + Marker sofort |
| M-11 | Resonanzriss (Bust) | zeremoniell | 900 ms | Canvas: Knoten-Shader → Riss-Tint + 300 ms Tear-Band (vorhandener Grade-Pass, lokal), HUD: unbanked-Haul-Zahl zerfällt (Ziffern streuen als 6 Glyph-Partikel), DZ-Balken-Schub; danach ruhiger „Riss verzeichnet"-Log-Eintrag — Verlust mit Würde, kein Shaming-Rot-Blitz | Haul-Zahl → durchgestrichen, DZ springt, Log sofort |
| M-12 | Gerücht-Geisterknoten (Chart) | ambient | — | Gestrichelter Umriss, 3 s Opacity-Atmen 0.35↔0.55; bei Erst-Besuch „materialisiert": Strichel → solid mit 400 ms Glow | statisch 0.45, Materialisierung ohne Puls |
| M-13 | Requisitionsschein | zeremoniell | 560 ms + 480 ms/Kauf | Sheet slide-up als Papier-Dossier (2px-Offset-Schatten, Formular-Raster); Kauf: Item-Zeile bekommt Oktagon-STEMPEL (Compass-Rose-Reuse aus den Erstvermessungs-Seals) mit Stanz-Keyframe (scale 2.2→0.9→1) + Siegel-Odometer runter | Sheet fade, Stempel statisch |
| M-14 | Umstimmung (Dial + Chart) | zeremoniell | 700 ms | HUD-Dial rastet mit 2-Stufen-Snap; Canvas: **vorhandener** Frequenz-Bitmask-Crossfade (Vertex-Shader, Spike-verifiziert) über 700 ms, Korridore/Knoten tauschen Sichtbarkeit; Frequenzfenster-Knoten schimmern 2× nach | Dial rastet, Crossfade als Hard-Cut |
| M-15 | Havarie-Sequenz | zeremoniell | gestuft ~1.6 s | (1) Canvas: `uDissonance`-Envelope auf 0.5 + Vignette 400 ms, HUD dimmt auf 60 %, (2) Havarie-Panel schlägt auf (slide + 1 Jitter-Frame), Options-Karten mit Konsequenz-Chips, (3) nach Wahl: Auflösung ruhig zurückblenden (600 ms) — Drama im Eintritt, Klarheit in der Wahl | Panel sofort, Canvas-Effekte aus, Konsequenzen vollständig lesbar |
| M-16 | Pfad-Preview (Hover) | reaktiv | 180 ms | Adjazente Kante leuchtet in Vektor-Farbe, Kosten-Chip (BB + Band-Punkt) dockt am Cursor-Dossier an (bestehendes Hover-Dossier erweitern) | Chip sofort, kein Kanten-Puls |
| M-17 | Tagesdepesche | reaktiv | 260 ms | Angebots-Karte mit Banderole „Tagesdepesche", einmaliger Shine-Sweep beim ersten Rendern pro Tag | Banderole statisch |
| M-18 | Bond-Depesche | reaktiv | 240 ms | „Persönlich"-Banderole in Bond-Akzent, Agenten-Name mit Unterstreich-Draw-in | statisch |

**Canvas-Regeln:** Uniform-Envelopes (attack/decay) statt per-Frame-JS-Tweens; alle neuen Sprites in EINEN Atlas (Draw-Call-Budget); Seal-/Marker-DOM-Overlays folgen dem bewährten `--seal-scale`-Zoom-Clamp-Muster; sRGB-Falle beachten (deep-Background-Summen < 0.01 linear — Spike-README). **Audio ist explizit AUSSERHALB dieses Plans** (Anschlusspunkt: Howler-Infra aus Dungeon-Audio Phase 1; eigenes Mini-Set Sonar/Stempel/Riss als P1-Kandidat).

**A11y-Kontrakt je Moment:** Fokus-Reihenfolge Panel → Optionen → Abschluss; alle Canvas-Informationen (Marker, Geisterknoten, Riss) haben HUD-Text-Äquivalente; Farbklassen nie einziger Kanal (Glyph-Redundanz); `aria-live="polite"` auf Log/Ledger-Deltas.

---

## 9. Gating & Rollout

1. Alles hinter `drift_fun_core_enabled` (fail-closed; Seed false in 264). Gate-off = exakt P0 (Regressionsnetz §7).
2. Merge-Reihenfolge W1 → W2 → W3, je eigener PR; User merged/deployt (Coolify manuell, bekanntes Modell).
3. **Flip-Reihenfolge zwingend:** Deploy (Code live, gated) → Migrationen appliziert (Management-API-Verfahren aus `~/.config/metaspots/SUPABASE-ACCESS.md`; 268 bumpt chart_version!) → Gate-Flip → Verify (`/public/drift/state`, Sentry, ein echter Run).
4. Rollback = Gate false (eine Zeile). Chart v3 bleibt dann sichtbar (public read), aber P0-Verben funktionieren auf ihm unverändert — Generator-Invariante (e) sichert P0-Kompatibilität des Graphen.
5. Kill-Switch `fn_drift_emergency_return` bleibt unangetastet wirksam.

---

## 10. Lokale Umgebung (Restore-Karte für jede Session)

```bash
# Backend (Schedulers aus):
RUN_SCHEDULERS=false nohup .venv/bin/python -m uvicorn backend.app:app --port 8000 --no-access-log >/tmp/drift_backend.log 2>&1 &
# Frontend:
cd frontend && npm run dev   # :5173
# DB-Driver:
docker exec -i supabase_db_velgarien-rebuild psql -U postgres -d postgres
# Migration anwenden:   supabase migration up --local        (NIE db reset)
# Gates LOKAL:          drift_p0_enabled=true, drift_fun_core_enabled=true (platform_settings)
# Tests:                .venv/bin/python -m pytest backend/tests/integration/test_travel_*.py -q
# Packs:                .venv/bin/python scripts/validate_content_packs.py --domain drift --strict
# Browser-E2E-Muster:   eingeloggte Session :5173, /simulations/velgarien/drift;
#   Havarie erzwingen:  admin-SQL kohaerenz=0 OHNE run_version-Bump, dann 1 Move (Memory Session 13)
```

---

## 11. FORTSCHRITTS-LEDGER (nach jedem Schritt aktualisieren!)

Format je Zeile nach Abschluss: `[x] … — <commit-hash> <datum> <"tests: N grün"> <browser-verified ja/nein> <Notizen/Abweichungen>`

**Welle 1 — feat/drift-fun-core-w1**
- [x] 1.1 Migration 264 travel_economy_activation (+ Tests test_travel_economy.py) — 2026-07-12, tests: 17 neu / 59 travel+drift grün, ruff + ADR-006-Guard grün. **Abweichungen/Zugewinne:** (a) Die Plan-Grenze „player-class-RPCs sind nur browser-verifizierbar" ist AUFGEHOBEN — neue conftest-Fixture `user_clients` (4 JWT-authentifizierte Clients; Blocker war nur `email_confirm`, per service_role-Admin-API gesetzt). Alle Player-Pfade laufen ab jetzt in CI. (b) Statt `lifetime_siegel/lifetime_vp` (Plan §1.1) liefert die Response `siegel_balance` + `vp_total`: Siegel ist ab W3 ausgebbar, „lifetime" wäre gelogen; VP ist per Konstruktion lifetime (wird nie ausgegeben). (c) Zusatz-Bausteine, die der Plan nicht benannte, aber jede Folgewelle braucht: `drift_gate_enabled(key)` (SQL-Zwilling von `parse_setting_bool`, fail-closed), `drift_rand`/`drift_rand_int` (Determinismus §2.7), `fn_drift_award` (EINZIGER Ledger-Writer, Credits-only). (d) `zerfaserung_count`-Inkrement liegt INNERHALB des Gates (Rollback-Invariante „Gate off = exakt P0" schlägt Bugfix-Instinkt).
- [x] 1.2 Service/Router/Modelle: Payouts, EffectCards, /drift/profile — 2026-07-12, tests: 7 neu (test_drift_profile_cards.py) / 66 drift+travel grün, ruff grün, HTTP-verifiziert (Profil, Prüfung, Gate-off-404). **Entscheidungen:** (a) `earnings` wird per `model_validator` aus `checkpoint.earnings` auf `TravelRunResponse` gehoben — `fn_travel_complete` RETURNS to_jsonb(run), der Payout kann also nur im Checkpoint reisen; so liest das HUD EIN typisiertes Feld statt in einem dict zu graben, und jeder Run-Konsument (Complete, Refetch, 2. Gerät) bekommt die Quittung gleich. (b) Beleg-Links der EffectCards werden aus `events.metadata.quest_instance_id` aufgelöst (der Gate stempelt das bereits) — deshalb musste am Gate-off-Response NICHTS geändert werden (P0-Parität hält). (c) `GET /drift/profile` liegt bewusst NICHT hinter dem Fun-Kern-Gate (liest bei Gate-off schlicht Nullen; ein 404 mitten im HUD wäre schlechter); `POST /drift/clearance-exam` ist doppelt gegated (HTTP + RPC).
- [x] 1.3 Migration 265 travel_havarie + fn_travel_havarie_resolve (+ Tests) — 2026-07-12, tests: 16 neu (test_travel_havarie.py) / 82 drift+travel grün, ruff + ADR-006-Guard grün, HTTP-verifiziert (Havarie öffnen → GET /run sieht das Wrack → notruf → Schuldvermerk; NOT_IN_HAVARIE 400; Gate-off 404). **Entscheidungen/Abweichungen:** (a) Entladungs-Kern in `fn_travel_bank_run(user, run, haul_mult, source)` extrahiert — `rueckruf` (0.7) und `fn_travel_complete` (1.0) teilen EINEN Bank-Pfad statt zwei zu duplizieren. (b) `zerfaserung_count` wandert aus 264s Kollaps-Boden nach `fn_travel_zerfasern` (gewählte Zerfaserung + TTL) — eine überlebte Havarie ist KEINE Zerfaserung; die 264er Tests wurden entsprechend umgeschrieben. (c) `notabwurf` wird nur angeboten, wenn Fracht an Bord ist (tote Option = Versprechen, das der Spieler nicht einlösen kann); geworfene Fracht streut NICHT als Echo (nur eine Zerfaserung streut) und ihre Depesche wird `failed` gesetzt — sonst QUEST_ACTIVE-Lockout (250/256-Bugklasse). (d) `notruf`-Schuld ist ein VERMERK in `qualities.siegel_debt`, kein Abzug (siegel hat CHECK ≥ 0 — eine Rettung darf die Börse nicht negativ machen oder still klemmen). (e) `havarie` ist im partiellen Unique-Index `uq_travel_runs_single_active` — ein Wrack hält den Slot; TTL (48 h) wird lazy in `fn_travel_havarie_resolve` + `fn_travel_run_open` finalisiert (kein Scheduler). (f) BUGFIX unterwegs: `_rpc_error` mappte P0001 ≠ RUN_STALE (VP_TOO_LOW/SIEGEL_TOO_LOW aus 264) auf 500 statt 400.
- [x] 1.4 FE: DriftLedgerStrip, DriftEffectCards, DriftStoryletPanel (Havarie + Debriefing), M-01..M-04/M-15 (+ E2E) — 2026-07-13, `npm run lint:full` grün (tsc/biome/7 Gates), 84 Backend-Tests grün, **browser-verifiziert**: Konto-Strip → Prüfung (Rang + Gebühr) → Havarie (Optionen aus dem Server-Katalog, Notruf) → Ablieferung (Wirkungsbericht mit Beleg-Link + redigierten Karten) → Entladung (Debriefing mit Gutschrift). **5 Bugs, die erst der Playtest zeigte:** (1) HUD hatte NIE eine Höhenbegrenzung — der Konto-Streifen schob sie 137 px aus dem Board in den Footer (`max-height` + `overflow-y` + `box-sizing`, Shadow DOM erbt den border-box-Reset NICHT). (2) Beleg-Links waren immer leer: `events_select` verlangt Sim-Mitgliedschaft, ein Träger ist in der Zielwelt aber nie Mitglied → Lesen über die Public-View `active_events` (active_agents-Präzedenz). (3) Gefilterte Karten hießen „Unbekanntes Ziel": die `skipped`-Einträge des Gates (Migr. 255) tragen nur `{kind, reason}` → Fallback auf die Depeschen-Slots, damit die ablehnende Welt BENANNT wird (der ganze Sinn der Karte). (4) Knoten kaum klickbar: `_nodeAt` nahm den nächstgelegenen Knoten ÜBERHAUPT und verwarf den Klick dann, wenn dieser nicht erreichbar war — in den dichten Interstitial-Clustern verpuffte fast jeder Klick. Jetzt sucht der Klick-Pfad nur unter den ERREICHBAREN (Trefferquote 68 % → 92 % gemessen), Hover bleibt allwissend, Touch-Radius 44 px, Zeigefinger-Cursor nur wo ein Zug möglich ist. (5) Zoom nur beim Aufbau gefittet (ResizeObserver setzte nur die Renderer-Größe) und auf die VOLLE Canvas zentriert, obwohl die HUD 352 px dauerhaft verdeckt → Re-Fit bei echter Größenänderung + Fit in das sichtbare Band (`gutterLeft`), Padding als Ratio statt konstanter +200 Welt-Einheiten. Messung: 0 Knoten offscreen / 0 unter der HUD bei Board-Breiten 700–1800 px.
- [x] 1.5 Abschluss: Suite, Lints, Fresh-Eyes ×2, P0/P1-Fixes — 2026-07-13, tests: **90 travel+drift grün** (+6 neu), volle Backend-Suite **3488 passed / 0 failed**, `ruff` + `npm run lint:full` (tsc, biome, 7 Gates) + Pack-Validator + Content-Gate + **ADR-006-Guard gegen die migrierte DB** grün, **browser-verifiziert** (Beleg-Link → Ereignis-Akte in der Fremdwelt, Konto zwischen den Fahrten, Prüfung → Feldkartograph, Havarie mit TTL-Satz, Notruf). **Die Fresh-Eyes-Reviews fanden zwei P0 — beide gefixt, beide an der Quelle (264/265 sind unmerged/undeployt; eine Reparatur-Migration wäre toter Ballast für ein Feature, das nie lief):**
  - **P0 SQL — der Gate-Rollback sperrte Havarie-Runs 48 h ein.** `fn_travel_havarie_resolve` warf bei geschlossenem Gate `GATE_CLOSED`, und ALLE anderen Ausgänge waren zu (move/complete verlangen `active`, `fn_travel_abandon` (246) kennt `havarie` nicht, `fn_travel_run_open` gibt das Wrack zurück, und der Admin-Kill-Switch `fn_drift_emergency_return` sah den Status gar nicht). Der Flip, der das P0-Spiel zurückgeben soll, machte den Träger handlungsunfähig — bis die TTL ihn wegräumte. Regel daraus: **ein Gate darf sich weigern, Zustand zu ERZEUGEN, niemals ihn zu ENTLEEREN.** Jetzt: Gate zu + Run in Havarie → erzwungene Zerfaserung (das P0-Ende), `{gate_drained: true}`, ohne CAS-Forderung (der einzige Ausgang aus einer Falle darf nicht an einem veralteten Token scheitern) und ohne Narbe (Gate off = null Fun-Kern-Residuum, deshalb ist der `zerfaserung_count`-Inkrement jetzt selbst gegated). Zusätzlich sieht der Kill-Switch `havarie` (CREATE OR REPLACE in 265, nicht Edit an 246).
  - **P0 FE — die Beleg-Links waren tot.** Beide Zweige zeigten ins Leere: die Agenten-Route löst per **Slug** auf (`AgentService.get_by_slug`), bekam aber eine UUID → Agentenliste statt Träger; und `/simulations/:id/events/:eventId` **existierte gar nicht** → `<velg-not-found>`. Das Einzige, wofür der Träger den Bleed überquert hat, führte ins Nichts. Fix: `EffectCard.agent_slug` (Backend + Typ + Karte) und die fehlende Event-Detail-Route nach der `:entitySlug`-Präzedenz (`EventsView.entityId` → Detail-Panel, mode-aware, öffnet auch als Nicht-Mitglied der Zielwelt über den Public-Endpoint).
  - **P1 SQL:** (a) TTL-Sweep in `fn_travel_run_open` las ohne `FOR UPDATE` → ein doppelt geklickter Aufbruch konnte dasselbe Wrack zweimal zerfasern (**+2 permanente Narben** für EIN Wrack, doppeltes Audit/Telemetrie); jetzt Lock + Idempotenz-Guard in `fn_travel_zerfasern` (Status-Check, geschlossener Run kommt unverändert zurück). (b) **Notabwurf konnte ins Leere bezahlt werden**: bei `window_remaining == window_cost` kehrt der Run mit 0 Takten nach `active` zurück und fällt beim nächsten Zug sofort in dieselbe Havarie — Fracht weg, Depeschen `failed`, nichts gekauft. Wird jetzt nur angeboten, wenn mindestens ein Takt den Preis überlebt (dieselbe Regel wie „keine Fracht → kein Notabwurf": eine tote Option ist schlimmer als keine).
  - **P1 FE:** (a) Konto-Streifen + Prüfungs-Stempel hingen im `run != null`-Zweig → die Entladung schaltete die Beförderung frei und unmountete im selben Moment den Knopf, mit dem man sie ablegt; jetzt in beiden HUD-Zweigen. (b) Delta-Chip feuerte **genau einmal pro Strip-Leben** (Lit recycelt das `<span>` an derselben Template-Position, die CSS-Animation startet nicht neu) → `keyed()` mit Nonce; der versprochene 240-ms-Odometer (§8 M-01) existierte gar nicht → als rAF-Tween nachgebaut. (c) Die Zeremonie lief **hinter dem Szenen-Schleier** ab (Profil-Refetch feuerte vor dem Öffnen der Karten) → Refetch beim SCHLIESSEN der Szene, wenn der Träger wieder aufs HUD schaut. (d) Eine abgelehnte Mutation resyncte den Run, aber nicht die **Szene** (die hielt einen Snapshot) → bei anderswo aufgelöster Havarie (2. Tab, TTL) blieb das Panel auf dem toten Snapshot stehen und jede Option antwortete ewig `NOT_IN_HAVARIE`; Szenen werden jetzt aus dem Run **abgeleitet**, nie über ihn hinaus erinnert. (e) Der Szenen-Layer war ein `role="dialog"` ohne Dialog-Verhalten: der Scrim stoppte nur ZEIGER, per Tab waren **Entladung/Rückzug hinter der Havarie** weiter erreichbar → `inert` auf Board+HUD, Fokus wandert in die Szene (nach `updateComplete` des Kindes — synchron fokussiert griff ins Leere, gemessen: Fokus blieb auf `<body>`), Escape schließt Bericht/Debriefing, aber NICHT die Havarie (eine gestoppte Fahrt ist nicht wegdrückbar).
  - **Beim Playtest zusätzlich gefunden (kein Review-Fund): der Odometer log bei verstecktem Tab.** `requestAnimationFrame` läuft in einem Hintergrund-Tab nicht — und weil der Tween die angezeigte Zahl schreibt, blieb der Streifen nach einer Gutschrift **dauerhaft auf dem alten Kontostand** (gemessen: Profil 22 Siegel, HUD zeigte 14). Der Fall ist der Normalfall, nicht exotisch: der Träger hat gerade „Beleg ansehen" geklickt und liest im anderen Tab. Fix: Snap bei `document.hidden` + `setTimeout`-Sicherheitsnetz (feuert auch im Hintergrund). Die Wahrheit überlebt die Zeremonie.
  - **Determinismus gehärtet (P2 mit W2-Tragweite):** Der Seed war `run:instance:takt` — alles Werte, die der Client hält, und `hashtext` ist offen. In W1 wären das ~4 erwürfelbare Siegel; in **W2 ziehen dieselben Würfel Signale und den Sondierungs-Bust**, wo ein vorausberechenbares Blatt das Push-your-luck ersatzlos löscht. Neu: `travel_run_seeds` (Salz je Run) + `drift_run_salt()`. Bewusst **keine Spalte auf `travel_runs`**: `travel_runs_owner_select` (RLS) lässt den Träger seine eigene Run-Zeile über PostgREST lesen — das Geheimnis läge beim Gegner. Verifiziert: `authenticated` hat weder SELECT auf die Tabelle noch EXECUTE auf die Funktion.
  - **P2 nebenbei:** `checkpoint.earnings` lag eine Ebene zu tief (`jsonb ||` bindet im zweiten Argument) → `TravelRunResponse._lift_earnings` fand nie etwas, der Kommentar behauptete das Gegenteil; jetzt Top-Level. `_nodeAt` scannte pro `pointermove` **zweimal** die Knotenliste und allozierte je Scan eine neue `MediaQueryList` → ein Scan, MQL als Feld. Refetch-Fehler (`_refreshRun/Quests/Honors/Profile`) verschluckten `success === false` still → `captureError` (ein stiller Refetch-Fehler ist ein HUD, das lügt). Platzhalter-`aria-label` am Options-Button entfernt (nutzlose XLIFF-Unit, dupliziert den sichtbaren Text).
  - **Offen (bewusst, kein W1-Regress):** Der XLIFF-Katalog ist repo-weit veraltet (736 Units ohne `<target>`, darunter schon DRIFT-P0 und die Alpha-Suite). DRIFT-`msg()`-Quellen sind bewusst deutsch, ohne Target fällt lit-localize auf die Quelle zurück. Ein Resync zöge 516 Zeilen fremder Churn in den W1-PR → eigene Chore.

**Welle 2 — feat/drift-fun-core-w2** (Branch gestapelt auf `feat/drift-fun-core-w1`, da W1 zum Start von W2 noch nicht auf main gemergt war)
- [x] 2.1 Signal-Pack (Schema + Loader + 32 Skelette + Migration 266 Tabelle + Seed-Migration 266a) — 2026-07-13, tests: **32 Pack-Tests** (+21 neu) / 122 travel+drift+pack grün, ruff + Content-Gate + Pack-Validator grün, beide Migrationen lokal appliziert. **Abweichungen/Entscheidungen:** (a) **Migrations-Nummern verschoben.** Der Plan wollte die Tabelle in 266 (Engine) und den Seed in „266a" — ein Seed kann aber nicht VOR seiner Tabelle laufen, und ein Schritt, dessen Migration erst der nächste Schritt applizierbar macht, kann sein eigenes Ergebnis nicht verifizieren. Jetzt: **266 = `travel_signal_templates` (DDL)**, **266a = generierter Seed**, Engine → **267**, Sondierung → **268**, W3 rückt auf **269–272**. (b) **`signal_class` wird authored, nicht aus dem Dateinamen injiziert** (Bruch mit der Quest-Familie-Präzedenz, bewusst): die entscheidende Invariante — interaktive Klassen (`stoerung`/`begegnung`) MÜSSEN Optionen haben, passive (`fund`/`geruecht`/`stille`) MÜSSEN genau ein `auto`-Outcome tragen — ist nur prüfbar, wenn das Modell seine Klasse kennt; ein Dateiname ist nichts, was ein Pydantic-Validator sieht. Die Klasse steht EINMAL pro Datei (nicht pro Item), der Loader vergleicht sie gegen den Stem. Ohne diese Invariante könnte ein passives Skelett mit Optionen den Run auf eine Entscheidung warten lassen, die die HUD nie anbietet. (c) **`band_weights` + `requires` sind eigene Spalten**, nicht Teil von `definition`: auf sie filtert und gewichtet der Draw bei JEDEM Zug; `definition` (Prosa + Optionen/Auto) ist Payload, den erst das gewählte Template braucht. (d) **Geschlossenes Delta-Vokabular mit engen Grenzen** (`kh` ±40, `bb` ±5, `dz` ±20, `takt` ±4, `siegel` 0–30, plus `cargo_grant`/`rumor_reveal`/`marker_add`): die Grenzen sind keine Balance, sondern der Radius eines Tippfehlers — kein einzelnes Signal darf einen Run beenden oder einen Rang verschenken. Numerische 0-Deltas werden abgelehnt (ein „0" in der HUD-Delta-Zeile ist Lärm). `siegel` kann nur gutschreiben, nie abziehen (`traveler_profiles.siegel` hat CHECK ≥ 0 — Präzedenz notruf/265: eine Schuld ist ein VERMERK). (e) `cargo_grant` erbt die Family↔Vektor-Paarung von `CargoSpec` (ein Fund kann keine falsch frequenzgeformte Materie erzeugen) und trägt `haul` — Fund-Ertrag reist in derselben Ökonomie wie ein vermessener Knoten und ist damit bei Havarie/Zerfaserung genauso verlierbar. (f) Validator-Zugewinn: leere Signalklasse = Violation (der Draw würde ins Leere greifen), interaktive Klasse mit < 2 Skeletten = Violation (eine Entscheidung, die der Spieler schon kennt, ist keine). (g) Content: 32 Skelette (12/7/7/3/3), **10 mit Ressourcen-Band-Requirements** (R9-Ziel erfüllt); der alte hardcodierte `deep_surge` löst sich in `stoerung_frequenzscherung` auf — er hat jetzt einen Namen, einen Text und eine Gegenwehr.
- [x] 2.2 Migration 267 travel_signals: Draw in fn_travel_move, fn_signal_resolve, travel_log_entries, DZ-Eskalation + Service/Router/Modelle (+ Tests) — 2026-07-13, tests: **27 neu (test_travel_signals.py) + 3 Modell-Lifts / 152 travel+drift+pack grün**, ruff + Content-Gate + Pack-Validator + **ADR-006-Guard gegen die migrierte DB** grün, HTTP-verifiziert (`GET /drift/logbook`, `POST /run/{id}/signal/resolve`, `pending_signal` im Run). **Entscheidungen/Abweichungen:** (a) **Der Draw sitzt zwischen Zugkosten und Boden.** Ein Zug, der ohnehin schon kollabiert, zieht KEIN Signal (der Drift hat bereits gesprochen; ein Signal-Panel über einem Havarie-Panel sind zwei Szenen für einen Moment). Ein passives Signal wird angewandt und DANN der Boden erneut geprüft — ein Fund, der schwer genug ist, den Rumpf zu brechen, darf ihn brechen. (b) **`SIGNAL_PENDING` blockt den nächsten Zug** (nur bei offenem Gate): eine Störung ist eine Entscheidung, keine Benachrichtigung. Bei geschlossenem Gate wird der Schlüssel schlicht aus dem Checkpoint gespült — W1-Regel: ein Gate darf Zustand verhindern, nicht einsperren. Dasselbe in `fn_signal_resolve` (Gate zu → `gate_drained`, ohne CAS). (c) **`drift_checkpoint_carry` (neu, Whitelist).** `fn_travel_move` BAUT den Checkpoint bei jedem Zug neu (jsonb_build_object, kein Merge) — 265 trug `overstay` von Hand nach. Mit Marker-Stapeln (und ab 2.3 den Sondierungs-Zählern) hätte jeder Zug den Stapel still geleert und den Bust unerreichbar gemacht. Jetzt eine Liste, einmal, nie wieder vergessbar. (d) **Ausführung liest die Option aus der TABELLE, nicht aus dem Checkpoint** — die Kopie, die der Client sehen kann, darf nie die Kopie sein, der der Server gehorcht. Der Checkpoint trägt nur die Anzeige-Kopie (Labels, Kosten-Chips). (e) **Bezahlbarkeit ist Teil der ELIGIBILITY, nicht eine Überraschung beim Resolve** (zweite Anwendung der W1-Regel „eine tote Option ist schlimmer als keine"): ein Skelett, dessen sämtliche Optionen unbezahlbar wären, wird gar nicht erst gezogen. KH wird bewusst NICHT geprüft — seine letzte Kohärenz auszugeben ist eine legitime, schreckliche Wahl. (f) **`travel_cargo.haul_value` (neue Spalte).** Ein Fund schreibt Fracht UND Haul; zwei Bücher für eine Sache. Wer die Fracht entfernt (Notabwurf hier, Fencen in W3), muss den Haul mitnehmen — sonst zahlt geworfene Bergung weiter. Dabei fiel ein latenter Bug auf: der Notabwurf-Zweig schrieb einen **Checkpoint-Snapshot** zurück (`v_run.checkpoint`, vom Funktionsanfang) und hätte die Haul-Korrektur wieder überschrieben; jetzt liest er die Spalte. (g) `fn_travel_havarie_resolve` deshalb als CREATE OR REPLACE in 267 (265 bleibt für den W1-PR unangetastet); `drift_havarie_payload` extrahiert, weil jetzt auch ein Signal einen Run beenden kann und zwei handgebaute Kataloge genau so auseinanderlaufen. (h) `deep_surge` feuert nur noch bei geschlossenem Gate — bei offenem ist es `stoerung_frequenzscherung`. (i) Telemetrie-CHECK erweitert (`drift_signal_shown/resolved`, `drift_sondierung`, `drift_bank`) — KPI F1/F5 messbar (2.5 muss nur noch auswerten). (j) `GET /drift/logbook` bewusst NICHT hinter dem Fun-Kern-Gate (leeres Logbuch ist eine wahre Antwort, ein 404 mitten im HUD nicht) und NICHT run-scoped: das Logbuch ist die Laufbahn, nicht die Fahrt (R12) — `run_id ON DELETE SET NULL`, verifiziert an einer Zeile, die ihren gelöschten Run überlebt hat.
- [ ] 2.3 Migration 268 travel_sondierung: fn_sondieren, haul_banked-Split, fn_funkboje_bank (+ Tests)
- [ ] 2.4 FE: Signal-Panel-Ausbau, DriftMarkerStack, DriftLogbook, Sondier-/Riss-/Entladungs-Zeremonien M-05..M-12 (+ E2E)
- [ ] 2.5 Abschluss + Telemetrie-Events

**Welle 3 — feat/drift-fun-core-w3** (Migrationsnummern um 1 verschoben, siehe 2.1(a))
- [ ] 3.1 Migration 269 drift_chart_v3 + Generator-Invarianten + Tuning v2 (Fenster 14 / BB 10 / DZ 40) (+ Tests)
- [ ] 3.2 Migration 270 travel_umstimmung + Permeabilität (+ Tests)
- [ ] 3.3 Migration 271 travel_requisition + Überlast (+ Tests)
- [ ] 3.4 Migration 272 travel_building_docks + Bond-/Investigate-/Tagesdepesche (+ Tests)
- [ ] 3.5 FE: RequisitionSheet, FrequencyDial, Dock-Ausbau, Chart-Glyphen/Preview, M-13/M-14/M-16..M-18 (+ E2E)
- [ ] 3.6 Gesamtabnahme: KPI-Messlauf, Playtest-Doc, Help-Topic, Gate-Flip-Empfehlung

---

## 12. RESUME-PROTOKOLL (für eine frische Session nach /clear)

1. Memory `drift-fun-core-implementation-ledger` lesen (aktueller Stand, Gotchas, Branch).
2. DIESES Dokument lesen (§1 Anker, §2 Regeln, dann NUR den Abschnitt der aktuellen Welle).
3. `git log --oneline -5` + Ledger §11 abgleichen → nächsten offenen Schritt bestimmen.
4. Lokale Umgebung nach §10 herstellen (prüfen, nicht blind starten: `curl :8000/api/v1/health`).
5. Schritt umsetzen (bei FE-Schritten ZUERST `velg-frontend-design`-Skill), Tests + Browser-Verifikation, Lints.
6. §11-Checkbox + Memory-Ledger aktualisieren, ausführlich committen. Weiter mit dem nächsten Schritt, solange Kontext reicht; Push/PR macht der User.
