/**
 * VelgWhisperCard — displays a single whisper from a bonded agent.
 *
 * Aesthetic: intercepted signal on faded paper. Prose font for the
 * whisper body, brutalist label for the type badge. Unread whispers
 * have a subtle amber left-border glow that fades on read.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { Whisper } from '../../services/api/BondsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';

const TYPE_LABELS: Record<string, () => string> = {
  state: () => msg('State'),
  event: () => msg('Event'),
  memory: () => msg('Memory'),
  question: () => msg('Request'),
  reflection: () => msg('Reflection'),
};

@localized()
@customElement('velg-whisper-card')
export class VelgWhisperCard extends LitElement {
  static styles = css`
    :host {
      --_glow: color-mix(in srgb, var(--color-primary) 25%, transparent);
      --_border-read: var(--color-border-light);
      --_border-unread: var(--color-primary);
      display: block;
    }

    .whisper {
      padding: var(--space-4) var(--space-5);
      border-left: 3px solid var(--_border-read);
      background: var(--color-surface);
      transition: border-color var(--transition-slow),
        box-shadow var(--transition-slow);
      opacity: 0;
      animation: whisper-in var(--duration-entrance) var(--ease-dramatic)
        calc(var(--i, 0) * var(--duration-stagger)) forwards;
    }

    .whisper--unread {
      border-left-color: var(--_border-unread);
      box-shadow: inset 4px 0 8px -4px var(--_glow);
    }

    .whisper__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-2);
    }

    .whisper__type {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .whisper__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .whisper__body {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }

    .whisper__actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-3);
    }

    .whisper__action {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      background: none;
      border: 1px dashed var(--color-border);
      padding: var(--space-1) var(--space-3);
      cursor: pointer;
      transition: color var(--transition-fast),
        border-color var(--transition-fast);
      min-height: 32px;
    }

    .whisper__action:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .whisper__action:focus-visible {
      outline: var(--ring-focus);
    }

    .whisper__action--acted {
      color: var(--color-success);
      border-color: var(--color-success-border);
      cursor: default;
    }

    @keyframes whisper-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .whisper {
        animation: none;
        opacity: 1;
      }
    }
  `;

  @property({ type: Object }) whisper!: Whisper;

  private get _locale(): string {
    return localeService.currentLocale;
  }

  private get _content(): string {
    return this._locale === 'de'
      ? this.whisper.content_de
      : this.whisper.content_en;
  }

  private get _isUnread(): boolean {
    return !this.whisper.read_at;
  }

  private _formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return msg('just now');
    if (hours < 24) return msg(`${hours}h ago`);
    const days = Math.floor(hours / 24);
    if (days === 1) return msg('yesterday');
    return msg(`${days}d ago`);
  }

  protected render() {
    const w = this.whisper;
    const typeLabel = TYPE_LABELS[w.whisper_type]?.() ?? w.whisper_type;

    return html`
      <article
        class="whisper ${this._isUnread ? 'whisper--unread' : ''}"
        role="article"
        aria-label="${typeLabel}"
      >
        <div class="whisper__header">
          <span class="whisper__type">${typeLabel}</span>
          <time class="whisper__time" datetime="${w.created_at}">
            ${this._formatTime(w.created_at)}
          </time>
        </div>
        <p class="whisper__body">${this._content}</p>
        ${w.whisper_type === 'question' && !w.acted_on
          ? html`
              <div class="whisper__actions">
                <button
                  class="whisper__action"
                  @click=${this._handleActed}
                  aria-label=${msg('Mark as addressed')}
                >
                  ${msg('Addressed')}
                </button>
              </div>
            `
          : w.acted_on
            ? html`
                <div class="whisper__actions">
                  <span class="whisper__action whisper__action--acted">
                    ${msg('Addressed')}
                  </span>
                </div>
              `
            : ''}
      </article>
    `;
  }

  private _handleActed() {
    this.dispatchEvent(
      new CustomEvent('whisper-acted', {
        bubbles: true,
        composed: true,
        detail: { whisperId: this.whisper.id, bondId: this.whisper.bond_id },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-whisper-card': VelgWhisperCard;
  }
}
