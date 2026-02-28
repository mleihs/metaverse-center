import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Embassy } from '../../types/index.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/VelgBadge.js';

/**
 * Compact embassy partner card for BuildingDetailsPanel.
 * Shows the partner building on the other side of the embassy.
 */
@localized()
@customElement('velg-embassy-link')
export class VelgEmbassyLink extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .embassy {
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface);
      padding: var(--space-4);
      position: relative;
      overflow: hidden;
    }

    .embassy::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid transparent;
      background: linear-gradient(
          90deg,
          var(--color-primary),
          var(--color-secondary),
          var(--color-accent),
          var(--color-primary)
        )
        border-box;
      mask:
        linear-gradient(#fff 0 0) padding-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
      animation: shimmer 4s linear infinite;
      background-size: 200% 100%;
      pointer-events: none;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% center;
      }
      100% {
        background-position: -200% center;
      }
    }

    .embassy__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .embassy__sim-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .embassy__sim-name {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .embassy__partner {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      cursor: pointer;
    }

    .embassy__partner:hover .embassy__name {
      color: var(--color-primary);
    }

    .embassy__thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border: var(--border-width-default) solid var(--color-border);
      flex-shrink: 0;
    }

    .embassy__info {
      flex: 1;
      min-width: 0;
    }

    .embassy__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
      transition: color 0.2s;
    }

    .embassy__type {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: capitalize;
    }

    .embassy__question {
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
      font-style: italic;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .embassy__vector {
      margin-top: var(--space-2);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .embassy__vector-label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }
  `;

  @property({ attribute: false }) embassy: Embassy | null = null;

  /** The current building's ID — used to determine which side is the "partner". */
  @property({ type: String }) currentBuildingId = '';

  private _getPartner(): {
    building: Embassy['building_a'];
    simulation: Embassy['simulation_a'];
  } | null {
    if (!this.embassy) return null;
    if (this.currentBuildingId === this.embassy.building_a_id) {
      return { building: this.embassy.building_b, simulation: this.embassy.simulation_b };
    }
    return { building: this.embassy.building_a, simulation: this.embassy.simulation_a };
  }

  private _handlePartnerClick(): void {
    const partner = this._getPartner();
    if (!partner?.building || !partner?.simulation) return;

    const slug = partner.simulation.slug ?? partner.simulation.id;
    const event = new CustomEvent('navigate-embassy', {
      detail: {
        simulationSlug: slug,
        buildingId: partner.building.id,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private _getThemeColor(theme?: string): string {
    return getThemeColor(theme ?? '');
  }

  protected render() {
    if (!this.embassy) return nothing;

    const partner = this._getPartner();
    if (!partner?.building || !partner?.simulation) return nothing;

    const statusVariant =
      this.embassy.status === 'active'
        ? 'success'
        : this.embassy.status === 'suspended'
          ? 'warning'
          : 'default';

    return html`
      <div class="embassy">
        <div class="embassy__header">
          <span
            class="embassy__sim-dot"
            style="background: ${this._getThemeColor(partner.simulation.theme)}"
          ></span>
          <span class="embassy__sim-name">${partner.simulation.name}</span>
          <velg-badge variant=${statusVariant}>${this.embassy.status}</velg-badge>
        </div>

        <div class="embassy__partner" @click=${this._handlePartnerClick}>
          ${
            partner.building.image_url
              ? html`<img
                class="embassy__thumb"
                src=${partner.building.image_url}
                alt=${partner.building.name}
                loading="lazy"
              />`
              : nothing
          }
          <div class="embassy__info">
            <div class="embassy__name">${partner.building.name}</div>
            <div class="embassy__type">${partner.building.building_type}</div>
          </div>
        </div>

        ${
          this.embassy.description
            ? html`<div class="embassy__question">${this.embassy.description}</div>`
            : nothing
        }
        ${
          this.embassy.bleed_vector
            ? html`
              <div class="embassy__vector">
                <span class="embassy__vector-label">${msg('Vector')}:</span>
                <velg-badge variant="info">${this.embassy.bleed_vector}</velg-badge>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-embassy-link': VelgEmbassyLink;
  }
}
