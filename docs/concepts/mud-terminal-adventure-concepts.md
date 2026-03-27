---
title: "MUD/Terminal Adventure Concepts — 5 Deep-Dive Designs"
version: "1.0"
date: "2026-03-27"
type: concept
status: draft
lang: de
tags: [game-design, mud, terminal, dungeon, multiplayer, adventure, agents, bleed, resonance, epoch]
---

# MUD/Terminal Adventure-Konzepte: 5 Deep-Dive Designs

## Kontext

Das Bureau-Terminal ist bereits ein vollwertiges MUD mit Bartle-Parser, 5-Tier Clearance-System, Zonen-Navigation, Agent-Conversations, und Heartbeat-Feed. Das Spiel hat ein reiches Ökosystem aus Agenten (mit Aptitudes, Mood, Needs, Opinions, Personality Profiles, Memories), Buildings (mit Readiness, Staffing, Condition), Zones (mit Stability, Security), Events (mit Impact, Ripple, Cascade), Echoes (Cross-Simulation Bleed), und dem kompetitiven Epoch-System (Operative Types, RP, Alliances).

**Was fehlt**: Instanzierte Abenteuer-Inhalte, ein Loot/Item-System, kooperative PvE-Erlebnisse, und Gründe, die eigenen Agenten als Party auf gefährliche Missionen zu schicken.

**Ziel**: 5 Konzepte, die das Bestehende kreativ nutzen und erweitern — keine neuen Systeme aus dem Nichts, sondern organische Weiterentwicklungen der vorhandenen Mechaniken.

---

# Konzept 1: BREACH OPERATIONS — Dimensionale Raubzüge durch den Bleed

## Inspiration & Research-Basis

- **EVE Online Wormholes**: Temporäre, zufällige Verbindungen zu unbekanntem Raum. Keine lokale Intelligenz. Impermanenz erzeugt Dringlichkeit. Der Bewohner hat Heimvorteil, der Eindringling Überraschung.
- **Dark Souls Invasions**: Indirekte Kommunikation, asymmetrische Vorteile, Covenant-System für lore-basierte Motivation. "Everything comes from the indirect communication."
- **Invisible Inc**: Graduated Detection statt binary caught/not-caught. Alarm-Eskalation als Timer. Perfekte Information wo es zählt, um strategische statt Glücks-Entscheidungen zu erzwingen.
- **Monaco/Payday**: Planning-Phase → Execution → Improvisation. Tripolare Oszillation zwischen Predator/Prey/Puzzle.
- **Chrono Cross**: Dieselbe Geographie, fundamental andere Regeln. "The same place, altered" ist mächtiger als ein komplett anderer Ort.

## Kernkonzept

Spieler nutzen die bestehenden **Bleed-Vektoren** und **Embassies**, um temporäre Risse ("Breaches") in andere Spieler-Simulationen zu öffnen. Durch diese Breaches schicken sie eine Party aus ihren eigenen Agenten in die fremde Simulation, um dort spezifische Ziele zu erfüllen — Ressourcen extrahieren, Geheimnisse stehlen, sabotieren, oder Artefakte bergen.

### Wie es auf bestehenden Systemen aufbaut

| Bestehendes System | Nutzung im Breach |
|---|---|
| **Embassy + Bleed-Vektoren** | Breach-Typ wird durch den aktiven Bleed-Vektor der Embassy bestimmt (Commerce-Breach = Handelsrouten-Raid, Memory-Breach = Erinnerungs-Labyrinth, Dream-Breach = Traumsequenz) |
| **Agent Aptitudes** (spy 3-9, guardian 3-9, etc.) | Bestimmen die Fähigkeiten der Agenten innerhalb des Breach. Spy-Aptitude = Fallen-Erkennung + Informationsgewinnung. Guardian = Verteidigungsfähigkeit. Saboteur = Umgebungsmanipulation. Infiltrator = Schlösser + Sicherheitssysteme. Assassin = Kampfstärke. Propagandist = NPC-Manipulation |
| **Agent Personality Profile** (Big Five) | Bestimmt Verhalten unter Stress. Hohe Neurotizismus = Agent kann bei Alarm panisch werden und eigenmächtig handeln (Darkest Dungeon Affliction-Pattern). Niedrige Agreeableness = Agent streitet mit Party-Mitgliedern unter Druck |
| **Agent Mood + Stress** | Stress steigt während Breach-Operationen. Moodlets entstehen aus Breach-Erlebnissen: "Survived a Breach" (+15 Stimulation, "thrilled"), "Witnessed Horrors in Foreign Reality" (-10 Safety, "disturbed"), "Betrayed by Party Member" (-20 Social, "bitter") |
| **Agent Needs** (Social, Purpose, Safety, Comfort, Stimulation) | Breach erfüllt Stimulation (+30-50) und Purpose (+20-40), kostet Safety (-20-40) und Comfort (-15-30). Agenten mit niedrigem Safety weigern sich ggf., erneut zu breachen |
| **Agent Opinions** | Gemeinsame Breach-Erlebnisse erzeugen starke Opinion-Modifier. "Shared trauma in foreign dimension" = +15 bis +25. "Left me behind during retreat" = -20 bis -30. Agenten, die zusammen breachen, entwickeln XCOM-style Bonds |
| **Agent Professions** | Qualification Level bestimmt Effektivität bei spezifischen Breach-Aufgaben. Ein Agent mit Profession "Ingenieur" (Qualification 8) kann Gebäude-Puzzles schneller lösen. "Diplomat" überzeugt feindliche NPCs |
| **Zone Security Levels** | Die Security der Zielzone bestimmt die Breach-Schwierigkeit. "Fortress" = fast unmöglich, "lawless" = einfacher Einstieg |
| **Building Readiness + Condition** | Gut gewartete Buildings in der Zielsimulation haben stärkere Verteidigungen. "Ruined" Buildings sind verwundbare Eintrittspunkte |
| **Events + Impact Level** | Aktive High-Impact Events (>=7) in der Zielsimulation erzeugen Chaos, das die Breach-Operation begünstigt (Wachen abgelenkt, Sicherheitssysteme gestört) |
| **Echo System** | Erfolgreiche Breach erzeugt automatisch Echoes zurück in beide Simulationen. Die Geschichte der Breach wird Teil der Narrativgeschichte beider Welten |

### Der Ablauf einer Breach-Operation

**Phase 1: Reconnaissance (Bestehende Spy-Mechanik)**
Der Spieler deployed einen Spy-Agenten (bestehendes Operative-System), der die Zielsimulation scoutet. Der Spy liefert:
- Zone-Map mit Security-Levels (bestehende Fog-of-War Enthüllung)
- Building-Readiness Snapshots (bestehende Spy-Intel Mechanik)
- Guardian-Positionen (bestehende Counter-Intel Daten)
- Aktive Events (Chaos-Fenster identifizieren)

**Phase 2: Party Assembly (Bestehende Agent-Draft Mechanik)**
Spieler wählt 2-4 Agenten aus seinem Roster (wie Epoch-Draft, `drafted_agent_ids`). Die Party-Zusammenstellung basiert auf:
- **Aptitude-Mix**: Brauche ich mehr Spy (Fallen) oder Saboteur (Umgebung)?
- **Personality-Kompatibilität**: Hohe `base_compatibility` zwischen Agenten reduziert Stressgefahr. Inkompatible Agenten könnten unter Druck streiten
- **Need-Status**: Agenten mit critically low Safety (< 20) weigern sich. Agenten mit hohem Stimulation-Need sind enthusiastisch (+5% auf alle Checks)
- **Profession-Abdeckung**: Ingenieur für technische Puzzles, Diplomat für NPC-Überzeugung, Soldat für Kampf

**Phase 3: Breach Entry (Neuer Terminal-Modus)**
Im Terminal-MUD wechselt der Spieler in den Breach-Modus:

```
> breach commerce district-7 via embassy-north

[SYSTEM] BREACH PROTOCOL INITIATED
[SYSTEM] Vector: COMMERCE | Target: Velgarien-Prime, District 7
[SYSTEM] Embassy conduit: North Trade Embassy (Effectiveness: 0.73)
[SYSTEM] Party: Agent Kovacs (Spy 8), Agent Mira (Infiltrator 7), Agent Voss (Assassin 6)
[SYSTEM] Estimated opposition: MODERATE (Zone Security: guarded)
[SYSTEM] Active chaos event detected: "Market Collapse" (Impact 7) — +15% stealth window

BREACH OPENING...

You emerge in a distorted mirror of District 7. The architecture is familiar
but wrong — the trade houses lean at impossible angles, their signs written
in a script that shifts when you try to read it. The Market Collapse event
has left the streets chaotic. Merchants argue in the distance. Security
patrols are thin.

Agent Kovacs whispers: "I count two patrols. Southeast corridor is clear
for another 40 seconds. Commerce vector is strong here — the trade goods
are practically bleeding through the walls."

Agent Mira: "The vault building is northeast. Readiness looks low — I see
gaps in the ward system. We can be in and out before anyone notices."

Agent Voss says nothing, but you notice his hand resting on his weapon.

ALERT LEVEL: ████░░░░░░ [1/10]
BREACH STABILITY: ██████████ [STABLE]

Exits: northeast (Vault Corridor), southeast (Market Chaos), west (Embassy Return)
```

**Phase 4: Dungeon Exploration (Erweiterter Terminal-Modus)**
Der Spieler navigiert durch die Breach-Version der Zielsimulation. Räume sind verzerrte Versionen der realen Zones/Buildings (Chrono Cross-Prinzip: "same place, altered"). Jede Aktion erhöht den ALERT LEVEL (Invisible Inc graduated detection):

| Alert Level | Effekt |
|---|---|
| 1-3 | Normal-Modus. Patrouillen folgen regulären Routen |
| 4-5 | Erhöhte Sicherheit. Zusätzliche Patrouillen. Türen brauchen Infiltrator-Checks |
| 6-7 | Aktive Jagd. Guardian-Agenten der Zielsimulation werden mobilisiert |
| 8-9 | Lockdown. Ausgänge werden versiegelt. Kampf fast unvermeidlich |
| 10 | Breach kollabiert. Erzwungene Evakuierung. Agenten riskieren Capture |

