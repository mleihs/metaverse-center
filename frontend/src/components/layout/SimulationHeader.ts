import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { icons } from '../../utils/icons.js';
import type { ThreatLevel } from '../lore/lore-content.js';
import {
  extractThreatLevel,
  fetchRawLoreSections,
  isClassifiedSection,
} from '../lore/lore-content.js';

import '../lore/VelgThreatLevel.js';

@localized()
@customElement('velg-simulation-header')
export class VelgSimulationHeader extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-raised);
      border-bottom: var(--border-default);
      padding: var(--space-4) var(--space-6);
    }

    .header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .header__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      animation: header-name-enter 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes header-name-enter {
      from {
        opacity: 0;
        transform: translateX(-8px);
        letter-spacing: 0.2em;
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .header__badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-default);
      animation: badge-pop 250ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both 150ms;
    }

    @keyframes badge-pop {
      from {
        opacity: 0;
        transform: scale(0.7);
      }
    }

    .badge--active {
      background: var(--color-success-bg);
      color: var(--color-text-success);
      border-color: var(--color-success-border);
    }

    .badge--draft {
      background: var(--color-warning-bg);
      color: var(--color-text-warning);
      border-color: var(--color-warning-border);
    }

    .badge--archived {
      background: var(--color-surface-sunken);
      color: var(--color-text-secondary);
    }

    /* ── Bureau Button ── */

    .header__bureau-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      color: var(--color-accent-amber);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      animation: badge-pop 250ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both 300ms;
    }

    .header__bureau-btn:hover {
      background: color-mix(in srgb, var(--color-accent-amber) 12%, transparent);
      transform: scale(1.1);
    }

    .header__bureau-btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .header__bureau-btn--pulse {
      animation: badge-pop 250ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both 300ms,
                 bureau-pulse 2s ease-in-out infinite 550ms;
    }

    .header__bureau-btn--intro {
      animation: badge-pop 250ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both 300ms,
                 bureau-intro 1.8s ease-in-out 600ms,
                 bureau-pulse 2s ease-in-out infinite 2400ms;
    }

    @keyframes bureau-pulse {
      0%, 100% { filter: drop-shadow(0 0 0 transparent); }
      50% { filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.5)); }
    }

    @keyframes bureau-intro {
      0%   { filter: drop-shadow(0 0 0 transparent); transform: scale(1); }
      20%  { filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.8)); transform: scale(1.3); }
      40%  { filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.2)); transform: scale(1); }
      60%  { filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6)); transform: scale(1.2); }
      80%  { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.1)); transform: scale(1); }
      100% { filter: drop-shadow(0 0 0 transparent); transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .header__bureau-btn,
      .header__bureau-btn--pulse,
      .header__bureau-btn--intro {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--space-3) var(--space-4);
      }

      .header {
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .header__name {
        font-size: var(--text-lg);
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) introHexagon = false;

  @state() private _threatLevel: ThreatLevel | null = null;
  private _threatLoadedForSim = '';
  private _threatLoadedWithPurchases = 0;

  updated(changed: Map<PropertyKey, unknown>): void {
    if (
      changed.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._threatLoadedForSim
    ) {
      this._threatLoadedForSim = this.simulationId;
      this._threatLoadedWithPurchases = 0;
      void this._loadThreatLevel();
    }
  }

  /** Re-check threat level when feature purchases signal changes. */
  private _checkThreatOnPurchaseChange(): void {
    const purchaseVersion = forgeStateManager.featurePurchases.value.size;
    if (purchaseVersion !== this._threatLoadedWithPurchases && this.simulationId) {
      this._threatLoadedWithPurchases = purchaseVersion;
      void this._loadThreatLevel();
    }
  }

  private async _loadThreatLevel(): Promise<void> {
    if (!this.simulationId) return;

    const hasDossier = forgeStateManager.hasCompletedPurchase(
      this.simulationId,
      'classified_dossier',
    );
    if (!hasDossier) {
      this._threatLevel = null;
      return;
    }

    try {
      const raw = await fetchRawLoreSections(this.simulationId);
      if (!raw) return;

      const zeta = raw.find((s) => isClassifiedSection(s) && s.arcanum === 'ZETA');
      if (!zeta) return;

      this._threatLevel = extractThreatLevel(zeta.body);
      forgeStateManager.threatLevel.value = this._threatLevel;
    } catch {
      // Non-critical
    }
  }

  private _handleThreatClick(): void {
    this.dispatchEvent(
      new CustomEvent('navigate-to-tab', {
        bubbles: true,
        composed: true,
        detail: { tab: 'lore' },
      }),
    );
  }

  private _getBadgeClass(status: string): string {
    if (status === 'active') return 'badge--active';
    if (status === 'draft' || status === 'configuring') return 'badge--draft';
    return 'badge--archived';
  }

  private _openDispatch(): void {
    this.dispatchEvent(new CustomEvent('open-bureau-dispatch', { bubbles: true, composed: true }));
  }

  protected render() {
    const sim = appState.currentSimulation.value;
    if (!sim) return html``;

    // Reading featurePurchases signal ensures SignalWatcher re-renders on change
    this._checkThreatOnPurchaseChange();

    const canEdit = appState.canEdit.value;
    const hasPulse = canEdit && forgeStateManager.hasAnyUnpurchasedFeature(this.simulationId);
    const btnClass = this.introHexagon
      ? 'header__bureau-btn--intro'
      : hasPulse
        ? 'header__bureau-btn--pulse'
        : '';

    return html`
      <div class="header">
        <h2 class="header__name">${sim.name}</h2>
        <span class="header__badge ${this._getBadgeClass(sim.status)}">${sim.status}</span>
        ${
          this._threatLevel
            ? html`<velg-threat-level
              .threatLevel=${this._threatLevel}
              @navigate-to-zeta=${this._handleThreatClick}
            ></velg-threat-level>`
            : ''
        }
        ${
          canEdit
            ? html`
          <button
            class="header__bureau-btn ${btnClass}"
            @click=${this._openDispatch}
            aria-label=${msg('Bureau Services')}
          >${icons.hexagon(14)}</button>
        `
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-header': VelgSimulationHeader;
  }
}
