/**
 * Shared CSS module for Simulation Broadsheet layout.
 *
 * Provides the 8-column-inspired grid layout (simplified to main + sidebar),
 * column rules, fold line, and responsive breakpoints. Designed to compose
 * with dispatchStyles for article-level styling.
 *
 * Usage: `static styles = [dispatchStyles, broadsheetStyles, css\`...\`]`
 */
import { css } from 'lit';

export const broadsheetStyles = css`
  /* ── Broadsheet Grid Layout ──────────────────────── */

  .broadsheet {
    display: grid;
    grid-template-columns: 1fr 280px;
    grid-auto-rows: auto;
    gap: var(--space-6);
    max-width: var(--container-xl);
    margin: 0 auto;
    padding: 0 var(--space-6);
    position: relative;
    animation: broadsheet-fade-in var(--duration-entrance) var(--ease-dramatic) both;
  }

  @keyframes broadsheet-fade-in {
    from { opacity: 0; }
  }

  /* ── Full-width Sections ─────────────────────────── */

  .broadsheet__masthead {
    grid-column: 1 / -1;
  }

  .broadsheet__ticker {
    grid-column: 1 / -1;
  }

  /* ── Hero Section (full-width) ───────────────────── */

  .broadsheet__hero {
    grid-column: 1 / -1;
    border-bottom: 3px double var(--color-border);
    padding-bottom: var(--space-8);
  }

  /* ── Multi-Column Articles ───────────────────────── */

  .broadsheet__columns {
    grid-column: 1;
    column-width: 28ch;
    column-gap: var(--space-6);
    column-rule: 1px solid var(--color-border-light);
    column-fill: balance;
  }

  /* ── Health Sidebar (sticky) ─────────────────────── */

  .broadsheet__health {
    grid-column: 2;
    position: sticky;
    top: calc(var(--header-height) + var(--space-4));
    height: fit-content;
  }

  /* ── Gazette Wire Sidebar ────────────────────────── */

  .broadsheet__wire {
    grid-column: 2;
  }

  /* ── Fold Line (broadsheet crease) ───────────────── */

  .broadsheet__fold {
    grid-column: 1 / -1;
    position: relative;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent 0%,
      var(--color-border-light) 10%,
      var(--color-border-light) 90%,
      transparent 100%
    );
    margin: var(--space-4) 0;
  }

  .broadsheet__fold::after {
    content: attr(data-label);
    position: absolute;
    left: 50%;
    top: -8px;
    transform: translateX(-50%);
    font-family: var(--font-brutalist);
    font-size: 8px;
    font-weight: var(--font-black);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: var(--color-surface);
    padding: 0 var(--space-3);
  }

  /* ── Footer Section ──────────────────────────────── */

  .broadsheet__footer {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-12) var(--space-6);
    border-top: 1px dashed var(--color-border-light);
  }

  .broadsheet__complete-mark {
    font-family: var(--font-brutalist);
    font-size: var(--text-4xl);
    color: var(--color-primary);
    opacity: 0.15;
    line-height: 1;
    margin-bottom: var(--space-4);
  }

  .broadsheet__complete-text {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* ── Reading Progress Bar (scroll-driven) ────────── */

  .broadsheet__progress {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--color-primary);
    transform-origin: left;
    animation: broadsheet-progress linear;
    animation-timeline: scroll(nearest block);
    z-index: var(--z-header);
  }

  @keyframes broadsheet-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  /* ── Breaking News Banner (alarmed voice) ────────── */

  .broadsheet__breaking {
    grid-column: 1 / -1;
    background: var(--color-danger);
    color: var(--color-text-inverse);
    font-family: var(--font-brutalist);
    font-size: 11px;
    font-weight: var(--font-black);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-align: center;
    padding: var(--space-2) var(--space-4);
    animation: breaking-pulse 2s ease-in-out infinite;
  }

  @keyframes breaking-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* ── Theme Atmosphere Overlays ───────────────────── */

  .broadsheet--scanlines {
    position: relative;
  }

  .broadsheet--scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      color-mix(in srgb, var(--color-text-primary) 1.5%, transparent) 2px,
      color-mix(in srgb, var(--color-text-primary) 1.5%, transparent) 4px
    );
    pointer-events: none;
    z-index: var(--z-raised);
  }

  .broadsheet--textured {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    background-blend-mode: multiply;
  }

  /* ── Drop Cap (Hero Article Lede) ────────────────── */

  .broadsheet__hero-lede::first-letter {
    initial-letter: 3;
    font-family: var(--heading-font);
    font-weight: var(--heading-weight);
    color: var(--color-primary);
    margin-right: var(--space-2);
  }

  @supports not (initial-letter: 3) {
    .broadsheet__hero-lede::first-letter {
      float: left;
      font-size: 3.5em;
      line-height: 0.8;
      padding-right: var(--space-2);
      padding-top: 4px;
    }
  }

  /* ── Article Container Query ─────────────────────── */

  .broadsheet__article-wrap {
    container-type: inline-size;
    container-name: article;
    break-inside: avoid;
    margin-bottom: var(--space-6);
  }

  /* ── Archive Section ─────────────────────────────── */

  .broadsheet__archive {
    grid-column: 1 / -1;
    border-top: 3px solid var(--color-primary);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
  }

  .broadsheet__archive-heading {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
  }

  .broadsheet__archive-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .broadsheet__archive-item {
    opacity: 0;
    animation: archive-slide var(--duration-entrance) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger));
  }

  @keyframes archive-slide {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .broadsheet__archive-btn {
    appearance: none;
    font: inherit;
    text-align: start;
    background: none;
    border: none;
    color: inherit;
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border-light);
    cursor: pointer;
    transition: background var(--transition-fast);
    width: 100%;
  }

  .broadsheet__archive-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 4%, transparent);
  }

  .broadsheet__archive-btn:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: -2px;
  }

  .broadsheet__archive-num {
    flex-shrink: 0;
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    color: var(--color-primary);
    min-width: 2.5ch;
    text-align: right;
  }

  .broadsheet__archive-title {
    flex: 1;
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.3;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .broadsheet__archive-date {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 0.04em;
  }

  /* ── Responsive ──────────────────────────────────── */

  @media (max-width: 1024px) {
    .broadsheet {
      grid-template-columns: 1fr;
    }
    .broadsheet__health {
      grid-column: 1;
      position: static;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-3);
    }
    .broadsheet__wire {
      grid-column: 1;
    }
    .broadsheet__columns {
      column-width: 24ch;
    }
  }

  @media (max-width: 640px) {
    .broadsheet__columns {
      columns: 1;
    }
    .broadsheet {
      padding: 0 var(--space-4);
    }
  }

  /* ── Reduced Motion ──────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .broadsheet {
      animation: none;
    }
    .broadsheet__archive-item {
      animation: none;
      opacity: 1;
    }
    .broadsheet__progress {
      display: none;
    }
    .broadsheet__breaking {
      animation: none;
    }
  }
`;
