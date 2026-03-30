/**
 * Dungeon Combat Bar -- planning-phase weapon console for dungeon combat.
 *
 * The centerpiece of dungeon gameplay: 30-second countdown, per-agent ability
 * selection with enemy targeting, and the consequential EXECUTE button.
 * Submarine war room meets tabletop board game.
 *
 * Replaces DungeonQuickActions during combat phases:
 *   combat_planning  -> Timer + agent ability strips + target picker + submit
 *   combat_resolving -> "RESOLVING" status with blink
 *   combat_outcome   -> "ROUND COMPLETE" status
 *   boss             -> Same as combat_planning
 *
 * Reads: dungeonState signals (phase, party, selectedActions, allActionsSelected,
 *        combat, timerRemaining, combatSubmitting).
 * Writes: dungeonState.selectAction() for ability selection.
 * Dispatches: 'terminal-command' with 'submit' for combat submission.
 *
 * Pattern: DungeonQuickActions.ts (signal-reactive, terminal aesthetic, event dispatch).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type {
  AbilityOption,
  AgentCombatStateClient,
  CombatAction,
  EnemyCombatStateClient,
} from '../../types/dungeon.js';
import { getConditionLabel } from '../../utils/dungeon-formatters.js';
import {
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

/** Timer urgency thresholds (milliseconds). */
const TIMER_WARNING_MS = 10_000;
const TIMER_CRITICAL_MS = 5_000;

