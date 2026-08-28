"""The SPA shell as we hand it to a browser: index.html plus the build identity.

`index.html` is a build artifact and cannot know which deployment is serving it.
The running process does (see build_identity), so the server stamps the release
into the document it sends. The frontend reads the stamp at startup and tags its
Sentry events with it — which makes the frontend release equal to the backend
release by construction, rather than by two configurations happening to agree.

Read once per process: the file is immutable for the lifetime of a container,
and the SPA shell is requested on every navigation that is not a static asset.
"""

from __future__ import annotations

import logging
from pathlib import Path

from backend.utils import build_identity

logger = logging.getLogger(__name__)

_document: str | None = None
_loaded_from: Path | None = None


def _stamp(html: str) -> str:
    """Insert the build-identity meta tags directly after <head>.

    Nothing is inserted when the release is unknown (local development): an
    empty stamp would be a claim about the build, and the frontend's build-time
    constant is the better answer there.
    """
    if not build_identity.RELEASE:
        return html
    tags = (
        f'<meta name="velg-release" content="{build_identity.RELEASE}" />'
        f'<meta name="velg-commit" content="{build_identity.SHORT_SHA}" />'
    )
    head = "<head>"
    if head not in html:
        # Not fatal: the SPA still works, it just reports an unknown release.
        logger.warning("index.html has no <head> — build identity not stamped")
        return html
    return html.replace(head, head + tags, 1)


def load_spa_document(index_path: Path) -> str | None:
    """Return the stamped index.html, or None when the file is missing.

    The cache keys on the path so a changed static root (tests) reloads rather
    than serving the previous document.
    """
    global _document, _loaded_from  # noqa: PLW0603
    if _document is not None and _loaded_from == index_path:
        return _document
    try:
        raw = index_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    _document = _stamp(raw)
    _loaded_from = index_path
    return _document
