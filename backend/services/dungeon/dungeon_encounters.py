"""Shadow encounter templates — 10 complete encounters for Phase 0 MVP.

All text is bilingual (en/de) inline per architecture decision #3.

Encounter types:
  4 combat: "Whispers in the Dark", "The Patrol", "Ambush!", "The Haunting"
  3 encounter: "The Prisoner", "The Mirror Room", "Echoes of the Past"
  1 elite: "The Remnant"
  1 rest: "The Hollow"
  1 treasure: "Shadow Cache"
"""

from __future__ import annotations

import random

from backend.models.resonance_dungeon import EncounterChoice, EncounterTemplate

# ── Combat Encounters (4) ───────────────────────────────────────────────────

SHADOW_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_whispers_in_dark",
        archetype="The Shadow",
        room_type="combat",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "The air thickens. Two points of cold light drift at the edges of your vision, "
            "circling like predators testing prey. The whispers start \u2014 not words, "
            "but the memory of words, scraping against certainty."
        ),
        description_de=(
            "Die Luft wird dicker. Zwei Punkte kalten Lichts treiben am Rand eures "
            "Blickfelds, kreisen wie Raubtiere, die Beute testen. Das Fluestern beginnt "
            "\u2014 keine Worte, sondern die Erinnerung an Worte, die an der Gewissheit kratzen."
        ),
        combat_encounter_id="shadow_whispers_spawn",
    ),
    EncounterTemplate(
        id="shadow_the_patrol",
        archetype="The Shadow",
        room_type="combat",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "Movement ahead \u2014 rhythmic, predictable. An echo of violence stalks this corridor "
            "with mechanical precision, a tendril of shadow coiling behind it like a leash. "
            "They haven't noticed you yet."
        ),
        description_de=(
            "Bewegung voraus \u2014 rhythmisch, vorhersehbar. Ein Gewaltecho durchstreift diesen "
            "Korridor mit mechanischer Prazision, ein Schattenfaden windet sich hinter ihm "
            "wie eine Leine. Sie haben euch noch nicht bemerkt."
        ),
        combat_encounter_id="shadow_patrol_spawn",
        requires_aptitude={"infiltrator": 5},  # bypass option
    ),
    EncounterTemplate(
        id="shadow_ambush",
        archetype="The Shadow",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "CONTACT! They were waiting. The darkness erupts \u2014 two echoes of violence, "
            "already moving, already striking. No time to plan. No time to think."
        ),
        description_de=(
            "KONTAKT! Sie haben gewartet. Die Dunkelheit bricht aus \u2014 zwei Gewaltechos, "
            "bereits in Bewegung, bereits zuschlagend. Keine Zeit zu planen. Keine Zeit zu denken."
        ),
        combat_encounter_id="shadow_ambush_spawn",
        is_ambush=True,
        ambush_stress=100,
    ),
    EncounterTemplate(
        id="shadow_the_haunting",
        archetype="The Shadow",
        room_type="combat",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The whispers change. They become specific \u2014 names, fears, secrets your agents "
            "thought were private. A paranoia shade drifts at the center, flanked by wisps "
            "whose movements no longer match their telegraphed intents. Nothing here is honest."
        ),
        description_de=(
            "Das Fluestern verandert sich. Es wird spezifisch \u2014 Namen, Aengste, Geheimnisse, "
            "die eure Agenten fuer privat hielten. Ein Paranoiaschatten treibt im Zentrum, "
            "flankiert von Glimmern, deren Bewegungen nicht mehr zu ihren angezeigten "
            "Absichten passen. Nichts hier ist ehrlich."
        ),
        combat_encounter_id="shadow_haunting_spawn",
    ),
]

# ── Narrative Encounters (3) ────────────────────────────────────────────────

