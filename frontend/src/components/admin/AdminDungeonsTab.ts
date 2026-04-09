import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { DungeonGlobalConfig } from '../../services/api/AdminApiService.js';
import { adminApi } from '../../services/api/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgToggle.js';
import {
  adminAnimationStyles,
  adminGlobalCardStyles,
  adminLoadingStyles,
  adminSectionHeaderStyles,
} from '../shared/admin-shared-styles.js';

/** All dungeon archetypes — must match backend ARCHETYPE_CONFIGS keys + signatures. */
const ARCHETYPES = [
  { id: 'The Shadow', label: 'The Shadow', signature: 'conflict_wave', icon: '\u25C8' },
  { id: 'The Tower', label: 'The Tower', signature: 'economic_tremor', icon: '\u25B2' },
  { id: 'The Entropy', label: 'The Entropy', signature: 'decay_bloom', icon: '\u25CC' },
  {
    id: 'The Devouring Mother',
    label: 'The Devouring Mother',
    signature: 'biological_tide',
    icon: '\u25C9',
  },
  { id: 'The Prometheus', label: 'The Prometheus', signature: 'innovation_spark', icon: '\u2662' },
  { id: 'The Deluge', label: 'The Deluge', signature: 'elemental_surge', icon: '\u2248' },
  { id: 'The Overthrow', label: 'The Overthrow', signature: 'authority_fracture', icon: '\u2694' },
  { id: 'The Awakening', label: 'The Awakening', signature: 'consciousness_drift', icon: '\u2609' },
] as const;

type OverrideMode = 'off' | 'supplement' | 'override';
type ClearanceMode = 'off' | 'standard' | 'custom';

interface SimulationRow {
  id: string;
  name: string;
  slug: string;
  mode: OverrideMode;
  archetypes: string[];
}

