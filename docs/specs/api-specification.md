---
title: "API Specification"
id: api-specification
version: "2.8"
date: 2026-03-27
lang: de
type: spec
status: active
tags: [api, endpoints, routers, rest]
---

# 05 - API Specification: Alle Endpoints (Simulation-Scoped)

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

Alle Endpoints nutzen typisierte Pydantic-Wrapper als Return-Type-Annotation (kein `response_model=`):

```python
# Single/List-Response
@router.get("/agents/{agent_id}")
async def get_agent(...) -> SuccessResponse[AgentResponse]:
    return SuccessResponse(data=agent)

# Paginated Response
@router.get("/agents")
async def list_agents(...) -> PaginatedResponse[AgentResponse]:
    return PaginatedResponse(data=agents, meta=PaginationMeta(...))
```

**JSON-Shape (SuccessResponse):**
```json
{
  "success": true,
  "data": { ... }
}
```

**JSON-Shape (PaginatedResponse):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "count": 25,
    "total": 150,
    "limit": 25,
    "offset": 0
  }
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

### `GET /api/v1/simulations/:simId/agents/:agentId/aptitudes`
Aptitude-Werte eines Agenten fuer alle Operative-Typen.

**Auth:** Simulation-Mitglied (oder anon via Public-Endpoint)

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "agent_id": "uuid", "operative_type": "spy", "aptitude_level": 7 },
    { "id": "uuid", "agent_id": "uuid", "operative_type": "guardian", "aptitude_level": 5 }
  ]
}
```

### `PUT /api/v1/simulations/:simId/agents/:agentId/aptitudes`
Aptitude-Werte eines Agenten setzen/aktualisieren (Upsert pro operative_type).

**Auth:** Editor+

**Body:**
```json
{
  "aptitudes": [
    { "operative_type": "spy", "aptitude_level": 7 },
    { "operative_type": "guardian", "aptitude_level": 5 },
    { "operative_type": "saboteur", "aptitude_level": 4 }
  ]
}
```

### `GET /api/v1/simulations/:simId/aptitudes`
Alle Aptitude-Werte aller Agenten einer Simulation (fuer Lineup-Uebersicht).

**Auth:** Simulation-Mitglied (oder anon via Public-Endpoint)

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

Siehe **Auth and Security** (`auth-and-security.md`) für Details zum Auth-Flow und JWT-Handling.

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

### `GET /api/v1/users/me/notification-preferences`
Benachrichtigungspraeferenzen des aktuellen Benutzers. Gibt Defaults zurueck wenn keine Zeile existiert.

**Response:**
```json
{
  "success": true,
  "data": {
    "cycle_resolved": true,
    "phase_changed": true,
    "epoch_completed": true,
    "email_locale": "en"
  }
}
```

### `POST /api/v1/users/me/notification-preferences`
Benachrichtigungspraeferenzen upserten (erstellt Zeile bei erstem Aufruf, aktualisiert bei Folgeaufrufen).

**Body:**
```json
{
  "cycle_resolved": true,
  "phase_changed": false,
  "epoch_completed": true,
  "email_locale": "de"
}
```

**Response:** Gleiche Struktur wie GET.

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

Detail-Dokumentation fuer ausgewaehlte Public-Endpoints. Vollstaendige Liste aller 46 Public-Endpoints: siehe Abschnitt 29.

### `GET /api/v1/public/simulations/:simId/agents/by-slug/:slug`
Einzelnen Agenten per Slug abrufen (oeffentlich). Migration 137.

**Response:** `SuccessResponse[Agent]`

### `GET /api/v1/public/simulations/:simId/buildings/by-slug/:slug`
Einzelnes Gebaeude per Slug abrufen (oeffentlich). Migration 137.

**Response:** `SuccessResponse[Building]`

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
Aggregierter Endpoint fuer die Cartographer's Map — liefert alle Daten fuer die Kartenansicht in einem Request. Game Instances mit `epoch_status` = `completed` oder `cancelled` werden herausgefiltert — nur Templates und aktive Epoch-Instanzen erscheinen.

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
Epoche mit einer Template-Simulation beitreten. Keine Simulations-Mitgliedschaft erforderlich (Migration 049: Open Epoch Participation). Setzt `user_id` auf den authentifizierten Benutzer. Die `user_has_simulation_access()` Funktion gewaehrt dem Teilnehmer automatisch Lesezugriff auf die Simulations-Daten.

**Body:**
```json
{
  "simulation_id": "uuid"
}
```

**Validierung:**
- Simulation muss `simulation_type = 'template'` sein
- Benutzer darf nur einmal pro Epoche teilnehmen (UNIQUE Index auf `epoch_id, user_id`)

**Response** enthaelt `user_id`:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "epoch_id": "uuid",
    "simulation_id": "uuid",
    "user_id": "uuid",
    "current_rp": 0,
    "is_bot": false
  }
}
```

**Auth:** Authentifizierter Benutzer

