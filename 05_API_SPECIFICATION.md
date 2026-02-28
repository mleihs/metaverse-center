# 05 - API Specification: Alle Endpoints (Simulation-Scoped)

**Version:** 1.3
**Datum:** 2026-02-28
**Aenderung v1.3:** 217 Endpoints total (28 Router). Neue Router: health, seo, embassies, epochs, operatives, scores, game_mechanics. 44 Public-Endpoints. Generation-Router erweitert um `/relationships`. Chat-Router erweitert auf 11 Endpoints. Campaigns-Router erweitert auf 8 Endpoints. Social-Trends erweitert auf 8 Endpoints. Settings-Router erweitert auf 6 Endpoints. Invitations-Router erweitert auf 4 Endpoints.
**Aenderung v1.2:** 157 Endpoints total (23 Router). 3 neue Router (relationships, echoes, connections). 6 neue Public-Endpoints fuer Relationships/Echoes/Connections/Map-Data. Aggregierter Map-Data-Endpoint.
**Aenderung v1.1:** 136 Endpoints total (20 Router). 20 Public-Endpoints unter `/api/v1/public/*` fuer anonymen Lesezugriff (Rate-Limit: 100/min). Public-Simulations-Endpoint liefert jetzt `agent_count`, `building_count`, `event_count` via `simulation_dashboard` View.

---

## Base URL

```
/api/v1
```

### URL-Konvention

Alle simulation-scoped Endpoints:
```
/api/v1/simulations/:simId/{resource}
```

Plattform-Level Endpoints:
```
/api/v1/{resource}
```

### Standard-Response-Format

**Erfolg:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "count": 25,
    "total": 150,
    "limit": 25,
    "offset": 0
  },
  "timestamp": "2026-02-15T12:00:00Z"
}
```

**Fehler:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name is required",
    "details": { "field": "name" }
  },
  "timestamp": "2026-02-15T12:00:00Z"
}
```

### Standard Query-Parameter

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `limit` | int | 25 | Max Ergebnisse (1-100) |
| `offset` | int | 0 | Pagination Offset |
| `sort` | string | `-created_at` | Sortierung (`-` = DESC) |
| `search` | string | - | Volltextsuche |

### Authentication

Alle Endpoints erfordern JWT Bearer Token im Header:
```
Authorization: Bearer <jwt_token>
```

---

## 0. Health (Plattform-Level)

