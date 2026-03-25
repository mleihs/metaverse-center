"""Ambient weather event service — real-world weather seeds living simulation atmospheres.

Fetches current conditions from Open-Meteo API (free, no key required), classifies
them into narrative categories, composes bilingual template-based descriptions via
a 4-layer composable system, and applies zone_ambient moodlets to agents.

Zero LLM calls. One HTTP call per simulation per tick. Pure template composition
with SHA-256 seeded selection and 7-bag anti-repetition.

Research basis: NWS Graphical Forecast Editor (rule/template NLG), Caves of Qud
(FDG'17 replacement grammar), Tetris 7-bag, Emily Short (multi-tag salience).
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk

from backend.models.ambient_weather import (
    CATEGORY_IMPACT,
    CATEGORY_MOODLET_EFFECTS,
    CLIMATE_FALLBACK,
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
    """Generates ambient weather events from real-world conditions per heartbeat tick."""

    # ── Weather Data Fetch ────────────────────────────────────────────────

    @classmethod
    async def fetch_conditions(
        cls, lat: float, lon: float, sim_name: str = "",
    ) -> WeatherConditions:
        """Fetch current weather from Open-Meteo API.

        Plan B on failure: use deterministic climate fallback based on lat + month.
        """
        logger.info(
            "Fetching weather for %s (%.2f, %.2f)", sim_name, lat, lon,
        )
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

            # Moon phase (pure math, no API)
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
                "Weather fetch failed for %s (%.2f, %.2f), using climate fallback",
                sim_name, lat, lon,
            )
            sentry_sdk.capture_exception()
            return cls._climate_fallback(lat)

    @classmethod
    def _climate_fallback(cls, lat: float) -> WeatherConditions:
        """Deterministic fallback based on latitude + current month."""
        zone = get_climate_zone(lat)
        month_idx = datetime.now(UTC).month - 1
        data = CLIMATE_FALLBACK.get(zone, CLIMATE_FALLBACK["temperate"])
        avg_temp, precip_prob = data[month_idx]

        # Deterministic seed from date + lat
        seed = hashlib.sha256(
            f"{datetime.now(UTC).strftime('%Y-%m-%d')}:{lat:.2f}".encode(),
        ).digest()
        rng = random.Random(int.from_bytes(seed[:8], "big"))

        # Generate plausible conditions
        temp = avg_temp + rng.uniform(-5, 5)
        is_raining = rng.random() < precip_prob
        wmo_code = 61 if is_raining else (3 if rng.random() < 0.5 else 0)
        moon = calculate_moon_phase(
            datetime.now(UTC).year, datetime.now(UTC).month, datetime.now(UTC).day,
        )

        return WeatherConditions(
            temperature=round(temp, 1),
            humidity=round(50 + rng.uniform(-20, 20), 1),
            wind_speed=round(rng.uniform(5, 30), 1),
            precipitation=round(rng.uniform(0, 5), 1) if is_raining else 0.0,
            cloud_cover=round(rng.uniform(60, 100) if is_raining else rng.uniform(0, 40)),
            weather_code=wmo_code,
            visibility=round(rng.uniform(1000, 5000) if is_raining else rng.uniform(8000, 15000)),
            is_day=8 <= datetime.now(UTC).hour <= 20,
            moon_phase=moon,
        )

    # ── Classification ────────────────────────────────────────────────────

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

        # Fallback: if no categories, use clear
        if not categories:
            categories.append(AmbientCategory.CLEAR)

        # Sort by impact (highest first)
        categories.sort(key=lambda c: CATEGORY_IMPACT.get(c, 0), reverse=True)

        return categories

    @classmethod
    def determine_time_of_day(cls, conditions: WeatherConditions) -> TimeOfDay:
        """Determine time-of-day slot from is_day and current hour."""
        now = datetime.now(UTC)
        hour = now.hour

        if not conditions.is_day:
            return TimeOfDay.NIGHT

        # Rough dawn/dusk estimation
        if hour < 8:
            return TimeOfDay.DAWN
        if hour >= 18:
            return TimeOfDay.DUSK
        return TimeOfDay.DAY

    # ── Narrative Composition ─────────────────────────────────────────────

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
    ) -> tuple[str, str]:
        """Compose a bilingual narrative from the 4-layer template system.

        Uses SHA-256 seeded randomness for deterministic but varied output.
        Returns (narrative_en, narrative_de).
        """
        # Deterministic seed: same date + zone + weather = same text
        date_str = datetime.now(UTC).strftime("%Y-%m-%d")
        seed_input = f"{date_str}:{zone_id}:{conditions.weather_code}:{tick_number}"
        seed = hashlib.sha256(seed_input.encode()).digest()
        rng = random.Random(int.from_bytes(seed[:8], "big"))

        primary_cat = categories[0].value
        theme_key = cls._resolve_theme_key(theme)

        # Layer 1: Opener
        opener_en, opener_de = cls._pick(
            rng, OPENERS.get(theme_key, {}).get(time_of_day.value, []),
            fallback=("In {zone},", "In {zone},"),
        )

        # Layer 2: Core weather description
        core_en, core_de = cls._pick(
            rng, CORE_WEATHER.get(theme_key, {}).get(primary_cat, []),
            fallback=("conditions are notable", "die Bedingungen sind bemerkenswert"),
        )

        # Layer 3: Consequence (check composites first)
        cons_en, cons_de = cls._pick_consequence(
            rng, categories, theme_key,
        )

        # Layer 4: Agent reaction (mood-dependent)
        react_en, react_de = cls._pick_reaction(rng, zone_avg_mood)

        # Interpolate weather data
        interp = {
            "zone": zone_name,
            "temperature": f"{conditions.temperature:.0f}",
            "visibility": f"{conditions.visibility:.0f}",
            "wind_speed": f"{conditions.wind_speed:.0f}",
            "precipitation": f"{conditions.precipitation:.1f}",
            "humidity": f"{conditions.humidity:.0f}",
        }

        # Compose
        parts_en = [
            cls._interp(opener_en, interp),
            cls._interp(core_en, interp) + ".",
        ]
        cons_text_en = cls._interp(cons_en, interp)
        if cons_text_en:
            parts_en.append(cons_text_en)
        react_text_en = cls._interp(react_en, interp)
        if react_text_en:
            parts_en.append(react_text_en)

        parts_de = [
            cls._interp(opener_de, interp),
            cls._interp(core_de, interp) + ".",
        ]
        cons_text_de = cls._interp(cons_de, interp)
        if cons_text_de:
            parts_de.append(cons_text_de)
        react_text_de = cls._interp(react_de, interp)
        if react_text_de:
            parts_de.append(react_text_de)

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

        # Composite amplification: if 2+ high-impact categories, strengthen
        if len(categories) >= 2:
            secondary_impact = CATEGORY_IMPACT.get(categories[1], 0)
            if secondary_impact >= 5:
                amplified = min(20, max(-20, int(effect.strength * 1.3)))
                return MoodletEffect(
                    strength=amplified, emotion=effect.emotion,
                    duration_hours=effect.duration_hours,
                )

        return effect

    # ── Process Tick (main entry point) ───────────────────────────────────

    @classmethod
    async def process_tick(
        cls,
        supabase: Client,
        sim_id: UUID,
        sim: dict,
        heartbeat_id: UUID,
        tick_number: int,
    ) -> list[dict]:
        """Process ambient weather for one simulation. Called from HeartbeatService.

        Returns list of heartbeat entry dicts for batch insert.
        """
        lat = sim.get("weather_lat")
        lon = sim.get("weather_lon")
        sim_name = sim.get("name", "Unknown")
        theme = sim.get("theme", "custom")

        if not lat or not lon:
            # No coordinates — try theme defaults
            default = THEME_DEFAULT_COORDS.get(theme, (50.08, 14.44))
            lat, lon = default

        # Fetch weather
        conditions = await cls.fetch_conditions(lat, lon, sim_name)

        # Cache last weather data for Plan B on future failures
        try:
            await supabase.table("simulation_settings").upsert({
                "simulation_id": str(sim_id),
                "category": "heartbeat",
                "setting_key": "last_weather_data",
                "setting_value": json.dumps({
                    "temperature": conditions.temperature,
                    "weather_code": conditions.weather_code,
                    "wind_speed": conditions.wind_speed,
                    "precipitation": conditions.precipitation,
                    "visibility": conditions.visibility,
                    "fetched_at": datetime.now(UTC).isoformat(),
                }),
            }, on_conflict="simulation_id,category,setting_key").execute()
        except Exception:
            logger.debug("Failed to cache weather data — non-critical")

        # Classify
        categories = cls.classify(conditions)
        time_of_day = cls.determine_time_of_day(conditions)

        # Get zones for this simulation
        zone_resp = await (
            supabase.table("zones")
            .select("id, name")
            .eq("simulation_id", str(sim_id))
            .execute()
        )
        zones = zone_resp.data or []

        if not zones:
            logger.debug("No zones for %s — skipping ambient weather", sim_name)
            return []

        # Get average mood per zone (for agent reactions)
        zone_moods = await cls._get_zone_moods(supabase, sim_id, zones)

        entries: list[dict] = []

        for zone in zones:
            zone_id = zone["id"]
            zone_name = zone["name"]
            zone_mood = zone_moods.get(zone_id, 0.0)

            try:
                # Compose narrative
                narrative_en, narrative_de = cls.compose_narrative(
                    categories, theme, zone_name, conditions,
                    time_of_day, zone_mood, tick_number, zone_id,
                )

                # Create heartbeat entry
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

                # Apply zone_ambient moodlet to agents in this zone
                moodlet = cls.compute_moodlet(categories)
                if moodlet.strength != 0:
                    await cls._apply_zone_moodlets(
                        supabase, sim_id, zone_id, moodlet, conditions,
                    )

            except (KeyError, TypeError, ValueError):
                logger.exception(
                    "Ambient event failed for zone %s", zone_name,
                    extra={"zone_id": zone_id, "simulation_id": str(sim_id)},
                )
                sentry_sdk.capture_exception()

        logger.info(
            "Ambient weather: %d zone events for %s",
            len(entries), sim_name,
            extra={"simulation_id": str(sim_id), "tick_number": tick_number},
        )
        return entries

    # ── Private Helpers ───────────────────────────────────────────────────

    @classmethod
    def _resolve_theme_key(cls, theme: str) -> str:
        """Map simulation theme to template key."""
        mapping = {
            "spy-thriller": "spy-thriller",
            "dystopian": "spy-thriller",
            "scifi": "scifi",
            "biopunk": "biopunk",
            "post-apocalyptic": "post-apocalyptic",
            "arc-raiders": "post-apocalyptic",
            "medieval": "medieval",
            "historical": "medieval",
            "utopian": "medieval",
            "fantasy": "biopunk",
            "custom": "spy-thriller",
        }
        return mapping.get(theme, "spy-thriller")

    @staticmethod
    def _pick(
        rng: random.Random,
        pool: list[tuple[str, str]],
        fallback: tuple[str, str] = ("", ""),
    ) -> tuple[str, str]:
        """Pick a random template from a pool using the seeded RNG."""
        if not pool:
            return fallback
        return rng.choice(pool)

    @classmethod
    def _pick_consequence(
        cls, rng: random.Random, categories: list[AmbientCategory], theme_key: str,
    ) -> tuple[str, str]:
        """Pick consequence — check composites first, then single category."""
        # Check for composite match
        if len(categories) >= 2:
            for i in range(len(categories)):
                for j in range(i + 1, len(categories)):
                    key = (categories[i].value, categories[j].value)
                    composites = COMPOSITE_CONSEQUENCES.get(key, [])
                    if composites:
                        return rng.choice(composites)
                    # Try reverse order
                    key_rev = (categories[j].value, categories[i].value)
                    composites_rev = COMPOSITE_CONSEQUENCES.get(key_rev, [])
                    if composites_rev:
                        return rng.choice(composites_rev)

        # Single category consequence
        primary = categories[0].value if categories else "clear"
        pool = CONSEQUENCES.get(theme_key, {}).get(primary, [])
        if pool:
            return rng.choice(pool)
        return ("", "")

    @classmethod
    def _pick_reaction(cls, rng: random.Random, zone_avg_mood: float) -> tuple[str, str]:
        """Pick agent reaction based on average zone mood."""
        if zone_avg_mood > 20:
            mood_band = "positive"
        elif zone_avg_mood < -20:
            mood_band = "negative"
        else:
            mood_band = "neutral"

        pool = AGENT_REACTIONS.get(mood_band, [])
        if pool:
            return rng.choice(pool)
        return ("", "")

    @staticmethod
    def _interp(template: str, values: dict[str, str]) -> str:
        """Safely interpolate template values, ignoring missing keys."""
        try:
            return template.format_map(values)
        except (KeyError, ValueError):
            return template

    @classmethod
    async def _get_zone_moods(
        cls, supabase: Client, sim_id: UUID, zones: list[dict],
    ) -> dict[str, float]:
        """Get average agent mood per zone."""
        moods: dict[str, float] = {}
        try:
            mood_resp = await (
                supabase.table("agents")
                .select("current_zone_id, agent_mood!inner(mood_score)")
                .eq("simulation_id", str(sim_id))
                .is_("deleted_at", "null")
                .execute()
            )
            # Aggregate by zone
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
    async def _apply_zone_moodlets(
        cls,
        supabase: Client,
        sim_id: UUID,
        zone_id: str,
        moodlet: MoodletEffect,
        conditions: WeatherConditions,
    ) -> None:
        """Apply zone_ambient moodlet to all agents in a zone."""
        try:
            agents_resp = await (
                supabase.table("agents")
                .select("id")
                .eq("simulation_id", str(sim_id))
                .eq("current_zone_id", zone_id)
                .is_("deleted_at", "null")
                .execute()
            )
            for agent in agents_resp.data or []:
                await AgentMoodService.add_moodlet(
                    supabase, agent["id"], sim_id,
                    moodlet_type="zone_weather",
                    emotion=moodlet.emotion,
                    strength=moodlet.strength,
                    source_type="weather",
                    source_description=f"Weather: WMO {conditions.weather_code}, {conditions.temperature:.0f}°C",
                    decay_type="timed",
                    duration_hours=moodlet.duration_hours,
                    stacking_group="zone_ambient",
                )
        except Exception:
            logger.debug("Failed to apply weather moodlets to zone %s", zone_id)
