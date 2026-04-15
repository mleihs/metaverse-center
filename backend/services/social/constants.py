"""Shared constants for the social media publishing pipeline.

Single source of truth for scheduler defaults, retry config,
metrics collection intervals, and hashtag pools.
"""

from __future__ import annotations

# ── Scheduler Defaults ────────────────────────────────────────────────

DEFAULT_CHECK_INTERVAL = 300  # 5 minutes between scheduler ticks
MAX_PUBLISH_RETRIES = 3
METRICS_COLLECT_DELAYS = (3600, 21600, 86400, 172800)  # +1h, +6h, +24h, +48h

# ── Hashtag Pools (canonical) ─────────────────────────────────────────
#
# Instagram: 2 broad + 2 niche + 1 trending = 5 tags per post.
# Bluesky: filtered subset — only community tags with search volume.
#
# To add a tag: add to the appropriate pool below.
# Bluesky-worthy tags are derived automatically (broad + all niche pools).

BROAD_TAG_POOL = (
    "#worldbuilding",
    "#AIart",
    "#speculativefiction",
    "#scifi",
    "#digitalart",
    "#conceptart",
    "#storytelling",
    "#alternatehistory",
    "#creativewriting",
    "#indiedev",
    "#fantasyworldbuilding",
    "#scifiart",
    "#ttrpg",
    "#fantasy",
)

NICHE_TAG_POOLS: dict[str, tuple[str, ...]] = {
    "agent": (
        "#characterdesign",
        "#OC",
        "#AIcharacter",
        "#characterart",
        "#AIportrait",
        "#RPG",
        "#dndcharacter",
        "#fictionalcharacter",
        "#portraitart",
        "#ttrpgcommunity",
    ),
    "building": (
        "#AIarchitecture",
        "#fantasyarchitecture",
        "#environmentdesign",
        "#scifibuilding",
        "#conceptarchitecture",
        "#urbanfantasy",
        "#proceduralgeneration",
        "#virtualworld",
    ),
    "chronicle": (
        "#microfiction",
        "#flashfiction",
        "#lorebuilding",
        "#narrativedesign",
        "#ttrpg",
        "#emergentnarrative",
        "#fictionwriting",
        "#worldlore",
    ),
    "lore": (
        "#lore",
        "#deepdive",
        "#secrethistory",
        "#fictionallore",
        "#narrativedesign",
        "#ttrpg",
        "#archivesfiction",
        "#classifieddocument",
    ),
}

# Content type weights (overridable via platform_settings.instagram_content_mix).
DEFAULT_CONTENT_MIX: dict[str, int] = {
    "agent": 3,
    "building": 2,
    "chronicle": 2,
    "lore": 1,
}

# ── Derived Sets ──────────────────────────────────────────────────────

# Tags worth keeping on Bluesky (community discoverable, non-zero search volume).
# Derived from broad + all niche pools. Brand/simulation-specific tags are excluded.
BLUESKY_WORTHY_TAGS: frozenset[str] = frozenset(
    tag.lower()
    for pool in (BROAD_TAG_POOL, *NICHE_TAG_POOLS.values())
    for tag in pool
)

# Brand/simulation-specific tag patterns — zero search volume on Bluesky.
BLUESKY_SKIP_TAG_PATTERNS: frozenset[str] = frozenset({
    "bureauofimpossiblegeography",
    "substratedispatch",
})
