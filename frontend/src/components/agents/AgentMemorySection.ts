import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentMemoryApi } from '../../services/api/index.js';
import type { AgentMemory } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';

import '../shared/VelgBadge.js';
import '../shared/LoadingState.js';
import '../shared/EmptyState.js';

@localized()
@customElement('velg-agent-memory-section')
export class VelgAgentMemorySection extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Section toggle headers ─────────────── */

    .mem-group {
      margin-bottom: var(--space-3);
    }

    .mem-group__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) 0;
      cursor: pointer;
      user-select: none;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      color: var(--color-text-primary);
    }

    .mem-group__header:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    .mem-group__chevron {
      display: flex;
      align-items: center;
      color: var(--color-text-muted);
      transition: transform 0.2s ease;
    }

    .mem-group__chevron--open {
      transform: rotate(90deg);
    }

    .mem-group__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .mem-group__count {
      margin-left: auto;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Timeline ───────────────────────────── */

    .timeline {
      position: relative;
      padding-left: var(--space-4);
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 3px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--color-border-light);
    }

    /* ── Memory entry ───────────────────────── */

    .mem {
      position: relative;
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-2);
      border-left: 3px solid var(--color-border);
      background: var(--color-surface-raised);
      animation: mem-enter 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--mem-delay, 0ms);
    }

    @keyframes mem-enter {
      from { opacity: 0; transform: translateX(-6px); }
    }

    /* Observation styling: factual, raw data */
    .mem--observation {
      border-left-color: var(--color-text-muted);
    }

    .mem--observation .mem__content {
      font-family: var(--font-mono, 'Courier New', monospace);
      font-size: var(--text-xs);
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    /* Reflection styling: elevated, insightful */
    .mem--reflection {
      border-left-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface-raised));
    }

    .mem--reflection .mem__content {
      font-family: var(--font-body);
      font-style: italic;
      font-size: var(--text-sm);
      line-height: 1.6;
      color: var(--color-text-primary);
    }

    /* Timeline dot */
    .mem::before {
      content: '';
      position: absolute;
      left: calc(-1 * var(--space-4) - 3px - 3px);
      top: var(--space-3);
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--color-border);
    }

    .mem--reflection::before {
      background: var(--color-primary);
    }

    /* ── Meta row ───────────────────────────── */

    .mem__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
      flex-wrap: wrap;
    }

    .mem__date {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    /* ── Importance pips ────────────────────── */

    .pips {
      display: inline-flex;
      gap: 2px;
      align-items: center;
    }

    .pip {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-border-light);
    }

    .pip--filled {
      background: var(--color-primary);
    }

    /* ── Reflect button ─────────────────────── */

    .reflect-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-default);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .reflect-btn:hover:not(:disabled) {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }

    .reflect-btn:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    .reflect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .reflect-btn:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    /* ── Load more ──────────────────────────── */

    .load-more {
      text-align: center;
      padding: var(--space-2) 0;
    }

    .load-more__btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-primary);
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
    }

    .load-more__btn:hover {
      text-decoration: underline;
    }

    .load-more__btn:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    /* ── Reduced motion ─────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .mem,
      .mem-group__chevron {
        animation: none;
        transition: none;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: String }) agentId = '';

  @state() private _memories: AgentMemory[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _reflecting = false;
  @state() private _obsOpen = true;
  @state() private _refOpen = true;
  @state() private _limit = 30;

  private get _observations(): AgentMemory[] {
    return this._memories.filter((m) => m.memory_type === 'observation');
  }

  private get _reflections(): AgentMemory[] {
    return this._memories.filter((m) => m.memory_type === 'reflection');
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (
      (changed.has('simulationId') || changed.has('agentId')) &&
      this.simulationId &&
      this.agentId
    ) {
      this._load();
    }
  }

  private async _load(): Promise<void> {
    if (!this.simulationId || !this.agentId) return;
    this._loading = true;
    try {
      const resp = await agentMemoryApi.list(this.simulationId, this.agentId, {
        limit: this._limit,
      });
      if (resp.success && resp.data) {
        this._memories = resp.data;
        this._total = resp.meta?.total ?? resp.data.length;
      }
    } catch {
      // Silent — section degrades gracefully
    } finally {
      this._loading = false;
    }
  }

  private async _loadMore(): Promise<void> {
    this._limit += 30;
    await this._load();
  }

  private async _reflect(): Promise<void> {
    if (this._reflecting) return;
    this._reflecting = true;
    try {
      await agentMemoryApi.reflect(this.simulationId, this.agentId);
      await this._load();
    } catch {
      // Silent
    } finally {
      this._reflecting = false;
    }
  }

  private _renderPips(importance: number) {
    const pips = [];
    for (let i = 1; i <= 10; i++) {
      pips.push(
        html`<span class="pip ${i <= importance ? 'pip--filled' : ''}" aria-hidden="true"></span>`,
      );
    }
    return html`<span class="pips" title="${importance}/10" aria-label="${importance} out of 10">${pips}</span>`;
  }

  private _renderEntry(mem: AgentMemory, index: number) {
    const cls = mem.memory_type === 'reflection' ? 'mem--reflection' : 'mem--observation';
    const date = new Date(mem.created_at);
    return html`
      <div class="mem ${cls}" style="--mem-delay: ${index * 40}ms">
        <div class="mem__content">${t(mem, 'content')}</div>
        <div class="mem__meta">
          ${this._renderPips(mem.importance)}
          <span class="mem__date">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    `;
  }

  private _renderGroup(label: string, entries: AgentMemory[], open: boolean, toggleFn: () => void) {
    if (entries.length === 0) return nothing;
    return html`
      <div class="mem-group">
        <button
          class="mem-group__header"
          @click=${toggleFn}
          aria-expanded=${open}
        >
          <span class="mem-group__chevron ${open ? 'mem-group__chevron--open' : ''}">
            ${icons.chevronRight(12)}
          </span>
          <span class="mem-group__label">${label}</span>
          <span class="mem-group__count">${entries.length}</span>
        </button>
        ${
          open
            ? html`
            <div class="timeline">
              ${entries.map((m, i) => this._renderEntry(m, i))}
            </div>
          `
            : nothing
        }
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading memories...')}></velg-loading-state>`;
    }

    if (this._memories.length === 0) {
      return html`<velg-empty-state message=${msg('No memories recorded yet.')}></velg-empty-state>`;
    }

    return html`
      ${this._renderGroup(msg('Reflections'), this._reflections, this._refOpen, () => {
        this._refOpen = !this._refOpen;
      })}

      ${this._renderGroup(msg('Observations'), this._observations, this._obsOpen, () => {
        this._obsOpen = !this._obsOpen;
      })}

      ${
        appState.canEdit.value
          ? html`
          <button
            class="reflect-btn"
            ?disabled=${this._reflecting}
            @click=${this._reflect}
          >
            ${icons.brain(14)}
            ${this._reflecting ? msg('Reflecting...') : msg('Trigger Reflection')}
          </button>
        `
          : nothing
      }

      ${
        this._total > this._memories.length
          ? html`
          <div class="load-more">
            <button class="load-more__btn" @click=${this._loadMore}>
              ${msg('Load more')}
            </button>
          </div>
        `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-memory-section': VelgAgentMemorySection;
  }
}
