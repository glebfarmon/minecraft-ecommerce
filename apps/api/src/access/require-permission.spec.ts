import {ForbiddenException} from '@nestjs/common'
import {Reflector} from '@nestjs/core'

import {PermissionGuard, RequirePermission} from './require-permission'

class Probe {
  @RequirePermission('audit.read', 'role.write')
  both(): void {}

  open(): void {}
}

const handler = (name: 'both' | 'open') =>
  Object.getOwnPropertyDescriptor(Probe.prototype, name)?.value as unknown

const ctx = (name: 'both' | 'open', permissions: string[]) =>
  ({
    getHandler: () => handler(name),
    getClass: () => Probe,
    switchToHttp: () => ({getRequest: () => ({admin: {permissions}})})
  }) as never

describe('PermissionGuard', () => {
  const guard = new PermissionGuard(new Reflector())

  it('lets a route without requirements through', () => {
    expect(guard.canActivate(ctx('open', []))).toBe(true)
  })

  it('needs every listed permission', () => {
    expect(guard.canActivate(ctx('both', ['audit.read', 'role.write']))).toBe(true)
    const err = (() => {
      try {
        guard.canActivate(ctx('both', ['audit.read']))
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(ForbiddenException)
    expect((err as ForbiddenException).getResponse()).toEqual({
      statusCode: 403,
      message: 'forbidden'
    })
  })
})
