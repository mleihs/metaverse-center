import { localized, msg } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AgentBrief, ChatConversation } from '../../types/index.js';
import '../shared/VelgAvatar.js';

@localized()
@customElement('velg-conversation-list')
export class VelgConversationList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .list {
      display: flex;
      flex-direction: column;
    }

    .conversation {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-light);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .conversation:hover {
      background: var(--color-surface-sunken);
    }

    .conversation--active {
      background: var(--color-surface-sunken);
      border-left: var(--border-width-heavy) solid var(--color-primary);
    }

    .conversation__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* Portrait stack for multi-agent */
    .conversation__portraits {
      display: flex;
      flex-shrink: 0;
    }

    .conversation__portrait-overflow {
      width: 24px;
      height: 24px;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      font-family: var(--font-mono);
      font-size: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: -6px;
      flex-shrink: 0;
      border: var(--border-width-thin) solid var(--color-surface);
    }

    .conversation__agent-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .conversation__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--color-text-inverse);
      background: var(--color-primary);
      flex-shrink: 0;
    }

    .conversation__preview {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conversation__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .conversation__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .conversation__status {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-warning-bg);
      color: var(--color-warning-hover);
      border: var(--border-width-thin) solid var(--color-warning-border);
    }

    .conversation__actions {
      display: none;
      gap: var(--space-1);
    }

    .conversation:hover .conversation__actions {
      display: flex;
    }

    .conversation__action-btn {
      padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-muted);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .conversation__action-btn:hover {
      color: var(--color-text-danger);
      border-color: var(--color-danger-border);
      background: var(--color-danger-bg);
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      text-align: center;
    }
  `;

  @property({ type: Array }) conversations: ChatConversation[] = [];
  @property({ type: String }) selectedId = '';

  private _formatTime(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return msg('Now');
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  private _truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  /** Get agents from conversation (prefer agents[], fallback to single agent) */
  private _getAgents(conversation: ChatConversation): AgentBrief[] {
    if (conversation.agents && conversation.agents.length > 0) {
      return conversation.agents;
    }
    if (conversation.agent) {
      return [
        {
          id: conversation.agent.id,
          name: conversation.agent.name,
          portrait_image_url: conversation.agent.portrait_image_url,
        },
      ];
    }
    return [];
  }

  private _getDisplayName(agents: AgentBrief[]): string {
    if (agents.length === 0) return msg('Agent');
    if (agents.length === 1) return agents[0].name;
    if (agents.length === 2) return `${agents[0].name}, ${agents[1].name}`;
    return `${agents[0].name}, ${agents[1].name} +${agents.length - 2}`;
  }

  private _handleSelect(conversation: ChatConversation): void {
    this.dispatchEvent(
      new CustomEvent('conversation-select', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleArchive(e: Event, conversation: ChatConversation): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('conversation-archive', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event, conversation: ChatConversation): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('conversation-delete', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderPortraitStack(agents: AgentBrief[]): TemplateResult {
    if (agents.length === 0) {
      return html`<velg-avatar .name=${msg('Agent')} size="sm"></velg-avatar>`;
    }

    // Single agent: full size
    if (agents.length === 1) {
      const agent = agents[0];
      return html`<velg-avatar .src=${agent.portrait_image_url ?? ''} .name=${agent.name} size="sm"></velg-avatar>`;
    }

    // Multi-agent: stacked
    const maxVisible = 3;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    return html`
      <div class="conversation__portraits">
        ${visible.map((agent, i) =>
          html`<velg-avatar
            .src=${agent.portrait_image_url ?? ''}
            .name=${agent.name}
            size="xs"
            style="margin-left: ${i > 0 ? '-6px' : '0'}"
          ></velg-avatar>`,
        )}
        ${overflow > 0 ? html`<div class="conversation__portrait-overflow">+${overflow}</div>` : null}
      </div>
    `;
  }

  private _renderConversation(conversation: ChatConversation) {
    const isActive = conversation.id === this.selectedId;
    const agents = this._getAgents(conversation);
    const displayName = this._getDisplayName(agents);
    const lastPreview = conversation.title ?? msg('No messages yet');

    return html`
      <div
        class="conversation ${isActive ? 'conversation--active' : ''}"
        @click=${() => this._handleSelect(conversation)}
      >
        <div class="conversation__header">
          ${this._renderPortraitStack(agents)}
          <div class="conversation__agent-name">${displayName}</div>
          ${
            conversation.message_count > 0
              ? html`<div class="conversation__badge">${conversation.message_count}</div>`
              : null
          }
        </div>

        <div class="conversation__preview">${this._truncate(lastPreview, 60)}</div>

        <div class="conversation__footer">
          <div class="conversation__time">
            ${this._formatTime(conversation.last_message_at ?? conversation.created_at)}
          </div>

          ${
            conversation.status === 'archived'
              ? html`
                <div class="conversation__status">${msg('Archived')}</div>
                <div class="conversation__actions">
                  <button
                    class="conversation__action-btn"
                    @click=${(e: Event) => this._handleDelete(e, conversation)}
                  >
                    ${msg('Delete')}
                  </button>
                </div>
              `
              : html`
                <div class="conversation__actions">
                  <button
                    class="conversation__action-btn"
                    @click=${(e: Event) => this._handleArchive(e, conversation)}
                  >
                    ${msg('Archive')}
                  </button>
                  <button
                    class="conversation__action-btn"
                    @click=${(e: Event) => this._handleDelete(e, conversation)}
                  >
                    ${msg('Delete')}
                  </button>
                </div>
              `
          }
        </div>
      </div>
    `;
  }

  protected render() {
    if (this.conversations.length === 0) {
      return html`<div class="empty">${msg('No conversations yet')}</div>`;
    }

    return html`
      <div class="list">
        ${this.conversations.map((conv) => this._renderConversation(conv))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-conversation-list': VelgConversationList;
  }
}
