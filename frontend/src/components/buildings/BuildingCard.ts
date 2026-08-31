import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Building, Simulation } from '../../types/index.js';
import {
  conditionDots,
  conditionVariant,
  OCCUPANCY_LABEL,
  occupancyLevel,
  occupancyVariant,
} from '../../utils/building-condition.js';
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
      position: relative;
    }

    .seo-link {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
  `;

  @property({ attribute: false }) building!: Building;
  @property({ type: Boolean }) compromised = false;
  @property({ type: Boolean }) generating = false;

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

  /**
   * Filled dots for the condition gem.
   *
   * Both this and `_getConditionVariant` used to carry their own copy of the
   * mapping, and both dropped `pristine` — a value the generator emits
   * (`ForgeBuildingDraft.building_condition`) — into the `ruined` branch, so a
   * flawless building showed an empty gem and a neutral badge. One table now,
   * in `utils/building-condition.ts`.
   */
  private _getConditionDots(): number {
    return conditionDots(this.building?.building_condition) ?? 0;
  }

  private _getBadges(): CardBadge[] {
    const badges: CardBadge[] = [];
    const b = this.building;
    if (!b) return badges;

    if (b.building_type) badges.push({ label: humanizeEnum(t(b, 'building_type')) });

    // Occupancy, the SECOND reading the handoff also calls "Zustand": how many
    // of the building's places are taken. Distinct from building_condition
    // above, which says how intact it is - a pristine hall can stand empty.
    // Omitted entirely when the building declares no capacity: an unmeasured
    // capacity is not an empty one (see utils/building-condition.ts).
    const occupancy = occupancyLevel(
      b.agents?.length ?? 0,
      b.population_capacity,
      b.building_condition,
    );
    if (occupancy !== null && occupancy !== 'ruined') {
      badges.push({ label: OCCUPANCY_LABEL[occupancy](), variant: occupancyVariant(occupancy) });
    }
    if (b.building_condition)
      badges.push({ label: t(b, 'building_condition'), variant: this._getConditionVariant() });
    if (b.special_type === 'embassy') badges.push({ label: msg('Embassy'), variant: 'info' });
    if (this.compromised) badges.push({ label: msg('Compromised'), variant: 'danger' });

    return badges;
  }

  private _getConditionVariant(): string {
    return conditionVariant(this.building?.building_condition);
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

  private _getEntityUrl(): string {
    const sim = appState.currentSimulation.value as Simulation | null;
    if (!sim?.slug || !this.building?.slug) return '';
    return `/simulations/${sim.slug}/buildings/${this.building.slug}`;
  }

  protected render() {
    const b = this.building;
    if (!b) return nothing;

    const entityUrl = this._getEntityUrl();

    return html`
      ${entityUrl ? html`<a class="seo-link" href=${entityUrl}>${b.name}</a>` : ''}
      <velg-game-card
        type="building"
        .name=${b.name}
        image-url=${b.image_url ?? ''}
        .primaryStat=${b.population_capacity}
        .conditionDots=${this._getConditionDots()}
        .rarity=${this._computeRarity()}
        .badges=${this._getBadges()}
        .subtitle=${this._getSubtitle()}
        .description=${t(b, 'description') ?? ''}
        full-description
        .capacityBar=${this._getCapacityBar()}
        ?generating=${this.generating}
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
