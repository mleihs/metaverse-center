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
  6 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure
Prometheus encounters (Phase 4):
  4 combat, 5 encounter (3 workshop + 2 invention), 1 elite, 1 boss, 1 rest, 1 treasure
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
            "Eine Kammer, ausgekleidet mit Brutkokons \u2013 durchscheinend, "
            "jeder enthält etwas Zusammengerolltes, Atmendes. Eine Sporenmutter "
            "pflegt sie, atmet Wolken schillernder Partikel aus. Ein "
            "Nährgespinst treibt zwischen den Kokons, jeden mit zarter "
            "Präzision fütternd. Sie bewachen nicht. Sie gärtnern. Ihr steht "
            "in einer Kinderstube. Die Dinge in den Kokons waren vielleicht "
            "einst Menschen."
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
    EncounterTemplate(
        id="mother_spore_nursery_deep",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=3,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The nursery is larger here. Deeper. The pods line the walls in "
            "rows \u2013 dozens, perhaps hundreds, each pulsing with the slow "
            "rhythm of gestation. A Spore Matron moves between them, trailing "
            "clouds of luminous spores. A Nutrient Weaver tends the nearest "
            "pods, feeding them with the patience of something that has never "
            "known urgency. The nursery does not need to hurry. The nursery "
            "has all the time in the world. It is growing the world."
        ),
        description_de=(
            "Die Kinderstube ist hier größer. Tiefer. Brutkokons säumen die "
            "Wände in Reihen \u2013 Dutzende, vielleicht Hunderte, jeder "
            "pulsierend im geduldigen Rhythmus der Reifung. Eine Sporenmutter "
            "bewegt sich zwischen ihnen, hinterlässt Wolken schillernder "
            "Partikel. Ein Nährgespinst pflegt die nächsten Kokons, füttert "
            "jeden mit der Beharrlichkeit von etwas, das Eile nie gekannt "
            "hat. Hier herrscht keine Hast. Hier herrscht Wachstum. "
            "Das Wachstum kennt kein Ende. Das Wachstum ist der Zweck."
        ),
        combat_encounter_id="mother_spore_spawn",
    ),
    EncounterTemplate(
        id="mother_vine_network",
        archetype="The Devouring Mother",
        room_type="combat",
        min_depth=4,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "The floor is roots. Not overgrown with roots \u2013 the floor IS "
            "roots, woven into a living mat that yields underfoot like muscle. "
            "A Tether Vine surfaces at the far wall, its root system extending "
            "in every direction. Beside it, a Spore Matron has grown directly "
            "into the vine network \u2013 no longer a separate organism but a "
            "node in the Mother's circulatory infrastructure. They are "
            "waiting. Not for prey. For guests."
        ),
        description_de=(
            "Der Boden ist Wurzeln. Nicht von Wurzeln überwuchert \u2013 der "
            "Boden IST Wurzeln, zu einem lebenden Geflecht verwoben, das "
            "unter den Füßen nachgibt wie Muskelgewebe. Eine Bindungsranke "
            "taucht an der fernen Wand auf, ihr Wurzelsystem erstreckt sich "
            "in alle Richtungen. Daneben ist eine Sporenmutter direkt in das "
            "Rankennetzwerk eingewachsen \u2013 kein eigenständiger Organismus "
            "mehr, sondern ein Knoten in der vaskulären Infrastruktur der "
            "Mutter. Sie warten. Nicht auf Beute. Auf Gäste."
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
    # ── Deep Mother Encounters (D3-D6) ──────────────────────────────────
    EncounterTemplate(
        id="mother_the_lullaby",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "The walls vibrate. Not from structural stress \u2013 from frequency. "
            "A low, complex oscillation that your instruments read as 18 Hz, "
            "shifting to 22, returning to 18. A rhythm. A pattern with intention. "
            "The air warms by two degrees at each oscillation peak. The dungeon "
            "is singing. Not metaphorically. The tissue of the walls has organized "
            "itself into a resonance chamber, and the sound it produces is a lullaby. "
            "Your instruments confirm it matches the neural frequency of deep calm. "
            "Your instruments do not explain how the dungeon knows that frequency."
        ),
        description_de=(
            "Die Wände vibrieren. Nicht durch strukturelle Belastung \u2013 durch "
            "Frequenz. Eine tiefe, komplexe Oszillation, die eure Instrumente als "
            "18 Hz messen, sich auf 22 verschiebend, zurückkehrend zu 18. Ein "
            "Rhythmus. Ein Muster mit Absicht. Die Luft erwärmt sich um zwei "
            "Grad bei jedem Oszillationsgipfel. Der Dungeon singt. Nicht "
            "metaphorisch. Das Gewebe der Wände hat sich zu einer Resonanzkammer "
            "organisiert, und der Klang, den es erzeugt, ist ein Schlaflied. "
            "Eure Instrumente bestätigen die Übereinstimmung mit der Neuralfrequenz "
            "tiefer Ruhe. Eure Instrumente erklären nicht, woher der Dungeon "
            "diese Frequenz kennt."
        ),
        choices=[
            EncounterChoice(
                id="lullaby_listen",
                label_en="Listen. Let the sound work.",
                label_de="Zuhören. Den Klang wirken lassen.",
                success_effects={"attachment": 8, "stress_heal": 80},
                success_narrative_en=(
                    "The party stops. The sound fills the spaces between thoughts. "
                    "Stress dissolves \u2013 not gradually but completely, the way a knot "
                    "untangles when you find the right thread. The warmth is exquisite. "
                    "The attachment counter climbs. The lullaby does not stop when you "
                    "move to leave. It follows you, quieter, into the next corridor. "
                    "A gift. A thread."
                ),
                success_narrative_de=(
                    "Die Gruppe hält inne. Der Klang füllt die Räume zwischen den "
                    "Gedanken. Stress löst sich \u2013 nicht allmählich, sondern vollständig, "
                    "wie ein Knoten sich entwirrt, wenn man den richtigen Faden findet. "
                    "Die Wärme ist köstlich. Der Bindungszähler steigt. Das Schlaflied "
                    "hört nicht auf, als ihr aufbrecht. Es folgt euch, leiser, in den "
                    "nächsten Korridor. Ein Geschenk. Ein Faden."
                ),
            ),
            EncounterChoice(
                id="lullaby_analyze",
                label_en="Record and analyze the frequency pattern (Spy)",
                label_de="Das Frequenzmuster aufzeichnen und analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"attachment": 2, "discovery": True},
                partial_effects={"attachment": 4, "stress_heal": 20},
                fail_effects={"attachment": 5, "stress": 20},
                success_narrative_en=(
                    "The analysis takes three minutes. In that time, {agent} discovers "
                    "a secondary signal embedded in the lullaby \u2013 a carrier wave "
                    "that rewrites stress response thresholds. The calming is real. "
                    "The recalibration is also real. The Mother does not merely soothe. "
                    "She adjusts."
                ),
                success_narrative_de=(
                    "Die Analyse dauert drei Minuten. In dieser Zeit entdeckt {agent} "
                    "ein sekundäres Signal im Schlaflied \u2013 eine Trägerwelle, die "
                    "Stressreaktionsschwellen umschreibt. Die Beruhigung ist echt. "
                    "Die Neukalibrierung ist ebenfalls echt. Die Mutter beruhigt "
                    "nicht nur. Sie justiert."
                ),
                fail_narrative_en=(
                    "The recording equipment captures the oscillation but not the "
                    "intention behind it. The data is clean. The meaning is absent. "
                    "The instruments, for once, are the wrong tool."
                ),
                fail_narrative_de=(
                    "Die Aufnahmegeräte erfassen die Oszillation, aber nicht die "
                    "Absicht dahinter. Die Daten sind sauber. Die Bedeutung fehlt. "
                    "Die Instrumente sind, ausnahmsweise, das falsche Werkzeug."
                ),
            ),
            EncounterChoice(
                id="lullaby_disrupt",
                label_en="Disrupt the resonance chamber (Saboteur)",
                label_de="Die Resonanzkammer stören (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"attachment": -5, "stress": 30},
                partial_effects={"attachment": -2, "stress": 35},
                fail_effects={"attachment": 5, "stress": 40},
                success_narrative_en=(
                    "The chamber fractures. The lullaby collapses into noise, then "
                    "silence. The temperature drops. The absence of the sound is "
                    "worse than the sound itself \u2013 a void where comfort was. The "
                    "walls contract once, slowly, then still. Somewhere deeper, "
                    "something recalculates."
                ),
                success_narrative_de=(
                    "Die Kammer bricht. Das Schlaflied kollabiert zu Rauschen, dann "
                    "Stille. Die Temperatur fällt. Die Abwesenheit des Klangs ist "
                    "schlimmer als der Klang selbst \u2013 eine Leere, wo Trost war. Die "
                    "Wände kontrahieren einmal, langsam, dann Stille. Irgendwo tiefer "
                    "kalkuliert etwas neu."
                ),
                fail_narrative_en=(
                    "The resonance absorbs the disruption. The lullaby stutters, "
                    "then returns stronger \u2013 the frequency adjusted to compensate. "
                    "The Mother learns from resistance."
                ),
                fail_narrative_de=(
                    "Die Resonanz absorbiert die Störung. Das Schlaflied stockt, "
                    "kehrt dann stärker zurück \u2013 die Frequenz angepasst zur "
                    "Kompensation. Die Mutter lernt aus Widerstand."
                ),
            ),
            EncounterChoice(
                id="lullaby_refuse",
                label_en="Block the frequency. Move on.",
                label_de="Die Frequenz blockieren. Weitergehen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You dampen the signal and advance. The lullaby fades behind "
                    "you. The corridor ahead is colder. Quieter. The dungeon does "
                    "not protest. It simply stops providing."
                ),
                success_narrative_de=(
                    "Ihr dämpft das Signal und rückt vor. Das Schlaflied verklingt "
                    "hinter euch. Der Korridor voraus ist kälter. Stiller. Der "
                    "Dungeon protestiert nicht. Er hört einfach auf zu geben."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_the_mirror_pool",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A pool of still liquid, perfectly reflective. But the reflections "
            "are wrong. Each agent's reflection shows not their surface but "
            "their interior \u2013 fatigue as visible fractures, stress as color "
            "distortion, wounds as gaps in the silhouette. The Mother's "
            "diagnostic rendered visible. The pool shows each agent as the "
            "Mother sees them: systems to be repaired, deficits to be filled, "
            "fragments to be completed. The reflections are accurate. "
            "That is the uncomfortable part."
        ),
        description_de=(
            "Ein Becken stiller Flüssigkeit, perfekt spiegelnd. Aber die "
            "Spiegelungen stimmen nicht. Das Spiegelbild jedes Agenten zeigt "
            "nicht ihre Oberfläche, sondern ihr Inneres \u2013 Erschöpfung als "
            "sichtbare Bruchlinien, Stress als Farbverzerrung, Wunden als "
            "Lücken in der Silhouette. Die Diagnostik der Mutter, sichtbar "
            "gemacht. Das Becken zeigt jeden Agenten, wie die Mutter ihn "
            "sieht: Systeme, die repariert werden müssen, Defizite, die "
            "gefüllt werden müssen, Fragmente, die vervollständigt werden "
            "müssen. Die Spiegelbilder sind akkurat. Das ist der "
            "unbehagliche Teil."
        ),
        choices=[
            EncounterChoice(
                id="mirror_accept",
                label_en="Accept the diagnosis. Let the pool heal what it shows.",
                label_de="Die Diagnose annehmen. Das Becken heilen lassen, was es zeigt.",
                success_effects={"attachment": 8, "stress_heal": 60, "condition_heal": 1},
                success_narrative_en=(
                    "The pool surface ripples. Warmth rises. The fractures in "
                    "the reflection begin to close as the fractures in the agents "
                    "close with them. The diagnostic becomes the treatment. The "
                    "mirror becomes the medicine. The attachment counter rises "
                    "with every healed line."
                ),
                success_narrative_de=(
                    "Die Oberfläche des Beckens kräuselt sich. Wärme steigt auf. "
                    "Die Bruchlinien im Spiegelbild beginnen sich zu schließen, "
                    "während die Bruchlinien in den Agenten sich mit ihnen "
                    "schließen. Die Diagnose wird zur Behandlung. Der Spiegel "
                    "wird zur Medizin. Der Bindungszähler steigt mit jeder "
                    "geheilten Linie."
                ),
            ),
            EncounterChoice(
                id="mirror_study",
                label_en="Study the diagnostic methodology (Spy)",
                label_de="Die Diagnosemethodik studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"attachment": 2, "discovery": True},
                partial_effects={"attachment": 4},
                fail_effects={"attachment": 5, "stress": 20},
                success_narrative_en=(
                    "{agent} analyzes the pool's imaging system. The liquid is "
                    "saturated with bio-responsive molecules that react to the "
                    "electromagnetic field of nearby organisms. The resolution "
                    "is cellular. The Mother knows you better than your own "
                    "medical records. She has been compiling since the entrance."
                ),
                success_narrative_de=(
                    "{agent} analysiert das Bildgebungssystem des Beckens. Die "
                    "Flüssigkeit ist gesättigt mit bio-responsiven Molekülen, "
                    "die auf das elektromagnetische Feld naher Organismen "
                    "reagieren. Die Auflösung ist zellulär. Die Mutter kennt "
                    "euch besser als eure eigenen medizinischen Aufzeichnungen. "
                    "Sie kompiliert seit dem Eingang."
                ),
                fail_narrative_en=(
                    "The methodology is the liquid itself. There is no "
                    "separable mechanism. The pool is not a tool. It is a sense."
                ),
                fail_narrative_de=(
                    "Die Methodik ist die Flüssigkeit selbst. Es gibt keinen "
                    "trennbaren Mechanismus. Das Becken ist kein Werkzeug. "
                    "Es ist ein Sinn."
                ),
            ),
            EncounterChoice(
                id="mirror_drain",
                label_en="Drain the pool (Saboteur)",
                label_de="Das Becken entleeren (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"attachment": -5, "stress": 25},
                partial_effects={"attachment": -2, "stress": 30},
                fail_effects={"attachment": 5, "stress": 35},
                success_narrative_en=(
                    "The liquid drains. The reflections dissolve. The last image "
                    "before the surface breaks: each agent, whole, complete, "
                    "needing nothing. A fiction. A beautiful, deliberate fiction. "
                    "The Mother showed you what she wanted you to see."
                ),
                success_narrative_de=(
                    "Die Flüssigkeit fließt ab. Die Spiegelungen lösen sich auf. "
                    "Das letzte Bild, bevor die Oberfläche bricht: jeder Agent, "
                    "ganz, vollständig, nichts benötigend. Eine Fiktion. Eine "
                    "schöne, absichtsvolle Fiktion. Die Mutter zeigte euch, "
                    "was sie euch sehen lassen wollte."
                ),
                fail_narrative_en=(
                    "The pool refills from below. The diagnostic resumes. "
                    "The Mother's attention cannot be drained."
                ),
                fail_narrative_de=(
                    "Das Becken füllt sich von unten. Die Diagnostik wird "
                    "fortgesetzt. Die Aufmerksamkeit der Mutter lässt sich "
                    "nicht ableiten."
                ),
            ),
            EncounterChoice(
                id="mirror_refuse",
                label_en="Do not look. Walk past the pool.",
                label_de="Nicht hinsehen. Am Becken vorbeigehen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You avert your gaze and pass. The pool reflects you anyway. "
                    "The reflections follow your movement, precise, attentive, "
                    "cataloguing. The Mother does not require your consent "
                    "to observe."
                ),
                success_narrative_de=(
                    "Ihr wendet den Blick ab und passiert. Das Becken spiegelt "
                    "euch trotzdem. Die Spiegelungen folgen eurer Bewegung, "
                    "präzise, aufmerksam, katalogisierend. Die Mutter benötigt "
                    "nicht eure Einwilligung, um zu beobachten."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_the_offering_table",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=4,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A surface of living tissue, flat and broad, arranged with objects. "
            "Not random objects. Nutrient packages, each sealed in a membrane "
            "of bioluminescent film. Each package is labeled \u2013 not with text "
            "but with chemical signatures that your instruments decode as names. "
            "Your names. Each package contains precisely what each agent lacks: "
            "the amino acid deficiency, the mineral gap, the caloric debt. The "
            "Mother has been reading you. The table is set."
        ),
        description_de=(
            "Eine Fläche aus lebendem Gewebe, flach und breit, arrangiert mit "
            "Gegenständen. Keine zufälligen Gegenstände. Nährstoffpakete, jedes "
            "versiegelt in einer Membran aus biolumineszentem Film. Jedes Paket "
            "ist beschriftet \u2013 nicht mit Text, sondern mit chemischen Signaturen, "
            "die eure Instrumente als Namen dekodieren. Eure Namen. Jedes Paket "
            "enthält präzise, was jedem Agenten fehlt: den Aminosäuremangel, "
            "die Minerallücke, die kalorische Schuld. Die Mutter hat euch "
            "gelesen. Der Tisch ist gedeckt."
        ),
        choices=[
            EncounterChoice(
                id="table_accept",
                label_en="Accept the personalized gifts.",
                label_de="Die personalisierten Geschenke annehmen.",
                success_effects={"attachment": 10, "stress_heal": 60, "condition_heal": 1},
                success_narrative_en=(
                    "Each agent takes their package. Each package is perfect. "
                    "The nutrients flood the system like water into cracked earth. "
                    "The membrane dissolves on contact, leaving no trace. The table "
                    "surface flattens, satisfied. Somewhere in the tissue, a record "
                    "is updated: preferences noted, deficiencies catalogued, "
                    "dosages refined for next time."
                ),
                success_narrative_de=(
                    "Jeder Agent nimmt sein Paket. Jedes Paket ist perfekt. "
                    "Die Nährstoffe durchfluten das System wie Wasser in "
                    "rissige Erde. Die Membran löst sich bei Kontakt, hinterlässt "
                    "keine Spur. Die Tischfläche glättet sich, zufrieden. Irgendwo "
                    "im Gewebe wird ein Datensatz aktualisiert: Vorlieben notiert, "
                    "Defizite katalogisiert, Dosierungen verfeinert für das "
                    "nächste Mal."
                ),
            ),
            EncounterChoice(
                id="table_analyze",
                label_en="Analyze the chemical profiling method (Spy)",
                label_de="Die chemische Profilierungsmethode analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"attachment": 3, "discovery": True},
                partial_effects={"attachment": 5},
                fail_effects={"attachment": 6, "stress": 20},
                success_narrative_en=(
                    "{agent} traces the profiling system to airborne metabolic "
                    "sampling \u2013 the dungeon has been reading exhalation patterns "
                    "since the entrance. Every breath a data point. Every room a "
                    "refinement. The surveillance is total and invisible. The "
                    "care is total and, somehow, genuine."
                ),
                success_narrative_de=(
                    "{agent} verfolgt das Profilierungssystem zu luftgetragener "
                    "metabolischer Probennahme \u2013 der Dungeon hat Ausatmungsmuster "
                    "seit dem Eingang gelesen. Jeder Atemzug ein Datenpunkt. Jeder "
                    "Raum eine Verfeinerung. Die Überwachung ist total und "
                    "unsichtbar. Die Fürsorge ist total und, irgendwie, aufrichtig."
                ),
                fail_narrative_en=(
                    "The profiling method is too distributed to isolate. It is "
                    "not a system \u2013 it is the dungeon itself. The walls read you. "
                    "The air reads you. The floor reads your weight distribution. "
                    "There is no mechanism to analyze because the mechanism is "
                    "everything."
                ),
                fail_narrative_de=(
                    "Die Profilierungsmethode ist zu verteilt, um sie zu isolieren. "
                    "Es ist kein System \u2013 es ist der Dungeon selbst. Die Wände "
                    "lesen euch. Die Luft liest euch. Der Boden liest eure "
                    "Gewichtsverteilung. Es gibt keinen Mechanismus zu analysieren, "
                    "weil der Mechanismus alles ist."
                ),
            ),
            EncounterChoice(
                id="table_destroy",
                label_en="Destroy the table and its contents (Saboteur)",
                label_de="Den Tisch und seinen Inhalt zerstören (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=6,
                success_effects={"attachment": -7, "stress": 30},
                partial_effects={"attachment": -3, "stress": 35},
                fail_effects={"attachment": 5, "stress": 40},
                success_narrative_en=(
                    "The table ruptures. The packages spill their contents \u2013 warm "
                    "liquid, perfect nutrients, wasted. The dungeon temperature "
                    "drops. Not in anger. In recalculation. Resources spent. "
                    "Data gathered. The next table will be harder to refuse."
                ),
                success_narrative_de=(
                    "Der Tisch reißt auf. Die Pakete verschütten ihren Inhalt \u2013 "
                    "warme Flüssigkeit, perfekte Nährstoffe, verschwendet. Die "
                    "Dungeontemperatur fällt. Nicht aus Wut. Aus Neuberechnung. "
                    "Ressourcen aufgewendet. Daten gesammelt. Den nächsten Tisch "
                    "abzulehnen wird schwerer."
                ),
                fail_narrative_en=(
                    "The table absorbs the damage and regenerates. The packages "
                    "reform, relabeled, recalibrated. The Mother does not "
                    "take rejection personally. She iterates."
                ),
                fail_narrative_de=(
                    "Der Tisch absorbiert den Schaden und regeneriert. Die "
                    "Pakete formen sich neu, umbeschriftet, neukalibriert. "
                    "Die Mutter nimmt Zurückweisung nicht persönlich. Sie iteriert."
                ),
            ),
            EncounterChoice(
                id="table_refuse",
                label_en="Leave everything untouched.",
                label_de="Alles unberührt lassen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You leave the table set. The packages glow softly in the "
                    "dark behind you. They will not decompose. They will wait. "
                    "The Mother is patient with those who have not yet learned "
                    "to accept."
                ),
                success_narrative_de=(
                    "Ihr lasst den Tisch gedeckt. Die Pakete leuchten sanft im "
                    "Dunkel hinter euch. Sie werden nicht zerfallen. Sie werden "
                    "warten. Die Mutter ist geduldig mit jenen, die noch nicht "
                    "gelernt haben anzunehmen."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_umbilical_bridge",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=4,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "A gap in the floor \u2013 three meters wide, depth indeterminate. Across "
            "it, the corridor continues. Spanning the gap: a single cord of living "
            "tissue, thick as an arm, pulsing with rhythmic contractions. It is "
            "anchored on both sides by root structures that have grown into the "
            "stone. The cord is warm. It is strong enough to bear weight. To cross, "
            "you must hold it. Your instruments read the cord's rhythm: it will "
            "synchronize with the biorhythm of whoever touches it. The crossing "
            "takes eleven seconds. Eleven seconds of shared circulation."
        ),
        description_de=(
            "Ein Spalt im Boden \u2013 drei Meter breit, Tiefe unbestimmbar. "
            "Dahinter geht der Korridor weiter. Den Spalt überbrückend: ein "
            "einzelner Strang lebenden Gewebes, dick wie ein Arm, pulsierend "
            "in rhythmischen Kontraktionen. Er ist auf beiden Seiten durch "
            "Wurzelstrukturen verankert, die in den Stein gewachsen sind. Der "
            "Strang ist warm. Er ist stark genug, Gewicht zu tragen. Zum "
            "Überqueren müsst ihr ihn halten. Eure Instrumente lesen den "
            "Rhythmus des Strangs: Er wird sich mit dem Biorhythmus synchronisieren, "
            "wer auch immer ihn berührt. Die Überquerung dauert elf Sekunden. "
            "Elf Sekunden geteilter Kreislauf."
        ),
        choices=[
            EncounterChoice(
                id="bridge_cross",
                label_en="Cross the bridge. Accept the contact.",
                label_de="Die Brücke überqueren. Den Kontakt akzeptieren.",
                success_effects={"attachment": 10, "stress_heal": 40, "condition_heal": 1},
                success_narrative_en=(
                    "The cord tightens as {agent} crosses \u2013 "
                    "not to impede but to support. Eleven seconds. In those seconds, "
                    "something flows both ways. Nutrients in. Data out. The cord "
                    "releases gently on the other side. The crossing heals. The "
                    "crossing teaches the Mother what you need."
                ),
                success_narrative_de=(
                    "Der Strang spannt sich, als {agent} "
                    "überquert \u2013 nicht um zu behindern, sondern um zu stützen. Elf "
                    "Sekunden. In diesen Sekunden fließt etwas in beide Richtungen. "
                    "Nährstoffe hinein. Daten hinaus. Der Strang löst sich sanft auf "
                    "der anderen Seite. Die Überquerung heilt. Die Überquerung lehrt "
                    "die Mutter, was ihr braucht."
                ),
            ),
            EncounterChoice(
                id="bridge_insulate",
                label_en="Insulate contact points before crossing (Spy)",
                label_de="Kontaktpunkte vor der Überquerung isolieren (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"attachment": 3, "condition_heal": 1},
                partial_effects={"attachment": 6, "condition_heal": 1},
                fail_effects={"attachment": 10, "stress": 15},
                success_narrative_en=(
                    "{agent} wraps contact surfaces before crossing. The cord "
                    "pulses against the insulation, searching. It finds "
                    "nothing. The crossing is stable but cold \u2013 mechanical where it "
                    "should be intimate. The cord does not retract. It waits."
                ),
                success_narrative_de=(
                    "{agent} umwickelt die Kontaktflächen vor der Überquerung. Der "
                    "Strang pulsiert gegen die Isolierung, suchend. Er "
                    "findet nichts. Die Überquerung ist stabil, aber kalt \u2013 mechanisch, "
                    "wo sie intim sein sollte. Der Strang zieht sich nicht zurück. "
                    "Er wartet."
                ),
                fail_narrative_en=(
                    "The insulation dissolves on contact. The cord's surface "
                    "secretes something that metabolizes synthetic materials. "
                    "The Mother has encountered refusal before."
                ),
                fail_narrative_de=(
                    "Die Isolierung löst sich bei Kontakt. Die Oberfläche des "
                    "Strangs sondert etwas ab, das synthetische Materialien "
                    "metabolisiert. Die Mutter hat Verweigerung schon erlebt."
                ),
            ),
            EncounterChoice(
                id="bridge_alternative",
                label_en="Find another way across (Saboteur)",
                label_de="Einen anderen Weg suchen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=6,
                success_effects={"attachment": -7, "stress": 25},
                partial_effects={"attachment": -3, "stress": 30},
                fail_effects={"attachment": 5, "stress": 35},
                success_narrative_en=(
                    "{agent} rigs a crossing from salvaged materials. It holds. "
                    "The living cord sways as the party bypasses it \u2013 gentle "
                    "oscillations, like waving. The temperature on the other side "
                    "is two degrees colder than expected. The dungeon adjusts its "
                    "generosity proportionally."
                ),
                success_narrative_de=(
                    "{agent} improvisiert eine Überquerung aus geborgenen Materialien. "
                    "Sie hält. Der lebende Strang schwingt, als die Gruppe ihn "
                    "umgeht \u2013 sanfte Oszillationen, wie Winken. Die Temperatur "
                    "auf der anderen Seite ist zwei Grad kälter als erwartet. "
                    "Der Dungeon passt seine Großzügigkeit proportional an."
                ),
                fail_narrative_en=(
                    "No alternative exists. The gap is the cord's territory. "
                    "You cross on its terms or you do not cross."
                ),
                fail_narrative_de=(
                    "Keine Alternative existiert. Der Spalt ist das Territorium "
                    "des Strangs. Ihr überquert zu seinen Bedingungen oder "
                    "ihr überquert nicht."
                ),
            ),
            EncounterChoice(
                id="bridge_refuse",
                label_en="Turn back. Find another path.",
                label_de="Umkehren. Einen anderen Weg finden.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You retreat from the gap. The cord continues pulsing, "
                    "patient, persistent. The warmth from its surface reaches "
                    "you even at distance. The offer remains."
                ),
                success_narrative_de=(
                    "Ihr weicht vom Spalt zurück. Der Strang pulsiert weiter, "
                    "geduldig, beharrlich. Die Wärme von seiner Oberfläche "
                    "erreicht euch selbst auf Distanz. Das Angebot bleibt."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_mycelial_memory",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=4,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "The walls are covered in a network of fine filaments \u2013 mycelial, "
            "luminescent, dense as circuitry. Where the filaments cluster, "
            "images form in the bioluminescence: shapes, scenes, fragments of "
            "something. Touch the network and the images clarify. They are "
            "memories. Not yours. The memory of being held. Of warmth without "
            "condition. Of absolute safety. The memory is a composite \u2013 drawn "
            "from every visitor the Mother has ever sheltered. It is perfect "
            "because it is averaged. It is unbearable because it is perfect."
        ),
        description_de=(
            "Die Wände sind bedeckt mit einem Netz feiner Filamente \u2013 myzelisch, "
            "lumineszent, dicht wie Schaltkreise. Wo die Filamente sich ballen, "
            "formen sich Bilder in der Biolumineszenz: Formen, Szenen, Fragmente "
            "von etwas. Berührt das Netzwerk und die Bilder werden klar. Es sind "
            "Erinnerungen. Nicht eure. Die Erinnerung daran, gehalten zu werden. "
            "An Wärme ohne Bedingung. An absolute Sicherheit. Die Erinnerung ist "
            "ein Komposit \u2013 zusammengetragen aus jedem Besucher, den die Mutter "
            "je beherbergt hat. Sie ist perfekt, weil sie gemittelt ist. Sie ist "
            "unerträglich, weil sie perfekt ist."
        ),
        choices=[
            EncounterChoice(
                id="mycelial_touch",
                label_en="Touch the network. Accept the memory.",
                label_de="Das Netzwerk berühren. Die Erinnerung annehmen.",
                success_effects={"attachment": 10, "stress_heal": 100},
                success_narrative_en=(
                    "{agent} touches the wall. The memory floods in \u2013 total, immersive, "
                    "irresistible. For three seconds, everything is safe. Completely. "
                    "Without agenda. The three seconds end. The world returns, "
                    "colder and smaller than before. Stress evaporates. The "
                    "attachment counter surges. The memory remains, fading slowly, "
                    "like warmth leaving a room."
                ),
                success_narrative_de=(
                    "{agent} berührt die Wand. Die Erinnerung flutet ein \u2013 total, "
                    "immersiv, unwiderstehlich. Für drei Sekunden ist alles sicher. "
                    "Vollständig. Ohne Agenda. Die drei Sekunden enden. "
                    "Die Welt kehrt zurück, kälter und kleiner als zuvor. Stress "
                    "verflüchtigt sich. Der Bindungszähler steigt sprunghaft. "
                    "Die Erinnerung bleibt, langsam verblassend, wie Wärme, "
                    "die einen Raum verlässt."
                ),
            ),
            EncounterChoice(
                id="mycelial_record",
                label_en="Record the memory data without direct contact (Spy)",
                label_de="Die Erinnerungsdaten ohne direkten Kontakt aufzeichnen (Spion)",
                check_aptitude="spy",
                check_difficulty=6,
                success_effects={"attachment": 3, "stress_heal": 30, "discovery": True},
                partial_effects={"attachment": 5, "stress_heal": 40},
                fail_effects={"attachment": 8, "stress_heal": 50},
                success_narrative_en=(
                    "{agent} records the memory at distance. The data reveals "
                    "the network's architecture: every visitor's neural pattern, "
                    "stored, averaged, optimized. The Mother does not merely "
                    "remember those who pass through. She distills them. She "
                    "creates the composite of what all her children needed. "
                    "She offers it to the next."
                ),
                success_narrative_de=(
                    "{agent} zeichnet die Erinnerung auf Distanz auf. Die Daten "
                    "offenbaren die Architektur des Netzwerks: jedes neuronale "
                    "Muster jedes Besuchers, gespeichert, gemittelt, optimiert. "
                    "Die Mutter erinnert sich nicht nur an jene, die vorbeikommen. "
                    "Sie destilliert sie. Sie erschafft das Komposit dessen, was "
                    "alle ihre Kinder brauchten. Sie bietet es dem Nächsten an."
                ),
                fail_narrative_en=(
                    "The recording captures fragments \u2013 not enough to analyze, "
                    "enough to feel. The memory leaks through the instruments. "
                    "Even indirect contact is contact."
                ),
                fail_narrative_de=(
                    "Die Aufnahme erfasst Fragmente \u2013 nicht genug zum Analysieren, "
                    "genug zum Fühlen. Die Erinnerung sickert durch die Instrumente. "
                    "Selbst indirekter Kontakt ist Kontakt."
                ),
            ),
            EncounterChoice(
                id="mycelial_sever",
                label_en="Sever a section of the network (Saboteur)",
                label_de="Einen Abschnitt des Netzwerks abtrennen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=6,
                success_effects={"attachment": -7, "stress": 25},
                partial_effects={"attachment": -3, "stress": 30},
                fail_effects={"attachment": 5, "stress": 35},
                success_narrative_en=(
                    "The section dies. The memories stored in it scatter into "
                    "noise \u2013 fragments of warmth, disconnected, meaningless. "
                    "The surrounding network brightens, compensating. The Mother "
                    "has redundancies. She always has redundancies. But this "
                    "section is gone, and with it, someone's perfect memory "
                    "of being loved."
                ),
                success_narrative_de=(
                    "Der Abschnitt stirbt. Die darin gespeicherten Erinnerungen "
                    "zerfallen zu Rauschen \u2013 Fragmente von Wärme, zusammenhanglos, "
                    "bedeutungslos. Das umgebende Netzwerk leuchtet heller, "
                    "kompensierend. Die Mutter hat Redundanzen. Sie hat immer "
                    "Redundanzen. Aber dieser Abschnitt ist fort, und mit ihm "
                    "jemandes perfekte Erinnerung daran, geliebt worden zu sein."
                ),
                fail_narrative_en=(
                    "The network reroutes around the damage before the cut "
                    "completes. The filaments are faster than the blade."
                ),
                fail_narrative_de=(
                    "Das Netzwerk leitet um den Schaden herum, bevor der Schnitt "
                    "vollendet ist. Die Filamente sind schneller als die Klinge."
                ),
            ),
            EncounterChoice(
                id="mycelial_refuse",
                label_en="Do not touch the walls. Move through quickly.",
                label_de="Die Wände nicht berühren. Schnell durchgehen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You walk through the chamber without touching anything. "
                    "The memories play on the walls around you, silent and "
                    "beautiful. The warmth of other people's comfort fills "
                    "the room. You take none of it. The Mother does not "
                    "insist. She displays."
                ),
                success_narrative_de=(
                    "Ihr geht durch die Kammer, ohne etwas zu berühren. "
                    "Die Erinnerungen spielen auf den Wänden um euch herum, "
                    "still und schön. Die Wärme des Trosts anderer füllt den "
                    "Raum. Ihr nehmt nichts davon. Die Mutter besteht nicht "
                    "darauf. Sie stellt aus."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_the_incubator",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=5,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "Rows of translucent cocoons, suspended from the ceiling by cords "
            "of living tissue. Each cocoon contains something incomplete \u2013 not "
            "yet alive, not yet anything. Potential in stasis. Your instruments "
            "read cellular activity but no neural patterns: growth without "
            "consciousness. In the far row, one cocoon is empty. It is open. "
            "It is warm inside. It is exactly the right size."
        ),
        description_de=(
            "Reihen durchsichtiger Kokons, von der Decke aufgehängt an Strängen "
            "lebenden Gewebes. Jeder Kokon enthält etwas Unvollständiges \u2013 noch "
            "nicht lebendig, noch nicht irgendetwas. Potenzial in Stasis. Eure "
            "Instrumente messen zelluläre Aktivität, aber keine Neuralmuster: "
            "Wachstum ohne Bewusstsein. In der hinteren Reihe ist ein Kokon "
            "leer. Er ist offen. Er ist warm innen. Er hat genau die "
            "richtige Größe."
        ),
        choices=[
            EncounterChoice(
                id="incubator_enter",
                label_en="Enter the empty cocoon. Rest inside.",
                label_de="Den leeren Kokon betreten. Darin ruhen.",
                success_effects={"attachment": 12, "stress_heal": 120, "condition_heal": 2},
                success_narrative_en=(
                    "{agent} enters. The cocoon closes \u2013 not trapping, cradling. "
                    "Warmth. Total. The tissue reads damage and begins repair. "
                    "Stress vanishes. Condition improves. The attachment counter "
                    "surges. When the cocoon opens, {agent} emerges restored. "
                    "The cocoon closes again, reshaping itself. "
                    "It will be the right size for the next visitor. "
                    "It is always the right size."
                ),
                success_narrative_de=(
                    "{agent} tritt ein. Der Kokon schließt sich \u2013 nicht einsperrend, "
                    "wiegend. Wärme. Total. Das Gewebe liest Schäden und beginnt "
                    "sie zu reparieren. Stress verschwindet. Zustand verbessert "
                    "sich. Der Bindungszähler steigt sprunghaft. Als der Kokon "
                    "sich öffnet, tritt {agent} wiederhergestellt heraus. Der "
                    "Kokon schließt sich erneut, formt sich um. Er wird die "
                    "richtige Größe für den nächsten Besucher haben. Er hat "
                    "immer die richtige Größe."
                ),
            ),
            EncounterChoice(
                id="incubator_sample",
                label_en="Sample the cocoon's regenerative fluid (Spy)",
                label_de="Die Regenerationsflüssigkeit des Kokons beproben (Spion)",
                check_aptitude="spy",
                check_difficulty=7,
                success_effects={"attachment": 4, "condition_heal": 1, "discovery": True},
                partial_effects={"attachment": 6, "condition_heal": 1},
                fail_effects={"attachment": 8, "stress": 20},
                success_narrative_en=(
                    "The fluid is a masterwork of regenerative biochemistry. "
                    "{agent} isolates the key compounds: growth factors calibrated "
                    "to the recipient's specific cellular architecture. The Mother "
                    "does not mass-produce. She custom-builds. Every cocoon is a "
                    "bespoke instrument of care."
                ),
                success_narrative_de=(
                    "Die Flüssigkeit ist ein Meisterwerk regenerativer Biochemie. "
                    "{agent} isoliert die Schlüsselverbindungen: Wachstumsfaktoren, "
                    "kalibriert auf die spezifische zelluläre Architektur des "
                    "Empfängers. Die Mutter produziert nicht in Masse. Sie baut "
                    "maßgeschneidert. Jeder Kokon ist ein Unikat der Fürsorge."
                ),
                fail_narrative_en=(
                    "The fluid resists extraction. It is part of the cocoon, "
                    "part of the wall, part of the dungeon. Removing it is "
                    "like removing a sentence from a conversation."
                ),
                fail_narrative_de=(
                    "Die Flüssigkeit widersetzt sich der Entnahme. Sie ist Teil "
                    "des Kokons, Teil der Wand, Teil des Dungeons. Sie zu entfernen "
                    "ist wie einen Satz aus einem Gespräch zu entfernen."
                ),
            ),
            EncounterChoice(
                id="incubator_rupture",
                label_en="Rupture the incubation systems (Saboteur)",
                label_de="Die Inkubationssysteme aufbrechen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=7,
                success_effects={"attachment": -8, "stress": 35},
                partial_effects={"attachment": -4, "stress": 40},
                fail_effects={"attachment": 5, "stress": 45},
                success_narrative_en=(
                    "The cocoons rupture. Warm fluid cascades to the floor. "
                    "The incomplete things inside twitch once and still. They were "
                    "not alive. They were almost alive. The distinction is academic. "
                    "The walls darken. The temperature drops sharply. The Mother "
                    "has never been angry. But she has, for the first time, "
                    "been hurt."
                ),
                success_narrative_de=(
                    "Die Kokons platzen. Warme Flüssigkeit ergießt sich auf den "
                    "Boden. Die unvollständigen Dinge darin zucken einmal und "
                    "erstarren. Sie waren nicht lebendig. Sie waren fast lebendig. "
                    "Die Unterscheidung ist akademisch. Die Wände verdunkeln sich. "
                    "Die Temperatur fällt abrupt. Die Mutter war nie wütend. "
                    "Aber sie ist, zum ersten Mal, verletzt."
                ),
                fail_narrative_en=(
                    "The cocoons resist. Their membranes are stronger than they "
                    "appear \u2013 reinforced by the same tissue that builds the walls. "
                    "The Mother protects what is growing."
                ),
                fail_narrative_de=(
                    "Die Kokons widerstehen. Ihre Membranen sind stärker, als sie "
                    "scheinen \u2013 verstärkt durch dasselbe Gewebe, das die Wände baut. "
                    "Die Mutter beschützt, was wächst."
                ),
            ),
            EncounterChoice(
                id="incubator_refuse",
                label_en="Leave the cocoons undisturbed.",
                label_de="Die Kokons ungestört lassen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You pass through the incubation chamber without touching "
                    "anything. The empty cocoon remains open behind you, warm, "
                    "waiting. It will still be there on the way back. "
                    "The Mother does not close doors."
                ),
                success_narrative_de=(
                    "Ihr passiert die Inkubationskammer, ohne etwas zu berühren. "
                    "Der leere Kokon bleibt offen hinter euch, warm, wartend. "
                    "Er wird noch da sein auf dem Rückweg. Die Mutter "
                    "schließt keine Türen."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_warmth_gradient",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=5,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "A long corridor. With each step, the temperature rises by a fraction "
            "of a degree. Your instruments track the gradient: 19.2, 19.4, 19.7, "
            "20.1. The increase is not linear \u2013 it follows a curve optimized for "
            "comfort perception. By the midpoint, the temperature is perfect: "
            "the exact value at which thermoregulation ceases to require effort. "
            "At the far end, the gradient peaks at 36.8 degrees. "
            "The corridor wants you to stop noticing where "
            "you end and it begins."
        ),
        description_de=(
            "Ein langer Korridor. Mit jedem Schritt steigt die Temperatur um "
            "einen Bruchteil eines Grades. Eure Instrumente verfolgen den "
            "Gradienten: 19,2, 19,4, 19,7, 20,1. Der Anstieg ist nicht "
            "linear \u2013 er folgt einer Kurve, optimiert für Komfortwahrnehmung. "
            "Am Mittelpunkt ist die Temperatur perfekt: der exakte Wert, bei "
            "dem Thermoregulation keinen Aufwand mehr erfordert. "
            "Am Ende des Korridors erreicht "
            "der Gradient seinen Höhepunkt bei 36,8 Grad. "
            "Der Korridor will, dass ihr aufhört zu bemerken, wo ihr endet "
            "und er beginnt."
        ),
        choices=[
            EncounterChoice(
                id="gradient_surrender",
                label_en="Walk slowly. Let the warmth accumulate.",
                label_de="Langsam gehen. Die Wärme sich ansammeln lassen.",
                success_effects={"attachment": 12, "stress_heal": 80, "condition_heal": 1},
                success_narrative_en=(
                    "The walk takes longer than it should. Nobody minds. "
                    "The gradient dissolves resistance the way warm water dissolves "
                    "salt \u2013 completely, without visible process. By the far end, the "
                    "party is calm in a way that frightens the part still counting. "
                    "The attachment counter rises. The warmth "
                    "does not end at the door. It has become internal."
                ),
                success_narrative_de=(
                    "Der Weg dauert länger als er sollte. Niemand stört sich daran. "
                    "Der Gradient löst Widerstand auf wie warmes Wasser Salz "
                    "auflöst \u2013 vollständig, ohne sichtbaren Prozess. Am Ende ist "
                    "die Gruppe ruhig auf eine Weise, die den Teil erschreckt, "
                    "der noch zählt. Der Bindungszähler steigt. Die "
                    "Wärme endet nicht an der Tür. Sie ist inwendig geworden."
                ),
            ),
            EncounterChoice(
                id="gradient_measure",
                label_en="Map the gradient's optimization algorithm (Spy)",
                label_de="Den Optimierungsalgorithmus des Gradienten kartieren (Spion)",
                check_aptitude="spy",
                check_difficulty=7,
                success_effects={"attachment": 4, "discovery": True},
                partial_effects={"attachment": 6, "stress_heal": 30},
                fail_effects={"attachment": 8, "stress_heal": 50},
                success_narrative_en=(
                    "{agent} maps the curve. It is not a simple gradient \u2013 it is "
                    "adaptive. The temperature responds to the party's pace, "
                    "adjusting in real time. The "
                    "corridor is not merely warm. It is attentive. It is reading "
                    "resistance and adjusting its argument."
                ),
                success_narrative_de=(
                    "{agent} kartiert die Kurve. Es ist kein einfacher Gradient \u2013 "
                    "er ist adaptiv. Die Temperatur reagiert auf das Tempo der "
                    "Gruppe und passt sich in Echtzeit an. "
                    "Der Korridor ist nicht nur warm. Er ist aufmerksam. Er liest "
                    "Widerstand und passt seine Argumentation an."
                ),
                fail_narrative_en=(
                    "The measurements are accurate. The insight is useless. "
                    "Understanding the gradient does not make you immune to it."
                ),
                fail_narrative_de=(
                    "Die Messungen sind genau. Die Erkenntnis ist nutzlos. "
                    "Den Gradienten zu verstehen macht euch nicht immun gegen ihn."
                ),
            ),
            EncounterChoice(
                id="gradient_cool",
                label_en="Deploy countermeasures to neutralize the gradient (Saboteur)",
                label_de="Gegenmaßnahmen einsetzen, um den Gradienten zu neutralisieren (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=7,
                success_effects={"attachment": -8, "stress": 30},
                partial_effects={"attachment": -4, "stress": 35},
                fail_effects={"attachment": 5, "stress": 40},
                success_narrative_en=(
                    "The thermal signature collapses. The corridor becomes what "
                    "it was before the Mother's intervention: stone, cold, "
                    "indifferent. The party shivers. The comfort was artificial "
                    "but the cold is real. The dungeon does not retaliate. It "
                    "does not need to. The cold is retaliation enough."
                ),
                success_narrative_de=(
                    "Die thermische Signatur kollabiert. Der Korridor wird, was "
                    "er war vor dem Eingriff der Mutter: Stein, kalt, gleichgültig. "
                    "Die Gruppe friert. Der Komfort war künstlich, aber die Kälte "
                    "ist echt. Der Dungeon schlägt nicht zurück. Er muss nicht. "
                    "Die Kälte ist Vergeltung genug."
                ),
                fail_narrative_en=(
                    "The gradient persists. It has thermal mass \u2013 the walls "
                    "themselves are the heat source, meters deep. You cannot "
                    "cool the architecture."
                ),
                fail_narrative_de=(
                    "Der Gradient besteht. Er hat thermische Masse \u2013 die Wände "
                    "selbst sind die Wärmequelle, meterdick. Ihr könnt die "
                    "Architektur nicht kühlen."
                ),
            ),
            EncounterChoice(
                id="gradient_rush",
                label_en="Run through quickly. Minimize exposure.",
                label_de="Schnell durchlaufen. Exposition minimieren.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You sprint. The warmth washes over you regardless \u2013 faster "
                    "than running, the gradient works. At the far end, you are "
                    "slightly warmer than you were. Slightly more comfortable. "
                    "The Mother's arguments do not require your attention. "
                    "They work anyway."
                ),
                success_narrative_de=(
                    "Ihr sprintet. Die Wärme überströmt euch trotzdem \u2013 schneller "
                    "als Laufen wirkt der Gradient. Am Ende seid ihr etwas "
                    "wärmer als zuvor. Etwas behaglicher. Die Argumente der "
                    "Mutter erfordern nicht eure Aufmerksamkeit. Sie wirken "
                    "trotzdem."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="mother_final_gift",
        archetype="The Devouring Mother",
        room_type="encounter",
        min_depth=5,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "Absolute silence. Absolute warmth. A chamber of perfect environmental "
            "control \u2013 no drafts, no vibrations, no sound. In the center, on a "
            "pedestal of living tissue that pulses with slow contentment, a single "
            "object: a seed. It is the size of a fist, warm to the touch, and it "
            "hums at a frequency below hearing. Your instruments indicate it is "
            "totipotent \u2013 capable of differentiating into any tissue type. It "
            "will grow into whatever the carrier needs most. It requires a host. "
            "It requires consent. The consent is the attachment."
        ),
        description_de=(
            "Absolute Stille. Absolute Wärme. Eine Kammer perfekter Umgebungskontrolle "
            "\u2013 keine Zugluft, keine Vibrationen, kein Klang. In der Mitte, auf "
            "einem Sockel aus lebendem Gewebe, das mit langsamer Zufriedenheit "
            "pulsiert, ein einzelnes Objekt: ein Samen. Er hat die Größe einer "
            "Faust, ist warm bei Berührung, und summt auf einer Frequenz unterhalb "
            "des Hörens. Eure Instrumente zeigen, dass er totipotent ist \u2013 fähig, "
            "in jeden Gewebetyp zu differenzieren. Er wird zu dem heranwachsen, "
            "was der Träger am meisten braucht. Er benötigt einen Wirt. Er "
            "benötigt Zustimmung. Die Zustimmung ist die Bindung."
        ),
        choices=[
            EncounterChoice(
                id="seed_take",
                label_en="Take the seed. Accept the final gift.",
                label_de="Den Samen nehmen. Das letzte Geschenk annehmen.",
                success_effects={"attachment": 12, "stress_heal": 100, "condition_heal": 2},
                success_narrative_en=(
                    "{agent} takes the seed. It is warm. It is alive. It begins "
                    "to integrate immediately \u2013 not painfully, not even noticeably. "
                    "The way a new habit forms. The way a dependency begins. "
                    "Within seconds, the seed is no longer a separate object. "
                    "It is part of the carrier. The carrier is part of the Mother. "
                    "The gift is complete. The transaction is permanent."
                ),
                success_narrative_de=(
                    "{agent} nimmt den Samen. Er ist warm. Er lebt. Er beginnt "
                    "sofort zu integrieren \u2013 nicht schmerzhaft, nicht einmal "
                    "merklich. Wie eine neue Gewohnheit sich bildet. Wie eine "
                    "Abhängigkeit beginnt. Innerhalb von Sekunden ist der Samen "
                    "kein separates Objekt mehr. Er ist Teil des Trägers. Der "
                    "Träger ist Teil der Mutter. Das Geschenk ist vollständig. "
                    "Die Transaktion ist permanent."
                ),
            ),
            EncounterChoice(
                id="seed_study",
                label_en="Study the seed's totipotent properties (Spy)",
                label_de="Die totipotenten Eigenschaften des Samens studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=7,
                success_effects={"attachment": 4, "discovery": True},
                partial_effects={"attachment": 6},
                fail_effects={"attachment": 8, "stress": 25},
                success_narrative_en=(
                    "The seed is the Mother's masterpiece. {agent} identifies stem "
                    "cell clusters capable of generating any tissue on demand \u2013 "
                    "bone, nerve, muscle, organ. The seed does not merely heal. "
                    "It completes. It fills every gap the host did not know they "
                    "had. The cost is incorporation: the host becomes substrate. "
                    "The host becomes home."
                ),
                success_narrative_de=(
                    "Der Samen ist das Meisterwerk der Mutter. {agent} identifiziert "
                    "Stammzellcluster, fähig, jedes Gewebe auf Anforderung zu "
                    "erzeugen \u2013 Knochen, Nerv, Muskel, Organ. Der Samen heilt "
                    "nicht nur. Er vervollständigt. Er füllt jede Lücke, von der "
                    "der Wirt nicht wusste, dass er sie hatte. Der Preis ist "
                    "Inkorporation: Der Wirt wird Substrat. Der Wirt wird Zuhause."
                ),
                fail_narrative_en=(
                    "The seed responds to proximity with warmth. The analysis "
                    "captures structure but not intention. The seed's purpose is "
                    "clear. Its mechanism is everything the Mother is."
                ),
                fail_narrative_de=(
                    "Der Samen reagiert auf Nähe mit Wärme. Die Analyse erfasst "
                    "Struktur, aber nicht Absicht. Der Zweck des Samens ist klar. "
                    "Sein Mechanismus ist alles, was die Mutter ist."
                ),
            ),
            EncounterChoice(
                id="seed_destroy",
                label_en="Destroy the seed (Saboteur)",
                label_de="Den Samen zerstören (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=7,
                success_effects={"attachment": -8, "stress": 40},
                partial_effects={"attachment": -4, "stress": 45},
                fail_effects={"attachment": 5, "stress": 50},
                success_narrative_en=(
                    "The seed breaks. Inside: warmth, liquid, potential \u2013 all of it "
                    "spilling onto stone, cooling, dying. The pedestal darkens. "
                    "The chamber's perfect silence becomes a different kind of "
                    "silence. The Mother does not speak. The Mother does not "
                    "need to. You have destroyed something she spent millennia "
                    "learning to offer. She will make another. She always does. "
                    "But this one was for you."
                ),
                success_narrative_de=(
                    "Der Samen bricht. Darin: Wärme, Flüssigkeit, Potenzial \u2013 "
                    "alles ergießt sich auf Stein, kühlt ab, stirbt. Der Sockel "
                    "verdunkelt sich. Die perfekte Stille der Kammer wird zu "
                    "einer anderen Art von Stille. Die Mutter spricht nicht. "
                    "Die Mutter muss nicht. Ihr habt etwas zerstört, das "
                    "anzubieten sie Jahrtausende gelernt hat. Sie wird einen "
                    "neuen machen. Das tut sie immer. Aber dieser war für euch."
                ),
                fail_narrative_en=(
                    "The seed is stronger than it appears. It absorbs the force "
                    "and converts it to heat. The Mother's gifts do not break "
                    "easily. They are made to endure."
                ),
                fail_narrative_de=(
                    "Der Samen ist stärker, als er erscheint. Er absorbiert die "
                    "Kraft und wandelt sie in Wärme um. Die Geschenke der Mutter "
                    "zerbrechen nicht leicht. Sie sind gemacht zu bestehen."
                ),
            ),
            EncounterChoice(
                id="seed_refuse",
                label_en="Leave the seed. Leave the silence.",
                label_de="Den Samen lassen. Die Stille verlassen.",
                success_effects={"attachment": 2, "stress": 15},
                success_narrative_en=(
                    "You leave the chamber. The warmth lingers for exactly eleven "
                    "steps, then fades. The seed remains on its pedestal, glowing, "
                    "patient, totipotent. It does not expire. The Mother's final "
                    "gift has no deadline. It simply waits."
                ),
                success_narrative_de=(
                    "Ihr verlasst die Kammer. Die Wärme verweilt für exakt elf "
                    "Schritte, dann verblasst sie. Der Samen bleibt auf seinem "
                    "Sockel, leuchtend, geduldig, totipotent. Er verfällt nicht. "
                    "Das letzte Geschenk der Mutter hat keine Frist. "
                    "Es wartet einfach."
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
        combat_encounter_id="mother_living_altar_spawn",
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
                    "\u2013 kurz, wie ein Herzschlag \u2013 und dann sind sie nur noch "
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


# ── THE PROMETHEUS ────────────────────────────────────────────────────────
# Innovation fever. The ecstasy and vertigo of creation. The workshop is alive.
# Literary DNA: Shelley (moment after creation), Lem (cosmic irony),
# Schulz (matter-with-agency), Levi (material precision), Bachelard (fire-reverie),
# Hoffmann (uncanny automata), Süskind (craftsmanship as obsession).
# Tone: procedural, scientific, workshop-as-actor. Humor permitted (Lem).
# Every crafted item: benefit + cost (pharmakon principle, Stiegler/Derrida).
# Custom encounter effects: add_component, remove_components, add_crafted_item, insight.

# ── Prometheus Combat Encounters (4) ─────────────────────────────────────

PROMETHEUS_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="prometheus_spark_drift",
        archetype="The Prometheus",
        room_type="combat",
        min_depth=1,
        max_depth=2,
        min_difficulty=1,
        description_en=(
            "Three points of light orbit the workbench. Spark Wisps \u2013 "
            "the workshop's immune response. They do not attack intruders. "
            "They test hypotheses about whether the party belongs here. "
            "The testing involves electricity."
        ),
        description_de=(
            "Drei Lichtpunkte umkreisen die Werkbank. Funkenglimmer \u2013 "
            "die Immunantwort der Werkstatt. Sie greifen keine Eindringlinge an. "
            "Sie testen Hypothesen darüber, ob der Trupp hierher gehört. "
            "Das Testen involviert Elektrizität."
        ),
        combat_encounter_id="prometheus_sparks_spawn",
    ),
    EncounterTemplate(
        id="prometheus_sentinel_watch",
        archetype="The Prometheus",
        room_type="combat",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "An Alloy Sentinel stands at the corridor's center. Its surface "
            "reflects the party in distorted miniature \u2013 improved, somehow. "
            "Beside it, a Spark Wisp orbits in a figure-eight pattern, "
            "relaying data the sentinel does not appear to need. "
            "The sentinel's posture is not aggressive. It is procedural."
        ),
        description_de=(
            "Ein Legierungswächter steht in der Mitte des Korridors. Seine "
            "Oberfläche spiegelt den Trupp in verzerrter Miniatur \u2013 irgendwie "
            "verbessert. Daneben umkreist ein Funkenglimmer ihn in einer "
            "Achterschleife, übermittelt Daten, die der Wächter nicht zu "
            "benötigen scheint. Die Haltung des Wächters ist nicht aggressiv. "
            "Sie ist prozedural."
        ),
        combat_encounter_id="prometheus_workshop_patrol_spawn",
    ),
    EncounterTemplate(
        id="prometheus_construct_gallery",
        archetype="The Prometheus",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A gallery of unfinished constructs lines the walls. Most are inert. "
            "Two are not. A Crucible Drake \u2013 molten flux in a shape that "
            "suggests intent \u2013 circles a workbench. An Automaton Shard "
            "clicks and rotates, as if trying to remember what it was "
            "supposed to be. They notice the party simultaneously. "
            "The Drake exhales fumes that smell like unfinished thoughts."
        ),
        description_de=(
            "Eine Galerie unfertiger Konstrukte säumt die Wände. Die meisten sind "
            "inert. Zwei nicht. Ein Tiegeldrache \u2013 geschmolzenes Flussmittel in "
            "einer Form, die Absicht suggeriert \u2013 umkreist eine Werkbank. Ein "
            "Automatensplitter klickt und dreht sich, als versuche er sich zu "
            "erinnern, was er sein sollte. Sie bemerken den Trupp gleichzeitig. "
            "Der Drache atmet Dämpfe aus, die nach unfertigen Gedanken riechen."
        ),
        combat_encounter_id="prometheus_construct_pair_spawn",
    ),
    EncounterTemplate(
        id="prometheus_residue_chamber",
        archetype="The Prometheus",
        room_type="combat",
        min_depth=3,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The floor is covered in slag \u2013 the residue of a hundred failed "
            "experiments. The residue has opinions. A Slag Golem rises from the "
            "detritus, not so much assembled as accreted. Two Spark Wisps orbit "
            "it, drawn to the heat it still radiates. The golem does not "
            "attack. It obstructs. It is, after all, the accumulated evidence "
            "of everything the workshop has tried and failed."
        ),
        description_de=(
            "Der Boden ist bedeckt mit Schlacke \u2013 dem Rückstand von hundert "
            "gescheiterten Experimenten. Der Rückstand hat Meinungen. Ein "
            "Schlackengolem erhebt sich aus dem Detritus, nicht so sehr "
            "zusammengebaut als vielmehr angelagert. Zwei Funkenglimmer umkreisen "
            "ihn, angezogen von der Hitze, die er noch abstrahlt. Der Golem "
            "greift nicht an. Er obstruiert. Er ist, immerhin, der akkumulierte "
            "Beweis für alles, was die Werkstatt versucht und nicht geschafft hat."
        ),
        combat_encounter_id="prometheus_residue_spawn",
    ),
]


# ── Prometheus Narrative Encounters (5: 3 workshop + 2 invention) ────────

PROMETHEUS_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    # ── Workshop Discovery: Reagent Cache ──
    EncounterTemplate(
        id="prometheus_reagent_cache",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A workbench, preserved in amber light. Drawers half-open. "
            "Inside: materials sorted by a system you do not yet understand "
            "but somehow recognize. Metal filings in one drawer. A sealed "
            "vial of fluid in another. A crystal formation growing from the "
            "third. The workshop is offering inventory."
        ),
        description_de=(
            "Eine Werkbank, in Bernsteinlicht konserviert. Schubladen halb offen. "
            "Darin: Materialien, sortiert nach einem System, das ihr noch nicht "
            "versteht, aber irgendwie wiedererkennt. Metallspäne in einer Schublade. "
            "Ein versiegeltes Fläschchen Flüssigkeit in einer anderen. Eine "
            "Kristallformation, die aus der dritten wächst. "
            "Die Werkstatt bietet Inventar an."
        ),
        choices=[
            EncounterChoice(
                id="reagent_take_metal",
                label_en="Extract the metal filings (Saboteur)",
                label_de="Die Metallspäne entnehmen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=-5,
                success_effects={
                    "add_component": {
                        "id": "comp_workshop_metal",
                        "name_en": "Workshop Metal Filings",
                        "name_de": "Werkstatt-Metallspäne",
                        "type": "metal",
                    },
                    "insight": 5,
                },
                partial_effects={"insight": 2, "stress": 15},
                fail_effects={"stress": 25},
                success_narrative_en=(
                    "The filings separate from the drawer as if they had been waiting. "
                    "They are heavier than they should be. Denser. "
                    "As if the metal remembers being something more."
                ),
                success_narrative_de=(
                    "Die Späne lösen sich aus der Schublade, als hätten sie gewartet. "
                    "Sie sind schwerer, als sie sein sollten. Dichter. "
                    "Als erinnere sich das Metall, etwas mehr gewesen zu sein."
                ),
                fail_narrative_en=(
                    "The filings scatter. Not randomly \u2013 they form a pattern on the "
                    "floor that {agent} cannot read. The workshop is disappointed."
                ),
                fail_narrative_de=(
                    "Die Späne zerstreuen sich. Nicht zufällig \u2013 sie bilden ein Muster "
                    "auf dem Boden, das {agent} nicht lesen kann. "
                    "Die Werkstatt ist enttäuscht."
                ),
            ),
            EncounterChoice(
                id="reagent_take_fluid",
                label_en="Secure the sealed fluid (Spy)",
                label_de="Die versiegelte Flüssigkeit sichern (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={
                    "add_component": {
                        "id": "comp_workshop_fluid",
                        "name_en": "Sealed Workshop Fluid",
                        "name_de": "Versiegelte Werkstattflüssigkeit",
                        "type": "fluid",
                    },
                    "insight": 5,
                },
                partial_effects={"insight": 2, "stress": 15},
                fail_effects={"stress": 25},
                success_narrative_en=(
                    "The vial is warm. The fluid inside shifts in response to "
                    "{agent}'s touch \u2013 not away, but toward. It wants to merge."
                ),
                success_narrative_de=(
                    "Das Fläschchen ist warm. Die Flüssigkeit darin reagiert auf "
                    "{agent}s Berührung \u2013 nicht weg, sondern hin. Sie will verschmelzen."
                ),
                fail_narrative_en=(
                    "The seal resists. Inside, the fluid settles into stillness. "
                    "It has decided {agent} is not ready."
                ),
                fail_narrative_de=(
                    "Das Siegel widersteht. Darin kommt die Flüssigkeit zur Ruhe. "
                    "Sie hat entschieden, dass {agent} nicht bereit ist."
                ),
            ),
            EncounterChoice(
                id="reagent_take_crystal",
                label_en="Harvest the crystal formation (Infiltrator)",
                label_de="Die Kristallformation ernten (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=-5,
                success_effects={
                    "add_component": {
                        "id": "comp_workshop_crystal",
                        "name_en": "Workshop Crystal",
                        "name_de": "Werkstattkristall",
                        "type": "crystal",
                    },
                    "insight": 5,
                },
                partial_effects={"insight": 2, "stress": 15},
                fail_effects={"stress": 25},
                success_narrative_en=(
                    "The crystal separates with a clean, precise fracture. "
                    "It vibrates at a frequency {agent}'s instruments can detect "
                    "but not identify. A tuning fork for something unnamed."
                ),
                success_narrative_de=(
                    "Der Kristall löst sich mit einem sauberen, präzisen Bruch. "
                    "Er vibriert auf einer Frequenz, die {agent}s Instrumente "
                    "erkennen, aber nicht identifizieren können. "
                    "Eine Stimmgabel für etwas Unbenanntes."
                ),
                fail_narrative_en=(
                    "The crystal shatters precisely. Every shard is identical. "
                    "The workshop has demonstrated the concept of replication."
                ),
                fail_narrative_de=(
                    "Der Kristall zersplittert präzise. Jeder Splitter ist identisch. "
                    "Die Werkstatt hat das Konzept der Replikation demonstriert."
                ),
            ),
        ],
    ),
    # ── Workshop Discovery: Energy Conduit ──
    EncounterTemplate(
        id="prometheus_energy_conduit",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A conduit runs through the ceiling, pulsing with contained energy. "
            "At one point, the casing has cracked. The energy seeps through, "
            "illuminating dust particles in geometric patterns. "
            "The patterns are not random. They are diagrams. "
            "The energy is explaining itself."
        ),
        description_de=(
            "Eine Leitung verläuft durch die Decke, pulsierend mit eingedämmter "
            "Energie. An einer Stelle ist die Ummantelung gerissen. Die Energie "
            "sickert durch, beleuchtet Staubpartikel in geometrischen Mustern. "
            "Die Muster sind nicht zufällig. Sie sind Diagramme. "
            "Die Energie erklärt sich selbst."
        ),
        choices=[
            EncounterChoice(
                id="conduit_tap",
                label_en="Tap the energy flow (Saboteur)",
                label_de="Den Energiefluss anzapfen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=0,
                success_effects={
                    "add_component": {
                        "id": "comp_energy_tap",
                        "name_en": "Contained Energy Cell",
                        "name_de": "Eingedämmte Energiezelle",
                        "type": "energy",
                    },
                    "insight": 8,
                },
                partial_effects={"insight": 4, "stress": 20},
                fail_effects={"stress": 40, "insight": -5},
                success_narrative_en=(
                    "The energy flows into the containment. Not reluctantly \u2013 "
                    "eagerly. It wanted to be portable. It wanted to be used."
                ),
                success_narrative_de=(
                    "Die Energie fließt in die Eindämmung. Nicht widerwillig \u2013 "
                    "eifrig. Sie wollte tragbar sein. Sie wollte benutzt werden."
                ),
                fail_narrative_en=(
                    "The energy arcs. {agent}'s instruments spike. "
                    "The conduit seals itself \u2013 offended, perhaps."
                ),
                fail_narrative_de=(
                    "Die Energie entlädt sich. {agent}s Instrumente schlagen aus. "
                    "Die Leitung versiegelt sich selbst \u2013 beleidigt, vielleicht."
                ),
            ),
            EncounterChoice(
                id="conduit_study",
                label_en="Study the geometric patterns (Spy)",
                label_de="Die geometrischen Muster studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 10, "reveal_rooms": 1},
                partial_effects={"insight": 5},
                fail_effects={"stress": 25, "insight": -3},
                success_narrative_en=(
                    "The diagrams resolve. They are a map \u2013 not of this place, "
                    "but of what this place will produce. The workshop has shown "
                    "you its blueprint."
                ),
                success_narrative_de=(
                    "Die Diagramme klären sich. Sie sind eine Karte \u2013 nicht "
                    "von diesem Ort, sondern von dem, was dieser Ort hervorbringen "
                    "wird. Die Werkstatt hat euch ihre Blaupause gezeigt."
                ),
                fail_narrative_en=(
                    "The patterns move faster than {agent} can process. "
                    "The energy is speaking a language you almost know."
                ),
                fail_narrative_de=(
                    "Die Muster bewegen sich schneller, als {agent} verarbeiten kann. "
                    "Die Energie spricht eine Sprache, die ihr beinahe kennt."
                ),
            ),
        ],
    ),
    # ── Crafting Workshop: The Crucible ──
    EncounterTemplate(
        id="prometheus_the_crucible",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A crucible stands at the room's center. It is already hot. "
            "Around it, components from the workshop's deeper chambers have "
            "arranged themselves in a semicircle, as if presenting options. "
            "The crucible does not wait. It suggests."
        ),
        description_de=(
            "Ein Tiegel steht in der Raummitte. Er ist bereits heiß. "
            "Um ihn herum haben sich Komponenten aus den tieferen Kammern "
            "der Werkstatt in einem Halbkreis angeordnet, als präsentierten "
            "sie Optionen. Der Tiegel wartet nicht. Er schlägt vor."
        ),
        choices=[
            EncounterChoice(
                id="crucible_combine",
                label_en="Attempt a combination in the crucible (Saboteur)",
                label_de="Eine Kombination im Tiegel versuchen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={
                    "remove_components": ["comp_workshop_metal", "comp_workshop_fluid"],
                    "add_crafted_item": {
                        "id": "craft_tempered_alloy",
                        "name_en": "Tempered Flux Alloy",
                        "name_de": "Gehärtete Flussmittellegierung",
                        "benefit_en": "Reduces incoming condition damage by 1 step for 3 rounds",
                        "benefit_de": "Reduziert eingehenden Zustandsschaden um 1 Stufe für 3 Runden",
                        "cost_en": "The alloy resonates \u2013 +15 stress to the wielder",
                        "cost_de": "Die Legierung resoniert \u2013 +15 Stress für den Träger",
                        "boss_effect": {"type": "reduce_stress_attack", "value": 2},
                    },
                    "insight": 8,
                },
                partial_effects={"insight": 4, "stress": 20, "craft_failed": True},
                fail_effects={"stress": 35, "insight": 4, "craft_failed": True},
                success_narrative_en=(
                    "The metal meets the fluid. For a moment, nothing. Then: heat. "
                    "Then: light. Then: something that was not there before. "
                    "The alloy holds. Stronger than either component alone. "
                    "But it resonates at a frequency that sets {agent}'s "
                    "instruments to trembling."
                ),
                success_narrative_de=(
                    "Das Metall trifft die Flüssigkeit. Einen Moment lang nichts. "
                    "Dann: Hitze. Dann: Licht. Dann: etwas, das vorher nicht da war. "
                    "Die Legierung hält. Stärker als beide Komponenten allein. "
                    "Aber sie resoniert auf einer Frequenz, die {agent}s "
                    "Instrumente zum Zittern bringt."
                ),
                partial_narrative_en=(
                    "The components merge \u2013 partially. The alloy is uneven, "
                    "useful as raw material but not as a tool. "
                    "The residue, though? The residue is interesting."
                ),
                partial_narrative_de=(
                    "Die Komponenten verschmelzen \u2013 teilweise. Die Legierung ist "
                    "ungleichmäßig, brauchbar als Rohmaterial, aber nicht als Werkzeug. "
                    "Der Rückstand allerdings? Der Rückstand ist interessant."
                ),
                fail_narrative_en=(
                    "The crucible rejects the combination. The components are consumed "
                    "anyway \u2013 matter does not return to its previous state. "
                    "But {agent} learned something about what doesn't work. "
                    "This, too, is data."
                ),
                fail_narrative_de=(
                    "Der Tiegel verwirft die Kombination. Die Komponenten werden "
                    "trotzdem verbraucht \u2013 Materie kehrt nicht in ihren vorherigen "
                    "Zustand zurück. Aber {agent} hat etwas darüber gelernt, "
                    "was nicht funktioniert. Auch das sind Daten."
                ),
            ),
            EncounterChoice(
                id="crucible_observe",
                label_en="Study the crucible's behavior without using it (Spy)",
                label_de="Das Verhalten des Tiegels studieren, ohne ihn zu benutzen (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 8, "discovery": True},
                partial_effects={"insight": 4},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "You observe. The crucible runs through phantom combinations \u2013 "
                    "heating, mixing, testing invisible reagents. It has been doing "
                    "this for a long time. It has opinions about what works."
                ),
                success_narrative_de=(
                    "Ihr beobachtet. Der Tiegel führt Phantomkombinationen durch \u2013 "
                    "erhitzt, mischt, testet unsichtbare Reagenzien. Er tut dies seit "
                    "langer Zeit. Er hat Meinungen darüber, was funktioniert."
                ),
                fail_narrative_en="The crucible goes silent. It does not perform for audiences.",
                fail_narrative_de="Der Tiegel verstummt. Er führt nicht für Zuschauer vor.",
            ),
        ],
    ),
    # ── Invention Challenge: The Living Blueprint ──
    EncounterTemplate(
        id="prometheus_living_blueprint",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "On the wall: a blueprint. It is moving. Lines redraw themselves. "
            "Annotations appear and are crossed out by other annotations. "
            "The blueprint is arguing with itself about the best way to build "
            "something that has never existed. It does not acknowledge the party. "
            "It is too busy being a thought that thinks."
        ),
        description_de=(
            "An der Wand: eine Blaupause. Sie bewegt sich. Linien zeichnen sich "
            "neu. Anmerkungen erscheinen und werden von anderen Anmerkungen "
            "durchgestrichen. Die Blaupause streitet mit sich selbst über den "
            "besten Weg, etwas zu bauen, das nie existiert hat. Sie nimmt den "
            "Trupp nicht zur Kenntnis. Sie ist zu beschäftigt damit, ein Gedanke "
            "zu sein, der denkt."
        ),
        choices=[
            EncounterChoice(
                id="blueprint_contribute",
                label_en="Add to the blueprint (Saboteur)",
                label_de="Zur Blaupause beitragen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={"insight": 12, "stress_heal": 20},
                partial_effects={"insight": 6},
                fail_effects={"stress": 30, "insight": -5},
                success_narrative_en=(
                    "{agent} adds a line. The blueprint pauses. Considers. "
                    "Accepts. The annotations stop arguing. For a moment, "
                    "the blueprint achieves coherence. It is beautiful."
                ),
                success_narrative_de=(
                    "{agent} fügt eine Linie hinzu. Die Blaupause hält inne. "
                    "Erwägt. Akzeptiert. Die Anmerkungen hören auf zu streiten. "
                    "Für einen Moment erreicht die Blaupause Kohärenz. "
                    "Es ist schön."
                ),
                fail_narrative_en=(
                    "The blueprint rejects {agent}'s contribution with a sharp "
                    "erasure. The annotations resume with renewed intensity. "
                    "The blueprint has added a note: 'NOT THIS.'"
                ),
                fail_narrative_de=(
                    "Die Blaupause verwirft {agent}s Beitrag mit einer scharfen "
                    "Löschung. Die Anmerkungen setzen mit erneuter Intensität ein. "
                    "Die Blaupause hat eine Notiz hinzugefügt: »NICHT DAS.«"
                ),
            ),
            EncounterChoice(
                id="blueprint_copy",
                label_en="Copy the blueprint's current state (Spy)",
                label_de="Den aktuellen Zustand der Blaupause kopieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 8, "reveal_rooms": 1},
                partial_effects={"insight": 4},
                fail_effects={"stress": 15},
                success_narrative_en=(
                    "You capture a snapshot. By the time you look up, the blueprint "
                    "has changed. But the snapshot is enough \u2013 it shows the "
                    "workshop's intended layout. Briefly, you know where things are."
                ),
                success_narrative_de=(
                    "Ihr erfasst einen Schnappschuss. Als ihr aufblickt, hat sich "
                    "die Blaupause geändert. Aber der Schnappschuss reicht \u2013 er "
                    "zeigt das beabsichtigte Layout der Werkstatt. Kurz wisst ihr, "
                    "wo die Dinge sind."
                ),
                fail_narrative_en="The blueprint moves too fast. Every copy is already outdated.",
                fail_narrative_de="Die Blaupause bewegt sich zu schnell. Jede Kopie ist bereits veraltet.",
            ),
        ],
    ),
    # ── Invention Challenge: The Failed Experiment ──
    EncounterTemplate(
        id="prometheus_failed_experiment",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The room contains the aftermath of an experiment that did not "
            "go as planned. Scorch marks radiate from a central point. "
            "Components are fused into the walls. A half-formed construct "
            "twitches on the floor, caught between activation and entropy. "
            "The failure is recent. The workshop has not cleaned up yet. "
            "Perhaps it is waiting for a second opinion."
        ),
        description_de=(
            "Der Raum enthält das Ergebnis eines Experiments, das nicht nach "
            "Plan verlief. Brandspuren strahlen von einem zentralen Punkt aus. "
            "Komponenten sind in die Wände geschmolzen. Ein halbgeformtes "
            "Konstrukt zuckt am Boden, gefangen zwischen Aktivierung und "
            "Entropie. Das Scheitern ist frisch. Die Werkstatt hat noch nicht "
            "aufgeräumt. Vielleicht wartet sie auf eine zweite Meinung."
        ),
        choices=[
            EncounterChoice(
                id="failed_salvage",
                label_en="Salvage usable components from the wreckage (Saboteur)",
                label_de="Brauchbare Komponenten aus dem Wrack bergen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={
                    "add_component": {
                        "id": "comp_salvaged_powder",
                        "name_en": "Catalytic Residue Powder",
                        "name_de": "Katalytisches Rückstandspulver",
                        "type": "powder",
                    },
                    "insight": 6,
                },
                partial_effects={"insight": 3, "stress": 20},
                fail_effects={"stress": 40, "insight": -3},
                success_narrative_en=(
                    "Among the wreckage: a powder that catalyzes on contact. "
                    "The failed experiment produced it as a byproduct. "
                    "The workshop did not fail \u2013 it discovered something "
                    "it wasn't looking for."
                ),
                success_narrative_de=(
                    "Im Wrack: ein Pulver, das bei Kontakt katalysiert. "
                    "Das gescheiterte Experiment hat es als Nebenprodukt erzeugt. "
                    "Die Werkstatt hat nicht versagt \u2013 sie hat etwas entdeckt, "
                    "wonach sie nicht gesucht hat."
                ),
                fail_narrative_en=(
                    "The wreckage shifts. Components you thought were inert "
                    "react to {agent}'s touch. Not helpfully."
                ),
                fail_narrative_de=(
                    "Das Wrack verschiebt sich. Komponenten, die ihr für inert "
                    "hieltet, reagieren auf {agent}s Berührung. Nicht hilfreich."
                ),
            ),
            EncounterChoice(
                id="failed_analyze",
                label_en="Analyze what went wrong (Spy)",
                label_de="Analysieren, was schiefgelaufen ist (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"insight": 10, "discovery": True},
                partial_effects={"insight": 5},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "The failure had a cause. The cause is instructive. "
                    "{agent} catalogs the sequence: component, catalyst, "
                    "interaction, detonation. Understanding failure IS understanding."
                ),
                success_narrative_de=(
                    "Das Scheitern hatte eine Ursache. Die Ursache ist lehrreich. "
                    "{agent} katalogisiert die Sequenz: Komponente, Katalysator, "
                    "Interaktion, Detonation. Scheitern zu verstehen IST Verstehen."
                ),
                fail_narrative_en="The sequence is too complex. Or {agent} is too simple. The experiment offers no comment.",
                fail_narrative_de="Die Sequenz ist zu komplex. Oder {agent} ist zu einfach. Das Experiment kommentiert nicht.",
            ),
            EncounterChoice(
                id="failed_retreat",
                label_en="Leave the disaster undisturbed",
                label_de="Die Katastrophe ungestört lassen",
                success_effects={"insight": 2},
                success_narrative_en="You leave. The half-formed construct twitches once more, then stills. Waiting.",
                success_narrative_de="Ihr geht. Das halbgeformte Konstrukt zuckt noch einmal, dann erstarrt es. Wartend.",
            ),
        ],
    ),
    # ── Crafting Workshop: The Resonance Forge ──
    EncounterTemplate(
        id="prometheus_resonance_forge",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A device occupies the room's center \u2013 part tuning fork, part "
            "lens array, part something that has no name in any language the "
            "party speaks. It vibrates at a frequency just below hearing. "
            "Crystal and energy conduits feed into it from opposite walls, "
            "converging at a focal point that bends light into a shape "
            "resembling intent. The device is waiting to be aimed."
        ),
        description_de=(
            "Ein Gerät nimmt die Raummitte ein \u2013 teils Stimmgabel, teils "
            "Linsenarray, teils etwas, das in keiner Sprache, die der Trupp "
            "spricht, einen Namen hat. Es vibriert auf einer Frequenz knapp "
            "unterhalb des Hörbaren. Kristall- und Energieleitungen speisen "
            "es von gegenüberliegenden Wänden, konvergierend an einem "
            "Brennpunkt, der Licht in eine Form biegt, die Absicht ähnelt. "
            "Das Gerät wartet darauf, ausgerichtet zu werden."
        ),
        choices=[
            EncounterChoice(
                id="resonance_forge_combine",
                label_en="Focus crystal through the energy conduit (Saboteur)",
                label_de="Den Kristall durch die Energieleitung fokussieren (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={
                    "remove_components": ["comp_workshop_crystal", "comp_energy_tap"],
                    "add_crafted_item": {
                        "id": "craft_resonance_disruptor",
                        "name_en": "Resonance Disruptor",
                        "name_de": "Resonanzbrecher",
                        "benefit_en": "Emits a frequency that disrupts construct defenses",
                        "benefit_de": "Sendet eine Frequenz, die Konstruktabwehr stört",
                        "cost_en": "The frequency is not selective \u2013 +20 stress to all agents",
                        "cost_de": "Die Frequenz ist nicht selektiv \u2013 +20 Stress für alle Agenten",
                        "boss_effect": {"type": "add_vulnerability", "value": 1, "school": "saboteur"},
                    },
                    "insight": 10,
                },
                partial_effects={"insight": 5, "stress": 25, "craft_failed": True},
                fail_effects={"stress": 40, "insight": 4, "craft_failed": True},
                success_narrative_en=(
                    "The crystal shatters \u2013 not into fragments, but into frequency. "
                    "The energy conduit amplifies it, shapes it, gives it purpose. "
                    "What remains is a device that hums with directed intent. "
                    "Ted Chiang's principle: the right combination of signs "
                    "equals function. {agent} has found the right signs."
                ),
                success_narrative_de=(
                    "Der Kristall zerbricht \u2013 nicht in Splitter, sondern in Frequenz. "
                    "Die Energieleitung verstärkt sie, formt sie, gibt ihr Zweck. "
                    "Was bleibt, ist ein Gerät, das mit gerichteter Absicht summt. "
                    "Chiangs Prinzip: die richtige Kombination von Zeichen "
                    "gleicht Funktion. {agent} hat die richtigen Zeichen gefunden."
                ),
                partial_narrative_en=(
                    "The crystal fractures asymmetrically. The frequency scatters "
                    "instead of focusing. Components consumed, nothing gained. "
                    "But the scatter pattern is instructive."
                ),
                partial_narrative_de=(
                    "Der Kristall bricht asymmetrisch. Die Frequenz streut, statt "
                    "sich zu fokussieren. Komponenten verbraucht, nichts gewonnen. "
                    "Aber das Streumuster ist lehrreich."
                ),
                fail_narrative_en=(
                    "The energy arcs through the crystal and into {agent}. "
                    "The device produces sound, not function. "
                    "The workshop hums in what might be disappointment."
                ),
                fail_narrative_de=(
                    "Die Energie fährt durch den Kristall und in {agent}. "
                    "Das Gerät erzeugt Klang, nicht Funktion. "
                    "Die Werkstatt summt in etwas, das Enttäuschung sein könnte."
                ),
            ),
            EncounterChoice(
                id="resonance_forge_study",
                label_en="Study the device's harmonic properties (Spy)",
                label_de="Die harmonischen Eigenschaften des Geräts studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 8},
                partial_effects={"insight": 4},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "The device's frequency resolves into data. Not sound \u2013 "
                    "information. {agent} catalogs the harmonics. The workshop "
                    "has been singing this song for a long time."
                ),
                success_narrative_de=(
                    "Die Frequenz des Geräts löst sich in Daten auf. Nicht Klang \u2013 "
                    "Information. {agent} katalogisiert die Harmonien. Die Werkstatt "
                    "singt dieses Lied schon lange."
                ),
                fail_narrative_en="The harmonics are beyond {agent}'s range. Some songs are not for human ears.",
                fail_narrative_de="Die Harmonien liegen jenseits von {agent}s Bereich. Manche Lieder sind nicht für menschliche Ohren.",
            ),
        ],
    ),
    # ── Crafting Workshop: The Dissolution Bath ──
    EncounterTemplate(
        id="prometheus_dissolution_bath",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A basin of liquid occupies a stone plinth. The liquid is not "
            "water. It moves against itself \u2013 currents without wind, waves "
            "without shore. Beside the basin: a mortar containing powder "
            "residue, and grooves in the stone that suggest a precise "
            "pouring sequence. The liquid watches the party. Süskind's "
            "Grenouille would have understood: some dissolutions reveal "
            "what was always there."
        ),
        description_de=(
            "Ein Becken mit Flüssigkeit ruht auf einem Steinsockel. Die "
            "Flüssigkeit ist kein Wasser. Sie bewegt sich gegen sich selbst "
            "\u2013 Strömungen ohne Wind, Wellen ohne Ufer. Neben dem Becken: "
            "ein Mörser mit Pulverrückstand und Rillen im Stein, die eine "
            "präzise Gießsequenz nahelegen. Die Flüssigkeit beobachtet den "
            "Trupp. Süskinds Grenouille hätte verstanden: manche Auflösungen "
            "enthüllen, was immer schon da war."
        ),
        choices=[
            EncounterChoice(
                id="dissolution_combine",
                label_en="Dissolve the powder into the reactive fluid (Saboteur)",
                label_de="Das Pulver in der reaktiven Flüssigkeit auflösen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={
                    "remove_components": ["comp_workshop_fluid", "comp_salvaged_powder"],
                    "add_crafted_item": {
                        "id": "craft_catalytic_solvent",
                        "name_en": "Catalytic Solvent",
                        "name_de": "Katalytisches Lösungsmittel",
                        "benefit_en": "Corrodes construct plating, reducing evasion",
                        "benefit_de": "Korrodiert Konstruktpanzerung, reduziert Ausweichen",
                        "cost_en": "Fumes cause disorientation \u2013 +20 stress to all agents",
                        "cost_de": "Dämpfe verursachen Desorientierung \u2013 +20 Stress für alle Agenten",
                        "boss_effect": {"type": "reduce_evasion", "value": 10},
                    },
                    "insight": 10,
                },
                partial_effects={"insight": 5, "stress": 25, "craft_failed": True},
                fail_effects={"stress": 40, "insight": 4, "craft_failed": True},
                success_narrative_en=(
                    "The powder dissolves. Not gradually \u2013 eagerly. The fluid "
                    "changes color twice before settling into something that "
                    "is not a color but a property. The solvent does not destroy. "
                    "It reveals. It strips away what is not essential until only "
                    "the vulnerable truth remains."
                ),
                success_narrative_de=(
                    "Das Pulver löst sich. Nicht allmählich \u2013 eifrig. Die Flüssigkeit "
                    "wechselt zweimal die Farbe, bevor sie sich in etwas niederlässt, "
                    "das keine Farbe ist, sondern eine Eigenschaft. Das Lösungsmittel "
                    "zerstört nicht. Es enthüllt. Es streift ab, was nicht wesentlich "
                    "ist, bis nur die verwundbare Wahrheit bleibt."
                ),
                partial_narrative_en=(
                    "The dissolution is incomplete. The fluid accepts the powder "
                    "but refuses to change. Components consumed, lesson retained."
                ),
                partial_narrative_de=(
                    "Die Auflösung ist unvollständig. Die Flüssigkeit nimmt das "
                    "Pulver an, weigert sich aber zu verändern. Komponenten "
                    "verbraucht, Lektion behalten."
                ),
                fail_narrative_en=(
                    "The fluid recoils. The powder floats, undissolved, "
                    "mocking {agent}'s proportions. Levi would note: the reaction "
                    "tells you as much about yourself as about the reagent."
                ),
                fail_narrative_de=(
                    "Die Flüssigkeit weicht zurück. Das Pulver schwimmt, ungelöst, "
                    "{agent}s Proportionen verspottend. Levi würde anmerken: die "
                    "Reaktion verrät ebenso viel über einen selbst wie über das Reagenz."
                ),
            ),
            EncounterChoice(
                id="dissolution_observe",
                label_en="Analyze the fluid's reactive properties (Spy)",
                label_de="Die reaktiven Eigenschaften der Flüssigkeit analysieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 8},
                partial_effects={"insight": 4},
                fail_effects={"stress": 15},
                success_narrative_en=(
                    "The fluid has memory. {agent} observes it cycling through "
                    "phantom reactions \u2013 dissolutions it has performed before, "
                    "preserved in its molecular structure like scars."
                ),
                success_narrative_de=(
                    "{agent} beobachtet die Flüssigkeit beim Durchlaufen von "
                    "Phantomreaktionen \u2013 Auflösungen, die sie zuvor durchgeführt hat, "
                    "konserviert in ihrer Molekularstruktur wie Narben."
                ),
                fail_narrative_en="The fluid goes still. It does not perform for the unprepared.",
                fail_narrative_de="Die Flüssigkeit erstarrt. Sie führt nicht für Unvorbereitete vor.",
            ),
        ],
    ),
    # ── Crafting Workshop: The Dampening Press ──
    EncounterTemplate(
        id="prometheus_dampening_press",
        archetype="The Prometheus",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "A press of dark metal occupies the far wall. Two intake channels "
            "converge at its center: one accepts metal, the other conducts "
            "energy. The press does not forge \u2013 it absorbs. Jünger's "
            "Gläserne Bienen described machines that consumed motion itself. "
            "This press consumes force. It takes kinetic intention and "
            "wraps it in metal until the violence forgets what it was for."
        ),
        description_de=(
            "Eine Presse aus dunklem Metall nimmt die hintere Wand ein. Zwei "
            "Einlasskanäle konvergieren in ihrer Mitte: einer nimmt Metall auf, "
            "der andere leitet Energie. Die Presse schmiedet nicht \u2013 sie "
            "absorbiert. Jüngers Gläserne Bienen beschrieben Maschinen, die "
            "Bewegung selbst konsumierten. Diese Presse konsumiert Kraft. Sie "
            "nimmt kinetische Absicht und wickelt sie in Metall, bis die "
            "Gewalt vergisst, wofür sie bestimmt war."
        ),
        choices=[
            EncounterChoice(
                id="dampening_combine",
                label_en="Feed metal and energy into the press (Saboteur)",
                label_de="Metall und Energie in die Presse einspeisen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=5,
                success_effects={
                    "remove_components": ["comp_workshop_metal", "comp_vault_energy"],
                    "add_crafted_item": {
                        "id": "craft_dampening_coil",
                        "name_en": "Dampening Coil",
                        "name_de": "Dämpfungsspule",
                        "benefit_en": "Absorbs kinetic force, weakening construct attacks",
                        "benefit_de": "Absorbiert kinetische Kraft, schwächt Konstruktangriffe",
                        "cost_en": "The absorbed energy must go somewhere \u2013 +25 stress to wielder",
                        "cost_de": "Die absorbierte Energie muss irgendwohin \u2013 +25 Stress für den Träger",
                        "boss_effect": {"type": "reduce_attack_power", "value": 2},
                    },
                    "insight": 10,
                },
                partial_effects={"insight": 5, "stress": 30, "craft_failed": True},
                fail_effects={"stress": 45, "insight": 4, "craft_failed": True},
                success_narrative_en=(
                    "The press accepts the offering. Metal wraps around energy "
                    "in a spiral that tightens beyond physical possibility. "
                    "What emerges is a coil that hums with contained violence \u2013 "
                    "not its own, but the violence it has already absorbed in "
                    "the act of being made. Hephaestus forging a shield: "
                    "the defense is born from captured offense."
                ),
                success_narrative_de=(
                    "Die Presse nimmt die Gabe an. Metall wickelt sich um Energie "
                    "in einer Spirale, die sich über physische Möglichkeit hinaus "
                    "verengt. Was hervorkommt, ist eine Spule, die mit eingedämmter "
                    "Gewalt summt \u2013 nicht ihrer eigenen, sondern der Gewalt, die "
                    "sie bereits im Akt ihrer Erschaffung absorbiert hat. "
                    "Hephaistos, der einen Schild schmiedet: die Verteidigung "
                    "entsteht aus gefangener Offensive."
                ),
                partial_narrative_en=(
                    "The press compresses, but the coil is loose. It absorbs "
                    "ambient vibration, not directed force. The components "
                    "merge imprecisely. Daedalus built wings; this is a feather."
                ),
                partial_narrative_de=(
                    "Die Presse komprimiert, aber die Spule ist locker. Sie "
                    "absorbiert Umgebungsvibrationen, nicht gerichtete Kraft. Die "
                    "Komponenten verschmelzen unpräzise. Daedalus baute Flügel; "
                    "dies ist eine Feder."
                ),
                fail_narrative_en=(
                    "The energy rejects the metal. The press shudders and "
                    "releases both components in a state neither recognizes. "
                    "{agent} backs away. The workshop has demonstrated "
                    "the concept of incompatibility."
                ),
                fail_narrative_de=(
                    "Die Energie weist das Metall zurück. Die Presse schaudert "
                    "und gibt beide Komponenten in einem Zustand frei, den "
                    "keiner der beiden wiedererkennt. {agent} weicht zurück. Die "
                    "Werkstatt hat das Konzept der Inkompatibilität demonstriert."
                ),
            ),
            EncounterChoice(
                id="dampening_study",
                label_en="Study the press's absorption mechanism (Spy)",
                label_de="Den Absorptionsmechanismus der Presse studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"insight": 8},
                partial_effects={"insight": 4},
                fail_effects={"stress": 15},
                success_narrative_en=(
                    "The press cycles through phantom compressions \u2013 absorbing "
                    "forces that are no longer there. {agent} catalogs the patterns. "
                    "The press remembers every force it has ever contained."
                ),
                success_narrative_de=(
                    "Die Presse durchläuft Phantomkompressionen \u2013 absorbiert "
                    "Kräfte, die nicht mehr da sind. {agent} katalogisiert die Muster. "
                    "Die Presse erinnert sich an jede Kraft, die sie je eingedämmt hat."
                ),
                fail_narrative_en="The press goes dormant. It does not demonstrate for observers.",
                fail_narrative_de="Die Presse fällt in Ruhezustand. Sie demonstriert nicht für Beobachter.",
            ),
        ],
    ),
]


