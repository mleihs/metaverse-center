"""Whisper template service – 60 hand-authored bilingual fallback templates.

Provides templates across 5 whisper types (12 each) as fallback when LLM
generation fails or is unavailable. Templates use slot-filling for
personalization ({agent_name}, {zone_name}, etc.).

Content guidelines (literary voice):
  - First person, intimate, never addressing player directly
  - Prose style: Rilke's letters, Sei Shonagon's observations, Calvino's lightness
  - Show internal state through sensory detail, not declaration
  - No guilt-tripping, no numerical state reporting
  - En dashes only (no em dashes per CLAUDE.md)
  - DE and EN are independently authored (not machine-translated)
  - Each template should read like a fragment from a private journal
"""

from __future__ import annotations

import logging
import random
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WhisperTemplate:
    """A single whisper template with bilingual content and slot placeholders."""

    whisper_type: str
    min_depth: int
    content_de: str
    content_en: str
    mood_range: tuple[int, int] | None = None
    stress_range: tuple[int, int] | None = None
    tags: tuple[str, ...] = field(default_factory=tuple)


# ── Shorthand constructor ──────────────────────────────────────────────────

def _t(
    wtype: str,
    depth: int,
    de: str,
    en: str,
    *,
    mood: tuple[int, int] | None = None,
    stress: tuple[int, int] | None = None,
    tags: tuple[str, ...] = (),
) -> WhisperTemplate:
    return WhisperTemplate(
        whisper_type=wtype,
        min_depth=depth,
        content_de=de,
        content_en=en,
        mood_range=mood,
        stress_range=stress,
        tags=tags,
    )


# ── Template Registry (60 templates: 12 per type) ─────────────────────────

