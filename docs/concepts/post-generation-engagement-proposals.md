# Feature Proposals: Post-Generation Engagement Deep Dive

> **Status (2026-03-22):** Proposal 1 (The Living World) is **fully implemented** -- see Implementation Log below.

## Context

**Problem:** After a user generates a world via the Forge (4-phase AI pipeline), the available gameplay loop narrows significantly. Users can manage entities (CRUD), join Epochs (PvP), read lore/chronicles, and chat with agents -- but there's no persistent "reason to return" beyond manual content management and periodic PvP seasons. The world feels static between player sessions: agents don't evolve, zones don't develop, and the rich simulation data doesn't generate emergent discovery.

**Goal:** 8 feature proposals from the combined perspective of game designer, lore specialist, literature professor, game marketing specialist, and ARG specialist -- each precisely aligned with the existing technical architecture (79 tables, 47 routers, 150+ components, Supabase + FastAPI + Lit 3).

**Research basis:** Extensive analysis of Dwarf Fortress, RimWorld, Crusader Kings III, Caves of Qud, EVE Online, Fallen London, Stanford Generative Agents, Neurocracy, Cicada 3301, Perplex City, Hades, Shadow of Mordor's Nemesis System, Victoria 3, Destiny 2 seasonal model, and 30+ additional sources.

---

## Proposal 1: The Living World (Autonome Agentenwelt)

### Perspektive: Game Designer + Lore Specialist

**Core Idea:** Agents act autonomously between player sessions. When you return, your world has *lived* -- relationships shifted, opinions formed, conflicts emerged, alliances fractured. You receive a narrative "morning briefing" of what happened while you were away, and must decide how to respond.

### Was der User tun kann:
- **Tägliche Entdeckung:** Login → narrative Zusammenfassung der Nacht (wer hat sich gestritten, wer hat sich verliebt, welche Zone hat eine Krise erlebt)
- **Intervention:** Entscheidungen treffen bei Konflikten, die Agents autonom generiert haben
- **Beobachten:** Agent-Tagesroutinen verfolgen (wohin gehen sie, mit wem reden sie)
- **Lenken:** Agents "Direktiven" geben, die ihre autonome Entscheidungsfindung beeinflussen (nicht kontrollieren)

### Forschungsbasis:
- **Stanford Generative Agents (2023):** 3-Schichten-Architektur: Memory Stream → Reflection → Planning. 25 AI-Agents organisierten autonom eine Valentinstagsparty. Die Architektur ist direkt anwendbar auf das bestehende `agent_memories` + pgvector-System.
- **Dwarf Fortress:** ~50 Persönlichkeitsachsen pro Charakter. Erinnerungen an spezifische Events verfallen über Zeit, extreme bleiben permanent. Stress-Kaskaden: ein unglücklicher Agent → Tantrum → beschädigt Gebäude → macht andere Agents unglücklich → Kettenreaktion.
- **RimWorld:** Meinungsmodifikatoren mit Verfallszeit ("wurde beleidigt: -15 für 5 Tage", "wurde gerettet: +25 für 30 Tage"). Einfach, aber erzeugt lesbare soziale Dynamiken.

### Technische Passung:
- `agent_memories` Tabelle + pgvector Embeddings existieren bereits
- `heartbeat_service.py` tickt bereits die Simulation (Event-Aging, Zone-Pressure)
- `event_reactions` System existiert (Agents reagieren emotional auf Events)
- `agent_relationships` mit Intensity 1-10 und bidirektionaler Richtung vorhanden
- Erweiterung: Heartbeat um autonome Agent-Entscheidungslogik erweitern (ähnlich `bot_personality.py` Decision Engine)

### Implementierungsansatz:
1. **Agent Daily Planner** (neuer Service): Beim Heartbeat-Tick berechnet jeder Agent eine Tagesaktivität basierend auf Persönlichkeit + aktuellem emotionalen Zustand + Beziehungsgraph
2. **Meinungssystem** (neue Tabelle `agent_opinions`): Agents akkumulieren gewichtete Meinungen über andere Agents, Gebäude, Zonen -- mit Verfallszeit
3. **Autonome Events**: Agents generieren selbst kleine Events (Streit, Kooperation, Entdeckung) wenn ihre Meinungs-Schwellwerte überschritten werden
4. **Morning Briefing Enhancement**: Bestehender `DailyBriefingModal` erweitert um Agent-autonome Aktivitäten als narrative Zusammenfassung

### Engagement-Loop:
```
Login → Morning Briefing (was ist passiert?) → Entdeckung (wer hat was getan?)
→ Intervention (Konflikte lösen, Direktiven geben) → Logout
→ Agents handeln weiter → nächster Login
```

### Geschätzter Scope: Groß (neuer Service, DB-Tabellen, Heartbeat-Erweiterung, UI)

---

## Proposal 2: Das Omnipedia (Lebendige In-World-Enzyklopädie)

### Perspektive: Literaturprofessor + Lore Specialist

**Core Idea:** Jede Simulation generiert automatisch eine in-world Enzyklopädie -- nicht als statisches Lore-Dokument (das existiert bereits), sondern als *lebendige Wissenssammlung* die sich mit jedem Event, jeder Beziehungsänderung, jedem Epoch-Ergebnis aktualisiert. Inspiriert von Neurocracy (fiktionales Wikipedia mit Revisionshistorie) und Borges' *Tlön, Uqbar, Orbis Tertius*.

