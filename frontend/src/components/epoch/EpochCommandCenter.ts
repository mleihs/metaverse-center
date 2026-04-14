/**
 * Epoch Command Center — the competitive PvP dashboard.
 *
 * Platform-level page at /epoch. Shows:
 * - Active epoch status + countdown
 * - Leaderboard with per-dimension score bars
 * - Battle log (narrative event feed)
 * - Operations panel (your missions, threats, quick actions)
 * - Alliance status
 *
 * When no epoch is active, shows the lobby view with past epochs + create button.
 */

import { localized, msg, str } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/AgentsApiService.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import { seoService } from '../../services/SeoService.js';
import type {
  Agent,
  AgentAptitude,
  AptitudeSet,
  BattleLogEntry,
  Epoch,
  EpochParticipant,
  EpochTeam,
  LeaderboardEntry,
  OperativeMission,
  OperativeType,
} from '../../types/index.js';
import { computePhaseCycles, computeTotalCycles } from '../../utils/epoch.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/LoadingState.js';
import '../shared/EmptyState.js';
import './EpochLeaderboard.js';
import './EpochBattleLog.js';
import './EpochCreationWizard.js';
import './DeployOperativeModal.js';
import './EpochInvitePanel.js';
import './EpochChatPanel.js';
import './EpochPresenceIndicator.js';
import './EpochReadyPanel.js';
import './EpochOpsBoard.js';
import './EpochOverviewTab.js';
import './EpochOperationsTab.js';
import './EpochAlliancesTab.js';
import './EpochIntelDossierTab.js';
import './EpochLobbyActions.js';
import './BotConfigPanel.js';
import './DraftRosterPanel.js';
import './WarRoomPanel.js';
import './EpochResultsView.js';
import '../terminal/EpochTerminalView.js';

type TabId =
  | 'overview'
  | 'leaderboard'
  | 'operations'
  | 'battle-log'
  | 'war-room'
  | 'alliances'
  | 'chat'
  | 'terminal'
  | 'results';

