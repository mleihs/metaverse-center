"""Ability schools — 6 aptitude-based ability sets for the combat system.

Each school has 2-3 abilities at base level (aptitude 3-6) for Phase 0.
Advanced abilities (aptitude 7-9, ultimates) will be added in Phase 1.

Design: The resolve() pattern returns an AbilityResult describing what happened.
The caller (combat_engine) applies the effects to state. This keeps abilities
declarative and testable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Ability:
    """Definition of a combat ability."""

    id: str
    name_en: str
    name_de: str
    school: str
    description_en: str
    description_de: str
    min_aptitude: int = 3
    cooldown: int = 0  # rounds between uses (0 = every round)
    effect_type: str = "damage"  # damage, stress_damage, heal_stress, buff, debuff, utility
    effect_params: dict = field(default_factory=dict)
    is_ultimate: bool = False
    targets: Literal["single_enemy", "all_enemies", "single_ally", "all_allies", "self"] = "single_enemy"


@dataclass
class AbilityResult:
    """Result of resolving an ability."""

    ability_id: str
    success: bool = True
    hit: bool = True
    damage_steps: int = 0
    stress_damage: int = 0
    stress_heal: int = 0
    applied_buffs: list[str] = field(default_factory=list)
    applied_debuffs: list[str] = field(default_factory=list)
    narrative_en: str = ""
    narrative_de: str = ""
    special_effects: dict = field(default_factory=dict)


# ── Ability Definitions ─────────────────────────────────────────────────────
# Phase 0: 2-3 abilities per school at base aptitude (3-6)

SPY_ABILITIES: list[Ability] = [
    Ability(
        id="spy_observe",
        name_en="Observe",
        name_de="Beobachten",
        school="spy",
        description_en="Analyze the battlefield. Reveals enemy intents. Restores Visibility (Shadow) or Stability (Tower).",
        description_de="Das Schlachtfeld analysieren. Enthüllt Feindabsichten. Stellt Sicht (Schatten) oder Stabilität (Turm) her.",
        min_aptitude=3,
        cooldown=1,
        effect_type="utility",
        effect_params={"reveal_intents": True, "visibility_restore": 1, "stability_restore": 5},
        targets="self",
    ),
    Ability(
        id="spy_analyze_weakness",
        name_en="Analyze Weakness",
        name_de="Schwachstelle analysieren",
        school="spy",
        description_en="Study an enemy. Next attack against this enemy by any agent deals +1 damage step.",
        description_de="Einen Feind studieren. Der nächste Angriff eines Agenten gegen diesen Feind verursacht +1 Schadensstufe.",
        min_aptitude=4,
        cooldown=2,
        effect_type="debuff",
        effect_params={"debuff": "analyzed", "damage_bonus": 1, "duration": 1},
        targets="single_enemy",
    ),
    Ability(
        id="spy_counter_intel",
        name_en="Counter-Intelligence",
        name_de="Spionageabwehr",
        school="spy",
        description_en="Negate one enemy's telegraphed action this round.",
        description_de="Die angezeigte Aktion eines Feindes in dieser Runde verhindern.",
        min_aptitude=5,
        cooldown=3,
        effect_type="utility",
        effect_params={"cancel_telegraphed": True},
        targets="single_enemy",
    ),
]

GUARDIAN_ABILITIES: list[Ability] = [
    Ability(
        id="guardian_shield",
        name_en="Shield",
        name_de="Schild",
        school="guardian",
        description_en="Protect an ally. Absorb the next condition damage and 50% stress damage for them.",
        description_de="Einen Verbündeten schützen. Absorbiert den nächsten Zustandsschaden und 50% Stressschaden für sie.",
        min_aptitude=3,
        cooldown=1,
        effect_type="buff",
        effect_params={"buff": "shielded", "absorb_condition": True, "stress_reduction": 0.5, "duration": 1},
        targets="single_ally",
    ),
    Ability(
        id="guardian_reinforce",
        name_en="Reinforce",
        name_de="Verstärken",
        school="guardian",
        description_en="Reinforce the structure. +10 Stability (Tower archetype only).",
        description_de="Das Bauwerk verstärken. +10 Stabilität (nur Turm-Archetyp).",
        min_aptitude=3,
        cooldown=2,
        effect_type="utility",
        effect_params={"stability_restore": 10, "archetype_required": "The Tower"},
        targets="self",
    ),
    Ability(
        id="guardian_taunt",
        name_en="Taunt",
        name_de="Provokation",
        school="guardian",
        description_en="Force all enemies to target you this round. Gain +20% evasion.",
        description_de="Alle Feinde zwingen, dich in dieser Runde anzugreifen. +20% Ausweichen.",
        min_aptitude=4,
        cooldown=2,
        effect_type="buff",
        effect_params={"buff": "taunting", "force_target_self": True, "evasion_bonus": 20, "duration": 1},
        targets="self",
    ),
    Ability(
        id="guardian_fortify",
        name_en="Fortify",
        name_de="Befestigen",
        school="guardian",
        description_en="Brace for impact. Reduce all incoming condition damage by 1 step for 2 rounds.",
        description_de="Auf Einschlag vorbereiten. Reduziert eingehenden Zustandsschaden um 1 Stufe für 2 Runden.",
        min_aptitude=5,
        cooldown=3,
        effect_type="buff",
        effect_params={"buff": "fortified", "damage_reduction": 1, "duration": 2},
        targets="self",
    ),
]

ASSASSIN_ABILITIES: list[Ability] = [
    Ability(
        id="assassin_precision_strike",
        name_en="Precision Strike",
        name_de="Präzisionsschlag",
        school="assassin",
        description_en="A targeted attack. Higher hit chance (+10%) than basic attack.",
        description_de="Ein gezielter Angriff. Höhere Trefferchance (+10%) als ein normaler Angriff.",
        min_aptitude=3,
        cooldown=0,
        effect_type="damage",
        effect_params={"hit_bonus": 10, "power": 5},
        targets="single_enemy",
    ),
    Ability(
        id="assassin_exploit",
        name_en="Exploit Weakness",
        name_de="Schwäche ausnutzen",
        school="assassin",
        description_en="Deal +1 damage step to an analyzed or debuffed enemy.",
        description_de="+1 Schadensstufe gegen einen analysierten oder geschwächten Feind.",
        min_aptitude=4,
        cooldown=1,
        effect_type="damage",
        effect_params={"power": 7, "bonus_vs_debuffed": 1},
        targets="single_enemy",
    ),
    Ability(
        id="assassin_ambush_strike",
        name_en="Ambush Strike",
        name_de="Hinterhaltschlag",
        school="assassin",
        description_en="Devastating attack from the shadows. Only usable in first round of combat or at Visibility 0.",
        description_de="Verheerender Angriff aus dem Schatten. Nur in der ersten Kampfrunde oder bei Sicht 0 einsetzbar.",
        min_aptitude=5,
        cooldown=4,
        effect_type="damage",
        effect_params={"power": 9, "requires_first_round_or_dark": True},
        targets="single_enemy",
    ),
]

PROPAGANDIST_ABILITIES: list[Ability] = [
    Ability(
        id="propagandist_inspire",
        name_en="Inspire",
        name_de="Inspirieren",
        school="propagandist",
        description_en="Rally an ally. Heal 120 stress (Review #11: increased from 75).",
        description_de="Einen Verbündeten aufmuntern. Heilt 120 Stress (Review #11: erhöht von 75).",
        min_aptitude=3,
        cooldown=1,
        effect_type="heal_stress",
        effect_params={"stress_heal": 120},
        targets="single_ally",
    ),
    Ability(
        id="propagandist_demoralize",
        name_en="Demoralize",
        name_de="Demoralisieren",
        school="propagandist",
        description_en="Shatter an enemy's confidence. Inflict stress damage and reduce their attack power by 1 for 2 rounds.",
        description_de="Das Vertrauen eines Feindes erschüttern. Verursacht Stressschaden und reduziert seine Angriffskraft um 1 für 2 Runden.",
        min_aptitude=4,
        cooldown=2,
        effect_type="stress_damage",
        effect_params={"stress_power": 5, "debuff": "demoralized", "attack_reduction": 1, "duration": 2},
        targets="single_enemy",
    ),
    Ability(
        id="propagandist_rally",
        name_en="Rally",
        name_de="Sammeln",
        school="propagandist",
        description_en="Inspire the entire party. Heal 60 stress for all allies.",
        description_de="Die gesamte Gruppe inspirieren. Heilt 60 Stress für alle Verbündeten.",
        min_aptitude=5,
        cooldown=3,
        effect_type="heal_stress",
        effect_params={"stress_heal": 60},
        targets="all_allies",
    ),
]

INFILTRATOR_ABILITIES: list[Ability] = [
    Ability(
        id="infiltrator_evade",
        name_en="Evade",
        name_de="Ausweichen",
        school="infiltrator",
        description_en="Become elusive. +30% evasion for this round, can't be targeted by attacks.",
        description_de="Ausweichend werden. +30% Ausweichen für diese Runde, kann nicht angegriffen werden.",
        min_aptitude=3,
        cooldown=1,
        effect_type="buff",
        effect_params={"buff": "evasive", "evasion_bonus": 30, "untargetable": True, "duration": 1},
        targets="self",
    ),
    Ability(
        id="infiltrator_backstab",
        name_en="Backstab",
        name_de="Hinterrücksangriff",
        school="infiltrator",
        description_en="Strike from an unexpected angle. +20% hit chance. If enemy is targeting someone else, +1 damage step.",
        description_de="Aus unerwarteter Richtung angreifen. +20% Trefferchance. +1 Schadensstufe wenn Feind jemand anderen angreift.",
        min_aptitude=4,
        cooldown=1,
        effect_type="damage",
        effect_params={"hit_bonus": 20, "power": 5, "bonus_if_enemy_targeting_other": 1},
        targets="single_enemy",
    ),
]

SABOTEUR_ABILITIES: list[Ability] = [
    Ability(
        id="saboteur_trap",
        name_en="Deploy Trap",
        name_de="Falle legen",
        school="saboteur",
        description_en="Set a trap. Next enemy to act takes 1 condition step damage automatically.",
        description_de="Eine Falle setzen. Der nächste agierende Feind erleidet automatisch 1 Stufe Zustandsschaden.",
        min_aptitude=3,
        cooldown=2,
        effect_type="utility",
        effect_params={"trap": True, "auto_damage_steps": 1},
        targets="self",
    ),
    Ability(
        id="saboteur_disrupt",
        name_en="Disrupt",
        name_de="Stören",
        school="saboteur",
        description_en="Sabotage an enemy's defenses. -15 evasion for 2 rounds.",
        description_de="Die Verteidigung eines Feindes sabotieren. -15 Ausweichen für 2 Runden.",
        min_aptitude=4,
        cooldown=2,
        effect_type="debuff",
        effect_params={"debuff": "disrupted", "evasion_penalty": 15, "duration": 2},
        targets="single_enemy",
    ),
    Ability(
        id="saboteur_detonate",
        name_en="Detonate",
        name_de="Detonieren",
        school="saboteur",
        description_en="Trigger an explosion. Deals 1 condition step to all enemies. High stress to all enemies.",
        description_de="Eine Explosion auslösen. Verursacht 1 Zustandsstufe bei allen Feinden. Hoher Stress für alle Feinde.",
        min_aptitude=5,
        cooldown=4,
        effect_type="damage",
        effect_params={"power": 6, "aoe": True, "stress_power": 4},
        targets="all_enemies",
    ),
]

# ── Universal Abilities (available to all agents regardless of aptitude) ────

UNIVERSAL_ABILITIES: list[Ability] = [
    Ability(
        id="basic_attack",
        name_en="Basic Attack",
        name_de="Grundangriff",
        school="universal",
        description_en="A standard attack. Low damage, but always available.",
        description_de="Ein Standardangriff. Geringer Schaden, aber immer verfügbar.",
        min_aptitude=0,
        cooldown=0,
        effect_type="damage",
        effect_params={"power": 3, "hit_bonus": 0},
        targets="single_enemy",
    ),
]

# ── School Registry ─────────────────────────────────────────────────────────

ALL_ABILITIES: dict[str, list[Ability]] = {
    "spy": SPY_ABILITIES,
    "guardian": GUARDIAN_ABILITIES,
    "assassin": ASSASSIN_ABILITIES,
    "propagandist": PROPAGANDIST_ABILITIES,
    "infiltrator": INFILTRATOR_ABILITIES,
    "saboteur": SABOTEUR_ABILITIES,
    "universal": UNIVERSAL_ABILITIES,
}


def get_available_abilities(
    school: str,
    aptitude_level: int,
    archetype: str | None = None,
) -> list[Ability]:
    """Get abilities available to an agent based on school, aptitude, and archetype.

    Args:
        school: Ability school name (spy, guardian, universal, etc.)
        aptitude_level: Agent's aptitude score in this school (0-9).
        archetype: Current dungeon archetype (e.g. "The Shadow", "The Tower").
            If provided, abilities with ``archetype_required`` that don't match
            are excluded.

    Returns:
        List of abilities the agent qualifies for.
    """
    from backend.services.dungeon_content_service import get_ability_registry

    school_abilities = get_ability_registry().get(school, [])
    return [
        a
        for a in school_abilities
        if aptitude_level >= a.min_aptitude
        and (
            not a.effect_params.get("archetype_required")
            or a.effect_params["archetype_required"] == archetype
        )
    ]


def get_ability_by_id(ability_id: str) -> Ability | None:
    """Look up an ability by its ID across all schools."""
    from backend.services.dungeon_content_service import get_ability_registry

    for abilities in get_ability_registry().values():
        for ability in abilities:
            if ability.id == ability_id:
                return ability
    return None


def get_agent_all_abilities(
    aptitudes: dict[str, int],
    archetype: str | None = None,
) -> list[Ability]:
    """Get all available abilities for an agent across all their aptitude schools.

    Always includes universal abilities (Basic Attack) so every agent can deal
    damage regardless of their aptitude profile.

    Args:
        aptitudes: Dict of school -> aptitude level, e.g. {"spy": 8, "guardian": 3}.
        archetype: Current dungeon archetype for filtering archetype-gated abilities.

    Returns:
        Combined list of all unlocked abilities. Always non-empty due to universal
        abilities being included unconditionally.
    """
    result: list[Ability] = []
    for school, level in aptitudes.items():
        if level > 0:
            result.extend(get_available_abilities(school, level, archetype))
    # Universal abilities are always available (Basic Attack guarantees damage)
    result.extend(get_available_abilities("universal", 0, archetype))
    return result
