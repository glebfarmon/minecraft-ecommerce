// Shared animation tuning. Section-specific delays stay next to the component they belong to.

/** The site's ease-out (the same curve as `--ease-out-expo` in globals.css). */
export const EASE = [0.16, 1, 0.3, 1] as const
/** Entrance plays once, when a section is 15% above the bottom edge. */
export const REVEAL_VIEWPORT = {once: true, margin: '0px 0px -15% 0px'} as const
/** Container-transform spring of `MorphPopover`. */
export const MORPH = {type: 'spring', bounce: 0.1, duration: 0.45} as const
/** Cart numbers change by one step at a time, so they settle much faster than the online counter. */
export const CART_TICK_S = 0.45

/** The card thrown into the cart (`flyToCart`). */
export const FLY_TO_CART = {
  durationMs: 720,
  steps: 32,
  /** Share of the timeline spent crouching before the jump. */
  crouch: 0.14,
  /** Share of the flight over which the card is swallowed by the cart. */
  swallow: 0.28,
  /** Keep the card's centre at least this far below the top of the viewport at the apex. */
  edgeMarginPx: 32,
  bumpMs: 380
} as const
