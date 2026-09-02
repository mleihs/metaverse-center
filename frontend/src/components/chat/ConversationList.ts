import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { chatLock } from '../../services/chat/ChatLockService.js';
import { captureError } from '../../services/SentryService.js';
import type { AgentBrief, ChatConversation } from '../../types/index.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { markerSelectionStyles } from '../shared/marker-styles.js';
import '../shared/EmptyState.js';
import '../shared/VelgAgentTip.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgTooltip.js';

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
export class VelgConversationList extends SignalWatcher(LitElement) {
  static styles = [
    markerSelectionStyles,
    css`
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

    /* Die EINE Kopfleiste der Liste.
     *
     * Vorher standen hier zwei uebereinander: ChatViews sidebar__header mit
     * dem Wort „Gespraeche" und einem „+ Neu", darunter das Suchfeld an einem
     * Aussenabstand. Zwei Koepfe fuer eine Spalte, und keiner davon endete auf
     * der Linie des Fensterkopfs rechts. Der Titel entfaellt ersatzlos — die
     * Gruppenlabels (Angepinnt, Heute, Gestern) sagen laengst, was die Spalte
     * ist.
     *
     * --chat-header-h kommt aus ChatView und wird durch die Schattengrenze
     * vererbt; der Rueckfallwert haelt die Komponente ausserhalb der Ansicht
     * am Leben. */
    /* Der Fuss der Liste: was verschlossen ist, wird GEZAEHLT gezeigt, nicht
       benannt. Die Zahl ist die einzige Auskunft, die hier gefahrlos steht. */
    .seal-tile {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      box-sizing: border-box;
      min-height: 44px;
      padding: var(--space-2-5) var(--space-3);
      margin-top: auto;
      text-align: left;
      background: var(--color-surface-sunken);
      border: none;
      border-top: var(--border-light);
      color: var(--color-text-muted);
      cursor: pointer;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      transition: color var(--transition-fast), background var(--transition-fast);
    }

    .seal-tile:hover {
      color: var(--color-primary);
      background: var(--color-surface-raised);
    }

    .seal-tile:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .seal-tile__icon {
      display: inline-flex;
      flex-shrink: 0;
    }

    .seal-tile__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .seal-tile__hint {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: none;
      letter-spacing: normal;
      color: var(--color-text-quiet);
    }

    @media (prefers-reduced-motion: reduce) {
      .seal-tile {
        transition: none;
      }
    }

    .list__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: calc(var(--chat-header-h, 58px) - var(--border-width-default));
      box-sizing: border-box;
      padding-inline: var(--space-3);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .list__new-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      height: 28px;
      padding-inline: var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-inverse);
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      transition:
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .list__new-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-sm);
    }

    .list__new-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .list__new-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .list__new-label {
      white-space: nowrap;
    }

    .search {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
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
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
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
      cursor: pointer;
      transition:
        background var(--transition-fast),
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

    /* Portrait stack for multi-agent. The operatives of one conversation
       overlap so the group reads as a single unit instead of a row of
       strangers: -9px on a 30px disc is enough overlap to bind them and
       enough face left to tell them apart. Later portraits paint on top,
       so the overflow chip closes the stack. */
    .conversation__portraits {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .conversation__portraits > * + * {
      margin-left: -9px;
    }

    .conversation__portrait-overflow {
      min-width: 32px;
      height: 32px;
      padding: 0 var(--space-0-5);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }


    /* Amber, weil die Marke Chrome ist und keine Weltfarbe: sie muss auch
       dann noch als „Verschluss" lesbar sein, wenn ein Simulationsthema die
       Umgebung neu einfaerbt. */
    .conversation__seal {
      display: inline-flex;
      vertical-align: -1px;
      margin-right: var(--space-1);
      color: var(--color-accent-amber);
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
      font-family: var(--font-bureau, var(--font-prose));
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
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
      color: var(--color-text-quiet);
    }

    .conversation__status {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-warning-bg);
      /* -on-tint, not -hover. Both mix toward --color-text-primary, but -hover
         only takes 20 % and lands at 2.63:1 against its own tint in the worst
         theme - measurably better and still failing. -on-tint takes 45 %,
         which is where the worst case crosses AA. */
      color: var(--color-warning-on-tint);
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
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
    }

    /* ── Responsive ───────────────────────────────────── */
    /* Mobil traegt der Knopf nur noch das Zeichen — das Wort „Neu" nimmt die
       Breite, die der Suchzeile fehlt. Das Beruehrungsziel bleibt bei 44 px,
       auch wenn der Knopf schmaler aussieht. */
    @media (max-width: 640px) {
      .list__new-label {
        display: none;
      }

      .list__new-btn {
        width: 44px;
        height: 44px;
        padding-inline: 0;
      }
    }


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
  `,
  ];

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
    } catch (err) {
      // Corrupted or unavailable — start fresh.
      captureError(err, { source: 'VelgConversationList._loadPinnedIds' });
    }
  }

  private _savePinnedIds(): void {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...this._pinnedIds]));
    } catch (err) {
      // localStorage full or unavailable.
      captureError(err, { source: 'VelgConversationList._savePinnedIds' });
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

  /** Wie viele Gespraeche gerade unter Verschluss liegen. */
  private get _lockedCount(): number {
    return this.conversations.filter((c) => c.locked).length;
  }

  private get _groupedConversations(): GroupedConversations {
    const term = this._searchTerm.toLowerCase().trim();

    /*
     * Verschlossene Gespraeche fallen VOR der Suche heraus, nicht danach.
     * Sonst faende die Suche ihre Titel — und ein Titel ist oft schon die
     * Auskunft, die verborgen bleiben soll. Ist die Sitzung freigegeben,
     * laufen sie in ihren normalen Gruppen mit, wie die Spezifikation es
     * verlangt.
     */
    const sichtbar = chatLock.unlocked.value
      ? this.conversations
      : this.conversations.filter((c) => !c.locked);

    // Filter by search term
    const filtered = term
      ? sichtbar.filter((conv) => {
          const agents = this._getAgents(conv);
          const agentNames = agents.map((a) => a.name.toLowerCase()).join(' ');
          const title = (conv.title ?? '').toLowerCase();
          return agentNames.includes(term) || title.includes(term);
        })
      : sichtbar;

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

  /**
   * Die Verschluss-Kachel am Fuss der Liste.
   *
   * Sie erscheint nur, wenn es etwas zu oeffnen GIBT — eine Kachel „0
   * Gespraeche unter Verschluss" waere eine Auskunft ueber nichts. Ist die
   * Sitzung bereits freigegeben, bietet sie stattdessen an, wieder
   * abzuschliessen.
   */
  private _renderSealTile(): TemplateResult | typeof nothing {
    const anzahl = this._lockedCount;
    if (anzahl === 0) return nothing;

    if (chatLock.unlocked.value) {
      return html`
        <button class="seal-tile seal-tile--open" @click=${() => chatLock.revoke()}>
          <span class="seal-tile__icon">${icons.lock(14)}</span>
          <span>${msg('Lock again')}</span>
        </button>
      `;
    }

    return html`
      <button class="seal-tile" @click=${this._handleReveal}>
        <span class="seal-tile__icon">${icons.lock(14)}</span>
        <span class="seal-tile__text">
          <span class="seal-tile__count">${msg('Under seal')} · ${anzahl}</span>
          <span class="seal-tile__hint">${msg('Enter password')}</span>
        </span>
      </button>
    `;
  }

  private _handleLock(e: Event, conversation: ChatConversation): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('conversation-lock-request', {
        detail: { conversation, purpose: conversation.locked ? 'unlock' : 'lock' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleReveal(): void {
    this.dispatchEvent(
      new CustomEvent('conversation-lock-request', {
        detail: { conversation: null, purpose: 'reveal' },
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

    // Multi-agent: up to 3 overlapping portraits, "+N" for the remainder
    const maxVisible = 3;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    return html`
      <div class="conversation__portraits">
        ${visible.map(
          (agent) =>
            html`<velg-avatar .src=${agent.portrait_image_url ?? ''} .name=${agent.name} size="sm"></velg-avatar>`,
        )}
        ${
          overflow > 0
            ? html`<velg-tooltip position="below">
              <div class="conversation__portrait-overflow">+${overflow}</div>
              <velg-agent-tip slot="tip" .agents=${agents.slice(maxVisible)}></velg-agent-tip>
            </velg-tooltip>`
            : null
        }
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
        class="conversation ${isActive ? 'is-selected' : ''} ${isUnread ? 'conversation--unread' : ''}"
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
          ${
            isRenaming
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
              >${
                /*
                 * Das Schloss steht NUR, wenn die Sitzung freigegeben ist —
                 * andernfalls ist die Zeile ohnehin nicht in der Liste. Ohne
                 * diese Marke saehe eine freigegebene Sperre wie ein
                 * gewoehnliches Gespraech aus, und man wuesste beim
                 * Zuschliessen nicht mehr, welche es waren.
                 */
                conversation.locked
                  ? html`<span class="conversation__seal" title=${msg('Under seal')}
                      aria-label=${msg('Under seal')}>${icons.lock(11)}</span>`
                  : nothing
              }${displayName}</div>`
          }
          ${
            !this.readonly
              ? html`
            <button
              class="conversation__pin ${isPinned ? 'conversation__pin--active' : ''}"
              @click=${(e: Event) => this._togglePin(e, conversation.id)}
              aria-label=${isPinned ? msg('Unpin conversation') : msg('Pin conversation')}
              title=${isPinned ? msg('Unpin') : msg('Pin')}
            >${icons.pin(14)}</button>
          `
              : null
          }
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
                    class="conversation__action"
                    title=${conversation.locked ? msg('Remove lock') : msg('Lock conversation')}
                    aria-label=${conversation.locked ? msg('Remove lock') : msg('Lock conversation')}
                    @click=${(e: Event) => this._handleLock(e, conversation)}
                  >
                    ${icons.lock(14)}
                  </button>
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
      <div class="list__header">
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
        ${
          this._searchTerm
            ? html`<button class="search__clear" @click=${this._clearSearch} aria-label=${msg('Clear search')}>X</button>`
            : nothing
        }
      </div>
      ${
        this.readonly
          ? nothing
          : html`
            <button
              class="list__new-btn"
              @click=${this._handleNewConversation}
              title=${msg('New conversation')}
              aria-label=${msg('New conversation')}
            >
              ${icons.plus(14)}
              <span class="list__new-label">${msg('New')}</span>
            </button>
          `
      }
      </div>
    `;
  }

  private _handleNewConversation(): void {
    this.dispatchEvent(new CustomEvent('conversation-new', { bubbles: true, composed: true }));
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
      // ⚠ Der Kopf steht AUCH hier. Vorher kehrte diese Stelle frueh zurueck,
      // und mit dem Kopf verschwaende jetzt der „+ Neu"-Knopf — genau in dem
      // Zustand, in dem er als einziger weiterhilft.
      return html`
        ${this._renderSearch()}
        <velg-empty-state message=${msg('No conversations yet')}></velg-empty-state>
        ${this._renderSealTile()}
      `;
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
      ${
        totalFiltered === 0
          ? html`<div class="no-results">${msg('No matching conversations')}</div>`
          : html`
          <div class="list" role="listbox" aria-label=${msg('Conversations')}>
            ${this._renderGroup(msg('Pinned'), groups.pinned, startPinned, true)}
            ${this._renderGroup(msg('Today'), groups.today, startToday)}
            ${this._renderGroup(msg('Yesterday'), groups.yesterday, startYesterday)}
            ${this._renderGroup(msg('This Week'), groups.this_week, startWeek)}
            ${this._renderGroup(msg('Older'), groups.older, startOlder)}
          </div>
        `
      }
      ${this._renderSealTile()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-conversation-list': VelgConversationList;
  }
}
