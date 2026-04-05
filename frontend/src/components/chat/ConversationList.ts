import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AgentBrief, ChatConversation } from '../../types/index.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import '../shared/EmptyState.js';
import '../shared/VelgAvatar.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PINNED_STORAGE_KEY = 'velg-chat-pinned';
const MAX_PINNED = 5;

type DateGroup = 'today' | 'yesterday' | 'this_week' | 'older';

interface GroupedConversations {
  pinned: ChatConversation[];
  today: ChatConversation[];
  yesterday: ChatConversation[];
  this_week: ChatConversation[];
  older: ChatConversation[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@localized()
@customElement('velg-conversation-list')
export class VelgConversationList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      --_search-bg: var(--color-surface-sunken);
      --_search-border: var(--color-border);
      --_search-focus-border: var(--color-primary);
      --_search-focus-glow: color-mix(in srgb, var(--color-primary) 20%, transparent);
      --_group-label-color: var(--color-text-muted);
      --_pin-color: var(--color-text-muted);
      --_pin-active-color: var(--color-primary);
      --_rename-bg: var(--color-surface-sunken);
      --_rename-border: var(--color-primary);
    }

    /* ── Search ───────────────────────────────────────── */

    .search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      margin: var(--space-2) var(--space-3) 0;
      background: var(--_search-bg);
      border: var(--border-width-thin) solid var(--_search-border);
      transition:
        border-color var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .search:focus-within {
      border-color: var(--_search-focus-border);
      box-shadow: 0 0 0 2px var(--_search-focus-glow);
    }