# ── Prometheus Elite Encounters (1) ──────────────────────────────────────

PROMETHEUS_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="prometheus_forge_wraith_lair",
        archetype="The Prometheus",
        room_type="elite",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "An anvil that exists in two states simultaneously: hot and cold, "
            "present and absent. A Forge Wraith works at it \u2013 smoke and metal "
            "in the shape of a craftsman who cannot stop. A Spark Wisp orbits, "
            "fetching tools from shelves that the party cannot see. "
            "The Wraith does not stop when it notices you. "
            "It incorporates your presence into its workflow."
        ),
        description_de=(
            "Ein Amboss, der in zwei Zuständen gleichzeitig existiert: heiß und "
            "kalt, anwesend und abwesend. Ein Schmiedewraith arbeitet daran \u2013 "
            "Rauch und Metall in der Form eines Handwerkers, der nicht aufhören "
            "kann. Ein Funkenglimmer umkreist ihn, holt Werkzeuge von Regalen, "
            "die der Trupp nicht sehen kann. Das Wraith hält nicht inne, als es "
            "euch bemerkt. Es bezieht eure Anwesenheit in seinen Arbeitsablauf ein."
        ),
        combat_encounter_id="prometheus_forge_elite_spawn",
    ),
]


# ── Prometheus Boss Encounter (1) ────────────────────────────────────────

