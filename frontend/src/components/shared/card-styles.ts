import { css } from 'lit';

/**
 * Shared card hover/active transform styles.
 * Usage: `static styles = [cardStyles, css\`...\`]`
 */
export const cardStyles = css`
  .card {
    cursor: pointer;
    transition: transform var(--duration-normal) var(--ease-out),
      box-shadow var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out);

    /* Staggered grid entrance — set --i on each card from the parent .map() */
    opacity: 0;
    animation: card-enter var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }
  .card:hover {
    transform: var(--hover-transform, translate(-2px, -2px));
    box-shadow: var(--shadow-lg);
  }
  .card:active {
    transform: translate(0);
    box-shadow: var(--shadow-pressed);
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Embassy/Ambassador — uses per-simulation theme colors.
     Non-hover: pulsing ring (box-shadow 1px→5px) + glow, works with border-radius.
     Hover: sweeping light beam via ::after, flowing gradient border, deep multi-layer glow. */
  .card.card--embassy {
    position: relative;
    border-color: transparent;
    box-shadow:
      0 0 0 1px var(--color-primary),
      0 0 8px color-mix(in srgb, var(--color-primary) 40%, transparent);
    animation:
      card-enter var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both,
      embassy-pulse 3s ease-in-out infinite;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms)), 0s;
  }

  /* Sweeping light beam — skewed highlight bar that scans across the card on hover */
  .card.card--embassy::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 40%;
    height: 200%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--color-primary) 15%, transparent) 30%,
      color-mix(in srgb, var(--color-primary) 50%, transparent) 50%,
      color-mix(in srgb, var(--color-primary) 15%, transparent) 70%,
      transparent 100%
    );
    transform: skewX(-15deg) translateX(-100%);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    z-index: 1;
  }

  .card.card--embassy:hover {
    opacity: 1;
    transform: translate(-4px, -4px) scale(1.03);
    border-color: transparent;
    border-width: 3px;
    background:
      linear-gradient(var(--color-surface-raised), var(--color-surface-raised)) padding-box,
      linear-gradient(
        135deg,
        var(--color-primary),
        var(--color-text-secondary),
        var(--color-primary),
        var(--color-text-secondary),
        var(--color-primary)
      ) border-box;
    background-size: 100% 100%, 300% 300%;
    animation:
      embassy-border-flow 3s linear infinite,
      embassy-hover-glow 2s ease-in-out infinite;
  }

  .card.card--embassy:hover::after {
    opacity: 1;
    animation: embassy-sweep 2.5s ease-in-out 0.15s infinite;
  }

  .card.card--embassy:active {
    transform: translate(0) scale(1);
    box-shadow:
      0 0 0 2px var(--color-primary),
      var(--shadow-pressed);
  }

  /* Sweep: diagonal light bar scans left → right */
  @keyframes embassy-sweep {
    0% {
      transform: skewX(-15deg) translateX(-100%);
      opacity: 0;
    }
    15% {
      opacity: 0.9;
    }
    85% {
      opacity: 0.9;
    }
    100% {
      transform: skewX(-15deg) translateX(450%);
      opacity: 0;
    }
  }

  /* Border: gradient position cycles creating a flowing border */
  @keyframes embassy-border-flow {
    0% {
      background-position: 0 0, 0% 0%;
    }
    100% {
      background-position: 0 0, 100% 100%;
    }
  }

  /* Hover glow: deep multi-layer aura that breathes */
  @keyframes embassy-hover-glow {
    0%, 100% {
      box-shadow:
        var(--shadow-lg),
        0 0 15px color-mix(in srgb, var(--color-primary) 50%, transparent),
        0 0 35px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }
    50% {
      box-shadow:
        var(--shadow-lg),
        0 0 25px color-mix(in srgb, var(--color-primary) 90%, transparent),
        0 0 55px color-mix(in srgb, var(--color-text-secondary) 50%, transparent),
        0 0 85px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }
  }

  /* Idle pulse: ring width 1→5px + glow breathe */
  @keyframes embassy-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 1px var(--color-primary),
        0 0 6px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }
    50% {
      box-shadow:
        0 0 0 5px var(--color-text-secondary),
        0 0 20px color-mix(in srgb, var(--color-primary) 70%, transparent);
    }
  }
`;
