---
title: "Testing Strategy"
id: testing-strategy
version: "2.3"
date: 2026-03-09
lang: de
type: guide
status: active
tags: [testing, pytest, vitest, playwright, coverage]
---

# 16 - Testing Strategy

---

## Test-Pyramide

```
          ┌──────────┐
          │   E2E    │  81 Specs   (Playwright, 13 Dateien)
          │ Browser  │  Kritische User-Flows
         ┌┴──────────┴┐
         │ Integration │  ~250 Tests (pytest + vitest)
         │  API + DB   │  Router ↔ Service ↔ DB
        ┌┴────────────┴┐
        │     Unit      │  ~1200 Tests (pytest + vitest)
        │ Services, Utils│  Isolierte Logik
        └───────────────┘
```

| Ebene | Backend (pytest) | Frontend (vitest) | Ziel |
|-------|-----------------|-------------------|------|
| **Unit** | Services (Operative, Scoring, Epoch, Bot, Cleanup, Email, Notification, Simulation, Member, Invitation, Logging, ...), Utils, Models, Encryption | Validation, Formatters, WCAG-Kontrast (88 Tests), SEO/Analytics, Settings, Theme, Map, Realtime, Aptitudes | ~1069 Tests, < 30s |
| **Integration** | Router → Service → Supabase (TestClient), 36 Anonymous-View-Tests, Admin-Cleanup, SEO, Epoch-Chat | API-Services → Mock-Server, Component Interaction | ~250 Tests, < 2min |
| **E2E** | — | Playwright: Login → CRUD → Chat → Settings → Public Access → Embassies → Relationships → Echoes → Multiverse Map → Social → Multi-User (13 Specs) | 81 Specs, < 5min |

### Abdeckungsziele

| Bereich | Ziel | Priorität |
|---------|------|-----------|
| Backend Services | 90% Line Coverage | Kritisch |
| Backend Routers | 80% Line Coverage | Kritisch |
| Backend Models (Pydantic) | 95% (automatisch via Validierungstests) | Hoch |
| Frontend Services | 85% Line Coverage | Hoch |
| Frontend Components (Render) | 70% Line Coverage | Mittel |
| Frontend Utils/Formatters | 95% Line Coverage | Hoch |
| E2E kritische Flows | 100% der Happy Paths | Kritisch |

---

## Backend Testing (Python / pytest)

### Setup

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["backend/tests"]
asyncio_mode = "auto"
markers = [
    "integration: Integration tests requiring app instantiation but not external services",
    "slow: Performance tests that may take several seconds",
]

[tool.coverage.run]
source = ["backend"]

[tool.coverage.report]
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
]

# Coverage via pytest-cov (dev dependency)
# Run: python -m pytest backend/tests/ --cov               # Full backend coverage
# Run: python -m pytest backend/tests/ --cov=backend.services.member_service  # Targeted
```

### Verzeichnisstruktur

```
backend/tests/
├── conftest.py                    # Shared Fixtures
├── test_connection_router.py      # Simulation-Connections
├── test_echo_router.py            # Event-Echo Router
├── test_echo_service.py           # Echo-Service Logik
├── test_embassy_router.py         # Embassy Router
├── test_embassy_service.py        # Embassy-Service Logik
├── test_relationship_router.py    # Relationship Router
├── test_relationship_service.py   # Relationship-Service Logik
├── unit/
│   ├── test_models.py             # Pydantic Validierung
│   ├── test_entity_models.py      # Entity-spezifische Models
│   ├── test_base_service.py       # BaseService CRUD
│   ├── test_agent_service.py      # Agent-Service + Ambassador
│   ├── test_event_service.py      # Event-Service + Reactions
│   ├── test_generation_service.py # AI-Generierung
│   ├── test_chat_ai_service.py    # Chat-AI-Service
│   ├── test_operative_service.py  # Operative Deployment + 6 Effekte + Game-State
│   ├── test_scoring_service.py    # 5-Dimensionen-Scoring + Allianz/Verrat
│   ├── test_epoch_service.py      # Epoch-Lifecycle + Game-Instance-Integration
│   ├── test_epoch_chat_service.py # Epoch-Chat CRUD + Broadcast
│   ├── test_bot_personality.py    # 5 KI-Archetypen Entscheidungslogik
│   ├── test_bot_player_service.py # Bot CRUD + Epoch-Management
│   ├── test_cleanup_service.py    # Daten-Cleanup Stats/Preview/Execute
│   ├── test_email_service.py      # SMTP-Email-Versand
│   ├── test_email_templates.py    # Zweisprachige Email-Template-Rendering
│   ├── test_cycle_notification_service.py  # Empfaenger-Auflosung + Briefing-Daten
│   ├── test_output_repair.py      # JSON-Output-Reparatur
│   ├── test_news_transform_flow.py # News-Transformation
│   ├── test_social_browse.py      # Social-Browse-Logik
│   ├── test_seo.py                # SEO-Middleware + Sitemap
│   ├── test_service_layer.py      # Service-Layer Patterns
│   ├── test_logging_config.py     # structlog Setup + Renderer-Auswahl
│   ├── test_logging_context_middleware.py  # JWT-Extraktion, Request-IDs, Log-Output
│   ├── test_simulation_service.py # Simulation CRUD + Logging
│   ├── test_member_service.py     # Member CRUD + LastOwner-Schutz + Logging
│   ├── test_invitation_service.py # Einladungs-Lifecycle + Logging
│   ├── test_epoch_invitation_service.py   # Epoch-Einladungen + Logging
│   ├── test_paginate_response.py  # paginate_response() Hilfsfunktion (6 Tests)
│   ├── test_public_service_methods.py  # Public-Query-Service-Methoden (19 Tests)
│   ├── test_operative_constants.py     # Operative-Konstanten + /public/operative-types (9 Tests)
│   ├── test_news_scanner.py       # News-Scanner + Adapter
│   ├── test_scan_adapters.py      # Scan-Adapter-Logik
│   ├── test_style_reference_service.py # Style-Referenz-Service
│   ├── test_alliance_service.py   # Allianz-Proposals, Voting, Tension, Upkeep, Dissolution (28 Tests)
│   ├── test_model_resolver_img2img.py  # Bild-Modell-Resolver
│   └── test_output_repair.py      # JSON-Output-Reparatur
├── integration/
│   ├── conftest.py                # requires_supabase marker (connectivity check, skips locally if no Supabase)
│   ├── test_routes.py             # Router-Integrationstests
│   ├── test_public_router.py      # 36 Anonymous-View-Tests
│   ├── test_rls_policies.py       # RLS Enforcement Tests
│   ├── test_seo_router.py         # SEO-Endpoints
│   ├── test_epoch_chat_router.py  # Epoch-Chat-Integrationstests
│   └── test_admin_cleanup.py      # Admin-Cleanup-Integrationstests
├── performance/
│   └── test_load.py               # Lasttests (100 concurrent reads)
└── fixtures/
    ├── agents.json
    ├── buildings.json
    ├── events.json
    ├── taxonomies.json
    └── settings.json
