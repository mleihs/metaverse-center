import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  adminApi,
  type BlueskyAnalytics,
  type BlueskyConnectionStatus,
  type BlueskyPipelineSettings,
  type BlueskyQueueItem,
} from '../../services/api/AdminApiService.js';
import { captureError } from '../../services/SentryService.js';
import { formatDateTimeShort } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import {
  adminActionStyles,
  adminBadgeStyles,
  adminConnectionCardStyles,
  adminDispatchStyles,
  adminStatusFilterStyles,
  adminTabNavStyles,
} from '../shared/admin-shared-styles.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';
import '../shared/VelgMetricCard.js';

type PanelTab = 'operations' | 'configure' | 'intelligence';
type StatusFilter = 'all' | 'pending' | 'publishing' | 'published' | 'failed' | 'skipped';

const STATUS_COLORS: Record<string, string> = {
  pending: 'info',
  publishing: 'warning',
  published: 'success',
  failed: 'danger',
  skipped: 'muted',
};

@localized()
@customElement('velg-admin-bluesky-tab')
export class VelgAdminBlueskyTab extends LitElement {
  static styles = [
    infoBubbleStyles,
    adminConnectionCardStyles,
    adminTabNavStyles,
    adminStatusFilterStyles,
    adminDispatchStyles,
    adminBadgeStyles,
    adminActionStyles,
    css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
    }

    /* ── SCIF Header ────────────────────────────────── */