### `GET /api/v1/health`
Platform Health Check. Keine Authentifizierung erforderlich.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2026-02-28T12:00:00Z"
}
```

---

## 0b. SEO

Root-Level Endpoints (kein `/api/v1`-Prefix).

### `GET /robots.txt`
Dynamische `robots.txt` mit Sitemap-Referenz. Keine Authentifizierung erforderlich.

### `GET /sitemap.xml`
Dynamische XML-Sitemap aus Simulations-Slugs. Keine Authentifizierung erforderlich. Cache: 1 Stunde.

---

## 1. Simulations (Plattform-Level)

### `GET /api/v1/simulations`
Listet alle Simulationen des Benutzers.

**Query:** `?status=active&limit=25&offset=0`

### `POST /api/v1/simulations`
Erstellt eine neue Simulation.

**Body:**
```json
{
  "name": "Velgarien",
  "slug": "velgarien",
  "description": "Eine dystopische Weltensimulation",
  "theme": "dystopian",
  "content_locale": "de",
  "additional_locales": ["en"]
}
```

### `GET /api/v1/simulations/:simId`
Details einer Simulation inkl. Settings-Zusammenfassung.

### `PUT /api/v1/simulations/:simId`
Aktualisiert Simulation (Owner/Admin).

### `DELETE /api/v1/simulations/:simId`
Soft-Delete (nur Owner).

### `POST /api/v1/simulations/:simId/archive`
Archiviert eine Simulation (Owner).

---

## 2. Simulation Members

### `GET /api/v1/simulations/:simId/members`
Listet alle Mitglieder.

### `POST /api/v1/simulations/:simId/members`
Fügt ein Mitglied hinzu (Owner/Admin).

**Body:**
```json
{
  "user_id": "uuid",
  "role": "editor"
}
```

### `PUT /api/v1/simulations/:simId/members/:memberId`
Ändert die Rolle eines Mitglieds.

### `DELETE /api/v1/simulations/:simId/members/:memberId`
Entfernt ein Mitglied (Owner/Admin).

---

## 3. Simulation Settings

### `GET /api/v1/simulations/:simId/settings`
Alle Settings (nach Kategorie gruppiert).

**Query:** `?category=ai`

### `GET /api/v1/simulations/:simId/settings/:category/:key`
Ein spezifisches Setting.

### `PUT /api/v1/simulations/:simId/settings/:category/:key`
Setzt ein Setting (Admin/Owner).

**Body:**
```json
{
  "value": { ... }
}
```

### `PUT /api/v1/simulations/:simId/settings/:category`
Batch-Update einer ganzen Kategorie.

### `DELETE /api/v1/simulations/:simId/settings/:category/:key`
Setzt ein Setting auf Platform-Default zurück.

---

## 4. Simulation Taxonomies

### `GET /api/v1/simulations/:simId/taxonomies`
Alle Taxonomien.

**Query:** `?type=profession&active=true`

### `GET /api/v1/simulations/:simId/taxonomies/:type`
Alle Werte eines Taxonomie-Typs.

### `POST /api/v1/simulations/:simId/taxonomies`
Neuen Taxonomie-Wert erstellen.

**Body:**
```json
{
  "taxonomy_type": "profession",
  "value": "alchemist",
  "label": { "de": "Alchemist", "en": "Alchemist" },
  "sort_order": 11
}
```

### `PUT /api/v1/simulations/:simId/taxonomies/:id`
Aktualisiert einen Taxonomie-Wert.

### `DELETE /api/v1/simulations/:simId/taxonomies/:id`
Deaktiviert einen Taxonomie-Wert (Soft-Delete via `is_active`).

---

## 5. Agents

### `GET /api/v1/simulations/:simId/agents`
Alle Agenten (paginiert).

**Query:** `?system=politics&gender=male&profession=scientist&search=Max&limit=25&offset=0&sort=-name`

### `GET /api/v1/simulations/:simId/agents/:agentId`
Agent-Details inkl. Professionen.

### `POST /api/v1/simulations/:simId/agents`
Neuen Agenten erstellen.

**Body:**
```json
{
  "name": "Agent Name",
  "system": "politics",
  "character": "Beschreibung...",
  "background": "Hintergrund...",
  "gender": "male",
  "primary_profession": "scientist"
}
```

### `PUT /api/v1/simulations/:simId/agents/:agentId`
Agenten aktualisieren.

### `DELETE /api/v1/simulations/:simId/agents/:agentId`
Agenten löschen (Soft-Delete, cascade auf Relationen).

### `POST /api/v1/simulations/:simId/agents/:agentId/portrait`
Portrait generieren (AI).

### `GET /api/v1/simulations/:simId/agents/:agentId/reactions`
Alle Reaktionen eines Agenten.

---

## 6. Agent Professions

### `GET /api/v1/simulations/:simId/agents/:agentId/professions`
Professionen eines Agenten.

### `POST /api/v1/simulations/:simId/agents/:agentId/professions`
Profession hinzufügen.

**Body:**
```json
{
  "profession": "scientist",
  "qualification_level": 3,
  "specialization": "Quantum Physics",
  "is_primary": false
}
```

### `PUT /api/v1/simulations/:simId/agents/:agentId/professions/:professionId`
Profession aktualisieren.

### `DELETE /api/v1/simulations/:simId/agents/:agentId/professions/:professionId`
Profession entfernen.

---

## 7. Buildings

### `GET /api/v1/simulations/:simId/buildings`
Alle Gebäude (paginiert).

**Query:** `?city_id=uuid&zone_id=uuid&type=residential&search=Akademie`

### `GET /api/v1/simulations/:simId/buildings/:buildingId`
Gebäude-Details.

### `POST /api/v1/simulations/:simId/buildings`
Gebäude erstellen.

### `PUT /api/v1/simulations/:simId/buildings/:buildingId`
Gebäude aktualisieren.

### `DELETE /api/v1/simulations/:simId/buildings/:buildingId`
Gebäude löschen.

### `POST /api/v1/simulations/:simId/buildings/:buildingId/image`
Gebäude-Bild generieren (AI).

### `GET /api/v1/simulations/:simId/buildings/:buildingId/agents`
Agenten eines Gebäudes.

### `POST /api/v1/simulations/:simId/buildings/:buildingId/agents/:agentId`
Agent zu Gebäude zuweisen.

### `DELETE /api/v1/simulations/:simId/buildings/:buildingId/agents/:agentId`
Agent-Zuweisung entfernen.

### `GET /api/v1/simulations/:simId/buildings/:buildingId/requirements`
Profession-Anforderungen eines Gebäudes.

### `PUT /api/v1/simulations/:simId/buildings/:buildingId/requirements`
Profession-Anforderungen setzen.

---

## 8. Events

### `GET /api/v1/simulations/:simId/events`
Alle Events (paginiert).

**Query:** `?event_type=political&urgency=high&sort=-occurred_at&limit=50`

### `GET /api/v1/simulations/:simId/events/:eventId`
Event-Details.

### `POST /api/v1/simulations/:simId/events`
Event erstellen.

### `PUT /api/v1/simulations/:simId/events/:eventId`
Event aktualisieren.

### `DELETE /api/v1/simulations/:simId/events/:eventId`
Event löschen.

### `GET /api/v1/simulations/:simId/events/:eventId/reactions`
Reaktionen auf ein Event.

### `POST /api/v1/simulations/:simId/events/:eventId/reactions`
Reaktion hinzufügen (manuell).

### `POST /api/v1/simulations/:simId/events/:eventId/generate-reaction`
Agenten-Reaktion generieren (AI).

---

## 9. Locations (Cities, Zones, Streets)

### `GET /api/v1/simulations/:simId/cities`
Alle Städte.

### `POST /api/v1/simulations/:simId/cities`
Stadt erstellen.

### `GET /api/v1/simulations/:simId/cities/:cityId`
Stadt-Details mit Zonen.

### `PUT /api/v1/simulations/:simId/cities/:cityId`
Stadt aktualisieren.

### `DELETE /api/v1/simulations/:simId/cities/:cityId`
Stadt löschen (cascade auf Zonen, Streets).

### `GET /api/v1/simulations/:simId/cities/:cityId/zones`
Zonen einer Stadt.

### `POST /api/v1/simulations/:simId/cities/:cityId/zones`
Zone erstellen.

### `GET /api/v1/simulations/:simId/zones/:zoneId`
Zone-Details.

### `PUT /api/v1/simulations/:simId/zones/:zoneId`
Zone aktualisieren.

### `DELETE /api/v1/simulations/:simId/zones/:zoneId`
Zone löschen.

### `GET /api/v1/simulations/:simId/cities/:cityId/streets`
Straßen einer Stadt.

### `POST /api/v1/simulations/:simId/cities/:cityId/streets`
Straße erstellen.

---

## 10. Campaigns

### `GET /api/v1/simulations/:simId/campaigns`
Alle Kampagnen.

### `POST /api/v1/simulations/:simId/campaigns`
Kampagne erstellen.

### `GET /api/v1/simulations/:simId/campaigns/:campaignId`
Kampagne-Details.

### `PUT /api/v1/simulations/:simId/campaigns/:campaignId`
Kampagne aktualisieren.

### `DELETE /api/v1/simulations/:simId/campaigns/:campaignId`
Kampagne löschen.

### `GET /api/v1/simulations/:simId/campaigns/:campaignId/events`
Events einer Kampagne.

### `GET /api/v1/simulations/:simId/campaigns/:campaignId/metrics`
Metriken einer Kampagne.

---

## 11. Social Trends

### `GET /api/v1/simulations/:simId/social-trends`
Alle Trends.

**Query:** `?platform=guardian&sentiment=negative&is_processed=false`

### `POST /api/v1/simulations/:simId/social-trends/fetch`
Trends von externen Quellen abrufen.

**Body:**
```json
{
  "source": "guardian",
  "query": "technology",
  "limit": 10
}
```

### `POST /api/v1/simulations/:simId/social-trends/transform`
Trend in Simulations-Kontext transformieren (AI).

**Body:**
```json
{
  "trend_id": "uuid",
  "transformation_type": "dystopian"
}
```

### `POST /api/v1/simulations/:simId/social-trends/integrate`
Trend als Kampagne integrieren.

### `POST /api/v1/simulations/:simId/social-trends/workflow`
Vollständiger Workflow: Fetch → Transform → Integrate.

---

## 12. Social Media Integration

### `GET /api/v1/simulations/:simId/social-media/posts`
Alle importierten Posts.

**Query:** `?platform=facebook&transformed=true`

### `POST /api/v1/simulations/:simId/social-media/sync`
Posts von konfigurierter Platform synchronisieren.

### `POST /api/v1/simulations/:simId/social-media/posts/:postId/transform`
Post transformieren (AI).

### `POST /api/v1/simulations/:simId/social-media/posts/:postId/analyze-sentiment`
Sentiment-Analyse (AI).

### `POST /api/v1/simulations/:simId/social-media/posts/:postId/generate-reactions`
Agenten-Reaktionen generieren (AI).

### `GET /api/v1/simulations/:simId/social-media/posts/:postId/comments`
Kommentare eines Posts.

---

## 13. Chat

### `GET /api/v1/simulations/:simId/chat/conversations`
Alle Konversationen des Benutzers.

### `POST /api/v1/simulations/:simId/chat/conversations`
Neue Konversation starten.

**Body:**
```json
{
  "agent_id": "uuid"
}
```

### `GET /api/v1/simulations/:simId/chat/conversations/:conversationId`
Konversation mit Nachrichten.

**Query:** `?limit=50&before=timestamp`

### `POST /api/v1/simulations/:simId/chat/conversations/:conversationId/messages`
Nachricht senden (mit optionaler AI-Antwort).

**Body:**
```json
{
  "content": "Hallo Agent!",
  "generate_response": true
}
```

### `DELETE /api/v1/simulations/:simId/chat/conversations/:conversationId`
Konversation archivieren.

---

## 14. Generation (AI)

### `POST /api/v1/simulations/:simId/generate/agent`
Agent-Beschreibung generieren.

**Body:**
```json
{
  "name": "Agent Name",
  "system": "politics",
  "gender": "male",
  "fields": ["character", "background"]
}
```

### `POST /api/v1/simulations/:simId/generate/building-text`
Gebäude-Beschreibung generieren.

### `POST /api/v1/simulations/:simId/generate/portrait-description`
Portrait-Beschreibung generieren.

### `POST /api/v1/simulations/:simId/generate/event`
Event generieren.

### `POST /api/v1/simulations/:simId/generate/relationships`
Beziehungsvorschlaege fuer einen Agenten per AI generieren. Liefert eine Liste von Vorschlaegen mit Typ, Ziel-Agent, Beschreibung und Intensitaet.

**Body:**
```json
{
  "agent_id": "uuid",
  "locale": "en"
}
```

### `POST /api/v1/simulations/:simId/generate/image`
Bild generieren (Agent/Gebäude).

**Body:**
```json
{
  "prompt": "Portrait description...",
  "purpose": "agent_portrait",
  "entity_id": "uuid"
}
```

---

## 15. Prompt Templates

### `GET /api/v1/simulations/:simId/prompt-templates`
Alle Templates (Simulation + Plattform-Defaults).

**Query:** `?type=agent_generation&locale=de&active=true`

### `GET /api/v1/simulations/:simId/prompt-templates/:templateId`
Template-Details.

### `POST /api/v1/simulations/:simId/prompt-templates`
Neues Template erstellen (Admin).

### `PUT /api/v1/simulations/:simId/prompt-templates/:templateId`
Template aktualisieren.

### `DELETE /api/v1/simulations/:simId/prompt-templates/:templateId`
Template deaktivieren.

### `POST /api/v1/simulations/:simId/prompt-templates/:templateId/test`
Template testen (AI).

---

## 16. Auth (Frontend → Supabase direkt)

Authentifizierung erfolgt **direkt zwischen Frontend und Supabase Auth** — kein Backend-Proxy.

```
Frontend → supabase.auth.signUp()                 // Registrierung
Frontend → supabase.auth.signInWithPassword()      // Login
Frontend → supabase.auth.signOut()                 // Logout
Frontend → supabase.auth.refreshSession()          // Token erneuern (automatisch)
Frontend → supabase.auth.resetPasswordForEmail()   // Passwort zurücksetzen
```

Siehe **10_AUTH_AND_SECURITY.md** für Details zum Auth-Flow und JWT-Handling.

### `GET /api/v1/users/me`
Aktuelles Benutzerprofil mit Simulations-Mitgliedschaften.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "memberships": [
      { "simulation_id": "uuid", "simulation_name": "Velgarien", "role": "owner" },
      { "simulation_id": "uuid", "simulation_name": "Utopia", "role": "editor" }
    ]
  }
}
```

