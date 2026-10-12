import {Inject, Injectable} from '@nestjs/common'

import type {Admin} from '@shop/shared/access'

import type {Mailer} from '../mailer/mailer'
import {MAILER} from '../mailer/mailer'
import {twoFactorResetMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'
import {isOwnerRole, notFound, ownerProtected, unknownRole} from './errors'

type UserWithRole = {
  id: string
  email: string
  name: string
  twoFactorEnabled: boolean
  disabledAt: Date | null
  role: {id: string; name: string; isSystem: boolean} | null
}

export const toAdmin = (u: UserWithRole): Admin => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: {id: u.role?.id ?? '', name: u.role?.name ?? ''},
  twoFactorEnabled: u.twoFactorEnabled,
  disabledAt: u.disabledAt?.toISOString() ?? null
})

/**
 * Team members. Users are never deleted (audit rows point at them); every change that alters what
 * a person may do ends all of their sessions (spec §5 Sessions).
 */
@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer
  ) {}

  private async find(id: string): Promise<UserWithRole> {
    const user = await this.prisma.user.findUnique({where: {id}, include: {role: true}})
    if (!user) throw notFound()
    return user
  }

  async list(): Promise<Admin[]> {
    const users = await this.prisma.user.findMany({
      where: {roleId: {not: null}},
      include: {role: true},
      orderBy: {createdAt: 'asc'}
    })
    return users.map(toAdmin)
  }

  async changeRole(id: string, roleId: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    if (isOwnerRole(user.role)) throw ownerProtected()
    const target = await this.prisma.role.findUnique({where: {id: roleId}})
    if (!target) throw unknownRole()
    if (isOwnerRole(target)) throw ownerProtected()
    before(toAdmin(user))
    const [, updated] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({where: {id}, data: {roleId}, include: {role: true}})
    ])
    return toAdmin(updated)
  }

  /**
   * Better Auth treats `twoFactorEnabled` or a verified `twoFactor` row as enrolled, so both are
   * cleared; the next sign-in starts TOTP setup again.
   */
  async resetTwoFactor(id: string, actorId: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    if (isOwnerRole(user.role) && actorId !== id) throw ownerProtected()
    before(toAdmin(user))
    const [, , updated] = await this.prisma.$transaction([
      this.prisma.twoFactor.deleteMany({where: {userId: id}}),
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({
        where: {id},
        data: {twoFactorEnabled: false},
        include: {role: true}
      })
    ])
    // The reset has happened; a mail failure is logged, not turned into an error.
    try {
      await this.mailer.send({to: user.email, ...(await twoFactorResetMail())})
    } catch (error) {
      console.error('mail: 2fa reset notice failed', error)
    }
    return toAdmin(updated)
  }

  async disable(id: string, before: (v: Admin) => void): Promise<Admin> {
    const user = await this.find(id)
    if (isOwnerRole(user.role)) throw ownerProtected()
    before(toAdmin(user))
    const [, updated] = await this.prisma.$transaction([
      this.prisma.session.deleteMany({where: {userId: id}}),
      this.prisma.user.update({
        where: {id},
        data: {disabledAt: user.disabledAt ?? new Date()},
        include: {role: true}
      })
    ])
    return toAdmin(updated)
  }
}
