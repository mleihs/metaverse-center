"""Tests for EventService — generate_reactions method.

Covers:
1. Successful reaction generation (create path)
2. Reaction update when existing reaction found
3. Empty agents returns empty list
4. Partial failure — some agents fail, others succeed
5. max_agents passed through to AgentService
6. Logging verification for partial failures
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")


def _mock_supabase_for_reactions(
    existing_reactions: list[dict] | None = None,
) -> MagicMock:
    """Create a MagicMock Supabase client for event_reactions queries."""
    mock_sb = MagicMock()
    # get_reactions: table("event_reactions").select(...).eq(...).eq(...).order(...).execute()
    reaction_chain = (
        mock_sb.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .order.return_value
    )
    reaction_chain.execute = AsyncMock(return_value=MagicMock(data=existing_reactions or []))
    return mock_sb


class TestGenerateReactionsCreatePath:
    """Test reaction creation for agents without existing reactions."""

    async def test_creates_reactions_for_all_agents(self):
        from backend.services.event_service import EventService

        event_id = str(uuid4())
        agent1_id, agent2_id = str(uuid4()), str(uuid4())
        agents = [
            {"id": agent1_id, "name": "Alpha", "character": "rebel", "system": "underground"},
            {"id": agent2_id, "name": "Beta", "character": "loyalist", "system": "state"},
        ]

        mock_gen = AsyncMock()
        mock_gen.generate_agent_reaction = AsyncMock(
            side_effect=["Alpha reacts angrily", "Beta supports the event"],
        )

        reaction1 = {"id": str(uuid4()), "agent_id": agent1_id, "reaction_text": "Alpha reacts angrily"}
        reaction2 = {"id": str(uuid4()), "agent_id": agent2_id, "reaction_text": "Beta supports the event"}

        with (
            patch.object(
                EventService, "get_reactions", new_callable=AsyncMock, return_value=[],
            ),
            patch.object(
                EventService, "add_reaction", new_callable=AsyncMock,
                side_effect=[reaction1, reaction2],
            ) as mock_add,
            patch(
                "backend.services.event_service.AgentService.list_for_reaction",
                new_callable=AsyncMock, return_value=agents,
            ),
            patch(
                "backend.services.event_service.GameMechanicsService.build_generation_context",
                new_callable=AsyncMock, return_value={"simulation_health": 0.5},
            ),
        ):
            event = {"id": event_id, "title": "Crisis", "description": "A major crisis"}
            result = await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, mock_gen, max_agents=10,
            )

        assert len(result) == 2
        assert result[0]["reaction_text"] == "Alpha reacts angrily"
        assert result[1]["reaction_text"] == "Beta supports the event"
        assert mock_add.call_count == 2
        # Verify agent data was passed correctly to the AI
        call_args = mock_gen.generate_agent_reaction.call_args_list
        assert call_args[0].kwargs["agent_data"]["name"] == "Alpha"
        assert call_args[1].kwargs["agent_data"]["name"] == "Beta"


class TestGenerateReactionsUpdatePath:
    """Test reaction update when existing reactions exist."""

    async def test_updates_existing_reactions(self):
        from backend.services.event_service import EventService

        event_id = str(uuid4())
        agent_id = str(uuid4())
        reaction_id = str(uuid4())

        existing = [{"id": reaction_id, "agent_id": agent_id, "reaction_text": "old reaction"}]
        agents = [{"id": agent_id, "name": "Alpha", "character": "", "system": "rebel"}]

        mock_gen = AsyncMock()
        mock_gen.generate_agent_reaction = AsyncMock(return_value="Updated reaction text")

        updated_reaction = {"id": reaction_id, "agent_id": agent_id, "reaction_text": "Updated reaction text"}

        with (
            patch.object(
                EventService, "get_reactions", new_callable=AsyncMock, return_value=existing,
            ),
            patch.object(
                EventService, "update_reaction", new_callable=AsyncMock, return_value=updated_reaction,
            ) as mock_update,
            patch.object(
                EventService, "add_reaction", new_callable=AsyncMock,
            ) as mock_add,
            patch(
                "backend.services.event_service.AgentService.list_for_reaction",
                new_callable=AsyncMock, return_value=agents,
            ),
            patch(
                "backend.services.event_service.GameMechanicsService.build_generation_context",
                new_callable=AsyncMock, return_value={"simulation_health": 0.5},
            ),
        ):
            event = {"id": event_id, "title": "Crisis", "description": "A major crisis"}
            result = await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, mock_gen,
            )

        assert len(result) == 1
        assert result[0]["reaction_text"] == "Updated reaction text"
        mock_update.assert_called_once()
        mock_add.assert_not_called()


class TestGenerateReactionsEmptyAgents:
    """Test with no agents available."""

    async def test_returns_empty_when_no_agents(self):
        from backend.services.event_service import EventService

        with patch(
            "backend.services.event_service.AgentService.list_for_reaction",
            new_callable=AsyncMock, return_value=[],
        ):
            event = {"id": str(uuid4()), "title": "Test", "description": ""}
            result = await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, AsyncMock(),
            )

        assert result == []


class TestGenerateReactionsPartialFailure:
    """Test that partial AI failures don't crash the whole batch."""

    async def test_continues_after_individual_agent_failure(self):
        from backend.services.event_service import EventService

        event_id = str(uuid4())
        agent1_id, agent2_id = str(uuid4()), str(uuid4())
        agents = [
            {"id": agent1_id, "name": "Failing", "character": "", "system": ""},
            {"id": agent2_id, "name": "Succeeding", "character": "", "system": ""},
        ]

        mock_gen = AsyncMock()
        mock_gen.generate_agent_reaction = AsyncMock(
            side_effect=[RuntimeError("AI timeout"), "Good reaction"],
        )

        reaction = {"id": str(uuid4()), "agent_id": agent2_id, "reaction_text": "Good reaction"}

        with (
            patch.object(
                EventService, "get_reactions", new_callable=AsyncMock, return_value=[],
            ),
            patch.object(
                EventService, "add_reaction", new_callable=AsyncMock, return_value=reaction,
            ),
            patch(
                "backend.services.event_service.AgentService.list_for_reaction",
                new_callable=AsyncMock, return_value=agents,
            ),
            patch(
                "backend.services.event_service.GameMechanicsService.build_generation_context",
                new_callable=AsyncMock, return_value={"simulation_health": 0.5},
            ),
        ):
            event = {"id": event_id, "title": "Test", "description": ""}
            result = await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, mock_gen,
            )

        # Only the successful reaction should be returned
        assert len(result) == 1
        assert result[0]["reaction_text"] == "Good reaction"


