import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent, EventReaction } from '../../types/index.js';

@customElement('velg-agent-details-panel')
export class VelgAgentDetailsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      justify-content: flex-end;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--transition-normal), visibility var(--transition-normal);
    }

    .backdrop--open {
      opacity: 1;
      visibility: visible;
    }

    .panel {
      width: 100%;
      max-width: 520px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border-left: var(--border-default);
      box-shadow: var(--shadow-xl);
      transform: translateX(100%);
      transition: transform var(--transition-normal);
      overflow: hidden;
    }

    .backdrop--open .panel {
      transform: translateX(0);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      line-height: 1;
      background: transparent;
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .panel__close:hover {
      background: var(--color-surface-sunken);
    }

    .panel__body {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .panel__portrait {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-bottom: var(--border-medium);
    }

    .panel__portrait-placeholder {
      width: 100%;
      aspect-ratio: 3 / 2;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-sunken);
      border-bottom: var(--border-medium);
    }

    .panel__initials {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-5xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .panel__info {
      padding: var(--space-5) var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .panel__badge {
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

    .panel__badge--system {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .panel__badge--gender {
      background: var(--color-surface-header);
    }

    .panel__badge--ai {
      background: var(--color-info-bg);
      border-color: var(--color-info);
      color: var(--color-info);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__section-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin: 0;
      padding-bottom: var(--space-1);
      border-bottom: var(--border-light);
    }

    .panel__section-content {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-relaxed);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .panel__professions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__profession {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__profession-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__profession-level {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .panel__profession-primary {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .panel__reaction {
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-event {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .panel__reaction-text {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-relaxed);
    }

    .panel__reaction-meta {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-1-5);
    }

    .panel__reaction-emotion {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-medium);
      background: var(--color-surface-header);
      flex-shrink: 0;
    }

    .panel__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .panel__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .panel__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .panel__btn--edit {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .panel__btn--danger {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .panel__btn--danger:hover {
      background: var(--color-danger-hover);
    }

    .panel__reactions-loading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-3);
    }

    .panel__empty {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }
  `;

  @property({ type: Object }) agent: Agent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;

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

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('agent') || changedProperties.has('open')) {
      if (this.open && this.agent && this.simulationId) {
        this._loadReactions();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._boundKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
  }

  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      this._close();
    }
  }

  private async _loadReactions(): Promise<void> {
    if (!this.agent || !this.simulationId) return;

    this._reactionsLoading = true;
    try {
      const response = await agentsApi.getReactions(this.simulationId, this.agent.id);
      if (response.success && response.data) {
        this._reactions = response.data;
      } else {
        this._reactions = [];
      }
    } catch {
      this._reactions = [];
    } finally {
      this._reactionsLoading = false;
    }
  }

  private _getInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  private _close(): void {
    this.dispatchEvent(
      new CustomEvent('panel-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._close();
    }
  }

  private _handleEdit(): void {
    if (this.agent) {
      this.dispatchEvent(
        new CustomEvent('agent-edit', {
          detail: this.agent,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _handleDelete(): void {
    if (this.agent) {
      this.dispatchEvent(
        new CustomEvent('agent-delete', {
          detail: this.agent,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _renderProfessions() {
    const professions = this.agent?.professions;
    if (!professions || professions.length === 0) {
      return html`<span class="panel__empty">No professions assigned.</span>`;
    }

    return html`
      <div class="panel__professions">
        ${professions.map(
          (p) => html`
            <div class="panel__profession">
              <span class="panel__profession-name">
                ${p.profession_label ?? p.profession}
                ${p.specialization ? html` - ${p.specialization}` : nothing}
              </span>
              <span>
                ${p.is_primary ? html`<span class="panel__profession-primary">Primary</span>` : nothing}
                <span class="panel__profession-level">Lvl ${p.qualification_level}</span>
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderReactions() {
    if (this._reactionsLoading) {
      return html`<div class="panel__reactions-loading">Loading reactions...</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<span class="panel__empty">No reactions recorded.</span>`;
    }

    return html`
      <div class="panel__reactions">
        ${this._reactions.slice(0, 10).map(
          (r) => html`
            <div class="panel__reaction">
              <div class="panel__reaction-event">${r.event?.title ?? `Event ${r.event_id.slice(0, 8)}`}</div>
              <div class="panel__reaction-text">${r.reaction_text}</div>
              <div class="panel__reaction-meta">
                ${r.emotion ? html`<span class="panel__reaction-emotion">${r.emotion}</span>` : nothing}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  protected render() {
    const agent = this.agent;

    return html`
      <div
        class="backdrop ${this.open ? 'backdrop--open' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">${agent?.name ?? 'Agent Details'}</h2>
            <button
              class="panel__close"
              @click=${this._close}
              aria-label="Close"
            >
              X
            </button>
          </div>

          <div class="panel__body">
            ${
              agent
                ? html`
                ${
                  agent.portrait_image_url
                    ? html`<img class="panel__portrait" src=${agent.portrait_image_url} alt=${agent.name} />`
                    : html`
                      <div class="panel__portrait-placeholder">
                        <span class="panel__initials">${this._getInitials(agent.name)}</span>
                      </div>
                    `
                }

                <div class="panel__info">
                  <div class="panel__badges">
                    ${agent.system ? html`<span class="panel__badge panel__badge--system">${agent.system}</span>` : nothing}
                    ${agent.gender ? html`<span class="panel__badge panel__badge--gender">${agent.gender}</span>` : nothing}
                    ${agent.data_source === 'ai' ? html`<span class="panel__badge panel__badge--ai">AI Generated</span>` : nothing}
                  </div>

                  ${
                    agent.character
                      ? html`
                      <div class="panel__section">
                        <h3 class="panel__section-title">Character</h3>
                        <div class="panel__section-content">${agent.character}</div>
                      </div>
                    `
                      : nothing
                  }

                  ${
                    agent.background
                      ? html`
                      <div class="panel__section">
                        <h3 class="panel__section-title">Background</h3>
                        <div class="panel__section-content">${agent.background}</div>
                      </div>
                    `
                      : nothing
                  }

                  <div class="panel__section">
                    <h3 class="panel__section-title">Professions</h3>
                    ${this._renderProfessions()}
                  </div>

                  <div class="panel__section">
                    <h3 class="panel__section-title">Reactions</h3>
                    ${this._renderReactions()}
                  </div>
                </div>
              `
                : nothing
            }
          </div>

          <div class="panel__footer">
            <button class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
              ${this._deleteIcon()} Delete
            </button>
            <button class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
              ${this._editIcon()} Edit
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-details-panel': VelgAgentDetailsPanel;
  }
}
