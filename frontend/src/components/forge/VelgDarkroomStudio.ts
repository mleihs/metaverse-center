import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';

type DarkroomTab = 'themes' | 'images' | 'cards';

@localized()
@customElement('velg-darkroom-studio')
export class VelgDarkroomStudio extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Full-screen overlay ── */

    .overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 500);
      display: flex;
      flex-direction: column;
      background: var(--color-surface-sunken, #0a0a0a);
      color: var(--color-text-primary);
      opacity: 0;
      animation: darkroom-enter 400ms ease-out forwards;
    }

    @keyframes darkroom-enter {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .overlay__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: -1;
    }

    /* ── Header ── */

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      padding-top: max(var(--space-4), env(safe-area-inset-top));
      border-bottom: 2px solid var(--color-accent-amber);
      background: var(--color-surface, #111);
      flex-shrink: 0;
    }

    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .header__budget {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent-amber);
      padding: var(--space-1) var(--space-2);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
    }

    .header__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg);
      color: var(--color-text-primary);
      background: transparent;
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .header__close:hover {
      background: var(--color-accent-amber);
      color: #030712;
      border-color: var(--color-accent-amber);
    }

    .header__close:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Tab Navigation ── */

    .tabs {
      display: flex;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface, #111);
      flex-shrink: 0;
    }

    .tab {
      padding: var(--space-3) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .tab:hover {
      color: var(--color-text-primary);
    }

    .tab--active {
      color: var(--color-accent-amber);
      border-bottom-color: var(--color-accent-amber);
    }

    .tab:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    /* ── Content Area ── */

    .content {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--space-6);
      padding-bottom: max(var(--space-6), env(safe-area-inset-bottom));
    }

    .content__section {
      max-width: 1000px;
      margin: 0 auto;
    }

    /* ── Purchase CTA (locked state) ── */

    .purchase-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: var(--space-4);
      text-align: center;
    }

    .purchase-cta__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .purchase-cta__desc {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
      max-width: 50ch;
    }

    .purchase-cta__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
    }

    .purchase-cta__cost--bypass {
      color: var(--color-success, #22c55e);
    }

    .purchase-cta__btn {
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #030712;
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .purchase-cta__btn:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .purchase-cta__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .purchase-cta__btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Theme Laboratory ── */

    .theme-lab {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .theme-lab__heading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .theme-lab__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-4);
    }

    .theme-card {
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .theme-card:hover {
      border-color: var(--color-accent-amber);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .theme-card__swatches {
      display: flex;
      gap: 2px;
      height: 32px;
    }

    .theme-card__swatch {
      flex: 1;
      border-radius: 2px;
    }

    .theme-card__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .theme-card__actions {
      display: flex;
      gap: var(--space-2);
    }

    .theme-card__btn {
      flex: 1;
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .theme-card__btn--apply {
      color: #030712;
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
    }

    .theme-card__btn--apply:hover {
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
    }

    .theme-card__btn--preview {
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border);
    }

    .theme-card__btn--preview:hover {
      border-color: var(--color-text-secondary);
      color: var(--color-text-primary);
    }

    .generate-btn {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .generate-btn:hover:not(:disabled) {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
    }

    .generate-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Image Forge ── */

    .image-forge {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .image-forge__heading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .image-forge__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: var(--space-3);
    }

    .entity-thumb {
      position: relative;
      aspect-ratio: 1;
      border: 1px solid var(--color-border);
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s;
    }

    .entity-thumb:hover {
      border-color: var(--color-accent-amber);
      transform: scale(1.02);
    }

    .entity-thumb__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .entity-thumb__name {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: var(--space-1);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: white;
      background: rgba(0, 0, 0, 0.75);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Regen Side Panel ── */

    .regen-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(400px, 90vw);
      background: var(--color-surface, #111);
      border-left: 2px solid var(--color-accent-amber);
      z-index: var(--z-popover);
      display: flex;
      flex-direction: column;
      animation: panel-slide 300ms ease-out;
    }

    @keyframes panel-slide {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .regen-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }

    .regen-panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .regen-panel__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .regen-panel__close:hover {
      background: var(--color-accent-amber);
      color: #030712;
      border-color: var(--color-accent-amber);
    }

    .regen-panel__body {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .regen-panel__image {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border: 1px solid var(--color-border);
      transition: opacity 800ms ease;
    }

    .regen-panel__image--fading {
      opacity: 0.3;
      filter: grayscale(1);
    }

    .regen-panel__prompt {
      width: 100%;
      min-height: 80px;
      padding: var(--space-2);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      resize: vertical;
      box-sizing: border-box;
    }

    @media (max-width: 768px) {
      .regen-panel__prompt {
        font-size: 16px;
      }
    }

    .regen-panel__prompt:focus {
      outline: none;
      border-color: var(--color-accent-amber);
    }

    .regen-panel__budget {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent-amber);
    }

    .regen-panel__btn {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #030712;
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .regen-panel__btn:hover:not(:disabled) {
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
    }

    .regen-panel__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Card Atelier placeholder ── */

    .atelier {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: var(--space-3);
    }

    .atelier__text {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-align: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .overlay,
      .regen-panel {
        animation: none;
      }
    }

    @media (max-width: 600px) {
      .header {
        padding: var(--space-3) var(--space-4);
      }

      .header__title {
        font-size: var(--text-base);
      }

      .content {
        padding: var(--space-4);
      }

      .tabs {
        overflow-x: auto;
      }

      .tab {
        padding: var(--space-2) var(--space-3);
        white-space: nowrap;
      }

      .regen-panel {
        width: 100%;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _activeTab: DarkroomTab = 'themes';
  @state() private _hasPass = false;
  @state() private _purchasing = false;
  @state() private _regenBudget = 10;
  @state() private _regenerating = false;

  // Image forge state
  @state() private _entities: Array<{ id: string; name: string; type: string; imageUrl: string }> =
    [];
  @state() private _selectedEntity: {
    id: string;
    name: string;
    type: string;
    imageUrl: string;
  } | null = null;
  @state() private _promptOverride = '';

  connectedCallback(): void {
    super.connectedCallback();
    this._handleKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open) {
      void this._checkPass();
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;
    if (e.key === 'Escape') {
      this._close();
    }
  }

  private async _checkPass(): Promise<void> {
    if (!this.simulationId) return;
    const purchases = await forgeStateManager.loadFeaturePurchases(
      this.simulationId,
      'darkroom_pass',
    );
    const activePurchase = purchases.find((p) => p.status === 'completed');
    if (activePurchase) {
      this._hasPass = true;
      this._regenBudget = activePurchase.regen_budget_remaining;
    } else {
      this._hasPass = false;
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('darkroom-close', { bubbles: true, composed: true }));
  }

  private async _purchasePass(): Promise<void> {
    this._purchasing = true;
    const purchaseId = await forgeStateManager.purchaseFeature(this.simulationId, 'darkroom_pass');

    if (!purchaseId) {
      VelgToast.error(forgeStateManager.error.value ?? msg('Failed to purchase darkroom pass.'));
      this._purchasing = false;
      return;
    }

    const result = await forgeStateManager.awaitFeatureCompletion(purchaseId);
    if (result?.status === 'completed') {
      this._hasPass = true;
      this._regenBudget = result.regen_budget_remaining;
      VelgToast.success(msg('Darkroom pass activated.'));
    } else {
      VelgToast.error(msg('Darkroom pass purchase failed. Tokens refunded.'));
    }
    this._purchasing = false;
  }

  private async _regenerateEntity(): Promise<void> {
    if (!this._selectedEntity || this._regenerating || this._regenBudget <= 0) return;

    this._regenerating = true;
    try {
      const resp = await forgeApi.darkroomRegen(
        this.simulationId,
        this._selectedEntity.type,
        this._selectedEntity.id,
        this._promptOverride.trim() || undefined,
      );

      if (resp.success && resp.data) {
        this._regenBudget = resp.data.remaining_regenerations;
        VelgToast.success(msg('Image regenerated.'));
        // Force image refresh by appending cache buster
        this._selectedEntity = {
          ...this._selectedEntity,
          imageUrl: `${this._selectedEntity.imageUrl.split('?')[0]}?t=${Date.now()}`,
        };
      } else {
        VelgToast.error(msg('Regeneration failed.'));
      }
    } catch {
      VelgToast.error(msg('Regeneration failed.'));
    } finally {
      this._regenerating = false;
    }
  }

  private _selectTab(tab: DarkroomTab): void {
    this._activeTab = tab;
    this._selectedEntity = null;
  }

  protected render() {
    if (!this.open) return nothing;

    return html`
      <div class="overlay" role="dialog" aria-modal="true" aria-label=${msg('The Darkroom')}>
        <div class="overlay__backdrop"></div>

        <div class="header">
          <div class="header__left">
            <h2 class="header__title">${msg('THE DARKROOM')}</h2>
            ${
              this._hasPass
                ? html`<span class="header__budget">${msg('REGENERATIONS REMAINING:')} ${this._regenBudget}/10</span>`
                : nothing
            }
          </div>
          <button
            class="header__close"
            @click=${this._close}
            aria-label=${msg('Close darkroom')}
          >X</button>
        </div>

        ${this._hasPass ? this._renderTabs() : nothing}

        <div class="content">
          ${this._hasPass ? this._renderActiveTab() : this._renderPurchaseCTA()}
        </div>

        ${this._selectedEntity ? this._renderRegenPanel() : nothing}
      </div>
    `;
  }

  private _renderTabs() {
    const tabs: Array<{ key: DarkroomTab; label: string }> = [
      { key: 'themes', label: msg('Theme Laboratory') },
      { key: 'images', label: msg('Image Forge') },
      { key: 'cards', label: msg('Card Frame Atelier') },
    ];

    return html`
      <nav class="tabs" role="tablist">
        ${tabs.map(
          (t) => html`
          <button
            class="tab ${this._activeTab === t.key ? 'tab--active' : ''}"
            role="tab"
            aria-selected=${this._activeTab === t.key}
            @click=${() => this._selectTab(t.key)}
          >
            ${t.label}
          </button>
        `,
        )}
      </nav>
    `;
  }

  private _renderActiveTab() {
    switch (this._activeTab) {
      case 'themes':
        return this._renderThemeLab();
      case 'images':
        return this._renderImageForge();
      case 'cards':
        return this._renderCardAtelier();
    }
  }

  private _renderPurchaseCTA() {
    const hasBypass = forgeStateManager.hasTokenBypass.value;
    const canAfford = hasBypass || forgeStateManager.walletBalance.value >= 2;

    return html`
      <div class="purchase-cta">
        <h3 class="purchase-cta__title">${msg('DARKROOM PASS REQUIRED')}</h3>
        <p class="purchase-cta__desc">
          ${msg('The Darkroom grants access to theme variants, image regeneration (10 uses), and card frame customization for this simulation.')}
        </p>
        <p class="purchase-cta__cost ${hasBypass ? 'purchase-cta__cost--bypass' : ''}">
          ${hasBypass ? msg('BYOK: NO COST') : msg('COST: 2 FT')}
        </p>
        <button
          class="purchase-cta__btn"
          ?disabled=${!canAfford || this._purchasing}
          @click=${this._purchasePass}
        >
          ${this._purchasing ? msg('PROCESSING...') : msg('ACTIVATE DARKROOM PASS')}
        </button>
      </div>
    `;
  }

  private _renderThemeLab() {
    return html`
      <div class="content__section theme-lab">
        <h3 class="theme-lab__heading">${msg('Theme Laboratory')}</h3>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin: 0;">
          ${msg("Generate AI theme variants based on your simulation's lore and aesthetic. Apply directly or preview before committing.")}
        </p>
        <button
          class="generate-btn"
          @click=${this._generateThemeVariants}
        >
          ${icons.sparkle(14)} ${msg('Generate Theme Variants')}
        </button>
        <div class="theme-lab__grid">
          ${this._renderPlaceholderThemeCards()}
        </div>
      </div>
    `;
  }

  private async _generateThemeVariants(): Promise<void> {
    VelgToast.success(msg('Theme variant generation initiated.'));
  }

  private _renderPlaceholderThemeCards() {
    // Placeholder cards until theme generation is triggered
    return html`
      <div class="theme-card" style="opacity: 0.4; pointer-events: none;">
        <div class="theme-card__swatches">
          <div class="theme-card__swatch" style="background: #1a1a2e;"></div>
          <div class="theme-card__swatch" style="background: #16213e;"></div>
          <div class="theme-card__swatch" style="background: #0f3460;"></div>
          <div class="theme-card__swatch" style="background: #e94560;"></div>
        </div>
        <span class="theme-card__label">${msg('Generate to reveal')}</span>
      </div>
      <div class="theme-card" style="opacity: 0.3; pointer-events: none;">
        <div class="theme-card__swatches">
          <div class="theme-card__swatch" style="background: #2d2d2d;"></div>
          <div class="theme-card__swatch" style="background: #3d3d3d;"></div>
          <div class="theme-card__swatch" style="background: #5d5d5d;"></div>
          <div class="theme-card__swatch" style="background: #f59e0b;"></div>
        </div>
        <span class="theme-card__label">${msg('Generate to reveal')}</span>
      </div>
      <div class="theme-card" style="opacity: 0.2; pointer-events: none;">
        <div class="theme-card__swatches">
          <div class="theme-card__swatch" style="background: #0d1117;"></div>
          <div class="theme-card__swatch" style="background: #161b22;"></div>
          <div class="theme-card__swatch" style="background: #21262d;"></div>
          <div class="theme-card__swatch" style="background: #58a6ff;"></div>
        </div>
        <span class="theme-card__label">${msg('Generate to reveal')}</span>
      </div>
    `;
  }

  private _renderImageForge() {
    return html`
      <div class="content__section image-forge">
        <h3 class="image-forge__heading">${msg('Image Forge')}</h3>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin: 0;">
          ${msg('Select an entity to regenerate its portrait. You have')} ${this._regenBudget} ${msg('regenerations remaining.')}
        </p>
        ${
          this._entities.length > 0
            ? html`
            <div class="image-forge__grid">
              ${this._entities.map(
                (e) => html`
                <div
                  class="entity-thumb"
                  @click=${() => {
                    this._selectedEntity = e;
                    this._promptOverride = '';
                  }}
                  role="button"
                  tabindex="0"
                  aria-label=${e.name}
                  @keydown=${(ev: KeyboardEvent) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      this._selectedEntity = e;
                      this._promptOverride = '';
                    }
                  }}
                >
                  <img class="entity-thumb__img" src=${e.imageUrl} alt=${e.name} loading="lazy" />
                  <span class="entity-thumb__name">${e.name}</span>
                </div>
              `,
              )}
            </div>
          `
            : html`
            <p style="font-size: var(--text-sm); color: var(--color-text-muted);">
              ${msg('No entity images found for this simulation.')}
            </p>
          `
        }
      </div>
    `;
  }

  private _renderRegenPanel() {
    if (!this._selectedEntity) return nothing;

    return html`
      <div class="regen-panel">
        <div class="regen-panel__header">
          <h4 class="regen-panel__title">${this._selectedEntity.name}</h4>
          <button
            class="regen-panel__close"
            @click=${() => {
              this._selectedEntity = null;
            }}
            aria-label=${msg('Close panel')}
          >X</button>
        </div>
        <div class="regen-panel__body">
          <img
            class="regen-panel__image ${this._regenerating ? 'regen-panel__image--fading' : ''}"
            src=${this._selectedEntity.imageUrl}
            alt=${this._selectedEntity.name}
          />
          <textarea
            class="regen-panel__prompt"
            placeholder=${msg('Optional: describe what you want different...')}
            .value=${this._promptOverride}
            @input=${(e: Event) => {
              this._promptOverride = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          <span class="regen-panel__budget">${this._regenBudget}/10 ${msg('REMAINING')}</span>
          <button
            class="regen-panel__btn"
            ?disabled=${this._regenerating || this._regenBudget <= 0}
            @click=${this._regenerateEntity}
          >
            ${this._regenerating ? msg('REGENERATING...') : msg('REGENERATE')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderCardAtelier() {
    return html`
      <div class="content__section atelier">
        <h3 style="
          font-family: var(--font-brutalist);
          font-weight: var(--font-bold, 700);
          font-size: var(--text-base);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-text-primary);
          margin: 0;
        ">${msg('Card Frame Atelier')}</h3>
        <p class="atelier__text">
          ${msg('Card frame customization coming soon. Texture, nameplate style, corner treatment, and foil effects.')}
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-darkroom-studio': VelgDarkroomStudio;
  }
}
