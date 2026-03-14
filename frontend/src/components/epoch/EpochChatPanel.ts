/**
 * EpochChatPanel — tactical comms interface for epoch player-to-player chat.
 *
 * Dual-channel: "ALL CHANNELS" (epoch-wide public diplomacy) and "TEAM FREQ"
 * (alliance-only encrypted comms). Messages are directional — own transmissions
 * push right with amber tint, incoming intel aligns left in gray.
 *
 * REST catch-up on mount, Realtime Broadcast for live messages.
 * Dark military HUD aesthetic matching the Epoch Command Center.
 */

import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochChatApi } from '../../services/api/EpochChatApiService.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import type { EpochChatMessage } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

type ChatChannel = 'epoch' | 'team';

@localized()
@customElement('velg-epoch-chat-panel')
export class VelgEpochChatPanel extends LitElement {
  static styles = css`
    :host {
      --amber: var(--color-warning);
      --amber-dim: var(--color-warning-hover);
      --amber-glow: color-mix(in srgb, var(--color-warning) 15%, transparent);
      --amber-tint: color-mix(in srgb, var(--color-warning) 8%, transparent);
      --amber-border: color-mix(in srgb, var(--color-warning) 20%, transparent);
      --green-signal: var(--color-success);
      --panel-bg: var(--color-gray-950);
      --surface: var(--color-gray-900);
      --surface-raised: var(--color-gray-800);
      --border-dim: var(--color-gray-700);
      --text-bright: var(--color-gray-100);
      --text-mid: var(--color-gray-300);
      --text-dim: var(--color-gray-400);
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      max-height: calc(100vh - 300px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
    }

    /* ── Channel selector ── */
    .channels {
      display: flex;
      border-bottom: 1px solid var(--border-dim);
      background: var(--panel-bg);
      flex-shrink: 0;
    }

    .channel-tab {
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-dim);
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
      color: var(--text-mid);
      background: rgba(255 255 255 / 0.02);
    }

    .channel-tab--active {
      color: var(--amber);
      border-bottom-color: var(--amber);
      text-shadow: 0 0 8px var(--amber-glow);
    }

    .unread-pip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--amber);
      color: var(--panel-bg);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0;
    }

    /* ── Message feed ── */
    .feed {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-3, 12px);
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
      background: var(--panel-bg);
      position: relative;
      scrollbar-width: thin;
      scrollbar-color: var(--border-dim) transparent;
    }

    /* scan-line texture */
    .feed::before {
      content: '';
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      height: 0;
      pointer-events: none;
      z-index: 1;
    }

    .feed-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .load-more {
      align-self: center;
      padding: var(--space-1, 4px) var(--space-3, 12px);
      background: transparent;
      border: 1px solid var(--border-dim);
      color: var(--text-dim);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
    }

    .load-more:hover {
      border-color: var(--amber-dim);
      color: var(--amber);
    }

    /* ── Message bubble ── */
    .msg {
      display: flex;
      flex-direction: column;
      max-width: 80%;
      animation: msg-in 0.2s var(--ease-dramatic, ease-out);
    }

    @keyframes msg-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg--self {
      align-self: flex-end;
    }

    .msg--other {
      align-self: flex-start;
    }

    .msg__header {
      display: flex;
      align-items: baseline;
      gap: var(--space-1, 4px);
      margin-bottom: 2px;
    }

    .msg--self .msg__header {
      flex-direction: row-reverse;
    }

    .msg__sender {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .msg--self .msg__sender {
      color: var(--amber);
    }

    .msg--other .msg__sender {
      color: var(--green-signal);
    }

    .msg__time {
      font-size: 9px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
    }

    .msg__body {
      padding: var(--space-2, 8px) var(--space-3, 12px);
      font-size: var(--text-sm, 13px);
      line-height: 1.5;
      word-break: break-word;
    }

    .msg--self .msg__body {
      background: var(--amber-tint);
      border: 1px solid var(--amber-border);
      border-right: 3px solid var(--amber);
      color: var(--text-bright);
    }

    .msg--other .msg__body {
      background: var(--surface);
      border: 1px solid var(--border-dim);
      border-left: 3px solid var(--border-dim);
      color: var(--text-mid);
    }

    /* ── Bot message styling ── */
    .msg--bot .msg__sender {
      color: var(--color-warning);
    }

    .msg--bot .msg__body {
      background: color-mix(in srgb, var(--color-warning) 5%, var(--surface));
      border: 1px solid color-mix(in srgb, var(--color-warning) 15%, var(--border-dim));
      border-left: 3px solid color-mix(in srgb, var(--color-warning) 40%, var(--border-dim));
      color: var(--text-mid);
      font-style: italic;
    }

    .msg__bot-badge {
      display: inline-block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 0 4px;
      margin-left: 4px;
      color: var(--color-warning);
      border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
      vertical-align: middle;
    }

    /* ── Input area ── */
    .input-area {
      display: flex;
      flex-direction: column;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--surface);
      border-top: 1px solid var(--border-dim);
      flex-shrink: 0;
    }

    .input-row {
      display: flex;
      gap: var(--space-2, 8px);
    }

    .chat-input {
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--panel-bg);
      border: 1px solid var(--border-dim);
      color: var(--text-bright);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      outline: none;
      transition: border-color 0.2s;
      resize: none;
    }

    .chat-input::placeholder {
      color: var(--text-dim);
      letter-spacing: 1px;
    }

    .chat-input:focus {
      border-color: var(--amber);
      box-shadow: 0 0 0 1px var(--amber-glow);
    }

    .chat-input:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .send-btn {
      padding: var(--space-2, 8px) var(--space-4, 16px);
      background: var(--amber);
      color: var(--panel-bg);
      border: none;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .send-btn:hover:not(:disabled) {
      background: var(--color-warning-border);
      box-shadow: 0 0 12px var(--amber-glow);
    }

    .send-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .send-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .char-count {
      text-align: right;
      font-size: 9px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
      margin-top: 2px;
      padding-right: 2px;
    }

    .char-count--warn {
      color: var(--amber);
    }

    .char-count--danger {
      color: var(--color-danger);
    }

    /* ── Disabled overlay ── */
    .disabled-notice {
      padding: var(--space-3, 12px);
      text-align: center;
      font-size: 10px;
      letter-spacing: 2px;
      color: var(--text-dim);
      text-transform: uppercase;
      background: var(--surface);
      border-top: 1px solid var(--border-dim);
      flex-shrink: 0;
    }
  `;