    .search__icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
    }

    .search__input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      outline: none;
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .search__input::placeholder {
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .search__clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      transition: color var(--transition-fast);
    }

    .search__clear:hover {
      color: var(--color-text-primary);
    }

    /* ── List & Groups ────────────────────────────────── */

    .list {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .group-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--_group-label-color);
      user-select: none;
    }

    .group-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border-light);
    }

    .group-label--pinned {
      color: var(--_pin-active-color);
    }

    .group-label--pinned::after {
      background: color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    /* ── Conversation Item ────────────────────────────── */

    .conversation {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-light);
      border-left: var(--border-width-heavy) solid transparent;
      cursor: pointer;
      transition:
        background var(--transition-fast),
        border-color var(--transition-fast),
        box-shadow var(--transition-fast);
      /* Staggered entrance */
      animation: conv-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
    }

    @keyframes conv-enter {
      from { opacity: 0; transform: translateY(6px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .conversation { animation-duration: 0.01ms !important; }
    }

    .conversation:hover {
      background: var(--color-surface-sunken);
      box-shadow: var(--shadow-xs);
    }

    .conversation:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
      z-index: 1;
    }

    .conversation--active {
      background: var(--color-surface-sunken);
      border-left-color: var(--color-primary);
    }

    /* Unread indicator — bold name + accent dot */
    .conversation--unread .conversation__agent-name {
      font-weight: var(--font-black);
      color: var(--color-text-primary);
    }

    .conversation__unread-dot {
      width: 8px;
      height: 8px;
      background: var(--color-primary);
      box-shadow: 0 0 6px var(--color-primary-glow, rgba(245, 158, 11, 0.4));
      flex-shrink: 0;
    }

    .conversation__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* Portrait stack for multi-agent */
    .conversation__portraits {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      flex-shrink: 0;
    }

    .conversation__portrait-overflow {
      min-width: 20px;
      height: 20px;
      padding: 0 var(--space-0-5);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: var(--font-bold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
      cursor: default;
    }

    /* Styled tooltip — replaces native title attribute */
    .conversation__portrait-overflow::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      translate: -50% 0;
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: normal;
      letter-spacing: 0.02em;
      white-space: nowrap;
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-sm);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--transition-fast);
      z-index: 10;
    }

    .conversation__portrait-overflow:hover::after {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .conversation__portrait-overflow::after {
        transition-duration: 0.01ms;
      }
    }

    .conversation__agent-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    /* ── Pin button ───────────────────────────────────── */

    .conversation__pin {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      color: var(--_pin-color);
      cursor: pointer;
      opacity: 0;
      transition:
        opacity var(--transition-fast),
        color var(--transition-fast),
        background var(--transition-fast);
      flex-shrink: 0;
    }

    .conversation:hover .conversation__pin,
    .conversation:focus-within .conversation__pin {
      opacity: 1;
    }

    .conversation__pin--active {
      opacity: 1;
      color: var(--_pin-active-color);
    }

    .conversation__pin:hover {
      color: var(--_pin-active-color);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    .conversation__pin:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .conversation__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--color-text-inverse);
      background: var(--color-primary);
      flex-shrink: 0;
    }

    .conversation__preview {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conversation__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .conversation__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .conversation__status {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-warning-bg);
      color: var(--color-warning-hover);
      border: var(--border-width-thin) solid var(--color-warning-border);
    }

    .conversation__actions {
      display: none;
      gap: var(--space-1);
    }

    .conversation:hover .conversation__actions {
      display: flex;
    }

    .conversation__action-btn {
      padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-muted);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .conversation__action-btn:hover {
      color: var(--color-text-danger);
      border-color: var(--color-danger-border);
      background: var(--color-danger-bg);
    }

    .conversation__action-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* ── Inline Rename ────────────────────────────────── */

    .rename-input {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      background: var(--_rename-bg);
      border: var(--border-width-thin) solid var(--_rename-border);
      padding: var(--space-0-5) var(--space-1);
      outline: none;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    /* ── No results ───────────────────────────────────── */

    .no-results {
      padding: var(--space-6) var(--space-4);
      text-align: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Responsive ───────────────────────────────────── */

    @media (max-width: 640px) {
      .conversation {
        padding: var(--space-3);
      }

      .conversation__agent-name {
        font-size: var(--text-base);
      }

      .conversation__preview {
        font-size: var(--text-sm);
      }

      .conversation__badge {
        min-width: 24px;
        height: 24px;
      }

      .conversation__actions {
        display: flex;
      }

      .conversation__action-btn {
        min-height: 44px;
        padding: var(--space-2) var(--space-3);
      }

      .conversation__pin {
        opacity: 1;
      }
    }
  `;

  @property({ type: Array }) conversations: ChatConversation[] = [];
  @property({ type: String }) selectedId = '';
  @property({ type: Boolean }) readonly = false;
  @property({ type: Object }) unreadCounts: Record<string, number> = {};

  @state() private _searchTerm = '';
  @state() private _pinnedIds = new Set<string>();
  @state() private _renamingId: string | null = null;
  @state() private _renameValue = '';

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    super.connectedCallback();
    this._loadPinnedIds();
  }

  // ---------------------------------------------------------------------------
  // Pinned persistence (localStorage)
  // ---------------------------------------------------------------------------

  private _loadPinnedIds(): void {
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        this._pinnedIds = new Set(ids.slice(0, MAX_PINNED));
      }
    } catch {
      // Corrupted or unavailable — start fresh
    }
  }

  private _savePinnedIds(): void {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...this._pinnedIds]));
    } catch {
      // localStorage full — non-critical
    }
  }

  private _togglePin(e: Event, conversationId: string): void {
    e.stopPropagation();
    const next = new Set(this._pinnedIds);
    if (next.has(conversationId)) {
      next.delete(conversationId);
    } else if (next.size < MAX_PINNED) {
      next.add(conversationId);
    }
    this._pinnedIds = next;
    this._savePinnedIds();
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  private _handleSearchInput(e: Event): void {
    this._searchTerm = (e.target as HTMLInputElement).value;
  }

  private _clearSearch(): void {
    this._searchTerm = '';
  }

  // ---------------------------------------------------------------------------
  // Grouping + Filtering
  // ---------------------------------------------------------------------------

  private _getDateGroup(dateStr: string | null | undefined): DateGroup {
    if (!dateStr) return 'older';
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 6 * 86400000);

    if (date >= today) return 'today';
    if (date >= yesterday) return 'yesterday';
    if (date >= weekAgo) return 'this_week';
    return 'older';
  }

  private get _groupedConversations(): GroupedConversations {
    const term = this._searchTerm.toLowerCase().trim();

    // Filter by search term
    const filtered = term
      ? this.conversations.filter((conv) => {
          const agents = this._getAgents(conv);
          const agentNames = agents.map((a) => a.name.toLowerCase()).join(' ');
          const title = (conv.title ?? '').toLowerCase();
          return agentNames.includes(term) || title.includes(term);
        })
      : this.conversations;

    const groups: GroupedConversations = {
      pinned: [],
      today: [],
      yesterday: [],
      this_week: [],
      older: [],
    };

    for (const conv of filtered) {
      if (this._pinnedIds.has(conv.id)) {
        groups.pinned.push(conv);
      } else {
        const group = this._getDateGroup(conv.last_message_at ?? conv.created_at);
        groups[group].push(conv);
      }
    }

    return groups;
  }

  // ---------------------------------------------------------------------------
  // Rename
  // ---------------------------------------------------------------------------

  private _startRename(e: Event, conversation: ChatConversation): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.readonly) return;
    this._renamingId = conversation.id;
    this._renameValue = this._getDisplayName(this._getAgents(conversation));
  }

  private _handleRenameInput(e: Event): void {
    this._renameValue = (e.target as HTMLInputElement).value;
  }

  private _handleRenameKeyDown(e: KeyboardEvent, conversation: ChatConversation): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._commitRename(conversation);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelRename();
    }
  }

  private _commitRename(conversation: ChatConversation): void {
    const newTitle = this._renameValue.trim();
    if (newTitle && newTitle !== conversation.title) {
      this.dispatchEvent(
        new CustomEvent('conversation-rename', {
          detail: { conversation, title: newTitle },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this._renamingId = null;
    this._renameValue = '';
  }

  private _cancelRename(): void {
    this._renamingId = null;
    this._renameValue = '';
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  /** Get agents from conversation (prefer agents[], fallback to single agent) */
  private _getAgents(conversation: ChatConversation): AgentBrief[] {
    if (conversation.agents && conversation.agents.length > 0) {
      return conversation.agents;
    }
    if (conversation.agent) {
      return [
        {
          id: conversation.agent.id,
          name: conversation.agent.name,
          portrait_image_url: conversation.agent.portrait_image_url,
        },
      ];
    }
    return [];
  }

  private _getDisplayName(agents: AgentBrief[]): string {
    if (agents.length === 0) return msg('Agent');
    if (agents.length === 1) return agents[0].name;
    if (agents.length === 2) return `${agents[0].name}, ${agents[1].name}`;
    return `${agents[0].name}, ${agents[1].name} +${agents.length - 2}`;
  }

  // ---------------------------------------------------------------------------
  // Event dispatchers
  // ---------------------------------------------------------------------------

  private _handleSelect(conversation: ChatConversation): void {
    this.dispatchEvent(
      new CustomEvent('conversation-select', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleArchive(e: Event, conversation: ChatConversation): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('conversation-archive', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: Event, conversation: ChatConversation): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('conversation-delete', {
        detail: conversation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Render: portrait stack
  // ---------------------------------------------------------------------------

  private _renderPortraitStack(agents: AgentBrief[]): TemplateResult {
    if (agents.length === 0) {
      return html`<velg-avatar .name=${msg('Agent')} size="sm"></velg-avatar>`;
    }

    // Single agent: standard avatar
    const primary = agents[0];
    if (agents.length === 1) {
      return html`<velg-avatar .src=${primary.portrait_image_url ?? ''} .name=${primary.name} size="sm"></velg-avatar>`;
    }

    // Multi-agent: show up to 3 avatars with gap, "+N" for remainder
    const maxVisible = 3;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    // Only show tooltip when agents are hidden behind "+N" badge
    const tooltip = overflow > 0
      ? agents.slice(maxVisible).map((a) => a.name).join(', ')
      : '';

    return html`
      <div class="conversation__portraits">
        ${visible.map(
          (agent) =>
            html`<velg-avatar .src=${agent.portrait_image_url ?? ''} .name=${agent.name} size="xs"></velg-avatar>`,
        )}
        ${overflow > 0
          ? html`<div class="conversation__portrait-overflow" data-tooltip=${tooltip}>+${overflow}</div>`
          : null}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Render: single conversation
  // ---------------------------------------------------------------------------

  private _renderConversation(conversation: ChatConversation, index: number) {
    const isActive = conversation.id === this.selectedId;
    const agents = this._getAgents(conversation);
    const displayName = this._getDisplayName(agents);
    const lastPreview = conversation.title ?? msg('No messages yet');
    const isUnread = (this.unreadCounts[conversation.id] ?? 0) > 0;
    const isPinned = this._pinnedIds.has(conversation.id);
    const isRenaming = this._renamingId === conversation.id;

    return html`
      <div
        class="conversation ${isActive ? 'conversation--active' : ''} ${isUnread ? 'conversation--unread' : ''}"
        role="option"
        tabindex="0"
        aria-selected=${isActive ? 'true' : 'false'}
        style="--i: ${index}"
        @click=${() => this._handleSelect(conversation)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleSelect(conversation);
          }
        }}
      >
        <div class="conversation__header">
          ${this._renderPortraitStack(agents)}
          ${isRenaming
            ? html`<input
                class="rename-input"
                .value=${this._renameValue}
                @input=${this._handleRenameInput}
                @keydown=${(e: KeyboardEvent) => this._handleRenameKeyDown(e, conversation)}
                @blur=${() => this._commitRename(conversation)}
                @click=${(e: Event) => e.stopPropagation()}
                ${/* Auto-focus on next microtask */ ''}
              aria-label=${msg('Rename conversation')}
              />`
            : html`<div
                class="conversation__agent-name"
                @dblclick=${(e: Event) => this._startRename(e, conversation)}
                title=${this.readonly ? displayName : msg('Double-click to rename')}
              >${displayName}</div>`}
          ${!this.readonly ? html`
            <button
              class="conversation__pin ${isPinned ? 'conversation__pin--active' : ''}"
              @click=${(e: Event) => this._togglePin(e, conversation.id)}
              aria-label=${isPinned ? msg('Unpin conversation') : msg('Pin conversation')}
              title=${isPinned ? msg('Unpin') : msg('Pin')}
            >${icons.pin(14)}</button>
          ` : null}
          ${isUnread ? html`<div class="conversation__unread-dot"></div>` : null}
          ${
            conversation.message_count > 0
              ? html`<div class="conversation__badge">${conversation.message_count}</div>`
              : null
          }
        </div>

        <div class="conversation__preview">${this._truncate(lastPreview, 60)}</div>

        <div class="conversation__footer">
          <div class="conversation__time">
            ${formatRelativeTime(conversation.last_message_at ?? conversation.created_at)}
          </div>

          ${
            conversation.status === 'archived'
              ? html`
                <div class="conversation__status">${msg('Archived')}</div>
                ${
                  !this.readonly
                    ? html`
                  <div class="conversation__actions">
                    <button
                      class="conversation__action-btn"
                      @click=${(e: Event) => this._handleDelete(e, conversation)}
                    >
                      ${msg('Delete')}
                    </button>
                  </div>
                `
                    : null
                }
              `
              : !this.readonly
                ? html`
                <div class="conversation__actions">
                  <button
                    class="conversation__action-btn"
                    @click=${(e: Event) => this._handleArchive(e, conversation)}
                  >
                    ${msg('Archive')}
                  </button>
                  <button
                    class="conversation__action-btn"
                    @click=${(e: Event) => this._handleDelete(e, conversation)}
                  >
                    ${msg('Delete')}
                  </button>
                </div>
              `
                : null
          }
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Render: group
  // ---------------------------------------------------------------------------

  private _renderGroup(
    label: string,
    conversations: ChatConversation[],
    startIndex: number,
    isPinnedGroup = false,
  ): TemplateResult | typeof nothing {
    if (conversations.length === 0) return nothing;

    return html`
      <div class="group-label ${isPinnedGroup ? 'group-label--pinned' : ''}">
        ${isPinnedGroup ? icons.pin(10) : nothing}
        ${label}
      </div>
      ${conversations.map((conv, i) => this._renderConversation(conv, startIndex + i))}
    `;
  }

  // ---------------------------------------------------------------------------
  // Render: search bar
  // ---------------------------------------------------------------------------

  private _renderSearch(): TemplateResult {
    return html`
      <div class="search">
        <span class="search__icon">${icons.search(14)}</span>
        <input
          class="search__input"
          type="text"
          placeholder=${msg('Search conversations...')}
          .value=${this._searchTerm}
          @input=${this._handleSearchInput}
          aria-label=${msg('Search conversations')}
        />
        ${this._searchTerm
          ? html`<button class="search__clear" @click=${this._clearSearch} aria-label=${msg('Clear search')}>X</button>`
          : nothing}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Render: auto-focus rename input
  // ---------------------------------------------------------------------------

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('_renamingId') && this._renamingId) {
      const input = this.renderRoot.querySelector<HTMLInputElement>('.rename-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  protected render() {
    if (this.conversations.length === 0) {
      return html`<velg-empty-state
        message=${msg('No conversations yet')}
      ></velg-empty-state>`;
    }

    const groups = this._groupedConversations;
    const totalFiltered =
      groups.pinned.length +
      groups.today.length +
      groups.yesterday.length +
      groups.this_week.length +
      groups.older.length;

    // Pre-compute start indices for staggered animation
    const startPinned = 0;
    const startToday = startPinned + groups.pinned.length;
    const startYesterday = startToday + groups.today.length;
    const startWeek = startYesterday + groups.yesterday.length;
    const startOlder = startWeek + groups.this_week.length;

    return html`
      ${this._renderSearch()}
      ${totalFiltered === 0
        ? html`<div class="no-results">${msg('No matching conversations')}</div>`
        : html`
          <div class="list" role="listbox" aria-label=${msg('Conversations')}>
            ${this._renderGroup(msg('Pinned'), groups.pinned, startPinned, true)}
            ${this._renderGroup(msg('Today'), groups.today, startToday)}
            ${this._renderGroup(msg('Yesterday'), groups.yesterday, startYesterday)}
            ${this._renderGroup(msg('This Week'), groups.this_week, startWeek)}
            ${this._renderGroup(msg('Older'), groups.older, startOlder)}
          </div>
        `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-conversation-list': VelgConversationList;
  }
}
