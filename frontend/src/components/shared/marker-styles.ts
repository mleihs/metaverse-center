import { css } from 'lit';

/**
 * Auszeichnung ohne Farbbalken — the marking vocabulary for this platform.
 *
 * WHY THIS MODULE EXISTS
 * A coloured 3px bar down the left edge of a card had spread to 110 places in
 * 63 files. It is the single most recognisable tell of machine-assembled UI:
 * every card wears the same slab, the slab carries no shape of its own, and a
 * screen full of them reads as a template rather than as a document. The
 * platform's own aesthetic is a Cold War intelligence dossier — registration
 * marks, stamps, typewriter labels — and none of those are a coloured stripe.
 *
 * The bar was also doing four different jobs at once, which is why removing it
 * needs a vocabulary rather than a delete:
 *
 *   1. IDENTITY / CATEGORY   which shard, which archetype, which epoch
 *   2. STATUS / SEVERITY     danger, warning, success, pending
 *   3. EMPHASIS              this one is featured / selected
 *   4. GROUPING              a quote, a nested block, an indented aside
 *
 * Each job gets its own device here, and the devices are deliberately
 * different from one another — that is the point. A reader should be able to
 * tell "what kind of thing is this" from "how is it doing" without decoding a
 * colour.
 *
 *   1. IDENTITY  -> `markerCornerStyles`  corner brackets in the accent colour
 *   2. STATUS    -> `markerStatusStyles`  a Courier micro-label; the WORD is
 *                                         coloured, the container stays neutral
 *   3. EMPHASIS  -> the existing brutalist shadow tokens plus a brighter
 *                   neutral border. No new device; `--shadow-md` already says
 *                   "lifted" better than a stripe does.
 *   4. GROUPING  -> `markerQuoteStyles`   a NEUTRAL hairline, or a hanging
 *                                         indent where the block is prose
 *
 * TWO MORE IDIOMS, for the cases where a box is the wrong frame at all
 * (established in the dungeon chamber text, commit 206981e): a full-width
 * LETTERBOX BAND with a vertical gradient replaces an edge on a wide plate,
 * and a HANGING INDENT replaces a rule on flowing prose. Neither belongs in a
 * utility class — they are layout decisions — but they are the right answer
 * often enough to be named here.
 *
 * WHY CORNER BRACKETS, SPECIFICALLY
 * They are already this repo's idiom (`terminalFrameStyles`, the dungeon map's
 * selection reticle), they read as a registration or targeting mark rather than
 * as decoration, they carry the accent colour without occupying an edge, and
 * they survive `prefers-reduced-motion` because they are geometry rather than
 * an effect.
 *
 * IMPLEMENTATION NOTE — why one pseudo-element and four gradients
 * The obvious build is `::before` + `::after`, one corner each. That consumes
 * BOTH pseudo-elements, and across 63 files far too many cards already spend
 * one on a scanline, a sheen or a hover wash. So all four segments are painted
 * as four `linear-gradient` layers inside a single `::after`. Consumers that
 * already use `::after` can switch to `.marker-corners--before` instead.
 *
 * Painting them on the ELEMENT's own background would be cheaper still, but a
 * component's `background:` shorthand — which is the common way to set a card's
 * surface, and which comes later in the cascade — would silently erase them.
 * The pseudo-element has no such collision.
 *
 * USAGE
 *   static styles = [markerCornerStyles, css`
 *     .card { --marker-color: var(--color-primary); }
 *   `];
 *   <div class="card marker-corners">…</div>
 *
 * Set `--marker-color` on the marked element (Tier 3, in `:host` or on the
 * rule itself). It defaults to the neutral border colour, so a consumer that
 * forgets gets a quiet frame rather than a wrong one.
 */

/**
 * Corner brackets: identity and category.
 *
 * Two L-shaped marks, top-left and bottom-right. The diagonal pair is
 * deliberate — a symmetric set of four reads as a frame (and competes with the
 * card's own border), while a diagonal pair reads as a registration mark and
 * leaves the card's silhouette intact.
 */
export const markerCornerStyles = css`
  .marker-corners,
  .marker-corners--before {
    position: relative;
  }

  .marker-corners::after,
  .marker-corners--before::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* Four segments, one gradient each: top-left horizontal, top-left
       vertical, bottom-right horizontal, bottom-right vertical. */
    background-image:
      linear-gradient(var(--marker-color, var(--color-border)) 0 0),
      linear-gradient(var(--marker-color, var(--color-border)) 0 0),
      linear-gradient(var(--marker-color, var(--color-border)) 0 0),
      linear-gradient(var(--marker-color, var(--color-border)) 0 0);
    background-repeat: no-repeat;
    background-size:
      var(--marker-arm, 12px) var(--marker-thickness, 2px),
      var(--marker-thickness, 2px) var(--marker-arm, 12px),
      var(--marker-arm, 12px) var(--marker-thickness, 2px),
      var(--marker-thickness, 2px) var(--marker-arm, 12px);
    background-position:
      left top,
      left top,
      right bottom,
      right bottom;
  }

  /* Denser variant for small cards and list rows, where a 12px arm on a 40px
     box stops reading as a corner and starts reading as a border. */
  .marker-corners--tight {
    --marker-arm: 8px;
    --marker-thickness: 1px;
  }

  /* Louder variant for a featured or selected item. Emphasis is length, not a
     second colour — the accent already says which category this is. */
  .marker-corners--strong {
    --marker-arm: 18px;
    --marker-thickness: 2px;
  }
`;