### Was der User tun kann:
- **Entdecken:** Durch verknüpfte Artikel navigieren (Agent → erwähnt Gebäude → verlinkt zu Zone → referenziert historisches Event)
- **Revisionen vergleichen:** Sehen, wie sich die "offizielle" Beschreibung eines Agents verändert hat, nachdem ein skandalöses Event stattfand
- **Widersprüche finden:** Verschiedene Agents haben verschiedene "Versionen" der Geschichte -- wem glaubst du?
- **Annotieren:** Eigene Notizen und Theorien zu Artikeln hinzufügen
- **Zitieren:** In Epoch-Chat oder sozialen Medien auf spezifische Omnipedia-Einträge verlinken

### Forschungsbasis:
- **Neurocracy (2021):** Fiktionales Wikipedia ("Omnipedia") mit 10 wöchentlichen Episoden. Revisionshistorie zeigt Weltveränderungen. Gewinner des New Media Writing Prize. Beweist: *Weltdaten als navigierbare Enzyklopädie mit Revisionshistorie ist fesselnder als statische Lore-Dokumente.*
- **Her Story (2015):** Suchbasierte Entdeckung -- Spieler tippen Begriffe und finden relevante Clips. Die Untersuchung IST das Suchen. Anwendbar auf eine durchsuchbare Wissensbank.
- **Caves of Qud:** Prozedural generierte Sultan-Biografien werden als in-world Artefakte (Wandmalereien, Statuen, Bücher) entdeckt. Geschichte wird nicht erzählt, sondern *ausgegraben*.

### Technische Passung:
- `simulation_lore` existiert als statisches Dokument (5-7 Abschnitte)
- `agents`, `buildings`, `events`, `zones` haben alle Full-Text-Search (`tsvector` + GIN Indices)
- `event_reactions` + `agent_relationships` + `event_echoes` liefern die Daten für Querverbindungen
- `simulation_chronicles` existiert als AI-Zeitung -- Omnipedia ist die enzyklopädische Ergänzung
- Bestehende `audit_log` Tabelle loggt alle Mutationen -- kann als Basis für "Revisionshistorie" dienen

### Implementierungsansatz:
1. **Omnipedia-Artikel-Generator** (neuer Service): Nach jedem signifikanten Event generiert AI einen kurzen enzyklopädischen Artikel (oder aktualisiert bestehende)
2. **Verknüpfungsgraph**: Automatische Erkennung von Entity-Referenzen in Artikeln → Hyperlinks
3. **Revisionssystem**: Jede Aktualisierung speichert die vorherige Version → Diff-Ansicht
4. **Perspektiven-System**: Verschiedene Agent-"Autoren" schreiben unterschiedliche Versionen des gleichen Events
5. **Frontend**: Neues `OmnipediaView` Component mit Wiki-Navigation, Suchleiste, Revisionshistorie

### Engagement-Loop:
```
Event passiert → Omnipedia aktualisiert sich → User entdeckt neue/geänderte Artikel
→ findet Widersprüche zwischen Agent-Perspektiven → untersucht weiter
→ annotiert eigene Theorie → teilt im Chat/Social Media
```

### Geschätzter Scope: Mittel-Groß (AI-Generierung, neues DB-Schema, neues Frontend-View)

---

## Proposal 3: Bureau Case Files (Investigationsgameplay)

### Perspektive: ARG Specialist + Game Designer

**Core Idea:** Das Bureau of Impossible Geography erhält ein strukturiertes Investigations-System. Spieler erhalten "Case Files" -- mehrstufige Mysterien, die sie durch Befragung von Agents (via bestehendem Chat), Untersuchung von Events, Analyse von Bleed-Mustern und Entschlüsselung von Cipher-Codes lösen. Jeder Case verbindet ARG-Elemente mit In-Game-Mechaniken.

### Was der User tun kann:
- **Cases annehmen:** Bureau weist dir einen Fall zu (anomaler Bleed, verschwundener Agent, unerklärliches Event)
- **Agents befragen:** Im Chat-System Beweisstücke "präsentieren" und Agents reagieren basierend auf ihrem Wissen
- **Beweise sammeln:** Events, Agent-Aussagen, Zone-Daten als "Beweisstücke" in einer Evidence-Board-UI sammeln
- **Verbindungen ziehen:** Beweisstücke visuell verbinden, um Theorien zu bilden
- **Cipher lösen:** ARG-Codes aus Instagram-Posts als Schlüssel für Case-Fortschritt verwenden
- **Cross-Sim ermitteln:** Manche Cases führen über Simulations-Grenzen hinweg (Bleed-Events verfolgen)

