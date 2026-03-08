# Breitentauglichkeit — Analyse & Maßnahmenkatalog

## Kontext

metaverse.center ist eine Multiplayer-Worldbuilding-Plattform mit kompetitiver Schicht (Epochs). Das Projekt vereint City-Builder, Diplomatie-Strategie, Spionage-Spiel und kollaborative Fiction-Engine — eine einzigartige Kombination ohne direktes Marktanalogon.

**Aktuelle Positionierung:** Nische für Weltenbauer + Strategie-Enthusiasten + AI/Narrative-Fans. 4-12 Spieler, 14-21 Tage Epochs, 8 Systeme, 160+ Parameter.

**Kernfrage:** Welche Maßnahmen senken die Einstiegshürde und erweitern die Zielgruppe, OHNE die Tiefe und Einzigartigkeit zu opfern?

---

## I. Status-Quo-Analyse: Warum es derzeit nicht breitentauglich ist

### A. Fünf kritische Barrieren

| # | Barriere | Schwere | Beschreibung |
|---|----------|---------|-------------|
| 1 | **Kognitive Komplexität** | Kritisch | 8 Systeme, 10 Feedback-Loops, 5 Scoring-Dimensionen, 6 Operative-Typen, 7 Bleed-Vektoren. Selbst erfahrene Strategiespieler sind overwhelmed (GDD XIV.1) |
| 2 | **Social Bootstrapping** | Kritisch | Braucht 4-12 engagierte Spieler für 2-3 Wochen. Kein Matchmaking, keine Community, Cold-Start-Problem |
| 3 | **Zeitverpflichtung** | Hoch | 14-21 Tage Epochs, alle 8h Zyklen, tägliche Check-ins nötig. Inkompatibel mit casual Play |
| 4 | **Fehlende Instant Gratification** | Hoch | Operative deployen → 8h warten → Ergebnis. Kein "Pick up and play"-Moment |
| 5 | **Kein Onboarding** | Hoch | 28-Sektionen-Regelbuch statt Tutorial. Kein interaktives Training. Kein "Learning by Doing" |

### B. Sekundäre Barrieren

| # | Barriere | Beschreibung |
|---|----------|-------------|
| 6 | Desktop-First | Funktional auf Mobile, aber nicht optimiert. Komplexe Grids, 3D-Map, Command Center — alles Desktop-lastig |
| 7 | Nur Email/Password | Kein Social Login (Google, Discord, GitHub). Registrierungshürde |
| 8 | Nischen-Ästhetik | Cyberpunk-Terminal, Brutalist-Typo, CRT-Scanlines — ansprechend für SciFi-Fans, abschreckend für Mainstream |
| 9 | Keine Monetarisierung | Kein Anreiz für Wachstum, kein Marketing-Budget, keine Premium-Features |
| 10 | Nur EN/DE | Größte Gaming-Märkte (JP, KR, CN, PT-BR, ES) nicht bedient |

### C. Stärken (zu erhalten)

- **Einzigartiges USP:** Creative-Competitive Fusion (keine Konkurrenz)
- **Embassy Paradox:** Genuinely novel game design
- **AI-Integration:** Forge, Chat, Narrative Generation — zukunftsweisend
- **Narrative as Mechanic:** Bleed-System erzeugt emergente Geschichten
- **Technische Qualität:** Saubere Architektur, RLS, TypeScript, gute Testabdeckung
- **Substrate Scanner:** Realwelt-Integration (gerade implementiert)

---

## II. Maßnahmenkatalog — Priorisiert nach Impact × Machbarkeit

### Tier 1: Einstiegshürde senken (Höchste Priorität)

#### 1.1 Solo-Training-Modus ("Academy Epoch")
**Problem:** Spieler können Mechaniken nur mit 4+ echten Menschen lernen.
**Lösung:** Ein spezieller 1-Spieler-Epoch gegen 3-4 Bot-Simulationen.

