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

if TYPE_CHECKING:
    from pydantic import BaseModel

    from backend.services.external.openrouter import OpenRouterService

logger = logging.getLogger(__name__)


async def repair_json_output(
    openrouter: OpenRouterService,
    model: str,
    malformed_output: str,
    pydantic_model: type[BaseModel],
    *,
    temperature: float = 0.1,
) -> dict | None:
    """Ask the LLM to fix malformed JSON output.

    1. Tries json.loads first (maybe it's fine).
    2. If not, sends malformed output + target schema to LLM for repair.
    3. Returns parsed dict or None on failure.
    """
    # Fast path: already valid
    try:
        return json.loads(malformed_output)
    except (json.JSONDecodeError, ValueError):
        pass

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
        )
    except Exception:
        logger.warning("LLM repair call failed for malformed output")
        return None

    # Strip markdown fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", repaired.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("LLM repair output still not valid JSON")
        return None
