import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SCORE_DIMENSION_COLORS } from './map-data.js';
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
      max-width: 280px;
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

    .tooltip__badge {
      display: inline-block;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      margin-bottom: var(--space-2, 8px);
    }

    .tooltip__scores {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 2px 8px;
      font-size: var(--text-xs, 12px);
      margin-top: var(--space-2, 8px);
    }

    .tooltip__score-label {
      color: var(--color-text-muted);
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.06em;
    }

    .tooltip__score-bar {
      height: 6px;
      background: var(--color-surface-sunken, #111);
      align-self: center;
    }

    .tooltip__score-fill {
      height: 100%;
    }

    .tooltip__score-value {
      color: var(--color-text-secondary);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-align: right;
    }
  `;

  @property({ type: Object }) node: MapNodeData | null = null;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  protected updated(): void {
    this.style.left = `${this.x + 12}px`;
    this.style.top = `${this.y - 10}px`;
  }

  protected render() {
    if (!this.node) return nothing;

    const isInstance = this.node.simulationType === 'game_instance';
    const isTemplate = !isInstance;
    const instanceCount = this.node.activeInstanceCount ?? 0;
    const scores = this.node.scoreDimensions;

    const scoreDims: { label: string; key: string; color: string }[] = [
      { label: 'STA', key: 'stability', color: SCORE_DIMENSION_COLORS.stability },
      { label: 'INF', key: 'influence', color: SCORE_DIMENSION_COLORS.influence },
      { label: 'SOV', key: 'sovereignty', color: SCORE_DIMENSION_COLORS.sovereignty },
      { label: 'DIP', key: 'diplomatic', color: SCORE_DIMENSION_COLORS.diplomatic },
      { label: 'MIL', key: 'military', color: SCORE_DIMENSION_COLORS.military },
    ];

    return html`
      <div class="tooltip">
        <h4 class="tooltip__name">${this.node.name}</h4>
        ${
          isInstance
            ? html`
          <p class="tooltip__desc" style="color: var(--color-text-secondary); font-weight: 700;">
            ${msg('Game Instance')}
            ${this.node.epochStatus ? html` — <span style="text-transform: uppercase">${this.node.epochStatus}</span>` : nothing}
          </p>
        `
            : nothing
        }
        ${
          isTemplate && instanceCount > 0
            ? html`<div class="tooltip__badge">${instanceCount} ${msg('Active Epochs')}</div>`
            : nothing
        }
        ${
          isTemplate && this.node.description
            ? html`<p class="tooltip__desc">${this.node.description}</p>`
            : nothing
        }
        <div class="tooltip__stats">
          <span><span class="tooltip__stat-value">${this.node.agentCount}</span> ${msg('Agents')}</span>
          <span><span class="tooltip__stat-value">${this.node.buildingCount}</span> ${msg('Buildings')}</span>
          <span><span class="tooltip__stat-value">${this.node.eventCount}</span> ${msg('Events')}</span>
        </div>
        ${
          isInstance && scores
            ? html`
          <div class="tooltip__scores">
            ${scoreDims.map((d) => {
              const val = Math.round(scores[d.key as keyof typeof scores] ?? 0);
              return html`
                <span class="tooltip__score-label">${d.label}</span>
                <div class="tooltip__score-bar">
                  <div class="tooltip__score-fill" style="width: ${Math.min(100, val)}%; background: ${d.color}"></div>
                </div>
                <span class="tooltip__score-value">${val}</span>
              `;
            })}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }
}
