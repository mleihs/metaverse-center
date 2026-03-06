"""Research service for the Simulation Forge (The Astrolabe).

Uses Pydantic AI for structured extraction from thematic context.
"""

from __future__ import annotations

import hashlib
import logging

import anyio
from pydantic_ai import Agent
from tavily import TavilyClient

from backend.config import settings
from backend.models.forge import PhilosophicalAnchor
from backend.services.ai_utils import get_openrouter_model

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
        except Exception as e:
            logger.error("Tavily search failed: %s", e)
            return f"Search failed for '{seed}'. Fallback to base seed concepts."

    @classmethod
    async def generate_anchors(
        cls, seed: str, context: str, openrouter_key: str | None = None
    ) -> list[PhilosophicalAnchor]:
        """Generate 3 distinct philosophical angles using Pydantic AI."""

        agent = Agent(
            get_openrouter_model(openrouter_key),
            output_type=list[PhilosophicalAnchor],
            system_prompt=(
                "You are a Bureau Scholar from the Bureau of Impossible Geography. "
                "Your task is to analyze research data and propose 3 distinct 'Philosophical Anchors' "
                "for a new simulation shard. Each anchor must ground the shard in real-world "
                "literary, philosophical, or cultural theory. "
                "Avoid generic tropes; aim for intellectual rigor and surrealist depth."
            ),
        )

        prompt = (
            f"Original Seed: {seed}\n\n"
            f"Research Context: {context}\n\n"
            "Propose 3 distinct philosophical anchors that could define this world."
        )

        result = await agent.run(prompt)
        return result.output
