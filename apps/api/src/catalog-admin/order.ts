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
 * A reorder also sends the order it was made from (`base`); if the list has been reordered since,
 * saving would silently replace a colleague's order (spec §6.1), so it is 409 `stale`.
 */
export function assertSameOrder(current: readonly string[], base: readonly string[]): void {
  if (current.length !== base.length || current.some((id, i) => id !== base[i])) throw stale()
}

/**
 * Runs `fn` in a SERIALIZABLE transaction: if two such transactions read and write overlapping
 * rows (two reorders, a reorder and a product move, a product save and a category detach), Postgres
 * aborts one with a serialization failure (Prisma P2034), which the client sees as 409 `stale`.
 * Only writes that go through here are protected against each other; nothing is retried.
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
