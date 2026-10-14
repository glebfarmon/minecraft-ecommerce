import {ForbiddenException} from '@nestjs/common'

import type {Permission} from '@shop/shared/access'

/** What `requested` asks for that `actor` does not hold. */
export const missingGrants = (
  actor: readonly Permission[],
  requested: readonly Permission[]
): Permission[] => {
  const held = new Set(actor)
  return [...new Set(requested)].filter(p => !held.has(p))
}

/** An admin can only hand out permissions they hold themselves (OWNER holds all of them). */
export function assertCanGrant(
  actor: readonly Permission[],
  requested: readonly Permission[]
): void {
  if (missingGrants(actor, requested).length > 0)
    throw new ForbiddenException({statusCode: 403, message: 'cannot_grant'})
}
