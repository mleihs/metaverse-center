import { css } from 'lit';

export const caseFileStyles = css`
  :host {
    display: block;
  }

  .case-file {
    border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
    background: color-mix(in srgb, var(--color-surface-sunken) 70%, transparent);
    position: relative;
    overflow: hidden;
  }

  /* Subtle scanline */
  .case-file::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(245, 158, 11, 0.015) 2px,
      rgba(245, 158, 11, 0.015) 4px
    );
    pointer-events: none;
  }

  /* ── Header ── */
  .case-file__header {
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid color-mix(in srgb, var(--color-accent-amber) 25%, transparent);
    background: color-mix(in srgb, var(--color-surface) 30%, transparent);
  }

  .case-file__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--color-accent-amber);
    margin: 0;
  }

  .case-file__subtitle {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-top: var(--space-1);
  }

  /* ── Tab Bar ── */
  .case-file__tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .case-file__tab {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    min-height: 44px;
  }

  .case-file__tab:hover {
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-accent-amber) 5%, transparent);
  }

  .case-file__tab--active {
    color: var(--color-accent-amber);
    border-bottom-color: var(--color-accent-amber);
    background: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
  }

  .case-file__tab:focus-visible {
    outline: 2px solid var(--color-accent-amber);
    outline-offset: -2px;
  }

  /* ── Layout ── */
  .case-file__body {
    display: flex;
    min-height: 400px;
  }

  /* ── TOC Sidebar (desktop) ── */
  .case-file__toc {
    flex-shrink: 0;
    width: 200px;
    border-right: 1px solid var(--color-border);
    padding: var(--space-3);
    display: none;
  }

  @media (min-width: 768px) {
    .case-file__toc {
      display: block;
    }
  }

  /* ── Content Panel ── */
  .case-file__panel {
    flex: 1;
    padding: var(--space-5);
    min-width: 0;
    position: relative;
  }

  .panel__arcanum-label {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-accent-amber);
    opacity: 0.6;
    margin: 0 0 var(--space-1);
  }

  .panel__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: var(--text-lg);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3);
  }

  .panel__epigraph {
    font-style: italic;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    border-left: 2px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
    padding-left: var(--space-3);
    margin: 0 0 var(--space-4);
    line-height: 1.6;
  }

  .panel__body {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.8;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .panel__body p {
    margin: 0 0 var(--space-3);
  }

  /* ── View Toggle ── */
  .view-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold, 700);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-accent-amber);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 36px;
  }

  .view-toggle:hover {
    background: color-mix(in srgb, var(--color-accent-amber) 10%, transparent);
    border-color: var(--color-accent-amber);
  }

  .view-toggle:focus-visible {
    outline: 2px solid var(--color-accent-amber);
    outline-offset: 2px;
  }

  /* ── Evidence Tags (inline) ── */
  .evidence-tag {
    display: inline;
    padding: 0 3px;
    font-size: inherit;
    font-weight: 600;
    border-bottom: 1px dashed;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .evidence-tag:hover {
    opacity: 0.8;
  }

  .evidence-tag--agent {
    color: var(--color-info);
    border-color: var(--color-info);
  }

  .evidence-tag--building {
    color: var(--color-accent-amber);
    border-color: var(--color-accent-amber);
  }

  .evidence-tag--zone {
    color: var(--color-success);
    border-color: var(--color-success);
  }

  /* ── Updated Badge ── */
  .updated-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px var(--space-1);
    font-family: var(--font-mono, monospace);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-success);
    border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    vertical-align: middle;
    margin-left: var(--space-1);
  }

  @media (max-width: 480px) {
    .case-file__header {
      padding: var(--space-3);
    }

    .case-file__panel {
      padding: var(--space-3);
    }

    .case-file__tab {
      padding: var(--space-2) var(--space-3);
      font-size: 10px;
    }
  }
`;
