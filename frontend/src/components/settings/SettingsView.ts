import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { SettingCategory } from '../../types/index.js';
import type { TabDef } from '../shared/VelgTabs.js';

import '../shared/VelgTabs.js';
import './GeneralSettingsPanel.js';
import './WorldSettingsPanel.js';
import './BleedSettingsPanel.js';
import './AISettingsPanel.js';
import './IntegrationSettingsPanel.js';
import './DesignSettingsPanel.js';
import './FeaturesSettingsPanel.js';
import './AccessSettingsPanel.js';
import './PromptsSettingsPanel.js';
import './AutonomySettingsPanel.js';
import './BondSettingsPanel.js';
import './WeatherSettingsPanel.js';
import './NotificationsSettingsPanel.js';

interface SettingsTabDef extends TabDef {
  ownerOnly?: boolean;
}

function getTabs(): SettingsTabDef[] {
  return [
    { key: 'general', label: msg('General') },
    { key: 'world', label: msg('World') },
    { key: 'bleed', label: msg('Bleed') },
    { key: 'autonomy', label: msg('Autonomy') },
    { key: 'bonds', label: msg('Bonds') },
    { key: 'weather', label: msg('Weather') },
    { key: 'ai', label: msg('AI') },
    { key: 'prompts', label: msg('Prompts') },
    { key: 'integration', label: msg('Integration') },
    { key: 'design', label: msg('Design') },
    { key: 'features', label: msg('Features') },
    { key: 'access', label: msg('Access'), ownerOnly: true },
    { key: 'notifications', label: msg('Notifications') },
  ];
}

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

    .settings__content {
      min-height: 400px;
    }

    .settings__content > * {
      animation: content-fade 250ms var(--ease-out, ease-out) both;
    }

    @keyframes content-fade {
      from { opacity: 0; transform: translateY(4px); }
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
    return getTabs().map((tab) => ({
      ...tab,
      hidden: tab.ownerOnly && !isOwner,
    }));
  }

  private _handleTabChange(e: CustomEvent<{ key: string }>): void {
    const tab = e.detail.key as SettingCategory;
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
      case 'bleed':
        return html`
          <velg-bleed-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-bleed-settings-panel>
        `;
      case 'autonomy':
        return html`
          <velg-autonomy-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-autonomy-settings-panel>
        `;
      case 'bonds':
        return html`
          <velg-bond-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-bond-settings-panel>
        `;
      case 'weather':
        return html`
          <velg-weather-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-weather-settings-panel>
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
      case 'features':
        return html`
          <velg-features-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-features-settings-panel>
        `;
      case 'access':
        return html`
          <velg-access-settings-panel
            .simulationId=${this.simulationId}
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-access-settings-panel>
        `;
      case 'notifications':
        return html`
          <velg-notifications-settings-panel
            @unsaved-change=${this._handleUnsavedChange}
            @settings-saved=${this._handleSettingsSaved}
          ></velg-notifications-settings-panel>
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

        <velg-tabs
          .tabs=${this._visibleTabs}
          .active=${this._activeTab}
          @tab-change=${this._handleTabChange}
        ></velg-tabs>

        <div class="settings__content" id="settings-tabpanel" role="tabpanel">
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
