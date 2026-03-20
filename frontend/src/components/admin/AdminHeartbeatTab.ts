/**
 * Admin Heartbeat Dashboard — monitors all simulations' heartbeat state.
 *
 * Three sections:
 * 1. Global config editing (toggles + numeric inputs for all heartbeat params)
 * 2. Per-simulation override editor (select sim, set interval/enabled overrides)
 * 3. Cascade rules table (source/target, threshold, rate, cooldown, active toggle)
 *
 * Grid of simulation cards: last tick, next tick countdown, status,
 * active arcs, scar tissue level. Force Tick button per simulation.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { adminApi } from '../../services/api/index.js';
import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import { VelgToast } from '../shared/Toast.js';
import type {
  HeartbeatDashboard,
  HeartbeatSimulationStatus,
  PlatformSetting,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import {
  adminAnimationStyles,
  adminSectionHeaderStyles,
  adminGlobalCardStyles,
  adminToggleStyles,
  adminLoadingStyles,
} from './admin-shared-styles.js';

/* ── Local interfaces for config/cascade data ─────────────── */

interface SimulationOverride {
  simulation_id: string;
  simulation_name: string;
  interval_override_seconds: number | null;
  enabled: boolean;
}

interface CascadeRule {
  id: string;
  source_signature: string;
  target_signature: string;
  threshold: number;
  transfer_rate: number;
  cooldown_hours: number;
  is_active: boolean;
  last_triggered_at: string | null;
}

/* Keys we manage in the global config */
const CONFIG_KEYS = [
  'heartbeat_enabled',
  'heartbeat_interval_seconds',
  'heartbeat_scar_decay_rate',
  'heartbeat_attunement_growth_rate',
  'heartbeat_anchor_growth_per_sim',
  'heartbeat_escalation_threshold',
  'heartbeat_cascade_pressure_trigger',
  /* Bureau response tuning (migration 131) */
  'heartbeat_bureau_contain_multiplier',
  'heartbeat_bureau_remediate_multiplier',
  'heartbeat_bureau_adapt_multiplier',
  'heartbeat_bureau_max_agents',
  /* Attunement tuning (migration 131) */
  'heartbeat_positive_event_probability',
  'heartbeat_max_attunements',
  'heartbeat_switching_cooldown_ticks',
  /* Anchor tuning (migration 131) */
  'heartbeat_anchor_protection_cap',
  /* Event aging rules — stored as JSON (migration 131) */
  'heartbeat_event_aging_rules',
] as const;

type ConfigKey = (typeof CONFIG_KEYS)[number];

/** Tooltip text for each heartbeat config key (i18n-wrapped). */
function getConfigTooltip(key: string): string {
  const tooltips: Record<string, string> = {
    heartbeat_enabled: msg('Master switch for the heartbeat tick engine. When disabled, no simulations receive periodic ticks.'),
    heartbeat_interval_seconds: msg('Seconds between heartbeat ticks. Lower values increase server load but make simulations feel more responsive.'),
    heartbeat_scar_decay_rate: msg('Rate at which scar tissue decays per tick. Higher values mean faster healing after critical events.'),
    heartbeat_attunement_growth_rate: msg('Rate at which attunement grows per tick when conditions are met. Controls how quickly agents align with their environment.'),
    heartbeat_anchor_growth_per_sim: msg('Anchor points gained per simulation per tick cycle. Anchors stabilize simulation health.'),
    heartbeat_escalation_threshold: msg('Health threshold below which escalation mechanics activate. Lower values delay escalation longer.'),
    heartbeat_cascade_pressure_trigger: msg('Pressure level that triggers cross-simulation cascade effects. Higher values make cascades harder to trigger.'),
    heartbeat_bureau_contain_multiplier: msg('Multiplier for Bureau containment response strength. Higher values make containment more effective.'),
    heartbeat_bureau_remediate_multiplier: msg('Multiplier for Bureau remediation response strength. Controls healing speed during active incidents.'),
    heartbeat_bureau_adapt_multiplier: msg('Multiplier for Bureau adaptation response. Higher values accelerate post-crisis normalization.'),
    heartbeat_bureau_max_agents: msg('Maximum Bureau agents that can be active simultaneously across all simulations.'),
    heartbeat_positive_event_probability: msg('Probability of positive attunement events per tick. Range 0-1. Higher values create more hopeful moments.'),
    heartbeat_max_attunements: msg('Maximum number of concurrent attunement bonds per simulation.'),
    heartbeat_switching_cooldown_ticks: msg('Tick cooldown before an agent can switch attunement targets. Prevents rapid oscillation.'),
    heartbeat_anchor_protection_cap: msg('Maximum anchor protection percentage. Caps how much anchors can shield a simulation from damage.'),
    heartbeat_event_aging_rules: msg('JSON rules governing how events age and decay over time. Advanced – edit with caution.'),
  };
  return tooltips[key] ?? '';
}

