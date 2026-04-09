import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import {
  forgeBackButtonStyles,
  forgeButtonStyles,
  forgeSectionStyles,
  forgeStatusStyles,
} from '../shared/forge-console-styles.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/GenerationProgress.js';
import '../shared/VelgGameCard.js';
import '../shared/VelgHoldButton.js';
import './VelgForgeCeremony.js';

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
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: var(--space-6);
      }

      .summary__title {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-muted);
        margin: 0 0 var(--space-4);
        padding-bottom: var(--space-3);
        border-bottom: 1px solid var(--color-border);
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
        color: var(--color-text-tertiary);
      }

      .summary__value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Generation Cost Preview ────────── */

      .cost-preview {
        background: color-mix(in srgb, var(--color-info) 5%, transparent);
        border: 1px solid var(--color-border);
        padding: var(--space-4);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
        line-height: 1.6;
      }

      .cost-preview__highlight {
        color: var(--color-text-secondary);
        font-weight: 700;
      }

      /* ── Danger Zone ────────────────────── */

      .danger-zone {
        background: var(--color-surface);
        border: 2px solid var(--color-danger);
        padding: var(--space-8);
        text-align: center;
        position: relative;
        animation: danger-pulse 3s ease-in-out infinite;
      }

      @keyframes danger-pulse {
        0%, 100% { box-shadow: none; }
        50% { box-shadow: 0 0 20px var(--color-danger-border); }
      }

      @media (prefers-reduced-motion: reduce) {
        .danger-zone {
          animation: none;
          box-shadow: 0 0 10px var(--color-danger-glow);
        }
      }

      .danger-zone__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-xl);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide, 0.05em);
        color: var(--color-danger);
        margin: 0 0 var(--space-4);
      }

      .danger-zone__text {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
        line-height: 1.6;
        margin: 0 0 var(--space-8);
      }

      /* ── Hold-to-Confirm Button (via VelgHoldButton) ─────────── */

      velg-hold-button {
        --hold-btn-fill: var(--color-danger);
        --hold-btn-color: var(--color-danger);
        --hold-btn-active-color: var(--color-text-inverse);
        --hold-btn-active-border: var(--color-danger);
        --hold-btn-border: 2px solid var(--color-danger);
        --hold-btn-width: 320px;
        --hold-btn-height: 80px;
        font-family: var(--font-brutalist);
        font-weight: 900;
        font-size: var(--text-xl);
        letter-spacing: 0.15em;
      }

      /* ── Error Box ───────────────────────── */

      .error-box {
        background: var(--color-surface);
        border: 1px solid var(--color-danger);
        padding: var(--space-6);
        text-align: center;
      }

      .error-box__message {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-danger);
        margin: 0 0 var(--space-4);
      }
    `,
  ];

  @state() private _hasDraft = false;
  @state() private _isIgniting = false;
  @state() private _materializedSlug: string | null = null;
  @state() private _materializedName = '';
  @state() private _materializedDescription = '';
  @state() private _error: string | null = null;

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
    super.disconnectedCallback();
  }

  private async _executeIgnition() {
    this._isIgniting = true;
    this._error = null;
    try {
      const result = await forgeStateManager.ignite();
      if (result.slug) {
        this._materializedSlug = result.slug;
        this._materializedName = result.name ?? '';
        this._materializedDescription = result.description ?? '';
        VelgToast.success(msg('Shard ignited! Materializing assets...'));
      } else {
        // ignite() returns {} on API failure and sets forgeStateManager.error
        const errorMsg = forgeStateManager.error.value ?? msg('Ignition failed. Please try again.');
        this._error = errorMsg;
        VelgToast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : msg('Ignition sequence failed.');
      this._error = errorMsg;
      VelgToast.error(errorMsg);
    } finally {
      this._isIgniting = false;
    }
  }

  private _handleFinish() {
    if (this._materializedSlug) {
      forgeStateManager.startImageTracking(this._materializedSlug);
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
      const draft = forgeStateManager.draft.value;
      const anchor = draft?.philosophical_anchor?.selected;
      const zones = (draft?.geography as { zones?: unknown[] })?.zones ?? [];
      return html`
        <velg-forge-ceremony
          .shardName=${this._materializedName || this._materializedSlug}
          .slug=${this._materializedSlug}
          .seedPrompt=${this._materializedDescription || draft?.seed_prompt || ''}
          .anchorTitle=${anchor?.title ?? ''}
          .agents=${draft?.agents ?? []}
          .buildings=${draft?.buildings ?? []}
          .zoneCount=${zones.length}
          @ceremony-enter=${this._handleFinish}
        ></velg-forge-ceremony>
      `;
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

          <velg-hold-button
            .label=${msg('HOLD TO IGNITE')}
            .holdingLabel=${msg('HOLD...')}
            .executingLabel=${msg('IGNITING...')}
            ?executing=${this._isIgniting}
            aria-label=${msg('Hold to ignite')}
            @hold-confirmed=${this._executeIgnition}
          ></velg-hold-button>
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
