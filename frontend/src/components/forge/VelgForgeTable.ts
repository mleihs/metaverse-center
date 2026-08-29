import { localized, msg, str } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ForgeAgentDraft,
  ForgeBuildingDraft,
  ForgeDraft,
} from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { t } from '../../utils/locale-fields.js';
import {
  forgeBackButtonStyles,
  forgeButtonStyles,
  forgeConsoleTypeTokens,
  forgeFieldStyles,
  forgeInfoBubbleStyles,
  forgeSectionStyles,
  forgeStatusStyles,
} from '../shared/forge-console-styles.js';
import { VelgToast } from '../shared/Toast.js';
import { agentCardView, buildingCardView, emptySlotLabel } from './forge-card-data.js';
import { getBuildingSet, getOperativeSet } from './forge-placeholders.js';
import { fanGeometry, fanTransform, renderInfoBubble } from './forge-utils.js';

import './VelgForgeActionBar.js';
import '../shared/VelgGameCard.js';
import '../shared/VelgSidePanel.js';
import './VelgForgeScanOverlay.js';

/**
 * Phase II: The Drafting Table.
 * Split-screen layout with deployment field + staging hand fan.
 */
@localized()
@customElement('velg-forge-table')
export class VelgForgeTable extends LitElement {
  static styles = [
    forgeConsoleTypeTokens,
    forgeButtonStyles,
    forgeBackButtonStyles,
    forgeFieldStyles,
    forgeStatusStyles,
    forgeSectionStyles,
    forgeInfoBubbleStyles,
    css`
      :host {
        display: block;

        /* Captured here, outside .deployment-field, on purpose. That rule
           re-points the platform surface tokens at a lighter slate so the game
           cards carry their own palette — and an empty slot sits inside it and
           inherited the same slate, turning the roster into a row of solid
           blue panels against a near-black console. An empty slot is an
           absence, not a card, so it takes the console's colours; these hold
           the platform values before the override applies. */
        --_slot-fill: var(--color-surface-sunken);
        --_slot-line: var(--color-border);
      }

      /* ── Command Console (3-panel grid) ─── */

      .command-console {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-4);
        margin-bottom: var(--space-8);
      }

      .command-panel {
        background: var(--color-surface);
        /* Der Zustand des Auftrags (bereit / laeuft / fertig) faerbt den
           ganzen Rahmen; vorher lag er als 3-px-Platte an der linken Kante,
           und Hover, Puls und Fertigmeldung faerbten alle nur diese Kante. */
        border: 1px solid var(--color-border);
        padding: var(--space-5) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        position: relative;
        overflow: hidden;
        transition: border-color 0.3s, background 0.3s;
      }

      .command-panel:hover {
        border-color: var(--color-icon);
        background: var(--color-surface);
      }

      /* Active (generating) state */
      .command-panel--active {
        border-color: var(--color-success);
        animation: panel-pulse 1.5s ease-in-out infinite;
      }

      .command-panel--active::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 100%;
        background: var(--color-success);
        box-shadow: 0 0 8px var(--color-success), 4px 0 30px rgba(74 222 128 / 0.15);
        animation: sonar-sweep 3s ease-in-out infinite;
      }

      @keyframes sonar-sweep {
        0% { left: 0; opacity: 0.8; }
        100% { left: 100%; opacity: 0; }
      }

      @keyframes panel-pulse {
        0%, 100% { border-color: var(--color-success); }
        50% { border-color: rgba(74 222 128 / 0.4); }
      }

      /* Complete state */
      .command-panel--complete {
        border-color: var(--color-success);
        background: rgba(74 222 128 / 0.07);
      }

      .command-panel__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .command-panel__division {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-tertiary);
      }

      .command-panel--active .command-panel__division {
        color: var(--color-success);
      }

      .command-panel--complete .command-panel__division {
        color: var(--color-success);
      }

      .command-panel__desc {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-text-tertiary);
        line-height: 1.5;
        margin: 0;
        flex: 1;
      }

      .command-panel__action {
        width: 100%;
        padding: var(--space-3) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold, 700);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.05em);
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.2s;
      }

      .command-panel__action:hover:not(:disabled) {
        background: var(--color-border);
        box-shadow: 0 0 12px rgba(74 222 128 / 0.15);
        border-color: var(--color-success);
      }

      .command-panel__action:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .command-panel--complete .command-panel__action {
        border-color: var(--color-border);
        color: var(--color-text-tertiary);
      }

      /* Line-flanked seal, not a rubber stamp: it settles in by opening its
         letterspacing rather than slamming down at 1.8x scale. */
      .command-panel__stamp {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold, 700);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest, 0.1em);
        color: var(--color-success);
        padding-top: var(--space-2);
        animation: seal-in var(--duration-entrance, 350ms) var(--ease-settle, ease-out) both;
      }

      .command-panel__stamp::before,
      .command-panel__stamp::after {
        content: '';
        flex: 1;
        height: var(--border-width-thin);
        background: color-mix(in srgb, var(--color-success) 45%, transparent);
      }

      @keyframes seal-in {
        from { opacity: 0; letter-spacing: 0.02em; }
        to   { opacity: 1; letter-spacing: var(--tracking-widest, 0.1em); }
      }

      /* ── Armed re-run (destructive confirm) ───── */

      .command-panel--armed {
        border-color: var(--color-danger);
        background: var(--color-danger-bg);
      }

      .command-panel--armed .command-panel__division {
        color: var(--color-danger);
      }

      .command-panel__warning {
        margin: 0;
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-readout);
        line-height: 1.5;
        color: var(--color-danger);
      }

      .command-panel__action--confirm {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }

      .command-panel__action--confirm:hover:not(:disabled) {
        background: var(--color-danger);
        border-color: var(--color-danger);
        color: var(--color-text-inverse);
        box-shadow: none;
      }

      .command-panel__cancel {
        background: none;
        border: none;
        padding: 0;
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest, 0.1em);
        color: var(--color-text-tertiary);
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }

      .command-panel__cancel:hover {
        color: var(--color-text-primary);
      }

      /* ── Inline progress (in the panel that was clicked) ───── */

      .command-panel__progress {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .command-panel__progress-track {
        flex: 1;
        height: var(--space-0-5);
        background: var(--color-border-light);
        overflow: hidden;
      }

      .command-panel__progress-fill {
        height: 100%;
        background: var(--color-success);
        transition: width var(--transition-slow, 300ms);
      }

      .command-panel__progress-fill--indeterminate {
        width: 35%;
        animation: progress-sweep 1.4s ease-in-out infinite;
      }

      @keyframes progress-sweep {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }

      .command-panel__progress-label {
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--color-success);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .command-panel__stamp {
          animation: none;
        }
        .command-panel__progress-fill--indeterminate {
          animation: none;
          width: 100%;
          opacity: 0.5;
        }
      }

      /* ── On-load attention pulse ────────── */

      .command-console--entering .command-panel {
        animation: panel-beckon 2s ease-in-out both;
      }

      .command-console--entering .command-panel:nth-child(2) {
        animation-delay: 250ms;
      }

      .command-console--entering .command-panel:nth-child(3) {
        animation-delay: 500ms;
      }

      @keyframes panel-beckon {
        0% {
          border-color: var(--color-text-muted);
          box-shadow: none;
        }
        25% {
          border-color: var(--color-success);
          box-shadow: inset 0 0 30px rgba(74 222 128 / 0.06), 0 0 16px rgba(74 222 128 / 0.12);
        }
        65% {
          border-color: var(--color-success);
          box-shadow: inset 0 0 30px rgba(74 222 128 / 0.06), 0 0 16px rgba(74 222 128 / 0.12);
        }
        100% {
          border-color: var(--color-text-muted);
          box-shadow: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .command-panel--active {
          animation: none;
        }
        .command-panel--active::before {
          animation: none;
        }
        .command-panel__stamp {
          animation: none;
        }
        .command-console--entering .command-panel {
          animation: none;
        }
      }

      @media (max-width: 767px) {
        .command-console {
          grid-template-columns: 1fr;
        }
      }

      /* ── Deployment Field ─────────────────── */

      .deployment-section {
        position: relative;
        margin-bottom: var(--space-10);
      }

      .deployment-section:has(velg-forge-scan-overlay[active]) {
        min-height: 340px;
      }

      .deployment-section velg-forge-scan-overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
        animation: overlay-fade-in 0.4s ease-out;
      }

      @keyframes overlay-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .section-empty {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: var(--space-8) var(--space-4);
        text-align: center;
        border: 1px dashed var(--color-border);
      }

      .section-reveal {
        animation: section-reveal-in 0.6s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes section-reveal-in {
        from {
          opacity: 0;
          transform: translateY(12px);
          filter: blur(4px);
        }
        60% {
          filter: blur(0);
        }
        to {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .section-reveal,
        .deployment-section velg-forge-scan-overlay {
          animation: none;
        }
      }

      .deployment-field {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--space-4);
        min-height: auto;
        /* Override source tokens so VelgGameCard :host picks up dark forge theme */
        --color-primary: #22c55e; // lint-color-ok
        --color-secondary: #14b8a6;
        --color-border: #556270;
        --color-surface-sunken: #1e293b;
        --color-surface: #283548;
        --color-text-primary: #f0f0f0;
        --color-text-secondary: #b0b0b0;
      }

      .deploy-slot {
        aspect-ratio: 5 / 8;
        border: 2px dashed var(--color-border);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        position: relative;
      }

      .deploy-slot--filled {
        border-style: solid;
        border-color: transparent;
      }

      .deploy-slot--drag-over {
        border-color: var(--color-success);
        background: rgba(74 222 128 / 0.05);
        box-shadow: 0 0 12px rgba(74 222 128 / 0.2);
        transform: scale(1.02);
      }

      /* ── Card back (a slot nothing has been dealt into) ───── */

      .card-back {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--_slot-fill);
        border: 1px dashed color-mix(in srgb, var(--_slot-line) 80%, transparent);
        overflow: hidden;
      }

      .card-back__weave {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          45deg,
          transparent 0 5px,
          color-mix(in srgb, var(--_slot-line) 45%, transparent) 5px 6px
        );
        opacity: 0.55;
      }

      /* A 45-degree lozenge, the same gem shape the fronts carry. */
      .card-back__sigil {
        width: var(--space-9);
        height: var(--space-9);
        transform: rotate(45deg);
        border: 1px solid color-mix(in srgb, var(--_slot-line) 90%, transparent);
        background: color-mix(in srgb, var(--_slot-line) 18%, transparent);
        position: relative;
      }

      .card-back__index {
        position: absolute;
        bottom: var(--space-2);
        right: var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        letter-spacing: var(--tracking-widest, 0.1em);
        color: var(--color-text-tertiary);
      }

      /* Slam animation on card placement */
      .deploy-slot--slam {
        animation: slot-slam 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes slot-slam {
        0% { transform: scale(1.15); }
        30% { transform: scale(0.92); }
        60% { transform: scale(1.04); }
        100% { transform: scale(1); }
      }

      /* Shockwave ring on slam */
      .deploy-slot--slam::after {
        content: '';
        position: absolute;
        inset: -8px;
        border: 2px solid var(--color-success);
        opacity: 0;
        animation: shockwave 0.6s cubic-bezier(0, 0, 0.2, 1);
      }

      @keyframes shockwave {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(1.3); opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .deploy-slot--slam {
          animation: none;
        }
        .deploy-slot--slam::after {
          animation: none;
        }
      }

      /* ── Counter Pips Divider ──────────────── */

      .counter-pips {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        padding: var(--space-4) 0;
        margin: var(--space-4) 0;
        border-top: 1px dashed var(--color-border);
        border-bottom: 1px dashed var(--color-border);
      }

      .counter-pips__pip {
        width: 12px;
        height: 19px;
        border: 1px solid var(--color-border);
        transition: all 0.3s;
      }

      .counter-pips__pip--filled {
        background: var(--color-success);
        border-color: var(--color-success);
        animation: pip-flip 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .counter-pips__pip--warning {
        background: var(--color-warning-bg);
        border-color: var(--color-warning);
        animation: pip-pulse-warning 1.5s ease-in-out infinite;
      }

      @keyframes pip-flip {
        0% { transform: rotateY(90deg); }
        100% { transform: rotateY(0deg); }
      }

      @keyframes pip-pulse-warning {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .counter-pips__pip--filled,
        .counter-pips__pip--warning {
          animation: none;
        }
      }

      /* ── Generation Failure Overlay ────────── */

      .generation-failed {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-8) var(--space-6);
        margin: var(--space-6) 0;
        border: 1px dashed var(--color-warning);
        background: var(--color-warning-bg);
        text-align: center;
        animation: failed-fade-in var(--duration-entrance) var(--ease-dramatic);
      }

      .generation-failed__icon {
        font-size: var(--text-3xl);
        color: var(--color-warning);
        line-height: 1;
      }

      .generation-failed__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-base);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-warning);
      }

      .generation-failed__detail {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        max-width: 400px;
      }

      @keyframes failed-fade-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .generation-failed { animation: none; }
      }

      .counter-pips__label {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-icon);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-left: var(--space-2);
      }

      /* ── Staging Hand (fan layout) ────────── */

      .staging-section {
        margin-top: var(--space-8);
        padding: var(--space-6);
        border: 1px dashed var(--color-success);
        background: rgba(74 222 128 / 0.03);
        /* Override source tokens for dark forge theme */
        --color-primary: #22c55e; // lint-color-ok
        --color-secondary: #14b8a6;
        --color-border: #556270;
        --color-surface-sunken: #1e293b;
        --color-surface: #283548;
        --color-text-primary: #f0f0f0;
        --color-text-secondary: #b0b0b0;
      }

      .staging-label {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-tertiary);
        margin-bottom: var(--space-4);
      }

      .staging-hint {
        font-weight: 400;
        color: var(--color-icon);
      }

      /* No perspective property here: it would make this row a containing
         block for fixed-position descendants, and each card already brings
         its own perspective wrapper. */
      .staging-hand {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: 0;
        padding: var(--space-6) 0 var(--space-4);
        min-height: 360px;
      }

      /* Last resort when even small cards at maximum overlap will not fit:
         the hand scrolls in its own track instead of pushing the page sideways. */
      .staging-hand--scrolling {
        justify-content: flex-start;
        overflow-x: auto;
        scrollbar-width: thin;
      }

      /* The horizontal offset is set per card from the measured fan geometry. */
      .staging-card {
        cursor: grab;
        transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        transform-origin: bottom center;
        position: relative;
        flex: 0 0 auto;
      }

      .staging-card:hover {
        z-index: 10;
        transform: translateY(-24px) scale(1.08) !important;
      }

      .staging-card--dragging {
        opacity: 0.5;
        cursor: grabbing;
      }

      /* Deal animation for staged cards */
      .staging-card--dealing {
        animation: hand-deal 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      @keyframes hand-deal {
        from {
          opacity: 0;
          transform: translateY(-40px) scale(0.85);
        }
        to {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .staging-card--dealing {
          animation: none;
        }
      }

      .staging-card__actions {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: var(--space-1);
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 5;
      }

      .staging-card:hover .staging-card__actions,
      .staging-card:focus-within .staging-card__actions {
        opacity: 1;
      }

      .staging-action {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition: all 0.15s;
        padding: 0;
      }

      .staging-action:hover {
        border-color: var(--color-success);
        color: var(--color-success);
      }

      .staging-action--reject:hover {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }

      /* ── Geography Section ─────────────────── */

      .geo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-4);
      }

      .geo-header__city {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-success);
      }

      .geo-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        animation: geo-reveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .geo-card:nth-child(1) { animation-delay: 0ms; }
      .geo-card:nth-child(2) { animation-delay: 100ms; }
      .geo-card:nth-child(3) { animation-delay: 200ms; }
      .geo-card:nth-child(4) { animation-delay: 300ms; }
      .geo-card:nth-child(5) { animation-delay: 400ms; }
      .geo-card:nth-child(6) { animation-delay: 500ms; }
      .geo-card:nth-child(7) { animation-delay: 600ms; }
      .geo-card:nth-child(8) { animation-delay: 700ms; }

      @keyframes geo-reveal {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .geo-card {
          animation: none;
        }
      }

      .geo-card__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.05em);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }

      .geo-card__desc {
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
        line-height: 1.5;
        margin: 0;
      }

      .geo-card__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-top: var(--space-1);
      }

      .geo-tag {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        padding: 2px var(--space-2);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-tertiary);
      }

      /* ── Side Panel (Dossier) ─────────────── */

      .dossier-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding: var(--space-6);
        /* Override source tokens for dark forge theme */
        --color-primary: #22c55e; // lint-color-ok
        --color-secondary: #14b8a6;
        --color-border: #556270;
        --color-surface-sunken: #1e293b;
        --color-surface: #283548;
        --color-text-primary: #f0f0f0;
        --color-text-secondary: #b0b0b0;
      }

      .dossier-panel__preview {
        display: flex;
        justify-content: center;
        padding-bottom: var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }

      .dossier-panel__section-label {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-success);
        margin-top: var(--space-2);
      }

      /* ── Responsive ──────────────────────── */

      @media (max-width: 640px) {
        .staging-hand {
          overflow-x: auto;
          justify-content: flex-start;
          padding: var(--space-4);
          min-height: auto;
        }

        .staging-card {
          margin-left: 0;
          flex-shrink: 0;
        }

        .deployment-field {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }
      }
    `,
  ];

