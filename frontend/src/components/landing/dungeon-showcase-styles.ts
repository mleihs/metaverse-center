/**
 * Dungeon Showcase — Composed style modules.
 *
 * Separated from the component to follow the codebase pattern
 * (terminalTokens, mapNodeStyles, etc.) and keep the component file
 * focused on behavior.
 *
 * Three modules:
 *   1. showcaseLayoutStyles  — slide structure, navigation, typography
 *   2. showcaseAtmosphereStyles — per-archetype background animations
 *   3. showcaseTransitionStyles — per-archetype quote enter/leave effects
 */

/* lint-color-ok — archetype-specific atmospheric colors are not semantic tokens */

import { css } from 'lit';

// ── Layout & Navigation ─────────────────────────────────────────────────────

export const showcaseLayoutStyles = css`
  :host {
    display: block; position: relative;
    width: 100%; height: 100vh; height: 100dvh;
    overflow: hidden;
    background: var(--color-surface, #0a0a0a);
    contain: layout style;
  }

  *, *::before, *::after { box-sizing: border-box; }

  /* ── Slide ── */

  .slide {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center; text-align: center;
    opacity: 0; visibility: hidden;
    transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.8s;
    z-index: 1; padding: 60px 24px 120px;
  }
  .slide.active { opacity: 1; visibility: visible; z-index: 2; }

  .slide__atmosphere {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    /* AI-generated background image, set via inline --_bg-image */
    background: var(--_bg-image) center / cover no-repeat;
  }

  .slide__vignette {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    /* Heavy vignette + top/bottom darkening for text readability over images */
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, transparent 30%, transparent 60%, rgba(0, 0, 0, 0.7) 100%),
      radial-gradient(ellipse 75% 75% at 50% 50%, transparent 20%, rgba(0, 0, 0, 0.75) 100%);
  }

  /* ── Content ── */

  .slide__content {
    position: relative; z-index: 2;
    max-width: 800px; width: 100%;
    display: flex; flex-direction: column; align-items: center;
  }

  /* Content scrim — frosted glass behind the text column.
     Blurs + darkens the background image so text is readable without
     a visible dark box. Applied on leaf element (::after), not layout
     container.

     Per-slide tuning via inline CSS vars --_scrim-blur, --_scrim-brightness,
     --_scrim-saturate (set from ArchetypeSlide.scrim in the data file).
     Single source of truth: data file owns the values, CSS owns the shape.

     Mask uses white→transparent (not black→transparent) because CSS
     gradient masks default to luminance mode where black = invisible. */
  .slide__content::after {
    content: '';
    position: absolute;
    inset: -120px -200px;
    z-index: -1;
    background: transparent;
    backdrop-filter:
      blur(var(--_scrim-blur, 16px))
      brightness(var(--_scrim-brightness, 0.35))
      saturate(var(--_scrim-saturate, 0.5));
    -webkit-backdrop-filter:
      blur(var(--_scrim-blur, 16px))
      brightness(var(--_scrim-brightness, 0.35))
      saturate(var(--_scrim-saturate, 0.5));
    mask-image: radial-gradient(
      ellipse 110% 110% at 50% 45%,
      white 0%,
      rgba(255,255,255, 0.75) 15%,
      rgba(255,255,255, 0.45) 30%,
      rgba(255,255,255, 0.2) 45%,
      rgba(255,255,255, 0.06) 60%,
      transparent 75%
    );
    -webkit-mask-image: radial-gradient(
      ellipse 110% 110% at 50% 45%,
      white 0%,
      rgba(255,255,255, 0.75) 15%,
      rgba(255,255,255, 0.45) 30%,
      rgba(255,255,255, 0.2) 45%,
      rgba(255,255,255, 0.06) 60%,
      transparent 75%
    );
    pointer-events: none;
  }

  /* ── Shared text-shadow stack for readability over images ──
     Layer 1: tight dark halo (crispness)
     Layer 2: wider dark spread (separation from background)
     Layer 3: soft accent glow (atmosphere) */

  .slide__numeral {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.7rem, 1vw, 0.85rem);
    font-weight: 400; letter-spacing: 0.3em;
    text-transform: uppercase; opacity: 0.65; margin-bottom: 16px;
    color: var(--_accent);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6), 0 0 24px rgba(0, 0, 0, 0.3);
  }

  .slide__title {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: clamp(2.2rem, 5.5vw, 4.2rem);
    font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; line-height: 1.05; margin: 0 0 6px;
    color: var(--_accent);
    text-shadow:
      0 2px 4px rgba(0, 0, 0, 0.95),
      0 0 16px rgba(0, 0, 0, 0.8),
      0 0 40px rgba(0, 0, 0, 0.4),
      0 0 60px color-mix(in srgb, var(--_accent) 20%, transparent);
  }
  .active .slide__title { animation: title-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }

  .slide__subtitle {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(1rem, 2vw, 1.4rem);
    font-style: italic; font-weight: 500;
    letter-spacing: 0.08em; opacity: 0.85; margin: 0 0 24px;
    color: var(--_accent);
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.95),
      0 0 12px rgba(0, 0, 0, 0.7),
      0 0 32px rgba(0, 0, 0, 0.35);
  }
  .active .slide__subtitle { animation: subtitle-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }

  .slide__divider {
    width: 60px; height: 1px; margin: 0 0 24px; opacity: 0.5;
    background: var(--_accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--_accent) 30%, transparent);
  }
  .active .slide__divider { animation: divider-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both; }

  .slide__tagline {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.85rem, 1.3vw, 1.05rem);
    font-weight: 500; letter-spacing: 0.04em; line-height: 1.6;
    opacity: 0.75; margin: 0 0 40px; max-width: 540px;
    color: var(--_accent);
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.95),
      0 0 10px rgba(0, 0, 0, 0.7),
      0 0 28px rgba(0, 0, 0, 0.35);
  }
  .active .slide__tagline { animation: tagline-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }

  /* ── CTA Button ──
     Architecture: transition-based hover system (no animation:infinite).
     ::before = accent background sweep (scaleX 0→1, direction per archetype).
     ::after  = outer glow halo (opacity 0→1).
     Asymmetric timing: fast enter (0.25s), slow exit (0.45s).
     Per-archetype character via --_sweep-origin custom property. */

  .slide__cta {
    position: relative; z-index: 3;
    display: inline-flex; align-items: center; gap: 10px;
    margin: 0 0 36px; padding: 12px 32px;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: clamp(0.65rem, 0.9vw, 0.75rem);
    font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.25em; line-height: 1;
    text-decoration: none;
    color: var(--_accent);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--_accent) 35%, transparent);
    cursor: pointer;
    opacity: 0; transform: translateY(6px);
    overflow: hidden;
    isolation: isolate;
    /* Slow graceful EXIT transitions */
    transition:
      color 0.45s cubic-bezier(0.19, 1, 0.22, 1),
      border-color 0.45s cubic-bezier(0.19, 1, 0.22, 1),
      box-shadow 0.5s cubic-bezier(0.19, 1, 0.22, 1),
      transform 0.4s cubic-bezier(0.19, 1, 0.22, 1),
      letter-spacing 0.5s cubic-bezier(0.19, 1, 0.22, 1);
    box-shadow: 0 0 0 0 transparent;
    text-shadow:
      0 1px 3px var(--color-surface, #0a0a0a),
      0 0 8px var(--color-surface, #0a0a0a);
  }

  /* Background sweep layer — direction set by --_sweep-origin per archetype */
  .slide__cta::before {
    content: '';
    position: absolute; inset: 0;
    background: var(--_accent);
    transform: scaleX(0);
    transform-origin: var(--_sweep-origin, left);
    transition: transform 0.45s cubic-bezier(0.19, 1, 0.22, 1);
    z-index: -1;
  }

  /* Glow halo layer — performant: only animates opacity */
  .slide__cta::after {
    content: '';
    position: absolute;
    inset: -1px;
    box-shadow:
      0 0 16px color-mix(in srgb, var(--_accent) 20%, transparent),
      0 0 32px color-mix(in srgb, var(--_accent) 10%, transparent);
    opacity: 0;
    transition: opacity 0.45s cubic-bezier(0.19, 1, 0.22, 1);
    pointer-events: none;
  }

  /* Staggered entry — 0.4s after tagline */
  .active .slide__cta {
    animation: cta-enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
  }
  @keyframes cta-enter {
    0%   { opacity: 0; transform: translateY(10px); }
    60%  { opacity: 0.7; transform: translateY(-1px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  /* HOVER — fast enter, accent bg fills, text inverts to dark */
  .slide__cta:hover {
    color: var(--color-surface, #0a0a0a);
    border-color: var(--_accent);
    transform: translateY(-2px);
    text-shadow: none;
    /* Fast ENTER transitions */
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.25s ease,
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      letter-spacing 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .slide__cta:hover::before { transform: scaleX(1); }
  .slide__cta:hover::after  { opacity: 1; }

  .slide__cta:active {
    transform: scale(0.96);
    transition: transform 0.08s;
  }

  .slide__cta:focus-visible {
    outline: 2px solid var(--color-accent-amber, #f59e0b);
    outline-offset: 4px;
  }

  .slide__cta-text {
    position: relative; z-index: 1;
  }

  .slide__cta-arrow {
    font-size: 0.6em; opacity: 0.6;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s;
    position: relative; z-index: 1;
  }
  .slide__cta:hover .slide__cta-arrow {
    transform: translateX(4px); opacity: 1;
  }

  /* ── Quote ── */

  .quote-block {
    max-width: 640px; width: 100%; min-height: 140px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; padding: 0 16px;
    position: relative;
    /* Base state: hidden (overridden by archetype transitions) */
    opacity: 0; transform: translateY(8px);
  }

  /* ── Quote text layers (translation + original stacked) ── */

  .quote-block__text-wrap {
    position: relative; width: 100%; text-align: center;
  }

  .quote-block__text {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    font-style: italic; font-weight: 500;
    line-height: 1.75; letter-spacing: 0.02em;
    color: var(--_accent);
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.95),
      0 0 8px rgba(0, 0, 0, 0.7),
      0 0 24px rgba(0, 0, 0, 0.35);
    transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
                filter 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .quote-block__text::before { content: '\u201c'; }
  .quote-block__text::after { content: '\u201d'; }

  /* Original-language layer — overlaid on translation */
  .quote-block__original {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    font-style: italic; font-weight: 500;
    line-height: 1.75; letter-spacing: 0.02em;
    color: var(--_accent);
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.95),
      0 0 8px rgba(0, 0, 0, 0.7),
      0 0 24px rgba(0, 0, 0, 0.35);
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    opacity: 0; filter: blur(4px);
    transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
                filter 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .quote-block__original::before { content: '\u201c'; }
  .quote-block__original::after { content: '\u201d'; }

  /* Language badge — shows original language label */
  .quote-block__lang {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 0.55rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.25em;
    color: var(--_accent); opacity: 0;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    transition: opacity 0.6s 0.3s;
  }

  /* Swap states: translation visible (default) → original visible */
  .quote-block.show-original .quote-block__text {
    opacity: 0; filter: blur(4px);
  }
  .quote-block.show-original .quote-block__original {
    opacity: 1; filter: blur(0px);
  }
  .quote-block.show-original .quote-block__lang {
    opacity: 0.5;
  }

  /* Swap + original phases: keep block visible while cross-fading inner layers.
     Specificity must match archetype rules (.slide--X .quote-block.phase). */
  .slide .quote-block.swapping,
  .slide .quote-block.original {
    opacity: 0.85;
    transform: none;
    filter: none;
  }

  .quote-block__author {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 0.65rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.6;
    color: var(--_accent);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.5);
  }
  .quote-block__author::before { content: '\u2014\u2009'; }

  /* ── Navigation ── */

  .nav-arrow {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
    background: none; border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.5);
    width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 18px; transition: all 0.3s;
  }
  .nav-arrow:hover { border-color: rgba(255, 255, 255, 0.3); color: rgba(255, 255, 255, 0.85); background: rgba(255, 255, 255, 0.04); }
  .nav-arrow:focus-visible { outline: 2px solid var(--color-accent-amber, #f59e0b); outline-offset: 2px; }
  .nav-arrow--prev { left: 20px; }
  .nav-arrow--next { right: 20px; }

  .nav-dots {
    position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
    z-index: 10; display: flex; gap: 16px; align-items: center;
  }
  .nav-dot {
    width: 8px; height: 8px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: transparent; cursor: pointer;
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1); padding: 0; position: relative;
  }
  .nav-dot::after { content: ''; position: absolute; inset: -8px; }
  .nav-dot:hover { border-color: rgba(255, 255, 255, 0.5); background: rgba(255, 255, 255, 0.1); }
  .nav-dot:focus-visible { outline: 2px solid var(--color-accent-amber, #f59e0b); outline-offset: 4px; }
  .nav-dot.active {
    width: 28px;
    border-color: color-mix(in srgb, var(--_accent) 60%, transparent);
    background: color-mix(in srgb, var(--_accent) 20%, transparent);
  }

  .classification {
    position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 10;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.35em; color: rgba(255, 255, 255, 0.3); white-space: nowrap;
  }

  .counter {
    position: absolute; bottom: 40px; right: 28px; z-index: 10;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em;
    color: rgba(255, 255, 255, 0.25);
  }

  /* ── Entry ── */
  @keyframes title-enter { from { opacity: 0; transform: translateY(20px); letter-spacing: 0.25em; } to { opacity: 1; transform: translateY(0); letter-spacing: 0.12em; } }
  @keyframes subtitle-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 0.7; transform: translateY(0); } }
  @keyframes divider-enter { from { opacity: 0; transform: scaleX(0); } to { opacity: 0.4; transform: scaleX(1); } }
  @keyframes tagline-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 0.5; transform: translateY(0); } }

  /* ── Reduced Motion ── */
  @media (prefers-reduced-motion: reduce) {
    .slide { transition: opacity 0.3s; }
    .slide__atmosphere::before, .slide__atmosphere::after { animation: none !important; }
    .active .slide__title, .active .slide__subtitle, .active .slide__divider, .active .slide__tagline, .active .slide__cta { animation: none !important; opacity: 1; }
    .slide__cta { transition: opacity 0.15s !important; }
    .slide__cta::before { display: none; }
    .quote-block { transition: opacity 0.2s !important; animation: none !important; }
    .quote-block.entering, .quote-block.visible { opacity: 0.85; transform: none; filter: none; }
    .quote-block.leaving { opacity: 0; }
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .slide { padding: 50px 20px 100px; }
    .nav-arrow { width: 40px; height: 40px; min-height: 44px; min-width: 44px; }
    .nav-arrow--prev { left: 8px; }
    .nav-arrow--next { right: 8px; }
    .nav-dots { bottom: 28px; gap: 12px; }
    .classification { font-size: 0.55rem; top: 16px; }
    .counter { bottom: 28px; right: 16px; font-size: 0.6rem; }
    .slide__cta { padding: 11px 24px; font-size: 0.6rem; min-height: 44px; margin-bottom: 28px; }
    .quote-block { min-height: 160px; }
  }
  @media (min-width: 2000px) {
    .slide__content { max-width: 960px; }
    .slide__title { font-size: 5rem; }
  }
`;

