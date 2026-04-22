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

from backend.models.journal import (
    AttunementResponse,
    ConstellationResponse,
    FragmentResponse,
)
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import (
    CreditExhaustedError,
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
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=None),
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
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=None),
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
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=None),
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
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=None),
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


_VALID_INSIGHT_JSON = (
    '{"content_de": "Wer am Rand zögert, lernt nichts vom gewagten Schritt.", '
    '"content_en": "Who hesitates at the threshold learns nothing from the step taken."}'
)


def _mercy_attunement() -> AttunementResponse:
    """Starter Mercy attunement as AttunementService.evaluate would
    return it for an archetype-resonance match."""
    return AttunementResponse(
        id=uuid4(),
        slug="einstimmung_gnade",
        name_de="Einstimmung der Gnade",
        name_en="Mercy Attunement",
        description_de="…",
        description_en="…",
        system_hook="epoch_option",
        effect={"hook": "epoch_operative_class", "class_slug": "observer"},
        required_resonance={},
        required_resonance_type="archetype",
        enabled=True,
    )


@pytest.mark.asyncio
async def test_crystallize_happy_path_commits_with_attunement():
    """Archetype resonance → Mercy evaluates → commit carries the
    attunement FK, unlock succeeds (newly=True), the result bundles
    the newly_unlocked_attunement for the ceremony."""
    cid = uuid4()
    committed = _constellation(cid)
    mercy = _mercy_attunement()

    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.ConstellationService.commit_crystallization",
        new=AsyncMock(return_value=committed),
    ) as mock_commit, patch(
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=mercy),
    ), patch(
        "backend.services.journal.insight_service.AttunementService.unlock",
        new=AsyncMock(return_value=True),
    ) as mock_unlock, patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(return_value=_VALID_INSIGHT_JSON)
        result = await InsightService.crystallize(
            supabase=MagicMock(), admin=MagicMock(),
            user_id=USER_ID, constellation_id=cid,
        )
        assert result.constellation is committed
        assert result.newly_unlocked_attunement is mercy
        kwargs = mock_commit.await_args.kwargs
        assert kwargs["insight_en"].startswith("Who hesitates")
        assert kwargs["insight_de"].startswith("Wer am Rand")
        assert kwargs["match"].resonance_type is ResonanceType.ARCHETYPE
        assert kwargs["attunement_id"] == mercy.id
        mock_unlock.assert_awaited_once()


@pytest.mark.asyncio
async def test_crystallize_contradiction_no_attunement_match():
    """Contradiction resonance: starter set has no matching attunement
    (migration 232 comment). evaluate returns None; commit carries
    None; newly_unlocked stays None; unlock is not called."""
    cid = uuid4()
    committed = _constellation(cid)
    contradiction_match = ResonanceMatch(
        resonance_type=ResonanceType.CONTRADICTION,
        evidence_tags=("victory", "defeat"),
    )

    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["victory"]), _frag(["defeat"])], contradiction_match),
        ),
    ), patch(
        "backend.services.journal.insight_service.ConstellationService.commit_crystallization",
        new=AsyncMock(return_value=committed),
    ) as mock_commit, patch(
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=None),
    ), patch(
        "backend.services.journal.insight_service.AttunementService.unlock",
        new=AsyncMock(return_value=True),
    ) as mock_unlock, patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(return_value=_VALID_INSIGHT_JSON)
        result = await InsightService.crystallize(
            supabase=MagicMock(), admin=MagicMock(),
            user_id=USER_ID, constellation_id=cid,
        )
        assert result.newly_unlocked_attunement is None
        assert mock_commit.await_args.kwargs["attunement_id"] is None
        mock_unlock.assert_not_awaited()


@pytest.mark.asyncio
async def test_crystallize_re_unlock_leaves_newly_unlocked_none():
    """Second crystallization of the same resonance type: user already
    has the attunement; unlock returns False (no row inserted); the
    result should NOT signal newly_unlocked so the ceremony doesn't
    replay. The commit still carries the attunement FK to record this
    as a mercy-type crystallization."""
    cid = uuid4()
    committed = _constellation(cid)
    mercy = _mercy_attunement()

    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.ConstellationService.commit_crystallization",
        new=AsyncMock(return_value=committed),
    ) as mock_commit, patch(
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=mercy),
    ), patch(
        "backend.services.journal.insight_service.AttunementService.unlock",
        new=AsyncMock(return_value=False),
    ):
        fake_or_patch = patch(
            "backend.services.journal.insight_service.OpenRouterService",
        )
        with fake_or_patch as fake_or:
            fake_or.return_value.generate = AsyncMock(return_value=_VALID_INSIGHT_JSON)
            result = await InsightService.crystallize(
                supabase=MagicMock(), admin=MagicMock(),
                user_id=USER_ID, constellation_id=cid,
            )
            assert result.newly_unlocked_attunement is None
            # Commit still records the attunement FK.
            assert mock_commit.await_args.kwargs["attunement_id"] == mercy.id


@pytest.mark.asyncio
async def test_crystallize_unlock_failure_does_not_fail_crystallize():
    """Unlock-side exception (e.g. admin-client auth hiccup) is logged
    but the user still receives their crystallized constellation — a
    subsequent crystallize idempotently retries the unlock."""
    cid = uuid4()
    committed = _constellation(cid)
    mercy = _mercy_attunement()

    with patch(
        "backend.services.journal.insight_service.ConstellationService.prepare_crystallization",
        new=AsyncMock(
            return_value=(_constellation(cid), [_frag(["shadow"]), _frag(["shadow"])], _match()),
        ),
    ), patch(
        "backend.services.journal.insight_service.ConstellationService.commit_crystallization",
        new=AsyncMock(return_value=committed),
    ), patch(
        "backend.services.journal.insight_service.AttunementService.evaluate",
        new=AsyncMock(return_value=mercy),
    ), patch(
        "backend.services.journal.insight_service.AttunementService.unlock",
        new=AsyncMock(side_effect=RuntimeError("postgrest 500")),
    ), patch(
        "backend.services.journal.insight_service.OpenRouterService",
    ) as fake_or:
        fake_or.return_value.generate = AsyncMock(return_value=_VALID_INSIGHT_JSON)
        result = await InsightService.crystallize(
            supabase=MagicMock(), admin=MagicMock(),
            user_id=USER_ID, constellation_id=cid,
        )
        assert result.constellation is committed
        assert result.newly_unlocked_attunement is None
