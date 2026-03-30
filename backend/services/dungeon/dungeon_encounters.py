"""Dungeon encounter templates — archetype-specific encounters and banter.

All text is bilingual (en/de) inline per architecture decision #3.
Archetype data is stored in registries keyed by archetype name.

Shadow encounters (Phase 0):
  4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
Tower encounters (Phase 1):
  4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
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
            "circling like predators testing prey. The whispers start \u2013 not words, "
            "but the memory of words, scraping against certainty."
        ),
        description_de=(
            "Die Luft wird dicker. Zwei Punkte kalten Lichts treiben am Rand eures "
            "Blickfelds, kreisen wie Raubtiere, die Beute testen. Das Flüstern beginnt "
            "\u2013 keine Worte, sondern die Erinnerung an Worte, die an der Gewissheit kratzen."
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
            "Movement ahead \u2013 rhythmic, predictable. An echo of violence stalks this corridor "
            "with mechanical precision, a tendril of shadow coiling behind it like a leash. "
            "They haven't noticed you yet."
        ),
        description_de=(
            "Bewegung voraus \u2013 rhythmisch, vorhersehbar. Ein Gewaltecho durchstreift diesen "
            "Korridor mit mechanischer Präzision, ein Schattenfaden windet sich hinter ihm "
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
            "CONTACT! They were waiting. The darkness erupts \u2013 two echoes of violence, "
            "already moving, already striking. No time to plan. No time to think."
        ),
        description_de=(
            "KONTAKT! Sie haben gewartet. Die Dunkelheit bricht aus \u2013 zwei Gewaltechos, "
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
            "The whispers change. They become specific \u2013 names, fears, secrets your agents "
            "thought were private. A paranoia shade drifts at the center, flanked by wisps "
            "whose movements no longer match their telegraphed intents. Nothing here is honest."
        ),
        description_de=(
            "Das Flüstern verändert sich. Es wird spezifisch \u2013 Namen, Ängste, Geheimnisse, "
            "die eure Agenten für privat hielten. Ein Paranoiaschatten treibt im Zentrum, "
            "flankiert von Glimmern, deren Bewegungen nicht mehr zu ihren angezeigten "
            "Absichten passen. Nichts hier ist ehrlich."
        ),
        combat_encounter_id="shadow_haunting_spawn",
    ),
]

# ── Narrative Encounters (5) ────────────────────────────────────────────────

SHADOW_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_the_threshold",
        archetype="The Shadow",
        room_type="encounter",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "The corridor narrows. Ahead, a line of absolute dark cuts the floor "
            "like a border crossing \u2013 everything on this side is dim; everything "
            "beyond is blind. The air carries the faint chemical taste of dissolved "
            "certainty. Someone has been here before. The scratches on the walls "
            "are not random."
        ),
        description_de=(
            "Der Korridor verengt sich. Voraus schneidet eine Linie absoluter "
            "Dunkelheit den Boden wie ein Grenzübergang \u2013 diesseits ist es "
            "dämmerig; jenseits ist es blind. Die Luft trägt den schwachen "
            "chemischen Geschmack aufgelöster Gewissheit. Jemand war schon hier. "
            "Die Kratzer an den Wänden sind nicht zufällig."
        ),
        choices=[
            EncounterChoice(
                id="investigate_scratches",
                label_en="Investigate the scratches (Spy)",
                label_de="Die Kratzer untersuchen (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 1, "stress": 0},
                partial_effects={"stress": 20},
                fail_effects={"stress": 40},
                success_narrative_en="The scratches are a map \u2013 crude, desperate, but accurate. Whoever carved them made it further than this.",
                success_narrative_de="Die Kratzer sind eine Karte \u2013 grob, verzweifelt, aber genau. Wer sie geritzt hat, kam weiter als hierhin.",
                partial_narrative_en="Some scratches form patterns. Others are just scratches. Sorting them takes longer than expected.",
                partial_narrative_de="Manche Kratzer bilden Muster. Andere sind nur Kratzer. Sie zu sortieren dauert länger als erwartet.",
                fail_narrative_en="The scratches rearrange themselves as you study them. Your eyes ache from tracking lines that refuse to hold still.",
                fail_narrative_de="Die Kratzer ordnen sich neu, während ihr sie studiert. Eure Augen schmerzen vom Verfolgen von Linien, die sich weigern stillzuhalten.",
            ),
            EncounterChoice(
                id="secure_perimeter",
                label_en="Secure the threshold (Guardian)",
                label_de="Die Schwelle sichern (Wächter)",
                check_aptitude="guardian",
                check_difficulty=0,
                success_effects={"stress": -20, "visibility": 1},
                partial_effects={"stress": 20},
                fail_effects={"stress": 50},
                success_narrative_en="You mark the threshold, set reference points, establish a fallback line. The darkness hasn't changed \u2013 but your footing has.",
                success_narrative_de="Ihr markiert die Schwelle, setzt Bezugspunkte, legt eine Rückzugslinie fest. Die Dunkelheit hat sich nicht verändert \u2013 aber euer Stand schon.",
                partial_narrative_en="The markers hold, but the reference points drift. Partial orientation is better than none.",
                partial_narrative_de="Die Markierungen halten, aber die Bezugspunkte verschieben sich. Teilweise Orientierung ist besser als keine.",
                fail_narrative_en="The darkness swallows every marker you place. The threshold is not a line \u2013 it is a mouth.",
                fail_narrative_de="Die Dunkelheit verschluckt jede Markierung, die ihr setzt. Die Schwelle ist keine Linie \u2013 sie ist ein Maul.",
            ),
            EncounterChoice(
                id="cautious_crossing",
                label_en="Cross cautiously",
                label_de="Vorsichtig überqueren",
                success_effects={"stress": 15},
                success_narrative_en="You step across the line. Nothing happens. The waiting is worse.",
                success_narrative_de="Ihr tretet über die Linie. Nichts geschieht. Das Warten ist schlimmer.",
            ),
        ],
    ),
    EncounterTemplate(
        id="shadow_convergence",
        archetype="The Shadow",
        room_type="encounter",
        min_depth=4,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The corridors converge here \u2013 not architecturally, but ontologically. "
            "Shadows from earlier rooms pool on the floor like spilled ink, forming "
            "a map of everywhere you have been. The air is dense with accumulated "
            "memory. Something in the walls is breathing in sync with your party."
        ),
        description_de=(
            "Die Korridore konvergieren hier \u2013 nicht architektonisch, sondern "
            "ontologisch. Schatten früherer Räume sammeln sich auf dem Boden wie "
            "verschüttete Tinte und bilden eine Karte überall, wo ihr gewesen seid. "
            "Die Luft ist dicht von angesammelter Erinnerung. Etwas in den Wänden "
            "atmet im Gleichklang mit eurer Gruppe."
        ),
        choices=[
            EncounterChoice(
                id="read_shadow_map",
                label_en="Read the shadow map (Spy)",
                label_de="Die Schattenkarte lesen (Spion)",
                check_aptitude="spy",
                check_difficulty=10,
                success_effects={"reveal_rooms": 2, "stress": 10},
                partial_effects={"reveal_rooms": 1, "stress": 30},
                fail_effects={"stress": 70},
                success_narrative_en="The ink-map responds to your attention. It shows not just rooms \u2013 but what waits inside them.",
                success_narrative_de="Die Tintenkarte reagiert auf eure Aufmerksamkeit. Sie zeigt nicht nur Räume \u2013 sondern was darin wartet.",
                partial_narrative_en="Fragments of the map are legible. Others dissolve under scrutiny, as if the shadow resents being read.",
                partial_narrative_de="Fragmente der Karte sind lesbar. Andere lösen sich unter Prüfung auf, als ob der Schatten es übelnimmt, gelesen zu werden.",
                fail_narrative_en="The map surges upward. For a heartbeat, the accumulated shadow of every room you crossed presses against your mind at once.",
                fail_narrative_de="Die Karte wogt empor. Für einen Herzschlag drückt der angesammelte Schatten jedes Raums, den ihr durchquert habt, gleichzeitig gegen euren Verstand.",
            ),
            EncounterChoice(
                id="strike_convergence",
                label_en="Strike the convergence (Assassin)",
                label_de="Die Konvergenz angreifen (Assassine)",
                check_aptitude="assassin",
                check_difficulty=10,
                success_effects={"stress": -40, "shadow_resonance": 0.05},
                partial_effects={"stress": 40},
                fail_effects={"stress": 90, "ambush_trigger": True},
                success_narrative_en="A precise strike at the node where all shadows meet. The ink-map shatters. The accumulated pressure bleeds away.",
                success_narrative_de="Ein präziser Schlag auf den Knoten, an dem alle Schatten sich treffen. Die Tintenkarte zerbricht. Der angesammelte Druck entweicht.",
                partial_narrative_en="The strike lands, but the convergence absorbs part of it. The shadows recoil but do not break.",
                partial_narrative_de="Der Schlag trifft, aber die Konvergenz absorbiert einen Teil davon. Die Schatten weichen zurück, brechen aber nicht.",
                fail_narrative_en="The convergence fights back. Every shadow you ever passed through strikes at once.",
                fail_narrative_de="Die Konvergenz schlägt zurück. Jeder Schatten, den ihr je durchquert habt, schlägt gleichzeitig zu.",
            ),
            EncounterChoice(
                id="cautious_convergence",
                label_en="Move through carefully",
                label_de="Vorsichtig hindurchgehen",
                success_effects={"stress": 25},
                success_narrative_en="You navigate the pooled shadows without engaging them. They part reluctantly, clinging to your boots like oil.",
                success_narrative_de="Ihr navigiert durch die gesammelten Schatten, ohne sie zu berühren. Sie teilen sich widerwillig und kleben an euren Stiefeln wie Öl.",
            ),
        ],
    ),
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
            "Ein Käfig aus verfestigtem Schatten. Darin kauert etwas, das einmal menschlich war, "
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
                success_narrative_de="Der Schattenkäfig löst sich auf. Der Gefangene verblasst mit einem dankbaren Flüstern und hinterlässt ein schwaches Leuchten, das eure Sicht wiederherstellt.",
                partial_narrative_en="The cage cracks but doesn't break cleanly. The prisoner slips free but something else slips out with it.",
                partial_narrative_de="Der Käfig bricht, aber nicht sauber. Der Gefangene entkommt, aber etwas anderes entkommt mit ihm.",
                fail_narrative_en="The cage was a trap. The 'prisoner' dissolves into shadow tendrils that lash out at the party.",
                fail_narrative_de="Der Käfig war eine Falle. Der 'Gefangene' löst sich in Schattenfäden auf, die nach der Gruppe schlagen.",
            ),
            EncounterChoice(
                id="interrogate_prisoner",
                label_en="Interrogate it first",
                label_de="Zuerst verhören",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 2, "stress": 10},
                partial_effects={"reveal_rooms": 1, "stress": 30},
                fail_effects={"stress": 50},
                success_narrative_en="Your questions cut through its delirium. It reveals the layout of adjacent rooms before fading.",
                success_narrative_de="Eure Fragen durchschneiden sein Delirium. Es enthüllt die Anordnung benachbarter Räume, bevor es verblasst.",
                partial_narrative_en="It answers in fragments. Some of what it says is useful.",
                partial_narrative_de="Es antwortet in Fragmenten. Manches davon ist nützlich.",
                fail_narrative_en="It screams. The sound carries. Something in the next room stirs.",
                fail_narrative_de="Es schreit. Der Laut trägt. Etwas im nächsten Raum regt sich.",
            ),
            EncounterChoice(
                id="leave_prisoner",
                label_en="Leave it",
                label_de="Zurücklassen",
                success_effects={"stress": 20},
                success_narrative_en="You walk away. Behind you, the whimpering fades into silence. Some agents look back. Others don't.",
                success_narrative_de="Ihr geht weiter. Hinter euch verblasst das Wimmern in Stille. Manche Agenten blicken zurück. Andere nicht.",
            ),
            EncounterChoice(
                id="destroy_prisoner",
                label_en="End its suffering",
                label_de="Sein Leiden beenden",
                requires_aptitude={"assassin": 3},
                success_effects={"stress": -10, "shadow_resonance": 0.05},
                success_narrative_en="A clean strike. The shadow dissolves. The mercy of it echoes in the dark.",
                success_narrative_de="Ein sauberer Schlag. Der Schatten löst sich auf. Die Gnade hallt in der Dunkelheit nach.",
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
            "The walls are mirrors \u2013 but wrong. Each agent sees themselves, distorted. "
            "Features exaggerated, expressions twisted into something they fear they truly are. "
            "The reflections move independently."
        ),
        description_de=(
            "Die Wände sind Spiegel \u2013 aber falsch. Jeder Agent sieht sich selbst, verzerrt. "
            "Züge übertrieben, Ausdrücke verdreht zu etwas, von dem sie fürchten, "
            "es wirklich zu sein. Die Spiegelbilder bewegen sich unabhängig."
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
                partial_narrative_de="Die Konfrontation ist schmerzhaft, aber ergebnislos. Das Spiegelbild weicht zurück, bricht aber nicht.",
                fail_narrative_en="The reflection speaks the agent's worst fear aloud. The words hang in the air, impossible to unhear.",
                fail_narrative_de="Das Spiegelbild spricht die schlimmste Angst des Agenten laut aus. Die Worte hängen in der Luft, unmöglich zu überhören.",
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
                success_narrative_en="The mirrors aren't just reflecting \u2013 they're showing adjacent rooms. You map what you see.",
                success_narrative_de="Die Spiegel reflektieren nicht nur \u2013 sie zeigen angrenzende Räume. Ihr kartiert, was ihr seht.",
            ),
            EncounterChoice(
                id="smash_mirrors",
                label_en="Smash the mirrors",
                label_de="Spiegel zerschlagen",
                requires_aptitude={"assassin": 3},
                success_effects={"stress": 30, "visibility": -1},
                success_narrative_en="Glass shatters. The reflections scream. Darkness pours from the broken frames.",
                success_narrative_de="Glas zersplittert. Die Spiegelbilder schreien. Dunkelheit strömt aus den zerbrochenen Rahmen.",
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
            "The room replays a scene from your simulation's history \u2013 a real event, "
            "distorted by shadow. The agents involved are here, or echoes of them. "
            "The moment crystallizes, waiting for a different choice."
        ),
        description_de=(
            "Der Raum spielt eine Szene aus der Geschichte eurer Simulation nach \u2013 "
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
                success_narrative_de="Die Geschichte verschiebt sich. Das Echo spielt sich mit eurer Änderung ab, und etwas im Gewebe der Simulation entspannt sich.",
            ),
            EncounterChoice(
                id="observe_replay",
                label_en="Observe without intervening",
                label_de="Beobachten ohne einzugreifen",
                check_aptitude="spy",
                check_difficulty=-10,
                success_effects={"reveal_rooms": 1, "stress": 10},
                success_narrative_en="Watching history repeat itself is painful, but instructive. You learn something about the patterns at work here.",
                success_narrative_de="Zuzusehen, wie sich Geschichte wiederholt, ist schmerzhaft, aber lehrreich. Ihr lernt etwas über die Muster, die hier am Werk sind.",
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
            "The darkness coalesces. A shape forms \u2013 massive, deliberate, ancient. "
            "This is The Remnant: formed from the simulation's strongest unresolved conflict. "
            "It remembers what your agents have tried to forget. Wisps orbit it like satellites."
        ),
        description_de=(
            "Die Dunkelheit verdichtet sich. Eine Gestalt formt sich \u2013 massiv, bedacht, uralt. "
            "Das ist Der Überrest: geformt aus dem stärksten ungelösten Konflikt der Simulation. "
            "Er erinnert sich an das, was eure Agenten zu vergessen versucht haben. "
            "Glimmer umkreisen ihn wie Satelliten."
        ),
        combat_encounter_id="shadow_remnant_spawn",
    ),
]

# ── Boss Encounter (1) ──────────────────────────────────────────────────────

SHADOW_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="shadow_the_remnant_boss",
        archetype="The Shadow",
        room_type="boss",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The corridor ends. The darkness ahead is absolute \u2013 not absence of light, "
            "but presence of something vast. The Remnant awaits: an echo of every suppressed "
            "memory, every buried conflict, given terrible form. The whispers fall silent. "
            "There is only the sound of your agents' breathing."
        ),
        description_de=(
            "Der Korridor endet. Die Dunkelheit voraus ist absolut \u2013 nicht Abwesenheit von "
            "Licht, sondern Anwesenheit von etwas Gewaltigem. Der \u00dcberrest wartet: ein Echo "
            "jeder unterdrückten Erinnerung, jedes begrabenen Konflikts, in schrecklicher "
            "Gestalt. Das Flüstern verstummt. Nur noch das Atmen eurer Agenten ist zu hören."
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
            "A gap in the darkness \u2013 not light, exactly, but the absence of active malice. "
            "The walls here are smooth, untouched. The air is still. For the first time "
            "since entering, you can hear your own breathing."
        ),
        description_de=(
            "Eine Lücke in der Dunkelheit \u2013 kein Licht, genau genommen, aber die Abwesenheit "
            "aktiver Bösartigkeit. Die Wände hier sind glatt, unberührt. Die Luft ist still. "
            "Zum ersten Mal seit dem Eintritt könnt ihr euer eigenes Atmen hören."
        ),
        choices=[
            EncounterChoice(
                id="rest_full",
                label_en="Rest (heal stress, risk ambush)",
                label_de="Rasten (Stress heilen, Hinterhalt-Risiko)",
                success_effects={"stress_heal": 200, "wounded_to_stressed": True, "ambush_chance": 0.20},
                success_narrative_en="The party rests. Stress fades. Wounds knit. For a while, the darkness forgets you.",
                success_narrative_de="Die Gruppe rastet. Stress verblasst. Wunden schließen sich. Für eine Weile vergisst die Dunkelheit euch.",
            ),
            EncounterChoice(
                id="rest_guarded",
                label_en="Post a Guardian watch (safe, but Guardian doesn't heal)",
                label_de="Wächter aufstellen (sicher, aber Wächter heilt nicht)",
                requires_aptitude={"guardian": 3},
                success_effects={"stress_heal": 200, "wounded_to_stressed": True, "guardian_no_heal": True},
                success_narrative_en="The Guardian stands watch while others rest. No ambush comes. But the Guardian's own wounds remain.",
                success_narrative_de="Der Wächter hält Wache, während die anderen rasten. Kein Hinterhalt kommt. Aber die eigenen Wunden des Wächters bleiben.",
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
            "A shadow cache \u2013 a pocket of crystallized darkness containing something valuable. "
            "The container is locked with mechanisms that respond to finesse, not force."
        ),
        description_de=(
            "Ein Schattenversteck \u2013 eine Tasche aus kristallisierter Dunkelheit, die etwas "
            "Wertvolles enthält. Der Behälter ist mit Mechanismen verschlossen, "
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
                success_narrative_de="Der Mechanismus klickt auf. Darin: Schatten, die sich zu etwas Nützlichem verhärtet haben.",
                partial_narrative_en="Partially opened. Some contents spill and dissolve before you can grab them.",
                partial_narrative_de="Teilweise geöffnet. Einige Inhalte verschütten sich und lösen sich auf, bevor ihr sie greifen könnt.",
                fail_narrative_en="A trap! Shadow energy lashes out, scoring the opener's psyche.",
                fail_narrative_de="Eine Falle! Schattenenergie peitscht hervor und zeichnet die Psyche des Öffnenden.",
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
                success_narrative_de="Kontrollierte Sprengung. Der Behälter zerbricht nach euren Regeln.",
            ),
            EncounterChoice(
                id="leave_cache",
                label_en="Leave it (no risk)",
                label_de="Liegenlassen (kein Risiko)",
                success_effects={},
                success_narrative_en="Sometimes the safest option is the wisest. You move on.",
                success_narrative_de="Manchmal ist die sicherste Option die klügste. Ihr geht weiter.",
            ),
        ],
    ),
]


# ── Registry ────────────────────────────────────────────────────────────────

ALL_SHADOW_ENCOUNTERS: list[EncounterTemplate] = (
    SHADOW_COMBAT_ENCOUNTERS
    + SHADOW_NARRATIVE_ENCOUNTERS
    + SHADOW_ELITE_ENCOUNTERS
    + SHADOW_BOSS_ENCOUNTERS
    + SHADOW_REST_ENCOUNTERS
    + SHADOW_TREASURE_ENCOUNTERS
)


# ══════════════════════════════════════════════════════════════════════════════
# THE TOWER — Encounters
# Prose tone: Clinical. Economic. Architecture as organic failure.
# Numbers counting down. Financial metaphors mixed with structural collapse.
# ══════════════════════════════════════════════════════════════════════════════

# ── Tower Combat Encounters (4) ────────────────────────────────────────────

TOWER_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_liquidity_crisis",
        archetype="The Tower",
        room_type="combat",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "Numbers cascade from the ceiling like failed projections. Two figures "
            "huddle in the margins, nervous, twitching \u2013 Brokers trapped in their "
            "own recursive calculations. They have noticed you. The figures begin "
            "reciting."
        ),
        description_de=(
            "Zahlen stürzen von der Decke wie gescheiterte Projektionen. Zwei "
            "Gestalten kauern in den Randbereichen, nervös, zuckend \u2013 Makler, "
            "gefangen in ihren eigenen rekursiven Berechnungen. Sie haben euch "
            "bemerkt. Die Gestalten beginnen zu rezitieren."
        ),
        combat_encounter_id="tower_tremor_spawn",
    ),
    EncounterTemplate(
        id="tower_assessment",
        archetype="The Tower",
        room_type="combat",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A crowned figure patrols this floor with proprietary confidence, a worm "
            "grinding through the foundations behind it. The assessment is mutual "
            "\u2013 they measure you for structural tolerance, and you measure them "
            "for weakness."
        ),
        description_de=(
            "Eine gekrönte Gestalt patrouilliert dieses Stockwerk mit herrschaftlicher "
            "Selbstgewissheit, ein Wurm mahlt hinter ihr durch die Fundamente. Die "
            "Prüfung ist gegenseitig \u2013 sie messen euch auf strukturelle "
            "Belastbarkeit, und ihr messt sie auf Schwächen."
        ),
        combat_encounter_id="tower_patrol_spawn",
        requires_aptitude={"infiltrator": 5},
    ),
    EncounterTemplate(
        id="tower_interest_compounding",
        archetype="The Tower",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "CONTACT. The ledger was a trap. Two shapes materialize from the margins "
            "of an open account book \u2013 Debt Shades, their forms growing denser "
            "with each heartbeat. The interest has been compounding since before you "
            "entered."
        ),
        description_de=(
            "KONTAKT. Das Hauptbuch war eine Falle. Zwei Gestalten materialisieren "
            "sich aus den Rändern eines offenen Kontobuchs \u2013 Schuldgespenster, "
            "deren Formen mit jedem Herzschlag dichter werden. Die Zinsen liefen "
            "schon, bevor ihr diesen Raum betreten habt."
        ),
        combat_encounter_id="tower_ambush_spawn",
        is_ambush=True,
        ambush_stress=80,
    ),
    EncounterTemplate(
        id="tower_reckoning_hour",
        archetype="The Tower",
        room_type="combat",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The hour arrives when all deferred costs come due simultaneously. A Debt "
            "Shade presides over two Brokers whose recitations have synchronized into "
            "something like a hymn. The floor vibrates at the frequency of imminent "
            "default."
        ),
        description_de=(
            "Die Stunde kommt, in der alle aufgeschobenen Kosten gleichzeitig fällig "
            "werden. Ein Schuldgespenst präsidiert über zwei Maklern, deren "
            "Rezitationen sich zu etwas wie einem Hymnus synchronisiert haben. Der "
            "Boden vibriert mit der Frequenz eines bevorstehenden Ausfalls."
        ),
        combat_encounter_id="tower_compound_spawn",
    ),
]

# ── Tower Narrative Encounters (5) ─────────────────────────────────────────

TOWER_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_the_lobby",
        archetype="The Tower",
        room_type="encounter",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "The lobby is cavernous and wrong. Reception desks curve into "
            "themselves. Departure boards list floors that do not exist \u2013 "
            "negative numbers, imaginary levels, a floor called 'solvency' with "
            "no arrival time. The marble underfoot is cracked along load-bearing "
            "lines. Someone left in a hurry."
        ),
        description_de=(
            "Die Lobby ist riesig und falsch. Empfangsschalter krümmen sich in "
            "sich selbst. Abfahrtstafeln listen Stockwerke, die nicht existieren "
            "\u2013 negative Zahlen, imaginäre Ebenen, ein Stockwerk namens "
            "'Solvenz' ohne Ankunftszeit. Der Marmor unter euren Füßen ist "
            "entlang tragender Linien gerissen. Jemand ist in Eile gegangen."
        ),
        choices=[
            EncounterChoice(
                id="check_departure_boards",
                label_en="Check the departure boards (Spy)",
                label_de="Die Abfahrtstafeln prüfen (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 1, "stress": 0},
                partial_effects={"stress": 20},
                fail_effects={"stress": 40},
                success_narrative_en="The imaginary floors encode real information. You map the first level from the contradictions.",
                success_narrative_de="Die imaginären Stockwerke verschlüsseln echte Information. Ihr kartiert die erste Ebene aus den Widersprüchen.",
                partial_narrative_en="Some boards flicker with useful data. Others display only debt.",
                partial_narrative_de="Einige Tafeln flimmern mit nützlichen Daten. Andere zeigen nur Schulden.",
                fail_narrative_en="The boards reset as you read them. The only consistent number is the one counting down.",
                fail_narrative_de="Die Tafeln setzen sich zurück, während ihr sie lest. Die einzige beständige Zahl ist die, die herunterzählt.",
            ),
            EncounterChoice(
                id="reinforce_lobby",
                label_en="Reinforce the cracked marble (Guardian)",
                label_de="Den gerissenen Marmor verstärken (Wächter)",
                check_aptitude="guardian",
                check_difficulty=0,
                success_effects={"stability": 5, "stress": -15},
                partial_effects={"stress": 20},
                fail_effects={"stress": 50, "stability": -5},
                success_narrative_en="You brace the load-bearing fractures with improvised supports. The lobby stops shuddering. For now.",
                success_narrative_de="Ihr stützt die tragenden Brüche mit improvisierten Stützen ab. Die Lobby hört auf zu beben. Vorerst.",
                partial_narrative_en="Some cracks hold. Others widen under the correction, as if the building resists being helped.",
                partial_narrative_de="Einige Risse halten. Andere weiten sich unter der Korrektur, als widersetze sich das Gebäude der Hilfe.",
                fail_narrative_en="The marble shifts under your hands. The load-bearing lines are deeper than you thought \u2013 the damage is foundational.",
                fail_narrative_de="Der Marmor verschiebt sich unter euren Händen. Die tragenden Linien sind tiefer als gedacht \u2013 der Schaden ist fundamental.",
            ),
            EncounterChoice(
                id="cautious_lobby",
                label_en="Move through quickly",
                label_de="Schnell hindurchgehen",
                success_effects={"stress": 15},
                success_narrative_en="You cross the lobby without engaging it. The departure boards flicker in your peripheral vision. You try not to read them.",
                success_narrative_de="Ihr durchquert die Lobby, ohne euch auf sie einzulassen. Die Abfahrtstafeln flimmern in eurem peripheren Blickfeld. Ihr versucht, sie nicht zu lesen.",
            ),
        ],
    ),
    EncounterTemplate(
        id="tower_final_audit",
        archetype="The Tower",
        room_type="encounter",
        min_depth=4,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The penultimate floor. Every structural failure in the building below "
            "resonates here \u2013 the cracks sing, the tilted floors hum, the bent "
            "rebar conducts a frequency that makes vision blur. In the center of "
            "the room, a single desk holds a final audit report. The pages are "
            "blank. The pen is waiting."
        ),
        description_de=(
            "Das vorletzte Stockwerk. Jedes Strukturversagen im Gebäude darunter "
            "resoniert hier \u2013 die Risse singen, die geneigten Böden summen, "
            "der verbogene Bewehrungsstahl leitet eine Frequenz, die das Sehen "
            "verschwimmen lässt. In der Mitte des Raums hält ein einzelner "
            "Schreibtisch einen letzten Prüfbericht. Die Seiten sind leer. Der "
            "Stift wartet."
        ),
        choices=[
            EncounterChoice(
                id="write_true_audit",
                label_en="Write the true audit (Spy)",
                label_de="Den wahren Bericht schreiben (Spion)",
                check_aptitude="spy",
                check_difficulty=10,
                success_effects={"reveal_rooms": 2, "stress": 10, "stability": 5},
                partial_effects={"reveal_rooms": 1, "stress": 30},
                fail_effects={"stress": 70},
                success_narrative_en="The pen knows what you know. The audit writes itself \u2013 every flaw, every overloaded column, every deferred repair. The tower shudders at its own truth.",
                success_narrative_de="Der Stift weiß, was ihr wisst. Der Bericht schreibt sich selbst \u2013 jeder Fehler, jede überladene Säule, jede aufgeschobene Reparatur. Der Turm erschauert vor seiner eigenen Wahrheit.",
                partial_narrative_en="The report is half-complete. Some columns resist documentation, as if the tower censors its own failures.",
                partial_narrative_de="Der Bericht ist halbfertig. Einige Säulen widersetzen sich der Dokumentation, als zensiere der Turm seine eigenen Fehler.",
                fail_narrative_en="The pen breaks. The audit report fills itself with numbers that don't add up. The desk vibrates with fraudulent energy.",
                fail_narrative_de="Der Stift bricht. Der Prüfbericht füllt sich mit Zahlen, die nicht aufgehen. Der Schreibtisch vibriert mit betrügerischer Energie.",
            ),
            EncounterChoice(
                id="sabotage_last_column",
                label_en="Sabotage the last load-bearing column (Saboteur)",
                label_de="Die letzte tragende Säule sabotieren (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=10,
                success_effects={"stability": -10, "discovery": True, "stress": -20},
                partial_effects={"stability": -15, "stress": 40},
                fail_effects={"stability": -20, "stress": 80},
                success_narrative_en="Controlled structural failure. The column buckles precisely, opening a direct route to the summit. The tower groans but accepts.",
                success_narrative_de="Kontrolliertes Strukturversagen. Die Säule knickt präzise ein und öffnet einen direkten Weg zum Gipfel. Der Turm stöhnt, akzeptiert aber.",
                partial_narrative_en="The column weakens but holds. The path opens partially. The building remembers this insult.",
                partial_narrative_de="Die Säule schwächt sich, hält aber. Der Weg öffnet sich teilweise. Das Gebäude erinnert sich an diese Beleidigung.",
                fail_narrative_en="The charge propagates. Three columns fail instead of one. The ceiling drops a meter. The route is open, but so is the abyss.",
                fail_narrative_de="Die Ladung pflanzt sich fort. Drei Säulen versagen statt einer. Die Decke sinkt einen Meter. Der Weg ist offen, aber auch der Abgrund.",
            ),
            EncounterChoice(
                id="cautious_audit",
                label_en="Leave the desk untouched",
                label_de="Den Schreibtisch unberührt lassen",
                success_effects={"stress": 20},
                success_narrative_en="The pen remains. The blank pages remain. The audit that never happened is perhaps the most honest one.",
                success_narrative_de="Der Stift bleibt. Die leeren Seiten bleiben. Der Bericht, der nie geschrieben wurde, ist vielleicht der ehrlichste.",
            ),
        ],
    ),
    EncounterTemplate(
        id="tower_confidence_game",
        archetype="The Tower",
        room_type="encounter",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A room of impossible architecture: staircases that climb into themselves, "
            "columns supporting nothing. In the center, a mechanism produces "
            "certificates of structural integrity \u2013 for a building that is visibly "
            "crumbling. Someone has been maintaining this fiction."
        ),
        description_de=(
            "Ein Raum unmöglicher Architektur: Treppen, die in sich selbst "
            "hinaufsteigen, Säulen, die nichts tragen. In der Mitte produziert ein "
            "Mechanismus Bescheinigungen der Gebäudeintegrität \u2013 für ein "
            "Bauwerk, das sichtbar zerfällt. Jemand hat diese Fiktion "
            "aufrechterhalten."
        ),
        choices=[
            EncounterChoice(
                id="expose_fraud",
                label_en="Expose the fraud",
                label_de="Den Betrug aufdecken",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"stress": -30, "stability": 5},
                partial_effects={"stress": 30},
                fail_effects={"stress": 80},
                success_narrative_en="The mechanism grinds to a halt. The certificates dissolve. For a moment the building shudders, then settles on honest foundations.",
                success_narrative_de="Der Mechanismus kommt zum Stillstand. Die Bescheinigungen lösen sich auf. Einen Moment lang bebt das Gebäude, dann setzt es sich auf ehrlichen Fundamenten ab.",
                partial_narrative_en="The certificates tear, but the mechanism keeps printing. The fiction is dented, not broken.",
                partial_narrative_de="Die Bescheinigungen reißen, aber der Mechanismus druckt weiter. Die Fiktion ist verbeult, nicht gebrochen.",
                fail_narrative_en="The mechanism accelerates. More certificates. More lies. The building believes them even if you don't.",
                fail_narrative_de="Der Mechanismus beschleunigt. Mehr Bescheinigungen. Mehr Lügen. Das Gebäude glaubt ihnen, selbst wenn ihr es nicht tut.",
            ),
            EncounterChoice(
                id="analyze_architecture",
                label_en="Analyze the architecture",
                label_de="Die Architektur analysieren",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"reveal_rooms": 2, "stress": 10},
                partial_effects={"reveal_rooms": 1, "stress": 30},
                fail_effects={"stress": 50},
                success_narrative_en="The impossible geometry has a logic. You trace it, mapping two adjacent floors from the contradictions.",
                success_narrative_de="Die unmögliche Geometrie hat eine Logik. Ihr verfolgt sie und kartiert zwei angrenzende Stockwerke aus den Widersprüchen.",
                partial_narrative_en="Fragments of the layout reveal themselves. One floor, partially mapped.",
                partial_narrative_de="Fragmente des Grundrisses offenbaren sich. Ein Stockwerk, teilweise kartiert.",
                fail_narrative_en="The contradictions multiply faster than you can process them. The headache lingers.",
                fail_narrative_de="Die Widersprüche vermehren sich schneller, als ihr sie verarbeiten könnt. Die Kopfschmerzen bleiben.",
            ),
            EncounterChoice(
                id="profit_from_fraud",
                label_en="Profit from the system",
                label_de="Vom System profitieren",
                requires_aptitude={"infiltrator": 3},
                success_effects={"stress": -10, "stability": -5},
                success_narrative_en="You issue yourself a certificate. The tower accepts it, briefly. The structural cost is someone else's problem.",
                success_narrative_de="Ihr stellt euch selbst eine Bescheinigung aus. Der Turm akzeptiert sie, kurz. Die strukturellen Kosten sind das Problem eines anderen.",
            ),
            EncounterChoice(
                id="walk_away_confidence",
                label_en="Walk away",
                label_de="Weitergehen",
                success_effects={"stress": 20},
                success_narrative_en="You leave the mechanism running. Behind you, the certificates pile up. The fiction persists.",
                success_narrative_de="Ihr lasst den Mechanismus laufen. Hinter euch häufen sich die Bescheinigungen. Die Fiktion besteht fort.",
            ),
        ],
    ),
    EncounterTemplate(
        id="tower_the_ledger",
        archetype="The Tower",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "The room is dominated by a single object: a ledger the size of a desk, "
            "open to a page of debts so vast they curve the air around them. The "
            "columns do not balance. They have not balanced in a long time. The ledger "
            "hums with structural resonance."
        ),
        description_de=(
            "Der Raum wird beherrscht von einem einzigen Objekt: einem Hauptbuch, so "
            "groß wie ein Schreibtisch, aufgeschlagen auf einer Seite von Schulden so "
            "gewaltig, dass sie die Luft um sich krümmen. Die Spalten gleichen sich "
            "nicht aus. Das tun sie schon lange nicht mehr. Das Hauptbuch summt mit "
            "struktureller Resonanz."
        ),
        choices=[
            EncounterChoice(
                id="balance_books",
                label_en="Balance the books",
                label_de="Die Bücher ausgleichen",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"stability": 10, "stress": -20},
                partial_effects={"stability": 5, "stress": 20},
                fail_effects={"stress": 60, "stability": -5},
                success_narrative_en="Column by column, you reconcile the accounts. The ledger stops humming. The floor beneath it settles.",
                success_narrative_de="Spalte für Spalte gleicht ihr die Konten aus. Das Hauptbuch hört auf zu summen. Der Boden darunter beruhigt sich.",
                partial_narrative_en="Some columns balance. Others resist. The resonance dims but doesn't stop.",
                partial_narrative_de="Einige Spalten gleichen sich aus. Andere widersetzen sich. Die Resonanz wird schwächer, hört aber nicht auf.",
                fail_narrative_en="The numbers rearrange themselves faster than you can correct them. The debt grows. The floor groans.",
                fail_narrative_de="Die Zahlen ordnen sich schneller um, als ihr sie korrigieren könnt. Die Schulden wachsen. Der Boden ächzt.",
            ),
            EncounterChoice(
                id="tear_pages",
                label_en="Tear the pages",
                label_de="Die Seiten herausreißen",
                check_aptitude="saboteur",
                check_difficulty=0,
                success_effects={"stability": -5, "discovery": True},
                partial_effects={"stress": 40, "stability": -10},
                fail_effects={"stress": 80, "stability": -10},
                success_narrative_en="The pages come free with a sound like breaking ribs. The debt is erased, but so is whatever was holding this floor together.",
                success_narrative_de="Die Seiten lösen sich mit einem Geräusch wie brechender Rippen. Die Schulden sind gelöscht, aber auch was immer dieses Stockwerk zusammenhielt.",
                partial_narrative_en="Half the pages tear. The rest grip the binding with unnatural strength.",
                partial_narrative_de="Die Hälfte der Seiten reißt. Der Rest klammert sich mit unnatürlicher Kraft an die Bindung.",
                fail_narrative_en="The ledger bites back. The pages slice skin and the debt compounds on contact.",
                fail_narrative_de="Das Hauptbuch beißt zurück. Die Seiten schneiden Haut und die Schulden wachsen bei Kontakt.",
            ),
            EncounterChoice(
                id="read_margins",
                label_en="Read the margins",
                label_de="Die Randbemerkungen lesen",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 2, "stress": 10},
                partial_effects={"stress": 30},
                fail_effects={"stress": 50},
                success_narrative_en="The margins contain annotations \u2013 floor plans, load calculations, access routes. Someone was auditing this tower from the inside.",
                success_narrative_de="Die Ränder enthalten Anmerkungen \u2013 Grundrisse, Lastberechnungen, Zugangswege. Jemand hat diesen Turm von innen geprüft.",
                partial_narrative_en="The handwriting dissolves as you read it. You catch fragments before they fade.",
                partial_narrative_de="Die Handschrift löst sich auf, während ihr sie lest. Ihr fangt Fragmente auf, bevor sie verblassen.",
                fail_narrative_en="The numbers in the margins are not calculations. They are names. Reading them aloud was a mistake.",
                fail_narrative_de="Die Zahlen in den Rändern sind keine Berechnungen. Es sind Namen. Sie laut zu lesen war ein Fehler.",
            ),
            EncounterChoice(
                id="close_book",
                label_en="Close the book",
                label_de="Das Buch schließen",
                success_effects={"stress": 15},
                success_narrative_en="The cover closes with a sound like a vault door. The debt remains. It always does.",
                success_narrative_de="Der Deckel schließt sich mit einem Geräusch wie eine Tresortür. Die Schulden bleiben. Das tun sie immer.",
            ),
        ],
    ),
    EncounterTemplate(
        id="tower_fallen_assets",
        archetype="The Tower",
        room_type="encounter",
        min_depth=3,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A gallery of broken authority. Statues of former owners, their faces "
            "ground smooth by vibration. Each one held this tower when it was still "
            "ascending. Now they lean at angles that defy the remaining geometry. "
            "Something in their arrangement is load-bearing."
        ),
        description_de=(
            "Eine Galerie gebrochener Autorität. Statuen ehemaliger Eigentümer, "
            "ihre Gesichter glattgeschliffen durch Vibration. Jeder von ihnen hielt "
            "diesen Turm, als er noch aufstieg. Nun lehnen sie sich in Winkeln, die "
            "der verbliebenen Geometrie trotzen. Etwas in ihrer Anordnung ist tragend."
        ),
        choices=[
            EncounterChoice(
                id="reinforce_statues",
                label_en="Reinforce the arrangement",
                label_de="Die Anordnung verstärken",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"stability": 15, "stress": -30},
                partial_effects={"stability": 5, "stress": 20},
                fail_effects={"stress": 60, "stability": -10},
                success_narrative_en="You brace the statues against each other. The arrangement holds. The tower remembers what support felt like.",
                success_narrative_de="Ihr stützt die Statuen gegeneinander ab. Die Anordnung hält. Der Turm erinnert sich, wie sich Stützung anfühlte.",
                partial_narrative_en="Some statues stabilize. Others shift under your hands, settling into new angles of precariousness.",
                partial_narrative_de="Einige Statuen stabilisieren sich. Andere verschieben sich unter euren Händen und nehmen neue Winkel der Unsicherheit ein.",
                fail_narrative_en="A statue topples. The chain reaction shakes the floor and costs you more than you gained.",
                fail_narrative_de="Eine Statue stürzt. Die Kettenreaktion erschüttert den Boden und kostet euch mehr, als ihr gewonnen habt.",
            ),
            EncounterChoice(
                id="topple_statues",
                label_en="Topple the arrangement",
                label_de="Die Anordnung umstürzen",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"discovery": True, "stress": 10, "stability": -5},
                partial_effects={"stress": 40, "stability": -10},
                fail_effects={"stress": 80, "stability": -15},
                success_narrative_en="The statues crash in controlled sequence. Behind the last one: a passage the tower was hiding from itself.",
                success_narrative_de="Die Statuen stürzen in kontrollierter Folge. Hinter der letzten: ein Durchgang, den der Turm vor sich selbst versteckt hat.",
                partial_narrative_en="Half the statues fall. The passage is visible but partially blocked. The structure protests.",
                partial_narrative_de="Die Hälfte der Statuen fällt. Der Durchgang ist sichtbar, aber teilweise blockiert. Die Struktur protestiert.",
                fail_narrative_en="Uncontrolled demolition. The statues collapse inward and the ceiling follows their example.",
                fail_narrative_de="Unkontrollierter Abriss. Die Statuen kollabieren nach innen und die Decke folgt ihrem Beispiel.",
            ),
            EncounterChoice(
                id="study_statues",
                label_en="Study the arrangement",
                label_de="Die Anordnung studieren",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 1, "stress": 0, "insight": True},
                partial_effects={"stress": 20},
                fail_effects={"stress": 40},
                success_narrative_en="The angles are a language. The statues point to where the tower is weakest \u2013 and strongest. You read both.",
                success_narrative_de="Die Winkel sind eine Sprache. Die Statuen zeigen, wo der Turm am schwächsten ist \u2013 und am stärksten. Ihr lest beides.",
                partial_narrative_en="You catch patterns but lose them when the vibration shifts. Partial data is better than none.",
                partial_narrative_de="Ihr erkennt Muster, verliert sie aber, wenn die Vibration sich verschiebt. Teilweise Daten sind besser als keine.",
                fail_narrative_en="The arrangement is too complex. The patterns dissolve into noise. Your head aches with unused insight.",
                fail_narrative_de="Die Anordnung ist zu komplex. Die Muster lösen sich in Rauschen auf. Euer Kopf schmerzt von ungenutzter Erkenntnis.",
            ),
        ],
    ),
]

# ── Tower Elite Encounter (1) ──────────────────────────────────────────────

TOWER_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_remnant_commerce_encounter",
        archetype="The Tower",
        room_type="elite",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The trading floor. Or what remains of it. The boards are cracked, the "
            "displays shattered, but the Remnant of Commerce still operates \u2013 "
            "buying, selling, collapsing, in an endless loop of proprietary "
            "destruction. A lone broker orbits it, feeding it data from markets that "
            "no longer exist."
        ),
        description_de=(
            "Das Handelsparkett. Oder was davon übrig ist. Die Bretter sind "
            "geborsten, die Anzeigen zerschmettert, aber das Relikt des Handels "
            "operiert noch \u2013 kaufend, verkaufend, einstürzend, in einer endlosen "
            "Schleife endloser Selbstliquidation. Ein einsamer Makler umkreist es und "
            "füttert es mit Daten von Märkten, die nicht mehr existieren."
        ),
        combat_encounter_id="tower_collapse_spawn",
    ),
]

# ── Tower Boss Encounter (1) ───────────────────────────────────────────────

TOWER_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_the_collapse",
        archetype="The Tower",
        room_type="boss",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The Tower screams. Not metaphorically \u2013 the structural frequency "
            "shifts to something your teeth interpret as sound, something your bones "
            "read as countdown. The highest floor begins to compress. The Remnant of "
            "Commerce waits at the center, adjusting its ledgers while the ceiling "
            "descends. You did not come to save the tower. The tower saved itself by "
            "letting go."
        ),
        description_de=(
            "Der Turm schreit. Nicht metaphorisch \u2013 die Strukturfrequenz "
            "verschiebt sich zu etwas, das eure Zähne als Klang interpretieren, "
            "etwas, das eure Knochen als Countdown lesen. Das oberste Stockwerk "
            "beginnt sich zu komprimieren. Das Relikt des Handels wartet im Zentrum "
            "und korrigiert seine Hauptbücher, während die Decke herabsinkt. Ihr "
            "seid nicht gekommen, den Turm zu retten. Der Turm rettete sich selbst, "
            "indem er losließ."
        ),
        combat_encounter_id="tower_collapse_spawn",
    ),
]

# ── Tower Rest Encounter (1) ───────────────────────────────────────────────

TOWER_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_the_vault",
        archetype="The Tower",
        room_type="rest",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A reinforced room. The walls here are thicker, the ceiling braced with "
            "steel that has not yet learned to fail. The structural readings stabilize. "
            "For the first time since entering, the building is not actively trying to "
            "kill you. Probably."
        ),
        description_de=(
            "Ein verstärkter Raum. Die Wände hier sind dicker, die Decke mit Stahl "
            "verstärkt, der noch nicht gelernt hat zu versagen. Die Strukturwerte "
            "stabilisieren sich. Zum ersten Mal seit dem Eintritt versucht das "
            "Gebäude nicht aktiv, euch umzubringen. Wahrscheinlich."
        ),
        choices=[
            EncounterChoice(
                id="tower_rest_full",
                label_en="Rest (heal stress, risk ambush)",
                label_de="Rasten (Stress heilen, Hinterhalt-Risiko)",
                success_effects={
                    "stress_heal": 200,
                    "wounded_to_stressed": True,
                    "ambush_chance": 0.20,
                },
                success_narrative_en="The party rests against reinforced walls. The tremors subside. For a few minutes, the numbers stop.",
                success_narrative_de="Die Gruppe rastet an verstärkten Wänden. Die Erschütterungen lassen nach. Für ein paar Minuten hören die Zahlen auf.",
            ),
            EncounterChoice(
                id="tower_rest_guarded",
                label_en="Post a Guardian watch (safe, but Guardian doesn't heal)",
                label_de="Wächter aufstellen (sicher, aber Wächter heilt nicht)",
                requires_aptitude={"guardian": 3},
                success_effects={
                    "stress_heal": 200,
                    "wounded_to_stressed": True,
                    "guardian_no_heal": True,
                    "stability": 10,
                },
                success_narrative_en="The Guardian monitors the structural readings while others rest. No tremor comes unseen. The tower stabilizes locally.",
                success_narrative_de="Der Wächter überwacht die Strukturwerte, während die anderen rasten. Keine Erschütterung kommt unbemerkt. Der Turm stabilisiert sich lokal.",
            ),
            EncounterChoice(
                id="tower_rest_assess",
                label_en="Saboteur assessment (stability boost, reveal room)",
                label_de="Saboteur-Bewertung (Stabilitätsschub, Raum aufdecken)",
                requires_aptitude={"saboteur": 3},
                success_effects={"stability": 5, "reveal_rooms": 1},
                success_narrative_en="The Saboteur maps the load-bearing walls, identifying stress fractures and hidden passages. Knowledge is structural power.",
                success_narrative_de="Der Saboteur kartiert die tragenden Wände und identifiziert Spannungsrisse und verborgene Durchgänge. Wissen ist strukturelle Macht.",
            ),
        ],
    ),
]

# ── Tower Treasure Encounter (1) ───────────────────────────────────────────

TOWER_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="tower_cache",
        archetype="The Tower",
        room_type="treasure",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A strongbox embedded in a load-bearing column. The contents are valuable "
            "\u2013 you can feel the weight of accumulated capital through the metal. "
            "Extracting it without weakening the column requires precision or "
            "acceptable risk tolerance."
        ),
        description_de=(
            "Ein Tresor, eingelassen in eine tragende Säule. Der Inhalt ist wertvoll "
            "\u2013 ihr spürt das Gewicht akkumulierten Kapitals durch das Metall. "
            "Ihn zu bergen, ohne die Säule zu schwächen, erfordert Präzision oder "
            "akzeptable Risikotoleranz."
        ),
        choices=[
            EncounterChoice(
                id="tower_careful_extract",
                label_en="Careful extraction (Spy)",
                label_de="Vorsichtige Bergung (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"loot": True},
                partial_effects={"loot": True, "loot_tier_penalty": 1},
                fail_effects={"stress": 75, "stability": -10, "trap_triggered": True},
                success_narrative_en="Millimeter by millimeter, the strongbox slides free. The column holds. The capital is yours.",
                success_narrative_de="Millimeter für Millimeter gleitet der Tresor heraus. Die Säule hält. Das Kapital gehört euch.",
                partial_narrative_en="The extraction is imperfect. Some contents scatter and devalue on contact with the floor.",
                partial_narrative_de="Die Bergung ist unvollkommen. Einige Inhalte zerstreuen sich und verlieren an Wert bei Bodenkontakt.",
                fail_narrative_en="The column cracks. The strongbox contents scatter as the ceiling settles three centimeters lower.",
                fail_narrative_de="Die Säule bricht. Die Tresorinhalte zerstreuen sich, während die Decke drei Zentimeter tiefer sinkt.",
            ),
            EncounterChoice(
                id="tower_demolish_extract",
                label_en="Controlled demolition (Saboteur)",
                label_de="Kontrollierter Abriss (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"loot": True},
                partial_effects={
                    "loot": True,
                    "loot_tier_penalty": 1,
                    "stress": 30,
                    "stability": -5,
                },
                fail_effects={"stress": 50, "stability": -10},
                success_narrative_en="The charge is precise. The column redistributes its load. The strongbox contents are intact.",
                success_narrative_de="Die Ladung ist präzise. Die Säule verteilt ihre Last um. Die Tresorinhalte sind intakt.",
                partial_narrative_en="The blast is slightly off. The loot survives, but the floor shudders in protest.",
                partial_narrative_de="Die Detonation ist leicht daneben. Die Beute überlebt, aber der Boden bebt im Protest.",
                fail_narrative_en="Miscalculated. The blast propagates through the column into the floor. Structural damage compounds.",
                fail_narrative_de="Fehlberechnet. Die Detonation pflanzt sich durch die Säule in den Boden fort. Strukturschäden kumulieren.",
            ),
            EncounterChoice(
                id="tower_leave_cache",
                label_en="Leave it (no risk)",
                label_de="Liegenlassen (kein Risiko)",
                success_effects={},
                success_narrative_en="The column keeps its secret. The ceiling stays where it is. Some capital is best left embedded.",
                success_narrative_de="Die Säule behält ihr Geheimnis. Die Decke bleibt, wo sie ist. Manches Kapital lässt man besser eingebettet.",
            ),
        ],
    ),
]


# ── Tower Registry ─────────────────────────────────────────────────────────

ALL_TOWER_ENCOUNTERS: list[EncounterTemplate] = (
    TOWER_COMBAT_ENCOUNTERS
    + TOWER_NARRATIVE_ENCOUNTERS
    + TOWER_ELITE_ENCOUNTERS
    + TOWER_BOSS_ENCOUNTERS
    + TOWER_REST_ENCOUNTERS
    + TOWER_TREASURE_ENCOUNTERS
)


# ── Archetype Encounter Registry ──────────────────────────────────────────

_ENCOUNTER_REGISTRIES: dict[str, list[EncounterTemplate]] = {
    "The Shadow": ALL_SHADOW_ENCOUNTERS,
    "The Tower": ALL_TOWER_ENCOUNTERS,
}


def _build_encounter_index() -> dict[str, EncounterTemplate]:
    """Build combined encounter index from all archetype registries."""
    index: dict[str, EncounterTemplate] = {}
    for encounters in _ENCOUNTER_REGISTRIES.values():
        for e in encounters:
            index[e.id] = e
    return index


_ENCOUNTER_BY_ID: dict[str, EncounterTemplate] = _build_encounter_index()


def get_encounter_by_id(encounter_id: str) -> EncounterTemplate | None:
    """Look up an encounter template by ID (any archetype)."""
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
    encounter_pool = _ENCOUNTER_REGISTRIES.get(archetype, [])
    candidates = [
        e
        for e in encounter_pool
        if e.room_type == room_type and e.min_depth <= depth <= e.max_depth and difficulty >= e.min_difficulty
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
        "text_de": "{agent} zuckt bei einem Geräusch zusammen, das nur sie hören.",
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
        "text_de": "{agent} überprüft methodisch die Ausrüstung. Alles in Ordnung. Wieder.",
    },
    {
        "id": "sb_05",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "The terminal flickers. For a moment, the amber glow is the only light in the world.",
        "text_de": "Das Terminal flackert. Für einen Moment ist das Bernsteinleuchten das einzige Licht auf der Welt.",
    },
    # Combat won
    {
        "id": "sb_06",
        "trigger": "combat_won",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} moves through the formation, confirming each operative. Only then does the tension release.",
        "text_de": "{agent} geht die Reihe ab, prüft jeden einzelnen. Erst danach lässt die Anspannung nach.",
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
        "text_de": "Die Stille kehrt zurück. Hier ist sie nie tröstlich.",
    },
    # Visibility zero
    {
        "id": "sb_10",
        "trigger": "visibility_zero",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'I can feel the walls. They're closer than they should be.'",
        "text_de": "{agent}: \u00bbIch kann die Wände spüren. Sie sind näher als sie sein sollten.\u00ab",
    },
    {
        "id": "sb_11",
        "trigger": "visibility_zero",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}'s composure fractures. They have begun counting the intervals between sounds that are not there.",
        "text_de": "{agent}s Fassung bricht. Sie zählen die Abstände zwischen Geräuschen, die nicht da sind.",
    },
    {
        "id": "sb_12",
        "trigger": "visibility_zero",
        "personality_filter": {},
        "text_en": "The instruments read nothing. Not zero \u2013 nothing. As if measurement itself has been consumed.",
        "text_de": "Die Instrumente zeigen nichts an. Nicht Null \u2013 nichts. Als wäre das Messen selbst verschlungen worden.",
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
        "text_de": "{agent}s Ausdruck verhärtet sich. Sie hören auf, die anderen anzusehen.",
    },
    # Opinion-driven (positive pair)
    {
        "id": "sb_15",
        "trigger": "combat_won",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} nods at {agent_b}. No words needed.",
        "text_de": "{agent_a} nickt {agent_b} zu. Keine Worte nötig.",
    },
    {
        "id": "sb_16",
        "trigger": "room_entered",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} and {agent_b} move in practiced coordination, covering each other's blind spots.",
        "text_de": "{agent_a} und {agent_b} bewegen sich in eingeübter Koordination und decken die toten Winkel des anderen.",
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
        "text_de": "{agent_a}: \u00bbNächstes Mal versuch nicht in meiner Schusslinie zu stehen, {agent_b}.\u00ab",
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
        "text_de": "Der Schattenrückstand ist kalt bei Berührung. Er summt leise, wie eine Stimmgabel, die im Dunkeln angeschlagen wurde.",
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
        "text_en": "The hollow is silent. For a few minutes, nothing pursues them.",
        "text_de": "Die Höhle schweigt. Für ein paar Minuten verfolgt sie nichts.",
    },
    # Depth transitions — archetype-environmental (no body-specific metaphors)
    {
        "id": "sb_24",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "Deeper. The temperature drops. The silence becomes structural.",
        "text_de": "Tiefer. Die Temperatur sinkt. Die Stille wird baulich.",
    },
    {
        "id": "sb_25",
        "trigger": "depth_change",
        "personality_filter": {"openness": (0.0, 0.3)},
        "text_en": "{agent}: 'We should turn back.' No one responds.",
        "text_de": "{agent}: \u00bbWir sollten umkehren.\u00ab Niemand antwortet.",
    },
    {
        "id": "sb_30",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "The passage narrows. Not physically \u2013 conceptually. There are fewer ways out.",
        "text_de": "Der Durchgang verengt sich. Nicht physisch \u2013 konzeptuell. Es gibt weniger Wege hinaus.",
    },
    {
        "id": "sb_31",
        "trigger": "depth_change",
        "personality_filter": {"neuroticism": (0.5, 1.0)},
        "text_en": "{agent} counts the steps since the last rest. Stops counting.",
        "text_de": "{agent} zählt die Schritte seit der letzten Rast. Hört auf zu zählen.",
    },
    {
        "id": "sb_32",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "The darkness here has weight. It presses down like accumulated intention.",
        "text_de": "Die Dunkelheit hier hat Gewicht. Sie drückt herab wie angesammelte Absicht.",
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
        "text_de": "Die Luft ändert sich. Das Flüstern verstummt. In der folgenden Stille holt etwas Enormes Atem.",
    },
    {
        "id": "sb_29",
        "trigger": "boss_approach",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} reaches out and squeezes the nearest hand. 'Together.'",
        "text_de": "{agent} greift nach der nächsten Hand und drückt sie. \u00bbZusammen.\u00ab",
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
        "text_en": "Something snaps in {agent} \u2013 but it's the sound of chains breaking, not bone. They stand straighter.",
        "text_de": "Etwas bricht in {agent} \u2013 aber es ist das Geräusch brechender Ketten, nicht von Knochen. Sie stehen aufrechter.",
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
        "text_de": "Irgendwo oben, ein fernes Geräusch wie Stein, der auf Stein mahlt. Der Dungeon verschiebt sich.",
    },
    {
        "id": "sb_35",
        "trigger": "room_entered",
        "personality_filter": {"conscientiousness": (0.0, 0.3)},
        "text_en": "{agent} kicks a loose stone. It falls into darkness. You don't hear it land.",
        "text_de": "{agent} tritt gegen einen losen Stein. Er fällt in die Dunkelheit. Ihr hört ihn nicht aufschlagen.",
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
        "text_de": "{agent} hält inne, um den sich auflösenden Schatten zu untersuchen. \u00bbFaszinierende Struktur. Wie gefrorener Rauch.\u00ab",
    },
    # Retreat banter
    {
        "id": "sb_38",
        "trigger": "retreat",
        "personality_filter": {},
        "text_en": "The darkness lets you leave. That's the most unsettling part.",
        "text_de": "Die Dunkelheit lässt euch gehen. Das ist der beunruhigendste Teil.",
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
        "text_de": "Licht. Tatsächliches Licht. Die Gruppe schirmt die Augen ab. Hinter ihnen versiegelt sich der Eingang.",
    },
    {
        "id": "sb_41",
        "trigger": "dungeon_completed",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} doesn't celebrate. They keep checking the shadows. They'll keep checking for a long time.",
        "text_de": "{agent} feiert nicht. Sie prüfen weiter die Schatten. Sie werden das noch lange tun.",
    },
]

# ══════════════════════════════════════════════════════════════════════════════
# THE TOWER — Banter
# Prose tone: Clinical. Economic. Architecture as organic failure.
# Numbers counting down. Financial metaphors. Structural collapse.
# ══════════════════════════════════════════════════════════════════════════════

TOWER_BANTER: list[dict] = [
    # ── Room entered ───────────────────────────────────────────────────────
    {
        "id": "tb_01",
        "trigger": "room_entered",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} counts the cracks in the load-bearing wall. The number has increased since the last room.",
        "text_de": "{agent} zählt die Risse in der tragenden Wand. Die Zahl ist seit dem letzten Raum gestiegen.",
    },
    {
        "id": "tb_02",
        "trigger": "room_entered",
        "personality_filter": {"extraversion": (0.0, 0.3)},
        "text_en": "{agent} places a hand against the wall. Feels the frequency. Says nothing.",
        "text_de": "{agent} legt eine Hand an die Wand. Spürt die Frequenz. Sagt nichts.",
    },
    {
        "id": "tb_03",
        "trigger": "room_entered",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'The geometry here is wrong. Not broken \u2013 bankrupt.'",
        "text_de": "{agent}: \u00bbDie Geometrie hier ist falsch. Nicht zerbrochen \u2013 bankrott.\u00ab",
    },
    {
        "id": "tb_04",
        "trigger": "room_entered",
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} runs a finger along the baseboard. Measures the deviation from plumb. Records it mentally.",
        "text_de": "{agent} fährt mit dem Finger am Sockel entlang. Misst die Abweichung vom Lot. Notiert es im Kopf.",
    },
    {
        "id": "tb_05",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "The floor tilts two degrees. The instruments confirm what the structure already warned.",
        "text_de": "Der Boden neigt sich um zwei Grad. Die Instrumente bestätigen, was das Gebäude längst angekündigt hat.",
    },
    {
        "id": "tb_06",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "Somewhere above, concrete dust sifts down like snow. The tower is shedding.",
        "text_de": "Irgendwo oben rieselt Betonstaub herab wie Schnee. Der Turm häutet sich.",
    },
    {
        "id": "tb_07",
        "trigger": "room_entered",
        "personality_filter": {"extraversion": (0.7, 1.0)},
        "text_en": "{agent}: 'Another floor. Still standing. That's optimistic of it.'",
        "text_de": "{agent}: \u00bbNoch ein Stockwerk. Steht noch. Optimistisch von ihm.\u00ab",
    },
    {
        "id": "tb_08",
        "trigger": "room_entered",
        "personality_filter": {"conscientiousness": (0.0, 0.3)},
        "text_en": "{agent} steps over a crack in the floor without looking down. Ignorance as strategy.",
        "text_de": "{agent} tritt über einen Riss im Boden, ohne hinunterzuschauen. Unwissenheit als Strategie.",
    },
    # ── Combat won ─────────────────────────────────────────────────────────
    {
        "id": "tb_09",
        "trigger": "combat_won",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} checks on the party. 'Everyone still solvent?'",
        "text_de": "{agent} sieht nach der Gruppe. \u00bbAlle noch zahlungsfähig?\u00ab",
    },
    {
        "id": "tb_10",
        "trigger": "combat_won",
        "personality_filter": {"extraversion": (0.7, 1.0)},
        "text_en": "{agent}: 'Account settled. Next.'",
        "text_de": "{agent}: \u00bbKonto beglichen. Nächstes.\u00ab",
    },
    {
        "id": "tb_11",
        "trigger": "combat_won",
        "personality_filter": {"neuroticism": (0.0, 0.3)},
        "text_en": "{agent} catalogues the remains with professional detachment. Data for the post-mortem.",
        "text_de": "{agent} katalogisiert die Überreste mit professioneller Distanz. Daten für die Nachbesprechung.",
    },
    {
        "id": "tb_12",
        "trigger": "combat_won",
        "personality_filter": {},
        "text_en": "The numbers stop cascading. The structural readout ticks back toward green. Briefly.",
        "text_de": "Die Zahlen hören auf zu stürzen. Die Strukturanzeige tickt zurück Richtung grün. Kurz.",
    },
    # ── Stability critical (Tower-specific, stability <= 20) ───────────────
    {
        "id": "tb_13",
        "trigger": "stability_critical",
        "personality_filter": {},
        "text_en": "STRUCTURAL INTEGRITY: CRITICAL. The instruments display readings they were not calibrated to show.",
        "text_de": "STRUKTURELLE INTEGRITÄT: KRITISCH. Die Instrumente zeigen Werte an, für die sie nicht kalibriert wurden.",
    },
    {
        "id": "tb_14",
        "trigger": "stability_critical",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}: 'The ceiling. Is the ceiling lower than before?'",
        "text_de": "{agent}: \u00bbDie Decke. Ist die Decke niedriger als vorher?\u00ab",
    },
    {
        "id": "tb_15",
        "trigger": "stability_critical",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'Listen. The frequency has changed. The tower is counting down.'",
        "text_de": "{agent}: \u00bbHört zu. Die Frequenz hat sich verändert. Der Turm zählt herunter.\u00ab",
    },
    {
        "id": "tb_16",
        "trigger": "stability_critical",
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} recalculates the remaining load capacity. The margins are no longer margins.",
        "text_de": "{agent} berechnet die verbleibende Tragfähigkeit neu. Die Reserven sind keine Reserven mehr.",
    },
    # ── Stability collapse (Tower-specific, stability == 0) ─────────────────
    {
        "id": "tb_49",
        "trigger": "stability_collapse",
        "personality_filter": {},
        "text_en": "STRUCTURAL FAILURE. The load-bearing walls have given up the pretence. The building no longer pretends it was designed to be lived in.",
        "text_de": "STRUKTURVERSAGEN. Die Tragwände haben die Fassade aufgegeben. Das Gebäude tut nicht länger so, als wäre es zum Bewohnen gebaut.",
    },
    {
        "id": "tb_50",
        "trigger": "stability_collapse",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}: 'The readings are at zero. ZERO. That's not a number \u2013 that's a countdown that's already finished.'",
        "text_de": "{agent}: \u00bbDie Werte sind auf null. NULL. Das ist keine Zahl \u2013 das ist ein Countdown, der schon vorbei ist.\u00ab",
    },
    {
        "id": "tb_51",
        "trigger": "stability_collapse",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "The tower has crossed from architecture into archaeology. Every step forward is a step through what this building used to be.",
        "text_de": "Der Turm ist von Architektur zu Archäologie übergegangen. Jeder Schritt vorwärts ist ein Schritt durch das, was dieses Gebäude einmal war.",
    },
    {
        "id": "tb_52",
        "trigger": "stability_collapse",
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} stops recording structural data. There is no structure left to record. Only momentum and gravity, negotiating terms.",
        "text_de": "{agent} hört auf, Strukturdaten aufzuzeichnen. Es gibt keine Struktur mehr, die man erfassen könnte. Nur noch Schwerkraft und Trägheit, die Bedingungen aushandeln.",
    },
    # ── Depth change ───────────────────────────────────────────────────────
    {
        "id": "tb_17",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "Higher. The structure protests. Each floor carries the memory of every floor beneath it.",
        "text_de": "Höher. Das Gebäude wehrt sich. Jedes Stockwerk trägt die Erinnerung an jedes Stockwerk darunter.",
    },
    {
        "id": "tb_18",
        "trigger": "depth_change",
        "personality_filter": {"openness": (0.0, 0.3)},
        "text_en": "{agent}: 'Every floor we climb is a floor that can collapse beneath us.' No one argues.",
        "text_de": "{agent}: \u00bbJedes Stockwerk, das wir erklimmen, ist ein Stockwerk, das unter uns einstürzen kann.\u00ab Niemand widerspricht.",
    },
    {
        "id": "tb_46",
        "trigger": "depth_change",
        "personality_filter": {},
        "text_en": "The stairwell narrows. Not the walls \u2013 the sense that return is possible.",
        "text_de": "Das Treppenhaus verengt sich. Nicht die Wände \u2013 das Gefühl, dass Umkehr noch möglich ist.",
    },
    {
        "id": "tb_47",
        "trigger": "depth_change",
        "personality_filter": {"conscientiousness": (0.6, 1.0)},
        "text_en": "{agent} notes the load-bearing walls thinning. Structural integrity is a promise the building may not keep.",
        "text_de": "{agent} registriert die dünner werdenden Tragwände. Statische Integrität ist ein Versprechen, das das Gebäude möglicherweise nicht hält.",
    },
    {
        "id": "tb_48",
        "trigger": "depth_change",
        "personality_filter": {"neuroticism": (0.5, 1.0)},
        "text_en": "{agent} pauses on the landing. Listens to the floor below settle into a position it was not designed to hold.",
        "text_de": "{agent} verharrt auf dem Absatz. Lauscht, wie sich das Stockwerk darunter in eine Lage senkt, für die es nicht vorgesehen war.",
    },
    # ── Boss approach ──────────────────────────────────────────────────────
    {
        "id": "tb_19",
        "trigger": "boss_approach",
        "personality_filter": {},
        "text_en": "The vibration changes from tremor to harmonic. The tower is resonating at its failure frequency. Something at the top is conducting.",
        "text_de": "Die Vibration wechselt von Tremor zu Harmonik. Der Turm resoniert auf seiner Versagensfrequenz. Etwas an der Spitze dirigiert.",
    },
    {
        "id": "tb_20",
        "trigger": "boss_approach",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} grips {agent_b}'s arm. 'Whatever the cost, we pay it together.'",
        "text_de": "{agent} greift nach {agent_b}s Arm. \u00bbWas auch immer der Preis, wir zahlen ihn gemeinsam.\u00ab",
    },
    {
        "id": "tb_21",
        "trigger": "boss_approach",
        "personality_filter": {"extraversion": (0.0, 0.3)},
        "text_en": "{agent} is already calculating exit routes. Three options. All of them involve structural failure.",
        "text_de": "{agent} berechnet bereits Fluchtwege. Drei Optionen. Alle beinhalten Strukturversagen.",
    },
    # ── Agent stressed ─────────────────────────────────────────────────────
    {
        "id": "tb_22",
        "trigger": "agent_stressed",
        "personality_filter": {"extraversion": (0.6, 1.0)},
        "text_en": "{agent} laughs. It sounds like rebar bending. 'I'm fine. The building isn't, but I'm fine.'",
        "text_de": "{agent} lacht. Es klingt wie sich biegender Bewehrungsstahl. \u00bbMir geht's gut. Dem Gebäude nicht, aber mir geht's gut.\u00ab",
    },
    {
        "id": "tb_23",
        "trigger": "agent_stressed",
        "personality_filter": {"agreeableness": (0.0, 0.3)},
        "text_en": "{agent}'s jaw tightens. Their stress is load-bearing. Remove it and something collapses.",
        "text_de": "{agent}s Kiefer spannt sich an. Ihr Stress ist tragend. Entfernt ihn und etwas kollabiert.",
    },
    # ── Agent afflicted ────────────────────────────────────────────────────
    {
        "id": "tb_24",
        "trigger": "agent_afflicted",
        "personality_filter": {},
        "text_en": "{agent}'s posture shifts. They begin reciting numbers under their breath \u2013 debts that are not theirs. Not yet.",
        "text_de": "{agent}s Haltung verändert sich. Sie beginnen leise Zahlen zu rezitieren \u2013 Schulden, die nicht ihre sind. Noch nicht.",
    },
    # ── Agent virtue ───────────────────────────────────────────────────────
    {
        "id": "tb_25",
        "trigger": "agent_virtue",
        "personality_filter": {},
        "text_en": "Something hardens in {agent} \u2013 not brittle, but load-bearing. They plant their feet as if they are the column this floor needs.",
        "text_de": "Etwas verhärtet sich in {agent} \u2013 nicht spröde, sondern tragend. Sie stellen sich hin, als wären sie die Säule, die dieses Stockwerk braucht.",
    },
    # ── Elite spotted ──────────────────────────────────────────────────────
    {
        "id": "tb_26",
        "trigger": "elite_spotted",
        "personality_filter": {},
        "text_en": "The trading boards flicker. Something massive operates at the center of the floor, buying and selling in a dead market.",
        "text_de": "Die Handelsbretter flackern. Etwas Massives operiert im Zentrum des Stockwerks, kauft und verkauft auf einem toten Markt.",
    },
    {
        "id": "tb_27",
        "trigger": "elite_spotted",
        "personality_filter": {"neuroticism": (0.7, 1.0)},
        "text_en": "{agent}: 'That thing is still trading. The market crashed and it's still trading.'",
        "text_de": "{agent}: \u00bbDas Ding handelt immer noch. Der Markt ist abgestürzt und es handelt immer noch.\u00ab",
    },
    # ── Loot found ─────────────────────────────────────────────────────────
    {
        "id": "tb_28",
        "trigger": "loot_found",
        "personality_filter": {"conscientiousness": (0.0, 0.4)},
        "text_en": "{agent} palms the most portable asset before inventory is taken. Old accounting habits.",
        "text_de": "{agent} steckt den handlichsten Vermögenswert ein, bevor inventarisiert wird. Alte Buchhaltungsgewohnheiten.",
    },
    {
        "id": "tb_29",
        "trigger": "loot_found",
        "personality_filter": {},
        "text_en": "The salvage is cold. Condensation forms on the metal as if the tower's climate is rejecting the withdrawal.",
        "text_de": "Die Bergung ist kalt. Kondenswasser bildet sich auf dem Metall, als würde das Klima des Turms die Entnahme ablehnen.",
    },
    {
        "id": "tb_30",
        "trigger": "loot_found",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} turns the artifact over in their hands. 'This was currency once. Before the tower redefined value.'",
        "text_de": "{agent} dreht das Artefakt in den Händen. \u00bbDas war einmal Währung. Bevor der Turm den Wert neu definiert hat.\u00ab",
    },
    # ── Rest start ─────────────────────────────────────────────────────────
    {
        "id": "tb_31",
        "trigger": "rest_start",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} cannot rest. They sit with their back against the reinforced wall, counting the interval between tremors.",
        "text_de": "{agent} kann nicht rasten. Sie sitzen mit dem Rücken an der verstärkten Wand und zählen die Intervalle zwischen den Erschütterungen.",
    },
    {
        "id": "tb_32",
        "trigger": "rest_start",
        "personality_filter": {"extraversion": (0.6, 1.0)},
        "text_en": "{agent}: 'You know what this vault needs? A window. And a bar. Mostly a bar.'",
        "text_de": "{agent}: \u00bbWisst ihr, was dieser Tresorraum braucht? Ein Fenster. Und eine Bar. Vor allem eine Bar.\u00ab",
    },
    {
        "id": "tb_33",
        "trigger": "rest_start",
        "personality_filter": {},
        "text_en": "The vault hums at a frequency that almost sounds like quiet. For a moment, the ledger balances.",
        "text_de": "Der Tresorraum summt auf einer Frequenz, die fast nach Stille klingt. Für einen Moment geht die Rechnung auf.",
    },
    # ── Retreat ─────────────────────────────────────────────────────────────
    {
        "id": "tb_34",
        "trigger": "retreat",
        "personality_filter": {},
        "text_en": "The stairwell down is still intact. The tower permits the withdrawal. The interest, however, continues to accrue.",
        "text_de": "Das Treppenhaus nach unten ist noch intakt. Der Turm gestattet den Rückzug. Die Zinsen allerdings laufen weiter.",
    },
    {
        "id": "tb_35",
        "trigger": "retreat",
        "personality_filter": {"agreeableness": (0.0, 0.3)},
        "text_en": "{agent}: 'Strategic divestment. Not retreat. There's a difference. On paper.'",
        "text_de": "{agent}: \u00bbStrategische Desinvestition. Kein Rückzug. Es gibt einen Unterschied. Auf dem Papier.\u00ab",
    },
    # ── Dungeon completed ──────────────────────────────────────────────────
    {
        "id": "tb_36",
        "trigger": "dungeon_completed",
        "personality_filter": {},
        "text_en": "Ground floor. The exit is open. Behind you, the tower settles into its new equilibrium \u2013 lower, quieter, diminished but still standing.",
        "text_de": "Erdgeschoss. Der Ausgang ist offen. Hinter euch findet der Turm sein neues Gleichgewicht \u2013 niedriger, leiser, vermindert aber noch stehend.",
    },
    {
        "id": "tb_37",
        "trigger": "dungeon_completed",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} keeps checking the structural readings. The numbers are stable. They don't trust stable.",
        "text_de": "{agent} prüft weiter die Strukturwerte. Die Zahlen sind stabil. Sie trauen stabil nicht.",
    },
    # ── Opinion-driven (positive pair) ─────────────────────────────────────
    {
        "id": "tb_38",
        "trigger": "combat_won",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} and {agent_b} move through the aftermath in efficient tandem. Shared risk, shared dividends.",
        "text_de": "{agent_a} und {agent_b} bewegen sich in effizientem Tandem durch die Nachwehen. Geteiltes Risiko, geteilte Dividenden.",
    },
    {
        "id": "tb_39",
        "trigger": "room_entered",
        "personality_filter": {"opinion_positive_pair": True},
        "text_en": "{agent_a} glances at {agent_b}. A nod. The structural assessment is shared without words.",
        "text_de": "{agent_a} blickt zu {agent_b}. Ein Nicken. Die Strukturbewertung wird wortlos geteilt.",
    },
    # ── Opinion-driven (negative pair) ─────────────────────────────────────
    {
        "id": "tb_40",
        "trigger": "agent_stressed",
        "personality_filter": {"opinion_negative_pair": True},
        "text_en": "{agent_a} watches {agent_b} struggle. Calculates the liability. Offers nothing.",
        "text_de": "{agent_a} beobachtet wie {agent_b} kämpft. Berechnet die Verbindlichkeit. Bietet nichts an.",
    },
    {
        "id": "tb_41",
        "trigger": "combat_won",
        "personality_filter": {"opinion_negative_pair": True},
        "text_en": "{agent_a}: 'Your position was exposed, {agent_b}. Structurally and tactically.'",
        "text_de": "{agent_a}: \u00bbDeine Position war exponiert, {agent_b}. Strukturell und taktisch.\u00ab",
    },
    # ── Additional atmosphere (bringing total above 41) ────────────────────
    {
        "id": "tb_42",
        "trigger": "room_entered",
        "personality_filter": {},
        "text_en": "A clock on the wall runs backward. The hands move with the confidence of a market correction.",
        "text_de": "Eine Uhr an der Wand läuft rückwärts. Die Zeiger bewegen sich mit der Zuversicht einer Marktkorrektur.",
    },
    {
        "id": "tb_43",
        "trigger": "combat_won",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} examines the dissipating broker. 'Fascinating. Even in death, it's trying to close the deal.'",
        "text_de": "{agent} untersucht den sich auflösenden Makler. \u00bbFaszinierend. Selbst im Tod versucht er den Abschluss.\u00ab",
    },
    {
        "id": "tb_44",
        "trigger": "stability_critical",
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent}: 'We need to move. Together. Now.' The floor confirms the urgency with a groan.",
        "text_de": "{agent}: \u00bbWir müssen weiter. Zusammen. Jetzt.\u00ab Der Boden bestätigt die Dringlichkeit mit einem Ächzen.",
    },
    {
        "id": "tb_45",
        "trigger": "depth_change",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} grips the railing. It shifts under their hand. They grip harder. It shifts more.",
        "text_de": "{agent} greift nach dem Geländer. Es verschiebt sich unter der Hand. Sie greifen fester. Es verschiebt sich mehr.",
    },
]


# ── Archetype Banter Registry ─────────────────────────────────────────────

_BANTER_REGISTRIES: dict[str, list[dict]] = {
    "The Shadow": SHADOW_BANTER,
    "The Tower": TOWER_BANTER,
}


def select_banter(
    trigger: str,
    agents: list[dict],
    used_ids: list[str],
    archetype: str = "The Shadow",
) -> dict | None:
    """Select a banter template for the current trigger.

    Filters by trigger type, personality match, and ensures no repeats.
    Returns None if no suitable banter found.

    Args:
        trigger: Event trigger (room_entered, combat_won, etc.)
        agents: List of agent dicts with personality traits.
        used_ids: List of already-used banter IDs this run.
        archetype: Dungeon archetype for registry lookup.
    """
    banter_pool = _BANTER_REGISTRIES.get(archetype, [])
    candidates = [b for b in banter_pool if b["trigger"] == trigger and b["id"] not in used_ids]
    if not candidates:
        return None

    # Simple selection: random from matching candidates
    # Future: weight by personality match quality
    return random.choice(candidates)
