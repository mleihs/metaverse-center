"""Tests for EchoService and ConnectionService."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.services.connection_service import ConnectionService
from backend.services.echo_service import EchoService

SIM_A = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
EVENT_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
ECHO_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
CONN_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")


def _mock_supabase(data=None, count=None):
    """Build a mock Supabase client with a fluent query builder."""
    mock = MagicMock()
    response = MagicMock()
    response.data = data
    response.count = count

    builder = MagicMock()
    builder.select.return_value = builder
    builder.insert.return_value = builder
    builder.update.return_value = builder
    builder.delete.return_value = builder
    builder.eq.return_value = builder
    builder.in_.return_value = builder
    builder.or_.return_value = builder
    builder.is_.return_value = builder
    builder.order.return_value = builder
    builder.range.return_value = builder
    builder.limit.return_value = builder
    builder.single.return_value = builder
    builder.execute.return_value = response

    mock.table.return_value = builder
    return mock, builder, response


# ═══════════════════════════════════════════════════════════════════════
# EchoService
# ═══════════════════════════════════════════════════════════════════════


class TestEchoListForSimulation:
    @pytest.mark.asyncio
    async def test_incoming_echoes(self):
        rows = [{"id": str(ECHO_ID), "status": "pending"}]
        mock, builder, _ = _mock_supabase(data=rows, count=1)

        data, total = await EchoService.list_for_simulation(
            mock, SIM_A, direction="incoming",
        )
        assert data == rows
        assert total == 1
        # Should filter on target_simulation_id for incoming
        builder.eq.assert_any_call("target_simulation_id", str(SIM_A))

    @pytest.mark.asyncio
    async def test_outgoing_echoes(self):
        mock, builder, _ = _mock_supabase(data=[], count=0)

        await EchoService.list_for_simulation(mock, SIM_A, direction="outgoing")
        builder.eq.assert_any_call("source_simulation_id", str(SIM_A))

    @pytest.mark.asyncio
    async def test_status_filter_applied(self):
        mock, builder, _ = _mock_supabase(data=[], count=0)

        await EchoService.list_for_simulation(
            mock, SIM_A, status_filter="pending",
        )
        builder.eq.assert_any_call("status", "pending")

    @pytest.mark.asyncio
    async def test_pagination(self):
        mock, builder, _ = _mock_supabase(data=[], count=0)

        await EchoService.list_for_simulation(
            mock, SIM_A, limit=10, offset=5,
        )
        builder.range.assert_called_once_with(5, 14)

    @pytest.mark.asyncio
    async def test_total_fallback_when_count_none(self):
        rows = [{"id": "1"}]
        mock, _, _ = _mock_supabase(data=rows, count=None)

        _, total = await EchoService.list_for_simulation(mock, SIM_A)
        assert total == 1


class TestEchoListForEvent:
    @pytest.mark.asyncio
    async def test_returns_echoes_for_event(self):
        rows = [{"id": str(ECHO_ID), "source_event_id": str(EVENT_ID)}]
        mock, builder, _ = _mock_supabase(data=rows)

        result = await EchoService.list_for_event(mock, EVENT_ID)
        assert result == rows
        builder.eq.assert_any_call("source_event_id", str(EVENT_ID))

    @pytest.mark.asyncio
    async def test_returns_empty_list(self):
        mock, _, _ = _mock_supabase(data=[])
        result = await EchoService.list_for_event(mock, EVENT_ID)
        assert result == []

    @pytest.mark.asyncio
    async def test_handles_none_data(self):
        mock, _, _ = _mock_supabase(data=None)
        result = await EchoService.list_for_event(mock, EVENT_ID)
        assert result == []


class TestEchoGet:
    @pytest.mark.asyncio
    async def test_returns_echo(self):
        echo_data = {"id": str(ECHO_ID), "status": "pending"}
        mock, _, _ = _mock_supabase(data=echo_data)

        result = await EchoService.get(mock, ECHO_ID)
        assert result == echo_data

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, _, _ = _mock_supabase(data=None)

        with pytest.raises(HTTPException) as exc:
            await EchoService.get(mock, ECHO_ID)
        assert exc.value.status_code == 404


class TestEvaluateEchoCandidates:
    """Core bleed mechanics — candidate evaluation logic."""

    def _make_event(self, impact=9, data_source=None, external_refs=None, campaign_id=None):
        event = {
            "id": str(EVENT_ID),
            "title": "Test Event",
            "impact_level": impact,
        }
        if data_source:
            event["data_source"] = data_source
        if external_refs:
            event["external_refs"] = external_refs
        if campaign_id:
            event["campaign_id"] = campaign_id
        return event

    def _multi_table_supabase(
        self,
        settings_data=None,
        connections_data=None,
        health_data=None,
        embassy_data=None,
    ):
        """Create a supabase mock that returns different data per table."""
        mock = MagicMock()
        table_data = {
            "simulation_settings": settings_data or [],
            "simulation_connections": connections_data or [],
            "mv_simulation_health": health_data or [],
            "mv_embassy_effectiveness": embassy_data or [],
        }

        def make_table(name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.in_.return_value = b
            b.or_.return_value = b
            b.order.return_value = b
            b.limit.return_value = b
            r = MagicMock()
            r.data = table_data.get(name, [])
            b.execute.return_value = r
            return b

        mock.table.side_effect = make_table
        return mock

    @pytest.mark.asyncio
    async def test_low_impact_returns_empty(self):
        """Events with impact < 1 are never candidates."""
        event = self._make_event(impact=0)
        mock = self._multi_table_supabase()

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_below_min_impact_threshold(self):
        """Events below bleed_min_impact setting are rejected."""
        event = self._make_event(impact=5)
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "8"},
        ]
        mock = self._multi_table_supabase(settings_data=settings)

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_bleed_disabled_returns_empty(self):
        """When bleed_enabled is False, no candidates."""
        event = self._make_event(impact=10)
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": False},
        ]
        mock = self._multi_table_supabase(settings_data=settings)

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_campaign_events_need_higher_impact(self):
        """Campaign events add +1 to the min_impact threshold."""
        event = self._make_event(impact=8, campaign_id=str(uuid4()))
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "8"},
        ]
        # Impact == min_impact, but +1 for campaign means 8 < 9 → rejected
        mock = self._multi_table_supabase(settings_data=settings)

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_cascade_depth_check(self):
        """Bleed events exceeding max depth are rejected."""
        event = self._make_event(
            impact=10,
            data_source="bleed",
            external_refs={"echo_depth": 2},
        )
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "5"},
            {"setting_key": "bleed_max_depth", "setting_value": "2"},
        ]
        mock = self._multi_table_supabase(settings_data=settings)

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_no_connections_returns_empty(self):
        """When there are no active connections, no candidates."""
        event = self._make_event(impact=10)
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "5"},
        ]
        mock = self._multi_table_supabase(settings_data=settings, connections_data=[])

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_candidates_for_valid_event(self):
        """Happy path: event meets all criteria, returns candidates with strength."""
        event = self._make_event(impact=10)
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "5"},
            {"setting_key": "bleed_strength_decay", "setting_value": "0.6"},
        ]
        connections = [
            {
                "simulation_a_id": str(SIM_A),
                "simulation_b_id": str(SIM_B),
                "is_active": True,
                "strength": 0.5,
                "bleed_vectors": ["resonance"],
            },
        ]
        mock = self._multi_table_supabase(
            settings_data=settings, connections_data=connections,
        )

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert len(result) == 1
        assert result[0]["target_simulation_id"] == str(SIM_B)
        assert result[0]["depth"] == 1
        assert result[0]["echo_vector"] == "resonance"
        assert 0.0 < result[0]["echo_strength"] <= 1.0

    @pytest.mark.asyncio
    async def test_reverse_connection_direction(self):
        """Agent is simulation_b in the connection — target is simulation_a."""
        event = self._make_event(impact=10)
        settings = [
            {"setting_key": "bleed_enabled", "setting_value": True},
            {"setting_key": "bleed_min_impact", "setting_value": "5"},
            {"setting_key": "bleed_strength_decay", "setting_value": "0.6"},
        ]
        connections = [
            {
                "simulation_a_id": str(SIM_B),
                "simulation_b_id": str(SIM_A),
                "is_active": True,
                "strength": 0.5,
                "bleed_vectors": ["memory"],
            },
        ]
        mock = self._multi_table_supabase(
            settings_data=settings, connections_data=connections,
        )

        result = await EchoService.evaluate_echo_candidates(mock, event, SIM_A)
        assert len(result) == 1
        assert result[0]["target_simulation_id"] == str(SIM_B)
        assert result[0]["echo_vector"] == "memory"


class TestComputeEchoStrength:
    """Tests for the echo strength computation formula."""

    def test_base_case(self):
        """Connection strength alone, no bonuses."""
        s = EchoService.compute_echo_strength(
            connection_strength=0.5, echo_depth=1, strength_decay=0.6,
        )
        # 0.5 * 1.0 (no embassy) * 1.0 (no tags) * 0.6^1 * 1.0 (no instability)
        assert abs(s - 0.3) < 0.01

    def test_embassy_boost(self):
        """High embassy effectiveness increases strength."""
        s = EchoService.compute_echo_strength(
            connection_strength=0.5, embassy_effectiveness=1.0,
            echo_depth=1, strength_decay=0.6,
        )
        # 0.5 * 1.3 (embassy) * 1.0 * 0.6 * 1.0 = 0.39
        assert abs(s - 0.39) < 0.01

    def test_tag_resonance_boost(self):
        """Matching tags boost strength by 20% per tag (max 3)."""
        s = EchoService.compute_echo_strength(
            connection_strength=0.5, tag_resonance_count=2,
            echo_depth=1, strength_decay=0.6,
        )
        # 0.5 * 1.0 * 1.4 (2 tags) * 0.6 * 1.0 = 0.42
        assert abs(s - 0.42) < 0.01

    def test_tag_resonance_capped_at_3(self):
        """More than 3 matching tags doesn't increase beyond cap."""
        s3 = EchoService.compute_echo_strength(
            connection_strength=0.5, tag_resonance_count=3,
            echo_depth=1, strength_decay=0.6,
        )
        s5 = EchoService.compute_echo_strength(
            connection_strength=0.5, tag_resonance_count=5,
            echo_depth=1, strength_decay=0.6,
        )
        assert s3 == s5

    def test_depth_decay(self):
        """Each depth level applies decay exponentially."""
        s1 = EchoService.compute_echo_strength(
            connection_strength=1.0, echo_depth=1, strength_decay=0.6,
        )
        s2 = EchoService.compute_echo_strength(
            connection_strength=1.0, echo_depth=2, strength_decay=0.6,
        )
        s3 = EchoService.compute_echo_strength(
            connection_strength=1.0, echo_depth=3, strength_decay=0.6,
        )
        # Depth 1: 0.6, Depth 2: 0.36, Depth 3: 0.216
        assert abs(s1 - 0.6) < 0.01
        assert abs(s2 - 0.36) < 0.01
        assert abs(s3 - 0.216) < 0.01

    def test_instability_boost(self):
        """Unstable source zones bleed louder."""
        s_stable = EchoService.compute_echo_strength(
            connection_strength=0.5, source_instability=0.0,
            echo_depth=1, strength_decay=0.6,
        )
        s_unstable = EchoService.compute_echo_strength(
            connection_strength=0.5, source_instability=0.8,
            echo_depth=1, strength_decay=0.6,
        )
        assert s_unstable > s_stable

    def test_clamped_to_one(self):
        """Maximum strength is 1.0 even with all boosts."""
        s = EchoService.compute_echo_strength(
            connection_strength=1.0, embassy_effectiveness=1.0,
            tag_resonance_count=3, echo_depth=1, strength_decay=1.0,
            source_instability=1.0,
        )
        assert s == 1.0


