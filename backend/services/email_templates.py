"""Email HTML templates for the platform.

All templates use inline CSS and table layout for maximum email client compatibility.
No external CSS, no images (better deliverability).

Supports single-language (email_locale="en"/"de") or bilingual rendering.
Per-simulation accent colors thread through all templates via accent_color parameter.
"""

from __future__ import annotations

import logging
from collections import Counter

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
    """Return accent color for a simulation slug, falling back to amber."""
    return _SIM_EMAIL_COLORS.get(slug or "", _AMBER)


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


def render_epoch_invitation(
    epoch_name: str,
    lore_text: str,
    invite_url: str,
    locale: str = "en",
    *,
    email_locale: str | None = None,
    accent_color: str | None = None,
    cycle_hours: int = 8,
) -> str:
    """Render the epoch invitation email.

    Military tactical dispatch aesthetic:
    - Dark background, monospace font, per-simulation accent color
    - Sections: intro, operation name, intel dossier, mission params, rules, CTA

    If email_locale is "en" or "de", renders single-language.
    Otherwise renders bilingual (EN first, then DE).
    """
    safe_name = _esc(epoch_name)
    safe_lore = _esc(lore_text)
    langs = _resolve_langs(email_locale)
    accent = accent_color or _AMBER

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        if i > 0:
            blocks.append(_language_divider())
        blocks.append(
            _render_invitation_block(
                safe_name,
                safe_lore,
                invite_url,
                lang,
                is_primary=(i == 0),
                accent=accent,
                cycle_hours=cycle_hours,
            )
        )
        blocks.append(_cta_button(invite_url, _nt("inv_cta", lang), accent=accent))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell(f"CLASSIFIED // EPOCH SUMMONS \u2014 {safe_name}", content)


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
            <td style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_header", lang)}
              </p>
            </td>
          </tr>"""
    else:
        header = f"""\
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_header", lang)}
              </p>
            </td>
          </tr>"""

    # Introduction paragraphs
    intro = f"""\
          <tr>
            <td style="padding:{"24px" if is_primary else "8px"} 32px 16px;">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:{_TEXT};">
                {_nt("inv_intro_1", lang)}
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:{_TEXT};">
                {_nt("inv_intro_2", lang)}
              </p>
            </td>
          </tr>"""

    # Operation name
    op_name = f"""\
          <tr>
            <td style="padding:8px 32px 4px;">
              <p style="margin:0 0 2px;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("inv_operation", lang)}
              </p>
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {epoch_name}
              </{heading_tag}>
              <p style="margin:4px 0 0;font-size:11px;color:{_BORDER};letter-spacing:1px;">
                &#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;&#9473;
              </p>
            </td>
          </tr>"""

    # Intel dossier (AI-generated lore — English only, skip in DE secondary block)
    if is_primary or lang == "en":
        intel = _section_header(_nt("inv_intel", lang))
        intel += f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:20px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:14px;line-height:1.7;color:{_TEXT};font-style:italic;">
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
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
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
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
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


def _resolve_langs(email_locale: str | None) -> list[str]:
    """Resolve which language(s) to render based on user preference.

    Returns ["en"] or ["de"] for single-language, ["en", "de"] for bilingual.
    """
    if email_locale == "en":
        return ["en"]
    if email_locale == "de":
        return ["de"]
    return ["en", "de"]


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
_TEXT_DARK = "#666"
_AMBER = "#f59e0b"
_GREEN = "#4ade80"
_RED = "#ef4444"
_GRAY = "#666"


def _delta_arrow(delta: float) -> str:
    """Return colored arrow for a score delta."""
    if delta > 0:
        return f'<span style="color:{_GREEN};">&#9650; +{delta:.1f}</span>'
    if delta < 0:
        return f'<span style="color:{_RED};">&#9660; {delta:.1f}</span>'
    return f'<span style="color:{_GRAY};">&#9472; 0.0</span>'


def _rank_arrow(current: int, previous: int) -> str:
    """Return colored arrow for rank change (lower rank = better)."""
    if previous == 0:
        return ""
    diff = previous - current  # positive = improved
    if diff > 0:
        return f'<span style="color:{_GREEN};">&#9650; (+{diff})</span>'
    if diff < 0:
        return f'<span style="color:{_RED};">&#9660; ({diff})</span>'
    return f'<span style="color:{_GRAY};">&#9472;</span>'


def _score_bar(value: float, max_val: float = 100.0, accent: str = _AMBER) -> str:
    """Render a 10-cell ASCII-style score bar as HTML table cells."""
    filled = min(10, max(0, round(value / max_val * 10))) if max_val > 0 else 0
    cells = ""
    for i in range(10):
        bg = accent if i < filled else "#1a1a1a"
        cells += f'<td style="width:16px;height:12px;background-color:{bg};border:1px solid #222;padding:0;"></td>'
    return f'<table role="presentation" cellpadding="0" cellspacing="1" style="display:inline-table;vertical-align:middle;"><tr>{cells}</tr></table>'


def _email_shell(title: str, content: str) -> str:
    """Wrap content in the standard dark email shell."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:{_BG};font-family:{_MONO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_BG};">
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
    """Render a dossier section header row."""
    return f"""\
          <tr>
            <td style="padding:20px 32px 8px;">
              <p style="margin:0;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;border-bottom:1px dashed {_BORDER_SUBTLE};padding-bottom:6px;">
                &#9472;&#9472; {_esc(label)} &#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;
              </p>
            </td>
          </tr>"""


