/**
 * Dungeon Simulation Picker — modal for selecting which simulation to enter
 * a dungeon archetype in (multi-sim users only).
 *
 * Pattern: AgentSelector.ts / EventPicker.ts (BaseModal extension with async data).
 *
 * Lifecycle:
 *   open → read appState.simulations → fetch getAvailable() per sim →
 *   display list with availability status → emit 'sim-selected' on click
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import { dungeonApi } from '../../services/api/index.js';
import { ARCHETYPE_BY_SLUG, type AvailableDungeonResponse } from '../../types/dungeon.js';
import type { Simulation } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { buttonStyles } from '../shared/button-styles.js';
import '../shared/BaseModal.js';

// ── Per-simulation availability state ────────────────────────────────────────

type SimStatus = 'loading' | 'available' | 'unavailable';

interface SimAvailability {
  simulation: Simulation;
  status: SimStatus;
  reason?: string;
  dungeonData?: AvailableDungeonResponse;
}

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-sim-picker')
export class VelgDungeonSimPicker extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        --_accent: var(--color-primary);
      }

      .sim-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .sim-card {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      }

      .sim-card--available {
        cursor: pointer;
      }

      .sim-card--available:hover {
        border-color: var(--color-success);
        box-shadow: 0 0 12px var(--color-success-glow);
      }

      .sim-card--available:focus-visible {
        outline: 2px solid var(--color-success);
        outline-offset: 2px;
      }

      .sim-card--unavailable {
        opacity: 0.6;
      }

      .sim-card--loading {
        opacity: 0.5;
      }

      .sim-card__indicator {
        flex-shrink: 0;
        width: 12px;
        height: 12px;
        border-radius: var(--border-radius-full);
      }

      .sim-card__indicator--available {
        background: var(--color-success);
      }

      .sim-card__indicator--loading {
        background: var(--color-text-muted);
        animation: pulse-indicator 1.5s ease-in-out infinite;
      }

      .sim-card__indicator--unavailable {
        background: transparent;
        border: 2px solid var(--color-text-muted);
      }

      .sim-card__body {
        flex: 1;
        min-width: 0;
      }

      .sim-card__name {
        font-family: var(--font-brutalist);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sim-card__meta {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin-top: var(--space-1);
      }

      .sim-card__status {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      @keyframes pulse-indicator {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .sim-card__indicator--loading {
          animation: none;
          opacity: 0.6;
        }
      }

      @media (max-width: 640px) {
        .sim-card {
          padding: var(--space-3);
          gap: var(--space-3);
        }
      }
    `,
  ];

  @property({ type: Boolean }) open = false;

  /** Detail-page slug: "overthrow", "shadow", etc. */
  @property({ type: String }) archetype = '';

  @state() private _sims: SimAvailability[] = [];

  // ── Lifecycle ────────────────────────────────────────────────────────────

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open) {
      this._loadAvailability();
    }
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  private async _loadAvailability(): Promise<void> {
    const simulations = appState.simulations.value;
    const canonicalName = ARCHETYPE_BY_SLUG[this.archetype];

    // Initialize all as loading
    this._sims = simulations.map((simulation) => ({
      simulation,
      status: 'loading' as const,
    }));

    // Fetch availability per simulation concurrently (N is typically 1-3)
    await Promise.allSettled(
      simulations.map(async (simulation, index) => {
        try {
          const res = await dungeonApi.getAvailable(simulation.id);
          if (!res.success || !res.data) {
            this._updateSim(index, {
              status: 'unavailable',
              reason: msg('Failed to check availability'),
            });
            return;
          }

          // Match by canonical archetype name
          const match = canonicalName
            ? res.data.find((d) => d.archetype === canonicalName)
            : undefined;

          if (!match) {
            this._updateSim(index, {
              status: 'unavailable',
              reason: msg('No matching resonance detected'),
            });
          } else if (!match.available) {
            this._updateSim(index, {
              status: 'unavailable',
              reason: msg('Cooldown active or run in progress'),
              dungeonData: match,
            });
          } else {
            this._updateSim(index, {
              status: 'available',
              dungeonData: match,
            });
          }
        } catch {
          this._updateSim(index, {
            status: 'unavailable',
            reason: msg('Connection error'),
          });
        }
      }),
    );
  }

  private _updateSim(index: number, update: Partial<SimAvailability>): void {
    const updated = [...this._sims];
    updated[index] = { ...updated[index], ...update };
    this._sims = updated;
  }

  // ── Event Handlers ───────────────────────────────────────────────────────

  private _handleSimClick(sim: SimAvailability): void {
    if (sim.status !== 'available') return;

    this.dispatchEvent(
      new CustomEvent('sim-selected', {
        bubbles: true,
        composed: true,
        detail: {
          simulationId: sim.simulation.id,
          simulationSlug: sim.simulation.slug ?? sim.simulation.id,
        },
      }),
    );
  }

  private _handleKeyDown(e: KeyboardEvent, sim: SimAvailability): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleSimClick(sim);
    }
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  protected render() {
    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${msg('Select Simulation')}</span>

        <div class="sim-list" role="listbox" aria-label=${msg('Available simulations')}>
          ${
            this._sims.length > 0
              ? this._sims.map((sim) => this._renderSimCard(sim))
              : html`<p style="color:var(--color-text-muted);font-family:var(--font-mono);font-size:var(--text-sm)">
                ${msg('No simulations found.')}
              </p>`
          }
        </div>
      </velg-base-modal>
    `;
  }

  private _renderSimCard(sim: SimAvailability) {
    const isAvailable = sim.status === 'available';

    return html`
      <div
        class="sim-card sim-card--${sim.status}"
        role="option"
        tabindex=${isAvailable ? 0 : -1}
        aria-disabled=${!isAvailable}
        aria-selected="false"
        @click=${() => this._handleSimClick(sim)}
        @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, sim)}
      >
        <div class="sim-card__indicator sim-card__indicator--${sim.status}"
             aria-hidden="true"></div>

        <div class="sim-card__body">
          <div class="sim-card__name">${t(sim.simulation, 'name')}</div>
          ${this._renderMeta(sim)}
        </div>

        ${this._renderTrailing(sim)}
      </div>
    `;
  }

  private _renderMeta(sim: SimAvailability) {
    switch (sim.status) {
      case 'loading':
        return html`<div class="sim-card__meta">${msg('Checking availability...')}</div>`;
      case 'available':
        return html`<div class="sim-card__meta">
          ${msg('Magnitude')}: ${sim.dungeonData?.effective_magnitude.toFixed(1)} \u00b7
          ${msg('Difficulty')}: ${sim.dungeonData?.suggested_difficulty}
        </div>`;
      case 'unavailable':
        return html`<div class="sim-card__meta">${sim.reason}</div>`;
      default:
        return nothing;
    }
  }

  private _renderTrailing(sim: SimAvailability) {
    if (sim.status === 'available') {
      return html`
        <span class="btn btn--primary btn--sm">
          ${icons.dungeonDepth(14)} ${msg('Enter')}
        </span>
      `;
    }

    if (sim.status === 'loading') {
      return html`<span class="sim-card__status">\u25CC</span>`;
    }

    return html`<span class="sim-card__status">\u2013</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-sim-picker': VelgDungeonSimPicker;
  }
}
