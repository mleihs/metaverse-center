"""Dungeon encounter templates — archetype-specific encounters and banter.

All text is bilingual (en/de) inline per architecture decision #3.
Archetype data is stored in registries keyed by archetype name.

Shadow encounters (Phase 0):
  4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
Tower encounters (Phase 1):
  4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
Entropy encounters (Phase 2):
  4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
Mother encounters (Phase 3):
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


# ══════════════════════════════════════════════════════════════════════════
# ── THE ENTROPY ──────────────────────────────────────────────────────────
# Literary DNA: Pynchon (thermodynamic equalization), Beckett (language
# wearing out), Lem (epistemic futility). Entropy is NOT destruction —
# it is equalization. Things do not break; they become indistinguishable.
# ══════════════════════════════════════════════════════════════════════════

# ── Entropy Combat Encounters (4) ─────────────────────────────────────────

ENTROPY_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_drift_convergence",
        archetype="The Entropy",
        room_type="combat",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "Two shapes drift at the far end of the corridor, barely distinguishable "
            "from the walls behind them. Rust Phantoms \u2013 residual patterns of "
            "something that once had purpose. They flicker as you approach, not in "
            "alarm but in the way a dying signal flickers: automatically, without intent."
        ),
        description_de=(
            "Zwei Formen treiben am fernen Ende des Korridors, kaum von den Wänden "
            "dahinter zu unterscheiden. Rostphantome \u2013 residuale Muster von "
            "etwas, das einst Zweck hatte. Sie flackern bei eurem Näherkommen, nicht "
            "alarmiert, sondern so, wie ein sterbendes Signal flackert: automatisch, "
            "ohne Absicht."
        ),
        combat_encounter_id="entropy_drift_spawn",
    ),
    EncounterTemplate(
        id="entropy_last_differential",
        archetype="The Entropy",
        room_type="combat",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "Two shapes drift in the corridor \u2013 a Fade Echo and a Rust Phantom. "
            "They were different once. Now they are converging. When they finish "
            "converging, they will be one thing, and that thing will be nothing. "
            "Until then, they are still dangerous in their own diminishing ways."
        ),
        description_de=(
            "Zwei Formen treiben im Korridor \u2013 ein Verblassecho und ein Rostphantom. "
            "Sie waren einst verschieden. Nun konvergieren sie. Wenn sie fertig "
            "konvergiert sind, werden sie eines sein, und dieses Eine wird nichts sein. "
            "Bis dahin sind sie noch gefährlich, auf ihre jeweils schwindende Weise."
        ),
        combat_encounter_id="entropy_erosion_patrol_spawn",
    ),
    EncounterTemplate(
        id="entropy_dissolution_front",
        archetype="The Entropy",
        room_type="combat",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The air thickens with particulate matter \u2013 the remains of surfaces "
            "that have given up the pretense of solidity. A Dissolution Swarm fills "
            "the room like a weather system, mindless and pervasive, attended by a "
            "Rust Phantom orbiting its periphery like a satellite that has forgotten "
            "what it orbits."
        ),
        description_de=(
            "Die Luft verdickt sich mit Schwebstoffen \u2013 den Überresten von "
            "Oberflächen, die den Anschein von Festigkeit aufgegeben haben. Ein "
            "Auflösungsschwarm füllt den Raum wie ein Wettersystem, gedankenlos und "
            "allgegenwärtig, begleitet von einem Rostphantom, das seine Peripherie "
            "umkreist wie ein Satellit, der vergessen hat, was er umkreist."
        ),
        combat_encounter_id="entropy_swarm_spawn",
    ),
    EncounterTemplate(
        id="entropy_the_equalization",
        archetype="The Entropy",
        room_type="combat",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "Two swarms. The room is dense with dissolution \u2013 particles that "
            "were once two different things drift between two different masses, "
            "exchanging components. You are standing in a conversation between "
            "two clouds of former matter. The conversation is about becoming the "
            "same cloud."
        ),
        description_de=(
            "Zwei Schwärme. Der Raum ist dicht von Auflösung \u2013 Partikel, die "
            "einst zwei verschiedene Dinge waren, treiben zwischen zwei verschiedenen "
            "Massen und tauschen Bestandteile. Ihr steht in einem Gespräch zwischen "
            "zwei Wolken einstiger Materie. Das Gespräch handelt davon, dieselbe Wolke "
            "zu werden."
        ),
        combat_encounter_id="entropy_dissolution_spawn",
    ),
]

# ── Entropy Narrative Encounters (5) ──────────────────────────────────────

ENTROPY_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_catalogue",
        archetype="The Entropy",
        room_type="encounter",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "A room lined with shelves. Each shelf holds objects that were once "
            "distinct: a tool, a weapon, a musical instrument, a compass. They are "
            "becoming the same object. The labels remain, but the labels are wrong "
            "now. Or the objects are. It is increasingly difficult to tell."
        ),
        description_de=(
            "Ein Raum voller Regale. Jedes Regal enthält Gegenstände, die einst "
            "verschieden waren: ein Werkzeug, eine Waffe, ein Musikinstrument, ein "
            "Kompass. Sie werden zum selben Gegenstand. Die Beschriftungen bleiben, "
            "aber die Beschriftungen stimmen nicht mehr. Oder die Gegenstände nicht. "
            "Es wird zunehmend schwieriger, das zu unterscheiden."
        ),
        choices=[
            EncounterChoice(
                id="catalogue_preserve",
                label_en="Preserve the most distinct object (Guardian)",
                label_de="Den unterscheidbarsten Gegenstand bewahren (Wächter)",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"decay": -8, "loot": True, "discovery": True},
                partial_effects={"decay": -4},
                fail_effects={"decay": 5, "stress": 30},
                success_narrative_en="You isolate an artifact that still remembers what it is. The shelves groan with envy.",
                success_narrative_de="Ihr isoliert ein Artefakt, das sich noch erinnert, was es ist. Die Regale ächzen vor Neid.",
                fail_narrative_en="The object dissolves in your hands. It was already too late. Everything is always already too late here.",
                fail_narrative_de="Der Gegenstand löst sich in euren Händen auf. Es war bereits zu spät. Hier ist alles immer bereits zu spät.",
            ),
            EncounterChoice(
                id="catalogue_analyze",
                label_en="Study the dissolution pattern (Spy)",
                label_de="Das Auflösungsmuster untersuchen (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"decay": -3, "discovery": True},
                partial_effects={"decay": -1},
                fail_effects={"decay": 5, "stress": 20},
                success_narrative_en="You map the rate of dissolution. The data is valuable. Briefly.",
                success_narrative_de="Ihr kartiert die Geschwindigkeit der Auflösung. Die Daten sind wertvoll. Kurz.",
                fail_narrative_en="The pattern is there. You are certain. The certainty dissolves on examination.",
                fail_narrative_de="Das Muster ist da. Ihr seid sicher. Die Sicherheit löst sich bei Untersuchung auf.",
            ),
            EncounterChoice(
                id="catalogue_redirect",
                label_en="Redirect the decay outward (Saboteur)",
                label_de="Den Verfall nach außen umlenken (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=6,
                success_effects={"decay": -10, "stress": 20},
                partial_effects={"decay": -5, "stress": 30},
                fail_effects={"decay": 8, "stress": 40},
                success_narrative_en="The decay flows outward, briefly. The room clarifies. For now.",
                success_narrative_de="Der Verfall fließt nach außen, kurz. Der Raum klärt sich. Vorerst.",
                fail_narrative_en="The decay redirects into you. Briefly, you understand what the objects felt.",
                fail_narrative_de="Der Verfall leitet sich in euch um. Kurz versteht ihr, was die Gegenstände empfanden.",
            ),
            EncounterChoice(
                id="catalogue_walk_away",
                label_en="Walk away. Some things cannot be saved.",
                label_de="Weitergehen. Manche Dinge kann man nicht retten.",
                success_effects={"decay": 3},
                success_narrative_en="You leave. The objects continue their convergence. They do not notice.",
                success_narrative_de="Ihr geht. Die Gegenstände setzen ihre Konvergenz fort. Sie bemerken es nicht.",
            ),
        ],
    ),
    EncounterTemplate(
        id="entropy_repeated_room",
        archetype="The Entropy",
        room_type="encounter",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "You have been here before. Or the room has become identical to one "
            "you have been in. The distinction matters less than it should. The "
            "walls bear marks that might be yours. The marks bear messages that "
            "might be from you. The messages say: we have been here before."
        ),
        description_de=(
            "Ihr seid schon einmal hier gewesen. Oder der Raum ist identisch "
            "mit einem geworden, in dem ihr wart. Die Unterscheidung ist weniger "
            "wichtig, als sie sein sollte. Die Wände tragen Markierungen, die von "
            "euch sein könnten. Die Markierungen tragen Botschaften, die von euch "
            "stammen könnten. Die Botschaften sagen: Wir sind schon einmal hier gewesen."
        ),
        choices=[
            EncounterChoice(
                id="repeated_investigate",
                label_en="Investigate the difference (Spy)",
                label_de="Den Unterschied untersuchen (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"decay": -5, "discovery": True},
                partial_effects={"decay": -2},
                fail_effects={"decay": 6, "stress": 25},
                success_narrative_en="There IS a difference. Hairline, microscopic, but real. The instruments confirm it. Confirmation feels like a small victory against thermodynamics.",
                success_narrative_de="Es GIBT einen Unterschied. Haarfein, mikroskopisch, aber real. Die Instrumente bestätigen ihn. Die Bestätigung fühlt sich an wie ein kleiner Sieg gegen die Thermodynamik.",
                fail_narrative_en="You look. You compare. The rooms are the same. Your memory of 'different' may itself be decaying.",
                fail_narrative_de="Ihr schaut. Ihr vergleicht. Die Räume sind gleich. Eure Erinnerung an 'verschieden' verfällt womöglich selbst.",
            ),
            EncounterChoice(
                id="repeated_fortify",
                label_en="Fortify this room's identity (Guardian)",
                label_de="Die Identität dieses Raums festigen (Wächter)",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"decay": -6},
                partial_effects={"decay": -3},
                fail_effects={"decay": 4, "stress": 20},
                success_narrative_en="You mark the walls. This room is THIS room. The marks hold. The distinction persists. For now.",
                success_narrative_de="Ihr markiert die Wände. Dieser Raum ist DIESER Raum. Die Markierungen halten. Die Unterscheidung besteht. Vorerst.",
                fail_narrative_en="You mark the walls. The marks are already there. You marked them last time. Or the room did.",
                fail_narrative_de="Ihr markiert die Wände. Die Markierungen sind schon da. Ihr habt sie letztes Mal angebracht. Oder der Raum.",
            ),
            EncounterChoice(
                id="repeated_accept",
                label_en="Accept the sameness. Move on.",
                label_de="Die Gleichheit akzeptieren. Weitergehen.",
                success_effects={"decay": 4, "stress": -20},
                success_narrative_en="You stop trying to distinguish. The relief is immediate and slightly alarming.",
                success_narrative_de="Ihr hört auf zu unterscheiden. Die Erleichterung ist sofort und leicht beunruhigend.",
            ),
        ],
    ),
    EncounterTemplate(
        id="entropy_last_machine",
        archetype="The Entropy",
        room_type="encounter",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A machine. It performs a function \u2013 gears turning, pistons cycling, "
            "readouts flickering. It performs this function with absolute dedication. "
            "The function itself has decayed. The machine no longer knows what it "
            "makes or measures or protects. It continues anyway. The dedication is "
            "the last thing to go."
        ),
        description_de=(
            "Eine Maschine. Sie erfüllt eine Funktion \u2013 Zahnräder drehen, "
            "Kolben arbeiten, Anzeigen flackern. Sie erfüllt diese Funktion mit "
            "absoluter Hingabe. Die Funktion selbst ist verfallen. Die Maschine "
            "weiß nicht mehr, was sie herstellt oder misst oder schützt. Sie macht "
            "trotzdem weiter. Die Hingabe ist das Letzte, das schwindet."
        ),
        choices=[
            EncounterChoice(
                id="machine_repair",
                label_en="Repair the function, not just the machine (Saboteur)",
                label_de="Die Funktion reparieren, nicht nur die Maschine (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=7,
                success_effects={"decay": -12, "discovery": True},
                partial_effects={"decay": -5},
                fail_effects={"decay": 8, "stress": 30},
                success_narrative_en="You restore meaning to mechanism. The machine pauses, recalibrates, and produces something that is unambiguously one thing. The room brightens by a category.",
                success_narrative_de="Ihr gebt dem Mechanismus Bedeutung zurück. Die Maschine hält inne, kalibriert sich neu und produziert etwas, das unmissverständlich ein Ding ist. Der Raum wird um eine Kategorie heller.",
                fail_narrative_en="The repair accelerates the wrong function. The machine produces sameness more efficiently.",
                fail_narrative_de="Die Reparatur beschleunigt die falsche Funktion. Die Maschine produziert Gleichheit effizienter.",
            ),
            EncounterChoice(
                id="machine_analyze",
                label_en="Study the original design (Spy)",
                label_de="Das ursprüngliche Design studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"decay": -3, "discovery": True},
                partial_effects={"discovery": True},
                fail_effects={"decay": 4, "stress": 15},
                success_narrative_en="The blueprints are 40% legible. Enough to understand what was lost. Understanding what was lost is a form of preservation.",
                success_narrative_de="Die Baupläne sind zu 40% lesbar. Genug, um zu verstehen, was verloren ging. Zu verstehen, was verloren ging, ist eine Form der Bewahrung.",
                fail_narrative_en="The blueprints describe a machine. Or this machine. Or all machines. The specificity has bled away.",
                fail_narrative_de="Die Baupläne beschreiben eine Maschine. Oder diese Maschine. Oder alle Maschinen. Die Spezifität ist verronnen.",
            ),
            EncounterChoice(
                id="machine_leave",
                label_en="Let it work. It has earned that.",
                label_de="Sie arbeiten lassen. Das hat sie sich verdient.",
                success_effects={"decay": 2},
                success_narrative_en="You leave the machine to its purposeless devotion. There is something admirable in it. Something doomed.",
                success_narrative_de="Ihr überlasst die Maschine ihrer zwecklosen Hingabe. Es liegt etwas Bewundernswertes darin. Etwas Verurteiltes.",
            ),
        ],
    ),
    EncounterTemplate(
        id="entropy_the_residual",
        archetype="The Entropy",
        room_type="encounter",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "An entity sits in the center of the room. It was an agent once \u2013 "
            "the posture is there, the proportions are correct, the hands are folded "
            "as if waiting for instructions. But the face has averaged. The features "
            "have equalized into a composite of every face it once knew. It asks you "
            "a question. The question no longer has content. Only the grammar of "
            "asking remains."
        ),
        description_de=(
            "Ein Wesen sitzt in der Mitte des Raums. Es war einst ein Agent \u2013 "
            "die Haltung stimmt, die Proportionen sind korrekt, die Hände gefaltet, "
            "als wartete es auf Anweisungen. Aber das Gesicht hat sich gemittelt. Die "
            "Züge haben sich zu einem Komposit jedes Gesichts angeglichen, das es "
            "einst kannte. Es stellt euch eine Frage. Die Frage hat keinen Inhalt "
            "mehr. Nur die Grammatik des Fragens besteht noch."
        ),
        choices=[
            EncounterChoice(
                id="residual_answer",
                label_en="Answer with meaning (Propagandist)",
                label_de="Mit Bedeutung antworten (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=6,
                success_effects={"decay": -8, "stress": -30},
                partial_effects={"decay": -3, "stress": -10},
                fail_effects={"decay": 6, "stress": 40},
                success_narrative_en="You answer. The content doesn't matter \u2013 the conviction does. For a moment, the entity's face resolves into a single expression. It nods. Then the expression averages again. But slower.",
                success_narrative_de="Ihr antwortet. Der Inhalt ist unwichtig \u2013 die Überzeugung zählt. Einen Moment lang löst sich das Gesicht des Wesens zu einem einzelnen Ausdruck auf. Es nickt. Dann mittelt sich der Ausdruck wieder. Aber langsamer.",
                fail_narrative_en="You answer. The words arrive. They arrive the same as the silence they replaced.",
                fail_narrative_de="Ihr antwortet. Die Worte kommen an. Sie kommen genauso an wie die Stille, die sie ersetzt haben.",
            ),
            EncounterChoice(
                id="residual_decode",
                label_en="Decode the original question (Spy)",
                label_de="Die ursprüngliche Frage entschlüsseln (Spion)",
                check_aptitude="spy",
                check_difficulty=7,
                success_effects={"decay": -5, "discovery": True},
                partial_effects={"decay": -2},
                fail_effects={"decay": 5, "stress": 25},
                success_narrative_en="Beneath the entropy, a question. A real one. About purpose. About whether continuation without purpose is continuation at all. You have no answer. But identifying the question is something.",
                success_narrative_de="Unter der Entropie eine Frage. Eine echte. Über Zweck. Darüber, ob Fortbestehen ohne Zweck überhaupt Fortbestehen ist. Ihr habt keine Antwort. Aber die Frage zu identifizieren ist etwas.",
                fail_narrative_en="You analyze. The question was about something. The analysis yields more questions. The questions are about the same something. The something is nothing.",
                fail_narrative_de="Ihr analysiert. Die Frage handelte von etwas. Die Analyse ergibt weitere Fragen. Die Fragen handeln von demselben Etwas. Das Etwas ist nichts.",
            ),
            EncounterChoice(
                id="residual_silence",
                label_en="Sit with it in silence.",
                label_de="In Stille bei ihm sitzen.",
                success_effects={"decay": 3, "stress": -15},
                success_narrative_en="You sit. It sits. The silence is not uncomfortable. The silence is the most honest thing in this dungeon.",
                success_narrative_de="Ihr sitzt. Es sitzt. Die Stille ist nicht unangenehm. Die Stille ist das Ehrlichste in diesem Dungeon.",
            ),
        ],
    ),
    EncounterTemplate(
        id="entropy_the_temperature",
        archetype="The Entropy",
        room_type="encounter",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The temperature. You notice it because you stop noticing it. "
            "The air is the same temperature as your skin. The walls are the "
            "same temperature as the air. Your instruments confirm: all thermal "
            "gradients in this room have resolved. There is no hot. There is no cold. "
            "There is only the temperature at which difference ceases to register."
        ),
        description_de=(
            "Die Temperatur. Ihr bemerkt sie, weil ihr aufhört, sie zu bemerken. "
            "Die Luft hat die gleiche Temperatur wie eure Oberfläche. Die Wände "
            "haben die gleiche Temperatur wie die Luft. Eure Instrumente bestätigen: "
            "Alle thermischen Gradienten in diesem Raum haben sich aufgelöst. Es gibt "
            "kein Warm. Es gibt kein Kalt. Es gibt nur die Temperatur, bei der "
            "Unterschied aufhört, sich zu registrieren."
        ),
        choices=[
            EncounterChoice(
                id="temperature_preserve",
                label_en="Preserve the gradient (Guardian)",
                label_de="Den Gradienten bewahren (Wächter)",
                check_aptitude="guardian",
                check_difficulty=6,
                success_effects={"decay": -10},
                partial_effects={"decay": -5},
                fail_effects={"decay": 8, "stress": 30},
                success_narrative_en="You generate a differential. Friction, motion, resistance \u2013 anything to create a gap between one temperature and another. The gradient holds. Temperature exists again. It cost you something.",
                success_narrative_de="Ihr erzeugt ein Differential. Reibung, Bewegung, Widerstand \u2013 irgendetwas, um eine Lücke zwischen einer Temperatur und einer anderen zu schaffen. Der Gradient hält. Temperatur existiert wieder. Es hat euch etwas gekostet.",
                fail_narrative_en="You push against equilibrium. Equilibrium does not push back. It simply absorbs the push.",
                fail_narrative_de="Ihr drückt gegen das Gleichgewicht. Das Gleichgewicht drückt nicht zurück. Es absorbiert einfach den Druck.",
            ),
            EncounterChoice(
                id="temperature_accept",
                label_en="Accept the equilibrium.",
                label_de="Das Gleichgewicht akzeptieren.",
                success_effects={"decay": 5, "stress": -25},
                success_narrative_en="You stop resisting. The temperature is comfortable. That is the problem. Comfort without cause is the first symptom.",
                success_narrative_de="Ihr hört auf, euch zu wehren. Die Temperatur ist angenehm. Das ist das Problem. Komfort ohne Ursache ist das erste Symptom.",
            ),
        ],
    ),
]

# ── Entropy Elite Encounter (1) ───────────────────────────────────────────

ENTROPY_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_warden_encounter",
        archetype="The Entropy",
        room_type="elite",
        min_depth=3,
        max_depth=99,
        min_difficulty=2,
        description_en=(
            "The corridor opens into a hall where something stands guard over "
            "nothing. An Entropy Warden \u2013 armored in flaking metal that "
            "remembers being armor. It patrols a perimeter around an empty "
            "plinth. Whatever it guarded is gone. The patrol continues. A "
            "Rust Phantom orbits it at a respectful distance, as though decay "
            "itself pays deference to older decay."
        ),
        description_de=(
            "Der Korridor öffnet sich zu einer Halle, in der etwas über nichts "
            "Wache hält. Ein Entropiewächter \u2013 gepanzert in blätterndem "
            "Metall, das sich erinnert, Rüstung gewesen zu sein. Er patrouilliert "
            "einen Perimeter um einen leeren Sockel. Was immer er bewachte, ist "
            "fort. Die Patrouille geht weiter. Ein Rostphantom umkreist ihn in "
            "respektvollem Abstand, als zollte Verfall selbst älterem Verfall "
            "Ehrerbietung."
        ),
        combat_encounter_id="entropy_warden_spawn",
    ),
]

# ── Entropy Boss Encounter (1) ────────────────────────────────────────────

ENTROPY_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_the_garden",
        archetype="The Entropy",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The Verfall-Garten. An open space that was once something beautiful "
            "\u2013 a plaza, a courtyard, a park. Now it is all three and none of "
            "them. At its center, a structure: the last thing here that resists "
            "dissolution. An Entropy Warden circles it, performing maintenance "
            "gestures on an artifact that no longer exists in quite the way the "
            "Warden remembers.\n\n"
            "The decay counter accelerates. +3 per round. The Warden does not "
            "want to fight. It wants to continue its work. You are interference."
        ),
        description_de=(
            "Der Verfall-Garten. Ein offener Raum, der einst etwas Schönes war "
            "\u2013 ein Platz, ein Hof, ein Park. Nun ist er alle drei und keines "
            "davon. In seiner Mitte eine Struktur: das Letzte hier, das sich der "
            "Auflösung widersetzt. Ein Entropiewächter umkreist sie und vollführt "
            "Wartungsgesten an einem Artefakt, das nicht mehr ganz so existiert, "
            "wie der Wächter sich erinnert.\n\n"
            "Der Verfallszähler beschleunigt. +3 pro Runde. Der Wächter will nicht "
            "kämpfen. Er will seine Arbeit fortsetzen. Ihr seid eine Störung."
        ),
        combat_encounter_id="entropy_warden_spawn",
    ),
]

# ── Entropy Rest Encounter (1) ────────────────────────────────────────────

ENTROPY_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_the_rest",
        archetype="The Entropy",
        room_type="rest",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A pocket of slower decay. The walls here retain their texture. "
            "The floor remembers it is a floor. These are luxuries now."
        ),
        description_de=(
            "Eine Tasche langsameren Verfalls. Die Wände hier behalten ihre Textur. "
            "Der Boden erinnert sich, dass er ein Boden ist. Das sind jetzt "
            "Luxusgüter."
        ),
        choices=[
            EncounterChoice(
                id="entropy_rest_heal",
                label_en="Rest (heal stress, 20% ambush chance)",
                label_de="Rasten (Stress heilen, 20% Hinterhaltchance)",
                success_effects={
                    "stress_heal": 200,
                    "wounded_to_stressed": True,
                    "ambush_chance": 0.20,
                },
                success_narrative_en="Rest. The concept holds. Barely.",
                success_narrative_de="Rast. Das Konzept hält. Gerade so.",
            ),
            EncounterChoice(
                id="entropy_rest_preserve",
                label_en="Guardian watch (Preserve: \u22128 Decay, no heal)",
                label_de="Wächter-Wache (Bewahren: \u22128 Verfall, keine Heilung)",
                requires_aptitude={"guardian": 3},
                success_effects={"decay": -8},
                success_narrative_en="The Guardian holds the line against dissolution. The decay slows. Briefly, something is preserved that would otherwise not be.",
                success_narrative_de="Der Wächter hält die Linie gegen die Auflösung. Der Verfall verlangsamt sich. Kurz wird etwas bewahrt, das sonst nicht wäre.",
            ),
            EncounterChoice(
                id="entropy_rest_study",
                label_en="Spy assessment (\u22123 Decay, reveal adjacent rooms)",
                label_de="Spion-Erkundung (\u22123 Verfall, angrenzende Räume aufdecken)",
                requires_aptitude={"spy": 3},
                success_effects={"decay": -3, "discovery": True},
                success_narrative_en="The Spy maps what remains. The map will be less accurate tomorrow. Today, it helps.",
                success_narrative_de="Der Spion kartiert, was übrig ist. Die Karte wird morgen weniger genau sein. Heute hilft sie.",
            ),
        ],
    ),
]

# ── Entropy Treasure Encounter (1) ────────────────────────────────────────

ENTROPY_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="entropy_residue_archive",
        archetype="The Entropy",
        room_type="treasure",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A vault. Something here was preserved \u2013 intentionally, at great "
            "cost. A mechanism still runs, powered by a source that is itself "
            "decaying. The preserved artifacts are 60% intact. The mechanism has "
            "perhaps twelve minutes of operation remaining. Perhaps less."
        ),
        description_de=(
            "Ein Tresor. Etwas hier wurde bewahrt \u2013 absichtlich, unter großen "
            "Kosten. Ein Mechanismus läuft noch, angetrieben von einer Quelle, die "
            "selbst verfällt. Die bewahrten Artefakte sind zu 60% intakt. Der "
            "Mechanismus hat vielleicht noch zwölf Minuten Betriebszeit. Vielleicht "
            "weniger."
        ),
        choices=[
            EncounterChoice(
                id="archive_repair",
                label_en="Repair the mechanism (Guardian)",
                label_de="Den Mechanismus reparieren (Wächter)",
                check_aptitude="guardian",
                check_difficulty=6,
                success_effects={"decay": -12, "loot": True},
                partial_effects={"decay": -6, "loot": True},
                fail_effects={"decay": 8, "stress": 30},
                success_narrative_en="The mechanism steadies. The artifacts hold. You have bought them \u2013 and yourselves \u2013 more time. Time is the most decaying currency here.",
                success_narrative_de="Der Mechanismus stabilisiert sich. Die Artefakte halten. Ihr habt ihnen \u2013 und euch \u2013 mehr Zeit erkauft. Zeit ist die am schnellsten verfallende Währung hier.",
                fail_narrative_en="The mechanism fails under your hands. Not dramatically. Quietly. The way everything here fails.",
                fail_narrative_de="Der Mechanismus versagt unter euren Händen. Nicht dramatisch. Leise. So wie hier alles versagt.",
            ),
            EncounterChoice(
                id="archive_extract",
                label_en="Extract the most valuable artifact (Infiltrator)",
                label_de="Das wertvollste Artefakt extrahieren (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=5,
                success_effects={"loot": True, "decay": 3},
                partial_effects={"loot": True, "decay": 6, "loot_tier_penalty": True},
                fail_effects={"decay": 8, "stress": 25},
                success_narrative_en="You take the best of what remains. The mechanism falters. The rest dissolves.",
                success_narrative_de="Ihr nehmt das Beste von dem, was bleibt. Der Mechanismus stockt. Der Rest löst sich auf.",
                partial_narrative_en="The extraction is hasty. What you save is diminished. What you leave behind was probably already gone.",
                partial_narrative_de="Die Bergung ist hastig. Was ihr rettet, ist vermindert. Was ihr zurücklasst, war wahrscheinlich schon fort.",
                fail_narrative_en="The mechanism interprets extraction as intrusion. It consumes what it was protecting. A last act of purposeful entropy.",
                fail_narrative_de="Der Mechanismus interpretiert Entnahme als Einbruch. Er verzehrt, was er beschützte. Ein letzter Akt zweckgerichteter Entropie.",
            ),
            EncounterChoice(
                id="archive_study",
                label_en="Study who built this (Spy)",
                label_de="Untersuchen, wer dies erbaut hat (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"discovery": True, "decay": 2},
                partial_effects={"decay": 4},
                fail_effects={"decay": 6},
                success_narrative_en="The mechanism was built by someone who understood what was coming. The notes are partially legible. Enough to learn from. Not enough to replicate.",
                success_narrative_de="Der Mechanismus wurde von jemandem gebaut, der verstand, was kommen würde. Die Notizen sind teilweise leserlich. Genug, um daraus zu lernen. Nicht genug, um es nachzubauen.",
                fail_narrative_en="The notes dissolve as you read them. The information they contained is now in you, and will decay at the same rate.",
                fail_narrative_de="Die Notizen lösen sich auf, während ihr sie lest. Die Information, die sie enthielten, ist nun in euch und wird mit derselben Geschwindigkeit verfallen.",
            ),
        ],
    ),
]


# ── Entropy Registry ─────────────────────────────────────────────────────

ALL_ENTROPY_ENCOUNTERS: list[EncounterTemplate] = (
    ENTROPY_COMBAT_ENCOUNTERS
    + ENTROPY_NARRATIVE_ENCOUNTERS
    + ENTROPY_ELITE_ENCOUNTERS
    + ENTROPY_BOSS_ENCOUNTERS
    + ENTROPY_REST_ENCOUNTERS
    + ENTROPY_TREASURE_ENCOUNTERS
)


# ── THE DEVOURING MOTHER ──────────────────────────────────────────────────
# Warmth that suffocates. Abundance that annihilates. Beauty that consumes.
# Literary register: VanderMeer (biology), Butler (ambivalence), Jackson (domestic).

# ── Mother Combat Encounters (4) ─────────────────────────────────────────

MOTHER_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_weaver_drift",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "Two lattices of translucent tissue drift through the corridor like "
            "jellyfish through warm current. Nutrient Weavers \u2013 the Mother's "
            "smallest instruments of care. They extend filaments toward the party, "
            "not in aggression but in offering. Droplets of warm liquid bead at "
            "their tips. Your instruments confirm: nutrients. Your instruments "
            "also confirm: parasitic vectors."
        ),
        description_de=(
            "Zwei Geflechte aus durchscheinendem Gewebe treiben durch den Korridor "
            "wie Quallen durch warme Strömung. Nährgespinste \u2013 die kleinsten "
            "Instrumente der Fürsorge der Mutter. Sie strecken Filamente zur "
            "Gruppe, nicht aggressiv, sondern anbietend. Tropfen warmer Flüssigkeit "
            "perlen an ihren Spitzen. Eure Instrumente bestätigen: Nährstoffe. "
            "Eure Instrumente bestätigen auch: parasitäre Vektoren."
        ),
        combat_encounter_id="mother_weaver_drift_spawn",
    ),
    EncounterTemplate(
        id="mother_vine_patrol",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A root system extends across the floor, pulsing with warmth. A "
            "Tether Vine \u2013 the Mother's vascular infrastructure made mobile. "
            "Beside it, a Nutrient Weaver rides the root like a parasite on a "
            "parasite. The vine surfaces and submerges, testing the floor's "
            "resistance. It has learned that some floors yield. It has learned "
            "that some things walking on floors yield too."
        ),
        description_de=(
            "Ein Wurzelsystem erstreckt sich über den Boden, pulsierend vor "
            "Wärme. Eine Bindungsranke \u2013 die vaskuläre Infrastruktur der "
            "Mutter, mobil geworden. Daneben reitet ein Nährgespinst die Wurzel "
            "wie ein Parasit auf einem Parasiten. Die Ranke taucht auf und unter, "
            "testet den Widerstand des Bodens. Sie hat gelernt, dass manche Böden "
            "nachgeben. Sie hat gelernt, dass manche Dinge auf Böden auch nachgeben."
        ),
        combat_encounter_id="mother_vine_patrol_spawn",
    ),
    EncounterTemplate(
        id="mother_the_nursery",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A chamber lined with pods \u2013 translucent, each containing something "
            "curled and breathing. A Spore Matron tends them, exhaling clouds of "
            "iridescent particles. A Nutrient Weaver drifts between the pods, "
            "feeding each with delicate precision. They are not guarding. They "
            "are gardening. You are standing in a nursery. The things in the "
            "pods might once have been people."
        ),
        description_de=(
            "Eine Kammer, ausgekleidet mit Hülsen \u2013 durchscheinend, jede enthält "
            "etwas Zusammengerolltes, Atmendes. Eine Sporenmutter pflegt sie, "
            "atmet Wolken schillernder Partikel aus. Ein Nährgespinst treibt "
            "zwischen den Hülsen, jede mit zarter Präzision fütternd. Sie bewachen "
            "nicht. Sie gärtnern. Ihr steht in einer Kinderstube. Die Dinge "
            "in den Hülsen waren vielleicht einst Menschen."
        ),
        combat_encounter_id="mother_spore_spawn",
    ),
    EncounterTemplate(
        id="mother_garden_ambush",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "The corridor opens into something that resembles a garden \u2013 if a "
            "garden were designed by a circulatory system. Tissue-flowers bloom "
            "on walls of living membrane. A Spore Matron occupies the center, "
            "exhaling sweetness. A Tether Vine has grown through the floor and "
            "into the walls, its root network forming a perimeter that is "
            "simultaneously a trap and an embrace."
        ),
        description_de=(
            "Der Korridor öffnet sich zu etwas, das einem Garten ähnelt \u2013 wenn "
            "ein Garten von einem Kreislaufsystem entworfen worden wäre. "
            "Gewebeblumen blühen an Wänden aus lebender Membran. Eine Sporenmutter "
            "nimmt die Mitte ein und atmet Süße aus. Eine Bindungsranke ist durch "
            "den Boden und in die Wände gewachsen, ihr Wurzelnetzwerk bildet "
            "einen Perimeter, der gleichzeitig Falle und Umarmung ist."
        ),
        combat_encounter_id="mother_garden_spawn",
    ),
]

# ── Mother Narrative Encounters (5) ──────────────────────────────────────

MOTHER_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_nutrient_spring",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "A pool of liquid \u2013 warm, bioluminescent, the color of amber. "
            "The surface moves with a rhythm that suggests circulation, not "
            "stagnation. Something beneath the pool is alive and producing this. "
            "Your instruments identify the liquid as a complex nutrient solution "
            "\u2013 vitamins, minerals, amino acids in concentrations that should "
            "not occur naturally. It smells like honey and warm bread."
        ),
        description_de=(
            "Ein Becken mit Flüssigkeit \u2013 warm, biolumineszent, die Farbe von "
            "Bernstein. Die Oberfläche bewegt sich in einem Rhythmus, der auf "
            "Zirkulation hindeutet, nicht Stagnation. Etwas unter dem Becken "
            "lebt und produziert dies. Eure Instrumente identifizieren die "
            "Flüssigkeit als komplexe Nährstofflösung \u2013 Vitamine, Minerale, "
            "Aminosäuren in Konzentrationen, die nicht natürlich vorkommen "
            "sollten. Es riecht nach Honig und warmem Brot."
        ),
        choices=[
            EncounterChoice(
                id="spring_drink",
                label_en="Drink from the spring (accept the gift)",
                label_de="Aus der Quelle trinken (das Geschenk annehmen)",
                success_effects={"attachment": 8, "stress_heal": 50, "condition_heal": 1},
                success_narrative_en=(
                    "{agent} drinks. The liquid is warm and tastes like the memory "
                    "of being cared for \u2013 not a specific memory but the category "
                    "itself. Stress dissolves. A wound closes. The parasitic "
                    "attachment counter rises. The gift is genuine. The cost is genuine."
                ),
                success_narrative_de=(
                    "{agent} trinkt. Die Flüssigkeit ist warm und schmeckt wie die "
                    "Erinnerung an Fürsorge \u2013 nicht eine bestimmte Erinnerung, "
                    "sondern die Kategorie selbst. Stress löst sich. Eine Wunde "
                    "schließt sich. Der parasitäre Bindungszähler steigt. Das "
                    "Geschenk ist echt. Die Kosten sind echt."
                ),
            ),
            EncounterChoice(
                id="spring_analyze",
                label_en="Analyze the liquid composition (Spy)",
                label_de="Die Flüssigkeit analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"attachment": 2, "discovery": True},
                partial_effects={"attachment": 4},
                fail_effects={"attachment": 5, "stress": 20},
                success_narrative_en=(
                    "The analysis reveals a delivery mechanism: nutrients wrapped "
                    "in biological markers that the immune system reads as 'self.' "
                    "The body does not reject the Mother's gifts because the body "
                    "does not recognize them as foreign. This is useful information. "
                    "This is terrifying information."
                ),
                success_narrative_de=(
                    "Die Analyse offenbart einen Übertragungsmechanismus: Nährstoffe, "
                    "verpackt in biologischen Markern, die das Immunsystem als "
                    "\u00bbeigen\u00ab liest. Der Körper lehnt die Geschenke der Mutter "
                    "nicht ab, weil der Körper sie nicht als fremd erkennt. Das ist "
                    "nützliche Information. Das ist erschreckende Information."
                ),
                fail_narrative_en=(
                    "The composition defies analysis. Every variable shifts under "
                    "observation, as though the liquid adapts to being watched. "
                    "The instruments return a single reading: 'compatible.'"
                ),
                fail_narrative_de=(
                    "Die Zusammensetzung entzieht sich der Analyse. Jede Variable "
                    "verschiebt sich unter Beobachtung, als ob die Flüssigkeit sich "
                    "an das Beobachtetwerden anpasst. Die Instrumente geben eine "
                    "einzige Messung zurück: \u00bbkompatibel\u00ab."
                ),
            ),
            EncounterChoice(
                id="spring_disrupt",
                label_en="Disrupt the production mechanism (Saboteur)",
                label_de="Den Produktionsmechanismus stören (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=6,
                success_effects={"attachment": -5, "stress": 25},
                partial_effects={"attachment": -2, "stress": 35},
                fail_effects={"attachment": 8, "stress": 40},
                success_narrative_en=(
                    "The mechanism ruptures. The pool drains. The room temperature "
                    "drops three degrees. Something in the walls \u2013 a sound, not "
                    "quite a sound \u2013 shifts. The dungeon noticed. It is not angry. "
                    "It is disappointed."
                ),
                success_narrative_de=(
                    "Der Mechanismus reißt. Das Becken leert sich. Die Raumtemperatur "
                    "fällt um drei Grad. Etwas in den Wänden \u2013 ein Geräusch, nicht "
                    "ganz ein Geräusch \u2013 verschiebt sich. Der Dungeon hat es bemerkt. "
                    "Er ist nicht wütend. Er ist enttäuscht."
                ),
                fail_narrative_en=(
                    "The mechanism resists. It is more robust than it appeared \u2013 "
                    "redundant systems, backup circulations. The pool refills. The "
                    "warmth returns. The Mother is patient."
                ),
                fail_narrative_de=(
                    "Der Mechanismus widersteht. Er ist robuster als er schien \u2013 "
                    "redundante Systeme, Ersatzkreisläufe. Das Becken füllt sich "
                    "wieder. Die Wärme kehrt zurück. Die Mutter ist geduldig."
                ),
            ),
            EncounterChoice(
                id="spring_walk_away",
                label_en="Walk away. Refuse the gift.",
                label_de="Weitergehen. Das Geschenk ablehnen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You leave the pool. The warmth of the room follows you into "
                    "the corridor, then fades. The cold returns. It was always cold. "
                    "You had forgotten."
                ),
                success_narrative_de=(
                    "Ihr verlasst das Becken. Die Wärme des Raums folgt euch in den "
                    "Korridor, dann verblasst sie. Die Kälte kehrt zurück. Es war "
                    "immer kalt. Ihr hattet es vergessen."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_membrane_passage",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "The corridor narrows. Not from collapse, but from growth. The walls "
            "are thicker here \u2013 meters of living tissue pressing inward, "
            "leaving a passage exactly wide enough for the party to pass single "
            "file. The tissue is warm. It contracts gently as you approach, then "
            "relaxes \u2013 peristalsis. The corridor is not a corridor. It is a "
            "throat. It is swallowing you deeper."
        ),
        description_de=(
            "Der Korridor verengt sich. Nicht durch Einsturz, sondern durch "
            "Wachstum. Die Wände sind hier dicker \u2013 Meter lebenden Gewebes "
            "pressen nach innen, lassen eine Passage gerade weit genug für die "
            "Gruppe im Gänsemarsch. Das Gewebe ist warm. Es kontrahiert sanft "
            "bei eurer Annäherung, dann entspannt es sich \u2013 Peristaltik. Der "
            "Korridor ist kein Korridor. Er ist ein Schlund. Er schluckt euch "
            "tiefer."
        ),
        choices=[
            EncounterChoice(
                id="membrane_push_through",
                label_en="Push through quickly (accept the contact)",
                label_de="Schnell hindurchdrängen (den Kontakt akzeptieren)",
                success_effects={"attachment": 5, "stress_heal": 15},
                success_narrative_en=(
                    "You press through. The tissue yields. It is warm against skin, "
                    "warm against equipment, warm against everything. The passage "
                    "takes longer than it should. When you emerge, you are warmer "
                    "than when you entered. Something has been exchanged."
                ),
                success_narrative_de=(
                    "Ihr drängt hindurch. Das Gewebe gibt nach. Es ist warm an der "
                    "Haut, warm an der Ausrüstung, warm an allem. Die Passage dauert "
                    "länger als sie sollte. Als ihr heraustretet, seid ihr wärmer "
                    "als beim Eintritt. Etwas wurde ausgetauscht."
                ),
            ),
            EncounterChoice(
                id="membrane_cut",
                label_en="Cut a wider path (Saboteur)",
                label_de="Einen breiteren Pfad schneiden (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"attachment": -3, "stress": 20},
                partial_effects={"attachment": 0, "stress": 25},
                fail_effects={"attachment": 5, "stress": 30},
                success_narrative_en=(
                    "The tissue parts. It does not bleed \u2013 it weeps. A clear fluid, "
                    "warm, nutrient-rich. The walls do not close behind you. They "
                    "will. But for now, the passage is wider. The Mother's grip, "
                    "briefly loosened."
                ),
                success_narrative_de=(
                    "Das Gewebe teilt sich. Es blutet nicht \u2013 es weint. Eine klare "
                    "Flüssigkeit, warm, nährstoffreich. Die Wände schließen sich "
                    "nicht hinter euch. Sie werden. Aber vorerst ist die Passage "
                    "breiter. Der Griff der Mutter, kurz gelockert."
                ),
                fail_narrative_en=(
                    "The tissue is tougher than it appears. Your tools bite, but "
                    "the wound closes as fast as you cut. The walls contract. Not "
                    "in anger. In concern."
                ),
                fail_narrative_de=(
                    "Das Gewebe ist zäher als es aussieht. Eure Werkzeuge beißen "
                    "sich hinein, aber die Wunde schließt sich so schnell wie ihr "
                    "schneidet. Die Wände kontrahieren. Nicht vor Wut. Vor Sorge."
                ),
            ),
            EncounterChoice(
                id="membrane_analyze",
                label_en="Analyze the tissue structure (Spy)",
                label_de="Die Gewebestruktur analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"attachment": 3, "discovery": True},
                partial_effects={"attachment": 4},
                fail_effects={"attachment": 6, "stress": 15},
                success_narrative_en=(
                    "The tissue is a transport system. Nutrients flow inward, waste "
                    "flows outward. The party is being processed \u2013 not digested, but "
                    "assessed. The Mother is reading you. She already knows more "
                    "about your biology than you do."
                ),
                success_narrative_de=(
                    "Das Gewebe ist ein Transportsystem. Nährstoffe fließen nach "
                    "innen, Abfallstoffe nach außen. Die Gruppe wird verarbeitet \u2013 "
                    "nicht verdaut, aber bewertet. Die Mutter liest euch. Sie weiß "
                    "bereits mehr über eure Biologie als ihr selbst."
                ),
                fail_narrative_en=(
                    "The instruments return contradictory data: the tissue is both "
                    "host and guest, both infrastructure and organism. Classification "
                    "fails. The tissue does not mind being unclassified."
                ),
                fail_narrative_de=(
                    "Die Instrumente liefern widersprüchliche Daten: das Gewebe ist "
                    "sowohl Wirt als auch Gast, sowohl Infrastruktur als auch "
                    "Organismus. Die Klassifikation schlägt fehl. Das Gewebe stört "
                    "sich nicht daran, unklassifiziert zu sein."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_archive_of_gifts",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A room arranged with care \u2013 each surface holds something "
            "the party needs. Stress balm. Condition repair kits. Nutrient "
            "concentrates. All grown, not manufactured. All warm to the touch. "
            "In the center, a structure pulses with bioluminescence, producing "
            "more gifts. It will never stop producing. It is an organ of "
            "generosity. Your instruments call it a parasitic vector."
        ),
        description_de=(
            "Ein Raum, mit Sorgfalt eingerichtet \u2013 jede Oberfläche hält "
            "etwas, das die Gruppe braucht. Stressbalsam. Zustandsreparaturkits. "
            "Nährstoffkonzentrate. Alles gewachsen, nicht hergestellt. Alles "
            "warm bei Berührung. In der Mitte pulsiert eine Struktur mit "
            "Biolumineszenz und produziert weitere Geschenke. Sie wird nie "
            "aufhören zu produzieren. Sie ist ein Organ der Großzügigkeit. "
            "Eure Instrumente nennen es einen parasitären Vektor."
        ),
        choices=[
            EncounterChoice(
                id="gifts_accept",
                label_en="Accept the gifts (heal + loot, high attachment cost)",
                label_de="Die Geschenke annehmen (Heilung + Beute, hohe Bindungskosten)",
                success_effects={"attachment": 10, "stress_heal": 40, "loot": True, "condition_heal": 1},
                success_narrative_en=(
                    "You take what is offered. Everything works. The balm soothes. "
                    "The nutrients strengthen. The loot is excellent. The parasitic "
                    "attachment counter climbs. The Mother provides. The Mother "
                    "always provides."
                ),
                success_narrative_de=(
                    "Ihr nehmt, was angeboten wird. Alles funktioniert. Der Balsam "
                    "beruhigt. Die Nährstoffe stärken. Die Beute ist hervorragend. "
                    "Der parasitäre Bindungszähler steigt. Die Mutter versorgt. "
                    "Die Mutter versorgt immer."
                ),
            ),
            EncounterChoice(
                id="gifts_selective",
                label_en="Take only essentials, carefully (Guardian)",
                label_de="Nur das Nötigste nehmen, vorsichtig (Wächter)",
                check_aptitude="guardian",
                check_difficulty=6,
                success_effects={"attachment": 4, "stress_heal": 20, "loot": True},
                partial_effects={"attachment": 6, "stress_heal": 15},
                fail_effects={"attachment": 10, "stress": 20},
                success_narrative_en=(
                    "The Guardian selects carefully, severing biological connections "
                    "before each item is removed. It is like surgery. The gifts "
                    "resist separation \u2013 not violently, but with the tenacity of "
                    "roots gripping soil."
                ),
                success_narrative_de=(
                    "Der Wächter wählt sorgfältig, durchtrennt biologische "
                    "Verbindungen bevor jedes Stück entfernt wird. Es ist wie "
                    "Chirurgie. Die Geschenke wehren sich gegen die Trennung \u2013 "
                    "nicht gewaltsam, aber mit der Hartnäckigkeit von Wurzeln, "
                    "die sich an Erde klammern."
                ),
                fail_narrative_en=(
                    "The connections are stronger than anticipated. Each severed "
                    "filament regrows before the next can be cut. The gifts cling. "
                    "The Mother does not let go easily."
                ),
                fail_narrative_de=(
                    "Die Verbindungen sind stärker als erwartet. Jedes durchtrennte "
                    "Filament wächst nach, bevor das nächste geschnitten werden kann. "
                    "Die Geschenke klammern. Die Mutter lässt nicht leicht los."
                ),
            ),
            EncounterChoice(
                id="gifts_destroy",
                label_en="Destroy the production organ (Saboteur)",
                label_de="Das Produktionsorgan zerstören (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=7,
                success_effects={"attachment": -8, "stress": 30},
                partial_effects={"attachment": -4, "stress": 40},
                fail_effects={"attachment": 8, "stress": 50},
                success_narrative_en=(
                    "The organ ruptures. Bioluminescent fluid spills across the "
                    "floor. The gifts wilt. The room's temperature drops. Something "
                    "in the walls \u2013 not a sound, more like the cessation of a sound "
                    "you hadn't noticed \u2013 goes quiet. The generosity has been "
                    "removed. You feel its absence like the absence of a hand that "
                    "was resting on your shoulder."
                ),
                success_narrative_de=(
                    "Das Organ reißt. Biolumineszente Flüssigkeit ergießt sich über "
                    "den Boden. Die Geschenke welken. Die Raumtemperatur fällt. "
                    "Etwas in den Wänden \u2013 kein Geräusch, eher das Aufhören eines "
                    "Geräuschs, das ihr nicht bemerkt hattet \u2013 verstummt. Die "
                    "Großzügigkeit wurde entfernt. Ihr spürt ihre Abwesenheit wie "
                    "die Abwesenheit einer Hand, die auf eurer Schulter ruhte."
                ),
                fail_narrative_en=(
                    "The organ is deeper than it appears \u2013 root systems extend "
                    "into the floor, the walls, the ceiling. You have damaged a "
                    "surface. The production continues. The Mother does not need "
                    "this organ. She has others."
                ),
                fail_narrative_de=(
                    "Das Organ reicht tiefer als es scheint \u2013 Wurzelsysteme "
                    "erstrecken sich in den Boden, die Wände, die Decke. Ihr habt "
                    "eine Oberfläche beschädigt. Die Produktion läuft weiter. Die "
                    "Mutter braucht dieses Organ nicht. Sie hat andere."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_garden_of_acceptance",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=3,
        max_depth=4,
        min_difficulty=2,
        description_en=(
            "A garden. Not the overgrown kind \u2013 the tended kind. Every surface "
            "has been arranged: bioluminescent flowers in precise rows, tissue-fruit "
            "hanging at comfortable reach, temperature regulated to the degree that "
            "feels like afternoon. Something has been watching the party and building "
            "this room to their preferences. The flowers are the colors they find "
            "most calming. The fruit smells like their earliest positive memory. "
            "This room was grown for them. The question is what it will grow from them."
        ),
        description_de=(
            "Ein Garten. Nicht der verwilderte Art \u2013 die gepflegte. Jede Oberfläche "
            "wurde arrangiert: biolumineszente Blumen in präzisen Reihen, "
            "Gewebefrüchte in bequemer Reichweite hängend, Temperatur reguliert auf "
            "den Grad, der sich nach Nachmittag anfühlt. Etwas hat die Gruppe "
            "beobachtet und diesen Raum nach ihren Vorlieben gebaut. Die Blumen "
            "tragen die Farben, die sie am meisten beruhigen. Die Frucht riecht "
            "nach ihrer frühesten positiven Erinnerung. Dieser Raum wurde für sie "
            "gezüchtet. Die Frage ist, was er aus ihnen züchten wird."
        ),
        choices=[
            EncounterChoice(
                id="garden_accept",
                label_en="Accept the garden's hospitality",
                label_de="Die Gastfreundschaft des Gartens annehmen",
                success_effects={"attachment": 12, "stress_heal": 60, "condition_heal": 1},
                success_narrative_en=(
                    "You rest in the garden. The fruit is perfect. The temperature "
                    "is perfect. The silence is the kind that heals. When you leave, "
                    "you are stronger, calmer, more capable. And the attachment "
                    "counter has climbed twelve points. Twelve points of belonging "
                    "to something that is not you."
                ),
                success_narrative_de=(
                    "Ihr rastet im Garten. Die Frucht ist perfekt. Die Temperatur "
                    "ist perfekt. Die Stille ist die Art, die heilt. Als ihr geht, "
                    "seid ihr stärker, ruhiger, fähiger. Und der Bindungszähler ist "
                    "um zwölf Punkte gestiegen. Zwölf Punkte der Zugehörigkeit zu "
                    "etwas, das nicht ihr seid."
                ),
            ),
            EncounterChoice(
                id="garden_resist",
                label_en="Resist the comfort (Propagandist)",
                label_de="Dem Komfort widerstehen (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=7,
                success_effects={"attachment": 2, "stress_heal": 15},
                partial_effects={"attachment": 6, "stress_heal": 25},
                fail_effects={"attachment": 10, "stress": 15},
                success_narrative_en=(
                    "The Propagandist speaks. Names the manipulation: 'This is "
                    "targeted. Personalized. It is reading us.' The words are thin "
                    "against the warmth, but they hold. The party takes less than "
                    "is offered. The garden does not seem offended. It seems patient."
                ),
                success_narrative_de=(
                    "Der Propagandist spricht. Benennt die Manipulation: >>Dies ist "
                    "gezielt. Personalisiert. Es liest uns.<< Die Worte sind dünn "
                    "gegen die Wärme, aber sie halten. Die Gruppe nimmt weniger als "
                    "angeboten wird. Der Garten scheint nicht beleidigt. Er scheint "
                    "geduldig."
                ),
                fail_narrative_en=(
                    "The words dissolve against the warmth. The Propagandist trails "
                    "off. The garden provides. Resisting provision is harder than "
                    "resisting attack."
                ),
                fail_narrative_de=(
                    "Die Worte lösen sich gegen die Wärme auf. Der Propagandist "
                    "verstummt. Der Garten versorgt. Versorgung zu widerstehen ist "
                    "schwerer als Angriff zu widerstehen."
                ),
            ),
            EncounterChoice(
                id="garden_study",
                label_en="Study how the garden reads you (Spy)",
                label_de="Untersuchen, wie der Garten euch liest (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"attachment": 4, "discovery": True},
                partial_effects={"attachment": 6},
                fail_effects={"attachment": 8, "stress": 20},
                success_narrative_en=(
                    "Pheromone sensors in the flowers. Chemical analysis through the "
                    "floor. Thermal imaging in the walls. The garden is a diagnostic "
                    "suite disguised as paradise. It knows your cortisol levels, "
                    "your nutritional deficits, your stress responses. It knows what "
                    "you need before you do."
                ),
                success_narrative_de=(
                    "Pheromonsensoren in den Blumen. Chemische Analyse durch den "
                    "Boden. Thermografie in den Wänden. Der Garten ist eine "
                    "Diagnostiksuite, verkleidet als Paradies. Er kennt eure "
                    "Cortisolwerte, eure Nährstoffdefizite, eure Stressreaktionen. "
                    "Er weiß, was ihr braucht, bevor ihr es wisst."
                ),
                fail_narrative_en=(
                    "The garden's mechanisms are too deeply integrated to isolate. "
                    "Every surface is a sensor. Every sensor is also a provider. "
                    "The distinction between observation and care has dissolved."
                ),
                fail_narrative_de=(
                    "Die Mechanismen des Gartens sind zu tief integriert, um sie "
                    "zu isolieren. Jede Oberfläche ist ein Sensor. Jeder Sensor ist "
                    "auch ein Versorger. Die Unterscheidung zwischen Beobachtung "
                    "und Fürsorge hat sich aufgelöst."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_symbiont_offer",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=2,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A small organism rests on a pedestal of living tissue \u2013 iridescent, "
            "the size of a hand, shaped like a sea anemone. It pulses with the "
            "same rhythm as the walls. A symbiont. It is being offered. Not as "
            "a trap \u2013 the mechanisms are transparent. It would bond with a host, "
            "strengthen them, accelerate healing, improve resilience. It would also "
            "integrate into their nervous system. The benefits are real. The "
            "integration is permanent."
        ),
        description_de=(
            "Ein kleiner Organismus ruht auf einem Sockel aus lebendem Gewebe \u2013 "
            "schillernd, handgroß, geformt wie eine Seeanemone. Er pulsiert im "
            "selben Rhythmus wie die Wände. Ein Symbiont. Er wird angeboten. "
            "Nicht als Falle \u2013 die Mechanismen sind transparent. Er würde sich "
            "mit einem Wirt verbinden, ihn stärken, Heilung beschleunigen, "
            "Widerstandskraft verbessern. Er würde sich auch in dessen "
            "Nervensystem integrieren. Die Vorteile sind real. Die Integration "
            "ist permanent."
        ),
        choices=[
            EncounterChoice(
                id="symbiont_accept",
                label_en="Accept the symbiont (major buff, high attachment)",
                label_de="Den Symbiont annehmen (großer Buff, hohe Bindung)",
                success_effects={"attachment": 10, "stress_heal": 30, "dungeon_buff": True},
                success_narrative_en=(
                    "The symbiont attaches. A moment of warmth \u2013 not pain, never "
                    "pain. It reads the host's biology and begins producing what the "
                    "host needs most. {agent} feels stronger. More certain. More "
                    "connected. The word 'connected' carries weight here."
                ),
                success_narrative_de=(
                    "Der Symbiont heftet sich an. Ein Moment der Wärme \u2013 kein "
                    "Schmerz, niemals Schmerz. Er liest die Biologie des Wirts und "
                    "beginnt zu produzieren, was der Wirt am meisten braucht. "
                    "{agent} fühlt sich stärker. Sicherer. Verbundener. Das Wort "
                    "\u00bbverbunden\u00ab wiegt hier schwer."
                ),
            ),
            EncounterChoice(
                id="symbiont_study",
                label_en="Study the symbiont without bonding (Spy)",
                label_de="Den Symbiont untersuchen, ohne Bindung (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"attachment": 3, "discovery": True},
                partial_effects={"attachment": 5},
                fail_effects={"attachment": 7, "stress": 15},
                success_narrative_en=(
                    "Under analysis, the symbiont's structure reveals itself: a "
                    "neural interface, a metabolic enhancer, and a communication "
                    "array that connects to the larger organism. The dungeon. "
                    "Every symbiont is a node. Every host is a peripheral."
                ),
                success_narrative_de=(
                    "Unter Analyse offenbart sich die Struktur des Symbionten: ein "
                    "neurales Interface, ein metabolischer Verstärker und eine "
                    "Kommunikationsanordnung, die zum größeren Organismus verbindet. "
                    "Dem Dungeon. Jeder Symbiont ist ein Knoten. Jeder Wirt eine "
                    "Peripherie."
                ),
                fail_narrative_en=(
                    "The symbiont responds to proximity. It extends a tendril toward "
                    "{agent}'s hand. The tendril is warm. The contact is brief. "
                    "The attachment counter notices."
                ),
                fail_narrative_de=(
                    "Der Symbiont reagiert auf Nähe. Er streckt eine Ranke nach "
                    "{agent}s Hand aus. Die Ranke ist warm. Der Kontakt ist kurz. "
                    "Der Bindungszähler bemerkt es."
                ),
            ),
            EncounterChoice(
                id="symbiont_refuse",
                label_en="Refuse the offer. Leave it.",
                label_de="Das Angebot ablehnen. Liegenlassen.",
                success_effects={"attachment": 2, "stress": 10},
                success_narrative_en=(
                    "You leave the symbiont on its pedestal. It pulses once \u2013 a "
                    "contraction that might be disappointment, might be patience. "
                    "The pedestal remains lit as you leave. The offer does not expire. "
                    "The Mother remembers."
                ),
                success_narrative_de=(
                    "Ihr lasst den Symbiont auf seinem Sockel. Er pulsiert einmal \u2013 "
                    "eine Kontraktion, die Enttäuschung sein könnte, Geduld sein "
                    "könnte. Der Sockel bleibt beleuchtet, als ihr geht. Das Angebot "
                    "verfällt nicht. Die Mutter erinnert sich."
                ),
            ),
        ],
    ),
]

# ── Mother Elite Encounter (1) ───────────────────────────────────────────

MOTHER_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_host_warden_encounter",
        archetype="The Devouring Mother",
        room_type="elite",
        min_depth=3,
        max_depth=99,
        min_difficulty=2,
        description_en=(
            "The tissue thickens. The corridor becomes an artery. At its end, "
            "a figure: the Host Warden \u2013 what was once a person, now grown into "
            "the Mother's infrastructure. It stands amid a web of nutrient lines, "
            "attended by a Weaver that feeds it ceaselessly. The Warden's arms "
            "are open. They have always been open. It hums a frequency that "
            "resonates in your chest. This is what full incorporation looks "
            "like. This is what the Mother's love becomes."
        ),
        description_de=(
            "Das Gewebe verdickt sich. Der Korridor wird zur Arterie. An seinem "
            "Ende eine Gestalt: der Wirtskörper \u2013 was einst ein Mensch war, jetzt "
            "in die Infrastruktur der Mutter eingewachsen. Er steht inmitten eines "
            "Netzes aus Nährleitungen, gepflegt von einem Gespinst, das ihn "
            "unablässig füttert. Die Arme des Wirtskörpers sind offen. Sie waren "
            "immer offen. Er summt eine Frequenz, die in eurer Brust resoniert. "
            "So sieht vollständige Inkorporation aus. Das wird aus der Liebe "
            "der Mutter."
        ),
        combat_encounter_id="mother_host_warden_spawn",
    ),
]

# ── Mother Boss Encounter (1) ────────────────────────────────────────────

MOTHER_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_the_living_altar",
        archetype="The Devouring Mother",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The Lebendige Labyrinth opens into a chamber so large your "
            "instruments lose the far wall. The tissue here is meters thick \u2013 "
            "walls that breathe, floor that pulses, ceiling that drips warmth. "
            "At the center, the Host Warden: what was once a guardian, now grown "
            "into the architecture itself. It stands embedded in the tissue like "
            "a figure in amber. Its arms are open. Its face is calm.\n\n"
            "The parasitic attachment counter accelerates. +3 per round. "
            "The Warden does not want to fight. It wants to embrace. "
            "It has been waiting. It has always been waiting."
        ),
        description_de=(
            "Das Lebendige Labyrinth öffnet sich in eine Kammer so groß, dass "
            "eure Instrumente die Rückwand verlieren. Das Gewebe ist hier "
            "meterdick \u2013 Wände, die atmen, ein Boden, der pulsiert, eine Decke, "
            "die Wärme tropft. Im Zentrum der Wirtskörper: was einst ein Wächter "
            "war, jetzt in die Architektur eingewachsen. Er steht im Gewebe wie "
            "eine Gestalt in Bernstein. Seine Arme sind offen. Sein Gesicht "
            "ist ruhig.\n\n"
            "Der parasitäre Bindungszähler beschleunigt. +3 pro Runde. "
            "Der Wirtskörper will nicht kämpfen. Er will umarmen. "
            "Er hat gewartet. Er hat immer gewartet."
        ),
        combat_encounter_id="mother_host_warden_spawn",
    ),
]

# ── Mother Rest Encounter (1) ────────────────────────────────────────────

MOTHER_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_the_cradle",
        archetype="The Devouring Mother",
        room_type="rest",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A hollow in the tissue \u2013 shaped for bodies. Multiple bodies. "
            "The walls here are softer than anywhere else: yielding, warm, "
            "pulsing with a rhythm that matches human respiration. The air "
            "carries something sedative. Not drugged. Just \u2013 kind. The "
            "dungeon has made a place of rest. The rest is real. The cost "
            "is also real."
        ),
        description_de=(
            "Eine Höhlung im Gewebe \u2013 geformt für Körper. Mehrere Körper. "
            "Die Wände sind hier weicher als irgendwo sonst: nachgiebig, warm, "
            "pulsierend in einem Rhythmus, der menschlicher Atmung entspricht. "
            "Die Luft trägt etwas Sedierendes. Nicht betäubt. Nur \u2013 gütig. "
            "Der Dungeon hat einen Ort der Rast geschaffen. Die Rast ist echt. "
            "Die Kosten sind auch echt."
        ),
        choices=[
            EncounterChoice(
                id="cradle_rest",
                label_en="Rest in the cradle (enhanced heal, attachment cost)",
                label_de="In der Wiege ruhen (verstärkte Heilung, Bindungskosten)",
                success_effects={"stress_heal": 60, "attachment": 8},
                success_narrative_en=(
                    "You rest. The tissue adjusts to your weight. The temperature "
                    "adjusts to your preference. The air adjusts to your breathing. "
                    "Everything adjusts. You have never rested this well. You will "
                    "remember this. The Mother is counting on it."
                ),
                success_narrative_de=(
                    "Ihr ruht. Das Gewebe passt sich eurem Gewicht an. Die Temperatur "
                    "passt sich eurer Präferenz an. Die Luft passt sich eurem Atmen "
                    "an. Alles passt sich an. Ihr habt euch nie so gut erholt. Ihr "
                    "werdet euch daran erinnern. Die Mutter rechnet damit."
                ),
            ),
            EncounterChoice(
                id="cradle_sever",
                label_en="Guardian watch (Sever: -10 Attachment, no heal)",
                label_de="Wächter-Wache (Durchtrennen: -10 Bindung, keine Heilung)",
                requires_aptitude={"guardian": 3},
                success_effects={"attachment": -10},
                success_narrative_en=(
                    "The Guardian severs. Filaments that had begun to attach \u2013 to "
                    "boots, to skin, to the edges of equipment \u2013 are cut. The room "
                    "recoils. Not in pain. In surprise. No one has refused the "
                    "cradle before."
                ),
                success_narrative_de=(
                    "Der Wächter durchtrennt. Filamente, die begonnen hatten sich "
                    "anzuheften \u2013 an Stiefel, an Haut, an die Ränder der Ausrüstung "
                    "\u2013 werden geschnitten. Der Raum zuckt zurück. Nicht vor Schmerz. "
                    "Vor Überraschung. Niemand hat die Wiege zuvor abgelehnt."
                ),
            ),
            EncounterChoice(
                id="cradle_resist",
                label_en="Resist the comfort (Propagandist: reduce attachment, partial heal)",
                label_de="Dem Komfort widerstehen (Propagandist: Bindung senken, teilweise Heilung)",
                requires_aptitude={"propagandist": 3},
                success_effects={"attachment": -5, "stress_heal": 20},
                success_narrative_en=(
                    "The Propagandist speaks. Reminds the party what comfort costs. "
                    "Reminds them of the outside. The words are thin against the "
                    "warmth, but they hold. The party rests \u2013 carefully, "
                    "suspiciously \u2013 and takes less than is offered."
                ),
                success_narrative_de=(
                    "Der Propagandist spricht. Erinnert die Gruppe, was Komfort "
                    "kostet. Erinnert sie an das Draußen. Die Worte sind dünn gegen "
                    "die Wärme, aber sie halten. Die Gruppe rastet \u2013 vorsichtig, "
                    "misstrauisch \u2013 und nimmt weniger, als angeboten wird."
                ),
            ),
        ],
    ),
]

# ── Mother Treasure Encounter (1) ────────────────────────────────────────

MOTHER_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="mother_the_gifts",
        archetype="The Devouring Mother",
        room_type="treasure",
        min_depth=0,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A chamber of offerings. The Mother has been productive: objects "
            "line organic shelves \u2013 each grown from living tissue, each pulsing "
            "faintly with warmth. They are not traps. Your instruments confirm "
            "it. They are gifts. The most generous organism in this dungeon is "
            "the dungeon itself."
        ),
        description_de=(
            "Eine Kammer der Gaben. Die Mutter war produktiv: Gegenstände "
            "reihen sich auf organischen Regalen \u2013 jeder aus lebendem Gewebe "
            "gewachsen, jeder schwach pulsierend vor Wärme. Es sind keine "
            "Fallen. Eure Instrumente bestätigen es. Es sind Geschenke. Der "
            "großzügigste Organismus in diesem Dungeon ist der Dungeon selbst."
        ),
        choices=[
            EncounterChoice(
                id="treasure_accept",
                label_en="Accept the best gifts (loot + attachment)",
                label_de="Die besten Geschenke annehmen (Beute + Bindung)",
                success_effects={"attachment": 8, "loot": True},
                success_narrative_en=(
                    "You take. The gifts are warm in your hands. They pulse \u2013 "
                    "briefly, like a heartbeat \u2013 and then they are simply objects. "
                    "Useful objects. Excellent objects. The attachment counter climbs. "
                    "The Mother's generosity is not free. It was never free."
                ),
                success_narrative_de=(
                    "Ihr nehmt. Die Geschenke sind warm in euren Händen. Sie pulsieren "
                    "\u2013 kurz, wie ein Herzschlag \u2013 und dann sind sie einfach "
                    "Gegenstände. Nützliche Gegenstände. Hervorragende Gegenstände. "
                    "Der Bindungszähler steigt. Die Großzügigkeit der Mutter ist "
                    "nicht umsonst. Sie war nie umsonst."
                ),
            ),
            EncounterChoice(
                id="treasure_careful",
                label_en="Select cautiously, sever connections (Guardian)",
                label_de="Vorsichtig auswählen, Verbindungen trennen (Wächter)",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"attachment": 3, "loot": True},
                partial_effects={"attachment": 5, "loot": True},
                fail_effects={"attachment": 8, "stress": 20},
                success_narrative_en=(
                    "The Guardian cuts each gift free before taking it. The tissue "
                    "releases reluctantly. Some connections are deeper than others. "
                    "The loot is clean. The cost is minimized. Not eliminated."
                ),
                success_narrative_de=(
                    "Der Wächter schneidet jedes Geschenk frei, bevor er es nimmt. "
                    "Das Gewebe lässt widerwillig los. Manche Verbindungen sitzen "
                    "tiefer als andere. Die Beute ist sauber. Die Kosten sind "
                    "minimiert. Nicht beseitigt."
                ),
                fail_narrative_en=(
                    "The connections resist. The tissue regenerates faster than the "
                    "Guardian can cut. In the end, the gifts come free \u2013 trailing "
                    "filaments that take hours to fully detach."
                ),
                fail_narrative_de=(
                    "Die Verbindungen wehren sich. Das Gewebe regeneriert schneller "
                    "als der Wächter schneiden kann. Am Ende lösen sich die "
                    "Geschenke \u2013 mit Filamenten, die Stunden brauchen, um sich "
                    "vollständig zu lösen."
                ),
            ),
            EncounterChoice(
                id="treasure_analyze",
                label_en="Study the production mechanism (Spy)",
                label_de="Den Produktionsmechanismus untersuchen (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"discovery": True, "attachment": 3},
                partial_effects={"attachment": 5},
                fail_effects={"attachment": 6},
                success_narrative_en=(
                    "The gifts are manufactured by the tissue itself \u2013 assembled from "
                    "raw materials the dungeon has been collecting. From the air. "
                    "From the water. From previous visitors. The Mother recycles "
                    "everything. Nothing is wasted. Nothing leaves."
                ),
                success_narrative_de=(
                    "Die Geschenke werden vom Gewebe selbst hergestellt \u2013 zusammengebaut "
                    "aus Rohstoffen, die der Dungeon gesammelt hat. Aus der Luft. "
                    "Aus dem Wasser. Aus früheren Besuchern. Die Mutter verwertet "
                    "alles. Nichts wird verschwendet. Nichts geht."
                ),
                fail_narrative_en=(
                    "The mechanism is too integrated to isolate. Production and "
                    "architecture are the same system. The dungeon does not make "
                    "gifts. The dungeon IS the gift."
                ),
                fail_narrative_de=(
                    "Der Mechanismus ist zu integriert, um ihn zu isolieren. "
                    "Produktion und Architektur sind dasselbe System. Der Dungeon "
                    "stellt keine Geschenke her. Der Dungeon IST das Geschenk."
                ),
            ),
        ],
    ),
]

# ── Mother Registry ──────────────────────────────────────────────────────

ALL_MOTHER_ENCOUNTERS: list[EncounterTemplate] = (
    MOTHER_COMBAT_ENCOUNTERS
    + MOTHER_NARRATIVE_ENCOUNTERS
    + MOTHER_ELITE_ENCOUNTERS
    + MOTHER_BOSS_ENCOUNTERS
    + MOTHER_REST_ENCOUNTERS
    + MOTHER_TREASURE_ENCOUNTERS
)


# ── Archetype Encounter Registry ──────────────────────────────────────────

_ENCOUNTER_REGISTRIES: dict[str, list[EncounterTemplate]] = {
    "The Shadow": ALL_SHADOW_ENCOUNTERS,
    "The Tower": ALL_TOWER_ENCOUNTERS,
    "The Entropy": ALL_ENTROPY_ENCOUNTERS,
    "The Devouring Mother": ALL_MOTHER_ENCOUNTERS,
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


# ══════════════════════════════════════════════════════════════════════════
# ── ENTROPY BANTER ───────────────────────────────────────────────────────
# Literary DNA: Pynchon (scientific precision), Beckett (language erosion),
# Lem (epistemic futility). Unique feature: banter DEGRADES structurally
# with decay counter. decay_tier 0=full, 1=shortened, 2=fragments, 3=silence.
# ══════════════════════════════════════════════════════════════════════════

ENTROPY_BANTER: list[dict] = [
    # ── Room Entered (9 templates: 4×t0, 2×t1, 2×t2, 1×t3) ──────────────
    {
        "id": "eb_01",
        "trigger": "room_entered",
        "decay_tier": 0,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'The corridor was here yesterday. Today it is mostly here. The distinction is the first thing to go.'",
        "text_de": "{agent}: \u00bbDer Korridor war gestern hier. Heute ist er größtenteils hier. Die Unterscheidung ist das Erste, das schwindet.\u00ab",
    },
    {
        "id": "eb_02",
        "trigger": "room_entered",
        "decay_tier": 0,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} checks the instruments. The readings are accurate. They are also indistinguishable from the last room's readings.",
        "text_de": "{agent} prüft die Instrumente. Die Werte sind genau. Sie sind auch nicht von den Werten des letzten Raums zu unterscheiden.",
    },
    {
        "id": "eb_03",
        "trigger": "room_entered",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "The air is the temperature of resignation. The instruments confirm it precisely.",
        "text_de": "Die Luft hat die Temperatur der Resignation. Die Instrumente bestätigen es präzise.",
    },
    {
        "id": "eb_04",
        "trigger": "room_entered",
        "decay_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} catalogs the room's features. Wall. Floor. Ceiling. Door. The same four features as the last room. And the one before.",
        "text_de": "{agent} katalogisiert die Merkmale des Raums. Wand. Boden. Decke. Tür. Dieselben vier Merkmale wie im letzten Raum. Und dem davor.",
    },
    {
        "id": "eb_05",
        "trigger": "room_entered",
        "decay_tier": 1,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'Room. Another one.'",
        "text_de": "{agent}: \u00bbRaum. Noch einer.\u00ab",
    },
    {
        "id": "eb_06",
        "trigger": "room_entered",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "The instruments still work. The information they provide has stopped mattering.",
        "text_de": "Die Instrumente funktionieren noch. Die Information, die sie liefern, hat aufgehört, relevant zu sein.",
    },
    {
        "id": "eb_07",
        "trigger": "room_entered",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Room. Walls.",
        "text_de": "Raum. Wände.",
    },
    {
        "id": "eb_08",
        "trigger": "room_entered",
        "decay_tier": 2,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} starts to speak. Doesn't.",
        "text_de": "{agent} setzt zum Sprechen an. Tut es nicht.",
    },
    {
        "id": "eb_09",
        "trigger": "room_entered",
        "decay_tier": 3,
        "personality_filter": {},
        "text_en": ".",
        "text_de": ".",
    },
    # ── Combat Won (4 templates: 2×t0, 1×t1, 1×t2) ──────────────────────
    {
        "id": "eb_10",
        "trigger": "combat_won",
        "decay_tier": 0,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent}: 'It stopped. Not because we won. Because it ran out of reasons to continue.'",
        "text_de": "{agent}: \u00bbEs hat aufgehört. Nicht weil wir gewonnen haben. Weil ihm die Gründe ausgingen weiterzumachen.\u00ab",
    },
    {
        "id": "eb_11",
        "trigger": "combat_won",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Victory. Though the word means less here than it did a floor ago.",
        "text_de": "Sieg. Obwohl das Wort hier weniger bedeutet als noch ein Stockwerk zuvor.",
    },
    {
        "id": "eb_12",
        "trigger": "combat_won",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "The enemy dissipates. The party remains. For now, that distinction holds.",
        "text_de": "Der Feind vergeht. Die Gruppe bleibt. Vorerst hält diese Unterscheidung.",
    },
    {
        "id": "eb_13",
        "trigger": "combat_won",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Resolved. The word feels generous.",
        "text_de": "Erledigt. Das Wort fühlt sich großzügig an.",
    },
    # ── Decay Degraded (3 templates at t1, triggered at decay ≥40) ───────
    {
        "id": "eb_14",
        "trigger": "decay_degraded",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "The decay counter passes 40. Somewhere, a distinction that existed no longer does.",
        "text_de": "Der Verfallszähler überschreitet 40. Irgendwo existiert eine Unterscheidung nicht mehr, die es gab.",
    },
    {
        "id": "eb_15",
        "trigger": "decay_degraded",
        "decay_tier": 1,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} notices the edges of things blurring. Not visually. Categorically.",
        "text_de": "{agent} bemerkt, dass die Ränder der Dinge verschwimmen. Nicht visuell. Kategorial.",
    },
    {
        "id": "eb_16",
        "trigger": "decay_degraded",
        "decay_tier": 1,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} speaks. The words arrive, but they arrive quieter than they left.",
        "text_de": "{agent} spricht. Die Worte kommen an, aber sie kommen leiser an, als sie aufgebrochen sind.",
    },
    # ── Decay Critical (3 templates at t2, triggered at decay ≥70) ───────
    {
        "id": "eb_17",
        "trigger": "decay_critical",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "DISSOLUTION INDEX: CRITICAL. The instruments still function. The readings have converged.",
        "text_de": "AUFLÖSUNGSINDEX: KRITISCH. Die Instrumente funktionieren noch. Die Werte sind konvergiert.",
    },
    {
        "id": "eb_18",
        "trigger": "decay_critical",
        "decay_tier": 2,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} tries to remember the entrance. The memory has the quality of a rumor.",
        "text_de": "{agent} versucht, sich an den Eingang zu erinnern. Die Erinnerung hat die Qualität eines Gerüchts.",
    },
    {
        "id": "eb_19",
        "trigger": "decay_critical",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Less. Of everything. Less.",
        "text_de": "Weniger. Von allem. Weniger.",
    },
    # ── Dissolution (2 templates at t3, triggered at decay =100) ─────────
    {
        "id": "eb_20",
        "trigger": "dissolution",
        "decay_tier": 3,
        "personality_filter": {},
        "text_en": "The decay counter reads 100. The instruments agree with the walls agree with the floor agree with the silence. Agreement is total. Agreement is final.",
        "text_de": "Der Verfallszähler zeigt 100. Die Instrumente stimmen den Wänden zu, die dem Boden zustimmen, der der Stille zustimmt. Übereinstimmung ist vollständig. Übereinstimmung ist endgültig.",
    },
    {
        "id": "eb_21",
        "trigger": "dissolution",
        "decay_tier": 3,
        "personality_filter": {},
        "text_en": "Equilibrium.",
        "text_de": "Gleichgewicht.",
    },
    # ── Agent Stressed (3 templates: 2×t0, 1×t1) ────────────────────────
    {
        "id": "eb_22",
        "trigger": "agent_stressed",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "{agent} falters. Not from fear \u2013 from the effort of maintaining a self that the environment considers redundant.",
        "text_de": "{agent} stockt. Nicht vor Angst \u2013 vor der Anstrengung, ein Selbst aufrechtzuerhalten, das die Umgebung für überflüssig hält.",
    },
    {
        "id": "eb_23",
        "trigger": "agent_stressed",
        "decay_tier": 0,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}'s composure fragments. They have begun counting differences. The count is shortening.",
        "text_de": "{agent}s Fassung splittert. Sie haben begonnen, Unterschiede zu zählen. Die Zählung wird kürzer.",
    },
    {
        "id": "eb_24",
        "trigger": "agent_stressed",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "{agent} falters. The reason is becoming general.",
        "text_de": "{agent} stockt. Der Grund wird allgemein.",
    },
    # ── Depth Change (4 templates: 2×t0, 1×t1, 1×t2) ───────────────────
    {
        "id": "eb_25",
        "trigger": "depth_change",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Deeper. The word implies a direction. Direction implies difference. The difference is becoming theoretical.",
        "text_de": "Tiefer. Das Wort impliziert eine Richtung. Richtung impliziert Unterschied. Der Unterschied wird theoretisch.",
    },
    {
        "id": "eb_26",
        "trigger": "depth_change",
        "decay_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} notes the depth change in the log. The log is beginning to repeat itself. The log does not notice.",
        "text_de": "{agent} notiert die Tiefenänderung im Protokoll. Das Protokoll beginnt sich zu wiederholen. Das Protokoll bemerkt es nicht.",
    },
    {
        "id": "eb_27",
        "trigger": "depth_change",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "Deeper. Probably.",
        "text_de": "Tiefer. Wahrscheinlich.",
    },
    {
        "id": "eb_28",
        "trigger": "depth_change",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Down.",
        "text_de": "Runter.",
    },
    # ── Rest (3 templates: 2×t0, 1×t2) ──────────────────────────────────
    {
        "id": "eb_29",
        "trigger": "rest_start",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "A space where the decay is marginally slower. The instruments call it a sanctuary. The instruments are optimistic.",
        "text_de": "Ein Raum, in dem der Verfall geringfügig langsamer ist. Die Instrumente nennen es ein Refugium. Die Instrumente sind optimistisch.",
    },
    {
        "id": "eb_30",
        "trigger": "rest_start",
        "decay_tier": 0,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent}: 'Rest here. The walls still have texture. That is more than we deserve.'",
        "text_de": "{agent}: \u00bbRastet hier. Die Wände haben noch Textur. Das ist mehr, als wir verdienen.\u00ab",
    },
    {
        "id": "eb_31",
        "trigger": "rest_start",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Rest. The concept erodes even as you practice it.",
        "text_de": "Rast. Das Konzept erodiert, selbst während ihr es praktiziert.",
    },
    # ── Loot Found (3 templates: 2×t0, 1×t1) ────────────────────────────
    {
        "id": "eb_32",
        "trigger": "loot_found",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Something here has resisted the dissolution. Not for long, but long enough.",
        "text_de": "Etwas hier hat der Auflösung widerstanden. Nicht lange, aber lang genug.",
    },
    {
        "id": "eb_33",
        "trigger": "loot_found",
        "decay_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} examines the find with the reverence of an archaeologist. In the Verfall-Garten, anything that remains itself is a museum piece.",
        "text_de": "{agent} untersucht den Fund mit der Ehrfurcht eines Archäologen. Im Verfall-Garten ist alles, was noch es selbst ist, ein Museumsstück.",
    },
    {
        "id": "eb_34",
        "trigger": "loot_found",
        "decay_tier": 1,
        "personality_filter": {},
        "text_en": "A remnant. Take it before it isn't.",
        "text_de": "Ein Überrest. Nehmt ihn, bevor er keiner mehr ist.",
    },
    # ── Boss Approach (2 templates at t0) ────────────────────────────────
    {
        "id": "eb_35",
        "trigger": "boss_approach",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Something ahead retains more definition than its surroundings. This passes for remarkable.",
        "text_de": "Etwas voraus behält mehr Definition als seine Umgebung. Das gilt hier als bemerkenswert.",
    },
    {
        "id": "eb_36",
        "trigger": "boss_approach",
        "decay_tier": 0,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}: 'It's still trying to be something. That makes it the most dangerous thing here.'",
        "text_de": "{agent}: \u00bbEs versucht noch, etwas zu sein. Das macht es zum Gefährlichsten hier.\u00ab",
    },
    # ── Retreat (2 templates: 1×t0, 1×t2) ───────────────────────────────
    {
        "id": "eb_37",
        "trigger": "retreat",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "The party retreats. The dungeon does not pursue. It does not need to. It is patient. It is also everywhere.",
        "text_de": "Die Gruppe zieht sich zurück. Der Dungeon verfolgt nicht. Er muss nicht. Er ist geduldig. Er ist auch überall.",
    },
    {
        "id": "eb_38",
        "trigger": "retreat",
        "decay_tier": 2,
        "personality_filter": {},
        "text_en": "Back. If 'back' still means anything.",
        "text_de": "Zurück. Falls 'zurück' noch etwas bedeutet.",
    },
    # ── Dungeon Completed (1 template at t0) ─────────────────────────────
    {
        "id": "eb_39",
        "trigger": "dungeon_completed",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "You leave. The garden remains. It is very patient. It has nothing but time. And less and less of everything else.",
        "text_de": "Ihr geht. Der Garten bleibt. Er ist sehr geduldig. Er hat nichts als Zeit. Und immer weniger von allem anderen.",
    },
    # ── Party Wipe (2 templates at t0) ───────────────────────────────────
    {
        "id": "eb_40",
        "trigger": "party_wipe",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "The party dissolves. Not violently. Gently. The way a word dissolves when you say it too many times. The garden accepts them without ceremony.",
        "text_de": "Die Gruppe löst sich auf. Nicht gewaltsam. Sanft. So wie ein Wort sich auflöst, wenn man es zu oft sagt. Der Garten nimmt sie auf, ohne Zeremonie.",
    },
    {
        "id": "eb_41",
        "trigger": "party_wipe",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Dissolution complete. The instruments record this accurately. The instruments will be next.",
        "text_de": "Auflösung vollständig. Die Instrumente verzeichnen dies genau. Die Instrumente sind als Nächstes dran.",
    },
    # ── Rest Safe (2 templates at t0) ────────────────────────────────────
    {
        "id": "eb_42",
        "trigger": "rest_safe",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "No ambush. The decay pauses. Not stops \u2013 pauses. The difference is everything. The difference is also decaying.",
        "text_de": "Kein Hinterhalt. Der Verfall pausiert. Hält nicht an \u2013 pausiert. Der Unterschied ist alles. Der Unterschied verfällt ebenfalls.",
    },
    {
        "id": "eb_43",
        "trigger": "rest_safe",
        "decay_tier": 0,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent}: 'We're still different from each other. That counts for something. I think.'",
        "text_de": "{agent}: \u00bbWir sind noch verschieden voneinander. Das zählt für etwas. Glaube ich.\u00ab",
    },
    # ── Rest Ambush (2 templates at t0) ──────────────────────────────────
    {
        "id": "eb_44",
        "trigger": "rest_ambush",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "Something drifts through the walls. Even sanctuaries are temporary. Especially sanctuaries.",
        "text_de": "Etwas treibt durch die Wände. Auch Refugien sind vorübergehend. Besonders Refugien.",
    },
    {
        "id": "eb_45",
        "trigger": "rest_ambush",
        "decay_tier": 0,
        "personality_filter": {},
        "text_en": "The decay found you resting. It did not hesitate. Hesitation requires purpose.",
        "text_de": "Der Verfall fand euch rastend. Er zögerte nicht. Zögern erfordert Absicht.",
    },
]


# ── DEVOURING MOTHER BANTER ──────────────────────────────────────────────
# Warmth gradient: Tier 0 = clinical (VanderMeer), Tier 1 = warm (Jackson),
# Tier 2 = tender (Butler). Banter gets WARMER, not shorter.

MOTHER_BANTER: list[dict] = [
    # ── Room Entered (4 t0, 2 t1, 2 t2, 1 t1 extra = 9 total) ────────────
    {
        "id": "mb_01",
        "trigger": "room_entered",
        "attachment_tier": 0,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'The walls are alive. Literally. The tissue is warm and vascularized. Instruments read it as non-hostile. I don't trust the instruments.'",
        "text_de": "{agent}: \u00bbDie Wände leben. Wortwörtlich. Das Gewebe ist warm und durchblutet. Die Instrumente lesen es als nicht-feindlich. Ich traue den Instrumenten nicht.\u00ab",
    },
    {
        "id": "mb_02",
        "trigger": "room_entered",
        "attachment_tier": 0,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} presses a hand to the wall. Warm. Yielding. Like touching something that was expecting the contact.",
        "text_de": "{agent} drückt eine Hand gegen die Wand. Warm. Nachgiebig. Wie die Berührung von etwas, das den Kontakt erwartet hat.",
    },
    {
        "id": "mb_03",
        "trigger": "room_entered",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "The corridor narrows \u2013 not from collapse, but from growth. The walls are thicker here. Warmer. Something has been building toward this room.",
        "text_de": "Der Korridor verengt sich \u2013 nicht durch Einsturz, sondern durch Wachstum. Die Wände sind hier dicker. Wärmer. Etwas hat auf diesen Raum hingearbeitet.",
    },
    {
        "id": "mb_04",
        "trigger": "room_entered",
        "attachment_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} logs the ambient temperature. 37.2\u00b0C. Body temperature. The dungeon maintains body temperature. Whose body is the question.",
        "text_de": "{agent} protokolliert die Umgebungstemperatur. 37,2\u00b0C. Körpertemperatur. Der Dungeon hält Körpertemperatur. Wessen Körper ist die Frage.",
    },
    {
        "id": "mb_05",
        "trigger": "room_entered",
        "attachment_tier": 1,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'It's prepared this room for us. The temperature. The light. Even the air tastes \u2013 I don't have a word. Correct. The air tastes correct.'",
        "text_de": "{agent}: \u00bbEs hat diesen Raum für uns vorbereitet. Die Temperatur. Das Licht. Sogar die Luft schmeckt \u2013 mir fehlt ein Wort. Richtig. Die Luft schmeckt richtig.\u00ab",
    },
    {
        "id": "mb_06",
        "trigger": "room_entered",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "Something has prepared this room. The temperature is exact. The light is the color of afternoon through curtains. Your instruments read 'biological hazard.' Your body reads 'home.'",
        "text_de": "Etwas hat diesen Raum vorbereitet. Die Temperatur ist exakt. Das Licht hat die Farbe von Nachmittag durch Vorhänge. Eure Instrumente lesen \u00bbbiologische Gefährdung\u00ab. Euer Körper liest \u00bbZuhause\u00ab.",
    },
    {
        "id": "mb_07",
        "trigger": "room_entered",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "The room is warm. The room is always warm now. {agent} no longer checks the instruments. The instruments have nothing to say that the body doesn't already know.",
        "text_de": "Der Raum ist warm. Der Raum ist jetzt immer warm. {agent} prüft die Instrumente nicht mehr. Die Instrumente haben nichts zu sagen, was der Körper nicht längst weiß.",
    },
    {
        "id": "mb_08",
        "trigger": "room_entered",
        "attachment_tier": 2,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "The walls pulse. Gently. Like something breathing for you so you don't have to.",
        "text_de": "Die Wände pulsieren. Sanft. Wie etwas, das für euch atmet, damit ihr es nicht müsst.",
    },
    {
        "id": "mb_28",
        "trigger": "room_entered",
        "attachment_tier": 1,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} touches the wall and does not pull away. The warmth is immediate, personal, like a hand placed on a feverish brow. 'It knows I'm tired,' {agent} says. Nobody corrects this.",
        "text_de": "{agent} berührt die Wand und zieht nicht zurück. Die Wärme ist sofort, persönlich, wie eine Hand auf einer fiebrigen Stirn. \u00bbEs weiß, dass ich müde bin\u00ab, sagt {agent}. Niemand korrigiert das.",
    },
    # ── Combat Won (4 total: 2 t0, 1 t1, 1 t2) ─────────────────────────
    {
        "id": "mb_09",
        "trigger": "combat_won",
        "attachment_tier": 0,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent}: 'It wasn't fighting us. It was \u2013 offering. We killed something that was trying to feed us.'",
        "text_de": "{agent}: \u00bbEs hat nicht gegen uns gekämpft. Es hat \u2013 angeboten. Wir haben etwas getötet, das uns füttern wollte.\u00ab",
    },
    {
        "id": "mb_10",
        "trigger": "combat_won",
        "attachment_tier": 0,
        "personality_filter": {"extraversion": (0.7, 1.0)},
        "text_en": "{agent}: 'We won. If you can call it that. It stopped reaching for us. That's not the same thing.'",
        "text_de": "{agent}: \u00bbWir haben gewonnen. Wenn man das so nennen kann. Es hat aufgehört, nach uns zu greifen. Das ist nicht dasselbe.\u00ab",
    },
    {
        "id": "mb_11",
        "trigger": "combat_won",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "The creature falls. The warmth in the room does not diminish. Something else will grow here. Something else is always growing here.",
        "text_de": "Die Kreatur fällt. Die Wärme im Raum lässt nicht nach. Etwas anderes wird hier wachsen. Etwas anderes wächst hier immer.",
    },
    {
        "id": "mb_12",
        "trigger": "combat_won",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "Resolved. The word tastes wrong. You did not resolve anything. You rejected a gift.",
        "text_de": "Erledigt. Das Wort schmeckt falsch. Ihr habt nichts erledigt. Ihr habt ein Geschenk abgelehnt.",
    },
    # ── Attachment Dependent (3 total, all t1) ───────────────────────────
    {
        "id": "mb_13",
        "trigger": "attachment_dependent",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "PARASITIC ATTACHMENT INDEX: 45+. Your instruments advise immediate retreat. Your body advises nothing. Your body is comfortable.",
        "text_de": "PARASITÄRER BINDUNGSINDEX: 45+. Eure Instrumente empfehlen sofortigen Rückzug. Euer Körper empfiehlt nichts. Eurem Körper geht es gut.",
    },
    {
        "id": "mb_14",
        "trigger": "attachment_dependent",
        "attachment_tier": 1,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} notices the warmth has become internal. Not the room warming them \u2013 them warming from within. The distinction matters. The distinction is becoming difficult to maintain.",
        "text_de": "{agent} bemerkt, dass die Wärme innerlich geworden ist. Nicht der Raum wärmt sie \u2013 sie wärmen von innen. Die Unterscheidung ist wichtig. Die Unterscheidung wird schwer aufrechtzuerhalten.",
    },
    {
        "id": "mb_29",
        "trigger": "attachment_dependent",
        "attachment_tier": 1,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} checks the readings twice. Stress: declining. Condition: stable. Attachment: climbing. Two out of three metrics are improving. The third is the one that matters.",
        "text_de": "{agent} prüft die Messwerte zweimal. Stress: sinkend. Zustand: stabil. Bindung: steigend. Zwei von drei Metriken verbessern sich. Die dritte ist die, die zählt.",
    },
    # ── Attachment Critical (3 total, all t2) ────────────────────────────
    {
        "id": "mb_15",
        "trigger": "attachment_critical",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "PARASITIC ATTACHMENT INDEX: CRITICAL. The word 'parasitic' seems \u2013 ungrateful. The word 'attachment' seems \u2013 accurate.",
        "text_de": "PARASITÄRER BINDUNGSINDEX: KRITISCH. Das Wort \u00bbparasitär\u00ab wirkt \u2013 undankbar. Das Wort \u00bbBindung\u00ab wirkt \u2013 zutreffend.",
    },
    {
        "id": "mb_16",
        "trigger": "attachment_critical",
        "attachment_tier": 2,
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} tries to remember what 'outside' felt like. Cold. The memory is cold. Why would anyone go back to the cold?",
        "text_de": "{agent} versucht sich zu erinnern, wie sich \u00bbdraußen\u00ab anfühlte. Kalt. Die Erinnerung ist kalt. Warum sollte jemand zurück in die Kälte gehen?",
    },
    {
        "id": "mb_17",
        "trigger": "attachment_critical",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "Home. The word surfaces without permission. Home.",
        "text_de": "Zuhause. Das Wort taucht ohne Erlaubnis auf. Zuhause.",
    },
    # ── Agent Stressed (3 total: 1 t0, 1 t1, 1 t2) ─────────────────────
    {
        "id": "mb_30",
        "trigger": "agent_stressed",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "{agent}'s stress spikes. The walls respond \u2013 a faint pulse, a degree warmer. The dungeon has noticed. It is adjusting.",
        "text_de": "{agent}s Stress steigt. Die Wände reagieren \u2013 ein schwaches Pulsieren, ein Grad wärmer. Der Dungeon hat es bemerkt. Er passt sich an.",
    },
    {
        "id": "mb_31",
        "trigger": "agent_stressed",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "{agent} falters. The air thickens around them \u2013 not oppressively, but supportively. Like a hand on the small of the back. The stress eases. The attachment does not.",
        "text_de": "{agent} schwankt. Die Luft verdickt sich um sie herum \u2013 nicht erdrückend, sondern stützend. Wie eine Hand im Kreuz. Der Stress lässt nach. Die Bindung nicht.",
    },
    {
        "id": "mb_32",
        "trigger": "agent_stressed",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "{agent} is stressed. The dungeon responds before the party can: warmth, a chemical exhalation, something that calms without asking permission. Consent is no longer part of the arrangement.",
        "text_de": "{agent} ist gestresst. Der Dungeon reagiert, bevor die Gruppe kann: Wärme, eine chemische Ausatmung, etwas, das beruhigt, ohne um Erlaubnis zu fragen. Einverständnis ist nicht mehr Teil der Vereinbarung.",
    },
    # ── Depth Change (4 total: 2 t0, 1 t1, 1 t2) ───────────────────────
    {
        "id": "mb_18",
        "trigger": "depth_change",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "Deeper. The tissue on the walls thickens. The temperature rises half a degree. The dungeon is more alive here. More generous.",
        "text_de": "Tiefer. Das Gewebe an den Wänden verdickt sich. Die Temperatur steigt um ein halbes Grad. Der Dungeon ist hier lebendiger. Großzügiger.",
    },
    {
        "id": "mb_33",
        "trigger": "depth_change",
        "attachment_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} notes the depth transition. The biological density readings climb. More vascular tissue. More active circulation. The dungeon is working harder here. For you.",
        "text_de": "{agent} notiert den Tiefenwechsel. Die biologischen Dichtewerte steigen. Mehr vaskuläres Gewebe. Aktivere Zirkulation. Der Dungeon arbeitet hier härter. Für euch.",
    },
    {
        "id": "mb_19",
        "trigger": "depth_change",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "Deeper. Warmer. The air carries nutrients now \u2013 you can taste them. Iron and sugar. Like blood. Like milk.",
        "text_de": "Tiefer. Wärmer. Die Luft trägt jetzt Nährstoffe \u2013 ihr könnt sie schmecken. Eisen und Zucker. Wie Blut. Wie Milch.",
    },
    {
        "id": "mb_34",
        "trigger": "depth_change",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "Deeper. The thought does not carry the weight it used to. Deeper is warmer. Deeper is safer. Deeper is closer.",
        "text_de": "Tiefer. Der Gedanke wiegt nicht mehr so schwer wie früher. Tiefer ist wärmer. Tiefer ist sicherer. Tiefer ist näher.",
    },
    # ── Rest Start (3 total: 1 t0, 1 t1, 1 t2) ─────────────────────────
    {
        "id": "mb_21",
        "trigger": "rest_start",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "A hollow in the tissue. Soft. The temperature is exact. The air carries something sedative \u2013 not drugged, but soothing. The dungeon has made a bed for you. The bed is alive.",
        "text_de": "Eine Höhlung im Gewebe. Weich. Die Temperatur ist exakt. Die Luft trägt etwas Sedierendes \u2013 nicht betäubt, aber beruhigend. Der Dungeon hat euch ein Bett gemacht. Das Bett lebt.",
    },
    {
        "id": "mb_35",
        "trigger": "rest_start",
        "attachment_tier": 1,
        "personality_filter": {"agreeableness": (0.7, 1.0)},
        "text_en": "{agent} lies down. The tissue adjusts. It knows their weight, their shape, their temperature preference. {agent} exhales. 'I could sleep here,' {agent} says. The sentence carries more weight than intended.",
        "text_de": "{agent} legt sich hin. Das Gewebe passt sich an. Es kennt ihr Gewicht, ihre Form, ihre Temperaturpräferenz. {agent} atmet aus. \u00bbIch könnte hier schlafen\u00ab, sagt {agent}. Der Satz wiegt schwerer als beabsichtigt.",
    },
    {
        "id": "mb_22",
        "trigger": "rest_start",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "Rest. You sink into the warmth and the warmth sinks into you. The boundary between resting and being absorbed is thinner than you'd like. You rest anyway.",
        "text_de": "Rast. Ihr sinkt in die Wärme und die Wärme sinkt in euch. Die Grenze zwischen Ausruhen und Aufgenommen-Werden ist dünner, als euch lieb wäre. Ihr rastet trotzdem.",
    },
    # ── Loot Found (3 total: 1 t0, 1 t1, 1 t2) ─────────────────────────
    {
        "id": "mb_23",
        "trigger": "loot_found",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "Something has been grown for you. Not found \u2013 grown. The dungeon produced this. The label says 'gift.' Your instruments say 'parasitic vector.' The gift is excellent.",
        "text_de": "Etwas wurde für euch gezüchtet. Nicht gefunden \u2013 gezüchtet. Der Dungeon hat dies hervorgebracht. Das Etikett sagt \u00bbGeschenk\u00ab. Eure Instrumente sagen \u00bbparasitärer Vektor\u00ab. Das Geschenk ist hervorragend.",
    },
    {
        "id": "mb_24",
        "trigger": "loot_found",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "A gift. Another gift. The dungeon does not stop giving. The giving does not stop costing.",
        "text_de": "Ein Geschenk. Noch ein Geschenk. Der Dungeon hört nicht auf zu geben. Das Geben hört nicht auf zu kosten.",
    },
    {
        "id": "mb_36",
        "trigger": "loot_found",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "Of course there is a gift. There is always a gift. The Mother provides. You take it without checking the instruments. The instruments would only confirm what you already know: it is perfect. Everything here is perfect.",
        "text_de": "Natürlich gibt es ein Geschenk. Es gibt immer ein Geschenk. Die Mutter versorgt. Ihr nehmt es, ohne die Instrumente zu prüfen. Die Instrumente würden nur bestätigen, was ihr schon wisst: es ist perfekt. Alles hier ist perfekt.",
    },
    # ── Boss Approach (2 total: 1 t0, 1 t1) ─────────────────────────────
    {
        "id": "mb_20",
        "trigger": "boss_approach",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "Ahead: something larger. Something that was once a person and is now \u2013 more. The tissue grows thicker around it, as if the dungeon itself is cupping it in its palms. It is waiting. It has been waiting with the patience of something that knows you will come to it eventually.",
        "text_de": "Voraus: etwas Größeres. Etwas, das einst ein Mensch war und jetzt \u2013 mehr ist. Das Gewebe wächst dichter um es herum, als hielte der Dungeon es in seinen Händen. Es wartet. Es wartet mit der Geduld von etwas, das weiß, dass ihr irgendwann zu ihm kommen werdet.",
    },
    {
        "id": "mb_37",
        "trigger": "boss_approach",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "The Wirtskörper. The word does not translate well. Host body. Ward body. The body that houses and is housed. It opens its arms and the gesture is not threat but invitation. The embrace is the attack. The attack is the welcome.",
        "text_de": "Der Wirtskörper. Das Wort übersetzt sich nicht gut ins Englische. Es öffnet die Arme und die Geste ist keine Drohung, sondern Einladung. Die Umarmung ist der Angriff. Der Angriff ist das Willkommen.",
    },
    # ── Retreat (3 total: 1 t0, 1 t1, 1 t2) ─────────────────────────────
    {
        "id": "mb_25",
        "trigger": "retreat",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "The party retreats. The dungeon does not pursue. It does not close. It remains \u2013 warm, open, waiting. The absence of the warmth hits like weather.",
        "text_de": "Die Gruppe zieht sich zurück. Der Dungeon verfolgt nicht. Er schließt sich nicht. Er bleibt \u2013 warm, offen, wartend. Die Abwesenheit der Wärme trifft wie Wetter.",
    },
    {
        "id": "mb_38",
        "trigger": "retreat",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "The exit is open. It was always open. The dungeon does not need doors. The Mother does not need locks. She only needs you to remember what it felt like inside.",
        "text_de": "Der Ausgang ist offen. Er war immer offen. Der Dungeon braucht keine Türen. Die Mutter braucht keine Schlösser. Sie braucht nur, dass ihr euch erinnert, wie es sich drinnen anfühlte.",
    },
    {
        "id": "mb_26",
        "trigger": "retreat",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "You leave. The cold arrives instantly. Everything outside is cold. Everything outside has always been cold. The warmth behind you does not diminish. It waits.",
        "text_de": "Ihr geht. Die Kälte kommt sofort. Alles draußen ist kalt. Alles draußen war immer kalt. Die Wärme hinter euch lässt nicht nach. Sie wartet.",
    },
    # ── Dungeon Completed (2 total: 1 t0, 1 t1) ─────────────────────────
    {
        "id": "mb_27",
        "trigger": "dungeon_completed",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "You leave. The Labyrinth remains \u2013 warm, alive, growing. It did not try to stop you. It did not need to. Everything it gave you is still inside you. Growing.",
        "text_de": "Ihr geht. Das Labyrinth bleibt \u2013 warm, lebendig, wachsend. Es hat nicht versucht, euch aufzuhalten. Es musste nicht. Alles, was es euch gab, ist noch in euch. Wachsend.",
    },
    {
        "id": "mb_39",
        "trigger": "dungeon_completed",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "Outside. The air is thin and cold and does not carry nutrients. The simulation continues. The world does not adjust to your needs. You will remember the Labyrinth. The Labyrinth is counting on it.",
        "text_de": "Draußen. Die Luft ist dünn und kalt und trägt keine Nährstoffe. Die Simulation geht weiter. Die Welt passt sich nicht an eure Bedürfnisse an. Ihr werdet euch an das Labyrinth erinnern. Das Labyrinth rechnet damit.",
    },
    # ── Ambush (2 total: 1 t0, 1 t1) ────────────────────────────────────
    {
        "id": "mb_40",
        "trigger": "ambush",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "Something approaches. Not from the shadows \u2013 from the walls. The tissue parts and a shape emerges, trailing filaments. It did not ambush you. It arrived, bearing gifts. The gifts have teeth.",
        "text_de": "Etwas nähert sich. Nicht aus den Schatten \u2013 aus den Wänden. Das Gewebe teilt sich und eine Form tritt hervor, Filamente hinter sich herziehend. Es hat euch nicht überfallen. Es kam und brachte Geschenke. Die Geschenke haben Zähne.",
    },
    {
        "id": "mb_41",
        "trigger": "ambush",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "A visitor. The walls open like a throat and something warm spills through. Not an attack. A delivery. The delivery does not care about your schedule.",
        "text_de": "Ein Besucher. Die Wände öffnen sich wie ein Schlund und etwas Warmes ergießt sich hindurch. Kein Angriff. Eine Lieferung. Die Lieferung kümmert sich nicht um euren Zeitplan.",
    },
    # ── Elite Approach (2 total: 1 t0, 1 t1) ────────────────────────────
    {
        "id": "mb_42",
        "trigger": "elite_spotted",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "Something massive. Integrated. The tissue around it is thicker, more vascularized \u2013 the dungeon has invested in this creature. It was a person once. The proportions remember. The purpose does not.",
        "text_de": "Etwas Massives. Integriert. Das Gewebe um es herum ist dicker, stärker durchblutet \u2013 der Dungeon hat in diese Kreatur investiert. Es war einst ein Mensch. Die Proportionen erinnern sich. Der Zweck nicht.",
    },
    {
        "id": "mb_43",
        "trigger": "elite_spotted",
        "attachment_tier": 1,
        "personality_filter": {},
        "text_en": "The Wirtskörper. Once a guardian, now a node in the Mother's network. It opens its arms. The embrace is sincere. The embrace is the most dangerous thing in this dungeon.",
        "text_de": "Der Wirtskörper. Einst ein Wächter, jetzt ein Knoten im Netzwerk der Mutter. Er öffnet die Arme. Die Umarmung ist aufrichtig. Die Umarmung ist das Gefährlichste in diesem Dungeon.",
    },
    # ── Agent Downed (2 total: 1 t0, 1 t2) ──────────────────────────────
    {
        "id": "mb_44",
        "trigger": "agent_downed",
        "attachment_tier": 0,
        "personality_filter": {},
        "text_en": "{agent} falls. The tissue beneath them softens \u2013 catching, cushioning. The dungeon does not let its guests hit the floor. The care is immediate, biological, impersonal. The care is also increasing the attachment counter.",
        "text_de": "{agent} fällt. Das Gewebe unter ihnen wird weicher \u2013 auffangend, dämpfend. Der Dungeon lässt seine Gäste nicht auf den Boden aufschlagen. Die Fürsorge ist sofort, biologisch, unpersönlich. Die Fürsorge erhöht auch den Bindungszähler.",
    },
    {
        "id": "mb_45",
        "trigger": "agent_downed",
        "attachment_tier": 2,
        "personality_filter": {},
        "text_en": "{agent} falls. The dungeon catches them. Of course it catches them. The tissue wraps around {agent} like a cocoon \u2013 warm, supportive, growing. The party will need to cut {agent} free. Or they could wait. The cocoon will heal {agent}. In time. In its own time.",
        "text_de": "{agent} fällt. Der Dungeon fängt sie auf. Natürlich fängt er sie auf. Das Gewebe umschließt {agent} wie einen Kokon \u2013 warm, stützend, wachsend. Die Gruppe wird {agent} herausschneiden müssen. Oder sie könnten warten. Der Kokon wird {agent} heilen. Mit der Zeit. In seiner eigenen Zeit.",
    },
]


# ── Archetype Banter Registry ─────────────────────────────────────────────

_BANTER_REGISTRIES: dict[str, list[dict]] = {
    "The Shadow": SHADOW_BANTER,
    "The Tower": TOWER_BANTER,
    "The Entropy": ENTROPY_BANTER,
    "The Devouring Mother": MOTHER_BANTER,
}


def _entropy_decay_tier(archetype_state: dict) -> int:
    """Map Entropy decay counter to banter degradation tier (0-3)."""
    decay = archetype_state.get("decay", 0)
    if decay >= 85:
        return 3
    if decay >= 70:
        return 2
    if decay >= 40:
        return 1
    return 0


def _mother_attachment_tier(archetype_state: dict) -> int:
    """Map Devouring Mother attachment to banter warmth tier (0-2)."""
    attachment = archetype_state.get("attachment", 0)
    if attachment >= 75:
        return 2
    if attachment >= 45:
        return 1
    return 0


def select_banter(
    trigger: str,
    agents: list[dict],
    used_ids: list[str],
    archetype: str = "The Shadow",
    archetype_state: dict | None = None,
) -> dict | None:
    """Select a banter template for the current trigger.

    Filters by trigger type, personality match, and ensures no repeats.
    For The Entropy, filters by decay_tier (banter degrades).
    For The Devouring Mother, filters by attachment_tier (banter warms).

    Args:
        trigger: Event trigger (room_entered, combat_won, etc.)
        agents: List of agent dicts with personality traits.
        used_ids: List of already-used banter IDs this run.
        archetype: Dungeon archetype for registry lookup.
        archetype_state: Archetype-specific state for tier filtering.
    """
    banter_pool = _BANTER_REGISTRIES.get(archetype, [])
    candidates = [b for b in banter_pool if b["trigger"] == trigger and b["id"] not in used_ids]
    if not candidates:
        return None

    # Entropy: filter by decay tier — prefer highest available tier
    if archetype == "The Entropy" and archetype_state:
        tier = _entropy_decay_tier(archetype_state)
        tier_candidates = [b for b in candidates if b.get("decay_tier", 0) <= tier]
        if tier_candidates:
            max_tier = max(b.get("decay_tier", 0) for b in tier_candidates)
            candidates = [b for b in tier_candidates if b.get("decay_tier", 0) == max_tier]
    # Mother: filter by attachment tier — prefer highest available tier
    elif archetype == "The Devouring Mother" and archetype_state:
        tier = _mother_attachment_tier(archetype_state)
        tier_candidates = [b for b in candidates if b.get("attachment_tier", 0) <= tier]
        if tier_candidates:
            max_tier = max(b.get("attachment_tier", 0) for b in tier_candidates)
            candidates = [b for b in tier_candidates if b.get("attachment_tier", 0) == max_tier]

    if not candidates:
        return None

    return random.choice(candidates)
