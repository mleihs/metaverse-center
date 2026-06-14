"""DRIFT chart generator (plan §8.1) — derive the travel topology from the platform's
real inter-world relationships.

The 248 SQL generator placed worlds on a synthetic ring with a central spoke-hub, which
collapsed every distance to ~2 moves (no journey, no route choice, the whole resource/
window/Dissonanz pressure inert). This is the plan's intended generator: a seeded
deterministic Python builder whose graph is DERIVED from `simulation_connections` (and
`embassies`), laid out force-directed, written atomically via `fn_apply_drift_chart`
(geometry in Python, the single SQL write — the ForgeMapService / ADR-007 pattern).

Topology rules (the design):
- One broadcast_rand HOME per active template sim. A home's frequency_mask is the union
  of its connections' bleed vectors (what it broadcasts on).
- Each active simulation_connection becomes a CORRIDOR of interstitial nodes — NOT one
  edge (one edge would make the dense connection graph ~1 hop; a corridor makes worlds
  genuinely far). Corridor length comes from `strength` (strong → short/shallow, weak →
  long/deep); edge permeability comes from `bleed_vectors` (you must tune to a corridor's
  vector to cross it cheaply); an embassy `ward_vector` on the pair is dropped from
  permeability (a warded frequency can't be ridden cheaply). distance_band deepens toward
  the corridor's middle (more Dissonanz + surge the deeper you push).
- Worlds with NO connection are the TIEFDRIFT FRONTIER: reachable only via a deep, raw
  off-vector crossing from the nearest corridor's deep midpoint — the gamble prize.
- A few deep cross-cuts link far corridors' deep midpoints — the "riskant-tief" shortcut
  (skip the long way round at high Bandbreite/Dissonanz/surge cost) without a universal hub.

`build_chart` is pure + deterministic (seeded) and returns stable-key-referenced nodes +
edges; the service reads the DB, calls it, and hands the result to fn_apply_drift_chart.
"""

from __future__ import annotations

import logging
import math
import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # keep the pure builder section below free of framework imports
    from supabase import AsyncClient

logger = logging.getLogger(__name__)

# The 7 bleed vectors in concept §6.1 bit order (mirrors frontend palette.FREQUENCIES +
# the drift_chart_nodes.frequency_mask bits + travel_runs.frequency).
FREQUENCIES: tuple[str, ...] = (
    "commerce",
    "language",
    "memory",
    "resonance",
    "architecture",
    "dream",
    "desire",
)
_FREQ_BIT = {v: i for i, v in enumerate(FREQUENCIES)}


def freq_mask(vectors: list[str]) -> int:
    """OR the 7-bit frequency mask for a set of bleed vectors (renderer tint + window)."""
    mask = 0
    for v in vectors:
        bit = _FREQ_BIT.get(v)
        if bit is not None:
            mask |= 1 << bit
    return mask


# ── Tuning (mirrored into drift_tuning; build_chart takes them as params) ────────────


@dataclass(frozen=True)
class ChartTuning:
    """Generator knobs (the DB projection lives in drift_tuning.chart_gen)."""

    corridor_min: int = 2  # interior nodes for the strongest connection
    corridor_max: int = 7  # interior nodes for the weakest
    # interior = round(corridor_min + (strength_ref - strength) * corridor_slope), clamped.
    strength_ref: float = 0.70
    corridor_slope: float = 13.0
    deep_weight: int = 3  # raw-Drift / frontier / cross-cut edge weight (Bandbreite-hungry)
    corridor_weight: int = 1  # on-vector corridor edge weight
    home_radius: float = 1400.0  # initial home ring radius (chart units; camera auto-frames)
    layout_iterations: int = 500
    cross_cuts: int = 3  # deep shortcut edges between far corridors' deep midpoints
    frontier_chain: int = 2  # raw deep interstitials between a frontier world and the chart
    # (a single edge can land a frontier world as near as a connected one — a chain keeps
    #  the Tiefdrift frontier a genuine deep haul, not a cheap back door)


