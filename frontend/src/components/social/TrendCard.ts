import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SocialTrend } from '../../types/index.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-trend-card')
export class VelgTrendCard extends LitElement {
  static styles = css`
    :host { display: block; }

    .card {
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md); display: flex; flex-direction: column;
      transition: all var(--transition-fast);
    }

    .card:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }

    .card__header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-2); padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header); border-bottom: var(--border-medium);
    }

    .card__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-md); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
    }

    .card__body { padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }

    .card__badges { display: flex; flex-wrap: wrap; gap: var(--space-1-5); }

    .card__meta { display: flex; flex-direction: column; gap: var(--space-1); }
    .card__meta-item { display: flex; align-items: center; gap: var(--space-1-5); font-size: var(--text-sm); color: var(--color-text-secondary); }

    .card__abstract {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      line-height: 1.5; display: -webkit-box;
      -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }

    .card__url { font-size: var(--text-sm); color: var(--color-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .card__url:hover { text-decoration: underline; }

    .card__actions {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3); margin-top: auto;
    }

    .card__action-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--space-1); padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-wide);
      background: transparent; border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer; color: var(--color-text-secondary); transition: all var(--transition-fast);
    }

    .card__action-btn:hover { background: var(--color-surface-sunken); color: var(--color-text-primary); }
    .card__action-btn--primary:hover { background: var(--color-primary-bg); color: var(--color-primary); border-color: var(--color-primary); }
  `;

  @property({ type: Object }) trend!: SocialTrend;
  @property({ type: String }) simulationId = '';

  private _getAbstract(): string {
    const raw = this.trend.raw_data as Record<string, string> | undefined;
    const text = raw?.trail_text || raw?.description || '';
    return text.replace(/<[^>]*>/g, '');
  }

  private _getSentimentVariant(): string {
    switch (this.trend.sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'danger';
      default:
        return 'info';
    }
  }

  private _handleTransform(): void {
    this.dispatchEvent(
      new CustomEvent('trend-transform', { detail: this.trend, bubbles: true, composed: true }),
    );
  }

  private _handleIntegrate(): void {
    this.dispatchEvent(
      new CustomEvent('trend-integrate', { detail: this.trend, bubbles: true, composed: true }),
    );
  }

  protected render() {
    const t = this.trend;
    if (!t) return html``;

    return html`
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">${t.name}</h3>
        </div>
        <div class="card__body">
          <div class="card__badges">
            <velg-badge variant="primary">${t.platform}</velg-badge>
            ${t.sentiment ? html`<velg-badge variant=${this._getSentimentVariant()}>${t.sentiment}</velg-badge>` : ''}
            ${t.is_processed ? html`<velg-badge variant="warning">${msg('Processed')}</velg-badge>` : ''}
          </div>
          ${this._getAbstract() ? html`<p class="card__abstract">${this._getAbstract()}</p>` : ''}
          <div class="card__meta">
            ${t.volume ? html`<span class="card__meta-item">${msg(str`Volume: ${t.volume}`)}</span>` : ''}
            ${t.relevance_score != null ? html`<span class="card__meta-item">${msg(str`Relevance: ${t.relevance_score}/10`)}</span>` : ''}
          </div>
          ${t.url ? html`<a class="card__url" href=${t.url} target="_blank" rel="noopener">${t.url}</a>` : ''}
        </div>
        <div class="card__actions">
          <button class="card__action-btn card__action-btn--primary" @click=${this._handleTransform}>${msg('Transform')}</button>
          <button class="card__action-btn" @click=${this._handleIntegrate}>${msg('Integrate')}</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-trend-card': VelgTrendCard;
  }
}
