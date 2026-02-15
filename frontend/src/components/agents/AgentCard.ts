import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Agent } from '../../types/index.js';

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

    .card__portrait {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-bottom: var(--border-medium);
    }

    .card__portrait-placeholder {
      width: 100%;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-sunken);
      border-bottom: var(--border-medium);
    }

    .card__initials {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-3xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
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

    .card__badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-header);
    }

    .card__badge--system {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .card__badge--ai {
      background: var(--color-info-bg);
      border-color: var(--color-info);
      color: var(--color-info);
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

    .card__action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    .card__action-btn:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    .card__action-btn--danger:hover {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border-color: var(--color-danger);
    }
  `;

  @property({ type: Object }) agent!: Agent;

  private _getInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

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
        ${
          agent.portrait_image_url
            ? html`<img class="card__portrait" src=${agent.portrait_image_url} alt=${agent.name} loading="lazy" />`
            : html`
              <div class="card__portrait-placeholder">
                <span class="card__initials">${this._getInitials(agent.name)}</span>
              </div>
            `
        }

        <div class="card__body">
          <h3 class="card__name">${agent.name}</h3>

          <div class="card__badges">
            ${agent.system ? html`<span class="card__badge card__badge--system">${agent.system}</span>` : null}
            ${agent.data_source === 'ai' ? html`<span class="card__badge card__badge--ai">AI Generated</span>` : null}
          </div>

          <div class="card__meta">
            ${agent.gender ? html`<span class="card__meta-item">${agent.gender}</span>` : null}
            ${agent.primary_profession ? html`<span class="card__meta-item">${agent.primary_profession}</span>` : null}
          </div>
        </div>

        <div class="card__actions">
          <button
            class="card__action-btn"
            @click=${this._handleEdit}
            title="Edit"
            aria-label="Edit agent"
          >
            ${this._editIcon()}
          </button>
          <button
            class="card__action-btn card__action-btn--danger"
            @click=${this._handleDelete}
            title="Delete"
            aria-label="Delete agent"
          >
            ${this._deleteIcon()}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-card': VelgAgentCard;
  }
}
