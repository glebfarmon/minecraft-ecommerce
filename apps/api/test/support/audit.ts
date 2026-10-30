import type {Prisma} from '../../src/generated/prisma/client'
import type {PrismaService} from '../../src/prisma/prisma.service'

/**
 * The audit interceptor writes its row after the response is sent, so a test polls for it:
 * returns the rows matching `where` (oldest first) once there are at least `n`.
 */
export async function waitForAuditRows(
  prisma: PrismaService,
  where: Prisma.AuditLogWhereInput,
  n: number
) {
  for (let i = 0; i < 50; i += 1) {
    const rows = await prisma.auditLog.findMany({where, orderBy: {createdAt: 'asc'}})
    if (rows.length >= n) return rows
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`expected ${String(n)} audit rows`)
}
