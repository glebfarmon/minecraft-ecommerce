import {getRules} from './get-rules'

describe('getRules', () => {
  it.each(['en', 'pl'] as const)('returns %s rules tagged with their language', async locale => {
    const rules = await getRules(locale)
    expect(rules?.publishedAt).toBe('2026-05-28T12:00:00Z')
    expect(rules?.sections).toHaveLength(6)
    expect(rules?.sections[0]?.title.lang).toBe(locale)
    expect(rules?.sections[0]?.items[0]?.text.lang).toBe(locale)
  })

  it('returns PL texts for PL', async () => {
    const rules = await getRules('pl')
    expect(rules?.sections[1]?.title.value).toBe('Czat')
  })
})
