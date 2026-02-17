import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { type AppNotification, notificationService } from '../../services/NotificationService.js';

@localized()
@customElement('velg-notification-center')
export class VelgNotificationCenter extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
    }

    .bell-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: var(--border-default);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .bell-btn:hover {
      background: var(--color-surface-sunken);
    }

    .bell-btn svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      line-height: 1;
      color: var(--color-text-inverse, #fff);
      background: var(--color-danger);
      border: 2px solid var(--color-surface, #fff);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      width: 360px;
      max-height: 420px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    .dropdown--open {
      display: flex;
    }

    .dropdown__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-default);
    }

    .dropdown__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .mark-all-btn {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
      transition: color var(--transition-fast);
    }

    .mark-all-btn:hover {
      color: var(--color-text-primary);
    }

    .dropdown__list {
      flex: 1;
      overflow-y: auto;
    }

    .notification-item {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
      cursor: default;
      transition: background var(--transition-fast);
    }

    .notification-item:hover {
      background: var(--color-surface-sunken);
    }

    .notification-item--unread {
      background: var(--color-surface);
    }

    .notification-item__indicator {
      width: 8px;
      height: 8px;
      margin-top: 5px;
      flex-shrink: 0;
      border-radius: 50%;
    }

    .notification-item__indicator--unread {
      background: var(--color-info);
    }

    .notification-item__indicator--read {
      background: transparent;
    }

    .notification-item__content {
      flex: 1;
      min-width: 0;
    }

    .notification-item__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-0-5);
    }

    .notification-item__message {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      margin-bottom: var(--space-1);
    }

    .notification-item__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .notification-item__time {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .notification-item__action {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-2);
      border: var(--border-default);
      background: transparent;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .notification-item__action:hover {
      background: var(--color-surface-sunken);
    }

    .dropdown__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8) var(--space-4);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `;

  @state() private _open = false;
  @state() private _notifications: AppNotification[] = [];
  @state() private _unreadCount = 0;

  private _disposeEffect: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._handleOutsideClick);

    // Poll signals for reactivity (Lit does not natively react to Preact signals)
    this._syncFromSignals();
    this._disposeEffect = this._startSignalSync();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleOutsideClick);
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  /**
   * Periodically sync signal values into Lit reactive state.
   * Uses a lightweight interval since Lit and Preact Signals
   * do not share a reactivity system.
   */
  private _startSignalSync(): () => void {
    const interval = setInterval(() => this._syncFromSignals(), 500);
    return () => clearInterval(interval);
  }

  private _syncFromSignals(): void {
    this._notifications = notificationService.notifications.value;
    this._unreadCount = notificationService.unreadCount.value;
  }

  private _handleOutsideClick = (e: Event): void => {
    if (!this.contains(e.target as Node)) {
      this._open = false;
    }
  };

  private _toggleDropdown(): void {
    this._open = !this._open;
    if (this._open) {
      // Refresh on open
      this._syncFromSignals();
    }
  }

  private _handleMarkAllRead(): void {
    notificationService.markAllAsRead();
    this._syncFromSignals();
  }

  private _handleItemClick(notification: AppNotification): void {
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
      this._syncFromSignals();
    }

    if (notification.actionUrl) {
      this._open = false;
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: notification.actionUrl,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return msg('just now');
    if (diffMin < 60) return msg(str`${diffMin}m ago`);
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return msg(str`${diffHr}h ago`);
    const diffDays = Math.floor(diffHr / 24);
    return msg(str`${diffDays}d ago`);
  }

  private _renderBellIcon() {
    return html`
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9 17v1a3 3 0 0 0 6 0v-1" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  protected render() {
    return html`
      <button
        class="bell-btn"
        @click=${this._toggleDropdown}
        aria-label=${msg('Notifications')}
        aria-expanded=${this._open}
      >
        ${this._renderBellIcon()}
        ${this._unreadCount > 0 ? html`<span class="badge">${this._unreadCount}</span>` : nothing}
      </button>

      <div class="dropdown ${this._open ? 'dropdown--open' : ''}">
        <div class="dropdown__header">
          <span class="dropdown__title">${msg('Notifications')}</span>
          ${
            this._unreadCount > 0
              ? html`
              <button class="mark-all-btn" @click=${this._handleMarkAllRead}>
                ${msg('Mark all read')}
              </button>
            `
              : nothing
          }
        </div>

        <div class="dropdown__list">
          ${
            this._notifications.length === 0
              ? html`<div class="dropdown__empty">${msg('No notifications')}</div>`
              : this._notifications.map((n) => this._renderItem(n))
          }
        </div>
      </div>
    `;
  }

  private _renderItem(notification: AppNotification) {
    const unreadClass = notification.read ? '' : ' notification-item--unread';
    const indicatorClass = notification.read
      ? 'notification-item__indicator--read'
      : 'notification-item__indicator--unread';

    return html`
      <div
        class="notification-item${unreadClass}"
        @click=${() => this._handleItemClick(notification)}
      >
        <div class="notification-item__indicator ${indicatorClass}"></div>
        <div class="notification-item__content">
          <div class="notification-item__title">${notification.title}</div>
          <div class="notification-item__message">${notification.message}</div>
          <div class="notification-item__meta">
            <span class="notification-item__time">
              ${this._formatTime(notification.createdAt)}
            </span>
            ${
              notification.actionUrl
                ? html`
                <button
                  class="notification-item__action"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this._handleItemClick(notification);
                  }}
                >
                  ${msg('View')}
                </button>
              `
                : nothing
            }
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-notification-center': VelgNotificationCenter;
  }
}