### `DELETE /api/v1/epochs/:epochId/participants/:simulationId`
Epoche verlassen (nur in `lobby`-Phase).

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/epochs/:epochId/participants/:simulationId/draft`
Agenten-Draft fuer eine Epoch-Teilnahme abschliessen. Setzt `drafted_agent_ids` und `draft_completed_at` auf dem Participant-Record. Nur in `lobby`-Phase moeglich.

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

**Body:**
```json
{
  "agent_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Validierung:**
- `agent_ids` darf maximal `config.max_agents_per_player` Eintraege haben (Default: 3)
- Alle Agent-UUIDs muessen zur angegebenen Simulation gehoeren
- Draft kann nur einmal abgeschlossen werden (Idempotent: erneuter Aufruf ueberschreibt)

**Response:**
```json
{
  "success": true,
  "data": {
    "drafted_agent_ids": ["uuid-1", "uuid-2", "uuid-3"],
    "draft_completed_at": "2026-03-03T12:00:00Z"
  }
}
```

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

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

### `POST /api/v1/epochs/:epochId/teams/:teamId/join`
Bestehendem Team beitreten.

**Query:** `?simulation_id=uuid`

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

### `POST /api/v1/epochs/:epochId/teams/leave`
Team verlassen.

**Query:** `?simulation_id=uuid`

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

### `GET /api/v1/epochs/:epochId/proposals`
Allianz-Beitrittsantraege auflisten.

**Query:** `?team_id=uuid` (optional), `?status=pending|accepted|rejected|expired` (optional)

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

**Response:** `SuccessResponse` mit `AllianceProposal[]` (inkl. `votes`, `proposer_name`)

### `POST /api/v1/epochs/:epochId/proposals`
Beitrittsantrag an ein bestehendes Team stellen.

**Query:** `?simulation_id=uuid`

**Body:**
```json
{
  "team_id": "uuid"
}
```

**Validierung:** Antragsteller muss ohne Team sein, Epoch nicht in reckoning/completed, Team aktiv und nicht voll, kein doppelter Antrag. Solo-Teams (1 Mitglied) werden automatisch akzeptiert.

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

### `POST /api/v1/epochs/:epochId/proposals/:proposalId/vote`
Ueber einen Beitrittsantrag abstimmen (accept/reject).

**Query:** `?simulation_id=uuid`

**Body:**
```json
{
  "vote": "accept"
}
```

**Validierung:** Abstimmender muss Team-Mitglied sein. Ein Reject beendet den Antrag sofort. Einstimmiges Accept fuehrt zur Aufnahme. DB-Trigger `fn_resolve_alliance_proposal` (Migration 090) loest die Abstimmung automatisch auf.

**Auth:** Epoch-Participant (via `require_epoch_participant()`)

### `POST /api/v1/epochs/:epochId/teams/:teamId/invite`
Spieler ins eigene Team einladen (delegiert an Proposal-System).

**Query:** `?simulation_id=uuid` (Einladender)

**Body:**
```json
{
  "target_simulation_id": "uuid"
}
```

**Auth:** Epoch-Participant + muss Mitglied des Teams sein

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

**Auth:** Epoch-Participant

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

**Auth:** Epoch-Participant

### `POST /api/v1/epochs/:epochId/operatives/resolve`
Alle faelligen Missionen aufloesen. Nur Epoch-Creator.

**Auth:** Epoch-Creator

### `POST /api/v1/epochs/:epochId/operatives/counter-intel`
Counter-Intelligence-Sweep durchfuehren (kostet 4 RP).

**Query:** `?simulation_id=uuid`

**Auth:** Epoch-Participant

### `POST /api/v1/epochs/:epochId/operatives/fortify-zone`
Zone fortifizieren (kostet 2 RP). Nur waehrend Foundation-Phase. Erhoecht Zone-Security um 1 Tier fuer 5 Wettbewerbszyklen. Max 1 Fortifikation pro Zone pro Epoche. Versteckt — nur sichtbar fuer Besitzer und via Spion-Intel.

**Query:** `?simulation_id=uuid&zone_id=uuid`

**Auth:** Epoch-Participant

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "zone_id": "uuid",
    "security_bonus": 1,
    "expires_at_cycle": 7,
    "cost_rp": 2
  }
}
```

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
Punkte fuer aktuellen oder angegebenen Zyklus berechnen und speichern. Nur Epoch-Creator. Intern via `fn_compute_cycle_scores()` RPC (Migration 127) — Single SQL Call statt 12 Python-Queries pro Simulation.

**Query:** `?cycle=3` (optional)

**Auth:** Epoch-Creator

### `GET /api/v1/epochs/:epochId/scores/intel-dossiers`
Vorab-aggregierte Intel Dossiers fuer alle Gegner einer Simulation. Ersetzt client-seitige Berechnung aus Battle-Log-Daten.

**Query:** `?simulation_id={simId}` (required)

**Auth:** Authentifizierter Benutzer (Epoch-Teilnehmer)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "target_simulation_id": "uuid",
      "target_simulation_name": "Velgarien",
      "zone_security_summary": { "low": 2, "medium": 1, "high": 0 },
      "guardian_count": 3,
      "fortification_count": 1,
      "last_intel_cycle": 4,
      "is_stale": false
    }
  ]
}
```

