import { css } from 'lit';

/**
 * Shared dispatch / newspaper styles for all news-related components.
 *
 * Extracts common patterns from BleedGazetteSidebar, ChronicleFeed,
 * and DailyBriefingModal into reusable CSS classes.
 *
 * Usage: `static styles = [dispatchStyles, css\`...\`]`
 *
 * Classes:
 *   .dispatch              — Base card with entrance animation
 *   .dispatch--compact     — Compact variant (sidebar density)
 *   .dispatch--article     — Article variant (more vertical padding, bottom border)
 *   .dispatch__accent      — 3px accent bar (set --dispatch-accent for color)
 *   .dispatch__filed       — Timestamp footer ("FILED: HH:MM UTC")
 *   .dispatch__narrative   — Narrative text block (monospace, muted)
 *   .dispatch__source      — Source attribution row
 *   .dispatch__source-name — Source name (brutalist uppercase)
 *   .dispatch__source-dot  — Color dot indicator
 *   .dispatch__meta        — Metadata text (monospace, small)
 *   .dispatch__read-more   — "Read more" link with arrow
 *   .dispatch-section-label — Section divider with dashed border
 *   .dispatch-scroll-reveal — Scroll-triggered entrance (add .in-view to activate)
 */
export const dispatchStyles = css`
  /* ── Base Dispatch Card ───────────────────────────── */

  .dispatch {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    opacity: 0;
    animation: dispatch-enter var(--duration-entrance, 350ms)
      var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  .dispatch--compact {
    padding: var(--space-3);
    gap: var(--space-2);
  }

  .dispatch--article {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-separator);
    padding: var(--space-6) 0 var(--space-8);
    gap: 0;
    animation: none;
    opacity: 1;
  }

  .dispatch--article:last-child {
    border-bottom: none;
  }

  /* ── Accent Bar ───────────────────────────────────── */

  .dispatch__accent {
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--dispatch-accent, var(--color-border));
  }

  .dispatch--article > .dispatch__accent {
    left: -20px;
    top: var(--space-6);
    bottom: var(--space-8);
    height: auto;
  }

  .dispatch__accent--pulse {
    animation: dispatch-accent-pulse 2.5s ease-in-out infinite;
  }

  /* ── Timestamp Footer ─────────────────────────────── */

  .dispatch__filed {
    font-family: var(--font-mono, 'SF Mono', monospace);
    font-size: 9px;
    color: var(--color-separator);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  }

  /* ── Narrative Text ───────────────────────────────── */

  .dispatch__narrative {
    font-family: var(--font-mono, 'Courier New', monospace);
    font-size: 11px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  /* ── Source Attribution ────────────────────────────── */

  .dispatch__source {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .dispatch__source-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--dispatch-accent, var(--color-text-muted));
  }

  .dispatch__source-name {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 900;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .dispatch__source-link {
    color: inherit;
    text-decoration: none;
    transition: color var(--duration-normal, 200ms);
  }

  .dispatch__source-link:hover {
    color: var(--color-accent-amber);
  }

  /* ── Metadata ─────────────────────────────────────── */

  .dispatch__meta {
    font-family: var(--font-mono, 'SF Mono', monospace);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 1px;
  }

  /* ── Headline (serif, fluid) ──────────────────────── */

  .dispatch__headline {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(1.1rem, 2vw, 1.4rem);
    font-weight: 700;
    line-height: 1.35;
    color: var(--color-text-primary);
    text-wrap: balance;
    margin: 0;
  }

  .dispatch__headline--hero {
    font-size: clamp(1.4rem, 3vw, 2rem);
    line-height: 1.2;
  }

  /* ── Excerpt ──────────────────────────────────────── */

  .dispatch__excerpt {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: 15px;
    line-height: 1.7;
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  }

  /* ── Masthead Title ───────────────────────────────── */

  .dispatch__masthead {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: 13px;
    color: var(--color-text-muted);
    font-style: italic;
    margin: 0;
  }

  /* ── Read More Link ───────────────────────────────── */

  .dispatch__read-more {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 900;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--dispatch-accent, var(--color-text-secondary));
    transition: color var(--duration-normal, 200ms);
  }

  .dispatch__read-more:hover {
    color: var(--color-accent-amber);
  }

  .dispatch__read-more-arrow {
    transition: transform var(--duration-normal, 200ms);
  }

  .dispatch__read-more:hover .dispatch__read-more-arrow {
    transform: translateX(4px);
  }

  /* ── Section Label (dashed divider) ───────────────── */

  .dispatch-section-label {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 9px;
    font-weight: var(--font-bold, 700);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-1);
    border-bottom: 1px dashed var(--color-border-light);
  }

  /* ── Bureau Header ────────────────────────────────── */

  .dispatch-bureau {
    font-family: var(--font-bureau, Georgia, 'Times New Roman', serif);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--color-text-muted);
    margin: 0;
  }

  /* ── Scroll Reveal ────────────────────────────────── */

  .dispatch-scroll-reveal {
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)),
      transform 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    transition-delay: calc(var(--i, 0) * 80ms);
  }

  .dispatch-scroll-reveal.in-view {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Stat Card (from Briefing) ────────────────────── */

  .dispatch-stat {
    padding: var(--space-2-5, 10px) var(--space-3);
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border-light);
  }

  .dispatch-stat__value {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: var(--text-xl, 20px);
    font-weight: var(--font-black, 900);
    line-height: 1;
    margin-bottom: 2px;
  }

  .dispatch-stat__value--critical { color: var(--color-danger); }
  .dispatch-stat__value--positive { color: var(--color-success); }
  .dispatch-stat__value--neutral  { color: var(--color-text-primary); }
  .dispatch-stat__value--accent   { color: var(--color-text-secondary); }

  .dispatch-stat__label {
    font-family: var(--font-mono, 'SF Mono', monospace);
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  /* ── Strength Dots ────────────────────────────────── */

  .dispatch__strength {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .dispatch__strength-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    border: 1px solid var(--color-separator);
  }

  .dispatch__strength-dot--filled {
    background: var(--dispatch-accent, var(--color-icon));
    border-color: var(--dispatch-accent, var(--color-icon));
  }

  /* ── Keyframes ────────────────────────────────────── */

  @keyframes dispatch-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes dispatch-accent-pulse {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 1; }
  }

  /* ── Reduced Motion ───────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .dispatch {
      opacity: 1;
      animation: none;
    }

    .dispatch__accent--pulse {
      animation: none;
      opacity: 1;
    }

    .dispatch-scroll-reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .dispatch__read-more-arrow {
      transition: none;
    }
  }

  /* ── Responsive ───────────────────────────────────── */

  @media (max-width: 640px) {
    .dispatch--article > .dispatch__accent {
      left: -12px;
    }

    .dispatch--article {
      padding: var(--space-4) 0 var(--space-6);
    }
  }
`;
