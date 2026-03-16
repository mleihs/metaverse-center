/**
 * ClearanceQueue — Self-contained admin queue for reviewing forge clearance requests.
 *
 * Two variants:
 * - `full`: forge-section panel with SEC-03 header, description, divider (admin panel)
 * - `compact`: tight amber-accented strip with horizontal-scroll cards (dashboard)
 *
 * Owns its own data fetching, review logic, and rendering.
 * Syncs count via `appState.setPendingForgeRequestCount()`.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeApi } from '../../services/api/index.js';
import type { ForgeAccessRequestWithEmail } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-clearance-queue')
export class VelgClearanceQueue extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Keyframes ── */

    @keyframes panel-enter {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }


    @keyframes card-exit {
      to { opacity: 0; transform: translateX(-16px) scale(0.97); }
    }

    @media (prefers-reduced-motion: reduce) {
      .forge-section,
      .request-card,
      .clearance-queue { animation: none !important; }
    }

    /* ── Full variant: forge-section wrapper ── */

    .forge-section {
      position: relative;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      padding: var(--space-5) var(--space-5) var(--space-5) var(--space-6);
      animation: panel-enter 0.4s ease both;
    }

    .forge-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(
        180deg,
        var(--color-accent-amber) 0%,
        var(--color-accent-amber-dim, rgba(245, 158, 11, 0.3)) 100%
      );
    }

    .forge-section__header {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      margin-bottom: var(--space-1);
    }

    .forge-section__code {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 2px;
      color: var(--color-accent-amber);
      opacity: 0.7;
      white-space: nowrap;
    }

    .forge-section__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    .forge-section__desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
      padding-left: 1px;
    }

    .forge-section__divider {
      height: 1px;
      background: linear-gradient(90deg, var(--color-accent-amber-dim, rgba(245, 158, 11, 0.2)) 0%, transparent 80%);
      margin-bottom: var(--space-4);
    }

    /* ── Request cards ── */

    .request-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-warning, #f59e0b);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
      transition: border-color var(--transition-fast);
    }

    .request-card:hover {
      border-left-color: var(--color-accent-amber);
    }

    .request-card.exiting {
      animation: card-exit 280ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .request-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--space-2);
    }

    .request-card__email {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm);
      color: var(--color-accent-amber);
      font-weight: 600;
    }

    .request-card__date {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .request-card__message {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      font-style: italic;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px dashed var(--color-border);
      margin-bottom: var(--space-3);
      line-height: 1.6;
    }

    .request-card__notes-input {
      width: 100%;
      box-sizing: border-box;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      min-height: 60px;
      resize: vertical;
      margin-bottom: var(--space-3);
      transition: border-color var(--transition-fast);
    }

    .request-card__notes-input:focus {
      outline: none;
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 0 1px var(--color-accent-amber);
    }

    .request-card__notes-label {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin-bottom: var(--space-1);
    }

    .request-card__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    /* ── Buttons ── */

    .btn-approve {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-success);
      color: var(--color-gray-950);
      border: none;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-approve:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3);
    }

    .btn-approve:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn-reject {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      color: var(--color-danger);
      border: 1px solid var(--color-danger);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-reject:hover {
      background: var(--color-danger);
      color: var(--color-gray-950);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }

    .btn-reject:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* ── Empty state ── */

    .empty-state {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-8) 0;
      letter-spacing: 1px;
      opacity: 0.6;
    }

    .empty-state::before {
      content: '//';
      margin-right: 6px;
      color: var(--color-accent-amber);
      opacity: 0.5;
    }

    .empty-state::after {
      content: '//';
      margin-left: 6px;
      color: var(--color-accent-amber);
      opacity: 0.5;
    }

    /* ── Compact variant: left-column section ── */

    :host([variant="compact"]) .clearance-queue {
      margin-bottom: var(--space-6);
    }

    :host([variant="compact"]) .section-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: var(--space-4);
    }

    :host([variant="compact"]) .section-header__surtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--color-gray-400);
    }

    :host([variant="compact"]) .section-header__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--color-text-primary);
      margin: 0;
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }
  `;

  @property({ reflect: true }) variant: 'full' | 'compact' = 'full';

  @state() private _requests: ForgeAccessRequestWithEmail[] = [];
  @state() private _requestNotes: Record<string, string> = {};
  @state() private _reviewingId: string | null = null;
  @state() private _loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadPendingRequests();
  }

  // ── Data ──

  private async _loadPendingRequests(): Promise<void> {
    this._loading = true;
    try {
      const resp = await forgeApi.listPendingRequests();
      if (resp.success && resp.data) {
        this._requests = resp.data;
      }
    } catch {
      // Non-critical — admin panel has other ways to surface this
    } finally {
      this._loading = false;
    }
  }

  // ── Actions ──

  private async _reviewRequest(id: string, action: 'approve' | 'reject'): Promise<void> {
    const { VelgConfirmDialog } = await import('../shared/ConfirmDialog.js');
    const actionLabel = action === 'approve' ? msg('Approve') : msg('Reject');
    const confirmed = await VelgConfirmDialog.show({
      title: `${actionLabel} ${msg('Clearance Request')}`,
      message:
        action === 'approve'
          ? msg('This will grant the user Architect clearance and send a notification email.')
          : msg('This will deny the clearance request and notify the user.'),
      confirmLabel: actionLabel,
      variant: action === 'reject' ? 'danger' : 'default',
    });
    if (!confirmed) return;

    this._reviewingId = id;
    try {
      const notes = this._requestNotes[id] || undefined;
      const resp = await forgeApi.reviewRequest(id, action, notes);
      if (resp.success) {
        if (action === 'approve') {
          const tokens = (resp.data as Record<string, unknown>)?.tokens_granted;
          VelgToast.success(
            tokens
              ? msg(`Clearance granted. ${tokens} starter tokens credited.`)
              : msg('Clearance granted successfully.'),
          );
        } else {
          VelgToast.success(msg('Clearance request rejected.'));
        }

        // Animate card out, then remove
        const card = this.shadowRoot?.querySelector(
          `[data-request-id="${id}"]`,
        ) as HTMLElement | null;
        if (card) {
          card.classList.add('exiting');
          card.addEventListener('animationend', () => this._removeAndFocus(id), { once: true });
        } else {
          this._removeAndFocus(id);
        }
      } else {
        VelgToast.error(msg('Review failed.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    } finally {
      this._reviewingId = null;
    }
  }

  private _removeAndFocus(id: string): void {
    const idx = this._requests.findIndex((r) => r.id === id);
    this._requests = this._requests.filter((r) => r.id !== id);
    const { [id]: _, ...remainingNotes } = this._requestNotes;
    this._requestNotes = remainingNotes;
    appState.setPendingForgeRequestCount(this._requests.length);

    // Focus management: next card, previous card, or container
    this.updateComplete.then(() => {
      const cards = this.shadowRoot?.querySelectorAll('.request-card');
      if (cards && cards.length > 0) {
        const nextIdx = Math.min(idx, cards.length - 1);
        (cards[nextIdx] as HTMLElement).focus();
      } else {
        // Focus the region container (empty state or strip)
        const region = this.shadowRoot?.querySelector('[role="region"]') as HTMLElement | null;
        region?.focus();
      }
    });
  }

  // ── Utilities ──

  private _formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  // ── Render ──

  protected render() {
    if (this._loading && this._requests.length === 0) return nothing;

    return this.variant === 'compact' ? this._renderCompact() : this._renderFull();
  }

  private _renderFull() {
    const count = this._requests.length;
    return html`
      <div
        class="forge-section"
        role="region"
        aria-label=${msg('Pending clearance requests')}
        tabindex="-1"
      >
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-03</span>
          <h3 class="forge-section__title">
            ${msg('Clearance Requests')}
            ${count > 0 ? html`<velg-badge variant="warning">${count}</velg-badge>` : nothing}
          </h3>
        </div>
        <div class="forge-section__desc">${msg('Pending clearance upgrade requests from Field Observers.')}</div>
        <div class="forge-section__divider"></div>

        ${
          count === 0
            ? html`<div class="empty-state">${msg('No Pending Clearance Requests')}</div>`
            : this._requests.map((req) => this._renderRequestCard(req))
        }
      </div>
    `;
  }

  private _renderCompact() {
    if (this._requests.length === 0) return nothing;

    return html`
      <section
        class="clearance-queue"
        role="region"
        aria-label=${msg('Pending clearance requests')}
        tabindex="-1"
      >
        <div class="section-header">
          <span class="section-header__surtitle">${msg('PENDING REVIEW')}</span>
          <h2 class="section-header__title">
            ${msg('Clearance Requests')}
            <velg-badge variant="warning">${this._requests.length}</velg-badge>
          </h2>
        </div>
        ${this._requests.map((req) => this._renderRequestCard(req))}
      </section>
    `;
  }

  private _renderRequestCard(req: ForgeAccessRequestWithEmail) {
    const isReviewing = this._reviewingId === req.id;
    return html`
      <div
        class="request-card"
        role="article"
        tabindex="-1"
        data-request-id=${req.id}
      >
        <div class="request-card__header">
          <span class="request-card__email">${req.user_email}</span>
          <span class="request-card__date">${this._formatDate(req.created_at)}</span>
        </div>

        ${
          req.message
            ? html`<div class="request-card__message">&ldquo;${req.message}&rdquo;</div>`
            : nothing
        }

        <div class="request-card__notes-label">${msg('Admin notes:')}</div>
        <textarea
          class="request-card__notes-input"
          placeholder=${msg('Optional notes for the user...')}
          maxlength="500"
          aria-label=${msg('Admin notes')}
          .value=${this._requestNotes[req.id] ?? ''}
          @input=${(e: Event) => {
            this._requestNotes = {
              ...this._requestNotes,
              [req.id]: (e.target as HTMLTextAreaElement).value,
            };
          }}
        ></textarea>

        <div class="request-card__actions">
          <button
            class="btn-reject"
            ?disabled=${isReviewing}
            aria-label="${msg('Reject request from')} ${req.user_email}"
            @click=${() => this._reviewRequest(req.id, 'reject')}
          >
            ${msg('Reject')}
          </button>
          <button
            class="btn-approve"
            ?disabled=${isReviewing}
            aria-label="${msg('Approve request from')} ${req.user_email}"
            @click=${() => this._reviewRequest(req.id, 'approve')}
          >
            ${isReviewing ? msg('Processing...') : msg('Approve')} &#10003;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-clearance-queue': VelgClearanceQueue;
  }
}
