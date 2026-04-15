"""Instagram Story template composer.

Pure Pillow rendering with no Supabase dependency. Each compose_story_*
method produces a complete 1080x1920 JPEG story image.

Extracted from instagram_image_service.py during god-class decomposition.
"""

from __future__ import annotations

import io
import logging
from typing import TYPE_CHECKING

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.instagram_image_helpers import (
    BADGE_PAD_X,
    BADGE_PAD_Y,
    BADGE_RADIUS,
    DIVIDER_INSET,
    DIVIDER_WEIGHT,
    DIVIDER_WEIGHT_SM,
    FONT_BODY,
    FONT_CAPTION,
    FONT_CTA,
    FONT_H1,
    FONT_H2,
    FONT_MAGNITUDE,
    FONT_STAT,
    GAUGE_BG_RADIUS,
    GAUGE_MIN_Y,
    GAUGE_RADIUS,
    GAUGE_STROKE,
    IG_HEIGHT_STORY,
    IG_WIDTH,
    IMPACT_PANEL_HEIGHT,
    LINE_HEIGHT_BODY,
    LINE_HEIGHT_H1,
    LINE_HEIGHT_H2,
    MARGIN_INDENT,
    MARGIN_PAGE,
    MARGIN_PANEL,
    OPERATIVE_ICON_SIZE,
    OPERATIVE_SYMBOLS,
    PANEL_RADIUS,
    PANEL_RADIUS_SM,
    PORTRAIT_SIZE,
    SPACING_LG,
    SPACING_MD,
    SPACING_SM,
    SPACING_XL,
    SPACING_XS,
    STATS_LABEL_OFFSET,
    STATS_PANEL_WIDTH,
    STORY_CLOSING_MAX_Y,
    STORY_CLOSING_MIN_Y,
    STORY_FOOTER_Y,
    STORY_SAFE_TOP,
    STORY_TITLE_Y,
    TITLE_PANEL_HEIGHT,
    WATERMARK_SYMBOL_SIZE,
    WATERMARK_SYMBOL_Y,
    add_bokeh_dots,
    add_noise_grain,
    create_gradient,
    create_vignette,
    crop_to_circle,
    draw_accent_bars,
    draw_archetype_symbol,
    draw_atmospheric_filler,
    draw_corner_brackets,
    draw_magnitude_arc,
    draw_scan_lines_rgba,
    draw_story_footer,
    hex_to_rgb,
    image_to_jpeg,
    load_bold_font,
    load_italic_font,
    load_monospace_font,
    text_with_glow,
    wrap_text,
)

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage

logger = logging.getLogger(__name__)


