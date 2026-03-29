import { css } from 'lit';

/**
 * Universal button system for the brutalist dark-theme design system.
 *
 * Consolidates the button patterns from panel-button-styles, form-styles,
 * and 130+ component-local duplicates into a single authoritative source.
 *
 * Classes:
 *   .btn             — base: brutalist typography, hard-edge shadow, offset hover
 *   .btn--primary    — amber fill (primary actions: save, confirm, create)
 *   .btn--secondary  — raised surface (cancel, dismiss, back)
 *   .btn--danger     — red fill (delete, remove, destructive)
 *   .btn--info       — blue tint (generate, view, navigate)
 *   .btn--success    — green tint (approve, complete)
 *   .btn--warning    — amber tint (caution, proceed-with-care)
 *   .btn--ghost      — transparent, no shadow (inline/toolbar actions)
 *   .btn--sm         — compact (toolbar, inline)
 *   .btn--lg         — prominent (hero CTA, onboarding)
 *
 * Usage:
 *   static styles = [buttonStyles, css`...`];
 *
 *   <button class="btn btn--primary">${msg('Save')}</button>
 *   <button class="btn btn--danger btn--sm">${msg('Delete')}</button>
 */
export const buttonStyles = css`
  /* ── Base ─────────────────────────────────────────────── */

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    line-height: var(--leading-tight);
    border: var(--border-default);
    box-shadow: var(--shadow-md);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
    text-decoration: none;
  }

  .btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
  }

  .btn:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: var(--ring-focus), var(--shadow-md);
  }

  .btn:focus-visible:hover {
    box-shadow: var(--ring-focus), var(--shadow-lg);
  }

  .btn:disabled,
  .btn[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    transform: none;
    box-shadow: var(--shadow-sm);
  }

  /* ── Semantic Variants ───────────────────────────────── */

  .btn--primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
  }

  .btn--primary:hover {
    background: var(--color-primary-hover);
  }

  .btn--primary:active {
    background: var(--color-primary-active);
  }

  .btn--secondary {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  .btn--danger {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    border-color: var(--color-danger);
  }

  .btn--danger:hover {
    background: var(--color-danger-hover);
  }

  .btn--danger:focus-visible {
    box-shadow: var(--ring-danger), var(--shadow-md);
  }

  .btn--info {
    background: var(--color-info-bg);
    color: var(--color-info);
    border-color: var(--color-info);
  }

  .btn--info:hover {
    background: var(--color-info);
    color: var(--color-surface);
  }

  .btn--success {
    background: var(--color-success-bg);
    color: var(--color-success);
    border-color: var(--color-success);
  }

  .btn--success:hover {
    background: var(--color-success);
    color: var(--color-surface);
  }

  .btn--warning {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border-color: var(--color-warning);
  }

  .btn--warning:hover {
    background: var(--color-warning);
    color: var(--color-surface);
  }

  .btn--ghost {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    color: var(--color-text-secondary);
  }

  .btn--ghost:hover {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    transform: none;
    box-shadow: none;
  }

  .btn--ghost:active {
    background: var(--color-surface-sunken);
    box-shadow: none;
  }

  .btn--ghost:focus-visible {
    box-shadow: var(--ring-focus);
  }

  /* ── Size Variants ───────────────────────────────────── */

  .btn--sm {
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    gap: var(--space-1);
    box-shadow: var(--shadow-sm);
  }

  .btn--sm:hover {
    box-shadow: var(--shadow-md);
  }

  .btn--sm:active {
    box-shadow: var(--shadow-xs);
  }

  .btn--lg {
    padding: var(--space-3) var(--space-6);
    font-size: var(--text-base);
    gap: var(--space-2);
    box-shadow: var(--shadow-lg);
  }

  .btn--lg:hover {
    box-shadow: var(--shadow-xl);
  }

  .btn--lg:active {
    box-shadow: var(--shadow-md);
  }

  /* ── Icon-Only Button ────────────────────────────────── */

  .btn--icon {
    padding: var(--space-2);
  }

  .btn--icon.btn--sm {
    padding: var(--space-1-5);
  }

  .btn--icon.btn--lg {
    padding: var(--space-3);
  }

  /* ── Button Group ────────────────────────────────────── */

  .btn-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-group--end {
    justify-content: flex-end;
  }

  .btn-group--between {
    justify-content: space-between;
  }

  .btn-group--stretch .btn {
    flex: 1;
  }
`;
