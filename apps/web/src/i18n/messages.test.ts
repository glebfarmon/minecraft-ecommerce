/** @jest-environment node */
import en from '../../messages/en.json'
import pl from '../../messages/pl.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

describe('messages', () => {
  it('pl.json has exactly the keys of en.json', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort())
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
})
