---
title: "MUD Combat & Gameplay Feasibility Analysis"
version: "1.0"
date: "2026-03-27"
type: concept
status: draft
lang: de
tags: [game-design, mud, combat, realtime, supabase, feasibility, spells, abilities]
---

# MUD Combat & Gameplay: Feasibility-Analyse und Designempfehlungen

> Perspektiven: Senior Game Designer, MUD Design Specialist, Supabase Realtime Developer

---

## Teil 1: Bewertung der 5 Adventure-Konzepte

### Bewertungsmatrix

| Konzept | Umsetzbarkeit | Spielerinteresse | Technische Komplexitat | Nutzung bestehender Systeme | Empfehlung |
|---|---|---|---|---|---|
| **1. Breach Operations** | Mittel | Sehr hoch | Hoch (Cross-Sim, Echtzeit-PvPvE) | Hoch (Embassies, Bleed, Aptitudes) | Phase 2 |
| **2. Resonance Dungeons** | Mittel-Hoch | Hoch | Mittel (8 Dungeon-Typen, prozedurale Generierung) | Sehr hoch (Resonances, Personality, Heartbeat) | Phase 2-3 |
| **3. Echo Expeditions** | Hoch | Mittel | Niedrig (async, kein Echtzeit-Kampf) | Sehr hoch (Echoes, Events, Memories) | Phase 3 |
| **4. War Room Operations** | Sehr hoch | Sehr hoch | Mittel (erweitert bestehendes Epoch-System) | Maximal (Epochs, Operatives, RP, Alliances) | **Phase 1** |
| **5. Living Labyrinth** | Mittel | Hoch (Nischen-Appeal) | Hoch (Memory-basierte Generierung, LLM-Dialog) | Maximal (Memories, Opinions, Needs, Arcs) | Phase 2-3 |

### Detailbewertung

#### War Room Operations — PHASE 1 EMPFEHLUNG

**Warum zuerst:** Es baut direkt auf dem existierenden, produktionsreifen Epoch-System auf. Die `RealtimeService` mit Broadcast-Channels, Presence-Tracking, und Ready-State-Voting ist bereits da. Die 6 Operative-Typen definieren bereits die 6 Operations-Typen. Das RP-Budget existiert. Die Battle-Log-Infrastruktur existiert. Es ist die kleinste Brucke zwischen "was wir haben" und "instanziertes Abenteuer."

**Technisch:** Die bestehenden Epoch-Broadcast-Channels (`epoch:{id}:status`) konnen um Combat-Events erweitert werden. Der Ready-State-Mechanismus ist exakt das Pattern fur phasenbasierten Kampf ("alle haben gewahlt → Resolution"). Kein neues Realtime-System notig.

**Spielerinteresse:** Direkte Auswirkung auf den Epoch-Score ist der starkste Motivator. Spieler, die bereits Epochs spielen, haben sofort einen Grund, War Room Ops zu nutzen.

**Risiko:** Niedrig. Schlimmstenfalls: ein neuer Terminal-Modus mit 6 Missionstypen. Bestenfalls: der Game-Changer fur Epoch-Engagement.

#### Breach Operations — PHASE 2

**Warum nicht zuerst:** Cross-Simulation-Zugriff in Echtzeit erfordert signifikante Backend-Architektur (Berechtigungen, Instanzierung, State-Management uber Simulationsgrenzen). Die Embassy-Infrastruktur existiert, aber die "verzerrte Version einer fremden Simulation" braucht Content-Generierung.

**Spielerinteresse:** Extrem hoch. EVE-Wormhole-Mechanik in einem Text-Game ist einzigartig. Der "Invade another player's world"-Fantasy ist universell ansprechend.

**Technisch:** Braucht: `breach_instances` Tabelle, Cross-Sim-Berechtigung, Alert-Level-Tracking, Room-State-Management. Aufwand: 3-4 Wochen Backend + 2-3 Wochen Frontend.

#### Resonance Dungeons & Living Labyrinth — PHASE 2-3

**Resonance Dungeons** sind inhaltlich reich (8 verschiedene Dungeon-Typen), brauchen aber signifikantes Content-Design (Raum-Templates, Gegner-Typen, Puzzle-Logik pro Archetype). Prozedurale Generierung reduziert den manuellen Aufwand, erfordert aber robuste Generierungs-Algorithmen.

**Living Labyrinth** ist das innovativste Konzept, aber auch das riskanteste. Die Abhangigkeit von Agent-Memory-Daten fur Raum-Generierung ist technisch faszinierend, aber schwer zu testen und zu balancen. Empfehlung: als Feature fur Spieler mit hochentwickelten Simulationen (viele Agenten, tiefe Memories, aktive Narrative Arcs).

#### Echo Expeditions — PHASE 3

**Warum zuletzt:** Am wenigsten "aufregend" fur den Sofort-Impact. Die asynchrone Natur (2-5 Tage) passt schlecht zum "Action-Abenteuer"-Wunsch. Allerdings ist es technisch am einfachsten (erweitert bestehende Heartbeat-Logik, kein Echtzeit-Kampf) und bietet eine einzigartige strategische Tiefe.

**Am besten als:** Erganzung zu den anderen Konzepten. "Zwischen den Dungeon-Runs kann ich eine Expedition laufen lassen."

---

## Teil 2: Das Kampfsystem — Fundamentale Design-Entscheidungen

### Die Kernfrage: Echtzeit oder Phasenbasiert?

#### Warum NICHT 1-Sekunden-Echtzeit-Ticks