---

## 17. Invitations

### `POST /api/v1/simulations/:simId/invitations`
Einladung erstellen.

**Body:**
```json
{
  "email": "user@example.com",
  "role": "editor",
  "expires_in_hours": 72
}
```

### `GET /api/v1/invitations/:token`
Einladung validieren (Plattform-Level).

### `POST /api/v1/invitations/:token/accept`
Einladung annehmen.

---

## 18. Relationships (Simulation-Scoped)

Beziehungen zwischen Agenten innerhalb einer Simulation. Bidirektionale und gerichtete Beziehungen mit Intensitaetswerten.

### `GET /api/v1/simulations/:simId/agents/:agentId/relationships`
Alle Beziehungen eines Agenten (beide Richtungen — source und target).

**Response:** `SuccessResponse[list[RelationshipResponse]]`

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/relationships`
Alle Beziehungen einer Simulation (fuer Graphen-Darstellung).

**Query:** `?limit=100&offset=0`

**Limits:** `limit` 1-500 (Default: 100)

**Response:** `PaginatedResponse[RelationshipResponse]`

**Rolle:** `viewer`

### `POST /api/v1/simulations/:simId/agents/:agentId/relationships`
Beziehung zwischen zwei Agenten erstellen. Audit-Log wird geschrieben.

**Body:**
```json
{
  "target_agent_id": "uuid",
  "relationship_type": "ally",
  "is_bidirectional": true,
  "intensity": 5,
  "description": "Langjährige Verbündete"
}
```

| Feld | Typ | Required | Default | Beschreibung |
|------|-----|----------|---------|-------------|
| `target_agent_id` | UUID | Ja | - | Ziel-Agent |
| `relationship_type` | string | Ja | - | Art der Beziehung (frei definierbar) |
| `is_bidirectional` | bool | Nein | `true` | Beidseitige Beziehung |
| `intensity` | int | Nein | `5` | Intensitaet (1-10) |
| `description` | string | Nein | `null` | Beschreibung |

**Response:** `SuccessResponse[RelationshipResponse]` (Status 201)

**Rolle:** `editor`

### `PATCH /api/v1/simulations/:simId/relationships/:relationshipId`
Beziehung aktualisieren. Alle Felder optional (Partial Update). Audit-Log wird geschrieben.

**Body:**
```json
{
  "relationship_type": "rival",
  "intensity": 8
}
```

**Response:** `SuccessResponse[RelationshipResponse]`

**Rolle:** `editor`

### `DELETE /api/v1/simulations/:simId/relationships/:relationshipId`
Beziehung loeschen. Audit-Log wird geschrieben.

**Response:** `SuccessResponse[{ "message": "Relationship deleted." }]`

**Rolle:** `editor`

### RelationshipResponse Schema

```json
{
  "id": "uuid",
  "simulation_id": "uuid",
  "source_agent_id": "uuid",
  "target_agent_id": "uuid",
  "relationship_type": "ally",
  "is_bidirectional": true,
  "intensity": 5,
  "description": "Langjährige Verbündete",
  "metadata": null,
  "created_at": "2026-02-26T12:00:00Z",
  "updated_at": "2026-02-26T12:00:00Z",
  "source_agent": { "id": "uuid", "name": "Agent A" },
  "target_agent": { "id": "uuid", "name": "Agent B" }
}
```

---

## 19. Echoes (Simulation-Scoped)

Event-Echoes (Bleed) — simulationsuebergreifende Ereignis-Resonanzen. Ein Event in Simulation A kann als Echo in Simulation B auftauchen. Echoes durchlaufen einen Status-Workflow: `pending` → `approved` / `rejected`. Erfordert eine aktive Simulation-Connection zwischen den Simulationen.

### `GET /api/v1/simulations/:simId/echoes`
Alle Echoes einer Simulation (eingehend oder ausgehend).

**Query:** `?direction=incoming&status=pending&limit=25&offset=0`

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `direction` | string | `incoming` | `incoming` oder `outgoing` |
| `status` | string | - | Filter nach Status (`pending`, `approved`, `rejected`) |
| `limit` | int | 25 | Max Ergebnisse (1-100) |
| `offset` | int | 0 | Pagination Offset |

**Response:** `PaginatedResponse[EchoResponse]`

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/events/:eventId/echoes`
Alle Echoes die von einem bestimmten Event ausgehen.

