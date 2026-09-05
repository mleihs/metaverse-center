"""Agent Memory & Reflection service — Stanford Generative Agents-style memory loop."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from backend.config import settings
from backend.services.embedding_service import EmbeddingService
from backend.services.generation_service import GenerationService
from backend.services.translation_service import schedule_auto_translation
from backend.utils.responses import extract_list
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

MOCK_OBSERVATIONS = [
    {"content": "The user seems interested in the city's history.", "importance": 6},
]

MOCK_REFLECTIONS = [
    {"content": "I notice a pattern – visitors always ask about the old quarter first.", "importance": 7},
]


async def _admin_client() -> Client:
    """Return the shared service-role Supabase client for memory writes."""
    return await get_admin_supabase_client()


class AgentMemoryService:
    """Manages agent memory: observe, store, retrieve, reflect."""

    # ── Record ────────────────────────────────────────────────────────

    @classmethod
    async def record_observation(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        content: str,
        importance: int = 5,
        source_type: str = "chat",
        source_id: UUID | None = None,
        memory_type: str = "observation",
        api_key: str | None = None,
        valid_until: datetime | None = None,
        supersedes: UUID | None = None,
    ) -> dict:
        """Store a memory with its embedding vector.

        ``valid_until`` setzt das Ende des Gueltigkeitsfensters. Ohne Angabe
        gilt die Erinnerung weiter — das ist der gewoehnliche Fall und der
        einzige, den es bis Migration 379 gab.

        ``supersedes`` benennt die Erinnerung, die diese hier ABLOEST. Sie
        faellt danach aus dem Abruf, denn beide zugleich im Prompt hiessen,
        dem Modell eine Tatsache und ihren Widerruf nebeneinander zu geben
        und es waehlen zu lassen. Die Zeile bleibt stehen; geloescht wird
        nichts.
        """
        embedding = await EmbeddingService.embed(content, api_key=api_key)

        record = {
            "agent_id": str(agent_id),
            "simulation_id": str(simulation_id),
            "memory_type": memory_type,
            "content": content,
            "importance": max(1, min(10, importance)),
            "source_type": source_type,
            "source_id": str(source_id) if source_id else None,
            # Kein Vektor heißt LEER, nicht Null. Ein Nullvektor ergibt in
            # pgvector den Abstand NaN, und NaN sortiert in DESC vor jeder
            # Zahl — die Erinnerung stünde in jedem Abruf auf Platz 1, ohne
            # zur Frage zu passen. Eine leere Spalte behandelt die
            # Bewertungsfunktion dagegen sauber (Wichtigkeit + Frische).
            "embedding": str(embedding) if embedding else None,
            # NULL heisst „gilt weiter". Der gewoehnliche Fall, und der
            # einzige, den es bis Migration 379 gab.
            "valid_until": valid_until.isoformat() if valid_until else None,
        }
        resp = await supabase.table("agent_memories").insert(record).execute()
        saved = resp.data[0]

        # Die Abloesung erst NACH dem Einfuegen: eine Vorgaengerin, die auf
        # eine Nachfolgerin zeigt, die es nicht gibt, waere ein halb
        # geschriebener Zustand — und der Fremdschluessel liesse sie ohnehin
        # nicht zu.
        if supersedes:
            await cls.supersede(supabase, supersedes, UUID(str(saved["id"])))

        # Get simulation info for translation
        sim_resp = await (
            supabase.table("simulations").select("name, theme").eq("id", str(simulation_id)).limit(1).execute()
        )
        if sim_resp.data:
            schedule_auto_translation(
                "agent_memories",
                saved["id"],
                {"content": content},
                sim_resp.data[0]["name"],
                sim_resp.data[0].get("theme", "dystopian"),
                entity_type="agent_memory",
            )

        return saved

    # ── Extract from chat ────────────────────────────────────────────

    @classmethod
    async def extract_from_chat(
        cls,
        simulation_id: UUID,
        agent_id: UUID,
        user_message: str,
        agent_response: str,
        api_key: str | None = None,
    ) -> list[dict]:
        """Extract memorable observations from a chat exchange.

        Runs as a fire-and-forget task that outlives the request, so it takes no
        client from the caller: a request-scoped client is closed at request
        teardown, and using it here was a use-after-close (deep-audit P1-1).
        Reads and writes both go through the admin singleton (writes additionally
        need service_role — RLS on agent_memories).
        """
        admin = await _admin_client()

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template observations")
            saved = []
            for obs in MOCK_OBSERVATIONS:
                record = await cls.record_observation(
                    admin,
                    agent_id,
                    simulation_id,
                    obs["content"],
                    obs["importance"],
                    source_type="chat",
                    api_key=api_key,
                )
                saved.append(record)
            return saved

        # Get simulation name
        sim_resp = await admin.table("simulations").select("name").eq("id", str(simulation_id)).limit(1).execute()
        sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"

        # Get agent name
        agent_resp = await admin.table("agents").select("name").eq("id", str(agent_id)).limit(1).execute()
        agent_name = agent_resp.data[0]["name"] if agent_resp.data else "Agent"

        gen = GenerationService(admin, simulation_id, api_key or settings.openrouter_api_key)
        batch = await gen.extract_memory_observations(
            agent_name=agent_name,
            simulation_name=sim_name,
            user_message=user_message,
            agent_response=agent_response,
        )

        saved = []
        for obs in batch.observations:
            record = await cls.record_observation(
                admin,
                agent_id,
                simulation_id,
                obs.content,
                obs.importance,
                source_type="chat",
                api_key=api_key,
            )
            saved.append(record)

        return saved

    # ── Gueltigkeit und Ueberholung ──────────────────────────────────

    @classmethod
    async def supersede(
        cls,
        supabase: Client,
        old_id: UUID,
        new_id: UUID | None = None,
        valid_until: datetime | None = None,
    ) -> dict | None:
        """Eine Erinnerung als ueberholt markieren, statt sie mitzuschleppen.

        ── WARUM ES DIESEN WEG BRAUCHT ──────────────────────────────────

        `agent_memories` hatte bis Migration 379 keine Spalte fuer
        Gueltigkeit, Ueberholtsein oder Vergessen — nur `last_accessed_at`,
        und die wird geschrieben, aber vom Abruf nie gelesen. Nichts liess je
        etwas fallen. „X ist Archivarin" und „X ist nicht mehr Archivarin"
        standen damit nebeneinander im selben Prompt, beide mit vollem
        Gewicht, und das Modell waehlte.

        Migration 373 hat geklaert, WESSEN Erinnerung es ist. Diese Methode
        klaert, WIE LANGE sie gilt.

        ── DIE ZWEI FAELLE SIND NICHT DERSELBE ──────────────────────────

        `new_id` gesetzt   Eine ANDERE Erinnerung hat diese abgeloest. Sie
                           faellt aus dem Abruf: beide zugleich hiessen,
                           dem Modell eine Tatsache und ihren Widerruf
                           nebeneinander zu geben.
        nur `valid_until`  Das Fenster ist zu, die Erinnerung bleibt wahr —
                           als Vergangenheit. Sie wird weiter abgerufen,
                           halb gewichtet und als „galt bis" gerendert.

        ── GELOESCHT WIRD NICHTS ────────────────────────────────────────

        Vergessen heisst hier: nicht mehr als Gegenwart abgerufen werden.
        Eine Zeile wegzuwerfen naehme dem Werk seine Geschichte, und ein
        Gedaechtnis, das Vergangenes nicht mehr benennen kann, ist aermer als
        eines, das zu viel behaelt.

        Die Pruefungen (kein Selbstbezug, kein fremdes Gedaechtnis) und das
        Setzen beider Spalten stehen in `fn_supersede_memory` — EINE
        Anweisung statt lesen-rechnen-schreiben mit einem Fenster dazwischen
        (ADR-007). Die Funktion ist SECURITY INVOKER: RLS entscheidet, und
        sie kann nichts, was die Aufruferin nicht darf (ADR-006).
        """
        params: dict = {"p_old_id": str(old_id)}
        if new_id:
            params["p_new_id"] = str(new_id)
        if valid_until:
            params["p_valid_until"] = valid_until.isoformat()
        response = await supabase.rpc("fn_supersede_memory", params).execute()
        zeilen = extract_list(response)
        return zeilen[0] if zeilen else None

    # ── Retrieve (Stanford formula) ──────────────────────────────────

    @classmethod
    async def retrieve(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        query_text: str | None = None,
        top_k: int = 10,
        api_key: str | None = None,
    ) -> list[dict]:
        """Retrieve memories ranked by semantic similarity + importance + recency.

        Uses Postgres ``retrieve_agent_memories`` RPC (migration 067).
        """
        # `embed` liefert None, wenn kein Vektor zu holen war. Der Abruf faellt
        # dann auf Wichtigkeit + Frische zurueck — schlechter als semantisch,
        # aber richtig, und ohne den Aufruf scheitern zu lassen.
        embedding = None
        if query_text:
            embedding = await EmbeddingService.embed(query_text, api_key=api_key)

        params: dict = {
            "p_agent_id": str(agent_id),
            "p_top_k": top_k,
        }
        if embedding:
            params["p_query_embedding"] = str(embedding)

        response = await supabase.rpc("retrieve_agent_memories", params).execute()
        memories = extract_list(response)

        # Update last_accessed_at for retrieved memories
        if memories:
            memory_ids = [m["id"] for m in memories]
            await supabase.table("agent_memories").update({"last_accessed_at": "now()"}).in_("id", memory_ids).execute()

        return memories

    # ── Reflect ──────────────────────────────────────────────────────

    # ── Verdichtung im Herzschlag ────────────────────────────────────

    #: Ab so vielen NEUEN Beobachtungen lohnt eine Verdichtung.
    #:
    #: `reflect()` liest die 20 jüngsten Beobachtungen und braucht mindestens
    #: fünf. Bei 50 ist genug Neues da, dass die Verdichtung etwas anderes
    #: sagt als beim letzten Mal, und selten genug, dass sie nicht in jedem
    #: Tick Modellkosten erzeugt.
    REFLECTION_TRIGGER = 50

    @classmethod
    async def reflect_due_agents(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        budget: int = 2,
        locale: str | None = None,
        api_key: str | None = None,
    ) -> list[dict]:
        """Verdichtet für die Agenten, bei denen sich genug angesammelt hat.

        WARUM ES DAS GIBT
        ``reflect()`` synthetisiert aus vielen Einzelbeobachtungen höherstufige
        Einsichten („misstraut Autorität, wo Verlust im Spiel war"). Sie hing
        bis heute NUR an einem Endpunkt, den jemand von Hand aufruft — kein
        Tick, kein Zeitgeber. Auf Produktion gemessen (02.09.2026): **fünf
        Verdichtungen gegen 300 Beobachtungen.**

        Für ein langes Gespräch ist genau das der Engpass. Der Abruf holt acht
        Erinnerungen; sind das acht flache Einzelbeobachtungen statt einer
        Einsicht, die fünfzig zusammenfasst, verliert der Agent bei Nachricht
        300 den Überblick, obwohl alles gespeichert ist.

        WIE AUSGEWÄHLT WIRD
        Je Agent: Beobachtungen, die JÜNGER sind als seine letzte Verdichtung
        (oder alle, wenn er noch keine hat). Ab ``REFLECTION_TRIGGER`` ist er
        fällig. Die Fälligsten zuerst, höchstens ``budget`` je Tick — ein
        Modellaufruf je Agent, und ein Tick darf nicht unbegrenzt kosten.

        Gibt die angelegten Verdichtungen zurück, für die Chronik.
        """
        faellige = await cls._agents_due_for_reflection(supabase, simulation_id, budget)
        if not faellige:
            return []

        # Erst hier holen, nicht beim Aufrufer: der Herzschlag kennt die
        # Inhaltssprache einer Welt nicht, und eine Abfrage je Tick fuer einen
        # Fall, der selten eintritt, waere verschenkt.
        if locale is None:
            locale = await cls._content_locale(supabase, simulation_id)

        angelegt: list[dict] = []
        for agent_id, offen in faellige:
            try:
                neue = await cls.reflect(supabase, simulation_id, agent_id, locale=locale, api_key=api_key)
            except Exception:
                # Ein Agent, dessen Verdichtung scheitert, darf die übrigen
                # nicht mitnehmen — und den Tick schon gar nicht.
                logger.exception("Reflection failed for agent %s", agent_id)
                continue
            for eintrag in neue:
                angelegt.append({**eintrag, "agent_id": str(agent_id), "pending": offen})
        return angelegt

    @staticmethod
    async def _content_locale(supabase: Client, simulation_id: UUID) -> str:
        """Die Inhaltssprache der Welt, wie der Chat sie auch liest."""
        resp = await (
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )
        rows = extract_list(resp)
        return str(rows[0].get("setting_value", "de")) if rows else "de"

    @classmethod
    async def _agents_due_for_reflection(
        cls,
        supabase: Client,
        simulation_id: UUID,
        budget: int,
    ) -> list[tuple[UUID, int]]:
        """Wer hat genug Neues gesammelt? Fälligste zuerst.

        Bewusst zwei schmale Abfragen statt einer RPC: die Zahlen sind klein
        (Beobachtungen je Simulation liegen im dreistelligen Bereich), und die
        Auswahlregel gehört in die Spiellogik, nicht in SQL.
        """
        letzte_resp = await (
            supabase.table("agent_memories")
            .select("agent_id, created_at")
            .eq("simulation_id", str(simulation_id))
            .eq("memory_type", "reflection")
            .order("created_at", desc=True)
            .execute()
        )
        letzte: dict[str, str] = {}
        for zeile in extract_list(letzte_resp):
            letzte.setdefault(str(zeile["agent_id"]), zeile["created_at"])

        beob_resp = await (
            supabase.table("agent_memories")
            .select("agent_id, created_at")
            .eq("simulation_id", str(simulation_id))
            .eq("memory_type", "observation")
            .execute()
        )
        offen: dict[str, int] = {}
        for zeile in extract_list(beob_resp):
            aid = str(zeile["agent_id"])
            grenze = letzte.get(aid)
            if grenze is None or str(zeile["created_at"]) > grenze:
                offen[aid] = offen.get(aid, 0) + 1

        faellig = [(k, v) for k, v in offen.items() if v >= cls.REFLECTION_TRIGGER]
        faellig.sort(key=lambda kv: kv[1], reverse=True)
        return [(UUID(k), v) for k, v in faellig[: max(0, budget)]]

    @classmethod
    async def reflect(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        locale: str = "en",
        api_key: str | None = None,
    ) -> list[dict]:
        """Synthesize higher-level reflections from recent observations."""
        # Fetch recent observations
        obs_resp = await (
            supabase.table("agent_memories")
            .select("content, importance, created_at")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .eq("memory_type", "observation")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        observations = extract_list(obs_resp)

        if len(observations) < 5:
            return []

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template reflections")
            saved = []
            for ref in MOCK_REFLECTIONS:
                record = await cls.record_observation(
                    supabase,
                    agent_id,
                    simulation_id,
                    ref["content"],
                    ref["importance"],
                    source_type="reflection",
                    memory_type="reflection",
                    api_key=api_key,
                )
                saved.append(record)
            return saved

        # Get names
        sim_resp = await supabase.table("simulations").select("name").eq("id", str(simulation_id)).limit(1).execute()
        sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"

        agent_resp = await supabase.table("agents").select("name").eq("id", str(agent_id)).limit(1).execute()
        agent_name = agent_resp.data[0]["name"] if agent_resp.data else "Agent"

        # Format observations text
        obs_text = "\n".join(f"- [{o['importance']}/10] {o['content']}" for o in observations)

        gen = GenerationService(supabase, simulation_id, api_key or settings.openrouter_api_key)
        batch = await gen.reflect_on_memories(
            agent_name=agent_name,
            simulation_name=sim_name,
            observations_text=obs_text,
            locale=locale,
        )

        saved = []
        for ref in batch.reflections:
            record = await cls.record_observation(
                supabase,
                agent_id,
                simulation_id,
                ref.content,
                ref.importance,
                source_type="reflection",
                memory_type="reflection",
                api_key=api_key,
            )
            saved.append(record)

        return saved

    # ── List (paginated) ─────────────────────────────────────────────

    @classmethod
    async def list_memories(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        memory_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list, int]:
        """Paginated list of agent memories for display."""
        query = (
            supabase.table("agent_memories")
            .select(
                "id, agent_id, simulation_id, memory_type, content, content_de, "
                "importance, source_type, source_id, created_at, last_accessed_at, "
                # Ohne diese zwei sieht eine Verwaltungsoberflaeche einer
                # ueberholten Erinnerung nicht an, dass sie ueberholt ist —
                # und die Spalte waere gebaut und unsichtbar.
                "valid_until, superseded_by",
                count="exact",
            )
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if memory_type:
            query = query.eq("memory_type", memory_type)

        response = await query.execute()
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    # ── Format for prompt injection ──────────────────────────────────

    @classmethod
    def format_for_prompt(cls, memories: list[dict]) -> str:
        """Format memories as text block for system prompt injection."""
        if not memories:
            return ""

        lines = ["Your memories and reflections:"]
        for m in memories:
            mtype = m.get("memory_type", "observation")
            importance = m.get("importance", 5)
            content = m.get("content", "")
            # Eine abgelaufene Erinnerung wird NICHT verschwiegen, sondern in
            # die Vergangenheit gesetzt. „X war Archivarin" ist wahr und
            # brauchbar; „X ist Archivarin" ist es nicht mehr. Ohne diese
            # Marke saehen beide im Prompt gleich aus, und der Unterschied
            # steht nirgends im Wortlaut (Migration 379).
            if m.get("expired"):
                lines.append(f"- [{importance}/10] {content} ({mtype}, no longer current)")
            else:
                lines.append(f"- [{importance}/10] {content} ({mtype})")
        return "\n".join(lines)
