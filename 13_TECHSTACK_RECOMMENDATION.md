# 13 - Tech Stack Recommendation

**Version:** 1.4
**Datum:** 2026-02-25
**Aenderung v1.4:** Biome 2.4 (exakte Version), Playwright E2E-Testing, Replicate API (Flux Dev) fuer Bildgenerierung, @lit/localize Runtime-Modus mit XLIFF-Workflow (893 Strings).
**Änderung v1.3:** Lokale Supabase-Entwicklungsumgebung dokumentiert
**Änderung v1.2:** Biome, Zod, @lit-labs/router, supabase-py async-Korrektur hinzugefügt
**Änderung v1.1:** Backend-Framework von Flask zu FastAPI gewechselt

---

## Anforderungskatalog

### Funktionale Anforderungen

| # | Anforderung | Priorität |
|---|------------|-----------|
| F1 | Multi-Simulations-Plattform mit isolierten Simulationen | Kritisch |
| F2 | Echtzeit-fähige Agenten-Verwaltung (CRUD, Generation, Portraits) | Kritisch |
| F3 | AI-Text-Generierung via LLM-APIs (OpenRouter) | Kritisch |
| F4 | AI-Bild-Generierung via Replicate | Kritisch |
| F5 | Chat-System mit Memory (LangChain) | Hoch |
| F6 | Social Media Integration (Facebook Graph API) | Mittel |
| F7 | News-Integration (Guardian, NewsAPI) | Mittel |
| F8 | Events mit Agent-Reaktionen | Hoch |
| F9 | Kampagnen-System (Trends → Kampagnen) | Mittel |
| F10 | Geographisches System (Städte, Zonen, Strassen) | Mittel |
| F11 | Benutzer-erstellte Agenten mit Chat | Hoch |
| F12 | Simulation-Settings (6 Kategorien) | Kritisch |
| F13 | Prompt-Template-System (lokalisiert) | Hoch |

### Nicht-Funktionale Anforderungen

| # | Anforderung | Ziel |
|---|------------|------|
| N1 | Performance | < 200ms API Response Time (p95) |
| N2 | Skalierbarkeit | 100+ Simulationen, 10.000+ Agenten |
| N3 | Sicherheit | OWASP Top 10 Compliance, RLS |
| N4 | Internationalisierung | Multi-Sprache UI + Inhalte + Prompts |
| N5 | Responsivität | Mobile-First, Tablet, Desktop |
| N6 | Accessibility | WCAG 2.1 AA |
| N7 | Developer Experience | TypeScript, Hot Reload, Linting |
| N8 | Testbarkeit | Unit + Integration + E2E Tests |
| N9 | Deployment | Container-basiert, CI/CD-ready |
| N10 | Wartbarkeit | Klare Separation of Concerns |

### Constraint-Anforderungen

| # | Constraint | Grund |
|---|-----------|-------|
| C1 | Supabase als Datenbank | Bestehende Infrastruktur, Auth, Storage |
| C2 | Web Components kompatibel | Investition in Lit-Komponenten schützen |
| C3 | Python-Backend | Team-Expertise |
| C4 | LangChain-Kompatibilität | Chat-System mit Memory |
| C5 | OpenRouter / Replicate APIs | Bestehende AI-Provider |

---

## Stack-Empfehlung

### Frontend

| Technologie | Version | Zweck | Begründung |
|-------------|---------|-------|-----------|
| **Lit** | 3.3+ | Web Components Framework | Bestehende Investition (64 Komponenten), exzellente Performance, Shadow DOM, natives Web |
| **Preact Signals** | 1.x | Reaktives State Management | Bereits im Einsatz, schlanker als Redux/MobX, direkte Lit-Integration |
| **TypeScript** | 5.3+ | Type Safety | Bereits im Einsatz, Typ-Definitionen als Single Source of Truth |
| **Vite** | 5.x | Build Tool + Dev Server | Bereits im Einsatz, schneller HMR, optimierte Builds |
| **Tabler Icons** | 3.x | Icon-Library | Bereits im Einsatz, umfangreiche SVG-Icon-Bibliothek |
| **Lit Context** | 1.x | Dependency Injection | Bereits im Einsatz, für Simulation-Kontext ideal |

