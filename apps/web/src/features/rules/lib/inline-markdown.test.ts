import {parseInline, toPlainText} from './inline-markdown'

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
