import { css } from 'lit';

/**
 * Shared form + footer styles for modal dialogs.
 * Usage: static styles = [formStyles, css`...`];
 */
export const formStyles = css`
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form__group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .form__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
  }

  .form__required {
    color: var(--color-danger);
  }

  .form__input,
  .form__textarea,
  .form__select {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    padding: var(--space-2-5) var(--space-3);
    border: var(--border-medium);
    background: var(--color-surface);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    width: 100%;
    box-sizing: border-box;
  }

  .form__input:focus,
  .form__textarea:focus,
  .form__select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: var(--ring-focus);
  }

  .form__input::placeholder,
  .form__textarea::placeholder {
    color: var(--color-text-muted);
  }

  .form__textarea {
    min-height: 100px;
    resize: vertical;
  }

  .form__select {
    cursor: pointer;
  }

  .form__error {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    color: var(--color-text-danger);
  }

  .form__input--error,
  .form__textarea--error,
  .form__select--error {
    border-color: var(--color-border-danger);
  }

  .form__api-error {
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

  .gen-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5) var(--space-3);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    border: var(--border-width-default) solid var(--color-border);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .gen-btn:hover {
    background: var(--color-primary-bg);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .gen-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .gen-btn--primary {
    background: var(--color-info-bg);
    border-color: var(--color-info);
    color: var(--color-info);
  }

  .gen-btn--primary:hover {
    background: var(--color-info);
    color: var(--color-surface);
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .footer__btn {
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

  .footer__btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
  }

  .footer__btn:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  .footer__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .footer__btn--cancel {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  .footer__btn--save {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  /* === Mobile: stack form rows === */
  @media (max-width: 640px) {
    .form__row {
      grid-template-columns: 1fr;
    }
  }
`;