| Argument | Detail |
|---|---|
| **Text braucht Lesezeit** | Bei 1s Ticks konnen Spieler die Ausgabe nicht lesen. Achaea-Veteranen brauchen Scripting-Clients (Mudlet, Nexus) um mitzuhalten — das ist ein Design-Failure fur moderne Spieler |
| **Mobile-Inkompatibilitat** | Durchschnittliche Mobile-Session: 4-5 Minuten. Tippen auf Mobile ist 3-5x langsamer als Desktop. 1s-Ticks sind auf Mobile unspielbar |
| **Accessibility-Katastrophe** | Screen-Reader brauchen 2-5 Sekunden pro Textblock. Blinde Spieler (oft 50% der MUD-Community!) sind bei 1s-Ticks komplett ausgeschlossen |
| **Spam-Problem** | Das #1 Problem in MUD-Combat: zu viele Nachrichten, zu schnell. Selbst Achaea-Fans klagen uber "dozens of sentences per second" |
| **Supabase-Kosten** | 1s Ticks × 50 Kampfe × 4 Spieler × Messages = ~200 msg/s. Auf Pro-Plan machbar (500 msg/s Limit), aber teuer und fragil bei Lastspitzen |

#### Warum PHASENBASIERTER KAMPF die richtige Wahl ist

| Argument | Detail |
|---|---|
| **Bewahrtes Pattern** | Frozen Synapse, Into the Breach, Diplomacy — alle nutzen simultane Phasen-Resolution. "Almost like chess with guns — slow, methodical, and extremely satisfying when a plan comes together" |
| **Passt zum bestehenden System** | Der Epoch-Ready-State-Mechanismus IST bereits phasenbasierter Kampf: "alle wahlen → Resolution → nachste Phase." Das Pattern ist implementiert und getestet |
| **Lesbar** | Spieler haben 15-30 Sekunden zum Lesen, Planen, Entscheiden. Kein Spam |
| **Mobile-freundlich** | Quick-Action-Buttons statt Tippen. 30s Planning-Phase ist auf Mobile komfortabel |
| **Accessible** | Screen-Reader konnen den Zustand in Ruhe vorlesen. Motor-impaired Spieler haben genug Zeit |
| **Async-kompatibel** | Timer von 30s auf Stunden hochdrehen = asynchroner Kampf fur Casual-Spieler. Null zusatzlicher Code |
| **Multiplayer-trivial** | Simultane Resolution eliminiert das "wer war schneller?"-Problem komplett |

### Empfohlener Kampfzyklus

```
PHASE 1: ASSESSMENT (automatisch, 3-5 Sekunden)
┌─────────────────────────────────────────────────────┐
│ Kampfzustand wird angezeigt:                        │
│ - Agenten-Status (Condition, Stress, aktive Buffs)  │
│ - Gegner-Intentionen (telegraphiert, Into the Breach│
│   Stil: "Enemy Saboteur will target your comms")    │
│ - Umgebungsbedingungen (Zone Security, aktive Events│
│ - Verfugbare Aktionen (Quick-Action Buttons)        │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
PHASE 2: PLANNING (15-30 Sekunden, mit Timer)
┌─────────────────────────────────────────────────────┐
│ Spieler wahlt Aktionen fur jeden Agenten:            │
│ - Quick-Action Buttons (primare Interaktion)        │
│ - Typed Commands (fur Power-User)                   │
│ - Timer-Bar sichtbar (Hearthstone-Rope-Pattern)     │
│ - Auto-Defend bei Timeout                           │
│ - Jede Aktion resets Timer (Anti-AFK)               │
│                                                     │
│ Bei Multiplayer: alle Spieler planen gleichzeitig   │
│ Ready-Button wenn fertig (bestehendes Pattern!)     │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
PHASE 3: RESOLUTION (automatisch, 5-8 Sekunden)
┌─────────────────────────────────────────────────────┐
│ Alle Aktionen resolven simultan:                    │
│ - Narrative Kampfbeschreibung (LLM oder Template)   │
│ - Mechanische Ergebnisse (Aptitude-Checks)          │
│ - Status-Updates (Stress, Mood, Conditions)         │
│ - Umgebungsanderungen                               │
│ - Dramatische Pause zwischen Aktionen               │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
PHASE 4: OUTCOME (automatisch, 2-3 Sekunden)
┌─────────────────────────────────────────────────────┐
│ Aktualisierter Zustand:                             │
│ - Agenten-Gauges (Stress-Bar, Condition-Track)      │
│ - Neue Bedingungen/Buffs/Debuffs                    │
│ - Gegner-Status                                     │
│ - "Runde X von ~Y" Fortschrittsanzeige              │
└─────────────────────────────────────────────────────┘
                         │
                    Loop oder Ende

Gesamt pro Runde: 25-45 Sekunden
Typischer Kampf: 3-5 Runden = 2-4 Minuten
Maximum: 8 Runden = ~6 Minuten
```

### Warum 3-5 Runden optimal sind

- **D&D-Forschung:** Encounters uber 30 Minuten verlieren Engagement rapide. 15-20 Minuten ist das Sweet Spot fur Tabletop-Kampf
- **MUD-Forschung:** Text-Combat-Fatigue setzt nach ~5-7 Minuten ein bei moderatem Tempo
- **Mobile-Sessions:** 4-5 Minuten Durchschnitt. Ein Kampf muss in eine Session passen
- **"Mop-up Problem":** Kampfe, die entschieden sind aber weitergehen, sind der #1 Engagement-Killer. 3-5 Runden vermeiden das

---

## Teil 3: Das Ability-System — Von Aptitudes zu "Spells"

### Grundprinzip: Verb+Noun Kombinatorik (Ars Magica Pattern)

