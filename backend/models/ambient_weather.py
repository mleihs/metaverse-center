"""Data models for the ambient weather system.

Maps real-world weather conditions (Open-Meteo API) to narrative event
categories and agent moodlet effects. All classification is rule-based
(zero LLM calls).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AmbientCategory(str, Enum):
    """Weather condition categories derived from WMO codes + sensor thresholds."""

    CLEAR = "clear"
    OVERCAST = "overcast"
    FOG = "fog"
    FOG_DENSE = "fog_dense"
    RAIN_LIGHT = "rain_light"
    RAIN = "rain"
    RAIN_FREEZING = "rain_freezing"
    STORM = "storm"
    SNOW = "snow"
    STORM_SNOW = "storm_snow"
    THUNDERSTORM = "thunderstorm"
    THUNDERSTORM_SEVERE = "thunderstorm_severe"
    HEAT = "heat"
    COLD = "cold"
    WIND = "wind"
    FULL_MOON = "full_moon"
    NEW_MOON = "new_moon"


class TimeOfDay(str, Enum):
    """Time-of-day slot for atmospheric opener selection."""

    DAWN = "dawn"
    DAY = "day"
    DUSK = "dusk"
    NIGHT = "night"


@dataclass
class WeatherConditions:
    """Current weather conditions from Open-Meteo API."""

    temperature: float = 15.0  # °C
    humidity: float = 50.0  # %
    wind_speed: float = 10.0  # km/h
    precipitation: float = 0.0  # mm
    cloud_cover: float = 0.0  # %
    weather_code: int = 0  # WMO 0-99
    visibility: float = 10000.0  # m
    is_day: bool = True
    sunrise: str = ""  # ISO time
    sunset: str = ""  # ISO time
    moon_phase: float = 0.0  # 0.0=new, 0.5=full, 1.0=new


@dataclass
class MoodletEffect:
    """Effect to apply as a zone_ambient moodlet on agents."""

    strength: int  # -20 to +20
    emotion: str  # joy, anxiety, fear, contentment, etc.
    duration_hours: int = 4  # matches heartbeat interval


# ── WMO Code → Category Mapping ──────────────────────────────────────────────

WMO_CATEGORY_MAP: dict[int, AmbientCategory] = {
    0: AmbientCategory.CLEAR,
    1: AmbientCategory.OVERCAST,
    2: AmbientCategory.OVERCAST,
    3: AmbientCategory.OVERCAST,
    45: AmbientCategory.FOG,
    48: AmbientCategory.FOG,
    51: AmbientCategory.RAIN_LIGHT,
    53: AmbientCategory.RAIN_LIGHT,
    55: AmbientCategory.RAIN_LIGHT,
    61: AmbientCategory.RAIN,
    63: AmbientCategory.RAIN,
    65: AmbientCategory.RAIN,
    66: AmbientCategory.RAIN_FREEZING,
    67: AmbientCategory.RAIN_FREEZING,
    71: AmbientCategory.SNOW,
    73: AmbientCategory.SNOW,
    75: AmbientCategory.SNOW,
    77: AmbientCategory.SNOW,
    80: AmbientCategory.STORM,
    81: AmbientCategory.STORM,
    82: AmbientCategory.STORM,
    85: AmbientCategory.STORM_SNOW,
    86: AmbientCategory.STORM_SNOW,
    95: AmbientCategory.THUNDERSTORM,
    96: AmbientCategory.THUNDERSTORM_SEVERE,
    99: AmbientCategory.THUNDERSTORM_SEVERE,
}

# ── Moodlet Effects per Category ──────────────────────────────────────────────

CATEGORY_MOODLET_EFFECTS: dict[AmbientCategory, MoodletEffect] = {
    AmbientCategory.CLEAR: MoodletEffect(strength=3, emotion="contentment"),
    AmbientCategory.OVERCAST: MoodletEffect(strength=-1, emotion="unease"),
    AmbientCategory.FOG: MoodletEffect(strength=-3, emotion="anxiety"),
    AmbientCategory.FOG_DENSE: MoodletEffect(strength=-4, emotion="anxiety"),
    AmbientCategory.RAIN_LIGHT: MoodletEffect(strength=-1, emotion="melancholy"),
    AmbientCategory.RAIN: MoodletEffect(strength=-3, emotion="distress"),
    AmbientCategory.RAIN_FREEZING: MoodletEffect(strength=-5, emotion="distress"),
    AmbientCategory.STORM: MoodletEffect(strength=-4, emotion="distress"),
    AmbientCategory.SNOW: MoodletEffect(strength=1, emotion="wonder"),
    AmbientCategory.STORM_SNOW: MoodletEffect(strength=-4, emotion="distress"),
    AmbientCategory.THUNDERSTORM: MoodletEffect(strength=-6, emotion="fear"),
    AmbientCategory.THUNDERSTORM_SEVERE: MoodletEffect(strength=-8, emotion="fear"),
    AmbientCategory.HEAT: MoodletEffect(strength=-3, emotion="discomfort"),
    AmbientCategory.COLD: MoodletEffect(strength=-5, emotion="distress"),
    AmbientCategory.WIND: MoodletEffect(strength=-2, emotion="unease"),
    AmbientCategory.FULL_MOON: MoodletEffect(strength=-2, emotion="unease"),
    AmbientCategory.NEW_MOON: MoodletEffect(strength=2, emotion="calm"),
}

# ── Impact Ranking (for primary category selection) ───────────────────────────

CATEGORY_IMPACT: dict[AmbientCategory, int] = {
    AmbientCategory.THUNDERSTORM_SEVERE: 10,
    AmbientCategory.THUNDERSTORM: 9,
    AmbientCategory.STORM: 8,
    AmbientCategory.STORM_SNOW: 8,
    AmbientCategory.RAIN_FREEZING: 7,
    AmbientCategory.COLD: 7,
    AmbientCategory.HEAT: 6,
    AmbientCategory.FOG_DENSE: 6,
    AmbientCategory.WIND: 5,
    AmbientCategory.FOG: 5,
    AmbientCategory.RAIN: 4,
    AmbientCategory.SNOW: 4,
    AmbientCategory.RAIN_LIGHT: 3,
    AmbientCategory.FULL_MOON: 3,
    AmbientCategory.OVERCAST: 2,
    AmbientCategory.NEW_MOON: 2,
    AmbientCategory.CLEAR: 1,
}

# ── Climate Fallback Table (Plan B when API is unreachable) ───────────────────
# Monthly average temperature (°C) and precipitation probability (0-1)
# by latitude band. Used with deterministic hash for consistent fallback.

CLIMATE_FALLBACK: dict[str, list[tuple[float, float]]] = {
    # (avg_temp_C, precip_probability) per month (Jan-Dec)
    "arctic": [  # lat > 66
        (-15, 0.3), (-14, 0.3), (-10, 0.3), (-5, 0.4), (2, 0.4), (7, 0.5),
        (10, 0.5), (8, 0.5), (3, 0.5), (-3, 0.4), (-10, 0.3), (-14, 0.3),
    ],
    "subarctic": [  # lat 55-66
        (-5, 0.4), (-3, 0.4), (0, 0.4), (5, 0.5), (10, 0.5), (14, 0.6),
        (16, 0.6), (14, 0.6), (9, 0.6), (4, 0.5), (-1, 0.5), (-4, 0.4),
    ],
    "temperate": [  # lat 35-55
        (2, 0.5), (3, 0.5), (7, 0.5), (12, 0.5), (17, 0.5), (21, 0.4),
        (23, 0.4), (22, 0.4), (18, 0.4), (13, 0.5), (7, 0.5), (3, 0.5),
    ],
    "mediterranean": [  # lat 30-45, lon near Mediterranean
        (8, 0.5), (9, 0.4), (12, 0.4), (15, 0.3), (20, 0.2), (25, 0.1),
        (28, 0.05), (28, 0.1), (24, 0.2), (19, 0.3), (13, 0.4), (9, 0.5),
    ],
    "tropical": [  # lat < 30
        (25, 0.3), (26, 0.3), (27, 0.4), (28, 0.5), (28, 0.6), (27, 0.6),
        (27, 0.6), (27, 0.6), (27, 0.5), (27, 0.4), (26, 0.3), (25, 0.3),
    ],
}


def get_climate_zone(lat: float) -> str:
    """Determine climate zone from latitude."""
    abs_lat = abs(lat)
    if abs_lat > 66:
        return "arctic"
    if abs_lat > 55:
        return "subarctic"
    if abs_lat > 35:
        return "temperate"
    if abs_lat > 30:
        return "mediterranean"
    return "tropical"


# ── Theme → Template Key Mapping ──────────────────────────────────────────────

AVAILABLE_TEMPLATE_THEMES: set[str] = {
    "spy-thriller", "scifi", "biopunk", "post-apocalyptic", "medieval",
}

DEFAULT_THEME_MAPPING: dict[str, str] = {
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

# ── Theme → Default Coordinates (for user-created simulations) ────────────────

THEME_DEFAULT_COORDS: dict[str, tuple[float, float]] = {
    "dystopian": (50.08, 14.44),      # Prague
    "utopian": (43.21, 2.35),         # Carcassonne
    "fantasy": (68.23, 14.57),        # Lofoten
    "scifi": (78.22, 15.63),          # Svalbard
    "historical": (43.21, 2.35),      # Carcassonne
    "custom": (50.08, 14.44),         # Prague (safe default)
    "arc-raiders": (40.63, 14.60),    # Amalfi Coast
    "spy-thriller": (50.08, 14.44),   # Prague
    "biopunk": (68.23, 14.57),        # Lofoten
    "post-apocalyptic": (40.63, 14.60),  # Amalfi Coast
    "medieval": (43.21, 2.35),        # Carcassonne
}


# ── Moon Phase Calculation (pure math, no API) ────────────────────────────────

# Reference new moon: 2024-01-11 11:57 UTC (known astronomical date)
_SYNODIC_MONTH = 29.53058867  # days
_REFERENCE_NEW_MOON_JD = 2460320.99792  # Julian date of 2024-01-11 11:57 UTC


def calculate_moon_phase(year: int, month: int, day: int) -> float:
    """Calculate moon phase (0.0=new, 0.5=full, 1.0=new) for a given date.

    Uses synodic month from a known new moon reference. Accurate to ~1 day.
    """
    # Convert to Julian date (simplified)
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jd = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045

    days_since_ref = jd - _REFERENCE_NEW_MOON_JD
    phase = (days_since_ref % _SYNODIC_MONTH) / _SYNODIC_MONTH
    return phase % 1.0
