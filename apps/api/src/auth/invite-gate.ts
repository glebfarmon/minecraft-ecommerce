import type {PrismaService} from '../prisma/prisma.service'

const openInvite = (email: string) => ({
  email: email.toLowerCase(),
  acceptedAt: null,
  revokedAt: null,
  expiresAt: {gt: new Date()}
})

/**
 * `user.create.before`: only an email with an open invite (not expired, revoked or accepted) may
 * become a user, and it gets the invite's role. Every sign-in method (email code, Google, Apple)
 * creates users through this hook.
 */
export function inviteGate(prisma: PrismaService) {
  return async (user: {email: string}): Promise<{data: {roleId: string}} | false> => {
    const invite = await prisma.invite.findFirst({
      where: openInvite(user.email),
      orderBy: {createdAt: 'desc'}
    })
    return invite ? {data: {roleId: invite.roleId}} : false
  }
}

/** `user.create.after`: runs once the user row exists, so a failed insert never burns the invite. */
export function acceptInvite(prisma: PrismaService) {
  return async (user: {email: string; roleId?: string | null}): Promise<void> => {
    const invite = await prisma.invite.findFirst({
      where: {...openInvite(user.email), ...(user.roleId ? {roleId: user.roleId} : {})},
      orderBy: {createdAt: 'desc'}
    })
    if (invite) await prisma.invite.update({where: {id: invite.id}, data: {acceptedAt: new Date()}})
  }
}
