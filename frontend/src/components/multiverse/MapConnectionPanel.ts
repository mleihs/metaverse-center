import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { VECTOR_LABELS } from './map-data.js';
import type { MapEdgeData, MapNodeData } from './map-types.js';
import '../shared/VelgSidePanel.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-map-connection-panel')
export class VelgMapConnectionPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel__content {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__sims {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-brutalist, monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base, 16px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--color-text, #fff);
    }

    .panel__arrow {
      color: var(--color-text-muted, #888);
      font-size: var(--text-lg, 18px);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__label {
      font-size: var(--text-xs, 12px);
      font-weight: var(--font-bold, 700);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted, #888);
    }

    .panel__value {
      color: var(--color-text, #fff);
      font-size: var(--text-sm, 14px);
      line-height: 1.5;
    }

    .panel__vectors {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .panel__strength {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .panel__strength-bar {
      flex: 1;
      height: 6px;
      background: var(--color-border-light, #333);
      position: relative;
    }

    .panel__strength-fill {
      height: 100%;
      background: var(--color-primary, #ef4444);
      transition: width 0.3s ease;
    }

    .panel__strength-label {
      font-size: var(--text-sm, 14px);
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #fff);
      min-width: 36px;
      text-align: right;
    }

    .panel__description {
      color: var(--color-text-secondary, #aaa);
      font-size: var(--text-sm, 14px);
      line-height: 1.6;
      font-style: italic;
    }
  `;

  @property({ type: Object }) edge: MapEdgeData | null = null;
  @property({ type: Array }) nodes: MapNodeData[] = [];
  @property({ type: Boolean, reflect: true }) open = false;

  private _getNode(id: string): MapNodeData | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.edge) return nothing;

    const source = this._getNode(this.edge.sourceId);
    const target = this._getNode(this.edge.targetId);

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${msg('Connection Details')}
        @panel-close=${this._handleClose}
      >
        <div slot="content" class="panel__content">
          <div class="panel__sims">
            <span>${source?.name ?? '?'}</span>
            <span class="panel__arrow">\u2194</span>
            <span>${target?.name ?? '?'}</span>
          </div>

          <div class="panel__section">
            <span class="panel__label">${msg('Connection Type')}</span>
            <span class="panel__value">${this.edge.connectionType}</span>
          </div>

          <div class="panel__section">
            <span class="panel__label">${msg('Bleed Vectors')}</span>
            <div class="panel__vectors">
              ${this.edge.bleedVectors.map(
                (v) => html`<velg-badge variant="info">${VECTOR_LABELS[v] ?? v}</velg-badge>`,
              )}
            </div>
          </div>

          <div class="panel__section">
            <span class="panel__label">${msg('Strength')}</span>
            <div class="panel__strength">
              <div class="panel__strength-bar">
                <div
                  class="panel__strength-fill"
                  style="width: ${this.edge.strength * 100}%"
                ></div>
              </div>
              <span class="panel__strength-label">${Math.round(this.edge.strength * 100)}%</span>
            </div>
          </div>

          ${
            this.edge.description
              ? html`
              <div class="panel__section">
                <span class="panel__label">${msg('Description')}</span>
                <p class="panel__description">${this.edge.description}</p>
              </div>
            `
              : nothing
          }
        </div>
      </velg-side-panel>
    `;
  }
}
