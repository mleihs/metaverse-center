# 06 - Feature Catalog: Plattform + Simulation Features

**Version:** 1.1
**Datum:** 2026-02-25
**Aenderung v1.1:** 3 Simulationen (Velgarien, Capybara Kingdom, Station Null). Public-First-Architektur (anonymer Lesezugriff ohne Login). Dashboard-Bannerbilder. LoreScroll-Akkordeon. 6 Theme-Presets.

---

## Feature-Kategorien

### A. Plattform-Features (NEU)

Features die auf Plattform-Ebene existieren, unabhängig von einzelnen Simulationen.

| # | Feature | Priorität | Beschreibung |
|---|---------|-----------|-------------|
| P1 | **Simulation erstellen** | MUST | Neue Simulation mit Namen, Thema, Sprache anlegen |
| P2 | **Simulation-Dashboard** | MUST | Übersicht aller eigenen Simulationen mit Status |
| P3 | **Simulation-Auswahl** | MUST | Zwischen Simulationen wechseln |
| P4 | **Benutzer-Registrierung** | MUST | Signup mit Email/Passwort (Supabase Auth) |
| P5 | **Benutzer-Login** | MUST | Signin mit JWT-Token |
| P6 | **Mitglieder einladen** | SHOULD | Einladungs-Links mit Rollen-Zuweisung |
| P7 | **Mitglieder verwalten** | SHOULD | Rollen ändern, Mitglieder entfernen |
| P8 | **Simulation archivieren** | COULD | Simulation in Read-Only-Modus setzen |
| P9 | **Simulation klonen** | COULD | Bestehende Simulation als Vorlage kopieren |
| P10 | **Plattform-Administration** | COULD | Globale Admin-Funktionen |

### B. Simulation-Features (bestehend, erweitert)

Features die innerhalb einer Simulation existieren.

#### B1. Agenten-Management

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S1 | Agent erstellen | MUST | ✅ Vorhanden | Manuell mit Name, System, Charakter, Hintergrund |
| S2 | Agent bearbeiten | MUST | ✅ Vorhanden | Alle Felder editierbar |
| S3 | Agent löschen | MUST | ✅ Vorhanden | Cascade auf Relationen |
| S4 | Agenten-Liste | MUST | ✅ Vorhanden | Paginiert, filterbar, sortierbar |
| S5 | Agent-Details | MUST | ✅ Vorhanden | Vollansicht mit Professionen, Reaktionen |
| S6 | Beschreibung generieren (AI) | MUST | ✅ Vorhanden | Charakter + Hintergrund per AI |
| S7 | Portrait generieren (AI) | MUST | ✅ Vorhanden | Bild per Stable Diffusion |
| S8 | Profession zuweisen | SHOULD | ✅ Vorhanden | Aus Simulation-Taxonomie |
| S9 | Agent-Filter | SHOULD | ✅ Vorhanden | Nach System, Gender, Profession |
| S10 | Agent-Suche | SHOULD | ✅ Vorhanden | Volltextsuche über Name |

#### B2. Gebäude-Management

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S11 | Gebäude erstellen | MUST | ✅ Vorhanden | Name, Typ, Beschreibung, Stil |
| S12 | Gebäude bearbeiten | MUST | ✅ Vorhanden | Alle Felder editierbar |
| S13 | Gebäude löschen | MUST | ✅ Vorhanden | Cascade auf Relationen |
| S14 | Gebäude-Liste | MUST | ✅ Vorhanden | Paginiert, filterbar |
| S15 | Gebäude-Bild generieren (AI) | SHOULD | ✅ Vorhanden | Per Stable Diffusion |
| S16 | Agent zuweisen | SHOULD | ✅ Vorhanden | Agent-Building Relation |
| S17 | Profession-Anforderungen | COULD | ✅ Vorhanden | Min-Qualifikation pro Profession |
| S18 | Spezialgebäude (Akademie) | COULD | ✅ Vorhanden | Training-Interface |

#### B3. Events-System

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S19 | Event erstellen | MUST | ✅ Vorhanden | Manuell mit Titel, Beschreibung, Typ |
| S20 | Event bearbeiten | MUST | ✅ Vorhanden | Alle Felder editierbar |
| S21 | Event löschen | MUST | ✅ Vorhanden | Cascade auf Reaktionen |
| S22 | Event-Liste | MUST | ✅ Vorhanden | Paginiert, sortiert |
| S23 | Event generieren (AI) | SHOULD | ✅ Vorhanden | Komplettes Event per AI |
| S24 | Agenten-Reaktion generieren (AI) | SHOULD | ✅ Vorhanden | Charakter-basierte Reaktion |
| S25 | Reaktionen anzeigen | SHOULD | ✅ Vorhanden | Expandierbare Reaktionsliste |

