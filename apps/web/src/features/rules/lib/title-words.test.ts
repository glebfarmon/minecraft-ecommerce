import {titleWords} from './title-words'

describe('titleWords', () => {
  it('splits a title into words and keeps which ones are accented', () => {
    expect(titleWords('Server <accent>rules</accent>')).toEqual([
      {text: 'Server', accent: false},
      {text: 'rules', accent: true}
    ])
  })

  it('handles several words on both sides and stray spaces', () => {
    expect(titleWords('  Zasady   <accent>naszego serwera</accent> ')).toEqual([
      {text: 'Zasady', accent: false},
      {text: 'naszego', accent: true},
      {text: 'serwera', accent: true}
    ])
  })

  it('works without an accent', () => {
    expect(titleWords('Rules')).toEqual([{text: 'Rules', accent: false}])
  })
})
