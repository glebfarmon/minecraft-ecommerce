import type {Mail, Mailer} from './mailer'

/** Keeps mail in memory: integration tests read codes from it; local runs without SMTP log it. */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = []

  send(mail: Mail): Promise<void> {
    this.sent.push(mail)
    if (process.env.NODE_ENV !== 'test') console.log(`[mail] to ${mail.to}: ${mail.subject}`)
    return Promise.resolve()
  }

  lastTo(email: string): Mail | undefined {
    return this.sent.findLast(m => m.to === email)
  }
}
