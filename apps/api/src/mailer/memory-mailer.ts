import type {Mail, Mailer} from './mailer'

/**
 * Keeps mail in memory: integration tests read codes from it. Local runs without SMTP log only the
 * recipient: subjects carry sign-in codes, which must not end up in logs.
 */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = []

  send(mail: Mail): Promise<void> {
    this.sent.push(mail)
    if (process.env.NODE_ENV !== 'test')
      console.log(`[mail] to ${mail.to} kept in memory (no mail transport)`)
    return Promise.resolve()
  }

  lastTo(email: string): Mail | undefined {
    return this.sent.findLast(m => m.to === email)
  }
}
