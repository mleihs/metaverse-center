import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Agent } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';
import { cardStyles } from '../shared/card-styles.js';

@localized()
@customElement('velg-agent-card')
export class VelgAgentCard extends LitElement {
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
      flex-direction: column;
    }

    .card__body {
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: 1;
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .card__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .card__meta-item {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__connections {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3);
      margin-top: auto;
    }
  `,
  ];

  @property({ type: Object }) agent!: Agent;
  @property({ type: Number }) relationshipCount = 0;

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('agent-click', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('agent-edit', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('agent-delete', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const agent = this.agent;
    if (!agent) return html``;

    return html`
      <div class="card ${agent.is_ambassador ? 'card--embassy' : ''}" @click=${this._handleClick}>
        <velg-avatar
          .src=${agent.portrait_image_url ?? ''}
          .name=${agent.name}
          size="full"
        ></velg-avatar>

        <div class="card__body">
          <h3 class="card__name">${agent.name}</h3>

          <div class="card__badges">
            ${agent.system ? html`<velg-badge variant="primary">${agent.system}</velg-badge>` : null}
            ${agent.is_ambassador ? html`<velg-badge variant="warning">${msg('Ambassador')}</velg-badge>` : null}
            ${
              agent.ambassador_blocked_until &&
              new Date(agent.ambassador_blocked_until) > new Date()
                ? html`<velg-badge variant="danger" title=${msg('Ambassador status temporarily suspended')}>${msg('Blocked')}</velg-badge>`
                : null
            }
            ${agent.data_source === 'ai' ? html`<velg-badge variant="info">${msg('AI Generated')}</velg-badge>` : null}
          </div>

          <div class="card__meta">
            ${agent.gender ? html`<span class="card__meta-item">${agent.gender}</span>` : null}
            ${agent.primary_profession ? html`<span class="card__meta-item">${agent.primary_profession}</span>` : null}
            ${this.relationshipCount > 0 ? html`<span class="card__connections">${msg(str`${this.relationshipCount} connections`)}</span>` : null}
          </div>
        </div>

        ${
          appState.canEdit.value
            ? html`
              <div class="card__actions">
                <velg-icon-button .label=${msg('Edit agent')} @icon-click=${this._handleEdit}>
                  ${icons.edit()}
                </velg-icon-button>
                <velg-icon-button variant="danger" .label=${msg('Delete agent')} @icon-click=${this._handleDelete}>
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
    'velg-agent-card': VelgAgentCard;
  }
}