SHADOW_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_the_prisoner",
        archetype="The Shadow",
        room_type="encounter",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A cage of solidified shadow. Inside, something that was once human curls in on "
            "itself, whimpering. It looks up with eyes that hold no light.\n\n"
            '"Please," it says. "I\'ve been here since the last resonance. I remember sunlight."'
        ),
        description_de=(
            "Ein Kafig aus verfestigtem Schatten. Darin kauert etwas, das einmal menschlich war, "
            "und wimmert. Es blickt auf mit Augen, die kein Licht halten.\n\n"
            "\u00bbBitte\u00ab, sagt es. \u00bbIch bin hier seit der letzten Resonanz. "
            "Ich erinnere mich an Sonnenlicht.\u00ab"
        ),
        choices=[
            EncounterChoice(
                id="free_prisoner",
                label_en="Free the prisoner",
                label_de="Den Gefangenen befreien",
                check_aptitude="guardian",
                check_difficulty=0,
                success_effects={"stress": -30, "visibility": 1, "discovery": True},
                partial_effects={"stress": 20},
                fail_effects={"stress": 80, "ambush_trigger": True},
                success_narrative_en="The shadow cage dissolves. The prisoner fades with a grateful whisper, leaving behind a faint glow that restores your sight.",
                success_narrative_de="Der Schattenkafig lost sich auf. Der Gefangene verblasst mit einem dankbaren Fluestern und hinterlasst ein schwaches Leuchten, das eure Sicht wiederherstellt.",
                partial_narrative_en="The cage cracks but doesn't break cleanly. The prisoner slips free but something else slips out with it.",
                partial_narrative_de="Der Kafig bricht, aber nicht sauber. Der Gefangene entkommt, aber etwas anderes entkommt mit ihm.",
                fail_narrative_en="The cage was a trap. The 'prisoner' dissolves into shadow tendrils that lash out at the party.",
                fail_narrative_de="Der Kafig war eine Falle. Der 'Gefangene' lost sich in Schattenfaden auf, die nach der Gruppe schlagen.",
            ),
            EncounterChoice(
                id="interrogate_prisoner",
                label_en="Interrogate it first",
                label_de="Zuerst verhoeren",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 2, "stress": 10},
                partial_effects={"reveal_rooms": 1, "stress": 30},
                fail_effects={"stress": 50},
                success_narrative_en="Your questions cut through its delirium. It reveals the layout of adjacent rooms before fading.",
                success_narrative_de="Eure Fragen durchschneiden sein Delirium. Es enthuellt die Anordnung benachbarter Raume, bevor es verblasst.",
                partial_narrative_en="It answers in fragments. Some of what it says is useful.",
                partial_narrative_de="Es antwortet in Fragmenten. Manches davon ist nuetzlich.",
                fail_narrative_en="It screams. The sound carries. Something in the next room stirs.",
                fail_narrative_de="Es schreit. Der Laut tragt. Etwas im nachsten Raum regt sich.",
            ),
            EncounterChoice(
                id="leave_prisoner",
                label_en="Leave it",
                label_de="Zuruecklassen",
                success_effects={"stress": 20},
                success_narrative_en="You walk away. Behind you, the whimpering fades into silence. Some agents look back. Others don't.",
                success_narrative_de="Ihr geht weiter. Hinter euch verblasst das Wimmern in Stille. Manche Agenten blicken zurueck. Andere nicht.",
            ),
            EncounterChoice(
                id="destroy_prisoner",
                label_en="End its suffering",
                label_de="Sein Leiden beenden",
                requires_aptitude={"assassin": 3},
                success_effects={"stress": -10, "shadow_resonance": 0.05},
                success_narrative_en="A clean strike. The shadow dissolves. The mercy of it echoes in the dark.",
                success_narrative_de="Ein sauberer Schlag. Der Schatten lost sich auf. Die Gnade hallt in der Dunkelheit nach.",
            ),
        ],
    ),
    EncounterTemplate(
        id="shadow_mirror_room",
        archetype="The Shadow",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "The walls are mirrors \u2014 but wrong. Each agent sees themselves, distorted. "
            "Features exaggerated, expressions twisted into something they fear they truly are. "
            "The reflections move independently."
        ),
        description_de=(
            "Die Wande sind Spiegel \u2014 aber falsch. Jeder Agent sieht sich selbst, verzerrt. "
            "Zuege uebertrieben, Ausdruecke verdreht zu etwas, von dem sie fuerchten, "
            "es wirklich zu sein. Die Spiegelbilder bewegen sich unabhaengig."
        ),
        choices=[
            EncounterChoice(
                id="confront_reflection",
                label_en="Confront the reflection",
                label_de="Dem Spiegelbild entgegentreten",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"resilience_bonus": 0.05, "stress": -50},
                partial_effects={"stress": 50},
                fail_effects={"stress": 100},
                success_narrative_en="The agent stares their shadow-self down. The mirror cracks. In the silence that follows, something fundamental settles.",
                success_narrative_de="Der Agent stellt sich seinem Schatten-Ich. Der Spiegel bricht. In der folgenden Stille legt sich etwas Grundlegendes.",
                partial_narrative_en="The confrontation is painful but inconclusive. The reflection retreats, but doesn't break.",
                partial_narrative_de="Die Konfrontation ist schmerzhaft, aber ergebnislos. Das Spiegelbild weicht zurueck, bricht aber nicht.",
                fail_narrative_en="The reflection speaks the agent's worst fear aloud. The words hang in the air, impossible to unhear.",
                fail_narrative_de="Das Spiegelbild spricht die schlimmste Angst des Agenten laut aus. Die Worte hangen in der Luft, unmoglich zu ueberhoren.",
            ),
            EncounterChoice(
                id="analyze_mirrors",
                label_en="Analyze the mirrors (Spy)",
                label_de="Spiegel analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"reveal_rooms": 1, "stress": 0},
                partial_effects={"stress": 20},
                fail_effects={"stress": 40},
                success_narrative_en="The mirrors aren't just reflecting \u2014 they're showing adjacent rooms. You map what you see.",
                success_narrative_de="Die Spiegel reflektieren nicht nur \u2014 sie zeigen angrenzende Raume. Ihr kartiert, was ihr seht.",
            ),
            EncounterChoice(
                id="smash_mirrors",
                label_en="Smash the mirrors",
                label_de="Spiegel zerschlagen",
                requires_aptitude={"assassin": 3},
                success_effects={"stress": 30, "visibility": -1},
                success_narrative_en="Glass shatters. The reflections scream. Darkness pours from the broken frames.",
                success_narrative_de="Glas zersplittert. Die Spiegelbilder schreien. Dunkelheit stroemt aus den zerbrochenen Rahmen.",
            ),
        ],
    ),
    EncounterTemplate(
        id="shadow_echoes_of_past",
        archetype="The Shadow",
        room_type="encounter",
        min_depth=3,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "The room replays a scene from your simulation's history \u2014 a real event, "
            "distorted by shadow. The agents involved are here, or echoes of them. "
            "The moment crystallizes, waiting for a different choice."
        ),
        description_de=(
            "Der Raum spielt eine Szene aus der Geschichte eurer Simulation nach \u2014 "
            "ein reales Ereignis, verzerrt durch Schatten. Die beteiligten Agenten "
            "sind hier, oder Echos von ihnen. Der Moment kristallisiert sich, "
            "wartend auf eine andere Entscheidung."
        ),
        choices=[
            EncounterChoice(
                id="choose_differently",
                label_en="Make a different choice",
                label_de="Anders entscheiden",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"memory_created": True, "stress": -30, "insight": True},
                partial_effects={"stress": 30, "memory_created": True},
                fail_effects={"stress": 80},
                success_narrative_en="History shifts. The echo replays with your change, and something in the fabric of the simulation relaxes.",
                success_narrative_de="Die Geschichte verschiebt sich. Das Echo spielt sich mit eurer Aenderung ab, und etwas im Gewebe der Simulation entspannt sich.",
            ),
            EncounterChoice(
                id="observe_replay",
                label_en="Observe without intervening",
                label_de="Beobachten ohne einzugreifen",
                check_aptitude="spy",
                check_difficulty=-10,
                success_effects={"reveal_rooms": 1, "stress": 10},
                success_narrative_en="Watching history repeat itself is painful, but instructive. You learn something about the patterns at work here.",
                success_narrative_de="Zuzusehen, wie sich Geschichte wiederholt, ist schmerzhaft, aber lehrreich. Ihr lernt etwas ueber die Muster, die hier am Werk sind.",
            ),
        ],
    ),
]

