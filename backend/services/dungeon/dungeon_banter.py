"""Dungeon banter templates — archetype-specific between-encounter dialogue.

Personality-filtered, trigger-based banter for party agents during dungeon runs.
Template pool per trigger type. NOT LLM-generated.

All text is bilingual (en/de) inline per architecture decision #3.
"""

from __future__ import annotations

import random

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


# ── Prometheus Banter ─────────────────────────────────────────────────────
# Innovation fever. The workshop is alive. Components have personality.
# Humor permitted (Lem). German compound nouns. Procedural narration.
# insight_tier: 0=cold forge, 1=warming, 2=inspired, 3=feverish/breakthrough.

PROMETHEUS_BANTER: list[dict] = [
    # ── Room Entered (10: 3×t0, 3×t1, 2×t2, 2×t3) ──────────────────────
    {
        "id": "pb_01",
        "trigger": "room_entered",
        "insight_tier": 0,
        "personality_filter": {"openness": (0.6, 1.0)},
        "text_en": (
            "{agent} scans the workbench. Tools arranged by a system that is "
            "not alphabetical, not chronological, not any system {agent} recognizes. "
            "But organized. Precisely organized."
        ),
        "text_de": (
            "{agent} scannt die Werkbank. Werkzeuge, angeordnet nach einem System, "
            "das nicht alphabetisch ist, nicht chronologisch, kein System, das "
            "{agent} erkennt. Aber geordnet. Präzise geordnet."
        ),
    },
    {
        "id": "pb_02",
        "trigger": "room_entered",
        "insight_tier": 0,
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "The instruments register heat. Not from a source \u2013 from the room itself. The walls are warm. The floor is warm. The air conducts.",
        "text_de": "Die Instrumente registrieren Hitze. Nicht von einer Quelle \u2013 vom Raum selbst. Die Wände sind warm. Der Boden ist warm. Die Luft leitet.",
    },
    {
        "id": "pb_03",
        "trigger": "room_entered",
        "insight_tier": 0,
        "personality_filter": {},
        "text_en": "A workbench. Clean. Expectant. The kind of clean that suggests recent use, not abandonment.",
        "text_de": "Eine Werkbank. Sauber. Erwartungsvoll. Die Art von Sauberkeit, die auf kürzliche Benutzung hindeutet, nicht auf Verlassenheit.",
    },
    {
        "id": "pb_04",
        "trigger": "room_entered",
        "insight_tier": 1,
        "personality_filter": {"openness": (0.6, 1.0)},
        "text_en": "{agent}: 'The reagents are sorting themselves. Did anyone else see that? The reagents are sorting themselves.'",
        "text_de": "{agent}: \u00bbDie Reagenzien sortieren sich selbst. Hat das sonst jemand gesehen? Die Reagenzien sortieren sich selbst.\u00ab",
    },
    {
        "id": "pb_05",
        "trigger": "room_entered",
        "insight_tier": 1,
        "personality_filter": {"neuroticism": (0.0, 0.4)},
        "text_en": "The workshop hums. Not electrically \u2013 deliberately. A sustained note of anticipation, as if the room knows what the party has not yet decided to build.",
        "text_de": "Die Werkstatt summt. Nicht elektrisch \u2013 absichtlich. Ein gehaltener Ton der Erwartung, als wüsste der Raum, was der Trupp noch nicht zu bauen beschlossen hat.",
    },
    {
        "id": "pb_06",
        "trigger": "room_entered",
        "insight_tier": 1,
        "personality_filter": {},
        "text_en": "On the wall: a formula. Half the variables are in a notation {agent} doesn't recognize. The other half are disturbingly familiar.",
        "text_de": "An der Wand: eine Formel. Die Hälfte der Variablen ist in einer Notation, die {agent} nicht erkennt. Die andere Hälfte ist beunruhigend vertraut.",
    },
    {
        "id": "pb_07",
        "trigger": "room_entered",
        "insight_tier": 2,
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": (
            "The components in {agent}'s pack shift. Not settling \u2013 rearranging. "
            "They have preferences about proximity. The metal does not want to be "
            "near the powder."
        ),
        "text_de": (
            "Die Komponenten in {agent}s Rucksack bewegen sich. Kein Setzen \u2013 "
            "Umordnen. Sie haben Präferenzen bezüglich Nähe. Das Metall will nicht "
            "neben dem Pulver sein."
        ),
    },
    {
        "id": "pb_08",
        "trigger": "room_entered",
        "insight_tier": 2,
        "personality_filter": {},
        "text_en": "\u00bbDie Werkstatt ordnet sich um.\u00ab The workshop rearranges itself. Tools migrate to different shelves. The anvil has moved three inches to the left. Nobody touched it.",
        "text_de": "\u00bbDie Werkstatt ordnet sich um.\u00ab Werkzeuge wandern in andere Regale. Der Amboss hat sich drei Zentimeter nach links bewegt. Niemand hat ihn berührt.",
    },
    {
        "id": "pb_09",
        "trigger": "room_entered",
        "insight_tier": 3,
        "personality_filter": {"neuroticism": (0.5, 1.0)},
        "text_en": (
            "{agent}'s hands are shaking. Not from fear. From something worse: "
            "the absolute certainty that the next combination will work. "
            "The fire knows. {agent} knows the fire knows."
        ),
        "text_de": (
            "{agent}s Hände zittern. Nicht vor Angst. Vor etwas Schlimmerem: "
            "der absoluten Gewissheit, dass die nächste Kombination funktionieren wird. "
            "Das Feuer weiß es. {agent} weiß, dass das Feuer es weiß."
        ),
    },
    {
        "id": "pb_10",
        "trigger": "room_entered",
        "insight_tier": 3,
        "personality_filter": {},
        "text_en": (
            "The workshop is no longer subtle. Surfaces glow. Materials levitate "
            "briefly before settling. The air tastes of ozone and ambition. "
            "Something in this room is about to happen whether the party "
            "participates or not."
        ),
        "text_de": (
            "Die Werkstatt ist nicht mehr subtil. Oberflächen glühen. Materialien "
            "schweben kurz, bevor sie sich setzen. Die Luft schmeckt nach Ozon und "
            "Ambition. Etwas in diesem Raum wird gleich passieren, ob der Trupp "
            "teilnimmt oder nicht."
        ),
    },
    # ── Depth Change (3) ─────────────────────────────────────────────────
    {
        "id": "pb_11",
        "trigger": "depth_change",
        "insight_tier": 0,
        "personality_filter": {},
        "text_en": "Deeper. The workshop's complexity increases. The tools here are not for amateur hands.",
        "text_de": "Tiefer. Die Komplexität der Werkstatt nimmt zu. Die Werkzeuge hier sind nicht für Laienhände.",
    },
    {
        "id": "pb_12",
        "trigger": "depth_change",
        "insight_tier": 1,
        "personality_filter": {},
        "text_en": "The forge-heat intensifies with depth. The workshop is revealing its inner chambers \u2013 the rooms where the serious work happens.",
        "text_de": "Die Schmiedehitze intensiviert sich mit der Tiefe. Die Werkstatt enthüllt ihre inneren Kammern \u2013 die Räume, in denen die ernsthafte Arbeit stattfindet.",
    },
    {
        "id": "pb_13",
        "trigger": "depth_change",
        "insight_tier": 2,
        "personality_filter": {},
        "text_en": (
            "This deep, the workshop stops pretending to be a place. "
            "It is a process. The party is inside the process now."
        ),
        "text_de": (
            "So tief hört die Werkstatt auf, ein Ort zu sein. "
            "Sie ist ein Prozess. Der Trupp ist jetzt im Prozess."
        ),
    },
    # ── Elite Spotted (2) ─────────────────────────────────────────────────
    {
        "id": "pb_14",
        "trigger": "elite_spotted",
        "personality_filter": {},
        "text_en": "Ahead: something that was built with intent. Not the workshop's ambient creations \u2013 a deliberate construct. It works at something. It does not wish to be interrupted.",
        "text_de": "Voraus: etwas, das mit Absicht gebaut wurde. Nicht die Zufallsschöpfungen der Werkstatt \u2013 ein absichtliches Konstrukt. Es arbeitet an etwas. Es wünscht nicht, unterbrochen zu werden.",
    },
    {
        "id": "pb_15",
        "trigger": "elite_spotted",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} stops. 'That one is different. That one was MADE.'",
        "text_de": "{agent} hält inne. \u00bbDas da ist anders. Das wurde GEMACHT.\u00ab",
    },
    # ── Boss Approach (2) ────────────────────────────────────────────────
    {
        "id": "pb_16",
        "trigger": "boss_approach",
        "personality_filter": {},
        "text_en": (
            "The workshop contracts. All corridors converge. Ahead: the central "
            "chamber. The heat is absolute. Something inside is functioning "
            "with the confidence of a finished thing. It is not finished."
        ),
        "text_de": (
            "Die Werkstatt zieht sich zusammen. Alle Korridore konvergieren. "
            "Voraus: die zentrale Kammer. Die Hitze ist absolut. Etwas darin "
            "funktioniert mit der Zuversicht eines fertigen Dings. Es ist nicht fertig."
        ),
    },
    {
        "id": "pb_17",
        "trigger": "boss_approach",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent}: 'It knows we have been crafting. It has been watching. It wants to see what we built.'",
        "text_de": "{agent}: \u00bbEs weiß, dass wir gecraften haben. Es hat zugesehen. Es will sehen, was wir gebaut haben.\u00ab",
    },
    # ── Agent Afflicted (2) ──────────────────────────────────────────────
    {
        "id": "pb_18",
        "trigger": "agent_afflicted",
        "personality_filter": {},
        "text_en": (
            "{agent} burns. Not physically \u2013 creatively. The fire that drove them to build "
            "has consumed the boundary between maker and material. "
            "{agent} is both craftsman and component now."
        ),
        "text_de": (
            "{agent} brennt. Nicht physisch \u2013 kreativ. Das Feuer, das sie zum Bauen "
            "trieb, hat die Grenze zwischen Macher und Material verzehrt. "
            "{agent} ist jetzt beides: Handwerker und Komponente."
        ),
    },
    {
        "id": "pb_19",
        "trigger": "agent_afflicted",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent}'s instruments read their own vital signs now. The instruments have suggestions.",
        "text_de": "{agent}s Instrumente lesen jetzt ihre eigenen Vitalwerte. Die Instrumente haben Vorschläge.",
    },
    # ── Agent Virtue (2) ─────────────────────────────────────────────────
    {
        "id": "pb_20",
        "trigger": "agent_virtue",
        "personality_filter": {},
        "text_en": (
            "{agent} steadies. The fire is still there \u2013 but channeled now. "
            "Controlled. Primo Levi understood: the hand that works matter "
            "develops a different kind of intelligence."
        ),
        "text_de": (
            "{agent} stabilisiert sich. Das Feuer ist noch da \u2013 aber kanalisiert jetzt. "
            "Kontrolliert. Primo Levi verstand: Die Hand, die Materie bearbeitet, "
            "entwickelt eine andere Art von Intelligenz."
        ),
    },
    {
        "id": "pb_21",
        "trigger": "agent_virtue",
        "personality_filter": {"conscientiousness": (0.7, 1.0)},
        "text_en": "{agent} picks up a tool. It fits. Not because it was designed for {agent}'s hand. Because {agent}'s hand has become what the tool requires.",
        "text_de": "{agent} nimmt ein Werkzeug auf. Es passt. Nicht weil es für {agent}s Hand entworfen wurde. Weil {agent}s Hand zu dem geworden ist, was das Werkzeug verlangt.",
    },
    # ── Insight Thresholds (banter trigger overrides from strategy) ───────
    {
        "id": "pb_22",
        "trigger": "insight_inspired",
        "personality_filter": {},
        "text_en": (
            "Something shifts. {agent} sees connections that were invisible "
            "a moment ago. The components are not separate things \u2013 they are "
            "parts of something that wants to exist."
        ),
        "text_de": (
            "Etwas verschiebt sich. {agent} sieht Verbindungen, die vor einem "
            "Moment noch unsichtbar waren. Die Komponenten sind keine separaten "
            "Dinge \u2013 sie sind Teile von etwas, das existieren will."
        ),
    },
    {
        "id": "pb_23",
        "trigger": "insight_feverish",
        "personality_filter": {},
        "text_en": (
            "The fire is in everything now. {agent}'s instruments are warm to the "
            "touch. The workshop has stopped hiding its mechanisms. It is showing "
            "them \u2013 all of them, at once. It is too much. It is exactly enough."
        ),
        "text_de": (
            "Das Feuer ist jetzt in allem. {agent}s Instrumente sind warm bei "
            "Berührung. Die Werkstatt hat aufgehört, ihre Mechanismen zu "
            "verbergen. Sie zeigt sie \u2013 alle, auf einmal. "
            "Es ist zu viel. Es ist genau genug."
        ),
    },
    {
        "id": "pb_24",
        "trigger": "insight_breakthrough",
        "personality_filter": {},
        "text_en": (
            "For a moment \u2013 only a moment \u2013 the workshop is transparent. "
            "Every mechanism visible. Every connection mapped. Every possible "
            "combination illuminated. The fire burns at its brightest. "
            "The fire also burns."
        ),
        "text_de": (
            "Für einen Moment \u2013 nur einen Moment \u2013 ist die Werkstatt transparent. "
            "Jeder Mechanismus sichtbar. Jede Verbindung kartiert. Jede mögliche "
            "Kombination beleuchtet. Das Feuer brennt am hellsten. "
            "Das Feuer brennt auch."
        ),
    },
    {
        "id": "pb_25",
        "trigger": "insight_cold",
        "personality_filter": {},
        "text_en": "The forge is cold. The workshop presents its materials, but they are inert. They wait for a spark that has not yet arrived.",
        "text_de": "Die Schmiede ist kalt. Die Werkstatt präsentiert ihre Materialien, aber sie sind inert. Sie warten auf einen Funken, der noch nicht eingetroffen ist.",
    },
    # ── Combat Won (3) ───────────────────────────────────────────────────
    {
        "id": "pb_26",
        "trigger": "combat_won",
        "personality_filter": {},
        "text_en": "The construct disassembles. Its components scatter. Some of them are still warm. Some of them are interesting.",
        "text_de": "Das Konstrukt zerlegt sich. Seine Komponenten zerstreuen sich. Manche sind noch warm. Manche sind interessant.",
    },
    {
        "id": "pb_27",
        "trigger": "combat_won",
        "personality_filter": {"openness": (0.6, 1.0)},
        "text_en": "{agent} examines the remains. Not as a soldier examines a defeated enemy. As an engineer examines a competitor's product.",
        "text_de": "{agent} untersucht die Überreste. Nicht wie ein Soldat einen besiegten Feind untersucht. Wie ein Ingenieur das Produkt eines Konkurrenten untersucht.",
    },
    {
        "id": "pb_28",
        "trigger": "combat_won",
        "personality_filter": {},
        "text_en": "The workshop absorbs the debris. Already recycling. Already planning the next iteration.",
        "text_de": "Die Werkstatt absorbiert die Trümmer. Recycelt bereits. Plant bereits die nächste Iteration.",
    },
    # ── Rest Start (2) ───────────────────────────────────────────────────
    {
        "id": "pb_29",
        "trigger": "rest_start",
        "personality_filter": {},
        "text_en": "The fire dims. Not out \u2013 it is still there, in the walls, in the floor, in the components. But it allows rest. A forge needs its cooling cycles.",
        "text_de": "Das Feuer wird schwächer. Nicht aus \u2013 es ist noch da, in den Wänden, im Boden, in den Komponenten. Aber es erlaubt Ruhe. Eine Schmiede braucht ihre Abkühlzyklen.",
    },
    {
        "id": "pb_30",
        "trigger": "rest_start",
        "personality_filter": {"neuroticism": (0.5, 1.0)},
        "text_en": "{agent} sets down the components. They cool. For a moment, they are just materials again. Just matter. The workshop permits this.",
        "text_de": "{agent} legt die Komponenten ab. Sie kühlen ab. Für einen Moment sind sie wieder nur Materialien. Nur Materie. Die Werkstatt erlaubt das.",
    },
    # ── Loot Found (2) ───────────────────────────────────────────────────
    {
        "id": "pb_31",
        "trigger": "loot_found",
        "personality_filter": {},
        "text_en": "New material. The workshop offers it like a gift. Like all gifts here: also a question.",
        "text_de": "Neues Material. Die Werkstatt bietet es an wie ein Geschenk. Wie alle Geschenke hier: auch eine Frage.",
    },
    {
        "id": "pb_32",
        "trigger": "loot_found",
        "personality_filter": {"openness": (0.7, 1.0)},
        "text_en": "{agent} holds the component. It is warm. It pulses once \u2013 not a heartbeat, but a frequency. It is introducing itself.",
        "text_de": "{agent} hält die Komponente. Sie ist warm. Sie pulsiert einmal \u2013 kein Herzschlag, sondern eine Frequenz. Sie stellt sich vor.",
    },
    # ── Agent Stressed (2) ───────────────────────────────────────────────
    {
        "id": "pb_33",
        "trigger": "agent_stressed",
        "personality_filter": {},
        "text_en": "The fire in {agent}'s instruments flares. Prometheus did not just bring fire to humanity. He brought the burns too.",
        "text_de": "Das Feuer in {agent}s Instrumenten flammt auf. Prometheus brachte nicht nur Feuer zur Menschheit. Er brachte auch die Verbrennungen.",
    },
    {
        "id": "pb_34",
        "trigger": "agent_stressed",
        "personality_filter": {"neuroticism": (0.6, 1.0)},
        "text_en": "{agent} flinches. The workshop does not pause. Innovation does not wait for permission. Nor for comfort.",
        "text_de": "{agent} zuckt zusammen. Die Werkstatt pausiert nicht. Innovation wartet nicht auf Erlaubnis. Auch nicht auf Komfort.",
    },
]


