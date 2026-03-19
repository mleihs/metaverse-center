"""Shared slug generation utility."""

import re


def slugify(name: str) -> str:
    """Generate a URL-safe slug from a name.

    Rules: lowercase, alphanumeric + hyphens only, max 100 chars.
    """
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")[:100]
