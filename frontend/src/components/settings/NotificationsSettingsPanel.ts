import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { notificationPreferencesApi } from '../../services/api/NotificationPreferencesApiService.js';
import type { NotificationPreferences } from '../../types/index.js';
import { settingsStyles } from '../shared/settings-styles.js';
import { VelgToast } from '../shared/Toast.js';

const DEFAULT_PREFS: NotificationPreferences = {
  cycle_resolved: true,
  phase_changed: true,
  epoch_completed: true,
  email_locale: 'en',
};

@localized()
@customElement('velg-notifications-settings-panel')
export class VelgNotificationsSettingsPanel extends LitElement {
  static styles = [
    settingsStyles,
    css`
      .notif-intro {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: 1.6;
        margin: 0 0 var(--space-2);
      }

      .notif-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) 0;
        border-bottom: 1px solid var(--color-border, #333);
      }

      .notif-toggle-row:last-of-type {
        border-bottom: none;
      }

      .notif-toggle-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        flex: 1;
      }

      .notif-toggle-label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
      }

      .notif-toggle-desc {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        line-height: 1.4;
      }

      .notif-locale-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding-top: var(--space-3);
      }

      @media (max-width: 640px) {
        :host {
          padding: var(--space-3);
        }

        .notif-toggle-row {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-2);
        }

        .notif-locale-row {
          flex-direction: column;
          align-items: flex-start;
        }

        .settings-toggle {
          min-height: 44px;
        }
      }
    `,
  ];

  @state() private _prefs: NotificationPreferences = { ...DEFAULT_PREFS };
  @state() private _original: NotificationPreferences = { ...DEFAULT_PREFS };
  @state() private _loading = true;
  @state() private _saving = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    const res = await notificationPreferencesApi.getPreferences();
    if (res.success && res.data) {
      this._prefs = { ...res.data };
      this._original = { ...res.data };
    }
    this._loading = false;
  }

  private get _isDirty(): boolean {
    return (
      this._prefs.cycle_resolved !== this._original.cycle_resolved ||
      this._prefs.phase_changed !== this._original.phase_changed ||
      this._prefs.epoch_completed !== this._original.epoch_completed ||
      this._prefs.email_locale !== this._original.email_locale
    );
  }

  private _toggle(field: keyof NotificationPreferences): void {
    this._prefs = {
      ...this._prefs,
      [field]: !this._prefs[field],
    };
    this._emitUnsaved();
  }

  private _emitUnsaved(): void {
    this.dispatchEvent(new CustomEvent('unsaved-change', { detail: this._isDirty }));
  }

  private async _save(): Promise<void> {
    this._saving = true;
    const res = await notificationPreferencesApi.updatePreferences(this._prefs);
    this._saving = false;

    if (res.success && res.data) {
      this._prefs = { ...res.data };
      this._original = { ...res.data };
      VelgToast.success(msg('Notification preferences saved.'));
      this.dispatchEvent(new CustomEvent('settings-saved'));
      this.dispatchEvent(new CustomEvent('unsaved-change', { detail: false }));
    } else {
      VelgToast.error(msg('Failed to save notification preferences.'));
    }
  }

  private _renderToggle(
    field: 'cycle_resolved' | 'phase_changed' | 'epoch_completed',
    label: string,
    description: string,
  ) {
    const checked = this._prefs[field];
    return html`
      <div class="notif-toggle-row">
        <div class="notif-toggle-info">
          <span class="notif-toggle-label">${label}</span>
          <span class="notif-toggle-desc">${description}</span>
        </div>
        <label class="settings-toggle">
          <input
            type="checkbox"
            class="settings-toggle__input"
            .checked=${checked}
            @change=${() => this._toggle(field)}
          />
          <span class="settings-toggle__slider"></span>
        </label>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<div class="settings-panel">
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);">
          ${msg('Loading...')}
        </p>
      </div>`;
    }

    return html`
      <div class="settings-panel">
        <div class="settings-section">
          <p class="notif-intro">
            ${msg(
              'Configure which epoch email notifications you receive. All emails are bilingual (English and German).',
            )}
          </p>

          ${this._renderToggle(
            'cycle_resolved',
            msg('Cycle Resolved'),
            msg(
              'Receive a tactical briefing email when an epoch cycle resolves, including your scores, rank, and operative status.',
            ),
          )}
          ${this._renderToggle(
            'phase_changed',
            msg('Phase Changed'),
            msg(
              'Receive an email when the epoch transitions to a new phase (Foundation, Competition, Reckoning).',
            ),
          )}
          ${this._renderToggle(
            'epoch_completed',
            msg('Epoch Completed'),
            msg(
              'Receive a final standings email when an epoch completes, with the leaderboard and dimension titles.',
            ),
          )}
        </div>

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            ?disabled=${!this._isDirty || this._saving}
            @click=${this._save}
          >
            ${this._saving ? msg('Saving...') : msg('Save Changes')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-notifications-settings-panel': VelgNotificationsSettingsPanel;
  }
}
