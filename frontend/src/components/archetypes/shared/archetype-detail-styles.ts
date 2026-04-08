/**
 * Archetype Detail Pages — Shared style modules.
 *
 * Design language: Literary exhibition, not sci-fi terminal.
 * Spectral (serif) dominates. Courier only for the monumental title
 * and mechanic data. Generous sizes, soft borders, comfortable reading.
 *
 * Three modules:
 *   1. detailTokenStyles  — CSS custom properties (typography, spacing, surfaces)
 *   2. detailRoomStyles   — Scroll-snap room structure, gallery lighting
 *   3. detailCardStyles   — Museum-label, glass-card, enemy-frame patterns
 */

/* lint-color-ok — archetype-specific atmospheric colors are not semantic tokens */

import { css } from 'lit';

// ── Tokens ───────────────────────────────────────────────────────────────────

export const detailTokenStyles = css`
  :host {
    /* Accent — set per archetype via inline --_accent */
    --_accent: #d4364b;

    /* ── Typography scale ── */
    --_monument-size: clamp(3.5rem, 10vw + 1rem, 8rem);
    --_monument-weight: 900;
    --_monument-tracking: 0.25em;

    --_section-size: clamp(1.5rem, 2.5vw + 0.5rem, 2.2rem);
    --_section-tracking: 0.04em;

    --_wall-quote-size: clamp(1.4rem, 2.8vw + 0.5rem, 2.5rem);

    --_exhibit-size: clamp(1rem, 1.1vw + 0.5rem, 1.2rem);
    --_exhibit-leading: 1.75;

    --_label-size: clamp(0.8rem, 0.8vw + 0.3rem, 0.92rem);
    --_label-tracking: 0.02em;

    --_body-size: clamp(0.95rem, 0.9vw + 0.45rem, 1.1rem);

    /* Small labels — only for genuinely small metadata */
    --_meta-size: clamp(0.7rem, 0.7vw + 0.25rem, 0.8rem);

    /* ── Fonts ── */
    --_font-display: var(--font-brutalist, 'Courier New', monospace);
    --_font-prose: var(--font-bureau, 'Spectral', Georgia, serif);
    --_font-data: var(--font-mono, 'Courier New', monospace);

    /* ── Surfaces ── */
    --_surface-top: color-mix(in oklch, var(--color-surface, #0a0a0a) 90%, var(--_accent) 10%);
    --_surface-mid: color-mix(in oklch, #121218 92%, var(--_accent) 8%);
    --_surface-deep: color-mix(in oklch, #0d0d1a 94%, var(--_accent) 6%);
    --_surface-abyss: #0a0a0f;

    /* ── Derived accent ── */
    --_accent-subtle: color-mix(in oklch, var(--_accent) 15%, var(--color-surface, #0a0a0a));
    --_accent-border: color-mix(in oklch, var(--_accent) 20%, transparent);
    --_accent-glow: color-mix(in oklch, var(--_accent) 30%, transparent);
    --_accent-dim: color-mix(in oklch, var(--_accent) 50%, var(--color-text-muted, #666));

    /* ── Viewport (accounts for PlatformHeader) ── */
    --_viewport: calc(100vh - var(--header-height, 60px));

    /* ── Spacing ── */
    --_room-padding-x: var(--space-8, 32px);
    --_room-padding-y: var(--space-10, 40px);

    /* ── Transitions ── */
    --_ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* dvh progressive enhancement — handles mobile address bar */
  @supports (height: 100dvh) {
    :host {
      --_viewport: calc(100dvh - var(--header-height, 60px));
    }
  }

  @media (max-width: 768px) {
    :host {
      --_monument-size: clamp(2.5rem, 12vw, 4.5rem);
      --_monument-tracking: 0.15em;
      --_wall-quote-size: clamp(1.15rem, 4vw, 1.6rem);
      --_room-padding-x: var(--space-5, 20px);
      --_room-padding-y: var(--space-6, 24px);
    }
  }
`;

// ── Room Structure ───────────────────────────────────────────────────────────

