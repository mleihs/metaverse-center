"""Research service for the Simulation Forge (The Astrolabe).

Uses Pydantic AI for structured extraction from thematic context.
Tavily web searches are delegated to TavilySearchService for async,
timeout-protected, axis-targeted research grounding.
"""

from __future__ import annotations

import hashlib
import logging

import httpx
import sentry_sdk

from backend.dependencies import get_admin_supabase
from backend.models.forge import PhilosophicalAnchor
from backend.services.ai_utils import create_forge_agent, run_ai, validate_bilingual_output
from backend.services.external.tavily_search import (
    TavilySearchRequest,
    TavilySearchService,
)
from backend.services.platform_research_domains import get_research_domains

logger = logging.getLogger(__name__)

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


def _emulate_tavily_phase1(seed: str) -> str:
    """Generate deterministic, axis-structured research context without Tavily.

    Matches the dual-axis format produced by live Tavily Phase 1 searches.
    """
    digest = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    n_lenses = len(_THEMATIC_LENSES)
    indices = [
        digest % n_lenses,
        (digest // n_lenses) % n_lenses,
        (digest // (n_lenses * n_lenses)) % n_lenses,
    ]
    seen: set[int] = set()
    unique: list[int] = []
    for i in indices:
        if i not in seen:
            seen.add(i)
            unique.append(i)

    parts = [f"Research seed: '{seed}'.\n"]

    # Conceptual overview (first lens)
    lens0 = _THEMATIC_LENSES[unique[0]]
    parts.append(f"[CONCEPTUAL OVERVIEW]\n{lens0['context']}\n")

    # Intellectual traditions (remaining lenses)
    traditions = []
    for idx in unique[1:]:
        lens = _THEMATIC_LENSES[idx]
        traditions.append(f"{lens['theme']}: {lens['context']}")
    if traditions:
        parts.append("[INTELLECTUAL TRADITIONS]\n" + "\n".join(traditions) + "\n")

    parts.append(
        f"Cross-reference: the seed concept '{seed}' resonates most strongly with "
        f"{_THEMATIC_LENSES[unique[0]]['theme']} as primary lens and "
        f"{_THEMATIC_LENSES[unique[-1]]['theme']} as secondary tension."
    )
    return "\n".join(parts)


def _emulate_tavily_phase4(seed: str, anchor: dict) -> str:
    """Generate deterministic, tri-axis research context for Phase 4 emulation.

    Matches the axis-labeled format produced by live Tavily Phase 4 searches.
    """
    digest = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    n_lenses = len(_THEMATIC_LENSES)

    # Pick 3 different lenses for the 3 axes
    idx_lit = digest % n_lenses
    idx_phil = (digest // n_lenses) % n_lenses
    idx_arch = (digest // (n_lenses * n_lenses)) % n_lenses

    title = anchor.get("title", seed)
    literary = anchor.get("literary_influence", "")
    core_q = anchor.get("core_question", "")

    parts: list[str] = []

    lens_lit = _THEMATIC_LENSES[idx_lit]
    parts.append(f"[WEB: LITERARY AXIS]\nLiterary context for '{literary or title}': {lens_lit['context']}")

    lens_phil = _THEMATIC_LENSES[idx_phil]
    parts.append(f"[WEB: PHILOSOPHICAL AXIS]\nPhilosophical context for '{core_q or title}': {lens_phil['context']}")

    lens_arch = _THEMATIC_LENSES[idx_arch]
    parts.append(f"[WEB: ARCHITECTURAL AXIS]\nArchitectural context for '{title}': {lens_arch['context']}")

    return "\n\n".join(parts)


class ResearchService:
    """Service for autonomous thematic research."""

    @classmethod
    async def search_thematic_context(cls, seed: str) -> str:
        """Phase 1: Dual-axis web research using Tavily (or emulator fallback).

        Runs 2 parallel searches:
        - Conceptual: raw seed → encyclopedic domains → deep context
        - Intellectual: English-glossed seed → broader philosophy/literature sources
        """
        if not TavilySearchService.is_available():
            logger.warning(
                "Tavily unavailable — using deterministic emulator",
                extra={"seed_preview": seed[:60], "source": "emulator"},
            )
            return _emulate_tavily_phase1(seed)

        # Build English gloss for non-English seeds: strip to key nouns + context suffix
        english_gloss = f"{seed} philosophical literary context"

        requests = [
            TavilySearchRequest(
                axis="CONCEPTUAL OVERVIEW",
                query=seed,
                search_depth="advanced",
                max_results=5,
                include_domains=get_research_domains("encyclopedic"),
            ),
            TavilySearchRequest(
                axis="INTELLECTUAL TRADITIONS",
                query=english_gloss,
                search_depth="basic",
                max_results=3,
            ),
        ]

        results = await TavilySearchService.parallel_search(requests, timeout_s=10.0)

        if not results:
            logger.warning(
                "All Tavily Phase 1 searches failed — falling back to emulator",
                extra={"seed_preview": seed[:60]},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "astrolabe_research")
                scope.set_context("forge", {"seed_preview": seed[:60]})
                sentry_sdk.capture_message(
                    "Tavily fully unavailable in Phase 1 — emulator fallback",
                    level="warning",
                )
            return _emulate_tavily_phase1(seed)

        context = TavilySearchService.format_results(results)
        if not context:
            context = f"Web search returned no usable results for '{seed}'."

        logger.info(
            "Phase 1 research completed",
            extra={
                "seed_preview": seed[:60],
                "source": "tavily",
                "axes_completed": len(results),
                "result_length": len(context),
            },
        )
        return context

    @classmethod
    async def research_for_lore(
        cls,
        seed: str,
        anchor: dict,
        astrolabe_context: str = "",
        openrouter_key: str | None = None,
    ) -> str:
        """Phase 4: Deep LLM research + tri-axis Tavily augmentation.

        Uses a dedicated research agent for literary genealogy, philosophical
        framework, and architectural vocabulary. Augments with 3 axis-specific
        Tavily searches that feed each axis independently.

        Returns a synthesized research brief for the BUREAU_ARCHIVIST_PROMPT.
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

        # Bureau Ops Deferral A.2 — global + purpose enforcement.
        # research is platform-wide forge lore scaffolding; no simulation_id
        # exists yet (this runs pre-materialization) so only the first two
        # budget axes apply.
        admin_supabase = await get_admin_supabase()
        try:
            result = await run_ai(
                research_agent,
                research_prompt,
                "research",
                admin_supabase=admin_supabase,
            )
            parts.append(f"[LLM RESEARCH]\n{result.output}")
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "lore_research")
                scope.set_context("forge", {"seed": seed[:80], "anchor_title": title[:60]})
                sentry_sdk.capture_exception()
            logger.exception("LLM lore research failed")

        # ── Tri-axis Tavily web search augmentation ───────────────────
        if TavilySearchService.is_available():
            lit_query = (
                f"{literary_influence[:300]} literary analysis narrative technique"
                if literary_influence
                else f"{seed[:200]} literature narrative technique"
            )
            phil_query = (
                f"{core_question[:300]} philosophy epistemology"
                if core_question
                else f"{seed[:200]} philosophy epistemology"
            )
            # Build focused architecture query from title + literary influence, not raw description
            arch_seed = f"{title} {literary_influence}".strip()[:200] if literary_influence else title
            arch_query = f"{arch_seed} architecture movement materials visual style"

            requests = [
                TavilySearchRequest(
                    axis="WEB: LITERARY AXIS",
                    query=lit_query,
                    search_depth="advanced",
                    max_results=5,
                    include_domains=get_research_domains("literary"),
                ),
                TavilySearchRequest(
                    axis="WEB: PHILOSOPHICAL AXIS",
                    query=phil_query,
                    search_depth="advanced",
                    max_results=5,
                    include_domains=get_research_domains("philosophy"),
                ),
                TavilySearchRequest(
                    axis="WEB: ARCHITECTURAL AXIS",
                    query=arch_query,
                    search_depth="advanced",
                    max_results=4,
                    include_domains=get_research_domains("architecture"),
                ),
            ]

            results = await TavilySearchService.parallel_search(requests, timeout_s=20.0, max_retries=1)

            if results:
                augmentation = TavilySearchService.format_results(results)
                if augmentation:
                    parts.append(augmentation)
                    logger.info(
                        "Phase 4 tri-axis augmentation completed",
                        extra={
                            "axes_completed": len(results),
                            "total_length": len(augmentation),
                        },
                    )
            else:
                logger.warning("All Phase 4 Tavily searches failed — continuing with LLM research only")
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "lore_research_augmentation")
                    scope.set_context("forge", {"seed": seed[:80], "anchor_title": title[:60]})
                    sentry_sdk.capture_message(
                        "Tavily fully unavailable in Phase 4 — LLM research only",
                        level="warning",
                    )
        else:
            # Emulated augmentation for local development
            emulated = _emulate_tavily_phase4(seed, anchor)
            parts.append(emulated)
            logger.info("Phase 4 Tavily augmentation emulated (no API key)")

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

        # Bureau Ops Deferral A.2 — global + purpose enforcement
        # (same rationale as `research_for_lore` — pre-materialization path).
        admin_supabase = await get_admin_supabase()
        result = await run_ai(
            agent,
            prompt,
            "anchors",
            output_type=list[PhilosophicalAnchor],
            admin_supabase=admin_supabase,
        )
        # Patch empty _de fields with EN fallback so downstream never sees blanks
        anchor_de_fields = ["title_de", "literary_influence_de", "core_question_de", "description_de"]
        incomplete = validate_bilingual_output(result.output, anchor_de_fields, "anchor")
        logger.info(
            "Anchors generated",
            extra={"count": len(result.output), "bilingual_complete": incomplete == 0},
        )
        return result.output
