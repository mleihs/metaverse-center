import { css } from 'lit';

export const dossierRevealStyles = css`
  :host {
    display: contents;
  }

  .reveal {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-modal, 1000) + 10);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* ── Backdrop ── */
  .reveal__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0);
    animation: backdrop-fade 400ms ease-out forwards;
  }

  @keyframes backdrop-fade {
    to { background: rgba(0, 0, 0, 0.95); }
  }

  /* Scanline overlay on backdrop */
  .reveal__backdrop::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      color-mix(in srgb, var(--color-primary) 1.5%, transparent) 2px,
      color-mix(in srgb, var(--color-primary) 1.5%, transparent) 4px
    );
    pointer-events: none;
    animation: scanline-drift 30s linear infinite;
  }

  @keyframes scanline-drift {
    from { background-position: 0 0; }
    to { background-position: 0 100vh; }
  }

  /* ── Content Container ── */
  .reveal__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    max-width: 560px;
    width: 90vw;
    padding: var(--space-6);
  }

  /* ── Phase 1: Bureau Stamp ── */
  .stamp {
    opacity: 0;
    animation: stamp-drop 600ms cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
    text-align: center;
  }

  @keyframes stamp-drop {
    0% {
      opacity: 0;
      transform: scale(3) rotate(-12deg);
    }
    60% {
      opacity: 1;
      transform: scale(0.95) rotate(1deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(0);
    }
  }

  .stamp__flash {
    position: fixed;
    inset: 0;
    background: var(--color-surface-inverse);
    opacity: 0;
    pointer-events: none;
    animation: stamp-flash 150ms ease-out forwards;
    animation-delay: 300ms;
  }

  @keyframes stamp-flash {
    0% { opacity: 0; }
    30% { opacity: 0.12; }
    100% { opacity: 0; }
  }

  .stamp__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: var(--text-lg);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--color-accent-amber);
    margin: 0;
    padding: var(--space-3) var(--space-5);
    border: 3px solid var(--color-accent-amber);
  }

  .stamp__subtitle {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-top: var(--space-2);
  }

  /* ── Phase 2: Typewriter ── */
  .typewriter {
    min-height: 2em;
    text-align: center;
    opacity: 0;
    animation: typewriter-in 300ms ease-out forwards;
  }

  @keyframes typewriter-in {
    to { opacity: 1; }
  }

  .typewriter__text {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .typewriter__cursor {
    display: inline-block;
    width: 8px;
    height: 1em;
    background: var(--color-accent-amber);
    vertical-align: text-bottom;
    animation: cursor-blink 530ms step-end infinite;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* ── Phase 3: Section Reveal ── */
  .sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    opacity: 0;
    animation: sections-in 300ms ease-out forwards;
  }

  @keyframes sections-in {
    to { opacity: 1; }
  }

  .section-slot {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface) 30%, transparent);
    opacity: 0;
    transform: translateX(-20px);
    animation: section-reveal 400ms ease-out forwards;
  }

  @keyframes section-reveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .section-slot__label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-primary);
    flex: 1;
  }

  .section-slot__stamp {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-danger);
    transform: rotate(-3deg);
    opacity: 0;
    animation: declassify-stamp 300ms ease-out forwards;
  }

  @keyframes declassify-stamp {
    0% {
      opacity: 0;
      transform: rotate(-15deg) scale(1.5);
    }
    100% {
      opacity: 1;
      transform: rotate(-3deg) scale(1);
    }
  }

  /* ── Phase 4: Begin Reading ── */
  .action {
    margin-top: var(--space-4);
    opacity: 0;
    animation: action-in 500ms ease-out forwards;
  }

  @keyframes action-in {
    to { opacity: 1; }
  }

  .action__btn {
    padding: var(--space-3) var(--space-6);
    font-family: var(--font-brutalist);
    font-weight: var(--font-black, 900);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-text-inverse);
    background: var(--color-accent-amber);
    border: 2px solid var(--color-accent-amber);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 48px;
    animation: btn-glow 2s ease-in-out infinite;
  }

  @keyframes btn-glow {
    0%, 100% { box-shadow: 0 0 8px var(--color-primary-border); }
    50% { box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 50%, transparent); }
  }

  .action__btn:hover {
    box-shadow: 0 0 24px color-mix(in srgb, var(--color-primary) 60%, transparent);
    transform: translateY(-1px);
  }

  .action__btn:focus-visible {
    outline: 2px solid var(--color-accent-amber);
    outline-offset: 4px;
  }

  /* ── Reduced Motion ── */
  @media (prefers-reduced-motion: reduce) {
    .reveal__backdrop {
      animation: none;
      background: rgba(0, 0, 0, 0.95);
    }

    .stamp {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .stamp__flash {
      animation: none;
    }

    .typewriter {
      animation: none;
      opacity: 1;
    }

    .typewriter__cursor {
      animation: none;
      display: none;
    }

    .sections {
      animation: none;
      opacity: 1;
    }

    .section-slot {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .section-slot__stamp {
      animation: none;
      opacity: 1;
      transform: rotate(-3deg);
    }

    .action {
      animation: none;
      opacity: 1;
    }

    .action__btn {
      animation: none;
      box-shadow: 0 0 8px var(--color-primary-border);
    }

    .reveal__backdrop::after {
      animation: none;
    }
  }

  @media (max-width: 480px) {
    .reveal__content {
      padding: var(--space-4);
    }

    .stamp__title {
      font-size: var(--text-base);
      padding: var(--space-2) var(--space-3);
    }
  }
`;
