"""Tests for AgentService — list_for_reaction method.

Covers:
1. Default limit (no agent_ids)
2. Specific agent_ids filtering
3. Custom select fields
4. Empty result set
5. Simulation-scoped query
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")


class TestListForReaction:
    """Tests for AgentService.list_for_reaction()."""

    async def test_default_limit_no_agent_ids(self):
        """Without agent_ids, applies default limit=20 via .limit()."""
        from backend.services.agent_service import AgentService

        agents = [
            {"id": "a1", "name": "Alpha", "character": "", "system": "rebel"},
            {"id": "a2", "name": "Beta", "character": "", "system": "state"},
        ]
        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.limit.return_value.execute = AsyncMock(return_value=MagicMock(data=agents))

        result = await AgentService.list_for_reaction(mock_sb, MOCK_SIM_ID)

        assert result == agents
        mock_sb.table.assert_called_once_with("active_agents")
        chain.limit.assert_called_once_with(20)

    async def test_custom_limit(self):
        """Respects a custom limit parameter."""
        from backend.services.agent_service import AgentService

        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.limit.return_value.execute = AsyncMock(return_value=MagicMock(data=[]))

        await AgentService.list_for_reaction(mock_sb, MOCK_SIM_ID, limit=5)

        chain.limit.assert_called_once_with(5)

    async def test_with_agent_ids(self):
        """When agent_ids provided, uses .in_() instead of .limit()."""
        from backend.services.agent_service import AgentService

        ids = ["a1", "a2"]
        agents = [
            {"id": "a1", "name": "Alpha", "character": "", "system": "rebel"},
            {"id": "a2", "name": "Beta", "character": "", "system": "state"},
        ]
        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.in_.return_value.execute = AsyncMock(return_value=MagicMock(data=agents))

        result = await AgentService.list_for_reaction(
            mock_sb, MOCK_SIM_ID, agent_ids=ids,
        )

        assert result == agents
        chain.in_.assert_called_once_with("id", ids)

    async def test_custom_select_fields(self):
        """Respects custom select parameter."""
        from backend.services.agent_service import AgentService

        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.limit.return_value.execute = AsyncMock(return_value=MagicMock(data=[]))

        await AgentService.list_for_reaction(
            mock_sb, MOCK_SIM_ID, select="id, name",
        )

        mock_sb.table.return_value.select.assert_called_once_with("id, name")

    async def test_empty_result(self):
        """Returns empty list when no agents match."""
        from backend.services.agent_service import AgentService

        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.limit.return_value.execute = AsyncMock(return_value=MagicMock(data=None))

        result = await AgentService.list_for_reaction(mock_sb, MOCK_SIM_ID)

        assert result == []

    async def test_simulation_id_scoped(self):
        """Filters by simulation_id."""
        from backend.services.agent_service import AgentService

        mock_sb = MagicMock()
        chain = mock_sb.table.return_value.select.return_value.eq.return_value
        chain.limit.return_value.execute = AsyncMock(return_value=MagicMock(data=[]))

        await AgentService.list_for_reaction(mock_sb, MOCK_SIM_ID)

        mock_sb.table.return_value.select.return_value.eq.assert_called_once_with(
            "simulation_id", str(MOCK_SIM_ID),
        )
