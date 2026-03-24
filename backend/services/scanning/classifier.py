"""LLM batch classification for unstructured scan results."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from backend.services.external.openrouter import OpenRouterService
from backend.services.scanning.base_adapter import ScanResult

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {
    "economic_crisis", "military_conflict", "pandemic",
    "natural_disaster", "political_upheaval", "tech_breakthrough",
    "cultural_shift", "environmental_disaster",
}

# Classification system prompt
_SYSTEM_PROMPT = """You are a geopolitical event classifier. Return ONLY valid JSON.

Classify each headline into exactly one category or "none":
- economic_crisis: Financial collapse, market crashes, banking failures, debt crises
- military_conflict: Wars, armed conflicts, military operations, territorial disputes
- pandemic: Disease outbreaks, epidemics, public health emergencies
- natural_disaster: Earthquakes, floods, storms, volcanic eruptions, wildfires
- political_upheaval: Revolutions, coups, mass protests, regime changes
- tech_breakthrough: Disruptive technology, AI milestones, space achievements
- cultural_shift: Social movements, civil rights, generational cultural change
- environmental_disaster: Oil spills, deforestation, extinction events, climate crises

Significance scale (maps to game magnitude 0.1-1.0):
  1-2: Local incident (magnitude <= 0.20)
  3-4: Regional event (magnitude 0.30-0.40)
  5-6: National event (magnitude 0.50-0.60)
  7-8: International crisis (magnitude 0.70-0.80)
  9-10: Civilization-level event (magnitude 0.90-1.00)

Return JSON array:
[{"index": 0, "category": "natural_disaster", "significance": 8, "reason": "Major earthquake with mass casualties"}]"""

# Map significance (1-10) → magnitude (0.1-1.0)
_SIGNIFICANCE_TO_MAGNITUDE = {
    1: 0.10, 2: 0.20, 3: 0.30, 4: 0.40, 5: 0.50,
    6: 0.60, 7: 0.70, 8: 0.80, 9: 0.90, 10: 1.00,
}


def _parse_json_from_text(text: str) -> Any:
    """Extract JSON array from LLM output (may contain markdown fences)."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code fence
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try finding array brackets
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


async def classify_batch(
    results: list[ScanResult],
    openrouter: OpenRouterService,
    model: str = "deepseek/deepseek-v3.2",
) -> list[ScanResult]:
    """Classify unstructured results via a single batched LLM call.

    Structured results are passed through unchanged.
    Returns all results with classification applied.
    """
    # Separate structured (already classified) from unstructured
    structured: list[ScanResult] = []
    unstructured: list[tuple[int, ScanResult]] = []

    for i, r in enumerate(results):
        if r.is_structured and r.source_category:
            structured.append(r)
        else:
            unstructured.append((i, r))

    if not unstructured:
        return structured

    # Build headlines JSON for LLM
    headlines = [
        {"index": idx, "title": r.title, "description": r.description or ""}
        for idx, (_, r) in enumerate(unstructured)
    ]

    user_prompt = f"Headlines:\n{json.dumps(headlines, ensure_ascii=False)}"

    try:
        raw = await openrouter.generate_with_system(
            model=model,
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=1024,
        )

        classifications = _parse_json_from_text(raw)
        if not isinstance(classifications, list):
            logger.warning("LLM classification returned non-list: %s", raw[:200])
            return structured + [r for _, r in unstructured]

        # Apply classifications
        classified_map: dict[int, dict] = {}
        for entry in classifications:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("index")
            if idx is not None and isinstance(idx, int):
                classified_map[idx] = entry

        classified: list[ScanResult] = []
        for idx, (_, result) in enumerate(unstructured):
            cls_data = classified_map.get(idx)
            if cls_data:
                category = cls_data.get("category", "none")
                if category in VALID_CATEGORIES:
                    significance = cls_data.get("significance", 5)
                    significance = max(1, min(10, int(significance)))
                    result.source_category = category
                    result.magnitude = _SIGNIFICANCE_TO_MAGNITUDE.get(significance, 0.50)
                    result.classification_reason = cls_data.get("reason", "")
                # "none" → leave unclassified, will be filtered out
            classified.append(result)

        return structured + classified

    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        logger.exception("LLM batch classification failed")
        # Return all results unmodified on failure
        return structured + [r for _, r in unstructured]
