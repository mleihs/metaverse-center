import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ChatMessage } from '../../types/index.js';

@customElement('velg-message-list')
export class VelgMessageList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-6);
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 75%;
    }

    .message--user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message--assistant {
      align-self: flex-start;
      align-items: flex-start;
    }

    .message__sender {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .message__bubble {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      word-break: break-word;
      white-space: pre-wrap;
    }

    .message__bubble--user {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
    }

    .message__bubble--assistant {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-medium);
    }

    .message__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: String }) agentName = 'Agent';

  private _formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  private _renderMessage(message: ChatMessage) {
    const isUser = message.sender_role === 'user';
    const senderLabel = isUser ? 'You' : this.agentName;

    return html`
      <div class="message message--${message.sender_role}">
        <div class="message__sender">${senderLabel}</div>
        <div class="message__bubble message__bubble--${message.sender_role}">
          ${message.content}
        </div>
        <div class="message__time">${this._formatTime(message.created_at)}</div>
      </div>
    `;
  }

  protected render() {
    if (this.messages.length === 0) {
      return html`<div class="empty">No messages yet. Start the conversation.</div>`;
    }

    return html`
      <div class="messages">
        ${this.messages.map((msg) => this._renderMessage(msg))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-message-list': VelgMessageList;
  }
}
