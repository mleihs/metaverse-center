/**
 * Shared tab bar with full a11y: role="tablist", aria-selected,
 * keyboard navigation (Arrow keys + Home/End).
 *
 * Emits `tab-change` CustomEvent with `detail: { key }`.
 */

import { msg } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TabDef {
  key: string;
  label: string;
  icon?: TemplateResult;
  badge?: string | number;
  hidden?: boolean;
}

@customElement('velg-tabs')
export class VelgTabs extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: var(--border-default);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tabs::-webkit-scrollbar {
      display: none;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-2-5) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-secondary);
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
      min-height: 44px;
      opacity: 0;
      animation: tab-enter 250ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    /* Staggered entrance — up to 12 tabs */
    .tab:nth-child(1) { animation-delay: 0ms; }
    .tab:nth-child(2) { animation-delay: 40ms; }
    .tab:nth-child(3) { animation-delay: 80ms; }
    .tab:nth-child(4) { animation-delay: 120ms; }
    .tab:nth-child(5) { animation-delay: 160ms; }
    .tab:nth-child(6) { animation-delay: 200ms; }
    .tab:nth-child(7) { animation-delay: 240ms; }
    .tab:nth-child(8) { animation-delay: 280ms; }
    .tab:nth-child(9) { animation-delay: 320ms; }
    .tab:nth-child(10) { animation-delay: 360ms; }
    .tab:nth-child(11) { animation-delay: 400ms; }
    .tab:nth-child(12) { animation-delay: 440ms; }

    @keyframes tab-enter {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tab:hover {
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
    }

    .tab:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .tab--active {
      color: var(--color-text-primary);
      border-bottom-color: var(--color-primary);
    }

    .tab__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 var(--space-1);
      border-radius: 9px;
      font-size: var(--text-2xs, 0.625rem);
      font-weight: var(--font-black);
      background: var(--color-primary);
      color: var(--color-surface);
      line-height: 1;
    }

    @media (max-width: 640px) {
      .tab {
        padding: var(--space-2) var(--space-2-5);
        font-size: 0.56rem;
        letter-spacing: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tab {
        animation: none;
        opacity: 1;
      }
    }
  `;

  @property({ type: Array }) tabs: TabDef[] = [];
  @property({ type: String }) active = '';

  private _handleClick(key: string) {
    if (key === this.active) return;
    this.dispatchEvent(new CustomEvent('tab-change', { detail: { key }, bubbles: true, composed: true }));
  }

  private _handleKeyDown(e: KeyboardEvent) {
    const visibleTabs = this.tabs.filter((t) => !t.hidden);
    const currentIdx = visibleTabs.findIndex((t) => t.key === this.active);
    let nextIdx = -1;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIdx = (currentIdx + 1) % visibleTabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIdx = (currentIdx - 1 + visibleTabs.length) % visibleTabs.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = visibleTabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextTab = visibleTabs[nextIdx];
    if (nextTab) {
      this._handleClick(nextTab.key);
      // Focus the new tab button
      const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIdx]?.focus();
    }
  }

  protected render() {
    const visibleTabs = this.tabs.filter((t) => !t.hidden);

    return html`
      <nav class="tabs" role="tablist" aria-label="${msg('Navigation tabs')}" @keydown=${this._handleKeyDown}>
        ${visibleTabs.map(
          (tab) => html`
            <button
              role="tab"
              id="tab-${tab.key}"
              aria-selected=${this.active === tab.key}
              aria-controls="tabpanel-${tab.key}"
              tabindex=${this.active === tab.key ? 0 : -1}
              class="tab ${this.active === tab.key ? 'tab--active' : ''}"
              @click=${() => this._handleClick(tab.key)}
            >
              ${tab.icon ?? ''}
              ${tab.label}
              ${tab.badge !== undefined ? html`<span class="tab__badge">${tab.badge}</span>` : ''}
            </button>
          `,
        )}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-tabs': VelgTabs;
  }
}