### Forschungsbasis:
- **Return of the Obra Dinn:** "Identity Web" -- 60 Schicksale, jedes erfordert Kreuzreferenzierung mehrerer Szenen. Bestätigung in 3er-Gruppen verhindert Brute-Force. *Anwendbar: Cases bestätigen Lösungen erst wenn mehrere Beweisstücke zusammenpassen.*
- **Her Story:** Suchbasierte Entdeckung -- die Untersuchung IST das Gameplay. *Anwendbar: Agent-Chat als Befragungswerkzeug, Omnipedia-Suche als Ermittlungsmethode.*
- **Phoenix Wright:** Beweis-Präsentation in Gesprächen → NPC reagiert anders je nach Relevanz des Beweises. *Direkt anwendbar auf das bestehende Chat-System: "Beweismodus" im Agent-Chat.*
- **Disco Elysium:** Interne Gedanken-Checks ("Inland Empire flüstert...") als narratives Feedback-System. *Anwendbar: Bureau-Kommentare als Hinweis-System.*
- **Cicada 3301:** Gestaffelte Schwierigkeit, jede Puzzle-Schicht erfordert andere Expertise. *Anwendbar: Cases mit steigender Komplexität, manche erfordern Community-Kollaboration.*

### Technische Passung:
- `chat_conversations` + `chat_messages` mit AI-Memory existieren -- Befragungsgrundlage
- `cipher_attempts` + `cipher_redemptions` existieren -- ARG-Integration bereits gebaut
- `event_echoes` mit Provenienz-Kette existiert -- Cross-Sim-Ermittlung möglich
- `battle_log` liefert Event-Timeline für Beweis-Sammlung
- `agent_memories` (pgvector) ermöglicht semantische Suche nach relevantem Agent-Wissen

### Implementierungsansatz:
1. **Case Files Service** (neuer Service): Case-Generierung basierend auf anomalen Simulationsdaten (ungewöhnliche Bleed-Muster, Stabilitäts-Anomalien, Agent-Verhaltenswechsel)
2. **Evidence Board** (neues Frontend-Component): Visuelle Pinnwand mit Beweisstücken, Verbindungslinien, Statusanzeige
3. **Interrogation Mode**: Chat-Erweiterung -- "Beweis präsentieren"-Button, der das Beweisstück in den Agent-Chat-Kontext injiziert
4. **Case Resolution Engine**: Validiert ob gesammelte Beweise + gezogene Verbindungen die Case-Lösung korrekt abbilden
5. **Bureau Clearance Progression**: Gelöste Cases erhöhen Bureau-Clearance-Level → schaltet tiefere Cases frei

### Engagement-Loop:
```
Bureau weist Case zu → sammle Hinweise in Simulation → befrage Agents
→ finde Cipher-Code auf Instagram → löse ein → neuer Hinweis
→ verbinde Beweise auf Evidence Board → löse Case
→ Bureau Clearance steigt → nächster, tieferer Case
```

### Geschätzter Scope: Groß (neuer Service, DB-Schema, Frontend-Components, Chat-Erweiterung)

---

## Proposal 4: Fraktionsemergenz & Politische Simulation

### Perspektive: Game Designer + Literaturprofessor

**Core Idea:** Agents bilden organisch Fraktionen basierend auf geteilten Werten, Berufszugehörigkeit, Zonen-Loyalität und Beziehungsclustern. Fraktionen machen Forderungen an die Simulation, erzeugen politische Spannung, können sich spalten oder fusionieren. Der Spieler muss politische Krisen navigieren, Kompromisse finden, oder Fraktionen gegeneinander ausspielen.

### Was der User tun kann:
- **Fraktionen beobachten:** Sehen, wie sich Agent-Cluster zu Interessensgruppen formieren
- **Forderungen verhandeln:** Fraktionen stellen Forderungen (bessere Gebäude-Bedingungen, mehr Sicherheit in ihrer Zone, Veränderung der Governance)
- **Krisen lösen:** Wenn Forderungen ignoriert werden, eskalieren Fraktionen (Streik, Protest, Sabotage, Sezession)
- **Governance gestalten:** Zwischen Autocracy (schnelle Entscheidungen, instabil), Council (demokratisch, langsam), und Faction-Balance wählen
- **Agenten als Diplomaten einsetzen:** Agents mit hoher sozialer Aptitude als Vermittler zwischen Fraktionen positionieren

### Forschungsbasis:
- **Crusader Kings III:** Meinungssystem + Hook-System + Scheme-System. Charaktere verfolgen langfristige Pläne (Mord, Verführung, Befreundung). *Anwendbar: Agent-Schemes als autonome Langzeitpläne.*
- **Stellaris:** Fraktionen als Interessensgruppen mit Demands + Approval. Zufriedene Fraktionen = Stabilität, ignorierte = Unruhe. *Direkt anwendbar auf Zone-Stability-System.*
- **Victoria 3:** Population mit hierarchischen Bedürfnissen. Unerfüllte Bedürfnisse → politischer Radikalismus. *Anwendbar: Agent-Zufriedenheit beeinflusst Fraktionszugehörigkeit.*

### Technische Passung:
- `agent_relationships` (Typ, Intensität, Bidirektionalität) liefert den Sozialgraph
- `simulation_taxonomies` (dynamische Enums pro Simulation) kann um Fraktionstypen erweitert werden
- `mv_zone_stability` existiert -- Fraktionsunzufriedenheit als neuer Stability-Faktor
- `event_reactions` mit Emotions- und Confidence-Score -- Basis für Fraktions-Alignment
- Agent-Aptitudes (6 Typen, 3-9 Range) können als Grundlage für Fraktionspräferenzen dienen

