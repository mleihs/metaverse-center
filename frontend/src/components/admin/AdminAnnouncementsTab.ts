/**
 * AdminAnnouncementsTab -- Platform-admin controls for the alpha first-contact
 * modal. Lives as a sub-tab under Admin > Platform > Announcements.
 *
 * Three controls:
 *   Toggle enabled  Flip platform_settings.alpha_first_contact_modal_enabled.
 *   Bump version    Stamp platform_settings.alpha_first_contact_modal_version
 *                   to today's date — retriggers the modal for every user who
 *                   dismissed an older version.
 *   Preview         Open the modal locally without touching localStorage, so
 *                   admins can inspect content without affecting real state.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { alphaStatus } from '../../services/AlphaStatusService.js';
import { adminApi } from '../../services/api/index.js';
import type { PlatformSetting } from '../../types/index.js';
import { adminButtonStyles, adminLoadingStyles } from '../shared/admin-shared-styles.js';
import { VelgToast } from '../shared/Toast.js';

const KEY_ENABLED = 'alpha_first_contact_modal_enabled';
const KEY_VERSION = 'alpha_first_contact_modal_version';

@localized()
@customElement('velg-admin-announcements-tab')
export class VelgAdminAnnouncementsTab extends LitElement {
  static styles = [
    adminButtonStyles,
    adminLoadingStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
      }

      .card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: var(--space-5, 20px);
        margin-bottom: var(--space-4, 16px);
      }

      .card__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold, 700);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        margin: 0 0 var(--space-2, 8px);
      }

      .card__hint {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: 1.6;
        margin: 0 0 var(--space-4, 16px);
      }

      .row {
        display: flex;
        align-items: center;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
        margin-bottom: var(--space-3, 12px);
      }

      .row:last-child { margin-bottom: 0; }

      .row__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-muted);
        min-width: 96px;
      }

      .row__value {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2, 8px);
        cursor: pointer;
        user-select: none;
      }

      .toggle__input {
        appearance: none;
        width: 38px;
        height: 20px;
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
        position: relative;
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .toggle__input::before {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--color-text-muted);
        transition: transform var(--transition-fast), background var(--transition-fast);
      }

      .toggle__input:checked {
        background: color-mix(in srgb, var(--color-accent-amber) 22%, var(--color-surface));
        border-color: var(--color-accent-amber);
      }

      .toggle__input:checked::before {
        transform: translateX(18px);
        background: var(--color-accent-amber);
      }

      .toggle__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
      }

      .status-chip {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: 2px 8px;
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .status-chip--live {
        color: var(--color-accent-amber);
        border-color: color-mix(in srgb, var(--color-accent-amber) 55%, transparent);
      }
    `,
  ];

  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _enabled = false;
  @state() private _version = '';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSettings();
  }

  private _parseEnabled(raw: unknown): boolean {
    const s = String(raw ?? '')
      .replace(/"/g, '')
      .trim()
      .toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }

  private _parseVersion(raw: unknown): string {
    return String(raw ?? '')
      .replace(/"/g, '')
      .trim();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    const result = await adminApi.listSettings();
    if (result.success && result.data) {
      const rows = result.data as PlatformSetting[];
      const enabledRow = rows.find((r) => r.setting_key === KEY_ENABLED);
      const versionRow = rows.find((r) => r.setting_key === KEY_VERSION);
      this._enabled = this._parseEnabled(enabledRow?.setting_value);
      this._version = this._parseVersion(versionRow?.setting_value);
    }
    this._loading = false;
  }

  private async _toggleEnabled(e: Event): Promise<void> {
    const next = (e.target as HTMLInputElement).checked;
    this._saving = true;
    const result = await adminApi.updateSetting(KEY_ENABLED, next ? 'true' : 'false');
    if (result.success) {
      this._enabled = next;
      VelgToast.success(msg('First-contact modal setting saved.'));
      alphaStatus.firstContactEnabled.value = next;
    } else {
      VelgToast.error(result.error?.message ?? msg('Save failed.'));
    }
    this._saving = false;
  }

  private async _bumpVersion(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    let next = today;
    // If today already matches, append a numeric suffix to force a change.
    if (this._version.startsWith(today)) {
      const match = this._version.match(/^(\d{4}-\d{2}-\d{2})(?:\.(\d+))?$/);
      const suffix = match?.[2] ? Number.parseInt(match[2], 10) + 1 : 1;
      next = `${today}.${suffix}`;
    }
    this._saving = true;
    const result = await adminApi.updateSetting(KEY_VERSION, next);
    if (result.success) {
      this._version = next;
      VelgToast.success(msg(str`Version bumped to ${next}.`));
      alphaStatus.firstContactVersion.value = next;
    } else {
      VelgToast.error(result.error?.message ?? msg('Bump failed.'));
    }
    this._saving = false;
  }

  private _openPreview(): void {
    alphaStatus.openPreview();
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading announcements...')}</div>`;
    }

    const isLive = this._enabled;

    return html`
      <div class="card">
        <h3 class="card__title">${msg('Alpha First-Contact Modal')}</h3>
        <p class="card__hint">
          ${msg(
            'Shown to non-member visitors once per version. Bump the version to re-announce to everyone who already dismissed it.',
          )}
        </p>

        <div class="row">
          <span class="row__label">${msg('Status')}</span>
          <label class="toggle">
            <input
              type="checkbox"
              class="toggle__input"
              .checked=${this._enabled}
              ?disabled=${this._saving}
              @change=${this._toggleEnabled}
              aria-label=${msg('Enable first-contact modal')}
            />
            <span class="toggle__label">${this._enabled ? msg('Enabled') : msg('Disabled')}</span>
          </label>
          <span class="status-chip ${isLive ? 'status-chip--live' : ''}">
            ${isLive ? msg('LIVE') : msg('HIDDEN')}
          </span>
        </div>

        <div class="row">
          <span class="row__label">${msg('Version')}</span>
          <span class="row__value">${this._version || msg('(unset)')}</span>
          <button
            class="btn btn--reset"
            ?disabled=${this._saving}
            @click=${this._bumpVersion}
            aria-label=${msg('Bump modal version to today')}
          >${msg('Bump version')}</button>
        </div>

        <div class="row">
          <span class="row__label">${msg('Preview')}</span>
          <button
            class="btn btn--save"
            ?disabled=${this._saving}
            @click=${this._openPreview}
            aria-label=${msg('Open modal in preview mode')}
          >${msg('Open modal')}</button>
          <span class="card__hint" style="margin:0">
            ${msg('Preview does not write localStorage.')}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-announcements-tab': VelgAdminAnnouncementsTab;
  }
}