```

### Konfigurations-Fixtures

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from backend.app import app
from backend.config import Settings

@pytest.fixture
def settings():
    """Test-Settings mit Test-Supabase-Credentials."""
    return Settings(
        supabase_url="http://localhost:54321",       # Lokaler Supabase
        supabase_anon_key="test-anon-key",
        supabase_service_key="test-service-key",
        supabase_jwt_secret="test-jwt-secret",
        openrouter_api_key="test-key",
        replicate_api_token="test-token",
        settings_encryption_key="test-fernet-key-base64==",
    )

@pytest.fixture
def client():
    """Synchroner TestClient fur einfache Tests."""
    return TestClient(app)

@pytest.fixture
async def async_client():
    """Async TestClient fur async Router-Tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

@pytest.fixture
def auth_headers(test_user_jwt):
    """JWT-Header fur authentifizierte Requests."""
    return {"Authorization": f"Bearer {test_user_jwt}"}

@pytest.fixture
def test_user_jwt(settings):
    """Generiert einen Test-JWT."""
    import jwt  # PyJWT (nicht python-jose)
    payload = {
        "sub": "test-user-uuid",
        "email": "test@example.com",
        "aud": "authenticated",
        "role": "authenticated",
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")
```

### Unit Test Beispiele

```python
# backend/tests/unit/test_models.py
import pytest
from pydantic import ValidationError
from backend.models.agents import AgentCreate

class TestAgentCreate:
    def test_valid_agent(self):
        agent = AgentCreate(name="Test Agent", system="politics", gender="male")
        assert agent.name == "Test Agent"

    def test_name_required(self):
        with pytest.raises(ValidationError) as exc:
            AgentCreate(name="", system="politics")
        assert "min_length" in str(exc.value)

    def test_name_max_length(self):
        with pytest.raises(ValidationError):
            AgentCreate(name="x" * 201, system="politics")

    def test_optional_fields_default_none(self):
        agent = AgentCreate(name="Test", system="politics")
        assert agent.character is None
        assert agent.background is None


# backend/tests/unit/test_encryption.py
import pytest
from backend.utils.encryption import encrypt_value, decrypt_value

class TestEncryption:
    def test_roundtrip(self, settings):
        original = "secret-api-key-12345"
        encrypted = encrypt_value(original, settings.settings_encryption_key)
        decrypted = decrypt_value(encrypted, settings.settings_encryption_key)
        assert decrypted == original
        assert encrypted != original

    def test_different_values_different_ciphertexts(self, settings):
        a = encrypt_value("value-a", settings.settings_encryption_key)
        b = encrypt_value("value-b", settings.settings_encryption_key)
        assert a != b


# backend/tests/unit/test_prompt_resolver.py
import pytest
from backend.services.prompt_service import PromptResolver

class TestPromptResolver:
    def test_simulation_locale_found(self, mock_db):
        """Prioritat 1: Simulation + Locale."""
        mock_db.add_template(sim_id="sim1", type="agent_generation_full", locale="de", content="DE prompt")
        resolver = PromptResolver(mock_db)
        result = resolver.resolve("sim1", "agent_generation_full", "de")
        assert result.prompt_content == "DE prompt"

    def test_fallback_to_simulation_default(self, mock_db):
        """Prioritat 2: Simulation + Default-Locale."""
        mock_db.add_template(sim_id="sim1", type="chat_system_prompt", locale="de", content="DE fallback")
        resolver = PromptResolver(mock_db)
        result = resolver.resolve("sim1", "chat_system_prompt", "fr")  # FR nicht vorhanden
        assert result.prompt_content == "DE fallback"

    def test_fallback_to_platform_default(self, mock_db):
        """Prioritat 3/4: Plattform-Default."""
        mock_db.add_template(sim_id=None, type="event_generation", locale="en", content="EN platform")
        resolver = PromptResolver(mock_db)
        result = resolver.resolve("sim-without-templates", "event_generation", "en")
        assert result.prompt_content == "EN platform"
```