Jede Runde steigt Alert automatisch um 0.5 (Invisible Inc Alarm-Eskalation). Aktionen können Alert zusätzlich erhöhen oder senken:
- `sneak past patrol` (Spy Aptitude Check): Erfolg = +0, Fehlschlag = +2 Alert
- `disable security ward` (Infiltrator Check): Erfolg = -1 Alert, Fehlschlag = +3 Alert
- `create distraction` (Saboteur Check): Erfolg = -2 Alert in dieser Zone, +1 in benachbarter
- `convince guard` (Propagandist Check + Agent Profession "Diplomat"): Erfolg = -2 Alert, Fehlschlag = +2 + Kampf
- `eliminate patrol` (Assassin Check): Erfolg = +0 sofort, +3 nach 2 Runden wenn Leiche gefunden
- `defend position` (Guardian Check): Reduziert Schaden bei Kampf

**Phase 5: Objectives & Loot**
Breach-Ziele sind kontextuell an die Zielsimulation gebunden:

| Bleed-Vektor | Breach-Typ | Ziel | Loot |
|---|---|---|---|
| **Commerce** | Handelsrouten-Raid | Vault-Building plündern | **Trade Resonance Fragment**: Permanenter +5% Boost auf Building Readiness für ein eigenes Building (weil die Handelsroute jetzt auch die eigene Welt versorgt) |
| **Language** | Codex-Diebstahl | Bibliothek/Archiv infiltrieren | **Linguistic Echo**: Ein gestohlenes Lore-Fragment, das als neues Lore-Kapitel in die eigene Simulation integriert wird. Agenten, die es studieren, erhalten +1 Qualification in kommunikativen Professions |
| **Memory** | Erinnerungs-Labyrinth | Durch verzerrte Erinnerungs-Räume navigieren | **Memory Shard**: Implantierbare Erinnerung an einen eigenen Agenten. Erzeugt ein permanentes Moodlet (+10 Stimulation Decay Rate, "haunted by foreign memories") UND einen neuen Personality Trait ("witnessed alternate reality") |
| **Resonance** | Resonanz-Ernte | Resonance-Quelle finden und anzapfen | **Resonance Attunement**: Senkt den Bleed Threshold der eigenen Simulation um 1 für den nächsten Echo-Zyklus (mehr Echoes empfangen = mehr Weltereignisse = lebhaftere Welt) |
| **Architecture** | Bauplan-Raub | Blueprint aus einem Building extrahieren | **Architectural Imprint**: Kann auf ein eigenes Building angewendet werden — es nimmt Stilelemente der fremden Simulation an (+0.1 Building Condition Bonus + visuelles Upgrade auf der Building-Card) |
| **Dream** | Traum-Sequenz | Durch Traumlandschaft eines Agenten navigieren | **Dream Fragment**: Kann einem eigenen Agenten eingepflanzt werden. Erzeugt eine neue Reflection-Memory mit dem Inhalt des Traums. Agenten mit Dream Fragments entwickeln "prophetic" Personality-Trait, der Spy-Aptitude um +1 erhöht |
| **Desire** | Sehnsucht-Extraktion | Das stärkste Verlangen der Zielsimulation identifizieren und manifestieren | **Desire Catalyst**: Erzeugt ein Event in der eigenen Simulation basierend auf dem Verlangen der anderen. Z.B. wenn die Zielsimulation niedrige Building-Readiness hat (= Verlangen nach Stabilität), erzeugt der Catalyst ein "Unexpected Aid" Event mit Impact 5+ |

### Kampfsystem innerhalb des Breach

Kampf ist **affliction/state-based** (nicht HP-Attrition), inspiriert von Achaea und Darkest Dungeon:

Jeder Agent hat einen **Condition Track** basierend auf bestehenden Systemen:
- **Operational** (Standard): Volle Fähigkeiten
- **Stressed** (Stress > 500): -15% auf alle Checks, Personality-abhängige Verhaltensänderungen
- **Wounded** (Nach Kampf-Fehlschlag): -30% auf physische Checks, muss von Guardian/Healer stabilisiert werden
- **Afflicted** (Stress > 800, Neuroticism > 0.7): Agent handelt eigenmächtig (Darkest Dungeon Pattern):
  - Hohe Extraversion + Afflicted = Agent provoziert Wachen (Alert +3)
  - Hohe Neurotizismus + Afflicted = Agent friert ein (1 Runde verloren)
  - Niedrige Agreeableness + Afflicted = Agent streitet mit Party (-5 Opinion modifier mit allen)
  - Hohe Openness + Afflicted = Agent berührt unbekanntes Objekt (zufälliger Effekt: 50% nützlich, 50% katastrophal)
- **Captured** (Alert 10 + Kampf-Niederlage): Agent bleibt in der Zielsimulation (muss gerettet oder diplomatisch zurückgefordert werden)

Kampf-Resolution pro Runde (2-3 Runden max):
```
> attack patrol with Voss

Agent Voss (Assassin 6) vs. Patrol Guard
Base Success: 55% + (Assassin Aptitude 6 × 3%) = 73%
Zone Security Penalty: -guarded (15%) = 58%
Chaos Event Bonus: +15% (Market Collapse) = 73%

Roll: 68 — SUCCESS

Voss moves like a memory of violence — there and gone before the guard
understands what's happening. The patrol collapses silently.

Agent Kovacs: "Clean work. But they'll find the body. We have two rounds
before the next shift discovers this."

Agent Mira nods, already scanning the corridor ahead.

ALERT: +0 (immediate) → +3 (in 2 rounds)
```

### Multiplayer-Aspekte

**Kooperativer Breach (2-3 Spieler)**:
- Jeder Spieler bringt 1-2 Agenten mit (Party von 3-6 Agenten total)
- **Asymmetrische Rollen** (We Were Here Pattern):
  - **Breach Team**: Im Terminal, navigiert die Breach-Räume
  - **Overwatch**: Am eigenen Terminal, sieht Informationen, die das Breach-Team nicht sieht (Patrouillenmuster, Timer, versteckte Fallen). Kommuniziert per Chat
- Gemeinsame Breaches erzeugen stärkere Opinion-Modifier zwischen den Agenten beider Spieler
- Geteilter Loot (Spieler entscheiden, wer welches Fragment bekommt — Potential für Konflikte!)

**Kompetitiver Aspekt (Dark Souls Invasion Pattern)**:
- Der **Besitzer der Zielsimulation** wird benachrichtigt ("BREACH DETECTED in Zone: District 7")
- Kann eigene Guardian-Agenten mobilisieren, um die Eindringlinge zu jagen
- Asymmetrische Information: Verteidiger kennt Layout, Angreifer hat Initiative
- Bei Capture kann der Verteidiger den gefangenen Agenten "verhören" (Chat mit dem Agenten unter Stress — der Agent könnte Informationen über die Angreifer-Simulation preisgeben, wenn sein Stress zu hoch ist)

### Warum es Spaß macht — Multi-Perspektiven-Analyse

**Architekt-Perspektive**: Das System wiederverwendet 90% bestehende Mechaniken (Aptitudes, Personality, Mood, Embassies, Bleed-Vektoren, Events). Die einzigen neuen Datenstrukturen sind `breach_instances` (ähnlich `game_epochs`) und `breach_rooms` (ähnlich Zonen). Der Alert-Level nutzt das Fog-of-War Pattern.

**Game-Designer-Perspektive**: Die Risiko/Belohnungs-Balance ist klar — wertvoller Loot, aber reale Konsequenzen (Agent-Stress, Capture, Opinion-Änderungen). Jede Breach ist anders wegen prozedural verzerrter Zielzonen und dynamischer Events. Kein Grind möglich, weil Alert-Eskalation zu echtem Zeitdruck führt.