### Implementierungsansatz:
1. **Faction Detection Algorithm**: Cluster-Analyse über Agent-Persönlichkeiten + Beziehungsgraph + Zone-Zugehörigkeit → automatische Fraktionserkennung
2. **Faction Demands System**: Fraktionen generieren AI-basierte Forderungen basierend auf Simulations-Zustand (niedrige Zone-Stability → Sicherheitsforderung)
3. **Political Events**: Neue Event-Kategorie "political" -- Streiks, Proteste, Koalitionsbildung, Verrat
4. **Governance UI**: Neues Settings-Panel wo Spieler Governance-Typ und Fraktions-Reaktionen konfigurieren
5. **Faction Heatmap**: Kartendarstellung welche Zonen von welchen Fraktionen dominiert werden

### Engagement-Loop:
```
Heartbeat erkennt Fraktionsbildung → User wird benachrichtigt → analysiert Fraktionsforderungen
→ verhandelt (Chat mit Fraktionsführer-Agent) → trifft Governance-Entscheidung
→ Konsequenzen entfalten sich → neue Fraktionsdynamik entsteht
```

### Geschätzter Scope: Groß (Cluster-Algorithmus, neues Event-System, Governance-UI)

---

## Proposal 5: The Legacy Cycle (Permanente Weltnarben)

### Perspektive: Game Designer + Game Marketing Specialist

**Core Idea:** Epoch-Ergebnisse hinterlassen *permanente Spuren* in der Simulation. Gewinnerzonen prosperieren, Verlierer-Zonen verfallen sichtbar. Legendäre Operatives werden zu NPCs mit eigenen Stories. Benannte Ären markieren die Geschichte. Die Welt akkumuliert Schicht um Schicht von Spielergeschichte -- wie geologische Sedimentschichten.

### Was der User tun kann:
- **Weltgeschichte lesen:** Eine visuelle Timeline aller Epochen mit Siegern, Verlusten, legendären Momenten
- **Narben entdecken:** Ruinen zerstörter Gebäude, Denkmäler für gefallene Agents, Graffiti in eroberten Zonen
- **Legacy Agents rekrutieren:** Agents die in früheren Epochen legendäre Taten vollbrachten, sind als besonders fähige Operatives verfügbar
- **Ären benennen:** Der Sieger einer Epoche darf die vergangene Ära benennen (wird in Omnipedia und Chronicle permanent referenziert)
- **Artefakte erben:** Operative Erfolge hinterlassen "Artefakte" -- symbolische Items die in zukünftigen Epochen Boni geben

### Forschungsbasis:
- **Wildermyth:** Heroes die Kampagnen überleben werden "Legacy Characters" -- rekrutierbar in zukünftigen Playthroughs mit Boni aus ihrer Geschichte. *Direkt anwendbar: Epoch-Veteranen als Legacy Agents.*
- **EVE Online:** In-Game Monumente an historischen Schlachtorten. Player-geschriebene Geschichts-Wikis über Jahrzehnte. *Anwendbar: Permanente Weltveränderungen nach Epochen.*
- **Hades:** Jeder Tod treibt die Narration voran. Verlieren ist nie verschwendet. *Anwendbar: Epoch-Niederlagen erzeugen ebenfalls narrative Inhalte (Exil-Stories, Widerstandsbewegungen).*
- **Shadow of Mordor Nemesis System:** Feindliche Operatives die überleben, kehren mit Narben, Titeln und persönlichen Fehden zurück. *Anwendbar: Feindliche Operatives der letzten Epoche als recurring NPCs.*
- **Fallen London:** Qualitäts-basierte Narration -- akkumulierte Entscheidungen schalten zukünftige Storylines frei. *Anwendbar: Epoch-Geschichte beeinflusst verfügbare Events und Narrative.*

### Technische Passung:
- `game_epochs` mit vollständigem Lifecycle (LOBBY → COMPLETED) existiert
- `epoch_scores` (5 Dimensionen + composite) liefert Legacy-Daten
- `battle_log` mit allen operativen Events existiert -- Quelle für "legendäre Momente"
- `operative_missions` mit success/failure Tracking vorhanden
- `simulation_chronicles` kann um Legacy-Einträge erweitert werden
- `mv_zone_stability` kann permanent modifiziert werden durch Epoch-Ergebnisse

### Implementierungsansatz:
1. **Epoch Aftermath Service**: Nach Epoch-Abschluss → berechne permanente Weltveränderungen (Zone-Stability-Modifier, Building-Condition-Änderungen)
2. **Legacy Agent Promotion**: Agents mit Top-Operative-Performance erhalten `is_legacy: true` Flag + generierte "Legende"
3. **World Scars**: Neue Tabelle `world_scars` -- permanente Modifikatoren auf Zonen/Gebäude mit narrativer Beschreibung
4. **Era Naming**: Sieger-Spieler erhält UI zum Benennen der vergangenen Ära → wird in allen Chroniken/Omnipedia-Einträgen referenziert
5. **Visual Timeline Component**: Horizontale Timeline-UI mit Epochen, Ären, Schlüsselmomenten

### Engagement-Loop:
```
Epoche endet → Weltnarben werden generiert → User entdeckt Veränderungen
→ liest Legacy-Agents Stories → benennt Ära → nächste Epoche beginnt
auf veränderter Welt → Legacy-Agents als Operatives rekrutieren
```

### Geschätzter Scope: Mittel (hauptsächlich Post-Processing nach Epoch + neue UI-Komponenten)

---

## Proposal 6: Zeremonien & Saisonale Weltevents

