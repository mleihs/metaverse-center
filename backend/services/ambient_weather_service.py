"""Ambient weather event service — real-world weather seeds living simulation atmospheres.

Fetches current conditions from Open-Meteo API (free, no key required), classifies
them into narrative categories, composes bilingual template-based descriptions via
a 4-layer composable system, and applies zone_ambient moodlets to agents.

Zero LLM calls. One HTTP call per simulation per tick. Pure template composition
with SHA-256 seeded selection and Tetris 7-bag anti-repetition.

Anti-repetition: each template pool is treated as a shuffled bag. Items are dealt
sequentially. When the bag empties, it's reshuffled and refilled. Maximum drought
before any item repeats: 2N-1 draws (where N = pool size). Bag state persists in
the heartbeat summary JSONB.

Research basis: NWS Graphical Forecast Editor (rule/template NLG), Caves of Qud
(FDG'17 replacement grammar), Tetris 7-bag guideline, Emily Short (multi-tag salience).
"""

from __future__ import annotations

import hashlib
import logging
import random
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk

from backend.models.ambient_weather import (
    AVAILABLE_TEMPLATE_THEMES,
    CATEGORY_IMPACT,
    CATEGORY_MOODLET_EFFECTS,
    CLIMATE_FALLBACK,
    DEFAULT_THEME_MAPPING,
    THEME_DEFAULT_COORDS,
    WMO_CATEGORY_MAP,
    AmbientCategory,
    MoodletEffect,
    TimeOfDay,
    WeatherConditions,
    calculate_moon_phase,
    get_climate_zone,
)
from backend.services.agent_mood_service import AgentMoodService
from backend.services.ambient_weather_templates import (
    AGENT_REACTIONS,
    COMPOSITE_CONSEQUENCES,
    CONSEQUENCES,
    CORE_WEATHER,
    OPENERS,
)
from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_OPEN_METEO_TIMEOUT = 10.0  # seconds


