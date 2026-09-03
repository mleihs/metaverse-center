"""Which dungeon loot effect actually takes hold — and where.

The Systemprüfung of 2026-08-30 found 39 of 105 loot items without any effect
path (Bericht §3.1 D4). The measurement that mattered was not the count but the
reason: content could declare an ``effect_type`` — or a parameter — that no
consumer reads, and *nothing anywhere said so*. The RPC had no ``ELSE``, so an
unknown type landed in neither ``applied`` nor ``skipped``; Python's
``dungeon_buff`` branch was a bare ``continue``.

This module is the single declaration of what the runtime does with each loot
effect. Three things read it and nothing else:

  * ``scripts/validate_content_packs.py`` — CI invariant: every loot item in
    ``content/dungeon/**/loot.yaml`` names a declared effect type, and every
    parameter it carries is one a consumer reads.
  * ``backend/services/dungeon/dungeon_run_buffs.py`` — applies the run-scoped
    buffs, and asks this module which shape it is looking at.
  * ``backend/tests/unit/test_dungeon_loot_contracts.py`` — binds the
    declaration to the call sites, the same way ``test_prompt_contracts.py``
    binds the prompt contract.

Adding a loot effect means adding its contract here first. Without one the
content pack fails CI — which is the whole point: the defect this module exists
to prevent was silent, not loud.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LootEffectContract:
    """One loot effect type and the place its effect actually happens."""

    effect_type: str
    consumer: str
    params: frozenset[str]
    optional_params: frozenset[str] = field(default_factory=frozenset)

    # Was diese Wirkung TUT, in Worten des Spielers — nicht in Worten des
    # Codes. Steht hier und nicht im Frontend, weil dort sonst eine zweite
    # Wahrheit über dieselbe Mechanik entstünde: der Vertrag sagt, WO die
    # Wirkung greift, und ein Satz daneben sagt, WAS sie bewirkt. Beides an
    # einer Stelle heißt, dass eine neue Wirkungsart ohne Erklärung genauso
    # auffällt wie eine ohne Vertrag.
    summary_en: str = ""
    summary_de: str = ""

    @property
    def known_params(self) -> frozenset[str]:
        return self.params | self.optional_params


# Parameters every item may carry regardless of type: they feed the debrief
# text, not the effect.
NARRATIVE_PARAMS: frozenset[str] = frozenset(
    {
        "description_en",
        "description_de",
        "scope",
    }
)

# ── Effects the database applies (fn_apply_dungeon_loot, 3-arg) ─────────────
# Since migration 289 the running overload handles all of these. Before it,
# `simulation_modifier` and `personality_modifier` existed only in a 6-arg
# overload that nothing has ever called.
_SQL = "fn_apply_dungeon_loot (SQL, Migr. 289)"

# ── Effects Python applies while the run is still going ─────────────────────
_RUN = "dungeon_run_buffs.apply_run_buff (Python, run-scoped)"

# ── Shapes that are declared, reachable, and deliberately NOT wired ─────────
# These are design decisions, not defects: each needs a mechanism the game does
# not have yet. They are listed here so the gate stays green *and* the gap stays
# visible. `scripts/audit_loot_effects.py` prints them with their item counts.
_OPEN = "OFFEN – Mechanik fehlt, Entscheidung des Eigentümers"


LOOT_EFFECT_CONTRACTS: dict[str, LootEffectContract] = {
    "stress_heal": LootEffectContract(
        effect_type="stress_heal",
        consumer=_SQL,
        params=frozenset({"stress_heal"}),
        optional_params=frozenset({"when"}),
        summary_en=(
            "Removes stress from the agent who carried it out. Stress is what pushes an agent toward "
            "a breakdown; a run that ends with the party frayed costs more than the loot is worth."
        ),
        summary_de=(
            "Nimmt dem Agenten, der es getragen hat, Stress ab. Stress ist das, was einen Agenten "
            "Richtung Zusammenbruch treibt; ein Lauf, der die Truppe zerrieben zurücklässt, kostet "
            "mehr, als die Beute wert ist."
        ),
    ),
    "aptitude_boost": LootEffectContract(
        effect_type="aptitude_boost",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"aptitude", "aptitude_choices", "bonus", "boost", "amount"}),
        summary_en=(
            "Raises one operative aptitude permanently. Capped at +2 per agent across all runs, so no "
            "agent becomes untouchable – the cap is the reason aptitude loot stays interesting after "
            "the third dungeon."
        ),
        summary_de=(
            "Hebt eine Operativ-Eignung dauerhaft. Über alle Läufe hinweg bei +2 je Agent gedeckelt, "
            "damit kein Agent unantastbar wird – dieser Deckel ist der Grund, warum Eignungsbeute "
            "auch nach dem dritten Dungeon noch etwas bedeutet."
        ),
    ),
    "memory": LootEffectContract(
        effect_type="memory",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"content_en", "content_de", "importance", "memory_type"}),
        summary_en=(
            "Writes a memory into the agent's stream. Memories are not decoration: the agent recalls "
            "them in conversation, and they colour how it judges people and places afterwards."
        ),
        summary_de=(
            "Schreibt eine Erinnerung in den Gedächtnisstrom des Agenten. Erinnerungen sind keine "
            "Zierde: der Agent ruft sie im Gespräch ab, und sie färben, wie er danach über Menschen "
            "und Orte urteilt."
        ),
    ),
    "moodlet": LootEffectContract(
        effect_type="moodlet",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset(
            {
                "moodlet_type",
                "emotion",
                "strength",
                "decay_type",
                "duration_ticks",
                "description_en",
                "description_de",
            }
        ),
        summary_en=(
            "Attaches a temporary mood to the agent. Moods shift behaviour while they last and expire "
            "on their own – the only loot class that is deliberately impermanent."
        ),
        summary_de=(
            "Heftet dem Agenten eine zeitweilige Stimmung an. Stimmungen verschieben das Verhalten, "
            "solange sie halten, und laufen von selbst aus – die einzige Beuteklasse, die mit Absicht "
            "vergänglich ist."
        ),
    ),
    "event_modifier": LootEffectContract(
        effect_type="event_modifier",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"impact_level_reduction", "duration_ticks", "event_type"}),
        summary_en=(
            "Changes how likely certain world events become. It does not fire an event; it tilts the "
            "dice for the cycles that follow."
        ),
        summary_de=(
            "Verändert, wie wahrscheinlich bestimmte Weltereignisse werden. Es löst kein Ereignis "
            "aus, es kippt die Würfel für die folgenden Zyklen."
        ),
    ),
    "arc_modifier": LootEffectContract(
        effect_type="arc_modifier",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"arc_type", "progress_boost", "duration_ticks"}),
        summary_en=(
            "Nudges a running narrative arc. Arcs are the long stories a world tells itself; this "
            "loot pushes one a step along or holds it back."
        ),
        summary_de=(
            "Stupst einen laufenden Erzählbogen an. Bögen sind die langen Geschichten, die eine Welt "
            "sich selbst erzählt; diese Beute schiebt einen weiter oder hält ihn auf."
        ),
    ),
    "permanent_dungeon_bonus": LootEffectContract(
        effect_type="permanent_dungeon_bonus",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"aptitude", "bonus", "archetype", "check_bonus"}),
        summary_en=(
            "A bonus the agent keeps in every future dungeon. The rarest shape: it changes not this "
            "run but every run afterwards."
        ),
        summary_de=(
            "Ein Bonus, den der Agent in jeden künftigen Dungeon mitnimmt. Die seltenste Form: sie "
            "verändert nicht diesen Lauf, sondern jeden danach."
        ),
    ),
    "next_dungeon_bonus": LootEffectContract(
        effect_type="next_dungeon_bonus",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"aptitude", "bonus", "archetype", "check_bonus"}),
        summary_en=("A bonus for the next run only. Spend it or lose it – it does not stack and it does not wait."),
        summary_de=(
            "Ein Bonus nur für den nächsten Lauf. Einlösen oder verlieren – er stapelt sich nicht und wartet nicht."
        ),
    ),
    "simulation_modifier": LootEffectContract(
        effect_type="simulation_modifier",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset(
            {
                "morale_boost",
                "security_boost",
                "building_protection",
                "overall_health_bonus",
                "boost_amount",
                "duration_ticks",
                "min_condition",
            }
        ),
        summary_en=(
            "Alters a value of the whole world, not of one agent. The reach is wider and the effect "
            "correspondingly quieter."
        ),
        summary_de=(
            "Verändert einen Wert der ganzen Welt, nicht eines Agenten. Die Reichweite ist größer und "
            "die Wirkung entsprechend leiser."
        ),
    ),
    "personality_modifier": LootEffectContract(
        effect_type="personality_modifier",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"trait", "dimension", "delta", "big_five_delta", "player_choice"}),
        summary_en=(
            "Shifts a personality trait. An agent whose conscientiousness moves does not merely score "
            "differently – it wants different things, and its needs decay at a different pace."
        ),
        summary_de=(
            "Verschiebt einen Persönlichkeitszug. Ein Agent, dessen Gewissenhaftigkeit sich bewegt, "
            "rechnet nicht bloß anders – er will anderes, und seine Bedürfnisse verfallen in anderem "
            "Takt."
        ),
    ),
    "building_repair": LootEffectContract(
        effect_type="building_repair",
        consumer=_SQL,
        params=frozenset(),
        optional_params=frozenset({"condition_improvement", "condition_tiers"}),
        summary_en=(
            "Lifts the world's most damaged building one rung up its own condition ladder. This is "
            "the ONLY way a building recovers: nothing heals with time, and there is no repair menu. "
            "Condition feeds embassy effectiveness at 40 % of the score, so a ruin is not cosmetic."
        ),
        summary_de=(
            "Hebt den am stärksten beschädigten Bau der Welt um eine Sprosse seiner eigenen "
            "Zustandsleiter. Das ist der EINZIGE Weg, auf dem ein Bau sich erholt: nichts heilt mit "
            "der Zeit, und ein Reparaturmenü gibt es nicht. Der Zustand speist die Botschafts- "
            "Wirksamkeit mit 40 % – eine Ruine ist also nicht kosmetisch."
        ),
    ),
    "dungeon_buff": LootEffectContract(
        effect_type="dungeon_buff",
        consumer=_RUN,
        params=frozenset(),
        optional_params=frozenset(
            {
                "aptitude",
                "check_bonus",
                "stress_resist",
                "duration_rooms",
                "rest_bonus",
                # shapes without a mechanism yet — see BUFF_SHAPES below
                "stress_damage_bonus",
                "bonus_pct",
                "aptitude_boost",
                "archetype",
                "reveal_rest_rooms",
            }
        ),
        summary_en=(
            "Helps inside the running dungeon and ends with it. Which help depends on the parameter "
            "it carries – see BUFF_SHAPES below; it is the one type whose consumer is decided by its "
            "shape."
        ),
        summary_de=(
            "Hilft innerhalb des laufenden Dungeons und endet mit ihm. Welche Hilfe, entscheidet der "
            "mitgeführte Parameter – siehe BUFF_SHAPES weiter unten; es ist die einzige Art, deren "
            "Verbraucher von ihrer Form abhängt."
        ),
    ),
}


# ── dungeon_buff: which shape does what ─────────────────────────────────────
# `dungeon_buff` is the one type whose consumer depends on WHICH parameter is
# present. Each entry maps the deciding parameter to its consumer, so the audit
# script and the applier read the same table.


@dataclass(frozen=True)
class BuffShape:
    """One `dungeon_buff` parameter shape and what the runtime does with it."""

    key: str
    consumer: str
    reason: str = ""


BUFF_SHAPES: dict[str, BuffShape] = {
    "check_bonus": BuffShape(
        key="check_bonus",
        consumer=_RUN,
        reason="addiert auf den Aptitude-Bonus der Fertigkeitsproben dieses Laufs "
        "(derselbe Sammler, den der Deluge-Schutt seit jeher benutzt)",
    ),
    "stress_resist": BuffShape(
        key="stress_resist",
        consumer=_RUN,
        reason="senkt den Umgebungsstress für `duration_rooms` Räume",
    ),
    "rest_bonus": BuffShape(
        key="rest_bonus",
        consumer=_RUN,
        reason="erhöht die Heilung an Rastplätzen dieses Laufs",
    ),
    "stress_damage_bonus": BuffShape(
        key="stress_damage_bonus",
        consumer=_OPEN,
        reason="bräuchte einen Weg vom Laufzustand in `combat_engine`, das heute "
        "eine reine Funktion ohne Zugriff auf `archetype_state` ist",
    ),
    "bonus_pct": BuffShape(
        key="bonus_pct",
        consumer=_OPEN,
        reason="Einheit unklar: Prozent worauf? `check_bonus` ist ein flacher "
        "Zuschlag auf denselben Wurf – beides zugleich wäre zweideutig",
    ),
    "aptitude_boost": BuffShape(
        key="aptitude_boost",
        consumer=_OPEN,
        reason="`scope: archetype` verlangt Wirkung über den Lauf hinaus; dafür "
        "gäbe es `permanent_dungeon_bonus`, das der Inhalt hier nicht wählt",
    ),
    "reveal_rest_rooms": BuffShape(
        key="reveal_rest_rooms",
        consumer=_OPEN,
        reason="`scope: next_run` verlangt Wirkung über den Lauf hinaus (s. o.)",
    ),
}

#: Shapes the runtime actually applies. The applier iterates this.
WIRED_BUFF_KEYS: frozenset[str] = frozenset(key for key, shape in BUFF_SHAPES.items() if shape.consumer != _OPEN)

#: Shapes that are declared and deliberately open.
OPEN_BUFF_KEYS: frozenset[str] = frozenset(BUFF_SHAPES) - WIRED_BUFF_KEYS


# ── Parameter, die der Inhalt trägt und niemand liest ───────────────────────
# Nachgemessen am 30.08.2026: keiner dieser Namen wird irgendwo aus
# `effect_params` gelesen. (Mehrere von ihnen kommen im Backend gleichnamig vor
# — `start_visibility` in der Archetyp-Mechanik, `mood_delta` in den
# Agenten-Ergebnissen, `pressure_reduction` in den Bureau-Antworten. Das ist
# Namensgleichheit, kein Leser: geprüft, nicht vermutet.)
#
# Sie stehen hier, damit das CI-Tor HART sein kann, ohne dass ich still eine
# Gestaltungsentscheidung treffe. Ein NEUER unerklärter Parameter ist rot; diese
# hier sind eine Liste zum Entscheiden, nicht ein Freibrief.
UNREAD_PARAMS: dict[tuple[str, str], str] = {
    # Der RPC legt `effect_params` vollständig in `agent_dungeon_loot_effects`
    # ab — aber beim Start des nächsten Laufs liest sie niemand zurück. Der
    # Bericht zählt das als „8 *_dungeon_bonus werden gespeichert und von nichts
    # gelesen"; es sind mit den Feldern hier genau diese.
    ("next_dungeon_bonus", "start_stability"): "kein Leser beim Laufstart",
    ("next_dungeon_bonus", "start_visibility"): "kein Leser beim Laufstart",
    ("next_dungeon_bonus", "start_decay"): "kein Leser beim Laufstart",
    ("next_dungeon_bonus", "all_rooms_revealed"): "kein Leser beim Laufstart",
    ("next_dungeon_bonus", "bonus_type"): "kein Leser beim Laufstart",
    ("next_dungeon_bonus", "value"): "kein Leser beim Laufstart",
    ("permanent_dungeon_bonus", "bonus_type"): "kein Leser beim Laufstart",
    # Der Deckel steht fest im RPC (+2, CAS-gesichert); eine Dauer hat ein
    # dauerhafter Zuwachs ohnehin nicht.
    ("aptitude_boost", "max_total_bonus"): "Deckel steht fest im RPC (+2)",
    ("aptitude_boost", "max_total_boost"): "Deckel steht fest im RPC (+2)",
    ("aptitude_boost", "duration_rooms"): "dauerhafter Zuwachs kennt keine Dauer",
    # Es gibt kein Verhaltenssystem, das eine Erinnerung auswerten würde.
    ("memory", "behavior_effect"): "kein Verhaltenssystem liest Erinnerungen aus",
    # Der RPC liest `moodlet_type` und `strength`.
    ("moodlet", "moodlet_id"): "RPC liest moodlet_type",
    ("moodlet", "mood_delta"): "RPC liest strength",
    # Der RPC liest `impact_level_reduction`.
    ("event_modifier", "impact_level"): "RPC liest impact_level_reduction",
    ("event_modifier", "benefit"): "reiner Beschreibungstext",
    ("event_modifier", "cost"): "reiner Beschreibungstext",
    ("event_modifier", "modifier"): "RPC liest impact_level_reduction",
    ("arc_modifier", "pressure_reduction"): "RPC liest die Bogen-Felder",
    ("arc_modifier", "arc_effect"): "RPC liest die Bogen-Felder",
}


def unknown_params(effect_type: str, params: dict) -> list[str]:
    """Parameters this item carries that no consumer reads and no entry excuses.

    Returns the names, sorted, so the caller can name them in one message.
    """
    contract = LOOT_EFFECT_CONTRACTS.get(effect_type)
    if contract is None:
        return sorted(params)
    return sorted(
        name
        for name in params
        if name not in contract.known_params
        and name not in NARRATIVE_PARAMS
        and (effect_type, name) not in UNREAD_PARAMS
    )