class StoryComposer:
    """Composes Instagram Story images (1080x1920) using Bureau visual identity.

    Stateless — no Supabase or I/O dependencies. Each method takes data
    and returns JPEG bytes.
    """

    # ── Canvas setup / teardown ───────────────────────────────────────

    def _init_story_canvas(
        self,
        accent_hex: str,
        *,
        background: str = "dark",
        scan_alpha: int = 18,
        grain_sigma: int = 12,
        grain_opacity: float = 0.05,
    ) -> tuple[PILImage, tuple[int, int, int], int, int]:
        """Initialize a story canvas with standard Bureau atmosphere.

        Returns (img, accent_rgb, width, height).

        background modes:
        - "dark": solid (10, 12, 18) -- advisory, classification
        - "gradient": faint accent gradient top -> black -- detection
        - "faint_gradient": very faint accent -> black -- subsiding
        """
        from PIL import Image  # noqa: F811 — local import for Pillow lazy-loading

        accent = hex_to_rgb(accent_hex)
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        if background == "gradient":
            img = create_gradient(w, h, (*accent, 50), (0, 0, 0, 255))
        elif background == "faint_gradient":
            img = create_gradient(w, h, (*accent, 12), (0, 0, 0, 255))
        else:
            img = Image.new("RGBA", (w, h), (10, 12, 18, 255))

        if scan_alpha > 0:
            draw_scan_lines_rgba(img, accent, alpha=scan_alpha)
        img = add_noise_grain(img, sigma=grain_sigma, opacity=grain_opacity)

        return img, accent, w, h

    def _draw_story_title(
        self,
        img: PILImage,
        title: str,
        accent: tuple[int, int, int],
        *,
        glow_radius: int = 8,
        panel_height: int = 96,
        fill_alpha: int = 255,
        glow_alpha: int = 80,
    ) -> int:
        """Draw titled panel with glow and double-line divider. Returns y after divider."""
        from PIL import ImageDraw

        w = img.width
        draw = ImageDraw.Draw(img)
        title_panel_y = STORY_TITLE_Y
        draw.rounded_rectangle(
            [(MARGIN_PANEL, title_panel_y), (w - MARGIN_PANEL, title_panel_y + panel_height)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 100),
        )

        font_title = load_bold_font(FONT_H1)
        y = STORY_TITLE_Y + SPACING_XS
        text_with_glow(
            img,
            (MARGIN_PAGE, y),
            title,
            font_title,
            (*accent, fill_alpha),
            (*accent, glow_alpha),
            glow_radius=glow_radius,
        )
        y += LINE_HEIGHT_H1 + SPACING_SM

        draw = ImageDraw.Draw(img)
        draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*accent, 140), width=DIVIDER_WEIGHT)
        draw.line([(MARGIN_PAGE, y + 4), (w - MARGIN_PAGE, y + 4)], fill=(*accent, 40), width=DIVIDER_WEIGHT_SM)
        y += SPACING_MD
        return y

    def _finalize_story(
        self,
        img: PILImage,
        accent: tuple[int, int, int],
        *,
        vignette_intensity: float = 0.5,
    ) -> bytes:
        """Apply vignette, accent bars, footer, and convert story to JPEG."""
        from PIL import ImageDraw

        w, h = img.size
        vignette = create_vignette(w, h, intensity=vignette_intensity)
        img.alpha_composite(vignette)

        draw = ImageDraw.Draw(img)
        draw_accent_bars(draw, w, h, accent)
        draw_story_footer(draw, accent)

        return image_to_jpeg(img)

    # ── Story Templates (1080x1920 vertical) ─────────────────────────

    def compose_story_detection(
        self,
        *,
        archetype: str,
        signature: str,
        magnitude: float,
        accent_hex: str,
    ) -> bytes:
        """Story 1: SUBSTRATE ANOMALY DETECTED -- cinematic emergency broadcast.

        Full-bleed gradient background with archetype glyph, circular magnitude
        gauge, text glow effects, film grain, heavy scan lines, and vignette.
        Content distributed across full 1080x1920 canvas.
        """
        from PIL import ImageDraw

        from backend.models.resonance import ARCHETYPE_DESCRIPTIONS

        # Detection uses gradient + heavier grain; scan lines applied after bokeh
        img, accent, w, h = self._init_story_canvas(
            accent_hex, background="gradient", scan_alpha=0,
            grain_sigma=20, grain_opacity=0.10,
        )

        # Large archetype symbol -- decorative watermark behind title zone
        draw = ImageDraw.Draw(img)
        draw_archetype_symbol(draw, w // 2, WATERMARK_SYMBOL_Y, WATERMARK_SYMBOL_SIZE, archetype, (*accent, 50))

        # Subtle bokeh for atmospheric depth
        add_bokeh_dots(img, accent, count=15, seed=hash(archetype) & 0xFFFF)

        # Heavy scan lines (C5: +50% alpha)
        draw_scan_lines_rgba(img, accent, alpha=33)

        draw = ImageDraw.Draw(img)

        # Classification badge -- rounded rectangle with vertically centered text
        font_stamp = load_monospace_font(FONT_CAPTION)
        badge_label = "CLASSIFICATION: AMBER"
        badge_bbox = draw.textbbox((0, 0), badge_label, font=font_stamp)
        text_w = badge_bbox[2] - badge_bbox[0]
        text_h = badge_bbox[3] - badge_bbox[1]
        ascent_offset = badge_bbox[1]
        pad_x, pad_y = BADGE_PAD_X, BADGE_PAD_Y
        badge_w = text_w + pad_x * 2
        badge_h = text_h + pad_y * 2
        badge_x = MARGIN_PAGE - 4
        badge_y = STORY_SAFE_TOP
        draw.rounded_rectangle(
            [(badge_x, badge_y), (badge_x + badge_w, badge_y + badge_h)],
            radius=BADGE_RADIUS,
            fill=(*accent, 80),
            outline=(*accent, 140),
            width=1,
        )
        draw.text(
            (badge_x + pad_x, badge_y + pad_y - ascent_offset),
            badge_label,
            fill=(*accent, 255),
            font=font_stamp,
        )

        # Title backdrop panel (tight around text, close to badge)
        title_panel_y = STORY_TITLE_Y
        draw.rounded_rectangle(
            [(MARGIN_PANEL, title_panel_y), (w - MARGIN_PANEL, title_panel_y + TITLE_PANEL_HEIGHT)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 100),
        )

        # Title with glow -- large and dramatic (C1: accent color title)
        font_title = load_bold_font(FONT_H1)
        y = STORY_TITLE_Y + SPACING_XS
        text_with_glow(
            img,
            (MARGIN_PAGE, y),
            "SUBSTRATE ANOMALY",
            font_title,
            (*accent, 255),
            (*accent, 100),
            glow_radius=14,
        )
        y += LINE_HEIGHT_H1
        text_with_glow(
            img,
            (MARGIN_PAGE, y),
            "DETECTED",
            font_title,
            (*accent, 255),
            (*accent, 100),
            glow_radius=14,
        )
        y += SPACING_LG  # Tighter post-title gap

        # Accent divider line (double-line effect)
        draw = ImageDraw.Draw(img)
        draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*accent, 120), width=DIVIDER_WEIGHT)
        draw.line([(MARGIN_PAGE, y + 4), (w - MARGIN_PAGE, y + 4)], fill=(*accent, 40), width=DIVIDER_WEIGHT_SM)
        y += SPACING_MD  # A: grid-aligned (2*24)

        # Signature + archetype info
        font_md = load_monospace_font(FONT_H2)
        sig_display = signature.upper().replace("_", " ")
        sig_line = f"Signature: [{sig_display}]"
        sig_lines = wrap_text(sig_line, font_md, w - MARGIN_PAGE * 2)
        # Force-truncate any wrapped line that still overflows (no space break)
        max_sig_w = w - MARGIN_PAGE * 2
        for i, sline in enumerate(sig_lines):
            bbox = draw.textbbox((0, 0), sline, font=font_md)
            if bbox[2] - bbox[0] > max_sig_w:
                while bbox[2] - bbox[0] > max_sig_w and len(sline) > 10:
                    sline = sline[:-4] + "..."
                    bbox = draw.textbbox((0, 0), sline, font=font_md)
                sig_lines[i] = sline
        for sline in sig_lines:
            draw.text(
                (MARGIN_PAGE, y),
                sline,
                fill=(200, 200, 200, 255),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 120),
            )
            y += LINE_HEIGHT_H2 + SPACING_XS

        archetype_line = f"Archetype: {archetype.upper()}"
        archetype_lines = wrap_text(archetype_line, font_md, w - MARGIN_PAGE * 2)
        for aline in archetype_lines:
            draw.text(
                (MARGIN_PAGE, y),
                aline,
                fill=(255, 255, 255, 255),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 120),
            )
            y += LINE_HEIGHT_H2
        y += SPACING_XS  # Breathing room before description

        # Archetype description (italic, accent-tinted) (C2: alpha 180)
        desc = ARCHETYPE_DESCRIPTIONS.get(archetype, "")
        if not desc:
            # Try with "The " prefix or case-insensitive lookup
            for key, val in ARCHETYPE_DESCRIPTIONS.items():
                if key.lower() == archetype.lower() or key.lower() == f"the {archetype.lower()}":
                    desc = val
                    break
        if desc:
            font_desc = load_italic_font(FONT_BODY)
            desc_lines = wrap_text(desc, font_desc, w - MARGIN_PAGE * 2 - SPACING_SM)
            for dline in desc_lines[:3]:
                draw.text((MARGIN_PAGE, y), dline, fill=(*accent, 220), font=font_desc)
                y += LINE_HEIGHT_BODY
        y += SPACING_MD  # Tighter before gauge

        # Accent divider before gauge
        draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*accent, 80), width=DIVIDER_WEIGHT_SM)
        y += SPACING_MD

        # Gauge -- centered in visible zone (Y=230-1720)
        gauge_cy = max(y + GAUGE_RADIUS, GAUGE_MIN_Y)
        draw.ellipse(
            [
                (w // 2 - GAUGE_BG_RADIUS, gauge_cy - GAUGE_BG_RADIUS),
                (w // 2 + GAUGE_BG_RADIUS, gauge_cy + GAUGE_BG_RADIUS),
            ],
            fill=(0, 0, 0, 80),
        )

        # Circular magnitude gauge -- large, centered
        draw_magnitude_arc(draw, w // 2, gauge_cy, GAUGE_RADIUS, GAUGE_STROKE, magnitude, accent)

        # Magnitude value in gauge center — 72px fits inside 160px-radius gauge
        font_mag = load_bold_font(FONT_MAGNITUDE)
        mag_text = f"{magnitude:.2f}"
        bbox = draw.textbbox((0, 0), mag_text, font=font_mag)
        cx = w // 2 - (bbox[0] + bbox[2]) // 2
        cy = gauge_cy - (bbox[1] + bbox[3]) // 2
        text_with_glow(
            img,
            (cx, cy),
            mag_text,
            font_mag,
            (255, 255, 255, 255),
            (*accent, 80),
            glow_radius=10,
        )

        # "MAGNITUDE" label below gauge -- 16px below the background circle edge
        draw = ImageDraw.Draw(img)
        font_label = load_monospace_font(FONT_CAPTION)
        mag_label = "MAGNITUDE"
        lbbox = draw.textbbox((0, 0), mag_label, font=font_label)
        lw = lbbox[2] - lbbox[0]
        mag_label_y = gauge_cy + GAUGE_BG_RADIUS + SPACING_SM  # circle edge + 24px gap
        draw.text(
            (w // 2 - lw // 2, mag_label_y),
            mag_label,
            fill=(120, 120, 120, 255),
            font=font_label,
        )

        # Directive -- below gauge
        font_directive = load_italic_font(FONT_H2)
        directive = "All operatives report to stations."
        dbbox = draw.textbbox((0, 0), directive, font=font_directive)
        dw = dbbox[2] - dbbox[0]
        directive_y = gauge_cy + GAUGE_BG_RADIUS + SPACING_LG + SPACING_XS  # 180+72+12=264
        text_with_glow(
            img,
            (w // 2 - dw // 2, directive_y),
            directive,
            font_directive,
            (*accent, 200),
            (*accent, 60),
            glow_radius=6,
        )

        # Threat assessment label -- additional bottom-third content
        threat_y = directive_y + SPACING_XL
        font_threat = load_monospace_font(FONT_BODY)
        level = "CATASTROPHIC" if magnitude >= 0.8 else "ELEVATED" if magnitude >= 0.5 else "MODERATE"
        threat_text = f"THREAT ASSESSMENT: {level}"
        tbbox = draw.textbbox((0, 0), threat_text, font=font_threat)
        tw = tbbox[2] - tbbox[0]
        draw.text(
            (w // 2 - tw // 2, threat_y),
            threat_text,
            fill=(*accent, 160),
            font=font_threat,
        )

        # Horizontal rule near bottom
        rule_y = threat_y + SPACING_LG  # A: grid-aligned (3*24)
        draw.line([(DIVIDER_INSET, rule_y), (w - DIVIDER_INSET, rule_y)], fill=(*accent, 40), width=DIVIDER_WEIGHT_SM)

        # Atmospheric filler for the lower third
        draw_atmospheric_filler(img, rule_y + SPACING_SM, STORY_FOOTER_Y - SPACING_MD, accent, archetype)

        return self._finalize_story(img, accent, vignette_intensity=0.5)

    def compose_story_classification(
        self,
        *,
        archetype: str,
        source_category: str,
        affected_shard_count: int,
        highest_susceptibility_sim: str,
        highest_susceptibility_val: float,
        bureau_dispatch: str | None,
        accent_hex: str,
    ) -> bytes:
        """Story 2: BUREAU CLASSIFICATION -- dossier document with corner brackets.

        Paper-textured dark background with Bureau seal watermark, classification
        markers, corner bracket framing, and amber-accented dispatch text.
        """
        from PIL import ImageDraw

        # Classification: dark base, heavier grain for paper texture, subtle scan lines
        img, accent, w, h = self._init_story_canvas(
            accent_hex, background="dark", scan_alpha=15,
            grain_sigma=25, grain_opacity=0.04,
        )

        # Faded Bureau seal watermark (centered, very transparent)
        draw = ImageDraw.Draw(img)
        seal_font = load_bold_font(FONT_CAPTION)
        seal_text = "BUREAU OF IMPOSSIBLE GEOGRAPHY"
        seal_bbox = draw.textbbox((0, 0), seal_text, font=seal_font)
        seal_w = seal_bbox[2] - seal_bbox[0]
        draw.text(
            ((w - seal_w) // 2, STORY_SAFE_TOP),
            seal_text,
            fill=(*accent, 40),
            font=seal_font,
        )

        # Corner bracket frame around content area -- brighter brackets
        draw = ImageDraw.Draw(img)
        draw_corner_brackets(draw, MARGIN_PANEL, STORY_TITLE_Y, w - MARGIN_PANEL * 2, h - 340, (*accent, 160), 60, 3)

        y = self._draw_story_title(img, "BUREAU CLASSIFICATION", accent)

        draw = ImageDraw.Draw(img)
        font_sm = load_monospace_font(FONT_BODY)

        # Classification fields -- bigger fonts, tighter spacing
        # Measure content height first, then draw panel with SPACING_SM bottom padding
        font_md = load_monospace_font(FONT_H2)
        category_display = source_category.upper().replace("_", " ")
        category_line = f"Source Category: [{category_display}]"
        category_lines = wrap_text(category_line, font_md, w - MARGIN_PAGE * 2)
        sim_name_lines = wrap_text(highest_susceptibility_sim, font_md, w - MARGIN_PAGE * 2 - SPACING_SM)

        # Calculate fields panel height from actual content
        fields_content_h = (
            len(category_lines) * SPACING_LG  # category lines
            + SPACING_LG  # affected shards line
            + (LINE_HEIGHT_H2 + SPACING_XS)  # peak susceptibility label
            + min(len(sim_name_lines), 2) * LINE_HEIGHT_H2  # sim name lines (font_md = H2)
            + LINE_HEIGHT_BODY  # baseline text (0.9x baseline line)
        )
        fields_panel_y = y - 16
        fields_panel_h = fields_content_h + SPACING_SM  # 24px bottom padding
        draw.rounded_rectangle(
            [(MARGIN_PANEL, fields_panel_y), (w - MARGIN_PANEL, fields_panel_y + fields_panel_h)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 40),
        )

        for cline in category_lines:
            draw.text(
                (MARGIN_PAGE, y),
                cline,
                fill=(200, 200, 200, 255),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 100),
            )
            y += SPACING_LG
        draw.text(
            (MARGIN_PAGE, y),
            f"Affected Shards: [{affected_shard_count}]",
            fill=(200, 200, 200, 255),
            font=font_md,
            stroke_width=1,
            stroke_fill=(0, 0, 0, 100),
        )
        y += SPACING_LG
        draw.text(
            (MARGIN_PAGE, y),
            "Peak Susceptibility:",
            fill=(255, 255, 255, 255),
            font=font_md,
            stroke_width=1,
            stroke_fill=(0, 0, 0, 100),
        )
        y += LINE_HEIGHT_H2 + SPACING_XS
        for sn_line in sim_name_lines[:2]:
            draw.text(
                (MARGIN_INDENT, y),
                sn_line,
                fill=(*accent, 240),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 100),
            )
            y += LINE_HEIGHT_H2  # font_md = FONT_H2, must match
        draw.text(
            (MARGIN_INDENT, y),
            f"({highest_susceptibility_val:.1f}\u00d7 baseline)",
            fill=(*accent, 200),
            font=font_sm,
        )
        y = fields_panel_y + fields_panel_h + SPACING_MD  # Jump past panel bottom + gap

        # Accent divider between fields and dispatch
        draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*accent, 80), width=DIVIDER_WEIGHT_SM)
        y += SPACING_MD

        # Bureau dispatch text with left accent bar (wider bar + caps)
        if bureau_dispatch:
            bar_x = MARGIN_PANEL  # 48 — aligned with panel edge, 18px gap to text
            bar_top = y
            font_body = load_monospace_font(FONT_BODY)
            lines = bureau_dispatch[:500].split("\n")[:10]
            for line in lines:
                wrapped = wrap_text(line, font_body, w - MARGIN_PAGE * 2 - FONT_BODY)
                for wline in wrapped:
                    draw.text((MARGIN_INDENT, y), wline, fill=(150, 150, 150, 255), font=font_body)
                    y += LINE_HEIGHT_H2
            # bar_bottom after last advance — subtract advance, add actual text height
            bar_text_bottom = y - LINE_HEIGHT_H2 + FONT_BODY
            # Wider accent bar (6px) with symmetric caps
            _bar_ext = SPACING_XS  # 12px symmetric extension
            draw.rectangle(
                [(bar_x, bar_top - _bar_ext), (bar_x + 6, bar_text_bottom + _bar_ext)],
                fill=(*accent, 180),
            )
            # Top cap
            draw.line(
                [(bar_x, bar_top - _bar_ext), (bar_x + 20, bar_top - _bar_ext)],
                fill=(*accent, 140),
                width=DIVIDER_WEIGHT,
            )
            # Bottom cap
            draw.line(
                [(bar_x, bar_text_bottom + _bar_ext), (bar_x + 20, bar_text_bottom + _bar_ext)],
                fill=(*accent, 140),
                width=DIVIDER_WEIGHT,
            )
            y += SPACING_LG

        # Accent divider before closing
        draw.line([(DIVIDER_INSET, y), (w - DIVIDER_INSET, y)], fill=(*accent, 50), width=DIVIDER_WEIGHT_SM)
        y += SPACING_LG

        # Adaptive filler for minimal-content stories (no dispatch)
        closing_y = max(y + SPACING_MD, STORY_CLOSING_MIN_Y)
        closing_y = min(closing_y, STORY_CLOSING_MAX_Y)
        draw_atmospheric_filler(img, y, closing_y, accent, archetype)

        # Closing line -- position dynamically after dispatch, skip if no room
        y_after_dispatch = y

        # If dispatch was so long that closing would overlap footer, skip it
        closing_rendered = 0
        if y_after_dispatch + SPACING_MD <= STORY_CLOSING_MAX_Y:
            font_closing = load_italic_font(FONT_H2)
            closing_lines = wrap_text(
                "The Substrate trembles. Reality bleeds.",
                font_closing,
                w - MARGIN_PAGE * 2 - SPACING_SM,
            )
            # Only render closing lines that fit above the footer
            draw = ImageDraw.Draw(img)
            for ci, cline in enumerate(closing_lines[:2]):
                line_y = closing_y + ci * LINE_HEIGHT_H1
                if line_y + LINE_HEIGHT_H1 > STORY_FOOTER_Y - 40:
                    break
                cbbox = draw.textbbox((0, 0), cline, font=font_closing)
                ctw = cbbox[2] - cbbox[0]
                text_with_glow(
                    img,
                    (w // 2 - ctw // 2, line_y),
                    cline,
                    font_closing,
                    (*accent, 220),
                    (*accent, 60),
                    glow_radius=8,
                )
                closing_rendered += 1

        # Filing reference -- additional bottom content (skip if no room)
        filing_y = closing_y + closing_rendered * LINE_HEIGHT_H1 + SPACING_SM
        if closing_rendered > 0 and filing_y < STORY_FOOTER_Y - 80:
            font_filing = load_monospace_font(FONT_CAPTION)
            draw = ImageDraw.Draw(img)
            draw.text(
                (MARGIN_PAGE, filing_y),
                f"FILING: R-{archetype.upper().replace('THE ', '')}-CLASS",
                fill=(60, 60, 60, 255),
                font=font_filing,
            )
            draw.text(
                (MARGIN_PAGE, filing_y + FONT_CAPTION),
                "STATUS: ACTIVE / MONITORING",
                fill=(60, 60, 60, 255),
                font=font_filing,
            )
            draw.text(
                (MARGIN_PAGE, filing_y + FONT_CAPTION * 2),
                f"SHARDS FLAGGED: {affected_shard_count}",
                fill=(60, 60, 60, 255),
                font=font_filing,
            )
            # Atmospheric filler below filing reference
            draw_atmospheric_filler(
                img, filing_y + FONT_CAPTION * 3 + SPACING_SM,
                STORY_FOOTER_Y - SPACING_SM, accent, archetype,
            )

        return self._finalize_story(img, accent, vignette_intensity=0.4)

    def compose_story_impact(
        self,
        *,
        simulation_name: str,
        effective_magnitude: float,
        events_spawned: list[str],
        narrative_closing: str | None,
        accent_hex: str,
        sim_color_hex: str | None = None,
        banner_bytes: bytes | None = None,
        portraits: list[dict] | None = None,
        reactions: list[dict] | None = None,
    ) -> bytes:
        """Story 3+: SHARD IMPACT -- cinematic hero slide with real imagery.

        When banner/portrait data is available: blurred darkened simulation banner
        background, circular agent portraits with glow rings, reaction quote cards,
        and AI-generated poetic closing with text glow.

        Falls back to gradient-on-dark if no imagery is available.

        portraits: list of {"image_bytes": bytes, "agent_name": str}
        reactions: list of {"agent_name": str, "text": str, "emotion": str | None}
        """
        from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

        accent = hex_to_rgb(accent_hex)
        sim_color = hex_to_rgb(sim_color_hex) if sim_color_hex else accent
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # -- Background --
        if banner_bytes:
            try:
                bg = Image.open(io.BytesIO(banner_bytes)).convert("RGB")
                bg = ImageOps.fit(bg, (w, h), method=Image.LANCZOS)
                bg = ImageEnhance.Brightness(bg).enhance(0.25)
                bg = bg.filter(ImageFilter.GaussianBlur(radius=30))
                img = bg.convert("RGBA")
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
                logger.warning("Banner processing failed -- using gradient fallback")
                img = create_gradient(w, h, (*sim_color, 30), (0, 0, 0, 255))
        else:
            img = create_gradient(w, h, (*sim_color, 30), (0, 0, 0, 255))

        # Gradient overlay: transparent top -> black bottom (text readability)
        gradient_overlay = create_gradient(w, h, (0, 0, 0, 0), (0, 0, 0, 220))
        img.alpha_composite(gradient_overlay)

        # Light grain
        img = add_noise_grain(img, sigma=12, opacity=0.06)

        # -- Top Zone: Simulation Name + Magnitude --
        draw = ImageDraw.Draw(img)
        font_title = load_bold_font(FONT_H1)
        font_mag = load_monospace_font(FONT_H2)
        font_sm = load_monospace_font(FONT_BODY)

        # Title backdrop panel -- title + magnitude + bar in one block
        title_panel_y = STORY_TITLE_Y
        draw.rounded_rectangle(
            [(MARGIN_PANEL, title_panel_y), (w - MARGIN_PANEL, title_panel_y + IMPACT_PANEL_HEIGHT)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 100),
        )

        # "SHARD IMPACT:" top line
        y = STORY_TITLE_Y + SPACING_XS
        text_with_glow(
            img,
            (MARGIN_PAGE, y),
            "SHARD IMPACT:",
            font_title,
            (*sim_color, 255),
            (*sim_color, 80),
            glow_radius=10,
        )
        y += LINE_HEIGHT_H1

        # Sim name left-aligned, magnitude right-aligned on same row
        # Measure magnitude first so we can truncate the sim name to fit
        draw = ImageDraw.Draw(img)
        mag_text = f"{effective_magnitude:.2f}"
        mag_bbox = draw.textbbox((0, 0), mag_text, font=font_mag)
        mag_tw = mag_bbox[2] - mag_bbox[0]
        # Available width for sim name = panel width minus magnitude, margins, and gap
        sim_name_max_w = w - MARGIN_PAGE * 2 - mag_tw - 40  # 60px each side margin + 40px gap
        sim_name_upper = simulation_name.upper()
        # Truncate sim name with ellipsis if it exceeds available width
        sim_display = sim_name_upper
        sim_name_bbox = draw.textbbox((0, 0), f"[{sim_display}]", font=font_title)
        while sim_name_bbox[2] - sim_name_bbox[0] > sim_name_max_w and len(sim_display) > 3:
            sim_display = sim_display[: len(sim_display) - 1]
            sim_name_bbox = draw.textbbox((0, 0), f"[{sim_display}...]", font=font_title)
        if sim_display != sim_name_upper:
            sim_display = f"{sim_display}..."
        text_with_glow(
            img,
            (MARGIN_PAGE, y),
            f"[{sim_display}]",
            font_title,
            (*sim_color, 255),
            (*sim_color, 80),
            glow_radius=10,
        )
        text_with_glow(
            img,
            (w - MARGIN_PAGE - mag_tw, y + 4),
            mag_text,
            font_mag,
            (255, 255, 255, 255),
            (*sim_color, 80),
            glow_radius=8,
        )
        y += LINE_HEIGHT_H1 + SPACING_SM  # Breathing room before bar

        # Full-width magnitude bar as panel footer
        draw = ImageDraw.Draw(img)
        bar_x, bar_w, bar_h = MARGIN_PAGE, w - MARGIN_PAGE * 2, SPACING_XS
        draw.rounded_rectangle(
            [(bar_x, y), (bar_x + bar_w, y + bar_h)],
            radius=4,
            fill=(40, 40, 40, 180),
        )
        fill_w = int(bar_w * min(effective_magnitude, 1.0))
        if fill_w > 0:
            draw.rounded_rectangle(
                [(bar_x, y), (bar_x + fill_w, y + bar_h)],
                radius=4,
                fill=(*sim_color, 255),
            )
        # Jump below panel bottom + breathing room
        y = title_panel_y + IMPACT_PANEL_HEIGHT + SPACING_SM

        # Event count + impact level
        impact_lvl = min(10, max(1, round(effective_magnitude * 10)))
        draw.text(
            (MARGIN_PAGE, y),
            f"Events: {len(events_spawned)}  \u2502  Impact: {impact_lvl}/10",
            fill=(180, 180, 180, 255),
            font=font_sm,
            stroke_width=1,
            stroke_fill=(0, 0, 0, 120),
        )
        y += SPACING_SM  # Symmetric spacing below events line

        # -- Portrait Strip --
        portrait_images: list[tuple[PILImage, str]] = []
        if portraits:
            portrait_size = PORTRAIT_SIZE
            for p_data in portraits[:4]:
                circle = crop_to_circle(
                    p_data["image_bytes"],
                    portrait_size,
                    sim_color,
                    border_width=5,
                )
                if circle:
                    portrait_images.append((circle, p_data["agent_name"]))

        if portrait_images:
            total_size = portrait_images[0][0].width
            gap = 28
            strip_w = len(portrait_images) * total_size + (len(portrait_images) - 1) * gap
            start_x = (w - strip_w) // 2
            portrait_y = y + SPACING_SM  # A: grid-aligned (1*24)

            for i, (p_img, p_name) in enumerate(portrait_images):
                px = start_x + i * (total_size + gap)
                img.alpha_composite(p_img, (px, portrait_y))
                # Agent name below portrait
                name_font = load_monospace_font(FONT_CAPTION)
                draw = ImageDraw.Draw(img)
                name_bbox = draw.textbbox((0, 0), p_name[:14], font=name_font)
                name_w = name_bbox[2] - name_bbox[0]
                draw.text(
                    (px + total_size // 2 - name_w // 2, portrait_y + total_size + 8),
                    p_name[:14],
                    fill=(180, 180, 180, 200),
                    font=name_font,
                    stroke_width=1,
                    stroke_fill=(0, 0, 0, 120),
                )

            y = portrait_y + total_size + SPACING_MD  # A: grid-aligned (2*24)
        else:
            # No portraits -- show event titles (subordinate to meta line above)
            y += SPACING_XS + 4
            font_event_list = load_monospace_font(FONT_BODY)
            for title in events_spawned[:5]:
                draw.text(
                    (MARGIN_INDENT + BADGE_PAD_X, y),
                    f"\u25b8 {title[:42]}",
                    fill=(180, 180, 180, 255),  # dimmer than meta line
                    font=font_event_list,
                    stroke_width=1,
                    stroke_fill=(0, 0, 0, 80),
                )
                y += LINE_HEIGHT_BODY + 10
            y += SPACING_SM  # A: grid-aligned (1*24)

        # Section divider after portrait strip / event list
        draw = ImageDraw.Draw(img)
        draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*sim_color, 80), width=DIVIDER_WEIGHT_SM)
        y += SPACING_MD  # A: grid-aligned (2*24)

        # -- Reaction Quote (1 prominent quote, subordinate to closing) --
        if reactions:
            font_quote = load_italic_font(FONT_H2)
            font_attrib = load_monospace_font(FONT_BODY)

            for rxn in reactions[:1]:
                quote_text = rxn["text"][:100]
                wrapped = wrap_text(quote_text, font_quote, w - MARGIN_PAGE * 2 - FONT_BODY)
                card_h = len(wrapped) * LINE_HEIGHT_H2 + 96  # symmetric padding
                card_y = y

                # Semi-transparent dark card background with accent border
                # (B: card margin x=MARGIN_PANEL, C4: border width=DIVIDER_WEIGHT)
                draw = ImageDraw.Draw(img)
                draw.rounded_rectangle(
                    [(MARGIN_PANEL, card_y), (w - MARGIN_PANEL, card_y + card_h)],
                    radius=PANEL_RADIUS_SM,
                    fill=(0, 0, 0, 140),
                    outline=(*sim_color, 80),
                    width=DIVIDER_WEIGHT,
                )

                # Quote text (20px top padding)
                text_y = card_y + 20
                for wline in wrapped:
                    draw.text(
                        (MARGIN_INDENT, text_y),
                        wline,
                        fill=(220, 220, 220, 240),
                        font=font_quote,
                    )
                    text_y += LINE_HEIGHT_H2

                # Attribution (8px gap after last line)
                emotion_tag = f" [{rxn.get('emotion', '')}]" if rxn.get("emotion") else ""
                attrib = f"\u2014 {rxn['agent_name']}{emotion_tag}"
                draw.text(
                    (MARGIN_INDENT, text_y + 8),
                    attrib,
                    fill=(*sim_color, 200),
                    font=font_attrib,
                )

                y = card_y + card_h + SPACING_SM

            # Section divider after reactions
            draw.line([(MARGIN_PAGE, y), (w - MARGIN_PAGE, y)], fill=(*sim_color, 80), width=DIVIDER_WEIGHT_SM)
            y += SPACING_MD  # A: grid-aligned (2*24)

        # -- Adaptive filler for minimal-content stories (no portraits, few events) --
        closing_target_y = max(y + SPACING_SM, STORY_CLOSING_MIN_Y)
        closing_target_y = min(closing_target_y, STORY_CLOSING_MAX_Y)
        draw_atmospheric_filler(img, y, closing_target_y, sim_color)

        # -- Closing Line (centered, in extended visible zone) --
        if narrative_closing:
            closing_y = closing_target_y
            font_closing = load_italic_font(FONT_CTA)
            wrapped = wrap_text(narrative_closing[:120], font_closing, w - MARGIN_PAGE * 2 - SPACING_SM)
            # Only render lines that fit above the footer
            max_closing_lines = max(0, (STORY_FOOTER_Y - closing_y - 40) // LINE_HEIGHT_H1)
            visible_lines = wrapped[:min(2, max_closing_lines)]
            # Add ellipsis if text was truncated
            if len(wrapped) > len(visible_lines) and visible_lines:
                last = visible_lines[-1].rstrip(".").rstrip(",").rstrip()
                visible_lines[-1] = last + "..."
            draw = ImageDraw.Draw(img)
            for i, cline in enumerate(visible_lines):
                cbbox = draw.textbbox((0, 0), cline, font=font_closing)
                ctw = cbbox[2] - cbbox[0]
                text_with_glow(
                    img,
                    (w // 2 - ctw // 2, closing_y + i * LINE_HEIGHT_H1),
                    cline,
                    font_closing,
                    (*sim_color, 230),
                    (*sim_color, 60),
                    glow_radius=10,
                )

        # -- Finishing touches --
        return self._finalize_story(img, sim_color, vignette_intensity=0.5)

    def compose_story_advisory(
        self,
        *,
        archetype: str,
        aligned_types: list[str],
        opposed_types: list[str],
        zone_name: str | None,
        accent_hex: str,
    ) -> bytes:
        """Story 4: OPERATIVE ADVISORY -- two-column tactical briefing HUD.

        Military briefing aesthetic with aligned (green) and opposed (red)
        operative columns, chess piece symbols, and accent-colored directive.
        Content distributed across full safe zone (Y=230-1720).
        """
        from PIL import ImageDraw

        # Advisory: dark base, moderate scan lines, standard grain
        img, accent, w, h = self._init_story_canvas(
            accent_hex, background="dark", scan_alpha=22,
            grain_sigma=12, grain_opacity=0.05,
        )

        font_md = load_monospace_font(FONT_H2)
        font_sm = load_monospace_font(FONT_BODY)
        font_type = load_bold_font(FONT_H2)       # column headers: ALIGNED / OPPOSED
        font_item = load_monospace_font(FONT_BODY)  # operative names + symbols (subordinate)

        y = self._draw_story_title(img, "OPERATIVE ADVISORY", accent)

        draw = ImageDraw.Draw(img)

        resonance_text = f"Active Resonance: [{archetype.upper()}]"
        resonance_lines = wrap_text(resonance_text, font_md, w - MARGIN_PAGE * 2)
        for rline in resonance_lines[:2]:
            # force-truncate if no word break possible
            bbox = draw.textbbox((0, 0), rline, font=font_md)
            while bbox[2] - bbox[0] > w - MARGIN_PAGE * 2 and len(rline) > 10:
                rline = rline[:-4] + "..."
                bbox = draw.textbbox((0, 0), rline, font=font_md)
            draw.text(
                (MARGIN_PAGE, y),
                rline,
                fill=(255, 255, 255, 255),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 100),
            )
            y += LINE_HEIGHT_H2 + SPACING_XS
        y += SPACING_XS  # Before columns

        # Two-column layout
        col_left_x = 80
        col_right_x = w // 2 + MARGIN_PAGE
        aligned_color = (80, 220, 120)
        opposed_color = (220, 80, 80)

        # Columns content panel (B: card margin x=MARGIN_PANEL)
        # Reduce item spacing when there are many operatives to prevent overflow
        actual_aligned = len(aligned_types) if aligned_types else 0
        actual_opposed = len(opposed_types) if opposed_types else 0
        max_types = max(actual_aligned, actual_opposed, 1)
        item_spacing = LINE_HEIGHT_BODY + SPACING_XS if max_types > 3 else SPACING_MD  # 52/48
        # Panel height from actual last operative rendered (SPACING_XL header + items + SPACING_SM padding)
        columns_panel_h = SPACING_XL + max_types * item_spacing + SPACING_SM
        # Clamp panel height so zone text and CTA remain visible
        columns_panel_h = min(columns_panel_h, STORY_CLOSING_MAX_Y - 200 - y)
        draw.rounded_rectangle(
            [(MARGIN_PANEL, y - 16), (w - MARGIN_PANEL, y + columns_panel_h)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 40),
        )

        # ALIGNED column
        if aligned_types:
            draw.text(
                (col_left_x, y),
                "ALIGNED",
                fill=(*aligned_color, 255),
                font=font_type,
            )
            draw.text(
                (col_left_x, y + OPERATIVE_ICON_SIZE),
                "+3% effectiveness",
                fill=(*aligned_color, 160),
                font=font_item,
            )
            col_y = y + SPACING_XL
            for op_type in aligned_types:
                symbol = OPERATIVE_SYMBOLS.get(op_type, "\u25cf")
                draw.text(
                    (col_left_x, col_y),
                    symbol,
                    fill=(*aligned_color, 200),
                    font=font_item,
                )
                draw.text(
                    (col_left_x + LINE_HEIGHT_BODY, col_y),
                    op_type,
                    fill=(220, 220, 220, 255),
                    font=font_item,
                    stroke_width=1,
                    stroke_fill=(0, 0, 0, 100),
                )
                col_y += item_spacing

        # OPPOSED column
        if opposed_types:
            draw.text(
                (col_right_x, y),
                "OPPOSED",
                fill=(*opposed_color, 255),
                font=font_type,
            )
            draw.text(
                (col_right_x, y + OPERATIVE_ICON_SIZE),
                "-2% effectiveness",
                fill=(*opposed_color, 160),
                font=font_item,
            )
            col_y = y + SPACING_XL
            for op_type in opposed_types:
                symbol = OPERATIVE_SYMBOLS.get(op_type, "\u25cf")
                draw.text(
                    (col_right_x, col_y),
                    symbol,
                    fill=(*opposed_color, 200),
                    font=font_item,
                )
                draw.text(
                    (col_right_x + LINE_HEIGHT_BODY, col_y),
                    op_type,
                    fill=(220, 220, 220, 255),
                    font=font_item,
                    stroke_width=1,
                    stroke_fill=(0, 0, 0, 100),
                )
                col_y += item_spacing

        # Zone pressure -- pushed further down, clamped to leave room for CTA
        y_bottom = y + columns_panel_h + SPACING_MD  # A: grid-aligned (2*24)
        y_bottom = min(y_bottom, STORY_CLOSING_MAX_Y - 200)

        # Adaptive filler for empty advisory (0v0 -- no aligned/opposed types)
        draw_atmospheric_filler(img, y + columns_panel_h, y_bottom, accent, archetype)

        # Horizontal accent divider
        draw.line([(MARGIN_PAGE, y_bottom), (w - MARGIN_PAGE, y_bottom)], fill=(*accent, 80), width=DIVIDER_WEIGHT_SM)
        y_bottom += SPACING_LG  # A: grid-aligned (3*24)

        if zone_name:
            zone_name_text = f"Zone pressure elevated in {zone_name}."
            zone_lines = wrap_text(zone_name_text, font_sm, w - MARGIN_PAGE * 2)
            for zline in zone_lines:
                draw.text(
                    (MARGIN_PAGE, y_bottom),
                    zline,
                    fill=(200, 200, 200, 255),
                    font=font_sm,
                )
                y_bottom += LINE_HEIGHT_BODY  # consecutive text lines
        draw.text(
            (MARGIN_PAGE, y_bottom),
            "Defenders gain tactical advantage.",
            fill=(200, 200, 200, 255),
            font=font_sm,
        )
        y_bottom += LINE_HEIGHT_BODY  # consecutive text lines
        draw.text(
            (MARGIN_PAGE, y_bottom),
            "Adjust deployment accordingly.",
            fill=(140, 140, 140, 255),
            font=font_sm,
        )
        # "Deploy accordingly." -- dynamically follow zone text
        cta_y = y_bottom + SPACING_XL + SPACING_SM  # 120px — dramatic pause before CTA
        # Skip CTA entirely if zone text pushed it into the footer zone
        if cta_y <= STORY_FOOTER_Y - 120:
            cta_font = load_bold_font(FONT_CTA)
            cta_text = "Deploy accordingly."
            cta_bbox = draw.textbbox((0, 0), cta_text, font=cta_font)
            cta_tw = cta_bbox[2] - cta_bbox[0]
            text_with_glow(
                img,
                (w // 2 - cta_tw // 2, cta_y),
                cta_text,
                cta_font,
                (*accent, 255),
                (*accent, 80),
                glow_radius=12,
            )

        # Status line below CTA
        status_y = cta_y + SPACING_XL
        if cta_y <= STORY_FOOTER_Y - 120 and status_y < STORY_FOOTER_Y - MARGIN_PAGE:
            font_status = load_monospace_font(FONT_CAPTION)
            status_text = f"ADVISORY CLASS: {archetype.upper().replace('THE ', '')}"
            sbbox = draw.textbbox((0, 0), status_text, font=font_status)
            sw = sbbox[2] - sbbox[0]
            draw.text(
                (w // 2 - sw // 2, status_y),
                status_text,
                fill=(*accent, 100),
                font=font_status,
            )
            # Atmospheric filler below status line
            draw_atmospheric_filler(
                img, status_y + SPACING_LG,
                STORY_FOOTER_Y - SPACING_SM, accent, archetype,
            )

        return self._finalize_story(img, accent, vignette_intensity=0.4)

    def compose_story_subsiding(
        self,
        *,
        archetype: str,
        events_spawned_total: int,
        shards_affected: int,
        accent_hex: str,
    ) -> bytes:
        """Story 5: SUBSTRATE STABILIZING -- elegiac minimal resolution.

        Nearly black with faintest archetype color, large centered stat numbers,
        and fading poetic closing text. Calm after the storm.
        Content vertically centered in safe zone (Y=230-1720).
        """
        from PIL import ImageDraw

        # Subsiding: faint gradient, barely-visible scan lines, minimal grain
        img, accent, w, h = self._init_story_canvas(
            accent_hex, background="faint_gradient", scan_alpha=12,
            grain_sigma=10, grain_opacity=0.03,
        )

        # Subtle bokeh for atmospheric depth
        add_bokeh_dots(
            img,
            accent,
            count=10,
            alpha_range=(5, 15),
            seed=hash(archetype) & 0xFFFF,
        )

        y = self._draw_story_title(
            img, "SUBSTRATE STABILIZING", accent,
            glow_radius=6, fill_alpha=200, glow_alpha=40,
        )

        draw = ImageDraw.Draw(img)
        font_sm = load_monospace_font(FONT_BODY)
        font_md = load_monospace_font(FONT_H2)

        # U9: wrap archetype resonance line if it exceeds safe width
        resonance_line = f"[{archetype.upper()}] resonance subsiding."
        resonance_lines = wrap_text(resonance_line, font_md, w - MARGIN_PAGE * 2)
        for rline in resonance_lines:
            draw.text(
                (MARGIN_PAGE, y),
                rline,
                fill=(180, 180, 180, 255),
                font=font_md,
                stroke_width=1,
                stroke_fill=(0, 0, 0, 100),
            )
            y += LINE_HEIGHT_H2 + SPACING_XS
        draw.text(
            (MARGIN_PAGE, y),
            "Residual effects at 50% magnitude.",
            fill=(120, 120, 120, 255),
            font=font_sm,
        )
        y += SPACING_MD  # 48px — clears FONT_BODY text (~28px glyph) with 20px visual gap

        # Large stat numbers (centered, dramatic) (C7: accent color stats)
        font_stat = load_bold_font(FONT_STAT)
        font_label = load_monospace_font(FONT_BODY)

        # Stats content panel — asymmetric padding compensates font metrics:
        # FONT_STAT (140px) has ~15px internal ascent space, FONT_BODY (32px) has ~5px
        _pad_top = SPACING_XS      # 12 — stat glyph adds ~15px visual space internally
        _pad_bottom = SPACING_SM   # 24 — label text sits tighter to bottom edge
        stats_panel_y = y
        _stat_advance = FONT_STAT + SPACING_SM + FONT_BODY + SPACING_SM  # 220 — matches render
        stats_panel_h = (
            _pad_top + _stat_advance + STATS_LABEL_OFFSET + FONT_BODY + _pad_bottom
        )
        draw.rounded_rectangle(
            [(w // 2 - STATS_PANEL_WIDTH, stats_panel_y), (w // 2 + STATS_PANEL_WIDTH, stats_panel_y + stats_panel_h)],
            radius=PANEL_RADIUS,
            fill=(0, 0, 0, 40),
        )

        # Events spawned (C7: stat numbers in accent color) -- inside panel with top padding
        stat_y = stats_panel_y + _pad_top
        events_text = str(events_spawned_total)
        bbox = draw.textbbox((0, 0), events_text, font=font_stat)
        tw = bbox[2] - bbox[0]
        stat_x = w // 2 - tw // 2
        text_with_glow(
            img,
            (stat_x, stat_y),
            events_text,
            font_stat,
            (*accent, 230),
            (*accent, 50),
            glow_radius=10,
        )
        draw = ImageDraw.Draw(img)
        label_text = "EVENTS SPAWNED"
        lbbox = draw.textbbox((0, 0), label_text, font=font_label)
        lw = lbbox[2] - lbbox[0]
        draw.text(
            (w // 2 - lw // 2, stat_y + STATS_LABEL_OFFSET),
            label_text,
            fill=(100, 100, 100, 255),
            font=font_label,
        )
        stat_y += FONT_STAT + SPACING_SM + FONT_BODY + SPACING_SM  # advance past stat + label + gap

        # Shards affected (C7: stat numbers in accent color)
        shards_text = str(shards_affected)
        bbox = draw.textbbox((0, 0), shards_text, font=font_stat)
        tw = bbox[2] - bbox[0]
        stat_x = w // 2 - tw // 2
        text_with_glow(
            img,
            (stat_x, stat_y),
            shards_text,
            font_stat,
            (*accent, 230),
            (*accent, 50),
            glow_radius=10,
        )
        draw = ImageDraw.Draw(img)
        label_text = "SHARDS AFFECTED"
        lbbox = draw.textbbox((0, 0), label_text, font=font_label)
        lw = lbbox[2] - lbbox[0]
        draw.text(
            (w // 2 - lw // 2, stat_y + STATS_LABEL_OFFSET),
            label_text,
            fill=(100, 100, 100, 255),
            font=font_label,
        )

        # Elegiac closing lines -- gap matches visual gap above panel (~20px)
        closing_y = stats_panel_y + stats_panel_h + SPACING_SM
        closing_y = min(closing_y, STORY_CLOSING_MAX_Y)
        font_closing = load_italic_font(FONT_CTA)
        closing_1 = "The trembling fades."
        closing_2 = "The scars remain."

        bbox_1 = draw.textbbox((0, 0), closing_1, font=font_closing)
        w1 = bbox_1[2] - bbox_1[0]
        text_with_glow(
            img,
            (w // 2 - w1 // 2, closing_y),
            closing_1,
            font_closing,
            (*accent, 220),
            (*accent, 60),
            glow_radius=8,
        )

        bbox_2 = draw.textbbox((0, 0), closing_2, font=font_closing)
        w2 = bbox_2[2] - bbox_2[0]
        draw = ImageDraw.Draw(img)
        draw.text(
            (w // 2 - w2 // 2, closing_y + LINE_HEIGHT_H1),
            closing_2,  # Consistent closing line gap
            fill=(*accent, 120),
            font=font_closing,
        )

        # U10: monitoring frequency + timestamp below closing
        monitor_y = closing_y + 144
        filler_start_y = monitor_y  # Track where content ends for atmospheric filler
        if monitor_y < STORY_FOOTER_Y - 80:
            font_monitor = load_monospace_font(FONT_CAPTION)
            mon_text = "MONITORING FREQUENCY: DIMINISHING"
            mbbox = draw.textbbox((0, 0), mon_text, font=font_monitor)
            mw = mbbox[2] - mbbox[0]
            draw.text(
                (w // 2 - mw // 2, monitor_y),
                mon_text,
                fill=(60, 60, 60, 255),
                font=font_monitor,
            )
            ts_text = "SUBSTRATE CYCLE: CLOSING"
            tsbbox = draw.textbbox((0, 0), ts_text, font=font_monitor)
            tsw = tsbbox[2] - tsbbox[0]
            draw.text(
                (w // 2 - tsw // 2, monitor_y + 32),
                ts_text,
                fill=(50, 50, 50, 255),
                font=font_monitor,
            )
            filler_start_y = monitor_y + SPACING_SM

        # Atmospheric filler for the lower zone (subsiding has compact content)
        draw_atmospheric_filler(img, filler_start_y, STORY_FOOTER_Y - SPACING_SM, accent, archetype)

        return self._finalize_story(img, accent, vignette_intensity=0.35)
