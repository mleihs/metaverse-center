import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { themeService } from '../../services/ThemeService.js';
import { icons } from '../../utils/icons.js';

import './SimulationHeader.js';
import './SimulationNav.js';

/** Map tab path segments to localized labels. */
function getTabLabel(path: string): string {
  const labels: Record<string, () => string> = {
    lore: () => msg('Lore'),
    agents: () => msg('Agents'),
    buildings: () => msg('Buildings'),
    chronicle: () => msg('Chronicle'),
    health: () => msg('Health'),
    events: () => msg('Events'),
    chat: () => msg('Chat'),
    social: () => msg('Social'),
    locations: () => msg('Locations'),
    settings: () => msg('Settings'),
  };
  return labels[path]?.() ?? path.charAt(0).toUpperCase() + path.slice(1);
}

@localized()
@customElement('velg-simulation-shell')
export class VelgSimulationShell extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
      background-color: var(--color-surface);
      color: var(--color-text-primary);
    }

    /* Shadow DOM doesn't inherit global box-sizing reset */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .shell {
      display: grid;
      grid-template-rows: auto auto auto 1fr;
      min-height: 100%;
    }

    /* ── Breadcrumb Bar ── */

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-6);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      background: var(--color-surface-sunken);
      border-bottom: 1px solid var(--color-border);
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
    }

    .breadcrumb::-webkit-scrollbar {
      display: none;
    }

    .breadcrumb__sep {
      color: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
      user-select: none;
      flex-shrink: 0;
    }

    .breadcrumb__link {
      color: var(--color-text-muted);
      text-decoration: none;
      cursor: pointer;
      background: none;
      border: none;
      font: inherit;
      letter-spacing: inherit;
      padding: var(--space-0-5) 0;
      transition: color 0.15s ease;
      flex-shrink: 0;
    }

    .breadcrumb__link:hover {
      color: var(--color-primary);
    }

    .breadcrumb__link:focus-visible {
      outline: 1px solid var(--color-primary);
      outline-offset: 2px;
    }

    .breadcrumb__current {
      color: var(--color-text-secondary);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    /* ── Simulation Switcher ── */

    .breadcrumb__switcher {
      position: relative;
      flex-shrink: 0;
    }

    .breadcrumb__trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-muted);
      cursor: pointer;
      background: none;
      border: none;
      font: inherit;
      letter-spacing: inherit;
      padding: var(--space-0-5) var(--space-1) var(--space-0-5) 0;
      transition: color 0.2s ease;
    }

    .breadcrumb__trigger:hover {
      color: var(--color-primary);
    }

    .breadcrumb__trigger:focus-visible {
      outline: 1px solid var(--color-primary);
      outline-offset: 2px;
    }

    .breadcrumb__trigger svg {
      opacity: 0.5;
      transition:
        transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
        opacity 0.15s ease;
    }

    .breadcrumb__trigger:hover svg {
      opacity: 1;
    }

    .breadcrumb__trigger[aria-expanded="true"] svg {
      transform: rotate(180deg);
      opacity: 1;
    }

    /* ── Dropdown Panel ── */

    .breadcrumb__dropdown {
      position: fixed;
      z-index: 50;
      min-width: 220px;
      max-width: 340px;
      max-height: 300px;
      overflow-y: auto;
      background: color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, transparent);
      backdrop-filter: blur(12px) saturate(1.3);
      -webkit-backdrop-filter: blur(12px) saturate(1.3);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
      border-top: 2px solid var(--color-primary);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 1px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 color-mix(in srgb, var(--color-primary) 6%, transparent);
      padding: var(--space-1) 0;

      /* Entrance animation */
      animation: dropdown-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
      transform-origin: top left;
    }

    @keyframes dropdown-enter {
      from {
        opacity: 0;
        transform: translateY(-4px) scaleY(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
    }

    .breadcrumb__dropdown::-webkit-scrollbar {
      width: 3px;
    }

    .breadcrumb__dropdown::-webkit-scrollbar-track {
      background: transparent;
    }

    .breadcrumb__dropdown::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--color-primary) 30%, transparent);
      border-radius: 2px;
    }

    /* Firefox thin scrollbar */
    .breadcrumb__dropdown {
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--color-primary) 30%, transparent) transparent;
    }

    /* ── Dropdown Options ── */

    .breadcrumb__option {
      position: relative;
      display: block;
      width: 100%;
      padding: var(--space-2) var(--space-3) var(--space-2) var(--space-3);
      background: none;
      border: none;
      border-left: 2px solid transparent;
      font: inherit;
      letter-spacing: inherit;
      color: var(--color-text-secondary);
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition:
        background 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease,
        padding-left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

      /* Staggered entrance */
      opacity: 0;
      animation: option-enter 0.2s ease forwards;
    }

    @keyframes option-enter {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .breadcrumb__option:hover,
    .breadcrumb__option:focus-visible {
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      color: var(--color-primary);
      border-left-color: var(--color-primary);
      padding-left: var(--space-4);
    }

    .breadcrumb__option:focus-visible {
      outline: none;
    }

    .breadcrumb__option[aria-current="true"] {
      color: var(--color-primary);
      border-left-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }

    .shell__content {
      width: 100%;
      padding: var(--content-padding);
      min-width: 0;
      overflow: hidden;
      max-width: var(--container-2xl, 1400px);
      margin-inline: auto;
    }

    @media (max-width: 640px) {
      .breadcrumb {
        padding: var(--space-1-5) var(--space-4);
        font-size: 9px;
      }
    }

    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%),
          var(--color-surface);
      }
      .shell__content {
        max-width: var(--container-max, 1600px);
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: String }) view = 'lore';

  @state() private _simSwitcherOpen = false;
  @state() private _dropdownPos = { top: 0, left: 0 };
  private _focusedIndex = -1;

  private _appliedSimulationId = '';
  private _boundCloseDropdown = (e: MouseEvent) => this._onOutsideClick(e);
  private _boundKeyDown = (e: KeyboardEvent) => this._onKeyDown(e);

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    if (this.simulationId) {
      await this._applyTheme();
    }
    // Ensure simulations list is populated for the breadcrumb switcher.
    // On direct navigation / page refresh, the dashboard hasn't mounted
    // yet, so appState.simulations may be empty.
    if (appState.isAuthenticated.value && appState.simulations.value.length === 0) {
      const result = await simulationsApi.list();
      if (result.success && result.data) {
        appState.setSimulations(result.data);
      }
    }
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this._boundCloseDropdown);
    document.removeEventListener('keydown', this._boundKeyDown);
    themeService.resetTheme(this);
    this._appliedSimulationId = '';
    super.disconnectedCallback();
  }

  protected async willUpdate(changedProperties: Map<PropertyKey, unknown>): Promise<void> {
    if (
      changedProperties.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._appliedSimulationId
    ) {
      await this._applyTheme();
    }
  }

  private async _applyTheme(): Promise<void> {
    if (!this.simulationId) return;
    this._appliedSimulationId = this.simulationId;
    await themeService.applySimulationTheme(this.simulationId, this);
  }

  private _navigate(path: string, e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
  }

  /* ── Dropdown lifecycle ── */

  private _openSwitcher(): void {
    this._simSwitcherOpen = true;
    this._focusedIndex = -1;
    document.addEventListener('click', this._boundCloseDropdown);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  private _closeSwitcher(): void {
    this._simSwitcherOpen = false;
    this._focusedIndex = -1;
    document.removeEventListener('click', this._boundCloseDropdown);
    document.removeEventListener('keydown', this._boundKeyDown);
  }

  private _toggleSimSwitcher(e: Event): void {
    e.stopPropagation();
    if (this._simSwitcherOpen) {
      this._closeSwitcher();
    } else {
      // Compute dropdown position from trigger's bounding rect
      const trigger = e.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this._dropdownPos = { top: rect.bottom + 4, left: rect.left };
      this._openSwitcher();
    }
  }

  private _onOutsideClick(e: MouseEvent): void {
    if (!e.composedPath().includes(this)) {
      this._closeSwitcher();
    }
  }

  /* ── Keyboard navigation ── */

  private _onKeyDown(e: KeyboardEvent): void {
    if (!this._simSwitcherOpen) return;

    const sims = appState.simulations.value;
    const count = sims.length;
    if (!count) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this._closeSwitcher();
        // Return focus to trigger
        this.shadowRoot?.querySelector<HTMLButtonElement>('.breadcrumb__trigger')?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = (this._focusedIndex + 1) % count;
        this._focusOption();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = this._focusedIndex <= 0 ? count - 1 : this._focusedIndex - 1;
        this._focusOption();
        break;
      case 'Home':
        e.preventDefault();
        this._focusedIndex = 0;
        this._focusOption();
        break;
      case 'End':
        e.preventDefault();
        this._focusedIndex = count - 1;
        this._focusOption();
        break;
      case 'Enter':
        if (this._focusedIndex >= 0 && this._focusedIndex < count) {
          e.preventDefault();
          this._selectSimulation(sims[this._focusedIndex].slug, e);
        }
        break;
    }
  }

  private _focusOption(): void {
    requestAnimationFrame(() => {
      const options = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.breadcrumb__option');
      options?.[this._focusedIndex]?.focus();
    });
  }

  private _selectSimulation(slug: string, e: Event): void {
    this._closeSwitcher();
    this._navigate(`/simulations/${slug}/${this.view}`, e);
  }

  /* ── Render ── */

  private _renderSimSwitcher(simName: string) {
    const sims = appState.simulations.value;
    const currentId = appState.currentSimulation.value?.id;
    const hasSwitchTargets = sims.length > 1 || (sims.length === 1 && sims[0].id !== currentId);

    if (!hasSwitchTargets) {
      const slug = appState.currentSimulation.value?.slug ?? this.simulationId;
      return html`
        <button
          class="breadcrumb__link"
          @click=${(e: Event) => this._navigate(`/simulations/${slug}/lore`, e)}
        >${simName}</button>
      `;
    }

    return html`
      <div class="breadcrumb__switcher">
        <button
          class="breadcrumb__trigger"
          aria-expanded=${this._simSwitcherOpen ? 'true' : 'false'}
          aria-haspopup="listbox"
          @click=${(e: Event) => this._toggleSimSwitcher(e)}
        >
          ${simName}
          ${icons.chevronDown(10)}
        </button>
        ${this._simSwitcherOpen
          ? html`
              <div
                class="breadcrumb__dropdown"
                role="listbox"
                aria-label=${msg('Switch simulation')}
                style="top: ${this._dropdownPos.top}px; left: ${this._dropdownPos.left}px"
              >
                ${sims.map(
                  (s, i) => html`
                    <button
                      class="breadcrumb__option"
                      role="option"
                      style="animation-delay: ${i * 0.03}s"
                      aria-selected=${s.id === currentId ? 'true' : 'false'}
                      aria-current=${s.id === currentId ? 'true' : 'false'}
                      tabindex=${this._focusedIndex === i ? '0' : '-1'}
                      @click=${(e: Event) => this._selectSimulation(s.slug, e)}
                    >${s.name}</button>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderBreadcrumb() {
    const sim = appState.currentSimulation.value;
    const simName = sim?.name ?? '';
    const viewLabel = getTabLabel(this.view);
    const sep = html`<span class="breadcrumb__sep">//</span>`;

    return html`
      <nav class="breadcrumb" aria-label=${msg('Breadcrumb')}>
        <button
          class="breadcrumb__link"
          @click=${(e: Event) => this._navigate('/dashboard', e)}
        >${msg('Dashboard')}</button>
        ${sep}
        ${simName
          ? html`
              ${this._renderSimSwitcher(simName)}
              ${sep}
            `
          : ''}
        <span class="breadcrumb__current">${viewLabel}</span>
      </nav>
    `;
  }

  protected render() {
    return html`
      <div class="shell">
        <velg-simulation-header .simulationId=${this.simulationId}></velg-simulation-header>
        ${this._renderBreadcrumb()}
        <velg-simulation-nav .simulationId=${this.simulationId}></velg-simulation-nav>
        <div class="shell__content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-shell': VelgSimulationShell;
  }
}
