/**
 * VelgDriftLogbook — the traveller's own record, and the reason coming back is free.
 *
 * A run is a session; the logbook is a career. It survives the run that wrote it (the
 * server keeps the rows when the run is gone — knowledge is the only thing a Havarie
 * cannot scatter), and it is the answer to the question every returning player asks
 * first: *where was I, and what do I know?*
 *
 * Deliberately a collapsed strip, not a panel: it is a reference, not a task. It opens
 * where the traveller is, never in a modal that has to be dismissed before they can play.
 *
 * Each kind gets its own glyph and tone so the strip can be SKIMMED — a column of rumours
 * reads differently from a column of Havarien at a glance, which is what a log is for.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DriftLogEntry } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';

@localized()
@customElement('velg-drift-logbook')
export class VelgDriftLogbook extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .book {
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
    }

    .book__toggle {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: 34px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      transition: color var(--transition-fast);
    }

    .book__toggle:hover {
      color: var(--color-text-primary);
    }

    .book__toggle:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .book__count {
      margin-left: auto;
      font-family: var(--font-mono);
      color: var(--color-text-quiet);
    }

    .book__chevron {
      display: inline-flex;
      transition: transform var(--transition-normal);
    }

    .book__chevron--open {
      transform: rotate(180deg);
    }

    .entries {
      max-height: 220px;
      overflow-y: auto;
      border-top: var(--border-width-thin) dashed var(--color-border);
    }

    .entry {
      display: grid;
      grid-template-columns: 16px 1fr auto;
      align-items: start;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
      animation: entry-in 200ms var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 30ms);
    }

    .entry:last-child {
      border-bottom: none;
    }

    .entry__icon {
      display: inline-flex;
      color: var(--_tone, var(--color-text-muted));
    }

    .entry__text {
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      line-height: var(--leading-snug);
      color: var(--color-text-secondary);
    }

    .entry__takt {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      white-space: nowrap;
    }

    .empty {
      padding: var(--space-3);
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      color: var(--color-text-quiet);
    }

    @keyframes entry-in {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @media (max-width: 640px) {
      .book__toggle {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .entry,
      .book__chevron {
        animation: none;
        transition: none;
      }
    }
  `;

  @property({ attribute: false }) entries: DriftLogEntry[] = [];

  @state() private _open = false;

  private _toggle(): void {
    this._open = !this._open;
  }

  /** One line, in the Bureau's voice. The payload is the server's record; this turns it
   *  into a sentence a human reads in one pass. */
  private _line(entry: DriftLogEntry): string {
    const p = entry.payload;
    switch (entry.kind) {
      case 'signal': {
        const prose = p.prose as { title_de?: string } | undefined;
        const title = prose?.title_de ?? String(p.template_key ?? '');
        const check = p.check as { success?: boolean } | undefined;
        if (check) {
          return check.success ? msg(str`${title} · bestanden`) : msg(str`${title} · misslungen`);
        }
        return title;
      }
      case 'rumor':
        return msg('Ein Knoten ist aus dem Nebel gefallen. Das Logbuch weiß, wo er liegt.');
      case 'bank':
        return msg(
          str`Funkboje: ${Number(p.safe ?? 0)} von ${Number(p.loose ?? 0)} Punkten gesendet.`,
        );
      case 'sondierung':
        return p.bust
          ? msg(str`Resonanzriss. ${Number(p.forfeited ?? 0)} Punkte im Knoten geblieben.`)
          : msg(str`Sondiert. Ertrag ${Number(p.yield ?? 0)}.`);
      case 'havarie':
        return typeof p.choice === 'string'
          ? msg(str`Havarie entschieden: ${String(p.choice)}.`)
          : msg('Havarie. Die Fahrt stand still.');
      default:
        return entry.kind;
    }
  }

  private _icon(entry: DriftLogEntry) {
    switch (entry.kind) {
      case 'rumor':
        return icons.search(14);
      case 'bank':
        return icons.upload(14);
      case 'havarie':
        return icons.stampClassified(14);
      default:
        return icons.book(14);
    }
  }

  private _tone(entry: DriftLogEntry): string {
    if (entry.kind === 'havarie') return 'var(--color-danger)';
    if (entry.kind === 'bank') return 'var(--color-success)';
    if (entry.kind === 'rumor') return 'var(--color-info)';
    if (entry.kind === 'sondierung' && entry.payload.bust) return 'var(--color-danger)';
    return 'var(--color-text-muted)';
  }

  protected render() {
    return html`
      <div class="book">
        <button
          class="book__toggle"
          aria-expanded=${this._open}
          @click=${this._toggle}
        >
          ${icons.book(14)}
          <span>${msg('Logbuch')}</span>
          <span class="book__count">${this.entries.length}</span>
          <span class="book__chevron ${this._open ? 'book__chevron--open' : ''}">
            ${icons.chevronDown(12)}
          </span>
        </button>

        ${
          this._open
            ? this.entries.length
              ? html`<div class="entries">
                  ${this.entries.map(
                    (entry, i) => html`<div
                      class="entry"
                      style="--i:${i}; --_tone:${this._tone(entry)}"
                    >
                      <span class="entry__icon">${this._icon(entry)}</span>
                      <span class="entry__text">${this._line(entry)}</span>
                      <span class="entry__takt">${msg(str`T${entry.takt}`)}</span>
                    </div>`,
                  )}
                </div>`
              : html`<p class="empty">
                  ${msg('Noch nichts verzeichnet. Der Zwischenraum hat dir noch nichts erzählt.')}
                </p>`
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-logbook': VelgDriftLogbook;
  }
}
