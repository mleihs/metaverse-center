"""Research service for the Simulation Forge (The Astrolabe).

Uses Pydantic AI for structured extraction from thematic context.
"""

from __future__ import annotations

import hashlib
import logging

import anyio
from tavily import TavilyClient

from backend.config import settings
from backend.models.forge import PhilosophicalAnchor
from backend.services.ai_utils import PYDANTIC_AI_MAX_TOKENS, create_forge_agent

logger = logging.getLogger(__name__)

# Initialize Tavily only if key exists
tavily = TavilyClient(api_key=settings.tavily_api_key) if settings.tavily_api_key else None

# ── Local Tavily Emulator ───────────────────────────────────────────
# Deterministically generates rich, seed-aware research context so the
# full Astrolabe flow can be tested locally without a Tavily API key.

_THEMATIC_LENSES = [
    {
        "theme": "entropy and decay",
        "context": (
            "Thermodynamic irreversibility as narrative engine. Ilya Prigogine's "
            "dissipative structures suggest that order emerges from chaos only at "
            "the cost of accelerating entropy elsewhere. In urban sociology, this "
            "maps to the broken-window thesis — visible decay as a self-reinforcing "
            "signal. The architecture of abandoned shopping malls (dead malls) offers "
            "a physical metaphor: cathedrals of consumerism reclaimed by entropy."
        ),
    },
    {
        "theme": "memory and identity",
        "context": (
            "Henri Bergson's durée posits memory as a continuous, indivisible flow "
            "rather than discrete snapshots. Trauma studies (Cathy Caruth) show that "
            "memory is not passively stored but actively reconstructed, often with "
            "distortions that serve psychological survival. The Ship of Theseus "
            "paradox, applied to personal identity, asks whether a person rebuilt "
            "from replacement memories is still the same entity."
        ),
    },
    {
        "theme": "surveillance and control",
        "context": (
            "Foucault's panopticon as internalized discipline. Shoshana Zuboff's "
            "surveillance capitalism describes a new economic logic where behavioral "
            "prediction markets extract value from human experience. China's social "
            "credit system operationalizes this into concrete governance. Counter-"
            "surveillance (sousveillance) movements propose radical transparency "
            "as antidote — David Brin's 'The Transparent Society' argues that "
            "privacy is already dead; the question is who watches the watchers."
        ),
    },
    {
        "theme": "liminal spaces and thresholds",
        "context": (
            "Victor Turner's liminality describes transitional states where normal "
            "social structures dissolve. Backrooms-genre fiction transforms mundane "
            "architecture (office corridors, empty pools) into existential horror. "
            "Marc Augé's 'non-places' — airports, highways, hotel rooms — are "
            "spaces of transience where identity becomes provisional. The Japanese "
            "concept of 'ma' (間) treats emptiness as a positive compositional element."
        ),
    },
    {
        "theme": "posthuman bodies and boundaries",
        "context": (
            "Donna Haraway's cyborg manifesto dissolves the boundary between human "
            "and machine. Body-modification subcultures (grinders, transhumanists) "
            "treat flesh as substrate. N. Katherine Hayles argues we became posthuman "
            "the moment information lost its body — virtuality precedes digital "
            "technology. Octavia Butler's Xenogenesis trilogy explores forced hybridity "
            "as both violation and evolution."
        ),
    },
    {
        "theme": "temporal economics",
        "context": (
            "Time-banking systems treat labor-hours as fungible currency. Michael "
            "Ende's 'Momo' describes grey men who convince citizens to save time, "
            "only to steal it. David Graeber's 'Bullshit Jobs' argues that modern "
            "economies manufacture meaningless work to absorb surplus labor. In "
            "accelerationist theory, capitalism devours the future to fuel the present."
        ),
    },
]