# ── The Deluge: Banter ────────────────────────────────────────────────────

DELUGE_BANTER: list[dict] = [
    # ── Room Entered (8: 2×t0, 2×t1, 2×t2, 2×t3) ───────────────────────
    {
        "id": "db_01",
        "trigger": "room_entered",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The floor is damp. Not wet \u2013 damp. The kind of moisture that precedes a statement.",
        "text_de": "Der Boden ist feucht. Nicht nass \u2013 feucht. Die Art Feuchtigkeit, die einer Aussage vorausgeht.",
    },
    {
        "id": "db_02",
        "trigger": "room_entered",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "Water at 12cm. Clear. The room is legible through it. That will change.",
        "text_de": "Wasser bei 12cm. Klar. Der Raum ist hindurch lesbar. Das wird sich ändern.",
    },
    {
        "id": "db_03",
        "trigger": "room_entered",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "12cm now. The sound of movement has changed \u2013 each action announces itself.",
        "text_de": "12cm jetzt. Das Geräusch der Bewegung hat sich verändert \u2013 jede Aktion kündigt sich an.",
    },
    {
        "id": "db_04",
        "trigger": "room_entered",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "The waterline on the wall is 7cm higher than when the party entered this floor. The arithmetic is not complicated.",
        "text_de": "Die Wasserlinie an der Wand ist 7cm höher als beim Betreten dieser Etage. Die Arithmetik ist nicht kompliziert.",
    },
    {
        "id": "db_05",
        "trigger": "room_entered",
        "water_tier": 2,
        "personality_filter": {},
        "text_en": "Half-submerged. The water is cold and has opinions about which direction the party should move.",
        "text_de": "Halb überflutet. Das Wasser ist kalt und hat Meinungen darüber, in welche Richtung sich die Gruppe bewegen sollte.",
    },
    {
        "id": "db_06",
        "trigger": "room_entered",
        "water_tier": 2,
        "personality_filter": {},
        "text_en": "The current carries debris from rooms below. Fragments of encounters that are now depths.",
        "text_de": "Die Strömung trägt Trümmer aus Räumen darunter. Fragmente von Begegnungen, die jetzt Tiefen sind.",
    },
    {
        "id": "db_07",
        "trigger": "room_entered",
        "water_tier": 3,
        "personality_filter": {},
        "text_en": "The surface is close. {agent} keeps the instruments above the waterline. Everything below is concession.",
        "text_de": "Die Oberfläche ist nah. {agent} hält die Instrumente über der Wasserlinie. Alles darunter ist Zugeständnis.",
    },
    {
        "id": "db_08",
        "trigger": "room_entered",
        "water_tier": 3,
        "personality_filter": {},
        "text_en": "Three rooms above the waterline. Two hours ago there were five. The mathematics has not changed, only the denominator.",
        "text_de": "Drei Räume über der Wasserlinie. Vor zwei Stunden waren es fünf. Die Mathematik hat sich nicht geändert, nur der Nenner.",
    },
    # ── Combat (4) ───────────────────────────────────────────────────────
    {
        "id": "db_09",
        "trigger": "combat_start",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The water shifts. Something in the current organizes itself into opposition.",
        "text_de": "Das Wasser verlagert sich. Etwas in der Strömung ordnet sich zum Widerstand.",
    },
    {
        "id": "db_10",
        "trigger": "combat_start",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "Combat in water. Every action costs twice \u2013 once for the act, once for the medium.",
        "text_de": "Kampf im Wasser. Jede Aktion kostet doppelt \u2013 einmal für die Tat, einmal für das Medium.",
    },
    {
        "id": "db_11",
        "trigger": "combat_victory",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The current relents. Not defeated \u2013 redirected. It will find another path.",
        "text_de": "Die Strömung gibt nach. Nicht besiegt \u2013 umgelenkt. Sie wird einen anderen Weg finden.",
    },
    {
        "id": "db_12",
        "trigger": "combat_victory",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "Quiet. The water level drops 2cm. The flood acknowledges the party's right to this room. Temporarily.",
        "text_de": "Stille. Der Pegel sinkt um 2cm. Die Flut erkennt das Recht der Gruppe auf diesen Raum an. Vorübergehend.",
    },
    # ── Loot Found (2) ───────────────────────────────────────────────────
    {
        "id": "db_13",
        "trigger": "loot_found",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The current brought this. From below. From a room that is no longer a room \u2013 it is a depth.",
        "text_de": "Die Strömung brachte dies. Von unten. Aus einem Raum, der kein Raum mehr ist \u2013 er ist eine Tiefe.",
    },
    {
        "id": "db_14",
        "trigger": "loot_found",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "Salvaged. The water will want it back.",
        "text_de": "Geborgen. Das Wasser wird es zurückverlangen.",
    },
    # ── Rest (2) ─────────────────────────────────────────────────────────
    {
        "id": "db_15",
        "trigger": "rest_start",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "Dry. The word has become a luxury. {agent} remains above the waterline and measures the silence.",
        "text_de": "Trocken. Das Wort ist zum Luxus geworden. {agent} verharrt über der Wasserlinie und misst die Stille.",
    },
    {
        "id": "db_16",
        "trigger": "rest_start",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "For a moment the water level stabilizes. Not recedes \u2013 stabilizes. In the Deluge, that is rest.",
        "text_de": "Für einen Moment stabilisiert sich der Pegel. Sinkt nicht \u2013 stabilisiert sich. In der Flut ist das Ruhe.",
    },
    # ── Tidal Events (3) ─────────────────────────────────────────────────
    {
        "id": "db_17",
        "trigger": "tidal_recession",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The water pulls back. 8cm. A breath. Not generosity \u2013 mechanics. The tide returns.",
        "text_de": "Das Wasser zieht sich zurück. 8cm. Ein Atemzug. Keine Großzügigkeit \u2013 Mechanik. Die Flut kommt wieder.",
    },
    {
        "id": "db_18",
        "trigger": "tidal_recession",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "Recession. The watermarks on the wall tell two stories: how high the water was, and how high it will be.",
        "text_de": "Rückgang. Die Wasserzeichen an der Wand erzählen zwei Geschichten: wie hoch das Wasser war und wie hoch es sein wird.",
    },
    {
        "id": "db_19",
        "trigger": "tidal_surge",
        "water_tier": 2,
        "personality_filter": {},
        "text_en": "The tide returns. Higher. It always returns higher.",
        "text_de": "Die Flut kehrt zurück. Höher. Sie kehrt immer höher zurück.",
    },
    # ── Threshold Triggers (4) ───────────────────────────────────────────
    {
        "id": "db_20",
        "trigger": "ankle_threshold",
        "water_tier": 1,
        "personality_filter": {},
        "text_en": "The water has reached the third step. It does not rush. It has been doing this for longer than the stairwell has existed.",
        "text_de": "Das Wasser hat die dritte Stufe erreicht. Es eilt nicht. Es tut dies seit länger als das Treppenhaus existiert.",
    },
    {
        "id": "db_21",
        "trigger": "waist_threshold",
        "water_tier": 2,
        "personality_filter": {},
        "text_en": "Half-submerged. The operational vocabulary contracts. Salvage. Seal. Ascend.",
        "text_de": "Halb überflutet. Das operative Vokabular schrumpft. Bergen. Abdichten. Aufsteigen.",
    },
    {
        "id": "db_22",
        "trigger": "chest_threshold",
        "water_tier": 3,
        "personality_filter": {},
        "text_en": "\u00bbDer Pegel steigt. Nicht schnell. Er hat Zeit. Er hatte immer Zeit.\u00ab",
        "text_de": "\u00bbDer Pegel steigt. Nicht schnell. Er hat Zeit. Er hatte immer Zeit.\u00ab",
    },
    {
        "id": "db_23",
        "trigger": "flood_imminent",
        "water_tier": 3,
        "personality_filter": {},
        "text_en": "Cold. Rising. {agent} adjusts. There is nothing else to adjust.",
        "text_de": "Kalt. Steigend. {agent} passt sich an. Es gibt nichts anderes anzupassen.",
    },
    # ── Retreat (1) ──────────────────────────────────────────────────────
    {
        "id": "db_24",
        "trigger": "retreat",
        "water_tier": 0,
        "personality_filter": {},
        "text_en": "The party ascends. Behind them, the water fills what they leave. No sound of pursuit \u2013 only the sound of level.",
        "text_de": "Die Gruppe steigt auf. Hinter ihnen füllt das Wasser, was sie verlassen. Kein Geräusch der Verfolgung \u2013 nur das Geräusch des Pegels.",
    },
    # ── Submerged Room (2) ───────────────────────────────────────────────
    {
        "id": "db_25",
        "trigger": "submerged_room_entered",
        "water_tier": 2,
        "personality_filter": {},
        "text_en": "The submerged corridor is beautiful. {agent} was not prepared for that.",
        "text_de": "Der überflutete Korridor ist schön. {agent} war darauf nicht vorbereitet.",
    },
    {
        "id": "db_26",
        "trigger": "submerged_room_entered",
        "water_tier": 3,
        "personality_filter": {},
        "text_en": "Under the surface, the room has reorganized itself. What was ceiling is now a mirror. What was door is now a passage to somewhere the map does not name.",
        "text_de": "Unter der Oberfläche hat sich der Raum neu geordnet. Was Decke war, ist jetzt ein Spiegel. Was Tür war, ist jetzt ein Durchgang zu etwas, das die Karte nicht benennt.",
    },
]