Statt hunderte individuelle Spells zu designen, nutzen wir das **Ars Magica Verb+Noun-System**: Die 6 Aptitudes sind die "Verben" (WAS der Agent tut), kombiniert mit "Domains" (WO/WORAN er es tut). Jede Kombination ergibt eine kontextuelle Ability.

### Die 6 Ability Schools (= 6 Aptitudes)

Jede Aptitude ist eine "Spell School" mit eigener taktischer Identitat:

#### SPY SCHOOL: "Intelligence Operations"
**Identitat:** Information als Waffe. Wissen, was der Gegner vorhat, bevor er es tut.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 (Basis) | Erkennt offensichtliche Fallen/Hinterhalte | **Observe**: Enthullt Gegner-Intentionen fur nachste Runde (+10% Dodge fur Party) |
| 5-6 (Kompetent) | Erkennt versteckte Gegner, identifiziert Schwachstellen | **Analyze**: Enthullt Gegner-Stats. **Counter-Intel**: Negiert eine gegnerische Spy-Ability |
| 7-8 (Expert) | Auto-Detect von Infiltratoren, perfekte Gegner-Intention-Vorschau | **Exploit Weakness**: Markiert Ziel (+30% Schaden von Assassin-Abilities). **Intercept**: Stiehlt gegnerische Buffs |
| 9 (Meister) | Allwissenheit im Kampfraum | **Omniscience**: Alle gegnerischen Aktionen fur 2 Runden im Voraus sichtbar. Einmal pro Kampf |

**Personality-Modifier:**
- Hohe Openness = Analyze enthullt mehr Details (Needs, Mood, versteckte Abilities)
- Hohe Conscientiousness = Counter-Intel hat hohere Erfolgsrate
- Niedrige Extraversion = Spy-Passives wirken leiser (Gegner merkt nicht, dass er beobachtet wird)

#### GUARDIAN SCHOOL: "Protective Operations"
**Identitat:** Die unuberwindbare Mauer. Schutzt die Party, kontrolliert den Raum.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 | -10% Schaden fur sich selbst | **Shield**: Absorbiert 50% des Schadens eines Verbundeten fur diese Runde |
| 5-6 | -15% Schaden + Threat-Magnet (Gegner fokussieren Guardian) | **Fortify**: +30% Verteidigung fur gesamte Party, 1 Runde. **Intercept**: Springt vor einen Verbundeten, nimmt vollen Schaden |
| 7-8 | -20% Schaden + Auto-Intercept bei kritischen Treffern | **Iron Wall**: Immunitat gegen einen Angriff (aber Agent kann nicht angreifen). **Rally**: Reduziert Party-Stress um 50 |
| 9 | -25% + reflektiert 25% des absorbierten Schadens | **Absolute Defense**: Party ist fur 1 Runde immun. Einmal pro Kampf. Guardian erleidet den gesamten absorbierten Schaden |

**Personality-Modifier:**
- Hohe Agreeableness = Shield/Intercept haben grossere Reichweite (schutzt auch entfernte Verbundete)
- Hohe Conscientiousness = Fortify halt 2 statt 1 Runde
- Niedriger Neurotizismus = Rally reduziert mehr Stress

#### SABOTEUR SCHOOL: "Disruption Operations"
**Identitat:** Chaos-Ingenieur. Verandert das Schlachtfeld, macht dem Gegner das Leben schwer.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 | Erkennt Umgebungs-Interaktionen | **Disrupt**: Deaktiviert eine gegnerische Ability fur 1 Runde. **Trap**: Platziert Falle (losen beim nachsten Gegner-Move aus, +Stress) |
| 5-6 | Schwachstellen-Scan der Umgebung | **Sabotage**: Senkt Gegner-Aptitude um 1 fur 2 Runden. **Environmental Hazard**: Erzeugt Zone-Condition (z.B. "compromised comms" = -20% auf Propagandist-Abilities) |
| 7-8 | Auto-Trap bei Kampfbeginn | **Chain Reaction**: Wenn ein Gegner eine Falle auslost, lost die nachste auch aus. **Overload**: Gegner-Buffs werden zu Debuffs (riskant: 30% Chance auf Backfire) |
| 9 | Umgebung ist eine Waffe | **Total Disruption**: Alle Gegner-Passives deaktiviert fur 2 Runden. Einmal pro Kampf |

**Personality-Modifier:**
- Hohe Openness = Mehr kreative Trap-Varianten verfugbar
- Niedriger Neurotizismus = Overload-Backfire-Chance sinkt auf 15%
- Hohe Conscientiousness = Traps tun 50% mehr Schaden (prazise platziert)

#### PROPAGANDIST SCHOOL: "Psychological Operations"
**Identitat:** Mind-Game-Spezialist. Greift Morale an, inspiriert Verbundete, manipuliert Verhalten.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 | Liest Gegner-Mood | **Demoralize**: Ziel-Stress +100, Mood -10. **Inspire**: Verbundeter Mood +15, Stress -50 |
| 5-6 | Erkennt Gegner-Needs-Schwachstellen | **Exploit Fear**: Wenn Gegner-Safety < 30, Panik-Effekt (verliert 1 Aktion). **Rallying Speech**: Party-weite Stress-Reduktion -75 |
| 7-8 | Auto-Demoralize auf schwachsten Gegner pro Runde | **Turn Coat**: Versucht, schwachen Gegner (Stress > 600) zum Uberlaufen zu bewegen. **Disinformation**: Gegner sieht falsche Intentionen der Party |
| 9 | Gegner-Morale sinkt jede Runde automatisch | **Breaking Point**: Zwingt Gegner mit Stress > 800 zum sofortigen Aufgeben. Einmal pro Kampf |