// ── Atmospheric Backgrounds ─────────────────────────────────────────────────

export const showcaseAtmosphereStyles = css`
  /* Scrim tuning now lives in dungeon-showcase-data.ts (ArchetypeSlide.scrim)
     and is applied as inline CSS vars on each slide container. No per-slide
     CSS overrides needed — single source of truth in the data file. */

  /* SHADOW — drifting cosmic fog overlay */
  .slide--shadow .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 40% 50% at 30% 60%, rgba(124, 92, 231, 0.06) 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 70% 30%, rgba(100, 60, 200, 0.04) 0%, transparent 100%);
    animation: shadow-drift 20s ease-in-out infinite alternate;
  }
  @keyframes shadow-drift { 0% { transform: translate(0, 0) scale(1); opacity: 0.6; } 50% { transform: translate(-3%, 2%) scale(1.08); opacity: 1; } 100% { transform: translate(2%, -1%) scale(0.95); opacity: 0.5; } }

  /* TOWER — cascading data streams overlay */
  .slide--tower .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(74, 138, 181, 0.03) 60px, rgba(74, 138, 181, 0.03) 61px);
    animation: tower-fall 8s linear infinite;
  }
  .slide--tower .slide__atmosphere::after {
    content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(180deg, transparent 0px, transparent 30px, rgba(74, 138, 181, 0.015) 30px, rgba(74, 138, 181, 0.015) 31px);
    animation: tower-fall 12s linear infinite;
  }
  @keyframes tower-fall { 0% { transform: translateY(-100%); } 100% { transform: translateY(0%); } }

  /* MOTHER — bioluminescent breath overlay */
  .slide--mother .slide__atmosphere::before {
    content: ''; position: absolute; inset: -20%; border-radius: 50%;
    background: radial-gradient(circle, rgba(45, 212, 160, 0.06) 0%, transparent 70%);
    animation: mother-breathe 6s ease-in-out infinite;
  }
  .slide--mother .slide__atmosphere::after {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 30% 40% at 25% 70%, rgba(45, 212, 160, 0.04) 0%, transparent 100%), radial-gradient(ellipse 25% 35% at 75% 35%, rgba(22, 122, 92, 0.03) 0%, transparent 100%);
    animation: mother-breathe 6s ease-in-out infinite 3s;
  }
  @keyframes mother-breathe { 0%, 100% { transform: scale(0.9); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 1; } }

  /* ENTROPY — dissolving grain overlay */
  .slide--entropy .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background-image: radial-gradient(circle 1px at 20% 30%, rgba(212, 146, 10, 0.15) 0%, transparent 100%), radial-gradient(circle 1px at 60% 70%, rgba(212, 146, 10, 0.1) 0%, transparent 100%), radial-gradient(circle 1px at 80% 20%, rgba(212, 146, 10, 0.12) 0%, transparent 100%), radial-gradient(circle 1px at 40% 80%, rgba(212, 146, 10, 0.08) 0%, transparent 100%);
    animation: entropy-dissolve 15s ease-in-out infinite alternate;
  }
  @keyframes entropy-dissolve { 0% { opacity: 0.8; filter: blur(0px); } 50% { opacity: 0.4; filter: blur(1px); } 100% { opacity: 0.9; filter: blur(0.5px); } }

  /* PROMETHEUS — rising embers overlay */
  .slide--prometheus .slide__atmosphere::before {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40%;
    background: radial-gradient(ellipse 100% 80% at 50% 100%, rgba(232, 93, 38, 0.08) 0%, transparent 100%);
    animation: prometheus-forge 4s ease-in-out infinite;
  }
  .slide--prometheus .slide__atmosphere::after {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle 2px at 30% 60%, rgba(232, 93, 38, 0.2) 0%, transparent 100%), radial-gradient(circle 2px at 55% 70%, rgba(255, 120, 50, 0.15) 0%, transparent 100%), radial-gradient(circle 1px at 70% 55%, rgba(232, 93, 38, 0.18) 0%, transparent 100%);
    animation: prometheus-embers 10s ease-in-out infinite;
  }
  @keyframes prometheus-forge { 0%, 100% { opacity: 0.5; transform: scaleY(0.95); } 50% { opacity: 1; transform: scaleY(1.05); } }
  @keyframes prometheus-embers { 0% { transform: translateY(0); opacity: 0.7; } 50% { transform: translateY(-8%); opacity: 1; } 100% { transform: translateY(-2%); opacity: 0.6; } }

  /* DELUGE — rain + wave overlay */
  .slide--deluge .slide__atmosphere::before {
    content: ''; position: absolute; inset: -50% 0 0 0;
    background: repeating-linear-gradient(165deg, transparent 0px, transparent 8px, rgba(26, 181, 200, 0.02) 8px, rgba(26, 181, 200, 0.02) 9px);
    animation: deluge-rain 2.5s linear infinite;
  }
  .slide--deluge .slide__atmosphere::after {
    content: ''; position: absolute; bottom: -5%; left: -10%; right: -10%; height: 20%;
    background: radial-gradient(ellipse 120% 100% at 50% 100%, rgba(26, 181, 200, 0.08) 0%, transparent 100%);
    animation: deluge-wave 8s ease-in-out infinite; border-radius: 50% 50% 0 0;
  }
  @keyframes deluge-rain { 0% { transform: translateY(-33%) translateX(5%); } 100% { transform: translateY(0%) translateX(-2%); } }
  @keyframes deluge-wave { 0%, 100% { transform: translateY(0) scaleY(1); } 25% { transform: translateY(-15%) scaleY(1.1); } 50% { transform: translateY(-5%) scaleY(0.95); } 75% { transform: translateY(-10%) scaleY(1.05); } }

  /* AWAKENING — consciousness ripples overlay */
  .slide--awakening .slide__atmosphere::before {
    content: ''; position: absolute; top: 50%; left: 50%; width: 600px; height: 600px;
    margin: -300px 0 0 -300px; border-radius: 50%;
    border: 1px solid rgba(180, 138, 239, 0.06);
    box-shadow: 0 0 0 80px rgba(180, 138, 239, 0.02), 0 0 0 160px rgba(180, 138, 239, 0.015), 0 0 0 240px rgba(180, 138, 239, 0.01), 0 0 0 320px rgba(180, 138, 239, 0.005);
    animation: awakening-ripple 12s ease-in-out infinite;
  }
  .slide--awakening .slide__atmosphere::after {
    content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 30%;
    background: linear-gradient(180deg, rgba(180, 138, 239, 0.03) 0%, rgba(122, 82, 196, 0.02) 40%, transparent 100%);
    animation: awakening-aurora 10s ease-in-out infinite alternate;
  }
  @keyframes awakening-ripple { 0% { transform: scale(0.8); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.8); opacity: 0.4; } }
  @keyframes awakening-aurora { 0% { transform: translateX(-5%) skewX(-2deg); opacity: 0.5; } 100% { transform: translateX(5%) skewX(2deg); opacity: 1; } }

  /* OVERTHROW — mirror shimmer + reflected authority overlay */
  .slide--overthrow .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background:
      repeating-linear-gradient(90deg, transparent 0px, transparent 100px, rgba(212, 54, 75, 0.025) 100px, rgba(212, 54, 75, 0.025) 101px),
      repeating-linear-gradient(90deg, transparent 0px, transparent 160px, rgba(212, 54, 75, 0.018) 160px, rgba(212, 54, 75, 0.018) 161px);
    animation: overthrow-shimmer 16s ease-in-out infinite alternate;
  }
  .slide--overthrow .slide__atmosphere::after {
    content: ''; position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 35% 55% at 25% 45%, rgba(212, 54, 75, 0.04) 0%, transparent 100%),
      radial-gradient(ellipse 35% 55% at 75% 55%, rgba(212, 54, 75, 0.03) 0%, transparent 100%);
    animation: overthrow-reflect 12s ease-in-out infinite;
  }
  @keyframes overthrow-shimmer { 0% { opacity: 0.4; transform: scaleX(1); } 50% { opacity: 0.9; transform: scaleX(1.03); } 100% { opacity: 0.5; transform: scaleX(0.97); } }
  @keyframes overthrow-reflect { 0% { transform: translateX(-3%); opacity: 0.5; } 50% { transform: translateX(3%); opacity: 1; } 100% { transform: translateX(-3%); opacity: 0.5; } }
`;