@localized()
@customElement('velg-admin-heartbeat-tab')
export class VelgAdminHeartbeatTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminSectionHeaderStyles,
    adminGlobalCardStyles,
    adminToggleStyles,
    adminLoadingStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        --_admin-accent: var(--color-warning);
        --_toggle-active: var(--color-success);
      }

      .section {
        margin-bottom: var(--space-8);
      }

      /* ── Config Grid ─────────────────────── */

      .config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: var(--space-3);
      }

      .config-item {
        padding: var(--space-3) var(--space-4);
        border: var(--border-default);
        background: var(--color-surface-raised);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .config-item__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }

      .config-item__label {
        display: inline-flex;
        align-items: center;
        font-family: var(--font-brutalist);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
      }

      .config-item__value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        font-weight: var(--font-bold);
      }

      .config-item__value--enabled {
        color: var(--color-success);
      }

      .config-item__value--disabled {
        color: var(--color-danger);
      }

      .config-item__input-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .config-input {
        width: 100%;
        max-width: 140px;
        padding: var(--space-1-5) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        min-height: 36px;
        transition: border-color 0.2s ease;
      }

      .config-input:focus {
        outline: none;
        border-color: var(--color-warning);
        box-shadow: 0 0 0 1px var(--color-warning);
      }

      .config-input::-webkit-inner-spin-button,
      .config-input::-webkit-outer-spin-button {
        opacity: 1;
      }

      /* ── Aging Rules Sub-Grid ────────────── */

      .aging-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      .aging-grid .config-item {
        margin: 0;
      }

      /* ── Save Button ─────────────────────── */

      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: var(--space-2) var(--space-4);
        background: transparent;
        border: 1px solid var(--color-success);
        color: var(--color-success);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 44px;
        min-width: 44px;
      }

      .save-btn:hover {
        background: color-mix(in srgb, var(--color-success) 10%, transparent);
      }

      .save-btn:focus-visible {
        outline: 2px solid var(--color-success);
        outline-offset: 2px;
      }

      .save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .save-btn--warning {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }

      .save-btn--warning:hover {
        background: color-mix(in srgb, var(--color-warning) 10%, transparent);
      }

      .save-btn--warning:focus-visible {
        outline: 2px solid var(--color-warning);
      }

      /* ── Simulation Grid ─────────────────── */

      .sim-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: var(--space-4);
      }

      .sim-card {
        border: var(--border-default);
        background: var(--color-surface-raised);
        padding: var(--space-4);
        opacity: 0;
        animation: card-enter 0.35s ease-out forwards;
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
      }

      .sim-card:hover {
        border-color: var(--color-text-muted);
      }

      .sim-card__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .sim-card__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-primary);
      }

      .sim-card__tick {
        margin-left: auto;
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        background: var(--color-border-light);
        padding: 1px 6px;
        border: 1px solid var(--color-border);
      }

      .sim-card__stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .stat {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .stat__label {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
      }

      .stat__value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }

      .sim-card__countdown {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin-bottom: var(--space-3);
      }

      /* ── Force Tick Button ────────────────── */

      .force-tick-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: var(--space-2) var(--space-4);
        background: transparent;
        border: 1px solid var(--color-warning);
        color: var(--color-warning);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 44px;
        min-width: 44px;
      }

      .force-tick-btn:hover {
        background: color-mix(in srgb, var(--color-warning) 10%, transparent);
      }

      .force-tick-btn:focus-visible {
        outline: 2px solid var(--color-warning);
        outline-offset: 2px;
      }

      .force-tick-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* ── Override Editor ──────────────────── */

      .override-card {
        padding: var(--space-5);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        margin-bottom: var(--space-4);
      }

      .override-card__row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        flex-wrap: wrap;
      }

      .override-card__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .override-card__field-label {
        font-family: var(--font-brutalist);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
      }

      .override-select {
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        min-height: 44px;
        min-width: 200px;
        cursor: pointer;
        transition: border-color 0.2s ease;
        appearance: auto;
      }

      .override-select:focus {
        outline: none;
        border-color: var(--color-warning);
        box-shadow: 0 0 0 1px var(--color-warning);
      }

      .override-form {
        margin-top: var(--space-4);
        padding: var(--space-4);
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
      }

      .override-form__row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        flex-wrap: wrap;
      }

      .override-form__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-top: var(--space-4);
      }

      .override-toggle-area {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .override-toggle-label {
        font-family: var(--font-brutalist);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
      }

      /* ── Cascade Rules Table ──────────────── */

      .rules-table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .rules-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
      }

      .rules-table th {
        font-family: var(--font-brutalist);
        font-size: 10px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
        text-align: left;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--color-border);
        white-space: nowrap;
      }

      .rules-table td {
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
        color: var(--color-text-primary);
        vertical-align: middle;
        white-space: nowrap;
      }

      .rules-table tr:hover td {
        background: color-mix(in srgb, var(--color-warning) 4%, transparent);
      }

      .rules-table__signature {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-weight: var(--font-bold);
      }

      .rules-table__arrow {
        color: var(--color-text-muted);
        font-size: var(--text-xs);
      }

      .rules-table__inactive td {
        opacity: 0.45;
      }

      .rules-table__timestamp {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      /* ── Status Dots (unique to HeartbeatTab) ── */

      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: var(--space-1);
      }

      .status-dot--active {
        background: var(--color-success);
      }

      .status-dot--idle {
        background: var(--color-text-muted);
      }

      /* ── Dirty indicator ─────────────────── */

      .dirty-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-warning);
        margin-left: var(--space-1);
        vertical-align: middle;
      }

      @media (prefers-reduced-motion: reduce) {
        .sim-card {
          animation: none;
          opacity: 1;
        }

        .global-card__status--active .global-card__status-dot {
          animation: none;
        }
      }

      @media (max-width: 768px) {
        .sim-grid {
          grid-template-columns: 1fr;
        }

        .config-grid {
          grid-template-columns: 1fr;
        }

        .override-card__row {
          flex-direction: column;
          align-items: stretch;
        }

        .override-form__row {
          flex-direction: column;
          align-items: stretch;
        }

        .rules-table {
          font-size: var(--text-xs);
        }
      }
    `,
  ];

  /* ── State ─────────────────────────────── */

  @state() private _dashboard: HeartbeatDashboard | null = null;
  @state() private _loading = true;
  @state() private _tickingId: string | null = null;

  /* Global config editing */
  @state() private _configValues: Record<ConfigKey, string> = {
    heartbeat_enabled: 'true',
    heartbeat_interval_seconds: '3600',
    heartbeat_scar_decay_rate: '0.05',
    heartbeat_attunement_growth_rate: '0.1',
    heartbeat_anchor_growth_per_sim: '0.02',
    heartbeat_escalation_threshold: '5',
    heartbeat_cascade_pressure_trigger: '0.8',
    heartbeat_bureau_contain_multiplier: '0.5',
    heartbeat_bureau_remediate_multiplier: '0.7',
    heartbeat_bureau_adapt_multiplier: '0.3',
    heartbeat_bureau_max_agents: '3',
    heartbeat_positive_event_probability: '0.25',
    heartbeat_max_attunements: '3',
    heartbeat_switching_cooldown_ticks: '2',
    heartbeat_anchor_protection_cap: '0.8',
    heartbeat_event_aging_rules: JSON.stringify({
      active_to_escalating: 5,
      escalating_to_resolving: 8,
      resolving_to_resolved: 4,
      resolved_to_archived: 10,
    }),
  };
  @state() private _configDirty: Set<ConfigKey> = new Set();
  @state() private _savingConfig: ConfigKey | null = null;

  /* Per-simulation overrides */
  @state() private _overrides: SimulationOverride[] = [];
  @state() private _selectedOverrideSimId: string | null = null;
  @state() private _overrideIntervalDraft: string = '';
  @state() private _overrideEnabledDraft = true;
  @state() private _savingOverride = false;

  /* Cascade rules */
  @state() private _cascadeRules: CascadeRule[] = [];
  @state() private _togglingRuleId: string | null = null;

  /* ── Lifecycle ─────────────────────────── */

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  /* ── Data Loading ──────────────────────── */

  private async _load(): Promise<void> {
    this._loading = true;
    await Promise.all([
      this._loadDashboard(),
      this._loadSettings(),
      this._loadOverrides(),
      this._loadCascadeRules(),
    ]);
    this._loading = false;
  }

  private async _loadDashboard(): Promise<void> {
    const res = await heartbeatApi.getDashboard();
    if (res.success && res.data) {
      this._dashboard = res.data as HeartbeatDashboard;
    }
  }

  private async _loadSettings(): Promise<void> {
    const res = await adminApi.listSettings();
    if (res.success && res.data) {
      const settings = res.data as PlatformSetting[];
      const newValues = { ...this._configValues };
      for (const s of settings) {
        if (CONFIG_KEYS.includes(s.setting_key as ConfigKey)) {
          newValues[s.setting_key as ConfigKey] = s.setting_value;
        }
      }
      this._configValues = newValues;
      this._configDirty = new Set();
    }
  }

  private async _loadOverrides(): Promise<void> {
    const res = await heartbeatApi.getDashboard();
    if (res.success && res.data) {
      const dash = res.data as HeartbeatDashboard;
      this._overrides = dash.simulations.map((sim) => ({
        simulation_id: sim.simulation_id,
        simulation_name: sim.simulation_name,
        interval_override_seconds: null,
        enabled: true,
      }));
    }
  }

  private async _loadCascadeRules(): Promise<void> {
    /* Load cascade rules from the resonance_cascade_rules DB table. */
    const res = await heartbeatApi.listCascadeRules();
    if (res.success && res.data) {
      const rules = res.data as unknown as Array<Record<string, unknown>>;
      this._cascadeRules = rules.map((r) => ({
        id: String(r.id ?? ''),
        source_signature: String(r.source_signature ?? ''),
        target_signature: String(r.target_signature ?? ''),
        threshold: Number(r.pressure_threshold ?? 0),
        transfer_rate: Number(r.transfer_rate ?? 0),
        cooldown_hours: Number(r.cooldown_hours ?? 72),
        is_active: Boolean(r.is_active ?? true),
        last_triggered_at: r.last_triggered_at ? String(r.last_triggered_at) : null,
      }));
    }
  }

  /* ── Config Actions ────────────────────── */

  private _onConfigChange(key: ConfigKey, value: string): void {
    this._configValues = { ...this._configValues, [key]: value };
    const dirty = new Set(this._configDirty);
    dirty.add(key);
    this._configDirty = dirty;
  }

  private _onConfigToggle(key: ConfigKey): void {
    const current = this._configValues[key];
    const newVal = current === 'true' ? 'false' : 'true';
    this._onConfigChange(key, newVal);
  }

  private async _saveConfig(key: ConfigKey): Promise<void> {
    if (this._savingConfig) return;
    this._savingConfig = key;

    const value = this._configValues[key];
    const result = await adminApi.updateSetting(key, value);

    if (result.success) {
      VelgToast.success(msg('Setting saved.'));
      const dirty = new Set(this._configDirty);
      dirty.delete(key);
      this._configDirty = dirty;
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to save setting.'));
    }

    this._savingConfig = null;
  }

  private async _saveAllDirtyConfig(): Promise<void> {
    const keys = [...this._configDirty];
    for (const key of keys) {
      await this._saveConfig(key);
    }
  }

  /* ── Override Actions ──────────────────── */

  private _onSelectOverrideSim(e: Event): void {
    const simId = (e.target as HTMLSelectElement).value;
    if (!simId) {
      this._selectedOverrideSimId = null;
      return;
    }
    this._selectedOverrideSimId = simId;
    const existing = this._overrides.find((o) => o.simulation_id === simId);
    this._overrideIntervalDraft =
      existing?.interval_override_seconds != null
        ? String(existing.interval_override_seconds)
        : '';
    this._overrideEnabledDraft = existing?.enabled ?? true;
  }

  private async _saveOverride(): Promise<void> {
    if (!this._selectedOverrideSimId || this._savingOverride) return;
    this._savingOverride = true;

    const interval = this._overrideIntervalDraft
      ? parseInt(this._overrideIntervalDraft, 10)
      : null;

    /* Save as a per-simulation setting via admin settings API */
    const overrideKey = `heartbeat_override_${this._selectedOverrideSimId}`;
    const overrideValue = JSON.stringify({
      interval_override_seconds: interval,
      enabled: this._overrideEnabledDraft,
    });

    const result = await adminApi.updateSetting(overrideKey, overrideValue);

    if (result.success) {
      VelgToast.success(msg('Override saved.'));
      /* Update local state */
      this._overrides = this._overrides.map((o) =>
        o.simulation_id === this._selectedOverrideSimId
          ? {
              ...o,
              interval_override_seconds: interval,
              enabled: this._overrideEnabledDraft,
            }
          : o,
      );
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to save override.'));
    }

    this._savingOverride = false;
  }

  /* ── Cascade Actions ───────────────────── */

  private async _toggleCascadeRule(ruleId: string): Promise<void> {
    if (this._togglingRuleId) return;
    this._togglingRuleId = ruleId;

    const updatedRules = this._cascadeRules.map((r) =>
      r.id === ruleId ? { ...r, is_active: !r.is_active } : r,
    );

    const result = await adminApi.updateSetting(
      'heartbeat_cascade_rules',
      JSON.stringify(updatedRules),
    );

    if (result.success) {
      this._cascadeRules = updatedRules;
      const rule = updatedRules.find((r) => r.id === ruleId);
      VelgToast.success(
        rule?.is_active
          ? msg('Cascade rule activated.')
          : msg('Cascade rule deactivated.'),
      );
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update rule.'));
    }

    this._togglingRuleId = null;
  }

  /* ── Force Tick ────────────────────────── */

  private async _forceTick(simId: string): Promise<void> {
    this._tickingId = simId;
    await heartbeatApi.forceTick(simId);
    this._tickingId = null;
    await this._loadDashboard();
  }

  /* ── Formatters ────────────────────────── */

  private _formatCountdown(nextAt: string | null | undefined): string {
    if (!nextAt) return msg('Never ticked');
    const next = new Date(nextAt);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    if (diff <= 0) return msg('Due now');
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  private _configLabel(key: ConfigKey): string {
    const labels: Record<ConfigKey, string> = {
      heartbeat_enabled: msg('Heartbeat Enabled'),
      heartbeat_interval_seconds: msg('Interval (seconds)'),
      heartbeat_scar_decay_rate: msg('Scar Decay Rate'),
      heartbeat_attunement_growth_rate: msg('Attunement Growth Rate'),
      heartbeat_anchor_growth_per_sim: msg('Anchor Growth / Sim'),
      heartbeat_escalation_threshold: msg('Escalation Threshold'),
      heartbeat_cascade_pressure_trigger: msg('Cascade Pressure Trigger'),
      heartbeat_bureau_contain_multiplier: msg('Contain Multiplier'),
      heartbeat_bureau_remediate_multiplier: msg('Remediate Multiplier'),
      heartbeat_bureau_adapt_multiplier: msg('Adapt Multiplier'),
      heartbeat_bureau_max_agents: msg('Max Bureau Agents'),
      heartbeat_positive_event_probability: msg('Positive Event Probability'),
      heartbeat_max_attunements: msg('Max Attunements'),
      heartbeat_switching_cooldown_ticks: msg('Switching Cooldown (ticks)'),
      heartbeat_anchor_protection_cap: msg('Anchor Protection Cap'),
      heartbeat_event_aging_rules: msg('Event Aging Rules'),
    };
    return labels[key];
  }

  /* ── Render ────────────────────────────── */

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading heartbeat dashboard...')}</div>`;
    }

    if (!this._dashboard) {
      return html`<div class="empty">${msg('Failed to load dashboard.')}</div>`;
    }

    return html`
      ${this._renderGlobalConfig()}
      ${this._renderConfigGrid()}
      ${this._renderBureauTuning()}
      ${this._renderAttunementTuning()}
      ${this._renderAnchorTuning()}
      ${this._renderEventAgingRules()}
      ${this._renderOverrideEditor()}
      ${this._renderCascadeRules()}
      ${this._renderSimulations()}
    `;
  }

  /* ── Section 1: Global Master Switch ─── */

  private _renderGlobalConfig() {
    const enabled = this._configValues.heartbeat_enabled === 'true';

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Master Switch')}</h2>
        </div>

        <div class="global-card ${enabled ? 'global-card--active' : 'global-card--disabled'}">
          <div class="global-card__corner global-card__corner--tl"></div>
          <div class="global-card__corner global-card__corner--tr"></div>
          <div class="global-card__corner global-card__corner--bl"></div>
          <div class="global-card__corner global-card__corner--br"></div>

          <div class="global-card__row">
            <div class="global-card__info">
              <p class="global-card__label">
                ${msg('Heartbeat System')}
                ${renderInfoBubble(getConfigTooltip('heartbeat_enabled'), 'tip-heartbeat_enabled')}
              </p>
              <p class="global-card__description">
                ${msg('Controls the heartbeat tick engine across all simulations. When disabled, no automatic ticks will fire, narrative arcs will not age, and scar tissue will not decay.')}
              </p>
              <div
                class="global-card__status ${enabled ? 'global-card__status--active' : 'global-card__status--disabled'}"
              >
                <span class="global-card__status-dot"></span>
                ${enabled ? msg('System Active') : msg('System Disabled')}
              </div>
            </div>
            <label class="toggle">
              <input
                class="toggle__input"
                type="checkbox"
                .checked=${enabled}
                ?disabled=${this._savingConfig === 'heartbeat_enabled'}
                @change=${() => {
                  this._onConfigToggle('heartbeat_enabled');
                  this._saveConfig('heartbeat_enabled');
                }}
                aria-label=${msg('Toggle heartbeat engine')}
                aria-describedby="tip-heartbeat_enabled"
              />
              <span class="toggle__track"></span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Section 1b: Config Parameter Grid ── */

  /* Keys that belong to dedicated tuning sections (not the main grid) */
  private static readonly _TUNING_KEYS = new Set<ConfigKey>([
    'heartbeat_bureau_contain_multiplier',
    'heartbeat_bureau_remediate_multiplier',
    'heartbeat_bureau_adapt_multiplier',
    'heartbeat_bureau_max_agents',
    'heartbeat_positive_event_probability',
    'heartbeat_max_attunements',
    'heartbeat_switching_cooldown_ticks',
    'heartbeat_anchor_protection_cap',
    'heartbeat_event_aging_rules',
  ]);

  private _renderConfigGrid() {
    const numericKeys = CONFIG_KEYS.filter(
      (k) => k !== 'heartbeat_enabled' && !VelgAdminHeartbeatTab._TUNING_KEYS.has(k),
    );
    const hasDirty = this._configDirty.size > 0;

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">
            ${msg('Global Configuration')}
            ${hasDirty ? html`<span class="dirty-dot" title=${msg('Unsaved changes')}></span>` : nothing}
          </h2>
        </div>

        <div class="config-grid">
          ${numericKeys.map((key) => this._renderConfigItem(key))}
        </div>

        ${hasDirty
          ? html`
              <div style="margin-top: var(--space-4)">
                <button
                  class="save-btn"
                  ?disabled=${this._savingConfig !== null}
                  @click=${() => this._saveAllDirtyConfig()}
                >
                  ${icons.checkCircle(14)}
                  ${this._savingConfig ? msg('Saving...') : msg('Save All Changes')}
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderConfigItem(key: ConfigKey) {
    const isDirty = this._configDirty.has(key);
    const isSaving = this._savingConfig === key;
    const tooltip = getConfigTooltip(key);

    return html`
      <div class="config-item">
        <div class="config-item__header">
          <span class="config-item__label">
            ${this._configLabel(key)}
            ${tooltip ? renderInfoBubble(tooltip, `tip-${key}`) : nothing}
            ${isDirty ? html`<span class="dirty-dot"></span>` : nothing}
          </span>
        </div>
        <div class="config-item__input-row">
          <input
            class="config-input"
            type="number"
            step="any"
            .value=${this._configValues[key]}
            ?disabled=${isSaving}
            @input=${(e: Event) =>
              this._onConfigChange(key, (e.target as HTMLInputElement).value)}
            aria-label=${this._configLabel(key)}
            aria-describedby=${tooltip ? `tip-${key}` : nothing}
          />
          ${isDirty
            ? html`
                <button
                  class="save-btn"
                  ?disabled=${isSaving}
                  @click=${() => this._saveConfig(key)}
                  aria-label=${msg('Save')}
                  title=${msg('Save this setting')}
                >
                  ${icons.checkCircle(14)}
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  /* ── Section 1c: Bureau Response Tuning ── */

  private _renderBureauTuning() {
    const keys: ConfigKey[] = [
      'heartbeat_bureau_contain_multiplier',
      'heartbeat_bureau_remediate_multiplier',
      'heartbeat_bureau_adapt_multiplier',
      'heartbeat_bureau_max_agents',
    ];

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Bureau Response Tuning')}</h2>
        </div>
        <div class="config-grid">
          ${keys.map((key) => this._renderConfigItem(key))}
        </div>
      </div>
    `;
  }

  /* ── Section 1d: Attunement Tuning ────── */

  private _renderAttunementTuning() {
    const keys: ConfigKey[] = [
      'heartbeat_positive_event_probability',
      'heartbeat_max_attunements',
      'heartbeat_switching_cooldown_ticks',
    ];

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Attunement Tuning')}</h2>
        </div>
        <div class="config-grid">
          ${keys.map((key) => this._renderConfigItem(key))}
        </div>
      </div>
    `;
  }

  /* ── Section 1e: Anchor Tuning ────────── */

  private _renderAnchorTuning() {
    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Anchor Tuning')}</h2>
        </div>
        <div class="config-grid">
          ${this._renderConfigItem('heartbeat_anchor_protection_cap')}
        </div>
      </div>
    `;
  }

  /* ── Section 1f: Event Aging Rules ────── */

  private _renderEventAgingRules() {
    let rules: Record<string, number>;
    try {
      rules = JSON.parse(this._configValues.heartbeat_event_aging_rules);
    } catch {
      rules = {
        active_to_escalating: 5,
        escalating_to_resolving: 8,
        resolving_to_resolved: 4,
        resolved_to_archived: 10,
      };
    }

    const isDirty = this._configDirty.has('heartbeat_event_aging_rules');
    const isSaving = this._savingConfig === 'heartbeat_event_aging_rules';

    const fields: { key: string; label: string }[] = [
      { key: 'active_to_escalating', label: msg('Active \u2192 Escalating') },
      { key: 'escalating_to_resolving', label: msg('Escalating \u2192 Resolving') },
      { key: 'resolving_to_resolved', label: msg('Resolving \u2192 Resolved') },
      { key: 'resolved_to_archived', label: msg('Resolved \u2192 Archived') },
    ];

    const onFieldChange = (fieldKey: string, value: string) => {
      const updated = { ...rules, [fieldKey]: parseInt(value, 10) || 0 };
      this._onConfigChange(
        'heartbeat_event_aging_rules',
        JSON.stringify(updated),
      );
    };

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">
            ${msg('Event Aging Rules')}
            ${renderInfoBubble(getConfigTooltip('heartbeat_event_aging_rules'), 'tip-heartbeat_event_aging_rules')}
            ${isDirty ? html`<span class="dirty-dot" title=${msg('Unsaved changes')}></span>` : nothing}
          </h2>
        </div>

        <div class="aging-grid">
          ${fields.map(
            (f) => html`
              <div class="config-item">
                <div class="config-item__header">
                  <span class="config-item__label">${f.label}</span>
                </div>
                <div class="config-item__input-row">
                  <input
                    class="config-input"
                    type="number"
                    min="1"
                    step="1"
                    .value=${String(rules[f.key] ?? 0)}
                    ?disabled=${isSaving}
                    @input=${(e: Event) =>
                      onFieldChange(f.key, (e.target as HTMLInputElement).value)}
                    aria-label=${f.label}
                    aria-describedby="tip-heartbeat_event_aging_rules"
                  />
                </div>
              </div>
            `,
          )}
        </div>

        ${isDirty
          ? html`
              <div style="margin-top: var(--space-4)">
                <button
                  class="save-btn"
                  ?disabled=${isSaving}
                  @click=${() => this._saveConfig('heartbeat_event_aging_rules')}
                >
                  ${icons.checkCircle(14)}
                  ${isSaving ? msg('Saving...') : msg('Save Aging Rules')}
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  /* ── Section 2: Per-Simulation Overrides ─ */

  private _renderOverrideEditor() {
    const d = this._dashboard!;
    const selectedSim = this._selectedOverrideSimId
      ? d.simulations.find((s) => s.simulation_id === this._selectedOverrideSimId)
      : null;

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Per-Simulation Overrides')}</h2>
        </div>

        <div class="override-card">
          <div class="override-card__row">
            <div class="override-card__field">
              <span class="override-card__field-label">${msg('Simulation')}</span>
              <select
                class="override-select"
                @change=${this._onSelectOverrideSim}
                aria-label=${msg('Select simulation for override')}
                aria-describedby="tip-override-select"
              >
                <option value="">${msg('Select a simulation...')}</option>
                ${d.simulations.map(
                  (sim) => html`
                    <option
                      value=${sim.simulation_id}
                      ?selected=${sim.simulation_id === this._selectedOverrideSimId}
                    >
                      ${sim.simulation_name}
                    </option>
                  `,
                )}
              </select>
            </div>
          </div>

          ${selectedSim ? this._renderOverrideForm(selectedSim) : nothing}
        </div>
      </div>
    `;
  }

  private _renderOverrideForm(sim: HeartbeatSimulationStatus) {
    return html`
      <div class="override-form">
        <p class="config-item__label" style="margin-bottom: var(--space-3)">
          ${msg('Override settings for')} ${sim.simulation_name}
        </p>

        <div class="override-form__row">
          <div class="override-card__field">
            <span class="override-card__field-label">${msg('Interval Override (seconds)')}</span>
            <input
              class="config-input"
              type="number"
              min="0"
              step="1"
              placeholder=${msg('Use global default')}
              .value=${this._overrideIntervalDraft}
              ?disabled=${this._savingOverride}
              @input=${(e: Event) => {
                this._overrideIntervalDraft = (e.target as HTMLInputElement).value;
              }}
              aria-label=${msg('Override interval in seconds')}
            />
          </div>

          <div class="override-card__field">
            <span class="override-card__field-label">${msg('Enabled')}</span>
            <div class="override-toggle-area">
              <label class="toggle">
                <input
                  class="toggle__input"
                  type="checkbox"
                  .checked=${this._overrideEnabledDraft}
                  ?disabled=${this._savingOverride}
                  @change=${() => {
                    this._overrideEnabledDraft = !this._overrideEnabledDraft;
                  }}
                  aria-label=${msg('Toggle heartbeat for this simulation')}
                />
                <span class="toggle__track"></span>
              </label>
              <span class="override-toggle-label">
                ${this._overrideEnabledDraft ? msg('Active') : msg('Paused')}
              </span>
            </div>
          </div>
        </div>

        <div class="override-form__actions">
          <button
            class="save-btn"
            ?disabled=${this._savingOverride}
            @click=${this._saveOverride}
          >
            ${icons.checkCircle(14)}
            ${this._savingOverride ? msg('Saving...') : msg('Save Override')}
          </button>
        </div>
      </div>
    `;
  }

  /* ── Section 3: Cascade Rules ──────────── */

  private _renderCascadeRules() {
    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Cascade Rules')}</h2>
        </div>

        ${this._cascadeRules.length === 0
          ? html`<div class="empty">${msg('No cascade rules configured.')}</div>`
          : html`
              <div class="rules-table-wrap">
                <table class="rules-table" role="grid">
                  <thead>
                    <tr>
                      <th scope="col">${msg('Signature')}</th>
                      <th scope="col">${msg('Threshold')}</th>
                      <th scope="col">${msg('Transfer Rate')}</th>
                      <th scope="col">${msg('Cooldown')}</th>
                      <th scope="col">${msg('Active')}</th>
                      <th scope="col">${msg('Last Triggered')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._cascadeRules.map((rule) => this._renderCascadeRow(rule))}
                  </tbody>
                </table>
              </div>
            `}
      </div>
    `;
  }

  private _renderCascadeRow(rule: CascadeRule) {
    const isToggling = this._togglingRuleId === rule.id;

    return html`
      <tr class="${rule.is_active ? '' : 'rules-table__inactive'}">
        <td>
          <span class="rules-table__signature">
            ${rule.source_signature}
            <span class="rules-table__arrow">${icons.chevronRight(12)}</span>
            ${rule.target_signature}
          </span>
        </td>
        <td>${rule.threshold.toFixed(2)}</td>
        <td>${rule.transfer_rate.toFixed(3)}</td>
        <td>${rule.cooldown_hours}h</td>
        <td>
          <label class="toggle ${isToggling ? 'toggle--disabled' : ''}">
            <input
              class="toggle__input"
              type="checkbox"
              .checked=${rule.is_active}
              ?disabled=${isToggling}
              @change=${() => this._toggleCascadeRule(rule.id)}
              aria-label=${`${msg('Toggle cascade rule')}: ${rule.source_signature} → ${rule.target_signature}`}
            />
            <span class="toggle__track"></span>
          </label>
        </td>
        <td>
          <span class="rules-table__timestamp">
            ${rule.last_triggered_at
              ? new Date(rule.last_triggered_at).toLocaleString()
              : msg('Never')}
          </span>
        </td>
      </tr>
    `;
  }

  /* ── Section 4: Simulation Cards ───────── */

  private _renderSimulations() {
    const d = this._dashboard!;

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Simulation Heartbeats')}</h2>
        </div>

        ${d.simulations.length === 0
          ? html`<div class="empty">${msg('No active simulations.')}</div>`
          : html`
              <div class="sim-grid">
                ${d.simulations.map((sim, i) => this._renderSimCard(sim, i))}
              </div>
            `}
      </div>
    `;
  }

  private _renderSimCard(sim: HeartbeatSimulationStatus, index: number) {
    const isTicking = this._tickingId === sim.simulation_id;

    return html`
      <div class="sim-card" style="animation-delay: ${index * 0.05}s">
        <div class="sim-card__header">
          <span
            class="status-dot ${sim.last_tick > 0 ? 'status-dot--active' : 'status-dot--idle'}"
          ></span>
          <span class="sim-card__name">${sim.simulation_name}</span>
          <span class="sim-card__tick">#${sim.last_tick}</span>
        </div>

        <div class="sim-card__stats">
          <div class="stat">
            <span class="stat__label">${msg('Active Arcs')}</span>
            <span class="stat__value">${sim.active_arcs}</span>
          </div>
          <div class="stat">
            <span class="stat__label">${msg('Pending Responses')}</span>
            <span class="stat__value">${sim.pending_responses}</span>
          </div>
          <div class="stat">
            <span class="stat__label">${msg('Scar Tissue')}</span>
            <span class="stat__value">${(sim.scar_tissue_level * 100).toFixed(1)}%</span>
          </div>
          <div class="stat">
            <span class="stat__label">${msg('Next Tick')}</span>
            <span class="stat__value">${this._formatCountdown(sim.next_heartbeat_at)}</span>
          </div>
        </div>

        ${sim.last_heartbeat_at
          ? html`
              <div class="sim-card__countdown">
                ${msg('Last tick')}: ${new Date(sim.last_heartbeat_at).toLocaleString()}
              </div>
            `
          : nothing}

        <button
          class="force-tick-btn"
          ?disabled=${isTicking}
          @click=${() => this._forceTick(sim.simulation_id)}
          aria-label=${msg('Force tick for this simulation')}
        >
          ${icons.heartbeat(14)}
          ${isTicking ? msg('Ticking...') : msg('Force Tick')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-heartbeat-tab': VelgAdminHeartbeatTab;
  }
}
