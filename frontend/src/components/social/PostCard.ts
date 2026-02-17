import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SocialMediaPost } from '../../types/index.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-post-card')
export class VelgPostCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .card {
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md); display: flex; flex-direction: column;
      transition: all var(--transition-fast);
    }
    .card:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
    .card__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-4); background: var(--color-surface-header);
      border-bottom: var(--border-medium);
    }
    .card__author { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: var(--tracking-brutalist); }
    .card__date { font-size: var(--text-xs); color: var(--color-text-secondary); }
    .card__body { padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
    .card__message { font-size: var(--text-sm); line-height: var(--leading-relaxed); max-height: 80px; overflow: hidden; text-overflow: ellipsis; }
    .card__transformed { padding: var(--space-2); background: var(--color-primary-bg); border-left: 3px solid var(--color-primary); font-size: var(--text-sm); font-style: italic; max-height: 60px; overflow: hidden; }
    .card__badges { display: flex; flex-wrap: wrap; gap: var(--space-1-5); }
    .card__actions { display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-4) var(--space-3); margin-top: auto; }
    .card__action-btn {
      padding: var(--space-1-5) var(--space-3); font-family: var(--font-brutalist);
      font-weight: var(--font-bold); font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-wide); background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer; color: var(--color-text-secondary); transition: all var(--transition-fast);
    }
    .card__action-btn:hover { background: var(--color-surface-sunken); color: var(--color-text-primary); }
  `;

  @property({ type: Object }) post!: SocialMediaPost;

  private _formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  private _handleTransform(): void {
    this.dispatchEvent(
      new CustomEvent('post-transform', { detail: this.post, bubbles: true, composed: true }),
    );
  }

  private _handleAnalyze(): void {
    this.dispatchEvent(
      new CustomEvent('post-analyze', { detail: this.post, bubbles: true, composed: true }),
    );
  }

  protected render() {
    const p = this.post;
    if (!p) return html``;

    return html`
      <div class="card">
        <div class="card__header">
          <span class="card__author">${p.author || msg('Unknown')}</span>
          <span class="card__date">${this._formatDate(p.source_created_at)}</span>
        </div>
        <div class="card__body">
          ${p.message ? html`<div class="card__message">${p.message}</div>` : ''}
          ${p.transformed_content ? html`<div class="card__transformed">${p.transformed_content}</div>` : ''}
          <div class="card__badges">
            <velg-badge variant="primary">${p.platform}</velg-badge>
            ${p.transformed_content ? html`<velg-badge variant="success">${p.transformation_type || msg('Transformed')}</velg-badge>` : ''}
          </div>
        </div>
        <div class="card__actions">
          <button class="card__action-btn" @click=${this._handleTransform}>${msg('Transform')}</button>
          <button class="card__action-btn" @click=${this._handleAnalyze}>${msg('Sentiment')}</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-post-card': VelgPostCard;
  }
}
