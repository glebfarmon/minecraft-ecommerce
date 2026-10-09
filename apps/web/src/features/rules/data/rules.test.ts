import {parseInline} from '@/features/rules/lib/inline-markdown'

import {RULES_EN} from './rules.en'
import {RULES_PL} from './rules.pl'

const shape = (rules: typeof RULES_EN) =>
  rules.sections.map(s => ({id: s.id, items: s.items.map(i => i.id)}))

describe('demo rules', () => {
  it('have the same sections and items in EN and PL', () => {
    expect(shape(RULES_PL)).toEqual(shape(RULES_EN))
  })

  it('share one edition date, at noon UTC so no time zone shifts the day', () => {
    expect(RULES_PL.publishedAt).toBe(RULES_EN.publishedAt)
    expect(RULES_EN.publishedAt).toMatch(/T12:00:00Z$/)
  })

  it.each([
    ['en', RULES_EN],
    ['pl', RULES_PL]
  ])('%s has no empty texts and only safe links', (_, rules) => {
    for (const section of rules.sections) {
      expect(section.title.trim()).not.toBe('')
      for (const item of section.items) {
        expect(item.text.trim()).not.toBe('')
        // A `[label](href)` written in the text must survive as a link, not degrade to its label.
        const written = (item.text.match(/\]\(/g) ?? []).length
        expect(parseInline(item.text).filter(t => t.type === 'link')).toHaveLength(written)
      }
    }
  })
})
