const MESSAGES: Record<string, string | undefined> = {
  'owner_protected': 'The owner and system roles cannot be changed this way.',
  'cannot_grant': 'You can only give out permissions you hold yourself.',
  'forbidden': 'You do not have permission to do that.',
  'user_exists': 'That person already has an admin account.',
  'invite_closed': 'That invite was already accepted or cancelled.',
  'role_in_use': 'This role is still assigned to admins or open invites. Move them first.',
  'role_name_taken': 'A role with that name already exists.',
  'mail_failed': 'The invite was created but the email could not be sent. Use Resend to try again.',
  'unknown_role': 'That role no longer exists. Refresh and try again.',
  'stale': 'Someone else changed this. Reload the page to see their version.',
  'in_use': 'This is still in use. Move or delete what uses it first.',
  'incomplete': 'Add both prices and both translations before enabling.',
  'slug_locked': 'Disable it first: the slug and server are in shoppers’ links and carts.',
  'slug_taken': 'That slug is already used.',
  'category_not_on_server': 'Attach that category to the server first.',
  'unknown_category': 'That category no longer exists. Refresh and try again.',
  'rcon_host_private': 'Use the game server’s public address, not an internal one.',
  'rcon_host_unresolvable': 'That host name does not resolve. Check it for typos.',
  'rcon_not_configured': 'Set host, port and password first.',
  'rcon_key_missing': 'RCON is not configured on the server (RCON_ENCRYPTION_KEY).',
  'not_published': 'Publish the draft first.',
  'unknown_key': 'That text no longer exists. Refresh the page.',
  'invalid_locale': 'Unknown language.',
  // ValibotPipe's message for a body that fails the shared schema.
  'Validation failed': 'Some fields are invalid. Check the form and try again.'
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`

/** Turns an RTK Query error into the sentence shown to the admin. */
export function apiErrorMessage(error: unknown): string {
  const e = error as
    {status?: unknown; data?: {message?: unknown; issues?: Record<string, unknown>}} | undefined
  const code = typeof e?.data?.message === 'string' ? e.data.message : undefined
  if (code === 'in_use' && e?.data?.issues) {
    const counts = Object.entries(e.data.issues)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
      .map(([what, n]) => plural(n, what.replace(/s$/, '')))
    if (counts.length > 0)
      return `This is still in use: ${counts.join(', ')}. Move or delete them first.`
  }
  if (code === 'placeholder_mismatch') {
    const expected = e?.data?.issues?.expected
    if (Array.isArray(expected) && expected.length > 0)
      return `Keep the same placeholders and tags as the original: ${expected.join(', ')}`
    return 'Keep the same placeholders and tags as the original.'
  }
  const known = code ? MESSAGES[code] : undefined
  if (known) return known
  if (e?.status === 404) return 'That item no longer exists. Refresh the page.'
  if (e?.status === 429) return 'Too many requests. Wait a moment and try again.'
  return 'Something went wrong. Try again.'
}
