/** @jest-environment node */
import {applyOverrides} from './apply-overrides'

describe('applyOverrides', () => {
  const file = {hero: {title: 'A', lead: 'B'}, cart: {title: 'C'}}

  it('replaces allowlisted keys in a copy', () => {
    const out = applyOverrides(file, {'hero.title': 'X'})
    expect(out).toEqual({hero: {title: 'X', lead: 'B'}, cart: {title: 'C'}})
    expect(file.hero.title).toBe('A')
  })

  it('ignores orphans and keys outside the allowlist', () => {
    expect(applyOverrides(file, {'hero.gone': 'X', 'cart.title': 'Y'})).toEqual(file)
  })

  it('never writes through a missing branch or over a namespace', () => {
    expect(applyOverrides(file, {'faq.q1': 'X', 'how.title': 'Y'})).toEqual(file)
    expect(applyOverrides({how: {step: {a: 'A'}}}, {'how.step': 'X'})).toEqual({
      how: {step: {a: 'A'}}
    })
  })
})