**Felder:**
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `is_stale` | boolean | `true` wenn letzter Intel aelter als 2 Zyklen |

### LeaderboardEntry — Erweiterte Felder

Die Leaderboard-Response enthaelt zusaetzlich:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `ally_count` | int | Anzahl aktiver Alliierter |
| `ally_bonus_pct` | float | Allianz-Bonus in Prozent (z.B. 15.0) |
| `betrayal_penalty` | float | Aktive Verrats-Strafe auf Diplomatic Score (z.B. -25.0) |

---

## 26. Epoch Chat (`/api/v1/epochs/{epoch_id}/chat`)

Echtzeit-Kommunikation innerhalb einer Epoche. Unterstuetzt epoch-weite Nachrichten und team-interne Kanaele. Cursor-basierte Pagination.

### `POST /api/v1/epochs/:epochId/chat`
Nachricht senden (epoch-weit oder team-intern).

**Auth:** JWT (Teilnehmer der Epoche)

**Rate Limit:** 30/min

**Body:**
```json
{
  "channel_type": "epoch",
  "team_id": null,
  "simulation_id": "uuid",
  "content": "Message text..."
}
```

| Feld | Typ | Required | Beschreibung |
|------|-----|----------|-------------|
| `channel_type` | enum | Ja | `epoch` (alle) oder `team` (nur Teammitglieder) |
| `team_id` | UUID | Nein | Team-ID (required wenn `channel_type = "team"`) |
| `simulation_id` | UUID | Ja | Absender-Simulation |
| `content` | string | Ja | Nachrichtentext |

**Response:** `SuccessResponse[EpochChatMessage]`

### `GET /api/v1/epochs/:epochId/chat`
Epoch-weite Nachrichten auflisten (Cursor-basierte Pagination).

**Auth:** JWT (Teilnehmer der Epoche)

**Query:** `?before=<ISO-timestamp>&limit=50`

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `before` | string | - | ISO-Timestamp Cursor fuer Pagination |
| `limit` | int | 50 | Max Ergebnisse (1-100) |

**Response:** `PaginatedResponse[EpochChatMessage]`

### `GET /api/v1/epochs/:epochId/chat/team/:teamId`
Team-interne Nachrichten auflisten. Nur fuer Mitglieder des Teams sichtbar.

**Auth:** JWT (muss Mitglied des Teams sein)

**Query:** `?before=<ISO-timestamp>&limit=50`

**Response:** `PaginatedResponse[EpochChatMessage]`

### `POST /api/v1/epochs/:epochId/ready`
Cycle-Ready-Signal umschalten. Signalisiert, dass ein Teilnehmer bereit fuer den naechsten Zyklus ist. Loest Realtime-Broadcast aus.

**Auth:** JWT (Teilnehmer der Epoche)

**Body:**
```json
{
  "simulation_id": "uuid",
  "ready": true
}
```

**Response:** `SuccessResponse[EpochParticipant]`

### EpochChatMessage Schema

```json
{
  "id": "uuid",
  "epoch_id": "uuid",
  "user_id": "uuid",
  "simulation_id": "uuid",
  "channel_type": "epoch",
  "team_id": null,
  "content": "Message text...",
  "created_at": "2026-02-28T12:00:00Z",
  "simulation_name": "Velgarien",
  "simulation_slug": "velgarien"
}
```

---

## 27. Epoch Invitations (`/api/v1/epochs/{epoch_id}/invitations`)

Email-basierte Spielereinladungen fuer Epochen. Ersteller kann Spieler per E-Mail einladen. Einladungen enthalten AI-generierten Lore-Text. Versand ueber Resend API.

### `POST /api/v1/epochs/:epochId/invitations`
Einladung erstellen und per E-Mail versenden. Generiert automatisch Lore-Text via OpenRouter (gecached pro Epoche).

**Auth:** Epoch-Creator

**Rate Limit:** 10/min

**Body:**
```json
{
  "email": "player@example.com",
  "expires_in_hours": 168,
  "locale": "en"
}
```

| Feld | Typ | Required | Default | Beschreibung |
|------|-----|----------|---------|-------------|
| `email` | string | Ja | - | E-Mail-Adresse des Eingeladenen |
| `expires_in_hours` | int | Nein | 168 | Gueltigkeitsdauer in Stunden |
| `locale` | string | Nein | `"en"` | Sprache fuer Lore-Text und E-Mail |

**Response:** `SuccessResponse[EpochInvitationResponse]` (Status 201)

### `GET /api/v1/epochs/:epochId/invitations`
Alle Einladungen einer Epoche auflisten.

**Auth:** Epoch-Creator

**Response:** `SuccessResponse[list[EpochInvitationResponse]]`

### `DELETE /api/v1/epochs/:epochId/invitations/:invitationId`
Einladung widerrufen (setzt Status auf `revoked`).

**Auth:** Epoch-Creator

**Response:** `SuccessResponse`

### `POST /api/v1/epochs/:epochId/invitations/regenerate-lore`
AI-generierten Lore-Text fuer Einladungen neu generieren. Ueberschreibt den gecachten Text in `game_epochs.config.invitation_lore`.

