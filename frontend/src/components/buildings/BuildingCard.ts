import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Building } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { humanizeEnum } from '../../utils/text.js';
import type { CapacityBar, CardBadge, CardRarity } from '../shared/VelgGameCard.js';
import '../shared/VelgGameCard.js';

@localized()
@customElement('velg-building-card')
export class VelgBuildingCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  @property({ attribute: false }) building!: Building;
  @property({ type: Boolean }) compromised = false;

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('building-click', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(): void {
    this.dispatchEvent(
      new CustomEvent('building-edit', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent('building-delete', {
        detail: this.building,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _computeRarity(): CardRarity {
    const b = this.building;
    if (!b) return 'common';

    // Legendary: embassy + good condition
    if (b.special_type === 'embassy' && b.building_condition?.toLowerCase() === 'good') {
      return 'legendary';
    }

    // Rare: embassy OR critical type
    if (b.special_type === 'embassy') return 'rare';

    return 'common';
  }

  private _getConditionDots(): number {
    const condition = this.building?.building_condition?.toLowerCase();
    if (condition === 'good') return 3;
    if (condition === 'fair') return 2;
    if (condition === 'poor') return 1;
    return 0; // ruined
  }

  private _getBadges(): CardBadge[] {
    const badges: CardBadge[] = [];
    const b = this.building;
    if (!b) return badges;

    if (b.building_type) badges.push({ label: humanizeEnum(t(b, 'building_type')) });
    if (b.building_condition)
      badges.push({ label: t(b, 'building_condition'), variant: this._getConditionVariant() });
    if (b.special_type === 'embassy') badges.push({ label: msg('Embassy'), variant: 'info' });
    if (this.compromised) badges.push({ label: msg('Compromised'), variant: 'danger' });

    return badges;
  }

  private _getConditionVariant(): string {
    const condition = this.building?.building_condition?.toLowerCase();
    if (condition === 'good') return 'success';
    if (condition === 'fair') return 'warning';
    if (condition === 'poor' || condition === 'ruined') return 'danger';
    return 'default';
  }

  private _getSubtitle(): string {
    const b = this.building;
    if (!b) return '';
    const parts: string[] = [];
    if (b.zone?.name) parts.push(b.zone.name);
    if (b.city?.name) parts.push(b.city.name);
    return parts.join(' \u00b7 ');
  }

  private _getCapacityBar(): CapacityBar | null {
    const b = this.building;
    if (b?.population_capacity == null) return null;
    const assigned = b.agents?.length ?? 0;
    return { current: assigned, max: b.population_capacity };
  }

  protected render() {
    const b = this.building;
    if (!b) return nothing;

    return html`
      <velg-game-card
        type="building"
        .name=${b.name}
        image-url=${b.image_url ?? ''}
        .primaryStat=${b.population_capacity}
        .conditionDots=${this._getConditionDots()}
        .rarity=${this._computeRarity()}
        .badges=${this._getBadges()}
        .subtitle=${this._getSubtitle()}
        .capacityBar=${this._getCapacityBar()}
        ?show-actions=${appState.canEdit.value}
        @card-click=${this._handleClick}
        @card-edit=${this._handleEdit}
        @card-delete=${this._handleDelete}
      ></velg-game-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-card': VelgBuildingCard;
  }
}