# ── Inputs / output shapes ───────────────────────────────────────────────────────


@dataclass(frozen=True)
class World:
    id: str
    slug: str
    name: str


@dataclass(frozen=True)
class Connection:
    a_id: str
    b_id: str
    bleed_vectors: list[str]
    strength: float


@dataclass(frozen=True)
class Embassy:
    a_id: str
    b_id: str
    ward_vector: str | None = None


@dataclass
class ChartDraft:
    nodes: list[dict] = field(default_factory=list)
    edges: list[dict] = field(default_factory=list)


# ── Helpers ──────────────────────────────────────────────────────────────────────


def corridor_interior_count(strength: float, t: ChartTuning) -> int:
    """Interior node count for a corridor: strong connection → short/shallow, weak → long."""
    raw = round(t.corridor_min + (t.strength_ref - strength) * t.corridor_slope)
    return max(t.corridor_min, min(t.corridor_max, raw))


def _band_for_fraction(f: float) -> str:
    """Distance band by position along a corridor (0..1): near at the ends, deep in the
    middle (the farther into the Bleed, the more Dissonanz the move RPC accrues)."""
    edge_dist = min(f, 1.0 - f)
    if edge_dist < 0.22:
        return "near"
    if edge_dist > 0.40:
        return "deep"
    return "mid"


def _pair_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


# ── Force-directed home layout (seeded, deterministic) ───────────────────────────


def _layout_homes(
    world_ids: list[str], springs: list[tuple[str, str, float]], seed: int, t: ChartTuning
) -> dict[str, list[float]]:
    """A small Fruchterman-Reingold layout: Coulomb repulsion on all home pairs + Hooke
    springs on connections (rest length ∝ corridor length, so weak/long connections sit
    farther apart). Seeded init + fixed iteration count = viewport-independent + stable."""
    rng = random.Random(seed)  # noqa: S311 — deterministic layout PRNG, not cryptographic
    n = len(world_ids)
    pos: dict[str, list[float]] = {}
    for i, wid in enumerate(world_ids):
        ang = 2 * math.pi * i / n + rng.uniform(-0.25, 0.25)
        rad = t.home_radius * (1.0 + rng.uniform(-0.12, 0.12))
        pos[wid] = [rad * math.cos(ang), rad * math.sin(ang)]

    k_rep = (t.home_radius**2) * 2.4  # repulsion strength (keeps homes apart)
    k_spring = 0.018  # Hooke stiffness
    cool = 1.0
    for _ in range(t.layout_iterations):
        disp: dict[str, list[float]] = {wid: [0.0, 0.0] for wid in world_ids}
        for i in range(n):
            for j in range(i + 1, n):
                a, b = world_ids[i], world_ids[j]
                dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
                d2 = dx * dx + dy * dy + 1e-6
                d = math.sqrt(d2)
                f = k_rep / d2
                ux, uy = dx / d, dy / d
                disp[a][0] += ux * f
                disp[a][1] += uy * f
                disp[b][0] -= ux * f
                disp[b][1] -= uy * f
        for a, b, rest in springs:
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            d = math.sqrt(dx * dx + dy * dy) + 1e-6
            f = (d - rest) * k_spring
            ux, uy = dx / d, dy / d
            disp[a][0] -= ux * f
            disp[a][1] -= uy * f
            disp[b][0] += ux * f
            disp[b][1] += uy * f
        # apply with cooling + a step cap so a close repulsion pair can't explode
        max_step = t.home_radius * 0.10 * cool
        for wid in world_ids:
            mag = math.hypot(disp[wid][0], disp[wid][1]) + 1e-9
            step = min(mag, max_step)
            pos[wid][0] += disp[wid][0] / mag * step
            pos[wid][1] += disp[wid][1] / mag * step
        cool = max(0.05, cool * 0.992)
    return pos


# ── The builder ──────────────────────────────────────────────────────────────────


