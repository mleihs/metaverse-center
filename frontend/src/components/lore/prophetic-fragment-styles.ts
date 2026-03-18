import { css } from 'lit';

export const propheticFragmentStyles = css`
  :host {
    display: block;
  }

  .fragment {
    padding: var(--space-4) var(--space-5);
    margin-bottom: var(--space-4);
    position: relative;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ── Parchment ── */
  .fragment--parchment {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: var(--text-sm);
    color: var(--color-text-inverse);
    background: linear-gradient(135deg, rgba(245, 230, 204, 0.9), rgba(235, 215, 185, 0.85));
    border: none;
    clip-path: polygon(
      0% 2%, 3% 0%, 8% 1%, 15% 0%, 22% 2%, 30% 0%,
      38% 1%, 45% 0%, 52% 2%, 60% 0%, 68% 1%, 75% 0%,
      82% 2%, 90% 0%, 95% 1%, 100% 0%,
      100% 98%, 97% 100%, 92% 99%, 85% 100%, 78% 98%, 70% 100%,
      62% 99%, 55% 100%, 48% 98%, 40% 100%, 32% 99%, 25% 100%,
      18% 98%, 10% 100%, 5% 99%, 0% 100%
    );
  }

  .fragment--parchment::after {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");
    mix-blend-mode: multiply;
    pointer-events: none;
    opacity: 0.3;
  }

  /* ── Typewriter ── */
  .fragment--typewriter {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: rgba(200, 200, 190, 0.9);
    background: rgba(30, 30, 30, 0.85);
    border: 1px solid rgba(100, 100, 100, 0.3);
    letter-spacing: 0.02em;
  }

  .fragment--typewriter .fragment__char {
    opacity: 0.85;
  }

  .fragment--typewriter .fragment__char:nth-child(7n+3) {
    opacity: 0.65;
  }

  .fragment--typewriter .fragment__strike {
    text-decoration: line-through;
    opacity: 0.5;
  }

  /* ── Dream Journal ── */
  .fragment--dream {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: var(--text-sm);
    color: rgba(210, 190, 230, 0.95);
    background: linear-gradient(145deg, rgba(40, 20, 60, 0.7), rgba(25, 15, 45, 0.8));
    border-left: 3px solid rgba(150, 100, 200, 0.5);
    transform: rotate(-0.3deg);
  }

  /* ── Bureau Memo ── */
  .fragment--memo {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    background: var(--color-surface-sunken);
    border: 2px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .fragment--memo::before {
    content: 'BUREAU OF IMPOSSIBLE GEOGRAPHY — INTERNAL MEMO';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-brutalist);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  /* ── Stone Inscription ── */
  .fragment--stone {
    font-family: var(--font-brutalist);
    font-size: var(--text-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(180, 180, 175, 0.9);
    background: linear-gradient(170deg, rgba(80, 80, 78, 0.7), rgba(60, 60, 58, 0.8));
    text-shadow:
      1px 1px 0 rgba(40, 40, 38, 0.8),
      -1px -1px 0 rgba(120, 120, 115, 0.2);
    line-height: 2.2;
    text-align: center;
  }

  /* ── Degradation Markers ── */
  .degradation--consumed {
    display: inline-block;
    background: rgba(30, 20, 10, 0.8);
    color: transparent;
    padding: 0 var(--space-2);
    border-radius: 1px;
    position: relative;
    min-width: 80px;
    user-select: none;
  }

  .degradation--consumed::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      rgba(200, 80, 20, 0.15) 0%,
      transparent 70%
    );
    pointer-events: none;
  }

  .degradation--degraded {
    filter: blur(1.5px);
    opacity: 0.6;
    user-select: none;
  }

  .degradation--illegible {
    text-decoration: wavy underline;
    text-decoration-color: rgba(200, 100, 50, 0.4);
    opacity: 0.7;
    font-style: italic;
  }

  .degradation--redacted {
    background: var(--color-text-primary);
    color: transparent;
    padding: 0 var(--space-3);
    user-select: none;
  }

  @media (max-width: 480px) {
    .fragment {
      padding: var(--space-3);
    }

    .fragment--parchment {
      clip-path: none;
    }
  }
`;