**Auth:** Epoch-Creator

**Rate Limit:** 5/min

**Response:** `SuccessResponse[{ "lore_text": "..." }]`

### EpochInvitationResponse Schema

```json
{
  "id": "uuid",
  "epoch_id": "uuid",
  "email": "player@example.com",
  "token": "unique-token",
  "status": "pending",
  "invited_by": "uuid",
  "invited_role": "participant",
  "expires_at": "2026-03-07T12:00:00Z",
  "created_at": "2026-02-28T12:00:00Z",
  "updated_at": "2026-02-28T12:00:00Z"
}
```

---

## 28. Game Mechanics / Health Dashboard (Simulation-Scoped)

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

### `GET /api/v1/public/simulations/:simId/bleed-status`
Aggregierter Bleed-Status fuer Palimpsest-Overlay und Schwellenwert-UI. Enthält aktive Bleeds, Threshold-State (normal/critical/ascendant), Fracture-Warning, Entropy-Countdown, Foreign-Theme-Daten, Lore-Fragmente und `effects_suppressed` (Admin-Toggle fuer kritische Health-Effekte).

**Auth:** Anon (Public)

**Response:** `SuccessResponse[BleedStatusResponse]`

### `GET /api/v1/admin/health-effects`
Globaler + Per-Simulation Health-Effects-Status fuer Admin-Tab. Liefert globalen Master-Switch-Zustand und Liste aller aktiven Simulationen mit Health-Daten und Toggle-Status. Neu geforgte Simulationen starten mit `effects_enabled: false` (Migration 121 setzt Default in `fn_materialize_shard`).

**Rolle:** `platform_admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "global_enabled": true,
    "simulations": [
      {
        "id": "uuid",
        "name": "string",
        "slug": "string",
        "overall_health": 0.42,
        "threshold_state": "normal|critical|ascendant",
        "effects_enabled": true
      }
    ]
  }
}
```

### `PUT /api/v1/admin/health-effects/simulations/:simId`
Kritische Health-Effekte fuer eine einzelne Simulation aktivieren/deaktivieren.

**Rolle:** `platform_admin`

**Body:** `{ "enabled": boolean }`

### `POST /api/v1/simulations/:simId/threshold-actions/:actionType`
Notfall-Aktion bei kritischem Schwellenwert ausfuehren. Drei Typen: `scorched_earth`, `emergency_draft`, `reality_anchor`. Erfordert `overall_health < 0.25`.

**Rolle:** `editor`

**Query-Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `target_building_id` | UUID? | Zielgebäude (für `scorched_earth`) |
| `target_zone_id` | UUID? | Zielzone (für `scorched_earth`, `emergency_draft`) |

**Response:** `SuccessResponse`

### `GET /api/v1/public/simulations/by-slug/:slug/forge-progress`
Leichtgewichtiger Bildgenerierungs-Fortschritt fuer die Forge-Zeremonie und Post-Ceremony Image-Tracking. Delegiert an `get_forge_progress(slug)` Postgres-Funktion (Migration 098, erweitert in 107).

**Auth:** Anon (Public)

**Response:** `SuccessResponse[ForgeProgress]` — `{ total, completed, done, banner_url, agents: [{name, image_url}], buildings: [{name, image_url}], lore: [{name, image_url}] }`

- `banner_url`: URL des generierten Banners (null wenn noch nicht fertig)
- `lore`: Array der Lore-Sektionen mit `image_slug` — `image_url` ist der Slug wenn `image_generated_at IS NOT NULL`, sonst null
- `total`/`completed`: Zaehlt Banner + Agents + Buildings + Lore-Sektionen mit image_slug

---

## 29. Bot Players (`/api/v1/bot-players`)

CRUD fuer wiederverwendbare Bot-Presets. Jeder Benutzer kann eigene Bot-Presets erstellen und in Epochen einsetzen. Lesen duerfen alle authentifizierten Benutzer (fuer Lobby-Anzeige).

### `GET /api/v1/bot-players`
Eigene Bot-Presets auflisten.

**Auth:** JWT

**Response:** `SuccessResponse[BotPlayer[]]`

### `POST /api/v1/bot-players`
Neues Bot-Preset erstellen.

**Auth:** JWT

**Body:**
```json
{
  "name": "Iron Guardian",
  "personality": "sentinel",
  "difficulty": "medium",
  "config": {}
}
```

**Response:** `SuccessResponse[BotPlayer]` (Status 201)

### `PATCH /api/v1/bot-players/:botId`
Bot-Preset aktualisieren.

**Auth:** JWT (Ersteller)

**Body:** Partielle Felder von BotPlayer

**Response:** `SuccessResponse[BotPlayer]`

### `DELETE /api/v1/bot-players/:botId`
Bot-Preset loeschen.

**Auth:** JWT (Ersteller)

**Response:** `SuccessResponse[null]` (Status 204)

