"""Unit tests for the DRIFT chart generator (pure graph design — no DB).

Guards the topology the 248 ring bug motivated: a generator DERIVED from real
simulation_connections must produce genuine DISTANCE (not the ring+hub's uniform 2 moves),
deep bands, vector-gated corridors, and a reachable-but-deep Tiefdrift frontier.
"""

from collections import deque

from backend.services.travel.chart_generator import (
    Connection,
    Embassy,
    World,
    build_chart,
    corridor_interior_count,
    freq_mask,
)

# The real relationship data (the 7 active template worlds + their 10 connections).
WORLDS = [
    World("v", "velgarien", "Velgarien"),
    World("g", "the-gaslit-reach", "The Gaslit Reach"),
    World("s", "station-null", "Station Null"),
    World("p", "speranza", "Speranza"),
    World("c", "cite-des-dames", "Cité des Dames"),
    World("x", "spengbabs-grease-pit", "Spengbab's Grease Pit"),  # isolated
    World("m", "conventional-memory", "Conventional Memory"),  # isolated
]
CONNECTIONS = [
    Connection("p", "c", ["language", "commerce"], 0.60),
    Connection("s", "c", ["resonance", "language"], 0.50),
    Connection("s", "p", ["resonance", "dream"], 0.60),
    Connection("g", "c", ["dream", "language"], 0.60),
    Connection("g", "s", ["memory", "desire"], 0.40),
    Connection("g", "p", ["architecture", "commerce"], 0.50),
    Connection("v", "g", ["memory", "architecture"], 0.70),
    Connection("v", "s", ["dream", "resonance"], 0.50),
    Connection("v", "c", ["language", "memory"], 0.70),
    Connection("v", "p", ["commerce", "language"], 0.60),
]


def _build():
    return build_chart(WORLDS, CONNECTIONS, [], seed=42)


def _adjacency(draft):
    adj: dict[str, list[str]] = {n["stable_key"]: [] for n in draft.nodes}
    for e in draft.edges:
        adj[e["from_key"]].append(e["to_key"])
        adj[e["to_key"]].append(e["from_key"])
    return adj


def _dist(adj, src):
    dist = {src: 0}
    q = deque([src])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in dist:
                dist[v] = dist[u] + 1
                q.append(v)
    return dist


def test_freq_mask_bit_order():
    assert freq_mask(["commerce"]) == 1
    assert freq_mask(["memory"]) == 4  # bit 2
    assert freq_mask(["memory", "architecture"]) == 4 + 16  # the P0 pair = 20


def test_corridor_length_scales_inversely_with_strength():
    from backend.services.travel.chart_generator import ChartTuning

    t = ChartTuning()
    strong = corridor_interior_count(0.70, t)
    weak = corridor_interior_count(0.40, t)
    assert strong < weak  # strong connection = shorter corridor
    assert t.corridor_min <= strong <= t.corridor_max
    assert t.corridor_min <= weak <= t.corridor_max


def test_one_home_per_world():
    draft = _build()
    homes = [n for n in draft.nodes if n["node_type"] == "broadcast_rand"]
    assert len(homes) == len(WORLDS)
    assert all(h["simulation_id"] is not None for h in homes)
    # one home per sim (the uq_chart_home_node invariant the move RPCs assume)
    assert len({h["simulation_id"] for h in homes}) == len(WORLDS)


def test_distances_are_not_collapsed():
    """The whole point: worlds are genuinely FAR (the ring+hub made everything 2 moves)."""
    draft = _build()
    adj = _adjacency(draft)
    d_from_velg = _dist(adj, "home-velgarien")
    # the strongest connection (Velgarien↔Gaslit, 0.70) is the NEAREST world, but still > 2
    assert d_from_velg["home-the-gaslit-reach"] >= 3
    # at least one world is a genuine long haul (>= 6 moves one-way)
    home_keys = [n["stable_key"] for n in draft.nodes if n["node_type"] == "broadcast_rand"]
    assert max(d_from_velg[k] for k in home_keys) >= 6


def test_deep_band_exists():
    draft = _build()
    bands = {n["distance_band"] for n in draft.nodes}
    assert "deep" in bands and "mid" in bands and "near" in bands


def test_corridor_permeability_from_bleed_vectors():
    """A corridor edge is permeable on its connection's bleed vectors (and only those)."""
    draft = _build()
    corridor_edges = [e for e in draft.edges if e["corridor"]]
    assert corridor_edges
    # the Velgarien↔Gaslit corridor must be permeable on memory/architecture
    vg = [
        e
        for e in corridor_edges
        if "velgarien" in e["from_key"] + e["to_key"] or "gaslit" in e["from_key"] + e["to_key"]
    ]
    assert any(set(e["permeability"]) == {"memory", "architecture"} for e in vg)


def test_isolated_worlds_are_reachable_only_via_deep_off_vector():
    """Tiefdrift frontier: unconnected worlds are reachable, but via a raw (empty-permeability)
    deep edge — never a cheap corridor."""
    draft = _build()
    adj = _adjacency(draft)
    d = _dist(adj, "home-velgarien")
    for iso in ("home-spengbabs-grease-pit", "home-conventional-memory"):
        assert iso in d  # reachable
    # the edges TOUCHING an isolated home must be raw deep crossings (no permeable vector)
    for iso in ("home-spengbabs-grease-pit", "home-conventional-memory"):
        touching = [e for e in draft.edges if iso in (e["from_key"], e["to_key"])]
        assert touching
        assert all(e["permeability"] == {} and not e["corridor"] for e in touching)


def test_ward_drops_a_vector_from_permeability():
    """An embassy ward_vector on a pair removes that vector from the corridor's permeability."""
    embassies = [Embassy("v", "g", ward_vector="memory")]
    draft = build_chart(WORLDS, CONNECTIONS, embassies, seed=42)
    vg = [
        e
        for e in draft.edges
        if e["corridor"] and ("velgarien" in e["from_key"] or "velgarien" in e["to_key"])
        if "gaslit" in e["from_key"] or "gaslit" in e["to_key"]
    ]
    # the Velg↔Gaslit corridor now rides architecture only (memory warded)
    assert vg
    assert all("memory" not in e["permeability"] for e in vg)


def test_deterministic():
    a = build_chart(WORLDS, CONNECTIONS, [], seed=42)
    b = build_chart(WORLDS, CONNECTIONS, [], seed=42)
    assert a.nodes == b.nodes
    assert a.edges == b.edges
