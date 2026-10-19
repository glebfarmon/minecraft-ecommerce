import * as v from 'valibot'

import {RulesDocumentSchema, parseRich, toMarkdown, toPlainText} from '@shop/shared/rules'

import {DEMO_RULES, DEMO_RULES_PUBLISHED_AT} from './demo-rules'

describe('demo rules', () => {
  it('is a valid rules document with Polish text everywhere', () => {
    expect(v.safeParse(RulesDocumentSchema, DEMO_RULES).success).toBe(true)
    for (const s of DEMO_RULES.sections) {
      expect(s.title.pl).toBeTruthy()
      for (const i of s.items) expect(i.text.pl).toBeTruthy()
    }
  })

  it('reads the same after the visual editor saves it (markdown round trip)', () => {
    const texts = DEMO_RULES.sections.flatMap(s => [s.title, ...s.items.map(i => i.text)])
    for (const {en, pl} of texts) {
      for (const source of [en, pl ?? '']) {
        const tree = parseRich(source)
        expect(parseRich(toMarkdown(tree))).toEqual(tree)
        expect(toPlainText(parseRich(toMarkdown(tree)))).toBe(toPlainText(tree))
      }
    }
  })

  it('has a fixed publish date', () => {
    expect(DEMO_RULES_PUBLISHED_AT.toISOString()).toBe('2026-05-28T12:00:00.000Z')
  })
})
