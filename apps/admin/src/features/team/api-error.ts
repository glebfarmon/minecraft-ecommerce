const MESSAGES: Record<string, string | undefined> = {
  owner_protected: 'The owner and system roles cannot be changed this way.',
  cannot_grant: 'You can only give out permissions you hold yourself.',
  forbidden: 'You do not have permission to do that.',
  user_exists: 'That person already has an admin account.',
  invite_closed: 'That invite was already accepted or cancelled.',
  role_in_use: 'This role is still assigned to admins or open invites. Move them first.',
  role_name_taken: 'A role with that name already exists.',
  mail_failed: 'The invite was created but the email could not be sent. Use Resend to try again.',
  unknown_role: 'That role no longer exists. Refresh and try again.'
}

/** Turns an RTK Query error into the sentence shown to the admin. */
export function apiErrorMessage(error: unknown): string {
  const e = error as {status?: unknown; data?: {message?: unknown}} | undefined
  const code = typeof e?.data?.message === 'string' ? e.data.message : undefined
  const known = code ? MESSAGES[code] : undefined
  if (known) return known
  if (e?.status === 404) return 'That item no longer exists. Refresh the page.'
  if (e?.status === 429) return 'Too many requests. Wait a moment and try again.'
  return 'Something went wrong. Try again.'
}