### `POST /api/v1/epochs/:epochId/add-bot`
Bot zu einer Epoche hinzufuegen. Erstellt einen neuen Epoch-Participant mit `is_bot=true`. Nur in der Lobby-Phase durch den Epoch-Creator moeglich.

**Auth:** Epoch-Creator, Lobby-Phase

**Body:**
```json
{
  "bot_player_id": "uuid",
  "simulation_id": "uuid"
}
```

**Response:** `SuccessResponse[EpochParticipant]` (Status 201)

### `DELETE /api/v1/epochs/:epochId/remove-bot/:participantId`
Bot aus Epoche entfernen.

**Auth:** Epoch-Creator, Lobby-Phase

**Response:** `SuccessResponse[null]` (Status 204)

---

## 30. Public Endpoints — Gesamt (49 Endpoints)

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
| 18a | GET | `/simulations/:simId/anchor` | Philosophical anchor data (category='anchor' Settings) |
| 19 | GET | `/simulations/:simId/social-trends` | Social Trends |
| 20 | GET | `/simulations/:simId/social-media` | Social Media Posts |
| 21 | GET | `/simulations/:simId/campaigns` | Kampagnen |

### Public Aptitudes, Relationships, Echoes, Connections, Map-Data

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 22 | GET | `/simulations/:simId/agents/:agentId/aptitudes` | Aptitude-Werte eines Agenten |
| 23 | GET | `/simulations/:simId/aptitudes` | Alle Aptitude-Werte einer Simulation |
| 24 | GET | `/simulations/:simId/agents/:agentId/relationships` | Beziehungen eines Agenten |
| 25 | GET | `/simulations/:simId/relationships` | Alle Beziehungen einer Simulation |
| 26 | GET | `/simulations/:simId/echoes` | Eingehende Echoes |
| 27 | GET | `/simulations/:simId/events/:eventId/echoes` | Echoes eines Events |
| 28 | GET | `/connections` | Alle Simulation-Connections |
| 29 | GET | `/map-data` | Aggregierte Karten-Daten |

### Public Embassies

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 30 | GET | `/simulations/:simId/embassies` | Embassy-Liste |
| 31 | GET | `/simulations/:simId/embassies/:embassyId` | Embassy-Details |
| 32 | GET | `/simulations/:simId/buildings/:buildingId/embassy` | Embassy fuer ein Building |
| 33 | GET | `/embassies` | Alle Embassies plattformweit |

### Public Game Health

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 34 | GET | `/simulations/:simId/health` | Health-Dashboard |
| 35 | GET | `/simulations/:simId/health/buildings` | Building-Readiness |
| 36 | GET | `/simulations/:simId/health/zones` | Zone-Stability |
| 37 | GET | `/simulations/:simId/health/embassies` | Embassy-Effectiveness |
| 38 | GET | `/health/all` | Globale Health-Uebersicht |

### Public Epochs & Competitive Layer

| # | Method | Path | Beschreibung |
|---|--------|------|-------------|
| 39 | GET | `/epochs` | Epochen-Liste |
| 40 | GET | `/epochs/active` | Aktive Epoche |
| 41 | GET | `/epochs/:epochId` | Epoch-Details |
| 42 | GET | `/epochs/:epochId/participants` | Teilnehmer |
| 43 | GET | `/epochs/:epochId/teams` | Teams/Allianzen |
| 44 | GET | `/epochs/:epochId/leaderboard` | Bestenliste |
| 45 | GET | `/epochs/:epochId/standings` | Endstaende |
| 46 | GET | `/epochs/:epochId/battle-log` | Battle-Log (oeffentlicher Feed) |
| 47 | GET | `/battle-feed?limit={1-50}` | Globaler oeffentlicher Battle-Feed (alle Epochen) |
| 48 | GET | `/epoch-invitations/:token` | Epoch-Einladung per Token validieren |

---

## 31. Zone Actions (Simulation-Scoped)

Simulation-Level Zonenaktionen fuer Stabilitaets-Management. Drei Aktionstypen mit unterschiedlichen Effekten, Dauern und Cooldowns.

### `GET /api/v1/simulations/:simId/zones/:zoneId/actions`
Aktuelle und kuerzliche Zonenaktionen auflisten (max 10).

**Rolle:** `viewer`

**Response:** `SuccessResponse[list[ZoneActionResponse]]`

### `POST /api/v1/simulations/:simId/zones/:zoneId/actions`
Neue Zonenaktion erstellen. Nur eine aktive Aktion pro Zone gleichzeitig. Cooldown-Validierung verhindert Re-Use desselben Aktionstyps.

**Rolle:** `editor`

**Body:**
```json
{
  "action_type": "fortify"
}
```

| Action Type | Effekt | Dauer | Cooldown |
|-------------|--------|-------|----------|
| `fortify` | +0.3 Stabilisierung | 7 Tage | 14 Tage |
| `quarantine` | -0.1 Isolierung | 14 Tage | 21 Tage |
| `deploy_resources` | +0.5 Notfallmassnahme | 3 Tage | 30 Tage |

**Response:** `SuccessResponse[ZoneActionResponse]` (Status 201)

