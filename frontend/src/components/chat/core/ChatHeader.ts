/**
 * ChatHeader — Unified chat header for Agent Chat and Epoch Chat.
 *
 * Compact intelligence-bar layout:
 *   Left: overlapping avatar stack (max 4, +N overflow) + title + subtitle
 *   Right: named slot "actions" for context-specific buttons
 *   Bottom: border separator
 *
 * The avatar stack uses negative margins for overlap. Overflow is shown
 * as a "+N" badge in brutalist typography. Both Agent Chat (agent portraits)
 * and Epoch Chat (player avatars / epoch status) map to the same Participant
 * interface.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { Participant } from '../../../services/chat/chat-types.js';

import '../../shared/VelgAvatar.js';

const MAX_VISIBLE_AVATARS = 4;

@localized()
@customElement('velg-chat-header')
export class ChatHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-medium);
      background: var(--color-surface-raised);
      min-height: 56px;
    }

    /* --- Left section: avatars + text --- */
    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex: 1;
      min-width: 0;
    }

    /* --- Avatar stack with overlapping portraits --- */
    .header__avatars {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .header__avatar-item {
      position: relative;
    }

    .header__avatar-item:not(:first-child) {
      margin-left: -8px;
    }

    .header__avatar-overflow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin-left: -8px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: var(--tracking-brutalist);
      flex-shrink: 0;
    }

    /* --- Info column: title + subtitle --- */
    .header__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header__subtitle {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* --- Right section: slot for action buttons --- */
    .header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    /* Slot styling for action buttons (from parent) */
    ::slotted(button),
    ::slotted([slot='actions']) {
      /* Parent controls button styling */
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .header {
        padding: var(--space-3);
        min-height: 48px;
      }

      .header__title {
        font-size: var(--text-xs);
      }
    }
  `;

  // --- Properties ---

  @property({ type: String }) title = '';
  @property({ type: String }) subtitle = '';
  @property({ type: Array }) participants: Participant[] = [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    return html`
      <div class="header" role="banner">
        <div class="header__left">
          ${this.participants.length > 0
            ? this._renderAvatarStack()
            : nothing}
          <div class="header__info">
            <div class="header__title">${this.title || msg('Chat')}</div>
            ${this.subtitle
              ? html`<div class="header__subtitle">${this.subtitle}</div>`
              : nothing}
          </div>
        </div>
        <div class="header__actions">
          <slot name="actions"></slot>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Avatar stack
  // ---------------------------------------------------------------------------

  private _renderAvatarStack() {
    const visible = this.participants.slice(0, MAX_VISIBLE_AVATARS);
    const overflow = this.participants.length - MAX_VISIBLE_AVATARS;

    return html`
      <div class="header__avatars">
        ${visible.map(
          p => html`
            <div class="header__avatar-item">
              <velg-avatar
                .src=${p.avatarUrl ?? ''}
                .name=${p.name}
                size="sm"
              ></velg-avatar>
            </div>
          `,
        )}
        ${overflow > 0
          ? html`<div class="header__avatar-overflow">+${overflow}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-header': ChatHeader;
  }
}