# ── Archetype Banter Registry ─────────────────────────────────────────────

_BANTER_REGISTRIES: dict[str, list[dict]] = {
    "The Shadow": SHADOW_BANTER,
    "The Tower": TOWER_BANTER,
    "The Entropy": ENTROPY_BANTER,
    "The Devouring Mother": MOTHER_BANTER,
    "The Prometheus": PROMETHEUS_BANTER,
    "The Deluge": DELUGE_BANTER,
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


def _prometheus_insight_tier(archetype_state: dict) -> int:
    """Map Prometheus insight to banter intensity tier (0-3).

    0 = cold forge (insight < 20)
    1 = warming (20-44)
    2 = inspired (45-74)
    3 = feverish/breakthrough (75+)
    """
    insight = archetype_state.get("insight", 0)
    if insight >= 75:
        return 3
    if insight >= 45:
        return 2
    if insight >= 20:
        return 1
    return 0


def _deluge_water_tier(archetype_state: dict) -> int:
    """Map Deluge water_level to banter intensity tier (0-3).

    0 = dry (water_level 0-24)
    1 = shallow (25-49)
    2 = rising (50-74)
    3 = critical (75+)
    """
    water = archetype_state.get("water_level", 0)
    if water >= 75:
        return 3
    if water >= 50:
        return 2
    if water >= 25:
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
    For The Prometheus, filters by insight_tier (banter intensifies).

    Args:
        trigger: Event trigger (room_entered, combat_won, etc.)
        agents: List of agent dicts with personality traits.
        used_ids: List of already-used banter IDs this run.
        archetype: Dungeon archetype for registry lookup.
        archetype_state: Archetype-specific state for tier filtering.
    """
    from backend.services.dungeon_content_service import get_banter_registry

    banter_pool = get_banter_registry().get(archetype, [])
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
    # Prometheus: filter by insight tier — prefer highest available tier
    elif archetype == "The Prometheus" and archetype_state:
        tier = _prometheus_insight_tier(archetype_state)
        tier_candidates = [b for b in candidates if b.get("insight_tier", 0) <= tier]
        if tier_candidates:
            max_tier = max(b.get("insight_tier", 0) for b in tier_candidates)
            candidates = [b for b in tier_candidates if b.get("insight_tier", 0) == max_tier]
    # Deluge: filter by water tier — prefer highest available tier
    elif archetype == "The Deluge" and archetype_state:
        tier = _deluge_water_tier(archetype_state)
        tier_candidates = [b for b in candidates if b.get("water_tier", 0) <= tier]
        if tier_candidates:
            max_tier = max(b.get("water_tier", 0) for b in tier_candidates)
            candidates = [b for b in tier_candidates if b.get("water_tier", 0) == max_tier]

    if not candidates:
        return None

    return random.choice(candidates)
