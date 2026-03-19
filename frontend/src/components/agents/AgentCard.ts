import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Agent, AptitudeSet, Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import type { CardBadge, CardRarity } from '../shared/VelgGameCard.js';
import '../shared/VelgGameCard.js';

@localized()
@customElement('velg-agent-card')
export class VelgAgentCard extends LitElement {
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

  @property({ type: Object }) agent!: Agent;
  @property({ type: Number }) relationshipCount = 0;
  @property({ type: Object }) aptitudes: AptitudeSet | null = null;
  @property({ type: Boolean }) generating = false;

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('agent-click', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(): void {
    this.dispatchEvent(
      new CustomEvent('agent-edit', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent('agent-delete', {
        detail: this.agent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _computeRarity(): CardRarity {
    const agent = this.agent;
    if (!agent) return 'common';

    // Legendary: ambassador OR has aptitude 9
    if (agent.is_ambassador) return 'legendary';
    if (this.aptitudes) {
      for (const val of Object.values(this.aptitudes)) {
        if (val >= 9) return 'legendary';
      }
    }

    // Rare: has relationships OR AI-generated
    if (this.relationshipCount > 0 || agent.data_source === 'ai') return 'rare';

    return 'common';
  }

  private _getBestAptitude(): { level: number } | null {
    if (!this.aptitudes) return null;
    let best = 0;
    for (const val of Object.values(this.aptitudes)) {
      if (val > best) best = val;
    }
    return { level: best };
  }

  private _getBadges(): CardBadge[] {
    const badges: CardBadge[] = [];
    const agent = this.agent;
    if (!agent) return badges;

    if (agent.system) badges.push({ label: agent.system, variant: 'primary' });
    if (agent.is_ambassador) badges.push({ label: msg('Ambassador'), variant: 'warning' });
    if (agent.ambassador_blocked_until && new Date(agent.ambassador_blocked_until) > new Date()) {
      badges.push({ label: msg('Blocked'), variant: 'danger' });
    }
    if (agent.data_source === 'ai') badges.push({ label: msg('AI'), variant: 'info' });

    return badges;
  }

  private _getSubtitle(): string {
    const parts: string[] = [];
    const prof = t(this.agent, 'primary_profession');
    if (prof) parts.push(prof);
    if (this.agent?.gender) parts.push(this.agent.gender);
    return parts.join(' \u00b7 ');
  }

  private _getEntityUrl(): string {
    const sim = appState.currentSimulation.value as Simulation | null;
    if (!sim?.slug || !this.agent?.slug) return '';
    return `/simulations/${sim.slug}/agents/${this.agent.slug}`;
  }

  protected render() {
    const agent = this.agent;
    if (!agent) return html``;

    const best = this._getBestAptitude();
    const entityUrl = this._getEntityUrl();

    return html`
      ${entityUrl ? html`<a class="seo-link" href=${entityUrl}>${agent.name}</a>` : ''}
      <velg-game-card
        type="agent"
        .name=${agent.name}
        image-url=${agent.portrait_image_url ?? ''}
        .primaryStat=${36}
        .secondaryStat=${best?.level ?? null}
        .rarity=${this._computeRarity()}
        .aptitudes=${this.aptitudes}
        .badges=${this._getBadges()}
        .subtitle=${this._getSubtitle()}
        .connectionCount=${this.relationshipCount}
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
    'velg-agent-card': VelgAgentCard;
  }
}
