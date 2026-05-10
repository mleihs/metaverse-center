"""Pure-Python geometry generators for ForgeMapService — testable in isolation.

Per the project Postgres-first principle: this module ONLY builds geometry. It
does NOT touch Supabase. The result is handed to fn_apply_map_geometry
(migration 236) for atomic persistence.

Determinism contract: every public function takes a seed (str) and a sorted
list of inputs. Internal RNG is `random.Random(seed)`. All set/dict iteration
that affects output goes through explicit sorting first, so PYTHONHASHSEED
does not influence results.
"""

from __future__ import annotations

import hashlib
import math
import random
import uuid
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import voronoi_diagram

from backend.models.world_map import (
    BuildingGeometryPatch,
    CityGeometryPatch,
    MapGeometryPayload,
    StreetGeometryInsert,
    ZoneGeometryPatch,
)

# ── Constants ────────────────────────────────────────────────────────────────
# A 0.01° square is ~1.1 km on a side at the equator — small enough that
# Mercator distortion is negligible, large enough to see at zoom 16.
_CITY_PATCH_SIZE_DEG = 0.01

# Multi-city layout: cities tile horizontally with a small gap.
_CITY_GAP_DEG = 0.005

# Layout origin (fictional, near 0,0) — keeps all simulations in the same
# uninhabited Atlantic-equator region so MapLibre Mercator math stays clean.
_ORIGIN_LAT = 0.5
_ORIGIN_LNG = 0.5

# Recursive subdivision depth for medieval_walled streets.
# Each level doubles block count: depth 3 → up to 8 blocks per zone.
_MEDIEVAL_SUBDIVISION_DEPTH = 3

# UUID5 namespace for deterministic street IDs (random but constant).
_STREET_UUID_NAMESPACE = uuid.UUID("8e6d7c4f-1234-5678-9abc-def012345678")


# ── Input dataclasses ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CityInput:
    id: UUID
    name: str
    population: int
    layout_type: str | None = None


@dataclass(frozen=True)
class ZoneInput:
    id: UUID
    city_id: UUID
    name: str
    zone_type: str  # 'residential', 'government', 'industrial', etc.
    population_estimate: int


@dataclass(frozen=True)
class BuildingInput:
    id: UUID
    zone_id: UUID | None
    name: str
    building_type: str


# ── Public entry: medieval_walled preset ─────────────────────────────────────


def generate_medieval_walled(
    seed: str,
    cities: list[CityInput],
    zones: list[ZoneInput],
    buildings: list[BuildingInput],
) -> MapGeometryPayload:
    """Generate a medieval-walled-city style map.

    Pseudo-Mercator patch per city (fictional 0.01° square at ~origin), zone
    polygons via direct quadrant assignment (≤4 zones) or Lloyd-relaxed
    Voronoi (>4), recursive grid subdivision for streets, building snap to
    nearest street edge.

    Returns the full MapGeometryPayload, ready to hand to fn_apply_map_geometry.
    Raises ValueError if the polygon-containment invariant fails for any
    placed building.
    """
    rng = random.Random(seed)

    # Deterministic input order — every list iteration that affects output is
    # explicitly sorted. PYTHONHASHSEED is irrelevant.
    cities_sorted = sorted(cities, key=lambda c: c.id)
    zones_by_city: dict[UUID, list[ZoneInput]] = {}
    for z in sorted(zones, key=lambda z: z.id):
        zones_by_city.setdefault(z.city_id, []).append(z)
    buildings_by_zone: dict[UUID, list[BuildingInput]] = {}
    for b in sorted(buildings, key=lambda b: b.id):
        if b.zone_id is not None:
            buildings_by_zone.setdefault(b.zone_id, []).append(b)

    payload = MapGeometryPayload()
    invariant_failures: list[str] = []

    for city_idx, city in enumerate(cities_sorted):
        city_polygon, city_lat, city_lng = _build_city_patch(city_idx)
        payload.cities.append(
            CityGeometryPatch(
                id=city.id,
                map_center_lat=city_lat,
                map_center_lng=city_lng,
            )
        )

        zone_inputs = zones_by_city.get(city.id, [])
        if not zone_inputs:
            continue

        zone_polygons = _assign_zone_polygons(city_polygon, zone_inputs, rng)

        for zone in zone_inputs:
            polygon = zone_polygons[zone.id]
            payload.zones.append(ZoneGeometryPatch(id=zone.id, geojson=mapping(polygon)))

            # Streets for this zone — IDs and cut positions both derived from
            # (user_seed, city.id, zone.id). The user seed MUST be in the token
            # so that changing the seed actually changes the street layout.
            streets = _subdivide_into_blocks(
                polygon=polygon,
                depth=_MEDIEVAL_SUBDIVISION_DEPTH,
                seed_token=f"{seed}|{city.id}|{zone.id}",
                city_id=city.id,
                zone_id=zone.id,
            )
            payload.streets.extend(streets)

            # Buildings in this zone snap to street edges
            zone_buildings = buildings_by_zone.get(zone.id, [])
            for building in zone_buildings:
                point, street_id = _snap_building_to_street(
                    building=building,
                    streets=streets,
                    zone_polygon=polygon,
                    rng=_zone_rng(seed, zone.id, building.id),
                )
                if not polygon.contains(point):
                    invariant_failures.append(f"building {building.id} ({building.name}) point not in zone {zone.id}")
                payload.buildings.append(
                    BuildingGeometryPatch(
                        id=building.id,
                        geojson=mapping(point),
                        street_id=street_id,
                    )
                )

    if invariant_failures:
        raise ValueError(
            "ForgeMapService invariant violation — "
            f"{len(invariant_failures)} building(s) outside their zone polygon: " + "; ".join(invariant_failures[:5])
        )

    return payload