  @property() epochId = '';
  @property() mySimulationId = '';
  @property() myTeamId = '';
  @property() epochStatus = '';

  @state() private _activeChannel: ChatChannel = 'epoch';
  @state() private _inputText = '';
  @state() private _sending = false;
  @state() private _epochMessages: EpochChatMessage[] = [];
  @state() private _teamMessages: EpochChatMessage[] = [];
  @state() private _hasMoreEpoch = false;
  @state() private _hasMoreTeam = false;
  @state() private _loadingMore = false;
  @state() private _unreadEpoch = 0;
  @state() private _unreadTeam = 0;

  private _disposeEpochEffect?: () => void;
  private _disposeTeamEffect?: () => void;
  private _disposeUnreadEpochEffect?: () => void;
  private _disposeUnreadTeamEffect?: () => void;

  async connectedCallback() {
    super.connectedCallback();

    // Subscribe to realtime signals
    this._disposeEpochEffect = effect(() => {
      this._epochMessages = realtimeService.epochMessages.value;
      this._scrollToBottom();
    });
    this._disposeTeamEffect = effect(() => {
      this._teamMessages = realtimeService.teamMessages.value;
      if (this._activeChannel === 'team') this._scrollToBottom();
    });
    this._disposeUnreadEpochEffect = effect(() => {
      this._unreadEpoch = realtimeService.unreadEpochCount.value;
    });
    this._disposeUnreadTeamEffect = effect(() => {
      this._unreadTeam = realtimeService.unreadTeamCount.value;
    });

    // REST catch-up
    await this._loadHistory('epoch');
    if (this.myTeamId) {
      await this._loadHistory('team');
    }
  }

  disconnectedCallback() {
    this._disposeEpochEffect?.();
    this._disposeTeamEffect?.();
    this._disposeUnreadEpochEffect?.();
    this._disposeUnreadTeamEffect?.();
    super.disconnectedCallback();
  }

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

