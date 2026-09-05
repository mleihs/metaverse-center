"""Integration tests for the Forge router endpoints (/api/v1/forge).

Covers:
1. Auth gate — unauthenticated, non-architect, non-admin rejection
2. Wallet & bundles — GET /wallet, GET /bundles
3. BYOK — PUT /wallet/keys (allowed + denied)
4. Drafts — list, create, update (phase validation), delete
5. Darkroom — purchase pass, regenerate (no pass, budget exhausted)
6. Admin — stats, grant, bundle update, non-admin rejection
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from backend.app import app
from backend.config import settings as app_settings
from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    get_supabase,
)
from backend.models.common import CurrentUser
from backend.models.forge import TestBYOKResult as ProviderKeyTestResult
from backend.routers import forge as forge_module
from backend.tests.conftest import MOCK_ADMIN_EMAIL
from backend.utils.encryption import current_key_version, decrypt, encrypt

# ── Constants ────────────────────────────────────────────────────────────

ADMIN_EMAIL = MOCK_ADMIN_EMAIL
USER_EMAIL = "forge-user@velgarien.dev"
USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
DRAFT_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
SIM_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
AGENT_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
BUNDLE_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
PURCHASE_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"


def _make_user(uid: UUID, email: str, token: str = "mock") -> CurrentUser:  # noqa: S107
    return CurrentUser(id=uid, email=email, access_token=token)


def _mock_supabase() -> MagicMock:
    """Build a chainable Supabase mock with async execute.

    ``mock.rpc`` is a real ``MagicMock`` with a side effect rather than a fixed
    return value, so a test can (a) hand each RPC its own answer through
    ``mock.rpc_data[name] = ...`` and (b) read back from ``mock.rpc.call_args_list``
    WHICH client an RPC was routed through. The second half matters: the BYOK
    save endpoint failed in production precisely because a self-validating
    SECURITY DEFINER function was called on the service-role client, and a test
    that hands the same mock to every dependency cannot see that at all.
    """
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = []
    result.count = 0
    chain.execute = AsyncMock(return_value=result)
    for m in (
        "select",
        "eq",
        "insert",
        "update",
        "delete",
        "upsert",
        "limit",
        "single",
        "maybe_single",
        "order",
        "range",
        "filter",
        "in_",
        "is_",
        "not_",
        "or_",
        "ilike",
        "lt",
        "gt",
    ):
        getattr(chain, m).return_value = chain
    mock.table.return_value = chain

    mock.rpc_data = {}

    def _rpc(name, params=None):
        rpc_chain = MagicMock()
        rpc_result = MagicMock()
        rpc_result.data = mock.rpc_data.get(name)
        rpc_chain.execute = AsyncMock(return_value=rpc_result)
        return rpc_chain

    mock.rpc = MagicMock(side_effect=_rpc)
    return mock


def _rpc_names(mock: MagicMock) -> list[str]:
    """Names of the RPCs that were routed through this particular client."""
    return [call.args[0] for call in mock.rpc.call_args_list]


# ── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture()
def encryption_key():
    """Give the process a real Fernet key for the duration of one test.

    BYOK tests exercise ``encrypt()`` for real rather than patching it away —
    the round trip through the encryption layer is part of what "the key is
    stored" means, and CI carries no ``SETTINGS_ENCRYPTION_KEY``.
    """
    previous = app_settings.settings_encryption_key
    app_settings.settings_encryption_key = Fernet.generate_key().decode()
    yield
    app_settings.settings_encryption_key = previous


@pytest.fixture()
def architect_client():
    """TestClient for a PLATFORM ADMIN (admin email in PLATFORM_ADMIN_EMAILS).

    Wired the way production wires it, which the previous version of this
    fixture did not: ``get_effective_supabase`` auto-elevates admins to the
    service-role client, so it yields ``admin_sb`` here, while ``get_supabase``
    stays the user-JWT client. Handing ONE mock to both hid the whole class of
    bug where a function that reads ``auth.uid()`` is called on a token that
    has no ``sub``.

    Yields ``(client, user_sb, admin_sb)``.
    """
    user = _make_user(USER_ID, ADMIN_EMAIL)
    user_sb = _mock_supabase()
    admin_sb = _mock_supabase()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: admin_sb
    app.dependency_overrides[get_supabase] = lambda: user_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb

    yield TestClient(app), user_sb, admin_sb
    app.dependency_overrides.clear()


def _regular_user_overrides() -> tuple[MagicMock, MagicMock]:
    """Dependency wiring for a signed-in, non-architect, non-admin user.

    The wallet lookup answers "no row", which is what makes
    ``require_architect()`` reject — and, since the BYOK endpoints no longer
    ask it, what makes those endpoints prove they serve an ordinary account.
    ``get_effective_supabase`` returns the user client: no elevation.
    """
    user = _make_user(USER_ID, USER_EMAIL)
    user_sb = _mock_supabase()
    admin_sb = _mock_supabase()

    wallet_resp = MagicMock()
    wallet_resp.data = None  # no wallet row → not an architect
    wallet_chain = MagicMock()
    for m in ("select", "eq", "maybe_single", "limit", "single"):
        getattr(wallet_chain, m).return_value = wallet_chain
    wallet_chain.execute = AsyncMock(return_value=wallet_resp)
    admin_sb.table.return_value = wallet_chain

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: user_sb
    app.dependency_overrides[get_supabase] = lambda: user_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb
    return user_sb, admin_sb


@pytest.fixture()
def regular_client():
    """TestClient with an authenticated non-architect, non-admin user."""
    _regular_user_overrides()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def regular_client_full():
    """``regular_client`` plus its mocks — ``(client, user_sb, admin_sb)``."""
    user_sb, admin_sb = _regular_user_overrides()
    yield TestClient(app), user_sb, admin_sb
    app.dependency_overrides.clear()


@pytest.fixture()
def unauthenticated_client():
    """TestClient with no auth overrides — get_current_user will fail."""
    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


# ══════════════════════════════════════════════════════════════════════════
# 1. Auth Gate
# ══════════════════════════════════════════════════════════════════════════


class TestForgeAuthGate:
    """Endpoints reject requests without proper credentials/roles."""

    @pytest.mark.integration
    def test_unauthenticated_wallet_rejected(self, unauthenticated_client):
        """GET /forge/wallet without auth token returns 401 or 403."""
        resp = unauthenticated_client.get("/api/v1/forge/wallet")
        assert resp.status_code in (401, 403, 422)

    @pytest.mark.integration
    def test_non_architect_cannot_create_draft(self, regular_client):
        """POST /forge/drafts requires architect role — non-architect gets 403."""
        resp = regular_client.post(
            "/api/v1/forge/drafts",
            json={"seed_prompt": "A world of shadows"},
        )
        assert resp.status_code == 403

    @pytest.mark.integration
    def test_non_admin_cannot_access_stats(self, regular_client):
        """GET /forge/admin/stats requires platform admin — regular user gets 403."""
        resp = regular_client.get("/api/v1/forge/admin/stats")
        assert resp.status_code == 403

    @pytest.mark.integration
    def test_non_admin_cannot_grant_tokens(self, regular_client):
        """POST /forge/admin/grant requires platform admin."""
        resp = regular_client.post(
            "/api/v1/forge/admin/grant",
            json={"user_id": str(uuid4()), "tokens": 100, "reason": "test"},
        )
        assert resp.status_code == 403

    @pytest.mark.integration
    def test_non_admin_cannot_update_bundles(self, regular_client):
        """PUT /forge/admin/bundles/{id} requires platform admin."""
        resp = regular_client.put(
            f"/api/v1/forge/admin/bundles/{BUNDLE_ID}",
            json={"display_name": "Hacked bundle"},
        )
        assert resp.status_code == 403

    @pytest.mark.integration
    def test_non_architect_cannot_delete_draft(self, regular_client):
        """DELETE /forge/drafts/{id} requires architect role."""
        resp = regular_client.delete(f"/api/v1/forge/drafts/{DRAFT_ID}")
        assert resp.status_code == 403


# ══════════════════════════════════════════════════════════════════════════
# 2. Wallet & Bundles
# ══════════════════════════════════════════════════════════════════════════


class TestForgeWallet:
    """Wallet and bundle catalog endpoints."""

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "get_wallet", new_callable=AsyncMock)
    def test_get_wallet_returns_summary(self, mock_get_wallet, architect_client):
        """GET /forge/wallet returns wallet summary."""
        mock_get_wallet.return_value = {
            "forge_tokens": 42,
            "is_architect": True,
            "account_tier": "architect",
            "byok_status": {
                "has_openrouter_key": False,
                "has_replicate_key": False,
                "byok_allowed": False,
                "byok_bypass": False,
                "system_bypass_enabled": False,
                "effective_bypass": False,
                "access_policy": "per_user",
            },
        }
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/wallet")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["forge_tokens"] == 42

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "list_bundles", new_callable=AsyncMock)
    def test_list_bundles_returns_catalog(self, mock_list_bundles, architect_client):
        """GET /forge/bundles returns bundle list."""
        mock_list_bundles.return_value = [
            {
                "id": str(BUNDLE_ID),
                "slug": "starter",
                "display_name": "Starter Pack",
                "tokens": 100,
                "price_cents": 499,
                "savings_pct": 0,
                "sort_order": 1,
                "is_active": True,
            },
        ]
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/bundles")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["slug"] == "starter"


# ══════════════════════════════════════════════════════════════════════════
# 3. BYOK
# ══════════════════════════════════════════════════════════════════════════


class TestForgeBYOK:
    """BYOK key management — the person's key, not the Forge's.

    These tests deliberately do NOT patch ``check_byok_allowed`` or
    ``update_user_keys``. The previous versions patched both, which is why the
    suite stayed green while the endpoint answered 403 and then 500 in
    production: two independent locks lay on top of each other and no test
    touched either. What is mocked here is the Supabase client and nothing
    above it, so the policy gate, the client choice and the encryption round
    trip all run for real.
    """

    @pytest.mark.integration
    def test_write_rpc_goes_through_the_user_client(self, architect_client, encryption_key):
        """The self-validating RPC must be called on the user-JWT client.

        ``fn_update_user_byok_keys`` authorises via ``auth.uid()``. The
        effective client hands a platform admin a service-role JWT, which
        carries no ``sub`` — so routing this RPC there raised *Not authorized
        to update another user's keys* for exactly the accounts most likely to
        try it first.
        """
        client, user_sb, admin_sb = architect_client
        user_sb.rpc_data["fn_set_user_api_key"] = {"success": True, "message": "Key stored."}

        resp = client.put(
            "/api/v1/forge/wallet/keys",
            json={"openrouter_key": "sk-or-test-123", "replicate_key": None},
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert "fn_set_user_api_key" in _rpc_names(user_sb)
        assert "fn_set_user_api_key" not in _rpc_names(admin_sb)

    @pytest.mark.integration
    def test_key_is_encrypted_before_it_reaches_the_database(self, architect_client, encryption_key):
        """What travels to the RPC is ciphertext that decrypts back to the key."""
        client, user_sb, _ = architect_client
        user_sb.rpc_data["fn_set_user_api_key"] = {"success": True}

        resp = client.put("/api/v1/forge/wallet/keys", json={"openrouter_key": "sk-or-secret-value"})
        assert resp.status_code == 200

        params = next(call.args[1] for call in user_sb.rpc.call_args_list if call.args[0] == "fn_set_user_api_key")
        assert params["p_provider"] == "openrouter"
        stored = params["p_encrypted_key"]
        assert stored != "sk-or-secret-value"
        assert decrypt(stored) == "sk-or-secret-value"
        # The version that encrypted it travels with it — without that column
        # rotating SETTINGS_ENCRYPTION_KEY has no way to find what is left.
        assert params["p_key_version"] == current_key_version()

    @pytest.mark.integration
    def test_platform_admin_passes_a_policy_that_grants_nobody(self, architect_client, encryption_key):
        """Whoever sets the policy cannot be locked out by it.

        Production shipped ``byok_access_policy = 'per_user'`` with
        ``byok_allowed`` true for nobody — so the admin console rendered the
        key fields and Save answered *BYOK access not granted*.
        """
        client, user_sb, admin_sb = architect_client
        admin_sb.rpc_data["fn_user_byok_allowed"] = False
        user_sb.rpc_data["fn_set_user_api_key"] = {"success": True}

        resp = client.put("/api/v1/forge/wallet/keys", json={"openrouter_key": "sk-or-test-123"})
        assert resp.status_code == 200

    @pytest.mark.integration
    def test_signed_in_non_architect_may_deposit_a_key(self, regular_client_full, encryption_key):
        """A key belongs to the person — being an architect is not the question.

        This account fails ``require_architect()`` (the wallet lookup answers
        "no row"), which is what used to close the endpoint at 403 before the
        policy was ever consulted.
        """
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = True
        user_sb.rpc_data["fn_set_user_api_key"] = {"success": True}

        resp = client.put("/api/v1/forge/wallet/keys", json={"openrouter_key": "sk-or-test-123"})

        assert resp.status_code == 200
        assert "fn_set_user_api_key" in _rpc_names(user_sb)

    @pytest.mark.integration
    def test_non_architect_still_cannot_reach_the_forge_itself(self, regular_client):
        """Opening the key endpoints must not open the Forge with them."""
        assert regular_client.post("/api/v1/forge/drafts", json={"seed_prompt": "x"}).status_code == 403
        assert regular_client.get("/api/v1/forge/drafts").status_code == 403

    @pytest.mark.integration
    def test_update_keys_denied_when_policy_grants_nobody(self, regular_client_full, encryption_key):
        """PUT /forge/wallet/keys returns 403 when BYOK is not granted — and writes nothing."""
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = False

        resp = client.put("/api/v1/forge/wallet/keys", json={"openrouter_key": "sk-or-test-123"})

        assert resp.status_code == 403
        assert "BYOK access not granted" in resp.json()["detail"]
        assert "fn_set_user_api_key" not in _rpc_names(user_sb)

    @pytest.mark.integration
    def test_delete_key_goes_through_the_user_client(self, regular_client_full, encryption_key):
        """DELETE routes the same self-validating RPC the same way."""
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = True
        user_sb.rpc_data["fn_clear_user_api_key"] = {"success": True}

        resp = client.delete("/api/v1/forge/wallet/keys/openrouter")

        assert resp.status_code == 200
        params = next(call.args[1] for call in user_sb.rpc.call_args_list if call.args[0] == "fn_clear_user_api_key")
        assert params["p_provider"] == "openrouter"

    @pytest.mark.integration
    def test_key_test_endpoint_keeps_the_policy_gate(self, regular_client_full):
        """Testing a key is still gated — it spends a request against a provider."""
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = False

        resp = client.post(
            "/api/v1/forge/wallet/keys/test",
            json={"provider": "openrouter", "key": "sk-or-test-123"},
        )
        assert resp.status_code == 403

    @pytest.mark.integration
    @patch("backend.services.forge_draft_service.ForgeDraftService.test_provider_key", new_callable=AsyncMock)
    @patch("backend.services.forge_draft_service.get_admin_supabase_client", new_callable=AsyncMock)
    def test_recheck_stamps_only_when_the_provider_says_yes(
        self, mock_admin, mock_test, regular_client_full, encryption_key
    ):
        """Re-checking asks about the key ON FILE, and only a yes gets stamped.

        This is the question "configured" could never answer: a key revoked at
        the provider three weeks ago looks identical to a working one here.
        """
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = True
        user_sb.rpc_data["fn_mark_user_api_key_verified"] = {"success": True}

        keys_client = _mock_supabase()
        keys_client.rpc_data["fn_get_user_api_keys"] = {"openrouter": encrypt("sk-or-v1-stored")}
        mock_admin.return_value = keys_client
        mock_test.return_value = ProviderKeyTestResult(valid=True, detail="ok", response_ms=12)

        resp = client.post("/api/v1/forge/byok/recheck/openrouter")

        assert resp.status_code == 200
        assert resp.json()["data"]["valid"] is True
        # The key that was checked is the STORED one, decrypted server-side —
        # the caller never re-entered it.
        assert mock_test.await_args.args[1] == "sk-or-v1-stored"
        assert "fn_mark_user_api_key_verified" in _rpc_names(user_sb)

    @pytest.mark.integration
    @patch("backend.services.forge_draft_service.ForgeDraftService.test_provider_key", new_callable=AsyncMock)
    @patch("backend.services.forge_draft_service.get_admin_supabase_client", new_callable=AsyncMock)
    def test_recheck_without_a_stored_key_stamps_nothing(
        self, mock_admin, mock_test, regular_client_full, encryption_key
    ):
        """Nothing on file is not a failure — and must not touch the stamp."""
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = True

        keys_client = _mock_supabase()
        keys_client.rpc_data["fn_get_user_api_keys"] = {}
        mock_admin.return_value = keys_client

        resp = client.post("/api/v1/forge/byok/recheck/openrouter")

        assert resp.status_code == 200
        body = resp.json()["data"]
        assert body["had_key"] is False
        assert body["valid"] is False
        mock_test.assert_not_awaited()
        assert "fn_mark_user_api_key_verified" not in _rpc_names(user_sb)

    @pytest.mark.integration
    def test_asking_for_access_is_open_to_the_not_yet_allowed(self, regular_client_full):
        """The request endpoint must NOT sit behind the permission it asks for.

        Every account on production is in exactly this state — policy
        `per_user`, nobody granted — so a gate here would make the endpoint
        reachable only by people who no longer need it.
        """
        client, user_sb, admin_sb = regular_client_full
        admin_sb.rpc_data["fn_user_byok_allowed"] = False
        chain = user_sb.table.return_value
        result = MagicMock()
        result.data = [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "user_id": str(USER_ID),
                "reason": "I pay for my own calls.",
                "status": "pending",
                "created_at": "2026-09-02T12:00:00+00:00",
                "reviewed_at": None,
            }
        ]
        chain.execute = AsyncMock(return_value=result)

        resp = client.post("/api/v1/forge/byok/request", json={"reason": "I pay for my own calls."})

        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pending"

    @pytest.mark.integration
    def test_wallet_summary_agrees_with_what_the_write_endpoint_accepts(self, architect_client):
        """The form the UI hides behind ``byok_allowed`` must not lie to the admin.

        The summary RPC evaluates the policy alone; the admin override lives in
        Python. If only the write endpoint knew about it, an admin would be
        allowed to save into a form that never renders.
        """
        client, _, admin_sb = architect_client
        admin_sb.rpc_data["fn_get_wallet_summary"] = {
            "forge_tokens": 0,
            "is_architect": True,
            "account_tier": "architect",
            "byok_status": {
                "has_openrouter_key": False,
                "has_replicate_key": False,
                "byok_allowed": False,
                "byok_bypass": False,
                "system_bypass_enabled": False,
                "effective_bypass": False,
                "access_policy": "per_user",
            },
        }

        resp = client.get("/api/v1/forge/wallet")

        assert resp.status_code == 200
        assert resp.json()["data"]["byok_status"]["byok_allowed"] is True


# ══════════════════════════════════════════════════════════════════════════
# 4. Drafts
# ══════════════════════════════════════════════════════════════════════════


class TestForgeDrafts:
    """Draft CRUD endpoints."""

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "list_drafts", new_callable=AsyncMock)
    def test_list_drafts_returns_paginated(self, mock_list, architect_client):
        """GET /forge/drafts returns paginated draft list."""
        mock_list.return_value = ([], 0)
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/drafts")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 0
        assert body["meta"]["limit"] == 10

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "list_drafts", new_callable=AsyncMock)
    def test_list_drafts_respects_pagination_params(self, mock_list, architect_client):
        """GET /forge/drafts?limit=5&offset=10 passes params correctly."""
        mock_list.return_value = ([], 25)
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/drafts?limit=5&offset=10")
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["limit"] == 5
        assert body["meta"]["offset"] == 10
        assert body["meta"]["total"] == 25

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "create_draft", new_callable=AsyncMock)
    def test_create_draft_success(self, mock_create, architect_client):
        """POST /forge/drafts creates a draft."""
        mock_create.return_value = {
            "id": str(DRAFT_ID),
            "user_id": str(USER_ID),
            "seed_prompt": "A city beneath the ice",
            "current_phase": "astrolabe",
            "status": "draft",
            "philosophical_anchor": {},
            "research_context": {},
            "taxonomies": {},
            "geography": {},
            "agents": [],
            "buildings": [],
            "ai_settings": {},
            "generation_config": {},
            "theme_config": {},
            "error_log": None,
            "created_at": "2026-04-01T00:00:00Z",
            "updated_at": "2026-04-01T00:00:00Z",
        }
        client, _, _ = architect_client
        resp = client.post(
            "/api/v1/forge/drafts",
            json={"seed_prompt": "A city beneath the ice"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(DRAFT_ID)

    @pytest.mark.integration
    def test_create_draft_rejects_short_prompt(self, architect_client):
        """POST /forge/drafts with too-short seed_prompt returns 422."""
        client, _, _ = architect_client
        resp = client.post(
            "/api/v1/forge/drafts",
            json={"seed_prompt": "ab"},
        )
        assert resp.status_code == 422

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "update_draft", new_callable=AsyncMock)
    def test_update_draft_blocks_completed_status(self, mock_update, architect_client):
        """PATCH /forge/drafts/{id} with status='completed' returns 422."""
        client, _, _ = architect_client
        resp = client.patch(
            f"/api/v1/forge/drafts/{DRAFT_ID}",
            json={"status": "completed"},
        )
        assert resp.status_code == 422
        assert "completed" in resp.json()["detail"].lower()
        # The service method should NOT have been called
        mock_update.assert_not_awaited()

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "get_draft", new_callable=AsyncMock)
    @patch.object(forge_module._draft_service, "update_draft", new_callable=AsyncMock)
    def test_update_draft_valid_phase_transition(self, mock_update, mock_get, architect_client):
        """PATCH /forge/drafts/{id} with valid phase transition succeeds."""
        mock_get.return_value = {"current_phase": "astrolabe"}
        mock_update.return_value = {
            "id": str(DRAFT_ID),
            "user_id": str(USER_ID),
            "seed_prompt": "test",
            "current_phase": "drafting",
            "status": "draft",
            "philosophical_anchor": {},
            "research_context": {},
            "taxonomies": {},
            "geography": {},
            "agents": [],
            "buildings": [],
            "ai_settings": {},
            "generation_config": {},
            "theme_config": {},
            "error_log": None,
            "created_at": "2026-04-01T00:00:00Z",
            "updated_at": "2026-04-01T00:00:00Z",
        }
        client, _, _ = architect_client
        resp = client.patch(
            f"/api/v1/forge/drafts/{DRAFT_ID}",
            json={"current_phase": "drafting"},
        )
        assert resp.status_code == 200

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "get_draft", new_callable=AsyncMock)
    @patch.object(forge_module._draft_service, "update_draft", new_callable=AsyncMock)
    def test_update_draft_invalid_phase_transition(self, mock_update, mock_get, architect_client):
        """PATCH /forge/drafts/{id} with invalid phase transition returns 422."""
        mock_get.return_value = {"current_phase": "astrolabe"}
        client, _, _ = architect_client
        resp = client.patch(
            f"/api/v1/forge/drafts/{DRAFT_ID}",
            json={"current_phase": "ignition"},  # astrolabe -> ignition is not valid
        )
        assert resp.status_code == 422
        assert "Cannot transition" in resp.json()["detail"]
        mock_update.assert_not_awaited()

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "delete_draft", new_callable=AsyncMock)
    def test_delete_draft_success(self, mock_delete, architect_client):
        """DELETE /forge/drafts/{id} removes draft."""
        mock_delete.return_value = None
        client, _, _ = architect_client
        resp = client.delete(f"/api/v1/forge/drafts/{DRAFT_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "deleted" in body["data"]["message"].lower()

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "get_draft", new_callable=AsyncMock)
    def test_get_single_draft(self, mock_get, architect_client):
        """GET /forge/drafts/{id} returns a single draft."""
        mock_get.return_value = {
            "id": str(DRAFT_ID),
            "user_id": str(USER_ID),
            "seed_prompt": "test",
            "current_phase": "astrolabe",
            "status": "draft",
            "philosophical_anchor": {},
            "research_context": {},
            "taxonomies": {},
            "geography": {},
            "agents": [],
            "buildings": [],
            "ai_settings": {},
            "generation_config": {},
            "theme_config": {},
            "error_log": None,
            "created_at": "2026-04-01T00:00:00Z",
            "updated_at": "2026-04-01T00:00:00Z",
        }
        client, _, _ = architect_client
        resp = client.get(f"/api/v1/forge/drafts/{DRAFT_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(DRAFT_ID)


# ══════════════════════════════════════════════════════════════════════════
# 5. Darkroom
# ══════════════════════════════════════════════════════════════════════════


class TestForgeDarkroom:
    """Darkroom pass purchase and image regeneration endpoints."""

    @pytest.mark.integration
    @patch("backend.routers.forge.safe_background", side_effect=lambda fn: fn)
    @patch("backend.routers.forge.ForgeThemeService.generate_variants", new_callable=AsyncMock)
    @patch("backend.routers.forge.ForgeFeatureService.purchase_feature", new_callable=AsyncMock)
    def test_purchase_darkroom_pass(self, mock_purchase, mock_gen, _mock_bg, architect_client):
        """POST /forge/simulations/{id}/darkroom purchases a pass."""
        mock_purchase.return_value = PURCHASE_ID
        client, _, _ = architect_client
        resp = client.post(f"/api/v1/forge/simulations/{SIM_ID}/darkroom")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["purchase_id"] == PURCHASE_ID
        assert body["data"]["regen_budget"] == 10
        mock_purchase.assert_awaited_once()

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeFeatureService.get_active_darkroom", new_callable=AsyncMock)
    def test_regenerate_image_no_active_pass(self, mock_darkroom, architect_client):
        """POST /forge/simulations/{id}/darkroom/regenerate/agent/{id} with no pass returns 404."""
        mock_darkroom.return_value = None
        client, _, _ = architect_client
        resp = client.post(
            f"/api/v1/forge/simulations/{SIM_ID}/darkroom/regenerate/agent/{AGENT_ID}",
            json={"prompt_override": "dramatic lighting"},
        )
        assert resp.status_code == 404
        assert "No active Darkroom pass" in resp.json()["detail"]

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeFeatureService.get_active_darkroom", new_callable=AsyncMock)
    def test_regenerate_image_budget_exhausted(self, mock_darkroom, architect_client):
        """POST /forge/simulations/{id}/darkroom/regenerate/agent/{id} with budget=0 returns 400."""
        mock_darkroom.return_value = {
            "id": PURCHASE_ID,
            "regen_budget_remaining": 0,
        }
        client, _, _ = architect_client
        resp = client.post(
            f"/api/v1/forge/simulations/{SIM_ID}/darkroom/regenerate/agent/{AGENT_ID}",
            json={"prompt_override": None},
        )
        assert resp.status_code == 400
        assert "budget exhausted" in resp.json()["detail"].lower()

    @pytest.mark.integration
    @patch("backend.routers.forge.safe_background", side_effect=lambda fn: fn)
    @patch("backend.routers.forge.ForgeFeatureService.use_darkroom_regen", new_callable=AsyncMock)
    @patch("backend.routers.forge.ForgeFeatureService.get_active_darkroom", new_callable=AsyncMock)
    @patch.object(forge_module._orchestrator_service, "regenerate_single_image", new_callable=AsyncMock)
    def test_regenerate_image_success(self, mock_regen, mock_darkroom, mock_use, _mock_bg, architect_client):
        """POST /forge/simulations/{id}/darkroom/regenerate/agent/{id} with budget remaining succeeds."""
        mock_darkroom.return_value = {
            "id": PURCHASE_ID,
            "regen_budget_remaining": 5,
        }
        mock_use.return_value = 4
        mock_regen.return_value = None
        client, _, _ = architect_client
        resp = client.post(
            f"/api/v1/forge/simulations/{SIM_ID}/darkroom/regenerate/agent/{AGENT_ID}",
            json={"prompt_override": "cyberpunk neon"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["remaining_regenerations"] == 4
        assert body["data"]["entity_type"] == "agent"
        assert body["data"]["entity_id"] == str(AGENT_ID)

    @pytest.mark.integration
    def test_regenerate_invalid_entity_type(self, architect_client):
        """POST /forge/simulations/{id}/darkroom/regenerate/invalid/{id} returns 422."""
        client, _, _ = architect_client
        resp = client.post(
            f"/api/v1/forge/simulations/{SIM_ID}/darkroom/regenerate/invalid/{AGENT_ID}",
            json={"prompt_override": None},
        )
        assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════
# 6. Admin
# ══════════════════════════════════════════════════════════════════════════


class TestForgeAdmin:
    """Admin-only endpoints (require platform admin)."""

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "get_admin_stats", new_callable=AsyncMock)
    def test_admin_stats_returns_data(self, mock_stats, architect_client):
        """GET /forge/admin/stats returns admin statistics."""
        mock_stats.return_value = {
            "active_drafts": 3,
            "total_tokens": 1500,
            "total_materialized": 7,
        }
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/admin/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["active_drafts"] == 3
        assert body["data"]["total_tokens"] == 1500
        assert body["data"]["total_materialized"] == 7

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.admin_grant_tokens", new_callable=AsyncMock)
    def test_admin_grant_tokens(self, mock_grant, architect_client):
        """POST /forge/admin/grant grants tokens to a user."""
        target_user = uuid4()
        mock_grant.return_value = {
            "purchase_id": str(uuid4()),
            "bundle_slug": "admin_grant",
            "tokens_granted": 200,
            "balance_before": 50,
            "balance_after": 250,
            "price_cents": 0,
        }
        client, _, _ = architect_client
        resp = client.post(
            "/api/v1/forge/admin/grant",
            json={"user_id": str(target_user), "tokens": 200, "reason": "playtest reward"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["tokens_granted"] == 200

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.admin_update_bundle", new_callable=AsyncMock)
    def test_admin_update_bundle(self, mock_update, architect_client):
        """PUT /forge/admin/bundles/{id} updates a bundle."""
        mock_update.return_value = {
            "id": str(BUNDLE_ID),
            "slug": "starter",
            "display_name": "Starter Plus",
            "tokens": 150,
            "price_cents": 599,
            "savings_pct": 10,
            "sort_order": 1,
            "is_active": True,
        }
        client, _, _ = architect_client
        resp = client.put(
            f"/api/v1/forge/admin/bundles/{BUNDLE_ID}",
            json={"display_name": "Starter Plus", "tokens": 150},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["display_name"] == "Starter Plus"

    @pytest.mark.integration
    def test_admin_update_bundle_empty_body_rejected(self, architect_client):
        """PUT /forge/admin/bundles/{id} with no updateable fields returns 422."""
        client, _, _ = architect_client
        # All fields are None/optional in AdminBundleUpdate, so an empty object
        # passes Pydantic but the router checks for empty updates
        resp = client.put(
            f"/api/v1/forge/admin/bundles/{BUNDLE_ID}",
            json={},
        )
        assert resp.status_code == 422
        assert "No fields to update" in resp.json()["detail"]

    @pytest.mark.integration
    @patch.object(forge_module._draft_service, "purge_stale_drafts", new_callable=AsyncMock)
    def test_admin_purge_stale_drafts(self, mock_purge, architect_client):
        """DELETE /forge/admin/purge removes stale drafts."""
        mock_purge.return_value = 5
        client, _, _ = architect_client
        resp = client.delete("/api/v1/forge/admin/purge?days=60")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["deleted_count"] == 5

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.get_token_economy_stats", new_callable=AsyncMock)
    def test_admin_economy_stats(self, mock_economy, architect_client):
        """GET /forge/admin/economy returns token economy stats."""
        mock_economy.return_value = {
            "total_purchases": 42,
            "mock_purchases": 40,
            "admin_grants": 2,
            "total_revenue_cents": 19900,
            "total_tokens_granted": 4200,
            "tokens_in_circulation": 3100,
            "unique_buyers": 15,
            "active_bundles": 3,
        }
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/admin/economy")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["total_purchases"] == 42

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.admin_list_all_bundles", new_callable=AsyncMock)
    def test_admin_list_all_bundles(self, mock_list, architect_client):
        """GET /forge/admin/bundles returns all bundles including inactive."""
        mock_list.return_value = [
            {
                "id": str(BUNDLE_ID),
                "slug": "retired",
                "display_name": "Retired Pack",
                "tokens": 50,
                "price_cents": 199,
                "savings_pct": 0,
                "sort_order": 99,
                "is_active": False,
            },
        ]
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/admin/bundles")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["is_active"] is False

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.admin_list_purchases", new_callable=AsyncMock)
    def test_admin_list_purchases(self, mock_purchases, architect_client):
        """GET /forge/admin/purchases returns paginated purchase ledger."""
        mock_purchases.return_value = ([], 0)
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/admin/purchases")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 0

    @pytest.mark.integration
    def test_non_admin_rejected_from_all_admin_endpoints(self, regular_client):
        """All /forge/admin/* endpoints return 403 for non-admins."""
        endpoints = [
            ("GET", "/api/v1/forge/admin/stats"),
            ("GET", "/api/v1/forge/admin/economy"),
            ("GET", "/api/v1/forge/admin/bundles"),
            ("GET", "/api/v1/forge/admin/purchases"),
            ("GET", "/api/v1/forge/admin/byok-setting"),
            ("DELETE", "/api/v1/forge/admin/purge?days=30"),
            ("POST", "/api/v1/forge/admin/grant"),
        ]
        for method, url in endpoints:
            if method == "GET":
                resp = regular_client.get(url)
            elif method == "POST":
                resp = regular_client.post(
                    url,
                    json={"user_id": str(uuid4()), "tokens": 10, "reason": "test"},
                )
            elif method == "DELETE":
                resp = regular_client.delete(url)
            else:
                continue
            assert resp.status_code == 403, f"{method} {url} should return 403, got {resp.status_code}"

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.get_byok_system_settings", new_callable=AsyncMock)
    def test_admin_get_byok_settings(self, mock_settings, architect_client):
        """GET /forge/admin/byok-setting returns system BYOK settings."""
        mock_settings.return_value = {
            "byok_bypass_enabled": False,
            "byok_access_policy": "per_user",
        }
        client, _, _ = architect_client
        resp = client.get("/api/v1/forge/admin/byok-setting")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["byok_access_policy"] == "per_user"

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.update_byok_bypass_setting", new_callable=AsyncMock)
    def test_admin_toggle_byok_system_setting(self, mock_toggle, architect_client):
        """PUT /forge/admin/byok-setting toggles system BYOK bypass."""
        mock_toggle.return_value = {
            "byok_bypass_enabled": True,
            "byok_access_policy": "per_user",
        }
        client, _, _ = architect_client
        resp = client.put("/api/v1/forge/admin/byok-setting?enabled=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["byok_bypass_enabled"] is True

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.update_user_byok_bypass", new_callable=AsyncMock)
    def test_admin_user_byok_bypass(self, mock_bypass, architect_client):
        """PUT /forge/admin/user-byok-bypass/{id} sets per-user BYOK bypass."""
        target_user = uuid4()
        mock_bypass.return_value = {
            "user_id": str(target_user),
            "byok_bypass": True,
            "byok_allowed": None,
        }
        client, _, _ = architect_client
        resp = client.put(f"/api/v1/forge/admin/user-byok-bypass/{target_user}?enabled=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["byok_bypass"] is True

    @pytest.mark.integration
    @patch("backend.routers.forge.ForgeDraftService.update_user_byok_allowed", new_callable=AsyncMock)
    def test_admin_user_byok_allowed(self, mock_allowed, architect_client):
        """PUT /forge/admin/user-byok-allowed/{id} grants/revokes BYOK access."""
        target_user = uuid4()
        mock_allowed.return_value = {
            "user_id": str(target_user),
            "byok_bypass": None,
            "byok_allowed": True,
        }
        client, _, _ = architect_client
        resp = client.put(f"/api/v1/forge/admin/user-byok-allowed/{target_user}?enabled=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["byok_allowed"] is True
