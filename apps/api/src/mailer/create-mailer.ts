import type {Mailer} from './mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

type MailEnv = Partial<Record<'NODE_ENV' | 'RESEND_API_KEY' | 'SMTP_URL' | 'MAIL_FROM', string>>

/**
 * Resend, else SMTP, else memory (tests, local runs). Production refuses to start without a
 * transport (like `authEnv`): sign-in codes would never reach anyone.
 */
export function createMailer(env: MailEnv): Mailer {
  const from = env.MAIL_FROM ?? 'Shop <no-reply@shop.localhost>'
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, from)
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, from)
  if (env.NODE_ENV === 'production')
    throw new Error('RESEND_API_KEY or SMTP_URL must be set in production (no mail transport)')
  return new MemoryMailer()
}

let instance: Mailer | undefined
/** One mailer per process: Better Auth (built outside Nest DI) and the Nest provider share it. */
export function getMailer(): Mailer {
  instance ??= createMailer(process.env)
  return instance
}
