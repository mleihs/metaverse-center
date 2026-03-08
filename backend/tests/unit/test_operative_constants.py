"""Tests for operative type constants and the /public/operative-types endpoint."""

import pytest
from fastapi.testclient import TestClient

from backend.services.constants import (
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    OPERATIVE_TARGET_TYPE,
    OPERATIVE_TYPE_COLORS,
)

ALL_OPERATIVE_TYPES = ["spy", "saboteur", "propagandist", "assassin", "infiltrator", "guardian"]


# ── Constants integrity ───────────────────────────────────────


class TestOperativeConstants:
    def test_all_types_have_colors(self):
        for op in ALL_OPERATIVE_TYPES:
            assert op in OPERATIVE_TYPE_COLORS, f"Missing color for {op}"
            assert OPERATIVE_TYPE_COLORS[op].startswith("#")

    def test_all_types_have_rp_costs(self):
        for op in ALL_OPERATIVE_TYPES:
            assert op in OPERATIVE_RP_COSTS, f"Missing RP cost for {op}"
            assert OPERATIVE_RP_COSTS[op] > 0

    def test_all_types_have_deploy_cycles(self):
        for op in ALL_OPERATIVE_TYPES:
            assert op in OPERATIVE_DEPLOY_CYCLES, f"Missing deploy cycles for {op}"
            assert OPERATIVE_DEPLOY_CYCLES[op] >= 0

    def test_all_types_have_mission_cycles(self):
        for op in ALL_OPERATIVE_TYPES:
            assert op in OPERATIVE_MISSION_CYCLES, f"Missing mission cycles for {op}"
            assert OPERATIVE_MISSION_CYCLES[op] >= 0

    def test_all_types_have_target_type(self):
        valid_targets = {"none", "building", "zone", "agent", "embassy"}
        for op in ALL_OPERATIVE_TYPES:
            assert op in OPERATIVE_TARGET_TYPE, f"Missing target type for {op}"
            assert OPERATIVE_TARGET_TYPE[op] in valid_targets

    def test_no_extra_types_in_colors(self):
        for op in OPERATIVE_TYPE_COLORS:
            assert op in ALL_OPERATIVE_TYPES

    def test_no_extra_types_in_costs(self):
        for op in OPERATIVE_RP_COSTS:
            assert op in ALL_OPERATIVE_TYPES


# ── /public/operative-types endpoint ──────────────────────────


class TestOperativeTypesEndpoint:
    @pytest.fixture(autouse=True)
    def _client(self):
        from backend.app import app
        self.client = TestClient(app)

    def test_returns_all_operative_types(self):
        resp = self.client.get("/api/v1/public/operative-types")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True

        types = body["data"]
        returned_names = {t["type"] for t in types}
        assert returned_names == set(ALL_OPERATIVE_TYPES)

    def test_each_type_has_required_fields(self):
        resp = self.client.get("/api/v1/public/operative-types")
        types = resp.json()["data"]

        for t in types:
            assert "type" in t
            assert "cost_rp" in t
            assert "color" in t
            assert "deploy_cycles" in t
            assert "mission_cycles" in t
            assert "needs_target" in t

    def test_values_match_constants(self):
        resp = self.client.get("/api/v1/public/operative-types")
        types = resp.json()["data"]

        for t in types:
            op = t["type"]
            assert t["cost_rp"] == OPERATIVE_RP_COSTS[op]
            assert t["color"] == OPERATIVE_TYPE_COLORS[op]
            assert t["deploy_cycles"] == OPERATIVE_DEPLOY_CYCLES[op]
            assert t["mission_cycles"] == OPERATIVE_MISSION_CYCLES[op]
            assert t["needs_target"] == OPERATIVE_TARGET_TYPE[op]
