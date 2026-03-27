import { css } from 'lit';

/**
 * Shared terminal / HUD theme styles for auth-related views.
 *
 * Usage (compose as needed):
 *   static styles = [terminalTokens, terminalAnimations, terminalFormStyles, css`...`];
 */

/* ── Design tokens (aliases to platform tokens — :root is now dark) ── */
export const terminalTokens = css`
  :host {
    --amber: var(--color-accent-amber);
    --amber-dim: var(--color-accent-amber-dim);
    --amber-glow: var(--color-accent-amber-glow);
    --hud-bg: var(--color-surface);
    --hud-surface: var(--color-surface-raised);
    --hud-border: var(--color-border);
    --hud-text: var(--color-text-primary);
    --hud-text-dim: var(--color-text-muted);
  }
`;

/* ── Component-local (Tier 3) token aliases for terminal HUD components ──
 * Bridges Tier 2 HUD tokens (--amber, --hud-bg, etc.) to component-local
 * --_* variables. Used by TerminalQuickActions, DungeonQuickActions,
 * DungeonHeader, DungeonTerminalView, and terminalActionStyles.
 *
 * Components that need additional Tier 3 vars (e.g. --_danger) add their own
 * :host block alongside this shared set.
 */
export const terminalComponentTokens = css`
  :host {
    --_phosphor: var(--amber);
    --_phosphor-dim: var(--amber-dim);
    --_phosphor-glow: var(--amber-glow);
    --_screen-bg: var(--hud-bg);
    --_border: var(--hud-border);
    --_mono: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  }
`;

/* ── Keyframe animations + reduced-motion overrides ── */
export const terminalAnimations = css`
  @keyframes terminal-boot {
    0% {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      filter: brightness(1.5);
    }
    40% { opacity: 1; filter: brightness(1.2); }
    100% { transform: translateY(0) scale(1); filter: brightness(1); }
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes field-reveal {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes line-expand {
    to { transform: scaleX(1); }
  }

  @keyframes btn-materialize {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .terminal, .form-group { animation: none !important; }
    .header__cursor { animation: none !important; }
  }
`;

/* ── Form elements: groups, labels, inputs, submit button, messages ── */
export const terminalFormStyles = css`
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 20px;
    animation: field-reveal 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
  }
  .form-group:nth-child(1) { animation-delay: 150ms; }
  .form-group:nth-child(2) { animation-delay: 220ms; }

  .form-label {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 900;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: var(--hud-text-dim);
  }

  .form-input {
    font-family: var(--font-mono, 'SF Mono', monospace);
    font-size: var(--text-sm, 0.8rem);
    padding: 10px 14px;
    border: 1px solid var(--hud-border);
    border-radius: 0;
    background: var(--hud-bg);
    color: var(--hud-text);
    transition: border-color 150ms, box-shadow 150ms;
    width: 100%;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber-glow), inset 0 0 12px var(--amber-glow);
  }

  .form-input::placeholder {
    color: var(--color-text-muted);
  }

  /* ── CTA Button ── */
  .btn-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px 24px;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 900;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 3px;
    background: var(--amber);
    color: var(--hud-bg);
    border: 1px solid var(--amber-dim);
    border-radius: 0;
    cursor: pointer;
    transition: all 150ms;
    margin-top: 4px;
  }

  .btn-submit:hover {
    background: var(--color-primary-hover);
    box-shadow: 0 0 20px var(--amber-glow);
  }

  .btn-submit:active {
    transform: scale(0.98);
  }

  .btn-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn-submit:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  /* ── Status Messages ── */
  .msg--error {
    padding: 12px 14px;
    margin-bottom: 20px;
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 1px solid var(--color-danger-border);
    border-left: 3px solid var(--color-danger);
    color: color-mix(in srgb, var(--color-danger) 65%, white);
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .msg--success {
    padding: 12px 14px;
    margin-bottom: 20px;
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
    border-left: 3px solid var(--color-success);
    color: color-mix(in srgb, var(--color-success) 55%, white);
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  @media (max-width: 640px) {
    .form-input {
      font-size: var(--text-base, 1rem);
      padding: 12px 14px;
      min-height: 44px;
    }

    .btn-submit {
      min-height: 44px;
      padding: 14px 20px;
    }
  }
`;