**UX-Perspektive**: Der Text-Modus eignet sich perfekt für Breach-Atmosphäre — die narrative Beschreibung der verzerrten Realität ist in Text eindringlicher als in Grafik (Achaea's Erkenntnis: "Description is a major advantage of textual combat"). Quick Actions für häufige Befehle (sneak, attack, search) reduzieren Tipp-Aufwand.

**Research-Perspektive**: EVE Wormholes beweisen, dass temporäre dimensionale Verbindungen der stärkste emergente-Narrative-Generator in Multiplayer-Spielen sind. Dark Souls beweist, dass asymmetrische Invasionen ein "multiplayer heartbeat" für sonst solo-orientierte Erlebnisse schaffen. Invisible Inc beweist, dass graduated detection spannender ist als binary success/failure.

---

# Konzept 2: RESONANCE DUNGEONS — Archetypische Tiefenschichten

## Inspiration & Research-Basis

- **Caves of Qud Sultan-System**: Prozedurale Geschichte mit handgefertigten Beats. "State machines generate events, then rationalize them ex post facto."
- **Cultist Simulator**: Karten als narrative Fragmente. Timer-basierte Knappheit. "Intentional opacity mirrors the fiction." Spieler lernen die Sprache des Spiels.
- **Sunless Sea/Fallen London QBN**: Quality-Based Narrative — Storylets gated durch Qualitäten. Kombinatorischer Content elegant gelöst.
- **Darkest Dungeon**: Positions-basierte Party, Dungeon-spezifische Komposition, Stress als Kernmechanik.
- **Control (The Oldest House)**: "Mundane aesthetics hiding cosmic horror." Räume, die sich normal anfühlen, aber falsch verhalten. "The mundane-made-threatening is more unsettling than the overtly alien."
- **Hades Meta-Progression**: Tod ist Story-Fortschritt. "Every death unlocks new dialogue."

## Kernkonzept

Die 8 bestehenden **Substrate Resonances** (The Tower, The Shadow, The Devouring Mother, The Deluge, The Overthrow, The Prometheus, The Awakening, The Entropy) sind nicht nur abstrakte Modifier — sie sind **Zugänge zu archetypischen Tiefenschichten der Realität**. Wenn die Resonance-Magnitude einer Simulation einen kritischen Schwellenwert überschreitet, öffnet sich im Terminal ein Zugang zu einem Resonance Dungeon: einer prozedural generierten, archetypisch geformten Unterwelt.

### Wie es auf bestehenden Systemen aufbaut

| Bestehendes System | Nutzung |
|---|---|
| **8 Substrate Resonances** | Jede Resonance generiert einen thematisch einzigartigen Dungeon-Typ mit eigenen Regeln, Gegnern, und Puzzles |
| **Resonance Magnitude + Susceptibility** | Bestimmt Dungeon-Tiefe (Floors) und Schwierigkeit. Hohe Susceptibility = tieferer, gefährlicherer Dungeon |
| **Agent Personality Profile (Big Five)** | Bestimmte Resonances sind gefährlicher für bestimmte Persönlichkeiten. The Shadow (conflict_wave) ist besonders stressig für Agenten mit hoher Agreeableness. The Prometheus (innovation_spark) belohnt hohe Openness |
| **Agent Mood + Moodlets** | Dungeon erzeugt archetypische Moodlets: "Touched by The Tower" (permanenter Moodlet: +5 Purpose, -5 Comfort, "understanding of impermanence") |
| **Agent Memories (pgvector)** | Dungeon-Erlebnisse werden als high-importance Memories gespeichert. Agenten, die The Shadow überlebt haben, reagieren anders auf Gewalt-Events in der Simulation |
| **Narrative Arcs** | Resonance Dungeons können als Climax-Punkt eines bestehenden Narrative Arc dienen. Wenn der "Tower + Shadow Convergence" Arc seinen Peak erreicht, öffnet sich der kombinierte Dungeon |
| **Zone Stability** | Niedrige Zone-Stability in der eigenen Simulation macht bestimmte Resonance-Dungeons zugänglicher (desperate realities bleed easier) |
| **Heartbeat Tick System** | Dungeon-State wird pro Heartbeat-Tick aktualisiert. Monster bewegen sich, Fallen laden nach, Ressourcen erschöpfen sich |
| **Agent Needs** | Dungeon-Exploration kostet Needs: Comfort sinkt rapide, Safety sinkt, aber Stimulation und Purpose steigen. Agenten mit vollem Stimulation-Need sind die besten Dungeon-Kandidaten |
| **Building Types** | Dungeon-Räume sind verzerrte Versionen von Building-Types. In einem Tower-Dungeon werden "market" Buildings zu kollabierten Börsen, "residential" zu verlassenen Wohnblöcken |

### Die 8 Resonance-Dungeon-Typen

**1. The Tower (economic_tremor) — Der Fallende Turm**
- Visuell: Ein endloser Wolkenkratzer, der sich während der Exploration langsam neigt. Jeder Floor kippt stärker.
- Mechanik: **Abwärtsspirale** — Ressourcen (RP-Analogon: "Stability Points") schrumpfen jede Runde. Die Party muss schnell entscheiden: tiefer gehen für besseren Loot, oder rechtzeitig raus?
- Gegner: "Debt Collectors" — abstrakte Entitäten, die Agenten-Aptitudes temporär senken (Spy -1 pro Kampfkontakt)
- Puzzle: Ökonomische Rätsel — Handelsrouten rekonstruieren, Wertberechnung unter Zeitdruck, "Investitions"-Entscheidungen (Stability Points in Verteidigung oder Geschwindigkeit?)
- Loot: **Stability Catalyst** — Permanenter +0.05 auf die eigene Simulation's Overall Health. Kleiner Bonus, aber kumulativ über mehrere Runs enorm wertvoll
- Agent-Affinität: Agenten mit Profession "Händler/Buchhalter" (Qualification >=5) erhalten Bonus-Puzzle-Hinweise. Hohe Conscientiousness = bessere Ressourcen-Effizienz

**2. The Shadow (conflict_wave) — Die Tiefe Nacht**
- Visuell: Absolute Dunkelheit. Nur der unmittelbare Raum ist sichtbar. Monster bewegen sich im Unsichtbaren.
- Mechanik: **Fog of War extrem** — Nur 1 Raum Sichtweite. Spy-Aptitude bestimmt, wie viel vom nächsten Raum vorher erkannt wird. Guardian-Aptitude bestimmt Reaktionszeit bei Hinterhalt.
- Gegner: "Echoes of Violence" — Manifestationen vergangener Konflikte der Simulation. Je mehr Events mit Impact >=7 die Simulation hatte, desto stärker die Gegner (dynamische Schwierigkeit aus echten Spieldaten!)
- Puzzle: Moralische Dilemmata — Räume präsentieren Szenarien, die Agenten-Persönlichkeit testen. "Torture a shadow-prisoner for information?" (Compassionate Agents verweigern = alternative Route nötig, Agenten mit Cruelty-Trait machen es, aber erhalten permanentes "cruel_act" Opinion-Modifier von der Party)
- Loot: **Shadow Attunement** — Agent erhält permanent +1 Assassin ODER Guardian Aptitude (Spielerwahl). Der Agent-Budgetlimit von 36 steigt auf 37 für diesen einen Agenten. Extrem wertvoll im Epoch-Gameplay
- Agent-Affinität: Hohe Bravery/low Neuroticism = weniger Stress. Hohe Extraversion = Agent spricht und verrät Position (Stealth-Malus!)

**3. The Devouring Mother (biological_tide) — Das Lebendige Labyrinth**
- Visuell: Organische Korridore, die sich bewegen. Wände atmen. Räume schrumpfen und wachsen.
- Mechanik: **Parasitäre Drain** — Der Dungeon entzieht Agenten langsam ihre Needs. Social sinkt auf 0 (Agenten fühlen sich isoliert), dann Purpose (warum sind wir hier?), dann Safety (Panik). Die Party muss durch Interaktion (Talk-Befehle untereinander) die Needs stabilisieren
- Gegner: "Symbioten" — Können sich an Agenten "heften". Ein infizierter Agent erhält temporär +3 auf eine Aptitude, verliert aber die Kontrolle, wenn Stress >500 (der Symbiont übernimmt und der Agent greift die Party an)
- Puzzle: Kooperative Biologie-Rätsel — Agenten müssen ihre Professions kombinieren. Arzt + Ingenieur = Gegengift synthetisieren. Biologe + Diplomat = Symbiont verhandeln statt kämpfen
- Loot: **Symbiotic Bond** — Ein dauerhafter Modifier, der zwei Agenten permanent verbindet. Wenn beide in derselben Zone/Building sind, erhalten beide +10% Qualification-Bonus. Wenn getrennt, beide -5% (Abhängigkeit als Feature und Risiko)
- Agent-Affinität: Hohe Agreeableness + Sociability = natürlicher Widerstand gegen Isolation-Drain. Medizinische Professions = Symbiont-Kontrolle

**4. The Deluge (elemental_surge) — Die Steigende Flut**
- Visuell: Die untersten Floors sind bereits geflutet. Jede Runde steigt das Wasser um einen Floor. Die Party muss nach OBEN, nicht nach unten.
- Mechanik: **Inverser Dungeon** — Statt tiefer zu gehen, muss die Party aufsteigen und dabei Ressourcen sammeln. Untere Floors haben besseren Loot, aber das Wasser kommt. Timing-Spannung pur.
- Gegner: "Flut-Elementare" — Werden stärker, je höher das Wasser steht. In den obersten, trockenen Floors sind sie schwach. In überfluteten Floors sind sie tödlich. Die Party muss entscheiden: sichere obere Floors mit wenig Loot, oder riskante untere Floors vor dem Wasser erreichen?
- Puzzle: Umwelt-Manipulation — Schleusen öffnen/schließen, Brücken bauen, Wasserwege umleiten. Saboteur-Aptitude = Schleusen sprengen (schnell, laut, +Alert). Infiltrator = Schleusen-Mechanismus hacken (langsam, leise). Ingenieur-Profession = improvisierte Dämme
- Loot: **Elemental Warding** — Kann auf ein Building in der eigenen Simulation angewendet werden. Building-Condition kann nicht unter "moderate" fallen, egal welche Events passieren. Extrem wertvoll für kritische Infrastruktur (Hospital, Power Plant)
- Agent-Affinität: Physische Professions (Soldat, Bauarbeiter) = bessere Bewegung in gefluteten Bereichen. Hohe Conscientiousness = besseres Timing-Management

**5. The Overthrow (authority_fracture) — Der Spiegelpalast**
- Visuell: Ein Regierungsgebäude, das sich endlos in sich selbst spiegelt. Jeder Floor ist eine alternative Version desselben Ortes — mit anderen Machthabern, anderen Regeln.
- Mechanik: **Fraktions-Navigation** — Jeder Floor hat eine dominante Fraktion. Die Party muss entscheiden, mit welcher Fraktion sie sich verbündet — jede Allianz öffnet Türen, aber schließt andere. Verrat ist möglich und manchmal nötig
- Gegner: "Authority Constructs" — Nehmen die Form von Agenten der eigenen Simulation an, aber als korrumpierte Versionen. Du kämpfst gegen Zerrspiegel deiner eigenen Leute
- Puzzle: Politische Intrigen — Überzeugungs-Ketten (Propagandist überzeugt NPC A, der NPC B beeinflusst, der den Zugang gewährt). Spy deckt Geheimnisse auf, die als Hebel dienen. Ultimatives Puzzle: Welche Fraktion verrätst du, um den Boss-Raum zu erreichen?
- Loot: **Authority Fragment** — Ändert den `security_level` einer Zone in der eigenen Simulation für 10 Heartbeat-Ticks um eine Stufe nach oben (z.B. "moderate" → "guarded"). Direkter militärischer/defensiver Nutzen
- Agent-Affinität: Propagandist-Aptitude ist König hier. Diplomatic Professions erhalten massive Boni. Hohe Agreeableness = leichter Allianzen schließen, schwerer zu verraten

**6. The Prometheus (innovation_spark) — Die Werkstatt der Götter**
- Visuell: Eine unmögliche Werkstatt voller halb-fertiger Erfindungen, die zwischen Realitäten flackern. Maschinen aus verschiedenen Technologie-Epochen nebeneinander.
- Mechanik: **Crafting-Dungeon** — Statt Loot zu finden, baut die Party es. Räume enthalten Komponenten, die kombiniert werden müssen. Jeder Agent kann basierend auf Profession und Aptitude verschiedene Komponenten identifizieren/nutzen
- Gegner: "Prometheus-Wächter" — Können nur durch kreative Nutzung der Umgebung besiegt werden (Saboteur = Maschine umfunktionieren, Ingenieur = Falle bauen, Spy = Schwachstelle finden)
- Puzzle: Kombinations-Rätsel im Divinity:OS2-Stil — "Energiequelle A + Leitung B + Verstärker C = ?" Die Ergebnisse sind teilweise unvorhersehbar (Cultist Simulator opacity). Manche Kombinationen sind brillant, andere katastrophal
- Loot: **Innovation Blueprint** — Der Spieler wählt, was gecraftet wird:
  - "Agent Enhancement Module": +1 auf eine beliebige Aptitude für einen Agenten (einmalig)
  - "Building Upgrade Schematic": +0.15 Building Readiness für ein Building (permanent)
  - "Zone Fortification Plan": Fortify-Effekt hält 10 statt 5 Ticks
- Agent-Affinität: Hohe Openness = mehr Crafting-Optionen sichtbar. Ingenieur/Wissenschaftler Professions = bessere Erfolgsraten. Niedrige Openness = Agent weigert sich, riskante Kombinationen auszuprobieren

**7. The Awakening (consciousness_drift) — Das Kollektive Unbewusste**
- Visuell: Abstrakte Räume, die die Stimmung der Simulation widerspiegeln. Wenn die Simulation "stressed" ist, sind die Wände rissig. Wenn "thriving", leuchten sie.
- Mechanik: **Memory-Dungeon** — Die Party navigiert durch Memories der eigenen Agenten (bestehender pgvector Memory Store!). Räume werden aus realen Agent-Memories generiert. High-importance Memories werden zu Schlüsselräumen.
- Gegner: "Repressed Memories" — Verdrängte Erinnerungen manifestieren als Gegner. Können nur durch Konfrontation (Agent muss "reflect" — bestehende Reflect-Endpoint) besiegt werden
- Puzzle: Die Party muss herausfinden, welche Memory zu welchem Agenten gehört und diese korrekt zuordnen. Falsche Zuordnung = Agent erhält falsches Moodlet. Korrekte Zuordnung = Agent gewinnt Einsicht und permanent +5 Resilience
- Loot: **Awakening Insight** — Der Spieler kann die Personality Profile eines Agenten leicht modifizieren: Eine Big Five Dimension um 0.1 in eine Richtung verschieben. Erlaubt langfristige "Charakterentwicklung" der Agenten
- Agent-Affinität: Hohe Openness und Neuroticism = mehr Erinnerungs-Räume zugänglich (weil diese Agenten mehr verarbeiten). Reflection-fähige Agenten (haben bereits Reflections im Memory Store) haben Vorteile

**8. The Entropy (decay_bloom) — Der Verfall-Garten**
- Visuell: Ein wunderschöner, aber zerfallender Garten. Alles blüht und verrottet gleichzeitig. Zeitfluss ist verzerrt.
- Mechanik: **Decay vs. Growth Trade-off** — Die Party hat begrenzte "Restoration Points". Jeder Raum enthält etwas Wertvolles, das gerade zerfällt. Restaurieren kostet Points, aber der Loot ist besser. Verfallen lassen spart Points, gibt aber nur Standard-Loot. Die Party muss priorisieren, was gerettet wird.
- Gegner: "Entropy Blooms" — Passive Hindernisse, die Agenten langsam "altern" (temporäre Aptitude-Reduktion). Können nicht bekämpft werden, nur umgangen oder verlangsamt (Guardian-Warding)
- Puzzle: Zeitdruck-Management — Räume "verfallen" in Echtzeit (an den Heartbeat-Tick gebunden). Die Party muss zwischen schnell-aber-riskant und langsam-aber-sicher entscheiden
- Loot: **Restoration Fragment** — Kann ein Building in der eigenen Simulation um eine Condition-Stufe verbessern ("poor" → "moderate", "moderate" → "good"). Direkter, messbarer Nutzen für die Simulation-Health
- Agent-Affinität: Hohe Conscientiousness = bessere Restoration-Effizienz. Guardian-Aptitude = Schutz vor Entropy-Drain. Medizinische Professions = Agent-Alterung verlangsamen

### Meta-Progression (Hades-Modell)

Jeder Dungeon-Run erzeugt:
1. **Agent Memories**: Hohe Importance-Erinnerungen, die das Verhalten des Agenten in zukünftigen Runs und in der Simulation beeinflussen
2. **Agent Moodlets**: Positive und negative, mit Decay-Timern
3. **Opinion Modifiers**: Zwischen Party-Mitgliedern
4. **Narrative Arc Beiträge**: Ein Dungeon-Run kann einen bestehenden Narrative Arc vorantreiben oder abschließen

**Bei "Tod" (Total Party Wipe)**:
- Agenten sind nicht permanent tot — sie kehren mit extremem Stress (800+) und negativen Moodlets zurück
- Afflicted-Status für mehrere Heartbeat-Ticks
- ABER: Neue Dialogoptionen freigeschaltet (Hades Pattern), neue Memories, neue Beziehungsdynamiken
- Jeder Fehlschlag liefert Intel über den Dungeon für den nächsten Versuch (Moodlet: "knows the darkness", +10% auf Checks in demselben Dungeon-Typ)

### Multiplayer

- **Kooperativ (2-4 Spieler)**: Jeder bringt 1-2 Agenten. Die Kombination verschiedener Simulationen ergibt verschiedene Resonance-Affinitäten
- **Asynchron**: Ein Spieler schafft Floor 1-3, loggt aus. Ein anderer Spieler kann den Run fortsetzen (ähnlich Boatmurdered-Modell aus Dwarf Fortress)
- **Wettbewerb**: Wöchentliche Resonance-Events (basierend auf echten Substrate-Scanner-Daten!) erzeugen denselben Dungeon für alle Spieler. Leaderboard: Wer schafft es am tiefsten/schnellsten?

### Warum es Spaß macht

**Architekt**: Nutzt das bestehende Resonance-System als Content-Generator. Die 8 Archetypen liefern 8 fundamental verschiedene Gameplay-Erlebnisse mit eigenen Regeln, ohne dass 8 separate Systeme gebaut werden müssen.

**Game Designer**: Der Meta-Progression-Loop ist elegant: Dungeons machen Agenten stärker (Aptitude +1, Personality-Shifts), was Epochs verbessert, was Simulationen belebt, was mehr Resonances erzeugt, was mehr Dungeons öffnet. Jeder Dungeon-Typ hat eine eigene "Grammatik" (wie Darkest Dungeon's dungeon-spezifische Komposition), die Party-Building belohnt.

**UX**: Die thematische Kohärenz jedes Dungeon-Typs (Tower = Wirtschaft, Shadow = Gewalt, Mother = Biologie) gibt Spielern mentale Modelle. "Ich gehe in einen Tower-Dungeon, also brauche ich Händler und Buchhalter." Das ist sofort verständlich.

**Research**: Caves of Qud beweist, dass prozedurale Geschichte mit archetypischen Ankern die beste Balance zwischen Wiederspielbarkeit und Bedeutung liefert. Hades beweist, dass Meta-Progression durch Tod der beste Motivator für "noch einen Run" ist.

---

# Konzept 3: ECHO EXPEDITIONS — Archäologische Ausgrabungen im Bleed-Sediment

## Inspiration & Research-Basis

- **Sunless Sea/Fallen London QBN**: Quality-Based Narrative. "Items" als narrative Qualitäten, nicht als Ausrüstung. Storylets gated durch Kombinationen von Qualitäten.
- **Disco Elysium Thought Cabinet**: "Ideas are the loot from conversations." Thoughts ändern, wer du BIST, nicht nur was du HAST. Begrenzte Slots erzwingen Entscheidungen.
- **80 Days**: Distributed Subplots über mehrere Stationen. Reise als Struktur.
- **Firewatch**: 10.000 trackbare Events. Callbacks so subtil, dass "everyone thought it was a linear game."
- **Alexis Kennedy "Resource Narratives"**: "Strategically manipulating limited resources whose nature and interrelationship aligns with the grain of the story."

## Kernkonzept

Wenn Echoes zwischen Simulationen fließen, hinterlassen sie **Sediment** — narrative Ablagerungen im Bleed-Raum zwischen den Welten. Dieses Sediment enthält Fragmente vergangener Events, Erinnerungen toter oder vergessener Agenten, und verzerrte Bauplan-Fetzen. Spieler können **Echo Expeditions** starten: archäologische Grabungen in den Schichten des Bleed-Sediments, um wertvolle Relikte zu bergen.

### Wie es auf bestehenden Systemen aufbaut

| Bestehendes System | Nutzung |
|---|---|
| **Event Echoes** (source_event → target_simulation) | Jeder vergangene Echo hinterlässt eine "Sediment-Schicht". Ältere Echoes = tiefere Schichten = wertvollere aber gefährlichere Relikte |
| **7 Bleed-Vektoren** | Bestimmen die "Zusammensetzung" des Sediments. Commerce-dominiertes Sediment enthält Handels-Relikte. Dream-Sediment enthält Traum-Fragmente |
| **Echo Strength + Depth** | Starke Echoes (strength > 0.7) erzeugen "dichte" Sediment-Zonen mit mehr Loot aber mehr Hindernissen. Echo Depth (1-3) bestimmt, wie "verzerrt" die Relikte sind |
| **Simulation Connections** | Die Stärke der Verbindung zwischen zwei Simulationen bestimmt, wie "navigierbar" der Bleed-Raum zwischen ihnen ist. Starke Verbindung = klar, schwache = chaotisch |
| **Agent Memories** | Agenten mit Memories von vergangenen Echoes navigieren das Sediment besser. Ein Agent, der sich an ein bestimmtes Echo erinnert, kann verwandte Relikte leichter identifizieren |
| **Lore Sections** | Ausgegrabene Relikte können als neue Lore-Kapitel in die eigene Simulation integriert werden — "discovered during an Echo Expedition" |
| **Agent Professions** | Archäologe/Historiker/Forscher-Professions sind hier besonders wertvoll. Qualification Level bestimmt Grabungs-Effizienz |
| **Heartbeat Entries** | Vergangene Heartbeat-Einträge (entry_type: bleed_echo) werden als "Schichten" im Sediment dargestellt |

### Gameplay-Struktur: Die Expedition

Expeditionen sind **längerfristig als Breaches** — sie dauern mehrere Heartbeat-Ticks (2-5 Tage Echtzeit) und erfordern regelmäßige Entscheidungen, nicht konstante Aufmerksamkeit. Das Modell ist ein **asynchrones Strategie-Abenteuer**, ähnlich einer Reise in 80 Days.

**Expedition Start**:
```
> expedition start via echo-layer velgarien-prime

[SYSTEM] ECHO EXPEDITION AUTHORIZED
[SYSTEM] Target: Bleed sediment between YOUR_SIM and Velgarien-Prime
[SYSTEM] Connection strength: 0.67 (navigable with moderate distortion)
[SYSTEM] Detected sediment layers: 7
[SYSTEM] Dominant vectors: Memory (32%), Architecture (28%), Commerce (22%), Dream (18%)

Layer 1: Recent echoes (< 7 days). Low value, low risk.
Layer 2-3: Established echoes (7-30 days). Moderate value, moderate risk.
Layer 4-5: Deep echoes (30-90 days). High value, significant risk.
Layer 6-7: Ancient echoes (90+ days). Extreme value, extreme risk. May contain CONVERGENCE RELICS.

Select party (2-4 agents):
```

**Schichten-Navigation** — Jede Schicht ist ein "Raum" mit:
1. **Sediment-Typ** (bestimmt durch dominanten Bleed-Vektor)
2. **Hindernisse** (verzerrte Echo-Fragmente, die Agenten verwirren)
3. **Relikte** (Loot, der geborgen werden muss)
4. **Narrative Encounters** (Fragmente vergangener Events, die als Szenen erlebt werden)

**Zwischen den Ticks** (asynchron):
```
[MORNING BRIEFING — Expedition Update]

Agent Kovacs has reached Layer 3 of the echo sediment.

REPORT: "The Commerce vector is dominant here. I found remnants of a
trade dispute — prices haggled in languages that blend together. There's
a relic embedded in the sediment wall, but extracting it will take a
full tick. I need instructions: extract (risk destabilizing the layer)
or press deeper?"

Party Mood:
- Kovacs: Content (Stimulation fulfilled, Purpose high)
- Mira: Anxious (Safety low — "something is watching us from the deeper layers")
- Voss: Bored (Stimulation low — "this archaeological pace doesn't suit me")

Your orders? [extract] [press deeper] [split party] [return to surface]
```

### Das Relikt-System (Quality-Based Narrative nach Failbetter)

Relikte sind keine traditionellen "Items" — sie sind **narrative Qualitäten**, die die Simulation und ihre Agenten verändern:

**Tier 1: Echo-Fragmente** (Schicht 1-2)
- **Handels-Fragment** (Commerce): +2% Building Readiness für alle Märkte/Werkstätten für 5 Ticks
- **Sprach-Fragment** (Language): Ein Agent lernt eine "Phrase" aus der anderen Simulation. Nächste Diplomatic-Interaktion mit dieser Sim erhält +10% Bonus
- **Erinnerungs-Splitter** (Memory): Kann einem Agenten als Memory eingepflanzt werden. Low-importance, aber interesting: "Erinnert sich an ein Ereignis, das in einer anderen Realität passiert ist"
- **Traum-Fetzen** (Dream): Temporärer Moodlet: "vivid dreams from another world" (+5 Stimulation, -3 Safety, 3 Ticks)

**Tier 2: Echo-Artefakte** (Schicht 3-4)
- **Resonanz-Kristall**: Verstärkt einen bestimmten Bleed-Vektor der eigenen Simulation für 10 Ticks (+0.1 auf echo_strength für alle ausgehenden Echoes dieses Vektors)
- **Architektur-Impression**: Blueprint-Fragment, das ein Building "upgradet" — es erhält ein visuelles Overlay und +0.05 Building Condition
- **Persona-Echo**: Die "Persönlichkeits-Spur" eines Agenten aus der anderen Simulation. Kann auf einen eigenen Agenten angewendet werden: überträgt 1 Dominant Trait (z.B. "strategic" oder "reckless") mit Story-Kontext
- **Event-Kristallisation**: Ein vergangenes Event der anderen Simulation, "eingefroren". Kann in der eigenen Simulation als Event "ausgelöst" werden — mit angepasstem Narrativ, aber ähnlichem Impact

**Tier 3: Convergence Relics** (Schicht 5-7, extrem selten)
- **Archetype Shard**: Ein Fragment eines der 8 Substrate Archetypes. Kann die `susceptibility` der eigenen Simulation für diesen Archetype permanent um 0.05 ändern (erhöhen ODER senken — Spielerwahl)
- **Reality Anchor**: Stabilisiert eine Zone in der eigenen Simulation permanent. Zone kann nicht unter "Functional" Stability fallen, solange der Anchor aktiv ist. Kann nur einmal pro Simulation existieren
- **Convergence Key**: Öffnet den kombinierten Resonance-Dungeon (z.B. "Tower + Shadow Convergence") für die nächste Resonance-Event-Welle. Dies ist der Zugang zum härtesten Content im Spiel

### Kampf im Sediment

Kampf ist hier **puzzle-basiert, nicht action-basiert**. Hindernisse sind:

1. **Verzerrte Echoes**: Manifest als Szenen vergangener Events, die die Party "durchleben" muss. Agenten mit Memories, die dem Echo ähneln, können es schneller navigieren (pgvector cosine similarity!)
2. **Sediment-Instabilität**: Der Boden bricht. Agenten müssen zusammenarbeiten: Guardian hält den Tunnel stabil, Infiltrator findet den sicheren Pfad, Spy erkennt die nächste Instabilität
3. **Echo-Parasiten**: Entitäten, die sich von Erinnerungen ernähren. Sie "stehlen" Agent-Memories (höchste Importance zuerst!). Kampf = Agenten müssen die Memory schützen, indem sie eine weniger wichtige Memory "opfern"
4. **Bleed-Stürme**: Periodische Events, die alle Agenten-Needs gleichzeitig drainieren. Party muss Schutz finden oder aussitzen. Duration = random, aber vorhersagbar durch Spy-Aptitude

### Multiplayer: Die Gemeinschafts-Expedition

**Kooperativ (2-6 Spieler)**:
- Jeder Spieler kontrolliert 1-2 Agenten in der Expedition
- **Ressourcenteilung**: Relikte müssen aufgeteilt werden. Verhandlung im Chat
- **Tiefere Schichten erfordern mehr Party-Mitglieder**: Layer 5+ braucht mindestens 4 Agenten mit diversem Aptitude-Mix
- **Split-Party Option**: Gruppe teilt sich auf verschiedenen Schichten auf. Riskant, aber effizienter

**Asynchron (persistent über Tage)**:
- Expeditionen laufen über mehrere Real-Zeit-Tage
- Spieler loggen sich ein, treffen Entscheidungen, loggen aus
- Morning Briefing enthält Expedition-Updates neben normalen Sim-Updates
- Andere Spieler können einer laufenden Expedition "beitreten" (Verstärkung schicken)

**Wettbewerb**:
- Wenn zwei Spieler gleichzeitig in dieselbe Sediment-Schicht graben, "stören" sie sich gegenseitig
- Relikte sind begrenzt — wer zuerst gräbt, bekommt den Loot
- Diplomatische Lösung möglich: Spieler einigen sich auf Schicht-Aufteilung

### Warum es Spaß macht

**Architekt**: Das QBN-System (Relikte als narrative Qualitäten) ist elegant skalierbar. Neue Relikte hinzufügen = neue Storylets definieren. Das Echo-Sediment nutzt bestehende Daten (echoes, events, memories) als Content-Generator.

**Game Designer**: Der asynchrone Rhythmus passt perfekt zu einem Spiel, das auf Heartbeat-Ticks basiert. Spieler müssen nicht stundenlang online sein — sie treffen strategische Entscheidungen zwischen den Ticks. Die Risiko/Belohnung-Kurve (tiefere Schichten = besserer Loot, höheres Risiko) ist klar und motivierend.

**UX**: Im Terminal perfekt darstellbar — Narrative Berichte pro Tick, Entscheidungen als Befehle, Relikt-Beschreibungen als Text. Kein Action-Timing nötig.

**Research**: Fallen London/Sunless Sea haben bewiesen, dass QBN-Systeme exzellent skalieren und Spieler über Jahre binden. Die "Resource Narrative"-Philosophie von Alexis Kennedy — Ressourcen, deren Natur mit der Story aligned ist — ist exakt, was Relikte hier sind.

---

# Konzept 4: WAR ROOM OPERATIONS — Taktische Multiplayer-Missionen im Epoch-Kontext

## Inspiration & Research-Basis

- **Keep Talking and Nobody Explodes**: Reine Informations-Asymmetrie. "The real challenge isn't the bomb — it's communicating clearly under pressure."
- **Dead by Daylight**: "Two completely different games." Killer und Survivors spielen fundamental verschiedene Spiele. "No matter how good your plan is, you will have to adjust."
- **XCOM Soldier Bonds**: "Shared negative experiences create the strongest connections." Traumatische Events beschleunigen Bonding dramatisch.
- **Banner Saga**: Morale beeinflusst Willpower in combat. Niedrige Morale manifestiert als narrative Events, nicht Zahlen.
- **Darkest Dungeon Affliction System**: Verlust der Kontrolle über Helden ist der stärkste Mechanismus, damit NPCs lebendig wirken.

## Kernkonzept

Während aktiver **Epochs** (dem bestehenden kompetitiven System) werden **War Room Operations** freigeschaltet: kooperative Multiplayer-Missionen, die im Terminal gespielt werden und direkte Auswirkungen auf den Epoch-Score haben. Statt nur Operatives zu deployen und auf Ergebnisse zu warten, können Spieler und ihre Alliierten jetzt **aktiv an kritischen Operationen teilnehmen**.

### Wie es auf bestehenden Systemen aufbaut

| Bestehendes System | Nutzung |
|---|---|
| **Epoch Phases** (Foundation, Competition, Reckoning) | Verschiedene Operations-Typen pro Phase. Foundation = defensive Ops. Competition = offensive + defensive. Reckoning = desperate Last-Stand Ops |
| **6 Operative Types** | Jeder Operative-Typ hat eine zugehörige Operation. Spy = Infiltration Mission. Guardian = Fortress Defense. Saboteur = Demolition Run. Propagandist = Hearts & Minds. Infiltrator = Embassy Raid. Assassin = Elimination |
| **RP (Resonance Points)** | Operations kosten RP, aber weniger als blinde Deployments (Reward für aktives Spielen). Eine aktiv gespielte Spy-Op kostet 2 RP statt 3, PLUS höhere Erfolgswahrscheinlichkeit |
| **Alliance System** | Alliierte können an derselben Operation teilnehmen. Geteilte Intel, aber +Tension pro gemeinsamer Op (+5 statt +10 für gleiche-Zone Angriffe, weil es koordiniert ist) |
| **Battle Log** | Jede Operation erzeugt detaillierte Battle Log Entries mit Narrativ. Aktiv gespielte Ops erzeugen reichhaltigere, personalisiertere Narrativ-Entries |
| **Fog of War** | Spieler sehen nur Informationen basierend auf eigener Intel. Spy-Ops enthüllen mehr, was für folgende Ops nützlich ist |
| **Agent Aptitudes** | Party-Zusammensetzung basiert auf Aptitude-Mix der drafted Agents |
| **Epoch Scoring (5 Dimensionen)** | Operations beeinflussen Scores direkt: erfolgreiche Spy-Op = +Influence, +Diplomatic. Erfolgreiche Sabotage-Op = -Stability für Target |
| **Bot Player AI** | Solo-Spieler können Operations gegen Bot-kontrollierte Simulationen spielen. Bot Personality (Sentinel, Warlord, etc.) bestimmt Bot-Verteidigungs-Strategie |

### Die 6 Operations-Typen

**1. SPY OPERATION: "Signal Intelligence"**
- **Ziel**: In die Zielsimulation infiltrieren und Intel sammeln
- **Spielmechanik**: Stealth-Navigation durch feindliche Zonen. Spy-Agent muss Überwachungspunkte erreichen, ohne entdeckt zu werden
- **Multiplayer-Twist** (Keep Talking Pattern): Spy-Spieler ist "blind" — sieht nur den aktuellen Raum. Der alliierte Spieler sieht eine Karte mit Patrol-Routen, aber NICHT den Spy. Kommunikation per Chat ist die einzige Verbindung
- **Erfolg**: Intel-Snapshot der gesamten Zielsimulation (alle Zone Security Levels, Guardian-Positionen, Fortifications). Scoring: +3 Influence, +2 Diplomatic
- **Fehlschlag**: Spy-Agent wird captured (3 Ticks blockiert). Gegner erfährt, dass gespied wurde
- **Agent-Stress**: Spy-Ops sind moderate-stress. Agenten mit hoher Spy-Aptitude fühlen sich "in their element" (+5 Purpose)

**2. GUARDIAN OPERATION: "Bastion Protocol"**
- **Ziel**: Eigene Zone gegen eingehenden Angriff verteidigen
- **Spielmechanik**: Tower-Defense im Text-Format. Der Spieler positioniert Guardian-Agenten an Verteidigungspunkten. Angriffswellen kommen in Runden. Jede Runde: Entscheiden, welche Position verstärkt, welche aufgegeben wird
- **Multiplayer-Twist**: Alliierte können Verstärkung schicken (eigene Agenten als Gastverteidiger). Koordination über Positionierung und Timing
- **Erfolg**: Angriff abgewehrt. Scoring: +5 Sovereignty, +2 Stability. Zone Fortification verlängert um 3 Ticks
- **Fehlschlag**: Zone verliert Security Level. Scoring: -4 Stability, -2 Sovereignty
- **Agent-Stress**: Guardian-Ops sind high-stress. Aber: Agenten mit hoher Guardian-Aptitude erhalten "Held the Line" Moodlet (+20 Purpose, +15 Safety, "protector's pride")

**3. SABOTEUR OPERATION: "Controlled Demolition"**
- **Ziel**: Infrastruktur in der Zielsimulation beschädigen
- **Spielmechanik**: Timed Puzzle — der Spieler hat N Runden, bevor Sicherheit reagiert. Muss das richtige Ziel identifizieren (welches Building, wenn zerstört, maximalen Schaden anrichtet?) und Sabotage-Sequenz korrekt ausführen
- **Multiplayer-Twist**: Ein Spieler platziert Ladungen, der andere überwacht Patrouillen und gibt Timing-Fenster durch. Koordination ist essentiell
- **Erfolg**: Ziel-Building Condition sinkt um 1 Stufe. Scoring: -6 Stability für Target. Wenn ein kritisches Building getroffen (hospital, power): -8 Stability
- **Fehlschlag**: Saboteur-Agent captured. Alert in Zielsimulation steigt permanent für diesen Epoch
- **Agent-Stress**: Saboteur-Ops sind moderate-stress für erfahrene Agenten (hohe Saboteur-Aptitude). Moral-Dilemma: Zerstörung eines Hospitals ist effektiver, erzeugt aber negative Moodlets bei Agenten mit hoher Agreeableness ("destroyed a hospital" -15 Purpose, "guilt")

**4. PROPAGANDIST OPERATION: "Hearts & Minds"**
- **Ziel**: Narrative Kontrolle über die Zielsimulation gewinnen
- **Spielmechanik**: Social Engineering im Text-Format. Der Spieler "chattet" (über das bestehende Chat-System) mit NPCs der Zielsimulation und versucht, sie zu überzeugen/manipulieren. Jeder NPC hat Personality Traits, die bestimmen, welche Argumente funktionieren
- **Multiplayer-Twist**: Zwei Spieler targetn verschiedene NPC-Gruppen gleichzeitig. Wenn beide erfolgreich, entsteht ein "coordinated propaganda wave" mit doppeltem Scoring-Effekt
- **Erfolg**: Propaganda-Event in Zielsimulation erzeugt. Scoring: +5 Influence, -6 Sovereignty für Target
- **Fehlschlag**: NPCs erkennen Manipulation. Counter-Propaganda-Event in eigener Simulation. Scoring: -3 Influence
- **Agent-Stress**: Propagandist-Ops sind low-stress mechanisch, aber können psychologisch belasten: Agenten mit hoher Agreeableness und hohem Honesty-Wert erhalten "compromised values" Moodlet wenn sie erfolgreich lügen

**5. INFILTRATOR OPERATION: "Embassy Raid"**
- **Ziel**: Feindliche Embassy kompromittieren
- **Spielmechanik**: Multi-Stage Infiltration. Stage 1: Approach (Stealth). Stage 2: Breach (Technischer Puzzle). Stage 3: Extraction (Zeitdruck-Flucht). Jede Stage hat unterschiedliche Aptitude-Anforderungen
- **Multiplayer-Twist** (We Were Here Pattern): Spieler A ist im Embassy-Gebäude (sieht Wachen, Fallen, Schlösser). Spieler B hat den Building Blueprint (sieht Raumlayout, Sicherheitssysteme, Ventilationsschächte). Keiner hat alle Informationen
- **Erfolg**: Embassy Effectiveness reduziert um 65% für 3 Ticks. Scoring: +3 Influence, -8 Sovereignty für Target
- **Fehlschlag**: Agent captured. Eigene Embassy-Verbindung unter Verdacht
- **Agent-Stress**: Infiltrator-Ops sind high-stress. Erfolgreiche Infiltration erzeugt "adrenaline high" Moodlet (+10 Stimulation) gefolgt von "post-op crash" (-10 Comfort nach 2 Ticks)

**6. ASSASSIN OPERATION: "Elimination Protocol"**
- **Ziel**: Feindlichen Ambassador blocken
- **Spielmechanik**: Die mechanisch anspruchsvollste Operation. Ein einziger Fehlschlag = Mission-Abort. Der Spieler muss das Ziel lokalisieren, Zugang erhalten, und eliminieren — alles in einer begrenzten Anzahl von Runden
- **Multiplayer-Twist**: Der Verteidiger (wenn online) kann versuchen, seinen Ambassador zu schützen — ein asymmetrisches Cat-and-Mouse Spiel im Terminal
- **Erfolg**: Target Ambassador blocked für 3 Ticks. Scoring: -5 Stability für Target, -12 Sovereignty für Target
- **Fehlschlag**: Assassin captured. Schwerer diplomatischer Skandal. Scoring: -5 Diplomatic für Angreifer
- **Agent-Stress**: Assassin-Ops sind extreme-stress. Erfolg: "killer's focus" Moodlet (0 emotion, +3 Assassin Aptitude für 2 Ticks, aber -15 Social, "emotionally numb"). Fehlschlag: "failed hit" Moodlet (-20 Purpose, -15 Safety)
- **Moralischer Aspekt**: Agenten mit Personality Trait "compassionate" oder hoher Agreeableness weigern sich, Assassination-Ops auszuführen. Man MUSS Agenten mit dem richtigen Persönlichkeitsprofil auswählen — ein narrativ und mechanisch befriedigender Constraint (CK3 stress-when-acting-against-personality)

### Der Verteidiger-Aspekt (Dead by Daylight Pattern)

Wenn ein Spieler angegriffen wird, erhält er eine Notification:

```
[ALERT] OPERATIVE DETECTED — Type: SABOTEUR — Target: Industrial Zone
[SYSTEM] You may activate COUNTER-OPERATION to defend.
Cost: 2 RP | Duration: ~10 minutes active play

Accept counter-operation? [yes/no]
```

Wenn akzeptiert, wechselt der Verteidiger in den **Counter-Op Modus**:
- Sieht seinen eigenen Zone-Layout von der Verteidiger-Perspektive
- Muss den Eindringling finden und neutralisieren
- Hat Heim-Vorteil: kennt das Layout, kann Fallen aktivieren, Guardian-Agenten mobilisieren
- Der Angreifer sieht den Counter-Op NICHT kommen (es sei denn, Spy-Intel hat den Guardian entdeckt)

Dies schafft **asymmetrisches, gleichzeitiges Gameplay**: Beide Spieler spielen in Echtzeit dasselbe Szenario aus verschiedenen Perspektiven.

### Warum es Spaß macht

**Architekt**: Jede Operation ist mechanisch verschieden, nutzt aber denselben Terminal-Command-Parser, dasselbe Aptitude-Check-System, und dasselbe Narrative-Output-Format. 6 Operations × 2 Perspektiven (Angreifer + Verteidiger) = 12 verschiedene Erlebnisse aus einem System.

**Game Designer**: Das RP-Discount für aktives Spielen (2 RP statt 3) incentiviert aktive Teilnahme ohne passive Spieler zu bestrafen. Spieler, die mehr Zeit investieren, erhalten bessere Ergebnisse — aber Spieler, die nur deployen wollen, können das weiterhin. Die asymmetrische Verteidiger-Mechanik bedeutet, dass man nie weiß, ob der Gegner aktiv verteidigt oder nicht — pure Spannung (Dark Souls "you don't know if it's human or AI").

**UX**: Operations sind zeitlich begrenzt (10-20 Minuten aktives Spiel), perfekt für Sessions zwischen den Epoch-Ticks. Quick Actions für Operations-spezifische Befehle. Clear win/lose conditions.

**Research**: XCOM beweist, dass geteilte Gefahr die stärksten Charakter-Bonds erzeugt. Dead by Daylight beweist, dass asymmetrisches Multiplayer-Design zwei fundamental verschiedene, gleichermaßen fesselnde Spiele erzeugen kann. Keep Talking beweist, dass Informations-Asymmetrie + Zeitdruck die beste kooperative Spannung erzeugt.

---

# Konzept 5: THE LIVING LABYRINTH — Agenten-getriebene Emergente Dungeons

## Inspiration & Research-Basis

- **Dwarf Fortress Legends Mode**: "Thousands of stories lie buried in each history generated." Keine eingebetteten Narrativen — alles emergent.
- **RimWorld Storyteller AI**: Cassandra, Phoebe, Randy — drei verschiedene "literarische Genres" durch algorithmische Autoren. "Players become co-authors with the algorithm."
- **Crusader Kings 3**: "Character focus" — jede Entität ist ein benannter Charakter mit Traits, Relationships, Opinions. "Wars aren't abstract — they're personal feuds."
- **Stanford Generative Agents**: Memory Stream → Reflect → Plan cognitive loop. Das bestehende Agent-Memory-System basiert bereits darauf.
- **Persona Social Links**: Mechanische Belohnungen für emotionale Investition. "Gating social links behind personal stat requirements creates a virtuous cycle."
- **Banner Saga**: "Low morale manifests as narrative events rather than meter changes. It seems invisible to the player but they feel the caravan is unhappy."

## Kernkonzept

Der Living Labyrinth ist ein **permanenter, sich ständig verändernder Dungeon innerhalb der eigenen Simulation**, der von den Agenten der Simulation selbst generiert und bevölkert wird. Er entsteht aus der Kollision von Agent-Memories, ungelösten Narrative Arcs, und unterdrückten Emotionen der Agenten. Er ist die **Manifestation des kollektiven Unbewussten** der Simulation.

Spieler betreten das Labyrinth NICHT allein — sie wählen Agenten als Party. Aber anders als in den anderen Konzepten sind die **Agenten hier nicht nur Werkzeuge, sondern die Schlüssel**: Das Labyrinth formt sich um die Memories, Persönlichkeiten, und Beziehungen der mitgenommenen Agenten herum.

### Wie es auf bestehenden Systemen aufbaut

| Bestehendes System | Nutzung |
|---|---|
| **Agent Memories (pgvector, 1536-dim)** | Räume des Labyrinths werden aus Agent-Memories generiert. High-importance Memories = Schlüsselräume. Cosine Similarity zwischen Memories bestimmt, welche Räume verbunden sind |
| **Agent Opinions (-100 bis +100)** | Beziehungen zwischen Party-Agenten beeinflussen Labyrinth-Struktur. Feindliche Agenten (Opinion < -30) erzeugen "Conflict Rooms" — Räume, die nur gelöst werden, wenn der Konflikt adressiert wird |
| **Agent Personality Profile** | Bestimmt die "Flavor" der generierten Räume. Ein Agent mit hoher Openness erzeugt surreale, abstrakte Räume. Hohe Conscientiousness = strukturierte, regelbasierte Räume. Hoher Neurotizismus = Horrorräume |
| **Agent Mood + Stress + Moodlets** | Aktive Moodlets der Agenten manifestieren als Dungeon-Elemente. Agent mit "bereavement" Moodlet? Der Labyrinth enthält einen Trauerraum. "Promotion" Moodlet? Ein Triumphbogen-Raum |
| **Agent Needs** | Niedrige Needs erzeugen "Need-Rooms": Social < 20? Ein Raum voller Stimmen, die den Agenten rufen. Purpose < 20? Ein leerer Raum mit einer einzelnen Frage: "Warum bist du hier?" |
| **Agent Relationships** | Beziehungs-Typen erzeugen spezifische Raumtypen: "rival" = Duell-Arena. "mentor" = Weisheits-Bibliothek. "family" = Heim-Fragment |
| **Narrative Arcs** | Ungelöste Narrative Arcs der Simulation manifestieren als Dungeon-Quests. Ein "building, active" Arc = eine Questline im Labyrinth, die, wenn gelöst, den Arc vorantreibt |
| **Events (Impact >=7)** | Traumatische Simulation-Events manifestieren als "Scar Rooms" — besonders gefährliche Räume, die aber bei Abschluss Scar Tissue der Simulation heilen |
| **Building Types** | Labyrinth-Räume spiegeln reale Buildings der Simulation wider. Das Hospital wird zum Healing-Raum. Die Kaserne zum Trainingsraum. Das Theater zum Illusionsraum |
| **Autonomous Activities** | Agenten, die im Labyrinth waren, generieren danach spezifische Autonomous Activities: "reflect on labyrinth experience", "discuss labyrinth with [other agent]", "dream about the deep rooms" |

### Dungeon-Generierung: Wie das Labyrinth entsteht

Das Labyrinth wird **prozedural aus Spieldaten generiert** — kein handgefertigter Content nötig:

**Schritt 1: Memory-Clustering**
Das System nimmt die Top-20 Memories (by importance) aller Party-Agenten und clustert sie per Cosine Similarity. Jeder Cluster wird ein "Raum-Thema".

**Schritt 2: Relationship-Graph → Room-Connections**
Agenten-Beziehungen werden zu Raum-Verbindungen. Wenn Agent A und Agent B eine "rival" Beziehung haben, sind ihre Memory-Räume durch einen "Conflict Corridor" verbunden. "Ally" Beziehung → offener Durchgang. "Family" → versteckter Geheimgang.

**Schritt 3: Need-Rooms als Hindernisse**
Jedes niedrige Need (< 30) eines Party-Agenten erzeugt einen "Need-Room" — ein Raum, der blockiert, bis das Need adressiert wird. Die Lösung: ein anderer Agent interagiert mit dem blockierten Agenten (Talk-Command, basierend auf dem bestehenden Chat-System).

**Schritt 4: Narrative Arc als Quest**
Wenn die Simulation einen aktiven Narrative Arc hat (z.B. "Tower + Shadow Convergence, building"), wird dieser als zentrale Questline im Labyrinth dargestellt. Der "Boss" des Labyrinths ist die Manifestation des Arc-Themas.

**Schritt 5: Scar Rooms aus Events**
Jedes Event mit Impact >= 7 aus den letzten 30 Tagen erzeugt einen "Scar Room" — einen besonders atmosphärischen, gefährlichen Raum, der die narrative Wunde der Simulation darstellt.

### Gameplay-Beispiel

```
> enter labyrinth with Kovacs, Mira, Voss

[SYSTEM] THE LIVING LABYRINTH OPENS

The walls shift into place as your party's memories take form. Three
agents, three lifetimes of experience — the labyrinth reads them all.

You feel it immediately: the tension between Kovacs and Voss hangs in the
air like static electricity. Their rivalry (Opinion: -35) has manifested
as a wall of thorns between two corridors. You'll need to address that
before you can reach the deeper rooms.

Mira's anxiety (Safety: 18) has created something else — a door that
pulses with a low, insistent hum. Behind it, voices call her name. She
grips your sleeve. "I... I'd rather not go that way. Not yet."

CURRENT ROOM: The Threshold
This room is formed from shared memories — the simulation's founding
moment. Every agent recognizes fragments. The walls display faded images
of buildings you know well, but subtly wrong.

Exits:
- North: Kovacs' Memory Corridor (Spy 8 resonance — locked safe rooms)
- East: The Thorned Passage (BLOCKED — Kovacs/Voss conflict)
- South: The Humming Door (LOCKED — Mira's Safety need)
- Down: The Scar Chamber (Impact 8 Event: "The Altstadt Uprising")

Agent Status:
- Kovacs: Alert, curious. "I've seen this place in my dreams."
- Mira: Trembling. Safety critically low. Refuses to approach the Humming Door.
- Voss: Aggressive stance. Staring at Kovacs. "Don't trust him in here."
```

**Lösung der Konflikte als Gameplay**:

```
> talk to Voss about Kovacs

You sit with Voss in the flickering light. His jaw is tight.

Voss: "He left me during the last operation. I was pinned down and he
chose the objective over me. I don't care about his reasons."

[CHOICE]
1. "He made a tactical decision. Professionals don't hold grudges."
   (Requires: Agent with Propagandist Aptitude >= 5)
   Effect: -10 Stress for Voss, but Opinion only improves +5 (shallow fix)

2. "Tell him how it made you feel. Not as an operative — as a person."
   (Requires: Agent with Social need >= 40 in party)
   Effect: -20 Stress for Voss, Opinion +15, Moodlet "acknowledged" (+10 Social)
   But: Voss becomes temporarily Vulnerable (-10% combat for 3 rooms)

3. "I'll make sure it doesn't happen again. You have my word."
   (Requires: Player has never abandoned an agent in a previous run)
   Effect: -15 Stress, Opinion +10, Trust Bond formed (permanent)

4. [Say nothing. Let the thorns stay.]
   Effect: Thorned Passage remains blocked. Must find alternate route.
```

Die **Hades Dialogue-Queue** wird hier genutzt: Jedes Gespräch zieht aus dem bestehenden Agent-Memory-Pool und den Opinion-Modifiern. Responses basieren auf dem Agenten-Personality-Profile und aktuellem Mood. Das bestehende Chat-AI-System generiert die Agent-Dialoge.

### Loot: Persönliche Wachstum statt Items

Das Labyrinth gibt keine "Gegenstände" — es gibt **Charakter-Wachstum**:

| Labyrinth-Element | Belohnung bei Lösung |
|---|---|
| **Conflict Room** (Opinion < -30) | Wenn Konflikt gelöst: Permanenter Opinion-Modifier +20-30 zwischen den Agenten. "Resolved our differences in the labyrinth." Stärkste Bonds im Spiel (XCOM shared-trauma Prinzip) |
| **Need-Room** (Need < 30) | Wenn Need adressiert: Need steigt auf 50+. Agent erhält permanentes Resilience +0.05. "Found what I was looking for" |
| **Memory-Room** (High-importance Memory) | Wenn Memory konfrontiert: Agent erstellt eine Reflection-Memory (automatisch). Importance aller verwandten Memories steigt. Agent "verarbeitet" die Erfahrung |
| **Scar Room** (Impact >= 7 Event) | Wenn Scar geheilt: Simulation's scar_tissue_delta sinkt um 0.05. Die narrative Wunde beginnt zu heilen. Agent erhält "healer of wounds" Moodlet (+15 Purpose, permanent) |
| **Narrative Arc Boss** | Wenn besiegt: Arc Status wechselt von "active"/"climax" zu "resolving". Enormer Einfluss auf die Simulation-Narrative. Agent erhält +1 auf die Aptitude, die im Kampf am meisten genutzt wurde |
| **Hidden Room** (nur zugänglich wenn ALLE Party-Opinions > +20) | "Unity Fragment" — alle Party-Agenten erhalten permanent +0.1 auf Sociability. Team-Bonus: wenn diese Agenten gemeinsam in einem Epoch deployed werden, +5% auf alle Checks |

### Der "Boss": Die Manifestation

Jedes Labyrinth hat einen zentralen Gegner — die **Manifestation** des dominanten Narrative Arc oder des stärksten Scar-Events:

- Die Manifestation ist kein abstraktes Monster — sie ist eine **verzerrte Version eines bekannten Agenten oder Events**
- Kampf ist nicht physisch — er ist **dialogisch** und **psychologisch**
- Die Party muss die Manifestation "dekonstruieren", indem sie die richtige Kombination aus Memories, Beziehungen, und Persönlichkeiten einsetzt
- Beispiel: Die Manifestation des "Altstadt Uprising" Events ist eine verzerrte Version des Agenten, der im Event am stärksten betroffen war. Die Party muss diesen Agenten (wenn in der Party) dazu bringen, die Erinnerung zu konfrontieren (Talk-Command + spezifische Memory-Referenz)

### Multiplayer

**Kooperativ (2-4 Spieler)**:
- Jeder Spieler bringt 1-2 Agenten. Das Labyrinth wird komplexer (mehr Memories = mehr Räume = tieferes Labyrinth)
- Agenten verschiedener Spieler können Opinions zueinander haben (aus gemeinsamen Epoch-Erfahrungen)
- Cross-Simulation Conflict Rooms: Wenn Agenten aus verschiedenen Simulationen im Labyrinth sind, können INTER-Simulations-Konflikte auftreten (z.B. Erinnerungen an Epoch-Kämpfe gegeneinander)

**Emergente Narrative** (Dwarf Fortress/RimWorld Pattern):
- Jeder Labyrinth-Run erzeugt eine "Labyrinth Chronicle" — ein automatisch generierter Bericht der Ereignisse
- Diese Chronicles werden Teil der Simulation-Lore (neues Lore-Kapitel: "The Labyrinth Descent of [Date]")
- Agent-Autonomous-Activities nach einem Labyrinth-Run referenzieren die Erlebnisse: "Agent Kovacs was seen staring at the wall where he confronted his memories of the Altstadt Uprising"
- Andere Agenten (die NICHT im Labyrinth waren) hören Geschichten und entwickeln Opinions ("jealous of labyrinth experience", "worried about agent's sanity after labyrinth")

### Wiederspielbarkeit

Das Labyrinth ist **jedes Mal anders**, weil es aus aktuellen Spieldaten generiert wird:
- Neue Events = neue Scar Rooms
- Veränderte Agent-Opinions = neue Conflict Rooms
- Veränderte Needs = neue Need-Rooms
- Neue Memories = neue Memory-Rooms
- Verschiedene Party-Zusammensetzung = komplett anderes Layout

Ein Spieler, der regelmäßig das Labyrinth betritt, sieht die **Evolution seiner Simulation** durch die Linse der Agenten-Psychologie. Das Labyrinth wird zum Spiegel des Spiel-Fortschritts.

### Warum es Spaß macht

**Architekt**: Zero handcrafted content nötig. Das Labyrinth generiert sich aus bestehenden Daten (Memories, Opinions, Needs, Events, Narrative Arcs). Jede neue Spielaktion erzeugt automatisch neuen Labyrinth-Content.

**Game Designer**: Die Belohnungsstruktur ist einzigartig — statt "stärkere Waffen" bekommt der Spieler "tiefere Beziehungen zwischen Agenten". Das klingt abstrakt, hat aber massive gameplay-Auswirkungen: Agenten mit starken Bonds performen besser in Epochs, harmonischere Simulationen haben höhere Overall Health, und gelöste Narrative Arcs reduzieren Scar Tissue. Der Loop ist: Labyrinth verbessert Agenten → bessere Agenten verbessern Simulation → verbesserte Simulation erzeugt interessanteres Labyrinth.

**UX**: Die persönliche Natur des Labyrinths (es IST die Psyche deiner Agenten) erzeugt emotionale Investition, die kein generischer Dungeon erreichen kann. Spieler entdecken Dinge über ihre eigenen Agenten, die sie nicht wussten — "Ich wusste nicht, dass Kovacs diese Memory hat" oder "Ich hatte vergessen, wie schlecht die Beziehung zwischen Mira und Voss war."

**Research**: Stanford Generative Agents beweisen, dass Memory-gesteuerte NPCs faszinierende emergente Verhaltensweisen erzeugen. Crusader Kings beweist, dass character-driven procedural drama die stärkste Form emergenter Narrative ist. Persona beweist, dass mechanische Belohnungen für Beziehungsarbeit einen virtuosen Zyklus erzeugen. Banner Saga beweist, dass Morale am stärksten wirkt, wenn sie als Narrative statt als Zahl erlebt wird.

---

# Zusammenfassung: Die 5 Konzepte im Vergleich

| | Breach Operations | Resonance Dungeons | Echo Expeditions | War Room Ops | Living Labyrinth |
|---|---|---|---|---|---|
| **Spielertyp** | Competitive, Risk-taker | Explorer, Collector | Strategist, Planner | PvP Warrior, Coordinator | Roleplayer, Story-seeker |
| **Dauer** | 15-30 min Session | 20-45 min Session | 2-5 Tage (async) | 10-20 min Session | 30-60 min Session |
| **Multiplayer** | 2-3 Kooperativ + Verteidiger | 2-4 Kooperativ | 2-6 Kooperativ | 2v1 Asymmetrisch | 2-4 Kooperativ |
| **Primärer Loot** | Sim-wide Buffs, Building Upgrades | Agent Aptitude +1, Personality Shifts | Narrative Relics, Lore | Epoch Score Direct Impact | Agent Bonds, Psychological Growth |
| **Risiko** | Agent Capture, Stress | Agent Affliction, Stress | Resource Loss, Time | RP Cost, Agent Capture | Emotional Weight, Agent Stress |
| **Bestehende Systeme** | Embassies, Bleed, Aptitudes, Fog of War | Resonances, Personality, Heartbeat | Echoes, Memories, Events | Epochs, Operatives, RP, Alliances | Memories, Opinions, Needs, Narrative Arcs |
| **Content-Quelle** | Andere Spieler-Sims | 8 Archetypen × Prozedur | Echo-History | Epoch-Kontext | Agent-Psychologie |
| **Unique Selling Point** | Cross-Sim PvPvE | Thematische Tiefe & Vielfalt | Async Strategie, QBN Loot | Direct Competitive Impact | Zero Handcrafted Content |

## Implementierungs-Priorität (Empfehlung)

1. **Living Labyrinth** — Am tiefsten mit bestehenden Systemen verwoben. Null zusätzlicher Content nötig. Fördert Agent-Investment. Das "Herzstück".
2. **War Room Operations** — Direkte Integration in das bestehende Epoch-System. Macht Epochs aktiver und spannender. Der "kompetitive Treiber".
3. **Breach Operations** — Nutzt Embassy/Bleed-Systeme auf neue Art. Cross-Sim Content. Der "Multiplayer-Magnet".
4. **Resonance Dungeons** — Die 8 Archetypes liefern 8 verschiedene Erlebnisse. Der "Content-Multiplikator".
5. **Echo Expeditions** — Am unabhängigsten, kann parallel zu allem anderen entwickelt werden. Der "ruhige Stratege".

---

## Nächste Schritte

Dieses Dokument ist ein **Konzeptpapier**, kein Implementierungsplan. Vor der Implementierung eines dieser Konzepte müssten:
1. Backend-Datenmodelle designed werden (breach_instances, dungeon_rooms, relics, etc.)
2. Terminal-Command-Erweiterungen spezifiziert werden
3. LLM-Prompt-Templates für narrative Generierung erstellt werden
4. Balancing-Simulationen durchgeführt werden (Aptitude-Checks, Stress-Kurven, Loot-Werte)
5. Frontend-Terminal-Modus-Erweiterungen designed werden (Dungeon UI vs. Normal UI)
