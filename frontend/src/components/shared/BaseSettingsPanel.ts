import { msg, str } from '@lit/localize';
import { LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import type { SettingCategory, SimulationSetting } from '../../types/index.js';
import { VelgToast } from './Toast.js';

/**
 * Base class for settings panels that read/write to `simulation_settings`.
 *
 * Subclasses provide:
 * - `category` getter (the settings category string)
 * - `render()` method with the panel UI
 * - `successMessage` getter (optional, for toast)
 *
 * The base class handles:
 * - Loading settings from the API on `simulationId` change
 * - Dirty-tracking (`_hasChanges`)
 * - Saving changed key/value pairs
 * - Dispatching `unsaved-change` and `settings-saved` events
 */
export abstract class BaseSettingsPanel extends LitElement {
  @property({ type: String }) simulationId = '';

  @state() protected _values: Record<string, string> = {};
  @state() protected _originalValues: Record<string, string> = {};
  @state() protected _loading = true;
  @state() protected _saving = false;
  @state() protected _error: string | null = null;

  /** Subclass defines which category to load/save. */
  protected abstract get category(): SettingCategory;

  /** Optional override for the success toast message. */
  protected get successMessage(): string {
    return msg('Settings saved successfully.');
  }

  protected get _hasChanges(): boolean {
    const keys = new Set([...Object.keys(this._values), ...Object.keys(this._originalValues)]);
    for (const key of keys) {
      if ((this._values[key] ?? '') !== (this._originalValues[key] ?? '')) {
        return true;
      }
    }
    return false;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadSettings();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const prevValues = changedProperties.get('_values') as Record<string, string> | undefined;
    const prevOriginal = changedProperties.get('_originalValues') as
      | Record<string, string>
      | undefined;
    if (prevValues !== undefined || prevOriginal !== undefined) {
      this.dispatchEvent(
        new CustomEvent('unsaved-change', {
          detail: this._hasChanges,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, this.category);

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const vals: Record<string, string> = {};

        for (const setting of settings) {
          vals[setting.setting_key] = String(setting.setting_value ?? '');
        }

        this._values = { ...vals };
        this._originalValues = { ...vals };
      } else {
        this._error = response.error?.message ?? msg('Failed to load settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  protected _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    this._values = { ...this._values, [key]: target.value };
  }

  protected async _saveSettings(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

    this._saving = true;
    this._error = null;

    try {
      const changedKeys: string[] = [];
      const allKeys = new Set([...Object.keys(this._values), ...Object.keys(this._originalValues)]);

      for (const key of allKeys) {
        if ((this._values[key] ?? '') !== (this._originalValues[key] ?? '')) {
          changedKeys.push(key);
        }
      }

      for (const key of changedKeys) {
        const value = this._values[key] ?? '';

        const response = await settingsApi.upsert(this.simulationId, {
          category: this.category,
          setting_key: key,
          setting_value: value,
        });

        if (!response.success) {
          this._error = response.error?.message ?? msg(str`Failed to save ${key}`);
          VelgToast.error(msg(str`Failed to save ${key}`));
          return;
        }
      }

      this._originalValues = { ...this._values };
      VelgToast.success(this.successMessage);
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }
}
