import {IntlMessageFormat} from 'intl-messageformat'

import en from '../../messages/en.json'
import pl from '../../messages/pl.json'

function leaves(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]]
  return Object.entries(tree as object).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k)
  )
}

describe.each([
  ['en', en],
  ['pl', pl]
] as const)('%s messages are valid ICU', (locale, messages) => {
  it.each(leaves(messages))('%s', (_key, text) => {
    expect(() => new IntlMessageFormat(text, locale)).not.toThrow()
  })
})
