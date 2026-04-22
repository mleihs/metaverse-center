"""Constellation Insight generation (P2).

Called when a player crystallizes a constellation. The detector has
already picked the resonance type (archetype / emotional / temporal /
contradiction); this service turns the composed fragments + that type
into an Insight — a 2–4 sentence aphoristic observation that emerges
from the pattern.

Budget-enforced via ``BudgetContext(purpose='constellation_insight')``
per plan §7. Research-tier model (same tier as fragment generation).

Split from ``constellation_service`` so the CRUD layer can be tested
independently from the LLM mock, and so the hot path (place_fragment,
rename, archive) stays free of budget/LLM imports.
"""

from __future__ import annotations

import json
import logging
import re
from uuid import UUID

import httpx
import sentry_sdk

from backend.models.journal import AttunementResponse, CrystallizeResult, FragmentResponse
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import (
    BudgetContext,
    CreditExhaustedError,
    OpenRouterError,
    OpenRouterService,
)
from backend.services.journal.attunement_service import AttunementService
from backend.services.journal.constellation_service import ConstellationService
from backend.services.journal.resonance_detector import ResonanceMatch
from backend.services.platform_model_config import get_platform_model
from backend.utils.errors import server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Model purpose alias — Insight uses the same research tier as fragment
# generation (plan §7 "constellation_insight also uses 'research'").
_MODEL_PURPOSE_RESEARCH = "research"

# Temperature slightly lower than fragment generation (0.85). Insights
# are terser + pithier; we want less sprawl. Max tokens capped because
# 4 sentences + JSON wrapper never exceed ~250 tokens.
_LLM_TEMPERATURE = 0.7
_LLM_MAX_TOKENS = 350

# Cap how many fragments we send in the prompt. 12 is the canvas cap
# but we rarely need all of them for the Insight's literary weight;
# the detector already condensed the pattern into a resonance type +
# evidence tags, so we can truncate safely. Deterministic order
# (created_at asc) keeps identical inputs producing identical prompts
# — important for idempotency-retry and debug reproducibility.
_MAX_FRAGMENTS_IN_PROMPT = 12


_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)


INSIGHT_SYSTEM_PROMPT = (
    "You are the player's Resonance Journal finding its own voice. "
    "The player has placed several fragments onto the canvas, and the "
    "pattern has cohered. Your task is to write the Insight that "
    "emerges from the composition.\n\n"
    "Voice:\n"
    "- Aphoristic. Third person, present tense. Gnomic weight.\n"
    "- 2-4 sentences, never more, never fewer.\n"
    "- Do NOT summarise the fragments. Do NOT list their contents.\n"
    "- State the observation that emerges. Name what the pattern "
    "names, then let it stand.\n"
    "- Literary, specific, oblique. Never on-the-nose.\n"
    "- Use en dashes (-), not em dashes.\n"
    "- Avoid: tapestry, delve, unleash, seamlessly, holistic, "
    "multifaceted, bustling, game-changer, cutting-edge.\n"
    "- German is independently authored, not translated. Rich, idiomatic.\n\n"
    "The resonance type tells you what the fragments share:\n"
    "  archetype      — they all turn on the same archetype\n"
    "  emotional      — they share a valence the player keeps meeting\n"
    "  temporal       — they happened close enough to speak to each other\n"
    "  contradiction  — they oppose each other and both are true\n\n"
    "Return JSON only:\n"
    '{"content_de": "...", "content_en": "..."}'
)


class InsightBlockedError(Exception):
    """Budget or credit block — the caller should surface a user-visible
    'try again later' rather than retrying. The crystallize transaction
    is NOT committed."""


class InsightGenerationError(Exception):
    """Transient LLM or parse failure. Caller may retry on next request
    (draft state is preserved, not a silent data-loss path)."""