**Personality-Modifier:**
- Hohe Extraversion = Alle Broadcast-Abilities (Demoralize, Inspire, Rally) haben +30% Reichweite
- Hohe Agreeableness = Inspire-Effekte sind starker, aber Demoralize schwacher
- Niedrige Agreeableness = Umgekehrt: Demoralize starker, Inspire schwacher

#### INFILTRATOR SCHOOL: "Covert Operations"
**Identitat:** Der Unsichtbare. Positionierung, Timing, den perfekten Moment abwarten.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 | -15% Chance, Ziel eines Angriffs zu sein | **Stealth**: Unsichtbar fur 1 Runde (kein Ziel fur Angriffe). **Reposition**: Wechselt Position mit einem Verbundeten |
| 5-6 | -25% Target-Chance + erster Angriff aus Stealth hat +20% | **Bypass**: Ignoriert Guardian-Schutz bei nachstem Angriff. **Disguise**: Erscheint als Verbundeter fur Gegner (verwirrt Ziel-Auswahl) |
| 7-8 | Auto-Stealth wenn Stress < 200 | **Shadow Strike**: Aus Stealth: +50% Damage + Gegner verliert nachste Aktion. **Extraction**: Zieht einen verwundeten Verbundeten aus dem Kampf (Safety-Net) |
| 9 | Permanent semi-unsichtbar (-40% Target-Chance) | **Phantom**: 3 Runden totale Unsichtbarkeit + jeder Angriff aus Phantom ist kritisch. Einmal pro Kampf |

**Personality-Modifier:**
- Niedrige Extraversion = Stealth-Dauer +1 Runde (still und zuruckhaltend)
- Hohe Conscientiousness = Bypass-Prazision hoher
- Hohe Openness = Disguise erzeugt mehr Verwirrung (kreative Identitaten)

#### ASSASSIN SCHOOL: "Elimination Operations"
**Identitat:** Ein Schuss, ein Treffer. Maximaler Schaden an einzelnen Zielen.

| Aptitude Level | Passive Fahigkeit | Aktive Abilities |
|---|---|---|
| 3-4 | +10% Kritische-Treffer-Chance | **Precision Strike**: Hoher Einzelziel-Schaden. **Exploit Weakness**: +30% Schaden auf markierte Ziele (Spy-Combo) |
| 5-6 | +15% Krit + Schwachstellen-Erkennung | **Ambush**: Wenn Gegner nicht angreift, doppelter Schaden. **Poison**: DoT (Damage over Time), Gegner verliert jede Runde Condition |
| 7-8 | +20% Krit + Auto-Target auf schwachsten Gegner | **Execute**: Wenn Gegner unter 25% Condition, sofortiges KO. **Vanish**: Nach erfolgreichem Kill: frei Stealth (Infiltrator-Combo) |
| 9 | +25% Krit + jeder Krit ist doppelt | **Deathmark**: Garantierter Kill nach 3 Runden, egal was. Kann nur durch vollstandiges Ausschalten des Assassins verhindert. Einmal pro Kampf |

**Personality-Modifier:**
- Niedriger Neurotizismus = Krit-Chance +5% (ruhige Hand)
- Niedrige Agreeableness = Execute-Schwelle bei 30% statt 25% (kaltblutig)
- Hohe Conscientiousness = Poison-Schaden +25% (prazise Dosierung)

### Ability-Count pro Agent: Die goldene Mitte

Basierend auf Forschung (Slay the Spire Handgrose 5, SWTOR effektiv ~8, MUD-Tradition 100+ aber Scripting-pflichtig):

**Pro Agent im Kampf:**
- 2 Passive Abilities (automatisch, basierend auf Aptitude-Level)
- 3 aktive Standard-Abilities (immer verfugbar)
- 1 Ultimate Ability (einmal pro Kampf)
- 1-2 kontextuelle Abilities (erscheinen nur bei bestimmten Bedingungen, Combos, oder Personality-Triggers)

**= 4-5 aktive Entscheidungen pro Runde** — exakt im optimalen Bereich fur Cognitive Load.

### Woher kommen die "Spells"? Rechtliche & Design-Quellen

| Quelle | Lizenz | Was wir nutzen | Was wir NICHT nutzen |
|---|---|---|---|
| **D&D 5e SRD 5.2** | CC-BY-4.0 (unwiderruflich) | Mechanische Strukturen: Action Economy, Saving Throws, Concentration, AoE-Logik | Namen (Fireball), Fluff-Text, D&D-spezifische Monster |
| **FATE Core** | CC-BY-3.0 | Aspect-System: Personality Traits als invocable/targetable Spielelemente | Nichts auszuschliessen |
| **Blades in the Dark** | CC-BY-3.0 | Position/Effect Framework: Controlled/Risky/Desperate + Stress als Meta-Wahrung | Nichts auszuschliessen |
| **Savage Worlds Trappings** | Konzept (nicht schutzbar) | Mechanische Templates mit verschiedener narrativer "Haut" pro Aptitude | Markenname "Savage Worlds" |
| **Ars Magica Verb+Noun** | Konzept (nicht schutzbar) | Aptitude + Domain = Ability Generation | System-Name |

**Wichtig:** Spiel-Mechaniken sind **nicht urheberrechtlich schutzbar** (bestatigt durch GSL LLC Legal Analysis). Nur spezifischer kreativer Ausdruck (Flavor-Text, benannte Kreaturen) ist geschutzt. Wir konnen frei aus mechanischen Patterns schopfen, solange wir eigene Narrative/Flavor verwenden — was hier ohnehin der Fall ist (Spy-Thriller statt Fantasy).