class TestTagResonance:
    """Tests for bleed vector → tag resonance matching."""

    def test_matching_tags(self):
        assert EchoService.count_tag_resonance(["trade", "economy"], "commerce") == 2

    def test_no_matching_tags(self):
        assert EchoService.count_tag_resonance(["fire", "war"], "commerce") == 0

    def test_case_insensitive(self):
        assert EchoService.count_tag_resonance(["Trade", "ECONOMY"], "commerce") == 2

    def test_empty_tags(self):
        assert EchoService.count_tag_resonance([], "commerce") == 0

    def test_unknown_vector(self):
        assert EchoService.count_tag_resonance(["trade"], "unknown_vector") == 0

    def test_dream_vector(self):
        assert EchoService.count_tag_resonance(
            ["vision", "mystical", "economic"], "dream",
        ) == 2


class TestCreateEcho:
    @pytest.mark.asyncio
    async def test_creates_echo_record(self):
        source_event = {
            "id": str(EVENT_ID),
            "title": "Big Event",
            "impact_level": 9,
        }
        created = {"id": str(ECHO_ID), "status": "pending"}
        mock, builder, _ = _mock_supabase(data=[created])

        result = await EchoService.create_echo(
            mock, source_event, SIM_A, SIM_B,
            echo_vector="resonance", echo_strength=0.8, echo_depth=1,
        )
        assert result["id"] == str(ECHO_ID)
        builder.insert.assert_called_once()
        insert_arg = builder.insert.call_args[0][0]
        assert insert_arg["source_simulation_id"] == str(SIM_A)
        assert insert_arg["target_simulation_id"] == str(SIM_B)
        assert insert_arg["echo_vector"] == "resonance"
        assert insert_arg["status"] == "pending"

    @pytest.mark.asyncio
    async def test_uses_root_event_id_when_provided(self):
        root_id = uuid4()
        source_event = {"id": str(EVENT_ID), "title": "X", "impact_level": 5}
        mock, builder, _ = _mock_supabase(data=[{"id": str(ECHO_ID)}])

        await EchoService.create_echo(
            mock, source_event, SIM_A, SIM_B,
            echo_vector="dream", echo_strength=0.5, echo_depth=2,
            root_event_id=root_id,
        )
        insert_arg = builder.insert.call_args[0][0]
        assert insert_arg["root_event_id"] == str(root_id)

    @pytest.mark.asyncio
    async def test_raises_on_failure(self):
        source_event = {"id": str(EVENT_ID), "title": "X", "impact_level": 5}
        mock, _, _ = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await EchoService.create_echo(
                mock, source_event, SIM_A, SIM_B,
                echo_vector="commerce", echo_strength=0.5, echo_depth=1,
            )
        assert exc.value.status_code == 500


