/**
 * Shared CSS for the Forge console components.
 * Extracted from duplicated patterns across all forge phases.
 */
import { css } from 'lit';

export const forgeButtonStyles = css`
  .btn {
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold, 700);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide, 0.05em);
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn--next {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text-primary);
  }

  .btn--next:hover:not(:disabled) {
    background: var(--color-surface-raised);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0 0 0 / 0.3);
  }

  .btn--ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }

  .btn--ghost:hover {
    border-color: var(--color-icon);
    color: var(--color-text-secondary);
  }

  .btn--launch {
    background: var(--color-success);
    border-color: var(--color-success);
    color: var(--color-surface-sunken);
    font-weight: 900;
    letter-spacing: 0.15em;
    width: 100%;
    height: 60px;
    font-size: var(--text-lg);
    position: relative;
    overflow: hidden;
  }

  .btn--launch:hover:not(:disabled) {
    box-shadow: 0 0 16px rgba(74 222 128 / 0.4);
    transform: translateY(-1px);
  }

  .btn--launch::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255 255 255 / 0.15), transparent);
    transform: translateX(-100%);
    animation: launch-shimmer 3s ease-in-out infinite;
  }

  .btn--danger {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: var(--color-text-inverse);
    font-weight: 900;
    letter-spacing: 0.15em;
    position: relative;
    overflow: hidden;
  }

  .btn--danger:hover:not(:disabled) {
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-danger) 50%, transparent);
    transform: translateY(-2px);
  }

  .btn--danger::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255 255 255 / 0.15), transparent);
    transform: translateX(-100%);
    animation: launch-shimmer 3s ease-in-out infinite;
  }

  @keyframes launch-shimmer {
    0%, 70% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn--launch::after,
    .btn--danger::after {
      animation: none;
    }
  }
`;

export const forgeFieldStyles = css`
  .field__label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .field__input,
  .field__textarea {
    width: 100%;
    background: var(--color-surface-sunken);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    padding: var(--space-3);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .field__textarea {
    min-height: 100px;
    resize: vertical;
  }

  .field__input:focus,
  .field__textarea:focus {
    outline: 2px solid var(--color-success);
    outline-offset: 1px;
    border-color: var(--color-success);
    box-shadow: 0 0 0 1px rgba(74 222 128 / 0.3);
  }

  .field__input::placeholder,
  .field__textarea::placeholder {
    color: var(--color-text-muted);
  }

  .field__input:disabled,
  .field__textarea:disabled {
    opacity: 0.5;
  }

  select.field__input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: var(--space-8);
    cursor: pointer;
  }

  /* iOS auto-zoom prevention: inputs < 16px trigger viewport zoom */
  @media (max-width: 768px) {
    .field__input,
    .field__textarea {
      font-size: 16px;
    }
  }
`;

export const forgeRangeStyles = css`
  .range-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .range-field__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .range-field__label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .range-field__readout {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: var(--text-base);
    color: var(--color-success);
    min-width: 40px;
    text-align: right;
  }

  .range-field input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    cursor: pointer;
  }

  .range-field input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--color-success);
    border: 2px solid var(--color-surface-sunken);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .range-field input[type='range']::-webkit-slider-thumb:hover {
    transform: scale(1.3);
  }

  .range-field input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--color-success);
    border: 2px solid var(--color-surface-sunken);
    border-radius: 0;
    cursor: pointer;
  }

  /* Toggle checkbox field (e.g., Deep Research) */
  .toggle-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border-light);
    cursor: pointer;
  }

  .toggle-field input[type='checkbox'] {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
  }

  .toggle-field input[type='checkbox']:checked {
    border-color: var(--color-success);
    background: var(--color-success);
  }

  .toggle-field input[type='checkbox']:checked::after {
    content: '\\2713';
    position: absolute;
    top: -2px;
    left: 1px;
    font-size: 12px;
    color: var(--color-surface-sunken);
    font-weight: 900;
  }

  .toggle-field__label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-tertiary);
  }

  .toggle-field__hint {
    width: 100%;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: 1.4;
  }
`;

export const forgeResearchHintStyles = css`
  .research-source-hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    letter-spacing: 0.03em;
    color: var(--color-text-muted);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-light);
    background: var(--color-surface-sunken);
  }

  .research-source-hint--tavily {
    border-color: var(--color-success-glow);
    color: var(--color-icon);
  }

  .research-source-hint__dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    background: var(--color-border);
  }

  .research-source-hint--tavily .research-source-hint__dot {
    background: var(--color-success);
    box-shadow: 0 0 4px rgba(74 222 128 / 0.4);
  }
`;

export const forgeStatusStyles = css`
  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid var(--color-danger);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  .generating-indicator {
    font-family: var(--font-mono, monospace);
    color: var(--color-success);
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    position: relative;
  }

  .generating-indicator::before {
    content: '';
    display: inline-block;
    width: 100%;
    height: 2px;
    background: var(--color-success);
    animation: scan-sweep 1.5s ease-in-out infinite;
    position: absolute;
    left: 0;
  }

  @keyframes scan-sweep {
    0% { transform: translateX(-100%); opacity: 0.5; }
    50% { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0.5; }
  }

  @keyframes blink {
    50% { opacity: 0; }
  }
`;

export const forgeSectionStyles = css`
  .section-title {
    font-family: var(--font-brutalist);
    font-size: var(--text-lg);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    margin: var(--space-12) 0 var(--space-6);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }
`;

export const forgeInfoBubbleStyles = css`
  .info-bubble {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .info-bubble__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 700;
    color: var(--color-icon);
    border: 1px solid var(--color-icon);
    background: transparent;
    cursor: help;
    transition: all 0.15s;
    padding: 0;
    line-height: 1;
  }

  .info-bubble__trigger:hover,
  .info-bubble__trigger:focus {
    color: var(--color-success);
    border-color: var(--color-success);
  }

  .info-bubble__panel {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: 280px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: var(--space-3);
    z-index: var(--z-sticky);
    box-shadow: 0 4px 16px rgba(0 0 0 / 0.5);
  }

  .info-bubble__trigger:hover + .info-bubble__panel,
  .info-bubble__trigger:focus + .info-bubble__panel,
  .info-bubble__panel:hover {
    display: block;
  }

  .info-bubble__text {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-tertiary);
    line-height: 1.5;
    margin: 0 0 var(--space-2);
  }

  .info-bubble__example {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-icon);
    font-style: italic;
    margin: 0;
    padding-top: var(--space-1);
    border-top: 1px solid var(--color-border);
  }
`;

export const forgeBackButtonStyles = css`
  .btn--back {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold, 700);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide, 0.05em);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn--back:hover {
    border-color: var(--color-icon);
    color: var(--color-text-secondary);
  }
`;

export const forgeOverlayStyles = css`
  .forge-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 500);
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-surface);
    overflow-y: auto;
  }

  .forge-overlay__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: var(--z-modal, 500);
  }

  .forge-overlay__close {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-icon);
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: var(--text-lg);
    transition: color 0.2s, border-color 0.2s;
  }

  .forge-overlay__close:hover {
    color: var(--color-text-primary);
    border-color: var(--color-icon);
  }

  .forge-overlay__close:focus-visible {
    outline: 2px solid var(--color-accent-amber);
    outline-offset: 2px;
  }
`;

/** All forge console styles combined for convenience. */
export const forgeConsoleStyles = [
  forgeButtonStyles,
  forgeBackButtonStyles,
  forgeFieldStyles,
  forgeRangeStyles,
  forgeStatusStyles,
  forgeSectionStyles,
  forgeInfoBubbleStyles,
];
