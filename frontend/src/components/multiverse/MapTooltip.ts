import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MapNodeData } from './map-types.js';

@localized()
@customElement('velg-map-tooltip')
export class VelgMapTooltip extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      pointer-events: none;
      z-index: var(--z-tooltip, 50);
    }

    .tooltip {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      max-width: 260px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    }

    .tooltip__name {
      font-family: var(--font-brutalist, monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2, 8px);
    }

    .tooltip__desc {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary);
      line-height: 1.4;
      margin: 0 0 var(--space-2, 8px);
    }

    .tooltip__stats {
      display: flex;
      gap: var(--space-3, 12px);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
    }

    .tooltip__stat-value {
      font-weight: var(--font-bold, 700);
      color: var(--color-text-primary);
    }
  `;

  @property({ type: Object }) node: MapNodeData | null = null;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  protected render() {
    if (!this.node) return nothing;
    this.style.left = `${this.x + 12}px`;
    this.style.top = `${this.y - 10}px`;

    return html`
      <div class="tooltip">
        <h4 class="tooltip__name">${this.node.name}</h4>
        ${
          this.node.description
            ? html`<p class="tooltip__desc">${this.node.description}</p>`
            : nothing
        }
        <div class="tooltip__stats">
          <span><span class="tooltip__stat-value">${this.node.agentCount}</span> ${msg('Agents')}</span>
          <span><span class="tooltip__stat-value">${this.node.buildingCount}</span> ${msg('Buildings')}</span>
          <span><span class="tooltip__stat-value">${this.node.eventCount}</span> ${msg('Events')}</span>
        </div>
      </div>
    `;
  }
}
