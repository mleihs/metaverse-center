"""Email HTML templates for the platform.

All templates use inline CSS and table layout for maximum email client compatibility.
No external CSS, no images (better deliverability).

Supports single-language (email_locale="en"/"de") or bilingual rendering.
Per-simulation accent colors thread through all templates via accent_color parameter.
"""

from __future__ import annotations

import colorsys
import logging
from collections import Counter
from functools import lru_cache
from html.parser import HTMLParser

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Per-simulation accent colors ──────────────────────────────────────────

_SIM_EMAIL_COLORS: dict[str, str] = {
    "velgarien": "#ff6b2b",
    "the-gaslit-reach": "#0d7377",
    "station-null": "#00cc88",
    "speranza": "#C08A10",
    "cite-des-dames": "#1E3A8A",
}

# ── Per-simulation narrative voice ────────────────────────────────────────

_SIM_HEADERS: dict[str, dict[str, str]] = {
    "velgarien": {
        "en": "BUREAU DIRECTIVE // CYCLE DEBRIEF",
        "de": "BÜRODIREKTIVE // ZYKLUS-LAGEBERICHT",
    },
    "the-gaslit-reach": {
        "en": "GLIMHAVEN DISPATCH // INTELLIGENCE PRÉCIS",
        "de": "GLIMHAVEN-DEPESCHE // GEHEIMDIENSTÜBERSICHT",
    },
    "station-null": {
        "en": "HAVEN SYSTEM // ANOMALY REPORT",
        "de": "HAVEN-SYSTEM // ANOMALIEBERICHT",
    },
    "speranza": {
        "en": "FRONTIER COMMAND // TACTICAL BRIEF",
        "de": "GRENZKOMMANDO // TAKTISCHE KURZMELDUNG",
    },
    "cite-des-dames": {
        "en": "COUNCIL OF THE CITY // SCHOLARLY RECORD",
        "de": "RAT DER STADT // GELEHRTENPROTOKOLL",
    },
}


def get_sim_accent(slug: str | None) -> str:
    """Return a readable accent color for a simulation slug, falling back to amber.

    The stored value is the world's brand colour; what leaves this function is
    that colour raised until it is legible on ``_BG``. Two of the five entries
    were below WCAG AA when measured (2026-08-30): ``cite-des-dames`` #1E3A8A at
    **1.91:1** and ``the-gaslit-reach`` #0d7377 at **3.52:1**. The first is the
    worse of the two because the CTA paints the accent as a BACKGROUND and sets
    ``color:{_BG}`` on top — dark blue on black, an invisible button.

    The lift happens here rather than in the table so that a colour added later
    cannot reintroduce the defect: every new world is corrected on the way out.
    """
    return _ensure_readable(_SIM_EMAIL_COLORS.get(slug or "", _AMBER))


def get_sim_header(slug: str | None, lang: str) -> str:
    """Return per-simulation section header, falling back to default."""
    headers = _SIM_HEADERS.get(slug or "", {})
    if headers:
        return headers.get(lang, headers.get("en", _nt("sitrep_header", lang)))
    return _nt("sitrep_header", lang)


# ── i18n strings (legacy — kept for backward compat) ─────────────────────


def epoch_invitation_subject(epoch_name: str, locale: str = "en") -> str:
    """Return the localized email subject line."""
    return f"{_nt('inv_subject', locale)} \u2014 {epoch_name}"


# ── Simulation invitation ─────────────────────────────────────────────────


