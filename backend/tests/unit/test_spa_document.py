"""The SPA shell carries the build identity the server knows.

Why this exists: an error report is worth what its version tag is worth. On
production neither tier reported one — the backend read an unset SENTRY_RELEASE,
the frontend a build-time constant that could not be populated because the
deployment target injects the deployed commit into the CONTAINER at runtime and
does not pass it as a Docker build arg (verified against the Coolify build
line). Stamping the shell at serve time gives both tiers the same value from the
same place.
"""

import importlib

import pytest

from backend.utils import build_identity, spa_document


@pytest.fixture(autouse=True)
def _reset_document_cache():
    """The stamped document is a process-wide cache; don't leak it between tests."""
    spa_document._document = None
    spa_document._loaded_from = None
    yield
    spa_document._document = None
    spa_document._loaded_from = None


def _write_index(tmp_path, html: str = "<html><head><title>t</title></head><body></body></html>"):
    path = tmp_path / "index.html"
    path.write_text(html, encoding="utf-8")
    return path


def test_release_and_commit_are_stamped_into_head(tmp_path, monkeypatch):
    monkeypatch.setattr(build_identity, "RELEASE", "a" * 40)
    monkeypatch.setattr(build_identity, "SHORT_SHA", "a" * 7)

    html = spa_document.load_spa_document(_write_index(tmp_path))

    assert html is not None
    assert f'<meta name="velg-release" content="{"a" * 40}" />' in html
    assert f'<meta name="velg-commit" content="{"a" * 7}" />' in html
    # Directly after <head>, before anything the document already carried.
    assert html.index("velg-release") < html.index("<title>")


def test_nothing_is_stamped_when_the_release_is_unknown(tmp_path, monkeypatch):
    # Local development: an empty stamp would be a claim about the build, and
    # the frontend's build-time constant is the better answer there.
    monkeypatch.setattr(build_identity, "RELEASE", "")
    monkeypatch.setattr(build_identity, "SHORT_SHA", "unknown")

    html = spa_document.load_spa_document(_write_index(tmp_path))

    assert html is not None
    assert "velg-release" not in html
    assert "velg-commit" not in html


def test_a_head_less_document_is_served_unstamped_rather_than_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(build_identity, "RELEASE", "deadbeef")
    path = _write_index(tmp_path, "<html><body>no head</body></html>")

    html = spa_document.load_spa_document(path)

    assert html == "<html><body>no head</body></html>"


def test_missing_file_returns_none(tmp_path):
    assert spa_document.load_spa_document(tmp_path / "absent.html") is None


def test_document_is_read_once_per_path(tmp_path, monkeypatch):
    monkeypatch.setattr(build_identity, "RELEASE", "cafebabe")
    path = _write_index(tmp_path)

    first = spa_document.load_spa_document(path)
    path.write_text("<html><head></head><body>changed on disk</body></html>", encoding="utf-8")
    second = spa_document.load_spa_document(path)

    assert first == second, "the shell is immutable for a container's lifetime"


def test_a_different_path_reloads(tmp_path, monkeypatch):
    monkeypatch.setattr(build_identity, "RELEASE", "cafebabe")
    first = spa_document.load_spa_document(_write_index(tmp_path))

    other = tmp_path / "other"
    other.mkdir()
    second = spa_document.load_spa_document(_write_index(other, "<html><head></head><body>other root</body></html>"))

    assert first != second


class TestBuildIdentity:
    """Precedence: an explicit release name wins over the deployed commit."""

    def test_explicit_release_wins(self, monkeypatch):
        monkeypatch.setenv("SENTRY_RELEASE", "v1.2.3")
        monkeypatch.setenv("SOURCE_COMMIT", "a" * 40)
        reloaded = importlib.reload(build_identity)
        try:
            assert reloaded.RELEASE == "v1.2.3"
        finally:
            importlib.reload(build_identity)

    def test_falls_back_to_the_deployed_commit(self, monkeypatch):
        monkeypatch.delenv("SENTRY_RELEASE", raising=False)
        monkeypatch.setenv("SOURCE_COMMIT", "b" * 40)
        reloaded = importlib.reload(build_identity)
        try:
            assert reloaded.RELEASE == "b" * 40
            assert reloaded.SHORT_SHA == "b" * 7
        finally:
            importlib.reload(build_identity)

    def test_unknown_when_neither_is_set(self, monkeypatch):
        monkeypatch.delenv("SENTRY_RELEASE", raising=False)
        monkeypatch.delenv("SOURCE_COMMIT", raising=False)
        reloaded = importlib.reload(build_identity)
        try:
            assert reloaded.RELEASE == ""
            assert reloaded.SHORT_SHA == "unknown"
        finally:
            importlib.reload(build_identity)