- Nutzt das bereits existierende Bot-System (5 Persönlichkeiten, 3 Schwierigkeitsgrade)
- Verkürzte Epoch-Dauer: 3-5 Tage statt 14-21
- Geführte Szenarien: "Verteidige dich gegen Sabotage", "Baue ein Diplomatennetzwerk auf"
- Progressive Freischaltung: Erste Academy-Epoch nur mit Spies + Guardians, dann Saboteure, dann alle 6 Typen
- **Existierende Infrastruktur:** Bot-System, Epoch-Lifecycle, Cycle-Resolution — alles vorhanden
- **Aufwand:** Medium (neuer Epoch-Typ "academy", vereinfachte Config, Guided-Scenarios-UI)

#### 1.2 Interaktives Tutorial ("Field Training")
**Problem:** 28-Sektionen-Regelbuch ist kein Onboarding.
**Lösung:** Schritt-für-Schritt-Tutorial direkt in der Simulation.

- Tutorial-Overlay das durch Kernmechaniken führt: Agent erstellen → Building staffen → Zone-Stabilität → Embassy aufbauen
- Kontextuelle Tooltips ("Dein Agent hat Aptitude 8 in Spy — das bedeutet +24% Erfolgswahrscheinlichkeit")
- "Learn by Doing" statt "Read and Understand"
- Abschluss mit: "Du bist bereit für eine Academy Epoch"
- **Aufwand:** Medium-Hoch (neues Tutorial-System, aber keine Backend-Änderungen)

#### 1.3 Progressive Disclosure
**Problem:** Alle 160 Parameter gleichzeitig sichtbar.
**Lösung:** Gestaffeltes Interface.

- **Einsteiger-Modus** (Default): Nur Kernmetriken (Zone-Stabilität, Embassy-Status, Operative-Deploy). Formeln ausgeblendet
- **Fortgeschritten**: Alle Metriken + Tooltips mit Formeln
- **Experte**: Rohdaten, API-Zugang, CSV-Export
- Umschalter in Profil-Settings
- **Aufwand:** Medium (UI-Refactoring, conditional rendering, kein Backend)

#### 1.4 Kürzere Epoch-Formate
**Problem:** 14-21 Tage Commitment ist zu viel für Casual-Spieler.
**Lösung:** Mehrere Epoch-Vorlagen.

| Format | Dauer | Zyklen | Zielgruppe |
|--------|-------|--------|------------|
| **Blitz** | 1-2 Tage | 6-12 | Casual, Einsteiger |
| **Sprint** | 3-5 Tage | 18-30 | Regular |
| **Standard** | 7-14 Tage | 42-84 | Hardcore |
| **Marathon** | 21+ Tage | 126+ | Ultra-Hardcore |

- Cycle-Duration anpassbar: 2h (Blitz) → 4h (Sprint) → 8h (Standard)
- Foundation/Competition/Reckoning-Phasen-Ratio bleibt gleich, skaliert mit Dauer
- **Existierende Infrastruktur:** `cycle_hours`, `max_cycles`, Phase-Ratios — alles konfigurierbar
- **Aufwand:** Niedrig (UI für Epoch-Vorlagen, keine Backend-Änderungen)

### Tier 2: Social Bootstrapping lösen (Hohe Priorität)

#### 2.1 Public Lobby & Matchmaking
**Problem:** Spieler müssen selbst 4-12 Mitspieler finden.
**Lösung:** Öffentliche Epoch-Lobbies mit Join-Button.

- Epoch-Ersteller markiert Epoch als "Public"
- Browse-Seite für offene Epochs (Filter: Format, Spielerzahl, Schwierigkeit)
- "Quick Join" Button → automatisch passende offene Epoch
- Bot-Fill: Wenn nach Wartezeit nicht genug Spieler, Bots füllen auf
- **Aufwand:** Medium (neuer View, Lobby-State, Auto-Fill-Logik)

