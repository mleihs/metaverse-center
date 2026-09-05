"""The warning that was never sent (Handoff P2.17).

The system deducts RP and hands a seat to an AI **without warning first**. The
player learned of the penalty from the next cycle briefing — after it had
already happened. A punishment nobody saw coming is not a rule, it is a
surprise, and it is the largest gap in the post.

These tests are about what the mail must SAY. The cross-template properties
(contrast, preheader, text part, List-Unsubscribe, no keyframes) are the
parallel session's P3.28 and apply to this template automatically.
"""

from __future__ import annotations

import re

import pytest

from backend.services.email_templates import html_to_text, render_deadline_reminder

_RED = "#ef4444"
_GREEN = "#4ade80"


def _render(**overrides) -> str:
    kwargs = {
        "email_locale": "de",
        "epoch_name": "Der Gaslicht-Bezirk",
        "cycle_number": 3,
        "hours_remaining": 2,
        "open_items": ["Operative entsenden", "Botschaft besetzen"],
        "done_items": ["Zonenbefehl erteilt"],
        "penalty_rp": 1,
        "ai_takeover_next": False,
        "cta_url": "https://metaverse.center/epoch/x",
    }
    kwargs.update(overrides)
    return render_deadline_reminder(**kwargs)


class TestItSaysWhatIsAtStake:
    def test_the_countdown_is_there(self):
        assert "NOCH 2 STD." in _render()

    def test_the_cycle_and_epoch_are_named(self):
        html = _render()
        assert "Zyklus 3" in html
        assert "Gaslicht-Bezirk" in html

    def test_the_penalty_is_stated_in_numbers(self):
        assert "Du verlierst 1 RP" in _render(penalty_rp=1)
        assert "Du verlierst 3 RP" in _render(penalty_rp=3)

    def test_the_ai_takeover_only_appears_when_it_applies(self):
        """A threat that is always shown stops being read."""
        assert "übergibt deinen Platz an eine KI" in _render(ai_takeover_next=True)
        assert "übergibt deinen Platz an eine KI" not in _render(ai_takeover_next=False)

    def test_open_items_are_listed(self):
        html = _render()
        assert "Operative entsenden" in html
        assert "Botschaft besetzen" in html

    def test_filed_items_are_counter_signed(self):
        """The point of listing what is done is that the reader can tell at a
        glance whether this concerns them at all."""
        html = _render(done_items=["Zonenbefehl erteilt"])
        assert "Zonenbefehl erteilt" in html
        assert _GREEN in html

    def test_it_works_without_filed_items(self):
        html = _render(done_items=None)
        assert "Operative entsenden" in html
        assert "BEREITS EINGEREICHT" not in html


class TestItThreatensOnlyWhatHappens:
    """Measured on production before this was written: NONE of the seven epochs
    has `afk_penalty_enabled` set. A mail threatening an RP loss would threaten
    something that does not occur — the same defect as the wipe text that
    announced losses the mechanic never inflicted (Befund D12).
    """

    def test_without_a_configured_penalty_it_states_the_real_loss(self):
        html = _render(penalty_rp=None, ai_takeover_next=False)
        assert "ohne deine Befehle gewertet" in html
        assert "Du verlierst" not in html

    def test_with_a_penalty_it_names_the_number(self):
        html = _render(penalty_rp=2)
        assert "Du verlierst 2 RP" in html
        assert "ohne deine Befehle gewertet" not in html

    def test_the_consequence_block_is_never_empty(self):
        """A red box with nothing in it would be pure alarm."""
        for rp in (None, 1, 5):
            html = _render(penalty_rp=rp)
            block = html[html.index("WENN DER ZYKLUS") : html.index("</table>", html.index("WENN DER ZYKLUS"))]
            assert len(block) > 200, f"leerer Konsequenzblock bei penalty_rp={rp}"

    def test_zero_is_treated_as_no_penalty(self):
        """`afk_rp_penalty: 0` is a configured non-punishment, not a loss of 0 RP."""
        assert "ohne deine Befehle gewertet" in _render(penalty_rp=0)


class TestRedMeansLoss:
    """Handoff P1.14: red only where something is actually forfeited."""

    def test_red_appears_in_the_consequence_block(self):
        assert _RED in _render()

    def test_every_use_of_red_sits_in_the_consequence_row(self):
        """Each occurrence checked, not a hand-drawn region around one of them.

        The first version of this test sliced the HTML from the block's HEADING
        and went red — because the block's own `border:1px solid #ef4444` lives
        on the `<table>` tag, which comes before the heading. The assertion was
        aimed at the wrong span, not at a real leak. Now every occurrence is
        located and asked which row it is in.
        """
        html = _render(ai_takeover_next=True)
        rows = re.findall(r"<tr>.*?</tr>", html, re.S)
        assert rows, "Zeilen nicht gefunden — das Muster stimmt nicht mehr"

        red_rows = [row for row in rows if _RED in row]
        assert red_rows, "Rot kommt gar nicht vor — dann prüft dieser Test nichts"

        for row in red_rows:
            assert "WENN DER ZYKLUS" in row, "Rot außerhalb des Konsequenzblocks: " + re.sub(r"\s+", " ", row)[:160]

    def test_the_call_to_action_is_not_red(self):
        html = _render()
        rows = re.findall(r"<tr>.*?</tr>", html, re.S)
        cta_rows = [row for row in rows if "BEFEHLE EINREICHEN" in row]
        assert cta_rows, "Handlungsknopf nicht gefunden"
        for row in cta_rows:
            assert _RED not in row, "Der Handlungsknopf ist rot — Rot ist für Verlust reserviert"


class TestBothLanguages:
    @pytest.mark.parametrize(
        ("locale", "needle"),
        [("de", "NOCH 2 STD."), ("en", "2h REMAINING")],
    )
    def test_the_countdown_is_translated(self, locale, needle):
        assert needle in _render(email_locale=locale)

    def test_the_lang_attribute_follows_the_locale(self):
        assert 'lang="de"' in _render(email_locale="de")
        assert 'lang="en"' in _render(email_locale="en")


class TestItIsSafeAndReadable:
    def test_item_text_is_escaped(self):
        html = _render(open_items=['<script>alert("x")</script>'])
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_the_epoch_name_is_escaped(self):
        assert "<b>" not in _render(epoch_name="<b>bold</b>")

    def test_the_plain_text_part_carries_the_essentials(self):
        """`EmailService.send` derives the text part from this HTML."""
        text = html_to_text(_render(ai_takeover_next=True))
        assert "NOCH 2 STD." in text
        assert "Du verlierst 1 RP" in text
        assert "Operative entsenden" in text
        assert "<" not in text, f"Markup im Textteil: {text[:200]}"

    def test_no_animation(self):
        """Handoff P1.12 — and half the clients drop it anyway."""
        assert "@keyframes" not in _render()

    def test_there_is_exactly_one_call_to_action(self):
        html = _render()
        assert len(re.findall(r'href="https://metaverse\.center/epoch/x"', html)) <= 2, (
            "Mehr als ein Ziel im selben Knopf (mso-Zweig plus regulärer Zweig ist erlaubt)"
        )
