/** `steve@example.com` → `s***@example.com`; the public order page never shows the full address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at)
  return `${local.length > 1 ? `${local[0] ?? ''}***` : '*'}${domain}`
}