export const detailRoomStyles = css`
  *, *::before, *::after { box-sizing: border-box; }

  .room {
    position: relative;
    min-height: var(--_viewport);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--_room-padding-y) var(--_room-padding-x);
    scroll-snap-align: start;
    overflow: hidden;
  }

  .room--grow {
    min-height: var(--_viewport);
    height: auto;
  }

  /* Gallery spotlight overlay — soft vignette, lets bg images breathe */
  .room::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at var(--_light-x, 50%) var(--_light-y, 30%),
      transparent 0%,
      rgba(0, 0, 0, 0.15) 40%,
      rgba(0, 0, 0, 0.35) 70%,
      rgba(0, 0, 0, 0.55) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  .room__content {
    position: relative;
    z-index: 2;
    max-width: 1100px;
    width: 100%;
  }

  /* ── Room-level divider ── */
  .room__divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      var(--_accent-border) 20%,
      var(--_accent-border) 80%,
      transparent
    );
    margin: var(--space-6, 24px) 0;
    flex-shrink: 0;
  }

  /* ── Parallax BG image ── */
  .room__bg {
    position: absolute;
    inset: -15% 0;
    z-index: 0;
    background: var(--_bg-url) center / cover no-repeat;
    opacity: var(--_bg-opacity, 0.5);
    pointer-events: none;
  }

  /* Scroll-driven parallax (modern CSS) */
  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) {
      .room__bg--parallax {
        animation: _parallax-shift linear both;
        animation-timeline: view();
        animation-range: cover;
      }
    }
  }

  @keyframes _parallax-shift {
    from { transform: translateY(-8%); }
    to   { transform: translateY(8%); }
  }

  /* ── Reveal animation for room content ── */
  .room__reveal {
    opacity: 1;
    transform: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) {
      .room__reveal {
        animation: _room-reveal linear both;
        animation-timeline: view();
        animation-range: entry 0% entry 70%;
      }
    }
  }

  @keyframes _room-reveal {
    from { opacity: 0; transform: translateY(2rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ── Card Patterns ────────────────────────────────────────────────────────────

export const detailCardStyles = css`
  /* ── Museum label (frosted glass panel) ── */
  .museum-label {
    max-width: 480px;
    padding: var(--space-5, 20px) var(--space-6, 24px);
    background: color-mix(in oklch, var(--color-surface, #0a0a0a) 75%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-left: 2px solid color-mix(in oklch, var(--_accent) 50%, transparent);
    border-radius: 4px;
    font-family: var(--_font-prose);
    font-size: var(--_label-size);
    letter-spacing: 0.01em;
    color: var(--color-text-secondary, #a0a0a0);
    line-height: 1.6;
  }

  @supports not (backdrop-filter: blur(16px)) {
    .museum-label {
      background: color-mix(in oklch, var(--color-surface, #0a0a0a) 92%, transparent);
    }
  }

  .museum-label blockquote {
    font-size: var(--_exhibit-size);
    font-style: italic;
    color: var(--color-text-primary, #e5e5e5);
    margin: 0 0 var(--space-4, 16px);
    line-height: var(--_exhibit-leading);
  }

  .museum-label__category {
    font-family: var(--_font-prose);
    font-size: var(--_meta-size);
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--_accent);
    opacity: 0.8;
    margin-bottom: 4px;
  }

  /* ── Glass card ── */
  .glass-card {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: var(--space-5, 20px);
    transition: transform 0.3s var(--_ease-dramatic), box-shadow 0.3s var(--_ease-dramatic);
  }

  @supports not (backdrop-filter: blur(10px)) {
    .glass-card {
      background: rgba(20, 20, 25, 0.95);
    }
  }

  .glass-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  /* ── Section header — literary, not brutalist ── */
  .section-header {
    font-family: var(--_font-prose);
    font-size: var(--_section-size);
    font-weight: 500;
    font-style: italic;
    letter-spacing: var(--_section-tracking);
    color: var(--color-text-primary, #e5e5e5);
    margin: 0 0 var(--space-3, 12px);
    text-shadow:
      0 0 40px var(--_accent-glow),
      0 2px 4px rgba(0, 0, 0, 0.8);
  }

  /* ── Stat chip — softer, readable ── */
  .stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 4px;
    font-family: var(--_font-prose);
    font-size: 0.82rem;
    letter-spacing: 0.01em;
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary, #a0a0a0);
    white-space: nowrap;
  }

  .stat-chip--accent {
    background: color-mix(in oklch, var(--_accent) 10%, transparent);
    color: var(--_accent);
    border: 1px solid color-mix(in oklch, var(--_accent) 15%, transparent);
  }

  /* ── Tier badges — refined ── */
  .tier-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 3px;
    font-family: var(--_font-prose);
    font-size: 0.72rem;
    font-weight: 500;
    font-style: italic;
  }

  .tier-badge--minion {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-muted, #888);
  }
  .tier-badge--standard {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary, #a0a0a0);
  }
  .tier-badge--narrative {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary, #a0a0a0);
  }
  .tier-badge--elite {
    background: color-mix(in oklch, var(--_accent) 10%, transparent);
    color: var(--_accent);
    border: 1px solid color-mix(in oklch, var(--_accent) 15%, transparent);
  }
  .tier-badge--boss {
    background: color-mix(in oklch, var(--_accent) 15%, transparent);
    color: var(--_accent);
    border: 1px solid color-mix(in oklch, var(--_accent) 30%, transparent);
    box-shadow: 0 0 12px var(--_accent-glow);
  }
  .tier-badge--combat {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary, #a0a0a0);
  }

  /* ── Prose text ── */
  .prose {
    font-family: var(--_font-prose);
    font-size: var(--_body-size);
    line-height: var(--_exhibit-leading);
    color: var(--color-text-secondary, #a0a0a0);
    max-width: 65ch;
  }

  .prose--bright {
    color: var(--color-text-primary, #e5e5e5);
  }

  /* ── Aptitude bar ── */
  .aptitude-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--_font-prose);
    font-size: 0.88rem;
    color: var(--color-text-secondary, #a0a0a0);
  }

  .aptitude-row__label {
    min-width: 110px;
    text-align: right;
  }

  .aptitude-row__bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    overflow: hidden;
    max-width: 200px;
  }

  .aptitude-row__fill {
    height: 100%;
    border-radius: 3px;
    background: var(--_accent);
    transition: width 0.6s var(--_ease-dramatic);
  }

  .aptitude-row__value {
    min-width: 28px;
    text-align: right;
    color: var(--_accent);
    font-weight: 600;
  }
`;
