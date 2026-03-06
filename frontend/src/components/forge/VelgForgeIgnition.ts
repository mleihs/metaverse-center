import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { VelgToast } from '../shared/Toast.js';
import {
  forgeBackButtonStyles,
  forgeButtonStyles,
  forgeSectionStyles,
  forgeStatusStyles,
} from './forge-console-styles.js';

import '../shared/GenerationProgress.js';
import '../shared/VelgGameCard.js';

/**
 * Phase IV: The Ignition.
 * Summary review, hold-to-confirm, post-ignition card reveal.
 */
@localized()
@customElement('velg-forge-ignition')
export class VelgForgeIgnition extends LitElement {
  static styles = [
    forgeButtonStyles,
    forgeBackButtonStyles,
    forgeStatusStyles,
    forgeSectionStyles,
    css`
      :host {
        display: block;
      }

      .ignition {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        max-width: 720px;
        margin: 0 auto;
      }

      /* ── Summary Review ────────────────────── */

      .summary {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-6);
      }

      .summary__title {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-gray-400, #9ca3af);
        margin: 0 0 var(--space-4);
        padding-bottom: var(--space-3);
        border-bottom: 1px solid var(--color-gray-700, #374151);
      }

      .summary__rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .summary__row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: var(--space-1) 0;
      }

      .summary__key {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-gray-300, #d1d5db);
      }

      .summary__value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-100, #f3f4f6);
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Generation Cost Preview ────────── */

      .cost-preview {
        background: rgba(59 130 246 / 0.05);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-4);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-300, #d1d5db);
        line-height: 1.6;
      }

      .cost-preview__highlight {
        color: var(--color-gray-200, #e5e7eb);
        font-weight: 700;
      }

      /* ── Danger Zone ────────────────────── */

      .danger-zone {
        background: var(--color-gray-900, #111827);
        border: 2px solid var(--color-danger, #ef4444);
        padding: var(--space-8);
        text-align: center;
        position: relative;
        animation: danger-pulse 3s ease-in-out infinite;
      }

      @keyframes danger-pulse {
        0%, 100% { box-shadow: 0 0 0px rgba(239 68 68 / 0); }
        50% { box-shadow: 0 0 20px rgba(239 68 68 / 0.3); }
      }

      @media (prefers-reduced-motion: reduce) {
        .danger-zone {
          animation: none;
          box-shadow: 0 0 10px rgba(239 68 68 / 0.2);
        }
      }

      .danger-zone__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-xl);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.05em);
        color: #f87171;
        margin: 0 0 var(--space-4);
      }

      .danger-zone__text {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-300, #d1d5db);
        line-height: 1.6;
        margin: 0 0 var(--space-8);
      }

      /* ── Hold-to-Confirm Button ─────────── */

      .btn-hold {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 80px;
        width: 320px;
        font-family: var(--font-brutalist);
        font-weight: 900;
        font-size: var(--text-xl);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: white;
        cursor: pointer;
        border: 2px solid var(--color-danger, #ef4444);
        position: relative;
        overflow: hidden;
        background: transparent;
        transition: color 0.3s;
        user-select: none;
      }

      .btn-hold__fill {
        position: absolute;
        inset: 0;
        background: var(--color-danger, #ef4444);
        transform-origin: left;
        transform: scaleX(0);
        transition: transform 0.05s linear;
        z-index: 0;
      }

      .btn-hold__text {
        position: relative;
        z-index: 1;
      }

      .btn-hold:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* ── Success Box ─────────────────────── */

      .success-box {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-success, #22c55e);
        padding: var(--space-8);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        align-items: center;
        text-align: center;
      }

      .success-box__title {
        color: var(--color-success, #22c55e);
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-2xl);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.05em);
      }

      .success-box__text {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-400, #9ca3af);
        margin: 0;
      }

      /* ── Post-Ignition Card Fan ────────── */

      .post-fan {
        display: flex;
        justify-content: center;
        gap: 0;
        padding: var(--space-6) 0;
        perspective: 800px;
        flex-wrap: wrap;
      }

      .post-fan__card {
        margin-left: -6px;
        animation: post-deal 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .post-fan__card:first-child { margin-left: 0; }

      @keyframes post-deal {
        from {
          opacity: 0;
          transform: translateY(-30px) rotateZ(0deg) scale(0.85);
        }
        to {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .post-fan__card {
          animation: none;
        }
      }

      /* Override btn--launch sizing for the compact Enter Shard button */
      .ignition .btn--launch {
        width: auto;
        height: auto;
        padding: var(--space-2-5, 10px) var(--space-6);
        font-size: var(--text-sm);
      }

      /* ── Error Box ───────────────────────── */

      .error-box {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-danger, #ef4444);
        padding: var(--space-6);
        text-align: center;
      }

      .error-box__message {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-danger, #ef4444);
        margin: 0 0 var(--space-4);
      }
    `,
  ];

