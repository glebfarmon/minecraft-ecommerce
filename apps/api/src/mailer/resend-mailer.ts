import {Resend} from 'resend'

import type {Mail, Mailer} from './mailer'

export class ResendMailer implements Mailer {
  private readonly resend: Resend

  constructor(
    apiKey: string,
    private readonly from: string
  ) {
    this.resend = new Resend(apiKey)
  }

  async send(mail: Mail): Promise<void> {
    const {error} = await this.resend.emails.send({from: this.from, ...mail})
    if (error) throw new Error(`resend: ${error.message}`)
  }
}