def simulation_invitation_subject(simulation_name: str, inviter: str, email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    return _nt("sim_inv_subject", lang, inviter=_esc(inviter), simulation=_esc(simulation_name))


def render_simulation_invitation(
    *,
    simulation_name: str,
    inviter: str,
    invite_url: str,
    invited_role: str = "viewer",
    expires_at: str | None = None,
    email_locale: str | None = None,
) -> str:
    """Invitation into a simulation.

    There was no template, because there was no mail: ``InvitationService``
    stored an address and a token and returned, with no ``EmailService`` import
    anywhere near it. The invited person was never told (finding E3) — the
    invitation existed only in a table.

    Transactional, so it carries no unsubscribe link: someone put this person's
    name down by hand, and there is no list to leave.
    """
    lang = _resolve_lang(email_locale)
    accent = _AMBER
    safe_sim = _esc(simulation_name)
    safe_inviter = _esc(inviter)
    role_key = f"role_{invited_role}"
    role_label = _nt(role_key, lang) if role_key in _NOTIF_STRINGS else _esc(invited_role)

    expiry_html = ""
    if expires_at:
        expiry_html = f"""\
          <tr>
            <td style="padding:0 32px 8px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                {_nt("sim_inv_expiry", lang, date=_esc(expires_at[:10]))}
              </p>
            </td>
          </tr>"""

    body = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("sim_inv_header", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("sim_inv_kicker", lang)}
              </p>
              <h1 style="margin:0 0 8px;padding-bottom:8px;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};border-bottom:2px solid {_BORDER};">
                {safe_sim}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 16px;">
              <p style="margin:0 0 12px;font-size:15px;color:{_TEXT};line-height:1.6;">
                {_nt("sim_inv_lead", lang, inviter=safe_inviter, simulation=safe_sim)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px dashed {_BORDER};">
                <tr>
                  <td style="padding:10px 16px;">
                    <span style="font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                      {_nt("sim_inv_role_label", lang)}
                    </span><br>
                    <span style="font-size:15px;color:{accent};font-weight:bold;">{role_label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
{expiry_html}
{_cta_button(invite_url, _nt("sim_inv_cta", lang), accent=accent)}
          <tr>
            <td style="padding:0 32px 8px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                {_nt("sim_inv_ignore", lang)}
              </p>
            </td>
          </tr>
{_invitation_footer_row(email_locale)}"""

    return _email_shell(
        f"CLASSIFIED // ACCESS REQUEST \u2014 {safe_sim}",
        body,
        lang=lang,
        preheader=_nt("sim_inv_preheader", lang, role=role_label, simulation=safe_sim),
    )


# ── Subject and preheader ─────────────────────────────────────────────────
#
# Subject, preheader and body are ONE contract: what the subject promises, the
# preheader qualifies and the body delivers. They live next to each other so a
# change to one is visibly a change to the others.
#
# The old subjects opened with the sender's rubber stamp — "CLASSIFIED // SITREP
# — Operation Shadow — Cycle 3" spends its first 25 characters on a word that is
# identical in every message the platform has ever sent, and roughly 35 are
# visible on a phone. The change goes first now (handoff P1.8).


def _fmt_num(value: float, lang: str) -> str:
    """One decimal place, with the reader's decimal separator.

    A German subject line reading "Gesamtwert 72.3" is a small tell that the
    message was written for someone else.
    """
    text = f"{value:.1f}"
    return text.replace(".", ",") if lang == "de" else text


def _fmt_delta(value: float, lang: str) -> str:
    sign = "+" if value >= 0 else "\u2212"
    return f"{sign}{_fmt_num(abs(value), lang)}"


def cycle_briefing_subject(data: dict, email_locale: str | None) -> str:
    """Subject for the cycle briefing: what moved, not who is writing."""
    lang = _resolve_lang(email_locale)
    rank = int(data.get("rank") or 0)
    total = int(data.get("total_players") or 0)
    if not rank or not total:
        return _nt("subj_cycle_unranked", lang, n=data.get("cycle_number", 0), epoch=data.get("epoch_name", ""))

    prev = int(data.get("prev_rank") or 0)
    if prev and prev > rank:
        arrow = f"\u2191{prev - rank}"
    elif prev and prev < rank:
        arrow = f"\u2193{rank - prev}"
    else:
        arrow = ""
    return _nt("subj_cycle", lang, n=data.get("cycle_number", 0), rank=rank, total=total, arrow=arrow).strip()


def cycle_briefing_preheader(data: dict, email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    if not int(data.get("rank") or 0):
        return _nt("pre_cycle_unranked", lang)
    return _nt(
        "pre_cycle",
        lang,
        score=_fmt_num(float(data.get("composite", 0)), lang),
        delta=_fmt_delta(float(data.get("composite_delta", 0)), lang),
        resolved=int(data.get("resolved_ops") or 0),
        success=int(data.get("success_ops") or 0),
        detected=int(data.get("detected_ops") or 0),
    )


def phase_change_subject(epoch_name: str, old_phase: str, new_phase: str, email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    if old_phase == "lobby":
        return _nt("subj_phase_begins", lang, epoch=epoch_name)
    if new_phase == "reckoning":
        return _nt("subj_phase_final", lang, epoch=epoch_name)
    phase_key = f"phase_{new_phase}"
    phase_label = _nt(phase_key, lang) if phase_key in _NOTIF_STRINGS else new_phase.upper()
    return _nt("subj_phase_other", lang, epoch=epoch_name, phase=phase_label)


def phase_change_preheader(cycle_count: int, standing_data: dict | None, email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    if standing_data and standing_data.get("rank"):
        return _nt(
            "pre_phase_standing",
            lang,
            rank=standing_data["rank"],
            total=standing_data.get("total_players", 0),
            n=cycle_count,
        )
    return _nt("pre_phase_plain", lang, n=cycle_count)


def epoch_completed_subject(epoch_name: str, leaderboard: list[dict], player_simulation_id: str, email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    rank = next(
        (i for i, e in enumerate(leaderboard, start=1) if e.get("simulation_id") == player_simulation_id),
        0,
    )
    if rank == 1:
        return _nt("subj_done_won", lang, epoch=epoch_name)
    if rank:
        return _nt("subj_done_placed", lang, epoch=epoch_name, rank=rank, total=len(leaderboard))
    return _nt("subj_done_won", lang, epoch=epoch_name).split(" \u2013 ")[0]


def epoch_completed_preheader(leaderboard: list[dict], email_locale: str | None) -> str:
    lang = _resolve_lang(email_locale)
    if not leaderboard:
        return _nt("pre_phase_plain", lang, n=0)
    winner = leaderboard[0]
    score = float(winner.get("composite_score", winner.get("composite", 0)) or 0)
    return _nt(
        "pre_done",
        lang,
        winner=_esc(str(winner.get("simulation_name") or winner.get("name") or "?")),
        score=_fmt_num(score, lang),
    )


def render_epoch_invitation(
    epoch_name: str,
    lore_text: str,
    invite_url: str,
    *,
    email_locale: str | None = None,
    accent_color: str | None = None,
    cycle_hours: int = 8,
) -> str:
    """Render the epoch invitation email.

    Military tactical dispatch aesthetic:
    - Dark background, monospace font, per-simulation accent color
    - Sections: intro, operation name, intel dossier, mission params, rules, CTA

    There used to be a second language parameter here, a positional ``locale``,
    and NOTHING read it: the body resolved ``email_locale`` and the caller
    passed the invitee's choice to ``locale`` (finding E9). Two parameters for
    one concept, one of them dead — so an invitee who asked for German got the
    default. The parameter is gone rather than wired up, because the second one
    would have been the next thing to rot.

    ``cycle_hours`` decides the sentence "N-hour cycles" in the mission
    parameters. It defaulted to 8 and no caller passed it, so a 24-hour epoch
    invited people to an 8-hour one.
    """
    safe_name = _esc(epoch_name)
    safe_lore = _esc(lore_text)
    lang = _resolve_lang(email_locale)
    accent = accent_color or _AMBER

    blocks: list[str] = [
        _render_invitation_block(
            safe_name,
            safe_lore,
            invite_url,
            lang,
            is_primary=True,
            accent=accent,
            cycle_hours=cycle_hours,
        ),
        _cta_button(invite_url, _nt("inv_cta", lang), accent=accent),
        _invitation_footer_row(email_locale),
    ]

    content = "\n".join(blocks)
    return _email_shell(
        f"CLASSIFIED // EPOCH SUMMONS \u2014 {safe_name}",
        content,
        lang=lang,
        preheader=_nt("pre_invitation", lang),
    )


def _render_invitation_block(
    epoch_name: str,
    lore_text: str,
    invite_url: str,
    lang: str,
    *,
    is_primary: bool = True,
    accent: str = "",
    cycle_hours: int = 8,
) -> str:
    """Render a single language block for the epoch invitation email."""
    if not accent:
        accent = _AMBER
    heading_tag = "h1" if is_primary else "h2"
    heading_size = "22px" if is_primary else "20px"

    # Header (only primary gets the top border)
    if is_primary:
        header = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_header", lang)}
              </p>
            </td>
          </tr>"""
    else:
        header = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_header", lang)}
              </p>
            </td>
          </tr>"""

    # Introduction — classified warning + deployment briefing
    intro = f"""\
          <tr>
            <td style="padding:{"24px" if is_primary else "8px"} 32px 8px;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;text-align:center;">
                {_nt("inv_intro_1", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;">
              <div style="border-left:3px solid {accent};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:15px;line-height:1.8;color:{_TEXT};font-weight:bold;">
                  {_nt("inv_summons", lang)}
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 16px;">
              <p style="margin:0;font-size:15px;line-height:1.8;color:{_TEXT_DIM};">
                {_nt("inv_intro_2", lang)}
              </p>
            </td>
          </tr>"""

    # Classification urgency bar
    urgency = f"""\
          <tr>
            <td style="padding:8px 32px 0;">
              <div style="border-left:3px solid {accent};padding:4px 12px;">
                <p style="margin:0;font-size:12px;letter-spacing:2px;color:{accent};text-transform:uppercase;font-weight:bold;">
                  &#9888; {_nt("inv_urgency", lang)}
                </p>
              </div>
            </td>
          </tr>"""

    # Operation name. The stamp animation is gone with its keyframe: the project
    # forbids stamp aesthetics and rotated elements, and `rotate(-4deg)` was
    # exactly that. A static name in the accent colour carries the same weight.
    op_name = f"""\
{urgency}
          <tr>
            <td style="padding:12px 32px 4px;">
              <p style="margin:0 0 2px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_operation", lang)}
              </p>
              <{heading_tag} style="margin:0 0 8px;padding-bottom:8px;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};border-bottom:2px solid {_BORDER};">
                {epoch_name}
              </{heading_tag}>
            </td>
          </tr>"""

    # Intel dossier (AI-generated lore — classified document style)
    if is_primary or lang == "en":
        intel = _section_header(_nt("inv_intel", lang))
        intel += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};border-left:3px solid {accent};padding:20px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:15px;line-height:1.8;color:{_TEXT};font-style:italic;">
                  {lore_text}
                </p>
              </div>
            </td>
          </tr>"""
    else:
        # DE secondary block: reference the English lore above
        intel = _section_header(_nt("inv_intel", lang))
        intel += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};font-style:italic;padding:0 4px;">
                {_nt("inv_intel_see_above", lang)}
              </p>
            </td>
          </tr>"""

    # Mission parameters (updated for v2.3 game mechanics)
    mp_bullets = [
        _nt("inv_mp_1", lang),
        _nt("inv_mp_2", lang),
        _nt("inv_mp_3", lang),
        _nt("inv_mp_4", lang, hours=cycle_hours),
    ]
    mp_items = ""
    for bullet in mp_bullets:
        mp_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {bullet}
                </p>"""

    mission = _section_header(_nt("inv_mission_params", lang))
    mission += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
{mp_items}
              </div>
            </td>
          </tr>"""

    # Rules of engagement (updated for v2.3 game mechanics)
    roe_bullets = [
        _nt("inv_roe_1", lang),
        _nt("inv_roe_2", lang),
        _nt("inv_roe_3", lang),
        _nt("inv_roe_4", lang),
    ]
    roe_items = ""
    for bullet in roe_bullets:
        roe_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {bullet}
                </p>"""

    rules = _section_header(_nt("inv_rules", lang))
    rules += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
{roe_items}
              </div>
            </td>
          </tr>"""

    return f"{header}\n{intro}\n{op_name}\n{intel}\n{mission}\n{rules}"


def _resolve_lang(email_locale: str | None) -> str:
    """Resolve the ONE language a message is written in.

    It used to return a list, and an unset locale meant both: every section of
    every mail rendered twice, back to back, separated by a divider. The cycle
    briefing has nine sections, so an unset locale produced eighteen — the
    reader scrolled past a full copy of the message in a language they had not
    asked for before reaching the end of the one they had.

    A locale is now always resolved to a single language, English when nothing
    is known. The other language belongs on the web view, behind a link, not
    stapled underneath (handoff P1.9).
    """
    return email_locale if email_locale in ("en", "de") else "en"


def _esc(text: str) -> str:
    """Escape HTML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


# ── Shared building blocks ──────────────────────────────────────────────

_MONO = "'Courier New',Courier,monospace"
_BG = "#0a0a0a"
_SURFACE = "#111"
_BORDER = "#333"
_BORDER_SUBTLE = "#222"
_TEXT = "#ccc"
_TEXT_DIM = "#888"
# 5.73:1 on _BG. Was #666 at 3.45:1 — below WCAG AA, and used for the whole
# footer at 10px, i.e. the smallest text in the mail carried the worst contrast.
# The footer size moves to 12px with it (handoff P0.2).
_TEXT_DARK = "#8a8a8a"
_AMBER = "#f59e0b"
_GREEN = "#4ade80"
_RED = "#ef4444"
_GRAY = "#666"


# ── Plain-text alternative ────────────────────────────────────────────────


class _TextExtractor(HTMLParser):
    """Turn one of this module's mails into a readable plain-text part.

    Written rather than pulled in: the input is not arbitrary web HTML but our
    own table-based mail, so a small parser over the stdlib is both sufficient
    and dependency-free.

    What it has to get right:

    * ``<style>`` and ``<head>`` content must not leak into the body — otherwise
      the text part opens with a wall of CSS, which reads as spam to both the
      filter and the human.
    * A link is useless in plain text without its target, so ``<a href>`` prints
      as ``text (url)``. A link whose text already IS the url prints once.
    * The invisible preheader must be skipped: it exists to be shown *instead*
      of body text in the inbox list, so repeating it at the top of the body is
      a stutter.
    * Table cells are the layout of every mail here; each row therefore ends a
      line, or the whole message collapses into one paragraph.
    """

    # A blank line separates blocks; a table ROW is just the next line. Treating
    # them alike doubles the height of every stat table in the mail.
    _BLOCK = {"p", "div", "h1", "h2", "h3", "h4", "table", "hr"}
    _LINE = {"tr", "br", "li"}
    _SKIP = {"style", "script", "head", "title"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._skip_depth = 0
        self._hidden_depth = 0
        self._href: str | None = None
        self._link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP:
            self._skip_depth += 1
            return
        attr = dict(attrs)
        if self._hidden_depth or "display:none" in (attr.get("style") or "").replace(" ", ""):
            self._hidden_depth += 1
            return
        if tag == "a":
            self._href = attr.get("href")
            self._link_text = []
        elif tag in self._BLOCK:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if self._hidden_depth:
            self._hidden_depth -= 1
            return
        if tag == "a":
            text = "".join(self._link_text).strip()
            href = self._href or ""
            if href and href != text:
                self._parts.append(f"{text} ({href})" if text else href)
            else:
                self._parts.append(text)
            self._href = None
            self._link_text = []
        elif tag in self._BLOCK or tag in self._LINE:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth or self._hidden_depth:
            return
        if self._href is not None:
            self._link_text.append(data)
        else:
            self._parts.append(data)

    def text(self) -> str:
        raw = "".join(self._parts)
        # Collapse runs of spaces, then runs of blank lines — the table markup
        # produces a great many of both.
        lines = [" ".join(line.split()) for line in raw.split("\n")]
        cleaned: list[str] = []
        for line in lines:
            if line or (cleaned and cleaned[-1]):
                cleaned.append(line)
        return "\n".join(cleaned).strip()


def html_to_text(html: str) -> str:
    """Plain-text alternative for an HTML mail.

    Every message this module sends was HTML-only: ``MIMEMultipart("alternative")``
    was constructed and then given a single part, and the Resend payload had no
    ``text`` field at all. That costs deliverability with every major filter, and
    leaves plain-text readers with nothing.
    """
    extractor = _TextExtractor()
    extractor.feed(html)
    extractor.close()
    return extractor.text()


# ── Contrast floor ────────────────────────────────────────────────────────
#
# Email cannot use the design tokens: Outlook and Gmail do not resolve CSS
# variables, so this module keeps its own palette as constants (see the handoff,
# "Hex ist hier korrekt"). What it must not inherit from that exemption is the
# freedom to be unreadable — hence a measured floor rather than hand-picked
# replacements.

_CONTRAST_FLOOR = 4.5  # WCAG AA for normal text


def _relative_luminance(hex_color: str) -> float:
    """WCAG relative luminance of an #rgb / #rrggbb colour."""
    raw = hex_color.lstrip("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    channels = []
    for offset in (0, 2, 4):
        value = int(raw[offset : offset + 2], 16) / 255
        channels.append(value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(foreground: str, background: str) -> float:
    """WCAG contrast ratio between two colours (1.0 … 21.0)."""
    a, b = _relative_luminance(foreground), _relative_luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


@lru_cache(maxsize=64)
def _ensure_readable(hex_color: str, background: str = "#0a0a0a") -> str:
    """Raise a colour's lightness until it clears the contrast floor.

    Hue and saturation are preserved — the world keeps its colour, it only stops
    being a colour nobody can see. Lightness climbs in 1 % steps, which converges
    in well under a hundred iterations and lands on the FIRST value that passes
    rather than washing the colour out to white.

    ``background`` defaults to the mail background instead of referencing ``_BG``
    so this helper stays usable before that constant is read, and so a caller can
    check against a panel surface.
    """
    if contrast_ratio(hex_color, background) >= _CONTRAST_FLOOR:
        return hex_color

    raw = hex_color.lstrip("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    r, g, b = (int(raw[i : i + 2], 16) / 255 for i in (0, 2, 4))
    hue, lightness, saturation = colorsys.rgb_to_hls(r, g, b)

    while lightness < 1.0:
        lightness = min(1.0, lightness + 0.01)
        nr, ng, nb = colorsys.hls_to_rgb(hue, lightness, saturation)
        candidate = f"#{round(nr * 255):02x}{round(ng * 255):02x}{round(nb * 255):02x}"
        if contrast_ratio(candidate, background) >= _CONTRAST_FLOOR:
            return candidate
    return "#ffffff"


def _delta_arrow(delta: float, lang: str = "en") -> str:
    """Return colored arrow for a score delta, in the reader's number format."""
    if delta > 0:
        return f'<span style="color:{_GREEN};">&#9650; +{_fmt_num(delta, lang)}</span>'
    if delta < 0:
        return f'<span style="color:{_RED};">&#9660; \u2212{_fmt_num(abs(delta), lang)}</span>'
    return f'<span style="color:{_GRAY};">&ndash; 0.0</span>'


def _rank_arrow(current: int, previous: int) -> str:
    """Return colored arrow for rank change (lower rank = better)."""
    if previous == 0:
        return ""
    diff = previous - current  # positive = improved
    if diff > 0:
        return f'<span style="color:{_GREEN};">&#9650; (+{diff})</span>'
    if diff < 0:
        return f'<span style="color:{_RED};">&#9660; ({diff})</span>'
    return f'<span style="color:{_GRAY};">&ndash;</span>'


def _score_bar(value: float, max_val: float = 100.0, accent: str = _AMBER) -> str:
    """Render a 10-cell ASCII-style score bar as HTML table cells."""
    filled = min(10, max(0, round(value / max_val * 10))) if max_val > 0 else 0
    cells = ""
    for i in range(10):
        bg = accent if i < filled else "#1a1a1a"
        cells += f'<td style="width:16px;height:12px;background-color:{bg};border:1px solid #222;padding:0;"></td>'
    return f'<table role="presentation" cellpadding="0" cellspacing="1" style="display:inline-table;vertical-align:middle;"><tr>{cells}</tr></table>'


# Zero-width fillers. Without them the client keeps pulling body text into the
# inbox preview after the preheader ends, which puts the decorative header back
# where the preheader was supposed to be.
_PREHEADER_FILL = "&#847;&zwnj;&nbsp;" * 40


def _email_shell(title: str, content: str, *, lang: str = "en", preheader: str) -> str:
    """Wrap content in the standard dark email shell.

    Supports dark mode declarations for Apple Mail/iOS, Outlook.com and Gmail.

    ``preheader`` is required, not optional. It is the line the inbox shows next
    to the subject, and until now every message spent it on decoration: the
    first visible text was "BUREAU DIRECTIVE // CYCLE DEBRIEF", i.e. the reader
    learned the sender's rubber stamp instead of their own rank. It is the
    second most valuable line in the message and there is exactly one of it, so
    the parameter has no default — a new template has to decide (handoff P1.7).
    """
    return f"""\
<!DOCTYPE html>
<html lang="{lang}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>{title}</title>
  <style>
    :root {{ color-scheme: light dark; }}
    @media (prefers-color-scheme: dark) {{
      body, .email-bg {{ background-color: {_BG} !important; }}
      .email-text {{ color: {_TEXT} !important; }}
    }}
    [data-ogsc] body, [data-ogsc] .email-bg {{ background-color: {_BG} !important; }}
    [data-ogsc] .email-text {{ color: {_TEXT} !important; }}
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:{_BG};font-family:{_MONO};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{preheader}</div>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{_PREHEADER_FILL}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:{_BG};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
{content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _section_header(label: str) -> str:
    """Render a dossier section header row.

    The rule used to be fifteen box-drawing glyphs padded around the label.
    A screen reader announces every one of them by name, and on a narrow phone
    they wrapped. It is a border now: same line, no text (handoff P1.10).
    """
    return f"""\
          <tr>
            <td style="padding:20px 32px 8px;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;border-bottom:1px dashed {_BORDER_SUBTLE};padding-bottom:6px;">
                {_esc(label)}
              </p>
            </td>
          </tr>"""


def _cta_button(url: str, label: str, *, accent: str = _AMBER) -> str:
    """Render the call-to-action row.

    Built as a table cell with a ``bgcolor`` ATTRIBUTE rather than a padded
    ``<a>``: Outlook's word-processor renderer drops padding on inline anchors,
    which left the button as bare underlined text on the one client most likely
    to be reading this at work. The ``mso`` conditional gives that renderer a
    VML rectangle instead, so it draws the same shape.

    The block characters that framed the label are gone — they were read out
    one by one by screen readers and said nothing (handoff P1.10, P1.13).
    """
    safe_url = _esc(url)
    safe_label = _esc(label)
    return f"""\
          <tr>
            <td align="center" style="padding:24px 32px 32px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                           href="{safe_url}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="0%"
                           strokecolor="{accent}" fillcolor="{accent}">
                <w:anchorlock/>
                <center style="color:{_BG};font-family:{_MONO};font-size:14px;font-weight:bold;letter-spacing:2px;">
                  {safe_label}
                </center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="{accent}" style="border:2px solid {accent};">
                    <a href="{safe_url}"
                       style="display:block;padding:14px 32px;color:{_BG};font-family:{_MONO};font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">
                      {safe_label}
                    </a>
                  </td>
                </tr>
              </table>
              <!--<![endif]-->
            </td>
          </tr>"""


def _security_footer_row(email_locale: str | None = None) -> str:
    """Footer for mail about the account itself, not about the game.

    The ordinary `_footer_row` offers "manage all notifications" pointing at
    `/settings/notifications`. In a deletion confirmation that is a link to an
    account that no longer exists — useless, and confusing at exactly the wrong
    moment. The shared footer quietly assumes the reader still has an account.

    What stays is the legal link and the sentence that this kind of post cannot
    be switched off, because a security notice with an unsubscribe link is
    either a lie or a vulnerability.
    """
    lang = _resolve_lang(email_locale)
    legal = "Impressum &amp; Datenschutz" if lang == "de" else "Legal notice &amp; privacy"
    notice = (
        "Dies ist eine Sicherheitsnachricht zu deinem Konto. Sie kann nicht abbestellt werden."
        if lang == "de"
        else "This is a security message about your account. It cannot be unsubscribed from."
    )
    return f"""\
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px dashed {_BORDER_SUBTLE};">
              <p style="margin:0 0 8px;font-size:11px;line-height:1.6;color:{_TEXT_DIM};">
                {notice}
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;">
                <a href="{_esc(settings.site_url.rstrip("/"))}/privacy" style="color:{_TEXT_DIM};">{legal}</a>
              </p>
            </td>
          </tr>"""


def _invitation_footer_row(email_locale: str | None = None) -> str:
    """Footer for mail whose reader may not have an account yet.

    Both invitations used ``_footer_row``, which offers "manage all
    notifications" pointing at ``/settings/notifications``. An invited person
    often has no account at all — the link goes to a login for something they
    have not got, in the one mail whose whole purpose is to say "come in".

    Not ``_security_footer_row`` either, though it would pass the test: that
    footer says "this is a security message about your account, it cannot be
    unsubscribed from", and an invitation is neither about an account nor about
    security. A footer that passes a check while telling the reader something
    false is worse than the link it replaced.

    So: the legal link, the operator, the origin line — and one honest sentence
    about why there is nothing to unsubscribe from. Someone who was invited and
    does nothing hears nothing further; that is worth saying, because the fear
    the missing unsubscribe link raises is exactly "will this keep coming?".
    """
    lang = _resolve_lang(email_locale)
    link_style = f"color:{_TEXT_DARK};text-decoration:underline;"
    notice = (
        "Du bekommst diese Nachricht, weil dich jemand eingeladen hat. "
        "Es gibt nichts abzubestellen: Wenn du nichts tust, hörst du nichts weiter von uns."
        if lang == "de"
        else "You are getting this because someone invited you. There is nothing to "
        "unsubscribe from: if you do nothing, you will not hear from us again."
    )
    legal = _nt("footer_legal", lang)
    return f"""\
          <tr>
            <td style="padding:20px 32px;border-top:1px solid {_BORDER_SUBTLE};">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:{_TEXT_DARK};">
                {notice}
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:{_TEXT_DARK};">
                <a href="{_esc(settings.site_url.rstrip("/"))}/privacy" style="{link_style}">{legal}</a>
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:{_TEXT_DARK};">
                {_nt("footer_operator", lang)}
              </p>
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DARK};text-transform:uppercase;">
                {_nt("footer_origin", lang)}
              </p>
            </td>
          </tr>"""


def _footer_row(email_locale: str | None = None, *, unsubscribe_url: str | None = None) -> str:
    """Render the standard footer.

    Three obligations meet here, and all three were unmet (handoff P0.2/4/6):

    * **Readability.** The whole block ran at 10px in ``#666`` — 3.45:1 on the
      mail background, below WCAG AA, and the smallest type in the message
      carried the worst contrast of anything in it. Now 12px in ``_TEXT_DARK``
      (5.73:1).
    * **A way out.** The single link pointed at ``{site_url}/settings``, a route
      that does not exist. There are now two, as required: leave THIS kind of
      mail (one click, no login — ``unsubscribe_url``), and manage everything.
    * **Provider identification.** Mail sent to German-speaking recipients has
      to name its operator. The line mirrors what the privacy page already
      publishes; it invents nothing.
    """
    footer_lang = email_locale if email_locale in ("en", "de") else "en"
    link_style = f"color:{_TEXT_DARK};text-decoration:underline;"

    links = []
    if unsubscribe_url:
        links.append(f'<a href="{unsubscribe_url}" style="{link_style}">{_nt("footer_unsubscribe", footer_lang)}</a>')
    links.append(
        f'<a href="{settings.site_url}/settings/notifications" style="{link_style}">'
        f'{_nt("footer_manage", footer_lang)}</a>'
    )
    links.append(f'<a href="{settings.site_url}/privacy" style="{link_style}">{_nt("footer_legal", footer_lang)}</a>')
    link_row = "&nbsp;&middot;&nbsp;".join(links)

    return f"""\
          <tr>
            <td style="padding:20px 32px;border-top:1px solid {_BORDER_SUBTLE};">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:{_TEXT_DARK};">
                {link_row}
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:{_TEXT_DARK};">
                {_nt("footer_operator", footer_lang)}
              </p>
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DARK};text-transform:uppercase;">
                {_nt("footer_origin", footer_lang)}
              </p>
            </td>
          </tr>"""


def _dashed_box(content_html: str) -> str:
    """Wrap content in the standard dashed-border box."""
    return f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
{content_html}
              </div>
            </td>
          </tr>"""


def _bullet_list(items: list[str]) -> str:
    """Render a list of bullet items."""
    html = ""
    for item in items:
        html += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {item}
                </p>"""
    return html


# ── Bilingual strings for notification emails ────────────────────────────

_NOTIF_STRINGS: dict[str, dict[str, str]] = {
    "sitrep_header": {
        "en": "CLASSIFIED // SITUATION REPORT",
        "de": "GEHEIM // LAGEBERICHT",
    },
    "cycle_resolved": {
        "en": "CYCLE {n} RESOLVED",
        "de": "ZYKLUS {n} ABGESCHLOSSEN",
    },
    "phase_label": {
        "en": "PHASE",
        "de": "PHASE",
    },
    "your_standing": {
        "en": "YOUR STANDING",
        "de": "DEINE POSITION",
    },
    "rank": {
        "en": "RANK",
        "de": "RANG",
    },
    "composite": {
        "en": "COMPOSITE",
        "de": "GESAMT",
    },
    "rp_reserve": {
        "en": "RP RESERVE",
        "de": "RP-RESERVE",
    },
    "dimension_analysis": {
        "en": "DIMENSION ANALYSIS",
        "de": "DIMENSIONSANALYSE",
    },
    "stability": {
        "en": "STABILITY",
        "de": "STABILIT\u00c4T",
    },
    "influence": {
        "en": "INFLUENCE",
        "de": "EINFLUSS",
    },
    "sovereignty": {
        "en": "SOVEREIGNTY",
        "de": "SOUVER\u00c4NIT\u00c4T",
    },
    "diplomatic": {
        "en": "DIPLOMATIC",
        "de": "DIPLOMATIE",
    },
    "military": {
        "en": "MILITARY",
        "de": "MILIT\u00c4R",
    },
    "operative_status": {
        "en": "OPERATIVE DEPLOYMENT LOG",
        "de": "AGENTEN-EINSATZPROTOKOLL",
    },
    "active": {
        "en": "ACTIVE",
        "de": "AKTIV",
    },
    "resolved": {
        "en": "RESOLVED",
        "de": "ABGESCHLOSSEN",
    },
    "guardians": {
        "en": "GUARDIANS",
        "de": "W\u00c4CHTER",
    },
    "counter_intel": {
        "en": "COUNTER-INTEL",
        "de": "SPIONAGEABWEHR",
    },
    "signal_intercepts": {
        "en": "SIGNAL INTERCEPTS",
        "de": "ABGEFANGENE SIGNALE",
    },
    "no_intercepts": {
        "en": "No public signals intercepted this cycle.",
        "de": "Keine \u00f6ffentlichen Signale in diesem Zyklus abgefangen.",
    },
    "cta": {
        "en": "ENTER THE COMMAND CENTER",
        "de": "ZUR KOMMANDOZENTRALE",
    },
    # Briefing enrichment (B1-B7)
    "threat_assessment": {
        "en": "THREAT ASSESSMENT",
        "de": "BEDROHUNGSANALYSE",
    },
    "no_threats": {
        "en": "No inbound threats detected this cycle.",
        "de": "Keine eingehenden Bedrohungen in diesem Zyklus erkannt.",
    },
    "spy_intel": {
        "en": "SPY INTEL DIGEST",
        "de": "SPIONAGE-NACHRICHTENÜBERSICHT",
    },
    "no_intel": {
        "en": "No intelligence gathered this cycle.",
        "de": "Keine Aufklärungsergebnisse in diesem Zyklus.",
    },
    "next_cycle": {
        "en": "NEXT CYCLE PREVIEW",
        "de": "VORSCHAU NÄCHSTER ZYKLUS",
    },
    "pending_missions": {
        "en": "PENDING MISSIONS",
        "de": "AUSSTEHENDE MISSIONEN",
    },
    "rp_projection": {
        "en": "RP PROJECTION",
        "de": "RP-PROGNOSE",
    },
    "alliance_status": {
        "en": "ALLIANCE STATUS",
        "de": "ALLIANZSTATUS",
    },
    "no_alliance": {
        "en": "Operating independently \u2014 no active alliance.",
        "de": "Unabhängig operierend \u2014 keine aktive Allianz.",
    },
    "alliance_dissolved": {
        "en": "Alliance '{name}' has collapsed under internal tensions!",
        "de": "Allianz \u201e{name}\u201c ist unter internen Spannungen zerbrochen!",
    },
    "alliance_dissolved_hint": {
        "en": "All former members are now operating independently. Overlapping operations caused irreconcilable friction.",
        "de": "Alle ehemaligen Mitglieder operieren jetzt unabh\u00e4ngig. \u00dcberlappende Operationen f\u00fchrten zu un\u00fcberbr\u00fcckbaren Spannungen.",
    },
    "pending_proposals_label": {
        "en": "{n} alliance proposals await your vote",
        "de": "{n} B\u00fcndnisantr\u00e4ge warten auf Abstimmung",
    },
    "team_tension": {
        "en": "Alliance tension: {t}/100",
        "de": "Allianzspannung: {t}/100",
    },
    "alliance_upkeep_label": {
        "en": "Alliance upkeep: -{cost} RP this cycle",
        "de": "Allianzunterhalt: -{cost} RP diesen Zyklus",
    },
    "alliance_bonus": {
        "en": "+15% DIPLOMATIC BONUS ACTIVE",
        "de": "+15% DIPLOMATIEBONUS AKTIV",
    },
    "rank_gap_leading": {
        "en": "Leading by {gap} points",
        "de": "Führt mit {gap} Punkten Vorsprung",
    },
    "rank_gap_trailing": {
        "en": "{gap} points behind #{pos}",
        "de": "{gap} Punkte hinter #{pos}",
    },
    "mission_target": {
        "en": "TARGET",
        "de": "ZIEL",
    },
    "mission_outcome": {
        "en": "OUTCOME",
        "de": "ERGEBNIS",
    },
    # Phase change strings
    "phase_change_header": {
        "en": "CLASSIFIED // PHASE TRANSITION",
        "de": "GEHEIM // PHASEN\u00dcBERGANG",
    },
    "phase_transition": {
        "en": "PHASE TRANSITION",
        "de": "PHASEN\u00dcBERGANG",
    },
    "from_to": {
        "en": "{old} &#10132; {new}",
        "de": "{old} &#10132; {new}",
    },
    "cycles_elapsed": {
        "en": "CYCLES ELAPSED",
        "de": "VERGANGENE ZYKLEN",
    },
    "phase_lobby": {
        "en": "LOBBY",
        "de": "LOBBY",
    },
    "phase_foundation": {
        "en": "FOUNDATION",
        "de": "GRUNDSTEINLEGUNG",
    },
    "phase_competition": {
        "en": "COMPETITION",
        "de": "WETTBEWERB",
    },
    "phase_reckoning": {
        "en": "RECKONING",
        "de": "ABRECHNUNG",
    },
    "phase_completed": {
        "en": "COMPLETED",
        "de": "ABGESCHLOSSEN",
    },
    "phase_cancelled": {
        "en": "CANCELLED",
        "de": "ABGEBROCHEN",
    },
    "what_changes": {
        "en": "OPERATIONAL CHANGES",
        "de": "OPERATIVE \u00c4NDERUNGEN",
    },
    # Epoch completed strings
    "epoch_complete_header": {
        "en": "CLASSIFIED // OPERATION COMPLETE",
        "de": "GEHEIM // OPERATION ABGESCHLOSSEN",
    },
    "final_standings": {
        "en": "FINAL STANDINGS",
        "de": "ENDSTAND",
    },
    "winner": {
        "en": "OPERATION VICTOR",
        "de": "OPERATIONSSIEGER",
    },
    "winner_you": {
        "en": "VICTORY IS YOURS",
        "de": "DER SIEG GEHÖRT DIR",
    },
    "winner_quip": {
        "en": "Every empire falls. Yours just hasn't yet.",
        "de": "Jedes Imperium fällt. Deines nur noch nicht.",
    },
    "inv_urgency": {
        "en": "PRIORITY ALPHA // IMMEDIATE ACTION REQUIRED",
        "de": "PRIORITÄT ALPHA // SOFORTIGES HANDELN ERFORDERLICH",
    },
    "your_result": {
        "en": "YOUR FINAL POSITION",
        "de": "DEINE ENDPOSITION",
    },
    "dimension_titles": {
        "en": "DIMENSION TITLES AWARDED",
        "de": "VERLIEHENE DIMENSIONSTITEL",
    },
    "total_cycles": {
        "en": "TOTAL CYCLES",
        "de": "ZYKLEN GESAMT",
    },
    "campaign_stats": {
        "en": "YOUR CAMPAIGN STATISTICS",
        "de": "DEINE KAMPAGNENSTATISTIK",
    },
    "ops_deployed": {
        "en": "OPERATIVES DEPLOYED",
        "de": "EINGESETZTE AGENTEN",
    },
    "success_rate": {
        "en": "SUCCESS RATE",
        "de": "ERFOLGSRATE",
    },
    "dimension_race": {
        "en": "DIMENSION TITLE RACE",
        "de": "DIMENSIONSTITEL-RENNEN",
    },
    # Epoch invitation strings
    "inv_subject": {
        "en": "CLASSIFIED // EPOCH SUMMONS",
        "de": "GEHEIM // EPOCHEN-EINBERUFUNG",
    },
    "inv_header": {
        "en": "CLASSIFIED // EPOCH SUMMONS",
        "de": "GEHEIM // EPOCHEN-EINBERUFUNG",
    },
    "inv_intro_1": {
        "en": "This transmission is classified. Do not forward.",
        "de": "Diese \u00dcbertragung ist als GEHEIM eingestuft. Nicht weiterleiten.",
    },
    "inv_summons": {
        "en": "An operative seat has been reserved for you. Take command of your faction before the deployment window closes.",
        "de": "Ein Operativsitz wurde f\u00fcr Sie reserviert. \u00dcbernehmen Sie das Kommando \u00fcber Ihre Fraktion, bevor das Einsatzfenster schlie\u00dft.",
    },
    "inv_intro_2": {
        "en": "A competitive epoch is forming \u2013 five dimensions, no second chances. The deployment window is limited. Report to the Command Center before it closes.",
        "de": "Eine kompetitive Epoche formiert sich \u2013 f\u00fcnf Dimensionen, keine zweite Chance. Das Einsatzfenster ist begrenzt. Melden Sie sich in der Kommandozentrale, bevor es schlie\u00dft.",
    },
    "inv_operation": {
        "en": "OPERATION",
        "de": "OPERATION",
    },
    "inv_intel": {
        "en": "INTEL DISPATCH",
        "de": "GEHEIMDIENSTBERICHT",
    },
    "inv_mission_params": {
        "en": "MISSION PARAMETERS",
        "de": "MISSIONSPARAMETER",
    },
    "inv_mp_1": {
        "en": "Draft your agents from your simulation roster \u2014 each has unique aptitudes",
        "de": "Rekrutieren Sie Agenten aus Ihrem Simulationskader \u2014 jeder hat einzigartige Eignungen",
    },
    "inv_mp_2": {
        "en": "Deploy 6 operative types: Spy, Guardian, Saboteur, Propagandist, Infiltrator, Assassin",
        "de": "Entsenden Sie 6 Agententypen: Spion, W\u00e4chter, Saboteur, Propagandist, Infiltrator, Attent\u00e4ter",
    },
    "inv_mp_3": {
        "en": "Forge alliances or betray your rivals for strategic advantage",
        "de": "Schmieden Sie Allianzen oder verraten Sie Ihre Rivalen f\u00fcr strategischen Vorteil",
    },
    "inv_mp_4": {
        "en": "Real-time decisions in {hours}-hour cycles with fog-of-war intelligence",
        "de": "Echtzeit-Entscheidungen in {hours}-Stunden-Zyklen mit Kriegsnebel-Aufkl\u00e4rung",
    },
    "inv_rules": {
        "en": "RULES OF ENGAGEMENT",
        "de": "EINSATZREGELN",
    },
    "inv_roe_1": {
        "en": "Each player commands one simulation's forces",
        "de": "Jeder Spieler kommandiert die Streitkr\u00e4fte einer Simulation",
    },
    "inv_roe_2": {
        "en": "Score across 5 dimensions: Stability, Influence, Sovereignty, Diplomatic, Military",
        "de": "Punkten Sie in 5 Dimensionen: Stabilit\u00e4t, Einfluss, Souver\u00e4nit\u00e4t, Diplomatie, Milit\u00e4r",
    },
    "inv_roe_3": {
        "en": "Agent aptitudes determine operative success probability",
        "de": "Agenteneignungen bestimmen die Erfolgswahrscheinlichkeit von Eins\u00e4tzen",
    },
    "inv_roe_4": {
        "en": "Bot opponents with distinct AI personalities may fill open slots",
        "de": "Bot-Gegner mit eigenen KI-Pers\u00f6nlichkeiten k\u00f6nnen offene Pl\u00e4tze f\u00fcllen",
    },
    "inv_cta": {
        "en": "TAKE COMMAND",
        "de": "KOMMANDO \u00dcBERNEHMEN",
    },
    "inv_intel_see_above": {
        "en": "See intelligence dispatch above.",
        "de": "Siehe Geheimdienstbericht oben.",
    },
    "mission_type_header": {
        "en": "TYPE",
        "de": "TYP",
    },
    "threat_from": {
        "en": "from",
        "de": "von",
    },
    "threat_status_detected": {
        "en": "DETECTED",
        "de": "ERKANNT",
    },
    "threat_status_captured": {
        "en": "CAPTURED",
        "de": "GEFASST",
    },
    "intel_zone_analysis": {
        "en": "Zone security analysis: {target} \u2014 {breakdown}.",
        "de": "Zonensicherheitsanalyse: {target} \u2014 {breakdown}.",
    },
    "intel_guardian_count": {
        "en": "Guardian deployment: {target} has {count} active guardian(s).",
        "de": "W\u00e4chtereinsatz: {target} hat {count} aktive(n) W\u00e4chter.",
    },
    "intel_zone_low": {
        "en": "LOW",
        "de": "NIEDRIG",
    },
    "intel_zone_medium": {
        "en": "MEDIUM",
        "de": "MITTEL",
    },
    "intel_zone_high": {
        "en": "HIGH",
        "de": "HOCH",
    },
    "leaderboard_sim": {
        "en": "SIM",
        "de": "SIM",
    },
    "you_label": {
        "en": "You",
        "de": "Du",
    },
    "subj_cycle": {
        "en": "Cycle {n} \u00b7 Rank {rank} of {total} {arrow}",
        "de": "Zyklus {n} \u00b7 Rang {rank} von {total} {arrow}",
    },
    "subj_cycle_unranked": {
        "en": "Cycle {n} resolved \u00b7 {epoch}",
        "de": "Zyklus {n} aufgel\u00f6st \u00b7 {epoch}",
    },
    "pre_cycle": {
        "en": "Composite {score} ({delta}). {resolved} operations resolved, {success} succeeded, {detected} detected.",
        "de": "Gesamtwert {score} ({delta}). {resolved} Operationen aufgel\u00f6st, {success} gelungen, {detected} aufgeflogen.",
    },
    "pre_cycle_unranked": {
        "en": "No score was recorded for this cycle yet.",
        "de": "F\u00fcr diesen Zyklus liegt noch keine Wertung vor.",
    },
    "subj_phase_begins": {
        "en": "{epoch} begins \u00b7 first orders are due",
        "de": "{epoch} beginnt \u00b7 die ersten Befehle stehen an",
    },
    "subj_phase_final": {
        "en": "Final phase \u00b7 {epoch}",
        "de": "Letzte Phase \u00b7 {epoch}",
    },
    "subj_phase_other": {
        "en": "{epoch} enters {phase}",
        "de": "{epoch} tritt in {phase} ein",
    },
    "pre_phase_standing": {
        "en": "You stand {rank} of {total} after {n} cycles.",
        "de": "Du stehst nach {n} Zyklen auf Rang {rank} von {total}.",
    },
    "pre_phase_plain": {
        "en": "{n} cycles played. What counts changes from here.",
        "de": "{n} Zyklen gespielt. Ab hier z\u00e4hlt anderes.",
    },
    "subj_done_won": {
        "en": "{epoch} decided \u2013 you won",
        "de": "{epoch} entschieden \u2013 du hast gewonnen",
    },
    "subj_done_placed": {
        "en": "{epoch} decided \u2013 you placed {rank} of {total}",
        "de": "{epoch} entschieden \u2013 Platz {rank} von {total}",
    },
    "pre_done": {
        "en": "{winner} took the operation with {score}. Final standings and your campaign record inside.",
        "de": "{winner} entschied die Operation mit {score}. Endstand und deine Bilanz stehen darin.",
    },
    "pre_invitation": {
        "en": "An operation is forming. Your seat is held until the token expires.",
        "de": "Eine Operation formiert sich. Dein Platz ist reserviert, bis das Token verf\u00e4llt.",
    },
    "pre_clearance_granted": {
        "en": "The Forge is open to you. Starter tokens are on your account.",
        "de": "Die Schmiede steht dir offen. Startguthaben liegt auf deinem Konto.",
    },
    "pre_clearance_denied": {
        "en": "Your clearance request was reviewed and not granted this time.",
        "de": "Dein Antrag auf Freigabe wurde gepr\u00fcft und diesmal nicht bewilligt.",
    },
    "podium_heading": {
        "en": "The podium",
        "de": "Das Podium",
    },
    "sim_inv_header": {
        "en": "BUREAU OF MULTIVERSE OBSERVATION",
        "de": "B\u00dcRO F\u00dcR MULTIVERSUM-BEOBACHTUNG",
    },
    "sim_inv_kicker": {
        "en": "Access request",
        "de": "Zugangsgesuch",
    },
    "sim_inv_lead": {
        "en": "{inviter} has entered your name on the roll of <strong>{simulation}</strong>.",
        "de": "{inviter} hat deinen Namen in die Liste von <strong>{simulation}</strong> eingetragen.",
    },
    "sim_inv_role_label": {
        "en": "Standing granted",
        "de": "Erteilter Stand",
    },
    "sim_inv_expiry": {
        "en": "The token expires on {date}. After that the invitation has to be issued again.",
        "de": "Das Token verf\u00e4llt am {date}. Danach muss die Einladung neu ausgestellt werden.",
    },
    "sim_inv_cta": {
        "en": "Accept the invitation",
        "de": "Einladung annehmen",
    },
    "sim_inv_ignore": {
        "en": "If you were not expecting this, nothing happens when you do nothing.",
        "de": "Wenn du damit nicht gerechnet hast: Nichtstun ist folgenlos.",
    },
    "sim_inv_subject": {
        "en": "{inviter} invites you into {simulation}",
        "de": "{inviter} l\u00e4dt dich in {simulation} ein",
    },
    "sim_inv_preheader": {
        "en": "A standing of {role} in {simulation}. One link, no account needed yet.",
        "de": "Ein Stand als {role} in {simulation}. Ein Link, noch ohne Konto.",
    },
    "role_viewer": {"en": "Observer", "de": "Beobachter"},
    "role_editor": {"en": "Editor", "de": "Bearbeiter"},
    "role_admin": {"en": "Administrator", "de": "Verwalter"},
    "role_owner": {"en": "Owner", "de": "Eigent\u00fcmer"},
    "act_heading": {
        "en": "What to do now",
        "de": "Was jetzt zu tun ist",
    },
    "act_deadline_hours": {
        "en": "The next cycle resolves in about {n} h.",
        "de": "Der n\u00e4chste Zyklus wird in etwa {n} Std. aufgel\u00f6st.",
    },
    "act_deadline_manual": {
        "en": "The next cycle resolves once every player is ready.",
        "de": "Der n\u00e4chste Zyklus wird aufgel\u00f6st, sobald alle bereit sind.",
    },
    "act_budget": {
        "en": "You hold {rp} RP, {projected} after the next grant.",
        "de": "Du hast {rp} RP, nach der n\u00e4chsten Zuteilung {projected}.",
    },
    "act_cost": {
        "en": "Without orders the cycle acts without you \u2013 and it costs {rp} RP.",
        "de": "Ohne Befehle handelt der Zyklus ohne dich \u2013 und kostet {rp} RP.",
    },
    "act_no_cost": {
        "en": "Without orders the cycle acts without you.",
        "de": "Ohne Befehle handelt der Zyklus ohne dich.",
    },
    "footer_origin": {
        "en": "TRANSMISSION ORIGIN: metaverse.center",
        "de": "ÜBERTRAGUNGSURSPRUNG: metaverse.center",
    },
    "footer_unsubscribe": {
        "en": "Unsubscribe from these emails",
        "de": "Diese Benachrichtigungen abbestellen",
    },
    "footer_manage": {
        "en": "Manage all notifications",
        "de": "Alle Benachrichtigungen verwalten",
    },
    "footer_operator": {
        "en": "metaverse.center is operated by Ing. Mag. Matthias Leihs, BSc, Austria.",
        "de": "metaverse.center wird betrieben von Ing. Mag. Matthias Leihs, BSc, Österreich.",
    },
    "footer_legal": {
        "en": "Legal notice &amp; privacy",
        "de": "Impressum &amp; Datenschutz",
    },
    "subject_urgent_final": {
        "en": "URGENT // FINAL PHASE",
        "de": "DRINGEND // LETZTE PHASE",
    },
    "subject_ops_commence": {
        "en": "CLASSIFIED // OPERATIONS COMMENCE",
        "de": "GEHEIM // OPERATIONEN BEGINNEN",
    },
    "subject_phase_transition": {
        "en": "CLASSIFIED // PHASE TRANSITION",
        "de": "GEHEIM // PHASENÜBERGANG",
    },
    # ── Account deletion (P2.23, DSGVO Art. 17) ──
    # Sicherheitspost: nüchtern, nicht abbestellbar, kein Rollenspiel.
    "deleted_header": {
        "en": "YOUR ACCOUNT HAS BEEN DELETED",
        "de": "DEIN KONTO WURDE GELÖSCHT",
    },
    "pre_deleted": {
        "en": "Your account and personal data have been removed.",
        "de": "Dein Konto und deine personenbezogenen Daten wurden entfernt.",
    },
    "deleted_subject": {
        "en": "Your metaverse.center account has been deleted",
        "de": "Dein Konto bei metaverse.center wurde gelöscht",
    },
    "deleted_lead": {
        "en": "The account for this address has been deleted, together with the personal data held for it.",
        "de": "Das Konto für diese Adresse wurde gelöscht, zusammen mit den dazu gespeicherten personenbezogenen Daten.",
    },
    "deleted_irreversible": {
        "en": "This cannot be undone. Signing in with this address is no longer possible.",
        "de": "Das lässt sich nicht rückgängig machen. Eine Anmeldung mit dieser Adresse ist nicht mehr möglich.",
    },
    "deleted_worlds_header": {
        "en": "WHAT REMAINS",
        "de": "WAS BLEIBT",
    },
    # Wichtig und rechtlich relevant: die Welten werden NICHT gelöscht, sondern
    # übertragen (`admin_delete_user`, Migr. 040/113). Das zu verschweigen wäre
    # die bequemere, aber falsche Mail.
    "deleted_worlds": {
        "en": "Worlds you created stay on the platform and their ownership has passed to the operators. They no longer carry your name or your account.",
        "de": "Von dir erstellte Welten bleiben auf der Plattform, ihre Inhaberschaft ist an den Betrieb übergegangen. Sie tragen weder deinen Namen noch dein Konto.",
    },
    "deleted_no_worlds": {
        "en": "No worlds were held under this account.",
        "de": "Unter diesem Konto lagen keine Welten.",
    },
    "deleted_contact": {
        "en": "If you did not expect this, reply to this message.",
        "de": "Wenn du damit nicht gerechnet hast, antworte auf diese Nachricht.",
    },
    # ── Welcome (P2.21) ──
    # Die erste Nachricht, die ein neues Konto je bekommt. Sie darf genau EINEN
    # ersten Schritt nennen; zwei gleichrangige Knöpfe wählen nichts aus. Kein
    # Freigabe-Vokabular: `clearance` ist eine echte Mechanik im Spiel, und wer
    # sie hier benutzt, verspricht etwas, das noch niemand erteilt hat.
    "welcome_header": {
        "en": "YOUR ACCOUNT IS READY",
        "de": "DEIN KONTO IST BEREIT",
    },
    "pre_welcome": {
        "en": "Your account is ready. Here is the shortest way in.",
        "de": "Dein Konto ist bereit. Hier ist der kürzeste Weg hinein.",
    },
    "welcome_subject": {
        "en": "Welcome to metaverse.center",
        "de": "Willkommen bei metaverse.center",
    },
    "welcome_lead": {
        "en": "metaverse.center runs simulated worlds. Each one has its own inhabitants, its own history and its own rules, and it keeps moving whether or not anyone is watching.",
        "de": "metaverse.center betreibt simulierte Welten. Jede hat eigene Bewohner, eine eigene Geschichte und eigene Regeln, und sie läuft weiter, ob jemand zusieht oder nicht.",
    },
    "welcome_start_header": {
        "en": "WHERE TO START",
        "de": "WO DU ANFÄNGST",
    },
    "welcome_step": {
        "en": "The quickstart takes about five minutes and ends with you standing inside a world.",
        "de": "Der Schnelleinstieg dauert etwa fünf Minuten und endet damit, dass du in einer Welt stehst.",
    },
    "welcome_cta": {
        "en": "OPEN THE QUICKSTART",
        "de": "SCHNELLEINSTIEG ÖFFNEN",
    },
    "welcome_browse": {
        "en": "You can also just look around first. The multiverse lists every public world, and reading them needs no account at all.",
        "de": "Du kannst dich auch erst umsehen. Das Multiversum listet jede öffentliche Welt, und zum Lesen brauchst du gar kein Konto.",
    },
    "welcome_pace": {
        "en": "Nothing here demands a daily visit. Worlds advance on their own; you decide when you take part.",
        "de": "Nichts hier verlangt einen täglichen Besuch. Die Welten laufen von allein weiter, du entscheidest, wann du mitspielst.",
    },
    # Erwartungen ehrlich setzen ist der Unterschied zwischen einer Willkommens-
    # mail und dem Beginn einer Belästigung.
    "welcome_mail_note": {
        "en": "This is the only automatic message you get for signing up. Everything else is optional and you can switch it off at any time.",
        "de": "Das ist die einzige automatische Nachricht, die du fürs Anmelden bekommst. Alles Weitere ist freiwillig und jederzeit abschaltbar.",
    },
    # ── Deadline reminder (P2.17) ──
    # Das System zog RP ab und ersetzte den Spieler durch eine KI, OHNE vorher
    # zu warnen — der Nutzer erfuhr von der Strafe erst im nächsten Lagebericht.
    "deadline_header": {
        "en": "ORDERS OUTSTANDING",
        "de": "BEFEHLE AUSSTEHEND",
    },
    "pre_deadline": {
        "en": "{hours}h left to file. Unfiled orders cost you.",
        "de": "Noch {hours} Std. zum Einreichen. Nicht eingereichte Befehle kosten.",
    },
    "deadline_subject": {
        "en": "{hours}h left \u2013 {epoch}, cycle {cycle}",
        "de": "Noch {hours} Std. \u2013 {epoch}, Zyklus {cycle}",
    },
    "deadline_countdown": {
        "en": "{hours}h REMAINING",
        "de": "NOCH {hours} STD.",
    },
    "deadline_lead": {
        "en": "Cycle {cycle} of {epoch} resolves without you unless these are filed.",
        "de": "Zyklus {cycle} von {epoch} wird ohne dich aufgelöst, wenn diese offen bleiben.",
    },
    "deadline_open_label": {
        "en": "STILL OPEN",
        "de": "NOCH OFFEN",
    },
    "deadline_done_label": {
        "en": "ALREADY FILED",
        "de": "BEREITS EINGEREICHT",
    },
    "deadline_consequence_header": {
        "en": "IF THE CYCLE RESOLVES WITHOUT YOU",
        "de": "WENN DER ZYKLUS OHNE DICH AUFGELÖST WIRD",
    },
    "deadline_consequence_none": {
        "en": "The cycle is scored without your orders.",
        "de": "Der Zyklus wird ohne deine Befehle gewertet.",
    },
    "deadline_consequence_rp": {
        "en": "You forfeit {rp} RP.",
        "de": "Du verlierst {rp} RP.",
    },
    "deadline_consequence_ai": {
        "en": "A second missed cycle hands your seat to an AI until you return.",
        "de": "Ein zweiter versäumter Zyklus übergibt deinen Platz an eine KI, bis du zurückkehrst.",
    },
    "deadline_item_orders": {
        "en": "Orders for cycle {cycle}",
        "de": "Befehle für Zyklus {cycle}",
    },
    "deadline_cta": {
        "en": "FILE ORDERS",
        "de": "BEFEHLE EINREICHEN",
    },
    # ── Clearance request emails ──
    "clearance_granted_header": {
        "en": "CLEARANCE UPGRADE APPROVED",
        "de": "FREIGABE-UPGRADE GENEHMIGT",
    },
    "clearance_granted_intro": {
        "en": "Your application for Reality Architect clearance has been approved. You now have access to the Simulation Forge – create worlds with AI-driven agents, buildings, and events.",
        "de": "Dein Antrag auf die Freigabestufe Realitätsarchitekt wurde genehmigt. Du hast jetzt Zugang zur Simulationsschmiede – erschaffe Welten mit KI-gesteuerten Agenten, Gebäuden und Ereignissen.",
    },
    "clearance_granted_cta": {
        "en": "ENTER THE FORGE",
        "de": "ZUR SCHMIEDE",
    },
    "clearance_denied_header": {
        "en": "CLEARANCE REVIEW COMPLETE",
        "de": "FREIGABEPRÜFUNG ABGESCHLOSSEN",
    },
    "clearance_denied_intro": {
        "en": "Your clearance application has been reviewed. At this time, your request for Reality Architect clearance has not been approved.",
        "de": "Dein Freigabeantrag wurde geprüft. Dein Antrag auf die Freigabestufe Realitätsarchitekt wurde derzeit nicht genehmigt.",
    },
    "clearance_admin_notes": {
        "en": "REVIEWER NOTES",
        "de": "ANMERKUNGEN DES PRÜFERS",
    },
    "clearance_tokens_granted": {
        "en": "{count} Forge Tokens credited to your account",
        "de": "{count} Schmiede-Token deinem Konto gutgeschrieben",
    },
    "clearance_tier_label": {
        "en": "CLEARANCE LEVEL",
        "de": "FREIGABESTUFE",
    },
    "clearance_observer": {
        "en": "FIELD OBSERVER",
        "de": "FELDBEOBACHTER",
    },
    "clearance_architect": {
        "en": "REALITY ARCHITECT",
        "de": "REALITÄTSARCHITEKT",
    },
    # ── Auto-Resolve & AFK ────────────────────────────────────
    "auto_resolved_banner": {
        "en": "This cycle was auto-resolved at deadline",
        "de": "Dieser Zyklus wurde bei Fristablauf automatisch aufgelöst",
    },
    "afk_warning_header": {
        "en": "ABSENCE DETECTED",
        "de": "ABWESENHEIT ERKANNT",
    },
    "afk_penalty_msg": {
        "en": "You were marked absent. RP penalty: -{rp_loss}",
        "de": "Du wurdest als abwesend markiert. RP-Strafe: -{rp_loss}",
    },
    "afk_ai_takeover_msg": {
        "en": "Your faction is now commanded by AI ({personality}) due to prolonged absence",
        "de": "Deine Fraktion wird wegen längerer Abwesenheit nun von KI ({personality}) befehligt",
    },
    "afk_consecutive_label": {
        "en": "Consecutive absences: {n}",
        "de": "Aufeinanderfolgende Abwesenheiten: {n}",
    },
    "participation_summary": {
        "en": "{acted} of {total} players acted this cycle",
        "de": "{acted} von {total} Spielern haben diesen Zyklus gehandelt",
    },
    "deadline_info": {
        "en": "Next deadline: {minutes} min after cycle start",
        "de": "Nächste Frist: {minutes} Min. nach Zyklusbeginn",
    },
}


def _nt(key: str, locale: str, **kwargs: str | int) -> str:
    """Look up a notification translated string, with optional format vars."""
    template = _NOTIF_STRINGS[key].get(locale, _NOTIF_STRINGS[key]["en"])
    if kwargs:
        return template.format(**kwargs)
    return template


# ── Operative type labels ──────────────────────────────────────────────

_OP_TYPE_LABELS: dict[str, dict[str, str]] = {
    "spy": {"en": "SPY", "de": "SPION"},
    "guardian": {"en": "GRD", "de": "WÄC"},
    "saboteur": {"en": "SAB", "de": "SAB"},
    "propagandist": {"en": "PRO", "de": "PRO"},
    "infiltrator": {"en": "INF", "de": "INF"},
    "assassin": {"en": "ASN", "de": "ATT"},
    "counter_intel": {"en": "CI", "de": "SA"},
}

_OP_STATUS_LABELS: dict[str, dict[str, str]] = {
    "success": {"en": "&#10003;", "de": "&#10003;"},
    "failed": {"en": "&#10007;", "de": "&#10007;"},
    "detected": {"en": "&#9888;", "de": "&#9888;"},
    "captured": {"en": "&#9888;", "de": "&#9888;"},
    "active": {"en": "&#8943;", "de": "&#8943;"},
}


# ── Phase descriptions ───────────────────────────────────────────────────

_PHASE_DESCRIPTIONS: dict[str, dict[str, list[str]]] = {
    "foundation": {
        "en": [
            "1.5x RP bonus per cycle during this phase.",
            "Build your foundation before competition begins.",
            "All operative types available for deployment.",
        ],
        "de": [
            "1,5-facher RP-Bonus pro Zyklus in dieser Phase.",
            "Baue dein Fundament, bevor der Wettbewerb beginnt.",
            "Alle Agententypen stehen zur Verf\u00fcgung.",
        ],
    },
    "competition": {
        "en": [
            "Standard RP allocation per cycle.",
            "Full competitive scoring is now active.",
            "Alliances and betrayals shape the leaderboard.",
        ],
        "de": [
            "Standard-RP-Zuteilung pro Zyklus.",
            "Volle Wettbewerbswertung ist jetzt aktiv.",
            "Allianzen und Verrat pr\u00e4gen die Rangliste.",
        ],
    },
    "reckoning": {
        "en": [
            "Final phase &mdash; last chance to turn the tide.",
            "Score multipliers may be amplified.",
            "Decisive moves carry greater weight.",
        ],
        "de": [
            "Letzte Phase &mdash; letzte Chance, das Blatt zu wenden.",
            "Punktemultiplikatoren k\u00f6nnen verst\u00e4rkt werden.",
            "Entscheidende Z\u00fcge haben gr\u00f6\u00dferes Gewicht.",
        ],
    },
    "completed": {
        "en": [
            "The operation has concluded.",
            "Final standings have been recorded.",
            "Game instances are being archived.",
        ],
        "de": [
            "Die Operation ist abgeschlossen.",
            "Der Endstand wurde festgehalten.",
            "Spielinstanzen werden archiviert.",
        ],
    },
}


# Dimension title translations
_TITLE_TRANSLATIONS: dict[str, dict[str, str]] = {
    "The Unshaken": {"en": "The Unshaken", "de": "Der Unersch\u00fctterliche"},
    "The Resonant": {"en": "The Resonant", "de": "Der Einflussreiche"},
    "The Sovereign": {"en": "The Sovereign", "de": "Der Souver\u00e4ne"},
    "The Architect": {"en": "The Architect", "de": "Der Architekt"},
    "The Shadow": {"en": "The Shadow", "de": "Der Schatten"},
}


# ── Cycle Briefing Template ─────────────────────────────────────────────



def _action_row(data: dict, lang: str, *, accent: str) -> str:
    """The one instruction in a message otherwise made of results.

    The briefing was nine sections of data and no sentence telling the reader
    what to do with any of it (handoff P1.15). This box goes FIRST, before the
    standing, because a briefing that opens with a rank invites a glance and
    a close.

    Every number in it is read from the epoch's own configuration. The handoff
    proposed the copy "and it costs 1 RP"; measured, the default penalty is
    2 RP and ``afk_penalty_enabled`` defaults to FALSE — so a fixed sentence
    would have threatened most readers with a punishment their epoch does not
    apply, which is worse than saying nothing.
    """
    lines: list[str] = []

    deadline_minutes = data.get("cycle_deadline_minutes")
    if deadline_minutes:
        lines.append(_nt("act_deadline_hours", lang, n=max(1, round(int(deadline_minutes) / 60))))
    else:
        lines.append(_nt("act_deadline_manual", lang))

    lines.append(
        _nt(
            "act_budget",
            lang,
            rp=data.get("rp_balance", 0),
            # "+12 → 30 / 40" carries the cap; the sentence only wants the
            # number the player will hold.
            projected=_esc(str(data.get("next_cycle_rp_projection", "")))
            .split("\u2192")[-1]
            .split("/")[0]
            .strip()
            or data.get("rp_balance", 0),
        )
    )

    penalty = int(data.get("afk_rp_penalty") or 0)
    if data.get("afk_penalty_enabled") and penalty > 0:
        lines.append(_nt("act_cost", lang, rp=penalty))
    else:
        lines.append(_nt("act_no_cost", lang))

    body = "".join(
        f'<p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">{line}</p>' for line in lines
    )
    return f"""\
          <tr>
            <td style="padding:8px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border:2px solid {accent};background-color:{_SURFACE};">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:{accent};text-transform:uppercase;font-weight:bold;">
                      {_nt("act_heading", lang)}
                    </p>
                    {body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""


def _render_briefing_block(data: dict, lang: str, *, accent: str = _AMBER) -> str:
    """Render a single language block for the cycle briefing.

    Sections: standing, rank gap, dimensions, mission log, threats,
    spy intel, alliance status, next cycle preview, signal intercepts.
    """
    dims = data.get("dimensions", [])
    events = data.get("public_events", [])
    missions = data.get("missions", [])
    threats = data.get("threats", [])
    spy_intel = data.get("spy_intel", [])

    # ── Standing box ──
    rank_str = f"#{data['rank']} / {data['total_players']}"
    rank_delta = _rank_arrow(data["rank"], data.get("prev_rank", 0))

    # Rank gap indicator (B3) — uses _nt() for proper i18n
    rank_gap_html = ""
    rank_gap = data.get("rank_gap")
    if rank_gap:
        if rank_gap.get("type") == "leading":
            gap_text = _nt("rank_gap_leading", lang, gap=rank_gap["gap"])
        elif rank_gap.get("type") == "trailing":
            gap_text = _nt("rank_gap_trailing", lang, gap=rank_gap["gap"], pos=rank_gap["pos"])
        else:
            # Legacy format: pre-formatted bilingual dict
            gap_text = rank_gap.get(lang, rank_gap.get("en", ""))
        if gap_text:
            gap_color = _GREEN if data.get("rank") == 1 else _TEXT
            rank_gap_html = f"""\
                  <tr>
                    <td colspan="2" style="font-size:12px;color:{gap_color};padding:2px 0 4px;text-align:right;font-style:italic;">
                      {gap_text}
                    </td>
                  </tr>"""

    standing_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:16px 20px;background-color:{_SURFACE};">
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                  {_nt("your_standing", lang)}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px;">
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("rank", lang)}</td>
                    <td style="font-size:14px;color:{_TEXT};text-align:right;padding:4px 0;">{rank_str} {rank_delta}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("composite", lang)}</td>
                    <td style="font-size:14px;color:{accent};font-weight:bold;text-align:right;padding:4px 0;">{_fmt_num(float(data["composite"]), lang)} {_delta_arrow(data["composite_delta"], lang)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("rp_reserve", lang)}</td>
                    <td style="font-size:14px;color:{_TEXT};text-align:right;padding:4px 0;">{data["rp_balance"]} / {data["rp_cap"]}</td>
                  </tr>
{rank_gap_html}
                </table>
              </div>
            </td>
          </tr>"""

    # ── Auto-resolve banner + AFK warnings (Phase 7) ──
    auto_resolve_html = ""
    if data.get("auto_resolved"):
        auto_resolve_html = f"""\
          <tr>
            <td style="padding:4px 32px 12px;">
              <div style="border:1px solid {_AMBER};padding:10px 16px;background-color:#231c11;">
                <p style="margin:0;font-size:12px;color:{_AMBER};font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                  &#9888; {_nt("auto_resolved_banner", lang)}
                </p>
              </div>
            </td>
          </tr>"""

    afk_html = ""
    if data.get("player_was_afk"):
        afk_items = f"""\
                <p style="margin:0 0 4px;font-size:12px;color:{_RED};font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                  {_nt("afk_warning_header", lang)}
                </p>"""

        afk_penalty = data.get("afk_penalty_rp", 0)
        if afk_penalty > 0:
            afk_items += f"""\
                <p style="margin:4px 0;font-size:14px;color:{_RED};line-height:1.6;">
                  {_nt("afk_penalty_msg", lang, rp_loss=str(afk_penalty))}
                </p>"""

        if data.get("replaced_by_ai"):
            personality = data.get("afk_ai_personality", "sentinel")
            afk_items += f"""\
                <p style="margin:4px 0;font-size:14px;color:{_RED};font-weight:bold;line-height:1.6;">
                  &#9888; {_nt("afk_ai_takeover_msg", lang, personality=personality.upper())}
                </p>"""

        consecutive = data.get("consecutive_afk", 0)
        if consecutive > 0:
            afk_items += f"""\
                <p style="margin:4px 0 0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                  {_nt("afk_consecutive_label", lang, n=str(consecutive))}
                </p>"""

        afk_html = f"""\
          <tr>
            <td style="padding:4px 32px 12px;">
              <div style="border:1px solid {_RED};padding:12px 16px;background-color:#1d1212;">
{afk_items}
              </div>
            </td>
          </tr>"""

    # ── Participation summary + deadline ──
    participation_html = ""
    participation = data.get("participation_summary")
    if participation:
        acted = participation.get("acted", 0)
        total = participation.get("total", 0)
        if total > 0:
            participation_html = f"""\
          <tr>
            <td style="padding:0 32px 8px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:1px;">
                {_nt("participation_summary", lang, acted=str(acted), total=str(total))}
              </p>
            </td>
          </tr>"""

    deadline_html = ""
    deadline_minutes = data.get("cycle_deadline_minutes")
    if deadline_minutes:
        deadline_html = f"""\
          <tr>
            <td style="padding:0 32px 12px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:1px;">
                {_nt("deadline_info", lang, minutes=str(deadline_minutes))}
              </p>
            </td>
          </tr>"""

    # ── Dimension bars ──
    dim_name_map = {
        "stability": _nt("stability", lang),
        "influence": _nt("influence", lang),
        "sovereignty": _nt("sovereignty", lang),
        "diplomatic": _nt("diplomatic", lang),
        "military": _nt("military", lang),
    }
    dim_rows = ""
    for d in dims:
        label = dim_name_map.get(d["name"], d["name"].upper())
        bar = _score_bar(d["value"], accent=accent)
        dim_rows += f"""\
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:1px;text-transform:uppercase;padding:5px 0;white-space:nowrap;width:100px;">{label}</td>
                    <td style="padding:5px 8px;">{bar}</td>
                    <td style="font-size:12px;color:{_TEXT};text-align:right;padding:5px 0;white-space:nowrap;width:50px;">{_fmt_num(float(d["value"]), lang)}</td>
                    <td style="font-size:12px;text-align:right;padding:5px 0;white-space:nowrap;width:60px;">{_delta_arrow(d["delta"], lang)}</td>
                  </tr>"""

    dims_html = f"""\
{_section_header(_nt("dimension_analysis", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
{dim_rows}
                </table>
              </div>
            </td>
          </tr>"""

    # ── Mission log (B7 — per-mission breakdown) ──
    if missions:
        mission_rows = ""
        for m in missions:
            op_label = _OP_TYPE_LABELS.get(m.get("type", ""), {}).get(lang, m.get("type", "?").upper()[:3])
            target = _esc(m.get("target_name", "?"))
            status = m.get("status", "active")
            status_icon = _OP_STATUS_LABELS.get(status, {}).get(lang, "?")
            status_color = (
                _GREEN if status == "success" else (_RED if status in ("detected", "captured", "failed") else _TEXT_DIM)
            )

            mission_rows += f"""\
                  <tr>
                    <td style="font-size:12px;color:{accent};font-weight:bold;padding:4px 8px 4px 0;white-space:nowrap;">{op_label}</td>
                    <td style="font-size:12px;color:{_TEXT};padding:4px 0;">{target}</td>
                    <td style="font-size:13px;color:{status_color};text-align:right;padding:4px 0 4px 8px;">{status_icon}</td>
                  </tr>"""

        ops_html = f"""\
{_section_header(_nt("operative_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 8px 6px 0;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_type_header", lang)}</td>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 0 6px;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_target", lang)}</td>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 0 6px 8px;text-align:right;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_outcome", lang)}</td>
                  </tr>
{mission_rows}
                </table>
                <p style="margin:8px 0 0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                  {_nt("guardians", lang)}: <strong style="color:{_TEXT};">{data["guardians"]}</strong>
                  &nbsp;&middot;&nbsp;
                  {_nt("counter_intel", lang)}: <strong style="color:{_TEXT};">{data["counter_intel"]}</strong>
                </p>
              </div>
            </td>
          </tr>"""
    else:
        # Fallback: aggregate view (backward compat)
        ops_html = f"""\
{_section_header(_nt("operative_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:15px;color:{_TEXT};line-height:1.8;">
                  {_nt("active", lang)}: <strong style="color:{accent};">{data["active_ops"]}</strong>
                  &nbsp;&middot;&nbsp;
                  {_nt("resolved", lang)}: <strong>{data["resolved_ops"]}</strong>
                  ({data["success_ops"]}&#10003; {data["detected_ops"]}&#10007;)
                </p>
                <p style="margin:4px 0 0;font-size:15px;color:{_TEXT};line-height:1.8;">
                  {_nt("guardians", lang)}: <strong>{data["guardians"]}</strong>
                  &nbsp;&middot;&nbsp;
                  {_nt("counter_intel", lang)}: <strong>{data["counter_intel"]}</strong>
                </p>
              </div>
            </td>
          </tr>"""

    # ── Threat assessment (B1) ──
    threat_html = ""
    if threats:
        threat_items = ""
        for t in threats:
            op_type = _OP_TYPE_LABELS.get(t.get("type", ""), {}).get(lang, "?")
            source = _esc(t.get("source_name", "Unknown"))
            raw_status = t.get("status", "detected")
            status_key = f"threat_status_{raw_status}"
            status_label = _nt(status_key, lang) if status_key in _NOTIF_STRINGS else raw_status.upper()
            threat_items += f"""\
                <p style="margin:0 0 6px;font-size:14px;color:{_RED};line-height:1.6;">
                  &#9888; {op_type} {_nt("threat_from", lang)} {source} &mdash; {status_label}
                </p>"""
        threat_html = f"{_section_header(_nt('threat_assessment', lang))}\n{_dashed_box(threat_items)}"
    elif data.get("has_threat_data"):
        # Only show "no threats" if we actually queried for threats
        threat_html = f"""\
{_section_header(_nt("threat_assessment", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};font-style:italic;padding:0 4px;">
                {_nt("no_threats", lang)}
              </p>
            </td>
          </tr>"""

    # ── Spy intel digest (B2) ──
    intel_html = ""
    if spy_intel:
        intel_items = ""
        for si in spy_intel[:5]:
            meta = si.get("metadata") or {}
            target_name = _esc(si.get("target_name", ""))
            zone_sec = meta.get("zone_security", [])
            guardian_ct = meta.get("guardian_count")
            # Build localized intel lines from structured metadata
            if zone_sec and target_name:
                level_counts = Counter(str(lv).lower() for lv in zone_sec)
                parts = []
                for lv in ("low", "medium", "high"):
                    if level_counts.get(lv):
                        lv_label = _nt(f"intel_zone_{lv}", lang)
                        zone_word = "zones" if lang == "en" else "Zonen"
                        parts.append(f"{level_counts[lv]} {zone_word} {lv_label}")
                breakdown = ", ".join(parts)
                intel_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_nt("intel_zone_analysis", lang, target=target_name, breakdown=breakdown)}
                </p>"""
            if guardian_ct is not None and target_name:
                intel_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_nt("intel_guardian_count", lang, target=target_name, count=str(guardian_ct))}
                </p>"""
            # Fallback: raw narrative if no structured metadata
            if not zone_sec and guardian_ct is None:
                intel_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_esc(si.get("narrative", ""))}
                </p>"""
        intel_html = f"{_section_header(_nt('spy_intel', lang))}\n{_dashed_box(intel_items)}"

    # ── Alliance status (B6) ──
    alliance_name = data.get("alliance_name")
    if alliance_name:
        ally_names = ", ".join(_esc(n) for n in data.get("ally_names", []))
        bonus_tag = (
            f' <span style="color:{_GREEN};font-size:12px;">&#9679; {_nt("alliance_bonus", lang)}</span>'
            if data.get("alliance_bonus_active")
            else ""
        )

        # Alliance enrichment: proposals, tension, upkeep
        alliance_details = ""
        pp_count = data.get("pending_proposals_count", 0)
        tension = data.get("alliance_tension", 0)
        upkeep = data.get("alliance_upkeep_cost", 0)

        detail_parts = []
        if pp_count > 0:
            detail_parts.append(
                f'<span style="color:{_AMBER};">&#9888; {_nt("pending_proposals_label", lang, n=pp_count)}</span>'
            )
        if tension > 0:
            tension_color = _GREEN if tension < 30 else (_AMBER if tension < 60 else _RED)
            detail_parts.append(f'<span style="color:{tension_color};">{_nt("team_tension", lang, t=tension)}</span>')
        if upkeep > 0:
            detail_parts.append(f"{_nt('alliance_upkeep_label', lang, cost=upkeep)}")

        if detail_parts:
            alliance_details = "<br>".join(detail_parts)
            alliance_details = f"""
                <p style="margin:8px 0 0;font-size:12px;color:{_TEXT_DIM};line-height:1.8;">
                  {alliance_details}
                </p>"""

        alliance_html = f"""\
{_section_header(_nt("alliance_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:14px;color:{accent};font-weight:bold;line-height:1.6;">
                  {_esc(alliance_name)}{bonus_tag}
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:{_TEXT};line-height:1.6;">
                  {ally_names}
                </p>{alliance_details}
              </div>
            </td>
          </tr>"""
    else:
        dissolved_name = data.get("dissolved_alliance_name")
        if dissolved_name:
            alliance_html = f"""\
{_section_header(_nt("alliance_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_RED};padding:12px 16px;background-color:#1e1414;">
                <p style="margin:0;font-size:14px;color:{_RED};font-weight:bold;line-height:1.6;">
                  &#9888; {_nt("alliance_dissolved", lang, name=_esc(dissolved_name))}
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                  {_nt("alliance_dissolved_hint", lang)}
                </p>
              </div>
            </td>
          </tr>"""
        else:
            alliance_html = f"""\
{_section_header(_nt("alliance_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};font-style:italic;padding:0 4px;">
                {_nt("no_alliance", lang)}
              </p>
            </td>
          </tr>"""

    # ── Next cycle preview (B4) ──
    next_cycle_html = ""
    next_missions = data.get("next_cycle_missions", 0)
    rp_projection = data.get("next_cycle_rp_projection")
    if next_missions or rp_projection:
        preview_items = ""
        if next_missions:
            preview_items += f"""\
                <p style="margin:0 0 4px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  {_nt("pending_missions", lang)}: <strong style="color:{accent};">{next_missions}</strong>
                </p>"""
        if rp_projection:
            preview_items += f"""\
                <p style="margin:0;font-size:15px;color:{_TEXT};line-height:1.6;">
                  {_nt("rp_projection", lang)}: <strong>{rp_projection}</strong>
                </p>"""
        next_cycle_html = f"{_section_header(_nt('next_cycle', lang))}\n{_dashed_box(preview_items)}"

    # ── Signal intercepts (public events) ──
    events_html = f"{_section_header(_nt('signal_intercepts', lang))}\n"
    if events:
        event_items = ""
        for ev in events[:5]:
            event_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_esc(ev["narrative"])}
                </p>"""
        events_html += _dashed_box(event_items)
    else:
        events_html += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};font-style:italic;padding:0 4px;">
                {_nt("no_intercepts", lang)}
              </p>
            </td>
          </tr>"""

    sections = [standing_html, auto_resolve_html, afk_html, participation_html, deadline_html, dims_html, ops_html]
    if threat_html:
        sections.append(threat_html)
    if intel_html:
        sections.append(intel_html)
    sections.append(alliance_html)
    if next_cycle_html:
        sections.append(next_cycle_html)
    sections.append(events_html)

    return "\n".join(sections)


def render_cycle_briefing(
    data: dict, *, email_locale: str | None = None, unsubscribe_url: str | None = None
) -> str:
    """Render the cycle briefing email.

    If email_locale is "en" or "de", renders single-language.
    Otherwise renders bilingual (EN first, then DE).

    data keys: epoch_name, epoch_status, cycle_number, rank, prev_rank,
    total_players, composite, composite_delta, dimensions, rp_balance,
    rp_cap, active_ops, resolved_ops, success_ops, detected_ops,
    guardians, counter_intel, public_events, simulation_name,
    command_center_url, accent_color, simulation_slug,
    threats, spy_intel, missions, rank_gap,
    next_cycle_missions, next_cycle_rp_projection, alliance_name,
    ally_names, alliance_bonus_active, has_threat_data,
    auto_resolved, player_was_afk, afk_penalty_rp,
    replaced_by_ai, afk_ai_personality, consecutive_afk,
    participation_summary, cycle_deadline_minutes
    """
    epoch_name = _esc(data.get("epoch_name", "Unknown"))
    cycle_number = data.get("cycle_number", 0)
    raw_phase = data.get("epoch_status", "competition")
    cta_url = data.get("command_center_url", f"{settings.site_url}/epoch")
    accent = data.get("accent_color", _AMBER)
    sim_slug = data.get("simulation_slug")
    lang = _resolve_lang(email_locale)

    # Phase name translation key mapping
    _phase_key = f"phase_{raw_phase}"

    sim_header = get_sim_header(sim_slug, lang)
    status_display = _nt(_phase_key, lang) if _phase_key in _NOTIF_STRINGS else raw_phase.upper()

    header = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {sim_header}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {epoch_name}
              </h1>
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;">
                {_nt("cycle_resolved", lang, n=cycle_number)} &middot; {_nt("phase_label", lang)}: {status_display}
              </p>
            </td>
          </tr>"""

    blocks: list[str] = [
        header,
        # The instruction comes before the results. A briefing that opens with a
        # rank invites a glance and a close (handoff P1.15).
        _action_row(data, lang, accent=accent),
        _render_briefing_block(data, lang, accent=accent),
        _cta_button(cta_url, _nt("cta", lang), accent=accent),
        _footer_row(email_locale, unsubscribe_url=unsubscribe_url),
    ]

    content = "\n".join(blocks)
    return _email_shell(
        f"CLASSIFIED // SITREP \u2014 {epoch_name}",
        content,
        lang=lang,
        preheader=cycle_briefing_preheader(data, lang),
    )


# ── Phase Change Template ────────────────────────────────────────────────


def _render_phase_block(
    epoch_name: str,
    old_phase: str,
    new_phase: str,
    cycle_count: int,
    lang: str,
    *,
    accent: str = _AMBER,
    standing_data: dict | None = None,
) -> str:
    """Render a single language block for the phase change email."""

    def _phase_label(phase: str) -> str:
        key = f"phase_{phase}"
        if key in _NOTIF_STRINGS:
            return _nt(key, lang)
        return phase.upper()

    old_name = _phase_label(old_phase)
    new_name = _phase_label(new_phase)

    descriptions = _PHASE_DESCRIPTIONS.get(new_phase, {}).get(lang, [])
    desc_items = ""
    for desc in descriptions:
        desc_items += f"""\
                <p style="margin:0 0 6px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; {desc}
                </p>"""

    # Standing data (C1 — per-player)
    standing_html = ""
    if standing_data:
        rank = standing_data.get("rank", 0)
        total = standing_data.get("total_players", 0)
        composite = standing_data.get("composite", 0)
        standing_html = f"""\
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("your_standing", lang)}</td>
                    <td style="font-size:14px;color:{accent};font-weight:bold;text-align:right;padding:4px 0;">#{rank} / {total} &middot; {_fmt_num(float(composite), lang)}</td>
                  </tr>"""

    return f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:16px 20px;background-color:{_SURFACE};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("phase_transition", lang)}</td>
                    <td style="font-size:14px;color:{accent};font-weight:bold;text-align:right;padding:4px 0;">{old_name} &#10132; {new_name}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("cycles_elapsed", lang)}</td>
                    <td style="font-size:14px;color:{_TEXT};text-align:right;padding:4px 0;">{cycle_count}</td>
                  </tr>
{standing_html}
                </table>
              </div>
            </td>
          </tr>
{_section_header(_nt("what_changes", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
{desc_items}
              </div>
            </td>
          </tr>"""


def render_phase_change(
    epoch_name: str,
    old_phase: str,
    new_phase: str,
    cycle_count: int,
    command_center_url: str,
    *,
    email_locale: str | None = None,
    accent_color: str | None = None,
    standing_data: dict | None = None,
    unsubscribe_url: str | None = None,
) -> str:
    """Render the phase change notification email.

    If email_locale is "en"/"de", renders single-language.
    standing_data: optional {rank, total_players, composite} for per-player rendering.
    """
    safe_name = _esc(epoch_name)
    cta_url = command_center_url
    accent = accent_color or _AMBER
    lang = _resolve_lang(email_locale)

    # Phase-scaled subject urgency (C2)
    if new_phase == "reckoning":
        subject_prefix = _nt("subject_urgent_final", lang)
    elif old_phase == "lobby":
        subject_prefix = _nt("subject_ops_commence", lang)
    else:
        subject_prefix = _nt("subject_phase_transition", lang)

    header = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("phase_change_header", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </h1>
            </td>
          </tr>"""

    blocks: list[str] = [
        header,
        _render_phase_block(
            safe_name,
            old_phase,
            new_phase,
            cycle_count,
            lang,
            accent=accent,
            standing_data=standing_data,
        ),
        _cta_button(cta_url, _nt("cta", lang), accent=accent),
        _footer_row(email_locale, unsubscribe_url=unsubscribe_url),
    ]

    content = "\n".join(blocks)
    return _email_shell(
        f"{subject_prefix} \u2014 {safe_name}",
        content,
        lang=lang,
        preheader=phase_change_preheader(cycle_count, standing_data, lang),
    )


# ── Epoch Completed Template ─────────────────────────────────────────────



def _podium_row(leaderboard: list[dict], player_simulation_id: str, lang: str, *, accent: str) -> str:
    """The top three, as a shape rather than three lines of a table.

    The results page in the app shows a crown and a staged reveal; the mail
    listed the same three names in a monospaced table where first and third
    looked alike (handoff P1.16). This is the same information given a form:
    second, first, third, with the winner's block taller and in the accent
    colour, aligned along a common floor.

    Built as a table with fixed cell widths and bottom alignment - the two
    things every mail client agrees on. No image, no animation.

    Deliberately NOT included: the MVP card from the prototype. It needs the
    agent's portrait, aptitude sum and a quotation, none of which this path
    fetches; a card filled with placeholders would be worse than none.
    """
    top = leaderboard[:3]
    if len(top) < 3:
        return ""

    order = [(top[1], 2), (top[0], 1), (top[2], 3)]
    heights = {1: 64, 2: 44, 3: 32}

    cells = ""
    for entry, place in order:
        is_player = entry.get("simulation_id") == player_simulation_id
        colour = accent if place == 1 else _TEXT
        block_bg = accent if place == 1 else _BORDER
        name = _esc(str(entry.get("simulation_name", "?")))
        score = _fmt_num(float(entry.get("composite", entry.get("composite_score", 0)) or 0), lang)
        marker = "&#9733; " if is_player else ""
        cells += f"""\
                  <td width="33%" valign="bottom" align="center" style="padding:0 4px;">
                    <p style="margin:0 0 4px;font-size:12px;color:{colour};text-transform:uppercase;letter-spacing:1px;">
                      {marker}{name}
                    </p>
                    <p style="margin:0 0 6px;font-size:14px;color:{colour};font-weight:bold;">{score}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td height="{heights[place]}" align="center" valign="middle"
                            bgcolor="{block_bg}" style="height:{heights[place]}px;background-color:{block_bg};">
                          <span style="font-family:{_MONO};font-size:22px;font-weight:900;color:{_BG};">{place}</span>
                        </td>
                      </tr>
                    </table>
                  </td>"""

    return f"""\
{_section_header(_nt("podium_heading", lang))}
          <tr>
            <td style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
{cells}
                </tr>
              </table>
            </td>
          </tr>"""


def _render_completed_block(
    epoch_name: str,
    leaderboard: list[dict],
    player_simulation_id: str,
    cycle_count: int,
    lang: str,
    *,
    accent: str = _AMBER,
    campaign_stats: dict | None = None,
) -> str:
    """Render a single language block for the epoch completed email."""
    # Winner — check if the recipient IS the winner
    winner = leaderboard[0] if leaderboard else None
    winner_name = _esc(winner.get("simulation_name", "Unknown")) if winner else "N/A"
    is_winner = winner and winner.get("simulation_id") == player_simulation_id

    if is_winner:
        # Dramatic celebration block for the victor
        winner_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:3px solid {accent};padding:24px 20px;background-color:{_SURFACE};text-align:center;">
                <p style="margin:0 0 8px;font-size:24px;color:{accent};letter-spacing:8px;">&#9733;&#9733;&#9733;</p>
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{accent};text-transform:uppercase;font-weight:bold;">
                  {_nt("winner_you", lang)}
                </p>
                <p style="margin:0 0 12px;font-size:24px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                  {winner_name}
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:{_TEXT};font-style:italic;">
                  {_nt("winner_quip", lang)}
                </p>
                <p style="margin:0;font-size:14px;color:{_TEXT};">
                  {_nt("composite", lang)}: {_fmt_num(float(winner["composite"]), lang)}
                </p>
              </div>
            </td>
          </tr>"""
    else:
        # Standard winner display for non-winners
        winner_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:2px solid {accent};padding:16px 20px;background-color:{_SURFACE};text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                  {_nt("winner", lang)}
                </p>
                <p style="margin:0;font-size:20px;font-weight:900;color:{accent};letter-spacing:2px;">
                  &#9733; {winner_name}
                </p>
                <p style="margin:4px 0 0;font-size:14px;color:{_TEXT};">
                  {_nt("composite", lang)}: {_fmt_num(float(winner["composite"]), lang)}
                </p>
              </div>
            </td>
          </tr>"""

    # Leaderboard table
    lb_rows = ""
    for entry in leaderboard:
        is_player = entry.get("simulation_id") == player_simulation_id
        row_bg = "#1a1a00" if is_player else "transparent"
        name_color = accent if is_player else _TEXT
        sim_name = _esc(entry.get("simulation_name", "Unknown"))

        lb_rows += f"""\
                  <tr style="background-color:{row_bg};">
                    <td style="font-size:13px;color:{_TEXT_DIM};padding:6px 4px;text-align:center;border-bottom:1px solid {_BORDER_SUBTLE};">#{entry["rank"]}</td>
                    <td style="font-size:13px;color:{name_color};padding:6px 4px;border-bottom:1px solid {_BORDER_SUBTLE};font-weight:{"bold" if is_player else "normal"};">{sim_name}</td>
                    <td style="font-size:13px;color:{accent};padding:6px 4px;text-align:right;border-bottom:1px solid {_BORDER_SUBTLE};font-weight:bold;">{_fmt_num(float(entry["composite"]), lang)}</td>
                  </tr>"""

    podium_html = _podium_row(leaderboard, player_simulation_id, lang, accent=accent)

    leaderboard_html = f"""\
{podium_html}
{_section_header(_nt("final_standings", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:{_SURFACE};border:1px dashed {_BORDER};">
                <tr>
                  <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;text-align:center;border-bottom:1px solid {_BORDER};">#</td>
                  <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;border-bottom:1px solid {_BORDER};">{_nt("leaderboard_sim", lang)}</td>
                  <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;text-align:right;border-bottom:1px solid {_BORDER};">{_nt("composite", lang)}</td>
                </tr>
{lb_rows}
              </table>
            </td>
          </tr>"""

    # Player result
    player_entry = next(
        (e for e in leaderboard if e.get("simulation_id") == player_simulation_id),
        None,
    )
    player_result_html = ""
    if player_entry:
        player_result_html = f"""\
{_section_header(_nt("your_result", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:15px;color:{_TEXT};line-height:1.8;">
                  {_nt("rank", lang)}: <strong style="color:{accent};">#{player_entry["rank"]}</strong> / {len(leaderboard)}
                  &nbsp;&middot;&nbsp;
                  {_nt("composite", lang)}: <strong style="color:{accent};">{_fmt_num(float(player_entry["composite"]), lang)}</strong>
                </p>
              </div>
            </td>
          </tr>"""

    # Campaign statistics (D1)
    campaign_html = ""
    if campaign_stats:
        total_ops = campaign_stats.get("total_ops", 0)
        success_rate = campaign_stats.get("success_rate", 0)
        by_type = campaign_stats.get("by_type", {})

        type_parts = []
        for op_type in ["spy", "guardian", "saboteur", "propagandist", "infiltrator", "assassin", "counter_intel"]:
            count = by_type.get(op_type, 0)
            if count > 0:
                label = _OP_TYPE_LABELS.get(op_type, {}).get(lang, op_type[:3].upper())
                type_parts.append(f"{label}:{count}")

        type_breakdown = " &middot; ".join(type_parts) if type_parts else "\u2014"

        campaign_html = f"""\
{_section_header(_nt("campaign_stats", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0 0 4px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  {_nt("ops_deployed", lang)}: <strong style="color:{accent};">{total_ops}</strong>
                  &nbsp;&middot;&nbsp;
                  {_nt("success_rate", lang)}: <strong>{success_rate:.0f}%</strong>
                </p>
                <p style="margin:0;font-size:12px;color:{_TEXT_DIM};line-height:1.6;">
                  {type_breakdown}
                </p>
              </div>
            </td>
          </tr>"""

    # Dimension title race results (D2)
    dim_titles = {
        "stability_title": ("stability", _nt("stability", lang)),
        "influence_title": ("influence", _nt("influence", lang)),
        "sovereignty_title": ("sovereignty", _nt("sovereignty", lang)),
        "diplomatic_title": ("diplomatic", _nt("diplomatic", lang)),
        "military_title": ("military", _nt("military", lang)),
    }
    title_items = ""
    for title_key, (dim_key, dim_label) in dim_titles.items():
        for entry in leaderboard:
            title = entry.get(title_key)
            if title:
                translated_title = _TITLE_TRANSLATIONS.get(title, {}).get(lang, title)
                sim_name = _esc(entry.get("simulation_name", "Unknown"))
                is_player = entry.get("simulation_id") == player_simulation_id
                # Show player's position for each dimension
                player_pos = ""
                if player_entry and not is_player:
                    score_key = f"{dim_key}_score" if f"{dim_key}_score" in (player_entry or {}) else dim_key
                    player_val = player_entry.get(score_key, player_entry.get(dim_key, 0))
                    if player_val:
                        player_pos = f" | {_nt('you_label', lang)}: {_fmt_num(float(player_val), lang)}"
                highlight = f"color:{accent};" if is_player else ""
                title_items += f"""\
                <p style="margin:0 0 4px;font-size:15px;color:{_TEXT};line-height:1.6;">
                  &#9656; <strong style="color:{accent};">{translated_title}</strong> ({dim_label}) &mdash; <span style="{highlight}">{sim_name}</span>{player_pos}
                </p>"""

    titles_html = ""
    if title_items:
        titles_html = f"""\
{_section_header(_nt("dimension_titles", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
{title_items}
              </div>
            </td>
          </tr>"""

    # Stats
    stats_html = f"""\
          <tr>
            <td style="padding:8px 32px 16px;">
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:1px;">
                {_nt("total_cycles", lang)}: <strong style="color:{_TEXT};">{cycle_count}</strong>
              </p>
            </td>
          </tr>"""

    sections = [winner_html, leaderboard_html, player_result_html]
    if campaign_html:
        sections.append(campaign_html)
    sections.append(titles_html)
    sections.append(stats_html)

    return "\n".join(s for s in sections if s)


def render_account_deleted(
    *,
    email_locale: str | None = None,
    worlds_transferred: int = 0,
) -> str:
    """Confirm a deleted account (Handoff P2.23, DSGVO Art. 17).

    Security post: sober register, no Bureau roleplay, not unsubscribable. There
    is nothing to click — a call-to-action in this mail would be the one thing a
    phishing copy would add.

    Says out loud that the worlds are **transferred, not deleted**
    (`admin_delete_user`, Migr. 040/113 hands ownership to the operators). The
    comfortable version of this mail would leave that out; the honest one cannot,
    because the person has a right to know what survives them.
    """
    lang = _resolve_lang(email_locale)
    accent = _AMBER

    worlds_line = (
        _nt("deleted_worlds", lang) if worlds_transferred else _nt("deleted_no_worlds", lang)
    )

    top = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                metaverse.center
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0;font-size:20px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("deleted_header", lang)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:{_TEXT};">
                {_esc(_nt("deleted_lead", lang))}
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:{_TEXT};">
                {_esc(_nt("deleted_irreversible", lang))}
              </p>
            </td>
          </tr>"""

    blocks = [
        top,
        _section_header(_nt("deleted_worlds_header", lang)),
        f"""\
          <tr>
            <td style="padding:4px 32px 20px;">
              <p style="margin:0;font-size:14px;line-height:1.65;color:{_TEXT};">
                {_esc(worlds_line)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;font-size:14px;line-height:1.65;color:{_TEXT_DIM};">
                {_esc(_nt("deleted_contact", lang))}
              </p>
            </td>
          </tr>""",
        _security_footer_row(email_locale),
    ]

    return _email_shell(
        "ACCOUNT DELETED",
        "\n".join(blocks),
        lang=lang,
        preheader=_nt("pre_deleted", lang),
    )


def welcome_subject(email_locale: str | None = None) -> str:
    """Subject of the welcome mail (P2.21)."""
    return _nt("welcome_subject", _resolve_lang(email_locale))


def render_welcome(*, email_locale: str | None = None) -> str:
    """Greet a new account and name exactly one first step (Handoff P2.21).

    Registering produced no message of any kind. The confirmation link comes
    from GoTrue and says nothing about the place it confirms; after clicking it
    a new account stood in a lobby with no indication of where to go.

    Three decisions worth stating, because the easy version of this mail gets
    all three wrong:

    * **One call to action.** ``/how-to-play/quickstart`` and nothing else in
      button form. A welcome mail with three equal buttons has chosen nothing
      and hands the choice back to someone who has no basis for making it.
    * **No name.** ``user_profiles`` holds ``id`` and ``email`` and no display
      name, so there is nothing to greet by. An invented "Hi there" is worse
      than the plain address.
    * **No clearance vocabulary.** ``clearance`` is a real mechanic with its own
      grant and denial mail. Borrowing the word here would promise a thing
      nobody has granted yet.

    The closing line says this is the only automatic mail signing up produces.
    Setting that expectation is the difference between a welcome and the
    opening move of a nuisance.
    """
    lang = _resolve_lang(email_locale)
    accent = _AMBER
    base = settings.site_url.rstrip("/")

    top = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                metaverse.center
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0;font-size:20px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("welcome_header", lang)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;">
              <p style="margin:0;font-size:15px;line-height:1.65;color:{_TEXT};">
                {_esc(_nt("welcome_lead", lang))}
              </p>
            </td>
          </tr>"""

    blocks = [
        top,
        _section_header(_nt("welcome_start_header", lang)),
        f"""\
          <tr>
            <td style="padding:4px 32px 4px;">
              <p style="margin:0;font-size:14px;line-height:1.65;color:{_TEXT};">
                {_esc(_nt("welcome_step", lang))}
              </p>
            </td>
          </tr>""",
        _cta_button(f"{base}/how-to-play/quickstart", _nt("welcome_cta", lang)),
        f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:{_TEXT_DIM};">
                {_esc(_nt("welcome_browse", lang))}
                <a href="{_esc(base)}/multiverse" style="color:{accent};">{_esc(base)}/multiverse</a>
              </p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:{_TEXT_DIM};">
                {_esc(_nt("welcome_pace", lang))}
              </p>
              <p style="margin:0;font-size:13px;line-height:1.65;color:{_TEXT_DIM};">
                {_esc(_nt("welcome_mail_note", lang))}
              </p>
            </td>
          </tr>""",
        _footer_row(email_locale),
    ]

    return _email_shell(
        "WELCOME",
        "\n".join(blocks),
        lang=lang,
        preheader=_nt("pre_welcome", lang),
    )


def render_deadline_reminder(
    *,
    email_locale: str | None = None,
    epoch_name: str,
    cycle_number: int,
    hours_remaining: int,
    open_items: list[str],
    done_items: list[str] | None = None,
    penalty_rp: int | None = None,
    ai_takeover_next: bool = False,
    cta_url: str,
    unsubscribe_url: str | None = None,
) -> str:
    """Render the deadline reminder (handoff P2.17) — the largest gap in the post.

    The system deducts RP and hands a seat to an AI **without warning first**.
    The player learned of the penalty from the next cycle briefing, after it had
    already happened. A punishment nobody saw coming is not a rule, it is a
    surprise.

    Deliberately shaped around the loss, not the task: the countdown and the
    consequence block carry the weight, the open items are the detail. Red
    appears exactly once and only where something is actually forfeited
    (handoff P1.14).

    ``done_items`` is optional and counter-signed in green — the point of
    listing what is already filed is that the reader can tell at a glance
    whether this concerns them at all.
    """
    lang = _resolve_lang(email_locale)
    accent = _AMBER

    top = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 4px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("deadline_header", lang)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 4px;">
              <p style="margin:0;font-size:34px;line-height:1.1;font-weight:900;color:{accent};font-family:{_MONO};letter-spacing:1px;">
                {_esc(_nt("deadline_countdown", lang, hours=hours_remaining))}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;">
              <p style="margin:0;font-size:15px;line-height:1.5;color:{_TEXT};">
                {_esc(_nt("deadline_lead", lang, cycle=cycle_number, epoch=epoch_name))}
              </p>
            </td>
          </tr>"""

    def _item_rows(items: list[str], colour: str, mark: str) -> str:
        return "\n".join(
            f"""\
          <tr>
            <td style="padding:2px 32px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:{colour};font-family:{_MONO};">
                {mark} {_esc(item)}
              </p>
            </td>
          </tr>"""
            for item in items
        )

    blocks: list[str] = [top]

    if open_items:
        blocks.append(_section_header(_nt("deadline_open_label", lang)))
        # A dash, not a box glyph: a screen reader reads out every decorative
        # character by name (handoff P1.10).
        blocks.append(_item_rows(open_items, _TEXT, "&#8211;"))

    if done_items:
        blocks.append(_section_header(_nt("deadline_done_label", lang)))
        blocks.append(_item_rows(done_items, _GREEN, "&#10003;"))

    # Only what actually happens in THIS epoch. Measured on production before
    # writing this: none of the seven epochs has `afk_penalty_enabled` set, so a
    # mail that threatens an RP loss would be threatening something that does
    # not occur — the same defect as the wipe text that announced losses the
    # mechanic never inflicted (Befund D12). The caller passes `penalty_rp=None`
    # when the epoch has no penalty configured, and the loss that remains is
    # real and worth stating: the cycle is scored without you.
    if penalty_rp:
        consequences = [_nt("deadline_consequence_rp", lang, rp=penalty_rp)]
    else:
        consequences = [_nt("deadline_consequence_none", lang)]
    if ai_takeover_next:
        consequences.append(_nt("deadline_consequence_ai", lang))

    consequence_lines = "".join(
        f"""
              <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:{_RED};">
                {_esc(line)}
              </p>"""
        for line in consequences
    )
    blocks.append(
        f"""\
          <tr>
            <td style="padding:20px 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="border:1px solid {_RED};">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:{_RED};text-transform:uppercase;font-family:{_MONO};">
                      {_esc(_nt("deadline_consequence_header", lang))}
                    </p>{consequence_lines}
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""
    )

    blocks.append(_cta_button(cta_url, _nt("deadline_cta", lang), accent=accent))
    # This is a NOTIFICATION mail, so it must carry the one-click unsubscribe
    # like the cycle briefing and the phase change do (B14). It did not: the
    # footer was called without the URL, which made this the only notification
    # mail in the system without a List-Unsubscribe header — an omission that
    # costs deliverability and leaves the reader only the logged-in settings
    # page. Found by the property test in P3.28, which checks the presence AND
    # the absence; a test that only looked for the header on security mail
    # would have stayed green.
    blocks.append(_footer_row(email_locale, unsubscribe_url=unsubscribe_url))

    return _email_shell(
        "CLASSIFIED // ORDERS OUTSTANDING",
        "\n".join(blocks),
        lang=lang,
        preheader=_nt("pre_deadline", lang, hours=hours_remaining),
    )


def render_epoch_completed(
    epoch_name: str,
    leaderboard: list[dict],
    player_simulation_id: str,
    cycle_count: int,
    command_center_url: str,
    *,
    email_locale: str | None = None,
    accent_color: str | None = None,
    campaign_stats: dict | None = None,
    unsubscribe_url: str | None = None,
) -> str:
    """Render the epoch completed notification email.

    If email_locale is "en"/"de", renders single-language.
    campaign_stats: optional {total_ops, success_rate, by_type} per player.
    """
    safe_name = _esc(epoch_name)
    cta_url = command_center_url
    accent = accent_color or _AMBER
    lang = _resolve_lang(email_locale)

    header = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("epoch_complete_header", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </h1>
            </td>
          </tr>"""

    blocks: list[str] = [
        header,
        _render_completed_block(
            safe_name,
            leaderboard,
            player_simulation_id,
            cycle_count,
            lang,
            accent=accent,
            campaign_stats=campaign_stats,
        ),
        _cta_button(cta_url, _nt("cta", lang), accent=accent),
        _footer_row(email_locale, unsubscribe_url=unsubscribe_url),
    ]

    content = "\n".join(blocks)
    winner = leaderboard[0] if leaderboard else None
    is_winner = winner and winner.get("simulation_id") == player_simulation_id
    subject = f"CLASSIFIED // OPERATION COMPLETE \u2014 {safe_name}"
    if is_winner:
        subject += " \u2605\u2605\u2605"
    return _email_shell(
        subject,
        content,
        lang=lang,
        preheader=epoch_completed_preheader(leaderboard, lang),
    )


# ── Clearance Upgrade Templates ──────────────────────────────────────────


def _render_clearance_block(
    lang: str,
    *,
    approved: bool,
    admin_notes: str | None = None,
    accent: str = _AMBER,
    starter_tokens: int | None = None,
) -> str:
    """Render a single language block for the clearance email."""
    intro_key = "clearance_granted_intro" if approved else "clearance_denied_intro"

    header = f"""\
          <tr>
            <td style="padding:20px 32px 8px;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                // {_nt("clearance_tier_label", lang)} //
              </p>
            </td>
          </tr>"""

    # Tier upgrade indicator
    observer_label = _nt("clearance_observer", lang)
    architect_label = _nt("clearance_architect", lang)
    tier_color = accent if approved else _TEXT_DIM
    tier_html = f"""\
          <tr>
            <td style="padding:8px 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:16px 20px;background-color:{_SURFACE};text-align:center;">
                <p style="margin:0;font-size:14px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                  {observer_label} &nbsp;&#10132;&nbsp; <span style="color:{tier_color};font-weight:900;">{architect_label}</span>
                </p>
              </div>
            </td>
          </tr>"""

    # Intro
    intro = f"""\
          <tr>
            <td style="padding:8px 32px 16px;">
              <p style="margin:0;font-size:15px;line-height:1.7;color:{_TEXT};">
                {_nt(intro_key, lang)}
              </p>
            </td>
          </tr>"""

    # Admin notes (if any)
    notes_html = ""
    if admin_notes:
        notes_html = f"""\
{_section_header(_nt("clearance_admin_notes", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:15px;color:{_TEXT};line-height:1.6;font-style:italic;">
                  &ldquo;{_esc(admin_notes)}&rdquo;
                </p>
              </div>
            </td>
          </tr>"""

    # Starter tokens info (if any)
    tokens_html = ""
    if starter_tokens and starter_tokens > 0:
        tokens_text = _nt("clearance_tokens_granted", lang).format(count=starter_tokens)
        tokens_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px solid {accent};padding:12px 20px;background-color:{_SURFACE};text-align:center;">
                <p style="margin:0;font-size:13px;color:{accent};letter-spacing:1px;font-weight:700;font-family:{_MONO};">
                  &#9670; {_esc(tokens_text)}
                </p>
              </div>
            </td>
          </tr>"""

    return f"{header}\n{tier_html}\n{tokens_html}\n{intro}\n{notes_html}"


def render_clearance_granted(
    *,
    email_locale: str | None = None,
    forge_url: str,
    admin_notes: str | None = None,
    starter_tokens: int | None = None,
) -> str:
    """Render the clearance granted email (bilingual or single-language)."""
    lang = _resolve_lang(email_locale)
    accent = _AMBER

    top = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_granted_header", lang)}
              </h1>
            </td>
          </tr>"""

    blocks: list[str] = [
        top,
        _render_clearance_block(
            lang, approved=True, admin_notes=admin_notes, accent=accent, starter_tokens=starter_tokens
        ),
        _cta_button(forge_url, _nt("clearance_granted_cta", lang), accent=accent),
        _footer_row(email_locale),
    ]

    content = "\n".join(blocks)
    return _email_shell(
        "CLASSIFIED // CLEARANCE GRANTED",
        content,
        lang=lang,
        preheader=_nt("pre_clearance_granted", lang),
    )


def render_clearance_denied(
    *,
    email_locale: str | None = None,
    admin_notes: str | None = None,
) -> str:
    """Render the clearance denied email (bilingual or single-language)."""
    lang = _resolve_lang(email_locale)

    top = f"""\
          <tr>
            <td lang="{lang}" style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{_TEXT};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_denied_header", lang)}
              </h1>
            </td>
          </tr>"""

    blocks: list[str] = [
        top,
        _render_clearance_block(lang, approved=False, admin_notes=admin_notes),
        _footer_row(email_locale),
    ]

    content = "\n".join(blocks)
    return _email_shell(
        "CLASSIFIED // CLEARANCE REVIEW",
        content,
        lang=lang,
        preheader=_nt("pre_clearance_denied", lang),
    )


def render_clearance_request_admin_notification(
    *,
    user_email: str,
    message: str | None = None,
    admin_panel_url: str = "",
) -> str:
    """Render admin notification email for a new clearance request.

    Single-language (EN only) — admin email is fixed.
    """
    if not admin_panel_url:
        admin_panel_url = f"{settings.site_url}/admin"
    accent = _AMBER
    safe_email = _esc(user_email)
    safe_message = _esc(message) if message else None

    top = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                NEW CLEARANCE REQUEST
              </h1>
            </td>
          </tr>"""

    body = f"""\
          <tr>
            <td style="padding:16px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:{_TEXT};">
                A new clearance upgrade request has been submitted.
              </p>
              <div style="border:1px solid {_BORDER};border-left:3px solid {accent};padding:16px;background:{_SURFACE};">
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                  APPLICANT
                </p>
                <p style="margin:0;font-size:14px;color:{accent};font-family:{_MONO};">
                  {safe_email}
                </p>
              </div>
            </td>
          </tr>"""

    if safe_message:
        body += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:16px;background:{_SURFACE};margin-top:8px;">
                <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:{_TEXT_DIM};text-transform:uppercase;">
                  OPERATIONAL JUSTIFICATION
                </p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:{_TEXT};font-style:italic;">
                  {safe_message}
                </p>
              </div>
            </td>
          </tr>"""

    blocks = [top, body]
    blocks.append(_cta_button(admin_panel_url, "REVIEW IN ADMIN PANEL", accent=accent))
    blocks.append(_footer_row("en"))

    content = "\n".join(blocks)
    return _email_shell(
        "BUREAU ALERT // NEW CLEARANCE REQUEST",
        content,
        lang="en",
        preheader=f"{_esc(user_email)} requests Forge clearance.",
    )