class TestUpdateEchoStatus:
    @pytest.mark.asyncio
    async def test_updates_status(self):
        updated = {"id": str(ECHO_ID), "status": "generating"}
        mock, builder, _ = _mock_supabase(data=[updated])

        result = await EchoService.update_echo_status(mock, ECHO_ID, "generating")
        assert result["status"] == "generating"

    @pytest.mark.asyncio
    async def test_sets_target_event_id(self):
        target_event = uuid4()
        updated = {"id": str(ECHO_ID), "status": "completed", "target_event_id": str(target_event)}
        mock, builder, _ = _mock_supabase(data=[updated])

        await EchoService.update_echo_status(
            mock, ECHO_ID, "completed", target_event_id=target_event,
        )
        update_arg = builder.update.call_args[0][0]
        assert update_arg["target_event_id"] == str(target_event)

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, _, _ = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await EchoService.update_echo_status(mock, ECHO_ID, "completed")
        assert exc.value.status_code == 404


class TestApproveEcho:
    @pytest.mark.asyncio
    async def test_approves_pending_echo(self):
        """Pending echo transitions to 'generating'."""
        mock = MagicMock()

        # First call: get() via single()
        get_builder = MagicMock()
        get_builder.select.return_value = get_builder
        get_builder.eq.return_value = get_builder
        get_builder.single.return_value = get_builder
        get_resp = MagicMock()
        get_resp.data = {"id": str(ECHO_ID), "status": "pending"}
        get_builder.execute.return_value = get_resp

        # Second call: update()
        update_builder = MagicMock()
        update_builder.update.return_value = update_builder
        update_builder.eq.return_value = update_builder
        update_resp = MagicMock()
        update_resp.data = [{"id": str(ECHO_ID), "status": "generating"}]
        update_builder.execute.return_value = update_resp

        mock.table.side_effect = [get_builder, update_builder]

        result = await EchoService.approve_echo(mock, ECHO_ID)
        assert result["status"] == "generating"

    @pytest.mark.asyncio
    async def test_rejects_non_pending_echo(self):
        """Cannot approve an echo that is not pending."""
        mock, _, _ = _mock_supabase(data={"id": str(ECHO_ID), "status": "completed"})

        with pytest.raises(HTTPException) as exc:
            await EchoService.approve_echo(mock, ECHO_ID)
        assert exc.value.status_code == 400
        assert "completed" in str(exc.value.detail)