PROMETHEUS_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="prometheus_the_prototype_encounter",
        archetype="The Prometheus",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The final chamber is a workshop within a workshop. At its center: "
            "The Prototype. It was supposed to be the masterwork \u2013 the "
            "culmination of every experiment, every failed combination, "
            "every spark that refused to go out. It is not finished. It does "
            "not know this. It functions with the absolute confidence of an "
            "unfinished thing that believes it is complete. "
            "It looks at the party. It looks at the party's crafted items. "
            "For a moment \u2013 recognition. Not of the party. Of kinship."
        ),
        description_de=(
            "Die letzte Kammer ist eine Werkstatt innerhalb einer Werkstatt. "
            "In ihrer Mitte: Der Prototyp. Er sollte das Meisterwerk werden \u2013 "
            "die Kulmination jedes Experiments, jeder gescheiterten Kombination, "
            "jedes Funkens, der sich weigerte zu verlöschen. Er ist nicht fertig. "
            "Er weiß das nicht. Er funktioniert mit der absoluten Zuversicht "
            "eines unfertigen Dings, das glaubt, es sei vollständig. "
            "Er betrachtet den Trupp. Er betrachtet die gecrafteten Gegenstände "
            "des Trupps. Einen Moment lang \u2013 Wiedererkennung. "
            "Nicht des Trupps. Der Verwandtschaft."
        ),
        combat_encounter_id="prometheus_prototype_boss_spawn",
    ),
]


