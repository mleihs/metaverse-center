"""The five account emails every user actually sees.

Until now only `confirmation` had a template of its own. Password reset,
magic link, address change and invitation went out in the Supabase default
design — the mails that reach *everyone*, in a design that belongs to nobody
(Handoff P2.22).

GoTrue templates are standalone HTML with no includes, so nothing in the format
itself keeps five files consistent. These tests are that mechanism.

The rules come from the handoff and they are about security, not decoration:
a mail about access to your own account must say how long the link lasts, must
offer the address in plain text for people who do not click buttons in email,
must say where the request came from, must say that doing nothing is safe — and
must say that this kind of post cannot be switched off, because a security
notice with an unsubscribe link is either a lie or a vulnerability.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[3]
_TEMPLATES = _ROOT / "supabase/templates"
_CONFIG = _ROOT / "supabase/config.toml"

_EXPECTED = ("confirmation", "recovery", "magic_link", "email_change", "invite")

#: GoTrue substitutes exactly these. Anything else renders literally, and a
#: literal `{{ .Foo }}` in a security mail reads as a broken or forged message.
_KNOWN_PLACEHOLDERS = {
    "ConfirmationURL",
    "Token",
    "TokenHash",
    "SiteURL",
    "Email",
    "NewEmail",
    "RedirectTo",
    "Data",
}


def _templates() -> list[Path]:
    return sorted(_TEMPLATES.glob("*.html"))


@pytest.fixture(scope="module")
def config() -> dict:
    with _CONFIG.open("rb") as handle:
        return tomllib.load(handle)


class TestTheScanFindsSomething:
    def test_there_are_templates(self):
        assert len(_templates()) >= 5, "Vorlagenverzeichnis leer — der Test prüfte nichts"


class TestEveryAccountMailIsWired:
    @pytest.mark.parametrize("name", _EXPECTED)
    def test_the_file_exists(self, name):
        assert (_TEMPLATES / f"{name}.html").is_file()

    @pytest.mark.parametrize("name", _EXPECTED)
    def test_config_points_at_it(self, config, name):
        entry = config["auth"]["email"]["template"].get(name)
        assert entry, f"{name} hat keine [auth.email.template.{name}]-Sektion"
        assert entry["content_path"].endswith(f"{name}.html")
        assert entry.get("subject"), f"{name} hat keinen Betreff"

    def test_no_template_file_is_left_unwired(self, config):
        """A file on disk that config does not name is dead weight that looks live."""
        wired = {Path(entry["content_path"]).stem for entry in config["auth"]["email"]["template"].values()}
        on_disk = {path.stem for path in _templates()}
        assert on_disk <= wired, f"nicht verdrahtet: {sorted(on_disk - wired)}"


class TestSecurityMailSaysWhatItMust:
    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_it_offers_the_link_as_plain_text(self, path):
        """Many people never click a button in an email, and rightly so."""
        text = path.read_text(encoding="utf-8")
        assert re.search(r">\s*\{\{ \.ConfirmationURL \}\}\s*<", text), "kein Klartext-Link zum Kopieren"

    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_it_states_how_long_the_link_lasts(self, path):
        text = path.read_text(encoding="utf-8")
        assert "valid for one hour" in text and "gilt eine Stunde" in text

    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_it_says_doing_nothing_is_safe(self, path):
        text = path.read_text(encoding="utf-8")
        assert re.search(r"do not need to do anything|did not ask for this|do NOT confirm|ignore this message", text), (
            "sagt nicht, was passiert, wenn man nichts tut"
        )

    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_it_is_not_unsubscribable_and_says_so(self, path):
        text = path.read_text(encoding="utf-8")
        assert "cannot be unsubscribed" in text
        assert "nicht abbestellt werden" in text
        assert "unsubscribe?" not in text, (
            "Ein Abmeldelink in einer Sicherheitsmail ist entweder gelogen oder eine Lücke"
        )

    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_both_languages_are_marked_up(self, path):
        """GoTrue knows no locale, so both go out together — and a screen reader
        only switches pronunciation when the block says which language it is."""
        text = path.read_text(encoding="utf-8")
        assert 'lang="en"' in text and 'lang="de"' in text


class TestNothingRendersLiterally:
    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_only_known_placeholders_are_used(self, path):
        used = set(re.findall(r"\{\{\s*\.(\w+)\s*\}\}", path.read_text(encoding="utf-8")))
        unknown = sorted(used - _KNOWN_PLACEHOLDERS)
        assert not unknown, f"GoTrue ersetzt diese nicht: {unknown} — sie stünden wörtlich in der Mail"

    @pytest.mark.parametrize("path", _templates(), ids=lambda p: p.stem)
    def test_no_em_dash(self, path):
        """Project rule: en dash. Here it also matters that a mail client with a
        narrow column does not break the line on a glyph nobody typed."""
        text = path.read_text(encoding="utf-8")
        assert "&mdash;" not in text and "—" not in text
