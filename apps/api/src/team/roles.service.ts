import {Injectable} from '@nestjs/common'

import type {Role, RoleInput} from '@shop/shared/access'

import {PermissionCache, resolveRole} from '../access/permission-cache'
import {Prisma} from '../generated/prisma/client'
import {PrismaService} from '../prisma/prisma.service'
import {conflict, notFound, ownerProtected} from './errors'

type RoleRow = {id: string; name: string; isSystem: boolean; permissions: string[]}

/** As the guard sees it: OWNER lists every permission, unknown strings are dropped. */
const toRole = (r: RoleRow): Role => ({id: r.id, ...resolveRole(r)})

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

const nameTaken = (error: unknown): never => {
  if (isPrismaError(error, 'P2002')) throw conflict('role_name_taken')
  throw error
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCache
  ) {}

  /** System roles cannot be edited or deleted (spec decision #7, §7.4). */
  private async editable(id: string): Promise<RoleRow> {
    const current = await this.prisma.role.findUnique({where: {id}})
    if (!current) throw notFound()
    if (current.isSystem) throw ownerProtected()
    return current
  }

  async list(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({orderBy: [{isSystem: 'desc'}, {name: 'asc'}]})
    return rows.map(toRole)
  }

  async create(input: RoleInput): Promise<Role> {
    const row = await this.prisma.role
      .create({data: {name: input.name, permissions: [...new Set(input.permissions)]}})
      .catch(nameTaken)
    return toRole(row)
  }

  /** Ends the sessions of everyone holding the role, so the change applies at their next sign-in. */
  async update(id: string, input: RoleInput, before: (r: Role) => void): Promise<Role> {
    const current = await this.editable(id)
    before(toRole(current))
    const [row] = await this.prisma
      .$transaction([
        this.prisma.role.update({
          where: {id},
          data: {name: input.name, permissions: [...new Set(input.permissions)]}
        }),
        this.prisma.session.deleteMany({where: {user: {roleId: id}}})
      ])
      .catch(nameTaken)
    await this.cache.invalidate(id)
    return toRole(row)
  }

  async remove(id: string, before: (r: Role) => void): Promise<void> {
    const current = await this.editable(id)
    const inUse =
      (await this.prisma.user.count({where: {roleId: id}})) +
      (await this.prisma.invite.count({where: {roleId: id, acceptedAt: null, revokedAt: null}}))
    if (inUse > 0) throw conflict('role_in_use')
    before(toRole(current))
    // Accepted and revoked invites still reference the role (FK Restrict) and go with it; the
    // audit log keeps their history. A user or invite added meanwhile fails the delete instead.
    await this.prisma
      .$transaction([
        this.prisma.invite.deleteMany({
          where: {roleId: id, OR: [{acceptedAt: {not: null}}, {revokedAt: {not: null}}]}
        }),
        this.prisma.role.delete({where: {id}})
      ])
      .catch((error: unknown) => {
        if (isPrismaError(error, 'P2003')) throw conflict('role_in_use')
        throw error
      })
    await this.cache.invalidate(id)
  }
}
