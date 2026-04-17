/**
 * VelgBondFormation — recognition whisper + bond offer UI.
 *
 * When an agent crosses the attention threshold, this component
 * displays a recognition message and a "Form Bond" action.
 * Aesthetic: a classified dossier being opened for the first time.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { analyticsService } from '../../services/AnalyticsService.js';
import type { RecognitionCandidate } from '../../services/api/BondsApiService.js';
import { bondsApi } from '../../services/api/BondsApiService.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-bond-formation')
export class VelgBondFormation extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        --_glow: color-mix(
          in srgb,
          var(--color-primary) 15%,
          transparent
        );
        display: block;
      }

      .formation {
        border: 1px dashed var(--color-primary);
        padding: var(--space-5);
        background: var(--_glow);
        opacity: 0;
        animation: formation-in var(--duration-entrance) var(--ease-dramatic)
          forwards;
      }

      .formation__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-primary);
        margin-bottom: var(--space-3);
      }

      .candidates {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .candidate {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        opacity: 0;
        animation: candidate-in var(--duration-entrance) var(--ease-dramatic)
          calc(var(--i, 0) * var(--duration-cascade)) forwards;
      }

      .candidate__info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }

      .candidate__name {
        font-family: var(--font-body);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .candidate__whisper {
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        font-style: italic;
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .candidate__action {
        flex-shrink: 0;
      }

      @keyframes formation-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes candidate-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .formation,
        .candidate {
          animation: none;
          opacity: 1;
        }
      }

      @media (max-width: 640px) {
        .candidate {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ];

  @property({ type: Array }) candidates: RecognitionCandidate[] = [];
  @property({ type: String }) simulationId = '';
  @state() private _forming = false;

  private async _formBond(agentId: string) {
    this._forming = true;
    const resp = await bondsApi.formBond(this.simulationId, agentId);
    this._forming = false;

    if (resp.success) {
      analyticsService.trackEvent('bond_formed', {
        simulation_id: this.simulationId,
        agent_id: agentId,
      });
      VelgToast.success(msg('Bond formed'));
      this.dispatchEvent(
        new CustomEvent('bond-formed', {
          bubbles: true,
          composed: true,
          detail: { agentId },
        }),
      );
    } else {
      VelgToast.error(
        resp.error?.message ?? msg('Failed to form bond'),
      );
    }
  }

  protected render() {
    if (!this.candidates.length) return nothing;

    return html`
      <div class="formation">
        <div class="formation__label">
          ${msg('Recognition')}
        </div>
        <div class="candidates">
          ${this.candidates.map(
            (c, i) => html`
              <div class="candidate" style="--i: ${i}">
                <div class="candidate__info">
                  <span class="candidate__name">${c.agent_name}</span>
                  <span class="candidate__whisper">
                    ${msg(
                      'This agent has noticed your attention. A bond can be formed.',
                    )}
                  </span>
                </div>
                <div class="candidate__action">
                  <button
                    class="btn btn--primary btn--sm"
                    ?disabled=${this._forming}
                    @click=${() => this._formBond(c.agent_id)}
                  >
                    ${msg('Form Bond')}
                  </button>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bond-formation': VelgBondFormation;
  }
}
