import {Inject, Injectable, ServiceUnavailableException} from '@nestjs/common'

import type {CreateInvite, Invite, InviteLookup, Permission} from '@shop/shared/access'

import {assertCanGrant} from '../access/grant'
import {PermissionCache} from '../access/permission-cache'
import {authEnv} from '../auth/auth-env'
import {ContentService} from '../content/content.service'
import {siteBrand} from '../mailer/brand'
import type {Mailer} from '../mailer/mailer'
import {MAILER} from '../mailer/mailer'
import {inviteMail} from '../mailer/templates'
import {PrismaService} from '../prisma/prisma.service'
import {conflict, isOwnerRole, notFound, ownerProtected, unknownRole} from './errors'
import {INVITE_TTL_MS, hashInviteToken, newInviteToken} from './invite-token'

type Row = {
  id: string
  email: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  role: {id: string; name: string}
}

export const toInvite = (r: Row): Invite => ({
  id: r.id,
  email: r.email,
  role: {id: r.role.id, name: r.role.name},
  expiresAt: r.expiresAt.toISOString(),
  acceptedAt: r.acceptedAt?.toISOString() ?? null,
  revokedAt: r.revokedAt?.toISOString() ?? null
})

const isOpen = (r: Row, now: Date) => !r.acceptedAt && !r.revokedAt && r.expiresAt > now

const statusOf = (r: Omit<Row, 'role'>, now: Date): InviteLookup['status'] => {
  if (r.revokedAt) return 'revoked'
  if (r.acceptedAt) return 'used'
  return r.expiresAt > now ? 'valid' : 'expired'
}

/** Only an open invite (not accepted, not revoked) can be resent or revoked. */
const OPEN = {acceptedAt: null, revokedAt: null}

/**
 * Invites. The raw token exists only in the emailed link: responses, logs and audit rows see the
 * invite without it, and the database stores only its SHA-256.
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly cache: PermissionCache,
    private readonly content: ContentService
  ) {}

  async list(): Promise<Invite[]> {
    const rows = await this.prisma.invite.findMany({
      include: {role: true},
      orderBy: {createdAt: 'desc'}
    })
    const now = new Date()
    // Open invites first, newest first within each group (sort is stable).
    return rows.sort((a, b) => Number(isOpen(b, now)) - Number(isOpen(a, now))).map(toInvite)
  }

  async create(
    input: CreateInvite,
    invitedById: string,
    actor: readonly Permission[]
  ): Promise<Invite> {
    const role = await this.prisma.role.findUnique({where: {id: input.roleId}})
    if (!role) throw unknownRole()
    if (isOwnerRole(role)) throw ownerProtected()
    assertCanGrant(actor, (await this.cache.get(role.id)).permissions)
    if ((await this.prisma.user.count({where: {email: input.email}})) > 0)
      throw conflict('user_exists')
    const {token, tokenHash} = newInviteToken()
    const row = await this.prisma.invite.create({
      data: {
        email: input.email,
        roleId: role.id,
        tokenHash,
        invitedById,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS)
      },
      include: {role: true}
    })
    await this.send(row.email, token, role.name)
    return toInvite(row)
  }

  async resend(id: string, actor: readonly Permission[]): Promise<Invite> {
    const current = await this.prisma.invite.findUnique({where: {id}})
    if (current) assertCanGrant(actor, (await this.cache.get(current.roleId)).permissions)
    const {token, tokenHash} = newInviteToken()
    const {count} = await this.prisma.invite.updateMany({
      where: {id, ...OPEN},
      data: {tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS)}
    })
    if (count === 0) throw await this.whyNotOpen(id)
    const row = await this.prisma.invite.findUniqueOrThrow({where: {id}, include: {role: true}})
    await this.send(row.email, token, row.role.name)
    return toInvite(row)
  }

  async revoke(id: string, before: (v: Invite) => void): Promise<Invite> {
    const current = await this.prisma.invite.findUnique({where: {id}, include: {role: true}})
    if (!current) throw notFound()
    const {count} = await this.prisma.invite.updateMany({
      where: {id, ...OPEN},
      data: {revokedAt: new Date()}
    })
    if (count === 0) throw await this.whyNotOpen(id)
    before(toInvite(current))
    const row = await this.prisma.invite.findUniqueOrThrow({where: {id}, include: {role: true}})
    return toInvite(row)
  }

  /** Anonymous: the invite page shows the email and whether the link still works. */
  async lookup(token: string): Promise<InviteLookup | null> {
    const row = await this.prisma.invite.findUnique({where: {tokenHash: hashInviteToken(token)}})
    return row ? {email: row.email, status: statusOf(row, new Date())} : null
  }

  private async whyNotOpen(id: string) {
    return (await this.prisma.invite.count({where: {id}})) > 0
      ? conflict('invite_closed')
      : notFound()
  }

  private async send(email: string, token: string, roleName: string) {
    const link = `${authEnv(process.env).baseURL}/invite/${token}`
    try {
      await this.mailer.send({
        to: email,
        ...(await inviteMail(link, roleName, await siteBrand(this.content)))
      })
    } catch (error) {
      // The invite stays open; "resend" mails a fresh link. Never log the link itself.
      console.error('mail: invite failed', error instanceof Error ? error.message : error)
      throw new ServiceUnavailableException({statusCode: 503, message: 'mail_failed'})
    }
  }
}
