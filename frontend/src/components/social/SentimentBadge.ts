import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-sentiment-badge')
export class VelgSentimentBadge extends LitElement {
  static styles = css`
    :host { display: inline-flex; }
    .badge {
      display: inline-flex; align-items: center; padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-wide);
      border: var(--border-width-default) solid var(--color-border);
    }
    .badge--positive { background: var(--color-success-bg); border-color: var(--color-success); color: var(--color-success); }
    .badge--negative { background: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger); }
    .badge--neutral { background: var(--color-info-bg); border-color: var(--color-info); color: var(--color-info); }
    .badge--unknown { background: var(--color-surface-header); color: var(--color-text-secondary); }
  `;

  @property({ type: String }) sentiment: string | null = null;

  private _getClass(): string {
    switch (this.sentiment) {
      case 'positive':
        return 'badge--positive';
      case 'negative':
        return 'badge--negative';
      case 'neutral':
        return 'badge--neutral';
      default:
        return 'badge--unknown';
    }
  }

  protected render() {
    return html`<span class="badge ${this._getClass()}">${this.sentiment || msg('Unknown')}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-sentiment-badge': VelgSentimentBadge;
  }
}
