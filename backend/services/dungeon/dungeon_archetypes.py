"""Archetype configurations for Resonance Dungeons.

Phase 0: The Shadow is fully defined. Other 7 archetypes are stubbed
with base configs and will be fleshed out in Phases 1-3.

Review #7: Shadow visibility rebalanced:
- Start at 3 VP (max 3), not 2
- Costs 1 VP per 2 rooms entered (not per room)
- Additional restoration: treasure rooms +1 VP, successful combat +1 VP
- VP 0 penalties reduced: 40% ambush (was 60%), +25% stress (was +50%)
"""

from __future__ import annotations

# ── Archetype Configurations ────────────────────────────────────────────────

ARCHETYPE_CONFIGS: dict[str, dict] = {
    "The Shadow": {
        "signature": "conflict_wave",
        "title_en": "Die Tiefe Nacht",
        "title_de": "Die Tiefe Nacht",
        "tagline_en": "The part of reality that knows how to hurt rises to the surface.",
        "tagline_de": "Der Teil der Realitat, der zu verletzen weiss, steigt an die Oberflache.",
        "prose_style": "Terse. Military. Shadows described as predatory. Sound amplified. Agents whisper.",
        # Core mechanic: Visibility
        "mechanic": "visibility",
        "mechanic_config": {
            "max_visibility": 3,
            "start_visibility": 3,
            "cost_per_rooms": 2,  # Review #7: lose 1 VP per 2 rooms (not per room)
            "restore_on_treasure": 1,
            "restore_on_combat_win": 1,
            "restore_on_spy_observe": 1,
            "restore_on_rest": 1,
            # VP 0 penalties (Review #7: reduced from original)
            "blind_ambush_chance": 0.40,  # was 0.60
            "blind_stress_multiplier": 1.25,  # was 1.50
            "blind_loot_bonus": 0.50,  # brave in the dark = +50% loot
        },
        # Aptitude emphasis
        "aptitude_weights": {
            "spy": "critical",
            "guardian": "high",
            "assassin": "high",
            "infiltrator": "medium",
            "saboteur": "medium",
            "propagandist": "medium",
        },
        # Atmosphere text for terminal
        "atmosphere_enter_en": (
            "You descend into absolute darkness. The terminal flickers.\n\n"
            "The shadows here are not the absence of light \u2014 they are the presence\n"
            "of something else. Your instruments read nothing."
        ),
        "atmosphere_enter_de": (
            "Ihr steigt in absolute Dunkelheit hinab. Das Terminal flackert.\n\n"
            "Die Schatten hier sind nicht die Abwesenheit von Licht \u2014 sie sind die Anwesenheit\n"
            "von etwas anderem. Eure Instrumente zeigen nichts an."
        ),
    },
    # ── The Tower (Phase 1) ───────────────────────────────────────────────────
    "The Tower": {
        "signature": "economic_tremor",
        "title_en": "Der Fallende Turm",
        "title_de": "Der Fallende Turm",
        "tagline_en": "Structures that seemed permanent reveal themselves as temporary.",
        "tagline_de": "Strukturen, die dauerhaft schienen, erweisen sich als vergänglich.",
        "prose_style": "Clinical. Economic. Architecture described as organic failure.",
        "mechanic": "stability_countdown",
        "mechanic_config": {
            "start_stability": 100,
            "max_stability": 100,
            # Drain rates (per room entry, by depth)
            "drain_depth_1_2": 5,
            "drain_depth_3_4": 10,
            "drain_depth_5_plus": 15,
            # Combat drain
            "drain_per_combat_round": 3,
            # Failed skill check drain
            "drain_on_failed_check": 5,
            # Restore rates
            "restore_on_combat_win": 5,
            "restore_on_treasure": 5,
            "restore_on_guardian_rest": 10,
            "restore_on_reinforce": 10,
            # Thresholds
            "collapse_threshold": 0,
            "critical_threshold": 20,
            # Low-stability ambush chances
            "low_stability_ambush_30": 0.25,  # stability < 30
            "low_stability_ambush_15": 0.50,  # stability < 15
            # Structural Failure mode (stability == 0)
            "collapse_ambush_chance": 0.50,  # 50% ambush at stability 0
            "collapse_stress_multiplier": 2.0,  # double ambient stress at stability 0
            # Stress multiplier at low stability
            "stress_multiplier": 1.20,
        },
        "aptitude_weights": {
            "guardian": 30,   # critical: stabilize + tank
            "spy": 20,        # high: efficiency, shortcuts
            "saboteur": 20,   # high: controlled demolition
            "propagandist": 12,
            "assassin": 8,
            "infiltrator": 10,
        },
        "atmosphere_enter_en": (
            "Vertigo. The building leans. Numbers cascade down walls like stock\n"
            "tickers counting toward zero. The floor counter reads 100.\n\n"
            "The structure groans. Not from wind \u2014 from weight. From the accumulated\n"
            "mass of every promise this tower was built on, coming due simultaneously."
        ),
        "atmosphere_enter_de": (
            "Schwindel. Das Gebäude neigt sich. Zahlen rinnen die Wände herab wie\n"
            "Kursticker, die gegen Null zählen. Der Stockwerkzähler zeigt 100.\n\n"
            "Die Struktur ächzt. Nicht vom Wind \u2014 vom Gewicht. Von der akkumulierten\n"
            "Masse jedes Versprechens, auf dem dieser Turm gebaut wurde, fällig werdend zugleich."
        ),
    },
    # ── The Devouring Mother ────────────────────────────────────────────────
    "The Devouring Mother": {
        "signature": "biological_tide",
        "title_en": "Das Lebendige Labyrinth",
        "title_de": "Das Lebendige Labyrinth",
        "tagline_en": "That which sustains you consumes you.",
        "tagline_de": "Was euch nährt, verzehrt euch.",
        "prose_style": "Warm. Maternal. Biological. The dungeon described as providing, growing, embracing. Sentences that get warmer instead of shorter.",
        "mechanic": "parasitic_drain",
        "mechanic_config": {
            "start_attachment": 0,
            "max_attachment": 100,
            # Accumulation rates (per room entry, by depth)
            "gain_depth_1_2": 3,
            "gain_depth_3_4": 5,
            "gain_depth_5_plus": 8,
            # Passive healing (the Mother provides — THIS IS THE TRAP)
            "heal_stress_per_room": 5,
            "heal_stress_per_room_deep": 10,  # depth 5+: more generous
            # Rest site bonus
            "rest_stress_heal": 60,           # vs standard 40
            "rest_attachment_gain": 8,
            # Combat accumulation (lower than Entropy — combat RESISTS the Mother)
            "gain_per_combat_round": 1,
            # Failed skill check
            "gain_on_failed_check": 3,
            # The Mother's Gift: enemy defeat heals but costs attachment
            "heal_on_combat_win": 15,
            "gain_on_combat_win": 4,
            # Loot acceptance cost
            "gain_on_loot_accept": 5,
            # Guardian "Sever" ability
            "reduce_on_guardian_sever": 10,
            # Thresholds
            "incorporation_threshold": 100,
            "critical_threshold": 75,
            "dependent_threshold": 45,
            # Warmth gradient: buffs that increase WITH attachment (the trap)
            "warmth_stress_resist_45": 0.15,   # -15% incoming stress
            "warmth_stress_resist_75": 0.30,   # -30% incoming stress
            "warmth_heal_bonus_45": 1.25,      # rest heals 25% more
            "warmth_heal_bonus_75": 1.50,      # rest heals 50% more
            # High attachment penalties
            "high_attachment_retreat_stress_75": 80,
            "high_attachment_retreat_stress_90": 150,
            # Exit cost: withdrawal
            "exit_debuff_threshold": 50,
            "exit_stress_penalty_per_10": 20,
            # Ambush modification (lower than other archetypes)
            "high_attachment_ambush_75": 0.15,
            "high_attachment_ambush_90": 0.25,
            # Stress multiplier: INVERTED — REDUCED at high attachment
            "stress_multiplier_75": 0.80,
            "stress_multiplier_90": 0.65,
            "incorporation_stress_multiplier": 0.0,
        },
        "aptitude_weights": {
            "guardian": 30,
            "propagandist": 25,
            "spy": 15,
            "saboteur": 15,
            "assassin": 10,
            "infiltrator": 5,
        },
        "atmosphere_enter_en": (
            "Warmth. The air carries it like a gift \u2014 not the sterile warmth of\n"
            "climate control but the warmth of something alive, something that\n"
            "has been waiting for you specifically.\n\n"
            "The walls are soft. Organic. Your instruments read biological mass\n"
            "in every direction. The parasitic attachment counter reads 0.\n"
            "The dungeon reads 'welcome.'"
        ),
        "atmosphere_enter_de": (
            "Wärme. Die Luft trägt sie wie ein Geschenk \u2014 nicht die sterile\n"
            "Wärme einer Klimaanlage, sondern die Wärme von etwas Lebendigem,\n"
            "etwas, das auf euch gewartet hat. Auf euch im Besonderen.\n\n"
            "Die Wände sind weich. Organisch. Eure Instrumente messen biologische\n"
            "Masse in jeder Richtung. Der Bindungszähler zeigt 0.\n"
            "Der Dungeon liest: \u00bbWillkommen.\u00ab"
        ),
    },
    # ── Stubbed archetypes (Phase 2+) ──────────────────────────────────────
    "The Deluge": {
        "signature": "elemental_surge",
        "title_en": "Die Steigende Flut",
        "title_de": "Die Steigende Flut",
        "tagline_en": "The world reminds its inhabitants that they are guests.",
        "tagline_de": "Die Welt erinnert ihre Bewohner, dass sie Gaeste sind.",
        "mechanic": "rising_water",
        "mechanic_config": {},
    },
    "The Overthrow": {
        "signature": "authority_fracture",
        "title_en": "Der Spiegelpalast",
        "title_de": "Der Spiegelpalast",
        "tagline_en": "Power changes hands. The old order metamorphoses.",
        "tagline_de": "Macht wechselt die Hände. Die alte Ordnung wandelt sich.",
        "mechanic": "faction_navigation",
        "mechanic_config": {},
    },
    "The Prometheus": {
        "signature": "innovation_spark",
        "title_en": "Die Werkstatt der Goetter",
        "title_de": "Die Werkstatt der Goetter",
        "tagline_en": "Fire stolen from the gods. Every gift is also a weapon.",
        "tagline_de": "Den Goettern gestohlenes Feuer. Jede Gabe ist auch eine Waffe.",
        "mechanic": "crafting",
        "mechanic_config": {},
    },
    "The Awakening": {
        "signature": "consciousness_drift",
        "title_en": "Das Kollektive Unbewusste",
        "title_de": "Das Kollektive Unbewusste",
        "tagline_en": "The collective mind turns over in its sleep.",
        "tagline_de": "Der kollektive Geist dreht sich im Schlaf.",
        "mechanic": "memory_dungeon",
        "mechanic_config": {},
    },
    "The Entropy": {
        "signature": "decay_bloom",
        "title_en": "Der Verfall-Garten",
        "title_de": "Der Verfall-Garten",
        "tagline_en": "Decay is not destruction \u2014 it is transformation's dark twin.",
        "tagline_de": "Verfall ist nicht Zerstörung \u2014 er ist der dunkle Zwilling der Verwandlung.",
        "prose_style": "Minimalist. Observational. The dungeon described as losing distinctions. Short sentences that get shorter.",
        "mechanic": "decay_accumulation",
        "mechanic_config": {
            "start_decay": 0,
            "max_decay": 100,
            # Accumulation rates (per room entry, by depth)
            "gain_depth_1_2": 4,
            "gain_depth_3_4": 7,
            "gain_depth_5_plus": 10,
            # Combat accumulation
            "gain_per_combat_round": 2,
            # Failed skill check
            "gain_on_failed_check": 5,
            # Enemy hit = contagious decay (unique twist)
            "gain_per_enemy_hit": 3,
            # Restore (reduction) rates
            "reduce_on_combat_win": 3,
            "reduce_on_treasure": 5,
            "reduce_on_guardian_preserve": 8,
            "reduce_on_rest": 5,
            # Thresholds
            "dissolution_threshold": 100,
            "critical_threshold": 70,
            "degraded_threshold": 40,
            # High-decay ambush chances
            "high_decay_ambush_70": 0.30,
            "high_decay_ambush_85": 0.50,
            # Ability effectiveness reduction at high decay
            "ability_penalty_per_10_decay": 0.02,
            # Loot quality degradation
            "loot_downgrade_threshold": 60,
            "loot_downgrade_chance": 0.30,
            # Low-decay loot bonus
            "loot_upgrade_threshold": 20,
            "loot_upgrade_chance": 0.50,
            # Stress multiplier at high decay
            "stress_multiplier_70": 1.25,
            "stress_multiplier_85": 1.50,
            "dissolution_stress_multiplier": 2.0,
        },
        "aptitude_weights": {
            "guardian": 30,
            "spy": 20,
            "saboteur": 20,
            "propagandist": 15,
            "assassin": 8,
            "infiltrator": 7,
        },
        "atmosphere_enter_en": (
            "The air is the same temperature as the walls. The walls are the\n"
            "same color as the floor. The floor is the same texture as the silence.\n\n"
            "Your instruments work. They confirm that everything is becoming\n"
            "everything else. The decay counter reads 0. It will not read 0 again."
        ),
        "atmosphere_enter_de": (
            "Die Luft hat die gleiche Temperatur wie die Wände. Die Wände haben\n"
            "die gleiche Farbe wie der Boden. Der Boden hat die gleiche Textur\n"
            "wie die Stille.\n\n"
            "Eure Instrumente funktionieren. Sie bestätigen, dass alles zu allem\n"
            "anderen wird. Der Verfallszähler zeigt 0. Er wird nicht wieder 0 zeigen."
        ),
    },
}


