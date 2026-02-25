import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { SettingCategory } from '../../types/index.js';

import './GeneralSettingsPanel.js';
import './WorldSettingsPanel.js';
import './AISettingsPanel.js';
import './IntegrationSettingsPanel.js';
import './DesignSettingsPanel.js';
import './AccessSettingsPanel.js';
import './PromptsSettingsPanel.js';

interface TabDef {
  key: SettingCategory;
  label: string;
  ownerOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: 'general', label: msg('General') },
  { key: 'world', label: msg('World') },
  { key: 'ai', label: msg('AI') },
  { key: 'prompts', label: msg('Prompts') },
  { key: 'integration', label: msg('Integration') },
  { key: 'design', label: msg('Design') },
  { key: 'access', label: msg('Access'), ownerOnly: true },
];

@localized()
@customElement('velg-settings-view')
export class VelgSettingsView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .settings {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .settings__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .settings__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .settings__tabs {
      display: flex;
      gap: 0;
      border-bottom: var(--border-default);
      overflow-x: auto;
    }

    .settings__tab {
      display: inline-flex;
      align-items: center;
      padding: var(--space-2-5) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-secondary);
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .settings__tab:hover {
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
    }

    .settings__tab--active {
      color: var(--color-text-primary);
      border-bottom-color: var(--color-primary);
    }

    .settings__content {
      min-height: 400px;
    }

    .settings__unsaved-warning {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-warning-bg, rgba(234, 179, 8, 0.1));
      border: var(--border-width-default) solid var(--color-warning);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
    }

    .settings__unsaved-actions {
      display: flex;
      gap: var(--space-2);
      margin-left: auto;
    }

    .settings__unsaved-btn {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-thin) solid var(--color-warning);
      background: transparent;
      color: var(--color-warning);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .settings__unsaved-btn:hover {
      background: var(--color-warning);
      color: var(--color-surface);
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _activeTab: SettingCategory = 'general';
  @state() private _hasUnsavedChanges = false;
  @state() private _pendingTab: SettingCategory | null = null;

  private get _visibleTabs(): TabDef[] {
    const isOwner = appState.isOwner.value;
    return TABS.filter((tab) => !tab.ownerOnly || isOwner);
  }

  private _handleTabClick(tab: SettingCategory): void {
    if (tab === this._activeTab) return;

    if (this._hasUnsavedChanges) {
      this._pendingTab = tab;
      return;
    }

    this._activeTab = tab;
  }

  private _handleDiscardAndSwitch(): void {
    if (this._pendingTab) {
      this._activeTab = this._pendingTab;
      this._pendingTab = null;
      this._hasUnsavedChanges = false;
    }
  }

  private _handleCancelSwitch(): void {
    this._pendingTab = null;
  }

  private _handleUnsavedChange(e: CustomEvent<boolean>): void {
    this._hasUnsavedChanges = e.detail;
  }

  private _handleSettingsSaved(): void {
    this._hasUnsavedChanges = false;
    if (this._pendingTab) {
      this._activeTab = this._pendingTab;
      this._pendingTab = null;
    }
  }

  private _renderPanel() {
    switch (this._activeTab) {
      case 'general':
        return html`
          <velg-general-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-general-settings-panel>
        `;
      case 'world':
        return html`
          <velg-world-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-world-settings-panel>
        `;
      case 'ai':
        return html`
          <velg-ai-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-ai-settings-panel>
        `;
      case 'prompts':
        return html`
          <velg-prompts-settings-panel
            .simulationId=${this.simulationId}
          ></velg-prompts-settings-panel>
        `;
      case 'integration':
        return html`
          <velg-integration-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-integration-settings-panel>
        `;
      case 'design':
        return html`
          <velg-design-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-design-settings-panel>
        `;
      case 'access':
        return html`
          <velg-access-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-access-settings-panel>
        `;
      default:
        return nothing;
    }
  }

  protected render() {
    return html`
      <div class="settings">
        <div class="settings__header">
          <h1 class="settings__title">${msg('Settings')}</h1>
        </div>

        ${
          this._pendingTab
            ? html`
              <div class="settings__unsaved-warning">
                ${msg('You have unsaved changes. Discard and switch tab?')}
                <div class="settings__unsaved-actions">
                  <button
                    class="settings__unsaved-btn"
                    @click=${this._handleCancelSwitch}
                  >
                    ${msg('Stay')}
                  </button>
                  <button
                    class="settings__unsaved-btn"
                    @click=${this._handleDiscardAndSwitch}
                  >
                    ${msg('Discard')}
                  </button>
                </div>
              </div>
            `
            : nothing
        }

        <nav class="settings__tabs">
          ${this._visibleTabs.map(
            (tab) => html`
              <button
                class="settings__tab ${this._activeTab === tab.key ? 'settings__tab--active' : ''}"
                @click=${() => this._handleTabClick(tab.key)}
              >
                ${tab.label}
              </button>
            `,
          )}
        </nav>

        <div class="settings__content">
          ${this._renderPanel()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-settings-view': VelgSettingsView;
  }
}
