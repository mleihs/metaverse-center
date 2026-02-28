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
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import type {
  BattleLogEntry,
  Epoch,
  EpochParticipant,
  EpochTeam,
  LeaderboardEntry,
  OperativeMission,
  Simulation,
} from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/LoadingState.js';
import '../shared/EmptyState.js';
import './EpochLeaderboard.js';
import './EpochBattleLog.js';
import './EpochCreationWizard.js';
import './DeployOperativeModal.js';

type TabId = 'overview' | 'leaderboard' | 'operations' | 'battle-log' | 'alliances';

@localized()
@customElement('velg-epoch-command-center')
export class VelgEpochCommandCenter extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height, 56px));
      background: var(--color-gray-950);
      color: var(--color-gray-100);
    }

    /* ── Status Banner ────────────────────────── */

    .banner {
      position: relative;
      border-bottom: 3px solid var(--color-gray-800);
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
      color: var(--color-gray-400);
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
      border-color: var(--color-gray-500);
      color: var(--color-gray-300);
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
      border-color: var(--color-gray-600);
      color: var(--color-gray-400);
    }
    .banner__phase--cancelled {
      border-color: var(--color-gray-700);
      color: var(--color-gray-500);
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
      color: var(--color-gray-950);
    }

    .stepper__dot--active {
      border-color: var(--stepper-color, var(--color-warning));
      background: var(--stepper-color, var(--color-warning));
      animation: stepper-pulse 2s ease-in-out infinite;
    }

    .stepper__dot--upcoming {
      border-color: var(--color-gray-600);
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
      color: var(--color-gray-600);
    }

    /* ── Progress connector (replaces flat line) ── */

    .stepper__track {
      position: relative;
      height: 2px;
      margin: 0 var(--space-1-5);
      flex-shrink: 0;
      background: var(--color-gray-800);
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
      background: var(--color-gray-700);
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
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-700);
      padding: 5px 8px;
      white-space: nowrap;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-300);
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
      background: var(--color-gray-900);
      border-top: 1px solid var(--color-gray-700);
      border-left: 1px solid var(--color-gray-700);
    }

    .stepper__intel-val {
      color: var(--stepper-color, var(--color-gray-100));
      font-weight: 700;
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

    @keyframes lobby-fade {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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

    .lobby__header {
      animation: lobby-fade 0.6s ease-out;
    }

    .past-epoch {
      opacity: 0;
      animation: panel-enter 0.35s ease-out forwards;
    }

    .past-epoch:nth-child(1) { animation-delay: 200ms; }
    .past-epoch:nth-child(2) { animation-delay: 280ms; }
    .past-epoch:nth-child(3) { animation-delay: 360ms; }
    .past-epoch:nth-child(4) { animation-delay: 440ms; }
    .past-epoch:nth-child(5) { animation-delay: 520ms; }

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
      color: var(--color-gray-500);
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
      background: var(--color-gray-800);
      border: 1px solid var(--color-gray-700);
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
      border-bottom: 1px solid var(--color-gray-800);
    }

    .tab {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .tab:hover {
      color: var(--color-gray-200);
    }

    .tab--active {
      color: var(--color-gray-100);
      border-bottom-color: var(--color-gray-100);
      animation: tab-underline 0.3s ease-out;
      transform-origin: left;
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
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-900);
    }

    .panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-gray-800);
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-300);
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
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      transition: all var(--transition-normal);
    }

    .mission:hover {
      padding-left: var(--space-2);
      background: rgba(255 255 255 / 0.02);
    }

    .mission:hover .mission__icon {
      transform: scale(1.1) rotate(-3deg);
      border-color: var(--color-gray-500);
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
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-800);
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
      color: var(--color-gray-500);
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
      border-color: var(--color-gray-600);
      color: var(--color-gray-500);
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
      color: var(--color-gray-200);
      background: var(--color-gray-800);
      border: 1px solid var(--color-gray-700);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .action-btn:hover {
      background: var(--color-gray-700);
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0 var(--color-gray-900);
    }

    .action-btn__cost {
      font-family: var(--font-mono, monospace);
      color: var(--color-success);
    }

    /* ── Lobby State ──────────────────────────── */

    .lobby {
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
    }

    .lobby__header {
      text-align: center;
      margin-bottom: var(--space-8);
    }

    .lobby__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-4xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0 0 var(--space-2);
    }

    .lobby__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-500);
    }

    .lobby__create-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-6);
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-950);
      background: var(--color-gray-100);
      border: 3px solid var(--color-gray-100);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .lobby__create-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-600);
    }

    /* ── Past Epochs ──────────────────────────── */

    .past-epochs {
      margin-top: var(--space-8);
    }

    .past-epoch {
      display: grid;
      grid-template-columns: 40px 1fr auto auto;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-gray-800);
      margin-bottom: var(--space-2);
      transition: border-color var(--transition-normal);
    }

    .past-epoch:hover {
      border-color: var(--color-gray-600);
    }

    .past-epoch__rank {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      color: var(--color-gray-600);
    }

    .past-epoch__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .past-epoch__duration {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-500);
    }

    .past-epoch__winner {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-success);
    }

    /* ── No Auth ──────────────────────────────── */

    .no-auth {
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    .no-auth__text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-500);
    }

    /* ── Alliance Card ────────────────────────── */

    .alliance {
      padding: var(--space-3);
      border: 1px solid var(--color-gray-700);
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
      color: var(--color-gray-400);
      padding: 2px 0;
    }

    /* ── Empty / Threat ───────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-600);
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
      background: var(--color-gray-600);
    }

    .lobby__create-btn:active {
      transform: translate(0, 0);
      box-shadow: none;
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
      border-color: var(--color-gray-500);
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
      color: var(--color-gray-950);
    }

    .lobby-btn--leave {
      color: var(--color-gray-400);
      border-color: var(--color-gray-600);
      background: transparent;
    }

    .lobby-btn--leave:hover:not(:disabled) {
      border-color: var(--color-gray-400);
      background: var(--color-gray-800);
    }

    .lobby-btn--start {
      color: var(--color-gray-950);
      border-color: var(--color-gray-100);
      background: var(--color-gray-100);
    }

    .lobby-btn--start:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-600);
    }

    .lobby-btn--start:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    /* ── Admin Controls ────────────────────── */

    .admin-panel {
      margin-top: var(--space-3);
      border: 1px solid var(--color-gray-800);
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
      background: var(--color-gray-900);
      border: none;
      cursor: pointer;
      transition: background var(--transition-normal);
    }

    .admin-toggle:hover {
      background: var(--color-gray-800);
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
      border-top: 1px solid var(--color-gray-800);
      background: var(--color-gray-950);
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
      background: rgba(74 222 128 / 0.15);
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
      background: rgba(239 68 68 / 0.15);
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
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-900);
      color: var(--color-gray-200);
    }

    .team-form__input:focus {
      outline: none;
      border-color: var(--color-success);
    }

    .team-form__input::placeholder {
      color: var(--color-gray-600);
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
      background: rgba(74 222 128 / 0.15);
    }

    .alliance-btn--leave {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .alliance-btn--leave:hover {
      background: rgba(239 68 68 / 0.15);
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
  `;

  @state() private _loading = true;
  @state() private _epoch: Epoch | null = null;
  @state() private _pastEpochs: Epoch[] = [];
  @state() private _participants: EpochParticipant[] = [];
  @state() private _teams: EpochTeam[] = [];
  @state() private _leaderboard: LeaderboardEntry[] = [];
  @state() private _missions: OperativeMission[] = [];
  @state() private _threats: OperativeMission[] = [];
  @state() private _battleLog: BattleLogEntry[] = [];
  @state() private _activeTab: TabId = 'overview';
  @state() private _myParticipant: EpochParticipant | null = null;
  @state() private _showCreateWizard = false;
  @state() private _showDeployModal = false;
  @state() private _showAdminPanel = false;
  @state() private _creatingTeam = false;
  @state() private _teamName = '';
  @state() private _actionLoading = false;

  async connectedCallback() {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData() {
    this._loading = true;

    // Ensure simulations are loaded (may be empty if user navigated directly here)
    if (appState.isAuthenticated.value && appState.simulations.value.length === 0) {
      const simResult = await simulationsApi.list();
      if (simResult.success) {
        const simData = simResult.data as unknown as { data?: Simulation[] };
        const sims = simData?.data ?? (simResult.data as unknown as Simulation[]) ?? [];
        appState.setSimulations(sims);
      }
    }

    // Load active epoch
    const activeResult = await epochsApi.getActiveEpoch();
    if (activeResult.success && activeResult.data) {
      this._epoch = activeResult.data;
      await this._loadEpochDetails(activeResult.data.id);
    }

    // Load past epochs
    const pastResult = await epochsApi.listEpochs({ status: 'completed' });
    if (pastResult.success && pastResult.data) {
      const data = pastResult.data as unknown as { data?: Epoch[] };
      this._pastEpochs = (data.data ?? (pastResult.data as unknown as Epoch[])) || [];
    }

    this._loading = false;
  }

  private async _loadEpochDetails(epochId: string) {
    const [participants, teams, leaderboard, battleLog] = await Promise.all([
      epochsApi.listParticipants(epochId),
      epochsApi.listTeams(epochId),
      epochsApi.getLeaderboard(epochId),
      epochsApi.getBattleLogPublic(epochId),
    ]);

    if (participants.success) {
      this._participants = (participants.data as EpochParticipant[]) || [];
      // Find my participation
      const mySimIds = appState.simulations.value.map((s) => s.id);
      this._myParticipant =
        this._participants.find((p) => mySimIds.includes(p.simulation_id)) ?? null;
    }

    if (teams.success) {
      this._teams = (teams.data as EpochTeam[]) || [];
    }

    if (leaderboard.success) {
      this._leaderboard = (leaderboard.data as LeaderboardEntry[]) || [];
    }

    if (battleLog.success) {
      const blogData = battleLog.data as unknown as { data?: BattleLogEntry[] };
      this._battleLog = blogData?.data ?? (battleLog.data as unknown as BattleLogEntry[]) ?? [];
    }

    // Load missions if participating
    if (this._myParticipant && this._epoch) {
      const missionsResult = await epochsApi.listMissions(this._epoch.id, {
        simulation_id: this._myParticipant.simulation_id,
      });
      if (missionsResult.success) {
        const mData = missionsResult.data as unknown as { data?: OperativeMission[] };
        this._missions =
          mData?.data ?? (missionsResult.data as unknown as OperativeMission[]) ?? [];
      }

      const threatResult = await epochsApi.listThreats(
        this._epoch.id,
        this._myParticipant.simulation_id,
      );
      if (threatResult.success) {
        this._threats = (threatResult.data as OperativeMission[]) || [];
      }
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
    return Math.floor((cfg.duration_days * 24) / cfg.cycle_hours);
  }

  private _getPhaseCycleCounts(): { foundation: number; competition: number; reckoning: number } {
    const total = this._getTotalCycles();
    const cfg = this._epoch?.config;
    if (!cfg || total === 0) return { foundation: 0, competition: 0, reckoning: 0 };
    const foundation = Math.round(total * (cfg.foundation_pct / 100));
    const reckoning = Math.round(total * (cfg.reckoning_pct / 100));
    const competition = total - foundation - reckoning;
    return { foundation, competition, reckoning };
  }

  private _renderPhaseStepper() {
    if (!this._epoch) return nothing;
    const status = this._epoch.status;
    if (['lobby', 'cancelled'].includes(status)) return nothing;

    const phases = ['foundation', 'competition', 'reckoning'] as const;
    const phaseLabels: Record<string, string> = {
      foundation: msg('Foundation'),
      competition: msg('Competition'),
      reckoning: msg('Reckoning'),
    };
    const phaseColors: Record<string, string> = {
      foundation: '#4ade80',
      competition: '#f59e0b',
      reckoning: '#ef4444',
    };

    const currentIdx = phases.indexOf(status as (typeof phases)[number]);
    const activeIdx = status === 'completed' ? phases.length : currentIdx;

    const phaseCycles = this._getPhaseCycleCounts();
    const totalCycles = this._getTotalCycles();
    const currentCycle = this._epoch.current_cycle;

    const phaseStartCycle: Record<string, number> = {
      foundation: 1,
      competition: phaseCycles.foundation + 1,
      reckoning: phaseCycles.foundation + phaseCycles.competition + 1,
    };

    return html`
      <div class="stepper">
        ${phases.map((phase, i) => {
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
            ${
              i < phases.length - 1
                ? html`
                  <div class="stepper__track" style="width: ${trackWidth}px">
                    <div
                      class="stepper__track-fill ${isCompleted ? 'stepper__track-fill--completed' : 'stepper__track-fill--upcoming'}"
                      style=${isActive ? `background: ${color}; transform: scaleX(${fillFraction})` : ''}
                    ></div>
                  </div>
                `
                : nothing
            }
          `;
        })}
      </div>
    `;
  }

  private _getOperativeIcon(type: string): string {
    const icons: Record<string, string> = {
      spy: '\u{1F50D}',
      saboteur: '\u{1F4A3}',
      propagandist: '\u{1F4E2}',
      assassin: '\u{1F5E1}',
      guardian: '\u{1F6E1}',
      infiltrator: '\u{1F47B}',
    };
    return icons[type] || '\u{2694}';
  }

  private _getMissionStatusClass(status: string): string {
    if (['success'].includes(status)) return 'mission__status--success';
    if (['deploying', 'returning'].includes(status)) return 'mission__status--deploying';
    if (['detected', 'captured'].includes(status)) return 'mission__status--detected';
    if (['failed'].includes(status)) return 'mission__status--failed';
    return 'mission__status--active';
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading command center...')}></velg-loading-state>`;
    }

    const mainContent = !this._epoch
      ? this._renderLobby()
      : html`
        ${this._renderBanner()}
        ${this._renderLobbyActions()}
        ${this._renderTabs()}
        <div class="content">
          ${this._renderActiveTab()}
        </div>
      `;

    return html`
      ${mainContent}
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
        @modal-close=${this._onDeployModalClose}
        @operative-deployed=${this._onOperativeDeployed}
      ></velg-deploy-operative-modal>
    `;
  }

  // ── Lobby (no active epoch) ──────────────────────

  private _renderLobby() {
    return html`
      <div class="lobby">
        <div class="lobby__header">
          <h1 class="lobby__title">${msg('Epoch Command Center')}</h1>
          <p class="lobby__subtitle">${msg('No active epoch. The multiverse awaits.')}</p>

          ${
            appState.isAuthenticated.value
              ? html`
              <button class="lobby__create-btn" @click=${this._createEpoch}>
                + ${msg('Create New Epoch')}
              </button>
            `
              : html`
              <div class="no-auth">
                <p class="no-auth__text">${msg('Sign in to create or join an epoch.')}</p>
              </div>
            `
          }
        </div>

        ${
          this._pastEpochs.length > 0
            ? html`
            <div class="past-epochs">
              <h2 class="panel__title" style="margin-bottom: var(--space-3)">${msg('Past Epochs')}</h2>
              ${this._pastEpochs.map(
                (epoch, i) => html`
                <div class="past-epoch">
                  <span class="past-epoch__rank">#${i + 1}</span>
                  <span class="past-epoch__name">${epoch.name}</span>
                  <span class="past-epoch__duration">${epoch.config?.duration_days ?? '?'}d</span>
                  <span class="past-epoch__winner">${msg('Completed')}</span>
                </div>
              `,
              )}
            </div>
          `
            : nothing
        }
      </div>
    `;
  }

  // ── Banner (active epoch header) ─────────────────

  private _renderBanner() {
    if (!this._epoch) return nothing;

    const rpCurrent = this._myParticipant?.current_rp ?? 0;
    const rpCap = this._epoch.config?.rp_cap ?? 30;
    const rpFill = Math.min(rpCurrent / rpCap, 1);

    return html`
      <div class="banner">
        <div class="banner__bg"></div>
        <div class="banner__inner">
          <div>
            <h1 class="banner__title">${this._epoch.name}</h1>
            <p class="banner__sub">
              <span class="banner__phase ${this._getPhaseClass(this._epoch.status)}">
                ${this._epoch.status}
              </span>
              &nbsp;&middot;&nbsp;
              ${msg('Cycle')} ${this._epoch.current_cycle}${this._epoch.config ? `/${this._getTotalCycles()}` : ''}
              ${
                this._epoch.config
                  ? html`&nbsp;&middot;&nbsp;${this._epoch.config.cycle_hours}h ${msg('cycles')}`
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
    const tabs: { id: TabId; label: string }[] = [
      { id: 'overview', label: msg('Overview') },
      { id: 'leaderboard', label: msg('Leaderboard') },
      { id: 'operations', label: msg('Operations') },
      { id: 'battle-log', label: msg('Battle Log') },
      { id: 'alliances', label: msg('Alliances') },
    ];

    return html`
      <div class="tabs">
        ${tabs.map(
          (t) => html`
            <button
              class="tab ${this._activeTab === t.id ? 'tab--active' : ''}"
              @click=${() => this._switchTab(t.id)}
            >
              ${t.label}
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
        return this._renderOverview();
      case 'leaderboard':
        return html`
          <velg-epoch-leaderboard
            .entries=${this._leaderboard}
            .epoch=${this._epoch}
          ></velg-epoch-leaderboard>
        `;
      case 'operations':
        return this._renderOperations();
      case 'battle-log':
        return html`
          <velg-epoch-battle-log
            .entries=${this._battleLog}
          ></velg-epoch-battle-log>
        `;
      case 'alliances':
        return this._renderAlliances();
      default:
        return nothing;
    }
  }

  // ── Overview Tab ─────────────────────────────────

  private _renderOverview() {
    return html`
      <div class="overview">
        <!-- Leaderboard Preview -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Leaderboard')}</h3>
          </div>
          <div class="panel__body">
            <velg-epoch-leaderboard
              .entries=${this._leaderboard.slice(0, 5)}
              .epoch=${this._epoch}
              compact
            ></velg-epoch-leaderboard>
          </div>
        </div>

        <!-- Quick Actions -->
        ${
          this._myParticipant
            ? html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Quick Actions')}</h3>
              </div>
              <div class="panel__body">
                <div class="quick-actions">
                  <button class="action-btn" @click=${this._onDeployOperative}>
                    <span>${this._epoch?.status === 'foundation' ? msg('Deploy Guardian') : msg('Deploy Operative')}</span>
                    <span class="action-btn__cost">${this._epoch?.status === 'foundation' ? '3 RP' : '3-8 RP'}</span>
                  </button>
                  <button class="action-btn" @click=${this._onCounterIntel}>
                    <span>${msg('Counter-Intel Sweep')}</span>
                    <span class="action-btn__cost">3 RP</span>
                  </button>
                </div>
              </div>
            </div>
          `
            : html`
            <div class="panel">
              <div class="panel__header">
                <h3 class="panel__title">${msg('Spectating')}</h3>
              </div>
              <div class="panel__body">
                <p class="empty-hint">${msg('You are not participating in this epoch.')}</p>
              </div>
            </div>
          `
        }

        <!-- Active Operations -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Your Operations')}</h3>
            ${
              this._threats.length > 0
                ? html`<span class="threat-count">${this._threats.length} ${msg('threats')}</span>`
                : nothing
            }
          </div>
          <div class="panel__body">
            ${
              this._missions.length > 0
                ? this._missions
                    .filter((m) => ['deploying', 'active'].includes(m.status))
                    .map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No active operations.')}</p>`
            }
          </div>
        </div>

        <!-- Battle Log Preview -->
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Recent Events')}</h3>
          </div>
          <div class="panel__body">
            <velg-epoch-battle-log
              .entries=${this._battleLog.slice(0, 5)}
              compact
            ></velg-epoch-battle-log>
          </div>
        </div>
      </div>
    `;
  }

  // ── Operations Tab ───────────────────────────────

  private _renderOperations() {
    if (!this._myParticipant) {
      return html`<p class="empty-hint">${msg('Join the epoch to deploy operatives.')}</p>`;
    }

    const activeMissions = this._missions.filter((m) =>
      ['deploying', 'active', 'returning'].includes(m.status),
    );
    const completedMissions = this._missions.filter((m) =>
      ['success', 'failed', 'detected', 'captured'].includes(m.status),
    );

    return html`
      <div class="overview">
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Active Missions')} (${activeMissions.length})</h3>
          </div>
          <div class="panel__body">
            ${
              activeMissions.length > 0
                ? activeMissions.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No active missions.')}</p>`
            }
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Intelligence')}</h3>
            ${
              this._threats.length > 0
                ? html`<span class="threat-count">${this._threats.length} ${msg('detected')}</span>`
                : nothing
            }
          </div>
          <div class="panel__body">
            ${
              this._threats.length > 0
                ? this._threats.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No threats detected.')}</p>`
            }
          </div>
        </div>

        <div class="panel panel--full-width">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Mission History')} (${completedMissions.length})</h3>
          </div>
          <div class="panel__body">
            ${
              completedMissions.length > 0
                ? completedMissions.map((m) => this._renderMission(m))
                : html`<p class="empty-hint">${msg('No completed missions yet.')}</p>`
            }
          </div>
        </div>
      </div>
    `;
  }

  // ── Alliances Tab ────────────────────────────────

  private _renderAlliances() {
    const canCreateTeam =
      this._myParticipant &&
      !this._myParticipant.team_id &&
      this._epoch &&
      ['lobby', 'foundation'].includes(this._epoch.status);
    const isAligned = !!this._myParticipant?.team_id;
    const activeTeams = this._teams.filter((t) => !t.dissolved_at);

    return html`
      <div class="overview">
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Active Alliances')}</h3>
          </div>
          <div class="panel__body">
            ${
              canCreateTeam
                ? html`
              <div class="alliance-actions">
                ${
                  this._creatingTeam
                    ? html`
                  <div class="team-form">
                    <input
                      class="team-form__input"
                      type="text"
                      placeholder=${msg('Alliance name...')}
                      .value=${this._teamName}
                      @input=${(e: Event) => {
                        this._teamName = (e.target as HTMLInputElement).value;
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._onCreateTeam();
                      }}
                    />
                    <button
                      class="alliance-btn alliance-btn--join"
                      ?disabled=${!this._teamName.trim() || this._actionLoading}
                      @click=${this._onCreateTeam}
                    >${msg('Create')}</button>
                    <button
                      class="alliance-btn alliance-btn--leave"
                      @click=${() => {
                        this._creatingTeam = false;
                        this._teamName = '';
                      }}
                    >${msg('Cancel')}</button>
                  </div>
                `
                    : html`
                  <button class="lobby-btn lobby-btn--join" @click=${() => {
                    this._creatingTeam = true;
                  }}>
                    + ${msg('Create Alliance')}
                  </button>
                `
                }
              </div>
            `
                : nothing
            }
            ${
              activeTeams.length > 0
                ? activeTeams.map((t) => {
                    const members = this._participants.filter((p) => p.team_id === t.id);
                    const canJoin =
                      this._myParticipant &&
                      !isAligned &&
                      this._epoch &&
                      ['lobby', 'foundation'].includes(this._epoch.status);
                    const isMember = this._myParticipant?.team_id === t.id;

                    return html`
                      <div class="alliance">
                        <div class="alliance__name">${t.name}</div>
                        ${members.map(
                          (p) => html`
                            <div class="alliance__member">
                              ${(p.simulations as { name: string } | undefined)?.name ?? p.simulation_id}
                            </div>
                          `,
                        )}
                        <div class="alliance__actions">
                          ${
                            canJoin
                              ? html`
                            <button
                              class="alliance-btn alliance-btn--join"
                              ?disabled=${this._actionLoading}
                              @click=${() => this._onJoinTeam(t.id)}
                            >${msg('Join')}</button>
                          `
                              : nothing
                          }
                          ${
                            isMember
                              ? html`
                            <button
                              class="alliance-btn alliance-btn--leave"
                              ?disabled=${this._actionLoading}
                              @click=${this._onLeaveTeam}
                            >${msg('Leave')}</button>
                          `
                              : nothing
                          }
                        </div>
                      </div>
                    `;
                  })
                : html`<p class="empty-hint">${msg('No alliances formed.')}</p>`
            }
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Participants')}</h3>
          </div>
          <div class="panel__body">
            ${this._participants.map(
              (p) => html`
              <div class="alliance__member">
                ${(p.simulations as { name: string } | undefined)?.name ?? p.simulation_id}
                ${p.team_id ? '' : html` <span style="color: var(--color-gray-600)">(${msg('unaligned')})</span>`}
              </div>
            `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  // ── Mission Card ─────────────────────────────────

  private _renderMission(m: OperativeMission) {
    const canRecall = ['deploying', 'active'].includes(m.status);
    return html`
      <div class="mission">
        <div class="mission__icon">${this._getOperativeIcon(m.operative_type)}</div>
        <div class="mission__info">
          <div class="mission__type">
            ${m.operative_type}
            ${m.agents?.name ? html` &middot; ${m.agents.name}` : nothing}
          </div>
          <div class="mission__detail">
            ${
              m.success_probability != null
                ? html`${Math.round(m.success_probability * 100)}% ${msg('success')}`
                : nothing
            }
            ${m.cost_rp ? html` &middot; ${m.cost_rp} RP` : nothing}
          </div>
        </div>
        ${
          canRecall
            ? html`
              <button
                class="mission__recall"
                ?disabled=${this._actionLoading}
                @click=${() => this._onRecallOperative(m.id)}
              >${msg('Recall')}</button>
            `
            : nothing
        }
        <span class="mission__status ${this._getMissionStatusClass(m.status)}">
          ${m.status}
        </span>
      </div>
    `;
  }

  // ── Lobby Actions (Join/Leave/Start) ────────────

  private _renderLobbyActions() {
    if (!this._epoch || !appState.isAuthenticated.value) return nothing;

    const isLobby = this._epoch.status === 'lobby';
    const isActive = ['foundation', 'competition', 'reckoning'].includes(this._epoch.status);
    const isCreator = this._epoch.created_by_id === appState.user.value?.id;
    const mySims = appState.simulations.value;
    const participantSimIds = this._participants.map((p) => p.simulation_id);
    const joinableSims = mySims.filter((s) => !participantSimIds.includes(s.id));

    return html`
      <div style="max-width: var(--container-2xl, 1400px); margin: 0 auto; padding: 0 var(--space-6);">
        ${
          isLobby
            ? html`
          <div class="lobby-actions">
            ${joinableSims.map(
              (sim) => html`
              <button
                class="lobby-btn lobby-btn--join"
                ?disabled=${this._actionLoading}
                @click=${() => this._onJoinEpoch(sim.id)}
              >+ ${msg(str`Join as ${sim.name}`)}</button>
            `,
            )}
            ${
              this._myParticipant
                ? html`
              <button
                class="lobby-btn lobby-btn--leave"
                ?disabled=${this._actionLoading}
                @click=${this._onLeaveEpoch}
              >${msg('Leave Epoch')}</button>
            `
                : nothing
            }
            ${
              isCreator
                ? html`
              <button
                class="lobby-btn lobby-btn--start"
                ?disabled=${this._actionLoading || this._participants.length < 2}
                @click=${this._onStartEpoch}
              >${msg('Start Epoch')}</button>
            `
                : nothing
            }
          </div>
        `
            : nothing
        }
        ${isActive && isCreator ? this._renderAdminControls() : nothing}
      </div>
    `;
  }

  // ── Admin Controls (Advance/Resolve/Cancel) ─────

  private _renderAdminControls() {
    if (!this._epoch) return nothing;

    const nextPhaseMap: Record<string, string> = {
      foundation: 'Competition',
      competition: 'Reckoning',
      reckoning: 'Completed',
    };
    const nextPhase = nextPhaseMap[this._epoch.status] ?? '?';

    return html`
      <div class="admin-panel">
        <button class="admin-toggle" @click=${() => {
          this._showAdminPanel = !this._showAdminPanel;
        }}>
          <span>${msg('Admin Controls')}</span>
          <span class="admin-toggle__chevron ${this._showAdminPanel ? 'admin-toggle__chevron--open' : ''}">&#9660;</span>
        </button>
        ${
          this._showAdminPanel
            ? html`
          <div class="admin-body">
            <button
              class="admin-btn admin-btn--advance"
              ?disabled=${this._actionLoading}
              @click=${this._onAdvancePhase}
            >${msg(str`Advance to ${nextPhase}`)}</button>
            <button
              class="admin-btn admin-btn--resolve"
              ?disabled=${this._actionLoading}
              @click=${this._onResolveCycle}
            >${msg('Resolve Cycle')}</button>
            <button
              class="admin-btn admin-btn--cancel"
              ?disabled=${this._actionLoading}
              @click=${this._onCancelEpoch}
            >${msg('Cancel Epoch')}</button>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  // ── Actions ──────────────────────────────────────

  private _createEpoch() {
    this._showCreateWizard = true;
  }

  private _onWizardClose() {
    this._showCreateWizard = false;
  }

  private _onEpochCreated() {
    this._showCreateWizard = false;
    this._loadData();
  }

  private _onDeployOperative() {
    this._showDeployModal = true;
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
    } else {
      VelgToast.error(msg('Counter-intel sweep failed.'));
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
      VelgToast.success(msg('Epoch started!'));
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
    if (result.success) {
      VelgToast.success(msg('Cycle resolved.'));
      await this._loadData();
    } else {
      VelgToast.error(msg('Failed to resolve cycle.'));
    }
  }

  private async _onCancelEpoch() {
    if (!this._epoch) return;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Cancel Epoch'),
      message: msg(
        'This will permanently end the epoch. All missions and scores will be frozen. This cannot be undone.',
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

  // ── Alliance Management ─────────────────────────

  private async _onCreateTeam() {
    if (!this._epoch || !this._myParticipant || !this._teamName.trim()) return;
    this._actionLoading = true;
    const result = await epochsApi.createTeam(
      this._epoch.id,
      this._myParticipant.simulation_id,
      this._teamName.trim(),
    );
    this._actionLoading = false;
    if (result.success) {
      this._creatingTeam = false;
      this._teamName = '';
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

  // ── Operative Recall ────────────────────────────

  private async _onRecallOperative(missionId: string) {
    if (!this._epoch) return;
    this._actionLoading = true;
    const result = await epochsApi.recallOperative(this._epoch.id, missionId);
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
