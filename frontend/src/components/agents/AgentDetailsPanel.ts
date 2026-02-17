import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent, EventReaction } from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import '../shared/Lightbox.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';

@localized()
@customElement('velg-agent-details-panel')
export class VelgAgentDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    css`
    :host {
      display: block;
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

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
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
      gap: var(--space-1);
    }

    .panel__reaction {
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast);
    }

    .panel__reaction-header:hover {
      background: var(--color-surface-header);
    }

    .panel__reaction-chevron {
      flex-shrink: 0;
      color: var(--color-text-muted);
      transition: transform var(--transition-fast);
    }

    .panel__reaction-chevron--open {
      transform: rotate(90deg);
    }

    .panel__reaction-event {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel__reaction-emotion {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__reaction-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      flex-shrink: 0;
      transition: color var(--transition-fast);
    }

    .panel__reaction-delete:hover {
      color: var(--color-danger);
    }

    .panel__reaction-body {
      padding: 0 var(--space-3) var(--space-3) var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-text {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-relaxed);
      padding-top: var(--space-2);
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
  `,
  ];

  @property({ type: Object }) agent: Agent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;
  @state() private _expandedReactions: Set<string> = new Set();
  @state() private _lightboxSrc: string | null = null;

  private _chevronIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 6l6 6l-6 6" />
      </svg>
    `;
  }

  private _trashIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7l16 0" />
        <path d="M10 11l0 6" />
        <path d="M14 11l0 6" />
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
        <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
      </svg>
    `;
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

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('agent') || changedProperties.has('open')) {
      if (this.open && this.agent && this.simulationId) {
        this._expandedReactions = new Set();
        this._loadReactions();
      }
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

  private _toggleReaction(reactionId: string): void {
    const next = new Set(this._expandedReactions);
    if (next.has(reactionId)) {
      next.delete(reactionId);
    } else {
      next.add(reactionId);
    }
    this._expandedReactions = next;
  }

  private async _handleDeleteReaction(reaction: EventReaction): Promise<void> {
    if (!this.agent) return;

    const eventTitle = reaction.events?.title ?? reaction.event_id.slice(0, 8);
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete reaction'),
      message: msg(str`Delete reaction of ${this.agent.name} to "${eventTitle}"?`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    const response = await agentsApi.deleteReaction(this.simulationId, this.agent.id, reaction.id);
    if (response.success) {
      this._reactions = this._reactions.filter((r) => r.id !== reaction.id);
      VelgToast.success(msg('Reaction deleted'));
    } else {
      VelgToast.error(response.error?.message ?? msg('Failed to delete reaction'));
    }
  }

  private _renderProfessions() {
    const professions = this.agent?.professions;
    if (!professions || professions.length === 0) {
      return html`<span class="panel__empty">${msg('No professions assigned.')}</span>`;
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
                ${p.is_primary ? html`<span class="panel__profession-primary">${msg('Primary')}</span>` : nothing}
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
      return html`<div class="panel__reactions-loading">${msg('Loading reactions...')}</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<span class="panel__empty">${msg('No reactions recorded.')}</span>`;
    }

    return html`
      <div class="panel__reactions">
        ${this._reactions.map((r) => {
          const isOpen = this._expandedReactions.has(r.id);
          const eventTitle = r.events?.title ?? r.event_id.slice(0, 8);
          return html`
            <div class="panel__reaction">
              <div
                class="panel__reaction-header"
                @click=${() => this._toggleReaction(r.id)}
              >
                <span class="panel__reaction-chevron ${isOpen ? 'panel__reaction-chevron--open' : ''}">
                  ${this._chevronIcon()}
                </span>
                <span class="panel__reaction-event">${eventTitle}</span>
                ${r.emotion ? html`<span class="panel__reaction-emotion">${r.emotion}</span>` : nothing}
                <button
                  class="panel__reaction-delete"
                  title=${msg('Delete reaction')}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    this._handleDeleteReaction(r);
                  }}
                >
                  ${this._trashIcon()}
                </button>
              </div>
              ${
                isOpen
                  ? html`
                  <div class="panel__reaction-body">
                    <div class="panel__reaction-text">${r.reaction_text}</div>
                  </div>
                `
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  protected render() {
    const agent = this.agent;

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${agent?.name ?? msg('Agent Details')}
      >
        ${
          agent
            ? html`
              <velg-avatar
                slot="media"
                .src=${agent.portrait_image_url ?? ''}
                .name=${agent.name}
                size="full"
                ?clickable=${!!agent.portrait_image_url}
                @avatar-click=${(e: CustomEvent) => {
                  this._lightboxSrc = (e.detail as { src: string }).src;
                }}
              ></velg-avatar>

              <div slot="content">
                <div class="panel__info">
                  <div class="panel__badges">
                    ${agent.system ? html`<velg-badge variant="primary">${agent.system}</velg-badge>` : nothing}
                    ${agent.gender ? html`<velg-badge>${agent.gender}</velg-badge>` : nothing}
                    ${agent.data_source === 'ai' ? html`<velg-badge variant="info">${msg('AI Generated')}</velg-badge>` : nothing}
                  </div>

                  ${
                    agent.character
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Character')}</velg-section-header>
                        <div class="panel__section-content">${agent.character}</div>
                      </div>
                    `
                      : nothing
                  }

                  ${
                    agent.background
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Background')}</velg-section-header>
                        <div class="panel__section-content">${agent.background}</div>
                      </div>
                    `
                      : nothing
                  }

                  <div class="panel__section">
                    <velg-section-header>${msg('Professions')}</velg-section-header>
                    ${this._renderProfessions()}
                  </div>

                  <div class="panel__section">
                    <velg-section-header>${msg('Reactions')}</velg-section-header>
                    ${this._renderReactions()}
                  </div>
                </div>
              </div>

              <button slot="footer" class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
                ${this._editIcon()} ${msg('Edit')}
              </button>
              <button slot="footer" class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
                ${this._deleteIcon()} ${msg('Delete')}
              </button>
            `
            : nothing
        }
      </velg-side-panel>

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
    'velg-agent-details-panel': VelgAgentDetailsPanel;
  }
}