### Integration Test Beispiele

```python
# backend/tests/integration/test_agents_router.py
import pytest

class TestAgentsRouter:
    @pytest.mark.integration
    async def test_list_agents_empty(self, async_client, auth_headers, test_simulation):
        response = await async_client.get(
            f"/api/v1/simulations/{test_simulation.id}/agents",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"] == []
        assert data["total"] == 0

    @pytest.mark.integration
    async def test_create_agent(self, async_client, auth_headers, test_simulation):
        response = await async_client.post(
            f"/api/v1/simulations/{test_simulation.id}/agents",
            headers=auth_headers,
            json={"name": "Agent Smith", "system": "politics", "gender": "male"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Agent Smith"
        assert data["simulation_id"] == str(test_simulation.id)
        assert "id" in data

    @pytest.mark.integration
    async def test_create_agent_invalid_body(self, async_client, auth_headers, test_simulation):
        response = await async_client.post(
            f"/api/v1/simulations/{test_simulation.id}/agents",
            headers=auth_headers,
            json={"name": ""}  # Name zu kurz
        )
        assert response.status_code == 422

    @pytest.mark.integration
    async def test_unauthorized_without_jwt(self, async_client, test_simulation):
        response = await async_client.get(
            f"/api/v1/simulations/{test_simulation.id}/agents"
        )
        assert response.status_code == 401


# backend/tests/integration/test_rls_policies.py
class TestRLSPolicies:
    """Testet, dass RLS-Policies korrekt greifen."""

    @pytest.mark.integration
    async def test_user_sees_only_own_simulation_agents(
        self, async_client, user_a_headers, user_b_headers,
        simulation_a, simulation_b
    ):
        """User A sieht keine Agenten von User Bs Simulation."""
        # User A erstellt Agent in Simulation A
        await async_client.post(
            f"/api/v1/simulations/{simulation_a.id}/agents",
            headers=user_a_headers,
            json={"name": "Agent A"}
        )
        # User B versucht Simulation A abzufragen → 403
        response = await async_client.get(
            f"/api/v1/simulations/{simulation_a.id}/agents",
            headers=user_b_headers
        )
        assert response.status_code == 403

    @pytest.mark.integration
    async def test_viewer_cannot_create(self, async_client, viewer_headers, test_simulation):
        """Viewer-Rolle darf keine Agenten erstellen."""
        response = await async_client.post(
            f"/api/v1/simulations/{test_simulation.id}/agents",
            headers=viewer_headers,
            json={"name": "Forbidden Agent"}
        )
        assert response.status_code == 403
```

---

## Frontend Testing (TypeScript / vitest)

### Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',  // Standard-Umgebung ist node (NICHT jsdom)
    // Tests, die DOM benoetigen, muessen die Direktive nutzen:
    //   // @vitest-environment happy-dom
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/locales/**'],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
      }
    }
  }
});
```

> **Hinweis:** Die Standard-Testumgebung ist `node`. Tests, die DOM-Zugriff benoetigen (z.B. Component-Tests), muessen am Anfang der Datei `// @vitest-environment happy-dom` als Direktive setzen. Das Package `happy-dom` ist als Dev-Dependency installiert.

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Mock Supabase Client
vi.mock('../src/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-jwt' } }
      }),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    storage: { from: vi.fn() },
  }
}));

// Mock fetch for API calls
global.fetch = vi.fn();
```

### Verzeichnisstruktur

```
frontend/tests/
├── setup.ts                          # Global mocks (Supabase, fetch)
├── setup.test.ts                     # Setup-Validierung
├── api-services.test.ts              # API-Service-Layer Tests
├── echo-api.test.ts                  # Echo-API-Service
├── embassy-api.test.ts               # Embassy-API-Service
├── epoch-alliance-api.test.ts         # Allianz-Proposal/Vote-API (12 Tests)
├── epoch-chat-api.test.ts            # Epoch-Chat-API
├── map-data.test.ts                  # Kartendaten-Transformation
├── map-force.test.ts                 # Force-Simulation Physik
├── map-three-render.test.ts          # Map-Rendering
├── notification-preferences.test.ts  # Notification-Praeferenzen
├── notification-service.test.ts      # Notification-Service
├── realtime-service.test.ts          # Realtime-Channels
├── relationship-api.test.ts          # Relationship-API-Service
├── seo-analytics.test.ts             # SEO + GA4 Event-Tracking
├── settings.test.ts                  # Settings-Panel-Logik
├── theme-contrast.test.ts            # 88 WCAG AA Kontrast-Tests
├── theme-service.test.ts             # Theme-Service + Presets
└── transformation-flow.test.ts       # News-Transformation

frontend/src/types/validation/
├── agent.ts                          # Zod-Schemas
├── agent.test.ts                     # Agent-Validierung
├── building.test.ts                  # Building-Validierung
├── aptitude.test.ts                  # Aptitude-Validierung (Budget, Bereich)
└── ...                               # Weitere Zod-Schema-Tests
```

> **Hinweis:** Frontend-Tests liegen in `frontend/tests/` (Top-Level) und `frontend/src/types/validation/` (co-located Zod-Schema-Tests). Component-Tests mit DOM-Zugriff verwenden `// @vitest-environment happy-dom`.

```
e2e/tests/                            # Playwright E2E (81 Specs, 13 Dateien)
├── auth.spec.ts                      # Login/Register-Flow
├── agents.spec.ts                    # Agent CRUD
├── buildings.spec.ts                 # Building CRUD
├── events.spec.ts                    # Event + Reactions
├── chat.spec.ts                      # Chat-Conversation
├── settings.spec.ts                  # Settings-Modifikation
├── anonymous.spec.ts                 # Public Access (anon RLS)
├── multi-user.spec.ts                # Multi-User Rollen + Isolation
├── social.spec.ts                    # Social Media + Trends
├── embassies.spec.ts                 # Embassy CRUD + Wizard
├── relationships.spec.ts             # Relationship CRUD
├── echoes.spec.ts                    # Event-Echo Bleed
└── multiverse-map.spec.ts            # Cartographer's Map
```

### Unit Test Beispiele

```typescript
// src/utils/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { FormatService } from './formatters';

describe('FormatService', () => {
  const format = new FormatService('de');

  it('formats dates in German locale', () => {
    const date = new Date('2026-01-15');
    expect(format.formatDate(date, 'medium')).toContain('Jan');
  });

  it('formats numbers with German decimal separator', () => {
    expect(format.formatNumber(1234.5)).toBe('1.234,5');
  });

  it('formats percentages', () => {
    expect(format.formatPercent(0.856)).toMatch(/85[,.]6\s?%/);
  });
});


// src/types/validation/agent.test.ts
import { describe, it, expect } from 'vitest';
import { AgentCreateSchema } from './agent';

describe('AgentCreateSchema (Zod)', () => {
  it('validates a complete agent', () => {
    const result = AgentCreateSchema.safeParse({
      name: 'Test Agent',
      system: 'politics',
      gender: 'male',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = AgentCreateSchema.safeParse({ name: '', system: 'x' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.name).toBeDefined();
  });

  it('rejects name over 200 characters', () => {
    const result = AgentCreateSchema.safeParse({
      name: 'x'.repeat(201),
      system: 'politics',
    });
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be undefined', () => {
    const result = AgentCreateSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.character).toBeUndefined();
    }
  });
});


// src/services/api/AgentsApiService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentsApiService } from './AgentsApiService';

describe('AgentsApiService', () => {
  let service: AgentsApiService;

  beforeEach(() => {
    service = new AgentsApiService();
    vi.mocked(fetch).mockReset();
  });

  it('fetches agents with simulation context', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: [], total: 0 }))
    );

    const result = await service.getAgents({ page: 1, limit: 25 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/simulations/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt',
        }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
    );

    const result = await service.getAgent('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Component Test Beispiele

> **Hinweis:** `@open-wc/testing` wurde aus dem Projekt entfernt. Component-Tests nutzen stattdessen direktes DOM-Testing mit `happy-dom` via Direktive.

```typescript
// @vitest-environment happy-dom
// tests/theme-contrast.test.ts — Beispiel: WCAG-Kontrast-Validierung (88 Tests)
import { describe, it, expect } from 'vitest';
import { THEME_PRESETS } from '../src/services/theme-presets';

// Relative Luminanz berechnen (WCAG 2.1)
function relativeLuminance(hex: string): number { /* ... */ }
function contrastRatio(fg: string, bg: string): number { /* ... */ }