# ── City patch placement ─────────────────────────────────────────────────────


def _build_city_patch(city_idx: int) -> tuple[Polygon, float, float]:
    """Return (polygon, center_lat, center_lng) for the city's patch.

    Cities tile horizontally with a small gap. For typical sims with 1-2
    cities, all coordinates stay near the (_ORIGIN_LAT, _ORIGIN_LNG) anchor.
    """
    half = _CITY_PATCH_SIZE_DEG / 2
    offset_x = city_idx * (_CITY_PATCH_SIZE_DEG + _CITY_GAP_DEG)
    center_lng = _ORIGIN_LNG + offset_x
    center_lat = _ORIGIN_LAT
    polygon = box(
        center_lng - half,
        center_lat - half,
        center_lng + half,
        center_lat + half,
    )
    return polygon, center_lat, center_lng


# ── Zone polygon assignment ──────────────────────────────────────────────────

# zone_type → centrality preference. Higher = wants to be near city center.
# Used to bias which zone gets which quadrant slot.
_ZONE_CENTRALITY: dict[str, int] = {
    "government": 10,
    "religious": 9,
    "commercial": 7,
    "residential": 5,
    "military": 4,
    "industrial": 2,
    "slums": 1,
    "ruins": 0,
}


def _assign_zone_polygons(
    city_polygon: Polygon,
    zones: list[ZoneInput],
    rng: random.Random,
) -> dict[UUID, Polygon]:
    """Assign each zone a polygon inside the city patch.

    For ≤4 zones: deterministic quadrant assignment ordered by zone-type
    centrality (so government lands in the desired slot, slums on periphery).

    For >4 zones: Lloyd-relaxed Voronoi diagram with seed points weighted by
    population_estimate.
    """
    if len(zones) <= 4:
        return _assign_quadrant_zones(city_polygon, zones)
    return _assign_voronoi_zones(city_polygon, zones, rng)


def _assign_quadrant_zones(
    city_polygon: Polygon,
    zones: list[ZoneInput],
) -> dict[UUID, Polygon]:
    """Deterministic quadrant slicing for 1-4 zones."""
    minx, miny, maxx, maxy = city_polygon.bounds
    midx = (minx + maxx) / 2
    midy = (miny + maxy) / 2

    # Available slot polygons in priority order: center→periphery for 4 zones,
    # half-splits for 2-3.
    if len(zones) == 1:
        slots = [city_polygon]
    elif len(zones) == 2:
        slots = [
            box(minx, midy, maxx, maxy),  # north
            box(minx, miny, maxx, midy),  # south
        ]
    elif len(zones) == 3:
        # North half is one zone; south splits east/west
        slots = [
            box(minx, midy, maxx, maxy),  # north (most central feel)
            box(minx, miny, midx, midy),  # SW
            box(midx, miny, maxx, midy),  # SE
        ]
    else:  # len == 4
        slots = [
            box(minx, midy, midx, maxy),  # NW
            box(midx, midy, maxx, maxy),  # NE
            box(minx, miny, midx, midy),  # SW
            box(midx, miny, maxx, midy),  # SE
        ]

    # Assign by zone-type centrality: highest centrality goes to slot[0].
    # Ties broken by zone.id for determinism.
    zones_ranked = sorted(
        zones,
        key=lambda z: (-_ZONE_CENTRALITY.get(z.zone_type, 5), z.id),
    )
    return {z.id: slots[i] for i, z in enumerate(zones_ranked)}