class AmbientWeatherService:
    """Generates ambient weather events from real-world conditions per heartbeat tick.

    Public API:
        fetch_conditions() — fetch weather from Open-Meteo (with climate fallback)
        classify() — map conditions to AmbientCategory list
        determine_time_of_day() — derive TimeOfDay from conditions
        compose_narrative() — 4-layer template composition with 7-bag selection
        compute_moodlet() — derive moodlet effect from categories
        process_tick() — orchestrate all of the above for one simulation
    """

    # ══════════════════════════════════════════════════════════════════════
    # Weather Data Fetch
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    async def fetch_conditions(
        cls, lat: float, lon: float, sim_name: str = "",
        cached_weather: dict | None = None,
    ) -> WeatherConditions:
        """Fetch current weather from Open-Meteo API.

        Plan B: cached weather data from last successful heartbeat summary.
        Plan C: deterministic climate fallback based on lat + month.
        """
        logger.info("Fetching weather for %s (%.2f, %.2f)", sim_name, lat, lon)
        try:
            async with httpx.AsyncClient(timeout=_OPEN_METEO_TIMEOUT) as client:
                resp = await client.get(_OPEN_METEO_URL, params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": (
                        "temperature_2m,relative_humidity_2m,wind_speed_10m,"
                        "precipitation,cloud_cover,weather_code,visibility,is_day"
                    ),
                    "daily": "sunrise,sunset",
                    "timezone": "auto",
                    "forecast_days": 1,
                })
                resp.raise_for_status()
                data = resp.json()

            current = data.get("current", {})
            daily = data.get("daily", {})
            now = datetime.now(UTC)
            moon = calculate_moon_phase(now.year, now.month, now.day)

            conditions = WeatherConditions(
                temperature=current.get("temperature_2m", 15.0),
                humidity=current.get("relative_humidity_2m", 50.0),
                wind_speed=current.get("wind_speed_10m", 10.0),
                precipitation=current.get("precipitation", 0.0),
                cloud_cover=current.get("cloud_cover", 0.0),
                weather_code=current.get("weather_code", 0),
                visibility=current.get("visibility", 10000.0),
                is_day=bool(current.get("is_day", 1)),
                sunrise=(daily.get("sunrise") or [""])[0],
                sunset=(daily.get("sunset") or [""])[0],
                moon_phase=moon,
            )
            logger.info(
                "Weather fetched: code=%d, temp=%.1f°C, wind=%.1f km/h",
                conditions.weather_code, conditions.temperature, conditions.wind_speed,
            )
            return conditions

        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning(
                "Weather fetch failed for %s (%.2f, %.2f)", sim_name, lat, lon,
            )
            sentry_sdk.capture_exception()

            # Plan B: use cached weather from last successful heartbeat
            if cached_weather and cached_weather.get("weather_code") is not None:
                logger.info("Using cached weather data from last heartbeat")
                now = datetime.now(UTC)
                return WeatherConditions(
                    temperature=cached_weather.get("temperature", 15.0),
                    weather_code=cached_weather.get("weather_code", 0),
                    wind_speed=cached_weather.get("wind_speed", 10.0),
                    precipitation=cached_weather.get("precipitation", 0.0),
                    visibility=cached_weather.get("visibility", 10000.0),
                    is_day=8 <= now.hour <= 20,
                    moon_phase=calculate_moon_phase(now.year, now.month, now.day),
                )

            # Plan C: deterministic climate fallback
            logger.info("No cached weather — using climate fallback for lat=%.2f", lat)
            return cls._climate_fallback(lat)

    @classmethod
    def _climate_fallback(cls, lat: float) -> WeatherConditions:
        """Deterministic fallback based on latitude + current month."""
        zone = get_climate_zone(lat)
        now = datetime.now(UTC)
        month_idx = now.month - 1
        data = CLIMATE_FALLBACK.get(zone, CLIMATE_FALLBACK["temperate"])
        avg_temp, precip_prob = data[month_idx]

        seed = hashlib.sha256(
            f"{now.strftime('%Y-%m-%d')}:{lat:.2f}".encode(),
        ).digest()
        rng = random.Random(int.from_bytes(seed[:8], "big"))

        temp = avg_temp + rng.uniform(-5, 5)
        is_raining = rng.random() < precip_prob
        wmo_code = 61 if is_raining else (3 if rng.random() < 0.5 else 0)

        return WeatherConditions(
            temperature=round(temp, 1),
            humidity=round(50 + rng.uniform(-20, 20), 1),
            wind_speed=round(rng.uniform(5, 30), 1),
            precipitation=round(rng.uniform(0, 5), 1) if is_raining else 0.0,
            cloud_cover=round(rng.uniform(60, 100) if is_raining else rng.uniform(0, 40)),
            weather_code=wmo_code,
            visibility=round(rng.uniform(1000, 5000) if is_raining else rng.uniform(8000, 15000)),
            is_day=8 <= now.hour <= 20,
            moon_phase=calculate_moon_phase(now.year, now.month, now.day),
        )

    # ══════════════════════════════════════════════════════════════════════
    # Classification
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    def classify(cls, conditions: WeatherConditions) -> list[AmbientCategory]:
        """Classify weather conditions into ambient categories, sorted by impact."""
        categories: list[AmbientCategory] = []

        # Primary: WMO code
        primary = WMO_CATEGORY_MAP.get(conditions.weather_code)
        if primary:
            categories.append(primary)

        # Derived conditions (additive)
        if conditions.temperature > 35:
            categories.append(AmbientCategory.HEAT)
        if conditions.temperature < -10:
            categories.append(AmbientCategory.COLD)
        if conditions.wind_speed > 50:
            categories.append(AmbientCategory.WIND)
        if conditions.visibility < 200 and AmbientCategory.FOG_DENSE not in categories:
            categories.append(AmbientCategory.FOG_DENSE)

        # Moon phase
        if 0.45 <= conditions.moon_phase <= 0.55:
            categories.append(AmbientCategory.FULL_MOON)
        elif conditions.moon_phase < 0.05 or conditions.moon_phase > 0.95:
            categories.append(AmbientCategory.NEW_MOON)

        if not categories:
            categories.append(AmbientCategory.CLEAR)

        categories.sort(key=lambda c: CATEGORY_IMPACT.get(c, 0), reverse=True)
        return categories

    @classmethod
    def determine_time_of_day(cls, conditions: WeatherConditions) -> TimeOfDay:
        """Determine time-of-day slot using sunrise/sunset from the simulation's location.

        Uses the actual sunrise/sunset times returned by Open-Meteo (location-aware,
        timezone-correct) instead of fixed UTC hour thresholds. Dawn = first 90min
        after sunrise, dusk = last 90min before sunset.
        """
        if not conditions.is_day:
            return TimeOfDay.NIGHT

        # Use location-aware sunrise/sunset from Open-Meteo if available
        now = datetime.now(UTC)
        try:
            if conditions.sunrise and conditions.sunset:
                sunrise = datetime.fromisoformat(conditions.sunrise.replace("Z", "+00:00"))
                sunset = datetime.fromisoformat(conditions.sunset.replace("Z", "+00:00"))
                # Dawn = within 90min after sunrise
                if now < sunrise + timedelta(minutes=90):
                    return TimeOfDay.DAWN
                # Dusk = within 90min before sunset
                if now > sunset - timedelta(minutes=90):
                    return TimeOfDay.DUSK
                return TimeOfDay.DAY
        except (ValueError, TypeError):
            pass  # Fall through to UTC-based estimation

        # Fallback: UTC-based estimation (for climate fallback without sunrise data)
        hour = now.hour
        if hour < 8:
            return TimeOfDay.DAWN
        if hour >= 18:
            return TimeOfDay.DUSK
        return TimeOfDay.DAY

    # ══════════════════════════════════════════════════════════════════════
    # Narrative Composition (7-bag anti-repetition)
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    def compose_narrative(
        cls,
        categories: list[AmbientCategory],
        theme: str,
        zone_name: str,
        conditions: WeatherConditions,
        time_of_day: TimeOfDay,
        zone_avg_mood: float,
        tick_number: int,
        zone_id: str,
        bag_state: dict,
        overrides: dict | None = None,
    ) -> tuple[str, str]:
        """Compose a bilingual narrative from the 4-layer template system.

        Uses SHA-256 seeded randomness with Tetris 7-bag anti-repetition.
        bag_state is mutated in-place — caller persists it in heartbeat summary.

        Returns (narrative_en, narrative_de).
        """
        date_str = datetime.now(UTC).strftime("%Y-%m-%d")
        seed_input = f"{date_str}:{zone_id}:{conditions.weather_code}:{tick_number}"
        seed = hashlib.sha256(seed_input.encode()).digest()
        rng = random.Random(int.from_bytes(seed[:8], "big"))

        primary_cat = categories[0].value
        theme_key = cls._resolve_theme_key(theme, overrides)

        # Layer 1: Opener (7-bag)
        opener_pool = OPENERS.get(theme_key, {}).get(time_of_day.value, [])
        opener_en, opener_de = cls._pick_from_bag(
            rng, opener_pool, bag_state, f"opener:{time_of_day.value}",
            fallback=("In {zone},", "In {zone},"),
        )

        # Layer 2: Core weather (7-bag)
        core_pool = CORE_WEATHER.get(theme_key, {}).get(primary_cat, [])
        core_en, core_de = cls._pick_from_bag(
            rng, core_pool, bag_state, f"core:{primary_cat}",
            fallback=("conditions are notable", "die Bedingungen sind bemerkenswert"),
        )

        # Layer 3: Consequence (7-bag, composites checked first)
        cons_en, cons_de = cls._pick_consequence(rng, categories, theme_key, bag_state)

        # Layer 4: Agent reaction (7-bag, mood-dependent)
        react_en, react_de = cls._pick_reaction(rng, zone_avg_mood, bag_state)

        # Interpolate weather data
        interp = {
            "zone": zone_name,
            "temperature": f"{conditions.temperature:.0f}",
            "visibility": f"{conditions.visibility:.0f}",
            "wind_speed": f"{conditions.wind_speed:.0f}",
            "precipitation": f"{conditions.precipitation:.1f}",
            "humidity": f"{conditions.humidity:.0f}",
        }

        parts_en = [cls._interp(opener_en, interp), cls._interp(core_en, interp) + "."]
        parts_de = [cls._interp(opener_de, interp), cls._interp(core_de, interp) + "."]

        for text_en, text_de, parts_e, parts_d in [
            (cons_en, cons_de, parts_en, parts_de),
            (react_en, react_de, parts_en, parts_de),
        ]:
            rendered_en = cls._interp(text_en, interp)
            rendered_de = cls._interp(text_de, interp)
            if rendered_en:
                parts_e.append(rendered_en)
            if rendered_de:
                parts_d.append(rendered_de)

        return " ".join(parts_en), " ".join(parts_de)

    @classmethod
    def compute_moodlet(cls, categories: list[AmbientCategory]) -> MoodletEffect:
        """Compute the moodlet effect from the primary weather category."""
        if not categories:
            return MoodletEffect(strength=0, emotion="neutral")

        primary = categories[0]
        effect = CATEGORY_MOODLET_EFFECTS.get(
            primary, MoodletEffect(strength=0, emotion="neutral"),
        )

        # Composite amplification: 2+ high-impact categories strengthen the effect
        if len(categories) >= 2:
            secondary_impact = CATEGORY_IMPACT.get(categories[1], 0)
            if secondary_impact >= 5:
                amplified = min(20, max(-20, int(effect.strength * 1.3)))
                return MoodletEffect(
                    strength=amplified, emotion=effect.emotion,
                    duration_hours=effect.duration_hours,
                )

        return effect

    # ══════════════════════════════════════════════════════════════════════
    # Process Tick — public orchestrator
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    async def process_tick(
        cls,
        supabase: Client,
        sim_id: UUID,
        sim: dict,
        heartbeat_id: UUID,
        tick_number: int,
        overrides: dict | None = None,
    ) -> tuple[list[dict], dict]:
        """Process ambient weather for one simulation.

        Called from HeartbeatService. Returns:
            - list of heartbeat entry dicts (for batch insert)
            - weather summary dict (for heartbeat summary JSONB)
        """
        lat, lon = cls._resolve_coordinates(sim)
        sim_name = sim.get("name", "Unknown")

        # Load cached weather from last heartbeat (Plan B data)
        cached_weather = await cls._load_cached_weather(supabase, sim_id)

        # Step 1: Fetch weather
        conditions = await cls.fetch_conditions(lat, lon, sim_name, cached_weather)

        # Step 2: Classify
        categories = cls.classify(conditions)
        time_of_day = cls.determine_time_of_day(conditions)

        # Step 3: Compose zone events (pass cached_weather to avoid redundant DB query)
        entries, bag_state = await cls._compose_zone_events(
            supabase, sim_id, sim, categories, conditions, time_of_day,
            heartbeat_id, tick_number, overrides, cached_weather,
        )

        # Step 4: Apply moodlets
        await cls._apply_zone_moodlets_batch(
            supabase, sim_id, categories, conditions,
        )

        # Build weather summary (stored in heartbeat summary, NOT simulation_settings)
        weather_summary = cls._build_weather_summary(
            conditions, categories, time_of_day, bag_state,
        )

        logger.info(
            "Ambient weather: %d zone events for %s",
            len(entries), sim_name,
            extra={"simulation_id": str(sim_id), "tick_number": tick_number},
        )

        return entries, weather_summary

    # ══════════════════════════════════════════════════════════════════════
    # Private: Orchestration sub-steps
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    async def _compose_zone_events(
        cls,
        supabase: Client,
        sim_id: UUID,
        sim: dict,
        categories: list[AmbientCategory],
        conditions: WeatherConditions,
        time_of_day: TimeOfDay,
        heartbeat_id: UUID,
        tick_number: int,
        overrides: dict | None = None,
        cached_weather: dict | None = None,
    ) -> tuple[list[dict], dict]:
        """Compose narrative entries for each zone. Returns (entries, bag_state)."""
        theme = sim.get("theme", "custom")

        zone_resp = await (
            supabase.table("zones")
            .select("id, name")
            .eq("simulation_id", str(sim_id))
            .execute()
        )
        zones = zone_resp.data or []
        if not zones:
            return [], {}

        zone_moods = await cls._get_zone_moods(supabase, sim_id)

        # Restore bag state from cached weather (passed from process_tick to avoid double query)
        bag_state: dict = cached_weather.get("bag_state", {}) if cached_weather else {}

        entries: list[dict] = []
        for zone in zones:
            zone_id = zone["id"]
            zone_name = zone["name"]
            zone_mood = zone_moods.get(zone_id, 0.0)

            try:
                narrative_en, narrative_de = cls.compose_narrative(
                    categories, theme, zone_name, conditions,
                    time_of_day, zone_mood, tick_number, zone_id,
                    bag_state, overrides,
                )

                entry = make_heartbeat_entry(
                    heartbeat_id, sim_id, tick_number,
                    "ambient_weather",
                    narrative_en, narrative_de,
                    severity="info",
                    metadata={
                        "zone_id": zone_id,
                        "zone_name": zone_name,
                        "weather_code": conditions.weather_code,
                        "temperature": conditions.temperature,
                        "categories": [c.value for c in categories],
                        "time_of_day": time_of_day.value,
                    },
                )
                entries.append(entry)

            except (KeyError, TypeError, ValueError):
                logger.exception(
                    "Ambient event failed for zone %s", zone_name,
                    extra={"zone_id": zone_id, "simulation_id": str(sim_id)},
                )
                sentry_sdk.capture_exception()

        return entries, bag_state

    @classmethod
    async def _apply_zone_moodlets_batch(
        cls,
        supabase: Client,
        sim_id: UUID,
        categories: list[AmbientCategory],
        conditions: WeatherConditions,
    ) -> None:
        """Apply zone_ambient moodlets to all agents in all zones."""
        moodlet = cls.compute_moodlet(categories)
        if moodlet.strength == 0:
            return

        try:
            agents_resp = await (
                supabase.table("agents")
                .select("id, current_zone_id")
                .eq("simulation_id", str(sim_id))
                .is_("deleted_at", "null")
                .not_.is_("current_zone_id", "null")
                .execute()
            )
            for agent in agents_resp.data or []:
                try:
                    await AgentMoodService.add_moodlet(
                        supabase, agent["id"], sim_id,
                        moodlet_type="zone_weather",
                        emotion=moodlet.emotion,
                        strength=moodlet.strength,
                        source_type="weather",
                        source_description=(
                            f"Weather: WMO {conditions.weather_code}, "
                            f"{conditions.temperature:.0f}°C"
                        ),
                        decay_type="timed",
                        duration_hours=moodlet.duration_hours,
                        stacking_group="zone_ambient",
                    )
                except Exception:
                    logger.debug(
                        "Failed to apply weather moodlet to agent %s",
                        agent["id"],
                    )
        except Exception:
            logger.warning("Failed to apply weather moodlets for sim %s", sim_id)
            sentry_sdk.capture_exception()

    @classmethod
    def _build_weather_summary(
        cls,
        conditions: WeatherConditions,
        categories: list[AmbientCategory],
        time_of_day: TimeOfDay,
        bag_state: dict,
    ) -> dict:
        """Build weather data dict for heartbeat summary JSONB."""
        return {
            "weather_code": conditions.weather_code,
            "temperature": conditions.temperature,
            "wind_speed": conditions.wind_speed,
            "precipitation": conditions.precipitation,
            "visibility": conditions.visibility,
            "humidity": conditions.humidity,
            "is_day": conditions.is_day,
            "moon_phase": conditions.moon_phase,
            "categories": [c.value for c in categories],
            "time_of_day": time_of_day.value,
            "bag_state": bag_state,
            "fetched_at": datetime.now(UTC).isoformat(),
        }

    # ══════════════════════════════════════════════════════════════════════
    # Private: Template Selection (7-bag anti-repetition)
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    def _pick_from_bag(
        cls,
        rng: random.Random,
        pool: list[tuple[str, str]],
        bag_state: dict,
        bag_key: str,
        fallback: tuple[str, str] = ("", ""),
    ) -> tuple[str, str]:
        """Tetris 7-bag selection: shuffle all items, deal sequentially, refill when empty.

        State is stored in bag_state[bag_key] as a list of remaining indices.
        When the list is empty or missing, all indices are shuffled into a new bag.
        Maximum drought before any item repeats: 2N-1 draws.
        """
        if not pool:
            return fallback

        remaining = bag_state.get(bag_key)
        if not remaining:
            indices = list(range(len(pool)))
            rng.shuffle(indices)
            remaining = indices

        idx = remaining.pop(0)
        bag_state[bag_key] = remaining
        return pool[idx % len(pool)]

    @classmethod
    def _pick_consequence(
        cls,
        rng: random.Random,
        categories: list[AmbientCategory],
        theme_key: str,
        bag_state: dict,
    ) -> tuple[str, str]:
        """Pick consequence — check composites first, then single category (7-bag)."""
        if len(categories) >= 2:
            for i in range(len(categories)):
                for j in range(i + 1, len(categories)):
                    key = (categories[i].value, categories[j].value)
                    pool = COMPOSITE_CONSEQUENCES.get(key) or COMPOSITE_CONSEQUENCES.get(
                        (categories[j].value, categories[i].value),
                    )
                    if pool:
                        return cls._pick_from_bag(
                            rng, pool, bag_state, f"composite:{key[0]}+{key[1]}",
                        )

        primary = categories[0].value if categories else "clear"
        pool = CONSEQUENCES.get(theme_key, {}).get(primary, [])
        return cls._pick_from_bag(rng, pool, bag_state, f"cons:{theme_key}:{primary}")

    @classmethod
    def _pick_reaction(
        cls, rng: random.Random, zone_avg_mood: float, bag_state: dict,
    ) -> tuple[str, str]:
        """Pick agent reaction based on average zone mood (7-bag)."""
        if zone_avg_mood > 20:
            mood_band = "positive"
        elif zone_avg_mood < -20:
            mood_band = "negative"
        else:
            mood_band = "neutral"

        pool = AGENT_REACTIONS.get(mood_band, [])
        return cls._pick_from_bag(rng, pool, bag_state, f"reaction:{mood_band}")

    # ══════════════════════════════════════════════════════════════════════
    # Private: Data resolution helpers
    # ══════════════════════════════════════════════════════════════════════

    @classmethod
    def _resolve_coordinates(cls, sim: dict) -> tuple[float, float]:
        """Resolve weather coordinates from simulation or theme defaults."""
        lat = sim.get("weather_lat")
        lon = sim.get("weather_lon")
        if lat and lon:
            return lat, lon
        theme = sim.get("theme", "custom")
        return THEME_DEFAULT_COORDS.get(theme, (50.08, 14.44))

    @classmethod
    def _resolve_theme_key(cls, theme: str, overrides: dict | None = None) -> str:
        """Map simulation theme to template key, with optional override.

        Priority: simulation_settings override > default mapping > spy-thriller fallback.
        """
        if overrides:
            override = overrides.get("weather_theme_override", "")
            if override in AVAILABLE_TEMPLATE_THEMES:
                return override

        return DEFAULT_THEME_MAPPING.get(theme, "spy-thriller")

    @staticmethod
    def _interp(template: str, values: dict[str, str]) -> str:
        """Safely interpolate template values, ignoring missing keys."""
        try:
            return template.format_map(values)
        except (KeyError, ValueError):
            return template

    @classmethod
    async def _get_zone_moods(
        cls, supabase: Client, sim_id: UUID,
    ) -> dict[str, float]:
        """Get average agent mood per zone (LEFT JOIN — agents without mood are excluded from avg)."""
        moods: dict[str, float] = {}
        try:
            mood_resp = await (
                supabase.table("agents")
                .select("current_zone_id, agent_mood(mood_score)")  # LEFT join (no !inner)
                .eq("simulation_id", str(sim_id))
                .is_("deleted_at", "null")
                .execute()
            )
            zone_scores: dict[str, list[float]] = {}
            for agent in mood_resp.data or []:
                zid = agent.get("current_zone_id")
                mood_data = agent.get("agent_mood")
                if zid and mood_data:
                    score = mood_data.get("mood_score", 0)
                    zone_scores.setdefault(zid, []).append(score)

            for zid, scores in zone_scores.items():
                moods[zid] = sum(scores) / len(scores) if scores else 0.0

        except Exception:
            logger.debug("Failed to fetch zone moods — using neutral")

        return moods

    @classmethod
    async def _load_cached_weather(
        cls, supabase: Client, sim_id: UUID,
    ) -> dict:
        """Load weather data from the most recent completed heartbeat summary."""
        try:
            resp = await (
                supabase.table("simulation_heartbeats")
                .select("summary")
                .eq("simulation_id", str(sim_id))
                .eq("status", "completed")
                .order("tick_number", desc=True)
                .limit(1)
                .execute()
            )
            if resp.data and resp.data[0].get("summary"):
                return resp.data[0]["summary"].get("weather", {})
        except Exception:
            logger.debug("Failed to load cached weather for %s", sim_id)
        return {}