**Fehler:**
- 409 Conflict: Bereits eine aktive Aktion auf dieser Zone
- 429 Too Many Requests: Cooldown fuer diesen Aktionstyp noch aktiv

### `DELETE /api/v1/simulations/:simId/zones/:zoneId/actions/:actionId`
Aktive Zonenaktion abbrechen (Soft-Delete).

**Rolle:** `editor`

**Response:** `SuccessResponse[ZoneActionResponse]`

---

## 32. Resonance Dungeons (Simulation-Scoped)

Prozedurale Dungeons die sich aus aktiven Substrate-Resonanzen oeffnen. Party-basierte Exploration mit phasenbasiertem Kampfsystem. 12 Endpoints unter `/api/v1/dungeons`. Vollstaendige Dokumentation: [Resonance Dungeons Spec](../concepts/resonance-dungeons-spec.md).

**Migrations:** 163 (Tabellen, RLS, Basis-RPCs), 164 (atomare RPCs, VIEW, Loot-Tracking)

### `GET /api/v1/dungeons/available?simulation_id=<uuid>`
Verfuegbare Dungeon-Archetypen mit aktiven Resonanzen ueber Schwellenwert. Nutzt `available_dungeons` VIEW (Migration 164).

**Rolle:** `viewer` | **Response:** `SuccessResponse[list[AvailableDungeonResponse]]`

### `POST /api/v1/dungeons/runs?simulation_id=<uuid>`
Neuen Dungeon-Run starten. Body: `{ archetype, party_agent_ids[], difficulty }`. Unique-Index verhindert parallele Runs pro Simulation.

**Rolle:** `editor` | **Response:** `SuccessResponse` (201)

### `GET /api/v1/dungeons/runs/{run_id}`
Run-Metadaten abrufen (Status, Fortschritt, Outcome).

**Rolle:** `viewer` | **Response:** `SuccessResponse[DungeonRunResponse]`

### `GET /api/v1/dungeons/runs/{run_id}/state`
Vollstaendiger Client-State (Fog-of-War gefiltert). Versucht In-Memory zuerst, Checkpoint-Recovery als Fallback.

**Rolle:** `viewer` | **Response:** `SuccessResponse[DungeonClientState]`

### `POST /api/v1/dungeons/runs/{run_id}/move`
Party in angrenzenden Raum bewegen. Validiert Adjazenz, verarbeitet Raum-Eintritt, Archetype-Effekte, Banter.

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `POST /api/v1/dungeons/runs/{run_id}/action`
Encounter-Choice oder Interaktion ausfuehren. Skill-Check-Resolution ueber `skill_checks.py`.

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `POST /api/v1/dungeons/runs/{run_id}/combat/submit`
Kampfaktionen fuer Planning-Phase einreichen. Automatische Resolution wenn alle Spieler eingereicht haben.

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `POST /api/v1/dungeons/runs/{run_id}/scout`
Spy-Faehigkeit: Angrenzende Raeume aufdecken, Visibility wiederherstellen (Shadow-Mechanik).

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `POST /api/v1/dungeons/runs/{run_id}/rest`
An Rastplatz rasten. Stress-Heilung, Condition-Recovery. Kann Hinterhalt ausloesen (Shadow VP 0).

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `POST /api/v1/dungeons/runs/{run_id}/retreat`
Dungeon verlassen (partieller Loot). Atomisch via `fn_abandon_dungeon_run` RPC.

**Rolle:** `editor` | **Response:** `SuccessResponse`

### `GET /api/v1/dungeons/runs/{run_id}/events`
Dungeon Event-Log (paginiert). Kampflog, Entdeckungen, Narrative.

**Rolle:** `viewer` | **Response:** `PaginatedResponse[DungeonEventResponse]`

### `GET /api/v1/dungeons/history?simulation_id=<uuid>`
Vergangene Dungeon-Runs einer Simulation (paginiert).

**Rolle:** `viewer` | **Response:** `PaginatedResponse[DungeonRunResponse]`

---

## 33. Substrate Resonances (Platform-Level)

Platform-Level Resonanzen die ueber alle Simulationen propagieren. Oeffentlich lesbar, Schreibzugriff nur fuer Platform-Admin. Vollstaendige Dokumentation: [Substrate Resonances Spec](../specs/substrate-resonances.md).

### `GET /api/v1/resonances`
Resonanzen auflisten (paginiert, filterbar).

**Query:** `?status=detected&signature=conflict_wave&search=crisis&limit=25&offset=0&include_deleted=false`

**Response:** `PaginatedResponse[ResonanceResponse]`

**Auth:** Authentifizierter Benutzer

**Hinweis:** ResonanceResponse enthaelt `magnitude_class` (computed): `low` (magnitude <= 0.4), `medium` (magnitude <= 0.7), `high` (magnitude > 0.7).

### `GET /api/v1/resonances/:resonanceId`
Einzelne Resonanz abrufen.

**Response:** `SuccessResponse[ResonanceResponse]` — inkl. `magnitude_class`

**Auth:** Authentifizierter Benutzer

### `POST /api/v1/resonances`
Neue Resonanz erstellen. Signature, Archetype und Event-Typen werden automatisch aus source_category abgeleitet (Postgres Trigger).

