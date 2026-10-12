// Rules page tuning.

/** The search filters this long after the reader stops typing; clearing it is immediate. */
export const RULES_SEARCH_DELAY_MS = 200

/** Page entrance: header first, then the sidebar, then sections one after another (seconds). */
export const RULES_REVEAL = {
  sidebar: 0.1,
  firstSection: 0.15,
  step: 0.06,
  /** Sections past this index enter together, so a long page does not trickle in. */
  staggered: 5
} as const
