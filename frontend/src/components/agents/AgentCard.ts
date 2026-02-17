import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Agent } from '../../types/index.js';
import '../shared/Lightbox.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';

@localized()
@customElement('velg-agent-card')
export class VelgAgentCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
    }

    .card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
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

    .card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3);
      margin-top: auto;
    }
  `;

  @property({ type: Object }) agent!: Agent;
  @state() private _lightboxSrc: string | null = null;

  private _editIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
        <path d="M16 5l3 3" />
      </svg>
    `;
  }

  private _deleteIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7l16 0" />
        <path d="M10 11l0 6" />
        <path d="M14 11l0 6" />
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
        <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
      </svg>
    `;
  }

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
      <div class="card" @click=${this._handleClick}>
        <velg-avatar
          .src=${agent.portrait_image_url ?? ''}
          .name=${agent.name}
          size="full"
          ?clickable=${!!agent.portrait_image_url}
          @avatar-click=${(e: CustomEvent) => {
            e.stopPropagation();
            this._lightboxSrc = (e.detail as { src: string }).src;
          }}
        ></velg-avatar>

        <div class="card__body">
          <h3 class="card__name">${agent.name}</h3>

          <div class="card__badges">
            ${agent.system ? html`<velg-badge variant="primary">${agent.system}</velg-badge>` : null}
            ${agent.data_source === 'ai' ? html`<velg-badge variant="info">${msg('AI Generated')}</velg-badge>` : null}
          </div>

          <div class="card__meta">
            ${agent.gender ? html`<span class="card__meta-item">${agent.gender}</span>` : null}
            ${agent.primary_profession ? html`<span class="card__meta-item">${agent.primary_profession}</span>` : null}
          </div>
        </div>

        ${
          appState.canEdit.value
            ? html`
              <div class="card__actions">
                <velg-icon-button .label=${msg('Edit agent')} @icon-click=${this._handleEdit}>
                  ${this._editIcon()}
                </velg-icon-button>
                <velg-icon-button variant="danger" .label=${msg('Delete agent')} @icon-click=${this._handleDelete}>
                  ${this._deleteIcon()}
                </velg-icon-button>
              </div>
            `
            : nothing
        }
      </div>

      <velg-lightbox
        .src=${this._lightboxSrc}
        @lightbox-close=${() => {
          this._lightboxSrc = null;
        }}
      ></velg-lightbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-card': VelgAgentCard;
  }
}
