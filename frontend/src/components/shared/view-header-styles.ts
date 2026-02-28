import { css } from 'lit';

/**
 * Shared view header styles for entity list views.
 * Usage: static styles = [viewHeaderStyles, css`...`];
 */
export const viewHeaderStyles = css`
  .view {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .view__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .view__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-2xl);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    margin: 0;
  }

  .view__create-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2-5) var(--space-5);
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border: var(--border-default);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    flex-shrink: 0;
    animation: btn-materialize 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both 200ms;
  }

  @keyframes btn-materialize {
    from {
      opacity: 0;
      transform: translateX(8px);
    }
  }

  .view__create-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
  }

  .view__create-btn:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  .view__count {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-secondary);
  }
`;
