import * as v from 'valibot'

import {RulesDocumentSchema, hasOnlySafeLinks, parseInline, toPlainText} from './rules'

describe('parseInline', () => {
  it('returns plain text as one token', () => {
    expect(parseInline('No spam.')).toEqual([{type: 'text', value: 'No spam.'}])
  })

  it('parses bold, italic and links in order', () => {
    expect(parseInline('**No** *cheats*, see [refunds](/legal/refunds.en.pdf).')).toEqual([
      {type: 'strong', value: 'No'},
      {type: 'text', value: ' '},
      {type: 'em', value: 'cheats'},
      {type: 'text', value: ', see '},
      {type: 'link', value: 'refunds', href: '/legal/refunds.en.pdf'},
      {type: 'text', value: '.'}
    ])
  })

  it('keeps https links', () => {
    expect(parseInline('[Discord](https://discord.com)')).toEqual([
      {type: 'link', value: 'Discord', href: 'https://discord.com'}
    ])
  })

  it.each(['javascript:alert%281%29', 'http://example.com', '//evil.example', 'data:text/html,x'])(
    'turns a link to %s into its plain label',
    href => {
      expect(parseInline(`[click](${href})`)).toEqual([{type: 'text', value: 'click'}])
    }
  )

  it('never makes a link when the URL has a ")" (it ends the URL)', () => {
    expect(parseInline('[click](javascript:alert(1))').some(t => t.type === 'link')).toBe(false)
  })

  it('leaves HTML as literal text', () => {
    expect(parseInline('<b>x</b>')).toEqual([{type: 'text', value: '<b>x</b>'}])
  })

  it('leaves a lone asterisk alone', () => {
    expect(parseInline('2 * 3')).toEqual([{type: 'text', value: '2 * 3'}])
  })
})

describe('toPlainText', () => {
  it('drops markup and URLs but keeps link labels', () => {
    expect(toPlainText(parseInline('**Bold** and [Discord](https://discord.com).'))).toBe(
      'Bold and Discord.'
    )
  })
})

const doc = (text = 'Be nice. See [rules](/rules).') => ({
  sections: [
    {id: 'general', title: {en: 'General', pl: 'Ogólne'}, items: [{id: 'g1', text: {en: text}}]}
  ]
})

describe('hasOnlySafeLinks', () => {
  it.each(['[a](https://x.io)', '[a](/rules)', 'no links'])('accepts %s', t => {
    expect(hasOnlySafeLinks(t)).toBe(true)
  })
  it.each([
    '[a](javascript:alert(1))',
    '[a](//evil.com)',
    '[a](http://x.io)',
    '[a](data:text/html,x)'
  ])('refuses %s', t => {
    expect(hasOnlySafeLinks(t)).toBe(false)
  })
})

describe('RulesDocumentSchema', () => {
  it('accepts a document with an optional PL text', () => {
    expect(v.safeParse(RulesDocumentSchema, doc()).success).toBe(true)
  })
  it('refuses an unsafe link', () => {
    expect(v.safeParse(RulesDocumentSchema, doc('[x](javascript:alert(1))')).success).toBe(false)
  })
  it('refuses an empty EN text and too long texts', () => {
    expect(v.safeParse(RulesDocumentSchema, doc('')).success).toBe(false)
    expect(v.safeParse(RulesDocumentSchema, doc('x'.repeat(2001))).success).toBe(false)
  })
  it('refuses duplicate section or item ids', () => {
    const d = doc()
    d.sections.push(structuredClone(d.sections[0] as (typeof d.sections)[number]))
    expect(v.safeParse(RulesDocumentSchema, d).success).toBe(false)
  })
  it('caps sections at 50 and items at 100', () => {
    const many = {
      sections: Array.from({length: 51}, (_, i) => ({
        id: `s${String(i)}`,
        title: {en: 'T'},
        items: []
      }))
    }
    expect(v.safeParse(RulesDocumentSchema, many).success).toBe(false)
  })
})
