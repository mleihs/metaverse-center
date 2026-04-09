import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';
import { adminSubNavStyles } from '../shared/admin-shared-styles.js';

import './AdminInstagramTab.js';
import './AdminBlueskyTab.js';

type SocialChannel = 'instagram' | 'bluesky';

@localized()
@customElement('velg-admin-social-tab')
export class VelgAdminSocialTab extends LitElement {
  static styles = [
    adminSubNavStyles,
    css`
      :host {
        display: block;
      }

      .subnav__indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        margin-left: var(--space-1);
      }

      .subnav__indicator--live {
        background: var(--color-success);
        box-shadow: 0 0 4px var(--color-success);
      }

      .subnav__indicator--off {
        background: var(--color-text-muted);
        opacity: 0.4;
      }
    `,
  ];

  @state() private _channel: SocialChannel = 'instagram';

  protected render() {
    return html`
      <div class="subnav" role="tablist" aria-label=${msg('Social media channels')}>
        <button
          class="subnav__btn ${this._channel === 'instagram' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._channel === 'instagram'}
          @click=${() => {
            this._channel = 'instagram';
          }}
        >
          ${icons.instagram(16)}
          ${msg('Instagram')}
          <span class="subnav__indicator subnav__indicator--live"></span>
        </button>
        <button
          class="subnav__btn ${this._channel === 'bluesky' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._channel === 'bluesky'}
          @click=${() => {
            this._channel = 'bluesky';
          }}
        >
          ${icons.antenna(16)}
          ${msg('Bluesky')}
          <span class="subnav__indicator subnav__indicator--off"></span>
        </button>
      </div>

      <div class="subnav__content" role="tabpanel">
        ${
          this._channel === 'instagram'
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
