import {ForbiddenException} from '@nestjs/common'

import {PERMISSIONS} from '@shop/shared/access'

import {assertCanGrant, missingGrants} from './grant'

describe('missingGrants', () => {
  it('is empty when the request is a subset', () => {
    expect(missingGrants(['admin.invite', 'audit.read'], ['audit.read'])).toEqual([])
  })

  it('lists what the actor does not hold', () => {
    expect(missingGrants(['audit.read'], ['audit.read', 'role.write'])).toEqual(['role.write'])
  })

  it('accepts an empty request', () => {
    expect(missingGrants([], [])).toEqual([])
  })

  it('lets an OWNER-expanded actor grant anything', () => {
    expect(missingGrants(PERMISSIONS, PERMISSIONS)).toEqual([])
  })
})

describe('assertCanGrant', () => {
  it('passes for a subset', () => {
    expect(() => {
      assertCanGrant(['audit.read'], ['audit.read'])
    }).not.toThrow()
  })

  it('throws 403 cannot_grant otherwise', () => {
    let error: unknown
    try {
      assertCanGrant(['audit.read'], ['role.write'])
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getResponse()).toEqual({
      statusCode: 403,
      message: 'cannot_grant'
    })
  })
})
