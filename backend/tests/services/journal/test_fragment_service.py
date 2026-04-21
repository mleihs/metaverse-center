"""Unit tests for FragmentService pure-function surface.

DB-interaction tests ship in P5 (plan §10). These cover the LLM response
parser and the UUID helper — both error-prone enough to warrant isolation.
"""

from __future__ import annotations

import json
from uuid import uuid4

from backend.services.journal.fragment_service import FragmentService, _parse_uuid

# ── _parse_llm_response ──────────────────────────────────────────────────


class TestParseLLMResponseDirectJSON:
    """Happy path: model returns clean JSON, no fences or preamble."""

    def test_valid_payload(self):
        content = json.dumps(
            {
                "content_de": "Deutscher Text der einen Fragment-Moment einfängt.",
                "content_en": "English text capturing a fragment moment.",
                "thematic_tags": ["stimmung", "ruhe"],
            }
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["content_de"].startswith("Deutscher Text")
        assert result["content_en"].startswith("English text")
        assert result["thematic_tags"] == ["stimmung", "ruhe"]

    def test_tags_are_lowercased_and_trimmed(self):
        content = json.dumps(
            {
                "content_de": "a",
                "content_en": "b",
                "thematic_tags": ["  Stimmung ", "RUHE", "verlust"],
            }
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["thematic_tags"] == ["stimmung", "ruhe", "verlust"]

    def test_missing_thematic_tags_defaults_empty(self):
        content = json.dumps({"content_de": "a", "content_en": "b"})
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["thematic_tags"] == []

    def test_non_list_tags_default_empty(self):
        content = json.dumps(
            {"content_de": "a", "content_en": "b", "thematic_tags": "stimmung"}
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["thematic_tags"] == []

    def test_mixed_tag_types_filter_non_strings(self):
        content = json.dumps(
            {
                "content_de": "a",
                "content_en": "b",
                "thematic_tags": ["valid", 123, None, "", "another"],
            }
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["thematic_tags"] == ["valid", "another"]


class TestParseLLMResponseTolerance:
    """Fall-back paths: fences, preamble, postamble, partial JSON."""

    def test_markdown_json_fence(self):
        content = (
            '```json\n'
            '{"content_de": "a", "content_en": "b", "thematic_tags": []}\n'
            '```'
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["content_de"] == "a"

    def test_generic_fence_without_language(self):
        content = (
            '```\n{"content_de": "a", "content_en": "b"}\n```'
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["content_en"] == "b"

    def test_preamble_is_stripped(self):
        content = (
            "Here is the fragment:\n"
            '{"content_de": "a", "content_en": "b", "thematic_tags": []}\n'
            "Hope you like it!"
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["content_de"] == "a"


class TestParseLLMResponseValidationFailures:
    """Missing / invalid fields should return None, never partial data."""

    def test_missing_content_de(self):
        content = json.dumps({"content_en": "b", "thematic_tags": []})
        assert FragmentService._parse_llm_response(content) is None

    def test_missing_content_en(self):
        content = json.dumps({"content_de": "a", "thematic_tags": []})
        assert FragmentService._parse_llm_response(content) is None

    def test_empty_content_de(self):
        content = json.dumps({"content_de": "   ", "content_en": "b"})
        assert FragmentService._parse_llm_response(content) is None

    def test_empty_content_en(self):
        content = json.dumps({"content_de": "a", "content_en": ""})
        assert FragmentService._parse_llm_response(content) is None

    def test_non_string_content_de(self):
        content = json.dumps({"content_de": 123, "content_en": "b"})
        assert FragmentService._parse_llm_response(content) is None

    def test_non_dict_root(self):
        # Array at root, not a fragment object.
        content = json.dumps(
            [{"content_de": "a", "content_en": "b"}]
        )
        assert FragmentService._parse_llm_response(content) is None

    def test_empty_string(self):
        assert FragmentService._parse_llm_response("") is None

    def test_whitespace_only(self):
        assert FragmentService._parse_llm_response("   \n\t  ") is None

    def test_garbage(self):
        assert FragmentService._parse_llm_response("not json at all, sorry") is None

    def test_none(self):
        assert FragmentService._parse_llm_response(None) is None


class TestParseLLMResponseTrimming:
    """Whitespace around content values should be stripped but not from within."""

    def test_leading_trailing_whitespace_stripped(self):
        content = json.dumps(
            {"content_de": "\n  text  \n", "content_en": "  other  "}
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert result["content_de"] == "text"
        assert result["content_en"] == "other"

    def test_internal_whitespace_preserved(self):
        content = json.dumps(
            {
                "content_de": "Erste Zeile.\nZweite Zeile.",
                "content_en": "First line.\nSecond line.",
            }
        )
        result = FragmentService._parse_llm_response(content)
        assert result is not None
        assert "\n" in result["content_de"]
        assert "\n" in result["content_en"]


# ── _parse_uuid ──────────────────────────────────────────────────────────


class TestParseUUID:
    def test_valid_uuid_string(self):
        u = uuid4()
        assert _parse_uuid(str(u)) == u

    def test_uuid_passthrough(self):
        u = uuid4()
        # str(UUID) round-trips, so _parse_uuid(uuid) also works via str().
        assert _parse_uuid(u) == u

    def test_none_returns_none(self):
        assert _parse_uuid(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_uuid("") is None

    def test_garbage_returns_none(self):
        assert _parse_uuid("not-a-uuid") is None

    def test_integer_returns_none(self):
        assert _parse_uuid(123) is None
