/**
 * Landing Page — Full-screen immersive introduction for unauthenticated visitors.
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
import { seoService } from '../../services/SeoService.js';

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
      --amber: #f59e0b;
      --amber-dim: #b45309;
      --amber-glow: rgba(245, 158, 11, 0.15);
      --amber-ghost: rgba(245, 158, 11, 0.04);
      --green: #4ade80;
      --green-dim: rgba(74, 222, 128, 0.15);
      --surface: #0a0a0a;
      --surface-raised: #111;
      --surface-card: #0d0d0d;
      --border: #222;
      --border-dim: #1a1a1a;
      --text-primary: #e5e5e5;
      --text-secondary: #999;
      --text-dim: #888;
      --ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1);
      --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

      display: block;
      background: var(--surface);
      color: var(--text-primary);
      overflow-x: hidden;
    }

    *, *::before, *::after { box-sizing: border-box; }

    /* ── Skip Link ────────────────────────────── */

    .skip-link {
      position: absolute;
      top: -100%;
      left: 16px;
      z-index: 100;
      padding: 8px 16px;
      background: var(--amber);
      color: var(--surface);
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
      50%      { text-shadow: 0 0 20px var(--green-dim), 0 0 40px rgba(74, 222, 128, 0.08); }
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
      color: var(--amber);
      margin-bottom: 32px;
    }

    .section-label::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--amber);
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
      filter: brightness(0.35) saturate(0.8);
      animation: hero-drift 30s ease-in-out infinite alternate;
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
        radial-gradient(ellipse 600px 400px at 25% 35%, rgba(245, 158, 11, 0.08) 0%, transparent 70%),
        radial-gradient(ellipse 500px 500px at 75% 65%, rgba(74, 222, 128, 0.05) 0%, transparent 70%);
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
        rgba(245, 158, 11, 0.008) 3px,
        rgba(245, 158, 11, 0.008) 6px
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
        rgba(245, 158, 11, 0.03) 40%,
        rgba(245, 158, 11, 0.06) 50%,
        rgba(245, 158, 11, 0.03) 60%,
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
        linear-gradient(rgba(245, 158, 11, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245, 158, 11, 0.025) 1px, transparent 1px);
      background-size: 60px 60px;
      animation: grid-pulse 6s ease-in-out infinite;
      pointer-events: none;
    }

    /* Corner brackets */
    .hero__bracket {
      position: absolute;
      width: 40px;
      height: 40px;
      border-color: var(--amber);
      border-style: solid;
      opacity: 0.4;
      z-index: 3;
    }
    .hero__bracket--tl { top: 24px; left: 24px; border-width: 2px 0 0 2px; }
    .hero__bracket--tr { top: 24px; right: 24px; border-width: 2px 2px 0 0; }
    .hero__bracket--bl { bottom: 24px; left: 24px; border-width: 0 0 2px 2px; }
    .hero__bracket--br { bottom: 24px; right: 24px; border-width: 0 2px 2px 0; }

    /* Corner coordinates */
    .hero__coord {
      position: absolute;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--text-dim);
      letter-spacing: 1px;
      animation: coord-drift 4s ease-in-out infinite;
      z-index: 3;
    }
    .hero__coord--tl { top: 70px; left: 28px; }
    .hero__coord--tr { top: 70px; right: 28px; text-align: right; }
    .hero__coord--bl { bottom: 70px; left: 28px; }

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
      color: var(--amber);
      margin: 0 0 24px;
      opacity: 0;
      animation: content-fade 400ms var(--ease-dramatic) both 100ms;
    }

    .hero__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(2rem, 6vw, 4.5rem);
      text-transform: uppercase;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.05;
      animation: hero-title-enter 800ms var(--ease-dramatic) both 200ms;
    }

    .hero__title-accent {
      color: var(--amber);
    }

    .hero__subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.5vw, 0.95rem);
      color: var(--text-secondary);
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
      color: var(--surface);
      background: var(--amber);
      border: 1px solid var(--amber-dim);
      cursor: pointer;
      text-decoration: none;
      transition: all 200ms;
      position: relative;
      overflow: hidden;
    }

    .hero__cta:hover {
      background: #fbbf24;
      box-shadow: 0 0 30px var(--amber-glow), 0 0 60px rgba(245, 158, 11, 0.08);
      transform: translateY(-2px);
    }

    .hero__cta:active {
      transform: translateY(0);
    }

    .hero__cta::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
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

    .hero__scroll-hint {
      position: absolute;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 4;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      opacity: 0;
      animation: content-fade 400ms var(--ease-dramatic) both 1.2s;
    }

    .hero__scroll-text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .hero__scroll-line {
      width: 1px;
      height: 32px;
      background: linear-gradient(180deg, var(--amber), transparent);
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
      bottom: 80px;
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
      color: var(--amber);
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }

    .hero--v03 .decode-progress__bar {
      height: 2px;
      background: rgba(245, 158, 11, 0.15);
      position: relative;
      overflow: hidden;
    }

    .hero--v03 .decode-progress__fill {
      height: 100%;
      background: var(--amber);
      width: 0%;
      transition: width 50ms linear;
      box-shadow: 0 0 8px var(--amber);
    }

    .hero--v03 .hero__title-underline {
      display: block;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--amber), transparent);
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
      background: var(--amber);
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
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      background: var(--border);
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
        rgba(10, 10, 10, 0.7) 70%,
        rgba(10, 10, 10, 0.95) 100%
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
      background: var(--amber);
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
      color: var(--amber);
      background: rgba(10, 10, 10, 0.7);
      padding: 3px 8px;
      border: 1px solid rgba(245, 158, 11, 0.2);
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
      color: var(--text-primary);
      margin: 0 0 12px;
    }

    .feature-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.7;
      color: var(--text-secondary);
      margin: 0;
    }

    .feature-card__ref {
      margin-top: 16px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 1px;
      color: var(--text-dim);
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
      background: var(--border);
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
      background: var(--green);
      border-radius: 50%;
    }

    .stat-cell__signal::after {
      content: '';
      position: absolute;
      inset: -3px;
      border: 1px solid var(--green);
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
      color: var(--text-dim);
      margin: 0 0 16px;
    }

    .stat-cell__value {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(2.5rem, 5vw, 4rem);
      color: var(--green);
      margin: 0;
      line-height: 1;
      animation: stat-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * 500ms);
    }

    .stat-cell__unit {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--text-dim);
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
      grid-template-columns: 1fr auto 1fr auto 1fr;
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
      border: 2px solid var(--amber);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 18px;
      color: var(--amber);
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
      color: var(--text-primary);
      margin: 0 0 12px;
    }

    .step__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      line-height: 1.7;
      color: var(--text-secondary);
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
      background: var(--border);
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
      border-right: 1px solid var(--amber);
      border-top: 1px solid var(--amber);
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
       SECTION 5 — CTA FOOTER
       ═══════════════════════════════════════════ */

    .cta-footer {
      padding: 80px 0 120px;
      border-top: 1px solid var(--border-dim);
    }

    .cta-frame {
      max-width: 640px;
      margin: 0 auto;
      border: 1px dashed var(--border);
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
      border-color: var(--amber);
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
      border-color: var(--amber);
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
      color: var(--amber);
      margin: 0 0 20px;
    }

    .cta-frame__heading {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.2rem, 3vw, 1.8rem);
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-primary);
      margin: 0 0 12px;
    }

    .cta-frame__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.7;
      color: var(--text-secondary);
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
      color: var(--surface);
      background: var(--amber);
      border: 1px solid var(--amber-dim);
      cursor: pointer;
      text-decoration: none;
      transition: all 200ms;
    }

    .cta-frame__btn:hover {
      background: #fbbf24;
      box-shadow: 0 0 30px var(--amber-glow);
      transform: translateY(-2px);
    }

    .cta-frame__btn:active {
      transform: translateY(0);
    }

    .cta-frame__ref {
      margin-top: 24px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--text-dim);
      letter-spacing: 1px;
    }

    /* ═══════════════════════════════════════════
       RESPONSIVE
       ═══════════════════════════════════════════ */

    @media (max-width: 640px) {
      .hero__bracket,
      .hero__coord {
        display: none;
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
    }

    /* ── Widescreen (1440px+) ── */
    @media (min-width: 1440px) {
      .features,
      .live-data,
      .how-it-works,
      .cta-footer {
        max-width: 1400px;
        margin-inline: auto;
        padding-inline: var(--space-8, 32px);
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
      }

      .stat-cell {
        padding: 56px 40px;
      }

      .cta-frame {
        max-width: 800px;
        padding: 64px 56px;
      }
    }

    /* ── Ultrawide (2560px+) ── */
    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%),
          var(--surface);
      }

      .features,
      .live-data,
      .how-it-works,
      .cta-footer {
        max-width: 1800px;
      }
    }
  `;

  @state() private _stats: PlatformStats | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._fetchStats();
    this._injectStructuredData();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    seoService.removeStructuredData();
  }

  private _injectStructuredData(): void {
    seoService.setStructuredData({
      '@context': 'https://schema.org',
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
    });
  }

  protected firstUpdated(): void {
    this._setupScrollAnimations();
    this._setupSectionTracking();
    this._setupSignalDecodeHero();
  }

  private async _fetchStats(): Promise<void> {
    try {
      const res = await fetch('/api/v1/public/platform-stats');
      if (res.ok) {
        const json = await res.json();
        this._stats = json.data;
      }
    } catch {
      // Stats are non-critical — show fallback
    }
  }

  private _setupScrollAnimations(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        }
      },
      { threshold: 0.15 },
    );

    const elements = this.renderRoot.querySelectorAll('.scroll-reveal');
    for (const el of elements) {
      observer.observe(el);
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
    this.dispatchEvent(new CustomEvent('landing-cta-click', {
      bubbles: true, composed: true,
      detail: { location },
    }));
  }

  private _setupSectionTracking(): void {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const section = (entry.target as HTMLElement).dataset.section;
            if (section) {
              this.dispatchEvent(new CustomEvent('landing-section-view', {
                bubbles: true, composed: true,
                detail: { section },
              }));
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
        ${this._renderLiveData()}
        ${this._renderHowItWorks()}
        ${this._renderCtaFooter()}
      </main>
    `;
  }

  private _renderHero() {
    const waveformBars = Array.from({ length: 24 }, (_, i) =>
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
            ${msg('Multiplayer Worldbuilding & Strategy Platform. Build civilizations. Deploy operatives. Shape the multiverse.')}
          </p>
          <div class="hero__cta-area">
            <a
              class="hero__cta"
              href="/register"
              @click=${(e: Event) => { e.preventDefault(); this._trackCta('hero'); this._navigate('/register'); }}
              aria-label=${msg('Enter the Multiverse — Create your account')}
            >
              ${msg('Enter the Multiverse')}
              <span class="hero__cta-arrow" aria-hidden="true">\u2192</span>
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

        <div class="hero__scroll-hint" aria-hidden="true">
          <span class="hero__scroll-text">${msg('Scroll')}</span>
          <div class="hero__scroll-line"></div>
        </div>
      </section>
    `;
  }

  /* Signal decode hero animation */
  private _setupSignalDecodeHero(): void {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const hero = this.renderRoot.querySelector('[data-hero="03"]') as HTMLElement | null;
    if (!hero) return;

    hero.classList.add('in-view');
    this._animateSignalDecode(hero);
  }

  private _animateSignalDecode(section: HTMLElement): void {
    const accentEl = section.querySelector('[data-decode-part="accent"]') as HTMLElement | null;
    const restEl = section.querySelector('[data-decode-part="rest"]') as HTMLElement | null;
    const progressFill = section.querySelector('.decode-progress__fill') as HTMLElement | null;
    const progressPct = section.querySelector('.decode-pct') as HTMLElement | null;

    if (!accentEl || !restEl) return;

    const targetAccent = 'Metaverse';
    const targetRest = '.Center';
    const scrambleChars = '\u2588\u2593\u2591\u2592\u2580\u2584\u258C\u2590';
    const totalSteps = 30;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / totalSteps;

      if (progressFill) progressFill.style.width = `${Math.round(progress * 100)}%`;
      if (progressPct) progressPct.textContent = `${Math.round(progress * 100)}%`;

      const accentRevealed = Math.floor(progress * targetAccent.length);
      const restRevealed = Math.floor(Math.max(0, (progress - 0.5) * 2) * targetRest.length);

      let accentText = '';
      for (let j = 0; j < targetAccent.length; j++) {
        accentText += j < accentRevealed
          ? targetAccent[j]
          : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
      accentEl.textContent = accentText;

      let restText = '';
      for (let j = 0; j < targetRest.length; j++) {
        restText += j < restRevealed
          ? targetRest[j]
          : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
      restEl.textContent = restText;

      if (step >= totalSteps) {
        clearInterval(interval);
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
                  ${msg('Create living worlds with AI-powered agents, sprawling cities, and evolving lore. Every simulation is a sovereign civilization with its own history.')}
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
                  ${msg('Join Epochs: strategic seasons where civilizations clash. Deploy spies, form alliances, betray rivals. Every decision reshapes the balance of power.')}
                </p>
                <div class="feature-card__ref">TIER-2 // ACTIVE</div>
              </div>
            </div>

            <div class="feature-card scroll-reveal" style="--i: 2">
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
                  ${msg('Real-world events ripple through the multiverse as Resonances. Earthquakes, elections, discoveries — the boundary between worlds is thinner than you think.')}
                </p>
                <div class="feature-card__ref">TIER-3 // ACTIVE</div>
              </div>
            </div>
          </div>
        </div>
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
                ${msg('Build a simulation with agents, buildings, and lore. Your world evolves through AI-driven conversations and events.')}
              </p>
            </div>

            <div class="step-connector scroll-reveal" style="--i: 0">
              <div class="step-connector__line"></div>
            </div>

            <div class="step scroll-reveal" style="--i: 1">
              <div class="step__badge">02</div>
              <h3 class="step__title">${msg('Join an Epoch')}</h3>
              <p class="step__desc">
                ${msg('Enter competitive seasons. Draft agents, deploy operatives, forge alliances — or betray them.')}
              </p>
            </div>

            <div class="step-connector scroll-reveal" style="--i: 1">
              <div class="step-connector__line"></div>
            </div>

            <div class="step scroll-reveal" style="--i: 2">
              <div class="step__badge">03</div>
              <h3 class="step__title">${msg('Shape the Multiverse')}</h3>
              <p class="step__desc">
                ${msg('Your actions ripple across worlds. Build embassies, establish connections, and leave your mark on the substrate.')}
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

            <p class="cta-frame__classification">${msg('Clearance Required')}</p>
            <h2 class="cta-frame__heading">${msg('Ready to Observe?')}</h2>
            <p class="cta-frame__text">
              ${msg('The Bureau is accepting new operatives. Your signal has been detected across the fracture. Request clearance to begin.')}
            </p>

            <a
              class="cta-frame__btn"
              href="/register"
              @click=${(e: Event) => { e.preventDefault(); this._trackCta('footer'); this._navigate('/register'); }}
              aria-label=${msg('Create your world — Sign up')}
            >
              ${msg('Create Your World')}
            </a>

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