# ── Room Type Distributions ─────────────────────────────────────────────────
# Weights for _pick_room_type(). Exit rooms = early escape at depth >= 3.

ARCHETYPE_ROOM_DISTRIBUTIONS: dict[str, dict[str, int]] = {
    "The Shadow": {"combat": 40, "encounter": 30, "elite": 5, "rest": 5, "treasure": 15, "exit": 5},
    "The Tower": {"combat": 40, "encounter": 25, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    "The Devouring Mother": {"combat": 35, "encounter": 30, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    "The Deluge": {"combat": 30, "encounter": 35, "elite": 5, "rest": 5, "treasure": 15, "exit": 10},
    "The Overthrow": {"combat": 20, "encounter": 45, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    "The Prometheus": {"combat": 30, "encounter": 35, "elite": 5, "rest": 10, "treasure": 15, "exit": 5},
    "The Awakening": {"combat": 25, "encounter": 40, "elite": 5, "rest": 15, "treasure": 10, "exit": 5},
    "The Entropy": {"combat": 30, "encounter": 35, "elite": 5, "rest": 10, "treasure": 15, "exit": 5},
}


# ── Difficulty Scaling ──────────────────────────────────────────────────────

DIFFICULTY_MULTIPLIERS: dict[int, dict[str, float | int]] = {
    1: {"enemy_power": 1.0, "enemy_condition": 1.0, "stress_mult": 0.8, "loot_quality": 1.0, "depth": 4},
    2: {"enemy_power": 1.15, "enemy_condition": 1.0, "stress_mult": 1.0, "loot_quality": 1.15, "depth": 5},
    3: {"enemy_power": 1.3, "enemy_condition": 1.5, "stress_mult": 1.2, "loot_quality": 1.3, "depth": 5},
    4: {"enemy_power": 1.5, "enemy_condition": 2.0, "stress_mult": 1.4, "loot_quality": 1.5, "depth": 6},
    5: {"enemy_power": 1.75, "enemy_condition": 2.0, "stress_mult": 1.6, "loot_quality": 1.75, "depth": 7},
}


def get_depth_for_difficulty(difficulty: int) -> int:
    """Get recommended dungeon depth for a difficulty level."""
    return int(DIFFICULTY_MULTIPLIERS.get(difficulty, DIFFICULTY_MULTIPLIERS[1])["depth"])
