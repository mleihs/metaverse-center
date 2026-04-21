/**
 * VelgResonanceJournal — the /journal view shell.
 *
 * User-global surface (AD-5): fragments span all the user's simulations,
 * the Palimpsest reflects on the full arc, constellations are composed
 * from everything. The shell hosts three tabs; P0 ships only the
 * Fragments tab as functional content, with the others rendering a
 * restrained "still forming" marker that fits the journal's voice
 * (no "Coming Soon" banner chrome).
 *
 * Design-direction principles load-bearing on this shell:
 *  - Principle 9: no progress, no completion. The tabs for
 *    Constellations / Palimpsest surface future depth without
 *    promising a release date.
 *  - Principle 11: the margin is first-class. The header carries a
 *    lore strap-line in the bureau-archives register so the feature
 *    reads as diegetic.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type JournalTabKey = 'fragments' | 'constellations' | 'palimpsest';

import './VelgFragmentGrid.js';

@localized()
@customElement('velg-resonance-journal')
export class VelgResonanceJournal extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-6) var(--space-6) var(--space-12);
      max-width: var(--container-2xl);
      margin: 0 auto;
      --_accent: var(--color-accent-amber);
      --_rule: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-border));
    }

    .hero {
      padding-bottom: var(--space-6);
      margin-bottom: var(--space-6);
      border-bottom: 1px solid var(--_rule);
    }

    .hero__eyebrow {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .hero__title {
      font-family: var(--font-brutalist);
      font-size: clamp(var(--text-2xl), 4vw, var(--text-4xl));
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-3);
      line-height: var(--leading-tight);
    }

    .hero__strap {
      font-family: var(--font-prose);
      font-size: var(--text-md);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      max-width: 58ch;
      margin: 0;
    }

    .tabs {
      display: flex;
      gap: var(--space-1);
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
    }

    .tab {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--color-text-muted);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      min-height: 44px;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .tab:hover:not([disabled]) {
      color: var(--color-text-secondary);
    }

    .tab:focus-visible {
      outline: var(--ring-focus);
      outline-offset: -2px;
    }

    .tab[aria-selected='true'] {
      color: var(--_accent);
      border-bottom-color: var(--_accent);
    }

    .tab[disabled] {
      color: var(--color-text-muted);
      opacity: 0.55;
      cursor: default;
    }

    .tab__sublabel {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      opacity: 0.6;
      margin-left: var(--space-2);
    }

    .panel {
      animation: panel-in var(--duration-entrance) var(--ease-dramatic) forwards;
    }

    .panel__note {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      max-width: 52ch;
      margin: 0 auto;
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    @keyframes panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--space-4) var(--space-4) var(--space-10);
      }

      .tab {
        padding: var(--space-2) var(--space-3);
      }
    }
  `;

  @state() private _activeTab: JournalTabKey = 'fragments';

  private _selectTab(tab: JournalTabKey): void {
    if (tab === 'fragments') {
      this._activeTab = tab;
    }
    // Constellations + Palimpsest are disabled for P0; selection ignored.
  }

  private _renderTabs() {
    const tabs: { key: JournalTabKey; label: string; disabled: boolean; sublabel?: string }[] = [
      { key: 'fragments', label: msg('Fragments'), disabled: false },
      {
        key: 'constellations',
        label: msg('Constellations'),
        disabled: true,
        sublabel: msg('forming'),
      },
      {
        key: 'palimpsest',
        label: msg('Palimpsest'),
        disabled: true,
        sublabel: msg('unwritten'),
      },
    ];

    return html`
      <div class="tabs" role="tablist" aria-label=${msg('Journal sections')}>
        ${tabs.map(
          (tab) => html`
            <button
              type="button"
              class="tab"
              role="tab"
              aria-selected=${this._activeTab === tab.key ? 'true' : 'false'}
              aria-controls=${`panel-${tab.key}`}
              id=${`tab-${tab.key}`}
              ?disabled=${tab.disabled}
              @click=${() => this._selectTab(tab.key)}
            >
              ${tab.label}
              ${tab.sublabel ? html`<span class="tab__sublabel">(${tab.sublabel})</span>` : ''}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderActivePanel() {
    if (this._activeTab === 'fragments') {
      return html`
        <section
          class="panel"
          role="tabpanel"
          id="panel-fragments"
          aria-labelledby="tab-fragments"
        >
          <velg-fragment-grid></velg-fragment-grid>
        </section>
      `;
    }

    if (this._activeTab === 'constellations') {
      return html`
        <section class="panel" role="tabpanel" id="panel-constellations">
          <p class="panel__note">
            ${msg(
              'Constellations are not yet open. When enough fragments have gathered, they can be arranged into groupings whose juxtaposition produces meaning of its own.',
            )}
          </p>
        </section>
      `;
    }

    return html`
      <section class="panel" role="tabpanel" id="panel-palimpsest">
        <p class="panel__note">
          ${msg(
            'The Palimpsest has not yet formed. It writes itself over time, in the voice of the journal reflecting on what it has seen.',
          )}
        </p>
      </section>
    `;
  }

  protected render() {
    return html`
      <header class="hero">
        <p class="hero__eyebrow">${msg('Your Journal')}</p>
        <h1 class="hero__title">${msg('The Resonance Journal')}</h1>
        <p class="hero__strap">
          ${msg(
            'A record that reflects how you played, not what exists in the game. Every fragment arrives from elsewhere – a dungeon run, an epoch cycle, a bonded agent at your shoulder. It gathers here, waiting to be read.',
          )}
        </p>
      </header>
      ${this._renderTabs()}
      ${this._renderActivePanel()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-resonance-journal': VelgResonanceJournal;
  }
}