    // Brief delay then scroll
    await this.updateComplete;
    this._scrollToBottom();
  }

  private async _loadOlder() {
    const msgs = this._activeChannel === 'epoch' ? this._epochMessages : this._teamMessages;
    if (msgs.length === 0) return;

    this._loadingMore = true;
    const oldestTime = msgs[0]?.created_at;
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
        realtimeService.epochMessages.value = [...older, ...this._epochMessages];
        this._hasMoreEpoch = older.length >= 50 || msgs.length + older.length < total;
      } else {
        realtimeService.teamMessages.value = [...older, ...this._teamMessages];
        this._hasMoreTeam = older.length >= 50 || msgs.length + older.length < total;
      }
    }
    this._loadingMore = false;
  }

  private async _handleSend() {
    const content = this._inputText.trim();
    if (!content || this._sending) return;

    this._sending = true;
    const result = await epochChatApi.sendMessage(this.epochId, {
      content,
      channel_type: this._activeChannel,
      simulation_id: this.mySimulationId,
      team_id: this._activeChannel === 'team' ? this.myTeamId : undefined,
    });

    if (result.success && result.data) {
      this._inputText = '';
      // Optimistic: inject into realtime signal so the message appears immediately
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

    // Focus input after send
    await this.updateComplete;
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('.chat-input');
    input?.focus();
  }

  private _switchChannel(ch: ChatChannel) {
    this._activeChannel = ch;
    realtimeService.resetUnreadCount(ch);
    this._scrollToBottom();
  }

  private _scrollToBottom() {
    requestAnimationFrame(() => {
      const feed = this.shadowRoot?.querySelector('.feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }

  private _formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private _isActive(): boolean {
    return !['completed', 'cancelled'].includes(this.epochStatus);
  }

  protected render() {
    const messages = this._activeChannel === 'epoch' ? this._epochMessages : this._teamMessages;
    const hasMore = this._activeChannel === 'epoch' ? this._hasMoreEpoch : this._hasMoreTeam;
    const canSend = this._isActive() && !!this.mySimulationId;

    return html`
      <!-- Channel tabs -->
      <div class="channels">
        <button
          class="channel-tab ${this._activeChannel === 'epoch' ? 'channel-tab--active' : ''}"
          @click=${() => this._switchChannel('epoch')}
        >
          ${msg('All Channels')}
          ${this._unreadEpoch > 0 && this._activeChannel !== 'epoch' ? html`<span class="unread-pip">${this._unreadEpoch}</span>` : nothing}
        </button>
        ${
          this.myTeamId
            ? html`
            <button
              class="channel-tab ${this._activeChannel === 'team' ? 'channel-tab--active' : ''}"
              @click=${() => this._switchChannel('team')}
            >
              ${msg('Team Freq')}
              ${this._unreadTeam > 0 && this._activeChannel !== 'team' ? html`<span class="unread-pip">${this._unreadTeam}</span>` : nothing}
            </button>
          `
            : nothing
        }
      </div>

      <!-- Message feed -->
      <div class="feed">
        ${
          hasMore
            ? html`
            <button
              class="load-more"
              @click=${this._loadOlder}
              ?disabled=${this._loadingMore}
            >
              ${this._loadingMore ? msg('Loading...') : msg('Load older messages')}
            </button>
          `
            : nothing
        }
        ${
          messages.length === 0
            ? html`<div class="feed-empty">${msg('No transmissions yet')}</div>`
            : messages.map((m) => {
                const isSelf = m.sender_simulation_id === this.mySimulationId;
                const isBot = m.sender_type === 'bot';
                const msgClass = isSelf
                  ? 'msg--self'
                  : isBot
                    ? 'msg--other msg--bot'
                    : 'msg--other';
                return html`
                <div class="msg ${msgClass}">
                  <div class="msg__header">
                    <span class="msg__sender">${m.sender_name ?? msg('Unknown')}${isBot ? html`<span class="msg__bot-badge">BOT</span>` : nothing}</span>
                    <span class="msg__time">${this._formatTime(m.created_at)}</span>
                  </div>
                  <div class="msg__body">${m.content}</div>
                </div>
              `;
              })
        }
      </div>

      <!-- Input or disabled notice -->
      ${
        canSend
          ? html`
          <div class="input-area">
            <div class="input-row">
              <input
                class="chat-input"
                type="text"
                aria-label=${this._activeChannel === 'team' ? msg('Team channel message') : msg('Broadcast message')}
                placeholder=${this._activeChannel === 'team' ? msg('Encrypted team channel...') : msg('Broadcast to all players...')}
                .value=${this._inputText}
                @input=${(e: InputEvent) => {
                  this._inputText = (e.target as HTMLInputElement).value;
                }}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._handleSend();
                  }
                }}
                ?disabled=${this._sending}
                maxlength="2000"
              />
              <button
                class="send-btn"
                @click=${this._handleSend}
                ?disabled=${this._sending || !this._inputText.trim()}
              >
                ${msg('Send')}
              </button>
            </div>
            <div class="char-count ${this._inputText.length > 1800 ? (this._inputText.length > 1950 ? 'char-count--danger' : 'char-count--warn') : ''}">
              ${this._inputText.length}/2000
            </div>
          </div>
        `
          : html`
          <div class="disabled-notice">
            ${
              !this.mySimulationId
                ? msg('Join the epoch to send messages')
                : msg('Channel closed — epoch ended')
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