/**
 * Status marks: severity as a word, not as furniture.
 *
 * The container keeps its neutral border. The colour moves onto the label,
 * where it sits next to the word it modifies — which is also the only place a
 * colour-blind reader can recover it, since the word says the same thing.
 *
 * The leading glyph is a filled triangle rather than an icon: it needs no
 * import, it inherits the text colour, and it reads as a typewriter's margin
 * mark at 10px, which no stroked icon does.
 */
export const markerStatusStyles = css`
  .status-mark {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4em;
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-brutalist);
    text-transform: var(--label-transform);
    color: var(--marker-color, var(--color-text-secondary));
  }

  .status-mark::before {
    content: '▸';
    /* Optical: the triangle sits high on the baseline at this size. */
    transform: translateY(-0.05em);
    flex: none;
  }

  .status-mark--danger {
    --marker-color: var(--color-danger);
  }
  .status-mark--warning {
    --marker-color: var(--color-warning);
  }
  .status-mark--success {
    --marker-color: var(--color-success);
  }
  .status-mark--info {
    --marker-color: var(--color-info);
  }
  .status-mark--primary {
    --marker-color: var(--color-primary);
  }
  .status-mark--muted {
    --marker-color: var(--color-text-muted);
  }
`;

/**
 * Grouping: a quote rule, kept neutral.
 *
 * A hairline down the left of a quoted or nested block is a typographic device
 * that predates the web, and it is NOT what this sweep is removing — what it
 * removes is that rule wearing a status colour. So the rule stays, at one
 * pixel, in the border colour, and never carries meaning.
 *
 * `marker-indent` is the alternative for flowing prose, where any rule is one
 * device too many: a hanging indent groups the block by shape alone.
 */
export const markerQuoteStyles = css`
  .marker-quote {
    border-left: 1px solid var(--color-border);
    padding-left: var(--space-3);
  }

  .marker-indent {
    padding-left: 1.4em;
    text-indent: -1.4em;
  }
`;

/**
 * Selection / active: a tinted field inside a hairline, never an edge.
 *
 * WHY THIS IS THE FOURTH DEVICE AND NOT A FIFTH JOB OF THE THIRD
 * The list above gives EMPHASIS ("this one is featured") the brutalist shadow
 * and a brighter border, and that is right for a card that stands out in a
 * static arrangement. SELECTION is a different claim: it says "this is the one
 * you are looking at right now", it moves as the reader moves, and there is
 * exactly one of it in its group. A shadow cannot say that — a shadow is a
 * property of the object, and the object did not change when you clicked it.
 *
 * The design handoff of 2026-08-31 named this device explicitly and made it
 * binding across every view: an active tab, the open conversation, the current
 * table-of-contents entry, the edition being read, the selected filter chip.
 * All of them get the same two declarations, and none of them gets a bar down
 * an edge — that was the shape the accent-bar sweep removed from 110 places,
 * and selection is precisely the job it was doing in the ones that felt hardest
 * to give up.
 *
 * WHY `outline` AND NOT `border`
 * A border changes an element's box, so switching it on for the selected row
 * shifts every other row by a pixel unless the unselected state already carries
 * a transparent border of the same width — a coupling that breaks the moment
 * someone restyles one of the two states. `outline` is drawn outside the box
 * model, costs no layout, and with `outline-offset: -1px` sits exactly where a
 * 1px inset border would. It also survives on an element that already spends
 * its border on something else, which several of the consumers do.
 *
 * The tint is deliberately faint (6%). It has to read as "current" next to a
 * hover state at a similar strength without competing with the amber TEXT that
 * usually accompanies it; the outline, not the fill, is what makes it legible.
 *
 * USAGE
 *   static styles = [markerSelectionStyles, css` … `];
 *   <button class="tab ${active ? 'is-selected' : ''}">…</button>
 *
 * Override `--selection-color` on the element for a non-amber context (the
 * dungeon's green aid/guard targeting, say). It defaults to the platform accent
 * rather than `--color-primary` because selection is chrome: it must stay amber
 * when a simulation theme repaints the content around it.
 */
export const markerSelectionStyles = css`
  .is-selected {
    background: color-mix(
      in srgb,
      var(--selection-color, var(--color-accent-amber)) 6%,
      transparent
    );
    outline: 1px solid
      color-mix(in srgb, var(--selection-color, var(--color-accent-amber)) 45%, transparent);
    outline-offset: -1px;
  }
`;