#### 2.2 Spectator Mode
**Problem:** Nicht-Spieler können keine Epochs verfolgen.
**Lösung:** Live-Zuschauer-Modus für laufende Epochs.

- Public API existiert bereits (Leaderboard, Battle-Log, Epoch-Info)
- Echtzeit-Score-Updates via Supabase Realtime
- "Watch Live"-Button auf der Multiverse-Map
- Spectator-Chat (read-only, optional)
- Erzeugt Neugier → Konversion zu Spielern
- **Aufwand:** Niedrig-Medium (Frontend-View, bestehende Public API + Realtime nutzen)

#### 2.3 Discord-Integration
**Problem:** Kein Community-Hub, keine Benachrichtigungen außer Email.
**Lösung:** Discord-Bot für Epoch-Events.

- Webhook-Benachrichtigungen: Cycle-Ergebnisse, Diplomatic Incidents, Epoch-Start/Ende
- Discord OAuth Login (Social Login)
- "Join Epoch"-Link direkt aus Discord
- Community-Server als zentraler Treffpunkt
- **Aufwand:** Medium (Discord OAuth, Webhook-Integration, Bot-Framework)

#### 2.4 Social Login
**Problem:** Email/Password ist eine Registrierungshürde.
**Lösung:** Google, Discord, GitHub OAuth via Supabase Auth.

- Supabase Auth unterstützt OAuth nativ — minimaler Backend-Aufwand
- Discord besonders relevant für Gaming-Zielgruppe
- Google für breitere Masse
- **Aufwand:** Niedrig (Supabase-Config + Login-UI-Erweiterung)

### Tier 3: Instant Gratification & Casual Play (Mittlere Priorität)

#### 3.1 "Sandbox Mode" ohne Epoch
**Problem:** Worldbuilding allein hat keine Gameplay-Loop.
**Lösung:** PvE-Spielmechaniken zwischen Epochs.

- Daily Challenges: "Stabilisiere Zone X innerhalb von 3 Zyklen"
- Event-Reaktionen: Substrate Resonances erzeugen Sofort-Aufgaben
- Achievement-System: Milestones für Simulation-Aufbau
- Solo-Objectives: "Baue eine vollständig besetzte Zone", "Erreiche 90% Embassy-Effectiveness"
- **Aufwand:** Hoch (neues Challenge-System, Achievement-Tracking, tägliche Rotation)

#### 3.2 TCG-Card-Redesign (Draft als "Handheld Moment")
**Problem:** Draft-Phase ist abstraktes Menü.
**Lösung:** TCG-Card-System (bereits als Draft-Konzept vorhanden).

- Cards als zentrale UI-Metapher: Agenten als sammelbare Karten
- Draft als "Hand zusammenstellen" — haptisch, intuitiv, befriedigend
- Hover-Effekte, Fan-Animation, Flip-Reveal
- Macht den abstrakten Draft-Mechanismus visuell erlebbar
- **Existierende Arbeit:** `docs/explanations/tcg-card-system.md` (Draft-Status)
- **Aufwand:** Medium-Hoch (umfangreiches UI-Redesign, aber kein Backend)

#### 3.3 Epoch-Replay & Highlights
**Problem:** Nach Epoch-Ende verschwindet alles.
**Lösung:** Automatische Zusammenfassung + Replay.

- AI-generierter Epoch-Report: Schlüsselmomente, Wendepunkte, MVPs
- Score-Verlaufsgrafik pro Zyklus
- "Best of"-Highlights: Dramatischste Operationen, größte Comebacks
- Shareable Link für Social Media
- **Aufwand:** Medium (Data aggregation existiert, AI-Summary, Frontend-View)

### Tier 4: Reach & Discoverability (Mittlere Priorität)

#### 4.1 Landing Page ohne Login
**Problem:** Neue Besucher landen direkt auf dem Login-Screen.
**Lösung:** Marketing-Landing-Page.