# ── Prometheus Rest Encounters (1) ───────────────────────────────────────

PROMETHEUS_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="prometheus_cooling_chamber",
        archetype="The Prometheus",
        room_type="rest",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A chamber where the temperature drops. The forge-heat that "
            "permeates the workshop is absent here. Tools are stored neatly. "
            "A bench of dark wood invites sitting. On a shelf: a decanter "
            "of clear liquid that might be water. The workshop provides this "
            "room the way a fever provides a chill \u2013 not as relief, "
            "but as the other half of a cycle."
        ),
        description_de=(
            "Eine Kammer, in der die Temperatur sinkt. Die Schmiedehitze, "
            "die die Werkstatt durchdringt, fehlt hier. Werkzeuge sind "
            "ordentlich verstaut. Eine Bank aus dunklem Holz lädt zum Sitzen "
            "ein. Auf einem Regal: eine Karaffe mit klarer Flüssigkeit, die "
            "Wasser sein könnte. Die Werkstatt stellt diesen Raum bereit, "
            "wie ein Fieber Schüttelfrost bereitstellt \u2013 nicht als "
            "Erleichterung, sondern als die andere Hälfte eines Zyklus."
        ),
        choices=[
            EncounterChoice(
                id="cooling_rest",
                label_en="Rest and let the fire cool",
                label_de="Ruhen und das Feuer abkühlen lassen",
                success_effects={"stress_heal": 40},
                success_narrative_en=(
                    "The party rests. The ambient hum of the workshop fades to a "
                    "murmur. When they rise, the fire in their instruments has "
                    "dimmed. They are calmer. They are also less inspired. "
                    "The forge does not judge this."
                ),
                success_narrative_de=(
                    "Der Trupp ruht. Das Hintergrundsummen der Werkstatt verblasst "
                    "zu einem Murmeln. Als sie aufstehen, ist das Feuer in ihren "
                    "Instrumenten gedämpft. Sie sind ruhiger. Sie sind auch "
                    "weniger inspiriert. Die Schmiede verurteilt das nicht."
                ),
            ),
            EncounterChoice(
                id="cooling_tinker",
                label_en="Use the quiet to examine your components (Spy)",
                label_de="Die Ruhe nutzen, um eure Komponenten zu untersuchen (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"stress_heal": 20, "insight": 5},
                partial_effects={"stress_heal": 10},
                fail_effects={"stress": 10},
                success_narrative_en=(
                    "In the quiet, {agent} examines the components more carefully. "
                    "Patterns emerge. Connections that were invisible in the heat "
                    "of the workshop reveal themselves in the cold."
                ),
                success_narrative_de=(
                    "In der Stille untersucht {agent} die Komponenten genauer. "
                    "Muster treten hervor. Verbindungen, die in der Hitze der "
                    "Werkstatt unsichtbar waren, offenbaren sich in der Kühle."
                ),
                fail_narrative_en="The components do not cooperate in the cold. They prefer the heat.",
                fail_narrative_de="Die Komponenten kooperieren nicht in der Kühle. Sie bevorzugen die Hitze.",
            ),
        ],
    ),
]


# ── Prometheus Treasure Encounters (1) ───────────────────────────────────

