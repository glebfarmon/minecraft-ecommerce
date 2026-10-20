import en from '../../messages/en.json'
import pl from '../../messages/pl.json'
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
