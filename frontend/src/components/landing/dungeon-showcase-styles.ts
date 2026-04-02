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

  .slide__numeral {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.7rem, 1vw, 0.85rem);
    font-weight: 400; letter-spacing: 0.3em;
    text-transform: uppercase; opacity: 0.5; margin-bottom: 16px;
    color: var(--_accent);
  }

  .slide__title {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: clamp(2.2rem, 5.5vw, 4.2rem);
    font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; line-height: 1.05; margin: 0 0 6px;
    color: var(--_accent);
  }
  .active .slide__title { animation: title-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }

  .slide__subtitle {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(1rem, 2vw, 1.4rem);
    font-style: italic; font-weight: 400;
    letter-spacing: 0.08em; opacity: 0.7; margin: 0 0 24px;
    color: var(--_accent);
  }
  .active .slide__subtitle { animation: subtitle-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }

  .slide__divider {
    width: 60px; height: 1px; margin: 0 0 24px; opacity: 0.4;
    background: var(--_accent);
  }
  .active .slide__divider { animation: divider-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both; }

  .slide__tagline {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.85rem, 1.3vw, 1rem);
    font-weight: 400; letter-spacing: 0.04em; line-height: 1.6;
    opacity: 0.5; margin: 0 0 40px; max-width: 540px;
    color: var(--_accent);
  }
  .active .slide__tagline { animation: tagline-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }

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
    font-style: italic; font-weight: 400;
    line-height: 1.75; letter-spacing: 0.02em;
    color: var(--_accent);
    transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
                filter 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .quote-block__text::before { content: '\u201c'; }
  .quote-block__text::after { content: '\u201d'; }

  /* Original-language layer — overlaid on translation */
  .quote-block__original {
    font-family: var(--font-bureau, 'Spectral', Georgia, serif);
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    font-style: italic; font-weight: 400;
    line-height: 1.75; letter-spacing: 0.02em;
    color: var(--_accent);
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
    opacity: 0.4;
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
    text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5;
    color: var(--_accent);
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
    .active .slide__title, .active .slide__subtitle, .active .slide__divider, .active .slide__tagline { animation: none !important; opacity: 1; }
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
    .quote-block { min-height: 160px; }
  }
  @media (min-width: 2000px) {
    .slide__content { max-width: 960px; }
    .slide__title { font-size: 5rem; }
  }
`;

// ── Atmospheric Backgrounds ─────────────────────────────────────────────────

export const showcaseAtmosphereStyles = css`
  /* SHADOW — drifting cosmic fog */
  .slide--shadow .slide__atmosphere {
    background: radial-gradient(ellipse 120% 100% at 20% 80%, rgba(124, 92, 231, 0.12) 0%, transparent 60%), radial-gradient(ellipse 100% 120% at 80% 20%, rgba(74, 45, 138, 0.08) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(8, 4, 26, 1) 0%, rgba(4, 2, 12, 1) 100%);
  }
  .slide--shadow .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 40% 50% at 30% 60%, rgba(124, 92, 231, 0.06) 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 70% 30%, rgba(100, 60, 200, 0.04) 0%, transparent 100%);
    animation: shadow-drift 20s ease-in-out infinite alternate;
  }
  @keyframes shadow-drift { 0% { transform: translate(0, 0) scale(1); opacity: 0.6; } 50% { transform: translate(-3%, 2%) scale(1.08); opacity: 1; } 100% { transform: translate(2%, -1%) scale(0.95); opacity: 0.5; } }

  /* TOWER — cascading data streams */
  .slide--tower .slide__atmosphere {
    background: radial-gradient(ellipse 100% 80% at 50% 0%, rgba(74, 138, 181, 0.08) 0%, transparent 70%), linear-gradient(180deg, rgba(6, 13, 24, 1) 0%, rgba(10, 18, 30, 0.98) 100%);
  }
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

  /* MOTHER — bioluminescent breath */
  .slide--mother .slide__atmosphere {
    background: radial-gradient(ellipse 60% 60% at 50% 55%, rgba(45, 212, 160, 0.07) 0%, transparent 100%), radial-gradient(circle at 50% 50%, rgba(2, 18, 16, 1) 0%, rgba(1, 8, 6, 1) 100%);
  }
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

  /* ENTROPY — dissolving grain */
  .slide--entropy .slide__atmosphere {
    background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(212, 146, 10, 0.06) 0%, transparent 80%), linear-gradient(180deg, rgba(20, 12, 2, 1) 0%, rgba(12, 8, 2, 1) 100%);
  }
  .slide--entropy .slide__atmosphere::before {
    content: ''; position: absolute; inset: 0;
    background-image: radial-gradient(circle 1px at 20% 30%, rgba(212, 146, 10, 0.15) 0%, transparent 100%), radial-gradient(circle 1px at 60% 70%, rgba(212, 146, 10, 0.1) 0%, transparent 100%), radial-gradient(circle 1px at 80% 20%, rgba(212, 146, 10, 0.12) 0%, transparent 100%), radial-gradient(circle 1px at 40% 80%, rgba(212, 146, 10, 0.08) 0%, transparent 100%);
    animation: entropy-dissolve 15s ease-in-out infinite alternate;
  }
  @keyframes entropy-dissolve { 0% { opacity: 0.8; filter: blur(0px); } 50% { opacity: 0.4; filter: blur(1px); } 100% { opacity: 0.9; filter: blur(0.5px); } }

  /* PROMETHEUS — rising embers */
  .slide--prometheus .slide__atmosphere {
    background: radial-gradient(ellipse 100% 60% at 50% 100%, rgba(232, 93, 38, 0.1) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 50% 90%, rgba(160, 58, 16, 0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(10, 4, 2, 1) 0%, rgba(20, 8, 2, 1) 100%);
  }
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

  /* DELUGE — rain + wave */
  .slide--deluge .slide__atmosphere {
    background: radial-gradient(ellipse 100% 60% at 50% 100%, rgba(26, 181, 200, 0.06) 0%, transparent 60%), linear-gradient(180deg, rgba(2, 14, 20, 1) 0%, rgba(4, 20, 28, 1) 100%);
  }
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

  /* AWAKENING — consciousness ripples */
  .slide--awakening .slide__atmosphere {
    background: radial-gradient(circle at 50% 50%, rgba(180, 138, 239, 0.05) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(12, 8, 24, 1) 0%, rgba(6, 4, 14, 1) 100%);
  }
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
`;

// ── Quote Transition Effects ────────────────────────────────────────────────

export const showcaseTransitionStyles = css`
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
`;