  @state() private _hasDraft = false;
  @state() private _isIgniting = false;
  @state() private _materializedSlug: string | null = null;
  @state() private _error: string | null = null;
  @state() private _holdProgress = 0;

  private _holdTimer: ReturnType<typeof setInterval> | null = null;
  private _disposeEffects: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._disposeEffects.push(
      effect(() => {
        this._hasDraft = forgeStateManager.draft.value !== null;
      }),
      effect(() => {
        this._error = forgeStateManager.error.value;
      }),
    );
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    this._clearHold();
    super.disconnectedCallback();
  }

  // ── Hold-to-Confirm ───────────────────────

  private _startHold() {
    if (this._isIgniting) return;
    this._holdProgress = 0;
    const startTime = Date.now();
    const holdDuration = 2000; // 2 seconds

    this._holdTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      this._holdProgress = Math.min(elapsed / holdDuration, 1);

      if (this._holdProgress >= 1) {
        this._clearHold();
        this._executeIgnition();
      }
    }, 30);
  }

  private _endHold() {
    if (this._holdProgress < 1) {
      this._clearHold();
      this._holdProgress = 0;
    }
  }

  private _clearHold() {
    if (this._holdTimer) {
      clearInterval(this._holdTimer);
      this._holdTimer = null;
    }
  }

  private async _executeIgnition() {
    this._isIgniting = true;
    this._error = null;
    try {
      const result = await forgeStateManager.ignite();
      if (result.slug) {
        this._materializedSlug = result.slug;
        VelgToast.success(msg('Shard ignited! Materializing assets...'));
      }
    } catch {
      VelgToast.error(msg('Ignition sequence failed. Check terminal for errors.'));
    } finally {
      this._isIgniting = false;
    }
  }

  private _handleFinish() {
    if (this._materializedSlug) {
      const path = `/simulations/${this._materializedSlug}/lore`;
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  private _handleBack() {
    forgeStateManager.updateDraft({ current_phase: 'darkroom' });
  }

  private _handleRetry() {
    this._error = null;
    forgeStateManager.error.value = null;
  }

  protected render() {
    if (!this._hasDraft) return nothing;

    if (this._materializedSlug) {
      return this._renderSuccess();
    }

    const draft = forgeStateManager.draft.value;
    if (!draft) return nothing;

    const anchor = draft.philosophical_anchor?.selected;
    const genConfig = forgeStateManager.generationConfig.value;
    const agentCount = draft.agents.length;
    const buildingCount = draft.buildings.length;
    const loreImageCount = 3; // estimated
    const totalImages = 1 + agentCount + buildingCount + loreImageCount;

    return html`
      <div class="ignition">
        ${
          this._error
            ? html`
          <div class="error-box" role="alert">
            <p class="error-box__message">${this._error}</p>
            <button class="btn btn--ghost" @click=${this._handleRetry}>
              ${msg('Dismiss & Retry')}
            </button>
          </div>
        `
            : nothing
        }

        <!-- Summary Review -->
        <div class="summary">
          <div class="summary__title">${msg('Ignition Summary')}</div>
          <div class="summary__rows">
            <div class="summary__row">
              <span class="summary__key">${msg('Seed')}</span>
              <span class="summary__value">${draft.seed_prompt}</span>
            </div>
            ${
              anchor
                ? html`
              <div class="summary__row">
                <span class="summary__key">${msg('Anchor')}</span>
                <span class="summary__value">${anchor.title}</span>
              </div>
            `
                : nothing
            }
            <div class="summary__row">
              <span class="summary__key">${msg('Agents')}</span>
              <span class="summary__value">${agentCount} / ${genConfig.agent_count}</span>
            </div>
            <div class="summary__row">
              <span class="summary__key">${msg('Buildings')}</span>
              <span class="summary__value">${buildingCount} / ${genConfig.building_count}</span>
            </div>
            <div class="summary__row">
              <span class="summary__key">${msg('Zones')}</span>
              <span class="summary__value">${(draft.geography as { zones?: unknown[] })?.zones?.length ?? 0}</span>
            </div>
            <div class="summary__row">
              <span class="summary__key">${msg('Theme')}</span>
              <span class="summary__value">${Object.keys(draft.theme_config || {}).length > 0 ? msg('AI-Generated') : msg('Default')}</span>
            </div>
          </div>
        </div>

        <!-- Cost Preview -->
        <div class="cost-preview">
          ${msg('This will generate:')}
          <span class="cost-preview__highlight">
            1 ${msg('banner')} + ${agentCount} ${msg('portraits')} + ${buildingCount} ${msg('building images')} + ~${loreImageCount} ${msg('lore images')}
          </span>
          = <span class="cost-preview__highlight">~${totalImages} ${msg('images')}</span><br>
          ${msg('Estimated time: 3-5 minutes (background)')}
        </div>

        <button class="btn btn--back" @click=${this._handleBack}>
          &larr; ${msg('Return to Darkroom')}
        </button>

        <!-- Danger Zone -->
        <div class="danger-zone">
          <h2 class="danger-zone__title">${msg('Final Materialization')}</h2>
          <p class="danger-zone__text">${msg('By igniting this Shard, you will consume 1 Forge Token and permanently add this world to the multiverse. Hold the button for 2 seconds to confirm.')}</p>

          <button
            class="btn-hold"
            ?disabled=${this._isIgniting}
            @mousedown=${this._startHold}
            @mouseup=${this._endHold}
            @mouseleave=${this._endHold}
            @touchstart=${this._startHold}
            @touchend=${this._endHold}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this._startHold();
              }
            }}
            @keyup=${(e: KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                this._endHold();
              }
            }}
            role="button"
            aria-label=${msg('Hold to ignite')}
          >
            <div class="btn-hold__fill" style="transform: scaleX(${this._holdProgress})"></div>
            <span class="btn-hold__text">
              ${
                this._isIgniting
                  ? msg('IGNITING...')
                  : this._holdProgress > 0
                    ? msg('HOLD...')
                    : msg('HOLD TO IGNITE')
              }
            </span>
          </button>
        </div>
      </div>
    `;
  }

  private _renderSuccess() {
    const agents = forgeStateManager.draft.value?.agents ?? [];
    const buildings = forgeStateManager.draft.value?.buildings ?? [];

    return html`
      <div class="ignition">
        <div class="success-box" role="status" aria-live="polite">
          <div class="success-box__title">${msg('Materialization Complete')}</div>
          <p class="success-box__text">${msg('The Shard has been successfully woven into the multiverse.')}</p>
        </div>

        <!-- Post-ignition card fan reveal -->
        ${
          agents.length > 0
            ? html`
          <div class="post-fan">
            ${agents.map(
              (a, i) => html`
              <div class="post-fan__card" style="animation-delay: ${i * 120}ms">
                <velg-game-card
                  .name=${a.name}
                  .subtitle=${a.primary_profession}
                  .rarity=${'common'}
                  theme="brutalist"
                  size="sm"
                ></velg-game-card>
              </div>
            `,
            )}
          </div>
        `
            : nothing
        }

        ${
          buildings.length > 0
            ? html`
          <div class="post-fan">
            ${buildings.map(
              (b, i) => html`
              <div class="post-fan__card" style="animation-delay: ${(agents.length + i) * 120}ms">
                <velg-game-card
                  .name=${b.name}
                  .subtitle=${b.building_type}
                  .rarity=${'common'}
                  theme="brutalist"
                  size="sm"
                ></velg-game-card>
              </div>
            `,
            )}
          </div>
        `
            : nothing
        }

        <velg-generation-progress
          .status=${msg('Materializing Visual Assets...')}
          .progress=${100}
          .logs=${[msg('Database Materialized'), msg('Theme Applied'), msg('Lore Generated'), msg('Asset Generation Queued')]}
        ></velg-generation-progress>

        <div style="text-align:center">
          <button class="btn btn--launch" @click=${this._handleFinish}>
            ${msg('Enter New Shard')} &ensp; &rarr;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-ignition': VelgForgeIgnition;
  }
}
