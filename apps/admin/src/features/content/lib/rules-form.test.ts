import type {RulesDocument} from '@shop/shared/rules'

import {documentToForm, emptyItem, emptySection, formToDocument} from './rules-form'

const doc: RulesDocument = {
  sections: [
    {
      id: 'general',
      title: {en: 'General', pl: 'Ogólne'},
      items: [
        {id: 'general-1', text: {en: 'Be **kind**.', pl: 'Bądź *miły*.'}},
        {id: 'general-2', text: {en: 'No cheating.'}}
      ]
    },
    {id: 'chat', title: {en: 'Chat'}, items: []}
  ]
}

describe('rules form', () => {
  it('round-trips a document and creates unique ids', () => {
    const form = documentToForm(doc)
    expect(form.sections[1]?.title).toEqual({en: 'Chat', pl: ''})
    expect(formToDocument(form)).toEqual(doc)

    const [general, chat] = form.sections as [
      (typeof form.sections)[number],
      (typeof form.sections)[number]
    ]
    const added = {...emptySection(), title: {en: 'General!', pl: ''}, items: [emptyItem()]}
    const ids = formToDocument({
      sections: [
        {...general, items: [...general.items, emptyItem()]},
        chat,
        added,
        {...emptySection(), title: {en: 'Zażółć gęślą jaźń', pl: ''}}
      ]
    }).sections

    // "general" is taken by the first section and "general-2" by one of its rules.
    expect(ids[2]?.id).toBe('general-3')
    expect(ids[2]?.items.map(i => i.id)).toEqual(['general-3-1'])
    // The third rule of "general" would be "general-3", which the new section now holds.
    expect(ids[0]?.items.map(i => i.id)).toEqual(['general-1', 'general-2', 'general-4'])
    expect(ids[3]?.id).toBe('zazolc-gesla-jazn')
    const all = ids.flatMap(s => [s.id, ...s.items.map(i => i.id)])
    expect(new Set(all).size).toBe(all.length)
    for (const id of all) expect(id).toMatch(/^[a-z0-9-]{1,60}$/)
  })
})
