import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { eventsApi } from '../../services/api/index.js';
import type { EventReaction, Event as SimEvent } from '../../types/index.js';

@customElement('velg-event-details-panel')
export class VelgEventDetailsPanel extends LitElement {
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
      max-width: 540px;
      height: 100%;
      background: var(--color-surface-raised);
      border-left: var(--border-default);
      box-shadow: var(--shadow-xl);
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform var(--transition-normal);
      display: flex;
      flex-direction: column;
    }

    .backdrop--open .panel {
      transform: translateX(0);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
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
      flex: 1;
      min-width: 0;
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
      padding: var(--space-6);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__section-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      padding-bottom: var(--space-1);
      border-bottom: var(--border-light);
    }

    .panel__text {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }

    .panel__text--secondary {
      color: var(--color-text-secondary);
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

    .panel__badge--type {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .panel__badge--source {
      background: var(--color-info-bg);
      border-color: var(--color-info);
      color: var(--color-info);
    }

    .panel__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    /* Impact display */
    .panel__impact {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .panel__impact-bar {
      display: flex;
      gap: 3px;
      align-items: flex-end;
      height: 24px;
      flex: 1;
    }

    .panel__impact-segment {
      flex: 1;
      background: var(--color-border-light);
    }

    .panel__impact-segment--active {
      background: var(--color-primary);
    }

    .panel__impact-segment--high {
      background: var(--color-danger);
    }

    .panel__impact-segment--medium {
      background: var(--color-warning);
    }

    .panel__impact-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      min-width: 36px;
      text-align: center;
    }

    /* Tags */
    .panel__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .panel__tag {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
    }

    /* Metadata */
    .panel__kv-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__kv-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-1-5) 0;
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__kv-key {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__kv-value {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      text-align: right;
      word-break: break-word;
    }

    /* Reactions */
    .panel__reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .panel__reaction {
      padding: var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: var(--space-1-5);
    }

    .panel__reaction-agent {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__reaction-emotion {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-secondary);
    }

    .panel__reaction-text {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    .panel__reaction-empty {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-4);
    }

    .panel__reactions-loading {
      text-align: center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-3);
    }

    /* Footer actions */
    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-medium);
      flex-shrink: 0;
    }

    .panel__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1-5);
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
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .panel__btn--danger {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .panel__btn--danger:hover {
      background: var(--color-danger-hover);
    }
  `;

  @property({ type: Object }) event: SimEvent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('event') || changedProperties.has('open')) {
      if (this.open && this.event) {
        this._loadReactions();
      }
    }
  }

  private async _loadReactions(): Promise<void> {
    if (!this.event || !this.simulationId) return;

    this._reactionsLoading = true;
    try {
      const response = await eventsApi.getReactions(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._reactions = response.data;
      } else {
        this._reactions = this.event.reactions ?? [];
      }
    } catch {
      this._reactions = this.event.reactions ?? [];
    } finally {
      this._reactionsLoading = false;
    }
  }

  private _formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  private _getImpactClass(level: number): string {
    if (level >= 8) return 'high';
    if (level >= 5) return 'medium';
    return 'active';
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

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('panel-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._handleClose();
    }
  }

  private _handleEdit(): void {
    this.dispatchEvent(
      new CustomEvent('event-edit', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent('event-delete', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderImpactBar() {
    if (!this.event) return null;
    const level = this.event.impact_level ?? 1;
    const impactClass = this._getImpactClass(level);

    return html`
      <div class="panel__impact">
        <div class="panel__impact-bar">
          ${Array.from({ length: 10 }, (_, i) => {
            const isActive = i < level;
            const segmentClass = isActive
              ? `panel__impact-segment panel__impact-segment--${impactClass}`
              : 'panel__impact-segment';
            return html`<div class=${segmentClass} style="height: 100%"></div>`;
          })}
        </div>
        <span class="panel__impact-value">${level}</span>
      </div>
    `;
  }

  private _renderMetadata() {
    if (!this.event?.metadata) return null;
    const entries = Object.entries(this.event.metadata);
    if (entries.length === 0) return null;

    return html`
      <div class="panel__section">
        <div class="panel__section-title">Metadata</div>
        <div class="panel__kv-list">
          ${entries.map(
            ([key, value]) => html`
              <div class="panel__kv-item">
                <span class="panel__kv-key">${key}</span>
                <span class="panel__kv-value">${String(value)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderReactions() {
    if (this._reactionsLoading) {
      return html`<div class="panel__reactions-loading">Loading reactions...</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<div class="panel__reaction-empty">No reactions yet</div>`;
    }

    return html`
      <div class="panel__reactions">
        ${this._reactions.map(
          (reaction) => html`
            <div class="panel__reaction">
              <div class="panel__reaction-header">
                <span class="panel__reaction-agent">${reaction.agent_name}</span>
                ${
                  reaction.emotion
                    ? html`<span class="panel__reaction-emotion">${reaction.emotion}</span>`
                    : null
                }
              </div>
              <div class="panel__reaction-text">${reaction.reaction_text}</div>
            </div>
          `,
        )}
      </div>
    `;
  }

  protected render() {
    const evt = this.event;

    return html`
      <div
        class="backdrop ${this.open ? 'backdrop--open' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">${evt?.title ?? 'Event Details'}</h2>
            <button
              class="panel__close"
              @click=${this._handleClose}
              aria-label="Close"
            >
              X
            </button>
          </div>

          ${
            evt
              ? html`
              <div class="panel__body">
                <!-- Type & Source badges -->
                <div class="panel__section">
                  <div class="panel__badges">
                    ${evt.event_type ? html`<span class="panel__badge panel__badge--type">${evt.event_type}</span>` : null}
                    ${evt.data_source ? html`<span class="panel__badge panel__badge--source">${evt.data_source}</span>` : null}
                  </div>
                </div>

                <!-- Description -->
                ${
                  evt.description
                    ? html`
                    <div class="panel__section">
                      <div class="panel__section-title">Description</div>
                      <div class="panel__text">${evt.description}</div>
                    </div>
                  `
                    : null
                }

                <!-- Occurred At -->
                ${
                  evt.occurred_at
                    ? html`
                    <div class="panel__section">
                      <div class="panel__section-title">Occurred At</div>
                      <div class="panel__text">${this._formatDate(evt.occurred_at)}</div>
                    </div>
                  `
                    : null
                }

                <!-- Impact Level -->
                <div class="panel__section">
                  <div class="panel__section-title">Impact Level</div>
                  ${this._renderImpactBar()}
                </div>

                <!-- Location -->
                ${
                  evt.location
                    ? html`
                    <div class="panel__section">
                      <div class="panel__section-title">Location</div>
                      <div class="panel__text">${evt.location}</div>
                    </div>
                  `
                    : null
                }

                <!-- Tags -->
                ${
                  evt.tags && evt.tags.length > 0
                    ? html`
                    <div class="panel__section">
                      <div class="panel__section-title">Tags</div>
                      <div class="panel__tags">
                        ${evt.tags.map((tag) => html`<span class="panel__tag">${tag}</span>`)}
                      </div>
                    </div>
                  `
                    : null
                }

                <!-- Metadata -->
                ${this._renderMetadata()}

                <!-- Reactions -->
                <div class="panel__section">
                  <div class="panel__section-title">
                    Reactions (${this._reactions.length})
                  </div>
                  ${this._renderReactions()}
                </div>
              </div>

              <div class="panel__footer">
                <button
                  class="panel__btn panel__btn--edit"
                  @click=${this._handleEdit}
                >
                  ${this._editIcon()}
                  Edit
                </button>
                <button
                  class="panel__btn panel__btn--danger"
                  @click=${this._handleDelete}
                >
                  ${this._deleteIcon()}
                  Delete
                </button>
              </div>
            `
              : html`
              <div class="panel__body">
                <div class="panel__text panel__text--secondary">No event selected.</div>
              </div>
            `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-details-panel': VelgEventDetailsPanel;
  }
}