**Auth:** Platform-Admin (`require_platform_admin()`)

**Body:**
```json
{
  "source_category": "military_conflict",
  "title": "Eastern Continental War",
  "description": "Armed conflict spreading across...",
  "bureau_dispatch": "The Bureau has detected tremors...",
  "real_world_source": { "url": "...", "headline": "..." },
  "magnitude": 0.7,
  "impacts_at": "2026-03-10T00:00:00Z"
}
```

**Response:** `SuccessResponse[ResonanceResponse]` (Status 201)

### `PUT /api/v1/resonances/:resonanceId`
Resonanz aktualisieren.

**Auth:** Platform-Admin

**Body:** Partielle Felder (title, description, bureau_dispatch, magnitude, status, impacts_at, subsides_at)

### `POST /api/v1/resonances/:resonanceId/process-impact`
Impact-Verarbeitung ueber Simulationen triggern. Erzeugt 2-3 Events pro Simulation via AI-Generierung.

**Auth:** Platform-Admin

**Body:**
```json
{
  "simulation_ids": ["uuid-1", "uuid-2"],
  "generate_narratives": true,
  "locale": "de"
}
```

**Response:** `SuccessResponse[list[ResonanceImpactResponse]]` (Status 201)

### `GET /api/v1/resonances/:resonanceId/impacts`
Impact-Records fuer eine Resonanz auflisten.

**Response:** `SuccessResponse[list[ResonanceImpactResponse]]` — enthaelt `simulation_slug` pro Impact fuer URL-Konstruktion

### `PUT /api/v1/resonances/:resonanceId/status`
Resonanz-Status aktualisieren.

**Auth:** Platform-Admin

**Query:** `?new_status=subsiding`

### `POST /api/v1/resonances/:resonanceId/restore`
Soft-deleted Resonanz wiederherstellen.

**Auth:** Platform-Admin

### `DELETE /api/v1/resonances/:resonanceId`
Resonanz soft-deleten.

**Auth:** Platform-Admin

---

## 34. Forge Access Requests (Platform-Level)

Account-Tier-System (observer → architect → director) mit Request/Approve/Reject-Workflow. Bureau Clearance fuer Forge-Zugang.

### `POST /api/v1/forge/access-requests/`
Clearance-Antrag erstellen. 409 bei bereits vorhandenem pendingem Antrag. Loest Admin-Benachrichtigungs-Email aus (best-effort, non-blocking).

**Auth:** Authentifizierter Benutzer

**Body:**
```json
{
  "message": "Optional: Begruendung fuer Forge-Zugang"
}
```

**Response:** `SuccessResponse[ForgeAccessRequest]` (Status 201)

**Side Effects:** Admin-Email-Benachrichtigung an Platform-Admin mit Applicant-Email und Begruendung.

### `GET /api/v1/forge/access-requests/me`
Letzten eigenen Antrag abrufen.

**Auth:** Authentifizierter Benutzer

**Response:** `SuccessResponse[ForgeAccessRequest | null]`

### `GET /api/v1/forge/access-requests/pending`
Alle offenen Antraege mit Benutzer-Emails auflisten.

**Auth:** Platform-Admin (`require_platform_admin()`)

**Response:** `SuccessResponse[ForgeAccessRequestWithEmail[]]`

### `GET /api/v1/forge/access-requests/pending/count`
Anzahl offener Antraege.

**Auth:** Platform-Admin (`require_platform_admin()`)

**Response:** `SuccessResponse[{ count: number }]`

### `POST /api/v1/forge/access-requests/{request_id}/review`
Antrag genehmigen oder ablehnen. Ruft SECURITY DEFINER RPC auf, loest bilinguale Email-Benachrichtigung aus.

**Auth:** Platform-Admin (`require_platform_admin()`)

**Body:**
```json
{
  "action": "approve",
  "admin_notes": "Optional: Anmerkungen des Admins"
}
```

`action` akzeptiert `"approve"` oder `"reject"`.

**Response:** `SuccessResponse[ForgeAccessRequest]`

---

## 35. Forge Token Economy

Token-Kaufsystem (Mock-Monetarisierung), Wallet-Verwaltung, BYOK-Schluessel, Feature-Kaeufe (Darkroom, Dossier, Recruitment, Chronicle Export). Admin-Tools fuer Token-Grants und Bundle-Verwaltung.