**Response:** `SuccessResponse[list[EchoResponse]]`

**Rolle:** `viewer`

### `POST /api/v1/simulations/:simId/echoes`
Echo manuell ausloesen — sendet ein Event als Echo an eine Ziel-Simulation. Das Quell-Event muss zur aktuellen Simulation gehoeren. Verwendet `admin_supabase` (service_role) fuer simulationsuebergreifenden Schreibzugriff. Audit-Log wird geschrieben.

**Body:**
```json
{
  "source_event_id": "uuid",
  "target_simulation_id": "uuid",
  "echo_vector": "resonance",
  "echo_strength": 0.8
}
```

| Feld | Typ | Required | Default | Beschreibung |
|------|-----|----------|---------|-------------|
| `source_event_id` | UUID | Ja | - | Quell-Event (muss in `:simId` existieren) |
| `target_simulation_id` | UUID | Ja | - | Ziel-Simulation |
| `echo_vector` | enum | Ja | - | Vektor: `commerce`, `language`, `memory`, `resonance`, `architecture`, `dream`, `desire` |
| `echo_strength` | float | Nein | `1.0` | Staerke (0-1) |

**Response:** `SuccessResponse[EchoResponse]` (Status 201)

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/echoes/:echoId/approve`
Eingehendes Echo genehmigen. Verwendet `admin_supabase`. Audit-Log wird geschrieben.

**Response:** `SuccessResponse[EchoResponse]`

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/echoes/:echoId/reject`
Eingehendes Echo ablehnen. Verwendet `admin_supabase`. Audit-Log wird geschrieben.

