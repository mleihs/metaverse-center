"""Research service for the Simulation Forge (The Astrolabe).

Die Recherche laeuft in vier Schritten, und jeder davon existiert, weil der
Schritt davor allein nicht reicht:

1. **Uebersetzen.** Der Seed ist eine Erzaehlpraemisse. Eine Suchmaschine, der
   man eine Praemisse gibt, antwortet mit fiktionsfoermigem Material. Ein
   billiger Modellaufruf macht daraus Fachvokabular (``ResearchQueryPlan``).
2. **Suchen bei Diensten, deren Bestand die Schranke ist.** OpenAlex,
   Open Library, Crossref fuehren nur Aufsaetze und Buecher
   (``ScholarlySearchService``).
3. **Suchen im Netz, mit Schranke.** Tavily, jetzt mit
   ``include_domains_mode="filter"`` — das ist der Unterschied zwischen einer
   Domainliste, die gewichtet, und einer, die ausschliesst.
4. **Entscheiden.** Jede Zeile aus 2 und 3 laeuft durch
   ``research_source_policy.filter_sources``. Was nicht durchkommt, verschwindet
   aus BEIDEM: aus der Quellenliste unter der Ankerkarte und aus der Prosa, die
   das Modell liest.

Schritt 4 ist der Grund, warum die Prosa hier gebaut wird und nicht mehr in
``TavilySearchService``. Bis 2026-09-04 entstanden Liste und Prosa auf zwei
getrennten Wegen aus demselben Treffer; ein Filter auf nur einem Weg saeubert
die Anzeige und laesst den Fanwiki-Artikel trotzdem die Lore praegen.

Siehe ``docs/plans/forge-scholarly-sources.md``.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass, field

import httpx
import sentry_sdk

from backend.dependencies import get_admin_supabase
from backend.models.forge import PhilosophicalAnchor, ResearchQueryPlan, counted_list
from backend.services.ai_utils import (
    MODEL_CALL_ERRORS,
    create_forge_agent,
    key_source_for,
    report_delivery_count,
    run_ai,
    validate_bilingual_output,
)
from backend.services.external.scholarly_search import (
    PROVIDER_NAMES,
    ScholarlyRequest,
    ScholarlySearchService,
)
from backend.services.external.tavily_search import (
    TavilySearchRequest,
    TavilySearchResult,
    TavilySearchService,
)
from backend.services.platform_research_domains import get_research_domains, get_source_denylist
from backend.services.research_source_policy import SourceRow, filter_sources

logger = logging.getLogger(__name__)

# How many anchors a scan offers, and the point below which a scan is not a
# choice any more. Both live here rather than in the prompt text: the count is
# now interpolated into the two prompts AND handed to the output type, so the
# number cannot drift between what is asked for and what is validated.
# See finding 10.
_ANCHOR_COUNT = 3
_ANCHOR_MINIMUM = 2

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
            "maps to the broken-window thesis – visible decay as a self-reinforcing "
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
            "as antidote – David Brin's 'The Transparent Society' argues that "
            "privacy is already dead; the question is who watches the watchers."
        ),
    },
    {
        "theme": "liminal spaces and thresholds",
        "context": (
            "Victor Turner's liminality describes transitional states where normal "
            "social structures dissolve. Backrooms-genre fiction transforms mundane "
            "architecture (office corridors, empty pools) into existential horror. "
            "Marc Augé's 'non-places' – airports, highways, hotel rooms – are "
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
            "the moment information lost its body – virtuality precedes digital "
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


# ── Die Achsen ───────────────────────────────────────────────────────────────
#
# Die Achsenbezeichnung ist kein Etikett: sie steht unter jeder Quelle auf der
# Ankerkarte und sagt dem Leser, welche Frage diese Quelle beantwortet hat.
# Bis 2026-09-04 hiessen die beiden Phase-1-Achsen CONCEPTUAL OVERVIEW und
# INTELLECTUAL TRADITIONS — Namen fuer eine Suche, die noch das ganze Netz
# meinte. Die drei hier benennen Gattungen, und das ist jetzt auch das, was
# gesucht wird.
AXIS_LITERARY = "LITERARY SCHOLARSHIP"
AXIS_PHILOSOPHICAL = "PHILOSOPHICAL TRADITION"
AXIS_SCHOLARLY = "SCHOLARLY CONTEXT"
AXIS_ARCHITECTURAL = "ARCHITECTURAL HISTORY"

_QUERY_PLANNER_PROMPT = (
    "You turn a fictional world premise into search terms for scholarly "
    "databases (OpenAlex, Crossref, Open Library) and for a domain-restricted "
    "web search over academic publishers.\n\n"
    "Rules that decide whether the search works at all:\n"
    "- Name a CONCEPT, THEORY, MOVEMENT or standing DEBATE, never a bare "
    "discipline. 'collective memory and forgetting' finds Connerton and Olick; "
    "'memory studies' also finds a paper on dementia prevalence.\n"
    "- Never reuse the premise's own nouns as the search term, and never name a "
    "fictional entity from it. You are naming the real scholarship the premise "
    "touches, not the premise.\n"
    "- A named author or work is allowed and often best, when an obvious "
    "canonical one exists.\n"
    "- English only, 2-6 words per term.\n"
)


@dataclass(frozen=True, slots=True)
class ThematicResearch:
    """What Phase 1 found: the prose the model reads, and what was fetched.

    The two are deliberately separate. ``context`` is prose and goes to the
    model; ``sources`` are the rows the providers actually returned, so the
    claim on the anchor card has something behind it that a reader can open.
    Nothing in ``sources`` passes through a model. See finding 17.

    ``source`` sagt, welcher Weg tatsaechlich getragen hat. Der Aufrufer hat das
    bis 2026-09-04 selbst geraten (``"tavily" if settings.tavily_api_key``) —
    eine Behauptung ueber die Konfiguration, kein Bericht ueber den Lauf: bei
    gesetztem Schluessel und drei fehlgeschlagenen Suchen stand dort trotzdem
    "tavily". ``rejected`` zaehlt, was die Gattungsgrenze abgewiesen hat; null
    zugelassene Quellen sind ein Ereignis, kein leeres Feld.
    """

    context: str
    sources: list[dict[str, str]]
    source: str = "scholarly"
    rejected: int = 0
    terms: list[str] = field(default_factory=list)


def _compose_context(answers: list[tuple[str, str]], rows: list[SourceRow]) -> str:
    """Die Prosa, die das Modell liest — aus dem, was die Schranke durchliess.

    Reihenfolge: erst die Zusammenfassungen, die Tavily je Achse geschrieben
    hat, dann die Belege derselben Achse. Ein Modell liest das Letzte am
    genauesten (siehe ``last-thing-wins-in-a-prompt``), und das Letzte soll hier
    die pruefbare Bibliographie sein, nicht die Zusammenfassung eines Dienstes.
    """
    by_axis: dict[str, list[SourceRow]] = {}
    for row in rows:
        by_axis.setdefault(row.axis, []).append(row)

    blocks: list[str] = []
    for axis, answer in answers:
        if answer:
            blocks.append(f"[{axis} – SUMMARY]\n{answer}")
    for axis, axis_rows in by_axis.items():
        blocks.append(ScholarlySearchService.format_rows(axis, axis_rows))
    return "\n\n".join(b for b in blocks if b)


class ResearchService:
    """Service for autonomous thematic research."""

    @classmethod
    async def plan_queries(cls, subject: str, openrouter_key: str | None = None) -> ResearchQueryPlan | None:
        """Uebersetzt eine Erzaehlpraemisse in Suchbegriffe. ``None`` bei Ausfall.

        Der Ausfall ist kein Abbruch: der Aufrufer sucht dann mit der Praemisse
        selbst weiter. Das ist messbar schlechter (gemessen: JSTOR und ein
        Wikipedia-Eintrag zur Vergessenskurve statt Connerton und Crampton),
        aber es bleibt innerhalb der Gattungsgrenze — die haengt an der
        Schranke, nicht an der Anfrage.
        """
        agent = create_forge_agent(
            system_prompt=_QUERY_PLANNER_PROMPT,
            api_key=openrouter_key,
            purpose="research_query",
        )
        admin_supabase = await get_admin_supabase()
        try:
            result = await run_ai(
                agent,
                f"PREMISE: {subject}",
                "research_query",
                output_type=ResearchQueryPlan,
                admin_supabase=admin_supabase,
                key_source=key_source_for(openrouter_key),
            )
        except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "research_query_plan")
                scope.set_context("forge", {"subject_preview": subject[:80]})
                sentry_sdk.capture_exception()
            logger.warning("Query planning failed – falling back to the raw premise as query")
            return None

        logger.info("Research queries planned", extra={"terms": result.output.all_terms()})
        return result.output

    @classmethod
    async def _gather(
        cls,
        scholarly_requests: list[ScholarlyRequest],
        tavily_requests: list[TavilySearchRequest],
        *,
        phase: str,
        scholarly_timeout_s: float = 12.0,
        tavily_timeout_s: float = 10.0,
        tavily_retries: int = 0,
    ) -> tuple[str, list[SourceRow], int]:
        """Beide Suchwege, die Schranke, und die Prosa daraus.

        Gibt ``(prosa, zugelassene_zeilen, abgewiesene_anzahl)``. Beide Wege
        laufen auch dann, wenn einer ausfaellt — Tavily braucht einen Schluessel,
        die Fachdienste nicht, und genau darum darf ein fehlender Tavily-
        Schluessel die Recherche nicht mehr auf den Emulator werfen.
        """
        scholarly_results, tavily_results = await asyncio.gather(
            ScholarlySearchService.parallel_search(scholarly_requests, timeout_s=scholarly_timeout_s),
            cls._tavily(tavily_requests, timeout_s=tavily_timeout_s, max_retries=tavily_retries),
        )

        rows: list[SourceRow] = [row for result in scholarly_results for row in result.rows]
        rows.extend(TavilySearchService.to_rows(tavily_results))

        outcome = filter_sources(rows, trusted_providers=PROVIDER_NAMES)
        if outcome.rejected:
            # Nicht nur zaehlen: die Hosts stehen im Protokoll, weil eine
            # Sperrliste nur findet, was man ihr gesagt hat. Was hier auftaucht,
            # ist der Vorschlag fuer den naechsten Eintrag.
            logger.info(
                "Sources rejected by genre policy",
                extra={
                    "forge_phase": phase,
                    "rejected": len(outcome.rejected),
                    "kept": len(outcome.kept),
                    "hosts": outcome.rejected_hosts[:20],
                },
            )
        if not outcome.kept:
            # Ein Lauf ohne zugelassene Quelle sieht von aussen aus wie ein
            # Lauf ohne Treffer. Er ist es nicht, und die Unterscheidung ist
            # die zwischen "nichts gefunden" und "alles verworfen".
            logger.warning(
                "Research produced no admissible sources",
                extra={"forge_phase": phase, "fetched": len(rows), "rejected": len(outcome.rejected)},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", phase)
                scope.set_context("forge", {"fetched": len(rows), "rejected": len(outcome.rejected)})
                sentry_sdk.capture_message("Research returned no admissible sources", level="warning")

        context = _compose_context(TavilySearchService.answers(tavily_results), outcome.kept)
        return context, outcome.kept, len(outcome.rejected)

    @staticmethod
    async def _tavily(
        requests: list[TavilySearchRequest], *, timeout_s: float, max_retries: int
    ) -> list[TavilySearchResult]:
        """Tavily, oder nichts — ohne Schluessel ist das kein Fehlerfall mehr."""
        if not requests or not TavilySearchService.is_available():
            return []
        return await TavilySearchService.parallel_search(requests, timeout_s=timeout_s, max_retries=max_retries)

    @classmethod
    async def search_thematic_context(cls, seed: str, openrouter_key: str | None = None) -> ThematicResearch:
        """Phase 1: drei Gattungsachsen ueber Fachdienste und gefiltertes Tavily."""
        plan = await cls.plan_queries(seed, openrouter_key)
        literary = plan.literary if plan else [seed]
        philosophical = plan.philosophical if plan else [seed]
        scholarly = plan.scholarly if plan else [seed]
        deny = get_source_denylist()

        scholarly_requests = [
            # Buecher zuerst: auf der literarischen Achse liegen Werke, nicht
            # Aufsaetze ueber Werke. Ohne Rueckfallebene — Crossref fuehrt keine
            # Belletristik, es waere ein Ersatz, der die Achse verfehlt.
            ScholarlyRequest(
                axis=AXIS_LITERARY,
                terms=tuple(literary[:2]),
                providers=("openlibrary", "openalex"),
                fallback=None,
                max_results=3,
            ),
            ScholarlyRequest(
                axis=AXIS_PHILOSOPHICAL,
                terms=tuple(philosophical[:2]),
                providers=("openalex",),
                max_results=3,
            ),
            ScholarlyRequest(
                axis=AXIS_SCHOLARLY,
                terms=tuple(scholarly[:2]),
                providers=("openalex",),
                max_results=3,
            ),
        ]
        tavily_requests = [
            TavilySearchRequest(
                axis=AXIS_PHILOSOPHICAL,
                query=" ".join(philosophical[:2]),
                search_depth="advanced",
                max_results=4,
                include_domains=get_research_domains("philosophy"),
                exclude_domains=deny,
            ),
            TavilySearchRequest(
                axis=AXIS_SCHOLARLY,
                query=" ".join(scholarly[:2]),
                search_depth="advanced",
                max_results=4,
                include_domains=get_research_domains("encyclopedic"),
                exclude_domains=deny,
            ),
        ]

        context, kept, rejected = await cls._gather(scholarly_requests, tavily_requests, phase="astrolabe_research")

        if not context:
            logger.warning(
                "Phase 1 research empty – using deterministic emulator",
                extra={"seed_preview": seed[:60], "source": "emulator"},
            )
            return ThematicResearch(
                context=_emulate_tavily_phase1(seed),
                sources=[],
                source="emulator",
                rejected=rejected,
                terms=plan.all_terms() if plan else [],
            )

        logger.info(
            "Phase 1 research completed",
            extra={
                "seed_preview": seed[:60],
                "source": "scholarly",
                "result_length": len(context),
                "sources": len(kept),
                "rejected": rejected,
            },
        )
        return ThematicResearch(
            context=context,
            sources=[row.as_dict() for row in kept],
            source="scholarly",
            rejected=rejected,
            terms=plan.all_terms() if plan else [],
        )

    @classmethod
    async def research_for_lore(
        cls,
        seed: str,
        anchor: dict,
        astrolabe_context: str = "",
        openrouter_key: str | None = None,
    ) -> str:
        """Phase 4: gefundene Bibliographie zuerst, danach die Deutung.

        Die Reihenfolge ist die Aenderung. Bis 2026-09-04 schrieb das Modell
        seinen Rechercheentwurf ZUERST, aus dem Gedaechtnis, und die Websuche
        wurde hinterher angehaengt — das Modell konnte also gar nicht zitieren,
        was tatsaechlich gefunden wurde. Jetzt laufen die Suchen zuerst, und
        die Trefferliste steht im Prompt: das Modell ordnet ein, was da ist,
        statt zu erinnern, was es geben koennte.

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

        # ── Suchen: drei Gattungsachsen, Fachdienste + gefiltertes Tavily ─────
        plan = await cls.plan_queries(
            " ".join(p for p in (title, core_question, literary_influence) if p) or seed,
            openrouter_key,
        )
        literary_terms = plan.literary if plan else [literary_influence or seed]
        philosophical_terms = plan.philosophical if plan else [core_question or seed]
        scholarly_terms = plan.scholarly if plan else [seed]
        deny = get_source_denylist()

        # Die Architekturachse fragt nach ArchitekturGESCHICHTE, nicht nach
        # Architektur: `sah.org`, JSTOR, Getty statt `dezeen.com` und
        # `designboom.com`. Der Ersatz beschreibt Bauten datiert und benannt,
        # zeigt sie aber nicht — die visuelle Achse verliert Bildmaterial und
        # gewinnt Vokabular. Das ist die bewusste Wahl, nicht ein Versehen.
        arch_query = f"{' '.join(scholarly_terms[:1])} architectural history movement materials"

        found_context, found_rows, rejected = await cls._gather(
            [
                ScholarlyRequest(
                    axis=AXIS_LITERARY,
                    terms=tuple(literary_terms[:2]),
                    providers=("openlibrary", "openalex"),
                    fallback=None,
                    max_results=3,
                ),
                ScholarlyRequest(
                    axis=AXIS_PHILOSOPHICAL,
                    terms=tuple(philosophical_terms[:2]),
                    providers=("openalex",),
                    max_results=3,
                ),
                ScholarlyRequest(
                    axis=AXIS_ARCHITECTURAL,
                    terms=(arch_query,),
                    providers=("openalex",),
                    max_results=3,
                ),
            ],
            [
                TavilySearchRequest(
                    axis=AXIS_LITERARY,
                    query=" ".join(literary_terms[:2]),
                    search_depth="advanced",
                    max_results=5,
                    include_domains=get_research_domains("literary"),
                    exclude_domains=deny,
                ),
                TavilySearchRequest(
                    axis=AXIS_PHILOSOPHICAL,
                    query=" ".join(philosophical_terms[:2]),
                    search_depth="advanced",
                    max_results=5,
                    include_domains=get_research_domains("philosophy"),
                    exclude_domains=deny,
                ),
                TavilySearchRequest(
                    axis=AXIS_ARCHITECTURAL,
                    query=arch_query,
                    search_depth="advanced",
                    max_results=4,
                    include_domains=get_research_domains("architecture"),
                    exclude_domains=deny,
                ),
            ],
            phase="lore_research",
            scholarly_timeout_s=15.0,
            tavily_timeout_s=20.0,
            tavily_retries=1,
        )

        if found_context:
            parts.append(found_context)
            logger.info(
                "Phase 4 sources gathered",
                extra={"sources": len(found_rows), "rejected": rejected, "length": len(found_context)},
            )
        else:
            emulated = _emulate_tavily_phase4(seed, anchor)
            parts.append(emulated)
            logger.info("Phase 4 augmentation emulated (no admissible sources)")

        # ── Deutung: LLM research agent (cheap model) ────────────────
        research_agent = create_forge_agent(
            system_prompt=(
                "You are a research librarian specializing in comparative literature, "
                "philosophy, and architectural history. Your task is to produce a "
                "research brief that will ground worldbuilding lore in real intellectual "
                "traditions.\n\n"
                "For each research axis, cite SPECIFIC works, authors, movements, and "
                "dates. Do not invent references – only cite real sources. Be precise: "
                "author name, work title, year, and the specific concept or technique "
                "that applies.\n\n"
                "The prompt carries a RETRIEVED BIBLIOGRAPHY: real records fetched from "
                "OpenAlex, Crossref, Open Library and a search restricted to academic "
                "publishers. Those records are the only ones whose author, year and "
                "venue are verified. Build your brief on them first and reproduce their "
                "details exactly; add a work from your own knowledge only where the "
                "bibliography leaves an axis unserved, and never restate a retrieved "
                "record with different details.\n\n"
                "Format your output as three labeled sections:\n"
                "[LITERARY GENEALOGY] – 3-5 specific literary works/authors and what "
                "narrative techniques they contribute (e.g., unreliable narration, "
                "document fiction, competing accounts, institutional voice)\n\n"
                "[PHILOSOPHICAL FRAMEWORK] – 2-3 philosophical traditions or thinkers "
                "and how their concepts map to worldbuilding mechanics (e.g., "
                "epistemological instability → competing origin stories)\n\n"
                "[ARCHITECTURAL & VISUAL VOCABULARY] – 2-3 specific architectural "
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
            f"RETRIEVED BIBLIOGRAPHY:\n{found_context or '(nothing retrieved)'}\n\n"
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
                key_source=key_source_for(openrouter_key),
            )
            parts.append(f"[LLM RESEARCH]\n{result.output}")
        except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "lore_research")
                scope.set_context("forge", {"seed": seed[:80], "anchor_title": title[:60]})
                sentry_sdk.capture_exception()
            logger.exception("LLM lore research failed")

        return "\n\n".join(parts)

    @classmethod
    async def generate_anchors(
        cls, seed: str, context: str, openrouter_key: str | None = None
    ) -> list[PhilosophicalAnchor]:
        """Generate ``_ANCHOR_COUNT`` distinct philosophical angles using Pydantic AI."""

        agent = create_forge_agent(
            system_prompt=(
                "You are a Bureau Scholar from the Bureau of Impossible Geography. "
                f"Your task is to analyze research data and propose {_ANCHOR_COUNT} distinct "
                "'Philosophical Anchors' "
                "for a new simulation shard. Each anchor must ground the shard in real-world "
                "literary, philosophical, or cultural theory. "
                "Avoid generic tropes; aim for intellectual rigor and surrealist depth.\n\n"
                "The research context lists real works retrieved from scholarly databases "
                "and from a search restricted to academic publishers -- author, year, venue, "
                "DOI. Draw `literary_influence` from that list wherever it serves the anchor, "
                "and reproduce author and title exactly as given. Naming a work that is not "
                "in the list is allowed only when none of them fits; naming one that IS in "
                "the list with different details is not."
            ),
            api_key=openrouter_key,
            purpose="anchors",
        )

        prompt = (
            f"Original Seed: {seed}\n\n"
            f"Research Context: {context}\n\n"
            f"Propose {_ANCHOR_COUNT} distinct philosophical anchors that could define this world.\n\n"
            "BILINGUAL OUTPUT: For every text field, also produce a German equivalent "
            "in the corresponding _de field (title_de, literary_influence_de, "
            "core_question_de, description_de). The German text should read as if "
            "originally written in German – not a literal translation."
        )

        # Bureau Ops Deferral A.2 — global + purpose enforcement
        # (same rationale as `research_for_lore` — pre-materialization path).
        admin_supabase = await get_admin_supabase()
        result = await run_ai(
            agent,
            prompt,
            "anchors",
            # Two anchors are a choice the user can still make; one is not. The
            # ceiling stops a fourth from costing a scan's tokens. See finding 10.
            output_type=counted_list(PhilosophicalAnchor, _ANCHOR_COUNT, minimum=_ANCHOR_MINIMUM),
            admin_supabase=admin_supabase,
            key_source=key_source_for(openrouter_key),
        )
        # Patch empty _de fields with EN fallback so downstream never sees blanks
        anchor_de_fields = ["title_de", "literary_influence_de", "core_question_de", "description_de"]
        incomplete = validate_bilingual_output(result.output, anchor_de_fields, "anchor")
        report_delivery_count("anchor", _ANCHOR_COUNT, len(result.output))
        logger.info(
            "Anchors generated",
            extra={"count": len(result.output), "bilingual_complete": incomplete == 0},
        )
        return result.output
