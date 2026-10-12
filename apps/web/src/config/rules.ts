// Rules page tuning.

/** The search filters this long after the reader stops typing; clearing it is immediate. */
export const RULES_SEARCH_DELAY_MS = 200

/**
 * Page entrance, in the home hero's language (seconds): title words slide up from a mask, the lead
 * and edition rise after them, then the sidebar, then the sections one after another.
 */
export const RULES_REVEAL = {
  word: 0.12,
  wordStep: 0.08,
  lead: 0.35,
  edition: 0.42,
  sidebar: 0.5,
  firstSection: 0.55,
  step: 0.06,
  /** Sections past this index enter together, so a long page does not trickle in. */
  staggered: 5
} as const
