import {notFound, stale} from './http-errors'

/**
 * After `updateMany({where: {id, version}})`: one row means the write landed; none means the row
 * is gone (404) or someone saved a newer version first (409 `stale`).
 */
export async function assertUpdated(count: number, exists: () => Promise<boolean>): Promise<void> {
  if (count === 1) return
  throw (await exists()) ? stale() : notFound()
}