class TestGenerateReactionsMaxAgents:
    """Test that max_agents is forwarded correctly."""

    async def test_passes_max_agents_to_agent_service(self):
        from backend.services.event_service import EventService

        with patch(
            "backend.services.event_service.AgentService.list_for_reaction",
            new_callable=AsyncMock, return_value=[],
        ) as mock_list:
            event = {"id": str(uuid4()), "title": "T", "description": ""}
            await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, AsyncMock(), max_agents=7,
            )

        mock_list.assert_called_once()
        assert mock_list.call_args.kwargs["limit"] == 7


class TestGenerateReactionsLogging:
    """Verify logging on partial agent reaction failures."""

    async def test_partial_failure_logs_warning_with_agent_id(self, caplog):
        from backend.services.event_service import EventService

        event_id = str(uuid4())
        failing_agent_id = str(uuid4())
        agents = [
            {"id": failing_agent_id, "name": "Failing", "character": "", "system": ""},
        ]

        mock_gen = AsyncMock()
        mock_gen.generate_agent_reaction = AsyncMock(side_effect=RuntimeError("AI timeout"))

        with (
            patch.object(
                EventService, "get_reactions", new_callable=AsyncMock, return_value=[],
            ),
            patch(
                "backend.services.event_service.AgentService.list_for_reaction",
                new_callable=AsyncMock, return_value=agents,
            ),
            patch(
                "backend.services.event_service.GameMechanicsService.build_generation_context",
                new_callable=AsyncMock, return_value={"simulation_health": 0.5},
            ),
            caplog.at_level(logging.WARNING, logger="backend.services.event_service"),
        ):
            event = {"id": event_id, "title": "Test", "description": ""}
            await EventService.generate_reactions(
                MagicMock(), MOCK_SIM_ID, event, mock_gen,
            )

        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warning_records) >= 1
        assert warning_records[0].agent_id == failing_agent_id
