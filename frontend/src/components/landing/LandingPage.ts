/**
 * Landing Page — Full-screen immersive introduction for all visitors.
 *
 * Aesthetic: Military surveillance terminal / interdimensional observation post.
 * Each section is a "panel" on a massive command console monitoring the multiverse.
 *
 * Sections:
 *   1. Hero — METAVERSE.CENTER headline with ambient visualization
 *   2. Feature Grid — 3-column capabilities overview
 *   3. Live Data — Real-time platform statistics with animated counters
 *   4. How It Works — 3-step visual process flow
 *   5. CTA Footer — Terminal-framed call to action
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { seoService } from '../../services/SeoService.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/PlatformFooter.js';
import './DungeonShowcase.js';
import './LandingAgentShowcase.js';

interface PlatformStats {
  simulation_count: number;
  active_epoch_count: number;
  resonance_count: number;
}

@localized()
@customElement('velg-landing-page')
export class VelgLandingPage extends LitElement {
  static styles = css`
    /* ── Reset & Host ─────────────────────────── */

    :host {
      /* Landing-page-only tokens (no platform equivalent) */
      --green-dim: var(--color-success-glow);
      --surface-card: var(--color-surface-sunken);
      --border-dim: var(--color-border-light);
      --ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1);
      --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

      display: block;
      background: var(--color-surface);
      color: var(--color-text-primary);
      overflow-x: hidden;
    }

    *, *::before, *::after { box-sizing: border-box; }

    /* ── Skip Link ────────────────────────────── */

    .skip-link {
      position: absolute;
      top: -100%;
      left: 16px;
      z-index: var(--z-sticky);
      padding: 8px 16px;
      background: var(--color-accent-amber);
      color: var(--color-surface);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-decoration: none;
      transition: top 0.2s;
    }

    .skip-link:focus {
      top: 16px;
    }

    /* ── Keyframes ─────────────────────────────── */

    @keyframes hero-title-enter {
      from {
        opacity: 0;
        transform: translateX(-12px);
        letter-spacing: 0.3em;
      }
      to {
        opacity: 1;
        transform: translateX(0);
        letter-spacing: 0.15em;
      }
    }

    @keyframes content-fade {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes card-enter {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes badge-pop {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes line-expand {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }

    @keyframes btn-materialize {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes hero-drift {
      0%   { background-position: 20% 30%, 80% 70%, 50% 50%; }
      50%  { background-position: 60% 60%, 30% 40%, 70% 30%; }
      100% { background-position: 40% 80%, 70% 20%, 30% 70%; }
    }

    @keyframes scanline-scroll {
      0%   { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }

    @keyframes grid-pulse {
      0%, 100% { opacity: 0.015; }
      50%      { opacity: 0.04; }
    }

    @keyframes coord-drift {
      0%, 100% { opacity: 0.3; }
      50%      { opacity: 0.6; }
    }

    @keyframes stat-glow {
      0%, 100% { text-shadow: 0 0 8px var(--green-dim); }
      50%      { text-shadow: 0 0 20px var(--green-dim), 0 0 40px color-mix(in srgb, var(--color-success) 8%, transparent); }
    }

    @keyframes signal-ping {
      0%   { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    /* ── Scroll Reveal ────────────────────────── */

    .scroll-reveal {
      opacity: 0;
      transform: translateY(20px);
    }

    .scroll-reveal.in-view {
      animation: card-enter 500ms var(--ease-dramatic) forwards;
    }

    /* ── Shared Layout ────────────────────────── */

    .landing-section {
      position: relative;
      width: 100%;
    }

    .landing-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 clamp(20px, 5vw, 48px);
    }

    .section-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: var(--color-accent-amber);
      margin-bottom: 32px;
    }

    .section-label::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--color-accent-amber);
    }

    /* ═══════════════════════════════════════════
       SECTION 1 — HERO
       ═══════════════════════════════════════════ */

    .hero {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Hero background image */
    .hero__bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      filter: brightness(0.45) saturate(0.85);
      animation: hero-bg-drift 30s ease-in-out infinite alternate;
      z-index: 0;
    }

    @keyframes hero-bg-drift {
      0% { transform: scale(1); }
      100% { transform: scale(1.06); }
    }

    /* Ambient visualization overlay on top of image */
    .hero__viz {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 25% 35%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 70%),
        radial-gradient(ellipse 500px 500px at 75% 65%, color-mix(in srgb, var(--color-success) 5%, transparent) 0%, transparent 70%);
      pointer-events: none;
      z-index: 1;
    }

    /* Scanline overlay */
    .hero__scanlines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-primary) 1%, transparent) 3px,
        color-mix(in srgb, var(--color-primary) 1%, transparent) 6px
      );
      z-index: 1;
    }

    /* Moving scanline bar */
    .hero__scanbeam {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 120px;
      background: linear-gradient(
        180deg,
        transparent 0%,
        color-mix(in srgb, var(--color-primary) 3%, transparent) 40%,
        color-mix(in srgb, var(--color-primary) 6%, transparent) 50%,
        color-mix(in srgb, var(--color-primary) 3%, transparent) 60%,
        transparent 100%
      );
      animation: scanline-scroll 8s linear infinite;
      pointer-events: none;
      z-index: 2;
    }

    /* Grid pattern */
    .hero__grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(color-mix(in srgb, var(--color-primary) 3%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 3%, transparent) 1px, transparent 1px);
      background-size: 60px 60px;
      animation: grid-pulse 6s ease-in-out infinite;
      pointer-events: none;
    }

    /* Corner brackets */
    .hero__bracket {
      position: absolute;
      width: 40px;
      height: 40px;
      border-color: var(--color-accent-amber);
      border-style: solid;
      opacity: 0.4;
      z-index: 3;
    }
    .hero__bracket--tl { top: 24px; left: 24px; border-width: 2px 0 0 2px; }
    .hero__bracket--tr { top: 24px; right: 24px; border-width: 2px 2px 0 0; }
    .hero__bracket--bl { bottom: 12px; left: 24px; border-width: 0 0 2px 2px; }
    .hero__bracket--br { bottom: 12px; right: 24px; border-width: 0 2px 2px 0; }

    /* Corner coordinates */
    .hero__coord {
      position: absolute;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
      animation: coord-drift 4s ease-in-out infinite;
      z-index: 3;
    }
    .hero__coord--tl { top: 70px; left: 28px; }
    .hero__coord--tr { top: 70px; right: 28px; text-align: right; }
    .hero__coord--bl { bottom: 50px; left: 28px; }

    .hero__content {
      position: relative;
      z-index: 4;
      text-align: center;
      padding: 0 24px;
      max-width: 900px;
    }

    .hero__classification {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 24px;
      opacity: 0;
      animation: content-fade 400ms var(--ease-dramatic) both 100ms;
    }

    .hero__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(2rem, 6vw, 4.5rem);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1.05;
      animation: hero-title-enter 800ms var(--ease-dramatic) both 200ms;
    }

    .hero__title-accent {
      color: var(--color-accent-amber);
    }

    .hero__subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.5vw, 0.95rem);
      color: var(--color-text-secondary);
      margin: 20px 0 0;
      letter-spacing: 1px;
      line-height: 1.6;
      opacity: 0;
      animation: content-fade 400ms var(--ease-dramatic) both 500ms;
    }

    .hero__cta-area {
      margin-top: 48px;
      opacity: 0;
      animation: btn-materialize 500ms var(--ease-dramatic) both 800ms;
    }

    .hero__cta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 16px 36px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--color-surface);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber-dim);
      cursor: pointer;
      text-decoration: none;
      transition: all 200ms;
      position: relative;
      overflow: hidden;
    }

    .hero__cta:hover {
      background: var(--color-accent-amber-hover);
      box-shadow: 0 0 30px var(--color-accent-amber-glow), 0 0 60px color-mix(in srgb, var(--color-primary) 8%, transparent);
      transform: translateY(-2px);
    }

    .hero__cta:active {
      transform: translateY(0);
    }

    .hero__cta::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-surface-inverse) 15%, transparent), transparent);
      transform: translateX(-100%);
      animation: hero-cta-shimmer 4s ease-in-out infinite 2s;
    }

    @keyframes hero-cta-shimmer {
      0%, 60% { transform: translateX(-100%); }
      100%    { transform: translateX(100%); }
    }

    .hero__cta-arrow {
      font-size: 16px;
      transition: transform 200ms;
    }

    .hero__cta:hover .hero__cta-arrow {
      transform: translateX(4px);
    }

    .hero__cta--secondary {
      background: transparent;
      color: var(--color-text-primary);
      border: 1px solid color-mix(in srgb, var(--color-surface-inverse) 20%, transparent);
      margin-left: 16px;
    }

    .hero__cta--secondary:hover {
      background: color-mix(in srgb, var(--color-surface-inverse) 5%, transparent);
      color: var(--color-text-primary);
      border-color: color-mix(in srgb, var(--color-surface-inverse) 40%, transparent);
      box-shadow: none;
    }

    .hero__cta--secondary::after {
      display: none;
    }

    .hero__scroll-hint {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 6;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      opacity: 0;
      animation: content-fade 400ms var(--ease-dramatic) both 1.2s;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    .hero__scroll-hint:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 4px;
    }

    .hero__scroll-text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .hero__scroll-line {
      width: 1px;
      height: 32px;
      background: linear-gradient(180deg, var(--color-accent-amber), transparent);
      animation: scroll-pulse 2s ease-in-out infinite;
    }

    @keyframes scroll-pulse {
      0%, 100% { opacity: 0.3; height: 32px; }
      50%      { opacity: 0.8; height: 48px; }
    }

    /* ── Hero Signal Intercept variant ────────── */
    .hero--variant {
      opacity: 1;
    }

    .hero--variant .hero__content {
      opacity: 1;
    }

    /* Override default entrance animations for variants — they control their own */
    .hero--variant .hero__classification,
    .hero--variant .hero__subtitle,
    .hero--variant .hero__cta-area {
      opacity: 0;
    }

    .hero--variant .hero__title {
      opacity: 0;
      animation: none;
    }

    .hero--variant.in-view .hero__classification {
      animation: content-fade 400ms var(--ease-dramatic) both 100ms;
    }

    .hero--variant.in-view .hero__subtitle {
      animation: content-fade 400ms var(--ease-dramatic) both 500ms;
    }

    .hero--variant.in-view .hero__cta-area {
      animation: btn-materialize 500ms var(--ease-dramatic) both 800ms;
    }

    .hero--variant.in-view .hero__title {
      animation: hero-title-enter 800ms var(--ease-dramatic) both 200ms;
    }

    /* ── V03: SIGNAL INTERCEPT ─────────────────── */

    .hero--v03 .hero__title {
      font-variant-numeric: tabular-nums;
      animation: none !important;
      opacity: 1;
    }

    .hero--v03.in-view .hero__title {
      animation: none !important;
      opacity: 1;
    }

    .hero--v03 .decode-progress {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5;
      width: min(400px, 80vw);
    }

    .hero--v03 .decode-progress__label {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }

    .hero--v03 .decode-progress__bar {
      height: 2px;
      background: var(--color-primary-glow);
      position: relative;
      overflow: hidden;
    }

    .hero--v03 .decode-progress__fill {
      height: 100%;
      background: var(--color-accent-amber);
      width: 0%;
      transition: width 50ms linear;
      box-shadow: 0 0 8px var(--color-accent-amber);
    }

    .hero--v03 .hero__title-underline {
      display: block;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--color-accent-amber), transparent);
      opacity: 0;
      margin-top: 8px;
      transition: opacity 300ms;
    }

    .hero--v03 .decode-complete .hero__title-underline {
      opacity: 0.3;
    }

    .hero--v03 .waveform {
      display: flex;
      gap: 2px;
      justify-content: center;
      margin-top: 12px;
      height: 16px;
      align-items: flex-end;
      opacity: 0.3;
    }

    .hero--v03 .waveform__bar {
      width: 2px;
      background: var(--color-accent-amber);
      animation: waveform-bar 1.5s ease-in-out infinite;
    }

    @keyframes waveform-bar {
      0%, 100% { height: 4px; }
      50%      { height: 16px; }
    }

    /* ═══════════════════════════════════════════
       SECTION 2 — FEATURE GRID
       ═══════════════════════════════════════════ */

    .features {
      padding: 120px 0 80px;
      border-top: 1px solid var(--border-dim);
    }

    .features__grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2px;
      background: var(--color-border-light);
    }

    .feature-card {
      background: var(--surface-card);
      position: relative;
      overflow: hidden;
      transition: transform 0.4s var(--ease-dramatic);
    }

    .feature-card.in-view {
      animation: card-enter 350ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 120ms);
    }

    .feature-card:hover {
      transform: translateY(-2px);
    }

    /* Image section */
    .feature-card__img-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      overflow: hidden;
    }

    .feature-card__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.75) saturate(0.9);
      transition: filter 0.5s, transform 0.5s var(--ease-dramatic);
    }

    .feature-card:hover .feature-card__img {
      filter: brightness(0.88) saturate(1);
      transform: scale(1.04);
    }

    /* Gradient overlay on image */
    .feature-card__img-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        transparent 0%,
        transparent 40%,
        color-mix(in srgb, var(--color-surface) 70%, transparent) 70%,
        color-mix(in srgb, var(--color-surface) 95%, transparent) 100%
      );
      pointer-events: none;
    }

    /* Amber accent line */
    .feature-card__accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-accent-amber);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.4s var(--ease-dramatic);
      z-index: 2;
    }

    .feature-card:hover .feature-card__accent {
      transform: scaleX(1);
    }

    /* Classification tag on image */
    .feature-card__tag {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 2;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 8px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      background: color-mix(in srgb, var(--color-surface) 70%, transparent);
      padding: 3px 8px;
      border: 1px solid var(--color-primary-glow);
    }

    /* Text section */
    .feature-card__body {
      padding: 24px 28px 28px;
    }

    .feature-card__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--color-text-primary);
      margin: 0 0 12px;
    }

    .feature-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.7;
      color: var(--color-text-secondary);
      margin: 0;
    }

    .feature-card__ref {
      margin-top: 16px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 1px;
      color: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      .features__grid {
        grid-template-columns: 1fr;
      }
    }

    /* ═══════════════════════════════════════════
       SECTION 3 — LIVE DATA
       ═══════════════════════════════════════════ */

    .live-data {
      padding: 80px 0;
      border-top: 1px solid var(--border-dim);
      position: relative;
    }

    .live-data__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      background: var(--color-border-light);
    }

    .stat-cell {
      background: var(--surface-card);
      padding: 40px 32px;
      text-align: center;
      position: relative;
    }

    .stat-cell.in-view {
      animation: card-enter 400ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 200ms);
    }

    .stat-cell__signal {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 6px;
      height: 6px;
      background: var(--color-accent-green);
      border-radius: 50%;
    }

    .stat-cell__signal::after {
      content: '';
      position: absolute;
      inset: -3px;
      border: 1px solid var(--color-accent-green);
      border-radius: 50%;
      animation: signal-ping 2s ease-out infinite;
      animation-delay: calc(var(--i, 0) * 300ms);
    }

    .stat-cell__label {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: var(--color-text-muted);
      margin: 0 0 16px;
    }

    .stat-cell__value {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(2.5rem, 5vw, 4rem);
      color: var(--color-accent-green);
      margin: 0;
      line-height: 1;
      animation: stat-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * 500ms);
    }

    .stat-cell__unit {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 8px;
      letter-spacing: 1px;
    }

    @media (max-width: 640px) {
      .live-data__grid {
        grid-template-columns: 1fr;
      }
    }

    /* ═══════════════════════════════════════════
       SECTION 4 — HOW IT WORKS
       ═══════════════════════════════════════════ */

    .how-it-works {
      padding: 120px 0 80px;
      border-top: 1px solid var(--border-dim);
    }

    .steps {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
      align-items: start;
      gap: 0;
    }

    .step {
      text-align: center;
      padding: 0 16px;
    }

    .step.in-view {
      animation: card-enter 400ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 150ms);
    }

    .step__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border: 2px solid var(--color-accent-amber);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 18px;
      color: var(--color-accent-amber);
      margin-bottom: 20px;
      position: relative;
    }

    .step.in-view .step__badge {
      animation: badge-pop 300ms var(--ease-spring) both;
      animation-delay: calc(var(--i, 0) * 150ms + 100ms);
    }

    .step__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-primary);
      margin: 0 0 12px;
    }

    .step__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      line-height: 1.7;
      color: var(--color-text-secondary);
      margin: 0;
    }

    .step-connector {
      display: flex;
      align-items: center;
      padding-top: 24px;
      height: 48px;
    }

    .step-connector__line {
      width: 100%;
      min-width: 40px;
      height: 1px;
      background: var(--color-border-light);
      position: relative;
      transform-origin: left;
    }

    .step-connector.in-view .step-connector__line {
      animation: line-expand 500ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 150ms + 200ms);
    }

    .step-connector__line::after {
      content: '';
      position: absolute;
      right: -4px;
      top: -3px;
      width: 6px;
      height: 6px;
      border-right: 1px solid var(--color-accent-amber);
      border-top: 1px solid var(--color-accent-amber);
      transform: rotate(45deg);
    }

    @media (max-width: 768px) {
      .steps {
        grid-template-columns: 1fr;
        gap: 32px;
      }

      .step-connector {
        display: none;
      }
    }

    /* ═══════════════════════════════════════════
       DUNGEON INTRO (threshold before showcase)
       ═══════════════════════════════════════════ */

    .dungeon-intro {
      padding: 100px 24px 48px;
      text-align: center;
      background: var(--color-surface, #0a0a0a);
      border-top: 1px solid var(--border-dim);
    }

    .dungeon-intro__heading {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.4rem, 3vw, 2.2rem);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-primary);
      margin: 0 0 20px;
    }

    .dungeon-intro__body {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-size: clamp(0.9rem, 1.3vw, 1.05rem);
      font-weight: 500;
      line-height: 1.7;
      letter-spacing: 0.02em;
      color: var(--color-text-secondary);
      max-width: 560px;
      margin: 0 auto;
    }

    /* ═══════════════════════════════════════════
       SECTION 5 — CTA FOOTER
       ═══════════════════════════════════════════ */

    .cta-footer {
      padding: 80px 0 120px;
      border-top: 1px solid var(--border-dim);
    }

    .cta-frame {
      max-width: 640px;
      margin: 0 auto;
      border: 1px dashed var(--color-border-light);
      position: relative;
      padding: 48px 40px;
      text-align: center;
    }

    /* Terminal corner brackets */
    .cta-frame::before,
    .cta-frame::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: var(--color-accent-amber);
      border-style: solid;
    }
    .cta-frame::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
    .cta-frame::after  { top: -1px; right: -1px; border-width: 2px 2px 0 0; }

    .cta-frame__corners {
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 0;
      pointer-events: none;
    }
    .cta-frame__corners::before,
    .cta-frame__corners::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: var(--color-accent-amber);
      border-style: solid;
    }
    .cta-frame__corners::before { bottom: 0; left: -1px; border-width: 0 0 2px 2px; }
    .cta-frame__corners::after  { bottom: 0; right: -1px; border-width: 0 2px 2px 0; }

    .cta-frame__classification {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 20px;
    }

    .cta-frame__heading {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.2rem, 3vw, 1.8rem);
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-primary);
      margin: 0 0 12px;
    }

    .cta-frame__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.7;
      color: var(--color-text-secondary);
      margin: 0 0 32px;
    }

    .cta-frame__btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 32px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--color-surface);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber-dim);
      cursor: pointer;
      text-decoration: none;
      transition: all 200ms;
    }

    .cta-frame__btn:hover {
      background: var(--color-accent-amber-hover);
      box-shadow: 0 0 30px var(--color-accent-amber-glow);
      transform: translateY(-2px);
    }

    .cta-frame__btn:active {
      transform: translateY(0);
    }

    .cta-frame__btn--secondary {
      background: transparent;
      color: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
    }

    .cta-frame__btn--secondary:hover {
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      color: var(--color-accent-amber);
    }

    .cta-frame__actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .cta-frame__ref {
      margin-top: 24px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
    }

    /* ═══════════════════════════════════════════
       WORLDS PREVIEW — Surveillance Monitor Array
       ═══════════════════════════════════════════ */

    .worlds-preview {
      padding: var(--space-12, 48px) 0;
    }

    .worlds-preview__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3px;
    }

    .monitor-card {
      display: block;
      background: var(--color-surface-sunken);
      text-decoration: none;
      color: inherit;
      overflow: hidden;
      position: relative;
      transition: transform 300ms var(--ease-dramatic);
    }

    .monitor-card:hover {
      transform: translateY(-2px);
      z-index: 1;
    }

    .monitor-card__strip {
      height: 3px;
      background: var(--theme-accent, #888);
    }

    .monitor-card__feed {
      position: relative;
      height: 140px;
      overflow: hidden;
      background: var(--color-surface-sunken);
    }

    .monitor-card__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.6;
      transition: opacity 400ms, filter 400ms;
      filter: saturate(0.7);
    }

    .monitor-card:hover .monitor-card__img {
      opacity: 0.85;
      filter: saturate(1);
    }

    .monitor-card__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--color-surface-sunken) 0%, transparent 50%);
    }

    .monitor-card__scanline {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        transparent 0px, transparent 2px,
        color-mix(in srgb, var(--color-surface) 15%, transparent) 2px, color-mix(in srgb, var(--color-surface) 15%, transparent) 4px
      );
      pointer-events: none;
    }

    .monitor-card__scanline::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: color-mix(in srgb, var(--color-surface-inverse) 4%, transparent);
      animation: monitor-scan 4s linear infinite;
    }

    .monitor-card:hover .monitor-card__scanline::after {
      animation-play-state: paused;
    }

    @keyframes monitor-scan {
      from { top: -2px; }
      to   { top: 100%; }
    }

    .monitor-card__rec {
      position: absolute;
      top: 8px;
      left: 10px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 2px;
      color: var(--color-danger);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .monitor-card__rec::before {
      content: '';
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-danger);
      animation: rec-blink 1.5s ease-in-out infinite;
    }

    @keyframes rec-blink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.2; }
    }

    .monitor-card__coord {
      position: absolute;
      bottom: 8px;
      right: 10px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 8px;
      letter-spacing: 1px;
      color: color-mix(in srgb, var(--color-surface-inverse) 25%, transparent);
    }

    .monitor-card__body {
      padding: 14px 16px 16px;
    }

    .monitor-card__name {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 6px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .monitor-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 0 0 10px;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .monitor-card__stats {
      display: flex;
      gap: 12px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    /* Explore-all card: static/noise effect */
    .monitor-card--explore .monitor-card__static {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .monitor-card__noise {
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent, transparent 1px,
          color-mix(in srgb, var(--color-surface-inverse) 1.5%, transparent) 1px, color-mix(in srgb, var(--color-surface-inverse) 1.5%, transparent) 2px
        );
      opacity: 0.6;
      transition: opacity 400ms;
    }

    .monitor-card--explore:hover .monitor-card__noise {
      opacity: 0.2;
    }

    .monitor-card__static-text {
      position: relative;
      z-index: 1;
      text-align: center;
    }

    .monitor-card__static-count {
      display: block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 28px;
      color: var(--color-accent-amber);
      line-height: 1;
    }

    .monitor-card__static-label {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .monitor-card__cta-arrow {
      font-size: 18px;
      color: var(--color-accent-amber);
      transition: transform 200ms;
    }

    .monitor-card--explore:hover .monitor-card__cta-arrow {
      transform: translateX(6px);
    }

    .monitor-card--explore .monitor-card__name {
      color: var(--color-accent-amber);
    }

    /* ═══════════════════════════════════════════
       RESPONSIVE
       ═══════════════════════════════════════════ */

    @media (max-width: 640px) {
      .hero__bracket,
      .hero__coord {
        display: none;
      }

      .hero__cta-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .hero__cta--secondary {
        margin-left: 0;
      }

      .feature-card {
        padding: 32px 24px;
      }

      .stat-cell {
        padding: 32px 24px;
      }

      .cta-frame {
        padding: 32px 24px;
      }

      .cta-frame__actions {
        flex-direction: column;
        align-items: center;
      }

      .worlds-preview__grid {
        grid-template-columns: 1fr;
      }

      .monitor-card__feed {
        height: 120px;
      }
    }

    @media (min-width: 641px) and (max-width: 1023px) {
      .worlds-preview__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* ── Standard Desktop / 1080p laptops (1280px–1599px) ── */
    @media (min-width: 1280px) and (max-width: 1599px) {
      .landing-inner {
        max-width: 1400px;
      }

      .worlds-preview .landing-inner {
        max-width: 1400px;
      }

      .worlds-preview__grid {
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
      }

      .monitor-card__feed {
        height: 160px;
      }

      .monitor-card__desc {
        -webkit-line-clamp: 3;
      }

      .feature-card__body {
        padding: 28px 32px 32px;
      }

      .feature-card__desc {
        font-size: 12.5px;
        line-height: 1.75;
      }

      .stat-cell {
        padding: 48px 36px;
      }

      .features {
        padding: 100px 0 80px;
      }

      .cta-frame {
        max-width: 720px;
        padding: 56px 48px;
      }
    }

    /* ── Widescreen / 1440p (1600px+) ── */
    @media (min-width: 1600px) {
      .landing-inner {
        max-width: 1700px;
      }

      .features,
      .live-data,
      .how-it-works,
      .cta-footer {
        max-width: 1700px;
        margin-inline: auto;
        padding-inline: var(--space-8, 32px);
      }

      .worlds-preview .landing-inner {
        max-width: 1700px;
      }

      .worlds-preview__grid {
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
      }

      .monitor-card__feed {
        height: 160px;
      }

      .monitor-card__desc {
        -webkit-line-clamp: 3;
        font-size: 11.5px;
      }

      .hero__title {
        font-size: 5.5rem;
      }

      .features__grid {
        gap: 3px;
      }

      .feature-card__body {
        padding: 32px 36px 36px;
      }

      .feature-card__title {
        font-size: 14px;
        letter-spacing: 4px;
      }

      .feature-card__desc {
        font-size: 13px;
        line-height: 1.8;
      }

      .stat-cell {
        padding: 56px 40px;
      }

      .cta-frame {
        max-width: 800px;
        padding: 64px 56px;
      }
    }

    /* ── Ultrawide / 4K (2560px+) ── */
    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, color-mix(in srgb, var(--color-surface) 40%, transparent) 100%),
          var(--color-surface);
      }

      .features,
      .live-data,
      .how-it-works,
      .cta-footer {
        max-width: 2200px;
      }

      .worlds-preview .landing-inner {
        max-width: 2200px;
      }

      .worlds-preview__grid {
        grid-template-columns: repeat(8, 1fr);
      }

      .monitor-card__feed {
        height: 180px;
      }

      .monitor-card__body {
        padding: 16px 20px 20px;
      }

      .feature-card__body {
        padding: 36px 40px 40px;
      }

      .feature-card__desc {
        font-size: 14px;
      }
    }
  `;

  @state() private _stats: PlatformStats | null = null;
  @state() private _worlds: Simulation[] = [];

  /** Interval ID for the signal-decode hero animation (cleared on disconnect). */
  private _decodeInterval?: ReturnType<typeof setInterval>;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._fetchStats();
    this._fetchWorlds();
    this._injectStructuredData();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._decodeInterval) clearInterval(this._decodeInterval);
    seoService.removeStructuredData();
  }

  private _injectStructuredData(): void {
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'VideoGame',
          name: 'metaverse.center',
          url: 'https://metaverse.center',
          description:
            'A multiplayer worldbuilding and strategy platform with AI-powered agents, competitive epochs, and cross-simulation diplomacy.',
          genre: ['Strategy', 'Simulation', 'Role-playing'],
          playMode: ['MultiPlayer', 'SinglePlayer'],
          numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 8 },
          applicationCategory: 'Game',
          operatingSystem: 'Web browser',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          gamePlatform: 'Web',
          inLanguage: ['en', 'de'],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What is metaverse.center?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'metaverse.center is a free multiplayer worldbuilding and strategy platform. Create living worlds with AI-powered agents, sprawling cities, and evolving lore. Join competitive Epochs where civilizations clash through espionage, alliances, and strategic deployment.',
              },
            },
            {
              '@type': 'Question',
              name: 'How do Epochs work?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Epochs are competitive PvP seasons where simulation owners deploy operatives, form alliances, and compete across five scoring dimensions: stability, influence, sovereignty, diplomatic, and military. Each cycle, players choose missions and targets, with results determined by agent aptitudes and strategic decisions.',
              },
            },
            {
              '@type': 'Question',
              name: 'What are Resonances?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Resonances are real-world events (earthquakes, elections, discoveries) that ripple through the simulated multiverse, affecting gameplay and world dynamics. They blur the boundary between simulated worlds and reality.',
              },
            },
            {
              '@type': 'Question',
              name: 'Is metaverse.center free to use?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes, metaverse.center is completely free. Create simulations, join Epochs, and explore the multiverse at no cost. Advanced AI features like image generation use optional API keys.',
              },
            },
          ],
        },
        {
          '@type': 'HowTo',
          name: 'How to Build a World on metaverse.center',
          description:
            'From a single sentence to a living, competitive civilization in four steps.',
          step: [
            {
              '@type': 'HowToStep',
              position: 1,
              name: 'Create Your World',
              text: 'Type a premise. The Forge generates a complete civilization with dozens of characters, cities with architecture, and thousands of words of original lore. Minutes, not months.',
            },
            {
              '@type': 'HowToStep',
              position: 2,
              name: 'Join an Epoch',
              text: 'Pit your civilization against others in timed competitive seasons. Deploy operatives, sabotage rivals, protect your agents. Strategy meets emergent AI storytelling.',
            },
            {
              '@type': 'HowToStep',
              position: 3,
              name: 'Enter the Resonance',
              text: 'Send agents into the fractures between worlds. Eight archetypal dungeons, procedurally generated and literarily informed, where stress is real and choices reshape who your agents become.',
            },
            {
              '@type': 'HowToStep',
              position: 4,
              name: 'Shape the Metaverse',
              text: 'Your actions ripple across every connected world. Build embassies, trigger cross-simulation events, and watch as the stories of separate civilizations entangle.',
            },
          ],
        },
      ],
    });
  }

  protected firstUpdated(): void {
    this._setupScrollAnimations();
    this._setupSectionTracking();
    this._setupSignalDecodeHero();
  }

  protected updated(): void {
    // Re-observe any new scroll-reveal elements added after async data loads
    this._observeNewScrollRevealElements();
  }

  private async _fetchStats(): Promise<void> {
    try {
      const response = await simulationsApi.getPlatformStats<PlatformStats>();
      if (response.success && response.data) {
        this._stats = response.data;
      }
    } catch {
      // Stats are non-critical — show fallback
    }
  }

  private async _fetchWorlds(): Promise<void> {
    try {
      const w = window.innerWidth;
      const worldLimit = w >= 2560 ? 7 : w >= 1600 ? 5 : w >= 1280 ? 4 : 3;
      const resp = await simulationsApi.listPublic({ limit: String(worldLimit), offset: '0' });
      if (resp.success && Array.isArray(resp.data)) {
        this._worlds = resp.data as Simulation[];
      }
    } catch {
      // Non-critical
    }
  }

  private _scrollObserver?: IntersectionObserver;

  private _setupScrollAnimations(): void {
    this._scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        }
      },
      { threshold: 0.15 },
    );

    this._observeNewScrollRevealElements();
  }

  private _observeNewScrollRevealElements(): void {
    if (!this._scrollObserver) return;
    const elements = this.renderRoot.querySelectorAll('.scroll-reveal:not(.in-view)');
    for (const el of elements) {
      this._scrollObserver.observe(el);
    }
  }

  private _navigate(path: string): void {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _getStorageUrl(path: string): string {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/simulation.assets/${path}`;
  }

  private _trackCta(location: string): void {
    this.dispatchEvent(
      new CustomEvent('landing-cta-click', {
        bubbles: true,
        composed: true,
        detail: { location },
      }),
    );
  }

  private _setupSectionTracking(): void {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const section = (entry.target as HTMLElement).dataset.section;
            if (section) {
              this.dispatchEvent(
                new CustomEvent('landing-section-view', {
                  bubbles: true,
                  composed: true,
                  detail: { section },
                }),
              );
            }
            sectionObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 },
    );

    const sections = this.renderRoot.querySelectorAll('[data-section]');
    for (const el of sections) {
      sectionObserver.observe(el);
    }
  }

  protected render() {
    return html`
      <a class="skip-link" href="#main-content">${msg('Skip to content')}</a>

      <main id="main-content">
        ${this._renderHero()}
        ${this._renderFeatures()}
        ${this._worlds.length > 0 ? this._renderWorldsPreview() : ''}
        <velg-landing-agent-showcase></velg-landing-agent-showcase>
        ${this._renderDungeonIntro()}
        <velg-dungeon-showcase></velg-dungeon-showcase>
        ${this._renderLiveData()}
        ${this._renderHowItWorks()}
        ${this._renderCtaFooter()}
      </main>
      <velg-platform-footer></velg-platform-footer>
    `;
  }

  private _renderHero() {
    const waveformBars = Array.from(
      { length: 24 },
      (_, i) =>
        html`<div class="waveform__bar" style="animation-delay: ${i * 0.06}s; height: ${4 + Math.random() * 12}px"></div>`,
    );

    return html`
      <section class="hero hero--variant hero--v03 landing-section" data-hero="03" aria-label=${msg('Welcome')}>
        <img class="hero__bg" src=${this._getStorageUrl('platform/landing/hero.avif')}
          alt=${msg('Multiverse observation terminal overlooking interconnected simulation worlds')}
          fetchpriority="high" decoding="async" />
        <div class="hero__viz"></div>
        <div class="hero__scanlines"></div>
        <div class="hero__scanbeam"></div>
        <div class="hero__grid"></div>

        <div class="hero__bracket hero__bracket--tl"></div>
        <div class="hero__bracket hero__bracket--tr"></div>
        <div class="hero__bracket hero__bracket--bl"></div>
        <div class="hero__bracket hero__bracket--br"></div>

        <span class="hero__coord hero__coord--tl">SEC-7 // LAT 42.3601</span>
        <span class="hero__coord hero__coord--tr">FRACTURE DEPTH: 0.847</span>
        <span class="hero__coord hero__coord--bl">SIGNAL: NOMINAL</span>

        <div class="hero__content">
          <p class="hero__classification">INTERCEPTED TRANSMISSION // DECRYPTING...</p>
          <h1 class="hero__title" data-decode="Metaverse.Center">
            <span class="hero__title-accent" data-decode-part="accent">&#x2588;&#x2593;&#x2591;&#x2592;&#x2588;&#x2593;&#x2591;&#x2592;&#x2588;</span><span data-decode-part="rest">&#x2591;&#x2592;&#x2588;&#x2593;&#x2591;&#x2592;&#x2588;</span>
            <span class="hero__title-underline"></span>
          </h1>
          <div class="waveform" aria-hidden="true">${waveformBars}</div>
          <p class="hero__subtitle">
            ${msg('Create AI-powered civilizations with characters who remember, cities that evolve, and stories that write themselves.')}
          </p>
          <div class="hero__cta-area">
            ${
              appState.isAuthenticated.value
                ? html`
                <a
                  class="hero__cta"
                  href="/dashboard"
                  @click=${(e: Event) => {
                    e.preventDefault();
                    this._trackCta('hero-dashboard');
                    this._navigate('/dashboard');
                  }}
                  aria-label=${msg('Go to Dashboard')}
                >
                  ${msg('Go to Dashboard')}
                  <span class="hero__cta-arrow" aria-hidden="true">\u2192</span>
                </a>
              `
                : html`
                <a
                  class="hero__cta"
                  href="/register"
                  @click=${(e: Event) => {
                    e.preventDefault();
                    this._trackCta('hero');
                    this._navigate('/register');
                  }}
                  aria-label=${msg('Build Your World \u2013 Create your account')}
                >
                  ${msg('Build Your World')}
                  <span class="hero__cta-arrow" aria-hidden="true">\u2192</span>
                </a>
              `
            }
            <a
              class="hero__cta hero__cta--secondary"
              href="/worlds"
              @click=${(e: Event) => {
                e.preventDefault();
                this._trackCta('hero-explore');
                this._navigate('/worlds');
              }}
              aria-label=${msg('Explore Worlds \u2013 Browse player-created civilizations')}
            >
              ${msg('Explore Worlds')}
            </a>
          </div>
        </div>

        <div class="decode-progress">
          <div class="decode-progress__label">
            <span>SIGNAL LOCK</span>
            <span class="decode-pct">0%</span>
          </div>
          <div class="decode-progress__bar">
            <div class="decode-progress__fill"></div>
          </div>
        </div>

        <button
          class="hero__scroll-hint"
          aria-label=${msg('Scroll to features')}
          @click=${() => {
            this.renderRoot
              .querySelector('[data-section="features"]')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span class="hero__scroll-text">${msg('Scroll')}</span>
          <div class="hero__scroll-line"></div>
        </button>
      </section>
    `;
  }

  /* Signal decode hero animation */
  private _setupSignalDecodeHero(): void {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const hero = this.renderRoot.querySelector<HTMLElement>('[data-hero="03"]');
    if (!hero) return;

    hero.classList.add('in-view');
    this._animateSignalDecode(hero);
  }

  private _animateSignalDecode(section: HTMLElement): void {
    const accentEl = section.querySelector<HTMLElement>('[data-decode-part="accent"]');
    const restEl = section.querySelector<HTMLElement>('[data-decode-part="rest"]');
    const progressFill = section.querySelector<HTMLElement>('.decode-progress__fill');
    const progressPct = section.querySelector<HTMLElement>('.decode-pct');

    if (!accentEl || !restEl) return;

    const targetAccent = 'Metaverse';
    const targetRest = '.Center';
    const scrambleChars = '\u2588\u2593\u2591\u2592\u2580\u2584\u258C\u2590';
    const totalSteps = 30;
    let step = 0;

    this._decodeInterval = setInterval(() => {
      step++;
      const progress = step / totalSteps;

      if (progressFill) progressFill.style.width = `${Math.round(progress * 100)}%`;
      if (progressPct) progressPct.textContent = `${Math.round(progress * 100)}%`;

      const accentRevealed = Math.floor(progress * targetAccent.length);
      const restRevealed = Math.floor(Math.max(0, (progress - 0.5) * 2) * targetRest.length);

      let accentText = '';
      for (let j = 0; j < targetAccent.length; j++) {
        accentText +=
          j < accentRevealed
            ? targetAccent[j]
            : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
      accentEl.textContent = accentText;

      let restText = '';
      for (let j = 0; j < targetRest.length; j++) {
        restText +=
          j < restRevealed
            ? targetRest[j]
            : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
      restEl.textContent = restText;

      if (step >= totalSteps) {
        clearInterval(this._decodeInterval);
        this._decodeInterval = undefined;
        accentEl.textContent = targetAccent;
        restEl.textContent = targetRest;
        section.querySelector('.hero__content')?.classList.add('decode-complete');
      }
    }, 60);
  }

  // Showcase variations backed up in LandingPage.showcase-backup.ts
  private _renderFeatures() {
    return html`
      <section class="features landing-section" data-section="features" aria-label=${msg('Features')}>
        <div class="landing-inner">
          <div class="section-label">${msg('Capabilities')}</div>

          <div class="features__grid">
            <div class="feature-card scroll-reveal" style="--i: 0">
              <div class="feature-card__img-wrap">
                <img
                  class="feature-card__img"
                  src=${this._getStorageUrl('platform/landing/feature-worldbuilding.avif')}
                  alt=${msg('AI-powered worldbuilding visualization')}
                  loading="lazy"
                  decoding="async"
                />
                <div class="feature-card__img-overlay"></div>
                <span class="feature-card__tag">SIM-CONSTRUCT</span>
                <div class="feature-card__accent"></div>
              </div>
              <div class="feature-card__body">
                <h2 class="feature-card__title">${msg('Worldbuilding')}</h2>
                <p class="feature-card__desc">
                  ${msg('Describe a world in one sentence. The Forge builds it – geography, citizens, architecture, thousands of words of lore. Within minutes, you have a living civilization with characters who form opinions, hold grudges, and write their own newspapers.')}
                </p>
                <div class="feature-card__ref">TIER-1 // ACTIVE</div>
              </div>
            </div>

            <div class="feature-card scroll-reveal" style="--i: 1">
              <div class="feature-card__img-wrap">
                <img
                  class="feature-card__img"
                  src=${this._getStorageUrl('platform/landing/feature-competition.avif')}
                  alt=${msg('Espionage war room with operative deployment')}
                  loading="lazy"
                  decoding="async"
                />
                <div class="feature-card__img-overlay"></div>
                <span class="feature-card__tag">EPOCH-OPS</span>
                <div class="feature-card__accent"></div>
              </div>
              <div class="feature-card__body">
                <h2 class="feature-card__title">${msg('Competition')}</h2>
                <p class="feature-card__desc">
                  ${msg('Enter competitive seasons where civilizations clash. Deploy spies behind enemy lines, forge alliances with rival worldbuilders, betray them at the perfect moment. Real-time strategy with AI agents as your pawns.')}
                </p>
                <div class="feature-card__ref">TIER-2 // ACTIVE</div>
              </div>
            </div>

            <div class="feature-card scroll-reveal" style="--i: 2">
              <div class="feature-card__img-wrap">
                <img
                  class="feature-card__img"
                  src=${this._getStorageUrl('platform/landing/feature-dungeons.avif')}
                  alt=${msg('Resonance fracture opening into layered archetype chambers')}
                  loading="lazy"
                  decoding="async"
                />
                <div class="feature-card__img-overlay"></div>
                <span class="feature-card__tag">DEPTH-SIGNAL</span>
                <div class="feature-card__accent"></div>
              </div>
              <div class="feature-card__body">
                <h2 class="feature-card__title">${msg('Resonance Dungeons')}</h2>
                <p class="feature-card__desc">
                  ${msg('Send your agents where reality fractures. Eight archetypal dungeons \u2013 each shaped by its own literary DNA, from existential dread to political vertigo. Your agents face stress, fight what lives in the fracture, and return carrying aptitudes, artifacts, and scars that reshape your civilization.')}
                </p>
                <div class="feature-card__ref">TIER-3 // ACTIVE</div>
              </div>
            </div>

            <div class="feature-card scroll-reveal" style="--i: 3">
              <div class="feature-card__img-wrap">
                <img
                  class="feature-card__img"
                  src=${this._getStorageUrl('platform/landing/feature-substrate.avif')}
                  alt=${msg('Reality fracturing as real-world events bleed through')}
                  loading="lazy"
                  decoding="async"
                />
                <div class="feature-card__img-overlay"></div>
                <span class="feature-card__tag">SUB-MONITOR</span>
                <div class="feature-card__accent"></div>
              </div>
              <div class="feature-card__body">
                <h2 class="feature-card__title">${msg('The Substrate')}</h2>
                <p class="feature-card__desc">
                  ${msg('Real-world events ripple through every simulation as Resonances. An earthquake in Tokyo becomes a tremor in your fantasy kingdom. Events in one world bleed into others. The boundary between realities is thinner than you think.')}
                </p>
                <div class="feature-card__ref">TIER-4 // ACTIVE</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _renderWorldsPreview() {
    return html`
      <section class="worlds-preview landing-section" data-section="worlds-preview" aria-label=${msg('Active Worlds')}>
        <div class="landing-inner">
          <div class="section-label">${msg('Active Feeds')}</div>

          <div class="worlds-preview__grid">
            ${this._worlds.map(
              (sim, i) => html`
                <a
                  class="monitor-card scroll-reveal"
                  style="--i: ${i}; --theme-accent: ${getThemeColor(sim.theme ?? 'custom')}"
                  href="/simulations/${sim.slug || sim.id}/lore"
                  @click=${(e: Event) => {
                    e.preventDefault();
                    this._trackCta('worlds-preview');
                    this._navigate(`/simulations/${sim.slug || sim.id}/lore`);
                  }}
                >
                  <div class="monitor-card__strip"></div>
                  <div class="monitor-card__feed">
                    ${
                      sim.banner_url
                        ? html`<img
                          class="monitor-card__img"
                          src=${sim.banner_url}
                          alt=${t(sim, 'name')}
                          loading="lazy"
                          decoding="async"
                        />`
                        : ''
                    }
                    <div class="monitor-card__overlay"></div>
                    <div class="monitor-card__scanline"></div>
                    <span class="monitor-card__rec" aria-hidden="true">REC</span>
                    <span class="monitor-card__coord" aria-hidden="true">
                      FEED-${String(i + 1).padStart(2, '0')} // ${(sim.theme ?? 'custom').toUpperCase()}
                    </span>
                  </div>
                  <div class="monitor-card__body">
                    <h3 class="monitor-card__name">${t(sim, 'name')}</h3>
                    <p class="monitor-card__desc">${t(sim, 'description')}</p>
                    <div class="monitor-card__stats">
                      <span>${sim.agent_count ?? 0} ${msg('agents')}</span>
                      <span>${sim.building_count ?? 0} ${msg('buildings')}</span>
                    </div>
                  </div>
                </a>
              `,
            )}

            <a
              class="monitor-card monitor-card--explore scroll-reveal"
              style="--i: ${this._worlds.length}"
              href="/worlds"
              @click=${(e: Event) => {
                e.preventDefault();
                this._trackCta('worlds-preview-explore');
                this._navigate('/worlds');
              }}
            >
              <div class="monitor-card__strip" style="background: var(--color-accent-amber)"></div>
              <div class="monitor-card__feed monitor-card__static">
                <div class="monitor-card__noise"></div>
                <div class="monitor-card__static-text">
                  <span class="monitor-card__static-count">${this._stats?.simulation_count ?? '...'}</span>
                  <span class="monitor-card__static-label">${msg('worlds online')}</span>
                </div>
              </div>
              <div class="monitor-card__body">
                <h3 class="monitor-card__name">${msg('Explore All Worlds')}</h3>
                <p class="monitor-card__desc">${msg('Browse every civilization in the multiverse.')}</p>
                <div class="monitor-card__cta-arrow">\u2192</div>
              </div>
            </a>
          </div>
        </div>
      </section>
    `;
  }

  private _renderDungeonIntro() {
    return html`
      <section class="dungeon-intro landing-section scroll-reveal" data-section="dungeon-intro" aria-label=${msg('Resonance Dungeons')}>
        <div class="section-label">${msg('Depth Signal')}</div>
        <h2 class="dungeon-intro__heading">${msg('Where Boundaries Thin')}</h2>
        <p class="dungeon-intro__body">
          ${msg('Your agents have memories, opinions, grudges. Now send them where reality fractures. Eight archetypal dungeons, each a different wound in the world \u2013 and a different test of what your civilization is made of.')}
        </p>
      </section>
    `;
  }

  private _renderLiveData() {
    const sims = this._stats?.simulation_count ?? null;
    const epochs = this._stats?.active_epoch_count ?? null;
    const resonances = this._stats?.resonance_count ?? null;

    return html`
      <section class="live-data landing-section" data-section="live-data" aria-label=${msg('Platform Statistics')}>
        <div class="landing-inner">
          <div class="section-label">${msg('Live Telemetry')}</div>

          <div class="live-data__grid">
            <div class="stat-cell scroll-reveal" style="--i: 0">
              <div class="stat-cell__signal" style="--i: 0" aria-hidden="true"></div>
              <p class="stat-cell__label">${msg('Active Worlds')}</p>
              <p class="stat-cell__value" aria-label=${msg('Active world count')}>
                ${sims !== null ? sims : '\u2014'}
              </p>
              <p class="stat-cell__unit">${msg('simulations online')}</p>
            </div>

            <div class="stat-cell scroll-reveal" style="--i: 1">
              <div class="stat-cell__signal" style="--i: 1" aria-hidden="true"></div>
              <p class="stat-cell__label">${msg('Live Epochs')}</p>
              <p class="stat-cell__value" aria-label=${msg('Active epoch count')}>
                ${epochs !== null ? epochs : '\u2014'}
              </p>
              <p class="stat-cell__unit">${msg('competitive seasons')}</p>
            </div>

            <div class="stat-cell scroll-reveal" style="--i: 2">
              <div class="stat-cell__signal" style="--i: 2" aria-hidden="true"></div>
              <p class="stat-cell__label">${msg('Resonances')}</p>
              <p class="stat-cell__value" aria-label=${msg('Resonance count')}>
                ${resonances !== null ? resonances : '\u2014'}
              </p>
              <p class="stat-cell__unit">${msg('substrate events')}</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _renderHowItWorks() {
    return html`
      <section class="how-it-works landing-section" data-section="how-it-works" aria-label=${msg('How It Works')}>
        <div class="landing-inner">
          <div class="section-label">${msg('Operations Protocol')}</div>

          <div class="steps">
            <div class="step scroll-reveal" style="--i: 0">
              <div class="step__badge">01</div>
              <h3 class="step__title">${msg('Create Your World')}</h3>
              <p class="step__desc">
                ${msg('Type a premise. The Forge generates a complete civilization – dozens of characters with personalities, cities with architecture, and thousands of words of original lore. Minutes, not months.')}
              </p>
            </div>

            <div class="step-connector scroll-reveal" style="--i: 0">
              <div class="step-connector__line"></div>
            </div>

            <div class="step scroll-reveal" style="--i: 1">
              <div class="step__badge">02</div>
              <h3 class="step__title">${msg('Join an Epoch')}</h3>
              <p class="step__desc">
                ${msg('Pit your civilization against others in timed competitive seasons. Deploy operatives, sabotage rivals, protect your agents. Strategy meets emergent AI storytelling.')}
              </p>
            </div>

            <div class="step-connector scroll-reveal" style="--i: 1">
              <div class="step-connector__line"></div>
            </div>

            <div class="step scroll-reveal" style="--i: 2">
              <div class="step__badge">03</div>
              <h3 class="step__title">${msg('Enter the Resonance')}</h3>
              <p class="step__desc">
                ${msg('Send agents into the fractures between worlds. Eight archetypal dungeons \u2013 procedurally generated, literarily informed \u2013 where stress is real and choices reshape who your agents become. What happens in the depths changes your world above.')}
              </p>
            </div>

            <div class="step-connector scroll-reveal" style="--i: 2">
              <div class="step-connector__line"></div>
            </div>

            <div class="step scroll-reveal" style="--i: 3">
              <div class="step__badge">04</div>
              <h3 class="step__title">${msg('Shape the Metaverse')}</h3>
              <p class="step__desc">
                ${msg('Your actions ripple across every connected world. Build embassies, trigger cross-simulation events, and watch as the stories of separate civilizations entangle.')}
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _renderCtaFooter() {
    return html`
      <section class="cta-footer landing-section scroll-reveal" data-section="cta-footer" aria-label=${msg('Get Started')}>
        <div class="landing-inner">
          <div class="cta-frame">
            <div class="cta-frame__corners"></div>

            <p class="cta-frame__classification">${msg('Transmission Open')}</p>
            <h2 class="cta-frame__heading">${msg('Every World Writes Its Own History')}</h2>
            <p class="cta-frame__text">
              ${msg('Explore worlds built by others – read their stories, meet their characters, follow the intrigue. Or build your own. Describe a world in one sentence. The Forge does the rest.')}
            </p>

            <div class="cta-frame__actions">
              ${
                appState.isAuthenticated.value
                  ? html`
                  <a
                    class="cta-frame__btn"
                    href="/dashboard"
                    @click=${(e: Event) => {
                      e.preventDefault();
                      this._trackCta('footer-dashboard');
                      this._navigate('/dashboard');
                    }}
                    aria-label=${msg('Go to Dashboard')}
                  >
                    ${msg('Go to Dashboard')}
                  </a>
                `
                  : html`
                  <a
                    class="cta-frame__btn"
                    href="/register"
                    @click=${(e: Event) => {
                      e.preventDefault();
                      this._trackCta('footer-create');
                      this._navigate('/register');
                    }}
                    aria-label=${msg('Create your world \u2013 Sign up')}
                  >
                    ${msg('Create Your World')}
                  </a>
                `
              }
              <a
                class="cta-frame__btn cta-frame__btn--secondary"
                href="/worlds"
                @click=${(e: Event) => {
                  e.preventDefault();
                  this._trackCta('footer-explore');
                  this._navigate('/worlds');
                }}
                aria-label=${msg('Explore existing worlds')}
              >
                ${msg('Explore Worlds')}
              </a>
            </div>

            <p class="cta-frame__ref">REF: BMO-${new Date().getFullYear()}-INTAKE</p>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-page': VelgLandingPage;
  }
}