**Response:** `SuccessResponse[EchoResponse]`

**Rolle:** `admin`

### EchoResponse Schema

```json
{
  "id": "uuid",
  "source_event_id": "uuid",
  "source_simulation_id": "uuid",
  "target_simulation_id": "uuid",
  "target_event_id": null,
  "echo_vector": "resonance",
  "echo_strength": 0.8,
  "echo_depth": 1,
  "root_event_id": null,
  "status": "pending",
  "bleed_metadata": null,
  "created_at": "2026-02-26T12:00:00Z",
  "updated_at": "2026-02-26T12:00:00Z",
  "source_event": { "id": "uuid", "title": "..." },
  "target_event": null
}
```

### Echo Status-Workflow

```
pending → approved    (Admin genehmigt, Target-Event wird erzeugt)
pending → rejected    (Admin lehnt ab, Echo wird archiviert)
```

### Echo-Vektoren (enum)

| Vektor | Beschreibung |
|--------|-------------|
| `commerce` | Wirtschaftliche Verflechtungen |
| `language` | Sprachliche/kulturelle Resonanz |
| `memory` | Kollektive Erinnerungen |
| `resonance` | Allgemeine thematische Resonanz |
| `architecture` | Bauliche/raeumliche Einfluesse |
| `dream` | Traumhafte/unbewusste Verbindungen |
| `desire` | Sehnsuechte und Beduerfnisse |

---

## 20. Connections (Plattform-Level)

Verbindungen zwischen Simulationen — definieren ueber welche Vektoren Echoes (Bleed) zwischen zwei Simulationen fliessen koennen. Plattform-Level (nicht simulation-scoped).

### `GET /api/v1/connections`
Alle Simulation-Connections auflisten (aktive und inaktive).

**Response:** `SuccessResponse[list[ConnectionResponse]]`

**Auth:** Authentifizierter Benutzer (kein Rollen-Check)

### `POST /api/v1/connections`
Neue Verbindung zwischen zwei Simulationen erstellen. Verwendet `admin_supabase`.

**Body:**
```json
{
  "simulation_a_id": "uuid",
  "simulation_b_id": "uuid",
  "connection_type": "bleed",
  "bleed_vectors": ["commerce", "memory", "resonance"],
  "strength": 0.5,
  "description": "Handelsroute zwischen den Welten",
  "is_active": true
}
```

| Feld | Typ | Required | Default | Beschreibung |
|------|-----|----------|---------|-------------|
| `simulation_a_id` | UUID | Ja | - | Erste Simulation |
| `simulation_b_id` | UUID | Ja | - | Zweite Simulation |
| `connection_type` | string | Nein | `"bleed"` | Art der Verbindung |
| `bleed_vectors` | list[string] | Nein | `[]` | Erlaubte Echo-Vektoren |
| `strength` | float | Nein | `0.5` | Verbindungsstaerke (0-1) |
| `description` | string | Nein | `null` | Beschreibung |
| `is_active` | bool | Nein | `true` | Verbindung aktiv |

**Response:** `SuccessResponse[ConnectionResponse]` (Status 201)

**Auth:** Authentifizierter Benutzer + `admin_supabase` (Platform-Admin)

### `PATCH /api/v1/connections/:connectionId`
Verbindung aktualisieren. Alle Felder optional. Verwendet `admin_supabase`.

**Body:**
```json
{
  "bleed_vectors": ["commerce", "memory"],
  "strength": 0.7,
  "is_active": false
}
```

**Response:** `SuccessResponse[ConnectionResponse]`

**Auth:** Authentifizierter Benutzer + `admin_supabase` (Platform-Admin)

### `DELETE /api/v1/connections/:connectionId`
Verbindung loeschen. Verwendet `admin_supabase`.

**Response:** `SuccessResponse[{ "message": "Connection deleted." }]`

**Auth:** Authentifizierter Benutzer + `admin_supabase` (Platform-Admin)

### ConnectionResponse Schema

```json
{
  "id": "uuid",
  "simulation_a_id": "uuid",
  "simulation_b_id": "uuid",
  "connection_type": "bleed",
  "bleed_vectors": ["commerce", "memory", "resonance"],
  "strength": 0.5,
  "description": "Handelsroute zwischen den Welten",
  "is_active": true,
  "created_at": "2026-02-26T12:00:00Z",
  "updated_at": "2026-02-26T12:00:00Z",
  "simulation_a": { "id": "uuid", "name": "Velgarien" },
  "simulation_b": { "id": "uuid", "name": "Speranza" }
}
```

---

## 21. Public Endpoints — Relationships, Echoes, Connections, Map-Data (Details)

Detail-Dokumentation fuer ausgewaehlte Public-Endpoints. Vollstaendige Liste aller 44 Public-Endpoints: siehe Abschnitt 27.

### `GET /api/v1/public/simulations/:simId/agents/:agentId/relationships`
Beziehungen eines Agenten (oeffentlich).

