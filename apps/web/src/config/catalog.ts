import {readRevalidateSeconds} from './revalidate'

/** How long the web keeps the catalog before refetching it (ADR 0007). e2e sets 1. */
export const CATALOG_REVALIDATE_SECONDS = readRevalidateSeconds(
  'CATALOG_REVALIDATE_SECONDS',
  process.env.CATALOG_REVALIDATE_SECONDS
)