### Benutzer-Endpoints

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| GET | `/api/v1/forge/token-bundles` | Liste aktiver Token-Bundles (Produkt-Katalog) | Architect+ |
| GET | `/api/v1/forge/wallet` | Wallet-Info: Balance, BYOK-Keys, Purchase-History | Architect+ |
| POST | `/api/v1/forge/wallet/purchase` | Mock-Token-Kauf (Bundle-Slug im Body) | Architect+ |
| GET | `/api/v1/forge/wallet/history` | Token-Kauf-Verlauf (Ledger) | Architect+ |
| PUT | `/api/v1/forge/wallet/keys` | BYOK-Schluessel aktualisieren (OpenRouter/Replicate) | Architect+ |
| GET | `/api/v1/forge/feature-purchases` | Feature-Kaeufe fuer Simulation auflisten | Member |
| POST | `/api/v1/forge/purchase/darkroom-pass` | Darkroom Pass kaufen (2 FT, 10 Regen-Budget) | Editor+ |
| POST | `/api/v1/forge/purchase/classified-dossier` | Classified Dossier kaufen (2 FT, AI-Lore-Generation) | Editor+ |
| POST | `/api/v1/forge/purchase/recruitment` | Recruitment Office kaufen (1 FT, 3 neue Agenten) | Editor+ |
| POST | `/api/v1/forge/purchase/chronicle-export` | Chronicle Export kaufen (1 FT, Codex PDF) | Editor+ |
| POST | `/api/v1/forge/purchase/chronicle-hires` | Full-Res Archive kaufen (1 FT, ZIP aller Bilder in nativer Aufloesung) | Editor+ |
| POST | `/api/v1/forge/darkroom/{sim_id}/regenerate` | Bild-Regeneration (Darkroom Budget dekrementieren) | Editor+ |
| GET | `/api/v1/forge/feature-purchases/{id}` | Einzelnen Feature-Kauf abrufen | Owner |

### Admin-Endpoints

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| GET | `/api/v1/forge/admin/token-bundles` | Alle Bundles (inkl. inaktive) | Platform Admin |
| PUT | `/api/v1/forge/admin/token-bundles/{id}` | Bundle bearbeiten (Preis, Tokens, Status) | Platform Admin |
| GET | `/api/v1/forge/admin/purchases` | Alle Token-Kaeufe (globaler Ledger) | Platform Admin |
| POST | `/api/v1/forge/admin/grant-tokens` | Token-Grant an User (1-1000, mit Grund) | Platform Admin |
| GET | `/api/v1/forge/admin/byok-system` | BYOK-System-Konfiguration abrufen | Platform Admin |
| PUT | `/api/v1/forge/admin/byok-system` | BYOK-Policy und Bypass-Settings aendern | Platform Admin |
| GET | `/api/v1/forge/admin/stats` | Token-Economy-Statistiken (Umsatz, Zirkulation) | Platform Admin |
| POST | `/api/v1/forge/admin/regenerate-images/{simulation_id}` | Batch-Bildgenerierung fuer bestehende Simulation triggern (optional Entity-Type-Filter) | Platform Admin |
| POST | `/api/v1/forge/admin/retrigger-batch/{simulation_id}` | Vollstaendige Batch-Regenerierung (Lore + Translations + Bilder) fuer bestehende Simulation. Rekonstruiert `draft_data` aus materialisierten Tabellen. Body: `{ include_lore: bool, entity_types: string[] \| null }` | Platform Admin |

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
| Agents | 10 | CRUD + Portrait + Reactions + Aptitudes (Get/Put/ListAll) |
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
| Users | 3 | Profile + Notification Preferences (GET + POST) |
| Invitations | 4 | Create + List + Validate + Accept |
| Relationships | 5 | List (Agent/Sim) + Create + Patch + Delete |
| Echoes | 5 | List (Sim/Event) + Trigger + Approve + Reject |
| Connections | 4 | List + Create + Patch + Delete |
| Embassies | 8 | List + Get + GetForBuilding + Create + Update + Activate + Suspend + Dissolve |
| Epochs | 20 | CRUD + Lifecycle (Start/Advance/Cancel/ResolveCycle) + Participants + Draft + Teams + Ready + AddBot + RemoveBot |
| Epoch Chat | 3 | Send + List (Epoch-wide) + List (Team) |
| Epoch Invitations | 4 | Create+Send + List + Revoke + RegenerateLore |
| Operatives | 8 | Deploy + List + Threats + Get + Recall + Resolve + CounterIntel + FortifyZone |
| Scores | 4 | Leaderboard + Standings + History + Compute |
| Game Mechanics | 8 | Health Dashboard + Sim/Buildings/Zones/Embassies + Refresh |
| Bot Players | 5 | CRUD (List + Get + Create + Update + Delete) |
| Aptitudes | 3 | GetForAgent + UpdateForAgent + ListForSimulation |
| Zone Actions | 3 | List + Create + Cancel |
| Resonances | 9 | CRUD + ProcessImpact + Impacts + Status + Restore |
| Resonance Dungeons | 12 | Available + CreateRun + GetRun + State + Move + Action + Combat + Scout + Rest + Retreat + Events + History |
| Forge Access | 5 | Create + Me + Pending + PendingCount + Review |
| Forge Token Economy | 20 | Bundles (1) + Wallet (3) + Feature Purchases (7) + Darkroom Regen (1) + Admin Bundles (2) + Admin Purchases (1) + Admin Grant (1) + Admin BYOK (2) + Admin Stats (2) |
| Admin | 11 | Settings (2) + Users (3) + Memberships (3) + Cleanup (3) |
| Public | 49 | Anonymer Lesezugriff (alle GET-only) |
| **Gesamt** | **307** | **38 Router** |