def _format_fragments_for_prompt(fragments: list[FragmentResponse]) -> str:
    """Format fragments for the user prompt. Deterministic order
    (created_at asc) — stable input is worth more here than any
    narrative ordering since the Insight is about the pattern, not
    the sequence."""
    ordered = sorted(fragments, key=lambda f: f.created_at)
    trimmed = ordered[:_MAX_FRAGMENTS_IN_PROMPT]
    lines: list[str] = []
    for i, frag in enumerate(trimmed, start=1):
        tags_str = ", ".join(frag.thematic_tags[:6]) if frag.thematic_tags else "(untagged)"
        lines.append(
            f"Fragment {i} [{frag.fragment_type}, tags: {tags_str}]:"
            f"\n  EN: {frag.content_en}"
            f"\n  DE: {frag.content_de}"
        )
    return "\n\n".join(lines)


def build_insight_user_prompt(
    fragments: list[FragmentResponse],
    match: ResonanceMatch,
) -> str:
    evidence = ", ".join(match.evidence_tags) if match.evidence_tags else "—"
    body = _format_fragments_for_prompt(fragments)
    return (
        f"Write the Insight for a {match.resonance_type.value} resonance "
        f"(evidence tags: {evidence}).\n\n"
        f"Composed fragments:\n\n{body}\n\n"
        "Name what the pattern names. Do not restate the fragments. Let "
        "the Insight stand on its own as a page-worthy aphorism."
    )


def _strip_fences(text: str) -> str:
    match = _FENCE_RE.search(text or "")
    return (match.group(1) if match else (text or "")).strip()


def parse_insight_response(raw: str) -> dict[str, str] | None:
    """Parse LLM output; return ``{'content_de':..., 'content_en':...}``
    or ``None`` if malformed. Tolerates markdown fences and surrounding
    whitespace."""
    text = _strip_fences(raw)
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return None
    if not isinstance(parsed, dict):
        return None
    de = parsed.get("content_de")
    en = parsed.get("content_en")
    if not isinstance(de, str) or not isinstance(en, str):
        return None
    de = de.strip()
    en = en.strip()
    if not de or not en:
        return None
    return {"content_de": de, "content_en": en}