  @state() private _draft: ForgeDraft | null = null;
  @state() private _isGenerating = false;
  @state() private _isRecovering = false;
  @state() private _generatingChunk: 'geography' | 'agents' | 'buildings' | null = null;
  @state() private _error: string | null = null;
  @state() private _editingEntity: { type: 'agent' | 'building'; index: number } | null = null;
  @state() private _mutationPrompt = '';
  @state() private _stagedAgents: ForgeAgentDraft[] = [];
  @state() private _stagedBuildings: ForgeBuildingDraft[] = [];
  @state() private _slamSlot: number | null = null;
  @state() private _dragOverSlot: number | null = null;
  @state() private _dealingIndex: number | null = null;
  /**
   * Which division has its destructive re-run armed, if any.
   *
   * Re-running a division does not add to what is there — it wipes the division
   * and starts over (`ForgeStateManager._generateEntitiesIncremental` clears the
   * entity list before the first request). One slot, so arming a second panel
   * disarms the first.
   */
  @state() private _armedPanel: 'geography' | 'agents' | 'buildings' | null = null;
  /** Width available to the staging fan, in px. Fed by a ResizeObserver. */
  @state() private _handWidth = 0;
  private _handObserver: ResizeObserver | null = null;
  @state() private _generationProgress: {
    entityType: 'agents' | 'buildings';
    current: number;
    total: number;
    currentEntityStartedAt: number | null;
  } | null = null;
  private _agentImages: string[] = [];
  private _buildingImages: string[] = [];