# ── Elite Encounter (1) ─────────────────────────────────────────────────────

SHADOW_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_the_remnant",
        archetype="The Shadow",
        room_type="elite",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The darkness coalesces. A shape forms \u2014 massive, deliberate, ancient. "
            "This is The Remnant: formed from the simulation's strongest unresolved conflict. "
            "It remembers what your agents have tried to forget. Wisps orbit it like satellites."
        ),
        description_de=(
            "Die Dunkelheit verdichtet sich. Eine Gestalt formt sich \u2014 massiv, bedacht, uralt. "
            "Das ist Der Ueberrest: geformt aus dem staerksten ungeloesten Konflikt der Simulation. "
            "Er erinnert sich an das, was eure Agenten zu vergessen versucht haben. "
            "Glimmer umkreisen ihn wie Satelliten."
        ),
        combat_encounter_id="shadow_remnant_spawn",
    ),
]

# ── Rest Encounter (1) ──────────────────────────────────────────────────────

SHADOW_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_the_hollow",
        archetype="The Shadow",
        room_type="rest",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A gap in the darkness \u2014 not light, exactly, but the absence of active malice. "
            "The walls here are smooth, untouched. The air is still. For the first time "
            "since entering, you can hear your own breathing."
        ),
        description_de=(
            "Eine Luecke in der Dunkelheit \u2014 kein Licht, genau genommen, aber die Abwesenheit "
            "aktiver Bosartigkeit. Die Wande hier sind glatt, unberuehrt. Die Luft ist still. "
            "Zum ersten Mal seit dem Eintritt koennt ihr euer eigenes Atmen hoeren."
        ),
        choices=[
            EncounterChoice(
                id="rest_full",
                label_en="Rest (heal stress, risk ambush)",
                label_de="Rasten (Stress heilen, Hinterhalt-Risiko)",
                success_effects={"stress_heal": 200, "wounded_to_stressed": True, "ambush_chance": 0.20},
                success_narrative_en="The party rests. Stress fades. Wounds knit. For a while, the darkness forgets you.",
                success_narrative_de="Die Gruppe rastet. Stress verblasst. Wunden schliessen sich. Fuer eine Weile vergisst die Dunkelheit euch.",
            ),
            EncounterChoice(
                id="rest_guarded",
                label_en="Post a Guardian watch (safe, but Guardian doesn't heal)",
                label_de="Waechter aufstellen (sicher, aber Waechter heilt nicht)",
                requires_aptitude={"guardian": 3},
                success_effects={"stress_heal": 200, "wounded_to_stressed": True, "guardian_no_heal": True},
                success_narrative_en="The Guardian stands watch while others rest. No ambush comes. But the Guardian's own wounds remain.",
                success_narrative_de="Der Waechter haelt Wache, wahrend die anderen rasten. Kein Hinterhalt kommt. Aber die eigenen Wunden des Waechters bleiben.",
            ),
        ],
    ),
]