class TestRejectEcho:
    @pytest.mark.asyncio
    async def test_rejects_pending_echo(self):
        """Pending echo transitions to 'rejected'."""
        mock = MagicMock()

        get_builder = MagicMock()
        get_builder.select.return_value = get_builder
        get_builder.eq.return_value = get_builder
        get_builder.single.return_value = get_builder
        get_resp = MagicMock()
        get_resp.data = {"id": str(ECHO_ID), "status": "pending"}
        get_builder.execute.return_value = get_resp

        update_builder = MagicMock()
        update_builder.update.return_value = update_builder
        update_builder.eq.return_value = update_builder
        update_resp = MagicMock()
        update_resp.data = [{"id": str(ECHO_ID), "status": "rejected"}]
        update_builder.execute.return_value = update_resp

        mock.table.side_effect = [get_builder, update_builder]

        result = await EchoService.reject_echo(mock, ECHO_ID)
        assert result["status"] == "rejected"

    @pytest.mark.asyncio
    async def test_rejects_non_pending_echo(self):
        """Cannot reject an echo that is not pending."""
        mock, _, _ = _mock_supabase(data={"id": str(ECHO_ID), "status": "generating"})

        with pytest.raises(HTTPException) as exc:
            await EchoService.reject_echo(mock, ECHO_ID)
        assert exc.value.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# ConnectionService
