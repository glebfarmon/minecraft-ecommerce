import {SYSTEM_ROLES, type SystemRoleName} from '@shop/shared/access'

import {ContentService} from '../content/content.service'
import {siteBrand} from '../mailer/brand'
import type {Mailer} from '../mailer/mailer'
import {inviteMail} from '../mailer/templates'
import type {PrismaService} from '../prisma/prisma.service'
import {INVITE_TTL_MS, newInviteToken} from '../team/invite-token'

/** System roles, then an invite for ADMIN_OWNER_EMAIL unless that person exists or has an open invite. */
export async function seedAccess(
  prisma: PrismaService,
  mailer: Mailer,
  adminUrl: string
): Promise<{ownerInviteUrl: string | null}> {
  for (const [name, permissions] of Object.entries(SYSTEM_ROLES) as [
    SystemRoleName,
    readonly string[]
  ][]) {
    await prisma.role.upsert({
      where: {name},
      update: {isSystem: true},
      create: {name, permissions: [...permissions], isSystem: true}
    })
  }

  const email = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase()
  if (!email) return {ownerInviteUrl: null}
  const exists = await prisma.user.count({where: {email}})
  const open = await prisma.invite.count({
    where: {email, acceptedAt: null, revokedAt: null, expiresAt: {gt: new Date()}}
  })
  if (exists > 0 || open > 0) return {ownerInviteUrl: null}

  const owner = await prisma.role.findUniqueOrThrow({where: {name: 'OWNER'}})
  const {token, tokenHash} = newInviteToken()
  await prisma.invite.create({
    data: {email, roleId: owner.id, tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS)}
  })
  const ownerInviteUrl = `${adminUrl}/invite/${token}`
  // The link is printed by the seed, so a mail failure must not lose it (rerun sees an open invite).
  try {
    await mailer.send({
      to: email,
      ...(await inviteMail(ownerInviteUrl, 'OWNER', await siteBrand(new ContentService(prisma))))
    })
  } catch (error) {
    console.error('seed: owner invite mail failed; use the printed link', error)
  }
  return {ownerInviteUrl}
}