@localized()
@customElement('velg-dungeon-combat-bar')
export class VelgDungeonCombatBar extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
      }

      /* -- Bar Container -- */
      .combat-bar {
        background: var(--_screen-bg);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        border-top: 2px solid var(--_phosphor-dim);
      }

      /* -- Timer Section -- */
      .timer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
      }

      .timer__label {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        flex-shrink: 0;
      }

      .timer__track {
        flex: 1;
        height: 12px;
        background: color-mix(in srgb, var(--_screen-bg) 60%, var(--_border));
        border: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
        overflow: hidden;
      }

      .timer__fill {
        height: 100%;
        background: var(--_phosphor);
        transform-origin: left;
      }

      .timer--warning .timer__fill {
        background: var(--color-warning);
      }

      .timer--critical .timer__fill {
        background: var(--color-danger);
      }

      .timer__seconds {
        font-family: var(--_mono);
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--_phosphor);
        text-shadow: 0 0 8px var(--_phosphor-glow);
        min-width: 32px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .timer--warning .timer__seconds {
        color: var(--color-warning);
      }

      .timer--critical {
        animation: crt-flicker 0.15s infinite alternate;
      }

      @keyframes crt-flicker {
        from { opacity: 1; }
        to { opacity: 0.85; }
      }

      @media (prefers-reduced-motion: reduce) {
        .timer--critical { animation: none; }
      }

      .timer--critical .timer__seconds {
        color: var(--color-danger);
        text-shadow: 0 0 8px var(--color-danger);
      }

      /* -- Agent Strips -- */
      .agents {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 8px;
      }

      .agent {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 5px 8px;
        border: 1px solid color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 50%, transparent);
      }

      .agent--selected {
        border-color: color-mix(in srgb, var(--_phosphor) 35%, transparent);
      }

      .agent--targeting {
        border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
      }

      .agent__row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .agent__name {
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor);
        flex-shrink: 0;
        min-width: 48px;
      }

      .agent__condition {
        font-family: var(--_mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: var(--_phosphor-dim);
        opacity: 0.6;
        flex-shrink: 0;
      }

      .agent__abilities {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        flex: 1;
      }

      /* -- Ability Buttons -- */
      .ability {
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.3px;
        padding: 3px 8px;
        background: transparent;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 55%, transparent);
        cursor: pointer;
        white-space: nowrap;
      }

      .ability:hover:not(:disabled) {
        color: var(--_phosphor);
        border-color: var(--_phosphor-dim);
        background: color-mix(in srgb, var(--_phosphor) 5%, transparent);
      }

      .ability:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 1px;
      }

      .ability--selected {
        color: var(--_phosphor);
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 10%, transparent);
      }

      .ability--cooldown {
        opacity: 0.3;
        cursor: not-allowed;
        text-decoration: line-through;
      }

      .ability--ultimate {
        border-style: dashed;
      }

      .ability__check {
        font-size: 8px;
        opacity: 0.65;
        margin-left: 3px;
      }

      .ability__cd {
        font-size: 8px;
        opacity: 0.5;
      }

      /* -- Target Picker -- */
      .targets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 4px 0 2px;
        border-top: 1px dashed color-mix(in srgb, var(--_border) 25%, transparent);
        margin-top: 2px;
      }

      .targets__label {
        font-family: var(--_mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor-dim);
        align-self: center;
        margin-right: 2px;
      }

      .target {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 600;
        padding: 2px 8px;
        background: transparent;
        color: var(--color-danger);
        border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
        cursor: pointer;
      }

      .target:hover {
        background: color-mix(in srgb, var(--color-danger) 8%, transparent);
        border-color: var(--color-danger);
      }

      .target:focus-visible {
        outline: 2px solid var(--color-danger);
        outline-offset: 1px;
      }

      .target--ally {
        color: var(--_phosphor);
        border-color: color-mix(in srgb, var(--_phosphor) 40%, transparent);
      }

      .target--ally:hover {
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        border-color: var(--_phosphor);
      }

      .target--ally:focus-visible {
        outline-color: var(--_phosphor);
      }

      /* -- Footer: Counter + Submit -- */
      .footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-top: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
      }

      .counter {
        font-family: var(--_mono);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor-dim);
        flex-shrink: 0;
      }

      .execute {
        flex: 1;
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 900;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 3px;
        padding: 8px 16px;
        background: transparent;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 60%, transparent);
        cursor: not-allowed;
        opacity: 0.5; /* WCAG AA: ≥3:1 non-text contrast for disabled UI */
      }

      .execute--ready {
        opacity: 1;
        cursor: pointer;
        color: var(--_phosphor);
        border: 2px solid var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        box-shadow: 0 0 12px var(--_phosphor-glow);
        animation: execute-pulse 2s ease-in-out infinite;
      }

      @keyframes execute-pulse {
        0%, 100% { box-shadow: 0 0 8px var(--_phosphor-glow); }
        50% { box-shadow: 0 0 16px var(--_phosphor-glow), 0 0 24px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent); }
      }

      @media (prefers-reduced-motion: reduce) {
        .execute--ready { animation: none; }
      }

      .execute--ready:hover {
        background: color-mix(in srgb, var(--_phosphor) 15%, transparent);
      }

      .execute--ready:active {
        transform: scale(0.98);
      }

      .execute--ready:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      .execute:disabled {
        cursor: not-allowed;
        opacity: 0.25;
      }

      /* -- Phase Status (non-planning phases) -- */
      .status {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px 12px;
        font-family: var(--_mono);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--_phosphor-dim);
      }

      .status--resolving {
        color: var(--_phosphor);
      }

      /* -- Animations (opt-in: prefers-reduced-motion: no-preference) -- */
      @media (prefers-reduced-motion: no-preference) {
        .timer__fill {
          transition: width 100ms linear;
        }

        .timer--warning .timer__fill {
          transition: width 100ms linear, background 300ms;
        }

        .timer--critical .timer__seconds {
          animation: critical-pulse 0.8s ease-in-out infinite;
        }

        .timer--critical .timer__fill {
          animation: critical-bar-pulse 0.8s ease-in-out infinite;
        }

        .ability {
          transition: color 150ms, border-color 150ms, background 150ms;
        }

        .ability--selected {
          box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 40%, transparent);
        }

        .agent {
          transition: border-color 200ms;
        }

        .execute {
          transition: all 200ms;
        }

        .execute--ready {
          box-shadow: 0 0 12px color-mix(in srgb, var(--_phosphor-glow) 25%, transparent);
          animation: execute-breathe 2s ease-in-out infinite;
        }

        .status--resolving {
          animation: resolving-blink 1.5s step-end infinite;
        }
      }

      @keyframes critical-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      @keyframes critical-bar-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      @keyframes execute-breathe {
        0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--_phosphor-glow) 25%, transparent); }
        50% { box-shadow: 0 0 20px color-mix(in srgb, var(--_phosphor-glow) 50%, transparent); }
      }

      @keyframes resolving-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* -- Mobile (<=767px) -- */
      @media (max-width: 767px) {
        .agents {
          gap: 4px;
          padding: 6px;
        }

        .agent {
          padding: 4px 6px;
        }

        .agent__row {
          flex-wrap: wrap;
        }

        .ability {
          font-size: 11px;
          padding: 8px 12px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .target {
          font-size: 11px;
          padding: 8px 10px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .execute {
          min-height: 44px;
          font-size: 13px;
        }

        .footer {
          flex-direction: column;
          gap: 4px;
        }
      }

      /* -- Extra-small (<=640px) -- */
      @media (max-width: 640px) {
        .agent__condition {
          display: none;
        }

        .ability__check {
          display: none;
        }

        .timer__label {
          display: none;
        }
      }

      /* -- Large screens (1440px+) -- */
      @media (min-width: 1440px) {
        .timer__track {
          height: 10px;
        }

        .timer__seconds {
          font-size: 18px;
          min-width: 28px;
        }

        .ability {
          font-size: 11px;
          padding: 4px 10px;
        }

        .execute {
          font-size: 13px;
          padding: 10px 20px;
        }
      }

      /* -- Agent Done Badge -- */
      .agent__done {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        color: var(--_phosphor);
        letter-spacing: 1px;
        padding: 1px 4px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 50%, transparent);
        flex-shrink: 0;
      }

      /* -- Onboarding Briefing -- */
      .briefing {
        padding: 8px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        background: color-mix(in srgb, var(--_phosphor) 3%, var(--_screen-bg));
      }

      .briefing__header {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--_phosphor);
        margin-bottom: 6px;
        border-bottom: 1px solid color-mix(in srgb, var(--_phosphor) 20%, transparent);
        padding-bottom: 4px;
      }

      .briefing__steps {
        list-style: none;
        padding: 0;
        margin: 0 0 6px;
      }

      .briefing__step {
        font-family: var(--_mono);
        font-size: 9px;
        line-height: 1.6;
        color: var(--_phosphor-dim);
        padding-left: 16px;
        position: relative;
      }

      .briefing__step::before {
        content: attr(data-num);
        position: absolute;
        left: 0;
        color: var(--_phosphor);
        font-weight: 700;
      }

      .briefing__alt {
        font-family: var(--_mono);
        font-size: 8px;
        color: color-mix(in srgb, var(--_phosphor-dim) 60%, transparent);
        font-style: italic;
        margin-bottom: 6px;
      }

      .briefing__ack {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        padding: 4px 12px;
        background: transparent;
        color: var(--_phosphor);
        border: 1px solid var(--_phosphor-dim);
        cursor: pointer;
      }

      .briefing__ack:hover {
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        border-color: var(--_phosphor);
      }

      .briefing__ack:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 1px;
      }

      @media (prefers-reduced-motion: no-preference) {
        .briefing__ack::after {
          content: '\u2588';
          animation: cursor-blink 1s step-end infinite;
          margin-left: 4px;
        }
      }

      @keyframes cursor-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* -- Footer Hint -- */
      .footer__hint {
        font-family: var(--_mono);
        font-size: 8px;
        color: color-mix(in srgb, var(--_phosphor-dim) 50%, transparent);
        letter-spacing: 0.3px;
      }

      /* -- 4K / Ultra-wide (2560px+) -- */
      @media (min-width: 2560px) {
        .timer {
          padding: 8px 16px;
          gap: 12px;
        }

        .timer__track {
          height: 12px;
        }

        .timer__seconds {
          font-size: 20px;
          min-width: 32px;
        }

        .agents {
          gap: 4px;
          padding: 8px 12px;
        }

        .agent {
          padding: 6px 10px;
        }

        .agent__name {
          font-size: 11px;
        }

        .ability {
          font-size: 12px;
          padding: 5px 12px;
        }

        .execute {
          font-size: 14px;
          padding: 12px 24px;
          letter-spacing: 4px;
        }

        .counter {
          font-size: 10px;
        }
      }
    `,
  ];

  /** Agent ID currently awaiting target selection. */
  @state() private _targetingAgentId: string | null = null;

  /** Ability ID selected for the agent in targeting mode. */
  @state() private _targetingAbilityId: string | null = null;

  /** Combat onboarding briefing (shown once, persisted via localStorage). */
  @state() private _showOnboarding =
    !globalThis.localStorage?.getItem('dungeon_combat_onboarded');

  // -- Event Dispatch -------------------------------------------------------

  private _dispatchCommand(command: string): void {
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: command,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // -- Render ---------------------------------------------------------------

  protected render() {
    const phase = dungeonState.phase.value;
    if (!phase) return nothing;

    switch (phase) {
      case 'combat_planning':
      case 'boss':
        return this._renderPlanning();

      case 'combat_resolving':
        return html`
          <div class="combat-bar">
            <div class="status status--resolving" role="status" aria-live="polite">
              ${msg('Resolving...')}
            </div>
          </div>
        `;

      case 'combat_outcome':
        return html`
          <div class="combat-bar">
            <div class="status" role="status" aria-live="polite">
              ${msg('Round complete')}
            </div>
          </div>
        `;

      default:
        return nothing;
    }
  }

  private _renderPlanning() {
    const party = dungeonState.party.value;
    const combat = dungeonState.combat.value;
    const remaining = dungeonState.timerRemaining.value;
    const selected = dungeonState.selectedActions.value;
    const allSelected = dungeonState.allActionsSelected.value;
    const submitting = dungeonState.combatSubmitting.value;
    const enemies = combat?.enemies.filter((e) => e.is_alive) ?? [];

    const actionable = party.filter(
      (a) => a.condition !== 'captured' && a.available_abilities.length > 0,
    );

    return html`
      <div class="combat-bar" role="region" aria-label=${msg('Combat planning')}>
        ${this._showOnboarding ? this._renderOnboarding() : nothing}
        ${this._renderTimer(remaining, combat?.timer?.duration_ms ?? 30_000)}

        <div class="agents" role="list" aria-label=${msg('Agent actions')}>
          ${actionable.map((agent) =>
            this._renderAgent(agent, selected, enemies),
          )}
        </div>

        <div class="footer">
          <span class="counter" aria-live="polite">
            ${selected.size}/${actionable.length} ${msg('ACTIONS')}
          </span>
          <span class="footer__hint">${msg('or type "submit" in terminal')}</span>
          <button
            class="execute ${allSelected && !submitting ? 'execute--ready' : ''}"
            ?disabled=${!allSelected || submitting}
            @click=${this._handleSubmit}
            aria-label=${msg('Execute combat actions')}
          >
            ${submitting ? msg('Submitting...') : msg('Execute')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderTimer(remainingMs: number | null, totalMs: number) {
    if (remainingMs === null) return nothing;

    const seconds = Math.ceil(remainingMs / 1000);
    const pct = Math.max(0, (remainingMs / totalMs) * 100);
    const urgency =
      remainingMs <= TIMER_CRITICAL_MS
        ? 'critical'
        : remainingMs <= TIMER_WARNING_MS
          ? 'warning'
          : '';

    return html`
      <div
        class="timer ${urgency ? `timer--${urgency}` : ''}"
        role="timer"
        aria-label=${msg('Planning time remaining')}
      >
        <span class="timer__label">${msg('Time')}</span>
        <div class="timer__track">
          <div class="timer__fill" style="width: ${pct}%"></div>
        </div>
        <span class="timer__seconds">${seconds}</span>
      </div>
    `;
  }

  private _renderAgent(
    agent: AgentCombatStateClient,
    selected: Map<string, CombatAction>,
    enemies: EnemyCombatStateClient[],
  ) {
    const selection = selected.get(agent.agent_id);
    // Only show target picker if targeting state is valid AND ability still needs a target.
    // Prevents stale picker when switching from attack to self-targeting ability.
    const targetingAbility = this._targetingAbilityId
      ? agent.available_abilities.find((a) => a.id === this._targetingAbilityId)
      : null;
    const isTargeting =
      this._targetingAgentId === agent.agent_id &&
      !!targetingAbility &&
      targetingAbility.targets !== 'self' &&
      targetingAbility.targets !== 'all_enemies' &&
      targetingAbility.targets !== 'all_allies';
    const hasSelection = !!selection;

    const stripClass = [
      'agent',
      hasSelection ? 'agent--selected' : '',
      isTargeting ? 'agent--targeting' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div
        class=${stripClass}
        role="listitem"
        aria-label=${`${agent.agent_name} ${msg('actions')}`}
      >
        <div class="agent__row">
          <span class="agent__name">${agent.agent_name}</span>
          ${hasSelection
            ? html`<span class="agent__done" aria-label=${msg('Action selected')}>${msg('OK')}</span>`
            : nothing}
          <span class="agent__condition">${getConditionLabel(agent.condition)}</span>
          <div class="agent__abilities" role="radiogroup" aria-label=${msg('Abilities')}>
            ${agent.available_abilities.map((ability) =>
              this._renderAbility(agent, ability, selection?.ability_id ?? null, enemies),
            )}
          </div>
        </div>
        ${isTargeting
          ? this._renderTargetPicker(agent, enemies)
          : nothing}
      </div>
    `;
  }

  private _renderAbility(
    agent: AgentCombatStateClient,
    ability: AbilityOption,
    selectedId: string | null,
    enemies: EnemyCombatStateClient[],
  ) {
    const isSelected = ability.id === selectedId;
    const onCooldown = ability.cooldown_remaining > 0;

    const classes = [
      'ability',
      isSelected ? 'ability--selected' : '',
      onCooldown ? 'ability--cooldown' : '',
      ability.is_ultimate ? 'ability--ultimate' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <button
        class=${classes}
        ?disabled=${onCooldown}
        role="radio"
        aria-checked=${isSelected ? 'true' : 'false'}
        title=${ability.description}
        @click=${() => this._handleAbilityClick(agent, ability, enemies)}
      >
        ${ability.is_ultimate ? '\u2605 ' : ''}${ability.name}${onCooldown
          ? html`<span class="ability__cd"> [${ability.cooldown_remaining}]</span>`
          : nothing}${ability.check_info
          ? html`<span class="ability__check"> ${ability.check_info}</span>`
          : nothing}
      </button>
    `;
  }

  private _renderTargetPicker(
    agent: AgentCombatStateClient,
    enemies: EnemyCombatStateClient[],
  ) {
    // Determine if targeting allies or enemies based on selected ability
    const selectedAbility = agent.available_abilities.find(
      (a) => a.id === this._targetingAbilityId,
    );
    if (selectedAbility?.targets === 'single_ally') {
      const allies = dungeonState.party.value.filter(
        (a) => a.agent_id !== agent.agent_id && a.condition !== 'captured',
      );
      return this._renderAllyTargets(allies);
    }
    return this._renderTargets(enemies);
  }

  private _renderAllyTargets(allies: AgentCombatStateClient[]) {
    return html`
      <div class="targets" role="listbox" aria-label=${msg('Select ally')}>
        <span class="targets__label">\u25BA ${msg('Ally')}:</span>
        ${allies.map(
          (ally) => html`
            <button
              class="target target--ally"
              role="option"
              @click=${() => this._handleTargetClick(ally.agent_id)}
            >
              ${ally.agent_name}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderTargets(enemies: EnemyCombatStateClient[]) {
    // Disambiguate enemies with the same name by appending condition or letter suffix
    const nameCounts = new Map<string, number>();
    for (const e of enemies) {
      nameCounts.set(e.name_en, (nameCounts.get(e.name_en) ?? 0) + 1);
    }
    const nameIndexes = new Map<string, number>();

    return html`
      <div class="targets" role="listbox" aria-label=${msg('Select target')}>
        <span class="targets__label">\u25BA ${msg('Target')}:</span>
        ${enemies.map((enemy) => {
          let label = enemy.name_en;
          if ((nameCounts.get(enemy.name_en) ?? 0) > 1) {
            const idx = nameIndexes.get(enemy.name_en) ?? 0;
            nameIndexes.set(enemy.name_en, idx + 1);
            const suffix = String.fromCharCode(65 + idx); // A, B, C...
            const cond = enemy.condition_display !== 'healthy' ? ` ${enemy.condition_display}` : '';
            label = `${enemy.name_en} ${suffix}${cond}`;
          }
          return html`
            <button
              class="target"
              role="option"
              @click=${() => this._handleTargetClick(enemy.instance_id)}
            >
              ${label}
            </button>
          `;
        })}
      </div>
    `;
  }

  // -- Handlers -------------------------------------------------------------

  private _handleAbilityClick(
    agent: AgentCombatStateClient,
    ability: AbilityOption,
    enemies: EnemyCombatStateClient[],
  ): void {
    if (ability.cooldown_remaining > 0) return;

    // Auto-dismiss onboarding briefing on first ability selection (UX-04)
    if (this._showOnboarding) this._dismissOnboarding();

    const alive = enemies.filter((e) => e.is_alive);

    // Self-targeting (Observe, Taunt, Fortify, Evade): 1 click, auto-target self
    if (ability.targets === 'self') {
      dungeonState.selectAction(agent.agent_id, ability.id, agent.agent_id);
      this._clearTargeting();
      return;
    }

    // All-target (Rally, Detonate): 1 click, no target needed
    if (ability.targets === 'all_enemies' || ability.targets === 'all_allies') {
      dungeonState.selectAction(agent.agent_id, ability.id);
      this._clearTargeting();
      return;
    }

    // Single ally target (Shield, Inspire): auto-pick if only 1 other ally
    if (ability.targets === 'single_ally') {
      const allies = dungeonState.party.value.filter(
        (a) => a.agent_id !== agent.agent_id && a.condition !== 'captured',
      );
      if (allies.length <= 1) {
        dungeonState.selectAction(agent.agent_id, ability.id, allies[0]?.agent_id);
        this._clearTargeting();
        return;
      }
      // Multiple allies: enter targeting mode for ally selection
      this._targetingAgentId = agent.agent_id;
      this._targetingAbilityId = ability.id;
      return;
    }

    // Single enemy: auto-target if 1 alive, else target picker
    if (alive.length <= 1) {
      dungeonState.selectAction(agent.agent_id, ability.id, alive[0]?.instance_id);
      this._clearTargeting();
      return;
    }

    // Multiple enemies: enter targeting mode
    this._targetingAgentId = agent.agent_id;
    this._targetingAbilityId = ability.id;
  }

  private _clearTargeting(): void {
    this._targetingAgentId = null;
    this._targetingAbilityId = null;
  }

  private _renderOnboarding() {
    return html`
      <div class="briefing" role="note" aria-label=${msg('Combat briefing')}>
        <div class="briefing__header">${msg('Combat briefing')}</div>
        <ol class="briefing__steps">
          <li class="briefing__step" data-num="1.">${msg('Click an ability for each agent below')}</li>
          <li class="briefing__step" data-num="2.">${msg('Self-abilities auto-target -- one click')}</li>
          <li class="briefing__step" data-num="3.">${msg('Attack abilities require an enemy target')}</li>
          <li class="briefing__step" data-num="4.">${msg('Press EXECUTE when all agents have orders')}</li>
        </ol>
        <div class="briefing__alt">${msg('Or type "attack <agent> <ability> [target]" + "submit" in terminal')}</div>
        <button class="briefing__ack" @click=${this._dismissOnboarding}>
          ${msg('Acknowledged')}
        </button>
      </div>
    `;
  }

  private _dismissOnboarding(): void {
    this._showOnboarding = false;
    globalThis.localStorage?.setItem('dungeon_combat_onboarded', '1');
  }

  private _handleTargetClick(targetId: string): void {
    if (this._targetingAgentId && this._targetingAbilityId) {
      dungeonState.selectAction(this._targetingAgentId, this._targetingAbilityId, targetId);
    }
    this._targetingAgentId = null;
    this._targetingAbilityId = null;
  }

  private _handleSubmit(): void {
    if (!dungeonState.allActionsSelected.value || dungeonState.combatSubmitting.value) return;
    this._dispatchCommand('submit');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-combat-bar': VelgDungeonCombatBar;
  }
}