describe('Theme Contrast WCAG AA', () => {
  for (const [name, preset] of Object.entries(THEME_PRESETS)) {
    describe(name, () => {
      it('text on surface >= 4.5:1', () => {
        const ratio = contrastRatio(preset.color_text, preset.color_surface);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it('muted text on surface >= 3.0:1', () => {
        const ratio = contrastRatio(preset.color_text_muted, preset.color_surface);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });

      it('button text on primary >= 3.0:1', () => {
        const ratio = contrastRatio(preset.text_inverse, preset.color_primary);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });
  }
});
```

---

## E2E Testing (Playwright)

### Setup

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'cd frontend && npm run dev',
      port: 5173,
      reuseExistingServer: true,
    },
    {
      command: 'cd backend && uvicorn app:app --port 8000',
      port: 8000,
      reuseExistingServer: true,
    },
  ],
});
```

### E2E Test Beispiele

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Sollte zum Simulations-Dashboard weiterleiten
    await expect(page).toHaveURL('/simulations');
    await expect(page.locator('[data-testid="simulation-card"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrong-password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toHaveURL('/auth/login');
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/simulations');
    await expect(page).toHaveURL('/auth/login');
  });
});


// tests/e2e/agents.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login + navigate to agents
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/simulations');
    await page.click('[data-testid="simulation-card"]:first-child');
    await page.waitForURL(/\/simulations\/.*\/agents/);
  });

  test('create a new agent', async ({ page }) => {
    await page.click('[data-testid="create-agent-button"]');
    await page.fill('[data-testid="agent-name"]', 'Test Agent');
    await page.selectOption('[data-testid="agent-system"]', 'politics');
    await page.selectOption('[data-testid="agent-gender"]', 'male');
    await page.click('[data-testid="save-button"]');

    // Agent sollte in der Liste erscheinen
    await expect(page.locator('text=Test Agent')).toBeVisible();
  });

  test('edit an existing agent', async ({ page }) => {
    await page.click('[data-testid="agent-card"]:first-child [data-testid="edit-button"]');
    await page.fill('[data-testid="agent-name"]', 'Updated Agent Name');
    await page.click('[data-testid="save-button"]');

    await expect(page.locator('text=Updated Agent Name')).toBeVisible();
  });

  test('delete an agent with confirmation', async ({ page }) => {
    const agentName = await page.locator('[data-testid="agent-card"]:first-child .agent-name').textContent();
    await page.click('[data-testid="agent-card"]:first-child [data-testid="delete-button"]');

    // Bestätigungsdialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-button"]');

    // Agent sollte verschwunden sein
    await expect(page.locator(`text=${agentName}`)).not.toBeVisible();
  });

  test('filter agents by system', async ({ page }) => {
    await page.selectOption('[data-testid="filter-system"]', 'military');
    // Alle sichtbaren Agenten sollten System "military" haben
    const agents = page.locator('[data-testid="agent-card"]');
    const count = await agents.count();
    for (let i = 0; i < count; i++) {
      await expect(agents.nth(i).locator('.agent-system')).toContainText('military');
    }
  });
});


// tests/e2e/settings.spec.ts
test.describe('Simulation Settings', () => {
  test('change simulation name', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-testid="settings-link"]');
    await page.waitForURL(/\/settings/);

    // General tab sollte aktiv sein
    await expect(page.locator('[data-testid="tab-general"].active')).toBeVisible();

    // Name andern
    await page.fill('[data-testid="simulation-name"]', 'Velgarien Reloaded');
    await page.click('[data-testid="save-settings"]');

    // Erfolgs-Toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('add taxonomy value in World settings', async ({ page }) => {
    await page.click('[data-testid="settings-link"]');
    await page.click('[data-testid="tab-world"]');
    await page.selectOption('[data-testid="taxonomy-select"]', 'profession');
    await page.click('[data-testid="add-taxonomy-button"]');
    await page.fill('[data-testid="taxonomy-value"]', 'diplomat');
    await page.fill('[data-testid="taxonomy-label-de"]', 'Diplomat');
    await page.click('[data-testid="save-taxonomy"]');

    await expect(page.locator('text=diplomat')).toBeVisible();
  });
});
```

---

## Test-Daten-Strategie

### Seed-Daten (Supabase)

```sql
-- supabase/seed/test_data.sql
-- Wird bei jedem Test-Lauf geladen

-- Test-User (in auth.users via Supabase Admin API)
-- user_a: test-a@example.com (Owner von Simulation A)
-- user_b: test-b@example.com (Owner von Simulation B)
-- user_viewer: viewer@example.com (Viewer in Simulation A)

-- Test-Simulation
INSERT INTO simulations (id, name, slug, theme, status, content_locale, owner_id)
VALUES ('test-sim-uuid', 'Test Simulation', 'test', 'dystopian', 'active', 'de', 'user-a-uuid');