class InsightService:
    """LLM Insight generation for crystallization.

    One public method: ``crystallize``. It composes the prompt,
    enforces budget, calls the research-tier model, parses the
    response, hands off to
    ``ConstellationService.commit_crystallization`` for the atomic DB
    write, then delegates to ``AttunementService`` to evaluate +
    idempotently unlock a matching starter attunement. Returns a
    ``CrystallizeResult`` bundling the committed constellation with
    ``newly_unlocked_attunement`` populated only on first unlock so
    the frontend can fire the ceremony exactly once.
    """

    @classmethod
    async def crystallize(
        cls,
        supabase: Client,
        admin: Client,
        user_id: UUID,
        constellation_id: UUID,
    ) -> CrystallizeResult:
        """Crystallize a drafting constellation.

        Returns a ``CrystallizeResult`` bundling the updated
        ``ConstellationResponse`` with the optional
        ``newly_unlocked_attunement`` — the latter populated ONLY when
        the crystallization triggered a new unlock, so the frontend
        can fire the ceremony one-shot. Re-crystallizing the same
        resonance type the user already had leaves the constellation's
        ``attunement_id`` set (record of "this was a mercy-type
        crystallization") but ``newly_unlocked_attunement`` stays
        None (no second ceremony).

        Raises:
          * ``conflict`` (pre-flight: status / fragment count / no resonance)
          * ``InsightBlockedError`` (budget or credit block — retryable
            later, NOT retried here)
          * ``InsightGenerationError`` (transient LLM failure)
          * ``server_error`` (parse failure after the LLM replied)

        ``supabase`` is the user-scoped client for the CRUD path (RLS-
        enforced); ``admin`` is the service-role client used by
        ``BudgetContext`` for budget ledger writes and by the
        attunement unlock (user_attunements INSERT needs service_role
        per migration-232 RLS).
        """
        # Preflight: load constellation + its fragments, run detector.
        # Raises conflict before we spend the LLM call if preconditions fail.
        _constellation, fragments, match = await ConstellationService.prepare_crystallization(
            supabase, user_id, constellation_id,
        )

        # Evaluate attunement candidate BEFORE the LLM call — the
        # lookup is a single-row catalog read, cheap, and lets us
        # record the attunement FK in the same commit as the insight.
        # If the resonance type has no matching starter attunement
        # (e.g. contradiction) this returns None and the crystallize
        # proceeds without unlock.
        candidate = await AttunementService.evaluate(
            supabase, str(match.resonance_type)
        )

        model_id = get_platform_model(_MODEL_PURPOSE_RESEARCH)
        user_prompt = build_insight_user_prompt(fragments, match)
        budget = BudgetContext(
            admin_supabase=admin,
            purpose="constellation_insight",
            simulation_id=None,  # user-global; no sim scope
            user_id=user_id,
        )

        try:
            openrouter = OpenRouterService()
            content = await openrouter.generate(
                model=model_id,
                messages=[
                    {"role": "system", "content": INSIGHT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=_LLM_TEMPERATURE,
                max_tokens=_LLM_MAX_TOKENS,
                budget=budget,
            )
        except BudgetExceededError as err:
            logger.info(
                "Insight blocked by budget",
                extra={"user_id": str(user_id), "constellation_id": str(constellation_id)},
            )
            raise InsightBlockedError("budget") from err
        except CreditExhaustedError as err:
            logger.warning(
                "Insight blocked by OpenRouter credit exhaustion",
                extra={"user_id": str(user_id), "constellation_id": str(constellation_id)},
            )
            raise InsightBlockedError("credit") from err
        except (OpenRouterError, httpx.HTTPError) as err:
            sentry_sdk.capture_exception(err)
            logger.warning(
                "Insight LLM call failed",
                extra={"user_id": str(user_id), "constellation_id": str(constellation_id)},
                exc_info=True,
            )
            raise InsightGenerationError("llm_call_failed") from err

        parsed = parse_insight_response(content)
        if parsed is None:
            logger.warning(
                "Insight LLM returned unparseable JSON",
                extra={
                    "user_id": str(user_id),
                    "constellation_id": str(constellation_id),
                    "snippet": (content or "")[:200],
                },
            )
            # Unparseable output after a successful LLM call is unusual.
            # Surface as a 5xx (the call succeeded but the artifact is
            # unusable). Client can retry; the draft is untouched.
            raise server_error("insight generation produced unparseable output")

        constellation = await ConstellationService.commit_crystallization(
            supabase,
            user_id,
            constellation_id,
            match=match,
            insight_de=parsed["content_de"],
            insight_en=parsed["content_en"],
            attunement_id=candidate.id if candidate else None,
        )

        # Idempotent unlock. When the user already holds the attunement
        # (re-crystallizing the same resonance type), ``newly`` is False
        # and we leave ``newly_unlocked_attunement`` None so the
        # frontend doesn't re-run the ceremony. A unlock-side failure
        # (rare: admin client auth issue) is logged but does not fail
        # the crystallize — the user got their insight, and a
        # subsequent crystallize will re-attempt unlock idempotently.
        newly_unlocked: AttunementResponse | None = None
        if candidate is not None:
            try:
                newly = await AttunementService.unlock(
                    admin,
                    user_id,
                    candidate.id,
                    constellation_id,
                )
                if newly:
                    newly_unlocked = candidate
            except Exception as unlock_err:
                sentry_sdk.capture_exception(unlock_err)
                logger.warning(
                    "Attunement unlock write failed (constellation committed)",
                    extra={
                        "user_id": str(user_id),
                        "constellation_id": str(constellation_id),
                        "attunement_id": str(candidate.id),
                    },
                    exc_info=True,
                )

        return CrystallizeResult(
            constellation=constellation,
            newly_unlocked_attunement=newly_unlocked,
        )


__all__ = [
    "INSIGHT_SYSTEM_PROMPT",
    "InsightBlockedError",
    "InsightGenerationError",
    "InsightService",
    "build_insight_user_prompt",
    "parse_insight_response",
]
