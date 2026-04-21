/**
 * FirehosePanel — live ai_usage_log stream (panel ⑥).
 *
 * Owns:
 *   - Initial REST page via ``bureauOpsApi.getFirehose(50)``.
 *   - Supabase Realtime subscription to ``ai_usage_log:INSERT`` for
 *     subsequent updates (AD-4). Subscription is torn down in
 *     ``disconnectedCallback``.
 *
 * Delegates presentation to ``<velg-firehose-stream>``. Never surfaces
 * prompt bodies (D-4) — the Realtime payload's ``metadata`` is stripped
 * before passing to the stream primitive.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  bureauOpsApi,
  type FirehoseEntry,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { supabase } from '../../../services/supabase/client.js';
import '../../shared/VelgFirehoseStream.js';

const MAX_ENTRIES = 50;

interface AiUsageLogRow {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  purpose: string;
  total_tokens: number;
  estimated_cost_usd: number;
  duration_ms: number;
  simulation_id: string | null;
  user_id: string | null;
  key_source: string;
  metadata: Record<string, unknown> | null;
}

type RealtimeChannel = ReturnType<typeof supabase.channel>;

@localized()
@customElement('velg-ops-firehose-panel')
export class VelgOpsFirehosePanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      display: block;
      border: 2px solid var(--color-border);
      background: var(--color-surface-raised);
      padding: var(--space-5);
      position: relative;
    }

    :host::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--_accent);
      opacity: 0.6;
    }

    .heading {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--space-3);
    }

    .heading__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .status__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-text-muted);
    }

    .status__dot--live {
      background: var(--color-success);
      box-shadow: 0 0 8px var(--color-success);
      animation: pulse 1.8s ease-in-out infinite;
    }

    .status__dot--offline {
      background: var(--color-danger);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @media (prefers-reduced-motion: reduce) {
      .status__dot--live { animation: none; }
    }

    .error {
      padding: var(--space-3);
      color: var(--color-danger);
      font-size: var(--text-sm);
      border: 1px dashed var(--color-danger);
      background: var(--color-danger-bg);
      margin-bottom: var(--space-3);
    }
  `;

  @state() private _entries: FirehoseEntry[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _live = false;

  private _channel: RealtimeChannel | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadInitial();
    this._subscribeRealtime();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeRealtime();
  }

  private async _loadInitial(): Promise<void> {
    this._loading = true;
    const resp = await bureauOpsApi.getFirehose(MAX_ENTRIES);
    this._loading = false;
    if (resp.success) {
      this._entries = resp.data;
      this._error = null;
    } else {
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'FirehosePanel._loadInitial',
        code: resp.error.code,
      });
    }
  }

  private _subscribeRealtime(): void {
    this._channel = supabase
      .channel('bureau-ops-firehose')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_usage_log',
        },
        (payload) => {
          const row = payload.new as AiUsageLogRow | undefined;
          if (!row || !row.id) return;
          const entry = _rowToEntry(row);
          this._entries = [entry, ...this._entries].slice(0, MAX_ENTRIES);
        },
      )
      .subscribe((status) => {
        this._live = status === 'SUBSCRIBED';
      });
  }

  private _unsubscribeRealtime(): void {
    if (this._channel) {
      try {
        supabase.removeChannel(this._channel);
      } catch (err) {
        captureError(err, { source: 'FirehosePanel._unsubscribeRealtime' });
      }
      this._channel = null;
      this._live = false;
    }
  }

  private _statusLabel(): string {
    if (this._loading) return msg('loading…');
    if (this._error) return msg('offline');
    return this._live ? msg('live') : msg('polling');
  }

  private _statusDotClass(): string {
    if (this._error) return 'status__dot status__dot--offline';
    if (this._live && !this._loading) return 'status__dot status__dot--live';
    return 'status__dot';
  }

  protected render() {
    return html`
      <div class="heading">
        <span class="heading__label">${msg('Firehose // ai_usage_log')}</span>
        <span class="status" aria-live="polite">
          <span class=${this._statusDotClass()} aria-hidden="true"></span>
          ${this._statusLabel()}
        </span>
      </div>

      ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

      <velg-firehose-stream
        .entries=${this._entries}
        .maxRows=${MAX_ENTRIES}
        .loading=${this._loading}
      ></velg-firehose-stream>
    `;
  }
}

function _rowToEntry(row: AiUsageLogRow): FirehoseEntry {
  const metadata = row.metadata ?? {};
  const status =
    typeof metadata === 'object' && metadata !== null && (metadata as { status?: string }).status === 'error'
      ? 'error'
      : 'ok';
  return {
    id: row.id,
    created_at: row.created_at,
    provider: row.provider,
    model: row.model,
    purpose: row.purpose,
    total_tokens: row.total_tokens,
    estimated_cost_usd: Number(row.estimated_cost_usd ?? 0),
    duration_ms: row.duration_ms,
    simulation_id: row.simulation_id,
    user_id: row.user_id,
    key_source: row.key_source,
    status,
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-firehose-panel': VelgOpsFirehosePanel;
  }
}
