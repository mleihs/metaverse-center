import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

type DossierState = 'checking' | 'idle' | 'confirming' | 'processing' | 'completed';

const DOSSIER_SECTIONS = [
  'PRE-ARRIVAL HISTORY',
  'AGENT ADDENDA',
  'GEOGRAPHIC ANOMALIES',
  'BLEED SIGNATURES',
  'PROPHETIC FRAGMENTS',
  'BUREAU RECOMMENDATION',
] as const;

@localized()
@customElement('velg-dossier-request')
export class VelgDossierRequest extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── CTA Panel ── */

    .dossier-cta {
      position: relative;
      margin-top: var(--space-6);
      padding: var(--space-6);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 80%, transparent);
      overflow: hidden;
      opacity: 0;
      transform: translateY(12px);
      animation: dossier-enter 400ms ease-out forwards;
    }

    @keyframes dossier-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Scanline overlay */
    .dossier-cta::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(245, 158, 11, 0.03) 2px,
        rgba(245, 158, 11, 0.03) 4px
      );
      pointer-events: none;
      animation: scanline-scroll 60s linear infinite;
    }

    @keyframes scanline-scroll {
      from { background-position: 0 0; }
      to { background-position: 0 100vh; }
    }

    /* Amber border glow pulse */
    .dossier-cta::after {
      content: '';
      position: absolute;
      inset: -1px;
      border: 1px solid var(--color-accent-amber);
      opacity: 0.4;
      animation: glow-pulse 2s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes glow-pulse {
      0%, 100% { opacity: 0.2; box-shadow: 0 0 4px rgba(245, 158, 11, 0.2); }
      50% { opacity: 0.6; box-shadow: 0 0 12px rgba(245, 158, 11, 0.3); }
    }

    .stamp {
      display: inline-block;
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      border: 2px solid var(--color-accent-amber);
      margin-bottom: var(--space-4);
    }

    .cta__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .cta__rule {
      width: 60%;
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 0 0 var(--space-3);
    }

    .cta__desc {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
      max-width: 50ch;
      margin: 0 0 var(--space-4);
    }

    .cta__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4);
    }

    .cta__cost--bypass {
      color: var(--color-success);
    }

    .cta__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .cta__btn:hover:not(:disabled) {
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .cta__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .cta__btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Processing State ── */

    .processing {
      margin-top: var(--space-6);
      padding: var(--space-6);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 80%, transparent);
    }

    .processing__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4);
    }

    .processing__slots {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .slot {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      opacity: 0;
      animation: slot-enter 400ms ease-out forwards;
    }

    @keyframes slot-enter {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .slot__indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-border);
      flex-shrink: 0;
    }

    .slot__indicator--active {
      background: var(--color-accent-amber);
      animation: indicator-pulse 1s ease-in-out infinite;
    }

    .slot__indicator--done {
      background: var(--color-success);
    }

    @keyframes indicator-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    .slot__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-secondary);
    }

    .slot__label--done {
      color: var(--color-text-primary);
    }

    /* ── Confirmation Modal ── */

    .confirm__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .confirm__desc {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
    }

    .confirm__cost-line {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-accent-amber);
      padding: var(--space-3);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      background: color-mix(in srgb, var(--color-accent-amber) 5%, transparent);
    }

    .confirm__footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .confirm__btn-cancel {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .confirm__btn-cancel:hover {
      border-color: var(--color-text-secondary);
      color: var(--color-text-primary);
    }

    .confirm__btn-authorize {
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .confirm__btn-authorize:hover:not(:disabled) {
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
    }

    .confirm__btn-authorize:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .confirm__btn-authorize:focus-visible,
    .confirm__btn-cancel:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .dossier-cta,
      .slot {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .dossier-cta::before,
      .dossier-cta::after {
        animation: none;
      }

      .slot__indicator--active {
        animation: none;
        opacity: 1;
      }
    }

    @media (max-width: 480px) {
      .dossier-cta,
      .processing {
        padding: var(--space-4);
      }

      .confirm__footer {
        flex-direction: column;
      }

      .confirm__btn-cancel,
      .confirm__btn-authorize {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Number }) walletBalance = 0;
  @property({ type: Boolean }) hasBypass = false;

  @state() private _state: DossierState = 'checking';
  @state() private _slotsCompleted = 0;

  connectedCallback(): void {
    super.connectedCallback();
    void this._checkExisting();
  }

  private async _checkExisting(): Promise<void> {
    if (!this.simulationId) {
      this._state = 'idle';
      return;
    }
    const purchases = await forgeStateManager.loadFeaturePurchases(
      this.simulationId,
      'classified_dossier',
    );
    const completed = purchases.some((p) => p.status === 'completed');
    this._state = completed ? 'completed' : 'idle';
  }

  private _openConfirm(): void {
    this._state = 'confirming';
  }

  private _cancelConfirm(): void {
    this._state = 'idle';
  }

  private async _authorize(): Promise<void> {
    this._state = 'processing';
    this._slotsCompleted = 0;

    const purchaseId = await forgeStateManager.purchaseFeature(
      this.simulationId,
      'classified_dossier',
    );

    if (!purchaseId) {
      VelgToast.error(forgeStateManager.error.value ?? msg('Authorization failed.'));
      this._state = 'idle';
      return;
    }

    const result = await forgeStateManager.awaitFeatureCompletion(purchaseId, (p) => {
      // Simulate progressive slot completion based on progress
      if (p.status === 'processing') {
        const elapsed = Date.now() - new Date(p.created_at).getTime();
        this._slotsCompleted = Math.min(5, Math.floor(elapsed / 8000));
      }
    });

    if (result?.status === 'completed') {
      this._slotsCompleted = 6;
      VelgToast.success(msg('Classified dossier authorized. Sections now available.'));
      this._state = 'completed';
      this.dispatchEvent(new CustomEvent('dossier-complete', { bubbles: true, composed: true }));
    } else if (result?.status === 'failed' || result?.status === 'refunded') {
      VelgToast.error(msg('Dossier generation failed. Tokens refunded.'));
      this._state = 'idle';
    } else {
      VelgToast.error(msg('Dossier generation timed out. Check back later.'));
      this._state = 'idle';
    }
  }

  protected render() {
    switch (this._state) {
      case 'checking':
        return nothing;
      case 'idle':
        return this._renderCTA();
      case 'confirming':
        return html`${this._renderCTA()}${this._renderConfirmModal()}`;
      case 'processing':
        return this._renderProcessing();
      case 'completed':
        return nothing;
    }
  }

  private _renderCTA() {
    const cost = this.hasBypass ? 0 : 2;
    const canAfford = this.hasBypass || this.walletBalance >= cost;

    return html`
      <div class="dossier-cta" role="region" aria-label=${msg('Classified dossier request')}>
        <div class="stamp">${msg('[CLASSIFIED] BUREAU CLEARANCE LEVEL 4')}</div>

        <h3 class="cta__title">${msg('Authorize Classified Expansion')}</h3>
        <hr class="cta__rule" />

        <p class="cta__desc">
          ${msg("Unlock the six ARCANUM sections previewed above. The Bureau's Senior Classified Analyst will generate ~9,000 words of deep intelligence: the shard's hidden pre-arrival history, classified addenda for every agent, annotated geographic anomalies, cross-shard bleed analysis, recovered prophetic fragments, and the Bureau's official threat assessment.")}
        </p>

        <p class="cta__cost ${this.hasBypass ? 'cta__cost--bypass' : ''}">
          ${this.hasBypass ? msg('NO COST') : msg('AUTHORIZATION COST: 2 FT')}
        </p>

        <button
          class="cta__btn"
          ?disabled=${!canAfford}
          @click=${this._openConfirm}
          aria-label=${msg('Authorize dossier expansion')}
        >
          ${msg('AUTHORIZE DOSSIER EXPANSION')}
        </button>
      </div>
    `;
  }

  private _renderProcessing() {
    return html`
      <div class="processing" role="status" aria-live="polite">
        <h3 class="processing__title">${msg('PROCESSING CLASSIFIED EXPANSION...')}</h3>
        <div class="processing__slots">
          ${DOSSIER_SECTIONS.map((label, i) => {
            const done = i < this._slotsCompleted;
            const active = i === this._slotsCompleted;
            return html`
              <div
                class="slot"
                style="animation-delay: ${i * 150}ms"
              >
                <span class="slot__indicator ${done ? 'slot__indicator--done' : active ? 'slot__indicator--active' : ''}"></span>
                <span class="slot__label ${done ? 'slot__label--done' : ''}">${label}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _renderConfirmModal() {
    return html`
      <velg-base-modal
        ?open=${true}
        @modal-close=${this._cancelConfirm}
        style="--modal-max-width: 480px"
      >
        <span slot="header">${msg('BUREAU FORM 77-C // CLASSIFIED EXPANSION REQUEST')}</span>

        <div class="confirm__body">
          <p class="confirm__desc">
            ${msg("This will generate the six ARCANUM sections shown in the preview above – ALPHA through ZETA. Each section is AI-generated using the simulation's agents, buildings, zones, and existing lore as source material. Generation takes 1-3 minutes. The new sections will appear below the existing lore scroll as CLASSIFIED chapters.")}
          </p>
          <div class="confirm__cost-line">
            ${
              this.hasBypass
                ? msg('API KEY ACTIVE – NO TOKEN DEDUCTION')
                : msg('This action will deduct 2 Forge Tokens from your balance.')
            }
          </div>
        </div>

        <div slot="footer" class="confirm__footer">
          <button class="confirm__btn-cancel" @click=${this._cancelConfirm}>
            ${msg('Cancel')}
          </button>
          <button class="confirm__btn-authorize" @click=${this._authorize}>
            ${msg('AUTHORIZE')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dossier-request': VelgDossierRequest;
  }
}
