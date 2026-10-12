import type {Mailer} from './mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

type MailEnv = Partial<Record<'RESEND_API_KEY' | 'SMTP_URL' | 'MAIL_FROM', string>>

export function createMailer(env: MailEnv): Mailer {
  const from = env.MAIL_FROM ?? 'Shop <no-reply@shop.localhost>'
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, from)
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, from)
  return new MemoryMailer()
}

let instance: Mailer | undefined
/** One mailer per process: Better Auth (built outside Nest DI) and the Nest provider share it. */
export function getMailer(): Mailer {
  instance ??= createMailer(process.env)
  return instance
}
