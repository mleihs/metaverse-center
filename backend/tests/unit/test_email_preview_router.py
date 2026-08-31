"""Die Mail-Vorschau zeigt Mails und verschickt keine (Handoff P3.27).

Zwei Zusicherungen, und die zweite ist die wichtigere.

**Sie ist verschlossen.** Ein Endpunkt, der jede Mailvorlage samt Beispieldaten
rendert, gehört nicht in die Öffentlichkeit — die Vorlagen zeigen die
Innenarchitektur der Plattform, und ein gerenderter Einladungstext samt
Token-URL ist eine Vorlage für eine Fälschung.

**Sie verschickt nichts.** Das ist keine Selbstverständlichkeit, sondern der
Unterschied zu dem Weg, den sie ersetzt: `scripts/send_test_emails.py` schickt
echte Mail an eine echte Adresse. Ein Vorschauendpunkt, der aus Versehen
zustellt, wäre schlimmer als gar keiner, deshalb wird hier per AST geprüft, dass
das Modul `EmailService` überhaupt nicht kennt.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import app
from backend.services.email_fixtures import FIXTURES

ROUTER = Path(__file__).resolve().parents[2] / "routers" / "email_preview.py"


class TestItSendsNothing:
    def test_the_module_does_not_import_the_mail_service(self) -> None:
        tree = ast.parse(ROUTER.read_text(encoding="utf-8"))
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
                imported |= {f"{node.module}.{alias.name}" for alias in node.names}
            elif isinstance(node, ast.Import):
                imported |= {alias.name for alias in node.names}
        offenders = sorted(name for name in imported if "email_service" in name.lower())
        assert not offenders, (
            "Die Vorschau darf den Versanddienst nicht einmal kennen: " + ", ".join(offenders)
        )

    def test_no_endpoint_takes_a_recipient(self) -> None:
        """Checked on the CODE, not on the file.

        The first version searched the raw text for "recipient" and failed on
        its own docstring, which names ``accountless_recipient`` in order to
        explain the register. J3b, in the test that was written to avoid it:
        the explanation of a thing looks, to a text scan, exactly like the thing.
        So: parameter NAMES from the AST, and calls to ``send``. Comments and
        docstrings do not survive the parse — except a module docstring, which
        is a string constant and is skipped explicitly below.
        """
        tree = ast.parse(ROUTER.read_text(encoding="utf-8"))

        parameters: set[str] = set()
        calls: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
                parameters |= {
                    argument.arg
                    for argument in list(node.args.args) + list(node.args.kwonlyargs)
                }
            elif isinstance(node, ast.Call):
                name = getattr(node.func, "attr", None) or getattr(node.func, "id", None)
                if name:
                    calls.add(name)

        for forbidden in ("recipient", "recipient_email", "to_email", "email"):
            assert forbidden not in parameters, (
                f"Die Vorschau nimmt einen Empfänger entgegen: {forbidden}"
            )
        assert "send" not in calls, "Die Vorschau ruft send()"


class TestItIsClosed:
    def test_both_routes_refuse_an_anonymous_caller(self) -> None:
        client = TestClient(app, raise_server_exceptions=False)
        for url in (
            "/api/v1/admin/emails/preview",
            "/api/v1/admin/emails/preview/welcome",
        ):
            response = client.get(url)
            assert response.status_code in (401, 403, 422), (
                f"{url} antwortete {response.status_code} ohne Anmeldung"
            )
            assert response.status_code != 200, f"{url} ist offen"

    def test_the_routes_exist_at_all(self) -> None:
        """A 404 would make the test above pass for the wrong reason."""
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/v1/admin/emails/preview")
        assert response.status_code != 404, "die Route ist gar nicht registriert"


class TestTheRouterAndTheRegisterAgree:
    def test_every_fixture_key_is_reachable(self) -> None:
        """The route takes the key straight from the register, so a fixture
        that renders is a page that exists. Asserted rather than assumed."""
        from backend.services.email_fixtures import FIXTURES_BY_KEY

        for fixture in FIXTURES:
            assert FIXTURES_BY_KEY[fixture.key] is fixture

    def test_the_locale_and_part_parameters_are_constrained(self) -> None:
        """An unconstrained `part` would let a caller pass anything into the
        branch; an unconstrained `locale` would silently fall back to English."""
        source = inspect.getsource(
            __import__("backend.routers.email_preview", fromlist=["preview_email"]).preview_email
        )
        assert 'pattern="^(de|en)$"' in source
        assert 'pattern="^(html|text)$"' in source