def _assign_voronoi_zones(
    city_polygon: Polygon,
    zones: list[ZoneInput],
    rng: random.Random,
) -> dict[UUID, Polygon]:
    """Voronoi-based zone assignment for >4 zones.

    Seed points are placed deterministically: each zone gets a point at
    (centrality_radius, angle_index*2pi/n) in polar coordinates, with the
    angle index determined by zone.id sort order.
    """
    minx, miny, maxx, maxy = city_polygon.bounds
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    radius_max = min(maxx - minx, maxy - miny) / 2 * 0.7

    zones_sorted = sorted(zones, key=lambda z: z.id)
    seed_points: list[Point] = []
    for i, zone in enumerate(zones_sorted):
        # Centrality 0-10 → radius (most central = smallest radius)
        centrality = _ZONE_CENTRALITY.get(zone.zone_type, 5)
        r = radius_max * (1.0 - centrality / 10.0) * 0.9 + radius_max * 0.05
        angle = (i / len(zones_sorted)) * 2 * math.pi
        # Tiny jitter to avoid coincident points (Voronoi degenerates)
        jitter_x = (rng.random() - 0.5) * radius_max * 0.05
        jitter_y = (rng.random() - 0.5) * radius_max * 0.05
        seed_points.append(Point(cx + r * math.cos(angle) + jitter_x, cy + r * math.sin(angle) + jitter_y))

    # Voronoi → clip each cell to city polygon
    from shapely.geometry import MultiPoint

    voronoi = voronoi_diagram(MultiPoint(seed_points), envelope=city_polygon)
    cells = list(voronoi.geoms)

    # Match cells to seed points (cell that contains the point)
    result: dict[UUID, Polygon] = {}
    for i, zone in enumerate(zones_sorted):
        seed_pt = seed_points[i]
        matched = next((c for c in cells if c.contains(seed_pt)), None)
        if matched is None:
            # Fallback: nearest cell
            matched = min(cells, key=lambda c: c.distance(seed_pt))
        clipped = matched.intersection(city_polygon)
        # If intersection returns a MultiPolygon, take the largest piece
        if clipped.geom_type == "MultiPolygon":
            clipped = max(clipped.geoms, key=lambda p: p.area)
        result[zone.id] = clipped

    return result


# ── Street network: recursive subdivision ────────────────────────────────────

_STREET_TYPE_BY_DEPTH = ["arterial", "secondary", "tertiary", "alley"]


def _subdivide_into_blocks(
    polygon: Polygon,
    depth: int,
    seed_token: str,
    city_id: UUID,
    zone_id: UUID,
) -> list[StreetGeometryInsert]:
    """Recursively split a zone polygon into blocks; cut lines become streets.

    Each level alternates the cut direction (longer axis first) with a small
    jitter applied deterministically from seed_token + segment hash.
    """
    streets: list[StreetGeometryInsert] = []
    street_idx = 0
    rng = random.Random(seed_token)

    def _split(poly: Polygon, current_depth: int) -> None:
        nonlocal street_idx
        if current_depth >= depth or poly.area < 1e-8:
            return

        minx, miny, maxx, maxy = poly.bounds
        width = maxx - minx
        height = maxy - miny
        # Cut the longer axis; alternate at depth-equal sizes
        cut_horizontal = width >= height

        # Jittered cut position (40-60% of axis), deterministic per call
        cut_frac = 0.4 + rng.random() * 0.2

        if cut_horizontal:
            cut_x = minx + width * cut_frac
            cut_line = LineString([(cut_x, miny), (cut_x, maxy)])
            half_a = box(minx, miny, cut_x, maxy).intersection(poly)
            half_b = box(cut_x, miny, maxx, maxy).intersection(poly)
        else:
            cut_y = miny + height * cut_frac
            cut_line = LineString([(minx, cut_y), (maxx, cut_y)])
            half_a = box(minx, miny, maxx, cut_y).intersection(poly)
            half_b = box(minx, cut_y, maxx, maxy).intersection(poly)

        # Clip cut line to polygon → only the part inside this zone is a street
        clipped = cut_line.intersection(poly)
        if clipped.geom_type == "LineString" and clipped.length > 1e-8:
            streets.append(
                _make_street(
                    line=clipped,
                    depth=current_depth,
                    city_id=city_id,
                    zone_id=zone_id,
                    seed_token=seed_token,
                    street_idx=street_idx,
                )
            )
            street_idx += 1
        elif clipped.geom_type == "MultiLineString":
            for seg in clipped.geoms:
                if seg.length > 1e-8:
                    streets.append(
                        _make_street(
                            line=seg,
                            depth=current_depth,
                            city_id=city_id,
                            zone_id=zone_id,
                            seed_token=seed_token,
                            street_idx=street_idx,
                        )
                    )
                    street_idx += 1

        # Recurse — guard against degenerate intersections
        if half_a.geom_type in ("Polygon", "MultiPolygon") and half_a.area > 1e-8:
            half_a_poly = max(half_a.geoms, key=lambda p: p.area) if half_a.geom_type == "MultiPolygon" else half_a
            _split(half_a_poly, current_depth + 1)
        if half_b.geom_type in ("Polygon", "MultiPolygon") and half_b.area > 1e-8:
            half_b_poly = max(half_b.geoms, key=lambda p: p.area) if half_b.geom_type == "MultiPolygon" else half_b
            _split(half_b_poly, current_depth + 1)

    _split(polygon, 0)
    return streets


