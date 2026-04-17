/**
 * BondsView — simulation-scoped view for Agent Bonds.
 *
 * Renders the bond panel + recognition candidates. Registered as
 * the 'bonds' view in sim-view-imports.ts and routed at
 * /simulations/:id/bonds.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { RecognitionCandidate } from '../../services/api/BondsApiService.js';
import { bondsApi } from '../../services/api/BondsApiService.js';
import { appState } from '../../services/AppStateManager.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/VelgHelpTip.js';

import './VelgBondPanel.js';
import './VelgBondFormation.js';

@localized()
@customElement('velg-bonds-view')
export class VelgBondsView extends LitElement {
  static styles = [
    viewHeaderStyles,
    css`
      :host {
        display: block;
      }

      .bonds-layout {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
      }
    `,
  ];

  @property({ type: String }) simulationId = '';
  @state() private _candidates: RecognitionCandidate[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._loadCandidates();
  }

  private async _loadCandidates() {
    if (!appState.isAuthenticated.value) return;
    const resp = await bondsApi.getRecognitionCandidates(this.simulationId);
    if (resp.success && resp.data) {
      this._candidates = resp.data;
    }
  }

  private async _handleBondFormed() {
    this._candidates = [];
    await this._loadCandidates();
    // Force re-render of bond panel by toggling key
    this.requestUpdate();
  }

  protected render() {
    return html`
      <div class="view">
        <div class="view__header">
          <div class="view__title-group">
            <h2 class="view__title">${msg('Agent Bonds')}</h2>
            <velg-help-tip
              topic="bonds"
              label=${msg('How do bonds work?')}
            ></velg-help-tip>
          </div>
        </div>

        <div class="bonds-layout">
          ${this._candidates.length
            ? html`
                <velg-bond-formation
                  .candidates=${this._candidates}
                  .simulationId=${this.simulationId}
                  @bond-formed=${this._handleBondFormed}
                ></velg-bond-formation>
              `
            : nothing}

          <velg-bond-panel
            .simulationId=${this.simulationId}
          ></velg-bond-panel>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bonds-view': VelgBondsView;
  }
}
