import { css } from 'lit';

/**
 * Shared button styles for detail panels and settings panels.
 * Usage: static styles = [panelButtonStyles, css`...`];
 */
export const panelButtonStyles = css`
  .panel__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    border: var(--border-default);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .panel__btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
  }

  .panel__btn:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  .panel__btn--edit {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .panel__btn--danger {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    border-color: var(--color-danger);
  }

  .panel__btn--danger:hover {
    background: var(--color-danger-hover);
  }

  .panel__btn--generate {
    background: var(--color-info-bg);
    color: var(--color-info);
    border-color: var(--color-info);
  }

  .panel__btn--generate:hover {
    background: var(--color-info);
    color: var(--color-surface);
  }

  .panel__btn--generate:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: var(--shadow-md);
  }
`;
