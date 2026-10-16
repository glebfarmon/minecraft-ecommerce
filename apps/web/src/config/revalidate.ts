export const DEFAULT_REVALIDATE_SECONDS = 60

/** Positive-integer seconds from env `name`; unset or empty gives 60, anything else invalid warns and gives 60. */
export function readRevalidateSeconds(name: string, raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_REVALIDATE_SECONDS
  if (/^[1-9]\d*$/.test(raw)) return Number(raw)
  console.warn(
    `${name}=${raw} is not a positive integer; using ${String(DEFAULT_REVALIDATE_SECONDS)}`
  )
  return DEFAULT_REVALIDATE_SECONDS
}
