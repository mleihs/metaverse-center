/**
 * VelgAttunementPanel — the Attunements tab of the Resonance Journal.
 *
 * Three-column locked/unlocked catalog. Each attunement is a leaf card
 * with a left amber accent bar; unlocked cards wear full amber and
 * show description + unlock provenance, locked cards wear muted
 * Courier with the description replaced by an italic prose line
 * ("The way to this attunement is not yet known"). No progress bar,
 * no "X / Y unlocked" counter — Principle 9 forbids progress
 * framing; the catalog is an invitation, not a checklist.
 *
 * Load-bearing choices:
 *
 *   1. One endpoint, one round trip. GET /journal/attunements returns
 *      the catalog enriched with per-user unlock state in a single
 *      shot (P3 backend). The panel doesn't second-fetch unlocks —
 *      everything the UI needs is already in the response.
 *
 *   2. Unlocked-first sort happens in the component, not the API. The
 *      API returns seeded order; the panel re-sorts unlocked-to-top
 *      so a user's history reads left-to-right before the invitations.
 *
 *   3. Microanimations on unlock state only. Cards cascade in via a
 *      staggered entrance on tab open (Principle 12's "sparse and
 *      dense are equal states" still applies — the cascade is short
 *      and soft). Locked cards have a faint amber glow that pulses
 *      every 8s at 4% opacity — the faint-as-hint echo of
 *      "invitation" without turning into marketing.
 *
 *   4. Leaf-only transforms. The cascade animation runs on inner
 *      `.card` elements, not the grid container — CLAUDE.md forbids
 *      `transform` on layout containers.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { journalApi } from '../../services/api/index.js';
import type {
  AttunementCatalogEntry,
  AttunementSystemHook,
} from '../../services/api/JournalApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import '../shared/EmptyState.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';

const SYSTEM_HOOK_LABEL: Record<AttunementSystemHook, () => string> = {
  dungeon_option: () => msg('Dungeon'),
  epoch_option: () => msg('Epoch'),
  simulation_option: () => msg('Simulation'),
};

@localized()
@customElement('velg-attunement-panel')
export class VelgAttunementPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-6) var(--space-6) var(--space-12);
      max-width: var(--container-2xl);
      margin: 0 auto;
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_rule: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-border));
    }

    .header {
      padding-bottom: var(--space-4);
      margin-bottom: var(--space-6);
      border-bottom: 1px solid var(--_rule);
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-size: clamp(var(--text-xl), 2.5vw, var(--text-2xl));
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
    }

    .header__sub {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
      max-width: 56ch;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-width, 320px), 1fr));
      gap: var(--space-5);
    }

    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }
    }

    .card {
      position: relative;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-border);
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-height: 220px;
      opacity: 0;
      transform: translateY(8px);
      /* Staggered cascade on mount. --i is set per card below. */
      animation: card-in var(--duration-entrance) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade));
      transition:
        border-color var(--transition-normal),
        box-shadow var(--transition-normal);
    }

    @keyframes card-in {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .card--unlocked {
      border-left-color: var(--_accent);
      background: color-mix(in srgb, var(--_accent) 4%, var(--color-surface-raised));
      box-shadow: var(--shadow-sm);
    }

    .card--unlocked:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--_accent-dim);
    }

    .card--locked {
      /* A very faint 8s amber breath — invitation, not advertisement.
         Runs on the leaf card only, never the grid container. */
      animation:
        card-in var(--duration-entrance) var(--ease-out) both,
        card-breathe 8s ease-in-out infinite alternate 600ms;
      animation-delay:
        calc(var(--i, 0) * var(--duration-cascade)),
        calc(var(--i, 0) * var(--duration-cascade) + 600ms);
    }

    @keyframes card-breathe {
      0% {
        border-left-color: var(--color-border);
      }
      100% {
        border-left-color: color-mix(in srgb, var(--_accent) 25%, var(--color-border));
      }
    }

    .card__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .card__hook {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin: 0;
    }

    .card--unlocked .card__hook {
      color: color-mix(in srgb, var(--_accent) 80%, var(--color-text-muted));
    }

    .card__state {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin: 0;
    }

    .card--unlocked .card__state {
      color: var(--_accent);
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-md);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
      margin: 0;
    }

    .card--locked .card__name {
      color: var(--color-text-secondary);
    }

    .card__description {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: color-mix(in srgb, var(--color-text-primary) 85%, transparent);
      margin: 0;
      flex: 1;
    }

    .card__locked-note {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin: 0;
      flex: 1;
    }

    .card__meta {
      padding-top: var(--space-2);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .card,
      .card--locked {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _entries: AttunementCatalogEntry[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await journalApi.listAttunements();
      if (!resp.success) {
        this._error = resp.error.message || msg('Could not load attunements.');
        return;
      }
      this._entries = resp.data;
    } catch (err) {
      captureError(err, { source: 'VelgAttunementPanel._load' });
      this._error = msg('Could not load attunements.');
    } finally {
      this._loading = false;
    }
  }

  private _sorted(): AttunementCatalogEntry[] {
    // Unlocked first, then locked. Within each group keep the server's
    // seeded order (already applied by the list_catalog query).
    const unlocked = this._entries.filter((e) => e.unlocked);
    const locked = this._entries.filter((e) => !e.unlocked);
    return [...unlocked, ...locked];
  }

  private _nameOf(entry: AttunementCatalogEntry): string {
    return localeService.currentLocale === 'de' ? entry.name_de : entry.name_en;
  }

  private _descriptionOf(entry: AttunementCatalogEntry): string {
    return localeService.currentLocale === 'de' ? entry.description_de : entry.description_en;
  }

  private _formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(localeService.currentLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (err) {
      captureError(err, { source: 'VelgAttunementPanel._formatDate' });
      return iso;
    }
  }

  private _renderCard(entry: AttunementCatalogEntry, index: number) {
    const unlocked = entry.unlocked;
    const classes = ['card', unlocked ? 'card--unlocked' : 'card--locked'].join(' ');
    const name = this._nameOf(entry);
    const ariaLabel = unlocked
      ? `${msg('Unlocked attunement')}: ${name}`
      : `${msg('Locked attunement')}: ${name}`;
    return html`
      <article
        class=${classes}
        style=${`--i: ${index}`}
        role="listitem"
        aria-label=${ariaLabel}
      >
        <div class="card__header">
          <p class="card__hook">${SYSTEM_HOOK_LABEL[entry.system_hook]()}</p>
          <p class="card__state">
            ${unlocked ? msg('Awakened') : msg('Unmet')}
          </p>
        </div>
        <h3 class="card__name">${this._nameOf(entry)}</h3>
        ${
          unlocked
            ? html`<p class="card__description">${this._descriptionOf(entry)}</p>`
            : html`<p class="card__locked-note">
              ${msg('The way to this attunement is not yet known.')}
            </p>`
        }
        ${
          unlocked && entry.unlocked_at
            ? html`<p class="card__meta">
              ${msg('Since')} ${this._formatDate(entry.unlocked_at)}
            </p>`
            : ''
        }
      </article>
    `;
  }

  protected render() {
    if (this._loading) return html`<velg-loading-state></velg-loading-state>`;
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${this._load}
      ></velg-error-state>`;
    }
    if (this._entries.length === 0) {
      return html`<velg-empty-state
        message=${msg('No attunements are seeded yet.')}
      ></velg-empty-state>`;
    }
    const sorted = this._sorted();
    return html`
      <header class="header">
        <h2 class="header__title">${msg('Attunements')}</h2>
        <p class="header__sub">
          ${msg('Crystallized constellations awaken patterns you can bring into the world.')}
        </p>
      </header>
      <div class="grid" role="list">
        ${sorted.map((entry, index) => this._renderCard(entry, index))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-attunement-panel': VelgAttunementPanel;
  }
}