#### B4. Chat-System

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S26 | Konversation starten | MUST | ✅ Vorhanden | User-Agent → Welt-Agent |
| S27 | Nachricht senden | MUST | ✅ Vorhanden | Mit AI-Antwort-Generierung |
| S28 | Konversations-Historie | MUST | ✅ Vorhanden | LangChain Memory (50 Nachrichten) |
| S29 | Agenten-Auswahl | SHOULD | ✅ Vorhanden | Chat-Partner wählen |
| S30 | Chat-Archivierung | COULD | ❌ Fehlt | Konversationen archivieren |

#### B5. Social Trends & Kampagnen

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S31 | Trends abrufen | SHOULD | ✅ Vorhanden | Von Guardian, NewsAPI |
| S32 | Trend transformieren (AI) | SHOULD | ✅ Vorhanden | In Simulations-Kontext |
| S33 | Als Kampagne integrieren | SHOULD | ✅ Vorhanden | Mit Event-Erstellung |
| S34 | Kampagnen-Dashboard | COULD | ✅ Vorhanden | Übersicht, Metriken |
| S35 | Workflow (Fetch→Transform→Integrate) | COULD | ✅ Vorhanden | Einschritt-Prozess |

#### B6. Social Media Integration

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S36 | Posts importieren | COULD | ✅ Vorhanden | Von Facebook |
| S37 | Posts transformieren (AI) | COULD | ✅ Vorhanden | Dystopisch/Propaganda/Surveillance |
| S38 | Sentiment-Analyse (AI) | COULD | ✅ Vorhanden | Detailliert + Schnell |
| S39 | Agenten-Reaktionen (AI) | COULD | ✅ Vorhanden | Charakter-basiert |
| S40 | Thread-Analyse (AI) | COULD | ⚠️ Teilweise | Kommentar-Threads analysieren |

#### B7. Standorte

| # | Feature | Priorität | Status Alt | Beschreibung |
|---|---------|-----------|-----------|-------------|
| S41 | Städte verwalten | COULD | ✅ Vorhanden | CRUD mit Geo-Daten |
| S42 | Zonen verwalten | COULD | ✅ Vorhanden | CRUD pro Stadt |
| S43 | Straßen verwalten | COULD | ✅ Vorhanden | CRUD pro Zone |

### C. Settings-Features (NEU)

| # | Feature | Priorität | Beschreibung |
|---|---------|-----------|-------------|
| C1 | **General Settings** | MUST | Name, Beschreibung, Thema, Sprache |
| C2 | **World Settings** | MUST | Taxonomien verwalten (Systeme, Professionen, etc.) |
| C3 | **AI Settings** | SHOULD | Modelle pro Zweck, Prompt-Templates, Parameter |
| C4 | **Integration Settings** | SHOULD | Social Media Accounts, News-Quellen, API-Keys |
| C5 | **Design Settings** | DONE | Per-Simulation Theming: 32 Token-Overrides (Farben, Typographie, Charakter, Animation), 5 Presets, Live-Preview, Custom CSS. Impl. in Phase 3. |
| C6 | **Access Settings** | SHOULD | Öffentlich/Privat, Einladungen, Rollen |
| C7 | **Taxonomy Editor** | MUST | UI zum Hinzufügen/Bearbeiten/Deaktivieren von Taxonomie-Werten |
| C8 | **Prompt Template Editor** | SHOULD | UI zum Bearbeiten von AI-Prompts pro Sprache |
| C9 | **Model Selector** | SHOULD | AI-Modell pro Generierungs-Zweck wählen |

---

## Prioritäts-Verteilung für Rebuild

### Phase 1: MVP (Plattform-Grundgerüst)
- P1-P5 (Simulations-Management + Auth)
- C1-C2 (Basis-Settings + Taxonomien)
- S1-S10 (Agenten CRUD + AI-Generierung)
- S19-S22 (Events CRUD)
- S11-S14 (Gebäude CRUD)

### Phase 2: Kernfunktionen
- S23-S25 (Event-Generierung + Reaktionen)
- S26-S29 (Chat-System)
- S15-S18 (Gebäude-Bilder + Zuweisungen)
- C3, C6 (AI + Access Settings)
- C7-C9 (Taxonomy/Prompt/Model Editoren)

### Phase 3: Erweiterte Features
- P6-P7 (Einladungen + Mitgliederverwaltung)
- S31-S35 (Social Trends + Kampagnen)
- C4 (Integration Settings)
- S41-S43 (Standorte)

### Phase 4: Vollständig
- S36-S40 (Social Media Integration)
- P8-P10 (Archivierung, Klonen, Admin)
- ~~C5 (Design Settings)~~ — vorgezogen nach Phase 3 (implementiert)
