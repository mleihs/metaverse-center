# 10 - Auth and Security

**Version:** 1.2
**Datum:** 2026-02-25
**Aenderung v1.2:** Public-First-Architektur: `get_anon_supabase()` erstellt Supabase-Client ohne JWT (anon-Key only). 21 anon-SELECT-RLS-Policies fuer oeffentlichen Lesezugriff. Frontend-Services routen GET-Requests via `appState.isAuthenticated.value` zu `/api/v1/public/*` (anon) oder `/api/v1/*` (auth). Rate-Limiting: 100/min fuer Public-Endpoints.

---

## Architektur-Prinzip: Hybrid-Ansatz

Die Plattform nutzt eine **hybride Architektur** mit Defense in Depth:

```
Frontend ──→ Supabase direkt:   Auth, Storage, Realtime
Frontend ──→ FastAPI:           Business-Logik (CRUD, AI, Transformationen)
FastAPI  ──→ Supabase:          Mit User-JWT (RLS aktiv!)

Sicherheitsschicht 1: FastAPI Depends() prüft Rollen
Sicherheitsschicht 2: Supabase RLS prüft simulation_id + User-Zugehörigkeit
```

**Warum Hybrid?** Zwei unabhängige Sicherheitsschichten sind besser als eine. Wenn FastAPI einen Permission-Bug hat, greifen die RLS-Policies. Wenn RLS einen Bug hat, greift FastAPI.

---

## Authentication

### Supabase Auth (Frontend-direkt)

Die Authentifizierung erfolgt **direkt zwischen Frontend und Supabase Auth** — ohne Umweg über das Backend.

| Aspekt | Implementierung |
|--------|----------------|
| **Provider** | Supabase Auth (Email/Password) |
| **Token-Typ** | JWT (JSON Web Token) |
| **Token-Refresh** | Supabase Client auto-refresh |
| **Session-Storage** | Supabase Client (LocalStorage) |
| **Multi-Tab** | Supabase `onAuthStateChange()` Listener |
| **Aufrufer** | Frontend direkt (`@supabase/supabase-js`) |

### Auth-Flow

```
1. Frontend: supabase.auth.signInWithPassword({email, password})
2. Supabase Auth: Validiert Credentials, gibt JWT + Refresh-Token zurück
3. Frontend: Supabase Client speichert Session automatisch
4. Frontend: Setzt Authorization Header für alle FastAPI-Requests
5. Frontend: Supabase Client refresht Token automatisch
6. FastAPI: Validiert JWT aus Authorization Header
7. FastAPI: Erstellt Supabase Client mit User-JWT → RLS greift
```

**Kein Auth-Router im Backend nötig.** Login, Signup, Logout, Password-Reset, Token-Refresh werden vollständig von Supabase Auth + Frontend-Client abgewickelt.

### Frontend Auth-Service

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

    // Globaler Auth-State-Listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      appState.setUser(session?.user ?? null);
      appState.setAccessToken(session?.access_token ?? null);
    });
  }

  async signUp(email: string, password: string) {
    return await this.supabase.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async resetPassword(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email);
  }

  getSession() {
    return this.supabase.auth.getSession();
  }
}

export const authService = new SupabaseAuthService();
```

### Backend JWT-Validierung

Das Backend erhält den Supabase-JWT im `Authorization` Header und validiert ihn:

```python
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from pydantic import BaseModel
from uuid import UUID

class CurrentUser(BaseModel):
    id: UUID
    email: str
    access_token: str  # Original-Token für Supabase-Client

async def get_current_user(authorization: str = Header(...)) -> CurrentUser:
    """Validiert den Supabase-JWT aus dem Authorization Header."""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return CurrentUser(
            id=UUID(payload["sub"]),
            email=payload.get("email", ""),
            access_token=token  # Wird an Supabase-Client weitergegeben
        )
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### JWT Token-Struktur (Supabase-generiert)

```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

## Backend Supabase-Client: User-JWT statt Service Key

**Kritisches Architektur-Prinzip:** Das Backend erstellt Supabase-Clients **mit dem JWT des aktuellen Users**, nicht mit dem Service Key. Dadurch greifen alle RLS-Policies automatisch.

```python
from fastapi import Depends
from supabase import create_client, Client

