import { css } from 'lit';

/**
 * Shared heartbeat component styles — badge, panel, chip, animation patterns
 * used across SimulationPulse, BureauResponsePanel, AttunementSettings,
 * AnchorDashboard, and DesperateActionsPanel.
 *
 * Usage: static styles = [heartbeatBadgeStyles, heartbeatAnimationStyles, css`...`];
 */

// ── Badge / Status Pill ──────────────────────────────────────────

export const heartbeatBadgeStyles = css`
  .hb-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 9px;
    font-weight: 700;
    font-family: var(--font-brutalist, var(--font-mono));
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 1px 6px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .hb-badge--active {
    color: var(--color-warning);
    border-color: var(--color-warning);
  }

  .hb-badge--escalating,
  .hb-badge--climax {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .hb-badge--resolving {
    color: var(--color-info);
    border-color: var(--color-info);
  }

  .hb-badge--resolved {
    color: var(--color-success);
    border-color: var(--color-success);
  }

  .hb-badge--pending {
    color: var(--color-warning);
    border-color: var(--color-warning);
  }

  .hb-badge--failed {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .hb-badge--forming {
    color: var(--color-text-muted);
    border-color: var(--color-text-muted);
    animation: hb-badge-pulse 2s ease-in-out infinite;
  }
`;

// ── Panel Border / Corner ────────────────────────────────────────

export const heartbeatPanelStyles = css`
  .hb-panel {
    border: var(--border-width-thin) solid var(--color-border);
    background: var(--color-surface);
    padding: var(--space-4);
    position: relative;
    transition: border-color var(--duration-fast) var(--ease-default);
  }

  .hb-panel::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    height: 2px;
    background: var(--color-primary);
    opacity: 0.6;
  }

  .hb-panel--danger::before {
    background: var(--color-danger);
  }

  .hb-panel--positive::before {
    background: var(--color-success);
  }
`;

// ── Filter Chip / Tab ────────────────────────────────────────────

export const heartbeatChipStyles = css`
  .hb-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    font-family: var(--font-brutalist, var(--font-mono));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    position: relative;
    transition:
      color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .hb-chip:hover,
  .hb-chip:focus-visible {
    color: var(--color-text-primary);
    border-color: var(--color-primary);
    outline: none;
  }

  .hb-chip:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .hb-chip::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition:
      width var(--duration-fast) var(--ease-default),
      left var(--duration-fast) var(--ease-default);
  }

  .hb-chip[aria-selected='true'],
  .hb-chip--active {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .hb-chip[aria-selected='true']::after,
  .hb-chip--active::after {
    width: 80%;
    left: 10%;
  }
`;

// ── Animations ───────────────────────────────────────────────────

export const heartbeatAnimationStyles = css`
  @keyframes hb-badge-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes hb-pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
    50% {
      box-shadow: 0 0 8px 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }
  }

  @keyframes hb-shimmer {
    0% {
      background-position: -200% center;
    }
    100% {
      background-position: 200% center;
    }
  }

  @keyframes hb-fade-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hb-badge--forming {
      animation: none;
    }
  }
`;