def _make_street(
    line: LineString,
    depth: int,
    city_id: UUID,
    zone_id: UUID,
    seed_token: str,
    street_idx: int,
) -> StreetGeometryInsert:
    """Build a StreetGeometryInsert with a deterministic ID."""
    street_type = _STREET_TYPE_BY_DEPTH[min(depth, len(_STREET_TYPE_BY_DEPTH) - 1)]
    street_id = uuid.uuid5(_STREET_UUID_NAMESPACE, f"{seed_token}|{street_idx}")
    # Length in km at the equator: 1° ≈ 111.32 km. Patches are tiny, so
    # approximation as planar is fine.
    length_km = round(line.length * 111.32, 4)
    return StreetGeometryInsert(
        id=street_id,
        city_id=city_id,
        zone_id=zone_id,
        name=None,  # Naming deferred to a later phase (LLM or naming bank)
        street_type=street_type,  # type: ignore[arg-type]
        length_km=length_km,
        geojson=mapping(line),
    )


# ── Building snap ────────────────────────────────────────────────────────────


def _snap_building_to_street(
    building: BuildingInput,
    streets: list[StreetGeometryInsert],
    zone_polygon: Polygon,
    rng: random.Random,
) -> tuple[Point, UUID | None]:
    """Pick a street for the building deterministically, place a point on it.

    Falls back to zone centroid if no street is suitable (degenerate small zones).
    """
    if not streets:
        # No streets in zone — drop building at zone centroid
        return zone_polygon.centroid, None

    # Pick a street deterministically (rng was seeded by zone+building IDs)
    street = streets[rng.randrange(len(streets))]
    street_line = LineString(street.geojson["coordinates"])

    # Pick a point along the street (10-90% to avoid intersection clustering)
    t = 0.1 + rng.random() * 0.8
    point_on_street = street_line.interpolate(t, normalized=True)

    # Verify the point is inside the zone (clipped streets can have endpoints
    # exactly on the polygon edge — interior interpolation is usually safe but
    # we pull slightly inward if needed)
    if not zone_polygon.contains(point_on_street):
        # Pull toward zone centroid
        centroid = zone_polygon.centroid
        pulled = Point(
            point_on_street.x * 0.95 + centroid.x * 0.05,
            point_on_street.y * 0.95 + centroid.y * 0.05,
        )
        if zone_polygon.contains(pulled):
            point_on_street = pulled
        else:
            point_on_street = centroid

    return point_on_street, street.id


# ── Per-(zone, building) RNG seed ────────────────────────────────────────────


def _zone_rng(top_seed: str, zone_id: UUID, building_id: UUID) -> random.Random:
    """Fresh RNG seeded by (top_seed, zone, building) — fully deterministic.

    Each building gets its own RNG so that adding/removing buildings does not
    perturb the placements of other buildings (stable ordering).
    """
    h = hashlib.md5(f"{top_seed}|{zone_id}|{building_id}".encode()).hexdigest()
    return random.Random(int(h, 16))


# ── Helpers used by the service layer ────────────────────────────────────────


def serialize_payload_for_rpc(payload: MapGeometryPayload) -> dict[str, Any]:
    """Convert MapGeometryPayload to plain JSON-safe dict for the RPC call.

    Pydantic's model_dump(mode='json') handles UUID → str, but the geojson
    fields are already plain dicts (built by shapely.geometry.mapping).
    """
    return payload.model_dump(mode="json")