def _cta_button(url: str, label: str, *, accent: str = _AMBER) -> str:
    """Render the CTA button row with per-simulation accent color."""
    return f"""\
          <tr>
            <td align="center" style="padding:24px 32px 32px;">
              <a href="{_esc(url)}"
                 style="display:inline-block;padding:14px 32px;background-color:{accent};color:{_BG};font-family:{_MONO};font-size:13px;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border:2px solid {accent};">
                &#9608; {_esc(label)} &#9608;
              </a>
            </td>
          </tr>"""


def _language_divider() -> str:
    """Render the EN/DE language divider."""
    return f"""\
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:{_TEXT_DIM};text-align:center;">
                &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;
              </p>
              <p style="margin:4px 0 0;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;text-align:center;">
                DEUTSCHE VERSION
              </p>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:3px;color:{_TEXT_DIM};text-align:center;">
                &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;
              </p>
            </td>
          </tr>"""


def _footer_row(email_locale: str | None = None) -> str:
    """Render the standard footer with notification management link."""
    if email_locale == "de":
        manage_link = f'<a href="{settings.site_url}/settings" style="color:{_TEXT_DARK};text-decoration:underline;">Benachrichtigungen verwalten</a>'
    elif email_locale == "en":
        manage_link = f'<a href="{settings.site_url}/settings" style="color:{_TEXT_DARK};text-decoration:underline;">Manage notifications</a>'
    else:
        manage_link = (
            f'<a href="{settings.site_url}/settings" style="color:{_TEXT_DARK};text-decoration:underline;">Manage notifications</a>'
            f"&nbsp;&middot;&nbsp;"
            f'<a href="{settings.site_url}/settings" style="color:{_TEXT_DARK};text-decoration:underline;">Benachrichtigungen verwalten</a>'
        )

    footer_lang = email_locale if email_locale in ("en", "de") else "en"
    return f"""\
          <tr>
            <td style="padding:16px 32px;border-top:1px solid {_BORDER_SUBTLE};">
              <p style="margin:0 0 4px;font-size:10px;color:{_TEXT_DARK};">
                {manage_link}
              </p>
              <p style="margin:0;font-size:10px;letter-spacing:2px;color:{_TEXT_DARK};text-transform:uppercase;">
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
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
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
        "en": "You have been selected for a classified operation. The Bureau has identified you as a viable operative for the next competitive epoch on metaverse.center.",
        "de": "Sie wurden f\u00fcr eine geheime Operation ausgew\u00e4hlt. Das B\u00fcro hat Sie als geeigneten Agenten f\u00fcr die n\u00e4chste kompetitive Epoche auf metaverse.center identifiziert.",
    },
    "inv_intro_2": {
        "en": "Each epoch pits simulation commanders against each other in a strategic contest across five dimensions. Your tactical decisions shape the multiverse.",
        "de": "In jeder Epoche treten Simulationskommandanten in einem strategischen Wettbewerb \u00fcber f\u00fcnf Dimensionen gegeneinander an. Ihre taktischen Entscheidungen formen das Multiversum.",
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
        "en": "ACCEPT THE SUMMONS",
        "de": "EINBERUFUNG ANNEHMEN",
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
    "footer_origin": {
        "en": "TRANSMISSION ORIGIN: metaverse.center",
        "de": "ÜBERTRAGUNGSURSPRUNG: metaverse.center",
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
    # ── Clearance request emails ──
    "clearance_granted_header": {
        "en": "CLEARANCE UPGRADE APPROVED",
        "de": "FREIGABE-UPGRADE GENEHMIGT",
    },
    "clearance_granted_intro": {
        "en": "Your application for Reality Architect clearance has been approved. You now have access to the Simulation Forge — create worlds with AI-driven agents, buildings, and events.",
        "de": "Dein Antrag auf die Freigabestufe Realitätsarchitekt wurde genehmigt. Du hast jetzt Zugang zur Simulationsschmiede — erschaffe Welten mit KI-gesteuerten Agenten, Gebäuden und Ereignissen.",
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
                    <td colspan="2" style="font-size:11px;color:{gap_color};padding:2px 0 4px;text-align:right;font-style:italic;">
                      {gap_text}
                    </td>
                  </tr>"""

    standing_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:16px 20px;background-color:{_SURFACE};">
                <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;">
                  {_nt("your_standing", lang)}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px;">
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("rank", lang)}</td>
                    <td style="font-size:14px;color:{_TEXT};text-align:right;padding:4px 0;">{rank_str} {rank_delta}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:4px 0;">{_nt("composite", lang)}</td>
                    <td style="font-size:14px;color:{accent};font-weight:bold;text-align:right;padding:4px 0;">{data["composite"]:.1f} {_delta_arrow(data["composite_delta"])}</td>
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
                    <td style="font-size:11px;color:{_TEXT_DIM};letter-spacing:1px;text-transform:uppercase;padding:5px 0;white-space:nowrap;width:100px;">{label}</td>
                    <td style="padding:5px 8px;">{bar}</td>
                    <td style="font-size:12px;color:{_TEXT};text-align:right;padding:5px 0;white-space:nowrap;width:50px;">{d["value"]:.1f}</td>
                    <td style="font-size:11px;text-align:right;padding:5px 0;white-space:nowrap;width:60px;">{_delta_arrow(d["delta"])}</td>
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
                    <td style="font-size:11px;color:{accent};font-weight:bold;padding:4px 8px 4px 0;white-space:nowrap;">{op_label}</td>
                    <td style="font-size:11px;color:{_TEXT};padding:4px 0;">{target}</td>
                    <td style="font-size:13px;color:{status_color};text-align:right;padding:4px 0 4px 8px;">{status_icon}</td>
                  </tr>"""

        ops_html = f"""\
{_section_header(_nt("operative_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:9px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 8px 6px 0;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_type_header", lang)}</td>
                    <td style="font-size:9px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 0 6px;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_target", lang)}</td>
                    <td style="font-size:9px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:0 0 6px 8px;text-align:right;border-bottom:1px solid {_BORDER_SUBTLE};">{_nt("mission_outcome", lang)}</td>
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
                <p style="margin:0;font-size:13px;color:{_TEXT};line-height:1.8;">
                  {_nt("active", lang)}: <strong style="color:{accent};">{data["active_ops"]}</strong>
                  &nbsp;&middot;&nbsp;
                  {_nt("resolved", lang)}: <strong>{data["resolved_ops"]}</strong>
                  ({data["success_ops"]}&#10003; {data["detected_ops"]}&#10007;)
                </p>
                <p style="margin:4px 0 0;font-size:13px;color:{_TEXT};line-height:1.8;">
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
                <p style="margin:0 0 6px;font-size:13px;color:{_RED};line-height:1.6;">
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
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_nt("intel_zone_analysis", lang, target=target_name, breakdown=breakdown)}
                </p>"""
            if guardian_ct is not None and target_name:
                intel_items += f"""\
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_nt("intel_guardian_count", lang, target=target_name, count=str(guardian_ct))}
                </p>"""
            # Fallback: raw narrative if no structured metadata
            if not zone_sec and guardian_ct is None:
                intel_items += f"""\
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
                  &#9656; {_esc(si.get("narrative", ""))}
                </p>"""
        intel_html = f"{_section_header(_nt('spy_intel', lang))}\n{_dashed_box(intel_items)}"

    # ── Alliance status (B6) ──
    alliance_name = data.get("alliance_name")
    if alliance_name:
        ally_names = ", ".join(_esc(n) for n in data.get("ally_names", []))
        bonus_tag = (
            f' <span style="color:{_GREEN};font-size:10px;">&#9679; {_nt("alliance_bonus", lang)}</span>'
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
                <p style="margin:8px 0 0;font-size:11px;color:{_TEXT_DIM};line-height:1.8;">
                  {alliance_details}
                </p>"""

        alliance_html = f"""\
{_section_header(_nt("alliance_status", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:1px dashed {_BORDER};padding:12px 16px;background-color:{_SURFACE};">
                <p style="margin:0;font-size:13px;color:{accent};font-weight:bold;line-height:1.6;">
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
              <div style="border:1px dashed {_RED};padding:12px 16px;background-color:rgba(239,68,68,0.06);">
                <p style="margin:0;font-size:13px;color:{_RED};font-weight:bold;line-height:1.6;">
                  &#9888; {_nt("alliance_dissolved", lang, name=_esc(dissolved_name))}
                </p>
                <p style="margin:4px 0 0;font-size:11px;color:{_TEXT_DIM};line-height:1.6;">
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
                <p style="margin:0 0 4px;font-size:13px;color:{_TEXT};line-height:1.6;">
                  {_nt("pending_missions", lang)}: <strong style="color:{accent};">{next_missions}</strong>
                </p>"""
        if rp_projection:
            preview_items += f"""\
                <p style="margin:0;font-size:13px;color:{_TEXT};line-height:1.6;">
                  {_nt("rp_projection", lang)}: <strong>{rp_projection}</strong>
                </p>"""
        next_cycle_html = f"{_section_header(_nt('next_cycle', lang))}\n{_dashed_box(preview_items)}"

    # ── Signal intercepts (public events) ──
    events_html = f"{_section_header(_nt('signal_intercepts', lang))}\n"
    if events:
        event_items = ""
        for ev in events[:5]:
            event_items += f"""\
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
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

    sections = [standing_html, dims_html, ops_html]
    if threat_html:
        sections.append(threat_html)
    if intel_html:
        sections.append(intel_html)
    sections.append(alliance_html)
    if next_cycle_html:
        sections.append(next_cycle_html)
    sections.append(events_html)

    return "\n".join(sections)


def render_cycle_briefing(data: dict, *, email_locale: str | None = None) -> str:
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
    ally_names, alliance_bonus_active, has_threat_data
    """
    epoch_name = _esc(data.get("epoch_name", "Unknown"))
    cycle_number = data.get("cycle_number", 0)
    raw_phase = data.get("epoch_status", "competition")
    cta_url = data.get("command_center_url", f"{settings.site_url}/epoch")
    accent = data.get("accent_color", _AMBER)
    sim_slug = data.get("simulation_slug")
    langs = _resolve_langs(email_locale)

    # Phase name translation key mapping
    _phase_key = f"phase_{raw_phase}"

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        is_primary = i == 0
        heading_tag = "h1" if is_primary else "h2"
        heading_size = "22px" if is_primary else "20px"
        sim_header = get_sim_header(sim_slug, lang)
        status_display = _nt(_phase_key, lang) if _phase_key in _NOTIF_STRINGS else raw_phase.upper()

        if is_primary:
            header = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {sim_header}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <{heading_tag} style="margin:0 0 4px;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {epoch_name}
              </{heading_tag}>
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;">
                {_nt("cycle_resolved", lang, n=cycle_number)} &middot; {_nt("phase_label", lang)}: {status_display}
              </p>
            </td>
          </tr>"""
        else:
            blocks.append(_language_divider())
            header = f"""\
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {sim_header}
              </p>
              <{heading_tag} style="margin:0 0 4px;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {epoch_name}
              </{heading_tag}>
              <p style="margin:0;font-size:12px;color:{_TEXT_DIM};letter-spacing:2px;">
                {_nt("cycle_resolved", lang, n=cycle_number)} &middot; {_nt("phase_label", lang)}: {status_display}
              </p>
            </td>
          </tr>"""

        blocks.append(header)
        blocks.append(_render_briefing_block(data, lang, accent=accent))
        blocks.append(_cta_button(cta_url, _nt("cta", lang), accent=accent))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell(f"CLASSIFIED // SITREP \u2014 {epoch_name}", content)


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
                <p style="margin:0 0 6px;font-size:13px;color:{_TEXT};line-height:1.6;">
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
                    <td style="font-size:14px;color:{accent};font-weight:bold;text-align:right;padding:4px 0;">#{rank} / {total} &middot; {composite:.1f}</td>
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
) -> str:
    """Render the phase change notification email.

    If email_locale is "en"/"de", renders single-language.
    standing_data: optional {rank, total_players, composite} for per-player rendering.
    """
    safe_name = _esc(epoch_name)
    cta_url = command_center_url
    accent = accent_color or _AMBER
    langs = _resolve_langs(email_locale)

    # Phase-scaled subject urgency (C2) — use first lang for subject line
    primary_lang = langs[0]
    if new_phase == "reckoning":
        subject_prefix = _nt("subject_urgent_final", primary_lang)
    elif old_phase == "lobby":
        subject_prefix = _nt("subject_ops_commence", primary_lang)
    else:
        subject_prefix = _nt("subject_phase_transition", primary_lang)

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        is_primary = i == 0
        heading_tag = "h1" if is_primary else "h2"
        heading_size = "22px" if is_primary else "20px"

        if is_primary:
            header = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("phase_change_header", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </{heading_tag}>
            </td>
          </tr>"""
        else:
            blocks.append(_language_divider())
            header = f"""\
          <tr>
            <td style="padding:24px 32px 16px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("phase_change_header", lang)}
              </p>
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </{heading_tag}>
            </td>
          </tr>"""

        blocks.append(header)
        blocks.append(
            _render_phase_block(
                safe_name,
                old_phase,
                new_phase,
                cycle_count,
                lang,
                accent=accent,
                standing_data=standing_data,
            )
        )
        blocks.append(_cta_button(cta_url, _nt("cta", lang), accent=accent))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell(f"{subject_prefix} \u2014 {safe_name}", content)