### Perspektive: Lore Specialist + Game Designer

**Core Idea:** Spieler können bedeutungsvolle Zeremonien initiieren -- Gründungsfeste, Gedenkfeiern, Krönungen, Trauerfeiern für gefallene Agents, Segnungen neuer Gebäude. Jede Zeremonie hat mechanische Auswirkungen (Zone-Stability-Boost, Agent-Morale, Bleed-Resistance) und narrative Konsequenzen. Zusätzlich: saisonale Weltevents die alle Simulationen gleichzeitig betreffen.

### Was der User tun kann:
- **Zeremonien planen:** Voraussetzungen erfüllen (bestimmte Agents anwesend, Gebäude in gutem Zustand, richtige Zone)
- **Rituale durchführen:** Mehrstufige Hold-to-Confirm-Sequenzen mit eskalierendem visuellem/akustischem Feedback
- **Mechanische Boni ernten:** Erfolgreiche Zeremonien geben temporäre Boni (Zone-Stability +0.1 für 7 Tage, Agent-Moral-Boost)
- **Festkalender verwalten:** Wiederkehrende Feiertage für die Simulation festlegen (jährliches Gründungsfest, monatlicher Markttag)
- **Saisonale Events erleben:** Plattformweite Events (Sonnenwende, Äquinoktium) mit speziellen Mechaniken

### Forschungsbasis:
- **Dark Souls Bonfires:** Bewusste Pause im Gameplay. Ritueller Akt mit Konsequenz (alle Feinde respawnen). *Anwendbar: Zeremonien als bewusste Entscheidungspunkte mit Trade-offs.*
- **Destiny Raids:** Call-and-Response-Mechaniken, Wipe bei Fehler, Euphorie bei Erfolg. *Anwendbar: Zeremonien als kooperative Multi-Agent-Rituale.*
- **Journey:** Wortlose Ritualsprache (Chirps). Wiederholung + geteilter Zweck = Bedeutung. *Anwendbar: Zeremonien gewinnen Bedeutung durch Wiederholung und Tradition.*
- **Fallen London Seasonal Events:** Fest der Außergewöhnlichen Rose, Hallowmas -- zeitlich begrenzte Stories mit exklusiven Belohnungen. *Direkt anwendbar: Saisonale Bureau-Events.*
- **Shadow of the Colossus:** Ritual-Struktur: Reise → Entdeckung → Kampf → Konsequenz. Bedeutung durch Pacing, nicht durch Komplexität. *Anwendbar: Zeremonie-Design nach dieser dramaturgischen Struktur.*

### Technische Passung:
- `simulation_settings` (JSONB Key-Value-Store) kann Festkalender speichern
- Bestehende Hold-to-Confirm-Mechanik (Forge Ignition) als UI-Pattern wiederverwendbar
- `mv_zone_stability` kann temporäre Zeremonie-Boni integrieren
- `heartbeat_service.py` kann Zeremonien-Cooldowns und wiederkehrende Feste verwalten
- `substrate_resonances` System kann für plattformweite saisonale Events erweitert werden
- `event_reactions` System kann Zeremonien-spezifische Agent-Reaktionen generieren

### Implementierungsansatz:
1. **Ceremony Catalog**: Vordefinierte Zeremonie-Typen (Gründung, Gedenken, Krönung, Segnung) mit Voraussetzungen und Effekten
2. **Ceremony Execution UI**: Mehrstufiges Ritual-UI mit progressivem Feedback (Hold-to-Confirm → Agenten reagieren → Effekt entfaltet sich)
3. **Festival Calendar**: Simulation-Setting für wiederkehrende Feste mit automatischer Event-Generierung
4. **Seasonal Platform Events**: Resonance-ähnliche plattformweite Events an realen Daten (Sonnenwende = "The Alignment", Äquinoktium = "The Balance")
5. **Ceremony Memory**: Vergangene Zeremonien als Teil der Weltgeschichte (Legacy-Integration)

### Engagement-Loop:
```
Festkalender zeigt nächste Zeremonie → User bereitet Voraussetzungen vor
→ führt Ritual durch → erntet mechanische + narrative Belohnung
→ Zeremonie wird Teil der Weltgeschichte → plattformweites saisonales Event kommt
→ alle Simulationen reagieren gleichzeitig
```

### Geschätzter Scope: Mittel (neue UI, Service-Erweiterung, Heartbeat-Integration)

---

## Proposal 7: Transmedia Cipher Network (Tiefes ARG-Layer)

### Perspektive: ARG Specialist + Game Marketing Specialist

**Core Idea:** Das bestehende Cipher-System (Codes in Instagram-Posts → `/bureau/dispatch` Redemption) wird zu einem tiefen, mehrschichtigen ARG ausgebaut mit 3 Schwierigkeitsstufen, Cross-Platform-Puzzles die Instagram- und Bluesky-Hinweise kombinieren, saisonalen Meta-Puzzles, und einem Bureau-Clearance-Progressionssystem das In-Game-Belohnungen freischaltet.

