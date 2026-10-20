import {fromDoc, toDoc} from './markdown-doc'

type Run = {text?: string; marks?: {type: string}[]; type: string}
const runs = (doc: ReturnType<typeof toDoc>) => (doc.content?.[0]?.content ?? []) as Run[]

describe('toDoc', () => {
  it('maps marks to text nodes', () => {
    const nodes = runs(toDoc('**a** ++b++', {multiline: false, links: false}))
    expect(nodes.map(n => [n.text, n.marks?.map(m => m.type)])).toEqual([
      ['a', ['bold']],
      [' ', undefined],
      ['b', ['underline']]
    ])
  })

  it('turns a newline into a hard break only when multiline', () => {
    expect(runs(toDoc('a\nb', {multiline: true, links: false})).map(n => n.type)).toEqual([
      'text',
      'hardBreak',
      'text'
    ])
    expect(runs(toDoc('a\nb', {multiline: false, links: false})).map(n => n.type)).toEqual(['text'])
  })

  it('is an empty paragraph for an empty string', () => {
    expect(toDoc('', {multiline: false, links: false})).toEqual({
      type: 'doc',
      content: [{type: 'paragraph'}]
    })
  })
})

describe('fromDoc', () => {
  it.each(['plain', '**a** *b* ++c++', '**x *y***', 'line\nnext', 'lit \\* \\+'])(
    'round-trips %j',
    source => {
      const opts = {multiline: true, links: false}
      expect(fromDoc(toDoc(source, opts))).toBe(source)
    }
  )

  it('round-trips a link when links are on', () => {
    expect(fromDoc(toDoc('[l](/p)', {multiline: false, links: true}))).toBe('[l](/p)')
  })

  it('keeps link syntax literal when links are off', () => {
    expect(fromDoc(toDoc('[l](/p)', {multiline: false, links: false}))).toBe('\\[l\\]\\(/p\\)')
  })

  it('joins pasted paragraphs with a newline', () => {
    const doc = {
      type: 'doc',
      content: [
        {type: 'paragraph', content: [{type: 'text', text: 'a'}]},
        {type: 'paragraph', content: [{type: 'text', text: 'b'}]}
      ]
    }
    expect(fromDoc(doc)).toBe('a\nb')
  })

  it.each(['/a b', 'https://x.io/a(b)'])('drops a link whose href %j cannot be written', href => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{type: 'text', text: 'l', marks: [{type: 'link', attrs: {href}}]}]
        }
      ]
    }
    expect(fromDoc(doc)).toBe('l')
  })
})