# ── Epoch Completed Template ─────────────────────────────────────────────


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
    # Winner
    winner = leaderboard[0] if leaderboard else None
    winner_name = _esc(winner.get("simulation_name", "Unknown")) if winner else "N/A"

    winner_html = f"""\
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="border:2px solid {accent};padding:16px 20px;background-color:{_SURFACE};text-align:center;">
                <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;">
                  {_nt("winner", lang)}
                </p>
                <p style="margin:0;font-size:20px;font-weight:900;color:{accent};letter-spacing:2px;">
                  &#128081; {winner_name}
                </p>
                <p style="margin:4px 0 0;font-size:14px;color:{_TEXT};">
                  {_nt("composite", lang)}: {winner["composite"]:.1f}
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
                    <td style="font-size:13px;color:{accent};padding:6px 4px;text-align:right;border-bottom:1px solid {_BORDER_SUBTLE};font-weight:bold;">{entry["composite"]:.1f}</td>
                  </tr>"""

    leaderboard_html = f"""\
{_section_header(_nt("final_standings", lang))}
          <tr>
            <td style="padding:0 32px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:{_SURFACE};border:1px dashed {_BORDER};">
                <tr>
                  <td style="font-size:10px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;text-align:center;border-bottom:1px solid {_BORDER};">#</td>
                  <td style="font-size:10px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;border-bottom:1px solid {_BORDER};">{_nt("leaderboard_sim", lang)}</td>
                  <td style="font-size:10px;color:{_TEXT_DIM};letter-spacing:2px;text-transform:uppercase;padding:8px 4px;text-align:right;border-bottom:1px solid {_BORDER};">{_nt("composite", lang)}</td>
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
                <p style="margin:0;font-size:14px;color:{_TEXT};line-height:1.8;">
                  {_nt("rank", lang)}: <strong style="color:{accent};">#{player_entry["rank"]}</strong> / {len(leaderboard)}
                  &nbsp;&middot;&nbsp;
                  {_nt("composite", lang)}: <strong style="color:{accent};">{player_entry["composite"]:.1f}</strong>
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
                <p style="margin:0 0 4px;font-size:13px;color:{_TEXT};line-height:1.6;">
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
                        player_pos = f" | {_nt('you_label', lang)}: {float(player_val):.1f}"
                highlight = f"color:{accent};" if is_player else ""
                title_items += f"""\
                <p style="margin:0 0 4px;font-size:13px;color:{_TEXT};line-height:1.6;">
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
) -> str:
    """Render the epoch completed notification email.

    If email_locale is "en"/"de", renders single-language.
    campaign_stats: optional {total_ops, success_rate, by_type} per player.
    """
    safe_name = _esc(epoch_name)
    cta_url = command_center_url
    accent = accent_color or _AMBER
    langs = _resolve_langs(email_locale)

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        is_primary = i == 0
        heading_tag = "h1" if is_primary else "h2"
        heading_size = "22px" if is_primary else "20px"

        if is_primary:
            header = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("epoch_complete_header", lang)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </{heading_tag}>
            </td>
          </tr>"""
        else:
            blocks.append(_language_divider())
            header = f"""\
          <tr>
            <td style="padding:24px 32px 16px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                {_nt("epoch_complete_header", lang)}
              </p>
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {safe_name}
              </{heading_tag}>
            </td>
          </tr>"""

        blocks.append(header)
        blocks.append(
            _render_completed_block(
                safe_name,
                leaderboard,
                player_simulation_id,
                cycle_count,
                lang,
                accent=accent,
                campaign_stats=campaign_stats,
            )
        )
        blocks.append(_cta_button(cta_url, _nt("cta", lang), accent=accent))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell(f"CLASSIFIED // OPERATION COMPLETE \u2014 {safe_name}", content)


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
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
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
              <p style="margin:0;font-size:14px;line-height:1.7;color:{_TEXT};">
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
                <p style="margin:0;font-size:13px;color:{_TEXT};line-height:1.6;font-style:italic;">
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
    langs = _resolve_langs(email_locale)
    accent = _AMBER

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        is_primary = i == 0
        heading_tag = "h1" if is_primary else "h2"
        heading_size = "22px" if is_primary else "20px"

        if is_primary:
            top = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {accent};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_granted_header", lang)}
              </{heading_tag}>
            </td>
          </tr>"""
        else:
            blocks.append(_language_divider())
            top = f"""\
          <tr>
            <td style="padding:24px 32px 8px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{accent};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_granted_header", lang)}
              </{heading_tag}>
            </td>
          </tr>"""

        blocks.append(top)
        blocks.append(
            _render_clearance_block(
                lang, approved=True, admin_notes=admin_notes, accent=accent, starter_tokens=starter_tokens
            )
        )
        blocks.append(_cta_button(forge_url, _nt("clearance_granted_cta", lang), accent=accent))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell("CLASSIFIED // CLEARANCE GRANTED", content)


