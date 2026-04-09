import { css } from 'lit';

/**
 * Shared admin panel CSS modules.
 *
 * Each export is a self-contained `CSSResult` so tabs can compose exactly
 * what they need via `static styles = [adminButtonStyles, css\`...\`]`.
 *
 * Accent-color customization uses Tier 3 component-local `--_*` variables
 * that tabs override in their `:host` block:
 *
 *   --_admin-accent          Section marker, btn--save bg  (default: --color-danger)
 *   --_admin-accent-contrast  btn--save text               (default: --color-text-inverse)
 *   --_toggle-active          Toggle checked colour         (default: --color-success)
 */

/* ─── Keyframes & Reduced Motion ──────────────────────────────────── */

export const adminAnimationStyles = css`
  @keyframes panel-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes status-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  @keyframes amber-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
`;

/* ─── Section Headers ─────────────────────────────────────────────── */

export const adminSectionHeaderStyles = css`
  .section-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .section-header__marker {
    width: 3px;
    height: 20px;
    background: var(--_admin-accent, var(--color-danger));
    flex-shrink: 0;
  }

  .section-header__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-primary);
    margin: 0;
  }
`;

/* ─── Global Card with Corner Brackets ────────────────────────────── */

export const adminGlobalCardStyles = css`
  .global-card {
    position: relative;
    padding: var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    margin-bottom: var(--space-4);
    overflow: hidden;
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease;
  }

  .global-card--active {
    border-color: color-mix(
      in srgb,
      var(--_admin-accent, var(--color-danger)) 40%,
      transparent
    );
    box-shadow: inset 0 0 40px -20px
      color-mix(in srgb, var(--_admin-accent, var(--color-danger)) 8%, transparent);
  }

  .global-card--disabled,
  .global-card--suppressed {
    border-color: var(--color-border);
  }

  .global-card__corner {
    position: absolute;
    width: 8px;
    height: 8px;
    border-color: var(--_admin-accent, var(--color-danger));
    border-style: solid;
    opacity: 0.4;
    transition: opacity 0.3s ease;
  }

  .global-card--active .global-card__corner {
    opacity: 0.7;
  }

  .global-card__corner--tl {
    top: 4px;
    left: 4px;
    border-width: 1px 0 0 1px;
  }

  .global-card__corner--tr {
    top: 4px;
    right: 4px;
    border-width: 1px 1px 0 0;
  }

  .global-card__corner--bl {
    bottom: 4px;
    left: 4px;
    border-width: 0 0 1px 1px;
  }

  .global-card__corner--br {
    bottom: 4px;
    right: 4px;
    border-width: 0 1px 1px 0;
  }

  .global-card__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .global-card__info {
    flex: 1;
    min-width: 0;
  }

  .global-card__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-1) 0;
  }

  .global-card__description {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .global-card__status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    font-family: var(--font-brutalist);
    font-size: 10px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    padding: var(--space-1) var(--space-2);
    margin-top: var(--space-2);
  }

  .global-card__status--active {
    color: var(--_admin-accent, var(--color-danger));
    background: color-mix(
      in srgb,
      var(--_admin-accent, var(--color-danger)) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--_admin-accent, var(--color-danger)) 25%, transparent);
  }

  .global-card__status--disabled,
  .global-card__status--suppressed {
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent);
  }

  .global-card__status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .global-card__status--active .global-card__status-dot {
    animation: status-pulse 2s ease-in-out infinite;
  }

  @media (max-width: 768px) {
    .global-card__row {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;

/* ─── Admin Buttons ───────────────────────────────────────────────── */

export const adminButtonStyles = css`
  .btn {
    font-family: var(--font-brutalist);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    padding: var(--space-2) var(--space-5);
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      transform 0.15s ease,
      box-shadow 0.2s ease;
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  .btn:active {
    transform: translateY(0);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .btn--save {
    background: var(--_admin-accent, var(--color-danger));
    color: var(--_admin-accent-contrast, var(--color-text-inverse));
    border: 1px solid var(--_admin-accent, var(--color-danger));
  }

  .btn--save:hover:not(:disabled) {
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--_admin-accent, var(--color-danger)) 30%, transparent);
  }

  .btn--reset,
  .btn--clear {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn--reset:hover:not(:disabled),
  .btn--clear:hover:not(:disabled) {
    color: var(--_admin-accent, var(--color-danger));
    border-color: color-mix(
      in srgb,
      var(--_admin-accent, var(--color-danger)) 50%,
      transparent
    );
  }

  .actions {
    display: flex;
    gap: var(--space-3);
  }
`;

/* ─── Forge / Bureau Section Panel ────────────────────────────────── */

export const adminForgeSectionStyles = css`
  .forge-section {
    position: relative;
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border);
    padding: var(--space-5) var(--space-5) var(--space-5) var(--space-6);
    margin-bottom: var(--space-5);
    animation: panel-enter 0.4s ease both;
  }

  .forge-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: linear-gradient(
      180deg,
      var(--color-accent-amber) 0%,
      var(--color-accent-amber-dim, rgba(245, 158, 11, 0.3)) 100%
    );
  }

  .forge-section__header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-1);
  }

  .forge-section__code {
    font-family: var(--font-mono, 'SF Mono', monospace);
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--color-accent-amber);
    opacity: 0.7;
    white-space: nowrap;
  }

  .forge-section__title {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 900;
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    margin: 0;
  }

  .forge-section__desc {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    padding-left: 1px;
  }

  .forge-section__divider {
    height: 1px;
    background: linear-gradient(
      90deg,
      var(--color-accent-amber-dim, rgba(245, 158, 11, 0.2)) 0%,
      transparent 80%
    );
    margin-bottom: var(--space-4);
  }

  @media (prefers-reduced-motion: reduce) {
    .forge-section {
      animation: none !important;
    }
  }
