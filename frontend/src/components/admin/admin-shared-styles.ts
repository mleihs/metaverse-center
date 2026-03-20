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

/* ─── Toggle Switch ───────────────────────────────────────────────── */

export const adminToggleStyles = css`
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .toggle__input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle__track {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    background: var(--color-border);
    cursor: pointer;
    transition:
      background 0.25s ease,
      box-shadow 0.25s ease;
  }

  .toggle__input:checked + .toggle__track {
    background: var(--_toggle-active, var(--color-success));
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--_toggle-active, var(--color-success)) 30%, transparent);
  }

  .toggle__track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-text-primary);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle__input:checked + .toggle__track::after {
    transform: translateX(20px);
  }

  .toggle--disabled .toggle__track {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .toggle__input:focus-visible + .toggle__track {
    outline: 2px solid var(--_toggle-active, var(--color-success));
    outline-offset: 2px;
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