def render_clearance_denied(
    *,
    email_locale: str | None = None,
    admin_notes: str | None = None,
) -> str:
    """Render the clearance denied email (bilingual or single-language)."""
    langs = _resolve_langs(email_locale)

    blocks: list[str] = []
    for i, lang in enumerate(langs):
        is_primary = i == 0
        heading_tag = "h1" if is_primary else "h2"
        heading_size = "22px" if is_primary else "20px"

        if is_primary:
            top = f"""\
          <tr>
            <td style="padding:24px 32px;border-bottom:2px solid {_BORDER};">
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
                BUREAU OF MULTIVERSE OBSERVATION
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{_TEXT};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_denied_header", lang)}
              </{heading_tag}>
            </td>
          </tr>"""
        else:
            blocks.append(_language_divider())
            top = f"""\
          <tr>
            <td style="padding:24px 32px 8px;">
              <{heading_tag} style="margin:0;font-size:{heading_size};font-weight:900;color:{_TEXT};letter-spacing:2px;text-transform:uppercase;font-family:{_MONO};">
                {_nt("clearance_denied_header", lang)}
              </{heading_tag}>
            </td>
          </tr>"""

        blocks.append(top)
        blocks.append(_render_clearance_block(lang, approved=False, admin_notes=admin_notes))

    blocks.append(_footer_row(email_locale))

    content = "\n".join(blocks)
    return _email_shell("CLASSIFIED // CLEARANCE REVIEW", content)


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
              <p style="margin:0;font-size:11px;letter-spacing:4px;color:{_TEXT_DIM};text-transform:uppercase;">
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
              <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:{_TEXT};">
                A new clearance upgrade request has been submitted.
              </p>
              <div style="border:1px solid {_BORDER};border-left:3px solid {accent};padding:16px;background:{_SURFACE};">
                <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;">
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
                <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;color:{_TEXT_DIM};text-transform:uppercase;">
                  OPERATIONAL JUSTIFICATION
                </p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:{_TEXT};font-style:italic;">
                  {safe_message}
                </p>
              </div>
            </td>
          </tr>"""

    blocks = [top, body]
    blocks.append(_cta_button(admin_panel_url, "REVIEW IN ADMIN PANEL", accent=accent))
    blocks.append(_footer_row("en"))

    content = "\n".join(blocks)
    return _email_shell("BUREAU ALERT // NEW CLEARANCE REQUEST", content)
