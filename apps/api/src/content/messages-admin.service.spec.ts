import {checkOverride} from './messages-admin.service'

describe('checkOverride', () => {
  it('accepts a text with the same arguments and tags', () => {
    expect(() => {
      checkOverride('en', 'rules.title', 'Our <accent>rules</accent>')
    }).not.toThrow()
  })
  it('refuses a key outside the allowlist with 400 unknown_key', () => {
    expect(() => {
      checkOverride('en', 'cart.title', 'x')
    }).toThrow(expect.objectContaining({status: 400}) as Error)
  })
  it('refuses a dropped tag with 422 placeholder_mismatch and both lists', () => {
    try {
      checkOverride('en', 'rules.title', 'Our rules')
      throw new Error('no throw')
    } catch (error) {
      expect(error).toMatchObject({
        status: 422,
        response: {message: 'placeholder_mismatch', issues: {expected: ['<accent>'], found: []}}
      })
    }
  })
  it('refuses broken ICU with 422', () => {
    expect(() => {
      checkOverride('en', 'hero.title', 'Hello {name')
    }).toThrow(expect.objectContaining({status: 422}) as Error)
  })
})
