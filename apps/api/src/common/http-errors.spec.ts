import {badRequest, inUse, serviceUnavailable, stale} from './http-errors'

describe('http errors', () => {
  it('builds the API error shape', () => {
    expect(stale().getStatus()).toBe(409)
    expect(stale().getResponse()).toEqual({statusCode: 409, message: 'stale'})
    expect(inUse({products: 3}).getResponse()).toEqual({
      statusCode: 409,
      message: 'in_use',
      issues: {products: 3}
    })
    expect(badRequest('incomplete', {missing: ['price.PLN']}).getResponse()).toEqual({
      statusCode: 400,
      message: 'incomplete',
      issues: {missing: ['price.PLN']}
    })
    expect(serviceUnavailable('rcon_key_missing').getStatus()).toBe(503)
  })
})
