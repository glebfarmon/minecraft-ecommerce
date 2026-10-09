import type {PublicRules} from '@/features/rules/types'

import {itemAnchor, numberRules, sectionAnchor} from './number-rules'

const en = (value: string) => ({value, lang: 'en' as const})

const rules: PublicRules = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {id: 'general', title: en('General'), items: [{id: 'g1', text: en('One')}]},
    {
      id: 'chat',
      title: en('Chat'),
      items: [
        {id: 'c1', text: en('Two')},
        {id: 'c2', text: en('Three')}
      ]
    }
  ]
}

describe('numberRules', () => {
  it('numbers sections and items by position', () => {
    const sections = numberRules(rules)
    expect(sections.map(s => s.number)).toEqual([1, 2])
    expect(sections[1]?.items.map(i => i.number)).toEqual(['2.1', '2.2'])
  })

  it('derives anchors from the numbers', () => {
    const sections = numberRules(rules)
    expect(sections[1]?.anchor).toBe('s-2')
    expect(sections[1]?.items[1]?.anchor).toBe('r-2-2')
  })

  it('keeps ids and localized texts', () => {
    const item = numberRules(rules)[1]?.items[0]
    expect(item).toEqual({id: 'c1', number: '2.1', anchor: 'r-2-1', text: en('Two')})
  })

  it('exposes the anchor helpers', () => {
    expect(sectionAnchor(3)).toBe('s-3')
    expect(itemAnchor(3, 12)).toBe('r-3-12')
  })
})
