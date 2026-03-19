/**
 * Content page shared styles.
 *
 * Dark military-console aesthetic matching HowToPlayView:
 * scan-line textures, brutalist headings, monospace data tables.
 * Extended with prose typography for perspective articles,
 * blockquote styling, FAQ accordion, and CTA buttons.
 */

import { css } from 'lit';

export const contentStyles = css`
  /* ═══ HOST ═══════════════════════════════════════ */

  :host {
    display: block;
    min-height: 100vh;
    background: var(--color-surface-sunken);
    color: var(--color-text-secondary);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* ═══ SKIP LINK ═════════════════════════════════ */

  .skip-link {
    position: absolute;
    top: -100%;
    left: var(--space-4);
    z-index: var(--z-modal, 100);
    padding: var(--space-2) var(--space-4);
    background: var(--color-warning);
    color: var(--color-surface);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .skip-link:focus {
    top: var(--space-2);
  }

  /* ═══ HERO ═══════════════════════════════════════ */

  .hero {
    position: relative;
    border-bottom: 3px solid var(--color-border-light);
    overflow: hidden;
  }

  .hero__scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255 255 255 / 0.015) 2px,
      rgba(255 255 255 / 0.015) 4px
    );
    pointer-events: none;
  }

  .hero__inner {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-16) var(--space-6) var(--space-10);
    text-align: center;
  }

  .hero__classification {
    display: inline-block;
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-danger);
    border: 2px solid var(--color-danger);
    padding: var(--space-0-5) var(--space-3);
    margin-bottom: var(--space-6);
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.1s forwards;
  }

  .hero__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: clamp(2rem, 6vw, var(--text-4xl));
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3);
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.25s forwards;
  }

  .hero__sub {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-base);
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    margin: 0;
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.4s forwards;
  }

  .hero__line {
    width: 80px;
    height: 2px;
    background: var(--color-border);
    margin: var(--space-6) auto 0;
    opacity: 0;
    animation: scale-x 0.6s var(--ease-dramatic) 0.55s forwards;
  }

  /* ─── Perspective hero extras ───────────────── */

  .hero__byline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.55s forwards;
  }

  .hero__byline-sep {
    width: 4px;
    height: 4px;
    background: var(--color-border);
    border-radius: 50%;
  }

  @keyframes fade-down {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes scale-x {
    from { opacity: 0; transform: scaleX(0); }
    to   { opacity: 1; transform: scaleX(1); }
  }

  /* ═══ LAYOUT ═════════════════════════════════════ */

  .layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    max-width: 1200px;
    margin: 0 auto;
    gap: 0;
  }

  @media (min-width: 1440px) {
    .layout { max-width: 1400px; }
  }

  /* ═══ TOC SIDEBAR ════════════════════════════════ */

  .toc {
    position: sticky;
    top: 0;
    height: 100vh;
    padding: var(--space-8) var(--space-4) var(--space-8) var(--space-6);
    border-right: 1px solid var(--color-border-light);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .toc__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-4);
  }

  .toc__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .toc__link {
    display: block;
    padding: var(--space-1-5) var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-muted);
    text-decoration: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toc__link:hover {
    color: var(--color-text-tertiary);
    border-left-color: var(--color-border);
  }

  .toc__link:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: -2px;
  }

  .toc__link--active {
    color: var(--color-text-primary);
    border-left-color: var(--color-warning);
    background: var(--color-ascendant-gold);
  }

  /* ═══ MAIN CONTENT ═══════════════════════════════ */

  .content {
    padding: var(--space-8) var(--space-8) var(--space-16);
    min-width: 0;
  }

  /* ═══ SECTIONS ═══════════════════════════════════ */

  .section {
    margin-bottom: var(--space-16);
    scroll-margin-top: var(--space-4);
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s var(--ease-dramatic), transform 0.5s var(--ease-dramatic);
  }

  .section.revealed {
    opacity: 1;
    transform: translateY(0);
  }

  .section__divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .section__number {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: 11px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .section__rule {
    flex: 1;
    height: 1px;
    background: var(--color-border-light);
  }

  .section__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-xl);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4);
  }

  .section__text {
    color: var(--color-text-muted);
    line-height: var(--leading-relaxed);
    max-width: 65ch;
  }

  /* ═══ PROSE (PERSPECTIVE ARTICLES) ══════════════ */

  .prose {
    font-family: var(--font-prose, var(--font-body, var(--font-sans)));
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--color-text-secondary);
    max-width: 70ch;
  }

  .prose p {
    margin: 0 0 var(--space-4);
  }

  .prose a {
    color: var(--color-warning);
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    text-underline-offset: 3px;
    transition: text-decoration-color var(--transition-fast);
  }

  .prose a:hover {
    text-decoration-color: var(--color-warning);
  }

  .prose a:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: 2px;
  }

  .prose strong {
    color: var(--color-text-primary);
    font-weight: var(--font-bold);
  }

  .prose em {
    font-style: italic;
    color: var(--color-text-tertiary);
  }

  /* ═══ BLOCKQUOTE ════════════════════════════════ */

  .prose blockquote,
  blockquote {
    margin: var(--space-6) 0;
    padding: var(--space-4) var(--space-6);
    border-left: 3px solid var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 4%, var(--color-surface));
    font-style: italic;
    color: var(--color-text-tertiary);
  }

  .prose blockquote cite,
  blockquote cite {
    display: block;
    margin-top: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-style: normal;
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wide);
  }

  /* ═══ FIGURE ═══════════════════════════════════ */

  figure {
    margin: var(--space-6) 0;
    text-align: center;
  }

  figure img {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--color-border-light);
  }

  figcaption {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-2);
    letter-spacing: var(--tracking-wide);
  }

  /* ═══ CALLOUT ══════════════════════════════════ */

  .callout {
    margin: var(--space-6) 0;
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-border-light);
    border-left: 3px solid var(--color-border);
    background: var(--color-surface);
  }

  .callout--info {
    border-left-color: var(--color-info, var(--color-warning));
  }

  .callout--tip {
    border-left-color: var(--color-success, var(--color-warning));
  }

  .callout__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .callout__text {
    color: var(--color-text-muted);
    line-height: var(--leading-relaxed);
    max-width: 65ch;
  }

  /* ═══ FEATURE GRID (LANDING PAGES) ════════════ */

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-4);
    margin: var(--space-6) 0;
  }

  .feature-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.4s var(--ease-dramatic), transform 0.4s var(--ease-dramatic);
  }

  .revealed .feature-card {
    opacity: 1;
    transform: translateY(0);
  }

  .feature-card:nth-child(2) { transition-delay: 60ms; }
  .feature-card:nth-child(3) { transition-delay: 120ms; }
  .feature-card:nth-child(4) { transition-delay: 180ms; }

  .feature-card__icon {
    font-size: var(--text-xl);
    line-height: 1;
  }

  .feature-card__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
  }

  .feature-card__text {
    color: var(--color-text-muted);
    line-height: var(--leading-relaxed);
    font-size: var(--text-sm);
  }

  /* ═══ FAQ ACCORDION ═══════════════════════════ */

  .faq-section {
    margin: var(--space-8) 0;
  }

  .faq-section__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4);
  }

  .faq-item {
    border: 1px solid var(--color-border-light);
    border-bottom: none;
    background: var(--color-surface);
  }

  .faq-item:last-child {
    border-bottom: 1px solid var(--color-border-light);
  }

  .faq-item summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
    list-style: none;
    transition: background var(--transition-fast);
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::before {
    content: '+';
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    color: var(--color-warning);
    flex-shrink: 0;
    width: 1.2em;
    text-align: center;
    transition: transform var(--transition-fast);
  }

  .faq-item[open] summary::before {
    content: '−';
  }

  .faq-item summary:hover {
    background: color-mix(in srgb, var(--color-warning) 4%, var(--color-surface));
  }

  .faq-item summary:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: -2px;
  }

  .faq-item__answer {
    padding: 0 var(--space-4) var(--space-4) calc(var(--space-4) + 1.2em + var(--space-3));
    color: var(--color-text-muted);
    line-height: var(--leading-relaxed);
    font-size: var(--text-sm);
  }

  /* ═══ CTA SECTION ═════════════════════════════ */

  .cta-section {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-top: var(--space-10);
    padding-top: var(--space-8);
    border-top: 1px solid var(--color-border-light);
    justify-content: center;
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 2px solid transparent;
  }

  .cta-btn:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: 2px;
  }

  .cta-btn--primary {
    background: var(--color-warning);
    color: var(--color-surface);
    border-color: var(--color-warning);
  }

  .cta-btn--primary:hover {
    background: transparent;
    color: var(--color-warning);
  }

  .cta-btn--secondary {
    background: transparent;
    color: var(--color-warning);
    border-color: var(--color-warning);
  }

  .cta-btn--secondary:hover {
    background: var(--color-warning);
    color: var(--color-surface);
  }

  /* ═══ INTERNAL LINK LIST ═══════════════════════ */

  .link-list {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .link-list a {
    color: var(--color-warning);
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    text-underline-offset: 3px;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    transition: text-decoration-color var(--transition-fast);
  }

  .link-list a:hover {
    text-decoration-color: var(--color-warning);
  }

  .link-list a:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: 2px;
  }

  /* ═══ SCROLL REVEAL ═══════════════════════════ */

  @keyframes reveal-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ═══ RESPONSIVE ═════════════════════════════ */

  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .toc {
      position: sticky;
      top: 0;
      z-index: var(--z-raised);
      height: auto;
      border-right: none;
      border-bottom: 1px solid var(--color-border-light);
      background: var(--color-surface-sunken);
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .toc__label { display: none; }

    .toc__list {
      flex-direction: row;
      gap: 0;
    }

    .toc__link {
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: var(--space-1) var(--space-2);
      font-size: 10px;
    }

    .toc__link--active {
      border-bottom-color: var(--color-warning);
      border-left: none;
    }

    .content {
      padding: var(--space-4) var(--space-4) var(--space-10);
    }

    .hero__inner {
      padding: var(--space-10) var(--space-4) var(--space-6);
    }

    .feature-grid {
      grid-template-columns: 1fr;
    }

    .cta-section {
      flex-direction: column;
      align-items: stretch;
    }

    .cta-btn {
      justify-content: center;
    }
  }

  /* ═══ REDUCED MOTION ═══════════════════════════ */

  @media (prefers-reduced-motion: reduce) {
    .hero__classification,
    .hero__title,
    .hero__sub,
    .hero__line,
    .hero__byline,
    .feature-card {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .section {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
`;
