import { css } from 'lit';

/**
 * Shared panel cascade animation for detail panels (Agent, Building, Event).
 *
 * Usage:
 *   static styles = [panelCascadeStyles, css`...`];
 *
 * Apply `.panel__section` to each cascading section, and wrap them in
 * `.panel__content` (or `.panel__info`) — nth-child stagger works on
 * direct children of either container.
 */
export const panelCascadeStyles = css`
  .panel__section {
    opacity: 0;
    animation: panel-cascade 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
  }

  .panel__content > :nth-child(1),
  .panel__info > :nth-child(1) { animation-delay: 80ms; }
  .panel__content > :nth-child(2),
  .panel__info > :nth-child(2) { animation-delay: 140ms; }
  .panel__content > :nth-child(3),
  .panel__info > :nth-child(3) { animation-delay: 200ms; }
  .panel__content > :nth-child(4),
  .panel__info > :nth-child(4) { animation-delay: 260ms; }
  .panel__content > :nth-child(5),
  .panel__info > :nth-child(5) { animation-delay: 320ms; }
  .panel__content > :nth-child(6),
  .panel__info > :nth-child(6) { animation-delay: 380ms; }
  .panel__content > :nth-child(7),
  .panel__info > :nth-child(7) { animation-delay: 440ms; }
  .panel__content > :nth-child(8),
  .panel__info > :nth-child(8) { animation-delay: 500ms; }
  .panel__content > :nth-child(9),
  .panel__info > :nth-child(9) { animation-delay: 560ms; }
  .panel__content > :nth-child(10),
  .panel__info > :nth-child(10) { animation-delay: 620ms; }

  @keyframes panel-cascade {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel__section {
      opacity: 1;
      animation: none;
    }
  }
`;
