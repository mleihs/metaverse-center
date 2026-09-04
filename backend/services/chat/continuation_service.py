"""Gespräche, die ohne den Menschen weitergehen.

Wer mit zwei Agenten redet und den Browser schliesst, kommt in einen Faden
zurück, in dem seit seinem letzten Satz nichts geschehen ist. Diese Phase
lässt die Agenten miteinander weiterreden — im SELBEN Faden, sichtbar beim
nächsten Öffnen, und nur dort, wo ein Mensch es ausdrücklich eingeschaltet
hat (Migration 357).

── Warum ein einziger Aufruf für den ganzen Wortwechsel ─────────────────────

Nicht ein Aufruf je Zug. Zwei Gründe, und der zweite ist der wichtigere:

* **Kosten.** Ein Zug je Aufruf hiesse, den ganzen Kontext zwei- bis viermal
  zu schicken. Gemessen an ``ai_usage_log`` auf Produktion: 21 940
  Eingabe-Token je Chat-Aufruf.
* **Zusammenhang.** Ein Wortwechsel, der Zug für Zug entsteht, hat keinen
  Bogen. Das Modell, das alle drei Züge auf einmal schreibt, kann eine Frage
  stellen und sie beantworten lassen; drei getrennte Aufrufe schreiben drei
  Anfänge.

Das kostet die Trennung der Stimmen, die Migration 356 im Chat gerade erst
hergestellt hat — hier schreibt EIN Modell alle Beteiligten. Der Unterschied
ist, dass es das hier ausdrücklich TUN SOLL: es schreibt eine Szene, nicht
eine Person. Die Zuordnung geschieht danach, beim Speichern, über den
gemeldeten Sprechernamen. Ein Zug, dessen Sprecher nicht zur Besetzung
gehört, wird verworfen und nicht zugeordnet.

── Warum ein enges Fenster ──────────────────────────────────────────────────

Der Chat schickt bis zu 60 % seines Kontextfensters als Verlauf mit
(``_HISTORY_BUDGET_RATIO``). Für diese Phase gerechnet:

    voller Verlauf     0,18 Cent je Wortwechsel   103 $ je Monat, 16 Welten
    enges Fenster      0,028 Cent                   1,59 $

Faktor 65, und zugleich besser: die Verdichtung aus Migration 358 trägt die
Vorgeschichte in einem Bruchteil der Token, und die letzten zehn Nachrichten
tragen den Ton. Zusammen ist das mehr Zusammenhang als ein Schleppzug aus 300
Zeilen, in dem das Wichtige untergeht.

── Was diese Phase NICHT anfasst ────────────────────────────────────────────

Verschlossene Fäden (Migration 349). Wer verschliesst, hat eine Geste
gemacht; ein Agent, der daraus in der Wochenpost erzählt, verrät sie. Die
Schranke steht dreifach: im Teilindex aus 357, in der Abfrage hier, und im
Endpunkt, der das Einschalten verweigert.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

from backend.services.agent_memory_service import AgentMemoryService
from backend.services.ai_usage_service import AIUsageService
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.chat.conversation_digest_service import ConversationDigestService
from backend.services.external.openrouter import BudgetContext, OpenRouterService
from backend.services.model_resolver import ModelResolver
from backend.services.platform_model_config import get_platform_max_tokens, get_platform_reasoning
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from backend.utils.responses import extract_list
from backend.utils.settings import parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Das Merkmalstor. Vorgabe AUS: eine Phase, die Modellaufrufe erzeugt, darf
#: nicht dadurch anlaufen, dass jemand vergessen hat, sie abzuschalten.
FEATURE_GATE = "agent_continuation_enabled"

#: Der eigene Modellzweck. Nicht `chat_response` und erst recht nicht
#: `model_default` — siehe Handoff `denkmodell-als-standard-2026-09-02`: dort
#: war das Vorgabemodell ein Denkmodell, und 709 von 747 Aufrufen liefen
#: unbemerkt teuer. Ein eigener Zweck ist die Schranke dagegen, dass eine
#: Änderung an der Vorgabe diese Phase still verteuert.
PURPOSE = "agent_continuation"

#: Wie viele Nachrichten wörtlich mitgehen. Der Ton eines Gesprächs steht in
#: den letzten Zügen; die Vorgeschichte trägt die Verdichtung aus 358.
RECENT_WINDOW = 10

#: Wie viele Züge ein Wortwechsel hat. Zwei sind ein Wortwechsel, vier sind
#: eine kurze Szene; fünf wären eine Folge, die der Mensch beim Zurückkommen
#: erst lesen müsste, bevor er wieder mitreden kann.
MIN_TURNS = 2
MAX_TURNS = 4

_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


class ContinuationService:
    """Die Heartbeat-Phase, die Gespräche ohne Zuhörer weiterlaufen lässt."""

    @classmethod
    async def generate_for_simulation(
        cls,
        admin: Client,
        simulation_id: UUID,
        *,
        budget: int = 2,
        openrouter_api_key: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fällige Fäden weiterreden lassen. Gibt die geschriebenen Wortwechsel zurück.

        ``budget`` ist die Zahl der Fäden je Takt, nicht die der Modellaufrufe
        — je Faden fällt genau einer an.
        """
        if not await cls._gate_open(admin):
            return []

        faeden = await cls._due_conversations(admin, simulation_id, limit=budget)
        if not faeden:
            return []

        resolver = ModelResolver(admin, simulation_id)
        model = await resolver.resolve_text_model(PURPOSE)
        prompts = PromptResolver(admin, simulation_id)
        openrouter = OpenRouterService(api_key=openrouter_api_key)
        budget_ctx = BudgetContext(
            admin_supabase=admin,
            purpose=PURPOSE,
            simulation_id=simulation_id,
        )

        ergebnisse: list[dict[str, Any]] = []
        for faden in faeden:
            wortwechsel = await cls._continue_one(
                admin,
                simulation_id,
                faden,
                model=model,
                prompts=prompts,
                openrouter=openrouter,
                budget_ctx=budget_ctx,
            )
            if wortwechsel:
                ergebnisse.append(wortwechsel)
        return ergebnisse

    # ── Torwächter ────────────────────────────────────────────────────────

    @staticmethod
    async def _gate_open(admin: Client) -> bool:
        """Ob die Verwaltung die Phase überhaupt freigegeben hat.

        Fail-closed: fehlt die Zeile, ist das Tor ZU. `parse_setting_bool` ist
        seit F32 positiv-prüfend (`{"true","1","yes","on"}`), ein
        jsonb-Null-Umlauf oder ein Tippfehler im SQL kann die Phase also nicht
        versehentlich scharfstellen.
        """
        response = await (
            admin.table("platform_settings").select("setting_value").eq("setting_key", FEATURE_GATE).limit(1).execute()
        )
        rows = extract_list(response)
        if not rows:
            return False
        return parse_setting_bool(rows[0].get("setting_value"))

    # ── Auswahl ───────────────────────────────────────────────────────────

    @classmethod
    async def _due_conversations(
        cls,
        admin: Client,
        simulation_id: UUID,
        *,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Fäden, die weiterreden dürfen UND deren Abstand abgelaufen ist.

        EINE Abfrage (``fn_due_continuations``, Migration 365). Der Zeit-Riegel
        und die Besetzungsprüfung stehen dort, nicht hier.

        ⚠ Die erste Fassung tat beides in Python: sie lud jede eingeschaltete
        Unterhaltung und verglich dann ``now() - last_message_at`` gegen
        ``continue_interval_hours`` — zwei Spalten DERSELBEN ZEILE, in der
        Anwendung verglichen, also jede Zeile geholt, um die meisten
        wegzuwerfen. Und „mindestens zwei Agenten" lief als eigene Abfrage je
        Zeile: bei zwanzig eingeschalteten Fäden einundzwanzig Abfragen für
        höchstens zwei Ergebnisse. Beides ein Verstoss gegen ADR-007.

        Der Zeit-Riegel misst gegen ``last_message_at``, und das ist Absicht:
        schreibt der Mensch selbst etwas, ist die Uhr zurückgestellt. Wer da
        ist, braucht keine Agenten, die ohne ihn reden.

        Die Besetzung wird danach noch EINMAL geladen — die Funktion gibt ihre
        Anzahl zurück, aber der Wortwechsel braucht Namen und Profile. Das ist
        kein N+1: höchstens ``limit`` Fäden, also höchstens zwei Abfragen.
        """
        response = await admin.rpc(
            "fn_due_continuations",
            {"p_simulation_id": str(simulation_id), "p_limit": limit},
        ).execute()

        faellig: list[dict[str, Any]] = []
        for row in extract_list(response):
            agents = await cls._load_agents(admin, row["id"])
            if len(agents) < 2:
                # Die Funktion hat schon gezählt; zwischen ihrem Lauf und
                # diesem kann jemand einen Agenten entfernt haben. Die Prüfung
                # bleibt deshalb stehen — sie kostet nichts und schliesst das
                # Fenster.
                continue
            row["agents"] = agents
            faellig.append(row)
        return faellig

    @staticmethod
    async def _load_agents(admin: Client, conversation_id: str) -> list[dict[str, Any]]:
        response = await (
            admin.table("chat_conversation_agents")
            .select("agents(id, name, character, character_de, background, background_de)")
            .eq("conversation_id", conversation_id)
            .order("added_at")
            .execute()
        )
        return [row["agents"] for row in extract_list(response) if row.get("agents")]

    # ── Ein Wortwechsel ───────────────────────────────────────────────────

    @classmethod
    async def _continue_one(
        cls,
        admin: Client,
        simulation_id: UUID,
        faden: dict[str, Any],
        *,
        model: Any,
        prompts: PromptResolver,
        openrouter: OpenRouterService,
        budget_ctx: BudgetContext,
    ) -> dict[str, Any] | None:
        conversation_id = UUID(str(faden["id"]))
        locale = str(faden.get("locale") or "de")
        agents = faden["agents"]
        namen = [str(a.get("name") or "") for a in agents]

        recent = await cls._recent_messages(admin, conversation_id)
        digest = await ConversationDigestService(admin, simulation_id).load_digest_text(conversation_id, locale)
        template = await prompts.resolve("chat_continuation", locale)
        prompt = prompts.fill_template(
            template,
            {
                "participant_names": ", ".join(namen),
                "agent_profiles": cls._profiles(agents, locale),
                "conversation_digest": digest,
                "recent_transcript": "\n".join(cls._as_line(m) for m in recent),
                "locale_name": LOCALE_NAMES.get(locale, locale),
                "turn_count": f"{MIN_TURNS}-{MAX_TURNS}",
            },
        )
        system_prompt = prompts.fill_system_prompt(template, {})

        try:
            raw = await openrouter.generate(
                model=model.model_id,
                messages=([{"role": "system", "content": system_prompt}] if system_prompt else [])
                + [{"role": "user", "content": prompt}],
                temperature=1.0,
                max_tokens=get_platform_max_tokens(PURPOSE),
                reasoning=get_platform_reasoning(PURPOSE),
                budget=budget_ctx,
            )
        except BudgetExceededError as exc:
            logger.info("Wortwechsel in %s durch Budget gestoppt: %s", conversation_id, exc)
            return None

        await AIUsageService.log(
            admin,
            simulation_id=simulation_id,
            provider="openrouter",
            model=model.model_id,
            purpose=PURPOSE,
            usage=openrouter.last_usage or {},
            metadata={"conversation_id": str(conversation_id)},
        )

        zuege = cls._parse_turns(raw, namen)
        if not zuege:
            # KEIN Ersatz aus einer Vorlage. Ein erfundener Wortwechsel wäre
            # schlimmer als keiner: er stünde für immer im Faden und der
            # Mensch hielte ihn für das, was seine Figuren gesagt haben.
            logger.warning(
                "Wortwechsel fuer %s unbrauchbar – nichts geschrieben. Antwort: %.120s",
                conversation_id,
                raw or "",
            )
            return None

        geschrieben = await cls._persist(admin, simulation_id, conversation_id, zuege, agents, model.model_id)
        if not geschrieben:
            return None

        await cls._record_memories(admin, simulation_id, zuege, agents, conversation_id)
        gefluestert = await cls._whisper(
            admin,
            faden,
            zuege,
            agents,
            locale=locale,
            conversation_id=conversation_id,
        )
        return {
            "conversation_id": str(conversation_id),
            "user_id": faden.get("user_id"),
            "notify": faden.get("continue_notify") or "digest",
            "locale": locale,
            "turns": zuege,
            "agent_names": namen,
            "whispers": gefluestert,
        }

    # ── Melden ────────────────────────────────────────────────────────────

    @classmethod
    async def _whisper(
        cls,
        admin: Client,
        faden: dict[str, Any],
        zuege: list[dict[str, str]],
        agents: list[dict[str, Any]],
        *,
        locale: str,
        conversation_id: UUID,
    ) -> list[str]:
        """Ein Flüstern über das, was ohne den Menschen geschah.

        ⚠ **ABWEICHUNG VOM PLAN, und sie ist gemessen.** Der Plan sagt:
        erzeugt, „wenn der Spieler darin vorkommt UND eine Bindung besteht".
        Die erste Bedingung ist nicht erfüllbar:

        * ``user_profiles`` führt keinen Anzeigenamen (id, email,
          onboarding_completed, academy_epochs_played, created_at, updated_at).
        * Vor allem: der Agent ERFÄHRT den Namen nie. Weder
          ``chat_ai_service`` noch ein Prompt-Vertrag reicht ihn durch; in
          jeder Mitschrift heisst der Mensch schlicht „User".

        Eine Bedingung, die auf einen Namen prüft, den niemand kennt, ist
        immer falsch — das Merkmal sähe gebaut aus und liefe nie. Es gilt
        deshalb die zweite Bedingung allein, und sie ist auch die richtigere:
        die BINDUNG ist die Beziehung, die die Nachricht bedeutsam macht.
        Ohne sie wäre das Flüstern die Benachrichtigung einer Fremden.

        ``never`` schweigt vollständig — kein Flüstern, keine Karte, keine
        Post. Die Zeile entstünde sonst und läge nur ungelesen da.
        """
        if (faden.get("continue_notify") or "digest") == "never":
            return []
        user_id = faden.get("user_id")
        if not user_id:
            return []

        agent_ids = [str(a["id"]) for a in agents]
        response = await (
            admin.table("agent_bonds")
            .select("id, agent_id")
            .eq("user_id", str(user_id))
            .in_("agent_id", agent_ids)
            .neq("status", "farewell")
            .execute()
        )
        bindungen = extract_list(response)
        if not bindungen:
            return []

        nach_id = {str(a["id"]): str(a.get("name") or "?") for a in agents}
        zeilen = []
        for bindung in bindungen:
            agent_id = str(bindung.get("agent_id"))
            name = nach_id.get(agent_id, "?")
            andere = [n for i, n in nach_id.items() if i != agent_id]
            zeile = zuege[0]["content"]
            zeilen.append(
                {
                    "bond_id": bindung["id"],
                    "whisper_type": "conversation",
                    "content_de": cls._whisper_text(name, andere, zeile, "de"),
                    "content_en": cls._whisper_text(name, andere, zeile, "en"),
                    # Ohne die conversation_id waere das Fluestern eine
                    # Behauptung ohne Beleg — der Mensch koennte nicht
                    # nachsehen, wovon die Rede ist.
                    "trigger_context": {
                        "conversation_id": str(conversation_id),
                        "notify": faden.get("continue_notify") or "digest",
                        "turns": len(zuege),
                        "locale": locale,
                    },
                }
            )

        # EIN Insert fuer alle Bindungen, nicht einer je Schleifendurchlauf.
        # Zwei gebundene Agenten im selben Faden sind zwei Zeilen, und zwei
        # Rundreisen dafuer sind eine zu viel (ADR-007).
        #
        # Alles oder nichts ist hier auch das RICHTIGE: die Bindungen eines
        # Fadens gehoeren demselben Menschen. Bekaeme er eine Karte und die
        # zweite nicht, saehe er einen halben Wortwechsel und haette keinen
        # Anhalt, dass etwas fehlt.
        try:
            await admin.table("bond_whispers").insert(zeilen).execute()
        except Exception:
            # Ein misslungenes Fluestern kostet den Wortwechsel NICHT: der
            # steht schon im Faden und ist beim naechsten Oeffnen da.
            logger.exception(
                "Fluestern aus Wortwechsel %s fehlgeschlagen (%d Bindung(en))",
                conversation_id,
                len(zeilen),
            )
            return []
        return [str(z["bond_id"]) for z in zeilen]

    @staticmethod
    def _whisper_text(name: str, andere: list[str], zeile: str, sprache: str) -> str:
        """Der Text der Karte. KEIN Modellaufruf.

        Der Wortwechsel ist schon geschrieben und bezahlt; ihn ein zweites Mal
        durch ein Modell zu schicken, um zu sagen „wir haben geredet", wäre ein
        Aufruf für eine Auskunft, die schon dasteht. Die erste Zeile des
        Wortwechsels IST die Nachricht.
        """
        mit = ", ".join(andere) if andere else ("someone" if sprache == "en" else "jemandem")
        auszug = zeile.strip()
        if len(auszug) > 180:
            auszug = auszug[:177].rstrip() + "..."
        if sprache == "en":
            return f"While you were away, {name} talked with {mit}.\n\n\u201e{auszug}\u201c"
        return f"Waehrend du weg warst, hat {name} mit {mit} gesprochen.\n\n\u201e{auszug}\u201c"

    # ── Kontext ───────────────────────────────────────────────────────────

    @staticmethod
    async def _recent_messages(admin: Client, conversation_id: UUID) -> list[dict[str, Any]]:
        """Die letzten Nachrichten, chronologisch.

        Absteigend holen, kappen, umdrehen — derselbe Weg wie
        ``ChatAIService._load_history``. Aufsteigend mit ``limit`` nähme die
        ÄLTESTEN, und der Wortwechsel knüpfte dann für immer am Anfang des
        Fadens an.
        """
        response = await (
            admin.table("chat_messages")
            .select("content, sender_role, created_at, agents(name)")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .limit(RECENT_WINDOW)
            .execute()
        )
        rows = extract_list(response)
        rows.reverse()
        return rows

    @staticmethod
    def _profiles(agents: list[dict[str, Any]], locale: str) -> str:
        zeilen = []
        for a in agents:
            name = a.get("name") or "?"
            character = a.get("character_de" if locale == "de" else "character") or a.get("character") or ""
            background = a.get("background_de" if locale == "de" else "background") or a.get("background") or ""
            zeilen.append(f"{name}: {character}\n{background}".strip())
        return "\n\n".join(zeilen)

    @staticmethod
    def _as_line(msg: dict[str, Any]) -> str:
        embedded = msg.get("agents")
        if isinstance(embedded, list):
            embedded = embedded[0] if embedded else None
        name = embedded.get("name") if isinstance(embedded, dict) else None
        if not name:
            name = "User" if msg.get("sender_role") == "user" else "?"
        return f"{name}: {msg.get('content') or ''}"

    # ── Auswertung ────────────────────────────────────────────────────────

    @classmethod
    def _parse_turns(cls, raw: str, namen: list[str]) -> list[dict[str, str]]:
        """Die gemeldeten Züge, geprüft gegen die Besetzung.

        Ein Zug, dessen Sprecher NICHT zur Besetzung gehört, wird verworfen —
        nicht zugeordnet, nicht geraten. Das Modell schreibt hier absichtlich
        alle Stimmen; die einzige Stelle, an der die Zuordnung entsteht, ist
        diese, und sie darf nicht raten. Ein falsch zugeordneter Zug stünde
        für immer unter dem Namen einer Figur, die ihn nie gesagt hat — genau
        der Fehler, den Migration 356 im Chat behoben hat.

        Ist danach weniger als ``MIN_TURNS`` übrig, ist der ganze Wortwechsel
        unbrauchbar. Ein Rest von einem Zug ist kein Wortwechsel.
        """
        data = cls._extract_json(raw)
        if not isinstance(data, dict):
            return []
        rohe = data.get("turns")
        if not isinstance(rohe, list):
            return []

        bekannte = {n.strip().casefold(): n for n in namen if n and n.strip()}
        zuege: list[dict[str, str]] = []
        for eintrag in rohe[:MAX_TURNS]:
            if not isinstance(eintrag, dict):
                continue
            sprecher = str(eintrag.get("speaker") or "").strip()
            text = str(eintrag.get("content") or "").strip()
            if not text:
                continue
            treffer = bekannte.get(sprecher.casefold())
            if not treffer:
                logger.warning(
                    "Zug mit unbekanntem Sprecher %r verworfen (Besetzung: %s)",
                    sprecher[:40],
                    ", ".join(namen),
                )
                continue
            zuege.append({"speaker": treffer, "content": text})

        if len(zuege) < MIN_TURNS:
            return []
        return zuege

    @staticmethod
    def _extract_json(raw: str) -> Any:
        if not raw or not raw.strip():
            return None
        text = raw.strip()
        fence = _FENCE_RE.search(text)
        if fence:
            text = fence.group(1).strip()
        for kandidat in (text, *(m.group(0) for m in re.finditer(r"\{.*\}", text, re.DOTALL))):
            try:
                return json.loads(kandidat)
            except (json.JSONDecodeError, TypeError):
                continue
        return None

    # ── Schreiben ─────────────────────────────────────────────────────────

    @staticmethod
    async def _persist(
        admin: Client,
        simulation_id: UUID,
        conversation_id: UUID,
        zuege: list[dict[str, str]],
        agents: list[dict[str, Any]],
        model_id: str,
    ) -> bool:
        nach_name = {str(a.get("name") or "").casefold(): str(a["id"]) for a in agents}
        zeilen = []
        for i, zug in enumerate(zuege):
            agent_id = nach_name.get(zug["speaker"].casefold())
            if not agent_id:
                continue
            zeilen.append(
                {
                    "conversation_id": str(conversation_id),
                    "content": zug["content"],
                    "sender_role": "assistant",
                    "agent_id": agent_id,
                    "metadata": {
                        # Die Marke, an der die Oberfläche einen Wortwechsel
                        # ohne Zuhörer von einer Antwort auf den Menschen
                        # unterscheiden kann.
                        "without_user": True,
                        "model": model_id,
                        "model_used": model_id,
                        "source": "continuation",
                        "turn_index": i,
                    },
                }
            )
        if not zeilen:
            return False
        await admin.table("chat_messages").insert(zeilen).execute()
        return True

    @staticmethod
    async def _record_memories(
        admin: Client,
        simulation_id: UUID,
        zuege: list[dict[str, str]],
        agents: list[dict[str, Any]],
        conversation_id: UUID,
    ) -> None:
        """Je Beteiligtem eine Beobachtung.

        Sonst wäre der Wortwechsel für die Figuren selbst nicht geschehen: er
        stünde im Faden, aber nicht in ihrem Gedächtnis, und beim nächsten
        Zusammentreffen wüsste keine davon.

        Fehler hier kosten den Wortwechsel NICHT: er ist schon geschrieben.
        Eine Beobachtung, die nicht angelegt werden konnte, ist ein Verlust an
        Gedächtnis, kein Grund, die Szene zurückzunehmen.
        """
        text = "\n".join(f"{z['speaker']}: {z['content']}" for z in zuege)
        for agent in agents:
            try:
                await AgentMemoryService.record_observation(
                    admin,
                    UUID(str(agent["id"])),
                    simulation_id,
                    content=text[:2000],
                    importance=4,
                    source_type="chat",
                    source_id=conversation_id,
                )
            except Exception:
                logger.exception(
                    "Beobachtung fuer %s aus Wortwechsel %s fehlgeschlagen",
                    agent.get("name"),
                    conversation_id,
                )
