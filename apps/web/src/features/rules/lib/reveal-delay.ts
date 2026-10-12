import {RULES_REVEAL} from '@/config/rules'

/** Entrance delay (s) of the section at `index`: a short stagger, capped so long pages do not trickle in. */
export const revealDelay = (index: number) =>
  RULES_REVEAL.firstSection + Math.min(index, RULES_REVEAL.staggered) * RULES_REVEAL.step