**Entfernen:**
- Tailwind CSS (installiert aber kaum genutzt, eigenes Token-System bevorzugt)
- `@vitejs/plugin-legacy` (keine Legacy-Browser-Unterstützung nötig)

**Hinzufügen:**

| Technologie | Zweck | Begründung |
|-------------|-------|-----------|
| `@supabase/supabase-js` | **Supabase-Direktzugriff** | Auth, Storage, Realtime direkt vom Frontend (Hybrid-Architektur) |
| `@lit/localize` | i18n Frontend | Offizielles Lit i18n, Runtime Translations mit dynamischem Locale-Wechsel |
| `@lit-labs/router` | Client-Side Routing | Lit-nativer Router als Reactive Controller, basiert auf URLPattern API (Baseline 2025) |
| `zod` | Schema-Validierung | TypeScript-first Validierung für Formulare und API-Responses, Pydantic-Äquivalent |
| `vitest` | Unit Tests | Bereits konfiguriert, Vite-nativ |
| `playwright` | E2E Tests | Bereits konfiguriert, Cross-Browser |
| `@open-wc/testing` | Component Tests | Testing-Utilities für Web Components |

**Dev-Dependencies:**

| Technologie | Zweck | Begründung |
|-------------|-------|-----------|
| `@biomejs/biome` | **Linting + Formatting** | Ersetzt ESLint + Prettier in einem Tool, 10-25× schneller, eine Config-Datei |
| `@lit/localize-tools` | i18n CLI | Extraktion und Kompilierung von Translation-Strings |

### Backend

| Technologie | Version | Zweck | Begründung |
|-------------|---------|-------|-----------|
| **FastAPI** | 0.110+ | Web Framework | Native Async, Pydantic-first, automatische OpenAPI-Docs, Dependency Injection |
| **Uvicorn** | 0.27+ | ASGI Server | Production-ready, async-nativ, Worker-Management via Gunicorn |
| **Pydantic** | 2.x | Validierung + Serialisierung | Kern von FastAPI, Request/Response-Modelle, Settings |
| **pydantic-settings** | 2.x | Konfiguration | .env-Loading, typsichere Settings-Klassen |
| **Supabase Python SDK** | 2.x | Datenbank-Client | Nativer Supabase-Support, RLS-kompatibel |
| **httpx** | 0.27+ | Async HTTP Client | Async-Aufrufe zu OpenRouter, Replicate, Facebook, News-APIs |
| **LangChain** | 0.1+ | AI-Orchestrierung | Chat Memory, Prompt Templates, Chain-Komposition |
| **structlog** | 23+ | Strukturiertes Logging | JSON-Logging, Kontext-Propagation |

**Entfernen (gegenüber Altsystem):**
- `Flask`, `flask-cors`, `flask-socketio` (durch FastAPI ersetzt)
- `gunicorn` als alleiniger Server (Uvicorn als ASGI-Server, optional Gunicorn als Process-Manager)
- `pandas` / `numpy` (nicht benötigt für Web-App)
- `supervisor` (durch Container-Orchestrierung ersetzt)
- `sqlalchemy` (Supabase SDK reicht)
- `selenium` (Playwright stattdessen)

**Hinzufügen:**

| Technologie | Zweck | Begründung |
|-------------|-------|-----------|
| `fastapi` | Web Framework | Ersetzt Flask |
| `uvicorn[standard]` | ASGI Server | Ersetzt Gunicorn als primären Server |
| `pydantic-settings` | Konfiguration | Typsichere .env-Konfiguration |
| `python-jose[cryptography]` | JWT-Validierung | Supabase JWT-Token-Validierung |
| `cryptography` | Verschlüsselung | API-Key-Verschlüsselung in simulation_settings |
| `tenacity` | Retry-Logik | Retry für externe API-Aufrufe |
| `ruff` | Linting + Formatting (Python) | Schneller als flake8 + black kombiniert |

### Infrastruktur

| Technologie | Zweck | Begründung |
|-------------|-------|-----------|
| **Supabase** | PostgreSQL + Auth + Storage + Realtime | Hybrid: Auth/Storage/Realtime direkt vom Frontend, DB via FastAPI mit User-JWT (RLS aktiv) |
| **Docker** | Container | Reproduzierbare Deployments |
| **GitHub Actions** | CI/CD | Automatisierte Tests, Builds, Deployments |
| **Cloudflare** | CDN + DNS | Statische Assets, Edge Caching |

