import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ForgeAgentDraft,
  ForgeBuildingDraft,
  ForgeDraft,
} from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { t } from '../../utils/locale-fields.js';
import { VelgToast } from '../shared/Toast.js';
import {
  forgeBackButtonStyles,
  forgeButtonStyles,
  forgeFieldStyles,
  forgeInfoBubbleStyles,
  forgeSectionStyles,
  forgeStatusStyles,
} from './forge-console-styles.js';
import { getBuildingSet, getOperativeSet } from './forge-placeholders.js';
import { fanRotation, renderInfoBubble } from './forge-utils.js';

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
    forgeButtonStyles,
    forgeBackButtonStyles,
    forgeFieldStyles,
    forgeStatusStyles,
    forgeSectionStyles,
    forgeInfoBubbleStyles,
    css`
      :host {
        display: block;
      }

      /* ── Navigation Bar ──────────────────── */

      .table-nav {
        display: flex;
        justify-content: flex-start;
        margin-bottom: var(--space-6);
      }

      /* ── Command Console (3-panel grid) ─── */

      .command-console {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-4);
        margin-bottom: var(--space-8);
      }

      .command-panel {
        background: var(--color-gray-850, #182030);
        border: 1px solid var(--color-gray-600, #4b5563);
        border-left: 3px solid var(--color-gray-500, #6b7280);
        padding: var(--space-5) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        position: relative;
        overflow: hidden;
        transition: border-color 0.3s, background 0.3s;
      }

      .command-panel:hover {
        border-color: var(--color-gray-500, #6b7280);
        border-left-color: var(--color-gray-400, #9ca3af);
        background: var(--color-gray-800, #1f2937);
      }

      /* Active (generating) state */
      .command-panel--active {
        border-left-color: var(--color-success, #22c55e);
        animation: panel-pulse 1.5s ease-in-out infinite;
      }

      .command-panel--active::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 100%;
        background: var(--color-success, #22c55e);
        box-shadow: 0 0 8px var(--color-success, #22c55e), 4px 0 30px rgba(74 222 128 / 0.15);
        animation: sonar-sweep 3s ease-in-out infinite;
      }

      @keyframes sonar-sweep {
        0% { left: 0; opacity: 0.8; }
        100% { left: 100%; opacity: 0; }
      }

      @keyframes panel-pulse {
        0%, 100% { border-left-color: var(--color-success, #22c55e); }
        50% { border-left-color: rgba(74 222 128 / 0.4); }
      }

      /* Complete state */
      .command-panel--complete {
        border-left-color: var(--color-success, #22c55e);
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
        color: var(--color-gray-300, #d1d5db);
      }

      .command-panel--active .command-panel__division {
        color: var(--color-success, #22c55e);
      }

      .command-panel--complete .command-panel__division {
        color: var(--color-success, #22c55e);
      }

      .command-panel__desc {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-300, #d1d5db);
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
        color: var(--color-gray-100, #f3f4f6);
        background: var(--color-gray-800, #1f2937);
        border: 1px solid var(--color-gray-600, #4b5563);
        cursor: pointer;
        transition: all 0.2s;
      }

      .command-panel__action:hover:not(:disabled) {
        background: var(--color-gray-700, #374151);
        box-shadow: 0 0 12px rgba(74 222 128 / 0.15);
        border-color: var(--color-success, #22c55e);
      }

      .command-panel__action:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .command-panel--complete .command-panel__action {
        border-color: var(--color-gray-600, #4b5563);
        color: var(--color-gray-300, #d1d5db);
      }

      .command-panel__stamp {
        font-family: var(--font-brutalist);
        font-weight: 900;
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-success, #22c55e);
        text-align: center;
        padding-top: var(--space-2);
        animation: stamp-slam 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes stamp-slam {
        0% { transform: scale(1.8); opacity: 0; }
        40% { transform: scale(0.9); opacity: 1; }
        70% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      /* ── Advance Button Section ────────── */

      .command-console__advance {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-8);
      }

      .command-console__advance--bottom {
        margin-top: var(--space-8);
      }

      .command-console__advance .btn--next {
        min-width: 280px;
        padding: var(--space-3) var(--space-6);
        font-size: var(--text-sm);
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .command-console__advance .btn--next:not(:disabled) {
        animation: advance-entrance 0.6s cubic-bezier(0.22, 1, 0.36, 1) both,
                   advance-beacon 2.5s ease-in-out 0.6s infinite;
        border-color: var(--color-success, #22c55e);
        color: var(--color-success, #22c55e);
      }

      .command-console__advance .btn--next:not(:disabled)::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(74 222 128 / 0.12) 40%,
          rgba(74 222 128 / 0.2) 50%,
          rgba(74 222 128 / 0.12) 60%,
          transparent 100%
        );
        transform: translateX(-100%);
        animation: advance-shimmer 4s ease-in-out 1.2s infinite;
        pointer-events: none;
      }

      .command-console__advance .btn--next:not(:disabled):hover {
        box-shadow: 0 0 24px rgba(74 222 128 / 0.35), 0 0 6px rgba(74 222 128 / 0.5);
        transform: translateY(-2px);
        animation: advance-entrance 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }

      .command-console__advance .btn--next:not(:disabled):hover::after {
        animation: advance-shimmer 2.5s ease-in-out infinite;
      }

      @keyframes advance-entrance {
        0%   { opacity: 0; transform: translateY(12px) scale(0.96); }
        70%  { opacity: 1; transform: translateY(-2px) scale(1.01); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes advance-beacon {
        0%, 100% { box-shadow: 0 0 8px rgba(74 222 128 / 0.15), 0 0 2px rgba(74 222 128 / 0.3); }
        50%      { box-shadow: 0 0 16px rgba(74 222 128 / 0.3), 0 0 4px rgba(74 222 128 / 0.5), 0 0 40px rgba(74 222 128 / 0.08); }
      }

      @keyframes advance-shimmer {
        0%, 65% { transform: translateX(-100%); }
        100%    { transform: translateX(100%); }
      }

      .advance-hint {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-400, #9ca3af);
        text-transform: uppercase;
        letter-spacing: 0.06em;
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
          border-left-color: var(--color-gray-500, #6b7280);
          box-shadow: none;
        }
        25% {
          border-left-color: var(--color-success, #22c55e);
          box-shadow: inset 0 0 30px rgba(74 222 128 / 0.06), 0 0 16px rgba(74 222 128 / 0.12);
        }
        65% {
          border-left-color: var(--color-success, #22c55e);
          box-shadow: inset 0 0 30px rgba(74 222 128 / 0.06), 0 0 16px rgba(74 222 128 / 0.12);
        }
        100% {
          border-left-color: var(--color-gray-500, #6b7280);
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
        .command-console__advance .btn--next:not(:disabled) {
          animation: none;
          box-shadow: 0 0 8px rgba(74 222 128 / 0.2);
        }
        .command-console__advance .btn--next:not(:disabled)::after {
          display: none;
        }
        .command-console__advance .btn--next:not(:disabled):hover {
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
        color: var(--color-gray-500, #6b7280);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: var(--space-8) var(--space-4);
        text-align: center;
        border: 1px dashed var(--color-gray-700, #374151);
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
        --color-primary: #22c55e;
        --color-secondary: #14b8a6;
        --color-border: #556270;
        --color-surface-sunken: #1e293b;
        --color-surface: #283548;
        --color-text-primary: #f0f0f0;
        --color-text-secondary: #b0b0b0;
      }

      .deploy-slot {
        aspect-ratio: 5 / 8;
        border: 2px dashed var(--color-gray-700, #374151);
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
        border-color: var(--color-success, #22c55e);
        background: rgba(74 222 128 / 0.05);
        box-shadow: 0 0 12px rgba(74 222 128 / 0.2);
        transform: scale(1.02);
      }

      .deploy-slot__placeholder {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-300, #d1d5db);
        text-transform: uppercase;
        letter-spacing: 0.1em;
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
        border: 2px solid var(--color-success, #22c55e);
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
        border-top: 1px dashed var(--color-gray-700, #374151);
        border-bottom: 1px dashed var(--color-gray-700, #374151);
      }

      .counter-pips__pip {
        width: 12px;
        height: 19px;
        border: 1px solid var(--color-gray-600, #4b5563);
        transition: all 0.3s;
      }

      .counter-pips__pip--filled {
        background: var(--color-success, #22c55e);
        border-color: var(--color-success, #22c55e);
        animation: pip-flip 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes pip-flip {
        0% { transform: rotateY(90deg); }
        100% { transform: rotateY(0deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .counter-pips__pip--filled {
          animation: none;
        }
      }

      .counter-pips__label {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-400, #9ca3af);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-left: var(--space-2);
      }

      /* ── Staging Hand (fan layout) ────────── */

      .staging-section {
        margin-top: var(--space-8);
        padding: var(--space-6);
        border: 1px dashed var(--color-success, #22c55e);
        background: rgba(74 222 128 / 0.03);
        /* Override source tokens for dark forge theme */
        --color-primary: #22c55e;
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
        color: var(--color-gray-300, #d1d5db);
        margin-bottom: var(--space-4);
      }

      .staging-hint {
        font-weight: 400;
        color: var(--color-gray-400, #9ca3af);
      }

      .staging-hand {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: 0;
        padding: var(--space-6) 0 var(--space-4);
        perspective: 800px;
        min-height: 360px;
      }

      .staging-card {
        cursor: grab;
        margin-left: -20px;
        transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        transform-origin: bottom center;
        position: relative;
      }

      .staging-card:first-child {
        margin-left: 0;
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
        background: var(--color-gray-800, #1f2937);
        border: 1px solid var(--color-gray-600, #4b5563);
        color: var(--color-gray-300, #d1d5db);
        cursor: pointer;
        transition: all 0.15s;
        padding: 0;
      }

      .staging-action:hover {
        border-color: var(--color-success, #22c55e);
        color: var(--color-success, #22c55e);
      }

      .staging-action--reject:hover {
        border-color: var(--color-danger, #ef4444);
        color: var(--color-danger, #ef4444);
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
        color: var(--color-success, #22c55e);
      }

      .geo-card {
        background: var(--color-gray-850, #182030);
        border: 1px solid var(--color-gray-600, #4b5563);
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
        color: var(--color-gray-100, #f3f4f6);
        font-size: var(--text-sm);
      }

      .geo-card__desc {
        font-size: var(--text-sm);
        color: var(--color-gray-300, #d1d5db);
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
        background: var(--color-gray-800, #1f2937);
        border: 1px solid var(--color-gray-700, #374151);
        color: var(--color-gray-300, #d1d5db);
      }

      /* ── Side Panel (Dossier) ─────────────── */

      .dossier-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding: var(--space-6);
        /* Override source tokens for dark forge theme */
        --color-primary: #22c55e;
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
        border-bottom: 1px solid var(--color-gray-700, #374151);
      }

      .dossier-panel__section-label {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-success, #22c55e);
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
    super.disconnectedCallback();
  }

  protected firstUpdated() {
    // Scroll to command console and play attention-grabbing pulse
    requestAnimationFrame(() => {
      const console = this.renderRoot.querySelector('.command-console');
      if (!console) return;
      console.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.classList.add('command-console--entering');
      setTimeout(() => {
        console.classList.remove('command-console--entering');
      }, 3000);
    });
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

  private async _generateChunk(type: 'agents' | 'buildings' | 'geography') {
    const sectionSel =
      type === 'geography'
        ? '.section--geography'
        : type === 'agents'
          ? '.section--agents'
          : '.section--buildings';

    // Scroll to the target section first, then start generation
    this._generatingChunk = type;
    await this.updateComplete;
    requestAnimationFrame(() => {
      this.renderRoot
        .querySelector(sectionSel)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    await forgeStateManager.generateChunk(type);
    this._generatingChunk = null;

    if (!forgeStateManager.error.value) {
      const toastMsg = forgeStateManager.lastGenerationRecovered.value
        ? msg('Signal recovered — blueprints retrieved from Bureau archives')
        : msg('Blueprint expanded successfully.');
      VelgToast.success(toastMsg);
      // Scroll to reveal the generated content
      await this.updateComplete;
      requestAnimationFrame(() => {
        this.renderRoot
          .querySelector(sectionSel)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      VelgToast.error(msg('Failed to generate blueprint chunk.'));
    }
  }

  private _acceptAgent(index: number) {
    this._slamSlot = index;
    setTimeout(() => {
      this._slamSlot = null;
    }, 500);
    forgeStateManager.acceptEntity('agent', index);
  }

  private _acceptBuilding(index: number) {
    forgeStateManager.acceptEntity('building', index);
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
    } catch {
      /* ignore */
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

  private _fanRotation(index: number, total: number): string {
    return fanRotation(index, total, 10, 6);
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

    return html`
      ${this._error ? html`<div class="error-banner" role="alert">${this._error}</div>` : nothing}

      <div class="table-nav">
        <button class="btn btn--back" @click=${this._handleBack}>
          &larr; ${msg('Return to Astrolabe')}
        </button>
      </div>

      <div class="command-console">
        ${this._renderCommandPanel({
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
          handler: () => this._generateChunk('geography'),
        })}
        ${this._renderCommandPanel({
          division: msg('Personnel Bureau'),
          description: msg(
            'Recruit operative candidates — AI-generated characters with names, professions, and backstories.',
          ),
          actionLabel: msg('Begin Recruitment'),
          regenLabel: msg('Re-draft'),
          stampLabel: msg('Recruited'),
          infoText: msg(
            'Recruits operative candidates — AI-generated characters with names, professions, and backstories.',
          ),
          infoExample: msg('Drafts 6 agents that appear in your staging hand for review.'),
          isComplete: hasAgents,
          isActive: this._generatingChunk === 'agents',
          isGenerating: this._isGenerating,
          handler: () => this._generateChunk('agents'),
        })}
        ${this._renderCommandPanel({
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
          handler: () => this._generateChunk('buildings'),
        })}
      </div>

      <div class="command-console__advance">
        <button class="btn btn--next" ?disabled=${!allComplete} @click=${this._handleNext}>
          ${msg('Calibrate Darkroom')} &rarr;
        </button>
        ${!allComplete ? html`<span class="advance-hint">${msg('Complete all three divisions to advance')}</span>` : nothing}
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

        <div class="deployment-field">
          ${Array.from({ length: genConfig.agent_count }, (_, i) => {
            const agent = agents[i];
            const isFilled = !!agent;
            return html`
              <div
                class="deploy-slot ${isFilled ? 'deploy-slot--filled' : ''} ${this._slamSlot === i ? 'deploy-slot--slam' : ''} ${this._dragOverSlot === i ? 'deploy-slot--drag-over' : ''}"
                @dragover=${(e: DragEvent) => this._handleDragOver(e, i)}
                @dragleave=${this._handleDragLeave}
                @drop=${(e: DragEvent) => this._handleDrop(e, i)}
              >
                ${
                  isFilled
                    ? html`
                    <velg-game-card
                      .name=${agent.name}
                      .subtitle=${t(agent, 'primary_profession')}
                      .description=${t(agent, 'background')}
                      .imageUrl=${this._agentImages[i] ?? ''}
                      .rarity=${'common'}
                      theme="brutalist"
                      size="md"
                      show-actions
                      @card-click=${() => this._openCardEdit('agent', i)}
                      @card-edit=${() => this._openCardEdit('agent', i)}
                      @card-delete=${() => this._removeAgent(i)}
                    ></velg-game-card>
                  `
                    : html`<span class="deploy-slot__placeholder">${i + 1}</span>`
                }
              </div>
            `;
          })}
        </div>

        ${this._renderCounterPips(agents.length, genConfig.agent_count, msg('Agents Drafted'))}

        ${
          this._stagedAgents.length > 0
            ? html`
          <div class="staging-section">
            <div class="staging-label">
              ${msg('Staging Hand')} —
              <span class="staging-hint">${msg('Click \u2713 to deploy or \u270E to edit')}</span>
            </div>
            <div class="staging-hand">
              ${this._stagedAgents.map(
                (a, i) => html`
                <div
                  class="staging-card ${this._dealingIndex === i ? 'staging-card--dealing' : ''}"
                  style="transform: ${this._fanRotation(i, this._stagedAgents.length)}; animation-delay: ${i * 100}ms"
                  draggable="true"
                  @dragstart=${(e: DragEvent) => this._handleDragStart(e, 'agent', i)}
                >
                  <velg-game-card
                    .name=${a.name}
                    .subtitle=${t(a, 'primary_profession')}
                    .description=${t(a, 'background')}
                    .imageUrl=${this._agentImages[i % this._agentImages.length] ?? ''}
                    .rarity=${'common'}
                    theme="brutalist"
                    size="md"
                  ></velg-game-card>
                  <div class="staging-card__actions">
                    <button class="staging-action" @click=${() => this._acceptAgent(i)} title=${msg('Accept')} aria-label=${msg('Accept agent')}>&#10003;</button>
                    <button class="staging-action staging-action--reject" @click=${() => this._openCardEdit('agent', i)} title=${msg('Edit')} aria-label=${msg('Edit agent')}>&#9998;</button>
                  </div>
                </div>
              `,
              )}
            </div>
          </div>
        `
            : nothing
        }

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

        <div class="deployment-field">
          ${Array.from({ length: genConfig.building_count }, (_, i) => {
            const building = buildings[i];
            const isFilled = !!building;
            return html`
              <div
                class="deploy-slot ${isFilled ? 'deploy-slot--filled' : ''}"
                @dragover=${(e: DragEvent) => this._handleDragOver(e, 100 + i)}
                @dragleave=${this._handleDragLeave}
                @drop=${(e: DragEvent) => this._handleDrop(e, 100 + i)}
              >
                ${
                  isFilled
                    ? html`
                    <velg-game-card
                      .name=${building.name}
                      .subtitle=${t(building, 'building_type')}
                      .description=${t(building, 'description')}
                      .imageUrl=${this._buildingImages[i] ?? ''}
                      .rarity=${'common'}
                      theme="brutalist"
                      size="md"
                      show-actions
                      @card-click=${() => this._openCardEdit('building', i)}
                      @card-edit=${() => this._openCardEdit('building', i)}
                      @card-delete=${() => this._removeBuilding(i)}
                    ></velg-game-card>
                  `
                    : html`<span class="deploy-slot__placeholder">${i + 1}</span>`
                }
              </div>
            `;
          })}
        </div>

        ${this._renderCounterPips(buildings.length, genConfig.building_count, msg('Buildings Drafted'))}

        ${
          this._stagedBuildings.length > 0
            ? html`
          <div class="staging-section">
            <div class="staging-label">
              ${msg('Staging Hand')} —
              <span class="staging-hint">${msg('Click \u2713 to deploy or \u270E to edit')}</span>
            </div>
            <div class="staging-hand">
              ${this._stagedBuildings.map(
                (b, i) => html`
                <div
                  class="staging-card"
                  style="transform: ${this._fanRotation(i, this._stagedBuildings.length)}"
                  draggable="true"
                  @dragstart=${(e: DragEvent) => this._handleDragStart(e, 'building', i)}
                >
                  <velg-game-card
                    .name=${b.name}
                    .subtitle=${t(b, 'building_type')}
                    .description=${t(b, 'description')}
                    .imageUrl=${this._buildingImages[i % this._buildingImages.length] ?? ''}
                    .rarity=${'common'}
                    theme="brutalist"
                    size="md"
                  ></velg-game-card>
                  <div class="staging-card__actions">
                    <button class="staging-action" @click=${() => this._acceptBuilding(i)} title=${msg('Accept')} aria-label=${msg('Accept building')}>&#10003;</button>
                    <button class="staging-action staging-action--reject" @click=${() => this._openCardEdit('building', i)} title=${msg('Edit')} aria-label=${msg('Edit building')}>&#9998;</button>
                  </div>
                </div>
              `,
              )}
            </div>
          </div>
        `
            : nothing
        }

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

      <!-- Bottom advance button (duplicates top) -->
      <div class="command-console__advance command-console__advance--bottom">
        <button class="btn btn--next" ?disabled=${!allComplete} @click=${this._handleNext}>
          ${msg('Calibrate Darkroom')} &rarr;
        </button>
        ${!allComplete ? html`<span class="advance-hint">${msg('Complete all three divisions to advance')}</span>` : nothing}
      </div>

      ${this._renderDossierPanel()}
    `;
  }

  private _removeAgent(index: number) {
    const agents = [...(this._draft?.agents ?? [])];
    agents.splice(index, 1);
    forgeStateManager.updateDraft({ agents });
  }

  private _removeBuilding(index: number) {
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

  private _renderCommandPanel(opts: {
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
    handler: () => void;
  }) {
    const cls = [
      'command-panel',
      opts.isActive ? 'command-panel--active' : '',
      opts.isComplete && !opts.isActive ? 'command-panel--complete' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const buttonLabel = opts.isActive
      ? msg('Generating...')
      : opts.isComplete
        ? opts.regenLabel
        : opts.actionLabel;

    return html`
      <div class="${cls}">
        <div class="command-panel__header">
          <span class="command-panel__division">${opts.division}</span>
          ${renderInfoBubble(opts.infoText, opts.infoExample)}
        </div>
        <p class="command-panel__desc">${opts.description}</p>
        <button
          class="command-panel__action"
          ?disabled=${opts.isGenerating}
          @click=${opts.handler}
        >
          ${buttonLabel}
        </button>
        ${
          opts.isComplete && !opts.isActive
            ? html`<div class="command-panel__stamp">\u2713 ${opts.stampLabel}</div>`
            : nothing
        }
      </div>
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
              <velg-game-card
                .name=${entity.name}
                .subtitle=${isAgent ? t(entity as ForgeAgentDraft, 'primary_profession') : t(entity as ForgeBuildingDraft, 'building_type')}
                .imageUrl=${isAgent ? (this._agentImages[editing.index] ?? '') : (this._buildingImages[editing.index] ?? '')}
                .rarity=${'common'}
                theme="brutalist"
                size="lg"
                .interactive=${false}
              ></velg-game-card>
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

  private _renderCounterPips(filled: number, total: number, label: string) {
    return html`
      <div class="counter-pips">
        ${Array.from(
          { length: total },
          (_, i) => html`
          <div class="counter-pips__pip ${i < filled ? 'counter-pips__pip--filled' : ''}"></div>
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
