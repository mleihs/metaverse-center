"""Localization utilities for the _de suffix column pattern.

Used by chat_ai_service to resolve locale-appropriate agent fields and
mood descriptors. Follows the established _de suffix pattern from the
Forge entity translation pipeline.
"""

# Mapping of locale -> field suffix. Only 'de' has _de columns in the DB.
_LOCALE_SUFFIXES: dict[str, str] = {"de": "_de"}


def get_localized_field(entity: dict, field: str, locale: str) -> str:
    """Return the localized version of a field with EN fallback.

    For locale='de' and field='character':
      1. Try entity['character_de']
      2. Fall back to entity['character']
      3. Fall back to ''

    For locale='en' or unknown locales, returns entity[field] directly.
    """
    suffix = _LOCALE_SUFFIXES.get(locale)
    if suffix:
        localized = entity.get(f"{field}{suffix}")
        if localized:
            return localized
    return entity.get(field, "")


# ── Localized mood descriptors ──────────────────────────────────────

MOOD_DESCRIPTORS: dict[str, dict[str, str]] = {
    "en": {
        "very_positive": "very positive, upbeat",
        "content": "content, at ease",
        "neutral": "neutral, composed",
        "troubled": "troubled, tense",
        "distressed": "deeply distressed, volatile",
    },
    "de": {
        "very_positive": "sehr positiv, optimistisch",
        "content": "zufrieden, gelassen",
        "neutral": "neutral, gefasst",
        "troubled": "beunruhigt, angespannt",
        "distressed": "zutiefst verstört, unberechenbar",
    },
}

STRESS_DESCRIPTORS: dict[str, dict[str, str]] = {
    "en": {
        "breakdown": "on the verge of a breakdown",
        "high": "highly stressed",
        "moderate": "moderately stressed",
        "calm": "relatively calm",
    },
    "de": {
        "breakdown": "kurz vor einem Zusammenbruch",
        "high": "stark gestresst",
        "moderate": "mäßig gestresst",
        "calm": "relativ gelassen",
    },
}

# ── Moodlet type and emotion label translations ─────────────────────
# Free-text values from DB. Unknown keys gracefully degrade to English (key itself).

MOODLET_TYPE_LABELS: dict[str, dict[str, str]] = {
    "de": {
        "social_casual_chat": "zwangloses Gespräch",
        "social_collaboration": "Zusammenarbeit",
        "social_deep_conversation": "tiefgehendes Gespräch",
        "social_casual_chat_self": "eigenes zwangloses Gespräch",
        "social_collaboration_self": "eigene Zusammenarbeit",
        "social_deep_conversation_self": "eigenes tiefgehendes Gespräch",
        "witnessed_breakdown": "Zusammenbruch miterlebt",
        "celebration": "Feier",
        "community_spirit": "Gemeinschaftsgefühl",
        "dungeon_trauma": "Dungeon-Trauma",
        "dungeon_survivor": "Dungeon-Überlebender",
        "shadow_attuned": "Schattenverbunden",
        "structurally_attuned": "Strukturell abgestimmt",
        "entropy_attuned": "Entropie-abgestimmt",
        "zone_weather": "Zonenwetter",
        "resonance_pressure": "Resonanzdruck",
    },
}

EMOTION_LABELS: dict[str, dict[str, str]] = {
    "de": {
        "joy": "Freude",
        "neutral": "neutral",
        "anxiety": "Angst",
        "hope": "Hoffnung",
        "dread": "Furcht",
        "pride": "Stolz",
        "guilt": "Schuld",
        "satisfaction": "Zufriedenheit",
        "fascination": "Faszination",
        "determination": "Entschlossenheit",
        "calm": "Gelassenheit",
        "serene": "Heiterkeit",
    },
}


def localize_label(label: str, mapping: dict[str, dict[str, str]], locale: str) -> str:
    """Translate a free-text label using a locale dict. Falls back to the raw label."""
    return mapping.get(locale, {}).get(label, label)


MOOD_CONTEXT_TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "state": (
            "\nCurrent emotional state: {mood_desc} (mood {score}/100). "
            "Dominant emotion: {emotion}. {stress_desc} (stress {stress}/1000)."
        ),
        "influences": "\nActive influences:\n{moodlet_lines}",
        "instruction": (
            "\nLet this emotional state subtly influence your tone and responses. "
            "Do not explicitly mention mood scores or stress numbers."
        ),
    },
    "de": {
        "state": (
            "\nAktueller Gemütszustand: {mood_desc} (Stimmung {score}/100). "
            "Vorherrschende Emotion: {emotion}. {stress_desc} (Stress {stress}/1000)."
        ),
        "influences": "\nAktive Einflüsse:\n{moodlet_lines}",
        "instruction": (
            "\nLass diesen Gemütszustand subtil deinen Tonfall und deine Antworten beeinflussen. "
            "Erwähne keine Stimmungswerte oder Stresszahlen explizit."
        ),
    },
}
