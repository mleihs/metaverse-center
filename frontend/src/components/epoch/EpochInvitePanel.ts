/**
 * Epoch Invite Panel — military tactical HUD for managing epoch invitations.
 *
 * Slide-from-right panel (VelgSidePanel shell) with:
 * - Email input + "Send Summons" button
 * - AI-generated lore preview in dossier box
 * - Sent invitations list with status badges and revoke controls
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import type { EpochInvitation } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSidePanel.js';

@localized()
@customElement('velg-epoch-invite-panel')
export class VelgEpochInvitePanel extends LitElement {
  static styles = css`
    /* ── Scan-line overlay on entire panel ── */
    :host {
      --amber: #f59e0b;
      --amber-dim: #b87a08;
      --amber-glow: rgba(245, 158, 11, 0.2);
      --panel-bg: #0f0f0f;
      --surface: #1a1a1a;
      --border-dim: #333;
      --text-bright: #f0f0f0;
      --text-mid: #ccc;
      --text-dim: #999;
    }

    /* Override VelgSidePanel theme tokens — force dark HUD aesthetic */
    velg-side-panel {
      --color-surface-raised: #0f0f0f;
      --color-surface-header: #141414;
      --color-text-primary: #f0f0f0;
      --border-default: 1px solid #333;
      --border-medium: 1px solid #333;
    }

    .panel-body {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-5, 20px);
      padding: var(--space-4, 16px);
      background: var(--panel-bg);
      min-height: 100%;
    }

    /* Scan-line texture */
    .panel-body::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255 255 255 / 0.015) 2px,
        rgba(255 255 255 / 0.015) 4px
      );
      z-index: 0;
    }

    .panel-body > * {
      position: relative;
      z-index: 1;
    }

    /* ── Section labels ── */
    .section-label {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin: 0 0 var(--space-2, 8px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border-dim);
    }

    /* ── Email input section ── */
    .input-group {
      display: flex;
      gap: var(--space-2, 8px);
    }

    .email-input {
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--surface);
      border: 1px solid var(--border-dim);
      color: var(--text-bright);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      letter-spacing: 0.5px;
      outline: none;
      transition: border-color 0.2s;
    }

    .email-input::placeholder {
      color: var(--text-dim);
      letter-spacing: 1px;
    }

    .email-input:focus {
      border-color: var(--amber);
      box-shadow: 0 0 0 1px var(--amber-glow);
    }

    .send-btn {
      padding: var(--space-2, 8px) var(--space-4, 16px);
      background: var(--amber);
      color: var(--panel-bg);
      border: none;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .send-btn:hover:not(:disabled) {
      background: #fbbf24;
      box-shadow: 0 0 12px var(--amber-glow);
    }

    .send-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Lore dossier box ── */
    .dossier {
      border: 1px dashed var(--border-dim);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      background: var(--surface);
      position: relative;
    }

    .dossier__stamp {
      position: absolute;
      top: var(--space-2, 8px);
      right: var(--space-3, 12px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      color: var(--amber-dim);
      text-transform: uppercase;
      opacity: 0.6;
    }

    .dossier__text {
      margin: 0;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      line-height: 1.7;
      color: var(--text-mid);
      font-style: italic;
    }

    .dossier__text--empty {
      color: var(--text-dim);
      font-style: normal;
    }

    .dossier__actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-2, 8px);
    }

    .ghost-btn {
      padding: var(--space-1, 4px) var(--space-3, 12px);
      background: transparent;
      border: 1px solid var(--border-dim);
      color: var(--text-dim);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ghost-btn:hover:not(:disabled) {
      border-color: var(--amber-dim);
      color: var(--amber);
    }

    .ghost-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* ── Invitations list ── */
    .inv-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .inv-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--surface);
      border-left: 2px solid var(--border-dim);
      transition: border-color 0.15s;
    }

    .inv-row:hover {
      border-left-color: var(--amber-dim);
    }

    .inv-row__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .inv-row__email {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      color: var(--text-bright);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .inv-row__time {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
    }

    /* ── Status badges ── */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px var(--space-2, 8px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .status-badge--pending {
      border: 1px solid var(--text-dim);
      color: var(--text-mid);
    }

    .status-badge--accepted {
      border: 1px solid #22c55e;
      color: #4ade80;
    }

    .status-badge--expired {
      border: 1px solid var(--amber-dim);
      color: var(--amber);
    }

    .status-badge--revoked {
      border: 1px solid #dc2626;
      color: #ef4444;
    }

    .status-badge__dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }

    /* ── Revoke button ── */
    .revoke-btn {
      padding: 2px var(--space-2, 8px);
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-dim);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
    }

    .revoke-btn:hover {
      border-color: #dc2626;
      color: #ef4444;
    }

    /* ── Empty state ── */
    .empty-state {
      padding: var(--space-6, 24px);
      text-align: center;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--text-dim);
      text-transform: uppercase;
    }
  `;

  @property() epochId = '';
  @property({ type: Boolean }) open = false;

  @state() private _invitations: EpochInvitation[] = [];
  @state() private _email = '';
  @state() private _sending = false;
  @state() private _loreText = '';
  @state() private _regeneratingLore = false;

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open && this.epochId) {
      this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
    const [invResult, loreResult] = await Promise.all([
      epochsApi.listInvitations(this.epochId),
      epochsApi.getEpoch(this.epochId),
    ]);

    if (invResult.success && invResult.data) {
      this._invitations = invResult.data as EpochInvitation[];
    }

    if (loreResult.success && loreResult.data) {
      const epoch = loreResult.data as { config?: { invitation_lore?: string } };
      this._loreText = epoch.config?.invitation_lore ?? '';
    }
  }

  private async _handleSend(): Promise<void> {
    if (!this._email.trim() || this._sending) return;

    this._sending = true;
    const result = await epochsApi.sendInvitation(this.epochId, {
      email: this._email.trim(),
    });

    if (result.success) {
      VelgToast.success(msg(str`Summons dispatched to ${this._email}`));
      this._email = '';
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to send invitation.'));
    }
    this._sending = false;
  }

  private async _handleRegenerate(): Promise<void> {
    if (this._regeneratingLore) return;
    this._regeneratingLore = true;

    const result = await epochsApi.regenerateLore(this.epochId);
    if (result.success && result.data) {
      const data = result.data as { lore_text?: string };
      this._loreText = data.lore_text ?? '';
      VelgToast.success(msg('Lore regenerated.'));
    } else {
      VelgToast.error(msg('Failed to regenerate lore.'));
    }
    this._regeneratingLore = false;
  }

  private async _handleRevoke(invitationId: string): Promise<void> {
    const result = await epochsApi.revokeInvitation(this.epochId, invitationId);
    if (result.success) {
      VelgToast.success(msg('Invitation revoked.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to revoke invitation.'));
    }
  }

  private _onClose(): void {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this._handleSend();
  }

  private _formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  protected render() {
    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${msg('Epoch Summons')}
        @panel-close=${this._onClose}
      >
        <div class="panel-body" slot="content">
          <!-- Email Input -->
          <div>
            <div class="section-label">${msg('Dispatch Summons')}</div>
            <div class="input-group">
              <input
                class="email-input"
                type="email"
                placeholder=${msg('operative@email.com')}
                .value=${this._email}
                @input=${(e: InputEvent) => {
                  this._email = (e.target as HTMLInputElement).value;
                }}
                @keydown=${this._onKeydown}
                ?disabled=${this._sending}
              />
              <button
                class="send-btn"
                @click=${this._handleSend}
                ?disabled=${this._sending || !this._email.trim()}
              >
                ${this._sending ? msg('Sending...') : msg('Send')}
              </button>
            </div>
          </div>

          <!-- Lore Preview -->
          <div>
            <div class="section-label">${msg('Intel Dispatch')}</div>
            <div class="dossier">
              <span class="dossier__stamp">${msg('Classified')}</span>
              ${
                this._loreText
                  ? html`<p class="dossier__text">${this._loreText}</p>`
                  : html`<p class="dossier__text dossier__text--empty">
                    ${msg('No lore generated yet. Send an invitation to auto-generate.')}
                  </p>`
              }
              <div class="dossier__actions">
                <button
                  class="ghost-btn"
                  @click=${this._handleRegenerate}
                  ?disabled=${this._regeneratingLore}
                >
                  ${this._regeneratingLore ? msg('Generating...') : msg('Regenerate')}
                </button>
              </div>
            </div>
          </div>

          <!-- Invitations List -->
          <div>
            <div class="section-label">${msg('Dispatched Summons')}</div>
            ${
              this._invitations.length > 0
                ? html`
                  <div class="inv-list">
                    ${this._invitations.map(
                      (inv) => html`
                        <div class="inv-row">
                          <div class="inv-row__info">
                            <span class="inv-row__email">${inv.invited_email}</span>
                            <span class="inv-row__time">${this._formatTime(inv.created_at)}</span>
                          </div>
                          <span class="status-badge status-badge--${inv.status}">
                            <span class="status-badge__dot"></span>
                            ${inv.status}
                          </span>
                          ${
                            inv.status === 'pending'
                              ? html`
                                <button
                                  class="revoke-btn"
                                  @click=${() => this._handleRevoke(inv.id)}
                                >
                                  ${msg('Revoke')}
                                </button>
                              `
                              : nothing
                          }
                        </div>
                      `,
                    )}
                  </div>
                `
                : html`
                  <div class="empty-state">${msg('No invitations sent yet.')}</div>
                `
            }
          </div>
        </div>
      </velg-side-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-invite-panel': VelgEpochInvitePanel;
  }
}