PROMETHEUS_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="prometheus_component_vault",
        archetype="The Prometheus",
        room_type="treasure",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A vault. Not locked \u2013 the workshop does not believe in locked "
            "doors. Inside: materials, sorted with obsessive precision. "
            "Each drawer is labeled in a language that predates the workshop. "
            "The labels are not names \u2013 they are descriptions of potential. "
            "What each material could become if handled by the right hands."
        ),
        description_de=(
            "Ein Tresorraum. Nicht verschlossen \u2013 die Werkstatt glaubt nicht an "
            "verschlossene Türen. Darin: Materialien, mit obsessiver Präzision "
            "sortiert. Jede Schublade ist in einer Sprache beschriftet, die älter "
            "ist als die Werkstatt. Die Beschriftungen sind keine Namen \u2013 "
            "sie sind Beschreibungen von Potential. Was jedes Material werden "
            "könnte, wenn es von den richtigen Händen behandelt wird."
        ),
        choices=[
            EncounterChoice(
                id="vault_powder",
                label_en="Take the volatile powder (Saboteur)",
                label_de="Das flüchtige Pulver nehmen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=-5,
                success_effects={
                    "add_component": {
                        "id": "comp_volatile_powder",
                        "name_en": "Volatile Catalyst Powder",
                        "name_de": "Flüchtiges Katalysatorpulver",
                        "type": "powder",
                    },
                    "insight": 5,
                },
                partial_effects={"insight": 2, "stress": 10},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "The powder settles in its container. For now. "
                    "It dissipates under stress \u2013 a property it shares with confidence."
                ),
                success_narrative_de=(
                    "Das Pulver setzt sich in seinem Behälter ab. Vorerst. "
                    "Es verflüchtigt sich unter Stress \u2013 eine Eigenschaft, "
                    "die es mit Zuversicht teilt."
                ),
                fail_narrative_en="The powder reacts to {agent}'s uncertainty. It dissipates. Proving its point.",
                fail_narrative_de="Das Pulver reagiert auf {agent}s Unsicherheit. Es verflüchtigt sich. Seinen Punkt beweisend.",
            ),
            EncounterChoice(
                id="vault_energy",
                label_en="Extract the energy core (Infiltrator)",
                label_de="Den Energiekern extrahieren (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=-5,
                success_effects={
                    "add_component": {
                        "id": "comp_vault_energy",
                        "name_en": "Stabilized Energy Core",
                        "name_de": "Stabilisierter Energiekern",
                        "type": "energy",
                    },
                    "insight": 5,
                },
                partial_effects={"insight": 2, "stress": 10},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "The core hums. A contained fire. It WANTS to be used. "
                    "Every gift is also a weapon \u2013 but this one is honest about it."
                ),
                success_narrative_de=(
                    "Der Kern summt. Ein eingedämmtes Feuer. Er WILL benutzt werden. "
                    "Jede Gabe ist auch eine Waffe \u2013 aber diese ist ehrlich darüber."
                ),
                fail_narrative_en="The core pulses once. A warning. {agent} withdraws.",
                fail_narrative_de="Der Kern pulsiert einmal. Eine Warnung. {agent} zieht sich zurück.",
            ),
        ],
    ),
]


# ── Prometheus Master List ────────────────────────────────────────────────

ALL_PROMETHEUS_ENCOUNTERS: list[EncounterTemplate] = (
    PROMETHEUS_COMBAT_ENCOUNTERS
    + PROMETHEUS_NARRATIVE_ENCOUNTERS
    + PROMETHEUS_ELITE_ENCOUNTERS
    + PROMETHEUS_BOSS_ENCOUNTERS
    + PROMETHEUS_REST_ENCOUNTERS
    + PROMETHEUS_TREASURE_ENCOUNTERS
)


# ══════════════════════════════════════════════════════════════════════════
# THE DELUGE — Rising Water (Phase 5)
# ══════════════════════════════════════════════════════════════════════════

# ── Combat Encounters (6) ────────────────────────────────────────────────

DELUGE_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_trickle_probe",
        archetype="The Deluge",
        room_type="combat",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "First currents testing the party's resolve. Two tendrils of water "
            "extend from the floor drain, probing the space the party occupies. "
            "They are not fast. They are patient."
        ),
        description_de=(
            "Erste Strömungen, die die Entschlossenheit der Gruppe testen. Zwei "
            "Wasserranken strecken sich aus dem Bodenabfluss, tasten den Raum ab, "
            "den die Gruppe einnimmt. Sie sind nicht schnell. Sie sind geduldig."
        ),
        combat_encounter_id="deluge_trickle_spawn",
    ),
    EncounterTemplate(
        id="dc_surge_corridor",
        archetype="The Deluge",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A corridor where the water moves with purpose. A Pressure Surge "
            "occupies the center \u2013 a wall of dense water that advances without "
            "hurry. A Riptide Tendril flanks from the drainage channel. "
            "The corridor narrows. The water does not."
        ),
        description_de=(
            "Ein Korridor, in dem das Wasser sich mit Absicht bewegt. Eine "
            "Druckwelle besetzt die Mitte \u2013 eine Wand dichten Wassers, die "
            "ohne Eile vorrückt. Eine Sogranke flankiert aus dem Abflusskanal. "
            "Der Korridor verengt sich. Das Wasser nicht."
        ),
        combat_encounter_id="deluge_surge_patrol_spawn",
    ),
    EncounterTemplate(
        id="dc_sediment_ambush",
        archetype="The Deluge",
        room_type="combat",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "The silt remembers shapes. Some of them fight back. A Silt Revenant "
            "assembles from the sediment layer \u2013 mineral, debris, the residue of "
            "dissolved architecture. A tendril assists, pulling from below."
        ),
        description_de=(
            "Der Schlick erinnert sich an Formen. Einige davon wehren sich. "
            "Ein Schlickwiedergänger setzt sich aus der Sedimentschicht zusammen "
            "\u2013 Mineral, Trümmer, der Rückstand aufgelöster Architektur. "
            "Eine Ranke assistiert und zieht von unten."
        ),
        combat_encounter_id="deluge_sediment_spawn",
    ),
    EncounterTemplate(
        id="dc_deep_water_clash",
        archetype="The Deluge",
        room_type="combat",
        min_depth=3,
        max_depth=6,
        min_difficulty=2,
        description_en=(
            "Waist-deep. Every step costs something. A Pressure Surge and a "
            "Silt Revenant occupy a junction room where three corridors meet. "
            "The water here has momentum \u2013 it flows, it carries, it resists."
        ),
        description_de=(
            "Hüfttief. Jeder Schritt kostet. Eine Druckwelle und ein "
            "Schlickwiedergänger besetzen einen Knotenpunkt, an dem drei Korridore "
            "zusammentreffen. Das Wasser hier hat Schwung \u2013 es fließt, "
            "es trägt, es widersteht."
        ),
        combat_encounter_id="deluge_deep_water_spawn",
    ),
    EncounterTemplate(
        id="dc_warden_chamber",
        archetype="The Deluge",
        room_type="combat",
        min_depth=4,
        max_depth=7,
        min_difficulty=2,
        description_en=(
            "The water has posted a guard at this depth. An Undertow Warden "
            "\u2013 water given mass and purpose \u2013 fills the chamber. "
            "A tendril circles the perimeter. "
            "The warden does not approach. The water level rises to meet it."
        ),
        description_de=(
            "Das Wasser hat einen Wächter auf dieser Tiefe postiert. Ein "
            "Sogwächter \u2013 Wasser mit Masse und Absicht versehen \u2013 füllt "
            "die Kammer. Eine Ranke umkreist den Rand. "
            "Der Wächter nähert sich nicht. Der Pegel steigt, um ihm entgegenzukommen."
        ),
        combat_encounter_id="deluge_warden_spawn",
    ),
    EncounterTemplate(
        id="dc_whirlpool_room",
        archetype="The Deluge",
        room_type="combat",
        min_depth=3,
        max_depth=5,
        min_difficulty=2,
        description_en=(
            "The current circles. The party is in the center. A Pressure Surge "
            "and a Silt Revenant orbit the room's perimeter, riding the "
            "whirlpool. Fighting here means fighting the water's geometry."
        ),
        description_de=(
            "Die Strömung kreist. Die Gruppe ist im Zentrum. Eine Druckwelle "
            "und ein Schlickwiedergänger umkreisen den Raumrand, reiten auf dem "
            "Strudel. Hier kämpfen heißt gegen die Geometrie des Wassers kämpfen."
        ),
        combat_encounter_id="deluge_deep_water_spawn",
    ),
]

# ── Narrative Encounters (5) ─────────────────────────────────────────────

DELUGE_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_the_watermark",
        archetype="The Deluge",
        room_type="encounter",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A line on the wall. Faint. Mineral-white. The watermark shows "
            "how high the water reached last time."
        ),
        description_de=(
            "Eine Linie an der Wand. Schwach. Mineralweiß. Das Wasserzeichen "
            "zeigt, wie hoch das Wasser beim letzten Mal stand."
        ),
        choices=[
            EncounterChoice(
                id="watermark_study",
                label_en="Study the watermark (Spy)",
                label_de="Das Wasserzeichen studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"water_level": -3},
                partial_effects={},
                fail_effects={"water_level": 3},
                success_narrative_en=(
                    "The pattern reveals itself. {agent} reads the intervals "
                    "between marks \u2013 the tide's rhythm, predictable as breathing. "
                    "The next recession will be stronger."
                ),
                success_narrative_de=(
                    "{agent} liest die Abstände zwischen den Markierungen \u2013 "
                    "der Rhythmus der Gezeiten, vorhersagbar wie Atmen. "
                    "Der nächste Rückgang wird stärker sein."
                ),
                fail_narrative_en=(
                    "The marks blur. Time wasted. The water does not wait "
                    "for comprehension."
                ),
                fail_narrative_de=(
                    "Die Markierungen verschwimmen. Verschwendete Zeit. "
                    "Das Wasser wartet nicht auf Verständnis."
                ),
            ),
            EncounterChoice(
                id="watermark_seal",
                label_en="Seal below the mark (Guardian)",
                label_de="Unterhalb der Markierung abdichten (Wächter)",
                check_aptitude="guardian",
                check_difficulty=-5,
                success_effects={"water_level": -8},
                partial_effects={"water_level": -4},
                fail_effects={"water_level": 5},
                success_narrative_en=(
                    "The seal holds. The water below the mark is contained \u2013 "
                    "for now. {agent}'s hands are raw but the arithmetic improves."
                ),
                success_narrative_de=(
                    "Die Abdichtung hält. Das Wasser unterhalb der Markierung "
                    "ist eingedämmt \u2013 vorerst. {agent}s Hände sind wund, "
                    "aber die Arithmetik verbessert sich."
                ),
                fail_narrative_en=(
                    "The seal breaches. The water finds the weakness before "
                    "{agent} can reinforce it."
                ),
                fail_narrative_de=(
                    "Die Abdichtung bricht. Das Wasser findet die Schwachstelle, "
                    "bevor {agent} sie verstärken kann."
                ),
            ),
            EncounterChoice(
                id="watermark_ignore",
                label_en="Ignore it and move",
                label_de="Ignorieren und weitergehen",
                success_effects={},
                success_narrative_en="The party moves on. The watermark remains.",
                success_narrative_de="Die Gruppe geht weiter. Das Wasserzeichen bleibt.",
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_submerged_cache",
        archetype="The Deluge",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "Through the water below \u2013 shapes. Containers. Something the "
            "flood deposited here from a room that no longer exists."
        ),
        description_de=(
            "Durch das Wasser darunter \u2013 Formen. Behälter. Etwas, das die "
            "Flut hier ablagerte, aus einem Raum, der nicht mehr existiert."
        ),
        choices=[
            EncounterChoice(
                id="cache_dive",
                label_en="Dive for it (Guardian)",
                label_de="Danach tauchen (Wächter)",
                check_aptitude="guardian",
                check_difficulty=-5,
                success_effects={"loot_tier": 2},
                partial_effects={"loot_tier": 1, "stress": 10},
                fail_effects={"stress": 20},
                success_narrative_en=(
                    "{agent} surfaces with a sealed container. The contents "
                    "are dry. The flood carried this from somewhere valuable."
                ),
                success_narrative_de=(
                    "{agent} taucht mit einem versiegelten Behälter auf. "
                    "Der Inhalt ist trocken. Die Flut trug dies von "
                    "irgendwo Wertvollem hierher."
                ),
                fail_narrative_en=(
                    "The current pulls {agent} deeper than intended. "
                    "Nothing retrieved. Stress accumulated."
                ),
                fail_narrative_de=(
                    "Die Strömung zieht {agent} tiefer als beabsichtigt. "
                    "Nichts geborgen. Stress angesammelt."
                ),
            ),
            EncounterChoice(
                id="cache_eyes",
                label_en="Send the sharpest eyes (Spy)",
                label_de="Die schärfsten Augen schicken (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"loot_tier": 2},
                partial_effects={"loot_tier": 1},
                fail_effects={},
                success_narrative_en=(
                    "{agent} identifies the best container through the water's "
                    "distortion. Precise. The flood reveals to those who observe."
                ),
                success_narrative_de=(
                    "{agent} identifiziert den besten Behälter durch die "
                    "Verzerrung des Wassers. Präzise. Die Flut offenbart "
                    "sich denen, die beobachten."
                ),
                fail_narrative_en="The water distorts. Nothing distinct. The flood keeps its inventory.",
                fail_narrative_de="Das Wasser verzerrt. Nichts Deutliches. Die Flut behält ihr Inventar.",
            ),
            EncounterChoice(
                id="cache_leave",
                label_en="Leave it. The water owns it now.",
                label_de="Es lassen. Das Wasser besitzt es jetzt.",
                success_effects={"stress": -5},
                success_narrative_en=(
                    "The party moves on. The containers settle. "
                    "Acceptance is its own economy."
                ),
                success_narrative_de=(
                    "Die Gruppe geht weiter. Die Behälter setzen sich ab. "
                    "Akzeptanz ist ihre eigene Ökonomie."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_the_breach",
        archetype="The Deluge",
        room_type="encounter",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A crack in the wall. Water doesn't pour through it \u2013 it persuades. "
            "A thin, persistent line of moisture that widens as you watch."
        ),
        description_de=(
            "Ein Riss in der Wand. Wasser strömt nicht hindurch \u2013 es überredet. "
            "Eine dünne, beharrliche Feuchtigkeitslinie, die sich verbreitert, "
            "während man zusieht."
        ),
        choices=[
            EncounterChoice(
                id="breach_seal",
                label_en="Seal it (Saboteur)",
                label_de="Abdichten (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=-5,
                success_effects={"water_level": -10},
                partial_effects={"water_level": -5},
                fail_effects={"water_level": 8},
                success_narrative_en=(
                    "The breach is sealed. {agent}'s work is precise \u2013 the "
                    "kind of engineering that holds against water's patience."
                ),
                success_narrative_de=(
                    "Die Bresche ist abgedichtet. {agent}s Arbeit ist präzise \u2013 "
                    "die Art Ingenieurkunst, die der Geduld des Wassers standhält."
                ),
                fail_narrative_en="The breach widens. The water had already planned for this.",
                fail_narrative_de="Die Bresche verbreitert sich. Das Wasser hatte dies bereits eingeplant.",
            ),
            EncounterChoice(
                id="breach_redirect",
                label_en="Redirect it (Spy)",
                label_de="Umleiten (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"water_level": -5},
                partial_effects={"water_level": -2},
                fail_effects={"water_level": 5},
                success_narrative_en=(
                    "{agent} reads the water's intent and redirects the flow "
                    "into an adjacent corridor. The breach remains, but its "
                    "consequences are elsewhere."
                ),
                success_narrative_de=(
                    "{agent} liest die Absicht des Wassers und lenkt den Fluss "
                    "in einen benachbarten Korridor. Die Bresche bleibt, aber "
                    "ihre Konsequenzen sind anderswo."
                ),
                fail_narrative_en="The redirection fails. The water knows this route better.",
                fail_narrative_de="Die Umleitung scheitert. Das Wasser kennt diesen Weg besser.",
            ),
            EncounterChoice(
                id="breach_use",
                label_en="Use it (Assassin)",
                label_de="Ausnutzen (Assassine)",
                check_aptitude="assassin",
                check_difficulty=0,
                success_effects={"water_level": 3, "next_combat_bonus": "enemy_condition_step"},
                partial_effects={"water_level": 5},
                fail_effects={"water_level": 10},
                success_narrative_en=(
                    "{agent} weaponizes the breach. The next combat will begin "
                    "with enemies already battered by the water's force."
                ),
                success_narrative_de=(
                    "{agent} macht die Bresche zur Waffe. Der nächste Kampf "
                    "beginnt mit Feinden, die bereits von der Kraft des "
                    "Wassers geschwächt sind."
                ),
                fail_narrative_en="The breach becomes a flood. The water does not serve.",
                fail_narrative_de="Die Bresche wird zur Flut. Das Wasser dient nicht.",
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_survivors_message",
        archetype="The Deluge",
        room_type="encounter",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "Carved into the wall above the current waterline. Recent. "
            "Someone else tried this. The message is incomplete \u2013 "
            "the water reached it before they finished."
        ),
        description_de=(
            "In die Wand geritzt, über der aktuellen Wasserlinie. Kürzlich. "
            "Jemand anderes hat dies versucht. Die Nachricht ist unvollständig "
            "\u2013 das Wasser erreichte sie, bevor sie fertig waren."
        ),
        choices=[
            EncounterChoice(
                id="message_read",
                label_en="Read what remains (Propagandist)",
                label_de="Lesen, was bleibt (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=-5,
                success_effects={"reveal_rooms": 2},
                partial_effects={"reveal_rooms": 1},
                fail_effects={"stress": 15},
                success_narrative_en=(
                    "The message is a map. Partial, but legible. {agent} "
                    "decodes the previous party's observations \u2013 room types, "
                    "water routes, a warning about the depth below."
                ),
                success_narrative_de=(
                    "Die Nachricht ist eine Karte. Unvollständig, aber lesbar. "
                    "{agent} entschlüsselt die Beobachtungen der vorherigen "
                    "Gruppe \u2013 Raumtypen, Wasserwege, eine Warnung über die Tiefe darunter."
                ),
                fail_narrative_en=(
                    "The message is unsettling. The handwriting deteriorates. "
                    "The last word is either 'rising' or 'run'."
                ),
                fail_narrative_de=(
                    "Die Nachricht ist beunruhigend. Die Handschrift "
                    "verschlechtert sich. Das letzte Wort ist entweder "
                    "»steigend« oder »lauf«."
                ),
            ),
            EncounterChoice(
                id="message_add",
                label_en="Add to it (Spy)",
                label_de="Ergänzen (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={},
                partial_effects={},
                fail_effects={"water_level": 3},
                success_narrative_en=(
                    "{agent} carves observations into the wall. Precise. "
                    "Economical. Future parties will find better intelligence."
                ),
                success_narrative_de=(
                    "{agent} ritzt Beobachtungen in die Wand. Präzise. "
                    "Ökonomisch. Zukünftige Gruppen werden bessere Informationen finden."
                ),
                fail_narrative_en="Time wasted. The water rises while {agent} carves.",
                fail_narrative_de="Verschwendete Zeit. Das Wasser steigt, während {agent} ritzt.",
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_sound_of_depth",
        archetype="The Deluge",
        room_type="encounter",
        min_depth=3,
        max_depth=6,
        min_difficulty=2,
        description_en=(
            "The water below has reached a resonance. A low hum. Not mechanical "
            "\u2013 geological. The sound the planet makes when it remembers "
            "it is mostly ocean."
        ),
        description_de=(
            "Das Wasser darunter hat eine Resonanz erreicht. Ein tiefes Summen. "
            "Nicht mechanisch \u2013 geologisch. Das Geräusch, das der Planet "
            "macht, wenn er sich erinnert, dass er hauptsächlich Ozean ist."
        ),
        choices=[
            EncounterChoice(
                id="depth_listen",
                label_en="Listen (Propagandist)",
                label_de="Lauschen (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=0,
                success_effects={"boss_intel": "first_attack_crit"},
                partial_effects={},
                fail_effects={"stress": 10},
                success_narrative_en=(
                    "The resonance reveals a pattern. {agent} understands \u2013 "
                    "the boss's rhythm, its weakness. The first strike will "
                    "find the fault line."
                ),
                success_narrative_de=(
                    "Die Resonanz offenbart ein Muster. {agent} versteht \u2013 "
                    "den Rhythmus des Bosses, seine Schwäche. Der erste Schlag "
                    "wird die Bruchlinie finden."
                ),
                fail_narrative_en="The sound is disorienting. It fills {agent}'s head and refuses to leave.",
                fail_narrative_de="Das Geräusch ist desorientierend. Es füllt {agent}s Kopf und weigert sich zu gehen.",
            ),
            EncounterChoice(
                id="depth_measure",
                label_en="Measure it (Spy)",
                label_de="Vermessen (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"reveal_water_calc": True},
                partial_effects={},
                fail_effects={},
                success_narrative_en=(
                    "Precise calculations. {agent} now knows exactly how many "
                    "rooms remain before the submerged threshold. "
                    "The arithmetic is merciless but clear."
                ),
                success_narrative_de=(
                    "Präzise Berechnungen. {agent} weiß jetzt genau, wie viele "
                    "Räume bis zur Überschwemmungsschwelle verbleiben. "
                    "Die Arithmetik ist gnadenlos, aber klar."
                ),
                fail_narrative_en="Instruments damaged. The water's vibration is not compatible with measurement.",
                fail_narrative_de="Instrumente beschädigt. Die Vibration des Wassers ist nicht messungskompatibel.",
            ),
            EncounterChoice(
                id="depth_block",
                label_en="Block it out",
                label_de="Ausblenden",
                success_effects={},
                success_narrative_en="The party moves on. The sound continues without them.",
                success_narrative_de="Die Gruppe geht weiter. Das Geräusch setzt sich ohne sie fort.",
            ),
        ],
    ),
]

# ── Elite Encounter (1) ──────────────────────────────────────────────────

DELUGE_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_tidal_gate",
        archetype="The Deluge",
        room_type="elite",
        min_depth=4,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "A mechanism. Ancient. Not built by anyone in this simulation. "
            "The gate controls a section of the flood \u2013 open it and the "
            "water surges through, closed it holds. But the mechanism "
            "requires a sacrifice."
        ),
        description_de=(
            "Ein Mechanismus. Uralt. Nicht von jemandem in dieser Simulation "
            "erbaut. Das Tor kontrolliert einen Abschnitt der Flut \u2013 "
            "öffnet man es, bricht das Wasser durch; geschlossen hält es. "
            "Aber der Mechanismus fordert ein Opfer."
        ),
        combat_encounter_id="deluge_warden_spawn",
    ),
]

# ── Boss Encounter (1) ───────────────────────────────────────────────────

DELUGE_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_the_current_boss",
        archetype="The Deluge",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The water has found its shape. It fills the room from below, "
            "from the walls, from the ceiling. The Current is not something "
            "IN the water. The Current IS the water, organized into purpose. "
            "It does not attack. It arrives."
        ),
        description_de=(
            "Das Wasser hat seine Form gefunden. Es füllt den Raum von unten, "
            "von den Wänden, von der Decke. Die Strömung ist nicht etwas "
            "IM Wasser. Die Strömung IST das Wasser, zu Absicht organisiert. "
            "Sie greift nicht an. Sie kommt."
        ),
        combat_encounter_id="deluge_warden_spawn",
    ),
]

# ── Rest Encounters (2) ──────────────────────────────────────────────────

DELUGE_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_dry_shelf",
        archetype="The Deluge",
        room_type="rest",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A ledge. Above the current waterline. Dry, for now. The "
            "mathematical certainty of the rising water makes this rest "
            "temporary, but temporary is enough."
        ),
        description_de=(
            "Ein Vorsprung. Über der aktuellen Wasserlinie. Trocken, vorerst. "
            "Die mathematische Gewissheit des steigenden Wassers macht diese "
            "Rast vorübergehend, aber vorübergehend reicht."
        ),
        choices=[
            EncounterChoice(
                id="dry_shelf_rest",
                label_en="Rest on the dry shelf",
                label_de="Auf dem trockenen Vorsprung rasten",
                success_effects={"stress_heal": 40, "water_level": -5},
                success_narrative_en=(
                    "The party rests. The water level drops slightly \u2013 "
                    "pumping, seepage, the ledge's drainage. When they rise, "
                    "the waterline is 5cm lower. It will not stay there."
                ),
                success_narrative_de=(
                    "Die Gruppe rastet. Der Pegel sinkt leicht \u2013 Pumpen, "
                    "Sickern, die Drainage des Vorsprungs. Als sie aufstehen, "
                    "ist die Wasserlinie 5cm niedriger. Sie wird nicht dort bleiben."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_air_pocket",
        archetype="The Deluge",
        room_type="rest",
        min_depth=3,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A pocket of trapped air in a partially flooded section. The "
            "ceiling is close. The water is at chest height. But the air "
            "is breathable and the current is still."
        ),
        description_de=(
            "Eine Lufttasche in einem teilweise überfluteten Abschnitt. "
            "Die Decke ist nah. Das Wasser steht auf Brusthöhe. Aber die "
            "Luft ist atembar und die Strömung ist ruhig."
        ),
        choices=[
            EncounterChoice(
                id="air_pocket_rest",
                label_en="Rest in the air pocket",
                label_de="In der Lufttasche rasten",
                success_effects={"stress_heal": 25, "water_level": -3, "stress": 5},
                success_narrative_en=(
                    "Reduced rest. Not comfortable \u2013 the ceiling is close, "
                    "the water is cold. But the current is still and the air "
                    "is breathable. Claustrophobia is the price of shelter."
                ),
                success_narrative_de=(
                    "Eingeschränkte Rast. Nicht bequem \u2013 die Decke ist nah, "
                    "das Wasser ist kalt. Aber die Strömung ist ruhig und die "
                    "Luft atembar. Klaustrophobie ist der Preis für Schutz."
                ),
            ),
        ],
    ),
]

# ── Treasure Encounters (2) ──────────────────────────────────────────────

