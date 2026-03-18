import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';

const BUREAU_SERVICES = [
  {
    key: 'classified_dossier' as const,
    tab: 'lore',
    cost: 2,
    label: () => msg('CLASSIFIED DOSSIER'),
    formId: () => msg('[CLASSIFIED] LEVEL 4'),
    desc: () =>
      msg(
        'Deep lore expansion: pre-arrival history, agent addenda, geographic anomalies, bleed signatures, prophetic fragments.',
      ),
  },
  {
    key: 'recruitment' as const,
    tab: 'agents',
    cost: 1,
    label: () => msg('RECRUITMENT OFFICE'),
    formId: () => msg('FORM 22-B // FIELD DEPLOYMENT'),
    desc: () =>
      msg(
        'Custom agent generation: define operative specialization, aptitude profile, and deployment parameters.',
      ),
  },
  {
    key: 'darkroom_pass' as const,
    tab: 'settings',
    cost: 2,
    label: () => msg('THE DARKROOM'),
    formId: () => msg('DARKROOM PASS // D-7'),
    desc: () =>
      msg(
        'AI theme generation: color palette, typography, and visual identity derived from simulation lore.',
      ),
  },
  {
    key: 'chronicle_export' as const,
    tab: 'chronicle',
    cost: 1,
    label: () => msg('PRINTING PRESS'),
    formId: () => msg('PRINTING PRESS AUTH'),
    desc: () =>
      msg('Codex export: compiled simulation chronicle as a formatted, downloadable document.'),
  },
] as const;

