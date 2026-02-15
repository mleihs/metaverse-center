import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent, PaginatedResponse } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

@customElement('velg-agent-selector')
export class VelgAgentSelector extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .selector__search {
      width: 100%;
      padding: var(--space-2-5) var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      margin-bottom: var(--space-4);
    }

    .selector__search:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .selector__search::placeholder {
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .selector__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-height: 400px;
      overflow-y: auto;
    }

    .selector__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border: var(--border-light);
      background: var(--color-surface-raised);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .selector__item:hover {
      border-color: var(--color-border);
      background: var(--color-surface-sunken);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-sm);
    }

    .selector__item:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .selector__portrait {
      width: 40px;
      height: 40px;
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-sunken);
      object-fit: cover;
      flex-shrink: 0;
    }

    .selector__portrait-placeholder {
      width: 40px;
      height: 40px;
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-sunken);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .selector__info {
      flex: 1;
      min-width: 0;
    }

    .selector__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selector__system {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selector__loading,
    .selector__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _agents: Agent[] = [];
  @state() private _loading = false;
  @state() private _searchQuery = '';

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open && this._agents.length === 0) {
      this._loadAgents();
    }
  }

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    try {
      const response = await agentsApi.list(this.simulationId, { page_size: '100' });
      if (response.success && response.data) {
        const paginated = response.data as PaginatedResponse<Agent>;
        this._agents = paginated.data ?? [];
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to load agents.');
      }
    } catch {
      VelgToast.error('An unexpected error occurred while loading agents.');
    } finally {
      this._loading = false;
    }
  }

  private get _filteredAgents(): Agent[] {
    if (!this._searchQuery) return this._agents;
    const query = this._searchQuery.toLowerCase();
    return this._agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        (agent.system?.toLowerCase().includes(query) ?? false),
    );
  }

  private _handleSearch(e: Event): void {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _handleAgentClick(agent: Agent): void {
    this.dispatchEvent(
      new CustomEvent('agent-selected', {
        detail: agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getInitials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  private _renderAgentItem(agent: Agent) {
    return html`
      <div class="selector__item" @click=${() => this._handleAgentClick(agent)}>
        ${
          agent.portrait_image_url
            ? html`<img
                class="selector__portrait"
                src=${agent.portrait_image_url}
                alt=${agent.name}
              />`
            : html`<div class="selector__portrait-placeholder">
                ${this._getInitials(agent.name)}
              </div>`
        }
        <div class="selector__info">
          <div class="selector__name">${agent.name}</div>
          ${agent.system ? html`<div class="selector__system">${agent.system}</div>` : null}
        </div>
      </div>
    `;
  }

  protected render() {
    return html`
      <velg-base-modal .open=${this.open}>
        <span slot="header">Select Agent</span>

        <input
          class="selector__search"
          type="text"
          placeholder="Search agents..."
          .value=${this._searchQuery}
          @input=${this._handleSearch}
        />

        ${
          this._loading
            ? html`<div class="selector__loading">Loading agents...</div>`
            : this._filteredAgents.length === 0
              ? html`<div class="selector__empty">
                  ${this._searchQuery ? 'No agents match your search.' : 'No agents available.'}
                </div>`
              : html`
                <div class="selector__list">
                  ${this._filteredAgents.map((agent) => this._renderAgentItem(agent))}
                </div>
              `
        }
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-selector': VelgAgentSelector;
  }
}
