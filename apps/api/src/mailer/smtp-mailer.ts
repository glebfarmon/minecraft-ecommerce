import {type Transporter, createTransport} from 'nodemailer'

import type {Mail, Mailer} from './mailer'

/** Plain SMTP, used against Mailpit locally and in e2e. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter

  constructor(
    url: string,
    private readonly from: string
  ) {
    this.transport = createTransport(url)
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({from: this.from, ...mail})
  }
}
