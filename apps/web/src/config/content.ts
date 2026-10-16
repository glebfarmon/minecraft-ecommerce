import {readRevalidateSeconds} from './revalidate'

/** How long the web keeps site content before refetching it (ADR 0007/0008). e2e sets 1. */
export const CONTENT_REVALIDATE_SECONDS = readRevalidateSeconds(
  'CONTENT_REVALIDATE_SECONDS',
  process.env.CONTENT_REVALIDATE_SECONDS
)

/** How long a content request to the API may take before the page falls back (ms). */
export const CONTENT_FETCH_TIMEOUT_MS = 2000
