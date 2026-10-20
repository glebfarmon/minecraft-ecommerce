import * as v from 'valibot'

import {
  type RichNode,
  RulesDocumentSchema,
  hasOnlySafeLinks,
  parseRich,
  toMarkdown,
  toPlainText
} from './rules'

const text = (value: string): RichNode => ({type: 'text', value})
const strong = (...children: RichNode[]): RichNode => ({type: 'strong', children})
const em = (...children: RichNode[]): RichNode => ({type: 'em', children})
const u = (...children: RichNode[]): RichNode => ({type: 'u', children})
const link = (href: string, ...children: RichNode[]): RichNode => ({type: 'link', href, children})

describe('parseRich', () => {
  it('returns plain text as one node', () => {
    expect(parseRich('No spam.')).toEqual([text('No spam.')])
    expect(parseRich('')).toEqual([])
  })

  it('parses bold, italic and underline in order', () => {
    expect(parseRich('a **b** *c* ++d++')).toEqual([
      text('a '),
      strong(text('b')),
      text(' '),
      em(text('c')),
      text(' '),
      u(text('d'))
    ])
  })

  it('parses links, https and site paths', () => {
    expect(
      parseRich('see [refunds](/legal/refunds.en.pdf), [Discord](https://discord.com).')
    ).toEqual([
      text('see '),
      link('/legal/refunds.en.pdf', text('refunds')),
      text(', '),
      link('https://discord.com', text('Discord')),
      text('.')
    ])
  })

  it('nests marks', () => {
    expect(parseRich('**bold *both***')).toEqual([strong(text('bold '), em(text('both')))])
    expect(parseRich('++[x](/faq)++')).toEqual([u(link('/faq', text('x')))])
    expect(parseRich('[**x**](/a)')).toEqual([link('/a', strong(text('x')))])
  })

  it.each([
    ['**bold', '**bold'],
    ['a ++b', 'a ++b'],
    ['*a**', '*a**'],
    ['2 * 3', '2 * 3'],
    ['[x](/a', '[x](/a'],
    ['<b>x</b>', '<b>x</b>']
  ])('keeps %s literal when it does not close', (source, literal) => {
    expect(parseRich(source)).toEqual([text(literal)])
  })

  it('does not swallow what follows an unclosed opener', () => {
    expect(parseRich('**a *b* c')).toEqual([text('**a '), em(text('b')), text(' c')])
  })

  it('removes escapes', () => {
    expect(parseRich('\\*not\\* \\[x\\](/y)')).toEqual([text('*not* [x](/y)')])
    expect(parseRich('back\\slash')).toEqual([text('back\\slash')])
  })

  it('leaves links literal with links: false', () => {
    expect(parseRich('[x](/a)', {links: false})).toEqual([text('[x](/a)')])
  })

  it.each([
    'javascript:alert%281%29',
    'http://example.com',
    '//evil.example',
    '/\\evil.example',
    'data:text/html,x'
  ])('turns a link to %s into its plain label', href => {
    expect(parseRich(`[click](${href})`)).toEqual([text('click')])
  })

  it('keeps the formatting of an unsafe link label', () => {
    expect(parseRich('[**x**](//evil)')).toEqual([strong(text('x'))])
  })

  it('never makes a link when the URL has a ")" (it ends the URL)', () => {
    const nodes = parseRich('[x](javascript:alert(1))')
    expect(JSON.stringify(nodes)).not.toContain('"link"')
    expect(toPlainText(nodes)).toBe('x)')
  })
})

describe('parseRich limits', () => {
  it('survives deeply nested markup without overflowing the stack', () => {
    const nested = '*++**'.repeat(2000)
    expect(() => parseRich(nested)).not.toThrow()
    expect(toPlainText(parseRich(nested)).length).toBeGreaterThan(0)
  })

  it('keeps a link without a label literal', () => {
    expect(parseRich('[](/x)')).toEqual([text('[](/x)')])
  })
})

describe('toPlainText', () => {
  it('drops markup and URLs but keeps link labels and unescapes', () => {
    expect(toPlainText(parseRich('**Bold** and [Discord](https://discord.com). \\*b'))).toBe(
      'Bold and Discord. *b'
    )
  })
})

describe('toMarkdown', () => {
  it.each(['plain', '**a** *b* ++c++', '**x *y***', '[l](/p)', 'lit \\* \\+ \\[ \\] \\( \\) \\\\'])(
    'round-trips %s',
    source => {
      const tree = parseRich(source)
      expect(parseRich(toMarkdown(tree))).toEqual(tree)
    }
  )

  it('escapes markup characters in text', () => {
    expect(toMarkdown([text('2*3 [a](b) + \\')])).toBe('2\\*3 \\[a\\]\\(b\\) \\+ \\\\')
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
    '[a](/\\evil.com)',
    '[a](http://x.io)',
    '[a](data:text/html,x)'
  ])('refuses %s', t => {
    expect(hasOnlySafeLinks(t)).toBe(false)
  })
  it('ignores an escaped bracket', () => {
    expect(hasOnlySafeLinks('\\[a\\](javascript:x)')).toBe(true)
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