- Hero-Section mit Gameplay-Demo (Video oder animierte Mockups)
- "Was ist metaverse.center?" — 30-Sekunden-Pitch
- Live-Daten: "X aktive Epochs, Y Simulationen, Z Spieler"
- Showcase: Screenshots der besten Simulationen (Forge-Ergebnisse)
- CTA: "Create Your World" → Registration
- SEO-optimiert für "multiplayer worldbuilding game", "AI strategy game"
- **Aufwand:** Medium (neuer Route `/`, Marketing-Content, kein Backend)

#### 4.2 Demo-Modus ("Probierstube")
**Problem:** Man muss sich registrieren um überhaupt etwas zu sehen.
**Lösung:** Read-only Demo ohne Account.

- Public API existiert bereits
- Showcase-Simulationen (die 5 Flagship-Welten) frei browsbar
- "Try the Forge" — ein beschränkter Forge-Durchlauf ohne Speichern
- Am Ende: "Register to save your world"
- **Aufwand:** Niedrig-Medium (Routing-Änderung, bestehende Public API nutzen)

#### 4.3 Push Notifications
**Problem:** Nur Email-Benachrichtigungen. Cycle-Events werden verpasst.
**Lösung:** Web Push + (optional) Mobile Push.

- Service Worker für Web Push (Progressive Web App)
- Cycle-Ergebnisse, diplomatische Incidents, Epoch-Phasen-Wechsel
- Opt-in mit granularer Steuerung (wie Email-Preferences)
- **Aufwand:** Medium (Service Worker, Push-API, Notification-Preferences-Erweiterung)

### Tier 5: Ästhetik & Zugänglichkeit (Niedrigere Priorität)

#### 5.1 Theme-Wahl für die Plattform
**Problem:** Cyberpunk-Terminal ist nischig.
**Lösung:** 2-3 Plattform-Themes zur Auswahl.

- **Default (current):** Bureau Aesthetic — Cyberpunk, CRT, Brutalist
- **Clean:** Helles, modernes UI — weniger intimidierend für Mainstream
- **Fantasy:** Warmer, narrativer Look — parchment-Texturen, Serif-Fonts
- Per-Simulation Theming existiert bereits — Plattform-Level-Theme-Switch fehlt
- **Aufwand:** Medium-Hoch (CSS-Variablen-Sets, Theme-Switcher, Design-Arbeit)

#### 5.2 Mobile-First Views für Core-Actions
**Problem:** Desktop-First macht Mobile umständlich.
**Lösung:** Dedizierte Mobile-Views für die häufigsten Aktionen.

- Epoch-Dashboard: Vereinfacht, card-basiert, swipe-fähig
- Operative-Deploy: Bottom-Sheet statt Modal
- Battle-Log: Feed-artig (wie Social Media)
- Zone-Status: Quick-Glance mit Tap-to-Expand
- **Aufwand:** Hoch (parallele Mobile-Views oder responsive Redesign)

#### 5.3 Weitere Sprachen
**Problem:** Nur EN/DE schließt große Märkte aus.
**Lösung:** FR, ES, PT-BR als nächste Prioritäten.

- `@lit/localize` mit XLIFF — Infrastruktur steht
- AI-gestützte Übersetzung (wie DE via Claude)
- Community-getrieben möglich (Crowdsourcing)
- **Aufwand:** Medium pro Sprache (1300+ Strings, Review, QA)

### Tier 6: Monetarisierung & Nachhaltigkeit

#### 6.1 Freemium-Modell
- **Free:** 1 Simulation, Academy Epochs, Blitz-Format, 3 Agenten
- **Premium (Abo):** Unbegrenzte Simulationen, alle Formate, volle Forge, AI-Credits
- **Credits:** Pay-per-Use für AI-Generation (Portraits, Dispatches, Chat)
- BYOK bleibt als Power-User-Option
- **Aufwand:** Hoch (Payment-Integration, Credit-System, Feature-Gating)