# ── Treasure Encounter (1) ──────────────────────────────────────────────────

SHADOW_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_cache",
        archetype="The Shadow",
        room_type="treasure",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A shadow cache \u2014 a pocket of crystallized darkness containing something valuable. "
            "The container is locked with mechanisms that respond to finesse, not force."
        ),
        description_de=(
            "Ein Schattenversteck \u2014 eine Tasche aus kristallisierter Dunkelheit, die etwas "
            "Wertvolles enthaelt. Der Behalter ist mit Mechanismen verschlossen, "
            "die auf Geschick reagieren, nicht auf Gewalt."
        ),
        choices=[
            EncounterChoice(
                id="open_cache",
                label_en="Pick the lock (Infiltrator)",
                label_de="Schloss knacken (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=0,
                success_effects={"loot": True, "loot_bonus_at_vp0": True},
                partial_effects={"loot": True, "loot_tier_penalty": 1},
                fail_effects={"stress": 75, "trap_triggered": True},
                success_narrative_en="The mechanism clicks open. Inside: shadows that have hardened into something useful.",
                success_narrative_de="Der Mechanismus klickt auf. Darin: Schatten, die sich zu etwas Nuetzlichem verhartet haben.",
                partial_narrative_en="Partially opened. Some contents spill and dissolve before you can grab them.",
                partial_narrative_de="Teilweise geoeffnet. Einige Inhalte verschuetten sich und loesen sich auf, bevor ihr sie greifen koennt.",
                fail_narrative_en="A trap! Shadow energy lashes out, scoring the opener's psyche.",
                fail_narrative_de="Eine Falle! Schattenenergie peitscht hervor und zeichnet die Psyche des Oeffnenden.",
            ),
            EncounterChoice(
                id="force_cache",
                label_en="Force it open (Saboteur)",
                label_de="Aufbrechen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"loot": True},
                partial_effects={"loot": True, "loot_tier_penalty": 1, "stress": 30},
                fail_effects={"stress": 50},
                success_narrative_en="Controlled demolition. The container shatters on your terms.",
                success_narrative_de="Kontrollierte Sprengung. Der Behalter zerbricht nach euren Regeln.",
            ),
            EncounterChoice(
                id="leave_cache",
                label_en="Leave it (no risk)",
                label_de="Liegenlassen (kein Risiko)",
                success_effects={},
                success_narrative_en="Sometimes the safest option is the wisest. You move on.",
                success_narrative_de="Manchmal ist die sicherste Option die kluegste. Ihr geht weiter.",
            ),
        ],
    ),
]