### Was der User tun kann:
- **Surface Codes finden (Tier 1):** Offensichtliche Codes in Instagram-Captions und Story-Overlays → sofortige Bureau-Belohnung
- **Deep Codes entschlüsseln (Tier 2):** Steganographische Hinweise in Bildern, Muster in Posting-Zeitpunkten, versteckte Informationen in Bureau-Watermarks → erfordern Analyse
- **Meta-Puzzles lösen (Tier 3):** Saisonale Rätsel die mehrere Posts über Wochen verbinden, Cross-Platform-Hinweise (Instagram visuell + Bluesky textlich), Community-Kollaboration erfordern → schalten exklusive Lore/Narrative frei
- **Bureau-Clearance aufsteigen:** Akkumulierte Cipher-Lösungen erhöhen Clearance-Level (OBSERVER → ANALYST → FIELD AGENT → SENIOR CARTOGRAPHER → DIRECTOR)
- **Exklusive Belohnungen:** Höhere Clearance = tiefere Case Files, exklusive Agent-Karten-Rahmen, Bureau-interne Kommunikation, früherer Zugang zu Epoch-Informationen

### Forschungsbasis:
- **Cicada 3301 (2012-2014):** Gestaffelte Schwierigkeit mit verschiedenen Expertisen (Kryptographie, Musiktheorie, Literatur). 7000+ Discord-Mitglieder bleiben aktiv. *Anwendbar: 3-Tier-System wo leichte Oberflächenbelohnungen UND tiefe Community-Puzzles koexistieren.*
- **Perplex City (2004-2007):** ARG + Sammelkarten. 256 Puzzle-Karten in Foilpacks, UV-Tinte, wärmeempfindliche Tinten. Card-IDs online eingeben → Punkte → Leaderboard. *Direkt anwendbar: Bureau + TCG-Karten-System mit Cipher-Integration.*
- **Silent Hill Historical Society (2024):** 36 versteckte Seiten, URL-Manipulation, zeitlich begrenzt. *Anwendbar: Temporäre Cipher-Events mit FOMO-Effekt.*
- **Welcome Home (2020-ongoing):** Die Website IST das Spiel. Niedrige Einstiegshürde + tiefe Rabbit Holes. *Anwendbar: `/bureau/dispatch` als diegetisches Interface statt Meta-UI.*
- **Neurocracy (2021):** Serialisierte Wöchentliche Episoden wo Wiki-Artikel sich ändern. *Anwendbar: Cipher-Saisons mit wöchentlichen neuen Hinweisen.*

### Technische Passung:
- `cipher_attempts` + `cipher_redemptions` existieren bereits
- `instagram_image_composer.py` hat bereits Bureau-Watermarks, Classification Headers, steganographische Cipher-Hints
- `social_story_service.py` generiert bereits 12+ Story-Template-Typen mit Per-Sim-Theming
- `bluesky_content_service.py` existiert für Cross-Platform-Distribution
- Agent-Karten als TCG-Stil (`VelgGameCard`) existieren -- Basis für kosmetische Belohnungen

### Implementierungsansatz:
1. **3-Tier Cipher Engine**: Erweiterung des `CipherService` um Schwierigkeitsstufen + saisonale Meta-Puzzles
2. **Bureau Clearance System**: Neue Tabelle `bureau_clearance` (user_id, clearance_level, total_solves, meta_puzzles_completed)
3. **Cross-Platform Puzzle Generator**: Instagram-Post + Bluesky-Post bilden zusammen ein Puzzle (visueller Hinweis + textueller Hinweis)
4. **Seasonal Meta-Puzzle**: Übergreifendes Rätsel das alle Posts einer Saison (60-90 Tage) verbindet
5. **Cosmetic Reward System**: Cipher-Fortschritt schaltet Card-Rahmen, Glow-Effekte, Bureau-Badges für Agent-Karten frei
6. **Bureau Dossier Unlocks**: Höhere Clearance schaltet exklusive narrative Inhalte frei (Bureau-interne Memos, Cartographer-Notizen, redacted-Dokumente die ent-redacted werden)

### Engagement-Loop:
```
Instagram-Post erscheint → Surface Code gefunden (Tier 1, sofortige Belohnung)
→ Deep Code entdeckt (Tier 2, erfordert Analyse) → Bureau Clearance steigt
→ neues Meta-Puzzle-Fragment (Tier 3) → Community-Diskussion
→ saisonales Meta-Puzzle gelöst → exklusive Lore + Karten-Kosmetik freigeschaltet
```

### Marketing-Wert:
- **Organisches Wachstum:** Jeder Cipher-Code in einem Instagram-Post ist ein Discovery-Moment der zum Teilen einlädt
- **Community-Building:** Tier-3-Puzzles erfordern Kollaboration → Discord/Reddit-Diskussionen → organische Community
- **Retention:** Saisonale Meta-Puzzles binden über 60-90 Tage
- **Differenzierung:** Kein anderer Worldbuilding-Plattform hat ein integriertes ARG

### Geschätzter Scope: Mittel (Erweiterung bestehender Systeme, hauptsächlich Backend-Logik + Social-Pipeline)

---

## Proposal 8: Spectator Theatre & Community Narrative

### Perspektive: Game Marketing Specialist + Literaturprofessor

**Core Idea:** Die bestehende Public-First-Architektur (49 Public Endpoints, keine Auth für Lesen) wird zu einem aktiven Spectator-Erlebnis ausgebaut. Öffentliche Besucher können Simulationen "beobachten" wie ein Aquarium, Vorhersagen treffen, Agent-Schicksale verfolgen, und an Community-Challenges teilnehmen -- ohne jemals ein Konto zu erstellen. Das Beobachten wird selbst zum Onboarding.

