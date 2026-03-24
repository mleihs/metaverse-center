import { css } from 'lit';

/**
 * Shared CSS for settings panels.
 * Usage: `static styles = [settingsStyles, css\`...\`]`
 */
export const settingsStyles = css`
  :host {
    display: block;
  }

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .settings-panel--wide {
    gap: var(--space-6);
  }

  /* --- Form Elements --- */

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .settings-form__group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .settings-form__group--row {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }

  .settings-form__group--full {
    grid-column: 1 / -1;
  }

  .settings-form__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
  }

  .settings-form__label--xs {
    font-size: var(--text-xs);
  }

  .settings-form__hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-family: var(--font-body);
    text-transform: none;
    letter-spacing: normal;
  }

  .settings-form__input,
  .settings-form__textarea,
  .settings-form__select {
    font-family: var(--font-body);
    font-size: var(--text-base);
    padding: var(--space-2-5) var(--space-3);
    border: var(--border-medium);
    background: var(--color-surface);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    width: 100%;
    box-sizing: border-box;
  }

  .settings-form__input--sm,
  .settings-form__textarea--sm,
  .settings-form__select--sm {
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
  }

  .settings-form__input:focus,
  .settings-form__textarea:focus,
  .settings-form__select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: var(--ring-focus);
  }

  .settings-form__input::placeholder,
  .settings-form__textarea::placeholder {
    color: var(--color-text-muted);
  }

  .settings-form__input--readonly {
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .settings-form__input--masked {
    font-family: monospace;
    letter-spacing: 2px;
  }

  .settings-form__textarea {
    min-height: 120px;
    resize: vertical;
  }

  .settings-form__textarea--mono {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    line-height: 1.5;
    min-height: 80px;
  }

  .settings-form__select {
    cursor: pointer;
  }

  /* --- Grid Layout --- */

  .settings-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .settings-form-grid--narrow {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  /* --- Section --- */

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .settings-section__subtitle {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-base);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .settings-section__help {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  /* --- Footer --- */

  .settings-panel__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: var(--border-default);
  }

  /* --- Error --- */

  .settings-panel__error {
    padding: var(--space-3);
    background: var(--color-danger-bg);
    border: var(--border-width-default) solid var(--color-danger);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    color: var(--color-danger);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  /* --- Buttons --- */

  .settings-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .settings-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
  }

  .settings-btn:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  .settings-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .settings-btn--primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .settings-btn--secondary {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  .settings-btn--danger {
    background: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .settings-btn--sm {
    padding: var(--space-1-5) var(--space-3);
    font-size: var(--text-xs);
    box-shadow: var(--shadow-sm);
  }

  .settings-btn--sm:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-md);
  }

  /* Toggle switch: use <velg-toggle> shared component instead. */

  /* --- Sensitive hint --- */

  .settings-sensitive-hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-family: var(--font-body);
  }

  /* --- Mobile Responsive --- */

  @media (max-width: 640px) {
    .settings-panel {
      padding: var(--space-3);
      gap: var(--space-3);
    }

    .settings-form-grid {
      grid-template-columns: 1fr;
    }

    .settings-section__subtitle {
      font-size: var(--text-sm);
    }

    .settings-form__label {
      font-size: var(--text-xs);
    }

    .settings-form__input,
    .settings-form__textarea,
    .settings-form__select {
      font-size: var(--text-sm);
    }

    .settings-panel__footer {
      flex-direction: column;
      align-items: stretch;
    }

    .settings-btn {
      min-height: 44px;
      min-width: 44px;
    }

  }
`;
