/**
 * CommandPalette — Ctrl+K / Cmd+K power-user overlay.
 *
 * Full-viewport dark overlay with centered 560px panel. Monospace search
 * input, categorized results (NAVIGATE / SHARDS / TOOLS), keyboard nav,
 * fuzzy filtering.
 *
 * Opened via:
 *   - Global Ctrl+K / Cmd+K (wired in app-shell.ts)
 *   - Clicking the [⌘K] header button
 *   - Setting the `open` property
 *
 * @fires navigate - Bubbles route changes
 * @fires command-palette-close - Notifies parent to clear open state
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { localeService } from '../../services/i18n/locale-service.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

interface PaletteItem {
  id: string;
  label: string;
  category: 'navigate' | 'shards' | 'tools';
  hint?: string;
  path?: string;
  action?: () => void;
  hidden?: boolean;
}

const CATEGORY_ORDER = ['navigate', 'shards', 'tools'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  navigate: 'NAVIGATE',
  shards: 'SHARDS',
  tools: 'TOOLS',
};

@localized()
@customElement('velg-command-palette')
export class VelgCommandPalette extends SignalWatcher(LitElement) {
  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: contents;
    }

    /* ── Overlay ── */

    .overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 9000);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: min(20vh, 160px);
      background: rgba(0, 0, 0, 0.7);
      animation: overlay-in 200ms ease both;
    }

    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Panel ── */

    .panel {
      width: min(560px, calc(100vw - 32px));
      max-height: min(480px, calc(100vh - 200px));
      display: flex;
      flex-direction: column;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-top: 2px solid var(--color-primary);
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.8),
        0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent);
      animation: panel-in 250ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }

    /* Corner brackets */
    .panel::before,
    .panel::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--color-primary);
      border-style: solid;
      pointer-events: none;
      opacity: 0.35;
    }
    .panel::before { top: 6px; left: 6px; border-width: 1px 0 0 1px; }
    .panel::after { bottom: 6px; right: 6px; border-width: 0 1px 1px 0; }

    @keyframes panel-in {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* ── Search input ── */

    .search {
      display: flex;
      align-items: center;
      padding: var(--space-3, 12px) var(--space-4, 16px);
      border-bottom: 1px solid var(--color-separator);
      gap: var(--space-2, 8px);
    }

    .search__prompt {
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      color: var(--color-primary);
      flex-shrink: 0;
      user-select: none;
    }

    .search__input {
      flex: 1;
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      outline: none;
      caret-color: var(--color-primary);
    }

    .search__input::placeholder {
      color: var(--color-text-muted);
    }

    .search__shortcut {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    /* ── Results ── */

    .results {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-2, 8px) 0;

      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    .results::-webkit-scrollbar { width: 4px; }
    .results::-webkit-scrollbar-track { background: transparent; }
    .results::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

    .category-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-muted);
      padding: var(--space-2, 8px) var(--space-4, 16px) var(--space-1, 4px);
    }

    /* ── Result item ── */

    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2, 8px) var(--space-4, 16px);
      cursor: pointer;
      transition: background 100ms ease;
      animation: item-in 150ms ease both;
    }

    .item:hover,
    .item--focused {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    .item--focused {
      box-shadow: inset 2px 0 0 var(--color-primary);
    }

    .item__label {
      font-family: var(--font-sans);
      font-size: var(--text-sm, 14px);
      color: var(--color-text-tertiary);
    }

    .item--focused .item__label {
      color: var(--color-primary);
    }

    .item__hint {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      padding: 1px 6px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    @keyframes item-in {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .empty {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-6, 24px) var(--space-4, 16px);
    }

    /* ── Footer ── */

    .footer {
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
      padding: var(--space-2, 8px) var(--space-4, 16px);
      border-top: 1px solid var(--color-separator);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .footer kbd {
      padding: 1px 4px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: 2px;
      font-family: inherit;
      font-size: inherit;
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .overlay, .panel, .item { animation: none !important; }
    }
  `;

  @property({ type: Boolean }) open = false;

  @state() private _query = '';
  @state() private _focusIndex = 0;

  @query('.search__input') private _input!: HTMLInputElement;

  // ── Lifecycle ──

  updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      this._query = '';
      this._focusIndex = 0;
      this.updateComplete.then(() => this._input?.focus());
    }
    if (changed.has('_focusIndex')) {
      this.renderRoot.querySelector('.item--focused')?.scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Items ──

  private get _baseItems(): PaletteItem[] {
    return [
      { id: 'map', label: msg('Map'), category: 'navigate', hint: 'G M', path: '/multiverse' },
      { id: 'epoch', label: msg('Epoch'), category: 'navigate', hint: 'G E', path: '/epoch' },
      { id: 'guide', label: msg('Guide'), category: 'navigate', hint: 'G G', path: '/how-to-play' },
      {
        id: 'archives',
        label: msg('Archives'),
        category: 'navigate',
        hint: 'G A',
        path: '/archives',
      },
      {
        id: 'dashboard',
        label: msg('Dashboard'),
        category: 'navigate',
        hint: 'G D',
        path: '/dashboard',
      },
      {
        id: 'forge',
        label: msg('Forge'),
        category: 'navigate',
        hint: 'G F',
        path: '/forge',
        hidden: !appState.canForge.value,
      },
      {
        id: 'admin',
        label: msg('Admin'),
        category: 'navigate',
        hint: 'G X',
        path: '/admin',
        hidden: !appState.isPlatformAdmin.value,
      },
      ...this._simItems,
      {
        id: 'locale',
        label: msg('Toggle Language'),
        category: 'tools',
        action: () => {
          const next = localeService.currentLocale === 'en' ? 'de' : 'en';
          localeService.setLocale(next);
        },
      },
      {
        id: 'github',
        label: msg('GitHub Repository'),
        category: 'tools',
        action: () => window.open('https://github.com/mleihs/velgarien-rebuild', '_blank'),
      },
    ];
  }

  private get _simItems(): PaletteItem[] {
    return appState.simulations.value.map((sim: Simulation) => ({
      id: `sim-${sim.id}`,
      label: t(sim, 'name'),
      category: 'shards' as const,
      hint: sim.theme,
      path: `/simulations/${sim.slug}/agents`,
    }));
  }

  private get _filteredItems(): PaletteItem[] {
    const all = this._baseItems.filter((i) => !i.hidden);
    if (!this._query) return all;
    const q = this._query.toLowerCase();
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint?.toLowerCase().includes(q) ?? false) ||
        item.category.includes(q),
    );
  }

  private get _groupedItems(): Array<{ category: string; items: PaletteItem[] }> {
    const filtered = this._filteredItems;
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: filtered.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);
  }

  private get _flatItems(): PaletteItem[] {
    return this._groupedItems.flatMap((g) => g.items);
  }

  // ── Handlers ──

  private _onOverlayClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this._requestClose();
    }
  };

  private _onInput = (e: InputEvent): void => {
    this._query = (e.target as HTMLInputElement).value;
    this._focusIndex = 0;
  };

  private _onKeydown = (e: KeyboardEvent): void => {
    const flat = this._flatItems;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._focusIndex = Math.min(this._focusIndex + 1, flat.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusIndex = Math.max(this._focusIndex - 1, 0);
        break;
      case 'Enter': {
        e.preventDefault();
        const item = flat[this._focusIndex];
        if (item) this._selectItem(item);
        break;
      }
      case 'Escape':
        e.preventDefault();
        this._requestClose();
        break;
    }
  };

  private _selectItem(item: PaletteItem): void {
    this._requestClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: item.path, bubbles: true, composed: true }),
      );
    }
  }

  private _requestClose(): void {
    this.dispatchEvent(new CustomEvent('command-palette-close', { bubbles: true, composed: true }));
  }

  // ── Render ──

  protected render() {
    if (!this.open) return nothing;

    const groups = this._groupedItems;
    const flat = this._flatItems;
    let globalIdx = 0;

    return html`
      <div
        class="overlay"
        @click=${this._onOverlayClick}
        @keydown=${this._onKeydown}
        role="dialog"
        aria-modal="true"
        aria-label=${msg('Command palette')}
      >
        <div class="panel">
          <div class="search">
            <span class="search__prompt" aria-hidden="true">&gt;</span>
            <input
              class="search__input"
              type="text"
              placeholder=${msg('type to search...')}
              .value=${this._query}
              @input=${this._onInput}
              autocomplete="off"
              spellcheck="false"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant=${
                flat[this._focusIndex] ? `palette-item-${flat[this._focusIndex].id}` : ''
              }
            />
            <span class="search__shortcut">ESC</span>
          </div>

          <div class="results" id="palette-results" role="listbox">
            ${
              groups.length === 0
                ? html`<div class="empty">${msg('No results')}</div>`
                : groups.map(
                    (group) => html`
                    <div class="category-label">${CATEGORY_LABELS[group.category] ?? group.category}</div>
                    ${group.items.map((item) => {
                      const idx = globalIdx++;
                      const focused = idx === this._focusIndex;
                      return html`
                        <div
                          id="palette-item-${item.id}"
                          class="item ${focused ? 'item--focused' : ''}"
                          style="animation-delay:${idx * 40}ms"
                          role="option"
                          aria-selected=${focused}
                          @click=${() => this._selectItem(item)}
                          @mouseenter=${() => {
                            this._focusIndex = idx;
                          }}
                        >
                          <span class="item__label">${item.label}</span>
                          ${item.hint ? html`<span class="item__hint">${item.hint}</span>` : nothing}
                        </div>
                      `;
                    })}
                  `,
                  )
            }
          </div>

          <div class="footer">
            <span><kbd>↑↓</kbd> ${msg('navigate')}</span>
            <span><kbd>↵</kbd> ${msg('select')}</span>
            <span><kbd>esc</kbd> ${msg('close')}</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-command-palette': VelgCommandPalette;
  }
}