### Kein D&D-Klon: Warum unser System fundamental anders ist

| Traditionelles D&D/MUD | Unser System |
|---|---|
| HP-Attrition (Lebenspunkte runterhauen) | **Condition-Tracks**: Operational → Stressed → Wounded → Afflicted → Captured. Keine abstrakten HP |
| "Roll to Hit" RNG | **Aptitude-Check**: Deterministische Basis (Aptitude × 3%) + Zone Security + Personality-Modifier. Spieler kann Wahrscheinlichkeiten berechnen |
| Mana-Pool fur Spells | **Keine Mana**: Abilities sind unbegrenzt nutzbar, begrenzt nur durch Cooldowns (Ultimate = 1x/Kampf) und Action Economy (1 Aktion pro Runde pro Agent) |
| 6 Stats (STR/DEX/CON/INT/WIS/CHA) | **6 Aptitudes** (Spy/Guardian/Saboteur/Propagandist/Infiltrator/Assassin) + **Big Five Personality** als Modifier |
| Klassen-System | **Aptitude-Profil**: Jeder Agent hat alle 6 Aptitudes auf verschiedenen Leveln. Budget 36. Jeder Agent ist ein einzigartiger Mix |
| Physischer Kampf dominant | **Psychologischer Kampf gleichwertig**: Stress, Mood, Needs als targetbare Dimensionen. Ein Propagandist kann Kampfe gewinnen, ohne physisch anzugreifen |
| Ausrustung als Progression | **Personlichkeitswachstum als Progression**: Dungeons machen Agenten nicht "starker" durch Items, sondern durch Aptitude-Boosts, Personality-Shifts, und Relationship-Bonds |

---

## Teil 4: Supabase-Realtime-Analyse (Developer-Perspektive)

### Bestandsaufnahme: Was ist schon da?

Die bestehende Realtime-Infrastruktur ist **perfekt als Grundlage fur Kampf-Kommunikation**:

```
Bestehend:
├── RealtimeService.ts (Singleton, 4 Channel-Typen)
├── Broadcast Triggers (SQL: realtime.send())
├── Presence Tracking (Preact Signals)
├── Ready-State Voting (epoch_participants.cycle_ready)
└── Cursor-basierte Message-Pagination

Benotig fur Kampf:
├── Combat-spezifische Broadcast-Channels
├── Combat-State Broadcast (nicht DB Changes!)
├── Timer-Synchronisation
└── Action-Submission via HTTP → Broadcast
```

### Architektur-Empfehlung: Supabase Broadcast + FastAPI In-Memory

```
┌──────────────────┐     ┌──────────────────────────┐
│  Lit Frontend     │     │  FastAPI Backend          │
│                   │     │                           │
│  CombatTerminal   │◄────│  CombatEngine (asyncio)   │
│  (Quick Actions)  │Broadcast  │                     │
│                   │     │  ┌──────────────────┐     │
│  Action-Buttons ──┼─HTTP──►│ CombatHandler    │     │
│                   │POST │  │ (in-memory state)│     │
│  State Display  ◄─┼─────┤  │ per combat_id    │     │
│  (Signals)        │Broadcast │                │     │
│                   │     │  └───────┬──────────┘     │
└──────────────────┘     │          │                 │
                          │          ▼                 │
                          │  ┌──────────────────┐     │
                          │  │ PostgreSQL        │     │
                          │  │ (persistence only)│     │
                          │  │ - combat_logs     │     │
                          │  │ - combat_outcomes │     │
                          │  │ - agent state     │     │
                          │  └──────────────────┘     │
                          └──────────────────────────┘
```

### Warum Supabase Broadcast und NICHT Postgres Changes

| Feature | Broadcast | Postgres Changes |
|---|---|---|
| **Latenz** | 6ms median, 28ms p95 | 200ms+ (low-write), 500ms-1s (high-write) |
| **Throughput** | 224.000 msg/s | Single-threaded WAL Processing |
| **Skalierung** | Horizontal | Nicht skalierbar |
| **Zuverlassigkeit** | Stabil | "Can fail silently" (bekannter Bug) |
| **Kosten** | Pro-Plan: 500 msg/s | Gleicher Plan, aber WAL-Overhead |
| **RLS-Overhead** | Keine (Channel-basiert) | RLS-Check pro Row-Change |

**Verdict:** Broadcast fur alles Echtzeit-Kampfbezogene. Postgres Changes nur fur langsame Zustandsanderungen (Chat-History-Refresh, Profile-Updates).

### Konkrete Channel-Architektur fur Kampf

```typescript
// Neues Pattern, erweitert bestehenden RealtimeService:

// Channel pro Kampf-Instanz:
`combat:{combatId}:state`     // Broadcast: Kampfzustand (Phase, Runde, Timer)
`combat:{combatId}:actions`   // Broadcast: Eingereichte Aktionen
`combat:{combatId}:resolution` // Broadcast: Kampf-Resolution-Narrativ
`combat:{combatId}:presence`  // Presence: Wer ist im Kampf? AFK-Detection

// Erweiterung bestehender Epoch-Channels:
`epoch:{epochId}:combat`      // Broadcast: Kampf-Start/Ende Notifications
```

### Timer-Synchronisation

**Problem:** Alle Spieler mussen denselben Countdown sehen.

**Losung (bewahrtes Pattern aus bestehendem Code):**