@localized()
@customElement('velg-epoch-command-center')
export class VelgEpochCommandCenter extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height, 56px));
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    /* ── Status Banner ────────────────────────── */

    .banner {
      position: relative;
      border-bottom: 3px solid var(--color-border);
    }

    .banner__bg {
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255 255 255 / 0.02) 2px,
          rgba(255 255 255 / 0.02) 4px
        );
      pointer-events: none;
    }

    .banner__inner {
      position: relative;
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: var(--space-6) var(--space-6) var(--space-4);
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-4);
      align-items: end;
    }

    .banner__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-3xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      line-height: 1;
    }

    .banner__sub {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: var(--space-1) 0 0;
    }

    .banner__phase {
      display: inline-block;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
    }

    .banner__phase--lobby {
      border-color: var(--color-text-muted);
      color: var(--color-text-tertiary);
    }
    .banner__phase--foundation {
      border-color: var(--color-success);
      color: var(--color-success);
      box-shadow: 0 0 8px rgba(74 222 128 / 0.3);
    }
    .banner__phase--competition {
      border-color: var(--color-warning);
      color: var(--color-warning);
      box-shadow: 0 0 8px rgba(245 158 11 / 0.3);
    }
    .banner__phase--reckoning {
      border-color: var(--color-danger);
      color: var(--color-danger);
      box-shadow: 0 0 12px rgba(239 68 68 / 0.4);
      animation: pulse-glow 2s ease-in-out infinite;
    }
    .banner__phase--completed {
      border-color: var(--color-border);
      color: var(--color-text-muted);
    }
    .banner__phase--cancelled {
      border-color: var(--color-border);
      color: var(--color-text-muted);
      text-decoration: line-through;
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 12px rgba(239 68 68 / 0.4); }
      50% { box-shadow: 0 0 20px rgba(239 68 68 / 0.7); }
    }

    /* ── Phase Stepper ─────────────────────────── */

    .stepper {
      display: flex;
      align-items: center;
      gap: 0;
      margin-top: var(--space-2);
    }

    .stepper__step {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      position: relative;
    }

    .stepper__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid;
      flex-shrink: 0;
      position: relative;
    }

    .stepper__dot--completed {
      background: var(--color-success);
      border-color: var(--color-success);
    }

    .stepper__dot--completed::after {
      content: '\u2713';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      font-weight: 900;
      color: var(--color-text-inverse);
    }

    .stepper__dot--active {
      border-color: var(--stepper-color, var(--color-warning));
      background: var(--stepper-color, var(--color-warning));
      animation: stepper-pulse 2s ease-in-out infinite;
    }

    .stepper__dot--upcoming {
      border-color: var(--color-border);
      background: transparent;
    }

    @keyframes stepper-pulse {
      0%, 100% { box-shadow: 0 0 4px rgba(245 158 11 / 0.4); }
      50% { box-shadow: 0 0 10px rgba(245 158 11 / 0.7); }
    }

    .stepper__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .stepper__label--completed {
      color: var(--color-success);
    }

    .stepper__label--active {
      color: var(--stepper-color, var(--color-warning));
      font-weight: 700;
    }

    .stepper__label--upcoming {
      color: var(--color-text-muted);
    }

    /* ── Progress connector (replaces flat line) ── */

    .stepper__track {
      position: relative;
      height: 2px;
      margin: 0 var(--space-1-5);
      flex-shrink: 0;
      background: var(--color-surface-raised);
      overflow: hidden;
    }

    .stepper__track-fill {
      position: absolute;
      inset: 0;
      transform-origin: left;
      transition: transform 0.6s ease;
    }

    .stepper__track-fill--completed {
      background: var(--color-success);
      transform: scaleX(1);
    }

    .stepper__track-fill--upcoming {
      background: var(--color-surface-raised);
      transform: scaleX(0);
    }

    /* ── Hover intel tooltip ──────────────── */

    .stepper__intel {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
      z-index: var(--z-tooltip, 100);
    }

    .stepper__step:hover .stepper__intel {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .stepper__intel-box {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 5px 8px;
      white-space: nowrap;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-tertiary);
      letter-spacing: 0.03em;
      box-shadow: 0 4px 12px rgba(0 0 0 / 0.5);
    }

    /* Caret pointing up */
    .stepper__intel-box::before {
      content: '';
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 7px;
      height: 7px;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      border-left: 1px solid var(--color-border);
    }

    .stepper__intel-val {
      color: var(--stepper-color, var(--color-text-primary));
      font-weight: 700;
    }

    /* ── Results step (fixed-width terminal) ── */

    .stepper__step--results {
      flex: 0 0 auto;
    }

    .stepper__dot--trophy {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--color-border);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-icon);
    }

    .stepper__dot--trophy-active {
      border-color: var(--color-warning);
      background: var(--color-warning);
      color: var(--color-text-inverse);
      animation: trophy-glow 2.5s ease-in-out infinite;
    }

    @keyframes trophy-glow {
      0%, 100% { box-shadow: 0 0 4px rgba(245 158 11 / 0.3); }
      50% { box-shadow: 0 0 14px rgba(245 158 11 / 0.6); }
    }

    /* ── Winner Banner ────────────────────── */

    .winner-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      border-left: 2px solid var(--color-warning);
      background: rgba(245 158 11 / 0.05);
      margin-left: var(--space-2);
    }

    .winner-banner__icon {
      color: var(--color-warning);
      animation: trophy-glow-icon 2.5s ease-in-out infinite;
      flex-shrink: 0;
    }

    @keyframes trophy-glow-icon {
      0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 2px rgba(245 158 11 / 0.3)); }
      50% { opacity: 1; filter: drop-shadow(0 0 6px rgba(245 158 11 / 0.6)); }
    }

    .winner-banner__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    .winner-banner__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      color: var(--color-warning);
    }

    .winner-banner__score {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }

    @media (prefers-reduced-motion: reduce) {
      .stepper__dot--trophy-active,
      .winner-banner__icon {
        animation: none;
      }
    }

    /* ── Microanimations ─────────────────── */

    @keyframes banner-sweep {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes panel-enter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes tab-underline {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }

    .banner__inner {
      animation: banner-sweep 0.5s ease-out;
    }

    .panel {
      opacity: 0;
      animation: panel-enter 0.4s ease-out forwards;
    }

    .panel:nth-child(1) { animation-delay: 80ms; }
    .panel:nth-child(2) { animation-delay: 160ms; }
    .panel:nth-child(3) { animation-delay: 240ms; }
    .panel:nth-child(4) { animation-delay: 320ms; }

    .banner__stats {
      display: flex;
      gap: var(--space-6);
      align-items: end;
    }

    .stat {
      text-align: right;
    }

    .stat__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      line-height: 1;
    }

    .stat__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    /* ── RP Meter ─────────────────────────────── */

    .rp-meter {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .rp-meter__bar {
      width: 120px;
      height: 8px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      position: relative;
    }

    .rp-meter__fill {
      position: absolute;
      inset: 0;
      background: var(--color-success);
      transform-origin: left;
      transition: transform var(--transition-slow);
    }

    .rp-meter__text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--color-success);
    }

    /* ── Tab Nav ──────────────────────────────── */

    .tabs {
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: 0 var(--space-6);
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--color-border);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tabs::-webkit-scrollbar {
      display: none;
    }

    .tab {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .tab:hover {
      color: var(--color-text-secondary);
    }

    .tab--active {
      color: var(--color-text-primary);
      border-bottom-color: var(--color-text-primary);
      animation: tab-underline 0.3s ease-out;
      transform-origin: left;
    }

    .tab__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      margin-left: var(--space-1, 4px);
      border-radius: 8px;
      background: var(--color-warning);
      color: var(--color-text-inverse);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0;
    }

    /* ── Content Area ─────────────────────────── */

    .content {
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Overview Grid ────────────────────────── */

    .overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }

    @media (max-width: 900px) {
      .overview {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-tertiary);
      margin: 0;
    }

    .panel__body {
      padding: var(--space-4);
    }

    .panel--full-width {
      grid-column: 1 / -1;
    }

    /* ── Operations List ──────────────────────── */

    .mission {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border);
      transition: all var(--transition-normal);
    }

    .mission:hover {
      padding-left: var(--space-2);
      background: rgba(255 255 255 / 0.02);
    }

    .mission:hover .mission__icon {
      transform: scale(1.1) rotate(-3deg);
      border-color: var(--color-text-muted);
    }

    .mission:last-child {
      border-bottom: none;
    }

    .mission__icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-base);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      flex-shrink: 0;
      transition: all var(--transition-normal);
    }

    .mission__info {
      flex: 1;
      min-width: 0;
    }

    .mission__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .mission__detail {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .mission__status {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: 2px 6px;
      border: 1px solid;
    }

    .mission__status--active {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .mission__status--deploying {
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    .mission__status--success {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .mission__status--failed {
      border-color: var(--color-text-muted);
      color: var(--color-text-muted);
    }

    .mission__status--detected {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    /* ── Quick Actions ────────────────────────── */

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .action-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .action-btn:hover {
      background: var(--color-surface-raised);
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 var(--color-surface);
    }

    .action-btn__cost {
      font-family: var(--font-mono, monospace);
      color: var(--color-success);
    }

    /* (lobby/past-epoch CSS removed — replaced by ops-board) */

    /* ── No Auth ──────────────────────────────── */

    .no-auth {
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    .no-auth__text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ── Alliance Card ────────────────────────── */

    .alliance {
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-2);
    }

    .alliance__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-1);
    }

    .alliance__member {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      padding: 2px 0;
    }

    /* ── Empty / Threat ───────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-4);
    }

    .threat-count {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-danger);
      padding: 2px 6px;
      border: 1px solid var(--color-danger);
      animation: threat-blink 2s ease-in-out infinite;
    }

    @keyframes threat-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .action-btn:active {
      transform: translate(0, 0);
      box-shadow: none;
      background: var(--color-surface-raised);
    }

    .banner__phase {
      transition: all var(--transition-normal);
    }

    .banner__phase:hover {
      filter: brightness(1.3);
    }

    .stat__value {
      transition: transform var(--transition-normal);
    }

    .stat:hover .stat__value {
      transform: scale(1.05);
    }

    .rp-meter__fill {
      position: relative;
    }

    .rp-meter__fill::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      background: rgba(255 255 255 / 0.6);
      animation: rp-shimmer 3s ease-in-out infinite;
    }

    @keyframes rp-shimmer {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }

    .alliance {
      transition: all var(--transition-normal);
    }

    .alliance:hover {
      border-color: var(--color-text-muted);
      transform: translateX(2px);
    }

    /* ── Lobby Actions ─────────────────────── */

    .lobby-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      flex-wrap: wrap;
    }

    .lobby-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .lobby-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lobby-btn--join {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .lobby-btn--join:hover:not(:disabled) {
      background: var(--color-success);
      color: var(--color-text-inverse);
    }

    .lobby-btn--leave {
      color: var(--color-text-muted);
      border-color: var(--color-border);
      background: transparent;
    }

    .lobby-btn--leave:hover:not(:disabled) {
      border-color: var(--color-text-muted);
      background: var(--color-surface-raised);
    }

    .lobby-btn--start {
      color: var(--color-text-inverse);
      border-color: var(--color-text-primary);
      background: var(--color-text-primary);
    }

    .lobby-btn--start:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-border);
    }

    .lobby-btn--start:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    /* ── Admin Controls ────────────────────── */

    .admin-panel {
      margin-top: var(--space-3);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }

    .admin-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
      background: var(--color-surface);
      border: none;
      cursor: pointer;
      transition: background var(--transition-normal);
    }

    .admin-toggle:hover {
      background: var(--color-surface-raised);
    }

    .admin-toggle__chevron {
      transition: transform var(--transition-normal);
      font-size: var(--text-xs);
    }

    .admin-toggle__chevron--open {
      transform: rotate(180deg);
    }

    .admin-body {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      padding: var(--space-3);
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .admin-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .admin-btn--advance {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .admin-btn--advance:hover:not(:disabled) {
      background: var(--color-success-glow);
    }

    .admin-btn--resolve {
      color: var(--color-warning);
      border-color: var(--color-warning);
      background: transparent;
    }

    .admin-btn--resolve:hover:not(:disabled) {
      background: rgba(245 158 11 / 0.15);
    }

    .admin-btn--cancel {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .admin-btn--cancel:hover:not(:disabled) {
      background: var(--color-danger-glow);
    }

    /* ── Alliance Actions ──────────────────── */

    .alliance-actions {
      margin-bottom: var(--space-3);
    }

    .team-form {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }

    .team-form__input {
      flex: 1;
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
    }

    .team-form__input:focus {
      outline: none;
      border-color: var(--color-success);
    }

    .team-form__input::placeholder {
      color: var(--color-text-muted);
    }

    .alliance__actions {
      display: flex;
      gap: var(--space-1);
      margin-top: var(--space-2);
    }

    .alliance-btn {
      padding: 2px var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      border: 1px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .alliance-btn--join {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .alliance-btn--join:hover {
      background: var(--color-success-glow);
    }

    .alliance-btn--leave {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .alliance-btn--leave:hover {
      background: var(--color-danger-glow);
    }

    /* ── Back to Ops Board button ─────────── */

    .banner__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      margin-bottom: var(--space-2);
      transition: color 0.2s, transform 0.2s;
    }

    .banner__back:hover {
      color: var(--color-text-secondary);
      transform: translateX(-3px);
    }

    .banner__back-arrow {
      display: inline-block;
      transition: transform 0.2s;
    }

    .banner__back:hover .banner__back-arrow {
      transform: translateX(-2px);
    }

    /* ── Recall Button ─────────────────────── */

    .mission__recall {
      padding: 2px 6px;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      background: transparent;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .mission__recall:hover {
      background: rgba(245 158 11 / 0.15);
    }

    .mission__recall:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* === Widescreen === */
    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%),
          var(--color-surface-sunken);
      }
      .content {
        max-width: var(--container-max, 1600px);
      }
      .tabs {
        max-width: var(--container-max, 1600px);
      }
      .banner__inner {
        max-width: var(--container-max, 1600px);
      }
    }

    /* === Touch targets === */
    @media (hover: none) {
      .mission__icon {
        width: 40px;
        height: 40px;
      }
    }

    /* === Mobile overrides === */
    @media (max-width: 640px) {
      .banner__inner {
        grid-template-columns: 1fr;
        padding: var(--space-4) var(--space-3);
      }

      .banner__stats {
        gap: var(--space-3);
      }

      .stepper {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .tabs {
        padding: 0 var(--space-3);
        overflow-x: auto;
      }

      .tab {
        padding: var(--space-2) var(--space-3);
        font-size: 0.56rem;
        letter-spacing: 0;
      }

      .content {
        padding: var(--space-4) var(--space-3);
      }
    }

    /* ── Cycle Resolved Overlay ───────────────── */

    .cycle-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay, 50);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      background: radial-gradient(ellipse at center, rgba(0 0 0 / 0.85), rgba(0 0 0 / 0.95));
      animation: overlay-lifecycle 2.2s ease-out forwards;
      pointer-events: none;
    }

    .cycle-overlay__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--color-warning);
      opacity: 0;
      animation: overlay-fade-in 0.3s 0.1s ease-out forwards;
    }

    .cycle-overlay__number {
      font-family: var(--font-brutalist);
      font-size: clamp(48px, 10vw, 96px);
      font-weight: 900;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      text-shadow: 0 0 40px rgba(245 158 11 / 0.4), 0 0 80px rgba(245 158 11 / 0.15);
      opacity: 0;
      animation: overlay-zoom-in 0.5s 0.15s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
    }

    .cycle-overlay__divider {
      width: 120px;
      height: 2px;
      background: var(--color-warning);
      margin: var(--space-3) 0;
      opacity: 0;
      animation: overlay-divider-grow 0.4s 0.3s ease-out forwards;
    }

    @keyframes overlay-lifecycle {
      0% { opacity: 0; }
      10% { opacity: 1; }
      75% { opacity: 1; }
      100% { opacity: 0; }
    }

    @keyframes overlay-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes overlay-zoom-in {
      from { opacity: 0; transform: scale(0.7); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes overlay-divider-grow {
      from { opacity: 0; width: 0; }
      to { opacity: 1; width: 120px; }
    }

    /* ── Banner cycle bump ─────────────────────── */

    .banner__sub--bump {
      animation: cycle-bump 0.6s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    }

    @keyframes cycle-bump {
      0% { transform: scale(1); }
      30% { transform: scale(1.4); color: var(--color-warning); text-shadow: 0 0 16px rgba(245 158 11 / 0.5); }
      100% { transform: scale(1); }
    }

    /* ── Phase Transition Overlay ──────────────── */

    .phase-overlay {
      position: fixed;
      top: 80px;
      left: 0;
      right: 0;
      z-index: var(--z-top, 9000);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-5);
      pointer-events: none;
      animation: phase-overlay-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .phase-overlay__lines {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      max-width: 500px;
    }

    .phase-overlay__line {
      flex: 1;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--_phase-color), transparent);
    }

    .phase-overlay__icon {
      color: var(--_phase-color);
      filter: drop-shadow(0 0 8px var(--_phase-color));
    }

    .phase-overlay__name {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-lg);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--_phase-color);
      text-shadow: 0 0 20px var(--_phase-color), 0 0 40px color-mix(in srgb, var(--_phase-color) 40%, transparent);
    }

    .phase-overlay__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-tertiary);
    }

    .phase-overlay--foundation { --_phase-color: var(--color-success); }
    .phase-overlay--competition { --_phase-color: var(--color-warning); }
    .phase-overlay--reckoning { --_phase-color: var(--color-danger); }

    @keyframes phase-overlay-in {
      0% { opacity: 0; transform: scaleX(0.5); }
      40% { opacity: 1; transform: scaleX(1.05); }
      100% { opacity: 1; transform: scaleX(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .cycle-overlay,
      .cycle-overlay__label,
      .cycle-overlay__number,
      .cycle-overlay__divider,
      .banner__sub--bump,
      .phase-overlay {
        animation: none;
        opacity: 1;
        width: 120px;
      }
    }
  `;

  @state() private _loading = true;
  @state() private _activeEpochs: Epoch[] = [];
  @state() private _epoch: Epoch | null = null;
  @state() private _pastEpochs: Epoch[] = [];
  @state() private _participantCounts: Record<string, number> = {};
  @state() private _participants: EpochParticipant[] = [];
  @state() private _teams: EpochTeam[] = [];
  @state() private _proposals: import('../../types/index.js').AllianceProposal[] = [];
  @state() private _leaderboard: LeaderboardEntry[] = [];
  @state() private _missions: OperativeMission[] = [];
  @state() private _threats: OperativeMission[] = [];
  @state() private _battleLog: BattleLogEntry[] = [];
  @state() private _activeTab: TabId = 'overview';
  @state() private _myParticipant: EpochParticipant | null = null;
  @state() private _showCreateWizard = false;
  @state() private _showDeployModal = false;
  @state() private _showInvitePanel = false;
  @state() private _showBotPanel = false;
  @state() private _showDraftPanel = false;
  @state() private _draftAgents: Agent[] = [];
  @state() private _draftAptitudeMap: Map<string, AptitudeSet> = new Map();
  @state() private _zones: Array<{ id: string; name: string; security_level: string }> = [];
  @state() private _actionLoading = false;
  @state() private _commsEpoch: Epoch | null = null;
  @state() private _commsParticipant: EpochParticipant | null = null;
  @state() private _allTemplateSimulations: import('../../types/index.js').Simulation[] = [];
  @state() private _showCycleOverlay = false;
  @state() private _newCycleNumber = 0;
  @state() private _cycleBump = false;
  @state() private _cycleJustResolved = false;
  @state() private _phaseOverlayPhase = '';
  @state() private _showPhaseOverlay = false;
  private _prevEpochStatus = '';

  private _disposeCycleEffect?: () => void;

  async connectedCallback() {
    super.connectedCallback();
    seoService.setTitle([msg('Epoch Command Center')]);
    seoService.setDescription(
      msg('Competitive PvP operations dashboard – manage epochs, deploy operatives, track scores.'),
    );

    // Watch for cycle resolution broadcasts (from self or other players)
    this._disposeCycleEffect = effect(() => {
      const resolved = realtimeService.cycleResolved.value;
      if (resolved && this._epoch && resolved.epoch_id === this._epoch.id) {
        this._onCycleResolved(resolved.cycle_number);
      }
    });

    await this._loadData();
  }

  disconnectedCallback() {
    this._disposeCycleEffect?.();
    if (this._epoch) {
      realtimeService.leaveEpoch(this._epoch.id);
    } else if (this._commsEpoch) {
      realtimeService.leaveEpoch(this._commsEpoch.id);
    }
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  private _injectEpochSchema(epoch: Epoch): void {
    const statusMap: Record<string, string> = {
      lobby: 'https://schema.org/EventScheduled',
      foundation: 'https://schema.org/EventScheduled',
      competition: 'https://schema.org/EventScheduled',
      reckoning: 'https://schema.org/EventScheduled',
      completed: 'https://schema.org/EventPostponed',
      cancelled: 'https://schema.org/EventCancelled',
    };
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: epoch.name,
      description: epoch.description ?? `Competitive PvP epoch: ${epoch.name}`,
      eventStatus: statusMap[epoch.status] ?? 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: {
        '@type': 'VirtualLocation',
        url: 'https://metaverse.center/epoch',
      },
      ...(epoch.starts_at ? { startDate: epoch.starts_at } : {}),
      ...(epoch.ends_at ? { endDate: epoch.ends_at } : {}),
    });
  }

  private async _loadData() {
    this._loading = true;

    // Ensure simulations are loaded (may be empty if user navigated directly here)
    if (appState.isAuthenticated.value && appState.simulations.value.length === 0) {
      const simResult = await simulationsApi.list();
      if (simResult.success && simResult.data) {
        appState.setSimulations(simResult.data);
      }
    }

    // Load all template simulations for epoch join (any user can join with any template)
    await this._loadAllTemplateSimulations();

    // Load active epochs (lobby + running)
    const activeResult = await epochsApi.getActiveEpochs();
    if (activeResult.success && activeResult.data) {
      this._activeEpochs = activeResult.data as Epoch[];

      // Load participant counts for each epoch in parallel
      const countPromises = this._activeEpochs.map(async (e) => {
        const resp = await epochsApi.listParticipants(e.id);
        const list = resp.success ? (resp.data as EpochParticipant[]) || [] : [];
        return [e.id, list.length] as [string, number];
      });
      const counts = await Promise.all(countPromises);
      this._participantCounts = Object.fromEntries(counts);

      // If an epoch was previously selected and still exists, keep it
      if (this._epoch) {
        const stillValid = this._activeEpochs.find((e) => e.id === this._epoch?.id);
        if (stillValid) {
          // Detect phase change for transition overlay
          if (
            this._prevEpochStatus &&
            stillValid.status !== this._prevEpochStatus &&
            ['competition', 'reckoning'].includes(stillValid.status)
          ) {
            this._phaseOverlayPhase = stillValid.status;
            this._showPhaseOverlay = true;
            setTimeout(() => {
              this._showPhaseOverlay = false;
            }, 2500);
          }
          this._prevEpochStatus = stillValid.status;
          this._epoch = stillValid;
          await this._loadEpochDetails(stillValid.id);
        } else {
          // Epoch disappeared from active list — it may have just completed.
          // Fetch it directly to check; keep it visible for final score display.
          const directResult = await epochsApi.getEpoch(this._epoch.id);
          if (directResult.success && directResult.data) {
            const fetched = directResult.data as Epoch;
            if (fetched.status === 'completed') {
              this._epoch = fetched;
              await this._loadEpochDetails(fetched.id);
            } else {
              this._epoch = null;
            }
          } else {
            this._epoch = null;
          }
        }
      }
    }

    // Load past epochs
    const pastResult = await epochsApi.listEpochs({ status: 'completed' });
    if (pastResult.success && pastResult.data) {
      this._pastEpochs = pastResult.data;

      // Load participant counts for completed epochs too
      const pastCountPromises = this._pastEpochs.map(async (e) => {
        const resp = await epochsApi.listParticipants(e.id);
        const list = resp.success ? (resp.data as EpochParticipant[]) || [] : [];
        return [e.id, list.length] as [string, number];
      });
      const pastCounts = await Promise.all(pastCountPromises);
      this._participantCounts = {
        ...this._participantCounts,
        ...Object.fromEntries(pastCounts),
      };
    }

    this._loading = false;

    // Find an epoch for the comms panel (ops board only — when no epoch is selected)
    if (!this._epoch) {
      await this._findCommsEpoch();
    }
  }

  private async _findCommsEpoch() {
    if (!appState.isAuthenticated.value) {
      this._commsEpoch = null;
      this._commsParticipant = null;
      return;
    }

    const userId = appState.user.value?.id;
    if (!userId) {
      this._commsEpoch = null;
      this._commsParticipant = null;
      return;
    }

    // Check active epochs for one where user is a participant
    for (const epoch of this._activeEpochs) {
      const resp = await epochsApi.listParticipants(epoch.id);
      if (!resp.success) continue;
      const participants = (resp.data as EpochParticipant[]) || [];
      const myPart = participants.find((p) => !p.is_bot && p.user_id === userId);
      if (myPart) {
        this._commsEpoch = epoch;
        this._commsParticipant = myPart;

        // Join Realtime channel for the comms epoch
        const simName =
          (myPart.simulations as { name: string } | undefined)?.name ?? myPart.simulation_id;
        realtimeService.joinEpoch(epoch.id, userId, myPart.simulation_id, simName);
        if (myPart.team_id) {
          realtimeService.joinTeam(epoch.id, myPart.team_id);
        }
        return;
      }
    }

    // No active epoch participation found
    this._commsEpoch = null;
    this._commsParticipant = null;
  }

  private async _loadAllTemplateSimulations(): Promise<void> {
    const result = await simulationsApi.listPublic();
    if (result.success && result.data) {
      this._allTemplateSimulations = (
        result.data as import('../../types/index.js').Simulation[]
      ).filter((s) => !s.simulation_type || s.simulation_type === 'template');
    }
  }

  private async _loadEpochDetails(epochId: string) {
    const [participants, teams, leaderboard, proposals] = await Promise.all([
      epochsApi.listParticipants(epochId),
      epochsApi.listTeams(epochId),
      epochsApi.getLeaderboard(epochId),
      epochsApi.listProposals(epochId),
    ]);

    if (participants.success) {
      this._participants = (participants.data as EpochParticipant[]) || [];
      // Find my participation by direct user_id match
      const userId = appState.user.value?.id;
      this._myParticipant =
        this._participants.find((p) => !p.is_bot && p.user_id === userId) ?? null;
    }

    if (teams.success) {
      this._teams = (teams.data as EpochTeam[]) || [];
    }

    if (leaderboard.success) {
      this._leaderboard = (leaderboard.data as LeaderboardEntry[]) || [];
    }

    if (proposals.success && proposals.data) {
      this._proposals = proposals.data as import('../../types/index.js').AllianceProposal[];
    }

    // Fetch battle log AFTER participants are parsed so simulation_id is available for allied intel tagging
    const battleLogParams: Record<string, string> = {};
    if (this._myParticipant?.simulation_id) {
      battleLogParams.simulation_id = this._myParticipant.simulation_id;
    }
    const battleLog = await epochsApi.getBattleLog(
      epochId,
      Object.keys(battleLogParams).length ? battleLogParams : undefined,
    );
    if (battleLog.success && battleLog.data) {
      this._battleLog = battleLog.data;
    }

    // Load missions if participating
    if (this._myParticipant && this._epoch) {
      const missionsResult = await epochsApi.listMissions(this._epoch.id, {
        simulation_id: this._myParticipant.simulation_id,
      });
      if (missionsResult.success && missionsResult.data) {
        this._missions = missionsResult.data;
      }

      const threatResult = await epochsApi.listThreats(
        this._epoch.id,
        this._myParticipant.simulation_id,
      );
      if (threatResult.success) {
        this._threats = (threatResult.data as OperativeMission[]) || [];
      }

      // Load zones for fortification UI (foundation phase)
      if (this._epoch.status === 'foundation') {
        try {
          const { locationsApi } = await import('../../services/api/LocationsApiService.js');
          const zonesResult = await locationsApi.listZones(this._myParticipant.simulation_id);
          if (zonesResult.success && zonesResult.data) {
            this._zones = zonesResult.data as Array<{
              id: string;
              name: string;
              security_level: string;
            }>;
          }
        } catch {
          /* non-critical */
        }
      } else {
        this._zones = [];
      }
    }

    // Initialize Realtime channels for this epoch
    if (this._myParticipant && this._epoch) {
      const simName =
        (this._myParticipant.simulations as { name: string } | undefined)?.name ??
        this._myParticipant.simulation_id;
      realtimeService.joinEpoch(
        this._epoch.id,
        appState.user.value?.id ?? '',
        this._myParticipant.simulation_id,
        simName,
      );
      realtimeService.initReadyStates(this._participants);

      // Join team channel if on a team
      if (this._myParticipant.team_id) {
        realtimeService.joinTeam(this._epoch.id, this._myParticipant.team_id);
      }
    }
  }

  private async _refreshParticipants() {
    if (!this._epoch) return;
    const resp = await epochsApi.listParticipants(this._epoch.id);
    if (resp.success) {
      this._participants = (resp.data as EpochParticipant[]) || [];
      const userId = appState.user.value?.id;
      this._myParticipant =
        this._participants.find((p) => !p.is_bot && p.user_id === userId) ?? null;
    }
  }

  private _switchTab(tab: TabId) {
    this._activeTab = tab;
  }

  private _getPhaseClass(status: string): string {
    return `banner__phase--${status}`;
  }

  private _getTotalCycles(): number {
    const cfg = this._epoch?.config;
    if (!cfg) return 0;
    return computeTotalCycles(cfg);
  }

  private _getPhaseCycleCounts(): { foundation: number; competition: number; reckoning: number } {
    const cfg = this._epoch?.config;
    if (!cfg) return { foundation: 0, competition: 0, reckoning: 0 };
    return computePhaseCycles(cfg);
  }

  private get _winner(): LeaderboardEntry | null {
    return this._leaderboard.length > 0 && this._leaderboard[0].rank === 1
      ? this._leaderboard[0]
      : null;
  }

  private _renderPhaseStepper() {
    if (!this._epoch) return nothing;
    const status = this._epoch.status;
    if (['lobby', 'cancelled'].includes(status)) return nothing;

    const timedPhases = ['foundation', 'competition', 'reckoning'] as const;
    const phaseLabels: Record<string, string> = {
      foundation: msg('Foundation'),
      competition: msg('Competition'),
      reckoning: msg('Reckoning'),
      results: msg('Results'),
    };
    const phaseColors: Record<string, string> = {
      foundation: 'var(--color-success)',
      competition: 'var(--color-warning)',
      reckoning: 'var(--color-danger)',
      results: 'var(--color-warning)',
    };

    const currentIdx = timedPhases.indexOf(status as (typeof timedPhases)[number]);
    const activeIdx = status === 'completed' ? timedPhases.length : currentIdx;

    const phaseCycles = this._getPhaseCycleCounts();
    const totalCycles = this._getTotalCycles();
    const currentCycle = this._epoch.current_cycle;

    const phaseStartCycle: Record<string, number> = {
      foundation: 1,
      competition: phaseCycles.foundation + 1,
      reckoning: phaseCycles.foundation + phaseCycles.competition + 1,
    };

    const isEpochCompleted = status === 'completed';
    const winner = this._winner;

    return html`
      <div class="stepper">
        ${timedPhases.map((phase, i) => {
          const isCompleted = i < activeIdx;
          const isActive = i === activeIdx;
          const dotClass = isCompleted
            ? 'stepper__dot--completed'
            : isActive
              ? 'stepper__dot--active'
              : 'stepper__dot--upcoming';
          const labelClass = isCompleted
            ? 'stepper__label--completed'
            : isActive
              ? 'stepper__label--active'
              : 'stepper__label--upcoming';
          const color = phaseColors[phase];
          const totalForPhase = phaseCycles[phase];

          // Tooltip intel
          let intelText = '';
          if (totalForPhase > 0) {
            if (isActive) {
              const raw = currentCycle - phaseStartCycle[phase] + 1;
              const cycleInPhase = Math.max(1, Math.min(raw, totalForPhase));
              intelText = `${cycleInPhase} / ${totalForPhase}`;
            } else {
              intelText = `${totalForPhase}`;
            }
          }

          // Track between this phase and the next (proportional width)
          const trackWidth =
            totalCycles > 0 ? Math.max(16, (totalForPhase / totalCycles) * 120) : 24;
          // Fill fraction for active phase track
          const fillFraction = isActive
            ? Math.max(0, Math.min(1, (currentCycle - phaseStartCycle[phase] + 1) / totalForPhase))
            : 0;

          return html`
            <div
              class="stepper__step"
              style="--stepper-color: ${color}"
            >
              <div class="stepper__dot ${dotClass}"></div>
              <span class="stepper__label ${labelClass}">${phaseLabels[phase]}</span>
              ${
                intelText
                  ? html`
                <div class="stepper__intel">
                  <div class="stepper__intel-box">
                    ${isActive ? msg('Cycle') : msg('Cycles')}
                    <span class="stepper__intel-val">${intelText}</span>
                  </div>
                </div>
              `
                  : nothing
              }
            </div>
            <div class="stepper__track" style="width: ${trackWidth}px">
              <div
                class="stepper__track-fill ${isCompleted ? 'stepper__track-fill--completed' : 'stepper__track-fill--upcoming'}"
                style=${isActive ? `background: ${color}; transform: scaleX(${fillFraction})` : ''}
              ></div>
            </div>
          `;
        })}

        <!-- Results step -->
        ${
          isEpochCompleted && winner
            ? html`
            <div class="winner-banner" aria-live="polite">
              <span class="winner-banner__icon">${icons.trophy(16)}</span>
              <span class="winner-banner__label">${msg('Victor')}</span>
              <span class="winner-banner__name">${winner.simulation_name}</span>
              <span class="winner-banner__score">${winner.composite.toFixed(1)}</span>
            </div>
          `
            : html`
            <div
              class="stepper__step stepper__step--results"
              style="--stepper-color: var(--color-warning)"
            >
              <div class="stepper__dot--trophy ${isEpochCompleted ? 'stepper__dot--trophy-active' : ''}"></div>
              <span class="stepper__label ${isEpochCompleted ? 'stepper__label--active' : 'stepper__label--upcoming'}">
                ${phaseLabels.results}
              </span>
            </div>
          `
        }
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading command center...')}></velg-loading-state>`;
    }

    const mainContent = !this._epoch
      ? this._renderOpsBoard()
      : html`
        ${this._renderBanner()}
        <velg-epoch-lobby-actions
          .epoch=${this._epoch}
          .myParticipant=${this._myParticipant}
          .participants=${this._participants}
          .simulations=${this._allTemplateSimulations}
          .userId=${appState.user.value?.id ?? ''}
          .actionLoading=${this._actionLoading}
          @join-epoch=${(e: CustomEvent) => this._onJoinEpoch(e.detail.simulationId)}
          @leave-epoch=${() => this._onLeaveEpoch()}
          @start-epoch=${() => this._onStartEpoch()}
          @invite-players=${() => {
            this._showInvitePanel = true;
          }}
          @add-bots=${() => {
            this._showBotPanel = true;
          }}
          @draft-roster=${() => this._onOpenDraftPanel()}
          @create-epoch=${() => this._createEpoch()}
          @advance-phase=${() => this._onAdvancePhase()}
          @resolve-cycle=${() => this._onResolveCycle()}
          @cancel-epoch=${() => this._onCancelEpoch()}
          @delete-epoch=${() => this._onDeleteEpoch()}
        ></velg-epoch-lobby-actions>
        ${this._renderTabs()}
        <div class="content" id="epoch-tabpanel" role="tabpanel">
          ${this._renderActiveTab()}
        </div>
      `;

    return html`
      ${mainContent}
      ${
        this._showCycleOverlay
          ? html`
        <div class="cycle-overlay">
          <div class="cycle-overlay__label">${msg('Cycle')}</div>
          <div class="cycle-overlay__number">${this._newCycleNumber}</div>
          <div class="cycle-overlay__divider"></div>
        </div>
      `
          : nothing
      }
      ${
        this._showPhaseOverlay
          ? html`
        <div class="phase-overlay phase-overlay--${this._phaseOverlayPhase}">
          <div class="phase-overlay__lines">
            <div class="phase-overlay__line"></div>
            <span class="phase-overlay__icon" aria-hidden="true">${icons.bolt(20)}</span>
            <div class="phase-overlay__line"></div>
          </div>
          <span class="phase-overlay__name">${this._phaseOverlayPhase.toUpperCase()}</span>
          <span class="phase-overlay__subtitle">
            ${this._phaseOverlayPhase === 'competition' ? msg('All operatives unlocked') : msg('Final cycles – double points')}
          </span>
        </div>
      `
          : nothing
      }
      <velg-epoch-creation-wizard
        .open=${this._showCreateWizard}
        @modal-close=${this._onWizardClose}
        @epoch-created=${this._onEpochCreated}
      ></velg-epoch-creation-wizard>
      <velg-deploy-operative-modal
        .open=${this._showDeployModal}
        .epochId=${this._epoch?.id ?? ''}
        .simulationId=${this._myParticipant?.simulation_id ?? ''}
        .currentRp=${this._myParticipant?.current_rp ?? 0}
        .epochPhase=${this._epoch?.status ?? 'lobby'}
        .deployedAgentIds=${this._missions
          .filter((m) => ['deploying', 'active', 'returning'].includes(m.status))
          .map((m) => m.agent_id)}
        @modal-close=${this._onDeployModalClose}
        @operative-deployed=${this._onOperativeDeployed}
      ></velg-deploy-operative-modal>
      <velg-epoch-invite-panel
        .open=${this._showInvitePanel}
        .epochId=${this._epoch?.id ?? ''}
        @panel-close=${() => {
          this._showInvitePanel = false;
        }}
      ></velg-epoch-invite-panel>
      <velg-bot-config-panel
        .open=${this._showBotPanel}
        .epochId=${this._epoch?.id ?? ''}
        .participants=${this._participants}
        @panel-close=${() => {
          this._showBotPanel = false;
        }}
        @bot-added=${() => {
          if (this._epoch) this._loadEpochDetails(this._epoch.id);
        }}
      ></velg-bot-config-panel>
      <velg-draft-roster-panel
        .open=${this._showDraftPanel}
        .agents=${this._draftAgents}
        .maxSlots=${this._epoch?.config?.max_agents_per_player ?? 6}
        .aptitudeMap=${this._draftAptitudeMap}
        @draft-cancel=${() => {
          this._showDraftPanel = false;
        }}
        @draft-complete=${(e: CustomEvent) => this._onDraftComplete(e.detail.agentIds)}
      ></velg-draft-roster-panel>
    `;
  }

  // ── Operations Board (epoch list) ───────────────

  private _renderOpsBoard() {
    return html`
      <velg-epoch-ops-board
        .activeEpochs=${this._activeEpochs}
        .pastEpochs=${this._pastEpochs}
        .participantCounts=${this._participantCounts}
        .commsEpoch=${this._commsEpoch}
        .commsParticipant=${this._commsParticipant}
        .allTemplateSimulations=${this._allTemplateSimulations}
        @select-epoch=${(e: CustomEvent) => this._onSelectEpoch(e.detail.epoch)}
        @join-epoch=${(e: CustomEvent) => this._onJoinFromBoard(e.detail.epochId, e.detail.simulationId)}
        @create-epoch=${() => this._createEpoch()}
        @delete-epoch=${(e: CustomEvent) => this._onDeleteEpochFromBoard(e.detail.epochId, e.detail.epochName)}
      ></velg-epoch-ops-board>
    `;
  }

  private async _onSelectEpoch(epoch: Epoch) {
    // Leave comms epoch channel if we were on the ops board
    if (this._commsEpoch && this._commsEpoch.id !== epoch.id) {
      realtimeService.leaveEpoch(this._commsEpoch.id);
    }
    this._epoch = epoch;
    this._prevEpochStatus = epoch.status;
    this._activeTab = epoch.status === 'completed' ? 'results' : 'overview';
    this._injectEpochSchema(epoch);
    await this._loadEpochDetails(epoch.id);
  }

  private async _onJoinFromBoard(epochId: string, simulationId: string) {
    this._actionLoading = true;
    try {
      const result = await epochsApi.joinEpoch(epochId, simulationId);
      if (result.success) {
        VelgToast.success(msg('Joined epoch.'));
        // Update participant count
        this._participantCounts = {
          ...this._participantCounts,
          [epochId]: (this._participantCounts[epochId] ?? 0) + 1,
        };
      } else {
        VelgToast.error(
          (result.error as { message?: string })?.message ?? msg('Failed to join epoch.'),
        );
      }
    } catch {
      VelgToast.error(msg('Failed to join epoch.'));
    } finally {
      this._actionLoading = false;
    }
  }

  // ── Banner (active epoch header) ─────────────────

  private _renderBanner() {
    if (!this._epoch) return nothing;

    const rpCurrent = this._myParticipant?.current_rp ?? 0;
    const rpCap = this._epoch.config?.rp_cap ?? 40;
    const rpFill = Math.min(rpCurrent / rpCap, 1);

    return html`
      <div class="banner">
        <div class="banner__bg"></div>
        <div class="banner__inner">
          <div>
            <button class="banner__back" @click=${this._backToOpsBoard}>
              <span class="banner__back-arrow">&larr;</span>
              ${msg('Operations Board')}
            </button>
            <h1 class="banner__title">${this._epoch.name}</h1>
            <p class="banner__sub ${this._cycleBump ? 'banner__sub--bump' : ''}">
              <span class="banner__phase ${this._getPhaseClass(this._epoch.status)}">
                ${this._epoch.status}
              </span>
              &nbsp;&middot;&nbsp;
              ${msg('Cycle')} ${this._epoch.current_cycle}${this._epoch.config ? `/${this._getTotalCycles()}` : ''}
              ${
                this._epoch.config
                  ? this._epoch.epoch_type === 'academy'
                    ? html`&nbsp;&middot;&nbsp;${msg('Auto-resolve')}`
                    : html`&nbsp;&middot;&nbsp;${this._epoch.config.cycle_hours}h ${msg('cycles')}`
                  : nothing
              }
            </p>
            ${this._renderPhaseStepper()}
          </div>
          <div class="banner__stats">
            <div class="stat">
              <div class="stat__value">${this._participants.length}</div>
              <div class="stat__label">${msg('Players')}</div>
            </div>
            ${
              this._myParticipant
                ? html`
                <div class="stat">
                  <div class="rp-meter">
                    <span class="rp-meter__text">${rpCurrent}/${rpCap}</span>
                    <div class="rp-meter__bar">
                      <div class="rp-meter__fill" style="transform: scaleX(${rpFill})"></div>
                    </div>
                  </div>
                  <div class="stat__label">${msg('Resonance Points')}</div>
                </div>
              `
                : nothing
            }
          </div>
        </div>
      </div>
    `;
  }

  // ── Tab Navigation ───────────────────────────────

  private _renderTabs() {
    const unreadTotal =
      realtimeService.unreadEpochCount.value + realtimeService.unreadTeamCount.value;
    const tabs: { id: TabId; label: string; badge?: number }[] = [
      { id: 'overview', label: msg('Overview') },
      { id: 'chat', label: msg('Chat'), badge: this._activeTab !== 'chat' ? unreadTotal : 0 },
      { id: 'leaderboard', label: msg('Leaderboard') },
      { id: 'operations', label: msg('Operations') },
      { id: 'battle-log', label: msg('Battle Log') },
      { id: 'war-room', label: msg('War Room') },
      { id: 'alliances', label: msg('Alliances') },
      { id: 'terminal', label: msg('Terminal') },
      ...(this._epoch?.status === 'completed'
        ? [{ id: 'results' as TabId, label: msg('Results') }]
        : []),
    ];

    return html`
      <div class="tabs" role="tablist">
        ${tabs.map(
          (t) => html`
            <button
              role="tab"
              aria-selected=${this._activeTab === t.id}
              aria-controls="epoch-tabpanel"
              class="tab ${this._activeTab === t.id ? 'tab--active' : ''}"
              @click=${() => this._switchTab(t.id)}
            >
              ${t.label}
              ${t.badge && t.badge > 0 ? html`<span class="tab__badge">${t.badge}</span>` : nothing}
            </button>
          `,
        )}
      </div>
    `;
  }

  // ── Tab Content ──────────────────────────────────

  private _renderActiveTab() {
    switch (this._activeTab) {
      case 'overview':
        return html`
          <velg-epoch-overview-tab
            .epoch=${this._epoch}
            .myParticipant=${this._myParticipant}
            .participants=${this._participants}
            .leaderboard=${this._leaderboard}
            .missions=${this._missions}
            .threats=${this._threats}
            .battleLog=${this._battleLog}
            .zones=${this._zones}
            .actionLoading=${this._actionLoading}
            @deploy-operative=${() => {
              this._showDeployModal = true;
            }}
            @counter-intel=${this._onCounterIntel}
            @fortify-zone=${(e: CustomEvent) => this._onFortifyZone(e.detail.zoneId)}
            @recall-operative=${(e: CustomEvent) => this._onRecallOperative(e.detail.missionId)}
            @player-acted=${() => this._refreshParticipants()}
          ></velg-epoch-overview-tab>
        `;
      case 'chat':
        return html`
          <velg-epoch-chat-panel
            .epochId=${this._epoch?.id ?? ''}
            .mySimulationId=${this._myParticipant?.simulation_id ?? ''}
            .myTeamId=${this._myParticipant?.team_id ?? ''}
            .epochStatus=${this._epoch?.status ?? ''}
          ></velg-epoch-chat-panel>
        `;
      case 'leaderboard':
        return html`
          <velg-epoch-leaderboard
            .entries=${this._leaderboard}
            .epoch=${this._epoch}
            .participants=${this._participants}
            .mySimulationId=${this._myParticipant?.simulation_id ?? ''}
          ></velg-epoch-leaderboard>
        `;
      case 'operations':
        return html`
          <velg-epoch-operations-tab
            .myParticipant=${this._myParticipant}
            .missions=${this._missions}
            .threats=${this._threats}
            .actionLoading=${this._actionLoading}
            .cycleJustResolved=${this._cycleJustResolved}
            .epochStatus=${this._epoch?.status ?? ''}
            .battleLog=${this._battleLog}
            .currentCycle=${this._epoch?.current_cycle ?? 1}
            @recall-operative=${(e: CustomEvent) => this._onRecallOperative(e.detail.missionId)}
          ></velg-epoch-operations-tab>
        `;
      case 'battle-log':
        return html`
          <velg-epoch-battle-log
            .entries=${this._battleLog}
            .participants=${this._participants}
            .mySimulationId=${this._myParticipant?.simulation_id ?? ''}
          ></velg-epoch-battle-log>
        `;
      case 'war-room':
        return html`
          <velg-war-room-panel
            .epochId=${this._epoch?.id ?? ''}
            .currentCycle=${this._epoch?.current_cycle ?? 1}
            .simulationId=${this._myParticipant?.simulation_id ?? ''}
            .status=${this._epoch?.status ?? ''}
          ></velg-war-room-panel>
        `;
      case 'alliances':
        return html`
          <velg-epoch-alliances-tab
            .epoch=${this._epoch}
            .myParticipant=${this._myParticipant}
            .participants=${this._participants}
            .teams=${this._teams}
            .proposals=${this._proposals}
            .currentCycle=${this._epoch?.current_cycle ?? 0}
            .actionLoading=${this._actionLoading}
            @create-team=${(e: CustomEvent) => this._onCreateTeam(e.detail.name)}
            @join-team=${(e: CustomEvent) => this._onJoinTeam(e.detail.teamId)}
            @request-join-team=${(e: CustomEvent) => this._onRequestJoinTeam(e.detail.teamId)}
            @vote-proposal=${(e: CustomEvent) => this._onVoteProposal(e.detail.proposalId, e.detail.vote)}
            @leave-team=${() => this._onLeaveTeam()}
            @invite-player=${(e: CustomEvent) => this._onInvitePlayer(e.detail.simulationId, e.detail.simulationName)}
          ></velg-epoch-alliances-tab>
        `;
      case 'terminal':
        return html`
          <velg-epoch-terminal-view
            .epochId=${this._epoch?.id ?? ''}
            .participant=${this._myParticipant}
            .participants=${this._participants}
            .teams=${this._teams}
            .epochStatus=${this._epoch?.status ?? 'lobby'}
          ></velg-epoch-terminal-view>
        `;
      case 'results':
        return html`
          <velg-epoch-results-view
            .epoch=${this._epoch}
            .participants=${this._participants}
            .mySimulationId=${this._myParticipant?.simulation_id ?? ''}
          ></velg-epoch-results-view>
        `;
      default:
        return nothing;
    }
  }

  // ── Actions ──────────────────────────────────────

  private async _backToOpsBoard() {
    if (this._epoch) {
      realtimeService.leaveEpoch(this._epoch.id);
    }
    this._epoch = null;
    this._participants = [];
    this._teams = [];
    this._proposals = [];
    this._leaderboard = [];
    this._missions = [];
    this._threats = [];
    this._battleLog = [];
    this._myParticipant = null;
    this._activeTab = 'overview';
    // Re-establish comms channel for the ops board
    await this._findCommsEpoch();
  }

  private _createEpoch() {
    this._showCreateWizard = true;
  }

  private _onWizardClose() {
    this._showCreateWizard = false;
  }

  private async _onEpochCreated() {
    this._showCreateWizard = false;
    await this._loadData();
    // Auto-open invite panel for the newly created epoch
    if (this._epoch) {
      this._showInvitePanel = true;
    }
  }

  private _onDeployModalClose() {
    this._showDeployModal = false;
  }

  private _onOperativeDeployed() {
    this._showDeployModal = false;
    if (this._epoch) {
      this._loadEpochDetails(this._epoch.id);
    }
  }

  private async _onOpenDraftPanel() {
    if (!this._myParticipant) return;

    const simId = this._myParticipant.simulation_id;
    try {
      // Load agents and aptitudes for the participant's simulation
      const [agentsResp, aptResp] = await Promise.all([
        agentsApi.list(simId, { limit: '100' }),
        agentsApi.getAllAptitudes(simId),
      ]);

      if (agentsResp.success && agentsResp.data) {
        this._draftAgents = agentsResp.data;
      }

      if (aptResp.success && aptResp.data) {
        const map = new Map<string, AptitudeSet>();
        for (const row of aptResp.data as AgentAptitude[]) {
          if (!map.has(row.agent_id)) {
            map.set(row.agent_id, {
              spy: 6,
              guardian: 6,
              saboteur: 6,
              propagandist: 6,
              infiltrator: 6,
              assassin: 6,
            });
          }
          const set = map.get(row.agent_id);
          if (set) set[row.operative_type as OperativeType] = row.aptitude_level;
        }
        this._draftAptitudeMap = map;
      }

      this._showDraftPanel = true;
    } catch {
      VelgToast.error(msg('Failed to load agents for draft.'));
    }
  }

  private async _onDraftComplete(agentIds: string[]) {
    if (!this._epoch || !this._myParticipant) return;

    this._showDraftPanel = false;
    this._actionLoading = true;

    try {
      const result = await epochsApi.draftAgents(
        this._epoch.id,
        this._myParticipant.simulation_id,
        agentIds,
      );
      if (result.success) {
        VelgToast.success(msg('Roster locked in.'));
        await this._loadEpochDetails(this._epoch.id);
      } else {
        VelgToast.error(result.error?.message ?? msg('Failed to save draft.'));
      }
    } catch {
      VelgToast.error(msg('Failed to save draft.'));
    } finally {
      this._actionLoading = false;
    }
  }

  private async _onCounterIntel() {
    if (!this._epoch || !this._myParticipant) return;
    const result = await epochsApi.counterIntelSweep(
      this._epoch.id,
      this._myParticipant.simulation_id,
    );
    if (result.success) {
      const detected = (result.data as OperativeMission[]) || [];
      this._threats = [...this._threats, ...detected];
      VelgToast.success(msg(str`Sweep complete: ${detected.length} threats detected`));
      await this._refreshParticipants();
    } else {
      VelgToast.error(msg('Counter-intel sweep failed.'));
    }
  }

  private async _onFortifyZone(zoneId: string) {
    if (!this._epoch || !this._myParticipant) return;
    const result = await epochsApi.fortifyZone(
      this._epoch.id,
      this._myParticipant.simulation_id,
      zoneId,
    );
    if (result.success) {
      VelgToast.success(msg('Zone fortified.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to fortify zone.'));
    }
  }

  // ── Lobby Lifecycle ─────────────────────────────

  private async _onJoinEpoch(simulationId: string) {
    if (!this._epoch) return;
    this._actionLoading = true;
    const result = await epochsApi.joinEpoch(this._epoch.id, simulationId);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Joined epoch.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to join epoch.'));
    }
  }

  private async _onLeaveEpoch() {
    if (!this._epoch || !this._myParticipant) return;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Leave Epoch'),
      message: msg(
        'Are you sure you want to leave this epoch? You can rejoin later if the lobby is still open.',
      ),
      confirmLabel: msg('Leave'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionLoading = true;
    const result = await epochsApi.leaveEpoch(this._epoch.id, this._myParticipant.simulation_id);
    this._actionLoading = false;
    if (result.success) {
      this._myParticipant = null;
      this._missions = [];
      this._threats = [];
      VelgToast.success(msg('Left epoch.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to leave epoch.'));
    }
  }

  private async _onStartEpoch() {
    if (!this._epoch) return;
    this._actionLoading = true;
    const result = await epochsApi.startEpoch(this._epoch.id);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Epoch started! Game instances spawned.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to start epoch.'));
    }
  }

  // ── Admin Lifecycle ─────────────────────────────

  private async _onAdvancePhase() {
    if (!this._epoch) return;
    this._actionLoading = true;
    const result = await epochsApi.advancePhase(this._epoch.id);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Phase advanced.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to advance phase.'));
    }
  }

  private async _onResolveCycle() {
    if (!this._epoch) return;
    this._actionLoading = true;
    const result = await epochsApi.resolveCycle(this._epoch.id);
    this._actionLoading = false;
    if (!result.success) {
      VelgToast.error(msg('Failed to resolve cycle.'));
      return;
    }
    // Backend now handles bots + scoring + notifications in resolve_cycle_full()
    const newCycle = (result.data as Epoch)?.current_cycle ?? 0;
    realtimeService.broadcastCycleResolved(this._epoch.id, newCycle);
    VelgToast.success(msg('Cycle resolved.'));
  }

  private _onCycleResolved(cycleNumber: number) {
    this._newCycleNumber = cycleNumber;
    this._showCycleOverlay = true;
    this._cycleBump = true;
    this._cycleJustResolved = true;

    // Auto-dismiss overlay after 2.2s (matches animation duration)
    setTimeout(() => {
      this._showCycleOverlay = false;
    }, 2200);

    // Remove bump class after animation
    setTimeout(() => {
      this._cycleBump = false;
    }, 600);

    // Remove pulse prop after animation
    setTimeout(() => {
      this._cycleJustResolved = false;
    }, 800);

    // Reload all epoch data
    this._loadData();
  }

  private async _onCancelEpoch() {
    if (!this._epoch) return;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Cancel Epoch'),
      message: msg(
        'This will permanently end the epoch. All missions and scores will be frozen. Game instances will be deleted. This cannot be undone.',
      ),
      confirmLabel: msg('Cancel Epoch'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionLoading = true;
    const result = await epochsApi.cancelEpoch(this._epoch.id);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Epoch cancelled.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to cancel epoch.'));
    }
  }

  private async _onDeleteEpoch() {
    if (!this._epoch) return;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Epoch'),
      message: msg(
        'This will permanently remove the epoch and all associated data. This cannot be undone.',
      ),
      confirmLabel: msg('Delete Epoch'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionLoading = true;
    const result = await epochsApi.deleteEpoch(this._epoch.id);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Epoch deleted.'));
      this._epoch = null;
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to delete epoch.'));
    }
  }

  private async _onDeleteEpochFromBoard(epochId: string, epochName: string) {
    const confirmed = await VelgConfirmDialog.show({
      title: msg(str`Delete ${epochName}`),
      message: msg(
        'This will permanently remove the epoch and all associated data. This cannot be undone.',
      ),
      confirmLabel: msg('Delete Epoch'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionLoading = true;
    const result = await epochsApi.deleteEpoch(epochId);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Epoch deleted.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to delete epoch.'));
    }
  }

  // ── Alliance Management ─────────────────────────

  private async _onCreateTeam(name: string) {
    if (!this._epoch || !this._myParticipant || !name.trim()) return;
    this._actionLoading = true;
    const result = await epochsApi.createTeam(
      this._epoch.id,
      this._myParticipant.simulation_id,
      name.trim(),
    );
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Alliance created.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to create alliance.'));
    }
  }

  private async _onJoinTeam(teamId: string) {
    if (!this._epoch || !this._myParticipant) return;
    this._actionLoading = true;
    const result = await epochsApi.joinTeam(
      this._epoch.id,
      teamId,
      this._myParticipant.simulation_id,
    );
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Joined alliance.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to join alliance.'));
    }
  }

  private async _onLeaveTeam() {
    if (!this._epoch || !this._myParticipant) return;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Leave Alliance'),
      message: msg('Are you sure you want to leave your alliance?'),
      confirmLabel: msg('Leave'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionLoading = true;
    const result = await epochsApi.leaveTeam(this._epoch.id, this._myParticipant.simulation_id);
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Left alliance.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to leave alliance.'));
    }
  }

  private async _onRequestJoinTeam(teamId: string) {
    if (!this._epoch || !this._myParticipant) return;
    this._actionLoading = true;
    const result = await epochsApi.createProposal(
      this._epoch.id,
      this._myParticipant.simulation_id,
      teamId,
    );
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Alliance proposal sent.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to send proposal.'));
    }
  }

  private async _onVoteProposal(proposalId: string, vote: 'accept' | 'reject') {
    if (!this._epoch || !this._myParticipant) return;
    this._actionLoading = true;
    const result = await epochsApi.voteOnProposal(
      this._epoch.id,
      proposalId,
      this._myParticipant.simulation_id,
      vote,
    );
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(vote === 'accept' ? msg('Vote: Accept') : msg('Vote: Reject'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to vote.'));
    }
  }

  private async _onInvitePlayer(simulationId: string, simulationName: string) {
    if (!this._epoch || !this._myParticipant?.team_id) return;
    this._actionLoading = true;
    const result = await epochsApi.inviteToTeam(
      this._epoch.id,
      this._myParticipant.team_id,
      this._myParticipant.simulation_id,
      simulationId,
    );
    this._actionLoading = false;
    if (result.success) {
      const teamName = this._teams.find((t) => t.id === this._myParticipant?.team_id)?.name ?? '';
      VelgToast.success(msg(str`Alliance invitation sent to ${simulationName} for "${teamName}".`));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to send invitation.'));
    }
  }

  // ── Operative Recall ────────────────────────────

  private async _onRecallOperative(missionId: string) {
    if (!this._epoch || !this._myParticipant) return;
    this._actionLoading = true;
    const result = await epochsApi.recallOperative(
      this._epoch.id,
      missionId,
      this._myParticipant.simulation_id,
    );
    this._actionLoading = false;
    if (result.success) {
      VelgToast.success(msg('Operative recalled.'));
      await this._loadEpochDetails(this._epoch.id);
    } else {
      VelgToast.error(msg('Failed to recall operative.'));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-command-center': VelgEpochCommandCenter;
  }
}