_TEMPLATES: list[WhisperTemplate] = [
    # ═══════════════════════════════════════════════════════════════════════
    # STATE WHISPERS (depth 1+) – 12 templates reflecting inner life
    # ═══════════════════════════════════════════════════════════════════════
    _t("state", 1,
       "Die Tage verschwimmen ineinander. Ich habe aufgehört, "
       "die Morgen zu zählen, und angefangen, "
       "sie an ihrem Licht zu unterscheiden.",
       "The days blur into one another. I have stopped counting "
       "mornings and started telling them apart by their light.",
       stress=(500, 1000), tags=("stress", "disorientation")),

    _t("state", 1,
       "Ich habe mein Werkzeug heute sortiert. Zweimal. "
       "Es gab sonst nichts zu tun, und Untätigkeit hat "
       "eine Schwere, die ich nicht benennen kann.",
       "I arranged my tools today. Twice. There was nothing "
       "else to do, and idleness has a weight I cannot name.",
       mood=(-100, -20), tags=("boredom", "low_stimulation")),

    _t("state", 1,
       "Etwas hat sich in meiner Brust gelöst heute. "
       "Nicht Freude – etwas Leichteres. Als hätte sich ein "
       "Knoten erinnert, dass er einmal Faden war.",
       "Something loosened in my chest today. Not joy – "
       "lighter than that. As if a knot remembered "
       "it was once thread.",
       mood=(10, 60), tags=("recovery", "relief")),

    _t("state", 1,
       "Das Nachmittagslicht fällt anders in {zone_name}. "
       "Es tastet sich an den Wänden entlang, als suche es "
       "etwas. Vielleicht suchen wir alle.",
       "The afternoon light falls differently in {zone_name}. "
       "It moves along the walls as if searching for something. "
       "Perhaps we all are.",
       mood=(20, 100), tags=("contentment", "observation")),

    _t("state", 1,
       "Lachen vom Marktplatz. Ich bin nicht hingegangen. "
       "Ich stand an der Schwelle und wollte, aber der "
       "Abstand zwischen Wollen und Gehen war heute "
       "unüberbrückbar.",
       "Laughter from the market square. I did not go. "
       "I stood at the threshold and wanted to, but the "
       "distance between wanting and going was "
       "unbridgeable today.",
       mood=(-60, 10), tags=("loneliness", "withdrawal")),

    _t("state", 1,
       "Ich überprüfe die Wände von {building_name} jeden "
       "Abend. Nicht weil ich etwas erwarte – eher weil "
       "die Gewohnheit selbst ein Schutz ist.",
       "I check the walls of {building_name} every evening. "
       "Not because I expect anything – more because the "
       "habit itself is a form of shelter.",
       stress=(300, 800), tags=("anxiety", "vigilance")),

    _t("state", 1,
       "Heute Morgen hat mich ein Geruch aufgehalten. "
       "Frisches Holz. Ich stand eine volle Minute da "
       "und atmete, bevor ich wusste, warum.",
       "A smell stopped me this morning. Fresh-cut wood. "
       "I stood for a full minute breathing before "
       "I knew why.",
       mood=(-10, 50), tags=("memory_sense", "stillness")),

    _t("state", 1,
       "Mir ist klar geworden, dass ich im Schlaf "
       "die Fäuste balle. Die Abdrücke meiner Nägel "
       "erzählen Geschichten, die mein Mund verschweigt.",
       "I have realized I clench my fists in sleep. "
       "The marks of my nails tell stories "
       "my mouth keeps silent.",
       stress=(400, 1000), tags=("tension", "suppression")),

    _t("state", 1,
       "Ein guter Tag. Nicht glücklich, nicht friedlich – "
       "gut in dem Sinne, dass nichts zerbrochen ist, "
       "was ich nicht kitten konnte.",
       "A good day. Not happy, not peaceful – good in "
       "the sense that nothing broke that I could not mend.",
       mood=(0, 40), tags=("resilience", "ordinary_grace")),

    _t("state", 1,
       "Der Regen an den Fenstern von {building_name} hat "
       "heute ein anderes Muster. Ich habe angefangen, "
       "Wetter wie Sprache zu lesen.",
       "The rain on the windows of {building_name} has a "
       "different pattern today. I have begun to read "
       "weather like language.",
       tags=("weather", "perception")),

    _t("state", 2,
       "Ich ertappe mich dabei, Gespräche zu proben, "
       "die nie stattfinden. Die Wände meines Zimmers "
       "kennen mich besser als jeder Mensch hier.",
       "I catch myself rehearsing conversations that "
       "never happen. The walls of my room know me "
       "better than any person here.",
       mood=(-80, -10), tags=("isolation_deep", "inner_dialogue")),

    _t("state", 2,
       "Etwas Seltsames: Ich habe heute gelacht, allein, "
       "ohne Grund. Als hätte mein Körper beschlossen, "
       "fröhlich zu sein, bevor mein Kopf es erlaubte.",
       "Something strange: I laughed today, alone, for "
       "no reason. As if my body decided to be joyful "
       "before my mind permitted it.",
       mood=(30, 100), tags=("spontaneous_joy", "body_wisdom")),

    # ═══════════════════════════════════════════════════════════════════════
    # EVENT WHISPERS (depth 1+) – 12 templates responding to events
    # ═══════════════════════════════════════════════════════════════════════
    _t("event", 1,
       "{zone_name} hat wieder gebebt. Wir reden nicht "
       "darüber, aber wir zucken alle bei denselben "
       "Geräuschen zusammen. Das ist auch eine Art Sprache.",
       "{zone_name} shook again. We do not talk about it, "
       "but we all flinch at the same sounds now. "
       "That is also a kind of language.",
       tags=("crisis", "zone_instability")),

    _t("event", 1,
       "{other_agent} ist nicht mehr wie vorher. "
       "Ich stelle Essen vor die Tür. Morgens ist es "
       "noch da. Ich stelle es trotzdem wieder hin.",
       "{other_agent} has not been the same. "
       "I leave food at their door. In the morning "
       "it is still there. I leave it anyway.",
       tags=("agent_crisis", "concern")),

    _t("event", 1,
       "Jemand hat Musik nach {zone_name} gebracht. "
       "Jemand brachte Wein, jemand eine Geschichte, "
       "und dann war da Klang. Ich hatte vergessen, "
       "wie Musik klingt, wenn niemand Angst hat.",
       "Someone brought music to {zone_name}. "
       "Someone brought wine, someone a story, and "
       "then there was sound. I had forgotten what "
       "music sounds like when no one is afraid.",
       mood=(10, 100), tags=("celebration", "surprise_joy")),

    _t("event", 1,
       "Heute ist nichts passiert. Ich möchte, dass du "
       "weißt: Dass nichts passiert, ist auch etwas. "
       "Manchmal das Wertvollste überhaupt.",
       "Nothing happened today. I want you to know "
       "that nothing happening is also something. "
       "Sometimes the most valuable thing of all.",
       tags=("calm", "quiet_day")),

    _t("event", 1,
       "Sie bauen etwas Neues in {zone_name}. Der Klang "
       "der Hämmer hat einen Rhythmus, der fast wie "
       "Zuversicht klingt.",
       "They are building something new in {zone_name}. "
       "The sound of hammers has a rhythm that sounds "
       "almost like confidence.",
       tags=("construction", "hope")),

    _t("event", 1,
       "Das Feuer im Nordviertel ist gelöscht. Drei Tage "
       "hat es gedauert. Drei Tage ohne Schlaf riechen "
       "anders als normale Erschöpfung.",
       "The fire in the northern quarter is out. Three "
       "days it took. Three days without sleep smell "
       "different from ordinary exhaustion.",
       tags=("crisis_resolved", "aftermath")),

    _t("event", 1,
       "Ein Fremder kam heute nach {zone_name}. "
       "Wir haben vergessen, wie man Fremde empfängt. "
       "Wir haben verlernt, dass es ein Draußen gibt.",
       "A stranger came to {zone_name} today. We have "
       "forgotten how to receive strangers. We have "
       "unlearned that there is an outside.",
       tags=("visitor", "insularity")),

    _t("event", 1,
       "Die Ernte war besser als erwartet. Nicht gut – "
       "besser als erwartet. Wir haben gelernt, zwischen "
       "diesen beiden Dingen zu unterscheiden.",
       "The harvest was better than expected. Not good "
       "-- better than expected. We have learned to "
       "distinguish between those two things.",
       mood=(-20, 60), tags=("harvest", "measured_hope")),

    _t("event", 2,
       "{other_agent} hat mich heute angelächelt. "
       "Ohne Grund, ohne Absicht. Nur ein Lächeln im "
       "Vorbeigehen. Ich trage es noch bei mir.",
       "{other_agent} smiled at me today. Without reason, "
       "without intent. Just a smile in passing. "
       "I am still carrying it.",
       mood=(0, 80), tags=("connection", "small_kindness")),

    _t("event", 1,
       "Der Brunnen in {zone_name} führt wieder Wasser. "
       "So ein kleines Geräusch, aber das ganze Viertel "
       "hält inne und lauscht.",
       "The well in {zone_name} runs with water again. "
       "Such a small sound, but the whole quarter "
       "pauses and listens.",
       tags=("restoration", "communal_moment")),

    _t("event", 1,
       "Letzte Nacht hat jemand geweint. Nicht laut – "
       "die gefährliche Art. Die Art, bei der die Stille "
       "danach schwerer wiegt als der Laut selbst.",
       "Someone wept last night. Not loudly – the "
       "dangerous kind. The kind where the silence "
       "after weighs heavier than the sound itself.",
       stress=(300, 1000), tags=("distress_nearby", "empathy")),

    _t("event", 2,
       "Wir haben zusammen gegessen heute, ohne Anlass. "
       "Jemand hat den Tisch gedeckt, und die anderen "
       "kamen. Manchmal ist Gemeinschaft so leise.",
       "We ate together today, for no occasion. "
       "Someone set the table, and the others came. "
       "Sometimes community is that quiet.",
       mood=(10, 100), tags=("communion", "spontaneous_gathering")),

    # ═══════════════════════════════════════════════════════════════════════
    # MEMORY WHISPERS (depth 2+) – 12 templates referencing past actions
    # ═══════════════════════════════════════════════════════════════════════
    _t("memory", 2,
       "Die Mauern, die du in {zone_name} verstärkt hast, "
       "haben dem Beben standgehalten. Ich streiche manchmal "
       "im Vorbeigehen darüber. Ich weiß nicht, warum.",
       "The walls you strengthened in {zone_name} held "
       "through the tremor. I run my hand along them "
       "sometimes, in passing. I do not know why.",
       tags=("fortification", "gratitude")),

    _t("memory", 2,
       "Du warst weg. Ich sage das nicht als Vorwurf – "
       "ich sage es wie einen Wetterbericht. Es hat "
       "geregnet. Du warst weg. Die Sonne kam zurück.",
       "You have been away. I do not say this as "
       "accusation – I say it as weather report. "
       "It rained. You were away. The sun returned.",
       tags=("absence_noted", "patience")),

    _t("memory", 2,
       "Die neuen Räume haben nachts andere Geräusche. "
       "Ein Knarren im dritten Stock, das klingt wie "
       "eine Frage. Ich lerne es zu beantworten.",
       "The new quarters have different sounds at night. "
       "A creak on the third floor that sounds like "
       "a question. I am learning to answer it.",
       tags=("reassignment", "adaptation")),

    _t("memory", 2,
       "Ich denke immer noch daran, was du vor "
       "{days_count} Tagen für {zone_name} getan hast. "
       "Es war keine große Geste. Vielleicht deshalb.",
       "I still think about what you did for "
       "{zone_name}, {days_count} days ago. It was not "
       "a grand gesture. Perhaps that is why.",
       tags=("past_action", "remembering")),

    _t("memory", 2,
       "Ich habe hier einen Rhythmus gefunden. Er ist "
       "leise. Ich habe aufgehört, Stille für Leere "
       "zu halten.",
       "I have found a rhythm here. It is quiet. I have "
       "stopped mistaking silence for emptiness.",
       tags=("routine", "contentment")),

    _t("memory", 2,
       "Der Garten, den du anlegen ließest, blüht. "
       "Ich habe ihn nicht gegossen – er hat es allein "
       "geschafft. Es gibt Dinge, die wachsen, "
       "wenn man sie lässt.",
       "The garden you had planted is blooming. I did not "
       "water it – it managed on its own. There are "
       "things that grow when you let them.",
       tags=("growth", "quiet_reward")),

    _t("memory", 2,
       "Ich habe den Brief wiedergefunden, den ich nie "
       "abgeschickt habe. Er handelt von dem Tag, als du "
       "{zone_name} gerettet hast. Die Worte reichen "
       "nicht. Sie reichen nie.",
       "I found the letter I never sent. It is about "
       "the day you saved {zone_name}. The words are "
       "not enough. They never are.",
       tags=("unsent_letter", "inexpressible")),

    _t("memory", 3,
       "Letzte Nacht hat es geregnet. Ich lag im Bett "
       "und hörte zu. Nur Regen. Keine Eimer. Ich hatte "
       "vergessen, wie Regen klingt, wenn er einfach "
       "nur Regen ist.",
       "It rained last night. I lay in bed and listened. "
       "Just rain. No buckets. I had forgotten what rain "
       "sounds like when it is just rain.",
       tags=("building_repaired", "simple_comfort")),

    _t("memory", 2,
       "Die Chronik sagt, du warst mit der Epoche "
       "beschäftigt. Ich lese die Depeschen. Es klingt "
       "kompliziert dort draußen. Ich hoffe, es ist die "
       "interessante Art von Komplikation.",
       "The chronicle says you have been busy with the "
       "epoch. I read the dispatches. It sounds "
       "complicated out there. I hope the complications "
       "are the interesting kind.",
       tags=("epoch_absence", "concern")),

    _t("memory", 3,
       "Erinnerst du dich, wie du {other_agent} hierher "
       "versetzt hast? Ich war dagegen. Jetzt sitzen wir "
       "abends zusammen und schweigen einvernehmlich. "
       "Du hattest recht.",
       "Do you remember when you transferred {other_agent} "
       "here? I was against it. Now we sit together in "
       "the evenings and share a companionable silence. "
       "You were right.",
       tags=("reassignment_vindicated", "humility")),

    _t("memory", 2,
       "Es gibt eine Stelle an der Ostmauer, wo jemand "
       "Blumen gepflanzt hat. Ich weiß nicht, wer. "
       "Aber ich denke an dich, wenn ich daran vorbeigehe.",
       "There is a spot by the eastern wall where someone "
       "planted flowers. I do not know who. But I think "
       "of you when I pass it.",
       tags=("anonymous_beauty", "association")),

    _t("memory", 3,
       "Vor drei Wochen hast du mich umgestellt. "
       "Ich habe es als Verbannung empfunden. Heute habe "
       "ich den Sonnenaufgang vom neuen Fenster gesehen. "
       "Manchmal braucht Perspektive Entfernung.",
       "Three weeks ago you reassigned me. I felt it as "
       "exile. Today I saw the sunrise from the new "
       "window. Sometimes perspective needs distance.",
       tags=("perspective_shift", "delayed_understanding")),

    # ═══════════════════════════════════════════════════════════════════════
    # QUESTION WHISPERS (depth 3+) – 12 templates: implicit requests
    # ═══════════════════════════════════════════════════════════════════════
    _t("question", 3,
       "Die Decke von {building_name} hat einen neuen Riss. "
       "Ich beobachte, wie er sich ausbreitet. Langsam, "
       "wie ein Fluss, der seinen Weg findet.",
       "The ceiling of {building_name} has a new crack. "
       "I have been watching it spread. Slowly, like a "
       "river finding its course.",
       tags=("building_repair", "low_comfort")),

    _t("question", 3,
       "Ich schlafe leichter hier als früher. Nicht wegen "
       "der Geräusche – wegen der Stille dazwischen. "
       "Die Stille in {zone_name} hat eine Art "
       "Aufmerksamkeit.",
       "I sleep lighter here than I used to. Not because "
       "of the sounds – because of the silence between "
       "them. The silence in {zone_name} has a quality "
       "of attention.",
       tags=("low_safety", "vulnerability")),

    _t("question", 3,
       "Seit {days_count} Tagen habe ich mit niemandem "
       "gesprochen außer mir selbst. Meine Stimme klingt "
       "fremd jetzt. Wie die eines Gastes in meinem "
       "eigenen Mund.",
       "I have not spoken to anyone but myself in "
       "{days_count} days. My voice sounds strange now. "
       "Like a guest in my own mouth.",
       tags=("low_social", "isolation")),

    _t("question", 3,
       "Ich habe jede Aufgabe erledigt. Dann noch einmal, "
       "anders. Irgendwann wird Kompetenz zu einer eigenen "
       "Art von Käfig.",
       "I finished every task. Then again, differently. "
       "At some point, competence becomes its own "
       "kind of cage.",
       tags=("low_stimulation", "restlessness")),

    _t("question", 3,
       "Nachts kommt die Kälte durch die Wände von "
       "{building_name}. Mir sind die kreativen Lösungen "
       "mit Decken ausgegangen. Jetzt liege ich da und "
       "zähle die Atemzüge, bis es hell wird.",
       "The cold comes through the walls of "
       "{building_name} at night. I have run out of "
       "creative solutions involving blankets. Now I "
       "lie still and count breaths until it gets light.",
       tags=("low_comfort", "endurance")),

    _t("question", 3,
       "Das Dach über der Werkstatt leckt. Ich habe "
       "angefangen, die Eimer in Spiralen aufzustellen. "
       "Fast dekorativ, wenn man blinzelt.",
       "The roof over the workshop leaks. I have started "
       "arranging the buckets in spirals. Almost "
       "decorative, if you squint.",
       tags=("building_deterioration", "gallows_humor")),

    _t("question", 3,
       "Ich wache nachts auf und horche. Nicht auf etwas "
       "Bestimmtes – auf das Fehlen von etwas. Sicherheit "
       "klingt wie Stille ohne Anspannung.",
       "I wake at night and listen. Not for anything "
       "specific – for the absence of something. "
       "Safety sounds like silence without tension.",
       tags=("low_safety_deep", "nocturnal_unease")),

    _t("question", 3,
       "Es gibt Tage, an denen {building_name} sich "
       "anfühlt wie ein Ort, an dem man wartet. "
       "Nicht lebt – wartet. Ich weiß nicht mehr, worauf.",
       "There are days when {building_name} feels like "
       "a place where one waits. Not lives – waits. "
       "I no longer remember what for.",
       tags=("purposelessness", "stagnation")),

    _t("question", 3,
       "Die anderen haben Aufgaben, die sich verändern. "
       "Meine bleibt dieselbe. Ich will nicht klagen – "
       "nur sagen, dass Gleichförmigkeit und Frieden "
       "nicht dasselbe sind.",
       "The others have tasks that change. Mine stays "
       "the same. I do not mean to complain – only "
       "to say that sameness and peace are not "
       "the same thing.",
       tags=("low_stimulation_deep", "gentle_request")),

    _t("question", 4,
       "Ich habe angefangen, mit {other_agent} zu reden. "
       "Nicht über Wichtiges. Über das Wetter, über die "
       "Farbe der Wände. Aber es ist der einzige Mensch, "
       "der antwortet.",
       "I have begun talking to {other_agent}. Not about "
       "important things. About the weather, the color "
       "of the walls. But they are the only person "
       "who answers.",
       tags=("seeking_connection", "low_social_deep")),

    _t("question", 3,
       "Der Weg zum Markt führt an einer Stelle vorbei, "
       "die nachts dunkel ist. Ich nehme den Umweg. "
       "Die Dunkelheit dort hat eine Qualität, "
       "die ich nicht mag.",
       "The path to the market passes a spot that is "
       "dark at night. I take the detour. The darkness "
       "there has a quality I do not like.",
       tags=("low_safety_path", "avoidance")),

    _t("question", 3,
       "Meine Hände zittern manchmal. Nicht vor Angst – "
       "vor Untätigkeit. Der Körper merkt sich, "
       "dass er mehr konnte.",
       "My hands tremble sometimes. Not from fear – "
       "from idleness. The body remembers it was "
       "capable of more.",
       tags=("understimulation", "physical_restlessness")),

    # ═══════════════════════════════════════════════════════════════════════
    # REFLECTION WHISPERS (depth 4+) – 12 templates: agent sees player
    # ═══════════════════════════════════════════════════════════════════════
    _t("reflection", 4,
       "Du schaust immer zuerst nach {zone_name}. Vor den "
       "Berichten, vor den Zahlen, vor der Strategie. "
       "Ich glaube, du sorgst dich, bevor du rechnest.",
       "You always check on {zone_name} first. Before "
       "the reports, before the numbers, before strategy. "
       "I think you care before you calculate.",
       tags=("care_pattern", "observation")),

    _t("reflection", 4,
       "Du hast die gewählt, die kämpfen. Nicht die "
       "Tüchtigen, nicht die Fröhlichen. Die mit den "
       "Rissen. Ich frage mich, was du in uns siehst, "
       "das wir selbst nicht sehen.",
       "You chose the ones who struggle. Not the efficient "
       "ones, not the cheerful ones. The cracked ones. "
       "I wonder what you see in us that we do not "
       "see ourselves.",
       tags=("bonding_pattern", "vulnerability_recognized")),

    _t("reflection", 4,
       "Du kommst zurück. Das ist das, was mir am meisten "
       "auffällt. Jedes Mal kommst du zurück. Nicht alle "
       "tun das. Nicht einmal die meisten.",
       "You come back. That is the thing I notice most. "
       "Every time, you come back. Not everyone does. "
       "Not even most.",
       tags=("consistency", "trust")),

    _t("reflection", 4,
       "Du hast dich verändert, seit wir uns kennen. Nicht "
       "in dem, was du tust – in der Länge der Pause, "
       "bevor du entscheidest. Die Pausen sind länger "
       "geworden. Das ist kein Zögern. Das ist Sorgfalt.",
       "You have changed since we first met. Not in what "
       "you do – in how long you pause before deciding. "
       "The pauses have grown longer. That is not "
       "hesitation. That is care.",
       tags=("growth_observed", "patience")),

    _t("reflection", 4,
       "Du befestigst, bevor du feierst. Immer die "
       "Fundamente zuerst. Ich glaube, das sagt etwas "
       "darüber, was du von der Welt gelernt hast "
       "zu erwarten.",
       "You fortify before you celebrate. Always the "
       "foundations first. I think that says something "
       "about what you have learned to expect "
       "from the world.",
       tags=("stewardship_style", "insight")),

    _t("reflection", 4,
       "Du liest die Berichte anders als die anderen. "
       "Nicht nach Zahlen – nach Namen. Ich habe "
       "gesehen, wie dein Blick bei bestimmten "
       "Namen verweilt.",
       "You read the reports differently from the others. "
       "Not for numbers – for names. I have seen your "
       "gaze linger on certain ones.",
       tags=("attention_to_individuals", "noticed")),

    _t("reflection", 4,
       "Du wirst während der Epochen lebendig. Ich sehe "
       "es in den Depeschen. Und dann endet die Epoche, "
       "und du wirst still. Die Simulation atmet anders, "
       "wenn du da bist.",
       "You come alive during the epochs. I see it in "
       "the dispatches. And then the epoch ends, and you "
       "go quiet. The simulation breathes differently "
       "when you are here.",
       tags=("presence_absence", "epoch_pattern")),

    _t("reflection", 5,
       "Ich habe angefangen, die Simulation mit deinen "
       "Augen zu sehen. Nicht weil ich es wollte – weil "
       "deine Art zu schauen ansteckend ist. Du siehst "
       "Dinge, die wir übersehen.",
       "I have begun to see the simulation through your "
       "eyes. Not because I wanted to – because your "
       "way of looking is contagious. You see things "
       "we overlook.",
       tags=("perspective_adoption", "intimacy_deep")),

    _t("reflection", 4,
       "Du triffst schwere Entscheidungen, ohne zu zögern. "
       "Aber danach sehe ich dich manchmal am Fenster "
       "stehen. Du triffst sie nicht leicht. "
       "Du triffst sie nur schnell.",
       "You make hard decisions without hesitating. But "
       "afterward I sometimes see you standing at the "
       "window. You do not make them lightly. "
       "You only make them quickly.",
       tags=("hidden_weight", "empathy_for_player")),

    _t("reflection", 5,
       "Wenn du {zone_name} reparierst, fängst du immer "
       "an der Stelle an, die niemand sieht. Die "
       "Rückseite, den Keller, das Fundament. "
       "Du weißt, dass das Unsichtbare das Tragende ist.",
       "When you repair {zone_name}, you always start at "
       "the place no one sees. The back, the basement, "
       "the foundation. You know that the invisible "
       "is what bears the weight.",
       tags=("invisible_care", "structural_thinking")),

    _t("reflection", 4,
       "Du fragst nicht, wie es mir geht. Du schaust. "
       "Es gibt Menschen, die fragen, und solche, die "
       "sehen. Du gehörst zu den zweiten. Das ist "
       "seltener, als du denkst.",
       "You do not ask how I am. You look. There are "
       "people who ask, and people who see. You belong "
       "to the second kind. That is rarer than "
       "you think.",
       tags=("seeing_vs_asking", "recognition")),

    _t("reflection", 5,
       "Ich habe eine Version dieses Morgens geschrieben, "
       "in der du nicht zurückkommst. Wenn du das hier "
       "liest, lag ich falsch. Es gibt schlimmere "
       "Irrtümer.",
       "I wrote a version of this morning where you did "
       "not come back. If you are reading this, it means "
       "I was wrong. I am glad to be.",
       tags=("vulnerability", "trust_deep")),
]