### Was der User tun kann:
- **Soap Opera verfolgen:** Featured Agent Spotlight -- rotierende "Hauptcharaktere" mit ihren Beziehungsdramen, Konflikten, Karrierewegen
- **Vorhersagen treffen:** "Welche Fraktion gewinnt die nächste Epoche?" "Wird Agent Kael Agent Mira verraten?" → Prediction Leaderboard
- **Community Challenges:** Monatliche Weltenbau-Herausforderungen ("Schreibe die beste Lore-Ergänzung für Zone X") → beste Beiträge werden Soft Canon
- **Live Event Feed:** Echtzeit-Scroll von signifikanten Events über alle öffentlichen Simulationen
- **Heatmaps:** Öffentliche Zone-Heatmaps zeigen Aktivität, Stabilität, Konflikte
- **"Story so far" Narrative:** AI-generierte Zusammenfassungen lesen sich wie Journalismus oder Geschichtsschreibung

### Forschungsbasis:
- **Twitch Plays Pokémon:** Zuschauer wurden zu Teilnehmern. Emergente Mythologie (Helix Fossil als Gottheit). Community generierte mehr Narrativ als das Spiel. *Anwendbar: Prediction-System + Community-Theorie-Bildung.*
- **EVE Online Sovereignty Maps:** Karten als lebendige historische Dokumente. *Anwendbar: Öffentliche Cartographer's Map mit Echtzeit-Veränderungen.*
- **Fallen London Community Events:** Feast of the Exceptional Rose, Hallowmas -- zeitlich begrenzte Community-Stories. *Anwendbar: Community Challenges mit Bureau-Thematik.*
- **World Anvil (1.5M+ Users):** Summer Camp + WorldEmber Challenges, Discord Writing Sprints. 48% höhere aktive Teilnahme mit Gamification. *Direkt anwendbar: Weltenbau-Challenges.*
- **Marvel Snap Cosmetic Progression:** Alle Karten starten Common; Rarity wird durch Spielen verdient (7 kosmetische Stufen). *Anwendbar: Agent-Karten-Kosmetik als Spectator-Belohnung.*

### Technische Passung:
- 49 Public API Endpoints existieren bereits (Agents, Buildings, Events, Epochs, Leaderboards)
- `CartographersMap` Component (Force-directed SVG) existiert
- `simulation_chronicles` liefert AI-generierte Narrativ-Zusammenfassungen
- `epoch_scores` mit 5 Dimensionen liefern Prediction-Grundlage
- SEO-Architektur mit Slug-URLs, JSON-LD, GA4-Tracking existiert
- `VelgGameCard` TCG-Karten-Component existiert als Basis für Agent Spotlight

### Implementierungsansatz:
1. **Agent Spotlight Service**: Automatische Auswahl des "interessantesten" Agents (meiste Beziehungsänderungen, höchste Event-Beteiligung) → öffentliche Feature-Karte
2. **Prediction System**: Neue Tabelle `predictions` (user_id nullable für anon, prediction_type, target_entity, predicted_outcome, resolved_at)
3. **Community Challenge System**: Admin erstellt Challenges (Lore-Ergänzung, Event-Vorhersage, Fan-Art) → Community voted → Beste werden Soft Canon
4. **Public Event Stream**: WebSocket/SSE-basierter öffentlicher Feed signifikanter Events (Supabase Realtime auf public Channel)
5. **"Story So Far" Generator**: AI-generierte Season-Zusammenfassungen im Journalismus-Stil für jede öffentliche Simulation
6. **Spectator Dashboard**: Öffentliche Landing Page mit Heatmap, Event Feed, Featured Agent, aktuelle Epoch-Standings

### Engagement-Loop (für nicht-registrierte Besucher):
```
Landing Page → Featured Agent Spotlight (Neugier) → folge dem Drama
→ treffe eine Vorhersage (Investment) → Vorhersage wird bestätigt/widerlegt
→ entdecke mehr Agents/Simulationen → Community Challenge lockt
→ erstelle Account um teilzunehmen → werde Spieler
```

### Marketing-Wert:
- **SEO:** Jeder Agent, jedes Event, jede Simulation ist eine indexierbare, öffentlich lesbare Seite
- **Social Sharing:** Agent Spotlights + dramatische Events als teilbare Inhalte
- **Onboarding-Funnel:** Spectating → Predictions → Challenges → Account → Forge
- **Content Marketing:** "Story So Far"-Zusammenfassungen als Blog-ähnliche Inhalte
- **Community als Moat:** Community-generierte Lore erzeugt Lock-in und organisches Wachstum

### Geschätzter Scope: Mittel (hauptsächlich neue Frontend-Views + leichte Backend-Erweiterungen)

---

## Prioritäts-Ranking

