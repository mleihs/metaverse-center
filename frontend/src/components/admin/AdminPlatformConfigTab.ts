import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import './AdminApiKeysTab.js';
import './AdminModelsTab.js';
import './AdminResearchTab.js';
import './AdminCachingTab.js';

type PlatformSection = 'apikeys' | 'models' | 'research' | 'caching';

@localized()
@customElement('velg-admin-platform-config-tab')
export class VelgAdminPlatformConfigTab extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Sub-Navigation ────────────────────────────── */

    .section-bar {
      display: flex;
      align-items: stretch;
      gap: 0;
      margin-bottom: var(--space-6);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      overflow: hidden;
      background: var(--color-surface-sunken);
    }

    .section-btn {
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

    .section-btn + .section-btn {
      border-left: 1px solid var(--color-border);
    }

    .section-btn:hover:not(.section-btn--active) {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-surface) 50%, transparent);
    }

    .section-btn--active {
      color: var(--color-primary);
      background: var(--color-surface);
      box-shadow: inset 0 -2px 0 var(--color-primary);
    }

    /* ── Content Area ──────────────────────────────── */

    .section-content {
      animation: section-fade 250ms
        var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    @keyframes section-fade {
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

  @state() private _section: PlatformSection = 'apikeys';

  protected render() {
    return html`
      <div class="section-bar" role="tablist" aria-label=${msg('Platform configuration sections')}>
        <button
          class="section-btn ${this._section === 'apikeys' ? 'section-btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'apikeys'}
          @click=${() => { this._section = 'apikeys'; }}
        >${msg('API Keys')}</button>
        <button
          class="section-btn ${this._section === 'models' ? 'section-btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'models'}
          @click=${() => { this._section = 'models'; }}
        >${msg('Models')}</button>
        <button
          class="section-btn ${this._section === 'research' ? 'section-btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'research'}
          @click=${() => { this._section = 'research'; }}
        >${msg('Research')}</button>
        <button
          class="section-btn ${this._section === 'caching' ? 'section-btn--active' : ''}"
          role="tab"
          aria-selected=${this._section === 'caching'}
          @click=${() => { this._section = 'caching'; }}
        >${msg('Caching')}</button>
      </div>

      <div class="section-content" role="tabpanel">
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