/* ── OAuth section: divider, provider buttons ── */
export const terminalOAuthStyles = css`
  .oauth-section {
    padding: 0 28px 24px;
  }

  .oauth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .oauth-divider__line {
    flex: 1;
    height: 1px;
    background: var(--hud-border);
    transform-origin: center;
    transform: scaleX(0);
    animation: line-expand 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards 200ms;
  }

  .oauth-divider__text {
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--hud-text-dim);
    white-space: nowrap;
  }

  .oauth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px 24px;
    font-family: var(--font-brutalist, 'Courier New', monospace);
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    border: 1px solid var(--hud-border);
    border-radius: 0;
    cursor: pointer;
    transition: all 200ms;
    opacity: 0;
    animation: btn-materialize 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
    box-sizing: border-box;
  }

  .oauth-btn + .oauth-btn {
    margin-top: 10px;
  }

  .oauth-btn--google {
    background: var(--hud-bg);
    color: var(--hud-text);
    animation-delay: 300ms;
  }

  .oauth-btn--google:hover {
    border-color: #4285f4; /* lint-color-ok */
    box-shadow: 0 0 20px rgba(66, 133, 244, 0.25);
  }

  .oauth-btn--discord {
    background: var(--hud-bg);
    color: var(--hud-text);
    animation-delay: 380ms;
  }

  .oauth-btn--discord:hover {
    border-color: #5865f2; /* lint-color-ok */
    box-shadow: 0 0 20px rgba(88, 101, 242, 0.25);
  }

  .oauth-btn:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  .oauth-btn__icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .oauth-divider__line, .oauth-btn { animation: none !important; opacity: 1; transform: none; }
  }

  @media (max-width: 640px) {
    .oauth-section {
      padding: 0 20px 20px;
    }

    .oauth-btn {
      min-height: 44px;
      padding: 12px 20px;
    }
  }
`;

/* ── Terminal frame: box, corner brackets, scanline overlay ── */
export const terminalFrameStyles = css`
  .terminal {
    width: 100%;
    max-width: 460px;
    background: var(--hud-surface);
    border: 1px dashed var(--hud-border);
    position: relative;
    animation: terminal-boot 600ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
  }

  /* Corner brackets */
  .terminal::before,
  .terminal::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: var(--amber);
    border-style: solid;
    pointer-events: none;
  }
  .terminal::before {
    top: -1px; left: -1px;
    border-width: 2px 0 0 2px;
  }
  .terminal::after {
    top: -1px; right: -1px;
    border-width: 2px 2px 0 0;
  }

  .terminal__bottom-corners {
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 0;
    pointer-events: none;
  }
  .terminal__bottom-corners::before,
  .terminal__bottom-corners::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: var(--amber);
    border-style: solid;
  }
  .terminal__bottom-corners::before {
    bottom: 0; left: -1px;
    border-width: 0 0 2px 2px;
  }
  .terminal__bottom-corners::after {
    bottom: 0; right: -1px;
    border-width: 0 2px 2px 0;
  }

  /* Scanline overlay */
  .terminal__scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(245, 158, 11, 0.012) 3px,
      rgba(245, 158, 11, 0.012) 6px
    );
    z-index: 1;
  }

  .terminal > *:not(.terminal__scanlines):not(.terminal__bottom-corners) {
    position: relative;
    z-index: 2;
  }
`;

/* ── Terminal view wrapper: shared by TerminalView + EpochTerminalView ── */
export const terminalWrapperStyles = css`
  .terminal-wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .terminal-error {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .terminal-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: var(--amber-dim);
  }

  @media (prefers-reduced-motion: no-preference) {
    .terminal-loading {
      animation: cursor-blink 1s step-end infinite;
    }
  }
`;

/* ── Terminal action buttons: shared by TerminalQuickActions + DungeonQuickActions ── */
export const terminalActionStyles = css`
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--_screen-bg) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
    border-top: none;
  }

  .action-btn {
    font-family: var(--_mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 5px 12px;
    background: transparent;
    color: var(--_phosphor-dim);
    border: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
  }

  .action-btn:hover {
    color: var(--_phosphor);
    border-color: var(--_phosphor-dim);
    background: color-mix(in srgb, var(--_phosphor) 5%, transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .action-btn:hover {
      box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent);
    }
  }

  .action-btn:active {
    transform: scale(0.96);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--_phosphor);
    outline-offset: 2px;
  }

  .action-btn--tier2 {
    border-style: dashed;
  }

  .action-btn--primary {
    border-color: var(--_phosphor-dim);
    color: var(--_phosphor);
  }

  .phase-label {
    font-family: var(--_mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--_phosphor-dim);
    opacity: 0.6;
    padding: 5px 0;
    align-self: center;
  }

  /* Mobile: 44px min touch targets (WCAG) */
  @media (max-width: 640px) {
    .actions {
      padding: 10px 14px;
      gap: 8px;
    }
    .action-btn {
      font-size: 12px;
      padding: 8px 16px;
      min-height: 44px;
    }
  }
`;
