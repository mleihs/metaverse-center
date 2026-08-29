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

    # ── Board fitting (see _normalise_layout) ────────────────────────────────────
    # The force layout settles into whatever shape the seed happens to produce; without a
    # frame that shape is an accident, and an accidental 1:4 ribbon in a 2:1 viewport is
    # framed by its long axis and covers ~10 % of the board's width. The original
    # Fruchterman-Reingold algorithm draws inside a bounded W x H frame for exactly this
    # reason; these three knobs are that frame.
    board_width: float = 3000.0  # canonical width the finished cloud is scaled to
    target_aspect: float = 1.60  # w/h the board is fitted to — the play surface's aspect
    #   (the viewport minus the HUD gutter, ~1000x630 on a desktop board)
    max_stretch: float = 2.50  # cap on the anisotropic scale, so the fit never caricatures
    #   the graph's own proportions; beyond it the board simply stays a little letterboxed
    min_separation: float = 0.055  # closest two nodes may sit, as a fraction of board_width
    #   (~0.055 * 850 px of drawn width = 47 px, clear of the 44 px WCAG coarse-pointer tap
    #    target, so no two nodes can ever share a finger)
    separation_iterations: int = 120


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


def _normalise_layout(nodes: list[dict], t: ChartTuning) -> None:
    """Fit the finished point cloud onto the board — in place, on every node.

    `_layout_homes` is a Fruchterman-Reingold relaxation, and the original algorithm draws
    into a bounded W x H frame. This implementation dropped the frame, so the drawing's
    proportions were whatever the seed settled on. Measured on chart_version 4 (7 worlds,
    48 nodes): the cloud came out 1854 x 7103 units — aspect 0.26, a tall thin ribbon. The
    camera fits both axes, so in a 2.15-aspect viewport that ribbon is framed by its HEIGHT
    and covers **10.4 % of the board's width**; 42 of 48 nodes then sit inside another
    node's 30 px click radius (median nearest-neighbour: 20.7 px), and half the board is
    empty. Both complaints — "everything is cramped" and "so much empty space" — are the
    same number.

    This is the frame, in three steps, and it changes NOTHING but the drawing:

    1. **Principal axis → horizontal.** A rigid rotation, so every distance, every corridor
       bow and the whole visual grammar of the graph survive exactly. This step alone takes
       the measured chart from 10.4 % to 62.7 % width coverage: the cloud was never badly
       shaped, only badly oriented.
    2. **Aspect fit,** capped at `max_stretch`. A bounded anisotropic scale toward
       `target_aspect`. Capped, because past a point a stretch stops fitting the graph and
       starts caricaturing it — a letterboxed board is better than a smeared one.
    3. **Minimum separation.** A few relaxation passes that push apart only the pairs closer
       than `min_separation`. Steps 1-2 fix the board; they cannot fix two corridor
       interiors that the layout stacked on top of each other (measured minimum: 1.4 px).
       A move is a commitment — it spends a Takt, Bandbreite and Dissonanz and draws a
       signal — so the board owes the player an unambiguous answer to "which node am I
       clicking". Two nodes inside one tap target cannot give it.

    x/y are presentation only: `distance_band` comes from a node's fraction along its
    corridor and `frequency_mask` from its vectors, so nothing here touches gameplay data.
    The last step scales the cloud to `board_width`, which is what lets `min_separation`
    be a plain ratio instead of a number that means something different on every chart.
    """
    if len(nodes) < 2:
        return

    pts = [[float(n["x"]), float(n["y"])] for n in nodes]
    n_pts = len(pts)

    # ── 1. Rigid rotation onto the principal axis ────────────────────────────────
    cx = sum(p[0] for p in pts) / n_pts
    cy = sum(p[1] for p in pts) / n_pts
    for p in pts:
        p[0] -= cx
        p[1] -= cy
    sxx = sum(p[0] * p[0] for p in pts) / n_pts
    syy = sum(p[1] * p[1] for p in pts) / n_pts
    sxy = sum(p[0] * p[1] for p in pts) / n_pts
    # The covariance eigenvector angle. atan2 keeps it stable when sxx == syy (a round
    # cloud), where the axis is arbitrary and any answer is as good as any other.
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    cos_t, sin_t = math.cos(-theta), math.sin(-theta)
    for p in pts:
        p[0], p[1] = p[0] * cos_t - p[1] * sin_t, p[0] * sin_t + p[1] * cos_t

    def _extent() -> tuple[float, float]:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return max(xs) - min(xs), max(ys) - min(ys)

    # ── 2. Bounded aspect fit ────────────────────────────────────────────────────
    width, height = _extent()
    if width > 1e-6 and height > 1e-6:
        # Clamp the correction both ways: a cloud that is already wider than the target is
        # squeezed back, one that is taller is pulled open — never by more than max_stretch.
        k = t.target_aspect / (width / height)
        k = min(max(k, 1.0 / t.max_stretch), t.max_stretch)
        if k >= 1.0:
            for p in pts:
                p[0] *= k
        else:
            for p in pts:
                p[1] /= k

    # ── 3. Into the frame, and apart inside it ───────────────────────────────────
    # This is the bounded W x H frame the FR algorithm draws into. The relaxation below
    # pushes crowded pairs apart and the frame catches them — which is what makes the two
    # halves of the complaint one fix: the push fills the empty space, the wall stops the
    # cloud from simply inflating past the board instead of spreading inside it.
    frame_w = t.board_width
    frame_h = t.board_width / t.target_aspect

    width, height = _extent()
    if width > 1e-6 and height > 1e-6:
        scale = min(frame_w / width, frame_h / height)
        for p in pts:
            p[0] *= scale
            p[1] *= scale

    half_w, half_h = frame_w / 2, frame_h / 2

    def _recentre() -> None:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        mx = (max(xs) + min(xs)) / 2
        my = (max(ys) + min(ys)) / 2
        for p in pts:
            p[0] -= mx
            p[1] -= my

    _recentre()

    min_sep = t.min_separation * t.board_width
    if min_sep > 0:
        for _ in range(t.separation_iterations):
            moved = False
            for i in range(n_pts):
                for j in range(i + 1, n_pts):
                    dx = pts[j][0] - pts[i][0]
                    dy = pts[j][1] - pts[i][1]
                    d = math.hypot(dx, dy)
                    if d >= min_sep:
                        continue
                    moved = True
                    if d < 1e-6:
                        # Exactly coincident: no direction to push along, so deal one out
                        # of the pair's index. Deterministic, and any axis will do.
                        ang = 2 * math.pi * ((i * 7 + j * 13) % n_pts) / n_pts
                        ux, uy = math.cos(ang), math.sin(ang)
                        d = 1e-6
                    else:
                        ux, uy = dx / d, dy / d
                    # Half the deficit each, so the pair's midpoint stays put and a corridor
                    # interior does not walk off its own corridor.
                    push = (min_sep - d) * 0.5
                    pts[i][0] -= ux * push
                    pts[i][1] -= uy * push
                    pts[j][0] += ux * push
                    pts[j][1] += uy * push
            # The wall. Clamping inside the loop (not once at the end) is what turns the
            # push into a SPREAD: a node driven against the edge cannot keep going, so the
            # next pass redistributes its neighbours along the frame instead of letting the
            # whole cloud inflate — and the board fills from the middle outwards.
            for p in pts:
                p[0] = min(half_w, max(-half_w, p[0]))
                p[1] = min(half_h, max(-half_h, p[1]))
            if not moved:
                break

    _recentre()

    for node, p in zip(nodes, pts, strict=True):
        node["x"] = round(p[0], 2)
        node["y"] = round(p[1], 2)


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

    # Every node is placed by now (homes, corridor interiors, frontier chains) — fit the
    # finished cloud onto the board. Last, because a normalisation that ran before the
    # frontier chains were appended would leave them outside the frame it just established.
    _normalise_layout(draft.nodes, t)

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
# Bumped when the DRAWING changed: `_normalise_layout` fits the finished cloud into a bounded
# frame (principal axis, capped aspect, minimum separation), so a chart built after this point
# is a different picture of the same topology than one built before it. The version is the only
# way to tell the two apart after the fact.
GENERATOR_VERSION = "framed-topology-2"


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
        worlds = [World(id=r["id"], slug=r["slug"], name=r["name"]) for r in (sims_resp.data or [])]

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
