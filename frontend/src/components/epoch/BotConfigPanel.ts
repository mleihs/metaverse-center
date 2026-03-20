/**
 * Bot Deployment Console — "Deck Builder" interface for bot opponents.
 *
 * Military-HUD slide-out panel where users build a reusable "deck" of bot
 * personality presets and deploy them into epoch lobbies. Collectible-card
 * aesthetic with personality-specific accent colors, radar mini-charts,
 * and scan-line textures.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, svg as litSvg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { botApi } from '../../services/api/BotApiService.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import type {
  BotDifficulty,
  BotPersonality,
  BotPlayer,
  EpochParticipant,
  Simulation,
} from '../../types/index.js';
import { PERSONALITY_COLORS } from '../../utils/bot-colors.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSidePanel.js';

// ── Personality metadata ────────────────────────────────────

interface PersonalityMeta {
  key: BotPersonality;
  abbr: string;
  color: string;
  icon: (size?: number) => unknown;
  stats: [number, number, number, number, number]; // OFF, DEF, DIP, INT, CHAOS (0-10)
}

function getPersonalities(): PersonalityMeta[] {
  return [
    {
      key: 'sentinel',
      abbr: 'SNTL',
      color: PERSONALITY_COLORS.sentinel,
      icon: icons.botSentinel,
      stats: [2, 9, 5, 5, 1],
    },
    {
      key: 'warlord',
      abbr: 'WLRD',
      color: PERSONALITY_COLORS.warlord,
      icon: icons.botWarlord,
      stats: [9, 3, 1, 4, 2],
    },
    {
      key: 'diplomat',
      abbr: 'DIPL',
      color: PERSONALITY_COLORS.diplomat,
      icon: icons.botDiplomat,
      stats: [3, 4, 9, 5, 2],
    },
    {
      key: 'strategist',
      abbr: 'STRT',
      color: PERSONALITY_COLORS.strategist,
      icon: icons.botStrategist,
      stats: [6, 6, 5, 9, 1],
    },
    {
      key: 'chaos',
      abbr: 'KAOS',
      color: PERSONALITY_COLORS.chaos,
      icon: icons.botChaos,
      stats: [5, 3, 3, 2, 10],
    },
  ];
}

function getPersonalityDescriptions(): Record<BotPersonality, string> {
  return {
    sentinel: msg(
      'Defensive specialist. Deploys guardians and spies. Seeks alliances early, never betrays. Wins by outlasting.',
    ),
    warlord: msg(
      'Aggressive attacker. Focuses fire on the leader with assassins and saboteurs. Betrays allies who become threats.',
    ),
    diplomat: msg(
      'Alliance builder. Spreads operatives across targets. Uses diplomatic bonus. Loyal to partners.',
    ),
    strategist: msg(
      'Adaptive counter-strategist. Detects the dominant strategy and counters it. Heavy spy investment.',
    ),
    chaos: msg(
      'Unpredictable wildcard. Random strategies each cycle. Forms and breaks alliances on a whim.',
    ),
  };
}

const DIFFICULTY_META: Record<BotDifficulty, { label: string; color: string }> = {
  easy: { label: 'LOW', color: 'var(--color-success)' },
  medium: { label: 'MED', color: 'var(--color-primary-hover)' },
  hard: { label: 'HGH', color: 'var(--color-danger)' },
};

const BAR_LABELS = ['OFF', 'DEF', 'DIP', 'INT', 'RNG'];

// ── Radar chart helper ──────────────────────────────────────

function renderRadar(stats: [number, number, number, number, number], color: string, size = 40) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const n = 5;

  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const ptAt = (i: number, val: number) => {
    const a = angleOf(i);
    const d = (val / 10) * r;
    return `${cx + d * Math.cos(a)},${cy + d * Math.sin(a)}`;
  };

  const axes = Array.from({ length: n }, (_, i) => {
    const a = angleOf(i);
    return litSvg`<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}"
      stroke="${color}" stroke-opacity="0.15" stroke-width="0.5" />`;
  });

  const polygon = stats.map((v, i) => ptAt(i, v)).join(' ');

  return litSvg`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      ${axes}
      <polygon points="${polygon}" fill="${color}" fill-opacity="0.25"
        stroke="${color}" stroke-opacity="0.7" stroke-width="1" />
    </svg>
  `;
}

@localized()
@customElement('velg-bot-config-panel')
export class VelgBotConfigPanel extends LitElement {
  static styles = css`
    :host {
      --panel-bg: var(--color-surface-sunken);
      --surface: var(--color-surface);
      --surface-raised: var(--color-surface-raised);
      --border-dim: var(--color-border);
      --text-bright: var(--color-text-primary);
      --text-mid: var(--color-text-tertiary);
      --text-dim: var(--color-text-muted);
      --accent: var(--color-info);
    }

    velg-side-panel {
      --color-surface-raised: var(--color-surface-sunken);
      --color-surface-header: var(--color-surface);
      --color-text-primary: var(--color-text-primary);
      --border-default: 1px solid var(--color-border);
      --border-medium: 1px solid var(--color-border);
    }

    .panel-body {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-5, 20px);
      padding: var(--space-4, 16px);
      background: var(--panel-bg);
      min-height: 100%;
    }

    .panel-body::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255 255 255 / 0.012) 2px,
        rgba(255 255 255 / 0.012) 4px
      );
      z-index: 0;
    }

    .panel-body > * {
      position: relative;
      z-index: 1;
    }

    /* ── Section headers with corner brackets ── */
    .section-label {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin: 0 0 var(--space-3, 12px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .section-label::before {
      content: '┌─';
      color: var(--accent);
      opacity: 0.5;
    }

    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border-dim);
    }

    /* ── Deck list (saved presets) ── */
    .deck-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .deck-card {
      display: grid;
      grid-template-columns: 28px 1fr auto auto auto;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--surface);
      border-left: 2px solid var(--border-dim);
      transition: border-color 0.15s, background 0.15s;
      animation: deck-enter 300ms ease both;
      animation-delay: calc(var(--i, 0) * 60ms);
      cursor: pointer;
    }

    .deck-card:hover {
      border-left-color: var(--card-accent, var(--accent));
      background: color-mix(in srgb, var(--card-accent, var(--accent)) 5%, var(--surface));
    }

    .deck-card--selected {
      border-left-color: var(--card-accent, var(--accent));
      background: color-mix(in srgb, var(--card-accent, var(--accent)) 10%, var(--surface));
    }

    @keyframes deck-enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .deck-card__icon {
      color: var(--card-accent, var(--text-dim));
      display: flex;
      align-items: center;
    }

    .deck-card__info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .deck-card__name {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      font-weight: 700;
      color: var(--text-bright);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .deck-card__type {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      letter-spacing: 2px;
      color: var(--card-accent, var(--text-dim));
      text-transform: uppercase;
    }

    .diff-badge {
      padding: 1px 6px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 1.5px;
      border: 1px solid currentColor;
      white-space: nowrap;
    }

    .deck-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-dim);
      color: var(--text-dim);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
      padding: 0;
    }

    .deck-btn:hover {
      border-color: var(--card-accent, var(--accent));
      color: var(--card-accent, var(--accent));
    }

    .deck-btn--danger:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    /* ── Personality card grid ── */
    .personality-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2, 8px);
    }

    .personality-grid .pcard:last-child:nth-child(odd) {
      grid-column: 1 / -1;
      max-width: calc(50% - 4px);
      justify-self: center;
    }

    .pcard {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1, 4px);
      padding: var(--space-3, 12px) var(--space-2, 8px);
      background: var(--surface);
      border: 1px solid var(--border-dim);
      cursor: pointer;
      transition: all 0.2s;
      overflow: hidden;
      animation: pcard-enter 350ms ease both;
      animation-delay: calc(var(--i, 0) * 80ms);
    }

    @keyframes pcard-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Scan-line sweep on hover */
    .pcard::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(255 255 255 / 0.03) 3px,
        rgba(255 255 255 / 0.03) 6px
      );
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }

    .pcard:hover::after {
      opacity: 1;
    }

    .pcard:hover {
      border-color: var(--pcard-color);
      transform: translateY(-1px);
    }

    .pcard--selected {
      border-color: var(--pcard-color);
      background: color-mix(in srgb, var(--pcard-color) 12%, var(--surface));
      box-shadow: 0 0 12px color-mix(in srgb, var(--pcard-color) 25%, transparent);
      transform: scale(1.02);
    }

    .pcard__icon {
      color: var(--pcard-color);
      margin-bottom: var(--space-1, 4px);
    }

    .pcard__abbr {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 3px;
      color: var(--pcard-color);
    }

    .pcard__radar {
      margin: var(--space-1, 4px) 0;
    }

    /* ── Difficulty toggle ── */
    .diff-toggle {
      display: flex;
      border: 1px solid var(--border-dim);
      overflow: hidden;
      position: relative;
    }

    .diff-toggle__segment {
      flex: 1;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: transparent;
      border: none;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-dim);
      cursor: pointer;
      transition: color 0.2s, background 0.2s;
      position: relative;
      z-index: 1;
    }

    .diff-toggle__segment:not(:last-child) {
      border-right: 1px solid var(--border-dim);
    }

    .diff-toggle__segment--active {
      color: var(--panel-bg);
      background: var(--diff-color);
    }

    .diff-toggle__segment:hover:not(.diff-toggle__segment--active) {
      color: var(--text-mid);
      background: color-mix(in srgb, var(--diff-color) 8%, transparent);
    }

    .diff-toggle__segment:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }

    /* ── Callsign input ── */
    .callsign-input {
      width: 100%;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--surface);
      border: 1px solid var(--border-dim);
      color: var(--text-bright);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      letter-spacing: 1px;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .callsign-input::placeholder {
      color: var(--text-dim);
      letter-spacing: 2px;
    }

    .callsign-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
    }

    /* ── Behavior matrix ── */
    .matrix {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .matrix__row {
      display: grid;
      grid-template-columns: 32px 1fr;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .matrix__label {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--text-dim);
      text-align: right;
    }

    .matrix__bar-track {
      height: 8px;
      background: var(--surface);
      border: 1px solid color-mix(in srgb, var(--border-dim) 50%, transparent);
      overflow: hidden;
    }

    .matrix__bar-fill {
      height: 100%;
      background: var(--bar-color);
      transform-origin: left;
      transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* ── Expandable sections ── */
    .expandable {
      border: 1px solid var(--border-dim);
      background: var(--surface);
    }

    .expandable__trigger {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      width: 100%;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: transparent;
      border: none;
      color: var(--text-mid);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: color 0.15s;
    }

    .expandable__trigger:hover {
      color: var(--text-bright);
    }

    .expandable__trigger svg {
      transition: transform 0.2s;
    }

    .expandable__trigger--open svg {
      transform: rotate(90deg);
    }

    .expandable__body {
      padding: 0 var(--space-3, 12px) var(--space-3, 12px);
    }

    .profile-text {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      line-height: 1.6;
      color: var(--text-mid);
      margin: 0;
    }

    /* ── Deploy section ── */
    .deploy-section {
      border: 1px solid var(--border-dim);
      padding: var(--space-3, 12px);
      background: var(--surface);
    }

    .sim-select {
      width: 100%;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--panel-bg);
      border: 1px solid var(--border-dim);
      color: var(--text-bright);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-sm, 13px);
      outline: none;
      margin-bottom: var(--space-3, 12px);
      box-sizing: border-box;
    }

    .sim-select:focus {
      border-color: var(--accent);
    }

    /* ── Action buttons ── */
    .action-btn {
      display: block;
      width: 100%;
      padding: var(--space-3, 12px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .action-btn--forge {
      background: var(--accent);
      color: var(--panel-bg);
    }

    .action-btn--forge:hover:not(:disabled) {
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 30%, transparent);
      transform: translateY(-1px);
    }

    .action-btn--deploy {
      background: var(--color-success);
      color: var(--panel-bg);
    }

    .action-btn--deploy:hover:not(:disabled) {
      box-shadow: 0 0 16px var(--color-success-border);
      transform: translateY(-1px);
    }

    .action-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .action-btn--success {
      background: var(--color-success) !important;
      animation: deploy-flash 600ms ease;
    }

    @keyframes deploy-flash {
      0%,
      100% {
        box-shadow: none;
      }
      50% {
        box-shadow: 0 0 24px var(--color-success-border);
      }
    }

    /* ── Empty state ── */
    .empty-state {
      padding: var(--space-5, 20px);
      text-align: center;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--text-dim);
      text-transform: uppercase;
      line-height: 1.8;
    }

    .field-label {
      display: block;
      margin-bottom: var(--space-1, 4px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: var(--text-dim);
      text-transform: uppercase;
    }

    .form-gap {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }
  `;

  @property({ type: Boolean }) open = false;
  @property() epochId = '';
  @property({ type: Array }) participants: EpochParticipant[] = [];

  @state() private _allSimulations: Simulation[] = [];
  @state() private _presets: BotPlayer[] = [];
  @state() private _selectedPresetId = '';
  @state() private _name = '';
  @state() private _personality: BotPersonality = 'sentinel';
  @state() private _difficulty: BotDifficulty = 'medium';
  @state() private _selectedSimId = '';
  @state() private _loading = false;
  @state() private _deploying = false;
  @state() private _deploySuccess = false;
  @state() private _showProfile = false;
  @state() private _showMatrix = false;

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open) {
      this._loadPresets();
      this._loadAllSimulations();
    }
  }

  private async _loadAllSimulations(): Promise<void> {
    const result = await simulationsApi.listPublic();
    if (result.success && result.data) {
      this._allSimulations = (result.data as Simulation[]).filter(
        (s) => !s.simulation_type || s.simulation_type === 'template',
      );
    }
  }

  private async _loadPresets(): Promise<void> {
    const result = await botApi.listPresets();
    if (result.success && result.data) {
      this._presets = result.data as BotPlayer[];
    }
  }

  private _getAvailableSims(): Simulation[] {
    const joinedSimIds = new Set(this.participants.map((p) => p.simulation_id));
    return this._allSimulations.filter((s) => !joinedSimIds.has(s.id));
  }

  private _getPersonalityMeta(key: BotPersonality): PersonalityMeta {
    return getPersonalities().find((p) => p.key === key) ?? getPersonalities()[0];
  }

  // ── Event handlers ──────────────────────────────────────

  private async _handleForge(): Promise<void> {
    if (!this._name.trim() || this._loading) return;
    this._loading = true;

    const result = await botApi.createPreset({
      name: this._name.trim(),
      personality: this._personality,
      difficulty: this._difficulty,
    });

    if (result.success && result.data) {
      const created = result.data as BotPlayer;
      VelgToast.success(msg(str`Unit "${created.name}" forged.`));
      this._name = '';
      this._selectedPresetId = created.id;
      await this._loadPresets();
    } else {
      VelgToast.error(msg('Failed to create bot.'));
    }
    this._loading = false;
  }

  private async _handleDelete(botId: string, e: Event): Promise<void> {
    e.stopPropagation();
    const result = await botApi.deletePreset(botId);
    if (result.success) {
      if (this._selectedPresetId === botId) this._selectedPresetId = '';
      await this._loadPresets();
      VelgToast.success(msg('Bot removed from deck.'));
    }
  }

  private async _handleDeploy(): Promise<void> {
    const preset = this._presets.find((p) => p.id === this._selectedPresetId);
    if (!preset || !this._selectedSimId || this._deploying) return;
    this._deploying = true;

    const result = await botApi.addBotToEpoch(this.epochId, preset.id, this._selectedSimId);

    if (result.success && result.data) {
      this._deploySuccess = true;
      setTimeout(() => {
        this._deploySuccess = false;
      }, 600);
      VelgToast.success(msg(str`${preset.name} deployed.`));
      this._selectedSimId = '';
      this.dispatchEvent(
        new CustomEvent('bot-added', {
          detail: result.data,
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      VelgToast.error(msg('Failed to deploy bot.'));
    }
    this._deploying = false;
  }

  private _handleQuickAdd(botId: string, e: Event): void {
    e.stopPropagation();
    const sims = this._getAvailableSims();
    if (sims.length === 0) {
      VelgToast.info(msg('All simulations are already in the epoch.'));
      return;
    }
    this._selectedPresetId = botId;
    if (sims.length === 1) {
      this._selectedSimId = sims[0].id;
      this._handleDeploy();
    } else {
      // 2+ sims: select preset and scroll deploy section into view
      this.updateComplete.then(() => {
        this.renderRoot
          .querySelector('.deploy-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  private _selectPreset(id: string): void {
    this._selectedPresetId = this._selectedPresetId === id ? '' : id;
    const preset = this._presets.find((p) => p.id === id);
    if (preset) {
      this._personality = preset.personality;
      this._difficulty = preset.difficulty;
    }
  }

  private _handleDifficultyKey(e: KeyboardEvent, difficulties: BotDifficulty[]): void {
    const idx = difficulties.indexOf(this._difficulty);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this._difficulty = difficulties[Math.min(idx + 1, difficulties.length - 1)];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this._difficulty = difficulties[Math.max(idx - 1, 0)];
    }
  }

  private _onClose(): void {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  // ── Render ──────────────────────────────────────────────

  protected render() {
    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${msg('Bot Deployment Console')}
        @panel-close=${this._onClose}
      >
        <div class="panel-body" slot="content">
          ${this._renderDeck()} ${this._renderForge()} ${this._renderDeploy()}
        </div>
      </velg-side-panel>
    `;
  }

  private _renderDeck() {
    return html`
      <div>
        <div class="section-label">${msg('Your Deck')}</div>
        ${
          this._presets.length > 0
            ? html`
              <div class="deck-list">
                ${this._presets.map((bot, i) => {
                  const meta = this._getPersonalityMeta(bot.personality);
                  const diffMeta =
                    DIFFICULTY_META[bot.difficulty as BotDifficulty] ?? DIFFICULTY_META.medium;
                  const isSelected = this._selectedPresetId === bot.id;
                  return html`
                    <div
                      class="deck-card ${isSelected ? 'deck-card--selected' : ''}"
                      style="--i:${i}; --card-accent:${meta.color}"
                      @click=${() => this._selectPreset(bot.id)}
                    >
                      <span class="deck-card__icon">${meta.icon(18)}</span>
                      <div class="deck-card__info">
                        <span class="deck-card__name">${bot.name}</span>
                        <span class="deck-card__type">${meta.abbr}</span>
                      </div>
                      <span
                        class="diff-badge"
                        style="color:${diffMeta.color}; border-color:${diffMeta.color}"
                        >${diffMeta.label}</span
                      >
                      <button
                        class="deck-btn"
                        title=${msg('Quick deploy')}
                        aria-label=${msg(str`Quick deploy ${bot.name}`)}
                        @click=${(e: Event) => this._handleQuickAdd(bot.id, e)}
                      >
                        +
                      </button>
                      <button
                        class="deck-btn deck-btn--danger"
                        title=${msg('Remove from deck')}
                        aria-label=${msg(str`Remove ${bot.name} from deck`)}
                        @click=${(e: Event) => this._handleDelete(bot.id, e)}
                      >
                        ×
                      </button>
                    </div>
                  `;
                })}
              </div>
            `
            : html`
              <div class="empty-state">
                ${msg('No bots in your deck.')}<br />
                ${msg('Forge one below.')}
              </div>
            `
        }
      </div>
    `;
  }

  private _renderForge() {
    const personalities = getPersonalities();
    const selectedMeta = this._getPersonalityMeta(this._personality);
    const descriptions = getPersonalityDescriptions();
    const difficulties: BotDifficulty[] = ['easy', 'medium', 'hard'];

    return html`
      <div>
        <div class="section-label">${msg('Forge New Unit')}</div>
        <div class="form-gap">
          <!-- Callsign -->
          <div>
            <label class="field-label">${msg('Callsign')}</label>
            <input
              class="callsign-input"
              type="text"
              maxlength="50"
              placeholder=${msg('e.g. Sentinel Alpha')}
              .value=${this._name}
              @input=${(e: InputEvent) => {
                this._name = (e.target as HTMLInputElement).value;
              }}
            />
          </div>

          <!-- Personality grid -->
          <div>
            <label class="field-label">${msg('Personality')}</label>
            <div class="personality-grid">
              ${personalities.map(
                (p, i) => html`
                  <div
                    class="pcard ${this._personality === p.key ? 'pcard--selected' : ''}"
                    style="--i:${i}; --pcard-color:${p.color}"
                    @click=${() => {
                      this._personality = p.key;
                    }}
                    role="radio"
                    aria-checked=${this._personality === p.key}
                    tabindex="0"
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._personality = p.key;
                      }
                    }}
                  >
                    <span class="pcard__icon">${p.icon(28)}</span>
                    <span class="pcard__abbr">${p.abbr}</span>
                    <span class="pcard__radar">
                      ${renderRadar(p.stats, p.color, 44)}
                    </span>
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- Difficulty toggle -->
          <div>
            <label class="field-label">${msg('Threat Level')}</label>
            <div class="diff-toggle" role="radiogroup" aria-label=${msg('Difficulty')}>
              ${difficulties.map((d) => {
                const meta = DIFFICULTY_META[d];
                const isActive = this._difficulty === d;
                return html`
                  <button
                    class="diff-toggle__segment ${isActive ? 'diff-toggle__segment--active' : ''}"
                    style="--diff-color:${meta.color}"
                    role="radio"
                    aria-checked=${isActive}
                    @click=${() => {
                      this._difficulty = d;
                    }}
                    @keydown=${(e: KeyboardEvent) => this._handleDifficultyKey(e, difficulties)}
                  >
                    ${meta.label}
                  </button>
                `;
              })}
            </div>
          </div>

          <!-- Tactical Profile (expandable) -->
          <div class="expandable">
            <button
              class="expandable__trigger ${this._showProfile ? 'expandable__trigger--open' : ''}"
              @click=${() => {
                this._showProfile = !this._showProfile;
              }}
            >
              ${icons.chevronRight(10)} ${msg('Tactical Profile')}
            </button>
            ${
              this._showProfile
                ? html`
                  <div class="expandable__body">
                    <p class="profile-text">${descriptions[this._personality]}</p>
                  </div>
                `
                : nothing
            }
          </div>

          <!-- Behavior Matrix (expandable) -->
          <div class="expandable">
            <button
              class="expandable__trigger ${this._showMatrix ? 'expandable__trigger--open' : ''}"
              @click=${() => {
                this._showMatrix = !this._showMatrix;
              }}
            >
              ${icons.chevronRight(10)} ${msg('Behavior Matrix')}
            </button>
            ${
              this._showMatrix
                ? html`
                  <div class="expandable__body">
                    <div class="matrix">
                      ${selectedMeta.stats.map(
                        (val, i) => html`
                          <div class="matrix__row">
                            <span class="matrix__label">${BAR_LABELS[i]}</span>
                            <div class="matrix__bar-track">
                              <div
                                class="matrix__bar-fill"
                                style="width:${val * 10}%; background:${selectedMeta.color}; opacity:${0.4 + (val / 10) * 0.6}"
                              ></div>
                            </div>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
                : nothing
            }
          </div>

          <!-- Forge button -->
          <button
            class="action-btn action-btn--forge"
            style="--accent:${selectedMeta.color}"
            ?disabled=${!this._name.trim() || this._loading}
            @click=${this._handleForge}
          >
            ${this._loading ? msg('Forging...') : msg('Forge Unit')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderDeploy() {
    const sims = this._getAvailableSims();
    const hasPreset = this._selectedPresetId !== '';
    if (!hasPreset) return nothing;

    const preset = this._presets.find((p) => p.id === this._selectedPresetId);
    if (!preset) return nothing;

    return html`
      <div>
        <div class="section-label">${msg('Deploy to Epoch')}</div>
        <div class="deploy-section">
          ${
            sims.length > 0
              ? html`
                <label class="field-label">${msg('Assign Simulation')}</label>
                <select
                  class="sim-select"
                  .value=${this._selectedSimId}
                  @change=${(e: Event) => {
                    this._selectedSimId = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="">${msg('Select simulation...')}</option>
                  ${sims.map((s) => html`<option value=${s.id}>${s.name}</option>`)}
                </select>
                <button
                  class="action-btn action-btn--deploy ${this._deploySuccess ? 'action-btn--success' : ''}"
                  ?disabled=${!this._selectedSimId || this._deploying}
                  @click=${this._handleDeploy}
                >
                  ${this._deploying ? msg('Deploying...') : msg(str`Deploy ${preset.name}`)}
                </button>
              `
              : html`
                <div class="empty-state">
                  ${msg('All simulations are already in the epoch.')}
                </div>
              `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bot-config-panel': VelgBotConfigPanel;
  }
}
