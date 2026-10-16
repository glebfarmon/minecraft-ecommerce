import {apiErrorMessage} from './error-message'

describe('apiErrorMessage', () => {
  it.each([
    ['stale', 'Someone else changed this. Reload the page to see their version.'],
    ['in_use', 'This is still in use. Move or delete what uses it first.'],
    ['incomplete', 'Add both prices and both translations before enabling.'],
    ['slug_locked', 'Disable it first: the slug and server are in shoppers’ links and carts.'],
    ['slug_taken', 'That slug is already used.'],
    ['rcon_host_private', 'Use the game server’s public address, not an internal one.'],
    ['rcon_key_missing', 'RCON is not configured on the server (RCON_ENCRYPTION_KEY).'],
    ['role_in_use', 'This role is still assigned to admins or open invites. Move them first.']
  ])('explains %s', (code, text) => {
    expect(apiErrorMessage({status: 409, data: {message: code}})).toBe(text)
  })

  it('explains a body too large for the API (413)', () => {
    expect(apiErrorMessage({status: 413, data: 'PayloadTooLargeError'})).toBe(
      'The rules are too long to save in one go.'
    )
  })

  it('explains a body the API refused as invalid', () => {
    expect(apiErrorMessage({status: 400, data: {message: 'Validation failed', issues: {}}})).toBe(
      'Some fields are invalid. Check the form and try again.'
    )
  })

  it('adds the counts of an in_use answer', () => {
    expect(apiErrorMessage({status: 409, data: {message: 'in_use', issues: {products: 3}}})).toBe(
      'This is still in use: 3 products. Move or delete them first.'
    )
  })

  it('lists the expected placeholders and tags for placeholder_mismatch', () => {
    const error = {
      status: 422,
      data: {message: 'placeholder_mismatch', issues: {expected: ['{nick}', '<accent>'], found: []}}
    }
    expect(apiErrorMessage(error)).toBe(
      'Keep the same placeholders and tags as the original: {nick}, <accent>'
    )
  })
})
