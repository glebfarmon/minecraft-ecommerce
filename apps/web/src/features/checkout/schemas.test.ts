import * as v from 'valibot'

import {checkoutSchema} from './schemas'

const valid = {
  nick: 'Steve_42',
  email: 'steve@example.com',
  promo: '',
  delivery: true,
  terms: true
}

const issueMessages = (input: unknown) => {
  const result = v.safeParse(checkoutSchema, input)
  return result.success ? [] : result.issues.map(i => i.message)
}

describe('checkoutSchema', () => {
  it('accepts a complete form', () => {
    expect(v.safeParse(checkoutSchema, valid).success).toBe(true)
  })

  it.each(['ab', 'a'.repeat(17), 'Steve!', 'Ste ve', 'Стив', ''])('rejects nick %j', nick => {
    expect(issueMessages({...valid, nick})).toEqual(['nick'])
  })

  it.each(['abc', 'a'.repeat(16)])('accepts nick %j at the length limits', nick => {
    expect(v.safeParse(checkoutSchema, {...valid, nick}).success).toBe(true)
  })

  it('trims the nick before checking it', () => {
    const result = v.safeParse(checkoutSchema, {...valid, nick: '  Steve  '})
    expect(result.success && result.output.nick).toBe('Steve')
  })

  it.each(['', 'steve', 'steve@', 'steve@example'])('rejects email %j', email => {
    expect(issueMessages({...valid, email})).toEqual(['email'])
  })

  it('keeps the promo optional and trims it', () => {
    const result = v.safeParse(checkoutSchema, {...valid, promo: '  SPRING  '})
    expect(result.success && result.output.promo).toBe('SPRING')
  })

  it('requires both consents', () => {
    expect(issueMessages({...valid, delivery: false})).toEqual(['delivery'])
    expect(issueMessages({...valid, terms: false})).toEqual(['terms'])
  })
})