```typescript
// Server sendet Timer-Start als Broadcast:
{
  event: 'phase_change',
  payload: {
    phase: 'planning',
    started_at: '2026-03-27T14:30:00.000Z', // Server-Timestamp
    duration_ms: 30000, // 30 Sekunden
    round: 3
  }
}

// Client berechnet lokalen Countdown:
const elapsed = Date.now() - new Date(payload.started_at).getTime();
const remaining = payload.duration_ms - elapsed;
// → Jitter von max ~50ms, irrelevant bei 30s Phasen
```

Dieses Pattern ist identisch mit dem bestehenden `cycleResolved`-Broadcast-Pattern im `RealtimeService`.

### Kapazitats-Berechnung

**Szenario: 50 gleichzeitige Kampfe, 4 Spieler je Kampf, phasenbasiert:**

| Event | Frequenz | Messages/s |
|---|---|---|
| Phase-Change Broadcast | 1 pro 30s pro Kampf | 50/30 = ~2 msg/s |
| Action-Submission (HTTP) | 4 Spieler × 1 Aktion pro 30s | ~7 msg/s (HTTP, nicht Broadcast) |
| State-Update Broadcast | 1 pro Phase pro Kampf | ~2 msg/s |
| Resolution-Narrative | 1 pro Runde pro Kampf (grosser Payload) | ~2 msg/s |
| Presence Heartbeat | 1 pro 30s pro Spieler | 200/30 = ~7 msg/s |

**Total: ~20 msg/s** — bei einem Limit von 500 msg/s auf Pro-Plan. **Wir nutzen 4% der Kapazitat.** Selbst bei 500 gleichzeitigen Kampfen waren wir bei 40% — kein Problem.

### DB-Writes fur Persistence

**Pro Kampf (5 Runden):**
- Kampf-Start: 1 INSERT (combat_instances)
- Pro Runde: 1 INSERT (combat_rounds) + 4 INSERTs (combat_actions) = 5 INSERTs/Runde
- Kampf-Ende: 1 UPDATE (combat_instances) + N UPDATEs (agent_mood, agent_stress, opinions)
- Total: ~30 DB-Writes pro Kampf

**Bei 50 gleichzeitigen Kampfen:** ~30 × 50 / 150s (Kampfdauer) = ~10 writes/s. PostgreSQL kann 10.000+/s — **trivial**.

### Integration mit bestehendem RealtimeService

```typescript
// Erweiterung des bestehenden RealtimeService (frontend/src/services/realtime/):

// Neue Signals:
readonly combatState = signal<CombatState | null>(null);
readonly combatActions = signal<CombatAction[]>([]);
readonly combatTimer = signal<{ remaining: number; phase: string } | null>(null);
readonly combatNarrative = signal<string[]>([]);

// Neue Methoden (folgen bestehendem joinEpoch/leaveEpoch Pattern):
joinCombat(combatId: string, agentIds: string[]) {
  // Subscribe to combat:{combatId}:state, :actions, :resolution, :presence
  // Track presence with agent metadata
}

submitAction(combatId: string, agentId: string, action: CombatAction) {
  // HTTP POST to /api/v1/combat/{combatId}/actions
  // Server validates, stores, broadcasts confirmation
}

leaveCombat(combatId: string) {
  // Unsubscribe all combat channels
  // Clean up signals
}
```

### Kein FastAPI-WebSocket notig

Das bestehende Projekt hat **null WebSocket-Endpoints** im Backend — alles lauft uber Supabase Realtime. Fur phasenbasierten Kampf ist das **korrekt und ausreichend**:

1. **Aktionen einreichen:** HTTP POST (wie bestehendes `epoch_chat/send`)
2. **Zustand empfangen:** Supabase Broadcast (wie bestehendes `ready_changed`)
3. **Prasenz:** Supabase Presence (wie bestehendes Epoch-Presence)

Ein FastAPI-WebSocket ware nur notig fur:
- Sub-10ms Latenz (nicht benotigt bei 30s Phasen)
- Uber 500 msg/s konstant (nicht benotigt)
- Custom-Binary-Protocol (nicht benotigt)

**Empfehlung: Kein WebSocket-Endpoint hinzufugen.** Das bestehende HTTP + Supabase Broadcast Pattern ist optimal.

---

## Teil 5: Condition-Tracks statt HP — Das Damage-System

### Warum keine Hit Points

HP ist ein Abstraktionslayer, der fur unser System keinen Mehrwert bietet. Wir haben bereits 3 numerische Dimensionen, die als "Lebenspunkte" fungieren konnen:

| Bestehende Dimension | Kampf-Analogon | Targetbar durch |
|---|---|---|
| **Agent Condition** (Operational/Stressed/Wounded/Afflicted/Captured) | "HP-Ersatz" — physischer Zustand | Assassin (direkt), Saboteur (indirekt uber Umgebung) |
| **Stress Level** (0-1000) | "Stress-Bar" — psychischer Zustand | Propagandist (direkt), Saboteur (Chaos), alle (indirekt) |
| **Mood** (-100 bis +100) | "Morale-Bar" — Kampfbereitschaft | Propagandist (Demoralize), Guardian (Rally/Inspire) |

### Condition-Track Detail