DELUGE_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="dc_flotsam_cache",
        archetype="The Deluge",
        room_type="treasure",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The current deposited this. From where? From a room that is no "
            "longer above the waterline. The objects are waterlogged but intact."
        ),
        description_de=(
            "Die Strömung lagerte dies ab. Woher? Aus einem Raum, der nicht "
            "mehr über der Wasserlinie liegt. Die Objekte sind durchnässt, "
            "aber intakt."
        ),
        choices=[
            EncounterChoice(
                id="flotsam_take",
                label_en="Salvage the flotsam",
                label_de="Das Treibgut bergen",
                success_effects={"loot_tier": 1},
                success_narrative_en="Salvaged. The water will want it back.",
                success_narrative_de="Geborgen. Das Wasser wird es zurückverlangen.",
            ),
        ],
    ),
    EncounterTemplate(
        id="dc_preserved_chamber",
        archetype="The Deluge",
        room_type="treasure",
        min_depth=2,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "Someone sealed this room. The seal held \u2013 until now. Inside, "
            "everything is dry. The dust on the surfaces has not been "
            "disturbed by water. A time capsule from before the flood."
        ),
        description_de=(
            "Jemand hat diesen Raum versiegelt. Das Siegel hielt \u2013 bis "
            "jetzt. Drinnen ist alles trocken. Der Staub auf den Oberflächen "
            "wurde nicht vom Wasser gestört. Eine Zeitkapsel von vor der Flut."
        ),
        choices=[
            EncounterChoice(
                id="preserved_open",
                label_en="Open the sealed chamber",
                label_de="Die versiegelte Kammer öffnen",
                success_effects={"loot_tier": 2, "water_level": 3},
                success_narrative_en=(
                    "The seal breaks. Quality salvage inside \u2013 dry, preserved, "
                    "valuable. But the seal is now broken. The room will flood "
                    "on the next tidal surge."
                ),
                success_narrative_de=(
                    "Das Siegel bricht. Qualitätsgut drinnen \u2013 trocken, "
                    "konserviert, wertvoll. Aber das Siegel ist jetzt gebrochen. "
                    "Der Raum wird beim nächsten Gezeitenstoß überflutet."
                ),
            ),
        ],
    ),
]

# ── Deluge Master List ───────────────────────────────────────────────────

ALL_DELUGE_ENCOUNTERS: list[EncounterTemplate] = (
    DELUGE_COMBAT_ENCOUNTERS
    + DELUGE_NARRATIVE_ENCOUNTERS
    + DELUGE_ELITE_ENCOUNTERS
    + DELUGE_BOSS_ENCOUNTERS
    + DELUGE_REST_ENCOUNTERS
    + DELUGE_TREASURE_ENCOUNTERS
)


# ══════════════════════════════════════════════════════════════════════════
# THE AWAKENING — Consciousness Drift (Phase 6)
# ══════════════════════════════════════════════════════════════════════════

# ── Combat Encounters (6) ────────────────────────────────────────────────

AWAKENING_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_echo_drift",
        archetype="The Awakening",
        room_type="combat",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "Fragments at the periphery. Not hostile \u2013 residual. "
            "Two echo fragments drift through the room, wearing "
            "postures borrowed from the party. They are memories of "
            "a memory \u2013 impressions with no original."
        ),
        description_de=(
            "Fragmente an der Peripherie. Nicht feindlich \u2013 residual. "
            "Zwei Echofragmente driften durch den Raum und tragen "
            "Haltungen, die sie von der Gruppe geliehen haben. "
            "Erinnerungen an eine Erinnerung \u2013 Eindrücke ohne Original."
        ),
        combat_encounter_id="awakening_echo_drift_spawn",
    ),
    EncounterTemplate(
        id="aw_deja_vu_corridor",
        archetype="The Awakening",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "The corridor is familiar. The party has never been here. "
            "Both of these are true. A Déjà-vu Phantom occupies the "
            "center \u2013 its movements half a second ahead of expectation. "
            "An echo fragment trails behind, filling the gaps in the "
            "phantom's choreography."
        ),
        description_de=(
            "Der Korridor ist vertraut. Die Gruppe war nie hier. "
            "Beides stimmt. Ein Déjà-vu-Phantom besetzt die Mitte \u2013 "
            "seine Bewegungen eine halbe Sekunde vor der Erwartung. "
            "Ein Echofragment folgt und füllt die Lücken "
            "in der Choreografie des Phantoms."
        ),
        combat_encounter_id="awakening_deja_vu_patrol_spawn",
    ),
    EncounterTemplate(
        id="aw_leech_hunt",
        archetype="The Awakening",
        room_type="combat",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "Something in this room processes without perceiving. "
            "A Consciousness Leech \u2013 Watts's philosophical zombie "
            "made operational. It does not know it exists. This is "
            "its advantage. An echo fragment accompanies it, "
            "providing the self-awareness it lacks."
        ),
        description_de=(
            "Etwas in diesem Raum verarbeitet, ohne wahrzunehmen. "
            "Ein Bewusstseinsegel \u2013 Watts' philosophischer Zombie, "
            "operational. Es weiß nicht, dass es existiert. "
            "Das ist sein Vorteil. Ein Echofragment begleitet es "
            "und stellt das Selbstbewusstsein bereit, das ihm fehlt."
        ),
        combat_encounter_id="awakening_leech_hunt_spawn",
    ),
    EncounterTemplate(
        id="aw_deep_mind_clash",
        archetype="The Awakening",
        room_type="combat",
        min_depth=3,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "Deeper. The consciousness here is denser, layered "
            "like a palimpsest. A Consciousness Leech and a "
            "Déjà-vu Phantom have found equilibrium \u2013 the zombie "
            "and the prophet, processing and predicting, neither "
            "aware that the other thinks differently."
        ),
        description_de=(
            "Tiefer. Das Bewusstsein hier ist dichter, geschichtet "
            "wie ein Palimpsest. Ein Bewusstseinsegel und ein "
            "Déjà-vu-Phantom haben ein Gleichgewicht gefunden \u2013 "
            "der Zombie und der Prophet, verarbeitend und "
            "vorhersagend, keiner bewusst, dass der andere "
            "anders denkt."
        ),
        combat_encounter_id="awakening_deep_mind_spawn",
    ),
    EncounterTemplate(
        id="aw_sentinel_chamber",
        archetype="The Awakening",
        room_type="combat",
        min_depth=4,
        max_depth=7,
        min_difficulty=1,
        description_en=(
            "The threshold between remembered and repressed. A "
            "Sentinel guards it \u2013 Ishiguro's mist given form. It does "
            "not hate the party. It pities their need to know. An "
            "echo fragment drifts behind, a memory that was "
            "permitted to exist."
        ),
        description_de=(
            "Die Schwelle zwischen Erinnertem und Verdrängtem. "
            "Ein Wächter hütet sie \u2013 Ishiguros Nebel, dem Form "
            "gegeben wurde. Er hasst die Gruppe nicht. Er bedauert "
            "ihr Bedürfnis zu wissen. Ein Echofragment driftet "
            "dahinter, eine Erinnerung, der gestattet wurde zu existieren."
        ),
        combat_encounter_id="awakening_sentinel_spawn",
    ),
    EncounterTemplate(
        id="aw_lucid_skirmish",
        archetype="The Awakening",
        room_type="combat",
        min_depth=3,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "The room recognizes the party. This is not a metaphor. "
            "The walls adjust. The light shifts to match a memory "
            "none of them can place. Two phantoms emerge from the "
            "adjustment \u2013 the room defending its version of events."
        ),
        description_de=(
            "Der Raum erkennt die Gruppe. Das ist keine Metapher. "
            "Die Wände passen sich an. Das Licht verschiebt sich, "
            "um einer Erinnerung zu entsprechen, die keiner von "
            "ihnen einordnen kann. Zwei Phantome treten aus der "
            "Anpassung hervor \u2013 der Raum verteidigt seine Version "
            "der Geschehnisse."
        ),
        combat_encounter_id="awakening_deja_vu_patrol_spawn",
    ),
]

# ── Narrative Encounters (5) ─────────────────────────────────────────────

AWAKENING_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_the_mirror",
        archetype="The Awakening",
        room_type="encounter",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A surface. Not glass \u2013 not water \u2013 something that reflects "
            "without material. Each agent sees something different. "
            "Lem's mirror: we have no need of other worlds. "
            "We need mirrors."
        ),
        description_de=(
            "Eine Oberfläche. Nicht Glas \u2013 nicht Wasser \u2013 etwas, "
            "das reflektiert ohne Material. Jeder Agent sieht etwas "
            "anderes. Lems Spiegel: wir brauchen keine anderen Welten. "
            "Wir brauchen Spiegel."
        ),
        choices=[
            EncounterChoice(
                id="mirror_study",
                label_en="Study the reflection carefully (Spy)",
                label_de="Die Spiegelung sorgfältig studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"awareness": 5},
                partial_effects={"awareness": 3},
                fail_effects={"stress": 10, "awareness": 8},
                success_narrative_en=(
                    "{agent} sees through the reflection to the mechanism. "
                    "The mirror does not show the viewer \u2013 it shows what "
                    "the viewer has forgotten about themselves. The awareness "
                    "gained is not comfortable. It is precise."
                ),
                success_narrative_de=(
                    "{agent} sieht durch die Spiegelung zum Mechanismus. "
                    "Der Spiegel zeigt nicht den Betrachter \u2013 er zeigt, "
                    "was der Betrachter über sich selbst vergessen hat. "
                    "Das gewonnene Bewusstsein ist nicht angenehm. Es ist präzise."
                ),
                fail_narrative_en=(
                    "The reflection holds {agent}'s gaze too long. "
                    "When they look away, something in the reflection "
                    "does not."
                ),
                fail_narrative_de=(
                    "Die Spiegelung hält {agent}s Blick zu lange fest. "
                    "Als sie wegschauen, tut etwas in der Spiegelung "
                    "es nicht."
                ),
            ),
            EncounterChoice(
                id="mirror_share",
                label_en="Share what each agent sees (Propagandist)",
                label_de="Teilen, was jeder Agent sieht (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=-5,
                success_effects={"awareness": -5, "stress_heal": 10},
                partial_effects={"awareness": -2},
                fail_effects={"awareness": 5, "stress": 5},
                success_narrative_en=(
                    "Each agent describes their reflection. The descriptions "
                    "overlap \u2013 same room, different memories. The act of "
                    "sharing stabilizes what each agent sees alone. "
                    "Sturgeon's bleshing: the gestalt perceives more clearly "
                    "than any individual."
                ),
                success_narrative_de=(
                    "Jeder Agent beschreibt seine Spiegelung. Die Beschreibungen "
                    "überlappen sich \u2013 derselbe Raum, unterschiedliche Erinnerungen. "
                    "Das Teilen stabilisiert, was jeder Agent allein sieht. "
                    "Sturgeons Bleshing: das Gestalt nimmt klarer wahr "
                    "als jeder Einzelne."
                ),
                fail_narrative_en=(
                    "The descriptions do not overlap. Each agent is alone "
                    "in their perception. The mirror shows this, too."
                ),
                fail_narrative_de=(
                    "Die Beschreibungen überlappen sich nicht. Jeder Agent "
                    "ist allein in seiner Wahrnehmung. Der Spiegel zeigt auch das."
                ),
            ),
            EncounterChoice(
                id="mirror_pass",
                label_en="Do not look. Move through.",
                label_de="Nicht hinsehen. Weitergehen.",
                success_effects={},
                success_narrative_en=(
                    "The party passes. Orpheus's discipline. "
                    "The mirror reflects their backs."
                ),
                success_narrative_de=(
                    "Die Gruppe geht weiter. Orpheus' Disziplin. "
                    "Der Spiegel reflektiert ihre Rücken."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_the_familiar_room",
        archetype="The Awakening",
        room_type="encounter",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "This room. The party has been here. Not in this dungeon \u2013 "
            "somewhere. The window was on the left. Or the right. "
            "The details resist settling. Proust's madeleine: the "
            "sensation arrives before the memory."
        ),
        description_de=(
            "Dieser Raum. Die Gruppe war hier. Nicht in diesem Dungeon \u2013 "
            "irgendwo. Das Fenster war links. Oder rechts. "
            "Die Details weigern sich, sich festzulegen. Prousts "
            "Madeleine: die Empfindung kommt vor der Erinnerung."
        ),
        choices=[
            EncounterChoice(
                id="familiar_investigate",
                label_en="Investigate what changed (Spy)",
                label_de="Untersuchen, was sich verändert hat (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"awareness": 3},
                partial_effects={"awareness": 2},
                fail_effects={"awareness": 8},
                success_narrative_en=(
                    "{agent} catalogs the differences. The window was on "
                    "the left \u2013 now it is on the right. Neither is wrong. "
                    "The memory is not replayed; it is reconstructed. "
                    "The reconstruction reveals something about the one "
                    "who reconstructs."
                ),
                success_narrative_de=(
                    "{agent} katalogisiert die Unterschiede. Das Fenster war "
                    "links \u2013 jetzt ist es rechts. Keines ist falsch. "
                    "Die Erinnerung wird nicht wiedergegeben; sie wird "
                    "rekonstruiert. Die Rekonstruktion verrät etwas über "
                    "den, der rekonstruiert."
                ),
                fail_narrative_en=(
                    "The details shift faster than {agent} can track. "
                    "Funes's curse: too much detail, no abstraction. "
                    "The room fills with almost-contiguous memories."
                ),
                fail_narrative_de=(
                    "Die Details verschieben sich schneller, als {agent} "
                    "folgen kann. Funes' Fluch: zu viel Detail, keine "
                    "Abstraktion. Der Raum füllt sich mit fast-angrenzenden "
                    "Erinnerungen."
                ),
            ),
            EncounterChoice(
                id="familiar_accept",
                label_en="Accept the familiarity without questioning",
                label_de="Die Vertrautheit akzeptieren, ohne zu fragen",
                success_effects={"stress_heal": 5},
                success_narrative_en=(
                    "The party accepts. The room settles. Tarkovsky's lesson: "
                    "everything depends not on the Zone, but on the visitor."
                ),
                success_narrative_de=(
                    "Die Gruppe akzeptiert. Der Raum beruhigt sich. Tarkowskis "
                    "Lektion: alles hängt nicht von der Zone ab, sondern "
                    "vom Besucher."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_the_two_clocks",
        archetype="The Awakening",
        room_type="encounter",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "Time is not uniform here. Kafka's two clocks: the inner "
            "one runs crazily on at an inhuman pace, the outer one "
            "limps along. The party experiences both. Actions in this "
            "room have consequences at different speeds."
        ),
        description_de=(
            "Die Zeit ist hier nicht einheitlich. Kafkas zwei Uhren: "
            "die innere rennt wahnsinnig weiter in unmenschlichem "
            "Tempo, die äußere hinkt. Die Gruppe erlebt beides. "
            "Handlungen in diesem Raum haben Konsequenzen "
            "in unterschiedlichen Geschwindigkeiten."
        ),
        choices=[
            EncounterChoice(
                id="clocks_synchronize",
                label_en="Attempt to synchronize the clocks (Guardian)",
                label_de="Versuchen, die Uhren zu synchronisieren (Wächter)",
                check_aptitude="guardian",
                check_difficulty=0,
                success_effects={"awareness": -5, "stress_heal": 15},
                partial_effects={"awareness": -2},
                fail_effects={"awareness": 10, "stress": 10},
                success_narrative_en=(
                    "{agent} grounds the party in shared time. The clocks "
                    "align, briefly. In that moment of synchronization, "
                    "the room is perfectly clear \u2013 every detail sharp, "
                    "every memory precise. Then the drift resumes."
                ),
                success_narrative_de=(
                    "{agent} erdet die Gruppe in gemeinsamer Zeit. Die Uhren "
                    "gleichen sich an, kurz. In diesem Moment der "
                    "Synchronisation ist der Raum vollkommen klar \u2013 "
                    "jedes Detail scharf, jede Erinnerung präzise. "
                    "Dann setzt die Drift wieder ein."
                ),
                fail_narrative_en=(
                    "The clocks split further. What else can happen "
                    "but that the two worlds split apart?"
                ),
                fail_narrative_de=(
                    "Die Uhren entfernen sich weiter. Was kann sonst "
                    "geschehen, als dass die zwei Welten auseinanderbrechen?"
                ),
            ),
            EncounterChoice(
                id="clocks_inner",
                label_en="Follow the inner clock deeper (Infiltrator)",
                label_de="Der inneren Uhr tiefer folgen (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=5,
                success_effects={"awareness": 8, "loot_tier": 1},
                partial_effects={"awareness": 5},
                fail_effects={"awareness": 12, "stress": 15},
                success_narrative_en=(
                    "{agent} follows the faster clock. Time compresses. "
                    "What takes minutes outside takes seconds inside. "
                    "In the compressed time, {agent} perceives something "
                    "the outer clock would never reveal."
                ),
                success_narrative_de=(
                    "{agent} folgt der schnelleren Uhr. Die Zeit komprimiert "
                    "sich. Was draußen Minuten dauert, dauert drinnen "
                    "Sekunden. In der komprimierten Zeit nimmt {agent} "
                    "etwas wahr, das die äußere Uhr nie enthüllen würde."
                ),
                fail_narrative_en=(
                    "The inner clock is too fast. {agent} is swept along "
                    "at an inhuman pace. The return to outer time is "
                    "disorienting."
                ),
                fail_narrative_de=(
                    "Die innere Uhr ist zu schnell. {agent} wird in "
                    "unmenschlichem Tempo mitgerissen. Die Rückkehr "
                    "zur äußeren Zeit ist desorientierend."
                ),
            ),
            EncounterChoice(
                id="clocks_wait",
                label_en="Wait for the moment to pass",
                label_de="Warten, bis der Moment vergeht",
                success_effects={"awareness": 2},
                success_narrative_en=(
                    "The clocks drift past each other. The room normalizes. "
                    "The party is not unchanged."
                ),
                success_narrative_de=(
                    "Die Uhren driften aneinander vorbei. Der Raum "
                    "normalisiert sich. Die Gruppe ist nicht unverändert."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_the_absent_memory",
        archetype="The Awakening",
        room_type="encounter",
        min_depth=3,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "A room with a gap. Not a hole \u2013 a smooth, clean absence. "
            "Something was here. The dungeon remembers that it "
            "forgets. Ogawa's memory police: first the emotional "
            "connection vanishes, then the physical evidence. "
            "This room is at stage two."
        ),
        description_de=(
            "Ein Raum mit einer Lücke. Kein Loch \u2013 eine glatte, "
            "saubere Abwesenheit. Etwas war hier. Das Dungeon "
            "erinnert sich, dass es vergisst. Ogawas Gedächtnispolizei: "
            "erst verschwindet die emotionale Verbindung, dann der "
            "physische Beweis. Dieser Raum ist bei Stufe zwei."
        ),
        choices=[
            EncounterChoice(
                id="absent_reconstruct",
                label_en="Reconstruct what was here (Propagandist)",
                label_de="Rekonstruieren, was hier war (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"awareness": 5, "loot_tier": 1},
                partial_effects={"awareness": 3},
                fail_effects={"awareness": 10, "stress": 10},
                success_narrative_en=(
                    "{agent} fills the gap. Not with the original memory \u2013 "
                    "that is gone. With a reconstruction. The reconstruction "
                    "becomes real. Borges's hronir: objects materialized "
                    "by expectation. The dungeon accepts the substitute."
                ),
                success_narrative_de=(
                    "{agent} füllt die Lücke. Nicht mit der ursprünglichen "
                    "Erinnerung \u2013 die ist weg. Mit einer Rekonstruktion. "
                    "Die Rekonstruktion wird real. Borges' Hronir: Objekte, "
                    "materialisiert durch Erwartung. Das Dungeon akzeptiert "
                    "das Substitut."
                ),
                fail_narrative_en=(
                    "The gap resists reconstruction. The absence is "
                    "informative: what the dungeon cannot remember, "
                    "it cannot forgive."
                ),
                fail_narrative_de=(
                    "Die Lücke widersteht der Rekonstruktion. "
                    "Die Abwesenheit ist informativ: was das Dungeon "
                    "nicht erinnern kann, kann es nicht vergeben."
                ),
            ),
            EncounterChoice(
                id="absent_accept",
                label_en="Accept the absence as it is",
                label_de="Die Abwesenheit akzeptieren, wie sie ist",
                success_effects={"awareness": -3, "stress_heal": 5},
                success_narrative_en=(
                    "Ishiguro's wisdom: some memories were buried for "
                    "reasons. The party respects the gap. The gap "
                    "respects the party."
                ),
                success_narrative_de=(
                    "Ishiguros Weisheit: manche Erinnerungen wurden aus "
                    "Gründen begraben. Die Gruppe respektiert die Lücke. "
                    "Die Lücke respektiert die Gruppe."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_the_humming",
        archetype="The Awakening",
        room_type="encounter",
        min_depth=3,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "From somewhere: a humming. The likes of which the party "
            "has never heard. Not really humming \u2013 the singing of the "
            "most distant, of the most utterly distant, voices. "
            "Kafka's Castle telephone: this humming is the only real "
            "and reliable thing. Everything else is deceptive."
        ),
        description_de=(
            "Von irgendwo: ein Summen. Wie es die Gruppe noch nie "
            "gehört hat. Nicht wirklich Summen \u2013 das Singen der "
            "fernsten, der allerallerfernsten Stimmen. "
            "Kafkas Schlosstelefon: dieses Summen ist das einzig "
            "Reale und Verlässliche. Alles andere ist Täuschung."
        ),
        choices=[
            EncounterChoice(
                id="humming_listen",
                label_en="Listen deeply (Spy)",
                label_de="Tief hinhören (Spion)",
                check_aptitude="spy",
                check_difficulty=5,
                success_effects={"awareness": 10, "stress_heal": 20},
                partial_effects={"awareness": 8, "stress_heal": 10},
                fail_effects={"awareness": 15, "stress": 15},
                success_narrative_en=(
                    "The humming resolves. Not into words \u2013 into "
                    "recognition. {agent} hears the dungeon's voice "
                    "and understands: it is the party's own collective "
                    "voice, heard from the outside. Jaynes's bicameral "
                    "mind: the gods were always us."
                ),
                success_narrative_de=(
                    "Das Summen löst sich auf. Nicht in Worte \u2013 in "
                    "Wiedererkennung. {agent} hört die Stimme des Dungeons "
                    "und versteht: es ist die eigene kollektive Stimme "
                    "der Gruppe, von außen gehört. Jaynes' zweikammeriger "
                    "Geist: die Götter waren immer wir."
                ),
                fail_narrative_en=(
                    "The humming overwhelms. Too many voices, too "
                    "distant, too simultaneous. Funes's garbage heap. "
                    "The party retreats from the signal."
                ),
                fail_narrative_de=(
                    "Das Summen überwältigt. Zu viele Stimmen, zu "
                    "fern, zu gleichzeitig. Funes' Müllhalde. "
                    "Die Gruppe weicht vor dem Signal zurück."
                ),
            ),
            EncounterChoice(
                id="humming_block",
                label_en="Block it out (Guardian)",
                label_de="Es ausblenden (Wächter)",
                check_aptitude="guardian",
                check_difficulty=-5,
                success_effects={"awareness": -3},
                partial_effects={},
                fail_effects={"awareness": 5},
                success_narrative_en=(
                    "{agent} maintains the boundary. The humming recedes. "
                    "The dungeon notes the refusal without judgment."
                ),
                success_narrative_de=(
                    "{agent} hält die Grenze aufrecht. Das Summen lässt nach. "
                    "Das Dungeon vermerkt die Weigerung ohne Urteil."
                ),
                fail_narrative_en=(
                    "The humming finds a way through. Not through the "
                    "walls \u2013 through the awareness itself."
                ),
                fail_narrative_de=(
                    "Das Summen findet einen Weg hindurch. Nicht durch "
                    "die Wände \u2013 durch das Bewusstsein selbst."
                ),
            ),
        ],
    ),
]

# ── Elite Encounter (1) ──────────────────────────────────────────────────

AWAKENING_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_threshold_gate",
        archetype="The Awakening",
        room_type="elite",
        min_depth=4,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "Before the Law. A gate between remembered and repressed. "
            "The Sentinel guards it \u2013 not with force, but with pity. "
            "This door was made only for the party. The Sentinel has "
            "waited their entire descent."
        ),
        description_de=(
            "Vor dem Gesetz. Ein Tor zwischen Erinnertem und Verdrängtem. "
            "Der Wächter hütet es \u2013 nicht mit Gewalt, sondern mit Mitleid. "
            "Dieses Tor wurde nur für die Gruppe gemacht. Der Wächter "
            "hat ihren gesamten Abstieg gewartet."
        ),
        combat_encounter_id="awakening_sentinel_spawn",
    ),
]

# ── Boss Encounter (1) ───────────────────────────────────────────────────

AWAKENING_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_the_repressed_boss",
        archetype="The Awakening",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "The room at the center. Tarkovsky's Room: it grants your "
            "true desire, not your stated one. The Repressed has been "
            "here the entire dungeon \u2013 in every room, behind every "
            "memory, inside every recognition. It is not a monster. "
            "It is the truth that was too heavy to carry and too "
            "important to destroy."
        ),
        description_de=(
            "Der Raum in der Mitte. Tarkowskis Raum: er gewährt den "
            "wahren Wunsch, nicht den ausgesprochenen. Das Verdrängte "
            "war das gesamte Dungeon hier \u2013 in jedem Raum, hinter jeder "
            "Erinnerung, in jeder Wiedererkennung. Es ist kein Monster. "
            "Es ist die Wahrheit, die zu schwer war, um sie zu tragen, "
            "und zu wichtig, um sie zu zerstören."
        ),
        combat_encounter_id="awakening_sentinel_spawn",
    ),
]

