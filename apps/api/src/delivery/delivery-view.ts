import type {AdminDelivery} from '@shop/shared/delivery'

import type {Delivery} from '../generated/prisma/client'

/** What `toAdminDelivery` reads besides the row: the server's name, loaded with it. */
export type DeliveryWithServer = Delivery & {server: {name: string}}

/** The delivery as listed in admin; `productName` is the order item's snapshot (null for a REVOKE). */
export function toAdminDelivery(
  row: DeliveryWithServer,
  productName: string | null
): AdminDelivery {
  const log: unknown = row.responseLog
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    serverName: row.server.name,
    productName,
    commands: row.commands,
    commandsDone: row.commandsDone,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError,
    replies: Array.isArray(log) ? log.map(String) : [],
    createdAt: row.createdAt.toISOString()
  }
}