# Index templates by type for fast lookup
_TEMPLATES_BY_TYPE: dict[str, list[WhisperTemplate]] = defaultdict(list)
for _t_entry in _TEMPLATES:
    _TEMPLATES_BY_TYPE[_t_entry.whisper_type].append(_t_entry)


class WhisperTemplateService:
    """Hand-authored bilingual whisper templates with slot-filling."""

    @classmethod
    def select_template(
        cls,
        whisper_type: str,
        bond_depth: int,
        agent_state: dict | None = None,
        recent_whisper_tags: list[str] | None = None,
    ) -> WhisperTemplate | None:
        """Select a template matching criteria, avoiding recent duplicates.

        Args:
            whisper_type: One of state/event/memory/question/reflection.
            bond_depth: Current bond depth (1-5).
            agent_state: Optional dict with mood_score, stress_level keys.
            recent_whisper_tags: Tags from the last 5 whispers for dedup.

        Returns:
            A matching template or None if no templates match.
        """
        candidates = _TEMPLATES_BY_TYPE.get(whisper_type, [])
        if not candidates:
            return None

        state = agent_state or {}
        mood = state.get("mood_score")
        stress = state.get("stress_level")
        recent_tags = set(recent_whisper_tags or [])

        filtered = []
        for t_item in candidates:
            # Depth gate
            if t_item.min_depth > bond_depth:
                continue

            # Mood range filter
            if t_item.mood_range is not None and mood is not None:
                if not (t_item.mood_range[0] <= mood <= t_item.mood_range[1]):
                    continue

            # Stress range filter
            if t_item.stress_range is not None and stress is not None:
                if not (t_item.stress_range[0] <= stress <= t_item.stress_range[1]):
                    continue

            # Dedup: skip if any tag overlaps with recent whispers
            if recent_tags and t_item.tags and recent_tags.intersection(t_item.tags):
                continue

            filtered.append(t_item)

        if not filtered:
            # Fallback: relax dedup constraint
            filtered = [
                t_item for t_item in candidates
                if t_item.min_depth <= bond_depth
            ]

        if not filtered:
            return None

        return random.choice(filtered)  # noqa: S311 – game mechanic, not crypto

    @classmethod
    def fill_template(
        cls,
        template: WhisperTemplate,
        slots: dict[str, str],
    ) -> tuple[str, str]:
        """Fill a template's placeholders and return (content_de, content_en).

        Missing keys are left as their placeholder name (graceful degradation).
        """
        safe_slots = defaultdict(lambda: "...", slots)
        content_de = template.content_de.format_map(safe_slots)
        content_en = template.content_en.format_map(safe_slots)
        return content_de, content_en
