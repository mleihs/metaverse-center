"""Which drawer a per-simulation setting lives in — declared once, read by both ends.

``simulation_settings`` is a key-value store partitioned by ``category``. The
categories exist for the settings *screen*: a world builder looks for autonomy
under "Autonomy" and bond tuning under "Bonds". Nothing about that organisation
concerns the heartbeat, which only wants the values.

Until 30.08.2026 the heartbeat guessed anyway. ``_load_sim_overrides`` filtered
``category = 'heartbeat'`` and every panel chose its own category, so the writer
and the reader held the same knowledge in two places and disagreed:

- ``AutonomySettingsPanel`` wrote ``category='autonomy'`` — all five autonomy
  values the tick reads were therefore invisible to it. Every slider on that
  screen moved nothing.
- ``BondSettingsPanel`` writes ``category='bonds'`` — the whisper budget was
  read as its hard-coded default of 3, whatever the owner set.

Nothing failed. The rows were written, the screen showed them back on reload,
and the tick used its defaults. That is the worst shape a defect can take.

The categories below are measured, not chosen. Production holds exactly two rows
in a category this file governs, both on Velgarien: ``agent_autonomy_enabled``
and ``weather_enabled``, both under ``'heartbeat'`` — so that is where the
autonomy keys are declared, and ``AutonomySettingsPanel`` was moved to write
there (its tab stays "Autonomy"; ``WeatherSettingsPanel`` has always separated
its tab from its category the same way). No production row moves.

``bond_whisper_budget`` stays under ``'bonds'``, where ``BondService`` reads the
rest of that screen. That is the case this file exists for: the tick can read a
value out of another screen's drawer without either side hard-coding the other.

A key belongs to exactly one category by construction, which is what makes the
lookup exact — two categories cannot hold the same name.

``backend/tests/unit/test_simulation_setting_contracts.py`` binds this file to
its call sites by AST — a key read from ``overrides`` and not declared here is a
red test, and so is a declaration nothing reads. The pattern is the one
``prompt_contracts.py`` established (W1).
"""

from __future__ import annotations

from typing import Final

__all__ = [
    "HEARTBEAT_OVERRIDE_KEYS",
    "SETTING_CATEGORIES",
    "heartbeat_override_categories",
]

#: Every category a setting may be written under. ``SettingCreate`` validates
#: against it, so a typo is a 422 and not a row nobody will ever read again.
#: The first block is what production actually holds
#: (measured 30.08.2026: design 1465, ai 293, game_mechanics 260, world 90,
#: anchor 90, game 33, drift 15, integration 8, heartbeat 2); the second is what
#: the settings screen can write but nobody has saved yet.
SETTING_CATEGORIES: Final[frozenset[str]] = frozenset(
    {
        "design",
        "ai",
        "game_mechanics",
        "world",
        "anchor",
        "game",
        "drift",
        "integration",
        "heartbeat",
        "general",
        "bleed",
        "autonomy",
        "bonds",
        "access",
        "prompts",
        "notifications",
        "weather",
        "features",
    }
)

#: Per-simulation overrides the heartbeat tick reads, and the category each is
#: stored under. Mirrors the panels under ``frontend/src/components/settings/``:
#: the comment above each block names the screen that writes it.
HEARTBEAT_OVERRIDE_KEYS: Final[dict[str, str]] = {
    # Cadence and aging — no panel writes these today; they are set by hand or
    # by the forge. The per-simulation heartbeat switch has no control at all.
    "enabled": "heartbeat",
    "interval_override_seconds": "heartbeat",
    "event_aging_rules": "heartbeat",
    # WeatherSettingsPanel (category='heartbeat')
    "weather_enabled": "heartbeat",
    "weather_lat": "heartbeat",
    "weather_lon": "heartbeat",
    "weather_theme_override": "heartbeat",
    # AutonomySettingsPanel (tab 'autonomy', category='heartbeat')
    "agent_autonomy_enabled": "heartbeat",
    "autonomy_admin_override": "heartbeat",
    "autonomy_llm_budget_per_tick": "heartbeat",
    "autonomy_needs_decay_rate": "heartbeat",
    "autonomy_social_interaction_rate": "heartbeat",
    # BondSettingsPanel (category='bonds')
    "bond_whisper_budget": "bonds",
}


def heartbeat_override_categories() -> list[str]:
    """The categories a tick must read to see every override it uses."""
    return sorted(set(HEARTBEAT_OVERRIDE_KEYS.values()))
