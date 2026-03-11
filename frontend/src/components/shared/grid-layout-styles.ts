import { css } from 'lit';

/**
 * Shared entity grid layout styles for auto-fill card grids.
 *
 * Provides `.entity-grid` class with responsive auto-fill columns.
 * Default minmax: 240px. Override with `--grid-min-width` custom property.
 *
 * Usage: `static styles = [gridLayoutStyles, css\`...\`]`
 *
 * To customize min column width per view:
 *   .entity-grid { --grid-min-width: 260px; }
 */
export const gridLayoutStyles = css`
  .entity-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(var(--grid-min-width, 240px), 1fr)
    );
    gap: var(--space-4);
  }

  @media (max-width: 640px) {
    .entity-grid {
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }
  }

  @media (max-width: 480px) {
    .entity-grid {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
  }
`;