-- Test-Mitgliedschaft
INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES
  ('test-sim-uuid', 'user-a-uuid', 'owner'),
  ('test-sim-uuid', 'user-viewer-uuid', 'viewer');

-- Test-Taxonomien
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
  ('test-sim-uuid', 'gender', 'male', '{"de":"mannlich","en":"male"}', 1),
  ('test-sim-uuid', 'gender', 'female', '{"de":"weiblich","en":"female"}', 2),
  ('test-sim-uuid', 'system', 'politics', '{"de":"Politik","en":"Politics"}', 1),
  ('test-sim-uuid', 'system', 'military', '{"de":"Militar","en":"Military"}', 2),
  ('test-sim-uuid', 'profession', 'scientist', '{"de":"Wissenschaftler","en":"Scientist"}', 1);

-- Test-Agenten (5 Stuck)
INSERT INTO agents (id, simulation_id, name, system, gender) VALUES
  ('agent-1-uuid', 'test-sim-uuid', 'Agent Alpha', 'politics', 'male'),
  ('agent-2-uuid', 'test-sim-uuid', 'Agent Beta', 'military', 'female'),
  ('agent-3-uuid', 'test-sim-uuid', 'Agent Gamma', 'politics', 'diverse'),
  ('agent-4-uuid', 'test-sim-uuid', 'Agent Delta', 'military', 'male'),
  ('agent-5-uuid', 'test-sim-uuid', 'Agent Epsilon', 'politics', 'female');

-- Test-Buildings (3 Stuck)
INSERT INTO buildings (id, simulation_id, name, building_type) VALUES
  ('building-1-uuid', 'test-sim-uuid', 'Hauptquartier', 'government'),
  ('building-2-uuid', 'test-sim-uuid', 'Kaserne', 'military'),
  ('building-3-uuid', 'test-sim-uuid', 'Forschungslabor', 'special');
```

### Factory-Pattern (Frontend)

```typescript
// tests/helpers/fixtures.ts
import type { Agent, Building, Event } from '../../src/types';

export function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: crypto.randomUUID(),
    simulation_id: 'test-sim-uuid',
    name: 'Test Agent',
    system: 'politics',
    gender: 'male',
    character: null,
    background: null,
    portrait_image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: crypto.randomUUID(),
    simulation_id: 'test-sim-uuid',
    name: 'Test Building',
    type: 'government',
    ...overrides,
  };
}

export function createAgentList(count: number): Agent[] {
  return Array.from({ length: count }, (_, i) =>
    createAgent({ name: `Agent ${i + 1}` })
  );
}
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Backend Lint (ruff)
        run: |
          pip install ruff
          ruff check backend/
          ruff format --check backend/

      - name: Frontend Lint (Biome)
        run: |
          cd frontend && npm ci
          npx biome check src/

  test-backend:
    runs-on: ubuntu-latest
    needs: lint
    # Kein services:-Block noetig — supabase start verwaltet eigene Docker-Container
    # (inkl. Postgres auf 54322, API-Gateway auf 54321, Auth, Storage, etc.)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.13' }

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with: { version: latest }

      - name: Start Supabase (local)
        run: |
          supabase start
          # Exportiere Supabase-Umgebungsvariablen fuer nachfolgende Steps
          supabase status -o env >> $GITHUB_ENV
        # Startet alle Supabase-Dienste lokal:
        # - API Gateway: http://localhost:54321
        # - Postgres: localhost:54322
        # - Auth, Storage, Realtime, etc.

      - name: Install Dependencies
        run: pip install -e ".[test]"
        working-directory: backend

      - name: Run Unit Tests
        run: pytest tests/unit/ -v --cov=backend --cov-report=xml
        working-directory: backend

      - name: Run Integration Tests
        run: pytest tests/integration/ -v -m integration
        working-directory: backend
        env:
          # Variablen von `supabase status -o env` (via GITHUB_ENV):
          # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.
          # werden automatisch aus dem vorherigen Step uebernommen
          SUPABASE_DB_URL: postgresql://postgres:postgres@localhost:54322/postgres

  test-frontend:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install Dependencies
        run: cd frontend && npm ci

      - name: Run Unit + Component Tests
        run: cd frontend && npx vitest run --coverage

      - name: Build Check
        run: cd frontend && npm run build

  test-e2e:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install Playwright
        run: cd e2e && npx playwright install --with-deps

      - name: Start Services
        run: |
          cd backend && uvicorn app:app --port 8000 &
          cd frontend && npm run dev &
          sleep 5

      - name: Run E2E Tests
        run: cd e2e && npx playwright test

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

---

## Neue Test-Suites (seit v1.2)

### Backend: Competitive Layer + Game Systems

