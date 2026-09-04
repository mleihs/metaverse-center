"""Chat AI service with conversation memory and group chat support."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.ai_usage_service import AIUsageService
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.chat.conversation_digest_service import ConversationDigestService
from backend.services.chat.focalization_service import FocalizationService
from backend.services.external.openrouter import BudgetContext, OpenRouterService
from backend.services.i18n_utils import (
    EMOTION_LABELS,
    MOOD_CONTEXT_TEMPLATES,
    MOOD_DESCRIPTORS,
    MOODLET_TYPE_LABELS,
    STRESS_DESCRIPTORS,
    get_localized_field,
    localize_label,
)
from backend.services.model_resolver import ModelResolver, ResolvedModel
from backend.services.platform_model_config import get_platform_max_tokens, get_platform_reasoning
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from backend.utils.responses import extract_list
from backend.utils.settings import get_content_locale
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Strong references so fire-and-forget extraction tasks cannot be
# garbage-collected mid-flight (asyncio only holds weak refs to running tasks).
_MEMORY_EXTRACT_TASKS: set[asyncio.Task[None]] = set()
_DIGEST_TASKS: set[asyncio.Task[None]] = set()

# ── Model-aware history limits ────────────────────────────
# Instead of a static message count, compute the limit from the model's
# context window.  No tokenizer dependency — uses a 4-chars-per-token
# heuristic which is conservative for English prose.

# ⚠ REIHENFOLGE IST BEDEUTUNG: die Suche nimmt den ERSTEN passenden Praefix.
# Der spezifischere Eintrag muss deshalb VOR dem allgemeineren stehen —
# `deepseek-v4` vor `deepseek`, sonst bekaeme v4-flash die 128k des Vorgaengers
# und der Chat benutzte ein Achtel seines Fensters.
#
# Gemessen am OpenRouter-Katalog (02.09.2026):
#     deepseek/deepseek-v4-flash        1 048 576
#     deepseek/deepseek-v4-pro          1 048 576
#     deepseek/deepseek-chat              163 840
_CONTEXT_WINDOWS: dict[str, int] = {
    "deepseek-v4": 1_000_000,
    "claude": 200_000,
    "gemini": 1_000_000,
    "gpt-4o": 128_000,
    "gpt-4": 128_000,
    "llama": 128_000,
    "mistral": 128_000,
    "deepseek": 128_000,
}
# Vorsichtig, nicht großzügig: ein Modell, das nicht in der Tabelle steht,
# kann jede Fensterbreite haben, und die kleinen sind die häufigeren im
# OpenRouter-Katalog. Eine zu hohe Annahme lässt den Anbieteraufruf
# scheitern; eine zu niedrige kostet Erinnerung. Der zweite Fehler ist der
# billigere und der sichtbarere.
_DEFAULT_CONTEXT_WINDOW = 32_000
_TOKENS_PER_MESSAGE_ESTIMATE = 250
_CONTEXT_RESERVE = 5_000  # system prompt + response headroom
_HISTORY_BUDGET_RATIO = 0.6  # use 60% of context for history
_MAX_MESSAGES_HARD = 200  # prevent huge DB queries
_MIN_MESSAGES = 20

#: Marke für eine Stimme, deren Namen niemand mehr kennt — ein Agent, der aus
#: der Unterhaltung entfernt wurde, dessen Sätze aber stehen bleiben. Sie ist
#: strukturell wie `[Name]:` selbst und gehört deshalb nicht in die
#: Übersetzung; sie steht im Prompt, nicht auf dem Bildschirm.
#:
#: Ohne sie liefe der fremde Satz OHNE Präfix in den Verlauf, und ein Modell
#: liest eine unbeschriftete `assistant`-Zeile als seine eigene frühere
#: Äusserung. Eine unbekannte Herkunft zuzugeben ist der billigere Fehler als
#: eine falsche zu behaupten.
_DEPARTED_SPEAKER = "former participant"

#: Die Marke des MENSCHEN im Gruppenverlauf.
#:
#: BEFUND: ein Agent hat die Handlung des MENSCHEN fuer sich uebernommen —
#: Agent A schrieb sie ihm korrekt zu, Agent B nahm sie Sekunden spaeter an
#: sich. Der Wortlaut steht hier bewusst nicht: er stammt aus einem echten
#: Gespraech, und dieses Repo ist oeffentlich. Fuer den Befund reicht die Form.
#:
#: DIE URSACHE steht im zusammengesetzten Verlauf. So kommt er bei Agent B an
#: (schematisch, erfundener Inhalt):
#:
#:     user   <Zeile des Menschen>
#:
#:            [Marie Morgenrot]: *Du haeltst einen Korb Aepfel in den Haenden.*
#:
#:            (naechste Zeile von Agent B)
#:
#: EIN Block. Maries Zeile hat einen Besitzer, die des Menschen hat KEINEN.
#: Eine unbeschriftete Zeile in einem Block voller beschrifteter liest sich
#: wie herrenlose Erzaehlung — also schreibt das Modell daran weiter.
#:
#: Das Zusammenfassen aufeinanderfolgender `user`-Zuege (noetig, weil mehrere
#: Anbieter zwei gleiche Rollen in Folge ablehnen) hat es verschaerft: vorher
#: stand der Satz des Menschen wenigstens fuer sich.
#:
#: Strukturell wie `_DEPARTED_SPEAKER`: englisch, im Prompt, nie auf dem
#: Bildschirm — und deshalb NICHT uebersetzt. Dieselbe Marke benutzt
#: `ConversationDigestService._as_line` in der Mitschrift.
_USER_SPEAKER = "User"

# ── Zeichen je Token, je Sprache ──────────────────────────────────────────
#
# GEMESSEN AM 02.09.2026 an 419 PARALLELEN Textpaaren aus der Produktion
# (`agent_memories.content/content_de`, `agents.background/_de`,
# `agents.character/_de`, `buildings.description/_de`) — dieselbe Aussage in
# beiden Sprachen, damit nur die Sprache den Unterschied macht, nicht der
# Inhalt. Tokenisiert mit `tiktoken`:
#
#                     o200k_base (GPT-4o)      cl100k_base (GPT-4)
#     Englisch            4,61                     4,42
#     Deutsch             4,01                     3,37
#     Token DE / EN       1,26×                    1,44×
#
# Deutsch braucht für DENSELBEN Inhalt 26–44 % mehr Token. Der Grund ist
# nicht die Textlänge allein (Deutsch ist nur 9,4 % länger in Zeichen),
# sondern die Zerlegung: Komposita und Umlaute fallen in mehr Stücke.
#
# ⚠ Die alte Annahme "4 chars per token which is conservative for English
# prose" war in BEIDE Richtungen falsch: für Englisch zu vorsichtig (echte
# 4,4–4,6) und für Deutsch zu großzügig (echte 3,4–4,0). Der zweite Fehler
# ist der gefährliche — er lässt mehr Verlauf mitschicken, als das Fenster
# fasst, und der Aufruf scheitert dann beim Anbieter.
#
# Genommen wird die PESSIMISTISCHE Kodierung (cl100k), nicht die günstigere:
# unterschätzte Token sind die teure Richtung, und Claude tokenisiert
# Deutsch näher an cl100k als an o200k. Fail-closed, wie bei
# `_DEFAULT_CONTEXT_WINDOW`.
#
# KEIN Tokenisierer zur Laufzeit: `tiktoken` lädt seine BPE-Tabellen beim
# ersten Aufruf über das Netz und hängt hier nur transitiv an
# `tavily-python`. Beides gehört nicht in den Anfragepfad eines Chats.
_CHARS_PER_TOKEN: dict[str, float] = {
    "de": 3.4,
    "en": 4.4,
}
_CHARS_PER_TOKEN_DEFAULT = 3.4  # unbekannte Sprache: die teurere Annahme

# ── Die Regler des Gespraechszugs ─────────────────────────────────────────
#
# Bis 02.09.2026 gingen NUR `temperature` und `max_tokens` an den Anbieter; die
# uebrigen Regler gab es im Aufruf gar nicht. Der Chat umgeht `run_ai` und damit
# die ganze Zweck-Maschinerie — auch das `reasoning`, das dort laengst
# geschickt wird. Beides ist jetzt angeschlossen.
#
# ⚠ `temperature` UND `top_p` zugleich ist gaengige Rollenspiel-Praxis, aber
# nicht sauber: sie wirken multiplikativ, man weitet erst (1,15) und verengt
# dann (0,95). Wer beide setzt, kann die Wirkung nicht mehr einzeln nachrechnen.
# Bewusst so gewaehlt, nicht uebersehen.
# DeepSeeks eigene Empfehlung liegt fuer kreatives Schreiben bei ~1,3, fuer
# Allgemeines bei 1,0. 1,15 ist der massvolle Schritt dazwischen: spontaner als
# die Vorgabe, ohne dass die Figur aus der Rolle kippt.
_CHAT_TEMPERATURE = 1.15

_CHAT_TOP_P = 0.95

# Modelle schleifen sich im Rollenspiel in Formulierungen ein. 0,15 ist niedrig
# genug, dass die Strafe nach HAEUFIGKEIT nicht die Eigennamen trifft — bei
# hoeheren Werten hoert ein Agent auf, seinen eigenen Namen zu sagen.
_CHAT_FREQUENCY_PENALTY = 0.15

# `presence_penalty` bleibt ABSICHTLICH ungesetzt. Es wirkt binaer (kam das
# Token ueberhaupt vor), und der urspruenglich erwogene Wert 0,05 liegt unter
# der Wahrnehmungsschwelle: ein Regler, der nichts tut, ist schlechter als
# keiner, weil ihn der Naechste fuer wirksam haelt.


def _chat_max_tokens() -> int:
    """Das Antwortbudget aus der Zweck-Deklaration, nicht aus dem Modell.

    `AI_PURPOSES["chat_response"]` sagt 1 400 und begruendet es dort. Waere die
    Zahl hier noch einmal geschrieben, gaebe es zwei Orte fuer eine Entscheidung
    — und eine Deklaration, die niemand liest, ist Zierrat.

    Ein Admin kann sie ohne Deploy ueber `max_tokens_chat_response` heben.
    """
    return get_platform_max_tokens("chat_response")


def _max_history_messages(model_id: str) -> int:
    """Compute the maximum number of history messages for a given model.

    NACHGEMESSEN AM 31.08.2026: diese Funktion lieferte für JEDES Modell der
    Tabelle 200 — und für ein unbekanntes ebenfalls. Zwanzig Zeilen
    Fensterbreiten, Budgetanteil, Reserve und Tokenschätzung erzeugten eine
    Konstante. Die Kappe ``_MAX_MESSAGES_HARD`` band immer, weil schon das
    kleinste Fenster der Tabelle (128k) rechnerisch 287 Nachrichten erlaubt.

    Das ist die Bauart, die dieser Prüflauf laufend findet: Maschinerie, die
    aussieht, als entschiede sie etwas, und nichts entscheidet. Gefährlich
    wird sie nicht durch das Rechnen, sondern durch die ANNAHME darunter —
    ``_DEFAULT_CONTEXT_WINDOW`` stand auf 128 000, also bekam ein UNBEKANNTES
    Modell die großzügigste Schätzung. Ein 8k- oder 16k-Modell aus dem
    OpenRouter-Katalog hätte damit 200 Nachrichten (~50 000 Token) in ein
    Fenster geschickt, das sie nicht fasst; der Aufruf scheitert dann beim
    Anbieter, nicht hier.

    Die Vorgabe ist deshalb jetzt VORSICHTIG. Für die Modelle der Tabelle
    ändert sich nichts (die Kappe bindet weiterhin); für ein unbekanntes
    bindet die Rechnung, und zwar nach unten. Fail-closed statt fail-open —
    dieselbe Richtung wie bei ``parse_setting_bool``.
    """
    context_tokens = _DEFAULT_CONTEXT_WINDOW
    model_lower = model_id.lower()
    for prefix, tokens in _CONTEXT_WINDOWS.items():
        if prefix in model_lower:
            context_tokens = tokens
            break

    budget = int(context_tokens * _HISTORY_BUDGET_RATIO) - _CONTEXT_RESERVE
    estimated = budget // _TOKENS_PER_MESSAGE_ESTIMATE
    return max(_MIN_MESSAGES, min(estimated, _MAX_MESSAGES_HARD))


def _history_token_budget(model_id: str) -> int:
    """Wie viele Token der Verlauf höchstens belegen darf."""
    context_tokens = _DEFAULT_CONTEXT_WINDOW
    model_lower = model_id.lower()
    for prefix, tokens in _CONTEXT_WINDOWS.items():
        if prefix in model_lower:
            context_tokens = tokens
            break
    return max(0, int(context_tokens * _HISTORY_BUDGET_RATIO) - _CONTEXT_RESERVE)


def _trim_history_to_budget(messages: list[dict], model_id: str, locale: str) -> list[dict]:
    """Kürzt den Verlauf auf das, was wirklich ins Fenster passt.

    WARUM DAS NICHT SCHON VORHER SO WAR
    ``_max_history_messages`` teilt ein Tokenbudget durch eine feste Schätzung
    von 250 Token je Nachricht und liefert eine ANZAHL. Das ist eine Vermutung
    über Text, der beim Kürzen längst vorliegt — die Nachrichten sind geladen,
    ihre Länge ist bekannt, und trotzdem wird geraten.

    Gemessen an den echten Nachrichten auf Prod (02.09.2026, o200k_base):

        Mittel 161 Token · Median 107 · p90 314 · Maximum 682

    Die 250 liegen also über dem Mittel, aber unter p90 — und sie kennen die
    Sprache nicht. Zwanzig deutsche Nachrichten am oberen Rand sprengen ein
    Budget, das die Zählung für eingehalten hält.

    Diese Funktion misst stattdessen: von der JÜNGSTEN Nachricht rückwärts,
    bis das Budget voll ist. Die Anzahl bleibt als Datenbankgrenze bestehen
    (sie hält die Abfrage klein); hier entscheidet die Länge.

    Die Reihenfolge des Rückwärtsgehens ist der Kern: was zuletzt gesagt
    wurde, ist das, was ein Gespräch trägt. Von vorne zu kürzen hieße, den
    Agenten den Anfang behalten und das Ende vergessen zu lassen — genau der
    Fehler, den ``_load_history`` am 31.08. abgelegt hat.
    """
    if not messages:
        return messages

    budget = _history_token_budget(model_id)
    if budget <= 0:
        return messages[-_MIN_MESSAGES:]

    zeichen_je_token = _CHARS_PER_TOKEN.get(locale.lower()[:2], _CHARS_PER_TOKEN_DEFAULT)
    verbraucht = 0.0
    behalten = 0
    for nachricht in reversed(messages):
        text = str(nachricht.get("content") or "")
        # Vier Token Aufschlag je Nachricht fuer Rolle und Trennzeichen, wie
        # die Anbieter sie im Nachrichtenformat berechnen.
        kosten = len(text) / zeichen_je_token + 4
        if verbraucht + kosten > budget and behalten >= _MIN_MESSAGES:
            break
        verbraucht += kosten
        behalten += 1

    return messages[-behalten:] if behalten else messages[-_MIN_MESSAGES:]


@dataclass(slots=True)
class _GroupTurnSetup:
    """Alles, was eine Gruppenantwort braucht, bevor der erste Agent spricht.

    Existiert, weil ``generate_group_response`` und ``stream_group_response``
    diesen Block ZEICHENGLEICH trugen — sechzehn Zeilen, sechs davon
    Netzwerkaufrufe. Zwei Kopien einer Reihenfolge sind zwei Gelegenheiten, sie
    unterschiedlich zu ändern; hier hätte das bedeutet, dass eine neue
    Kontextquelle in der einen Fassung ankommt und in der gestreamten still
    fehlt. Dieselbe Bauart wie die doppelte Zustandsleiter vor Migration 303.
    """

    agents: list[dict]
    agent_names: list[str]
    simulation: dict | None
    locale: str
    prompt_template: Any
    model: ResolvedModel
    event_context: str
    digest_text: str = ""
    #: Der Verlauf, EINMAL geladen.
    #:
    #: Er ist fuer alle Sprecher derselbe — dieselbe Unterhaltung, dasselbe
    #: Modell, dieselbe Kappung. Geladen wurde er trotzdem je Agent: gemessen
    #: am 04.09.2026 gegen einen zaehlenden Doppelgaenger, drei Agenten,
    #: 14 Rundreisen je Nutzernachricht, davon DREI identische Abrufe von
    #: `chat_messages` mit bis zu 200 Zeilen.
    #:
    #: Was sich je Agent unterscheidet, ist nicht der Verlauf, sondern seine
    #: AUSLEGUNG (`_as_turn` entscheidet je Sprecher ueber Rolle und Marke) —
    #: und die ist reine Rechnung ohne Netz.
    history: list[dict] = field(default_factory=list)
    #: Der Beziehungskontext JE AGENT, in EINER Abfrage geholt.
    #:
    #: Er unterscheidet sich je Sprecher, die Abfrage muss es nicht: bis zum
    #: 04.09.2026 lief `_build_relationship_context` einmal je Agent, also
    #: dreimal dieselbe Tabelle mit demselben Filter auf
    #: `simulation_id`, nur mit einer anderen `agent_id`.
    relationships: dict[str, str] = field(default_factory=dict)


@dataclass
class SSEEvent:
    """A Server-Sent Event for chat streaming.

    Event types:
        user_confirmed — user message saved, with reconciliation data
        agent_start    — agent begins generating (index, total for group chat)
        token          — incremental content token
        agent_done     — agent finished, includes full saved message
        done           — entire streaming response complete
        error          — generation failed
    """

    event: str
    data: dict


class ChatAIService:
    """Generates AI responses for chat conversations.

    Uses conversation history as memory and agent profile as context.
    Supports both 1:1 and group conversations.
    """

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        openrouter_api_key: str | None = None,
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._prompt_resolver = PromptResolver(supabase, simulation_id)
        self._model_resolver = ModelResolver(supabase, simulation_id)
        self._openrouter = OpenRouterService(api_key=openrouter_api_key)
        self._digests = ConversationDigestService(supabase, simulation_id, openrouter_api_key)
        #: Stimmung je Agent, im Vorlauf eines Gruppenzugs gefuellt.
        #: Der Dienst lebt genau eine Anfrage lang; er kann darin nicht
        #: veralten. Derselbe Weg wie `_cached_locale`.
        self._mood_cache: dict[str, str] = {}

    # ── Shared prompt assembly ───────────────────────────────

    async def _build_generation_context(
        self,
        *,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        history_messages: list[dict[str, str]],
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
        closing_instruction: str = "",
    ) -> list[dict[str, str]]:
        """Build the full message list (system prompt + history) for OpenRouter.

        Shared by both streaming and non-streaming generation paths. Handles:
        template variable injection, mood context, language instruction, and
        extra context assembly.

        Returns:
            Complete messages list ready for OpenRouter: [system, *history].
        """
        variables = self._build_agent_variables(agent, simulation, locale)
        if extra_variables:
            variables.update(extra_variables)

        mood_context = await self._build_mood_context(UUID(agent["id"]), locale)
        if mood_context:
            variables["agent_mood"] = mood_context

        # Finding 25. The template's OWN `system_prompt` — the persona phase A.6
        # writes for the world ("You roleplay characters from {simulation_name},
        # where the state is a living body and legibility its breath") — was
        # authored, stored and then dropped: this method built the system message
        # from `prompt_content` alone. Measured on production 2026-08-30, four
        # simulations carry one (269-407 characters); both platform rows carry
        # none, so for the other 37 worlds this composition is a strict no-op.
        #
        # The order is not a guess. `GenerationService._generate` already treats
        # a template's `system_prompt` as the system framing and renders it with
        # `fill_system_prompt`, which substitutes variables — without it the
        # literal `{simulation_name}` above would reach the model, which is the
        # exact defect that method was written for. Persona first, the concrete
        # per-agent instructions and the platform frame after: whatever comes
        # last carries the most weight, and the frame is what a world may not
        # edit away.
        persona = self._prompt_resolver.fill_system_prompt(prompt_template, variables)
        body = self._prompt_resolver.fill_template(prompt_template, variables)
        system_prompt = f"{persona}\n\n{body}" if persona else body
        system_prompt += PromptResolver.build_language_instruction(locale)

        if extra_context:
            system_prompt += f"\n\n{extra_context}"

        messages = [{"role": "system", "content": system_prompt}, *history_messages]
        return self._append_closing_instruction(messages, closing_instruction)

    @staticmethod
    def _append_closing_instruction(
        messages: list[dict[str, str]], instruction: str
    ) -> list[dict[str, str]]:
        """Die Anweisung, die UNMITTELBAR VOR der Antwort stehen muss.

        ⚠ GEMESSEN am 04.09.2026: die Gruppen-Anweisung stand an Position 0 von
        9 — im System-Prompt, also VOR dem ganzen Verlauf. In einem Faden mit
        373 Nachrichten liegen zweihundert Zuege dazwischen.

        Der Praktiker-Konsens dazu ist eindeutig und mit dem einzigen
        quantifizierten Datenpunkt belegt, den es zu dieser Frage gibt
        (37 von 40 sauberen Durchlaeufen, DeepSeek, Temperatur 0): was vorne
        steht, verblasst mit wachsendem Chat; was hinter dem Verlauf sitzt,
        bleibt. SillyTavern nennt es „Post-History Instructions" bzw. eine
        Autorennotiz auf Tiefe 0.

        WARUM ANGEHAENGT UND NICHT ALS EIGENE `system`-NACHRICHT:
        eine `system`-Rolle MITTEN im Verlauf ist bei OpenAI-kompatiblen
        Anbietern nicht verlaesslich — DeepSeek dokumentiert sie nur am
        Anfang. Dieselbe Vorsicht, aus der `_merge_consecutive_user_turns`
        entstanden ist: ein Aufruf, der bei DeepSeek durchgeht und beim
        naechsten Modell mit 400 abbricht, ist kein Aufruf, sondern eine
        Falle.

        Steht am Ende ein `user`-Zug, wird angehaengt; steht dort ein
        `assistant`-Zug (der Faden endet mit einer Agentenantwort), kommt ein
        eigener `user`-Zug dazu. In beiden Faellen ist die Anweisung das
        Letzte, was das Modell liest.
        """
        if not instruction.strip():
            return messages
        if messages and messages[-1]["role"] == "user":
            messages[-1] = {
                "role": "user",
                "content": f"{messages[-1]['content']}\n\n{instruction.strip()}",
            }
            return messages
        return [*messages, {"role": "user", "content": instruction.strip()}]

    # ── Core generation helper (non-streaming) ─────────────

    async def _generate_single_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        model: ResolvedModel,
        history_messages: list[dict[str, str]],
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
        closing_instruction: str = "",
        extra_metadata: dict[str, Any] | None = None,
        participant_names: list[str] | None = None,
    ) -> tuple[str, dict]:
        """Core generation logic for a single agent response.

        Handles: system prompt assembly, OpenRouter call, AI usage logging,
        message persistence.

        Returns:
            Tuple of (response_text, saved_message_dict).
        """
        # Mock mode: short-circuit before any AI call
        if settings.forge_mock_mode:
            return await self._mock_response(conversation_id, agent)

        messages = await self._build_generation_context(
            agent=agent,
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            history_messages=history_messages,
            extra_variables=extra_variables,
            extra_context=extra_context,
            closing_instruction=closing_instruction,
        )

        budget = await self._chat_budget()

        # Generate via OpenRouter
        t0 = time.monotonic()
        response_text = await self._openrouter.generate(
            model=model.model_id,
            messages=messages,
            temperature=_CHAT_TEMPERATURE,
            max_tokens=_chat_max_tokens(),
            top_p=_CHAT_TOP_P,
            frequency_penalty=_CHAT_FREQUENCY_PENALTY,
            reasoning=get_platform_reasoning("chat_response"),
            budget=budget,
        )
        generation_ms = int((time.monotonic() - t0) * 1000)

        return await self._persist_ai_response(
            conversation_id=conversation_id,
            agent=agent,
            model=model,
            response_text=response_text,
            generation_ms=generation_ms,
            locale=locale,
            extra_metadata=extra_metadata,
            participant_names=participant_names,
        )

    async def _chat_budget(self) -> BudgetContext:
        """The budget context both chat paths must use.

        Bureau Ops Deferral A.2 — attaches simulation context to the pre-check.
        `user_id` is not threaded through the chat services today; the global,
        per-purpose and per-simulation budgets still apply. When the chat router
        passes `user_id` down in a future refactor, extend here — in ONE place,
        which is why this is a method and no longer two inline constructions.

        It became one place because the two were not equal: the non-streaming
        path built a context and the STREAMING path passed none at all, and
        `_pre_check_budget(None)` returns immediately. The interactive path —
        the one a person actually uses, repeatedly — was the one spending
        outside every budget.
        """
        admin_supabase = await get_admin_supabase()
        return BudgetContext(
            admin_supabase=admin_supabase,
            purpose="chat",
            simulation_id=self._simulation_id,
        )

    # ── Core streaming helper ──────────────────────────────

    async def stream_single_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        model: ResolvedModel,
        history_messages: list[dict[str, str]],
        agent_index: int = 0,
        agent_total: int = 1,
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
        closing_instruction: str = "",
        extra_metadata: dict[str, Any] | None = None,
        participant_names: list[str] | None = None,
    ) -> AsyncIterator[SSEEvent]:
        """Stream a single agent's response token-by-token.

        Yields SSEEvent objects: agent_start, token*, agent_done.
        """
        agent_id = str(agent["id"])
        agent_name = agent.get("name", "Agent")

        # Mock mode: yield mock text as a single token + done
        if settings.forge_mock_mode:
            yield SSEEvent(
                event="agent_start",
                data={
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "index": agent_index,
                    "total": agent_total,
                },
            )
            mock_text, saved = await self._mock_response(conversation_id, agent)
            yield SSEEvent(
                event="token",
                data={
                    "agent_id": agent_id,
                    "content": mock_text,
                },
            )
            yield SSEEvent(
                event="agent_done",
                data={
                    "agent_id": agent_id,
                    "message": saved,
                },
            )
            return

        messages = await self._build_generation_context(
            agent=agent,
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            history_messages=history_messages,
            extra_variables=extra_variables,
            extra_context=extra_context,
            closing_instruction=closing_instruction,
        )

        yield SSEEvent(
            event="agent_start",
            data={
                "agent_id": agent_id,
                "agent_name": agent_name,
                "index": agent_index,
                "total": agent_total,
            },
        )

        # The same budget context the non-streaming path builds. Passing none
        # made `_pre_check_budget` return immediately, so every streamed chat
        # reply — the interactive path, the one used repeatedly — spent outside
        # the global, per-purpose and per-simulation budgets.
        #
        # The pre-check runs on the first iteration of `stream_completion`, so a
        # hard block surfaces there. It is caught below rather than left to the
        # router's blanket `except Exception`, which would report a deliberate,
        # audited admin decision as "An internal error occurred".
        budget = await self._chat_budget()

        # Stream tokens from OpenRouter — retry up to MAX_STREAM_RETRIES times
        # on empty responses (CoT-only, sanitization-stripped, or zero tokens).
        max_retries = 3
        full_text = ""
        generation_ms = 0

        for attempt in range(1, max_retries + 1):
            t0 = time.monotonic()
            full_text = ""
            stream_error = False

            try:
                async for chunk in self._openrouter.stream_completion(
                    model=model.model_id,
                    messages=messages,
                    temperature=_CHAT_TEMPERATURE,
                    max_tokens=_chat_max_tokens(),
                    top_p=_CHAT_TOP_P,
                    frequency_penalty=_CHAT_FREQUENCY_PENALTY,
                    reasoning=get_platform_reasoning("chat_response"),
                    budget=budget,
                ):
                    if chunk.error:
                        stream_error = True
                        logger.warning(
                            "Stream error on attempt %d/%d for %s: %s",
                            attempt,
                            max_retries,
                            agent_name,
                            chunk.error,
                        )
                        break

                    if chunk.content:
                        full_text += chunk.content
                        yield SSEEvent(
                            event="token",
                            data={
                                "agent_id": agent_id,
                                "content": chunk.content,
                            },
                        )
            except BudgetExceededError as exc:
                # A deliberate, audited admin decision — not a failure to
                # retry and not an internal error. Reported as its own
                # error_type so the client can say so, and returned
                # immediately: retrying would only re-run the same refusal.
                logger.info(
                    "Chat stream blocked by budget for %s in conversation %s: %s",
                    agent_name,
                    conversation_id,
                    exc,
                )
                yield SSEEvent(
                    event="error",
                    data={
                        "agent_id": agent_id,
                        "error": f"{agent_name} stays silent – the AI budget for this world is exhausted.",
                        "error_type": "budget_exceeded",
                    },
                )
                return

            generation_ms = int((time.monotonic() - t0) * 1000)

            # Check if we got meaningful content after sanitization
            if not stream_error and self._sanitize_response(full_text, self._known_speakers(participant_names)):
                break  # Success — proceed to persist

            if attempt < max_retries:
                logger.warning(
                    "Attempt %d/%d produced empty/error response for %s – retrying",
                    attempt,
                    max_retries,
                    agent_name,
                )
                continue

            # All retries exhausted
            logger.error(
                "All %d attempts exhausted for %s in conversation %s",
                max_retries,
                agent_name,
                conversation_id,
            )
            yield SSEEvent(
                event="error",
                data={
                    "agent_id": agent_id,
                    "error": f"{agent_name} could not formulate a response after {max_retries} attempts.",
                    "error_type": "empty_response",
                    "retries_exhausted": max_retries,
                },
            )
            return

        # Persist completed response + log usage
        _, saved = await self._persist_ai_response(
            conversation_id=conversation_id,
            agent=agent,
            model=model,
            response_text=full_text,
            generation_ms=generation_ms,
            locale=locale,
            extra_metadata=extra_metadata,
            participant_names=participant_names,
        )

        if not saved:
            logger.error(
                "Persist returned empty for %s in conversation %s after successful stream",
                agent_name,
                conversation_id,
            )
            yield SSEEvent(
                event="error",
                data={
                    "agent_id": agent_id,
                    "error": f"{agent_name} could not formulate a response.",
                    "error_type": "sanitization_empty",
                },
            )
            return

        yield SSEEvent(
            event="agent_done",
            data={
                "agent_id": agent_id,
                "message": saved,
            },
        )

    # ── Shared persistence ─────────────────────────────────

    async def _mock_response(
        self,
        conversation_id: UUID,
        agent: dict,
    ) -> tuple[str, dict]:
        """Generate and persist a mock response (for forge_mock_mode)."""
        agent_name = agent.get("name", "Agent")
        mock_text = f"[MOCK] {agent_name} responds to the conversation."
        logger.info("MOCK_MODE: returning mock chat response for %s", agent_name)
        save_resp = (
            await self._supabase.table("chat_messages")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "content": mock_text,
                    "sender_role": "assistant",
                    "agent_id": str(agent["id"]),
                    "metadata": {"model": "mock", "source": "mock"},
                }
            )
            .execute()
        )
        saved = save_resp.data[0] if save_resp.data else {}
        return mock_text, saved

    @staticmethod
    def _known_speakers(participant_names: list[str] | None) -> list[str] | None:
        """Die Besetzung PLUS die Marke des Menschen.

        Schreibt ein Modell `[User]: …` an den Anfang seiner Antwort zurueck,
        ist das derselbe Fehler wie `[Marie Morgenrot]: …` — es hat die
        Protokollmarke fuer ein Textformat gehalten. Das Tor muss sie deshalb
        kennen.

        Ohne Besetzung bleibt es bei None: das Tor faellt dann auf sein enges
        Verhalten zurueck, statt gegen einen einzelnen Namen zu raten.
        """
        if not participant_names:
            return participant_names
        return [*participant_names, _USER_SPEAKER]

    @staticmethod
    def _strip_speaker_labels(text: str, participant_names: list[str] | None) -> str:
        """Entfernt `[Name]`, `[Name]:` und `Name:` am Anfang JEDER Zeile.

        Gegen die BEKANNTEN Namen und gegen nichts sonst. Der Grund steht im
        Bestand: von 57 Agentennachrichten des Fadens 7b2e37c3, die mit einer
        eckigen Klammer beginnen, sind **41 echte Regieanweisungen**
        (``[Der Raum ist still, als sich die Tuer einen Spalt oeffnet…]``) und
        nur **16 Namensmarken**. Ein Muster, das die Klammer allein sieht,
        loescht also viermal so viel Text, wie es reparieren soll.

        Zwei Aufrufer, und der zweite ist der Grund fuer diese Methode:

        1. ``_sanitize_response`` — beim SCHREIBEN, damit keine neue Marke
           mehr in den Bestand geraet.
        2. ``_as_turn`` — beim LESEN, denn die 16 stehen laengst da. Sie tragen
           die Marke eines FREMDEN Namens unter der eigenen ``agent_id``
           (``[Suse Sonnenblum] …`` gespeichert als Marie). Ohne diesen Schnitt
           bekaeme das Modell sie weiter als Vorbild zu sehen — und fuer einen
           fremden Zug haengte ``_as_turn`` eine zweite Marke davor:
           ``[Marie Morgenrot]: [Suse Sonnenblum] …``. Eine Reparatur, die den alten
           Fehler im Verlauf stehen laesst, repariert nur die Zukunft, und der
           Verlauf ist genau das, woraus ein Modell lernt.

        Der BESTAND bleibt unangetastet. Was ein Mensch gelesen hat, bleibt
        stehen; nur was das Modell zu sehen bekommt, ist bereinigt.
        """
        known = [n.strip() for n in (participant_names or []) if n and n.strip()]
        if not known:
            return text
        alternation = "|".join(re.escape(n) for n in known)
        return re.sub(
            rf"^[ \t]*(?:\[(?:{alternation})\]\s*:?|(?:{alternation})\s*:)[ \t]*",
            "",
            text,
            flags=re.MULTILINE,
        )

    @staticmethod
    def _sanitize_response(text: str, participant_names: list[str] | None = None) -> str:
        """Strip leaked agent tags, CoT blocks, and meta-commentary from AI output.

        Locale-agnostic: patterns match structural markers (brackets, parens,
        XML tags) rather than language-specific keywords.

        ``participant_names`` sind die bekannten Sprecher des Fadens. Mit ihnen
        wird das Tor genauer UND weiter zugleich, und beides ist noetig:

        * **Weiter**, weil das alte Muster einen Doppelpunkt verlangte
          (``^\\[…\\]:``), das Modell aber ``[Benno Blattgold] *Ich hebe die Hand*``
          **ohne** ihn schreibt. Von 16 Nachrichten mit Marke im Faden
          7b2e37c3 fing das alte Tor **null**. Und es sah nur Zeichen 0 —
          eine Marke in Zeile drei blieb stehen.
        * **Genauer**, weil ein weites Muster ohne Doppelpunkt ueber jede
          Regieanweisung in eckigen Klammern herfiele. Gegen die bekannten
          Namen kann es das nicht.

        Ohne Namensliste bleibt es beim alten, engen Verhalten: fuehrende
        Marke, Doppelpunkt verlangt. Ein Tor, das raet, ist schlimmer als
        eines, das zugibt, nichts zu wissen.
        """
        # Strip <think>...</think> blocks (CoT reasoning leak)
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        text = ChatAIService._strip_speaker_labels(text, participant_names)
        # Strip [AgentName]: prefixes at start of response
        text = re.sub(r"^\[[\w\s.äöüÄÖÜß]+\]:\s*", "", text)
        # Strip parenthetical meta-reasoning blocks at start of response.
        # Requires 40+ chars inside parens to avoid false positives on short
        # legitimate parentheticals like "(Note: see above)". Meta-reasoning
        # leaks are always verbose multi-clause blocks.
        text = re.sub(
            r"^\([A-ZÀ-ÖØ-Þ][\w\s,;:'\-]{40,}?\.{0,3}\)\s*",
            "",
            text,
            flags=re.DOTALL,
        )
        return text.strip()

    async def _persist_ai_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        model: ResolvedModel,
        response_text: str,
        generation_ms: int,
        locale: str = "de",
        extra_metadata: dict[str, Any] | None = None,
        participant_names: list[str] | None = None,
    ) -> tuple[str, dict]:
        """Save AI response to DB + log usage. Shared by streaming and non-streaming."""
        response_text = self._sanitize_response(response_text, self._known_speakers(participant_names))
        if not response_text:
            logger.warning(
                "Empty response after sanitization for agent %s in conversation %s – skipping persist",
                agent.get("name", agent["id"]),
                conversation_id,
            )
            return "", {}
        usage = self._openrouter.last_usage or {}
        token_count = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

        await AIUsageService.log(
            self._supabase,
            simulation_id=self._simulation_id,
            provider="openrouter",
            model=model.model_id,
            purpose="chat",
            usage=usage,
        )

        metadata: dict[str, Any] = {
            "model": model.model_id,
            "source": model.source,
            "model_used": model.model_id,
            "token_count": token_count,
            "generation_ms": generation_ms,
            "locale": locale,
        }
        if extra_metadata:
            metadata.update(extra_metadata)

        # Die Fokalisierung wird BEIM SPEICHERN gemessen, nicht spaeter.
        #
        # Hier stehen die Teilnehmernamen ohnehin schon da (das Sanitize-Tor
        # braucht sie), es kostet kein Netz und keine Sekunde. Eine spaetere
        # Messung muesste die Besetzung noch einmal laden — und eine, die im
        # Herzschlag nachlaeuft, misst nie den Zug, den gerade jemand liest.
        #
        # Der Befund AENDERT NICHTS: er blockiert die Antwort nicht und
        # schreibt sie nicht um. Ein Tor, das in den Anfragepfad eingreift,
        # waere beim ersten Fehlurteil ein Ausfall; eines, das misst, ist
        # beim ersten Fehlurteil eine falsche Zahl.
        fokus = FocalizationService.measure(
            response_text,
            speaker=str(agent.get("name") or ""),
            others=[n for n in (participant_names or []) if n != agent.get("name")],
        )

        save_resp = (
            await self._supabase.table("chat_messages")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "content": response_text,
                    "sender_role": "assistant",
                    "agent_id": str(agent["id"]),
                    "metadata": metadata,
                }
            )
            .execute()
        )

        saved = save_resp.data[0] if save_resp.data else {}
        if saved.get("id"):
            # Erst jetzt gibt es eine Nachricht, an die der Befund haengen
            # kann. Fehler hier kosten NICHTS: die Nachricht steht, und ein
            # fehlender Messwert ist eine Luecke in einer Statistik, kein
            # Ausfall im Gespraech.
            await FocalizationService.record(self._supabase, UUID(str(saved["id"])), fokus)
        return response_text, saved

    # ── Shared setup helpers ─────────────────────────────────

    @staticmethod
    def _build_history_messages(
        history: list[dict],
        user_message: str,
    ) -> list[dict[str, str]]:
        """Convert raw chat_messages rows to OpenRouter message format."""
        messages: list[dict[str, str]] = []
        for msg in history:
            role = "assistant" if msg["sender_role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})
        return messages

    async def _prepare_single_context(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> dict[str, Any]:
        """Shared setup for single-agent generate/stream. Returns all context needed."""
        conversation = await self._load_conversation(conversation_id)
        agent_id = conversation.get("agent_id")
        if not agent_id:
            msg = f"Conversation {conversation_id} has no agent_id – use group methods for multi-agent conversations"
            raise ValueError(msg)
        # Drei Wellen, nach ABHAENGIGKEIT geschnitten — wie im Gruppenzug.
        # Neun Abrufe nacheinander waren eine Viertelsekunde reines Warten,
        # bevor der erste Buchstabe ans Modell ging.
        agent, simulation, locale, model = await asyncio.gather(
            self._load_agent(agent_id),
            self._load_simulation(),
            self._get_locale(),
            self._model_resolver.resolve_text_model("chat_response"),
        )

        # Welle 2 braucht den Agenten (Erinnerungen, Beziehungen), die Sprache
        # (Vorlage, Verdichtung) oder das Modell (Verlaufskappung).
        #
        # `_build_relationship_context` fuehrt auf die Stapelfassung zurueck;
        # hier ist der Stapel einelementig, und das ist richtig so — ein
        # eigener Weg fuer den Einzelfall waere ein zweiter Ort, an dem
        # dieselbe Abfrage steht.
        (
            memories,
            relationship_context,
            digest_text,
            prompt_template,
            history,
        ) = await asyncio.gather(
            AgentMemoryService.retrieve(
                self._supabase,
                UUID(agent["id"]),
                self._simulation_id,
                query_text=user_message,
                top_k=8,
            ),
            self._build_relationship_context(agent["id"], locale),
            # Reiner Lesevorgang — kein Modellaufruf im Anfragepfad; erzeugt
            # wird die Verdichtung im Hintergrund.
            self._digests.load_digest_text(conversation_id, locale),
            self._prompt_resolver.resolve("chat_system_prompt", locale),
            self._load_history(conversation_id, model.model_id),
        )
        memory_text = AgentMemoryService.format_for_prompt(memories)
        history_messages = self._build_history_messages(history, user_message)

        return {
            "agent": agent,
            "simulation": simulation,
            "locale": locale,
            "prompt_template": prompt_template,
            "model": model,
            "history_messages": history_messages,
            "memory_text": memory_text,
            "relationship_context": relationship_context,
            "digest_text": digest_text,
        }

    async def _build_relationship_context(self, agent_id: str, locale: str) -> str:
        """Der Beziehungskontext EINES Agenten.

        Fuehrt auf :meth:`_build_relationship_contexts` zurueck. Zwei
        Fassungen derselben Abfrage waeren zwei Gelegenheiten, sie
        unterschiedlich zu aendern — und die eine, die niemand anfasst, faengt
        an zu luegen.
        """
        return (await self._build_relationship_contexts([agent_id], locale)).get(agent_id, "")

    async def _build_relationship_contexts(self, agent_ids: list[str], locale: str) -> dict[str, str]:
        """Der Beziehungskontext MEHRERER Agenten, in EINER Abfrage.

        Er unterscheidet sich je Sprecher; die Abfrage muss es nicht. Bis zum
        04.09.2026 lief sie einmal je Agent — dieselbe Tabelle, derselbe
        Filter auf `simulation_id`, nur eine andere `agent_id`. Gemessen an
        einem Gruppenzug mit drei Agenten: drei Rundreisen von vierzehn.

        ⚠ Die Kappung auf sechs Beziehungen sitzt jetzt HIER und nicht mehr
        im `LIMIT`. Ein `LIMIT 6` ueber die Vereinigung aller Agenten gaebe
        einem Agenten sechs und den anderen keine — die Grenze gilt je
        Sprecher, also muss sie da gezogen werden, wo nach Sprechern sortiert
        wird. Die Zeilen kommen absteigend nach `intensity`, die ersten sechs
        je Agent sind deshalb seine staerksten.
        """
        if not agent_ids:
            return {}
        ids = ",".join(agent_ids)
        try:
            resp = await (
                self._supabase.table("agent_relationships")
                .select(
                    "source_agent_id, target_agent_id,"
                    " relationship_type, intensity, is_bidirectional, description,"
                    " source_agent:agents!source_agent_id(name),"
                    " target_agent:agents!target_agent_id(name)"
                )
                .or_(f"source_agent_id.in.({ids}),target_agent_id.in.({ids})")
                .eq("simulation_id", str(self._simulation_id))
                .order("intensity", desc=True)
                .execute()
            )
        except Exception:
            logger.debug("Relationship context query failed for %s", agent_ids, exc_info=True)
            return {}

        gesucht = set(agent_ids)
        je_agent: dict[str, list[dict]] = {a: [] for a in agent_ids}
        for rel in extract_list(resp):
            for spalte in ("source_agent_id", "target_agent_id"):
                wer = str(rel.get(spalte) or "")
                if wer in gesucht and len(je_agent[wer]) < 6:
                    je_agent[wer].append(rel)
        return {agent_id: self._format_relationships(zeilen, locale) for agent_id, zeilen in je_agent.items() if zeilen}

    @staticmethod
    def _format_relationships(zeilen: list[dict], locale: str) -> str:
        """Die Zeilen als Text fuer den System-Prompt."""
        lines = []
        for rel in zeilen:
            source_name = (rel.get("source_agent") or {}).get("name", "?")
            target_name = (rel.get("target_agent") or {}).get("name", "?")
            # Show the "other" agent from this agent's perspective
            other = target_name if source_name != target_name else source_name
            rel_type = rel.get("relationship_type", "associated with").replace("_", " ")
            intensity = rel.get("intensity", 5)
            desc = rel.get("description", "")
            direction = " (mutual)" if rel.get("is_bidirectional") else ""
            line = f"- {rel_type} of {other} (intensity {intensity}/10{direction})"
            if desc:
                line += f": {desc}"
            lines.append(line)

        if not lines:
            return ""

        header = "Relationships:" if locale == "en" else "Beziehungen:"
        return f"{header}\n" + "\n".join(lines)

    def _fire_and_forget_digest(
        self,
        conversation_id: UUID,
        participant_names: list[str],
        locale: str,
    ) -> None:
        """Fehlende Abschnitte im Hintergrund verdichten.

        NICHT im Anfragepfad. Ein Verdichtungsaufruf sieht 40 Nachrichten und
        dauert Sekunden; im Zug eines Chats waere er eine Wartezeit, die der
        Mensch fuer die Antwort haelt.

        Derselbe Weg wie :meth:`_fire_and_forget_memory_extraction`, und aus
        demselben Grund mit EIGENEM Client: die Aufgabe laeuft bis 120 s nach
        der Antwort weiter, und `self._supabase` ist anfragegebunden und beim
        Abbau der Anfrage geschlossen (Deep-Audit P1-1). Ein Dienst, der den
        geschlossenen Client benutzte, scheiterte still — und still ist genau
        das, was eine Hintergrundaufgabe ohnehin schon ist.

        Der Zaehler `_DIGEST_TASKS` haelt eine starke Referenz: asyncio haelt
        auf laufende Aufgaben nur schwache, und eine eingesammelte Aufgabe
        stuerbe mitten im Modellaufruf.
        """
        simulation_id = self._simulation_id

        async def _safe_digest() -> None:
            try:
                admin = await get_admin_supabase()
                service = ConversationDigestService(admin, simulation_id)
                erzeugt = await asyncio.wait_for(
                    service.ensure_digests(
                        conversation_id,
                        participant_names=participant_names,
                        locale=locale,
                    ),
                    timeout=120.0,
                )
                if erzeugt:
                    logger.info("%d Abschnitt(e) von %s verdichtet", erzeugt, conversation_id)
            except TimeoutError:
                logger.warning("Verdichtung von %s im Zeitlimit haengen geblieben", conversation_id)
            except Exception:
                logger.exception("Verdichtung von %s fehlgeschlagen", conversation_id)

        task = asyncio.create_task(_safe_digest())
        _DIGEST_TASKS.add(task)
        task.add_done_callback(_DIGEST_TASKS.discard)

    def _fire_and_forget_memory_extraction(
        self,
        agent_id: str,
        user_message: str,
        response_text: str,
    ) -> None:
        """Background memory extraction — catches all exceptions with timeout.

        Deliberately passes no client into the task: extraction can run up to
        30 s after the response is sent, and the request-scoped client held by
        this service is closed at request teardown (deep-audit P1-1).
        """
        if not response_text:
            return

        async def _safe_extract() -> None:
            try:
                await asyncio.wait_for(
                    AgentMemoryService.extract_from_chat(
                        self._simulation_id,
                        UUID(agent_id),
                        user_message,
                        response_text,
                    ),
                    timeout=30.0,
                )
            except TimeoutError:
                logger.warning("Memory extraction timeout for agent %s", agent_id)
            except Exception:
                logger.exception("Memory extraction failed for agent %s", agent_id)

        task = asyncio.create_task(_safe_extract())
        _MEMORY_EXTRACT_TASKS.add(task)
        task.add_done_callback(_MEMORY_EXTRACT_TASKS.discard)

    # ── Public generation methods ───────────────────────────

    async def generate_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> str:
        """Generate an AI response for a single-agent conversation."""
        ctx = await self._prepare_single_context(conversation_id, user_message)

        response_text, saved = await self._generate_single_response(
            conversation_id=conversation_id,
            agent=ctx["agent"],
            simulation=ctx["simulation"],
            locale=ctx["locale"],
            prompt_template=ctx["prompt_template"],
            model=ctx["model"],
            history_messages=ctx["history_messages"],
            extra_variables={"agent_memories": ctx["memory_text"]},
            extra_context=self._join_context(ctx.get("relationship_context", ""), ctx.get("digest_text", "")),
            participant_names=[ctx["agent"].get("name", "")],
        )

        if not saved:
            logger.warning(
                "Non-streaming generate_response produced empty response for agent %s",
                ctx["agent"].get("name", ctx["agent"]["id"]),
            )
            return ""

        self._fire_and_forget_memory_extraction(
            ctx["agent"]["id"],
            user_message,
            response_text,
        )
        self._fire_and_forget_digest(conversation_id, [ctx["agent"].get("name", "")], ctx["locale"])
        return response_text

    async def _prepare_group_turn(self, conversation_id: UUID) -> _GroupTurnSetup:
        """Der gemeinsame Vorlauf beider Gruppenfassungen — sechs Netzwerkaufrufe.

        Stand bis dahin ZEICHENGLEICH in ``generate_group_response`` und
        ``stream_group_response``. Er steht jetzt einmal da, damit eine neue
        Kontextquelle nicht in der einen Fassung ankommen und in der anderen
        fehlen kann.
        """
        # ── Drei Wellen statt zwoelf Wartezeiten ──────────────────────────
        #
        # Was voneinander nichts weiss, muss auch nicht aufeinander warten.
        # Zwoelf Abrufe nacheinander sind bei 20-50 ms je Rundreise eine
        # Viertel- bis halbe Sekunde reines Warten, BEVOR der erste Buchstabe
        # ans Modell geht — und der Mensch sieht davon nur, dass es dauert.
        #
        # Die Wellen sind nach ABHAENGIGKEIT geschnitten, nicht nach Gefuehl:
        #   1  haengt an nichts
        #   2  braucht Sprache (Vorlage, Verdichtung, Beziehungen, Stimmung),
        #      Modell (Verlauf) oder Besetzung und Ereignisse (Reaktionen)
        #   3  braucht die Reaktionen aus Welle 2
        #
        # `_get_locale` puffert je Dienst; es steht trotzdem in Welle 1, damit
        # der erste Aufruf nicht die zweite Welle aufhaelt.
        agents, event_refs, simulation, locale, model = await asyncio.gather(
            self._load_conversation_agents(conversation_id),
            self._load_event_references(conversation_id),
            self._load_simulation(),
            self._get_locale(),
            self._model_resolver.resolve_text_model("chat_response"),
        )

        event_ids = [ref.get("event_id") for ref in event_refs if ref.get("event_id")]
        agent_ids = [str(a["id"]) for a in agents]

        # Die verdichtete Vorgeschichte gilt fuer alle Sprecher gleich — sie
        # ist die Erinnerung an DIESEN Faden, nicht an eine Person. Einmal
        # geladen, nicht je Agent. Dasselbe fuer den Verlauf, die Beziehungen
        # und die Stimmung.
        prompt_template, reactions, digest_text, history, relationships, _ = await asyncio.gather(
            self._prompt_resolver.resolve("chat_system_prompt", locale),
            self._load_event_reactions(event_ids, agent_ids),
            self._digests.load_digest_text(conversation_id, locale),
            self._load_history(conversation_id, model.model_id),
            self._build_relationship_contexts(agent_ids, locale),
            self._prime_mood_contexts(agent_ids, locale),
        )

        event_context = await self._build_event_context(event_refs, reactions, locale)

        return _GroupTurnSetup(
            agents=agents,
            agent_names=[a.get("name", "Agent") for a in agents],
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            model=model,
            event_context=event_context,
            digest_text=digest_text,
            history=history,
            relationships=relationships,
        )

    async def generate_group_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> list[dict]:
        """Generate AI responses for all agents in a group conversation.

        Each agent responds sequentially, seeing previous agents' responses.
        Returns list of saved message dicts.
        """
        setup = await self._prepare_group_turn(conversation_id)
        agents, agent_names = setup.agents, setup.agent_names
        simulation, locale = setup.simulation, setup.locale
        prompt_template, model = setup.prompt_template, setup.model
        event_context = setup.event_context
        saved_messages: list[dict] = []

        for idx, agent in enumerate(agents):
            extra_parts, history_messages, closing_instruction = await self._build_group_turn_context(
                conversation_id=conversation_id,
                agents=agents,
                agent_names=agent_names,
                idx=idx,
                event_context=event_context,
                locale=locale,
                user_message=user_message,
                saved_messages=saved_messages,
                model_id=model.model_id,
                digest_text=setup.digest_text,
                history=setup.history,
                relationship_context=setup.relationships.get(str(agent["id"]), ""),
            )

            _, saved = await self._generate_single_response(
                conversation_id=conversation_id,
                agent=agent,
                simulation=simulation,
                locale=locale,
                prompt_template=prompt_template,
                model=model,
                history_messages=history_messages,
                extra_context="\n\n".join(extra_parts),
                closing_instruction=closing_instruction,
                extra_metadata={"group_turn_index": idx},
                participant_names=agent_names,
            )

            if saved:
                saved_messages.append(saved)

        self._fire_and_forget_digest(conversation_id, agent_names, locale)
        return saved_messages

    # ── Public streaming methods ───────────────────────────

    async def stream_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        """Stream an AI response for a single-agent conversation."""
        ctx = await self._prepare_single_context(conversation_id, user_message)

        response_text = ""
        async for sse_event in self.stream_single_response(
            conversation_id=conversation_id,
            agent=ctx["agent"],
            simulation=ctx["simulation"],
            locale=ctx["locale"],
            prompt_template=ctx["prompt_template"],
            model=ctx["model"],
            history_messages=ctx["history_messages"],
            extra_variables={"agent_memories": ctx["memory_text"]},
            extra_context=self._join_context(ctx.get("relationship_context", ""), ctx.get("digest_text", "")),
            participant_names=[ctx["agent"].get("name", "")],
        ):
            yield sse_event
            if sse_event.event == "agent_done":
                response_text = sse_event.data.get("message", {}).get("content", "")

        self._fire_and_forget_memory_extraction(
            ctx["agent"]["id"],
            user_message,
            response_text,
        )
        self._fire_and_forget_digest(conversation_id, [ctx["agent"].get("name", "")], ctx["locale"])

    async def stream_group_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        """Stream AI responses for all agents in a group conversation.

        Each agent responds sequentially — the next agent sees the previous
        agent's completed response in history. Yields interleaved SSEEvents.
        """
        setup = await self._prepare_group_turn(conversation_id)
        agents, agent_names = setup.agents, setup.agent_names
        simulation, locale = setup.simulation, setup.locale
        prompt_template, model = setup.prompt_template, setup.model
        event_context = setup.event_context
        saved_messages: list[dict] = []

        for idx, agent in enumerate(agents):
            extra_parts, history_messages, closing_instruction = await self._build_group_turn_context(
                conversation_id=conversation_id,
                agents=agents,
                agent_names=agent_names,
                idx=idx,
                event_context=event_context,
                locale=locale,
                user_message=user_message,
                saved_messages=saved_messages,
                model_id=model.model_id,
                digest_text=setup.digest_text,
                history=setup.history,
                relationship_context=setup.relationships.get(str(agent["id"]), ""),
            )

            async for sse_event in self.stream_single_response(
                conversation_id=conversation_id,
                agent=agent,
                simulation=simulation,
                locale=locale,
                prompt_template=prompt_template,
                model=model,
                history_messages=history_messages,
                agent_index=idx,
                agent_total=len(agents),
                extra_context="\n\n".join(extra_parts),
                closing_instruction=closing_instruction,
                extra_metadata={"group_turn_index": idx},
                participant_names=agent_names,
            ):
                yield sse_event
                if sse_event.event == "agent_done":
                    msg_data = sse_event.data.get("message", {})
                    if msg_data:
                        saved_messages.append(msg_data)

        self._fire_and_forget_digest(conversation_id, agent_names, locale)

    @staticmethod
    def _join_context(*parts: str) -> str:
        """Kontextbloecke zu einem System-Prompt-Anhang, leere weggelassen.

        Die REIHENFOLGE der Argumente ist die Reihenfolge im Prompt, und die
        ist eine Entscheidung: was zuletzt steht, wiegt am schwersten (siehe
        Handoff `last-thing-wins-in-a-prompt` — der Stilprompt schlug dort
        Vorlage, Beschreibung und Rahmen allein durch seine Position).

        Deshalb vom Allgemeinen zum Naechsten: Beziehungen, dann die
        verdichtete Vorgeschichte dieses Fadens, dann die Gruppenanweisung.
        Der woertliche Verlauf steht ohnehin danach, als eigene Zuege.
        """
        return "\n\n".join(p.strip() for p in parts if p and p.strip())

    # ── Group chat context helper ──────────────────────────

    async def _build_group_turn_context(
        self,
        *,
        conversation_id: UUID,
        agents: list[dict],
        agent_names: list[str],
        idx: int,
        event_context: str,
        locale: str,
        user_message: str,
        saved_messages: list[dict],
        model_id: str = "",
        digest_text: str = "",
        history: list[dict] | None = None,
        relationship_context: str = "",
    ) -> tuple[list[str], list[dict[str, str]], str]:
        """Build extra_parts and history_messages for a single agent's turn
        in a group conversation. Shared by streaming and non-streaming paths.
        """
        extra_parts: list[str] = []
        if event_context:
            extra_parts.append(event_context)

        # ⚠ DAS HIER FEHLTE. Bis zum 04.09.2026 bekam ein Agent im
        # GRUPPENGESPRAECH weder seine Erinnerungen noch seine Beziehungen —
        # beides ging nur in den Einzelchat (`_prepare_single_context`). Wer
        # mit Marie allein sprach, redete mit einer Figur, die sich an ihn
        # erinnerte; wer sie zu zweit ansprach, mit einer, die bei null anfing.
        # Kein Fehler, keine Meldung, nur eine Person, die in Gesellschaft
        # blasser ist als unter vier Augen.
        #
        # Das ist der groessere Teil des „erlernter Charakter geht verloren",
        # und er kostet nichts: `retrieve` ist eine RPC mit Vektorabstand,
        # `_build_relationship_context` eine Abfrage.
        agent = agents[idx] if idx < len(agents) else {}
        if agent.get("id"):
            memories = await AgentMemoryService.retrieve(
                self._supabase,
                UUID(str(agent["id"])),
                self._simulation_id,
                query_text=user_message,
                top_k=8,
            )
            memory_text = AgentMemoryService.format_for_prompt(memories)
            if memory_text:
                extra_parts.append(memory_text)
            if relationship_context:
                extra_parts.append(relationship_context)

        if digest_text:
            extra_parts.append(digest_text)

        # ⚠ Die Gruppen-Anweisung geht NICHT in `extra_parts`. Sie stand dort
        # bis zum 04.09.2026 und landete damit im System-Prompt, also an
        # Position 0 vor dem ganzen Verlauf — bei 373 Nachrichten mit
        # zweihundert Zuegen dazwischen. Sie wird jetzt als
        # `closing_instruction` unmittelbar vor die Antwort gesetzt.
        #
        # `extra_parts` traegt weiterhin INHALT (Ereignisse, Erinnerungen,
        # Beziehungen, Vorgeschichte). Der gehoert nach vorn: er ist das, was
        # die Figur weiss, nicht das, was sie tun soll.
        closing_instruction = ""
        if len(agents) > 1:
            group_instr = await self._prompt_resolver.resolve("chat_group_instruction", locale)
            other_names = [n for i, n in enumerate(agent_names) if i != idx]
            closing_instruction = self._prompt_resolver.fill_template(
                group_instr,
                {
                    "other_agent_names": ", ".join(other_names),
                },
            )

        current_agent_id = str(agents[idx]["id"]) if idx < len(agents) else ""

        # KEIN eigener Abruf mehr. Der Verlauf kommt aus dem Vorlauf
        # (`_GroupTurnSetup.history`) und ist fuer alle Sprecher derselbe.
        # Der Rueckfall auf einen eigenen Abruf bleibt fuer Aufrufer, die
        # keinen mitgeben — er ist der alte Weg, nicht der gewoehnliche.
        if history is None:
            history = await self._load_history(conversation_id, model_id)
        history_messages: list[dict[str, str]] = [
            self._as_turn(msg, agents=agents, current_agent_id=current_agent_id) for msg in history
        ]
        # Auch die FRISCHE Nutzernachricht traegt die Marke. Ohne sie stuende
        # ausgerechnet der Satz, auf den geantwortet werden soll, als
        # einziger ohne Besitzer da.
        history_messages.append(
            {
                "role": "user",
                "content": (f"[{_USER_SPEAKER}]: {user_message}" if len(agents) > 1 else user_message),
            }
        )

        # Die frischen Zuege dieses Durchgangs. GENAU HIER brach Position 1:
        # der eben fertig gewordene Zug des Agenten davor ging als
        # `role="assistant"` hinaus, also als Zusicherung „das hast du gerade
        # gesagt" — und der zweite Sprecher schrieb daraufhin weiter am Satz
        # des ersten. Sie laufen jetzt durch dieselbe Regel wie der Verlauf.
        for prev_msg in saved_messages:
            history_messages.append(self._as_turn(prev_msg, agents=agents, current_agent_id=current_agent_id))

        return (
            extra_parts,
            self._merge_consecutive_user_turns(history_messages),
            closing_instruction,
        )

    def _as_turn(
        self,
        msg: dict,
        *,
        agents: list[dict],
        current_agent_id: str,
    ) -> dict[str, str]:
        """Eine gespeicherte Nachricht als Protokollzug fuer EINEN Agenten.

        ``role: "assistant"`` ist im Chat-Protokoll keine Beschriftung, sondern
        eine Zusicherung: „das hier hast du gesagt". Ein fremder Agentenzug,
        der so hineingeht, wird vom Modell als eigene fruehere Aeusserung
        gelesen; die Textmarke ``[Name]: `` ist blosser Inhalt und verliert
        gegen die Rolle. Ausgezaehlt am Faden 7b2e37c3 (04.09.2026, 79
        Agentennachrichten): alle neun Bruchstuecke lagen auf Zugposition 1,
        keines auf Position 0, keines in den zehn Einzelgespraechen davor.
        Position 1 ist die erste, die einen FRISCHEN fremden Zug bekommt.

        Daraus die beiden Haelften der Regel:

        * **Eigene** Zuege bleiben ``assistant`` und tragen **keine** Marke.
          Trugen sie eine, saehe sich das Modell beim Namen in der dritten
          Person — das war die zweite Haelfte des Fehlers, das Kippen zwischen
          Ich- und Er-Form.
        * **Fremde** Zuege werden ``user`` und tragen die Marke. Findet sich
          kein Name (ein entfernter Teilnehmer, dessen Saetze stehen bleiben),
          steht ``_DEPARTED_SPEAKER`` da: eine unbekannte Herkunft zuzugeben
          ist der billigere Fehler als eine falsche zu behaupten.
        """
        content = str(msg.get("content") or "")
        if msg.get("sender_role") != "assistant":
            # Der Mensch bekommt im GRUPPENVERLAUF dieselbe Marke wie alle
            # anderen. Ohne sie steht seine Zeile ohne Besitzer in einem Block
            # voller beschrifteter Zeilen — siehe `_USER_SPEAKER`.
            #
            # Im Einzelchat NICHT: dort gibt es nur zwei Stimmen, die Rolle
            # sagt schon alles, und eine Marke waere Laerm.
            if len(agents) > 1:
                return {"role": "user", "content": f"[{_USER_SPEAKER}]: {content}"}
            return {"role": "user", "content": content}

        # Die 16 Zeilen, die schon dastehen. Gemessen am 04.09.2026 im Faden
        # 7b2e37c3: 16 Agentennachrichten tragen eine fremde Namensmarke unter
        # der eigenen `agent_id` — `[Suse Sonnenblum] …`, gespeichert als Marie. Sie
        # sind das Ergebnis des Fehlers und zugleich sein Lehrbuch: ein Modell
        # lernt das Format aus dem Verlauf. Ohne diesen Schnitt bekaeme ein
        # fremder Zug ausserdem zwei Marken uebereinander.
        content = self._strip_speaker_labels(content, [str(a.get("name") or "") for a in agents])

        agent_id = msg.get("agent_id")
        if agent_id and str(agent_id) == current_agent_id:
            return {"role": "assistant", "content": content}

        # Erst die Nachricht selbst fragen (siehe `_load_history`), dann die
        # Besetzung — der Name gehoert an die Nachricht, nicht an die
        # Anwesenheitsliste.
        label = (
            self._message_speaker(msg)
            or self._find_agent_name(agents, str(agent_id) if agent_id else None)
            or _DEPARTED_SPEAKER
        )
        return {"role": "user", "content": f"[{label}]: {content}"}

    @staticmethod
    def _merge_consecutive_user_turns(messages: list[dict[str, str]]) -> list[dict[str, str]]:
        """Fasst aufeinanderfolgende ``user``-Zuege zu einem zusammen.

        Kein Schoenheitsgriff. Seit fremde Agentenzuege als ``user`` laufen,
        stehen sie regelmaessig zu mehreren nebeneinander — und mehrere
        Anthropic- und Mistral-Modelle lehnen zwei gleiche Rollen in Folge mit
        einem 400er ab. DeepSeek nimmt sie an, weshalb der Fehler erst beim
        naechsten Modellwechsel aufschlagen wuerde, also genau dann, wenn
        niemand mehr an diese Stelle denkt.
        """
        merged: list[dict[str, str]] = []
        for msg in messages:
            if merged and msg["role"] == "user" and merged[-1]["role"] == "user":
                merged[-1] = {
                    "role": "user",
                    "content": f"{merged[-1]['content']}\n\n{msg['content']}",
                }
            else:
                merged.append(dict(msg))
        return merged

    @staticmethod
    def _build_agent_variables(agent: dict, simulation: dict, locale: str) -> dict[str, str]:
        """Build the full set of agent template variables."""
        return {
            "agent_name": agent.get("name", "Agent"),
            "agent_character": get_localized_field(agent, "character", locale),
            "agent_background": get_localized_field(agent, "background", locale),
            "agent_system": agent.get("system", ""),
            "agent_gender": agent.get("gender", ""),
            "agent_profession": get_localized_field(agent, "primary_profession", locale),
            "simulation_name": simulation.get("name", ""),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }

    async def _build_mood_context(self, agent_id: UUID, locale: str = "en") -> str:
        """Die Stimmung EINES Agenten fuer den System-Prompt.

        Nimmt, was der Vorlauf schon geholt hat, wenn er es geholt hat —
        sonst fragt sie selbst. Fuehrt in beiden Faellen auf
        :meth:`_build_mood_contexts` zurueck: zwei Fassungen derselben
        Abfrage waeren zwei Gelegenheiten, sie unterschiedlich zu aendern.
        """
        gepuffert = self._mood_cache.get(str(agent_id))
        if gepuffert is not None:
            return gepuffert
        return (await self._build_mood_contexts([str(agent_id)], locale)).get(str(agent_id), "")

    async def _build_mood_contexts(self, agent_ids: list[str], locale: str) -> dict[str, str]:
        """Die Stimmung MEHRERER Agenten, in ZWEI Abfragen statt in 2N.

        Gemessen am 04.09.2026 an einem Gruppenzug mit drei Agenten: die
        Stimmung lief einmal je Sprecher, und mit vorhandenen Moodlets sind
        das zwei Abfragen je Agent — sechs von sechzehn Rundreisen fuer eine
        Auskunft, die aus zwei Tabellen kommt.

        ⚠ Die Kappung auf fuenf Moodlets sitzt hier und nicht im `LIMIT`. Ein
        `LIMIT 5` ueber alle Agenten gaebe einem Agenten fuenf und den anderen
        keine — dieselbe Falle wie bei den Beziehungen.
        """
        if not agent_ids:
            return {}

        moods = extract_list(
            await self._supabase.table("agent_mood")
            .select("agent_id, mood_score, dominant_emotion, stress_level")
            .in_("agent_id", agent_ids)
            .execute()
        )
        if not moods:
            return {}

        moodlets_resp = await (
            self._supabase.table("agent_moodlets")
            .select("agent_id, moodlet_type, emotion, strength")
            .in_("agent_id", agent_ids)
            .order("strength")
            .execute()
        )
        je_agent: dict[str, list[dict]] = {}
        for ml in extract_list(moodlets_resp):
            eintraege = je_agent.setdefault(str(ml.get("agent_id")), [])
            if len(eintraege) < 5:
                eintraege.append(ml)

        return {
            str(mood["agent_id"]): self._format_mood(mood, je_agent.get(str(mood["agent_id"]), []), locale)
            for mood in moods
        }

    async def _prime_mood_contexts(self, agent_ids: list[str], locale: str) -> None:
        """Den Puffer fuellen, damit der Prompt-Bau je Agent nicht mehr fragt.

        Derselbe Weg wie `_cached_locale`: der Dienst lebt genau eine Anfrage
        lang, ein Puffer kann darin nicht veralten.
        """
        self._mood_cache = await self._build_mood_contexts(agent_ids, locale)
        # Wer keine Stimmung hat, bekommt einen LEEREN Eintrag statt keinen.
        # Ohne ihn fiele `_build_mood_context` fuer genau diese Agenten auf
        # eine eigene Abfrage zurueck — und die Ersparnis waere fuer die
        # stillsten Faelle dahin.
        for agent_id in agent_ids:
            self._mood_cache.setdefault(agent_id, "")

    @staticmethod
    def _format_mood(mood: dict, moodlets: list[dict], locale: str) -> str:
        """Eine Stimmungszeile und ihre Einfluesse als Text."""
        score = mood["mood_score"]
        emotion = mood["dominant_emotion"]
        stress = mood["stress_level"]

        descs = MOOD_DESCRIPTORS.get(locale, MOOD_DESCRIPTORS["en"])
        if score > 50:
            mood_desc = descs["very_positive"]
        elif score > 20:
            mood_desc = descs["content"]
        elif score > -20:
            mood_desc = descs["neutral"]
        elif score > -50:
            mood_desc = descs["troubled"]
        else:
            mood_desc = descs["distressed"]

        stress_descs = STRESS_DESCRIPTORS.get(locale, STRESS_DESCRIPTORS["en"])
        if stress > 800:
            stress_desc = stress_descs["breakdown"]
        elif stress > 500:
            stress_desc = stress_descs["high"]
        elif stress > 200:
            stress_desc = stress_descs["moderate"]
        else:
            stress_desc = stress_descs["calm"]

        moodlet_lines = []
        for ml in moodlets:
            sign = "+" if ml["strength"] > 0 else ""
            ml_type = localize_label(ml["moodlet_type"], MOODLET_TYPE_LABELS, locale)
            ml_emotion = localize_label(ml["emotion"], EMOTION_LABELS, locale)
            moodlet_lines.append(f"  - {ml_type}: {ml_emotion} ({sign}{ml['strength']})")

        emotion_localized = localize_label(emotion, EMOTION_LABELS, locale)
        templates = MOOD_CONTEXT_TEMPLATES.get(locale, MOOD_CONTEXT_TEMPLATES["en"])
        context = templates["state"].format(
            mood_desc=mood_desc,
            score=score,
            emotion=emotion_localized,
            stress_desc=stress_desc,
            stress=stress,
        )
        if moodlet_lines:
            context += templates["influences"].format(moodlet_lines="\n".join(moodlet_lines))
        context += templates["instruction"]
        return context

    @staticmethod
    def _find_agent_name(agents: list[dict], agent_id: str | None) -> str | None:
        """Find agent name by ID in the CURRENT roster.

        Returns None for anyone who has since been removed from the
        conversation — use :meth:`_message_speaker` first, which reads the name
        off the message itself and therefore survives a departure.
        """
        if not agent_id:
            return None
        for a in agents:
            if str(a["id"]) == str(agent_id):
                return a.get("name")
        return None

    @staticmethod
    def _message_speaker(msg: dict) -> str | None:
        """The speaker's name as it was embedded with the message row.

        `_load_history` selects `agents(name)`. postgrest returns a to-one
        embed as an object, but a to-many join as a list — accept both rather
        than trusting one shape, because getting it wrong here fails silently
        into "no name", which is exactly the bug this method exists to close.
        """
        embedded = msg.get("agents")
        if isinstance(embedded, list):
            embedded = embedded[0] if embedded else None
        if isinstance(embedded, dict):
            name = embedded.get("name")
            return str(name) if name else None
        return None

    async def _build_event_context(
        self,
        event_refs: list[dict],
        reactions: list[dict],
        locale: str,
    ) -> str:
        """Build event context block for system prompt using templates."""
        if not event_refs:
            return ""

        # Resolve templates
        context_template = await self._prompt_resolver.resolve("chat_event_context", locale)
        item_template = await self._prompt_resolver.resolve("chat_event_item", locale)
        reaction_template = await self._prompt_resolver.resolve("chat_event_reaction", locale)

        # Build per-event blocks
        event_blocks: list[str] = []
        for ref in event_refs:
            event_data = ref.get("events", {}) or {}
            event_id = ref.get("event_id", "")

            item_text = self._prompt_resolver.fill_template(
                item_template,
                {
                    "event_title": event_data.get("title", "?"),
                    "event_type": event_data.get("event_type", "?"),
                    "impact_level": str(event_data.get("impact_level", "?")),
                    "occurred_at": event_data.get("occurred_at", ""),
                    "event_description": event_data.get("description", ""),
                },
            )
            event_blocks.append(item_text)

            # Append reactions for this event
            event_reactions = [r for r in reactions if str(r.get("event_id", "")) == str(event_id)]
            for reaction in event_reactions:
                reaction_text = self._prompt_resolver.fill_template(
                    reaction_template,
                    {
                        "agent_name": reaction.get("agent_name", "?"),
                        "event_title": event_data.get("title", "?"),
                        "reaction_text": reaction.get("reaction_text", ""),
                        "emotion": reaction.get("emotion", ""),
                    },
                )
                event_blocks.append(reaction_text)

        # Assemble into context wrapper
        event_list = "\n\n".join(event_blocks)
        return self._prompt_resolver.fill_template(
            context_template,
            {
                "event_list": event_list,
            },
        )

    async def _load_event_reactions(
        self,
        event_ids: list[str],
        agent_ids: list[str],
    ) -> list[dict]:
        """Load reactions from event_reactions for the referenced events and agents."""
        if not event_ids or not agent_ids:
            return []
        response = await (
            self._supabase.table("event_reactions")
            .select("agent_name, reaction_text, emotion, event_id, agent_id")
            .in_("event_id", event_ids)
            .in_("agent_id", agent_ids)
            .execute()
        )
        return extract_list(response)

    async def _load_conversation(self, conversation_id: UUID) -> dict:
        """Load conversation details. Only `agent_id` is consumed by callers."""
        response = await (
            self._supabase.table("chat_conversations")
            .select("id, agent_id")
            .eq("id", str(conversation_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            msg = f"Conversation {conversation_id} not found"
            raise ValueError(msg)
        return response.data[0]

    async def _load_agent(self, agent_id: str) -> dict:
        """Load agent profile."""
        response = await (
            self._supabase.table("agents")
            .select(
                "id, name, character, character_de, background, background_de, "
                "system, gender, primary_profession, primary_profession_de"
            )
            .eq("id", agent_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_conversation_agents(self, conversation_id: UUID) -> list[dict]:
        """Load all agents for a conversation via junction table with full profiles."""
        response = await (
            self._supabase.table("chat_conversation_agents")
            .select(
                "agent_id, agents(id, name, character, character_de, background, background_de,"
                " system, gender, primary_profession, primary_profession_de, portrait_image_url)",
            )
            .eq("conversation_id", str(conversation_id))
            .order("added_at")
            .execute()
        )
        agents = []
        for row in extract_list(response):
            agent_data = row.get("agents")
            if agent_data:
                agents.append(agent_data)
        return agents

    async def _load_event_references(self, conversation_id: UUID) -> list[dict]:
        """Load event references for a conversation."""
        response = await (
            self._supabase.table("chat_event_references")
            .select("id, event_id, events(title, event_type, description, occurred_at, impact_level)")
            .eq("conversation_id", str(conversation_id))
            .order("referenced_at")
            .execute()
        )
        return extract_list(response)

    async def _load_simulation(self) -> dict:
        """Load simulation details."""
        response = await (
            self._supabase.table("simulations")
            .select("name, description")
            .eq("id", str(self._simulation_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_history(self, conversation_id: UUID, model_id: str = "") -> list[dict]:
        """Load the MOST RECENT messages of a conversation, chronologically.

        Die Reihenfolge ist hier keine Kosmetik. Vorher stand
        ``order("created_at", desc=False).limit(N)`` — das nimmt die N
        ÄLTESTEN Nachrichten. Sobald eine Unterhaltung die Kappe
        überschreitet, sieht der Agent also dauerhaft nur ihren ANFANG und
        nie, was zuletzt gesagt wurde: die Erinnerung friert am Tag N ein und
        wächst nie mit. Es fällt nichts aus, die Antworten werden nur
        stillschweigend beziehungslos.

        Auf Prod hat das noch nie zugeschlagen (gemessen 31.08.2026: drei
        Unterhaltungen, die längste 13 Nachrichten) — der Fehler wartet auf
        die erste lange Unterhaltung, also genau auf den Fall, für den die
        Kappe überhaupt gedacht ist.

        Gleicher Weg wie ``ChatService.get_messages``: absteigend holen,
        kappen, umdrehen.
        """
        # `agents(name)` mitzuholen ist kein Komfort. Die Zuschreibung im
        # Gruppen-Prompt schlug den Namen bisher in der AKTUELLEN Besetzung
        # nach — und ein entfernter Agent steht dort nicht mehr. Seine alten
        # Nachrichten liefen dann ohne `[Name]:` als nackte `assistant`-Zeilen
        # in den Prompt, und der verbliebene Agent las die Worte des
        # Abgegangenen als seine EIGENEN. Der Name gehört an die Nachricht,
        # nicht an die Anwesenheitsliste.
        response = await (
            self._supabase.table("chat_messages")
            .select("content, sender_role, agent_id, created_at, agents(name)")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .limit(_max_history_messages(model_id))
            .execute()
        )
        messages = extract_list(response)
        messages.reverse()
        # Die Anzahl hat die Abfrage begrenzt; die LÄNGE entscheidet, was
        # davon mitgeht. Erst hier liegt der Text vor, also erst hier lässt
        # sich messen statt schätzen.
        return _trim_history_to_budget(messages, model_id, await self._get_locale())

    async def _get_locale(self) -> str:
        """Die Sprache dieser Welt, gepuffert je Dienst.

        ⚠ Diese Methode antwortete ``"de"``, wenn die Welt nichts gesetzt
        hatte — waehrend `PromptResolver._get_simulation_locale()` auf
        dieselbe Frage ``"en"`` antwortete. Beide fragen jetzt dieselbe
        Funktion; siehe `backend/utils/settings.DEFAULT_CONTENT_LOCALE` fuer
        das, was der Widerspruch angerichtet hat.
        """
        if hasattr(self, "_cached_locale"):
            return self._cached_locale
        self._cached_locale = await get_content_locale(self._supabase, self._simulation_id)
        return self._cached_locale