# ── Registry ────────────────────────────────────────────────────────────────

ALL_SHADOW_ENCOUNTERS: list[EncounterTemplate] = (
    SHADOW_COMBAT_ENCOUNTERS
    + SHADOW_NARRATIVE_ENCOUNTERS
    + SHADOW_ELITE_ENCOUNTERS
    + SHADOW_REST_ENCOUNTERS
    + SHADOW_TREASURE_ENCOUNTERS
)

_ENCOUNTER_BY_ID: dict[str, EncounterTemplate] = {e.id: e for e in ALL_SHADOW_ENCOUNTERS}


def get_encounter_by_id(encounter_id: str) -> EncounterTemplate | None:
    """Look up an encounter template by ID."""
    return _ENCOUNTER_BY_ID.get(encounter_id)


def select_encounter(
    room_type: str,
    depth: int,
    difficulty: int,
    archetype: str = "The Shadow",
) -> EncounterTemplate | None:
    """Select an appropriate encounter for a room.

    Filters by room_type, depth, difficulty, and archetype.
    Returns None if no matching encounter exists (shouldn't happen for Shadow).
    """
    candidates = [
        e
        for e in ALL_SHADOW_ENCOUNTERS
        if e.room_type == room_type
        and e.min_depth <= depth <= e.max_depth
        and difficulty >= e.min_difficulty
        and e.archetype == archetype
    ]
    if not candidates:
        return None
    return random.choice(candidates)


# ── Banter Templates ────────────────────────────────────────────────────────
# 40+ templates for between-encounter dialogue. Personality/opinion filtered.
# NOT LLM-generated (too slow). Template pool per trigger.

