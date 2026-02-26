import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { getLoreSectionsForSlug } from './lore-content.js';

import '../platform/LoreScroll.js';

@localized()
@customElement('velg-simulation-lore-view')
export class VelgSimulationLoreView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .lore-view {
      max-width: 860px;
      margin: 0 auto;
    }

    .lore-view__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40vh;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }
  `;

  @property({ type: String }) simulationId = '';

  private _disposeEffect?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    window.scrollTo(0, 0);
    // Re-render when currentSimulation signal changes (needed for page reload)
    this._disposeEffect = effect(() => {
      appState.currentSimulation.value;
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    this._disposeEffect?.();
    super.disconnectedCallback();
  }

  private _getSlug(): string {
    return appState.currentSimulation.value?.slug ?? '';
  }

  protected render() {
    const slug = this._getSlug();
    const sections = slug ? getLoreSectionsForSlug(slug) : null;

    if (!sections) {
      return html`<div class="lore-view__empty">${msg('No lore available for this simulation.')}</div>`;
    }

    return html`
      <div class="lore-view">
        <velg-lore-scroll
          .sections=${sections}
          .basePath=${`${slug}/lore`}
          style="
            --lore-text: var(--color-text-primary);
            --lore-heading: var(--color-text-primary);
            --lore-muted: var(--color-text-secondary);
            --lore-faint: var(--color-text-muted);
            --lore-accent: var(--color-primary);
            --lore-accent-strong: var(--color-primary-hover, var(--color-primary));
            --lore-surface: var(--color-surface-sunken);
            --lore-surface-hover: var(--color-surface);
            --lore-divider: var(--color-border-light);
            --lore-image-border: var(--color-border-light);
            --lore-btn-border: var(--color-border);
            --lore-btn-text: var(--color-text-secondary);
          "
        ></velg-lore-scroll>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-lore-view': VelgSimulationLoreView;
  }
}