`;

/* ─── Loading / Empty States ──────────────────────────────────────── */

export const adminLoadingStyles = css`
  .loading {
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-muted);
    font-family: var(--font-brutalist);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .empty {
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
`;

/* ─── Config Card (dirty-state input cards) ───────────────────────── */

export const adminConfigCardStyles = css`
  .config-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .config-card:hover {
    border-color: var(--color-text-muted);
  }

  .config-card--dirty {
    border-color: var(--color-warning);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-warning) 50%, transparent);
  }

  .config-card--dirty-amber {
    border-color: var(--color-accent-amber);
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
  }

  .config-card__label {
    font-family: var(--font-brutalist);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .config-card__description {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0 0 var(--space-3) 0;
  }

  .config-card__input-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
`;

/* ─── Config Grid (auto-fill layout for settings cards) ───────────── */

export const adminConfigGridStyles = css`
  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--space-4);
  }

  .config-grid--narrow {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }

  @media (max-width: 768px) {
    .config-grid {
      grid-template-columns: 1fr;
    }
  }
`;

/* ─── Badges (status indicators) ─────────────────────────────────── */

export const adminBadgeStyles = css`
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 6px;
  }

  .badge--info {
    background: var(--color-info-bg);
    color: var(--color-info);
  }
  .badge--success {
    background: var(--color-success-bg);
    color: var(--color-success);
  }
  .badge--warning {
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    color: var(--color-warning);
  }
  .badge--danger {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
  }
  .badge--muted {
    background: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
    color: var(--color-text-muted);
  }
`;

/* ─── Action Buttons (.act) ──────────────────────────────────────── */

export const adminActionStyles = css`
  .act {
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .act:hover:not(:disabled) {
    border-color: var(--color-text-muted);
  }

  .act:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .act--approve {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  }
  .act--approve:hover:not(:disabled) {
    background: var(--color-success-bg);
    border-color: var(--color-success);
  }

  .act--reject {
    color: var(--color-danger);
    border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  }
  .act--reject:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
    border-color: var(--color-danger);
  }

  .act--publish {
    color: var(--color-success);
  }
  .act--publish:hover:not(:disabled) {
    border-color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
  }

  .act--skip {
    color: var(--color-text-muted);
  }
  .act--skip:hover:not(:disabled) {
    border-color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
  }

  .act--unskip {
    color: var(--color-info);
  }
  .act--unskip:hover:not(:disabled) {
    border-color: var(--color-info);
    background: color-mix(in srgb, var(--color-info) 8%, transparent);
  }

  .act--link {
    color: var(--color-primary);
  }
  .act--link:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
`;

/* ─── Tab Navigation ─────────────────────────────────────────────── */

export const adminTabNavStyles = css`
  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-5);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: var(--space-2) var(--space-4);
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    position: relative;
    transition: color 0.15s ease;
  }

  .tab:hover { color: var(--color-text-primary); }

  .tab--active {
    color: var(--color-primary);
  }

  .tab--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-primary);
  }

  .tab svg {
    color: inherit;
  }

  .tab__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 3px;
    font-size: 9px;
    font-weight: var(--font-black);
    background: var(--color-warning);
    color: var(--color-surface-sunken);
    border-radius: 8px;
  }

  .tab__badge--active {
    background: var(--color-success-bg);
    color: var(--color-success);
    font-size: 7px;
    letter-spacing: 0.05em;
  }
