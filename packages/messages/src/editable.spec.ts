import {EDITABLE_MESSAGES, isEditableKey} from './editable'

describe('isEditableKey', () => {
  it('matches exact keys and namespace wildcards', () => {
    expect(isEditableKey('hero.title')).toBe(true)
    expect(isEditableKey('faq.q1')).toBe(true)
    expect(isEditableKey('how.step1.title')).toBe(true)
  })

  it('refuses keys outside the allowlist', () => {
    expect(isEditableKey('hero.left1')).toBe(false)
    expect(isEditableKey('cart.title')).toBe(false)
    expect(isEditableKey('consent.text')).toBe(false)
    expect(isEditableKey('faqx.q1')).toBe(false)
    expect(isEditableKey('')).toBe(false)
  })

  it('lists the spec allowlist', () => {
    expect(EDITABLE_MESSAGES).toContain('rules.lead')
  })
})
