/**
 * DispatchTicker — ambient ops_audit_log crawl footer (P3.4).
 *
 * Bottom-of-cockpit footer bar that streams the last 20
 * ops_audit_log entries through the shared VelgDispatchTicker
 * primitive. Auto-scrolls horizontally; pauses on hover/focus so an
 * operator can read the line they just spotted.
 *
 * Polls /admin/ops/audit every 30s with limit=20 and a 24h window.
 * The audit endpoint is cheap (one indexed table read), so the poll
 * cadence is generous; the ticker is "ambient awareness" rather than
 * incident-response surface — operators escalate to the Incident
 * Dossier drawer for filtering and detail.
 *
 * Action → dot colour mapping is defined in ACTION_TINT below; new
 * audit-log actions added by future endpoints fall back to the muted
 * default so the ticker keeps rendering without a code change.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import {
  bureauOpsApi,
  type OpsAuditEntry,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import '../../shared/VelgDispatchTicker.js';
import type { TickerItem } from '../../shared/VelgDispatchTicker.js';

const POLL_MS = 30_000;
const LIMIT = 20;
const WINDOW_DAYS = 1;
const REASON_MAX_CHARS = 60;

/**
 * action prefix → CSS-token color string. Resolved against the
 * computed style of the host so theme switches recolour the dots
 * without re-compiling. Anything unmapped falls through to muted.
 */
const ACTION_TINT: Record<string, string> = {
  'kill.trip': 'var(--color-danger)',
  'kill.revert': 'var(--color-success)',
  'circuit.reset': 'var(--color-info)',
  'budget.upsert': 'var(--color-primary)',
  'budget.delete': 'var(--color-warning)',
  'sentry.rule.create': 'var(--color-primary)',
  'sentry.rule.update': 'var(--color-primary)',
  'sentry.rule.delete': 'var(--color-warning)',
};
const DEFAULT_TINT = 'var(--color-text-muted)';

@localized()
@customElement('velg-ops-dispatch-ticker')
export class VelgOpsDispatchTicker extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      display: block;
      margin-top: var(--space-5);
    }

    .frame {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      position: relative;
      overflow: hidden;
    }

    .frame::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: var(--_accent);
      opacity: 0.4;
    }

    .label {
      position: absolute;
      top: var(--space-1);
      left: var(--space-2);
      z-index: 1;
      padding: 2px var(--space-2);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .empty {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
    }

    velg-dispatch-ticker {
      padding-left: var(--space-12);
      padding-right: var(--space-3);
    }
  `;

  @state() private _items: TickerItem[] = [];
  @state() private _loaded = false;

  private _timer: number | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetch();
    this._timer = window.setInterval(() => void this._fetch(), POLL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  private async _fetch(): Promise<void> {
    const resp = await bureauOpsApi.getAuditLog(WINDOW_DAYS, LIMIT);
    if (resp.success) {
      this._items = resp.data.map((entry) => this._toTickerItem(entry));
    } else {
      captureError(new Error(resp.error.message), {
        source: 'DispatchTicker._fetch',
        code: resp.error.code,
      });
    }
    this._loaded = true;
  }

  private _toTickerItem(entry: OpsAuditEntry): TickerItem {
    const time = this._formatTime(entry.created_at);
    const target = entry.target_key
      ? `${entry.target_scope ? `${entry.target_scope}:` : ''}${entry.target_key}`
      : '';
    const reason = this._truncate(entry.reason, REASON_MAX_CHARS);
    const parts = [
      `[${time}]`,
      entry.action.toUpperCase(),
      target ? `→ ${target}` : '',
      reason ? `· ${reason}` : '',
    ].filter(Boolean);
    return {
      text: parts.join(' '),
      color: ACTION_TINT[entry.action] ?? DEFAULT_TINT,
    };
  }

  private _formatTime(iso: string): string {
    try {
      const dt = new Date(iso);
      return dt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      captureError(err, { source: 'DispatchTicker._formatTime' });
      return '--:--';
    }
  }

  private _truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  protected render() {
    return html`
      <div class="frame" role="status" aria-live="off">
        <span class="label">${msg('Dispatch')}</span>
        ${
          this._loaded && this._items.length === 0
            ? html`<div class="empty">${msg('No recent ops events.')}</div>`
            : this._items.length > 0
              ? html`<velg-dispatch-ticker
                  .items=${this._items}
                  .speed=${60}
                  pause-on-hover
                ></velg-dispatch-ticker>`
              : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-dispatch-ticker': VelgOpsDispatchTicker;
  }
}
