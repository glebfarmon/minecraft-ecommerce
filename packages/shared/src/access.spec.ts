import * as v from 'valibot'

import {
  CreateInviteSchema,
  PERMISSIONS,
  RoleInputSchema,
  SYSTEM_ROLES,
  hasPermission
} from './access'

describe('access contract', () => {
  it('gives the owner every permission', () => {
    expect([...SYSTEM_ROLES.OWNER].sort()).toEqual([...PERMISSIONS].sort())
    expect(SYSTEM_ROLES.ADMIN).toEqual([
      'admin.invite',
      'audit.read',
      'catalog.write',
      'server.rcon',
      'content.write',
      'order.read'
    ])
    expect(SYSTEM_ROLES.SUPPORT).toEqual(['order.read'])
  })

  it('lets admin and support read orders', () => {
    expect(SYSTEM_ROLES.ADMIN).toContain('order.read')
    expect(SYSTEM_ROLES.SUPPORT).toContain('order.read')
  })

  it('checks a permission', () => {
    expect(hasPermission(['audit.read'], 'audit.read')).toBe(true)
    expect(hasPermission(['audit.read'], 'role.write')).toBe(false)
  })

  it('normalises an invite email', () => {
    expect(v.parse(CreateInviteSchema, {email: ' Ann@Example.COM ', roleId: 'r1'})).toEqual({
      email: 'ann@example.com',
      roleId: 'r1'
    })
    expect(v.safeParse(CreateInviteSchema, {email: 'nope', roleId: 'r1'}).success).toBe(false)
  })

  it('rejects unknown permissions and odd role names', () => {
    expect(v.safeParse(RoleInputSchema, {name: 'Editor', permissions: ['root']}).success).toBe(
      false
    )
    expect(v.safeParse(RoleInputSchema, {name: 'x', permissions: []}).success).toBe(false)
    expect(v.parse(RoleInputSchema, {name: ' Editor ', permissions: ['audit.read']})).toEqual({
      name: 'Editor',
      permissions: ['audit.read']
    })
  })
})

describe('catalog permissions', () => {
  it('lists the catalog permissions', () => {
    expect(PERMISSIONS).toEqual(
      expect.arrayContaining(['catalog.write', 'server.rcon', 'content.write'])
    )
    expect(SYSTEM_ROLES.SUPPORT).toEqual(['order.read'])
  })
})