# ═══════════════════════════════════════════════════════════════════════


class TestConnectionListAll:
    @pytest.mark.asyncio
    async def test_returns_connections(self):
        rows = [{"id": str(CONN_ID), "is_active": True}]
        mock, builder, _ = _mock_supabase(data=rows)

        result = await ConnectionService.list_all(mock, active_only=True)
        assert result == rows
        builder.eq.assert_any_call("is_active", True)

    @pytest.mark.asyncio
    async def test_returns_all_when_not_active_only(self):
        mock, builder, _ = _mock_supabase(data=[])

        await ConnectionService.list_all(mock, active_only=False)
        # eq for is_active should NOT be called
        calls = [str(c) for c in builder.eq.call_args_list]
        assert not any("is_active" in c for c in calls)


class TestConnectionGetMapData:
    @pytest.fixture(autouse=True)
    def _clear_cache(self):
        """Clear the map data TTL cache between tests."""
        ConnectionService._map_data_cache.clear()
        yield
        ConnectionService._map_data_cache.clear()

    @pytest.mark.asyncio
    async def test_returns_aggregated_data(self):
        sim = {
            "id": str(SIM_A),
            "name": "Test Sim",
            "status": "active",
            "agent_count": 5,
            "building_count": 3,
            "event_count": 10,
        }
        conn = {
            "id": str(CONN_ID),
            "simulation_a_id": str(SIM_A),
            "simulation_b_id": str(SIM_B),
        }
        echo_row = {"target_simulation_id": str(SIM_A)}

        mock = MagicMock()

        # Name-based table routing (get_map_data calls many tables)
        def make_table(name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.neq.return_value = b
            b.is_.return_value = b
            b.or_.return_value = b
            b.in_.return_value = b
            b.order.return_value = b
            b.range.return_value = b
            b.limit.return_value = b

            r = MagicMock()
            if name == "map_simulations":
                r.data = [sim]
            elif name == "simulation_connections":
                r.data = [conn]
                r.count = None
            elif name == "event_echoes":
                r.data = [echo_row]
                r.count = 1
            else:
                r.data = []
            b.execute.return_value = r
            return b

        mock.table.side_effect = make_table

        # Mock the RPC call for get_map_overlay_data
        rpc_response = MagicMock()
        rpc_response.data = {"zone_topology": {}, "historical_events": {}, "active_bleed_details": {}}
        rpc_builder = MagicMock()
        rpc_builder.execute.return_value = rpc_response
        mock.rpc.return_value = rpc_builder

        with patch("backend.services.embassy_service.EmbassyService.list_all_active", new_callable=AsyncMock, return_value=[]):
            result = await ConnectionService.get_map_data(mock)

        assert "simulations" in result
        assert "connections" in result
        assert "echo_counts" in result
        assert result["simulations"][0]["agent_count"] == 5
        assert result["echo_counts"].get(str(SIM_A)) == 1


class TestConnectionCreate:
    @pytest.mark.asyncio
    async def test_creates_connection(self):
        created = {"id": str(CONN_ID), "is_active": True}
        mock, builder, _ = _mock_supabase(data=[created])

        result = await ConnectionService.create_connection(
            mock, {"simulation_a_id": str(SIM_A), "simulation_b_id": str(SIM_B)},
        )
        assert result["id"] == str(CONN_ID)
        builder.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_on_failure(self):
        mock, _, _ = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await ConnectionService.create_connection(mock, {"simulation_a_id": str(SIM_A)})
        assert exc.value.status_code == 400


class TestConnectionUpdate:
    @pytest.mark.asyncio
    async def test_updates_connection(self):
        updated = {"id": str(CONN_ID), "strength": 0.8}
        mock, builder, _ = _mock_supabase(data=[updated])

        result = await ConnectionService.update_connection(
            mock, CONN_ID, {"strength": 0.8},
        )
        assert result["strength"] == 0.8

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, _, _ = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await ConnectionService.update_connection(mock, CONN_ID, {"strength": 0.5})
        assert exc.value.status_code == 404


class TestConnectionDelete:
    @pytest.mark.asyncio
    async def test_deletes_connection(self):
        deleted = {"id": str(CONN_ID)}
        mock, builder, _ = _mock_supabase(data=[deleted])

        result = await ConnectionService.delete_connection(mock, CONN_ID)
        assert result["id"] == str(CONN_ID)
        builder.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, _, _ = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await ConnectionService.delete_connection(mock, CONN_ID)
        assert exc.value.status_code == 404