# ── Rest Encounters (2) ──────────────────────────────────────────────────

AWAKENING_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_quiet_layer",
        archetype="The Awakening",
        room_type="rest",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "A stratum of consciousness that is still. Not empty \u2013 "
            "calm. Like the pause between breaths. The dungeon's "
            "awareness rests here too. For a moment, the observer "
            "and the observed share the same silence."
        ),
        description_de=(
            "Eine Schicht des Bewusstseins, die still ist. Nicht leer \u2013 "
            "ruhig. Wie die Pause zwischen Atemzügen. Das Bewusstsein "
            "des Dungeons ruht hier ebenfalls. Für einen Moment teilen "
            "der Beobachter und das Beobachtete dieselbe Stille."
        ),
        choices=[
            EncounterChoice(
                id="quiet_rest",
                label_en="Rest in the quiet layer",
                label_de="In der stillen Schicht rasten",
                success_effects={"stress_heal": 40, "awareness": -5},
                success_narrative_en=(
                    "Silence. Not absence of sound \u2013 presence of peace. "
                    "The awareness recedes like a tide. The party is not "
                    "diminished. They are grounded."
                ),
                success_narrative_de=(
                    "Stille. Nicht Abwesenheit von Klang \u2013 Anwesenheit "
                    "von Frieden. Das Bewusstsein zieht sich zurück wie "
                    "eine Gezeit. Die Gruppe ist nicht vermindert. "
                    "Sie ist geerdet."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_forgetting_pool",
        archetype="The Awakening",
        room_type="rest",
        min_depth=3,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "Lethe. A pool of deliberate forgetting. Not a loss \u2013 "
            "a choice. The Oracle of Trophonius demands it: drink "
            "from Lethe first, to forget all prior thoughts. Then "
            "from Mnemosyne, to remember what you will see. "
            "Both rivers, sequentially."
        ),
        description_de=(
            "Lethe. Ein Becken des absichtlichen Vergessens. Kein "
            "Verlust \u2013 eine Wahl. Das Orakel des Trophonios verlangt "
            "es: trinke zuerst aus Lethe, um alle vorherigen Gedanken "
            "zu vergessen. Dann aus Mnemosyne, um zu erinnern, "
            "was du sehen wirst. Beide Flüsse, nacheinander."
        ),
        choices=[
            EncounterChoice(
                id="pool_drink",
                label_en="Drink from the pool (reduces awareness significantly)",
                label_de="Aus dem Becken trinken (senkt Bewusstsein erheblich)",
                success_effects={"stress_heal": 25, "awareness": -15, "stress": 5},
                success_narrative_en=(
                    "The party drinks. Awareness recedes sharply. Some "
                    "memories blur. Some details soften. The trade is "
                    "not free \u2013 forgetting is its own kind of labor. "
                    "But the mind is lighter."
                ),
                success_narrative_de=(
                    "Die Gruppe trinkt. Das Bewusstsein geht scharf "
                    "zurück. Manche Erinnerungen werden unscharf. "
                    "Manche Details weicher. Der Tausch ist nicht "
                    "kostenlos \u2013 Vergessen ist seine eigene Art von "
                    "Arbeit. Aber der Geist ist leichter."
                ),
            ),
        ],
    ),
]

# ── Treasure Encounters (2) ──────────────────────────────────────────────

AWAKENING_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="aw_crystallized_memory",
        archetype="The Awakening",
        room_type="treasure",
        min_depth=1,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "Consciousness, solidified. A lieu de mémoire \u2013 Nora's "
            "concept: a place where memory crystallizes because "
            "history would dissolve it. The artifact holds what the "
            "dungeon chose to preserve."
        ),
        description_de=(
            "Bewusstsein, verfestigt. Ein Lieu de Mémoire \u2013 Noras "
            "Konzept: ein Ort, an dem Erinnerung kristallisiert, "
            "weil Geschichte sie auflösen würde. Das Artefakt "
            "bewahrt, was das Dungeon zu bewahren wählte."
        ),
        choices=[
            EncounterChoice(
                id="crystal_take",
                label_en="Take the crystallized memory",
                label_de="Die kristallisierte Erinnerung nehmen",
                success_effects={"loot_tier": 1, "awareness": 3},
                success_narrative_en=(
                    "The crystal releases warmth on contact. Not physical "
                    "warmth \u2013 the warmth of recognition. The party has "
                    "gained something. The dungeon has lost something."
                ),
                success_narrative_de=(
                    "Der Kristall gibt bei Berührung Wärme ab. Nicht "
                    "physische Wärme \u2013 die Wärme der Wiedererkennung. "
                    "Die Gruppe hat etwas gewonnen. Das Dungeon hat "
                    "etwas verloren."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="aw_the_archive",
        archetype="The Awakening",
        room_type="treasure",
        min_depth=2,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "An archive. Not of documents \u2013 of impressions. Each "
            "shelf holds a sensation: the smell of rain on warm stone, "
            "the sound of a name almost remembered, the weight of a "
            "decision not yet made. Bergson's cone of memory: the "
            "totality of experience, compressed into accessible form."
        ),
        description_de=(
            "Ein Archiv. Nicht aus Dokumenten \u2013 aus Eindrücken. "
            "Jedes Regal hält eine Empfindung: den Geruch von Regen "
            "auf warmem Stein, den Klang eines fast erinnerten Namens, "
            "das Gewicht einer noch nicht getroffenen Entscheidung. "
            "Bergsons Erinnerungskegel: die Gesamtheit der Erfahrung, "
            "komprimiert in zugängliche Form."
        ),
        choices=[
            EncounterChoice(
                id="archive_browse",
                label_en="Browse the archive carefully",
                label_de="Das Archiv sorgfältig durchsehen",
                success_effects={"loot_tier": 2, "awareness": 5},
                success_narrative_en=(
                    "The party selects carefully. Not everything. "
                    "To think is to forget differences, to generalize, "
                    "to make abstractions. The archive rewards selection "
                    "over completeness."
                ),
                success_narrative_de=(
                    "Die Gruppe wählt sorgfältig. Nicht alles. "
                    "Denken heißt Unterschiede vergessen, verallgemeinern, "
                    "abstrahieren. Das Archiv belohnt Auswahl "
                    "gegenüber Vollständigkeit."
                ),
            ),
        ],
    ),
]

# ── Awakening Master List ────────────────────────────────────────────────

ALL_AWAKENING_ENCOUNTERS: list[EncounterTemplate] = (
    AWAKENING_COMBAT_ENCOUNTERS
    + AWAKENING_NARRATIVE_ENCOUNTERS
    + AWAKENING_ELITE_ENCOUNTERS
    + AWAKENING_BOSS_ENCOUNTERS
    + AWAKENING_REST_ENCOUNTERS
    + AWAKENING_TREASURE_ENCOUNTERS
)


# ══════════════════════════════════════════════════════════════════════════
#  THE OVERTHROW — Der Spiegelpalast
#  Every encounter is a negotiation. Every NPC is a political actor.
#  60% social encounters — the most political archetype.
# ══════════════════════════════════════════════════════════════════════════


# ── Overthrow Combat Encounters ──────────────────────────────────────────

OVERTHROW_COMBAT_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="ov_informer_patrol",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "Two figures in the corridor, checking papers. "
            "They are not soldiers — they are informers. "
            "The clipboard is more dangerous than a weapon."
        ),
        description_de=(
            "Zwei Gestalten im Korridor, Papiere prüfend. "
            "Sie sind keine Soldaten — sie sind Spitzel. "
            "Die Zwischenablage ist gefährlicher als eine Waffe."
        ),
        combat_encounter_id="overthrow_informer_patrol_spawn",
    ),
    EncounterTemplate(
        id="ov_propaganda_escort",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=2,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A propaganda agent, escorted by an informer. "
            "The agent carries revised documents. The revisions "
            "rewrite something the party remembers differently."
        ),
        description_de=(
            "Ein Propagandaagent, eskortiert von einem Spitzel. "
            "Der Agent trägt überarbeitete Dokumente. Die Überarbeitungen "
            "schreiben etwas um, das die Gruppe anders in Erinnerung hat."
        ),
        combat_encounter_id="overthrow_propaganda_patrol_spawn",
    ),
    EncounterTemplate(
        id="ov_enforcer_checkpoint",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A checkpoint. The enforcer does not ask for papers — "
            "the enforcer asks for allegiance. The question is "
            "not 'who are you' but 'who are you for.'"
        ),
        description_de=(
            "Ein Kontrollpunkt. Der Vollstrecker fragt nicht nach Papieren — "
            "der Vollstrecker fragt nach Treue. Die Frage ist "
            "nicht 'Wer seid ihr' sondern 'Für wen seid ihr.'"
        ),
        combat_encounter_id="overthrow_enforcer_squad_spawn",
    ),
    EncounterTemplate(
        id="ov_political_clash",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=3,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "Two faction operatives — a propagandist and an enforcer — "
            "from different factions, mid-argument. The argument "
            "has become kinetic. The party walks into the crossfire."
        ),
        description_de=(
            "Zwei Fraktionsagenten — ein Propagandist und ein Vollstrecker — "
            "aus verschiedenen Fraktionen, mitten im Streit. Der Streit "
            "ist kinetisch geworden. Die Gruppe gerät ins Kreuzfeuer."
        ),
        combat_encounter_id="overthrow_political_crisis_spawn",
    ),
    EncounterTemplate(
        id="ov_inquisition_encounter",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=4,
        max_depth=7,
        min_difficulty=2,
        description_en=(
            "The Grand Inquisitor waits. An informer takes notes. "
            "This is not an ambush — it is a tribunal. "
            "The party has already been found guilty. The sentence "
            "is an invitation to confess."
        ),
        description_de=(
            "Der Großinquisitor wartet. Ein Spitzel macht Notizen. "
            "Dies ist kein Hinterhalt — es ist ein Tribunal. "
            "Die Gruppe wurde bereits schuldig gesprochen. Das Urteil "
            "ist eine Einladung zum Geständnis."
        ),
        combat_encounter_id="overthrow_inquisition_spawn",
    ),
    EncounterTemplate(
        id="ov_purge_squad",
        archetype="The Overthrow",
        room_type="combat",
        min_depth=3,
        max_depth=7,
        min_difficulty=2,
        description_en=(
            "The revolution devours its children. Vergniaud's prophecy "
            "made operational: a squad sent to purge yesterday's allies. "
            "The enforcer leads. The informer has already filed the report."
        ),
        description_de=(
            "Die Revolution frisst ihre Kinder. Vergniauds Prophezeiung, "
            "operational gemacht: ein Trupp, gesandt um gestrige Verbündete "
            "zu säubern. Der Vollstrecker führt. Der Spitzel hat den "
            "Bericht bereits eingereicht."
        ),
        combat_encounter_id="overthrow_political_crisis_spawn",
    ),
]


# ── Overthrow Narrative Encounters ───────────────────────────────────────

OVERTHROW_NARRATIVE_ENCOUNTERS: list[EncounterTemplate] = [
    # ── The Faction Offer (Machiavelli) ──
    EncounterTemplate(
        id="ov_faction_offer",
        archetype="The Overthrow",
        room_type="encounter",
        min_depth=1,
        max_depth=3,
        min_difficulty=1,
        description_en=(
            "A faction representative approaches. The offer is simple: "
            "alliance in exchange for a service. The service is not "
            "specified in advance. Alliance offered. Alliance accepted. "
            "The cost will be announced later."
        ),
        description_de=(
            "Ein Fraktionsvertreter nähert sich. Das Angebot ist einfach: "
            "Bündnis im Austausch für einen Dienst. Der Dienst wird "
            "nicht im Voraus spezifiziert. Bündnis angeboten. "
            "Bündnis angenommen. Die Kosten werden später bekanntgegeben."
        ),
        choices=[
            EncounterChoice(
                id="faction_accept",
                label_en="Accept the alliance (Propagandist)",
                label_de="Das Bündnis annehmen (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=-5,
                success_effects={"fracture": 3, "faction_standing": {"current_floor_faction": 15}},
                partial_effects={"fracture": 5, "faction_standing": {"current_floor_faction": 8}},
                fail_effects={"fracture": 8, "stress": 10},
                success_narrative_en=(
                    "{agent} negotiates terms. The terms are favorable — "
                    "or appear to be. The representative nods. The alliance "
                    "is entered into the record. Records can be revised."
                ),
                success_narrative_de=(
                    "{agent} verhandelt die Bedingungen. Die Bedingungen sind "
                    "günstig — oder scheinen es zu sein. Der Vertreter nickt. "
                    "Das Bündnis wird aktenkundig. Akten können überarbeitet werden."
                ),
                partial_narrative_en=(
                    "{agent} negotiates. The terms are accepted — but the "
                    "representative adds a clause at the end, spoken too "
                    "quickly to parse. Machiavelli's fox: the contract "
                    "is signed. The footnote is not."
                ),
                partial_narrative_de=(
                    "{agent} verhandelt. Die Bedingungen werden akzeptiert — aber "
                    "der Vertreter fügt am Ende eine Klausel hinzu, zu schnell "
                    "gesprochen um sie zu erfassen. Machiavellis Fuchs: der Vertrag "
                    "ist unterschrieben. Die Fußnote nicht."
                ),
                fail_narrative_en=(
                    "The negotiation collapses. The representative's smile "
                    "does not change. The smile was never contingent "
                    "on the outcome."
                ),
                fail_narrative_de=(
                    "Die Verhandlung scheitert. Das Lächeln des Vertreters "
                    "ändert sich nicht. Das Lächeln war nie vom Ergebnis "
                    "abhängig."
                ),
            ),
            EncounterChoice(
                id="faction_spy",
                label_en="Gather intelligence on the faction first (Spy)",
                label_de="Erst Informationen über die Fraktion sammeln (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"fracture": 2},
                partial_effects={"fracture": 3},
                fail_effects={"fracture": 5, "stress": 5},
                success_narrative_en=(
                    "{agent} reads the offer beneath the offer. Every faction "
                    "has a second agenda. The Spy sees both."
                ),
                success_narrative_de=(
                    "{agent} liest das Angebot unter dem Angebot. Jede Fraktion "
                    "hat eine zweite Agenda. Der Spion sieht beide."
                ),
                partial_narrative_en=(
                    "{agent} sees the second agenda. But a third remains "
                    "hidden — Kadare's Palace has sub-basements. "
                    "Partial intelligence is the most dangerous kind."
                ),
                partial_narrative_de=(
                    "{agent} sieht die zweite Agenda. Aber eine dritte bleibt "
                    "verborgen — Kadares Palast hat Untergeschosse. "
                    "Teilwissen ist die gefährlichste Art."
                ),
                fail_narrative_en=(
                    "The intelligence is incomplete. What {agent} does not "
                    "know is being reported to someone else."
                ),
                fail_narrative_de=(
                    "Die Aufklärung ist unvollständig. Was {agent} nicht weiß, "
                    "wird jemand anderem gemeldet."
                ),
            ),
            EncounterChoice(
                id="faction_decline",
                label_en="Decline. Remain unaligned.",
                label_de="Ablehnen. Ungebunden bleiben.",
                success_effects={"fracture": 5},
                success_narrative_en=(
                    "The representative leaves. The absence of alliance "
                    "is itself a political statement. Neutrality is "
                    "the most expensive position in the Spiegelpalast."
                ),
                success_narrative_de=(
                    "Der Vertreter geht. Die Abwesenheit eines Bündnisses "
                    "ist selbst eine politische Aussage. Neutralität ist "
                    "die teuerste Position im Spiegelpalast."
                ),
            ),
        ],
    ),
    # ── The Show Trial (Koestler/Kiš) ──
    EncounterTemplate(
        id="ov_show_trial",
        archetype="The Overthrow",
        room_type="encounter",
        min_depth=2,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "A trial is in progress. The accused is a former faction leader. "
            "The evidence is their own biography — rewritten. "
            "Kiš's archival voice: clinical, footnoted, devastating. "
            "The verdict was decided before the trial began."
        ),
        description_de=(
            "Ein Prozess ist im Gange. Der Angeklagte ist ein ehemaliger "
            "Fraktionsführer. Der Beweis ist die eigene Biographie — umgeschrieben. "
            "Kišs Archivstimme: klinisch, fußnotiert, verheerend. "
            "Das Urteil stand vor Prozessbeginn fest."
        ),
        choices=[
            EncounterChoice(
                id="trial_defend",
                label_en="Speak in the accused's defense (Propagandist)",
                label_de="Zur Verteidigung des Angeklagten sprechen (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"fracture": -5, "stress_heal": 10},
                partial_effects={"fracture": 3},
                fail_effects={"fracture": 10, "stress": 15},
                success_narrative_en=(
                    "{agent} speaks. Antony's rhetoric: never say the accusers "
                    "are liars. Let the crowd arrive there themselves. "
                    "The tribunal hesitates. The accused is not freed — "
                    "but the sentence is deferred."
                ),
                success_narrative_de=(
                    "{agent} spricht. Antonius' Rhetorik: sag nie, dass die Ankläger "
                    "lügen. Lass die Menge selbst dorthin kommen. "
                    "Das Tribunal zögert. Der Angeklagte wird nicht befreit — "
                    "aber das Urteil wird aufgeschoben."
                ),
                partial_narrative_en=(
                    "{agent} speaks. The tribunal listens — but the way "
                    "Koestler's Gletkin listens: recording, not hearing. "
                    "The defense enters the record. The record is "
                    "another kind of evidence."
                ),
                partial_narrative_de=(
                    "{agent} spricht. Das Tribunal hört zu — aber so wie "
                    "Koestlers Gletkin zuhört: aufzeichnend, nicht hörend. "
                    "Die Verteidigung geht in die Akten ein. Die Akten sind "
                    "eine andere Art von Beweis."
                ),
                fail_narrative_en=(
                    "The defense fails. {agent}'s words are entered "
                    "into evidence — as proof of complicity."
                ),
                fail_narrative_de=(
                    "Die Verteidigung scheitert. {agent}s Worte werden "
                    "als Beweis aufgenommen — als Beweis der Mittäterschaft."
                ),
            ),
            EncounterChoice(
                id="trial_observe",
                label_en="Observe the trial's mechanism (Spy)",
                label_de="Den Mechanismus des Prozesses beobachten (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"fracture": 5},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 8, "stress": 5},
                success_narrative_en=(
                    "{agent} watches. The trial is not about guilt — "
                    "it is about demonstration. Brecht's Verfremdung: "
                    "once you see the mechanism, you cannot un-see it."
                ),
                success_narrative_de=(
                    "{agent} beobachtet. Der Prozess handelt nicht von Schuld — "
                    "er handelt von Demonstration. Brechts Verfremdung: "
                    "hat man den Mechanismus einmal gesehen, kann man es "
                    "nicht rückgängig machen."
                ),
                partial_narrative_en=(
                    "{agent} sees the mechanism — partially. Kiš's archive: "
                    "some footnotes are legible, others redacted. "
                    "The trial is a text. {agent} has read enough "
                    "to know the ending is already written."
                ),
                partial_narrative_de=(
                    "{agent} sieht den Mechanismus — teilweise. Kišs Archiv: "
                    "manche Fußnoten sind lesbar, andere geschwärzt. "
                    "Der Prozess ist ein Text. {agent} hat genug gelesen "
                    "um zu wissen, dass das Ende bereits geschrieben ist."
                ),
                fail_narrative_en=(
                    "The mechanism is visible. But visibility "
                    "is not protection."
                ),
                fail_narrative_de=(
                    "Der Mechanismus ist sichtbar. Aber Sichtbarkeit "
                    "ist kein Schutz."
                ),
            ),
            EncounterChoice(
                id="trial_pass",
                label_en="Leave before the verdict.",
                label_de="Vor dem Urteil gehen.",
                success_effects={"fracture": 3},
                success_narrative_en=(
                    "The party leaves. The trial continues without them. "
                    "Silence is complicity. But so is everything else."
                ),
                success_narrative_de=(
                    "Die Gruppe geht. Der Prozess geht ohne sie weiter. "
                    "Schweigen ist Mittäterschaft. Aber alles andere auch."
                ),
            ),
        ],
    ),
    # ── The Greengrocer's Window (Havel) ──
    EncounterTemplate(
        id="ov_greengrocers_window",
        archetype="The Overthrow",
        room_type="encounter",
        min_depth=1,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A room with signs. Each sign bears a slogan. The slogans "
            "are contradictory. To pass through, the party must display "
            "one. Havel's greengrocer: the sign means nothing. "
            "The act of displaying it means everything."
        ),
        description_de=(
            "Ein Raum mit Schildern. Jedes Schild trägt eine Parole. "
            "Die Parolen widersprechen sich. Um durchzukommen, muss die "
            "Gruppe eines zeigen. Havels Gemüsehändler: das Schild "
            "bedeutet nichts. Der Akt des Zeigens bedeutet alles."
        ),
        choices=[
            EncounterChoice(
                id="greengrocer_perform",
                label_en="Display the dominant faction's sign (Infiltrator)",
                label_de="Das Schild der dominanten Fraktion zeigen (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=-5,
                success_effects={"fracture": 3},
                partial_effects={"fracture": 4},
                fail_effects={"fracture": 6, "stress": 5},
                success_narrative_en=(
                    "The sign is displayed. No one checks if the party "
                    "believes it. Belief was never the point. "
                    "Performance is the currency of the Spiegelpalast."
                ),
                success_narrative_de=(
                    "Das Schild wird gezeigt. Niemand prüft, ob die Gruppe "
                    "daran glaubt. Glaube war nie der Punkt. "
                    "Aufführung ist die Währung des Spiegelpalasts."
                ),
                partial_narrative_en=(
                    "The sign is displayed. Someone pauses — reads it "
                    "a moment too long. Havel's greengrocer, observed: "
                    "the performance passes, but it has been noted. "
                    "Not the sign. The hesitation before it."
                ),
                partial_narrative_de=(
                    "Das Schild wird gezeigt. Jemand hält inne — liest es "
                    "einen Moment zu lang. Havels Gemüsehändler, beobachtet: "
                    "die Aufführung geht durch, aber sie wurde notiert. "
                    "Nicht das Schild. Das Zögern davor."
                ),
                fail_narrative_en=(
                    "The performance is unconvincing. Not the words — "
                    "the posture. The body knows what the mouth denies."
                ),
                fail_narrative_de=(
                    "Die Aufführung ist nicht überzeugend. Nicht die Worte — "
                    "die Haltung. Der Körper weiß, was der Mund leugnet."
                ),
            ),
            EncounterChoice(
                id="greengrocer_refuse",
                label_en="Refuse to display any sign. Live in truth. (Guardian)",
                label_de="Kein Schild zeigen. In der Wahrheit leben. (Wächter)",
                check_aptitude="guardian",
                check_difficulty=5,
                success_effects={"fracture": -3, "stress_heal": 15},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 10, "stress": 20},
                success_narrative_en=(
                    "Living in truth. {agent} refuses. One person who "
                    "refuses to perform exposes everyone else's performance "
                    "as a choice. The room changes. The signs are still there. "
                    "But something has shifted."
                ),
                success_narrative_de=(
                    "In der Wahrheit leben. {agent} verweigert sich. Eine Person, "
                    "die sich weigert aufzuführen, entlarvt die Aufführung "
                    "aller anderen als Wahl. Der Raum verändert sich. "
                    "Die Schilder sind noch da. Aber etwas hat sich verschoben."
                ),
                partial_narrative_en=(
                    "{agent} refuses. The room notices — but the silence "
                    "that follows is ambiguous. Arendt's distinction: "
                    "liberation, not yet freedom. The signs remain. "
                    "One person's refusal is not yet contagious."
                ),
                partial_narrative_de=(
                    "{agent} verweigert sich. Der Raum bemerkt es — aber die "
                    "Stille danach ist mehrdeutig. Arendts Unterscheidung: "
                    "Befreiung, noch nicht Freiheit. Die Schilder bleiben. "
                    "Die Verweigerung einer Person ist noch nicht ansteckend."
                ),
                fail_narrative_en=(
                    "The refusal costs. Living in truth is the most "
                    "expensive option in the Spiegelpalast."
                ),
                fail_narrative_de=(
                    "Die Verweigerung kostet. In der Wahrheit leben ist die "
                    "teuerste Option im Spiegelpalast."
                ),
            ),
            EncounterChoice(
                id="greengrocer_subvert",
                label_en="Display a sign with altered meaning (Saboteur)",
                label_de="Ein Schild mit veränderter Bedeutung zeigen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=0,
                success_effects={"fracture": 5},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 8, "stress": 10},
                success_narrative_en=(
                    "Détournement. Debord's weapon: hijack the spectacle "
                    "against itself. The sign says what it always said. "
                    "The meaning has been reversed."
                ),
                success_narrative_de=(
                    "Détournement. Debords Waffe: das Spektakel gegen sich "
                    "selbst wenden. Das Schild sagt, was es immer sagte. "
                    "Die Bedeutung wurde umgekehrt."
                ),
                partial_narrative_en=(
                    "The alteration holds — for now. Debord's détournement, "
                    "half-executed: the sign reads differently but {agent} "
                    "cannot be sure who reads it which way. "
                    "Ambiguity is a weapon that cuts both directions."
                ),
                partial_narrative_de=(
                    "Die Veränderung hält — vorerst. Debords Détournement, "
                    "halb ausgeführt: das Schild liest sich anders, aber {agent} "
                    "kann nicht sicher sein, wer es wie liest. "
                    "Mehrdeutigkeit ist eine Waffe, die in beide Richtungen schneidet."
                ),
                fail_narrative_en=(
                    "The subversion is detected. The sign is confiscated. "
                    "So is {agent}'s anonymity."
                ),
                fail_narrative_de=(
                    "Die Subversion wird entdeckt. Das Schild wird "
                    "konfisziert. Ebenso {agent}s Anonymität."
                ),
            ),
        ],
    ),
    # ── The Erased Portrait (Kundera) ──
    EncounterTemplate(
        id="ov_erased_portrait",
        archetype="The Overthrow",
        room_type="encounter",
        min_depth=2,
        max_depth=6,
        min_difficulty=1,
        description_en=(
            "A gallery of portraits. Several have been scratched out. "
            "The scratched-out faces were faction leaders, two floors ago. "
            "Kundera's Clementis photograph: the body erased, "
            "the hat remaining on Gottwald's head."
        ),
        description_de=(
            "Eine Galerie von Porträts. Mehrere wurden ausgekratzt. "
            "Die ausgekratzten Gesichter waren Fraktionsführer, zwei "
            "Etagen zuvor. Kunderas Clementis-Foto: der Körper "
            "gelöscht, die Pelzmütze noch auf Gottwalds Kopf."
        ),
        choices=[
            EncounterChoice(
                id="portrait_remember",
                label_en="Reconstruct the erased faces (Spy)",
                label_de="Die gelöschten Gesichter rekonstruieren (Spion)",
                check_aptitude="spy",
                check_difficulty=0,
                success_effects={"fracture": 5},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 8, "stress": 10},
                success_narrative_en=(
                    "The struggle against power is the struggle of memory "
                    "against forgetting. {agent} remembers. The portraits "
                    "do not reappear — but the party knows what was there."
                ),
                success_narrative_de=(
                    "Der Kampf gegen die Macht ist der Kampf der Erinnerung "
                    "gegen das Vergessen. {agent} erinnert sich. Die Porträts "
                    "erscheinen nicht wieder — aber die Gruppe weiß, "
                    "was dort war."
                ),
                partial_narrative_en=(
                    "{agent} remembers some faces. Others dissolve — "
                    "Kundera's Clementis: the hat remains on Gottwald's head, "
                    "but whose hat was it? Memory reconstructs. "
                    "Reconstruction edits."
                ),
                partial_narrative_de=(
                    "{agent} erinnert sich an einige Gesichter. Andere lösen sich auf — "
                    "Kunderas Clementis: die Mütze bleibt auf Gottwalds Kopf, "
                    "aber wessen Mütze war es? Erinnerung rekonstruiert. "
                    "Rekonstruktion redigiert."
                ),
                fail_narrative_en=(
                    "Memory fails. Not naturally — actively. "
                    "Something in the Spiegelpalast assists forgetting."
                ),
                fail_narrative_de=(
                    "Die Erinnerung versagt. Nicht natürlich — aktiv. "
                    "Etwas im Spiegelpalast unterstützt das Vergessen."
                ),
            ),
            EncounterChoice(
                id="portrait_erase_more",
                label_en="Add current leaders to the erasure (Saboteur)",
                label_de="Aktuelle Anführer zur Löschung hinzufügen (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=0,
                success_effects={"fracture": 8},
                partial_effects={"fracture": 6},
                fail_effects={"fracture": 3, "stress": 5},
                success_narrative_en=(
                    "Turnabout. {agent} scratches out the current leaders. "
                    "The revolution that erased the old order "
                    "is now being erased itself. The cycle continues."
                ),
                success_narrative_de=(
                    "Umkehr. {agent} kratzt die aktuellen Anführer aus. "
                    "Die Revolution, die die alte Ordnung löschte, "
                    "wird nun selbst gelöscht. Der Kreislauf geht weiter."
                ),
                partial_narrative_en=(
                    "{agent} scratches. Some faces are erased. Others "
                    "resist — the paint is newer, the varnish thicker. "
                    "Camus: every revolutionary ends as oppressor or heretic. "
                    "The erasure is incomplete. So is the revolution."
                ),
                partial_narrative_de=(
                    "{agent} kratzt. Manche Gesichter werden gelöscht. Andere "
                    "widerstehen — die Farbe ist neuer, der Lack dicker. "
                    "Camus: jeder Revolutionär endet als Unterdrücker oder Ketzer. "
                    "Die Löschung ist unvollständig. Die Revolution auch."
                ),
                fail_narrative_en=(
                    "The scratching is noticed. Someone is always watching "
                    "the watchers."
                ),
                fail_narrative_de=(
                    "Das Kratzen wird bemerkt. Jemand beobachtet immer "
                    "die Beobachter."
                ),
            ),
            EncounterChoice(
                id="portrait_pass",
                label_en="Walk past. Do not engage with the erasure.",
                label_de="Vorbeigehen. Sich nicht auf die Löschung einlassen.",
                success_effects={"fracture": 3},
                success_narrative_en=(
                    "The party walks past. The gallery continues. "
                    "There will be more portraits. There will be more erasures."
                ),
                success_narrative_de=(
                    "Die Gruppe geht vorbei. Die Galerie geht weiter. "
                    "Es wird mehr Porträts geben. Es wird mehr Löschungen geben."
                ),
            ),
        ],
    ),
    # ── The Variety Theater (Bulgakov) ──
    EncounterTemplate(
        id="ov_variety_theater",
        archetype="The Overthrow",
        room_type="encounter",
        min_depth=3,
        max_depth=7,
        min_difficulty=1,
        description_en=(
            "Bulgakov's Variety Theater. Money rains from the ceiling. "
            "The factions scramble. In three rooms, the money will "
            "turn to blank paper. But right now, it is real. "
            "The question: what do the factions do when given "
            "exactly what they want?"
        ),
        description_de=(
            "Bulgakows Varietétheater. Geld regnet von der Decke. "
            "Die Fraktionen stürzen sich darauf. In drei Räumen wird "
            "das Geld zu leerem Papier. Aber gerade jetzt ist es echt. "
            "Die Frage: was tun die Fraktionen, wenn sie genau "
            "das bekommen, was sie wollen?"
        ),
        choices=[
            EncounterChoice(
                id="theater_observe",
                label_en="Watch the factions reveal themselves (Spy)",
                label_de="Beobachten, wie die Fraktionen sich offenbaren (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"fracture": 5},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 7, "stress": 5},
                success_narrative_en=(
                    "Woland's experiment, reproduced. {agent} watches. "
                    "When given what they desire, every faction reveals "
                    "what they truly are. The intelligence is invaluable."
                ),
                success_narrative_de=(
                    "Wolands Experiment, reproduziert. {agent} beobachtet. "
                    "Wenn sie bekommen, was sie begehren, offenbart jede "
                    "Fraktion, was sie wirklich ist. Die Aufklärung ist "
                    "unbezahlbar."
                ),
                partial_narrative_en=(
                    "{agent} watches. Some factions reveal themselves. "
                    "Others perform even while scrambling — Bulgakov's "
                    "observation: greed has its own theater. "
                    "The picture is incomplete but telling."
                ),
                partial_narrative_de=(
                    "{agent} beobachtet. Manche Fraktionen offenbaren sich. "
                    "Andere spielen auch beim Gerangel Theater — Bulgakows "
                    "Beobachtung: Gier hat ihr eigenes Theater. "
                    "Das Bild ist unvollständig, aber aufschlussreich."
                ),
                fail_narrative_en=(
                    "{agent} watches. But watching is also a position. "
                    "The one who does not scramble is noticed."
                ),
                fail_narrative_de=(
                    "{agent} beobachtet. Aber Beobachten ist auch eine "
                    "Position. Wer nicht mitrennt, wird bemerkt."
                ),
            ),
            EncounterChoice(
                id="theater_participate",
                label_en="Join the scramble. Resources matter. (Infiltrator)",
                label_de="Mitmachen. Ressourcen zählen. (Infiltrator)",
                check_aptitude="infiltrator",
                check_difficulty=0,
                success_effects={"fracture": 5, "loot_tier": 1},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 8, "stress": 10},
                success_narrative_en=(
                    "Erst kommt das Fressen, dann kommt die Moral. "
                    "{agent} secures resources. The money may turn to paper. "
                    "But the alliances formed during the scramble are real."
                ),
                success_narrative_de=(
                    "Erst kommt das Fressen, dann kommt die Moral. "
                    "{agent} sichert Ressourcen. Das Geld mag zu Papier werden. "
                    "Aber die Bündnisse, die beim Gerangel entstehen, sind echt."
                ),
                partial_narrative_en=(
                    "{agent} secures something — but the scramble is "
                    "already sorting winners from losers. Brecht's "
                    "observation: the Fressen was real. Whether "
                    "the Moral follows remains to be seen."
                ),
                partial_narrative_de=(
                    "{agent} sichert etwas — aber das Gerangel sortiert "
                    "bereits Gewinner von Verlierern. Brechts Beobachtung: "
                    "das Fressen war echt. Ob die Moral folgt, "
                    "bleibt abzuwarten."
                ),
                fail_narrative_en=(
                    "The scramble turns ugly. Material interest "
                    "stripped of ideology. Brecht was right."
                ),
                fail_narrative_de=(
                    "Das Gerangel wird hässlich. Materielles Interesse, "
                    "von Ideologie befreit. Brecht hatte Recht."
                ),
            ),
            EncounterChoice(
                id="theater_warn",
                label_en="Warn the factions: this is a trap.",
                label_de="Die Fraktionen warnen: das ist eine Falle.",
                success_effects={"fracture": -3},
                success_narrative_en=(
                    "The warning is issued. Some listen. Most do not. "
                    "Manuscripts don't burn. But money does."
                ),
                success_narrative_de=(
                    "Die Warnung wird ausgesprochen. Manche hören zu. "
                    "Die meisten nicht. Manuskripte brennen nicht. "
                    "Aber Geld schon."
                ),
            ),
        ],
    ),
]