async def get_supabase(user: CurrentUser = Depends(get_current_user)) -> Client:
    """Supabase Client authentifiziert als aktueller User → RLS aktiv."""
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {user.access_token}"}
        )
    )

# Verwendung in Routers:
@router.get("/agents")
async def list_agents(
    simulation_id: UUID,
    supabase: Client = Depends(get_supabase),
    user: CurrentUser = Depends(get_current_user),
):
    # RLS filtert automatisch: User sieht nur Agenten seiner Simulationen
    result = supabase.table("agents") \
        .select("*") \
        .eq("simulation_id", str(simulation_id)) \
        .execute()
    return {"success": True, "data": result.data}
```

### Service Key: Nur für System-Operationen

Der `SUPABASE_SERVICE_KEY` (bypasses RLS) wird **ausschließlich** für Operationen verwendet, die keinem spezifischen User zugeordnet sind:

| Operation | Warum Service Key nötig |
|-----------|------------------------|
| Audit-Log schreiben | System-Event, kein User-Kontext |
| Plattform-Admin Dashboard | Daten über alle Simulationen |
| Scheduled Tasks (Cron) | Kein User-Request |
| AI-generierte Bilder speichern (Storage) | Backend-Pipeline, kein Frontend-Upload |
| Einladungs-Token validieren | Noch kein authentifizierter User |

```python
# Nur für Admin/System-Operationen:
def get_admin_supabase() -> Client:
    """Supabase Client mit Service Key → bypasses RLS. SPARSAM verwenden!"""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )
```

---

## Rollen-System pro Simulation

### Rollen-Hierarchie

```
Platform Admin (global)
  └── Kann alles auf Plattform-Ebene

Simulation Owner
  └── Kann alles innerhalb seiner Simulation

Simulation Admin
  └── Kann Inhalte + Settings (außer Access) verwalten

Simulation Editor
  └── Kann Inhalte erstellen und bearbeiten

Simulation Viewer
  └── Kann nur lesen
```

### Rollen-Speicherung

```sql
CREATE TABLE simulation_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id uuid REFERENCES simulations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(simulation_id, user_id)
);
```

### Permission-Prüfung (Backend — Sicherheitsschicht 1)

```python
from fastapi import Depends, HTTPException, status
from uuid import UUID

ROLE_HIERARCHY = {'owner': 4, 'admin': 3, 'editor': 2, 'viewer': 1}

def require_role(required_role: str):
    """FastAPI Dependency-Factory für Rollen-Prüfung."""
    async def check(
        simulation_id: UUID,
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ) -> CurrentUser:
        result = supabase.table("simulation_members") \
            .select("role") \
            .eq("simulation_id", str(simulation_id)) \
            .eq("user_id", str(user.id)) \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(403, detail="Not a member of this simulation")

        user_level = ROLE_HIERARCHY.get(result.data["role"], 0)
        required_level = ROLE_HIERARCHY.get(required_role, 0)
        if user_level < required_level:
            raise HTTPException(403, detail="Insufficient permissions")
        return user
    return check

# Verwendung:
@router.post("/agents")
async def create_agent(
    simulation_id: UUID,
    body: AgentCreate,
    user: CurrentUser = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
):
    ...
```

### Permission-Prüfung (Frontend)

```typescript
// In Komponenten:
const canEdit = appState.canEdit;  // computed signal basierend auf Rolle

