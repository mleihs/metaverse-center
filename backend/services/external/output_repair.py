"""Lightweight OutputFixingParser replacement — no LangChain needed.

When JSON parsing fails, sends the malformed output + target schema
back to the LLM for repair. Replaces LangChain's OutputFixingParser
pattern with ~30 lines of code instead of a 50+ MB dependency tree.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

# ValidationError is used at RUNTIME in `_matches`, so it must NOT live in the
# TYPE_CHECKING block — an `except` clause is evaluated, not annotated.
from pydantic import ValidationError

from backend.config import settings

if TYPE_CHECKING:
    from pydantic import BaseModel

    from backend.services.external.openrouter import BudgetContext, OpenRouterService

logger = logging.getLogger(__name__)


def _matches(candidate: object, pydantic_model: type[BaseModel]) -> bool:
    """Does this parsed JSON satisfy the schema the caller asked for?"""
    try:
        pydantic_model.model_validate(candidate)
    except ValidationError:
        return False
    return True


async def repair_json_output(
    openrouter: OpenRouterService,
    model: str,
    malformed_output: str,
    pydantic_model: type[BaseModel],
    *,
    temperature: float = 0.1,
    budget: BudgetContext | None = None,
) -> dict | None:
    """Ask the LLM to fix malformed JSON output.

    1. Tries json.loads first (maybe it's fine).
    2. If not, sends malformed output + target schema to LLM for repair.
    3. Returns parsed dict or None on failure.
    """
    # Fast path: already valid AND the right shape.
    #
    # The shape check is the point. Without it, a syntactically perfect answer
    # with the wrong keys sailed straight through — the function accepted a
    # `pydantic_model`, promised output matching it, and returned whatever
    # happened to parse. A caller then read `.get("title")` off a dict that
    # never had one and got None, silently.
    try:
        candidate = json.loads(malformed_output)
    except (json.JSONDecodeError, ValueError):
        candidate = None
    if candidate is not None and _matches(candidate, pydantic_model):
        return candidate

    if settings.forge_mock_mode:
        logger.info("MOCK_MODE: skipping LLM repair for malformed JSON")
        return None

    schema_str = json.dumps(pydantic_model.model_json_schema(), indent=2)
    repair_prompt = (
        "The following JSON output is malformed. Fix it to match this schema exactly:\n\n"
        f"Schema:\n```json\n{schema_str}\n```\n\n"
        f"Malformed output:\n```\n{malformed_output}\n```\n\n"
        "Return ONLY the corrected JSON, no explanation."
    )

    try:
        repaired = await openrouter.generate(
            model=model,
            messages=[{"role": "user", "content": repair_prompt}],
            temperature=temperature,
            max_tokens=2048,
            # The repair is a SECOND paid call, and it fires exactly when the
            # first one already went wrong. Running it outside every budget was
            # the worst possible place for an exemption.
            budget=budget,
        )
    except Exception:  # noqa: BLE001 — repair is best-effort, always return None on failure
        logger.warning("LLM repair call failed for malformed output")
        return None

    # Strip markdown fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", repaired.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    try:
        repaired_json = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("LLM repair output still not valid JSON")
        return None

    if not _matches(repaired_json, pydantic_model):
        logger.warning(
            "LLM repair output is valid JSON but does not match %s",
            pydantic_model.__name__,
        )
        return None
    return repaired_json
