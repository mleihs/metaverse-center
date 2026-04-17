import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  ForgeAgentDraft,
  ForgeBuildingDraft,
  ForgeProgress,
  LorePhaseProgress,
} from '../../services/api/ForgeApiService.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { captureError } from '../../services/SentryService.js';
import { t } from '../../utils/locale-fields.js';

import '../shared/VelgGameCard.js';

/**
 * Cinematic "Dimensional Breach" ceremony after shard materialization.
 * Self-contained 5-stage sequence driven by a timer-based state machine.
 * Accepts data via properties — no coupling to ForgeStateManager.
 *
 * Fires `ceremony-enter` when the user clicks "Enter New Shard".
 */
@localized()
@customElement('velg-forge-ceremony')
export class VelgForgeCeremony extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* Tier 3 — primary amber opacity scale (adapts to sim theme) */
      --_p: var(--color-primary);
      --_p-90: color-mix(in srgb, var(--color-primary) 90%, transparent);
      --_p-85: color-mix(in srgb, var(--color-primary) 85%, transparent);
      --_p-80: color-mix(in srgb, var(--color-primary) 80%, transparent);
      --_p-70: color-mix(in srgb, var(--color-primary) 70%, transparent);
      --_p-60: color-mix(in srgb, var(--color-primary) 60%, transparent);
      --_p-50: color-mix(in srgb, var(--color-primary) 50%, transparent);
      --_p-40: color-mix(in srgb, var(--color-primary) 40%, transparent);
      --_p-30: color-mix(in srgb, var(--color-primary) 30%, transparent);
      --_p-25: color-mix(in srgb, var(--color-primary) 25%, transparent);
      --_p-20: color-mix(in srgb, var(--color-primary) 20%, transparent);
      --_p-15: color-mix(in srgb, var(--color-primary) 15%, transparent);
      --_p-10: color-mix(in srgb, var(--color-primary) 10%, transparent);
      --_p-5: color-mix(in srgb, var(--color-primary) 5%, transparent);
      --_p-3: color-mix(in srgb, var(--color-primary) 3%, transparent);
      --_p-2: color-mix(in srgb, var(--color-primary) 2%, transparent);
      /* Tier 3 — amber-hover (lighter amber for glow accents) */
      --_ph-90: color-mix(in srgb, var(--color-accent-amber-hover) 90%, transparent);
      --_ph-80: color-mix(in srgb, var(--color-accent-amber-hover) 80%, transparent);
      --_ph-40: color-mix(in srgb, var(--color-accent-amber-hover) 40%, transparent);
      --_ph-20: color-mix(in srgb, var(--color-accent-amber-hover) 20%, transparent);
      /* Tier 3 — amber-dim (dark amber for subtle warm tint) */
      --_pd-5: color-mix(in srgb, var(--color-accent-amber-dim) 5%, transparent);
    }

    /* ── Full-screen ceremony overlay ────────────── */

    .ceremony {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 500);
      background:
        radial-gradient(ellipse at center, var(--_p-3) 0%, transparent 60%),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 59px,
          var(--_p-2) 59px,
          var(--_p-2) 60px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 59px,
          var(--_p-2) 59px,
          var(--_p-2) 60px
        ),
        var(--color-surface-sunken);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      gap: var(--space-3, 0.75rem);
      padding:
        max(3vh, env(safe-area-inset-top))
        max(2vw, env(safe-area-inset-right))
        max(3vh, env(safe-area-inset-bottom))
        max(2vw, env(safe-area-inset-left));
    }

    /* Vignette for depth */
    .ceremony::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0 0 0 / 0.6) 100%); /* lint-color-ok — vignette */
      pointer-events: none;
      z-index: 0;
    }

    /* ── Stage 1: Blackout + Breach ─────────────── */

    .ceremony__flash {
      position: absolute;
      inset: 0;
      background: var(--color-text-primary);
      opacity: 0;
      pointer-events: none;
      z-index: 10;
    }

    .ceremony--stage-1 .ceremony__flash {
      animation: flash-bang 300ms ease-out forwards;
    }

    @keyframes flash-bang {
      0%   { opacity: 0; }
      10%  { opacity: 0.9; }
      30%  { opacity: 0; }
      100% { opacity: 0; }
    }

    .ceremony__crack {
      position: absolute;
      top: 0;
      left: 50%;
      width: 0;
      height: 100%;
      transform: translateX(-50%);
      background: var(--color-accent-amber);
      box-shadow:
        0 0 12px var(--_p-60),
        0 0 40px var(--_p-30);
      z-index: 2;
      transition: width 0.3s ease-out;
    }

    .ceremony--stage-1 .ceremony__crack {
      width: 2px;
      animation: crack-pulse 1.2s ease-in-out infinite;
    }

    .ceremony--stage-2 .ceremony__crack {
      width: 6px;
    }

    @keyframes crack-pulse {
      0%, 100% { box-shadow: 0 0 12px var(--_p-40), 0 0 40px var(--_p-15); }
      50%      { box-shadow: 0 0 20px var(--_p-80), 0 0 60px var(--_p-40); }
    }

    /* CSS shake for stage 1 */
    .ceremony--stage-1 {
      animation: stage-shake 0.15s linear infinite;
    }

    @keyframes stage-shake {
      0%   { transform: translate(0, 0); }
      25%  { transform: translate(1px, -1px); }
      50%  { transform: translate(-1px, 1px); }
      75%  { transform: translate(1px, 1px); }
      100% { transform: translate(-1px, -1px); }
    }

    /* ── CRT Scanlines (all stages) ──────────────── */

    .ceremony__crt {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 1px,
        rgba(0 0 0 / 0.08) 1px, /* lint-color-ok — scanline */
        rgba(0 0 0 / 0.08) 2px /* lint-color-ok — scanline */
      );
      pointer-events: none;
      z-index: 3;
      opacity: 1;
      transition: opacity 1s ease-out;
    }

    .ceremony--stage-5 .ceremony__crt {
      opacity: 0;
    }

    /* ── Stage 2: Dimensional Scan ──────────────── */

    .ceremony__scan {
      position: relative;
      z-index: 4;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6, 1.5rem);
      opacity: 0;
      transition: opacity 0.4s ease-out;
    }

    .ceremony--stage-2 .ceremony__scan {
      opacity: 1;
    }

    .ceremony--stage-3 .ceremony__scan,
    .ceremony--stage-4 .ceremony__scan,
    .ceremony--stage-5 .ceremony__scan {
      opacity: 0;
      pointer-events: none;
    }

    .ceremony__phase-text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-lg, 1.125rem);
      color: var(--color-accent-amber);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-shadow: 0 0 12px var(--_p-50);
      min-height: 1.5em;
      text-align: center;
    }

    .ceremony__cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: var(--color-accent-amber);
      margin-left: 4px;
      vertical-align: text-bottom;
      animation: cursor-blink 0.8s steps(1) infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }

    /* Signal lock pips */
    .ceremony__locks {
      display: flex;
      gap: var(--space-4, 1rem);
    }

    .ceremony__lock {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 0.5rem);
    }

    .ceremony__pip {
      width: 10px;
      height: 10px;
      border: 1px solid var(--_p-30);
      background: transparent;
      transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ceremony__pip--active {
      background: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 8px var(--_p-60);
    }

    .ceremony__lock-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--_p-50);
      transition: color 0.6s;
    }

    .ceremony__pip--active + .ceremony__lock-label,
    .ceremony__lock--active .ceremony__lock-label {
      color: var(--_p);
    }

    /* Sonar sweep (horizontal, amber) */
    .ceremony__sonar {
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: var(--color-accent-amber);
      box-shadow:
        0 0 8px var(--color-accent-amber),
        0 0 30px var(--_p-30);
      z-index: 1;
      opacity: 0;
    }

    .ceremony--stage-2 .ceremony__sonar {
      opacity: 1;
      animation: sonar-sweep 3s ease-in-out infinite;
    }

    @keyframes sonar-sweep {
      0%   { left: -2px; opacity: 1; }
      100% { left: calc(100% + 2px); opacity: 0.4; }
    }

    /* Particles */
    .ceremony__particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }

    .ceremony__particle {
      position: absolute;
      bottom: -10px;
      width: 4px;
      height: 4px;
      background: var(--color-accent-amber);
      border-radius: 50%;
      opacity: 0;
      filter: blur(1px);
    }

    .ceremony--stage-2 .ceremony__particle,
    .ceremony--stage-3 .ceremony__particle {
      animation: particle-rise 3s ease-out infinite;
    }

    /* Extended particles through stages 4-5 at lower opacity, slower pace */
    .ceremony--stage-4 .ceremony__particle,
    .ceremony--stage-5 .ceremony__particle {
      animation: particle-rise-slow 5s ease-out infinite;
    }

    @keyframes particle-rise {
      0%   { transform: translateY(0); opacity: 0; }
      15%  { opacity: 0.8; }
      85%  { opacity: 0.3; }
      100% { transform: translateY(-100vh); opacity: 0; }
    }

    @keyframes particle-rise-slow {
      0%   { transform: translateY(0); opacity: 0; }
      15%  { opacity: 0.4; }
      85%  { opacity: 0.15; }
      100% { transform: translateY(-100vh); opacity: 0; }
    }

    /* ── Stage 3: Materialization Burst ─────────── */

    .ceremony__burst {
      position: absolute;
      inset: 0;
      background: transparent;
      z-index: 5;
      pointer-events: none;
    }

    .ceremony--stage-3 .ceremony__burst {
      animation: amber-flash 400ms ease-out forwards;
    }

    @keyframes amber-flash {
      0%   { background: var(--_p-30); }
      100% { background: transparent; }
    }

    .ceremony--stage-3 .ceremony__crack {
      width: 100vw;
      background: transparent;
      box-shadow: none;
      transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ceremony--stage-4 .ceremony__crack,
    .ceremony--stage-5 .ceremony__crack {
      width: 0;
      opacity: 0;
    }

    /* ── Decorated Header ───────────────────────── */

    .ceremony__header {
      position: relative;
      z-index: 6;
      display: flex;
      align-items: center;
      gap: var(--space-3, 0.75rem);
      opacity: 0;
    }

    .ceremony--stage-3 .ceremony__header,
    .ceremony--stage-4 .ceremony__header,
    .ceremony--stage-5 .ceremony__header {
      opacity: 1;
      transition: opacity 0.6s ease-out 0.2s;
    }

    .ceremony__header-rule {
      flex: 0 0 40px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--_p-50), transparent);
      position: relative;
    }

    .ceremony__header-rule::before {
      content: '\u25C6';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 6px;
      color: var(--_p-60);
      line-height: 1;
    }

    .ceremony__header-rule:first-child::before {
      right: -2px;
    }

    .ceremony__header-rule:last-child::before {
      left: -2px;
    }

    .ceremony__header-text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 0.875rem);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--_p-85);
      text-shadow: 0 0 12px var(--_p-30);
      white-space: nowrap;
    }

    .ceremony--stage-3 .ceremony__header-text,
    .ceremony--stage-4 .ceremony__header-text,
    .ceremony--stage-5 .ceremony__header-text {
      animation: header-tracking-expand 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    @keyframes header-tracking-expand {
      from { letter-spacing: 0.05em; }
      to   { letter-spacing: 0.2em; }
    }

    /* ── Enhanced Shard Name ─────────────────────── */

    .ceremony__name {
      position: relative;
      z-index: 6;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2, 0.5rem);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.2rem, 4vw, 2.5rem);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-primary);
      text-align: center;
      opacity: 0;
      transform: scale(1.5);
      padding: 0 var(--space-6, 1.5rem);
      max-width: 80vw;
    }

    .ceremony--stage-3 .ceremony__name,
    .ceremony--stage-4 .ceremony__name,
    .ceremony--stage-5 .ceremony__name {
      opacity: 1;
      transform: scale(1);
      transition: opacity 0.5s ease-out, transform 0.8s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .ceremony__name-glow {
      position: absolute;
      inset: -40px;
      background: radial-gradient(ellipse at center, var(--_p-15) 0%, transparent 70%);
      z-index: -1;
      animation: name-glow-pulse 2.5s ease-in-out infinite;
    }

    @keyframes name-glow-pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50%      { opacity: 1; transform: scale(1.05); }
    }

    .ceremony__name-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      animation: name-text-breathe 3s ease-in-out infinite;
    }

    @keyframes name-text-breathe {
      0%, 100% { text-shadow: 0 0 8px var(--_p-20), 0 0 20px var(--_p-5); }
      50%      { text-shadow: 0 0 16px var(--_p-50), 0 0 40px var(--_p-15); }
    }

    .ceremony__name-ornament {
      font-size: 0.7em;
      color: var(--_p-60);
      opacity: 0;
      flex-shrink: 0;
    }

    .ceremony--stage-3 .ceremony__name-ornament,
    .ceremony--stage-4 .ceremony__name-ornament,
    .ceremony--stage-5 .ceremony__name-ornament {
      animation: ornament-fade 1s ease-out 0.4s forwards;
    }

    @keyframes ornament-fade {
      from { opacity: 0; transform: translateX(var(--ornament-dir, 8px)); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .ceremony__name-ornament:first-of-type {
      --ornament-dir: -8px;
    }

    .ceremony__name-ornament:last-of-type {
      --ornament-dir: 8px;
    }

    .ceremony__name-underline {
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      height: 1px;
      width: 0;
      background: linear-gradient(90deg, transparent, var(--_p-60), transparent);
    }

    .ceremony--stage-3 .ceremony__name-underline,
    .ceremony--stage-4 .ceremony__name-underline,
    .ceremony--stage-5 .ceremony__name-underline {
      animation: underline-draw 0.8s ease-out 0.6s forwards;
    }

    @keyframes underline-draw {
      from { width: 0; }
      to   { width: 80%; }
    }

    .ceremony__tagline {
      position: relative;
      z-index: 6;
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 0.875rem);
      color: var(--_p-85);
      letter-spacing: 0.05em;
      line-height: 1.6;
      min-height: 1.5em;
      text-align: center;
      max-width: 600px;
      padding: 0 var(--space-6, 1.5rem);
      margin-top: var(--space-4, 1rem);
    }

    /* ── Stage 4: Asset Reveal — Card Dealer Spread ── */

    .ceremony__card-area {
      position: relative;
      z-index: 6;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: var(--space-8, 2rem);
      width: 100%;
      max-width: 95vw;
      flex: 0 0 auto;
      margin-top: auto;
      margin-bottom: var(--space-4, 1rem);
      opacity: 0;
      overflow: visible;
    }

    .ceremony--stage-4 .ceremony__card-area,
    .ceremony--stage-5 .ceremony__card-area {
      opacity: 1;
      transition: opacity 0.3s ease-out;
    }

    .ceremony__fan {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 0.75rem);
    }

    .ceremony__fan-label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-muted);
      opacity: 0;
      transform: translateY(12px);
    }

    .ceremony--stage-4 .ceremony__fan-label,
    .ceremony--stage-5 .ceremony__fan-label {
      animation: stat-materialize 0.4s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .ceremony__fan:first-child .ceremony__fan-label { animation-delay: 0ms; }
    .ceremony__fan:last-child .ceremony__fan-label { animation-delay: 400ms; }

    @keyframes stat-materialize {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .ceremony__stat-number {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-2xl, 1.5rem);
    }

    .ceremony__stat-number--agents   { color: var(--color-success); }
    .ceremony__stat-number--buildings { color: var(--color-accent-amber); }
    .ceremony__stat-number--zones    { color: var(--color-info); }

    .ceremony__stat-label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    /* Zone divider badge */
    .ceremony__zone-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1, 0.25rem);
      padding: var(--space-4, 1rem) var(--space-2, 0.5rem);
      align-self: center;
      opacity: 0;
      transform: translateY(12px);
    }

    .ceremony--stage-4 .ceremony__zone-badge,
    .ceremony--stage-5 .ceremony__zone-badge {
      animation: stat-materialize 0.4s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) 200ms forwards;
    }

    .ceremony__fan-cards {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0 16px 16px;
      position: relative;
    }

    /* Stack wrapper for tiered fans */
    .ceremony__fan-stack {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* Back row: smaller — entities still emerging from the rift */
    .ceremony__fan-cards--back {
      transform: scale(0.88);
      z-index: 0;
      margin-bottom: -20px;
    }

    .ceremony__fan-cards--back .ceremony__card {
      opacity: 0.7;
      filter: brightness(0.8);
    }

    .ceremony__fan-cards--front {
      position: relative;
      z-index: 1;
    }

    /* Back row cards hover: fully materialize from the rift */
    .ceremony__fan-cards--back .ceremony__card:hover {
      opacity: 1 !important;
      filter: brightness(1) !important;
      transform: translateY(-12px) rotate(0deg) scale(1.15) !important;
      z-index: 10;
    }

    .ceremony__card {
      position: relative;
      opacity: 0;
      flex-shrink: 0;
      transition: transform 0.2s ease-out;
      transform-origin: bottom center;
    }

    .ceremony__card:hover {
      animation-play-state: paused !important;
      transform: translateY(-12px) rotate(0deg) scale(1.05) !important;
      z-index: 10;
    }

    .ceremony--stage-4 .ceremony__card {
      animation: card-deal 0.5s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    /* Card idle breathing in stage 5 */
    .ceremony--stage-5 .ceremony__card {
      animation:
        card-deal 0.5s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both,
        ceremony-card-idle 5s ease-in-out infinite both;
      animation-delay: var(--card-deal-delay, 0ms), calc(var(--card-deal-delay, 0ms) + 0.6s);
    }

    @keyframes card-deal {
      from {
        opacity: 0;
        transform: translateY(-30px) rotate(var(--card-rot, 0deg)) scale(0.85);
        filter: brightness(2);
      }
      to {
        opacity: 1;
        transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg));
        filter: brightness(1);
      }
    }

    @keyframes ceremony-card-idle {
      0%, 100% { transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg)); }
      50%      { transform: translateY(calc(var(--card-dip, 0px) - 2px)) rotate(var(--card-rot, 0deg)); }
    }

    /* Amber underglow on cards with images */
    .ceremony__card--has-image {
      filter: drop-shadow(0 4px 8px var(--_p-15));
    }

    /* Card image materialisation pop — dimensional breach */
    .ceremony__card--flash {
      animation: card-materialize-pop 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
    }

    .ceremony__card--flash::before {
      content: '';
      position: absolute;
      inset: -4px;
      border: 2px solid var(--_p-80);
      border-radius: 4px;
      pointer-events: none;
      z-index: 10;
      animation: card-shockwave 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    @keyframes card-materialize-pop {
      0% {
        transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg)) scale(1);
        filter: brightness(3) saturate(1.5)
                drop-shadow(0 0 20px var(--_p-80));
      }
      15% {
        transform: translateY(calc(var(--card-dip, 0px) - 18px)) rotate(var(--card-rot, 0deg)) scale(1.12);
        filter: brightness(2.2) saturate(1.3)
                drop-shadow(0 0 35px var(--_p-90))
                drop-shadow(0 0 60px var(--_ph-40));
      }
      35% {
        transform: translateY(calc(var(--card-dip, 0px) - 14px)) rotate(var(--card-rot, 0deg)) scale(1.08);
        filter: brightness(1.6) saturate(1.1)
                drop-shadow(0 0 25px var(--_p-60))
                drop-shadow(0 0 50px var(--_ph-20));
      }
      55% {
        transform: translateY(calc(var(--card-dip, 0px) + 3px)) rotate(var(--card-rot, 0deg)) scale(0.98);
        filter: brightness(1.15)
                drop-shadow(0 4px 12px var(--_p-30));
      }
      75% {
        transform: translateY(calc(var(--card-dip, 0px) - 2px)) rotate(var(--card-rot, 0deg)) scale(1.01);
        filter: brightness(1.05)
                drop-shadow(0 4px 10px var(--_p-20));
      }
      100% {
        transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg)) scale(1);
        filter: brightness(1)
                drop-shadow(0 4px 8px var(--_p-15));
      }
    }

    @keyframes card-shockwave {
      0% {
        inset: -4px;
        opacity: 0.9;
        border-color: var(--_ph-90);
        box-shadow: inset 0 0 12px var(--_p-30);
      }
      40% {
        inset: -20px;
        opacity: 0.5;
        border-color: var(--_p-50);
        box-shadow: inset 0 0 8px var(--_p-10);
      }
      100% {
        inset: -40px;
        opacity: 0;
        border-color: transparent;
        box-shadow: none;
      }
    }

    /* Ember underglow cascade — per-card rift glow */
    .ceremony--stage-5 .ceremony__card::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 10%;
      right: 10%;
      height: 8px;
      background: radial-gradient(ellipse at center, var(--_p-30) 0%, transparent 70%);
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
      animation: ember-cascade 5s ease-in-out infinite;
      animation-delay: calc(var(--card-deal-delay, 0ms) + 1.2s);
    }

    @keyframes ember-cascade {
      0%, 100% { opacity: 0.2; transform: scaleX(0.8); }
      50%      { opacity: 0.8; transform: scaleX(1.2); }
    }

    /* ── Lore Phase Readout ──────────────────────── */

    .ceremony__lore-phase {
      position: relative;
      z-index: 6;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1, 0.25rem);
      opacity: 0;
      transition: opacity 0.4s ease-out;
    }

    .ceremony--stage-4 .ceremony__lore-phase,
    .ceremony--stage-5 .ceremony__lore-phase {
      opacity: 1;
    }

    .ceremony__lore-phase--hidden {
      opacity: 0 !important;
      pointer-events: none;
    }

    .ceremony__lore-label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 0.75rem);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
      text-shadow: 0 0 8px var(--_p-40);
      text-align: center;
    }

    .ceremony__lore-title {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 0.75rem);
      font-style: italic;
      color: var(--_p-70);
      text-align: center;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ceremony__lore-dots {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 2px;
    }

    .ceremony__lore-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      border: 1px solid var(--_p-40);
      background: transparent;
      transition: background 0.3s ease-out, border-color 0.3s ease-out, box-shadow 0.3s ease-out;
    }

    .ceremony__lore-dot--done {
      background: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
    }

    .ceremony__lore-dot--active {
      background: var(--_p-50);
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 6px var(--_p-60);
      animation: lore-dot-pulse 1.2s ease-in-out infinite;
    }

    @keyframes lore-dot-pulse {
      0%, 100% { box-shadow: 0 0 4px var(--_p-30); opacity: 0.6; }
      50%      { box-shadow: 0 0 10px var(--_p-80); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ceremony__lore-dot--active {
        animation: none;
        opacity: 1;
      }
    }

    /* ── Redesigned Progress Bar ─────────────────── */

    .ceremony__progress {
      position: relative;
      z-index: 6;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      opacity: 0;
    }

    .ceremony--stage-4 .ceremony__progress,
    .ceremony--stage-5 .ceremony__progress {
      opacity: 1;
      transition: opacity 0.4s ease-out 1.5s;
    }

    .ceremony__progress-text {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--_p-70);
      display: flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
    }

    .ceremony__progress-pct {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-accent-amber);
      min-width: 3ch;
      text-align: right;
    }

    .ceremony__progress-bar {
      width: min(300px, 60vw);
      height: 6px;
      background: var(--_p-10);
      border: 1px solid var(--_p-15);
      overflow: hidden;
      position: relative;
    }

    .ceremony__progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-accent-amber-dim), var(--color-accent-amber), var(--color-accent-amber-hover));
      box-shadow: 0 0 8px var(--_p-60);
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
      position: relative;
    }

    .ceremony__progress-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255 255 255 / 0.4) 50%, transparent 100%); /* lint-color-ok — shimmer */
      animation: progress-shimmer 2s ease-in-out infinite;
    }

    @keyframes progress-shimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .ceremony__progress--done .ceremony__progress-text {
      color: var(--_p);
    }

    .ceremony__progress--done .ceremony__progress-fill {
      box-shadow: 0 0 16px var(--_p-80), 0 0 30px var(--_p-30);
      animation: progress-complete-flash 0.6s ease-out forwards;
    }

    .ceremony__progress--done .ceremony__progress-fill::after {
      animation: none;
      opacity: 0;
    }

    @keyframes progress-complete-flash {
      0%   { filter: brightness(2); }
      100% { filter: brightness(1); }
    }

    /* ── Background Atmosphere (stages 4-5) ──────── */

    .ceremony__aurora {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      opacity: 0;
      transition: opacity 1s ease-out;
    }

    .ceremony--stage-4 .ceremony__aurora,
    .ceremony--stage-5 .ceremony__aurora {
      opacity: 1;
    }

    .ceremony__aurora::before,
    .ceremony__aurora::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40%;
      animation: aurora-drift 12s ease-in-out infinite alternate;
    }

    .ceremony__aurora::before {
      background: radial-gradient(ellipse at 30% 0%, var(--_p-5) 0%, transparent 60%);
    }

    .ceremony__aurora::after {
      background: radial-gradient(ellipse at 70% 0%, var(--_pd-5) 0%, transparent 60%);
      animation-delay: -6s;
    }

    @keyframes aurora-drift {
      0%   { transform: translateX(-5%) translateY(0); }
      100% { transform: translateX(5%) translateY(3%); }
    }

    .ceremony__grid-pulse {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 59px,
          var(--_p-2) 59px,
          var(--_p-2) 60px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 59px,
          var(--_p-2) 59px,
          var(--_p-2) 60px
        );
      opacity: 0;
    }

    .ceremony--stage-4 .ceremony__grid-pulse,
    .ceremony--stage-5 .ceremony__grid-pulse {
      animation: grid-breathe 6s ease-in-out infinite;
    }

    @keyframes grid-breathe {
      0%, 100% { opacity: 0.3; }
      50%      { opacity: 0.8; }
    }

    /* ── Ready Flash Burst ──────────────────────── */

    .ceremony__ready-burst {
      position: absolute;
      inset: 0;
      background: transparent;
      pointer-events: none;
      z-index: 8;
    }

    .ceremony__ready-burst--active {
      animation: ready-burst-flash 1.2s ease-out forwards;
    }

    @keyframes ready-burst-flash {
      0%   { background: transparent; }
      30%  { background: var(--_p-15); }
      100% { background: transparent; }
    }

    /* ── Stage 5: Arrival ───────────────────────── */

    .ceremony__enter {
      position: relative;
      z-index: 6;
      opacity: 0;
      transform: translateY(12px);
      margin-top: auto;
      margin-bottom: var(--space-4, 1rem);
    }

    .ceremony__enter--ready {
      animation: btn-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes btn-entrance {
      0%   { opacity: 0; transform: translateY(12px); }
      70%  { transform: translateY(-3px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .ceremony__enter-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      padding: var(--space-4, 1rem) var(--space-10, 2.5rem);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-lg, 1.125rem);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-surface-sunken);
      background: var(--color-accent-amber);
      border: 2px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s ease-out;
      overflow: hidden;
    }

    .ceremony__enter--ready .ceremony__enter-btn {
      animation: btn-beacon 2.5s ease-in-out infinite;
    }

    @keyframes btn-beacon {
      0%, 100% {
        box-shadow:
          0 0 20px var(--_p-30),
          0 0 60px var(--_p-10),
          0 0 120px var(--_p-5);
      }
      50% {
        box-shadow:
          0 0 30px var(--_p-50),
          0 0 80px var(--_p-25),
          0 0 120px var(--_p-10);
      }
    }

    /* Surface shimmer */
    .ceremony__enter--ready .ceremony__enter-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255 255 255 / 0.3) 50%, transparent 100%); /* lint-color-ok — shimmer */
      animation: btn-shimmer 3s ease-in-out infinite;
    }

    @keyframes btn-shimmer {
      0%, 40%  { transform: translateX(-100%); }
      60%, 100% { transform: translateX(100%); }
    }

    /* Ring expand */
    .ceremony__enter--ready .ceremony__enter-btn::before {
      content: '';
      position: absolute;
      inset: -4px;
      border: 1px solid var(--_p-40);
      pointer-events: none;
      animation: btn-ring-expand 2.5s ease-out infinite;
    }

    @keyframes btn-ring-expand {
      0%   { inset: -4px; opacity: 0.6; }
      100% { inset: -20px; opacity: 0; }
    }

    .ceremony__enter-btn:hover {
      background: var(--color-accent-amber-hover);
      border-color: var(--color-accent-amber-hover);
      transform: translateY(-2px);
      box-shadow:
        0 0 40px var(--_p-60),
        0 0 80px var(--_p-30),
        0 0 120px var(--_p-15);
    }

    .ceremony__enter-btn:active {
      transform: translateY(0);
    }

    .ceremony__enter-btn--waiting {
      background: transparent;
      color: var(--_p-50);
      border-color: var(--_p-30);
      box-shadow: none;
      animation: none;
      cursor: default;
      overflow: visible;
    }

    .ceremony__enter-btn--waiting::after,
    .ceremony__enter-btn--waiting::before {
      display: none;
    }

    .ceremony__enter-btn--waiting:hover {
      background: transparent;
      border-color: var(--_p-30);
      transform: none;
      box-shadow: none;
    }

    /* ── Reduced Motion ─────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .ceremony--stage-1 {
        animation: none;
      }
      .ceremony--stage-1 .ceremony__flash {
        animation: none;
      }
      .ceremony__crack {
        animation: none !important;
      }
      .ceremony--stage-2 .ceremony__sonar {
        animation: none;
        opacity: 0;
      }
      .ceremony--stage-2 .ceremony__particle,
      .ceremony--stage-3 .ceremony__particle,
      .ceremony--stage-4 .ceremony__particle,
      .ceremony--stage-5 .ceremony__particle {
        animation: none;
      }
      .ceremony--stage-3 .ceremony__burst {
        animation: none;
      }
      .ceremony__name-glow {
        animation: none;
        opacity: 0.6;
      }
      .ceremony__name-label {
        animation: none;
        text-shadow: 0 0 12px var(--_p-30);
      }
      .ceremony__name-ornament {
        animation: none !important;
        opacity: 1;
        transform: none;
      }
      .ceremony__name-underline {
        animation: none !important;
        width: 80%;
      }
      .ceremony__cursor {
        animation: none;
        opacity: 1;
      }
      .ceremony--stage-3 .ceremony__header-text,
      .ceremony--stage-4 .ceremony__header-text,
      .ceremony--stage-5 .ceremony__header-text {
        animation: none;
        letter-spacing: 0.2em;
      }
      .ceremony--stage-4 .ceremony__fan-label,
      .ceremony--stage-5 .ceremony__fan-label {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony--stage-4 .ceremony__zone-badge,
      .ceremony--stage-5 .ceremony__zone-badge {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony--stage-4 .ceremony__card,
      .ceremony--stage-5 .ceremony__card {
        animation: none;
        opacity: 1;
      }
      .ceremony__card:hover {
        transition: none;
      }
      .ceremony__fan-cards--back {
        transform: scale(0.88);
      }
      .ceremony__fan-cards--back .ceremony__card {
        opacity: 0.7;
        filter: brightness(0.8);
      }
      .ceremony__card--flash {
        animation: none !important;
      }
      .ceremony__card--flash::before {
        display: none;
      }
      .ceremony--stage-5 .ceremony__card::after {
        animation: none;
        opacity: 0.4;
      }
      .ceremony__progress-fill::after {
        animation: none;
        display: none;
      }
      .ceremony__progress--done .ceremony__progress-fill {
        animation: none;
      }
      .ceremony--stage-4 .ceremony__progress,
      .ceremony--stage-5 .ceremony__progress {
        opacity: 1;
        transition: none;
      }
      .ceremony--stage-4 .ceremony__aurora,
      .ceremony--stage-5 .ceremony__aurora {
        display: none;
      }
      .ceremony__aurora::before,
      .ceremony__aurora::after {
        animation: none;
      }
      .ceremony--stage-4 .ceremony__grid-pulse,
      .ceremony--stage-5 .ceremony__grid-pulse {
        animation: none;
        display: none;
      }
      .ceremony__ready-burst--active {
        animation: none;
        display: none;
      }
      .ceremony__enter--ready {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony__enter--ready .ceremony__enter-btn {
        animation: none;
        box-shadow: 0 0 20px var(--_p-30);
      }
      .ceremony__enter--ready .ceremony__enter-btn::after,
      .ceremony__enter--ready .ceremony__enter-btn::before {
        animation: none;
        display: none;
      }
      .ceremony--stage-5 .ceremony__enter {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .ceremony__header {
        opacity: 1;
        transition: none;
      }
    }

    /* ── Responsive: Tablet ──────────────────────── */

    @media (max-width: 900px) {
      .ceremony__card-area {
        gap: var(--space-4, 1rem);
      }
      .ceremony__name {
        font-size: clamp(1rem, 5vw, 2rem);
      }
      /* Tablet: toned-down pop — single drop-shadow, smaller shockwave */
      .ceremony__card--flash {
        animation-name: card-materialize-pop-mobile;
      }
      .ceremony__card--flash::before {
        animation-name: card-shockwave-mobile;
      }
    }

    /* ── Responsive: Phone ───────────────────────── */

    @media (max-width: 480px) {
      .ceremony__card-area {
        flex-direction: column;
        align-items: center;
        gap: var(--space-3, 0.75rem);
      }
      .ceremony__zone-badge {
        flex-direction: row;
        padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
      }
      .ceremony__name {
        font-size: clamp(1rem, 6vw, 1.5rem);
      }
      .ceremony__fan-cards {
        padding: 0 8px 12px;
      }
      .ceremony__fan-cards--back {
        margin-bottom: -12px;
      }
    }

    /* Mobile/tablet materialisation — reduced scale, lift, and GPU load */
    @keyframes card-materialize-pop-mobile {
      0% {
        transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg)) scale(1);
        filter: brightness(2.5) saturate(1.3)
                drop-shadow(0 0 14px var(--_p-70));
      }
      15% {
        transform: translateY(calc(var(--card-dip, 0px) - 10px)) rotate(var(--card-rot, 0deg)) scale(1.06);
        filter: brightness(2) saturate(1.2)
                drop-shadow(0 0 22px var(--_p-80));
      }
      35% {
        transform: translateY(calc(var(--card-dip, 0px) - 8px)) rotate(var(--card-rot, 0deg)) scale(1.04);
        filter: brightness(1.5) saturate(1.1)
                drop-shadow(0 0 16px var(--_p-50));
      }
      55% {
        transform: translateY(calc(var(--card-dip, 0px) + 2px)) rotate(var(--card-rot, 0deg)) scale(0.99);
        filter: brightness(1.1)
                drop-shadow(0 4px 10px var(--_p-25));
      }
      75% {
        transform: translateY(calc(var(--card-dip, 0px) - 1px)) rotate(var(--card-rot, 0deg)) scale(1.005);
        filter: brightness(1.03)
                drop-shadow(0 4px 8px var(--_p-20));
      }
      100% {
        transform: translateY(var(--card-dip, 0px)) rotate(var(--card-rot, 0deg)) scale(1);
        filter: brightness(1)
                drop-shadow(0 4px 8px var(--_p-15));
      }
    }

    @keyframes card-shockwave-mobile {
      0% {
        inset: -3px;
        opacity: 0.8;
        border-color: var(--_ph-80);
        box-shadow: none;
      }
      40% {
        inset: -12px;
        opacity: 0.4;
        border-color: var(--_p-40);
        box-shadow: none;
      }
      100% {
        inset: -22px;
        opacity: 0;
        border-color: transparent;
        box-shadow: none;
      }
    }

    /* ── Phase 2: Short viewport (iPhone SE 667px) ── */

    @media (max-height: 700px) {
      .ceremony {
        overflow-y: auto;
        justify-content: flex-start;
      }
      .ceremony__name {
        font-size: clamp(0.9rem, 5vw, 1.3rem);
      }
      .ceremony__card-area {
        gap: var(--space-2, 0.5rem);
      }
    }

    /* ── Phase 2: Landscape phone ── */

    @media (orientation: landscape) and (max-height: 500px) {
      .ceremony {
        overflow-y: auto;
        justify-content: flex-start;
        gap: var(--space-1, 0.25rem);
      }
      .ceremony__card-area {
        flex-direction: row;
      }
    }

    /* ── Phase 2: GPU performance hints ── */

    .ceremony__particle {
      will-change: transform, opacity;
    }

    .ceremony__card {
      will-change: transform, opacity;
      contain: layout style;
    }

    .ceremony__aurora,
    .ceremony__grid-pulse {
      contain: strict;
    }

    .ceremony__progress-fill {
      will-change: width;
    }

    @media (prefers-reduced-motion: reduce) {
      .ceremony__particle,
      .ceremony__card,
      .ceremony__progress-fill {
        will-change: auto;
      }
      .ceremony__card {
        contain: none;
      }
      .ceremony__aurora,
      .ceremony__grid-pulse {
        contain: none;
      }
    }
  `;

  // ── Public properties ──────────────────────────

  @property() shardName = '';
  @property() slug = '';
  @property() seedPrompt = '';
  @property() anchorTitle = '';
  @property({ type: Array }) agents: ForgeAgentDraft[] = [];
  @property({ type: Array }) buildings: ForgeBuildingDraft[] = [];
  @property({ type: Number }) zoneCount = 0;

  // ── Internal state ─────────────────────────────

  @state() private _stage: 0 | 1 | 2 | 3 | 4 | 5 = 0;
  @state() private _scanPhase = 0;
  @state() private _typedText = '';
  @state() private _progress: ForgeProgress | null = null;
  @state() private _readyFlash = false;

  /** Names that already had images on the previous poll (used to detect new arrivals). */
  private _prevImageSet = new Set<string>();

  /** Names whose image just materialised this poll (triggers flash animation). */
  @state() private _freshImages = new Set<string>();

  private _timers: ReturnType<typeof setTimeout>[] = [];
  private _typeInterval: ReturnType<typeof setInterval> | null = null;
  private _scanInterval: ReturnType<typeof setInterval> | null = null;
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  // ── Phase labels (i18n) ────────────────────────

  private get _phaseLabels(): string[] {
    return [
      msg('Stabilizing Dimensional Anchor...'),
      msg('Weaving Reality Threads...'),
      msg('Calibrating Shard Geometry...'),
      msg('Locking Multiverse Coordinates...'),
    ];
  }

  private get _lockLabels(): string[] {
    return [msg('Anchor'), msg('Threads'), msg('Geometry'), msg('Coordinates')];
  }

  private get _tagline(): string {
    return this.seedPrompt || this.anchorTitle || '';
  }

  /** Minimum fraction of card width that must remain visible after overlap. */
  private static readonly _MIN_VISIBLE = 0.4;

  /**
   * Per-fan adaptive sizing. Picks card size and single-row vs two-tier
   * based on viewport width and card count.
   */
  private _fanLayout(count: number): {
    size: 'xs' | 'sm';
    width: number;
    rotStep: number;
    tiered: boolean;
  } {
    const vw = window.innerWidth;
    const mobile = vw <= 480;
    const tablet = vw <= 900 && vw > 480;
    // Overhead: zone badge (~52px) + 2 inter-fan gaps (64px) + fan-cards padding (32px each)
    const maxFan = mobile ? vw * 0.9 : (vw * 0.95 - 180) / 2;
    const candidates: readonly ('sm' | 'xs')[] =
      mobile || tablet ? (['xs'] as const) : (['sm', 'xs'] as const);

    for (const candidate of candidates) {
      const w = candidate === 'sm' ? 120 : 80;
      const rot = mobile ? 1.5 : tablet ? 2 : candidate === 'sm' ? 3 : 2.5;

      // Try single row: can all cards fit with ≥ MIN_VISIBLE fraction showing?
      if (count <= 1) {
        return { size: candidate, width: w, rotStep: rot, tiered: false };
      }
      const overlap = Math.max(0, (count * w - maxFan) / (count - 1));
      if (overlap <= w * (1 - VelgForgeCeremony._MIN_VISIBLE)) {
        return { size: candidate, width: w, rotStep: rot, tiered: false };
      }

      // Try two-tier: front row (ceil) + back row (floor)
      const frontCount = Math.ceil(count / 2);
      const overlapFront =
        frontCount > 1 ? Math.max(0, (frontCount * w - maxFan) / (frontCount - 1)) : 0;
      if (overlapFront <= w * (1 - VelgForgeCeremony._MIN_VISIBLE)) {
        return { size: candidate, width: w, rotStep: rot, tiered: true };
      }
    }

    // Fallback: xs tiered (always works for ≤15 per fan)
    return { size: 'xs', width: 80, rotStep: mobile ? 1 : 2, tiered: true };
  }

  // ── Lifecycle ──────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._startCeremony();
  }

  disconnectedCallback() {
    this._cleanup();
    super.disconnectedCallback();
  }

  private _startCeremony() {
    // Start polling immediately (background images may already be generating)
    this._startProgressPolling();

    // Check reduced motion preference — skip to final state
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._stage = 5;
      this._scanPhase = 3;
      this._typedText = this._tagline;
      return;
    }

    // Stage 1: Blackout + Breach (0–2s)
    this._stage = 1;

    // Stage 2: Dimensional Scan (2s–5s)
    this._timers.push(
      setTimeout(() => {
        this._stage = 2;
        this._startScanCycle();
      }, 2000),
    );

    // Stage 3: Materialization Burst (5s–7s)
    this._timers.push(
      setTimeout(() => {
        this._stage = 3;
        this._stopScanCycle();
        this._scanPhase = 3; // all pips locked
        this._startTypewriter();
      }, 5000),
    );

    // Stage 4: Asset Reveal (7s–10s)
    this._timers.push(
      setTimeout(() => {
        this._stage = 4;
      }, 7000),
    );

    // Stage 5: Arrival (10s+)
    this._timers.push(
      setTimeout(() => {
        this._stage = 5;
      }, 10000),
    );
  }

  private _startScanCycle() {
    this._scanPhase = 0;
    this._scanInterval = setInterval(() => {
      if (this._scanPhase < 3) {
        this._scanPhase++;
      }
    }, 750);
  }

  private _stopScanCycle() {
    if (this._scanInterval) {
      clearInterval(this._scanInterval);
      this._scanInterval = null;
    }
  }

  private _startTypewriter() {
    const text = this._tagline;
    if (!text) {
      this._typedText = '';
      return;
    }
    let i = 0;
    this._typedText = '';
    this._typeInterval = setInterval(() => {
      if (i < text.length) {
        this._typedText = text.slice(0, ++i);
      } else {
        if (this._typeInterval) {
          clearInterval(this._typeInterval);
          this._typeInterval = null;
        }
      }
    }, 40);
  }

  // ── Image Progress Polling ────────────────────

  private _startProgressPolling() {
    if (!this.slug) return;
    // Poll immediately, then every 4s
    this._pollProgress();
    this._pollInterval = setInterval(() => this._pollProgress(), 4000);
  }

  private async _pollProgress() {
    if (!this.slug) return;
    try {
      const resp = await forgeApi.getForgeProgress(this.slug);
      if (!resp.success || !resp.data) return;
      const progress = resp.data;

      // Detect newly arrived images for flash animation
      const currentSet = new Set<string>();
      for (const a of progress.agents) {
        if (a.image_url) currentSet.add(a.name);
      }
      for (const b of progress.buildings) {
        if (b.image_url) currentSet.add(b.name);
      }

      const fresh = new Set<string>();
      for (const name of currentSet) {
        if (!this._prevImageSet.has(name)) fresh.add(name);
      }
      this._prevImageSet = currentSet;

      // Only set fresh images if there are genuinely new ones (avoid clearing mid-animation)
      if (fresh.size > 0) {
        this._freshImages = fresh;

        // Haptic pulse on card materialisation (Android; iOS silently ignores)
        if ('vibrate' in navigator) navigator.vibrate(50);

        // On mobile column layout, scroll the fresh card into view —
        // but only once stage 5 is active (cards visible), so the user
        // sees the header/name reveal first without being yanked away.
        if (window.innerWidth <= 480 && this._stage >= 5) {
          requestAnimationFrame(() => {
            const el = this.shadowRoot?.querySelector('.ceremony__card--flash');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }

        // Clear flash class after animation completes
        setTimeout(() => {
          this._freshImages = new Set();
        }, 1500);
      }

      this._progress = progress;

      // When all images are done and we're past stage 5, stop polling and trigger ready flash
      if (progress.done && this._stage >= 5) {
        this._stopProgressPolling();
        this._readyFlash = true;
        // Victory haptic pattern (Android)
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
    } catch (err) {
      // Polling is best-effort — a failed tick doesn't block the ceremony.
      captureError(err, { source: 'VelgForgeCeremony._pollProgress' });
    }
  }

  private _stopProgressPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  private _cleanup() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    this._stopScanCycle();
    this._stopProgressPolling();
    if (this._typeInterval) {
      clearInterval(this._typeInterval);
      this._typeInterval = null;
    }
  }

  // ── Lore phase helpers ───────────────────────────

  private _lorePhaseLabel(lp: LorePhaseProgress): string {
    switch (lp.phase) {
      case 'research':
        return msg('Deep Research in Progress...');
      case 'generating':
        return msg('Inscribing the Lore Scroll...');
      case 'translating':
        return `${msg('Translating Section')} ${lp.current ?? 0}/${lp.total ?? 0}`;
      case 'entities':
        return msg('Translating Entities...');
      default:
        return '';
    }
  }

  // ── Event ──────────────────────────────────────

  private _handleEnter() {
    this.dispatchEvent(new CustomEvent('ceremony-enter', { bubbles: true, composed: true }));
  }

  // ── Render ─────────────────────────────────────

  protected render() {
    if (this._stage === 0) return nothing;

    // Build image URL lookup from progress data
    const agentImageMap = new Map<string, string>();
    const buildingImageMap = new Map<string, string>();
    if (this._progress) {
      for (const a of this._progress.agents) {
        if (a.image_url) agentImageMap.set(a.name, a.image_url);
      }
      for (const b of this._progress.buildings) {
        if (b.image_url) buildingImageMap.set(b.name, b.image_url);
      }
    }

    const agentCards = this.agents.map((a) => ({
      name: a.name,
      subtitle: t(a, 'primary_profession'),
      imageUrl: agentImageMap.get(a.name) ?? '',
    }));
    const buildingCards = this.buildings.map((b) => ({
      name: b.name,
      subtitle: t(b, 'building_type'),
      imageUrl: buildingImageMap.get(b.name) ?? '',
    }));

    const vw = window.innerWidth;
    const isMobile = vw <= 480;
    const maxFanWidth = isMobile ? vw * 0.9 : (vw * 0.95 - 180) / 2;
    const agentLayout = this._fanLayout(agentCards.length);
    const buildingLayout = this._fanLayout(buildingCards.length);

    const pct =
      this._progress && this._progress.total > 0
        ? Math.round((this._progress.completed / this._progress.total) * 100)
        : 0;

    type CardData = { name: string; subtitle: string; imageUrl: string };

    const renderFanCard = (
      c: CardData,
      i: number,
      total: number,
      dealOffset: number,
      layout: { size: 'xs' | 'sm'; width: number; rotStep: number },
      arcDipMultiplier = 5,
    ) => {
      const center = (total - 1) / 2;
      const rotDeg = (i - center) * layout.rotStep;
      const arcDip = Math.abs(i - center) * arcDipMultiplier;
      const naturalWidth = total * layout.width;
      const neededOverlap =
        total > 1 ? Math.max(28, (naturalWidth - maxFanWidth) / (total - 1)) : 0;
      const overlap = i === 0 ? 0 : -neededOverlap;
      const hasImage = !!c.imageUrl;
      const isFresh = this._freshImages.has(c.name);
      const dealDelay = (dealOffset + i) * 120;
      return html`
        <div
          class="ceremony__card ${hasImage ? 'ceremony__card--has-image' : ''} ${hasImage && isFresh ? 'ceremony__card--flash' : ''}"
          style="--card-rot: ${rotDeg}deg; --card-dip: ${arcDip}px; --card-deal-delay: ${dealDelay}ms; margin-left: ${overlap}px; animation-delay: ${dealDelay}ms"
        >
          <velg-game-card
            .name=${c.name}
            .subtitle=${c.subtitle}
            .rarity=${'common'}
            theme="brutalist"
            size=${layout.size}
            image-url=${c.imageUrl}
          ></velg-game-card>
        </div>
      `;
    };

    const renderFan = (
      cards: CardData[],
      layout: { size: 'xs' | 'sm'; width: number; rotStep: number; tiered: boolean },
      dealOffset: number,
      type: 'agents' | 'buildings',
    ) => {
      const labelHtml = html`
        <div class="ceremony__fan-label">
          <span class="ceremony__stat-number ceremony__stat-number--${type}">${cards.length}</span>
          ${type === 'agents' ? msg('Agents') : msg('Buildings')}
        </div>
      `;

      if (!layout.tiered) {
        return html`
          <div class="ceremony__fan">
            ${labelHtml}
            <div class="ceremony__fan-cards">
              ${cards.map((c, i) => renderFanCard(c, i, cards.length, dealOffset, layout))}
            </div>
          </div>
        `;
      }

      // Tiered: interleave for even name distribution across rows
      const frontCards: CardData[] = [];
      const backCards: CardData[] = [];
      for (let i = 0; i < cards.length; i++) {
        (i % 2 === 0 ? frontCards : backCards).push(cards[i]);
      }

      return html`
        <div class="ceremony__fan">
          ${labelHtml}
          <div class="ceremony__fan-stack">
            <div class="ceremony__fan-cards ceremony__fan-cards--back">
              ${backCards.map((c, i) => renderFanCard(c, i, backCards.length, dealOffset, layout, 3))}
            </div>
            <div class="ceremony__fan-cards ceremony__fan-cards--front">
              ${frontCards.map((c, i) => renderFanCard(c, i, frontCards.length, dealOffset + backCards.length, layout, 5))}
            </div>
          </div>
        </div>
      `;
    };

    return html`
      <div
        class="ceremony ceremony--stage-${this._stage}"
        role="status"
        aria-live="polite"
        aria-label=${msg('Materialization Complete')}
      >
        <!-- Flash overlay -->
        <div class="ceremony__flash"></div>

        <!-- CRT scanlines -->
        <div class="ceremony__crt"></div>

        <!-- Amber crack -->
        <div class="ceremony__crack"></div>

        <!-- Amber burst overlay (stage 3) -->
        <div class="ceremony__burst"></div>

        <!-- Sonar sweep -->
        <div class="ceremony__sonar"></div>

        <!-- Aurora corona (stages 4-5) -->
        <div class="ceremony__aurora"></div>

        <!-- Grid breathing overlay -->
        <div class="ceremony__grid-pulse"></div>

        <!-- Ready flash burst -->
        <div class="ceremony__ready-burst ${this._readyFlash ? 'ceremony__ready-burst--active' : ''}"></div>

        <!-- Particles -->
        <div class="ceremony__particles">
          ${[0, 1, 2, 3, 4, 5, 6, 7].map(
            (i) => html`
            <div
              class="ceremony__particle"
              style="left: ${12 + i * 11}%; animation-delay: ${i * 0.35}s; width: ${3 + (i % 3)}px; height: ${3 + (i % 3)}px;"
            ></div>
          `,
          )}
        </div>

        <!-- Stage 2: Scan readout -->
        <div class="ceremony__scan">
          <div class="ceremony__phase-text">
            ${this._phaseLabels[this._scanPhase] ?? ''}<span class="ceremony__cursor"></span>
          </div>
          <div class="ceremony__locks">
            ${this._lockLabels.map(
              (label, i) => html`
              <div class="ceremony__lock ${i <= this._scanPhase ? 'ceremony__lock--active' : ''}">
                <div class="ceremony__pip ${i <= this._scanPhase ? 'ceremony__pip--active' : ''}"></div>
                <span class="ceremony__lock-label">${label}</span>
              </div>
            `,
            )}
          </div>
        </div>

        <!-- Stage 3+: Decorated header -->
        <div class="ceremony__header">
          <div class="ceremony__header-rule" aria-hidden="true"></div>
          <span class="ceremony__header-text">${msg('Materialization Complete')}</span>
          <div class="ceremony__header-rule" aria-hidden="true"></div>
        </div>

        <!-- Stage 3+: Enhanced shard name -->
        <div class="ceremony__name">
          <div class="ceremony__name-glow"></div>
          <span class="ceremony__name-ornament" aria-hidden="true">\u27E8</span>
          <span class="ceremony__name-label">${this.shardName}</span>
          <span class="ceremony__name-ornament" aria-hidden="true">\u27E9</span>
          <div class="ceremony__name-underline" aria-hidden="true"></div>
        </div>

        <!-- Stage 3+: Tagline typewriter -->
        ${
          this._tagline
            ? html`<div class="ceremony__tagline">${this._typedText}<span class="ceremony__cursor"></span></div>`
            : nothing
        }

        <!-- Stage 4+: Card dealer spread -->
        <div class="ceremony__card-area">
          ${renderFan(agentCards, agentLayout, 0, 'agents')}

          <!-- Zone divider -->
          <div class="ceremony__zone-badge">
            <span class="ceremony__stat-number ceremony__stat-number--zones">${this.zoneCount}</span>
            <span class="ceremony__stat-label">${msg('Zones')}</span>
          </div>

          ${renderFan(buildingCards, buildingLayout, agentCards.length, 'buildings')}
        </div>

        <!-- Lore generation phase readout -->
        ${
          this._progress?.lore_progress && this._progress.lore_progress.phase !== 'images'
            ? html`
          <div
            class="ceremony__lore-phase"
            role="status"
            aria-live="polite"
            aria-label=${this._lorePhaseLabel(this._progress.lore_progress)}
          >
            <span class="ceremony__lore-label">
              ${this._lorePhaseLabel(this._progress.lore_progress)}
            </span>
            ${
              this._progress.lore_progress.phase === 'translating' &&
              this._progress.lore_progress.section_title
                ? html`<span class="ceremony__lore-title">${this._progress.lore_progress.section_title}</span>`
                : nothing
            }
            ${
              this._progress.lore_progress.phase === 'translating' &&
              (this._progress.lore_progress.total ?? 0) > 0
                ? html`
              <div class="ceremony__lore-dots" aria-hidden="true">
                ${Array.from({ length: this._progress.lore_progress.total! }, (_, i) => {
                  const current = this._progress?.lore_progress?.current ?? 0;
                  const isDone = i + 1 < current;
                  const isActive = i + 1 === current;
                  return html`<div class="ceremony__lore-dot ${isDone ? 'ceremony__lore-dot--done' : ''} ${isActive ? 'ceremony__lore-dot--active' : ''}"></div>`;
                })}
              </div>
            `
                : nothing
            }
          </div>
        `
            : nothing
        }

        <!-- Image materialization progress -->
        ${
          this._progress
            ? html`
          <div class="ceremony__progress ${this._progress.done ? 'ceremony__progress--done' : ''}">
            <div class="ceremony__progress-text">
              ${
                this._progress.done
                  ? msg('All Assets Materialized')
                  : html`${msg('Materializing')} ${this._progress.completed} / ${this._progress.total}`
              }
              <span class="ceremony__progress-pct">${pct}%</span>
            </div>
            <div class="ceremony__progress-bar">
              <div
                class="ceremony__progress-fill"
                style="width: ${this._progress.total > 0 ? (this._progress.completed / this._progress.total) * 100 : 0}%"
              ></div>
            </div>
          </div>
        `
            : nothing
        }

        <!-- Stage 5: Enter button -->
        <div class="ceremony__enter ${this._readyFlash ? 'ceremony__enter--ready' : ''}">
          ${
            this._readyFlash
              ? html`
              <button class="ceremony__enter-btn" @click=${this._handleEnter}>
                ${msg('Enter New Shard')} &ensp; &rarr;
              </button>
            `
              : html`
              <button class="ceremony__enter-btn ceremony__enter-btn--waiting" disabled>
                ${msg('Materializing Assets')} &ensp; &hellip;
              </button>
            `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-ceremony': VelgForgeCeremony;
  }
}