#### 6.2 Cosmetic Marketplace (langfristig)
- Card Backs, Frames, Borders für TCG-System
- Embassy-Designs (visuelle Customization)
- Portrait-Style-Packs (verschiedene AI-Stile)
- **Aufwand:** Sehr Hoch (Marketplace, Digital Goods, Transaktionen)

---

## III. Empfohlene Implementierungsreihenfolge

### Phase A: "Spielbar machen" (4-6 Wochen)
1. **1.4 Kürzere Epoch-Formate** — Blitz/Sprint Templates ← Niedrigster Aufwand, sofort wirksam
2. **2.4 Social Login** (Discord + Google) ← Supabase-nativ, 1-2 Tage
3. **4.2 Demo-Modus** — Public Simulation Browsing ← Public API existiert
4. **2.2 Spectator Mode** ← Basis-Version mit existierender Public API

### Phase B: "Lernbar machen" (4-6 Wochen)
5. **1.1 Academy Epoch** — Solo vs Bots ← Bot-System existiert
6. **1.3 Progressive Disclosure** — Einsteiger/Fortgeschritten/Experte-Modi
7. **1.2 Interaktives Tutorial** — First-30-Minutes-Experience

### Phase C: "Findbar machen" (2-4 Wochen)
8. **4.1 Landing Page** ← Marketing-Grundlage
9. **2.1 Public Lobby** ← Matchmaking-Basis
10. **4.3 Push Notifications** ← Retention

### Phase D: "Sticky machen" (4-8 Wochen)
11. **3.2 TCG Card Redesign** ← Visuelle Differenzierung
12. **3.3 Epoch-Replay** ← Shareability + Retention
13. **3.1 Sandbox-Mode** ← Between-Epoch-Engagement
14. **2.3 Discord-Integration** ← Community-Building

### Phase E: "Skalierbar machen" (8+ Wochen)
15. **6.1 Freemium-Modell** ← Nachhaltigkeit
16. **5.1 Theme-Wahl** ← Breitere Ästhetik
17. **5.2 Mobile-First Views** ← Mobile-Markt
18. **5.3 Weitere Sprachen** ← Internationale Expansion

---

## IV. Kernthese

Das Spiel muss NICHT casual werden. Die Tiefe ist das USP. Aber die **Einstiegshürde** muss dramatisch gesenkt werden:

> **"Easy to learn, deep to master"** — nicht durch Vereinfachung der Mechaniken, sondern durch besseres Onboarding, kürzere Formate, und Solo-Training.

Die größten Hebel sind:
1. **Academy Epoch** (Solo spielbar, sofort)
2. **Blitz-Format** (1-2 Tage statt 14-21)
3. **Social Login + Demo** (Registrierungshürde senken)
4. **Landing Page** (Discoverability)

Diese vier Maßnahmen allein könnten die potenzielle Zielgruppe verzehnfachen — von "4-12 Hardcore-Strategen die sich kennen" zu "jeder der Civilization/Stellaris/Diplomacy mag und 2 Tage Zeit hat".

---

## V. Referenz-Dateien

| Datei | Relevanz |
|-------|----------|
| `docs/explanations/game-design-document.md` | GDD v1.3, Section XIV: Honest Critique |
| `docs/explanations/tcg-card-system.md` | TCG-Card-Konzept (Draft) |
| `docs/specs/epochs-competitive-layer.md` | Epoch-Mechaniken v2.0 |
| `docs/analysis/epoch-cross-reference-analysis.md` | 200-Game Balance-Analyse |
| `frontend/src/components/how-to-play/HowToPlayView.ts` | Bestehendes Regelbuch (28 Sektionen) |
| `backend/services/bot_service.py` | Bot-System (Grundlage für Academy) |
| `frontend/src/components/auth/LoginView.ts` | Login-Flow (Social Login hier) |
| `frontend/src/app-shell.ts` | Router (Landing Page, Demo-Route) |