@localized()
@customElement('velg-admin-dungeons-tab')
export class VelgAdminDungeonsTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminSectionHeaderStyles,
    adminGlobalCardStyles,
    adminLoadingStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        --_admin-accent: var(--color-accent-gold, var(--color-accent-amber));
      }

      /* ── Segmented Control ── */

      .seg {
        display: flex;
        gap: 0;
        border: 1px solid var(--color-border);
        position: relative;
        overflow: hidden;
      }

      .seg__btn {
        flex: 1;
        padding: var(--space-2) var(--space-3);
        min-height: 36px;
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: transparent;
        color: var(--color-text-muted);
        border: none;
        border-right: 1px solid var(--color-border);
        cursor: pointer;
        transition:
          background var(--duration-fast) ease,
          color var(--duration-fast) ease;
      }

      .seg__btn:last-child {
        border-right: none;
      }

      .seg__btn:hover:not(.seg__btn--active) {
        background: color-mix(in srgb, var(--color-text-muted) 6%, transparent);
        color: var(--color-text-secondary);
      }

      .seg__btn--active {
        background: color-mix(in srgb, var(--_admin-accent) 12%, transparent);
        color: var(--_admin-accent);
      }

      .seg__btn:focus-visible {
        outline: 2px solid var(--_admin-accent);
        outline-offset: -2px;
        z-index: 1;
      }

      /* ── Global Config Card ── */

      .global-config {
        margin-bottom: var(--space-6);
        animation: panel-enter 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      }

      .global-config__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-5);
        margin-top: var(--space-4);
      }

      .global-config__section-label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-2) 0;
      }

      .global-config__desc {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        line-height: 1.5;
        margin: 0 0 var(--space-3) 0;
      }

      .global-config__divider {
        height: 1px;
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--_admin-accent) 20%, transparent) 0%,
          transparent 80%
        );
        margin: var(--space-4) 0;
      }

      .global-config__footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--color-border);
      }

      /* ── Threshold Input ── */

      .threshold-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }

      .threshold-input {
        width: 64px;
        padding: var(--space-1-5) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface-sunken);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        text-align: center;
        transition: border-color var(--duration-fast) ease;
      }

      .threshold-input:focus {
        outline: none;
        border-color: var(--_admin-accent);
        box-shadow: 0 0 0 1px var(--_admin-accent);
      }

      .threshold-unit {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      /* ── Archetype Checkboxes ── */

      .archetype-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
      }

      .archetype-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
        border: 1px solid transparent;
        transition:
          background var(--duration-fast) ease,
          border-color var(--duration-fast) ease;
        cursor: pointer;
      }

      .archetype-row:hover {
        background: color-mix(in srgb, var(--color-text-muted) 4%, transparent);
        border-color: var(--color-border);
      }

      .archetype-row--disabled {
        opacity: 0.3;
        pointer-events: none;
      }

      .archetype-check {
        width: 14px;
        height: 14px;
        border: 1px solid var(--color-border);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 9px;
        transition:
          border-color var(--duration-fast) ease,
          background var(--duration-fast) ease;
      }

      .archetype-check--on {
        border-color: var(--_admin-accent);
        background: color-mix(in srgb, var(--_admin-accent) 15%, transparent);
        color: var(--_admin-accent);
      }

      .archetype-icon {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        width: 16px;
        text-align: center;
      }

      .archetype-label {
        font-size: var(--text-xs);
        color: var(--color-text-primary);
        font-weight: var(--font-bold);
      }

      .archetype-sig {
        font-size: 10px;
        color: var(--color-text-muted);
        margin-left: auto;
      }

      /* ── Section Divider ── */

      .section-divider {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin: var(--space-6) 0 var(--space-4) 0;
      }

      .section-divider__line {
        flex: 1;
        height: 1px;
        background: var(--color-border);
      }

      .section-divider__text {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      /* ── Filter Bar ── */

      .filter-bar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-4);
      }

      .filter-bar__input {
        flex: 1;
        max-width: 320px;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        transition: border-color var(--duration-fast) ease;
      }

      .filter-bar__input::placeholder {
        color: var(--color-text-muted);
      }

      .filter-bar__input:focus {
        outline: none;
        border-color: var(--_admin-accent);
        box-shadow: 0 0 0 1px var(--_admin-accent);
      }

      .filter-bar__count {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      /* ── Simulation Grid ── */

      .sim-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        gap: var(--space-4);
      }

      /* ── Simulation Card ── */

      .sim-card {
        position: relative;
        padding: var(--space-4);
        padding-left: calc(var(--space-4) + 3px);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        transition:
          border-color var(--duration-normal) ease,
          box-shadow var(--duration-normal) ease;
        animation: card-enter 250ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      }

      .sim-card:hover {
        border-color: var(--color-text-muted);
      }

      /* Accent bar via ::before — robust, no border-left hack */
      .sim-card::before {
        content: '';
        position: absolute;
        top: -1px;
        left: -1px;
        bottom: -1px;
        width: 3px;
        background: transparent;
        transition: background var(--duration-normal) ease;
      }

      .sim-card--active::before {
        background: var(--_admin-accent);
      }

      .sim-card--inherited::before {
        background: color-mix(in srgb, var(--_admin-accent) 40%, transparent);
      }

      .sim-card--dirty {
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      }

      .sim-card__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
      }

      .sim-card__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
        margin: 0;
      }

      .sim-card__slug {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin: var(--space-0-5) 0 0 0;
      }

      /* ── Provenance Badge ── */

      .provenance {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px var(--space-2);
        white-space: nowrap;
      }

      .provenance--inherited {
        color: var(--color-text-muted);
        background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-text-muted) 15%, transparent);
      }

      .provenance--local {
        color: var(--_admin-accent);
        background: color-mix(in srgb, var(--_admin-accent) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_admin-accent) 25%, transparent);
      }

      .provenance--off {
        color: var(--color-text-muted);
        background: color-mix(in srgb, var(--color-text-muted) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-text-muted) 12%, transparent);
      }

      .provenance__dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
      }

      /* ── Card Mode / Footer ── */

      .sim-card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--space-3);
        padding-top: var(--space-2);
        border-top: 1px solid var(--color-border);
      }

      /* ── Buttons ── */

      .btn-save {
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: color-mix(in srgb, var(--_admin-accent) 15%, transparent);
        color: var(--_admin-accent);
        border: 1px solid var(--_admin-accent);
        cursor: pointer;
        transition:
          background var(--duration-fast) ease,
          opacity var(--duration-fast) ease,
          box-shadow var(--duration-fast) ease;
      }

      .btn-save:hover:not(:disabled) {
        background: color-mix(in srgb, var(--_admin-accent) 25%, transparent);
        box-shadow: 0 0 8px color-mix(in srgb, var(--_admin-accent) 20%, transparent);
      }

      .btn-save:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .btn-select-all {
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: transparent;
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
        cursor: pointer;
        white-space: nowrap;
        transition:
          color var(--duration-fast) ease,
          border-color var(--duration-fast) ease;
      }

      .btn-select-all:hover {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      /* ── Responsive ── */

      @media (max-width: 768px) {
        .sim-grid {
          grid-template-columns: 1fr;
        }

        .global-config__grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  // ── State ──────────────────────────────────────────────────────────────

  @state() private _simulations: SimulationRow[] = [];
  @state() private _globalConfig: DungeonGlobalConfig = {
    override_mode: 'off',
    override_archetypes: [],
    clearance_mode: 'standard',
    clearance_threshold: 10,
  };
  @state() private _globalConfigOriginal: DungeonGlobalConfig | null = null;
  @state() private _loading = true;
  @state() private _savingGlobal = false;
  @state() private _savingId: string | null = null;
  @state() private _filter = '';
  @state() private _dirty = new Set<string>();

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this._loading = true;

    const [globalResult, simResult] = await Promise.all([
      adminApi.getDungeonGlobalConfig(),
      adminApi.listDungeonOverrides(),
    ]);

    if (globalResult.success && globalResult.data) {
      this._globalConfig = { ...globalResult.data };
      this._globalConfigOriginal = { ...globalResult.data };
    }

    if (simResult.success && simResult.data) {
      this._simulations = simResult.data.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        mode: s.mode,
        archetypes: s.archetypes,
      }));
    }

    this._dirty.clear();
    this._loading = false;
  }

  // ── Global Config Mutations ────────────────────────────────────────────

  private _setGlobalOverrideMode(mode: OverrideMode): void {
    if (mode === 'off') {
      this._globalConfig = { ...this._globalConfig, override_mode: mode, override_archetypes: [] };
    } else {
      this._globalConfig = { ...this._globalConfig, override_mode: mode };
    }
  }

  private _toggleGlobalArchetype(archetype: string): void {
    const has = this._globalConfig.override_archetypes.includes(archetype);
    const archetypes = has
      ? this._globalConfig.override_archetypes.filter((a) => a !== archetype)
      : [...this._globalConfig.override_archetypes, archetype];
    this._globalConfig = { ...this._globalConfig, override_archetypes: archetypes };
  }

  private _selectAllGlobalArchetypes(): void {
    this._globalConfig = {
      ...this._globalConfig,
      override_archetypes: ARCHETYPES.map((a) => a.id),
    };
  }

  private _setGlobalClearanceMode(mode: ClearanceMode): void {
    const threshold = mode === 'standard' ? 10 : this._globalConfig.clearance_threshold;
    this._globalConfig = {
      ...this._globalConfig,
      clearance_mode: mode,
      clearance_threshold: threshold,
    };
  }

  private _setGlobalClearanceThreshold(value: number): void {
    const clamped = Math.max(0, Math.min(100, value));
    this._globalConfig = { ...this._globalConfig, clearance_threshold: clamped };
  }

  private get _globalDirty(): boolean {
    if (!this._globalConfigOriginal) return false;
    return (
      this._globalConfig.override_mode !== this._globalConfigOriginal.override_mode ||
      this._globalConfig.clearance_mode !== this._globalConfigOriginal.clearance_mode ||
      this._globalConfig.clearance_threshold !== this._globalConfigOriginal.clearance_threshold ||
      JSON.stringify(this._globalConfig.override_archetypes) !==
        JSON.stringify(this._globalConfigOriginal.override_archetypes)
    );
  }

  private async _saveGlobal(): Promise<void> {
    if (this._savingGlobal) return;
    this._savingGlobal = true;

    const result = await adminApi.updateDungeonGlobalConfig(this._globalConfig);
    if (result.success) {
      VelgToast.success(msg('Global dungeon configuration updated.'));
      this._globalConfigOriginal = { ...this._globalConfig };
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update global config.'));
    }

    this._savingGlobal = false;
  }

  // ── Per-Simulation Mutations ───────────────────────────────────────────

  private _setMode(simId: string, mode: OverrideMode): void {
    this._simulations = this._simulations.map((s) => {
      if (s.id !== simId) return s;
      const archetypes = mode === 'off' ? [] : s.archetypes;
      return { ...s, mode, archetypes };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private _toggleArchetype(simId: string, archetype: string): void {
    this._simulations = this._simulations.map((s) => {
      if (s.id !== simId) return s;
      const has = s.archetypes.includes(archetype);
      const archetypes = has
        ? s.archetypes.filter((a) => a !== archetype)
        : [...s.archetypes, archetype];
      return { ...s, archetypes };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private _selectAll(simId: string): void {
    this._simulations = this._simulations.map((s) => {
      if (s.id !== simId) return s;
      return { ...s, archetypes: ARCHETYPES.map((a) => a.id) };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private async _save(simId: string): Promise<void> {
    if (this._savingId) return;
    this._savingId = simId;

    const sim = this._simulations.find((s) => s.id === simId);
    if (!sim) {
      this._savingId = null;
      return;
    }

    const result = await adminApi.updateDungeonOverride(simId, {
      mode: sim.mode,
      archetypes: sim.archetypes,
    });

    if (result.success) {
      VelgToast.success(msg('Dungeon override updated.'));
      this._dirty.delete(simId);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update.'));
    }

    this._savingId = null;
  }

  // ── Computed ────────────────────────────────────────────────────────────

  /** i18n-safe status label for the global config footer. */
  private get _globalStatusLabel(): string {
    const gc = this._globalConfig;
    const parts: string[] = [];
    if (gc.override_mode === 'supplement') parts.push(msg('Supplement'));
    if (gc.override_mode === 'override') parts.push(msg('Override'));
    if (gc.clearance_mode === 'off') parts.push(msg('Clearance off'));
    if (gc.clearance_mode === 'custom') parts.push(msg('Clearance custom'));
    return parts.join(' + ');
  }

  private get _filtered(): SimulationRow[] {
    if (!this._filter) return this._simulations;
    const q = this._filter.toLowerCase();
    return this._simulations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading dungeon configuration...')}</div>`;
    }

    return html`
      ${this._renderGlobalConfig()}
      ${this._renderSectionDivider()}
      ${this._renderSimGrid()}
    `;
  }

  // ── Global Config Card ─────────────────────────────────────────────────

  private _renderGlobalConfig() {
    const gc = this._globalConfig;
    const isActive = gc.override_mode !== 'off' || gc.clearance_mode !== 'standard';

    return html`
      <div class="global-config">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Global Dungeon Configuration')}</h2>
        </div>

        <div class="global-card ${isActive ? 'global-card--active' : ''}">
          <div class="global-card__corner global-card__corner--tl"></div>
          <div class="global-card__corner global-card__corner--tr"></div>
          <div class="global-card__corner global-card__corner--bl"></div>
          <div class="global-card__corner global-card__corner--br"></div>

          <div class="global-config__grid">
            <!-- Left: Override Mode + Archetypes -->
            <div>
              <p class="global-config__section-label">${msg('Override Mode')}</p>
              <p class="global-config__desc">
                ${msg('Cascading default for all simulations without a local override.')}
              </p>

              <div class="seg" role="group" aria-label=${msg('Global override mode')}>
                ${this._renderSegBtn('off', gc.override_mode, () => this._setGlobalOverrideMode('off'), msg('Off'))}
                ${this._renderSegBtn('supplement', gc.override_mode, () => this._setGlobalOverrideMode('supplement'), msg('Supplement'))}
                ${this._renderSegBtn('override', gc.override_mode, () => this._setGlobalOverrideMode('override'), msg('Override'))}
              </div>

              ${
                gc.override_mode !== 'off'
                  ? html`
                <div style="margin-top: var(--space-3);">
                  <div class="archetype-list">
                    ${ARCHETYPES.map((arch) => {
                      const checked = gc.override_archetypes.includes(arch.id);
                      return html`
                        <div
                          class="archetype-row"
                          @click=${() => this._toggleGlobalArchetype(arch.id)}
                        >
                          <div class="archetype-check ${checked ? 'archetype-check--on' : ''}">
                            ${checked ? '\u2713' : nothing}
                          </div>
                          <span class="archetype-icon">${arch.icon}</span>
                          <span class="archetype-label">${arch.label}</span>
                          <span class="archetype-sig">${arch.signature}</span>
                        </div>
                      `;
                    })}
                  </div>
                  <button
                    class="btn-select-all"
                    style="margin-top: var(--space-2);"
                    @click=${() => this._selectAllGlobalArchetypes()}
                  >${msg('Select All')}</button>
                </div>
              `
                  : nothing
              }
            </div>

            <!-- Right: Clearance Control -->
            <div>
              <p class="global-config__section-label">${msg('Terminal Clearance')}</p>
              <p class="global-config__desc">
                ${msg('Controls whether dungeon commands require a minimum clearance tier (earned by executing terminal commands).')}
              </p>

              <div class="seg" role="group" aria-label=${msg('Clearance mode')}>
                ${this._renderSegBtn('off', gc.clearance_mode, () => this._setGlobalClearanceMode('off'), msg('Off'))}
                ${this._renderSegBtn('standard', gc.clearance_mode, () => this._setGlobalClearanceMode('standard'), msg('Standard'))}
                ${this._renderSegBtn('custom', gc.clearance_mode, () => this._setGlobalClearanceMode('custom'), msg('Custom'))}
              </div>

              <p style="font-size: var(--text-xs); color: var(--color-text-muted); margin: var(--space-2) 0 0 0; line-height: 1.5;">
                ${
                  gc.clearance_mode === 'off'
                    ? msg('All dungeon commands are available immediately, no clearance required.')
                    : gc.clearance_mode === 'standard'
                      ? msg('Tier 2 unlocks after 10 executed commands (default).')
                      : msg('Tier 2 unlocks after a custom number of commands.')
                }
              </p>

              ${
                gc.clearance_mode === 'custom'
                  ? html`
                <div class="threshold-row">
                  <input
                    class="threshold-input"
                    type="number"
                    min="0"
                    max="100"
                    .value=${String(gc.clearance_threshold)}
                    @input=${(e: InputEvent) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val)) this._setGlobalClearanceThreshold(val);
                    }}
                  />
                  <span class="threshold-unit">${msg('commands')}</span>
                </div>
              `
                  : nothing
              }
            </div>
          </div>

          <!-- Footer: Save -->
          <div class="global-config__footer">
            ${
              isActive
                ? html`
              <div class="global-card__status global-card__status--active">
                <span class="global-card__status-dot"></span>
                ${this._globalStatusLabel}
              </div>
            `
                : html`
              <div class="global-card__status global-card__status--disabled">
                <span class="global-card__status-dot"></span>
                ${msg('Default')}
              </div>
            `
            }

            <button
              class="btn-save"
              ?disabled=${!this._globalDirty || this._savingGlobal}
              @click=${() => this._saveGlobal()}
            >${this._savingGlobal ? msg('Saving...') : msg('Save Global')}</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Section Divider ────────────────────────────────────────────────────

  private _renderSectionDivider() {
    return html`
      <div class="section-divider">
        <div class="section-divider__line"></div>
        <span class="section-divider__text">${msg('Per-Simulation Overrides')}</span>
        <div class="section-divider__line"></div>
      </div>
    `;
  }

  // ── Simulation Grid ────────────────────────────────────────────────────

  private _renderSimGrid() {
    const filtered = this._filtered;

    return html`
      <div class="filter-bar">
        <input
          class="filter-bar__input"
          type="text"
          placeholder=${msg('Filter simulations...')}
          .value=${this._filter}
          @input=${(e: InputEvent) => {
            this._filter = (e.target as HTMLInputElement).value;
          }}
        />
        <span class="filter-bar__count">${filtered.length} / ${this._simulations.length}</span>
      </div>

      <div class="sim-grid">
        ${filtered.map((sim, i) => this._renderSimCard(sim, i))}
      </div>
    `;
  }

  // ── Simulation Card ────────────────────────────────────────────────────

  private _renderSimCard(sim: SimulationRow, index: number) {
    const isLocalOverride = sim.mode !== 'off';
    const inheritsGlobal = !isLocalOverride && this._globalConfig.override_mode !== 'off';
    const isDirty = this._dirty.has(sim.id);
    const isSaving = this._savingId === sim.id;

    const cardClass = [
      'sim-card',
      isLocalOverride ? 'sim-card--active' : '',
      inheritsGlobal ? 'sim-card--inherited' : '',
      isDirty ? 'sim-card--dirty' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div class=${cardClass} style="animation-delay: ${index * 40}ms">
        <div class="sim-card__header">
          <div>
            <h3 class="sim-card__name">${sim.name}</h3>
            <p class="sim-card__slug">${sim.slug}</p>
          </div>
          ${this._renderProvenance(sim)}
        </div>

        <!-- Mode selector -->
        <div class="seg" role="group" aria-label=${msg('Override mode for') + ' ' + sim.name}>
          ${this._renderSegBtn('off', sim.mode, () => this._setMode(sim.id, 'off'), msg('Off'))}
          ${this._renderSegBtn('supplement', sim.mode, () => this._setMode(sim.id, 'supplement'), msg('Supplement'))}
          ${this._renderSegBtn('override', sim.mode, () => this._setMode(sim.id, 'override'), msg('Override'))}
        </div>

        <!-- Archetype checkboxes -->
        <div class="archetype-list" style="margin-top: var(--space-2);">
          ${ARCHETYPES.map((arch) => {
            const checked = isLocalOverride
              ? sim.archetypes.includes(arch.id)
              : inheritsGlobal
                ? this._globalConfig.override_archetypes.includes(arch.id)
                : false;
            const disabled = !isLocalOverride;
            return html`
              <div
                class="archetype-row ${disabled ? 'archetype-row--disabled' : ''}"
                @click=${() => !disabled && this._toggleArchetype(sim.id, arch.id)}
              >
                <div class="archetype-check ${checked ? 'archetype-check--on' : ''}">
                  ${checked ? '\u2713' : nothing}
                </div>
                <span class="archetype-icon">${arch.icon}</span>
                <span class="archetype-label">${arch.label}</span>
                <span class="archetype-sig">${arch.signature}</span>
              </div>
            `;
          })}
        </div>

        <!-- Footer: select all + save -->
        <div class="sim-card__footer">
          ${
            isLocalOverride
              ? html`
            <button
              class="btn-select-all"
              @click=${() => this._selectAll(sim.id)}
            >${msg('Select All')}</button>
          `
              : html`<span></span>`
          }

          ${
            isDirty
              ? html`
            <button
              class="btn-save"
              ?disabled=${isSaving}
              @click=${() => this._save(sim.id)}
            >${isSaving ? msg('Saving...') : msg('Save')}</button>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  // ── Provenance Badge ───────────────────────────────────────────────────

  private _renderProvenance(sim: SimulationRow) {
    if (sim.mode !== 'off') {
      return html`
        <span class="provenance provenance--local">
          <span class="provenance__dot"></span>
          ${msg('Local Override')}
        </span>
      `;
    }
    if (this._globalConfig.override_mode !== 'off') {
      return html`
        <span class="provenance provenance--inherited">
          <span class="provenance__dot"></span>
          ${msg('Inherited')}
        </span>
      `;
    }
    return html`
      <span class="provenance provenance--off">
        ${msg('Resonance Only')}
      </span>
    `;
  }

  // ── Segmented Button ───────────────────────────────────────────────────

  private _renderSegBtn(value: string, current: string, onClick: () => void, label: string) {
    return html`
      <button
        class="seg__btn ${value === current ? 'seg__btn--active' : ''}"
        aria-pressed=${value === current ? 'true' : 'false'}
        @click=${onClick}
      >${label}</button>
    `;
  }
}
