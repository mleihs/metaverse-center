"""The welcome, and the bound that keeps it from greeting the archive.

Handoff P2.21. Registering produced no message of any kind.

The interesting half of this file is not the mail. It is
``_BACKLOG_HORIZON``: a sweep running for the first time sees the entire
existing population as "new", and mail cannot be recalled. Measured against
production on the day this was written, the difference between having the
bound and not having it was **10 greetings versus 0**.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.services import lifecycle_mail_scheduler as lms
from backend.services.email_templates import render_welcome, welcome_subject

# ── Doubles ──────────────────────────────────────────────────────────


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    """Records the filters a sweep applies, then answers with fixed rows."""

    def __init__(self, table: str, store: dict):
        self._table = table
        self._store = store
        self._filters: list[tuple] = []

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self._filters.append(("gte", col, val))
        return self

    def lte(self, col, val):
        self._filters.append(("lte", col, val))
        return self

    def in_(self, col, vals):
        self._filters.append(("in", col, list(vals)))
        return self

    @property
    def not_(self):
        return self

    def is_(self, col, val):
        self._filters.append(("not_is", col, val))
        return self

    async def execute(self):
        rows = self._store.get(self._table, [])
        self._store.setdefault("_filters", []).append((self._table, list(self._filters)))
        for kind, col, val in self._filters:
            if kind == "gte":
                rows = [r for r in rows if r.get(col, "") >= val]
            elif kind == "lte":
                rows = [r for r in rows if r.get(col, "") <= val]
            elif kind == "eq":
                rows = [r for r in rows if str(r.get(col)) == str(val)]
            elif kind == "in":
                wanted = {str(v) for v in val}
                rows = [r for r in rows if str(r.get(col)) in wanted]
            elif kind == "not_is" and val == "null":
                rows = [r for r in rows if r.get(col) is not None]
        return _Result(rows)


class _Admin:
    def __init__(self, store: dict):
        self._store = store

    def table(self, name: str):
        return _Query(name, self._store)


def _profile(age: timedelta, *, email: str = "a@b.test") -> dict:
    return {
        "id": str(uuid4()),
        "email": email,
        "created_at": (datetime.now(UTC) - age).isoformat(),
    }


# ── Die Untergrenze ──────────────────────────────────────────────────


class TestTheFirstRunDoesNotGreetTheArchive:
    """Post lässt sich nicht zurückholen; deshalb steht dieser Block zuerst."""

    @pytest.mark.asyncio
    async def test_accounts_older_than_the_horizon_are_left_alone(self):
        store = {"user_profiles": [_profile(timedelta(days=n)) for n in (2, 30, 130)]}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 0
        send.assert_not_called()

    @pytest.mark.asyncio
    async def test_the_real_production_population_would_get_nothing(self):
        """Der echte Fall vom Tag der Migration: 10 Konten, das jüngste vom
        22.04.2026. Ohne Untergrenze bekämen alle zehn eine Begrüßung."""
        store = {"user_profiles": [_profile(timedelta(days=131 + n)) for n in range(10)]}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 0
        send.assert_not_called()

    @pytest.mark.asyncio
    async def test_without_the_bound_the_same_population_would_be_mailed(self):
        """Gegenprobe. Sie beweist, dass der Nulldurchlauf oben an der Grenze
        liegt und nicht daran, dass der Sweep überhaupt nichts findet."""
        store = {"user_profiles": [_profile(timedelta(days=131 + n)) for n in range(10)]}
        with (
            patch.object(lms, "_BACKLOG_HORIZON", timedelta(days=3650)),
            patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send,
        ):
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 10
        assert send.call_count == 10

    def test_the_bound_is_declared_once_and_not_per_sweep(self):
        """Die Grenze gehört an den gemeinsamen Ort. Steht sie in jedem Sweep,
        vergisst der übernächste sie."""
        source = textwrap.dedent(inspect.getsource(lms))
        assert source.count("_BACKLOG_HORIZON = ") == 1
        for name in lms.SWEEPS:
            fn_src = textwrap.dedent(inspect.getsource(lms.SWEEPS[name]))
            assert "_BACKLOG_HORIZON" in fn_src, f"Sweep {name} kennt die Untergrenze nicht"


# ── Das Fenster ──────────────────────────────────────────────────────


class TestTheWindow:
    @pytest.mark.asyncio
    async def test_a_fresh_signup_waits_for_the_delay(self):
        """Sofort wäre die Willkommensmail im selben Posteingang-Moment wie die
        Bestätigungsmail von GoTrue und beide konkurrierten um dieselbe
        Aufmerksamkeit."""
        store = {"user_profiles": [_profile(timedelta(minutes=5))]}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 0
        send.assert_not_called()

    @pytest.mark.asyncio
    async def test_an_account_inside_the_window_is_greeted_once(self):
        store = {"user_profiles": [_profile(timedelta(hours=3))]}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 1
        assert send.call_args.kwargs["record"].template == "welcome"

    @pytest.mark.asyncio
    async def test_an_account_without_an_address_is_skipped(self):
        rows = [_profile(timedelta(hours=3)), _profile(timedelta(hours=3), email="da@b.test")]
        rows[0]["email"] = None
        store = {"user_profiles": rows}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 1
        # Scharf statt nur zählend: es muss der MIT Adresse sein.
        assert send.call_args.args[0] == "da@b.test"


# ── Idempotenz ───────────────────────────────────────────────────────


class TestNobodyIsGreetedTwice:
    @pytest.mark.asyncio
    async def test_an_existing_log_row_suppresses_the_send(self):
        profile = _profile(timedelta(hours=3))
        store = {
            "user_profiles": [profile],
            "email_log": [{"recipient_user_id": profile["id"], "template": "welcome"}],
        }
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 0
        send.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_failed_send_is_not_retried_forever(self):
        """`email_log` verzeichnet auch Fehlschläge. Das ist Absicht: eine
        schlechte Adresse alle fünf Minuten erneut anzuschreiben wäre eine
        Dauerschleife gegen den Mailanbieter."""
        profile = _profile(timedelta(hours=3))
        store = {
            "user_profiles": [profile],
            "email_log": [
                {"recipient_user_id": profile["id"], "template": "welcome", "ok": False}
            ],
        }
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 0
        send.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_log_row_for_a_different_template_does_not_suppress_it(self):
        profile = _profile(timedelta(hours=3))
        store = {
            "user_profiles": [profile],
            "email_log": [{"recipient_user_id": profile["id"], "template": "cycle_briefing"}],
        }
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)):
            sent = await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert sent == 1

    def test_every_sweep_writes_the_template_it_is_keyed_by(self):
        """Der Vorlagenname ist der Schlüssel der eigenen Idempotenz. Weicht der
        Name beim Versand vom Namen im Register ab, findet der Wächter nie eine
        Zeile und der Sweep wiederholt sich für immer."""
        for name, fn in lms.SWEEPS.items():
            src = textwrap.dedent(inspect.getsource(fn))
            tree = ast.parse(src)
            templates = {
                kw.value.value
                for node in ast.walk(tree)
                if isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "MailRecord"
                for kw in node.keywords
                if kw.arg == "template" and isinstance(kw.value, ast.Constant)
            }
            assert templates == {name}, f"Sweep {name} schreibt {templates}"
            guards = {
                node.args[1].value
                for node in ast.walk(tree)
                if isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "already_mailed"
                and len(node.args) > 1
                and isinstance(node.args[1], ast.Constant)
            }
            assert guards == {name}, f"Sweep {name} prüft {guards}"


# ── Sprache ──────────────────────────────────────────────────────────


class TestTheLanguageIsTheReadersChoice:
    @pytest.mark.asyncio
    async def test_the_chosen_locale_reaches_the_renderer(self):
        profile = _profile(timedelta(hours=3))
        store = {
            "user_profiles": [profile],
            "notification_preferences": [{"user_id": profile["id"], "email_locale": "de"}],
        }
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        subject = send.call_args.args[1]
        assert subject == welcome_subject("de")

    @pytest.mark.asyncio
    async def test_a_missing_preference_row_is_not_filled_in_with_a_guess(self):
        profile = _profile(timedelta(hours=3))
        store = {"user_profiles": [profile]}
        with patch.object(lms.EmailService, "send", new=AsyncMock(return_value=True)) as send:
            await lms._sweep_welcome(_Admin(store), datetime.now(UTC))
        assert send.call_args.args[1] == welcome_subject(None)


# ── Das Tor ──────────────────────────────────────────────────────────


class TestTheSwitchFailsClosed:
    @pytest.mark.asyncio
    async def test_a_missing_row_leaves_the_sweeps_off(self):
        config = await lms.LifecycleMailScheduler._load_config(_Admin({}))
        assert config["enabled"] is False

    @pytest.mark.asyncio
    async def test_a_seeded_true_turns_them_on(self):
        store = {
            "platform_settings": [
                {"setting_key": "lifecycle_mail_enabled", "setting_value": True}
            ]
        }
        config = await lms.LifecycleMailScheduler._load_config(_Admin(store))
        assert config["enabled"] is True

    @pytest.mark.asyncio
    async def test_a_malformed_value_does_not_arm_a_mailing(self):
        store = {
            "platform_settings": [
                {"setting_key": "lifecycle_mail_enabled", "setting_value": None}
            ]
        }
        config = await lms.LifecycleMailScheduler._load_config(_Admin(store))
        assert config["enabled"] is False

    @pytest.mark.asyncio
    async def test_one_failing_sweep_does_not_cost_the_others_their_tick(self):
        async def _boom(_admin, _now):
            raise ValueError("nope")

        calls: list[str] = []

        async def _fine(_admin, _now):
            calls.append("ran")
            return 0

        with patch.dict(lms.SWEEPS, {"boom": _boom, "fine": _fine}, clear=True):
            await lms.LifecycleMailScheduler._process_tick(_Admin({}), {})
        assert calls == ["ran"]


# ── Die Mail selbst ──────────────────────────────────────────────────


class TestTheWelcomeNamesOneStep:
    def test_it_points_at_the_quickstart(self):
        assert "/how-to-play/quickstart" in render_welcome(email_locale="de")

    def test_there_is_exactly_one_call_to_action(self):
        """Zwei gleichrangige Knöpfe wählen nichts aus und geben die Wahl an
        jemanden zurück, der noch keine Grundlage dafür hat."""
        html = render_welcome(email_locale="en")
        assert html.count('bgcolor="#f59e0b"') == 1

    def test_it_does_not_promise_a_clearance_nobody_granted(self):
        """`clearance` ist eine echte Mechanik mit eigener Erteilungsmail."""
        html = render_welcome(email_locale="en").lower()
        assert "clearance" not in html
        assert "freigabe" not in html

    def test_it_says_this_is_the_only_automatic_mail(self):
        assert "einzige automatische" in render_welcome(email_locale="de")

    def test_it_still_offers_the_notification_settings(self):
        """Anders als bei der Löschbestätigung existiert das Konto hier — die
        gewöhnliche Fußzeile ist richtig."""
        assert "/settings/notifications" in render_welcome(email_locale="de")

    def test_both_languages_render(self):
        for locale in ("de", "en"):
            html = render_welcome(email_locale=locale)
            assert "<html" in html and len(html) > 2000