// Bedingte UI:
${canEdit.value ? html`<button @click=${this.edit}>Edit</button>` : ''}
```

---

## Row Level Security (RLS) — Sicherheitsschicht 2

### Strategie: Simulation-basierte Isolation

RLS greift automatisch, weil das Backend den **User-JWT** verwendet (nicht den Service Key).

```sql
-- Helper-Funktionen (verwenden auth.uid() aus dem JWT)
CREATE OR REPLACE FUNCTION public.user_has_simulation_access(sim_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM simulation_members
    WHERE simulation_id = sim_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_simulation_role(sim_id uuid)
RETURNS text AS $$
  SELECT role FROM simulation_members
  WHERE simulation_id = sim_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### RLS-Policies für alle Tabellen

```sql
-- Beispiel: agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Lesen: Jedes Mitglied
CREATE POLICY agents_select ON agents FOR SELECT
  USING (user_has_simulation_access(simulation_id));

-- Erstellen: Editor+
CREATE POLICY agents_insert ON agents FOR INSERT
  WITH CHECK (
    user_simulation_role(simulation_id) IN ('owner', 'admin', 'editor')
  );

-- Aktualisieren: Editor+
CREATE POLICY agents_update ON agents FOR UPDATE
  USING (user_simulation_role(simulation_id) IN ('owner', 'admin', 'editor'));

-- Löschen: Admin+
CREATE POLICY agents_delete ON agents FOR DELETE
  USING (user_simulation_role(simulation_id) IN ('owner', 'admin'));
```

**Kein pauschaler Service-Role-Bypass mehr.** Nur Tabellen, die System-Operationen benötigen, erhalten gezielt Service-Role-Policies:

```sql
-- Audit-Log: Nur System darf schreiben
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit-Log: Admins dürfen lesen
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (user_simulation_role(simulation_id) IN ('owner', 'admin'));
```

### Defense in Depth: Doppelte Absicherung

```
Request: POST /api/v1/simulations/:simId/agents

Schicht 1 (FastAPI):
  → Depends(get_current_user): JWT gültig?
  → Depends(require_role("editor")): User ist Editor+ in dieser Simulation?

Schicht 2 (Supabase RLS):
  → agents_insert Policy: user_simulation_role(sim_id) IN ('owner','admin','editor')?

Beide Schichten müssen unabhängig bestanden werden.
```

### Alle Tabellen mit RLS

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `simulations` | Member | - | Admin+ | Owner |
| `simulation_members` | Member | Admin+ | Owner | Owner |
| `simulation_settings` | Member | Admin+ | Admin+ | Admin+ |
| `simulation_taxonomies` | Member | Admin+ | Admin+ | Admin+ |
| `agents` | Member | Editor+ | Editor+ | Admin+ |
| `buildings` | Member | Editor+ | Editor+ | Admin+ |
| `events` | Member | Editor+ | Editor+ | Admin+ |
| `event_reactions` | Member | Editor+ | Editor+ | Admin+ |
| `cities` | Member | Admin+ | Admin+ | Admin+ |
| `zones` | Member | Admin+ | Admin+ | Admin+ |
| `city_streets` | Member | Admin+ | Admin+ | Admin+ |
| `campaigns` | Member | Editor+ | Editor+ | Admin+ |
| `social_trends` | Member | Editor+ | Editor+ | Admin+ |
| `social_media_posts` | Member | Editor+ | Editor+ | Admin+ |
| `chat_conversations` | Own | Own | Own | Own |
| `chat_messages` | Own Conv | Own Conv | - | - |
| `prompt_templates` | Member | Admin+ | Admin+ | Admin+ |
| `audit_log` | Admin+ | Service only | - | - |

---

## Storage: Hybride Zuständigkeit

### User-Uploads → Frontend direkt zu Supabase Storage

```typescript
// Frontend: Direkter Upload zu Supabase Storage
async uploadCustomPortrait(file: File, agentId: string): Promise<string> {
  const path = `${simulationId}/${agentId}/${Date.now()}.webp`;
  const { data, error } = await this.supabase.storage
    .from('agent.portraits')
    .upload(path, file, { contentType: 'image/webp' });

  if (error) throw error;

  const { data: urlData } = this.supabase.storage
    .from('agent.portraits')
    .getPublicUrl(path);

  return urlData.publicUrl;
}
```

### AI-generierte Bilder → Backend mit Service Key

AI-generierte Bilder (Portraits, Gebäude) werden vom Backend verarbeitet und hochgeladen, da das Backend die Replicate-Pipeline steuert:

```python
# Backend: Service Key für AI-Pipeline-Uploads
async def upload_generated_image(bucket: str, path: str, image_bytes: bytes) -> str:
    admin_client = get_admin_supabase()  # Service Key
    result = admin_client.storage.from_(bucket).upload(path, image_bytes)
    url = admin_client.storage.from_(bucket).get_public_url(path)
    return url
```

### Storage Buckets + RLS

| Bucket | Upload durch | RLS |
|--------|-------------|-----|
| `agent.portraits` | Backend (AI) + Frontend (Custom) | Simulation-Member |
| `user.agent.portraits` | Frontend (direkt) | Eigener User |
| `building.images` | Backend (AI) | Simulation-Member |
| `simulation.assets` | Frontend (direkt) | Simulation-Admin+ |

---

## Realtime: Frontend direkt zu Supabase

Supabase Realtime Subscriptions werden **direkt im Frontend** aufgebaut. RLS greift automatisch über den JWT.

```typescript
class RealtimeService {
  subscribeToAgents(simulationId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`agents:${simulationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agents',
        filter: `simulation_id=eq.${simulationId}`
      }, callback)
      .subscribe();
  }

  subscribeToChatMessages(conversationId: string, callback: (msg: any) => void) {
    return this.supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, callback)
      .subscribe();
  }
}
```

---

## API-Key-Verschlüsselung

### Verschlüsselungsschema

```python
import os
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.environ['SETTINGS_ENCRYPTION_KEY']
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_setting(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_setting(encrypted: str) -> str:
    return fernet.decrypt(encrypted.encode()).decode()
```

### Sensitive Settings

Folgende Setting-Keys werden verschlüsselt gespeichert:
- `integration.facebook.access_token`
- `integration.guardian.api_key`
- `integration.newsapi.api_key`
- `integration.openrouter.api_key`
- `integration.replicate.api_key`

### API-Antwort

Sensitive Werte werden in API-Responses maskiert:
```json
{
  "key": "integration.facebook.access_token",
  "value": "••••••••••••abc123",
  "is_encrypted": true
}
```

---

## Sicherheits-Maßnahmen

### Security Headers

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            f"connect-src 'self' {settings.supabase_url} https://api.openrouter.com; "
            "img-src 'self' blob: data: https://*.supabase.co;"
        )
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response
```

### Rate Limiting

| Endpoint-Typ | Limit | Window |
|-------------|-------|--------|
| AI-Generierung | 30 Requests | 1 Stunde |
| Standard-API | 100 Requests | 1 Minute |
| Health Checks | Kein Limit | - |

(Auth-Rate-Limiting wird von Supabase Auth direkt gehandhabt.)

### Input-Validierung

- Alle Inputs serverseitig validiert via Pydantic Models (FastAPI)
- SQL-Injection: Parameterisierte Queries (Supabase Client)
- XSS: Content-Type-Header erzwungen, kein `unsafeHTML`
- CSRF: JWT-basierte Auth (kein Cookie-basiertes CSRF-Problem)
- File Upload: Max 2MB, nur erlaubte MIME-Types (Supabase Storage Policies)

### Secrets-Management

| Was | Wo | Wer nutzt es |
|-----|-----|-------------|
| `SUPABASE_URL` | `.env` | Frontend + Backend |
| `SUPABASE_ANON_KEY` | `.env` / `VITE_SUPABASE_ANON_KEY` | Frontend (direkt) + Backend (mit User-JWT) |
| `SUPABASE_SERVICE_KEY` | `.env` (nur Backend) | Backend (nur Admin/System-Ops) |
| `SUPABASE_JWT_SECRET` | `.env` (nur Backend) | Backend (JWT-Validierung) |
| `OPENROUTER_API_KEY` | `.env` (nur Backend) | Backend |
| `REPLICATE_API_TOKEN` | `.env` (nur Backend) | Backend |
| `SETTINGS_ENCRYPTION_KEY` | `.env` (nur Backend) | Backend |
| Simulation API Keys | Datenbank | Backend (AES-256 verschlüsselt) |

---

## Lessons Learned (Altsystem)

### Behobene Sicherheitsprobleme

| Problem | Alt | Neu |
|---------|-----|-----|
| API Keys in Code | `config.py` mit allen Keys | Umgebungsvariablen |
| Backend als Auth-Proxy | Unnötiger Middleman für Login | Frontend → Supabase Auth direkt |
| Service Key für alles | Backend umgeht RLS komplett | User-JWT → RLS aktiv, Service Key nur für Admin |
| Keine Security Headers | Fehlend | Vollständig via Middleware |
| Kein Rate Limiting | Fehlend | Pro Endpoint-Typ + Supabase Auth built-in |
| Permissive RLS | `USING (true)` auf vielen Tabellen | Simulation-basierte Isolation, kein pauschaler Bypass |
| Kein CORS | Teilweise | Korrekt konfiguriert (Supabase URL + API URL) |
| Keine Input-Validierung | Nur Applikations-Logik | Pydantic Models + FK-Constraints + RLS |
