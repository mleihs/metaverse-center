"""Regression tests for _inject_meta backslash safety (Sentry 117184501).

Entity-derived content (lore descriptions, titles) flows into re.sub
replacement strings. Plain-string replacements are parsed as templates,
so a ``\\D`` in a lore description raised ``PatternError: bad escape``
and 500'd the crawler-facing SPA route. _sub_literal bypasses template
parsing entirely.
"""

from __future__ import annotations

from backend.middleware.seo import _inject_meta

_BASE_HTML = """<html>
  <head>
    <title>Velgarien</title>
    <meta name="description" content="placeholder">
    <meta property="og:title" content="placeholder">
    <meta property="og:description" content="placeholder">
    <meta property="og:url" content="placeholder">
    <meta name="twitter:title" content="placeholder">
    <meta name="twitter:description" content="placeholder">
    <link rel="canonical" href="placeholder">
  </head>
  <body></body>
</html>"""


def test_backslash_escape_in_description_does_not_crash():
    """Repro of the prod event: lore description containing ``\\D``."""
    html = _inject_meta(
        _BASE_HTML,
        title="Gorilla Bas and the Right to Joy",
        description="The clause \\D in the city charter grants joy to all.",
        canonical="https://metaverse.center/simulations/x/lore/y",
    )
    assert "\\D in the city charter" in html


def test_group_references_in_content_stay_literal():
    r"""``\1`` / ``\g<0>`` in content must not be expanded as group refs."""
    html = _inject_meta(
        _BASE_HTML,
        title=r"Title with \1 and \g<0> markers",
        description=r"Description \1 stays literal",
        canonical="https://metaverse.center/x",
    )
    # _escape HTML-escapes the angle brackets; the backslashes must survive
    # verbatim instead of being parsed as group references.
    assert r"\1 and \g&lt;0&gt; markers" in html
    assert r"Description \1 stays literal" in html


def test_normal_content_still_replaces_all_tags():
    html = _inject_meta(
        _BASE_HTML,
        title="Plain Title",
        description="Plain description.",
        canonical="https://metaverse.center/plain",
    )
    assert "<title>Plain Title</title>" in html
    assert '<meta name="description" content="Plain description."' in html
    assert '<meta property="og:title" content="Plain Title"' in html
    assert '<link rel="canonical" href="https://metaverse.center/plain"' in html
    # Every placeholder tag in the fixture is one we replace — none survive.
    assert "placeholder" not in html
