import {stale} from '../common/http-errors'
import {Prisma} from '../generated/prisma/client'
import type {PrismaService} from '../prisma/prisma.service'

export const isPrismaError = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

/** A reorder sends every id of the list; a different set means the client's list is out of date. */
export function assertSameSet(current: readonly string[], requested: readonly string[]): void {
  const known = new Set(current)
  if (known.size !== requested.length || requested.some(id => !known.has(id))) throw stale()
}

/**
 * Serializable, so two reorders (or a reorder and an insert) cannot interleave; Postgres aborts
 * the loser with a serialization failure (Prisma P2034), which the client sees as 409 `stale`.
 */
export function serializable<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma
    .$transaction(fn, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable})
    .catch((error: unknown) => {
      if (isPrismaError(error, 'P2034')) throw stale()
      throw error
    })
}
