"""Tests for service-layer methods added during architecture audit.

Covers:
1. serialize_for_json() — type conversion utility
2. MemberService.get_user_memberships() — user membership retrieval
3. LocationService facade — delegation to CityService/ZoneService/StreetService
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")
MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


# ---------------------------------------------------------------------------
# serialize_for_json
# ---------------------------------------------------------------------------


class TestSerializeForJson:
    """Unit tests for serialize_for_json() utility."""

    def test_converts_datetime_to_isoformat(self):
        from backend.services.base_service import serialize_for_json

        dt = datetime(2026, 2, 25, 12, 0, 0, tzinfo=UTC)
        result = serialize_for_json({"created_at": dt})
        assert result["created_at"] == "2026-02-25T12:00:00+00:00"

    def test_converts_date_to_isoformat(self):
        from backend.services.base_service import serialize_for_json

        d = date(2026, 2, 25)
        result = serialize_for_json({"born_on": d})
        assert result["born_on"] == "2026-02-25"

    def test_converts_uuid_to_string(self):
        from backend.services.base_service import serialize_for_json

        uid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        result = serialize_for_json({"id": uid})
        assert result["id"] == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    def test_passes_through_strings(self):
        from backend.services.base_service import serialize_for_json

        result = serialize_for_json({"name": "Alpha"})
        assert result["name"] == "Alpha"

    def test_passes_through_numbers(self):
        from backend.services.base_service import serialize_for_json

        result = serialize_for_json({"level": 7, "score": 3.14})
        assert result["level"] == 7
        assert result["score"] == 3.14

    def test_passes_through_none(self):
        from backend.services.base_service import serialize_for_json

        result = serialize_for_json({"deleted_at": None})
        assert result["deleted_at"] is None

    def test_passes_through_lists(self):
        from backend.services.base_service import serialize_for_json

        result = serialize_for_json({"tags": ["a", "b"]})
        assert result["tags"] == ["a", "b"]

    def test_mixed_types(self):
        from backend.services.base_service import serialize_for_json

        uid = uuid4()
        dt = datetime(2026, 1, 1, tzinfo=UTC)
        result = serialize_for_json({
            "id": uid,
            "created_at": dt,
            "name": "Test",
            "level": 5,
            "tags": ["x"],
            "extra": None,
        })
        assert result["id"] == str(uid)
        assert isinstance(result["created_at"], str)
        assert result["name"] == "Test"
        assert result["level"] == 5
        assert result["tags"] == ["x"]
        assert result["extra"] is None


# ---------------------------------------------------------------------------
# MemberService.get_user_memberships
# ---------------------------------------------------------------------------


class TestGetUserMemberships:
    """Tests for MemberService.get_user_memberships()."""

    async def test_returns_memberships(self):
        from backend.services.member_service import MemberService

        rows = [
            {
                "simulation_id": str(uuid4()),
                "member_role": "owner",
                "simulations": {"name": "Shard Alpha", "slug": "shard-alpha"},
            },
            {
                "simulation_id": str(uuid4()),
                "member_role": "editor",
                "simulations": {"name": "Shard Beta", "slug": "shard-beta"},
            },
        ]
        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
        )
        chain.execute = AsyncMock(return_value=MagicMock(data=rows))

        result = await MemberService.get_user_memberships(mock_sb, MOCK_USER_ID)

        assert len(result) == 2
        assert result[0]["member_role"] == "owner"
        assert result[1]["simulations"]["name"] == "Shard Beta"
        # Verify correct table and select
        mock_sb.table.assert_called_once_with("simulation_members")
        mock_sb.table.return_value.select.assert_called_once_with(
            "simulation_id, member_role, simulations(name, slug)",
        )

    async def test_returns_empty_list_when_no_memberships(self):
        from backend.services.member_service import MemberService

        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
        )
        chain.execute = AsyncMock(return_value=MagicMock(data=None))

        result = await MemberService.get_user_memberships(mock_sb, MOCK_USER_ID)

        assert result == []

    async def test_filters_by_user_id(self):
        from backend.services.member_service import MemberService

        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
        )
        chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        await MemberService.get_user_memberships(mock_sb, MOCK_USER_ID)

        mock_sb.table.return_value.select.return_value.eq.assert_called_once_with(
            "user_id", str(MOCK_USER_ID),
        )


# ---------------------------------------------------------------------------
# LocationService facade
# ---------------------------------------------------------------------------


class TestLocationServiceFacade:
    """Tests for LocationService delegation to CityService/ZoneService/StreetService."""

    async def test_list_cities_delegates_to_city_service(self):
        from backend.services.location_service import LocationService

        cities = [{"id": str(uuid4()), "name": "Metropolis"}]
        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .order.return_value
        )
        chain.range.return_value.execute = AsyncMock(return_value=MagicMock(data=cities, count=1))

        data, total = await LocationService.list_cities(mock_sb, MOCK_SIM_ID)

        assert data == cities
        assert total == 1
        mock_sb.table.assert_called_once_with("cities")

    async def test_get_city_delegates_to_city_service(self):
        from backend.services.location_service import LocationService

        city_id = uuid4()
        city = {"id": str(city_id), "name": "Metropolis"}
        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .eq.return_value
            .limit.return_value
        )
        chain.execute = AsyncMock(return_value=MagicMock(data=[city]))

        result = await LocationService.get_city(mock_sb, MOCK_SIM_ID, city_id)

        assert result["name"] == "Metropolis"
        mock_sb.table.assert_called_once_with("cities")

    async def test_create_city_delegates_to_city_service(self):
        from backend.services.location_service import LocationService

        city = {"id": str(uuid4()), "name": "New City", "simulation_id": str(MOCK_SIM_ID)}
        mock_sb = MagicMock()
        mock_sb.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[city]))

        result = await LocationService.create_city(mock_sb, MOCK_SIM_ID, {"name": "New City"})

        assert result["name"] == "New City"
        mock_sb.table.assert_called_once_with("cities")
        # Verify created_by_id is NOT in insert data (supports_created_by=False)
        insert_data = mock_sb.table.return_value.insert.call_args[0][0]
        assert "created_by_id" not in insert_data

    async def test_list_zones_with_city_filter(self):
        from backend.services.location_service import LocationService

        city_id = uuid4()
        zones = [{"id": str(uuid4()), "name": "Zone A", "city_id": str(city_id)}]
        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .order.return_value
        )
        # BaseService.list applies filters then range
        chain.eq.return_value.range.return_value.execute = AsyncMock(return_value=MagicMock(data=zones, count=1))

        data, total = await LocationService.list_zones(mock_sb, MOCK_SIM_ID, city_id=city_id)

        assert data == zones
        mock_sb.table.assert_called_once_with("zones")

    async def test_list_streets_uses_city_streets_table(self):
        from backend.services.location_service import LocationService

        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .order.return_value
        )
        chain.range.return_value.execute = AsyncMock(return_value=MagicMock(data=[], count=0))

        await LocationService.list_streets(mock_sb, MOCK_SIM_ID)

        mock_sb.table.assert_called_once_with("city_streets")

    async def test_create_street_delegates_to_street_service(self):
        from backend.services.location_service import LocationService

        street = {"id": str(uuid4()), "name": "Main St"}
        mock_sb = MagicMock()
        mock_sb.table.return_value.insert.return_value.execute = AsyncMock(return_value=MagicMock(data=[street]))

        result = await LocationService.create_street(
            mock_sb, MOCK_SIM_ID, {"name": "Main St"},
        )

        assert result["name"] == "Main St"
        mock_sb.table.assert_called_once_with("city_streets")

    async def test_update_city_delegates_to_city_service(self):
        from backend.services.location_service import LocationService

        city_id = uuid4()
        updated = {"id": str(city_id), "name": "Renamed City"}
        mock_sb = MagicMock()
        chain = (
            mock_sb.table.return_value
            .update.return_value
            .eq.return_value
            .eq.return_value
        )
        chain.execute = AsyncMock(return_value=MagicMock(data=[updated]))

        result = await LocationService.update_city(
            mock_sb, MOCK_SIM_ID, city_id, {"name": "Renamed City"},
        )

        assert result["name"] == "Renamed City"
        mock_sb.table.assert_called_once_with("cities")
