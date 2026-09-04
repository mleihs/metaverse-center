"""The contract between a stored prompt template and the code that renders it.

A prompt template is a piece of *data* — it lives in ``prompt_templates``, it is
written by a migration seed, by a simulation admin in the UI, or by an AI during
Forge phase A.6. It is rendered by *code*, which supplies a fixed set of
variables at the call site. Until this module existed, nothing connected the two
halves: a template could name ``{agent_title}``, no call site would ever supply
it, and the defect stayed invisible because the renderer left the placeholder
standing and a second model downstream filled the hole with something plausible.

Measured on production, 2026-08-30 (see
``docs/analysis/forge-prod-run-2026-08-30.md``, findings 5, 6 and 23):

* 8 invented placeholders across 4 AI-written templates in one world; one of
  them reached the rendered portrait as a lapel badge reading "Leserlichkeit:
  9 %", a number nobody computed.
* 16 rows in 4 worlds written in Mustache syntax (``{{agent_name}}``), which
  ``str.format`` renders as the literal text ``{agent_name}`` — those worlds
  have been generating relationships and echoes without ever seeing the agent.
* AI-written templates silently dropped the platform's compositional guarantees
  ("a SINGLE person", "comma-separated descriptors, no sentences") and, for the
  chronicle, the JSON output contract.

This module is the single declaration of both halves, and it is pure: no I/O, no
database, no logging policy. Its three consumers are

1. ``prompt_service.PromptResolver`` — renders, reports undeclared placeholders,
   and appends the platform frame to a simulation-owned template;
2. ``forge_theme_service.generate_simulation_templates`` — builds the generation
   prompt from the declaration and sanitises the model's output before storing;
3. ``scripts/repair_simulation_prompt_templates.py`` — repairs the rows that
   already exist.

``backend/tests/unit/test_prompt_contracts.py`` binds the declaration to reality:
it walks the AST of every rendering call site and fails if a declared variable
set drifts from the keys the call site actually supplies. The declaration cannot
rot without a red test.

Template syntax
---------------
One syntax, deliberately minimal: ``{identifier}``. Every other brace is literal,
which is what makes a JSON example inside a prompt (``Return JSON: {"title":
"..."}``) work without escaping. ``{{identifier}}`` is never valid — it is the
Mustache mistake described above; the renderer substitutes it anyway, but reports
it, and the repair pass normalises it.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from enum import StrEnum

__all__ = [
    "PROMPT_CONTRACTS",
    "Defect",
    "PromptContract",
    "RenderResult",
    "SanitizeResult",
    "TemplateAudit",
    "audit_template",
    "example_variables",
    "get_contract",
    "render_template",
    "sanitize_template",
    "variable_catalogue",
]


# ── Template syntax ──────────────────────────────────────────────────────────

# Ordered alternation: the Mustache form must win over the plain form, because
# "{{name}}" contains "{name}" at offset 1. Everything not matched here — a bare
# "{", a JSON object, a Python format spec — is literal text and passes through.
_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}|\{(\w+)\}")


class Defect(StrEnum):
    """A way a stored template can disagree with the code that renders it."""

    UNKNOWN = "unknown_placeholder"
    """Names a variable no call site supplies. Renders empty; invented content."""

    MUSTACHE = "mustache_placeholder"
    """Written as ``{{name}}``. Wrong syntax for this renderer."""

    MISSING = "missing_required_placeholder"
    """Omits a variable the code SUPPLIES and the template must carry.

    Die stillste der drei Fehlerarten. ``UNKNOWN`` und ``MUSTACHE`` beschreiben
    einen Platzhalter, der DASTEHT und nicht wirkt; hier steht keiner, und was
    fehlt, faellt lautlos weg — ohne Meldung, ohne Luecke im Text, ohne
    irgendeine Spur.

    GEMESSEN am 04.09.2026 auf Produktion: drei von vier welteigenen
    `chat_system_prompt`-Vorlagen kannten weder ``{agent_memories}`` noch
    ``{agent_mood}``. Ein Agent in Velgarien hatte 195 Erinnerungen in der
    Datenbank, und keine einzige ist je in einen Prompt gelangt."""


@dataclass(frozen=True, slots=True)
class PromptContract:
    """What one template type may reference, and what the platform guarantees.

    Attributes:
        template_type: The ``prompt_templates.template_type`` value.
        variables: Every variable name the rendering call site can supply. Some
            are conditional (``agent_character`` is only present when the agent
            record was loaded); a declared variable without a value renders as
            the empty string, which is normal and not reported.
        frame: A platform guarantee appended to the rendered prompt when the
            template is *simulation-owned*. Composition, subject count, output
            format — the parts a world may not redefine. Empty for template
            types that carry no such guarantee. The frame is appended after
            rendering, so it is never itself substituted.
    """

    template_type: str
    variables: frozenset[str]
    frame: str = ""
    required: frozenset[str] = frozenset()
    """Variablen, ohne die die Vorlage ihren Zweck nicht erfuellt.

    Eine Teilmenge von ``variables``. Der Unterschied ist nicht Strenge,
    sondern Wirkung: eine deklarierte Variable ohne Platzhalter ist meist
    harmlos (``{agent_gender}`` fehlt, der Text liest sich trotzdem). Diese
    hier tragen den ZUSTAND des Agenten — sein Gedaechtnis, seine Stimmung.
    Fehlt der Platzhalter, spricht die Figur ohne beides und niemand sieht es
    ihr an.

    Leer fuer jeden Vorlagentyp, der keinen solchen Zustand traegt. Eine
    Pflicht, die man ueberall hinschreibt, ist keine."""


# ── Platform frames ──────────────────────────────────────────────────────────
#
# Lifted from the curated platform templates measured in production, not
# invented here: the portrait frame is the "COMPOSITION"/"IMPORTANT" block of the
# platform `portrait_description` row, the chronicle frame is its "Return valid
# JSON" line, the chat frame is its "Stay in character" block merged with the
# anti-meta-commentary rules of the hardcoded fallback.

_FORMAT_DESCRIPTORS = "OUTPUT FORMAT: comma-separated visual descriptors, no sentences, no narration."

_FRAME_PORTRAIT = (
    "COMPOSITION (platform requirement, overrides anything above): exactly ONE person, "
    "a single subject centered in frame. Never two people, never a pair of panels, never a "
    # No rationale clause here on purpose. The output format is "comma-separated
    # descriptors", and the model dutifully turned an earlier explanatory clause
    # into descriptors: a rendered prompt ended "...no numerals, figure is
    # invented, computed". A frame for a descriptor list states prohibitions and
    # explains nothing.
    "diptych. Close-up head-and-shoulders, shallow depth of field. No readable text, no badges, "
    "no numerals, no lettering on clothing or background.\n"
    f"{_FORMAT_DESCRIPTORS}"
)

_FRAME_BUILDING = (
    "COMPOSITION (platform requirement, overrides anything above): one building as the single "
    "subject. No people, no characters, no readable text.\n"
    f"{_FORMAT_DESCRIPTORS}"
)

_FRAME_SCENE = (
    "COMPOSITION (platform requirement, overrides anything above): environment, light and scale "
    "only. No character in focus, no readable text, no UI elements.\n"
    f"{_FORMAT_DESCRIPTORS}"
)

_FRAME_BANNER = (
    "COMPOSITION (platform requirement, overrides anything above): a wide 16:9 establishing shot "
    "of the world. Landscape and atmosphere, no character in focus, no readable text, no UI "
    "elements.\n"
    f"{_FORMAT_DESCRIPTORS}"
)

_FRAME_CHRONICLE = (
    'OUTPUT FORMAT (platform requirement): return valid JSON and nothing else: {"title": "edition '
    'title", "headline": "one-line hook", "content": "full article"}'
)

# The prose floor. Images got a composition floor in W1 and the chronicle got a
# JSON floor; the text a reader actually reads — every agent card, every detail
# panel — got nothing. Measured on the ATRAMENT agents: 235 words with not one
# plain sentence, a simile in nearly every one, and a colon-introduced thesis
# ("Ihr größter Widerspruch:") standing in for characterisation. The seed's own
# system prompts ordered it: "RICH ... DEPTH AND NUANCE", "ATMOSPHERIC",
# "COMPELLING". Written by the parallel session, which measured the register
# before proposing the remedy.
_FRAME_PROSE = (
    "STYLE (platform requirement, overrides anything above): write plainly. The LAST sentence of "
    "each field is a fact, not an epigram and not a simile. Sentences may be long; they should "
    "just not all share one shape. Ration figurative language to at most one image per paragraph, "
    "and only where a plain sentence cannot carry it – a simile in every sentence reads as effort, "
    "not as observation.\n"
    'Do not sum the subject up in a formula: no "Their greatest contradiction:", no "Their '
    'private heresy:", no colon-introduced thesis about who or what this is. State the facts '
    "and let them imply it.\n"
    "No signature quirk invented to make the subject memorable, and no closing epigram – end "
    "on the last fact, not on a short dramatic sentence.\n"
    "Ordinary registers are allowed and usually right: a clerk may be described in the "
    "language of clerks."
)

_FRAME_CHAT = (
    "Stay in character at all times. Never break character, never acknowledge being an AI or a "
    "language model. Never prefix your reply with your own name in brackets. Never include "
    "internal reasoning, chain-of-thought or meta-commentary in your reply."
)

#: Was eine Welt an der Verdichtung NICHT wegschreiben darf.
#:
#: Eine Verdichtung geht in den System-Prompt jedes folgenden Zuges. Was darin
#: steht, GILT für das Modell — und was nicht darin steht, hat nicht
#: stattgefunden. Zwei Zusicherungen sind deshalb nicht verhandelbar:
#:
#: * **Nichts erfinden.** Eine Verdichtung, die einen Satz hinzufügt, den
#:   niemand gesagt hat, kann er nie widerlegt werden: der Urtext wird beim
#:   nächsten Zug nicht mehr mitgeschickt. Die Fehlerhäufung, die
#:   arXiv:2308.15022 beim rekursiven Zusammenfassen beschreibt, ist hier
#:   baulich ausgeschlossen (jeder Abschnitt wird genau einmal erzeugt) — eine
#:   ERFINDUNG in der einen Erzeugung wäre trotzdem dauerhaft.
#: * **Keine Regie.** Die Verdichtung ist Bericht, nicht Fortsetzung. Ohne
#:   diesen Satz schreibt ein Rollenspielmodell den Wortwechsel weiter, statt
#:   ihn zusammenzufassen.
#: Was eine Welt am Wortwechsel ohne Zuhörer NICHT wegschreiben darf.
#:
#: Hier schreibt EIN Modell alle Stimmen — anders als im Chat, und mit
#: Absicht: es schreibt eine Szene, nicht eine Person. Genau deshalb braucht
#: es die Form, an der die Zuordnung danach hängt. Ohne die JSON-Zusage gibt
#: es nichts zuzuordnen, und ein Zug ohne erkennbaren Sprecher wird verworfen
#: (`ContinuationService._parse_turns`) — der teure Aufruf wäre umsonst.
#:
#: Der zweite Satz ist der wichtigere: der Mensch ist NICHT da. Ein
#: Wortwechsel, der ihn anspricht, behauptet eine Anwesenheit, die es nicht
#: gab, und er liest sie beim Zurückkommen als etwas, das er verpasst hat.
_FRAME_CONTINUATION = (
    "OUTPUT FORMAT (platform requirement): return valid JSON and nothing else: "
    '{"turns": [{"speaker": "exact participant name", "content": "what they say"}]}. '
    "Use only the participant names given above, spelled exactly as given.\n"
    "The user is NOT present and is not being addressed. Nobody speaks to them, nobody "
    "waits for them, nobody narrates their absence. This is the participants among "
    "themselves."
)

_FRAME_DIGEST = (
    "Report only what was actually said. Never invent an event, a decision, a name or a "
    "feeling that is not in the transcript above; if something is unclear, leave it out. "
    "Write a report, not a continuation: no dialogue, no stage directions, no new scene. "
    "Third person, past tense, at most 180 words."
)


#: Was eine Welt an der Gruppen-Instruktion NICHT wegschreiben darf.
#:
#: Der Ton eines Gruppengesprächs gehört der Welt; dass niemand für einen
#: anderen spricht, gehört ihr nicht. Ausgezählt am 04.09.2026 (Faden
#: 7b2e37c3): neun Bruchstücke, alle auf Zugposition 1, alle aus dem Moment,
#: in dem ein Agent den Zug seines Vorgängers für seinen eigenen hielt. Die
#: strukturelle Hälfte der Reparatur sitzt in `chat_ai_service._as_turn`; dies
#: ist die andere Hälfte, und sie muss jede Vorlage überleben.
_FRAME_GROUP = (
    "You are one person in this scene, and your horizon ends where your senses do.\n"
    "Write what you do, say, notice and feel. You may describe the room and the others "
    "as far as your own action needs it – what they seem to be doing, how they look to "
    "you, what you make of it. What they think, decide, or do NEXT is theirs to write.\n"
    "The others are marked with their names; [User] is the human you are talking to. "
    "You may report what has already happened indirectly (\"she asked for the file\"), "
    "but you never author their next move.\n"
    "One action per turn. When the scene needs someone else to move, let it wait."
)


# ── The declaration ──────────────────────────────────────────────────────────
#
# One entry per template type the code renders. The variable sets are the keys
# the call site builds; test_prompt_contracts.py proves that by AST, so a change
# at a call site that is not mirrored here turns a test red.


def _contract(
    template_type: str,
    variables: Iterable[str],
    frame: str = "",
    required: Iterable[str] = (),
) -> PromptContract:
    pflicht = frozenset(required)
    alle = frozenset(variables)
    # Eine Pflichtvariable, die nicht deklariert ist, koennte keine Aufrufstelle
    # liefern — die Vorlage muesste dann etwas nennen, das nie gefuellt wird.
    # Der Fehler faellt beim Laden des Moduls auf, nicht im Betrieb.
    if not pflicht <= alle:
        msg = f"{template_type}: Pflichtvariablen nicht deklariert: {sorted(pflicht - alle)}"
        raise ValueError(msg)
    return PromptContract(
        template_type=template_type, variables=alle, frame=frame, required=pflicht
    )


_AGENT_IDENTITY = ("agent_name", "agent_character", "agent_background")
_WORLD = ("simulation_name", "locale_name", "world_context")

PROMPT_CONTRACTS: Mapping[str, PromptContract] = {
    c.template_type: c
    for c in (
        # ── Entity generation (generation_service) ────────────────────────
        _contract(
            "agent_generation_full",
            ("agent_name", "agent_system", "agent_gender", "simulation_name", "locale_name"),
            frame=_FRAME_PROSE,
        ),
        _contract(
            "agent_generation_partial",
            (
                "agent_name",
                "agent_system",
                "agent_gender",
                "existing_data",
                "simulation_name",
                "locale_name",
            ),
            frame=_FRAME_PROSE,
        ),
        # Both building types are served by one call site that builds one dict,
        # so both declare the same names. `building_name` is what selects the
        # `_named` variant; on the unnamed one it simply never has a value.
        _contract(
            "building_generation",
            (
                "building_name",
                "building_type",
                "building_style",
                "building_condition",
                "simulation_name",
                "locale_name",
            ),
            frame=_FRAME_PROSE,
        ),
        _contract(
            "building_generation_named",
            (
                "building_name",
                "building_type",
                "building_style",
                "building_condition",
                "simulation_name",
                "locale_name",
            ),
            frame=_FRAME_PROSE,
        ),
        _contract(
            "agent_reactions",
            (
                "agent_name",
                "agent_character",
                "agent_system",
                "event_title",
                "event_description",
                "simulation_name",
                "locale_name",
            ),
        ),
        _contract(
            "event_generation",
            ("event_type", "simulation_name", "locale_name"),
            frame=_FRAME_PROSE,
        ),
        _contract(
            "news_transformation",
            # `lens_directives` ist der Block, den der Schmelztiegel der Schleuse
            # stellt (Ort, Vektor, Tonlage, Anweisung). EIN Platzhalter statt
            # vier, weil `str.format` jeden benannten Platzhalter verlangt und
            # vier einzelne auch dann dastehen muessten, wenn es keine Linse
            # gibt. Er wird immer geliefert und ist im Normalfall leer.
            ("news_title", "news_content", "simulation_name", "locale_name", "lens_directives"),
        ),
        _contract(
            "social_media_transform_dystopian",
            ("post_content", "simulation_name", "locale_name"),
        ),
        _contract(
            "social_media_sentiment",
            ("post_content",),
        ),
        _contract(
            "social_trends_campaign",
            ("trend_title", "trend_description", "simulation_name", "locale_name"),
        ),
        _contract(
            "relationship_generation",
            (
                *_AGENT_IDENTITY,
                "agent_system",
                "other_agents",
                "simulation_name",
                "locale_name",
            ),
            frame=_FRAME_PROSE,
        ),
        _contract(
            "event_echo_transformation",
            (
                "source_title",
                "source_description",
                "source_simulation",
                "impact_level",
                "target_simulation",
                "target_description",
                "echo_vector",
                "locale_name",
            ),
        ),
        _contract(
            "resonance_transformation",
            (
                "resonance_title",
                "resonance_description",
                "archetype_name",
                "archetype_description",
                "magnitude",
                "event_type",
                "simulation_name",
                "locale_name",
            ),
        ),
        _contract(
            "story_closing_line",
            ("archetype_name", "archetype_description", "simulation_name", "simulation_description"),
        ),
        # ── Image descriptions — the frames live here ─────────────────────
        _contract(
            "portrait_description",
            (*_AGENT_IDENTITY, "agent_gender", *_WORLD),
            frame=_FRAME_PORTRAIT,
        ),
        _contract(
            "building_image_description",
            (
                "building_name",
                "building_type",
                "building_condition",
                "building_style",
                "building_description",
                "special_type",
                "construction_year",
                "population_capacity",
                "zone_name",
                *_WORLD,
            ),
            frame=_FRAME_BUILDING,
        ),
        _contract(
            "lore_image_description",
            ("section_title", "section_body", "simulation_name", "world_context"),
            frame=_FRAME_SCENE,
        ),
        _contract(
            "banner_description",
            ("simulation_name", "simulation_description", "atmosphere", "zones", "world_context"),
            frame=_FRAME_BANNER,
        ),
        _contract(
            "ambassador_portrait_description",
            (
                *_AGENT_IDENTITY,
                "simulation_name",
                "simulation_theme",
                "partner_simulation_name",
                "partner_theme",
                "bleed_vector",
                "vector_person_effect",
            ),
            frame=_FRAME_PORTRAIT,
        ),
        _contract(
            "embassy_building_image_description",
            (
                "building_name",
                "building_description",
                "building_style",
                "building_condition",
                "simulation_name",
                "simulation_theme",
                "partner_simulation_name",
                "partner_theme",
                "bleed_vector",
                "vector_description",
                "embassy_question",
            ),
            frame=_FRAME_BUILDING,
        ),
        # ── Narrative long-form ───────────────────────────────────────────
        _contract(
            "chronicle_generation",
            (
                "edition_number",
                "simulation_name",
                "period_start",
                "period_end",
                "event_summary",
                "echo_summary",
                "battle_summary",
                "reaction_summary",
            ),
            frame=_FRAME_CHRONICLE,
        ),
        _contract("cycle_sitrep_generation", ("cycle_number", "battle_stats")),
        _contract(
            "epoch_invitation_lore",
            ("epoch_name", "epoch_description", "participant_names"),
        ),
        # ── Memory (generation_service façade) ────────────────────────────
        _contract(
            "memory_extraction",
            ("agent_name", "user_message", "agent_response", "simulation_name"),
        ),
        _contract("memory_reflection", ("agent_name", "observations_text", "simulation_name")),
        # ── Chat (chat_ai_service) ────────────────────────────────────────
        _contract(
            "chat_system_prompt",
            (
                *_AGENT_IDENTITY,
                "agent_system",
                "agent_gender",
                "agent_profession",
                "agent_mood",
                "agent_memories",
                "simulation_name",
                "locale_name",
            ),
            frame=_FRAME_CHAT,
            # Ohne diese beiden spricht die Figur ohne Gedaechtnis und ohne
            # Stimmung — und es sieht ihr niemand an. Drei von vier
            # welteigenen Vorlagen auf Prod hatten genau das (04.09.2026).
            required=frozenset({"agent_memories", "agent_mood"}),
        ),
        _contract(
            "chat_group_instruction",
            ("agent_name", "other_agent_names", "addressed_note"),
            frame=_FRAME_GROUP,
            # Der eigene Name ist PFLICHT, nicht Schmuck. Die Anweisung steht
            # als letzte Zeile vor der Antwort; nennt sie nur die anderen,
            # ist der einzige Ich-Sprecher in Reichweite der Vorredner.
            required=("agent_name",),
        ),
        _contract(
            "chat_continuation",
            (
                "participant_names",
                "agent_profiles",
                "conversation_digest",
                "recent_transcript",
                "locale_name",
                "turn_count",
            ),
            frame=_FRAME_CONTINUATION,
        ),
        _contract(
            "chat_conversation_digest",
            ("participant_names", "transcript", "locale_name", "segment_index"),
            frame=_FRAME_DIGEST,
        ),
        _contract(
            # Die Ich-Schicht (Migration 373). Der eigene Name ist Pflicht:
            # ohne ihn waere es wieder ein Bericht ueber alle.
            "chat_character_episode",
            ("agent_name", "other_agent_names", "segment_index", "transcript", "locale_name"),
            frame=_FRAME_DIGEST,
            required=("agent_name",),
        ),
        _contract("chat_event_context", ("event_list",)),
        _contract(
            "chat_event_item",
            ("event_title", "event_type", "impact_level", "occurred_at", "event_description"),
        ),
        _contract(
            "chat_event_reaction",
            ("agent_name", "event_title", "reaction_text", "emotion"),
        ),
        # ── Instagram captions (instagram_content_service) ────────────────
        *(
            _contract(
                f"instagram_{content_type}_caption",
                ("entity_name", "entity_context", "simulation_name", "dispatch_number", "date"),
            )
            for content_type in ("agent", "building", "chronicle", "lore")
        ),
    )
}


def get_contract(template_type: str) -> PromptContract | None:
    """Return the contract for a template type, or ``None`` if none is declared.

    A missing contract is not an error: ``prompt_templates`` also carries rows
    no code renders (``embassy_pair_generation``, ``scanner_*``). Callers must
    treat ``None`` as "no authority to judge" and leave the template alone.
    """
    return PROMPT_CONTRACTS.get(template_type)


# ── Reading a template ───────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class TemplateAudit:
    """What a template references, split by whether the code can honour it."""

    known: frozenset[str] = frozenset()
    """Declared variables the template uses. These are the honest placeholders."""

    unknown: frozenset[str] = frozenset()
    """Placeholders no call site supplies – invented, and the reason for W1."""

    mustache: frozenset[str] = frozenset()
    """Placeholders written ``{{name}}``, regardless of whether they are known."""

    missing: frozenset[str] = frozenset()
    """Pflichtvariablen, die die Vorlage NICHT nennt — und die deshalb
    lautlos wegfallen. Siehe :attr:`Defect.MISSING`."""

    @property
    def is_clean(self) -> bool:
        return not self.unknown and not self.mustache and not self.missing

    @property
    def defects(self) -> dict[Defect, frozenset[str]]:
        """Non-empty defect classes, for structured logging."""
        found: dict[Defect, frozenset[str]] = {}
        if self.unknown:
            found[Defect.UNKNOWN] = self.unknown
        if self.mustache:
            found[Defect.MUSTACHE] = self.mustache
        if self.missing:
            found[Defect.MISSING] = self.missing
        return found


def audit_template(text: str, contract: PromptContract | None) -> TemplateAudit:
    """Classify every placeholder in ``text`` against ``contract``.

    Without a contract every placeholder counts as known: we have no declaration
    to judge against, and guessing would be worse than silence.
    """
    known: set[str] = set()
    unknown: set[str] = set()
    mustache: set[str] = set()

    for match in _PLACEHOLDER_RE.finditer(text or ""):
        doubled, single = match.group(1), match.group(2)
        name = doubled or single
        if name is None:  # pragma: no cover - the regex always captures one
            continue
        if doubled:
            mustache.add(name)
        if contract is None or name in contract.variables:
            known.add(name)
        else:
            unknown.add(name)

    # Was die Vorlage haette nennen MUESSEN und nicht nennt. Nur mit Vertrag:
    # ohne Deklaration gibt es keine Pflicht, die man verfehlen koennte.
    missing = frozenset(contract.required - known) if contract else frozenset()

    return TemplateAudit(
        known=frozenset(known),
        unknown=frozenset(unknown),
        mustache=frozenset(mustache),
        missing=missing,
    )


# ── Rendering a template ─────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class RenderResult:
    """The filled prompt plus what was wrong with the template while filling it."""

    text: str
    audit: TemplateAudit = field(default_factory=TemplateAudit)


def render_template(
    text: str,
    variables: Mapping[str, str],
    contract: PromptContract | None,
) -> RenderResult:
    """Substitute ``{name}`` placeholders and report the template's defects.

    Three cases, and the difference between the first two is the whole point:

    * declared and supplied -> the value;
    * declared but not supplied -> the empty string. Normal: several variables
      are conditional at their call site;
    * not declared -> the empty string, and reported. Leaving ``{agent_title}``
      standing is what let a downstream model invent a legibility score.

    ``{{name}}`` is substituted like ``{name}`` and reported separately, so a
    world whose rows have not been repaired yet still renders correctly instead
    of shipping ``Name: {agent_name}`` to the model. Every other brace is
    literal, which keeps a JSON example inside a prompt intact.
    """
    audit = audit_template(text, contract)

    def substitute(match: re.Match[str]) -> str:
        name = match.group(1) or match.group(2)
        return str(variables.get(name, ""))

    return RenderResult(text=_PLACEHOLDER_RE.sub(substitute, text or ""), audit=audit)


# ── Repairing a template ─────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SanitizeResult:
    """A template rewritten to satisfy its contract, and what changed."""

    text: str
    audit: TemplateAudit
    changed: bool

    @property
    def used_variables(self) -> list[str]:
        """The declared variables the sanitised text still uses, sorted.

        This is what belongs in ``prompt_templates.variables``.
        """
        return sorted(self.audit.known)


# A sentence ends at .!? followed by whitespace, or at a line break. "e.g.," does
# not match, because the period is followed by a comma rather than a space.
_SEGMENT_RE = re.compile(r"(?<=[.!?])\s+|\n")

# Whitespace artefacts left behind by removing a token from the middle of a line.
_DOUBLE_SPACE_RE = re.compile(r"[ \t]{2,}")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"[ \t]+([,.;:!?%)\]])")


def _clean_removal_artefacts(segment: str) -> str:
    """Tidy only what removing a token left behind: doubled spaces, orphan gaps.

    Applied per segment, and only to segments that actually changed, so the
    formatting of the rest of the template is untouched.
    """
    cleaned = _DOUBLE_SPACE_RE.sub(" ", segment)
    return _SPACE_BEFORE_PUNCT_RE.sub(r"\1", cleaned)


def sanitize_template(text: str, contract: PromptContract | None) -> SanitizeResult:
    """Rewrite ``text`` so that every placeholder it keeps is one the code fills.

    Three rules, in order:

    1. ``{{name}}`` -> ``{name}`` when the code supplies ``name``: the Mustache
       mistake, corrected.
    2. A sentence that names an undeclared variable **and no declared one** is
       removed whole. Such a sentence exists only to present data that will
       never arrive; stripping just the token would leave the ATRAMENT portrait
       reading *"Pinned to the lapel is a diagnosis: 'Leserlichkeit: %'"*, which
       still tells an image model to draw a badge — measured on the real row.
    3. Otherwise the token alone is removed and the gap it leaves is closed.
       The sentence survives because it carries a variable that does arrive:
       dropping *"Describe a portrait of {agent_name}, a {agent_title}…"* would
       cost the agent's name, which appears nowhere else.

    Prose is never rewritten, only cut at these seams — anything more would be
    an editorial act on 48 production rows. Every change is printed by
    ``scripts/repair_simulation_prompt_templates.py`` before it is applied.

    Without a contract the text is returned unchanged: no declaration, no
    authority.
    """
    audit = audit_template(text, contract)
    original = text or ""
    if contract is None:
        return SanitizeResult(text=original, audit=audit, changed=False)

    def repair(match: re.Match[str]) -> str:
        name = match.group(1) or match.group(2)
        return "" if name not in contract.variables else "{" + name + "}"

    pieces: list[str] = []
    # re.split with a capturing-free pattern drops the separators, so walk the
    # matches instead and keep every character of the original.
    cursor = 0
    for separator in _SEGMENT_RE.finditer(original):
        pieces.append(original[cursor : separator.start()])
        pieces.append(separator.group(0))
        cursor = separator.end()
    pieces.append(original[cursor:])

    rebuilt: list[str] = []
    dropped_previous = False
    for index, piece in enumerate(pieces):
        if index % 2 == 1:
            # A separator follows its sentence. Drop it only when that sentence
            # was removed — never because the segment happened to be empty. A
            # blank line produces an empty segment too, and reading the last
            # rebuilt entry cannot tell the two apart: it ate blank lines out of
            # every bulleted template and reported `changed` with no defect to
            # show for it.
            if dropped_previous:
                dropped_previous = False
                continue
            rebuilt.append(piece)
            continue

        segment_audit = audit_template(piece, contract)
        if segment_audit.unknown and not segment_audit.known:
            dropped_previous = True  # rule 2: the whole sentence goes
            continue

        dropped_previous = False
        repaired = _PLACEHOLDER_RE.sub(repair, piece)
        if repaired != piece:
            repaired = _clean_removal_artefacts(repaired)
        rebuilt.append(repaired)

    result = "".join(rebuilt)

    # ── Die vierte Regel: eine fehlende Pflichtvariable wird ANGEHAENGT ─────
    #
    # Die drei Regeln oben schneiden. Diese fuegt ein, und das ist ein anderer
    # Eingriff — er wird deshalb so eng wie moeglich gehalten: der blosse
    # Platzhalter auf einer eigenen Zeile, kein erfundener Begleitsatz.
    #
    # Genau die Gestalt, die die Plattform-Vorlage seit jeher hat:
    #
    #     Dein Hintergrund: {agent_background}
    #
    #     {agent_memories}
    #
    #     {agent_mood}
    #
    # Ein Satz drumherum muesste eine Sprache waehlen, und die Vorlage, die
    # repariert wird, kennt womoeglich eine andere als die Welt (auf Prod war
    # genau das der Fall). Der nackte Platzhalter kennt keine.
    #
    # ANS ENDE, nicht mittendrin: was zuletzt im Prompt steht, wiegt am
    # schwersten, und der Zustand des Agenten soll gegen den Rahmen nicht
    # verlieren. Ausserdem gibt es keine Stelle im fremden Text, die man
    # aufschneiden koennte, ohne ihn zu redigieren.
    if audit.missing:
        result = result.rstrip() + "\n\n" + "\n\n".join(
            "{" + name + "}" for name in sorted(audit.missing)
        )

    return SanitizeResult(text=result, audit=audit, changed=result != original)


# ── Talking about the contract ───────────────────────────────────────────────


def variable_catalogue(contract: PromptContract) -> str:
    """Render the declared variables as a prompt-ready, comma-separated list.

    Used to build the A.6 generation prompt per template type. Before this, the
    prompt offered one global list that was both wrong (it invited ``zone_name``
    into a chat template, where nothing supplies it) and short by nine names.
    """
    return ", ".join(f"{{{name}}}" for name in sorted(contract.variables))


def example_variables(contract: PromptContract) -> dict[str, str]:
    """Placeholder values for previewing a template without calling the AI.

    Every declared variable gets a visible stand-in, so an admin previewing a
    template sees which slots exist rather than a prompt full of blanks.
    """
    return {name: _EXAMPLE_VALUES.get(name, f"<{name}>") for name in sorted(contract.variables)}


_EXAMPLE_VALUES: Mapping[str, str] = {
    "agent_background": "Born in the capital, transferred twice, never promoted.",
    "agent_character": "Methodical, mistrustful, quietly funny.",
    "agent_gender": "female",
    "agent_name": "Test Agent",
    "agent_profession": "archivist",
    "agent_system": "politics",
    "building_condition": "fair",
    "building_name": "City Hall",
    "building_style": "brutalist",
    "building_type": "government",
    "edition_number": "12",
    "event_type": "political",
    "locale_name": "English",
    "simulation_name": "Test Simulation",
    "zone_name": "Central District",
}
