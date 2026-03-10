/**
 * Epoch Operations Board — the epoch list/grid view shown when no epoch is selected.
 *
 * Extracted from EpochCommandCenter. Shows:
 * - Active epoch dossier cards with join buttons
 * - Past epochs section
 * - COMMS sidebar (collapsible chat panel)
 * - Create new epoch card/button
 *
 * Atmospheric redesign: tactical grid, radar sweep, scan beam,
 * phase-intensity card hierarchy, segmented progress bars.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import type { Epoch, EpochParticipant, Simulation } from '../../types/index.js';
import { computeTotalCycles } from '../../utils/epoch.js';
import { icons } from '../../utils/icons.js';
import './EpochChatPanel.js';

@localized()
@customElement('velg-epoch-ops-board')
export class VelgEpochOpsBoard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Operations Board ─────────────────── */

    .ops-board {
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: var(--space-6);
      position: relative;
      /* Tactical grid background */
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 39px,
          color-mix(in srgb, var(--color-border, var(--color-gray-700)) 6%, transparent) 39px,
          color-mix(in srgb, var(--color-border, var(--color-gray-700)) 6%, transparent) 40px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 39px,
          color-mix(in srgb, var(--color-border, var(--color-gray-700)) 6%, transparent) 39px,
          color-mix(in srgb, var(--color-border, var(--color-gray-700)) 6%, transparent) 40px
        );
    }

    /* CRT scanline overlay on entire board */
    .ops-board::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          rgba(255 255 255 / 0.008) 3px,
          rgba(255 255 255 / 0.008) 4px
        );
      pointer-events: none;
      z-index: 1;
    }

    /* Scan beam — thin horizontal sweep */
    .ops-board::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--color-primary) 12%, transparent) 20%,
        color-mix(in srgb, var(--color-primary) 25%, transparent) 50%,
        color-mix(in srgb, var(--color-primary) 12%, transparent) 80%,
        transparent 100%
      );
      opacity: 0.5;
      pointer-events: none;
      z-index: 2;
      animation: scan-beam 12s linear infinite;
    }

    @keyframes scan-beam {
      0% { top: -2px; }
      100% { top: 100%; }
    }

    /* Ambient glow — soft radial from top center */
    .ops-board__glow {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      height: 300px;
      background: radial-gradient(
        ellipse at center top,
        color-mix(in srgb, var(--color-primary) 5%, transparent) 0%,
        transparent 70%
      );
      pointer-events: none;
      z-index: 0;
    }

    /* ── Header ──────────────────────────── */

    .ops-board__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: var(--space-5);
      padding: var(--space-4) var(--space-5) var(--space-3);
      border-bottom: 2px solid var(--color-gray-800);
      position: relative;
      animation: lobby-fade 0.6s ease-out;
      overflow: hidden;
    }

    /* Radar sweep — conic gradient behind header */
    .ops-board__header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 200px;
      height: 200px;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        color-mix(in srgb, var(--color-primary) 8%, transparent) 30deg,
        transparent 60deg
      );
      border-radius: 50%;
      opacity: 0.6;
      animation: radar-sweep 8s linear infinite;
      pointer-events: none;
    }

    @keyframes radar-sweep {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Corner brackets — top-left and bottom-right */
    .ops-board__header::after {
      content: '';
      position: absolute;
      top: 6px;
      left: 6px;
      width: 14px;
      height: 14px;
      border-left: 2px solid var(--color-gray-600);
      border-top: 2px solid var(--color-gray-600);
      pointer-events: none;
    }

    .ops-board__bracket-br {
      position: absolute;
      bottom: 6px;
      right: 6px;
      width: 14px;
      height: 14px;
      border-right: 2px solid var(--color-gray-600);
      border-bottom: 2px solid var(--color-gray-600);
      pointer-events: none;
    }

    .ops-board__title-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      position: relative;
      z-index: 1;
    }

    .ops-board__surtitle {
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--color-gray-400);
    }

    .ops-board__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-3xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      line-height: 1;
      text-shadow: 0 0 30px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    /* ── Data readout strip ──────────────── */

    .ops-board__readout {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-gray-400);
      margin-bottom: var(--space-5);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-gray-800);
      animation: lobby-fade 0.6s ease-out 0.1s both;
    }

    .ops-board__readout-item {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .ops-board__readout-value {
      color: var(--color-gray-400);
      font-weight: 600;
    }

    .ops-board__readout-sep {
      color: var(--color-gray-700);
      font-size: 6px;
    }

    .ops-board__create-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-950);
      background: var(--color-gray-100);
      border: 2px solid var(--color-gray-100);
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      z-index: 1;
    }

    .ops-board__create-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-700);
    }

    .ops-board__create-btn:active {
      transform: translate(0);
      box-shadow: none;
    }

    /* ── Epoch Dossier Grid ───────────────── */

    .dossier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-4);
    }

    @media (max-width: 640px) {
      .dossier-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ── Dossier Card ─────────────────────── */

    .dossier-card {
      --dossier-color: var(--color-gray-600);
      --accent-bar-width: 3px;
      position: relative;
      display: flex;
      flex-direction: column;
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
      cursor: pointer;
      transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
      overflow: hidden;
      opacity: 0;
      animation: dossier-enter 0.4s ease-out forwards;
    }

    @keyframes dossier-enter {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .dossier-card:nth-child(1) { animation-delay: 60ms; }
    .dossier-card:nth-child(2) { animation-delay: 140ms; }
    .dossier-card:nth-child(3) { animation-delay: 220ms; }
    .dossier-card:nth-child(4) { animation-delay: 300ms; }
    .dossier-card:nth-child(5) { animation-delay: 380ms; }
    .dossier-card:nth-child(6) { animation-delay: 460ms; }

    /* Left accent bar */
    .dossier-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--accent-bar-width);
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
      width: calc(var(--accent-bar-width) + 1px);
      box-shadow: 0 0 10px var(--dossier-color);
    }

    /* ── Phase-intensity styles ──────────── */

    /* LOBBY — desaturated, subtle, waiting */
    .dossier-card--lobby {
      --dossier-color: var(--color-gray-500);
      --accent-bar-width: 2px;
      opacity: 0;
      animation: dossier-enter 0.4s ease-out forwards;
    }

    .dossier-card--lobby .dossier-card__name {
      color: var(--color-gray-300);
    }

    /* FOUNDATION — building phase, moderate presence */
    .dossier-card--foundation {
      --dossier-color: var(--color-success);
      --accent-bar-width: 3px;
      animation: dossier-enter 0.4s ease-out forwards, dossier-pulse-soft 5s ease-in-out 0.5s infinite;
    }

    /* COMPETITION — active, prominent, peak engagement */
    .dossier-card--competition {
      --dossier-color: var(--color-warning);
      --accent-bar-width: 4px;
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-warning) 8%, transparent);
      animation: dossier-enter 0.4s ease-out forwards, dossier-pulse-medium 4s ease-in-out 0.5s infinite;
    }

    .dossier-card--competition:hover {
      box-shadow:
        0 4px 24px rgba(0 0 0 / 0.5),
        0 0 20px color-mix(in srgb, var(--color-warning) 15%, transparent);
    }

    /* RECKONING — maximum intensity, crisis mode */
    .dossier-card--reckoning {
      --dossier-color: var(--color-danger);
      --accent-bar-width: 5px;
      border-color: color-mix(in srgb, var(--color-danger) 25%, var(--color-gray-800));
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-danger) 10%, transparent);
      animation: dossier-enter 0.4s ease-out forwards, dossier-pulse-intense 3s ease-in-out 0.5s infinite;
    }

    .dossier-card--reckoning:hover {
      box-shadow:
        0 4px 28px rgba(0 0 0 / 0.5),
        0 0 28px color-mix(in srgb, var(--color-danger) 20%, transparent);
      transform: translateY(-3px);
    }

    /* COMPLETED — faded, archival */
    .dossier-card--completed {
      --dossier-color: var(--color-gray-600);
      --accent-bar-width: 2px;
      opacity: 0;
      animation: dossier-enter 0.4s ease-out forwards;
    }

    .dossier-card--completed .dossier-card__name {
      color: var(--color-gray-400);
    }

    .dossier-card--completed .dossier-stat__value {
      color: var(--color-gray-400);
    }

    /* Phase pulse animations — increasing intensity */
    @keyframes dossier-pulse-soft {
      0%, 100% { box-shadow: 0 0 0 rgba(0 0 0 / 0); }
      50% { box-shadow: 0 0 10px color-mix(in srgb, var(--dossier-color) 12%, transparent); }
    }

    @keyframes dossier-pulse-medium {
      0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--dossier-color) 8%, transparent); }
      50% { box-shadow: 0 0 22px color-mix(in srgb, var(--dossier-color) 20%, transparent); }
    }

    @keyframes dossier-pulse-intense {
      0%, 100% {
        box-shadow: 0 0 16px color-mix(in srgb, var(--dossier-color) 10%, transparent);
        border-color: color-mix(in srgb, var(--color-danger) 25%, var(--color-gray-800));
      }
      50% {
        box-shadow: 0 0 30px color-mix(in srgb, var(--dossier-color) 25%, transparent);
        border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-gray-800));
      }
    }

    /* ── Dossier internals ────────────────── */

    .dossier-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-4) var(--space-4) var(--space-2) calc(var(--space-4) + var(--accent-bar-width));
    }

    .dossier-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      line-height: 1.1;
      color: var(--color-gray-100);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 70%;
    }

    .dossier-card__status {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-0-5) var(--space-2);
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

    /* Pulse on running epochs */
    .dossier-card--foundation .dossier-card__dot,
    .dossier-card--competition .dossier-card__dot,
    .dossier-card--reckoning .dossier-card__dot {
      animation: chip-dot-pulse 2s ease-in-out infinite;
    }

    @keyframes chip-dot-pulse {
      0%, 100% { box-shadow: 0 0 4px var(--dossier-color); opacity: 1; }
      50% { box-shadow: 0 0 10px var(--dossier-color); opacity: 0.6; }
    }

    .dossier-card__status-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--dossier-color);
      font-weight: 600;
    }

    .dossier-card__creator-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--color-epoch-accent, #f59e0b);
      border: 1px solid color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 50%, transparent);
      background: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 8%, transparent);
      flex-shrink: 0;
    }

    /* ── Stats row ────────────────────────── */

    .dossier-card__stats {
      display: flex;
      gap: var(--space-4);
      padding: var(--space-2) var(--space-4) var(--space-3) calc(var(--space-4) + var(--accent-bar-width));
    }

    .dossier-stat {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .dossier-stat__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      color: var(--color-gray-200);
      line-height: 1;
    }

    .dossier-stat__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-gray-400);
    }

    /* ── Segmented progress bar ──────────── */

    .dossier-card__progress {
      padding: 0 var(--space-4) var(--space-3) calc(var(--space-4) + var(--accent-bar-width));
    }

    .dossier-progress {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .dossier-progress__segments {
      flex: 1;
      display: flex;
      gap: 2px;
      height: 4px;
    }

    .dossier-progress__seg {
      flex: 1;
      background: var(--color-gray-800);
      position: relative;
      overflow: hidden;
      transition: background 0.3s;
    }

    .dossier-progress__seg--filled {
      background: var(--dossier-color);
    }

    /* Current cycle segment: pulsing fill */
    .dossier-progress__seg--current {
      background: color-mix(in srgb, var(--dossier-color) 40%, var(--color-gray-800));
      animation: seg-pulse 2s ease-in-out infinite;
    }

    @keyframes seg-pulse {
      0%, 100% { background: color-mix(in srgb, var(--dossier-color) 30%, var(--color-gray-800)); }
      50% { background: color-mix(in srgb, var(--dossier-color) 60%, var(--color-gray-800)); }
    }

    .dossier-progress__text {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-gray-400);
      flex-shrink: 0;
      min-width: 24px;
      text-align: right;
    }

    /* ── Footer / join area ───────────────── */

    .dossier-card__footer {
      margin-top: auto;
      padding: var(--space-2) var(--space-4) var(--space-3) calc(var(--space-4) + var(--accent-bar-width));
      border-top: 1px solid var(--color-gray-800);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .dossier-join-btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-success);
      background: transparent;
      border: 1px solid var(--color-success);
      cursor: pointer;
      transition: all 0.2s;
    }

    .dossier-join-btn:hover {
      background: var(--color-success);
      color: var(--color-gray-950);
    }

    .dossier-join-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .dossier-delete-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      color: var(--color-gray-500);
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .dossier-delete-btn:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }

    .dossier-card__view-hint {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-gray-400);
      margin-left: auto;
      transition: color 0.2s;
    }

    .dossier-card:hover .dossier-card__view-hint {
      color: var(--color-gray-400);
    }

    /* ── Create New card ──────────────────── */

    .dossier-card--create {
      border-style: dashed;
      border-color: var(--color-gray-700);
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 160px;
      transition: border-color 0.2s, background 0.2s;
    }

    .dossier-card--create::before {
      display: none;
    }

    .dossier-card--create:hover {
      border-color: var(--color-gray-400);
      background: rgba(255 255 255 / 0.02);
      transform: none;
      box-shadow: none;
    }

    .dossier-create__inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }

    .dossier-create__plus {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-3xl);
      color: var(--color-gray-500);
      line-height: 1;
      transition: color 0.2s, transform 0.2s;
    }

    .dossier-card--create:hover .dossier-create__plus {
      color: var(--color-gray-300);
      transform: scale(1.1);
    }

    .dossier-create__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gray-400);
      transition: color 0.2s;
    }

    .dossier-card--create:hover .dossier-create__label {
      color: var(--color-gray-400);
    }

    /* ── Atmospheric empty state ─────────── */

    .ops-board__empty {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-10) var(--space-6);
      border: 1px dashed var(--color-gray-700);
      overflow: hidden;
      min-height: 240px;
    }

    /* Radar background on empty state */
    .ops-board__empty::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 180px;
      height: 180px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, var(--color-gray-600) 15%, transparent);
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        color-mix(in srgb, var(--color-primary) 6%, transparent) 40deg,
        transparent 80deg
      );
      animation: radar-sweep 8s linear infinite;
      pointer-events: none;
    }

    /* Concentric radar rings */
    .ops-board__empty::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 180px;
      height: 180px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background:
        radial-gradient(
          circle,
          transparent 29%,
          color-mix(in srgb, var(--color-gray-600) 8%, transparent) 30%,
          transparent 31%,
          transparent 59%,
          color-mix(in srgb, var(--color-gray-600) 8%, transparent) 60%,
          transparent 61%,
          transparent 89%,
          color-mix(in srgb, var(--color-gray-600) 8%, transparent) 90%,
          transparent 91%
        );
      pointer-events: none;
    }

    .ops-board__empty-text {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      color: var(--color-gray-400);
      position: relative;
      z-index: 1;
      animation: empty-pulse 3s ease-in-out infinite;
    }

    @keyframes empty-pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    .ops-board__empty-sub {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-gray-400);
      margin-top: var(--space-2);
      position: relative;
      z-index: 1;
    }

    /* ── No Auth banner in ops board ──────── */

    .ops-board__no-auth {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      text-align: center;
      padding: var(--space-8);
      border: 1px dashed var(--color-gray-800);
    }

    /* ── Past epochs section in ops board ── */

    .ops-board__section-title {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gray-400);
      margin: var(--space-8) 0 var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-gray-800);
    }

    /* ── COMMS Toggle ─────────────────────── */

    .comms-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-gray-400);
      background: transparent;
      border: 1px solid var(--color-gray-700);
      cursor: pointer;
      transition: all 0.25s;
      position: relative;
      overflow: hidden;
    }

    .comms-toggle::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        color-mix(in srgb, var(--color-warning) 3%, transparent) 2px,
        color-mix(in srgb, var(--color-warning) 3%, transparent) 3px
      );
      opacity: 0;
      transition: opacity 0.3s;
    }

    .comms-toggle:hover {
      border-color: var(--color-gray-500);
      color: var(--color-gray-300);
    }

    .comms-toggle--active {
      color: var(--color-warning);
      border-color: var(--color-warning);
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-warning) 20%, transparent), inset 0 0 12px color-mix(in srgb, var(--color-warning) 5%, transparent);
    }

    .comms-toggle--active::before {
      opacity: 1;
    }

    .comms-toggle__icon {
      font-size: 12px;
      transition: transform 0.3s;
    }

    .comms-toggle--active .comms-toggle__icon {
      animation: comms-pulse 2s ease-in-out infinite;
    }

    @keyframes comms-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .comms-toggle__unread {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      border-radius: 7px;
      background: var(--color-warning);
      color: var(--color-gray-950);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0;
    }

    /* ── COMMS Panel (ops board sidebar) ── */

    .ops-board--with-comms {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--space-4);
    }

    .ops-board__main {
      min-width: 0;
    }

    .comms-sidebar {
      position: sticky;
      top: calc(var(--header-height, 56px) + var(--space-4));
      height: calc(100vh - var(--header-height, 56px) - var(--space-8));
      display: flex;
      flex-direction: column;
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-950);
      overflow: hidden;
      animation: comms-open 0.35s ease-out;
      z-index: 2;
    }

    @keyframes comms-open {
      from {
        opacity: 0;
        transform: translateX(20px);
        clip-path: inset(0 0 0 100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
        clip-path: inset(0 0 0 0);
      }
    }

    /* Scanline wash on open */
    .comms-sidebar::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        color-mix(in srgb, var(--color-warning) 1.5%, transparent) 2px,
        color-mix(in srgb, var(--color-warning) 1.5%, transparent) 3px
      );
      pointer-events: none;
      z-index: 1;
    }

    .comms-sidebar__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-3);
      border-bottom: 1px solid var(--color-gray-800);
      background: color-mix(in srgb, var(--color-warning) 3%, transparent);
      flex-shrink: 0;
    }

    .comms-sidebar__signal {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 12px;
    }

    .comms-sidebar__bar {
      width: 3px;
      background: var(--color-warning);
      border-radius: 1px 1px 0 0;
      animation: signal-bar 1.5s ease-in-out infinite;
    }

    .comms-sidebar__bar:nth-child(1) { height: 4px; animation-delay: 0s; }
    .comms-sidebar__bar:nth-child(2) { height: 7px; animation-delay: 0.15s; }
    .comms-sidebar__bar:nth-child(3) { height: 10px; animation-delay: 0.3s; }
    .comms-sidebar__bar:nth-child(4) { height: 12px; animation-delay: 0.45s; }

    @keyframes signal-bar {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .comms-sidebar__freq {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-warning);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .comms-sidebar__close {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid transparent;
      color: var(--color-gray-400);
      cursor: pointer;
      font-size: 10px;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .comms-sidebar__close:hover {
      color: var(--color-gray-300);
      border-color: var(--color-gray-700);
    }

    .comms-sidebar__body {
      flex: 1;
      min-height: 0;
      position: relative;
      z-index: 2;
    }

    .comms-sidebar__body velg-epoch-chat-panel {
      height: 100%;
    }

    /* ── COMMS Empty State ───────────────── */

    .comms-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: var(--space-6);
      text-align: center;
      gap: var(--space-3);
    }

    .comms-empty__icon {
      font-size: 28px;
      opacity: 0.3;
    }

    .comms-empty__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-400);
    }

    .comms-empty__desc {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
      line-height: 1.5;
    }

    /* ── Animations ────────────────────────── */

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

    /* ── Reduced motion ──────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .ops-board::after,
      .ops-board__header::before {
        animation: none;
        display: none;
      }

      .dossier-card,
      .dossier-card--lobby,
      .dossier-card--foundation,
      .dossier-card--competition,
      .dossier-card--reckoning,
      .dossier-card--completed {
        animation: none;
        opacity: 1;
      }

      .dossier-card__dot {
        animation: none;
      }

      .dossier-progress__seg--current {
        animation: none;
        background: color-mix(in srgb, var(--dossier-color) 50%, var(--color-gray-800));
      }

      .ops-board__empty::before {
        animation: none;
        display: none;
      }

      .ops-board__empty-text {
        animation: none;
        opacity: 1;
      }

      .ops-board__header,
      .ops-board__readout,
      .comms-sidebar {
        animation: none;
      }

      .comms-toggle--active .comms-toggle__icon,
      .comms-sidebar__bar {
        animation: none;
      }
    }

    /* ── Widescreen ─────────────────────────── */

    @media (min-width: 2560px) {
      .ops-board { max-width: var(--container-max, 1600px); }
    }

    /* ── Mobile ────────────────────────────── */

    @media (max-width: 768px) {
      .ops-board--with-comms {
        grid-template-columns: 1fr;
      }

      .comms-sidebar {
        position: relative;
        top: auto;
        height: auto;
        max-height: 50vh;
        margin-top: var(--space-4);
      }
    }

    @media (max-width: 640px) {
      .ops-board {
        padding: var(--space-4) var(--space-3);
      }

      .ops-board__header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
      }

      .ops-board__readout {
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .dossier-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  // ── Properties from parent ──────────────────────

  @property({ type: Array }) activeEpochs: Epoch[] = [];
  @property({ type: Array }) pastEpochs: Epoch[] = [];
  @property({ type: Object }) participantCounts: Record<string, number> = {};
  @property({ type: Object }) commsEpoch: Epoch | null = null;
  @property({ type: Object }) commsParticipant: EpochParticipant | null = null;
  @property({ type: Array }) allTemplateSimulations: Simulation[] = [];

  // ── Local state ─────────────────────────────────

  @state() private _showComms = false;
  @state() private _actionLoading = false;

  // ── Render ──────────────────────────────────────

  protected render() {
    const mySims = this.allTemplateSimulations;
    const isAuth = appState.isAuthenticated.value;
    const unreadTotal =
      realtimeService.unreadEpochCount.value + realtimeService.unreadTeamCount.value;

    const totalParticipants = Object.values(this.participantCounts).reduce((sum, c) => sum + c, 0);

    return html`
      <div class="ops-board ${this._showComms ? 'ops-board--with-comms' : ''}">
        <div class="ops-board__glow"></div>
        <div class="ops-board__main">
          <div class="ops-board__header">
            <div class="ops-board__bracket-br"></div>
            <div class="ops-board__title-block">
              <span class="ops-board__surtitle">${msg('Competitive Layer')}</span>
              <h1 class="ops-board__title">${msg('Epoch Command Center')}</h1>
            </div>
            <div style="display: flex; gap: var(--space-2); align-items: center; position: relative; z-index: 1;">
              ${
                isAuth
                  ? html`
                  <button
                    class="comms-toggle ${this._showComms ? 'comms-toggle--active' : ''}"
                    @click=${this._toggleComms}
                    aria-label=${this._showComms ? msg('Close Comms') : msg('Open Comms')}
                    aria-expanded=${this._showComms}
                  >
                    <span class="comms-toggle__icon">${icons.antenna(16)}</span>
                    ${msg('Comms')}
                    ${!this._showComms && unreadTotal > 0 ? html`<span class="comms-toggle__unread">${unreadTotal}</span>` : nothing}
                  </button>
                  <button class="ops-board__create-btn" @click=${this._onCreateEpoch}>
                    + ${msg('Create New Epoch')}
                  </button>
                `
                  : nothing
              }
            </div>
          </div>

          ${this._renderReadout(totalParticipants)}

          ${
            this.activeEpochs.length > 0
              ? html`
              <div class="dossier-grid">
                ${this.activeEpochs.map((e) => this._renderDossierCard(e, mySims))}
                ${
                  isAuth
                    ? html`
                  <div
                    class="dossier-card dossier-card--create"
                    role="button"
                    tabindex="0"
                    @click=${this._onCreateEpoch}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._onCreateEpoch();
                      }
                    }}
                  >
                    <div class="dossier-create__inner">
                      <span class="dossier-create__plus">+</span>
                      <span class="dossier-create__label">${msg('New Epoch')}</span>
                    </div>
                  </div>
                `
                    : nothing
                }
              </div>
            `
              : this._renderEmptyState(isAuth)
          }

          ${
            this.pastEpochs.length > 0
              ? html`
              <div class="ops-board__section-title">${msg('Completed Operations')}</div>
              <div class="dossier-grid">
                ${this.pastEpochs.map((epoch) => this._renderDossierCard(epoch, mySims))}
              </div>
            `
              : nothing
          }
        </div>

        ${this._showComms ? this._renderCommsPanel() : nothing}
      </div>
    `;
  }

  // ── Data Readout Strip ────────────────────────────

  private _renderReadout(totalParticipants: number) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return html`
      <div class="ops-board__readout">
        <span class="ops-board__readout-item">
          ${dateStr} ${timeStr}
        </span>
        <span class="ops-board__readout-sep">&bull;</span>
        <span class="ops-board__readout-item">
          ${msg('Active Ops')}:
          <span class="ops-board__readout-value">${this.activeEpochs.length}</span>
        </span>
        <span class="ops-board__readout-sep">&bull;</span>
        <span class="ops-board__readout-item">
          ${msg('Deployed')}:
          <span class="ops-board__readout-value">${totalParticipants}</span>
        </span>
        <span class="ops-board__readout-sep">&bull;</span>
        <span class="ops-board__readout-item">
          ${msg('Archived')}:
          <span class="ops-board__readout-value">${this.pastEpochs.length}</span>
        </span>
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────

  private _renderEmptyState(isAuth: boolean) {
    return html`
      <div class="dossier-grid">
        ${
          isAuth
            ? html`
            <div class="ops-board__empty">
              <span class="ops-board__empty-text">${msg('No Active Operations')}</span>
              <span class="ops-board__empty-sub">${msg('Create an epoch to begin')}</span>
            </div>
            <div
              class="dossier-card dossier-card--create"
              @click=${this._onCreateEpoch}
            >
              <div class="dossier-create__inner">
                <span class="dossier-create__plus">+</span>
                <span class="dossier-create__label">${msg('Create First Epoch')}</span>
              </div>
            </div>
          `
            : html`
            <div class="ops-board__empty">
              <span class="ops-board__empty-text">${msg('No Active Operations')}</span>
              <span class="ops-board__empty-sub">${msg('Sign in to create or join an epoch.')}</span>
            </div>
          `
        }
      </div>
    `;
  }

  // ── Comms Toggle ────────────────────────────────

  private _toggleComms() {
    this._showComms = !this._showComms;
    this.dispatchEvent(
      new CustomEvent('toggle-comms', {
        detail: { open: this._showComms },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Comms Panel ─────────────────────────────────

  private _renderCommsPanel() {
    if (!this.commsEpoch || !this.commsParticipant) {
      return html`
        <div class="comms-sidebar">
          <div class="comms-sidebar__header">
            <span class="comms-sidebar__freq">${msg('Comms')}</span>
            <button
              class="comms-sidebar__close"
              @click=${this._toggleComms}
              aria-label=${msg('Close Comms')}
            >&times;</button>
          </div>
          <div class="comms-sidebar__body">
            <div class="comms-empty">
              <div class="comms-empty__icon">${icons.antenna(16)}</div>
              <div class="comms-empty__title">${msg('No Active Channel')}</div>
              <div class="comms-empty__desc">${msg('Join an epoch to access comms')}</div>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="comms-sidebar">
        <div class="comms-sidebar__header">
          <div class="comms-sidebar__signal">
            <div class="comms-sidebar__bar"></div>
            <div class="comms-sidebar__bar"></div>
            <div class="comms-sidebar__bar"></div>
            <div class="comms-sidebar__bar"></div>
          </div>
          <span class="comms-sidebar__freq">${this.commsEpoch.name}</span>
          <button
            class="comms-sidebar__close"
            @click=${this._toggleComms}
            aria-label=${msg('Close Comms')}
          >&times;</button>
        </div>
        <div class="comms-sidebar__body">
          <velg-epoch-chat-panel
            .epochId=${this.commsEpoch.id}
            .mySimulationId=${this.commsParticipant.simulation_id}
            .myTeamId=${this.commsParticipant.team_id ?? ''}
            .epochStatus=${this.commsEpoch.status}
          ></velg-epoch-chat-panel>
        </div>
      </div>
    `;
  }

  // ── Dossier Card ────────────────────────────────

  private _renderDossierCard(epoch: Epoch, mySims: Simulation[]) {
    const totalCycles = epoch.config ? computeTotalCycles(epoch.config) : 0;
    const progress = totalCycles > 0 ? epoch.current_cycle / totalCycles : 0;
    const pCount = this.participantCounts[epoch.id] ?? 0;
    const isCompleted = epoch.status === 'completed';
    const isLobby = epoch.status === 'lobby';
    const isCreator = epoch.created_by_id === appState.user.value?.id;

    // In lobby phase, show join buttons for all user's template sims
    // (exact participation check happens server-side on join)
    const joinable = isLobby ? mySims : [];

    return html`
      <div
        class="dossier-card dossier-card--${epoch.status}"
        role="button"
        tabindex="0"
        @click=${() => this._onSelectEpoch(epoch)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._onSelectEpoch(epoch);
          }
        }}
      >
        <div class="dossier-card__header">
          <span class="dossier-card__name">${epoch.name}</span>
          <div style="display:flex; align-items:center; gap:var(--space-1-5); flex-shrink:0">
            ${isCreator ? html`<span class="dossier-card__creator-badge">${msg('Creator')}</span>` : nothing}
            <div class="dossier-card__status">
              <span class="dossier-card__dot"></span>
              <span class="dossier-card__status-label">${epoch.status}</span>
            </div>
          </div>
        </div>

        <div class="dossier-card__stats">
          <div class="dossier-stat">
            <span class="dossier-stat__value">${pCount}</span>
            <span class="dossier-stat__label">${msg('Players')}</span>
          </div>
          <div class="dossier-stat">
            <span class="dossier-stat__value">${epoch.current_cycle}/${totalCycles}</span>
            <span class="dossier-stat__label">${msg('Cycles')}</span>
          </div>
          <div class="dossier-stat">
            <span class="dossier-stat__value">${epoch.config?.cycle_hours ?? '?'}h</span>
            <span class="dossier-stat__label">${msg('Interval')}</span>
          </div>
          ${
            epoch.config
              ? html`
              <div class="dossier-stat">
                <span class="dossier-stat__value">${epoch.config.duration_days}d</span>
                <span class="dossier-stat__label">${msg('Duration')}</span>
              </div>
            `
              : nothing
          }
        </div>

        ${
          !isCompleted && totalCycles > 0
            ? this._renderSegmentedProgress(epoch.current_cycle, totalCycles, progress)
            : nothing
        }

        <div class="dossier-card__footer">
          ${
            isLobby && appState.isAuthenticated.value && joinable.length > 0
              ? joinable.map(
                  (sim) => html`
                  <button
                    class="dossier-join-btn"
                    ?disabled=${this._actionLoading}
                    @click=${(ev: Event) => {
                      ev.stopPropagation();
                      this._onJoinEpoch(epoch.id, sim.id);
                    }}
                  >+ ${msg(str`Join as ${sim.name}`)}</button>
                `,
                )
              : nothing
          }
          ${
            isCreator && ['lobby', 'cancelled'].includes(epoch.status)
              ? html`
                <button
                  class="dossier-delete-btn"
                  aria-label=${msg(str`Delete ${epoch.name}`)}
                  @click=${(ev: Event) => {
                    ev.stopPropagation();
                    this._onDeleteEpoch(epoch);
                  }}
                >${icons.trash(14)}</button>
              `
              : nothing
          }
          <span class="dossier-card__view-hint">${isCompleted ? msg('View Results') : msg('View Details')} &rarr;</span>
        </div>
      </div>
    `;
  }

  // ── Segmented Progress Bar ────────────────────────

  private _renderSegmentedProgress(currentCycle: number, totalCycles: number, progress: number) {
    // Cap segments at 20 to keep it visually clean
    const displaySegments = Math.min(totalCycles, 20);
    const segmentRatio = totalCycles / displaySegments;

    const segments = [];
    for (let i = 0; i < displaySegments; i++) {
      const segCycleEnd = (i + 1) * segmentRatio;
      const segCycleStart = i * segmentRatio;
      let segClass = 'dossier-progress__seg';
      if (currentCycle >= segCycleEnd) {
        segClass += ' dossier-progress__seg--filled';
      } else if (currentCycle > segCycleStart) {
        segClass += ' dossier-progress__seg--current';
      }
      segments.push(html`<div class=${segClass}></div>`);
    }

    return html`
      <div class="dossier-card__progress">
        <div class="dossier-progress">
          <div class="dossier-progress__segments">
            ${segments}
          </div>
          <span class="dossier-progress__text">${Math.round(progress * 100)}%</span>
        </div>
      </div>
    `;
  }

  // ── Event Dispatchers ───────────────────────────

  private _onSelectEpoch(epoch: Epoch) {
    this.dispatchEvent(
      new CustomEvent('select-epoch', {
        detail: { epoch },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onJoinEpoch(epochId: string, simulationId: string) {
    this.dispatchEvent(
      new CustomEvent('join-epoch', {
        detail: { epochId, simulationId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCreateEpoch() {
    this.dispatchEvent(
      new CustomEvent('create-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onDeleteEpoch(epoch: Epoch) {
    this.dispatchEvent(
      new CustomEvent('delete-epoch', {
        detail: { epochId: epoch.id, epochName: epoch.name },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-ops-board': VelgEpochOpsBoard;
  }
}
