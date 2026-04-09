import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminSubNavStyles } from '../shared/admin-shared-styles.js';

import './AdminApiKeysTab.js';
import './AdminModelsTab.js';
import './AdminResearchTab.js';
import './AdminCachingTab.js';

type PlatformSection = 'apikeys' | 'models' | 'research' | 'caching';

@localized()
@customElement('velg-admin-platform-config-tab')
export class VelgAdminPlatformConfigTab extends LitElement {
  static styles = [
    adminSubNavStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @state() private _section: PlatformSection = 'apikeys';

  protected render() {
    return html`
      <div class="subnav" role="tablist" aria-label=${msg('Platform configuration sections')}>
        <button
          class="subnav__btn ${this._section === 'apikeys' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'apikeys'}
          @click=${() => {
            this._section = 'apikeys';
          }}
        >${msg('API Keys')}</button>
        <button
          class="subnav__btn ${this._section === 'models' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'models'}
          @click=${() => {
            this._section = 'models';
          }}
        >${msg('Models')}</button>
        <button
          class="subnav__btn ${this._section === 'research' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'research'}
          @click=${() => {
            this._section = 'research';
          }}
        >${msg('Research')}</button>
        <button
          class="subnav__btn ${this._section === 'caching' ? 'subnav__btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'caching'}
          @click=${() => {
            this._section = 'caching';
          }}
        >${msg('Caching')}</button>
      </div>

      <div class="subnav__content" role="tabpanel">
        ${this._renderSection()}
      </div>
    `;
  }

  private _renderSection() {
    switch (this._section) {
      case 'apikeys':
        return html`<velg-admin-api-keys-tab></velg-admin-api-keys-tab>`;
      case 'models':
        return html`<velg-admin-models-tab></velg-admin-models-tab>`;
      case 'research':
        return html`<velg-admin-research-tab></velg-admin-research-tab>`;
      case 'caching':
        return html`<velg-admin-caching-tab></velg-admin-caching-tab>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-platform-config-tab': VelgAdminPlatformConfigTab;
  }
}