| # | Proposal | Impact | Scope | Einzigartigkeit | Priorität |
|---|----------|--------|-------|-----------------|-----------|
| 1 | **The Living World** | Sehr hoch | Groß | Hoch | **P0** -- Kernproblem (Welt fühlt sich tot an zwischen Sessions) |
| 5 | **Legacy Cycle** | Hoch | Mittel | Hoch | **P0** -- Gibt Epochen permanente Bedeutung |
| 3 | **Bureau Case Files** | Sehr hoch | Groß | Sehr hoch | **P1** -- Einzigartiges Gameplay, nutzt bestehende Systeme |
| 7 | **Transmedia Cipher** | Hoch | Mittel | Sehr hoch | **P1** -- Killer-Differenzierung, Marketing-Multiplikator |
| 8 | **Spectator Theatre** | Hoch | Mittel | Mittel | **P1** -- Onboarding + Marketing, nutzt Public-First-Architektur |
| 2 | **Omnipedia** | Mittel-Hoch | Mittel-Groß | Hoch | **P2** -- Vertieft Lore-Engagement, aber kein neues Gameplay |
| 6 | **Zeremonien** | Mittel | Mittel | Mittel | **P2** -- Emotionale Tiefe, aber weniger "things to do" |
| 4 | **Fraktionen** | Hoch | Groß | Mittel-Hoch | **P2** -- Komplex, aber mächtig; nach Living World |

### Empfohlene Implementierungsreihenfolge:
1. **Living World** + **Legacy Cycle** (zusammen = die Welt lebt und hat Geschichte)
2. **Transmedia Cipher** + **Spectator Theatre** (zusammen = Marketing + Community)
3. **Bureau Case Files** (nutzt Living World + Cipher als Grundlage)
4. **Omnipedia** + **Zeremonien** + **Fraktionen** (Vertiefungsschicht)

---

## Implementation Log

### Proposal 1: The Living World -- IMPLEMENTED (2026-03-22)

**Migration:** `20260322100000_145_agent_autonomy_foundation.sql`

**New Tables (6):** `agent_mood`, `agent_moodlets`, `agent_opinions`, `agent_opinion_modifiers`, `agent_needs`, `agent_activities`

**New Columns on `agents`:** `personality_profile` (JSONB Big Five), `autonomy_active` (bool), `current_zone_id`, `current_building_id`

**PostgreSQL Functions (10):** `fn_expire_autonomy_modifiers`, `fn_decay_moodlet_strengths`, `fn_recalculate_mood_scores`, `fn_recalculate_opinion_scores`, `fn_decay_agent_needs`, `fn_count_moodlet_stacking`, `fn_count_opinion_modifier_stacking`, `fn_initialize_agent_autonomy`

**Backend Services (8):**
- `personality_extraction_service.py` -- Big Five LLM extraction, autonomy bootstrap
- `agent_needs_service.py` -- 5 needs, decay via PG, activity fulfillment
- `agent_mood_service.py` -- moodlets (3 decay types), stress, breakdowns
- `agent_opinion_service.py` -- 9 opinion presets, stacking caps, relationship thresholds
- `agent_activity_service.py` -- Utility AI + Boltzmann selection, social interactions
- `autonomous_event_service.py` -- 6 event triggers, LLM narrative, bleed integration
- `morning_briefing_service.py` -- priority briefings, AI Bureau prose
- `models/agent_autonomy.py` -- 18 Pydantic models

**API Endpoints (9):** mood, moodlets, needs, opinions, opinion-modifiers, activities, mood-summary, briefing (via `routers/agent_autonomy.py`)

**Frontend Components (5):**
- `AgentMoodPanel.ts` -- SVG arc gauge, stress bar, radar chart, moodlet list
- `AgentLifeTimeline.ts` -- Bureau intercept log, filter chips, pagination
- `AutonomyBriefingSection.ts` -- briefing insert for DailyBriefingModal
- `AutonomySettingsPanel.ts` -- 8 settings with info bubbles, 3-tier gating
- `AgentAutonomyApiService.ts` -- API service (11 methods, typed interfaces)

**Integration Points:**
- Heartbeat Phase 9 (a-f): needs decay → mood → opinions → activities → social → events
- Chat AI: mood/stress/moodlets injected into agent system prompt
- Epochs: mood/stress modifies operative success probability (+-0.03 to +-0.06)
- Bleed: autonomous events evaluated for cross-sim echo propagation
- Chronicle: autonomous events auto-included (data_source='autonomous')
- BYOK: 3-tier gating (global admin → per-user policy → owner BYOK key via `<velg-byok-panel>`)

**LLM Cost:** ~$3.84/month per simulation (DeepSeek V3.2, 6 agents, 6 ticks/day)
**Rule-based cost:** $0 (Utility AI, Boltzmann, needs/mood/opinions are pure computation)

---

## Quellen (Auswahl)

- Stanford Generative Agents (2023): arxiv.org/abs/2304.03442
- Intra LLM Text Adventure Design Notes (2025): ianbicking.org/blog/2025/07/intra-llm-text-adventure
- Neurocracy: neurocracy.site
- Cicada 3301 Analysis: Game Detectives Wiki
- Perplex City Post-Mortem: Adrian Hon Retrospective
- RimWorld AI Storyteller: gamedeveloper.com
- Caves of Qud Procedural History (GDC 2019): gdcvault.com
- EVE Online Wormhole Communities: kotaku.com
- Wildermyth Legacy System: pastemagazine.com
- Fallen London Quality-Based Narrative: failbettergames.com
- Shadow of Mordor Nemesis System: thegamer.com
- Victoria 3 Economic Simulation: paradoxwikis.com
- World Anvil Community Gamification: worldanvil.com
- Marvel Snap Cosmetic Progression: snap.fan
- Destiny 2 Seasonal Storytelling: pcgamer.com