```
OPERATIONAL (Standard)
    │  Durch physischen Schaden (Assassin, Kampf-Fehlschlag, Umgebung):
    ▼
STRESSED (Stress > 500 ODER nach erstem Verwundungs-Event)
    │  - 15% Malus auf alle Checks
    │  - Personality-abhangige Verhaltensanderungen:
    │    Hoher Neurotizismus: zittrige Hande (-10% Assassin-Prazision)
    │    Hohe Extraversion: wird laut (-10% Infiltrator-Stealth)
    │    Niedrige Agreeableness: streitet mit Party (-5 Opinion)
    ▼
WOUNDED (Nach kritischem Treffer oder 2. Verwundungs-Event)
    │  - 30% Malus auf physische Checks
    │  - Braucht Guardian-Stabilisierung ODER schreitet zu Afflicted fort
    │  - Agent-Needs sinken beschleunigt (Safety -20/Runde)
    ▼
AFFLICTED (Stress > 800 ODER verwundet + hoher Neurotizismus)
    │  - Agent handelt eigenmachtig (Darkest Dungeon Pattern):
    │    Neurotisch+Afflicted: erstarrt (verliert Aktion)
    │    Extravertiert+Afflicted: provoziert Gegner (ungewollte Aggro)
    │    Agreeable+Afflicted: weigert sich anzugreifen
    │    Open+Afflicted: unberechenbarer Zufallseffekt
    │  - Nur heilbar durch Propagandist (Rallying Speech) ODER Kampf-Ende
    ▼
CAPTURED (nur in Breach/War Room Ops)
    │  - Agent ist aus dem Kampf
    │  - Muss gerettet oder diplomatisch zuruckgefordert werden
    │  - Erzeugt starke negative Moodlets + Opinion-Modifier
    ▼
```

### Stress als "zweiter Gesundheitsbalken"

Stress funktioniert exakt wie Darkest Dungeons Stress-System, aber auf unseren bestehenden Daten:

- **Stress-Quellen im Kampf:**
  - Gegnerischer Propagandist-Angriff: +100-200 Stress
  - Verbundeter wird verwundet: +50-100 Stress (modifiziert durch Agreeableness)
  - Falle/Hinterhalt (Saboteur): +75-150 Stress
  - Kampf allgemein: +25 Stress/Runde Basis
  - Eigenes Needs-Defizit: +10 Stress/Runde pro Need unter 30

- **Stress-Reduktion:**
  - Propagandist "Inspire": -50-100 Stress
  - Guardian "Rally": -75 Party-weit
  - Erfolgreiche Aktion: -25 Stress (Selbstvertrauen)
  - Runde ohne Schaden: -10 Stress

- **Stress-Schwellen:**
  - 0-200: Normal — keine Effekte
  - 200-500: Angespannt — -5% auf alle Checks, Agent kommentiert nervos
  - 500-800: Am Limit — -15% auf alle Checks, Personality-Effekte aktiv
  - 800-1000: **Resolve Check** (Darkest-Dungeon-Moment):
    - 25% Chance auf **Virtue** (Agent uberschreitet sich selbst): +Aptitude Boost, Stress-Immunitat fur 2 Runden, heroischer Moment
    - 75% Chance auf **Affliction**: Personality-abhangiger Kontrollverlust
  - 1000: **Zusammenbruch** — Agent fallt aus dem Kampf (nicht tot, aber braucht mehrere Heartbeat-Ticks Erholung)

### Die "Virtue"-Mechanik als Story-Generator

Der 25%-Virtue-Moment ist bewusst selten — das macht ihn unvergesslich:

```
Agent Mira's stress reaches critical levels [████████████ 847/1000]

[SYSTEM] RESOLVE CHECK — Agent Mira (Neuroticism: 0.3, Resilience: 0.7)

...

[SYSTEM] ████ VIRTUE: COURAGEOUS ████

Something shifts in Mira's eyes. The fear doesn't leave — but it
stops mattering. She stands straighter. Her voice is steady.

"They think they can break us. They're wrong."

Agent Mira gains COURAGEOUS:
- All checks +20% for 3 rounds
- Immune to stress damage
- Party stress reduced by 100
- All party members gain +10 Opinion toward Mira ("inspired by her courage")

[This moment will be remembered. Agent Mira gains Memory:
 "Found courage when it mattered most" (importance: 9)]
```

---

## Teil 6: Gameplay-Flow eines typischen Kampfes

### Szenario: War Room Operation — Spy Mission

