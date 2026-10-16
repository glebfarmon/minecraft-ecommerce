import en from '../en.json'
import pl from '../pl.json'
import {EDITABLE_MESSAGES, isEditableKey} from './editable'
import {flattenMessages, getMessage} from './flat'
import {messageArguments} from './placeholders'

describe('messages', () => {
  it('pl.json has exactly the keys of en.json', () => {
    expect(Object.keys(flattenMessages(pl)).sort()).toEqual(Object.keys(flattenMessages(en)).sort())
  })

  it.each([
    ['en', en],
    ['pl', pl]
  ] as const)('%s rules.itemCount has a branch for every plural category', (locale, messages) => {
    const text = (messages as {rules?: {itemCount?: string}}).rules?.itemCount ?? ''
    const {pluralCategories} = new Intl.PluralRules(locale).resolvedOptions() as {
      pluralCategories: string[]
    }
    for (const category of pluralCategories) expect(text).toContain(`${category} {`)
  })

  it('every allowlisted pattern matches at least one key, and every matched EN default parses', () => {
    const keys = Object.keys(flattenMessages(en))
    const matches = (pattern: string, key: string) =>
      pattern.endsWith('.*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern
    const dead = EDITABLE_MESSAGES.filter(pattern => !keys.some(key => matches(pattern, key)))
    expect(dead).toEqual([])
    for (const locale of ['en', 'pl'] as const)
      for (const key of keys.filter(isEditableKey))
        expect(() => messageArguments(getMessage(locale, key) ?? '')).not.toThrow()
  })
})
