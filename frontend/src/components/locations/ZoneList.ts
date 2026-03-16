import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Zone, ZoneStability } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

@localized()
@customElement('velg-zone-list')
export class VelgZoneList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .item {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .item:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .item:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .item__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0 0 var(--space-2);
    }

    .item__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      margin-bottom: var(--space-2);
    }

    .item__meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .item__badges {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin-top: var(--space-3);
    }

    .item__badge {
      display: inline-flex;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      color: var(--color-primary);
    }

    .item__badge--security {
      background: var(--color-warning-bg);
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    /* --- Stability bar --- */

    .item__stability {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .item__stability-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .item__stability-track {
      flex: 1;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: hidden;
    }

    .item__stability-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .item__stability-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      min-width: 28px;
      text-align: right;
    }

    /* Fortification / Quarantine / Cascade overlays */
    .item--quarantined {
      border-color: var(--color-warning);
      background: repeating-linear-gradient(
        45deg,
        var(--color-surface-raised),
        var(--color-surface-raised) 8px,
        color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-raised)) 8px,
        color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-raised)) 16px
      );
    }

    .item__overlays {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin-top: var(--space-2);
    }

    .item__overlay-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .item__overlay-badge--fortified {
      background: color-mix(in srgb, var(--color-success) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-success) 40%, transparent);
      color: var(--color-success);
    }

    .item__overlay-badge--quarantine {
      background: color-mix(in srgb, var(--color-warning) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-warning) 40%, transparent);
      color: var(--color-warning);
    }

    .item__overlay-badge--cascade-risk {
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 40%, transparent);
      color: var(--color-danger);
    }

    .item__cascade-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-danger);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    @media (prefers-reduced-motion: reduce) {
      .item__cascade-dot { animation: none; }
    }

    .item__pressure-text {
      font-family: var(--font-brutalist);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }
  `;

  @property({ attribute: false }) zones: Zone[] = [];
  @property({ attribute: false }) stabilityMap: Map<string, ZoneStability> = new Map();

  private _stabilityColor(value: number): string {
    if (value < 0.3) return 'var(--color-danger)';
    if (value < 0.5) return 'var(--color-accent)';
    if (value < 0.7) return 'var(--color-success)';
    return 'var(--color-primary)';
  }

  private _handleSelect(zone: Zone): void {
    this.dispatchEvent(
      new CustomEvent('zone-select', {
        detail: zone,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderStabilityBar(zoneId: string) {
    const stability = this.stabilityMap.get(zoneId);
    if (!stability) return nothing;

    const pct = Math.round(stability.stability * 100);
    const color = this._stabilityColor(stability.stability);

    return html`
      <div class="item__stability">
        <span class="item__stability-label">${msg('Stability')}</span>
        <div class="item__stability-track">
          <div
            class="item__stability-fill"
            style="width: ${pct}%; background: ${color}"
          ></div>
        </div>
        <span class="item__stability-value" style="color: ${color}">${pct}%</span>
      </div>
    `;
  }

  private _renderOverlays(zoneId: string) {
    const stability = this.stabilityMap.get(zoneId);
    if (!stability) return nothing;

    const hasFortification = stability.fortification_reduction > 0;
    const isQuarantined = stability.is_quarantined;
    const hasCascadeRisk = stability.event_pressure > 0.7;

    if (!hasFortification && !isQuarantined && !hasCascadeRisk) return nothing;

    return html`
      <div class="item__overlays">
        ${
          hasFortification && !isQuarantined
            ? html`<span class="item__overlay-badge item__overlay-badge--fortified"
              aria-label=${msg('Zone fortified')}
            >${msg('Fortified')}</span>`
            : nothing
        }
        ${
          isQuarantined
            ? html`<span class="item__overlay-badge item__overlay-badge--quarantine"
              aria-label=${msg('Zone quarantined')}
            >${msg('Quarantined')}</span>`
            : nothing
        }
        ${
          hasCascadeRisk
            ? html`<span class="item__overlay-badge item__overlay-badge--cascade-risk"
              aria-label=${msg('Cascade risk: zone pressure exceeds threshold')}
            ><span class="item__cascade-dot"></span> ${msg('Cascade Risk')}</span>`
            : nothing
        }
      </div>
      ${
        stability.total_pressure > 0
          ? html`<div class="item__pressure-text">
            ${msg(str`Pressure: ${Math.round(stability.event_pressure * 100)}% targeted + ${Math.round(stability.ambient_pressure * 100)}% ambient${stability.fortification_reduction > 0 ? ` - ${Math.round(stability.fortification_reduction * 100)}% fortification` : ''}`)}
          </div>`
          : nothing
      }
    `;
  }

  protected render() {
    return html`
      <div class="list">
        ${this.zones.map((zone) => {
          const stability = this.stabilityMap.get(zone.id);
          const isQuarantined = stability?.is_quarantined ?? false;
          return html`
            <div class="item ${isQuarantined ? 'item--quarantined' : ''}" role="button" tabindex="0" @click=${() => this._handleSelect(zone)} @keydown=${(
              e: KeyboardEvent,
            ) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._handleSelect(zone);
              }
            }}>
              <h3 class="item__name">${zone.name}</h3>
              ${
                zone.description
                  ? html`<div class="item__description">${t(zone, 'description')}</div>`
                  : nothing
              }
              ${
                zone.population_estimate
                  ? html`<div class="item__meta">
                    ${msg(str`Est. Population: ${zone.population_estimate.toLocaleString()}`)}
                  </div>`
                  : nothing
              }
              <div class="item__badges">
                ${
                  zone.zone_type
                    ? html`<span class="item__badge">${t(zone, 'zone_type')}</span>`
                    : nothing
                }
                ${
                  zone.security_level
                    ? html`<span class="item__badge item__badge--security">${zone.security_level}</span>`
                    : nothing
                }
              </div>
              ${this._renderStabilityBar(zone.id)}
              ${this._renderOverlays(zone.id)}
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-zone-list': VelgZoneList;
  }
}
