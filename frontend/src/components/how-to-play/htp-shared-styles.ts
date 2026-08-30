/**
 * How-to-Play — Shared styles for Phase 1–3 components.
 *
 * Extracted from Landing, Quickstart, GuideHub, and Topic to eliminate
 * ~400 lines of duplication. Each component imports what it needs and
 * overrides via component-scoped CSS variables.
 *
 * Override points (set in :host or component wrapper):
 *   --_hero-margin-bottom   (default: var(--space-12))
 *   --_hero-title-size      (default: var(--text-4xl))
 *   --_hero-title-margin    (default: var(--space-4))
 *   --_accent               (default: var(--color-primary))
 *   --_footer-padding-top   (default: var(--space-8))
 *   --_footer-margin-top    (default: 0)
 */

import { css } from 'lit';

// ── Hero ─────────────────────────────────────────────────────────────────────

export const htpHeroStyles = css`
  .hero {
    margin-bottom: var(--_hero-margin-bottom, var(--space-12));
  }

  .hero__eyebrow {
    display: inline-block;
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--_accent, var(--color-primary));
    border: var(--border-width-thick) solid var(--_accent, var(--color-primary));
    padding: var(--space-1) var(--space-3);
    margin-bottom: var(--space-4);
  }

  .hero__title {
    font-family: var(--font-brutalist);
    font-size: var(--_hero-title-size, var(--text-4xl));
    font-weight: var(--font-black);
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
    margin: 0 0 var(--_hero-title-margin, var(--space-4));
    text-transform: uppercase;
  }

  .hero__subtitle {
    font-family: var(--font-prose);
    font-size: var(--text-lg);
    font-style: italic;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: var(--leading-relaxed);
  }
`;

// ── Back Link ────────────────────────────────────────────────────────────────

export const htpBackStyles = css`
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    text-decoration: none;
    padding: var(--space-2) 0;
    margin-bottom: var(--space-8);
    cursor: pointer;
    transition: color var(--duration-fast) var(--ease-default);
  }

  .back:hover,
  .back:focus-visible {
    color: var(--_accent, var(--color-primary));
  }

  .back__arrow {
    transition: transform var(--duration-fast) var(--ease-default);
  }

  .back:hover .back__arrow {
    transform: translateX(-3px);
  }
`;

// ── Footer Navigation ────────────────────────────────────────────────────────

export const htpFooterNavStyles = css`
  .footer-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding-top: var(--_footer-padding-top, var(--space-8));
    margin-top: var(--_footer-margin-top, 0);
    border-top: var(--border-width-thick) solid var(--color-border);
  }

  .footer-nav__link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-brutalist);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--color-text-primary);
    padding: var(--space-3) var(--space-5);
    border: var(--border-width-thick) solid var(--color-primary);
    cursor: pointer;
    transition:
      background var(--duration-normal) var(--ease-default),
      color var(--duration-normal) var(--ease-default),
      box-shadow var(--duration-normal) var(--ease-default);
  }

  .footer-nav__link:hover,
  .footer-nav__link:focus-visible {
    background: var(--color-primary);
    color: var(--color-surface);
    box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  .footer-nav__link:active {
    box-shadow: 2px 2px 0 color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  .footer-nav__arrow {
    transition: transform var(--duration-fast) var(--ease-default);
  }

  .footer-nav__link:hover .footer-nav__arrow {
    transform: translateX(3px);
  }
`;

// ── Reduced Motion (shared base) ─────────────────────────────────────────────

export const htpReducedMotionBase = css`
  @media (prefers-reduced-motion: reduce) {
    .back:hover .back__arrow {
      transform: none;
    }

    .footer-nav__link:hover .footer-nav__arrow {
      transform: none;
    }
  }
`;

// ── Responsive: Mobile (<768px) ──────────────────────────────────────────────

export const htpMobileHeroStyles = css`
  @media (max-width: 767px) {
    .hero__title {
      font-size: var(--text-3xl);
    }

    .hero__subtitle {
      font-size: var(--text-base);
    }
  }
`;

// ── Responsive: 1440p+ and 4K — removed, deliberately ───────────────────────
//
// Two exports lived here, `htp1440pHeroStyles` and `htp4kHeroStyles`, raising
// the hero title to --text-5xl above 1440px and --text-6xl above 2560px. Neither
// was ever imported by any component, so neither step has ever rendered.
//
// They were not wired in, because wiring them in would break the contract this
// module documents at the top of the file. `htpHeroStyles` deliberately writes
// `font-size: var(--_hero-title-size, var(--text-4xl))` so a component can size
// its own hero; both removed exports set `font-size` DIRECTLY, at the same
// specificity and later in the cascade, so importing them would have overridden
// every component's --_hero-title-size — including the smaller one
// HowToPlayTopic sets on purpose.
//
// If the how-to-play hero should grow on wide screens, it belongs here as an
// override of --_hero-title-size, not of font-size. The same flaw sits in
// `htpMobileHeroStyles` above, which is likewise unimported; it is kept because
// HowToPlayTopic.ts carries a comment explaining why it does not import it, and
// removing the export would orphan that explanation.
