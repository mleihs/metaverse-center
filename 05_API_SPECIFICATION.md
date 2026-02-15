# 05 - API Specification: Alle Endpoints (Simulation-Scoped)

**Version:** 1.0
**Datum:** 2026-02-15

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
| **Gesamt** | **~108** | |
