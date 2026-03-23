"""Shared fixtures for integration tests that need a live Supabase instance."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from backend.config import settings
from backend.tests.integration.game_constants import (
    SIM_GASLIT_REACH,
    SIM_SPERANZA,
    SIM_STATION_NULL,
    SIM_VELGARIEN,
)
from supabase import Client, create_client


def _supabase_available() -> bool:
    """Check if a real Supabase instance is reachable at the configured URL."""
    if not settings.supabase_anon_key:
        return False
    try:
        import httpx
        resp = httpx.get(
            f"{settings.supabase_url}/rest/v1/",
            headers={"apikey": settings.supabase_anon_key},
            timeout=2.0,
        )
        return resp.status_code < 500
    except Exception:
        return False


requires_supabase = pytest.mark.skipif(
    not _supabase_available(),
    reason="Supabase not reachable at configured URL",
)


# ── Data structures ────────────────────────────────────────────────────


@dataclass
class ParticipantFixture:
    """A participant in a test epoch."""

    participant_id: UUID
    user_id: UUID
    simulation_id: UUID
    initial_rp: int


@dataclass
class EpochFixture:
    """All IDs and config for an isolated test epoch."""

    epoch_id: UUID
    status: str
    current_cycle: int
    config: dict
    participants: list[ParticipantFixture] = field(default_factory=list)

    @property
    def simulation_ids(self) -> list[UUID]:
        """All simulation IDs in this epoch."""
        return [p.simulation_id for p in self.participants]

    @property
    def rp_per_cycle(self) -> int:
        return self.config.get("rp_per_cycle", 10)

    @property
    def rp_cap(self) -> int:
        return self.config.get("rp_cap", 40)

    def sim_id_for(self, player: UUID) -> UUID:
        """Get the game-instance simulation ID for a player."""
        for p in self.participants:
            if p.user_id == player:
                return p.simulation_id
        msg = f"Player {player} not in epoch"
        raise ValueError(msg)


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def admin_client() -> Client:
    """Real Supabase client with service_role for integration tests."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@pytest.fixture(scope="session")
def test_user_ids(admin_client: Client) -> list[UUID]:
    """Ensure 4 test auth users exist, return their IDs.

    Creates users via Supabase auth signup if they don't exist.
    Idempotent: same emails always yield same user records.
    """
    import httpx

    user_ids: list[UUID] = []
    for i in range(1, 5):
        email = f"gamedb-test-{i}@test.velgarien.dev"
        resp = httpx.post(
            f"{settings.supabase_url}/auth/v1/signup",
            json={"email": email, "password": "gamedb-test-pass-123"},
            headers={"apikey": settings.supabase_anon_key},
            timeout=5.0,
        )
        data = resp.json()
        # signup returns user on both create and "already registered"
        uid = data.get("user", data).get("id")
        if uid:
            user_ids.append(UUID(uid))
        else:
            # User exists, sign in to get ID
            resp2 = httpx.post(
                f"{settings.supabase_url}/auth/v1/token?grant_type=password",
                json={"email": email, "password": "gamedb-test-pass-123"},
                headers={"apikey": settings.supabase_anon_key},
                timeout=5.0,
            )
            data2 = resp2.json()
            user_ids.append(UUID(data2["user"]["id"]))

    return user_ids


@pytest.fixture()
def epoch_factory(admin_client: Client, test_user_ids: list[UUID]):
    """Factory that creates isolated test epochs with auto-cleanup.

    Each call inserts a fresh epoch + 4 participants (one per seed
    simulation, each with a distinct test auth user).  On teardown,
    CASCADE delete on game_epochs removes all children (participants,
    missions, scores, battle_log, fortifications).
    """
    created_ids: list[UUID] = []

    sim_ids = [SIM_VELGARIEN, SIM_GASLIT_REACH, SIM_STATION_NULL, SIM_SPERANZA]

    def create(
        *,
        status: str = "competition",
        cycle: int = 3,
        rp: int = 20,
        rp_cap: int = 40,
        rp_per_cycle: int = 10,
        cycle_hours: int = 8,
        duration_days: int = 14,
    ) -> EpochFixture:
        epoch_id = uuid4()
        config = {
            "rp_per_cycle": rp_per_cycle,
            "rp_cap": rp_cap,
            "cycle_hours": cycle_hours,
            "duration_days": duration_days,
        }
        now = datetime.now(UTC)

        admin_client.table("game_epochs").insert({
            "id": str(epoch_id),
            "name": f"Test Epoch {epoch_id.hex[:8]}",
            "status": status,
            "current_cycle": cycle,
            "config": config,
            "created_by_id": str(test_user_ids[0]),
            "starts_at": (now - timedelta(days=5)).isoformat(),
            "ends_at": (now + timedelta(days=9)).isoformat(),
        }).execute()

        participants = []
        for i, sim_id in enumerate(sim_ids):
            pid = uuid4()
            user_id = test_user_ids[i]
            admin_client.table("epoch_participants").insert({
                "id": str(pid),
                "epoch_id": str(epoch_id),
                "simulation_id": str(sim_id),
                "user_id": str(user_id),
                "current_rp": rp,
                "cycle_ready": False,
            }).execute()
            participants.append(ParticipantFixture(
                participant_id=pid,
                user_id=user_id,
                simulation_id=sim_id,
                initial_rp=rp,
            ))

        created_ids.append(epoch_id)
        return EpochFixture(
            epoch_id=epoch_id,
            status=status,
            current_cycle=cycle,
            config=config,
            participants=participants,
        )

    yield create

    # Cleanup: CASCADE delete handles all children
    for eid in created_ids:
        try:
            admin_client.table("game_epochs").delete().eq("id", str(eid)).execute()
        except Exception:  # noqa: S110
            pass  # Best-effort cleanup
