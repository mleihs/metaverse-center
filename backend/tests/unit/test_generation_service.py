"""Tests for GenerationService — JSON parsing and news transformation cleanup."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.generation_service import GenerationService

# ---------------------------------------------------------------------------
# _parse_json_content (static, no mocks needed)
# ---------------------------------------------------------------------------


class TestParseJsonContent:
    """Tests for GenerationService._parse_json_content()."""

    def test_pure_json(self):
        content = '{"title": "Event X", "description": "Something happened", "impact_level": 7}'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "Event X"
        assert parsed["description"] == "Something happened"
        assert parsed["impact_level"] == 7

    def test_json_with_markdown_fences(self):
        content = '```json\n{"title": "Event X", "event_type": "political"}\n```'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "Event X"
        assert parsed["event_type"] == "political"

    def test_json_with_fences_no_language(self):
        content = '```\n{"title": "Event Y"}\n```'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "Event Y"

    def test_truncated_json_field_extraction(self):
        """Truncated JSON falls back to regex field extraction."""
        content = '{"title": "Truncated Event", "description": "Desc here"'
        parsed = GenerationService._parse_json_content(content)
        # _extract_json_fields should pick up fields from truncated JSON
        assert parsed is not None
        assert parsed["title"] == "Truncated Event"

    def test_no_json_returns_none(self):
        content = "This is just a plain text narrative with no JSON at all."
        parsed = GenerationService._parse_json_content(content)
        assert parsed is None

    def test_empty_string_returns_none(self):
        parsed = GenerationService._parse_json_content("")
        assert parsed is None

    def test_json_with_escaped_quotes(self):
        content = '{"title": "The \\"Grand\\" Event", "description": "Desc"}'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert "Grand" in parsed["title"]

    def test_json_with_newlines_in_value(self):
        content = '{"title": "Event", "description": "Line 1\\nLine 2"}'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert "Line 1" in parsed["description"]


# ---------------------------------------------------------------------------
# _extract_json_fields (static, no mocks needed)
# ---------------------------------------------------------------------------


class TestExtractJsonFields:
    """Tests for GenerationService._extract_json_fields()."""

    def test_extracts_multiple_fields(self):
        text = '{"title": "A", "description": "B", "event_type": "political"}'
        result = GenerationService._extract_json_fields(text)
        assert result is not None
        assert result["title"] == "A"
        assert result["description"] == "B"
        assert result["event_type"] == "political"

    def test_returns_none_for_no_fields(self):
        result = GenerationService._extract_json_fields("no json here")
        assert result is None


# ---------------------------------------------------------------------------
# generate_news_transformation (async, mocks needed)
# ---------------------------------------------------------------------------

# Realistic LLM output samples

LLM_OUTPUT_FULL = """\
**Titel:** Velgarische Eispinguine verlegen Brutzeit nach Nordsektor

**Artikel:**
In einer überraschenden Wendung haben die Eispinguine des Nordviertels \
ihre Brutzeit um drei Monate nach vorn verlegt. Experten sehen darin ein \
Zeichen des sich beschleunigenden Klimawandels in der Eiszone.

---
```json
{"title": "Velgarische Eispinguine verlegen Brutzeit nach Nordsektor", \
"description": "Eispinguine im Nordviertel verlegen Brutzeit — Klimawandel-Signal", \
"event_type": "environmental", "impact_level": 8}
```"""

LLM_OUTPUT_NO_JSON = """\
**Titel:** Ein Ereignis ohne JSON

**Artikel:**
Hier steht nur Text ohne JSON-Block."""

LLM_OUTPUT_ONLY_JSON = """\
```json
{"title": "Pure JSON Event", "description": "Desc", "event_type": "news", "impact_level": 5}
```"""


@pytest.fixture()
def generation_service():
    """Create a GenerationService with mocked dependencies."""
    mock_supabase = MagicMock()
    sim_id = uuid4()
    svc = GenerationService(mock_supabase, sim_id, openrouter_api_key="test-key")
    return svc


class TestGenerateNewsTransformation:
    """Tests for generate_news_transformation() — JSON parsing + narrative cleanup."""

    async def test_extracts_json_fields_from_full_output(self, generation_service):
        """LLM output with **Titel:**, narrative, ---, and JSON block."""
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": LLM_OUTPUT_FULL,
                "model_used": "test-model",
                "template_source": "db",
                "locale": "de",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content"
            )

        # JSON fields extracted
        assert result["title"] == "Velgarische Eispinguine verlegen Brutzeit nach Nordsektor"
        assert result["event_type"] == "environmental"
        assert result["impact_level"] == 8
        assert "description" in result

        # Narrative cleaned: no **Titel:**, no **Artikel:**, no ---, no JSON block
        narrative = result["narrative"]
        assert "**Titel:**" not in narrative
        assert "**Artikel:**" not in narrative
        assert "```json" not in narrative
        assert "---" not in narrative
        # Narrative keeps the actual article text
        assert "Eispinguine" in narrative

    async def test_no_json_still_returns_narrative(self, generation_service):
        """LLM output without JSON block — should still produce a clean narrative."""
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": LLM_OUTPUT_NO_JSON,
                "model_used": "test-model",
                "template_source": "db",
                "locale": "de",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content"
            )

        # No JSON fields should be set
        assert "title" not in result
        assert "event_type" not in result

        # Narrative still cleaned of markers
        narrative = result["narrative"]
        assert "**Titel:**" not in narrative
        assert "**Artikel:**" not in narrative
        assert "Hier steht nur Text" in narrative

    async def test_only_json_block(self, generation_service):
        """LLM output that is just a JSON block."""
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": LLM_OUTPUT_ONLY_JSON,
                "model_used": "test-model",
                "template_source": "db",
                "locale": "de",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content"
            )

        assert result["title"] == "Pure JSON Event"
        assert result["event_type"] == "news"
        assert result["impact_level"] == 5
        # Narrative should be empty or minimal since content was only JSON
        assert "```" not in result.get("narrative", "")

    async def test_preserves_base_fields(self, generation_service):
        """model_used, template_source, locale from _generate() are preserved."""
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": LLM_OUTPUT_FULL,
                "model_used": "openai/gpt-4o",
                "template_source": "db",
                "locale": "de",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content"
            )

        assert result["model_used"] == "openai/gpt-4o"
        assert result["template_source"] == "db"
        assert result["locale"] == "de"

    async def test_empty_content(self, generation_service):
        """Empty LLM response should not crash."""
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": "",
                "model_used": "test-model",
                "template_source": "db",
                "locale": "de",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content"
            )

        assert result["narrative"] == ""
        assert "title" not in result

    async def test_english_markers_stripped(self, generation_service):
        """English **Title:** and **Article:** markers are also stripped."""
        content = "**Title:** English Event Title\n\n**Article:**\nSome article text."
        with patch.object(
            generation_service,
            "_generate",
            new_callable=AsyncMock,
            return_value={
                "content": content,
                "model_used": "test-model",
                "template_source": "db",
                "locale": "en",
            },
        ), patch.object(
            generation_service,
            "_get_simulation_name",
            new_callable=AsyncMock,
            return_value="Velgarien",
        ):
            result = await generation_service.generate_news_transformation(
                "Test News", "Test content", locale="en"
            )

        narrative = result["narrative"]
        assert "**Title:**" not in narrative
        assert "**Article:**" not in narrative
        assert "Some article text" in narrative