def build_chart(
    worlds: list[World],
    connections: list[Connection],
    embassies: list[Embassy],
    seed: int,
    tuning: ChartTuning | None = None,
) -> ChartDraft:
    """Pure, deterministic. Returns stable-key-referenced nodes + edges for
    fn_apply_drift_chart to write atomically as a new chart_version."""
    t = tuning or ChartTuning()
    rng = random.Random(seed ^ 0x5F3759DF)  # noqa: S311 — deterministic, not cryptographic
    by_id = {w.id: w for w in worlds}
    draft = ChartDraft()

    # Ward lookup (an embassy's warded vector can't be ridden cheaply on that pair).
    ward: dict[tuple[str, str], str] = {}
    for e in embassies:
        if e.ward_vector:
            ward[_pair_key(e.a_id, e.b_id)] = e.ward_vector

    # A home's broadcast mask = union of its connections' vectors.
    home_vectors: dict[str, set[str]] = {w.id: set() for w in worlds}
    connected: set[str] = set()
    for c in connections:
        if c.a_id in by_id and c.b_id in by_id:
            home_vectors[c.a_id].update(c.bleed_vectors)
            home_vectors[c.b_id].update(c.bleed_vectors)
            connected.add(c.a_id)
            connected.add(c.b_id)

    # Force-directed layout over the CONNECTED homes; rest length ∝ corridor length.
    connected_ids = [w.id for w in worlds if w.id in connected]
    springs = [
        (c.a_id, c.b_id, t.home_radius * (0.5 + 0.18 * corridor_interior_count(c.strength, t)))
        for c in connections
        if c.a_id in connected and c.b_id in connected
    ]
    pos = _layout_homes(connected_ids, springs, seed, t) if connected_ids else {}

    # Cluster centroid (to fling the frontier worlds outward).
    if pos:
        cx = sum(p[0] for p in pos.values()) / len(pos)
        cy = sum(p[1] for p in pos.values()) / len(pos)
    else:
        cx = cy = 0.0

    # Frontier (unconnected) homes: placed far on the fringe.
    isolated = [w for w in worlds if w.id not in connected]
    for k, w in enumerate(isolated):
        ang = 2 * math.pi * (k + 0.5) / max(1, len(isolated)) + rng.uniform(-0.3, 0.3)
        rad = t.home_radius * 2.6
        pos[w.id] = [cx + rad * math.cos(ang), cy + rad * math.sin(ang)]

    # Emit HOME nodes.
    for w in worlds:
        x, y = pos.get(w.id, [0.0, 0.0])
        draft.nodes.append(
            {
                "stable_key": f"home-{w.slug}",
                "node_type": "broadcast_rand",
                "simulation_id": w.id,
                "x": round(x, 2),
                "y": round(y, 2),
                "frequency_mask": freq_mask(sorted(home_vectors[w.id])) or 127,
                "distance_band": "near",
                "region_cell": "r0",
            }
        )

    # CORRIDORS: one chain of interstitials per connection.
    corridor_deep_keys: list[tuple[str, list[float]]] = []  # (deepest node key, its pos)
    for c in connections:
        if c.a_id not in by_id or c.b_id not in by_id:
            continue
        a, b = by_id[c.a_id], by_id[c.b_id]
        n_int = corridor_interior_count(c.strength, t)
        ax, ay = pos[a.id]
        bx, by_ = pos[b.id]
        # perpendicular unit (for a seeded bow so corridors don't all overlap as straight lines)
        dx, dy = bx - ax, by_ - ay
        length = math.hypot(dx, dy) + 1e-9
        px, py = -dy / length, dx / length
        bow = length * rng.uniform(0.06, 0.20) * (1 if rng.random() < 0.5 else -1)

        # permeability vectors = the connection's bleed vectors, minus any warded one.
        warded = ward.get(_pair_key(c.a_id, c.b_id))
        perm_vecs = [v for v in c.bleed_vectors if v != warded] or list(c.bleed_vectors)
        perm = dict.fromkeys(perm_vecs, 1.0)
        cmask = freq_mask(c.bleed_vectors)

        prev_key = f"home-{a.slug}"
        deepest: tuple[float, str, list[float]] | None = None  # (edge_dist, key, pos)
        for i in range(n_int):
            f = (i + 1) / (n_int + 1)
            # quadratic bow: peak at the middle
            bow_amt = bow * (1 - (2 * f - 1) ** 2)
            x = ax + dx * f + px * bow_amt
            y = ay + dy * f + py * bow_amt
            key = f"corr-{a.slug}--{b.slug}-{i}"
            band = _band_for_fraction(f)
            draft.nodes.append(
                {
                    "stable_key": key,
                    "node_type": "interstitial",
                    "simulation_id": None,
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "frequency_mask": cmask or 127,
                    "distance_band": band,
                    "region_cell": "r0",
                }
            )
            draft.edges.append(
                {
                    "from_key": prev_key,
                    "to_key": key,
                    "weight": t.corridor_weight,
                    "permeability": perm,
                    "corridor": True,
                }
            )
            prev_key = key
            ed = min(f, 1 - f)
            if deepest is None or ed > deepest[0]:
                deepest = (ed, key, [x, y])
        # close the corridor into home b
        draft.edges.append(
            {
                "from_key": prev_key,
                "to_key": f"home-{b.slug}",
                "weight": t.corridor_weight,
                "permeability": perm,
                "corridor": True,
            }
        )
        if deepest is not None:
            corridor_deep_keys.append((deepest[1], deepest[2]))

    # TIEFDRIFT FRONTIER: each isolated world hangs off the nearest corridor deep node via a
    # CHAIN of raw, off-vector (empty permeability → always off-vector → Bandbreite-hungry)
    # deep nodes. A single edge could land a frontier world as near as a connected one; the
    # chain keeps the frontier a genuine deep haul — the gamble prize.
    for w in isolated:
        wx, wy = pos[w.id]
        nearest = min(
            corridor_deep_keys,
            key=lambda dk: (dk[1][0] - wx) ** 2 + (dk[1][1] - wy) ** 2,
            default=None,
        )
        if nearest is None:
            continue
        nx, ny = nearest[1]
        prev_key = nearest[0]
        for i in range(t.frontier_chain):
            f = (i + 1) / (t.frontier_chain + 1)
            cxp, cyp = nx + (wx - nx) * f, ny + (wy - ny) * f
            key = f"front-{w.slug}-{i}"
            draft.nodes.append(
                {
                    "stable_key": key,
                    "node_type": "interstitial",
                    "simulation_id": None,
                    "x": round(cxp, 2),
                    "y": round(cyp, 2),
                    "frequency_mask": 127,  # raw tissue, no single vector — neutral full
                    "distance_band": "deep",
                    "region_cell": "r0",
                }
            )
            draft.edges.append(
                {
                    "from_key": prev_key,
                    "to_key": key,
                    "weight": t.deep_weight,
                    "permeability": {},
                    "corridor": False,
                }
            )
            prev_key = key
        draft.edges.append(
            {
                "from_key": prev_key,
                "to_key": f"home-{w.slug}",
                "weight": t.deep_weight,
                "permeability": {},  # no vector permeable → raw Drift, always off-vector
                "corridor": False,
            }
        )

    # DEEP CROSS-CUTS: a few off-vector links between FAR corridors' deep midpoints — the
    # "riskant-tief" gamble (skip the long way) without recreating a universal hub.
    if len(corridor_deep_keys) >= 4 and t.cross_cuts > 0:
        m = len(corridor_deep_keys)
        step = max(2, m // 2)
        seen: set[tuple[str, str]] = set()
        made = 0
        for i in range(m):
            if made >= t.cross_cuts:
                break
            j = (i + step) % m
            ka, kb = corridor_deep_keys[i][0], corridor_deep_keys[j][0]
            if ka == kb:
                continue
            pk = _pair_key(ka, kb)
            if pk in seen:
                continue
            seen.add(pk)
            draft.edges.append(
                {
                    "from_key": ka,
                    "to_key": kb,
                    "weight": t.deep_weight,
                    "permeability": {},
                    "corridor": False,
                }
            )
            made += 1

    return draft


# ════════════════════════════════════════════════════════════════════════════════
# I/O orchestration — read the real relationships, build, write atomically
# ════════════════════════════════════════════════════════════════════════════════
# build_chart above is pure (no DB, no framework — unit-tested in isolation,
# test_drift_chart_generator.py). This service is the thin orchestrator, mirroring
# ForgeMapService: read the source rows → call the pure builder → hand the result to
# the single atomic SQL writer (fn_apply_drift_chart, migration 251). NO
# fetch-compute-update — the layout is the Python work, persistence is one RPC
# (ADR-007 / Postgres-first).

# A fixed default seed → regenerating with unchanged worlds/connections reproduces an
# identical layout (only the chart_version increments). Pass a seed to reshuffle.
DEFAULT_CHART_SEED = 20260614

# Stamped onto chart_versions.generator_version so a chart's provenance is legible.
GENERATOR_VERSION = "derived-topology-1"


class ChartGeneratorService:
    """Reads the platform's active worlds + their real relationships, derives the
    travel topology (build_chart), and writes it atomically as a new chart_version."""

    @staticmethod
    async def regenerate(admin_client: AsyncClient, seed: int | None = None) -> dict:
        """Regenerate the chart from the CURRENT active template sims +
        simulation_connections + embassies; emits a new chart_version. service_role
        only (fn_apply_drift_chart is backend-class). Returns the writer's
        {version, worlds, nodes, edges} summary. The <2-worlds / empty-nodes guards are
        the SQL writer's (single authority) — this stays a thin read→build→write."""
        effective_seed = DEFAULT_CHART_SEED if seed is None else seed

        sims_resp = await (
            admin_client.table("simulations")
            .select("id, slug, name")
            .eq("status", "active")
            .eq("simulation_type", "template")
            .execute()
        )
        worlds = [
            World(id=r["id"], slug=r["slug"], name=r["name"]) for r in (sims_resp.data or [])
        ]

        conn_resp = await (
            admin_client.table("simulation_connections")
            .select("simulation_a_id, simulation_b_id, bleed_vectors, strength")
            .eq("is_active", True)
            .execute()
        )
        connections = [
            Connection(
                a_id=r["simulation_a_id"],
                b_id=r["simulation_b_id"],
                bleed_vectors=list(r["bleed_vectors"]),
                strength=float(r["strength"]),
            )
            for r in (conn_resp.data or [])
        ]

        emb_resp = await (
            admin_client.table("embassies")
            # ward_vector (migration 191) is the player's opt-in defensive ward (usually
            # NULL), which build_chart drops from corridor permeability. NOT bleed_vector
            # (the embassy's thematic channel, set on every embassy) — reading that would
            # ward every pair and invert the opt-in design.
            .select("simulation_a_id, simulation_b_id, ward_vector")
            .eq("status", "active")
            .execute()
        )
        embassies = [
            Embassy(
                a_id=r["simulation_a_id"],
                b_id=r["simulation_b_id"],
                ward_vector=r["ward_vector"],
            )
            for r in (emb_resp.data or [])
        ]

        draft = build_chart(worlds, connections, embassies, seed=effective_seed)

        resp = await admin_client.rpc(
            "fn_apply_drift_chart",
            {
                "p_seed": effective_seed,
                "p_generator_version": GENERATOR_VERSION,
                "p_nodes": draft.nodes,
                "p_edges": draft.edges,
            },
        ).execute()
        if not resp.data or not isinstance(resp.data, dict):
            raise RuntimeError(f"fn_apply_drift_chart returned unexpected payload: {resp.data!r}")

        logger.info(
            "drift.chart.regenerated worlds=%d connections=%d embassies=%d -> %r",
            len(worlds),
            len(connections),
            len(embassies),
            resp.data,
        )
        return resp.data


