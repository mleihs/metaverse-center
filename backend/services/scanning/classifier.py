"""LLM batch classification for unstructured scan results."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from backend.services.external.openrouter import BudgetContext, OpenRouterError, OpenRouterService
from backend.services.scanning.base_adapter import ScanResult

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {
    "economic_crisis",
    "military_conflict",
    "pandemic",
    "natural_disaster",
    "political_upheaval",
    "tech_breakthrough",
    "cultural_shift",
    "environmental_disaster",
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

#: Wie viele Antwort-Token eine Überschrift kostet.
#:
#: Gemessen am geforderten Format (`_SYSTEM_PROMPT`, letzte Zeile): index,
#: category, significance und ein kurzer `reason` sind rund 40 Token. 64 ist
#: das mit Luft für einen längeren Grund — lieber ein paar Token zu viel
#: bezahlen als eine abgeschnittene Antwort, die den ganzen Stapel verwirft.
_TOKENS_PER_ITEM = 64

#: Grundlast der Antwort (Klammern, Kommata, ein angefangener Satz Vorrede).
_TOKENS_OVERHEAD = 128

#: Obergrenze für EINE Antwort. Darüber wird gestückelt, nicht erhöht.
_MAX_COMPLETION_TOKENS = 4096

#: Wie viele Überschriften höchstens in einen Aufruf gehen.
#:
#: Aus den beiden Zahlen darüber abgeleitet, damit die Stückelung nicht gegen
#: die Obergrenze laufen kann: mehr Überschriften als hier passen NIE in ein
#: Antwortbudget, egal wie grosszügig es gerechnet wird.
_MAX_BATCH_SIZE = (_MAX_COMPLETION_TOKENS - _TOKENS_OVERHEAD) // _TOKENS_PER_ITEM

# Map significance (1-10) → magnitude (0.1-1.0)
_SIGNIFICANCE_TO_MAGNITUDE = {
    1: 0.10,
    2: 0.20,
    3: 0.30,
    4: 0.40,
    5: 0.50,
    6: 0.60,
    7: 0.70,
    8: 0.80,
    9: 0.90,
    10: 1.00,
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
    # No default: a model literal here would quietly outrank Admin > Models for
    # this one path. Callers resolve it through get_platform_model().
    model: str,
    *,
    system_prompt_override: str | None = None,
    budget: BudgetContext | None = None,
) -> list[ScanResult]:
    """Classify unstructured results via a single batched LLM call.

    Structured results are passed through unchanged.
    Uses system_prompt_override from DB prompt_templates if provided,
    otherwise falls back to the inline _SYSTEM_PROMPT constant.

    ``budget`` (Bureau Ops Deferral A.3) — optional pre-check context.
    When supplied, the upstream OpenRouter call fires
    ``BudgetEnforcementService.pre_check`` before the HTTP request. The
    scanner constructs one and threads it down.
    """
    # Zu grosse Stapel werden GESTÜCKELT, nicht mit einem groesseren Budget
    # erschlagen. Jeder Anbieter hat irgendwo eine Obergrenze; wer sie mit
    # einer Zahl bekaempft, verschiebt den Tag, an dem sie wieder reisst.
    #
    # Die Rekursion ist genau eine Ebene tief: jedes Stueck ist per
    # Konstruktion klein genug.
    if len(results) > _MAX_BATCH_SIZE:
        merged: list[ScanResult] = []
        for start in range(0, len(results), _MAX_BATCH_SIZE):
            merged.extend(
                await classify_batch(
                    results[start : start + _MAX_BATCH_SIZE],
                    openrouter,
                    model,
                    system_prompt_override=system_prompt_override,
                    budget=budget,
                )
            )
        return merged

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
        {"index": idx, "title": r.title, "description": r.description or ""} for idx, (_, r) in enumerate(unstructured)
    ]

    user_prompt = f"Headlines:\n{json.dumps(headlines, ensure_ascii=False)}"

    # The answer budget SCALES WITH THE BATCH — it is not a constant.
    #
    # It was `max_tokens=1024` regardless of how many headlines went in. That
    # held while the only unstructured source was Guardian (a handful per
    # cycle). On 2026-09-02 the Bluesky adapter brought 19 in one cycle, the
    # model answered exactly 1024 completion tokens, the JSON stopped
    # mid-array, and all 19 came back unclassified — logged as "LLM batch
    # classification failed", which reads like the model misbehaved. It did
    # not: it was asked for more than it was allowed to say.
    #
    # A ceiling that does not move with the input is a bug waiting for a
    # bigger input. `_MAX_BATCH_SIZE` is the other half: past it, chunking
    # is the answer, not a larger number.
    answer_budget = min(
        _TOKENS_OVERHEAD + _TOKENS_PER_ITEM * len(headlines),
        _MAX_COMPLETION_TOKENS,
    )

    try:
        raw = await openrouter.generate_with_system(
            model=model,
            system_prompt=system_prompt_override or _SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=answer_budget,
            budget=budget,
        )

        classifications = _parse_json_from_text(raw)
        if not isinstance(classifications, list):
            # Name the likely cause instead of only the symptom: an answer that
            # does not close its array was almost certainly cut off, and that
            # is a different repair than "the model returned nonsense".
            cut_off = bool(raw) and not raw.rstrip().endswith("]")
            logger.warning(
                "LLM classification returned non-list (%d headlines, budget %d tokens, "
                "answer %s): %s",
                len(headlines),
                answer_budget,
                "looks cut off" if cut_off else "complete",
                raw[:200],
            )
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

    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError, OpenRouterError):
        logger.exception("LLM batch classification failed")
        # Return all results unmodified on failure
        return structured + [r for _, r in unstructured]
