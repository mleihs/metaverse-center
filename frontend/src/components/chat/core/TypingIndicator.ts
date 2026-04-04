/**
 * TypingIndicator — Unified typing indicator for Agent Chat and Epoch Chat.
 *
 * Replaces the inline typing indicators in ChatWindow and EpochChatPanel:
 *   - 3 bouncing dots with staggered animation-delay
 *   - Name(s) label: "Agent Kael is typing..." / "Kael, Vex are typing..."
 *   - Optional custom phrase: "consults the archives..."
 *   - role="status" + aria-live="polite" for screen readers
 *   - prefers-reduced-motion: static dots with varying opacity
 *   - Compact height, left-aligned below messages
 *   - Entrance via opacity fade
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { TypingUser } from '../../../services/chat/ChatSessionStore.js';

@localized()
@customElement('velg-typing-indicator')
export class TypingIndicator extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) 0;
      animation: indicator-enter var(--duration-entrance, 350ms) var(--ease-dramatic);
    }

    @keyframes indicator-enter {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }

    /* --- Label text --- */
    .indicator__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
    }

    /* --- Dot container --- */
    .indicator__dots {
      display: flex;
      align-items: center;
      gap: var(--space-0-5);
      flex-shrink: 0;
    }

    /* --- Individual dot --- */
    .indicator__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-text-muted);
      animation: dot-pulse 1.4s ease-in-out infinite;
    }

    .indicator__dot:nth-child(2) {
      animation-delay: 150ms;
    }

    .indicator__dot:nth-child(3) {
      animation-delay: 300ms;
    }

    @keyframes dot-pulse {
      0%, 60%, 100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-3px);
      }
    }

    /* --- Reduced motion: static opacity variation --- */
    @media (prefers-reduced-motion: reduce) {
      .indicator {
        animation: none;
      }

      .indicator__dot {
        animation: none;
      }

      .indicator__dot:nth-child(1) { opacity: 0.9; }
      .indicator__dot:nth-child(2) { opacity: 0.6; }
      .indicator__dot:nth-child(3) { opacity: 0.3; }
    }
  `;

  // --- Properties ---

  @property({ type: Array }) users: TypingUser[] = [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    if (this.users.length === 0) return nothing;

    const label = this._buildLabel();

    return html`
      <div class="indicator" role="status" aria-live="polite">
        <span class="indicator__label">${label}</span>
        <span class="indicator__dots" aria-hidden="true">
          <span class="indicator__dot"></span>
          <span class="indicator__dot"></span>
          <span class="indicator__dot"></span>
        </span>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Label construction
  // ---------------------------------------------------------------------------

  private _buildLabel(): string {
    const users = this.users;

    // Single user with custom phrase: "Agent Kael consults the archives..."
    if (users.length === 1 && users[0].phrase) {
      return `${users[0].name} ${users[0].phrase}`;
    }

    // Single user: "Agent Kael is typing..."
    if (users.length === 1) {
      return msg(str`${users[0].name} is typing`);
    }

    // Two users: "Kael, Vex are typing..."
    if (users.length === 2) {
      const names = `${users[0].name}, ${users[1].name}`;
      return msg(str`${names} are typing`);
    }

    // Three or more: "Kael, Vex +1 are typing..."
    const names = `${users[0].name}, ${users[1].name}`;
    const extra = users.length - 2;
    return msg(str`${names} +${extra} are typing`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-typing-indicator': TypingIndicator;
  }
}