@localized()
@customElement('velg-bureau-dispatch')
export class VelgBureauDispatch extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: contents;
    }

    /* ── Backdrop ── */

    .dispatch-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-top);
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: dispatch-backdrop-in 300ms ease-out both;
    }

    .dispatch-backdrop--closing {
      animation: dispatch-backdrop-out 300ms ease-in both;
    }

    @keyframes dispatch-backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes dispatch-backdrop-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    /* ── Document ── */

    .dispatch {
      position: fixed;
      inset: 0;
      z-index: calc(var(--z-top) + 1);
      overflow-y: auto;
      overscroll-behavior: contain;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: max(var(--space-8), env(safe-area-inset-top)) var(--space-4) max(var(--space-8), env(safe-area-inset-bottom));
    }

    .dispatch__doc {
      position: relative;
      width: 100%;
      max-width: 680px;
      background: var(--color-surface-sunken);
      border: 2px solid var(--color-accent-amber);
      outline: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      outline-offset: 4px;
      padding: var(--space-8);
      animation: dispatch-doc-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .dispatch__doc--closing {
      animation: dispatch-doc-out 300ms ease-in both;
    }

    @keyframes dispatch-doc-in {
      from {
        opacity: 0;
        transform: translateY(40px) scaleY(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
    }

    @keyframes dispatch-doc-out {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(30px);
      }
    }

    /* Scanline overlay */
    .dispatch__doc::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(245, 158, 11, 0.02) 2px,
        rgba(245, 158, 11, 0.02) 4px
      );
      pointer-events: none;
      animation: scanline-scroll 60s linear infinite;
    }

    @keyframes scanline-scroll {
      from { background-position: 0 0; }
      to { background-position: 0 100vh; }
    }

    /* Amber border glow */
    .dispatch__doc::after {
      content: '';
      position: absolute;
      inset: -2px;
      border: 2px solid var(--color-accent-amber);
      opacity: 0.3;
      animation: dispatch-glow 3s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes dispatch-glow {
      0%, 100% { opacity: 0.15; box-shadow: 0 0 8px rgba(245, 158, 11, 0.15); }
      50% { opacity: 0.4; box-shadow: 0 0 20px rgba(245, 158, 11, 0.25); }
    }

    /* ── Header Block ── */

    .dispatch__header {
      text-align: center;
      margin-bottom: var(--space-6);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
    }

    .dispatch__org {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-2);
    }

    .dispatch__directive {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .dispatch__classification {
      display: inline-block;
      padding: var(--space-0-5) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
    }

    /* ── Metadata Lines ── */

    .dispatch__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-bottom: var(--space-6);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }

    .dispatch__meta-line {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }

    .dispatch__meta-value {
      color: var(--color-text-secondary);
    }

    /* ── Service Rows ── */

    .dispatch__services {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .service {
      position: relative;
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      opacity: 0;
      transform: translateX(-12px);
      animation: service-enter 400ms ease-out forwards;
    }

    @keyframes service-enter {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .service__stamp {
      display: inline-block;
      padding: 2px var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-accent-amber-dim);
      border: 1px solid var(--color-accent-amber-dim);
      margin-bottom: var(--space-2);
    }

    .service__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }

    .service__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .service__status {
      flex-shrink: 0;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 2px var(--space-2);
    }

    .service__status--available {
      color: var(--color-accent-amber);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 50%, transparent);
    }

    .service__status--completed {
      color: var(--color-success);
      border: 1px solid color-mix(in srgb, var(--color-success) 50%, transparent);
    }

    .service__desc {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      line-height: 1.6;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
    }

    .service__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .service__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      letter-spacing: 0.08em;
      color: var(--color-accent-amber);
    }

    .service__cost--bypass {
      color: var(--color-success);
    }

    .service__nav-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-accent-amber);
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .service__nav-btn:hover {
      background: color-mix(in srgb, var(--color-accent-amber) 10%, transparent);
      border-color: var(--color-accent-amber);
    }

    .service__nav-btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Footer ── */

    .dispatch__footer {
      border-top: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      padding-top: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .dispatch__budget {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      letter-spacing: 0.08em;
      color: var(--color-text-secondary);
    }

    .dispatch__budget-value {
      color: var(--color-accent-amber);
    }

    .dispatch__ack-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .dispatch__hint {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }

    .dispatch__ack-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-surface-sunken);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .dispatch__ack-btn:hover {
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .dispatch__ack-btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Reduced Motion ── */

    @media (prefers-reduced-motion: reduce) {
      .dispatch-backdrop,
      .dispatch__doc,
      .service {
        animation: none !important;
        opacity: 1;
        transform: none;
      }

      .dispatch__doc::before,
      .dispatch__doc::after {
        animation: none;
      }
    }

    /* ── Mobile ── */

    @media (max-width: 640px) {
      .dispatch {
        padding: var(--space-4) var(--space-2);
        align-items: flex-start;
      }

      .dispatch__doc {
        padding: var(--space-5) var(--space-4);
        outline-offset: 2px;
      }

      .dispatch__directive {
        font-size: var(--text-xl);
      }

      .service__header {
        flex-direction: column;
        align-items: flex-start;
      }

      .service__footer {
        flex-direction: column;
        align-items: flex-start;
      }

      .dispatch__ack-row {
        flex-direction: column;
        align-items: stretch;
      }

      .dispatch__hint {
        text-align: center;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  private _closing = false;

  private _getServiceStatus(key: string): 'available' | 'completed' {
    return forgeStateManager.hasCompletedPurchase(this.simulationId, key)
      ? 'completed'
      : 'available';
  }

  private _handleNavigate(tab: string): void {
    this.dispatchEvent(
      new CustomEvent('dispatch-navigate', {
        detail: { tab },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleClose(): void {
    this._closing = true;
    this.requestUpdate();
    setTimeout(() => {
      this._closing = false;
      this.dispatchEvent(new CustomEvent('dispatch-close', { bubbles: true, composed: true }));
    }, 300);
  }

  private _handleBackdropClick(e: Event): void {
    if (e.target === e.currentTarget) {
      this._handleClose();
    }
  }

  private _handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      this._handleClose();
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._handleKeyDown);
    super.disconnectedCallback();
  }

  protected render() {
    if (!this.open && !this._closing) return nothing;

    const sim = appState.currentSimulation.value;
    const simName = sim?.name ?? '—';
    const balance = forgeStateManager.walletBalance.value;
    const bypass = forgeStateManager.hasTokenBypass.value;
    const totalCost = BUREAU_SERVICES.reduce((sum, s) => sum + s.cost, 0);
    const closing = this._closing;

    return html`
      <div
        class="dispatch-backdrop ${closing ? 'dispatch-backdrop--closing' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div class="dispatch" @click=${this._handleBackdropClick}>
          <div
            class="dispatch__doc ${closing ? 'dispatch__doc--closing' : ''}"
            role="dialog"
            aria-modal="true"
            aria-label=${msg('Bureau Services Dispatch')}
          >
            <!-- Header -->
            <div class="dispatch__header">
              <p class="dispatch__org">${msg('BUREAU OF SIMULATION INTEGRITY')}</p>
              <h2 class="dispatch__directive">${msg('CLASSIFIED DISPATCH')}</h2>
              <span class="dispatch__classification">${msg('EYES ONLY // OWNER CLEARANCE')}</span>
            </div>

            <!-- Metadata -->
            <div class="dispatch__meta">
              <span class="dispatch__meta-line">
                TO: <span class="dispatch__meta-value">${msg('Simulation Owner')} // ${simName}</span>
              </span>
              <span class="dispatch__meta-line">
                RE: <span class="dispatch__meta-value">${msg('Available Bureau Services')}</span>
              </span>
              <span class="dispatch__meta-line">
                ${msg('CLASSIFICATION')}: <span class="dispatch__meta-value">${msg('RESTRICTED — OWNER ONLY')}</span>
              </span>
            </div>

            <!-- Service Rows -->
            <div class="dispatch__services">
              ${BUREAU_SERVICES.map((svc, i) => {
                const status = this._getServiceStatus(svc.key);
                const isCompleted = status === 'completed';
                return html`
                  <div class="service" style="animation-delay: ${100 + i * 100}ms">
                    <div class="service__stamp">${svc.formId()}</div>
                    <div class="service__header">
                      <h3 class="service__title">${svc.label()}</h3>
                      <span class="service__status ${isCompleted ? 'service__status--completed' : 'service__status--available'}">
                        ${isCompleted ? msg('ACTIVE') : msg('AVAILABLE')}
                      </span>
                    </div>
                    <p class="service__desc">${svc.desc()}</p>
                    <div class="service__footer">
                      <span class="service__cost ${bypass ? 'service__cost--bypass' : ''}">
                        ${bypass ? msg('BYOK: NO COST') : msg(html`COST: ${svc.cost} FT`)}
                      </span>
                      <button
                        class="service__nav-btn"
                        @click=${() => this._handleNavigate(svc.tab)}
                      >
                        ${this._tabLabel(svc.tab)} &rarr;
                      </button>
                    </div>
                  </div>
                `;
              })}
            </div>

            <!-- Footer -->
            <div class="dispatch__footer">
              <div class="dispatch__budget">
                <span>${msg('TOTAL BUDGET')}: <span class="dispatch__budget-value">${totalCost} FT</span></span>
                <span>${msg('YOUR BALANCE')}: <span class="dispatch__budget-value">${balance} FT</span></span>
              </div>
              <div class="dispatch__ack-row">
                <span class="dispatch__hint">${msg('Access via hexagon icon in simulation header')}</span>
                <button class="dispatch__ack-btn" @click=${this._handleClose}>
                  ${msg('DISPATCH ACKNOWLEDGED')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _tabLabel(tab: string): string {
    const labels: Record<string, () => string> = {
      lore: () => msg('GO TO LORE'),
      agents: () => msg('GO TO AGENTS'),
      settings: () => msg('GO TO SETTINGS'),
      chronicle: () => msg('GO TO CHRONICLE'),
    };
    return labels[tab]?.() ?? tab.toUpperCase();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-dispatch': VelgBureauDispatch;
  }
}
