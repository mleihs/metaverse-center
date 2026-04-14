# Plan: Substrate Resonance System Evolution

## Context

Full 4-perspective audit of The Substrate + News Import Tool revealed 5 game design findings (G1-G5). Post-exploration correction:

- **G5 was WRONG**: Cascade rules ARE fully implemented in `narrative_arc_service.py:191-350`. 8 seed rules, cooldowns, depth caps, bilingual narratives — all active during heartbeat ticks.
- **G3 was incomplete**: Player agency EXISTS via attunements (signature alignment, depth growth, magnitude reduction), anchors (cross-sim protection pooling), and bureau responses (contain/remediate/adapt). But all are **defensive/mitigating** — no offensive leveraging.
- **G2 was incomplete**: Scar tissue already amplifies susceptibility (`scar_susceptibility_multiplier = 0.50`). But there's no **hardening** (repeated exposure reducing vulnerability) or **adaptation** (susceptibility evolving based on player actions).

**Confirmed open findings:**
- **G1**: 1:1 category → archetype mapping is rigid (no multi-archetype events, no admin override at approval)
- **G2 (refined)**: No hardening/adaptation. Scars sensitize but nothing desensitizes.
- **G3 (refined)**: No offensive resonance leverage — all player tools are defensive
- **G4**: Event type selection from mapping is deterministic — always same 3 types per signature

**System touchpoints** (from exploration):
- `resonance_service.py` — impact processing, event spawning
- `narrative_arc_service.py` — cascade detection, convergence
- `heartbeat_service.py` — 12-phase tick orchestrator
- `operative_mission_service.py` — success probability with 3 resonance modifiers
- `bot_game_state.py` — bot resonance awareness + preferred operative selection
- `attunement_service.py`, `anchor_service.py`, `bureau_response_service.py` — player agency
- 6 SQL RPCs (078/080), 5 batch RPCs (133), cascade rules table (130)

---

## Variation A: "Chirurgische Präzision" — Minimale, gezielte Fixes

**Scope**: Fix only the 4 confirmed mechanical gaps. No new systems, no new tables. ~3-5 files changed, 1 migration.

### Changes