def _emulate_tavily(seed: str) -> str:
    """Generate deterministic, seed-aware research context without Tavily."""
    # Use seed hash to select 2-3 thematic lenses deterministically
    digest = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    n_lenses = len(_THEMATIC_LENSES)
    indices = [
        digest % n_lenses,
        (digest // n_lenses) % n_lenses,
        (digest // (n_lenses * n_lenses)) % n_lenses,
    ]
    # Deduplicate while preserving order
    seen: set[int] = set()
    unique: list[int] = []
    for i in indices:
        if i not in seen:
            seen.add(i)
            unique.append(i)

    parts = [f"Research seed: '{seed}'.\n"]
    for idx in unique:
        lens = _THEMATIC_LENSES[idx]
        parts.append(f"[{lens['theme'].upper()}]\n{lens['context']}\n")

    parts.append(
        f"Cross-reference: the seed concept '{seed}' resonates most strongly with "
        f"{_THEMATIC_LENSES[unique[0]]['theme']} as primary lens and "
        f"{_THEMATIC_LENSES[unique[-1]]['theme']} as secondary tension."
    )
    return "\n".join(parts)


class ResearchService:
    """Service for autonomous thematic research."""

    @classmethod
    async def search_thematic_context(cls, seed: str) -> str:
        """Perform deep web research using Tavily (or local emulator if key missing)."""
        if not tavily:
            logger.info("TAVILY_API_KEY missing. Using local research emulator.")
            return _emulate_tavily(seed)

        try:
            def _search():
                return tavily.search(query=seed, search_depth="advanced", include_answer=True)

            result = await anyio.to_thread.run_sync(_search)
            return result.get("answer") or str((result.get("results") or [])[:3])
        except Exception:
            logger.exception("Tavily search failed")
            return f"Search failed for '{seed}'. Fallback to base seed concepts."

    @classmethod
    async def research_for_lore(
        cls,
        seed: str,
        anchor: dict,
        astrolabe_context: str = "",
        openrouter_key: str | None = None,
    ) -> str:
        """Run deep LLM-based research to produce concept-lore-quality context.

        Uses a dedicated research agent to identify specific literary works,
        philosophical frameworks, and architectural vocabularies relevant to
        the world being created. Optionally augments with Tavily web search
        if a key is configured.

        Returns a synthesized research brief that feeds the BUREAU_ARCHIVIST_PROMPT.
        """
        title = anchor.get("title", "")
        core_question = anchor.get("core_question", "")
        literary_influence = anchor.get("literary_influence", "")
        description = anchor.get("description", "")

        parts: list[str] = []

        # Carry forward Astrolabe research if available
        if astrolabe_context:
            parts.append(f"[PRIOR ASTROLABE RESEARCH]\n{astrolabe_context}")

        # ── Primary: LLM research agent (cheap model) ────────────────
        research_agent = create_forge_agent(
            system_prompt=(
                "You are a research librarian specializing in comparative literature, "
                "philosophy, and architectural history. Your task is to produce a "
                "research brief that will ground worldbuilding lore in real intellectual "
                "traditions.\n\n"
                "For each research axis, cite SPECIFIC works, authors, movements, and "
                "dates. Do not invent references — only cite real sources. Be precise: "
                "author name, work title, year, and the specific concept or technique "
                "that applies.\n\n"
                "Format your output as three labeled sections:\n"
                "[LITERARY GENEALOGY] — 3-5 specific literary works/authors and what "
                "narrative techniques they contribute (e.g., unreliable narration, "
                "document fiction, competing accounts, institutional voice)\n\n"
                "[PHILOSOPHICAL FRAMEWORK] — 2-3 philosophical traditions or thinkers "
                "and how their concepts map to worldbuilding mechanics (e.g., "
                "epistemological instability → competing origin stories)\n\n"
                "[ARCHITECTURAL & VISUAL VOCABULARY] — 2-3 specific architectural "
                "movements, materials, and visual references with dates "
                "(e.g., Soviet Constructivism 1920s: Tatlin's Tower, El Lissitzky "
                "poster art; or Art Nouveau ironwork: Hector Guimard Métro entrances)\n\n"
                "Be rigorous. Cite real works. Connect each reference to a specific "
                "worldbuilding application."
            ),
            api_key=openrouter_key,
            purpose="research",
        )

        research_prompt = (
            f"Research the following world concept for a simulation lore scroll:\n\n"
            f"SEED: {seed}\n"
            f"ANCHOR TITLE: {title}\n"
            f"CORE QUESTION: {core_question}\n"
            f"LITERARY INFLUENCE: {literary_influence}\n"
            f"DESCRIPTION: {description}\n\n"
            f"Produce a research brief covering literary genealogy, philosophical "
            f"framework, and architectural/visual vocabulary for this world."
        )

        try:
            result = await research_agent.run(
                research_prompt,
                model_settings={"max_tokens": PYDANTIC_AI_MAX_TOKENS["research"]},
            )
            parts.append(f"[LLM RESEARCH]\n{result.output}")
            logger.debug("LLM lore research completed")
        except Exception:
            logger.exception("LLM lore research failed")

        # ── Optional: Tavily web search augmentation ────────────────
        if tavily:
            query = (
                f"{literary_influence} {core_question} {seed}"
                if literary_influence
                else f"{title} {core_question} literature philosophy"
            )
            try:
                def _search(q=query):
                    return tavily.search(
                        query=q, search_depth="advanced", include_answer=True,
                    )

                result = await anyio.to_thread.run_sync(_search)
                answer = result.get("answer", "")
                if answer:
                    parts.append(f"[WEB SEARCH AUGMENTATION]\n{answer}")
                    logger.debug("Tavily augmentation completed")
            except Exception:
                logger.exception("Tavily augmentation failed — continuing without")

        return "\n\n".join(parts)

    @classmethod
    async def generate_anchors(
        cls, seed: str, context: str, openrouter_key: str | None = None
    ) -> list[PhilosophicalAnchor]:
        """Generate 3 distinct philosophical angles using Pydantic AI."""

        agent = create_forge_agent(
            system_prompt=(
                "You are a Bureau Scholar from the Bureau of Impossible Geography. "
                "Your task is to analyze research data and propose 3 distinct 'Philosophical Anchors' "
                "for a new simulation shard. Each anchor must ground the shard in real-world "
                "literary, philosophical, or cultural theory. "
                "Avoid generic tropes; aim for intellectual rigor and surrealist depth."
            ),
            api_key=openrouter_key,
        )

        prompt = (
            f"Original Seed: {seed}\n\n"
            f"Research Context: {context}\n\n"
            "Propose 3 distinct philosophical anchors that could define this world.\n\n"
            "BILINGUAL OUTPUT: For every text field, also produce a German equivalent "
            "in the corresponding _de field (title_de, literary_influence_de, "
            "core_question_de, description_de). The German text should read as if "
            "originally written in German — not a literal translation."
        )

        result = await agent.run(
            prompt,
            output_type=list[PhilosophicalAnchor],
            model_settings={"max_tokens": PYDANTIC_AI_MAX_TOKENS["anchors"]},
        )
        # Patch empty _de fields with EN fallback so downstream never sees blanks
        incomplete = 0
        for anchor in result.output:
            patched = False
            if not anchor.title_de:
                anchor.title_de = anchor.title
                patched = True
            if not anchor.literary_influence_de:
                anchor.literary_influence_de = anchor.literary_influence
                patched = True
            if not anchor.core_question_de:
                anchor.core_question_de = anchor.core_question
                patched = True
            if not anchor.description_de:
                anchor.description_de = anchor.description
                patched = True
            if patched:
                incomplete += 1
        if incomplete:
            logger.warning(
                "Bilingual gap: %d/%d anchor(s) missing _de fields — patched with EN fallback",
                incomplete, len(result.output),
            )
        return result.output
