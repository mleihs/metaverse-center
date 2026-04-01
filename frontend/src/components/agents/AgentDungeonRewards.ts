/**
 * Dungeon Rewards section for AgentDetailsPanel.
 *
 * Shows persistent loot effects earned by an agent across dungeon runs,
 * with provenance (source archetype, difficulty, date) per effect.
 *
 * Design references:
 *   - Destiny 2 Collections "Source:" provenance line
 *   - Darkest Dungeon trinket rarity-colored borders
 *   - Hades Mirror of Night vertical list layout
 *
 * Pattern: AgentMemorySection.ts (nested self-loading component).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { dungeonApi } from '../../services/api/DungeonApiService.js';
import type { AgentLootEffect } from '../../types/dungeon.js';
import { LOOT_TIER_MARKERS } from '../../utils/dungeon-formatters.js';
import { icons } from '../../utils/icons.js';

import '../shared/LoadingState.js';

/** Human-readable effect type labels (i18n). */
function getEffectLabel(effectType: string): string {
  const labels: Record<string, () => string> = {
    aptitude_boost: () => msg('Aptitude Boost'),
    permanent_dungeon_bonus: () => msg('Permanent Bonus'),
    next_dungeon_bonus: () => msg('Next Dungeon Bonus'),
    event_modifier: () => msg('Event Modifier'),
    arc_modifier: () => msg('Arc Modifier'),
  };
  return labels[effectType]?.() ?? effectType;
}

/** Difficulty as visual stars. */
function difficultyStars(d: number | null): string {
  if (!d) return '';
  return '\u2605'.repeat(d) + '\u00B7'.repeat(5 - d);
}