---

## Warum FastAPI statt Flask

### Entscheidungsmatrix

| Kriterium | Flask (Alt) | **FastAPI (Neu)** | Vorteil |
|-----------|------------|-------------------|---------|
| Async Support | Via Erweiterungen | **Nativ** | Kritisch für externe API-Calls |
| Validierung | Pydantic als Plugin | **Pydantic-first** | Weniger Boilerplate |
| API-Docs | Manuell | **Auto-generiert (OpenAPI)** | 108 Endpoints automatisch dokumentiert |
| Dependency Injection | Nicht vorhanden | **Nativ (Depends)** | Ideal für Simulation-Kontext |
| Type Hints | Optional | **Strukturgebend** | Bessere IDE-Unterstützung, weniger Bugs |
| Performance | ~2.000 req/s | **~8.000 req/s** | 4× höherer Durchsatz |
| LangChain | Kompatibel | **Kompatibel** | Kein Unterschied |

### Konkrete Vorteile für dieses Projekt

**1. Async für externe API-Aufrufe**

Das Projekt macht massiv I/O-bound Calls an OpenRouter (Text-LLM), Replicate (Bildgenerierung, Polling bis 600s), Facebook Graph API, Guardian API, NewsAPI. Mit async:

```python
# Statt blockierender Calls (Flask)
response = requests.post("https://api.openrouter.com/...", json=payload)  # Worker blockiert

# Async Calls (FastAPI)
async with httpx.AsyncClient() as client:
    response = await client.post("https://api.openrouter.com/...", json=payload)  # Worker frei
```

**2. Pydantic-Models als API-Contracts**

```python
# Statt manueller Validierung (Flask)
data = request.get_json()
if not data.get('name'):
    return error_response("Name required", 400)

# Automatische Validierung (FastAPI)
class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    system: str
    gender: Optional[str] = None

@router.post("/agents", response_model=AgentResponse)
async def create_agent(agent: AgentCreate):
    ...  # Validierung passiert automatisch
```

**3. Dependency Injection für Simulation-Kontext**

```python
async def get_simulation_context(
    sim_id: UUID = Path(...),
    user: User = Depends(get_current_user),
    db: SupabaseClient = Depends(get_db)
) -> SimulationContext:
    member = await db.get_member(sim_id, user.id)
    if not member:
        raise HTTPException(status_code=403, detail="No access to simulation")
    return SimulationContext(sim_id, user, member.role)

@router.get("/simulations/{sim_id}/agents")
async def list_agents(context: SimulationContext = Depends(get_simulation_context)):
    ...  # Kontext ist automatisch injiziert und validiert
```

**4. Automatische OpenAPI-Docs für 108 Endpoints**

FastAPI generiert aus den Type-Hints automatisch interaktive API-Dokumentation unter `/docs` (Swagger) und `/redoc`. Bei 108 Endpoints spart das erheblich Dokumentationsaufwand.

---

## Altsystem-Migration: Flask → FastAPI

### Pattern-Mapping

| Flask (Alt) | FastAPI (Neu) |
|------------|---------------|
| `Flask(__name__)` | `FastAPI()` |
| `Blueprint(name, url_prefix)` | `APIRouter(prefix=...)` |
| `app.register_blueprint(bp)` | `app.include_router(router)` |
| `request.args.get('key')` | `key: str = Query(None)` |
| `request.get_json()` | `body: PydanticModel` |
| `return jsonify(data), 200` | `return data` |
| `response_factory.error(msg, 400)` | `raise HTTPException(400, detail=msg)` |
| `CORS(app)` | `CORSMiddleware` |
| `ServiceFactory.get_service()` | `Depends(get_service)` |
| `config.py` + `load_dotenv()` | `pydantic_settings.BaseSettings` |
| `@app.before_request` | `@app.middleware("http")` |
| `gunicorn app:app` | `uvicorn app:app --workers 4` |

### Blueprint → Router Konvertierung

Jeder der 17 bestehenden Flask-Blueprints wird zu einem FastAPI-Router:

