import {messageArguments} from './placeholders'

describe('messageArguments', () => {
  it('collects arguments and rich-text tags, sorted and unique', () => {
    expect(messageArguments('Server <accent>rules</accent> for {name}, {name}')).toEqual([
      '<accent>',
      'name'
    ])
  })

  it('finds arguments inside plural branches', () => {
    expect(messageArguments('{count, plural, one {# rule in {section}} other {# rules}}')).toEqual([
      'count',
      'section'
    ])
  })

  it('is empty for plain text', () => {
    expect(messageArguments('Just text')).toEqual([])
  })

  it('throws on broken ICU', () => {
    expect(() => messageArguments('Hello {name')).toThrow()
  })
})