| Datei | Tests | Beschreibung |
|-------|-------|-------------|
| `test_operative_service.py` | Operative-Deployment, 6 Effekte (Spy Intel, Saboteur Zone Damage, Propagandist Events, Assassin Blocking, Infiltrator Reduction, Alliance/Betrayal), Game-State-Auswirkungen, Aptitude-basierte Erfolgswahrscheinlichkeit | Vollstaendige Operative-Pipeline |
| `test_scoring_service.py` | 5-Dimensionen-Scoring (Stability, Influence, Sovereignty, Diplomatic, Military), Allianz-Bonus (15%), Verrat-Malus (-25%), Spy-Intel-Bonus, Guardian-Penalty (0.06/Unit, Cap 0.15) | Scoring-Formeln und Balancing |
| `test_epoch_service.py` | Epoch-Lifecycle (create → start → resolve_cycle → advance_phase → complete), Game-Instance-Integration (clone → archive → delete), Draft-Phase-Validierung, Bot-Integration bei resolve_cycle | Epoch-Orchestrierung |
| `test_bot_personality.py` | 5 KI-Archetypen (Sentinel, Warlord, Diplomat, Strategist, Chaos), Entscheidungslogik pro Persoenlichkeit, Difficulty-Skalierung (easy/medium/hard), Auto-Draft mit Persoenlichkeits-Gewichtung | Bot-Entscheidungs-Engine |
| `test_bot_player_service.py` | Bot-CRUD, Bot zu Epoch hinzufuegen/entfernen, Epoch-Management, Participant-Erstellung mit `is_bot=true` | Bot-Verwaltung |
| `test_alliance_service.py` | Proposal-Erstellung (Phasen-Guard, Solo-Auto-Accept, Team-Kapazitaet), Voting (Accept/Reject/Resolution), Tension-Tracking (+10 Overlap, -5 Decay, Auto-Dissolve bei 80), Upkeep-Deduction (1 RP/Mitglied), Proposal-Expiry, Team-Dissolution, Structlog-Verifikation | Allianz-Redesign (28 Tests) |

### Backend: Infrastruktur + Email

| Datei | Tests | Beschreibung |
|-------|-------|-------------|
| `test_cleanup_service.py` | Stats-Abfrage (6 Daten-Kategorien), Preview-vor-Delete (Cascade-Baum mit Item-Liste), Execute mit FK-Reihenfolge, Epoch-Loeschung (game_instances zuerst, dann 8 Child-Tabellen), Selektive Löschung via `epoch_ids`-Parameter, `min_age_days=0` erlaubt | Admin-Datenbereinigung |
| `test_email_templates.py` | Zweisprachige Email-Rendering (EN/DE), Per-Simulation-Akzentfarben, WCAG-AA-Kontrast, 4 Template-Typen (Invitation, Cycle-Resolved, Phase-Changed, Epoch-Completed), 85+ lokalisierte Strings | Email-Templates |
| `test_cycle_notification_service.py` | 6-Schritt-Empfaenger-Auflosung (Participants → Templates → Members → Emails → Preferences → Slug), Per-Player-Briefing-Daten (Rank-Gap, Missions, Spy-Intel, Threats, Alliances), Fog-of-War-Compliance | Cycle-Benachrichtigungen |
| `test_email_service.py` | SMTP-SSL-Verbindung (Port 465), asyncio.to_thread-Integration, Fehlerbehandlung, Logging-Verifikation (PII-Check) | Email-Versand |

### Backend: Logging + Observability (seit v2.1)

| Datei | Tests | Beschreibung |
|-------|-------|-------------|
| `test_logging_config.py` | structlog.configure()-Verifikation, JSON/Console-Renderer-Auswahl, Noisy-Logger-Unterdrueckung (httpx, supabase), Log-Level aus Settings, ExtraAdder in foreign_pre_chain | structlog-Infrastruktur (6 Tests) |
| `test_logging_context_middleware.py` | JWT-Extraktion (5 Edge-Cases: valid, no-auth, malformed, missing-sub, non-bearer), Request-ID Generierung/Echo, "Request completed" Log mit status_code + duration_ms | Logging-Middleware (8 Tests) |
| `test_simulation_service.py` | create_simulation INFO-Log (simulation_id, slug, user_id), hard_delete WARNING (simulation_name, slug), soft_delete INFO, restore INFO | Simulation CRUD + Logging (4 Tests) |
| `test_member_service.py` | add_member INFO-Log (user_id, simulation_id, role), change_role INFO (member_id, new_role), LastOwner-Schutz WARNING bei Role-Change + Removal | Member CRUD + LastOwner (5 Tests) |
| `test_invitation_service.py` | create INFO (simulation_id, invited_role), accept INFO (user_id), expired INFO (simulation_id) | Einladungs-Lifecycle (3 Tests) |
| `test_epoch_invitation_service.py` | mark_accepted INFO (epoch_id, user_id), revoke INFO (invitation_id), expired 410-Exception | Epoch-Einladungen (3 Tests) |

