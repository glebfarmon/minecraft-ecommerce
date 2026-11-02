import type {Logger} from '@nestjs/common'

import type {PrismaService} from '../prisma/prisma.service'
import type {Mail, Mailer} from './mailer'

/** The admin app's origin, for links in owner mail (the Better Auth base URL). */
export const adminOrigin = () => process.env.BETTER_AUTH_URL ?? ''

/**
 * Sends one mail to every active OWNER. A failure for one recipient is logged as `<what> to
 * <email> not sent` and the others still get theirs; the owner lookup itself may throw.
 */
export async function mailOwners(
  prisma: PrismaService,
  mailer: Mailer,
  mail: Omit<Mail, 'to'>,
  log: Logger,
  what: string
): Promise<void> {
  const owners = await prisma.user.findMany({
    where: {disabledAt: null, role: {name: 'OWNER'}},
    select: {email: true}
  })
  for (const {email} of owners) {
    try {
      await mailer.send({...mail, to: email})
    } catch (error) {
      log.error(`${what} to ${email} not sent`, error)
    }
  }
}
