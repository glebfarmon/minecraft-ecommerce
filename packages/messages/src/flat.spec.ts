import {flattenMessages, getMessage} from './flat'

describe('flat messages', () => {
  it('flattens nested keys with dots', () => {
    expect(flattenMessages({a: {b: 'x', c: {d: 'y'}}, e: 'z'})).toEqual({
      'a.b': 'x',
      'a.c.d': 'y',
      'e': 'z'
    })
  })

  it('reads a default by locale and key', () => {
    expect(getMessage('en', 'rules.lead')).toEqual(expect.any(String))
    expect(getMessage('pl', 'nope.key')).toBeUndefined()
  })
})
