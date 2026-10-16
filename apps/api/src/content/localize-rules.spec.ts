import {localizeRules} from './localize-rules'

const doc = {
  sections: [
    {
      id: 's1',
      title: {en: 'General', pl: 'Ogólne'},
      items: [
        {id: 'i1', text: {en: 'Be nice', pl: ''}},
        {id: 'i2', text: {en: 'No cheats', pl: 'Bez cheatów'}}
      ]
    }
  ]
}

describe('localizeRules', () => {
  it('uses PL where present and falls back to EN with lang en', () => {
    const r = localizeRules(doc, new Date('2026-10-16T08:00:00Z'), 'pl')
    expect(r.publishedAt).toBe('2026-10-16T08:00:00.000Z')
    expect(r.sections[0]?.title).toEqual({value: 'Ogólne', lang: 'pl'})
    expect(r.sections[0]?.items).toEqual([
      {id: 'i1', text: {value: 'Be nice', lang: 'en'}},
      {id: 'i2', text: {value: 'Bez cheatów', lang: 'pl'}}
    ])
  })

  it('returns EN as EN', () => {
    expect(localizeRules(doc, new Date(), 'en').sections[0]?.title).toEqual({
      value: 'General',
      lang: 'en'
    })
  })
})
