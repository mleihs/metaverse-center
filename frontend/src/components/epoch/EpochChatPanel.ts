/**
 * EpochChatPanel — tactical comms interface for epoch player-to-player chat.
 *
 * Dual-channel: "ALL CHANNELS" (epoch-wide public diplomacy) and "TEAM FREQ"
 * (alliance-only encrypted comms). Messages are directional — own transmissions
 * push right with amber tint, incoming intel aligns left.
 *
 * Phase 4 migration: consumes shared ChatFeed + ChatComposer core components.
 * EpochChatMessage → ChatMessage mapping with Participant extraction.
 * SignalWatcher eliminates manual effect() subscriptions.
 *
 * REST catch-up on mount, Realtime Broadcast for live messages.
 * Dark military HUD aesthetic matching the Epoch Command Center.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochChatApi } from '../../services/api/EpochChatApiService.js';
import type { Participant } from '../../services/chat/chat-types.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import type { ChatMessage, EpochChatMessage } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../chat/core/ChatFeed.js';
import '../chat/core/ChatComposer.js';

type ChatChannel = 'epoch' | 'team';

/** Max characters for epoch chat messages. */
const EPOCH_CHAR_LIMIT = 2000;
const EPOCH_CHAR_WARN = 1800;

@localized()
@customElement('velg-epoch-chat-panel')
export class VelgEpochChatPanel extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      max-height: calc(100vh - 300px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
    }

    /* ── Channel selector (frequency toggle) ── */
    .channels {
      display: flex;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
      flex-shrink: 0;
    }

    .channel-tab {
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1, 4px);
    }

    .channel-tab:hover {
      color: var(--color-text-tertiary);
      background: color-mix(in srgb, var(--color-text-primary) 2%, transparent);
    }

    .channel-tab--active {
      color: var(--color-warning);
      border-bottom-color: var(--color-warning);
      text-shadow: 0 0 8px color-mix(in srgb, var(--color-warning) 15%, transparent);
    }

    .unread-pip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--color-warning);
      color: var(--color-surface-sunken);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0;
    }

    /* ── Feed wrapper ── */
    .feed-wrapper {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    /* ── Disabled overlay ── */
    .disabled-notice {
      padding: var(--space-3, 12px);
      text-align: center;
      font-size: 10px;
      letter-spacing: 2px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      flex-shrink: 0;
    }
  `;

  @property() epochId = '';
  @property() mySimulationId = '';
  @property() myTeamId = '';
  @property() epochStatus = '';

  @state() private _activeChannel: ChatChannel = 'epoch';
  @state() private _sending = false;
  @state() private _hasMoreEpoch = false;
  @state() private _hasMoreTeam = false;
  @state() private _loadingMore = false;

  // Memoization caches — avoid re-creating arrays on every render
  private _cachedRawRef: EpochChatMessage[] = [];
  private _cachedMessages: ChatMessage[] = [];
  private _cachedParticipants: Participant[] = [];

  // ── Lifecycle ─────────────────────────────────────────

  async connectedCallback() {
    super.connectedCallback();
    // REST catch-up (SignalWatcher handles Realtime signal reactivity)
    await this._loadHistory('epoch');
    if (this.myTeamId) {
      await this._loadHistory('team');
    }
  }

  // ── Data mapping ──────────────────────────────────────

  /** Map EpochChatMessage[] to ChatMessage[] for ChatFeed consumption. */
  private _mapMessages(msgs: EpochChatMessage[]): ChatMessage[] {
    return msgs.map(
      (m): ChatMessage => ({
        id: m.id,
        conversation_id: m.epoch_id,
        sender_role:
          m.sender_simulation_id === this.mySimulationId
            ? ('user' as const)
            : ('assistant' as const),
        content: m.content,
        created_at: m.created_at,
        agent_id: m.sender_simulation_id,
      }),
    );
  }

  /** Extract unique Participant[] from message senders for ChatFeed lookup. */
  private _extractParticipants(msgs: EpochChatMessage[]): Participant[] {
    const seen = new Map<string, Participant>();
    for (const m of msgs) {
      if (!seen.has(m.sender_simulation_id)) {
        seen.set(m.sender_simulation_id, {
          id: m.sender_simulation_id,
          name: m.sender_name ?? msg('Unknown'),
          role: m.sender_type === 'bot' ? 'system' : 'player',
        });
      }
    }
    return [...seen.values()];
  }

  // ── REST operations ───────────────────────────────────

  private async _loadHistory(channel: ChatChannel) {
    const result =
      channel === 'team' && this.myTeamId
        ? await epochChatApi.listTeamMessages(this.epochId, this.myTeamId, { limit: 50 })
        : await epochChatApi.listMessages(this.epochId, { limit: 50 });

    if (result.success && result.data) {
      const messages = result.data;
      const total = (result.meta as { total?: number } | undefined)?.total ?? 0;
      if (channel === 'epoch') {
        realtimeService.epochMessages.value = messages;
        this._hasMoreEpoch = messages.length < total;
      } else {
        realtimeService.teamMessages.value = messages;
        this._hasMoreTeam = messages.length < total;
      }
    }
  }

  private async _loadOlder() {
    const rawMsgs =
      this._activeChannel === 'epoch'
        ? realtimeService.epochMessages.value
        : realtimeService.teamMessages.value;
    if (rawMsgs.length === 0) return;

    this._loadingMore = true;
    const oldestTime = rawMsgs[0]?.created_at;
    const result =
      this._activeChannel === 'team' && this.myTeamId
        ? await epochChatApi.listTeamMessages(this.epochId, this.myTeamId, {
            limit: 50,
            before: oldestTime,
          })
        : await epochChatApi.listMessages(this.epochId, { limit: 50, before: oldestTime });

    if (result.success && result.data) {
      const older = result.data;
      const total = (result.meta as { total?: number } | undefined)?.total ?? 0;
      if (this._activeChannel === 'epoch') {
        realtimeService.epochMessages.value = [...older, ...realtimeService.epochMessages.value];
        this._hasMoreEpoch = older.length >= 50 || rawMsgs.length + older.length < total;
      } else {
        realtimeService.teamMessages.value = [...older, ...realtimeService.teamMessages.value];
        this._hasMoreTeam = older.length >= 50 || rawMsgs.length + older.length < total;
      }
    }
    this._loadingMore = false;
  }

  private async _handleSend(e: CustomEvent<{ content: string }>) {
    const content = e.detail.content;
    if (!content || this._sending) return;

    this._sending = true;
    const result = await epochChatApi.sendMessage(this.epochId, {
      content,
      channel_type: this._activeChannel,
      simulation_id: this.mySimulationId,
      team_id: this._activeChannel === 'team' ? this.myTeamId : undefined,
    });

    if (result.success && result.data) {
      // Optimistic: inject into realtime signal immediately
      // (Realtime broadcast may arrive later and will be deduplicated by id)
      const sent = result.data;
      if (this._activeChannel === 'team') {
        const msgs = realtimeService.teamMessages.value;
        if (!msgs.some((m) => m.id === sent.id)) {
          realtimeService.teamMessages.value = [...msgs, sent];
        }
      } else {
        const msgs = realtimeService.epochMessages.value;
        if (!msgs.some((m) => m.id === sent.id)) {
          realtimeService.epochMessages.value = [...msgs, sent];
        }
      }
    } else if (!result.success) {
      VelgToast.error(msg('Failed to send message.'));
    }
    this._sending = false;
  }

  // ── UI helpers ────────────────────────────────────────

  private _switchChannel(ch: ChatChannel) {
    this._activeChannel = ch;
    realtimeService.resetUnreadCount(ch);
  }

  private _isActive(): boolean {
    return !['completed', 'cancelled'].includes(this.epochStatus);
  }

  // ── Render ────────────────────────────────────────────

  protected render() {
    // Read signals directly — SignalWatcher triggers re-render on change
    const rawMessages =
      this._activeChannel === 'epoch'
        ? realtimeService.epochMessages.value
        : realtimeService.teamMessages.value;
    const hasMore = this._activeChannel === 'epoch' ? this._hasMoreEpoch : this._hasMoreTeam;
    const canSend = this._isActive() && !!this.mySimulationId;
    const unreadEpoch = realtimeService.unreadEpochCount.value;
    const unreadTeam = realtimeService.unreadTeamCount.value;

    // Memoized mapping — only re-compute when signal ref changes
    if (rawMessages !== this._cachedRawRef) {
      this._cachedRawRef = rawMessages;
      this._cachedMessages = this._mapMessages(rawMessages);
      this._cachedParticipants = this._extractParticipants(rawMessages);
    }
    const messages = this._cachedMessages;
    const participants = this._cachedParticipants;

    const placeholder =
      this._activeChannel === 'team'
        ? msg('Encrypted team channel...')
        : msg('Broadcast to all players...');

    return html`
      <!-- Channel tabs -->
      <div class="channels">
        <button
          class="channel-tab ${this._activeChannel === 'epoch' ? 'channel-tab--active' : ''}"
          @click=${() => this._switchChannel('epoch')}
        >
          ${msg('All Channels')}
          ${
            unreadEpoch > 0 && this._activeChannel !== 'epoch'
              ? html`<span class="unread-pip">${unreadEpoch}</span>`
              : nothing
          }
        </button>
        ${
          this.myTeamId
            ? html`
              <button
                class="channel-tab ${this._activeChannel === 'team' ? 'channel-tab--active' : ''}"
                @click=${() => this._switchChannel('team')}
              >
                ${msg('Team Freq')}
                ${
                  unreadTeam > 0 && this._activeChannel !== 'team'
                    ? html`<span class="unread-pip">${unreadTeam}</span>`
                    : nothing
                }
              </button>
            `
            : nothing
        }
      </div>

      <!-- Message feed (shared core component) -->
      <div class="feed-wrapper">
        <velg-chat-feed
          .messages=${messages}
          .participants=${participants}
          .currentUserId=${this.mySimulationId}
          .hasMore=${hasMore}
          .loading=${this._loadingMore}
          .emptyMessage=${msg('No transmissions yet')}
          @load-older=${this._loadOlder}
        ></velg-chat-feed>
      </div>

      <!-- Input or disabled notice -->
      ${
        canSend
          ? html`
            <velg-chat-composer
              .charLimit=${EPOCH_CHAR_LIMIT}
              .charWarn=${EPOCH_CHAR_WARN}
              .placeholder=${placeholder}
              ?disabled=${this._sending}
              ?sending=${this._sending}
              @send-message=${this._handleSend}
            ></velg-chat-composer>
          `
          : html`
            <div class="disabled-notice">
              ${
                !this.mySimulationId
                  ? msg('Join the epoch to send messages')
                  : msg('Channel closed \u2013 epoch ended')
              }
            </div>
          `
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-chat-panel': VelgEpochChatPanel;
  }
}
