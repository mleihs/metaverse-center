"""Tests for WorldMapService — the merge logic that the router tests can't see.

Router tests patch the entire service. These tests exercise the assembly:
  * Status / deleted / not-found guards
  * Template-vs-Instance geometry-version resolution (bug fix scope —
    Game-Instances inherit the Template's version because their own
    `map_geometry_version` is permanently 0)
  * Stability overlay merge
  * Theme-hint projection
  * Agent-marker filtering for agents without `lives_at` relations
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from backend.services.world_map_service import WorldMapService

# ── Constants ────────────────────────────────────────────────────────────

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
TEMPLATE_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ZONE_ID_A = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
ZONE_ID_B = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
BUILDING_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
AGENT_ID = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
ORPHAN_AGENT_ID = UUID("99999999-9999-9999-9999-999999999999")
UNNAMED_PROF_AGENT_ID = UUID("88888888-8888-8888-8888-888888888888")

MSD_PATH = "backend.services.world_map_service.maybe_single_data"


# ── Helpers ──────────────────────────────────────────────────────────────


def _sim_row(
    *,
    sim_id: UUID = SIM_ID,
    source_template_id: UUID | None = None,
    status: str = "active",
    deleted_at: str | None = None,
    map_geometry_version: int = 0,
    slug: str = "velgarien",
) -> dict:
    return {
        "id": str(sim_id),
        "slug": slug,
        "source_template_id": str(source_template_id) if source_template_id else None,
        "simulation_type": "game_instance" if source_template_id else "template",
        "map_geometry_version": map_geometry_version,
        "status": status,
        "deleted_at": deleted_at,
    }


def _setup_service_mocks(
    monkeypatch,
    *,
    sim: dict | None = None,
    cities=(),
    zones=(),
    streets=(),
    buildings=(),
    relations=(),
    agents=(),
    stability=(),
    theme_settings: dict | None = None,
    geometry_version: int | None = None,
) -> AsyncMock:
    """Patch maybe_single_data + every WorldMapService fetch helper.

    Returns the maybe_single_data mock so individual tests can assert call
    counts when relevant. The geometry_version helper is patched separately
    (its own internal logic is covered by TestResolveGeometryVersion).
    """
    msd = AsyncMock(return_value=sim)
    monkeypatch.setattr(MSD_PATH, msd)

    monkeypatch.setattr(WorldMapService, "_fetch_cities", AsyncMock(return_value=list(cities)))
    monkeypatch.setattr(WorldMapService, "_fetch_zones", AsyncMock(return_value=list(zones)))
    monkeypatch.setattr(WorldMapService, "_fetch_streets", AsyncMock(return_value=list(streets)))
    monkeypatch.setattr(WorldMapService, "_fetch_buildings", AsyncMock(return_value=list(buildings)))
    monkeypatch.setattr(
        WorldMapService,
        "_fetch_lives_at_relations",
        AsyncMock(return_value=list(relations)),
    )
    monkeypatch.setattr(WorldMapService, "_fetch_agents", AsyncMock(return_value=list(agents)))
    monkeypatch.setattr(
        WorldMapService,
        "_fetch_zone_stability",
        AsyncMock(return_value=list(stability)),
    )
    monkeypatch.setattr(
        WorldMapService,
        "_fetch_theme_settings",
        AsyncMock(return_value=dict(theme_settings or {})),
    )

    if geometry_version is None:
        geometry_version = int((sim or {}).get("map_geometry_version") or 0)
    monkeypatch.setattr(
        WorldMapService,
        "_resolve_geometry_version",
        AsyncMock(return_value=int(geometry_version)),
    )
    return msd


# ── Status guard ────────────────────────────────────────────────────────


class TestStatusGuard:
    @pytest.mark.asyncio
    async def test_returns_none_when_sim_not_found(self):
        with patch(MSD_PATH, new_callable=AsyncMock) as mock_msd:
            mock_msd.return_value = None
            result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_inactive(self):
        with patch(MSD_PATH, new_callable=AsyncMock) as mock_msd:
            mock_msd.return_value = _sim_row(status="completed")
            result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_soft_deleted(self):
        with patch(MSD_PATH, new_callable=AsyncMock) as mock_msd:
            mock_msd.return_value = _sim_row(deleted_at="2026-05-10T12:00:00Z")
            result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is None


# ── Geometry-version resolution (the Game-Instance bug-fix scope) ───────


class TestResolveGeometryVersion:
    @pytest.mark.asyncio
    async def test_template_returns_own_version(self):
        sim = _sim_row(map_geometry_version=5)
        version = await WorldMapService._resolve_geometry_version(MagicMock(), sim, SIM_ID)
        assert version == 5

    @pytest.mark.asyncio
    async def test_template_with_null_version_returns_zero(self):
        sim = _sim_row(map_geometry_version=0)
        sim["map_geometry_version"] = None  # simulate fresh-DB null
        version = await WorldMapService._resolve_geometry_version(MagicMock(), sim, SIM_ID)
        assert version == 0

    @pytest.mark.asyncio
    async def test_instance_fetches_template_version(self):
        sim = _sim_row(source_template_id=TEMPLATE_ID, map_geometry_version=0)
        with patch(MSD_PATH, new_callable=AsyncMock) as mock_msd:
            mock_msd.return_value = {"map_geometry_version": 7}
            version = await WorldMapService._resolve_geometry_version(
                MagicMock(),
                sim,
                TEMPLATE_ID,
            )
        assert version == 7
        mock_msd.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_instance_with_missing_template_returns_zero(self):
        sim = _sim_row(source_template_id=TEMPLATE_ID, map_geometry_version=0)
        with patch(MSD_PATH, new_callable=AsyncMock) as mock_msd:
            mock_msd.return_value = None
            version = await WorldMapService._resolve_geometry_version(
                MagicMock(),
                sim,
                TEMPLATE_ID,
            )
        assert version == 0


# ── Top-level assembly ──────────────────────────────────────────────────


class TestGetPublicMap:
    @pytest.mark.asyncio
    async def test_template_payload_uses_own_version(self, monkeypatch):
        _setup_service_mocks(monkeypatch, sim=_sim_row(map_geometry_version=3))
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert result.simulation_id == SIM_ID
        assert result.geometry_source_id == SIM_ID
        assert result.is_game_instance is False
        assert result.geometry_version == 3
        assert result.simulation_slug == "velgarien"

    @pytest.mark.asyncio
    async def test_game_instance_inherits_template_geometry_version(self, monkeypatch):
        """The Phase-4 bug fix: Instance's own map_geometry_version is always 0
        (ForgeMapService refuses to bump it). The response must report the
        Template's version so ETag invalidates after Template regen.
        """
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(source_template_id=TEMPLATE_ID, map_geometry_version=0),
            geometry_version=7,
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert result.is_game_instance is True
        assert result.geometry_source_id == TEMPLATE_ID
        assert result.geometry_version == 7

    @pytest.mark.asyncio
    async def test_stability_merges_into_zones(self, monkeypatch):
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            zones=[
                {"id": str(ZONE_ID_A), "name": "Government", "zone_type": "government", "geojson": None},
                {"id": str(ZONE_ID_B), "name": "Slums", "zone_type": "slums", "geojson": None},
            ],
            stability=[
                {"zone_id": str(ZONE_ID_A), "stability": 0.71, "stability_label": "stable"},
                {"zone_id": str(ZONE_ID_B), "stability": 0.22, "stability_label": "critical"},
            ],
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        zones_by_id = {z.id: z for z in result.zones}
        assert zones_by_id[ZONE_ID_A].stability == 0.71
        assert zones_by_id[ZONE_ID_A].stability_label == "stable"
        assert zones_by_id[ZONE_ID_B].stability == 0.22
        assert zones_by_id[ZONE_ID_B].stability_label == "critical"

    @pytest.mark.asyncio
    async def test_zone_without_stability_row_has_null_overlay(self, monkeypatch):
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            zones=[{"id": str(ZONE_ID_A), "name": "Z", "zone_type": "residential", "geojson": None}],
            stability=[],  # mv_zone_stability not yet refreshed
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert result.zones[0].stability is None
        assert result.zones[0].stability_label is None

    @pytest.mark.asyncio
    async def test_theme_hints_projects_present_keys(self, monkeypatch):
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            theme_settings={
                "color_primary": "#aa0000",
                "font_heading": "serif",
                # color_surface intentionally absent
            },
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert result.theme_hints.color_primary == "#aa0000"
        assert result.theme_hints.font_heading == "serif"
        assert result.theme_hints.color_surface is None
        assert result.theme_hints.color_text is None

    @pytest.mark.asyncio
    async def test_orphan_agents_without_lives_at_are_skipped(self, monkeypatch):
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            agents=[
                {"id": str(AGENT_ID), "name": "Anchored"},
                {"id": str(ORPHAN_AGENT_ID), "name": "Orphan"},  # no lives_at row
            ],
            relations=[{"agent_id": str(AGENT_ID), "building_id": str(BUILDING_ID)}],
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert len(result.agent_markers) == 1
        assert result.agent_markers[0].agent_id == AGENT_ID
        assert result.agent_markers[0].name == "Anchored"
        assert result.agent_markers[0].home_building_id == BUILDING_ID

    @pytest.mark.asyncio
    async def test_agent_marker_carries_profession(self, monkeypatch):
        """`primary_profession[_de]` from the agents fetch flows onto the marker;
        an agent row missing the columns yields NULL profession (no KeyError)."""
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            agents=[
                {
                    "id": str(AGENT_ID),
                    "name": "Tide Clerk Vel",
                    "primary_profession": "Tide Clerk",
                    "primary_profession_de": "Gezeitenschreiber",
                },
                {"id": str(UNNAMED_PROF_AGENT_ID), "name": "No-Profession Ren"},
            ],
            relations=[
                {"agent_id": str(AGENT_ID), "building_id": str(BUILDING_ID)},
                {"agent_id": str(UNNAMED_PROF_AGENT_ID), "building_id": str(BUILDING_ID)},
            ],
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        by_id = {m.agent_id: m for m in result.agent_markers}
        assert by_id[AGENT_ID].profession == "Tide Clerk"
        assert by_id[AGENT_ID].profession_de == "Gezeitenschreiber"
        assert by_id[UNNAMED_PROF_AGENT_ID].profession is None
        assert by_id[UNNAMED_PROF_AGENT_ID].profession_de is None

    @pytest.mark.asyncio
    async def test_lives_at_for_unknown_agent_is_skipped(self, monkeypatch):
        """Defensive: a `lives_at` relation pointing at a deleted agent
        (gone from the agents fetch) shouldn't crash assembly."""
        _setup_service_mocks(
            monkeypatch,
            sim=_sim_row(),
            agents=[],
            relations=[{"agent_id": str(AGENT_ID), "building_id": str(BUILDING_ID)}],
        )
        result = await WorldMapService.get_public_map(MagicMock(), SIM_ID)
        assert result is not None
        assert result.agent_markers == []