`;

/* ─── Status Filter Bar ──────────────────────────────────────────── */

export const adminStatusFilterStyles = css`
  .status-bar {
    display: flex;
    gap: var(--space-1);
    align-items: center;
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }

  .status-tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-brutalist);
    font-size: 9px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--space-1) var(--space-3);
    border: 1px solid transparent;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .status-tab:hover {
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  }

  .status-tab--active {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  .status-tab__count {
    font-family: var(--font-mono);
    font-size: 8px;
    opacity: 0.6;
  }

  .queue-total {
    margin-left: auto;
    font-size: 9px;
    color: var(--color-text-muted);
  }
`;

/* ─── Connection Status Card ─────────────────────────────────────── */

export const adminConnectionCardStyles = css`
  .connection-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  }

  .connection-card__indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .connection-card__indicator--ok {
    background: var(--color-success);
    box-shadow: 0 0 6px var(--color-success);
  }

  .connection-card__indicator--error {
    background: var(--color-danger);
    box-shadow: 0 0 6px var(--color-danger);
  }

  .connection-card__indicator--unconfigured {
    background: var(--color-text-muted);
  }

  .connection-card__info { flex: 1; }

  .connection-card__handle {
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
  }

  .connection-card__detail,
  .connection-card__pds {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .connection-card__status {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .connection-card__status--ok { color: var(--color-success); }
  .connection-card__status--error { color: var(--color-danger); }
  .connection-card__status--unconfigured { color: var(--color-text-muted); }

  .btn-test {
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: var(--space-1-5) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-test:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/* ─── Dispatch Queue Cards ───────────────────────────────────────── */

export const adminDispatchStyles = css`
  .dispatch-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .dispatch {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-border);
    transition: border-color 0.2s ease;
  }

  .dispatch--draft { border-left-color: var(--color-info); }
  .dispatch--scheduled { border-left-color: var(--color-warning); }
  .dispatch--publishing { border-left-color: var(--color-warning); }
  .dispatch--published { border-left-color: var(--color-success); }
  .dispatch--failed { border-left-color: var(--color-danger); }
  .dispatch--rejected { border-left-color: var(--color-danger); }
  .dispatch--pending { border-left-color: var(--color-info); }
  .dispatch--skipped { border-left-color: var(--color-text-muted); }

  .dispatch__thumb {
    width: 64px;
    height: 80px;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
  }

  .dispatch__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .dispatch__thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: var(--color-text-muted);
  }

  .dispatch__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .dispatch__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .dispatch__type-tag {
    font-family: var(--font-brutalist);
    font-size: 8px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 1px var(--space-2);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }

  .dispatch__shard {
    font-size: 9px;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .dispatch__timestamp {
    font-size: 9px;
    color: var(--color-text-muted);
    margin-left: auto;
  }

  .dispatch__caption {
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }

  .dispatch__tags {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .dispatch__tag {
    font-size: 9px;
    color: var(--color-text-muted);
  }

  .dispatch__metrics {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin-top: var(--space-1);
  }

  .metric {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .metric--accent {
    color: var(--color-primary);
  }

  .dispatch__failure {
    font-size: 10px;
    color: var(--color-danger);
    margin-top: var(--space-1);
  }

  .dispatch__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-self: center;
    flex-shrink: 0;
  }
`;

/* ─── Intel / Metric Card Grid ───────────────────────────────────── */
/* REMOVED: adminMetricCardStyles — migrated to <velg-metric-card> shared component.
   See frontend/src/components/shared/VelgMetricCard.ts */

/* ─── Sub-Navigation (Segmented Control) ────────────────────────────── */

/**
 * Shared segmented-control sub-navigation for admin wrapper tabs
 * (AdminPlatformConfigTab, AdminSocialTab, etc.).
 *
 * Usage:
 *   <div class="subnav" role="tablist" aria-label=${msg('...')}>
 *     <button class="subnav__btn ${active ? 'subnav__btn--active' : ''}" role="tab" ...>
 *   </div>
 *   <div class="subnav__content">...</div>
 */
export const adminSubNavStyles = css`
  .subnav {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin-bottom: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-surface-sunken);
  }

  .subnav__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
  }

  .subnav__btn + .subnav__btn {
    border-left: 1px solid var(--color-border);
  }

  .subnav__btn:hover:not(.subnav__btn--active) {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-surface) 50%, transparent);
  }

  .subnav__btn--active {
    color: var(--color-primary);
    background: var(--color-surface);
    box-shadow: inset 0 -2px 0 var(--color-primary);
  }

  .subnav__btn svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .subnav__content {
    animation: subnav-fade 250ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
  }

  @keyframes subnav-fade {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