```
core/blueprints/agents_blueprint_v3.py     → backend/routers/agents.py
core/blueprints/events_blueprint_v3.py     → backend/routers/events.py
core/blueprints/buildings_blueprint_v3.py  → backend/routers/buildings.py
core/blueprints/chat_blueprint_v3.py       → backend/routers/chat.py
core/blueprints/generate_blueprint_v3.py   → backend/routers/generation.py
core/blueprints/auth_blueprint_v3.py       → ENTFÄLLT (Auth via Supabase direkt, nur GET /users/me bleibt)
...
```

### Service-Layer: Async-Strategie

Das Altsystem hat **100% synchrone Services**. Empfohlener Ansatz für den Rebuild:

```
Phase 1: Services synchron belassen, mit asyncio.to_thread() wrappen
Phase 2: Externe API-Aufrufe (OpenRouter, Replicate, Facebook) auf httpx async migrieren
Phase 3: Supabase-Calls auf async migrieren (supabase-py 2.x hat bereits async-Support)
```

---

## Vergleich: Alternativen

### Frontend-Framework

| Kriterium | Lit (Empfohlen) | React | Svelte | Vue |
|-----------|----------------|-------|--------|-----|
| Bestehender Code | 64 Komponenten | Neuschreiben | Neuschreiben | Neuschreiben |
| Bundle Size | ~7kb (core) | ~40kb (React+DOM) | ~2kb (compiler) | ~30kb |
| Web Standards | Nativ (Custom Elements) | Virtueller DOM | Compiler | Virtueller DOM |
| Shadow DOM | Nativ | Nicht nativ | Nicht nativ | Nicht nativ |
| TypeScript | Exzellent | Exzellent | Gut | Gut |
| **Empfehlung** | **Beibehalten** | Zu hohe Migrationskosten | Kein Shadow DOM | Kein Shadow DOM |

### Backend-Framework

| Kriterium | **FastAPI (Empfohlen)** | Flask (Alt) | Django | Express.js |
|-----------|------------------------|-------------|--------|------------|
| Async Support | **Nativ** | Via Erweiterungen | Channels | Nativ |
| Validierung | **Pydantic-nativ** | Pydantic (Plugin) | Django Forms | Manuell |
| API-Docs | **Auto-generiert** | Manuell | DRF Spectacular | Manuell |
| Dependency Injection | **Nativ (Depends)** | Nicht vorhanden | Nicht vorhanden | Nicht vorhanden |
| Performance | **~8.000 req/s** | ~2.000 req/s | ~1.500 req/s | ~6.000 req/s |
| LangChain | Voll kompatibel | Voll kompatibel | Kompatibel | JS-LangChain |
| **Empfehlung** | **Neu-Standard** | Abgelöst | Zu heavyweight | Sprachwechsel |

### State Management

| Kriterium | Preact Signals (Empfohlen) | Redux | MobX | Zustand |
|-----------|---------------------------|-------|------|---------|
| Bundle Size | ~1kb | ~7kb | ~16kb | ~2kb |
| Lit Integration | @lit-labs/signals | Manuell | Manuell | Manuell |
| Lernkurve | Niedrig | Hoch | Mittel | Niedrig |
| **Empfehlung** | **Beibehalten** | Overkill | Zu gross | Nicht für Lit |

### Datenbank

| Kriterium | Supabase (Beibehalten) | Firebase | PlanetScale | Neon |
|-----------|----------------------|----------|-------------|------|
| PostgreSQL | Ja (Voll) | Nein (NoSQL) | MySQL | PostgreSQL |
| RLS | Nativ | Security Rules | Nein | Nein |
| Auth + Storage + Realtime | Integriert | Integriert | Extern | Extern |
| **Empfehlung** | **Beibehalten** | Schema-inkompatibel | Kein RLS | Kein Auth/Storage |

---

## Build-Konfiguration

