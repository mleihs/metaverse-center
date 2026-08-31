import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Building, Simulation, SimulationTaxonomy } from '../../types/index.js';
import {
  conditionDots,
  conditionDotsOnLadder,
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
  /** The world's `building_condition` taxonomy, carrying each word's rung. */
  @property({ type: Array }) conditionTaxonomy: SimulationTaxonomy[] = [];

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
   *
   * The `?? 0` that used to stand here brought the same symptom back by a
   * different road. `conditionDots` returns `null` for a word it does not
   * know, expressly "so the caller can omit the gem entirely rather than paint
   * a confident 0 of 3" - and the caller collapsed that null to zero, which
   * IS the confident 0 of 3.
   *
   * It is not a rare case. Measured against prod across 20 worlds: 27 of 124
   * buildings (22 %) carry a condition outside the five-word vocabulary -
   * excellent, obsolete, illuminated, restored, thriving, preserved,
   * functional, compromised, anomalous, operational, restricted, sealed. Every
   * one of them showed an empty gem, so a THRIVING building was drawn exactly
   * like rubble. `velg-game-card` already omits the gem on null (line 1452).
   */
  private _getConditionDots(): number | null {
    // The world's own ladder first. It knows words this file never will, and
    // it knows how MANY rungs the world has — in a three-rung world `fair` is
    // the best condition there is and earns three dots, which no fixed table
    // can express.
    const onLadder = conditionDotsOnLadder(
      this.building?.building_condition,
      this.conditionTaxonomy,
    );
    if (onLadder !== null) return onLadder;

    // The taxonomy has not arrived yet, or the ladder failed, or this word
    // stands on no rung. The fixed table still knows the six common ones, and
    // a gem that appears immediately and is right is better than one that pops
    // in a beat later. Where both come up empty, no gem — that is the honest
    // answer and it is now the only way to get one.
    return conditionDots(this.building?.building_condition);
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
    // `?? null`, NOT `?? 0`: the list endpoint carries no `agents` field, so a
    // zero here would mean "nobody lives here" when it means "nobody asked".
    const occupancy = occupancyLevel(
      b.agents?.length ?? null,
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

  /**
   * The capacity bar, or nothing.
   *
   * `b.agents?.length ?? 0` drew a bar at 0 of 20 on every card, because the
   * buildings LIST endpoint carries no `agents` field at all - so the bar said
   * "empty" where the truth was "not loaded". Measured against prod: 36 of 107
   * buildings have a capacity, and every one of them would have shown an empty
   * bar. A bar at zero is a statement; an absent bar is an absence.
   */
  private _getCapacityBar(): CapacityBar | null {
    const b = this.building;
    if (b?.population_capacity == null || b.population_capacity <= 0) return null;
    if (b.agents == null) return null;
    return { current: b.agents.length, max: b.population_capacity };
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
