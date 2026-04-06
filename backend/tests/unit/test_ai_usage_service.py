"""Unit tests for AIUsageService -- fire-and-forget AI usage tracking."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from backend.services.ai_usage_service import AIUsageService, _estimate_cost

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class TestEstimateCost:
    def test_known_openrouter_model(self):
        cost = _estimate_cost("openrouter", "deepseek/deepseek-chat", 1_000_000)
        assert cost == pytest.approx(0.14, abs=0.01)

    def test_unknown_openrouter_model_uses_default(self):
        cost = _estimate_cost("openrouter", "unknown/model-v1", 1_000_000)
        assert cost == pytest.approx(1.00, abs=0.01)

    def test_replicate_model_uses_per_call_cost(self):
        cost = _estimate_cost("replicate", "black-forest-labs/flux-dev", 0)
        assert cost == pytest.approx(0.025, abs=0.001)

    def test_replicate_flux2_pro_cost(self):
        cost = _estimate_cost("replicate", "black-forest-labs/flux.2-pro", 0)
        assert cost == pytest.approx(0.031, abs=0.001)

    def test_replicate_unknown_model_uses_default(self):
        cost = _estimate_cost("replicate", "unknown/image-model", 0)
        assert cost == pytest.approx(0.031, abs=0.001)

    def test_zero_tokens_zero_cost(self):
        cost = _estimate_cost("openrouter", "deepseek/deepseek-chat", 0)
        assert cost == 0.0


class TestAIUsageServiceLog:
    @pytest.mark.asyncio
    async def test_logs_usage_to_database(self):
        mock_sb = MagicMock()
        chain = MagicMock()
        for m in ("table", "insert"):
            getattr(mock_sb, m, MagicMock()).return_value = chain
            getattr(chain, m, MagicMock()).return_value = chain
        chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": "test"}]))
        mock_sb.table.return_value = chain

        await AIUsageService.log(
            mock_sb,
            simulation_id=SIM_ID,
            user_id=USER_ID,
            provider="openrouter",
            model="deepseek/deepseek-chat",
            purpose="chat",
            usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150, "duration_ms": 500},
        )

        mock_sb.table.assert_called_with("ai_usage_log")
        insert_call = chain.insert.call_args[0][0]
        assert insert_call["provider"] == "openrouter"
        assert insert_call["model"] == "deepseek/deepseek-chat"
        assert insert_call["prompt_tokens"] == 100
        assert insert_call["total_tokens"] == 150
        assert insert_call["estimated_cost_usd"] > 0

    @pytest.mark.asyncio
    async def test_never_raises_on_failure(self):
        mock_sb = MagicMock()
        chain = MagicMock()
        chain.execute = AsyncMock(side_effect=Exception("DB down"))
        mock_sb.table.return_value = chain
        chain.insert.return_value = chain

        # Should NOT raise
        await AIUsageService.log(
            mock_sb,
            provider="openrouter",
            model="test",
            purpose="test",
        )

    @pytest.mark.asyncio
    async def test_handles_none_usage(self):
        mock_sb = MagicMock()
        chain = MagicMock()
        chain.execute = AsyncMock(return_value=MagicMock(data=[]))
        mock_sb.table.return_value = chain
        chain.insert.return_value = chain

        await AIUsageService.log(
            mock_sb,
            provider="replicate",
            model="black-forest-labs/flux-dev",
            purpose="portrait",
            usage=None,
        )

        insert_call = chain.insert.call_args[0][0]
        assert insert_call["prompt_tokens"] == 0
        assert insert_call["total_tokens"] == 0
        assert insert_call["estimated_cost_usd"] > 0  # Replicate per-call cost