**Response:** `SuccessResponse[list[RelationshipResponse]]`

### `GET /api/v1/public/simulations/:simId/relationships`
Alle Beziehungen einer Simulation (oeffentlich, fuer Graphen).

**Query:** `?limit=100&offset=0`

**Response:** `PaginatedResponse[RelationshipResponse]`

### `GET /api/v1/public/simulations/:simId/echoes`
Eingehende Echoes einer Simulation (oeffentlich).

**Query:** `?limit=25&offset=0`

**Response:** `PaginatedResponse[EchoResponse]`

### `GET /api/v1/public/simulations/:simId/events/:eventId/echoes`
Echoes eines bestimmten Events (oeffentlich).

**Response:** `SuccessResponse[list[EchoResponse]]`

### `GET /api/v1/public/connections`
Alle aktiven Simulation-Connections (oeffentlich, fuer Map).

**Response:** `SuccessResponse[list[ConnectionResponse]]`

### `GET /api/v1/public/map-data`
Aggregierter Endpoint fuer die Cartographer's Map — liefert alle Daten fuer die Kartenansicht in einem Request.

**Response:**
```json
{
  "success": true,
  "data": {
    "simulations": [
      { "id": "uuid", "name": "Velgarien", "slug": "velgarien", "status": "active", "..." : "..." }
    ],
    "connections": [
      {
        "id": "uuid",
        "simulation_a_id": "uuid",
        "simulation_b_id": "uuid",
        "connection_type": "bleed",
        "bleed_vectors": ["commerce", "memory"],
        "strength": 0.5,
        "is_active": true
      }
    ],
    "echo_counts": {
      "sim-uuid-1": 3,
      "sim-uuid-2": 7
    }
  }
}
```

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `simulations` | list[dict] | Alle aktiven Simulationen mit Basis-Daten |
| `connections` | list[dict] | Alle aktiven Connections zwischen Simulationen |
| `echo_counts` | dict | Anzahl aktiver Echoes pro Simulation (Key: `simulation_id`) |

---

## 22. Embassies (Simulation-Scoped)

Cross-simulation diplomatic buildings. An embassy is a building with `special_type = 'embassy'` linked to a target simulation. Agents assigned to embassies become ambassadors (`is_ambassador` computed flag in API response). Status-Workflow: `proposed` → `active` ↔ `suspended` → `dissolved`.

### `GET /api/v1/simulations/:simId/embassies`
Liste aller Embassies in der Simulation.

**Query:** `?status=active&limit=25&offset=0`

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/embassies/:embassyId`
Embassy-Details inkl. Building-Daten.

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/buildings/:buildingId/embassy`
Embassy-Daten fuer ein bestimmtes Building (falls vorhanden, sonst `null`).

**Rolle:** `viewer`

### `POST /api/v1/simulations/:simId/embassies`
Erstellt eine neue Embassy-Verbindung zwischen zwei Buildings in verschiedenen Simulationen. Setzt `special_type = 'embassy'` auf dem Building.

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/embassies/:embassyId`
Aktualisiert Embassy-Metadaten (Partial Update).

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/embassies/:embassyId/activate`
Aktiviert eine vorgeschlagene oder suspendierte Embassy.

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/embassies/:embassyId/suspend`
Suspendiert eine aktive Embassy.

**Rolle:** `admin`

### `PATCH /api/v1/simulations/:simId/embassies/:embassyId/dissolve`
Loest eine Embassy dauerhaft auf (setzt Building-Attribute zurueck).

**Rolle:** `admin`

---

## 23. Epochs — Competitive Layer (Plattform-Level)

Epochen sind zeitlich begrenzte PvP-Wettbewerbe zwischen Simulationen. Status-Workflow: `lobby` → `foundation` → `tension` → `crisis` → `resolution` → `completed` / `cancelled`. Ersteller einer Epoche hat erweiterte Lifecycle-Rechte.

### `GET /api/v1/epochs`
Alle Epochen (paginiert, optionaler Status-Filter).

**Query:** `?status=active&limit=25&offset=0`

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/active`
Aktuell aktive Epoche (falls vorhanden, sonst `null`).

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId`
Epoch-Details.

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs`
Neue Epoche erstellen (startet in `lobby`-Phase).

**Body:**
```json
{
  "name": "Epoch of Twilight",
  "description": "...",
  "config": { "cycle_duration_hours": 72, "max_participants": 8 }
}
```

**Auth:** Authentifizierter Benutzer

### `PATCH /api/v1/epochs/:epochId`
Epoch-Konfiguration aktualisieren (nur in `lobby`-Phase).

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/start`
Epoche starten (`lobby` → `foundation`). Nur Ersteller.

**Auth:** Epoch-Creator

### `POST /api/v1/epochs/:epochId/advance`
Zur naechsten Phase vorrücken. Nur Ersteller.

**Auth:** Epoch-Creator

### `POST /api/v1/epochs/:epochId/cancel`
Epoche abbrechen. Nur Ersteller.

**Auth:** Epoch-Creator

### `POST /api/v1/epochs/:epochId/resolve-cycle`
Aktuellen Zyklus aufloesen (RP zuweisen, Zyklus-Zaehler erhoehen). Nur Ersteller.

**Auth:** Epoch-Creator

### `GET /api/v1/epochs/:epochId/participants`
Alle Teilnehmer einer Epoche auflisten.

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/participants`
Epoche mit einer Simulation beitreten. Benutzer muss `editor+` in der Simulation sein.

**Body:**
```json
{
  "simulation_id": "uuid"
}
```

**Auth:** Simulation-Editor+

