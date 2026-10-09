import {findMatches} from './normalize-search'

describe('findMatches', () => {
  it('ignores case', () => {
    expect(findMatches('Chat rules', 'CHAT', 'en')).toEqual([[0, 4]])
  })

  it('ignores Polish diacritics, including ł', () => {
    expect(findMatches('Złośliwe oprogramowanie', 'zlosliwe', 'pl')).toEqual([[0, 8]])
    expect(findMatches('ŻÓŁW', 'zolw', 'pl')).toEqual([[0, 4]])
  })

  it('maps ranges back to the original text', () => {
    const text = 'Żółw i żółw'
    const ranges = findMatches(text, 'zolw', 'pl')
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual(['Żółw', 'żółw'])
  })

  it('treats regex characters literally', () => {
    expect(findMatches('a (b) * c.', '(b) *', 'en')).toEqual([[2, 7]])
    expect(findMatches('abc', '.', 'en')).toEqual([])
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(findMatches('anything', '', 'en')).toEqual([])
    expect(findMatches('anything', '   ', 'en')).toEqual([])
  })

  it('trims the query', () => {
    expect(findMatches('no spam', ' spam ', 'en')).toEqual([[3, 7]])
  })
})
