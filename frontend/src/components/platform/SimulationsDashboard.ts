import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/AgentsApiService.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { resonanceApi } from '../../services/api/index.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { usersApi } from '../../services/api/UsersApiService.js';
import type {
  ActiveEpochParticipation,
  Agent,
  DashboardData,
  MembershipInfo,
  Resonance,
  Simulation,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { agentAltText, humanizeEnum, pluralCount } from '../../utils/text.js';
import { getThemeColor, getThemeVariant } from '../../utils/theme-colors.js';
import { VelgToast } from '../shared/Toast.js';
import { getPlatformPullQuotes, type PullQuote } from './LoreScroll.js';
import './SimulationCard.js';
import '../resonance/ResonanceMonitor.js';
import '../epoch/AcademyEpochCard.js';
import '../forge/ClearanceApplicationCard.js';
import '../forge/ClearanceQueue.js';
import '../shared/VelgBadge.js';
import '../shared/VelgGameCard.js';
import '../shared/PlatformFooter.js';

type DashboardState = 'guest' | 'new_member' | 'active_player' | 'power_user';

/** Session-gated boot animation key */
const BOOT_KEY = 'velg_dashboard_booted';

@localized()
@customElement('velg-simulations-dashboard')
export class VelgSimulationsDashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      min-height: calc(100vh - var(--header-height));
    }

    /* ── Command Strip ── */

    .command-strip {
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4);
      background: rgba(0, 0, 0, 0.6);
      border-bottom: 1px solid var(--color-gray-800);
      position: relative;
      overflow: hidden;
    }

    .command-strip::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          rgba(255 255 255 / 0.006) 3px,
          rgba(255 255 255 / 0.006) 4px
        );
      pointer-events: none;
    }

    /* Corner brackets */
    .command-strip::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      width: 10px;
      height: 10px;
      border-left: 2px solid var(--color-gray-600);
      border-top: 2px solid var(--color-gray-600);
      pointer-events: none;
    }

    .command-strip__bracket-tr {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 10px;
      height: 10px;
      border-right: 2px solid var(--color-gray-600);
      border-top: 2px solid var(--color-gray-600);
      pointer-events: none;
    }

    .command-strip__left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-400);
      position: relative;
      z-index: 1;
    }

    .command-strip__stats {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .command-strip__stat {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .command-strip__stat-value {
      color: var(--color-gray-300);
      font-weight: 600;
    }

    .command-strip__sep {
      color: var(--color-gray-700);
      font-size: 6px;
    }

    .command-strip__right {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-500);
      position: relative;
      z-index: 1;
    }

    .command-strip__cta {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      background: var(--color-accent-amber);
      color: var(--color-gray-950);
      border: none;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .command-strip__cta:hover {
      background: var(--color-accent-amber-hover);
    }

    /* ── Tremor Warning Banner ── */

    .tremor-banner {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: rgba(239, 68, 68, 0.08);
      border-bottom: 2px solid rgba(239, 68, 68, 0.3);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      color: rgba(239, 68, 68, 0.9);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      animation: banner-pulse 3s ease-in-out infinite;
    }

    .tremor-banner__icon {
      flex-shrink: 0;
      animation: tremor-shake 2s ease-in-out infinite;
    }

    .tremor-banner__count {
      font-weight: var(--font-bold);
      color: var(--color-danger);
    }

    @keyframes banner-pulse {
      0%, 100% { background: rgba(239, 68, 68, 0.08); }
      50% { background: rgba(239, 68, 68, 0.04); }
    }

    @keyframes tremor-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-1px); }
      75% { transform: translateX(1px); }
    }

    /* ── Admin Quick Actions ── */

    .admin-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      background: rgba(245, 158, 11, 0.04);
      border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    }

    .admin-bar__btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      background: transparent;
      color: var(--color-accent-amber);
      border: 1px solid rgba(245, 158, 11, 0.3);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .admin-bar__btn:hover {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.5);
    }

    /* ── Welcome Actions Strip (new_member) ── */

    .welcome-strip {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-6);
      background: rgba(245, 158, 11, 0.03);
      border-bottom: 1px solid var(--color-gray-800);
      flex-wrap: wrap;
    }

    .welcome-strip__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid var(--color-gray-600);
      background: transparent;
      color: var(--color-gray-200);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .welcome-strip__btn:hover {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 rgba(245, 158, 11, 0.15);
    }

    .welcome-strip__btn--primary {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
      position: relative;
      animation: training-pulse 2.5s ease-in-out infinite;
    }

    @keyframes training-pulse {
      0%, 100% {
        box-shadow: 4px 4px 0 rgba(245, 158, 11, 0.15), 0 0 0 0 rgba(245, 158, 11, 0.3);
      }
      50% {
        box-shadow: 4px 4px 0 rgba(245, 158, 11, 0.15), 0 0 20px 4px rgba(245, 158, 11, 0.15);
      }
    }

    .welcome-strip__btn--primary::after {
      content: '◀';
      margin-left: var(--space-1);
      font-size: 8px;
      animation: arrow-nudge 1.5s ease-in-out infinite;
    }

    @keyframes arrow-nudge {
      0%, 100% { transform: translateX(0); opacity: 0.6; }
      50% { transform: translateX(-3px); opacity: 1; }
    }

    /* ── Dashboard Body (split-frame) ── */

    .dashboard__body {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      /* Tactical grid background */
      background:
        repeating-linear-gradient(0deg, transparent, transparent 39px,
          color-mix(in srgb, var(--color-gray-700) 4%, transparent) 39px,
          color-mix(in srgb, var(--color-gray-700) 4%, transparent) 40px),
        repeating-linear-gradient(90deg, transparent, transparent 39px,
          color-mix(in srgb, var(--color-gray-700) 4%, transparent) 39px,
          color-mix(in srgb, var(--color-gray-700) 4%, transparent) 40px);
    }

    @media (min-width: 1024px) {
      .dashboard__body {
        grid-template-columns: 3fr 2fr;
      }
    }

    @media (min-width: 1440px) {
      .dashboard__body {
        grid-template-columns: 7fr 8fr 5fr;
        max-width: 1800px;
        margin-inline: auto;
      }

      .dashboard__body {
        background:
          repeating-linear-gradient(0deg, transparent, transparent 59px,
            color-mix(in srgb, var(--color-gray-700) 3%, transparent) 59px,
            color-mix(in srgb, var(--color-gray-700) 3%, transparent) 60px),
          repeating-linear-gradient(90deg, transparent, transparent 59px,
            color-mix(in srgb, var(--color-gray-700) 3%, transparent) 59px,
            color-mix(in srgb, var(--color-gray-700) 3%, transparent) 60px);
      }
    }

    @media (min-width: 2560px) {
      :host {
        background:
          radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%),
          var(--color-gray-950);
      }
      .dashboard__body {
        max-width: 2000px;
      }
    }

    /* ── Columns ── */

    .dashboard__left {
      padding: var(--space-6);
      min-width: 0;
    }

    .dashboard__center {
      padding: var(--space-6);
      min-width: 0;
    }

    .dashboard__right {
      padding: var(--space-6);
      min-width: 0;
    }

    @media (min-width: 1024px) {
      .dashboard__right {
        border-left: 1px solid var(--color-gray-800);
        background: var(--color-gray-900);
      }
    }

    @media (min-width: 1440px) {
      .dashboard__left {
        border-right: 1px solid var(--color-gray-800);
      }

      .dashboard__center {
        max-width: 960px;
      }
    }

    /* ── Section Headers ── */

    .section-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: var(--space-4);
    }

    .section-header__surtitle {
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--color-gray-400);
    }

    .section-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .section-header__count {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      font-weight: normal;
      letter-spacing: normal;
      text-transform: none;
    }

    /* ── Active Operations ── */

    .active-ops {
      margin-bottom: var(--space-6);
    }

    .dossier-card {
      --dossier-color: var(--color-gray-600);
      position: relative;
      display: flex;
      flex-direction: column;
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
      cursor: pointer;
      transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
      overflow: hidden;
      margin-bottom: var(--space-3);
    }

    /* Left accent bar */
    .dossier-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--dossier-color);
      transition: width 0.2s, box-shadow 0.2s;
    }

    .dossier-card:hover {
      border-color: var(--dossier-color);
      transform: translateY(-2px);
      box-shadow:
        0 4px 20px rgba(0 0 0 / 0.4),
        inset 0 0 0 1px color-mix(in srgb, var(--dossier-color) 10%, transparent);
    }

    .dossier-card:hover::before {
      width: 4px;
      box-shadow: 0 0 10px var(--dossier-color);
    }

    .dossier-card--lobby { --dossier-color: var(--color-gray-500); }
    .dossier-card--foundation { --dossier-color: var(--color-success); }
    .dossier-card--competition { --dossier-color: var(--color-warning); }
    .dossier-card--reckoning { --dossier-color: var(--color-danger); }

    .dossier-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-3) var(--space-3) var(--space-2) calc(var(--space-3) + 3px);
    }

    .dossier-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      line-height: 1.1;
      color: var(--color-gray-100);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 65%;
    }

    .dossier-card__status {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 1px var(--space-2);
      border: 1px solid var(--dossier-color);
      flex-shrink: 0;
    }

    .dossier-card__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--dossier-color);
      box-shadow: 0 0 4px var(--dossier-color);
    }

    .dossier-card--foundation .dossier-card__dot,
    .dossier-card--competition .dossier-card__dot,
    .dossier-card--reckoning .dossier-card__dot {
      animation: dot-pulse 2s ease-in-out infinite;
    }

    @keyframes dot-pulse {
      0%, 100% { box-shadow: 0 0 4px var(--dossier-color); opacity: 1; }
      50% { box-shadow: 0 0 10px var(--dossier-color); opacity: 0.6; }
    }

    .dossier-card__status-label {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--dossier-color);
      font-weight: 600;
    }

    .dossier-card__body {
      padding: 0 var(--space-3) var(--space-3) calc(var(--space-3) + 3px);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .dossier-card__sim-name {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-gray-400);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .dossier-card__stats {
      display: flex;
      gap: var(--space-4);
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-gray-400);
    }

    .dossier-card__stat-label {
      margin-right: var(--space-1);
    }

    .dossier-card__stat-value {
      color: var(--color-gray-300);
      font-weight: 600;
    }

    /* Segmented progress bar */
    .dossier-progress {
      display: flex;
      gap: 2px;
      height: 4px;
    }

    .dossier-progress__seg {
      flex: 1;
      background: var(--color-gray-800);
      transition: background 0.2s;
    }

    .dossier-progress__seg--complete {
      background: var(--dossier-color);
    }

    .dossier-progress__seg--current {
      background: var(--dossier-color);
      animation: seg-blink 1.5s ease-in-out infinite;
    }

    @keyframes seg-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .dossier-card__cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) 0;
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--dossier-color);
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 600;
      align-self: flex-start;
    }

    .dossier-card__cta:hover {
      text-decoration: underline;
    }

    .ops-empty {
      padding: var(--space-4);
      text-align: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-gray-500);
      border: 1px dashed var(--color-gray-800);
    }

    .ops-more {
      display: block;
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-gray-400);
      margin-top: var(--space-2);
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }

    .ops-more:hover {
      color: var(--color-accent-amber);
    }

    /* ── My Worlds (1440p+ left column) ── */

    .my-worlds {
      margin-top: var(--space-6);
    }

    .my-world-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-900);
      cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast);
      margin-bottom: var(--space-2);
    }

    .my-world-item:hover {
      border-color: var(--color-gray-600);
      background: var(--color-gray-800);
    }

    .my-world-item__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-200);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .my-world-item__role {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-gray-400);
      padding: 1px 6px;
      border: 1px solid var(--color-gray-700);
    }

    /* ── Shard Grid ── */

    .shard-grid__featured {
      grid-column: 1 / -1;
      min-height: 200px;
      position: relative;
      overflow: hidden;
      border: 1px solid var(--color-gray-700);
      cursor: pointer;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      margin-bottom: var(--space-4);
    }

    .shard-grid__featured:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0 0 0 / 0.5);
    }

    .featured__bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.35);
    }

    .featured__gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%);
    }

    .featured__content {
      position: relative;
      z-index: 1;
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 200px;
    }

    .featured__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }

    .featured__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
    }

    .featured__desc {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: rgba(255, 255, 255, 0.65);
      line-height: var(--leading-relaxed);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin: 0 0 var(--space-2);
    }

    .featured__stats {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
    }

    @media (min-width: 1440px) {
      .shard-grid__featured {
        min-height: 280px;
      }
    }

    .shards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-4);
    }

    @media (min-width: 1440px) {
      .shards-grid {
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      }
    }

    @media (max-width: 480px) {
      .shards-grid {
        grid-template-columns: 1fr;
        overflow: hidden;
      }
    }

    .shards-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .shards-header__spacer { flex: 1; }

    .btn-fracture {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-surface-inverse);
      color: var(--color-gray-900);
      border: 2px solid var(--color-surface-inverse);
      border-radius: var(--border-radius);
      box-shadow: 4px 4px 0 rgba(255, 255, 255, 0.2);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .btn-fracture:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 rgba(255, 255, 255, 0.25);
    }

    .btn-fracture:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 rgba(255, 255, 255, 0.15);
    }

    /* ── Agent Spotlight ── */

    .agent-spotlight {
      margin-bottom: var(--space-6);
      text-align: center;
    }

    .agent-spotlight__label {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-400);
      margin-bottom: var(--space-3);
    }

    .agent-spotlight__sim {
      font-family: var(--font-bureau);
      font-style: italic;
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      margin-top: var(--space-3);
    }

    .agent-spotlight__locked {
      padding: var(--space-8) var(--space-4);
      text-align: center;
      border: 1px dashed var(--color-gray-700);
    }

    .agent-spotlight__locked-text {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-500);
      margin-bottom: var(--space-3);
    }

    .agent-spotlight__card {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0;
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-900);
      cursor: pointer;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      overflow: hidden;
    }

    .agent-spotlight__card:hover {
      border-color: var(--color-gray-600);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.06);
    }

    .agent-spotlight__card:hover .agent-spotlight__cta {
      color: #f59e0b;
      letter-spacing: 0.14em;
    }

    .agent-spotlight__card:hover .agent-spotlight__portrait {
      border-color: var(--color-gray-500);
    }

    .agent-spotlight__card:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .agent-spotlight__header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
    }

    .agent-spotlight__portrait {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--color-gray-700);
      flex-shrink: 0;
      transition: border-color var(--transition-fast);
    }

    .agent-spotlight__info {
      flex: 1;
      min-width: 0;
      text-align: left;
    }

    .agent-spotlight__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-100);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agent-spotlight__profession {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-gray-400);
      margin-top: 2px;
    }

    .agent-spotlight__character {
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1.5;
      color: var(--color-gray-500);
      padding: 0 var(--space-4);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .agent-spotlight__cta {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gray-500);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-gray-800);
      text-align: right;
      transition: color var(--transition-fast), letter-spacing var(--transition-fast);
    }

    /* ── Resonance Ticker ── */

    .resonance-ticker {
      margin-bottom: var(--space-6);
    }

    .resonance-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-gray-800);
      cursor: pointer;
      transition: border-width var(--transition-fast);
    }

    .resonance-item:hover {
      border-bottom-width: 2px;
    }

    .resonance-item__pip {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .resonance-item__pip--detected { background: var(--color-accent-amber); }
    .resonance-item__pip--impacting { background: var(--color-danger); }
    .resonance-item__pip--subsiding { background: var(--color-gray-500); }

    .resonance-item__name {
      flex: 1;
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      color: var(--color-gray-300);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resonance-item__bar {
      width: 60px;
      height: 4px;
      background: var(--color-gray-800);
      overflow: hidden;
      flex-shrink: 0;
    }

    .resonance-item__bar-fill {
      height: 100%;
      transition: width var(--transition-fast);
    }

    .resonance-item__bar-fill--detected { background: var(--color-accent-amber); }
    .resonance-item__bar-fill--impacting { background: var(--color-danger); }
    .resonance-item__bar-fill--subsiding { background: var(--color-gray-500); }

    .resonance-item__time {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-gray-500);
      flex-shrink: 0;
    }

    .resonance-nominal {
      padding: var(--space-4);
      text-align: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-gray-500);
      animation: nominal-breathe 4s ease-in-out infinite;
    }

    @keyframes nominal-breathe {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* ── Academy CTA ── */

    .academy-cta {
      margin-bottom: var(--space-6);
    }

    /* ── Substrate Ticker ── */

    .substrate-ticker {
      height: 28px;
      background: rgba(0, 0, 0, 0.6);
      border-top: 1px solid var(--color-gray-800);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }

    .substrate-ticker__text {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: rgba(255, 255, 255, 0.25);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      white-space: nowrap;
      transition: opacity 0.8s ease;
    }

    .substrate-ticker:hover .substrate-ticker__text {
      color: rgba(245, 158, 11, 0.4);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    /* ── States ── */

    .loading-skeleton {
      min-height: calc(100vh - var(--header-height));
    }

    .skeleton-strip {
      height: 44px;
      background: var(--color-gray-900);
      border-bottom: 1px solid var(--color-gray-800);
      display: flex;
      align-items: center;
      padding: 0 var(--space-4);
    }

    .skeleton-cursor {
      display: inline-block;
      width: 8px;
      height: 14px;
      background: var(--color-gray-600);
      animation: cursor-blink 1s step-end infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .skeleton-body {
      padding: var(--space-6);
      display: grid;
      gap: var(--space-4);
    }

    .skeleton-rect {
      background: linear-gradient(90deg, var(--color-gray-900), var(--color-gray-800), var(--color-gray-900));
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 2px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .error-state {
      margin: var(--space-6);
      padding: var(--space-4);
      background: var(--color-danger-bg);
      border: 2px solid var(--color-danger-border);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 20vh;
      gap: var(--space-4);
      text-align: center;
      padding: var(--space-8) var(--space-6);
    }

    .empty-state velg-clearance-card {
      width: 100%;
      max-width: 400px;
      margin-top: var(--space-4);
    }

    .empty-state__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .empty-state__text {
      font-size: var(--text-base);
      color: var(--color-gray-400);
      max-width: 480px;
    }

    .community-shards__note {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      border-left: 2px solid var(--color-gray-600);
    }

    /* ── Boot Sequence ── */

    .boot-command-strip {
      animation: boot-type 0.8s steps(30) both;
    }

    .boot-left {
      animation: boot-slide-left 0.4s var(--ease-dramatic) both;
      animation-delay: 0.2s;
    }

    .boot-right {
      animation: boot-slide-right 0.4s var(--ease-dramatic) both;
      animation-delay: 0.35s;
    }

    @keyframes boot-type {
      from { clip-path: inset(0 100% 0 0); }
      to { clip-path: inset(0 0 0 0); }
    }

    @keyframes boot-slide-left {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes boot-slide-right {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* ── Responsive ── */

    @media (max-width: 640px) {
      .command-strip {
        height: auto;
        min-height: 36px;
        flex-wrap: wrap;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
      }

      .command-strip__stats {
        display: none;
      }

      .dashboard__left,
      .dashboard__center,
      .dashboard__right {
        padding: var(--space-4) var(--space-3);
      }
    }

    /* ── Mobile h-scroll for dossier cards ── */
    @media (max-width: 1023px) {
      .active-ops__cards--hscroll {
        display: flex;
        gap: var(--space-3);
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        padding-bottom: var(--space-2);
      }

      .active-ops__cards--hscroll .dossier-card {
        min-width: 300px;
        flex-shrink: 0;
        scroll-snap-align: start;
        margin-bottom: 0;
      }
    }

    /* ── My Worlds hidden below 1440 ── */
    .my-worlds {
      display: none;
    }

    @media (min-width: 1440px) {
      .my-worlds {
        display: block;
      }
    }

    /* ── Layout balance: show shards in left column below 1440, hide center ── */
    .dashboard__center {
      display: none;
    }

    .left-shards {
      display: block;
    }

    @media (min-width: 1440px) {
      .dashboard__center {
        display: block;
      }
      .left-shards {
        display: none;
      }
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .boot-command-strip,
      .boot-left,
      .boot-right {
        animation: none;
        opacity: 1;
        transform: none;
        clip-path: none;
      }

      .dossier-card__dot {
        animation: none;
      }

      .dossier-progress__seg--current {
        animation: none;
      }

      .resonance-nominal {
        animation: none;
        opacity: 1;
      }

      .tremor-banner {
        animation: none;
      }

      .tremor-banner__icon {
        animation: none;
      }
    }
  `;

  @state() private _simulations: Simulation[] = [];
  @state() private _allSimulations: Simulation[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _activeResonances: Resonance[] = [];
  @state() private _dashboardData: DashboardData | null = null;
  @state() private _clockText = '';
  @state() private _tickerIndex = 0;
  @state() private _bootSequence = false;
  @state() private _spotlightAgent: Agent | null = null;
  @state() private _spotlightSimSlug = '';

  private _clockTimer = 0;
  private _tickerTimer = 0;
  private _pullQuotes: PullQuote[] = [];

  async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Boot sequence check
    if (!sessionStorage.getItem(BOOT_KEY)) {
      this._bootSequence = true;
      sessionStorage.setItem(BOOT_KEY, '1');
    }

    this._pullQuotes = getPlatformPullQuotes();
    this._updateClock();
    this._clockTimer = window.setInterval(() => this._updateClock(), 60_000);
    this._tickerTimer = window.setInterval(() => {
      if (this._pullQuotes.length > 0) {
        this._tickerIndex = (this._tickerIndex + 1) % this._pullQuotes.length;
      }
    }, 12_000);

    await this._loadAll();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._clockTimer) clearInterval(this._clockTimer);
    if (this._tickerTimer) clearInterval(this._tickerTimer);
  }

  private async _loadAll(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const isAuth = appState.isAuthenticated.value;
      const promises: Promise<void>[] = [this._loadSimulations(), this._loadActiveResonances()];

      if (isAuth) {
        promises.push(this._loadDashboard());
        promises.push(this._loadAllSimulations());
      }

      await Promise.all(promises);

      // For guests, use the (only) simulations list as the community pool, shuffled
      if (!isAuth) {
        this._allSimulations = [...this._simulations].sort(() => Math.random() - 0.5);
      }

      // Load agent spotlight (non-blocking)
      this._loadSpotlightAgent();
    } finally {
      this._loading = false;
    }
  }

  private async _loadSimulations(): Promise<void> {
    try {
      const response = await simulationsApi.list();
      const items = Array.isArray(response.data) ? response.data : [];
      if (response.success) {
        this._simulations = items;
        appState.setSimulations(items);
      } else {
        this._error = response.error?.message || msg('Failed to load simulations.');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading simulations.');
    }
  }

  private async _loadAllSimulations(): Promise<void> {
    try {
      const response = await simulationsApi.listPublic();
      const items = Array.isArray(response.data) ? response.data : [];
      if (response.success) {
        // Shuffle so community shards appear in random order each page load
        this._allSimulations = items.sort(() => Math.random() - 0.5);
      }
    } catch {
      // Non-critical — community shards just won't show
    }
  }

  private async _loadActiveResonances(): Promise<void> {
    try {
      const res = await resonanceApi.list({ limit: '10' });
      if (res.success && res.data) {
        this._activeResonances = (res.data as Resonance[]).filter(
          (r) => r.status === 'detected' || r.status === 'impacting' || r.status === 'subsiding',
        );
      }
    } catch {
      // Non-critical
    }
  }

  private async _loadDashboard(): Promise<void> {
    try {
      const res = await usersApi.getDashboard();
      if (res.success && res.data) {
        this._dashboardData = res.data as DashboardData;
      }
    } catch {
      // Non-critical — dashboard works without this
    }
  }

  private async _loadSpotlightAgent(): Promise<void> {
    try {
      // Pick from user's own simulations only
      const ownedWithAgents = this._simulations.filter((s) => s.agent_count && s.agent_count > 0);
      if (ownedWithAgents.length === 0) return;

      const sim = ownedWithAgents[Math.floor(Math.random() * ownedWithAgents.length)];
      const res = await agentsApi.listPublic(sim.id, { limit: '10' });
      if (!res.success || !res.data) return;

      const agents = (res.data as Agent[]).filter((a) => a.portrait_image_url);
      if (agents.length === 0) return;

      this._spotlightAgent = agents[Math.floor(Math.random() * agents.length)];
      this._spotlightSimSlug = sim.slug;
    } catch {
      // Non-critical — placeholder remains
    }
  }

  private _getUserState(): DashboardState {
    if (!appState.isAuthenticated.value) return 'guest';
    const dd = this._dashboardData;
    if (dd && !dd.memberships.length && !dd.active_epoch_participations.length) return 'new_member';
    if (appState.isPlatformAdmin.value || appState.canForge.value) return 'power_user';
    return 'active_player';
  }

  private _updateClock(): void {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    this._clockText = `${y}.${m}.${d} // ${h}:${min} UTC`;
  }

  private _handleCreateClick(): void {
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/forge', bubbles: true, composed: true }),
    );
  }

  private async _handleStartAcademy(): Promise<void> {
    // If there's already an active academy epoch, navigate to it instead
    const activeAcademy = this._dashboardData?.active_epoch_participations?.find(
      (ep) => ep.epoch_type === 'academy',
    );
    if (activeAcademy) {
      window.history.pushState({}, '', `/epochs/${activeAcademy.epoch_id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    try {
      const resp = await epochsApi.createQuickAcademy();
      if (resp.success && resp.data) {
        VelgToast.success(msg('Academy epoch created. Preparing training simulation.'));
        // Refresh dashboard data so "Your Epochs" updates
        this._loadDashboard();
        window.history.pushState({}, '', `/epochs/${resp.data.id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to create academy epoch.'));
      }
    } catch {
      VelgToast.error(msg('Failed to create academy epoch.'));
    }
  }

  private _handleSimulationClick(e: CustomEvent<Simulation>): void {
    const simulation = e.detail;
    appState.setCurrentSimulation(simulation);
    window.history.pushState({}, '', `/simulations/${simulation.slug}/lore`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _navigateTo(path: string): void {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private _handleTickerClick(): void {
    const quote = this._pullQuotes[this._tickerIndex];
    if (quote) {
      this._navigateTo(`/archives#section-${quote.afterSectionId}`);
    }
  }

  private _getTremorMessage(): string {
    const rs = this._activeResonances;
    const count = rs.length;
    const impacting = rs.filter((r) => r.status === 'impacting').length;
    const maxMag = Math.max(...rs.map((r) => r.magnitude), 0);
    const allSubsiding = rs.every((r) => r.status === 'subsiding');

    if (allSubsiding) {
      return count === 1
        ? msg('residual substrate displacement — monitoring decay curve')
        : msg('multiple tremors entering decay phase — substrate settling');
    }
    if (maxMag >= 8) return msg('severe substrate distortion — local geometry unreliable');
    if (impacting >= 3)
      return msg('concurrent substrate fractures — recommend caution in affected zones');
    if (impacting >= 2) return msg('overlapping tremor signatures — interference patterns forming');
    if (impacting === 1)
      return msg('active substrate displacement — affected zones may behave unpredictably');
    if (count >= 3) return msg('multiple signatures detected — the substrate is restless');
    return msg('substrate anomaly detected — origin unclear');
  }

  private _getRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  protected render() {
    if (this._loading) {
      return this._renderSkeleton();
    }

    if (this._error) {
      return html`<div class="error-state">${this._error}</div>`;
    }

    const userState = this._getUserState();
    const boot = this._bootSequence;

    return html`
      ${this._renderCommandStrip(userState, boot)}
      ${this._renderTremorBanner()}
      ${userState === 'power_user' ? this._renderAdminBar() : nothing}
      ${userState === 'new_member' ? this._renderWelcomeStrip() : nothing}
      ${this._renderBody(userState, boot)}
      ${this._renderSubstrateTicker()}
      <velg-platform-footer></velg-platform-footer>
    `;
  }

  private _renderSkeleton() {
    return html`
      <div class="loading-skeleton">
        <div class="skeleton-strip">
          <span class="skeleton-cursor"></span>
        </div>
        <div class="skeleton-body">
          <div class="skeleton-rect" style="height: 44px; width: 60%"></div>
          <div class="skeleton-rect" style="height: 200px;"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-4);">
            <div class="skeleton-rect" style="height: 280px;"></div>
            <div class="skeleton-rect" style="height: 280px;"></div>
            <div class="skeleton-rect" style="height: 280px;"></div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderCommandStrip(userState: DashboardState, boot: boolean) {
    const isGuest = userState === 'guest';
    const dd = this._dashboardData;
    const shardCount = this._simulations.length;
    const opsCount = dd?.active_epoch_participations.length ?? 0;

    return html`
      <div class="command-strip ${boot ? 'boot-command-strip' : ''}" aria-label="${msg('Operative status bar')}">
        <span class="command-strip__bracket-tr"></span>
        <div class="command-strip__left">
          ${
            isGuest
              ? html`// ${msg('OBSERVATION MODE')} // ${msg('CLEARANCE: RESTRICTED')}`
              : html`
              // ${msg('OPERATIVE TERMINAL')} // ${appState.user.value?.email ?? ''}
              <span class="command-strip__stats">
                <span class="command-strip__sep">|</span>
                <span class="command-strip__stat">
                  <span class="command-strip__stat-label">${msg('SHARDS:')}</span>
                  <span class="command-strip__stat-value">${shardCount}</span>
                </span>
                <span class="command-strip__sep">|</span>
                <span class="command-strip__stat">
                  <span class="command-strip__stat-label">${msg('ACTIVE OPS:')}</span>
                  <span class="command-strip__stat-value">${opsCount}</span>
                </span>
                <span class="command-strip__sep">|</span>
                <span class="command-strip__stat">
                  <span class="command-strip__stat-label">${msg('SUBSTRATE:')}</span>
                  <span class="command-strip__stat-value">${this._activeResonances.length > 0 ? msg('ANOMALOUS') : msg('STABLE')}</span>
                </span>
              </span>
            `
          }
        </div>
        <div class="command-strip__right">
          ${
            isGuest
              ? html`<button class="command-strip__cta" @click=${() => this._navigateTo('/register')}>${msg('SIGN UP')}</button>`
              : this._clockText
          }
        </div>
      </div>
    `;
  }

  private _renderTremorBanner() {
    if (this._activeResonances.length === 0) return nothing;
    return html`
      <div class="tremor-banner" role="alert">
        <span class="tremor-banner__icon" aria-hidden="true">${icons.substrateTremor(18)}</span>
        <span class="tremor-banner__count">${this._activeResonances.length}</span>
        ${this._getTremorMessage()}
      </div>
    `;
  }

  private _renderAdminBar() {
    return html`
      <div class="admin-bar">
        ${
          appState.isPlatformAdmin.value
            ? html`
          <button class="admin-bar__btn" @click=${() => this._navigateTo('/admin')}>${msg('Admin Panel')}</button>
        `
            : nothing
        }
        ${
          appState.canForge.value
            ? html`
          <button class="admin-bar__btn" @click=${() => this._navigateTo('/forge')}>${msg('Forge')}</button>
        `
            : nothing
        }
        <button class="admin-bar__btn" @click=${() => this._navigateTo('/epoch')}>${msg('Create Epoch')}</button>
      </div>
    `;
  }

  private _renderWelcomeStrip() {
    return html`
      <div class="welcome-strip">
        <button class="welcome-strip__btn welcome-strip__btn--primary" @click=${this._handleStartAcademy}>
          ${this._hasActiveAcademy() ? msg('Resume Academy') : msg('Start Training')}
        </button>
        ${
          appState.canForge.value
            ? html`<button class="welcome-strip__btn" @click=${this._handleCreateClick}>${msg('Create World')}</button>`
            : nothing
        }
        <button class="welcome-strip__btn" @click=${() => window.scrollTo({ top: 400, behavior: 'smooth' })}>
          ${msg('Browse Shards')}
        </button>
      </div>
    `;
  }

  private _renderBody(userState: DashboardState, boot: boolean) {
    const isGuest = userState === 'guest';

    return html`
      <div class="dashboard__body">
        <!-- Left / Main Column -->
        <div class="dashboard__left ${boot ? 'boot-left' : ''}">
          ${
            !isGuest && appState.isPlatformAdmin.value
              ? html`<velg-clearance-queue variant="compact"></velg-clearance-queue>`
              : nothing
          }
          ${!isGuest ? this._renderActiveOps() : nothing}
          ${!isGuest ? this._renderMyWorlds() : nothing}
          <div class="left-shards">
            ${this._renderShardSection()}
          </div>
        </div>

        <!-- Center Column (visible at 1440p+ via CSS) -->
        <div class="dashboard__center ${boot ? 'boot-left' : ''}">
          ${this._renderShardSection()}
        </div>

        <!-- Right Column -->
        <div class="dashboard__right ${boot ? 'boot-right' : ''}">
          ${!isGuest ? this._renderAgentSpotlight() : nothing}
          ${this._renderResonanceTicker()}
          ${this._renderAcademyCta(userState)}
          ${
            !isGuest && this._simulations.length > 0
              ? html`<velg-clearance-card style="--i: 3"></velg-clearance-card>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderActiveOps() {
    const dd = this._dashboardData;
    const participations = dd?.active_epoch_participations ?? [];
    const shown = participations.slice(0, 3);
    const remaining = participations.length - 3;

    return html`
      <section class="active-ops" aria-label="${msg('Active epoch operations')}">
        <div class="section-header">
          <span class="section-header__surtitle">${msg('ACTIVE OPERATIONS')}</span>
          <h2 class="section-header__title">${msg('Your Epochs')}</h2>
        </div>
        ${
          shown.length > 0
            ? html`
            <div class="active-ops__cards--hscroll">
              ${shown.map((ep, i) => this._renderDossierCard(ep, i))}
            </div>
            ${
              remaining > 0
                ? html`<button class="ops-more" @click=${() => this._navigateTo('/epoch')}>+${remaining} ${msg('more')}</button>`
                : nothing
            }
          `
            : html`<div class="ops-empty">${msg('NO ACTIVE DEPLOYMENT')}</div>`
        }
      </section>
    `;
  }

  private _renderDossierCard(ep: ActiveEpochParticipation, index: number) {
    const totalSegs = Math.min(ep.total_cycles, 20);
    const filledSegs =
      totalSegs > 0 ? Math.round((ep.current_cycle / ep.total_cycles) * totalSegs) : 0;

    return html`
      <div
        class="dossier-card dossier-card--${ep.epoch_status}"
        style="--i: ${index}"
        @click=${() => this._navigateTo(`/epoch`)}
      >
        <div class="dossier-card__header">
          <span class="dossier-card__name">${ep.epoch_name}</span>
          <span class="dossier-card__status">
            <span class="dossier-card__dot"></span>
            <span class="dossier-card__status-label">${ep.epoch_status}</span>
          </span>
        </div>
        <div class="dossier-card__body">
          <span class="dossier-card__sim-name">${ep.simulation_name}</span>
          <div class="dossier-progress">
            ${Array.from({ length: totalSegs }, (_, i) => {
              let cls = 'dossier-progress__seg';
              if (i < filledSegs) cls += ' dossier-progress__seg--complete';
              else if (i === filledSegs) cls += ' dossier-progress__seg--current';
              return html`<div class="${cls}"></div>`;
            })}
          </div>
          <div class="dossier-card__stats">
            <span>
              <span class="dossier-card__stat-label">${msg('CYCLE')}</span>
              <span class="dossier-card__stat-value">${ep.current_cycle}/${ep.total_cycles}</span>
            </span>
            <span>
              <span class="dossier-card__stat-label">${msg('RP')}</span>
              <span class="dossier-card__stat-value">${ep.current_rp}/${ep.rp_cap}</span>
            </span>
          </div>
          <button class="dossier-card__cta">${msg('ENTER WAR ROOM')} &rarr;</button>
        </div>
      </div>
    `;
  }

  private _renderMyWorlds() {
    const memberships = this._dashboardData?.memberships ?? [];
    if (!memberships.length) return nothing;

    return html`
      <section class="my-worlds">
        <div class="section-header">
          <span class="section-header__surtitle">${msg('SIMULATION ROSTER')}</span>
          <h2 class="section-header__title">${msg('My Worlds')}</h2>
        </div>
        ${memberships.slice(0, 5).map((m) => this._renderMyWorldItem(m))}
      </section>
    `;
  }

  private _renderMyWorldItem(m: MembershipInfo) {
    return html`
      <div class="my-world-item" @click=${() => this._navigateTo(`/simulations/${m.simulation_slug}/lore`)}>
        <span class="my-world-item__name">${m.simulation_name}</span>
        <span class="my-world-item__role">${humanizeEnum(m.member_role)}</span>
      </div>
    `;
  }

  private _renderShardSection() {
    const isAuth = appState.isAuthenticated.value;
    const myShards = isAuth ? this._simulations : [];
    const memberIds = new Set(myShards.map((s) => s.id));
    const communityShards = this._allSimulations.filter((s) => !memberIds.has(s.id));

    return html`
      ${isAuth ? this._renderMyShards(myShards) : nothing}
      ${this._renderCommunityShards(communityShards, isAuth)}
    `;
  }

  private _renderMyShards(sims: Simulation[]) {
    if (sims.length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-state__title">${msg('No Own Shards Yet')}</div>
          <div class="empty-state__text">
            ${msg('Join an existing shard or start training to learn the ropes.')}
          </div>
          <velg-clearance-card style="--i: 1"></velg-clearance-card>
        </div>
      `;
    }

    const featured = sims.find((s) => s.banner_url) ?? sims[0];
    const rest = sims.filter((s) => s !== featured);

    return html`
      <section aria-label="${msg('Your simulation worlds')}">
        <div class="shards-header">
          <div class="section-header" style="margin-bottom: 0;">
            <span class="section-header__surtitle">${msg('YOUR SHARDS')}</span>
            <h2 class="section-header__title">
              ${msg('My Worlds')}
              <span class="section-header__count">${sims.length}</span>
            </h2>
          </div>
          <div class="shards-header__spacer"></div>
          ${
            appState.canForge.value
              ? html`<button class="btn-fracture" @click=${this._handleCreateClick}>${msg('Fracture a New Shard')}</button>`
              : nothing
          }
        </div>
        ${this._renderFeaturedShard(featured)}
        ${
          rest.length > 0
            ? html`
          <div class="shards-grid" role="list">
            ${rest.map(
              (sim, i) => html`
                <velg-simulation-card
                  role="listitem"
                  style="--i: ${i}"
                  .simulation=${sim}
                  @simulation-click=${this._handleSimulationClick}
                ></velg-simulation-card>
              `,
            )}
          </div>
        `
            : nothing
        }
      </section>
    `;
  }

  private _renderCommunityShards(sims: Simulation[], isAuth: boolean) {
    if (sims.length === 0) {
      if (!isAuth) {
        return html`
          <div class="empty-state">
            <div class="empty-state__title">${msg('No Shards Yet')}</div>
            <div class="empty-state__text">
              ${msg('The multiverse awaits its first fracture.')}</div>
          </div>
        `;
      }
      return nothing;
    }

    const featured = sims.find((s) => s.banner_url) ?? sims[0];
    const rest = sims.filter((s) => s !== featured);

    return html`
      <section aria-label="${msg('Community simulation worlds')}">
        <div class="shards-header">
          <div class="section-header" style="margin-bottom: 0;">
            <span class="section-header__surtitle">${msg('SHARD REGISTRY')}</span>
            <h2 class="section-header__title">
              ${isAuth ? msg('Community Shards') : msg('Shards')}
              <span class="section-header__count">${sims.length}</span>
            </h2>
          </div>
          <div class="shards-header__spacer"></div>
        </div>
        ${
          isAuth
            ? html`
          <div class="community-shards__note">
            ${msg('Shards created and managed by other observers. Browse freely.')}
          </div>
        `
            : nothing
        }
        ${this._renderFeaturedShard(featured)}
        ${
          rest.length > 0
            ? html`
          <div class="shards-grid" role="list">
            ${rest.map(
              (sim, i) => html`
                <velg-simulation-card
                  role="listitem"
                  style="--i: ${i}"
                  .simulation=${sim}
                  @simulation-click=${this._handleSimulationClick}
                ></velg-simulation-card>
              `,
            )}
          </div>
        `
            : nothing
        }
      </section>
    `;
  }

  private _renderFeaturedShard(sim: Simulation) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const bannerUrl = sim.banner_url
      ? sim.banner_url.startsWith('http')
        ? sim.banner_url
        : `${supabaseUrl}${sim.banner_url}`
      : null;

    const desc = t(sim, 'description');
    const themeColor = getThemeColor(sim.theme);

    const stats = [
      sim.agent_count ? pluralCount(sim.agent_count, msg('Agent'), msg('Agents')) : null,
      sim.building_count
        ? pluralCount(sim.building_count, msg('Building'), msg('Buildings'))
        : null,
      sim.event_count ? pluralCount(sim.event_count, msg('Event'), msg('Events')) : null,
    ]
      .filter(Boolean)
      .join(' // ');

    return html`
      <div
        class="shard-grid__featured"
        role="link"
        aria-label="${sim.name} — ${desc || sim.theme}"
        @click=${() => {
          appState.setCurrentSimulation(sim);
          this._navigateTo(`/simulations/${sim.slug}/lore`);
        }}
      >
        ${
          bannerUrl
            ? html`<img class="featured__bg" src=${bannerUrl} alt="${sim.name} — ${desc || sim.theme}" loading="lazy" />`
            : html`<div class="featured__bg" style="background: linear-gradient(135deg, var(--color-gray-900), var(--color-gray-800));"></div>`
        }
        <div class="featured__gradient"></div>
        <div class="featured__content" style="border-left: 3px solid ${themeColor}">
          <div class="featured__header">
            <h3 class="featured__name">${sim.name}</h3>
            <velg-badge variant=${getThemeVariant(sim.theme)}>${sim.theme}</velg-badge>
          </div>
          ${desc ? html`<p class="featured__desc">${desc}</p>` : nothing}
          ${stats ? html`<span class="featured__stats">${stats}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderAgentSpotlight() {
    const agent = this._spotlightAgent;

    return html`
      <section class="agent-spotlight">
        <div class="agent-spotlight__label">${msg('DOSSIER // FIELD OPERATIVE')}</div>
        ${
          agent
            ? html`
            <div
              class="agent-spotlight__card"
              role="link"
              tabindex="0"
              aria-label="${agentAltText(agent)}"
              @click=${() => this._navigateTo(`/simulations/${this._spotlightSimSlug}/agents`)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._navigateTo(`/simulations/${this._spotlightSimSlug}/agents`);
                }
              }}
            >
              <div class="agent-spotlight__header">
                <img
                  class="agent-spotlight__portrait"
                  src=${agent.portrait_image_url ?? ''}
                  alt=${agentAltText(agent)}
                  loading="lazy"
                />
                <div class="agent-spotlight__info">
                  <div class="agent-spotlight__name">${agent.name}</div>
                  ${
                    agent.primary_profession
                      ? html`<div class="agent-spotlight__profession">${t(agent, 'primary_profession')}</div>`
                      : nothing
                  }
                </div>
              </div>
              ${
                t(agent, 'character')
                  ? html`<div class="agent-spotlight__character">${t(agent, 'character')}</div>`
                  : nothing
              }
              <div class="agent-spotlight__cta">${msg('View Dossier')} &rarr;</div>
            </div>
          `
            : html`
            <div class="agent-spotlight__locked">
              <div class="agent-spotlight__locked-text">${msg('DOSSIER LOADING')}</div>
              <div style="color: var(--color-gray-500); font-family: var(--font-mono); font-size: 9px;">
                ${msg('Scanning operative records')}
              </div>
            </div>
          `
        }
      </section>
    `;
  }

  private _renderResonanceTicker() {
    const resonances = this._activeResonances.slice(0, 5);

    return html`
      <section class="resonance-ticker" aria-label="${msg('Active substrate anomalies')}">
        <div class="section-header">
          <span class="section-header__surtitle">${msg('SUBSTRATE MONITOR')}</span>
          <h2 class="section-header__title">${msg('Resonance')}</h2>
        </div>
        ${
          resonances.length > 0
            ? resonances.map(
                (r) => html`
            <div class="resonance-item" @click=${() => this._navigateTo('/dashboard')}>
              <span class="resonance-item__pip resonance-item__pip--${r.status}"></span>
              <span class="resonance-item__name">${r.title}</span>
              <div class="resonance-item__bar">
                <div
                  class="resonance-item__bar-fill resonance-item__bar-fill--${r.status}"
                  style="width: ${Math.min(r.magnitude * 10, 100)}%"
                ></div>
              </div>
              <span class="resonance-item__time">${this._getRelativeTime(r.detected_at)}</span>
            </div>
          `,
              )
            : html`<div class="resonance-nominal">${msg('SUBSTRATE: NOMINAL')}</div>`
        }
      </section>
    `;
  }

  private _hasActiveAcademy(): boolean {
    return !!this._dashboardData?.active_epoch_participations?.some(
      (ep) => ep.epoch_type === 'academy',
    );
  }

  private _renderAcademyCta(userState: DashboardState) {
    if (userState === 'guest') return nothing;
    const played = this._dashboardData?.academy_epochs_played ?? 0;
    const hasActive = this._hasActiveAcademy();
    if (played >= 3 && !hasActive) return nothing;

    return html`
      <section class="academy-cta">
        <velg-academy-epoch-card
          .academyEpochsPlayed=${played}
          ?hasActiveEpoch=${hasActive}
          @start-academy=${this._handleStartAcademy}
        ></velg-academy-epoch-card>
      </section>
    `;
  }

  private _renderSubstrateTicker() {
    if (!this._pullQuotes.length) return nothing;
    const quote = this._pullQuotes[this._tickerIndex];

    return html`
      <div
        class="substrate-ticker"
        aria-hidden="true"
        @click=${this._handleTickerClick}
      >
        <span class="substrate-ticker__text">
          // ${quote.text} //
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulations-dashboard': VelgSimulationsDashboard;
  }
}