  private _disposeEffects: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._disposeEffects.push(
      effect(() => {
        const draft = forgeStateManager.draft.value;
        this._draft = draft;
        if (draft) {
          const seed = draft.seed_prompt ?? draft.id;
          const cfg = forgeStateManager.generationConfig.value;
          this._agentImages = getOperativeSet(cfg.agent_count, seed);
          this._buildingImages = getBuildingSet(cfg.building_count, `${seed}_bld`);
        }
      }),
      effect(() => {
        this._isGenerating = forgeStateManager.isGenerating.value;
      }),
      effect(() => {
        this._isRecovering = forgeStateManager.isRecovering.value;
      }),
      effect(() => {
        this._error = forgeStateManager.error.value;
      }),
      effect(() => {
        const staged = forgeStateManager.stagedAgents.value;
        if (staged.length > 0 && staged.length > this._stagedAgents.length) {
          this._dealingIndex = staged.length - 1;
          setTimeout(() => {
            this._dealingIndex = null;
          }, 600);
        }
        this._stagedAgents = staged;
      }),
      effect(() => {
        const staged = forgeStateManager.stagedBuildings.value;
        if (staged.length > 0 && staged.length > this._stagedBuildings.length) {
          this._dealingIndex = staged.length - 1;
          setTimeout(() => {
            this._dealingIndex = null;
          }, 600);
        }
        this._stagedBuildings = staged;
      }),
      effect(() => {
        this._generationProgress = forgeStateManager.generationProgress.value;
      }),
    );
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    this._handObserver?.disconnect();
    this._handObserver = null;
    // Leaving the phase disarms any pending overwrite.
    this._armedPanel = null;
    super.disconnectedCallback();
  }

  protected updated() {
    // The observer watches the host, which is the only element guaranteed to
    // exist when it is set up — but the fan's track is narrower than the host
    // by the section padding, and fitting against the host width is optimistic
    // by exactly that much. Once the track is on screen it measures itself.
    // Safe against a loop: the track is a flex row that fills its parent, so
    // its width does not depend on the geometry derived from it.
    const hand = this.renderRoot.querySelector('.staging-hand');
    if (hand) {
      const width = hand.clientWidth;
      if (width > 0 && Math.abs(width - this._handWidth) > 1) this._handWidth = width;
    }
  }

  protected firstUpdated() {
    // Draw the eye to the console with its own entrance rather than by moving
    // the page under the reader; the phase change already put them at the top.
    requestAnimationFrame(() => {
      const consolePanel = this.renderRoot.querySelector('.command-console');
      if (!consolePanel) return;
      consolePanel.classList.add('command-console--entering');
      setTimeout(() => {
        consolePanel.classList.remove('command-console--entering');
      }, 3000);
    });

    // The fan needs the width it actually has, not the width of the window.
    this._handObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(width - this._handWidth) > 1) this._handWidth = width;
    });
    this._handObserver.observe(this);
  }

  private get _geographyPhases(): string[] {
    return [
      msg('Surveying Dimensional Topology'),
      msg('Plotting Zone Boundaries'),
      msg('Charting Transit Corridors'),
      msg('Mapping Cartographic Anomalies'),
      msg('Measuring Spatial Distortions'),
      msg('Calculating Zone Resonance'),
      msg('Tracing Ley Line Networks'),
      msg('Cataloguing Terrain Signatures'),
      msg('Establishing Grid Reference'),
      msg('Probing Underground Formations'),
      msg('Scanning Atmospheric Layers'),
      msg('Detecting Boundary Phenomena'),
      msg('Reconciling Overlapping Geometries'),
      msg('Interpolating Missing Sectors'),
      msg('Validating Street Connectivity'),
      msg('Assigning Zone Classifications'),
      msg('Rendering Elevation Contours'),
      msg('Simulating Traffic Flow'),
      msg('Cross-Checking Dimensional Stability'),
      msg('Encoding Cartographic Metadata'),
      msg('Verifying Perimeter Integrity'),
      msg('Finalizing District Boundaries'),
      msg('Compiling Transit Route Index'),
      msg('Sampling Gravitational Gradients'),
      msg('Triangulating Subterranean Voids'),
      msg('Modeling Tidal Resonance Patterns'),
      msg('Scanning for Rift Anomalies'),
      msg('Classifying Microclimate Zones'),
      msg('Projecting Urban Expansion Vectors'),
      msg('Tracing Aquifer Networks'),
      msg('Correlating Seismic Activity'),
      msg('Indexing Flora Distribution'),
      msg('Calibrating Horizon Parallax'),
      msg('Sealing Cartographic Gaps'),
      msg('Committing Grid Coordinates'),
      msg('Measuring Shadow Azimuths'),
      msg('Indexing Acoustic Topology'),
      msg('Modeling Wind Corridor Drift'),
      msg('Detecting Phantom Intersections'),
      msg('Calibrating Compass Deviation'),
      msg('Surveying Liminal Thresholds'),
      msg('Projecting Population Density'),
      msg('Tracing Watershed Boundaries'),
      msg('Classifying Geological Strata'),
      msg('Encoding Navigational Beacons'),
      msg('Resolving Boundary Disputes'),
      msg('Validating Topographic Fidelity'),
      msg('Compressing Spatial Telemetry'),
      msg('Crystallizing City Grid'),
    ];
  }

  private get _agentPhases(): string[] {
    return [
      msg('Scanning Personnel Archives'),
      msg('Profiling Operative Candidates'),
      msg('Cross-Referencing Dossier Files'),
      msg('Analyzing Psychological Matrices'),
      msg('Evaluating Field Competencies'),
      msg('Assessing Loyalty Trajectories'),
      msg('Decrypting Background Records'),
      msg('Generating Cover Identities'),
      msg('Simulating Social Dynamics'),
      msg('Mapping Relationship Networks'),
      msg('Calibrating Personality Vectors'),
      msg('Stress-Testing Motivational Profiles'),
      msg('Verifying Operational Security'),
      msg('Assigning Specialization Codes'),
      msg('Computing Interpersonal Chemistry'),
      msg('Projecting Long-Term Allegiance'),
      msg('Drafting Psychological Briefs'),
      msg('Encoding Behavioral Signatures'),
      msg('Cross-Validating Skill Matrices'),
      msg('Reviewing Counter-Intelligence'),
      msg('Finalizing Clearance Levels'),
      msg('Compiling Operative Dossiers'),
      msg('Running Background Verification'),
      msg('Extracting Trauma Indicators'),
      msg('Modeling Decision Heuristics'),
      msg('Tracing Ideological Lineage'),
      msg('Evaluating Deception Resistance'),
      msg('Projecting Conflict Behavior'),
      msg('Synthesizing Persona Composites'),
      msg('Correlating Voice Pattern Data'),
      msg('Scoring Adaptability Quotient'),
      msg('Indexing Known Affiliations'),
      msg('Simulating Interrogation Scenarios'),
      msg('Sealing Personnel Dossiers'),
      msg('Committing Roster Manifest'),
      msg('Profiling Sleep Cycle Anomalies'),
      msg('Mapping Subconscious Triggers'),
      msg('Evaluating Moral Flexibility'),
      msg('Correlating Field Incident Reports'),
      msg('Simulating Loyalty Under Duress'),
      msg('Projecting Career Trajectory'),
      msg('Tracing Handler Lineage'),
      msg('Indexing Linguistic Competencies'),
      msg('Measuring Stress Tolerance Ceiling'),
      msg('Encoding Biometric Baselines'),
      msg('Scanning for Double Agents'),
      msg('Validating Cover Story Integrity'),
      msg('Compiling Final Assessments'),
      msg('Assembling Operative Roster'),
    ];
  }

  private get _buildingPhases(): string[] {
    return [
      msg('Analyzing Structural Foundations'),
      msg('Drafting Architectural Blueprints'),
      msg('Calculating Load-Bearing Vectors'),
      msg('Simulating Infrastructure Networks'),
      msg('Surveying Construction Materials'),
      msg('Evaluating Structural Integrity'),
      msg('Modeling Utility Distribution'),
      msg('Assessing Defensive Potential'),
      msg('Computing Spatial Efficiency'),
      msg('Designing Emergency Protocols'),
      msg('Integrating Zone Infrastructure'),
      msg('Calibrating Environmental Systems'),
      msg('Projecting Maintenance Requirements'),
      msg('Verifying Building Codes'),
      msg('Mapping Service Access Points'),
      msg('Simulating Occupancy Patterns'),
      msg('Testing Structural Resonance'),
      msg('Encoding Architectural DNA'),
      msg('Cross-Referencing Zoning Data'),
      msg('Rendering Interior Schematics'),
      msg('Validating Construction Feasibility'),
      msg('Finalizing Utility Connections'),
      msg('Compiling Engineering Reports'),
      msg('Modeling Acoustic Propagation'),
      msg('Tracing Ventilation Pathways'),
      msg('Projecting Thermal Envelope'),
      msg('Classifying Hazard Zones'),
      msg('Simulating Evacuation Routes'),
      msg('Evaluating Fortification Rating'),
      msg('Mapping Substructure Conduits'),
      msg('Indexing Material Stress Limits'),
      msg('Scanning for Structural Fatigue'),
      msg('Correlating Foundation Drift'),
      msg('Sealing Blueprint Archives'),
      msg('Committing Construction Orders'),
      msg('Analyzing Load Distribution Curves'),
      msg('Modeling Seismic Dampening'),
      msg('Tracing Electrical Grid Layout'),
      msg('Projecting Facade Weathering'),
      msg('Classifying Structural Redundancy'),
      msg('Evaluating Blast Resistance'),
      msg('Mapping Emergency Egress Routes'),
      msg('Indexing Material Provenance'),
      msg('Simulating Long-Term Settlement'),
      msg('Encoding Maintenance Schedules'),
      msg('Calibrating HVAC Flow Dynamics'),
      msg('Validating Fire Compartmentation'),
      msg('Compiling Structural Manifest'),
      msg('Materializing Structural Footprint'),
    ];
  }

  /**
   * How many drafted entities a re-run of `type` would destroy.
   *
   * Everything the division has produced is lost, not just the cards still
   * waiting in the staging hand: the roster on the table was written by the same
   * run and is cleared with it.
   */
  private _discardCount(type: 'agents' | 'buildings' | 'geography'): number {
    if (type === 'agents') return this._draft?.agents.length ?? 0;
    if (type === 'buildings') return this._draft?.buildings.length ?? 0;
    const zones = (this._draft?.geography as { zones?: unknown[] } | undefined)?.zones;
    return zones?.length ?? 0;
  }

  /**
   * Entry point for every division button.
   *
   * A first run goes straight through. A re-run is destructive, so it arms
   * instead of firing and the second click confirms.
   */
  private _requestChunk(type: 'agents' | 'buildings' | 'geography', isComplete: boolean) {
    if (!isComplete) {
      this._armedPanel = null;
      this._generateChunk(type);
      return;
    }

    if (this._armedPanel !== type) {
      this._armedPanel = type;
      return;
    }

    this._armedPanel = null;
    this._generateChunk(type);
  }

  private async _generateChunk(type: 'agents' | 'buildings' | 'geography') {
    this._generatingChunk = type;
    await forgeStateManager.generateChunk(type);
    this._generatingChunk = null;

    if (!forgeStateManager.error.value) {
      const toastMsg = forgeStateManager.lastGenerationRecovered.value
        ? msg('Signal recovered – blueprints retrieved from Bureau archives')
        : msg('Blueprint expanded successfully.');
      VelgToast.success(toastMsg);
    } else {
      VelgToast.error(msg('Failed to generate blueprint chunk.'));
    }
  }

  /**
   * Move one card from the staging hand onto the table.
   *
   * The slam lands on the slot the card takes, so structures animate their own
   * field rather than the operative slot with the same ordinal.
   */
  private _acceptEntity(kind: 'agent' | 'building', index: number) {
    const slotBase = kind === 'agent' ? 0 : 100;
    this._slamSlot = slotBase + index;
    setTimeout(() => {
      this._slamSlot = null;
    }, 500);
    forgeStateManager.acceptEntity(kind, index);
  }

  private _handleDragStart(e: DragEvent, type: 'agent' | 'building', index: number) {
    e.dataTransfer?.setData('text/plain', JSON.stringify({ type, index }));
  }

  private _handleDragOver(e: DragEvent, slotIdx: number) {
    e.preventDefault();
    this._dragOverSlot = slotIdx;
  }

  private _handleDragLeave() {
    this._dragOverSlot = null;
  }

  private _handleDrop(e: DragEvent, _slotIdx: number) {
    e.preventDefault();
    this._dragOverSlot = null;
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    try {
      const { type, index } = JSON.parse(raw);
      this._slamSlot = _slotIdx;
      setTimeout(() => {
        this._slamSlot = null;
      }, 500);
      if (type === 'agent') {
        forgeStateManager.acceptEntity('agent', index);
      } else {
        forgeStateManager.acceptEntity('building', index);
      }
    } catch (err) {
      // Malformed drag payload — ignore; drop is a no-op when parsing fails.
      captureError(err, { source: 'VelgForgeTable._handleDrop' });
    }
  }

  private _updateEntity(type: 'agent' | 'building', index: number, field: string, value: string) {
    const draft = this._draft;
    if (!draft) return;

    if (type === 'agent') {
      const agents = [...draft.agents];
      agents[index] = { ...agents[index], [field]: value };
      forgeStateManager.updateDraft({ agents });
    } else {
      const buildings = [...draft.buildings];
      buildings[index] = { ...buildings[index], [field]: value };
      forgeStateManager.updateDraft({ buildings });
    }
  }

  private _openCardEdit(type: 'agent' | 'building', index: number) {
    this._editingEntity = { type, index };
    this._mutationPrompt = '';
  }

  private async _handleMutation() {
    VelgToast.info(
      msg('AI-driven entity mutation is a Phase 2 enhancement. Use manual edits for now.'),
    );
    this._editingEntity = null;
  }

  private _handleBack() {
    forgeStateManager.updateDraft({ current_phase: 'astrolabe' });
  }

  private _handleNext() {
    forgeStateManager.updateDraft({ current_phase: 'darkroom' });
  }

  protected render() {
    if (!this._draft) return nothing;

    const geo = this._draft.geography as {
      city_name?: string;
      zones?: { name: string; description: string; characteristics?: string[] }[];
      streets?: { name: string; description: string; characteristics?: string[] }[];
    };

    const agents = this._draft.agents;
    const buildings = this._draft.buildings;
    const genConfig = forgeStateManager.generationConfig.value;

    const hasGeo = !!geo?.zones?.length;
    const hasAgents = agents.length > 0;
    const hasBuildings = buildings.length > 0;
    const allComplete = hasGeo && hasAgents && hasBuildings;

    // Detect partial generation failure per section
    const hasFailed = !!this._error && !this._isGenerating;
    const agentsFailed =
      hasFailed &&
      agents.length < genConfig.agent_count &&
      this._error?.toLowerCase().includes('entities');
    const buildingsFailed =
      hasFailed &&
      buildings.length < genConfig.building_count &&
      buildings.length > 0 &&
      !agentsFailed;
    // Show generic banner for geography/other failures not handled by section overlays
    const showGenericError = hasFailed && !agentsFailed && !buildingsFailed;

    return html`
      ${
        showGenericError
          ? html`
        <div class="generation-failed" role="alert" style="margin-bottom: var(--space-6)">
          <div class="generation-failed__icon">\u26A0</div>
          <div class="generation-failed__title">${msg('Generation Error')}</div>
          <div class="generation-failed__detail">${this._error}</div>
        </div>
      `
          : nothing
      }

      <div class="command-console">
        ${this._renderCommandPanel({
          type: 'geography',
          division: msg('Cartographic Division'),
          description: msg(
            'Survey dimensional topology and chart transit corridors from your seed vision.',
          ),
          actionLabel: msg('Initiate Survey'),
          regenLabel: msg('Re-scan'),
          stampLabel: msg('Surveyed'),
          infoText: msg(
            'Surveys dimensional topology and charts transit corridors based on your seed vision.',
          ),
          infoExample: msg(
            'Generates 5 zones and 5 streets with unique names and characteristics.',
          ),
          isComplete: hasGeo,
          isActive: this._generatingChunk === 'geography',
          isGenerating: this._isGenerating,
        })}
        ${this._renderCommandPanel({
          type: 'agents',
          division: msg('Personnel Bureau'),
          description: msg(
            'Recruit operative candidates – AI-generated characters with names, professions, and backstories.',
          ),
          actionLabel: msg('Begin Recruitment'),
          regenLabel: msg('Re-draft'),
          stampLabel: msg('Recruited'),
          infoText: msg(
            'Recruits operative candidates – AI-generated characters with names, professions, and backstories.',
          ),
          infoExample: msg('Drafts 6 agents that appear in your staging hand for review.'),
          isComplete: hasAgents,
          isActive: this._generatingChunk === 'agents',
          isGenerating: this._isGenerating,
        })}
        ${this._renderCommandPanel({
          type: 'buildings',
          division: msg('Infrastructure Corps'),
          description: msg("Engineer structural blueprints for the simulation's key locations."),
          actionLabel: msg('Draft Blueprints'),
          regenLabel: msg('Re-draft'),
          stampLabel: msg('Blueprinted'),
          infoText: msg("Engineers structural blueprints for the simulation's key locations."),
          infoExample: msg('Creates 7 buildings with types, descriptions, and zone assignments.'),
          isComplete: hasBuildings,
          isActive: this._generatingChunk === 'buildings',
          isGenerating: this._isGenerating,
        })}
      </div>

      <!-- Cartographic Survey -->
      <div class="deployment-section section--geography">
        <h2 class="section-title">
          <span style="display:flex;align-items:baseline;gap:var(--space-3)">
            ${msg('Cartographic Survey')}
            ${geo?.city_name ? html`<span class="geo-header__city">// ${geo.city_name}</span>` : nothing}
          </span>
        </h2>

        ${
          geo?.zones?.length
            ? html`
          <div class="geo-grid section-reveal">
            ${geo.zones.map(
              (z) => html`
              <div class="geo-card">
                <div class="geo-card__name">${z.name}</div>
                <p class="geo-card__desc">${t(z, 'description')}</p>
                ${
                  Array.isArray(z.characteristics) && z.characteristics.length
                    ? html`<div class="geo-card__tags">${z.characteristics.map((c) => html`<span class="geo-tag">${c}</span>`)}</div>`
                    : nothing
                }
              </div>
            `,
            )}
          </div>

          ${
            geo.streets?.length
              ? html`
            <h2 class="section-title">${msg('Transit Arteries')}</h2>
            <div class="geo-grid section-reveal">
              ${geo.streets.map(
                (s) => html`
                <div class="geo-card">
                  <div class="geo-card__name">${s.name}</div>
                  <p class="geo-card__desc">${t(s, 'description')}</p>
                  ${
                    Array.isArray(s.characteristics) && s.characteristics.length
                      ? html`<div class="geo-card__tags">${s.characteristics.map((c) => html`<span class="geo-tag">${c}</span>`)}</div>`
                      : nothing
                  }
                </div>
              `,
              )}
            </div>
          `
              : nothing
          }
        `
            : html`
          <div class="section-empty">${msg('Awaiting cartographic survey...')}</div>
        `
        }

        ${
          this._generatingChunk === 'geography'
            ? html`
          <velg-forge-scan-overlay
            active
            ?recovering=${this._isRecovering}
            .phases=${this._geographyPhases}
            .lockLabels=${[msg('Zones'), msg('Streets'), msg('Grid')]}
            headerLabel=${msg('Dimensional Cartography Division')}
            .echoText=${this._draft?.seed_prompt ?? ''}
            .estimatedDurationMs=${forgeStateManager.getEstimatedDuration('geography')}
          ></velg-forge-scan-overlay>
        `
            : nothing
        }
      </div>

      <!-- Operative Roster -->
      <div class="deployment-section section--agents">
        <h2 class="section-title">${msg('Operative Roster')}</h2>

        ${this._renderDeploymentField('agent')}

        ${this._renderCounterPips(agents.length, genConfig.agent_count, msg('Agents Drafted'), agentsFailed)}

        ${agentsFailed ? this._renderGenerationFailed('agents') : nothing}

        ${this._renderStagingHand('agent')}

        ${
          this._generatingChunk === 'agents'
            ? html`
          <velg-forge-scan-overlay
            active
            ?recovering=${this._isRecovering}
            .phases=${this._agentPhases}
            .lockLabels=${[msg('Psych'), msg('Skills'), msg('Cover')]}
            headerLabel=${msg('Bureau Personnel Division')}
            .entityCurrent=${this._generationProgress?.entityType === 'agents' ? this._generationProgress.current : -1}
            .entityTotal=${this._generationProgress?.entityType === 'agents' ? this._generationProgress.total : 0}
            .estimatedDurationMs=${this._generationProgress?.entityType === 'agents' ? forgeStateManager.getEstimatedDuration('agents_entity') : forgeStateManager.getEstimatedDuration('agents')}
          ></velg-forge-scan-overlay>
        `
            : nothing
        }
      </div>

      <!-- Architectural Footprint -->
      <div class="deployment-section section--buildings">
        <h2 class="section-title">${msg('Architectural Footprint')}</h2>

        ${this._renderDeploymentField('building')}

        ${this._renderCounterPips(buildings.length, genConfig.building_count, msg('Buildings Drafted'), buildingsFailed)}

        ${buildingsFailed ? this._renderGenerationFailed('buildings') : nothing}

        ${this._renderStagingHand('building')}

        ${
          this._generatingChunk === 'buildings'
            ? html`
          <velg-forge-scan-overlay
            active
            ?recovering=${this._isRecovering}
            .phases=${this._buildingPhases}
            .lockLabels=${[msg('Base'), msg('Frame'), msg('Roof')]}
            headerLabel=${msg('Infrastructure Engineering Corps')}
            .entityCurrent=${this._generationProgress?.entityType === 'buildings' ? this._generationProgress.current : -1}
            .entityTotal=${this._generationProgress?.entityType === 'buildings' ? this._generationProgress.total : 0}
            .estimatedDurationMs=${this._generationProgress?.entityType === 'buildings' ? forgeStateManager.getEstimatedDuration('buildings_entity') : forgeStateManager.getEstimatedDuration('buildings')}
          ></velg-forge-scan-overlay>
        `
            : nothing
        }
      </div>

      <velg-forge-action-bar
        back-label=${msg('Return to Astrolabe')}
        next-label=${msg('Calibrate Darkroom')}
        ?next-disabled=${!allComplete}
        hint=${msg('Complete all three divisions to advance')}
        .readiness=${[
          {
            label: msg('districts'),
            done: geo?.zones?.length ?? 0,
            total: genConfig.zone_count,
          },
          { label: msg('operatives'), done: agents.length, total: genConfig.agent_count },
          { label: msg('structures'), done: buildings.length, total: genConfig.building_count },
        ]}
        @forge-back=${this._handleBack}
        @forge-next=${this._handleNext}
      ></velg-forge-action-bar>

      ${this._renderDossierPanel()}
    `;
  }

  private _removeEntity(kind: 'agent' | 'building', index: number) {
    if (kind === 'agent') {
      const agents = [...(this._draft?.agents ?? [])];
      agents.splice(index, 1);
      forgeStateManager.updateDraft({ agents });
      return;
    }
    const buildings = [...(this._draft?.buildings ?? [])];
    buildings.splice(index, 1);
    forgeStateManager.updateDraft({ buildings });
  }

  private _getEditingEntity(): ForgeAgentDraft | ForgeBuildingDraft | null {
    if (!this._editingEntity || !this._draft) return null;
    const { type, index } = this._editingEntity;
    if (type === 'agent') return this._draft.agents[index] ?? null;
    return this._draft.buildings[index] ?? null;
  }

  /** The drafted entities of one kind, in table order. */
  private _entities(kind: 'agent' | 'building'): (ForgeAgentDraft | ForgeBuildingDraft)[] {
    return kind === 'agent' ? (this._draft?.agents ?? []) : (this._draft?.buildings ?? []);
  }

  /** Placeholder artwork for one kind, indexed as the table lays it out. */
  private _artwork(kind: 'agent' | 'building'): string[] {
    return kind === 'agent' ? this._agentImages : this._buildingImages;
  }

  /** Map one drafted entity onto the card, by kind. */
  private _cardView(kind: 'agent' | 'building', item: ForgeAgentDraft | ForgeBuildingDraft) {
    return kind === 'agent'
      ? agentCardView(item as ForgeAgentDraft)
      : buildingCardView(item as ForgeBuildingDraft);
  }

  /**
   * The back of a card, for a slot nothing has been dealt into yet.
   *
   * An empty slot used to be a dashed box with a bare ordinal in it, which read
   * as a layout gap rather than as a place a card belongs. A back reads as part
   * of the deck.
   */
  private _renderCardBack(index: number, kind: 'agent' | 'building') {
    return html`
      <div class="card-back" aria-label=${emptySlotLabel(index, kind)}>
        <div class="card-back__weave" aria-hidden="true"></div>
        <div class="card-back__sigil" aria-hidden="true"></div>
        <span class="card-back__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      </div>
    `;
  }

  /**
   * The committed roster for one kind — one slot per configured entity.
   *
   * Agents and structures render through the same method. They were two blocks
   * of near-identical markup that had already drifted: the structure slots never
   * got the slam or drag-over classes, and never passed `type`, so every
   * structure was drawn with the agent anatomy.
   */
  private _renderDeploymentField(kind: 'agent' | 'building') {
    const cfg = forgeStateManager.generationConfig.value;
    const total = kind === 'agent' ? cfg.agent_count : cfg.building_count;
    const items = this._entities(kind);
    const art = this._artwork(kind);
    // Structures address slots from 100 up so one pair of drag signals can
    // serve both fields without agent slot 3 lighting up for structure slot 3.
    const slotBase = kind === 'agent' ? 0 : 100;

    return html`
      <div class="deployment-field">
        ${Array.from({ length: total }, (_, i) => {
          const item = items[i];
          const slot = slotBase + i;
          const classes = [
            'deploy-slot',
            item ? 'deploy-slot--filled' : '',
            this._slamSlot === slot ? 'deploy-slot--slam' : '',
            this._dragOverSlot === slot ? 'deploy-slot--drag-over' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return html`
            <div
              class="${classes}"
              @dragover=${(e: DragEvent) => this._handleDragOver(e, slot)}
              @dragleave=${this._handleDragLeave}
              @drop=${(e: DragEvent) => this._handleDrop(e, slot)}
            >
              ${item ? this._renderEntityCard(kind, item, i, art[i] ?? '', 'md', true) : this._renderCardBack(i, kind)}
            </div>
          `;
        })}
      </div>
    `;
  }

  /** One `<velg-game-card>`, fed from the draft rather than from guesses. */
  private _renderEntityCard(
    kind: 'agent' | 'building',
    item: ForgeAgentDraft | ForgeBuildingDraft,
    index: number,
    imageUrl: string,
    size: 'sm' | 'md',
    withActions: boolean,
  ) {
    const view = this._cardView(kind, item);
    return html`
      <velg-game-card
        .type=${view.type}
        .name=${view.name}
        .subtitle=${view.subtitle}
        .description=${view.description}
        .badges=${view.badges}
        .rarity=${view.rarity}
        .conditionDots=${view.conditionDots}
        .imageUrl=${imageUrl}
        size=${size}
        ?show-actions=${withActions}
        @card-click=${() => this._openCardEdit(kind, index)}
        @card-edit=${() => this._openCardEdit(kind, index)}
        @card-delete=${() => this._removeEntity(kind, index)}
      ></velg-game-card>
    `;
  }

  /**
   * The staging hand — cards generated but not yet reviewed.
   *
   * The fan geometry is measured, not assumed; see {@link fanGeometry}.
   */
  private _renderStagingHand(kind: 'agent' | 'building') {
    const staged: (ForgeAgentDraft | ForgeBuildingDraft)[] =
      kind === 'agent' ? this._stagedAgents : this._stagedBuildings;
    if (staged.length === 0) return nothing;

    const art = this._artwork(kind);
    const geo = fanGeometry(staged.length, this._handWidth);
    const acceptLabel = kind === 'agent' ? msg('Accept agent') : msg('Accept building');
    const editLabel = kind === 'agent' ? msg('Edit agent') : msg('Edit building');

    return html`
      <div class="staging-section">
        <div class="staging-label">
          ${msg('Staging Hand')} –
          <span class="staging-hint">${msg('Click ✓ to deploy or ✎ to edit')}</span>
        </div>
        <div class="staging-hand ${geo.overflows ? 'staging-hand--scrolling' : ''}">
          ${staged.map(
            (item, i) => html`
            <div
              class="staging-card ${this._dealingIndex === i ? 'staging-card--dealing' : ''}"
              style="transform: ${fanTransform(i, staged.length, geo)}; margin-left: ${i === 0 ? 0 : -geo.overlap}px; animation-delay: ${i * 100}ms"
              draggable="true"
              @dragstart=${(e: DragEvent) => this._handleDragStart(e, kind, i)}
            >
              ${this._renderEntityCard(kind, item, i, art[i % Math.max(1, art.length)] ?? '', geo.size, false)}
              <div class="staging-card__actions">
                <button class="staging-action" @click=${() => this._acceptEntity(kind, i)} title=${msg('Accept')} aria-label=${acceptLabel}>&#10003;</button>
                <button class="staging-action staging-action--reject" @click=${() => this._openCardEdit(kind, i)} title=${msg('Edit')} aria-label=${editLabel}>&#9998;</button>
              </div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  /** Label under an armed division, naming exactly what the confirm will destroy. */
  private _discardWarning(type: 'agents' | 'buildings' | 'geography'): string {
    const count = this._discardCount(type);
    if (type === 'agents') return msg(str`Discards ${count} drafted operatives.`);
    if (type === 'buildings') return msg(str`Discards ${count} drafted structures.`);
    return msg(str`Replaces the survey of ${count} districts.`);
  }

  private _renderCommandPanel(opts: {
    type: 'geography' | 'agents' | 'buildings';
    division: string;
    description: string;
    actionLabel: string;
    regenLabel: string;
    stampLabel: string;
    infoText: string;
    infoExample: string;
    isComplete: boolean;
    isActive: boolean;
    isGenerating: boolean;
  }) {
    const isArmed = this._armedPanel === opts.type;
    const cls = [
      'command-panel',
      opts.isActive ? 'command-panel--active' : '',
      opts.isComplete && !opts.isActive && !isArmed ? 'command-panel--complete' : '',
      isArmed ? 'command-panel--armed' : '',
    ]
      .filter(Boolean)
      .join(' ');

    let buttonLabel = opts.actionLabel;
    if (opts.isActive) buttonLabel = msg('Generating...');
    else if (isArmed) buttonLabel = msg('Overwrite \u2013 confirm');
    else if (opts.isComplete) buttonLabel = opts.regenLabel;

    return html`
      <div class="${cls}">
        <div class="command-panel__header">
          <span class="command-panel__division">${opts.division}</span>
          ${renderInfoBubble(opts.infoText, opts.infoExample)}
        </div>
        <p class="command-panel__desc">${opts.description}</p>

        ${
          isArmed
            ? html`
          <p class="command-panel__warning" role="alert">
            <span aria-hidden="true">\u26a0</span> ${this._discardWarning(opts.type)}
          </p>
        `
            : nothing
        }

        <button
          class="command-panel__action ${isArmed ? 'command-panel__action--confirm' : ''}"
          ?disabled=${opts.isGenerating}
          aria-describedby=${isArmed ? `arm-warning-${opts.type}` : nothing}
          @click=${() => this._requestChunk(opts.type, opts.isComplete)}
        >
          ${buttonLabel}
        </button>

        ${
          isArmed
            ? html`
          <button
            class="command-panel__cancel"
            @click=${() => {
              this._armedPanel = null;
            }}
          >${msg('Keep what is drafted')}</button>
        `
            : nothing
        }

        ${opts.isActive ? this._renderPanelProgress(opts.type) : nothing}

        ${
          opts.isComplete && !opts.isActive && !isArmed
            ? html`<div class="command-panel__stamp">\u2713 ${opts.stampLabel}</div>`
            : nothing
        }
      </div>
    `;
  }

  /**
   * Progress for a running division, inside the panel that started it.
   *
   * It used to render as a separate box below all three divisions, so the
   * feedback for a click in the third panel appeared somewhere the eye was not.
   */
  private _renderPanelProgress(type: 'geography' | 'agents' | 'buildings') {
    const progress = this._generationProgress;
    const matches = progress && progress.entityType === type;
    const current = matches ? progress.current + 1 : 0;
    const total = matches ? progress.total : 0;
    const pct = matches && total > 0 ? Math.round((current / total) * 100) : null;

    return html`
      <div class="command-panel__progress" role="status">
        <div class="command-panel__progress-track">
          <div
            class="command-panel__progress-fill ${pct === null ? 'command-panel__progress-fill--indeterminate' : ''}"
            style=${pct === null ? '' : `width: ${pct}%`}
          ></div>
        </div>
        <span class="command-panel__progress-label">
          ${pct === null ? msg('Working...') : msg(str`${current} of ${total}`)}
        </span>
      </div>
    `;
  }

  /** The large read-only card at the head of the dossier panel. */
  private _renderDossierPreview(
    kind: 'agent' | 'building',
    entity: ForgeAgentDraft | ForgeBuildingDraft,
    index: number,
  ) {
    const view = this._cardView(kind, entity);
    return html`
      <velg-game-card
        .type=${view.type}
        .name=${view.name}
        .subtitle=${view.subtitle}
        .description=${view.description}
        .badges=${view.badges}
        .rarity=${view.rarity}
        .conditionDots=${view.conditionDots}
        .imageUrl=${this._artwork(kind)[index] ?? ''}
        size="lg"
        .interactive=${false}
      ></velg-game-card>
    `;
  }

  private _renderDossierPanel() {
    const entity = this._getEditingEntity();
    const editing = this._editingEntity;
    const isAgent = editing?.type === 'agent';
    const panelTitle = entity ? (isAgent ? msg('Agent Dossier') : msg('Building Dossier')) : '';

    return html`
      <velg-side-panel
        ?open=${editing !== null}
        .panelTitle=${panelTitle}
        @panel-close=${() => (this._editingEntity = null)}
      >
        ${
          entity && editing
            ? html`
          <div slot="content" class="dossier-panel">
            <div class="dossier-panel__preview">
              ${this._renderDossierPreview(editing.type, entity, editing.index)}
            </div>

            <span class="dossier-panel__section-label">${msg('Details')}</span>

            <label class="field__label">${msg('Name')}</label>
            <input
              class="field__input"
              .value=${entity.name}
              @input=${(e: Event) => this._updateEntity(editing.type, editing.index, 'name', (e.target as HTMLInputElement).value)}
            />

            <label class="field__label">${msg('Description')}</label>
            <textarea
              class="field__textarea"
              .value=${isAgent ? (entity as ForgeAgentDraft).character : (entity as ForgeBuildingDraft).description}
              @input=${(e: Event) =>
                this._updateEntity(
                  editing.type,
                  editing.index,
                  isAgent ? 'character' : 'description',
                  (e.target as HTMLTextAreaElement).value,
                )}
            ></textarea>

            <span class="dossier-panel__section-label">${msg('AI Mutation')}</span>

            <label class="field__label">${msg('Mutation Prompt')}</label>
            <textarea
              class="field__textarea"
              .value=${this._mutationPrompt}
              @input=${(e: Event) => (this._mutationPrompt = (e.target as HTMLTextAreaElement).value)}
              placeholder=${msg('e.g., "Make this character more nihilistic and mention a secret obsession with clocks."')}
            ></textarea>
            <button class="btn btn--next" @click=${this._handleMutation}>
              ${msg('Mutate Entity')}
            </button>
          </div>
        `
            : nothing
        }
      </velg-side-panel>
    `;
  }

  private _renderGenerationFailed(section: 'agents' | 'buildings') {
    const label = section === 'agents' ? msg('Operative Roster') : msg('Architectural Footprint');
    return html`
      <div class="generation-failed" role="alert">
        <div class="generation-failed__icon">\u26A0</div>
        <div class="generation-failed__title">${msg('Signal Lost')} – ${label}</div>
        <div class="generation-failed__detail">
          ${msg('The upstream AI provider was temporarily overloaded. Your existing operatives are safe.')}
        </div>
        <button
          class="btn btn--primary"
          @click=${() => this._retryGeneration(section)}
        >
          ${msg('Retry Generation')}
        </button>
      </div>
    `;
  }

  private _retryGeneration(section: 'agents' | 'buildings') {
    forgeStateManager.error.value = null;
    this._generateChunk(section);
  }

  private _renderCounterPips(filled: number, total: number, label: string, failed = false) {
    return html`
      <div class="counter-pips">
        ${Array.from(
          { length: total },
          (_, i) => html`
          <div class="counter-pips__pip ${i < filled ? 'counter-pips__pip--filled' : ''} ${i >= filled && failed ? 'counter-pips__pip--warning' : ''}"></div>
        `,
        )}
        <span class="counter-pips__label">${filled}/${total} ${label}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-table': VelgForgeTable;
  }
}
