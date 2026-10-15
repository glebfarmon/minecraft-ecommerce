import {assertSameSet} from './order'

describe('assertSameSet', () => {
  it('accepts the same ids in another order', () => {
    expect(() => {
      assertSameSet(['a', 'b', 'c'], ['c', 'a', 'b'])
    }).not.toThrow()
  })

  it.each([
    [['a', 'b'], ['a']],
    [
      ['a', 'b'],
      ['a', 'b', 'c']
    ],
    [
      ['a', 'b'],
      ['a', 'x']
    ]
  ])('is 409 stale for %p → %p', (current, requested) => {
    expect(() => {
      assertSameSet(current, requested)
    }).toThrow(expect.objectContaining({status: 409}) as Error)
  })
})
