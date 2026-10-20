import {VALIDATION_MESSAGES} from '@shop/shared/validation-messages'

import en from '../../messages/en.json'
import pl from '../../messages/pl.json'
import {FORM_MESSAGES, messageKey} from '../lib/validation-messages'
import {parseLocale} from './locale'

function keys(tree: unknown, prefix = ''): string[] {
  if (typeof tree !== 'object' || tree === null) return [prefix]
  return Object.entries(tree).flatMap(([key, value]) =>
    keys(value, prefix ? `${prefix}.${key}` : key)
  )
}

describe('admin messages', () => {
  it('en and pl have identical key sets', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort())
  })
})

describe('validation messages', () => {
  const all = {...VALIDATION_MESSAGES, ...FORM_MESSAGES}

  it.each(Object.entries(all))(
    '%s is translated, and en reads exactly like the schema',
    (key, english) => {
      const enText = (en.validation as Record<string, string>)[key]
      // ICU writes a literal brace as '{…}'; the quotes are not part of the text.
      expect(enText?.replaceAll("'", '')).toBe(english)
      expect((pl.validation as Record<string, string>)[key]).toBeTruthy()
      expect(messageKey(english)).toBe(key)
    }
  )

  it('has no validation text without a schema message', () => {
    expect(Object.keys(en.validation).sort()).toEqual(Object.keys(all).sort())
  })
})

describe('parseLocale', () => {
  it.each([
    ['pl', 'pl'],
    ['en', 'en'],
    ['de', 'en'],
    [undefined, 'en']
  ])('%s -> %s', (value, expected) => {
    expect(parseLocale(value)).toBe(expected)
  })
})
