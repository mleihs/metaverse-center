import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { loadGoogleFont } from '../../services/ThemeService.js';

interface FontEntry {
  name: string;
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'monospace' | 'handwriting';
}

/**
 * Curated catalog of ~80 popular Google Fonts, organized by category.
 * The AI theme generator can pick ANY Google Font — this list is for
 * convenient browsing. Users can also type any font name manually.
 */
const GOOGLE_FONTS: FontEntry[] = [
  // ── Sans-Serif ──
  { name: 'Barlow', family: 'Barlow', category: 'sans-serif' },
  { name: 'Barlow Condensed', family: 'Barlow Condensed', category: 'sans-serif' },
  { name: 'DM Sans', family: 'DM Sans', category: 'sans-serif' },
  { name: 'Exo 2', family: 'Exo 2', category: 'sans-serif' },
  { name: 'Figtree', family: 'Figtree', category: 'sans-serif' },
  { name: 'IBM Plex Sans', family: 'IBM Plex Sans', category: 'sans-serif' },
  { name: 'Inter', family: 'Inter', category: 'sans-serif' },
  { name: 'Jost', family: 'Jost', category: 'sans-serif' },
  { name: 'Karla', family: 'Karla', category: 'sans-serif' },
  { name: 'Lato', family: 'Lato', category: 'sans-serif' },
  { name: 'Manrope', family: 'Manrope', category: 'sans-serif' },
  { name: 'Montserrat', family: 'Montserrat', category: 'sans-serif' },
  { name: 'Mulish', family: 'Mulish', category: 'sans-serif' },
  { name: 'Nunito', family: 'Nunito', category: 'sans-serif' },
  { name: 'Open Sans', family: 'Open Sans', category: 'sans-serif' },
  { name: 'Outfit', family: 'Outfit', category: 'sans-serif' },
  { name: 'Poppins', family: 'Poppins', category: 'sans-serif' },
  { name: 'Public Sans', family: 'Public Sans', category: 'sans-serif' },
  { name: 'Quicksand', family: 'Quicksand', category: 'sans-serif' },
  { name: 'Rajdhani', family: 'Rajdhani', category: 'sans-serif' },
  { name: 'Raleway', family: 'Raleway', category: 'sans-serif' },
  { name: 'Rubik', family: 'Rubik', category: 'sans-serif' },
  { name: 'Source Sans 3', family: 'Source Sans 3', category: 'sans-serif' },
  { name: 'Space Grotesk', family: 'Space Grotesk', category: 'sans-serif' },
  { name: 'Work Sans', family: 'Work Sans', category: 'sans-serif' },

  // ── Serif ──
  { name: 'Bitter', family: 'Bitter', category: 'serif' },
  { name: 'Cormorant Garamond', family: 'Cormorant Garamond', category: 'serif' },
  { name: 'Crimson Text', family: 'Crimson Text', category: 'serif' },
  { name: 'DM Serif Display', family: 'DM Serif Display', category: 'serif' },
  { name: 'EB Garamond', family: 'EB Garamond', category: 'serif' },
  { name: 'Fraunces', family: 'Fraunces', category: 'serif' },
  { name: 'IBM Plex Serif', family: 'IBM Plex Serif', category: 'serif' },
  { name: 'Josefin Slab', family: 'Josefin Slab', category: 'serif' },
  { name: 'Libre Baskerville', family: 'Libre Baskerville', category: 'serif' },
  { name: 'Lora', family: 'Lora', category: 'serif' },
  { name: 'Merriweather', family: 'Merriweather', category: 'serif' },
  { name: 'Noto Serif', family: 'Noto Serif', category: 'serif' },
  { name: 'Old Standard TT', family: 'Old Standard TT', category: 'serif' },
  { name: 'Playfair Display', family: 'Playfair Display', category: 'serif' },
  { name: 'Rowan', family: 'Rowan', category: 'serif' },
  { name: 'Source Serif 4', family: 'Source Serif 4', category: 'serif' },
  { name: 'Spectral', family: 'Spectral', category: 'serif' },
  { name: 'Vollkorn', family: 'Vollkorn', category: 'serif' },

  // ── Display ──
  { name: 'Abril Fatface', family: 'Abril Fatface', category: 'display' },
  { name: 'Bebas Neue', family: 'Bebas Neue', category: 'display' },
  { name: 'Big Shoulders Display', family: 'Big Shoulders Display', category: 'display' },
  { name: 'Bungee', family: 'Bungee', category: 'display' },
  { name: 'Cardo', family: 'Cardo', category: 'display' },
  { name: 'Cinzel', family: 'Cinzel', category: 'display' },
  { name: 'Climate Crisis', family: 'Climate Crisis', category: 'display' },
  { name: 'Concert One', family: 'Concert One', category: 'display' },
  { name: 'Josefin Sans', family: 'Josefin Sans', category: 'display' },
  { name: 'Lexend', family: 'Lexend', category: 'display' },
  { name: 'Libre Franklin', family: 'Libre Franklin', category: 'display' },
  { name: 'Orbitron', family: 'Orbitron', category: 'display' },
  { name: 'Oswald', family: 'Oswald', category: 'display' },
  { name: 'Permanent Marker', family: 'Permanent Marker', category: 'display' },
  { name: 'Righteous', family: 'Righteous', category: 'display' },
  { name: 'Russo One', family: 'Russo One', category: 'display' },
  { name: 'Saira', family: 'Saira', category: 'display' },
  { name: 'Signika', family: 'Signika', category: 'display' },
  { name: 'Syne', family: 'Syne', category: 'display' },
  { name: 'Unbounded', family: 'Unbounded', category: 'display' },

  // ── Monospace ──
  { name: 'Fira Code', family: 'Fira Code', category: 'monospace' },
  { name: 'IBM Plex Mono', family: 'IBM Plex Mono', category: 'monospace' },
  { name: 'Inconsolata', family: 'Inconsolata', category: 'monospace' },
  { name: 'JetBrains Mono', family: 'JetBrains Mono', category: 'monospace' },
  { name: 'Source Code Pro', family: 'Source Code Pro', category: 'monospace' },
  { name: 'Space Mono', family: 'Space Mono', category: 'monospace' },

  // ── Handwriting ──
  { name: 'Caveat', family: 'Caveat', category: 'handwriting' },
  { name: 'Dancing Script', family: 'Dancing Script', category: 'handwriting' },
  { name: 'Kalam', family: 'Kalam', category: 'handwriting' },
  { name: 'Patrick Hand', family: 'Patrick Hand', category: 'handwriting' },

  // ── System Fonts ──
  { name: 'system-ui', family: 'system-ui', category: 'sans-serif' },
  { name: 'Georgia', family: 'Georgia', category: 'serif' },
  { name: 'Courier New', family: 'Courier New', category: 'monospace' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'sans-serif': 'SANS-SERIF',
  serif: 'SERIF',
  display: 'DISPLAY',
  monospace: 'MONOSPACE',
  handwriting: 'HANDWRITING',
};

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
      color: var(--color-text-tertiary);
      display: block;
      margin-bottom: var(--space-1);
    }

    /* -- Trigger Button -- */

    .picker__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }

    .picker__trigger:hover {
      border-color: var(--color-text-muted);
    }

    .picker__trigger:focus-visible {
      outline: 2px solid var(--color-success);
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
      color: var(--color-icon);
      margin-left: var(--space-2);
      transition: transform 0.15s;
      flex-shrink: 0;
    }

    :host([open]) .picker__chevron {
      transform: rotate(180deg);
    }

    /* -- Backdrop -- */

    .picker__backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-sticky);
    }

    /* -- Dropdown Panel -- */

    .picker__dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: var(--z-sticky);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      margin-top: 2px;
      max-height: 380px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .picker__search {
      width: 100%;
      background: var(--color-surface);
      border: none;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text-primary);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
    }

    .picker__search::placeholder {
      color: var(--color-text-muted);
    }

    .picker__list {
      overflow-y: auto;
      flex: 1;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .picker__category {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3) var(--space-1);
      border-top: 1px solid var(--color-border-light);
      user-select: none;
    }

    .picker__category:first-child {
      border-top: none;
    }

    .picker__option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-1-5) var(--space-3);
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.1s, border-color 0.1s;
    }

    .picker__option:hover,
    .picker__option--focused {
      background: var(--color-surface-raised);
    }

    .picker__option--selected {
      border-left-color: var(--color-success);
      background: var(--color-success-glow);
    }

    .picker__option-label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-icon);
    }

    .picker__option-specimen {
      font-size: var(--text-sm, 14px);
      color: var(--color-text-primary);
    }

    /* -- Custom Google Font Input -- */

    .picker__custom-section {
      border-top: 1px solid var(--color-border);
      padding: var(--space-2) var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .picker__custom-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    .picker__custom-row {
      display: flex;
      gap: var(--space-2);
    }

    .picker__custom {
      flex: 1;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
    }

    .picker__custom:focus {
      border-color: var(--color-success);
    }

    .picker__custom-btn {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: var(--space-1-5) var(--space-3);
      cursor: pointer;
      transition: background 0.1s;
      white-space: nowrap;
    }

    .picker__custom-btn:hover {
      background: var(--color-border);
    }

    /* -- Specimen Preview -- */

    .picker__specimen {
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
    }

    .picker__specimen-heading {
      font-size: var(--text-lg, 18px);
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .picker__specimen-body {
      font-size: var(--text-sm, 14px);
      color: var(--color-text-tertiary);
      margin: 0;
    }
  `;

  @property() label = '';
  @property() value = '';

  @state() private _open = false;
  @state() private _search = '';
  @state() private _focusedIndex = -1;
  @state() private _customInput = '';

  private get _filtered(): { category: string; fonts: FontEntry[] }[] {
    const q = this._search.toLowerCase();
    const matching = q
      ? GOOGLE_FONTS.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.category.includes(q),
        )
      : GOOGLE_FONTS;

    // Group by category
    const groups = new Map<string, FontEntry[]>();
    for (const font of matching) {
      const list = groups.get(font.category) ?? [];
      list.push(font);
      groups.set(font.category, list);
    }

    return Array.from(groups.entries()).map(([category, fonts]) => ({
      category,
      fonts,
    }));
  }

  private get _flatFiltered(): FontEntry[] {
    return this._filtered.flatMap((g) => g.fonts);
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Load the currently selected font for specimen preview
    if (this.value) loadGoogleFont(this.value);
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('value') && this.value) {
      loadGoogleFont(this.value);
    }
  }

  private _toggle() {
    this._open = !this._open;
    this._search = '';
    this._focusedIndex = -1;
    this._customInput = '';
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
    loadGoogleFont(font.family);
    this._close();
    this.dispatchEvent(
      new CustomEvent('font-change', {
        detail: { value: font.family },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _selectCustom() {
    const val = this._customInput.trim();
    if (!val) return;
    loadGoogleFont(val);
    this._close();
    this.dispatchEvent(
      new CustomEvent('font-change', {
        detail: { value: val },
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
    const flat = this._flatFiltered;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = Math.min(this._focusedIndex + 1, flat.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._focusedIndex >= 0 && this._focusedIndex < flat.length) {
          this._select(flat[this._focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this._close();
        break;
    }
  }

  private _onOptionMouseEnter(font: FontEntry) {
    loadGoogleFont(font.family);
  }

  protected render() {
    const displayName =
      GOOGLE_FONTS.find((f) => f.family.toLowerCase() === (this.value || '').toLowerCase())
        ?.name ||
      this.value ||
      '\u2014';
    const groups = this._filtered;
    const flat = this._flatFiltered;

    return html`
      ${this.label ? html`<span class="picker__label">${this.label}</span>` : nothing}

      <button
        class="picker__trigger"
        role="combobox"
        aria-expanded=${this._open}
        aria-haspopup="listbox"
        @click=${this._toggle}
      >
        <span class="picker__trigger-name" style="font-family: '${this.value || 'inherit'}', sans-serif"
          >${displayName}</span
        >
        <span class="picker__chevron">\u25BC</span>
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
                ${groups.map(
                  (group) => html`
                    <li class="picker__category">${CATEGORY_LABELS[group.category] ?? group.category}</li>
                    ${group.fonts.map((font) => {
                      const globalIdx = flat.indexOf(font);
                      return html`
                        <li
                          class="picker__option ${this.value?.toLowerCase() === font.family.toLowerCase() ? 'picker__option--selected' : ''} ${globalIdx === this._focusedIndex ? 'picker__option--focused' : ''}"
                          role="option"
                          aria-selected=${this.value?.toLowerCase() === font.family.toLowerCase()}
                          @click=${() => this._select(font)}
                          @mouseenter=${() => this._onOptionMouseEnter(font)}
                        >
                          <span class="picker__option-label">${font.name}</span>
                          <span
                            class="picker__option-specimen"
                            style="font-family: '${font.family}', sans-serif"
                            >${font.name}</span
                          >
                        </li>
                      `;
                    })}
                  `,
                )}
              </ul>
              <div class="picker__custom-section">
                <span class="picker__custom-label">${msg('Any Google Font')}</span>
                <div class="picker__custom-row">
                  <input
                    class="picker__custom"
                    type="text"
                    .value=${this._customInput}
                    @input=${(e: Event) => { this._customInput = (e.target as HTMLInputElement).value; }}
                    @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this._selectCustom(); } }}
                    placeholder=${msg('e.g. Playfair Display')}
                  />
                  <button
                    class="picker__custom-btn"
                    @click=${this._selectCustom}
                  >${msg('Load')}</button>
                </div>
              </div>
            </div>
          `
          : nothing
      }

      <div class="picker__specimen">
        <p class="picker__specimen-heading" style="font-family: '${this.value || 'inherit'}', sans-serif">
          The quick brown fox jumps over the lazy dog
        </p>
        <p class="picker__specimen-body" style="font-family: '${this.value || 'inherit'}', sans-serif">
          ABCDEFGHIJKLM \u2014 abcdefghijklm \u2014 0123456789
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
