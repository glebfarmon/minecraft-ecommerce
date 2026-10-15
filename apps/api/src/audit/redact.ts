const SECRET_KEYS = new Set([
  'otp',
  'code',
  'secret',
  'token',
  'tokenHash',
  'backupCodes',
  'password',
  'totpURI',
  'rconPasswordEnc'
])

/** Audit rows must never hold credentials (plan Review Focus #5). */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value === null || typeof value !== 'object' || value instanceof Date) return value
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.has(k) ? '[redacted]' : redact(v)])
  )
}
