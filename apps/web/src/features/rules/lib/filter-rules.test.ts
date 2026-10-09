import type {RuleSection} from '@/features/rules/types'

import {filterRules} from './filter-rules'

const pl = (value: string) => ({value, lang: 'pl' as const})

const sections: RuleSection[] = [
  {
    id: 'chat',
    number: 1,
    anchor: 's-1',
    title: pl('Czat'),
    items: [
      {id: 'c1', number: '1.1', anchor: 'r-1-1', text: pl('**Obelgi** są zabronione.')},
      {id: 'c2', number: '1.2', anchor: 'r-1-2', text: pl('Zakaz spamu.')}
    ]
  },
  {
    id: 'cheats',
    number: 2,
    anchor: 's-2',
    title: pl('Sprawdzanie na cheaty'),
    items: [{id: 'x1', number: '2.1', anchor: 'r-2-1', text: pl('**Złośliwe** oprogramowanie.')}]
  }
]

describe('filterRules', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterRules(sections, '', 'pl')).toBe(sections)
    expect(filterRules(sections, '  ', 'pl')).toBe(sections)
  })

  it('keeps only matching items, searching the visible text', () => {
    const result = filterRules(sections, 'zlosliwe', 'pl')
    expect(result.map(s => s.id)).toEqual(['cheats'])
    expect(result[0]?.items.map(i => i.id)).toEqual(['x1'])
  })

  it('does not match markdown syntax', () => {
    expect(filterRules(sections, '**', 'pl')).toEqual([])
  })

  it('keeps a whole section when its title matches', () => {
    const result = filterRules(sections, 'czat', 'pl')
    expect(result[0]?.items).toHaveLength(2)
  })

  it('finds an item by its number', () => {
    const result = filterRules(sections, '1.2', 'pl')
    expect(result[0]?.items.map(i => i.id)).toEqual(['c2'])
  })

  it('drops sections without matches', () => {
    expect(filterRules(sections, 'nothing here', 'pl')).toEqual([])
  })
})