**Logging-Assertions in bestehenden Tests:** `test_email_service.py` (+4 Tests), `test_base_service.py` (+3 Tests), `test_event_service.py` (+1 Test), `test_scoring_service.py` (+2 Tests), `test_epoch_chat_service.py` (+2 Tests), `test_cleanup_service.py` (+2 Tests). Alle verwenden pytest `caplog` Fixture mit `extra={}`-Feld-Verifikation.

**Shared Fixture:** `make_chain_mock()` in `conftest.py` — wiederverwendbarer Supabase-Query-Chain-Mock. Unterstuetzt `.select()`, `.eq()`, `.in_()`, `.insert()`, `.update()`, `.delete()`, `.maybe_single()`, etc. Eliminiert ~40 Zeilen Copy-Paste pro Test-Datei.

### Frontend: Spezialisierte Test-Suites

| Datei | Tests | Beschreibung |
|-------|-------|-------------|
| `theme-contrast.test.ts` | 88 WCAG-AA-Tests ueber alle Theme-Presets (6 Presets × ~15 Kontrast-Paare), Normal-Text 4.5:1, Muted 3.0:1, Button-Text 3.0:1, Badge-Text 3.0:1 | WCAG-Kontrast-Validierung |
| `seo-analytics.test.ts` | SEO-Meta-Tags, JSON-LD Structured Data, GA4 Event-Tracking (37 Events), Consent-Mode v2, Production-Only-Guard | SEO + Analytics |
| `settings.test.ts` | BaseSettingsPanel Load/Save/Dirty-Tracking, 8 Panel-Konfigurationen, Design-Tokens | Settings-Logik |
| `validation/aptitude.test.ts` | Budget-Validierung (36 Punkte), Bereichs-Validierung (3-9 pro Dimension), 6 Operative-Typen | Aptitude-Schemas |
| `map-force.test.ts` | Force-Simulation Physik, Template/Instance-Orbit, Repulsion/Attraction-Balance, Equilibrium-Distance | Kartograph-Physik |
| `realtime-service.test.ts` | 4 Supabase-Realtime-Channels (chat, presence, status, team), Signal-Subscriptions, Channel-Lifecycle | Realtime-Integration |
| `epoch-alliance-api.test.ts` | listProposals (3 Tests), createProposal (4 Tests: POST, pending-Status, 400-TeamFull, 409-Duplicate), voteOnProposal (5 Tests: Accept, Reject, 403-NotMember, 400-AlreadyResolved) | Allianz-API-Vertrag (12 Tests) |
| `notification-preferences.test.ts` | Opt-in/Opt-out-Toggles, API-Service-Aufrufe, Locale-Praeferenz | Benachrichtigungs-Praeferenzen |

---

## Spezielle Test-Kategorien

### RLS Security Tests

Jede Tabelle braucht Tests fur:
1. **Isolation**: User A sieht keine Daten von User Bs Simulation
2. **Rollen**: Viewer kann nicht schreiben, Editor kann nicht loschen
3. **Cross-Simulation**: Ein User mit Zugang zu Sim A + Sim B sieht in jedem Kontext nur die richtigen Daten

### AI-Integration Tests (Mocked)

Externe AI-APIs werden **immer gemockt** in Unit/Integration-Tests:

```python
# backend/tests/conftest.py
@pytest.fixture
def mock_openrouter(monkeypatch):
    async def mock_generate(*args, **kwargs):
        return {"character": "Test character", "background": "Test background"}
    monkeypatch.setattr("backend.services.external.openrouter.generate", mock_generate)

@pytest.fixture
def mock_replicate(monkeypatch):
    async def mock_predict(*args, **kwargs):
        return "https://example.com/test-image.webp"
    monkeypatch.setattr("backend.services.external.replicate.create_prediction", mock_predict)
```

Echte AI-API-Tests nur manuell oder in separatem `smoke-test` Job.

### Performance Tests

```python
# backend/tests/performance/test_load.py
import pytest
import asyncio

@pytest.mark.slow
async def test_100_concurrent_agent_reads(async_client, auth_headers, test_simulation):
    """100 gleichzeitige GET /agents Requests."""
    tasks = [
        async_client.get(
            f"/api/v1/simulations/{test_simulation.id}/agents",
            headers=auth_headers
        )
        for _ in range(100)
    ]
    responses = await asyncio.gather(*tasks)
    assert all(r.status_code == 200 for r in responses)
    # p95 Response Time < 200ms
    # (gemessen via Middleware-Logging)
```

---

## Querverweise

- **Frontend Components** (`../references/frontend-components.md`) — Zu testende Komponenten
- **Auth and Security** (`../specs/auth-and-security.md`) — Auth-Flow und RLS-Policies zum Testen
- **Techstack Recommendation** (`../explanations/techstack-recommendation.md`) — Test-Tools (vitest, pytest, playwright)
- **Implementation Plan** (`implementation-plan.md`) — Test-Tasks pro Phase
