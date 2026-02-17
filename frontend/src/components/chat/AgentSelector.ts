import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';
import '../shared/VelgAvatar.js';

@localized()
@customElement('velg-agent-selector')
export class VelgAgentSelector extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .selector__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-2) 0;
      margin-bottom: var(--space-3);
      min-height: 32px;
    }

    .selector__chips-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .selector__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-width-thin) solid var(--color-primary);
    }

    .selector__chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: transparent;
      color: var(--color-text-inverse);
      border: none;
      cursor: pointer;
      font-size: var(--text-sm);
      line-height: 1;
      opacity: 0.8;
    }

    .selector__chip-remove:hover {
      opacity: 1;
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
    }

    .selector__item--selected {
      border-color: var(--color-primary);
      background: var(--color-primary-bg);
    }

    .selector__checkbox {
      width: 18px;
      height: 18px;
      border: var(--border-medium);
      background: var(--color-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: var(--text-sm);
      font-weight: var(--font-black);
      color: var(--color-primary);
    }

    .selector__checkbox--checked {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
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

    .selector__confirm {
      width: 100%;
      padding: var(--space-3);
      margin-top: var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-medium);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .selector__confirm:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .selector__confirm:active:not(:disabled) {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .selector__confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;
  /** 'create' for new conversation, 'add' for adding to existing */
  @property({ type: String }) mode: 'create' | 'add' = 'create';
  /** Agent IDs already in the conversation (hidden in 'add' mode) */
  @property({ type: Array }) excludeAgentIds: string[] = [];

  @state() private _agents: Agent[] = [];
  @state() private _loading = false;
  @state() private _searchQuery = '';
  @state() private _selectedIds: Set<string> = new Set();

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open')) {
      if (this.open && this._agents.length === 0) {
        this._loadAgents();
      }
      if (!this.open) {
        this._selectedIds = new Set();
        this._searchQuery = '';
      }
    }
  }

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    try {
      const response = await agentsApi.list(this.simulationId, { page_size: '100' });
      if (response.success && response.data) {
        this._agents = Array.isArray(response.data) ? response.data : [];
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load agents.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while loading agents.'));
    } finally {
      this._loading = false;
    }
  }

  private get _filteredAgents(): Agent[] {
    let agents = this._agents;

    // In 'add' mode, exclude agents already in the conversation
    if (this.mode === 'add' && this.excludeAgentIds.length > 0) {
      const excludeSet = new Set(this.excludeAgentIds);
      agents = agents.filter((a) => !excludeSet.has(a.id));
    }

    if (!this._searchQuery) return agents;
    const query = this._searchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        (agent.system?.toLowerCase().includes(query) ?? false),
    );
  }

  private _handleSearch(e: Event): void {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _toggleAgent(agent: Agent): void {
    const newSet = new Set(this._selectedIds);
    if (newSet.has(agent.id)) {
      newSet.delete(agent.id);
    } else {
      newSet.add(agent.id);
    }
    this._selectedIds = newSet;
  }

  private _removeSelected(agentId: string): void {
    const newSet = new Set(this._selectedIds);
    newSet.delete(agentId);
    this._selectedIds = newSet;
  }

  private _handleConfirm(): void {
    if (this._selectedIds.size === 0) return;

    const selectedAgents = this._agents.filter((a) => this._selectedIds.has(a.id));
    this.dispatchEvent(
      new CustomEvent('agents-selected', {
        detail: selectedAgents,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getSelectedAgentNames(): Agent[] {
    return this._agents.filter((a) => this._selectedIds.has(a.id));
  }

  private _renderChips() {
    const selected = this._getSelectedAgentNames();
    if (selected.length === 0) return null;

    return html`
      <div class="selector__chips-label">
        ${msg(str`Selected (${selected.length})`)}
      </div>
      <div class="selector__chips">
        ${selected.map(
          (agent) => html`
            <span class="selector__chip">
              ${agent.name}
              <button
                class="selector__chip-remove"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._removeSelected(agent.id);
                }}
              >
                &times;
              </button>
            </span>
          `,
        )}
      </div>
    `;
  }

  private _renderAgentItem(agent: Agent) {
    const isSelected = this._selectedIds.has(agent.id);

    return html`
      <div
        class="selector__item ${isSelected ? 'selector__item--selected' : ''}"
        @click=${() => this._toggleAgent(agent)}
      >
        <div class="selector__checkbox ${isSelected ? 'selector__checkbox--checked' : ''}">
          ${isSelected ? '\u2713' : ''}
        </div>
        <velg-avatar
          .src=${agent.portrait_image_url ?? ''}
          .name=${agent.name}
          size="sm"
        ></velg-avatar>
        <div class="selector__info">
          <div class="selector__name">${agent.name}</div>
          ${agent.system ? html`<div class="selector__system">${agent.system}</div>` : null}
        </div>
      </div>
    `;
  }

  protected render() {
    const headerText = this.mode === 'add' ? msg('Add Agents') : msg('Select Agents');
    const buttonText =
      this.mode === 'add'
        ? msg(str`Add (${this._selectedIds.size})`)
        : msg(str`Start Conversation (${this._selectedIds.size} Agents)`);

    return html`
      <velg-base-modal .open=${this.open}>
        <span slot="header">${headerText}</span>

        ${this._renderChips()}

        <input
          class="selector__search"
          type="text"
          placeholder=${msg('Search agents...')}
          .value=${this._searchQuery}
          @input=${this._handleSearch}
        />

        ${
          this._loading
            ? html`<div class="selector__loading">${msg('Loading agents...')}</div>`
            : this._filteredAgents.length === 0
              ? html`<div class="selector__empty">
                ${this._searchQuery ? msg('No agents match your search.') : msg('No agents available.')}
              </div>`
              : html`
                <div class="selector__list">
                  ${this._filteredAgents.map((agent) => this._renderAgentItem(agent))}
                </div>
              `
        }

        <button
          class="selector__confirm"
          ?disabled=${this._selectedIds.size === 0}
          @click=${this._handleConfirm}
        >
          ${buttonText}
        </button>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-selector': VelgAgentSelector;
  }
}
