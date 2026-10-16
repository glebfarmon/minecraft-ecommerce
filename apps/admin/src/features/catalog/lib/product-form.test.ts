import {missingForActive} from '@shop/shared/catalog-admin'

import {emptyProductForm, formToCreate, formToUpdate, productToForm} from './product-form'

const product = {
  id: 'p1',
  version: 3,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'vip',
  kind: 'TIMED' as const,
  durationDays: 30,
  mark: 'VIP',
  icon: 'crown' as const,
  isActive: true,
  grantCommands: ['lp user {nick} parent add vip', 'say hi {nick}'],
  revokeCommands: ['lp user {nick} parent remove vip'],
  prices: {EUR: 499, PLN: 2199},
  translations: {
    en: {
      name: 'VIP',
      description: 'Fly',
      sections: [{title: 'Perks', entries: [{cmd: '/fly', cooldown: '5m'}]}]
    },
    pl: null
  },
  missing: ['translation.pl' as const]
}

describe('product form mapping', () => {
  it('round-trips a product through the form', () => {
    const form = productToForm(product)
    expect(form.prices).toEqual({EUR: '4.99', PLN: '21.99'})
    expect(form.grant).toBe('lp user {nick} parent add vip\nsay hi {nick}')
    expect(form.durationDays).toBe('30')
    const body = formToUpdate(form, 3)
    expect(body).toMatchObject({
      version: 3,
      isActive: true,
      durationDays: 30,
      grantCommands: product.grantCommands,
      prices: {EUR: 499, PLN: 2199},
      translations: {en: product.translations.en, pl: null}
    })
  })

  it('treats an empty translation tab as missing and drops blank lines and entry fields', () => {
    const form = emptyProductForm('s1', 'c1')
    form.slug = 'kit'
    form.mark = 'KIT'
    form.grant = '\n give {nick} bread 1 \n\n'
    form.prices.EUR = '1'
    form.translations.en = {
      name: 'Kit',
      description: '',
      sections: [{title: 'X', entries: [{cmd: '', text: 'Bread', cooldown: ''}]}]
    }
    const body = formToCreate(form)
    expect(body.grantCommands).toEqual(['give {nick} bread 1'])
    expect(body.durationDays).toBeNull()
    expect(body.translations.pl).toBeNull()
    expect(body.translations.en?.sections).toEqual([{title: 'X', entries: [{text: 'Bread'}]}])
    expect(missingForActive(body)).toEqual(['price.PLN', 'translation.pl'])
  })
})
