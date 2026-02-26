import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { AgentRelationship } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';
import { cardStyles } from '../shared/card-styles.js';

@localized()
@customElement('velg-relationship-card')
export class VelgRelationshipCard extends LitElement {
  static styles = [
    cardStyles,
    css`
    :host {
      display: block;
    }

    .card {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 0;
    }

    .card__avatar {
      flex-shrink: 0;
      width: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-3);
    }

    .card__body {
      flex: 1;
      min-width: 0;
      padding: var(--space-3) var(--space-3) var(--space-3) 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .card__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .card__intensity {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      flex-shrink: 0;
    }

    .card__intensity-bar {
      display: flex;
      gap: 2px;
      align-items: flex-end;
      height: 16px;
    }

    .card__intensity-segment {
      width: 3px;
      background: var(--color-border-light);
      transition: background var(--transition-fast);
    }

    .card__intensity-segment--active {
      background: var(--color-primary);
    }

    .card__intensity-segment--high {
      background: var(--color-danger);
    }

    .card__intensity-segment--medium {
      background: var(--color-warning);
    }

    .card__intensity-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .card__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      flex-shrink: 0;
      align-self: center;
    }
  `,
  ];

  @property({ type: Object }) relationship!: AgentRelationship;
  @property({ type: String }) currentAgentId = '';

  private get _otherAgent(): { name: string; portraitUrl: string } {
    const rel = this.relationship;
    if (!rel) return { name: '', portraitUrl: '' };

    const isSource = rel.source_agent_id === this.currentAgentId;
    const other = isSource ? rel.target_agent : rel.source_agent;

    return {
      name: other?.name ?? msg('Unknown Agent'),
      portraitUrl: other?.portrait_image_url ?? '',
    };
  }

  private _getIntensityClass(level: number): string {
    if (level >= 8) return 'high';
    if (level >= 5) return 'medium';
    return 'active';
  }

  private _handleClick(): void {
    const rel = this.relationship;
    const isSource = rel.source_agent_id === this.currentAgentId;
    const otherAgentId = isSource ? rel.target_agent_id : rel.source_agent_id;

    this.dispatchEvent(
      new CustomEvent('relationship-click', {
        detail: { agentId: otherAgentId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('relationship-edit', {
        detail: this.relationship,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('relationship-delete', {
        detail: this.relationship,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderIntensityBar() {
    const level = this.relationship.intensity ?? 1;
    const intensityClass = this._getIntensityClass(level);

    return html`
      <div class="card__intensity">
        <div class="card__intensity-bar">
          ${Array.from({ length: 10 }, (_, i) => {
            const height = 3 + (i + 1) * 1.3;
            const isActive = i < level;
            const segmentClass = isActive
              ? `card__intensity-segment card__intensity-segment--${intensityClass}`
              : 'card__intensity-segment';
            return html`
              <div
                class=${segmentClass}
                style="height: ${height}px"
              ></div>
            `;
          })}
        </div>
        <span class="card__intensity-label">${level}</span>
      </div>
    `;
  }

  protected render() {
    const rel = this.relationship;
    if (!rel) return html``;

    const other = this._otherAgent;

    return html`
      <div class="card" @click=${this._handleClick}>
        <div class="card__avatar">
          <velg-avatar
            .src=${other.portraitUrl}
            .name=${other.name}
            size="sm"
          ></velg-avatar>
        </div>

        <div class="card__body">
          <div class="card__header">
            <h4 class="card__name">${other.name}</h4>
            ${this._renderIntensityBar()}
          </div>

          <div>
            ${
              rel.relationship_type
                ? html`<velg-badge variant="primary">${rel.relationship_type}</velg-badge>`
                : nothing
            }
            ${
              rel.is_bidirectional
                ? html`<velg-badge variant="info">${msg('Mutual')}</velg-badge>`
                : nothing
            }
          </div>

          ${
            rel.description
              ? html`<span class="card__description">${rel.description}</span>`
              : nothing
          }
        </div>

        ${
          appState.canEdit.value
            ? html`
            <div class="card__actions">
              <velg-icon-button .label=${msg('Edit relationship')} @icon-click=${this._handleEdit}>
                ${icons.edit()}
              </velg-icon-button>
              <velg-icon-button variant="danger" .label=${msg('Delete relationship')} @icon-click=${this._handleDelete}>
                ${icons.trash()}
              </velg-icon-button>
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
    'velg-relationship-card': VelgRelationshipCard;
  }
}
