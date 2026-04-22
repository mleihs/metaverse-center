"""Unit tests for InsightService and parse_insight_response.

LLM call is mocked at the ``OpenRouterService.generate`` seam. The
downstream ``ConstellationService.prepare_crystallization`` and
``commit_crystallization`` calls are also mocked so tests stay
independent of the DB integration (which has its own live-DB smoke
coverage in test_constellation_service's companion script).
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import httpx
import pytest

from backend.models.journal import ConstellationResponse, FragmentResponse
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import (
    CreditExhaustedError,
    OpenRouterError,
)
from backend.services.journal.insight_service import (
    InsightBlockedError,
    InsightGenerationError,
    InsightService,
    build_insight_user_prompt,
    parse_insight_response,
)
from backend.services.journal.resonance_detector import ResonanceMatch, ResonanceType


USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _frag(tags: list[str]) -> FragmentResponse:
    return FragmentResponse(
        id=uuid4(),
        user_id=USER_ID,
        simulation_id=uuid4(),
        fragment_type="imprint",
        source_type="dungeon",
        source_id=uuid4(),
        content_de="DE content",
        content_en="EN content",
        thematic_tags=tags,
        rarity="common",
        created_at=datetime.now(UTC),
    )


def _match() -> ResonanceMatch:
    return ResonanceMatch(
        resonance_type=ResonanceType.ARCHETYPE,
        evidence_tags=("shadow",),
    )


def _constellation(cid: UUID) -> ConstellationResponse:
    now = datetime.now(UTC)
    return ConstellationResponse(
        id=cid, user_id=USER_ID, status="crystallized",
        insight_de="DE insight", insight_en="EN insight",
        resonance_type="archetype",
        created_at=now, updated_at=now, crystallized_at=now,
        fragments=[],
    )


# ── parse_insight_response ──────────────────────────────────────────────


def test_parse_insight_valid():
    raw = '{"content_de": "Wer am Rand zögert ...", "content_en": "Who hesitates ..."}'
    result = parse_insight_response(raw)
    assert result is not None
    assert result["content_de"].startswith("Wer am Rand")
    assert result["content_en"].startswith("Who hesitates")


def test_parse_insight_strips_markdown_fences():
    raw = '```json\n{"content_de": "A", "content_en": "B"}\n```'
    result = parse_insight_response(raw)
    assert result == {"content_de": "A", "content_en": "B"}


def test_parse_insight_rejects_missing_keys():
    assert parse_insight_response('{"content_de": "x"}') is None
    assert parse_insight_response('{"content_en": "x"}') is None


def test_parse_insight_rejects_empty_strings():
    """Empty strings would pass the NOT NULL CHECK on
    journal_constellations but violate the feature's contract — the
    insight must be human-readable."""
    assert parse_insight_response('{"content_de": "", "content_en": "X"}') is None
    assert parse_insight_response('{"content_de": "X", "content_en": " "}') is None


def test_parse_insight_rejects_malformed_json():
    assert parse_insight_response("not json at all") is None
    assert parse_insight_response("") is None


def test_parse_insight_rejects_non_object():
    assert parse_insight_response('["array","instead"]') is None
    assert parse_insight_response('"string"') is None


# ── build_insight_user_prompt ───────────────────────────────────────────


def test_prompt_contains_resonance_type():
    prompt = build_insight_user_prompt([_frag(["shadow"])], _match())
    assert "archetype" in prompt
    assert "shadow" in prompt


def test_prompt_truncates_at_cap():
    """More than 12 fragments should trim to 12 — deterministic order
    (created_at asc) keeps the subset stable across retries."""
    frags = [_frag(["shadow"]) for _ in range(20)]
    prompt = build_insight_user_prompt(frags, _match())
    # Fragments are numbered 1..12 in the prompt body.
    assert "Fragment 12" in prompt
    assert "Fragment 13" not in prompt


# ── crystallize: error paths ────────────────────────────────────────────


def _budget_exhausted() -> BudgetExceededError:
    return BudgetExceededError(
        scope="user",
        scope_key=str(USER_ID),
        period="day",
        current_usd=3.0,
        max_usd=3.0,
    )


@pytest.mark.asyncio
async def test_crystallize_raises_on_budget_exhausted():
    cid = uuid4()
    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(side_effect=_budget_exhausted())
        with pytest.raises(InsightBlockedError) as excinfo:
            await InsightService.crystallize(
                supabase=MagicMock(), admin=MagicMock(),
                user_id=USER_ID, constellation_id=cid,
            )
        assert "budget" in str(excinfo.value)


@pytest.mark.asyncio
async def test_crystallize_raises_on_credit_exhausted():
    cid = uuid4()
    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(
            side_effect=CreditExhaustedError("402"),
        )
        with pytest.raises(InsightBlockedError) as excinfo:
            await InsightService.crystallize(
                supabase=MagicMock(), admin=MagicMock(),
                user_id=USER_ID, constellation_id=cid,
            )
        assert "credit" in str(excinfo.value)


@pytest.mark.asyncio
async def test_crystallize_raises_on_transient_llm_error():
    cid = uuid4()
    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(
            side_effect=httpx.ReadTimeout("timeout"),
        )
        with pytest.raises(InsightGenerationError):
            await InsightService.crystallize(
                supabase=MagicMock(), admin=MagicMock(),
                user_id=USER_ID, constellation_id=cid,
            )


@pytest.mark.asyncio
async def test_crystallize_server_error_on_unparseable():
    cid = uuid4()
    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(return_value="not json")
        # server_error raises HTTPException; check for that type.
        with pytest.raises(Exception) as excinfo:
            await InsightService.crystallize(
                supabase=MagicMock(), admin=MagicMock(),
                user_id=USER_ID, constellation_id=cid,
            )
        # server_error maps to HTTPException with status 500; either
        # way the body mentions the parse/unparse issue.
        msg = str(excinfo.value).lower()
        assert "unparseable" in msg or "parse" in msg or "insight" in msg


# ── crystallize: happy path ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crystallize_happy_path_commits():
    cid = uuid4()
    committed = _constellation(cid)

    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.ConstellationService.commit_crystallization",
        new=AsyncMock(return_value=committed),
    ) as mock_commit, patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(
            return_value='{"content_de": "Wer am Rand zögert, lernt nichts vom gewagten Schritt.", "content_en": "Who hesitates at the threshold learns nothing from the step taken."}',
        )
        result = await InsightService.crystallize(
            supabase=MagicMock(), admin=MagicMock(),
            user_id=USER_ID, constellation_id=cid,
        )
        assert result is committed
        mock_commit.assert_awaited_once()
        kwargs = mock_commit.await_args.kwargs
        assert kwargs["insight_en"].startswith("Who hesitates")
        assert kwargs["insight_de"].startswith("Wer am Rand")
        assert kwargs["match"].resonance_type is ResonanceType.ARCHETYPE
        # Attunement deferred to P3.
        assert kwargs["attunement_id"] is None
