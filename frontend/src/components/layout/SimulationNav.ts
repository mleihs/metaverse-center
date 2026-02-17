import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';

interface NavTab {
  label: string;
  path: string;
  requireAdmin?: boolean;
}

function getTabs(): NavTab[] {
  return [
    { label: msg('Agents'), path: 'agents' },
    { label: msg('Buildings'), path: 'buildings' },
    { label: msg('Events'), path: 'events' },
    { label: msg('Chat'), path: 'chat' },
    { label: msg('Social'), path: 'social' },
    { label: msg('Locations'), path: 'locations' },
    { label: msg('Settings'), path: 'settings', requireAdmin: true },
  ];
}

@localized()
@customElement('velg-simulation-nav')
export class VelgSimulationNav extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface);
      border-bottom: var(--border-default);
    }

    .nav {
      display: flex;
      align-items: stretch;
      gap: 0;
      padding: 0 var(--space-6);
      overflow-x: auto;
    }

    .nav__tab {
      display: flex;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .nav__tab:hover {
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
    }

    .nav__tab--active {
      color: var(--color-text-primary);
      border-bottom-color: var(--color-primary);
    }
  `;

  @property({ type: String }) simulationId = '';
  @state() private _activeTab = 'agents';

  connectedCallback(): void {
    super.connectedCallback();
    this._detectActiveTab();
  }

  private _detectActiveTab(): void {
    const path = window.location.pathname;
    const tab = getTabs().find((t) => path.includes(`/${t.path}`));
    if (tab) {
      this._activeTab = tab.path;
    }
  }

  private _handleTabClick(tab: NavTab): void {
    this._activeTab = tab.path;
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: `/simulations/${this.simulationId}/${tab.path}`,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get _visibleTabs(): NavTab[] {
    return getTabs().filter((tab) => {
      if (tab.requireAdmin && !appState.canAdmin.value) return false;
      return true;
    });
  }

  protected render() {
    return html`
      <nav class="nav">
        ${this._visibleTabs.map(
          (tab) => html`
            <button
              class="nav__tab ${this._activeTab === tab.path ? 'nav__tab--active' : ''}"
              @click=${() => this._handleTabClick(tab)}
            >
              ${tab.label}
            </button>
          `,
        )}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-nav': VelgSimulationNav;
  }
}
