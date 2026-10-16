const DEFAULT_SECONDS = 60

function readSeconds(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_SECONDS
  if (/^[1-9]\d*$/.test(raw)) return Number(raw)
  console.warn(
    `CONTENT_REVALIDATE_SECONDS=${raw} is not a positive integer; using ${String(DEFAULT_SECONDS)}`
  )
  return DEFAULT_SECONDS
}

/** How long the web keeps site content before refetching it (ADR 0007/0008). e2e sets 1. */
export const CONTENT_REVALIDATE_SECONDS = readSeconds(process.env.CONTENT_REVALIDATE_SECONDS)

/** How long a content request to the API may take before the page falls back (ms). */
export const CONTENT_FETCH_TIMEOUT_MS = 2000
