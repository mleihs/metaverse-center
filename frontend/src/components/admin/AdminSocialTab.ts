import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

import './AdminInstagramTab.js';
import './AdminBlueskyTab.js';

type SocialChannel = 'instagram' | 'bluesky';

@localized()
@customElement('velg-admin-social-tab')
export class VelgAdminSocialTab extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Channel Selector ────────────────────────────── */

    .channel-bar {
      display: flex;
      align-items: stretch;
      gap: 0;
      margin-bottom: var(--space-6);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      overflow: hidden;
      background: var(--color-surface-sunken);
    }

    .channel-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }

    .channel-btn + .channel-btn {
      border-left: 1px solid var(--color-border);
    }

    .channel-btn:hover:not(.channel-btn--active) {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-surface) 50%, transparent);
    }

    .channel-btn--active {
      color: var(--color-primary);
      background: var(--color-surface);
      box-shadow: inset 0 -2px 0 var(--color-primary);
    }

    .channel-btn__icon {
      display: flex;
      align-items: center;
    }

    .channel-btn__indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-left: var(--space-1);
    }

    .channel-btn__indicator--live {
      background: var(--color-success);
      box-shadow: 0 0 4px var(--color-success);
    }

    .channel-btn__indicator--off {
      background: var(--color-text-muted);
      opacity: 0.4;
    }

    /* ── Content Area ─────────────────────────────────── */

    .channel-content {
      animation: channel-fade 250ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    @keyframes channel-fade {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  @state() private _channel: SocialChannel = 'instagram';

  protected render() {
    return html`
      <div class="channel-bar">
        <button
          class="channel-btn ${this._channel === 'instagram' ? 'channel-btn--active' : ''}"
          @click=${() => { this._channel = 'instagram'; }}
        >
          <span class="channel-btn__icon">${icons.instagram(16)}</span>
          ${msg('Instagram')}
          <span class="channel-btn__indicator channel-btn__indicator--live"></span>
        </button>
        <button
          class="channel-btn ${this._channel === 'bluesky' ? 'channel-btn--active' : ''}"
          @click=${() => { this._channel = 'bluesky'; }}
        >
          <span class="channel-btn__icon">${icons.antenna(16)}</span>
          ${msg('Bluesky')}
          <span class="channel-btn__indicator channel-btn__indicator--off"></span>
        </button>
      </div>

      <div class="channel-content" .key=${this._channel}>
        ${this._channel === 'instagram'
          ? html`<velg-admin-instagram-tab></velg-admin-instagram-tab>`
          : html`<velg-admin-bluesky-tab></velg-admin-bluesky-tab>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-social-tab': VelgAdminSocialTab;
  }
}
