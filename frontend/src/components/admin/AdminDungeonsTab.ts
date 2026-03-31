import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgToggle.js';
import {
  adminAnimationStyles,
  adminSectionHeaderStyles,
  adminGlobalCardStyles,
  adminLoadingStyles,
} from './admin-shared-styles.js';

/** All implemented dungeon archetypes with display metadata. */
const ARCHETYPES = [
  { id: 'The Shadow', label: 'The Shadow', signature: 'conflict_wave', icon: '\u25C8' },
  { id: 'The Tower', label: 'The Tower', signature: 'economic_tremor', icon: '\u25B2' },
  { id: 'The Entropy', label: 'The Entropy', signature: 'cultural_drift', icon: '\u25CC' },
  { id: 'The Devouring Mother', label: 'The Devouring Mother', signature: 'social_surge', icon: '\u25C9' },
] as const;

type OverrideMode = 'off' | 'supplement' | 'override';

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
        --_admin-accent: var(--color-accent-gold);
      }

      /* ── Filter ── */

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
        border-radius: 0;
        transition: border-color 0.2s ease;
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

      .sim-card {
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
      }

      .sim-card:hover {
        border-color: var(--color-text-muted);
      }

      .sim-card--active {
        border-left: 3px solid var(--_admin-accent);
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

      /* ── Mode Selector ── */

      .mode-selector {
        display: flex;
        gap: 0;
        margin-bottom: var(--space-3);
        border: 1px solid var(--color-border);
      }

      .mode-btn {
        flex: 1;
        padding: var(--space-1-5) var(--space-2);
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
          background 0.15s ease,
          color 0.15s ease;
      }

      .mode-btn:last-child {
        border-right: none;
      }

      .mode-btn:hover:not(.mode-btn--active) {
        background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
        color: var(--color-text-primary);
      }

      .mode-btn--active {
        background: color-mix(in srgb, var(--_admin-accent) 15%, transparent);
        color: var(--_admin-accent);
      }

      /* ── Archetype Checkboxes ── */

      .archetype-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .archetype-row {
        display: flex;
        align-items: center;
        gap: var(--space-2-5);
        padding: var(--space-1-5) var(--space-2);
        border: 1px solid transparent;
        transition:
          background 0.15s ease,
          border-color 0.15s ease;
        cursor: pointer;
      }

      .archetype-row:hover {
        background: color-mix(in srgb, var(--color-text-muted) 5%, transparent);
        border-color: var(--color-border);
      }

      .archetype-row--disabled {
        opacity: 0.35;
        pointer-events: none;
      }

      .archetype-check {
        width: 16px;
        height: 16px;
        border: 1px solid var(--color-border);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 10px;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }

      .archetype-check--on {
        border-color: var(--_admin-accent);
        background: color-mix(in srgb, var(--_admin-accent) 15%, transparent);
        color: var(--_admin-accent);
      }

      .archetype-icon {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        width: 18px;
        text-align: center;
      }

      .archetype-label {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        font-weight: var(--font-bold);
      }

      .archetype-sig {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin-left: auto;
      }

      /* ── Status Badge ── */

      .sim-card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--space-3);
        padding-top: var(--space-2);
        border-top: 1px solid var(--color-border);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-brutalist);
        font-size: 10px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        padding: 2px var(--space-2);
      }

      .badge--off {
        color: var(--color-text-muted);
        background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-text-muted) 15%, transparent);
      }

      .badge--supplement {
        color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
      }

      .badge--override {
        color: var(--_admin-accent);
        background: color-mix(in srgb, var(--_admin-accent) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_admin-accent) 25%, transparent);
      }

      .save-btn {
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
          background 0.15s ease,
          opacity 0.15s ease;
      }

      .save-btn:hover {
        background: color-mix(in srgb, var(--_admin-accent) 25%, transparent);
      }

      .save-btn:disabled {
        opacity: 0.4;
        cursor: default;
      }

      @media (max-width: 768px) {
        .sim-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _simulations: SimulationRow[] = [];
  @state() private _loading = true;
  @state() private _savingId: string | null = null;
  @state() private _filter = '';
  @state() private _dirty = new Set<string>();

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this._loading = true;

    // Single bulk call: all simulations + their override configs
    const result = await adminApi.listDungeonOverrides();
    if (result.success && result.data) {
      this._simulations = result.data.map(s => ({
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

  private _setMode(simId: string, mode: OverrideMode): void {
    this._simulations = this._simulations.map(s => {
      if (s.id !== simId) return s;
      const archetypes = mode === 'off' ? [] : s.archetypes;
      return { ...s, mode, archetypes };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private _toggleArchetype(simId: string, archetype: string): void {
    this._simulations = this._simulations.map(s => {
      if (s.id !== simId) return s;
      const has = s.archetypes.includes(archetype);
      const archetypes = has
        ? s.archetypes.filter(a => a !== archetype)
        : [...s.archetypes, archetype];
      return { ...s, archetypes };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private _selectAll(simId: string): void {
    this._simulations = this._simulations.map(s => {
      if (s.id !== simId) return s;
      return { ...s, archetypes: ARCHETYPES.map(a => a.id) };
    });
    this._dirty.add(simId);
    this.requestUpdate();
  }

  private async _save(simId: string): Promise<void> {
    if (this._savingId) return;
    this._savingId = simId;

    const sim = this._simulations.find(s => s.id === simId);
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

  private get _filtered(): SimulationRow[] {
    if (!this._filter) return this._simulations;
    const q = this._filter.toLowerCase();
    return this._simulations.filter(
      s => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading dungeon configuration...')}</div>`;
    }

    const filtered = this._filtered;

    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Dungeon Override')}</h2>
        </div>
        <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: 0 0 var(--space-4) 0;">
          ${msg('Control which dungeon archetypes are available per simulation, independent of Substrate Resonance.')}
        </p>
      </div>

      <div class="filter-bar">
        <input
          class="filter-bar__input"
          type="text"
          placeholder=${msg('Filter simulations...')}
          .value=${this._filter}
          @input=${(e: InputEvent) => { this._filter = (e.target as HTMLInputElement).value; }}
        />
        <span class="filter-bar__count">${filtered.length} / ${this._simulations.length}</span>
      </div>

      <div class="sim-grid">
        ${filtered.map(sim => this._renderSimCard(sim))}
      </div>
    `;
  }

  private _renderSimCard(sim: SimulationRow) {
    const isActive = sim.mode !== 'off';
    const isDirty = this._dirty.has(sim.id);
    const isSaving = this._savingId === sim.id;

    return html`
      <div class="sim-card ${isActive ? 'sim-card--active' : ''}">
        <div class="sim-card__header">
          <div>
            <h3 class="sim-card__name">${sim.name}</h3>
            <p class="sim-card__slug">${sim.slug}</p>
          </div>
          <span class="badge badge--${sim.mode}">
            ${sim.mode === 'off' ? msg('Resonance Only') : sim.mode === 'supplement' ? msg('Supplement') : msg('Override')}
          </span>
        </div>

        <!-- Mode selector -->
        <div class="mode-selector">
          <button
            class="mode-btn ${sim.mode === 'off' ? 'mode-btn--active' : ''}"
            @click=${() => this._setMode(sim.id, 'off')}
          >${msg('Off')}</button>
          <button
            class="mode-btn ${sim.mode === 'supplement' ? 'mode-btn--active' : ''}"
            @click=${() => this._setMode(sim.id, 'supplement')}
            title=${msg('Admin archetypes added alongside resonance results')}
          >${msg('Supplement')}</button>
          <button
            class="mode-btn ${sim.mode === 'override' ? 'mode-btn--active' : ''}"
            @click=${() => this._setMode(sim.id, 'override')}
            title=${msg('Only admin archetypes available, resonance bypassed')}
          >${msg('Override')}</button>
        </div>

        <!-- Archetype checkboxes -->
        <div class="archetype-list">
          ${ARCHETYPES.map(arch => {
            const checked = sim.archetypes.includes(arch.id);
            const disabled = sim.mode === 'off';
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
          ${sim.mode !== 'off' ? html`
            <button
              class="mode-btn"
              style="flex: 0; white-space: nowrap;"
              @click=${() => this._selectAll(sim.id)}
            >${msg('Select All')}</button>
          ` : html`<span></span>`}

          ${isDirty ? html`
            <button
              class="save-btn"
              ?disabled=${isSaving}
              @click=${() => this._save(sim.id)}
            >${isSaving ? msg('Saving...') : msg('Save')}</button>
          ` : nothing}
        </div>
      </div>
    `;
  }
}