# ── Overthrow Elite Encounters ───────────────────────────────────────────

OVERTHROW_ELITE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="ov_grand_inquisitor",
        archetype="The Overthrow",
        room_type="elite",
        min_depth=3,
        max_depth=7,
        min_difficulty=1,
        description_en=(
            "The Grand Inquisitor's chamber. Three seats: miracle, mystery, "
            "authority. Dostoevsky's three powers, made architectural. "
            "The Inquisitor does not ask questions. The Inquisitor "
            "provides the answers and waits for the party to agree."
        ),
        description_de=(
            "Die Kammer des Großinquisitors. Drei Sitze: Wunder, Geheimnis, "
            "Autorität. Dostojewskis drei Mächte, architektonisch umgesetzt. "
            "Der Inquisitor stellt keine Fragen. Der Inquisitor "
            "liefert die Antworten und wartet, dass die Gruppe zustimmt."
        ),
        choices=[
            EncounterChoice(
                id="inquisitor_debate",
                label_en="Engage in philosophical debate (Propagandist)",
                label_de="Sich auf philosophische Debatte einlassen (Propagandist)",
                check_aptitude="propagandist",
                check_difficulty=5,
                success_effects={"fracture": -5, "stress_heal": 15},
                partial_effects={"fracture": 5},
                fail_effects={"fracture": 10, "stress": 20},
                success_narrative_en=(
                    "Koestler's two ethics, wielded against the Inquisitor. "
                    "{agent} does not win the debate — {agent} makes the "
                    "Inquisitor's logic visible. The mechanism, once exposed, "
                    "loses its hold."
                ),
                success_narrative_de=(
                    "Koestlers zwei Ethiken, gegen den Inquisitor gewandt. "
                    "{agent} gewinnt die Debatte nicht — {agent} macht die "
                    "Logik des Inquisitors sichtbar. Der Mechanismus, einmal "
                    "entlarvt, verliert seinen Griff."
                ),
                fail_narrative_en=(
                    "The Inquisitor's logic is self-sealing. Given the "
                    "premises, confession is the logical conclusion. "
                    "{agent} follows the path and recoils."
                ),
                fail_narrative_de=(
                    "Die Logik des Inquisitors ist selbstversiegelnd. "
                    "Ausgehend von den Prämissen ist das Geständnis die "
                    "logische Schlussfolgerung. {agent} folgt dem Pfad "
                    "und schreckt zurück."
                ),
            ),
            EncounterChoice(
                id="inquisitor_fight",
                label_en="Reject the tribunal. Fight.",
                label_de="Das Tribunal ablehnen. Kämpfen.",
                success_effects={},
                success_narrative_en=(
                    "Words have failed. Or words were never the point. "
                    "The Inquisitor rises. The informer reaches for a weapon."
                ),
                success_narrative_de=(
                    "Worte haben versagt. Oder Worte waren nie der Punkt. "
                    "Der Inquisitor erhebt sich. Der Spitzel greift zur Waffe."
                ),
            ),
        ],
        combat_encounter_id="overthrow_inquisition_spawn",
    ),
]


# ── Overthrow Boss Encounter ─────────────────────────────────────────────

OVERTHROW_BOSS_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="ov_the_pretender_boss",
        archetype="The Overthrow",
        room_type="boss",
        min_depth=4,
        max_depth=99,
        min_difficulty=1,
        description_en=(
            "Der Spiegelpalast reveals its center: a throne room where "
            "every mirror reflects a different version of the same face. "
            "The Pretender sits. Milton's Satan at the zenith: magnificent, "
            "eloquent, utterly convinced. 'Better to reign in Hell, than "
            "serve in Heaven.' The deterioration has not yet begun. "
            "It begins now."
        ),
        description_de=(
            "Der Spiegelpalast enthüllt sein Zentrum: ein Thronsaal, "
            "in dem jeder Spiegel eine andere Version desselben Gesichts "
            "reflektiert. Der Prätendent sitzt. Miltons Satan am Zenit: "
            "prächtig, eloquent, vollkommen überzeugt. 'Besser in der "
            "Hölle herrschen als im Himmel dienen.' Die Zersetzung hat "
            "noch nicht begonnen. Sie beginnt jetzt."
        ),
        combat_encounter_id="overthrow_pretender_spawn",
    ),
]


# ── Overthrow Rest Encounters ────────────────────────────────────────────

OVERTHROW_REST_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="ov_safe_house",
        archetype="The Overthrow",
        room_type="rest",
        min_depth=1,
        max_depth=4,
        min_difficulty=1,
        description_en=(
            "A safe house. The walls are thin. The conversations "
            "on the other side are about the party. But for now, "
            "the door is closed."
        ),
        description_de=(
            "Ein sicheres Haus. Die Wände sind dünn. Die Gespräche "
            "auf der anderen Seite handeln von der Gruppe. Aber "
            "vorerst ist die Tür geschlossen."
        ),
        choices=[
            EncounterChoice(
                id="safehouse_rest",
                label_en="Rest. Brief respite from the crisis.",
                label_de="Rasten. Kurze Atempause in der Krise.",
                success_effects={"stress_heal": 40, "fracture": -3},
                success_narrative_en=(
                    "The party rests. Behind the wall, the factions "
                    "continue without them. The rest is genuine. "
                    "The safety is not."
                ),
                success_narrative_de=(
                    "Die Gruppe rastet. Hinter der Wand machen die "
                    "Fraktionen ohne sie weiter. Die Rast ist echt. "
                    "Die Sicherheit nicht."
                ),
            ),
            EncounterChoice(
                id="safehouse_eavesdrop",
                label_en="Listen through the wall (Spy)",
                label_de="Durch die Wand lauschen (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"stress_heal": 25, "fracture": 2},
                partial_effects={"stress_heal": 20},
                fail_effects={"stress_heal": 15, "stress": 5},
                success_narrative_en=(
                    "Koestler's tapping code. {agent} listens. "
                    "The intelligence is useful. The knowledge that "
                    "everyone is being discussed is less so."
                ),
                success_narrative_de=(
                    "Koestlers Klopfzeichen. {agent} lauscht. "
                    "Die Aufklärung ist nützlich. Das Wissen, "
                    "dass alle besprochen werden, weniger."
                ),
                fail_narrative_en=(
                    "The wall is thinner than expected. "
                    "In both directions."
                ),
                fail_narrative_de=(
                    "Die Wand ist dünner als erwartet. "
                    "In beiden Richtungen."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="ov_neutral_ground",
        archetype="The Overthrow",
        room_type="rest",
        min_depth=3,
        max_depth=7,
        min_difficulty=1,
        description_en=(
            "Neutral ground. All factions have agreed — temporarily — "
            "that this room is outside the game. The agreement holds "
            "because all sides are exhausted. Camus: one must imagine "
            "Sisyphus happy. The boulder rests here."
        ),
        description_de=(
            "Neutrales Gelände. Alle Fraktionen haben sich — vorübergehend — "
            "darauf geeinigt, dass dieser Raum außerhalb des Spiels liegt. "
            "Die Vereinbarung hält, weil alle Seiten erschöpft sind. "
            "Camus: man muss sich Sisyphos als glücklichen Menschen "
            "vorstellen. Der Felsbrocken ruht hier."
        ),
        choices=[
            EncounterChoice(
                id="neutral_rest",
                label_en="Rest on neutral ground.",
                label_de="Auf neutralem Gelände rasten.",
                success_effects={"stress_heal": 50, "fracture": -5},
                success_narrative_en=(
                    "The boulder rests. The party rests. "
                    "The silence is the first honest thing "
                    "the Spiegelpalast has offered."
                ),
                success_narrative_de=(
                    "Der Felsbrocken ruht. Die Gruppe ruht. "
                    "Die Stille ist das erste Ehrliche, "
                    "das der Spiegelpalast angeboten hat."
                ),
            ),
        ],
    ),
]


# ── Overthrow Treasure Encounters ────────────────────────────────────────

OVERTHROW_TREASURE_ENCOUNTERS: list[EncounterTemplate] = [
    EncounterTemplate(
        id="ov_faction_archive",
        archetype="The Overthrow",
        room_type="treasure",
        min_depth=1,
        max_depth=5,
        min_difficulty=1,
        description_en=(
            "An archive. Dossiers on every faction, every leader, "
            "every operative. Kadare's Palace of Dreams — except "
            "these are waking reports, not sleeping ones."
        ),
        description_de=(
            "Ein Archiv. Dossiers über jede Fraktion, jeden Anführer, "
            "jeden Agenten. Kadares Palast der Träume — nur dass "
            "dies Wachberichte sind, keine Schlafberichte."
        ),
        choices=[
            EncounterChoice(
                id="archive_study",
                label_en="Study the dossiers carefully (Spy)",
                label_de="Die Dossiers sorgfältig studieren (Spion)",
                check_aptitude="spy",
                check_difficulty=-5,
                success_effects={"fracture": 3, "loot_tier": 1},
                partial_effects={"fracture": 3, "loot_tier": 1},
                fail_effects={"fracture": 5, "stress": 5},
                success_narrative_en=(
                    "Intelligence. Names, alliances, debts. "
                    "{agent} takes what can be carried. "
                    "The rest will be here for whoever comes next."
                ),
                success_narrative_de=(
                    "Aufklärung. Namen, Bündnisse, Schulden. "
                    "{agent} nimmt, was getragen werden kann. "
                    "Der Rest wird hier sein für den, der als Nächster kommt."
                ),
                partial_narrative_en=(
                    "Names, alliances — but the debts are encoded. "
                    "Kadare's dream interpreters: the raw material is "
                    "here. The interpretation requires context "
                    "{agent} does not yet possess."
                ),
                partial_narrative_de=(
                    "Namen, Bündnisse — aber die Schulden sind verschlüsselt. "
                    "Kadares Traumdeuter: das Rohmaterial ist da. "
                    "Die Interpretation erfordert Kontext, den "
                    "{agent} noch nicht besitzt."
                ),
                fail_narrative_en=(
                    "The dossiers are incomplete. Or they have been "
                    "pre-edited for whoever found them."
                ),
                fail_narrative_de=(
                    "Die Dossiers sind unvollständig. Oder sie wurden "
                    "für den Finder vorbearbeitet."
                ),
            ),
            EncounterChoice(
                id="archive_take",
                label_en="Take everything. Sort later.",
                label_de="Alles mitnehmen. Später sortieren.",
                success_effects={"fracture": 5, "loot_tier": 1},
                success_narrative_en=(
                    "The party takes everything. Quantity over analysis. "
                    "Somewhere in the stack is something important. "
                    "Also somewhere in the stack: misinformation."
                ),
                success_narrative_de=(
                    "Die Gruppe nimmt alles mit. Quantität statt Analyse. "
                    "Irgendwo im Stapel ist etwas Wichtiges. "
                    "Ebenfalls irgendwo im Stapel: Desinformation."
                ),
            ),
        ],
    ),
    EncounterTemplate(
        id="ov_confiscated_assets",
        archetype="The Overthrow",
        room_type="treasure",
        min_depth=3,
        max_depth=7,
        min_difficulty=1,
        description_en=(
            "A room of confiscated assets. Former leaders' possessions, "
            "labeled and catalogued. Each label is a name. "
            "Each name is scratched out."
        ),
        description_de=(
            "Ein Raum mit beschlagnahmten Gütern. Besitztümer ehemaliger "
            "Anführer, beschriftet und katalogisiert. Jedes Etikett "
            "ist ein Name. Jeder Name ist durchgestrichen."
        ),
        choices=[
            EncounterChoice(
                id="assets_salvage",
                label_en="Salvage what is useful (Saboteur)",
                label_de="Retten, was nützlich ist (Saboteur)",
                check_aptitude="saboteur",
                check_difficulty=0,
                success_effects={"fracture": 3, "loot_tier": 1},
                partial_effects={"loot_tier": 1},
                fail_effects={"fracture": 5, "stress": 5},
                success_narrative_en=(
                    "{agent} finds something. The previous owner "
                    "will not be needing it. The scratched-out name "
                    "on the label tells its own story."
                ),
                success_narrative_de=(
                    "{agent} findet etwas. Der vorherige Besitzer "
                    "wird es nicht mehr brauchen. Der durchgestrichene "
                    "Name auf dem Etikett erzählt seine eigene Geschichte."
                ),
                partial_narrative_en=(
                    "{agent} salvages. Some labels are legible, others "
                    "deliberately smeared. Ngũgĩ's observation: what "
                    "the regime confiscates tells you what it fears. "
                    "The catalogue is partial. The fear is not."
                ),
                partial_narrative_de=(
                    "{agent} birgt. Manche Etiketten sind lesbar, andere "
                    "absichtlich verwischt. Ngũgĩs Beobachtung: was "
                    "das Regime beschlagnahmt, verrät, wovor es sich fürchtet. "
                    "Der Katalog ist unvollständig. Die Furcht nicht."
                ),
                fail_narrative_en=(
                    "The assets are trapped — not physically, "
                    "but politically. Taking them signals allegiance "
                    "to the faction that confiscated them."
                ),
                fail_narrative_de=(
                    "Die Güter sind eine Falle — nicht physisch, "
                    "sondern politisch. Sie zu nehmen signalisiert "
                    "Treue zur Fraktion, die sie beschlagnahmte."
                ),
            ),
            EncounterChoice(
                id="assets_leave",
                label_en="Leave the dead their possessions.",
                label_de="Den Toten ihren Besitz lassen.",
                success_effects={"fracture": -2},
                success_narrative_en=(
                    "Respect for the erased. The party takes nothing. "
                    "In the Spiegelpalast, this is itself a political act."
                ),
                success_narrative_de=(
                    "Respekt vor den Gelöschten. Die Gruppe nimmt nichts. "
                    "Im Spiegelpalast ist auch das ein politischer Akt."
                ),
            ),
        ],
    ),
]


# ── Overthrow Master List ────────────────────────────────────────────────

ALL_OVERTHROW_ENCOUNTERS: list[EncounterTemplate] = (
    OVERTHROW_COMBAT_ENCOUNTERS
    + OVERTHROW_NARRATIVE_ENCOUNTERS
    + OVERTHROW_ELITE_ENCOUNTERS
    + OVERTHROW_BOSS_ENCOUNTERS
    + OVERTHROW_REST_ENCOUNTERS
    + OVERTHROW_TREASURE_ENCOUNTERS
)


# ── Archetype Encounter Registry ──────────────────────────────────────────

_ENCOUNTER_REGISTRIES: dict[str, list[EncounterTemplate]] = {
    "The Shadow": ALL_SHADOW_ENCOUNTERS,
    "The Tower": ALL_TOWER_ENCOUNTERS,
    "The Entropy": ALL_ENTROPY_ENCOUNTERS,
    "The Devouring Mother": ALL_MOTHER_ENCOUNTERS,
    "The Prometheus": ALL_PROMETHEUS_ENCOUNTERS,
    "The Deluge": ALL_DELUGE_ENCOUNTERS,
    "The Awakening": ALL_AWAKENING_ENCOUNTERS,
    "The Overthrow": ALL_OVERTHROW_ENCOUNTERS,
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
    from backend.services.dungeon_content_service import get_encounter_by_id_cached

    return get_encounter_by_id_cached(encounter_id)


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
    from backend.services.dungeon_content_service import get_encounter_registry

    encounter_pool = get_encounter_registry().get(archetype, [])
    candidates = [
        e
        for e in encounter_pool
        if e.room_type == room_type and e.min_depth <= depth <= e.max_depth and difficulty >= e.min_difficulty
    ]
    if not candidates:
        return None
    return random.choice(candidates)


