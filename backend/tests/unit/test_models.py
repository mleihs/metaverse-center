from datetime import datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta
from backend.models.simulation import SimulationCreate


class TestCurrentUser:
    def test_valid_current_user(self):
        user = CurrentUser(
            id=uuid4(),
            email="test@velgarien.dev",
            access_token="token-abc-123",
        )
        assert isinstance(user.id, UUID)
        assert user.email == "test@velgarien.dev"
        assert user.access_token == "token-abc-123"

    def test_invalid_uuid_raises(self):
        with pytest.raises(ValidationError):
            CurrentUser(
                id="not-a-uuid",
                email="test@velgarien.dev",
                access_token="token",
            )

    def test_missing_email_raises(self):
        with pytest.raises(ValidationError):
            CurrentUser(
                id=uuid4(),
                access_token="token",
            )


class TestSimulationCreate:
    def test_valid_simulation_create(self):
        sim = SimulationCreate(
            name="Test Simulation",
            slug="test-simulation",
            description="A test world",
            theme="dystopian",
            content_locale="de",
            additional_locales=["en"],
        )
        assert sim.name == "Test Simulation"
        assert sim.slug == "test-simulation"
        assert sim.theme == "dystopian"
        assert sim.content_locale == "de"
        assert sim.additional_locales == ["en"]

    def test_defaults(self):
        sim = SimulationCreate(name="Minimal")
        assert sim.slug is None
        assert sim.description is None
        assert sim.theme == "custom"
        assert sim.content_locale == "en"
        assert sim.additional_locales == []

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            SimulationCreate(name="")

    def test_invalid_slug_raises(self):
        with pytest.raises(ValidationError):
            SimulationCreate(name="Test", slug="INVALID SLUG!")

    def test_slug_pattern_valid(self):
        sim = SimulationCreate(name="Test", slug="my-sim-123")
        assert sim.slug == "my-sim-123"


class TestPaginatedResponse:
    def test_paginated_response(self):
        response = PaginatedResponse[dict](
            data=[{"id": "1"}, {"id": "2"}],
            meta=PaginationMeta(count=2, total=10, limit=25, offset=0),
        )
        assert response.success is True
        assert len(response.data) == 2
        assert response.meta.count == 2
        assert response.meta.total == 10
        assert response.meta.limit == 25
        assert response.meta.offset == 0
        assert isinstance(response.timestamp, datetime)
        assert response.timestamp.tzinfo is not None

    def test_paginated_response_empty(self):
        response = PaginatedResponse[str](
            data=[],
            meta=PaginationMeta(count=0, total=0, limit=25, offset=0),
        )
        assert response.success is True
        assert response.data == []
        assert response.meta.count == 0


# ── EpochConfig ────────────────────────────────────────────────


class TestEpochConfigPhaseBudget:
    """foundation + reckoning must leave room for a competition phase.

    Before validate_phase_budget existed this was only checked in
    start_epoch() — i.e. after the lobby had filled and invitations had gone
    out. The creation wizard happily produced 1 day / 24h cycles (one cycle
    total) with foundation 1 + reckoning 2, showed "Competition 0 cycles",
    and created an epoch that could never be started.
    """

    @pytest.mark.parametrize(
        ("duration_days", "cycle_hours", "foundation", "reckoning"),
        [
            (1, 2, 1, 2),      # blitz preset
            (3, 4, 2, 3),      # sprint preset
            (14, 8, 4, 8),     # standard preset
            (28, 8, 6, 12),    # marathon preset
        ],
    )
    def test_shipped_presets_are_valid(self, duration_days, cycle_hours, foundation, reckoning):
        from backend.models.epoch import EpochConfig

        config = EpochConfig(
            duration_days=duration_days,
            cycle_hours=cycle_hours,
            foundation_cycles=foundation,
            reckoning_cycles=reckoning,
        )
        total = (duration_days * 24) // cycle_hours
        assert config.foundation_cycles + config.reckoning_cycles < total

    def test_rejects_phase_overlap(self):
        from pydantic import ValidationError

        from backend.models.epoch import EpochConfig

        with pytest.raises(ValidationError) as exc:
            # 1 day at 24h cycles == 1 cycle total; 1 + 2 does not fit.
            EpochConfig(duration_days=1, cycle_hours=24, foundation_cycles=1, reckoning_cycles=2)
        assert "Phase overlap" in str(exc.value)

    def test_rejects_exact_fit_leaving_no_competition(self):
        from pydantic import ValidationError

        from backend.models.epoch import EpochConfig

        # 1 day at 2h cycles == 12 cycles; 4 + 8 leaves zero competition cycles.
        with pytest.raises(ValidationError):
            EpochConfig(duration_days=1, cycle_hours=2, foundation_cycles=4, reckoning_cycles=8)

    def test_default_mode_stays_manual_for_existing_epochs(self):
        """The wizard sends 'activity_gated'; the default must not change.

        Epochs created before the wizard sent auto_resolve_mode carry no value
        for it, and switching the default would silently arm deadlines and AFK
        penalties on games already in progress.
        """
        from backend.models.epoch import EpochConfig

        assert EpochConfig().auto_resolve_mode == "manual"

    def test_legacy_config_keys_are_ignored(self):
        """referee_mode / min_cycle_duration_minutes were removed as dead fields.

        Live epochs still carry them in their JSONB config, so parsing must not
        break on them.
        """
        from backend.models.epoch import EpochConfig

        config = EpochConfig(**{"referee_mode": True, "min_cycle_duration_minutes": 30})
        assert not hasattr(config, "referee_mode")
        assert config.cycle_deadline_minutes == 480
