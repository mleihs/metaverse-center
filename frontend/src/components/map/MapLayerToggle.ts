import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

export type MapLayer = 'infrastructure' | 'bleed' | 'military' | 'historical';

interface LayerConfig {
  id: MapLayer;
  label: string;
  icon: ReturnType<typeof icons.layerInfrastructure>;
  color: string;
}

/**
 * Intelligence classification tab bar for switching map layers.
 *
 * Styled as classified document tabs with colored classification
 * stripe, roundel indicators, and smooth active state transitions.
 */
@localized()
@customElement('velg-map-layer-toggle')
export class MapLayerToggle extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .toggle {
      display: flex;
      gap: 0;
      background: var(--color-surface-sunken);
      border-top: 1px solid var(--color-border);
    }

    .toggle__tab {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: none;
      border: none;
      border-right: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      font-weight: 600;
      letter-spacing: var(--tracking-wider, 0.05em);
      text-transform: uppercase;
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease;
      overflow: hidden;
    }

    .toggle__tab:last-child {
      border-right: none;
    }

    /* Classification stripe on left edge */
    .toggle__tab::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--tab-color);
      opacity: 0.2;
      transition: opacity 0.2s ease, width 0.2s ease;
    }

    .toggle__tab:hover {
      color: var(--color-text-secondary);
      background: rgba(255, 255, 255, 0.015);
    }

    .toggle__tab:hover::before {
      opacity: 0.5;
    }

    .toggle__tab:focus-visible {
      outline: 2px solid var(--tab-color);
      outline-offset: -2px;
    }

    /* Active state */
    .toggle__tab[aria-selected='true'] {
      color: var(--tab-color);
      background: color-mix(in srgb, var(--tab-color) 6%, transparent);
    }

    .toggle__tab[aria-selected='true']::before {
      opacity: 1;
      width: 3px;
    }

    /* Roundel indicator */
    .toggle__roundel {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s ease, box-shadow 0.2s ease;
    }

    .toggle__tab[aria-selected='true'] .toggle__roundel {
      background: currentColor;
      box-shadow: 0 0 6px color-mix(in srgb, var(--tab-color) 30%, transparent);
    }

    .toggle__tab[aria-selected='true'] .toggle__roundel svg {
      color: var(--color-surface);
    }

    .toggle__label {
      white-space: nowrap;
    }

    /* Live announcement */
    .sr-live {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 640px) {
      .toggle__label {
        display: none;
      }

      .toggle__tab {
        justify-content: center;
        padding: var(--space-2, 8px);
      }
    }
  `;

  @property({ type: String }) activeLayer: MapLayer = 'infrastructure';

  private get _layers(): LayerConfig[] {
    return [
      {
        id: 'infrastructure',
        label: msg('Infrastructure'),
        icon: icons.layerInfrastructure(11),
        color: 'var(--color-text-primary)',
      },
      {
        id: 'bleed',
        label: msg('Bleed'),
        icon: icons.layerBleed(11),
        color: '#a78bfa', // lint-color-ok
      },
      {
        id: 'military',
        label: msg('Military'),
        icon: icons.layerMilitary(11),
        color: 'var(--color-danger)',
      },
      {
        id: 'historical',
        label: msg('Historical'),
        icon: icons.layerHistory(11),
        color: '#d4a574', // lint-color-ok
      },
    ];
  }

  private _selectLayer(layer: MapLayer) {
    this.activeLayer = layer;
    this.dispatchEvent(
      new CustomEvent('layer-change', { detail: layer, bubbles: true, composed: true }),
    );
  }

  private _onKeyDown(e: KeyboardEvent) {
    const layers = this._layers;
    const idx = layers.findIndex((l) => l.id === this.activeLayer);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % layers.length;
      this._selectLayer(layers[next].id);
      this._focusTab(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = idx <= 0 ? layers.length - 1 : idx - 1;
      this._selectLayer(layers[prev].id);
      this._focusTab(prev);
    }
  }

  private _focusTab(index: number) {
    requestAnimationFrame(() => {
      const tabs = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.toggle__tab');
      tabs?.[index]?.focus();
    });
  }

  protected render() {
    return html`
      <div class="sr-live" aria-live="polite" aria-atomic="true">
        ${msg('Active layer:')} ${this.activeLayer}
      </div>
      <div
        class="toggle"
        role="tablist"
        aria-label=${msg('Map layers')}
        @keydown=${this._onKeyDown}
      >
        ${this._layers.map(
          (layer) => html`
            <button
              class="toggle__tab"
              role="tab"
              style="--tab-color: ${layer.color}"
              aria-selected=${this.activeLayer === layer.id ? 'true' : 'false'}
              tabindex=${this.activeLayer === layer.id ? '0' : '-1'}
              @click=${() => this._selectLayer(layer.id)}
            >
              <span class="toggle__roundel">${layer.icon}</span>
              <span class="toggle__label">${layer.label}</span>
            </button>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-layer-toggle': MapLayerToggle;
  }
}