// ── Quote Transition Effects ────────────────────────────────────────────────

export const showcaseTransitionStyles = css`
  /* ── Per-archetype CTA character ────────────────────────────────────────
     All transitions, no animation:infinite. Each archetype sets:
     1. --_sweep-origin: direction the accent background fills from
     2. Unique hover trait via transition (not animation)
     3. One-shot entrance glitch where thematically appropriate
     ──────────────────────────────────────────────────────────────────── */

  /* I · SHADOW — sweep from left + one-shot glitch on enter */
  .slide--shadow .slide__cta { --_sweep-origin: left; }
  .slide--shadow .slide__cta:hover {
    text-shadow: 0 0 6px var(--_accent);
    animation: cta-glitch-burst 0.15s steps(2) 1;
  }
  @keyframes cta-glitch-burst {
    0%   { transform: translate(0, -2px); }
    25%  { transform: translate(-2px, 0); }
    50%  { transform: translate(1px, 1px); }
    75%  { transform: translate(-1px, -1px); }
    100% { transform: translateY(-2px); }
  }

  /* II · TOWER — sweep from center + underline draw */
  .slide--tower .slide__cta {
    --_sweep-origin: center;
    background-image: linear-gradient(var(--color-surface, #0a0a0a), var(--color-surface, #0a0a0a));
    background-size: 0% 1px;
    background-position: center bottom 8px;
    background-repeat: no-repeat;
  }
  .slide--tower .slide__cta:hover {
    background-size: 70% 1px;
  }

  /* III · MOTHER — sweep from bottom (scaleY) + gentle lift */
  .slide--mother .slide__cta { --_sweep-origin: bottom; }
  .slide--mother .slide__cta::before {
    transform: scaleY(0);
    transform-origin: bottom;
  }
  .slide--mother .slide__cta:hover::before { transform: scaleY(1); }
  .slide--mother .slide__cta:hover {
    transform: translateY(-3px);
  }

  /* IV · ENTROPY — sweep from right (reverse) + letter-spacing drift */
  .slide--entropy .slide__cta { --_sweep-origin: right; }
  .slide--entropy .slide__cta:hover {
    letter-spacing: 0.4em;
    border-style: dashed;
  }

  /* V · PROMETHEUS — sweep from left + intensified inner glow */
  .slide--prometheus .slide__cta { --_sweep-origin: left; }
  .slide--prometheus .slide__cta:hover {
    box-shadow:
      0 0 20px color-mix(in srgb, var(--_accent) 30%, transparent),
      inset 0 0 12px color-mix(in srgb, var(--_accent) 15%, transparent);
  }

  /* VI · DELUGE — sweep from bottom (scaleY) + subtle wave translateY */
  .slide--deluge .slide__cta { --_sweep-origin: bottom; }
  .slide--deluge .slide__cta::before {
    transform: scaleY(0);
    transform-origin: bottom;
  }
  .slide--deluge .slide__cta:hover::before { transform: scaleY(1); }
  .slide--deluge .slide__cta:hover {
    transform: translateY(-2px);
  }

  /* VII · AWAKENING — sweep from center + radial expand feel */
  .slide--awakening .slide__cta { --_sweep-origin: center; }
  .slide--awakening .slide__cta:hover {
    letter-spacing: 0.3em;
  }

  /* VIII · OVERTHROW — diagonal sweep + one-shot glitch on enter */
  .slide--overthrow .slide__cta { --_sweep-origin: left; }
  .slide--overthrow .slide__cta::before {
    transform: scaleX(0) skewX(-12deg);
    transform-origin: left;
  }
  .slide--overthrow .slide__cta:hover::before {
    transform: scaleX(1) skewX(-12deg);
  }
  .slide--overthrow .slide__cta:hover {
    animation: cta-glitch-burst 0.12s steps(3) 1;
  }

  /* ── Per-archetype quote transitions ──────────────────────────────────── */

  /* SHADOW: interference glitch */
  .slide--shadow .quote-block.entering { animation: q-glitch-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--shadow .quote-block.visible  { opacity: 0.85; transform: none; }
  .slide--shadow .quote-block.leaving  { animation: q-glitch-out 0.7s ease-in forwards; }
  @keyframes q-glitch-in {
    0%   { opacity: 0; transform: translateX(-4px); filter: blur(2px); }
    15%  { opacity: 0.6; transform: translateX(3px); filter: blur(0px); }
    30%  { opacity: 0.2; transform: translateX(-2px); filter: blur(1px); }
    50%  { opacity: 0.7; transform: translateX(1px); }
    70%  { opacity: 0.4; transform: translateX(-1px); }
    100% { opacity: 0.85; transform: none; filter: blur(0px); }
  }
  @keyframes q-glitch-out {
    0%   { opacity: 0.85; transform: none; }
    20%  { opacity: 0.5; transform: translateX(3px); }
    40%  { opacity: 0.7; transform: translateX(-2px); filter: blur(1px); }
    70%  { opacity: 0.2; transform: translateX(4px); filter: blur(2px); }
    100% { opacity: 0; transform: translateX(-3px); filter: blur(4px); }
  }

  /* TOWER: systematic cascade */
  .slide--tower .quote-block.entering { animation: q-fall-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--tower .quote-block.visible  { opacity: 0.85; transform: none; }
  .slide--tower .quote-block.leaving  { animation: q-fall-out 0.6s ease-in forwards; }
  @keyframes q-fall-in { 0% { opacity: 0; transform: translateY(-24px); } 60% { opacity: 0.6; transform: translateY(3px); } 100% { opacity: 0.85; transform: none; } }
  @keyframes q-fall-out { 0% { opacity: 0.85; transform: none; } 100% { opacity: 0; transform: translateY(24px); } }

  /* MOTHER: organic breathing */
  .slide--mother .quote-block.entering { animation: q-breathe-in 1s ease-out forwards; }
  .slide--mother .quote-block.visible  { opacity: 0.85; transform: scale(1); }
  .slide--mother .quote-block.leaving  { animation: q-breathe-out 0.9s ease-in forwards; }
  @keyframes q-breathe-in { 0% { opacity: 0; transform: scale(0.94); } 40% { opacity: 0.5; transform: scale(1.02); } 70% { opacity: 0.7; transform: scale(0.99); } 100% { opacity: 0.85; transform: scale(1); } }
  @keyframes q-breathe-out { 0% { opacity: 0.85; transform: scale(1); } 40% { opacity: 0.4; transform: scale(1.03); } 100% { opacity: 0; transform: scale(0.92); } }

  /* ENTROPY: dissolving decay */
  .slide--entropy .quote-block.entering { animation: q-dissolve-in 0.9s ease-out forwards; }
  .slide--entropy .quote-block.visible  { opacity: 0.8; transform: none; filter: blur(0px); }
  .slide--entropy .quote-block.leaving  { animation: q-dissolve-out 1s ease-in forwards; }
  @keyframes q-dissolve-in { 0% { opacity: 0; filter: blur(6px); transform: scale(1.02); } 50% { opacity: 0.4; filter: blur(2px); } 100% { opacity: 0.8; filter: blur(0px); transform: scale(1); } }
  @keyframes q-dissolve-out { 0% { opacity: 0.8; filter: blur(0px); letter-spacing: 0.02em; } 40% { opacity: 0.4; filter: blur(1px); letter-spacing: 0.06em; } 70% { opacity: 0.15; filter: blur(3px); letter-spacing: 0.12em; } 100% { opacity: 0; filter: blur(8px); letter-spacing: 0.2em; } }

  /* PROMETHEUS: igniting glow */
  .slide--prometheus .quote-block.entering { animation: q-ignite-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--prometheus .quote-block.visible  { opacity: 0.85; transform: none; }
  .slide--prometheus .quote-block.leaving  { animation: q-ignite-out 0.7s ease-in forwards; }
  @keyframes q-ignite-in { 0% { opacity: 0; transform: translateY(6px); filter: brightness(0.5); } 30% { opacity: 0.4; filter: brightness(1.6); } 60% { opacity: 0.7; filter: brightness(1.2); } 100% { opacity: 0.85; transform: none; filter: brightness(1); } }
  @keyframes q-ignite-out { 0% { opacity: 0.85; filter: brightness(1); } 30% { opacity: 0.6; filter: brightness(1.4); } 60% { opacity: 0.3; filter: brightness(0.8); } 100% { opacity: 0; filter: brightness(0.3); transform: translateY(-4px); } }

  /* DELUGE: horizontal water wash */
  .slide--deluge .quote-block.entering { animation: q-wash-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--deluge .quote-block.visible  { opacity: 0.85; transform: none; }
  .slide--deluge .quote-block.leaving  { animation: q-wash-out 0.7s ease-in forwards; }
  @keyframes q-wash-in { 0% { opacity: 0; transform: translateX(-30px); } 50% { opacity: 0.5; transform: translateX(4px); } 100% { opacity: 0.85; transform: none; } }
  @keyframes q-wash-out { 0% { opacity: 0.85; transform: none; } 100% { opacity: 0; transform: translateX(30px); } }

  /* AWAKENING: focus-pull materialization */
  .slide--awakening .quote-block.entering { animation: q-materialize-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--awakening .quote-block.visible  { opacity: 0.85; transform: none; filter: blur(0px); }
  .slide--awakening .quote-block.leaving  { animation: q-materialize-out 0.9s ease-in forwards; }
  @keyframes q-materialize-in { 0% { opacity: 0; filter: blur(14px); transform: scale(1.06); } 30% { opacity: 0.3; filter: blur(6px); } 60% { opacity: 0.6; filter: blur(2px); transform: scale(1.01); } 100% { opacity: 0.85; filter: blur(0px); transform: scale(1); } }
  @keyframes q-materialize-out { 0% { opacity: 0.85; filter: blur(0px); transform: scale(1); } 40% { opacity: 0.5; filter: blur(3px); transform: scale(1.02); } 100% { opacity: 0; filter: blur(14px); transform: scale(1.06); } }

  /* OVERTHROW: political decree — skew + brightness flash (political vertigo) */
  .slide--overthrow .quote-block.entering { animation: q-decree-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .slide--overthrow .quote-block.visible  { opacity: 0.85; transform: none; }
  .slide--overthrow .quote-block.leaving  { animation: q-decree-out 0.7s ease-in forwards; }
  @keyframes q-decree-in {
    0%   { opacity: 0; transform: scaleY(0.92) skewX(-1deg); filter: brightness(0.6); }
    25%  { opacity: 0.5; transform: scaleY(1.01) skewX(0.5deg); filter: brightness(1.3); }
    55%  { opacity: 0.7; transform: scaleY(0.995) skewX(-0.2deg); filter: brightness(1.08); }
    100% { opacity: 0.85; transform: none; filter: brightness(1); }
  }
  @keyframes q-decree-out {
    0%   { opacity: 0.85; transform: none; filter: brightness(1); }
    35%  { opacity: 0.5; transform: skewX(1deg); filter: brightness(1.2); }
    100% { opacity: 0; transform: scaleY(0.9) skewX(-2deg); filter: brightness(0.4); }
  }
`;