```
> warroom spy industrial-zone

[SYSTEM] WAR ROOM: SPY OPERATION INITIALIZED
[SYSTEM] Target: Enemy Simulation "Kanalgrund", Industrial Zone
[SYSTEM] Cost: 2 RP (discount from 3 RP for active play)

Select agents for operation (max 3):
Your drafted agents:
  [1] Agent Kovacs  — Spy 8, Infiltrator 5, Guardian 3 — Mood: Content
  [2] Agent Mira    — Spy 4, Propagandist 7, Guardian 5 — Mood: Anxious
  [3] Agent Voss    — Assassin 7, Spy 4, Saboteur 5 — Mood: Aggressive

> select 1 2 3

[SYSTEM] Party assembled. Operation begins.
[SYSTEM] Waiting for ally "Spharenklang" to join...
[SYSTEM] Ally connected. They will provide Overwatch.

════════════════════════════════════════════════════
  ROUND 1 — INFILTRATION APPROACH
════════════════════════════════════════════════════

Your party approaches the Industrial Zone perimeter.
Zone Security: GUARDED | Active Event: "Labor Strike" (Impact 6)
The strike has thinned security patrols. An opportunity.

ENEMY INTENTIONS (telegraphed):
  ► 2 Patrol Guards will sweep the eastern corridor
  ► 1 Sentry at the main gate (Alert: LOW)

ALLY OVERWATCH reports: "I see a gap in the patrol pattern.
  Northwest service entrance, 15-second window. Go now or wait."

Your agents:
  Kovacs [OPERATIONAL] Stress: 45  | Ready abilities: Observe, Analyze, Counter-Intel
  Mira   [OPERATIONAL] Stress: 180 | Ready abilities: Demoralize, Inspire, Rallying Speech
  Voss   [OPERATIONAL] Stress: 90  | Ready abilities: Precision Strike, Ambush, Exploit Weakness

PLANNING PHASE [████████████████░░░░ 22s remaining]

  [Observe]  [Analyze]  [Stealth Approach]  [Distraction]  [Wait]

> observe with kovacs
> inspire mira with mira
> stealth approach with voss

[SYSTEM] All actions submitted. Resolving...

════════════════════════════════════════════════════
  RESOLUTION
════════════════════════════════════════════════════

Kovacs scans the perimeter with practiced efficiency. His Spy
training (8) cuts through the noise — he maps every patrol route,
every camera angle, every gap in coverage.

[OBSERVE SUCCESS — Spy 8: Base 55% + (8×3%) = 79%. Roll: 34]
  → All enemy positions revealed for 2 rounds
  → Eastern corridor patrol pattern exposed
  → Hidden camera at northwest entrance DETECTED

Meanwhile, Mira takes a breath and steadies herself. Her own voice
surprises her with its calm: "We've done this before. We'll do it
again."

[INSPIRE SUCCESS — Propagandist 7 on self]
  → Mira: Stress -75 (180 → 105), Mood +15
  → Mira: Moodlet "self-assured" (+10% to next Propagandist check)

Voss moves through the northwest service entrance — but Kovacs
hisses a warning. The hidden camera. Voss freezes, presses against
the wall. The camera sweeps past.

[STEALTH APPROACH — Infiltrator 5: Base 55% + (5×3%) = 70%
  Modified: -10% (hidden camera, revealed by Kovacs) = 60%. Roll: 52]
  → Voss enters the facility undetected
  → But: "That was close." Voss Stress +50 (90 → 140)

ALLY OVERWATCH: "Nice work. Kovacs, that camera would've burned
Voss. Intel saves lives. I'm tracking three more hostiles inside."

════════════════════════════════════════════════════
  ROUND 2 — INSIDE THE FACILITY
════════════════════════════════════════════════════

[...]
```

### Was hier passiert — aus jeder Perspektive:

**Game Designer:** Jede Aktion hat einen klaren Effekt. Kovacs' Observe enthullte die Kamera, die Voss' Stealth-Chance modifizierte. Mira nutzte ihre Runde zur Selbststabilisierung statt zum Angriff — valide Strategie. Der Ally im Overwatch liefert narrative Kommentare, die sich anfuhlen wie ein Mitspieler. Die Aktionen sind read→decide→resolve in unter 45 Sekunden.

**MUD-Spezialist:** Der Parser akzeptiert sowohl Button-Klicks als auch getippte Befehle. Die Ausgabe ist lesbar (keine Wall-of-Text), narrativ (kein "Kovacs hits for 15 damage"), und mechanisch transparent (Wahrscheinlichkeiten sind sichtbar). Der Ally-Overwatch ist das "Keep Talking and Nobody Explodes"-Pattern — asymmetrische Information erzeugt kooperative Spannung.

**Supabase-Developer:**
- "warroom spy" → HTTP POST an `/api/v1/epochs/{id}/warroom/create` → erstellt combat_instance in DB
- Ally-Join → Supabase Presence auf `combat:{id}:presence`
- Planning-Phase Timer → Broadcast auf `combat:{id}:state` mit server_timestamp
- Action-Submission → HTTP POST an `/api/v1/combat/{id}/actions` (Validierung + Storage)
- Resolution → CombatEngine (Python asyncio) berechnet Ergebnis → Broadcast auf `combat:{id}:resolution`
- Agent-State-Updates → DB-Write auf agent_mood, agent_stress (batch, nach Resolution)
- Total Messages: ~3 Broadcasts pro Runde. Bei 30s Runden = 0.1 msg/s. Trivial.

---

## Teil 7: Zusammenfassende Empfehlungen

### Was zuerst bauen (MVP)

1. **CombatHandler** (Python, ~500 Zeilen): In-memory State, Action-Queue, Timer, Phase-Management, Aptitude-Check-Resolution
2. **3 Aktions-Typen fur MVP**: Attack (Aptitude-Check → Condition-Damage), Defend (Damage-Reduktion), Special (1 pro Aptitude-School)
3. **Supabase Broadcast Channels**: `combat:{id}:state`, `combat:{id}:resolution`
4. **Lit CombatTerminal Component**: Split-Pane (Narrativ + Action-Buttons), Timer-Bar, Agent-Status-Gauges
5. **1 War Room Operation**: Spy Mission (einfachste: Stealth-Navigation + Observe + Intel-Extraction)

### Was NICHT zuerst bauen

- Volle 6 Ability Schools mit allen Leveln
- Cross-Sim Breach-Mechanik
- Prozedurale Dungeon-Generierung
- LLM-generierte Kampfnarrative (Templates reichen fur MVP)
- Equipment/Loot-System
- Leaderboards
- AI-Gegner (Simple Random-Auswahl fur MVP-Feinde)

### Der Goldene Pfad

```
MVP (2-3 Wochen):
  CombatHandler + 3 Actions + 1 Lit Component + 1 War Room Op

V1 (4-6 Wochen):
  Alle 6 Ability Schools Basis-Level + 6 War Room Ops + Ally Overwatch

V2 (6-10 Wochen):
  Breach Operations + Resonance Dungeons (Tower + Shadow als erste)

V3 (10+ Wochen):
  Living Labyrinth + Echo Expeditions + volle Ability-Baume
```