### Vite-Konfiguration (Frontend)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: '../static/dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit', '@lit/reactive-element'],
          'signals': ['@preact/signals-core', '@lit-labs/preact-signals'],
          'router': ['@lit-labs/router'],
          'icons': ['@tabler/icons'],
          'localize': ['@lit/localize'],
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',   // FastAPI auf Port 8000
    }
  }
});
```

### FastAPI-Konfiguration (Backend)

```python
# backend/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Velgarien Platform API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str                # Auch im Backend (mit User-JWT für RLS)
    supabase_service_key: str             # NUR für Admin/System-Ops (bypasses RLS)
    supabase_jwt_secret: str              # JWT-Validierung (aus Supabase Dashboard)

    # AI
    openrouter_api_key: str
    replicate_api_token: str

    # Security
    settings_encryption_key: str          # Fernet Key für API-Key-Verschlüsselung

    # App
    app_url: str = "http://localhost:8000"
    app_title: str = "Velgarien Platform"
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

### Biome-Konfiguration (Frontend Linting + Formatting)

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  },
  "files": {
    "include": ["frontend/src/**/*.ts"],
    "ignore": ["**/node_modules", "**/dist", "**/*.generated.*"]
  }
}
```

### TypeScript-Konfiguration (Frontend)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Python-Konfiguration

```toml
# pyproject.toml
[project]
name = "velgarien-platform"
version = "2.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "supabase>=2.0.0",
    "httpx>=0.27.0",
    "langchain>=0.1.0",
    "langchain-openai>=0.0.5",
    "Pillow>=10.0.1",
    "cryptography>=41.0.7",
    "python-jose[cryptography]>=3.3.0",
    "structlog>=23.2.0",
    "tenacity>=9.1.2",
    "python-dotenv>=1.1.0",
    "python-multipart>=0.0.9",
]

