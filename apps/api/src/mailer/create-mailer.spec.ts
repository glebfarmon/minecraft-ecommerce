import {createMailer} from './create-mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

describe('createMailer', () => {
  it('uses Resend when an API key is set', () => {
    expect(createMailer({RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(ResendMailer)
  })
  it('uses SMTP (Mailpit) when SMTP_URL is set', () => {
    expect(createMailer({SMTP_URL: 'smtp://mailpit:1025', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(
      SmtpMailer
    )
  })
  it('keeps mail in memory otherwise', async () => {
    const mailer = createMailer({})
    expect(mailer).toBeInstanceOf(MemoryMailer)
    await mailer.send({to: 'x@y.z', subject: 's', html: '<p>h</p>', text: 'h'})
    expect((mailer as MemoryMailer).lastTo('x@y.z')?.subject).toBe('s')
  })
})
