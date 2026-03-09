/**
 * Epoch Battle Log — narrative event feed for competitive actions.
 *
 * Renders a chronological feed of battle events with type-specific icons,
 * narrative text, and cycle numbers. Supports compact mode for overview panels.
 *
 * Microanimations: staggered slide-in, hover glow, type-specific accent pulses.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { BattleLogEntry, BattleLogEventType, EpochParticipant } from '../../types/index.js';
import { PERSONALITY_COLORS } from '../../utils/bot-colors.js';
import { icons } from '../../utils/icons.js';
import { getBattleEventIcon } from '../../utils/operative-icons.js';

@localized()
@customElement('velg-epoch-battle-log')
export class VelgEpochBattleLog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Feed ─────────────────────────────── */

    .feed {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* ── Entry ────────────────────────────── */

    .entry {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-2);
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      opacity: 0;
      transform: translateY(6px);
      animation: entry-slide 0.35s ease-out forwards;
      transition: background var(--transition-normal);
      position: relative;
    }

    .entry::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .entry:hover {
      background: rgba(255 255 255 / 0.02);
    }

    .entry:hover::before {
      opacity: 1;
    }

    .entry:last-child {
      border-bottom: none;
    }

    @keyframes entry-slide {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Type-specific accent colors ─────── */

    .entry--operative_deployed::before      { background: var(--color-warning); }
    .entry--mission_success::before         { background: var(--color-success); }
    .entry--mission_failed::before          { background: var(--color-gray-600); }
    .entry--detected::before                { background: var(--color-danger); }
    .entry--sabotage::before                { background: var(--color-warning); }
    .entry--propaganda::before              { background: var(--color-epoch-influence); }
    .entry--assassination::before           { background: var(--color-danger); }
    .entry--agent_wounded::before           { background: var(--color-danger); }
    .entry--alliance_formed::before         { background: var(--color-info); }
    .entry--betrayal::before                { background: var(--color-danger-hover); width: 4px; opacity: 1; }
    .entry--betrayal .entry__narrative       { font-weight: var(--font-bold); color: var(--color-gray-100); }
    .entry--betrayal .entry__type            { color: var(--color-danger); }
    .entry--phase_change::before            { background: var(--color-warning); }
    .entry--counter_intel::before           { background: var(--color-info); }
    .entry--intel_report::before            { background: var(--color-info); }
    .entry--zone_fortified::before          { background: var(--color-warning); }

    .entry__intel-fort {
      margin-top: 4px;
      padding: 6px 8px;
      background: rgba(245, 158, 11, 0.10);
      border-left: 2px solid var(--color-warning);
      font-size: 0.75rem;
      color: var(--color-gray-200);
      font-family: var(--font-mono);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .entry__intel-fort-label {
      color: var(--color-warning);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }

    .entry--intel_report .entry__intel {
      margin-top: 4px;
      padding: 6px 8px;
      background: rgba(56, 189, 248, 0.10);
      border-left: 2px solid var(--color-info);
      font-size: 0.75rem;
      color: var(--color-gray-200);
      font-family: var(--font-mono);
    }

    /* ── Icon ─────────────────────────────── */

    .entry__icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-gray-300);
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-800);
      flex-shrink: 0;
      transition: transform var(--transition-fast);
    }

    .entry:hover .entry__icon {
      transform: scale(1.08);
    }

    /* ── Content ──────────────────────────── */

    .entry__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .entry__narrative {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-200);
      line-height: 1.5;
    }

    .entry__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-400);
    }

    /* ── Cycle tag ────────────────────────── */

    .entry__cycle {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      white-space: nowrap;
      align-self: start;
      padding-top: 2px;
    }

    /* ── Phase Divider ────────────────────── */

    .phase-divider {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: var(--space-5) var(--space-3);
      position: relative;
      overflow: hidden;
      opacity: 0;
      animation: phase-announce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .phase-divider::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, var(--_phase-glow) 0%, transparent 70%);
      pointer-events: none;
    }

    .phase-divider__lines {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .phase-divider__line {
      flex: 1;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, var(--_phase-color) 40%, var(--_phase-color) 60%, transparent 100%);
    }

    .phase-divider__icon {
      color: var(--_phase-color);
      flex-shrink: 0;
    }

    .phase-divider__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--_phase-color);
      text-shadow: 0 0 20px var(--_phase-glow), 0 0 40px var(--_phase-glow);
      position: relative;
    }

    .phase-divider__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-300);
      letter-spacing: 0.05em;
    }

    @keyframes phase-announce {
      0% { opacity: 0; transform: scaleX(0.5); }
      70% { opacity: 1; transform: scaleX(1.05); }
      100% { opacity: 1; transform: scaleX(1); }
    }

    .phase-divider--foundation { --_phase-color: var(--color-success); --_phase-glow: rgba(74, 222, 128, 0.12); }
    .phase-divider--competition { --_phase-color: var(--color-warning); --_phase-glow: rgba(245, 158, 11, 0.12); }
    .phase-divider--reckoning { --_phase-color: var(--color-danger); --_phase-glow: rgba(239, 68, 68, 0.12); }

    @media (prefers-reduced-motion: reduce) {
      .phase-divider {
        animation: entry-slide 0.01s ease-out forwards;
      }
    }

    /* ── Empty ────────────────────────────── */

    .empty {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      text-align: center;
      padding: var(--space-4);
    }

    /* ── Bot indicator ────────────────────── */

    .entry__target {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      margin-left: 4px;
    }

    .entry__bot-tag {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0 4px;
      margin-right: 4px;
      vertical-align: middle;
      border: 1px solid;
    }

    .entry__bot-tag--sentinel { color: ${unsafeCSS(PERSONALITY_COLORS.sentinel)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.sentinel)}; }
    .entry__bot-tag--warlord { color: ${unsafeCSS(PERSONALITY_COLORS.warlord)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.warlord)}; }
    .entry__bot-tag--diplomat { color: ${unsafeCSS(PERSONALITY_COLORS.diplomat)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.diplomat)}; }
    .entry__bot-tag--strategist { color: ${unsafeCSS(PERSONALITY_COLORS.strategist)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.strategist)}; }
    .entry__bot-tag--chaos { color: ${unsafeCSS(PERSONALITY_COLORS.chaos)}; border-color: ${unsafeCSS(PERSONALITY_COLORS.chaos)}; }

    /* ── Compact mode ─────────────────────── */

    :host([compact]) .entry {
      grid-template-columns: 24px 1fr auto;
      padding: var(--space-2) var(--space-1);
      gap: var(--space-2);
    }

    :host([compact]) .entry__icon {
      width: 24px;
      height: 24px;
    }

    :host([compact]) .entry__narrative {
      font-size: var(--text-xs);
    }

    :host([compact]) .entry__type {
      display: none;
    }

    :host([compact]) .entry::before {
      display: none;
    }
  `;

  @property({ type: Array }) entries: BattleLogEntry[] = [];
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: String }) mySimulationId = '';
  @property({ type: Boolean, reflect: true }) compact = false;

  private _resolveSimName(simId?: string): string | null {
    if (!simId) return null;
    const p = this.participants.find((pp) => pp.simulation_id === simId);
    return p?.simulations?.name ?? null;
  }

  private _getBotPersonality(simId?: string): string | null {
    if (!simId) return null;
    const p = this.participants.find((pp) => pp.simulation_id === simId && pp.is_bot);
    return p?.bot_players?.personality ?? null;
  }

  private _getTypeLabel(type: BattleLogEventType): string {
    const labels: Record<string, string> = {
      operative_deployed: msg('Deployment'),
      mission_success: msg('Mission Success'),
      mission_failed: msg('Mission Failed'),
      detected: msg('Detected'),
      sabotage: msg('Sabotage'),
      propaganda: msg('Propaganda'),
      assassination: msg('Assassination'),
      agent_wounded: msg('Agent Wounded'),
      alliance_formed: msg('Alliance'),
      betrayal: msg('Betrayal'),
      phase_change: msg('Phase Change'),
      counter_intel: msg('Counter-Intel'),
      intel_report: msg('Intel Report'),
      zone_fortified: msg('Fortified'),
    };
    return labels[type] || type;
  }

  private _renderIntelData(metadata: Record<string, unknown> | undefined) {
    if (!metadata) return nothing;
    const zones = metadata.zone_security as string[] | undefined;
    const zoneDetails = metadata.zone_details as Array<{ name: string; security_level: string }> | undefined;
    const guardians = metadata.guardian_count as number | undefined;
    const fortifications = metadata.fortifications as
      | Array<{ zone_name: string; security_bonus: number; expires_at_cycle: number }>
      | undefined;
    if (!zones && !zoneDetails && guardians === undefined && !fortifications?.length) return nothing;
    const zoneDisplay = zoneDetails
      ? zoneDetails.map((z) => `${z.name}: ${z.security_level}`).join(', ')
      : zones?.join(', ') ?? '';
    return html`
      <div class="entry__intel">
        ${guardians !== undefined ? html`${msg('Guardians detected')}: ${guardians}` : nothing}
        ${zoneDisplay ? html`${guardians !== undefined ? ' | ' : ''}${msg('Zone Security')}: ${zoneDisplay}` : nothing}
      </div>
      ${
        fortifications?.length
          ? html`<div class="entry__intel-fort">
            <span class="entry__intel-fort-label">${msg('Fortifications')}</span>
            ${fortifications.map(
              (f) =>
                html`<span>${f.zone_name} +${f.security_bonus} (${msg(str`expires cycle ${f.expires_at_cycle}`)})</span>`,
            )}
          </div>`
          : nothing
      }
    `;
  }

  protected render() {
    if (this.entries.length === 0) {
      return html`<p class="empty">${msg('No battle events yet.')}</p>`;
    }

    return html`
      <div class="feed">
        ${this.entries.map((entry, i) => this._renderEntry(entry, i))}
      </div>
    `;
  }

  private _renderEntry(entry: BattleLogEntry, index: number) {
    const delay = index * 50;

    // Phase change entries render as dramatic full-width announcements
    if (entry.event_type === 'phase_change') {
      const newPhase = (entry.metadata as Record<string, string> | undefined)?.new_phase ?? '';
      const subtitle =
        newPhase === 'competition'
          ? msg('All operatives unlocked')
          : newPhase === 'reckoning'
            ? msg('Final cycles — double points')
            : '';
      return html`
        <div
          class="phase-divider phase-divider--${newPhase}"
          style="animation-delay: ${delay}ms"
        >
          <div class="phase-divider__lines">
            <div class="phase-divider__line"></div>
            <span class="phase-divider__icon">${icons.bolt(16)}</span>
            <div class="phase-divider__line"></div>
          </div>
          <span class="phase-divider__name">${newPhase.toUpperCase()}</span>
          ${subtitle ? html`<span class="phase-divider__subtitle">${subtitle}</span>` : nothing}
        </div>
      `;
    }

    return html`
      <div
        class="entry entry--${entry.event_type}"
        style="animation-delay: ${delay}ms"
      >
        <div class="entry__icon">${getBattleEventIcon(entry.event_type)}</div>
        <div class="entry__content">
          <span class="entry__narrative">${(() => {
            const meta = entry.metadata as Record<string, unknown> | undefined;
            const botPersonality = this._getBotPersonality(entry.source_simulation_id);
            const isOwnAction = this.mySimulationId && entry.source_simulation_id === this.mySimulationId;
            const isIncomingThreat = this.mySimulationId && entry.target_simulation_id === this.mySimulationId && !isOwnAction;

            // Context-aware narrative (fog of war)
            let narrative = entry.narrative;
            if (isOwnAction && meta) {
              // Own events: full details from metadata
              const agentName = meta.agent_name as string | undefined;
              const zoneName = meta.target_zone_name as string | undefined;
              const simName = meta.target_sim_name as string | undefined;
              if (agentName) {
                const target = zoneName && simName ? `${zoneName}, ${simName}` : simName ?? '';
                narrative = `${agentName} deployed${target ? ` → ${target}` : ''}`;
              }
            } else if (isIncomingThreat && meta) {
              // Incoming threats: type + zone (no agent name — fog of war)
              const opType = meta.operative_type as string | undefined;
              const zoneName = meta.target_zone_name as string | undefined;
              if (opType) {
                const article = opType[0] && 'aeiou'.includes(opType[0]) ? 'An' : 'A';
                narrative = `${article} ${opType} detected${zoneName ? ` in ${zoneName}` : ''}`;
              }
            }

            const showTarget = isOwnAction && entry.target_simulation_id;
            const targetName = showTarget ? this._resolveSimName(entry.target_simulation_id) : null;
            return html`${botPersonality ? html`<span class="entry__bot-tag entry__bot-tag--${botPersonality}">BOT</span>` : nothing}${narrative}${targetName && !meta?.target_sim_name ? html`<span class="entry__target">&rarr; ${targetName}</span>` : nothing}`;
          })()}</span>
          ${
            this.compact
              ? nothing
              : html`<span class="entry__type">${this._getTypeLabel(entry.event_type)}</span>`
          }
          ${
            entry.event_type === 'intel_report' && !this.compact
              ? this._renderIntelData(entry.metadata as Record<string, unknown> | undefined)
              : nothing
          }
        </div>
        <span class="entry__cycle">${msg('Cycle')} ${entry.cycle_number}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-battle-log': VelgEpochBattleLog;
  }
}