    .scif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
      position: relative;
    }

    .scif-header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 120px;
      height: 1px;
      background: var(--color-primary);
    }

    .scif-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
    }

    .scif-header__subtitle {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }

    /* ── Bluesky-specific: IG link in dispatch cards ── */

    .dispatch__ig-link {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .dispatch__ig-link a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .dispatch__ig-link a:hover {
      text-decoration: underline;
    }

    /* ── States ──────────────────────────────────────── */

    .loading-state, .empty-state {
      padding: var(--space-8);
      text-align: center;
      color: var(--color-text-muted);
    }

    .error-state {
      padding: var(--space-4);
      border: 1px solid var(--color-danger);
      border-radius: 4px;
      color: var(--color-danger);
      margin-bottom: var(--space-4);
    }

    /* ── Configuration Panel ──────────────────────────── */

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    .config-card {
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: var(--space-4);
      position: relative;
    }

    .config-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }

    .config-card__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .config-card__status {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .config-card__status--active { color: var(--color-success); }
    .config-card__status--inactive { color: var(--color-text-muted); }

    .config-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) 0;
    }

    .config-row + .config-row {
      border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .config-row__label {
      flex: 1;
      min-width: 0;
    }

    .config-row__name {
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .config-row__desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .config-input {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      padding: var(--space-1-5) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: 3px;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      width: 220px;
      transition: border-color 0.15s ease;
    }

    .config-input:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .config-input--password {
      letter-spacing: 0.15em;
    }

    .config-save-btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-primary);
      border-radius: 3px;
      background: none;
      color: var(--color-primary);
      cursor: pointer;
      transition: all 0.15s ease;
      margin-left: var(--space-2);
      white-space: nowrap;
    }

    .config-save-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    .config-save-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .config-input-group {
      display: flex;
      align-items: center;
    }

    /* ── Intel grid (local, replaces adminMetricCardStyles) ── */

    .intel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    @media (max-width: 768px) {
      .dispatch {
        flex-direction: column;
      }
      .dispatch__thumb {
        width: 100%;
        height: 120px;
      }
      .dispatch__actions {
        flex-direction: row;
      }
      .intel-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
  ];

  // ── State ────────────────────────────────────────────

  @state() private _activeTab: PanelTab = 'operations';
  @state() private _queue: BlueskyQueueItem[] = [];
  @state() private _analytics: BlueskyAnalytics | null = null;
  @state() private _connectionStatus: BlueskyConnectionStatus | null = null;
  @state() private _statusFilter: StatusFilter = 'all';
  @state() private _loading = true;
  @state() private _testingConnection = false;
  @state() private _error: string | null = null;
  @state() private _actionInProgress: string | null = null;
  @state() private _settings: BlueskyPipelineSettings | null = null;
  @state() private _savingKey: string | null = null;
  @state() private _handleDraft = '';
  @state() private _passwordDraft = '';
  @state() private _pdsDraft = '';

  // ── Lifecycle ────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    void this._loadAll();
  }

  // ── Data Loading ─────────────────────────────────────

  private async _loadAll(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const [queueResp, analyticsResp, statusResp, settingsResp] = await Promise.all([
        adminApi.listBlueskyQueue({ limit: '100' }),
        adminApi.getBlueskyAnalytics(30),
        adminApi.getBlueskyStatus(),
        adminApi.getBlueskySettings(),
      ]);

      if (queueResp.success && queueResp.data) {
        this._queue = queueResp.data;
      }
      if (analyticsResp.success && analyticsResp.data) {
        this._analytics = analyticsResp.data;
      }
      if (statusResp.success && statusResp.data) {
        this._connectionStatus = statusResp.data;
      }
      if (settingsResp.success && settingsResp.data) {
        this._settings = settingsResp.data;
        this._handleDraft = this._settingValue('bluesky_handle');
        this._passwordDraft = '';
        this._pdsDraft = this._settingValue('bluesky_pds_url');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load Bluesky data');
    } finally {
      this._loading = false;
    }
  }

  // ── Computed ─────────────────────────────────────────

  private get _filteredQueue(): BlueskyQueueItem[] {
    if (this._statusFilter === 'all') return this._queue;
    return this._queue.filter((p) => p.status === this._statusFilter);
  }

  private get _actionableCount(): number {
    return this._queue.filter((p) => p.status === 'pending' || p.status === 'failed').length;
  }

  private _statusCount(status: string): number {
    return this._queue.filter((p) => p.status === status).length;
  }

  // ── Actions ──────────────────────────────────────────

  private async _handleSkip(post: BlueskyQueueItem): Promise<void> {
    this._actionInProgress = post.id;
    try {
      const resp = await adminApi.skipBlueskyPost(post.id);
      if (resp.success) {
        VelgToast.success(msg('Post skipped.'));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Skip failed'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminBlueskyTab._handleSkip', postId: post.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleUnskip(post: BlueskyQueueItem): Promise<void> {
    this._actionInProgress = post.id;
    try {
      const resp = await adminApi.unskipBlueskyPost(post.id);
      if (resp.success) {
        VelgToast.success(msg('Post re-enabled.'));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Unskip failed'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminBlueskyTab._handleUnskip', postId: post.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleForcePublish(post: BlueskyQueueItem): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Force Publish to Bluesky'),
      message: msg(str`Publish this ${post.content_source_type} post to Bluesky immediately?`),
      confirmLabel: msg('Publish Now'),
    });
    if (!confirmed) return;

    this._actionInProgress = post.id;
    try {
      const resp = await adminApi.forcePublishBlueskyPost(post.id);
      if (resp.success) {
        VelgToast.success(msg('Post published to Bluesky.'));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Publishing failed'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminBlueskyTab._handleForcePublish', postId: post.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleTestConnection(): Promise<void> {
    this._testingConnection = true;
    try {
      const resp = await adminApi.getBlueskyStatus();
      if (resp.success && resp.data) {
        this._connectionStatus = resp.data;
        if (resp.data.authenticated) {
          VelgToast.success(msg('Bluesky connection verified.'));
        } else if (resp.data.configured) {
          VelgToast.error(msg('Authentication failed – check app password.'));
        } else {
          VelgToast.error(msg('Bluesky credentials not configured.'));
        }
      }
    } catch (err) {
      captureError(err, { source: 'AdminBlueskyTab._handleTestConnection' });
      VelgToast.error(msg('Connection test failed'));
    } finally {
      this._testingConnection = false;
    }
  }

  // ── Settings Helpers ─────────────────────────────────

  private _settingValue(key: string): string {
    const entry = this._settings?.[key];
    if (!entry) return '';
    return String(entry.value ?? '').replace(/^"|"$/g, '');
  }

  private _settingBool(key: string): boolean {
    const raw = this._settingValue(key);
    return raw === 'true';
  }

  private async _saveSetting(key: string, value: string): Promise<void> {
    this._savingKey = key;
    try {
      const resp = await adminApi.updateSetting(key, value);
      if (resp.success) {
        VelgToast.success(msg(str`Setting updated: ${key.replace('bluesky_', '')}`));
        // Refresh settings
        const settingsResp = await adminApi.getBlueskySettings();
        if (settingsResp.success && settingsResp.data) {
          this._settings = settingsResp.data;
        }
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to save setting'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminBlueskyTab._saveSetting', settingKey: key });
      VelgToast.error(msg('Failed to save setting'));
    } finally {
      this._savingKey = null;
    }
  }

  private async _toggleSetting(key: string): Promise<void> {
    const newVal = !this._settingBool(key);
    await this._saveSetting(key, newVal ? 'true' : 'false');
  }

  // ── Formatting ───────────────────────────────────────

  private _formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  // ── Render ───────────────────────────────────────────

  protected render() {
    return html`
      <div class="scif-header">
        <div>
          <h2 class="scif-header__title">${msg('Bluesky Relay')}</h2>
          <span class="scif-header__subtitle">${msg('Cross-channel dispatch – AT Protocol')}</span>
        </div>
      </div>

      ${this._renderConnectionStatus()}

      ${this._error ? html`<div class="error-state">${this._error}</div>` : nothing}

      ${this._renderTabBar()}

      ${this._activeTab === 'operations' ? this._renderOperations() : nothing}
      ${this._activeTab === 'configure' ? this._renderConfigureTab() : nothing}
      ${this._activeTab === 'intelligence' ? this._renderIntelligence() : nothing}
    `;
  }

  // ── Connection Status Card ───────────────────────────

  private _renderConnectionStatus() {
    const cs = this._connectionStatus;
    const indicatorClass = cs?.authenticated
      ? 'connection-card__indicator--ok'
      : cs?.configured
        ? 'connection-card__indicator--error'
        : 'connection-card__indicator--unconfigured';

    const statusLabel = cs?.authenticated
      ? msg('Authenticated')
      : cs?.configured
        ? msg('Auth Failed')
        : msg('Not Configured');

    const statusClass = cs?.authenticated
      ? 'connection-card__status--ok'
      : cs?.configured
        ? 'connection-card__status--error'
        : 'connection-card__status--unconfigured';

    return html`
      <div class="connection-card">
        <div class="connection-card__indicator ${indicatorClass}"></div>
        <div class="connection-card__info">
          <div class="connection-card__handle">
            ${cs?.handle ? `@${cs.handle}` : msg('No handle configured')}
          </div>
          <div class="connection-card__pds">${cs?.pds_url ?? 'https://bsky.social'}</div>
        </div>
        <span class="connection-card__status ${statusClass}">${statusLabel}</span>
        <button
          class="btn-test"
          ?disabled=${this._testingConnection}
          @click=${this._handleTestConnection}
        >
          ${this._testingConnection ? msg('Testing...') : msg('Test')}
        </button>
      </div>
    `;
  }

  // ── Tab Bar ──────────────────────────────────────────

  private _renderTabBar() {
    const tabs: {
      key: PanelTab;
      label: string;
      icon: ReturnType<typeof icons.antenna>;
      badge?: unknown;
    }[] = [
      {
        key: 'operations',
        label: msg('Operations'),
        icon: icons.antenna(13),
        badge:
          this._actionableCount > 0
            ? html`<span class="tab__badge">${this._actionableCount}</span>`
            : nothing,
      },
      {
        key: 'configure',
        label: msg('Configure'),
        icon: icons.gear(13),
      },
      {
        key: 'intelligence',
        label: msg('Intelligence'),
        icon: icons.radar(13),
      },
    ];

    return html`
      <div class="tab-bar">
        ${tabs.map(
          (t) => html`
          <button
            class="tab ${this._activeTab === t.key ? 'tab--active' : ''}"
            @click=${() => {
              this._activeTab = t.key;
            }}
          >
            ${t.icon}
            ${t.label}
            ${t.badge ?? nothing}
          </button>
        `,
        )}
      </div>
    `;
  }

  // ── Operations ───────────────────────────────────────

  private _renderOperations() {
    return html`
      <div>
        ${this._renderStatusBar()}
        ${
          this._loading
            ? html`<div class="loading-state">${msg('Scanning Bluesky relay channels...')}</div>`
            : this._renderDispatchList()
        }
      </div>
    `;
  }

  private _renderStatusBar() {
    const tabs: { key: StatusFilter; label: string }[] = [
      { key: 'all', label: msg('All') },
      { key: 'pending', label: msg('Pending') },
      { key: 'published', label: msg('Published') },
      { key: 'failed', label: msg('Failed') },
      { key: 'skipped', label: msg('Skipped') },
    ];

    return html`
      <div class="status-bar">
        ${tabs.map(
          (t) => html`
          <button
            class="status-tab ${this._statusFilter === t.key ? 'status-tab--active' : ''}"
            @click=${() => {
              this._statusFilter = t.key;
            }}
          >
            ${t.label}
            <span class="status-tab__count">
              ${t.key === 'all' ? this._queue.length : this._statusCount(t.key)}
            </span>
          </button>
        `,
        )}
        <span class="queue-total">
          ${msg(str`${this._filteredQueue.length} dispatches`)}
        </span>
      </div>
    `;
  }

  private _renderDispatchList() {
    const posts = this._filteredQueue;
    if (posts.length === 0) {
      return html`
        <div class="empty-state">
          ${msg('No Bluesky dispatches found. Approve Instagram posts to trigger cross-posting.')}
        </div>
      `;
    }

    return html`
      <div class="dispatch-list">
        ${posts.map((p) => this._renderDispatch(p))}
      </div>
    `;
  }

  private _renderDispatch(post: BlueskyQueueItem) {
    const badgeColor = STATUS_COLORS[post.status] ?? 'info';
    const disabled = this._actionInProgress === post.id;
    const hasImage = post.image_urls.length > 0;

    return html`
      <div class="dispatch dispatch--${post.status}">
        <div class="dispatch__thumb">
          ${
            hasImage
              ? html`<img src="${post.image_urls[0]}" alt="${post.alt_text ?? ''}" loading="lazy" />`
              : msg('N/A')
          }
        </div>

        <div class="dispatch__body">
          <div class="dispatch__header">
            <span class="dispatch__type-tag">${post.content_source_type}</span>
            ${
              post.simulation_name
                ? html`<span class="dispatch__shard">${post.simulation_name}</span>`
                : nothing
            }
            <span class="badge badge--${badgeColor}">${post.status}</span>
            <span class="dispatch__timestamp">
              ${
                post.status === 'published'
                  ? formatDateTimeShort(post.published_at)
                  : post.status === 'pending'
                    ? formatDateTimeShort(post.scheduled_at)
                    : formatDateTimeShort(post.created_at)
              }
            </span>
          </div>

          <div class="dispatch__caption">${post.caption}</div>

          ${
            post.status === 'published'
              ? html`
            <div class="dispatch__metrics">
              <span class="metric">${icons.sparkle(12)} ${this._formatNumber(post.likes_count)}</span>
              <span class="metric">${icons.messageCircle(12)} ${this._formatNumber(post.replies_count)}</span>
              <span class="metric metric--accent">${this._formatNumber(post.reposts_count)} ${msg('reposts')}</span>
              <span class="metric">${this._formatNumber(post.quotes_count)} ${msg('quotes')}</span>
            </div>
          `
              : nothing
          }

          ${
            post.failure_reason
              ? html`
            <div class="dispatch__failure">${post.failure_reason}</div>
          `
              : nothing
          }

          ${
            post.instagram_permalink
              ? html`
            <div class="dispatch__ig-link">
              ${icons.instagram(12)}
              <a href="${post.instagram_permalink}" target="_blank" rel="noopener">${msg('View on Instagram')}</a>
              ${post.instagram_status ? html` <span class="badge badge--${STATUS_COLORS[post.instagram_status] ?? 'info'}">${post.instagram_status}</span>` : nothing}
            </div>
          `
              : nothing
          }
        </div>

        <div class="dispatch__actions">
          ${
            post.status === 'pending'
              ? html`
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Publish')}
            </button>
            <button class="act act--skip" ?disabled=${disabled} @click=${() => this._handleSkip(post)}>
              ${msg('Skip')}
            </button>
          `
              : nothing
          }

          ${
            post.status === 'failed'
              ? html`
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Retry')}
            </button>
            <button class="act act--skip" ?disabled=${disabled} @click=${() => this._handleSkip(post)}>
              ${msg('Skip')}
            </button>
          `
              : nothing
          }

          ${
            post.status === 'skipped'
              ? html`
            <button class="act act--unskip" ?disabled=${disabled} @click=${() => this._handleUnskip(post)}>
              ${msg('Re-enable')}
            </button>
          `
              : nothing
          }

          ${
            post.status === 'published' && post.bsky_uri
              ? html`
            <a class="act act--link"
               href="https://bsky.app/profile/${this._connectionStatus?.handle ?? ''}/post/${post.bsky_uri.split('/').pop()}"
               target="_blank" rel="noopener">
              ${msg('View')}
            </a>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  // ── Configure ───────────────────────────────────────

  private _renderConfigureTab() {
    const enabled = this._settingBool('bluesky_enabled');
    const postingEnabled = this._settingBool('bluesky_posting_enabled');
    const autoCrosspost = this._settingBool('bluesky_auto_crosspost');

    return html`
      <div class="config-grid">
        <!-- Credentials Card -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.antenna(14)} ${msg('Credentials')}
            </div>
            <span class="config-card__status ${this._connectionStatus?.authenticated ? 'config-card__status--active' : 'config-card__status--inactive'}">
              ${this._connectionStatus?.authenticated ? msg('Connected') : msg('Disconnected')}
            </span>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('Handle')} ${renderInfoBubble(msg('Your Bluesky handle (e.g. bureau.bsky.social). This is the account that will publish Bureau dispatches. Create a dedicated account for the pipeline – do not use a personal account.'))}</div>
              <div class="config-row__desc">${msg('Bluesky account handle (e.g. bureau.bsky.social)')}</div>
            </div>
            <div class="config-input-group">
              <input
                class="config-input"
                type="text"
                .value=${this._handleDraft}
                placeholder="handle.bsky.social"
                aria-label=${msg('Bluesky Handle')}
                @input=${(e: InputEvent) => {
                  this._handleDraft = (e.target as HTMLInputElement).value;
                }}
              />
              <button
                class="config-save-btn"
                ?disabled=${this._savingKey === 'bluesky_handle'}
                @click=${() => void this._saveSetting('bluesky_handle', this._handleDraft)}
              >${this._savingKey === 'bluesky_handle' ? msg('Saving...') : msg('Save')}</button>
            </div>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('App Password')} ${renderInfoBubble(msg('App-specific password from bsky.app/settings/app-passwords. NOT your main account password. App passwords can be revoked individually without affecting your account. Stored encrypted at rest.'))}</div>
              <div class="config-row__desc">${msg('Generate at bsky.app/settings/app-passwords')}</div>
            </div>
            <div class="config-input-group">
              <input
                class="config-input config-input--password"
                type="password"
                .value=${this._passwordDraft}
                placeholder=${msg('Enter app password')}
                aria-label=${msg('Bluesky App Password')}
                @input=${(e: InputEvent) => {
                  this._passwordDraft = (e.target as HTMLInputElement).value;
                }}
              />
              <button
                class="config-save-btn"
                ?disabled=${this._savingKey === 'bluesky_app_password' || !this._passwordDraft}
                @click=${() => void this._saveSetting('bluesky_app_password', this._passwordDraft)}
              >${this._savingKey === 'bluesky_app_password' ? msg('Saving...') : msg('Save')}</button>
            </div>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('PDS URL')} ${renderInfoBubble(msg('AT Protocol Personal Data Server. Use https://bsky.social for the main Bluesky network. Only change this if you run a self-hosted PDS or use a different AT Protocol provider.'))}</div>
              <div class="config-row__desc">${msg('Personal Data Server (default: bsky.social)')}</div>
            </div>
            <div class="config-input-group">
              <input
                class="config-input"
                type="text"
                .value=${this._pdsDraft}
                placeholder="https://bsky.social"
                aria-label=${msg('Personal Data Server URL')}
                @input=${(e: InputEvent) => {
                  this._pdsDraft = (e.target as HTMLInputElement).value;
                }}
              />
              <button
                class="config-save-btn"
                ?disabled=${this._savingKey === 'bluesky_pds_url'}
                @click=${() => void this._saveSetting('bluesky_pds_url', this._pdsDraft)}
              >${this._savingKey === 'bluesky_pds_url' ? msg('Saving...') : msg('Save')}</button>
            </div>
          </div>
        </div>

        <!-- Pipeline Card -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.gear(14)} ${msg('Pipeline')}
            </div>
            <span class="config-card__status ${enabled ? 'config-card__status--active' : 'config-card__status--inactive'}">
              ${enabled ? msg('Active') : msg('Inactive')}
            </span>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('Bluesky Enabled')} ${renderInfoBubble(msg('Master switch for the entire Bluesky pipeline. When off, no posts are created or published – even if Auto Cross-Post is on. Turn this on after configuring Handle + App Password above.'))}</div>
              <div class="config-row__desc">${msg('Master switch for the Bluesky pipeline')}</div>
            </div>
            <button
              class="act ${enabled ? 'act--publish' : 'act--skip'}"
              ?disabled=${this._savingKey === 'bluesky_enabled'}
              @click=${() => void this._toggleSetting('bluesky_enabled')}
            >${enabled ? msg('On') : msg('Off')}</button>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('Posting Enabled')} ${renderInfoBubble(msg('When Off, the pipeline creates draft posts but does not actually publish them to Bluesky (dry-run mode). Use this to verify post quality before going live. When On, scheduled posts are published automatically.'))}</div>
              <div class="config-row__desc">${msg('Actually publish to Bluesky (vs dry-run mode)')}</div>
            </div>
            <button
              class="act ${postingEnabled ? 'act--publish' : 'act--skip'}"
              ?disabled=${this._savingKey === 'bluesky_posting_enabled'}
              @click=${() => void this._toggleSetting('bluesky_posting_enabled')}
            >${postingEnabled ? msg('On') : msg('Off')}</button>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">${msg('Auto Cross-Post')} ${renderInfoBubble(msg("When enabled, every Instagram post that gets published automatically creates a corresponding Bluesky post. The caption is reformatted for Bluesky (300 char limit with facets/links). Images are re-uploaded to Bluesky's blob store."))}</div>
              <div class="config-row__desc">${msg('Automatically create Bluesky posts from Instagram')}</div>
            </div>
            <button
              class="act ${autoCrosspost ? 'act--publish' : 'act--skip'}"
              ?disabled=${this._savingKey === 'bluesky_auto_crosspost'}
              @click=${() => void this._toggleSetting('bluesky_auto_crosspost')}
            >${autoCrosspost ? msg('On') : msg('Off')}</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Intelligence ─────────────────────────────────────

  private _renderIntelligence() {
    if (this._loading) {
      return html`<div class="loading-state">${msg('Loading intelligence...')}</div>`;
    }

    const a = this._analytics;
    if (!a) {
      return html`<div class="empty-state">${msg('No analytics data available.')}</div>`;
    }

    return html`
      <div class="intel-grid">
        <velg-metric-card
          label=${msg('Published')}
          value=${String(a.total_posts)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Pending')}
          value=${String(a.total_pending)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Failed')}
          value=${String(a.total_failed)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Skipped')}
          value=${String(a.total_skipped)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Avg Likes')}
          value=${String(a.avg_likes ?? '\u2014')}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Total Reposts')}
          value=${String(a.total_reposts ?? 0)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Total Replies')}
          value=${String(a.total_replies ?? 0)}
        ></velg-metric-card>
        <velg-metric-card
          label=${msg('Total Quotes')}
          value=${String(a.total_quotes ?? 0)}
        ></velg-metric-card>
      </div>

      ${
        a.engagement_by_type.length > 0
          ? html`
        <h3 style="font-family: var(--font-brutalist); text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--text-sm); margin-bottom: var(--space-3);">
          ${msg('By Content Type')}
        </h3>
        <div class="intel-grid">
          ${a.engagement_by_type.map(
            (e) => html`
            <velg-metric-card
              label=${e.content_type}
              value="${e.post_count} ${msg('posts')}"
              sublabel=${msg(str`avg ${e.avg_likes} likes`)}
            ></velg-metric-card>
          `,
          )}
        </div>
      `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-bluesky-tab': VelgAdminBlueskyTab;
  }
}
