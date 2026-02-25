# 16 - Testing Strategy

**Version:** 1.2
**Datum:** 2026-02-25
**Aenderung v1.2:** Aktualisierte Test-Zahlen (275 Backend, 197 Frontend, 56 E2E), 88 WCAG-Kontrast-Tests, 36 Anonymous-View-Integrationstests

---

## Test-Pyramide

```
          ┌──────────┐
          │   E2E    │  56 Specs   (Playwright, 9 Dateien)
          │ Browser  │  Kritische User-Flows
         ┌┴──────────┴┐
         │ Integration │  ~110 Tests (pytest + vitest)
         │  API + DB   │  Router ↔ Service ↔ DB
        ┌┴────────────┴┐
        │     Unit      │  ~360 Tests (pytest + vitest)
        │ Services, Utils│  Isolierte Logik
        └───────────────┘
```

| Ebene | Backend (pytest) | Frontend (vitest) | Ziel |
|-------|-----------------|-------------------|------|
| **Unit** | Services, Utils, Models, Encryption | Components, State, Validation, Formatters, WCAG-Kontrast (88 Tests) | ~360 Tests, < 30s |
| **Integration** | Router → Service → Supabase (TestClient), 36 Anonymous-View-Tests | API-Services → Mock-Server, Component Interaction | ~110 Tests, < 2min |
| **E2E** | — | Playwright: Login → CRUD → Chat → Settings → Public Access (10 Specs) | 56 Specs, < 5min |

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
testpaths = ["tests"]
asyncio_mode = "auto"
markers = [
    "unit: Unit tests (no external dependencies)",
    "integration: Integration tests (requires Supabase)",
    "slow: Tests that take >5s",
]

[tool.coverage.run]
source = ["backend"]
omit = ["tests/*", "*/migrations/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

### Verzeichnisstruktur

```
backend/tests/
├── conftest.py                    # Shared Fixtures
├── unit/
│   ├── test_models.py             # Pydantic Validierung
│   ├── test_encryption.py         # Fernet encrypt/decrypt
│   ├── test_prompt_resolver.py    # Fallback-Kette
│   ├── test_settings_service.py   # Settings Auflösung
│   ├── test_taxonomy_service.py   # Taxonomie-Lookup
│   └── services/
│       ├── test_agent_service.py
│       ├── test_building_service.py
│       ├── test_event_service.py
│       ├── test_generation_service.py
│       ├── test_chat_service.py
│       └── test_image_service.py
├── integration/
│   ├── conftest.py                # Supabase Test-Client, Fixtures
│   ├── test_agents_router.py
│   ├── test_buildings_router.py
│   ├── test_events_router.py
│   ├── test_chat_router.py
│   ├── test_generation_router.py
│   ├── test_settings_router.py
│   ├── test_taxonomies_router.py
│   ├── test_simulations_router.py
│   ├── test_users_router.py
│   ├── test_rls_policies.py       # RLS Enforcement Tests
│   └── test_auth_flow.py          # JWT Validierung
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
    from jose import jwt
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
    environment: 'jsdom',
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
frontend/
├── tests/
│   ├── setup.ts                      # Global mocks
│   ├── helpers/
│   │   ├── render.ts                 # Component render helper
│   │   ├── fixtures.ts               # Test data factories
│   │   └── mock-api.ts               # API mock helpers
│   └── e2e/
│       ├── auth.spec.ts              # Login/Register flow
│       ├── agents.spec.ts            # Agent CRUD flow
│       ├── buildings.spec.ts         # Building CRUD flow
│       ├── events.spec.ts            # Event + Reactions flow
│       ├── chat.spec.ts              # Chat conversation flow
│       ├── settings.spec.ts          # Settings modification flow
│       └── simulation.spec.ts        # Create/switch simulation
├── src/
│   ├── components/
│   │   └── agents/
│   │       ├── VelgAgentsView.ts
│   │       └── VelgAgentsView.test.ts    # Co-located unit test
│   ├── services/
│   │   └── api/
│   │       ├── AgentsApiService.ts
│   │       └── AgentsApiService.test.ts  # Co-located unit test
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── formatters.test.ts
│   └── types/
│       └── validation/
│           ├── agent.ts                   # Zod schemas
│           └── agent.test.ts
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

```typescript
// src/components/shared/ErrorState.test.ts
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import './ErrorState';

describe('ErrorState', () => {
  it('renders error message', async () => {
    const el = await fixture(html`<error-state message="Something went wrong"></error-state>`);
    const shadow = el.shadowRoot!;
    expect(shadow.textContent).toContain('Something went wrong');
  });

  it('shows retry button when retryable', async () => {
    const el = await fixture(html`<error-state message="Error" retryable></error-state>`);
    const btn = el.shadowRoot!.querySelector('button');
    expect(btn).toBeDefined();
  });

  it('hides retry button when not retryable', async () => {
    const el = await fixture(html`<error-state message="Error"></error-state>`);
    const btn = el.shadowRoot!.querySelector('button.retry');
    expect(btn).toBeNull();
  });

  it('dispatches retry event on button click', async () => {
    const el = await fixture(html`<error-state message="Error" retryable></error-state>`);
    let retried = false;
    el.addEventListener('retry', () => { retried = true; });
    const btn = el.shadowRoot!.querySelector('button')!;
    btn.click();
    expect(retried).toBe(true);
  });
});
```

---

## E2E Testing (Playwright)

### Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
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
        with: { python-version: '3.11' }

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
        run: cd frontend && npx playwright install --with-deps

      - name: Start Services
        run: |
          cd backend && uvicorn app:app --port 8000 &
          cd frontend && npm run dev &
          sleep 5

      - name: Run E2E Tests
        run: cd frontend && npx playwright test

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

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

- **07_FRONTEND_COMPONENTS.md** — Zu testende Komponenten
- **10_AUTH_AND_SECURITY.md** — Auth-Flow und RLS-Policies zum Testen
- **13_TECHSTACK_RECOMMENDATION.md** — Test-Tools (vitest, pytest, playwright)
- **17_IMPLEMENTATION_PLAN.md** — Test-Tasks pro Phase
