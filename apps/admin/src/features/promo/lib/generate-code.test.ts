import {CODE_DIGITS, CODE_LETTERS, CODE_PLACEHOLDER, generateCode} from './generate-code'

describe('generateCode', () => {
  it('is 5 letters and 3 digits without look-alikes, over 1 000 runs', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateCode()
      expect(code).toMatch(/^[A-Z]{5}[0-9]{3}$/)
      expect(code).not.toMatch(/[OI01]/)
    }
  })

  it('draws from the injected random source', () => {
    expect(generateCode(() => 0)).toBe('AAAAA222')
    expect(generateCode(() => 0.9999)).toBe('ZZZZZ999')
  })

  it('starts from a placeholder in the same format', () => {
    expect(CODE_PLACEHOLDER).toBe('AAAAA000')
    expect(CODE_LETTERS).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ')
    expect(CODE_DIGITS).toBe('23456789')
  })
})