1. **G1 — Archetype Override bei Candidate Approval**
   - Add `archetype_override` field to `news_scan_candidates` table (nullable TEXT)
   - `ScannerService.approve_candidate()` passes override to `ResonanceService.create()` if set
   - DB trigger `fn_derive_resonance_fields()` respects pre-filled archetype/signature (already does — just don't override if non-NULL)
   - Frontend: Add dropdown in AdminScannerTab candidate approval row
   - **Files**: `scanner_service.py`, `AdminScannerTab.ts`, 1 migration (ALTER TABLE)

2. **G2 — Hardening via Attunement Depth**
   - When attunement depth > 0.5, reduce `resonance_profile` susceptibility for that signature by `depth * 0.15`
   - Implemented in `_process_simulation_impact()` alongside existing attunement reduction
   - No new tables, no new RPCs — pure Python logic in existing flow
   - **Files**: `resonance_service.py` (~10 LOC)

3. **G3 — Resonance Leverage: Aligned Operative Bonus Mission**
   - When deploying an aligned operative during active resonance, add a flat +0.05 "leverage bonus" if player explicitly opts in via `leverage_resonance: true` in deploy request
   - Risk: operative is exposed (if mission fails, operative is captured instead of just failing)
   - **Files**: `operative_mission_service.py`, `models/epoch.py`, `DeployOperativeModal.ts`

4. **G4 — Weighted Random Event Type Selection**
   - Replace `event_types[:3]` with weighted sample from 5-6 types per signature
   - Primary types (from mapping) get weight 3, secondary types get weight 1
   - Still deterministic seed from `resonance_id` for reproducibility
   - **Files**: `resonance_service.py`, `models/resonance.py` (extend DEFAULT_EVENT_TYPE_MAP)

### 4-Perspektiven-Analyse

**Architekt**: Sauberste Option. Keine neuen Tabellen, keine neuen Services. Alle Änderungen in bestehenden Flows. Risiko: fast null. Aber Attunement-Hardening in Python statt SQL widerspricht dem Muster "Postgres-Logik in Postgres". Der Leverage-Bonus ist ein Hack im Success-Probability-Calc statt ein eigenes System.

**Game Designer**: Löst die Symptome, aber nicht die Ursache. Archetype Override ist gut aber reaktiv — Admin muss manuell korrigieren. Hardening via Attunement ist elegant (belohnt langfristiges Engagement), aber der Effekt ist unsichtbar für den Spieler. Leverage ist risk/reward, aber +0.05 ist zu klein um strategisch relevant zu sein. Event-Type-Varianz ist nice-to-have, nicht game-changing.

**UX Designer**: Minimale UI-Änderungen. Archetype Override = 1 Dropdown. Leverage = 1 Toggle + Risiko-Warnung. Hardening hat null UI-Feedback — Spieler merkt nicht, dass Attunement auch Susceptibility senkt. Event-Varianz ist unsichtbar (Spieler sieht nur "ein neues Event", nicht welchen Typ).

**Researcher**: Hardening via Attunement ist psychologisch gut — es belohnt Geduld und strategische Voraussicht (Delayed Gratification). Leverage-Mechanik entspricht "Risk Homeostasis Theory" (Adams 1988) — Spieler wählen bewusst höheres Risiko für höhere Belohnung. Aber ohne sichtbares Feedback wird der Lerneffekt ausbleiben.

| Pro | Con |
|-----|-----|
| Minimal invasiv, schnell implementierbar (~1 Tag) | Hardening-Logik in Python statt Postgres |
| Kein neues System zu lernen | Leverage-Bonus zu klein für strategische Relevanz |
| Null Migrations-Risiko (1 ALTER TABLE) | Kein sichtbares Feedback für Spieler |
| Pattern-konform (bestehende Flows) | Löst Symptome, nicht Ursache der Rigidität |

---

## Variation B: "Strategische Tiefe" — Adaptive Susceptibility + Active Leverage

**Scope**: Susceptibility wird dynamisch (lernt aus Spieler-Aktionen). Leverage wird ein echtes taktisches System. ~8-10 files, 2 migrations, 1 neue Service-Methode.

### Changes

1. **G1 — Multi-Archetype Events via "Resonance Spectrum"**
   - Resonances können 1 primären + 0-1 sekundären Archetype haben
   - Add `secondary_archetype` + `secondary_signature` to `substrate_resonances`
   - Trigger derives primary; admin can set secondary at creation/approval
   - Impact processing spawns events from BOTH archetypes' event type pools
   - **Files**: Migration (ALTER TABLE + trigger update), `resonance_service.py`, `models/resonance.py`, `AdminResonanceFormModal.ts`

2. **G2 — Adaptive Susceptibility System**
   - New concept: **Resonance Memory** per simulation per signature
   - After each impact, record `(simulation_id, signature, tick_number, effective_magnitude)` in `resonance_memory` table
   - SQL RPC `fn_get_adaptive_susceptibility()` replaces `fn_get_resonance_susceptibility()`:
     - Base susceptibility from `resonance_profile`
     - **Hardening**: -0.05 per impact in last 10 ticks (max -0.25 reduction)
     - **Sensitization**: +0.10 per unmitigated impact (no bureau response, no attunement) in last 5 ticks (max +0.30)
     - **Scar amplification**: existing `scar_susceptibility_multiplier` stays
   - Net effect: actively defended simulations harden; neglected ones spiral
   - **Files**: Migration (new table + RPC), `resonance_service.py`, `attunement_service.py`

3. **G3 — "Resonance Operations" Leverage System**
   - New concept: During active resonance, players can launch **Resonance Ops** — special missions that exploit the substrate disturbance
   - 3 operation types:
     - **Surge Riding** (aligned operatives): +0.08 success, but if fails, double the resonance pressure on YOUR zones
     - **Substrate Tap** (any operative): Steal 1 RP from target sim's resonance event pool. Costs 2 RP.
     - **Cascade Accelerator** (saboteur only): Force-trigger the next cascade rule. Enormous strategic impact, but costs 5 RP and reveals your identity.
   - Implemented as an extension to `operative_mission_service.py` deploy flow
   - Bot awareness: bots can use Surge Riding when `resonance_aligned_types` match
   - **Files**: `operative_mission_service.py`, `bot_game_state.py`, `models/epoch.py`, `DeployOperativeModal.ts`, `EpochWarRoom.ts`

4. **G4 — AI-Selected Event Types**
   - Instead of deterministic mapping, pass the resonance context to AI and let it pick 2-3 event types from the full pool
   - AI considers: simulation theme, recent event history, current narrative arcs
   - Fallback: weighted random (same as Variation A)
   - **Files**: `resonance_service.py`, `generation_service.py`

### 4-Perspektiven-Analyse

**Architekt**: Sauber in der Konzeption. `resonance_memory` Tabelle ist ein natürliches Architektur-Pattern (Event Sourcing lite). Aber: die adaptive Susceptibility RPC wird komplex (3 Faktoren + 2 Zeitfenster + Cap-Logik). Ein einzelner SQL-Fehler kann das gesamte Susceptibility-System brechen. Resonance Ops im Deploy-Flow ist eine saubere Extension (neues `operation_type` Feld im Request), aber die "double pressure on YOUR zones"-Strafe erfordert einen Rückkanal in den Heartbeat, der heute nicht existiert.

**Game Designer**: Das ist die Variation, die das Spiel am meisten bereichert. Adaptive Susceptibility schafft emergentes Verhalten: vernachlässigte Simulationen werden zu "Resonance Magnets" (attrahieren mehr Impact), was andere Spieler zwingt einzugreifen. Resonance Ops geben Spielern aktive Werkzeuge statt nur reaktiver Verteidigung. Surge Riding ist risk/reward-elegant. Cascade Accelerator ist der "Atombombe"-Button — sehr teuer, aber narrativ spektakulär. Problem: 5 RP für einen Cascade Trigger ist entweder zu billig (gamebreaking) oder zu teuer (wird nie genutzt). Balancing wird schwierig.

**UX Designer**: Resonance Ops braucht prominente UI — ein eigener Tab oder Abschnitt im War Room. Die 3 Ops-Typen mit Risk-Badges, Kosten-Anzeige und Fog-of-War für die Strafe. Adaptive Susceptibility muss als "Resonance Resilience" Gauge sichtbar sein (nicht versteckt wie in Variation A). Multi-Archetype braucht ein zweites Archetype-Badge auf der ResonanceCard.

**Researcher**: Adaptive Susceptibility folgt dem "Hormesis"-Prinzip aus der Toxikologie: moderate Belastung stärkt, übermäßige schwächt. Psychologisch interessant: Spieler die investieren werden belohnt (Hardening), Spieler die ignorieren werden bestraft (Sensitization). Das erzeugt "Learned Industriousness" (Eisenberger 1992). Cascade Accelerator ist ein "Kingmaker Mechanic" — kann in Multiplayer-Settings toxisch sein.

| Pro | Con |
|-----|-----|
| Echte strategische Tiefe, emergentes Verhalten | Signifikanter Scope (~5-7 Tage) |
| Adaptive Susceptibility belohnt/bestraft sinnvoll | Balancing der Resonance Ops kritisch |
| Resonance Ops füllen die "aktive Leverage"-Lücke | Cascade Accelerator potenziell gamebreaking |
| AI-Event-Types = mehr Emergenz + Variation | Neue Tabelle + komplexe RPC = Wartungsaufwand |
| Bot-Awareness-Integration natürlich | UX-Aufwand für War Room Extension |

---

## Variation C: "Lebendiges Substrat" — Emergente Ökologie

**Scope**: Das Substrat wird ein eigenständiges, atmendes System. Resonances interagieren miteinander, mutieren, und erzeugen emergente Narrative. ~12-15 files, 3-4 migrations, 2 neue Services.

### Changes

1. **G1 — "Resonance Fusion": Archetypes verschmelzen**
   - Wenn 2+ Resonances gleichzeitig `impacting` sind UND ihre Archetypes in den Cascade Rules verknüpft sind → automatische Fusion zu einem "Compound Archetype"
   - Compound Archetypes haben eigene Event-Pools, eigene Operative-Alignments, eigene Narrative
   - Beispiel: `economic_tremor` + `authority_fracture` gleichzeitig → "The Ruin" (compound) — spawnt `[crisis, intrigue, military, social]` events
   - 8 Compound Archetypes (aus den 8 Cascade Rule Paaren)
   - **Files**: New `compound_archetype_service.py`, migration (compound_archetypes table + seed), `resonance_service.py`, `narrative_arc_service.py`

2. **G2 — "Substrate Memory": Simulationen entwickeln Resonance DNA**
   - Jede Simulation entwickelt über die Zeit eine "Resonance DNA" — ein Profil das aus vergangenen Impacts lernt
   - Hardening + Sensitization + Mutation (wenn eine Signature oft getroffen wird, beginnt sie in andere Signatures zu "bluten")
   - DNA wird bei jedem Heartbeat Tick aktualisiert (Phase 3 extension)
   - DNA beeinflusst: Susceptibility, Event-Type-Pools, Agent Moods, Zone Descriptions
   - **Files**: New `substrate_memory_service.py`, migration (substrate_memory table), `heartbeat_service.py` Phase 3 extension

3. **G3 — "Substrate Rituale": Player-initiierte Resonance-Aktionen**
   - Players können "Rituale" durchführen — kollaborative Aktionen die das Substrat beeinflussen:
     - **Resonance Attenuation Ritual**: 3+ Spieler opfern je 2 RP → reduziert active Resonance magnitude um 0.15
     - **Cascade Redirect Ritual**: 2+ Spieler wählen gemeinsam Ziel-Simulation für nächsten Cascade → statt zufällig
     - **Substrate Communion Ritual**: 1 Spieler mit max Attunement Depth → generiert Prophezeiung (AI) über nächste Resonance
   - Implemented as new Router + Service
   - **Files**: New `substrate_ritual_service.py`, new `routers/substrate_rituals.py`, migration, new frontend component

4. **G4 — "Narrative Weaving": Events werden zu Geschichten**
   - Resonance Events werden nicht einzeln gespawnt, sondern als zusammenhängende Narrative Arcs
   - Der AI-Generator bekommt den GESAMTEN Kontext (aktive Arcs, vergangene Events, Simulation DNA) und generiert einen kohärenten 3-Event-Bogen
   - Jeder Bogen hat: Inciting Incident → Escalation → Resolution/Cliffhanger
   - **Files**: `resonance_service.py` major refactor, `generation_service.py`, new prompt templates

### 4-Perspektiven-Analyse

**Architekt**: Riskant. 2 neue Services, 1 neue Router, 3-4 Migrations. Die Compound-Archetype-Logik ist eine neue Abstraktionsschicht über dem bestehenden Archetype-System — potenzielle Quelle von Inkonsistenz. Substrate Memory als eigene Tabelle mit Heartbeat-Phase-Integration ist architektonisch sauber (folgt dem Phase-Pattern), aber die "Mutation" (Signature Bleeding) ist eine nicht-deterministische Logik die Testing extrem schwierig macht. Substrate Rituale als kollaborative Multi-Player-Aktion erfordern Concurrency-Handling das heute nicht existiert (kein Realtime Channel für Ritual-Koordination).

**Game Designer**: Das ambitionierteste Design. Compound Archetypes schaffen echte Emergenz — Spieler lernen "wenn Tower und Overthrow gleichzeitig aktiv sind, kommt The Ruin". Substrate Rituale geben Spielern echte Macht über das Substrat, aber die RP-Kosten müssen brutal balanciert werden. Prophecy via Substrate Communion ist narrativ brilliant — der Spieler mit höchster Attunement wird zum Orakel. Narrative Weaving ist der heilige Gral der prozeduralen Erzählung. Problem: die Komplexität kann das System unlesbar machen. Wenn 3 Compound Archetypes, 2 Cascades und 1 Ritual gleichzeitig aktiv sind, versteht niemand mehr was passiert.

**UX Designer**: Braucht ein komplett neues "Substrate Dashboard" — nicht nur der Monitor. Compound Archetypes brauchen eigene Ikonographie + Animation. Rituale brauchen einen kollaborativen UI-Flow (Wartescreen, Bestätigung, Countdown). Prophecy braucht ein theatralisches Reveal. Die Informationsdichte wird problematisch — wie erklärt man einem neuen Spieler was "The Ruin" ist? Tutorial-Content notwendig.

**Researcher**: Compound Archetypes folgen Jungs Konzept der "Complexes" — Archetypen die verschmelzen und eigene Psychodynamik entwickeln. Narrativ kohärent. Substrate Memory ist eine Spielmechanik-Version von "Epigenetics" — Erfahrungen verändern die genetische Expression. Rituale sind "Collective Action Problems" (Olson 1965) — funktionieren nur wenn alle mitmachen, was Kooperation erzwingt. Risiko: "Analysis Paralysis" durch zu viele interagierende Systeme.

| Pro | Con |
|-----|-----|
| Echte Emergenz, das Substrat "lebt" | Enormer Scope (~15-20 Tage) |
| Compound Archetypes narrativ brilliant | Komplexitätsexplosion für Spieler + Entwickler |
| Rituale = echte kollaborative Mechanik | Realtime-Koordination nicht implementiert |
| Narrative Weaving = S-Tier Storytelling | Balancing nahezu unmöglich vorab |
| Einzigartig — kein anderes Spiel hat das | Testing/QA-Aufwand proportional zur Komplexität |

---

## Variation D: "Resonance Warfare" — Kompetitives Substrat

**Scope**: Das Substrat wird zur Waffe. Spieler können Resonances gezielt gegen andere Simulationen einsetzen. Epoch-fokussiert. ~10-12 files, 2-3 migrations, 1 neuer Service.

### Changes

1. **G1 — "Archetype Targeting": Spieler wählen den Archetype**
   - Während Epochs können Spieler eine "Substrate Manipulation" durchführen: sie wählen eine aktive Resonance und "re-tune" ihren Archetype für die Ziel-Simulation
   - Beispiel: Eine natural_disaster Resonance (normalerweise The Deluge) wird via Manipulation zu The Tower für Simulation X — dort crashed die Wirtschaft statt Überschwemmung
   - Kosten: 4 RP + 1 spezifischer Operative-Typ
   - Counter: Attunement Depth > 0.5 zum Archetype verhindert Re-Tuning
   - **Files**: `operative_mission_service.py` extension, `resonance_service.py`, migration (resonance_overrides table)

2. **G2 — "Resonance Arms Race": Susceptibility als Ressource**
   - Spieler können die eigene Susceptibility bewusst hochsetzen (Sensitization) um offensive Resonance Ops zu verstärken
   - Trade-off: höhere eigene Verwundbarkeit = stärkere ausgehende Resonance Effekte
   - "Resonance Doctrine" Setting pro Epoch-Teilnehmer: defensive (low susceptibility) vs offensive (high susceptibility)
   - **Files**: `epoch_participant` extension, `operative_mission_service.py`, `bot_game_state.py`

3. **G3 — "Resonance Weapons": 4 offensive Ops**
   - **Substrate Spike**: Injiziere Extra-Magnitude (+0.20) in eine aktive Resonance für Ziel-Simulation. 3 RP.
   - **Resonance Redirect**: Lenke nächsten Cascade-Trigger auf eine spezifische Ziel-Simulation. 4 RP.
   - **Archetype Inversion**: Für 2 Ticks werden aligned/opposed Operative-Typen vertauscht in Ziel-Sim. 5 RP.
   - **Substrate Blackout**: Blockiere ALLE Resonance-Modifier für Ziel-Sim für 3 Ticks. Nullifies attunements + anchors. 6 RP. Einmal pro Epoch.
   - **Files**: New `resonance_warfare_service.py`, `operative_mission_service.py`, `bot_game_state.py`, `EpochWarRoom.ts`

4. **G4 — "Chaos Events": Unvorhersehbare Event-Spawns**
   - Bei Magnitude > 0.8: 20% Chance auf "Chaos Event" — komplett zufälliger Typ aus allen 15+ Event-Types
   - Chaos Events haben höheren Impact (1.5x) aber kürzere Duration (1 tick statt 4)
   - Erzeugt Überraschungsmomente die Strategien durcheinanderbringen
   - **Files**: `resonance_service.py`, migration (chaos_event_history table)

### 4-Perspektiven-Analyse

**Architekt**: Das `resonance_overrides` Pattern (G1) ist architektonisch riskant — es schafft eine zweite Ebene über der Trigger-Derivation. Der Trigger setzt Archetype A, dann überschreibt Python es mit Archetype B → zwei Quellen der Wahrheit. Besser wäre ein `archetype_override` direkt in `resonance_impacts` (per Simulation), nicht in der Resonance selbst. Die "Resonance Doctrine" (G2) als Epoch-Participant-Extension ist sauber — `epoch_participants` hat schon viele Flags. Resonance Weapons als eigener Service folgt dem bestehenden Service-Pattern. Substrate Blackout ist ein Null-All-Modifiers-Effekt der in 3 verschiedenen SQL RPCs geprüft werden muss — fragile Implementierung.

**Game Designer**: Die aggressivste Variation. Macht Resonances zum zentralen Wettbewerbsmechanismus. Substrate Spike ist simpel aber effektiv. Resonance Redirect ist strategisch tief (lenke den Cascade auf deinen Feind). Archetype Inversion ist "confusion" aus RPGs — temporär die Regeln umdrehen. Substrate Blackout ist der nukleare Option — blockiert ALLES. Problem: "Feel-bad" Mechaniken. Wenn jemand deine Attunements und Anchors mit einem Blackout auslöscht, das du über 10 Ticks aufgebaut hast, ist das frustrierend. PvP-Resonance-Warfare kann toxisch werden. Braucht starke Cooldowns und Counterplay.

**UX Designer**: Braucht ein "Warfare Panel" im War Room mit klaren Kosten/Risiko-Anzeigen. Archetype Inversion braucht einen prominent sichtbaren "INVERTED"-Status auf allen betroffenen UIs. Substrate Blackout braucht eine dramatische Full-Screen-Animation (der Monitor geht aus). Die RP-Kosten müssen sofort sichtbar sein — kein Player sollte versehentlich 6 RP ausgeben. Defensive Spieler brauchen Frühwarnung ("Substrate Manipulation detected in your sector").

**Researcher**: Resonance Warfare folgt "Asymmetric Warfare" Theorie — die Fähigkeit, das Schlachtfeld selbst zu manipulieren statt nur Truppen zu bewegen. Historisches Vorbild: Wirtschaftssanktionen als "substrate manipulation" der realen Geopolitik. Archetype Inversion ist eine "Confusion" Mechanik aus Tabletop RPGs (D&D 5e: *Confusion* spell). Substrate Blackout folgt der "Denial of Service" Doktrin. Risiko: "Grief Potential" — Spieler nutzen Warfare-Tools nicht strategisch sondern um andere Spieler zu frustrieren.

| Pro | Con |
|-----|-----|
| Resonances werden strategisch zentral | Feel-bad Mechaniken (Blackout löscht Investment) |
| Hohe Interaktion zwischen Spielern | PvP-Toxizität Risiko |
| 4 Ops mit klarem Kosten/Nutzen-Profil | Architektonisch fragil (Override-Ebene, 3 RPCs) |
| Chaos Events = Überraschung/Spannung | Balancing EXTREM schwierig |
| Bot-Integration natürlich (offense/defense doctrine) | Scope ~8-12 Tage + extensive Playtesting |

---

## Vergleichsmatrix

| Dimension | A: Chirurgisch | B: Strategisch | C: Lebendig | D: Warfare |
|-----------|---------------|----------------|-------------|------------|
| **Scope** | ~1-2 Tage | ~5-7 Tage | ~15-20 Tage | ~8-12 Tage |
| **Migrations** | 1 (ALTER) | 2 (ALTER + TABLE) | 3-4 | 2-3 |
| **Neue Services** | 0 | 0 | 2-3 | 1 |
| **Architektur-Risiko** | Niedrig | Mittel | Hoch | Mittel-Hoch |
| **Balancing-Risiko** | Niedrig | Mittel | Hoch | Sehr Hoch |
| **Emergenz** | Minimal | Moderat | Maximal | Hoch (PvP) |
| **Player Agency** | Inkrementell | Signifikant | Transformativ | Aggressiv |
| **Narrative Tiefe** | Gleich | Besser | Excellent | Anders (kompetitiv) |
| **Toxizitäts-Risiko** | Null | Niedrig | Niedrig | Hoch |
| **Pattern-Konformität** | A+ | A | B+ | B |

## Empfehlung

**Variation B ("Strategische Tiefe")** bietet den besten Tradeoff: signifikante Verbesserung der Spieltiefe bei vertretbarem Scope und Risiko. Die adaptive Susceptibility und Resonance Ops sind architektonisch sauber implementierbar im bestehenden Pattern-Framework.

**Phasenweise Umsetzung** (empfohlen):
1. **Phase 1** (aus A): G1 Archetype Override + G4 Weighted Random (1 Tag)
2. **Phase 2** (aus B): Adaptive Susceptibility + Resonance Memory (2-3 Tage)
3. **Phase 3** (aus B): Resonance Ops (Surge Riding, Substrate Tap) (2-3 Tage)
4. **Phase 4** (aus C, optional): Compound Archetypes, wenn Phase 1-3 gut funktionieren

Elemente aus D (Resonance Warfare) nur nach extensivem Playtesting von B.

## Critical Files

| File | Changes |
|------|---------|
| `backend/services/resonance_service.py` | Adaptive susceptibility, event type variance, leverage hooks |
| `backend/services/operative_mission_service.py` | Resonance Ops deploy extension |
| `backend/services/narrative_arc_service.py` | Already implements cascades (no changes needed for Phase 1-2) |
| `backend/services/bot_game_state.py` | Resonance Ops awareness for bots |
| `backend/models/resonance.py` | Extended event type map, new request models |
| `backend/models/epoch.py` | Resonance Ops request extension |
| `supabase/migrations/` | 2-3 new migrations (alter candidates, resonance_memory table, RPC) |
| `frontend/src/components/admin/AdminScannerTab.ts` | Archetype override dropdown |
| `frontend/src/components/epoch/DeployOperativeModal.ts` | Resonance Ops UI |
| `frontend/src/components/epoch/EpochWarRoom.ts` | Resonance Ops panel |
| `frontend/src/utils/resonance-labels.ts` | New compound labels if Phase 4 |

## Verification

- Unit tests for adaptive susceptibility RPC (hardening + sensitization bounds)
- Unit tests for weighted event type selection (distribution, reproducibility)
- E2E playtest via WebMCP: create resonance → process impact → verify adaptive susceptibility changes
- Bot playtest: verify bots use Resonance Ops when aligned
- Epoch playtest: full game with Resonance Ops enabled, check balance
