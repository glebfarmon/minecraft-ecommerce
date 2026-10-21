import {createTranslator} from 'next-intl'

import en from '../../../messages/en.json'
import pl from '../../../messages/pl.json'
import {apiErrorMessage} from './error-message'

const tEn = createTranslator({locale: 'en', messages: en, namespace: 'apiErrors'})
const tPl = createTranslator({locale: 'pl', messages: pl, namespace: 'apiErrors'})
const asFn = (t: typeof tEn) => t as unknown as Parameters<typeof apiErrorMessage>[1]
const english = asFn(tEn)
const polish = asFn(tPl)

describe('apiErrorMessage', () => {
  it.each([
    ['stale', 'Someone else changed this. Reload the page to see their version.'],
    ['in_use', 'This is still in use. Move or delete what uses it first.'],
    ['incomplete', 'Add both prices and both translations before enabling.'],
    ['slug_locked', 'Disable it first: the slug and server are in shoppers’ links and carts.'],
    ['slug_taken', 'That slug is already used.'],
    ['rcon_host_private', 'Use the game server’s public address, not an internal one.'],
    ['rcon_key_missing', 'RCON is not configured on the server (RCON_ENCRYPTION_KEY).'],
    ['role_in_use', 'This role is still assigned to admins or open invites. Move them first.'],
    [
      'promo_locked',
      'This code has been used, so its text, discount and scope cannot change. Create a new code instead.'
    ],
    ['max_uses_below_used', 'Max uses cannot be below the times the code was already used.'],
    ['code_taken', 'That code is already in use. Pick another one.']
  ])('explains %s', (code, text) => {
    expect(apiErrorMessage({status: 409, data: {message: code}}, english)).toBe(text)
  })

  it('explains a body too large for the API (413)', () => {
    expect(apiErrorMessage({status: 413, data: 'PayloadTooLargeError'}, english)).toBe(
      'The rules are too long to save in one go.'
    )
  })

  it('explains a body the API refused as invalid', () => {
    expect(
      apiErrorMessage({status: 400, data: {message: 'Validation failed', issues: {}}}, english)
    ).toBe('Some fields are invalid. Check the form and try again.')
  })

  it('adds the counts of an in_use answer', () => {
    expect(
      apiErrorMessage({status: 409, data: {message: 'in_use', issues: {products: 3}}}, english)
    ).toBe('This is still in use: 3 products. Move or delete them first.')
  })

  it('lists the expected placeholders and tags for placeholder_mismatch', () => {
    const error = {
      status: 422,
      data: {message: 'placeholder_mismatch', issues: {expected: ['{nick}', '<accent>'], found: []}}
    }
    expect(apiErrorMessage(error, english)).toBe(
      'Keep the same placeholders and tags as the original: {nick}, <accent>'
    )
  })

  it('falls back to the generic sentence for an unknown code', () => {
    expect(apiErrorMessage({status: 500, data: {message: 'brand_new_code'}}, english)).toBe(
      'Something went wrong. Try again.'
    )
    expect(apiErrorMessage(undefined, polish)).toBe('Coś poszło nie tak. Spróbuj ponownie.')
  })
})

describe('apiErrorMessage in Polish', () => {
  it('translates the code', () => {
    expect(apiErrorMessage({status: 409, data: {message: 'stale'}}, polish)).toBe(
      'Ktoś inny to zmienił. Odśwież stronę, aby zobaczyć jego wersję.'
    )
  })

  it.each([
    [1, '1 produkt'],
    [2, '2 produkty'],
    [5, '5 produktów'],
    [22, '22 produkty'],
    [12, '12 produktów']
  ])('uses the Polish plural for %i products', (count, phrase) => {
    const error = {status: 409, data: {message: 'in_use', issues: {products: count}}}
    expect(apiErrorMessage(error, polish)).toContain(phrase)
  })

  it('joins several counts', () => {
    const error = {status: 409, data: {message: 'in_use', issues: {products: 2, servers: 1}}}
    expect(apiErrorMessage(error, polish)).toBe(
      'To jest nadal używane: 2 produkty, 1 serwer. Najpierw przenieś lub usuń te elementy.'
    )
  })
})