### `DELETE /api/v1/epochs/:epochId/participants/:simulationId`
Epoche verlassen (nur in `lobby`-Phase).

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId/teams`
Alle Teams/Allianzen einer Epoche auflisten.

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/teams`
Neues Team/Allianz erstellen.

**Query:** `?simulation_id=uuid` (eigene Simulation)

**Body:**
```json
{
  "name": "The Northern Alliance"
}
```

**Auth:** Simulation-Editor+

### `POST /api/v1/epochs/:epochId/teams/:teamId/join`
Bestehendem Team beitreten.

**Query:** `?simulation_id=uuid`

**Auth:** Simulation-Editor+

### `POST /api/v1/epochs/:epochId/teams/leave`
Team verlassen.

**Query:** `?simulation_id=uuid`

**Auth:** Simulation-Editor+

---

## 24. Operatives (Epoch-Scoped)

Operative Missionen innerhalb einer Epoche. Agenten werden als Spione/Saboteure/Diplomaten in andere Simulationen entsendet. Missionen kosten Resource Points (RP).

### `POST /api/v1/epochs/:epochId/operatives`
Operativen Agenten auf Mission entsenden (kostet RP).

**Query:** `?simulation_id=uuid` (Quell-Simulation)

**Body:**
```json
{
  "operative_type": "spy",
  "agent_id": "uuid",
  "target_simulation_id": "uuid",
  "target_building_id": "uuid"
}
```

**Auth:** Simulation-Editor+

### `GET /api/v1/epochs/:epochId/operatives`
Eigene Missionen auflisten (optionaler Filter nach Simulation/Status).

**Query:** `?simulation_id=uuid&status=active&limit=25&offset=0`

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId/operatives/threats`
Erkannte Bedrohungen fuer eigene Simulationen auflisten.

**Query:** `?simulation_id=uuid` (eigene Simulation)

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId/operatives/:missionId`
Missions-Details.

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/operatives/:missionId/recall`
Aktiven Operativen zurueckrufen.

**Query:** `?simulation_id=uuid`

**Auth:** Simulation-Editor+

### `POST /api/v1/epochs/:epochId/operatives/resolve`
Alle faelligen Missionen aufloesen. Nur Epoch-Creator.

**Auth:** Epoch-Creator

### `POST /api/v1/epochs/:epochId/operatives/counter-intel`
Counter-Intelligence-Sweep durchfuehren (kostet 3 RP).

**Query:** `?simulation_id=uuid`

**Auth:** Simulation-Editor+

---

## 25. Scores & Leaderboard (Epoch-Scoped)

Punkte-Berechnung, Bestenliste und Verlauf fuer Epochen.

### `GET /api/v1/epochs/:epochId/scores/leaderboard`
Aktuelle Bestenliste der Epoche.

**Query:** `?cycle=3` (optionaler Zyklus-Filter, Default: aktuellster)

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId/scores/standings`
Endstände fuer abgeschlossene Epochen (inkl. Dimensions-Titel).

**Auth:** Authentifizierter Benutzer

### `GET /api/v1/epochs/:epochId/scores/simulations/:simulationId`
Punkte-Verlauf einer Simulation ueber alle Zyklen einer Epoche.

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/scores/compute`
Punkte fuer aktuellen oder angegebenen Zyklus berechnen und speichern. Nur Epoch-Creator.

**Query:** `?cycle=3` (optional)

**Auth:** Epoch-Creator

---

## 26. Game Mechanics / Health Dashboard (Simulation-Scoped)

Lese-Endpoints fuer Materialized Views (mv_building_readiness, mv_zone_stability, mv_embassy_effectiveness, mv_simulation_health). Berechnete Spielwerte fuer Buildings, Zonen und Embassies. Admin-only Refresh-Trigger.

### `GET /api/v1/simulations/:simId/health`
Vollstaendiges Health-Dashboard — aggregiert alle Metriken (Simulation-Gesundheit, Building-Readiness, Zone-Stability, Embassy-Effectiveness).

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/simulation`
Simulations-Level Gesundheitsmetriken.

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/buildings`
Building-Readiness fuer alle Gebaeude (paginiert, sortierbar).

**Query:** `?zone_id=uuid&order_by=readiness&order_asc=true&limit=100&offset=0`

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/buildings/:buildingId`
Readiness-Metriken fuer ein einzelnes Gebaeude.

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/zones`
Zone-Stability fuer alle Zonen.

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/zones/:zoneId`
Stability-Metriken fuer eine einzelne Zone.

**Rolle:** `viewer`

### `GET /api/v1/simulations/:simId/health/embassies`
Embassy-Effectiveness fuer alle Embassies dieser Simulation.

**Rolle:** `viewer`

### `POST /api/v1/simulations/:simId/health/refresh`
Manuelles Refresh aller Materialized Views. Normalerweise ueber Trigger automatisch — dieser Endpoint erlaubt manuelles Neuberechnen.

**Rolle:** `admin`

---

## 27. Public Endpoints — Gesamt (44 Endpoints)

Alle oeffentlichen Endpoints (ohne Authentifizierung, Rate-Limit: 100/min) unter `/api/v1/public/`.

