"""Tests for output_repair — lightweight OutputFixingParser replacement."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import BaseModel

from backend.services.external.output_repair import repair_json_output


class SampleOutput(BaseModel):
    """Sample Pydantic model for testing repair."""

    title: str
    description: str
    score: int


@pytest.fixture()
def mock_openrouter():
    """Create a mock OpenRouterService."""
    return MagicMock()


class TestRepairJsonOutput:
    """Tests for repair_json_output()."""

    async def test_valid_json_returns_immediately(self, mock_openrouter):
        """Valid JSON should be returned without calling LLM."""
        valid = '{"title": "Test", "description": "Desc", "score": 5}'
        result = await repair_json_output(
            mock_openrouter, "test-model", valid, SampleOutput,
        )

        assert result is not None
        assert result["title"] == "Test"
        assert result["score"] == 5
        # LLM should NOT have been called
        mock_openrouter.generate.assert_not_called()

    async def test_malformed_json_triggers_llm_repair(self, mock_openrouter):
        """Malformed JSON should trigger an LLM call to repair it."""
        malformed = '{"title": "Test", "description": "Desc", "score": 5'  # Missing closing brace

        # Mock LLM returns fixed JSON
        mock_openrouter.generate = AsyncMock(
            return_value='{"title": "Test", "description": "Desc", "score": 5}',
        )

        result = await repair_json_output(
            mock_openrouter, "test-model", malformed, SampleOutput,
        )

        assert result is not None
        assert result["title"] == "Test"
        assert result["score"] == 5
        mock_openrouter.generate.assert_called_once()

    async def test_llm_returns_fenced_json(self, mock_openrouter):
        """LLM repair output with markdown fences should be handled."""
        malformed = "not json at all"

        mock_openrouter.generate = AsyncMock(
            return_value='```json\n{"title": "Fixed", "description": "D", "score": 1}\n```',
        )

        result = await repair_json_output(
            mock_openrouter, "test-model", malformed, SampleOutput,
        )

        assert result is not None
        assert result["title"] == "Fixed"

    async def test_llm_repair_fails_returns_none(self, mock_openrouter):
        """If LLM repair also fails, return None."""
        malformed = "totally broken"

        mock_openrouter.generate = AsyncMock(return_value="still broken")

        result = await repair_json_output(
            mock_openrouter, "test-model", malformed, SampleOutput,
        )

        assert result is None

    async def test_llm_exception_returns_none(self, mock_openrouter):
        """If LLM call raises an exception, return None gracefully."""
        malformed = "broken json"

        mock_openrouter.generate = AsyncMock(side_effect=Exception("API Error"))

        result = await repair_json_output(
            mock_openrouter, "test-model", malformed, SampleOutput,
        )

        assert result is None

    async def test_schema_included_in_repair_prompt(self, mock_openrouter):
        """The repair prompt should include the Pydantic model's JSON schema."""
        malformed = "bad json"

        mock_openrouter.generate = AsyncMock(return_value="{}")

        await repair_json_output(
            mock_openrouter, "test-model", malformed, SampleOutput,
        )

        # Check the prompt sent to the LLM
        call_args = mock_openrouter.generate.call_args
        messages = call_args.kwargs.get("messages") or call_args[1].get("messages")
        prompt_content = messages[0]["content"]

        # Should contain schema keywords from SampleOutput
        assert "title" in prompt_content
        assert "description" in prompt_content
        assert "score" in prompt_content
        assert "Schema" in prompt_content