@localized()
@customElement('velg-agent-dungeon-rewards')
export class VelgAgentDungeonRewards extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Empty state ─────────────────────────── */

    .empty {
      padding: var(--space-4) var(--space-3);
      text-align: center;
      color: var(--color-text-muted);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: 0.04em;
      border: var(--border-light);
      background: var(--color-surface-sunken);
    }

    .empty__icon {
      display: block;
      margin: 0 auto var(--space-2);
      color: var(--color-text-tertiary);
      opacity: 0.5;
    }

    /* ── Reward list ─────────────────────────── */

    .rewards {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    /* ── Single reward row ───────────────────── */

    .reward {
      position: relative;
      padding: var(--space-2) var(--space-3);
      padding-left: var(--space-4);
      background: var(--color-surface-raised);
      border-left: 3px solid var(--_tier-color, var(--color-border));
      animation: reward-enter 300ms var(--ease-dramatic) both;
      animation-delay: var(--_delay, 0ms);
    }

    @keyframes reward-enter {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
    }

    /* Tier color variants (left border + marker glow) */
    .reward--tier-1 {
      --_tier-color: var(--color-text-muted);
    }

    .reward--tier-2 {
      --_tier-color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 3%, var(--color-surface-raised));
    }

    .reward--tier-3 {
      --_tier-color: var(--color-warning);
      background: color-mix(in srgb, var(--color-warning) 5%, var(--color-surface-raised));
    }

    /* Consumed/spent effect */
    .reward--consumed {
      opacity: 0.5;
    }

    /* ── Header row: marker + name ───────────── */

    .reward__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .reward__marker {
      flex-shrink: 0;
      font-size: var(--text-sm);
      color: var(--_tier-color, var(--color-text-muted));
    }

    .reward--tier-3 .reward__marker {
      text-shadow: 0 0 6px var(--color-warning-glow);
    }

    .reward__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .reward__consumed-tag {
      margin-left: auto;
      font-family: var(--font-brutalist);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      padding: 1px var(--space-1);
      border: 1px solid var(--color-border-light);
    }

    /* ── Detail: effect description ──────────── */

    .reward__detail {
      margin-top: var(--space-1);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-success);
      letter-spacing: 0.02em;
    }

    /* ── Provenance line (Destiny 2 pattern) ─── */

    .reward__source {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .reward__source-icon {
      display: flex;
      color: var(--color-text-tertiary);
    }

    .reward__difficulty {
      letter-spacing: 0;
      color: var(--color-warning);
      font-size: 9px;
    }

    .reward__date {
      margin-left: auto;
      color: var(--color-text-tertiary);
    }

  `;

  @property() simulationId = '';
  @property() agentId = '';

  @state() private _effects: AgentLootEffect[] = [];
  @state() private _loading = true;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadEffects();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('agentId') || changed.has('simulationId')) {
      this._loadEffects();
    }
  }

  private async _loadEffects(): Promise<void> {
    if (!this.simulationId || !this.agentId) {
      this._loading = false;
      return;
    }
    try {
      const resp = await dungeonApi.getAgentLootEffects(this.agentId, this.simulationId);
      this._effects = resp.data ?? [];
    } catch {
      this._effects = [];
    }
    this._loading = false;
  }

  /** Infer a tier from effect_type (no tier field in loot_effects table). */
  private _inferTier(effect: AgentLootEffect): number {
    if (effect.effect_type === 'aptitude_boost') return 3;
    if (effect.effect_type === 'permanent_dungeon_bonus') return 2;
    if (effect.effect_type === 'arc_modifier' || effect.effect_type === 'event_modifier') return 2;
    return 1;
  }

  /** Build a short human-readable detail from effect_params. */
  private _formatDetail(effect: AgentLootEffect): string {
    const p = effect.effect_params;
    switch (effect.effect_type) {
      case 'aptitude_boost': {
        const choices = p.aptitude_choices as string[] | undefined;
        const aptitude = p.aptitude as string | undefined;
        const bonus = (p.bonus as number) ?? 1;
        if (choices?.length) return `+${bonus} ${choices.join(' / ')}`;
        if (aptitude) return `+${bonus} ${aptitude}`;
        return `+${bonus}`;
      }
      case 'permanent_dungeon_bonus':
      case 'next_dungeon_bonus':
        return (p.description_en as string | undefined) ?? msg('Dungeon bonus');
      case 'event_modifier':
        return msg('Reduced event impact');
      case 'arc_modifier':
        return msg('Reduced escalation pressure');
      default:
        return '';
    }
  }

  /** Format date as compact string. */
  private _formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state .message=${msg('Loading rewards...')}></velg-loading-state>`;
    }

    if (this._effects.length === 0) {
      return html`
        <div class="empty">
          <span class="empty__icon">${icons.treasure(24)}</span>
          ${msg('No dungeon rewards yet.')}
        </div>
      `;
    }

    return html`
      <div class="rewards">
        ${this._effects.map((effect, i) => this._renderReward(effect, i))}
      </div>
    `;
  }

  private _renderReward(effect: AgentLootEffect, index: number) {
    const tier = this._inferTier(effect);
    const marker = LOOT_TIER_MARKERS[tier] ?? '\u25C6';
    const detail = this._formatDetail(effect);

    return html`
      <div
        class="reward reward--tier-${tier} ${effect.consumed ? 'reward--consumed' : ''}"
        style="--_delay: ${index * 60}ms"
      >
        <div class="reward__header">
          <span class="reward__marker">${marker}</span>
          <span class="reward__name">${getEffectLabel(effect.effect_type)}</span>
          ${
            effect.consumed
              ? html`<span class="reward__consumed-tag">${msg('Used')}</span>`
              : nothing
          }
        </div>
        ${detail ? html`<div class="reward__detail">${detail}</div>` : nothing}
        ${
          effect.source_archetype
            ? html`
            <div class="reward__source">
              <span class="reward__source-icon">${icons.dungeonDepth(10)}</span>
              <span>${effect.source_archetype}</span>
              ${
                effect.source_difficulty
                  ? html`<span class="reward__difficulty">${difficultyStars(effect.source_difficulty)}</span>`
                  : nothing
              }
              <span class="reward__date">${this._formatDate(effect.source_completed_at)}</span>
            </div>
          `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-dungeon-rewards': VelgAgentDungeonRewards;
  }
}
