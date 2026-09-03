"""Prompt fragments that more than one Forge stage has to say the same way.

Two stages open their prompt by telling the model which world it is looking
at: ``forge_lore_service`` (the founding lore) and ``forge_theme_service``
(the visual identity). Since March 2026 both carried that opening verbatim —
nine lines of seed, philosophical anchor and city, duplicated character for
character.

A duplicated prompt is worse than duplicated code. Code that drifts fails a
test; a prompt that drifts changes what the model writes, in one stage only,
and nothing goes red. The lore would describe a world the theme never saw.

What is shared and what is not
------------------------------
Shared is the header up to and including the city line. The ZONE line stays
with each caller on purpose, because the two do not agree and must not be
quietly reconciled here:

* lore   -> ``  Districts: …`` with a ``"?"`` fallback for a nameless zone
* theme  -> ``  Zones: …`` with an empty-string fallback

Folding those together would silently change one of the two prompts. The
label is part of what the stage asks for, and the fallback is part of what it
shows the model; both belong to the caller.

A third stage says the words "PHILOSOPHICAL ANCHOR" too, and is deliberately
NOT a caller here: ``forge_orchestrator_service.build_world_context`` renders
a shorter brief (``PHILOSOPHICAL ANCHOR: <title>`` on one line, three fields,
no description) that it only emits when a title exists, and it feeds a
different consumer. Same two words, different fragment. It is listed here so
the next reader does not have to rediscover that grep finds three hits where
only two are the same thing.

``backend/tests/unit/test_forge_prompt_blocks.py`` pins the rendered text so
that a later edit here has to be a deliberate one.
"""

from __future__ import annotations

from typing import Any


def world_context_header(
    seed: str,
    anchor: dict[str, Any],
    geography: dict[str, Any],
) -> str:
    """The opening of a Forge prompt: which world, from which question.

    Ends after the city line WITHOUT a blank line, so the caller appends its
    own zone line and closes the block. The missing-value fallbacks are the
    ones both stages already used.
    """
    return (
        f"SEED: {seed}\n\n"
        f"PHILOSOPHICAL ANCHOR:\n"
        f"  Title: {anchor.get('title', 'Unknown')}\n"
        f"  Core Question: {anchor.get('core_question', '')}\n"
        f"  Description: {anchor.get('description', '')}\n"
        f"  Literary Influence: {anchor.get('literary_influence', '')}\n\n"
        f"GEOGRAPHY:\n"
        f"  City: {geography.get('city_name', 'Unnamed')}\n"
    )