SHADOW_BANTER: list[dict] = [
    # Room entered — general
    {
        "id": "sb_01",
        "trigger": "room_entered",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} flinches at a sound only they can hear.",
        "text_de": "{agent} zuckt bei einem Gerausch zusammen, das nur sie hoeren.",
    },
    {
        "id": "sb_02",
        "trigger": "room_entered",
        "personality_filter": {"extraversion": (0.0, 0.3)},
        "text_en": "{agent} says nothing, but their hand hasn't left their weapon.",
        "text_de": "{agent} sagt nichts, aber die Hand hat die Waffe nicht losgelassen.",
    },
    {
        "id": "sb_03",
        "trigger": "room_entered",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'The darkness isn't empty. It's... full of something.'",
        "text_de": "{agent}: \u00bbDie Dunkelheit ist nicht leer. Sie ist... voll von etwas.\u00ab",
    },
    {
        "id": "sb_04",
        "trigger": "room_entered",
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} checks their equipment methodically. Everything in order. Again.",
        "text_de": "{agent} ueberprueft methodisch die Ausruestung. Alles in Ordnung. Wieder.",
    },
    {
        "id": "sb_05",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "The terminal flickers. For a moment, the amber glow is the only light in the world.",
        "text_de": "Das Terminal flackert. Fuer einen Moment ist das Bernsteinleuchten das einzige Licht auf der Welt.",
    },
    # Combat won
    {
        "id": "sb_06",
        "trigger": "combat_won",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} checks on each party member before allowing themselves to breathe.",
        "text_de": "{agent} sieht nach jedem Gruppenmitglied, bevor sie sich erlauben durchzuatmen.",
    },
    {
        "id": "sb_07",
        "trigger": "combat_won",
        "personality_filter": {"extraversion": (0.7, 1.0)},
        "text_en": "{agent}: 'That's what happens. That's what happens when you come at us.'",
        "text_de": "{agent}: \u00bbDas passiert. Das passiert, wenn man sich mit uns anlegt.\u00ab",
    },
    {
        "id": "sb_08",
        "trigger": "combat_won",
        "personality_filter": {"neuroticism": (0.0, 0.3)},
        "text_en": "{agent} wipes their blade clean. Professional. Done.",
        "text_de": "{agent} wischt die Klinge sauber. Professionell. Erledigt.",
    },
    {
        "id": "sb_09",
        "trigger": "combat_won",
        "personality_filter": {},
        "text_en": "Silence returns. It's never comforting here.",
        "text_de": "Die Stille kehrt zurueck. Hier ist sie nie troestlich.",
    },
    # Visibility zero
    {
        "id": "sb_10",
        "trigger": "visibility_zero",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'I can feel the walls. They're closer than they should be.'",
        "text_de": "{agent}: \u00bbIch kann die Wande spueren. Sie sind naher als sie sein sollten.\u00ab",
    },
    {
        "id": "sb_11",
        "trigger": "visibility_zero",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}'s breathing accelerates. They're counting their own heartbeats.",
        "text_de": "{agent}s Atem beschleunigt sich. Sie zahlen ihre eigenen Herzschlage.",
    },
    {
        "id": "sb_12",
        "trigger": "visibility_zero",
        "personality_filter": {},
        "text_en": "The instruments read nothing. Not zero \u2014 nothing. As if measurement itself has been consumed.",
        "text_de": "Die Instrumente zeigen nichts an. Nicht Null \u2014 nichts. Als ware das Messen selbst verschlungen worden.",
    },
    # Agent stressed
    {
        "id": "sb_13",
        "trigger": "agent_stressed",
        "personality_filter": {"extraversion": (0.6, 1.0)},
        "text_en": "{agent} mutters: 'I'm fine. I said I'm FINE.'",
        "text_de": "{agent} murmelt: \u00bbMir geht's gut. Ich SAGTE, mir geht's gut.\u00ab",
    },
    {
        "id": "sb_14",
        "trigger": "agent_stressed",
        "personality_filter": {"agreeableness": (0.0, 0.3)},
        "text_en": "{agent}'s expression hardens. They stop looking at the others.",
        "text_de": "{agent}s Ausdruck verhartet sich. Sie hoeren auf, die anderen anzusehen.",
    },
    # Opinion-driven (positive pair)
    {
        "id": "sb_15",
        "trigger": "combat_won",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} nods at {agent_b}. No words needed.",
        "text_de": "{agent_a} nickt {agent_b} zu. Keine Worte noetig.",
    },
    {
        "id": "sb_16",
        "trigger": "room_entered",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} and {agent_b} move in practiced coordination, covering each other's blind spots.",
        "text_de": "{agent_a} und {agent_b} bewegen sich in eingeuebter Koordination und decken die toten Winkel des anderen.",
    },
    # Opinion-driven (negative pair)
    {
        "id": "sb_17",
        "trigger": "agent_stressed",
        "personality_filter": {"opinion_negative_pair": True},
        "text_en": "{agent_a} glances at {agent_b} with something that isn't concern.",
        "text_de": "{agent_a} blickt {agent_b} an mit etwas, das keine Sorge ist.",
    },
    {
        "id": "sb_18",
        "trigger": "combat_won",
        "personality_filter": {"opinion_negative_pair": True},
        "text_en": "{agent_a}: 'Next time, try not to be in my line of fire, {agent_b}.'",
        "text_de": "{agent_a}: \u00bbNachstes Mal versuch nicht in meiner Schusslinie zu stehen, {agent_b}.\u00ab",
    },
    # Treasure found
    {
        "id": "sb_19",
        "trigger": "loot_found",
        "personality_filter": {"conscientiousness": (0.0, 0.4)},
        "text_en": "{agent} pockets something before anyone else notices. Old habits.",
        "text_de": "{agent} steckt etwas ein, bevor es jemand bemerkt. Alte Gewohnheiten.",
    },
    {
        "id": "sb_20",
        "trigger": "loot_found",
        "personality_filter": {},
        "text_en": "The shadow residue is cold to the touch. It hums faintly, like a tuning fork struck in the dark.",
        "text_de": "Der Schattenrueckstand ist kalt bei Beruehrung. Er summt leise, wie eine Stimmgabel, die im Dunkeln angeschlagen wurde.",
    },
    # Rest site
    {
        "id": "sb_21",
        "trigger": "rest_start",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} can't rest. They sit in the corner, watching the entrance.",
        "text_de": "{agent} kann nicht rasten. Sie sitzen in der Ecke und beobachten den Eingang.",
    },
    {
        "id": "sb_22",
        "trigger": "rest_start",
        "personality_filter": {"extraversion": (0.6, 1.0)},
        "text_en": "{agent} tries to lighten the mood: 'Anyone else feel like this is the worst holiday they've ever been on?'",
        "text_de": "{agent} versucht die Stimmung aufzulockern: \u00bbGeht es noch jemandem so, dass das der schlimmste Urlaub ist, auf dem sie je waren?\u00ab",
    },
    {
        "id": "sb_23",
        "trigger": "rest_start",
        "personality_filter": {},
        "text_en": "The hollow is silent. For a few minutes, the party breathes.",
        "text_de": "Die Hohle ist still. Fuer ein paar Minuten atmet die Gruppe.",
    },
    # Depth transitions
    {
        "id": "sb_24",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "Deeper. The air pressure changes. Your ears pop.",
        "text_de": "Tiefer. Der Luftdruck andert sich. Eure Ohren knacken.",
    },
    {
        "id": "sb_25",
        "trigger": "depth_change",
        "personality_filter": {"openness": (0.0, 0.3)},
        "text_en": "{agent}: 'We should turn back.' No one responds.",
        "text_de": "{agent}: \u00bbWir sollten umkehren.\u00ab Niemand antwortet.",
    },
    # Elite encounter
    {
        "id": "sb_26",
        "trigger": "elite_spotted",
        "personality_filter": {},
        "text_en": "The darkness coalesces. Something massive. Something old. Something that knows your names.",
        "text_de": "Die Dunkelheit verdichtet sich. Etwas Massives. Etwas Altes. Etwas, das eure Namen kennt.",
    },
    {
        "id": "sb_27",
        "trigger": "elite_spotted",
        "personality_filter": {"neuroticism": (0.7, 1.0)},
        "text_en": "{agent}: 'No. No, no, no.' But they don't run.",
        "text_de": "{agent}: \u00bbNein. Nein, nein, nein.\u00ab Aber sie rennen nicht.",
    },
    # Boss approach
    {
        "id": "sb_28",
        "trigger": "boss_approach",
        "personality_filter": {},
        "text_en": "The air changes. The whispers stop. In the silence that follows, something enormous draws breath.",
        "text_de": "Die Luft andert sich. Das Fluestern stoppt. In der folgenden Stille holt etwas Enormes Atem.",
    },
    {
        "id": "sb_29",
        "trigger": "boss_approach",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} reaches out and squeezes the nearest hand. 'Together.'",
        "text_de": "{agent} greift nach der nachsten Hand und drueckt sie. \u00bbZusammen.\u00ab",
    },
    {
        "id": "sb_30",
        "trigger": "boss_approach",
        "personality_filter": {"extraversion": (0.0, 0.3)},
        "text_en": "{agent} is already moving before the others react. Quiet. Focused. Ready.",
        "text_de": "{agent} bewegt sich bereits, bevor die anderen reagieren. Ruhig. Fokussiert. Bereit.",
    },
    # Affliction
    {
        "id": "sb_31",
        "trigger": "agent_afflicted",
        "personality_filter": {},
        "text_en": "{agent}'s eyes go distant. When they speak again, the voice isn't entirely theirs.",
        "text_de": "{agent}s Augen werden leer. Als sie wieder sprechen, ist die Stimme nicht ganz die ihre.",
    },
    # Virtue
    {
        "id": "sb_32",
        "trigger": "agent_virtue",
        "personality_filter": {},
        "text_en": "Something snaps in {agent} \u2014 but it's the sound of chains breaking, not bone. They stand straighter.",
        "text_de": "Etwas bricht in {agent} \u2014 aber es ist das Gerausch brechender Ketten, nicht von Knochen. Sie stehen aufrechter.",
    },
    # General atmosphere
    {
        "id": "sb_33",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "The shadows move. Not with you. Not against you. Around you. Testing.",
        "text_de": "Die Schatten bewegen sich. Nicht mit euch. Nicht gegen euch. Um euch herum. Testend.",
    },
    {
        "id": "sb_34",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "Somewhere above, a distant sound like stone grinding on stone. The dungeon shifts.",
        "text_de": "Irgendwo oben, ein fernes Gerausch wie Stein, der auf Stein mahlt. Der Dungeon verschiebt sich.",
    },
    {
        "id": "sb_35",
        "trigger": "room_entered",
        "personality_filter": {"conscientiousness": (0.0, 0.3)},
        "text_en": "{agent} kicks a loose stone. It falls into darkness. You don't hear it land.",
        "text_de": "{agent} tritt gegen einen losen Stein. Er fallt in die Dunkelheit. Ihr hoert ihn nicht aufschlagen.",
    },
    # Low stress banter (lighter tone)
    {
        "id": "sb_36",
        "trigger": "room_entered",
        "personality_filter": {"extraversion": (0.7, 1.0)},
        "text_en": "{agent}: 'You know what this place needs? Windows.'",
        "text_de": "{agent}: \u00bbWisst ihr, was dieser Ort braucht? Fenster.\u00ab",
    },
    {
        "id": "sb_37",
        "trigger": "combat_won",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} pauses to examine the dissolving shadow. 'Fascinating structure. Like frozen smoke.'",
        "text_de": "{agent} halt inne, um den sich auflosenden Schatten zu untersuchen. \u00bbFaszinierende Struktur. Wie gefrorener Rauch.\u00ab",
    },
    # Retreat banter
    {
        "id": "sb_38",
        "trigger": "retreat",
        "personality_filter": {},
        "text_en": "The darkness lets you leave. That's the most unsettling part.",
        "text_de": "Die Dunkelheit lasst euch gehen. Das ist der beunruhigendste Teil.",
    },
    {
        "id": "sb_39",
        "trigger": "retreat",
        "personality_filter": {"agreeableness": (0.0, 0.3)},
        "text_en": "{agent}: 'Smart call. Dead heroes don't file reports.'",
        "text_de": "{agent}: \u00bbKluge Entscheidung. Tote Helden schreiben keine Berichte.\u00ab",
    },
    # Dungeon completed
    {
        "id": "sb_40",
        "trigger": "dungeon_completed",
        "personality_filter": {},
        "text_en": "Light. Actual light. The party shields their eyes. Behind them, the entrance seals shut.",
        "text_de": "Licht. Tatsachliches Licht. Die Gruppe schirmt die Augen ab. Hinter ihnen versiegelt sich der Eingang.",
    },
    {
        "id": "sb_41",
        "trigger": "dungeon_completed",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} doesn't celebrate. They keep checking the shadows. They'll keep checking for a long time.",
        "text_de": "{agent} feiert nicht. Sie pruefen weiter die Schatten. Sie werden das noch lange tun.",
    },
]


def select_banter(
    trigger: str,
    agents: list[dict],
    used_ids: list[str],
) -> dict | None:
    """Select a banter template for the current trigger.

    Filters by trigger type, personality match, and ensures no repeats.
    Returns None if no suitable banter found.

    Args:
        trigger: Event trigger (room_entered, combat_won, etc.)
        agents: List of agent dicts with personality traits.
        used_ids: List of already-used banter IDs this run.
    """
    candidates = [b for b in SHADOW_BANTER if b["trigger"] == trigger and b["id"] not in used_ids]
    if not candidates:
        return None

    # Simple selection: random from matching candidates
    # Future: weight by personality match quality
    return random.choice(candidates)
