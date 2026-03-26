import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FeaturePurchase } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { VelgToast } from '../shared/Toast.js';

type ExportCardState = 'idle' | 'processing' | 'done';

@localized()
@customElement('velg-chronicle-export')
export class VelgChronicleExport extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .export-panel {
      margin: var(--space-5) 0;
      padding: var(--space-5) var(--space-6);
      border-top: 3px solid var(--color-primary);
      border-bottom: 3px solid var(--color-primary);
      background: var(--color-surface-sunken);
      opacity: 0;
      animation: export-enter 400ms ease-out forwards;
    }

    @keyframes export-enter {
      to { opacity: 1; }
    }

    .export__header {
      text-align: center;
      margin-bottom: var(--space-5);
    }

    .export__rule {
      border: none;
      border-top: 1px solid var(--color-primary);
      margin: 0 0 var(--space-2);
    }

    .export__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-text-primary);
      margin: var(--space-2) 0 var(--space-1);
    }

    .export__subtitle {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.3em;
      color: var(--color-text-muted);
    }

    /* ── Card Grid ── */

    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      transition: border-color 0.2s;
    }

    .card:hover {
      border-color: var(--color-primary);
    }

    .card--processing {
      border-color: var(--color-accent-amber);
      animation: card-pulse 2s ease-in-out infinite;
    }

    @keyframes card-pulse {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: 0 0 8px var(--color-warning-glow); }
    }

    .card__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .card__desc {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      line-height: 1.6;
      color: var(--color-text-secondary);
      margin: 0;
      flex: 1;
    }

    .card__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
    }

    .card__cost--free {
      color: var(--color-success);
    }

    .card__cost--bypass {
      color: var(--color-success);
    }

    .card__btn {
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 40px;
      text-align: center;
    }

    .card__btn--authorize {
      color: var(--color-surface-sunken);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
    }

    .card__btn--authorize:hover:not(:disabled) {
      box-shadow: 0 0 10px var(--color-warning-glow);
    }

    .card__btn--free {
      color: var(--color-text-primary);
      background: transparent;
      border: 1px solid var(--color-primary);
    }

    .card__btn--free:hover {
      background: var(--color-primary);
      color: var(--color-text-inverse, white);
    }

    .card__btn--download {
      color: var(--color-success);
      background: transparent;
      border: 1px solid var(--color-success);
    }

    .card__btn--download:hover {
      background: var(--color-success);
      color: var(--color-surface-sunken);
    }

    .card__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .card__btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* Progress bar */
    .card__progress {
      height: 4px;
      background: var(--color-border);
      overflow: hidden;
    }

    .card__progress-bar {
      height: 100%;
      background: var(--color-accent-amber);
      transition: width 0.5s ease;
    }

    .card__status {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent-amber);
    }

    /* ── Export History ── */

    .history {
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-4);
    }

    .history__heading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
    }

    .history__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .history__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2);
      border: 1px solid var(--color-border-light);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
    }

    .history__type {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
      min-width: 100px;
    }

    .history__date {
      color: var(--color-text-muted);
      flex: 1;
    }

    .history__status {
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .history__status--completed {
      color: var(--color-success);
    }

    .history__status--processing {
      color: var(--color-accent-amber);
    }

    .history__status--failed {
      color: var(--color-danger);
    }

    .history__download {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-decoration: none;
      color: var(--color-success);
      border: 1px solid var(--color-success);
      transition: all 0.2s;
    }

    .history__download:hover {
      background: var(--color-success);
      color: var(--color-surface-sunken);
    }

    @media (prefers-reduced-motion: reduce) {
      .export-panel,
      .card--processing {
        animation: none;
        opacity: 1;
      }
    }

    @media (max-width: 600px) {
      .export-panel {
        padding: var(--space-4);
      }

      .cards {
        grid-template-columns: 1fr;
      }

      .history__item {
        flex-wrap: wrap;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _codexState: ExportCardState = 'idle';
  @state() private _hiresState: ExportCardState = 'idle';
  @state() private _prospectusState: ExportCardState = 'idle';
  @state() private _codexProgress = 0;
  @state() private _hiresProgress = 0;
  @state() private _codexDownloadUrl: string | null = null;
  @state() private _hiresDownloadUrl: string | null = null;
  @state() private _history: FeaturePurchase[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    void this._loadHistory();
  }

  private get _hasBypass(): boolean {
    return forgeStateManager.hasTokenBypass.value;
  }

  private get _balance(): number {
    return forgeStateManager.walletBalance.value;
  }

  private async _loadHistory(): Promise<void> {
    if (!this.simulationId) return;
    this._history = await forgeStateManager.loadFeaturePurchases(
      this.simulationId,
      'chronicle_export',
    );

    // Restore download state from completed purchases
    for (const p of this._history) {
      if (p.status !== 'completed') continue;
      const downloadUrl = (p.result as { download_url?: string })?.download_url ?? null;
      const exportType = (p.config as { export_type?: string })?.export_type;

      if (exportType === 'hires') {
        if (!this._hiresDownloadUrl && downloadUrl) {
          this._hiresDownloadUrl = downloadUrl;
          this._hiresState = 'done';
          this._hiresProgress = 100;
        }
      } else {
        // Legacy purchases without export_type default to codex
        if (!this._codexDownloadUrl && downloadUrl) {
          this._codexDownloadUrl = downloadUrl;
          this._codexState = 'done';
          this._codexProgress = 100;
        }
      }
    }
  }

  private async _purchaseExport(type: 'codex' | 'hires'): Promise<void> {
    if (type === 'codex') this._codexState = 'processing';
    else this._hiresState = 'processing';

    const purchaseId = await forgeStateManager.purchaseFeature(
      this.simulationId,
      'chronicle_export',
      { exportType: type },
    );

    if (!purchaseId) {
      VelgToast.error(forgeStateManager.error.value ?? msg('Export authorization failed.'));
      if (type === 'codex') this._codexState = 'idle';
      else this._hiresState = 'idle';
      return;
    }

    const result = await forgeStateManager.awaitFeatureCompletion(
      purchaseId,
      (p: FeaturePurchase) => {
        if (p.status === 'processing') {
          const elapsed = Date.now() - new Date(p.created_at).getTime();
          const progress = Math.min(95, Math.floor(elapsed / 600));
          if (type === 'codex') this._codexProgress = progress;
          else this._hiresProgress = progress;
        }
      },
    );

    if (result?.status === 'completed') {
      const downloadUrl = (result.result as { download_url?: string })?.download_url ?? null;
      if (type === 'codex') {
        this._codexState = 'done';
        this._codexProgress = 100;
        this._codexDownloadUrl = downloadUrl;
      } else {
        this._hiresState = 'done';
        this._hiresProgress = 100;
        this._hiresDownloadUrl = downloadUrl;
      }
      VelgToast.success(msg('Export complete. Download link available.'));
      void this._loadHistory();
    } else {
      if (type === 'codex') this._codexState = 'idle';
      else this._hiresState = 'idle';
      VelgToast.error(msg('Export failed. Tokens refunded.'));
    }
  }

  private _openDownload(url: string | null): void {
    if (url) window.open(url, '_blank');
  }

  private _generateProspectus(): void {
    this._prospectusState = 'done';
    const url = `${window.location.origin}/simulations/${this.simulationId}`;
    void navigator.clipboard.writeText(url);
    VelgToast.success(msg('Public URL copied to clipboard.'));
  }

  protected render() {
    return html`
      <div class="export-panel" role="region" aria-label=${msg('Chronicle export services')}>
        <div class="export__header">
          <hr class="export__rule" />
          <h3 class="export__title">${msg('Chronicle Printing Press')}</h3>
          <p class="export__subtitle">${msg('Bureau-Authorized Export Services')}</p>
          <hr class="export__rule" />
        </div>

        <div class="cards">
          ${this._renderCodexCard()}
          ${this._renderHiresCard()}
          ${this._renderProspectusCard()}
        </div>

        ${this._history.length > 0 ? this._renderHistory() : nothing}
      </div>
    `;
  }

  private _renderCodexCard() {
    const canAfford = this._hasBypass || this._balance >= 1;

    return html`
      <div class="card ${this._codexState === 'processing' ? 'card--processing' : ''}">
        <h4 class="card__title">${msg('CODEX PDF')}</h4>
        <p class="card__desc">
          ${msg('Full simulation codex: agents, buildings, lore, and maps. Bureau-formatted PDF with theme colors.')}
        </p>

        ${
          this._codexState === 'processing'
            ? html`
            <div class="card__progress">
              <div class="card__progress-bar" style="width: ${this._codexProgress}%"></div>
            </div>
            <span class="card__status">${msg('PRINTING IN PROGRESS...')} ${this._codexProgress}%</span>
          `
            : this._codexState === 'done'
              ? html`
              <button class="card__btn card__btn--download"
                @click=${() => this._openDownload(this._codexDownloadUrl)}
              >${msg('DOWNLOAD')}</button>
            `
              : html`
              <p class="card__cost ${this._hasBypass ? 'card__cost--bypass' : ''}">
                ${this._hasBypass ? msg('NO COST') : msg('1 FT')}
              </p>
              <button
                class="card__btn card__btn--authorize"
                ?disabled=${!canAfford}
                @click=${() => this._purchaseExport('codex')}
              >
                ${msg('AUTHORIZE')}
              </button>
            `
        }
      </div>
    `;
  }

  private _renderHiresCard() {
    const canAfford = this._hasBypass || this._balance >= 1;

    return html`
      <div class="card ${this._hiresState === 'processing' ? 'card--processing' : ''}">
        <h4 class="card__title">${msg('FULL-RES ARCHIVE')}</h4>
        <p class="card__desc">
          ${msg('All simulation images at full native resolution. Organized ZIP archive: agents, buildings, lore, and banner.')}
        </p>

        ${
          this._hiresState === 'processing'
            ? html`
            <div class="card__progress">
              <div class="card__progress-bar" style="width: ${this._hiresProgress}%"></div>
            </div>
            <span class="card__status">${msg('ARCHIVING IN PROGRESS...')} ${this._hiresProgress}%</span>
          `
            : this._hiresState === 'done'
              ? html`
              <button class="card__btn card__btn--download"
                @click=${() => this._openDownload(this._hiresDownloadUrl)}
              >${msg('DOWNLOAD')}</button>
            `
              : html`
              <p class="card__cost ${this._hasBypass ? 'card__cost--bypass' : ''}">
                ${this._hasBypass ? msg('NO COST') : msg('1 FT')}
              </p>
              <button
                class="card__btn card__btn--authorize"
                ?disabled=${!canAfford}
                @click=${() => this._purchaseExport('hires')}
              >
                ${msg('AUTHORIZE')}
              </button>
            `
        }
      </div>
    `;
  }

  private _renderProspectusCard() {
    return html`
      <div class="card">
        <h4 class="card__title">${msg('PUBLIC PROSPECTUS')}</h4>
        <p class="card__desc">
          ${msg('Shareable URL with Open Graph tags. Preview how your simulation appears on social media.')}
        </p>
        <p class="card__cost card__cost--free">${msg('FREE')}</p>

        ${
          this._prospectusState === 'done'
            ? html`<button class="card__btn card__btn--download" @click=${this._generateProspectus}>
              ${msg('COPY URL AGAIN')}
            </button>`
            : html`<button class="card__btn card__btn--free" @click=${this._generateProspectus}>
              ${msg('GENERATE')}
            </button>`
        }
      </div>
    `;
  }

  private _getExportTypeLabel(p: FeaturePurchase): string {
    const exportType = (p.config as { export_type?: string })?.export_type;
    if (exportType === 'hires') return msg('FULL-RES ARCHIVE');
    return msg('CODEX PDF');
  }

  private _localizeStatus(status: string): string {
    switch (status) {
      case 'completed':
        return msg('completed');
      case 'processing':
        return msg('processing');
      case 'failed':
        return msg('failed');
      default:
        return status;
    }
  }

  private _renderHistory() {
    return html`
      <div class="history">
        <h4 class="history__heading">${msg('Previous Exports')}</h4>
        <ul class="history__list">
          ${this._history.map((p) => {
            const downloadUrl = (p.result as { download_url?: string })?.download_url;
            return html`
              <li class="history__item">
                <span class="history__type">${this._getExportTypeLabel(p)}</span>
                <span class="history__date">${new Date(p.created_at).toLocaleDateString(localeService.currentLocale === 'de' ? 'de-DE' : 'en-GB')}</span>
                <span class="history__status history__status--${p.status}">${this._localizeStatus(p.status)}</span>
                ${
                  p.status === 'completed' && downloadUrl
                    ? html`<a class="history__download"
                      href=${downloadUrl} target="_blank" rel="noopener"
                    >${msg('DOWNLOAD')}</a>`
                    : nothing
                }
              </li>
            `;
          })}
        </ul>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chronicle-export': VelgChronicleExport;
  }
}
