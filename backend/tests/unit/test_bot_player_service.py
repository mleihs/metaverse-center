"""Unit tests for BotPlayerService — CRUD operations for bot player presets."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.services.bot_player_service import BotPlayerService

# ── Helpers ────────────────────────────────────────────────────

USER_ID = uuid4()
OTHER_USER_ID = uuid4()
BOT_ID = uuid4()


def _make_chain(**overrides):
    """Create a mock Supabase query chain."""
    c = MagicMock()
    c.select.return_value = c
    c.eq.return_value = c
    c.single.return_value = c
    c.order.return_value = c
    c.insert.return_value = c
    c.update.return_value = c
    c.delete.return_value = c
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def _make_bot_data(
    bot_id: UUID | None = None,
    name: str = "Sentinel Prime",
    personality: str = "sentinel",
    difficulty: str = "medium",
    user_id: UUID | None = None,
) -> dict:
    return {
        "id": str(bot_id or BOT_ID),
        "name": name,
        "personality": personality,
        "difficulty": difficulty,
        "created_by_id": str(user_id or USER_ID),
        "created_at": "2026-03-01T12:00:00Z",
        "updated_at": "2026-03-01T12:00:00Z",
    }


# ── List ───────────────────────────────────────────────────────


class TestListForUser:
    @pytest.mark.asyncio
    async def test_returns_user_bots(self):
        bots = [
            _make_bot_data(name="Bot A"),
            _make_bot_data(bot_id=uuid4(), name="Bot B"),
        ]
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=bots, count=2))
        sb.table.return_value = chain

        data, count = await BotPlayerService.list_for_user(sb, USER_ID)

        assert len(data) == 2
        assert count == 2
        sb.table.assert_called_once_with("bot_players")

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_bots(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
        sb.table.return_value = chain

        data, count = await BotPlayerService.list_for_user(sb, USER_ID)

        assert data == []
        assert count == 0

    @pytest.mark.asyncio
    async def test_returns_empty_for_none_data(self):
        """Handles None data response gracefully."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None, count=None))
        sb.table.return_value = chain

        data, count = await BotPlayerService.list_for_user(sb, USER_ID)

        assert data == []
        assert count == 0

    @pytest.mark.asyncio
    async def test_filters_by_user_id(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
        sb.table.return_value = chain

        await BotPlayerService.list_for_user(sb, USER_ID)

        # Verify eq was called with created_by_id
        chain.eq.assert_called_once_with("created_by_id", str(USER_ID))

    @pytest.mark.asyncio
    async def test_orders_by_created_at_desc(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
        sb.table.return_value = chain

        await BotPlayerService.list_for_user(sb, USER_ID)

        chain.order.assert_called_once_with("created_at", desc=True)


# ── Get ────────────────────────────────────────────────────────


class TestGet:
    @pytest.mark.asyncio
    async def test_returns_bot_data(self):
        bot = _make_bot_data()
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=bot))
        sb.table.return_value = chain

        result = await BotPlayerService.get(sb, BOT_ID)

        assert result["name"] == "Sentinel Prime"
        assert result["personality"] == "sentinel"

    @pytest.mark.asyncio
    async def test_raises_404_when_not_found(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.get(sb, BOT_ID)
        assert exc.value.status_code == 404
        assert "not found" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_queries_correct_table_and_id(self):
        bot = _make_bot_data()
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=bot))
        sb.table.return_value = chain

        await BotPlayerService.get(sb, BOT_ID)

        sb.table.assert_called_once_with("bot_players")
        chain.eq.assert_called_once_with("id", str(BOT_ID))


# ── Create ─────────────────────────────────────────────────────


class TestCreate:
    @pytest.mark.asyncio
    async def test_creates_bot_with_user_id(self):
        bot = _make_bot_data()
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[bot]))
        sb.table.return_value = chain

        result = await BotPlayerService.create(
            sb, USER_ID, {"name": "Sentinel Prime", "personality": "sentinel", "difficulty": "medium"},
        )

        assert result["name"] == "Sentinel Prime"
        # Verify created_by_id was set
        insert_call = chain.insert.call_args[0][0]
        assert insert_call["created_by_id"] == str(USER_ID)

    @pytest.mark.asyncio
    async def test_raises_500_on_failed_insert(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.create(
                sb, USER_ID, {"name": "Fail", "personality": "sentinel"},
            )
        assert exc.value.status_code == 500

    @pytest.mark.asyncio
    async def test_passes_all_data_fields(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[_make_bot_data()]))
        sb.table.return_value = chain

        data = {
            "name": "Warlord Extreme",
            "personality": "warlord",
            "difficulty": "hard",
        }
        await BotPlayerService.create(sb, USER_ID, data)

        insert_call = chain.insert.call_args[0][0]
        assert insert_call["name"] == "Warlord Extreme"
        assert insert_call["personality"] == "warlord"
        assert insert_call["difficulty"] == "hard"
        assert insert_call["created_by_id"] == str(USER_ID)


# ── Update ─────────────────────────────────────────────────────


class TestUpdate:
    @pytest.mark.asyncio
    async def test_updates_own_bot(self):
        updated_bot = _make_bot_data(name="Updated Name")
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[updated_bot]))
        sb.table.return_value = chain

        result = await BotPlayerService.update(
            sb, BOT_ID, USER_ID, {"name": "Updated Name"},
        )

        assert result["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_raises_404_for_other_users_bot(self):
        """Updating another user's bot returns 404 (RLS-style ownership check)."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[]))  # empty = not found/owned
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.update(
                sb, BOT_ID, OTHER_USER_ID, {"name": "Hijack"},
            )
        assert exc.value.status_code == 404
        assert "not owned" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_raises_400_for_empty_updates(self):
        sb = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.update(sb, BOT_ID, USER_ID, {})
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_filters_by_bot_id_and_user_id(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[_make_bot_data()]))
        sb.table.return_value = chain

        await BotPlayerService.update(sb, BOT_ID, USER_ID, {"name": "X"})

        # eq should be called twice: once for id, once for created_by_id
        eq_calls = chain.eq.call_args_list
        eq_args = [(c[0][0], c[0][1]) for c in eq_calls]
        assert ("id", str(BOT_ID)) in eq_args
        assert ("created_by_id", str(USER_ID)) in eq_args


# ── Delete ─────────────────────────────────────────────────────


class TestDelete:
    @pytest.mark.asyncio
    async def test_deletes_own_bot(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[_make_bot_data()]))
        sb.table.return_value = chain

        # Should not raise
        await BotPlayerService.delete(sb, BOT_ID, USER_ID)

        sb.table.assert_called_once_with("bot_players")

    @pytest.mark.asyncio
    async def test_raises_404_for_other_users_bot(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[]))  # not found/owned)
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.delete(sb, BOT_ID, OTHER_USER_ID)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_404_for_nonexistent_bot(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[]))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await BotPlayerService.delete(sb, uuid4(), USER_ID)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_filters_by_bot_id_and_user_id(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=[_make_bot_data()]))
        sb.table.return_value = chain

        await BotPlayerService.delete(sb, BOT_ID, USER_ID)

        eq_calls = chain.eq.call_args_list
        eq_args = [(c[0][0], c[0][1]) for c in eq_calls]
        assert ("id", str(BOT_ID)) in eq_args
        assert ("created_by_id", str(USER_ID)) in eq_args
