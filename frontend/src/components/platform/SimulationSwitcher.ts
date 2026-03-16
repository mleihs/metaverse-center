/**
 * SimulationSwitcher — Rich simulation selection panel.
 *
 * Trigger: ◆ {currentSim.name} or ◆ Select Shard
 * Panel: sections for My Worlds / Community, sim cards with theme + stats,
 * search filter, "Fracture a New Shard" CTA.
 *
 * Stores last-visited tab per sim in localStorage for quick re-entry.
 *
 * @fires navigate - Bubbles route change on sim selection
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Simulation } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

const LAST_TAB_PREFIX = 'velg-sim-tab-';

/** Theme → display color mapping for badges. */
const THEME_COLORS: Record<string, string> = {
  dystopian: '#ef4444',
  utopian: '#34d399',
  fantasy: '#a78bfa',
  scifi: '#38bdf8',
  historical: '#fbbf24',
  custom: '#f59e0b',
};

function getLastTab(simId: string): string {
  try {
    return localStorage.getItem(`${LAST_TAB_PREFIX}${simId}`) || 'agents';
  } catch {
    return 'agents';
  }
}

@localized()
@customElement('velg-simulation-switcher')
export class VelgSimulationSwitcher extends SignalWatcher(LitElement) {
  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: inline-flex;
      position: relative;
      z-index: var(--z-dropdown, 100);
    }

    /* ── Trigger ── */

    .trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1-5, 6px) var(--space-3, 12px);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.04);
      border: 1px solid rgba(245, 158, 11, 0.3);
      cursor: pointer;
      white-space: nowrap;
      max-width: 260px;
      transition:
        background 200ms cubic-bezier(0.23, 1, 0.32, 1),
        border-color 200ms cubic-bezier(0.23, 1, 0.32, 1),
        box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .trigger:hover,
    .trigger[aria-expanded='true'] {
      background: rgba(245, 158, 11, 0.08);
      border-color: #f59e0b;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);
    }

    .trigger__diamond {
      flex-shrink: 0;
      font-size: 10px;
      line-height: 1;
    }

    .trigger__name {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trigger__chevron {
      display: flex;
      flex-shrink: 0;
      transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .trigger[aria-expanded='true'] .trigger__chevron {
      transform: rotate(180deg);
    }

    /* ── Backdrop ── */

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
    }

    /* ── Panel ── */

    .panel-anchor {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding-top: 4px;
      z-index: 1;
    }

    .panel {
      width: 380px;
      max-height: 480px;
      overflow-y: auto;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-top: 2px solid #f59e0b;
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.7),
        0 0 1px rgba(245, 158, 11, 0.3);
      padding: var(--space-3, 12px);
      animation: panel-enter 200ms cubic-bezier(0.23, 1, 0.32, 1) both;

      scrollbar-width: thin;
      scrollbar-color: #333 transparent;
    }

    .panel::-webkit-scrollbar { width: 4px; }
    .panel::-webkit-scrollbar-track { background: transparent; }
    .panel::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    /* Corner brackets */
    .panel::before,
    .panel::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-color: #f59e0b;
      border-style: solid;
      pointer-events: none;
      opacity: 0.4;
    }
    .panel::before {
      top: 4px;
      left: 4px;
      border-width: 1px 0 0 1px;
    }
    .panel::after {
      bottom: 4px;
      right: 4px;
      border-width: 0 1px 1px 0;
    }

    @keyframes panel-enter {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Search ── */

    .search {
      position: relative;
      margin-bottom: var(--space-3, 12px);
    }

    .search__input {
      width: 100%;
      padding: 6px 10px 6px 28px;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: #ccc;
      background: #111;
      border: 1px solid #2a2a2a;
      outline: none;
      transition: border-color 200ms, box-shadow 200ms;
    }

    .search__input::placeholder { color: #444; }

    .search__input:focus {
      border-color: rgba(245, 158, 11, 0.5);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.1);
    }

    .search__icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: #444;
      pointer-events: none;
      display: flex;
    }

    /* ── Section headers ── */

    .section-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #555;
      margin: var(--space-2, 8px) 0 var(--space-1, 4px);
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #2a2a2a 20%, #2a2a2a 80%, transparent);
      margin: var(--space-2, 8px) 0;
    }

    /* ── Sim card ── */

    .sim-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px var(--space-2, 8px);
      align-items: center;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      cursor: pointer;
      border-left: 2px solid transparent;
      transition:
        background 120ms ease,
        border-color 120ms ease;
    }

    .sim-card:hover {
      background: rgba(245, 158, 11, 0.06);
      border-left-color: rgba(245, 158, 11, 0.3);
    }

    .sim-card--active {
      background: rgba(245, 158, 11, 0.04);
      border-left-color: #f59e0b;
    }

    .sim-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm, 14px);
      color: #ccc;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sim-card--active .sim-card__name {
      color: #f59e0b;
    }

    .sim-card__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      grid-column: 1;
    }

    .sim-card__theme {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 1px 5px;
      border: 1px solid;
      line-height: 1.4;
    }

    .sim-card__status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: #555;
    }

    .sim-card__status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #555;
    }

    .sim-card__status-dot--active { background: #34d399; }
    .sim-card__status-dot--draft { background: #fbbf24; }
    .sim-card__status-dot--paused { background: #ef4444; }

    .sim-card__stats {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: #555;
      white-space: nowrap;
      grid-row: 1 / -1;
      grid-column: 2;
      text-align: right;
    }

    /* ── CTA ── */

    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2, 8px);
      margin-top: var(--space-3, 12px);
      padding: var(--space-2, 8px);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xs, 12px);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #f59e0b;
      border: 1px dashed rgba(245, 158, 11, 0.3);
      background: transparent;
      cursor: pointer;
      width: 100%;
      transition:
        background 200ms cubic-bezier(0.23, 1, 0.32, 1),
        border-color 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .cta:hover {
      background: rgba(245, 158, 11, 0.06);
      border-color: #f59e0b;
    }

    .empty {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: #555;
      text-align: center;
      padding: var(--space-4, 16px);
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none !important; }
      .trigger, .trigger__chevron { transition: none !important; }
      .sim-card { transition: none !important; }
    }

    @media (max-width: 640px) {
      :host { display: none; }
    }
  `;

  @state() private _open = false;
  @state() private _search = '';

  private _hoverEnterTimer = 0;
  private _hoverLeaveTimer = 0;

  // ── Getters ──

  private get _currentSim(): Simulation | null {
    return appState.currentSimulation.value;
  }

  private get _allSims(): Simulation[] {
    return appState.simulations.value;
  }

  private get _userId(): string | undefined {
    return appState.user.value?.id;
  }

  private get _myWorlds(): Simulation[] {
    const uid = this._userId;
    if (!uid) return [];
    return this._filteredSims.filter((s) => s.owner_id === uid);
  }

  private get _communityWorlds(): Simulation[] {
    const uid = this._userId;
    return this._filteredSims.filter((s) => s.owner_id !== uid);
  }

  private get _filteredSims(): Simulation[] {
    if (!this._search) return this._allSims;
    const q = this._search.toLowerCase();
    return this._allSims.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.theme.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q),
    );
  }

  // ── Hover logic ──

  private _onMouseEnter = (): void => {
    clearTimeout(this._hoverLeaveTimer);
    this._hoverEnterTimer = window.setTimeout(() => {
      this._open = true;
    }, 200);
  };

  private _onMouseLeave = (): void => {
    clearTimeout(this._hoverEnterTimer);
    this._hoverLeaveTimer = window.setTimeout(() => {
      this._open = false;
    }, 150);
  };

  private _onTriggerClick = (): void => {
    clearTimeout(this._hoverEnterTimer);
    clearTimeout(this._hoverLeaveTimer);
    this._open = !this._open;
    this._search = '';
  };

  private _close = (): void => {
    this._open = false;
    this._search = '';
  };

  private _onSearchInput = (e: InputEvent): void => {
    this._search = (e.target as HTMLInputElement).value;
  };

  private _onSimClick = (sim: Simulation): void => {
    appState.setCurrentSimulation(sim);
    this._close();
    const tab = getLastTab(sim.id);
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: `/simulations/${sim.slug}/${tab}`,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _onNewShard = (): void => {
    this._close();
    if (appState.canForge.value) {
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: '/forge', bubbles: true, composed: true }),
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: '/new-simulation', bubbles: true, composed: true }),
      );
    }
  };

  disconnectedCallback(): void {
    clearTimeout(this._hoverEnterTimer);
    clearTimeout(this._hoverLeaveTimer);
    super.disconnectedCallback();
  }

  // ── Render helpers ──

  private _renderSimCard(sim: Simulation) {
    const isActive = this._currentSim?.id === sim.id;
    const themeColor = THEME_COLORS[sim.theme] ?? '#888';
    const statusClass =
      sim.status === 'active'
        ? '--active'
        : sim.status === 'draft' || sim.status === 'configuring'
          ? '--draft'
          : sim.status === 'paused'
            ? '--paused'
            : '';
    const agents = sim.agent_count ?? 0;
    const buildings = sim.building_count ?? 0;

    return html`
      <div
        class="sim-card ${isActive ? 'sim-card--active' : ''}"
        role="option"
        aria-selected=${isActive}
        @click=${() => this._onSimClick(sim)}
      >
        <span class="sim-card__name">${sim.name}</span>
        <span class="sim-card__stats">${agents}A / ${buildings}B</span>
        <div class="sim-card__meta">
          <span class="sim-card__theme" style="color:${themeColor};border-color:${themeColor}">${sim.theme}</span>
          <span class="sim-card__status">
            <span class="sim-card__status-dot sim-card__status-dot${statusClass}"></span>
            ${sim.status}
          </span>
        </div>
      </div>
    `;
  }

  protected render() {
    const sim = this._currentSim;
    const label = sim ? sim.name : msg('Select Shard');
    const showSearch = this._allSims.length > 6;

    return html`
      <div
        @mouseenter=${this._onMouseEnter}
        @mouseleave=${this._onMouseLeave}
      >
        <button
          class="trigger"
          @click=${this._onTriggerClick}
          aria-expanded=${this._open}
          aria-haspopup="listbox"
          aria-label=${msg('Simulation switcher')}
        >
          <span class="trigger__diamond" aria-hidden="true">&#9670;</span>
          <span class="trigger__name">${label}</span>
          <span class="trigger__chevron">${icons.chevronDown(10)}</span>
        </button>

        ${
          this._open
            ? html`
              <div class="backdrop" @click=${this._close}></div>
              <div class="panel-anchor">
                <div class="panel" role="listbox" aria-label=${msg('Simulations')}>
                  ${
                    showSearch
                      ? html`
                        <div class="search">
                          <span class="search__icon">${icons.magnifyingGlass(12)}</span>
                          <input
                            class="search__input"
                            type="text"
                            placeholder=${msg('Search shards...')}
                            .value=${this._search}
                            @input=${this._onSearchInput}
                            autocomplete="off"
                            spellcheck="false"
                          />
                        </div>
                      `
                      : nothing
                  }

                  ${
                    this._userId && this._myWorlds.length > 0
                      ? html`
                        <div class="section-label">${msg('My Worlds')}</div>
                        ${this._myWorlds.map((s) => this._renderSimCard(s))}
                      `
                      : nothing
                  }

                  ${
                    this._communityWorlds.length > 0
                      ? html`
                        ${this._myWorlds.length > 0 ? html`<div class="divider"></div>` : nothing}
                        <div class="section-label">${msg('Community Shards')}</div>
                        ${this._communityWorlds.map((s) => this._renderSimCard(s))}
                      `
                      : nothing
                  }

                  ${
                    this._filteredSims.length === 0
                      ? html`<div class="empty">${msg('No shards found')}</div>`
                      : nothing
                  }

                  ${
                    appState.isAuthenticated.value
                      ? html`
                        <div class="divider"></div>
                        <button class="cta" @click=${this._onNewShard}>
                          + ${msg('Fracture a New Shard')}
                        </button>
                      `
                      : nothing
                  }
                </div>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-switcher': VelgSimulationSwitcher;
  }
}
