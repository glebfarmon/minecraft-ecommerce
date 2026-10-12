import {RULES_REVEAL} from '@/config/rules'

import {revealDelay} from './reveal-delay'

describe('revealDelay', () => {
  it('staggers the first sections after the header and sidebar', () => {
    expect(revealDelay(0)).toBeCloseTo(RULES_REVEAL.firstSection)
    expect(revealDelay(1)).toBeCloseTo(RULES_REVEAL.firstSection + RULES_REVEAL.step)
  })

  it('lets every later section enter with the last staggered one', () => {
    const last = revealDelay(RULES_REVEAL.staggered)
    expect(revealDelay(RULES_REVEAL.staggered + 1)).toBe(last)
    expect(revealDelay(40)).toBe(last)
  })
})
