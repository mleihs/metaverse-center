# 05 - API Specification: Alle Endpoints (Simulation-Scoped)

**Version:** 1.2
**Datum:** 2026-02-26
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

## 21. Public Endpoints — Relationships, Echoes, Connections, Map-Data

Zusaetzliche oeffentliche Endpoints (ohne Authentifizierung, Rate-Limit: 100/min) fuer das Relationship-/Echo-/Connection-System. Ergaenzen die bestehenden 20 Public-Endpoints aus v1.1.

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

## Endpoint-Zusammenfassung

| Bereich | Endpoints | Methoden |
|---------|-----------|----------|
| Simulations | 6 | CRUD + Archive |
| Members | 4 | CRUD |
| Settings | 5 | GET/PUT/DELETE |
| Taxonomies | 5 | CRUD |
| Agents | 7 | CRUD + Portrait + Reactions |
| Agent Professions | 4 | CRUD |
| Buildings | 11 | CRUD + Image + Relations |
| Events | 8 | CRUD + Reactions + Generate |
| Locations | 11 | CRUD (Cities/Zones/Streets) |
| Campaigns | 7 | CRUD + Events + Metrics |
| Social Trends | 5 | CRUD + Fetch/Transform/Integrate |
| Social Media | 6 | Sync + Transform + Analyze |
| Chat | 5 | Conversations + Messages |
| Generation | 5 | AI Text + Image |
| Prompt Templates | 6 | CRUD + Test |
| Users | 1 | Profile (Auth via Supabase direkt) |
| Invitations | 3 | Create/Validate/Accept |
| Relationships | 5 | List (Agent/Sim) + Create + Patch + Delete |
| Echoes | 5 | List (Sim/Event) + Trigger + Approve + Reject |
| Connections | 4 | List + Create + Patch + Delete |
| Public (neu) | 6 | Relationships + Echoes + Connections + Map-Data |
| Public (bestehend) | 20 | Anonymer Lesezugriff |
| **Gesamt** | **~157** | |
