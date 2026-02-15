import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ChatConversation } from '../../types/index.js';

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
      justify-content: space-between;
      gap: var(--space-2);
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

    .conversation__archive-btn {
      display: none;
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

    .conversation:hover .conversation__archive-btn {
      display: block;
    }

    .conversation__archive-btn:hover {
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

      if (diffMins < 1) return 'Now';
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

  private _renderConversation(conversation: ChatConversation) {
    const isActive = conversation.id === this.selectedId;
    const agentName = conversation.agent?.name ?? 'Agent';
    const lastPreview = conversation.title ?? 'No messages yet';

    return html`
      <div
        class="conversation ${isActive ? 'conversation--active' : ''}"
        @click=${() => this._handleSelect(conversation)}
      >
        <div class="conversation__header">
          <div class="conversation__agent-name">${agentName}</div>
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
              ? html`<div class="conversation__status">Archived</div>`
              : html`
                <button
                  class="conversation__archive-btn"
                  @click=${(e: Event) => this._handleArchive(e, conversation)}
                >
                  Archive
                </button>
              `
          }
        </div>
      </div>
    `;
  }

  protected render() {
    if (this.conversations.length === 0) {
      return html`<div class="empty">No conversations yet</div>`;
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