[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "S", "B", "A", "C4", "DTZ", "T20", "ICN"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

---

## Projektstruktur (Empfohlen)

```
velgarien-platform/
├── backend/
│   ├── app.py                    # FastAPI Entry Point
│   ├── config.py                 # pydantic-settings Konfiguration
│   ├── dependencies.py           # Shared Dependencies (DB, Auth, SimContext)
│   ├── routers/                  # API Routers (ehemals Blueprints)
│   │   ├── __init__.py
│   │   ├── users.py              # GET /users/me (Auth via Supabase direkt)
│   │   ├── simulations.py
│   │   ├── agents.py
│   │   ├── buildings.py
│   │   ├── events.py
│   │   ├── chat.py
│   │   ├── generation.py
│   │   ├── social.py
│   │   └── settings.py
│   ├── models/                   # Pydantic Request/Response Models
│   │   ├── __init__.py
│   │   ├── agent.py              # AgentCreate, AgentUpdate, AgentResponse
│   │   ├── building.py
│   │   ├── event.py
│   │   ├── simulation.py
│   │   ├── settings.py
│   │   └── common.py             # PaginatedResponse, ErrorResponse
│   ├── services/                 # Business Logic
│   │   ├── base_service.py
│   │   ├── simulation_service.py
│   │   ├── agent_service.py
│   │   ├── generation_service.py
│   │   ├── prompt_service.py
│   │   ├── image_service.py
│   │   ├── chat_service.py
│   │   ├── settings_service.py
│   │   └── external/
│   │       ├── openrouter.py     # Async httpx Client
│   │       ├── replicate.py      # Async httpx Client
│   │       ├── facebook.py
│   │       └── news.py
│   ├── middleware/
│   │   ├── auth.py               # JWT-Validierung via Depends()
│   │   ├── permissions.py        # Rollen-Prüfung via Depends()
│   │   └── rate_limit.py
│   ├── utils/
│   │   ├── encryption.py
│   │   └── responses.py          # Standardisierte Response-Helpers
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── main.ts               # App-Entry + Router-Setup
│   │   ├── router.ts             # @lit-labs/router Reactive Controller Setup
│   │   ├── components/
│   │   ├── services/
│   │   │   ├── api/              # FastAPI Business-Logic Services
│   │   │   └── supabase/         # Supabase Direct (Auth, Storage, Realtime)
│   │   ├── styles/
│   │   ├── types/
│   │   ├── utils/
│   │   └── locales/
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── supabase/
│   ├── config.toml              # Supabase CLI Konfiguration (via `supabase init`)
│   ├── migrations/              # SQL-Migrationen (via `supabase migration new`)
│   ├── seed.sql                 # Seed-Daten (ausgefuehrt bei `supabase db reset`)
│   └── functions/               # Edge Functions (Deno)
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
├── .github/
│   └── workflows/
├── biome.json                  # Biome Linting + Formatting (Frontend)
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## Lokale Supabase-Entwicklungsumgebung

### Voraussetzungen

- **Docker Desktop** (laeuft im Hintergrund)
- **Supabase CLI** (>= v2.0)

```bash
# macOS
brew install supabase/tap/supabase

# npm (plattformuebergreifend)
npm install -g supabase
```

### Ersteinrichtung

```bash
# 1. Supabase-Projekt initialisieren (erstellt supabase/ Verzeichnis)
supabase init

# 2. Lokale Supabase-Instanz starten (Docker muss laufen)
supabase start
# Startet alle Dienste:
#   API URL:       http://localhost:54321
#   GraphQL URL:   http://localhost:54321/graphql/v1
#   DB URL:        postgresql://postgres:postgres@localhost:54322/postgres
#   Studio URL:    http://localhost:54323  (Web-UI)
#   Inbucket URL:  http://localhost:54324  (E-Mail-Testing)
#   Anon Key:      eyJ...  (wird ausgegeben)
#   Service Key:   eyJ...  (wird ausgegeben)
#   JWT Secret:    super-secret-jwt-token-with-at-least-32-characters-long

# 3. Status und Keys anzeigen
supabase status

# 4. Umgebungsvariablen exportieren (fuer .env)
supabase status -o env > .env.local
```

### Migration-Workflow

```bash
# Neue Migration erstellen
supabase migration new <migration_name>
# → Erstellt supabase/migrations/<timestamp>_<migration_name>.sql

# Migrationen auf lokale DB anwenden
supabase db push

# Lokale DB komplett zuruecksetzen (alle Daten + Schema)
supabase db reset
# Fuehrt alle Migrationen erneut aus + supabase/seed.sql

# Diff zwischen lokaler DB und Migrationen generieren
supabase db diff --schema public
# Nuetzlich wenn Schema-Aenderungen direkt in Studio gemacht wurden

# TypeScript-Typen generieren
supabase gen types typescript --local > frontend/src/types/supabase.ts
```

### Seed-Daten

```bash
# supabase/seed.sql wird bei jedem `supabase db reset` ausgefuehrt
# Hier Velgarien-Testdaten platzieren (aus 15_MIGRATION_STRATEGY.md Phase 2)
```

### Remote-Projekt verknuepfen

```bash
# Mit Supabase-Cloud-Projekt verknuepfen (fuer Deployment)
supabase link --project-ref <project-id>

# Remote-Migrationen auf Cloud-Projekt anwenden
supabase db push --linked

# Remote-Schema als Migration pullen (falls Schema direkt im Dashboard geaendert wurde)
supabase db pull
```

### Taeglich

```bash
# Starten (falls gestoppt)
supabase start

# Stoppen (Container bleiben erhalten, Daten persistent)
supabase stop

# Stoppen + alle Daten loeschen
supabase stop --no-backup

# Logs anzeigen
supabase logs --service postgres
supabase logs --service auth
```

### .env.example (lokale Entwicklung)

```env
# Supabase (lokal via `supabase start`)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<von supabase status>
SUPABASE_SERVICE_ROLE_KEY=<von supabase status>
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

# FastAPI Backend
BACKEND_URL=http://localhost:8000
BACKEND_CORS_ORIGINS=http://localhost:5173

# Frontend (Vite)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<von supabase status>
VITE_BACKEND_URL=http://localhost:8000
```

### Edge Functions lokal testen

```bash
# Neue Edge Function erstellen
supabase functions new <function_name>

# Lokal ausfuehren (mit Hot Reload)
supabase functions serve <function_name> --env-file .env.local

# Alle Functions deployen (auf Remote)
supabase functions deploy
```

### Supabase Studio (lokale Web-UI)

Nach `supabase start` ist das lokale Studio erreichbar unter **http://localhost:54323**.
Damit koennen Tabellen, RLS-Policies, Auth-Nutzer und Storage-Buckets
direkt im Browser verwaltet werden — identisch zum Cloud-Dashboard.

---

## Dependency-Audit: Altsystem → Neu

### Frontend: Behalten

| Package | Version | Nutzen |
|---------|---------|--------|
| `lit` | 3.3+ | Kern-Framework |
| `@lit-labs/preact-signals` | 1.x | State Management |
| `@lit/context` | 1.x | Dependency Injection |
| `@preact/signals-core` | 1.x | Signal-Implementierung |
| `@tabler/icons` | 3.x | Icons |
| `typescript` | 5.3+ | Type Safety |
| `vite` | 5.x | Build Tool |
| `vitest` | 1.x | Unit Tests |
| `playwright` | 1.x | E2E Tests |

### Frontend: Hinzufügen

| Package | Version | Nutzen |
|---------|---------|--------|
| `@supabase/supabase-js` | 2.x | **Direkt-Zugriff auf Supabase Auth, Storage, Realtime** |
| `@lit/localize` | 0.12+ | i18n Runtime Translations |
| `@lit-labs/router` | 0.1+ | Client-Side Routing (Lit Reactive Controller, URLPattern API) |
| `zod` | 3.x | Schema-Validierung für Formulare und API-Responses |

### Frontend: Hinzufügen (Dev-Dependencies)

| Package | Version | Nutzen |
|---------|---------|--------|
| `@biomejs/biome` | 2.x | **Linting + Formatting** (ersetzt ESLint + Prettier) |
| `@lit/localize-tools` | 0.8+ | i18n CLI (Extraktion, Kompilierung) |

### Frontend: Entfernen

| Package | Grund |
|---------|-------|
| `tailwindcss` + `@tailwindcss/postcss` + `autoprefixer` + `postcss` | Eigenes Token-System |
| `@vitejs/plugin-legacy` | Keine Legacy-Browser-Unterstützung |
| `node-fetch` | Native `fetch` im Browser |

### Backend: Neu (FastAPI-Stack)

| Package | Zweck |
|---------|-------|
| `fastapi` | Web Framework (ersetzt Flask) |
| `uvicorn[standard]` | ASGI Server (ersetzt Gunicorn als primären Server) |
| `pydantic` + `pydantic-settings` | Validierung, Serialisierung, Konfiguration |
| `httpx` | Async HTTP Client für externe APIs |
| `python-jose[cryptography]` | JWT-Validierung |
| `python-multipart` | File-Upload-Support |
| `supabase` | DB Client |
| `langchain` + `langchain-openai` | AI Orchestrierung |
| `Pillow` | Bildverarbeitung |
| `cryptography` | API-Key-Verschlüsselung |
| `structlog` | Logging |
| `python-dotenv` | Env-Variablen (Fallback) |
| `tenacity` | Retry-Logik |
| `ruff` | Linting + Formatting |

### Backend: Entfernen (gegenüber Altsystem)

| Package | Grund |
|---------|-------|
| `Flask`, `flask-cors`, `flask-socketio` | Durch FastAPI + CORSMiddleware ersetzt |
| `gunicorn` | Durch Uvicorn ersetzt (Gunicorn optional als Process-Manager) |
| `pandas`, `numpy` | Nicht benötigt |
| `sqlalchemy` | Supabase SDK reicht |
| `selenium`, `webdriver-manager` | Playwright stattdessen |
| `healthcheck` | Eigener Health-Endpoint |
| `openai` | Über LangChain + OpenRouter |
| `Werkzeug`, `Jinja2`, `itsdangerous` | Flask-Abhängigkeiten, nicht mehr nötig |

---

## Querverweise

- **01_PLATFORM_ARCHITECTURE.md** - Architektur-Anforderungen die den Stack bestimmen
- **05_API_SPECIFICATION.md** - API-Endpoints (FastAPI-Routers)
- **07_FRONTEND_COMPONENTS.md** - Lit-Komponenten-Architektur
- **09_AI_INTEGRATION.md** - LangChain + OpenRouter Integration
- **10_AUTH_AND_SECURITY.md** - Auth-Middleware via FastAPI Depends()
- **11_EXTERNAL_SERVICES.md** - Async httpx für externe Services
- **12_DESIGN_SYSTEM.md** - CSS-Token-System statt Tailwind
- **14_I18N_ARCHITECTURE.md** - @lit/localize Integration
- **15_MIGRATION_STRATEGY.md** - Flask → FastAPI Migrationspfad