### Bestehende Public-Endpoints (Simulations, Entities, Chat, Taxonomies, Settings)

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 1 | GET | `/simulations` | Alle Simulationen (mit Counts) |
| 2 | GET | `/simulations/by-slug/:slug` | Simulation per Slug aufloesen |
| 3 | GET | `/simulations/:simId` | Simulations-Details |
| 4 | GET | `/simulations/:simId/agents` | Agenten-Liste |
| 5 | GET | `/simulations/:simId/agents/:agentId` | Agent-Details |
| 6 | GET | `/simulations/:simId/buildings` | Gebaeude-Liste |
| 7 | GET | `/simulations/:simId/buildings/:buildingId` | Gebaeude-Details |
| 8 | GET | `/simulations/:simId/events` | Events-Liste |
| 9 | GET | `/simulations/:simId/events/:eventId` | Event-Details |
| 10 | GET | `/simulations/:simId/locations/cities` | Staedte-Liste |
| 11 | GET | `/simulations/:simId/locations/cities/:cityId` | Stadt-Details |
| 12 | GET | `/simulations/:simId/locations/zones` | Zonen-Liste |
| 13 | GET | `/simulations/:simId/locations/zones/:zoneId` | Zone-Details |
| 14 | GET | `/simulations/:simId/locations/streets` | Strassen-Liste |
| 15 | GET | `/simulations/:simId/chat/conversations` | Konversationen |
| 16 | GET | `/simulations/:simId/chat/conversations/:convId/messages` | Nachrichten |
| 17 | GET | `/simulations/:simId/taxonomies` | Taxonomien |
| 18 | GET | `/simulations/:simId/settings` | Settings (nur `design`-Kategorie) |
| 19 | GET | `/simulations/:simId/social-trends` | Social Trends |
| 20 | GET | `/simulations/:simId/social-media` | Social Media Posts |
| 21 | GET | `/simulations/:simId/campaigns` | Kampagnen |

### Public Relationships, Echoes, Connections, Map-Data

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 22 | GET | `/simulations/:simId/agents/:agentId/relationships` | Beziehungen eines Agenten |
| 23 | GET | `/simulations/:simId/relationships` | Alle Beziehungen einer Simulation |
| 24 | GET | `/simulations/:simId/echoes` | Eingehende Echoes |
| 25 | GET | `/simulations/:simId/events/:eventId/echoes` | Echoes eines Events |
| 26 | GET | `/connections` | Alle Simulation-Connections |
| 27 | GET | `/map-data` | Aggregierte Karten-Daten |

### Public Embassies

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 28 | GET | `/simulations/:simId/embassies` | Embassy-Liste |
| 29 | GET | `/simulations/:simId/embassies/:embassyId` | Embassy-Details |
| 30 | GET | `/simulations/:simId/buildings/:buildingId/embassy` | Embassy fuer ein Building |
| 31 | GET | `/embassies` | Alle Embassies plattformweit |

### Public Game Health

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 32 | GET | `/simulations/:simId/health` | Health-Dashboard |
| 33 | GET | `/simulations/:simId/health/buildings` | Building-Readiness |
| 34 | GET | `/simulations/:simId/health/zones` | Zone-Stability |
| 35 | GET | `/simulations/:simId/health/embassies` | Embassy-Effectiveness |
| 36 | GET | `/health/all` | Globale Health-Uebersicht |

### Public Epochs & Competitive Layer

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 37 | GET | `/epochs` | Epochen-Liste |
| 38 | GET | `/epochs/active` | Aktive Epoche |
| 39 | GET | `/epochs/:epochId` | Epoch-Details |
| 40 | GET | `/epochs/:epochId/participants` | Teilnehmer |
| 41 | GET | `/epochs/:epochId/teams` | Teams/Allianzen |
| 42 | GET | `/epochs/:epochId/leaderboard` | Bestenliste |
| 43 | GET | `/epochs/:epochId/standings` | Endstaende |
| 44 | GET | `/epochs/:epochId/battle-log` | Battle-Log (oeffentlicher Feed) |

---

## Endpoint-Zusammenfassung

| Bereich | Endpoints | Methoden |
|---------|-----------|----------|
| Health | 1 | GET (Plattform-Level) |
| SEO | 2 | GET (robots.txt, sitemap.xml) |
| Simulations | 5 | CRUD + Archive |
| Members | 4 | CRUD |
| Settings | 6 | List + ByCategory + Get + Create + Update + Delete |
| Taxonomies | 5 | CRUD |
| Agents | 7 | CRUD + Portrait + Reactions |
| Agent Professions | 4 | CRUD |
| Buildings | 11 | CRUD + Image + Relations |
| Events | 8 | CRUD + Reactions + Generate |
| Locations | 11 | CRUD (Cities/Zones/Streets) |
| Campaigns | 8 | CRUD + Events + AddEvent + Metrics |
| Social Trends | 8 | List + Fetch/Transform/Integrate + Workflow + Browse/TransformArticle/IntegrateArticle |
| Social Media | 6 | Sync + Transform + Analyze |
| Chat | 11 | Conversations + Messages + Agents |
| Generation | 6 | AI Text + Image + Relationships |
| Prompt Templates | 6 | CRUD + Test |
| Users | 1 | Profile (Auth via Supabase direkt) |
| Invitations | 4 | Create + List + Validate + Accept |
| Relationships | 5 | List (Agent/Sim) + Create + Patch + Delete |
| Echoes | 5 | List (Sim/Event) + Trigger + Approve + Reject |
| Connections | 4 | List + Create + Patch + Delete |
| Embassies | 8 | List + Get + GetForBuilding + Create + Update + Activate + Suspend + Dissolve |
| Epochs | 16 | CRUD + Lifecycle (Start/Advance/Cancel/ResolveCycle) + Participants + Teams |
| Operatives | 7 | Deploy + List + Threats + Get + Recall + Resolve + CounterIntel |
| Scores | 4 | Leaderboard + Standings + History + Compute |
| Game Mechanics | 8 | Health Dashboard + Sim/Buildings/Zones/Embassies + Refresh |
| Public | 44 | Anonymer Lesezugriff (alle GET-only) |
| **Gesamt** | **217** | **28 Router** |
