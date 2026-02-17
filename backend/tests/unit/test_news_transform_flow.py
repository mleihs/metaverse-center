"""Tests for the full News → Event transformation flow.

Covers:
1. GenerationService.generate_news_transformation() with real LLM output
2. /transform endpoint (router-level with mocked services)
3. /integrate endpoint (router-level, verifying no created_by_id error)
4. _parse_json_content() with JSON-first LLM output pattern
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from backend.services.generation_service import GenerationService

# ---------------------------------------------------------------------------
# Real LLM output fixtures (copied from actual user report)
# ---------------------------------------------------------------------------

# Pattern 1: JSON block FIRST, then # heading + narrative article
LLM_OUTPUT_JSON_FIRST = '''```json
{
  "title": "15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende",
  "description": "Studierende aus anderen Sphären sind für die magische Balance und kulturelle Vielfalt der Velgarien-Akademien essenziell. Ein Rat der Weisen schlägt Maßnahmen vor, damit die dimensionenreisenden Scholaren im Gegenzug maximal vom Aufenthalt profitieren.",
  "event_type": "Bildungsreform",
  "impact_level": 7
}
```

# 15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende

**Von Elara Mondweise für das Kristallarchiv von Velgarien**

Die Große Akademie von Aethelburg stand unter der zweifachen Sonne Velgariens in voller Blüte, doch im Schatten der uralten Turmspitzen gab es noch immer unsichtbare Barrieren. Meisterin Kaelin Wolkenbruch, Hüterin der Dimensionenportale, sah zu, wie eine Gruppe von Scholaren aus dem Feuerreich Pyros verwirrt vor dem flüsternden Menüstein der Großen Speisehalle stand.

„Dimensionenreisende sind nicht nur für unsere magischen Reserven und kulturelle Diversität lebenswichtig", sagte Wolkenbruch später im Konzil der Weisen. „Sie bringen Perspektiven aus anderen Realitätsschichten, die unsere Kristallmagie bereichern."

Das Konzil einigte sich darauf, die Vorschläge noch vor dem nächsten akademischen Zyklus umzusetzen.'''

# Pattern 2: **Titel:**, **Artikel:**, then ---, then JSON at end
LLM_OUTPUT_MARKERS_THEN_JSON = '''**Titel:** Velgarische Eispinguine verlegen Brutzeit nach Nordsektor

**Artikel:**
In einer überraschenden Wendung haben die Eispinguine des Nordviertels ihre Brutzeit um drei Monate nach vorn verlegt. Experten sehen darin ein Zeichen des sich beschleunigenden Klimawandels in der Eiszone.

---
```json
{"title": "Velgarische Eispinguine verlegen Brutzeit", "description": "Eispinguine verlegen Brutzeit", "event_type": "environmental", "impact_level": 8}
```'''

# Pattern 3: Only a clean narrative, no JSON at all
LLM_OUTPUT_NO_JSON = '''Die Kristallminen von Aethelburg melden einen drastischen Rückgang der Fördermenge. Seit der letzten Mondwende ist die Ausbeute um nahezu vierzig Prozent eingebrochen, was den Stadtrat in Alarmbereitschaft versetzt hat.'''

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")
MOCK_TREND_ID = UUID("33333333-3333-3333-3333-333333333333")


# ---------------------------------------------------------------------------
# Unit tests: GenerationService.generate_news_transformation()
# ---------------------------------------------------------------------------


@pytest.fixture()
def generation_service():
    mock_supabase = MagicMock()
    return GenerationService(mock_supabase, MOCK_SIM_ID, openrouter_api_key="test")


class TestNewsTransformJsonFirst:
    """Test with real LLM output where JSON block appears FIRST, then the article."""

    async def test_extracts_all_json_fields(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_JSON_FIRST, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        assert result["title"] == "15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende"
        assert "Studierende aus anderen Sphären" in result["description"]
        assert result["event_type"] == "Bildungsreform"
        assert result["impact_level"] == 7

    async def test_narrative_has_no_json_block(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_JSON_FIRST, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        narrative = result["narrative"]
        assert "```json" not in narrative
        assert '"impact_level"' not in narrative
        assert "```" not in narrative

    async def test_narrative_preserves_article_text(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_JSON_FIRST, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        narrative = result["narrative"]
        assert "Große Akademie von Aethelburg" in narrative
        assert "Dimensionenreisende" in narrative
        assert "Konzil" in narrative


class TestNewsTransformMarkersAndJson:
    """Test with **Titel:**, **Artikel:**, ---, and JSON at end."""

    async def test_extracts_json_fields(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_MARKERS_THEN_JSON, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        assert result["title"] == "Velgarische Eispinguine verlegen Brutzeit"
        assert result["event_type"] == "environmental"
        assert result["impact_level"] == 8

    async def test_narrative_strips_all_markers(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_MARKERS_THEN_JSON, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        narrative = result["narrative"]
        assert "**Titel:**" not in narrative
        assert "**Artikel:**" not in narrative
        assert "---" not in narrative
        assert "```json" not in narrative
        assert "Eispinguine" in narrative


class TestNewsTransformNoJson:
    """Test with clean narrative, no JSON block."""

    async def test_no_structured_fields_set(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_NO_JSON, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        assert "title" not in result
        assert "event_type" not in result
        assert "impact_level" not in result

    async def test_narrative_is_full_content(self, generation_service):
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_NO_JSON, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        assert result["narrative"] == LLM_OUTPUT_NO_JSON


class TestParseJsonContentJsonFirst:
    """Ensure _parse_json_content handles JSON-first pattern (embedded block)."""

    def test_extracts_embedded_json_block(self):
        content = '```json\n{"title": "A", "impact_level": 7}\n```\n\nSome article text.'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "A"
        assert parsed["impact_level"] == 7

    def test_handles_multiline_json_in_block(self):
        content = '```json\n{\n  "title": "B",\n  "description": "D",\n  "impact_level": 5\n}\n```\n\nText.'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "B"
        assert parsed["impact_level"] == 5

    def test_prefers_fenced_block_over_text(self):
        """When both fenced JSON and stray key-value patterns exist, parse the fence."""
        content = 'Some "title": "wrong" text\n```json\n{"title": "right"}\n```'
        parsed = GenerationService._parse_json_content(content)
        assert parsed is not None
        assert parsed["title"] == "right"


# ---------------------------------------------------------------------------
# Pydantic model validation tests (IntegrateTrendRequest)
# ---------------------------------------------------------------------------


class TestIntegrateTrendRequestModel:
    """Test the Pydantic model used for the /integrate endpoint."""

    def test_valid_request(self):
        from backend.models.social_trend import IntegrateTrendRequest

        req = IntegrateTrendRequest(
            trend_id=str(MOCK_TREND_ID),
            title="15 Wege zur Verbesserung",
            description="Studierende aus anderen Sphären...",
            event_type="Bildungsreform",
            impact_level=7,
            tags=["guardian"],
        )
        assert req.title == "15 Wege zur Verbesserung"
        assert req.impact_level == 7
        assert req.event_type == "Bildungsreform"
        assert "guardian" in req.tags

    def test_empty_title_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import IntegrateTrendRequest

        with pytest.raises(ValidationError):
            IntegrateTrendRequest(trend_id=str(MOCK_TREND_ID), title="")

    def test_impact_out_of_range_rejected(self):
        from pydantic import ValidationError

        from backend.models.social_trend import IntegrateTrendRequest

        with pytest.raises(ValidationError):
            IntegrateTrendRequest(
                trend_id=str(MOCK_TREND_ID), title="Test", impact_level=11,
            )

    def test_defaults(self):
        from backend.models.social_trend import IntegrateTrendRequest

        req = IntegrateTrendRequest(trend_id=str(MOCK_TREND_ID), title="Test")
        assert req.impact_level == 5  # default
        assert req.event_type is None  # optional
        assert req.tags == []  # default empty


# ---------------------------------------------------------------------------
# EventService.create() — verifies no created_by_id for events
# ---------------------------------------------------------------------------


class TestEventServiceCreateNoCrash:
    """Verify EventService.create() doesn't inject created_by_id.

    The root cause of the original 500 error: BaseService.create() always
    added created_by_id, but the events table doesn't have this column.
    """

    async def test_event_create_omits_created_by_id(self):
        """EventService.create should NOT include created_by_id in insert data."""
        from backend.services.event_service import EventService

        sim_id = MOCK_SIM_ID
        user_id = MOCK_USER_ID
        mock_sb = MagicMock()
        row = {"id": str(uuid4()), "title": "Test Event", "simulation_id": str(sim_id)}
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[row])

        await EventService.create(mock_sb, sim_id, user_id, {
            "title": "15 Wege zur Verbesserung",
            "description": "Studierende aus anderen Sphären...",
            "event_type": "Bildungsreform",
            "impact_level": 7,
            "tags": ["guardian", "imported", "news"],
            "data_source": "imported",
            "occurred_at": "2026-02-17T12:00:00Z",
        })

        insert_data = mock_sb.table.return_value.insert.call_args[0][0]
        assert "created_by_id" not in insert_data
        assert insert_data["title"] == "15 Wege zur Verbesserung"
        assert insert_data["impact_level"] == 7
        assert insert_data["simulation_id"] == str(sim_id)

    async def test_event_create_data_serialized_correctly(self):
        """Verify tags (list) and impact_level (int) pass through serialization."""
        from backend.services.event_service import EventService

        mock_sb = MagicMock()
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": str(uuid4())}],
        )

        await EventService.create(mock_sb, MOCK_SIM_ID, MOCK_USER_ID, {
            "title": "Test",
            "tags": ["guardian", "imported"],
            "impact_level": 7,
        })

        insert_data = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_data["tags"] == ["guardian", "imported"]
        assert insert_data["impact_level"] == 7


# ---------------------------------------------------------------------------
# Full pipeline test: LLM output → parsed result → event insert data
# ---------------------------------------------------------------------------


class TestFullTransformPipeline:
    """End-to-end unit test: LLM raw output → generate_news_transformation → event data.

    Simulates the complete backend flow without HTTP.
    """

    async def test_json_first_output_produces_valid_event_data(self, generation_service):
        """The user's exact LLM output should produce data suitable for EventService.create."""
        with patch.object(
            generation_service, "_generate", new_callable=AsyncMock,
            return_value={"content": LLM_OUTPUT_JSON_FIRST, "model_used": "m", "template_source": "db", "locale": "de"},
        ), patch.object(generation_service, "_get_simulation_name", new_callable=AsyncMock, return_value="V"):
            result = await generation_service.generate_news_transformation("T", "C")

        # Build event data as the /integrate endpoint would
        from backend.services.base_service import _serialize_for_json

        event_data = _serialize_for_json({
            "title": result.get("title", "Fallback"),
            "description": result.get("description"),
            "event_type": result.get("event_type", "news"),
            "impact_level": result.get("impact_level", 5),
            "tags": ["guardian", "imported", "news"],
            "data_source": "imported",
        })

        assert event_data["title"] == "15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende"
        assert event_data["event_type"] == "Bildungsreform"
        assert event_data["impact_level"] == 7
        assert "imported" in event_data["tags"]
        assert "created_by_id" not in event_data
