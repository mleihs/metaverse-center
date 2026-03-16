import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface FontEntry {
  name: string;
  family: string;
}

const CURATED_FONTS: FontEntry[] = [
  { name: 'Oswald', family: 'Oswald' },
  { name: 'Barlow', family: 'Barlow' },
  { name: 'Cormorant Garamond', family: 'Cormorant Garamond' },
  { name: 'Libre Baskerville', family: 'Libre Baskerville' },
  { name: 'Space Mono', family: 'Space Mono' },
  { name: 'Spectral', family: 'Spectral' },
  { name: 'system-ui', family: 'system-ui' },
  { name: 'Inter', family: 'Inter' },
  { name: 'Segoe UI', family: 'Segoe UI' },
  { name: 'Georgia', family: 'Georgia' },
  { name: 'Courier New', family: 'Courier New' },
  { name: 'Arial Narrow', family: 'Arial Narrow' },
  { name: 'Comic Sans MS', family: 'Comic Sans MS' },
];

@localized()
@customElement('velg-font-picker')
export class VelgFontPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    .picker__label {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-gray-300, #d1d5db);
      display: block;
      margin-bottom: var(--space-1);
    }

    /* ── Trigger Button ────────────────── */

    .picker__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      background: var(--color-gray-950, #030712);
      border: 1px solid var(--color-gray-700, #374151);
      color: var(--color-gray-100, #f3f4f6);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }

    .picker__trigger:hover {
      border-color: var(--color-gray-500, #6b7280);
    }

    .picker__trigger:focus-visible {
      outline: 2px solid var(--color-success, #22c55e);
      outline-offset: 1px;
    }

    .picker__trigger-name {
      font-size: var(--text-sm, 14px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .picker__chevron {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400, #9ca3af);
      margin-left: var(--space-2);
      transition: transform 0.15s;
      flex-shrink: 0;
    }

    :host([open]) .picker__chevron {
      transform: rotate(180deg);
    }

    /* ── Backdrop ──────────────────────── */

    .picker__backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
    }

    /* ── Dropdown Panel ────────────────── */

    .picker__dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      background: var(--color-gray-950, #030712);
      border: 1px solid var(--color-gray-700, #374151);
      margin-top: 2px;
      max-height: 280px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .picker__search {
      width: 100%;
      background: var(--color-gray-900, #111827);
      border: none;
      border-bottom: 1px solid var(--color-gray-700, #374151);
      color: var(--color-gray-100, #f3f4f6);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
    }

    .picker__search::placeholder {
      color: var(--color-gray-500, #6b7280);
    }

    .picker__list {
      overflow-y: auto;
      flex: 1;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .picker__option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.1s, border-color 0.1s;
    }

    .picker__option:hover,
    .picker__option--focused {
      background: var(--color-gray-800, #1f2937);
    }

    .picker__option--selected {
      border-left-color: var(--color-success, #22c55e);
      background: rgba(34, 197, 94, 0.08);
    }

    .picker__option-label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-gray-400, #9ca3af);
    }

    .picker__option-specimen {
      font-size: var(--text-sm, 14px);
      color: var(--color-gray-100, #f3f4f6);
    }

    /* ── Custom Input Fallback ─────────── */

    .picker__custom {
      width: 100%;
      background: var(--color-gray-950, #030712);
      border: 1px solid var(--color-gray-700, #374151);
      color: var(--color-gray-100, #f3f4f6);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      box-sizing: border-box;
      margin-top: var(--space-1);
    }

    .picker__custom:focus {
      outline: 2px solid var(--color-success, #22c55e);
      outline-offset: 1px;
    }

    /* ── Specimen Preview ──────────────── */

    .picker__specimen {
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: var(--color-gray-900, #111827);
      border: 1px solid var(--color-gray-800, #1f2937);
    }

    .picker__specimen-heading {
      font-size: var(--text-lg, 18px);
      font-weight: 700;
      color: var(--color-gray-100, #f3f4f6);
      margin: 0 0 var(--space-1);
    }

    .picker__specimen-body {
      font-size: var(--text-sm, 14px);
      color: var(--color-gray-300, #d1d5db);
      margin: 0;
    }
  `;

  @property() label = '';
  @property() value = '';

  @state() private _open = false;
  @state() private _search = '';
  @state() private _focusedIndex = -1;

  private get _isCustom(): boolean {
    if (!this.value) return false;
    return !CURATED_FONTS.some((f) => f.family.toLowerCase() === this.value.toLowerCase());
  }

  private get _filtered(): FontEntry[] {
    if (!this._search) return CURATED_FONTS;
    const q = this._search.toLowerCase();
    return CURATED_FONTS.filter((f) => f.name.toLowerCase().includes(q));
  }

  private _toggle() {
    this._open = !this._open;
    this._search = '';
    this._focusedIndex = -1;
    if (this._open) {
      this.setAttribute('open', '');
      requestAnimationFrame(() => {
        this.shadowRoot?.querySelector<HTMLInputElement>('.picker__search')?.focus();
      });
    } else {
      this.removeAttribute('open');
    }
  }

  private _close() {
    this._open = false;
    this._search = '';
    this._focusedIndex = -1;
    this.removeAttribute('open');
  }

  private _select(font: FontEntry) {
    this._close();
    this.dispatchEvent(
      new CustomEvent('font-change', {
        detail: { value: font.family },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onSearchInput(e: Event) {
    this._search = (e.target as HTMLInputElement).value;
    this._focusedIndex = -1;
  }

  private _onKeydown(e: KeyboardEvent) {
    const filtered = this._filtered;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = Math.min(this._focusedIndex + 1, filtered.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._focusedIndex >= 0 && this._focusedIndex < filtered.length) {
          this._select(filtered[this._focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this._close();
        break;
    }
  }

  private _onCustomChange(e: Event) {
    const val = (e.target as HTMLInputElement).value.trim();
    if (val) {
      this.dispatchEvent(
        new CustomEvent('font-change', {
          detail: { value: val },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected render() {
    const displayName =
      CURATED_FONTS.find((f) => f.family.toLowerCase() === (this.value || '').toLowerCase())
        ?.name ||
      this.value ||
      '—';
    const filtered = this._filtered;

    return html`
      ${this.label ? html`<span class="picker__label">${this.label}</span>` : nothing}

      <button
        class="picker__trigger"
        role="combobox"
        aria-expanded=${this._open}
        aria-haspopup="listbox"
        @click=${this._toggle}
      >
        <span class="picker__trigger-name" style="font-family: ${this.value || 'inherit'}"
          >${displayName}</span
        >
        <span class="picker__chevron">▼</span>
      </button>

      ${
        this._open
          ? html`
            <div class="picker__backdrop" @click=${this._close}></div>
            <div class="picker__dropdown" @keydown=${this._onKeydown}>
              <input
                class="picker__search"
                type="text"
                placeholder=${msg('Search fonts...')}
                .value=${this._search}
                @input=${this._onSearchInput}
              />
              <ul class="picker__list" role="listbox">
                ${filtered.map(
                  (font, i) => html`
                    <li
                      class="picker__option ${this.value?.toLowerCase() === font.family.toLowerCase() ? 'picker__option--selected' : ''} ${i === this._focusedIndex ? 'picker__option--focused' : ''}"
                      role="option"
                      aria-selected=${this.value?.toLowerCase() === font.family.toLowerCase()}
                      id="font-opt-${i}"
                      @click=${() => this._select(font)}
                    >
                      <span class="picker__option-label">${font.name}</span>
                      <span
                        class="picker__option-specimen"
                        style="font-family: '${font.family}', sans-serif"
                        >${font.name}</span
                      >
                    </li>
                  `,
                )}
              </ul>
            </div>
          `
          : nothing
      }

      ${
        this._isCustom
          ? html`
            <input
              class="picker__custom"
              type="text"
              .value=${this.value}
              @change=${this._onCustomChange}
              placeholder=${msg('Custom font family')}
            />
          `
          : nothing
      }

      <div class="picker__specimen">
        <p class="picker__specimen-heading" style="font-family: ${this.value || 'inherit'}">
          The quick brown fox jumps over the lazy dog
        </p>
        <p class="picker__specimen-body" style="font-family: ${this.value || 'inherit'}">
          ABCDEFGHIJKLM — abcdefghijklm — 0123456789
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-font-picker': VelgFontPicker;
  }
}
